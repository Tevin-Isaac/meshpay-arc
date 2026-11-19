// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MeshPayV2TestBase} from "./MeshPayV2.Base.t.sol";
import {MeshPayV2} from "../MeshPayV2.sol";

contract MeshPayV2FuzzTest is MeshPayV2TestBase {
    function testFuzz_ReserveAccounting_NeverUnderflowsOrExceedsDeposit(
        uint256 dep,
        uint256 amount,
        uint256 fee,
        uint256 wd
    ) public {
        dep = bound(dep, 1, 5_000e6);
        amount = bound(amount, 1, 6_000e6);
        fee = bound(fee, 0, 6_000e6);
        wd = bound(wd, 1, dep);

        _deposit(payer, dep);
        MeshPayV2.Payment memory p = _p(bob, amount, fee, 1, T0 + DELAY);
        bytes memory sig = _sign(payerPk, p);

        vm.prank(payer);
        pay.requestWithdraw(wd);

        bool affordable = amount + fee <= dep;
        if (affordable) {
            assertEq(pay.check(p, sig), 0);
            vm.prank(courier);
            pay.settle(p, sig);
            assertEq(pay.reserve(payer), dep - amount - fee);
        } else {
            assertEq(pay.check(p, sig), 5);
            vm.expectRevert(abi.encodeWithSelector(MeshPayV2.PaymentRejected.selector, uint8(5)));
            pay.settle(p, sig);
            assertEq(pay.reserve(payer), dep);
        }
        assertLe(pay.reserve(payer), dep);

        vm.warp(T0 + DELAY);
        uint256 reserveBefore = pay.reserve(payer);
        vm.prank(payer);
        pay.finalizeWithdraw();

        uint256 paid = usdc.balanceOf(payer);
        assertEq(paid, wd < reserveBefore ? wd : reserveBefore);
        assertEq(pay.reserve(payer), reserveBefore - paid);
        assertLe(paid, dep);
        // conservation: token held by the contract equals remaining reserve
        assertEq(usdc.balanceOf(address(pay)), pay.reserve(payer));
        // conservation: everything deposited is accounted for
        assertEq(
            usdc.balanceOf(address(pay)) + usdc.balanceOf(bob) + usdc.balanceOf(courier) + paid,
            dep
        );
    }

    function testFuzz_FeeOverflowNeverRevertsCheck(uint256 amount, uint256 fee) public {
        _fund();
        MeshPayV2.Payment memory p = _p(bob, amount, fee, 1, T0 + 1);
        bytes memory sig = _sign(payerPk, p);
        uint8 code = pay.check(p, sig); // must not revert for any input
        if (amount == 0 || fee > type(uint256).max - amount) assertEq(code, 1);
        else if (amount + fee > DEPOSIT) assertEq(code, 5);
        else assertEq(code, 0);
    }

    function testFuzz_DepositThenFullWithdrawRoundTrip(uint256 dep) public {
        dep = bound(dep, 1, 10_000e6);
        _deposit(payer, dep);
        vm.startPrank(payer);
        pay.requestWithdraw(dep);
        vm.warp(T0 + DELAY);
        pay.finalizeWithdraw();
        vm.stopPrank();
        assertEq(usdc.balanceOf(payer), dep);
        assertEq(pay.reserve(payer), 0);
    }
}
