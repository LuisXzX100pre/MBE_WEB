const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript')
function loader(deps={}){
 const cache=new Map()
 function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod)
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
 new Function('require','exports',js)(name=>{if(name in deps)return deps[name];if(name==='server-only')return{};const base=name.startsWith('@/')?path.resolve(name.slice(2)):name.startsWith('.')?path.resolve(path.dirname(file),name):null;const local=base&&[base+'.ts',base+'.tsx'].find(fs.existsSync);return local?load(local):require(name)},mod.exports);return mod.exports}return load
}
const benefit=(id,percent,extra={})=>({id,userId:'u',discountPercent:percent,createdAt:new Date('2026-01-01'),usedAt:null,...extra})
function match(row,where={}){if(where.OR&&!where.OR.some(w=>match(row,w)))return false;return Object.entries(where).every(([k,v])=>k==='OR'||(v&&typeof v==='object'&&!(v instanceof Date)?('gt'in v?row[k]!=null&&row[k]>v.gt:'not'in v?row[k]!==v.not:true):row[k]===v))}
function fixture(spins=[],tickets=[]){
 let state={spins:structuredClone(spins),tickets:structuredClone(tickets),orders:[],payments:[]},seq=0;const stripeCalls=[],consumeCalls=[]
 function adapter(get){
  const model=name=>({findMany:async({where})=>get()[name].filter(r=>match(r,where)),updateMany:async({where,data})=>{const rows=get()[name].filter(r=>match(r,where));if(['spins','tickets'].includes(name))consumeCalls.push({name,where,count:rows.length});rows.forEach(r=>Object.assign(r,data));return{count:rows.length}}})
  return {communityWheelSpin:model('spins'),communityTicket:model('tickets'),
   order:{create:async({data})=>{const order={id:'o'+ ++seq,inventoryDiscounted:false,...data,items:data.items?.create||[]};get().orders.push(order);return order},update:async({where,data})=>{const order=get().orders.find(o=>o.id===where.id);Object.assign(order,data);return order},findUnique:async({where})=>get().orders.find(o=>o.id===where.id)},
   payment:{...model('payments'),create:async({data})=>{assert.ok(!data.paymentIntentId||!get().payments.some(p=>p.paymentIntentId===data.paymentIntentId));const p={id:'p'+ ++seq,...data};get().payments.push(p);return p},update:async({where,data})=>{const p=get().payments.find(p=>p.id===where.id);Object.assign(p,data);return p},findFirst:async({where})=>{const p=get().payments.find(p=>where.OR?where.OR.some(w=>match(p,w)):p.paymentIntentId===where.paymentIntentId);return p?{...p,order:get().orders.find(o=>o.id===p.orderId)}:null}},
   cart:{findUnique:async()=>({id:'cart',items:[{quantity:1,productColorId:null,size:null,product:{id:'prod',name:'Prenda',price:500,stock:20,status:'ACTIVE',releaseAt:null,sizes:[],colors:[]}}]})},cartItem:{deleteMany:async()=>{}},
  }
 }
 const prisma=adapter(()=>state);prisma.$transaction=async work=>{const snapshot=structuredClone(state);const result=await work(adapter(()=>snapshot));state=snapshot;return result}
 const shipping={total:100,rateId:'mbe-local-benito-juarez-free',carrier:'mbe-local',serviceName:'Test'}
 const deps={'@/lib/prisma':{prisma},'@/lib/auth':{getCurrentUser:async()=>({id:'u'})},'next/server':{NextResponse:Object.assign(class extends Response{}, {json:Response.json})},'@/lib/stripe':{stripe:{paymentIntents:{create:async data=>{stripeCalls.push(data);return{id:'pi',client_secret:'secret'}},update:async(id,data)=>{stripeCalls.push(data);return{id,client_secret:'secret'}}}}},'@/lib/shipping/checkout-shipping':{resolveCheckoutShipping:async()=>({option:shipping,quotationId:'quote'}),CheckoutShippingError:class extends Error{}}}
 const load=loader(deps),helper=load('lib/community/benefits.ts')
 const request=(extra={})=>new Request('https://mbe.test',{method:'POST',body:JSON.stringify({recipient:'Cliente',phone:'9981234567',email:'test@example.com',cardholderName:'Cliente',postalCode:'77500',state:'Quintana Roo',city:'Cancún',colony:'Centro',street:'Calle',selectedShippingOption:shipping,...extra})})
 return{load,helper,prisma,deps,request,stripeCalls,consumeCalls,get state(){return state},checkout:()=>load('app/api/stripe/create-payment-intent/route.ts')}
}
for(const [name,spins,tickets,percent,total] of [
 ['none',[],[],0,600],['wheel',[benefit('w',10)],[],10,550],['ticket',[],[benefit('t',20,{expiresAt:null})],20,500],['highest only',[benefit('w',10)],[benefit('t',20,{expiresAt:null})],20,500],
 ['expired ticket',[],[benefit('t',20,{expiresAt:new Date('2020-01-01')})],0,600],['used ticket',[],[benefit('t',20,{usedAt:new Date(),expiresAt:null})],0,600],['used wheel',[benefit('w',10,{usedAt:new Date()})],[],0,600],['finished wheel campaign',[benefit('w',10,{campaign:{endsAt:new Date('2020-01-01')}})],[],10,550],
])test('checkout '+name+': server amount, metadata, original subtotal and shipping',async()=>{
 const f=fixture(spins,tickets),res=await f.checkout().POST(f.request({discountPercent:99,communityBenefitId:'FORGED',userId:'other'})),data=await res.json();assert.equal(res.status,200)
 assert.equal(data.amounts.subtotal,500);assert.equal(data.amounts.shippingCost,100);assert.equal(data.amounts.discountPercent,percent);assert.equal(data.amounts.total,total)
 assert.equal(f.stripeCalls[0].amount,total*100);assert.equal(f.state.orders[0].subtotal,500);assert.equal(f.state.orders[0].total,total)
 const m=f.stripeCalls[0].metadata;assert.equal(m.originalSubtotal,'500.00');assert.equal(m.communityDiscountPercent,String(percent));assert.equal(m.shippingCost,'100.00');assert.ok(m.cartSnapshot);assert.ok(m.shippingQuoteJson)
 assert.equal(f.consumeCalls.length,0);assert.ok(!f.state.spins.some(s=>s.id==='w'&&s.usedAt&&!spins[0].usedAt))
 if(percent)assert.notEqual(m.communityBenefitId,'FORGED')
})
test('ties prefer closest expiry then stable creation/type/id; foreign account excluded',async()=>{
 const f=fixture([benefit('w',20),benefit('foreign',99,{userId:'other'})],[benefit('late',20,{expiresAt:new Date('2099-03-01')}),benefit('near-b',20,{expiresAt:new Date('2099-01-01')}),benefit('near-a',20,{expiresAt:new Date('2099-01-01')})])
 assert.deepEqual(await f.helper.resolveCommunityBenefit('u'),{type:'TICKET',id:'near-a',percent:20,label:'Beneficio MBE · Evento 20%'})
})
test('preview never creates PaymentIntent/order or consumes benefit; no holder needed',async()=>{
 const f=fixture([benefit('w',10)]),res=await f.checkout().POST(f.request({preview:true,cardholderName:''}));assert.equal(res.status,200)
 assert.equal((await res.json()).amounts.total,550);assert.equal(f.state.orders.length,0);assert.equal(f.stripeCalls.length,0);assert.equal(f.consumeCalls.length,0)
})
test('cent rounding discounts only products and validates paid snapshot',()=>{
 const f=fixture(),b={type:'WHEEL',id:'w',percent:10,label:'MBE'},a=f.helper.communityAmounts(10.05,3.33,b)
 assert.equal(a.discountAmountCents,101);assert.equal(a.totalCents,1237)
 const metadata={...f.helper.communityBenefitMetadata(b,a),shippingCost:'3.33',total:'12.37'}
 assert.equal(f.helper.validateCommunityPayment(metadata,1237).id,'w')
 assert.throws(()=>f.helper.validateCommunityPayment(metadata,1238));assert.throws(()=>f.helper.moneyCents(NaN))
})
test('reused PaymentIntent removes a now-used discount snapshot and updates amount',async()=>{
 const f=fixture([benefit('w',10)]);await f.checkout().POST(f.request())
 f.state.spins[0].usedAt=new Date()
 const response=await f.checkout().POST(f.request({paymentIntentId:'pi'}));assert.equal(response.status,200)
 assert.equal(f.stripeCalls[1].amount,60000);assert.equal(f.stripeCalls[1].metadata.communityBenefitId,'');assert.equal(f.stripeCalls[1].metadata.communityDiscountAmount,'0.00')
})
function webhook(f,intent,eventType){
 const load=loader({...f.deps,'@/lib/stripe':{stripe:{webhooks:{constructEvent:()=>({type:eventType,data:{object:intent}})}}},'next/headers':{headers:()=>new Map([['stripe-signature','test']])},'@/lib/inventory':{syncInventoryByStatus:async()=>{}},'@/lib/skydropx':{},'@/lib/order-status-notifications':{sendOrderStatusNotifications:async()=>{}}})
 return load('app/api/webhooks/stripe/route.ts').POST(new Request('https://mbe.test',{method:'POST',body:'signed'}))
}
async function withSecret(work){const old=process.env.STRIPE_WEBHOOK_SECRET;process.env.STRIPE_WEBHOOK_SECRET='test';try{await work()}finally{if(old===undefined)delete process.env.STRIPE_WEBHOOK_SECRET;else process.env.STRIPE_WEBHOOK_SECRET=old}}
for(const kind of ['WHEEL','TICKET'])test('succeeded consumes exact '+kind+' once in payment transaction; replay changes nothing',()=>withSecret(async()=>{
 const f=fixture(kind==='WHEEL'?[benefit('w',10)]:[],kind==='TICKET'?[benefit('t',20,{expiresAt:null})]:[])
 await f.checkout().POST(f.request());const intent={id:'pi',metadata:f.stripeCalls[0].metadata,amount:f.stripeCalls[0].amount,amount_received:f.stripeCalls[0].amount,payment_method:'pm',currency:'mxn'}
 assert.equal((await webhook(f,intent,'payment_intent.succeeded')).status,200)
 const used=(kind==='WHEEL'?f.state.spins:f.state.tickets)[0].usedAt;assert.ok(used);assert.equal(f.state.payments[0].status,'COMPLETED');assert.equal(f.state.orders[0].status,'PAID')
 assert.equal((await webhook(f,intent,'payment_intent.succeeded')).status,200)
 assert.equal(f.consumeCalls.length,1);assert.deepEqual((kind==='WHEEL'?f.state.spins:f.state.tickets)[0].usedAt,used)
}))
for(const type of ['payment_intent.payment_failed','payment_intent.canceled'])test(type+' does not consume',()=>withSecret(async()=>{
 const f=fixture([benefit('w',10)]);await f.checkout().POST(f.request())
 assert.equal((await webhook(f,{id:'pi',metadata:f.stripeCalls[0].metadata},type)).status,200);assert.equal(f.state.spins[0].usedAt,null);assert.equal(f.consumeCalls.length,0)
}))
test('fallback preserves original subtotal, final Stripe amount and exact snapshot even with new better benefit',()=>withSecret(async()=>{
 const f=fixture([benefit('w',10)]);await f.checkout().POST(f.request());const data=f.stripeCalls[0]
 f.state.orders.length=0;f.state.payments.length=0;f.state.tickets.push(benefit('new-best',50,{expiresAt:null}))
 const intent={id:'pi',metadata:data.metadata,amount:data.amount,amount_received:data.amount,payment_method:'pm',currency:'mxn'}
 assert.equal((await webhook(f,intent,'payment_intent.succeeded')).status,200)
 assert.equal(f.state.orders[0].subtotal,500);assert.equal(f.state.orders[0].shippingCost,100);assert.equal(f.state.orders[0].total,550)
 assert.ok(f.state.spins[0].usedAt);assert.equal(f.state.tickets[0].usedAt,null)
 assert.equal((await webhook(f,intent,'payment_intent.succeeded')).status,200);assert.equal(f.state.orders.length,1);assert.equal(f.consumeCalls.length,1)
}))
test('foreign or already-consumed snapshot fails and rolls back payment; never substitutes another benefit',()=>withSecret(async()=>{
 const f=fixture([benefit('w',10),benefit('other',20,{usedAt:new Date()})]);await f.checkout().POST(f.request());f.state.spins[0].usedAt=new Date()
 const data=f.stripeCalls[0];assert.equal((await webhook(f,{id:'pi',metadata:data.metadata,amount:data.amount,amount_received:data.amount},'payment_intent.succeeded')).status,500)
 assert.equal(f.state.payments[0].status,'PENDING');assert.equal(f.state.orders[0].status,'PENDING');assert.equal(f.consumeCalls[0].where.id,'w')
}))

test('foreign benefit snapshot cannot consume another account and payment rollback is atomic',()=>withSecret(async()=>{
 const f=fixture([benefit('w',10)]);await f.checkout().POST(f.request());f.state.spins[0].userId='another-user'
 const data=f.stripeCalls[0],intent={id:'pi',metadata:data.metadata,amount:data.amount,amount_received:data.amount}
 assert.equal((await webhook(f,intent,'payment_intent.succeeded')).status,500)
 assert.equal(f.state.spins[0].usedAt,null);assert.equal(f.state.payments[0].status,'PENDING');assert.equal(f.state.orders[0].status,'PENDING')
}))

test('Checkout SSR shows server-supplied benefit and discounted subtotal before choosing shipping',async()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),f=fixture([benefit('w',10)])
 const selected=await f.helper.resolveCommunityBenefit('u')
 const old=process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY='pk_test_ui'
 const NoCard=()=>null
 const load=loader({'next/image':({src,alt})=>React.createElement('img',{src,alt}),'next/link':({href,children})=>React.createElement('a',{href},children),'@stripe/stripe-js':{loadStripe:()=>Promise.resolve(null)},'@stripe/react-stripe-js':{Elements:({children})=>children,useStripe:()=>null,useElements:()=>null,CardNumberElement:NoCard,CardExpiryElement:NoCard,CardCvcElement:NoCard}})
 try{const {CheckoutForm}=load('components/store/checkout-form.tsx');const html=renderToStaticMarkup(React.createElement(CheckoutForm,{items:[],total:500,initialBenefit:selected,initialDiscountAmount:50}));assert.ok(html.includes('Beneficio MBE · Ruleta 10%'));assert.ok(html.includes('-50.00 MXN'));assert.ok(html.includes('Pagar 450.00 MXN'))}finally{if(old===undefined)delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=old}
})

test('checkout keeps newest server preview amounts when responses arrive out of order',async()=>{
 const React=require('react');let slot=0;const states=[],pending=[]
 const hooks={...React,useState(initial){const i=slot++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value}]},useRef(initial){const i=slot++;if(!(i in states))states[i]={current:initial};return states[i]},useMemo:fn=>fn(),useEffect(){}}
 const oldKey=process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,oldFetch=global.fetch;process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY='pk_test_ui'
 global.fetch=(_url,args)=>new Promise(resolve=>pending.push({resolve,body:JSON.parse(args.body)}))
 const load=loader({react:hooks,'@stripe/stripe-js':{loadStripe:()=>Promise.resolve(null)},'@stripe/react-stripe-js':{Elements:({children})=>children,useStripe:()=>null,useElements:()=>null},'next/image':()=>null,'next/link':()=>null})
 try{
  const {CheckoutForm}=load('components/store/checkout-form.tsx'),inner=CheckoutForm({items:[],total:500}).props.children
  function render(){slot=0;return inner.type(inner.props)}
  function elements(node){return React.isValidElement(node)?[node,...React.Children.toArray(node.props.children).flatMap(elements)]:[]}
  let tree=render(),modal=elements(tree).find(e=>e.props.onConfirm)
  const first=modal.props.onConfirm({total:100,bucket:'cheapest'}),second=modal.props.onConfirm({total:200,bucket:'express'})
  const helper=fixture().helper
  pending[1].resolve({ok:true,json:async()=>({benefit:null,amounts:helper.communityAmounts(500,200,null)})});await second
  pending[0].resolve({ok:true,json:async()=>({benefit:null,amounts:helper.communityAmounts(500,100,null)})});await first
  tree=render();const nativeText=elements(tree).flatMap(e=>React.Children.toArray(e.props.children)).filter(c=>typeof c==='string').join(' ')
  assert.ok(nativeText.includes('700.00 MXN'));assert.ok(!nativeText.includes('600.00 MXN'))
  assert.equal(pending[0].body.preview,true);assert.equal(pending[1].body.preview,true)
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=oldKey}
})
