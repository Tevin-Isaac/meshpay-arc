/** Production stand-in for the Arc Studio preview tracing hook. It does nothing, so no network or wallet data is ever forwarded. */
export function registerChain(_chainId: number, _rpcUrl: string): void {
  // intentionally empty
}
