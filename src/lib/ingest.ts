import { parseUsdc } from '@/onchain-money'
import { MAX_ACCEPTED_TTL_SECONDS, decodeVoucher, isSignatureValid } from './mesh'
import { makeItem } from './items'
import { isMine } from './mine'
import { addItem, getState, patchInvoice, type StoredItem } from './store'

export interface IngestedVoucher {
  item: StoredItem
  added: boolean
  /** True when the payment pays one of my addresses. A payment for someone else is only carried. */
  forMe: boolean
}

/**
 * Verifies a payment code on the device, so a receiver knows it is genuine before going online,
 * and flags anything bigger than they are comfortable accepting on trust.
 */
export async function ingestVoucher(code: string): Promise<IngestedVoucher> {
  if (code.length > 600) throw new Error('That is not a payment code.')
  const voucher = decodeVoucher(code)
  const { deadline, amount, ref, to } = voucher.payment
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (amount === 0n) throw new Error('This payment has no amount.')
  if (deadline === 0n || now > deadline) throw new Error('This payment has expired.')
  if (deadline > now + BigInt(MAX_ACCEPTED_TTL_SECONDS)) {
    throw new Error('This payment stays valid too long to be safe. Ask for a new one.')
  }
  if (!(await isSignatureValid(voucher))) throw new Error('The signature does not match. This payment is not valid.')

  const state = getState()
  const forMe = isMine(to)
  let limit = 0n
  try {
    limit = parseUsdc(state.settings.acceptLimit)
  } catch {
    limit = 0n
  }
  const item = { ...makeItem(voucher, 'received'), risky: forMe && limit > 0n && amount > limit }
  const added = addItem(item)

  // An invoice counts as paid only by a payment to me that covers it.
  const invoice = state.invoices.find((i) => i.ref === ref)
  if (added && forMe && invoice && invoice.status === 'open') {
    let enough = true
    try {
      enough = !invoice.amount || amount >= parseUsdc(invoice.amount)
    } catch {
      enough = false
    }
    if (enough) patchInvoice(ref, { status: 'received', voucherId: item.id })
  }
  return { item, added, forMe }
}
