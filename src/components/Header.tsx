import { asset } from '@/lib/env'
import { Lock } from 'lucide-react'
import { lock, useMeshState } from '@/lib/store'
import { ThemeToggle } from './ThemeToggle'

/** Logo, welcome text and name, theme and lock. No avatar and no external wallet button here. */
export function Header() {
  const { status, settings } = useMeshState()

  return (
    <header className="flex items-center justify-between gap-3 pb-1">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <img src={asset('wayamesh-logo-v3.svg')} alt="Wayamesh" width={32} height={32} className="size-8 shrink-0" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[11px]" style={{ color: 'var(--muted)' }}>
            Welcome back
          </div>
          <div className="truncate text-sm font-bold">{settings.displayName || 'Your wallet'}</div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <ThemeToggle />
        {status === 'unlocked' && (
          <button
            onClick={lock}
            aria-label="Lock wallet"
            title="Lock wallet"
            className="flex size-11 items-center justify-center rounded-full"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
          >
            <Lock className="size-4" />
          </button>
        )}
      </div>
    </header>
  )
}
