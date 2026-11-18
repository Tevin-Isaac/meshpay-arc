import { ConnectKitButton } from 'connectkit'
import { Plane, Wallet } from 'lucide-react'
import { setSimulatedOffline, useNet } from '@/lib/net'
import { shortAddress } from '@/lib/format'

/** Brand, connection status, offline rehearsal toggle and wallet. */
export function Header() {
  const net = useNet()
  const offline = !net.online

  return (
    <header className="flex items-center justify-between gap-2 pb-1">
      <div className="flex min-w-0 items-center gap-2.5">
        <img src="/icon.svg" alt="" className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <div className="display text-lg font-bold leading-none">MeshPay</div>
          <div
            className="mt-1 flex items-center gap-1.5 truncate text-[11px] font-semibold"
            style={{ color: offline ? 'var(--warn)' : 'var(--success)' }}
          >
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: 'currentColor' }} />
            {net.simulated ? 'Airplane mode' : offline ? 'No connection' : 'Online'}
            {!net.simulated && !offline && <span className="hidden min-[380px]:inline"> · Arc Testnet</span>}
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
            color: net.simulated ? 'white' : 'var(--ink)',
            border: '1px solid var(--border)',
          }}
        >
          <Plane className="size-4" />
          <span className="hidden min-[400px]:inline">{net.simulated ? 'Airplane on' : 'Airplane'}</span>
        </button>
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
