import { useState } from 'react'
import { ClipboardPaste, ScanLine } from 'lucide-react'
import { getAddress, isAddress } from 'viem'
import { toast } from 'sonner'
import { shortAddress } from '@/lib/format'
import { setSettings, useMeshState } from '@/lib/store'
import { encodeCard, type ContactCard } from '@/lib/chat/crypto'
import { scan } from '@/lib/scan'
import { myCard } from '@/lib/chat/service'
import { CardConfirm } from './CardConfirm'
import { CodeShare } from './CodeShare'
import { QrScanner } from './QrScanner'
import { SaveAsContact } from './ContactActions'
import { GhostButton, Sheet } from './ui'

export function ContactSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Contact card">
      <ContactBody onClose={onClose} />
    </Sheet>
  )
}

function ContactBody({ onClose }: { onClose: () => void }) {
  const { address, settings } = useMeshState()
  const [text, setText] = useState('')
  const [card, setCard] = useState<ContactCard | null>(null)

  const [byAddress, setByAddress] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const add = async (value = text) => {
    const v = value.trim()
    if (isAddress(v)) return setByAddress(getAddress(v))
    try {
      const res = await scan(v)
      if (res.kind !== 'contact') return toast.error('That is not a contact card.')
      setCard(res.card)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read that card.')
    }
  }

  if (card) return <CardConfirm card={card} onDone={onClose} />
  if (byAddress)
    return (
      <div className="space-y-3">
        <p className="mono break-all text-xs" style={{ color: 'var(--muted)' }}>
          {byAddress}
        </p>
        <SaveAsContact address={byAddress} onSaved={onClose} />
        <GhostButton className="w-full" onClick={() => setByAddress(null)}>
          Back
        </GhostButton>
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm font-semibold">Add someone</div>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add()
            }}
            placeholder="Wallet address or contact card"
            aria-label="Address or contact card"
            spellCheck={false}
            className="inner mono min-h-11 min-w-0 flex-1 rounded-2xl px-3 text-xs outline-none"
          />
          <GhostButton
            onClick={() =>
              navigator.clipboard
                ?.readText()
                .then((t) => {
                  setText(t)
                  void add(t)
                })
                .catch(() => toast.error('Paste it into the box instead.'))
            }
            aria-label="Paste from clipboard"
          >
            <ClipboardPaste className="size-4" />
          </GhostButton>
          <GhostButton onClick={() => setScanning((v) => !v)} aria-label="Scan a QR code">
            <ScanLine className="size-4" />
          </GhostButton>
        </div>
        {scanning && (
          <QrScanner
            onResult={(v) => {
              setScanning(false)
              setText(v)
              void add(v)
            }}
          />
        )}
        <GhostButton className="w-full" onClick={() => void add()} disabled={!text.trim()} aria-label="Add contact">
          Add contact
        </GhostButton>
        <p className="text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
          An address is enough: you can pay them straight away, and chat switches on when they open Wayamesh.
        </p>
      </div>
      <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-2 text-sm font-semibold">Your card</div>
        <p className="mb-3 text-sm text-pretty" style={{ color: 'var(--muted)' }}>
          Share it once with someone you trust. It lets you message and pay each other, end-to-end encrypted, online or off.
        </p>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold" style={{ color: 'var(--subtle)' }}>
            Your name on the card
          </span>
          <input
            defaultValue={settings.displayName}
            onChange={(e) => setSettings({ displayName: e.target.value.replace(/[\u0000-\u001f]/g, '').slice(0, 24) })}
            placeholder="Your wallet"
            maxLength={24}
            aria-label="Your name on the card"
            className="inner min-h-11 w-full rounded-2xl px-4 text-sm outline-none"
          />
        </label>
        <div className="mt-3">
          <CodeShare code={encodeCard(myCard(settings.displayName))} label="Your contact card" />
        </div>
        <p className="mono mt-2 text-center text-xs" style={{ color: 'var(--subtle)' }}>
          {shortAddress(address)}
        </p>
      </div>
    </div>
  )
}
