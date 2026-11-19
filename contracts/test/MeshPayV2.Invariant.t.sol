// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MeshPayV2} from "../MeshPayV2.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

contract MeshPayV2Handler is Test {
    MeshPayV2 public pay;
    MockERC20 public usdc;

    address[3] public actors;
    uint256[3] internal keys;
    address public constant RECIPIENT = address(0xB0B);
    address public constant COURIER = address(0xC0C);

    uint256 public ghostDeposited;
    uint256 public ghostPaidOut; // recipient + courier + withdrawn
    uint256 internal nonceCtr;

    constructor(MeshPayV2 pay_, MockERC20 usdc_) {
        pay = pay_;
        usdc = usdc_;
        for (uint256 i = 0; i < 3; i++) {
            (actors[i], keys[i]) = makeAddrAndKey(string(abi.encodePacked("actor", vm.toString(i))));
            usdc.mint(actors[i], 1e15);
            vm.prank(actors[i]);
            usdc.approve(address(pay), type(uint256).max);
        }
    }

    function sumReserves() external view returns (uint256 s) {
        for (uint256 i = 0; i < 3; i++) s += pay.reserve(actors[i]);
    }

    function deposit(uint256 who, uint256 amount) external {
        who = bound(who, 0, 2);
        amount = bound(amount, 1, 1_000e6);
        vm.prank(actors[who]);
        pay.deposit(actors[who], amount);
        ghostDeposited += amount;
    }

    function settle(uint256 who, uint256 amount, uint256 fee) external {
        who = bound(who, 0, 2);
        amount = bound(amount, 1, 800e6);
        fee = bound(fee, 0, 50e6);
        MeshPayV2.Payment memory p =
            MeshPayV2.Payment(actors[who], RECIPIENT, amount, fee, ++nonceCtr, block.timestamp + 1, bytes32(0));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(keys[who], pay.paymentDigest(p));
        bytes memory sig = abi.encodePacked(r, s, v);
        uint8 code = pay.check(p, sig);
        if (code != 0) return;
        vm.prank(COURIER);
        pay.settle(p, sig);
        ghostPaidOut += amount + fee;
    }

    function requestWithdraw(uint256 who, uint256 amount) external {
        who = bound(who, 0, 2);
        uint256 r = pay.reserve(actors[who]);
        if (r == 0) return;
        amount = bound(amount, 1, r);
        vm.prank(actors[who]);
        pay.requestWithdraw(amount);
    }

    function finalizeWithdraw(uint256 who) external {
        who = bound(who, 0, 2);
        (uint256 amt, uint256 unlockAt) = pay.withdrawalRequest(actors[who]);
        if (amt == 0) return;
        vm.warp(unlockAt);
        uint256 before = usdc.balanceOf(actors[who]);
        vm.prank(actors[who]);
        pay.finalizeWithdraw();
        ghostPaidOut += usdc.balanceOf(actors[who]) - before;
    }

    function cancelWithdraw(uint256 who) external {
        who = bound(who, 0, 2);
        (uint256 amt,) = pay.withdrawalRequest(actors[who]);
        if (amt == 0) return;
        vm.prank(actors[who]);
        pay.cancelWithdraw();
    }

    function cancelNonce(uint256 who, uint256 nonce) external {
        who = bound(who, 0, 2);
        vm.prank(actors[who]);
        try pay.cancelNonce(nonce) {} catch {}
    }

    function warp(uint256 dt) external {
        vm.warp(block.timestamp + bound(dt, 0, 2 days));
    }
}

contract MeshPayV2InvariantTest is Test {
    MeshPayV2 internal pay;
    MockERC20 internal usdc;
    MeshPayV2Handler internal handler;

    function setUp() public {
        vm.warp(1_000_000);
        usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        pay = new MeshPayV2(address(usdc), 1 days);
        handler = new MeshPayV2Handler(pay, usdc);
        targetContract(address(handler));
    }

    /// @dev Token held by the contract always equals the sum of reserves (solvency, no underflow).
    function invariant_TokenBalanceEqualsSumOfReserves() public view {
        assertEq(usdc.balanceOf(address(pay)), handler.sumReserves());
    }

    /// @dev Reserves never exceed cumulative deposits, and deposits - payouts == reserves.
    function invariant_ReservesNeverExceedDeposits() public view {
        uint256 sum = handler.sumReserves();
        assertLe(sum, handler.ghostDeposited());
        assertEq(handler.ghostDeposited() - handler.ghostPaidOut(), sum);
    }
}
