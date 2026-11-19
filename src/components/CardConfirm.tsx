import { useState } from 'react'
import { toast } from 'sonner'
import { cleanText } from '@/lib/mesh'
import { groupAddress } from '@/lib/guard'
import { useMeshState } from '@/lib/store'
import { addContactFromCard } from '@/lib/chat/service'
import type { ContactCard } from '@/lib/chat/crypto'
import { GhostButton, PrimaryButton } from './ui'

/** Nobody is added to your contacts without you seeing who they are first. */
export function CardConfirm({ card, onDone }: { card: ContactCard; onDone: () => void }) {
  const { contacts } = useMeshState()
  const [name, setName] = useState(card.name || '')
  const clean = cleanText(name, 24)
  const same = contacts.find((c) => c.name.toLowerCase() === clean.toLowerCase() && c.address.toLowerCase() !== card.address.toLowerCase())
  const existing = contacts.find((c) => c.address.toLowerCase() === card.address.toLowerCase())

  return (
    <div className="space-y-3">
      <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
        Add this person? Check the address with them in person or on a call before you trust it.
      </p>
      <div className="inner mono break-words rounded-2xl p-3 text-xs leading-relaxed">{groupAddress(card.address)}</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 24))}
        placeholder="Name"
        aria-label="Contact name"
        className="inner min-h-12 w-full rounded-2xl px-4 text-sm outline-none"
      />
      {same && (
        <p className="text-xs font-semibold" style={{ color: 'var(--warn)' }}>
          You already have a contact called {same.name} with a different address. Check this is the right person.
        </p>
      )}
      {existing && existing.pubkey && existing.pubkey !== card.pubkey && (
        <p className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
          This address is already a contact, but its encryption key is different. Only continue if they confirmed a new device.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <GhostButton onClick={onDone}>Cancel</GhostButton>
        <PrimaryButton
          onClick={() => {
            addContactFromCard({ ...card, name: clean })
            toast.success(`${clean || 'Contact'} added.`)
            onDone()
          }}
        >
          Add contact
        </PrimaryButton>
      </div>
    </div>
  )
}
