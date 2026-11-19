import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ConnectKitButton } from 'connectkit'
import { erc20Abi } from 'viem'
import { useAccount, useDisconnect, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { fmtExact, shortAddress, timeAgo } from '@/lib/format'
import { showUsdc } from '@/lib/balance'
import { OTHER_NETWORKS, readArcUsdc, readOtherUsdc } from '@/lib/chains'
import { parseOnchainError } from '@/lib/errors'
import { CHAIN, USDC_ADDRESS } from '@/lib/mesh'
import { NETWORK_LABEL } from '@/lib/network'
import { useNet } from '@/lib/net'
import { useDevice } from '@/hooks/useMeshData'
import { AmountInput, PrimaryButton, Sheet } from './ui'

/** Read-only balances of the connected external wallet: Arc exactly, and USDC on other networks. */
function useExternalBalances(address: `0x${string}` | undefined) {
  const { online } = useNet()
  return useQuery({
    queryKey: ['external-usdc', address],
    enabled: online && !!address,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
    queryFn: async () => {
      if (!address) throw new Error('No wallet')
      const [arc, others] = await Promise.all([readArcUsdc(address).then((v) => v, () => null), readOtherUsdc(address)])
      return { arc, others, at: Date.now() }
    },
  })
}

function Row({ label, raw, strong }: { label: string; raw: bigint | null | undefined; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs" style={{ borderColor: 'var(--border)' }}>
      <span style={{ color: strong ? 'var(--ink)' : 'var(--muted)' }} className={strong ? 'font-semibold' : ''}>
        {label}
      </span>
      <span className="font-semibold tabular-nums">
        {raw === undefined ? '—' : raw === null ? <span style={{ color: 'var(--warn)' }}>unavailable</span> : `${showUsdc(raw, fmtExact)} USDC`}
      </span>
    </div>
  )
}

/** Sends USDC on Arc from the connected wallet to this device's own address. */
function AddToWayameshSheet({ open, onClose, available }: { open: boolean; onClose: () => void; available: bigint }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add to my Wayamesh wallet">
      <TopUpBody onClose={onClose} available={available} />
    </Sheet>
  )
}

function TopUpBody({ onClose, available }: { onClose: () => void; available: bigint }) {
  const device = useDevice()
  const { chainId } = useAccount()
  const client = usePublicClient({ chainId: CHAIN.id })
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async () => {
    if (!client) return
    try {
      const raw = parseUsdc(amount)
      if (raw <= 0n) return toast.error('Enter an amount above zero.')
      if (raw > available) return toast.error('That is more than your connected wallet holds.')
      setBusy(true)
      if (chainId !== CHAIN.id) await switchChainAsync({ chainId: CHAIN.id })
      const hash = await writeContractAsync({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'transfer', args: [device.address, raw], chainId: CHAIN.id })
      await client.waitForTransactionReceipt({ hash })
      toast.success(`Added ${fmtExact(raw)} USDC to your Wayamesh wallet.`)
      onClose()
    } catch (e) {
      const msg = parseOnchainError(e)
      if (msg) toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
        Sends USDC on {NETWORK_LABEL} from your connected wallet to this Wayamesh wallet ({shortAddress(device.address)}). Your connected wallet asks you to confirm.
      </p>
      <AmountInput value={amount} onChange={setAmount} hint={`Connected wallet ${fmtExact(available)} · Max`} onHint={available > 0n ? () => setAmount(formatUsdc(available)) : undefined} />
      <PrimaryButton onClick={() => void go()} loading={busy} disabled={!amount}>
        {busy ? 'Confirm in your wallet…' : 'Add to my Wayamesh wallet'}
      </PrimaryButton>
    </div>
  )
}

export function ExternalWalletCard() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const [topUp, setTopUp] = useState(false)
  const q = useExternalBalances(address)
  const connected = isConnected && !!address

  return (
    <section className="glass rounded-3xl p-5" aria-label="External wallet (optional)">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--subtle)' }}>
        External wallet (optional)
      </h2>
      <p className="mt-2 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        Wayamesh works fully on its own. Connect MetaMask, or a wallet app on your phone through WalletConnect, only if you want to top up from it. External wallets
        bring their own risks.
      </p>
      {!connected ? (
        <ConnectKitButton.Custom>
          {({ show }) => (
            <button
              onClick={show}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
              style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }}
            >
              Connect an external wallet
            </button>
          )}
        </ConnectKitButton.Custom>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="inner flex items-center gap-3 rounded-2xl p-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                Connected
              </div>
              <div className="mono truncate text-sm">{shortAddress(address)}</div>
            </div>
            <button onClick={() => disconnect()} className="min-h-11 rounded-full px-4 text-xs font-semibold" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              Disconnect
            </button>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold">Its USDC balances (read only)</span>
              <button
                onClick={() => void q.refetch()}
                disabled={q.isFetching}
                aria-label="Refresh balances"
                className="flex size-11 items-center justify-center rounded-full disabled:opacity-50"
                style={{ background: 'var(--surface-muted)' }}
              >
                <RefreshCw className={`size-4 ${q.isFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="inner divide-y rounded-2xl" style={{ borderColor: 'var(--border)' }}>
              <Row label={`${NETWORK_LABEL} (usable here)`} raw={q.data ? q.data.arc : undefined} strong />
              {OTHER_NETWORKS.map((n) => (
                <Row key={n.id} label={n.name} raw={q.data ? q.data.others.find((o) => o.id === n.id)?.raw : undefined} />
              ))}
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: 'var(--subtle)' }}>
              {q.data ? `Last updated ${timeAgo(q.data.at)}.` : q.isFetching ? 'Reading balances…' : 'Balances load when you are online.'}
            </p>
          </div>

          <PrimaryButton onClick={() => setTopUp(true)} disabled={!q.data?.arc || q.data.arc === 0n}>
            Add to my Wayamesh wallet
          </PrimaryButton>
          <p className="text-[11px] text-pretty" style={{ color: 'var(--subtle)' }}>
            USDC on other networks can't be used here until it is moved to Arc. Cross-chain transfer is coming.
          </p>
          <AddToWayameshSheet open={topUp} onClose={() => setTopUp(false)} available={q.data?.arc ?? 0n} />
        </div>
      )}
    </section>
  )
}

