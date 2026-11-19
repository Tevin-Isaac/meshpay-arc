import type { Hex } from 'viem'
import { formatUsdc } from '@/onchain-money'
import { fromB64Url } from '../mesh'
import { ingestVoucher } from '../ingest'
import { isExpired, expiresAt } from './expiry'
import { getDeviceAccount, getDeviceKey, getState, addCarried, addMessage, markCarriedPublished, patchContact, updateMessage, upsertContact, type ChatMessage, type Contact } from '../store'
import { getOnline } from '../net'
import {
  buildInner,
  buildRelayEvent,
  decodeMessageCode,
  encodeMessageCode,
  openBox,
  packInner,
  pubkeyOf,
  sealBox,
  unpackInner,
  verifyInner,
  xonlyOf,
  type ContactCard,
  type Inner,
} from './crypto'
import { publish, relayStatus } from './relay'

export function myPubkey(): Hex {
  return pubkeyOf(getDeviceKey())
}

export function myCard(name: string): ContactCard {
  return { address: getState().address, pubkey: myPubkey(), name }
}

export function addContactFromCard(card: ContactCard) {
  const existing = getState().contacts.find((c) => c.address.toLowerCase() === card.address.toLowerCase())
  upsertContact({
    address: card.address,
    pubkey: card.pubkey,
    name: existing?.name || card.name || `${card.address.slice(0, 6)}…${card.address.slice(-4)}`,
    verified: existing?.pubkey === card.pubkey ? existing.verified : false,
    addedAt: existing?.addedAt ?? Date.now(),
    request: false,
  })
}

async function tryPublish(id: string, box: Uint8Array, recipientPub: Hex, sentAt: number): Promise<boolean> {
  if (!getOnline() || relayStatus().connected === 0) return false
  if (isExpired(sentAt)) return false // past its 24 hours: never publish
  const acks = await publish(buildRelayEvent(xonlyOf(recipientPub), box, sentAt))
  if (acks > 0) updateMessage(id, { status: 'sent' })
  return acks > 0
}

export interface Content {
  k: Inner['k']
  x?: string
  a?: string
  r?: Hex
  c?: string
}

/** Encrypts, stores and (when possible) sends a message. Offline it waits in the outbox and has a hand-over code. */
export async function sendChat(contact: Contact, content: Content, voucherId?: string): Promise<ChatMessage> {
  if (!contact.pubkey) throw new Error('Add their contact card to chat. You can still pay them.')
  const account = getDeviceAccount()
  const inner = await buildInner(account, contact.address, content)
  const box = sealBox(packInner(inner), contact.pubkey)
  const msg: ChatMessage = {
    id: inner.i,
    peer: contact.address,
    dir: 'out',
    kind: content.k,
    text: content.x,
    amount: content.a,
    ref: content.r,
    voucherId,
    verified: content.k === 'payment' ? true : undefined,
    ts: inner.t * 1000,
    status: 'queued',
    code: encodeMessageCode(contact.pubkey, box),
  }
  addMessage(msg)
  await tryPublish(msg.id, box, contact.pubkey, inner.t)
  return msg
}

/** Sends everything waiting: queued messages and sealed messages this phone is carrying for others. */
export async function flushOutbox(): Promise<void> {
  if (!getOnline() || relayStatus().connected === 0) return
  const { messages, contacts, carried } = getState()
  for (const m of messages.filter((x) => x.dir === 'out' && x.status === 'queued' && x.code)) {
    const contact = contacts.find((c) => c.address.toLowerCase() === m.peer.toLowerCase())
    if (!contact || !m.code || !contact.pubkey) continue
    await tryPublish(m.id, decodeMessageCode(m.code).box, contact.pubkey, Math.floor(m.ts / 1000))
  }
  for (const c of carried.filter((x) => !x.published)) {
    try {
      const { recipientX, box } = decodeMessageCode(c.code)
      if ((await publish(buildRelayEvent(recipientX, box))) > 0) markCarriedPublished(c.id)
    } catch {
      markCarriedPublished(c.id)
    }
  }
}

export type BoxResult = 'delivered' | 'duplicate' | 'invalid' | 'expired'

/** Opens a sealed box addressed to this wallet, checks the sender, and stores the message. */
export async function handleBox(box: Uint8Array): Promise<BoxResult> {
  const me = getState().address
  let inner: Inner
  let senderPub: Hex
  try {
    inner = unpackInner(openBox(box, getDeviceKey()))
    senderPub = await verifyInner(inner, me)
  } catch {
    return 'invalid'
  }
  if (isExpired(inner.t)) return 'expired' // 24-hour policy: older than a day is dropped, never stored
  const state = getState()
  if (state.messages.some((m) => m.id === inner.i)) return 'duplicate'

  const peer = inner.f
  if (peer.toLowerCase() === me.toLowerCase()) return 'invalid'
  const known = state.contacts.find((c) => c.address.toLowerCase() === peer.toLowerCase())
  if (!known) {
    // A stranger: keep them in a requests folder until the user accepts. The folder has a cap so nobody can flood it.
    const ok = upsertContact({ address: peer, name: `${peer.slice(0, 6)}…${peer.slice(-4)}`, pubkey: senderPub, verified: false, addedAt: Date.now(), request: true })
    if (!ok) return 'invalid'
  } else if (known.pubkey !== senderPub) {
    patchContact(peer, { pubkey: senderPub, verified: false })
  }

  // Never trust the amount a sender claims. A payment is real only if the attached payment code checks out and pays me.
  let voucherId: string | undefined
  let verified = false
  let amount: string | undefined
  if (inner.k === 'payment' && inner.c) {
    try {
      const res = await ingestVoucher(inner.c)
      voucherId = res.item.id
      verified = res.forMe && res.item.from.toLowerCase() === peer.toLowerCase()
      if (verified) amount = formatUsdc(BigInt(res.item.amount))
    } catch {
      voucherId = undefined
    }
  }
  const stored = addMessage({
    id: inner.i,
    peer,
    dir: 'in',
    kind: inner.k,
    text: inner.x ? cleanMessage(inner.x) : undefined,
    amount: inner.k === 'payment' ? amount : inner.a,
    ref: inner.r,
    voucherId,
    verified: inner.k === 'payment' ? verified : undefined,
    ts: Math.min(inner.t * 1000, Date.now()),
    status: 'received',
  })
  return stored ? 'delivered' : 'duplicate'
}

/** Removes characters that reorder or hide text, but keeps line breaks. */
function cleanMessage(text: string): string {
  return text.replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').slice(0, 500)
}

export async function handleRelayContent(content: string): Promise<BoxResult> {
  if (content.length > 12_000) return 'invalid'
  try {
    return await handleBox(fromB64Url(content))
  } catch {
    return 'invalid'
  }
}

export type OfflineResult = 'delivered' | 'duplicate' | 'carried' | 'invalid' | 'expired'

/** An offline message code: either for me, or something to carry to the internet for someone else. */
export async function ingestMessageCode(code: string): Promise<OfflineResult> {
  if (code.length > 12_000) return 'invalid'
  const { recipientX, box } = decodeMessageCode(code)
  if (recipientX === xonlyOf(myPubkey())) return handleBox(box)
  const added = addCarried({ id: recipientX.slice(0, 8) + code.slice(-24), code, at: Date.now(), published: false })
  if (added) await flushOutbox()
  return added ? 'carried' : 'duplicate'
}
