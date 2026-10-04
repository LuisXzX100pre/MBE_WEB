const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, dependencies = {}) {
  const module = { exports: {} }
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  new Function('require', 'exports', source)(name => name === 'server-only' ? {} : dependencies[name] || require(name), module.exports)
  return module.exports
}
const validation = load('lib/community/validation.ts')
class KnownError extends Error { constructor(code) { super(code); this.code = code } }
function wheelStore() {
  const stored = new Map()
  let draws = 0, active = true
  const campaign = { id: 'campaign', name: 'Drop', active: true }
  const tx = {
    communityWheelCampaign: { findFirst: async () => active ? campaign : null },
    communityWheelSpin: {
      findUnique: async ({ where }) => stored.get(where.userId_campaignId.userId) || null,
      create: async ({ data }) => {
        if (stored.has(data.userId)) throw new KnownError('P2002')
        const spin = { id: 'spin-' + data.userId, ...data, usedAt: null }
        stored.set(data.userId, spin)
        return spin
      },
    },
  }
  const prisma = { ...tx, $transaction: async work => work(tx) }
  const wheel = load('lib/community/wheel.ts', {
    '@/lib/prisma': { prisma }, './validation': validation,
    '@prisma/client': { Prisma: { PrismaClientKnownRequestError: KnownError } },
    crypto: { randomInt: max => { draws++; return Math.min(2, max - 1) } },
  })
  return { wheel, stored, get draws() { return draws }, close: () => { active = false } }
}
test('comments reject empty, HTML, control characters and excessive length', () => {
  for (const input of ['', '   ', '<script>alert(1)</script>', 'x'.repeat(1001), '\u0000']) assert.throws(() => validation.text(input, 'Comentario', 1000), validation.CommunityError)
  assert.equal(validation.text('  MBE & familia  ', 'Comentario', 1000), 'MBE & familia')
})
test('invalid date ranges and JSON are rejected', async () => {
  assert.throws(() => validation.period(new Date('2026-10-04'), new Date('2026-10-03')))
  assert.throws(() => validation.date('no-date'))
  await assert.rejects(() => validation.body(new Request('https://mbe.test', { method: 'POST', body: '[]' })))
})
test('all wheel prizes are selected only from configured server weights', () => {
  const { wheel } = wheelStore()
  assert.deepEqual([0, 1, 2, 3].map(i => wheel.choosePrize(() => i)), [2, 4, 5, 10])
})
test('repeat spins reuse persisted result without drawing again', async () => {
  const store = wheelStore()
  const first = await store.wheel.spinWheel('session-user')
  const second = await store.wheel.spinWheel('session-user')
  assert.equal(first.spin.discountPercent, 5)
  assert.deepEqual(second, first)
  assert.equal(store.draws, 1)
})
test('concurrent insert conflict returns the winning saved result', async () => {
  const store = wheelStore()
  const results = await Promise.all(Array.from({ length: 12 }, () => store.wheel.spinWheel('same-user')))
  assert.equal(store.stored.size, 1)
  assert.ok(results.every(r => r.spin.id === results[0].spin.id && r.spin.discountPercent === results[0].spin.discountPercent))
})
test('inactive campaign cannot generate a spin', async () => {
  const store = wheelStore(); store.close()
  await assert.rejects(() => store.wheel.spinWheel('u'), validation.CommunityError)
  assert.equal(store.draws, 0)
})
test('wheel endpoint ignores forged userId and discountPercent', async () => {
  let received
  const route = load('app/api/community/wheel/route.ts', {
    '@/lib/community/api': { member: async () => ({ id: 'session-user' }), api: async work => work() },
    '@/lib/community/wheel': { spinWheel: async userId => { received = userId; return { spin: { discountPercent: 4 } } } },
  })
  const result = await route.POST(new Request('https://mbe.test/api/community/wheel', { method: 'POST', body: JSON.stringify({ userId: 'other', discountPercent: 10, prize: 10 }) }))
  assert.equal(received, 'session-user'); assert.equal(result.spin.discountPercent, 4)
})
test('API guard requires session, ADMIN and same origin for mutations', async () => {
  let user = null
  const { member } = load('lib/community/api.ts', {
    '@/lib/auth': { getCurrentUser: async () => user }, './validation': validation,
    'next/server': { NextResponse: { json: Response.json } },
    '@prisma/client': { Prisma: { PrismaClientKnownRequestError: KnownError } },
  })
  await assert.rejects(() => member(), e => e.status === 401)
  user = { id: 'u', role: 'CLIENTE' }
  await assert.rejects(() => member(undefined, true), e => e.status === 403)
  user.role = 'ADMIN'
  assert.equal((await member(undefined, true)).id, 'u')
  await assert.rejects(() => member(new Request('https://mbe.test/api/community/wheel', { method: 'POST', headers: { origin: 'https://evil.test' } })), e => e.status === 403)
})
test('Prisma declares unique per-user campaign spins and unique ticket codes', () => {
  const { Prisma } = require('@prisma/client')
  assert.ok(Prisma.dmmf.datamodel.models.find(m => m.name === 'CommunityWheelSpin').uniqueFields.some(f => f.join(',') === 'userId,campaignId'))
  assert.ok(Prisma.dmmf.datamodel.models.find(m => m.name === 'CommunityTicket').fields.find(f => f.name === 'code').isUnique)
})
