import type { Hex } from 'viem'
import type { PrivateKeyAccount } from 'viem/accounts'
import { useQuery } from '@tanstack/react-query'

// Client for the ramp server in ramp-server/ (M-Pesa STK Push in, B2C out).
// Base URL: VITE_RAMP_API_URL. In dev it defaults to the Vite proxy at /ramp-api.

export type RampAction = 'onramp' | 'offramp'

/** Same as ramp-server/src/authMessage.ts. Keep these two in step. */
export function normalizePhone(input: string): string | null {
  const s = String(input ?? '').replace(/[\s\-()]/g, '')
  let d: string
  if (/^\+254\d{9}$/.test(s)) d = s.slice(1)
  else if (/^254\d{9}$/.test(s)) d = s
  else if (/^0\d{9}$/.test(s)) d = '254' + s.slice(1)
  else if (/^[71]\d{8}$/.test(s)) d = '254' + s
  else return null
  return /^254[17]\d{8}$/.test(d) ? d : null
}

export function buildAuthMessage(p: { action: RampAction; address: string; phone: string; amount: string; issuedAt: number }): string {
  return `Wayamesh ramp\nAction: ${p.action}\nAddress: ${p.address}\nPhone: ${p.phone}\nAmount: ${p.amount}\nIssued: ${p.issuedAt}`
}

export interface RampConfig {
  mock: boolean
  network: string
  usdKes: number
  feeBps: number
  minKes: number
  maxKes: number
  treasury: string | null
  treasuryMock?: boolean
  meshpay?: string | null
}
export type OrderStatus = 'pending' | 'paid' | 'delivering' | 'completed' | 'failed'
export interface RampOrder {
  id: string
  kind: RampAction
  status: OrderStatus
  usdc: string
  kes: number
  phoneMasked: string
  txHash?: string
  mpesaReceipt?: string
  reason?: string
  mock?: boolean
}

const fromEnv = (import.meta.env.VITE_RAMP_API_URL as string | undefined) ?? ''
export const RAMP_API_URL = (fromEnv || (import.meta.env.DEV ? '/ramp-api' : '')).replace(/\/$/, '')
export const isRampConfigured = () => RAMP_API_URL.length > 0

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isRampConfigured()) throw new Error('M-Pesa is not available here.')
  const r = await fetch(RAMP_API_URL + path, { ...init, headers: { 'Content-Type': 'application/json' } })
  const j: unknown = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = typeof j === 'object' && j && 'error' in j ? String((j).error) : ''
    throw new Error(msg.length > 0 && msg.length < 120 ? msg : `Request failed (${r.status})`)
  }
  return j as T
}

export const getRampConfig = () => call<RampConfig>('/api/ramp/config')
export const getOrder = (id: string) => call<RampOrder>(`/api/ramp/orders/${id}`)

/** Only the server decides the real amounts. These are for the preview. */
export const previewUsdcForKes = (c: RampConfig, kes: number) => (kes / c.usdKes) * (1 - c.feeBps / 10000)
export const previewKesForUsdc = (c: RampConfig, usdc: number) => Math.floor(usdc * c.usdKes * (1 - c.feeBps / 10000))

export async function startOnramp(account: PrivateKeyAccount, phoneInput: string, amountKes: number) {
  const phone = normalizePhone(phoneInput)
  if (!phone) throw new Error('Enter a valid Kenyan phone number.')
  const issuedAt = Date.now()
  const signature = await account.signMessage({
    message: buildAuthMessage({ action: 'onramp', address: account.address, phone, amount: String(amountKes), issuedAt }),
  })
  return call<{ id: string; status: OrderStatus; mock: boolean }>('/api/ramp/onramp/mpesa', {
    method: 'POST',
    body: JSON.stringify({ address: account.address, phone, amountKes, issuedAt, signature }),
  })
}

/** `usdc` is a decimal string with at most 6 places. `deposit` says how the treasury was paid. */
export async function startOfframp(account: PrivateKeyAccount, phoneInput: string, usdc: string, txHash: Hex, deposit: 'native' | 'voucher') {
  const phone = normalizePhone(phoneInput)
  if (!phone) throw new Error('Enter a valid Kenyan phone number.')
  const issuedAt = Date.now()
  const signature = await account.signMessage({
    message: buildAuthMessage({ action: 'offramp', address: account.address, phone, amount: usdc, issuedAt }),
  })
  return call<{ id: string; status: OrderStatus }>('/api/ramp/offramp/mpesa', {
    method: 'POST',
    body: JSON.stringify({ address: account.address, phone, usdc, txHash, deposit, issuedAt, signature }),
  })
}

export async function pollOrder(
  id: string,
  onUpdate: (o: RampOrder) => void,
  opts: { intervalMs?: number; timeoutMs?: number; signal?: { cancelled: boolean } } = {},
): Promise<RampOrder> {
  const { intervalMs = 2000, timeoutMs = 3 * 60_000, signal } = opts
  const end = Date.now() + timeoutMs
  let last: RampOrder | null = null
  while (Date.now() < end && !signal?.cancelled) {
    try {
      last = await getOrder(id)
      onUpdate(last)
      if (last.status === 'completed' || last.status === 'failed') return last
    } catch {
      /* transient, keep polling */
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  if (last) return last
  throw new Error('Timed out waiting for M-Pesa.')
}

/** The ramp server's settings, or null when no ramp server is configured or reachable. */
export function useRampConfig() {
  const q = useQuery({
    queryKey: ['ramp-config'],
    enabled: isRampConfigured(),
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        return await getRampConfig()
      } catch {
        return null
      }
    },
  })
  return q.data ?? null
}
