import { ArrowUpRight, ArrowDownLeft, CreditCard, Gauge, Plus, ScanLine, ShieldCheck } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { fmtUsdc, timeAgo } from '@/lib/format'
import { roleOf } from '@/lib/items'
import { useMeshState } from '@/lib/store'
import { useMyAddresses, useSpendable, useWalletUsdc } from '@/hooks/useMeshData'

interface Actions {
  onSend: () => void
  onReceive: () => void
  onScan: () => void
  onAdd: () => void
  onLimits: () => void
  onSecurity: () => void
  onBuy: () => void
  canBuy: boolean
}

export function BalanceCard({ onSend, onReceive, onScan, onAdd, onLimits, onSecurity, onBuy, canBuy }: Actions) {
  const { spendable, reserve, committed } = useSpendable()
  const { items, settings, status } = useMeshState()
  const hide = settings.hideBalances ? 'select-none blur-md' : ''
  const wallet = useWalletUsdc()
  const mine = useMyAddresses()
  const incoming = items
    .filter((i) => i.status === 'pending' && roleOf(i, mine) === 'in')
    .reduce((sum, i) => sum + BigInt(i.amount), 0n)

  const sub =
    spendable === null
      ? 'Add funds while online to start paying offline.'
      : reserve.live
        ? 'Live from Arc. Spendable with no internet.'
        : `Last seen ${reserve.at ? timeAgo(reserve.at) : 'earlier'}. Spendable with no internet.`

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
          Offline balance
        </span>
        <div className="flex items-center">
          <button onClick={onLimits} className="flex min-h-11 items-center gap-1 px-2 text-xs font-semibold" style={{ color: 'var(--accent-hover)' }}>
            <Gauge className="size-4" /> Limits
          </button>
          <button
            onClick={onSecurity}
            className="flex min-h-11 items-center gap-1 pl-2 text-xs font-semibold"
            style={{ color: status === 'plain' ? 'var(--warn)' : 'var(--accent-hover)' }}
          >
            <ShieldCheck className="size-4" /> Security
          </button>
        </div>
      </div>

      <div className="-mt-1 flex items-center gap-2">
        <TokenUSDC variant="branded" size={28} />
        <span className={`display text-5xl font-bold tabular-nums ${hide}`} style={{ color: 'var(--ink)' }}>
          {spendable === null ? '—' : fmtUsdc(spendable)}
        </span>
        <span className="mt-3 text-lg font-medium" style={{ color: 'var(--subtle)' }}>
          USDC
        </span>
      </div>
      <p className="mt-1.5 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        {sub}
      </p>

      <div className="inner mt-3 flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-xs">
        <span style={{ color: 'var(--muted)' }}>Wallet, pays online</span>
        <span className={`font-semibold tabular-nums ${hide}`} style={{ color: 'var(--ink)' }}>
          {wallet === null ? 'Connect to see' : `${fmtUsdc(wallet)} USDC`}
        </span>
      </div>

      {(committed > 0n || incoming > 0n) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
          {committed > 0n && <span>{fmtUsdc(committed)} signed, not yet settled</span>}
          {incoming > 0n && <span style={{ color: 'var(--success)' }}>{fmtUsdc(incoming)} incoming</span>}
        </div>
      )}

      <div className="mt-5 grid grid-cols-4 gap-2">
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
