import { useState } from 'react'
import { getAddress, isAddress } from 'viem'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { deleteContact, saveContactByAddress, useMeshState, type Contact } from '@/lib/store'
import { GhostButton, PrimaryButton, Sheet } from './ui'

export const DELETE_CONTACT_WARNING =
  'Removes them from your contacts and deletes your messages with them. Payments stay in your history. You can add them again any time.'

/** Asks before deleting a contact. Payments and history are never touched. */
export function DeleteContactSheet({ contact, onClose, onDeleted }: { contact: Contact | null; onClose: () => void; onDeleted?: () => void }) {
  return (
    <Sheet open={!!contact} onClose={onClose} title="Delete contact">
      {contact && (
        <div className="space-y-4">
          <p className="text-sm font-semibold">Delete {contact.name}?</p>
          <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
            {DELETE_CONTACT_WARNING}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton
              onClick={() => {
                deleteContact(contact.address)
                toast.success(`${contact.name} deleted.`)
                onClose()
                onDeleted?.()
              }}
              style={{ background: 'var(--danger)', color: '#fff' }}
            >
              Delete contact
            </PrimaryButton>
          </div>
        </div>
      )}
    </Sheet>
  )
}

/** One tap after paying someone who is not a contact yet: give them a name and keep them. */
export function SaveAsContact({ address }: { address: string }) {
  const { contacts } = useMeshState()
  const [name, setName] = useState('')
  if (!isAddress(address)) return null
  const known = contacts.find((c) => c.address.toLowerCase() === address.toLowerCase())
  if (known) return null
  return (
    <div className="inner space-y-2 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="size-4" /> Save as contact
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 24))}
        placeholder="Name"
        aria-label="Contact name"
        className="inner min-h-12 w-full rounded-2xl px-4 text-sm outline-none"
      />
      <GhostButton
        className="w-full"
        onClick={() => {
          if (saveContactByAddress(getAddress(address), name.trim())) toast.success('Saved. They are in your Chats.')
          else toast.error('Your contact list is full.')
        }}
      >
        Save contact
      </GhostButton>
    </div>
  )
}
