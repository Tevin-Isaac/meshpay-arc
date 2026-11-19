import { useSyncExternalStore } from 'react'
import type { Address, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  PBKDF2_ITERATIONS,
  clearFailures,
  deriveKey,
  fromB64,
  lockoutRemaining,
  open,
  pinProblem,
  randomBytes,
  recordFailure,
  seal,
  toB64,
} from './vault'

export type ItemStatus = 'pending' | 'settled' | 'duplicate' | 'expired' | 'invalid'

export interface StoredItem {
  id: string
  /** `signed` was created on this device; `received` arrived by QR, pasted code or chat. */
  source: 'signed' | 'received'
  /** `cashout`: reserve to the user's own wallet. `online`: paid straight from the wallet. Neither counts against device limits. */
  kind?: 'cashout' | 'online'
  from: Address
  to: Address
  amount: string
  fee: string
  nonce: string
  deadline: string
  ref: Hex
  signature: Hex
  createdAt: number
  status: ItemStatus
  txHash?: Hex
  note?: string
  /** A received payment above the user's offline acceptance limit. */
  risky?: boolean
}

export interface Policy {
  perTx: string
  daily: string
}

export interface Contact {
  address: Address
  name: string
  /** Compressed secp256k1 public key, used to encrypt messages to this person. */
  pubkey: Hex
  verified: boolean
  addedAt: number
  /** A stranger who wrote first. Stays in the requests folder until accepted. */
  request?: boolean
}

export interface ChatMessage {
  id: string
  peer: Address
  dir: 'in' | 'out'
  kind: 'text' | 'payment' | 'request'
  text?: string
  amount?: string
  ref?: Hex
  voucherId?: string
  ts: number
  status: 'queued' | 'sent' | 'received'
  /** Sealed offline code for an outgoing message, so it can be handed over without a connection. */
  code?: string
}

/** A sealed message this phone is carrying for someone else. */
export interface Carried {
  id: string
  code: string
  at: number
  published: boolean
}

export interface Standing {
  id: string
  to: Address
  name?: string
  amount: string
  every: 'daily' | 'weekly' | 'monthly'
  next: number
  active: boolean
  note?: string
  paid: number
  /** Mandate limits: stop after this time or once this much USDC has been paid in total. */
  until?: number
  maxTotal?: string
  paidTotal?: string
}

export interface AuditEntry {
  ts: number
  text: string
  tone?: 'good' | 'warn' | 'bad'
}

export interface Invoice {
  ref: Hex
  amount?: string
  note?: string
  createdAt: number
  status: 'open' | 'received' | 'settled'
  voucherId?: string
}

export interface Settings {
  autoLockMinutes: number
  hideBalances: boolean
  /** Largest payment this phone accepts offline without warning. */
  acceptLimit: string
  tip: string
  relays: string[]
}

export interface Data {
  policy: Policy
  items: StoredItem[]
  reserveCache: { raw: string; at: number } | null
  contacts: Contact[]
  messages: ChatMessage[]
  carried: Carried[]
  standing: Standing[]
  invoices: Invoice[]
  settings: Settings
  relaySince: number
  audit: AuditEntry[]
}

export const DEFAULT_RELAYS = ['wss://nos.lol', 'wss://relay.primal.net']

function emptyData(): Data {
  return {
    policy: { perTx: '50', daily: '200' },
    items: [],
    reserveCache: null,
    contacts: [],
    messages: [],
    carried: [],
    standing: [],
    invoices: [],
    settings: { autoLockMinutes: 2, hideBalances: false, acceptLimit: '25', tip: '0', relays: DEFAULT_RELAYS },
    relaySince: 0,
    audit: [],
  }
}

function withDefaults(d: Partial<Data>): Data {
  const base = emptyData()
  return { ...base, ...d, settings: { ...base.settings, ...(d.settings ?? {}) } }
}

type Plain = { v: 2; mode: 'plain'; key: Hex; mnemonic?: string; data: Data }
type Sealed = { v: 2; mode: 'sealed'; address: Address; salt: string; iters: number; iv: string; ct: string }
type Persisted = Plain | Sealed

const KEY = 'meshpay.v2'
const OLD_KEY = 'meshpay.v1'

/** `new`: no wallet yet (onboarding). `plain`: legacy or unprotected. `locked` / `unlocked`: protected by a PIN. */
export type Status = 'new' | 'plain' | 'locked' | 'unlocked'

interface Runtime {
  status: Status
  address: Address
  key: Hex | null
  mnemonic: string | null
  data: Data
}

let sealedMeta: { salt: string; iters: number } | null = null
let cryptoKey: CryptoKey | null = null

function readPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Persisted
    // One-time upgrade: keep the signing key from v1, drop payments (their format changed).
    const old = localStorage.getItem(OLD_KEY)
    if (old) {
      const parsed = JSON.parse(old) as { deviceKey?: Hex; policy?: Policy }
      if (parsed.deviceKey) {
        return { v: 2, mode: 'plain', key: parsed.deviceKey, data: withDefaults({ policy: parsed.policy }) }
      }
    }
  } catch {
    // unreadable storage: start fresh
  }
  return null
}

function init(): Runtime {
  const saved = readPersisted()
  if (saved?.mode === 'sealed') {
    sealedMeta = { salt: saved.salt, iters: saved.iters }
    return { status: 'locked', address: saved.address, key: null, mnemonic: null, data: emptyData() }
  }
  if (saved?.mode === 'plain') {
    return {
      status: 'plain',
      address: privateKeyToAccount(saved.key).address,
      key: saved.key,
      mnemonic: saved.mnemonic ?? null,
      data: withDefaults(saved.data),
    }
  }
  return { status: 'new', address: '0x0000000000000000000000000000000000000000', key: null, mnemonic: null, data: emptyData() }
}

let rt: Runtime = init()
let snapshot = makeSnapshot()
const listeners = new Set<() => void>()

function makeSnapshot() {
  return { status: rt.status, address: rt.address, ...rt.data }
}

function emit() {
  snapshot = makeSnapshot()
  listeners.forEach((l) => l())
}

let saving = Promise.resolve()

function persist() {
  const { status, key, mnemonic, data, address } = rt
  if (status === 'locked' || !key) return
  if (status === 'plain') {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 2, mode: 'plain', key, mnemonic: mnemonic ?? undefined, data } satisfies Plain))
    } catch {
      // keep working in memory
    }
    return
  }
  const ck = cryptoKey
  const meta = sealedMeta
  if (!ck || !meta) return
  const body = JSON.stringify({ key, mnemonic, data })
  saving = saving.then(async () => {
    const sealedBox = await seal(ck, body, address)
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 2, mode: 'sealed', address, ...meta, ...sealedBox } satisfies Sealed))
    } catch {
      // keep working in memory
    }
  })
}

persist()

function commit(next: Data) {
  rt = { ...rt, data: next }
  persist()
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getState() {
  return snapshot
}

export function useMeshState() {
  return useSyncExternalStore(subscribe, getState, getState)
}

export class LockedError extends Error {
  constructor() {
    super('The wallet is locked.')
  }
}

export function getDeviceKey(): Hex {
  if (!rt.key) throw new LockedError()
  return rt.key
}

export function getDeviceAccount() {
  if (!rt.key) throw new LockedError()
  return privateKeyToAccount(rt.key)
}

// ---- PIN, lock and backup ----

export async function setPin(pin: string): Promise<void> {
  const problem = pinProblem(pin)
  if (problem) throw new Error(problem)
  if (rt.status !== 'plain' || !rt.key) throw new Error('A PIN is already set.')
  const salt = randomBytes(16)
  const ck = await deriveKey(pin, salt, PBKDF2_ITERATIONS)
  cryptoKey = ck
  sealedMeta = { salt: toB64(salt), iters: PBKDF2_ITERATIONS }
  rt = { ...rt, status: 'unlocked' }
  persist()
  await saving
  clearFailures()
  emit()
}

export type UnlockResult = { ok: true } | { ok: false; waitMs: number; reason: string }

export async function unlock(pin: string): Promise<UnlockResult> {
  const wait = lockoutRemaining()
  if (wait > 0) return { ok: false, waitMs: wait, reason: 'Too many tries.' }
  const raw = localStorage.getItem(KEY)
  const saved = raw ? (JSON.parse(raw) as Persisted) : null
  if (!saved || saved.mode !== 'sealed') return { ok: false, waitMs: 0, reason: 'No PIN is set.' }
  try {
    const ck = await deriveKey(pin, fromB64(saved.salt), saved.iters)
    const body = JSON.parse(await open(ck, saved.iv, saved.ct, saved.address)) as { key: Hex; mnemonic?: string | null; data: Data }
    cryptoKey = ck
    sealedMeta = { salt: saved.salt, iters: saved.iters }
    rt = { status: 'unlocked', address: saved.address, key: body.key, mnemonic: body.mnemonic ?? null, data: withDefaults(body.data) }
    clearFailures()
    emit()
    return { ok: true }
  } catch {
    return { ok: false, waitMs: recordFailure(), reason: 'Wrong PIN.' }
  }
}

export function lock() {
  if (rt.status !== 'unlocked') return
  void saving.then(() => {
    cryptoKey = null
    rt = { status: 'locked', address: rt.address, key: null, mnemonic: null, data: emptyData() }
    emit()
  })
}

export async function changePin(oldPin: string, newPin: string): Promise<boolean> {
  const problem = pinProblem(newPin)
  if (problem) throw new Error(problem)
  if (rt.status !== 'unlocked') return false
  if (!(await revealKey(oldPin))) return false
  const salt = randomBytes(16)
  cryptoKey = await deriveKey(newPin, salt, PBKDF2_ITERATIONS)
  sealedMeta = { salt: toB64(salt), iters: PBKDF2_ITERATIONS }
  persist()
  await saving
  return true
}

/** Returns the secrets after the PIN is checked again. Used for backups and the recovery phrase only. */
export async function revealSecret(pin: string): Promise<{ key: Hex; mnemonic: string | null } | null> {
  const raw = localStorage.getItem(KEY)
  const saved = raw ? (JSON.parse(raw) as Persisted) : null
  if (!saved || saved.mode !== 'sealed') return rt.key ? { key: rt.key, mnemonic: rt.mnemonic } : null
  if (lockoutRemaining() > 0) return null
  try {
    const ck = await deriveKey(pin, fromB64(saved.salt), saved.iters)
    const body = JSON.parse(await open(ck, saved.iv, saved.ct, saved.address)) as { key: Hex; mnemonic?: string | null }
    clearFailures()
    return { key: body.key, mnemonic: body.mnemonic ?? null }
  } catch {
    recordFailure()
    return null
  }
}

export async function revealKey(pin: string): Promise<Hex | null> {
  return (await revealSecret(pin))?.key ?? null
}

/** Creates the wallet from a recovery phrase and protects it with a PIN in one step. */
export async function createWallet(mnemonic: string | null, key: Hex, pin: string): Promise<void> {
  const problem = pinProblem(pin)
  if (problem) throw new Error(problem)
  if (rt.status !== 'new') throw new Error('A wallet already exists on this device.')
  const address = privateKeyToAccount(key).address
  const salt = randomBytes(16)
  cryptoKey = await deriveKey(pin, salt, PBKDF2_ITERATIONS)
  sealedMeta = { salt: toB64(salt), iters: PBKDF2_ITERATIONS }
  rt = { status: 'unlocked', address, key, mnemonic, data: emptyData() }
  persist()
  await saving
  clearFailures()
  emit()
}

/** Erases this wallet from the device. The recovery phrase is the only way back in. */
export function wipeWallet() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(OLD_KEY)
  } catch {
    // ignore
  }
  cryptoKey = null
  sealedMeta = null
  rt = { status: 'new', address: '0x0000000000000000000000000000000000000000', key: null, mnemonic: null, data: emptyData() }
  emit()
}

export function exportBackup(): string | null {
  const raw = localStorage.getItem(KEY)
  const saved = raw ? (JSON.parse(raw) as Persisted) : null
  return saved?.mode === 'sealed' ? raw : null
}

/** Replaces this wallet with an encrypted backup, after proving the PIN opens it. */
export async function importBackup(json: string, pin: string): Promise<boolean> {
  try {
    const saved = JSON.parse(json) as Persisted
    if (saved.v !== 2 || saved.mode !== 'sealed') return false
    const ck = await deriveKey(pin, fromB64(saved.salt), saved.iters)
    await open(ck, saved.iv, saved.ct, saved.address)
    localStorage.setItem(KEY, json)
    localStorage.removeItem(OLD_KEY)
    sealedMeta = { salt: saved.salt, iters: saved.iters }
    cryptoKey = null
    rt = { status: 'locked', address: saved.address, key: null, mnemonic: null, data: emptyData() }
    emit()
    return (await unlock(pin)).ok
  } catch {
    return false
  }
}

// ---- data mutations ----

const d = () => rt.data

export function addItem(item: StoredItem): boolean {
  if (d().items.some((i) => i.id === item.id)) return false
  commit({ ...d(), items: [item, ...d().items] })
  return true
}

export function updateItem(id: string, patch: Partial<StoredItem>) {
  commit({ ...d(), items: d().items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
}

export function removeItem(id: string) {
  commit({ ...d(), items: d().items.filter((i) => i.id !== id) })
}

export function setPolicy(policy: Policy) {
  commit({ ...d(), policy })
}

export function setSettings(patch: Partial<Settings>) {
  commit({ ...d(), settings: { ...d().settings, ...patch } })
}

export function setReserveCache(raw: bigint) {
  commit({ ...d(), reserveCache: { raw: raw.toString(), at: Date.now() } })
}

export function upsertContact(c: Contact) {
  const rest = d().contacts.filter((x) => x.address.toLowerCase() !== c.address.toLowerCase())
  commit({ ...d(), contacts: [c, ...rest] })
}

export function patchContact(address: Address, patch: Partial<Contact>) {
  commit({ ...d(), contacts: d().contacts.map((c) => (c.address.toLowerCase() === address.toLowerCase() ? { ...c, ...patch } : c)) })
}

export function removeContact(address: Address) {
  commit({ ...d(), contacts: d().contacts.filter((c) => c.address.toLowerCase() !== address.toLowerCase()) })
}

export function addMessage(m: ChatMessage): boolean {
  if (d().messages.some((x) => x.id === m.id)) return false
  commit({ ...d(), messages: [...d().messages, m] })
  return true
}

export function updateMessage(id: string, patch: Partial<ChatMessage>) {
  commit({ ...d(), messages: d().messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
}

export function addCarried(c: Carried): boolean {
  if (d().carried.some((x) => x.id === c.id)) return false
  commit({ ...d(), carried: [c, ...d().carried].slice(0, 200) })
  return true
}

export function markCarriedPublished(id: string) {
  commit({ ...d(), carried: d().carried.map((c) => (c.id === id ? { ...c, published: true } : c)) })
}

export function setStanding(list: Standing[]) {
  commit({ ...d(), standing: list })
}

export function addInvoice(inv: Invoice) {
  commit({ ...d(), invoices: [inv, ...d().invoices.filter((i) => i.ref !== inv.ref)].slice(0, 100) })
}

export function patchInvoice(ref: Hex, patch: Partial<Invoice>) {
  commit({ ...d(), invoices: d().invoices.map((i) => (i.ref === ref ? { ...i, ...patch } : i)) })
}

export function setRelaySince(ts: number) {
  commit({ ...d(), relaySince: ts })
}

export function addAudit(text: string, tone?: AuditEntry['tone']) {
  commit({ ...d(), audit: [{ ts: Date.now(), text, tone }, ...d().audit].slice(0, 100) })
}
