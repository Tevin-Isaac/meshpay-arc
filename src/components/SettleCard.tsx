import { toast } from 'sonner'
import { FAUCET_URL, NETWORK_LABEL, USDC_NAME } from '@/lib/network'
import { useDevice } from '@/hooks/useMeshData'
import { CloudUpload, WifiOff } from 'lucide-react'
import { fmtExact } from '@/lib/format'
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
  const device = useDevice()
  const pending = items.filter((i) => i.status === 'pending')
  if (pending.length === 0) return null

  const total = pending.reduce((sum, i) => sum + BigInt(i.amount), 0n)

  const run = async () => {
    try {
      const result = await settle(pending)
      if (result.settled > 0) {
        toast.success(`Settled ${result.settled} payment${result.settled === 1 ? '' : 's'} on Arc.`)
        if (result.tips > 0n) toast.success(`You earned ${fmtExact(result.tips)} USDC in courier tips.`)
      }
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
            {pending.length} payment{pending.length === 1 ? '' : 's'} · {fmtExact(total)} USDC held on this phone
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
          <div className="space-y-2">
            <p className="text-center text-xs text-pretty" style={{ color: 'var(--muted)' }}>
              Get a little {USDC_NAME} to pay the network fee, then settle. Arc charges its small fee in USDC.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <PrimaryButton
                onClick={() => void navigator.clipboard.writeText(device.address).then(() => toast.success('Address copied. Paste it at the faucet.'), () => toast.error('Could not copy.'))}
              >
                Copy my address
              </PrimaryButton>
              {FAUCET_URL && (
              <a
                href={FAUCET_URL}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 items-center justify-center rounded-2xl text-sm font-semibold"
                style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }}
              >
                Open faucet
              </a>
              )}
            </div>
            <p className="text-center text-[11px]" style={{ color: 'var(--subtle)' }}>
              {FAUCET_URL ? `Choose ${NETWORK_LABEL} at the faucet. ` : ''}You can also connect an external wallet in Settings to pay the fee.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
