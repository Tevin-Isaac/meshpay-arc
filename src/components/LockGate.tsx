import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { lock, unlock, useMeshState } from '@/lib/store'
import { AuthShell, PinField } from './PinField'
import { Onboarding } from './Onboarding'

/** Keeps the wallet closed behind the PIN, and locks it again when you step away. */
export function LockGate({ children }: { children: ReactNode }) {
  const { status, settings } = useMeshState()
  useAutoLock(status === 'unlocked', settings.autoLockMinutes)

  if (status === 'new') return <Onboarding />
  if (status === 'locked') return <UnlockScreen />
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
        Enter your PIN. Everything on this phone stays encrypted until you do.
      </p>
      <PinField
        value={pin}
        label="PIN"
        autoFocus
        onChange={(v) => {
          setPinValue(v)
          if (v.length === 6 && !busy && wait <= 0) void submit(v)
        }}
      />
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
