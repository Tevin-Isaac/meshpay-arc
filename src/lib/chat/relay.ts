import { useSyncExternalStore } from 'react'
import { relaySince } from './expiry'
import { RELAY_KIND, relayEventValid, type RelayEvent } from './crypto'

/**
 * Connections to public Nostr relays. Relays are untrusted mailboxes: every message is sealed
 * end to end and published under a throwaway key, so a relay learns nothing about who wrote it.
 */

interface Conn {
  url: string
  ws: WebSocket | null
  open: boolean
  tries: number
  timer: ReturnType<typeof setTimeout> | null
  acks: Map<string, (ok: boolean) => void>
}

type Handler = (event: RelayEvent) => void

const conns = new Map<string, Conn>()
const seen = new Set<string>()
let handler: Handler | null = null
let filter: { x: string; since: number } | null = null
let want = false
let status = { connected: 0, total: 0 }
const listeners = new Set<() => void>()

function emit() {
  const connected = [...conns.values()].filter((c) => c.open).length
  status = { connected, total: conns.size }
  listeners.forEach((l) => l())
}

function sendReq(c: Conn) {
  if (!c.ws || !c.open || !filter) return
  c.ws.send(JSON.stringify(['REQ', 'meshpay', { kinds: [RELAY_KIND], '#p': [filter.x], since: Math.max(filter.since, relaySince()) }]))
}

function connect(c: Conn) {
  if (!want || c.ws) return
  try {
    const ws = new WebSocket(c.url)
    c.ws = ws
    ws.onopen = () => {
      c.open = true
      c.tries = 0
      sendReq(c)
      emit()
    }
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(String(msg.data)) as unknown[]
        if (data[0] === 'EVENT' && data[2]) {
          const e = data[2] as RelayEvent
          if (seen.has(e.id) || !relayEventValid(e)) return
          seen.add(e.id)
          if (seen.size > 5000) seen.delete(seen.values().next().value as string)
          handler?.(e)
        } else if (data[0] === 'OK' && typeof data[1] === 'string') {
          c.acks.get(data[1])?.(data[2] === true)
        }
      } catch {
        // ignore malformed frames
      }
    }
    const down = () => {
      c.open = false
      c.ws = null
      emit()
      if (want) {
        c.tries += 1
        c.timer = setTimeout(() => connect(c), Math.min(30_000, 1500 * 2 ** c.tries))
      }
    }
    ws.onclose = down
    ws.onerror = () => ws.close()
  } catch {
    c.ws = null
  }
}

export function startRelays(urls: string[], x: string, since: number, onEvent: Handler) {
  stopRelays()
  want = true
  handler = onEvent
  filter = { x, since }
  for (const url of urls) {
    const c: Conn = { url, ws: null, open: false, tries: 0, timer: null, acks: new Map() }
    conns.set(url, c)
    connect(c)
  }
  emit()
}

export function stopRelays() {
  want = false
  handler = null
  filter = null
  for (const c of conns.values()) {
    if (c.timer) clearTimeout(c.timer)
    c.ws?.close()
  }
  conns.clear()
  emit()
}

/** Publishes to every open relay. Resolves with how many accepted it. */
export async function publish(event: RelayEvent): Promise<number> {
  const open = [...conns.values()].filter((c) => c.open && c.ws)
  if (open.length === 0) return 0
  const acks = await Promise.all(
    open.map(
      (c) =>
        new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => {
            c.acks.delete(event.id)
            resolve(false)
          }, 6000)
          c.acks.set(event.id, (ok) => {
            clearTimeout(timer)
            c.acks.delete(event.id)
            resolve(ok)
          })
          c.ws?.send(JSON.stringify(['EVENT', event]))
        }),
    ),
  )
  return acks.filter(Boolean).length
}

export function relayStatus() {
  return status
}

export function useRelayStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    relayStatus,
    relayStatus,
  )
}
