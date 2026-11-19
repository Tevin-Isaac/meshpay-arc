import { useCallback, useState } from 'react'
import { createWalletClient, http, parseEventLogs, type Hex } from 'viem'
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { CHAIN, MESHPAY_ABI, MESHPAY_ADDRESS, REJECT_LABELS } from '@/lib/mesh'
import { toPayment } from '@/lib/items'
import { getOnline } from '@/lib/net'
import { getDeviceAccount, getState, updateItem, type StoredItem } from '@/lib/store'
import { useDeviceUsdc } from './useMeshData'

/** The device key can pay its own network fees once it holds this much USDC. */
const DEVICE_GAS_FLOOR = 20_000n

export interface SettleResult {
  settled: number
  skipped: number
  hash?: Hex
  /** Courier tips this phone earned for settling, in USDC base units. */
  tips: bigint
}

export function useSettle() {
  const { isConnected, chainId } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const client = usePublicClient({ chainId: CHAIN.id })
  const deviceUsdc = useDeviceUsdc()
  const [busy, setBusy] = useState(false)

  // The built-in device wallet pays the fee when it can. A connected external wallet is only the fallback.
  const via: 'wallet' | 'device' | null = deviceUsdc.raw >= DEVICE_GAS_FLOOR ? 'device' : isConnected ? 'wallet' : null

  const settle = useCallback(
    async (items: StoredItem[]): Promise<SettleResult> => {
      if (!getOnline()) throw new Error('You are offline. Payments stay safe on this phone until you reconnect.')
      if (!client) throw new Error('Network client unavailable.')
      if (!via) throw new Error('Get a little test USDC to pay the network fee. Copy your address from Add.')
      setBusy(true)
      try {
        const pending = items.filter((i) => i.status === 'pending')

        // Ask the contract first so duplicates never cost a transaction. A failed lookup just skips that payment.
        const ready: StoredItem[] = []
        const checks = await Promise.allSettled(
          pending.slice(0, 200).map((item) =>
            client.readContract({ address: MESHPAY_ADDRESS, abi: MESHPAY_ABI, functionName: 'check', args: [toPayment(item), item.signature] }),
          ),
        )
        pending.slice(0, 200).forEach((item, idx) => {
          const res = checks[idx]
          if (res.status !== 'fulfilled') return
          const code = Number(res.value)
          if (code === 0) ready.push(item)
          else if (code === 3) updateItem(item.id, { status: 'settled', note: 'Settled onchain' })
          else if (code === 2) updateItem(item.id, { status: 'expired', note: 'Past its deadline' })
          else if (code === 5) updateItem(item.id, { note: REJECT_LABELS[5] })
          else updateItem(item.id, { status: 'invalid', note: REJECT_LABELS[code] ?? 'Rejected' })
        })
        if (ready.length === 0) return { settled: 0, skipped: pending.length, tips: 0n }

        let settled = 0
        let tips = 0n
        let lastHash: Hex | undefined
        // The contract takes at most 50 payments per transaction.
        for (let start = 0; start < ready.length; start += 50) {
          const group = ready.slice(start, start + 50)
          const ps = group.map(toPayment)
          const sigs = group.map((i) => i.signature)
          let hash: Hex

          if (via === 'wallet') {
            if (chainId !== CHAIN.id) await switchChainAsync({ chainId: CHAIN.id })
            hash =
              ps.length === 1
                ? await writeContractAsync({ address: MESHPAY_ADDRESS, abi: MESHPAY_ABI, functionName: 'settle', args: [ps[0], sigs[0]], chainId: CHAIN.id })
                : await writeContractAsync({ address: MESHPAY_ADDRESS, abi: MESHPAY_ABI, functionName: 'settleBatch', args: [ps, sigs], chainId: CHAIN.id })
          } else {
            const wallet = createWalletClient({ account: getDeviceAccount(), chain: CHAIN, transport: http() })
            hash =
              ps.length === 1
                ? await wallet.writeContract({ address: MESHPAY_ADDRESS, abi: MESHPAY_ABI, functionName: 'settle', args: [ps[0], sigs[0]] })
                : await wallet.writeContract({ address: MESHPAY_ADDRESS, abi: MESHPAY_ABI, functionName: 'settleBatch', args: [ps, sigs] })
          }

          const receipt = await client.waitForTransactionReceipt({ hash })
          if (receipt.status !== 'success') throw new Error('The settlement transaction reverted.')
          lastHash = hash

          const logs = parseEventLogs({ abi: MESHPAY_ABI, logs: receipt.logs, eventName: ['Settled', 'Rejected'] })
          for (const item of group) {
            const from = item.from.toLowerCase()
            const nonce = BigInt(item.nonce)
            const ok = logs.find((l) => l.eventName === 'Settled' && l.args.from.toLowerCase() === from && l.args.nonce === nonce)
            const rejected = logs.find((l) => l.eventName === 'Rejected' && l.args.from.toLowerCase() === from && l.args.nonce === nonce)
            if (rejected && rejected.eventName === 'Rejected') {
              const code = Number(rejected.args.code)
              updateItem(item.id, {
                status: code === 3 ? 'duplicate' : code === 2 ? 'expired' : code === 5 ? 'pending' : 'invalid',
                note: REJECT_LABELS[code] ?? 'Rejected',
              })
            } else if (ok) {
              settled += 1
              if (ok.eventName === 'Settled' && item.from.toLowerCase() !== getState().address.toLowerCase()) tips += ok.args.fee
              updateItem(item.id, { status: 'settled', txHash: hash, note: undefined })
            }
          }
        }
        return { settled, skipped: pending.length - settled, hash: lastHash, tips }
      } finally {
        setBusy(false)
      }
    },
    [client, via, chainId, writeContractAsync, switchChainAsync],
  )

  return { settle, busy, via }
}
