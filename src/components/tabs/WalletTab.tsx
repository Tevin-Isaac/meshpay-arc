import { useRampConfig } from '@/lib/ramp'
import { ChevronRight } from 'lucide-react'
import { roleOf } from '@/lib/items'
import { useMeshState } from '@/lib/store'
import { useMyAddresses, useOnrampAvailable } from '@/hooks/useMeshData'
import { BalanceCard } from '../BalanceCard'
import { GetStarted } from '../GetStarted'
import { SettleCard } from '../SettleCard'
import { ItemRow } from '../ItemRow'
import { useSheets } from '../shell/useSheets'

export function WalletTab() {
  const { items } = useMeshState()
  const sheets = useSheets()
  const mine = useMyAddresses()
  const canBuy = useOnrampAvailable()
  const ramp = useRampConfig()
  const recent = items.filter((i) => i.status !== 'pending').slice(0, 3)

  return (
    <div className="space-y-3">
      <BalanceCard
        onSend={() => sheets.open('send')}
        onReceive={() => sheets.open('receive')}
        onScan={() => sheets.open('scan')}
        onAdd={() => sheets.open('add')}
        onLimits={() => sheets.open('limits')}
        onSecurity={() => sheets.open('security')}
        onBuy={() => sheets.open('buy')}
        canBuy={canBuy}
        onMpesa={ramp ? () => sheets.open('mpesa') : undefined}
      />
      <GetStarted onAdd={() => sheets.open('add')} onSend={() => sheets.open('send')} />
      <SettleCard items={items} onShowCode={sheets.showCode} />
      <section className="glass rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="display text-lg font-bold">Recent</h2>
          <button onClick={() => sheets.goTab('history')} className="flex min-h-11 items-center gap-0.5 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
            See all <ChevronRight className="size-4" />
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
            Settled payments show up here. Sign or receive your first payment to see how it moves.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {recent.map((i) => (
              <ItemRow key={i.id} item={i} role={roleOf(i, mine)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
