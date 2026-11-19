import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'

/** The icon shows where a click takes you: a sun while dark, a moon while light. */
function useFlip() {
  const { resolved, toggle } = useTheme()
  const toLight = resolved === 'dark'
  return { toLight, toggle, label: toLight ? 'Switch to light mode' : 'Switch to dark mode', Icon: toLight ? Sun : Moon }
}

/** One round icon button for the header. */
export function ThemeToggle() {
  const { toggle, label, Icon } = useFlip()
  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex size-11 items-center justify-center rounded-full"
      style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
    >
      <Icon className="size-4" />
    </button>
  )
}

/** Settings row that mirrors the same flip. */
export function AppearanceRow() {
  const { toggle, label, Icon, toLight } = useFlip()
  return (
    <button onClick={toggle} aria-label={label} className="flex min-h-12 w-full items-center gap-3 text-left">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--tint-accent)', color: 'var(--accent)' }}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Appearance</span>
        <span className="block text-xs" style={{ color: 'var(--muted)' }}>
          {toLight ? 'Dark now. Tap for light.' : 'Light now. Tap for dark.'} Shared with wayamesh.xyz.
        </span>
      </span>
    </button>
  )
}
