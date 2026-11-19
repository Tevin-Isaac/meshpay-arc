import { useState } from 'react'
import { toast } from 'sonner'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { fmtUsdc } from '@/lib/format'
import { spentToday } from '@/lib/policy'
import { revealSecret, setPolicy, setSettings, useMeshState } from '@/lib/store'
import { AmountInput, PrimaryButton, Sheet } from './ui'
import { SecretField, secretReady } from './PinField'

export function LimitsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Spending limits">
      <LimitsBody onClose={onClose} />
    </Sheet>
  )
}

function LimitsBody({ onClose }: { onClose: () => void }) {
  const { policy, items, settings, secretKind } = useMeshState()
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
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

  // Tightening a limit is free. Loosening one, or turning it off, needs your PIN so a borrowed phone cannot do it.
  const big = (v: string) => {
    try {
      const n = parseUsdc(v || '0')
      return n === 0n ? 2n ** 200n : n
    } catch {
      return 0n
    }
  }
  const loosening = big(perTx) > big(policy.perTx) || big(daily) > big(policy.daily) || big(accept) > big(settings.acceptLimit)

  const save = async () => {
    try {
      parseUsdc(perTx || '0')
      parseUsdc(daily || '0')
      parseUsdc(accept || '0')
    } catch {
      return toast.error('Enter valid amounts.')
    }
    if (loosening) {
      setBusy(true)
      const ok = await revealSecret(secret)
      setBusy(false)
      setSecret('')
      if (!ok) return toast.error(`Wrong ${secretKind === 'pin' ? 'PIN' : 'passphrase'}, or too many tries.`)
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
        {loosening && (
          <div className="space-y-2">
            <p className="text-xs text-pretty" style={{ color: 'var(--warn)' }}>
              You are raising a limit. Enter your {secretKind === 'pin' ? 'PIN' : 'passphrase'} to confirm.
            </p>
            <SecretField value={secret} onChange={setSecret} label="PIN to raise limits" kind={secretKind} />
          </div>
        )}
        <PrimaryButton onClick={() => void save()} loading={busy} disabled={loosening && !secretReady(secret, secretKind)}>
          Save limits
        </PrimaryButton>

        <p className="text-center text-[11px]" style={{ color: 'var(--subtle)' }}>
          Daily cap {formatUsdc(dailyCap)} USDC
        </p>
      </div>
    </>
  )
}
