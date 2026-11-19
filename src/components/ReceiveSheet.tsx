import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ScanLine } from 'lucide-react'
import { encodeRequest, randomRef } from '@/lib/mesh'
import { shortAddress } from '@/lib/format'
import { addInvoice, useMeshState } from '@/lib/store'
import { encodeCard } from '@/lib/chat/crypto'
import { myPubkey } from '@/lib/chat/service'
import { useDevice } from '@/hooks/useMeshData'
import { AmountInput, GhostButton, PrimaryButton, Sheet } from './ui'
import { CodeShare } from './CodeShare'

export function ReceiveSheet({ open, onClose, onScan }: { open: boolean; onClose: () => void; onScan: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Receive">
      <ReceiveBody onClose={onClose} onScan={onScan} />
    </Sheet>
  )
}

function ReceiveBody({ onClose, onScan }: { onClose: () => void; onScan: () => void }) {
  const device = useDevice()
  const { address: wallet } = useAccount()
  const { invoices } = useMeshState()
  const [tab, setTab] = useState<'pay' | 'card'>('pay')
  const [target, setTarget] = useState<'device' | 'wallet'>('device')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [made, setMade] = useState<string | null>(null)

  const address = target === 'wallet' && wallet ? wallet : device.address

  const createInvoice = () => {
    const ref = randomRef()
    addInvoice({ ref, amount: amount || undefined, note: note || undefined, createdAt: Date.now(), status: 'open' })
    setMade(encodeRequest({ address, amount: amount || undefined, note: note || undefined, ref }))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl p-1" style={{ background: 'var(--surface-muted)' }}>
        {(['pay', 'card'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="min-h-10 rounded-xl text-xs font-semibold"
            style={{
              background: tab === t ? 'var(--surface-strong)' : 'transparent',
              color: tab === t ? 'var(--ink)' : 'var(--muted)',
              boxShadow: tab === t ? 'var(--seg-shadow)' : 'none',
            }}
          >
            {t === 'pay' ? 'Get paid' : 'My contact card'}
          </button>
        ))}
      </div>

      {tab === 'card' ? (
        <>
          <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
            Share this once with someone you trust. It lets them send you end-to-end encrypted messages and payments, online or off.
          </p>
          <CodeShare code={encodeCard({ address: device.address, pubkey: myPubkey(), name: '' })} label="Contact card QR code" />
          <p className="mono text-center text-xs" style={{ color: 'var(--subtle)' }}>
            {shortAddress(device.address)}
          </p>
        </>
      ) : made ? (
        <>
          <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
            Show this to the payer. When they pay with it, the payment is tagged to this request so you can see it was paid.
          </p>
          <CodeShare code={made} label="Payment request QR code" />
          <p className="mono text-center text-xs" style={{ color: 'var(--subtle)' }}>
            {shortAddress(address)}
            {amount ? ` · ${amount} USDC` : ''}
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
            Ask for a payment. If the payer is online they pay instantly. If not, they sign offline and you scan what they hand back.
          </p>
          {wallet && (
            <div className="grid grid-cols-2 gap-1 rounded-2xl p-1" style={{ background: 'var(--surface-muted)' }}>
              {(['device', 'wallet'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTarget(t)}
                  className="min-h-10 rounded-xl text-xs font-semibold"
                  style={{
                    background: target === t ? 'var(--surface-strong)' : 'transparent',
                    color: target === t ? 'var(--ink)' : 'var(--muted)',
                    boxShadow: target === t ? 'var(--seg-shadow)' : 'none',
                  }}
                >
                  {t === 'device' ? 'This device' : 'My wallet'}
                </button>
              ))}
            </div>
          )}
          <AmountInput value={amount} onChange={setAmount} hint="Optional amount" />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 80))}
            placeholder="What is it for? (optional)"
            aria-label="Note"
            className="inner min-h-12 w-full rounded-2xl px-4 text-sm outline-none"
          />
          <PrimaryButton onClick={createInvoice}>Show request code</PrimaryButton>
          {invoices.length > 0 && (
            <ul className="space-y-1.5 text-xs" style={{ color: 'var(--muted)' }}>
              {invoices.slice(0, 4).map((i) => (
                <li key={i.ref} className="flex justify-between gap-3">
                  <span className="truncate">{i.note || 'Request'}{i.amount ? ` · ${i.amount} USDC` : ''}</span>
                  <span className="font-semibold" style={{ color: i.status === 'open' ? 'var(--subtle)' : 'var(--success)' }}>
                    {i.status === 'open' ? 'Open' : i.status === 'received' ? 'Paid, settling' : 'Settled'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <GhostButton
        className="w-full"
        onClick={() => {
          onClose()
          onScan()
        }}
      >
        <ScanLine className="size-4" />
        Scan a code
      </GhostButton>
    </div>
  )
}
