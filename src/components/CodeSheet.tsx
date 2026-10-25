import { encodeVoucher } from '@/lib/mesh'
import { toVoucher } from '@/lib/items'
import { fmtUsdc, shortAddress } from '@/lib/format'
import type { StoredItem } from '@/lib/store'
import { CodeShare } from './CodeShare'
import { Sheet } from './ui'

/** Re-show a held payment so another phone can pick it up and carry it to the internet. */
export function CodeSheet({ item, onClose }: { item: StoredItem | null; onClose: () => void }) {
  return (
    <Sheet open={!!item} onClose={onClose} title="Payment code">
      {item && (
        <div className="space-y-4">
          <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
            {fmtUsdc(BigInt(item.amount))} USDC to <span className="mono">{shortAddress(item.to)}</span>. Any phone that scans this can settle it once it
            finds a connection. Duplicates are caught automatically.
          </p>
          <CodeShare code={encodeVoucher(toVoucher(item))} label="Payment QR code" />
        </div>
      )}
    </Sheet>
  )
}
