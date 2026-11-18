import { Copy, Gauge, Repeat2, ShieldCheck, WifiOff, Coins } from 'lucide-react'

const FEATURES = [
  { icon: WifiOff, title: 'Works with no signal', body: 'Signing and checking a payment happen on the phone. The app shell is cached, so it opens offline too.' },
  { icon: ShieldCheck, title: 'Self-custodial', body: 'The signing key is created on your device. There is no account and no backend holding your funds.' },
  { icon: Gauge, title: 'Hard spending limits', body: 'Per-payment and daily caps are enforced on the phone before anything is signed.' },
  { icon: Repeat2, title: 'Any phone can courier', body: 'Carry a stranger\'s signed payment and settle it when you get a connection. It can only ever pay the recipient they chose.' },
  { icon: Copy, title: 'Duplicate proof', body: 'Every payment has a one-time number. If several phones carry the same payment, only the first settlement counts.' },
  { icon: Coins, title: 'USDC from end to end', body: 'Pay in USDC and pay the network fee in USDC. No second token to buy.' },
]

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-20">
      <p className="eyebrow">Features</p>
      <h2 className="display mt-3 max-w-2xl text-balance text-4xl font-bold sm:text-5xl">Built for places where the network can't be trusted.</h2>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="glass rounded-3xl p-6 transition-transform hover:-translate-y-0.5">
            <Icon className="size-5" style={{ color: 'var(--accent-hover)' }} />
            <h3 className="display mt-4 text-lg font-bold">{title}</h3>
            <p className="mt-1.5 text-sm text-pretty" style={{ color: 'var(--muted)' }}>
              {body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
