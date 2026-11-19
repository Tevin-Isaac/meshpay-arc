/**
 * Build-time configuration, readable from the browser bundle (Vite replaces `import.meta.env`)
 * and from Node/tsx scripts (no `import.meta.env`, so fall back to `process.env`).
 */
type Env = Record<string, string | undefined>
const meta = (import.meta as unknown as { env?: Env }).env
const proc = (globalThis as unknown as { process?: { env?: Env } }).process?.env
export const ENV: Env = meta ?? proc ?? {}

/** Where the built files are served from (Vite `base`). "/" for a root deploy, "/app-static/" under wayamesh.xyz. */
export const BASE_URL = (ENV.BASE_URL ?? '/').replace(/\/?$/, '/')
/** URL of a file from public/, correct under any base. */
export const asset = (path: string) => BASE_URL + path.replace(/^\//, '')
/**
 * Page path the app is mounted at when it is not the site root (VITE_APP_PATH, e.g. "/app").
 * Used as the service worker scope and the manifest scope. Empty means "same as BASE_URL".
 */
export const APP_PATH = (ENV.VITE_APP_PATH ?? '').replace(/\/+$/, '')
/** Service worker script URL and scope. Under a mount the worker file must sit at the site root. */
export const SW_URL = APP_PATH ? '/sw.js' : BASE_URL + 'sw.js'
export const SW_SCOPE = APP_PATH || BASE_URL
