import { useEffect } from 'react'
import { parseUsdc } from '@/onchain-money'
import { getState, addAudit, purgeExpiredMessages, setStanding, useMeshState, type Standing } from '@/lib/store'
import { useNet } from '@/lib/net'
import { xonlyOf } from '@/lib/chat/crypto'
import { PURGE_INTERVAL_MS, relaySince } from '@/lib/chat/expiry'
import { startRelays, stopRelays } from '@/lib/chat/relay'
import { flushOutbox, handleRelayContent, myPubkey, sendChat } from '@/lib/chat/service'
import { createSignedPayment, PaymentBlocked } from '@/lib/pay'
import { fmtUsdc } from '@/lib/format'
import { toast } from 'sonner'

/** 24-hour chat expiry: purge old messages on start, when the app returns to the foreground, and every 5 minutes. */
export function usePurgeEngine(active: boolean) {
  useEffect(() => {
    if (!active) return
    purgeExpiredMessages()
    const onVisible = () => {
      if (document.visibilityState === 'visible') purgeExpiredMessages()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const timer = setInterval(() => purgeExpiredMessages(), PURGE_INTERVAL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      clearInterval(timer)
    }
  }, [active])
}

/** Keeps the encrypted chat connected to relays while you are online, and delivers anything that was waiting. */
export function useChatEngine(active: boolean) {
  const { online } = useNet()
  const { settings } = useMeshState()
  const relaysKey = settings.relays.join(',')

  useEffect(() => {
    if (!active || !online) {
      stopRelays()
      return
    }
    const urls = relaysKey.split(',').filter(Boolean)
    // Nothing older than 24 hours can still be valid, so never ask relays for more.
    startRelays(urls, xonlyOf(myPubkey()), relaySince(), (event) => {
      void handleRelayContent(event.content)
    })
    const timer = setInterval(() => void flushOutbox(), 5000)
    return () => {
      clearInterval(timer)
      stopRelays()
    }
  }, [active, online, relaysKey])
}

const PERIOD: Record<Standing['every'], number> = { daily: 86_400_000, weekly: 604_800_000, monthly: 2_592_000_000 }

function spendableNow(): bigint | null {
  const { reserveCache, items } = getState()
  if (!reserveCache) return null
  const committed = items.filter((i) => i.source === 'signed' && i.status === 'pending').reduce((sum, i) => sum + BigInt(i.amount) + BigInt(i.fee ?? '0'), 0n)
  const raw = BigInt(reserveCache.raw)
  return raw > committed ? raw - committed : 0n
}

/** Signs standing payments that are due, fully on this phone, inside the limits you set. */
export function useStandingRunner(active: boolean) {
  useEffect(() => {
    if (!active) return
    let running = false
    const run = async () => {
      if (running) return
      running = true
      try {
        const now = Date.now()
        for (const s of getState().standing) {
          if (!s.active || s.next > now) continue
          const update = (patch: Partial<Standing>) => setStanding(getState().standing.map((x) => (x.id === s.id ? { ...x, ...patch } : x)))
          try {
            const raw = parseUsdc(s.amount)
            if (s.until && now > s.until) {
              update({ active: false })
              addAudit(`Standing payment to ${s.name || s.to} ended: expiry reached.`, 'warn')
              continue
            }
            const total = BigInt(s.paidTotal ?? '0')
            if (s.maxTotal && total + raw > parseUsdc(s.maxTotal)) {
              update({ active: false })
              addAudit(`Standing payment to ${s.name || s.to} stopped: total cap reached.`, 'warn')
              continue
            }
            const { item, code } = await createSignedPayment(s.to, raw, { spendable: spendableNow() })
            // Move the schedule forward as soon as the payment exists, so a failed delivery can never sign it twice.
            let next = s.next + PERIOD[s.every]
            while (next <= now) next += PERIOD[s.every]
            update({ next, paid: s.paid + 1, paidTotal: (total + raw).toString() })
            addAudit(`Signed ${fmtUsdc(raw)} USDC to ${s.name || s.to} (${s.every}).`, 'good')
            toast.success(`Standing payment signed: ${fmtUsdc(raw)} USDC to ${s.name || s.to}. It settles when any phone is online.`)
            const contact = getState().contacts.find((c) => c.address.toLowerCase() === s.to.toLowerCase())
            if (contact) {
              try {
                await sendChat(contact, { k: 'payment', a: s.amount, x: s.note, c: code }, item.id)
              } catch {
                addAudit(`Payment to ${s.name || s.to} is signed and held. Chat delivery will be retried by hand.`, 'warn')
              }
            }
          } catch (e) {
            update({ next: now + 3_600_000 })
            const why = e instanceof PaymentBlocked || e instanceof Error ? e.message : 'Could not sign.'
            addAudit(`Standing payment to ${s.name || s.to} blocked: ${why}`, 'bad')
          }
        }
      } finally {
        running = false
      }
    }
    void run()
    const timer = setInterval(() => void run(), 20_000)
    return () => clearInterval(timer)
  }, [active])
}
