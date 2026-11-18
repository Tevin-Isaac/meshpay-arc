import { ExternalLink } from 'lucide-react'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { CHAIN, MESHPAY_ADDRESS } from '@/lib/mesh'

export function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-5 pb-28 pt-6">
      <div className="flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
        <p>MeshPay is a testnet demo. Test USDC has no value.</p>
        <a
          href={buildAddressExplorerUrl(CHAIN.id, MESHPAY_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 font-semibold"
          style={{ color: 'var(--accent-hover)' }}
        >
          View the contract on Arc Testnet <ExternalLink className="size-3.5" />
        </a>
      </div>
    </footer>
  )
}
