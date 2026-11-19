/** Tests for balance maths and formatting. Run with: npm run test:balance */
import fs from 'node:fs'
const { fmtUsdc, fmtExact } = await import('../src/lib/format')
const { totalBalance, spendableOf, maxOnline, showUsdc, GAS_BUFFER } = await import('../src/lib/balance')
const { sanitizeData } = await import('../src/lib/store')
const out: string[] = []
const check = (n: string, p: boolean) => out.push(`${p ? 'PASS' : 'FAIL'}  ${n}`)

// Truncation, never rounding up
check('19.996670 shows 19.99, not 20.00', fmtUsdc(19_996_670n) === '19.99')
check('19.996670 exact shows 19.99667', fmtExact(19_996_670n) === '19.99667')
check('0.999999 shows 0.99', fmtUsdc(999_999n) === '0.99')
check('zero shows 0.00 and exact 0', fmtUsdc(0n) === '0.00' && fmtExact(0n) === '0')
check('one microUSDC exact is 0.000001', fmtExact(1n) === '0.000001')
check('whole number exact has no decimals', fmtExact(5_000_000n) === '5')
check('trailing zeros trimmed', fmtExact(1_500_000n) === '1.5' && fmtUsdc(1_500_000n) === '1.50')
check('large values keep every digit', fmtExact(123_456_789_012_345_678n) === '123,456,789,012.345678')
check('large value 2dp truncates', fmtUsdc(123_456_789_012_345_678n) === '123,456,789,012.34')
check('1,000 grouped', fmtUsdc(1_000_000_000n) === '1,000.00')
check('0.019999 exact', fmtExact(19_999n) === '0.019999')

// Totals and unknowns
check('total adds wallet and spendable', totalBalance(2_000_000n, 3_500_000n) === 5_500_000n)
check('total is unknown when wallet unknown', totalBalance(null, 3n) === null)
check('total is unknown when reserve unknown', totalBalance(3n, null) === null)
check('total of two zeros is 0 (known), not unknown', totalBalance(0n, 0n) === 0n)
check('unknown shows an em dash, never 0.00', showUsdc(null, fmtUsdc) === '—')
check('known zero shows 0.00', showUsdc(0n, fmtUsdc) === '0.00')
check('spendable subtracts signed payments', spendableOf(10_000_000n, 4_000_000n) === 6_000_000n)
check('spendable never negative', spendableOf(1n, 5n) === 0n)
check('spendable unknown when reserve unknown', spendableOf(null, 5n) === null)
check('max online leaves the gas buffer', maxOnline(1_000_000n) === 1_000_000n - GAS_BUFFER)
check('max online is 0 when balance is at or below the buffer', maxOnline(GAS_BUFFER) === 0n && maxOnline(5n) === 0n && maxOnline(null) === 0n)

// Cache survives sanitising; junk is dropped
const good = sanitizeData({ walletCache: { raw: '19996670', at: 5 } })
check('wallet cache kept', good.walletCache?.raw === '19996670')
check('junk wallet cache dropped', sanitizeData({ walletCache: { raw: 'abc', at: 5 } }).walletCache === null && sanitizeData({}).walletCache === null)
check('display name is cleaned and capped', sanitizeData({ settings: { displayName: 'A'.repeat(40) + '\n' } as never }).settings.displayName.length === 24)

// "Works with no external wallet": the core flows must not gate on a connected wallet
const src = (f: string) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
check('PayNowForm has no connect gate', !/Connect wallet to pay/.test(src('components/PayNowForm.tsx')) && /getDeviceAccount\(\)/.test(src('components/PayNowForm.tsx')))
check('SettleCard has no connect button', !/ConnectKitButton/.test(src('components/SettleCard.tsx')))
check('BuySheet has no connect button and signs with the device key', !/ConnectKitButton/.test(src('components/BuySheet.tsx')) && /getDeviceAccount\(\)/.test(src('components/BuySheet.tsx')))
check('Header has no connect button or airplane', !/ConnectKit|Plane|Airplane/.test(src('components/Header.tsx')))
check('GetStarted has no connect step', !/onnect/.test(src('components/GetStarted.tsx')))
check('net has no simulated override', !/simulated/i.test(src('lib/net.ts')))
check('device pays settle fee before an external wallet', /deviceUsdc\.raw >= DEVICE_GAS_FLOOR \? 'device' : isConnected/.test(src('hooks/useSettle.ts')))
check('no "Built with Arc Studio" text in src', !/Built with Arc Studio/.test(src('config.ts') + src('tracing.ts') + src('console-capture.ts')))

console.log(out.join('\n'))
const failed = out.filter((l) => l.startsWith('FAIL')).length
console.log(`\n${out.length - failed}/${out.length} passed`)
process.exit(failed ? 1 : 0)
