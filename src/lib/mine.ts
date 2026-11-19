import type { Address } from 'viem'
import { getState } from './store'

let connected: Address | null = null

/** The wallet connected in the browser, if any. A payment for it also counts as "for me". */
export function setConnectedWallet(address: Address | undefined) {
  connected = address ?? null
}

export function myAddresses(): Address[] {
  const device = getState().address
  return connected && connected.toLowerCase() !== device.toLowerCase() ? [device, connected] : [device]
}

export function isMine(address: string): boolean {
  return myAddresses().some((a) => a.toLowerCase() === address.toLowerCase())
}
