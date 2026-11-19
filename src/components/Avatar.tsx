/** Round avatar made from a wallet address: a stable gradient plus two letters, like the phone app. */
function hue(seed: string, shift: number): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return ((h >>> 0) + shift) % 360
}

export function labelFor(seed: string): string {
  const s = (seed || '').trim()
  if (/^0x[0-9a-fA-F]+/.test(s)) return s.slice(2, 4).toUpperCase()
  return (s.slice(0, 2) || '··').toUpperCase()
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase()
}

export function Avatar({ seed, name, size = 44 }: { seed: string; name?: string; size?: number }) {
  const a = hue(seed.toLowerCase(), 0)
  const b = (a + 55) % 360
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        letterSpacing: 0.3,
        background: `linear-gradient(135deg, hsl(${a} 62% 42%), hsl(${b} 62% 34%))`,
        textShadow: '0 1px 2px rgba(0,0,0,0.35)',
      }}
    >
      {name?.trim() ? initials(name) : labelFor(seed)}
    </span>
  )
}
