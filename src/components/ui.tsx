import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { Loader2, X } from 'lucide-react'

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const controls = useDragControls()
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <motion.section
            role="dialog"
            aria-label={title}
            className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl"
            style={{
              background: 'rgba(12,12,22,0.97)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose()
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1" style={{ background: 'var(--spectral)' }} />
            <div className="flex cursor-grab touch-none justify-center pb-1 pt-3" onPointerDown={(e) => controls.start(e)} aria-hidden="true">
              <div className="h-1.5 w-12 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center justify-between px-5 pt-2">
              <h2 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex size-11 items-center justify-center rounded-full"
                style={{ color: 'var(--muted)' }}
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="px-5 pb-20 pt-2">{children}</div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function PrimaryButton({
  loading,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function GhostButton({ children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-colors disabled:opacity-40 ${className}`}
      style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }}
    >
      {children}
    </button>
  )
}

export function Chip({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad'; children: ReactNode }) {
  const tones = {
    neutral: { bg: 'rgba(255,255,255,0.07)', fg: 'var(--ink-2)' },
    good: { bg: 'rgba(62,217,184,0.14)', fg: 'var(--success)' },
    warn: { bg: 'rgba(245,166,35,0.14)', fg: 'var(--warn)' },
    bad: { bg: 'rgba(255,77,106,0.14)', fg: 'var(--danger)' },
  }[tone]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: tones.bg, color: tones.fg }}
    >
      {children}
    </span>
  )
}

export function AmountInput({
  value,
  onChange,
  hint,
  onHint,
}: {
  value: string
  onChange: (v: string) => void
  hint?: string
  onHint?: () => void
}) {
  return (
    <div className="inner rounded-2xl p-4">
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/,/g, '.')
          if (v === '' || /^\d*\.?\d{0,6}$/.test(v)) onChange(v)
        }}
        placeholder="0.00"
        aria-label="Amount in USDC"
        className="display w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:opacity-25"
        style={{ color: 'var(--ink)' }}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--subtle)' }}>
          USDC
        </span>
        {hint && (
          <button
            onClick={onHint}
            disabled={!onHint}
            className="min-h-8 text-xs font-semibold tabular-nums"
            style={{ color: 'var(--accent-hover)' }}
          >
            {hint}
          </button>
        )}
      </div>
    </div>
  )
}
