import type { Address } from 'viem'

/**
 * Address poisoning guard: attackers send dust from an address that starts and ends like one you
 * know, hoping you copy it later. Returns the real address when `to` only looks like it.
 */
export function lookalike(to: string, known: Address[]): Address | null {
  const t = to.toLowerCase()
  for (const k of known) {
    const a = k.toLowerCase()
    if (a === t) return null
  }
  for (const k of known) {
    const a = k.toLowerCase()
    if (a.slice(0, 6) === t.slice(0, 6) && a.slice(-4) === t.slice(-4)) return k
  }
  return null
}

/** Groups an address into blocks of four so every character can be checked by eye. */
export function groupAddress(address: string): string {
  return address.slice(2).replace(/(.{4})/g, '$1 ').trim()
}
