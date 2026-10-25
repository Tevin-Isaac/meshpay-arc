import { Check, Copy, Share2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { GhostButton } from './ui'
import { QrCode } from './QrCode'

/** QR plus copy/share, so a payment code can also travel by AirDrop, Nearby Share or chat. */
export function CodeShare({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy. Select the code and copy it manually.')
    }
  }

  const share = async () => {
    try {
      await navigator.share({ text: code })
    } catch {
      // dismissed
    }
  }

  return (
    <div className="space-y-3">
      <QrCode value={code} label={label} />
      <div className={`grid gap-2 ${canShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <GhostButton onClick={() => void copy()}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Copy code'}
        </GhostButton>
        {canShare && (
          <GhostButton onClick={() => void share()}>
            <Share2 className="size-4" />
            Share
          </GhostButton>
        )}
      </div>
    </div>
  )
}
