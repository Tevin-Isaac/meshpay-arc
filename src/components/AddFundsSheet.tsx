import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { createWalletClient, erc20Abi, getAddress, http, isAddress, zeroAddress } from 'viem'
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { ExternalLink, Landmark } from 'lucide-react'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { CHAIN, MESHPAY_ABI, MESHPAY_ADDRESS, USDC_ADDRESS } from '@/lib/mesh'
import { fmtUsdc, shortAddress } from '@/lib/format'
import { parseOnchainError } from '@/lib/errors'
import { createSignedPayment, PaymentBlocked } from '@/lib/pay'
import { useNet } from '@/lib/net'
import { getDeviceAccount } from '@/lib/store'
import { useDevice, useDeviceUsdc, useSpendable } from '@/hooks/useMeshData'
import { useSettle } from '@/hooks/useSettle'
import { AmountInput, GhostButton, PrimaryButton, Sheet } from './ui'

const OFFRAMP_URL = import.meta.env.VITE_OFFRAMP_URL as string | undefined

/** Turning USDC into bank money needs a licensed provider. The app sends USDC to the deposit address they give you. */
function BankCashOut() {
  return (
    <div className="inner space-y-2 rounded-2xl p-4 text-xs text-pretty" style={{ color: 'var(--ink-2)' }}>
      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
        <Landmark className="size-4" /> Cash out to a bank
      </div>
      <ol className="list-decimal space-y-1 pl-4">
        <li>Open your off-ramp or exchange and start a sale of USDC on Arc.</li>
        <li>Copy the deposit address it shows you.</li>
        <li>Paste it below, enter the amount, and send.</li>
      </ol>
      {OFFRAMP_URL ? (
        <a
          href={OFFRAMP_URL}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-white font-semibold"
          style={{ border: '1px solid var(--border)', color: 'var(--ink)' }}
        >
          Open off-ramp <ExternalLink className="size-3.5" />
        </a>
      ) : (
        <p style={{ color: 'var(--subtle)' }}>Use any exchange or off-ramp that accepts USDC on Arc. Only send to an address that supports Arc.</p>
      )}
    </div>
  )
}

type Step = 'approve' | 'deposit' | 'cashout' | null

/** Keep a little USDC on the device key so it can still pay a network fee. */
const DEVICE_KEEP = 100_000n
const DEVICE_MIN_MOVE = 200_000n

export function AddFundsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Offline balance">
      <AddFundsBody />
    </Sheet>
  )
}

function AddFundsBody() {
  const device = useDevice()
  const { address, isConnected, chainId } = useAccount()
  const client = usePublicClient({ chainId: CHAIN.id })
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const { online } = useNet()
  const deviceUsdc = useDeviceUsdc()
  const { spendable, reserve } = useSpendable()
  const { settle } = useSettle()
  const [tab, setTab] = useState<'add' | 'cashout'>('add')
  const [amount, setAmount] = useState('')
  const [dest, setDest] = useState('')
  const [step, setStep] = useState<Step>(null)

  const walletBalance = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN.id,
    query: { enabled: !!address && online, refetchInterval: 8000 },
  })

  const fail = (e: unknown) => {
    const msg = e instanceof PaymentBlocked ? e.message : parseOnchainError(e)
    if (msg) toast.error(msg)
  }

  const refresh = () => {
    void reserve.refetch()
    void deviceUsdc.refetch()
    void walletBalance.refetch()
  }

  const addFromWallet = async () => {
    if (!client || !address) return
    try {
      const raw = parseUsdc(amount)
      if (raw <= 0n) return toast.error('Enter an amount above zero.')
      if (chainId !== CHAIN.id) await switchChainAsync({ chainId: CHAIN.id })
      const allowance = await client.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, MESHPAY_ADDRESS],
      })
      if (allowance < raw) {
        setStep('approve')
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [MESHPAY_ADDRESS, raw],
          chainId: CHAIN.id,
        })
        await client.waitForTransactionReceipt({ hash: approveHash })
      }
      setStep('deposit')
      const hash = await writeContractAsync({
        address: MESHPAY_ADDRESS,
        abi: MESHPAY_ABI,
        functionName: 'deposit',
        args: [device.address, raw],
        chainId: CHAIN.id,
      })
      await client.waitForTransactionReceipt({ hash })
      toast.success(`Added ${fmtUsdc(raw)} USDC to your offline balance.`)
      setAmount('')
      refresh()
    } catch (e) {
      fail(e)
    } finally {
      setStep(null)
    }
  }

  const addFromDevice = async () => {
    if (!client) return
    const raw = deviceUsdc.raw - DEVICE_KEEP
    try {
      const wallet = createWalletClient({ account: getDeviceAccount(), chain: CHAIN, transport: http() })
      setStep('approve')
      const approveHash = await wallet.writeContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [MESHPAY_ADDRESS, raw],
      })
      await client.waitForTransactionReceipt({ hash: approveHash })
      setStep('deposit')
      const hash = await wallet.writeContract({
        address: MESHPAY_ADDRESS,
        abi: MESHPAY_ABI,
        functionName: 'deposit',
        args: [device.address, raw],
      })
      await client.waitForTransactionReceipt({ hash })
      toast.success(`Moved ${fmtUsdc(raw)} USDC into your offline balance.`)
      refresh()
    } catch (e) {
      fail(e)
    } finally {
      setStep(null)
    }
  }

  const cashOut = async () => {
    if (!address) return
    if (dest && (!isAddress(dest) || dest.toLowerCase() === zeroAddress)) return toast.error('Enter a valid address, or leave it empty to use your wallet.')
    try {
      const raw = parseUsdc(amount)
      const target = dest ? getAddress(dest) : address
      const toSelf = target.toLowerCase() === address.toLowerCase()
      setStep('cashout')
      const { item } = await createSignedPayment(target, raw, { kind: toSelf ? 'cashout' : undefined, spendable: spendable })
      const result = await settle([item])
      if (result.settled > 0) {
        toast.success(`Sent ${fmtUsdc(raw)} USDC to ${toSelf ? 'your wallet' : shortAddress(target)}.`)
        setAmount('')
        refresh()
      } else {
        toast.error('The payment is saved but did not settle yet. Try again from Waiting to settle.')
      }
    } catch (e) {
      fail(e)
    } finally {
      setStep(null)
    }
  }

  const busy = step !== null
  const stepLabel = step === 'approve' ? 'Approve USDC…' : step === 'deposit' ? 'Depositing…' : step === 'cashout' ? 'Settling…' : ''
  const cashHint = spendable === null ? undefined : `Offline balance ${fmtUsdc(spendable)} · Max`
  const addHint = walletBalance.data !== undefined ? `Wallet ${fmtUsdc(walletBalance.data)} · Max` : undefined
  const hint = tab === 'add' ? addHint : cashHint
  const maxValue = tab === 'add' ? walletBalance.data : spendable

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl p-1" style={{ background: 'var(--surface-muted)' }}>
          {(['add', 'cashout'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="min-h-10 rounded-xl text-xs font-semibold"
              style={{
                background: tab === t ? 'white' : 'transparent',
                color: tab === t ? 'var(--ink)' : 'var(--muted)',
                boxShadow: tab === t ? '0 1px 3px rgba(18,45,69,0.12)' : 'none',
              }}
            >
              {t === 'add' ? 'Add funds' : 'Cash out'}
            </button>
          ))}
        </div>

        <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
          {tab === 'add'
            ? 'Move USDC from your wallet into the balance this phone can spend with no internet. You can only add while online.'
            : 'Send your offline balance to your wallet, or to an exchange or off-ramp deposit address to turn it into cash. Needs a connection.'}
        </p>

        {!isConnected ? (
          <ConnectKitButton.Custom>
            {({ show }) => <PrimaryButton onClick={show}>Connect wallet</PrimaryButton>}
          </ConnectKitButton.Custom>
        ) : !online ? (
          <div className="inner rounded-2xl p-4 text-sm" style={{ color: 'var(--ink-2)' }}>
            You are offline. Come back when you have a connection.
          </div>
        ) : (
          <>
            <AmountInput
              value={amount}
              onChange={setAmount}
              hint={hint}
              onHint={maxValue && maxValue > 0n ? () => setAmount(formatUsdc(maxValue)) : undefined}
            />
            {tab === 'cashout' && <BankCashOut />}
            {tab === 'cashout' && (
              <input
                value={dest}
                onChange={(e) => setDest(e.target.value.trim())}
                placeholder="Send to (optional): 0x… or leave empty for your wallet"
                spellCheck={false}
                aria-label="Destination address"
                className="inner mono min-h-12 w-full rounded-2xl px-4 text-xs outline-none"
              />
            )}
            <PrimaryButton onClick={() => void (tab === 'add' ? addFromWallet() : cashOut())} loading={busy} disabled={!amount}>
              {busy ? stepLabel : tab === 'add' ? 'Add to offline balance' : dest ? 'Cash out to address' : 'Cash out to wallet'}
            </PrimaryButton>
            {tab === 'add' && walletBalance.data === 0n && (
              <p className="text-center text-xs" style={{ color: 'var(--subtle)' }}>
                No test USDC yet? Use Get test USDC in the Arc Studio sidebar.
              </p>
            )}
          </>
        )}

        {deviceUsdc.raw >= DEVICE_MIN_MOVE && online && tab === 'add' && (
          <div className="inner space-y-2 rounded-2xl p-4">
            <div className="text-sm font-semibold">Received on this device</div>
            <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
              {fmtUsdc(deviceUsdc.raw)} USDC arrived at this phone. Move it into your offline balance so you can spend it with no internet.
            </p>
            <GhostButton className="w-full" onClick={() => void addFromDevice()} disabled={busy}>
              Move {fmtUsdc(deviceUsdc.raw - DEVICE_KEEP)} USDC
            </GhostButton>
          </div>
        )}
      </div>
    </>
  )
}
