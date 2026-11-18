import { PenLine, QrCode, Zap } from 'lucide-react'

const STEPS = [
  {
    icon: PenLine,
    title: 'Sign offline',
    body: 'Your phone seals a USDC payment with its own key. Nobody can change the amount, the recipient or the sender.',
  },
  {
    icon: QrCode,
    title: 'Hand it over',
    body: 'Show the QR code or send the code through any share sheet. The receiver checks the signature on their own phone.',
  },
  {
    icon: Zap,
    title: 'Settle on Arc',
    body: 'The first phone online submits it. Arc finalizes in under a second, and duplicates are caught automatically.',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-20">
      <p className="eyebrow">How it works</p>
      <h2 className="display mt-3 max-w-2xl text-balance text-4xl font-bold sm:text-5xl">Three steps, and only the last one needs a signal.</h2>
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="glass relative overflow-hidden rounded-3xl p-6">
            <span className="display absolute right-5 top-3 text-7xl font-bold" style={{ color: 'rgba(18,45,69,0.06)' }}>
              {i + 1}
            </span>
            <div className="flex size-12 items-center justify-center rounded-2xl" style={{ background: 'var(--accent)' }}>
              <Icon className="size-5 text-white" />
            </div>
            <h3 className="display mt-5 text-xl font-bold">{title}</h3>
            <p className="mt-2 text-sm text-pretty" style={{ color: 'var(--muted)' }}>
              {body}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-6 max-w-2xl text-sm text-pretty" style={{ color: 'var(--muted)' }}>
        A payment you receive offline is final only once it settles. The Funded tag shows whether the payer's balance covered it the last time anyone checked.
      </p>
    </section>
  )
}
