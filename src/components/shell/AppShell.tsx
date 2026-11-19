import { BASE_URL, SW_SCOPE, SW_URL } from '@/lib/env'
import { useCallback, useEffect, useState } from 'react'
import { Clock, MessagesSquare, Radio, Settings, Wallet } from 'lucide-react'
import { useAccount } from 'wagmi'
import { setConnectedWallet } from '@/lib/mine'
import { onStorageFailure, useMeshState } from '@/lib/store'
import { toast } from 'sonner'
import { ErrorBoundary } from '../ErrorBoundary'
import { useChatEngine, usePurgeEngine, useStandingRunner } from '@/hooks/useEngines'
import { Header } from '../Header'
import { WalletTab } from '../tabs/WalletTab'
import { ChatsTab } from '../tabs/ChatsTab'
import { HistoryTab } from '../tabs/HistoryTab'
import { MeshTab } from '../tabs/MeshTab'
import { SettingsTab } from '../tabs/SettingsTab'
import { SheetsProvider } from './SheetsProvider'
import type { TabName } from './useSheets'

const TABS: { id: TabName; label: string; icon: typeof Wallet }[] = [
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'chats', label: 'Chats', icon: MessagesSquare },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'mesh', label: 'Mesh', icon: Radio },
  { id: 'settings', label: 'Settings', icon: Settings },
]

/** Five tabs, one bottom bar. Background engines (chat relays, autopilot) run while the wallet is open. */
export function AppShell() {
  const { status, contacts } = useMeshState()
  const [tab, setTab] = useState<TabName>('wallet')
  const goTab = useCallback((t: TabName) => setTab(t), [])
  const ready = status === 'unlocked' || status === 'plain'
  useChatEngine(ready)
  usePurgeEngine(ready)
  useStandingRunner(ready)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${SW_URL}?base=${encodeURIComponent(BASE_URL)}`, { scope: SW_SCOPE }).catch(() => {
        // the offline shell is a bonus; the app still works online
      })
    }
  }, [])

  const { address: connected } = useAccount()
  useEffect(() => {
    setConnectedWallet(connected)
  }, [connected])
  useEffect(
    () =>
      onStorageFailure(() => {
        toast.error('This device could not save your latest changes (storage may be full). Make a backup now.', { duration: 12000 })
      }),
    [],
  )

  const requests = contacts.filter((c) => c.request).length

  return (
    <SheetsProvider onTab={goTab}>
      <div className="page-glow relative isolate min-h-dvh">
        <main className="mx-auto w-full max-w-md space-y-3 px-4 pb-48 pt-[max(env(safe-area-inset-top),16px)]">
          <Header />
          <ErrorBoundary key={tab} area="This tab">
            {tab === 'wallet' && <WalletTab />}
            {tab === 'chats' && <ChatsTab />}
            {tab === 'history' && <HistoryTab />}
            {tab === 'mesh' && <MeshTab />}
            {tab === 'settings' && <SettingsTab />}
          </ErrorBoundary>
        </main>
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-[58px] z-40 mx-auto max-w-md px-3"
        >
          <ul className="glass grid grid-cols-5 gap-1 rounded-3xl p-1.5" style={{ background: 'rgba(15,15,26,0.94)' }}>
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id
              return (
                <li key={id}>
                  <button
                    onClick={() => setTab(id)}
                    aria-current={active ? 'page' : undefined}
                    className="relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold transition-colors"
                    style={{
                      color: active ? 'var(--accent)' : 'var(--subtle)',
                      background: active ? 'rgba(62,217,184,0.1)' : 'transparent',
                    }}
                  >
                    <Icon className="size-5" />
                    {label}
                    {id === 'chats' && requests > 0 && (
                      <span className="absolute right-3 top-1.5 size-2 rounded-full" style={{ background: 'var(--warn)' }} />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </SheetsProvider>
  )
}
