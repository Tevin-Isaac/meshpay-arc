// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MeshPayV2TestBase} from "./MeshPayV2.Base.t.sol";
import {MeshPayV2} from "../MeshPayV2.sol";

contract MeshPayV2WithdrawTest is MeshPayV2TestBase {
    function setUp() public override {
        super.setUp();
        _fund();
    }

    function test_RequestWithdraw_RecordsRequestEmitsAndKeepsReserve() public {
        vm.expectEmit(true, false, false, true, address(pay));
        emit MeshPayV2.WithdrawRequested(payer, 400e6, T0 + DELAY);
        vm.prank(payer);
        pay.requestWithdraw(400e6);

        (uint256 amount, uint256 unlockAt) = pay.withdrawalRequest(payer);
        assertEq(amount, 400e6);
        assertEq(unlockAt, T0 + DELAY);
        assertEq(pay.reserve(payer), DEPOSIT);
    }

    function test_RequestWithdraw_Reverts() public {
        vm.prank(payer);
        vm.expectRevert(MeshPayV2.ZeroAmount.selector);
        pay.requestWithdraw(0);
        vm.prank(payer);
        vm.expectRevert(MeshPayV2.InsufficientReserve.selector);
        pay.requestWithdraw(DEPOSIT + 1);
        vm.prank(bob); // no reserve
        vm.expectRevert(MeshPayV2.InsufficientReserve.selector);
        pay.requestWithdraw(1);
    }

    function test_Finalize_RevertsBeforeUnlock() public {
        vm.prank(payer);
        pay.requestWithdraw(400e6);
        vm.warp(T0 + DELAY - 1);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(MeshPayV2.WithdrawalLocked.selector, T0 + DELAY));
        pay.finalizeWithdraw();
    }

    function test_Finalize_PaysAfterUnlockAndEmits() public {
        vm.prank(payer);
        pay.requestWithdraw(400e6);
        vm.warp(T0 + DELAY);
        vm.expectEmit(true, false, false, true, address(pay));
        emit MeshPayV2.Withdrawn(payer, 400e6);
        vm.prank(payer);
        pay.finalizeWithdraw();

        assertEq(usdc.balanceOf(payer), 400e6);
        assertEq(pay.reserve(payer), DEPOSIT - 400e6);
        (uint256 amount,) = pay.withdrawalRequest(payer);
        assertEq(amount, 0);

        vm.prank(payer);
        vm.expectRevert(MeshPayV2.NoWithdrawal.selector);
        pay.finalizeWithdraw();
    }

    function test_Finalize_RevertsWithoutRequest() public {
        vm.prank(payer);
        vm.expectRevert(MeshPayV2.NoWithdrawal.selector);
        pay.finalizeWithdraw();
    }

    function test_Finalize_FailedTransferRevertsAndPreservesRequest() public {
        vm.prank(payer);
        pay.requestWithdraw(400e6);
        usdc.setBlocked(payer, true);
        vm.warp(T0 + DELAY);
        vm.prank(payer);
        vm.expectRevert();
        pay.finalizeWithdraw();
        assertEq(pay.reserve(payer), DEPOSIT);
        (uint256 amount,) = pay.withdrawalRequest(payer);
        assertEq(amount, 400e6);
    }

    function test_CancelWithdraw_ClearsRequestAndEmits() public {
        vm.startPrank(payer);
        pay.requestWithdraw(400e6);
        vm.expectEmit(true, false, false, true, address(pay));
        emit MeshPayV2.WithdrawCancelled(payer);
        pay.cancelWithdraw();
        vm.stopPrank();

        (uint256 amount, uint256 unlockAt) = pay.withdrawalRequest(payer);
        assertEq(amount, 0);
        assertEq(unlockAt, 0);
        assertEq(pay.reserve(payer), DEPOSIT);

        vm.warp(T0 + DELAY);
        vm.prank(payer);
        vm.expectRevert(MeshPayV2.NoWithdrawal.selector);
        pay.finalizeWithdraw();
    }

    function test_CancelWithdraw_RevertsWithoutRequest() public {
        vm.prank(payer);
        vm.expectRevert(MeshPayV2.NoWithdrawal.selector);
        pay.cancelWithdraw();
    }

    function test_RequestWithdraw_ReplacesRequestAndRestartsTimer() public {
        vm.prank(payer);
        pay.requestWithdraw(400e6);
        vm.warp(T0 + DELAY - 10);
        vm.prank(payer);
        pay.requestWithdraw(100e6);
        (uint256 amount, uint256 unlockAt) = pay.withdrawalRequest(payer);
        assertEq(amount, 100e6);
        assertEq(unlockAt, T0 + DELAY - 10 + DELAY);

        vm.warp(T0 + DELAY);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(MeshPayV2.WithdrawalLocked.selector, unlockAt));
        pay.finalizeWithdraw();
    }

    function test_PendingRequestDoesNotLockFunds_SignedPaymentStillSettles() public {
        // Payer signs a payment, hands it to bob, THEN requests to withdraw everything.
        MeshPayV2.Payment memory p = _p(bob, 600e6, 5e6, 1, T0 + DELAY);
        bytes memory sig = _sign(payerPk, p);

        vm.prank(payer);
        pay.requestWithdraw(DEPOSIT);

        // Mid-delay, payment still validates and settles.
        vm.warp(T0 + DELAY / 2);
        assertEq(pay.check(p, sig), 0);
        vm.prank(courier);
        pay.settle(p, sig);
        assertEq(usdc.balanceOf(bob), 600e6);
        assertEq(usdc.balanceOf(courier), 5e6);
        assertEq(pay.reserve(payer), DEPOSIT - 605e6);

        // Finalization pays only the lesser of the request and the remaining reserve.
        vm.warp(T0 + DELAY);
        vm.prank(payer);
        pay.finalizeWithdraw();
        assertEq(usdc.balanceOf(payer), DEPOSIT - 605e6);
        assertEq(pay.reserve(payer), 0);
        assertEq(usdc.balanceOf(address(pay)), 0);
    }

    function test_Finalize_PayoutZeroWhenReserveFullySpent() public {
        vm.prank(payer);
        pay.requestWithdraw(DEPOSIT);
        MeshPayV2.Payment memory p = _p(bob, DEPOSIT, 0, 1, T0 + DELAY);
        pay.settle(p, _sign(payerPk, p));
        vm.warp(T0 + DELAY);
        vm.expectEmit(true, false, false, true, address(pay));
        emit MeshPayV2.Withdrawn(payer, 0);
        vm.prank(payer);
        pay.finalizeWithdraw();
        assertEq(usdc.balanceOf(payer), 0);
    }

    function test_AfterFinalize_PaymentExceedingReserveRejected() public {
        MeshPayV2.Payment memory p = _p(bob, 700e6, 0, 1, T0 + DELAY + 1);
        bytes memory sig = _sign(payerPk, p);
        vm.prank(payer);
        pay.requestWithdraw(500e6);
        vm.warp(T0 + DELAY);
        vm.prank(payer);
        pay.finalizeWithdraw();
        assertEq(pay.check(p, sig), 5);
    }
}
