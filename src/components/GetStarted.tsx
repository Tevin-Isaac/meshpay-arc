import { IS_MAINNET } from '@/lib/network'
import { ConnectKitButton } from 'connectkit'
import { Check } from 'lucide-react'
import { useAccount } from 'wagmi'
import { useMeshState } from '@/lib/store'
import { useReserve } from '@/hooks/useMeshData'

/** First-run checklist driven by real state: wallet, reserve, a signed payment, a settled payment. */
export function GetStarted({ onAdd, onSend }: { onAdd: () => void; onSend: () => void }) {
  const { isConnected } = useAccount()
  const { items } = useMeshState()
  const reserve = useReserve()

  const steps = [
    { title: 'Connect your wallet', hint: 'Needed to add funds and pay the network fee.', done: isConnected },
    { title: 'Add USDC to your offline balance', hint: IS_MAINNET ? 'Send USDC to this device, or buy it with M-Pesa or a card.' : 'Use Get test USDC in the sidebar first.', done: (reserve.raw ?? 0n) > 0n },
    { title: 'Sign a payment', hint: 'Try airplane mode, then Send.', done: items.some((i) => i.source === 'signed') },
    { title: 'Settle it on Arc', hint: 'Back online? Press Settle on Arc.', done: items.some((i) => i.status === 'settled') },
  ]
  const current = steps.findIndex((s) => !s.done)
  if (current === -1) return null

  return (
    <section className="glass rounded-3xl p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="display text-lg font-bold">Get started</h2>
        <span className="text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
          {current} of {steps.length} done
        </span>
      </div>
      <ol className="mt-3 space-y-2.5">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={
                s.done
                  ? { background: 'var(--success)', color: 'var(--on-accent)' }
                  : i === current
                    ? { background: 'var(--accent)', color: 'var(--on-accent)' }
                    : { background: 'var(--surface-muted)', color: 'var(--subtle)' }
              }
            >
              {s.done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold" style={{ color: s.done ? 'var(--subtle)' : 'var(--ink)' }}>
                {s.title}
              </div>
              {i === current && (
                <p className="mt-0.5 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
                  {s.hint}
                </p>
              )}
            </div>
            {i === current && (
              <div className="shrink-0">
                {i === 0 ? (
                  <ConnectKitButton.Custom>
                    {({ show }) => (
                      <button onClick={show} className="min-h-11 rounded-full px-4 text-xs font-semibold" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                        Connect
                      </button>
                    )}
                  </ConnectKitButton.Custom>
                ) : i === 1 ? (
                  <button onClick={onAdd} className="min-h-11 rounded-full px-4 text-xs font-semibold" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                    Add funds
                  </button>
                ) : i === 2 ? (
                  <button onClick={onSend} className="min-h-11 rounded-full px-4 text-xs font-semibold" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                    Send
                  </button>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
