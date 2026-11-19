/**
 * Tiny backend for the Buy USDC flow. It holds the Circle API key (never sent to the
 * browser) and mints onramp sessions for wallets that prove they own the address.
 *
 * Run with: bun run server
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createAppServerKit, KitError } from '@circle-fin/app-kit/server'
import { getAddress, isAddress, isHex, verifyMessage } from 'viem'
import { ONRAMP_AUTH_WINDOW_MS, onrampAuthMessage } from '../src/lib/onrampAuth'

const PORT = Number(process.env.PORT ?? 3001)
const apiKey = process.env.CIRCLE_API_KEY
if (!apiKey) {
  console.error('CIRCLE_API_KEY is missing. Add it to .env and restart the server.')
  process.exit(1)
}

const kit = createAppServerKit({
  onramp: {
    apiKey,
    baseUrl: process.env.ONRAMP_API_BASE_URL,
    widgetBaseUrl: process.env.VITE_ONRAMP_WIDGET_BASE_URL,
    referrerDomain: process.env.ONRAMP_REFERRER_DOMAIN,
  },
})

const STATUS: Record<string, number> = { INPUT: 400, RATE_LIMIT: 429, NETWORK: 504, SERVICE: 502, RPC: 502 }

// Simple in-memory limits: this server is a demo helper, not a production gateway.
const hits = new Map<string, number[]>()
function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > max
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  req.setTimeout(5000)
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = chunk as Buffer
    size += buf.length
    if (size > 10_000) throw new Error('Body too large')
    chunks.push(buf)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function mintSession(req: IncomingMessage, res: ServerResponse) {
  let body: unknown
  try {
    body = await readJson(req)
  } catch {
    return send(res, 400, { message: 'Invalid request.' })
  }
  const { address, issuedAt, signature } = (body ?? {}) as Record<string, unknown>
  if (typeof address !== 'string' || !isAddress(address) || typeof issuedAt !== 'number' || typeof signature !== 'string' || !isHex(signature)) {
    return send(res, 400, { message: 'Invalid request.' })
  }
  if (limited('all', 60, 60_000) || limited(address.toLowerCase(), 5, 60_000)) return send(res, 429, { message: 'Too many tries. Wait a minute.' })
  // Not from the future, and not older than the window.
  if (issuedAt > Date.now() + 30_000 || Date.now() - issuedAt > ONRAMP_AUTH_WINDOW_MS) {
    return send(res, 401, { message: 'Signature expired. Try again.' })
  }
  const ok = await verifyMessage({ address, message: onrampAuthMessage(address, issuedAt), signature }).catch(() => false)
  if (ok !== true) return send(res, 401, { message: 'Could not verify wallet ownership.' })

  const destinationAddress = getAddress(address)
  try {
    // The user id and destination come from the verified signer, never from the request.
    const session = await kit.onramp.createSession({
      appUserId: destinationAddress.toLowerCase(),
      destinationAddress,
      assets: { tokens: ['USDC'] },
    })
    return send(res, 200, session)
  } catch (error) {
    console.error('onramp session mint failed', error instanceof Error ? error.message : error)
    if (error instanceof KitError) return send(res, STATUS[error.type] ?? 500, { message: 'The onramp service could not start a session.' })
    return send(res, 500, { message: 'Could not start the onramp.' })
  }
}

createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true })
  if (req.method === 'POST' && path === '/onramp/sessions') {
    void mintSession(req, res)
    return
  }
  send(res, 404, { message: 'Not found.' })
}).listen(PORT, '127.0.0.1', () => console.log(`onramp server listening on 127.0.0.1:${PORT}`))
