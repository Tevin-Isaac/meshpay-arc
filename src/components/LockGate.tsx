import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { lock, setPin, unlock, useMeshState } from '@/lib/store'
import { pinProblem } from '@/lib/vault'
import { AuthShell, PinField, SecretField } from './PinField'
import { PrimaryButton } from './ui'
import { Onboarding } from './Onboarding'

/** Keeps the wallet closed behind the PIN, and locks it again when you step away. */
export function LockGate({ children }: { children: ReactNode }) {
  const { status, settings } = useMeshState()
  useAutoLock(status === 'unlocked', settings.autoLockMinutes)

  if (status === 'new') return <Onboarding />
  if (status === 'locked') return <UnlockScreen />
  // An older wallet that was never encrypted must be protected before it can be used.
  if (status === 'plain') return <ProtectScreen />
  return <>{children}</>
}

function useAutoLock(active: boolean, minutes: number) {
  const last = useRef(0)
  const hiddenAt = useRef(0)
  useEffect(() => {
    if (!active) return
    last.current = Date.now()
    const touch = () => {
      last.current = Date.now()
    }
    const onVisibility = () => {
      if (document.hidden) hiddenAt.current = Date.now()
      else if (hiddenAt.current && Date.now() - hiddenAt.current > 30_000) lock()
    }
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    document.addEventListener('visibilitychange', onVisibility)
    const timer = setInterval(() => {
      if (minutes > 0 && Date.now() - last.current > minutes * 60_000) lock()
    }, 5000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch))
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(timer)
    }
  }, [active, minutes])
}

function UnlockScreen() {
  const { secretKind } = useMeshState()
  const [pin, setPinValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1000)), 1000)
    return () => clearInterval(t)
  }, [wait])

  const submit = async (value: string) => {
    setBusy(true)
    const res = await unlock(value)
    setBusy(false)
    if (!res.ok) {
      setPinValue('')
      if (res.waitMs > 0) setWait(res.waitMs)
      toast.error(res.waitMs > 0 ? `${res.reason} Try again in ${Math.ceil(res.waitMs / 1000)}s.` : res.reason)
    }
  }

  return (
    <AuthShell title="Welcome back">
      <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
        Enter your {secretKind === 'pin' ? 'PIN' : 'passphrase'}. Everything on this phone stays encrypted until you do.
      </p>
      <SecretField
        value={pin}
        label={secretKind === 'pin' ? 'PIN' : 'Passphrase'}
        kind={secretKind}
        autoFocus
        onChange={(v) => {
          setPinValue(v)
          if (secretKind === 'pin' && v.length === 6 && !busy && wait <= 0) void submit(v)
        }}
      />
      {secretKind === 'pass' && (
        <PrimaryButton onClick={() => void submit(pin)} disabled={busy || wait > 0 || pin.length < 10}>
          Unlock
        </PrimaryButton>
      )}
      {wait > 0 && (
        <p className="text-xs font-semibold" style={{ color: 'var(--warn)' }}>
          Too many tries. Wait {Math.ceil(wait / 1000)}s.
        </p>
      )}
      {busy && (
        <p className="text-xs" style={{ color: 'var(--subtle)' }}>
          Unlocking…
        </p>
      )}
    </AuthShell>
  )
}

function ProtectScreen() {
  const [pin, setPinValue] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const problem = pin.length === 6 ? pinProblem(pin) : null
  return (
    <AuthShell title="Protect your wallet">
      <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
        This wallet was saved without a PIN. Choose a 6-digit PIN now. It encrypts your key and everything private on this device.
      </p>
      <PinField value={pin} onChange={setPinValue} label="New PIN" autoFocus />
      <PinField value={again} onChange={setAgain} label="Repeat PIN" />
      {problem && (
        <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
          {problem}
        </p>
      )}
      <PrimaryButton
        loading={busy}
        disabled={pin.length !== 6 || again.length !== 6 || !!problem}
        onClick={() => {
          if (pin !== again) return toast.error('The two PINs do not match.')
          setBusy(true)
          setPin(pin)
            .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not set the PIN.'))
            .finally(() => setBusy(false))
        }}
      >
        Encrypt this wallet
      </PrimaryButton>
    </AuthShell>
  )
}
