import type { Address } from 'viem'
import { decodeVoucher, isSignatureValid, isVoucherCode, parseRequest } from './mesh'
import { makeItem } from './items'
import { addItem, type StoredItem } from './store'

export type Ingested =
  | { kind: 'request'; address: Address; amount?: string }
  | { kind: 'voucher'; item: StoredItem; added: boolean }

/**
 * Handles anything scanned or pasted. Verifies a payment's signature on the
 * device, so a receiver knows it is genuine before they ever go online.
 */
export async function ingest(text: string): Promise<Ingested> {
  const request = parseRequest(text)
  if (request) return { kind: 'request', ...request }

  if (!isVoucherCode(text)) throw new Error('That code is not a MeshPay request or payment.')

  const voucher = decodeVoucher(text)
  const { deadline } = voucher.payment
  if (deadline !== 0n && BigInt(Math.floor(Date.now() / 1000)) > deadline) {
    throw new Error('This payment has expired.')
  }
  if (!(await isSignatureValid(voucher))) throw new Error('The signature does not match. This payment is not valid.')

  const item = makeItem(voucher, 'received')
  return { kind: 'voucher', item, added: addItem(item) }
}
