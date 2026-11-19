# WayaMesh web wallet: reference implementation and porting guide

This repo is a working, tested reference for the next version of **wayamesh-mobile** (Expo / React Native). It runs in the browser, so Bluetooth and hardware-backed keys are the only things it cannot show. Everything else is specified below, with test vectors, so another engineer or Claude can port it and prove it matches.

Live on Arc Testnet (chain `5042002`):

| | |
|---|---|
| Settlement contract (v2) | `0xd619b77bb8389a632800c300969ef152099f7691` |
| USDC (ERC-20 facade, 6 dp) | `0x3600000000000000000000000000000000000000` |
| Withdraw delay | 86400 s (1 day on testnet). Mobile should read `WITHDRAW_DELAY()` from the contract |
| Source | `contracts/MeshPayV2.sol` (50 passing Foundry tests in `contracts/test/MeshPayV2.*`) |

The older v1 contract (`0x41f84ad06cd7f256c67fbb62906899c29611d6ef`) is superseded. Do not use it.

## 1. Parity table

| Feature | wayamesh-mobile today | This web wallet | Port action |
|---|---|---|---|
| Wallet creation | Seed phrase, hardware keystore | 12-word phrase, confirm 3 words, PIN | Keep mobile flow. Same derivation (section 4.1) |
| Unlock | Biometric + PIN | 6-digit PIN, PBKDF2 vault, lockout, auto-lock | Mobile keeps biometrics. Reuse the lockout schedule |
| Offline payment | Raw signed USDC transfer tx | EIP-712 payment voucher settled by the contract | **Replace** with vouchers (section 3). Adds reserve, tips, invoice ref, duplicate rejection |
| Hand-off | QR, Bluetooth | QR, copy, share | Keep BLE. Carry the new `mp2:` code over it |
| Courier | Carry a third party's payment | Same, plus courier **tips** and carried chat messages | Add tips (`fee`) and message carrying |
| Chat | Device-local text | End-to-end encrypted, online via relays, offline via codes, payments and requests in the thread | Port section 5. Mobile SQLite stores messages |
| Agent wallet | Mandate, standing payments, audit log | Autopilot: standing payments, expiry, total cap, audit log, inside spending limits | Same policy engine. Wire to vouchers |
| Recovery | Seed, cloud backup, Shamir guardians | Seed, encrypted backup file, Shamir guardians (same shard format) | Format already compatible (section 7) |
| Add money | Faucet / provider ramp | Circle onramp sandbox widget (server-held key) | Keep mobile provider module |
| Smart account / gasless | Circle Paymaster | Not in web | Keep mobile as is |
| Languages | 9 locales | English only | Keep mobile i18n |
| USSD | Prototype | Not in web | Keep |

## 2. Security model, stated honestly

* A signed payment settles only from the payer's prepaid **reserve** in the contract.
* Withdrawals are delayed by `WITHDRAW_DELAY`. A pending request does **not** lock funds, so a payment signed before the request still settles until `unlockAt`.
* Receivers reject any voucher whose `deadline` is later than `now + WITHDRAW_DELAY + 1h`, so the delay always covers an accepted voucher.
* **Offline double-spend is not prevented and not compensated.** A malicious payer can sign conflicting payments, including to a second address they control, and the first to settle wins. Receivers must size what they accept offline to what they would trust the payer with. The app flags vouchers above a configurable **accept limit** and shows a `Funded` check when online. Two attempts to add an onchain bond or shortfall claim were reviewed and each opened a new way for the payer to drain it early, so they were removed. Do not reintroduce a bond without a design review.
* `cancelNonce` lets a payer void an unsettled voucher, so offline acceptance is provisional until settlement.
* No owner, admin, pause or upgrade path in the contract.


## 2b. Hardening added after the security review (port these too)

* **Chat messages:** validate every field before storing (`validateInner` in `src/lib/chat/crypto.ts`): id is 24 hex, time within 90 days back and 1 day ahead, kind in {text, payment, request}, text at most 500 characters, amount matches `^\d{1,12}(\.\d{1,6})?$`, ref is 32 bytes, payment code starts with `mp2:` and is at most 400 characters. Reject payloads over 4 KB. Never show an amount the sender claims: show the amount from the payment code that was verified.
* **Payments for me:** a received payment counts as mine only if `to` is one of my addresses. Otherwise it is carried and the user is told it is not for them. An invoice is marked paid only by a payment to me that covers its amount.
* **Signatures:** accept only canonical ones (`v` is 27 or 28, `s` is at most half the curve order). Others can never settle.
* **Relay events:** ignore events dated more than two days from now, or with content over 12,000 characters. Move the sync cursor only for real messages and never past now. Keep the seen-id set bounded.
* **Caps:** unsettled payments 150, stored payments 400, messages 2,500, contacts 300, message requests 40.
* **Contact cards:** show a confirm screen with the full address. Strip control and direction-changing characters from names.
* **Recipients:** refuse the zero address, the USDC token contract and the settlement contract.
* **Limits:** raising a limit needs the PIN. Cash outs count against limits. A bad limit value falls back to a default instead of switching limits off.
* **Backups:** sealed with their own passphrase of 12+ characters, never the PIN. Bound the key-stretching cost on import. Check that the address matches the key. Ask for typed confirmation before replacing a wallet.
* **Unlock:** one attempt at a time, lockout after repeated wrong tries, and locking must clear keys even if a save is stuck.
* **Production builds:** no debugging hooks that forward console output or network calls.
* Tests: `scripts/security-tests.ts` has 33 hostile-input checks to port as unit tests.

## 3. Payment voucher (contract v2)

EIP-712 domain: `name "MeshPay"`, `version "2"`, `chainId 5042002`, `verifyingContract` = contract address.

```
Payment(address from,address to,uint256 amount,uint256 fee,uint256 nonce,uint256 deadline,bytes32 ref)
```

* `fee`: courier tip, paid from the payer's reserve to whoever submits the settlement.
* `ref`: invoice or chat reference, emitted in `Settled` (indexed). `0x00..00` when unused.
* `deadline` must be non-zero. Signed deadline in the app is `now + min(24h, WITHDRAW_DELAY)`.
* Reject codes from `check()`: `0` ok, `1` invalid, `2` expired, `3` nonce used, `4` bad signature, `5` insufficient reserve, `6` transfer failed (batch only).
* `settle(p, sig)` reverts with `PaymentRejected(code)`. `settleBatch(ps, sigs)` (max 50) reports per-item codes and isolates a failing transfer.

**Wire format `mp2:` + base64url (no padding), 178 bytes:**

| Offset | Size | Field |
|---|---|---|
| 0 | 1 | version `2` |
| 1 | 20 | from |
| 21 | 20 | to |
| 41 | 16 | amount (uint128, big endian) |
| 57 | 8 | fee (uint64) |
| 65 | 8 | nonce (uint64, random) |
| 73 | 8 | deadline (uint64) |
| 81 | 32 | ref |
| 113 | 65 | signature `r,s,v` |

Request link: `meshpay:<address>?amount=<decimal>&ref=<0x32 bytes>&note=<text>`.

## 4. Wallet and vault

### 4.1 Key derivation
12-word BIP-39 phrase, account 0, path `m/44'/60'/0'/0/0`. This is the same as ethers `Wallet.fromPhrase`, so one phrase opens one address in both apps.

### 4.2 PIN vault (web; mobile should keep its hardware keystore and use this as the model for the backup file)
* 6-digit PIN. Rejects all-same and ascending/descending runs.
* KDF: PBKDF2-HMAC-SHA256, 600,000 iterations, 16-byte random salt.
* Cipher: AES-256-GCM, fresh 12-byte IV on every save, AAD = the wallet address.
* Plaintext: `{ key, mnemonic, data }` where `data` holds messages, contacts, payments, settings.
* Stored as `{ v:2, mode:"sealed", address, salt, iters, iv, ct }`.
* Lockout: the first 4 wrong tries are free. From the 5th, each wrong try locks for 30 s, doubling each time, capped at 1 hour. The counter lives in browser storage, so it slows a person at the screen but does **not** stop someone who copies the vault file.
* **Known limit:** a stolen vault file can be attacked offline. PBKDF2 at 600,000 iterations makes each guess slow, but 6 digits is only a million guesses, so treat the web PIN as protection against casual access, not against a determined attacker with the file. The mobile hardware keystore does not have this weakness, which is why mobile should keep it.
* Auto-lock after N minutes idle (default 2) and after 30 s in the background.

## 5. Encrypted chat

Identity is the wallet key (secp256k1). **Contact card** `mpc1:` + base64url of `address(20) | compressed pubkey(33) | nameLen(1) | name(≤24, utf8)`. The card carries the pubkey because an address alone cannot be used to encrypt.

**Sealed box** (sender to recipient):
1. Ephemeral secp256k1 key `e`. Shared secret = x-coordinate of `ECDH(e, recipientPub)`.
2. `key = HKDF-SHA256(shared, salt = ephPub(33) | recipientPub(33), info = "meshpay-chat-v1", 32 bytes)`.
3. `box = ephPub(33) | nonce(24) | XChaCha20-Poly1305(key, nonce, plaintext)`.

**Plaintext** is JSON `{v:1, i:id, t:seconds, f:from, o:to, k:"text"|"payment"|"request", x?:text, a?:amount decimal, r?:ref, c?:"mp2:..." voucher, s:signature}`.
`s` is an EIP-191 personal signature by the sender's key over:

```
meshpay-msg-v1\n<to lowercase>\n<id>\n<t>\n<sha256 hex of JSON.stringify([k, x||"", a||"", r||"", c||""])>
```

The recipient verifies `o` equals their own address, recovers the signer from `s`, and requires it to equal `f`. Unknown senders land in **message requests** until accepted.

**Online transport:** Nostr relays (`wss://nos.lol`, `wss://relay.primal.net`, user-editable). Each box is published as a kind `1059` event with tag `["p", recipientXOnlyPubkey]`, signed by a fresh random key, so relays never see who sent it. Clients subscribe with `{kinds:[1059], "#p":[myXOnly], since}` and dedupe by message id. Messages made offline are queued and published when a relay connects.

**Offline transport:** `mpm1:` + base64url(`recipientXOnly(32) | box`). Any phone that scans one it cannot open **carries** it and publishes it to relays once online. Only the recipient can read it.

**Payments in chat:** a `payment` message carries the `mp2:` voucher in `c`. The receiver ingests it automatically into "waiting to settle". A `request` message carries `a` and `r`; tapping Pay in the bubble opens Send with that amount and `ref`.

**Safety number:** `sha256(sorted(pubkeyA, pubkeyB))`, shown as 12 groups of 5 digits. Users mark a contact verified after comparing it.

## 6. Autopilot (agent mandate)

Standing payments `{to, amount, every: daily|weekly|monthly, until?, maxTotal?}` are signed locally when due, inside the same per-payment and per-day limits as manual payments. If a limit, expiry or total cap blocks one, it is paused and logged. Every action is written to an audit log. No payee can be added except through the list.

## 7. Guardian shards

2-of-3 Shamir split of the 32-byte key with `shamirs-secret-sharing`. Payload `{v:1,i,t,n,a:last 8 of address,s:base64 shard}`, the same format as `src/wallet/sss.ts` in wayamesh-mobile, so shards made on either app recover on either app. Recovery verifies the rebuilt key's address ends with `a`.

## 7b. Web-only: "Connect wallet". Do not port it

The web wallet has a **Connect wallet** button (wagmi and ConnectKit) so a browser user can bring an outside wallet such as MetaMask. It is a web convenience, not part of the product model.

What it does on the web:

* **Fund the offline balance:** the connected wallet approves and deposits USDC for this device's address.
* **Pay now:** online payments come from the connected wallet's USDC.
* **Pay the network fee** to settle payments for other people.
* It is optional. Signing offline, chat, Autopilot and guardian recovery all work with only the device key.

What mobile should do instead:

* **Do not add wagmi, ConnectKit or any browser-wallet connector to wayamesh-mobile.** The app is the wallet, with its key in the hardware keystore. A second signing path widens the attack surface for no gain.
* **Port the intent, not the button:**
  1. Funding: show the device address and a QR code so the user can send USDC from any other wallet or exchange. If an in-app approval from another wallet is wanted later, use WalletConnect as a separate, optional feature behind its own review.
  2. Courier tips: a phone that holds a little USDC can settle other people's payments and keep the tip the payer added (`fee` in the payment). This is the part worth adopting on mobile.
  3. Reserve top-up: the mobile app moves USDC from its own address into the `MeshPayV2` reserve with the device key (approve, then `deposit(account, amount)`). The web "Move received funds" button does exactly this and is the path to copy.
* The "Buy USDC" and "Cash out" screens on web go through the connected wallet only when one is present. On mobile they always use the device key.

## 8. Test vectors

Mnemonic `test test test test test test test test test test test junk` (public development phrase, never fund it).

| | |
|---|---|
| account 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| account 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| payment | from account 0, to account 1, amount `2500000`, fee `10000`, nonce `123456789`, deadline `1800000000`, ref zero |
| EIP-712 signature (domain: contract above, chain 5042002) | `0xce2d8672b0c652618b921e8674d16f59a47a31415c0969e0ab85f57b0ae057d614ebf49dd2f1d7b17aaa3f003c5f324b3f0400986b6a7afd019c35f8de0425251b` |
| voucher code | `mp2:AvOf1uUarYj29M5quIJyec__uSJmcJl5cMUYEtw6AQx9AbUODRfcecgAAAAAAAAAAAAAAAAAJiWgAAAAAAAAJxAAAAAAB1vNFQAAAABrSdIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADOLYZysMZSYYuSHoZ00W9ZpHoxQVwJaeCrhfV7CuBX1hTr9J3S8dexeqo_ADxfMks_BACYa2p6_QGcNfjeBCUlGw` |
| contact card (account 0, name "Alice") | `mpc1:85_W5RqtiPb0zmq4gnJ5z_-5ImYDgxhTW1QQXUp6rmDAj8RflocYG0_fxiW9GnU_pzl_7XUFQWxpY2U` |
| safety number (account 0 key and account 1 key) | `58759 09493 34804 05456 20453 38405 23648 47293 61382 48952 26421 25824` |

A port is correct when it reproduces every row, and when a voucher it signs passes `check()` (returns `0`) on the live contract for a funded reserve.

## 9. Where to look in this repo

| Concern | File |
|---|---|
| Contract | `contracts/MeshPayV2.sol`, tests in `contracts/test/` |
| Voucher, EIP-712, wire format | `src/lib/mesh.ts` |
| Vault and PIN | `src/lib/vault.ts`, `src/lib/store.ts` |
| Recovery phrase | `src/lib/wallet.ts` |
| Guardians | `src/lib/guardians.ts` |
| Chat crypto, relays, service | `src/lib/chat/crypto.ts`, `relay.ts`, `service.ts` |
| Signing with limits, tips, refs | `src/lib/pay.ts`, `src/lib/policy.ts` |
| Receiving checks (expiry window, accept limit, invoices) | `src/lib/ingest.ts`, `src/lib/scan.ts` |
| Autopilot and chat engines | `src/hooks/useEngines.ts` |
| Settling (batch, tips) | `src/hooks/useSettle.ts` |

## 10. Suggested port order for wayamesh-mobile

1. Replace raw signed transfers with vouchers: `src/mesh/envelope.ts`, `src/wallet/transactions.ts`, add reserve top-up and the contract ABI. Verify with the test vectors.
2. Courier tips and `ref` invoices on top.
3. Receiving checks: expiry window, accept limit, `Funded` check.
4. Chat: contact cards, sealed boxes, relay transport, offline codes. Store in SQLite. Carry messages in the BLE path too.
5. Autopilot: point the existing mandate engine at vouchers, add expiry and total cap.
6. Keep biometrics, hardware keystore, Paymaster, i18n and USSD as they are.
7. Third-party audit of the contract and the chat protocol before any mainnet use.
