import { ChevronDown } from 'lucide-react'

const QUESTIONS = [
  {
    q: 'Can I use real money?',
    a: 'No. This is a testnet demo, so it uses test USDC with no value. Use Get test USDC in the Arc Studio sidebar to fund your wallet.',
  },
  {
    q: 'What stops someone paying the same money twice?',
    a: 'Each payment carries a one-time number, so the same payment can only settle once. What offline payments cannot prevent is a payer signing more payments than their balance covers. Check the Funded tag when you are online, and use limits to cap your exposure.',
  },
  {
    q: 'Who pays the network fee?',
    a: 'Whoever settles the payment pays a small fee in USDC from their own wallet. A gasless option is on the roadmap.',
  },
  {
    q: 'Does this use Bluetooth?',
    a: 'Not in the web version. A web page cannot do Bluetooth handoff, so payments move by QR code, copy or the share sheet. Bluetooth is planned for native apps.',
  },
  {
    q: 'Where is my key stored?',
    a: 'In this browser, on this device. Back it up from Limits. If you clear browser data without a backup, the offline balance tied to that key is unreachable. A native app would keep it in secure hardware.',
  },
]

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-6 px-5 py-20">
      <p className="eyebrow">FAQ</p>
      <h2 className="display mt-3 text-balance text-4xl font-bold sm:text-5xl">Straight answers.</h2>
      <div className="mt-8 space-y-3">
        {QUESTIONS.map(({ q, a }) => (
          <details key={q} className="glass group rounded-2xl px-5">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" style={{ color: 'var(--subtle)' }} />
            </summary>
            <p className="pb-5 text-sm text-pretty" style={{ color: 'var(--muted)' }}>
              {a}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
