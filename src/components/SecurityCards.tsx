import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Download, Eye, EyeOff, Trash2, Upload, Users } from 'lucide-react'
import { splitKey } from '@/lib/guardians'
import { createBackup, readBackup, restoreWallet, revealSecret, useMeshState, wipeWallet } from '@/lib/store'
import { passphraseProblem, pinProblem } from '@/lib/vault'
import { GhostButton } from './ui'
import { SecretField, secretReady } from './PinField'

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="inner space-y-3 rounded-2xl p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

const label = (kind: 'pin' | 'pass') => (kind === 'pin' ? 'PIN' : 'passphrase')

export function PhraseCard() {
  const { secretKind } = useMeshState()
  const [pin, setPinValue] = useState('')
  const [secret, setSecret] = useState<{ key: string; mnemonic: string | null } | null>(null)
  const [busy, setBusy] = useState(false)

  const reveal = async () => {
    setBusy(true)
    const res = await revealSecret(pin)
    setBusy(false)
    setPinValue('')
    if (!res) return toast.error(`Wrong ${label(secretKind)}, or too many tries.`)
    setSecret(res)
    setTimeout(() => setSecret(null), 30_000)
  }

  return (
    <Card title="Recovery phrase">
      {secret ? (
        <>
          <div className="mono break-words rounded-xl p-3 text-xs leading-relaxed" style={{ background: 'var(--surface-muted)' }}>
            {secret.mnemonic ?? secret.key}
          </div>
          <p className="text-xs text-pretty" style={{ color: 'var(--warn)' }}>
            {secret.mnemonic ? 'Anyone with these words owns your wallet. It hides again in 30 seconds.' : 'This older wallet has no phrase, only a key. Make a backup now.'}
          </p>
          <GhostButton className="w-full" onClick={() => setSecret(null)}>
            <EyeOff className="size-4" /> Hide
          </GhostButton>
        </>
      ) : (
        <>
          <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
            Enter your {label(secretKind)} to show the 12 words that can rebuild this wallet on any device.
          </p>
          <SecretField value={pin} onChange={setPinValue} label={`${label(secretKind)} to reveal`} kind={secretKind} />
          <GhostButton className="w-full" disabled={!secretReady(pin, secretKind) || busy} onClick={() => void reveal()}>
            <Eye className="size-4" /> Reveal phrase
          </GhostButton>
        </>
      )}
    </Card>
  )
}

function copyThenClear(text: string, done: string) {
  void navigator.clipboard.writeText(text).then(() => {
    toast.success(done)
    // Do not leave a key shard on the clipboard.
    setTimeout(() => {
      void navigator.clipboard
        .readText()
        .then((now) => (now === text ? navigator.clipboard.writeText('') : undefined))
        .catch(() => undefined)
    }, 60_000)
  })
}

export function GuardiansCard() {
  const { address, secretKind } = useMeshState()
  const [pin, setPinValue] = useState('')
  const [shards, setShards] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const labels = ['Guardian 1', 'Guardian 2', 'Keep for yourself']

  const make = async () => {
    setBusy(true)
    const secret = await revealSecret(pin)
    setBusy(false)
    setPinValue('')
    if (!secret) return toast.error(`Wrong ${label(secretKind)}, or too many tries.`)
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
                <GhostButton onClick={() => copyThenClear(shard, `${labels[i]} copied. Send it privately. The clipboard clears in a minute.`)}>Copy</GhostButton>
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
          <SecretField value={pin} onChange={setPinValue} label={`${label(secretKind)} to create shards`} kind={secretKind} />
          <GhostButton className="w-full" disabled={!secretReady(pin, secretKind) || busy} onClick={() => void make()}>
            <Users className="size-4" /> Create 3 shards
          </GhostButton>
        </>
      )}
    </Card>
  )
}

export function BackupCard() {
  const [phrase, setPhrase] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [json, setJson] = useState('')
  const [backupPass, setBackupPass] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const problem = phrase ? passphraseProblem(phrase) : null

  const download = async () => {
    if (phrase !== again) return toast.error('The two passphrases do not match.')
    setBusy(true)
    try {
      const data = await createBackup(phrase)
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'wayamesh-backup.json'
      a.click()
      URL.revokeObjectURL(url)
      setPhrase('')
      setAgain('')
      toast.success('Backup saved. You need the passphrase you just chose to open it. Keep both somewhere safe.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not make the backup.')
    } finally {
      setBusy(false)
    }
  }

  const restore = async () => {
    setBusy(true)
    try {
      const restored = await readBackup(json.trim(), backupPass)
      await restoreWallet(restored, newPin)
      setJson('')
      setBackupPass('')
      setNewPin('')
      setConfirm('')
      toast.success('Backup restored. This device now uses the PIN you just set.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not restore that backup.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Encrypted backup">
      <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        A file with your wallet, messages and payments. It is locked with a separate passphrase of at least 12 characters, not your PIN, because a 6-digit PIN is too
        easy to guess if someone gets the file. Store the file and the passphrase in different places.
      </p>
      <input
        type="password"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value.slice(0, 200))}
        autoComplete="off"
        placeholder="Backup passphrase (12+ characters)"
        aria-label="Backup passphrase"
        className="inner min-h-11 w-full rounded-xl px-3 text-base outline-none"
      />
      <input
        type="password"
        value={again}
        onChange={(e) => setAgain(e.target.value.slice(0, 200))}
        autoComplete="off"
        placeholder="Repeat the passphrase"
        aria-label="Repeat backup passphrase"
        className="inner min-h-11 w-full rounded-xl px-3 text-base outline-none"
      />
      {problem && (
        <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
          {problem}
        </p>
      )}
      <GhostButton className="w-full" onClick={() => void download()} disabled={busy || !phrase || !!problem || again.length === 0}>
        <Download className="size-4" /> Download backup
      </GhostButton>

      <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value.slice(0, 8_000_000))}
          rows={2}
          placeholder="Paste a backup file's contents to restore"
          aria-label="Backup to restore"
          className="inner mono w-full resize-none rounded-xl p-3 text-[11px] outline-none"
        />
        {json.trim() && (
          <div className="mt-2 space-y-2">
            <input
              type="password"
              value={backupPass}
              onChange={(e) => setBackupPass(e.target.value.slice(0, 200))}
              autoComplete="off"
              placeholder="That backup's passphrase"
              aria-label="Passphrase for this backup"
              className="inner min-h-11 w-full rounded-xl px-3 text-base outline-none"
            />
            <SecretField value={newPin} onChange={setNewPin} label="New PIN for this device" kind="pin" />
            {newPin.length === 6 && pinProblem(newPin) && (
              <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
                {pinProblem(newPin)}
              </p>
            )}
            <p className="text-xs text-pretty" style={{ color: 'var(--warn)' }}>
              Restoring replaces the wallet that is on this device now. Make sure you have its recovery phrase first.
            </p>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type REPLACE to confirm"
              aria-label="Type REPLACE to confirm"
              autoCapitalize="characters"
              className="inner min-h-11 w-full rounded-xl px-3 text-sm outline-none"
            />
            <GhostButton
              className="w-full"
              disabled={busy || confirm !== 'REPLACE' || !backupPass || newPin.length !== 6 || !!pinProblem(newPin)}
              onClick={() => void restore()}
            >
              <Upload className="size-4" /> Restore this backup
            </GhostButton>
          </div>
        )}
      </div>
    </Card>
  )
}

export function EraseCard() {
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
        style={{ background: 'var(--tint-danger)', color: 'var(--danger)' }}
      >
        <Trash2 className="size-4" /> Erase from this device
      </button>
    </Card>
  )
}

