import { useRef, useState, type ReactNode } from 'react'
import { createWalletClient, http, type Address, type Hex } from 'viem'
import { usePublicClient } from 'wagmi'
import { toast } from 'sonner'
import { ArrowDownToLine, ArrowUpFromLine, Check, ExternalLink, Info, Loader2, Smartphone } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { formatUsdc, parseAmount, parseUsdc, usdcToGasToken } from '@/onchain-money'
import { fmtExact } from '@/lib/format'
import { parseOnchainError } from '@/lib/errors'
import { CHAIN, ZERO_REF } from '@/lib/mesh'
import { useNet } from '@/lib/net'
import { createSignedPayment } from '@/lib/pay'
import { checkPolicy } from '@/lib/policy'
import {
  normalizePhone,
  pollOrder,
  previewKesForUsdc,
  previewUsdcForKes,
  startOfframp,
  startOnramp,
  useRampConfig,
  type RampConfig,
  type RampOrder,
} from '@/lib/ramp'
import { addItem, getDeviceAccount, getState } from '@/lib/store'
import { useDevice, useDeviceUsdc, useSpendable } from '@/hooks/useMeshData'
import { useSettle } from '@/hooks/useSettle'
import { useSheets } from './shell/useSheets'
import { PrimaryButton, Sheet } from './ui'

/** Gas left on the device when it sends USDC straight to the treasury. */
const GAS_BUFFER = 50_000n

export function MpesaSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="M-Pesa">
      <MpesaBody />
    </Sheet>
  )
}

function MpesaBody() {
  const cfg = useRampConfig()
  const [tab, setTab] = useState<'in' | 'out'>('in')
  if (!cfg) {
    return <p className="rounded-2xl p-4 text-sm" style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}>M-Pesa is not available on this server.</p>
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl p-1" style={{ background: 'var(--surface-muted)' }}>
        {(
          [
            ['in', 'Add money', ArrowDownToLine],
            ['out', 'Cash out', ArrowUpFromLine],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
            style={{ background: tab === id ? 'var(--accent)' : 'transparent', color: tab === id ? 'var(--on-accent)' : 'var(--ink)' }}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      {cfg.mock && (
        <p className="flex gap-2 rounded-2xl p-3 text-xs" style={{ background: 'var(--tint-warn)', color: 'var(--ink)' }}>
          <Info className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--warn)' }} />
          <span>
            Sandbox. The M-Pesa prompt and payout are simulated at a demo rate of {cfg.usdKes} KES per USD, and no real money moves.{' '}
            {cfg.treasuryMock
              ? 'This server has no treasury key, so no USDC is actually sent either: the transaction hash is made up.'
              : 'The USDC is Arc Testnet test USDC, which has no market value.'}
          </span>
        </p>
      )}
      {tab === 'in' ? <AddMoney cfg={cfg} /> : <CashOut cfg={cfg} />}
    </div>
  )
}

const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide'

function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={label} style={{ color: 'var(--muted)' }}>
        {title}
      </span>
      {children}
    </label>
  )
}

const inputCls = 'min-h-12 w-full rounded-2xl px-4 text-base outline-none'
const inputStyle = { background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' } as const

function Progress({ steps, current, failed }: { steps: string[]; current: number; failed?: string }) {
  return (
    <ol className="space-y-2 rounded-2xl p-4 text-sm" style={{ background: 'var(--surface-muted)' }}>
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current && !failed
        return (
          <li key={s} className="flex items-center gap-2" style={{ color: done || active ? 'var(--ink)' : 'var(--subtle)' }}>
            {done ? (
              <Check className="size-4" style={{ color: 'var(--success)' }} />
            ) : active ? (
              <Loader2 className="size-4 animate-spin" style={{ color: 'var(--accent)' }} />
            ) : (
              <span className="size-4 rounded-full border" style={{ borderColor: 'var(--border)' }} />
            )}
            {s}
          </li>
        )
      })}
      {failed && (
        <li className="pt-1 text-sm" style={{ color: 'var(--danger)' }}>
          {failed}
        </li>
      )}
    </ol>
  )
}

function AddMoney({ cfg }: { cfg: RampConfig }) {
  const device = useDevice()
  const { online } = useNet()
  const sheets = useSheets()
  const [phone, setPhone] = useState('')
  const [kes, setKes] = useState('')
  const [busy, setBusy] = useState(false)
  const [order, setOrder] = useState<RampOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const kesN = Number(kes)
  const valid = !!normalizePhone(phone) && Number.isInteger(kesN) && kesN >= cfg.minKes && kesN <= cfg.maxKes
  const preview = valid ? previewUsdcForKes(cfg, kesN) : null

  const start = async () => {
    setBusy(true)
    setError(null)
    setOrder(null)
    try {
      const o = await startOnramp(getDeviceAccount(), phone, kesN)
      const final = await pollOrder(o.id, setOrder)
      if (final.status === 'completed') toast.success(cfg.treasuryMock ? `${final.usdc} USDC (simulated, nothing was sent).` : `${final.usdc} USDC arrived.`)
      else if (final.status !== 'failed') setError('Still waiting for M-Pesa. If you approved the prompt, the USDC arrives shortly. You can close this and check your balance.')
    } catch (e) {
      setError(parseOnchainError(e) ?? (e instanceof Error ? e.message : 'Could not start M-Pesa.'))
    } finally {
      setBusy(false)
    }
  }

  const step = !order ? 0 : order.status === 'pending' ? 1 : order.status === 'completed' ? 4 : 2
  const done = order?.status === 'completed'
  const failed = order?.status === 'failed' ? (order.reason ?? 'M-Pesa did not complete.') : error ?? undefined

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Pay with M-Pesa and get USDC on this device ({device.address.slice(0, 6)}…{device.address.slice(-4)}). Then add it to your offline balance.
      </p>
      <Field title="M-Pesa phone number">
        <input
          className={inputCls}
          style={inputStyle}
          inputMode="tel"
          autoComplete="tel"
          placeholder="07XX XXX XXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-label="M-Pesa phone number"
          disabled={busy}
        />
      </Field>
      <Field title={`Amount in KES (${cfg.minKes} to ${cfg.maxKes.toLocaleString()})`}>
        <input
          className={inputCls}
          style={inputStyle}
          inputMode="numeric"
          placeholder="1000"
          value={kes}
          onChange={(e) => setKes(e.target.value.replace(/\D/g, '').slice(0, 7))}
          aria-label="Amount in KES"
          disabled={busy}
        />
      </Field>
      {preview !== null && (
        <p className="text-sm" style={{ color: 'var(--ink)' }}>
          You get about <b>{preview.toFixed(2)} USDC</b>{' '}
          <span style={{ color: 'var(--muted)' }}>
            after a {cfg.feeBps / 100}% fee at {cfg.usdKes} KES per USD.
          </span>
        </p>
      )}
      {(busy || order || error) && (
        <Progress
          steps={['M-Pesa prompt sent to your phone', 'Approve it on your phone', 'Payment received, sending USDC', 'USDC delivered']}
          current={step}
          failed={failed}
        />
      )}
      {done && order && (
        <div className="space-y-2 rounded-2xl p-4 text-sm" style={{ background: 'var(--tint-accent)', border: '1px solid var(--line-accent)' }}>
          <p style={{ color: 'var(--ink)' }}>
            <b>{order.usdc.replace(/0+$/, '').replace(/\.$/, '')} USDC</b> for {order.kes.toLocaleString()} KES
            {order.mpesaReceipt ? ` (receipt ${order.mpesaReceipt})` : ''}.
          </p>
          {order.txHash && !order.mock && (
            <a className="inline-flex items-center gap-1 underline" style={{ color: 'var(--accent-hover)' }} href={buildTxExplorerUrl(CHAIN.id, order.txHash)} target="_blank" rel="noreferrer">
              View transaction <ExternalLink className="size-3.5" />
            </a>
          )}
          <PrimaryButton onClick={() => sheets.open('add')}>Add to offline balance</PrimaryButton>
        </div>
      )}
      {!done && (
        <PrimaryButton disabled={!valid || busy || !online} onClick={() => void start()}>
          <Smartphone className="size-4" />
          {busy ? 'Waiting for M-Pesa…' : online ? 'Send M-Pesa prompt' : 'Needs a connection'}
        </PrimaryButton>
      )}
    </div>
  )
}

function CashOut({ cfg }: { cfg: RampConfig }) {
  const device = useDevice()
  const { online } = useNet()
  const { settle } = useSettle()
  const client = usePublicClient({ chainId: CHAIN.id })
  const deviceUsdc = useDeviceUsdc()
  const { spendable } = useSpendable()
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState(0)
  const [order, setOrder] = useState<RampOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const running = useRef(false)

  let raw: bigint | null = null
  try {
    raw = amount ? parseUsdc(amount) : null
  } catch {
    raw = null
  }
  const kes = raw && raw > 0n ? previewKesForUsdc(cfg, Number(formatUsdc(raw))) : null
  const kesOk = kes !== null && kes >= cfg.minKes && kes <= cfg.maxKes
  const valid = !!normalizePhone(phone) && raw !== null && raw > 0n && kesOk && !!cfg.treasury
  const direct = deviceUsdc.raw
  const fromReserve = spendable ?? 0n

  const run = async () => {
    if (running.current || raw === null || !cfg.treasury) return
    running.current = true
    setBusy(true)
    setError(null)
    setOrder(null)
    setStage(0)
    try {
      const account = getDeviceAccount()
      const treasury = cfg.treasury as Address
      let txHash: Hex
      let deposit: 'native' | 'voucher'
      if (direct >= raw + GAS_BUFFER) {
        // Send straight from the USDC on this device.
        const blocked = checkPolicy(raw, getState().policy, getState().items)
        if (blocked) throw new Error(blocked)
        setStage(0)
        const wc = createWalletClient({ account, chain: CHAIN, transport: http() })
        txHash = await wc.sendTransaction({ to: treasury, value: usdcToGasToken(CHAIN.id, parseAmount(CHAIN.id, formatUsdc(raw))).raw })
        await client?.waitForTransactionReceipt({ hash: txHash })
        deposit = 'native'
        addItem({
          id: `cashout:${txHash}`,
          source: 'signed',
          from: account.address,
          to: treasury,
          amount: raw.toString(),
          fee: '0',
          nonce: '0',
          deadline: '0',
          ref: ZERO_REF,
          signature: '0x',
          createdAt: Date.now(),
          status: 'settled',
          txHash,
          kind: 'cashout',
        })
      } else if (fromReserve >= raw) {
        // Pay the treasury from the offline balance with a signed payment, then settle it.
        const { item } = await createSignedPayment(treasury, raw, { kind: 'cashout', spendable })
        setStage(0)
        const res = await settle([item])
        if (res.settled !== 1 || !res.hash) throw new Error('Could not settle the payment to the treasury. Try again.')
        txHash = res.hash
        deposit = 'voucher'
      } else {
        throw new Error('Not enough balance. Add funds or lower the amount.')
      }
      setStage(1)
      const o = await startOfframp(account, phone, formatUsdc(raw), txHash, deposit)
      setStage(2)
      const final = await pollOrder(o.id, setOrder, { timeoutMs: 4 * 60_000 })
      if (final.status !== 'completed' && final.status !== 'failed') setError('Still waiting for the M-Pesa payout. It may still arrive; do not send again.')
      if (final.status === 'completed') {
        setStage(4)
        toast.success(`${final.kes.toLocaleString()} KES sent to M-Pesa.`)
      }
    } catch (e) {
      setError(parseOnchainError(e) ?? (e instanceof Error ? e.message : 'Cash out failed.'))
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  const done = order?.status === 'completed'
  const failed = order?.status === 'failed' ? (order.reason ?? 'The payout did not complete.') : error ?? undefined
  const showProgress = busy || order !== null || error !== null
  const current = done ? 4 : stage

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Send USDC from this wallet to an M-Pesa number. It uses the USDC on this device first, then your offline balance.
      </p>
      <p className="text-xs" style={{ color: 'var(--subtle)' }}>
        Available: {fmtExact(direct)} USDC on this device and {fmtExact(fromReserve)} USDC offline balance. ({device.address.slice(0, 6)}…{device.address.slice(-4)})
      </p>
      <Field title="M-Pesa phone number">
        <input
          className={inputCls}
          style={inputStyle}
          inputMode="tel"
          autoComplete="tel"
          placeholder="07XX XXX XXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-label="Payout phone number"
          disabled={busy}
        />
      </Field>
      <Field title="Amount in USDC">
        <input
          className={inputCls}
          style={inputStyle}
          inputMode="decimal"
          placeholder="1.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, '').slice(0, 14))}
          aria-label="Amount in USDC"
          disabled={busy}
        />
      </Field>
      {kes !== null && (
        <p className="text-sm" style={{ color: kesOk ? 'var(--ink)' : 'var(--danger)' }}>
          {kesOk
            ? `You get about ${kes.toLocaleString()} KES (${cfg.feeBps / 100}% fee).`
            : `The payout must be between ${cfg.minKes} and ${cfg.maxKes.toLocaleString()} KES.`}
        </p>
      )}
      {!cfg.treasury && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          Cash out is not set up on this server yet.
        </p>
      )}
      {showProgress && (
        <Progress
          steps={['Sending USDC to the payout account', 'Checking the deposit', 'Sending KES to M-Pesa', 'Paid out']}
          current={current}
          failed={failed}
        />
      )}
      {done && order && (
        <p className="rounded-2xl p-4 text-sm" style={{ background: 'var(--tint-accent)', border: '1px solid var(--line-accent)', color: 'var(--ink)' }}>
          <b>{order.kes.toLocaleString()} KES</b> sent to {order.phoneMasked}
          {order.mpesaReceipt ? ` (receipt ${order.mpesaReceipt})` : ''}.
        </p>
      )}
      {!done && (
        <PrimaryButton disabled={!valid || busy || !online} onClick={() => void run()}>
          <ArrowUpFromLine className="size-4" />
          {busy ? 'Working…' : online ? 'Cash out to M-Pesa' : 'Needs a connection'}
        </PrimaryButton>
      )}
    </div>
  )
}
