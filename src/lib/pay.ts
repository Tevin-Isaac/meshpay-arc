import type { Address, Hex } from 'viem'
import { VOUCHER_TTL_SECONDS, ZERO_REF, encodeVoucher, randomNonce, signPayment, type Payment } from './mesh'
import { makeItem, toVoucher } from './items'
import { unsafeRecipient } from './guard'
import { checkPolicy } from './policy'
import { addItem, getDeviceAccount, getState, type StoredItem } from './store'

export class PaymentBlocked extends Error {}

interface Options {
  kind?: 'cashout'
  spendable?: bigint | null
  /** Courier tip, in USDC base units. */
  fee?: bigint
  /** Invoice or chat reference carried inside the signed payment. */
  ref?: Hex
}

/**
 * Builds and signs a payment on the device. Needs no network: the spending
 * envelope is checked locally, then the device key seals the payment.
 */
let queue: Promise<unknown> = Promise.resolve()

/** One payment is signed at a time, so two taps at once cannot both pass the limit check. */
export function createSignedPayment(to: Address, amount: bigint, opts: Options = {}): Promise<{ item: StoredItem; code: string }> {
  const run = queue.then(() => signNow(to, amount, opts))
  queue = run.catch(() => undefined)
  return run
}

async function signNow(to: Address, amount: bigint, opts: Options): Promise<{ item: StoredItem; code: string }> {
  const state = getState()
  const account = getDeviceAccount()
  const fee = opts.fee ?? 0n
  if (amount <= 0n) throw new PaymentBlocked('Enter an amount above zero.')
  if (to.toLowerCase() === account.address.toLowerCase()) throw new PaymentBlocked('That is this device. Pick another address.')
  if (opts.spendable !== undefined && opts.spendable !== null && amount + fee > opts.spendable) {
    throw new PaymentBlocked('That is more than your offline balance. Add funds first.')
  }
  const unsafe = unsafeRecipient(to)
  if (unsafe) throw new PaymentBlocked(unsafe)
  const blocked = checkPolicy(amount + fee, state.policy, state.items)
  if (blocked) throw new PaymentBlocked(blocked)

  const payment: Payment = {
    from: account.address,
    to,
    amount,
    fee,
    nonce: randomNonce(),
    deadline: BigInt(Math.floor(Date.now() / 1000) + VOUCHER_TTL_SECONDS),
    ref: opts.ref ?? ZERO_REF,
  }
  const signature = await signPayment(account, payment)
  const item = { ...makeItem({ payment, signature }, 'signed'), kind: opts.kind }
  if (!addItem(item)) throw new PaymentBlocked('Too many payments are waiting to settle. Settle some first.')
  return { item, code: encodeVoucher(toVoucher(item)) }
}
