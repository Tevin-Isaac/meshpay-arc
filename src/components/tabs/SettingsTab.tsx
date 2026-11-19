import { IS_MAINNET, NETWORK_LABEL } from '@/lib/network'
import { useRampConfig } from '@/lib/ramp'
import { type ComponentType, type ReactNode } from 'react'
import { ExternalWalletCard } from '../ExternalWallet'
import { Pencil, ArrowUpFromLine, ChevronRight, Copy, Droplets, ExternalLink, Gauge, HandCoins, Bot, Link2, ShieldCheck, CreditCard, Smartphone } from 'lucide-react'
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
import { useSheets, type SheetName } from '../shell/useSheets'

function Row({ icon: Icon, title, hint, onClick, warn, disabled, status }: { icon: ComponentType<{ className?: string }>; title: string; hint: string; onClick: () => void; warn?: boolean; disabled?: boolean; status?: string }) {
  return (
    <li>
      <button onClick={onClick} disabled={disabled} aria-disabled={disabled} className="flex min-h-16 w-full items-center gap-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: warn ? 'var(--tint-warn)' : 'var(--tint-accent)', color: warn ? 'var(--warn)' : 'var(--accent)' }}
        >
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block text-xs text-pretty" style={{ color: warn ? 'var(--warn)' : 'var(--muted)' }}>
            {hint}
          </span>
        </span>
        {status && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: disabled ? 'var(--tint-warn)' : 'var(--tint-accent)', color: disabled ? 'var(--warn)' : 'var(--accent-hover)' }}>
            {status}
          </span>
        )}
        {!disabled && <ChevronRight className="size-4 shrink-0" style={{ color: 'var(--subtle)' }} />}
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
            Wallet name
          </label>
          <div className="relative">
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
            style={{ color: 'var(--ink)', borderBottom: '1px dashed var(--border)', paddingRight: 24 }}
          />
          <Pencil className="pointer-events-none absolute right-0 top-1/2 size-3.5 -translate-y-1/2" style={{ color: 'var(--subtle)' }} aria-hidden="true" />
          </div>
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
        Tap the name to rename your wallet. It shows at the top of the app and on your contact card, and is saved only on this device.
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
  const sheets = useSheets()
  const canBuy = useOnrampAvailable()
  const ramp = useRampConfig()
  const { address } = useMeshState()
  const open = (n: Exclude<SheetName, null>) => () => sheets.open(n)

  return (
    <div className="space-y-3">
      <ProfileCard />
      <ExternalWalletCard />

      <Group title="Add funds & cash out">
        {!IS_MAINNET && (
          <Row icon={Droplets} title="Get test USDC" hint="Free test USDC from Circle's faucet, no real value" onClick={open('add')} />
        )}
        <Row icon={HandCoins} title="Move wallet balance into offline reserve" hint="Fill the reserve you can spend with no internet" onClick={open('add')} />
        <Row icon={Link2} title="Add from a connected wallet" hint="Optional. Needs an external wallet connected above" onClick={open('add')} />
        <Row
          icon={Smartphone}
          title="M-Pesa: add money or cash out"
          hint={ramp ? (ramp.mock ? 'Test mode: simulated, no real money moves' : 'Add money or cash out with M-Pesa') : 'Needs the payment server, which is not connected'}
          status={ramp ? 'Available' : 'Not connected'}
          disabled={!ramp}
          onClick={open('mpesa')}
        />
        <Row
          icon={CreditCard}
          title="Card or bank top-up"
          hint={canBuy ? (IS_MAINNET ? 'Buy USDC with a card or bank transfer' : 'Test mode only: Circle sandbox, no real money') : 'Needs the payment provider connected; test mode only until then'}
          status={canBuy ? 'Available' : 'Not connected'}
          disabled={!canBuy}
          onClick={open('buy')}
        />
        <Row icon={ArrowUpFromLine} title="Cash out or withdraw" hint="Send to M-Pesa or any address, or withdraw the reserve to this wallet" onClick={open('cashout')} />
      </Group>

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

      <Group title="Automation">
        <Row icon={Bot} title="Autopilot" hint={standing.length ? `${standing.filter((s) => s.active).length} standing payments running` : 'Recurring payments that sign offline'} onClick={open('agent')} />
      </Group>

      <section className="glass rounded-3xl px-5 py-4" aria-label="Network">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--subtle)' }}>
          Network
        </h2>
        <dl className="mt-2 space-y-1.5 text-xs">
          <div className="flex justify-between gap-3">
            <dt style={{ color: 'var(--muted)' }}>Network</dt>
            <dd className="font-semibold">{NETWORK_LABEL}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt style={{ color: 'var(--muted)' }}>Chain ID</dt>
            <dd className="font-semibold tabular-nums">{CHAIN.id}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt style={{ color: 'var(--muted)' }}>This wallet</dt>
            <dd className="mono font-semibold">{shortAddress(address)}</dd>
          </div>
        </dl>
        <a
          href={buildAddressExplorerUrl(CHAIN.id, MESHPAY_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold"
          style={{ color: 'var(--accent)' }}
        >
          Settlement contract {shortAddress(MESHPAY_ADDRESS)} <ExternalLink className="size-3" />
        </a>
      </section>

      <section className="glass space-y-1.5 rounded-3xl p-5 text-xs" style={{ color: 'var(--muted)' }}>
        <div className="font-semibold" style={{ color: 'var(--ink)' }}>
          About
        </div>
        <p>{IS_MAINNET ? 'Wayamesh web wallet · Arc mainnet · beta, keep small amounts.' : 'Wayamesh web wallet · Arc Testnet · test USDC only.'}</p>
      </section>
    </div>
  )
}
