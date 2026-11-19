import { IS_MAINNET } from '@/lib/network'
import { useRampConfig } from '@/lib/ramp'
import { type ComponentType, type ReactNode } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { ChevronRight, Copy, ExternalLink, Gauge, HandCoins, Bot, ShieldCheck, CreditCard, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { CHAIN, MESHPAY_ADDRESS } from '@/lib/mesh'
import { shortAddress } from '@/lib/format'
import { setSettings, useMeshState } from '@/lib/store'
import { useState } from 'react'
import { Avatar } from '../Avatar'
import { ContactSheet } from '../ContactSheet'
import { QrCode as QrIcon } from 'lucide-react'
import { useOnrampAvailable } from '@/hooks/useMeshData'
import { AppearanceRow } from '../ThemeToggle'
import { useSheets, type SheetName } from '../shell/useSheets'

function Row({ icon: Icon, title, hint, onClick, warn }: { icon: ComponentType<{ className?: string }>; title: string; hint: string; onClick: () => void; warn?: boolean }) {
  return (
    <li>
      <button onClick={onClick} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: warn ? 'var(--tint-warn)' : 'var(--tint-accent)', color: warn ? 'var(--warn)' : 'var(--accent)' }}
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

function ProfileCard() {
  const { address, settings } = useMeshState()
  const [name, setName] = useState(settings.displayName)
  const [card, setCard] = useState(false)
  const save = () => {
    const clean = name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24)
    setName(clean)
    if (clean !== settings.displayName) setSettings({ displayName: clean })
  }
  return (
    <section className="glass rounded-3xl p-5" id="profile" aria-label="Your profile">
      <div className="flex items-center gap-4">
        <Avatar seed={address} name={settings.displayName} size={72} />
        <div className="min-w-0 flex-1">
          <label htmlFor="display-name" className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
            Your name
          </label>
          <input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 24))}
            onBlur={save}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            placeholder="Your wallet"
            maxLength={24}
            autoComplete="off"
            className="display w-full truncate bg-transparent text-xl font-bold outline-none"
            style={{ color: 'var(--ink)', borderBottom: '1px dashed var(--border)' }}
          />
          <div className="mt-1 flex items-center gap-1.5">
            <span className="mono truncate text-xs" style={{ color: 'var(--muted)' }}>
              {shortAddress(address)}
            </span>
            <button
              aria-label="Copy address"
              className="flex size-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--surface-muted)' }}
              onClick={() => void navigator.clipboard.writeText(address).then(() => toast.success('Address copied.'), () => toast.error('Could not copy.'))}
            >
              <Copy className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        This name is saved only on this device. It goes on your contact card so people you share it with see it.
      </p>
      <button
        onClick={() => setCard(true)}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
        style={{ background: 'var(--tint-accent)', color: 'var(--accent-hover)', border: '1px solid var(--line-accent)' }}
      >
        <QrIcon className="size-4" /> My contact card
      </button>
      <ContactSheet open={card} onClose={() => setCard(false)} />
    </section>
  )
}

export function SettingsTab() {
  const { status, standing } = useMeshState()
  const { isConnected, address: wallet } = useAccount()
  const { disconnect } = useDisconnect()
  const sheets = useSheets()
  const canBuy = useOnrampAvailable()
  const ramp = useRampConfig()
  const open = (n: Exclude<SheetName, null>) => () => sheets.open(n)

  return (
    <div className="space-y-3">
      <ProfileCard />

      <section className="glass rounded-3xl p-5">
        <AppearanceRow />
      </section>

      <section className="glass rounded-3xl p-5" aria-label="External wallet (optional)">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--subtle)' }}>
          External wallet (optional)
        </h2>
        <p className="mt-2 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
          Wayamesh works fully on its own. Connect MetaMask, or a wallet app on your phone through WalletConnect, only if you want to top up from it. External wallets
          bring their own risks.
        </p>
        {isConnected && wallet ? (
          <div className="inner mt-3 flex items-center gap-3 rounded-2xl p-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                Connected
              </div>
              <div className="mono truncate text-sm">{shortAddress(wallet)}</div>
            </div>
            <button onClick={() => disconnect()} className="min-h-11 rounded-full px-4 text-xs font-semibold" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              Disconnect
            </button>
          </div>
        ) : (
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
        )}
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
        <Row icon={HandCoins} title="Add funds or cash out" hint="Get test USDC, fill the offline reserve, or cash out" onClick={open('add')} />
        {ramp && <Row icon={Smartphone} title="M-Pesa" hint={ramp.mock ? 'Add money or cash out (sandbox)' : 'Add money or cash out'} onClick={open('mpesa')} />}
        {canBuy && <Row icon={CreditCard} title="Buy USDC" hint={IS_MAINNET ? 'Card or bank transfer' : 'Card or bank transfer (sandbox)'} onClick={open('buy')} />}
        <Row icon={Bot} title="Autopilot" hint={standing.length ? `${standing.filter((s) => s.active).length} standing payments running` : 'Recurring payments that sign offline'} onClick={open('agent')} />
      </Group>

      <section className="glass space-y-1.5 rounded-3xl p-5 text-xs" style={{ color: 'var(--muted)' }}>
        <div className="font-semibold" style={{ color: 'var(--ink)' }}>
          About
        </div>
        <p>{IS_MAINNET ? 'WayaMesh web wallet · Arc mainnet · beta, keep small amounts.' : 'WayaMesh web wallet · Arc Testnet · test USDC only.'}</p>
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
