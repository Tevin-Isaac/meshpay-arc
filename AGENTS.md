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
