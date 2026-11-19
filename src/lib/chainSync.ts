import { getAddress, parseAbiItem, type Address, type Hex } from 'viem'
import { toast } from 'sonner'
import { CHAIN, MESHPAY_ADDRESS, USDC_ADDRESS, ZERO_REF } from './mesh'
import { requireChain } from '@/onchain-facts'
import { fmtExact, shortAddress } from './format'
import { addItem, getState, saveContactByAddress, updateItem, type StoredItem } from './store'

/**
 * Reads this wallet's real USDC transfers from the chain so History shows money that arrives (and
 * leaves) without any action in the app, and tells the user when something arrives. The block explorer
 * gives the full history; recent blocks are read straight from the RPC if the explorer is unreachable.
 */

const EXPLORER = requireChain(CHAIN.id).explorerBase
const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const lc = (a: string) => a.toLowerCase()
/** Only transfers this fresh raise an alert; older ones are history and just appear in the list. */
const ALERT_WINDOW_MS = 15 * 60 * 1000

interface Raw {
  hash: Hex
  from: Address
  to: Address
  value: bigint
  at: number
  method?: string | null
}

interface ExplorerItem {
  transaction_hash: Hex
  timestamp: string
  method: string | null
  from: { hash: string }
  to: { hash: string }
  total: { value: string } | null
  token: { address_hash?: string; address?: string } | null
}

async function fromExplorer(me: Address, pages: number, signal?: AbortSignal): Promise<Raw[]> {
  const out: Raw[] = []
  let params = ''
  for (let i = 0; i < pages; i++) {
    const res = await fetch(`${EXPLORER}/api/v2/addresses/${me}/token-transfers?type=ERC-20${params}`, { signal })
    if (!res.ok) throw new Error(`explorer ${res.status}`)
    const body = (await res.json()) as { items?: ExplorerItem[]; next_page_params?: Record<string, string | number | null> | null }
    for (const it of body.items ?? []) {
      const token = it.token?.address_hash ?? it.token?.address ?? ''
      if (lc(token) !== lc(USDC_ADDRESS) || !it.total?.value || !/^\d+$/.test(it.total.value)) continue
      if (!/^0x[0-9a-fA-F]{40}$/.test(it.from.hash) || !/^0x[0-9a-fA-F]{40}$/.test(it.to.hash)) continue
      out.push({ hash: it.transaction_hash, from: getAddress(it.from.hash), to: getAddress(it.to.hash), value: BigInt(it.total.value), at: Date.parse(it.timestamp) || Date.now(), method: it.method })
    }
    const next = body.next_page_params
    if (!next) break
    params = '&' + Object.entries(next).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v ?? ''))}`).join('&')
  }
  return out
}

type Client = { getBlockNumber: () => Promise<bigint>; getLogs: (a: never) => Promise<unknown[]> }

/** RPC fallback: the last ~15 minutes only (the node limits how many blocks one query may span). */
async function fromRpc(client: Client, me: Address): Promise<Raw[]> {
  const head = await client.getBlockNumber()
  const fromBlock = head > 1500n ? head - 1500n : 0n
  const base = { address: USDC_ADDRESS, event: TRANSFER, fromBlock, toBlock: head }
  const get = (args: { from?: Address; to?: Address }) => (client.getLogs as unknown as (a: unknown) => Promise<{ transactionHash: Hex; args: { from: Address; to: Address; value: bigint } }[]>)({ ...base, args })
  const [incoming, outgoing] = await Promise.all([get({ to: me }), get({ from: me })])
  return [...incoming, ...outgoing].map((l) => ({ hash: l.transactionHash, from: l.args.from, to: l.args.to, value: l.args.value, at: Date.now() }))
}

function labelFor(r: Raw): StoredItem['label'] | undefined {
  const m = (r.method ?? '').toLowerCase()
  if (lc(r.to) === lc(MESHPAY_ADDRESS)) return 'deposit'
  if (lc(r.from) === lc(MESHPAY_ADDRESS)) return m.includes('withdraw') ? 'withdraw' : 'settled'
  return undefined
}

function nameFor(address: string): string {
  return getState().contacts.find((c) => lc(c.address) === lc(address))?.name || shortAddress(address)
}

let running = false

/** One pass. Returns how many new transfers were added. */
export async function syncChain(client: Client | undefined, opts: { deep?: boolean } = {}): Promise<number> {
  if (running) return 0
  running = true
  try {
    const me = getAddress(getState().address)
    let raws: Raw[]
    try {
      raws = await fromExplorer(me, opts.deep ? 6 : 1)
    } catch {
      if (!client) return 0
      raws = await fromRpc(client, me)
    }
    let added = 0
    for (const r of raws.sort((a, b) => a.at - b.at)) {
      const isOut = lc(r.from) === lc(me)
      const isIn = lc(r.to) === lc(me)
      if (!isOut && !isIn) continue
      const id = `online:${r.hash}`
      const state = getState()
      if (state.items.some((i) => i.id === id || (i.txHash && lc(i.txHash) === lc(r.hash) && i.amount === r.value.toString() && lc(i.to) === lc(r.to)))) continue

      // An offline payment to me that a courier settled: close the matching voucher instead of listing it twice.
      const label = labelFor(r)
      if (label === 'settled' && isIn) {
        const match = state.items.find((i) => i.source === 'received' && !i.txHash && lc(i.to) === lc(me) && i.amount === r.value.toString() && (i.status === 'pending' || i.status === 'settled' || i.status === 'duplicate'))
        if (match) {
          updateItem(match.id, { status: 'settled', txHash: r.hash })
          continue
        }
      }
      const item: StoredItem = {
        id,
        source: isOut ? 'signed' : 'received',
        kind: 'online',
        label,
        from: r.from,
        to: r.to,
        amount: r.value.toString(),
        fee: '0',
        nonce: '0',
        deadline: '0',
        ref: ZERO_REF,
        signature: '0x',
        createdAt: r.at,
        status: 'settled',
        txHash: r.hash,
      }
      if (!addItem(item)) continue
      added++
      if (isIn && !isOut && Date.now() - r.at < ALERT_WINDOW_MS) announce(item)
    }
    return added
  } finally {
    running = false
  }
}

function announce(item: StoredItem) {
  const amount = fmtExact(BigInt(item.amount))
  const who = lc(item.from) === lc(MESHPAY_ADDRESS) ? 'your offline reserve' : nameFor(item.from)
  const text = `Received ${amount} USDC from ${who}`
  const who2 = lc(item.from) !== lc(MESHPAY_ADDRESS) && !getState().contacts.some((c) => lc(c.address) === lc(item.from))
  toast.success(text, {
    duration: 12000,
    action: who2
      ? {
          label: 'Save contact',
          onClick: () => {
            saveContactByAddress(getAddress(item.from), '')
            toast.success('Saved. Open Chats to rename them or send a message.')
          },
        }
      : undefined,
  })
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      new Notification('Wayamesh', { body: text, tag: item.id })
    }
  } catch {
    // alerts are a bonus
  }
}
