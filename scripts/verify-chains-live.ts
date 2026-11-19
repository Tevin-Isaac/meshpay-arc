/**
 * Read-only check against live public RPCs: each listed contract is really USDC (symbol, decimals 6),
 * and balances for a known address read and format correctly. Usage: npx tsx scripts/verify-chains-live.ts [address]
 */
process.env.VITE_MESHPAY_ADDRESS ??= '0xd619b77bb8389a632800c300969ef152099f7691'
import { createPublicClient, erc20Abi, formatUnits, http } from 'viem'
const { OTHER_NETWORKS, readOtherUsdc, readArcUsdc } = await import('../src/lib/chains')
const { fmtUsdc, fmtExact } = await import('../src/lib/format')
const who = (process.argv[2] ?? '0xd619b77bb8389a632800c300969ef152099f7691') as `0x${string}`
let ok = true
for (const n of OTHER_NETWORKS) {
  try {
    const c = createPublicClient({ transport: http(n.rpc, { timeout: 8000 }) })
    const [symbol, decimals, chainId] = await Promise.all([
      c.readContract({ address: n.usdc, abi: erc20Abi, functionName: 'symbol' }),
      c.readContract({ address: n.usdc, abi: erc20Abi, functionName: 'decimals' }),
      c.getChainId(),
    ])
    const pass = symbol === 'USDC' && decimals === 6 && chainId === n.chainId
    ok &&= pass
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${n.name}: symbol=${symbol} decimals=${decimals} chainId=${chainId}`)
  } catch (e) {
    ok = false
    console.log(`FAIL  ${n.name}: ${(e as Error).message.slice(0, 80)}`)
  }
}
const rows = await readOtherUsdc(who)
for (const r of rows) console.log(`      ${r.name}: ${r.raw === null ? 'unavailable' : `raw=${r.raw} shown=${fmtUsdc(r.raw)} exact=${fmtExact(r.raw)} chain=${formatUnits(r.raw, 6)}`}`)
const arc = await readArcUsdc(who)
console.log(`      Arc Testnet: raw=${arc} shown=${fmtUsdc(arc)} exact=${fmtExact(arc)}`)
process.exit(ok ? 0 : 1)
