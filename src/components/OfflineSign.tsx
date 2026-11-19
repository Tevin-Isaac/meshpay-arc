import { useState } from 'react'
import { getAddress, isAddress, zeroAddress, type Hex } from 'viem'
import { toast } from 'sonner'
import { AlertTriangle, MessageCircle, ShieldCheck, WifiOff } from 'lucide-react'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { fmtUsdc } from '@/lib/format'
import { groupAddress, lookalike } from '@/lib/guard'
import { VOUCHER_TTL_SECONDS } from '@/lib/mesh'
import { createSignedPayment, PaymentBlocked } from '@/lib/pay'
import { useNet } from '@/lib/net'
import { useMeshState, type StoredItem } from '@/lib/store'
import { sendChat } from '@/lib/chat/service'
import { useSpendable } from '@/hooks/useMeshData'
import { AmountInput, GhostButton, PrimaryButton } from './ui'
import { CodeShare } from './CodeShare'

interface Props {
  to: string
  amount: string
  setAmount: (v: string) => void
  /** Invoice reference to attach, when paying a request. */
  invoiceRef?: Hex
  onClose: () => void
}

/** Signs on the device with no network. You review exactly what you are signing first. */
export function OfflineSign({ to, amount, setAmount, invoiceRef, onClose }: Props) {
  const { spendable } = useSpendable()
  const { online } = useNet()
  const { contacts, items, settings } = useMeshState()
  const [tip, setTip] = useState(settings.tip === '0' ? '' : settings.tip)
  const [step, setStep] = useState<'form' | 'review' | 'signed'>('form')
  const [busy, setBusy] = useState(false)
  const [signed, setSigned] = useState<{ code: string; item: StoredItem } | null>(null)
  const [sentChat, setSentChat] = useState(false)

  const contact = isAddress(to) ? contacts.find((c) => c.address.toLowerCase() === to.toLowerCase()) : undefined
  const known = [...contacts.map((c) => c.address), ...items.filter((i) => i.source === 'signed').map((i) => i.to)]
  const similar = isAddress(to) ? lookalike(to, known) : null

  const parsed = (() => {
    try {
      return { raw: parseUsdc(amount), fee: tip ? parseUsdc(tip) : 0n }
    } catch {
      return null
    }
  })()

  const review = () => {
    if (!isAddress(to) || to.toLowerCase() === zeroAddress) return toast.error('Enter a valid recipient address.')
    if (!parsed || parsed.raw <= 0n) return toast.error('Enter a valid amount.')
    setStep('review')
  }

  const sign = async () => {
    if (!parsed) return
    setBusy(true)
    try {
      const res = await createSignedPayment(getAddress(to), parsed.raw, { spendable, fee: parsed.fee, ref: invoiceRef })
      setSigned(res)
      setStep('signed')
      if (contact) {
        // Payments to someone in your contacts travel in the encrypted chat as well as by QR.
        await sendChat(contact, { k: 'payment', a: formatUsdc(BigInt(res.item.amount)), r: invoiceRef, c: res.code }, res.item.id)
        setSentChat(true)
        toast.success(online ? 'Signed and sent in your encrypted chat.' : 'Signed. It sends in chat when you are online, or hand over the code.')
      }
    } catch (e) {
      toast.error(e instanceof PaymentBlocked ? e.message : 'Could not sign the payment.')
      setStep('form')
    } finally {
      setBusy(false)
    }
  }

  const viaChat = async () => {
    if (!signed || !contact) return
    await sendChat(contact, { k: 'payment', a: formatUsdc(BigInt(signed.item.amount)), r: invoiceRef, c: signed.code }, signed.item.id)
    setSentChat(true)
    toast.success(online ? 'Sent in your encrypted chat.' : 'Queued. It sends when you are online, or hand over the chat code.')
  }

  if (step === 'signed' && signed) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
          Signed on this phone for{' '}
          <b className="tabular-nums" style={{ color: 'var(--ink)' }}>
            {fmtUsdc(BigInt(signed.item.amount))} USDC
          </b>
          . Let the receiver scan this code. It can only ever pay the address you reviewed.
        </p>
        <CodeShare code={signed.code} label="Signed payment QR code" />
        {contact && !sentChat && (
          <GhostButton className="w-full" onClick={() => void viaChat()}>
            <MessageCircle className="size-4" /> Also send to {contact.name} in chat
          </GhostButton>
        )}
        <PrimaryButton onClick={onClose}>Done</PrimaryButton>
      </div>
    )
  }

  if (step === 'review' && parsed) {
    const total = parsed.raw + parsed.fee
    return (
      <div className="space-y-4">
        <div className="inner space-y-3 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            <ShieldCheck className="size-4" style={{ color: 'var(--success)' }} /> Check before you sign
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
              Paying {contact ? contact.name : 'address'}
            </div>
            <div className="mono mt-1 break-words text-sm font-medium" style={{ color: 'var(--ink)' }}>
              {groupAddress(getAddress(to))}
            </div>
          </div>
          <dl className="space-y-1.5 text-sm tabular-nums">
            <Row label="Amount" value={`${fmtUsdc(parsed.raw)} USDC`} />
            {parsed.fee > 0n && <Row label="Courier tip" value={`${fmtUsdc(parsed.fee)} USDC`} />}
            <Row label="Total from your reserve" value={`${fmtUsdc(total)} USDC`} strong />
            <Row label="Valid for" value={`${Math.round(VOUCHER_TTL_SECONDS / 3600)} hours`} />
          </dl>
        </div>
        {similar && (
          <div className="flex gap-2 rounded-2xl p-3 text-xs text-pretty" style={{ background: 'rgba(186,43,76,0.1)', color: 'var(--danger)' }}>
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              This address looks almost the same as one you know ({getAddress(similar).slice(0, 8)}…{similar.slice(-6)}) but is different. This is a common scam.
              Compare every character.
            </span>
          </div>
        )}
        {!contact && !similar && (
          <p className="text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
            This address is not in your contacts. A signed payment cannot be changed or called back.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <GhostButton onClick={() => setStep('form')}>Back</GhostButton>
          <PrimaryButton onClick={() => void sign()} loading={busy}>
            Sign payment
          </PrimaryButton>
        </div>
      </div>
    )
  }

  return (
    <>
      {!online && (
        <div className="inner flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs" style={{ color: 'var(--ink-2)' }}>
          <WifiOff className="size-4 shrink-0" />
          You are offline. Signing still works.
        </div>
      )}
      <AmountInput
        value={amount}
        onChange={setAmount}
        hint={spendable === null ? 'Balance unknown' : `Offline balance ${fmtUsdc(spendable)} · Max`}
        onHint={spendable !== null && spendable > 0n ? () => setAmount(formatUsdc(spendable)) : undefined}
      />
      <div className="inner flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5">
        <label htmlFor="tip" className="text-xs" style={{ color: 'var(--muted)' }}>
          Courier tip (optional)
        </label>
        <input
          id="tip"
          inputMode="decimal"
          value={tip}
          onChange={(e) => {
            const v = e.target.value.replace(/,/g, '.')
            if (v === '' || /^\d*\.?\d{0,6}$/.test(v)) setTip(v)
          }}
          placeholder="0.00"
          className="w-24 bg-transparent text-right text-sm font-semibold tabular-nums outline-none"
          style={{ color: 'var(--ink)' }}
        />
      </div>
      <PrimaryButton onClick={review} disabled={!to || !amount}>
        Review payment
      </PrimaryButton>
    </>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt style={{ color: 'var(--muted)' }}>{label}</dt>
      <dd className={strong ? 'font-bold' : 'font-medium'} style={{ color: 'var(--ink)' }}>
        {value}
      </dd>
    </div>
  )
}
