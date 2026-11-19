import { useMemo, useState } from 'react'
import { MessageSquarePlus, ShieldQuestion, UserPlus } from 'lucide-react'
import { fmtDecimal, timeAgo } from '@/lib/format'
import { patchContact, removeContact, useMeshState, type ChatMessage, type Contact } from '@/lib/store'
import { ContactSheet } from '../ContactSheet'
import { Thread } from '../Thread'
import { PrimaryButton } from '../ui'

function preview(m?: ChatMessage): string {
  if (!m) return 'No messages yet'
  const who = m.dir === 'out' ? 'You: ' : ''
  if (m.kind === 'payment') return m.verified ? `${who}Payment ${fmtDecimal(m.amount)} USDC` : `${who}Payment code (not verified)`
  if (m.kind === 'request') return `${who}Requested ${fmtDecimal(m.amount)} USDC`
  return `${who}${String(m.text ?? '').slice(0, 120)}`
}

export function ChatsTab() {
  const { contacts, messages } = useMeshState()
  const [openAddress, setOpenAddress] = useState<string | null>(null)
  const [cardOpen, setCardOpen] = useState(false)

  const last = useMemo(() => {
    const map = new Map<string, ChatMessage>()
    for (const m of messages) {
      const key = m.peer.toLowerCase()
      const prev = map.get(key)
      if (!prev || m.ts > prev.ts) map.set(key, m)
    }
    return map
  }, [messages])

  const selected = openAddress ? contacts.find((c) => c.address.toLowerCase() === openAddress.toLowerCase()) : undefined
  if (selected) return <Thread contact={selected} onBack={() => setOpenAddress(null)} />

  const requests = contacts.filter((c) => c.request)
  const friends = contacts
    .filter((c) => !c.request)
    .sort((a, b) => (last.get(b.address.toLowerCase())?.ts ?? b.addedAt) - (last.get(a.address.toLowerCase())?.ts ?? a.addedAt))

  const row = (c: Contact) => {
    const m = last.get(c.address.toLowerCase())
    return (
      <li key={c.address}>
        <button onClick={() => setOpenAddress(c.address)} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
          <div
            className="display flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold"
            style={{ background: 'var(--tint-accent)', color: 'var(--accent)' }}
          >
            {c.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{c.name}</div>
            <div className="truncate text-xs" style={{ color: 'var(--muted)' }}>
              {preview(m)}
            </div>
          </div>
          {m && (
            <span className="text-[11px]" style={{ color: 'var(--subtle)' }}>
              {timeAgo(m.ts)}
            </span>
          )}
        </button>
      </li>
    )
  }

  return (
    <div className="space-y-3">
      <section className="glass rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="display text-xl font-bold">Chats</h2>
          <button
            onClick={() => setCardOpen(true)}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            <UserPlus className="size-4" /> Add contact
          </button>
        </div>

        {friends.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquarePlus className="mx-auto size-8" style={{ color: 'var(--accent)' }} />
            <p className="mx-auto mt-3 max-w-xs text-sm text-pretty" style={{ color: 'var(--muted)' }}>
              Chat and pay in the same thread, end-to-end encrypted. Exchange contact cards to start, online or in person.
            </p>
            <div className="mx-auto mt-4 max-w-xs">
              <PrimaryButton onClick={() => setCardOpen(true)}>Share my card or add one</PrimaryButton>
            </div>
          </div>
        ) : (
          <ul className="mt-1 divide-y" style={{ borderColor: 'var(--border)' }}>
            {friends.map(row)}
          </ul>
        )}
      </section>

      {requests.length > 0 && (
        <section className="glass rounded-3xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldQuestion className="size-4" style={{ color: 'var(--warn)' }} /> Message requests
          </h3>
          <p className="mt-1 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
            People you have not added wrote to you. Nothing is shown until you accept.
          </p>
          <ul className="mt-2 space-y-2">
            {requests.map((c) => (
              <li key={c.address} className="inner flex items-center gap-3 rounded-2xl p-3">
                <div className="mono min-w-0 flex-1 truncate text-xs">{c.name}</div>
                <button
                  onClick={() => patchContact(c.address, { request: false })}
                  className="min-h-10 rounded-full px-3 text-xs font-semibold"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  Accept
                </button>
                <button
                  onClick={() => removeContact(c.address)}
                  className="min-h-10 rounded-full px-3 text-xs font-semibold"
                  style={{ background: 'var(--tint-danger)', color: 'var(--danger)' }}
                >
                  Block
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ContactSheet open={cardOpen} onClose={() => setCardOpen(false)} />
    </div>
  )
}
