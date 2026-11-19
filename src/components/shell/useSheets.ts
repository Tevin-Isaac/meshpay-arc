import { createContext, useContext } from 'react'
import type { StoredItem } from '@/lib/store'
import type { SendPrefill } from '../SendSheet'

export type SheetName = 'send' | 'receive' | 'scan' | 'add' | 'cashout' | 'buy' | 'mpesa' | 'limits' | 'security' | 'agent' | 'about' | null

export type TabName = 'wallet' | 'chats' | 'history' | 'mesh' | 'settings'

export interface SheetsApi {
  open: (name: Exclude<SheetName, null>, prefill?: SendPrefill) => void
  showCode: (item: StoredItem) => void
  goTab: (tab: TabName) => void
}

export const SheetsContext = createContext<SheetsApi | null>(null)

export function useSheets(): SheetsApi {
  const ctx = useContext(SheetsContext)
  if (!ctx) throw new Error('useSheets must be used inside the app shell')
  return ctx
}
