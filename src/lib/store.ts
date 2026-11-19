import { useSyncExternalStore } from 'react'
import { keepLive, keepLiveCarried } from './chat/expiry'
import type { Address, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  PBKDF2_ITERATIONS,
  isPin,
  clearFailures,
  deriveKey,
  fromB64,
  lockoutRemaining,
  open,
  pinProblem,
  passphraseProblem,
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
  /** For payments read from the chain: what the transfer was. Shown in History. */
  label?: 'deposit' | 'withdraw' | 'settled'
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
  /** Compressed secp256k1 public key, used to encrypt messages to this person. Empty for a contact saved by address only (they can be paid, but not messaged until their card is added). */
  pubkey: Hex | ''
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
  /** For payments: the attached payment was checked on this device and pays me (or I signed it). */
  verified?: boolean
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
  /** Name shown in the profile and put on the contact card. Empty means 'Your wallet'. */
  displayName: string
  /** Let people who have my address find my chat key (a public listing with no name). */
  discoverable: boolean
}

export interface Data {
  policy: Policy
  items: StoredItem[]
  reserveCache: { raw: string; at: number } | null
  /** Last USDC balance seen at the device address, for showing a clearly marked 'last known' value offline. */
  walletCache: { raw: string; at: number } | null
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
    walletCache: null,
    contacts: [],
    messages: [],
    carried: [],
    standing: [],
    invoices: [],
    settings: { autoLockMinutes: 2, hideBalances: false, acceptLimit: '25', tip: '0', relays: DEFAULT_RELAYS, displayName: '', discoverable: true },
    relaySince: 0,
    audit: [],
  }
}

function withDefaults(d: Partial<Data>): Data {
  return sanitizeData(d)
}

export const CAPS = { items: 400, pendingItems: 150, messages: 2500, contacts: 300, requests: 40, audit: 100, carried: 200, invoices: 100, standing: 30 }

const asArray = <T,>(v: unknown, max: number): T[] => (Array.isArray(v) ? (v.slice(0, max) as T[]) : [])
const str = (v: unknown, fallback: string, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : fallback)

/** Makes sure whatever was decrypted or restored has the shape the app expects, so a bad backup cannot crash it. */
export function sanitizeData(input: unknown): Data {
  const d = (input && typeof input === 'object' ? input : {}) as Partial<Data>
  const base = emptyData()
  const s = (d.settings ?? {}) as Partial<Settings>
  const relays = asArray<string>(s.relays, 8).filter((r) => typeof r === 'string' && /^wss:\/\/[\w.-]+(:\d+)?\/?$/.test(r))
  return {
    policy: { perTx: str(d.policy?.perTx, base.policy.perTx, 20), daily: str(d.policy?.daily, base.policy.daily, 20) },
    items: asArray<StoredItem>(d.items, CAPS.items).filter((i) => i && typeof i.id === 'string' && typeof i.amount === 'string'),
    reserveCache:
      d.reserveCache && typeof d.reserveCache.raw === 'string' && typeof d.reserveCache.at === 'number' ? d.reserveCache : null,
    walletCache:
      d.walletCache && typeof d.walletCache.raw === 'string' && /^\d{1,40}$/.test(d.walletCache.raw) && typeof d.walletCache.at === 'number' ? d.walletCache : null,
    contacts: asArray<Contact>(d.contacts, CAPS.contacts).filter((c) => c && typeof c.address === 'string' && typeof c.pubkey === 'string'),
    messages: asArray<ChatMessage>(d.messages, CAPS.messages).filter((m) => m && typeof m.id === 'string' && typeof m.peer === 'string'),
    carried: asArray<Carried>(d.carried, CAPS.carried),
    standing: asArray<Standing>(d.standing, CAPS.standing),
    invoices: asArray<Invoice>(d.invoices, CAPS.invoices),
    settings: {
      autoLockMinutes: typeof s.autoLockMinutes === 'number' ? s.autoLockMinutes : base.settings.autoLockMinutes,
      hideBalances: !!s.hideBalances,
      acceptLimit: str(s.acceptLimit, base.settings.acceptLimit, 20),
      tip: str(s.tip, base.settings.tip, 20),
      relays: relays.length ? relays : base.settings.relays,
      displayName: str(s.displayName, '', 24).replace(/[\u0000-\u001f]/g, ''),
      discoverable: s.discoverable !== false,
    },
    relaySince: typeof d.relaySince === 'number' ? d.relaySince : 0,
    audit: asArray<AuditEntry>(d.audit, CAPS.audit),
  }
}

type Plain = { v: 2; mode: 'plain'; key: Hex; mnemonic?: string; data: Data }
type Sealed = { v: 2; mode: 'sealed'; kind?: 'pin' | 'pass'; address: Address; salt: string; iters: number; iv: string; ct: string }
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

let sealedMeta: { salt: string; iters: number; kind: 'pin' | 'pass' } | null = null
let cryptoKey: CryptoKey | null = null

/** A stored or imported iteration count outside this range is refused, so a crafted file cannot hang the device. */
function boundedIters(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 100_000 && n <= 2_000_000 ? Math.floor(n) : PBKDF2_ITERATIONS
}

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
    sealedMeta = { salt: saved.salt, iters: boundedIters(saved.iters), kind: saved.kind ?? 'pin' }
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
  return { status: rt.status, address: rt.address, secretKind: sealedMeta?.kind ?? ('pin'), ...rt.data }
}

function emit() {
  snapshot = makeSnapshot()
  listeners.forEach((l) => l())
}

let saving: Promise<void> = Promise.resolve()
let storageFailed = false
const storageListeners = new Set<() => void>()

/** True when the device could not save the latest changes (storage full or blocked). */
export function onStorageFailure(l: () => void) {
  storageListeners.add(l)
  return () => {
    storageListeners.delete(l)
  }
}

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
  saving = saving
    .then(async () => {
      const sealedBox = await seal(ck, body, address)
      localStorage.setItem(KEY, JSON.stringify({ v: 2, mode: 'sealed', address, ...meta, ...sealedBox } satisfies Sealed))
      storageFailed = false
    })
    .catch(() => {
      // Storage is full or blocked. Keep working in memory and tell the user once.
      if (!storageFailed) {
        storageFailed = true
        storageListeners.forEach((l) => l())
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

/** The old plaintext copy of the key must never outlive the sealed one. */
function removeLegacy() {
  try {
    localStorage.removeItem(OLD_KEY)
  } catch {
    // ignore
  }
}

export async function setPin(pin: string): Promise<void> {
  const problem = pinProblem(pin)
  if (problem) throw new Error(problem)
  if (rt.status !== 'plain' || !rt.key) throw new Error('A PIN is already set.')
  const salt = randomBytes(16)
  const ck = await deriveKey(pin, salt, PBKDF2_ITERATIONS)
  cryptoKey = ck
  sealedMeta = { salt: toB64(salt), iters: PBKDF2_ITERATIONS, kind: isPin(pin) ? 'pin' : 'pass' }
  rt = { ...rt, status: 'unlocked' }
  persist()
  await saving
  removeLegacy()
  clearFailures()
  emit()
}

export type UnlockResult = { ok: true } | { ok: false; waitMs: number; reason: string }

let unlocking = false

export async function unlock(pin: string): Promise<UnlockResult> {
  if (unlocking) return { ok: false, waitMs: 0, reason: 'One moment.' }
  const wait = lockoutRemaining()
  if (wait > 0) return { ok: false, waitMs: wait, reason: 'Too many tries.' }
  unlocking = true
  try {
    const saved = readPersisted()
    if (!saved || saved.mode !== 'sealed') return { ok: false, waitMs: 0, reason: 'No PIN is set.' }
    try {
      const iters = boundedIters(saved.iters)
      const ck = await deriveKey(pin, fromB64(saved.salt), iters)
      const body = JSON.parse(await open(ck, saved.iv, saved.ct, saved.address)) as { key: Hex; mnemonic?: string | null; data: unknown }
      cryptoKey = ck
      sealedMeta = { salt: saved.salt, iters, kind: saved.kind ?? 'pin' }
      rt = { status: 'unlocked', address: saved.address, key: body.key, mnemonic: body.mnemonic ?? null, data: sanitizeData(body.data) }
      clearFailures()
      emit()
      return { ok: true }
    } catch {
      return { ok: false, waitMs: recordFailure(), reason: 'Wrong PIN.' }
    }
  } finally {
    unlocking = false
  }
}

export function lock() {
  if (rt.status !== 'unlocked') return
  const finish = () => {
    cryptoKey = null
    rt = { status: 'locked', address: rt.address, key: null, mnemonic: null, data: emptyData() }
    emit()
  }
  // Never stay unlocked because a save is stuck.
  void saving.then(finish, finish)
}

export async function changePin(oldPin: string, newPin: string): Promise<boolean> {
  const problem = pinProblem(newPin)
  if (problem) throw new Error(problem)
  if (rt.status !== 'unlocked') return false
  if (!(await revealKey(oldPin))) return false
  const salt = randomBytes(16)
  cryptoKey = await deriveKey(newPin, salt, PBKDF2_ITERATIONS)
  sealedMeta = { salt: toB64(salt), iters: PBKDF2_ITERATIONS, kind: isPin(newPin) ? 'pin' : 'pass' }
  persist()
  await saving
  emit()
  return true
}

/** Returns the secrets after the PIN is checked again. Used for backups and the recovery phrase only. */
export async function revealSecret(pin: string): Promise<{ key: Hex; mnemonic: string | null } | null> {
  const saved = readPersisted()
  if (!saved || saved.mode !== 'sealed') return rt.key ? { key: rt.key, mnemonic: rt.mnemonic } : null
  if (lockoutRemaining() > 0) return null
  try {
    const ck = await deriveKey(pin, fromB64(saved.salt), boundedIters(saved.iters))
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
  sealedMeta = { salt: toB64(salt), iters: PBKDF2_ITERATIONS, kind: isPin(pin) ? 'pin' : 'pass' }
  rt = { status: 'unlocked', address, key, mnemonic, data: emptyData() }
  persist()
  await saving
  removeLegacy()
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

// ---- backups: sealed with their own passphrase, never with the PIN ----

const BACKUP_KIND = 'wayamesh-backup'

interface BackupFile {
  kind: typeof BACKUP_KIND
  v: 3
  address: Address
  iters: number
  salt: string
  iv: string
  ct: string
}

/** Encrypts the wallet and its data under a passphrase you choose. Needs an unlocked wallet. */
export async function createBackup(passphrase: string): Promise<string> {
  const problem = passphraseProblem(passphrase)
  if (problem) throw new Error(problem)
  if (rt.status !== 'unlocked' || !rt.key) throw new LockedError()
  const salt = randomBytes(16)
  const ck = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS)
  const box = await seal(ck, JSON.stringify({ key: rt.key, mnemonic: rt.mnemonic, data: rt.data }), rt.address)
  return JSON.stringify({ kind: BACKUP_KIND, v: 3, address: rt.address, iters: PBKDF2_ITERATIONS, salt: toB64(salt), ...box } satisfies BackupFile)
}

/** Opens a backup file. Throws a plain message when it is not a valid backup or the passphrase is wrong. */
export async function readBackup(json: string, passphrase: string): Promise<{ key: Hex; mnemonic: string | null; data: Data }> {
  if (json.length > 8_000_000) throw new Error('That file is too large to be a backup.')
  let file: Partial<BackupFile>
  try {
    file = JSON.parse(json) as Partial<BackupFile>
  } catch {
    throw new Error('That is not a backup file.')
  }
  if (file.kind !== BACKUP_KIND || file.v !== 3 || typeof file.salt !== 'string' || typeof file.iv !== 'string' || typeof file.ct !== 'string' || typeof file.address !== 'string') {
    throw new Error('That is not a WayaMesh backup.')
  }
  let body: { key: Hex; mnemonic?: string | null; data: unknown }
  try {
    const ck = await deriveKey(passphrase, fromB64(file.salt), boundedIters(file.iters))
    body = JSON.parse(await open(ck, file.iv, file.ct, file.address)) as typeof body
  } catch {
    throw new Error('Wrong passphrase, or the file is damaged.')
  }
  if (typeof body.key !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(body.key)) throw new Error('The backup does not contain a valid key.')
  if (privateKeyToAccount(body.key).address.toLowerCase() !== file.address.toLowerCase()) throw new Error('The backup does not match its own address.')
  return { key: body.key, mnemonic: typeof body.mnemonic === 'string' ? body.mnemonic : null, data: sanitizeData(body.data) }
}

/** Replaces the wallet on this device with a restored one, protected by a new PIN. The caller must confirm first. */
export async function restoreWallet(restored: { key: Hex; mnemonic: string | null; data: Data }, pin: string): Promise<void> {
  const problem = pinProblem(pin)
  if (problem) throw new Error(problem)
  const address = privateKeyToAccount(restored.key).address
  const salt = randomBytes(16)
  cryptoKey = await deriveKey(pin, salt, PBKDF2_ITERATIONS)
  sealedMeta = { salt: toB64(salt), iters: PBKDF2_ITERATIONS, kind: isPin(pin) ? 'pin' : 'pass' }
  rt = { status: 'unlocked', address, key: restored.key, mnemonic: restored.mnemonic, data: restored.data }
  persist()
  await saving
  removeLegacy()
  clearFailures()
  emit()
}

// ---- data mutations ----

const d = () => rt.data

export function addItem(item: StoredItem): boolean {
  if (d().items.some((i) => i.id === item.id)) return false
  // Strangers cannot fill the wallet: refuse more unsettled payments past the cap, and drop the oldest finished ones.
  if (item.status === 'pending' && d().items.filter((i) => i.status === 'pending').length >= CAPS.pendingItems) return false
  let items = [item, ...d().items]
  if (items.length > CAPS.items) {
    const keep = items.filter((i) => i.status === 'pending')
    const done = items.filter((i) => i.status !== 'pending').slice(0, Math.max(0, CAPS.items - keep.length))
    items = [...keep, ...done].sort((a, b) => b.createdAt - a.createdAt)
  }
  commit({ ...d(), items })
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

export function setWalletCache(raw: bigint) {
  commit({ ...d(), walletCache: { raw: raw.toString(), at: Date.now() } })
}

export function upsertContact(c: Contact): boolean {
  const existing = d().contacts.find((x) => x.address.toLowerCase() === c.address.toLowerCase())
  if (!existing) {
    if (d().contacts.length >= CAPS.contacts) return false
    if (c.request && d().contacts.filter((x) => x.request).length >= CAPS.requests) return false
  }
  const rest = d().contacts.filter((x) => x.address.toLowerCase() !== c.address.toLowerCase())
  commit({ ...d(), contacts: [c, ...rest] })
  return true
}

export function patchContact(address: Address, patch: Partial<Contact>) {
  commit({ ...d(), contacts: d().contacts.map((c) => (c.address.toLowerCase() === address.toLowerCase() ? { ...c, ...patch } : c)) })
}

/** Saves someone by address alone (for example after paying them). They can be paid at once and messaged once their card is added. */
export function saveContactByAddress(address: Address, name: string): boolean {
  const existing = d().contacts.find((x) => x.address.toLowerCase() === address.toLowerCase())
  if (existing) {
    if (name && name !== existing.name) patchContact(existing.address, { name })
    return true
  }
  return upsertContact({ address, name: name.trim().slice(0, 24) || `${address.slice(0, 6)}…${address.slice(-4)}`, pubkey: '', verified: false, addedAt: Date.now(), request: false })
}

/**
 * Deletes a contact and the messages exchanged with them, in one save. Payments, invoices and history are never touched.
 * (Contacts are also never touched by the 24-hour message purge.)
 */
export function deleteContact(address: Address) {
  const a = address.toLowerCase()
  commit({
    ...d(),
    contacts: d().contacts.filter((c) => c.address.toLowerCase() !== a),
    messages: d().messages.filter((m) => m.peer.toLowerCase() !== a),
  })
}

export function removeContact(address: Address) {
  commit({ ...d(), contacts: d().contacts.filter((c) => c.address.toLowerCase() !== address.toLowerCase()) })
}

export function addMessage(m: ChatMessage): boolean {
  if (d().messages.some((x) => x.id === m.id)) return false
  commit({ ...d(), messages: [...d().messages, m].slice(-CAPS.messages) })
  return true
}

/** Deletes a whole conversation from this device. */
export function removeMessagesFrom(peer: Address) {
  commit({ ...d(), messages: d().messages.filter((m) => m.peer.toLowerCase() !== peer.toLowerCase()) })
}

/** Removes messages (and carried offline codes) older than 24 hours. Leaves contacts, payments, invoices untouched. */
export function purgeExpiredMessages(nowMs = Date.now()): number {
  const messages = keepLive(d().messages, nowMs)
  const carried = keepLiveCarried(d().carried, nowMs)
  const removed = d().messages.length - messages.length + (d().carried.length - carried.length)
  if (removed > 0) commit({ ...d(), messages, carried })
  return removed
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
  commit({ ...d(), standing: list.slice(0, CAPS.standing) })
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
