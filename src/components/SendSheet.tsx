import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { erc20Abi, getAddress, isAddress, zeroAddress } from 'viem'
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { Check, ExternalLink, WifiOff } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { fmtUsdc, shortAddress } from '@/lib/format'
import { parseOnchainError } from '@/lib/errors'
import { CHAIN, USDC_ADDRESS } from '@/lib/mesh'
import { createSignedPayment, PaymentBlocked } from '@/lib/pay'
import { useNet } from '@/lib/net'
import { addItem, type StoredItem } from '@/lib/store'
import { useSpendable } from '@/hooks/useMeshData'
import { AmountInput, PrimaryButton, Sheet } from './ui'
import { CodeShare } from './CodeShare'

export interface SendPrefill {
  to?: string
  amount?: string
}

export function SendSheet({ open, onClose, prefill }: { open: boolean; onClose: () => void; prefill: SendPrefill }) {
  // The sheet body only mounts while open, so its state starts fresh every time.
  return (
    <Sheet open={open} onClose={onClose} title="Send USDC">
      <SendBody onClose={onClose} prefill={prefill} />
    </Sheet>
  )
}

function SendBody({ onClose, prefill }: { onClose: () => void; prefill: SendPrefill }) {
  const { online } = useNet()
  const { isConnected } = useAccount()
  const [mode, setMode] = useState<'pay' | 'offline'>(online && isConnected ? 'pay' : 'offline')
  const [to, setTo] = useState(prefill.to ?? '')
  const [amount, setAmount] = useState(prefill.amount ?? '')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl p-1" style={{ background: 'var(--surface-muted)' }}>
        {(['pay', 'offline'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="min-h-10 rounded-xl text-xs font-semibold"
            style={{
              background: mode === m ? 'white' : 'transparent',
              color: mode === m ? 'var(--ink)' : 'var(--muted)',
              boxShadow: mode === m ? '0 1px 3px rgba(18,45,69,0.12)' : 'none',
            }}
          >
            {m === 'pay' ? 'Pay now (online)' : 'Sign offline'}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="to" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
          Recipient
        </label>
        <input
          id="to"
          value={to}
          onChange={(e) => setTo(e.target.value.trim())}
          placeholder="0x… or scan their request"
          spellCheck={false}
          autoCapitalize="off"
          className="inner mono min-h-12 w-full rounded-2xl px-4 text-sm outline-none"
          style={{ color: 'var(--ink)' }}
        />
      </div>

      {mode === 'pay' ? (
        <PayNow to={to} amount={amount} setAmount={setAmount} onClose={onClose} />
      ) : (
        <OfflineSign to={to} amount={amount} setAmount={setAmount} onClose={onClose} />
      )}
    </div>
  )
}

/** Normal online transfer from the connected wallet. Lands in about a second. */
function PayNow({ to, amount, setAmount, onClose }: { to: string; amount: string; setAmount: (v: string) => void; onClose: () => void }) {
  const { address, isConnected, chainId } = useAccount()
  const { online } = useNet()
  const client = usePublicClient({ chainId: CHAIN.id })
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const [step, setStep] = useState<'wallet' | 'confirming' | null>(null)
  const [done, setDone] = useState<{ hash: `0x${string}`; amount: bigint } | null>(null)

  const balance = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN.id,
    query: { enabled: !!address && online, refetchInterval: 8000 },
  })

  const pay = async () => {
    if (!address || !client) return
    if (!isAddress(to) || to.toLowerCase() === zeroAddress) return toast.error('Enter a valid recipient address.')
    let raw: bigint
    try {
      raw = parseUsdc(amount)
    } catch {
      return toast.error('Enter a valid amount.')
    }
    if (raw <= 0n) return toast.error('Enter an amount above zero.')
    if (balance.data !== undefined && raw > balance.data) return toast.error('That is more than your wallet balance.')
    try {
      if (chainId !== CHAIN.id) await switchChainAsync({ chainId: CHAIN.id })
      setStep('wallet')
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [getAddress(to), raw],
        chainId: CHAIN.id,
      })
      setStep('confirming')
      const receipt = await client.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('The transfer reverted.')
      const item: StoredItem = {
        id: `online:${hash}`,
        source: 'signed',
        kind: 'online',
        from: address,
        to: getAddress(to),
        amount: raw.toString(),
        nonce: '0',
        deadline: '0',
        signature: '0x',
        createdAt: Date.now(),
        status: 'settled',
        txHash: hash,
      }
      addItem(item)
      setDone({ hash, amount: raw })
      void balance.refetch()
    } catch (e) {
      const msg = parseOnchainError(e)
      if (msg) toast.error(msg)
    } finally {
      setStep(null)
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="inner flex items-center gap-3 rounded-2xl p-4">
          <span className="flex size-10 items-center justify-center rounded-full" style={{ background: 'rgba(26,128,71,0.12)', color: 'var(--success)' }}>
            <Check className="size-5" />
          </span>
          <div className="text-sm">
            <div className="font-semibold" style={{ color: 'var(--success)' }}>
              Sent {fmtUsdc(done.amount)} USDC
            </div>
            <a
              href={buildTxExplorerUrl(CHAIN.id, done.hash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold"
              style={{ color: 'var(--accent-hover)' }}
            >
              View on explorer <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
        <PrimaryButton onClick={onClose}>Done</PrimaryButton>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <ConnectKitButton.Custom>
        {({ show }) => <PrimaryButton onClick={show}>Connect wallet to pay now</PrimaryButton>}
      </ConnectKitButton.Custom>
    )
  }

  if (!online) {
    return (
      <div className="inner flex items-center gap-2 rounded-2xl px-3 py-3 text-xs text-pretty" style={{ color: 'var(--ink-2)' }}>
        <WifiOff className="size-4 shrink-0" />
        You are offline. Switch to Sign offline to pay without a connection.
      </div>
    )
  }

  return (
    <>
      <AmountInput
        value={amount}
        onChange={setAmount}
        hint={balance.data === undefined ? undefined : `Wallet ${fmtUsdc(balance.data)} · Max`}
        onHint={balance.data && balance.data > 0n ? () => setAmount(formatUsdc(balance.data)) : undefined}
      />
      <PrimaryButton onClick={() => void pay()} loading={step !== null} disabled={!to || !amount}>
        {step === 'wallet' ? 'Confirm in wallet…' : step === 'confirming' ? 'Confirming on Arc Testnet…' : 'Pay now'}
      </PrimaryButton>
      <p className="text-center text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
        Paid straight from your wallet. The recipient has it in about a second, no waiting to settle.
      </p>
    </>
  )
}

/** Signs on the device with no network, then shows the code to hand over. */
function OfflineSign({ to, amount, setAmount, onClose }: { to: string; amount: string; setAmount: (v: string) => void; onClose: () => void }) {
  const { spendable } = useSpendable()
  const { online } = useNet()
  const [busy, setBusy] = useState(false)
  const [signed, setSigned] = useState<{ code: string; item: StoredItem } | null>(null)

  const sign = async () => {
    if (!isAddress(to) || to.toLowerCase() === zeroAddress) return toast.error('Enter a valid recipient address.')
    let raw: bigint
    try {
      raw = parseUsdc(amount)
    } catch {
      return toast.error('Enter a valid amount.')
    }
    setBusy(true)
    try {
      setSigned(await createSignedPayment(getAddress(to), raw, { spendable }))
    } catch (e) {
      toast.error(e instanceof PaymentBlocked ? e.message : 'Could not sign the payment.')
    } finally {
      setBusy(false)
    }
  }

  if (signed) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
          Signed on this phone for{' '}
          <b className="tabular-nums" style={{ color: 'var(--ink)' }}>
            {fmtUsdc(BigInt(signed.item.amount))} USDC
          </b>{' '}
          to <span className="mono">{shortAddress(signed.item.to)}</span>. Let the receiver scan this code. It can only ever pay that address.
        </p>
        <CodeShare code={signed.code} label="Signed payment QR code" />
        <PrimaryButton onClick={onClose}>Done</PrimaryButton>
      </div>
    )
  }

  return (
    <>
      {!online && (
        <div className="inner flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs" style={{ color: 'var(--ink-2)' }}>
          <WifiOff className="size-4 shrink-0" />
          You are offline. Signing still works.
        </div>
      )}
      <AmountInput
        value={amount}
        onChange={setAmount}
        hint={spendable === null ? 'Balance unknown' : `Offline balance ${fmtUsdc(spendable)} · Max`}
        onHint={spendable !== null && spendable > 0n ? () => setAmount(formatUsdc(spendable)) : undefined}
      />
      <PrimaryButton onClick={() => void sign()} loading={busy} disabled={!to || !amount}>
        Sign payment
      </PrimaryButton>
    </>
  )
}
