import { isVoucherCode, parseRequest, type PaymentRequest } from './mesh'
import { ingestVoucher, type IngestedVoucher } from './ingest'
import { decodeCard, isCard, isMessageCode, type ContactCard } from './chat/crypto'
import { addContactFromCard, ingestMessageCode, type OfflineResult } from './chat/service'

export type Scanned =
  | { kind: 'request'; request: PaymentRequest }
  | ({ kind: 'voucher' } & IngestedVoucher)
  | { kind: 'contact'; card: ContactCard }
  | { kind: 'message'; result: OfflineResult }

/** Handles anything scanned or pasted: payment requests, payments, contact cards and offline messages. */
export async function scan(text: string): Promise<Scanned> {
  const value = text.trim()
  const request = parseRequest(value)
  if (request) return { kind: 'request', request }
  if (isVoucherCode(value)) return { kind: 'voucher', ...(await ingestVoucher(value)) }
  if (isCard(value)) {
    const card = decodeCard(value)
    addContactFromCard(card)
    return { kind: 'contact', card }
  }
  if (isMessageCode(value)) {
    const result = await ingestMessageCode(value)
    if (result === 'invalid') throw new Error('That message could not be opened.')
    return { kind: 'message', result }
  }
  throw new Error('That code is not a MeshPay request, payment, contact or message.')
}
