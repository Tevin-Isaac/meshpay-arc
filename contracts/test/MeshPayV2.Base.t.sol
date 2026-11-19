// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MeshPayV2} from "../MeshPayV2.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

abstract contract MeshPayV2TestBase is Test {
    MeshPayV2 internal pay;
    MockERC20 internal usdc;

    uint256 internal constant DELAY = 1 days;
    uint256 internal constant T0 = 1_000_000;
    uint256 internal constant DEPOSIT = 1_000e6;

    address internal payer;
    uint256 internal payerPk;
    address internal other;
    uint256 internal otherPk;
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal courier = makeAddr("courier");
    address internal funder = makeAddr("funder");

    bytes32 internal constant REF = keccak256("invoice-42");

    function setUp() public virtual {
        vm.warp(T0);
        (payer, payerPk) = makeAddrAndKey("payer");
        (other, otherPk) = makeAddrAndKey("other");
        usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        pay = new MeshPayV2(address(usdc), DELAY);

        usdc.mint(funder, 10_000e6);
        vm.prank(funder);
        usdc.approve(address(pay), type(uint256).max);
    }

    function _deposit(address account, uint256 amount) internal {
        vm.prank(funder);
        pay.deposit(account, amount);
    }

    function _fund() internal {
        _deposit(payer, DEPOSIT);
    }

    function _p(address to, uint256 amount, uint256 fee, uint256 nonce, uint256 deadline)
        internal
        view
        returns (MeshPayV2.Payment memory)
    {
        return MeshPayV2.Payment(payer, to, amount, fee, nonce, deadline, REF);
    }

    /// @dev Independently computed EIP-712 digest (does not call the contract).
    function _localDigest(MeshPayV2.Payment memory p) internal view returns (bytes32) {
        bytes32 domainSep = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("MeshPay"),
                keccak256("2"),
                block.chainid,
                address(pay)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Payment(address from,address to,uint256 amount,uint256 fee,uint256 nonce,uint256 deadline,bytes32 ref)"
                ),
                p.from,
                p.to,
                p.amount,
                p.fee,
                p.nonce,
                p.deadline,
                p.ref
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
    }

    function _sign(uint256 pk, MeshPayV2.Payment memory p) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, _localDigest(p));
        return abi.encodePacked(r, s, v);
    }
}
