/** Tests for the address directory: a listed key only counts when it really belongs to the address. */
process.env.VITE_MESHPAY_ADDRESS ??= '0xd619b77bb8389a632800c300969ef152099f7691'
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => void mem.set(k, String(v)),
  removeItem: (k) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
}
const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts')
const { pubkeyOf } = await import('../src/lib/chat/crypto')
const { keyMatchesAddress } = await import('../src/lib/chat/directory')

let failed = 0
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}

const a = generatePrivateKey()
const b = generatePrivateKey()
const addrA = privateKeyToAccount(a).address
const addrB = privateKeyToAccount(b).address

check('a key matches its own address', keyMatchesAddress(pubkeyOf(a), addrA))
check('address match is case-insensitive', keyMatchesAddress(pubkeyOf(a), addrA.toLowerCase()))
check("someone else's key is refused", !keyMatchesAddress(pubkeyOf(b), addrA))
check('an empty listing is refused', !keyMatchesAddress('', addrA))
check('garbage is refused', !keyMatchesAddress('0x02' + 'zz'.repeat(32), addrA))
check('wrong length is refused', !keyMatchesAddress('0x02abcd', addrA))
check('the other wallet still matches itself', keyMatchesAddress(pubkeyOf(b), addrB))

if (failed) {
  console.log(`${failed} failed`)
  process.exit(1)
}
console.log('all directory checks passed')
