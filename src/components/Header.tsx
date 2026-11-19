import { asset } from '@/lib/env'
import { ConnectKitButton } from 'connectkit'
import { Lock, Plane, Wallet } from 'lucide-react'
import { setSimulatedOffline, useNet } from '@/lib/net'
import { lock, useMeshState } from '@/lib/store'
import { shortAddress } from '@/lib/format'

/** Brand, connection status, offline rehearsal toggle, lock and wallet. */
export function Header() {
  const net = useNet()
  const { status } = useMeshState()
  const offline = !net.online

  return (
    <header className="flex items-center justify-between gap-2 pb-1">
      <div className="flex min-w-0 items-center gap-2.5">
        <img src={asset('mark.svg')} alt="" className="size-10 shrink-0" />
        <div className="min-w-0">
          <div className="display text-lg font-bold leading-none">
            Waya<span className="serif" style={{ color: 'var(--accent)' }}>Mesh</span>
          </div>
          <div
            className="mt-1 flex items-center gap-1.5 truncate text-[11px] font-semibold"
            style={{ color: offline ? 'var(--warn)' : 'var(--success)' }}
          >
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: 'currentColor' }} />
            {net.simulated ? 'Airplane mode' : offline ? 'No connection' : 'Online'}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={() => setSimulatedOffline(!net.simulated)}
          aria-pressed={net.simulated}
          aria-label="Rehearse offline mode"
          title="Rehearse offline mode"
          className="flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
          style={{
            background: net.simulated ? 'var(--accent)' : 'var(--surface-muted)',
            color: net.simulated ? 'var(--on-accent)' : 'var(--ink)',
            border: '1px solid var(--border)',
          }}
        >
          <Plane className="size-4" />
          <span className="hidden min-[400px]:inline">{net.simulated ? 'Airplane on' : 'Airplane'}</span>
        </button>
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
        <ConnectKitButton.Custom>
          {({ isConnected, show, address }) => (
            <button
              onClick={show}
              className="flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
              style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }}
            >
              <Wallet className="size-4" />
              <span className="mono">{isConnected && address ? shortAddress(address) : 'Connect'}</span>
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
    </header>
  )
}
