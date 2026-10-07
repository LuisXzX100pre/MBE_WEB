const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
function load(file, dependencies = {}) {
  const mod = { exports: {} }
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'exports', js)(name => name === 'server-only' ? {} : dependencies[name] || require(name), mod.exports)
  return mod.exports
}
const validation = load('lib/community/validation.ts')
class KnownError extends Error { constructor(code) { super(code); this.code = code } }
const originalSecret = process.env.JWT_SECRET
process.env.JWT_SECRET = 'test-only-community-invites-secret-32-chars'
test.after(() => { if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret })
function store() {
  let state = { invites: new Map(), memberships: new Map(), redemptions: new Map(), attempts: [] }, version = 0, sequence = 0, conflicts = 0
  const project = (row, select) => !row ? null : select ? Object.fromEntries(Object.keys(select).map(key => [key, row[key]])) : row
  function adapter(get, write) {
    return {
      communityMembership: {
        findUnique: async ({ where }) => get().memberships.get(where.userId) || null,
        create: async ({ data }) => { if (get().memberships.has(data.userId)) throw new KnownError('P2002'); const row = { id: 'm' + ++sequence, ...data }; get().memberships.set(data.userId, row); write(); return row },
      },
      communityAccessAttempt: {
        deleteMany: async ({ where }) => { const before = get().attempts.length; get().attempts = get().attempts.filter(row => row.userId !== where.userId || row.createdAt > where.createdAt.lte); if (before !== get().attempts.length) write() },
        count: async ({ where }) => get().attempts.filter(row => row.userId === where.userId && row.createdAt > where.createdAt.gt).length,
        create: async ({ data }) => { get().attempts.push({ id: 'a' + ++sequence, ...data }); write() },
      },
      communityInvite: {
        findUnique: async ({ where, select, include }) => { const row = where.id ? get().invites.get(where.id) : [...get().invites.values()].find(row => row.codeHash === where.codeHash); return project(row && { ...row, ...(include ? { _count: { redemptions: [...get().redemptions.values()].filter(r => r.inviteId === row.id).length } } : {}) }, select) },
        create: async ({ data, select }) => { if ([...get().invites.values()].some(row => row.codeHash === data.codeHash)) throw new KnownError('P2002'); const row = { id: 'i' + ++sequence, uses: 0, createdAt: new Date(), updatedAt: new Date(), ...data }; get().invites.set(row.id, row); write(); return project(row, select) },
        updateMany: async ({ where, data }) => { const row = get().invites.get(where.id); if (!row || !row.active || row.uses >= where.uses.lt || (row.expiresAt && row.expiresAt <= where.OR[1].expiresAt.gt)) return { count: 0 }; row.uses += data.uses.increment; write(); return { count: 1 } },
        update: async ({ where, data, select }) => { const row = get().invites.get(where.id); Object.assign(row, data); write(); return project(row, select) },
        delete: async ({ where }) => { if ([...get().redemptions.values()].some(row => row.inviteId === where.id)) throw new KnownError('P2003'); get().invites.delete(where.id); write() },
        findMany: async ({ select }) => [...get().invites.values()].map(row => project(row, select)),
      },
      communityInviteRedemption: {
        create: async ({ data }) => { if (get().redemptions.has(data.userId)) throw new KnownError('P2002'); const row = { id: 'r' + ++sequence, ...data }; get().redemptions.set(data.userId, row); write(); return row },
        findMany: async ({ where, select }) => [...get().redemptions.values()].filter(row => row.inviteId === where.inviteId).map(row => { assert.deepEqual(select.user, { select: { username: true } }); return { id: row.id, redeemedAt: row.redeemedAt, user: { username: 'username-' + row.userId } } }),
        findFirst: async ({ where }) => [...get().redemptions.values()].find(row => row.inviteId === where.inviteId && row.id === where.id),
      },
    }
  }
  const prisma = adapter(() => state, () => version++)
  prisma.$transaction = async (work, options) => {
    assert.equal(options.isolationLevel, 'Serializable')
    const base = version, snapshot = structuredClone(state); let writes = false
    const result = await work(adapter(() => snapshot, () => { writes = true }))
    if (writes) {
      if (base !== version) { conflicts++; throw new KnownError('P2034') }
      state = snapshot; version++
    }
    return result
  }
  const service = load('lib/community/invites.ts', { '@/lib/prisma': { prisma }, './validation': validation, '@prisma/client': { Prisma: { PrismaClientKnownRequestError: KnownError } } })
  return { service, prisma, get state() { return state }, get conflicts() { return conflicts } }
}
const create = (s, options = {}) => s.service.createInvite({ name: 'Campaña de prueba', type: 'CAMPAIGN', maxUses: 25, code: 'WHITEIRIS', ...options })
const invalid = error => error.status === 400 && error.message === 'Código inválido o no disponible.'
test('normalization, domain-separated hashing and generated high-entropy codes', () => {
  const s = store()
  assert.equal(s.service.hashAccessCode(' whiteiris '), s.service.hashAccessCode('WHITEIRIS'))
  assert.match(s.service.hashAccessCode('WHITEIRIS'), /^[a-f0-9]{64}$/)
  const codes = Array.from({ length: 30 }, () => s.service.generateAccessCode())
  assert.equal(new Set(codes).size, 30); assert.ok(codes.every(code => /^MBE-(?:[A-F0-9]{8}-){3}[A-F0-9]{8}$/.test(code)))
})
test('creation returns plaintext once but storage/list never contain code or signing material', async () => {
  const s = store(), { invite, code } = await create(s)
  assert.equal(code, 'WHITEIRIS'); assert.equal(invite.codeHash, undefined)
  assert.equal(JSON.stringify([...s.state.invites.values()]).includes(code), false)
  assert.equal((await s.service.listInvites()).invites[0].codeHash, undefined)
  await assert.rejects(() => create(s), e => e.code === 'P2002')
})
test('labels cannot store the full credential during creation or editing', async () => {
  const s = store()
  await assert.rejects(() => create(s, { name: 'Campaña WHITEIRIS invitados' }), /etiqueta distinta/)
  await assert.rejects(() => create(s, { name: 'PREFIXWHITEIRISSUFFIX' }), /etiqueta distinta/)
  assert.equal(s.state.invites.size, 0)
  const { invite } = await create(s)
  await assert.rejects(() => s.service.updateInvite(invite.id, { name: 'whiteiris' }), /etiqueta distinta/)
  assert.equal(s.state.invites.get(invite.id).name, 'Campaña de prueba')
})
for (const [name, options] of [['nonexistent', null], ['inactive', { active: false }], ['expired', { expiresAt: new Date(Date.now() - 1000).toISOString() }], ['exhausted', {}]]) {
  test(name + ' code has identical generic rejection and creates no membership', async () => {
    const s = store()
    if (options) { const { invite } = await create(s, options); if (name === 'exhausted') s.state.invites.get(invite.id).uses = 25 }
    await assert.rejects(() => s.service.redeemAccess('u', 'WHITEIRIS'), invalid)
    assert.equal(s.state.memberships.size, 0); assert.equal(s.state.redemptions.size, 0); assert.equal(s.state.attempts.length, 1)
  })
}
test('valid code atomically creates membership, redemption and one use using normalized input', async () => {
  const s = store(), { invite } = await create(s)
  assert.deepEqual(await s.service.redeemAccess('session-user', ' whiteiris '), { member: true })
  assert.equal(s.state.invites.get(invite.id).uses, 1)
  assert.equal(s.state.memberships.get('session-user').userId, 'session-user')
  assert.equal(s.state.redemptions.get('session-user').inviteId, invite.id)
  assert.equal((await s.service.inviteHistory(invite.id)).redemptions[0].user.username, 'username-session-user')
})
test('existing members and repeated requests do not consume more uses or attempts', async () => {
  const s = store(), { invite } = await create(s)
  await s.service.redeemAccess('u', 'WHITEIRIS')
  await s.service.redeemAccess('u', 'WRONGCODE')
  await Promise.all([s.service.redeemAccess('u', undefined), s.service.redeemAccess('u', 'WHITEIRIS')])
  assert.equal(s.state.invites.get(invite.id).uses, 1); assert.equal(s.state.redemptions.size, 1); assert.equal(s.state.attempts.length, 1)
})
test('two concurrent users competing for final campaign use never exceed maxUses', async () => {
  const s = store(), { invite } = await create(s)
  s.state.invites.get(invite.id).uses = 24
  const results = await Promise.allSettled([s.service.redeemAccess('u1', 'WHITEIRIS'), s.service.redeemAccess('u2', 'WHITEIRIS')])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.ok(results.some(r => r.status === 'rejected' && invalid(r.reason)))
  assert.equal(s.state.invites.get(invite.id).uses, 25); assert.equal(s.state.memberships.size, 1); assert.equal(s.state.redemptions.size, 1)
  assert.ok(s.conflicts > 0)
})
test('concurrent requests by same user roll back loser and use invite only once', async () => {
  const s = store(), { invite } = await create(s)
  const results = await Promise.all([s.service.redeemAccess('u', 'WHITEIRIS'), s.service.redeemAccess('u', 'WHITEIRIS')])
  assert.ok(results.every(result => result.member)); assert.equal(s.state.invites.get(invite.id).uses, 1)
  assert.equal(s.state.memberships.size, 1); assert.equal(s.state.redemptions.size, 1)
})
test('individual invite enforces one use; invalid limits cannot be stored', async () => {
  const s = store(), { invite } = await create(s, { type: 'INDIVIDUAL', maxUses: 1 })
  await s.service.redeemAccess('u1', 'WHITEIRIS'); await assert.rejects(() => s.service.redeemAccess('u2', 'WHITEIRIS'), invalid)
  assert.equal(s.state.invites.get(invite.id).uses, 1)
  for (const maxUses of [0, -1, 10001, 2.5, '25']) await assert.rejects(() => create(s, { code: 'OTHERCODE', maxUses }))
  await assert.rejects(() => create(s, { code: 'OTHERCODE', type: 'INDIVIDUAL', maxUses: 2 }))
})
test('used invite cannot be deleted but can be disabled; unused invite can be deleted', async () => {
  const s = store(), { invite } = await create(s)
  await s.service.redeemAccess('u', 'WHITEIRIS')
  await assert.rejects(() => s.service.deleteInvite(invite.id), e => e.status === 409)
  const updated = await s.service.updateInvite(invite.id, { active: false }); assert.equal(updated.active, false); assert.equal(updated.codeHash, undefined)
  await assert.rejects(() => s.service.updateInvite(invite.id, { maxUses: 0 }))
  const other = await create(s, { code: 'OTHERCODE' }); await s.service.deleteInvite(other.invite.id)
  assert.equal(s.state.invites.has(other.invite.id), false); assert.equal(s.state.redemptions.size, 1)
})
test('rolling rate limit persists failed attempts, isolates users and permits retry after window', async () => {
  const s = store()
  for (let i = 0; i < 5; i++) await assert.rejects(() => s.service.redeemAccess('u', 'WRONGCODE'), invalid)
  await assert.rejects(() => s.service.redeemAccess('u', 'WRONGCODE'), e => e.status === 429)
  assert.equal(s.state.attempts.length, 5)
  await assert.rejects(() => s.service.redeemAccess('other', 'WRONGCODE'), invalid)
  s.state.attempts.forEach(row => { row.createdAt = new Date(Date.now() - 600001) })
  await assert.rejects(() => s.service.redeemAccess('u', 'WRONGCODE'), invalid)
  assert.equal(s.state.attempts.filter(row => row.userId === 'u').length, 1)
})
test('simultaneous rate-limit requests cannot admit a sixth attempt', async () => {
  const s = store()
  for (let i = 0; i < 4; i++) await assert.rejects(() => s.service.redeemAccess('u', 'WRONGCODE'), invalid)
  const results = await Promise.allSettled([s.service.redeemAccess('u', 'WRONGCODE'), s.service.redeemAccess('u', 'WRONGCODE')])
  assert.ok(results.some(result => result.reason.status === 429)); assert.equal(s.state.attempts.length, 5)
})
function guard(s, user) {
  return load('lib/community/api.ts', { '@/lib/auth': { getCurrentUser: async () => user }, '@/lib/prisma': { prisma: s.prisma }, './validation': validation,
    'next/server': { NextResponse: { json: Response.json } }, '@prisma/client': { Prisma: { PrismaClientKnownRequestError: KnownError } } })
}
test('redeem requires session, takes identity only from session and exposes no GET redemption', async () => {
  const s = store(); await create(s)
  const dependencies = { '@/lib/community/validation': validation, '@/lib/community/invites': s.service }
  const makeRoute = user => load('app/api/community/access/redeem/route.ts', { ...dependencies, '@/lib/community/api': guard(s, user) })
  const req = () => new Request('https://mbe.test/api/community/access/redeem', { method: 'POST', body: JSON.stringify({ code: 'WHITEIRIS', userId: 'forged' }) })
  assert.equal((await makeRoute(null).POST(req())).status, 401); assert.equal(s.state.attempts.length, 0)
  const route = makeRoute({ id: 'session-user', role: 'CLIENTE' })
  assert.equal(route.GET, undefined); assert.equal((await route.POST(req())).status, 200)
  assert.ok(s.state.memberships.has('session-user')); assert.ok(!s.state.memberships.has('forged'))
})
for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
  test('CLIENTE cannot manage invitations: ' + method, async () => {
    const s = store(), route = load(method === 'POST' ? 'app/api/admin/community/invites/route.ts' : 'app/api/admin/community/invites/[id]/route.ts', {
      '@/lib/community/api': guard(s, { id: 'u', role: 'CLIENTE' }), '@/lib/community/validation': validation, '@/lib/community/invites': s.service,
    })
    const response = await route[method](new Request('https://mbe.test/api/admin/community/invites', { method }), { params: { id: 'i' } })
    assert.equal(response.status, 403); assert.equal(s.state.invites.size, 0)
  })
}
test('membership guard denies private APIs including media until authorized, ADMIN panel independent', async () => {
  const s = store(), user = { id: 'u', role: 'CLIENTE' }, api = guard(s, user)
  await assert.rejects(() => api.member(), e => e.status === 403)
  s.state.memberships.set('u', { id: 'm' }); assert.equal((await api.member()).id, 'u')
  const admin = guard(s, { id: 'admin', role: 'ADMIN' }); assert.equal((await admin.member(undefined, true)).id, 'admin')
  await assert.rejects(() => admin.member(), e => e.status === 403)
})
test('all private Community handlers reject nonmembers before loading content', async () => {
  const s = store(), api = guard(s, { id: 'u', role: 'CLIENTE' })
  const dependencies = { '@/lib/community/api': api, '@/lib/community/validation': validation, '@/lib/prisma': { prisma: {} },
    '@/lib/community/posts': {}, '@/lib/community/wheel': {}, '@/lib/community/events': {}, '@/lib/community/media': {}, '@vercel/blob': {} }
  for (const file of ['posts', 'wheel', 'comments', 'events', 'media/[id]']) {
    const route = load('app/api/community/' + file + '/route.ts', dependencies)
    for (const method of ['GET','POST']) if (route[method]) {
      const response = await route[method](new Request('https://mbe.test/api/community/' + file, { method }), { params: { id: 'p' } })
      assert.equal(response.status, 403, file + ' ' + method)
    }
  }
})
const placeholder = () => null
test('access page pre-fills code without redeeming; anonymous goes to login and members to Community', async () => {
  let access = { user: { id: 'u' }, membership: null }
  const { default: Page } = load('app/comunidad/acceso/page.tsx', {
    '@/lib/community/membership': { communityAccess: async () => access }, '@/lib/community/access-link': load('lib/community/access-link.ts'),
    'next/navigation': { redirect: url => { throw new Error(url) } },
    '@/components/community/access-form': { AccessForm: ({ initialCode }) => React.createElement('input', { defaultValue: initialCode }) },
    '@/components/store/header': { Header: placeholder }, '@/components/store/footer': { Footer: placeholder },
  })
  const html = renderToStaticMarkup(await Page({ searchParams: { code: 'whiteiris' } }))
  assert.ok(html.includes('value="WHITEIRIS"'))
  access.membership = { id: 'm' }; await assert.rejects(() => Page({ searchParams: {} }), /^Error: \/comunidad$/)
  access = { user: null, membership: null }; await assert.rejects(() => Page({ searchParams: { code: 'whiteiris' } }), /login\?next=.*WHITEIRIS/)
})
test('login return helper preserves invite code without permitting external redirects', () => {
  const { communityReturnPath } = load('lib/community/access-link.ts')
  assert.equal(communityReturnPath('/comunidad'), '/comunidad')
  assert.equal(communityReturnPath('/comunidad/acceso?code=whiteiris'), '/comunidad/acceso?code=WHITEIRIS')
  for (const path of ['https://evil.test', '//evil.test', '/comunidad/acceso/../admin', '/admin', '/comunidad/accesoX']) assert.equal(communityReturnPath(path), null)
})
test('access form has prefill but only submit performs POST; LIVE CTA stays in same flow', () => {
  const { AccessForm } = load('components/community/access-form.tsx', { 'next/navigation': { useRouter: () => ({}) } })
  const html = renderToStaticMarkup(React.createElement(AccessForm, { initialCode: 'WHITEIRIS' }))
  assert.ok(html.includes('value="WHITEIRIS"')); assert.ok(html.includes('Código de acceso'))
  const source = fs.readFileSync('components/community/access-form.tsx', 'utf8'); assert.ok(!source.includes('useEffect'))
  const { CommunitySection } = load('components/store/community-section.tsx', { 'next/link': ({ children, href }) => React.createElement('a', { href }, children) })
  const cta = renderToStaticMarkup(React.createElement(CommunitySection, { communityCount: 1 }))
  assert.ok(cta.includes('href="/comunidad"')); assert.ok(!cta.includes('LIVE')); assert.ok(cta.includes('bg-red-500')); assert.ok(cta.includes('motion-safe:animate-pulse'))
})
test('schema keeps independent memberships, unique hashes/redemptions and database usage checks', () => {
  const { Prisma } = require('@prisma/client')
  const model = name => Prisma.dmmf.datamodel.models.find(model => model.name === name)
  assert.ok(model('CommunityInvite').fields.find(field => field.name === 'codeHash').isUnique)
  assert.ok(!model('CommunityInvite').fields.some(field => field.name === 'code'))
  assert.ok(model('CommunityInviteRedemption').fields.find(field => field.name === 'userId').isUnique)
  assert.ok(!model('CommunityMembership').fields.some(field => field.name === 'inviteId'))
  const sql = fs.readFileSync('prisma/migrations/20261006205809_community_access_invites/migration.sql', 'utf8')
  assert.ok(sql.includes('"uses" BETWEEN 0 AND "maxUses"')); assert.ok(sql.includes('ON DELETE RESTRICT'))
  assert.ok(!/DELETE FROM|UPDATE "CommunityMembership"|DROP TABLE/.test(sql))
})

// Exercise the real manager handlers/state and transport without a browser or live DB.
async function mountInvites(request) {
  const slots = [], effects = []; let index = 0, mounted = false
  const hooks = {
    useState(initial) {
      const slot = index++
      if (!(slot in slots)) slots[slot] = initial
      return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value }]
    },
    useRef(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot] },
    useEffect(effect) { if (!mounted) effects.push(effect) },
  }
  const { InvitesManager } = load('components/admin/community/invites-manager.tsx', {
    react: hooks, './request': { communityRequest: request, field: '', action: '' },
  })
  let tree
  function render() { index = 0; tree = InvitesManager(); mounted = true; return tree }
  function elements(node = tree) {
    if (!React.isValidElement(node)) return []
    return [node, ...React.Children.toArray(node.props.children).flatMap(elements)]
  }
  render(); effects.forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve)); render()
  return {
    render, elements,
    html: () => renderToStaticMarkup(render()),
    button: label => elements().find(node => node.type === 'button' && node.props.children === label),
    field: label => elements().find(node => node.type === 'label' && React.Children.toArray(node.props.children).some(child => typeof child === 'string' && child.trim() === label)).props.children.find(node => React.isValidElement(node) && node.type === 'input'),
    submit: () => elements().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }),
  }
}
function adminInviteRoutes(s) {
  const dependencies = { '@/lib/community/api': guard(s, { id: 'admin', role: 'ADMIN' }), '@/lib/community/validation': validation, '@/lib/community/invites': s.service }
  return {
    collection: load('app/api/admin/community/invites/route.ts', dependencies),
    item: load('app/api/admin/community/invites/[id]/route.ts', dependencies),
  }
}
test('POST and PATCH expose matching invite envelopes without leaking hash or code on edit', async () => {
  const s = store(), routes = adminInviteRoutes(s)
  const created = await routes.collection.POST(new Request('https://mbe.test/api/admin/community/invites', {
    method: 'POST', body: JSON.stringify({ name: 'Regresión campaña', type: 'CAMPAIGN', maxUses: 25, code: 'TESTCODE123' }),
  }))
  assert.equal(created.status, 200)
  const result = await created.json()
  assert.deepEqual(Object.keys(result).sort(), ['code', 'invite'])
  const response = await routes.item.PATCH(new Request('https://mbe.test/api/admin/community/invites/' + result.invite.id, {
    method: 'PATCH', body: JSON.stringify({ name: 'Campaña actualizada' }),
  }), { params: { id: result.invite.id } })
  assert.equal(response.status, 200)
  const updated = await response.json()
  assert.deepEqual(Object.keys(updated), ['invite'])
  assert.equal(updated.invite.id, result.invite.id); assert.equal(updated.invite.name, 'Campaña actualizada')
  assert.equal(updated.invite.codeHash, undefined); assert.equal(updated.code, undefined)
})
for (const [label, payload, expected] of [
  ['Expiración opcional (hora local)', { expiresAt: '2099-01-15T12:30' }, 'expiresAt'],
  ['Etiqueta / campaña', { name: 'Campaña editada' }, 'name'],
  ['Activo', { active: false }, 'active'],
  ['Máximo de usos', { maxUses: 30 }, 'maxUses'],
]) {
  test('used campaign PATCH updates manager immediately and preserves redemption: ' + expected, async () => {
    const s = store(), { invite } = await create(s)
    await s.service.redeemAccess('member', 'WHITEIRIS')
    const history = structuredClone([...s.state.redemptions.values()]), membership = structuredClone([...s.state.memberships.values()])
    const routes = adminInviteRoutes(s), originalFetch = global.fetch, methods = [], responses = []
    global.fetch = async (url, options) => {
      methods.push(options.method)
      const request = new Request('https://mbe.test' + url, options)
      const response = options.method === 'GET' ? await routes.collection.GET(request) : await routes.item.PATCH(request, { params: { id: invite.id } })
      responses.push(response.status); return response
    }
    try {
      const { communityRequest } = load('components/admin/community/request.ts')
      const ui = await mountInvites(communityRequest)
      ui.button('Editar').props.onClick(); ui.render()
      const value = payload[expected]
      ui.field(label).props.onChange({ target: { value: String(value), checked: value } }); ui.render()
      await ui.submit(); ui.render()
      assert.deepEqual(methods, ['GET', 'PATCH']); assert.deepEqual(responses, [200, 200])
      const article = ui.elements().find(node => node.type === 'article')
      const html = renderToStaticMarkup(article), saved = s.state.invites.get(invite.id)
      if (expected === 'expiresAt') { assert.equal(saved.expiresAt.toISOString(), new Date(value).toISOString()); assert.ok(html.includes(saved.expiresAt.toLocaleString())) }
      if (expected === 'name') assert.ok(html.includes(value))
      if (expected === 'active') { assert.equal(saved.active, false); assert.ok(html.includes('INACTIVO')) }
      if (expected === 'maxUses') { assert.equal(saved.maxUses, 30); assert.ok(html.includes('1 / 30')) }
      assert.equal(saved.uses, 1)
      assert.deepEqual([...s.state.redemptions.values()], history); assert.deepEqual([...s.state.memberships.values()], membership)
      assert.ok(!ui.elements().some(node => node.props.role === 'alert'))
      const deleted = await routes.item.DELETE(new Request('https://mbe.test/api/admin/community/invites/' + invite.id, { method: 'DELETE' }), { params: { id: invite.id } })
      assert.equal(deleted.status, 409); assert.deepEqual([...s.state.redemptions.values()], history)
    } finally { global.fetch = originalFetch }
  })
}
test('active toggle consumes PATCH invite envelope and replaces the list item', async () => {
  const s = store(), { invite } = await create(s), routes = adminInviteRoutes(s)
  const ui = await mountInvites(async (url, method = 'GET', data) => {
    const request = new Request('https://mbe.test' + url, { method, ...(data ? { body: JSON.stringify(data) } : {}) })
    const response = method === 'GET' ? await routes.collection.GET(request) : await routes.item.PATCH(request, { params: { id: invite.id } })
    assert.equal(response.status, 200); return response.json()
  })
  await ui.button('Desactivar').props.onClick(); ui.render()
  assert.ok(ui.html().includes('INACTIVO')); assert.ok(ui.button('Activar'))
})
for (const operation of ['save', 'toggle']) {
  test('malformed successful response shows controlled error without changing list: ' + operation, async () => {
    const s = store(), { invite } = await create(s)
    for (const result of [null, {}, { invite: null }, { invite: {} }, { invite: { id: 'wrong-id' } }]) {
      const ui = await mountInvites(async (url, method = 'GET') => method === 'GET' ? s.service.listInvites() : result)
      if (operation === 'save') { ui.button('Editar').props.onClick(); ui.render(); await ui.submit() }
      else await ui.button('Desactivar').props.onClick()
      const html = ui.html()
      assert.ok(html.includes('La respuesta no contiene una invitación válida.'))
      assert.ok(html.includes(invite.name)); assert.ok(!html.includes('TypeError'))
      assert.ok(ui.button('Desactivar')); assert.equal(s.state.invites.get(invite.id).active, true)
    }
  })
}