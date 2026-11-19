/**
 * Tests for the 24-hour chat expiry policy. Run with: npm run test:expiry (or bun run test:expiry)
 */
process.env.VITE_MESHPAY_ADDRESS ??= '0xd619b77bb8389a632800c300969ef152099f7691'

const { privateKeyToAccount, generatePrivateKey } = await import('viem/accounts')
const ex = await import('../src/lib/chat/expiry')
const chat = await import('../src/lib/chat/crypto')

const results: string[] = []
const check = (name: string, pass: boolean) => results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}`)
const T = 1_800_000_000 // fixed "now" in seconds
const DAY = 86_400

check('TTL is exactly 24 hours', ex.CHAT_TTL_SECONDS === DAY)
check('expiresAt = t + 86400', ex.expiresAt(T) === T + DAY)
check('not expired at 23h59m59s', !ex.isExpired(T, T + DAY - 1))
check('expired at exactly 24h', ex.isExpired(T, T + DAY))
check('expired after 24h', ex.isExpired(T, T + DAY + 1))
check('fresh message not expired', !ex.isExpired(T, T))
check('expiration tag is NIP-40 shaped', JSON.stringify(ex.expirationTag(T)) === JSON.stringify(['expiration', String(T + DAY)]))
check('relay since is now - 24h', ex.relaySince(T) === T - DAY && ex.relaySince(5) === 0)

const nowMs = T * 1000
const msgs = [
  { id: 'old', ts: (T - DAY - 10) * 1000 },
  { id: 'edge', ts: (T - DAY) * 1000 },
  { id: 'almost', ts: (T - DAY + 1) * 1000 },
  { id: 'new', ts: nowMs },
]
const kept = ex.keepLive(msgs, nowMs).map((m) => m.id)
check('purge drops older than 24h and exactly 24h', JSON.stringify(kept) === JSON.stringify(['almost', 'new']))
const allLive = [{ id: 'a', ts: nowMs }]
check('purge returns the same array when nothing expired (no needless re-save)', ex.keepLive(allLive, nowMs) === allLive)
check('purge of empty list is empty', ex.keepLive([], nowMs).length === 0)
const carried = [{ id: 'c1', at: (T - DAY - 1) * 1000 }, { id: 'c2', at: nowMs }]
check('carried offline codes older than 24h are purged', JSON.stringify(ex.keepLiveCarried(carried, nowMs).map((c) => c.id)) === '["c2"]')

// Relay event: tag added, event still valid, p tag still first, content unchanged format.
const key = generatePrivateKey()
const me = privateKeyToAccount(key)
const box = new Uint8Array(80).fill(7)
const sentAt = Math.floor(Date.now() / 1000)
const ev = chat.buildRelayEvent('ab'.repeat(32), box, sentAt)
check('relay event carries p tag first and NIP-40 expiration', ev.tags[0][0] === 'p' && ev.tags[1]?.[0] === 'expiration' && ev.tags[1][1] === String(sentAt + DAY))
check('relay event with expiration tag still verifies', chat.relayEventValid(ev))
const ev2 = chat.buildRelayEvent('ab'.repeat(32), box)
check('carried event (no sentAt) expires 24h after creation', ev2.tags[1][1] === String(ev2.created_at + DAY))
check('tampering the expiration tag invalidates the event', !chat.relayEventValid({ ...ev, tags: [ev.tags[0], ['expiration', String(sentAt + 10 * DAY)]] }))

// Wire format unchanged: inner plaintext has no new fields and text limit is still 500.
const inner = await chat.buildInner(me, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', { k: 'text', x: 'hi' })
check('inner message fields unchanged', JSON.stringify(Object.keys(inner).sort()) === JSON.stringify(['f', 'i', 'k', 'o', 's', 't', 'v', 'x']))
check('text limit still 500', (() => { try { chat.unpackInner(chat.packInner({ ...inner, x: 'a'.repeat(501) })); return false } catch { return true } })())

console.log(results.join('\n'))
const failed = results.filter((r) => r.startsWith('FAIL')).length
console.log(failed ? `\n${failed} FAILED` : `\nALL ${results.length} PASSED`)
process.exit(failed ? 1 : 0)
