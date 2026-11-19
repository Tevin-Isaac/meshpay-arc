# Wayamesh final version: scope, risks, and grant form

Prepared after reading `Tevin-Isaac/wayamesh-mobile` (Expo / React Native, SDK 54) and comparing it with the MeshPay prototype in this project.

## 1. What wayamesh-mobile already does

- Self-custody wallet. Keys are generated on the device and kept in secure storage, gated by biometrics.
- Offline send. A signed USDC transfer travels by QR code or Bluetooth (Android, single hop). Any phone can courier a payment.
- Chat with payments. Contacts and threads are stored in SQLite on the device. Text does not leave the phone yet.
- Agent wallet. A spending mandate (per-transaction, daily and total caps, allowlist, expiry) enforced by a deterministic policy engine, with an AI that can only propose.
- Gasless smart account through Circle Modular Wallets and the Circle Paymaster.
- Recovery by seed phrase, PIN-protected backup, or Shamir guardian shards.
- USSD companion prototype, nine languages (not wired everywhere), onramp and offramp hooks.
- No contract of its own. The README lists an escrow contract as roadmap.

## 2. What the MeshPay prototype adds

A deployed contract on Arc Testnet (`0x41f84ad06cd7f256c67fbb62906899c29611d6ef`) with a prepaid reserve, EIP-712 signed payments, permissionless settlement (single and batch), per-payer nonces against duplicates, and ERC-1271 support. It went through a security review. It is the escrow idea from the roadmap, working on testnet.

It is not connected to the mobile app yet. Today the mobile app signs raw transfers, so the contract address on the grant form is not used by the app that is being submitted. Fix that before submitting, or describe it exactly as it is.

## 3. Proposed final version

### A. Provable offline payments (the core upgrade)
1. Move the mobile app from raw signed transfers to MeshPay payments backed by a reserve, so a receiver can check "Funded" before accepting.
2. Contract v2: delay on withdrawals so a payer cannot sign, hand over, then drain the reserve; courier fee in the payment so phones are paid to carry and settle; optional per-payment memo hash. Redeploy, re-review, verify on arcscan.
3. Receiver risk limits: the app caps how much unsettled offline value it will hold from one payer.

### B. Security (paramount)
- Key in secure hardware where available, with biometric gate on every signature; PIN lockout with backoff; no key export without re-authentication.
- Human-readable signing: show amount, recipient and expiry from the payment itself, never a blind hash.
- Encrypted local database, screen-capture protection (already present), jailbreak/root warning, clipboard hygiene.
- Contact verification with safety numbers so a swapped address or key is visible.
- Third-party audit of the contract and the signing code before any mainnet claim.

### C. Chat that works online and offline
- End-to-end encrypted. Each message is encrypted to the contact's key; relays and couriers only see sealed bytes.
- Online through simple relays that cannot read or alter messages; offline by store-and-forward over the same Bluetooth and QR mesh that carries payments.
- Payments, requests and receipts live inside the thread. Delivery states: sent, carried, delivered.
- Needs a protocol design review (key agreement, replay, ordering, metadata) before building. This is the riskiest new feature.

### D. Agents, only where they earn their place
- Keep the existing mandate model: AI proposes, policy disposes.
- Useful agent jobs: standing payments that execute offline, payment-request follow-up, spending summaries. No agent holds funds outside a mandate.
- Ship a plain chat first. Add agents as opt-in.

### E. Features that make it distinct
- Courier network: earn small fees for carrying and settling other people's payments.
- Merchant mode: a till QR that accepts offline payments with a visible risk meter.
- Payment requests and split bills inside chat.
- M-Pesa bridge through a provider on a supported chain, with the USSD companion for feature phones.

### F. Grant readiness
- Contract verified on arcscan, with a README for each deployed address.
- A recording of the real mobile app on two phones, not the web demo.
- Website (wayamesh.xyz) updated to match what is actually built. No claims about features that are still roadmap.

## 4. Risks and limits

- Expo, Bluetooth and native modules cannot run in this sandbox. I can edit and type-check the code, but you must test it on real phones.
- Changes touch keys, signing and funds flow in existing code, so they need review and device testing at each step.
- End-to-end chat and the contract changes should be reviewed by a specialist before real money.
- Everything here is Arc Testnet. Nothing in this plan claims mainnet readiness.
- Someone copying MIT-licensed code is legal. A license change only applies going forward. Keep the commit history and dated releases as evidence of authorship, and ask a lawyer if this is serious.

## 5. Suggested order

1. Contract v2 and verification.
2. Mobile: reserve, top-up, signed payments, settlement.
3. Security hardening pass.
4. Encrypted chat (online first, then offline mesh).
5. Courier fees, merchant mode, agents.
6. Real-device recording, site update, submission.

## 6. Arc Builder form: suggested answers

| Field | Suggested answer |
| --- | --- |
| Project / build name | Wayamesh |
| Contract addresses | `MeshPay, 0x41f84ad06cd7f256c67fbb62906899c29611d6ef` (not shared infra). Verify it on testnet.arcscan.app first. |
| Category | Payments |
| Stage | Working prototype (or "Testnet or in-progress build"). Avoid "Live / public". |
| Feedback wanted | How best to design offline receiver guarantees (escrow envelope and fraud proofs), and Paymaster use for offline signing. |
| Relation to Arc, USDC, Circle | USDC is the unit of account and the gas token on Arc, so a payer needs one asset. Sub-second finality makes settlement from the first phone that reaches a signal feel instant. Uses the Circle Paymaster and Modular Wallets for gasless smart accounts. |
| Circle products | Arc, USDC, Paymaster, Wallets. Do not tick CCTP or Gateway; they are roadmap. |
| Commercial relationship with Circle | Other: none (or the one that is true for you). |
| Applied for a grant | Your honest answer. |
| Mainnet | Yes, if you intend to. |
| Present live | Yes, if you are comfortable. You need a real domain (wayamesh.xyz). |
| Project links | `https://wayamesh.xyz, https://github.com/Tevin-Isaac/wayamesh-mobile, https://github.com/Tevin-Isaac/wayamesh-mobile/releases, https://github.com/Tevin-Isaac/meshpay-arc` (use https links, not the git@ form) |

One-line description: keep it, but only say "QR code or Bluetooth" if you mean Android, since Bluetooth handoff is Android-only today.
