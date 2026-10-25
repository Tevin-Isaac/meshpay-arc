import { useState } from 'react'
import { getAddress, isAddress } from 'viem'
import { toast } from 'sonner'
import { WifiOff } from 'lucide-react'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { fmtUsdc, shortAddress } from '@/lib/format'
import { createSignedPayment, PaymentBlocked } from '@/lib/pay'
import { useNet } from '@/lib/net'
import type { StoredItem } from '@/lib/store'
import { useSpendable } from '@/hooks/useMeshData'
import { AmountInput, PrimaryButton, Sheet } from './ui'
import { CodeShare } from './CodeShare'

export interface SendPrefill {
  to?: string
  amount?: string
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
  const { spendable } = useSpendable()
  const { online } = useNet()
  const [to, setTo] = useState(prefill.to ?? '')
  const [amount, setAmount] = useState(prefill.amount ?? '')
  const [busy, setBusy] = useState(false)
  const [signed, setSigned] = useState<{ code: string; item: StoredItem } | null>(null)

  const sign = async () => {
    if (!isAddress(to)) return toast.error('Enter a valid recipient address.')
    let raw: bigint
    try {
      raw = parseUsdc(amount)
    } catch {
      return toast.error('Enter a valid amount.')
    }
    setBusy(true)
    try {
      setSigned(await createSignedPayment(getAddress(to), raw, { spendable: spendable }))
    } catch (e) {
      toast.error(e instanceof PaymentBlocked ? e.message : 'Could not sign the payment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {signed ? (
        <div className="space-y-4">
          <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
            Signed on this phone for{' '}
            <b className="tabular-nums" style={{ color: 'var(--ink)' }}>
              {fmtUsdc(BigInt(signed.item.amount))} USDC
            </b>{' '}
            to <span className="mono">{shortAddress(signed.item.to)}</span>. Let the receiver scan this code. It can only ever pay that address.
          </p>
          <CodeShare code={signed.code} label="Signed payment QR code" />
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        </div>
      ) : (
        <div className="space-y-4">
          {!online && (
            <div className="inner flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs" style={{ color: 'var(--ink-2)' }}>
              <WifiOff className="size-4 shrink-0" />
              You are offline. Signing still works.
            </div>
          )}
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
          </div>
          <AmountInput
            value={amount}
            onChange={setAmount}
            hint={spendable === null ? 'Balance unknown' : `Offline balance ${fmtUsdc(spendable)} · Max`}
            onHint={
              spendable !== null && spendable > 0n
                ? () => setAmount(formatUsdc(spendable))
                : undefined
            }
          />
          <PrimaryButton onClick={() => void sign()} loading={busy} disabled={!to || !amount}>
            Sign payment
          </PrimaryButton>
        </div>
      )}
    </>
  )
}
