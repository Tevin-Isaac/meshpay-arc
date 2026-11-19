import { IS_MAINNET } from '@/lib/network'
import { useState } from 'react'
import { toast } from 'sonner'
import { Eye, KeyRound, ShieldCheck } from 'lucide-react'
import type { Hex } from 'viem'
import { createWallet, readBackup, restoreWallet } from '@/lib/store'
import { groupAddress } from '@/lib/guard'
import { recoverKey } from '@/lib/guardians'
import { pinProblem } from '@/lib/vault'
import { isValidMnemonic, keyFromMnemonic, newMnemonic, normalizeMnemonic } from '@/lib/wallet'
import { AuthShell, PinField } from './PinField'
import { GhostButton, PrimaryButton } from './ui'

function pickPositions(count: number): number[] {
  const set = new Set<number>()
  const buf = new Uint32Array(1)
  while (set.size < 3) {
    crypto.getRandomValues(buf)
    set.add(buf[0] % count)
  }
  return [...set].sort((a, b) => a - b)
}

type Step = 'welcome' | 'phrase' | 'confirm' | 'import' | 'pin'

/** First launch: create a wallet with a recovery phrase, or restore one, then protect it with a PIN. */
export function Onboarding() {
  const [step, setStep] = useState<Step>('welcome')
  const [mnemonic, setMnemonic] = useState('')
  const [recovered, setRecovered] = useState<Hex | null>(null)
  const [restored, setRestored] = useState<Awaited<ReturnType<typeof readBackup>> | null>(null)
  const [from, setFrom] = useState<'create' | 'import'>('create')

  if (step === 'welcome') {
    return (
      <AuthShell
        title={
          <>
            Money that moves <span className="serif" style={{ color: 'var(--accent)' }}>off the grid</span>
          </>
        }
      >
        <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
          Self-custody USDC on Arc. Sign payments with no internet, hand them over by QR code, and chat privately online or off.
        </p>
        <PrimaryButton
          onClick={() => {
            setMnemonic(newMnemonic())
            setFrom('create')
            setStep('phrase')
          }}
        >
          Create a new wallet
        </PrimaryButton>
        <GhostButton
          className="w-full"
          onClick={() => {
            setFrom('import')
            setStep('import')
          }}
        >
          I already have a recovery phrase
        </GhostButton>
        <p className="text-[11px]" style={{ color: 'var(--subtle)' }}>
          {IS_MAINNET ? 'Arc mainnet. Real USDC. Beta: keep only small amounts here.' : 'Arc Testnet. Test USDC only.'}
        </p>
      </AuthShell>
    )
  }

  if (step === 'phrase') return <Phrase mnemonic={mnemonic} onBack={() => setStep('welcome')} onNext={() => setStep('confirm')} />
  if (step === 'confirm') return <Confirm mnemonic={mnemonic} onBack={() => setStep('phrase')} onNext={() => setStep('pin')} />
  if (step === 'import') {
    return (
      <ImportPhrase
        onBack={() => setStep('welcome')}
        onNext={(m) => {
          setMnemonic(m)
          setRecovered(null)
          setRestored(null)
          setStep('pin')
        }}
        onShards={(key) => {
          setMnemonic('')
          setRecovered(key)
          setRestored(null)
          setStep('pin')
        }}
        onBackup={(r) => {
          setMnemonic('')
          setRecovered(null)
          setRestored(r)
          setStep('pin')
        }}
      />
    )
  }
  return <SetPin mnemonic={mnemonic} recovered={recovered} restored={restored} onBack={() => setStep(from === 'create' ? 'confirm' : 'import')} />
}

function Phrase({ mnemonic, onBack, onNext }: { mnemonic: string; onBack: () => void; onNext: () => void }) {
  const [shown, setShown] = useState(false)
  const [saved, setSaved] = useState(false)
  const words = mnemonic.split(' ')
  return (
    <AuthShell title="Your recovery phrase" footer={<BackLink onClick={onBack} />}>
      <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
        These 12 words are the only way to get your money back if you lose this phone. Write them down on paper. Never share or screenshot them.
      </p>
      <div className="relative">
        <ol className={`grid grid-cols-3 gap-2 text-left transition ${shown ? '' : 'select-none blur-md'}`} aria-label="Recovery phrase">
          {words.map((w, i) => (
            <li key={i} className="inner mono rounded-xl px-2 py-2 text-xs">
              <span style={{ color: 'var(--subtle)' }}>{i + 1}.</span> {w}
            </li>
          ))}
        </ol>
        {!shown && (
          <button
            onClick={() => setShown(true)}
            className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--ink)' }}
          >
            <Eye className="size-4" /> Tap to reveal
          </button>
        )}
      </div>
      <label className="flex items-start gap-3 text-left text-xs" style={{ color: 'var(--muted)' }}>
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 size-5 accent-[#3ed9b8]" />
        I wrote the 12 words down and kept them somewhere safe.
      </label>
      <PrimaryButton onClick={onNext} disabled={!shown || !saved}>
        Continue
      </PrimaryButton>
    </AuthShell>
  )
}

function Confirm({ mnemonic, onBack, onNext }: { mnemonic: string; onBack: () => void; onNext: () => void }) {
  const words = mnemonic.split(' ')
  const [picks] = useState(() => pickPositions(words.length))
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const ok = picks.every((i) => (answers[i] ?? '').trim().toLowerCase() === words[i])
  return (
    <AuthShell title="Check your backup" footer={<BackLink onClick={onBack} />}>
      <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
        Type these words from your phrase to prove you saved it.
      </p>
      <div className="space-y-2 text-left">
        {picks.map((i) => (
          <label key={i} className="block">
            <span className="mb-1 block text-xs font-semibold" style={{ color: 'var(--subtle)' }}>
              Word {i + 1}
            </span>
            <input
              value={answers[i] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label={`Word ${i + 1}`}
              className="inner mono min-h-12 w-full rounded-2xl px-4 text-sm outline-none"
            />
          </label>
        ))}
      </div>
      <PrimaryButton onClick={onNext} disabled={!ok}>
        Continue
      </PrimaryButton>
    </AuthShell>
  )
}

function ImportPhrase({
  onBack,
  onNext,
  onShards,
  onBackup,
}: {
  onBack: () => void
  onNext: (mnemonic: string) => void
  onShards: (key: Hex) => void
  onBackup: (restored: Awaited<ReturnType<typeof readBackup>>) => void
}) {
  const [mode, setMode] = useState<'phrase' | 'shards' | 'backup'>('phrase')
  const [text, setText] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState<{ key: Hex; address: string } | null>(null)
  const valid = isValidMnemonic(text)

  const findShards = () => {
    try {
      const pieces = text
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
      setFound(recoverKey(pieces))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not use those shards.')
    }
  }

  const openBackup = async () => {
    setBusy(true)
    try {
      onBackup(await readBackup(text.trim(), pass))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open that backup.')
    } finally {
      setBusy(false)
    }
  }

  if (found) {
    return (
      <AuthShell title="Is this your wallet?" footer={<BackLink onClick={() => setFound(null)} />}>
        <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
          These shards rebuild the wallet below. Only continue if you recognise it.
        </p>
        <div className="inner mono break-words rounded-2xl p-3 text-xs leading-relaxed">{groupAddress(found.address)}</div>
        <PrimaryButton onClick={() => onShards(found.key)}>Yes, this is mine</PrimaryButton>
      </AuthShell>
    )
  }

  const labels = { phrase: 'Recovery phrase', shards: 'Guardian shards', backup: 'Backup file' } as const

  return (
    <AuthShell title="Restore your wallet" footer={<BackLink onClick={onBack} />}>
      <div className="grid grid-cols-3 gap-1 rounded-2xl p-1" style={{ background: 'var(--surface-muted)' }}>
        {(['phrase', 'shards', 'backup'] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m)
              setText('')
              setPass('')
            }}
            className="min-h-10 rounded-xl text-[11px] font-semibold"
            style={{ background: mode === m ? 'var(--surface-strong)' : 'transparent', color: mode === m ? 'var(--ink)' : 'var(--muted)' }}
          >
            {labels[m]}
          </button>
        ))}
      </div>
      <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
        {mode === 'phrase' && 'Enter your 12 or 24 word recovery phrase. It works with the WayaMesh mobile app too.'}
        {mode === 'shards' && 'Paste any two of your three guardian shards, one per line.'}
        {mode === 'backup' && 'Paste the contents of your backup file and enter the passphrase you chose for it.'}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 8_000_000))}
        rows={mode === 'phrase' ? 4 : 5}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-label={labels[mode]}
        placeholder={mode === 'phrase' ? 'word1 word2 word3 …' : mode === 'shards' ? '{"v":1,"i":1,…}' : '{"kind":"wayamesh-backup",…}'}
        className="inner mono w-full resize-none rounded-2xl p-3 text-sm outline-none"
      />
      {mode === 'backup' && (
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value.slice(0, 200))}
          autoComplete="off"
          placeholder="Backup passphrase"
          aria-label="Backup passphrase"
          className="inner min-h-12 w-full rounded-2xl px-4 text-base outline-none"
        />
      )}
      {mode === 'phrase' && text.trim().length > 0 && !valid && (
        <p className="text-xs" style={{ color: 'var(--warn)' }}>
          That is not a valid phrase yet. Check the spelling and the number of words.
        </p>
      )}
      {mode === 'phrase' && (
        <PrimaryButton onClick={() => onNext(normalizeMnemonic(text))} disabled={!valid}>
          Continue
        </PrimaryButton>
      )}
      {mode === 'shards' && (
        <PrimaryButton onClick={findShards} disabled={!text.trim()}>
          Rebuild my wallet
        </PrimaryButton>
      )}
      {mode === 'backup' && (
        <PrimaryButton onClick={() => void openBackup()} loading={busy} disabled={!text.trim() || !pass}>
          Open backup
        </PrimaryButton>
      )}
    </AuthShell>
  )
}

function SetPin({ mnemonic, recovered, restored, onBack }: { mnemonic: string; recovered: Hex | null; restored: Awaited<ReturnType<typeof readBackup>> | null; onBack: () => void }) {
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const problem = pin.length === 6 ? pinProblem(pin) : null

  const save = async () => {
    if (pin !== again) return toast.error('The two PINs do not match.')
    setBusy(true)
    try {
      await (restored ? restoreWallet(restored, pin) : recovered ? createWallet(null, recovered, pin) : createWallet(mnemonic, keyFromMnemonic(mnemonic), pin))
      toast.success('Wallet ready. Welcome to WayaMesh.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the wallet.')
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Protect it with a PIN" footer={<BackLink onClick={onBack} />}>
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl" style={{ background: 'rgba(62,217,184,0.12)', color: 'var(--accent)' }}>
        <ShieldCheck className="size-6" />
      </div>
      <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
        A 6-digit PIN encrypts your key and every message on this phone. A forgotten PIN cannot be reset, but your recovery phrase can restore the wallet.
      </p>
      <PinField value={pin} onChange={setPin} label="New PIN" autoFocus />
      <PinField value={again} onChange={setAgain} label="Repeat PIN" />
      {problem && (
        <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
          {problem}
        </p>
      )}
      <PrimaryButton onClick={() => void save()} loading={busy} disabled={pin.length !== 6 || again.length !== 6 || !!problem}>
        <KeyRound className="size-4" />
        Create wallet
      </PrimaryButton>
    </AuthShell>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="min-h-11 text-xs font-semibold" style={{ color: 'var(--subtle)' }}>
      Back
    </button>
  )
}
