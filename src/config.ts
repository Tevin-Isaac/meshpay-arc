/**
 * wagmi configuration. The wallet runs on its own device key; this only powers the optional
 * "External wallet" connection in Settings.
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { CHAIN } from '@/lib/network'
import { injected, walletConnect } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(CHAIN.id, CHAIN.rpcUrls.default.http[0])

/**
 * WalletConnect (phone wallet apps, mobile deep links) needs a free project id from cloud.reown.com.
 * Set VITE_WALLETCONNECT_PROJECT_ID at build time. Without it only browser extension wallets (MetaMask etc.)
 * can be connected, and nothing breaks.
 */
const WC_PROJECT_ID = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim()
export const HAS_WALLETCONNECT = !!WC_PROJECT_ID

export const config = createConfig({
  chains: [CHAIN, mainnet], // mainnet needed for ENS resolution
  connectors: [
    injected(),
    ...(WC_PROJECT_ID
      ? [
          walletConnect({
            projectId: WC_PROJECT_ID,
            showQrModal: false, // ConnectKit draws the QR code and the phone deep-link list itself
            metadata: { name: 'Wayamesh', description: 'Wayamesh web wallet', url: typeof window === 'undefined' ? 'https://wayamesh.xyz' : window.location.origin, icons: [] },
          }),
        ]
      : []),
  ],
  transports: {
    [CHAIN.id]: http(),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
