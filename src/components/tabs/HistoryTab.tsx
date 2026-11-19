import { useState } from 'react'
import { roleOf } from '@/lib/items'
import { useMeshState } from '@/lib/store'
import { useChecks, useMyAddresses } from '@/hooks/useMeshData'
import { ItemRow } from '../ItemRow'
import { SaveContactSheet } from '../ContactActions'
import { useSheets } from '../shell/useSheets'

type Filter = 'all' | 'sent' | 'received' | 'pending'

export function HistoryTab() {
  const { items } = useMeshState()
  const mine = useMyAddresses()
  const sheets = useSheets()
  const [saving, setSaving] = useState<string | null>(null)
  const checks = useChecks(items)
  const [filter, setFilter] = useState<Filter>('all')

  const shown = items.filter((i) => {
    const role = roleOf(i, mine)
    if (filter === 'sent') return role === 'out'
    if (filter === 'received') return role === 'in'
    if (filter === 'pending') return i.status === 'pending'
    return true
  })

  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="display text-xl font-bold">History</h2>
      <div className="mt-3 grid grid-cols-4 gap-1.5" role="tablist" aria-label="Filter payments">
        {(['all', 'sent', 'received', 'pending'] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className="min-h-10 rounded-xl text-xs font-semibold capitalize"
            style={{
              background: filter === f ? 'var(--accent)' : 'var(--surface-muted)',
              color: filter === f ? 'var(--on-accent)' : 'var(--ink)',
              border: '1px solid var(--border)',
            }}
          >
            {f}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-pretty" style={{ color: 'var(--muted)' }}>
          {items.length === 0 ? 'No payments yet. They will appear here, online or offline.' : 'Nothing matches this filter.'}
        </p>
      ) : (
        <ul className="mt-2 divide-y" style={{ borderColor: 'var(--border)' }}>
          {shown.map((i) => (
            <ItemRow key={i.id} item={i} role={roleOf(i, mine)} check={checks[i.id]} onShowCode={() => sheets.showCode(i)} onSave={setSaving} />
          ))}
        </ul>
      )}
      <SaveContactSheet address={saving} onClose={() => setSaving(null)} />
    </section>
  )
}
