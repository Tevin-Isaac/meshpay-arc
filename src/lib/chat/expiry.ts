/**
 * 24-hour chat expiry. Client-side policy plus a relay hint; the wire format is unchanged.
 *
 * - Every message expires at t + CHAT_TTL_SECONDS, where t is the sender's timestamp inside the sealed message.
 * - The sender adds a NIP-40 ["expiration", ...] tag to the relay event. Relays MAY honour it; nothing depends on that.
 * - Receivers drop anything whose t is older than 24 hours, and purge expired messages locally.
 * - Only messages (and offline message codes being carried) are purged. Contacts, payments, invoices and
 *   settlement status are never touched.
 *
 * Pure functions, no browser or store imports, so they are unit-testable in Node.
 */

export const CHAT_TTL_SECONDS = 86_400
/** How often the app purges while open, in addition to start, foreground and opening a thread. */
export const PURGE_INTERVAL_MS = 5 * 60_000

const nowSec = () => Math.floor(Date.now() / 1000)

/** Unix time (seconds) when a message sent at `t` expires. */
export const expiresAt = (t: number) => t + CHAT_TTL_SECONDS

/** True once a message sent at `t` (seconds) is 24 hours old. */
export const isExpired = (t: number, now = nowSec()) => now >= expiresAt(t)

/** NIP-40 tag for a relay event carrying a message sent at `t`. */
export const expirationTag = (t: number): string[] => ['expiration', String(expiresAt(t))]

/** Subscription start: nothing older than 24 hours can still be valid. */
export const relaySince = (now = nowSec()) => Math.max(0, now - CHAT_TTL_SECONDS)

/** Messages that are still alive. `ts` is in milliseconds. Returns the same array when nothing expired. */
export function keepLive<T extends { ts: number }>(messages: T[], nowMs = Date.now()): T[] {
  const live = messages.filter((m) => !isExpired(Math.floor(m.ts / 1000), Math.floor(nowMs / 1000)))
  return live.length === messages.length ? messages : live
}

/** Carried offline codes: their inner time is sealed, so age is measured from when this phone picked them up. */
export function keepLiveCarried<T extends { at: number }>(carried: T[], nowMs = Date.now()): T[] {
  const live = carried.filter((c) => !isExpired(Math.floor(c.at / 1000), Math.floor(nowMs / 1000)))
  return live.length === carried.length ? carried : live
}
