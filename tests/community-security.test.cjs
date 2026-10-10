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
    '@/lib/prisma': { prisma }, './validation': validation, './wheel-config': load('lib/community/wheel-config.ts', { './validation': validation }),
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
    '@/lib/prisma': { prisma: { communityMembership: { findUnique: async () => null } } },
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

test('tickets validate percentages, expired events and expiry bounds', async () => {
  let active = true, end = new Date(Date.now() + 86400000), assigned
  const tx = {
    communityEvent: { findUnique: async () => ({ id: 'event', active, endsAt: end }) },
    user: { findUnique: async ({ where }) => where.username === 'member' ? { id: 'db-user' } : null },
    communityTicket: { create: async ({ data }) => { assigned = data; return data } },
  }
  const events = load('lib/community/events.ts', { './validation': validation, '@/lib/prisma': { prisma: { $transaction: async work => work(tx) } } })
  for (const value of [0, 101, 2.5, '10', null]) assert.throws(() => events.ticketPercent(value))
  const input = { eventId: 'event', username: 'member', userId: 'forged', discountPercent: 5 }
  const ticket = await events.assignTicket(input)
  assert.equal(assigned.userId, 'db-user'); assert.equal(ticket.expiresAt, end)
  assert.match(ticket.code, /^MBE-[A-F0-9]{20}$/)
  assert.notEqual(events.ticketCode(), events.ticketCode())
  await assert.rejects(() => events.assignTicket({ ...input, expiresAt: new Date(end.getTime() + 1000).toISOString() }))
  await assert.rejects(() => events.assignTicket({ ...input, username: 'missing' }), e => e.status === 404)
  active = false; await assert.rejects(() => events.assignTicket(input), e => e.status === 409)
  active = true; end = new Date(Date.now() - 1000); await assert.rejects(() => events.assignTicket(input), e => e.status === 409)
})
test('event tickets are queried using session identity only', async () => {
  let filter
  const events = load('lib/community/events.ts', {
    './validation': validation,
    '@/lib/prisma': { prisma: {
      communityEvent: { findMany: async () => [] },
      communityTicket: { findMany: async ({ where }) => { filter = where; return [] } },
    } },
  })
  await events.eventState('session-user')
  assert.deepEqual(filter, { userId: 'session-user' })
})
test('every admin community handler denies non-admin sessions before DB or Blob work', async () => {
  const guard = load('lib/community/api.ts', {
    '@/lib/auth': { getCurrentUser: async () => ({ id: 'u', role: 'CLIENTE' }) },
    '@/lib/prisma': { prisma: {} },
    './validation': validation, 'next/server': { NextResponse: { json: Response.json } },
    '@prisma/client': { Prisma: { PrismaClientKnownRequestError: KnownError } },
  })
  function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(dir + '/' + entry.name) : entry.name === 'route.ts' ? [dir + '/' + entry.name] : []) }
  for (const file of walk('app/api/admin/community')) {
    const route = load(file, {
      '@/lib/community/api': guard, '@/lib/community/validation': validation,
      '@/lib/prisma': { prisma: {} }, '@/lib/community/posts': {}, '@/lib/community/campaigns': {},
      '@/lib/community/events': {}, '@/lib/community/invites': {}, '@/lib/community/media': {}, '@vercel/blob/client': {},
    })
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
      if (route[method]) {
        const response = await route[method](new Request('https://mbe.test/api/admin/community', { method }), { params: { id: 'x' } })
        assert.equal(response.status, 403, file + ' ' + method)
      }
    }
  }
})
function withCommunityEnv(work) {
  return async () => {
    const old = process.env.BLOB_STORE_ID
    process.env.BLOB_STORE_ID = 'store_mbestore'
    try { await work() }
    finally { if (old === undefined) delete process.env.BLOB_STORE_ID; else process.env.BLOB_STORE_ID = old }
  }
}
function mediaModule({ oidc = async () => 'short-lived-oidc', head = async () => ({ contentType: 'image/jpeg', size: 100 }) } = {}) {
  return load('lib/community/media.ts', {
    './validation': validation, '@vercel/blob': { head }, '@vercel/oidc': { getVercelOidcToken: oidc },
  })
}
test('private media validates store ID, HTTPS, community path, MIME and size', withCommunityEnv(async () => {
  let metadata = { contentType: 'image/jpeg', size: 100 }, calls = 0
  const media = mediaModule({ head: async (url, options) => {
    calls++; assert.deepEqual(options, { storeId: 'mbestore', oidcToken: 'short-lived-oidc' }); return metadata
  } })
  const valid = 'https://mbestore.private.blob.vercel-storage.com/community/a.jpg'
  for (const url of [
    'https://evil.test/community/a.jpg', 'https://other.private.blob.vercel-storage.com/community/a.jpg',
    'https://mbestore.public.blob.vercel-storage.com/community/a.jpg', valid.replace('https:', 'http:'),
    valid.replace('/community/', '/products/'), valid + '?a=1', valid + '#x',
    valid.replace('https://', 'https://user:pass@'), valid.replace('/a.jpg', '/../a.jpg'),
  ]) await assert.rejects(() => media.validateMedia(url, 'IMAGE'), validation.CommunityError)
  assert.equal(calls, 0)
  assert.equal(await media.validateMedia(valid, 'IMAGE'), valid)
  process.env.BLOB_STORE_ID = 'mbestore'
  assert.equal(await media.validateMedia(valid, 'IMAGE'), valid)
  await assert.rejects(() => media.validateMedia(valid, 'VIDEO'))
  metadata = { contentType: 'image/jpeg', size: 10 * 1024 * 1024 + 1 }
  await assert.rejects(() => media.validateMedia(valid, 'IMAGE'))
  metadata = { contentType: 'video/mp4', size: 50 * 1024 * 1024 }
  assert.equal(await media.validateMedia(valid, 'VIDEO'), valid)
  metadata.size++
  await assert.rejects(() => media.validateMedia(valid, 'VIDEO'))
  metadata = { contentType: 'text/html', size: 1 }
  await assert.rejects(() => media.validateMedia(valid, 'IMAGE'))
}))
test('missing store or OIDC fails closed before Blob work', withCommunityEnv(async () => {
  let calls = 0
  const head = async () => { calls++; throw new Error('Must not call Blob') }
  const url = 'https://mbestore.private.blob.vercel-storage.com/community/a.jpg'
  delete process.env.BLOB_STORE_ID
  await assert.rejects(() => mediaModule({ head }).validateMedia(url, 'IMAGE'), e => e.status === 503)
  process.env.BLOB_STORE_ID = 'store_mbestore'
  for (const oidc of [async () => '', async () => { throw new Error('OIDC unavailable') }]) {
    await assert.rejects(() => mediaModule({ head, oidc }).validateMedia(url, 'IMAGE'), e => e.status === 503)
  }
  assert.equal(calls, 0)
}))
test('ADMIN presigned uploads constrain path, put, MIME, size, expiry and private access', withCommunityEnv(async () => {
  const sdk = require('@vercel/blob')
  let issued, signed, calls = 0
  const route = load('app/api/admin/community/upload/route.ts', {
    '@/lib/community/api': { member: async (request, admin) => assert.equal(admin, true), api: async work => work() },
    '@/lib/community/validation': validation, '@/lib/community/media': mediaModule(),
    '@vercel/blob': {
      issueSignedToken: async options => {
        issued = options; calls++
        return { delegationToken: Buffer.from(JSON.stringify({ ...options, storeId: 'mbestore' })).toString('base64url') + '.signed', clientSigningToken: 'test-key', validUntil: options.validUntil }
      },
      presignUrl: async (token, options) => { signed = options; return sdk.presignUrl(token, options) },
    },
  })
  function request(payload, type = 'blob.generate-presigned-url') {
    return new Request('https://mbe.test/api/admin/community/upload', { method: 'POST', body: JSON.stringify({ type, payload }) })
  }
  for (const [pathname, mime, size, multipart] of [['community/a.jpg', 'image/jpeg', 10, false], ['community/v.mp4', 'video/mp4', 50, true]]) {
    const before = Date.now()
    const result = await route.POST(request({ pathname, multipart }))
    assert.equal(issued.storeId, 'mbestore'); assert.equal(issued.oidcToken, 'short-lived-oidc'); assert.equal(issued.token, undefined)
    assert.equal(issued.pathname, pathname); assert.deepEqual(issued.operations, ['put'])
    assert.ok(issued.allowedContentTypes.includes(mime)); assert.equal(issued.maximumSizeInBytes, size * 1024 * 1024)
    assert.ok(issued.validUntil >= before + 600000 && issued.validUntil <= Date.now() + 600000)
    assert.equal(signed.access, 'private'); assert.equal(signed.addRandomSuffix, true); assert.equal(signed.allowOverwrite, false)
    assert.equal(result.type, 'blob.generate-presigned-url')
    const params = result.presignedUrlPayload.params
    assert.equal(params['vercel-blob-maximum-size-in-bytes'], String(size * 1024 * 1024))
    assert.equal(params['vercel-blob-add-random-suffix'], 'true'); assert.equal(params['vercel-blob-allow-overwrite'], 'false')
    assert.equal(params.pathname, undefined)
    assert.ok(result.presignedUrlPayload.signature); assert.ok(result.presignedUrlPayload.delegationToken)
    assert.equal(JSON.stringify(result).includes('test-key'), false)
  }
  const before = calls
  for (const payload of [null, [], {}, { pathname: 'products/a.jpg' }, { pathname: 'community/../a.jpg' }, { pathname: 'community/a.svg' }, { pathname: 'community/a.jpg', multipart: 'true' }]) {
    await assert.rejects(() => route.POST(request(payload)), validation.CommunityError)
  }
  await assert.rejects(() => route.POST(request({ pathname: 'community/a.jpg' }, 'blob.generate-client-token')))
  assert.equal(calls, before)
}))
test('private media route preserves authenticated publication guards and range streaming', withCommunityEnv(async () => {
  let user = null, query, options, reads = 0, published = false, mediaUrl = 'https://mbestore.private.blob.vercel-storage.com/community/a.jpg'
  const media = mediaModule()
  const route = load('app/api/community/media/[id]/route.ts', {
    '@/lib/community/api': { authenticated: async () => { if (!user) throw new validation.CommunityError('No autorizado', 401); return user }, member: async () => { if (!user) throw new validation.CommunityError('No autorizado', 401); return user } },
    '@/lib/community/validation': validation, '@/lib/community/media': media,
    '@/lib/prisma': { prisma: { communityPost: { findFirst: async ({ where }) => {
      query = where
      if (where.published && !published) return null
      return { mediaUrl }
    } } } },
    '@vercel/blob': { get: async (url, value) => {
      reads++; options = value
      return { stream: new Blob(['x']).stream(), blob: { contentType: 'image/jpeg' }, headers: new Headers({ 'content-range': 'bytes 0-0/1', 'content-length': '1' }) }
    } },
  })
  const request = new Request('https://mbe.test/api/community/media/p', { headers: { range: 'bytes=0-0' } }), params = { params: { id: 'p' } }
  assert.equal((await route.GET(request, params)).status, 401)
  user = { role: 'CLIENTE' }
  assert.equal((await route.GET(request, params)).status, 404)
  assert.deepEqual(query, { id: 'p', published: true }); assert.equal(reads, 0)
  user = { role: 'ADMIN' }
  const response = await route.GET(request, params)
  assert.equal(response.status, 206); assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.deepEqual(options, { access: 'private', storeId: 'mbestore', oidcToken: 'short-lived-oidc', headers: { Range: 'bytes=0-0' } })
  assert.deepEqual(query, { id: 'p' })
  published = true; user = { role: 'CLIENTE' }
  assert.equal((await route.GET(request, params)).status, 206)
  assert.deepEqual(query, { id: 'p', published: true })
  const before = reads
  mediaUrl = 'https://other.private.blob.vercel-storage.com/community/a.jpg'
  assert.equal((await route.GET(request, params)).status, 400)
  assert.equal(reads, before)
}))
