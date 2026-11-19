# Verify MeshPay on Arc Testnet

Contract: `0x41f84ad06cd7f256c67fbb62906899c29611d6ef`
Compiler: Solidity 0.8.28, EVM `cancun`, optimizer on (see the settings inside the JSON file).
Constructor argument (USDC): `0x3600000000000000000000000000000000000000`
ABI-encoded: `0x0000000000000000000000003600000000000000000000000000000000000000`

1. Open the contract on https://testnet.arcscan.app and choose Verify & Publish.
2. Pick "Solidity (Standard JSON input)", compiler 0.8.28.
3. Upload `MeshPay.standard-input.json`, paste the ABI-encoded constructor argument above, and submit.
