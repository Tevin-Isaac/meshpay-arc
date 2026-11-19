import { useState } from 'react'
import { toast } from 'sonner'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { fmtUsdc } from '@/lib/format'
import { spentToday } from '@/lib/policy'
import { setPolicy, setSettings, useMeshState } from '@/lib/store'
import { AmountInput, PrimaryButton, Sheet } from './ui'

export function LimitsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Spending limits">
      <LimitsBody onClose={onClose} />
    </Sheet>
  )
}

function LimitsBody({ onClose }: { onClose: () => void }) {
  const { policy, items, settings } = useMeshState()
  const [perTx, setPerTx] = useState(policy.perTx)
  const [daily, setDaily] = useState(policy.daily)
  const [accept, setAccept] = useState(settings.acceptLimit)

  const used = spentToday(items)
  const dailyCap = (() => {
    try {
      return parseUsdc(policy.daily)
    } catch {
      return 0n
    }
  })()
  const pct = dailyCap > 0n ? Math.min(100, Number((used * 100n) / dailyCap)) : 0

  const save = () => {
    try {
      parseUsdc(perTx || '0')
      parseUsdc(daily || '0')
    } catch {
      return toast.error('Enter valid amounts.')
    }
    try {
      parseUsdc(accept || '0')
    } catch {
      return toast.error('Enter valid amounts.')
    }
    setPolicy({ perTx: perTx || '0', daily: daily || '0' })
    setSettings({ acceptLimit: accept || '0' })
    toast.success('Limits saved on this device.')
    onClose()
  }

  return (
    <>
      <div className="space-y-4">
        <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
          Checked on this phone before anything is signed, so they hold with no internet. Set 0 for no limit.
        </p>

        <div className="inner rounded-2xl p-4">
          <div className="flex items-baseline justify-between text-xs" style={{ color: 'var(--muted)' }}>
            <span>Spent in the last 24h</span>
            <span className="tabular-nums">
              {fmtUsdc(used)} of {fmtUsdc(dailyCap)}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
            Per payment
          </div>
          <AmountInput value={perTx} onChange={setPerTx} />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
            Per day
          </div>
          <AmountInput value={daily} onChange={setDaily} />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
            Accept offline up to
          </div>
          <AmountInput value={accept} onChange={setAccept} hint="Payments above this are flagged until they settle" />
        </div>
        <PrimaryButton onClick={save}>Save limits</PrimaryButton>

        <p className="text-center text-[11px]" style={{ color: 'var(--subtle)' }}>
          Daily cap {formatUsdc(dailyCap)} USDC
        </p>
      </div>
    </>
  )
}
