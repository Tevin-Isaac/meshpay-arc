# MeshPay

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Offline-first USDC payments on Arc Testnet. A phone signs an EIP-712 payment with a local device key (no internet), hands it over by QR code or share sheet, and any online phone settles it through the MeshPay contract. Duplicates are rejected by per-payer nonces.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```


## Deployed Contracts

- MeshPay (Arc Testnet, 5042002): `0x41f84ad06cd7f256c67fbb62906899c29611d6ef` (USDC `0x3600000000000000000000000000000000000000`). Address is also in `.env` as `VITE_MESHPAY_ADDRESS`.
- Model: payer's device key address holds a prepaid `reserve` in the contract (`deposit(account, amount)`). Signed vouchers draw from it; `settle` / `settleBatch` are permissionless.
- Voucher wire format: `mp1:` + base64url of 138 bytes (see `src/lib/mesh.ts`). Receive request QR: `meshpay:<address>?amount=`.
- Device key lives in localStorage (`meshpay.v1`). Demo grade; a native app would use secure hardware.
- Offline shell: `public/sw.js` (network first, cache fallback). Bluetooth handoff is not possible from a web page, so QR and the share sheet are used.

## Onramp / payments

- Pay now: `src/components/PayNowForm.tsx` sends USDC from the device key (plain ERC-20 transfer, gas in USDC). A connected external wallet is an optional second source. Recorded locally as `kind: 'online'`.
- Connecting a wallet is optional and lives only in Settings (External wallet). No core flow may require it. Balances: `src/lib/balance.ts`, `fmtUsdc` (truncates to 2 dp) and `fmtExact` (up to 6 dp) in `src/lib/format.ts`.
- Buy USDC: Circle App Kit onramp in sandbox (`api-test.circle.com`, `onramp-sandbox.arc.io`). Backend `scripts/onramp-server.ts` (`bun run server`, port 3001, proxied at `/api` by Vite) mints sessions only after the wallet signs `onrampAuthMessage`. Sandbox test funds land on Ethereum, not Arc.
- Offramp: Circle has no self-serve hosted offramp widget for apps. Cash out sends USDC to the wallet or any address (exchange/off-ramp deposit address). A bank payout needs a licensed provider partnership.
- Production onramp needs a mainnet API key, KYB, and `ONRAMP_REFERRER_DOMAIN` set to the KYB domain.

## Recent additions

- 24-hour chat expiry: `src/lib/chat/expiry.ts` (tests: `npm run test:expiry`). Relay events carry a NIP-40 expiration tag, receivers drop older messages, `purgeExpiredMessages` runs on start, foreground, every 5 minutes and when a thread opens.
- M-Pesa ramp: `ramp-server/` (mock mode by default), `src/lib/ramp.ts`, `src/components/MpesaSheet.tsx`. See `ramp-server/README.md`.
- Mountable build: `VITE_BASE`, `VITE_APP_PATH`, `scripts/sync-to-website.sh <website repo>` for wayamesh.xyz/app.
- Run checks with npm or bun: `npm test`, `npx tsc --noEmit`, `npx vite build`, `forge test`.

## WayaMesh v2 (current)

- Settlement contract v2: `MeshPayV2` at `0xd619b77bb8389a632800c300969ef152099f7691` on Arc Testnet (5042002). Constructor: USDC `0x3600000000000000000000000000000000000000`, withdraw delay 86400. 50 Foundry tests pass. Reviewed twice; the bond/shortfall idea was removed after each version opened a new drain path for the payer.
- `VITE_MESHPAY_ADDRESS` points at v2. v1 (`0x41f84ad06cd7f256c67fbb62906899c29611d6ef`) is superseded.
- App: five tabs (Wallet, Chats, History, Mesh, Settings), PIN vault with recovery phrase, encrypted chat over Nostr relays and offline codes, Autopilot, guardian shards.
- Porting guide and test vectors for wayamesh-mobile: `docs/PORTING-TO-WAYAMESH-MOBILE.md`.
- Dev server must run with `--host 0.0.0.0 --port 5173 --strictPort` so the Arc Studio preview can reach it.
