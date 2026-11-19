import { parseUsdc, formatUsdc } from '@/onchain-money'
import type { Policy, StoredItem } from './store'

const DAY_MS = 24 * 60 * 60 * 1000

/** An unreadable limit falls back to a cautious default instead of switching the limit off. */
function safeParse(value: string, fallback: string): bigint {
  try {
    return parseUsdc(value)
  } catch {
    return parseUsdc(fallback)
  }
}

export function spentToday(items: StoredItem[], now = Date.now()): bigint {
  return items
    .filter((i) => i.source === 'signed' && i.kind !== 'online' && now - i.createdAt < DAY_MS)
    .reduce((sum, i) => sum + BigInt(i.amount) + BigInt(i.fee ?? '0'), 0n)
}

/**
 * Spending envelope enforced on the device before anything is signed.
 * Returns an error message, or null when the payment is allowed.
 */
export function checkPolicy(amount: bigint, policy: Policy, items: StoredItem[]): string | null {
  const perTx = safeParse(policy.perTx, '50')
  const daily = safeParse(policy.daily, '200')
  if (perTx > 0n && amount > perTx) return `Over your per-payment limit of ${formatUsdc(perTx)} USDC.`
  if (daily > 0n) {
    const used = spentToday(items)
    if (used + amount > daily) {
      return `This would pass your daily limit of ${formatUsdc(daily)} USDC (${formatUsdc(used)} used in the last 24h).`
    }
  }
  return null
}
