import { useState } from 'react'
import type { Hex } from 'viem'
import { useNet } from '@/lib/net'
import { useMeshState } from '@/lib/store'
import { useDeviceUsdc, useSpendable } from '@/hooks/useMeshData'
import { GAS_BUFFER } from '@/lib/balance'
import { Sheet } from './ui'
import { PayNowForm } from './PayNowForm'
import { OfflineSign } from './OfflineSign'

export interface SendPrefill {
  to?: string
  amount?: string
  /** Invoice reference from a payment request. */
  ref?: Hex
  note?: string
}

export function SendSheet({ open, onClose, prefill }: { open: boolean; onClose: () => void; prefill: SendPrefill }) {
  // The sheet body only mounts while open, so its state starts fresh every time.
  return (
    <Sheet open={open} onClose={onClose} title="Send USDC">
      <SendBody onClose={onClose} prefill={prefill} />
    </Sheet>
  )
}

function SendBody({ onClose, prefill }: { onClose: () => void; prefill: SendPrefill }) {
  const { online } = useNet()
  const wallet = useDeviceUsdc()
  const { spendable } = useSpendable()
  const { contacts } = useMeshState()
  const [picked, setPicked] = useState<'pay' | 'offline' | null>(null)
  // Online with USDC in the built-in wallet: pay now. Otherwise sign offline from the reserve.
  const mode = picked ?? (online && wallet.raw > GAS_BUFFER ? 'pay' : online && !(spendable && spendable > 0n) ? 'pay' : 'offline')
  const [to, setTo] = useState(prefill.to ?? '')
  const [amount, setAmount] = useState(prefill.amount ?? '')

  return (
    <div className="space-y-4">
      {prefill.note && (
        <div className="inner rounded-2xl px-4 py-2.5 text-xs text-pretty" style={{ color: 'var(--ink-2)' }}>
          Request: {prefill.note}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1 rounded-2xl p-1" style={{ background: 'var(--surface-muted)' }}>
        {(['pay', 'offline'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setPicked(m)}
            className="min-h-10 rounded-xl text-xs font-semibold"
            style={{
              background: mode === m ? 'var(--surface-strong)' : 'transparent',
              color: mode === m ? 'var(--ink)' : 'var(--muted)',
              boxShadow: mode === m ? 'var(--seg-shadow)' : 'none',
            }}
          >
            {m === 'pay' ? 'Pay now (online)' : 'Sign offline'}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="to" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
          Recipient
        </label>
        <input
          id="to"
          value={to}
          onChange={(e) => setTo(e.target.value.trim())}
          placeholder="0x… or scan their request"
          spellCheck={false}
          autoCapitalize="off"
          className="inner mono min-h-12 w-full rounded-2xl px-4 text-sm outline-none"
          style={{ color: 'var(--ink)' }}
        />
        {contacts.filter((c) => !c.request).length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {contacts
              .filter((c) => !c.request)
              .map((c) => (
                <button
                  key={c.address}
                  onClick={() => setTo(c.address)}
                  className="inner min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold"
                  style={{ color: 'var(--ink)' }}
                >
                  {c.name}
                </button>
              ))}
          </div>
        )}
      </div>

      {mode === 'pay' ? (
        <PayNowForm to={to} amount={amount} setAmount={setAmount} onClose={onClose} />
      ) : (
        <OfflineSign to={to} amount={amount} setAmount={setAmount} invoiceRef={prefill.ref} onClose={onClose} />
      )}
    </div>
  )
}
