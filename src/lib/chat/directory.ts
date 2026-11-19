import { schnorr, secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, getAddress, hexToBytes, type Address, type Hex } from 'viem'
import { publicKeyToAddress } from 'viem/utils'
import { getDeviceKey, getState, patchContact } from '../store'
import { pubkeyOf, xonlyOf, type RelayEvent } from './crypto'

/**
 * Finding someone's chat key from their wallet address alone. A wallet address does not contain the public key,
 * so each wallet can publish a tiny "listing" to the public relays: its public key, filed under its address.
 * It holds no name and no message. Anyone can check it: the key must hash to the address, and the listing must be
 * signed by that same key. A wrong key for an address cannot be passed off. Turn it off in Settings.
 */

const KIND = 30078
const tagFor = (address: string) => `wayamesh-card:${address.toLowerCase()}`
const te = new TextEncoder()

function sign(content: string, address: Address): RelayEvent {
  const sk = hexToBytes(getDeviceKey())
  const pubkey = bytesToHex(schnorr.getPublicKey(sk)).slice(2)
  const created_at = Math.floor(Date.now() / 1000)
  const tags = [['d', tagFor(address)]]
  const id = bytesToHex(sha256(te.encode(JSON.stringify([0, pubkey, created_at, KIND, tags, content])))).slice(2)
  const sig = bytesToHex(schnorr.sign(hexToBytes(`0x${id}`), sk)).slice(2)
  return { id, pubkey, created_at, kind: KIND, tags, content, sig }
}

/** True when `pubkey` really is the key behind `address`. */
export function keyMatchesAddress(pubkey: string, address: string): boolean {
  try {
    if (!/^0x(02|03)[0-9a-fA-F]{64}$/.test(pubkey)) return false
    const full = bytesToHex(secp256k1.ProjectivePoint.fromHex(pubkey.slice(2)).toRawBytes(false))
    return publicKeyToAddress(full).toLowerCase() === address.toLowerCase()
  } catch {
    return false
  }
}

function eventOk(e: RelayEvent, address: string): boolean {
  try {
    if (e.kind !== KIND || !e.tags.some((t) => t[0] === 'd' && t[1] === tagFor(address))) return false
    if (typeof e.content !== 'string' || e.content.length > 80) return false
    const id = bytesToHex(sha256(te.encode(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content])))).slice(2)
    if (id !== e.id || !schnorr.verify(hexToBytes(`0x${e.sig}`), hexToBytes(`0x${e.id}`), hexToBytes(`0x${e.pubkey}`))) return false
    return keyMatchesAddress(e.content, address) && xonlyOf(e.content as Hex) === e.pubkey
  } catch {
    return false
  }
}

function talk<T>(urls: string[], open: (ws: WebSocket, finish: (v: T | null) => void) => void, ms = 6000): Promise<T | null> {
  return new Promise((resolve) => {
    let left = urls.length
    let done = false
    const sockets: WebSocket[] = []
    const finish = (v: T | null) => {
      if (done) return
      if (v === null && --left > 0) return
      done = true
      sockets.forEach((s) => {
        try {
          s.close()
        } catch {
          // already closed
        }
      })
      clearTimeout(timer)
      resolve(v)
    }
    const timer = setTimeout(() => {
      left = 1
      finish(null)
    }, ms)
    for (const url of urls) {
      try {
        const ws = new WebSocket(url)
        sockets.push(ws)
        ws.onerror = () => finish(null)
        ws.onopen = () => open(ws, finish)
      } catch {
        finish(null)
      }
    }
  })
}

let publishedFor: string | null = null

/** Lists my public key under my address (or clears the listing when turned off). Once per session unless forced. */
export async function publishListing(on: boolean, force = false): Promise<void> {
  const { address, settings } = getState()
  const key = `${address}:${on}`
  if (!force && publishedFor === key) return
  const event = sign(on ? pubkeyOf(getDeviceKey()) : '', getAddress(address))
  const urls = settings.relays
  const ok = await talk<boolean>(urls, (ws, finish) => {
    ws.onmessage = (m) => {
      try {
        const d = JSON.parse(String(m.data)) as unknown[]
        if (d[0] === 'OK' && d[1] === event.id) finish(d[2] === true ? true : null)
      } catch {
        // ignore
      }
    }
    ws.send(JSON.stringify(['EVENT', event]))
  })
  if (ok) publishedFor = key
}

/** Looks up the chat key listed for an address. Returns null when there is none. */
export async function lookupKey(address: Address): Promise<Hex | null> {
  const urls = getState().settings.relays
  return talk<Hex>(urls, (ws, finish) => {
    const best: { at: number; key: Hex | null } = { at: 0, key: null }
    let eose = false
    ws.onmessage = (m) => {
      try {
        const d = JSON.parse(String(m.data)) as unknown[]
        if (d[0] === 'EVENT' && d[2]) {
          const e = d[2] as RelayEvent
          if (e.created_at > best.at && eventOk(e, address)) {
            best.at = e.created_at
            best.key = e.content as Hex
          }
          if (best.key) finish(best.key)
        } else if (d[0] === 'EOSE') {
          eose = true
          if (!best.key) finish(null)
        }
      } catch {
        // ignore
      }
    }
    void eose
    ws.send(JSON.stringify(['REQ', 'dir', { kinds: [KIND], '#d': [tagFor(address)], limit: 5 }]))
  })
}

const tried = new Map<string, number>()

/** Fills in the chat key of a contact saved by address. Safe to call often: it retries each address at most every minute. */
export async function resolveContact(address: Address, force = false): Promise<boolean> {
  const c = getState().contacts.find((x) => x.address.toLowerCase() === address.toLowerCase())
  if (!c || c.pubkey) return !!c?.pubkey
  const k = address.toLowerCase()
  if (!force && Date.now() - (tried.get(k) ?? 0) < 60_000) return false
  tried.set(k, Date.now())
  const key = await lookupKey(address)
  if (!key || !keyMatchesAddress(key, address)) return false
  patchContact(address, { pubkey: key, verified: false })
  return true
}
