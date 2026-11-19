import { formatUsdc, parseUsdc } from '@/onchain-money'

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/**
 * Two decimals for display. Integer maths on the string from viem: the fraction is TRUNCATED, never rounded,
 * so 19.996670 shows as 19.99 and never as 20.00.
 */
export function fmtUsdc(raw: bigint): string {
  const [whole, frac = ''] = formatUsdc(raw).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${grouped}.${(frac + '00').slice(0, 2)}`
}

/** The exact amount: up to 6 decimals, trailing zeros trimmed (19.99667, 5, 0.000001). */
export function fmtExact(raw: bigint): string {
  const [whole, frac = ''] = formatUsdc(raw).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const f = frac.slice(0, 6).replace(/0+$/, '')
  return f ? `${grouped}.${f}` : grouped
}

/** A decimal amount from a stranger, or '' when it is not a plain number. Never throws. */
export function safeDecimal(input: unknown): string {
  return typeof input === 'string' && /^\d{1,12}(\.\d{1,6})?$/.test(input) ? input : ''
}

/** A stranger's decimal amount shown the way we show money, or '' if it is not a valid number. */
export function fmtDecimal(input: unknown): string {
  const d = safeDecimal(input)
  if (!d) return ''
  try {
    return fmtUsdc(parseUsdc(d))
  } catch {
    return ''
  }
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000))
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
