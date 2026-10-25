import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ScanLine } from 'lucide-react'
import { encodeRequest } from '@/lib/mesh'
import { shortAddress } from '@/lib/format'
import { useDevice } from '@/hooks/useMeshData'
import { AmountInput, GhostButton, Sheet } from './ui'
import { CodeShare } from './CodeShare'

export function ReceiveSheet({ open, onClose, onScan }: { open: boolean; onClose: () => void; onScan: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Receive USDC">
      <ReceiveBody onClose={onClose} onScan={onScan} />
    </Sheet>
  )
}

function ReceiveBody({ onClose, onScan }: { onClose: () => void; onScan: () => void }) {
  const device = useDevice()
  const { address: wallet } = useAccount()
  const [target, setTarget] = useState<'device' | 'wallet'>('device')
  const [amount, setAmount] = useState('')

  const address = target === 'wallet' && wallet ? wallet : device.address
  const request = encodeRequest(address, amount || undefined)

  return (
    <>
      <div className="space-y-4">
        <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
          Show this code to the payer. Then scan the signed payment they hand back. No internet needed on either phone.
        </p>

        {wallet && (
          <div className="grid grid-cols-2 gap-1 rounded-2xl p-1" style={{ background: 'var(--surface-muted)' }}>
            {(['device', 'wallet'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTarget(t)}
                className="min-h-10 rounded-xl text-xs font-semibold"
                style={{
                  background: target === t ? 'white' : 'transparent',
                  color: target === t ? 'var(--ink)' : 'var(--muted)',
                  boxShadow: target === t ? '0 1px 3px rgba(18,45,69,0.12)' : 'none',
                }}
              >
                {t === 'device' ? 'This device' : 'My wallet'}
              </button>
            ))}
          </div>
        )}

        <CodeShare code={request} label="Payment request QR code" />
        <p className="mono text-center text-xs" style={{ color: 'var(--subtle)' }}>
          {shortAddress(address)}
        </p>

        <AmountInput value={amount} onChange={setAmount} hint="Optional amount to request" />

        <GhostButton
          className="w-full"
          onClick={() => {
            onClose()
            onScan()
          }}
        >
          <ScanLine className="size-4" />
          Scan a signed payment
        </GhostButton>
      </div>
    </>
  )
}
