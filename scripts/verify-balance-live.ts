/**
 * Read-only check against the live Arc Testnet RPC: the formatted balance equals the raw balanceOf and reserve()
 * readings, truncated and never rounded. Usage: npx tsx scripts/verify-balance-live.ts [address]
 */
process.env.VITE_MESHPAY_ADDRESS ??= '0xd619b77bb8389a632800c300969ef152099f7691'
import { createPublicClient, erc20Abi, http, formatUnits } from 'viem'
import { arcTestnet } from 'viem/chains'
const { fmtUsdc, fmtExact } = await import('../src/lib/format')
const { totalBalance } = await import('../src/lib/balance')
const { MESHPAY_ABI, MESHPAY_ADDRESS, USDC_ADDRESS } = await import('../src/lib/mesh')

const who = (process.argv[2] ?? '0xd619b77bb8389a632800c300969ef152099f7691') as `0x${string}`
const client = createPublicClient({ chain: arcTestnet, transport: http() })
const wallet = await client.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [who] })
const reserve = await client.readContract({ address: MESHPAY_ADDRESS, abi: MESHPAY_ABI, functionName: 'reserve', args: [who] })
const total = totalBalance(wallet, reserve)!
const trunc2 = (raw: bigint) => {
  const [w, f = ''] = formatUnits(raw, 6).split('.')
  return `${w.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${(f + '00').slice(0, 2)}`
}
let ok = true
for (const [name, raw] of [['wallet', wallet], ['reserve', reserve], ['total', total]] as const) {
  const exact = formatUnits(raw, 6)
  const pass = fmtUsdc(raw) === trunc2(raw) && Number(fmtExact(raw).replace(/,/g, '')) === Number(exact)
  ok &&= pass
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}: raw=${raw} chain=${exact} shown=${fmtUsdc(raw)} exact=${fmtExact(raw)}`)
}
console.log(`address ${who} (balanceOf and reserve() read from ${arcTestnet.rpcUrls.default.http[0]})`)
process.exit(ok ? 0 : 1)
