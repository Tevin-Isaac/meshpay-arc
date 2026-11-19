import { IS_MAINNET, NETWORK_LABEL } from '@/lib/network'
import { Check } from 'lucide-react'
import { useMeshState } from '@/lib/store'
import { toast } from 'sonner'
import { useDevice, useDeviceUsdc, useReserve } from '@/hooks/useMeshData'

/** First-run checklist driven by real state: wallet, reserve, a signed payment, a settled payment. */
export function GetStarted({ onAdd, onSend }: { onAdd: () => void; onSend: () => void }) {
  const device = useDevice()
  const { items } = useMeshState()
  const reserve = useReserve()
  const deviceUsdc = useDeviceUsdc()

  const steps = [
    {
      title: IS_MAINNET ? 'Add USDC' : 'Get test USDC',
      hint: IS_MAINNET ? 'Send USDC to your wallet address, or buy it with M-Pesa or a card.' : `Copy your address and request free test USDC at the faucet (${NETWORK_LABEL}).`,
      done: deviceUsdc.known !== null && deviceUsdc.known > 0n ? true : (reserve.raw ?? 0n) > 0n,
    },
    { title: 'Add to your offline reserve', hint: 'Move some USDC into the reserve so you can pay with no internet.', done: (reserve.raw ?? 0n) > 0n },
    { title: 'Sign a payment', hint: 'Open Send and choose Sign offline.', done: items.some((i) => i.source === 'signed' && i.kind !== 'online') },
    { title: 'Settle it on Arc', hint: 'Back online? Press Settle on Arc.', done: items.some((i) => i.status === 'settled' && i.kind !== 'online') },
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
                  <button
                    onClick={() => void navigator.clipboard.writeText(device.address).then(() => toast.success(IS_MAINNET ? 'Address copied.' : 'Address copied. Paste it at the faucet.'), () => toast.error('Could not copy. Open Receive to see your address.'))}
                    className="min-h-11 rounded-full px-4 text-xs font-semibold"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                  >
                    Copy address
                  </button>
                ) : i === 1 ? (
                  <button onClick={onAdd} className="min-h-11 rounded-full px-4 text-xs font-semibold" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                    Add
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
