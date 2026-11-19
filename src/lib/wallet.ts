import { bytesToHex, type Hex } from 'viem'
import { english, generateMnemonic, mnemonicToAccount } from 'viem/accounts'
import { validateMnemonic } from '@scure/bip39'

/** A fresh 12-word recovery phrase. */
export function newMnemonic(): string {
  return generateMnemonic(english)
}

export function normalizeMnemonic(input: string): string {
  return input.trim().toLowerCase().split(/\s+/).join(' ')
}

export function isValidMnemonic(input: string): boolean {
  const m = normalizeMnemonic(input)
  const words = m.split(' ').length
  return (words === 12 || words === 24) && validateMnemonic(m, english)
}

/** Standard account 0 (m/44'/60'/0'/0/0), so the same phrase opens the same address in other wallets, including the mobile app. */
export function keyFromMnemonic(input: string): Hex {
  const hd = mnemonicToAccount(normalizeMnemonic(input)).getHdKey()
  if (!hd.privateKey) throw new Error('Could not derive a key from that phrase.')
  return bytesToHex(hd.privateKey)
}
