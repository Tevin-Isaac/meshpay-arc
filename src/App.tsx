import { useEffect, useState } from 'react'
import { useMeshState, type StoredItem } from '@/lib/store'
import { Header } from '@/components/Header'
import { BalanceCard } from '@/components/BalanceCard'
import { SettleCard } from '@/components/SettleCard'
import { ActivityList } from '@/components/ActivityList'
import { HowItWorks } from '@/components/HowItWorks'
import { SendSheet, type SendPrefill } from '@/components/SendSheet'
import { ReceiveSheet } from '@/components/ReceiveSheet'
import { ScanSheet } from '@/components/ScanSheet'
import { AddFundsSheet } from '@/components/AddFundsSheet'
import { LimitsSheet } from '@/components/LimitsSheet'
import { CodeSheet } from '@/components/CodeSheet'

type SheetName = 'send' | 'receive' | 'scan' | 'add' | 'limits' | null

export default function App() {
  const { items } = useMeshState()
  const [sheet, setSheet] = useState<SheetName>(null)
  const [prefill, setPrefill] = useState<SendPrefill>({})
  const [codeItem, setCodeItem] = useState<StoredItem | null>(null)
  const close = () => setSheet(null)

  // Keep the app usable with no connection.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // offline shell is a bonus; the app still works online
      })
    }
  }, [])

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md space-y-4 px-4 pb-24 pt-[max(env(safe-area-inset-top),12px)]">
      <Header />

      <BalanceCard
        onSend={() => {
          setPrefill({})
          setSheet('send')
        }}
        onReceive={() => setSheet('receive')}
        onScan={() => setSheet('scan')}
        onAdd={() => setSheet('add')}
        onLimits={() => setSheet('limits')}
      />

      <SettleCard items={items} onShowCode={setCodeItem} />
      <ActivityList items={items} />
      <HowItWorks />

      <SendSheet open={sheet === 'send'} onClose={close} prefill={prefill} />
      <ReceiveSheet open={sheet === 'receive'} onClose={close} onScan={() => setSheet('scan')} />
      <ScanSheet
        open={sheet === 'scan'}
        onClose={close}
        onRequest={(p) => {
          setPrefill(p)
          setSheet('send')
        }}
      />
      <AddFundsSheet open={sheet === 'add'} onClose={close} />
      <LimitsSheet open={sheet === 'limits'} onClose={close} />
      <CodeSheet item={codeItem} onClose={() => setCodeItem(null)} />
    </div>
  )
}
