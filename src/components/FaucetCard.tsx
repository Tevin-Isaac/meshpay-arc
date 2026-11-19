import { Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { FAUCET_URL, NETWORK_LABEL } from '@/lib/network'
import { shortAddress } from '@/lib/format'
import { useDevice, useDeviceUsdc } from '@/hooks/useMeshData'

/** Below this much USDC in the wallet the faucet card is shown on the home screen. */
export const LOW_WALLET = 1_000_000n

export function copyAddress(address: string, then = 'Address copied.') {
  void navigator.clipboard.writeText(address).then(
    () => toast.success(then),
    () => toast.error('Could not copy. Open Receive to see your address.'),
  )
}

/** Free test USDC from Circle's faucet. Testnet only: renders nothing on mainnet. */
export function FaucetCard({ always = false }: { always?: boolean }) {
  const device = useDevice()
  const wallet = useDeviceUsdc()
  if (!FAUCET_URL) return null
  const low = wallet.known !== null && wallet.known < LOW_WALLET
  if (!always && !low) return null
  return (
    <section className="glass rounded-3xl p-5" aria-label="Get test USDC">
      <h2 className="display text-lg font-bold">Get test USDC</h2>
      <p className="mt-1 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        Free test USDC from Circle: choose {NETWORK_LABEL}, paste your address and request. It has no real value.
      </p>
      <div className="inner mt-3 flex items-center gap-2 rounded-2xl p-3">
        <span className="mono min-w-0 flex-1 truncate text-xs" data-testid="faucet-address" title={device.address}>
          {shortAddress(device.address)}
        </span>
        <button
          onClick={() => copyAddress(device.address, 'Address copied. Paste it at the faucet.')}
          aria-label="Copy my address"
          className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <Copy className="size-3.5" /> Copy
        </button>
      </div>
      <a
        href={FAUCET_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
      >
        Open faucet <ExternalLink className="size-4" />
      </a>
    </section>
  )
}
