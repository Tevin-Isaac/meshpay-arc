import { useSyncExternalStore } from 'react'

/**
 * Light / dark theme. The key and values are shared with the wayamesh.xyz website (same origin),
 * so a choice made on either applies to both. public/theme-init.js applies it before first paint.
 */
export const THEME_KEY = 'wayamesh-theme'
export type ThemePref = 'system' | 'light' | 'dark'
export type Resolved = 'light' | 'dark'

export const DARK_COLOR = '#07070f'
export const LIGHT_COLOR = '#f5f7fa'

/** Anything that is not exactly "light" or "dark" means "system". */
export function parsePref(v: unknown): ThemePref {
  return v === 'light' || v === 'dark' ? v : 'system'
}

/** Without any signal the wallet stays dark, as it always was. */
export function resolveTheme(pref: ThemePref, systemLight: boolean): Resolved {
  if (pref === 'light') return 'light'
  if (pref === 'dark') return 'dark'
  return systemLight ? 'light' : 'dark'
}

const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined'
const mq = () => (hasDom && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null)

export function readPref(): ThemePref {
  try {
    return parsePref(localStorage.getItem(THEME_KEY))
  } catch {
    return 'system'
  }
}

let pref: ThemePref = readPref()
const listeners = new Set<() => void>()

function apply() {
  if (!hasDom) return
  const r = resolveTheme(pref, mq()?.matches ?? false)
  const root = document.documentElement
  root.setAttribute('data-theme', r)
  root.style.colorScheme = r
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', r === 'light' ? LIGHT_COLOR : DARK_COLOR)
}

/** Flip to the other theme and remember it. */
export function toggleTheme() {
  const now = resolveTheme(pref, mq()?.matches ?? false)
  setThemePref(now === 'dark' ? 'light' : 'dark')
}

export function setThemePref(next: ThemePref) {
  pref = next
  try {
    if (next === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, next)
  } catch {
    // private mode or blocked storage: the choice still applies for this visit
  }
  apply()
  listeners.forEach((l) => l())
}

if (hasDom) {
  apply()
  // Follow the system live while the preference is "system".
  mq()?.addEventListener?.('change', () => {
    if (pref === 'system') {
      apply()
      listeners.forEach((l) => l())
    }
  })
  // A change made in another tab, or on the website, applies here too.
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_KEY || e.key === null) {
      pref = readPref()
      apply()
      listeners.forEach((l) => l())
    }
  })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useTheme() {
  const p = useSyncExternalStore(subscribe, () => pref, () => 'system' as ThemePref)
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolveTheme(pref, mq()?.matches ?? false),
    () => 'dark' as Resolved,
  )
  return { pref: p, resolved, setPref: setThemePref, toggle: toggleTheme }
}
