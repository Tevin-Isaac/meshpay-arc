# WayaMesh web wallet

A self-custody USDC wallet on Arc that works with or without internet. Sign payments offline and hand them over by QR code, pay online straight from your wallet, and chat with end-to-end encryption in the same thread. Any phone that gets a connection settles the payment on Arc.

Built with [Arc Studio](https://studio.arc.io)

This is the web reference for the [wayamesh-mobile](https://github.com/Tevin-Isaac/wayamesh-mobile) app. See `docs/PORTING-TO-WAYAMESH-MOBILE.md` for the protocol, test vectors and the porting plan.

## What it does

* Create a wallet with a 12-word recovery phrase and a PIN. Everything on the device is encrypted until you unlock.
* Offline payments: review, sign, hand over by QR or chat. Courier tips, invoice references, spending limits, and a limit for what you accept offline.
* Online payments: pay now from a connected wallet.
* Encrypted chat with contacts, online through relays and offline through hand-over codes. Pay and request payments inside the thread.
* Mesh: carry other people's payments and messages and deliver them when you get a connection.
* Autopilot: recurring payments that sign offline inside your limits, with an audit log.
* Recovery: recovery phrase, encrypted backup file, and 2-of-3 guardian shards.
* Buy USDC with the Circle onramp (sandbox, only when the small backend is running).

Testnet only. Arc Testnet and test USDC, no real money.

## Tech stack

React, TypeScript, Vite, Tailwind, wagmi and viem, a Solidity settlement contract (`contracts/MeshPayV2.sol`) built with Foundry, Nostr relays for chat transport.

## Development

Prerequisites: [Bun](https://bun.sh), and [Foundry](https://getfoundry.sh) only if you work on the contract.

```bash
bun install
bun run dev        # app on http://localhost:5173
bun run server     # optional: onramp backend on port 3001
bun run check      # lint and typecheck
bunx vite build    # production build in dist/
cd contracts && forge test   # contract tests
```

### Environment variables

| Name | Purpose |
|---|---|
| `VITE_MESHPAY_ADDRESS` | Settlement contract address on Arc Testnet |
| `VITE_MESHPAY_DELAY` | Withdraw delay in seconds, defaults to 86400 |
| `VITE_ONRAMP_WIDGET_BASE_URL` | Circle onramp widget URL (optional) |
| `VITE_OFFRAMP_URL` | Link to an off-ramp provider (optional) |
| `CIRCLE_API_KEY` | Circle sandbox key for the onramp backend. Server only, never in the browser (optional) |
| `ONRAMP_API_BASE_URL`, `ONRAMP_REFERRER_DOMAIN` | Onramp backend settings (optional) |
| `RPC_PROXY_BASE_URL`, `RPC_PROXY_TOKEN`, `RPC_PROXY_CHAINS` | Provisioned by Arc Studio. Optional outside Arc Studio |

Never commit `.env`.

## Security notes

The security model, including what offline payments can and cannot guarantee, is written down in `docs/PORTING-TO-WAYAMESH-MOBILE.md`. In short: offline acceptance is provisional until a payment settles, and the web PIN protects against casual access, not against someone who copies the encrypted vault file. Get an independent audit before any mainnet use.
