import { useState } from 'react'
import { toast } from 'sonner'
import { Lock, ShieldCheck, ShieldAlert } from 'lucide-react'
import { changePin, lock, setPin, setSettings, useMeshState } from '@/lib/store'
import { pinProblem } from '@/lib/vault'
import { shortAddress } from '@/lib/format'
import { GhostButton, PrimaryButton, Sheet } from './ui'
import { SecretField, secretReady } from './PinField'
import { BackupCard, Card, EraseCard, GuardiansCard, PhraseCard } from './SecurityCards'

export function SecuritySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Security">
      <SecurityBody />
    </Sheet>
  )
}

function SecurityBody() {
  const { status, settings, address, secretKind } = useMeshState()
  const protectedNow = status === 'unlocked'

  return (
    <div className="space-y-3">
      <div
        className="flex items-start gap-3 rounded-2xl p-4 text-sm"
        style={{
          background: protectedNow ? 'rgba(62,217,184,0.1)' : 'rgba(245,166,35,0.12)',
          color: protectedNow ? 'var(--success)' : 'var(--warn)',
        }}
      >
        {protectedNow ? <ShieldCheck className="mt-0.5 size-5 shrink-0" /> : <ShieldAlert className="mt-0.5 size-5 shrink-0" />}
        <div>
          <div className="font-semibold">{protectedNow ? (secretKind === 'pin' ? 'Protected by your PIN' : 'Protected by your passphrase') : 'Not protected yet'}</div>
          <div className="mt-0.5 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
            {protectedNow
              ? `Your key, messages and payments are encrypted on this phone. Wallet ${shortAddress(address)}.`
              : 'Anyone who opens this browser can spend your balance. Set a PIN to encrypt everything.'}
          </div>
        </div>
      </div>

      {status === 'plain' ? <SetSecretCard /> : <ChangeSecretCard />}

      <Card title="Auto-lock">
        <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
          Locks the wallet when you step away. It also locks if the app is in the background for 30 seconds.
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 5, 15, 0].map((m) => (
            <button
              key={m}
              onClick={() => setSettings({ autoLockMinutes: m })}
              className="min-h-11 rounded-xl text-xs font-semibold"
              style={{
                background: settings.autoLockMinutes === m ? 'var(--accent)' : 'var(--surface-muted)',
                color: settings.autoLockMinutes === m ? 'var(--on-accent)' : 'var(--ink)',
                border: '1px solid var(--border)',
              }}
            >
              {m === 0 ? 'Never' : `${m}m`}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Hide balances</span>
          <button
            role="switch"
            aria-checked={settings.hideBalances}
            aria-label="Hide balances"
            onClick={() => setSettings({ hideBalances: !settings.hideBalances })}
            className="relative h-8 w-14 rounded-full transition-colors"
            style={{ background: settings.hideBalances ? 'var(--accent)' : 'var(--surface-muted)', border: '1px solid var(--border)' }}
          >
            <span
              className="absolute top-0.5 size-6 rounded-full transition-all"
              style={{ left: settings.hideBalances ? 28 : 3, background: settings.hideBalances ? 'var(--on-accent)' : 'var(--subtle)' }}
            />
          </button>
        </div>
        {protectedNow && (
          <GhostButton className="w-full" onClick={lock}>
            <Lock className="size-4" /> Lock now
          </GhostButton>
        )}
      </Card>

      {protectedNow && <PhraseCard />}
      {protectedNow && <GuardiansCard />}
      {protectedNow && <BackupCard />}
      <EraseCard />
    </div>
  )
}

function SetSecretCard() {
  const [pin, setPinValue] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const problem = pin ? pinProblem(pin) : null
  return (
    <Card title="Set a PIN">
      <input
        type="password"
        value={pin}
        onChange={(e) => setPinValue(e.target.value.slice(0, 200))}
        autoComplete="off"
        placeholder="6-digit PIN, or a passphrase of 10+ characters"
        aria-label="New PIN or passphrase"
        className="inner min-h-12 w-full rounded-2xl px-4 text-base outline-none"
      />
      <input
        type="password"
        value={again}
        onChange={(e) => setAgain(e.target.value.slice(0, 200))}
        autoComplete="off"
        placeholder="Repeat it"
        aria-label="Repeat PIN or passphrase"
        className="inner min-h-12 w-full rounded-2xl px-4 text-base outline-none"
      />
      {problem && pin.length >= 6 && (
        <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
          {problem}
        </p>
      )}
      <PrimaryButton
        loading={busy}
        disabled={!pin || !!problem || pin !== again}
        onClick={() => {
          setBusy(true)
          setPin(pin)
            .then(() => toast.success('Everything is now encrypted.'))
            .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not set it.'))
            .finally(() => setBusy(false))
        }}
      >
        Encrypt this wallet
      </PrimaryButton>
    </Card>
  )
}

function ChangeSecretCard() {
  const { secretKind } = useMeshState()
  const [oldPin, setOld] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const problem = next ? pinProblem(next) : null
  return (
    <Card title={secretKind === 'pin' ? 'Change PIN or switch to a passphrase' : 'Change passphrase or go back to a PIN'}>
      <SecretField value={oldPin} onChange={setOld} label={secretKind === 'pin' ? 'Current PIN' : 'Current passphrase'} kind={secretKind} />
      <input
        type="password"
        value={next}
        onChange={(e) => setNext(e.target.value.slice(0, 200))}
        autoComplete="off"
        placeholder="New 6-digit PIN, or a passphrase of 10+ characters"
        aria-label="New PIN or passphrase"
        className="inner min-h-12 w-full rounded-2xl px-4 text-base outline-none"
      />
      <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        A passphrase is much harder to guess than 6 digits if someone ever copies your encrypted data. Use one if you keep real money here.
      </p>
      {problem && next.length >= 6 && (
        <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
          {problem}
        </p>
      )}
      <GhostButton
        className="w-full"
        disabled={busy || !secretReady(oldPin, secretKind) || !next || !!problem}
        onClick={() => {
          setBusy(true)
          changePin(oldPin, next)
            .then((ok) => {
              if (ok) {
                toast.success('Saved. Use it next time you unlock.')
                setOld('')
                setNext('')
              } else toast.error('The current one is wrong.')
            })
            .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not change it.'))
            .finally(() => setBusy(false))
        }}
      >
        Save
      </GhostButton>
    </Card>
  )
}
