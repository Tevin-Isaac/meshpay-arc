/** Turns wallet and RPC errors into one short sentence. Returns null when the user simply cancelled. */
export function parseOnchainError(error: unknown): string | null {
  const e = error as { message?: string; code?: number; shortMessage?: string } | undefined
  const message = `${e?.shortMessage ?? ''} ${e?.message ?? ''}`.toLowerCase()
  if (e?.code === 4001 || message.includes('user rejected') || message.includes('user denied')) return null
  if (message.includes('insufficient funds') || message.includes('exceeds balance')) {
    return 'Not enough USDC to cover this and the network fee.'
  }
  if (message.includes('reverted')) return 'The contract rejected this transaction.'
  if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
    return 'Network issue. Check your connection and retry.'
  }
  if (error instanceof Error && error.message.length < 140 && !/https?:|0x[0-9a-f]{16}|rpc|\bat \w/i.test(error.message)) return error.message
  return 'Something went wrong. Please try again.'
}
