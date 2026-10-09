const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function loader(dependencies = {}) {
  const cache = new Map()
  function load(file) {
    file = path.resolve(file)
    if (cache.has(file)) return cache.get(file).exports
    const mod = { exports: {} }; cache.set(file, mod)
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    new Function('require', 'exports', source)(name => {
      if (dependencies[name]) return dependencies[name]
      if (name === 'server-only') return {}
      const base = name.startsWith('@/') ? path.resolve(name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
      const local = base && [base + '.ts', base + '.tsx'].find(fs.existsSync)
      return local ? load(local) : require(name)
    }, mod.exports)
    return mod.exports
  }
  return load
}
const variants = loader()('lib/product-variants.ts')
const makeColor = (id, stocks = [2,4,0,1], changes = {}) => ({ id, productId: 'p', name: id === 'crudo' ? 'Crudo' : 'Negro', swatchHex: '#111111', active: true, order: id === 'crudo' ? 0 : 1, images: [{ id: id + '-1', url: '/' + id + '-1.jpg' }, { id: id + '-2', url: '/' + id + '-2.jpg' }], sizeStocks: ['S','M','L','XL'].map((size, i) => ({ id: id + size, colorId: id, size, stock: stocks[i] })), ...changes })
const makeProduct = changes => ({ id: 'p', name: 'DROP', description: null, price: 450, stock: 14, status: 'ACTIVE', releaseAt: null, categoryId: 'cat', category: { name: 'Playeras', slug: 'playeras' }, images: [], sizes: [], colors: [makeColor('crudo'),makeColor('negro',[0,2,3,2])], ...changes })
const legacy = changes => makeProduct({ colors: [], images: [{ id: 'legacy', url: '/legacy.jpg' }], sizes: [{ id: 'sizeM', size: 'M', stock: 4 }], stock: 4, ...changes })

test('legacy inventory/images and sized/unsized selection remain supported', () => {
  assert.equal(variants.productStock(legacy()), 4); assert.equal(variants.productImage(legacy()), '/legacy.jpg')
  assert.equal(variants.validateSelection(legacy(), null, 'M', 2), null)
  assert.equal(variants.validateSelection(legacy({ sizes: [] }), null, null, 2), null)
})
test('default is first active by order, preferring available color over exhausted default', () => {
  assert.equal(variants.defaultColor(makeProduct()).id, 'crudo')
  assert.equal(variants.defaultColor(makeProduct({ colors: [makeColor('crudo',[0,0,0,0]),makeColor('negro')] })).id, 'negro')
})
test('one exhausted color does not mark product sold out; all exhausted/inactive do', () => {
  const crudo = makeColor('crudo',[0,0,0,0]), negro = makeColor('negro',[0,2,0,0])
  assert.equal(variants.colorStock(crudo), 0); assert.equal(variants.productStock(makeProduct({ colors: [crudo,negro] })), 2)
  assert.equal(variants.productStock(makeProduct({ colors: [crudo,{ ...negro, active: false }] })), 0)
})
for (const [label, color, size, qty, change] of [
  ['missing color',null,'M',1], ['missing size','crudo',null,1], ['foreign color','foreign','M',1], ['insufficient stock','crudo','L',1],
  ['inactive color','crudo','M',1,{ colors:[makeColor('crudo',undefined,{active:false})] }],
  ['fractional quantity','crudo','M',1.5], ['negative quantity','crudo','M',-1], ['locked drop','crudo','M',1,{status:'COMING_SOON',releaseAt:'2099-01-01'}], ['inactive product','crudo','M',1,{status:'INACTIVE'}],
]) test('server rejects ' + label, () => assert.throws(() => variants.validateSelection(makeProduct(change),color,size,qty), variants.ProductSelectionError))
test('cart identities include color and size with a non-null legacy identity', () => {
  assert.notEqual(variants.variantKey('crudo','M'), variants.variantKey('negro','M'))
  assert.equal(variants.variantKey(null,null), 'legacy:NONE')
})
test('cart thumbnail uses selected color and never another color', () => {
  const product=makeProduct({images:[{url:'/legacy.jpg'}]})
  assert.equal(variants.cartImage({product,productColor:product.colors[1]}),'/negro-1.jpg')
  assert.equal(variants.cartImage({product,productColor:{images:[]}}),null)
  assert.equal(variants.cartImage({product}),'/legacy.jpg')
})
test('Home promotion wins; card keeps principal/color image; Home has legacy/color fallback', () => {
  const product=makeProduct({homeHeroImageUrl:'/promotion.jpg'})
  assert.equal(variants.homeHeroImage(product),'/promotion.jpg'); assert.equal(variants.productImage(product),'/crudo-1.jpg')
  assert.equal(variants.homeHeroImage(makeProduct()),'/crudo-1.jpg')
  assert.equal(variants.homeHeroImage(legacy()),'/legacy.jpg')
  const hero=loader()('lib/home-hero-slides.ts')
  assert.equal(hero.buildHeroSlides([product],null)[0].image,'/promotion.jpg')
  assert.equal(hero.buildHeroSlides([makeProduct({colors:[makeColor('crudo',[0,0,0,0]),makeColor('negro')]})],null)[0].soldOut,false)
})

const Link = ({children,href}) => React.createElement('a',{href},children)
const Image = ({src,alt}) => React.createElement('img',{src,alt})
function uiHarness(file, exportName, props, deps = {}) {
  let index=0, tree; const slots=[]
  const hooks={ ...React,
    useState(initial) { const i=index++; if(!(i in slots)) slots[i]=typeof initial==='function'?initial():initial; return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}] },
    useRef(initial) {const i=index++; if(!(i in slots)) slots[i]={current:initial}; return slots[i]},
    useMemo(fn) {return fn()}, useEffect() {}, useCallback(fn) {return fn},
  }
  const load=loader({ react:hooks, 'next/image':Image, 'next/link':Link, 'next/navigation':{useRouter:()=>({push(){},refresh(){}})}, ...deps })
  const component=load(file)[exportName]
  function render(){index=0;tree=component(props);return tree}
  function elements(node=tree){if(!React.isValidElement(node))return[];return[node,...React.Children.toArray(node.props.children).flatMap(elements)]}
  render()
  return { render, elements, html:()=>renderToStaticMarkup(tree), find: fn => elements().find(fn) }
}
function detail(product=makeProduct()) {
  const added=[]
  const ui=uiHarness('components/store/product-detail.tsx','ProductDetail',{product,relatedProducts:[]},{'@/contexts/cart-context':{useCart:()=>({addToCart:async(...args)=>{added.push(args);return{success:true}}})},'./drop-countdown':{DropCountdown:()=>null}})
  return {...ui,added, color:name=>ui.find(e=>e.type==='button'&&e.props['aria-pressed']!==undefined&&React.Children.toArray(e.props.children).some(child=>child?.props?.children===name)), size:name=>ui.find(e=>e.type==='button'&&e.props.children===name)}
}
test('detail loads both colors, default gallery and no automatic size', () => {
  const ui=detail(); assert.equal(ui.color('Crudo').props['aria-pressed'],true); assert.ok(ui.color('Negro'))
  assert.ok(ui.html().includes('/crudo-1.jpg')); assert.ok(!ui.html().includes('/negro-1.jpg')); assert.ok(ui.html().includes('Selecciona una talla'))
})
test('switching color updates only gallery and resets selected image to zero', () => {
  const ui=detail(); ui.find(e=>e.props['aria-label']==='Siguiente imagen').props.onClick();ui.render()
  assert.equal(ui.elements().find(e=>e.type===Image).props.src,'/crudo-2.jpg')
  ui.color('Negro').props.onClick();ui.render();assert.equal(ui.elements().find(e=>e.type===Image).props.src,'/negro-1.jpg');assert.ok(!ui.html().includes('/crudo-'))
})
test('size availability follows color; invalid size clears and retained size clamps quantity', () => {
  const ui=detail();assert.equal(ui.size('L').props.disabled,true);ui.size('S').props.onClick();ui.render()
  ui.color('Negro').props.onClick();ui.render();assert.equal(ui.size('S').props.disabled,true);assert.equal(ui.size('L').props.disabled,false);assert.ok(ui.html().includes('Selecciona una talla'))
  ui.color('Crudo').props.onClick();ui.render();ui.size('M').props.onClick();ui.render()
  for(let i=0;i<3;i++){ui.find(e=>e.props['aria-label']==='Aumentar cantidad').props.onClick();ui.render()}
  ui.color('Negro').props.onClick();ui.render();assert.ok(ui.html().includes('2 disponibles en talla M'))
  assert.equal(ui.find(e=>e.props['aria-label']==='Aumentar cantidad').props.disabled,true)
})
test('add button transports selected color ID, size and clamped quantity', async () => {
  const ui=detail();ui.color('Negro').props.onClick();ui.render();ui.size('M').props.onClick();ui.render()
  await ui.find(e=>e.type==='button'&&e.props.children?.some?.(child=>child==='Agregar al carrito')).props.onClick()
  assert.deepEqual(ui.added,[['p',1,'M','negro']])
})
test('legacy detail keeps gallery and sizes; color sold out is labeled independently', () => {
  assert.ok(detail(legacy()).html().includes('/legacy.jpg'))
  const ui=detail(makeProduct({colors:[makeColor('crudo',[0,0,0,0]),makeColor('negro')]}));assert.ok(ui.html().includes('Agotado'));assert.equal(ui.color('Negro').props['aria-pressed'],true)
})
test('ProductCard uses color photo without Home promotion and choosing options opens detail', async () => {
  let navigated, added=false
  const ui=uiHarness('components/store/product-card.tsx','ProductCard',{product:makeProduct({homeHeroImageUrl:'/promotion.jpg'})},{'next/navigation':{useRouter:()=>({push:url=>{navigated=url}})},'@/contexts/cart-context':{useCart:()=>({addToCart:()=>{added=true}})}})
  assert.ok(ui.html().includes('/crudo-1.jpg'));assert.ok(!ui.html().includes('/promotion.jpg'))
  await ui.find(e=>e.type==='button').props.onClick({preventDefault(){},stopPropagation(){}});assert.equal(navigated,'/productos/p');assert.equal(added,false)
})
test('LiveDropFixedHero uses Home override and color fallback without changing priority', () => {
  for(const override of ['/promotion.jpg',null]) {
    const product=makeProduct({dropName:'DROP',homeHeroImageUrl:override})
    const ui=uiHarness('components/store/home-hero-switcher.tsx','HomeHeroSwitcher',{nextDrop:null,recentDrop:product,heroSlides:[]},{'@/components/store/home-hero-carousel':{HomeHeroCarousel:()=>null},'@/components/store/drop-countdown':{DropCountdown:()=>null},'@/lib/audio-unlock':{}})
    assert.ok(ui.html().includes(override||'/crudo-1.jpg'))
  }
})

// Optimistic transactional store: concurrent snapshots conflict, rollback and retry through the real helper.
function store(initialProducts=[makeProduct()]) {
  let state={products:structuredClone(initialProducts),carts:[],cartItems:[],orders:[],payments:[]},version=0,sequence=0
  const calls=[]
  function matches(row,where={}) {return Object.entries(where).every(([key,value])=>{
    if(key==='cartId_productId_variantKey'||key==='colorId_size'||key==='productId_size')return matches(row,value)
    if(value&&typeof value==='object'){if('gte'in value)return row[key]>=value.gte;if('notIn'in value)return !value.notIn.includes(row[key]);if('in'in value)return value.in.includes(row[key]);return matches(row[key]||{},value)}
    return row[key]===value
  })}
  const change=(row,data)=>{for(const[key,value]of Object.entries(data)){if(value&&typeof value==='object'&&('increment'in value||'decrement'in value))row[key]+=(value.increment||0)-(value.decrement||0);else row[key]=value}return row}
  function client(data) {
    const colors=()=>data.products.flatMap(p=>p.colors), sizes=()=>colors().flatMap(c=>c.sizeStocks), legacySizes=()=>data.products.flatMap(p=>p.sizes.map(s=>({...s,productId:p.id})))
    function model(name,rows,onCreate) {
      const getRows=typeof rows==='function'?rows:()=>rows
      return {
        findUnique:async({where})=>getRows().find(row=>matches(row,where))||null,
        findFirst:async({where})=>getRows().find(row=>matches(row,where))||null,
        findUniqueOrThrow:async({where})=>{const row=getRows().find(row=>matches(row,where));if(!row)throw Error('Missing '+name);return row},
        findMany:async({where}={})=>getRows().filter(row=>matches(row,where)),count:async({where})=>getRows().filter(row=>matches(row,where)).length,
        update:async({where,data:patch})=>{const row=getRows().find(row=>matches(row,where));assert.ok(row,name);return change(row,patch)},
        updateMany:async({where,data:patch})=>{calls.push({name,where,patch});const rows=getRows().filter(row=>matches(row,where));rows.forEach(row=>change(row,patch));return{count:rows.length}},
        create:async({data:input})=>{const row={id:name+ ++sequence,...input};if(onCreate)onCreate(row);else getRows().push(row);return row},
        upsert:async({where,create,update})=>{const row=getRows().find(row=>matches(row,where));if(row)return change(row,update);const saved={id:name+ ++sequence,...create};if(onCreate)onCreate(saved);else getRows().push(saved);return saved},
        delete:async({where})=>{const rows=getRows(),i=rows.findIndex(row=>matches(row,where));if(i>=0)rows.splice(i,1)},
        deleteMany:async({where})=>{const rows=getRows();for(let i=rows.length-1;i>=0;i--)if(matches(rows[i],where))rows.splice(i,1)},
        createMany:async({data:inputs})=>inputs.forEach(input=>getRows().push({id:name+ ++sequence,...input})),
      }
    }
    const tx={
      product:model('product',data.products,row=>{row.images=row.images?.create||[];row.sizes=row.sizes?.create||[];row.colors=[];data.products.push(row)}),
      productColor:model('color',colors,row=>{row.images=[];row.sizeStocks=[];data.products.find(p=>p.id===row.productId).colors.push(row)}),
      productColorSize:model('colorSize',sizes,row=>colors().find(c=>c.id===row.colorId).sizeStocks.push(row)),
      productColorImage:{deleteMany:async({where})=>{colors().find(c=>c.id===where.colorId).images=[]},createMany:async({data:rows})=>{rows.forEach(row=>colors().find(c=>c.id===row.colorId).images.push(row))}},
      productSize:{...model('legacySize',legacySizes),updateMany:async({where,data:patch})=>{calls.push({name:'legacySize',where,patch});let count=0;for(const p of data.products)if(p.id===where.productId)for(const s of p.sizes)if(matches({...s,productId:p.id},where)){change(s,patch);count++}return{count}},upsert:async({where,create,update})=>{const p=data.products.find(p=>p.id===where.productId_size.productId);const row=p.sizes.find(s=>s.size===where.productId_size.size);if(row)return change(row,update);p.sizes.push(create);return create}},
      productImage:{findMany:async({where})=>data.products.find(p=>p.id===where.productId).images,update:async({where,data:patch})=>change(data.products.flatMap(p=>p.images).find(i=>i.id===where.id),patch),create:async({data:input})=>{const image={id:'image'+ ++sequence,...input};data.products.find(p=>p.id===input.productId).images.push(image);return image},deleteMany:async({where})=>{data.products.find(p=>p.id===where.productId).images=data.products.find(p=>p.id===where.productId).images.filter(i=>where.url.notIn.includes(i.url))},createMany:async({data:rows})=>rows.forEach(row=>data.products.find(p=>p.id===row.productId).images.push(row))},
      cart:model('cart',data.carts),cartItem:model('cartItem',data.cartItems),
      order:model('order',data.orders,row=>{row.inventoryDiscounted=false;row.items=row.items.create.map(item=>({id:'item'+ ++sequence,...item}));data.orders.push(row)}),
      orderItem:{count:async({where})=>data.orders.flatMap(o=>o.items).filter(i=>matches(i,where)).length},
      payment:model('payment',data.payments),category:{findUnique:async()=>({id:'cat'})},
    }
    return tx
  }
  const prisma=new Proxy({}, {get(_target,key){if(key==='$transaction')return async(work,options)=>{if(options)assert.equal(options.isolationLevel,'Serializable');const originalVersion=version,copy=structuredClone(state);const result=await work(client(copy));if(version!==originalVersion)throw Object.assign(Error('serialization conflict'),{code:'P2034'});state=copy;version++;return result};return client(state)[key]}})
  const load=loader({'@/lib/prisma':{prisma},'next/cache':{revalidatePath(){}},'next/server':{NextResponse:{json:Response.json}},'@/lib/auth':{getCurrentUser:async()=>({id:'user',role:'ADMIN'})}})
  return {prisma,load,calls,get state(){return state},addOrder(items){state.orders.push({id:'o'+state.orders.length,inventoryDiscounted:false,items});return state.orders.at(-1).id}}
}
test('cart API rejects forged color, missing color/size and insufficient stock; repeated adds separate variants', async () => {
  const db=store(),route=db.load('app/api/cart/add/route.ts')
  const request=body=>new Request('https://mbe.test',{method:'POST',body:JSON.stringify(body)})
  for(const body of [{size:'M'},{productColorId:'crudo'},{productColorId:'foreign',size:'M'},{productColorId:'crudo',size:'L'}]) assert.equal((await route.POST(request({productId:'p',...body}))).status,400)
  for(const color of ['crudo','negro'])assert.equal((await route.POST(request({productId:'p',productColorId:color,size:'M',quantity:1}))).status,200)
  assert.equal(db.state.cartItems.length,2)
  assert.equal((await route.POST(request({productId:'p',productColorId:'crudo',size:'M',quantity:1}))).status,200)
  assert.deepEqual(db.state.cartItems.map(i=>i.quantity),[2,1])
})
test('concurrent repeated cart requests retry serializable conflicts and produce one consistent line', async () => {
  const db=store(),{mutateCart}=db.load('lib/cart-mutations.ts')
  await Promise.all([1,2,3].map(()=>mutateCart('user',{productId:'p',productColorId:'crudo',size:'M',quantity:1},'add')))
  assert.equal(db.state.cartItems.length,1);assert.equal(db.state.cartItems[0].quantity,3)
  await assert.rejects(()=>mutateCart('user',{productId:'p',productColorId:'crudo',size:'M',quantity:2},'add'))
  assert.equal(db.state.cartItems[0].quantity,3)
})
test('updating/removing Negro never modifies the Crudo line; legacy unsized adds deduplicate', async () => {
  const db=store(),{mutateCart}=db.load('lib/cart-mutations.ts')
  for(const productColorId of ['crudo','negro'])await mutateCart('user',{productId:'p',productColorId,size:'M',quantity:1},'add')
  await mutateCart('user',{productId:'p',productColorId:'negro',size:'M',quantity:2},'update')
  await mutateCart('user',{productId:'p',productColorId:'negro',size:'M'},'remove')
  assert.deepEqual(db.state.cartItems.map(i=>[i.productColorId,i.quantity]),[['crudo',1]])
  const old=store([legacy({sizes:[]})]),mutation=old.load('lib/cart-mutations.ts').mutateCart
  await mutation('user',{productId:'p',quantity:1},'add');await mutation('user',{productId:'p',quantity:1},'add');assert.equal(old.state.cartItems.length,1);assert.equal(old.state.cartItems[0].quantity,2)
})
test('exact color/size discount and cancellation restore remain idempotent after deactivation/rename', async () => {
  const db=store(),inventory=db.load('lib/inventory.ts'),id=db.addOrder([{productId:'p',productColorId:'negro',colorName:'Negro',size:'L',quantity:2}])
  await Promise.all([inventory.applyInventoryForOrder(id),inventory.applyInventoryForOrder(id)])
  let p=db.state.products[0];assert.equal(p.colors[1].sizeStocks[2].stock,1);assert.equal(p.colors[0].sizeStocks[2].stock,0);assert.equal(p.stock,12);assert.equal(db.calls.filter(c=>c.name==='legacySize').length,0)
  p.colors[1].name='Azabache';p.colors[1].active=false
  await Promise.all([inventory.restoreInventoryForOrder(id),inventory.restoreInventoryForOrder(id)])
  p=db.state.products[0];assert.equal(p.colors[1].sizeStocks[2].stock,3);assert.equal(p.stock,14);assert.equal(db.state.orders[0].items[0].colorName,'Negro')
})
test('competing orders for final unit cannot oversell and failed transaction rolls back flag/stock', async () => {
  const db=store([makeProduct({colors:[makeColor('crudo',[0,1,0,0])],stock:1})]),inventory=db.load('lib/inventory.ts')
  const ids=[1,2].map(()=>db.addOrder([{productId:'p',productColorId:'crudo',colorName:'Crudo',size:'M',quantity:1}]))
  const results=await Promise.allSettled(ids.map(inventory.applyInventoryForOrder));assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(db.state.products[0].stock,0);assert.equal(db.state.orders.filter(o=>o.inventoryDiscounted).length,1)
})
for(const sized of [true,false])test('legacy discount/restore keeps old stock source: sized='+sized,async()=>{
  const db=store([legacy({sizes:sized?legacy().sizes:[]})]),inventory=db.load('lib/inventory.ts'),id=db.addOrder([{productId:'p',productColorId:null,size:sized?'M':null,quantity:2}])
  await inventory.applyInventoryForOrder(id);assert.equal(db.state.products[0].stock,2)
  await inventory.restoreInventoryForOrder(id);assert.equal(db.state.products[0].stock,4)
})
const input = colors => ({name:'Drop',price:450,categoryId:'cat',status:'ACTIVE',stock:0,images:[],sizes:[],homeHeroImageUrl:'https://test/promotion.jpg',colors:colors.map(c=>({...c,images:c.images.map(i=>i.url.replace(/^\//,'https://test/'))}))})
test('ADMIN creates two colors and edits used IDs without replacing stock rows/history', async () => {
  const db=store([]),create=db.load('app/api/admin/products/route.ts'),edit=db.load('app/api/admin/products/[id]/route.ts')
  const request=body=>new Request('https://mbe.test',{method:'POST',body:JSON.stringify(body)})
  const body=input([makeColor('crudo'),makeColor('negro')]);body.colors.forEach(c=>delete c.id)
  let response=await create.POST(request(body));assert.equal(response.status,201);let product=await response.json();assert.equal(product.colors.length,2);assert.equal(product.stock,14)
  const colorId=product.colors[0].id,sizeId=product.colors[0].sizeStocks[1].id
  db.addOrder([{productId:product.id,productColorId:colorId,colorName:'Crudo',size:'M',quantity:1}])
  const updated=input(product.colors);updated.colors[0].name='Arena';updated.colors[0].active=false
  response=await edit.PUT(request(updated),{params:Promise.resolve({id:product.id})});assert.equal(response.status,200);product=await response.json()
  assert.equal(product.colors[0].id,colorId);assert.equal(product.colors[0].sizeStocks[1].id,sizeId);assert.equal(db.state.orders[0].items[0].colorName,'Crudo')
  assert.equal((await edit.DELETE(request({}),{params:Promise.resolve({id:product.id})})).status,409)
})
test('omitting existing color deactivates it and preserves its stock ID for restoration', async () => {
  const db=store(),{saveProductColors}=db.load('lib/admin/product-input.ts'),{productTransaction}=db.load('lib/product-transactions.ts')
  const original=db.state.products[0].colors[1].sizeStocks[1].id
  await productTransaction(tx=>saveProductColors(tx,'p',[{...makeColor('crudo'),images:['https://test/crudo.jpg']}]))
  assert.equal(db.state.products[0].colors[1].active,false);assert.equal(db.state.products[0].colors[1].sizeStocks[1].id,original)
})
for(const [label,change]of [['invalid hex',c=>{c.swatchHex='red'}],['fractional stock',c=>{c.sizeStocks[0].stock=0.5}],['negative stock',c=>{c.sizeStocks[0].stock=-1}],['duplicate sizes',c=>{c.sizeStocks[1].size='S'}],['too many images',c=>{c.images=Array(4).fill('https://test/img.jpg')}]])test('ADMIN validates '+label,()=>{
  const body=input([makeColor('crudo')]);change(body.colors[0]);assert.throws(()=>loader()('lib/admin/product-input.ts').parseProductInput(body))
})
for(const[file,method]of [['app/api/admin/products/route.ts','POST'],['app/api/admin/products/[id]/route.ts','PUT'],['app/api/admin/products/[id]/route.ts','DELETE']])test(method+' product endpoint requires ADMIN before writes',async()=>{
  const route=loader({'@/lib/auth':{getCurrentUser:async()=>({role:'CLIENTE'})},'@/lib/prisma':{prisma:{}},'next/server':{NextResponse:{json:Response.json}}})(file)
  assert.equal((await route[method](new Request('https://mbe.test'),{params:Promise.resolve({id:'p'})})).status,401)
})
test('migration backfills non-null identities and preserves legacy rows, history FKs and prior migrations',()=>{
  const sql=fs.readFileSync('prisma/migrations/20261008000000_product_color_variants/migration.sql','utf8')
  assert.ok(sql.includes('BEGIN;'));assert.ok(sql.includes('RAISE EXCEPTION'));assert.ok(sql.includes("'legacy:' || COALESCE"));assert.ok(sql.includes('ALTER COLUMN "variantKey" SET NOT NULL'))
  assert.ok(sql.includes('"cartId", "productId", "variantKey"'));assert.ok(sql.includes('ON DELETE RESTRICT'));assert.ok(!/DELETE FROM|DROP TABLE|TRUNCATE/.test(sql))
  const schema=fs.readFileSync('prisma/schema.prisma','utf8');assert.ok(schema.includes('@@unique([cartId, productId, variantKey])'));assert.ok(schema.includes('homeHeroImageUrl String?'))
})

function checkoutFixture(db, changes = {}) {
  const stripeCalls=[]
  const paymentIntent={id:'pi_test',client_secret:'secret_test'}
  const prisma={...Object.fromEntries(['product','order','payment','cartItem'].map(key=>[key,db.prisma[key]])),
    $transaction:db.prisma.$transaction,
    cart:{findUnique:async()=>({id:'cart',items:changes.items||['crudo','negro'].map(productColorId=>({id:productColorId,productColorId,size:'M',quantity:1,product:db.state.products[0]}))})},
    payment:{update:args=>db.prisma.payment.update(args),findFirst:async()=>changes.existingPayment||null},
  }
  const shipping={rateId:'mbe-local-benito-juarez-free',carrier:'mbe-local',carrierDisplayName:'Entrega local MBE',serviceName:'Entrega local',total:0}
  const load=loader({'@/lib/prisma':{prisma},'@/lib/auth':{getCurrentUser:async()=>({id:'user',role:'CLIENTE'})},'next/server':{NextResponse:{json:Response.json}},
    '@/lib/stripe':{stripe:{paymentIntents:{create:async data=>{stripeCalls.push(data);return paymentIntent},update:async(_id,data)=>{stripeCalls.push(data);return paymentIntent}}}},
    '@/lib/shipping/checkout-shipping':{resolveCheckoutShipping:async()=>({option:shipping,quotationId:'local'}),CheckoutShippingError:class extends Error{}},
  })
  const route=load('app/api/stripe/create-payment-intent/route.ts')
  const request=()=>new Request('https://mbe.test',{method:'POST',body:JSON.stringify({recipient:'Cliente',phone:'9981234567',email:'test@example.com',cardholderName:'Cliente',postalCode:'77500',state:'Quintana Roo',city:'Cancún',colony:'Centro',street:'Calle',selectedShippingOption:shipping,paymentIntentId:changes.existingPayment?'pi_test':undefined,colorName:'FORGED',unitPrice:1,stock:999})})
  return{route,request,stripeCalls,load}
}
test('checkout creates separate immutable color snapshots at database price, ignoring browser colorName/price/stock',async()=>{
  const db=store(),checkout=checkoutFixture(db)
  const response=await checkout.route.POST(checkout.request());assert.equal(response.status,200)
  const order=db.state.orders[0];assert.deepEqual(order.items.map(i=>[i.productColorId,i.colorName,i.size,i.unitPrice]),[['crudo','Crudo','M',450],['negro','Negro','M',450]])
  assert.equal(order.subtotal,900);assert.deepEqual(checkout.stripeCalls[0].payment_method_types,['card'])
  db.state.products[0].colors[0].name='Arena';assert.equal(order.items[0].colorName,'Crudo')
  const inventory=db.load('lib/inventory.ts');await inventory.applyInventoryForOrder(order.id)
  assert.equal(db.state.products[0].colors[0].sizeStocks[1].stock,3);assert.equal(db.state.products[0].colors[1].sizeStocks[1].stock,1)
  await inventory.restoreInventoryForOrder(order.id);assert.equal(db.state.products[0].stock,14)
})
test('legacy checkout creates nullable color snapshots and keeps product price/selected size',async()=>{
  const db=store([legacy()]),checkout=checkoutFixture(db,{items:[{id:'legacy',quantity:1,size:'M',productColorId:null,product:db.state.products[0]}]})
  assert.equal((await checkout.route.POST(checkout.request())).status,200)
  assert.equal(db.state.orders[0].items[0].colorName,null);assert.equal(db.state.orders[0].items[0].productColorId,null)
})
test('reused pending checkout refreshes OrderItems to current color selection with a paid-order guard',async()=>{
  const db=store(),id=db.addOrder([{productId:'p',size:'M',productColorId:'crudo',colorName:'Crudo',quantity:1,unitPrice:450}])
  db.state.orders[0].status='PENDING'
  const checkout=checkoutFixture(db,{existingPayment:{id:'payment',order:{id,status:'PENDING'}},items:[{id:'negro',quantity:1,size:'M',productColorId:'negro',product:db.state.products[0]}]})
  db.state.payments.push({id:'payment'})
  assert.equal((await checkout.route.POST(checkout.request())).status,200)
  const create=db.state.orders[0].items.create;assert.equal(create.length,1);assert.equal(create[0].productColorId,'negro');assert.equal(create[0].colorName,'Negro')
})
test('checkout rejects foreign/inactive color and zero stock before contacting Stripe',async()=>{
  for(const productColorId of ['foreign','crudo']){
    const db=store([makeProduct({colors:[makeColor('crudo',[0,0,0,0])]})]),checkout=checkoutFixture(db,{items:[{quantity:1,size:'M',productColorId,product:db.state.products[0]}]})
    assert.equal((await checkout.route.POST(checkout.request())).status,400);assert.equal(checkout.stripeCalls.length,0);assert.equal(db.state.orders.length,0)
  }
})
test('Stripe snapshot transport chunks long color snapshots within 500 characters and reads old metadata',()=>{
  const helper=loader()('lib/checkout-variants.ts'),items=Array.from({length:8},(_,index)=>({productId:'p',productColorId:'c'+index,colorName:'Color '.repeat(10),quantity:1,unitPrice:450,size:'M'}))
  const metadata=helper.cartSnapshotMetadata(items);assert.ok(Object.values(metadata).every(value=>value.length<=500))
  assert.deepEqual(JSON.parse(helper.readCartSnapshotMetadata(metadata)),items)
  assert.equal(helper.readCartSnapshotMetadata({cartSnapshot:'[{"productId":"legacy"}]'}),'[{"productId":"legacy"}]')
  delete metadata.cartSnapshot1;assert.equal(helper.readCartSnapshotMetadata(metadata),undefined)
})
test('signed Stripe fallback persists selected IDs and historical names from chunked snapshot',async()=>{
  const db=store(),helper=loader()('lib/checkout-variants.ts'),items=[{productId:'p',productColorId:'crudo',colorName:'Crudo',quantity:1,unitPrice:450,size:'M'},{productId:'p',productColorId:'negro',colorName:'Negro',quantity:1,unitPrice:450,size:'M'}]
  const metadata={userId:'user',subtotal:'900',shippingCost:'0',total:'900',shippingQuoteJson:JSON.stringify({carrier:'mbe-local',rateId:'mbe-local-benito-juarez-free'}),...helper.cartSnapshotMetadata(items)}
  const intent={id:'pi_fallback',metadata,receipt_email:'test@example.com',payment_method:'pm_test'}
  const original=process.env.STRIPE_WEBHOOK_SECRET;process.env.STRIPE_WEBHOOK_SECRET='test'
  const load=loader({'@/lib/prisma':{prisma:db.prisma},'@/lib/stripe':{stripe:{webhooks:{constructEvent:()=>({type:'payment_intent.succeeded',data:{object:intent}})}}},'next/headers':{headers:()=>new Map([['stripe-signature','test']])},'next/server':{NextResponse:{json:Response.json}},'@/lib/inventory':db.load('lib/inventory.ts'),'@/lib/order-status-notifications':{sendOrderStatusNotifications:async()=>{}},'@/lib/skydropx':{}})
  try{
    const response=await load('app/api/webhooks/stripe/route.ts').POST(new Request('https://mbe.test',{method:'POST',body:'signed'}));assert.equal(response.status,200)
    assert.deepEqual(db.state.orders[0].items.map(i=>[i.productColorId,i.colorName]),[['crudo','Crudo'],['negro','Negro']]);assert.equal(db.state.products[0].stock,12)
  }finally{if(original===undefined)delete process.env.STRIPE_WEBHOOK_SECRET;else process.env.STRIPE_WEBHOOK_SECRET=original}
})
test('cart sheet renders both color names, correct thumbnails and carries color on update/remove',async()=>{
  const calls=[],items=makeProduct().colors.map(color=>({id:color.id,quantity:1,size:'M',productColorId:color.id,productColor:color,product:makeProduct()}))
  const ui=uiHarness('components/store/cart-sheet.tsx','CartSheet',{open:true,onClose(){}},{'@/contexts/auth-context':{useAuth:()=>({user:{id:'user'}})},'@/contexts/cart-context':{useCart:()=>({items,totalPrice:900,updateQuantity:(...args)=>calls.push(args),removeFromCart:(...args)=>calls.push(args)})}})
  const html=ui.html();assert.ok(html.includes('Color: Crudo'));assert.ok(html.includes('Color: Negro'));assert.ok(html.includes('/crudo-1.jpg'));assert.ok(html.includes('/negro-1.jpg'))
  ui.elements().filter(e=>e.props['aria-label']==='Aumentar cantidad')[1].props.onClick();assert.deepEqual(calls[0],['p',2,'M','negro'])
  ui.elements().filter(e=>e.props['aria-label']==='Eliminar del carrito')[0].props.onClick();assert.deepEqual(calls[1],['p','M','crudo'])
})
test('Admin fulfillment and Mis pedidos display snapshot name after color rename',async()=>{
  const product=makeProduct(),order={id:'order',status:'PAID',total:450,createdAt:new Date(),user:{username:'Cliente'},payment:{provider:'stripe',status:'COMPLETED'},items:[{id:'item',quantity:1,unitPrice:450,size:'M',productColorId:'crudo',colorName:'Crudo',product,productColor:{...product.colors[0],name:'Arena'}}]}
  const ui=uiHarness('components/admin/orders-premium-manager.tsx','OrdersPremiumManager',{orders:[order]})
  const expand=ui.elements().find(e=>e.type==='button'&&e.props.onClick&&e.props.children?.props?.children?.some?.(c=>typeof c==='string'&&c.includes('Detalle')))
  assert.ok(expand);expand.props.onClick();ui.render();assert.ok(ui.html().includes('Color: Crudo'));assert.ok(!ui.html().includes('Color: Arena'))
  const deps={'@/lib/auth':{getCurrentUser:async()=>({id:'user'})},'@/lib/prisma':{prisma:{order:{findFirst:async()=>order,findMany:async()=>[order]}}},'next/image':Image,'next/link':Link,'next/navigation':{notFound(){throw Error('notFound')},redirect(){throw Error('redirect')}},'@/components/store/header':{Header:()=>null},'@/components/store/footer':{Footer:()=>null}}
  const load=loader(deps)
  const detail=renderToStaticMarkup(await load('app/mis-pedidos/[id]/page.tsx').default({params:Promise.resolve({id:'order'})}));assert.ok(detail.includes('Color: Crudo'));assert.ok(detail.includes('/crudo-1.jpg'));assert.ok(!detail.includes('Color: Arena'))
  const history=renderToStaticMarkup(await load('app/mis-pedidos/page.tsx').default());assert.ok(history.includes('Color: Crudo'))
})
test('ADMIN color/Home uploads call existing public uploader once per file and reject invalid size/type',async()=>{
  let colors=[{...makeColor('crudo'),clientId:'crudo',images:[]},{...makeColor('negro'),clientId:'negro',images:[]}],home='',uploads=0,error=''
  const props={colors,onChange:next=>{colors=next;props.colors=next},homeImage:home,onHomeChange:url=>{home=url;props.homeImage=url},busy:false,onBusy(){},onError:value=>{error=value},uploadFile:async file=>{uploads++;return'https://test/'+file.name}}
  const ui=uiHarness('components/admin/product-variant-fields.tsx','ProductVariantFields',props)
  const fileInputs=()=>ui.elements().filter(e=>e.type==='input'&&e.props.type==='file')
  const event=files=>({currentTarget:{files,value:'selected'}})
  await fileInputs()[0].props.onChange(event([{name:'crudo1.jpg',type:'image/jpeg',size:100},{name:'crudo2.jpg',type:'image/jpeg',size:100}]))
  ui.render();await fileInputs()[1].props.onChange(event([{name:'negro1.webp',type:'image/webp',size:100}]))
  ui.render();await fileInputs()[2].props.onChange(event([{name:'home.png',type:'image/png',size:100}]))
  assert.equal(uploads,4);assert.equal(colors[0].images.length,2);assert.equal(colors[1].images.length,1);assert.equal(home,'https://test/home.png')
  ui.render();await fileInputs()[2].props.onChange(event([{name:'large.jpg',type:'image/jpeg',size:11*1024*1024}]))
  assert.equal(uploads,4);assert.ok(error.includes('10 MB'))
  await fileInputs()[2].props.onChange(event([{name:'bad.txt',type:'text/plain',size:100}]))
  assert.equal(uploads,4);assert.ok(error.includes('JPG'))
  ui.render();ui.find(e=>e.type==='button'&&e.props.children==='Quitar imagen Home').props.onClick();assert.equal(home,'')
})

test('introducing colors preserves legacy image/size IDs and historical sized restoration',async()=>{
  const db=store([legacy({images:[{id:'legacy',url:'/uploads/legacy.jpg'}]})]),route=db.load('app/api/admin/products/[id]/route.ts'),body=input([makeColor('crudo'),makeColor('negro')])
  body.colors.forEach(color=>delete color.id);body.images=['/uploads/legacy.jpg']
  const orderId=db.addOrder([{productId:'p',productColorId:null,colorName:null,size:'M',quantity:1}])
  const response=await route.PUT(new Request('https://mbe.test',{method:'PUT',body:JSON.stringify(body)}),{params:Promise.resolve({id:'p'})})
  assert.equal(response.status,200);assert.equal(db.state.products[0].images[0].id,'legacy');assert.equal(db.state.products[0].sizes[0].id,'sizeM');assert.equal(db.state.products[0].sizes[0].stock,4)
  const inventory=db.load('lib/inventory.ts');await inventory.applyInventoryForOrder(orderId);assert.equal(db.state.products[0].sizes[0].stock,3);assert.equal(db.state.products[0].stock,14)
  await inventory.restoreInventoryForOrder(orderId);assert.equal(db.state.products[0].sizes[0].stock,4);assert.equal(db.state.products[0].stock,14)
})
test('ADMIN rejects stale edit rather than overwriting a sale completed while the form was open',async()=>{
  const db=store([makeProduct({updatedAt:new Date('2026-10-08T12:01:00Z')})]),route=db.load('app/api/admin/products/[id]/route.ts'),body=input(makeProduct().colors)
  body.expectedUpdatedAt='2026-10-08T12:00:00Z'
  const response=await route.PUT(new Request('https://mbe.test',{method:'PUT',body:JSON.stringify(body)}),{params:Promise.resolve({id:'p'})})
  assert.equal(response.status,409);assert.equal(db.state.products[0].stock,14);assert.equal(db.state.products[0].colors[0].sizeStocks[1].stock,4)
})
test('products with historical unsized orders remain legacy to preserve their only inventory source',async()=>{
  const db=store([legacy({sizes:[]})]),route=db.load('app/api/admin/products/[id]/route.ts'),body=input([makeColor('crudo')]);delete body.colors[0].id;body.images=['/uploads/legacy.jpg']
  db.addOrder([{productId:'p',productColorId:null,size:null,quantity:1}])
  const response=await route.PUT(new Request('https://mbe.test',{method:'PUT',body:JSON.stringify(body)}),{params:Promise.resolve({id:'p'})})
  assert.equal(response.status,409);assert.equal(db.state.products[0].colors.length,0);assert.equal(db.state.products[0].stock,4)
})
test('public uploader signs the same product path with MIME and actual 10 MB Blob limit',async()=>{
  let captured
  const load=loader({'@/lib/auth':{isAdmin:async()=>true},'@vercel/blob/client':{handleUpload:async options=>{captured=options;return{ok:true}}},'next/server':{NextResponse:{json:Response.json}}})
  const response=await load('app/api/upload/route.ts').POST(new Request('https://mbe.test',{method:'POST',body:'{}'}));assert.equal(response.status,200)
  const signed=await captured.onBeforeGenerateToken('products/color.jpg',JSON.stringify({mimeType:'image/jpeg',size:100}))
  assert.equal(signed.maximumSizeInBytes,10*1024*1024);assert.equal(signed.pathname,'products/color.jpg');assert.deepEqual(signed.allowedContentTypes,['image/jpeg','image/png','image/webp','image/gif'])
  await assert.rejects(()=>captured.onBeforeGenerateToken('products/color.jpg',JSON.stringify({mimeType:'image/jpeg',size:11*1024*1024})))
  await assert.rejects(()=>captured.onBeforeGenerateToken('products/color.jpg',JSON.stringify({mimeType:'application/pdf',size:100})))
  assert.equal(captured.token,undefined);assert.ok(!fs.readFileSync('app/api/upload/route.ts','utf8').includes('COMMUNITY'))
})
test('Home/card fallback retains an existing color image even when all colors are deactivated',()=>{
  const product=makeProduct({colors:[makeColor('crudo',undefined,{active:false}),makeColor('negro',undefined,{active:false})]})
  assert.equal(variants.homeHeroImage(product),'/crudo-1.jpg');assert.equal(variants.productImage(product),'/crudo-1.jpg');assert.equal(variants.productStock(product),0)
})
