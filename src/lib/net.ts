import { useSyncExternalStore } from 'react'
import { CHAIN } from './network'

/**
 * Connectivity, as the app really sees it. Online means the browser says it is online AND something answered
 * a quick reachability probe (fonts.gstatic.com, then the Arc RPC). The probe runs every 10 s and at once
 * on the browser's online/offline events, so a dead connection behind a "connected" Wi-Fi shows as Offline.
 * There is no manual override.
 */
export interface NetDeps {
  navOnline: () => boolean
  fetchFn: typeof fetch
  rpcUrl: string
  timeoutMs?: number
}

const PROBE_URL = 'https://fonts.gstatic.com/generate_204'

async function attempt(fetchFn: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<boolean> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    // no-cors: the response is opaque, but a resolved fetch proves the network round trip worked.
    await fetchFn(url, { ...init, mode: 'no-cors', cache: 'no-store', signal: ctl.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** True if either probe target answers within the timeout. */
export async function probeReachable(deps: NetDeps): Promise<boolean> {
  const t = deps.timeoutMs ?? 4000
  if (await attempt(deps.fetchFn, PROBE_URL, { method: 'GET' }, t)) return true
  return attempt(
    deps.fetchFn,
    deps.rpcUrl,
    { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) },
    t,
  )
}

/** The state machine, separate from the browser so it can be tested. */
export function createNet(deps: NetDeps) {
  let navOnline = deps.navOnline()
  let probeOk: boolean | null = null // null: not probed yet, trust the browser
  let snapshot = { online: navOnline }
  const listeners = new Set<() => void>()
  let run = 0

  const emit = () => {
    const online = navOnline && probeOk !== false
    if (online === snapshot.online) return
    snapshot = { online }
    listeners.forEach((l) => l())
  }

  const probe = async () => {
    if (!navOnline) {
      probeOk = false
      return emit()
    }
    const id = ++run
    const ok = await probeReachable(deps)
    if (id !== run) return // a newer event superseded this result
    probeOk = ok
    emit()
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (l: () => void) => {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    probe,
    /** The browser's online/offline event. Offline shows at once; online shows at once, then the probe confirms. */
    setNavOnline: (v: boolean) => {
      navOnline = v
      run++
      probeOk = v ? null : false
      emit()
      if (v) void probe()
    },
  }
}

const net = createNet({
  navOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  fetchFn: (...a) => fetch(...a),
  rpcUrl: CHAIN.rpcUrls.default.http[0],
})

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => net.setNavOnline(true))
  window.addEventListener('offline', () => net.setNavOnline(false))
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void net.probe()
  })
  setInterval(() => void net.probe(), 10_000)
  void net.probe()
}

export function useNet() {
  return useSyncExternalStore(net.subscribe, net.getSnapshot, net.getSnapshot)
}

export function getOnline(): boolean {
  return net.getSnapshot().online
}
