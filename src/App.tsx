import { ExternalLink } from 'lucide-react'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { CHAIN, MESHPAY_ADDRESS } from '@/lib/mesh'
import { WalletApp } from '@/components/WalletApp'
import { DemoCard } from '@/components/DemoCard'

/** The product itself: one wallet screen that pays online or offline. */
export default function App() {
  return (
    <div className="page-glow relative isolate min-h-dvh">
      <main className="mx-auto w-full max-w-md space-y-3 px-4 pb-24 pt-[max(env(safe-area-inset-top),16px)]">
        <WalletApp />
        <DemoCard />
        <a
          href={buildAddressExplorerUrl(CHAIN.id, MESHPAY_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="mx-auto flex min-h-11 w-fit items-center gap-1.5 text-xs font-semibold"
          style={{ color: 'var(--muted)' }}
        >
          Arc Testnet demo · View contract <ExternalLink className="size-3" />
        </a>
      </main>
    </div>
  )
}
