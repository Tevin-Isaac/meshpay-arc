import { motion } from 'framer-motion'
import { ArrowRight, KeyRound, ServerOff, Zap } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'

const PROOF = [
  { icon: Zap, value: 'Sub-second', label: 'finality on Arc' },
  { icon: ServerOff, value: 'No servers', label: 'between you and your money' },
  { icon: KeyRound, value: 'Self-custody', label: 'keys stay on your phone' },
]

export function Hero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col justify-center"
    >
      <span
        className="inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold"
        style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
      >
        <TokenUSDC variant="branded" size={16} />
        USDC payments on Arc Testnet
      </span>

      <h1 className="display mt-5 text-5xl font-bold leading-[1.02] sm:text-6xl lg:text-7xl" style={{ color: 'var(--ink)' }}>
        Send USDC.
        <br />
        <span style={{ color: 'var(--accent-hover)' }}>No internet.</span>
      </h1>

      <p className="mt-5 max-w-xl text-pretty text-lg" style={{ color: 'var(--ink-2)' }}>
        Sign a payment with no connection and hand it over by QR code. The first phone that finds a signal settles it on Arc. Money that moves like cash and
        settles like a blockchain.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <a
          href="#app"
          className="flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'var(--accent)' }}
        >
          Try it now <ArrowRight className="size-4" />
        </a>
        <a
          href="#how"
          className="flex min-h-12 items-center rounded-full px-6 text-sm font-semibold transition-colors hover:bg-white"
          style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        >
          See how it works
        </a>
      </div>

      <dl className="mt-10 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
        {PROOF.map(({ icon: Icon, value, label }) => (
          <div key={value} className="glass rounded-2xl p-4">
            <Icon className="size-4" style={{ color: 'var(--accent-hover)' }} />
            <dt className="display mt-2 text-lg font-bold">{value}</dt>
            <dd className="mt-0.5 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
              {label}
            </dd>
          </div>
        ))}
      </dl>
    </motion.div>
  )
}
