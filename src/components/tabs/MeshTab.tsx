import { Bluetooth, Boxes, Radio } from 'lucide-react'
import { useNet } from '@/lib/net'
import { useRelayStatus } from '@/lib/chat/relay'
import { useMeshState } from '@/lib/store'
import { SettleCard } from '../SettleCard'
import { useSheets } from '../shell/useSheets'

export function MeshTab() {
  const { items, carried, settings } = useMeshState()
  const { online } = useNet()
  const relays = useRelayStatus()
  const sheets = useSheets()
  const heldPayments = items.filter((i) => i.status === 'pending').length
  const heldMessages = carried.filter((c) => !c.published).length

  return (
    <div className="space-y-3">
      <section className="glass rounded-3xl p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl" style={{ background: 'var(--tint-accent)', color: 'var(--accent)' }}>
            <Radio className="size-6" />
          </div>
          <div>
            <h2 className="display text-xl font-bold">Mesh</h2>
            <p className="text-xs" style={{ color: online ? 'var(--success)' : 'var(--warn)' }}>
              {online ? 'Online · this phone can settle and deliver for others' : 'Offline · carrying what it holds'}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Payments held', value: heldPayments },
            { label: 'Messages carried', value: heldMessages },
            { label: 'Relays live', value: `${relays.connected}/${settings.relays.length}` },
          ].map((s) => (
            <div key={s.label} className="inner rounded-2xl px-2 py-3">
              <div className="display text-2xl font-bold tabular-nums">{s.value}</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--subtle)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
          Any phone can be a courier. Scan someone else's signed payment or sealed message and this phone will deliver it the moment it has a
          connection. Couriers can earn the tip the payer added.
        </p>
        <button
          onClick={() => sheets.open('scan')}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          <Boxes className="size-4" /> Pick up a payment or message
        </button>
      </section>

      <SettleCard items={items} onShowCode={sheets.showCode} />

      <section className="glass rounded-3xl p-5">
        <h3 className="text-sm font-semibold">Relays</h3>
        <ul className="mt-2 space-y-1.5">
          {settings.relays.map((r) => (
            <li key={r} className="mono flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <span className="size-1.5 rounded-full" style={{ background: online && relays.connected > 0 ? 'var(--success)' : 'var(--subtle)' }} />
              {r.replace('wss://', '')}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
          Relays only carry sealed, encrypted messages. They cannot read them or see who wrote them.
        </p>
      </section>

      <section className="glass flex items-start gap-3 rounded-3xl p-5">
        <Bluetooth className="mt-0.5 size-5 shrink-0" style={{ color: 'var(--subtle)' }} />
        <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
          Bluetooth hand-off lives in the WayaMesh Android app. This web wallet hands over by QR code, copy or your phone's share sheet, and the
          same payments and messages work in both.
        </p>
      </section>
    </div>
  )
}
