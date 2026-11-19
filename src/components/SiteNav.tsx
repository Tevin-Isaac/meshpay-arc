import { asset } from '@/lib/env'
const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#faq', label: 'FAQ' },
]

export function SiteNav() {
  return (
    <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4" aria-label="Main">
      <a href="#top" className="flex items-center gap-2.5">
        <img src={asset('icon.svg')} alt="" className="size-9 rounded-xl" />
        <span className="display text-xl font-bold">MeshPay</span>
      </a>
      <div className="flex items-center gap-1">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="hidden min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors hover:bg-white/70 md:flex"
            style={{ color: 'var(--ink-2)' }}
          >
            {l.label}
          </a>
        ))}
        <a
          href="#app"
          className="ml-1 flex min-h-11 items-center rounded-full px-5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'var(--accent)' }}
        >
          Open the app
        </a>
      </div>
    </nav>
  )
}
