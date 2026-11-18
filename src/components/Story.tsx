import { MeshVisual } from './MeshVisual'

export function Story() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 lg:grid-cols-2">
      <div>
        <p className="eyebrow">Why it exists</p>
        <h2 className="display mt-3 text-balance text-4xl font-bold sm:text-5xl">The money works. The connection is the weak link.</h2>
        <div className="mt-5 space-y-4 text-pretty text-base" style={{ color: 'var(--ink-2)' }}>
          <p>
            Outages, crowded networks and remote areas all have the same effect: you hold USDC and cannot spend it, because every digital payment, crypto
            included, assumes a live connection.
          </p>
          <p>
            MeshPay takes the connection out of the payment itself. Your phone signs the transfer and the signed payment travels person to person. Whoever
            reaches a signal first submits it to Arc.
          </p>
        </div>
      </div>
      <div className="glass rounded-[2rem] p-6">
        <MeshVisual />
        <p className="mt-2 text-center text-xs text-pretty" style={{ color: 'var(--muted)' }}>
          Alice signs offline and hands the payment to Bob. Bob reaches a signal first and settles it for everyone.
        </p>
      </div>
    </section>
  )
}
