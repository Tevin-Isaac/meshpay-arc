import { useRef, useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { toast } from 'sonner'
import { fmtUsdc, shortAddress } from '@/lib/format'
import { scan } from '@/lib/scan'
import { GhostButton, Sheet } from './ui'
import { QrScanner } from './QrScanner'
import type { SendPrefill } from './SendSheet'

export function ScanSheet({
  open,
  onClose,
  onRequest,
}: {
  open: boolean
  onClose: () => void
  onRequest: (prefill: SendPrefill) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Scan a code">
      <ScanBody onClose={onClose} onRequest={onRequest} />
    </Sheet>
  )
}

function ScanBody({ onClose, onRequest }: { onClose: () => void; onRequest: (prefill: SendPrefill) => void }) {
  const [text, setText] = useState('')
  const handling = useRef(false)

  const handle = async (value: string) => {
    if (handling.current) return
    handling.current = true
    try {
      const result = await scan(value)
      if (result.kind === 'request') {
        onClose()
        const r = result.request
        onRequest({ to: r.address, amount: r.amount, ref: r.ref, note: r.note })
        return
      }
      if (result.kind === 'contact') {
        toast.success(`${result.card.name || shortAddress(result.card.address)} added. Open Chat to message them.`)
      } else if (result.kind === 'message') {
        if (result.result === 'delivered') toast.success('Message received. Open Chat to read it.')
        else if (result.result === 'carried') toast.success('Carrying this message for someone else. It is delivered when you get a connection.')
        else toast.info('You already have this message.')
      } else {
        const amount = fmtUsdc(BigInt(result.item.amount))
        if (!result.added) toast.info('You already hold this payment.')
        else if (result.item.risky) toast.warning(`Saved ${amount} USDC, but it is above your offline limit. Wait for it to settle before handing anything over.`)
        else toast.success(`Saved ${amount} USDC from ${shortAddress(result.item.from)}. It settles when any phone gets online.`)
      }
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read that code.')
      handling.current = false
    }
  }

  return (
    <>
      <div className="space-y-4">
        <QrScanner onResult={(v) => void handle(v)} />
        <p className="text-center text-xs text-pretty" style={{ color: 'var(--muted)' }}>
          Scan a payment request, a signed payment, a contact card or an offline message. Checked on this phone, no internet needed.
        </p>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Or paste a code"
            spellCheck={false}
            aria-label="Paste a code"
            className="inner mono min-h-11 min-w-0 flex-1 rounded-2xl px-3 text-xs outline-none"
          />
          <GhostButton onClick={() => void handle(text)} disabled={!text.trim()} aria-label="Use pasted code">
            <ClipboardPaste className="size-4" />
          </GhostButton>
        </div>
      </div>
    </>
  )
}
