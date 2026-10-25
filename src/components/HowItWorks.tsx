import { PenLine, QrCode, Zap } from 'lucide-react'

const STEPS = [
  {
    icon: PenLine,
    title: 'Sign offline',
    body: 'Your phone seals a USDC payment with its own key. Nobody can change the amount or the recipient.',
  },
  {
    icon: QrCode,
    title: 'Hand it over',
    body: 'Show the QR code, or send the code by any share sheet. The receiver checks the signature on their phone.',
  },
  {
    icon: Zap,
    title: 'Settle on Arc',
    body: 'The first phone online submits it. Arc finalizes in under a second. Duplicates are caught automatically.',
  },
]

export function HowItWorks() {
  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="display text-lg font-bold">How it works</h2>
      <ol className="mt-3 space-y-4">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="flex gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--surface-muted)' }}>
              <Icon className="size-4" style={{ color: 'var(--ink-2)' }} />
            </div>
            <div>
              <div className="text-sm font-semibold">
                {i + 1}. {title}
              </div>
              <p className="mt-0.5 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
                {body}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[11px] text-pretty" style={{ color: 'var(--subtle)' }}>
        A payment you receive offline is final only once it settles. Funded means the payer's reserve covered it the last time anyone checked.
      </p>
    </section>
  )
}
