import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, BadgeCheck, Clock, Hand, Send, ShieldCheck, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { parseUsdc } from '@/onchain-money'
import { randomRef } from '@/lib/mesh'
import { fmtUsdc, timeAgo } from '@/lib/format'
import { addInvoice, patchContact, useMeshState, type ChatMessage, type Contact } from '@/lib/store'
import { safetyNumber } from '@/lib/chat/crypto'
import { myPubkey, sendChat } from '@/lib/chat/service'
import { useNet } from '@/lib/net'
import { useRelayStatus } from '@/lib/chat/relay'
import { CodeSheet } from './CodeSheet'
import { AmountInput, Chip, GhostButton, PrimaryButton } from './ui'
import { useSheets } from './shell/useSheets'

/** One encrypted conversation: text, payment requests and payments in the same thread. */
export function Thread({ contact, onBack }: { contact: Contact; onBack: () => void }) {
  const { messages, items } = useMeshState()
  const { online } = useNet()
  const relays = useRelayStatus()
  const sheets = useSheets()
  const [text, setText] = useState('')
  const [asking, setAsking] = useState(false)
  const [askAmount, setAskAmount] = useState('')
  const [info, setInfo] = useState(false)
  const [offlineCode, setOfflineCode] = useState<string | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  const thread = useMemo(
    () => messages.filter((m) => m.peer.toLowerCase() === contact.address.toLowerCase()).sort((a, b) => a.ts - b.ts),
    [messages, contact.address],
  )
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [thread.length])

  const send = async () => {
    const body = text.trim()
    if (!body) return
    setText('')
    try {
      await sendChat(contact, { k: 'text', x: body.slice(0, 500) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send.')
    }
  }

  const ask = async () => {
    let raw: bigint
    try {
      raw = parseUsdc(askAmount || '0')
    } catch {
      return toast.error('Enter a valid amount.')
    }
    if (raw <= 0n) return toast.error('Enter an amount above zero.')
    const ref = randomRef()
    addInvoice({ ref, amount: askAmount, note: `From chat with ${contact.name}`, createdAt: Date.now(), status: 'open' })
    await sendChat(contact, { k: 'request', a: askAmount, r: ref, x: text.trim() || undefined })
    setAsking(false)
    setAskAmount('')
    setText('')
  }

  const connected = online && relays.connected > 0
  const number = safetyNumber(myPubkey(), contact.pubkey)

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <div className="flex items-center gap-2 pb-3">
        <button onClick={onBack} aria-label="Back to chats" className="flex size-11 items-center justify-center rounded-full" style={{ background: 'var(--surface-muted)' }}>
          <ArrowLeft className="size-5" />
        </button>
        <button onClick={() => setInfo((v) => !v)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5 truncate font-semibold">
            {contact.name}
            {contact.verified && <BadgeCheck className="size-4 shrink-0" style={{ color: 'var(--accent)' }} />}
          </div>
          <div className="text-[11px]" style={{ color: connected ? 'var(--success)' : 'var(--warn)' }}>
            {connected ? 'Encrypted · delivering live' : 'Encrypted · will deliver when online'}
          </div>
        </button>
      </div>

      {info && (
        <div className="inner mb-3 space-y-2 rounded-2xl p-3 text-xs">
          <label className="block">
            <span className="mb-1 block font-semibold">Name</span>
            <input
              defaultValue={contact.name}
              onBlur={(e) => {
                const name = e.target.value.trim().slice(0, 24)
                if (name && name !== contact.name) patchContact(contact.address, { name })
              }}
              aria-label="Contact name"
              className="inner min-h-11 w-full rounded-xl px-3 text-sm outline-none"
            />
          </label>
          <div className="flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="size-4" style={{ color: 'var(--accent)' }} /> Safety number
          </div>
          <p className="mono break-words leading-relaxed">{number}</p>
          <p className="text-pretty" style={{ color: 'var(--muted)' }}>
            Compare this with {contact.name} in person or on a call. If it matches, nobody is listening in between.
          </p>
          <GhostButton className="w-full" onClick={() => patchContact(contact.address, { verified: !contact.verified })}>
            {contact.verified ? 'Verified. Tap to undo' : 'Mark as verified'}
          </GhostButton>
        </div>
      )}

      <div className="flex-1 space-y-2 pb-3" aria-live="polite">
        {thread.length === 0 && (
          <p className="py-10 text-center text-sm text-pretty" style={{ color: 'var(--subtle)' }}>
            Messages here are encrypted on your phone. Say hello, request a payment, or send one.
          </p>
        )}
        {thread.map((m) => (
          <Bubble
            key={m.id}
            m={m}
            item={items.find((i) => i.id === m.voucherId)}
            name={contact.name}
            onPay={() => sheets.open('send', { to: contact.address, amount: m.amount, ref: m.ref, note: m.text })}
            onCode={() => setOfflineCode(m.code ?? null)}
          />
        ))}
        <div ref={bottom} />
      </div>

      {asking ? (
        <div className="space-y-2">
          <AmountInput value={askAmount} onChange={setAskAmount} hint="Amount to request" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 80))}
            placeholder="What is it for? (optional)"
            aria-label="Note"
            className="inner min-h-12 w-full rounded-2xl px-4 text-sm outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <GhostButton onClick={() => setAsking(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void ask()}>Request</PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <GhostButton onClick={() => sheets.open('send', { to: contact.address })} aria-label="Pay in chat" className="shrink-0">
              <Wallet className="size-4" /> Pay
            </GhostButton>
            <GhostButton onClick={() => setAsking(true)} aria-label="Request a payment" className="shrink-0">
              <Hand className="size-4" /> Request
            </GhostButton>
          </div>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void send()
              }}
              placeholder="Message"
              aria-label="Message"
              className="inner min-h-12 min-w-0 flex-1 rounded-2xl px-4 text-sm outline-none"
            />
            <button
              onClick={() => void send()}
              disabled={!text.trim()}
              aria-label="Send message"
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl disabled:opacity-30"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              <Send className="size-5" />
            </button>
          </div>
        </div>
      )}
      <OfflineCode code={offlineCode} onClose={() => setOfflineCode(null)} />
    </div>
  )
}

function OfflineCode({ code, onClose }: { code: string | null; onClose: () => void }) {
  return (
    <CodeSheet
      item={null}
      raw={code ? { title: 'Hand over offline', hint: 'Show this to the person, or to any phone that will carry it. Only they can read it.', code } : null}
      onClose={onClose}
    />
  )
}

function Bubble({ m, item, name, onPay, onCode }: { m: ChatMessage; item?: { status: string }; name: string; onPay: () => void; onCode: () => void }) {
  const mine = m.dir === 'out'
  const amount = m.amount ? fmtUsdc(parseUsdc(m.amount)) : ''
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[82%] space-y-1.5 rounded-2xl px-3.5 py-2.5 text-sm"
        style={{
          background: mine ? 'rgba(62,217,184,0.16)' : 'var(--surface-muted)',
          border: `1px solid ${mine ? 'rgba(62,217,184,0.3)' : 'var(--border)'}`,
        }}
      >
        {m.kind === 'text' && <p className="whitespace-pre-wrap break-words text-pretty">{m.text}</p>}
        {m.kind === 'request' && (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
              {mine ? 'You requested' : `${name} requested`}
            </div>
            <div className="display text-xl font-bold tabular-nums">{amount} USDC</div>
            {m.text && <p className="text-xs" style={{ color: 'var(--muted)' }}>{m.text}</p>}
            {!mine && (
              <button onClick={onPay} className="mt-1 min-h-10 w-full rounded-xl text-xs font-semibold" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                Pay {amount} USDC
              </button>
            )}
          </>
        )}
        {m.kind === 'payment' && (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
              {mine ? 'You paid' : `${name} paid you`}
            </div>
            <div className="display text-xl font-bold tabular-nums">{amount} USDC</div>
            {m.text && <p className="text-xs" style={{ color: 'var(--muted)' }}>{m.text}</p>}
            <Chip tone={item?.status === 'settled' ? 'good' : 'neutral'}>{item?.status === 'settled' ? 'Settled on Arc' : 'Signed · settles when online'}</Chip>
          </>
        )}
        <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--subtle)' }}>
          <span>{timeAgo(m.ts)}</span>
          {mine && m.status === 'queued' && (
            <>
              <span className="inline-flex items-center gap-1" style={{ color: 'var(--warn)' }}>
                <Clock className="size-3" /> Queued
              </span>
              {m.code && (
                <button onClick={onCode} className="font-semibold underline" style={{ color: 'var(--accent)' }}>
                  Hand over
                </button>
              )}
            </>
          )}
          {mine && m.status === 'sent' && <span>Sent</span>}
        </div>
      </div>
    </div>
  )
}
