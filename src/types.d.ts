declare module 'shamirs-secret-sharing' {
  import type { Buffer } from 'buffer'
  export function split(secret: Buffer, opts: { shares: number; threshold: number }): Buffer[]
  export function combine(shares: Buffer[]): Buffer
  const sss: { split: typeof split; combine: typeof combine }
  export default sss
}
