import { type ComponentType, type ReactNode } from 'react'
import { useAccount } from 'wagmi'
import { ChevronRight, Copy, ExternalLink, Gauge, HandCoins, Bot, ShieldCheck, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { CHAIN, MESHPAY_ADDRESS } from '@/lib/mesh'
import { shortAddress } from '@/lib/format'
import { useMeshState } from '@/lib/store'
import { useOnrampAvailable } from '@/hooks/useMeshData'
import { DemoCard } from '../DemoCard'
import { useSheets, type SheetName } from '../shell/useSheets'

function Row({ icon: Icon, title, hint, onClick, warn }: { icon: ComponentType<{ className?: string }>; title: string; hint: string; onClick: () => void; warn?: boolean }) {
  return (
    <li>
      <button onClick={onClick} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: warn ? 'rgba(245,166,35,0.14)' : 'rgba(62,217,184,0.12)', color: warn ? 'var(--warn)' : 'var(--accent)' }}
        >
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block truncate text-xs" style={{ color: warn ? 'var(--warn)' : 'var(--muted)' }}>
            {hint}
          </span>
        </span>
        <ChevronRight className="size-4" style={{ color: 'var(--subtle)' }} />
      </button>
    </li>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass rounded-3xl px-5 py-3">
      <h2 className="pt-2 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--subtle)' }}>
        {title}
      </h2>
      <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {children}
      </ul>
    </section>
  )
}

export function SettingsTab() {
  const { address, status, standing } = useMeshState()
  const { isConnected, address: wallet } = useAccount()
  const sheets = useSheets()
  const canBuy = useOnrampAvailable()
  const open = (n: Exclude<SheetName, null>) => () => sheets.open(n)

  return (
    <div className="space-y-3">
      <section className="glass rounded-3xl p-5">
        <h1 className="display text-xl font-bold">Settings</h1>
        <div className="inner mt-3 flex items-center gap-3 rounded-2xl p-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
              This device
            </div>
            <div className="mono truncate text-sm">{shortAddress(address)}</div>
            {isConnected && wallet && (
              <div className="mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>
                Wallet connected: <span className="mono">{shortAddress(wallet)}</span>
              </div>
            )}
          </div>
          <button
            aria-label="Copy address"
            className="flex size-11 items-center justify-center rounded-full"
            style={{ background: 'var(--surface-muted)' }}
            onClick={() => void navigator.clipboard.writeText(address).then(() => toast.success('Address copied.'))}
          >
            <Copy className="size-4" />
          </button>
        </div>
      </section>

      <Group title="Protect">
        <Row
          icon={ShieldCheck}
          title="Security"
          hint={status === 'plain' ? 'Not protected. Set a PIN now' : 'PIN, auto-lock, recovery phrase, backup'}
          warn={status === 'plain'}
          onClick={open('security')}
        />
        <Row icon={Gauge} title="Spending limits" hint="Per payment, per day, and what you accept offline" onClick={open('limits')} />
      </Group>

      <Group title="Money">
        <Row icon={HandCoins} title="Add funds or cash out" hint="Top up the offline balance, or send it to a wallet or exchange" onClick={open('add')} />
        {canBuy && <Row icon={CreditCard} title="Buy USDC" hint="Card or bank transfer (sandbox)" onClick={open('buy')} />}
        <Row icon={Bot} title="Autopilot" hint={standing.length ? `${standing.filter((s) => s.active).length} standing payments running` : 'Recurring payments that sign offline'} onClick={open('agent')} />
      </Group>

      <DemoCard />

      <section className="glass space-y-1.5 rounded-3xl p-5 text-xs" style={{ color: 'var(--muted)' }}>
        <div className="font-semibold" style={{ color: 'var(--ink)' }}>
          About
        </div>
        <p>WayaMesh web wallet · Arc Testnet · test USDC only.</p>
        <a
          href={buildAddressExplorerUrl(CHAIN.id, MESHPAY_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 font-semibold"
          style={{ color: 'var(--accent)' }}
        >
          Settlement contract {shortAddress(MESHPAY_ADDRESS)} <ExternalLink className="size-3" />
        </a>
      </section>
    </div>
  )
}
