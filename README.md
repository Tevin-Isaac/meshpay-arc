# MeshPay

Send USDC with no internet. Your phone signs a payment offline, hands it to the receiver as a QR code, and the first phone with a connection settles it on Arc Testnet.

Built with [Arc Studio](https://studio.arc.io)

## What you can do

- Add USDC from your wallet to an offline balance held for this phone.
- Sign payments with no connection and hand them over by QR code, copy, or the share sheet.
- Receive and verify signed payments on your phone before you are online.
- Carry someone else's payment and settle it for them once you have a connection.
- Set per-payment and daily spending limits that are enforced on the phone.
- Pay online too: send USDC straight from your wallet and it lands in about a second.
- Buy USDC with a bank transfer or card through Circle's onramp (sandbox).
- Cash out your offline balance to your wallet, or to an exchange or off-ramp deposit address.

- Watch or download a short demo video (MP4) and GIF from the bottom of the app.

## Tech stack

React, Vite, TypeScript, Tailwind CSS, wagmi, viem, ConnectKit, Solidity (Foundry), USDC on Arc Testnet.

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://getfoundry.sh).

```bash
bun install
bun run dev      # the app
bun run server   # the small backend that starts Buy USDC sessions (needs CIRCLE_API_KEY)
```

Contracts live in `contracts/`:

```bash
bun run contracts:build
bun run contracts:test
```

### Environment variables

- `VITE_MESHPAY_ADDRESS`: address of the deployed MeshPay contract on Arc Testnet.
- `CIRCLE_API_KEY`: Circle API key used by the backend to start Buy USDC sessions. Server only, never exposed to the browser.
- `ONRAMP_API_BASE_URL`: Circle onramp API origin. Use the sandbox value for testing.
- `VITE_ONRAMP_WIDGET_BASE_URL`: Circle onramp widget origin. Must match the environment of the API origin.
- `ONRAMP_REFERRER_DOMAIN`: hostname that embeds the widget. Server only.
- `VITE_OFFRAMP_URL`: optional link to your chosen off-ramp provider, opened from Cash out.

## Notes

- The signing key is stored in this browser. Back it up from the Limits screen. It is demo grade storage.
- A web page cannot use Bluetooth to hand off payments, so QR codes and the share sheet are used.
