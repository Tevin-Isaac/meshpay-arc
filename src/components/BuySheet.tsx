import { useEffect, useRef, useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { AppKit } from '@circle-fin/app-kit'
import { useAccount, useSignMessage } from 'wagmi'
import { toast } from 'sonner'
import { Info } from 'lucide-react'
import { onrampAuthMessage } from '@/lib/onrampAuth'
import { parseOnchainError } from '@/lib/errors'
import { useNet } from '@/lib/net'
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
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { online } = useNet()
  const [session, setSession] = useState<Session | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const start = async () => {
    if (!address) return
    setBusy(true)
    setStatus(null)
    try {
      // The wallet proves it owns the address; the server mints the session for that address only.
      const issuedAt = Date.now()
      const signature = await signMessageAsync({ message: onrampAuthMessage(address, issuedAt) })
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
      onDepositSubmitted: () => setStatus('Purchase submitted. Funds arrive in your wallet once the payment clears.'),
      onDepositSettled: () => setStatus('Purchase settled. Check your wallet balance.'),
      onDepositNotCompleted: ({ code }) => setStatus(code === 'CANCELED_BY_CUSTOMER' ? 'Purchase canceled.' : `Purchase not completed (${code}).`),
      onInitializationError: () => setStatus('The purchase window could not load. Try again.'),
      onSessionExpired: () => {
        setSession(null)
        setStatus('Session expired. Start again.')
      },
    })
    return () => widget.close()
  }, [session])

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <Intro />
        <ConnectKitButton.Custom>{({ show }) => <PrimaryButton onClick={show}>Connect wallet</PrimaryButton>}</ConnectKitButton.Custom>
      </div>
    )
  }

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
            {busy ? 'Confirm in wallet…' : 'Continue'}
          </PrimaryButton>
          <p className="text-center text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
            You will sign a free message so we know the USDC goes to your wallet.
          </p>
        </>
      )}
      {session && <div ref={containerRef} className="w-full overflow-hidden rounded-2xl bg-white" style={{ height: 640 }} />}
      {status && (
        <div className="inner rounded-2xl p-3 text-sm text-pretty" role="status">
          {status}
        </div>
      )}
      <div className="flex gap-2 rounded-2xl p-3 text-xs text-pretty" style={{ background: 'rgba(133,177,237,0.14)', color: 'var(--ink-2)' }}>
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          This is Circle's sandbox, so no real money moves and test purchases may not show up in your balance. For Arc test USDC use Get test USDC in the
          sidebar.
        </span>
      </div>
    </div>
  )
}

function Intro() {
  return (
    <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
      Buy USDC with a bank transfer or card. It is delivered to your connected wallet. Then use Add to move it into your offline balance.
    </p>
  )
}
