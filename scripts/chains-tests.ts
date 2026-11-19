/** Tests for the external wallet multi-network USDC balances (mocked reader). Run with: npm run test:chains */
process.env.VITE_MESHPAY_ADDRESS ??= '0xd619b77bb8389a632800c300969ef152099f7691'
const { OTHER_NETWORKS, readOtherUsdc } = await import('../src/lib/chains')
const { fmtUsdc, fmtExact } = await import('../src/lib/format')
const { showUsdc } = await import('../src/lib/balance')
const out: string[] = []
const check = (n: string, p: boolean) => out.push(`${p ? 'PASS' : 'FAIL'}  ${n}`)
const owner = '0x000000000000000000000000000000000000dEaD'

check('six other networks listed', OTHER_NETWORKS.length === 6)
check('every USDC address is a distinct 0x address', new Set(OTHER_NETWORKS.map((n) => n.usdc.toLowerCase())).size === 6 && OTHER_NETWORKS.every((n) => /^0x[0-9a-fA-F]{40}$/.test(n.usdc)))
check('every RPC is https', OTHER_NETWORKS.every((n) => n.rpc.startsWith('https://')))

const rows = await readOtherUsdc(owner, async (n) => {
  if (n.id === 'base') throw new Error('rpc down')
  if (n.id === 'polygon') return 0n
  if (n.id === 'ethereum') return 19_996_670n
  return 1n
})
const by = Object.fromEntries(rows.map((r) => [r.id, r.raw]))
check('a failing network is null (unavailable), not 0', by.base === null)
check('a real zero stays 0n, distinct from unavailable', by.polygon === 0n)
check('other networks still return when one fails', by.ethereum === 19_996_670n && by.arbitrum === 1n && rows.length === 6)
check('unavailable shows an em dash', showUsdc(by.base ?? null, fmtExact) === '—')
check('19.996670 shows 19.99 (truncated) and exact 19.99667', fmtUsdc(by.ethereum as bigint) === '19.99' && fmtExact(by.ethereum as bigint) === '19.99667')
check('1 micro USDC shows exactly', fmtExact(by.arbitrum as bigint) === '0.000001')

const slow = await readOtherUsdc(owner, () => Promise.reject(new TypeError('timeout')))
check('all networks failing gives six unavailable rows, no throw', slow.every((r) => r.raw === null) && slow.length === 6)

console.log(out.join('\n'))
const failed = out.filter((l) => l.startsWith('FAIL')).length
console.log(`\n${out.length - failed}/${out.length} passed`)
process.exit(failed ? 1 : 0)
