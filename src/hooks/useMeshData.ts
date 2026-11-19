import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { erc20Abi, type Address } from 'viem'
import { useAccount, usePublicClient, useReadContract } from 'wagmi'
import { CHAIN, MESHPAY_ABI, MESHPAY_ADDRESS, USDC_ADDRESS } from '@/lib/mesh'
import { toPayment } from '@/lib/items'
import { useNet } from '@/lib/net'
import { getDeviceAccount, setReserveCache, updateItem, useMeshState, type StoredItem } from '@/lib/store'

export function useDevice() {
  const { status } = useMeshState()
  return useMemo(() => {
    void status
    return getDeviceAccount()
  }, [status])
}

/** Addresses that count as "me" when deciding if a payment is addressed to this user. */
export function useMyAddresses(): Address[] {
  const device = useDevice()
  const { address } = useAccount()
  return address ? [device.address, address] : [device.address]
}

/** Offline reserve of the device key. Falls back to the last value seen while offline. */
export function useReserve() {
  const device = useDevice()
  const { online } = useNet()
  const { reserveCache } = useMeshState()
  const q = useReadContract({
    address: MESHPAY_ADDRESS,
    abi: MESHPAY_ABI,
    functionName: 'reserve',
    args: [device.address],
    chainId: CHAIN.id,
    query: { enabled: online, refetchInterval: 8000 },
  })

  useEffect(() => {
    if (q.data !== undefined) setReserveCache(q.data)
  }, [q.data])

  const live = online && q.data !== undefined
  const raw = live ? q.data : reserveCache ? BigInt(reserveCache.raw) : null
  return { raw, live, at: reserveCache?.at ?? null, refetch: q.refetch }
}

/** Reserve minus payments already signed but not yet settled. */
export function useSpendable() {
  const reserve = useReserve()
  const { items } = useMeshState()
  const committed = items
    .filter((i) => i.source === 'signed' && i.status === 'pending')
    .reduce((sum, i) => sum + BigInt(i.amount) + BigInt(i.fee ?? '0'), 0n)
  const spendable = reserve.raw === null ? null : reserve.raw > committed ? reserve.raw - committed : 0n
  return { reserve, committed, spendable }
}

/** USDC in the connected wallet, for paying online. Null when no wallet is connected. */
export function useWalletUsdc() {
  const { address } = useAccount()
  const { online } = useNet()
  const q = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN.id,
    query: { enabled: !!address && online, refetchInterval: 8000 },
  })
  return address && q.data !== undefined ? q.data : null
}

/** USDC received straight to the device address (the same pool that pays its network fees). */
export function useDeviceUsdc() {
  const device = useDevice()
  const { online } = useNet()
  const q = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [device.address],
    chainId: CHAIN.id,
    query: { enabled: online, refetchInterval: 8000 },
  })
  return { raw: q.data ?? 0n, refetch: q.refetch }
}

/** Asks the contract about every pending payment while online and settles obvious outcomes. */
export function useChecks(items: StoredItem[]) {
  const client = usePublicClient({ chainId: CHAIN.id })
  const { online } = useNet()
  const pending = useMemo(() => items.filter((i) => i.status === 'pending'), [items])
  const key = pending.map((i) => i.id).join(',')

  const q = useQuery({
    queryKey: ['mesh-checks', key],
    enabled: online && pending.length > 0 && !!client,
    refetchInterval: 15000,
    queryFn: async () => {
      const out: Record<string, number> = {}
      const list = pending.slice(0, 100)
      // A few at a time, so a long list cannot flood the connection.
      for (let i = 0; i < list.length; i += 10) {
        await Promise.allSettled(
          list.slice(i, i + 10).map(async (item) => {
            const code = await client!.readContract({
              address: MESHPAY_ADDRESS,
              abi: MESHPAY_ABI,
              functionName: 'check',
              args: [toPayment(item), item.signature],
            })
            out[item.id] = Number(code)
          }),
        )
      }
      // A funded payment is still at risk if its payer has asked to withdraw before it can be settled.
      const payers = [...new Set(list.filter((i) => out[i.id] === 0 && i.source === 'received').map((i) => i.from))]
      for (const payer of payers.slice(0, 20)) {
        try {
          const [amount, unlockAt] = await client!.readContract({
            address: MESHPAY_ADDRESS,
            abi: MESHPAY_ABI,
            functionName: 'withdrawalRequest',
            args: [payer],
          })
          if (amount > 0n) {
            for (const item of list) {
              if (item.from === payer && out[item.id] === 0 && BigInt(item.deadline) > unlockAt) out[item.id] = 100
            }
          }
        } catch {
          // unknown: leave as funded
        }
      }
      return out
    },
  })

  useEffect(() => {
    if (!q.data) return
    for (const [id, code] of Object.entries(q.data)) {
      if (code === 3) updateItem(id, { status: 'duplicate', note: 'Already settled onchain' })
      else if (code === 2) updateItem(id, { status: 'expired', note: 'Past its deadline' })
      else if (code === 1 || code === 4) updateItem(id, { status: 'invalid', note: 'Rejected by the contract' })
    }
  }, [q.data])

  return q.data ?? {}
}

/** The Buy USDC backend only runs next to the dev server. Hide Buy when it is not reachable. */
export function useOnrampAvailable() {
  const { online } = useNet()
  const q = useQuery({
    queryKey: ['onramp-health'],
    enabled: online,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const res = await fetch('/api/health')
        if (!res.ok) return false
        const body = (await res.json()) as { ok?: boolean }
        return body.ok === true
      } catch {
        return false
      }
    },
  })
  return q.data === true
}
