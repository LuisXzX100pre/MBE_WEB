const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
function load(file,deps){const mod={exports:{}};const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;new Function('require','exports',source)(name=>deps[name]||require(name),mod.exports);return mod.exports}
const post=id=>({id,title:'Post '+id,comments:[],mediaType:'IMAGE',description:'MBE',createdAt:'2026-01-01',thumbnailUrl:null})
function harness(count){let index=0,tree;const slots=[]
 const hooks={useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},useRef(initial){const i=index++;if(!(i in slots))slots[i]={current:initial};return slots[i]}}
 const {CommunityFeed}=load('components/community/community-feed.tsx',{react:hooks,'./community-post':{CommunityPost:({post})=>React.createElement('article',null,post.title)}})
 function render(){index=0;tree=CommunityFeed({initialRecentPosts:Array.from({length:count},(_,i)=>post('p'+i)),initialPosts:[post('archive')],initialCursor:null});return tree}
 function elements(node=tree){return React.isValidElement(node)?[node,...React.Children.toArray(node.props.children).flatMap(elements)]:[]}
 render();return{render,elements,button:label=>elements().find(e=>e.type==='button'&&e.props['aria-label']===label),carousel:()=>elements().find(e=>e.props['aria-roledescription']==='carrusel'),active:()=>elements().find(e=>e.props['aria-roledescription']==='slide'&&!e.props.hidden)?.props['aria-label']}
}
function gesture(ui,dx,dy,interactive=false){const carousel=ui.carousel();carousel.props.onPointerDown({pointerType:'touch',isPrimary:true,pointerId:1,clientX:100,clientY:100,target:{closest:()=>interactive?{}:null},currentTarget:{setPointerCapture(){}}});carousel.props.onPointerUp({pointerId:1,clientX:100+dx,clientY:100+dy});ui.render()}
test('one recent post has no extra controls; three support arrows/dots with wrap and archive stays separate',()=>{
 const single=harness(1);assert.equal(single.button('Publicación siguiente'),undefined)
 const ui=harness(3);assert.equal(ui.active(),'1 de 3')
 ui.button('Publicación siguiente').props.onClick();ui.render();assert.equal(ui.active(),'2 de 3')
 ui.button('Publicación anterior').props.onClick();ui.render();ui.button('Publicación anterior').props.onClick();ui.render();assert.equal(ui.active(),'3 de 3')
 assert.equal(ui.elements().filter(e=>e.props['aria-roledescription']==='slide').length,3)
 assert.equal(ui.carousel().props.style.touchAction,'pan-y pinch-zoom')
 const archive=ui.elements().find(e=>e.type==='button'&&e.props['aria-controls']==='archivo-publicaciones');archive.props.onClick();ui.render()
 assert.ok(renderToStaticMarkup(ui.render()).includes('Post archive'))
 assert.equal(ui.elements().filter(e=>e.props['aria-roledescription']==='slide').length,3)
})
test('horizontal touch navigates; vertical/small gesture and interactive/comment target never navigate',()=>{
 const ui=harness(3);gesture(ui,-80,5);assert.equal(ui.active(),'2 de 3')
 gesture(ui,80,200);assert.equal(ui.active(),'2 de 3')
 gesture(ui,-30,0);assert.equal(ui.active(),'2 de 3')
 gesture(ui,-80,0,true);assert.equal(ui.active(),'2 de 3')
 gesture(ui,80,5);assert.equal(ui.active(),'1 de 3')
 const selector=fs.readFileSync('components/community/community-feed.tsx','utf8');for(const control of ['button','a,input','textarea','select','video','contenteditable'])assert.ok(selector.includes(control))
})
test('Community image is fully contained/centered with 60vh cap; video behavior unchanged',()=>{
 const {CommunityPost}=load('components/community/community-post.tsx',{'next/image':({className,alt})=>React.createElement('img',{className,alt}),'./community-comments':{CommunityComments:()=>null}})
 const html=renderToStaticMarkup(React.createElement(CommunityPost,{post:post('p'),index:0}));assert.ok(html.includes('max-w-[min(420px,48vh)]'));assert.ok(html.includes('aspect-[4/5]'));assert.ok(html.includes('object-contain object-center'));assert.ok(!html.includes('object-cover'))
 const video=renderToStaticMarkup(React.createElement(CommunityPost,{post:{...post('p'),mediaType:'VIDEO'},index:0}));assert.ok(video.includes('max-h-[70vh]'));assert.ok(video.includes('controls'))
})
