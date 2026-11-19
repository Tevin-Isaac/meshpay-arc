import { useState } from 'react'
import { createWalletClient, erc20Abi, getAddress, http, isAddress, zeroAddress } from 'viem'
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { Check, ExternalLink, WifiOff } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { fmtExact } from '@/lib/format'
import { parseOnchainError } from '@/lib/errors'
import { CHAIN, USDC_ADDRESS, ZERO_REF } from '@/lib/mesh'
import { groupAddress, lookalike, unsafeRecipient } from '@/lib/guard'
import { useNet } from '@/lib/net'
import { addItem, getDeviceAccount, useMeshState } from '@/lib/store'
import { GAS_BUFFER, maxOnline } from '@/lib/balance'
import { useDeviceUsdc } from '@/hooks/useMeshData'
import { AmountInput, GhostButton, PrimaryButton } from './ui'

/**
 * Normal online transfer. Paid from this device's own wallet by default; a connected external wallet is an
 * optional second source. Lands in about a second.
 */
export function PayNowForm({ to, amount, setAmount, onClose }: { to: string; amount: string; setAmount: (v: string) => void; onClose: () => void }) {
  const { address, isConnected, chainId } = useAccount()
  const { online } = useNet()
  const client = usePublicClient({ chainId: CHAIN.id })
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const [step, setStep] = useState<'wallet' | 'confirming' | null>(null)
  const [source, setSource] = useState<'device' | 'external'>('device')
  const device = useDeviceUsdc()
  const external = isConnected && !!address
  const from = source === 'external' && external ? 'external' : 'device'
  const [done, setDone] = useState<{ hash: `0x${string}`; amount: bigint } | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const { contacts, items } = useMeshState()
  const contact = isAddress(to) ? contacts.find((c) => c.address.toLowerCase() === to.toLowerCase()) : undefined
  const known = [...contacts.map((c) => c.address), ...items.map((i) => i.to)]
  const similar = isAddress(to) ? lookalike(to, known) : null

  const extBalance = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN.id,
    query: { enabled: !!address && online, refetchInterval: 8000 },
  })
  // The balance the payment draws on, and the largest amount that still leaves the fee.
  const balance = {
    data: from === 'external' ? extBalance.data : device.live ? device.raw : undefined,
    refetch: () => (from === 'external' ? extBalance.refetch() : device.refetch()),
  }
  const maxAmount = from === 'external' ? balance.data : balance.data === undefined ? undefined : maxOnline(balance.data)

  const check = (): bigint | null => {
    if (!isAddress(to) || to.toLowerCase() === zeroAddress) {
      toast.error('Enter a valid recipient address.')
      return null
    }
    const unsafe = unsafeRecipient(to)
    if (unsafe) {
      toast.error(unsafe)
      return null
    }
    let raw: bigint
    try {
      raw = parseUsdc(amount)
    } catch {
      toast.error('Enter a valid amount.')
      return null
    }
    if (raw <= 0n) {
      toast.error('Enter an amount above zero.')
      return null
    }
    if (balance.data !== undefined && raw > balance.data) {
      toast.error('That is more than your wallet balance.')
      return null
    }
    if (from === 'device' && balance.data !== undefined && raw + GAS_BUFFER > balance.data) {
      toast.error(`Keep about ${fmtExact(GAS_BUFFER)} USDC for the network fee. Send a little less.`)
      return null
    }
    return raw
  }

  const pay = async () => {
    if (!client) return
    const raw = check()
    if (raw === null) return
    try {
      let hash: `0x${string}`
      let payer: `0x${string}`
      if (from === 'external' && address) {
        payer = address
        if (chainId !== CHAIN.id) await switchChainAsync({ chainId: CHAIN.id })
        setStep('wallet')
        hash = await writeContractAsync({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'transfer', args: [getAddress(to), raw], chainId: CHAIN.id })
      } else {
        // The built-in wallet signs with the device key. No external wallet is involved.
        const account = getDeviceAccount()
        payer = account.address
        setStep('confirming')
        const wallet = createWalletClient({ account, chain: CHAIN, transport: http() })
        hash = await wallet.writeContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'transfer', args: [getAddress(to), raw] })
      }
      setStep('confirming')
      const receipt = await client.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('The transfer reverted.')
      addItem({
        id: `online:${hash}`,
        source: 'signed',
        kind: 'online',
        from: payer,
        to: getAddress(to),
        amount: raw.toString(),
        fee: '0',
        nonce: '0',
        deadline: '0',
        ref: ZERO_REF,
        signature: '0x',
        createdAt: Date.now(),
        status: 'settled',
        txHash: hash,
      })
      setDone({ hash, amount: raw })
      void balance.refetch()
    } catch (e) {
      const msg = parseOnchainError(e)
      if (msg) toast.error(msg)
    } finally {
      setStep(null)
      setReviewing(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="inner flex items-center gap-3 rounded-2xl p-4">
          <span className="flex size-10 items-center justify-center rounded-full" style={{ background: 'var(--tint-accent)', color: 'var(--success)' }}>
            <Check className="size-5" />
          </span>
          <div className="text-sm">
            <div className="font-semibold" style={{ color: 'var(--success)' }}>
              Sent {fmtExact(done.amount)} USDC
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
      {external && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
          <span>Pay from</span>
          <button
            onClick={() => setSource(from === 'device' ? 'external' : 'device')}
            className="inner min-h-9 rounded-full px-3 font-semibold"
            style={{ color: 'var(--ink)' }}
            aria-label={from === 'device' ? 'Pay from connected wallet instead' : 'Pay from this wallet instead'}
          >
            {from === 'device' ? 'This wallet · Pay from connected wallet instead' : 'Connected wallet · Use this wallet instead'}
          </button>
        </div>
      )}
      <AmountInput
        value={amount}
        onChange={setAmount}
        hint={balance.data === undefined ? undefined : `${from === 'external' ? 'Connected wallet' : 'In wallet'} ${fmtExact(balance.data)} · Max`}
        onHint={maxAmount && maxAmount > 0n ? () => setAmount(formatUsdc(maxAmount)) : undefined}
      />
      {from === 'device' && (
        <p className="text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
          {balance.data !== undefined && balance.data <= GAS_BUFFER
            ? 'Your wallet has too little USDC to pay now. Add some from Add, or use Sign offline from your reserve.'
            : `The network fee is paid in USDC from your wallet (keep about ${fmtExact(GAS_BUFFER)}).`}
        </p>
      )}
      {reviewing ? (
        <div className="space-y-3">
          <div className="inner space-y-2 rounded-2xl p-4 text-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--subtle)' }}>
              You are paying {contact ? contact.name : 'a new address'}
            </div>
            <div className="mono break-words text-xs leading-relaxed">{isAddress(to) ? groupAddress(to) : to}</div>
            <div className="display text-2xl font-bold tabular-nums">{amount} USDC</div>
          </div>
          {similar && (
            <p className="rounded-xl p-3 text-xs font-semibold text-pretty" style={{ background: 'var(--tint-danger)', color: 'var(--danger)' }}>
              This address looks almost like {groupAddress(similar)} but is different. This is a common trick. Only continue if you are sure.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <GhostButton onClick={() => setReviewing(false)} disabled={step !== null}>
              Back
            </GhostButton>
            <PrimaryButton onClick={() => void pay()} loading={step !== null}>
              {step === 'wallet' ? 'Confirm in your connected wallet…' : step === 'confirming' ? 'Confirming…' : 'Confirm and pay'}
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <PrimaryButton
          onClick={() => {
            if (check() !== null) setReviewing(true)
          }}
          disabled={!to || !amount}
        >
          Review payment
        </PrimaryButton>
      )}
      <p className="text-center text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
        Paid straight from your wallet. The recipient has it in about a second, no waiting to settle.
      </p>
    </>
  )
}
