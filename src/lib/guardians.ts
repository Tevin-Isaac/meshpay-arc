import { Buffer } from 'buffer'
import sss from 'shamirs-secret-sharing'
import { bytesToHex, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

/** Same shard format as the WayaMesh mobile app: {v, i, t, n, a, s}. */
interface ShardPayload {
  v: 1
  i: number
  t: number
  n: number
  /** Last 8 characters of the wallet address, so a guardian can tell which wallet a shard belongs to. */
  a: string
  /** The shard itself, base64. */
  s: string
}

/** Splits the wallet key so that any `threshold` of `total` shards can rebuild it. One shard alone reveals nothing. */
export function splitKey(key: Hex, address: Address, threshold = 2, total = 3): string[] {
  const shares = sss.split(Buffer.from(key.slice(2), 'hex'), { shares: total, threshold })
  return shares.map((share, index) =>
    JSON.stringify({ v: 1, i: index + 1, t: threshold, n: total, a: address.slice(-8), s: share.toString('base64') } satisfies ShardPayload),
  )
}

function parse(raw: string): ShardPayload {
  let value: unknown
  try {
    value = JSON.parse(raw.trim())
  } catch {
    throw new Error('That is not shard data. Paste the full shard text.')
  }
  const o = value as Partial<ShardPayload>
  if (o.v !== 1) throw new Error('Unknown shard format.')
  if (typeof o.i !== 'number' || typeof o.t !== 'number' || typeof o.n !== 'number' || typeof o.a !== 'string' || typeof o.s !== 'string') {
    throw new Error('A shard is missing fields.')
  }
  if (!Number.isInteger(o.i) || !Number.isInteger(o.t) || !Number.isInteger(o.n) || o.t < 2 || o.n < o.t || o.n > 10 || o.i < 1 || o.i > o.n) {
    throw new Error('A shard has impossible numbers. It may be fake.')
  }
  if (!/^[0-9a-fA-F]{8}$/.test(o.a) || o.s.length > 400 || !/^[A-Za-z0-9+/=]+$/.test(o.s)) throw new Error('A shard is damaged.')
  return o as ShardPayload
}

/** Rebuilds the key from enough shards and proves it matches the wallet the shards were made for. */
export function recoverKey(payloads: string[]): { key: Hex; address: Address } {
  const shards = payloads.map((p) => p.trim()).filter(Boolean).map(parse)
  if (shards.length === 0) throw new Error('Paste at least two shards.')
  const first = shards[0]
  if (shards.some((s) => s.a !== first.a || s.t !== first.t || s.n !== first.n)) throw new Error('These shards belong to different wallets.')
  if (new Set(shards.map((s) => s.i)).size !== shards.length) throw new Error('Use different shards, not the same one twice.')
  if (shards.length < first.t) throw new Error(`Need ${first.t} shards, you pasted ${shards.length}.`)
  const key = bytesToHex(new Uint8Array(sss.combine(shards.map((s) => Buffer.from(s.s, 'base64')))))
  let address: Address
  try {
    address = privateKeyToAccount(key).address
  } catch {
    throw new Error('These shards do not rebuild a valid key.')
  }
  if (!address.toLowerCase().endsWith(first.a.toLowerCase())) throw new Error('These shards do not rebuild the right wallet.')
  return { key, address }
}
