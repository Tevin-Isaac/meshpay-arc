import { asset } from '@/lib/env'
import type { ReactNode } from 'react'
import { isPin } from '@/lib/vault'

export function PinField({
  value,
  onChange,
  label,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  autoFocus?: boolean
}) {
  return (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      aria-label={label}
      placeholder="••••••"
      className="inner mono w-full rounded-2xl py-3 text-center text-2xl tracking-[0.5em] outline-none"
    />
  )
}

/** Centered full-screen card used by onboarding and the lock screen. */
export function AuthShell({ title, children, footer }: { title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="page-glow relative isolate mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <img src={asset('mark.svg')} alt="" className="size-20" />
        <div className="mono text-[11px] uppercase tracking-[0.3em]" style={{ color: 'var(--accent)' }}>
          WayaMesh
        </div>
      </div>
      <div className="glass space-y-4 rounded-3xl p-6 text-center">
        <h1 className="display text-balance text-3xl font-bold leading-tight">{title}</h1>
        {children}
      </div>
      {footer && <div className="mt-4 text-center">{footer}</div>}
    </main>
  )
}

/** Asks for the wallet's PIN or passphrase, whichever this wallet uses. */
export function SecretField({
  value,
  onChange,
  label,
  kind,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  kind: 'pin' | 'pass'
  autoFocus?: boolean
}) {
  if (kind === 'pin') return <PinField value={value} onChange={onChange} label={label} autoFocus={autoFocus} />
  return (
    <input
      type="password"
      autoComplete="off"
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, 200))}
      aria-label={label}
      placeholder="Passphrase"
      className="inner w-full rounded-2xl px-4 py-3 text-base outline-none"
    />
  )
}

/** True when the value is long enough to be tried. */
export function secretReady(value: string, kind: 'pin' | 'pass'): boolean {
  return kind === 'pin' ? isPin(value) : value.length >= 10
}
