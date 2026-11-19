# WayaMesh web wallet

**Pay in USDC, even offline.** WayaMesh is a self-custody wallet that signs payments with no internet, hands them over by QR code, and settles them on [Arc](https://arc.network) when any phone gets a connection.

This repo is the **WayaMesh web wallet and the protocol reference implementation**. It is the web wallet served at **[wayamesh.xyz/app](https://wayamesh.xyz/app)**, and the reference that the Android app in [Tevin-Isaac/wayamesh-mobile](https://github.com/Tevin-Isaac/wayamesh-mobile) follows: the same payment format, chat protocol and test vectors (`docs/PORTING-TO-WAYAMESH-MOBILE.md`), and the same seed phrase gives the same address on both.

> **Testnet only.** WayaMesh runs on **Arc Testnet** with test USDC. Arc mainnet is not live, so nothing here holds real money. Get free test USDC at [faucet.circle.com](https://faucet.circle.com) (choose *Arc Testnet*). Read [docs/SECURITY.md](docs/SECURITY.md) before anything else.

## How it works

### The money model

The settlement contract is **MeshPayV2** on Arc Testnet (`0xd619b77bb8389a632800c300969ef152099f7691`, source in `contracts/MeshPayV2.sol`, withdraw delay 86400 s).

* **Offline reserve.** You pre-load USDC into the contract under your address. That balance backs your offline payments.
* **Voucher.** An offline payment is an EIP-712 signed authorization: pay X USDC (plus a courier fee) to address Y, valid until time T, nonce N. Signing happens on your device and needs no network.
* **Funded check.** Because the reserve is on chain, whoever you pay can check that you are funded whenever they have any connection.
* **Hand-off.** The signed payment (`mp2:` plus 178 bytes, base64url) is what travels, as a QR code on any device and over Bluetooth in the Android app (beta). Browsers cannot do Bluetooth, so the web wallet hands over by QR, copied text or the share sheet.
* **Settlement.** Any phone or browser can submit a voucher. The contract checks signature, deadline, nonce and reserve, pays the recipient, and pays the courier fee to whoever submitted it. Duplicates are rejected by per-payer nonces.
* **Courier fee.** Paid from the payer's reserve to whoever settles (a tip you can change in the app). It is what pays a phone to carry and settle other people's payments.
* **24-hour validity.** Vouchers are signed for 24 hours and never longer than the withdraw delay, so a payer cannot sign, hand over and then drain the reserve before it settles. Receivers refuse vouchers that live longer or are about to expire.
* **Withdraw delay.** *Request withdrawal*, wait the delay (the reserve stays spendable meanwhile), then *Finalize*.
* **Accept limit.** The app flags a payment above a limit you set for what you accept offline.
* **Provisional offline acceptance.** Until a voucher settles it is a promise backed by the payer's reserve. A malicious payer can sign conflicting vouchers, including to a second address they control, and the first to settle wins. `cancelNonce` also lets a payer void an unsettled voucher. Do not treat an unsettled payment as final money. The contract has no owner, admin, pause or upgrade path.

### Chat

* **Encrypted.** Contacts exchange a contact card (QR or text) that carries the address and the chat public key. Each message is sealed to the recipient's key (secp256k1 ECDH, XChaCha20-Poly1305) and signed by the sender's wallet key. Unknown senders land in a requests folder until accepted. A safety number lets two people check nobody is in between.
* **Public relays.** Online messages travel through public Nostr relays (`wss://nos.lol`, `wss://relay.primal.net`, editable in Settings). Relays are untrusted mailboxes: they see sealed bytes under throwaway keys, but they do see network addresses and the key you receive on. Offline, a message is a code (`mpm1:`) that any phone can carry and publish.
* **24-hour expiry.** Every message expires 24 hours after its sender's timestamp. The relay event carries a NIP-40 `expiration` tag, receivers drop older messages, and the app purges expired messages on start, on returning to the foreground, every 5 minutes and when a thread opens. Contacts, payments, invoices and settlement status are kept. This is a client policy, not secure deletion: a relay may ignore the tag and anyone can screenshot a message.
* Text only, up to 500 characters. Payments and payment requests appear in the same thread.

### M-Pesa add money and cash out (testnet demo)

`ramp-server/` is a small Daraja backend (STK Push in, B2C out), the same one the Android app uses, with one extra: cash out can be paid from your MeshPay reserve. The web wallet shows the M-Pesa sheet when a ramp server is reachable.

* **Mock mode** (no credentials) simulates Safaricom, so the whole flow runs with no money and no keys. When the server has no treasury key, no USDC is sent either and the UI says so.
* Requests are authorised by a wallet signature (5-minute window, single use). Webhooks need a secret token. Payouts are idempotent. Amounts are capped (`MAX_KES`).
* Real Safaricom is used only if the owner configures Daraja credentials. Going live needs Safaricom approval, a paybill or till, a B2C initiator and certificate-encrypted security credential, a public HTTPS callback, a mainnet treasury and legal review. See [ramp-server/README.md](ramp-server/README.md).

### Recovery and keys

* A 12-word recovery phrase (BIP-39, `m/44'/60'/0'/0/0`). The key is encrypted with your PIN (PBKDF2, 600,000 rounds, AES-GCM) or a passphrase.
* **The web PIN is a convenience lock.** Someone who copies the encrypted vault from your browser can guess a 6-digit PIN offline. Your recovery phrase is the real recovery. The phone's hardware keystore does not have this weakness.
* Encrypted backup file (sealed with its own passphrase of 12+ characters) and 2-of-3 guardian shards, in a format shared with the Android app.

### Other features

Autopilot (recurring payments that sign inside your limits, with an audit log), mesh carrying of other people's payments and messages, spending limits, an optional Connect wallet button (web only) and a Circle onramp sandbox widget that works only while its small backend runs.

## What has and has not been verified

**Run and passing (on Node 22, with npm):**

* `npx tsc --noEmit`: clean.
* `npx vite build`: production build succeeds, including builds mounted under `/app-static/`.
* `npm run test:security`: 33 hostile-input checks pass.
* `npm run test:expiry`: 18 checks for the 24-hour expiry pass (tag, drop and purge rules, event validity, unchanged wire format).
* `forge test`: 50 contract tests pass (unit, batch, withdraw, fuzz, invariants).
* `ramp-server`: `npm test` runs 28 tests, all passing; `tsc --noEmit` is clean there too.
* Ramp, mock mode: `npm run e2e` runs the full on-ramp (signed request, polling to completed, replay and tampering rejected) against the running server with a throwaway wallet.
* Web UI in headless Chrome against the mock ramp server: create a wallet, open M-Pesa, Add money, and the order reaches completed in the UI.
* Mounted build: served under `/app` with an `/app-static/` asset path and the same rewrite the Next.js site uses, loaded in headless Chrome with no 404s or console errors, service worker registered with scope `/app`, offline shell served from cache.

**Not verified by this repo's checks:**

* Real Safaricom (Daraja) calls, STK callbacks, B2C payouts, and cash out against the live chain.
* An independent audit of the contract. It has none.
* A funded end-to-end settlement on Arc Testnet from this build; Buy USDC with Circle; Connect wallet with a real browser wallet; Bluetooth (not possible in browsers).
* Live chat through public relays from this build, and relays actually honouring `expiration`.
* The expiry purge inside the running UI over 24 real hours (the rules are unit-tested; the store wiring is type-checked and exercised only through the app starting).

## Run it

Requires Node 20+ (npm) or [Bun](https://bun.sh). [Foundry](https://getfoundry.sh) only for the contract.

```bash
# npm
npm install --legacy-peer-deps
npm run dev                 # http://localhost:5173
npm run test                # security + expiry checks
npx tsc --noEmit
npx vite build              # dist/

# bun
bun install
bun run dev
bun run test
bunx vite build

# M-Pesa ramp server in mock mode (second terminal)
cd ramp-server && npm install && npm run dev      # :8787, the dev server proxies /ramp-api to it
npm test && npm run e2e

# contract
forge test
```

Serve under wayamesh.xyz: `scripts/sync-to-website.sh <path to the website repo>` builds with `VITE_BASE=/app-static/` and copies the build into the site's `public/app-static`, and the service worker to `public/sw.js`. The site rewrites `/app` and `/app/*` to `/app-static/index.html`.

### Environment variables

| Name | Purpose |
|---|---|
| `VITE_MESHPAY_ADDRESS` | Settlement contract address (required). Testnet value in `.env.example` |
| `VITE_MESHPAY_DELAY` | Withdraw delay in seconds, must equal the contract (default 86400) |
| `VITE_NETWORK` | Leave unset for Arc Testnet. `mainnet` builds are refused with a testnet contract |
| `VITE_BASE` | Where built files are served from. `/` by default, `/app-static/` for wayamesh.xyz |
| `VITE_APP_PATH` | Page path when mounted, e.g. `/app` (service worker and manifest scope) |
| `VITE_RAMP_API_URL` | URL of the ramp server. In dev, the proxy `/ramp-api` is used when unset |
| `VITE_ONRAMP_API` | `true` to probe `/api/health` for the Circle onramp backend in a production build (always on in dev) |
| `VITE_ONRAMP_WIDGET_BASE_URL`, `VITE_OFFRAMP_URL` | Circle onramp widget and off-ramp link (optional) |
| `CIRCLE_API_KEY`, `ONRAMP_API_BASE_URL`, `ONRAMP_REFERRER_DOMAIN` | Circle onramp backend, server only (optional) |
| `ramp-server/.env` | See `ramp-server/.env.example`. Never commit it |

Never commit `.env` files.

## Honest limits

* Testnet only. No independent audit, no bug bounty. See [docs/SECURITY.md](docs/SECURITY.md) for what was reviewed, what was fixed, and what blocks a mainnet launch.
* Offline payments are provisional until they settle.
* The first load runs code from the host. A compromised host could ship a malicious wallet.
* Browsers cannot do Bluetooth, so there is no Bluetooth hand-off here.
* M-Pesa is a demo against test USDC. Nothing in this repo makes it legal or safe to move real money.

## Docs

* [docs/SECURITY.md](docs/SECURITY.md): security review and limits
* [docs/PORTING-TO-WAYAMESH-MOBILE.md](docs/PORTING-TO-WAYAMESH-MOBILE.md): protocol, test vectors, porting plan
* [ramp-server/README.md](ramp-server/README.md): M-Pesa ramp, mock mode, go-live checklist
* `AGENTS.md`: project memory for Arc Studio
