/**
 * Build-time configuration, readable from the browser bundle (Vite replaces `import.meta.env`)
 * and from Node/tsx scripts (no `import.meta.env`, so fall back to `process.env`).
 */
type Env = Record<string, string | undefined>
const meta = (import.meta as unknown as { env?: Env }).env
const proc = (globalThis as unknown as { process?: { env?: Env } }).process?.env
export const ENV: Env = meta ?? proc ?? {}
