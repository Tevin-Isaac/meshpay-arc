import {
  bytesToHex,
  getAddress,
  hexToBytes,
  isAddress,
  isAddressEqual,
  numberToHex,
  parseAbi,
  recoverTypedDataAddress,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcTestnet } from 'viem/chains'
import { getUsdc } from '@/onchain-facts'

export const CHAIN = arcTestnet
export const MESHPAY_ADDRESS = import.meta.env.VITE_MESHPAY_ADDRESS as Address
export const USDC_ADDRESS = (getUsdc(CHAIN.id)?.address ?? '0x3600000000000000000000000000000000000000') as Address

/** Offline payments stay valid for 7 days so a courier has time to reach a connection. */
export const VOUCHER_TTL_SECONDS = 7 * 24 * 60 * 60

export const MESHPAY_ABI = parseAbi([
  'struct Payment { address from; address to; uint256 amount; uint256 nonce; uint256 deadline; }',
  'function deposit(address account, uint256 amount)',
  'function reserve(address) view returns (uint256)',
  'function check(Payment p, bytes signature) view returns (uint8)',
  'function settle(Payment p, bytes signature)',
  'function settleBatch(Payment[] ps, bytes[] sigs) returns (uint8[])',
  'event Settled(address indexed from, address indexed to, uint256 nonce, uint256 amount, address relayer)',
  'event Rejected(address indexed from, uint256 nonce, uint8 code)',
])

export interface Payment {
  from: Address
  to: Address
  amount: bigint
  nonce: bigint
  deadline: bigint
}

export interface Voucher {
  payment: Payment
  signature: Hex
}

const DOMAIN = {
  name: 'MeshPay',
  version: '1',
  chainId: CHAIN.id,
  verifyingContract: MESHPAY_ADDRESS,
} as const

const TYPES = {
  Payment: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export function randomNonce(): bigint {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return BigInt(bytesToHex(bytes))
}

/** Signs entirely on the device. No network access is involved. */
export async function signPayment(privateKey: Hex, payment: Payment): Promise<Hex> {
  return privateKeyToAccount(privateKey).signTypedData({
    domain: DOMAIN,
    types: TYPES,
    primaryType: 'Payment',
    message: payment,
  })
}

/** Recovers the signer without any network access. */
export async function signerOf(v: Voucher): Promise<Address> {
  return recoverTypedDataAddress({
    domain: DOMAIN,
    types: TYPES,
    primaryType: 'Payment',
    message: v.payment,
    signature: v.signature,
  })
}

export async function isSignatureValid(v: Voucher): Promise<boolean> {
  try {
    return isAddressEqual(await signerOf(v), v.payment.from)
  } catch {
    return false
  }
}

export function voucherId(p: Pick<Payment, 'from' | 'nonce'>): string {
  return `${p.from.toLowerCase()}:${p.nonce.toString()}`
}

// ---- compact wire format: 138 bytes, base64url, fits a single QR code ----

const VOUCHER_PREFIX = 'mp1:'
const VOUCHER_BYTES = 138

function toB64Url(bytes: Uint8Array): string {
  let s = ''
  bytes.forEach((b) => {
    s += String.fromCharCode(b)
  })
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Url(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function uint(n: bigint, size: number): Uint8Array {
  return hexToBytes(numberToHex(n, { size }))
}

export function encodeVoucher(v: Voucher): string {
  const p = v.payment
  const bytes = new Uint8Array(VOUCHER_BYTES)
  bytes[0] = 1
  bytes.set(hexToBytes(p.from), 1)
  bytes.set(hexToBytes(p.to), 21)
  bytes.set(uint(p.amount, 16), 41)
  bytes.set(uint(p.nonce, 8), 57)
  bytes.set(uint(p.deadline, 8), 65)
  bytes.set(hexToBytes(v.signature), 73)
  return VOUCHER_PREFIX + toB64Url(bytes)
}

export function isVoucherCode(text: string): boolean {
  return text.trim().startsWith(VOUCHER_PREFIX)
}

export function decodeVoucher(text: string): Voucher {
  const raw = text.trim()
  if (!raw.startsWith(VOUCHER_PREFIX)) throw new Error('Not a MeshPay payment code.')
  const bytes = fromB64Url(raw.slice(VOUCHER_PREFIX.length))
  if (bytes.length !== VOUCHER_BYTES || bytes[0] !== 1) throw new Error('Unsupported or damaged payment code.')
  const at = (from: number, to: number) => bytesToHex(bytes.slice(from, to))
  return {
    payment: {
      from: getAddress(at(1, 21)),
      to: getAddress(at(21, 41)),
      amount: BigInt(at(41, 57)),
      nonce: BigInt(at(57, 65)),
      deadline: BigInt(at(65, 73)),
    },
    signature: at(73, 138),
  }
}

// ---- payment requests: what a receiver shows so the payer can scan an address ----

const REQUEST_PREFIX = 'meshpay:'

export function encodeRequest(address: Address, amount?: string): string {
  return `${REQUEST_PREFIX}${address}${amount ? `?amount=${encodeURIComponent(amount)}` : ''}`
}

export function parseRequest(text: string): { address: Address; amount?: string } | null {
  const raw = text.trim()
  if (!raw.startsWith(REQUEST_PREFIX)) return null
  const [addr, query] = raw.slice(REQUEST_PREFIX.length).split('?')
  if (!isAddress(addr)) return null
  const amount = query ? new URLSearchParams(query).get('amount') ?? undefined : undefined
  return { address: getAddress(addr), amount }
}

/** Reject codes returned by the MeshPay contract. */
export const REJECT_LABELS: Record<number, string> = {
  1: 'Invalid payment',
  2: 'Expired',
  3: 'Already settled',
  4: 'Bad signature',
  5: 'Payer reserve too low',
  6: 'Transfer failed',
}
