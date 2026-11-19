// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MeshPayV2TestBase} from "./MeshPayV2.Base.t.sol";
import {MeshPayV2} from "../MeshPayV2.sol";

contract MeshPayV2CoreTest is MeshPayV2TestBase {
    // ---------------- constructor ----------------

    function test_Constructor_SetsImmutables() public view {
        assertEq(address(pay.usdc()), address(usdc));
        assertEq(pay.WITHDRAW_DELAY(), DELAY);
    }

    function test_Constructor_RevertsZeroToken() public {
        vm.expectRevert(MeshPayV2.ZeroAddress.selector);
        new MeshPayV2(address(0), DELAY);
    }

    function test_Constructor_RevertsDelayOutOfRange() public {
        vm.expectRevert(MeshPayV2.InvalidDelay.selector);
        new MeshPayV2(address(usdc), 1 hours - 1);
        vm.expectRevert(MeshPayV2.InvalidDelay.selector);
        new MeshPayV2(address(usdc), 30 days + 1);
    }

    function test_Constructor_AcceptsDelayBounds() public {
        assertEq(new MeshPayV2(address(usdc), 1 hours).WITHDRAW_DELAY(), 1 hours);
        assertEq(new MeshPayV2(address(usdc), 30 days).WITHDRAW_DELAY(), 30 days);
    }

    // ---------------- deposit ----------------

    function test_Deposit_CreditsAccountAndEmits() public {
        vm.expectEmit(true, true, false, true, address(pay));
        emit MeshPayV2.Deposited(payer, funder, DEPOSIT);
        _deposit(payer, DEPOSIT);
        assertEq(pay.reserve(payer), DEPOSIT);
        assertEq(usdc.balanceOf(address(pay)), DEPOSIT);
    }

    function test_Deposit_RevertsZeroAddressAndAmount() public {
        vm.prank(funder);
        vm.expectRevert(MeshPayV2.ZeroAddress.selector);
        pay.deposit(address(0), 1);
        vm.prank(funder);
        vm.expectRevert(MeshPayV2.ZeroAmount.selector);
        pay.deposit(payer, 0);
    }

    // ---------------- settle happy path ----------------

    function test_Settle_PaysRecipientAndCourierFeeAndEmitsRef() public {
        _fund();
        MeshPayV2.Payment memory p = _p(bob, 100e6, 2e6, 1, T0 + 1 hours);
        bytes memory sig = _sign(payerPk, p);

        vm.expectEmit(true, true, true, true, address(pay));
        emit MeshPayV2.Settled(payer, bob, REF, 1, 100e6, 2e6, courier);
        vm.prank(courier);
        pay.settle(p, sig);

        assertEq(usdc.balanceOf(bob), 100e6);
        assertEq(usdc.balanceOf(courier), 2e6);
        assertEq(pay.reserve(payer), DEPOSIT - 102e6);
        assertEq(usdc.balanceOf(address(pay)), DEPOSIT - 102e6);
        assertTrue(pay.nonceUsed(payer, 1));
    }

    function test_Settle_ZeroFeePaysNoCourier() public {
        _fund();
        MeshPayV2.Payment memory p = _p(bob, 50e6, 0, 1, T0 + 1);
        vm.prank(courier);
        pay.settle(p, _sign(payerPk, p));
        assertEq(usdc.balanceOf(courier), 0);
        assertEq(usdc.balanceOf(bob), 50e6);
    }

    function test_Settle_DeadlineIsInclusive() public {
        _fund();
        MeshPayV2.Payment memory p = _p(bob, 1e6, 0, 1, T0 + 100);
        bytes memory sig = _sign(payerPk, p);
        vm.warp(T0 + 100);
        pay.settle(p, sig);
        assertEq(usdc.balanceOf(bob), 1e6);
    }

    // ---------------- settle revert paths ----------------

    function test_Settle_RevertsDeadlineZero() public {
        _fund();
        MeshPayV2.Payment memory p = _p(bob, 1e6, 0, 1, 0);
        bytes memory sig = _sign(payerPk, p);
        assertEq(pay.check(p, sig), 1);
        vm.expectRevert(abi.encodeWithSelector(MeshPayV2.PaymentRejected.selector, uint8(1)));
        pay.settle(p, sig);
        assertEq(usdc.balanceOf(bob), 0);
    }

    function test_Settle_RevertsZeroAmountZeroRecipient() public {
        _fund();
        MeshPayV2.Payment memory p = _p(bob, 0, 0, 1, T0 + 1);
        vm.expectRevert(abi.encodeWithSelector(MeshPayV2.PaymentRejected.selector, uint8(1)));
        pay.settle(p, _sign(payerPk, p));
        p = _p(address(0), 1e6, 0, 2, T0 + 1);
        vm.expectRevert(abi.encodeWithSelector(MeshPayV2.PaymentRejected.selector, uint8(1)));
        pay.settle(p, _sign(payerPk, p));
    }

    function test_Check_AmountPlusFeeOverflowReturnsCode1() public {
        _fund();
        MeshPayV2.Payment memory p = _p(bob, 1, type(uint256).max, 1, T0 + 1);
        assertEq(pay.check(p, _sign(payerPk, p)), 1);
    }

    function test_Settle_RevertsExpired() public {
        _fund();
        MeshPayV2.Payment memory p = _p(bob, 1e6, 0, 1, T0 + 10);
        bytes memory sig = _sign(payerPk, p);
        vm.warp(T0 + 11);
        vm.expectRevert(abi.encodeWithSelector(MeshPayV2.PaymentRejected.selector, uint8(2)));
        pay.settle(p, sig);
    }

    function test_Settle_RevertsReplay() public {
        _fund();
        MeshPayV2.Payment memory p = _p(bob, 1e6, 0, 1, T0 + 1 hours);
        bytes memory sig = _sign(payerPk, p);
        pay.settle(p, sig);
        vm.expectRevert(abi.encodeWithSelector(MeshPayV2.PaymentRejected.selector, uint8(3)));
        pay.settle(p, sig);
    }

    function test_Settle_RevertsBadSignatureWrongSignerAndTamper() public {
        _fund();
        MeshPayV2.Payment memory p = _p(bob, 1e6, 0, 1, T0 + 1 hours);
        bytes memory wrong = _sign(otherPk, p);
        vm.expectRevert(abi.encodeWithSelector(MeshPayV2.PaymentRejected.selector, uint8(4)));
        pay.settle(p, wrong);

        bytes memory good = _sign(payerPk, p);
        p.amount = 2e6; // tampered after signing
        vm.expectRevert(abi.encodeWithSelector(MeshPayV2.PaymentRejected.selector, uint8(4)));
        pay.settle(p, good);
    }

    function test_Settle_RevertsInsufficientReserveIncludingFee() public {
        _deposit(payer, 100e6);
        MeshPayV2.Payment memory p = _p(bob, 100e6, 1, 1, T0 + 1 hours);
        vm.expectRevert(abi.encodeWithSelector(MeshPayV2.PaymentRejected.selector, uint8(5)));
        pay.settle(p, _sign(payerPk, p));
    }

    function test_Settle_RevertsWhenRecipientTransferFails() public {
        _fund();
        usdc.setBlocked(bob, true);
        MeshPayV2.Payment memory p = _p(bob, 1e6, 0, 1, T0 + 1 hours);
        bytes memory sig = _sign(payerPk, p);
        vm.expectRevert();
        pay.settle(p, sig);
        assertEq(pay.reserve(payer), DEPOSIT);
        assertFalse(pay.nonceUsed(payer, 1));
    }

    function test_SettleIsolated_RevertsNotSelf() public {
        MeshPayV2.Payment memory p = _p(bob, 1e6, 0, 1, T0 + 1 hours);
        vm.expectRevert(MeshPayV2.NotSelf.selector);
        pay.settleIsolated(p, courier);
    }

    // ---------------- cancelNonce ----------------

    function test_CancelNonce_BurnsNonceAndEmits() public {
        _fund();
        MeshPayV2.Payment memory p = _p(bob, 1e6, 0, 7, T0 + 1 hours);
        bytes memory sig = _sign(payerPk, p);
        assertEq(pay.check(p, sig), 0);

        vm.expectEmit(true, false, false, true, address(pay));
        emit MeshPayV2.NonceCancelled(payer, 7);
        vm.prank(payer);
        pay.cancelNonce(7);

        assertTrue(pay.nonceUsed(payer, 7));
        assertEq(pay.check(p, sig), 3);
        vm.expectRevert(abi.encodeWithSelector(MeshPayV2.PaymentRejected.selector, uint8(3)));
        pay.settle(p, sig);
    }

    function test_CancelNonce_RevertsIfAlreadyUsed() public {
        vm.startPrank(payer);
        pay.cancelNonce(7);
        vm.expectRevert(abi.encodeWithSelector(MeshPayV2.PaymentRejected.selector, uint8(3)));
        pay.cancelNonce(7);
        vm.stopPrank();
    }

    function test_CancelNonce_OnlyAffectsCaller() public {
        vm.prank(other);
        pay.cancelNonce(7);
        assertFalse(pay.nonceUsed(payer, 7));
    }

    // ---------------- EIP-712 ----------------

    function test_PaymentDigest_MatchesLocalComputationAndSignatureVerifies() public {
        _fund();
        MeshPayV2.Payment memory p = _p(bob, 100e6, 1e6, 9, T0 + 1 hours);
        assertEq(pay.paymentDigest(p), _localDigest(p));
        assertEq(pay.PAYMENT_TYPEHASH(), keccak256(
            "Payment(address from,address to,uint256 amount,uint256 fee,uint256 nonce,uint256 deadline,bytes32 ref)"
        ));
        bytes memory sig = _sign(payerPk, p);
        assertEq(pay.check(p, sig), 0);
        // signature recovers to payer from the contract's own digest
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPk, pay.paymentDigest(p));
        assertEq(ecrecover(pay.paymentDigest(p), v, r, s), payer);
    }

    function test_PaymentDigest_ChangesWithEveryField() public view {
        MeshPayV2.Payment memory p = _p(bob, 100e6, 1e6, 9, T0 + 1 hours);
        bytes32 base = pay.paymentDigest(p);
        MeshPayV2.Payment memory q = _p(bob, 100e6, 1e6, 9, T0 + 1 hours);
        q.to = carol;
        assertNotEq(pay.paymentDigest(q), base);
        q = _p(bob, 100e6, 1e6, 9, T0 + 1 hours);
        q.ref = bytes32(uint256(1));
        assertNotEq(pay.paymentDigest(q), base);
        q = _p(bob, 100e6, 1e6, 9, T0 + 1 hours);
        q.fee = 0;
        assertNotEq(pay.paymentDigest(q), base);
    }

    function test_Signature_NotReplayableOnOtherDeployment() public {
        _fund();
        MeshPayV2 pay2 = new MeshPayV2(address(usdc), DELAY);
        MeshPayV2.Payment memory p = _p(bob, 1e6, 0, 1, T0 + 1 hours);
        bytes memory sig = _sign(payerPk, p); // signed for `pay`
        assertEq(pay.check(p, sig), 0);
        assertEq(pay2.check(p, sig), 4);
    }
}
