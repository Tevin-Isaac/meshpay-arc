import { asset } from '@/lib/env'
import { Lock } from 'lucide-react'
import { NETWORK_LABEL } from '@/lib/network'
import { lock, useMeshState } from '@/lib/store'
import { Avatar } from './Avatar'
import { useSheets } from './shell/useSheets'
import { ThemeToggle } from './ThemeToggle'

/** Logo mark, profile (avatar, welcome, name), network, theme and lock. No external wallet button here. */
export function Header() {
  const { status, address, settings } = useMeshState()
  const sheets = useSheets()

  return (
    <header className="flex items-center justify-between gap-2 pb-1">
      <div className="flex min-w-0 items-center gap-2.5">
        <img src={asset('wayamesh-logo-v3.svg')} alt="Wayamesh" width={40} height={40} className="size-10 shrink-0" />
        <button onClick={() => sheets.goTab('settings')} aria-label="Open your profile" className="flex min-w-0 items-center gap-2.5 text-left">
          <Avatar seed={address} name={settings.displayName} size={40} />
          <span className="min-w-0 leading-tight">
            <span className="block text-[11px]" style={{ color: 'var(--muted)' }}>
              Welcome back
            </span>
            <span className="block truncate text-sm font-bold">{settings.displayName || 'Your wallet'}</span>
          </span>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className="hidden items-center rounded-full px-2.5 py-1 text-[11px] font-semibold min-[400px]:inline-flex"
          style={{ background: 'var(--tint-accent)', color: 'var(--accent-hover)', border: '1px solid var(--line-accent)' }}
        >
          {NETWORK_LABEL}
        </span>
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
