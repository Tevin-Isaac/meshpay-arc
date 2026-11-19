# Verify MeshPayV2 on Arc Testnet

Contract: `0xd619b77bb8389a632800c300969ef152099f7691` (Arc Testnet, chain 5042002)

1. Open https://testnet.arcscan.app/address/0xd619b77bb8389a632800c300969ef152099f7691 and choose "Verify & publish".
2. Method: Solidity (Standard JSON input). Contract name: `MeshPayV2`.
3. Compiler: use the version from `foundry.toml` in this repo.
4. Upload `MeshPayV2.standard-input.json`.
5. Constructor arguments (ABI-encoded, no 0x): paste the contents of `constructor-args.txt`.

If the explorer asks for the EVM version or optimizer settings, take them from `foundry.toml`.
