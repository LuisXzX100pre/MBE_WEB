const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(file, dependencies = {}) {
  const mod = { exports: {} }
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  new Function('require', 'exports', js)(name => name === 'server-only' ? {} : dependencies[name] || require(name), mod.exports)
  return mod.exports
}
function membershipStore() {
  const rows = new Map()
  let session = { id: 'session-user', username: 'inside' }, lastCall
  const prisma = { communityMembership: {
    findUnique: async ({ where }) => rows.get(where.userId) || null,
    updateMany: async input => {
      lastCall = input
      const row = rows.get(input.where.userId)
      if (!row) return { count: 0 }
      Object.assign(row, input.data); return { count: 1 }
    },
  } }
  const { enterCommunity } = load('lib/community/membership.ts', {
    '@/lib/prisma': { prisma }, '@/lib/auth': { getCurrentUser: async () => session },
  })
  return { enterCommunity, rows, setSession: user => { session = user }, get lastCall() { return lastCall } }
}
test('repeated and concurrent visits never grant membership', async () => {
  const store = membershipStore()
  const results = await Promise.all(Array.from({ length: 10 }, () => store.enterCommunity()))
  assert.equal(store.rows.size, 0)
  assert.ok(results.every(result => result.user.id === 'session-user' && result.membership === null))
})
test('existing membership keeps joinedAt while lastSeenAt advances', async () => {
  const store = membershipStore(), joinedAt = new Date('2026-01-01')
  store.rows.set('session-user', { id: 'm', userId: 'session-user', joinedAt, lastSeenAt: joinedAt })
  const result = await store.enterCommunity()
  assert.equal(result.membership.joinedAt, joinedAt)
  assert.ok(result.membership.lastSeenAt > joinedAt)
  assert.deepEqual(Object.keys(store.lastCall.data), ['lastSeenAt'])
})
test('userId comes from session and supplied arguments cannot override it', async () => {
  const store = membershipStore()
  store.rows.set('session-user', { id: 'm', userId: 'session-user' })
  await store.enterCommunity({ userId: 'forged-user' })
  assert.equal(store.lastCall.where.userId, 'session-user')
  assert.ok(!store.rows.has('forged-user'))
})
test('anonymous visitors cannot create memberships', async () => {
  const store = membershipStore(); store.setSession(null)
  assert.deepEqual(await store.enterCommunity(), { user: null, membership: null })
  assert.equal(store.rows.size, 0)
})

const Link = ({ children, href }) => React.createElement('a', { href }, children)
const { CommunitySection } = load('components/store/community-section.tsx', { 'next/link': Link })
test('membership counter renders correct zero, singular and plural labels', () => {
  for (const [count, label] of [[0, '0 personas están adentro'], [1, '1 persona está adentro'], [27, '27 personas están adentro']]) {
    const html = renderToStaticMarkup(React.createElement(CommunitySection, { communityCount: count }))
    assert.ok(html.includes(label))
    assert.ok(html.includes('Comunidad Adentro') && html.includes('href="/comunidad"'))
  }
})
test('Home counts memberships server-side and renders Community before the existing hero', async () => {
  let countCalls = 0
  const placeholder = label => () => React.createElement('div', null, label)
  const { default: HomePage } = load('app/page.tsx', {
    'next/link': Link, 'next/image': placeholder('image'),
    '@/components/store/header': { Header: placeholder('HEADER') },
    '@/components/store/footer': { Footer: placeholder('FOOTER') },
    '@/components/store/product-card': { ProductCard: placeholder('product') },
    '@/components/store/community-section': { CommunitySection },
    '@/components/store/home-hero-switcher': { HomeHeroSwitcher: placeholder('DROP HERO') },
    '@/lib/prisma': { prisma: {
      product: { findMany: async () => [], findFirst: async () => null },
      category: { findMany: async () => [] },
      communityMembership: { count: async () => { countCalls++; return 27 } },
      user: { count: () => { throw new Error('Must never count User') } },
    } },
    '@/lib/release-drops': { releaseExpiredDrops: async () => {} },
    '@/lib/drop': { isWithinDropWindow: () => false },
  })
  const html = renderToStaticMarkup(await HomePage())
  assert.equal(countCalls, 1)
  assert.ok(html.includes('27 personas están adentro'))
  assert.ok(html.indexOf('HEADER') < html.indexOf('Comunidad Adentro'))
  assert.ok(html.indexOf('Comunidad Adentro') < html.indexOf('DROP HERO'))
  assert.equal(html.match(/Comunidad Adentro/g).length, 1)
})
test('Community page gates content by membership and redirects anonymous visitors', async () => {
  let user = null, membership = null, entries = 0, feedCalls = 0
  const empty = () => null
  const { default: CommunityPage } = load('app/comunidad/page.tsx', {
    'next/navigation': { redirect: location => { throw new Error(location) } },
    '@/lib/community/membership': { enterCommunity: async () => { entries++; return { user, membership } } },
    '@/lib/community/wheel': { wheelState: async () => ({ campaign: null, spin: null }) },
    '@/lib/community/posts': { publishedPosts: async () => { feedCalls++; return { posts: [], nextCursor: null } } },
    '@/components/store/header': { Header: empty }, '@/components/store/footer': { Footer: empty },
    '@/components/community/community-feed': { CommunityFeed: empty },
    '@/components/community/discount-wheel': { DiscountWheel: empty },
    '@/components/community/community-events': { CommunityEvents: empty },
  })
  await assert.rejects(() => CommunityPage(), /login\?next=\/comunidad/)
  assert.equal(feedCalls, 0)
  user = { id: 'session-user', username: 'member' }
  await assert.rejects(() => CommunityPage(), /comunidad\/acceso/)
  assert.equal(feedCalls, 0)
  membership = { id: 'm' }
  const html = renderToStaticMarkup(await CommunityPage())
  assert.ok(html.includes('Bienvenido adentro, member'))
  assert.equal(entries, 3); assert.equal(feedCalls, 1)
})
test('Prisma enforces unique membership per user and optional User relation', () => {
  const { Prisma } = require('@prisma/client')
  const membership = Prisma.dmmf.datamodel.models.find(m => m.name === 'CommunityMembership')
  assert.ok(membership.fields.find(f => f.name === 'userId').isUnique)
  const relation = Prisma.dmmf.datamodel.models.find(m => m.name === 'User').fields.find(f => f.name === 'communityMembership')
  assert.ok(!relation.isRequired && !relation.isList)
})
