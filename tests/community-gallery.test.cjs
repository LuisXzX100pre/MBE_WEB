const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
function loader(deps = {}) {
  const cache = new Map()
  function load(file) {
    file = path.resolve(file)
    if (cache.has(file)) return cache.get(file).exports
    const mod = { exports: {} }; cache.set(file, mod)
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    new Function('require', 'exports', js)(name => {
      if (name in deps) return deps[name]
      if (name === 'server-only') return {}
      const base = name.startsWith('@/') ? path.resolve(name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null
      const local = base && [base + '.ts', base + '.tsx'].find(fs.existsSync)
      return local ? load(local) : require(name)
    }, mod.exports)
    return mod.exports
  }
  return load
}
const url = name => `https://mbestore.private.blob.vercel-storage.com/community/${name}.jpg`
const a = url('a'), b = url('b'), c = url('c')
const postInput = mediaUrls => ({ title: 'MBE', description: 'Historia', mediaType: 'IMAGE', mediaUrl: a, mediaUrls, published: true })
const publicPost = media => ({ id: 'p', title: 'MBE', description: 'Historia', mediaType: 'IMAGE', thumbnailUrl: null, createdAt: '2026-10-01T00:00:00Z', comments: [], ...(media === undefined ? {} : { media }) })
function store(initialMedia = [], options = {}) {
  const calls = [], rows = new Map([['p', { id: 'p', title: 'MBE', description: 'Historia', mediaType: 'IMAGE', mediaUrl: a, thumbnailUrl: null, published: true, createdAt: new Date('2026-10-01'), comments: [], media: structuredClone(initialMedia) }]])
  let nextId = 0
  const post = {
    findUnique: async ({ where }) => structuredClone(rows.get(where.id) || null),
    findFirst: async args => {
      calls.push(['shared', args])
      const urls = args.where.OR[0].mediaUrl.in
      return [...rows.values()].find(p => p.id !== args.where.id.not && [p.mediaUrl, p.thumbnailUrl, ...p.media.map(m => m.url)].some(u => urls.includes(u))) || null
    },
    findMany: async args => {
      calls.push(['query', args])
      return [...rows.values()].map(p => ({ ...publicPost(p.media.slice().sort((x,y) => x.order-y.order || x.id.localeCompare(y.id)).map(({id,order}) => ({id,order}))), createdAt: p.createdAt }))
    },
    create: async ({ data }) => { calls.push(['create', data]); return data },
    update: async ({ where, data }) => {
      calls.push(['update', data])
      const current = rows.get(where.id), { media, ...fields } = data
      const images = current.media.filter(m => media.deleteMany.url.notIn.includes(m.url))
      for (const update of media.update) Object.assign(images.find(m => m.id === update.where.id), update.data)
      images.push(...media.create.map(m => ({ ...m, id: 'new-' + (++nextId) })))
      Object.assign(current, fields, { media: images.sort((x,y) => x.order-y.order || x.id.localeCompare(y.id)) })
      return structuredClone(current)
    },
    delete: async ({ where }) => { calls.push(['delete']); rows.delete(where.id); return {} },
  }
  const prisma = { communityPost: post, $transaction: async (work, config) => {
    assert.equal(config.isolationLevel, 'Serializable')
    const before = structuredClone(rows)
    try { return await work({ communityPost: post }) }
    catch (error) { rows.clear(); for (const [id,row] of before) rows.set(id,row); throw error }
  } }
  const load = loader({
    '@/lib/prisma': { prisma },
    '@vercel/blob': {
      head: async u => { calls.push(['head', u]); return { contentType: u.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg', size: 100 } },
      del: async (urls, opts) => { calls.push(['blob', urls, opts]); if (options.failBlob) throw new Error('Blob unavailable') },
    },
    '@vercel/oidc': { getVercelOidcToken: async () => 'oidc-test' },
    '@/lib/community/api': { member: async (_request, admin) => { assert.equal(admin, true); return { id: 'admin', role: 'ADMIN' } }, api: async work => { try { return Response.json(await work()) } catch (e) { return Response.json({error:e.message}, {status:e.status || 500}) } } },
  })
  return { rows, calls, load, posts: load('lib/community/posts.ts') }
}
function withStore(work) { return async () => { const old = process.env.BLOB_STORE_ID; process.env.BLOB_STORE_ID = 'store_mbestore'; try { await work() } finally { if (old === undefined) delete process.env.BLOB_STORE_ID; else process.env.BLOB_STORE_ID = old } } }
test('creation retains first legacy URL and creates ALL gallery rows in selected order', withStore(async () => {
  const db = store(), route = db.load('app/api/admin/community/posts/route.ts')
  const response = await route.POST(new Request('https://mbe.test', { method:'POST', body:JSON.stringify(postInput([a,b,c])) }))
  assert.equal(response.status, 200)
  const data = db.calls.find(call => call[0] === 'create')[1]
  assert.equal(data.mediaUrl, a)
  assert.deepEqual(data.media.create, [{url:a,order:0},{url:b,order:1},{url:c,order:2}])
  assert.deepEqual(db.calls.filter(call => call[0] === 'head').map(call => call[1]), [a,b,c])
}))
test('IMAGE accepts 1..5 images, rejects zero/six/duplicates and a video in gallery', withStore(async () => {
  const db = store()
  for (const count of [1,5]) { const values = Array.from({length:count},(_,i) => url('image-'+i)); assert.equal((await db.posts.postData(postInput(values))).media.create.length, count) }
  for (const values of [[], Array.from({length:6},(_,i) => url(String(i))), [a,a], ['https://mbestore.private.blob.vercel-storage.com/community/v.mp4']]) await assert.rejects(() => db.posts.postData(postInput(values)), e => e.status === 400)
}))
test('legacy input is compatible; video remains single with optional thumbnail and refuses mixed gallery', withStore(async () => {
  const db = store(), input = postInput(undefined)
  assert.deepEqual((await db.posts.postData(input)).media.create, [{url:a,order:0}])
  const video = { ...input, mediaType:'VIDEO', mediaUrl:'https://mbestore.private.blob.vercel-storage.com/community/v.mp4', thumbnailUrl:a, mediaUrls:[] }
  const data = await db.posts.postData(video)
  assert.equal(data.mediaUrl, video.mediaUrl); assert.equal(data.thumbnailUrl, a); assert.equal(data.media, undefined)
  await assert.rejects(() => db.posts.postData({...video,mediaUrls:[b]}), e => e.status === 400)
}))
test('public recent/archive selects ordered IDs only, never private gallery URLs', async () => {
  const db = store([{id:'z',url:c,order:2},{id:'b',url:b,order:0},{id:'a',url:a,order:0}])
  const result = await db.posts.publishedRecentPosts()
  assert.deepEqual(result[0].media, [{id:'a',order:0},{id:'b',order:0},{id:'z',order:2}])
  const select = db.calls.find(call => call[0] === 'query')[1].select.media
  assert.deepEqual(select, {select:{id:true,order:true},orderBy:[{order:'asc'},{id:'asc'}]})
  assert.ok(!JSON.stringify(result).includes('blob.vercel-storage.com'))
})
test('editing preserves existing image IDs, appends ordered media and updates the first image', withStore(async () => {
  const db = store([{id:'a',url:a,order:0},{id:'b',url:b,order:1}])
  const result = await db.posts.updatePost('p', postInput([b,c]))
  assert.equal(result.mediaUrl, b); assert.equal(result.media[0].id, 'b')
  assert.deepEqual(result.media.map(({url,order}) => ({url,order})), [{url:b,order:0},{url:c,order:1}])
  assert.deepEqual(db.calls.find(call => call[0] === 'blob').slice(1), [[a], {storeId:'mbestore',oidcToken:'oidc-test'}])
}))
test('removing another image deletes only its Blob; zero images cannot change stored post', withStore(async () => {
  const db = store([{id:'a',url:a,order:0},{id:'b',url:b,order:1},{id:'c',url:c,order:2}])
  await db.posts.updatePost('p', postInput([a,c]))
  assert.deepEqual(db.calls.find(call => call[0] === 'blob')[1], [b])
  await assert.rejects(() => db.posts.updatePost('p', postInput([])), e => e.status === 400)
  assert.equal(db.rows.get('p').mediaUrl, a); assert.equal(db.rows.get('p').media.length, 2)
}))
test('legacy edit keeps existing gallery when old client supplies only its unchanged mediaUrl', withStore(async () => {
  const db = store([{id:'a',url:a,order:0},{id:'b',url:b,order:1}])
  const result = await db.posts.updatePost('p', {...postInput(undefined),title:'Nuevo titulo'})
  assert.deepEqual(result.media.map(m => m.url), [a,b]); assert.equal(db.calls.some(call => call[0] === 'blob'), false)
}))
test('failed Blob deletion rolls back edit; shared gallery references prevent deletion', withStore(async () => {
  const images = [{id:'a',url:a,order:0},{id:'b',url:b,order:1}], db = store(images,{failBlob:true})
  await assert.rejects(() => db.posts.updatePost('p',postInput([b])), e => e.status === 502)
  assert.equal(db.rows.get('p').mediaUrl, a); assert.deepEqual(db.rows.get('p').media, images)
  const shared = store(images); shared.rows.set('other', {...shared.rows.get('p'),id:'other',mediaUrl:c,media:[{id:'other-a',url:a,order:0}]})
  await assert.rejects(() => shared.posts.updatePost('p',postInput([b])), e => e.status === 409)
  assert.equal(shared.calls.some(call => call[0] === 'blob'), false)
}))
test('DELETE includes gallery, legacy primary and thumbnail once each before cascading row deletion', withStore(async () => {
  const db = store([{id:'a',url:a,order:0},{id:'b',url:b,order:1},{id:'c',url:c,order:2}]); db.rows.get('p').thumbnailUrl = b
  const route = db.load('app/api/admin/community/posts/[id]/route.ts')
  assert.equal((await route.DELETE(new Request('https://mbe.test',{method:'DELETE'}),{params:{id:'p'}})).status, 200)
  assert.deepEqual(db.calls.find(call => call[0] === 'blob')[1].sort(), [a,b,c].sort())
  assert.equal(db.rows.has('p'), false)
  assert.ok(db.calls.findIndex(call => call[0] === 'blob') < db.calls.findIndex(call => call[0] === 'delete'))
}))
test('unsafe gallery URL prevents ALL Blob deletion and retains the post', withStore(async () => {
  const db = store([{id:'bad',url:'https://evil.test/community/image.jpg',order:0}])
  const response = await db.load('app/api/admin/community/posts/[id]/route.ts').DELETE(new Request('https://mbe.test',{method:'DELETE'}),{params:{id:'p'}})
  assert.equal(response.status, 400); assert.equal(db.rows.has('p'), true); assert.equal(db.calls.some(call => call[0] === 'blob'), false)
}))
test('migration is additive only and legacy fields remain; no data backfill is needed', () => {
  const {Prisma} = require('@prisma/client'), model = Prisma.dmmf.datamodel.models.find(m => m.name === 'CommunityPost')
  for (const name of ['mediaUrl','mediaType','thumbnailUrl','media']) assert.ok(model.fields.some(f => f.name === name))
  const sql = fs.readFileSync('prisma/migrations/20261010120000_community_post_media/migration.sql','utf8')
  assert.match(sql,/CREATE TABLE "CommunityPostMedia"/); assert.match(sql,/ON DELETE CASCADE/)
  assert.ok(!/\b(DROP|TRUNCATE|DELETE FROM|UPDATE "CommunityPost"|INSERT INTO)\b/i.test(sql))
})
function privateRoute() {
  let user = {id:'member',role:'CLIENTE'}, membership = true, published = true
  const reads = [], queries = []
  const load = loader({
    '@/lib/auth': {getCurrentUser:async () => user},
    '@/lib/prisma': {prisma:{communityMembership:{findUnique:async () => membership ? {id:'membership'} : null},communityPost:{findFirst:async args => {
      queries.push(args)
      if (args.where.id !== 'p' || (args.where.published && !published)) return null
      const mediaId = args.where.media?.some.id
      if (mediaId && !['a','b','c'].includes(mediaId)) return null
      return {mediaUrl:a,thumbnailUrl:b,media:mediaId ? [{url:url(mediaId)}] : []}
    }}}},
    '@vercel/oidc':{getVercelOidcToken:async () => 'oidc-test'},
    '@vercel/blob':{get:async (u,options) => {reads.push({url:u,options});return {stream:new Blob(['image']).stream(),blob:{contentType:'image/jpeg'},headers:new Headers()}}},
  })
  const route = load('app/api/community/media/[id]/route.ts')
  return {reads,queries,setUser:value => {user=value},setMembership:value => {membership=value},setPublished:value => {published=value},get:query => route.GET(new Request('https://mbe.test/api/community/media/p'+query),{params:{id:'p'}})}
}
test('private media keeps legacy URL and resolves the requested gallery ID belonging to that post', withStore(async () => {
  const route = privateRoute()
  assert.equal((await route.get('')).status, 200); assert.equal(route.reads[0].url,a)
  assert.equal((await route.get('?mediaId=c')).status, 200); assert.equal(route.reads[1].url,c)
  assert.deepEqual(route.reads[1].options,{access:'private',storeId:'mbestore',oidcToken:'oidc-test'})
  assert.equal((await route.get('?mediaId=other-post-image')).status,404); assert.equal(route.reads.length,2)
  assert.equal((await route.get('?mediaId=')).status,400)
  assert.equal((await route.get('?mediaId=a&thumbnail=1')).status,400)
  assert.equal((await route.get('?url=https://evil.test/image')).status,200); assert.equal(route.reads.at(-1).url,a)
}))
test('private galleries reject anonymous/non-members and unpublished posts; ADMIN can preview drafts without membership', withStore(async () => {
  const route = privateRoute()
  route.setUser(null); assert.equal((await route.get('?mediaId=a')).status,401)
  route.setUser({id:'visitor',role:'CLIENTE'}); route.setMembership(false); assert.equal((await route.get('?mediaId=a')).status,403)
  assert.equal(route.queries.length,0); assert.equal(route.reads.length,0)
  route.setMembership(true); route.setPublished(false); assert.equal((await route.get('?mediaId=a')).status,404)
  route.setUser({id:'admin',role:'ADMIN'}); route.setMembership(false); assert.equal((await route.get('?mediaId=a')).status,200)
  assert.equal(route.queries.at(-1).where.published,undefined)
}))
function componentHarness(file, props) {
  let slot=0,tree; const slots=[]
  const hooks={useState(initial){const i=slot++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},useRef(initial){const i=slot++;if(!(i in slots))slots[i]={current:initial};return slots[i]}}
  const load=loader({react:hooks,'next/image':({src,alt,className,width,height})=>React.createElement('img',{src,alt,className,width,height}),'./community-comments':{CommunityComments:()=>null},...(file.endsWith('community-feed.tsx')?{'./community-post':{CommunityPost:()=>null}}:{})})
  const module=load(file),Component=module.CommunityPost || module.CommunityFeed
  function render(){slot=0;tree=Component(props);return tree}
  function elements(node=tree){return React.isValidElement(node)?[node,...React.Children.toArray(node.props.children).flatMap(elements)]:[]}
  render();return {render,elements,button:label=>elements().find(e=>e.type==='button'&&e.props['aria-label']===label),gallery:()=>elements().find(e=>'data-community-gallery' in e.props),image:()=>elements().find(e=>e.props.src)?.props.src}
}
const galleryImages=[{id:'a',order:0},{id:'b',order:1},{id:'c',order:2}]
test('legacy and one-image posts use the private endpoint without redundant controls; video stays single', () => {
  for (const media of [undefined,[],[galleryImages[0]]]) {
    const ui=componentHarness('components/community/community-post.tsx',{post:publicPost(media),index:0})
    assert.equal(ui.image(),'/api/community/media/p'+(media?.length?'?mediaId=a':''))
    assert.equal(ui.button('Imagen siguiente'),undefined)
    const html=renderToStaticMarkup(ui.render()); assert.ok(html.includes('object-contain object-center')); assert.ok(html.includes('aspect-[4/5]')); assert.ok(html.includes('max-w-[min(420px,48vh)]')); assert.ok(!html.includes('object-cover'))
  }
  const video=componentHarness('components/community/community-post.tsx',{post:{...publicPost(galleryImages),mediaType:'VIDEO'},index:0})
  assert.equal(video.gallery(),undefined); assert.equal(video.elements().filter(e=>e.type==='video').length,1)
  assert.equal(video.button('Imagen siguiente'),undefined)
})
test('gallery arrows and indicators change images in fixed 4:5 space and wrap', () => {
  const ui=componentHarness('components/community/community-post.tsx',{post:publicPost(galleryImages),index:0})
  assert.equal(ui.image(),'/api/community/media/p?mediaId=a')
  ui.button('Imagen siguiente').props.onClick();ui.render();assert.equal(ui.image(),'/api/community/media/p?mediaId=b')
  ui.button('Imagen anterior').props.onClick();ui.render();ui.button('Imagen anterior').props.onClick();ui.render();assert.equal(ui.image(),'/api/community/media/p?mediaId=c')
  ui.button('Ver imagen 2').props.onClick();ui.render();assert.equal(ui.image(),'/api/community/media/p?mediaId=b')
  assert.equal(ui.gallery().props.style.touchAction,'pan-y pinch-zoom')
  assert.ok(renderToStaticMarkup(ui.render()).includes('2 / 3'))
})
test('horizontal gallery swipe consumes events; vertical/short/control gestures do not change images or recent post', () => {
  const ui=componentHarness('components/community/community-post.tsx',{post:publicPost(galleryImages),index:0})
  const feed=componentHarness('components/community/community-feed.tsx',{initialRecentPosts:[publicPost(),{...publicPost(),id:'q'},{...publicPost(),id:'r'}],initialPosts:[],initialCursor:null})
  function outer(){return feed.elements().find(e=>e.props['aria-label']==='Publicaciones recientes')}
  function active(){return feed.elements().find(e=>e.props['aria-roledescription']==='slide'&&!e.props.hidden).props['aria-label']}
  function gesture(dx,dy,interactive=false){let stopped=0;const event={pointerType:'touch',isPrimary:true,pointerId:1,clientX:100,clientY:100,stopPropagation(){stopped++},target:{closest:selector=>interactive||selector.includes('[data-community-gallery]')?{}:null},currentTarget:{setPointerCapture(){}}}
    ui.gallery().props.onPointerDown(event); if(!stopped)outer().props.onPointerDown(event)
    // Parent's explicit exclusion also protects against a lost stopPropagation.
    outer().props.onPointerDown(event)
    ui.gallery().props.onPointerUp({...event,clientX:100+dx,clientY:100+dy});assert.equal(stopped,2)
    outer().props.onPointerUp({...event,clientX:100+dx,clientY:100+dy});ui.render();feed.render()
  }
  gesture(-80,5);assert.equal(ui.image(),'/api/community/media/p?mediaId=b');assert.equal(active(),'1 de 3')
  gesture(-80,200);gesture(-30,0);gesture(-80,0,true);assert.equal(ui.image(),'/api/community/media/p?mediaId=b');assert.equal(active(),'1 de 3')
  const event={pointerType:'touch',isPrimary:true,pointerId:2,clientX:100,clientY:100,target:{closest:()=>null},currentTarget:{setPointerCapture(){}}}
  outer().props.onPointerDown(event);outer().props.onPointerUp({...event,clientX:20});feed.render();assert.equal(active(),'2 de 3')
})
async function adminHarness(existing = []) {
  let slot=0,tree;const slots=[],effects=[],cleanups=[],uploads=[],requests=[]
  const hooks={useState(initial){const i=slot++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},useRef(initial){const i=slot++;if(!(i in slots))slots[i]={current:initial};return slots[i]},useCallback(fn){return fn},useEffect(fn){if(!tree)effects.push(fn)}}
  const {PostsManager}=loader({react:hooks,'next/image':({src,alt,className})=>React.createElement('img',{src,alt,className}),
    '@vercel/blob/client':{uploadPresigned:async (pathname,file,options)=>{uploads.push({pathname,file,options});return {url:url('upload-'+uploads.length)}}},
    './request':{field:'field',action:'action',communityRequest:async (route,method,payload)=>{requests.push({route,method,payload});return method?{}:existing}},
  })('components/admin/community/posts-manager.tsx')
  function render(){slot=0;tree=PostsManager();return tree}
  function elements(node=tree){return React.isValidElement(node)?[node,...React.Children.toArray(node.props.children).flatMap(elements)]:[]}
  function input(){return elements().find(e=>e.type==='input'&&e.props.type==='file')}
  render();effects.forEach(fn=>{const cleanup=fn();if(cleanup)cleanups.push(cleanup)})
  const settle=async ()=>{await new Promise(resolve=>setImmediate(resolve));render()};await settle()
  return {uploads,requests,render,elements,input,settle,dispose:()=>cleanups.forEach(fn=>fn()),select:async files=>{input().props.onChange({target:{files,value:'selected'}});await settle()}}
}
test('Admin selects multiple images sequentially using private Community uploads, shows count/previews and refuses a sixth', async () => {
  const ui=await adminHarness()
  try {
    assert.equal(ui.input().props.multiple,true)
    const files=['first','second','third'].map(name=>new File(['image'],name+'.jpg',{type:'image/jpeg'}))
    await ui.select(files)
    assert.deepEqual(ui.uploads.map(u=>u.file.name),files.map(f=>f.name))
    for(const upload of ui.uploads){assert.ok(upload.pathname.startsWith('community/'));assert.equal(upload.options.access,'private');assert.equal(upload.options.handleUploadUrl,'/api/admin/community/upload');assert.equal(upload.options.multipart,false)}
    assert.ok(renderToStaticMarkup(ui.render()).includes('3 / 5 imágenes seleccionadas'))
    assert.equal(ui.elements().filter(e=>e.type==='img'||e.props.src).length,3)
    await ui.select(files)
    assert.equal(ui.uploads.length,3);assert.ok(renderToStaticMarkup(ui.render()).includes('Maximo 5'))
    await ui.elements().find(e=>e.type==='form').props.onSubmit({preventDefault(){}})
    const request=ui.requests.find(r=>r.method==='POST')
    assert.deepEqual(request.payload.mediaUrls,[url('upload-1'),url('upload-2'),url('upload-3')]);assert.equal(request.payload.mediaUrl,url('upload-1'))
  } finally {ui.dispose()}
})
test('Admin edits saved gallery, removes first image and saves remaining order; never removes final image', async () => {
  const ui=await adminHarness([{...postInput([a,b]),id:'p',media:[{id:'a',url:a,order:0},{id:'b',url:b,order:1}],thumbnailUrl:null}])
  try {
    ui.elements().find(e=>e.type==='button'&&e.props.children==='Editar / publicar').props.onClick();ui.render()
    assert.ok(ui.elements().some(e=>e.props.src==='/api/community/media/p?mediaId=a'))
    ui.elements().find(e=>e.props['aria-label']==='Eliminar imagen 1').props.onClick();ui.render()
    const last=ui.elements().find(e=>e.props['aria-label']==='Eliminar imagen 1');assert.equal(last.props.disabled,true)
    last.props.onClick();ui.render();assert.ok(renderToStaticMarkup(ui.render()).includes('1 / 5 imágenes seleccionadas'))
    await ui.elements().find(e=>e.type==='form').props.onSubmit({preventDefault(){}})
    const request=ui.requests.find(r=>r.method==='PATCH');assert.equal(request.route,'/api/admin/community/posts/p');assert.equal(request.payload.mediaUrl,b);assert.deepEqual(request.payload.mediaUrls,[b])
  } finally {ui.dispose()}
})
test('Admin preserves 1200x1500 recommendation, rejects mixed/oversized images, and keeps VIDEO single', async () => {
  const ui=await adminHarness()
  try {
    const html=renderToStaticMarkup(ui.render());assert.ok(html.includes('1200 × 1500 px (4:5)'));assert.ok(html.includes('máximo 10 MB por imagen · máximo 5 imágenes'))
    await ui.select([new File(['video'],'v.mp4',{type:'video/mp4'})]);assert.equal(ui.uploads.length,0)
    await ui.select([{name:'too-big.jpg',type:'image/jpeg',size:10*1024*1024+1}]);assert.equal(ui.uploads.length,0)
    ui.elements().find(e=>e.type==='select').props.onChange({target:{value:'VIDEO'}});ui.render()
    assert.equal(ui.input().props.multiple,false);assert.equal(ui.input().props.accept,'video/mp4,video/webm')
    const video=new File(['video'],'v.mp4',{type:'video/mp4'})
    await ui.select([video,video]);assert.equal(ui.uploads.length,0)
    await ui.select([video]);assert.equal(ui.uploads.length,1);assert.equal(ui.uploads[0].options.multipart,true)
    await ui.elements().find(e=>e.type==='form').props.onSubmit({preventDefault(){}})
    const request=ui.requests.find(r=>r.method==='POST');assert.equal(request.payload.mediaType,'VIDEO');assert.deepEqual(request.payload.mediaUrls,[])
  } finally {ui.dispose()}
})
