/** Tests for the connectivity state logic (mocked fetch and navigator). Run with: npm run test:net */
const { createNet, probeReachable } = await import('../src/lib/net')
const out: string[] = []
const check = (n: string, p: boolean) => out.push(`${p ? 'PASS' : 'FAIL'}  ${n}`)
const RPC = 'https://rpc.example/arc'

const mk = (nav: boolean, reach: (url: string) => 'ok' | 'fail' | 'hang') => {
  const calls: string[] = []
  const fetchFn = ((url: string, init?: RequestInit) => {
    calls.push(String(url))
    const r = reach(String(url))
    if (r === 'ok') return Promise.resolve(new Response(null))
    if (r === 'fail') return Promise.reject(new TypeError('Failed to fetch'))
    return new Promise((_, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))
  }) as unknown as typeof fetch
  const state = { nav }
  const net = createNet({ navOnline: () => state.nav, fetchFn, rpcUrl: RPC, timeoutMs: 30 })
  return { net, calls, state }
}

{
  const t = mk(true, () => 'ok')
  check('starts online when the browser says online', t.net.getSnapshot().online === true)
  await t.net.probe()
  check('probe ok keeps it online', t.net.getSnapshot().online === true)
  check('first probe target is fonts.gstatic.com only when it answers', t.calls.length === 1 && t.calls[0].startsWith('https://fonts.gstatic.com'))
}
{
  const t = mk(true, (u) => (u.includes('gstatic') ? 'fail' : 'ok'))
  await t.net.probe()
  check('falls back to the RPC when gstatic fails: online', t.net.getSnapshot().online === true && t.calls.length === 2 && t.calls[1] === RPC)
}
{
  const t = mk(true, () => 'fail')
  let notified = 0
  t.net.subscribe(() => notified++)
  await t.net.probe()
  check('both probes fail: offline even though the browser says online', t.net.getSnapshot().online === false && notified === 1)
}
{
  const t = mk(true, () => 'hang')
  const t0 = Date.now()
  await t.net.probe()
  check('hanging probes time out and mean offline', t.net.getSnapshot().online === false && Date.now() - t0 < 1000)
}
{
  const t = mk(true, () => 'ok')
  let n = 0
  t.net.subscribe(() => n++)
  t.net.setNavOnline(false)
  check('offline event flips to offline at once, without a probe', t.net.getSnapshot().online === false && t.calls.length === 0 && n === 1)
  t.net.setNavOnline(true)
  check('online event flips to online at once', t.net.getSnapshot().online === true)
  await new Promise((r) => setTimeout(r, 20))
  check('online event then probes to confirm', t.calls.length >= 1 && t.net.getSnapshot().online === true)
}
{
  const t = mk(true, () => 'fail')
  t.net.setNavOnline(false)
  t.net.setNavOnline(true)
  await new Promise((r) => setTimeout(r, 120))
  check('online event but nothing reachable: settles to offline', t.net.getSnapshot().online === false)
}
{
  const t = mk(false, () => 'ok')
  await t.net.probe()
  check('browser offline: offline and no network calls', t.net.getSnapshot().online === false && t.calls.length === 0)
}
{
  let up = false
  const t = mk(true, () => (up ? 'ok' : 'fail'))
  await t.net.probe()
  const was = t.net.getSnapshot().online
  up = true
  await t.net.probe()
  check('recovers to online when the probe starts working', was === false && t.net.getSnapshot().online === true)
}
{
  const ok = await probeReachable({ navOnline: () => true, fetchFn: (() => Promise.resolve(new Response(null))) as unknown as typeof fetch, rpcUrl: RPC })
  check('probeReachable true when a fetch resolves', ok === true)
}

console.log(out.join('\n'))
const failed = out.filter((l) => l.startsWith('FAIL')).length
console.log(`\n${out.length - failed}/${out.length} passed`)
process.exit(failed ? 1 : 0)
