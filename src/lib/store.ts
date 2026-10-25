import { useSyncExternalStore } from 'react'
import type { Address, Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

export type ItemStatus = 'pending' | 'settled' | 'duplicate' | 'expired' | 'invalid'

export interface StoredItem {
  id: string
  /** `signed` was created on this device; `received` arrived by QR or pasted code. */
  source: 'signed' | 'received'
  /** A payment from the device reserve to the user's own wallet. Not counted against spending limits. */
  kind?: 'cashout'
  from: Address
  to: Address
  amount: string
  nonce: string
  deadline: string
  signature: Hex
  createdAt: number
  status: ItemStatus
  txHash?: Hex
  note?: string
}

export interface Policy {
  perTx: string
  daily: string
}

interface State {
  deviceKey: Hex
  policy: Policy
  items: StoredItem[]
  reserveCache: { raw: string; at: number } | null
}

const KEY = 'meshpay.v1'

function load(): State {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as State
      if (parsed.deviceKey) return parsed
    }
  } catch {
    // storage unavailable or corrupted: start fresh below
  }
  return {
    deviceKey: generatePrivateKey(),
    policy: { perTx: '50', daily: '200' },
    items: [],
    reserveCache: null,
  }
}

let state: State = load()
const listeners = new Set<() => void>()

function commit(next: State) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // keep working in memory
  }
  listeners.forEach((l) => l())
}

// Persist the freshly generated key right away.
commit(state)

export function getState(): State {
  return state
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useMeshState(): State {
  return useSyncExternalStore(subscribe, getState, getState)
}

export function getDeviceAccount() {
  return privateKeyToAccount(state.deviceKey)
}

export function addItem(item: StoredItem): boolean {
  if (state.items.some((i) => i.id === item.id)) return false
  commit({ ...state, items: [item, ...state.items] })
  return true
}

export function updateItem(id: string, patch: Partial<StoredItem>) {
  commit({ ...state, items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
}

export function removeItem(id: string) {
  commit({ ...state, items: state.items.filter((i) => i.id !== id) })
}

export function setPolicy(policy: Policy) {
  commit({ ...state, policy })
}

export function setReserveCache(raw: bigint) {
  commit({ ...state, reserveCache: { raw: raw.toString(), at: Date.now() } })
}
