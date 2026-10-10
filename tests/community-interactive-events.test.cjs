const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { Prisma } = require('@prisma/client')
function loader(deps = {}) {
  const cache = new Map()
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports
    const mod = { exports: {} }; cache.set(file, mod)
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    new Function('require','exports',js)(name => {
      if (name in deps) return deps[name]; if (name === 'server-only') return {}
      const base = name.startsWith('@/') ? path.resolve(name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file),name) : null
      const local = base && [base+'.ts',base+'.tsx'].find(fs.existsSync)
      return local ? load(local) : require(name)
    },mod.exports);return mod.exports
  } return load
}
const options = [{key:'a',label:'Crudo'},{key:'b',label:'Vaticano'}]
function event(type='ANNOUNCEMENT', fields={}) { const now=Date.now(); return {id:'e',type,title:'MBE',description:'Lo que sigue',active:true,startsAt:new Date(now-60000),endsAt:new Date(now+3600000),interactionPrompt:type==='MISSION'?'Encuentra el codigo':null,options:type==='DECISION'||type==='CHOICE'?structuredClone(options):null,...fields} }
function input(e,fields={}) {return {title:e.title,description:e.description,active:e.active,startsAt:e.startsAt.toISOString(),endsAt:e.endsAt.toISOString(),type:e.type,interactionPrompt:e.interactionPrompt,options:e.options,...fields}}
function store(type='ANNOUNCEMENT', fields={}) {
  const rows=new Map([['e',event(type,fields)]]), interactions=new Map(),calls=[];let next=0,user={id:'u',role:'CLIENTE'},member=true
  const interaction={
    findUnique:async ({where}) => interactions.get(where.eventId_userId.eventId+':'+where.eventId_userId.userId)||null,
    create:async ({data}) => {await Promise.resolve();const key=data.eventId+':'+data.userId;if(interactions.has(key))throw new Prisma.PrismaClientKnownRequestError('Duplicate',{code:'P2002',clientVersion:'5.22.0'});const row={id:'i'+(++next),createdAt:new Date(),...data};interactions.set(key,row);return {id:row.id,optionKey:row.optionKey,response:row.response,createdAt:row.createdAt}},
    groupBy:async ({where}) => {calls.push(['aggregate',where]);const counts=new Map();for(const row of interactions.values())if(row.eventId===where.eventId)counts.set(row.optionKey,(counts.get(row.optionKey)||0)+1);return [...counts].map(([optionKey,count])=>({optionKey,_count:{_all:count}}))},
    findMany:async args => {calls.push(['participants',args]);return [...interactions.values()].filter(i=>i.eventId===args.where.eventId).sort((a,b)=>+a.createdAt-+b.createdAt||a.id.localeCompare(b.id)).map(({userId,...i})=>({...i,user:{username:'name-'+userId}}))},
  }
  const dbEvent={
    findUnique:async ({where})=>{const row=rows.get(where.id);return row?{...row,_count:{interactions:[...interactions.values()].filter(i=>i.eventId===row.id).length}}:null},
    update:async ({where,data})=>{calls.push(['update',data]);Object.assign(rows.get(where.id),data);return rows.get(where.id)},
    create:async ({data})=>{calls.push(['event-create',data]);return data},
    findMany:async args=>{calls.push(['events',args]);return [...rows.values()].filter(e=>e.active&&e.endsAt>args.where.endsAt.gt).sort((a,b)=>a.startsAt-b.startsAt).map(e=>{const mine=interactions.get(e.id+':'+args.select.interactions.where.userId);return {id:e.id,type:e.type,title:e.title,description:e.description,interactionPrompt:e.interactionPrompt,options:e.options,startsAt:e.startsAt,endsAt:e.endsAt,interactions:mine?[{id:mine.id,optionKey:mine.optionKey,response:mine.response,createdAt:mine.createdAt}]:[]}})},
  }
  const prisma={communityEvent:dbEvent,communityEventInteraction:interaction,communityMembership:{findUnique:async()=>member?{id:'membership'}:null},communityTicket:{findMany:async args=>{calls.push(['tickets',args]);return[]},create:async ({data})=>{calls.push(['ticket-create',data]);return data}},user:{findUnique:async()=>({id:'u'})},$transaction:async(work,config)=>{assert.equal(config.isolationLevel,'Serializable');return work(prisma)}}
  const load=loader({'@/lib/prisma':{prisma},'@/lib/auth':{getCurrentUser:async()=>user},'next/server':{NextResponse:{json:Response.json}}})
  return {rows,interactions,calls,prisma,load,service:load('lib/community/events.ts'),setUser:value=>{user=value},setMember:value=>{member=value}}
}
test('legacy announcement config defaults to ANNOUNCEMENT and retains dates/content; no interaction',async()=>{
  const db=store(),data=db.service.eventData(input(db.rows.get('e'),{type:undefined}));assert.equal(data.type,'ANNOUNCEMENT');assert.equal(data.title,'MBE');assert.equal(data.startsAt.getTime(),db.rows.get('e').startsAt.getTime())
  await assert.rejects(()=>db.service.interactWithEvent('u','e',{response:'x'}),e=>e.status===400);assert.equal(db.interactions.size,0)
})
test('mission trims/stores one private response and never allows replacement',async()=>{
  const db=store('MISSION');const saved=await db.service.interactWithEvent('u','e',{response:'  BE  ',userId:'other'});assert.equal(saved.response,'BE');assert.equal(db.interactions.get('e:u').userId,'u')
  await assert.rejects(()=>db.service.interactWithEvent('u','e',{response:'new'}),e=>e.status===409);assert.equal(db.interactions.get('e:u').response,'BE')
})
for(const response of ['', '  ', 'x'.repeat(501), '<script>bad</script>',null])test('mission rejects invalid response '+String(response).slice(0,20),async()=>{const db=store('MISSION');await assert.rejects(()=>db.service.interactWithEvent('u','e',{response}),e=>e.status===400);assert.equal(db.interactions.size,0)})
test('mission accepts exactly 500 characters',async()=>{const db=store('MISSION');assert.equal((await db.service.interactWithEvent('u','e',{response:'x'.repeat(500)})).response.length,500)})
for(const [name,fields] of [['future',{startsAt:new Date(Date.now()+86400000),endsAt:new Date(Date.now()+172800000)}],['expired',{endsAt:new Date(Date.now()-1)}],['inactive',{active:false}]])test(name+' event rejects all interactive types server-side',async()=>{for(const type of ['MISSION','DECISION','CHOICE']){const db=store(type,fields);await assert.rejects(()=>db.service.interactWithEvent('u','e',{response:'x',optionKey:'a'}),e=>e.status===409);assert.equal(db.interactions.size,0)}})
test('mission state never exposes another member response or participant list',async()=>{
  const db=store('MISSION');await db.service.interactWithEvent('other','e',{response:'TOP SECRET'});const before=await db.service.eventState('u');assert.equal(before.events[0].myInteraction,null);assert.equal(before.events[0].results,null);assert.ok(!JSON.stringify(before).includes('TOP SECRET'))
  await db.service.interactWithEvent('u','e',{response:'mine'});const after=await db.service.eventState('u');assert.equal(after.events[0].myInteraction.response,'mine');assert.ok(!JSON.stringify(after).includes('TOP SECRET'));assert.equal(db.calls.some(c=>c[0]==='aggregate'),false)
  assert.deepEqual(db.calls.find(c=>c[0]==='events')[1].select.interactions.where,{userId:'u'})
})
for(const type of ['DECISION','CHOICE'])test(type+' accepts only stored options and one irreversible choice',async()=>{
  const db=store(type);await assert.rejects(()=>db.service.interactWithEvent('u','e',{optionKey:'missing',options:[{key:'missing',label:'forged'}]}),e=>e.status===400)
  await db.service.interactWithEvent('u','e',{optionKey:'a',type:'MISSION',response:'forged',counts:500});assert.equal(db.interactions.get('e:u').optionKey,'a');assert.equal(db.interactions.get('e:u').response,null)
  await assert.rejects(()=>db.service.interactWithEvent('u','e',{optionKey:'b'}),e=>e.status===409);assert.equal(db.interactions.get('e:u').optionKey,'a')
})
test('decision options require 2..6, choice exactly 2, unique keys/nonempty distinct labels',()=>{
  const db=store();for(const count of [2,6])assert.equal(db.service.eventOptions(Array.from({length:count},(_,i)=>({key:'k'+i,label:'Color '+i})),'DECISION').length,count)
  for(const count of [0,1,7])assert.throws(()=>db.service.eventOptions(Array.from({length:count},(_,i)=>({key:'k'+i,label:'Color '+i})),'DECISION'))
  for(const value of [[{key:'a',label:''},{key:'b',label:'B'}],[{key:'a',label:'A'},{key:'a',label:'B'}],[{key:'a',label:'Crudo'},{key:'b',label:' crudo '}],[{key:'bad key',label:'A'},{key:'b',label:'B'}]])assert.throws(()=>db.service.eventOptions(value,'DECISION'))
  for(const count of [1,3,6])assert.throws(()=>db.service.eventOptions(Array.from({length:count},(_,i)=>({key:'k'+i,label:'Color '+i})),'CHOICE'))
  assert.equal(db.service.eventOptions(options,'CHOICE').length,2)
})
for(const type of ['DECISION','CHOICE'])test(type+' hides all counts until participation, then returns correct aggregates only',async()=>{
  const db=store(type);await db.service.interactWithEvent('other1','e',{optionKey:'a'});await db.service.interactWithEvent('other2','e',{optionKey:'b'})
  const before=await db.service.eventState('u');assert.equal(before.events[0].results,null);assert.equal(db.calls.filter(c=>c[0]==='aggregate').length,0)
  await db.service.interactWithEvent('u','e',{optionKey:'a'});const after=await db.service.eventState('u');assert.equal(after.events[0].results.total,3);assert.deepEqual(after.events[0].results.options.map(o=>[o.count,o.percent]),[[2,66.7],[1,33.3]])
  assert.ok(!JSON.stringify(after).includes('other1'));assert.ok(!JSON.stringify(after).includes('name-'))
})
for(const type of ['MISSION','DECISION','CHOICE'])test('concurrent '+type+' requests persist exactly one interaction',async()=>{
  const db=store(type),results=await Promise.allSettled(Array.from({length:12},(_,i)=>db.service.interactWithEvent('u','e',{response:'response-'+i,optionKey:i%2?'b':'a'})))
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(db.interactions.size,1);assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.status===409))
})
test('member endpoint takes identity from auth only and blocks anonymous/nonmember/foreign origin',async()=>{
  const db=store('MISSION'),route=db.load('app/api/community/events/[id]/interact/route.ts'),req=()=>new Request('https://mbe.test',{method:'POST',body:JSON.stringify({response:'mine',userId:'other',username:'admin'})})
  db.setUser(null);assert.equal((await route.POST(req(),{params:{id:'e'}})).status,401)
  db.setUser({id:'u',role:'CLIENTE'});db.setMember(false);assert.equal((await route.POST(req(),{params:{id:'e'}})).status,403)
  db.setMember(true);assert.equal((await route.POST(new Request('https://mbe.test',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'}),{params:{id:'e'}})).status,403)
  assert.equal((await route.POST(req(),{params:{id:'e'}})).status,200);assert.equal(db.interactions.get('e:u').userId,'u');assert.equal(db.interactions.has('e:other'),false)
})
test('admin mission results retain historical responses in createdAt/id ascending order',async()=>{
  const db=store('MISSION');await db.service.interactWithEvent('late','e',{response:'last'});await db.service.interactWithEvent('first','e',{response:'first'})
  db.interactions.get('e:first').createdAt=new Date('2026-01-01');db.rows.get('e').active=false;db.rows.get('e').endsAt=new Date('2026-01-02')
  const result=await db.service.eventParticipation('e');assert.equal(result.total,2);assert.equal(result.results,null);assert.equal(result.participants[0].user.username,'name-first');assert.equal(result.participants[0].response,'first')
  assert.deepEqual(db.calls.find(c=>c[0]==='participants')[1].orderBy,[{createdAt:'asc'},{id:'asc'}])
})
test('admin poll results always available and participation endpoint is ADMIN-only',async()=>{
  const db=store('DECISION');await db.service.interactWithEvent('voter','e',{optionKey:'b'});const route=db.load('app/api/admin/community/events/[id]/participation/route.ts')
  assert.equal((await route.GET(new Request('https://mbe.test'),{params:{id:'e'}})).status,403)
  db.setUser({id:'admin',role:'ADMIN'});db.setMember(false);const res=await route.GET(new Request('https://mbe.test'),{params:{id:'e'}});assert.equal(res.status,200);const data=await res.json();assert.equal(data.results.total,1);assert.deepEqual(data.results.options.map(o=>o.percent),[0,100])
})
test('options/type and mission prompt freeze after participation, but descriptive/status updates remain allowed',async()=>{
  const db=store('DECISION');await db.service.interactWithEvent('u','e',{optionKey:'a'});const current=db.rows.get('e')
  for(const fields of [{options:[{key:'a',label:'changed'},options[1]]},{options:[...options,{key:'c',label:'extra'}]},{options:[options[1],options[0]]},{type:'CHOICE'}])await assert.rejects(()=>db.service.updateEvent('e',input(current,fields)),e=>e.status===409)
  await db.service.updateEvent('e',input(current,{title:'Updated',active:false}));assert.equal(current.title,'Updated');assert.equal(current.active,false)
  const mission=store('MISSION');await mission.service.interactWithEvent('u','e',{response:'code'});await assert.rejects(()=>mission.service.updateEvent('e',input(mission.rows.get('e'),{interactionPrompt:'different task'})),e=>e.status===409)
})
test('event config rejects unknown types, missing mission prompt and invalid date ranges',()=>{
  const db=store();for(const fields of [{type:'FORGED'},{type:'MISSION',interactionPrompt:' '},{endsAt:new Date(Date.now()-120000).toISOString()}])assert.throws(()=>db.service.eventData(input(db.rows.get('e'),fields)))
})
test('eventState retains future announcements/tickets but excludes inactive and expired events',async()=>{
  const db=store();db.rows.set('future',event('MISSION',{id:'future',startsAt:new Date(Date.now()+60000)}));db.rows.set('expired',event('CHOICE',{id:'expired',endsAt:new Date(Date.now()-1)}));db.rows.set('inactive',event('DECISION',{id:'inactive',active:false}))
  const state=await db.service.eventState('u');assert.deepEqual(state.events.map(e=>e.id),['e','future']);assert.deepEqual(db.calls.find(c=>c[0]==='tickets')[1].where,{userId:'u'})
  const ticket=await db.service.assignTicket({eventId:'e',username:'u',discountPercent:20});assert.equal(ticket.userId,'u');assert.equal(ticket.discountPercent,20);assert.equal(db.interactions.size,0)
})
test('new model is unique per member/event and migration only adds event fields/table; tickets and legacy event fields stay',()=>{
  const model=Prisma.dmmf.datamodel.models.find(m=>m.name==='CommunityEventInteraction');assert.ok(model.uniqueFields.some(f=>f.join(',')==='eventId,userId'))
  const e=Prisma.dmmf.datamodel.models.find(m=>m.name==='CommunityEvent');for(const name of ['title','description','startsAt','endsAt','active','tickets','type','options','interactionPrompt','interactions'])assert.ok(e.fields.some(f=>f.name===name))
  assert.equal(e.fields.find(f=>f.name==='type').default,'ANNOUNCEMENT')
  const sql=fs.readFileSync('prisma/migrations/20261010180000_community_event_interactions/migration.sql','utf8');assert.ok(!/\b(DROP|TRUNCATE|DELETE FROM|UPDATE "CommunityEvent"|INSERT INTO)\b/i.test(sql));assert.match(sql,/DEFAULT 'ANNOUNCEMENT'/)
})
function clientEvent(type, fields={}) {const e=event(type);return {...e,startsAt:e.startsAt.toISOString(),endsAt:e.endsAt.toISOString(),options:e.options||[],myInteraction:null,results:null,...fields}}
function cardHarness(e, onInteract=async()=>{}) {
  let slot=0,tree;const slots=[]
  const hooks={useState(initial){const i=slot++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},useRef(initial){const i=slot++;if(!(i in slots))slots[i]={current:initial};return slots[i]}}
  const {CommunityEventCard}=loader({react:hooks})('components/community/community-events.tsx')
  function render(){slot=0;tree=CommunityEventCard({event:e,now:Date.now(),onInteract});return tree}
  function elements(node=tree){return React.isValidElement(node)?[node,...React.Children.toArray(node.props.children).flatMap(elements)]:[]}
  render();return {render,elements,html:()=>renderToStaticMarkup(render())}
}
test('member UI preserves announcement, mission form and future disabled controls/date',()=>{
  const announcement=cardHarness(clientEvent('ANNOUNCEMENT'));assert.ok(announcement.html().includes('EVENTO'));assert.equal(announcement.elements().some(e=>e.type==='button'),false)
  const mission=cardHarness(clientEvent('MISSION',{startsAt:new Date(Date.now()+60000).toISOString()}));assert.ok(mission.html().includes('MISIÓN MBE'));assert.ok(mission.html().includes('Disponible el'))
  const textarea=mission.elements().find(e=>e.type==='textarea');assert.equal(textarea.props.disabled,true);assert.equal(textarea.props.maxLength,500);assert.equal(mission.elements().find(e=>e.type==='button').props.disabled,true)
  for(const type of ['DECISION','CHOICE']){const ui=cardHarness(clientEvent(type,{startsAt:new Date(Date.now()+60000).toISOString()}));assert.ok(ui.elements().filter(e=>e.type==='button').every(e=>e.props.disabled));assert.ok(ui.html().includes('Disponible el'))}
})
test('mission UI submits only response, shows registered own answer and removes editing after success',async()=>{
  const e=clientEvent('MISSION'),calls=[],ui=cardHarness(e,async(id,payload)=>{calls.push({id,payload});e.myInteraction={id:'i',response:payload.response,optionKey:null,createdAt:new Date().toISOString()}})
  ui.elements().find(e=>e.type==='textarea').props.onChange({target:{value:'my code'}});ui.render();ui.elements().find(e=>e.type==='form').props.onSubmit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));ui.render()
  assert.deepEqual(calls,[{id:'e',payload:{response:'my code'}}]);assert.ok(ui.html().includes('Participación registrada'));assert.ok(ui.html().includes('my code'));assert.equal(ui.elements().some(e=>e.type==='textarea'),false)
})
for(const type of ['DECISION','CHOICE'])test(type+' UI hides bars before vote and prevents simultaneous submissions; selected state is irreversible',async()=>{
  const e=clientEvent(type),calls=[];let release
  const ui=cardHarness(e,async(id,payload)=>{calls.push({id,payload});await new Promise(resolve=>{release=resolve});e.myInteraction={id:'i',optionKey:payload.optionKey,response:null,createdAt:new Date().toISOString()};e.results={total:1,options:options.map(o=>({...o,count:o.key===payload.optionKey?1:0,percent:o.key===payload.optionKey?100:0}))}})
  assert.ok(!ui.html().includes('Resultados de la participación'))
  const buttons=ui.elements().filter(e=>e.type==='button'),first=buttons[0].props.onClick();await buttons[1].props.onClick();assert.equal(calls.length,1);assert.deepEqual(calls[0].payload,{optionKey:'a'})
  release();await first;ui.render();assert.ok(ui.html().includes(type==='CHOICE'?'Elegiste Crudo':'Tu elección fue registrada.'));assert.ok(ui.html().includes('Resultados de la participación'));assert.equal(ui.elements().some(e=>e.type==='button'),false)
  if(type==='CHOICE')assert.ok(renderToStaticMarkup(cardHarness(clientEvent(type)).render()).includes('min-h-44'))
})
test('TicketsManager still sends manual ticket payload and renders existing tickets without interacting or auto awarding',async()=>{
  let slot=0,tree;const slots=[],effects=[],requests=[]
  const hooks={useState(initial){const i=slot++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},useCallback(fn){return fn},useEffect(fn){if(!tree)effects.push(fn)}}
  const {TicketsManager}=loader({react:hooks,'./request':{field:'field',action:'action',communityRequest:async(route,method,payload)=>{requests.push({route,method,payload});return method?{}:[{id:'t',discountPercent:10,code:'MBE-CODE',createdAt:new Date().toISOString(),expiresAt:null,usedAt:null,user:{username:'member'},event:{title:'Existing'}}]}}})('components/admin/community/tickets-manager.tsx')
  function render(){slot=0;tree=TicketsManager({events:[{id:'e',title:'Existing',active:true}],onAssigned:async()=>{}});return tree}
  function elements(node=tree){return React.isValidElement(node)?[node,...React.Children.toArray(node.props.children).flatMap(elements)]:[]}
  render();effects.forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));render();assert.ok(renderToStaticMarkup(tree).includes('MBE-CODE'))
  elements().find(e=>e.type==='select').props.onChange({target:{value:'e'}})
  elements().find(e=>e.type==='input'&&e.props.maxLength===100).props.onChange({target:{value:'member'}});render()
  await elements().find(e=>e.type==='form').props.onSubmit({preventDefault(){}})
  const request=requests.find(r=>r.method==='POST');assert.equal(request.route,'/api/admin/community/tickets');assert.deepEqual(request.payload,{eventId:'e',username:'member',discountPercent:5,expiresAt:null});assert.ok(!requests.some(r=>r.route.includes('interact')))
})
test('EventsManager configures all types, locks used options and exposes historical participation with tickets preserved',async()=>{
  let slot=0,tree;const slots=[],effects=[],requests=[]
  const hooks={useState(initial){const i=slot++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},useCallback(fn){return fn},useEffect(fn){if(!tree)effects.push(fn)}}
  const existing={...clientEvent('DECISION'),active:false,_count:{tickets:2,interactions:1}}
  const {EventsManager}=loader({react:hooks,'./tickets-manager':{TicketsManager:()=>null},'@/components/community/community-events':{EventResultBars:()=>null},'./request':{field:'field',action:'action',communityRequest:async(route,method,payload)=>{requests.push({route,method,payload});return route.endsWith('participation')?{event:existing,total:1,results:null,participants:[{id:'i',response:'Historical',optionKey:null,createdAt:new Date().toISOString(),user:{username:'first'}}]}:[existing]}}})('components/admin/community/events-manager.tsx')
  function render(){slot=0;tree=EventsManager();return tree}
  function elements(node=tree){return React.isValidElement(node)?[node,...React.Children.toArray(node.props.children).flatMap(elements)]:[]}
  render();effects.forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));render();assert.equal(elements().filter(e=>e.type==='option').length,4)
  elements().find(e=>e.type==='button'&&e.props.children==='Editar / activar').props.onClick();render();assert.equal(elements().find(e=>e.type==='select').props.disabled,true);assert.ok(elements().filter(e=>e.type==='input'&&e.props.maxLength===100).every(e=>e.props.disabled))
  await elements().find(e=>e.type==='button'&&e.props.children==='Ver participación').props.onClick();render();assert.ok(renderToStaticMarkup(tree).includes('Historical'));assert.ok(requests.some(r=>r.route==='/api/admin/community/events/e/participation'))
})
