# MeshPay: what is missing before a public launch

MeshPay today is a working testnet product: payments sign offline, travel by QR code, and settle on Arc Testnet. This list is what stands between it and a product you would put real money through. Items are ranked P0 (must have before real funds), P1 (needed for a good launch), P2 (growth).

## P0: money safety

1. **Independent security audit of the contract.** The built-in review was clean after one fix, but it is not a substitute for a paid third-party audit. Add a bug bounty after launch.
2. **Withdrawal delay.** Today a payer can sign a payment, hand it over, then withdraw their reserve before it settles, leaving the receiver unpaid. Withdrawals should be a two-step request with a delay longer than the payment lifetime (7 days).
3. **Real unit, fuzz and invariant tests.** The contract has no test suite yet. Reserve accounting and nonce handling need property tests.
4. **Proper key protection.** The signing key sits in browser storage. It can be lost by clearing the browser and is exposed to any script injection. Ship native iOS and Android apps that keep the key in the Secure Enclave or Android Keystore, unlocked by biometrics, with an encrypted recovery option.
5. **Receiver risk controls.** Let a receiver set a maximum they will accept offline, and show the payer's last verified balance and age on every incoming payment.
6. **Mainnet deployment owned by you.** A mainnet deploy must come from your own wallet and keys, after the audit, with the contract verified on the explorer. Arc Studio does not deploy to mainnet for you.

## P1: product

7. **Gasless settlement.** Whoever settles pays a network fee today. Add a relayer or paymaster that pays the fee and takes a small USDC fee from the payer's reserve, so a receiver with an empty wallet can settle.
8. **Bluetooth and NFC handoff.** Not possible from a web page. Needs the native apps.
9. **Background settlement.** Settle automatically the moment a phone reconnects, with a notification, instead of waiting for a tap.
10. **Names instead of addresses.** Contacts, shareable payment links, and name or phone lookup so people do not paste 0x addresses.
11. **Cash in and cash out.** Add a fiat on-ramp and off-ramp so people can get USDC without already holding it.
12. **Receipts and history export**, push notifications, multiple languages, and an accessibility pass.
13. **Larger payloads.** Animated or multi-part QR codes for batches and future features.

## P1: operations

14. **Monitoring.** Contract event indexer, alerts for rejected or duplicate payments, uptime checks, and error reporting.
15. **RPC redundancy.** More than one RPC provider so settlement works during provider outages.
16. **CI.** Build, test and lint on every change, plus a staged testnet release before mainnet.

## P1: legal and compliance

17. **Licensing review.** Moving money for other people can require money transmitter or similar licences depending on where you operate. Get legal advice per market.
18. **Sanctions and fraud screening**, terms of service, privacy policy, and a dispute and support process.

## P2: growth

19. Agent wallets with standing payments, merchant tools (invoices, point of sale), EURC and other stablecoins, and a public developer SDK.

## Already in place

- Offline signing and local verification.
- Duplicate and replay protection through per-payer nonces.
- Spending limits enforced on the device.
- Any phone can carry and settle someone else's payment.
- Offline-capable app shell.
