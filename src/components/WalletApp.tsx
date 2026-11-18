import { useEffect, useState } from 'react'
import { useMeshState, type StoredItem } from '@/lib/store'
import { Header } from './Header'
import { BalanceCard } from './BalanceCard'
import { GetStarted } from './GetStarted'
import { SettleCard } from './SettleCard'
import { ActivityList } from './ActivityList'
import { SendSheet, type SendPrefill } from './SendSheet'
import { ReceiveSheet } from './ReceiveSheet'
import { ScanSheet } from './ScanSheet'
import { AddFundsSheet } from './AddFundsSheet'
import { LimitsSheet } from './LimitsSheet'
import { CodeSheet } from './CodeSheet'
import { BuySheet } from './BuySheet'
import { useOnrampAvailable } from '@/hooks/useMeshData'

type SheetName = 'send' | 'receive' | 'scan' | 'add' | 'limits' | 'buy' | null

/** The live wallet. Every number in here is read from the device or from Arc. */
export function WalletApp() {
  const { items } = useMeshState()
  const canBuy = useOnrampAvailable()
  const [sheet, setSheet] = useState<SheetName>(null)
  const [prefill, setPrefill] = useState<SendPrefill>({})
  const [codeItem, setCodeItem] = useState<StoredItem | null>(null)
  const close = () => setSheet(null)
  const openSend = () => {
    setPrefill({})
    setSheet('send')
  }

  // Keep the app usable with no connection.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // offline shell is a bonus; the app still works online
      })
    }
  }, [])

  return (
    <div className="space-y-3">
      <Header />
      <BalanceCard
        onSend={openSend}
        onReceive={() => setSheet('receive')}
        onScan={() => setSheet('scan')}
        onAdd={() => setSheet('add')}
        onLimits={() => setSheet('limits')}
        onBuy={() => setSheet('buy')}
        canBuy={canBuy}
      />
      <GetStarted onAdd={() => setSheet('add')} onSend={openSend} />
      <SettleCard items={items} onShowCode={setCodeItem} />
      <ActivityList items={items} />

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
      <BuySheet open={sheet === 'buy'} onClose={close} />
      <LimitsSheet open={sheet === 'limits'} onClose={close} />
      <CodeSheet item={codeItem} onClose={() => setCodeItem(null)} />
    </div>
  )
}
