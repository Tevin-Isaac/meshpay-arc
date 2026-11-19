import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Download, Eye, EyeOff, Lock, ShieldCheck, ShieldAlert, Trash2, Upload, Users } from 'lucide-react'
import { splitKey } from '@/lib/guardians'
import {
  changePin,
  exportBackup,
  importBackup,
  lock,
  revealSecret,
  setPin,
  setSettings,
  useMeshState,
  wipeWallet,
} from '@/lib/store'
import { pinProblem } from '@/lib/vault'
import { shortAddress } from '@/lib/format'
import { GhostButton, PrimaryButton, Sheet } from './ui'
import { PinField } from './PinField'

export function SecuritySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Security">
      <SecurityBody />
    </Sheet>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="inner space-y-3 rounded-2xl p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function SecurityBody() {
  const { status, settings, address } = useMeshState()
  const protectedByPin = status === 'unlocked'

  return (
    <div className="space-y-3">
      <div
        className="flex items-start gap-3 rounded-2xl p-4 text-sm"
        style={{
          background: protectedByPin ? 'rgba(62,217,184,0.1)' : 'rgba(245,166,35,0.12)',
          color: protectedByPin ? 'var(--success)' : 'var(--warn)',
        }}
      >
        {protectedByPin ? <ShieldCheck className="mt-0.5 size-5 shrink-0" /> : <ShieldAlert className="mt-0.5 size-5 shrink-0" />}
        <div>
          <div className="font-semibold">{protectedByPin ? 'Protected by your PIN' : 'Not protected yet'}</div>
          <div className="mt-0.5 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
            {protectedByPin
              ? `Your key, messages and payments are encrypted on this phone. Wallet ${shortAddress(address)}.`
              : 'Anyone who opens this browser can spend your balance. Set a PIN to encrypt everything.'}
          </div>
        </div>
      </div>

      {status === 'plain' ? <SetPinCard /> : <ChangePinCard />}

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
        {protectedByPin && (
          <GhostButton className="w-full" onClick={lock}>
            <Lock className="size-4" /> Lock now
          </GhostButton>
        )}
      </Card>

      {protectedByPin && <PhraseCard />}
      {protectedByPin && <GuardiansCard />}
      <BackupCard />
      <EraseCard />
    </div>
  )
}

function SetPinCard() {
  const [pin, setPinValue] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const problem = pin.length === 6 ? pinProblem(pin) : null
  return (
    <Card title="Set a PIN">
      <PinField value={pin} onChange={setPinValue} label="New PIN" />
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
            .then(() => toast.success('PIN set. Everything is now encrypted.'))
            .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not set the PIN.'))
            .finally(() => setBusy(false))
        }}
      >
        Encrypt this wallet
      </PrimaryButton>
    </Card>
  )
}

function ChangePinCard() {
  const [oldPin, setOld] = useState('')
  const [pin, setNew] = useState('')
  const [busy, setBusy] = useState(false)
  const problem = pin.length === 6 ? pinProblem(pin) : null
  return (
    <Card title="Change PIN">
      <PinField value={oldPin} onChange={setOld} label="Current PIN" />
      <PinField value={pin} onChange={setNew} label="New PIN" />
      {problem && (
        <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
          {problem}
        </p>
      )}
      <GhostButton
        className="w-full"
        disabled={busy || oldPin.length !== 6 || pin.length !== 6 || !!problem}
        onClick={() => {
          setBusy(true)
          changePin(oldPin, pin)
            .then((ok) => {
              if (ok) {
                toast.success('PIN changed.')
                setOld('')
                setNew('')
              } else toast.error('The current PIN is wrong.')
            })
            .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not change the PIN.'))
            .finally(() => setBusy(false))
        }}
      >
        Change PIN
      </GhostButton>
    </Card>
  )
}

function PhraseCard() {
  const [pin, setPinValue] = useState('')
  const [secret, setSecret] = useState<{ key: string; mnemonic: string | null } | null>(null)
  const [busy, setBusy] = useState(false)

  const reveal = async () => {
    setBusy(true)
    const res = await revealSecret(pin)
    setBusy(false)
    setPinValue('')
    if (!res) return toast.error('Wrong PIN, or too many tries.')
    setSecret(res)
    setTimeout(() => setSecret(null), 30_000)
  }

  return (
    <Card title="Recovery phrase">
      {secret ? (
        <>
          <div className="mono rounded-xl p-3 text-xs leading-relaxed break-words" style={{ background: 'var(--surface-muted)' }}>
            {secret.mnemonic ?? secret.key}
          </div>
          <p className="text-xs text-pretty" style={{ color: 'var(--warn)' }}>
            {secret.mnemonic ? 'Anyone with these words owns your wallet. It hides again in 30 seconds.' : 'This older wallet has no phrase, only a key. Back it up now.'}
          </p>
          <GhostButton className="w-full" onClick={() => setSecret(null)}>
            <EyeOff className="size-4" /> Hide
          </GhostButton>
        </>
      ) : (
        <>
          <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
            Enter your PIN to show the 12 words that can rebuild this wallet on any device.
          </p>
          <PinField value={pin} onChange={setPinValue} label="PIN to reveal" />
          <GhostButton className="w-full" disabled={pin.length !== 6 || busy} onClick={() => void reveal()}>
            <Eye className="size-4" /> Reveal phrase
          </GhostButton>
        </>
      )}
    </Card>
  )
}

function BackupCard() {
  const { status } = useMeshState()
  const [json, setJson] = useState('')
  const [pin, setPinValue] = useState('')
  const [busy, setBusy] = useState(false)

  const download = () => {
    const data = exportBackup()
    if (!data) return toast.error('Set a PIN first. Backups are always encrypted.')
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'wayamesh-backup.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Encrypted backup saved. You need this PIN to open it.')
  }

  return (
    <Card title="Encrypted backup">
      <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        A file of your wallet, messages and payments, locked with your PIN. Safe to store anywhere.
      </p>
      <GhostButton className="w-full" onClick={download} disabled={status === 'plain'}>
        <Download className="size-4" /> Download backup
      </GhostButton>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={2}
        placeholder="Paste a backup file's contents to restore"
        aria-label="Backup to restore"
        className="inner mono w-full resize-none rounded-xl p-3 text-[11px] outline-none"
      />
      {json.trim() && (
        <>
          <PinField value={pin} onChange={setPinValue} label="PIN for this backup" />
          <GhostButton
            className="w-full"
            disabled={busy || pin.length !== 6}
            onClick={() => {
              setBusy(true)
              void importBackup(json.trim(), pin)
                .then((ok) => (ok ? toast.success('Backup restored.') : toast.error('That backup or PIN is not right.')))
                .finally(() => setBusy(false))
            }}
          >
            <Upload className="size-4" /> Restore this backup
          </GhostButton>
        </>
      )}
    </Card>
  )
}

function EraseCard() {
  const [confirm, setConfirm] = useState('')
  return (
    <Card title="Erase this wallet">
      <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        Removes the wallet, messages and payments from this browser. Your money stays on Arc, and only the recovery phrase or a backup brings it back.
      </p>
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Type ERASE to confirm"
        aria-label="Type ERASE to confirm"
        autoCapitalize="characters"
        className="inner min-h-11 w-full rounded-xl px-3 text-sm outline-none"
      />
      <button
        disabled={confirm !== 'ERASE'}
        onClick={wipeWallet}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold disabled:opacity-30"
        style={{ background: 'rgba(255,77,106,0.14)', color: 'var(--danger)' }}
      >
        <Trash2 className="size-4" /> Erase from this device
      </button>
    </Card>
  )
}

function GuardiansCard() {
  const { address } = useMeshState()
  const [pin, setPinValue] = useState('')
  const [shards, setShards] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const labels = ['Guardian 1', 'Guardian 2', 'Keep for yourself']

  const make = async () => {
    setBusy(true)
    const secret = await revealSecret(pin)
    setBusy(false)
    setPinValue('')
    if (!secret) return toast.error('Wrong PIN, or too many tries.')
    setShards(splitKey(secret.key, address))
    setTimeout(() => setShards(null), 120_000)
  }

  return (
    <Card title="Guardian recovery">
      <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        Split your key into 3 shards. Any 2 rebuild the wallet and 1 alone reveals nothing. Give two to people you trust and keep one yourself.
      </p>
      {shards ? (
        <>
          <ul className="space-y-2">
            {shards.map((shard, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{labels[i]}</span>
                <GhostButton
                  onClick={() => void navigator.clipboard.writeText(shard).then(() => toast.success(`${labels[i]} copied. Send it privately.`))}
                >
                  Copy
                </GhostButton>
              </li>
            ))}
          </ul>
          <p className="text-xs" style={{ color: 'var(--warn)' }}>
            These disappear in 2 minutes. Never post a shard anywhere public.
          </p>
          <GhostButton className="w-full" onClick={() => setShards(null)}>
            <EyeOff className="size-4" /> Hide shards
          </GhostButton>
        </>
      ) : (
        <>
          <PinField value={pin} onChange={setPinValue} label="PIN to create shards" />
          <GhostButton className="w-full" disabled={pin.length !== 6 || busy} onClick={() => void make()}>
            <Users className="size-4" /> Create 3 shards
          </GhostButton>
        </>
      )}
    </Card>
  )
}
