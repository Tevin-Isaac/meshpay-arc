import { useState } from 'react'
import { isAddress, getAddress } from 'viem'
import { unsafeRecipient } from '@/lib/guard'
import { toast } from 'sonner'
import { Bot, Pause, Play, Trash2 } from 'lucide-react'
import { parseUsdc } from '@/onchain-money'
import { fmtExact, shortAddress } from '@/lib/format'
import { addAudit, setStanding, useMeshState, type Standing } from '@/lib/store'
import { AmountInput, Chip, PrimaryButton, Sheet } from './ui'

export function AgentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Autopilot">
      <AgentBody />
    </Sheet>
  )
}

const DAY = 86_400_000

function AgentBody() {
  const { standing, audit, policy, contacts } = useMeshState()
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [every, setEvery] = useState<Standing['every']>('weekly')
  const [note, setNote] = useState('')
  const [days, setDays] = useState(0)
  const [cap, setCap] = useState('')

  const add = () => {
    if (!isAddress(to)) return toast.error('Enter a valid address, or pick a contact.')
    const unsafe = unsafeRecipient(to)
    if (unsafe) return toast.error(unsafe)
    let raw: bigint
    try {
      raw = parseUsdc(amount || '0')
    } catch {
      return toast.error('Enter a valid amount.')
    }
    if (raw <= 0n) return toast.error('Enter an amount above zero.')
    const addr = getAddress(to)
    const contact = contacts.find((c) => c.address.toLowerCase() === addr.toLowerCase())
    const entry: Standing = {
      id: crypto.randomUUID(),
      to: addr,
      name: contact?.name,
      amount,
      every,
      next: Date.now(),
      active: true,
      note: note || undefined,
      paid: 0,
      until: days > 0 ? Date.now() + days * DAY : undefined,
      maxTotal: cap || undefined,
      paidTotal: '0',
    }
    setStanding([entry, ...standing])
    addAudit(`Created ${every} standing payment of ${amount} USDC to ${contact?.name || shortAddress(addr)}.`)
    setTo('')
    setAmount('')
    setNote('')
    setCap('')
    toast.success('Autopilot payment created. The first one is signed within seconds.')
  }

  return (
    <div className="space-y-4">
      <div className="inner flex items-start gap-3 rounded-2xl p-4">
        <Bot className="mt-0.5 size-5 shrink-0" style={{ color: 'var(--accent)' }} />
        <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
          Recurring payments that sign on this phone with no connection. Every one stays inside your spending limits
          ({policy.perTx || '0'} per payment, {policy.daily || '0'} per day) and nothing can go to an address you have not listed here.
        </p>
      </div>

      {standing.length > 0 && (
        <ul className="space-y-2">
          {standing.map((s) => (
            <li key={s.id} className="inner flex items-center gap-3 rounded-2xl p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {s.amount} USDC to {s.name || shortAddress(s.to)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: 'var(--subtle)' }}>
                  <Chip tone={s.active ? 'good' : 'neutral'}>{s.active ? s.every : 'paused'}</Chip>
                  <span>
                    {s.paid} signed · {fmtExact(BigInt(s.paidTotal ?? '0'))} total
                  </span>
                </div>
              </div>
              <button
                aria-label={s.active ? 'Pause' : 'Resume'}
                className="flex size-11 items-center justify-center rounded-full"
                style={{ background: 'var(--surface-muted)' }}
                onClick={() => setStanding(standing.map((x) => (x.id === s.id ? { ...x, active: !x.active, next: Math.max(x.next, Date.now()) } : x)))}
              >
                {s.active ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <button
                aria-label="Delete"
                className="flex size-11 items-center justify-center rounded-full"
                style={{ background: 'var(--tint-danger)', color: 'var(--danger)' }}
                onClick={() => setStanding(standing.filter((x) => x.id !== s.id))}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">New standing payment</h3>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value.trim())}
          placeholder="Payee address 0x…"
          aria-label="Payee address"
          spellCheck={false}
          className="inner mono min-h-12 w-full rounded-2xl px-4 text-sm outline-none"
        />
        {contacts.filter((c) => !c.request).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {contacts
              .filter((c) => !c.request)
              .slice(0, 5)
              .map((c) => (
                <button key={c.address} onClick={() => setTo(c.address)} className="min-h-9 rounded-full px-3 text-xs font-semibold" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  {c.name}
                </button>
              ))}
          </div>
        )}
        <AmountInput value={amount} onChange={setAmount} />
        <div className="grid grid-cols-3 gap-1.5">
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setEvery(p)}
              className="min-h-11 rounded-xl text-xs font-semibold capitalize"
              style={{
                background: every === p ? 'var(--accent)' : 'var(--surface-muted)',
                color: every === p ? 'var(--on-accent)' : 'var(--ink)',
                border: '1px solid var(--border)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 60))}
          placeholder="What is it for? (optional)"
          aria-label="Note"
          className="inner min-h-12 w-full rounded-2xl px-4 text-sm outline-none"
        />
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 30, 90, 365].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="min-h-11 rounded-xl text-[11px] font-semibold"
              style={{
                background: days === d ? 'var(--accent)' : 'var(--surface-muted)',
                color: days === d ? 'var(--on-accent)' : 'var(--ink)',
                border: '1px solid var(--border)',
              }}
            >
              {d === 0 ? 'No end' : d === 365 ? '1 year' : `${d} days`}
            </button>
          ))}
        </div>
        <input
          value={cap}
          onChange={(e) => setCap(e.target.value.replace(/[^\d.]/g, ''))}
          inputMode="decimal"
          placeholder="Stop after this much in total (optional)"
          aria-label="Total cap"
          className="inner min-h-12 w-full rounded-2xl px-4 text-sm outline-none"
        />
        <PrimaryButton onClick={add}>Start autopilot payment</PrimaryButton>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Audit log</h3>
        {audit.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            Everything autopilot does is recorded here.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {audit.slice(0, 12).map((a, i) => (
              <li key={`${a.ts}-${i}`} className="flex gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full"
                  style={{ background: a.tone === 'bad' ? 'var(--danger)' : a.tone === 'warn' ? 'var(--warn)' : 'var(--accent)' }}
                />
                <span className="text-pretty">{a.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
