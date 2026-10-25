import type { Address } from 'viem'
import { voucherId, type Payment, type Voucher } from './mesh'
import type { StoredItem } from './store'

export function toPayment(i: StoredItem): Payment {
  return {
    from: i.from,
    to: i.to,
    amount: BigInt(i.amount),
    nonce: BigInt(i.nonce),
    deadline: BigInt(i.deadline),
  }
}

export function toVoucher(i: StoredItem): Voucher {
  return { payment: toPayment(i), signature: i.signature }
}

export function makeItem(v: Voucher, source: StoredItem['source']): StoredItem {
  const p = v.payment
  return {
    id: voucherId(p),
    source,
    from: p.from,
    to: p.to,
    amount: p.amount.toString(),
    nonce: p.nonce.toString(),
    deadline: p.deadline.toString(),
    signature: v.signature,
    createdAt: Date.now(),
    status: 'pending',
  }
}

export type Role = 'out' | 'in' | 'courier'

/** `out`: I paid. `in`: addressed to me. `courier`: I am only carrying someone else's payment. */
export function roleOf(i: StoredItem, mine: Address[]): Role {
  if (i.source === 'signed') return 'out'
  return mine.some((a) => a.toLowerCase() === i.to.toLowerCase()) ? 'in' : 'courier'
}
