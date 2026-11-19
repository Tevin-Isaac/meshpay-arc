/**
 * Encryption at rest for the wallet. A PIN is stretched with PBKDF2 into an AES-GCM key that
 * seals the signing key and everything private (payments, contacts, chats).
 * The PIN never leaves the device and is never stored.
 */

export const PBKDF2_ITERATIONS = 600_000

const enc = new TextEncoder()
const dec = new TextDecoder()

export function toB64(bytes: Uint8Array): string {
  let s = ''
  bytes.forEach((b) => {
    s += String.fromCharCode(b)
  })
  return btoa(s)
}

export function fromB64(input: string): Uint8Array<ArrayBuffer> {
  const bin = atob(input)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(n))
  crypto.getRandomValues(out)
  return out
}

export async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function seal(key: CryptoKey, plaintext: string, aad: string): Promise<{ iv: string; ct: string }> {
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(plaintext))
  return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) }
}

export async function open(key: CryptoKey, iv: string, ct: string, aad: string): Promise<string> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv), additionalData: enc.encode(aad) }, key, fromB64(ct))
  return dec.decode(plain)
}

/** Rejects PINs that are too easy to guess. */
export function isPin(secret: string): boolean {
  return /^\d{6}$/.test(secret)
}

/** A 6-digit PIN, or a passphrase of at least 10 characters. Returns what is wrong, or null. */
export function pinProblem(secret: string): string | null {
  if (isPin(secret)) {
    if (/^(\d)\1{5}$/.test(secret)) return 'Pick digits that are not all the same.'
    const asc = '0123456789012345'
    const desc = '9876543210987654'
    if (asc.includes(secret) || desc.includes(secret)) return 'Avoid simple runs like 123456.'
    return null
  }
  if (/^\d+$/.test(secret)) return 'Use exactly 6 digits, or a passphrase of at least 10 characters.'
  return passphraseProblem(secret, 10)
}

/** For passphrases (backups need 12 or more). */
export function passphraseProblem(secret: string, min = 12): string | null {
  if (secret.length < min) return `Use at least ${min} characters.`
  if (secret.length > 200) return 'That is too long.'
  if (new Set(secret).size < 5) return 'Use more different characters.'
  return null
}

const LOCK_KEY = 'meshpay.attempts'

interface Attempts {
  failed: number
  until: number
}

function readAttempts(): Attempts {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY) ?? '') as Attempts
  } catch {
    return { failed: 0, until: 0 }
  }
}

/** Milliseconds until another PIN try is allowed. */
export function lockoutRemaining(): number {
  return Math.max(0, readAttempts().until - Date.now())
}

export function recordFailure(): number {
  const a = readAttempts()
  const failed = a.failed + 1
  const over = failed - 4
  const until = over > 0 ? Date.now() + Math.min(60 * 60 * 1000, 30_000 * 2 ** (over - 1)) : 0
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify({ failed, until }))
  } catch {
    // ignore
  }
  return Math.max(0, until - Date.now())
}

export function clearFailures() {
  try {
    localStorage.removeItem(LOCK_KEY)
  } catch {
    // ignore
  }
}
