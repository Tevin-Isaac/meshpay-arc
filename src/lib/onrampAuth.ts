/**
 * The wallet proves it owns the destination address by signing this message.
 * The server verifies it, so a session can only be minted for the signer's own address.
 */
export const ONRAMP_AUTH_WINDOW_MS = 2 * 60 * 1000

export function onrampAuthMessage(address: string, issuedAt: number): string {
  return [
    'MeshPay: buy USDC',
    '',
    'Sign to prove you own this wallet. This does not cost anything.',
    `Address: ${address.toLowerCase()}`,
    `Issued: ${new Date(issuedAt).toISOString()}`,
  ].join('\n')
}
