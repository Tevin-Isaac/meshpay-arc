import { useMemo, useState, type ReactNode } from 'react'
import type { StoredItem } from '@/lib/store'
import { SendSheet, type SendPrefill } from '../SendSheet'
import { ReceiveSheet } from '../ReceiveSheet'
import { ScanSheet } from '../ScanSheet'
import { AddFundsSheet } from '../AddFundsSheet'
import { BuySheet } from '../BuySheet'
import { MpesaSheet } from '../MpesaSheet'
import { LimitsSheet } from '../LimitsSheet'
import { SecuritySheet } from '../SecuritySheet'
import { AgentSheet } from '../AgentSheet'
import { CodeSheet } from '../CodeSheet'
import { SheetsContext, type SheetName, type TabName } from './useSheets'

/** Owns every bottom sheet so any tab can open one. */
export function SheetsProvider({ children, onTab }: { children: ReactNode; onTab: (tab: TabName) => void }) {
  const [sheet, setSheet] = useState<SheetName>(null)
  const [prefill, setPrefill] = useState<SendPrefill>({})
  const [codeItem, setCodeItem] = useState<StoredItem | null>(null)
  const close = () => setSheet(null)

  const api = useMemo(
    () => ({
      open: (name: Exclude<SheetName, null>, pre?: SendPrefill) => {
        setPrefill(pre ?? {})
        setSheet(name)
      },
      showCode: (item: StoredItem) => setCodeItem(item),
      goTab: onTab,
    }),
    [onTab],
  )

  return (
    <SheetsContext.Provider value={api}>
      {children}
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
      <AddFundsSheet open={sheet === 'add' || sheet === 'cashout'} onClose={close} initialTab={sheet === 'cashout' ? 'cashout' : 'add'} />
      <BuySheet open={sheet === 'buy'} onClose={close} />
      <MpesaSheet open={sheet === 'mpesa'} onClose={close} />
      <LimitsSheet open={sheet === 'limits'} onClose={close} />
      <SecuritySheet open={sheet === 'security'} onClose={close} />
      <AgentSheet open={sheet === 'agent'} onClose={close} />
      <CodeSheet item={codeItem} onClose={() => setCodeItem(null)} />
    </SheetsContext.Provider>
  )
}
