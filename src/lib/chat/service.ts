import type { Hex } from 'viem'
import { fromB64Url } from '../mesh'
import { ingestVoucher } from '../ingest'
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

async function tryPublish(id: string, box: Uint8Array, recipientPub: Hex): Promise<boolean> {
  if (!getOnline() || relayStatus().connected === 0) return false
  const acks = await publish(buildRelayEvent(xonlyOf(recipientPub), box))
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
    ts: inner.t * 1000,
    status: 'queued',
    code: encodeMessageCode(contact.pubkey, box),
  }
  addMessage(msg)
  await tryPublish(msg.id, box, contact.pubkey)
  return msg
}

/** Sends everything waiting: queued messages and sealed messages this phone is carrying for others. */
export async function flushOutbox(): Promise<void> {
  if (!getOnline() || relayStatus().connected === 0) return
  const { messages, contacts, carried } = getState()
  for (const m of messages.filter((x) => x.dir === 'out' && x.status === 'queued' && x.code)) {
    const contact = contacts.find((c) => c.address.toLowerCase() === m.peer.toLowerCase())
    if (!contact || !m.code) continue
    await tryPublish(m.id, decodeMessageCode(m.code).box, contact.pubkey)
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

export type BoxResult = 'delivered' | 'duplicate' | 'invalid'

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
  const state = getState()
  if (state.messages.some((m) => m.id === inner.i)) return 'duplicate'

  const peer = inner.f
  if (!state.contacts.some((c) => c.address.toLowerCase() === peer.toLowerCase())) {
    // A stranger: keep them in a requests folder until the user accepts.
    upsertContact({ address: peer, name: `${peer.slice(0, 6)}…${peer.slice(-4)}`, pubkey: senderPub, verified: false, addedAt: Date.now(), request: true })
  } else {
    const c = state.contacts.find((x) => x.address.toLowerCase() === peer.toLowerCase())
    if (c && c.pubkey !== senderPub) patchContact(peer, { pubkey: senderPub, verified: false })
  }

  let voucherId: string | undefined
  if (inner.k === 'payment' && inner.c) {
    try {
      voucherId = (await ingestVoucher(inner.c)).item.id
    } catch {
      voucherId = undefined
    }
  }
  addMessage({
    id: inner.i,
    peer,
    dir: 'in',
    kind: inner.k,
    text: inner.x,
    amount: inner.a,
    ref: inner.r,
    voucherId,
    ts: inner.t * 1000,
    status: 'received',
  })
  return 'delivered'
}

export async function handleRelayContent(content: string): Promise<BoxResult> {
  try {
    return await handleBox(fromB64Url(content))
  } catch {
    return 'invalid'
  }
}

export type OfflineResult = 'delivered' | 'duplicate' | 'carried' | 'invalid'

/** An offline message code: either for me, or something to carry to the internet for someone else. */
export async function ingestMessageCode(code: string): Promise<OfflineResult> {
  const { recipientX, box } = decodeMessageCode(code)
  if (recipientX === xonlyOf(myPubkey())) return handleBox(box)
  const added = addCarried({ id: recipientX.slice(0, 8) + code.slice(-24), code, at: Date.now(), published: false })
  if (added) await flushOutbox()
  return added ? 'carried' : 'duplicate'
}
