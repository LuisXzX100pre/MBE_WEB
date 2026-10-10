const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
function load(file, dependencies = {}) {
  const mod = { exports: {} }
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'exports', 'Date', js)(name => name === 'server-only' ? {} : dependencies[name] || require(name), mod.exports, dependencies.__Date || Date)
  return mod.exports
}
const validation = load('lib/community/validation.ts')
const config = load('lib/community/wheel-config.ts', { './validation': validation })
class KnownError extends Error { constructor(code) { super(code); this.code = code } }
const input = overrides => ({ name: 'Interna', title: 'THE FIRST ONES IN', subtitle: 'Solo adentro', description: 'Un beneficio del próximo movimiento.', note: null, active: true, startsAt: null, endsAt: null, ...overrides })
function store(Clock = Date) {
  let state = { campaigns: new Map(), spins: new Map() }, version = 0, sequence = 0, draws = 0, conflicts = 0
  function adapter(get, write) {
    return {
      communityWheelCampaign: {
        findUnique: async ({ where }) => get().campaigns.get(where.id) || null,
        findFirst: async ({ where }) => {
          function matches(c, w) {
            if (w.active !== undefined && c.active !== w.active) return false
            if (typeof w.id === 'string' && c.id !== w.id) return false
            if (w.AND && !w.AND.every(part => matches(c, part))) return false
            if (w.OR && !w.OR.some(part => matches(c, part))) return false
            for (const key of ['startsAt', 'endsAt']) {
              if (w[key] === null && c[key] !== null) return false
              if (w[key]?.lte && (!c[key] || c[key] > w[key].lte)) return false
              if (w[key]?.gt && (!c[key] || c[key] <= w[key].gt)) return false
            }
            return true
          }
          return [...get().campaigns.values()].filter(c => matches(c, where)).sort((a,b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))[0] || null
        },
        findMany: async () => [...get().campaigns.values()].map(c => ({ ...c, _count: { spins: [...get().spins.values()].filter(s => s.campaignId === c.id).length } })),
        updateMany: async ({ where, data }) => { let count = 0; for (const c of get().campaigns.values()) if (c.active && (!where.id || c.id !== where.id.not)) { Object.assign(c, data); count++ } if (count) write(); return { count } },
        create: async ({ data }) => { const row = { id: 'campaign-' + ++sequence, createdAt: new Date(), ...data }; get().campaigns.set(row.id, row); write(); return row },
        update: async ({ where, data }) => { const row = get().campaigns.get(where.id); Object.assign(row, data); write(); return row },
      },
      communityWheelSpin: {
        findUnique: async ({ where }) => get().spins.get(where.userId_campaignId.userId + ':' + where.userId_campaignId.campaignId) || null,
        findFirst: async ({ where }) => [...get().spins.values()].filter(s => s.userId === where.userId).sort((a,b) => b.createdAt - a.createdAt)[0] || null,
        create: async ({ data }) => { const key = data.userId + ':' + data.campaignId; if (get().spins.has(key)) throw new KnownError('P2002'); const row = { id: 'spin-' + ++sequence, createdAt: new Date(), usedAt: null, ...data }; get().spins.set(key, row); write(); return row },
      },
    }
  }
  const prisma = adapter(() => state, () => version++)
  prisma.$transaction = async (work, options) => {
    assert.equal(options.isolationLevel, 'Serializable')
    const base = version, snapshot = structuredClone(state); let written = false
    const result = await work(adapter(() => snapshot, () => { written = true }))
    if (written) { if (base !== version) { conflicts++; throw new KnownError('P2034') } state = snapshot; version++ }
    return result
  }
  const deps = { '@/lib/prisma': { prisma }, './validation': validation, './wheel-config': config, '@prisma/client': { Prisma: { PrismaClientKnownRequestError: KnownError } } }
  const campaigns = load('lib/community/campaigns.ts', deps)
  const wheel = load('lib/community/wheel.ts', { ...deps, __Date: Clock, crypto: { randomInt: () => { draws++; return 0 } } })
  return { campaigns, wheel, prisma, get state() { return state }, get draws() { return draws }, get conflicts() { return conflicts } }
}
test('campaign copy, periods and prize weights are validated server-side', () => {
  const s = store()
  assert.equal(s.campaigns.campaignData(input()).title, 'THE FIRST ONES IN')
  for (const invalid of [{ title: '<b>title</b>' }, { subtitle: '' }, { description: 'x'.repeat(1501) }, { endsAt: 'bad' }, { startsAt: '2030-01-02', endsAt: '2030-01-01' }]) assert.throws(() => s.campaigns.campaignData(input(invalid)), validation.CommunityError)
  for (const invalid of [[], [{ percent: 99, weight: 1 }], config.wheelPrizes.map(p => ({ ...p, weight: 0 })), config.wheelPrizes.map(p => ({ ...p, weight: 1.5 }))]) assert.throws(() => config.prizeConfig(invalid))
})
test('manual selection respects start/end boundaries and ignores inactive campaigns', async () => {
  const s = store(), now = new Date()
  const active = await s.campaigns.saveCampaign(input({ startsAt: new Date(now - 1000).toISOString(), endsAt: new Date(+now + 60000).toISOString() }))
  assert.equal((await s.wheel.wheelState('u')).campaign.id, active.id)
  await s.campaigns.saveCampaign({ active: false }, active.id)
  assert.equal((await s.wheel.wheelState('u')).campaign, null)
  await s.campaigns.saveCampaign({ active: true, startsAt: new Date(+now + 60000).toISOString(), endsAt: null }, active.id)
  assert.equal((await s.wheel.wheelState('u')).campaign.id, active.id)
  await assert.rejects(() => s.wheel.spinWheel('u'), e => e.status === 409 && e.message === 'La campaña todavía no inicia.')
  await s.campaigns.saveCampaign({ startsAt: null, endsAt: new Date(now - 1000).toISOString() }, active.id)
  await assert.rejects(() => s.wheel.spinWheel('u'), e => e.status === 409); assert.equal(s.draws, 0)
})
test('activation replaces other campaigns; concurrent activations retry to a single selection', async () => {
  const s = store(), first = await s.campaigns.saveCampaign(input())
  const next = await s.campaigns.saveCampaign(input({ name: 'Siguiente' }))
  assert.equal(s.state.campaigns.get(first.id).active, false); assert.equal(s.state.campaigns.get(next.id).active, true)
  await Promise.all([s.campaigns.saveCampaign({ active: true }, first.id), s.campaigns.saveCampaign({ active: true }, next.id)])
  assert.equal([...s.state.campaigns.values()].filter(c => c.active).length, 1); assert.ok(s.conflicts > 0)
})
test('historical overlaps resolve consistently by latest creation and ID without data migration', async () => {
  const s = store(), first = await s.campaigns.saveCampaign(input()), second = await s.campaigns.saveCampaign(input())
  s.state.campaigns.get(first.id).active = true
  s.state.campaigns.get(first.id).createdAt = new Date('2026-01-01'); s.state.campaigns.get(second.id).createdAt = new Date('2026-02-01')
  assert.equal((await s.wheel.wheelState('u')).campaign.id, second.id)
})
test('weighted draw uses persisted ADMIN settings, and existing spin survives copy/config edits', async () => {
  const s = store(), prizeWeights = config.wheelPrizes.map(p => ({ ...p, weight: p.percent === 10 ? 10 : 1 }))
  assert.equal(s.wheel.choosePrize(() => 12, prizeWeights), 10)
  const c = await s.campaigns.saveCampaign(input({ prizeWeights })), first = await s.wheel.spinWheel('u')
  await s.campaigns.saveCampaign({ title: 'NEW COPY', prizeWeights: config.wheelPrizes }, c.id)
  const second = await s.wheel.spinWheel('u')
  assert.deepEqual(second.spin, first.spin); assert.equal(s.draws, 1); assert.equal(second.campaign.title, 'NEW COPY')
  await s.campaigns.saveCampaign({ active: false }, c.id)
  const closed = await s.wheel.wheelState('u'); assert.equal(closed.campaign, null); assert.equal(closed.spin, null); assert.deepEqual([...s.state.spins.values()][0], first.spin)
  await assert.rejects(() => s.wheel.spinWheel('u'), e => e.status === 409)
})
test('concurrent spins keep exactly one persisted result per member/campaign', async () => {
  const s = store(); await s.campaigns.saveCampaign(input())
  const results = await Promise.all([s.wheel.spinWheel('u'), s.wheel.spinWheel('u')])
  assert.equal(s.state.spins.size, 1); assert.deepEqual(results[0].spin, results[1].spin)
})
test('campaign mutations use ADMIN guard, support partial PATCH and retain spin history', async () => {
  const s = store(); let user = { id: 'admin', role: 'ADMIN' }
  const api = load('lib/community/api.ts', { '@/lib/auth': { getCurrentUser: async () => user }, '@/lib/prisma': { prisma: s.prisma }, './validation': validation, 'next/server': { NextResponse: { json: Response.json } }, '@prisma/client': { Prisma: { PrismaClientKnownRequestError: KnownError } } })
  const deps = { '@/lib/community/api': api, '@/lib/prisma': { prisma: s.prisma }, '@/lib/community/validation': validation, '@/lib/community/campaigns': s.campaigns }
  const collection = load('app/api/admin/community/campaigns/route.ts', deps), item = load('app/api/admin/community/campaigns/[id]/route.ts', deps)
  const request = (method, body) => new Request('https://mbe.test/api/admin/community/campaigns', { method, body: JSON.stringify(body) })
  const created = await collection.POST(request('POST', input())); assert.equal(created.status, 200); const c = await created.json()
  const spin = await s.wheel.spinWheel('u')
  for (const update of [{ title: 'EDITED COPY' }, { active: false }, { active: true }]) assert.equal((await item.PATCH(request('PATCH', update), { params: { id: c.id } })).status, 200)
  assert.equal(s.state.campaigns.get(c.id).title, 'EDITED COPY'); assert.deepEqual([...s.state.spins.values()][0], spin.spin)
  user = { id: 'client', role: 'CLIENTE' }
  assert.equal((await collection.POST(request('POST', input()))).status, 403)
  assert.equal((await collection.GET()).status, 403)
  assert.equal((await item.PATCH(request('PATCH', { active: false }), { params: { id: c.id } })).status, 403)
})
function renderWheel(state) {
  const { DiscountWheel } = load('components/community/discount-wheel.tsx', { react: { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: initial => ({ current: initial }), useEffect: () => {} } })
  return renderToStaticMarkup(React.createElement(DiscountWheel, { initialState: state }))
}
test('member view renders active campaign copy and primary wheel, empty/expired states cannot spin', () => {
  const campaign = { id: 'c', name: 'Interna', title: 'ONLY INSIDE', subtitle: 'Frase visible', description: 'Motivo visible', note: 'Nota breve', startsAt: null, endsAt: null }
  const html = renderWheel({ campaign, spin: null })
  for (const text of ['ONLY INSIDE', 'Frase visible', 'Motivo visible', 'Nota breve', 'Desbloquear mi giro']) assert.ok(html.includes(text))
  const empty = renderWheel({ campaign: null, spin: null }); assert.ok(empty.includes('No hay una campaña abierta')); assert.ok(!empty.includes('<button'))
  const expired = renderWheel({ campaign: { ...campaign, endsAt: '2020-01-01' }, spin: null }); assert.ok(!expired.includes('<button'))
})
test('existing spin renders result and usage state with no second-spin button', () => {
  const campaign = { id: 'c', name: 'Legacy', startsAt: null, endsAt: null }, spin = { id: 's', campaignId: 'c', discountPercent: 5, usedAt: null }
  const html = renderWheel({ campaign, spin }); assert.ok(html.includes('Ya participaste')); assert.ok(html.includes('5% OFF')); assert.ok(html.includes('sin utilizar')); assert.ok(!html.includes('<button'))
  assert.ok(renderWheel({ campaign, spin: { ...spin, usedAt: '2026-01-01' } }).includes('marcado como utilizado'))
  assert.ok(!renderWheel({ campaign: null, spin }).includes('5% OFF'))
})
test('Community page keeps membership gate and prioritizes campaign before archive/events', async () => {
  const { default: Page } = load('app/comunidad/page.tsx', {
    'next/navigation': { redirect: url => { throw new Error(url) } }, '@/lib/community/membership': { enterCommunity: async () => ({ user: { id: 'u', username: 'Miembro' }, membership: { id: 'm' } }) },
    '@/lib/community/posts': { publishedPosts: async () => ({ posts: [], nextCursor: null }) }, '@/lib/community/wheel': { wheelState: async () => ({ campaign: null, spin: null }) },
    '@/components/community/discount-wheel': { DiscountWheel: ({ initialState }) => React.createElement('div', null, initialState.campaign ? 'CAMPAIGN' : 'EMPTY CAMPAIGN') }, '@/components/community/community-feed': { CommunityFeed: () => React.createElement('div', null, 'ARCHIVE') }, '@/components/community/community-events': { CommunityEvents: () => React.createElement('div', null, 'EVENTS') }, '@/components/store/header': { Header: () => null }, '@/components/store/footer': { Footer: () => null },
  })
  const html = renderToStaticMarkup(await Page()); assert.ok(html.indexOf('EMPTY CAMPAIGN') < html.indexOf('ARCHIVE')); assert.ok(html.indexOf('ARCHIVE') < html.indexOf('EVENTS'))
})
test('Home CTA stays neutral and LIVE red pulse is beside membership count, outside button', () => {
  const { CommunitySection } = load('components/store/community-section.tsx', { 'next/link': ({ href, children, className }) => React.createElement('a', { href, className }, children) })
  const html = renderToStaticMarkup(React.createElement(CommunitySection, { communityCount: 3 }))
  assert.ok(html.includes('href="/comunidad"')); assert.ok(html.includes('3 personas están adentro'))
  assert.ok(!html.includes('bg-[#761b2b]')); assert.ok(html.indexOf('bg-red-500') > html.indexOf('</a>')); assert.ok(html.includes('motion-safe:animate-pulse'))
})
test('new migration only adds nullable campaign fields and preserves existing prizes/unique spins', () => {
  const sql = fs.readFileSync('prisma/migrations/20261007061922_community_campaign_copy/migration.sql', 'utf8')
  assert.equal((sql.match(/ADD COLUMN/g) || []).length, 5)
  assert.ok(!/DROP|DELETE|UPDATE |NOT NULL/.test(sql)); assert.ok(sql.includes('"prizeWeights" JSONB'))
})
test('campaign Admin status distinguishes selection, scheduled start and expired end', () => {
  const { campaignStatus } = load('components/admin/community/wheel-manager.tsx', { './request': {}, '@/lib/community/wheel-config': config })
  const now = Date.parse('2030-01-01'), c = { active: true, startsAt: null, endsAt: null }
  assert.equal(campaignStatus(c, now), 'EN CURSO')
  assert.equal(campaignStatus({ ...c, active: false }, now), 'INACTIVA')
  assert.equal(campaignStatus({ ...c, startsAt: '2030-01-02' }, now), 'PROGRAMADA')
  assert.equal(campaignStatus({ ...c, endsAt: '2030-01-01' }, now), 'VENCIDA')
})
test('Admin renders campaign copy, dates and four server-supported probabilities on mobile grid', () => {
  const { WheelManager } = load('components/admin/community/wheel-manager.tsx', {
    react: { useState: initial => [initial, () => {}], useRef: initial => ({ current: initial }), useEffect: () => {}, useCallback: fn => fn },
    './request': { field: '', action: '' }, '@/lib/community/wheel-config': config,
  })
  const html = renderToStaticMarkup(React.createElement(WheelManager))
  for (const label of ['Nombre interno', 'Título visible', 'Frase principal', 'Descripción / motivo', 'Nota breve', 'Inicio opcional', 'Fin opcional', 'Premios / probabilidades']) assert.ok(html.includes(label))
  assert.equal((html.match(/25.0% probabilidad/g) || []).length, 4)
  assert.ok(html.includes('grid-cols-2')); assert.ok(html.includes('sm:grid-cols-4'))
})

test('future selected campaign is visible but cannot spin; start opens and expiry hides without erasing history',async()=>{
  const s=store(),now=Date.now()
  const old=await s.campaigns.saveCampaign(input()),oldSpin=await s.wheel.spinWheel('u')
  const future=await s.campaigns.saveCampaign(input({startsAt:new Date(now+60000).toISOString(),endsAt:new Date(now+120000).toISOString()}))
  const state=await s.wheel.wheelState('u')
  assert.equal(state.campaign.id,future.id);assert.equal(state.spin,null)
  await assert.rejects(()=>s.wheel.spinWheel('u'),e=>e.status===409&&e.message==='La campaña todavía no inicia.')
  assert.equal(s.state.spins.size,1);assert.equal(s.draws,1)
  await s.campaigns.saveCampaign({startsAt:new Date(Date.now()-60000).toISOString()},future.id)
  assert.equal((await s.wheel.spinWheel('u')).spin.campaignId,future.id)
  await s.campaigns.saveCampaign({endsAt:new Date(Date.now()-1).toISOString()},future.id)
  assert.deepEqual(await s.wheel.wheelState('u'),{campaign:null,spin:null})
  await assert.rejects(()=>s.wheel.spinWheel('u'),e=>e.status===409)
  assert.equal(s.state.spins.size,2);assert.deepEqual(s.state.spins.get('u:'+old.id),oldSpin.spin)
})
test('visible/live conditions use inclusive start and exclusive end',()=>{
  const s=store(),now=new Date('2030-01-01T18:00:00Z')
  const visible=s.wheel.visibleCampaignWhere(now),live=s.wheel.liveCampaignWhere(now)
  assert.equal(visible.active,true);assert.ok(!JSON.stringify(visible).includes('startsAt'))
  assert.deepEqual(visible.AND,[{OR:[{endsAt:null},{endsAt:{gt:now}}]}])
  assert.deepEqual(live.AND[0],{OR:[{startsAt:null},{startsAt:{lte:now}}]})
  assert.deepEqual(live.AND[1],visible.AND[0])
})
test('no start is immediately visible/spinnable; no end remains visible while selected',async()=>{
  const s=store(),campaign=await s.campaigns.saveCampaign(input())
  assert.equal((await s.wheel.wheelState('u')).campaign.id,campaign.id)
  assert.equal((await s.wheel.spinWheel('u')).spin.campaignId,campaign.id)
  await s.campaigns.saveCampaign({startsAt:'2099-01-01T00:00:00Z'},campaign.id)
  assert.equal((await s.wheel.wheelState('u')).campaign.id,campaign.id)
  await assert.rejects(()=>s.wheel.spinWheel('v'),e=>e.status===409)
})
test('scheduled UI keeps copy/prizes/wheel with disabled button/date; expiry removes wheel/result',()=>{
  const now=Date.now(),campaign={id:'future',name:'Campaign',title:'PRÓXIMO MOVIMIENTO',subtitle:'Subtitle',description:'Description',note:'Note',startsAt:new Date(now+60000).toISOString(),endsAt:new Date(now+120000).toISOString()}
  const html=renderWheel({campaign,spin:null})
  for(const text of ['PRÓXIMO MOVIMIENTO','Subtitle','Description','Note','Disponible próximamente','Disponible el','2%','4%','5%','10%'])assert.ok(html.includes(text))
  assert.match(html,/<button[^>]*disabled/);assert.ok(html.includes('conic-gradient'))
  const expired=renderWheel({campaign:{...campaign,endsAt:new Date(now-1).toISOString()},spin:{campaignId:campaign.id,discountPercent:5}})
  assert.ok(expired.includes('El próximo movimiento está por llegar.'))
  assert.ok(!expired.includes('PRÓXIMO MOVIMIENTO'));assert.ok(!expired.includes('conic-gradient'));assert.ok(!expired.includes('5% OFF'))
})
test('selected future campaign never spins older overlapping active campaign',async()=>{
  const s=store(),old=await s.campaigns.saveCampaign(input())
  const future=await s.campaigns.saveCampaign(input({startsAt:'2099-01-01T00:00:00Z'}))
  s.state.campaigns.get(old.id).active=true
  s.state.campaigns.get(old.id).createdAt=new Date('2020-01-01')
  assert.equal((await s.wheel.wheelState('u')).campaign.id,future.id)
  await assert.rejects(()=>s.wheel.spinWheel('u'),e=>e.status===409)
  assert.equal(s.draws,0)
})
test('server accepts exact startsAt and rejects/hides exact endsAt; POST preserves 409',async()=>{
  const fixed=Date.parse('2030-01-01T18:00:00Z')
  class FrozenDate extends Date { constructor(...args){super(...(args.length?args:[fixed]))} static now(){return fixed} }
  const s=store(FrozenDate),campaign=await s.campaigns.saveCampaign(input({startsAt:new Date(fixed).toISOString(),endsAt:new Date(fixed+1000).toISOString()}))
  assert.equal((await s.wheel.spinWheel('u')).spin.campaignId,campaign.id)
  await s.campaigns.saveCampaign({startsAt:new Date(fixed-1000).toISOString(),endsAt:new Date(fixed).toISOString()},campaign.id)
  assert.deepEqual(await s.wheel.wheelState('u'),{campaign:null,spin:null})
  const route=load('app/api/community/wheel/route.ts',{
    '@/lib/community/api':{member:async()=>({id:'u'}),api:async work=>{try{return Response.json(await work())}catch(e){return Response.json({error:e.message},{status:e.status||500})}}},
    '@/lib/community/wheel':s.wheel,
  })
  assert.equal((await route.POST(new Request('https://mbe.test',{method:'POST'}))).status,409)
})
test('POST blocks a selected future campaign before drawing',async()=>{
  const s=store();await s.campaigns.saveCampaign(input({startsAt:'2099-01-01T00:00:00Z'}))
  const route=load('app/api/community/wheel/route.ts',{
    '@/lib/community/api':{member:async()=>({id:'u'}),api:async work=>{try{return Response.json(await work())}catch(e){return Response.json({error:e.message},{status:e.status||500})}}},
    '@/lib/community/wheel':s.wheel,
  })
  const response=await route.POST(new Request('https://mbe.test',{method:'POST'}))
  assert.equal(response.status,409);assert.equal((await response.json()).error,'La campaña todavía no inicia.');assert.equal(s.draws,0);assert.equal(s.state.spins.size,0)
})
test('scheduled wheel always shows blocked cursor/button, including previously saved result; reaching start enables',()=>{
 const campaign={id:'scheduled',name:'MBE',startsAt:new Date(Date.now()+60000).toISOString(),endsAt:'2099-01-01T00:00:00Z'}
 const scheduled=renderWheel({campaign,spin:{id:'old',campaignId:campaign.id,discountPercent:10,usedAt:null}})
 assert.ok(scheduled.includes('Disponible próximamente'));assert.ok(scheduled.includes('disabled:cursor-not-allowed'));assert.match(scheduled,/<button[^>]*disabled/)
 const open=renderWheel({campaign:{...campaign,startsAt:new Date(Date.now()-1).toISOString()},spin:null})
 assert.ok(open.includes('Desbloquear mi giro'));assert.ok(!/<button[^>]* disabled=/.test(open))
})
