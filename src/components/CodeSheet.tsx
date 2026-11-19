import { encodeVoucher } from '@/lib/mesh'
import { toVoucher } from '@/lib/items'
import { fmtExact, shortAddress } from '@/lib/format'
import type { StoredItem } from '@/lib/store'
import { CodeShare } from './CodeShare'
import { Sheet } from './ui'

export interface RawCode {
  title: string
  hint: string
  code: string
}

/** Re-show a held payment, or a sealed message, so another phone can pick it up and carry it to the internet. */
export function CodeSheet({ item, raw, onClose }: { item: StoredItem | null; raw?: RawCode | null; onClose: () => void }) {
  return (
    <Sheet open={!!item || !!raw} onClose={onClose} title={raw?.title ?? 'Payment code'}>
      {raw ? (
        <div className="space-y-4">
          <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
            {raw.hint}
          </p>
          <CodeShare code={raw.code} label="Message QR code" />
        </div>
      ) : (
        item && (
          <div className="space-y-4">
            <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
              {fmtExact(BigInt(item.amount))} USDC to <span className="mono">{shortAddress(item.to)}</span>. Any phone that scans this can settle it once it
              finds a connection. Duplicates are caught automatically.
            </p>
            <CodeShare code={encodeVoucher(toVoucher(item))} label="Payment QR code" />
          </div>
        )
      )}
    </Sheet>
  )
}
