# MeshPay

Send USDC with no internet. Your phone signs a payment offline, hands it to the receiver as a QR code, and the first phone with a connection settles it on Arc Testnet.

Built with [Arc Studio](https://studio.arc.io)

## What you can do

- Add USDC from your wallet to an offline balance held for this phone.
- Sign payments with no connection and hand them over by QR code, copy, or the share sheet.
- Receive and verify signed payments on your phone before you are online.
- Carry someone else's payment and settle it for them once you have a connection.
- Set per-payment and daily spending limits that are enforced on the phone.
- Cash out your offline balance back to your wallet.

## Tech stack

React, Vite, TypeScript, Tailwind CSS, wagmi, viem, ConnectKit, Solidity (Foundry), USDC on Arc Testnet.

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://getfoundry.sh).

```bash
bun install
bun run dev
```

Contracts live in `contracts/`:

```bash
bun run contracts:build
bun run contracts:test
```

### Environment variables

- `VITE_MESHPAY_ADDRESS`: address of the deployed MeshPay contract on Arc Testnet.

## Notes

- The signing key is stored in this browser. Back it up from the Limits screen. It is demo grade storage.
- A web page cannot use Bluetooth to hand off payments, so QR codes and the share sheet are used.
