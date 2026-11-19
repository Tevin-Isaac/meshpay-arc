import { parseUsdc } from '@/onchain-money'
import { MAX_ACCEPTED_TTL_SECONDS, decodeVoucher, isSignatureValid } from './mesh'
import { makeItem } from './items'
import { addItem, getState, patchInvoice, type StoredItem } from './store'

export interface IngestedVoucher {
  item: StoredItem
  added: boolean
}

/**
 * Verifies a payment code on the device, so a receiver knows it is genuine before going online,
 * and flags anything bigger than they are comfortable accepting on trust.
 */
export async function ingestVoucher(code: string): Promise<IngestedVoucher> {
  const voucher = decodeVoucher(code)
  const { deadline, amount, ref } = voucher.payment
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (deadline === 0n || now > deadline) throw new Error('This payment has expired.')
  if (deadline > now + BigInt(MAX_ACCEPTED_TTL_SECONDS)) {
    throw new Error('This payment stays valid too long to be safe. Ask for a new one.')
  }
  if (!(await isSignatureValid(voucher))) throw new Error('The signature does not match. This payment is not valid.')

  const state = getState()
  let limit = 0n
  try {
    limit = parseUsdc(state.settings.acceptLimit)
  } catch {
    limit = 0n
  }
  const item = { ...makeItem(voucher, 'received'), risky: limit > 0n && amount > limit }
  const added = addItem(item)

  const invoice = state.invoices.find((i) => i.ref === ref)
  if (added && invoice && invoice.status === 'open') patchInvoice(ref, { status: 'received', voucherId: item.id })
  return { item, added }
}
