import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Copy, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
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
  const { invoices, settings } = useMeshState()
  const [target, setTarget] = useState<'device' | 'wallet'>('device')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [made, setMade] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)

  const address = target === 'wallet' && wallet ? wallet : device.address

  const createInvoice = () => {
    const ref = randomRef()
    addInvoice({ ref, amount: amount || undefined, note: note || undefined, createdAt: Date.now(), status: 'open' })
    setMade(encodeRequest({ address, amount: amount || undefined, note: note || undefined, ref }))
  }

  return (
    <div className="space-y-4">
      {made ? (
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
      ) : !requesting ? (
        <>
          <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
            Share your address or let someone scan this code. They can pay you right away, and they can add you as a contact to message you.
          </p>
          <CodeShare code={encodeCard({ address: device.address, pubkey: myPubkey(), name: settings.displayName })} label="Your address and contact card QR code" />
          <div className="inner rounded-2xl px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
              Your address
            </div>
            <p className="mono mt-1 break-all text-xs" data-testid="my-address">{address}</p>
            <GhostButton
              className="mt-2 w-full"
              onClick={() => void navigator.clipboard.writeText(address).then(() => toast.success('Address copied.'), () => toast.error('Could not copy.'))}
            >
              <Copy className="size-4" /> Copy address
            </GhostButton>
          </div>
          <GhostButton className="w-full" onClick={() => setRequesting(true)}>
            Request a specific amount
          </GhostButton>
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
