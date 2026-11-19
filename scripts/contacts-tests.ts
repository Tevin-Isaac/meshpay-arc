/** Tests for contacts: they persist, survive the 24-hour purge, and deleting one removes only it and its messages. */
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
const st = await import('../src/lib/store')

const out: string[] = []
const check = (n: string, p: boolean) => out.push(`${p ? 'PASS' : 'FAIL'}  ${n}`)

await st.createWallet(null, generatePrivateKey(), '482915')
const A = privateKeyToAccount(generatePrivateKey()).address
const B = privateKeyToAccount(generatePrivateKey()).address
const C = privateKeyToAccount(generatePrivateKey()).address
const now = Date.now()
const DAY = 86_400_000

st.saveContactByAddress(A, 'Amina')
check('a contact saved by address appears at once, with no messages', st.getState().contacts.some((c) => c.address === A && c.name === 'Amina'))
check('address-only contact has no chat key', st.getState().contacts.find((c) => c.address === A)?.pubkey === '')
st.upsertContact({ address: B, name: 'Baraka', pubkey: ('0x02' + '11'.repeat(32)) as `0x${string}`, verified: false, addedAt: now, request: false })

const msg = (id: string, peer: typeof A, ts: number) => ({ id, peer, dir: 'in' as const, kind: 'text' as const, text: 'hi', ts, status: 'received' as const })
st.addMessage(msg('a-old', A, now - 3 * DAY))
st.addMessage(msg('a-new', A, now))
st.addMessage(msg('b-old', B, now - 2 * DAY))
st.addMessage(msg('b-new', B, now))
const pay = { id: 'online:0x1', source: 'signed' as const, kind: 'online' as const, from: B, to: A, amount: '1000000', fee: '0', nonce: '0', deadline: '0', ref: ('0x' + '00'.repeat(32)) as `0x${string}`, signature: '0x' as `0x${string}`, createdAt: now, status: 'settled' as const }
st.addItem(pay)
st.addInvoice({ ref: ('0x' + '22'.repeat(32)) as `0x${string}`, createdAt: now, status: 'open' })

// the purge
const removed = st.purgeExpiredMessages(now)
check('purge removed only the two expired messages', removed === 2 && st.getState().messages.length === 2)
check('purge never removes a contact (even one whose messages all expired)', st.getState().contacts.length === 2)
st.purgeExpiredMessages(now + 10 * DAY)
check('purge 10 days later removes every message but keeps both contacts', st.getState().messages.length === 0 && st.getState().contacts.length === 2)

// contacts are saved to storage: lock, then unlock, and they are still there
st.lock()
await new Promise((r) => setTimeout(r, 50))
const un = await st.unlock('482915')
check('wallet unlocks again', un.ok === true)
check('contacts survive a lock and unlock (they were saved)', st.getState().contacts.length === 2 && st.getState().contacts.some((c) => c.address === A))

// delete
st.addMessage(msg('a-2', A, Date.now()))
st.addMessage(msg('b-2', B, Date.now()))
st.deleteContact(A)
const s = st.getState()
check('delete removes the contact', !s.contacts.some((c) => c.address === A))
check('delete removes their messages', !s.messages.some((m) => m.peer === A))
check('delete keeps other contacts and their messages', s.contacts.some((c) => c.address === B) && s.messages.some((m) => m.id === 'b-2'))
check('delete never touches payments', s.items.some((i) => i.id === pay.id) && s.items.length === 1)
check('delete never touches invoices', s.invoices.length === 1)
check('contact can be added again after deleting', st.saveContactByAddress(A, 'Amina') && st.getState().contacts.some((c) => c.address === A))
check('saving an existing contact does not duplicate it', st.saveContactByAddress(A, 'Amina') && st.getState().contacts.filter((c) => c.address === A).length === 1)
void C

console.log(out.join('\n'))
const failed = out.filter((l) => l.startsWith('FAIL')).length
console.log(`\n${out.length - failed}/${out.length} passed`)
process.exit(failed ? 1 : 0)
