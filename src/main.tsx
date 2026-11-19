import './tracing'
import './console-capture'

import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider } from 'connectkit'
import { Toaster } from 'sonner'
import { config } from './config'
import App from './App'
import './index.css'
import { useTheme } from './lib/theme'

const queryClient = new QueryClient()

function ThemedToaster() {
  const { resolved } = useTheme()
  return <Toaster position="top-center" theme={resolved} />
}

function ThemedConnectKit({ children }: { children: ReactNode }) {
  const { resolved } = useTheme()
  return <ConnectKitProvider mode={resolved}>{children}</ConnectKitProvider>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemedConnectKit>
          <App />
          <ThemedToaster />
        </ThemedConnectKit>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
