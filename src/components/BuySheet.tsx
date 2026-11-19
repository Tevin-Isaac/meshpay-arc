import { useEffect, useRef, useState } from 'react'
import { AppKit } from '@circle-fin/app-kit'
import { toast } from 'sonner'
import { Info } from 'lucide-react'
import { onrampAuthMessage } from '@/lib/onrampAuth'
import { parseOnchainError } from '@/lib/errors'
import { useNet } from '@/lib/net'
import { getDeviceAccount } from '@/lib/store'
import { useDevice } from '@/hooks/useMeshData'
import { IS_MAINNET } from '@/lib/network'
import { PrimaryButton, Sheet } from './ui'

type Session = Parameters<AppKit['onramp']['mountIframe']>[0]['session']

export function BuySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Buy USDC">
      <BuyBody />
    </Sheet>
  )
}

function BuyBody() {
  // USDC is delivered to this device's own wallet. No external wallet is needed.
  const address = useDevice().address
  const { online } = useNet()
  const [session, setSession] = useState<Session | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const start = async () => {
    setBusy(true)
    setStatus(null)
    try {
      // The wallet proves it owns the address; the server mints the session for that address only.
      const issuedAt = Date.now()
      const signature = await getDeviceAccount().signMessage({ message: onrampAuthMessage(address, issuedAt) })
      const res = await fetch('/api/onramp/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, issuedAt, signature }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null
        throw new Error(body?.message ?? 'Could not start the onramp.')
      }
      setSession((await res.json()) as Session)
    } catch (e) {
      const msg = parseOnchainError(e)
      if (msg) toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const container = containerRef.current
    if (!session || !container) return
    const kit = new AppKit({ onramp: { widgetBaseUrl: import.meta.env.VITE_ONRAMP_WIDGET_BASE_URL as string | undefined } })
    const widget = kit.onramp.mountIframe({
      session,
      container,
      onDepositSubmitted: () => setStatus('Purchase submitted. Funds arrive in this wallet once the payment clears.'),
      onDepositSettled: () => setStatus('Purchase settled. Check your balance.'),
      onDepositNotCompleted: ({ code }) => setStatus(code === 'CANCELED_BY_CUSTOMER' ? 'Purchase canceled.' : `Purchase not completed (${code}).`),
      onInitializationError: () => setStatus('The purchase window could not load. Try again.'),
      onSessionExpired: () => {
        setSession(null)
        setStatus('Session expired. Start again.')
      },
    })
    return () => widget.close()
  }, [session])

  if (!online) {
    return (
      <div className="inner rounded-2xl p-4 text-sm" style={{ color: 'var(--ink-2)' }}>
        You are offline. Buying USDC needs a connection.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!session && (
        <>
          <Intro />
          <PrimaryButton onClick={() => void start()} loading={busy}>
            {busy ? 'Starting…' : 'Continue'}
          </PrimaryButton>
          <p className="text-center text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
            Your wallet signs a free message so we know the USDC goes to this wallet.
          </p>
        </>
      )}
      {session && <div ref={containerRef} className="w-full overflow-hidden rounded-2xl bg-white" style={{ height: 640 }} />}
      {status && (
        <div className="inner rounded-2xl p-3 text-sm text-pretty" role="status">
          {status}
        </div>
      )}
      <div className="flex gap-2 rounded-2xl p-3 text-xs text-pretty" style={{ background: 'var(--tint-info)', color: 'var(--ink-2)' }}>
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          This is Circle's sandbox, so no real money moves and test purchases may not show up in your balance. {IS_MAINNET ? '' : 'For Arc test USDC use Get test USDC on the Wallet screen.'}
        </span>
      </div>
    </div>
  )
}

function Intro() {
  return (
    <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
      Buy USDC with a bank transfer or card. It is delivered to this wallet's own address. Then use Add to move some into your offline reserve.
    </p>
  )
}
