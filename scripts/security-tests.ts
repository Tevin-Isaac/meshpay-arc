/**
 * Hostile-input tests for the wallet. Run with: bun run test:security
 * Each check feeds the app something an attacker could send (over a relay, by QR or by paste)
 * and confirms it is refused instead of crashing the wallet or fooling the user.
 */
process.env.VITE_MESHPAY_ADDRESS ??= '0xd619b77bb8389a632800c300969ef152099f7691'

const { privateKeyToAccount, generatePrivateKey } = await import('viem/accounts')
const chat = await import('../src/lib/chat/crypto')
const mesh = await import('../src/lib/mesh')
const { fmtDecimal } = await import('../src/lib/format')
const { unsafeRecipient } = await import('../src/lib/guard')
const { recoverKey } = await import('../src/lib/guardians')

const results: string[] = []
const check = (name: string, pass: boolean) => results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}`)
const throws = (f: () => unknown) => {
  try {
    f()
    return false
  } catch {
    return true
  }
}

const key = generatePrivateKey()
const alice = privateKeyToAccount(key)
const bob = privateKeyToAccount(generatePrivateKey())

const good = await chat.buildInner(alice, bob.address, { k: 'payment', a: '2.5', x: 'hi' })
check('valid message passes validation', !throws(() => chat.unpackInner(chat.packInner(good))))
check('valid message signature verifies', (await chat.verifyInner(chat.unpackInner(chat.packInner(good)), bob.address)) === chat.pubkeyOf(key))
check('message re-targeted to someone else is rejected', await chat.verifyInner(chat.unpackInner(chat.packInner(good)), alice.address).then(() => false, () => true))

const evil = (patch: Record<string, unknown>) => new TextEncoder().encode(JSON.stringify({ ...good, ...patch }))
check('amount "abc" rejected', throws(() => chat.unpackInner(evil({ a: 'abc' }))))
check('amount "1e5" rejected', throws(() => chat.unpackInner(evil({ a: '1e5' }))))
check('amount "-1" rejected', throws(() => chat.unpackInner(evil({ a: '-1' }))))
check('amount of 100k digits rejected', throws(() => chat.unpackInner(evil({ a: '9'.repeat(100000) }))))
check('amount as an object rejected', throws(() => chat.unpackInner(evil({ a: { x: 1 } }))))
check('text as an object rejected', throws(() => chat.unpackInner(evil({ x: { evil: true } }))))
check('text over 500 chars rejected', throws(() => chat.unpackInner(evil({ x: 'a'.repeat(501) }))))
check('unknown kind rejected', throws(() => chat.unpackInner(evil({ k: 'admin' }))))
check('far-future timestamp rejected', throws(() => chat.unpackInner(evil({ t: 4_000_000_000 }))))
check('bad id rejected', throws(() => chat.unpackInner(evil({ i: '../../x' }))))
check('ref that is not 32 bytes rejected', throws(() => chat.unpackInner(evil({ r: '0x12' }))))
check('payment code that is not mp2 rejected', throws(() => chat.unpackInner(evil({ c: 'javascript:alert(1)' }))))
check('payload over 4KB rejected', throws(() => chat.unpackInner(new Uint8Array(5000).fill(32))))

const ev = chat.buildRelayEvent('a'.repeat(64), new Uint8Array(100))
check('fresh relay event accepted', chat.relayEventValid(ev))
check('relay event dated years ahead rejected', !chat.relayEventValid({ ...ev, created_at: ev.created_at + 10 * 365 * 86400 }))
check('relay event with giant content rejected', !chat.relayEventValid({ ...ev, content: 'a'.repeat(20000) }))
check('relay event with tampered content rejected', !chat.relayEventValid({ ...ev, content: ev.content + 'x' }))

const payment = {
  from: alice.address,
  to: bob.address,
  amount: 1_000_000n,
  fee: 0n,
  nonce: 5n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  ref: mesh.ZERO_REF,
}
const sig = await mesh.signPayment(alice, payment)
check('canonical signature accepted', mesh.isCanonicalSignature(sig) && !throws(() => mesh.decodeVoucher(mesh.encodeVoucher({ payment, signature: sig }))))
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n
const s = BigInt(`0x${sig.slice(66, 130)}`)
const v = parseInt(sig.slice(130), 16) === 27 ? 28 : 27
const flipped = `0x${sig.slice(2, 66)}${(N - s).toString(16).padStart(64, '0')}${v.toString(16)}` as `0x${string}`
check('malleated (high-s) signature rejected', !mesh.isCanonicalSignature(flipped) && throws(() => mesh.decodeVoucher(mesh.encodeVoucher({ payment, signature: flipped }))))

check('request with absurd amount drops the amount', mesh.parseRequest(`meshpay:${bob.address}?amount=${'9'.repeat(200)}`)?.amount === undefined)
check('request note is cleaned of direction tricks', !/[\u202e\u200b]/.test(mesh.parseRequest(`meshpay:${bob.address}?note=${encodeURIComponent('pay\u202eevil\u200b')}`)?.note ?? ''))
check('cleanText strips control characters', mesh.cleanText('a\u0000b\u202ec', 10) === 'abc')
check('contact card name is cleaned', !chat.decodeCard(chat.encodeCard({ address: alice.address, pubkey: chat.pubkeyOf(key), name: 'Mom\u202e' })).name.includes('\u202e'))
check('contact card whose address does not match its key is rejected', throws(() => chat.decodeCard(chat.encodeCard({ address: bob.address, pubkey: chat.pubkeyOf(key), name: 'x' }))))
check('fmtDecimal never throws on garbage', fmtDecimal('abc') === '' && fmtDecimal({}) === '' && fmtDecimal('1e5') === '' && fmtDecimal('2.5') === '2.50')
check('zero address blocked as a recipient', unsafeRecipient('0x0000000000000000000000000000000000000000') !== null)
check('USDC contract blocked as a recipient', unsafeRecipient('0x3600000000000000000000000000000000000000') !== null)
check('settlement contract blocked as a recipient', unsafeRecipient(process.env.VITE_MESHPAY_ADDRESS ?? '') !== null)
check('ordinary address allowed', unsafeRecipient(bob.address) === null)
check(
  'shard with impossible numbers rejected',
  throws(() => recoverKey([JSON.stringify({ v: 1, i: 99, t: 2, n: 3, a: '12345678', s: 'AAAA' }), JSON.stringify({ v: 1, i: 1, t: 2, n: 3, a: '12345678', s: 'AAAA' })])),
)

console.log(results.join('\n'))
const failed = results.filter((r) => r.startsWith('FAIL')).length
console.log(failed ? `${failed} FAILED` : `ALL ${results.length} PASSED`)
if (failed) process.exit(1)
