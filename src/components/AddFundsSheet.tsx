import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { unsafeRecipient } from '@/lib/guard'
import { createWalletClient, erc20Abi, getAddress, http, isAddress, zeroAddress } from 'viem'
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { ExternalLink, Landmark } from 'lucide-react'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { CHAIN, MESHPAY_ABI, MESHPAY_ADDRESS, USDC_ADDRESS, WITHDRAW_DELAY_SECONDS } from '@/lib/mesh'
import { fmtExact, shortAddress } from '@/lib/format'
import { parseOnchainError } from '@/lib/errors'
import { createSignedPayment, PaymentBlocked } from '@/lib/pay'
import { useNet } from '@/lib/net'
import { getDeviceAccount } from '@/lib/store'
import { useDevice, useDeviceUsdc, useSpendable } from '@/hooks/useMeshData'
import { IS_MAINNET, NETWORK_LABEL, FAUCET_URL } from '@/lib/network'
import { showUsdc } from '@/lib/balance'
import { copyAddress } from './FaucetCard'
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
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl font-semibold"
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

/** Withdraw the offline reserve back to this wallet: request, wait the contract's delay, then finalize. */
function WithdrawReserve() {
  const device = useDevice()
  const client = usePublicClient({ chainId: CHAIN.id })
  const { spendable, reserve } = useSpendable()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const req = useReadContract({
    address: MESHPAY_ADDRESS,
    abi: MESHPAY_ABI,
    functionName: 'withdrawalRequest',
    args: [device.address],
    chainId: CHAIN.id,
    query: { refetchInterval: 8000 },
  })
  const [pending, unlockAt] = req.data ?? [0n, 0n]
  const now = BigInt(Math.floor(Date.now() / 1000))
  const unlocked = pending > 0n && now >= unlockAt
  const hours = Math.ceil(WITHDRAW_DELAY_SECONDS / 3600)

  const act = async (fn: 'requestWithdraw' | 'cancelWithdraw' | 'finalizeWithdraw') => {
    if (!client) return
    setBusy(true)
    try {
      const wallet = createWalletClient({ account: getDeviceAccount(), chain: CHAIN, transport: http() })
      const hash =
        fn === 'requestWithdraw'
          ? await wallet.writeContract({ address: MESHPAY_ADDRESS, abi: MESHPAY_ABI, functionName: fn, args: [parseUsdc(amount)] })
          : await wallet.writeContract({ address: MESHPAY_ADDRESS, abi: MESHPAY_ABI, functionName: fn })
      await client.waitForTransactionReceipt({ hash })
      toast.success(fn === 'requestWithdraw' ? `Withdrawal requested. It unlocks in about ${hours} h.` : fn === 'cancelWithdraw' ? 'Withdrawal cancelled.' : 'Withdrawn to your wallet.')
      setAmount('')
      void req.refetch()
      void reserve.refetch()
    } catch (e) {
      const msg = parseOnchainError(e)
      if (msg) toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-2xl p-4" style={{ border: '1px solid var(--border)' }}>
      <div className="text-sm font-semibold">Withdraw reserve to this wallet</div>
      <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        Request, wait about {hours} h (the reserve stays spendable meanwhile), then finalize. The money lands in this wallet's own balance.
      </p>
      {pending > 0n ? (
        <>
          <div className="inner rounded-xl p-3 text-xs">
            Requested {fmtExact(pending)} USDC.{' '}
            {unlocked ? 'Ready to finalize.' : `Unlocks ${new Date(Number(unlockAt) * 1000).toLocaleString()}.`}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <GhostButton onClick={() => void act('cancelWithdraw')} disabled={busy}>
              Cancel
            </GhostButton>
            <PrimaryButton onClick={() => void act('finalizeWithdraw')} disabled={!unlocked} loading={busy}>
              Finalize
            </PrimaryButton>
          </div>
        </>
      ) : (
        <>
          <AmountInput
            value={amount}
            onChange={setAmount}
            hint={spendable === null ? undefined : `Offline reserve ${fmtExact(spendable)} · Max`}
            onHint={spendable && spendable > 0n ? () => setAmount(formatUsdc(spendable)) : undefined}
          />
          <PrimaryButton onClick={() => void act('requestWithdraw')} disabled={!amount} loading={busy}>
            Request withdrawal
          </PrimaryButton>
        </>
      )}
    </div>
  )
}

type Step = 'approve' | 'deposit' | 'cashout' | null

/** Keep a little USDC on the device key so it can still pay a network fee. */
const DEVICE_KEEP = 100_000n

export function AddFundsSheet({ open, onClose, initialTab = 'add' }: { open: boolean; onClose: () => void; initialTab?: 'add' | 'cashout' }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add funds">
      <AddFundsBody initialTab={initialTab} />
    </Sheet>
  )
}

function AddFundsBody({ initialTab }: { initialTab: 'add' | 'cashout' }) {
  const device = useDevice()
  const { address, isConnected, chainId } = useAccount()
  const client = usePublicClient({ chainId: CHAIN.id })
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const { online } = useNet()
  const deviceUsdc = useDeviceUsdc()
  const { spendable, reserve } = useSpendable()
  const { settle } = useSettle()
  const [tab, setTab] = useState<'add' | 'cashout'>(initialTab)
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
      toast.success(`Added ${fmtExact(raw)} USDC to your offline balance.`)
      setAmount('')
      refresh()
    } catch (e) {
      fail(e)
    } finally {
      setStep(null)
    }
  }

  /** Move USDC from the built-in wallet into the offline reserve with the device key: approve, then deposit. */
  const addFromDevice = async () => {
    if (!client) return
    try {
      const raw = parseUsdc(amount)
      if (raw <= 0n) return toast.error('Enter an amount above zero.')
      if (raw + DEVICE_KEEP > deviceUsdc.raw) return toast.error(`Keep about ${fmtExact(DEVICE_KEEP)} USDC in your wallet for network fees.`)
      const wallet = createWalletClient({ account: getDeviceAccount(), chain: CHAIN, transport: http() })
      setStep('approve')
      const approveHash = await wallet.writeContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [MESHPAY_ADDRESS, raw] })
      await client.waitForTransactionReceipt({ hash: approveHash })
      setStep('deposit')
      const hash = await wallet.writeContract({ address: MESHPAY_ADDRESS, abi: MESHPAY_ABI, functionName: 'deposit', args: [device.address, raw] })
      await client.waitForTransactionReceipt({ hash })
      toast.success(`Moved ${fmtExact(raw)} USDC into your offline reserve.`)
      setAmount('')
      refresh()
    } catch (e) {
      fail(e)
    } finally {
      setStep(null)
    }
  }

  const cashOut = async () => {
    if (dest && (!isAddress(dest) || dest.toLowerCase() === zeroAddress)) return toast.error('Enter a valid address.')
    if (!dest && !address) return toast.error('Paste the address to send to: an exchange, an off-ramp or another wallet.')
    const unsafeDest = dest ? unsafeRecipient(dest) : null
    if (unsafeDest) return toast.error(unsafeDest)
    try {
      const raw = parseUsdc(amount)
      const target = dest ? getAddress(dest) : address!
      const toSelf = !!address && target.toLowerCase() === address.toLowerCase()
      setStep('cashout')
      const { item } = await createSignedPayment(target, raw, { kind: toSelf ? 'cashout' : undefined, spendable: spendable })
      const result = await settle([item])
      if (result.settled > 0) {
        toast.success(`Sent ${fmtExact(raw)} USDC to ${toSelf ? 'your connected wallet' : shortAddress(target)}.`)
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
  const walletKnown = deviceUsdc.known
  const maxMove = walletKnown !== null && deviceUsdc.live && walletKnown > DEVICE_KEEP ? walletKnown - DEVICE_KEEP : 0n

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl p-1" style={{ background: 'var(--surface-muted)' }}>
        {(['add', 'cashout'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              setAmount('')
            }}
            className="min-h-10 rounded-xl text-xs font-semibold"
            style={{
              background: tab === t ? 'var(--surface-strong)' : 'transparent',
              color: tab === t ? 'var(--ink)' : 'var(--muted)',
              boxShadow: tab === t ? 'var(--seg-shadow)' : 'none',
            }}
          >
            {t === 'add' ? 'Add funds' : 'Cash out'}
          </button>
        ))}
      </div>

      {tab === 'add' ? (
        <>
          <div className="inner space-y-1 rounded-2xl p-4 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--muted)' }}>In wallet</span>
              <span className="font-semibold tabular-nums">{showUsdc(walletKnown, fmtExact)} USDC</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--muted)' }}>Offline reserve</span>
              <span className="font-semibold tabular-nums">{showUsdc(spendable, fmtExact)} USDC</span>
            </div>
          </div>

          <div className="space-y-2 rounded-2xl p-4" style={{ border: '1px solid var(--border)' }}>
            <div className="text-sm font-semibold">{IS_MAINNET ? 'Add USDC to this wallet' : 'Get test USDC'}</div>
            <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
              {IS_MAINNET
                ? 'Copy your address and send USDC on Arc to it from an exchange or another wallet.'
                : `Free test USDC from Circle: choose ${NETWORK_LABEL}, paste your address and request.`}
            </p>
            <div className="flex gap-2">
              <GhostButton className="flex-1" onClick={() => copyAddress(device.address, 'Address copied.')}>
                Copy my address
              </GhostButton>
              {FAUCET_URL && (
                <a
                  href={FAUCET_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  Open faucet <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold">Move wallet balance into offline reserve</div>
            <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
              The reserve is what you can spend with no internet. Moving needs a connection and a little USDC for the network fee.
            </p>
            {!online ? (
              <div className="inner rounded-2xl p-4 text-sm" style={{ color: 'var(--ink-2)' }}>
                You are offline. Come back when you have a connection.
              </div>
            ) : (
              <>
                <AmountInput
                  value={amount}
                  onChange={setAmount}
                  hint={walletKnown === null ? undefined : `In wallet ${fmtExact(walletKnown)} · Max`}
                  onHint={maxMove > 0n ? () => setAmount(formatUsdc(maxMove)) : undefined}
                />
                <PrimaryButton onClick={() => void addFromDevice()} loading={busy} disabled={!amount}>
                  {busy ? stepLabel : 'Move to offline reserve'}
                </PrimaryButton>
              </>
            )}
          </div>

          <details className="rounded-2xl p-4" style={{ border: '1px solid var(--border)' }}>
            <summary className="min-h-8 cursor-pointer text-sm font-semibold">Add from a connected wallet (optional)</summary>
            <div className="mt-3 space-y-3">
              {!isConnected ? (
                <>
                  <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
                    Not needed. Connect only if you prefer to top up from MetaMask or a wallet app. External wallets bring their own risks.
                  </p>
                  <ConnectKitButton.Custom>{({ show }) => <GhostButton className="w-full" onClick={show}>Connect an external wallet</GhostButton>}</ConnectKitButton.Custom>
                </>
              ) : online ? (
                <>
                  <AmountInput
                    value={amount}
                    onChange={setAmount}
                    hint={walletBalance.data !== undefined ? `Connected wallet ${fmtExact(walletBalance.data)} · Max` : undefined}
                    onHint={walletBalance.data && walletBalance.data > 0n ? () => setAmount(formatUsdc(walletBalance.data!)) : undefined}
                  />
                  <PrimaryButton onClick={() => void addFromWallet()} loading={busy} disabled={!amount}>
                    {busy ? stepLabel : 'Add from connected wallet'}
                  </PrimaryButton>
                </>
              ) : (
                <p className="text-xs">You are offline.</p>
              )}
            </div>
          </details>
        </>
      ) : (
        <>
          <p className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>
            Send your offline reserve to an exchange, an off-ramp deposit address or another wallet. For M-Pesa use the M-Pesa row in Settings. Needs a connection and a little USDC for the network fee.
          </p>
          {!online ? (
            <div className="inner rounded-2xl p-4 text-sm" style={{ color: 'var(--ink-2)' }}>
              You are offline. Come back when you have a connection.
            </div>
          ) : (
            <>
              <AmountInput
                value={amount}
                onChange={setAmount}
                hint={spendable === null ? undefined : `Offline reserve ${fmtExact(spendable)} · Max`}
                onHint={spendable && spendable > 0n ? () => setAmount(formatUsdc(spendable)) : undefined}
              />
              <BankCashOut />
              <input
                value={dest}
                onChange={(e) => setDest(e.target.value.trim())}
                placeholder={address ? 'Send to (optional): 0x… or leave empty for your connected wallet' : 'Send to: 0x… address'}
                spellCheck={false}
                aria-label="Destination address"
                className="inner mono min-h-12 w-full rounded-2xl px-4 text-xs outline-none"
              />
              <PrimaryButton onClick={() => void cashOut()} loading={busy} disabled={!amount}>
                {busy ? stepLabel : 'Cash out'}
              </PrimaryButton>
              <WithdrawReserve />
            </>
          )}
        </>
      )}
    </div>
  )
}
