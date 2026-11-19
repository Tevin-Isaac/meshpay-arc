import { useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { toast } from 'sonner'
import { shortAddress } from '@/lib/format'
import { setSettings, useMeshState } from '@/lib/store'
import { encodeCard, type ContactCard } from '@/lib/chat/crypto'
import { scan } from '@/lib/scan'
import { myCard } from '@/lib/chat/service'
import { CardConfirm } from './CardConfirm'
import { CodeShare } from './CodeShare'
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

  const add = async () => {
    try {
      const res = await scan(text)
      if (res.kind !== 'contact') return toast.error('That is not a contact card.')
      setCard(res.card)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read that card.')
    }
  }

  if (card) return <CardConfirm card={card} onDone={onClose} />

  return (
    <div className="space-y-4">
      <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
        Share your card once with someone you trust. It lets you message and pay each other, end-to-end encrypted, online or off.
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
      <CodeShare code={encodeCard(myCard(settings.displayName))} label="Your contact card" />
      <p className="mono text-center text-xs" style={{ color: 'var(--subtle)' }}>
        {shortAddress(address)}
      </p>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a friend's card"
          aria-label="Paste a contact card"
          spellCheck={false}
          className="inner mono min-h-11 min-w-0 flex-1 rounded-2xl px-3 text-xs outline-none"
        />
        <GhostButton onClick={() => void add()} disabled={!text.trim()} aria-label="Add contact">
          <ClipboardPaste className="size-4" />
        </GhostButton>
      </div>
    </div>
  )
}
