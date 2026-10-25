import { formatUsdc } from '@/onchain-money'

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** Two decimals for display, trimming nothing so balances line up. */
export function fmtUsdc(raw: bigint): string {
  const [whole, frac = ''] = formatUsdc(raw).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${grouped}.${(frac + '00').slice(0, 2)}`
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000))
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
