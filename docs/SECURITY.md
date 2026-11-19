# WayaMesh web wallet: security review

Status: **testnet only. Not ready for real money.** This page says what was reviewed, what was fixed, and what still stands between this app and a mainnet launch.

## What was reviewed

* The Solidity contract `MeshPayV2`: two rounds of automated review plus 50 Foundry tests (unit, batch, withdraw, fuzz, invariants).
* The whole web app: an independent adversarial read of every file in `src/lib`, `src/hooks`, `src/components`, the onramp server, the service worker, the headers and the preview hooks. It found 3 High, 11 Medium and 16 Low issues.
* Behaviour in a real browser: onboarding, PIN and passphrase, lock and unlock, recovery phrase, backup and restore, guardian recovery, limits, every tab and sheet, encrypted chat online and offline, Autopilot, payments in chat, settlement on Arc Testnet. These runs also ran against the production build under its strict security headers.
* `npm run test:security` (or `bun run test:security`): 33 hostile-input checks (malformed chat messages, forged relay events, malleated signatures, poisoned contact cards, impossible shards, unsafe recipients). `npm run test:expiry`: 18 checks for the 24-hour chat expiry.

An AI-assisted review is not an independent audit.

## Fixed after the review

| Finding | Fix |
|---|---|
| High: a stranger's chat message with a bad amount crashed the whole app, permanently | Every chat field is validated before it is stored. Amounts, ids, times, refs and payment codes have strict shapes and sizes. Each tab has an error boundary. Conversations can be cleared or blocked. |
| High: the app could call an unpaid or misdirected payment "paid" | A payment counts as yours only if it pays one of your addresses. Chat bubbles show the amount from the verified payment, never the amount the sender claims. Invoices are marked paid only by a payment that covers them. A payment for someone else is carried, with a clear warning. |
| High: a 6-digit PIN was the only lock on backups | Backups are sealed with a separate passphrase of 12+ characters. The wallet can use a passphrase instead of a PIN. A restore needs typed confirmation. |
| Medium: old plaintext key survived setting a PIN | Removed on PIN set. Older unprotected wallets must set a PIN before use. |
| Medium: limits and cash out could be bypassed with a borrowed phone | Raising a limit needs the PIN or passphrase. Cash outs count against limits. |
| Medium: signature malleability could leave a receiver holding a payment that never settles | Non-canonical signatures are refused. |
| Medium: forged relay timestamps could silence chat | Events outside a two-day window are ignored, and the cursor only moves for real messages. |
| Medium: strangers could fill storage | Caps on payments, messages, contacts and requests. A storage failure is shown to the user. |
| Medium: backup import was destructive and unbounded | Shape checks, bounded key-stretching cost, address check, typed confirmation. |
| Medium: Autopilot could sign twice or stop on one bad entry | The schedule moves forward as soon as a payment is signed. Each entry is handled on its own. |
| Medium: more than 50 payments broke settlement | Settlement is split into groups of 50. |
| Medium: contact cards were trusted blindly | A confirm screen shows the full address. Names are cleaned of hidden characters. |
| Medium: preview debugging hooks ran in production | Replaced by empty modules in production builds. |
| Medium: onramp helper was open to abuse | Rate limits, short signature window, local-only binding, generic errors. |
| Low (several) | Review step and look-alike warning for Pay now. Money cannot be sent to the empty address, the USDC contract or the settlement contract. Shards are cleared from the clipboard. Shard numbers are range-checked and the recovered address is shown. Settings fail closed. The service worker never caches API calls. Security headers allow only the hosts the app needs. |

## Chat expiry (24 hours)

Every chat message expires 24 hours after the time the sender put in it. The sender tags the relay event with NIP-40 `expiration`, receivers drop messages older than 24 hours, and the app purges expired messages on start, on returning to the foreground, every 5 minutes and when a thread is opened. Contacts, payments, invoices and settlement status are kept.

What this does and does not give you: it limits how long an honest client and a cooperating relay keep a message. It is **not secure deletion**. A relay may ignore the tag, a recipient can screenshot or copy a message, a modified client can keep everything, and a browser profile or backup copied earlier still holds what it held. The wire format did not change, so the sender's timestamp is the only clock; a sender with a wrong clock can send a message that a receiver treats as expired or that lives a little longer (the receiver already refuses timestamps more than a day ahead).

## Money ramp (M-Pesa) hardening

`ramp-server/` is a testnet demo. In mock mode it simulates Safaricom and sends no money. Safeguards in the code, all covered by tests: signed single-use requests, a callback secret token on every Safaricom webhook (the server refuses to start in sandbox or production mode with a weak secret, a non-https callback URL or `ALLOWED_ORIGINS=*`), an amount cap (`MAX_KES`), idempotent payouts (a replayed callback cannot pay twice), reuse protection for deposit hashes, phone numbers masked in API responses, and log redaction of phone numbers, keys and tokens. What it does **not** do: Safaricom does not sign webhooks, so the token plus network allow-listing is all there is; the order store is a JSON file; there is no KYC, AML or per-user daily limit; the treasury key is an environment variable. Running it with real Daraja credentials and real money needs Safaricom approval, a licensed business and a review of its own. See `ramp-server/README.md`.

## Theme script and the CSP

The light/dark preference is applied before first paint by `public/theme-init.js`, a small **external** blocking script. It is loaded with `script-src 'self'`; no inline script was added and the CSP is unchanged. It only reads `localStorage["wayamesh-theme"]` and `prefers-color-scheme` and sets `data-theme` on the page. The preference is not sensitive, but it is shared with the website on the same origin.

## What is still true

* **Offline payments are provisional until they settle.** A payer can sign conflicting payments, including to another address they control, and the first to settle wins. The contract documents this and does not try to hide it. Receivers should accept offline only what they would trust the payer with. The app flags payments above a limit you set, and shows when a payer's reserve is low or a withdrawal is pending.
* **The web PIN is a convenience lock.** Someone who copies the encrypted data from the browser can try to guess a 6-digit PIN offline. Use a passphrase if real money is involved. A phone's hardware keystore does not have this weakness, which is why the mobile app should keep it.
* **Relays see metadata.** They cannot read messages or see who wrote them, but they see your network address and the key you receive on.
* **Nostr relays are public infrastructure** and can be slow, drop messages or block you. Chat has offline hand-over as a fallback.
* **The first load runs code from the host.** A compromised host or build could ship a malicious app. Mainnet use needs reproducible builds, subresource integrity and a published hash, or a native app.
* **No independent audit and no bug bounty yet.**

## Before any mainnet launch

1. An independent audit of `MeshPayV2` and of the wallet's key handling, by a firm that audits wallets.
2. A public bug bounty and a way to report issues privately.
3. Decide the mainnet withdraw delay (7 days is the planned value) and redeploy with that constructor argument. Do not reuse the testnet contract.
4. Verify the contract on the explorer and publish the source.
5. Real RPC providers with fallbacks, monitoring and alerting, and relays you operate in addition to public ones.
6. Spending and balance limits during a limited launch, and a way to pause the front end if needed.
7. Legal review for money transmission and sanctions screening in each country you serve.
8. A native mobile app for anything beyond small amounts.
