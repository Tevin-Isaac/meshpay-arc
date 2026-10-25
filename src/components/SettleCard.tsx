import { ConnectKitButton } from 'connectkit'
import { toast } from 'sonner'
import { CloudUpload, WifiOff } from 'lucide-react'
import { fmtUsdc } from '@/lib/format'
import { parseOnchainError } from '@/lib/errors'
import { roleOf } from '@/lib/items'
import { useNet } from '@/lib/net'
import type { StoredItem } from '@/lib/store'
import { useChecks, useMyAddresses } from '@/hooks/useMeshData'
import { useSettle } from '@/hooks/useSettle'
import { ItemRow } from './ItemRow'
import { PrimaryButton } from './ui'

export function SettleCard({ items, onShowCode }: { items: StoredItem[]; onShowCode: (item: StoredItem) => void }) {
  const { online } = useNet()
  const mine = useMyAddresses()
  const checks = useChecks(items)
  const { settle, busy, via } = useSettle()
  const pending = items.filter((i) => i.status === 'pending')
  if (pending.length === 0) return null

  const total = pending.reduce((sum, i) => sum + BigInt(i.amount), 0n)

  const run = async () => {
    try {
      const result = await settle(pending)
      if (result.settled > 0) toast.success(`Settled ${result.settled} payment${result.settled === 1 ? '' : 's'} on Arc.`)
      else toast.info('Nothing to settle right now. See each payment for why.')
    } catch (e) {
      const msg = parseOnchainError(e)
      if (msg) toast.error(msg)
    }
  }

  return (
    <section className="glass rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="display text-lg font-bold">Waiting to settle</h2>
          <p className="mt-0.5 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
            {pending.length} payment{pending.length === 1 ? '' : 's'} · {fmtUsdc(total)} USDC held on this phone
          </p>
        </div>
        {!online && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--warn)' }}>
            <WifiOff className="size-3.5" /> Offline
          </span>
        )}
      </div>

      <ul className="mt-2 divide-y" style={{ borderColor: 'var(--border)' }}>
        {pending.map((item) => (
          <ItemRow key={item.id} item={item} role={roleOf(item, mine)} check={checks[item.id]} onShowCode={() => onShowCode(item)} />
        ))}
      </ul>

      <div className="mt-3">
        {!online ? (
          <p className="text-center text-xs text-pretty" style={{ color: 'var(--muted)' }}>
            Safe on this phone. Settle as soon as you or any phone you hand them to gets a connection.
          </p>
        ) : via ? (
          <PrimaryButton onClick={() => void run()} loading={busy}>
            <CloudUpload className="size-4" />
            {busy ? 'Settling on Arc…' : `Settle ${pending.length} on Arc`}
          </PrimaryButton>
        ) : (
          <ConnectKitButton.Custom>
            {({ show }) => <PrimaryButton onClick={show}>Connect wallet to settle</PrimaryButton>}
          </ConnectKitButton.Custom>
        )}
      </div>
    </section>
  )
}
