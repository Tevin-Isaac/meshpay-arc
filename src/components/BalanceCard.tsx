import { Smartphone, ArrowUpRight, ArrowDownLeft, CreditCard, Gauge, Plus, ScanLine, ShieldCheck } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { fmtExact, fmtUsdc, timeAgo } from '@/lib/format'
import { roleOf } from '@/lib/items'
import { useMeshState } from '@/lib/store'
import { showUsdc } from '@/lib/balance'
import { NETWORK_LABEL } from '@/lib/network'
import { useNet } from '@/lib/net'
import { useBalances, useMyAddresses } from '@/hooks/useMeshData'

interface Actions {
  onSend: () => void
  onReceive: () => void
  onScan: () => void
  onAdd: () => void
  onLimits: () => void
  onSecurity: () => void
  onBuy: () => void
  canBuy: boolean
  onMpesa?: () => void
}

export function BalanceCard({ onSend, onReceive, onScan, onAdd, onLimits, onSecurity, onBuy, canBuy, onMpesa }: Actions) {
  const { wallet, reserve, committed, spendable, total, live, at } = useBalances()
  const { items, settings, status } = useMeshState()
  const { online } = useNet()
  const hide = settings.hideBalances ? 'select-none blur-md' : ''
  const mine = useMyAddresses()
  const incoming = items
    .filter((i) => i.status === 'pending' && roleOf(i, mine) === 'in')
    .reduce((sum, i) => sum + BigInt(i.amount), 0n)

  const sub =
    total === null
      ? online
        ? 'Reading your balance from Arc…'
        : 'You are offline and no balance has been saved yet.'
      : live
        ? 'Live from Arc. Spend it online, or offline from the reserve.'
        : `Last known${at ? `, ${timeAgo(at)}` : ''}. Updates when you are back online.`

  const actions = [
    { label: 'Send', icon: ArrowUpRight, onClick: onSend, primary: true },
    { label: 'Receive', icon: ArrowDownLeft, onClick: onReceive },
    { label: 'Scan', icon: ScanLine, onClick: onScan },
    { label: 'Add', icon: Plus, onClick: onAdd },
  ]

  return (
    <section className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
          Total balance
        </span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: online ? 'var(--success)' : 'var(--warn)' }} role="status">
            <span className="size-1.5 rounded-full" style={{ background: 'currentColor' }} />
            {online ? 'Online' : 'Offline'}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold min-[400px]:hidden"
            style={{ background: 'var(--tint-accent)', color: 'var(--accent-hover)' }}
          >
            {NETWORK_LABEL}
          </span>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <TokenUSDC variant="branded" size={28} />
        <span className={`display text-5xl font-bold tabular-nums ${hide}`} style={{ color: 'var(--ink)' }} data-testid="total-balance">
          {showUsdc(total, fmtUsdc)}
        </span>
        <span className="mt-3 text-lg font-medium" style={{ color: 'var(--subtle)' }}>
          USDC
        </span>
      </div>
      <p className="mt-1.5 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        {sub}
      </p>

      <div className="inner mt-3 divide-y rounded-2xl text-xs" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderColor: 'var(--border)' }}>
          <span style={{ color: 'var(--muted)' }}>In wallet</span>
          <span className={`font-semibold tabular-nums ${hide}`} style={{ color: 'var(--ink)' }} data-testid="in-wallet">
            {showUsdc(wallet.known, fmtExact)} USDC
          </span>
        </div>
        <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderColor: 'var(--border)' }}>
          <span style={{ color: 'var(--muted)' }}>Offline reserve</span>
          <span className={`font-semibold tabular-nums ${hide}`} style={{ color: 'var(--ink)' }} data-testid="offline-reserve">
            {showUsdc(spendable, fmtExact)} USDC
          </span>
        </div>
        {committed > 0n && (
          <div className="flex items-center justify-between px-3.5 py-2 text-[11px]" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--muted)' }}>Waiting to settle</span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--warn)' }}>
              {fmtExact(committed)} USDC
            </span>
          </div>
        )}
      </div>
      {reserve.raw !== null && committed > 0n && (
        <p className="mt-1.5 text-[11px] text-pretty" style={{ color: 'var(--subtle)' }}>
          Offline reserve is already net of signed payments that have not settled yet.
        </p>
      )}

      {incoming > 0n && (
        <div className="mt-3 text-xs tabular-nums" style={{ color: 'var(--success)' }}>
          {fmtExact(incoming)} incoming
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button onClick={onLimits} className="flex min-h-11 items-center gap-1 text-xs font-semibold" style={{ color: 'var(--accent-hover)' }}>
          <Gauge className="size-4" /> Limits
        </button>
        <button
          onClick={onSecurity}
          className="flex min-h-11 items-center gap-1 text-xs font-semibold"
          style={{ color: status === 'plain' ? 'var(--warn)' : 'var(--accent-hover)' }}
        >
          <ShieldCheck className="size-4" /> Security
        </button>
      </div>

      <div className="mt-1 grid grid-cols-4 gap-2">
        {actions.map(({ label, icon: Icon, onClick, primary }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-2xl text-xs font-semibold transition-transform active:scale-[0.97]"
            style={
              primary
                ? { background: 'var(--accent)', color: 'var(--on-accent)' }
                : { background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }
            }
          >
            <Icon className="size-5" />
            {label}
          </button>
        ))}
      </div>

      {onMpesa && (
        <button
          onClick={onMpesa}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-xs font-semibold"
          style={{ color: 'var(--accent-hover)' }}
        >
          <Smartphone className="size-4" /> Add money or cash out with M-Pesa
        </button>
      )}
      {canBuy && (
        <button
          onClick={onBuy}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-xs font-semibold"
          style={{ color: 'var(--accent-hover)' }}
        >
          <CreditCard className="size-4" /> Buy USDC with a bank or card
        </button>
      )}
    </section>
  )
}
