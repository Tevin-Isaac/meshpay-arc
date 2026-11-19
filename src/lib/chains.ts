import { createPublicClient, erc20Abi, http, type Address } from 'viem'
import { arbitrum, avalanche, base, mainnet, optimism, polygon } from 'viem/chains'
import { CHAIN, USDC_ADDRESS } from './mesh'

/**
 * Read-only USDC balances of an external wallet, per network. Nothing here can move funds.
 *
 * USDC contracts are Circle's native USDC on each chain, from Circle's "USDC contract addresses" page
 * (developers.circle.com/stablecoins/usdc-contract-addresses), and each was checked on chain
 * (symbol() == "USDC", decimals() == 6) by scripts/verify-chains-live.ts.
 * Arc uses the USDC ERC-20 facade from this build's config.
 * The RPC hosts are public endpoints; they must also be listed in public/_headers (CSP connect-src).
 */
export interface UsdcNetwork {
  id: string
  name: string
  chainId: number
  usdc: Address
  rpc: string
}

export const OTHER_NETWORKS: UsdcNetwork[] = [
  { id: 'ethereum', name: 'Ethereum', chainId: mainnet.id, usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', rpc: 'https://ethereum-rpc.publicnode.com' },
  { id: 'base', name: 'Base', chainId: base.id, usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', rpc: 'https://mainnet.base.org' },
  { id: 'polygon', name: 'Polygon', chainId: polygon.id, usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', rpc: 'https://polygon-bor-rpc.publicnode.com' },
  { id: 'arbitrum', name: 'Arbitrum', chainId: arbitrum.id, usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', rpc: 'https://arb1.arbitrum.io/rpc' },
  { id: 'optimism', name: 'Optimism', chainId: optimism.id, usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', rpc: 'https://mainnet.optimism.io' },
  { id: 'avalanche', name: 'Avalanche', chainId: avalanche.id, usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', rpc: 'https://api.avax.network/ext/bc/C/rpc' },
]

const VIEM_CHAINS = { ethereum: mainnet, base, polygon, arbitrum, optimism, avalanche } as const

/** One row: a real amount, or null when that network could not be read ("unavailable", never 0). */
export interface NetworkBalance {
  id: string
  name: string
  raw: bigint | null
}

export type BalanceReader = (n: UsdcNetwork, owner: Address) => Promise<bigint>

const viemReader =
  (timeoutMs: number): BalanceReader =>
  async (n, owner) => {
    const client = createPublicClient({ chain: VIEM_CHAINS[n.id as keyof typeof VIEM_CHAINS], transport: http(n.rpc, { timeout: timeoutMs, retryCount: 1 }) })
    return client.readContract({ address: n.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [owner] })
  }

/** The wallet's USDC on Arc (this build's network). Throws when it cannot be read. */
export async function readArcUsdc(owner: Address, timeoutMs = 8000): Promise<bigint> {
  const client = createPublicClient({ chain: CHAIN, transport: http(undefined, { timeout: timeoutMs, retryCount: 1 }) })
  return client.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [owner] })
}

/** All other networks in parallel. One failing network never hides the others, and never shows as zero. */
export async function readOtherUsdc(owner: Address, reader: BalanceReader = viemReader(6000), networks = OTHER_NETWORKS): Promise<NetworkBalance[]> {
  return Promise.all(
    networks.map(async (n) => {
      try {
        return { id: n.id, name: n.name, raw: await reader(n, owner) }
      } catch {
        return { id: n.id, name: n.name, raw: null }
      }
    }),
  )
}
