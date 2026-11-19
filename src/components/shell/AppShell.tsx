import { useCallback, useEffect, useState } from 'react'
import { Clock, MessagesSquare, Radio, Settings, Wallet } from 'lucide-react'
import { useMeshState } from '@/lib/store'
import { useChatEngine, useStandingRunner } from '@/hooks/useEngines'
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
  useStandingRunner(ready)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // the offline shell is a bonus; the app still works online
      })
    }
  }, [])

  const requests = contacts.filter((c) => c.request).length

  return (
    <SheetsProvider onTab={goTab}>
      <div className="page-glow relative isolate min-h-dvh">
        <main className="mx-auto w-full max-w-md space-y-3 px-4 pb-48 pt-[max(env(safe-area-inset-top),16px)]">
          <Header />
          {tab === 'wallet' && <WalletTab />}
          {tab === 'chats' && <ChatsTab />}
          {tab === 'history' && <HistoryTab />}
          {tab === 'mesh' && <MeshTab />}
          {tab === 'settings' && <SettingsTab />}
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
