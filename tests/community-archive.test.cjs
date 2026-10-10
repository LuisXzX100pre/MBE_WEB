const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
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
const row = n => ({ id: String(n).padStart(4,'0'), createdAt: new Date('2026-10-01T00:00:00Z'), published: true, title: 'Post '+n, description: 'MBE', mediaType: 'IMAGE', thumbnailUrl: null, comments: [{id:'comment-'+n,text:'Comentario',createdAt:new Date(),user:{username:'MBE'}}] })
function matches(post, where) {
  if (where.published !== undefined && post.published !== where.published) return false
  if (where.AND && !where.AND.every(w => matches(post,w))) return false
  if (where.OR && !where.OR.some(w => matches(post,w))) return false
  if (where.createdAt instanceof Date && +post.createdAt !== +where.createdAt) return false
  if (where.createdAt?.lt && !(post.createdAt < where.createdAt.lt)) return false
  if (where.id?.lt && !(post.id < where.id.lt)) return false
  if (where.id?.notIn?.includes(post.id)) return false
  return true
}
function feedStore(count) {
  const rows = Array.from({length:count},(_,i)=>row(i+1)), queries=[]
  const load=loader({'@/lib/prisma':{prisma:{communityPost:{findMany:async args=>{
    queries.push(args)
    return rows.filter(p=>matches(p,args.where)).sort((a,b)=>+b.createdAt-+a.createdAt || b.id.localeCompare(a.id)).slice(0,args.take)
  }}}}})
  return {rows,queries,posts:load('lib/community/posts.ts')}
}
for (const [count,recent,archive] of [[0,0,0],[1,1,0],[2,2,0],[3,3,0],[4,3,1],[10,3,7]]) test(`${count} published -> ${recent} recent / ${archive} archive without duplicates`,async()=>{
  const db=feedStore(count), feed=await db.posts.publishedPosts()
  assert.equal(feed.recentPosts.length,recent);assert.equal(feed.posts.length,archive)
  assert.ok(feed.posts.every(p=>!feed.recentPosts.some(r=>r.id===p.id)))
  assert.equal(feed.nextCursor,null);assert.equal(db.queries[0].take,3)
  if(count) assert.equal(feed.recentPosts[0].comments[0].text,'Comentario')
})
test('archive keyset pages remain stable after inserts and deleting cursor row; current recent is excluded',async()=>{
  const db=feedStore(30),first=await db.posts.publishedPosts()
  assert.equal(first.posts.length,12);assert.ok(first.nextCursor)
  const last=first.posts.at(-1).id
  db.rows.splice(db.rows.findIndex(p=>p.id===last),1)
  db.rows.push(row(31),row(32))
  const second=await db.posts.publishedPosts(first.nextCursor)
  assert.equal(second.posts.length,12)
  assert.ok(second.posts.every(p=>p.id<last))
  assert.ok(second.posts.every(p=>!first.posts.some(r=>r.id===p.id)))
  const third=await db.posts.publishedPosts(second.nextCursor)
  assert.equal(third.posts.length,3);assert.equal(third.nextCursor,null)
  assert.ok(db.queries.every(q=>!('skip' in q)&&!('cursor' in q)))
})
test('deleting a recent post promotes archive next post; unpublished posts excluded',async()=>{
  const db=feedStore(5);db.rows.push({...row(99),published:false})
  db.rows.splice(db.rows.findIndex(p=>p.id==='0005'),1)
  const feed=await db.posts.publishedPosts()
  assert.deepEqual(feed.recentPosts.map(p=>p.id),['0004','0003','0002'])
  assert.deepEqual(feed.posts.map(p=>p.id),['0001'])
})
test('invalid archive cursor fails with controlled error',async()=>{
  await assert.rejects(()=>feedStore(5).posts.publishedPosts('not-json'),e=>e.status===400)
})
const url='https://mbestore.private.blob.vercel-storage.com/community/media.mp4'
const thumbnail=url.replace('media.mp4','thumbnail.jpg')
function deletion({mediaUrl=url,thumbnailUrl=thumbnail,failBlob=false,denied=false,missing=false,oidcMissing=false,shared=false}={}) {
  const calls=[],comments=['comment'];let removed=false
  const load=loader({
    '@vercel/blob':{del:async(urls,options)=>{calls.push(['blob',urls,options]);if(failBlob)throw new Error('service down')}},
    '@vercel/oidc':{getVercelOidcToken:async()=>{if(oidcMissing)throw new Error('missing');return 'oidc-test'}},
    '@/lib/prisma':{prisma:{communityPost:{findFirst:async()=>shared?{id:"other"}:null,findUnique:async args=>{calls.push(['find',args]);return missing?null:{mediaUrl,thumbnailUrl}},delete:async args=>{calls.push(['delete',args]);removed=true;comments.length=0}}}},
    '@/lib/community/api':{member:async(_req,admin)=>{assert.equal(admin,true);if(denied)throw Object.assign(new Error('Forbidden'),{status:403})},api:async work=>{try{return Response.json(await work())}catch(e){return Response.json({error:e.message},{status:e.status||500})}}},
  })
  return {calls,comments,get removed(){return removed},run:()=>load('app/api/admin/community/posts/[id]/route.ts').DELETE(new Request('https://mbe.test',{method:'DELETE',body:JSON.stringify({mediaUrl:'https://evil.test/ignored'})}),{params:{id:'post'}})}
}
test('DELETE fetches DB URLs, deletes private Blob via OIDC before row and existing comments cascade',async()=>{
  process.env.BLOB_STORE_ID='store_mbestore'
  const db=deletion(),res=await db.run();assert.equal(res.status,200)
  assert.deepEqual(db.calls.map(c=>c[0]),['find','blob','delete'])
  assert.deepEqual(db.calls[1][1],[url,thumbnail]);assert.deepEqual(db.calls[1][2],{storeId:'mbestore',oidcToken:'oidc-test'})
  assert.equal(db.removed,true);assert.equal(db.comments.length,0)
  const schema=fs.readFileSync('prisma/schema.prisma','utf8')
  assert.match(schema,/post\s+CommunityPost\s+@relation\(fields: \[postId\], references: \[id\], onDelete: Cascade\)/)
})
for(const thumb of [null,url]) test('DELETE omits absent/duplicate thumbnail: '+thumb,async()=>{
  const db=deletion({thumbnailUrl:thumb});assert.equal((await db.run()).status,200);assert.deepEqual(db.calls[1][1],[url])
})
for(const bad of ['https://evil.test/community/a.jpg','https://mbestore.public.blob.vercel-storage.com/community/a.jpg','https://other.private.blob.vercel-storage.com/community/a.jpg','http://mbestore.private.blob.vercel-storage.com/community/a.jpg','https://mbestore.private.blob.vercel-storage.com/products/a.jpg']) test('DELETE rejects unsafe stored URL '+bad,async()=>{
  const db=deletion({thumbnailUrl:bad});assert.equal((await db.run()).status,400);assert.deepEqual(db.calls.map(c=>c[0]),['find']);assert.equal(db.removed,false)
})
for(const [options,status] of [[{failBlob:true},502],[{oidcMissing:true},503],[{denied:true},403],[{missing:true},404],[{shared:true},409]]) test('DELETE fails safely '+JSON.stringify(options),async()=>{
  const db=deletion(options),res=await db.run();assert.equal(res.status,status);assert.equal(db.removed,false);assert.equal(db.comments.length,1);assert.ok((await res.json()).error)
})

test('recent/archive sections are distinct; opening archive preserves post/comment props',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
  let slot=0;const states=[]
  const load=loader({react:{...React,useRef(initial){const i=slot++;if(!(i in states))states[i]={current:initial};return states[i]},useState(initial){const i=slot++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value}]}},
    './community-post':{CommunityPost:({post})=>React.createElement('article',{'data-post':post.id},post.title+' '+post.comments[0].text)}})
  const {CommunityFeed}=load('components/community/community-feed.tsx')
  const props={initialRecentPosts:[row(4),row(3),row(2)],initialPosts:[row(1)],initialCursor:null}
  function render(){slot=0;return CommunityFeed(props)}
  function elements(node){return React.isValidElement(node)?[node,...React.Children.toArray(node.props.children).flatMap(elements)]:[]}
  let tree=render(),html=renderToStaticMarkup(tree)
  assert.ok(html.includes('id="ultimos"'));assert.ok(html.includes('id="archivo"'))
  assert.ok(html.includes('Lo último en MBE'));assert.ok(html.includes('Archivo MBE'))
  assert.ok(!html.includes('data-post="0001"'))
  const open=elements(tree).find(e=>e.type==='button'&&e.props['aria-controls']==='archivo-publicaciones')
  open.props.onClick();tree=render();html=renderToStaticMarkup(tree)
  assert.ok(html.includes('data-post="0001"'));assert.equal((html.match(/data-post=/g)||[]).length,4)
  assert.ok(html.includes('Comentario'));assert.equal(elements(tree).find(e=>e.type==='button'&&e.props['aria-controls']==='archivo-publicaciones').props['aria-expanded'],true)
})
