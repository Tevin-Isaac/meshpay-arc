// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MeshPayV2TestBase} from "./MeshPayV2.Base.t.sol";
import {MeshPayV2} from "../MeshPayV2.sol";

contract MeshPayV2BatchTest is MeshPayV2TestBase {
    function _batch(uint256 n) internal pure returns (MeshPayV2.Payment[] memory ps, bytes[] memory sigs) {
        ps = new MeshPayV2.Payment[](n);
        sigs = new bytes[](n);
    }

    function test_SettleBatch_MixedItems() public {
        _deposit(payer, 100e6);
        usdc.setBlocked(carol, true);

        (MeshPayV2.Payment[] memory ps, bytes[] memory sigs) = _batch(8);
        // 0: valid (40 + 1 fee)
        ps[0] = _p(bob, 40e6, 1e6, 1, T0 + 1 hours);
        sigs[0] = _sign(payerPk, ps[0]);
        // 1: expired
        ps[1] = _p(bob, 1e6, 0, 2, T0 - 1);
        sigs[1] = _sign(payerPk, ps[1]);
        // 2: duplicate nonce of item 0 (different amount) -> 3 (nonce consumed in-order)
        ps[2] = _p(bob, 5e6, 0, 1, T0 + 1 hours);
        sigs[2] = _sign(payerPk, ps[2]);
        // 3: bad signature (signed by other key)
        ps[3] = _p(bob, 1e6, 0, 3, T0 + 1 hours);
        sigs[3] = _sign(otherPk, ps[3]);
        // 4: insufficient reserve
        ps[4] = _p(bob, 500e6, 0, 4, T0 + 1 hours);
        sigs[4] = _sign(payerPk, ps[4]);
        // 5: recipient transfer reverts -> 6, isolated
        ps[5] = _p(carol, 10e6, 1e6, 5, T0 + 1 hours);
        sigs[5] = _sign(payerPk, ps[5]);
        // 6: valid AFTER the failing item (30 + 2 fee)
        ps[6] = _p(bob, 30e6, 2e6, 6, T0 + 1 hours);
        sigs[6] = _sign(payerPk, ps[6]);
        // 7: deadline == 0 -> 1
        ps[7] = _p(bob, 1e6, 0, 7, 0);
        sigs[7] = _sign(payerPk, ps[7]);

        vm.expectEmit(true, true, true, true, address(pay));
        emit MeshPayV2.Settled(payer, bob, REF, 1, 40e6, 1e6, courier);
        vm.expectEmit(true, false, false, true, address(pay));
        emit MeshPayV2.Rejected(payer, 2, 2);
        vm.expectEmit(true, false, false, true, address(pay));
        emit MeshPayV2.Rejected(payer, 1, 3);
        vm.expectEmit(true, false, false, true, address(pay));
        emit MeshPayV2.Rejected(payer, 3, 4);
        vm.expectEmit(true, false, false, true, address(pay));
        emit MeshPayV2.Rejected(payer, 4, 5);
        vm.expectEmit(true, false, false, true, address(pay));
        emit MeshPayV2.Rejected(payer, 5, 6);

        vm.prank(courier);
        uint8[] memory codes = pay.settleBatch(ps, sigs);

        assertEq(codes.length, 8);
        assertEq(codes[0], 0);
        assertEq(codes[1], 2);
        assertEq(codes[2], 3);
        assertEq(codes[3], 4);
        assertEq(codes[4], 5);
        assertEq(codes[5], 6);
        assertEq(codes[6], 0);
        assertEq(codes[7], 1);

        // Only items 0 and 6 moved funds.
        assertEq(usdc.balanceOf(bob), 70e6);
        assertEq(usdc.balanceOf(carol), 0);
        assertEq(usdc.balanceOf(courier), 3e6);
        assertEq(pay.reserve(payer), 100e6 - 73e6);
        assertEq(usdc.balanceOf(address(pay)), 27e6);

        // Failed transfer item rolled back fully: nonce not consumed.
        assertFalse(pay.nonceUsed(payer, 5));
        assertTrue(pay.nonceUsed(payer, 1));
        assertTrue(pay.nonceUsed(payer, 6));
        assertFalse(pay.nonceUsed(payer, 2));
    }

    function test_SettleBatch_FailedItemRetriableAfterUnblock() public {
        _fund();
        usdc.setBlocked(carol, true);
        (MeshPayV2.Payment[] memory ps, bytes[] memory sigs) = _batch(1);
        ps[0] = _p(carol, 10e6, 0, 5, T0 + 1 hours);
        sigs[0] = _sign(payerPk, ps[0]);
        assertEq(pay.settleBatch(ps, sigs)[0], 6);
        usdc.setBlocked(carol, false);
        assertEq(pay.settleBatch(ps, sigs)[0], 0);
        assertEq(usdc.balanceOf(carol), 10e6);
    }

    function test_SettleBatch_CourierFeeTransferFailureIsolated() public {
        _fund();
        usdc.setBlocked(courier, true);
        (MeshPayV2.Payment[] memory ps, bytes[] memory sigs) = _batch(2);
        ps[0] = _p(bob, 10e6, 1e6, 1, T0 + 1 hours); // fee to blocked courier -> 6
        sigs[0] = _sign(payerPk, ps[0]);
        ps[1] = _p(bob, 20e6, 0, 2, T0 + 1 hours); // no fee -> ok
        sigs[1] = _sign(payerPk, ps[1]);

        vm.prank(courier);
        uint8[] memory codes = pay.settleBatch(ps, sigs);
        assertEq(codes[0], 6);
        assertEq(codes[1], 0);
        // item 0's recipient payment was rolled back together with the failed fee
        assertEq(usdc.balanceOf(bob), 20e6);
        assertEq(pay.reserve(payer), DEPOSIT - 20e6);
        assertFalse(pay.nonceUsed(payer, 1));
    }

    function test_SettleBatch_SameNonceTwiceFirstWins() public {
        _fund();
        (MeshPayV2.Payment[] memory ps, bytes[] memory sigs) = _batch(2);
        ps[0] = _p(bob, 10e6, 0, 1, T0 + 1 hours);
        sigs[0] = _sign(payerPk, ps[0]);
        ps[1] = _p(carol, 10e6, 0, 1, T0 + 1 hours);
        sigs[1] = _sign(payerPk, ps[1]);
        uint8[] memory codes = pay.settleBatch(ps, sigs);
        assertEq(codes[0], 0);
        assertEq(codes[1], 3);
        assertEq(usdc.balanceOf(carol), 0);
    }

    function test_SettleBatch_ReserveConsumedInOrder() public {
        _deposit(payer, 15e6);
        (MeshPayV2.Payment[] memory ps, bytes[] memory sigs) = _batch(2);
        ps[0] = _p(bob, 10e6, 0, 1, T0 + 1 hours);
        sigs[0] = _sign(payerPk, ps[0]);
        ps[1] = _p(bob, 10e6, 0, 2, T0 + 1 hours);
        sigs[1] = _sign(payerPk, ps[1]);
        uint8[] memory codes = pay.settleBatch(ps, sigs);
        assertEq(codes[0], 0);
        assertEq(codes[1], 5);
        assertEq(pay.reserve(payer), 5e6);
    }

    function test_SettleBatch_EmptyBatchOk() public {
        (MeshPayV2.Payment[] memory ps, bytes[] memory sigs) = _batch(0);
        assertEq(pay.settleBatch(ps, sigs).length, 0);
    }

    function test_SettleBatch_RevertsLengthMismatch() public {
        MeshPayV2.Payment[] memory ps = new MeshPayV2.Payment[](2);
        bytes[] memory sigs = new bytes[](1);
        vm.expectRevert(MeshPayV2.BatchLengthMismatch.selector);
        pay.settleBatch(ps, sigs);
    }

    function test_SettleBatch_RevertsTooLarge() public {
        (MeshPayV2.Payment[] memory ps, bytes[] memory sigs) = _batch(51);
        vm.expectRevert(MeshPayV2.BatchTooLarge.selector);
        pay.settleBatch(ps, sigs);
    }

    function test_SettleBatch_Accepts50Items() public {
        _fund();
        (MeshPayV2.Payment[] memory ps, bytes[] memory sigs) = _batch(50);
        for (uint256 i = 0; i < 50; i++) {
            ps[i] = _p(bob, 1e6, 0, i, T0 + 1 hours);
            sigs[i] = _sign(payerPk, ps[i]);
        }
        uint8[] memory codes = pay.settleBatch(ps, sigs);
        for (uint256 i = 0; i < 50; i++) assertEq(codes[i], 0);
        assertEq(usdc.balanceOf(bob), 50e6);
    }
}
