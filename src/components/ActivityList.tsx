import { roleOf } from '@/lib/items'
import type { StoredItem } from '@/lib/store'
import { useMyAddresses } from '@/hooks/useMeshData'
import { ItemRow } from './ItemRow'

export function ActivityList({ items }: { items: StoredItem[] }) {
  const mine = useMyAddresses()
  const done = items.filter((i) => i.status !== 'pending')

  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="display text-lg font-bold">Activity</h2>
      {done.length === 0 ? (
        <p className="mt-2 text-sm text-pretty" style={{ color: 'var(--muted)' }}>
          Settled payments show up here. Sign or receive your first payment to see how it moves.
        </p>
      ) : (
        <ul className="mt-1 divide-y" style={{ borderColor: 'var(--border)' }}>
          {done.map((item) => (
            <ItemRow key={item.id} item={item} role={roleOf(item, mine)} />
          ))}
        </ul>
      )}
    </section>
  )
}
