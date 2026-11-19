/** Balance maths. Pure, so it can be tested against live chain readings. */

/** USDC kept back for the network fee on an online payment. Arc pays gas in USDC from the same pool. */
export const GAS_BUFFER = 20_000n

/** Reserve minus payments already signed but not yet settled. Never negative. */
export function spendableOf(reserve: bigint | null, committed: bigint): bigint | null {
  if (reserve === null) return null
  return reserve > committed ? reserve - committed : 0n
}

/**
 * Total balance: USDC at the device address plus the spendable offline reserve.
 * Null unless both parts are known, so a half-known number is never shown as the total.
 */
export function totalBalance(inWallet: bigint | null, spendable: bigint | null): bigint | null {
  if (inWallet === null || spendable === null) return null
  return inWallet + spendable
}

/** The most that can be sent online: the wallet balance less the fee buffer. Zero when too little. */
export function maxOnline(inWallet: bigint | null): bigint {
  if (inWallet === null || inWallet <= GAS_BUFFER) return 0n
  return inWallet - GAS_BUFFER
}

/** What to show for a balance line: a real figure, or an em dash when it is unknown. */
export function showUsdc(raw: bigint | null, fmt: (r: bigint) => string): string {
  return raw === null ? '—' : fmt(raw)
}
