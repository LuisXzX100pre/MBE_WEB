const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
function load(file, dependencies = {}) {
  const mod = { exports: {} }
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  new Function('require', 'exports', source)(name => name === 'server-only' ? {} : dependencies[name] || require(name), mod.exports)
  return mod.exports
}
class KnownError extends Error { constructor(code) { super('Internal database details'); this.code = code } }
function categoriesStore() {
  let admin = true, calls = 0, sequence = 0, racedDelete = false
  const rows = new Map()
  const category = {
    findMany: async input => { calls++; assert.deepEqual(input.orderBy, { name: 'asc' }); return [...rows.values()].sort((a,b) => a.name.localeCompare(b.name)) },
    findUnique: async ({ where }) => { calls++; return rows.get(where.id) || null },
    create: async ({ data }) => {
      calls++
      if ([...rows.values()].some(row => row.slug === data.slug)) throw new KnownError('P2002')
      const row = { id: 'c' + ++sequence, ...data, _count: { products: 0 } }
      rows.set(row.id, row); return row
    },
    update: async ({ where, data }) => {
      calls++
      const row = rows.get(where.id)
      if (!row) throw new KnownError('P2025')
      if ([...rows.values()].some(other => other.id !== row.id && other.slug === data.slug)) throw new KnownError('P2002')
      Object.assign(row, data); return row
    },
    delete: async ({ where }) => {
      calls++
      if (racedDelete) throw new KnownError('P2003')
      assert.equal(rows.get(where.id)._count.products, 0)
      rows.delete(where.id)
    },
  }
  const prisma = { category, $transaction: async work => work({ category }) }
  const helper = load('lib/admin/categories.ts', {
    '@/lib/auth': { isAdmin: async () => admin }, 'next/server': { NextResponse: { json: Response.json } },
    '@prisma/client': { Prisma: { PrismaClientKnownRequestError: KnownError } },
  })
  const deps = { '@/lib/prisma': { prisma }, '@/lib/admin/categories': helper, 'next/server': { NextResponse: { json: Response.json } } }
  const collection = load('app/api/admin/categories/route.ts', deps)
  const item = load('app/api/admin/categories/[id]/route.ts', deps)
  return { helper, collection, item, rows, get calls() { return calls }, set admin(value) { admin = value }, set racedDelete(value) { racedDelete = value } }
}
function request(method, value, headers = {}) {
  return new Request('https://mbe.test/api/admin/categories', { method, headers, ...(method === 'GET' ? {} : { body: JSON.stringify(value) }) })
}
const context = id => ({ params: { id } })
for (const method of ['POST', 'PATCH', 'DELETE', 'PUT', 'GET']) {
  test('non-ADMIN cannot call categories ' + method + ' before Prisma or body validation', async () => {
    const store = categoriesStore(); store.admin = false
    const handler = store.collection[method] || store.item[method]
    const response = await handler(request(method, { name: 'Camisetas' }), context('c1'))
    assert.equal(response.status, 401); assert.equal(store.calls, 0)
  })
}
for (const name of ['', '   ', null, 45, 'x'.repeat(81), 'bad\u0000name', 'bad\nname', 'bad\u200bname', '!!!']) {
  test('invalid category name is rejected: ' + JSON.stringify(name), async () => {
    const store = categoriesStore()
    const response = await store.collection.POST(request('POST', { name }))
    assert.equal(response.status, 400); assert.equal(store.calls, 0)
    assert.ok((await response.json()).error)
  })
}
test('valid creation normalizes name and generates server slug, ignoring client slug', async () => {
  const store = categoriesStore()
  const response = await store.collection.POST(request('POST', { name: '  Ca\u006dise\u0074as   Óversize!  ', slug: 'attacker' }))
  assert.equal(response.status, 201)
  const { category } = await response.json()
  assert.equal(category.name, 'Camisetas Óversize!'); assert.equal(category.slug, 'camisetas-oversize')
  assert.deepEqual(category._count, { products: 0 })
})
test('duplicate normalized slugs return 409, including concurrent creations', async () => {
  const store = categoriesStore()
  const responses = await Promise.all(['Camisetas', 'CAMISETAS', 'Camisétas'].map(name => store.collection.POST(request('POST', { name }))))
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409, 409])
  assert.equal(store.rows.size, 1)
  assert.equal((await responses.find(response => response.status === 409).json()).error, 'Ya existe una categoría con ese nombre.')
})
test('edit keeps ID and product relations, regenerates slug and rejects duplicates', async () => {
  const store = categoriesStore()
  const first = (await (await store.collection.POST(request('POST', { name: 'Camisetas' }))).json()).category
  await store.collection.POST(request('POST', { name: 'Accesorios' }))
  store.rows.get(first.id)._count.products = 3
  const response = await store.item.PATCH(request('PATCH', { name: 'Camisetas Oversize', slug: 'arbitrary' }), context(first.id))
  assert.equal(response.status, 200)
  const { category } = await response.json()
  assert.equal(category.id, first.id); assert.equal(category.slug, 'camisetas-oversize'); assert.equal(category._count.products, 3)
  const conflict = await store.item.PATCH(request('PATCH', { name: 'Accésorios' }), context(first.id))
  assert.equal(conflict.status, 409); assert.equal(store.rows.get(first.id).slug, 'camisetas-oversize')
  assert.equal((await store.item.PATCH(request('PATCH', { name: ' ' }), context(first.id))).status, 400)
})
test('empty category can be deleted; category with products returns 409 and is preserved', async () => {
  const store = categoriesStore()
  const create = async name => (await (await store.collection.POST(request('POST', { name }))).json()).category
  const empty = await create('Accesorios'), occupied = await create('Camisetas')
  store.rows.get(occupied.id)._count.products = 3
  assert.equal((await store.item.DELETE(request('DELETE'), context(empty.id))).status, 200)
  assert.equal(store.rows.has(empty.id), false)
  const response = await store.item.DELETE(request('DELETE'), context(occupied.id))
  assert.equal(response.status, 409)
  assert.equal((await response.json()).error, 'No puedes eliminar esta categoría porque tiene productos asociados.')
  assert.equal(store.rows.get(occupied.id)._count.products, 3)
})
test('foreign-key race prevents deletion and returns the same useful 409', async () => {
  const store = categoriesStore()
  const { category } = await (await store.collection.POST(request('POST', { name: 'Camisetas' }))).json()
  store.racedDelete = true
  const response = await store.item.DELETE(request('DELETE'), context(category.id))
  assert.equal(response.status, 409); assert.equal(store.rows.has(category.id), true)
  assert.equal((await response.json()).error.includes('productos asociados'), true)
  const migration = fs.readFileSync('prisma/migrations/20260331075549_init/migration.sql', 'utf8')
  assert.match(migration, /Product_categoryId_fkey[^\n]+ON DELETE RESTRICT/)
})
test('missing category edit/delete return 404 and GET returns ordered categories with product counts', async () => {
  const store = categoriesStore()
  assert.equal((await store.collection.GET(request('GET'))).status, 200)
  await store.collection.POST(request('POST', { name: 'Camisetas' }))
  await store.collection.POST(request('POST', { name: 'Accesorios' }))
  const result = await (await store.collection.GET(request('GET'))).json()
  assert.deepEqual(result.categories.map(row => row.name), ['Accesorios', 'Camisetas'])
  assert.ok(result.categories.every(row => row._count.products === 0))
  assert.equal((await store.item.PATCH(request('PATCH', { name: 'Nueva' }), context('missing'))).status, 404)
  assert.equal((await store.item.DELETE(request('DELETE'), context('missing'))).status, 404)
})
test('malformed requests and cross-origin mutations are rejected before DB work', async () => {
  const store = categoriesStore()
  for (const value of [null, [], {}, 'Camisetas']) assert.equal((await store.collection.POST(request('POST', value))).status, 400)
  const malformed = new Request('https://mbe.test', { method: 'POST', body: '{' })
  assert.equal((await store.collection.POST(malformed)).status, 400)
  assert.equal((await store.collection.POST(request('POST', { name: 'Camisetas' }, { origin: 'https://evil.test' }))).status, 403)
  assert.equal(store.calls, 0)
})
for (const [file, method] of [['app/api/admin/products/route.ts', 'POST'], ['app/api/admin/products/[id]/route.ts', 'PUT']]) {
  test('product ' + method + ' rejects absent/non-string/nonexistent categoryId before any writes', async () => {
    let lookups = 0
    const route = load(file, {
      '@/lib/auth': { getCurrentUser: async () => ({ role: 'ADMIN' }) }, 'next/server': { NextResponse: { json: Response.json } },
      '@/lib/prisma': { prisma: {
        category: { findUnique: async () => { lookups++; return null } },
        product: { findUnique: async () => ({ id: 'p' }), create: async () => { throw new Error('Must not write product') } },
        $transaction: async () => { throw new Error('Must not mutate images or stock') },
      } },
    })
    const payload = { name: 'Producto', price: 100, status: 'ACTIVE', images: ['https://test/image.jpg'], sizes: [] }
    for (const categoryId of ['', '   ', null, {}, 123]) {
      const response = await route[method](request(method, { ...payload, categoryId }), { params: Promise.resolve({ id: 'p' }) })
      assert.equal(response.status, 400)
    }
    assert.equal(lookups, 0)
    const response = await route[method](request(method, { ...payload, categoryId: 'missing' }), { params: Promise.resolve({ id: 'p' }) })
    assert.equal(response.status, 404); assert.equal(lookups, 1)
    assert.equal((await response.json()).error, 'La categoria seleccionada no existe')
  })
}
const navigation = { useRouter: () => ({ refresh() {}, push() {} }) }
const Link = ({ children, ...props }) => React.createElement('a', props, children)
test('product form empty state offers creation and preserves real selector when categories exist', () => {
  const { ProductForm } = load('components/admin/product-form.tsx', { 'next/navigation': navigation, 'next/link': Link, '@vercel/blob/client': {} })
  const empty = renderToStaticMarkup(React.createElement(ProductForm, { categories: [] }))
  assert.ok(empty.includes('No hay categorías disponibles.')); assert.ok(empty.includes('Crear categoría'))
  assert.ok(!empty.includes('id="product-category"'))
  const populated = renderToStaticMarkup(React.createElement(ProductForm, { categories: [{ id: 'c1', name: 'Camisetas' }, { id: 'c2', name: 'Accesorios' }] }))
  assert.ok(populated.includes('id="product-category"')); assert.ok(populated.includes('Administrar categorías'))
  assert.ok(populated.includes('<option value="c1">Camisetas</option>')); assert.ok(populated.includes('<option value="c2">Accesorios</option>'))
})
test('category manager renders useful empty, single and many category states', () => {
  const { CategoriesManager } = load('components/admin/categories-manager.tsx', { 'next/navigation': navigation })
  const render = categories => renderToStaticMarkup(React.createElement(CategoriesManager, { categories }))
  assert.ok(render([]).includes('No hay categorías todavía.')); assert.ok(render([]).includes('Crear categoría'))
  const row = { id: 'c1', name: 'Camisetas', slug: 'camisetas', _count: { products: 1 } }
  const single = render([row]); assert.ok(single.includes('1 producto')); assert.ok(single.includes('camisetas'))
  assert.ok(single.includes('Editar Camisetas')); assert.ok(single.includes('Eliminar Camisetas'))
  const many = render([row, { ...row, id: 'c2', name: 'Accesorios', _count: { products: 3 } }])
  assert.ok(many.includes('3 productos')); assert.ok(many.includes('Accesorios'))
})
test('categories page checks ADMIN before querying Prisma', async () => {
  let queries = 0
  const { default: Page } = load('app/admin/categorias/page.tsx', {
    '@/lib/auth': { isAdmin: async () => false },
    'next/navigation': { redirect: () => { throw new Error('redirect') } },
    '@/lib/prisma': { prisma: { category: { findMany: async () => { queries++; return [] } } } },
    '@/components/admin/categories-manager': {},
  })
  await assert.rejects(() => Page(), /redirect/); assert.equal(queries, 0)
})
