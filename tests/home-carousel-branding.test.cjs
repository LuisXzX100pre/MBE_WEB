const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
function load(file, dependencies = {}, globals = {}) {
  const key = require('node:path').resolve(file), cacheKey = Symbol.for('mbe.test.modules')
  const cache = dependencies[cacheKey] ||= new Map()
  if (cache.has(key)) return cache.get(key)

  const mod = { exports: {} }
  cache.set(key, mod.exports)
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'exports', 'setTimeout', 'clearTimeout', 'window', 'document', js)(name => name === 'server-only' ? {} : dependencies[name] || (() => { const path = require('node:path'); const base = name.startsWith('@/') ? path.resolve(name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null; const local = base && [base + '.ts', base + '.tsx'].find(candidate => fs.existsSync(candidate)); return local ? load(local, dependencies, globals) : require(name) })(), mod.exports, globals.setTimeout || setTimeout, globals.clearTimeout || clearTimeout, globals.window, globals.document)
  return mod.exports
}
const social = load('lib/social-links.ts')
const hero = load('lib/home-hero-slides.ts', { './social-links': social })
const Link = ({ children, href, className }) => React.createElement('a', { href, className }, children)
const Image = ({ src, alt }) => React.createElement('img', { src, alt })
const product = overrides => ({ id: 'p', name: 'WHITE IRIS', description: 'Pieza original', price: 450, stock: 3, sizes: [], images: [{ url: '/logo.png' }], category: { name: 'Playeras' }, ...overrides })
const campaign = { name: 'Interna', title: 'THE FIRST ONES IN', subtitle: 'Frase de campaña', description: 'Motivo de campaña', note: 'Nota' }
for (const [label, overrides, soldOut] of [
  ['simple available', { stock: 3 }, false], ['simple sold out', { stock: 0 }, true], ['negative stock', { stock: -1 }, true],
  ['size inventory wins over aggregate zero', { stock: 0, sizes: [{ stock: 2 }, { stock: 0 }] }, false],
  ['empty sizes win over aggregate positive', { stock: 50, sizes: [{ stock: 0 }, { stock: 0 }] }, true],
]) test(label, () => { const slide = hero.buildHeroSlides([product(overrides)], null)[0]; assert.equal(slide.soldOut, soldOut); assert.equal(slide.ctaHref, '/productos/p') })
test('real product data, five-slide interleaving and finite count', () => {
  const slides = hero.buildHeroSlides([1,2,3,4].map(id => product({ id: String(id) })), campaign)
  assert.deepEqual(slides.map(s => s.type), ['PRODUCT', 'COMMUNITY', 'PRODUCT', 'SOCIAL', 'PRODUCT'])
  assert.equal(slides[0].priceText, '$450.00 MXN'); assert.equal(slides[0].image, '/logo.png'); assert.equal(slides[0].eyebrow, 'Playeras')
})
test('Community uses campaign copy or intentional evergreen and always enters existing access flow', () => {
  const active = hero.buildHeroSlides([], campaign)[0]
  assert.equal(active.title, campaign.title); assert.ok(active.subtitle.includes(campaign.subtitle)); assert.ok(active.subtitle.includes(campaign.description)); assert.equal(active.ctaHref, '/comunidad')
  const evergreen = hero.buildHeroSlides([], null)[0]; assert.equal(evergreen.title, 'Lo que no sale afuera.'); assert.equal(evergreen.ctaHref, '/comunidad')
})
test('social slide and Footer share exact unchanged official links', () => {
  const slides = hero.buildHeroSlides([], null), slide = slides.find(s => s.type === 'SOCIAL')
  assert.equal(slide.ctaHref, 'https://www.instagram.com/mbemighty?igsh=MTM4NTB3ZXdxZmlyeQ==')
  assert.equal(slide.secondaryCta.href, 'https://www.tiktok.com/@mbemighty?_r=1&_t=ZS-95a3Ikf5hum')
  const { Footer } = load('components/store/footer.tsx', { 'next/link': Link, '@/lib/social-links': social })
  const html = renderToStaticMarkup(React.createElement(Footer)); assert.ok(html.includes(slide.ctaHref)); assert.ok(html.includes(slide.secondaryCta.href.replaceAll('&','&amp;')))
})
test('zero products creates Community/social/brand rather than missing-image slide', () => { assert.deepEqual(hero.buildHeroSlides([], null).map(s => s.type), ['COMMUNITY','SOCIAL','BRAND']) })
test('next/previous index wraps safely for empty, single and changed slide counts', () => {
  assert.equal(hero.carouselIndex(-1, 5), 4); assert.equal(hero.carouselIndex(5, 5), 0); assert.equal(hero.carouselIndex(99, 1), 0); assert.equal(hero.carouselIndex(9, 0), 0)
  for (let n = 1; n <= 5; n++) for (let i = -25; i <= 25; i++) assert.ok(hero.carouselIndex(i,n) >= 0 && hero.carouselIndex(i,n) < n)
})
const drop = { id: 'drop', name: 'Drop', description: 'Nuevo', dropName: 'MBE DROP', price: 450, releaseAt: '2099-01-01', category: { name: 'Playeras', slug: 'playeras' }, images: [] }
for (const [name, nextDrop, recentDrop, expected] of [['next has priority over recent and carousel', drop, drop, 'COUNTDOWN'], ['recent has priority over carousel', null, drop, 'Drop estrenado'], ['carousel only when neither drop exists', null, null, 'CAROUSEL']]) {
  test(name, () => {
    const { HomeHeroSwitcher } = load('components/store/home-hero-switcher.tsx', {
      'next/link': Link, 'next/image': Image, 'next/navigation': { useRouter: () => ({ refresh() {} }) },
      '@/components/store/drop-countdown': { DropCountdown: () => React.createElement('div', null, 'COUNTDOWN') },
      '@/components/store/home-hero-carousel': { HomeHeroCarousel: () => React.createElement('div', null, 'CAROUSEL') }, '@/lib/audio-unlock': {},
    })
    const html = renderToStaticMarkup(React.createElement(HomeHeroSwitcher, { nextDrop, recentDrop, heroSlides: hero.buildHeroSlides([], campaign) }))
    assert.ok(html.includes(expected)); if (expected !== 'CAROUSEL') assert.ok(!html.includes('CAROUSEL')); if (expected !== 'COUNTDOWN') assert.ok(!html.includes('COUNTDOWN'))
  })
}
for (const hasDrop of [false, true]) test('Home campaign lookup is read-only and only needed for carousel: drop=' + hasDrop, async () => {
  let campaignReads = 0, props
  const { default: Home } = load('app/page.tsx', {
    'next/link': Link, 'next/image': Image, '@/lib/home-hero-slides': hero, '@/lib/community/wheel': { visibleCampaignWhere: () => ({ active: true }) },
    '@/lib/release-drops': { releaseExpiredDrops: async () => {} }, '@/lib/drop': { isWithinDropWindow: () => false },
    '@/lib/prisma': { prisma: { product: { findMany: async args => { if(args.take === 3) { assert.equal(args.where.status, 'ACTIVE'); assert.equal(args.include.sizes,true); return [product()] } return [] }, findFirst: async () => hasDrop ? drop : null }, category: { findMany: async () => [] }, communityMembership: { count: async () => 3 }, communityWheelCampaign: { findFirst: async args => { campaignReads++; assert.equal(args.where.active,true); assert.deepEqual(Object.keys(args.select).sort(), ['description','name','note','subtitle','title']); return campaign } } } },
    '@/components/store/header': { Header: () => null }, '@/components/store/footer': { Footer: () => null }, '@/components/store/product-card': { ProductCard: () => null }, '@/components/store/community-section': { CommunitySection: () => null }, '@/components/store/home-hero-switcher': { HomeHeroSwitcher: value => { props = value; return React.createElement('div',null,'HERO') } },
  })
  renderToStaticMarkup(await Home()); assert.equal(campaignReads, hasDrop ? 0 : 1); assert.equal(!!props.nextDrop,hasDrop); assert.equal(props.heroSlides[0].type,'PRODUCT')
})
function carouselHarness(slides = hero.buildHeroSlides([product()], campaign), prefersReduced = false) {
  let index = 0, nextTimer = 0, tree, currentSlides = slides
  const slots = [], effects = [], timers = new Map(), listeners = new Map()
  const preference = { matches: prefersReduced, addEventListener: (name, fn) => listeners.set('motion', fn), removeEventListener: () => listeners.delete('motion') }
  const doc = { hidden: false, addEventListener: (name, fn) => listeners.set(name,fn), removeEventListener: name => listeners.delete(name) }
  const react = {
    useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial; return [slots[slot], value => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value }] },
    useRef(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot] },
    useEffect(work,deps) { const slot = index++, previous = slots[slot]; if (!previous || deps.some((dep,i) => !Object.is(dep,previous.deps[i]))) effects.push(() => { previous?.cleanup?.(); slots[slot] = { deps, cleanup: work() } }) },
  }
  const { HomeHeroCarousel } = load('components/store/home-hero-carousel.tsx', { react, 'next/link': Link, 'next/image': Image, '@/lib/home-hero-slides': hero, './home-hero-carousel.module.css': { enter: 'enter', enterBack: 'enterBack' } }, {
    window: { matchMedia: () => preference }, document: doc,
    setTimeout: (fn,ms) => { const timer = ++nextTimer; timers.set(timer,{fn,ms}); return timer }, clearTimeout: timer => timers.delete(timer),
  })
  function render(nextSlides = currentSlides) { currentSlides = nextSlides; index = 0; tree = HomeHeroCarousel({ slides: currentSlides }); while(effects.length) effects.shift()(); return tree }
  function elements(node=tree) { if(!React.isValidElement(node)) return []; return [node,...React.Children.toArray(node.props.children).flatMap(elements)] }
  render(); render()
  return { render, timers, listeners, preference, doc, elements, get root() { return tree },
    button: label => elements().find(e => e.type === 'button' && e.props['aria-label'] === label),
    html: () => renderToStaticMarkup(tree), advance: () => { const [id,timer] = [...timers.entries()][0]; timers.delete(id); timer.fn(); render() },
    unmount: () => slots.forEach(slot => slot?.cleanup?.()),
  }
}
test('autoplay advances right every six seconds, wraps and owns one cleaned timer', () => {
  const ui = carouselHarness(); assert.equal(ui.timers.size,1); assert.equal([...ui.timers.values()][0].ms,6000)
  const count = ui.elements().find(e => e.props.role === 'group').props['aria-label'].split(' de ')[1]
  for(let i=0;i<Number(count);i++) { ui.advance(); assert.equal(ui.timers.size,1) }
  assert.ok(ui.html().includes('WHITE IRIS')); ui.unmount(); assert.equal(ui.timers.size,0); assert.equal(ui.listeners.size,0)
})
test('hover, focus, background tab and explicit pause suspend and resume autoplay', () => {
  const ui = carouselHarness()
  ui.root.props.onPointerEnter({pointerType:'mouse'}); ui.render(); assert.equal(ui.timers.size,0)
  ui.root.props.onPointerLeave({pointerType:'mouse'}); ui.render(); assert.equal(ui.timers.size,1)
  ui.root.props.onFocusCapture(); ui.render(); assert.equal(ui.timers.size,0)
  ui.root.props.onBlurCapture({currentTarget:{contains:()=>false},relatedTarget:null}); ui.render(); assert.equal(ui.timers.size,1)
  ui.doc.hidden=true; ui.listeners.get('visibilitychange')(); ui.render(); assert.equal(ui.timers.size,0)
  ui.doc.hidden=false; ui.listeners.get('visibilitychange')(); ui.render(); assert.equal(ui.timers.size,1)
  ui.button('Pausar rotación automática').props.onClick(); ui.render(); assert.equal(ui.timers.size,0)
  ui.button('Reanudar rotación automática').props.onClick(); ui.render(); assert.equal(ui.timers.size,1); ui.unmount()
})
test('reduced motion disables autoplay initially and after preference changes, manual navigation remains', () => {
  const ui = carouselHarness(undefined,true); assert.equal(ui.timers.size,0)
  ui.button('Slide siguiente').props.onClick(); ui.render(); assert.ok(ui.html().includes(campaign.title)); assert.equal(ui.timers.size,0)
  ui.preference.matches=false; ui.listeners.get('motion')(); ui.render(); assert.equal(ui.timers.size,1)
  ui.preference.matches=true; ui.listeners.get('motion')(); ui.render(); assert.equal(ui.timers.size,0); ui.unmount()
})
test('next, previous, dots and changing slide count cannot access undefined slide', () => {
  const ui = carouselHarness(); ui.button('Slide anterior').props.onClick(); ui.render(); assert.ok(ui.html().includes('Antes del próximo movimiento.'))
  ui.button('Slide siguiente').props.onClick(); ui.render(); assert.ok(ui.html().includes('WHITE IRIS'))
  ui.button('Ir al slide 2: THE FIRST ONES IN').props.onClick(); ui.render(); assert.ok(ui.html().includes(campaign.title)); assert.equal(ui.timers.size,1)
  ui.render([hero.buildHeroSlides([],null)[0]]); assert.ok(ui.html().includes('Lo que no sale afuera.')); assert.equal(ui.timers.size,0)
  ui.render([]); assert.ok(!ui.html().includes('Sin imagen principal')); ui.unmount()
})
test('horizontal touch swipe navigates once, pauses while dragging, cancels vertical gesture and suppresses accidental CTA', () => {
  const ui = carouselHarness()
  const start = { pointerType:'touch',isPrimary:true,pointerId:1,clientX:220,clientY:100 }
  ui.root.props.onPointerDown(start); ui.render(); assert.equal(ui.timers.size,0)
  ui.root.props.onPointerUp({...start,clientX:80,clientY:110}); ui.render(); assert.ok(ui.html().includes(campaign.title)); assert.equal(ui.timers.size,1)
  let prevented=false; ui.root.props.onClickCapture({preventDefault:()=>{prevented=true},stopPropagation(){}}); assert.equal(prevented,true)
  ui.root.props.onPointerDown(start); ui.render(); ui.root.props.onPointerUp({...start,clientX:210,clientY:220}); ui.render(); assert.ok(ui.html().includes(campaign.title))
  ui.root.props.onPointerDown(start); ui.render(); ui.root.props.onPointerCancel(); ui.render(); assert.equal(ui.timers.size,1); ui.unmount()
})
test('product SOLD OUT never renders Disponible; social opens official links safely', () => {
  const ui = carouselHarness(hero.buildHeroSlides([product({stock:0})],null)); const html=ui.html(); assert.ok(html.includes('SOLD OUT')); assert.ok(!html.includes('Disponible')); assert.ok(html.includes('href="/productos/p"'))
  ui.button('Ir al slide 3: Antes del próximo movimiento.').props.onClick(); ui.render(); assert.ok(ui.html().includes('target="_blank"')); assert.ok(ui.html().includes('noopener noreferrer')); ui.unmount()
})
test('metadata title and all icon URLs use MBE; App Router icon exactly matches validated square source', () => {
  const { metadata } = load('app/layout.tsx', { 'next/font/google': { Inter:()=>({variable:'inter'}),Space_Mono:()=>({variable:'mono'}) }, './globals.css':{}, '@/contexts/auth-context':{}, '@/contexts/cart-context':{}, '@/components/ui/toaster':{}, '@/components/audio-unlock-provider':{} })
  assert.equal(metadata.title,'Sitio web oficial de MBE'); assert.equal(metadata.openGraph.title,metadata.title); assert.equal(metadata.openGraph.siteName,'MBE')
  assert.deepEqual(metadata.icons,{icon:'/ICONO_LOGO.png',shortcut:'/ICONO_LOGO.png',apple:'/ICONO_LOGO.png'})
  const source=fs.readFileSync('public/ICONO_LOGO.png'); assert.equal(source.subarray(0,8).toString('hex'),'89504e470d0a1a0a'); assert.equal(source.readUInt32BE(16),1024); assert.equal(source.readUInt32BE(20),1024)
  assert.deepEqual(fs.readFileSync('app/icon.png'),source); assert.equal(fs.existsSync('app/favicon.ico'),false)
})
test('available product renders availability and reduced-motion CSS suppresses transitions', () => {
  const ui=carouselHarness(hero.buildHeroSlides([product()],null)); assert.ok(ui.html().includes('Disponible')); assert.ok(!ui.html().includes('SOLD OUT')); ui.unmount()
  const css=fs.readFileSync('components/store/home-hero-carousel.module.css','utf8'); assert.ok(css.includes('prefers-reduced-motion: reduce')); assert.ok(css.includes('animation: none'))
})

test('Home uses visible future campaign copy without enabling a spin or changing hero priority',async()=>{
  const scheduled={...campaign,startsAt:'2099-01-01T00:00:00Z',endsAt:'2099-01-02T00:00:00Z'}
  const wheel=load('lib/community/wheel.ts',{'@/lib/prisma':{prisma:{}}})
  let props,reads=0
  const {default:Home}=load('app/page.tsx',{
    'next/link':Link,'next/image':Image,'@/lib/community/wheel':{visibleCampaignWhere:wheel.visibleCampaignWhere},'@/lib/home-hero-slides':hero,
    '@/lib/release-drops':{releaseExpiredDrops:async()=>{}},'@/lib/drop':{isWithinDropWindow:()=>false},
    '@/lib/prisma':{prisma:{product:{findMany:async()=>[],findFirst:async()=>null},category:{findMany:async()=>[]},communityMembership:{count:async()=>3},communityWheelCampaign:{findFirst:async({where})=>{
      reads++;assert.equal(where.active,true);assert.ok(!JSON.stringify(where).includes('startsAt'))
      assert.ok(new Date(scheduled.endsAt)>where.AND[0].OR[1].endsAt.gt);return scheduled
    }}}},
    '@/components/store/header':{Header:()=>null},'@/components/store/footer':{Footer:()=>null},'@/components/store/product-card':{ProductCard:()=>null},'@/components/store/community-section':{CommunitySection:()=>null},
    '@/components/store/home-hero-switcher':{HomeHeroSwitcher:value=>{props=value;return React.createElement('div',null,'HERO')}},
  })
  renderToStaticMarkup(await Home());assert.equal(reads,1)
  const slide=props.heroSlides.find(s=>s.type==='COMMUNITY')
  assert.equal(slide.title,scheduled.title);assert.ok(slide.subtitle.includes(scheduled.description));assert.equal(slide.ctaHref,'/comunidad')
  assert.equal(props.nextDrop,null);assert.equal(props.recentDrop,null)
})