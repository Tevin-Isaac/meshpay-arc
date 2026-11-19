import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { erc20Abi, getAddress, isAddress, zeroAddress } from 'viem'
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { Check, ExternalLink, WifiOff } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { fmtUsdc } from '@/lib/format'
import { parseOnchainError } from '@/lib/errors'
import { CHAIN, USDC_ADDRESS, ZERO_REF } from '@/lib/mesh'
import { useNet } from '@/lib/net'
import { addItem } from '@/lib/store'
import { AmountInput, PrimaryButton } from './ui'

/** Normal online transfer from the connected wallet. Lands in about a second. */
export function PayNowForm({ to, amount, setAmount, onClose }: { to: string; amount: string; setAmount: (v: string) => void; onClose: () => void }) {
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
      addItem({
        id: `online:${hash}`,
        source: 'signed',
        kind: 'online',
        from: address,
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
    return <ConnectKitButton.Custom>{({ show }) => <PrimaryButton onClick={show}>Connect wallet to pay now</PrimaryButton>}</ConnectKitButton.Custom>
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
