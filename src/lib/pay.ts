import type { Address } from 'viem'
import { VOUCHER_TTL_SECONDS, encodeVoucher, randomNonce, signPayment, type Payment } from './mesh'
import { makeItem, toVoucher } from './items'
import { checkPolicy } from './policy'
import { addItem, getDeviceAccount, getState, type StoredItem } from './store'

export class PaymentBlocked extends Error {}

/**
 * Builds and signs a payment on the device. Needs no network: the spending
 * envelope is checked locally, then the device key seals the payment.
 */
export async function createSignedPayment(
  to: Address,
  amount: bigint,
  opts: { kind?: 'cashout'; spendable?: bigint | null } = {},
): Promise<{ item: StoredItem; code: string }> {
  const state = getState()
  const account = getDeviceAccount()
  if (amount <= 0n) throw new PaymentBlocked('Enter an amount above zero.')
  if (to.toLowerCase() === account.address.toLowerCase()) throw new PaymentBlocked('That is this device. Pick another address.')
  if (opts.spendable !== undefined && opts.spendable !== null && amount > opts.spendable) {
    throw new PaymentBlocked('That is more than your offline balance. Add funds first.')
  }
  if (opts.kind !== 'cashout') {
    const blocked = checkPolicy(amount, state.policy, state.items)
    if (blocked) throw new PaymentBlocked(blocked)
  }

  const payment: Payment = {
    from: account.address,
    to,
    amount,
    nonce: randomNonce(),
    deadline: BigInt(Math.floor(Date.now() / 1000) + VOUCHER_TTL_SECONDS),
  }
  const signature = await signPayment(state.deviceKey, payment)
  const item = { ...makeItem({ payment, signature }, 'signed'), kind: opts.kind }
  addItem(item)
  return { item, code: encodeVoucher(toVoucher(item)) }
}
