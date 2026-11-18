import { Download, Film } from 'lucide-react'

/** The two-phone walkthrough, with downloads for sharing. */
export function DemoCard() {
  return (
    <section className="glass rounded-3xl p-4">
      <div className="flex items-center gap-2">
        <Film className="size-4" style={{ color: 'var(--accent-hover)' }} />
        <h2 className="display text-lg font-bold">See it in action</h2>
      </div>
      <p className="mt-1 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        Two phones with no signal. One signs a payment, the other receives it, then it settles on Arc.
      </p>
      <video
        src="/meshpay-demo.mp4"
        poster="/demo-poster.jpg"
        controls
        playsInline
        preload="none"
        className="mt-3 w-full rounded-2xl bg-black"
        aria-label="MeshPay demo video"
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <a
          href="/meshpay-demo.mp4"
          download="meshpay-demo.mp4"
          className="flex min-h-11 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          <Download className="size-4" /> Video (MP4)
        </a>
        <a
          href="/meshpay-demo.gif"
          download="meshpay-demo.gif"
          className="flex min-h-11 items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        >
          <Download className="size-4" /> GIF
        </a>
      </div>
    </section>
  )
}
