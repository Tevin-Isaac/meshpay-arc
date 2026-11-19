// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title MeshPayV2
/// @notice Prepaid USDC payments signed offline and submitted by any courier.
/// @dev Signatures authorize payments, not encryption. The signing device must control
///      `from` or be authorized by its ERC-1271 wallet; there is no device-key registry.
///      A signed payment can settle only from the payer's reserve, including its courier
///      fee. Amounts use the configured USDC token's base units. There is no owner or admin.
///      Withdrawals are delayed by WITHDRAW_DELAY. A pending request does NOT lock funds:
///      payments signed before the request with deadline <= unlockAt can still settle,
///      subject to current reserve, nonce, and signature validity. At unlockAt, settlement
///      and withdrawal finalization can race.
///      The delay protects against 'sign, hand over, then withdraw' by providing a
///      settlement window, but it does NOT prevent offline double-spending. A malicious
///      payer can sign conflicting payments, including to another address they control;
///      whichever settles first wins, and the later receiver is NOT compensated onchain.
///      Receivers must size what they accept offline to what they would trust the payer
///      with and should check the payer's reserve and pending withdrawal when online.
///      cancelNonce lets a payer void an unsettled authorization, so offline acceptance
///      is provisional until settlement. Reserves and wallet signatures can also change
///      before settlement.
contract MeshPayV2 is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice An authorization bound to this contract and chain by EIP-712.
    struct Payment {
        /// @notice Payer whose reserve and signature authorize settlement.
        address from;
        /// @notice Recipient of the payment amount.
        address to;
        /// @notice USDC base units paid to the recipient; must be nonzero.
        uint256 amount;
        /// @notice Additional USDC base units paid to the submitting courier.
        uint256 fee;
        /// @notice Single-use nonce scoped to the payer.
        uint256 nonce;
        /// @notice Last valid settlement timestamp, inclusive; must be nonzero.
        uint256 deadline;
        /// @notice Opaque invoice or chat reference emitted upon settlement.
        bytes32 ref;
    }

    /// @notice A delayed withdrawal intent that does not lock the account's reserve.
    struct WithdrawalRequest {
        /// @notice Maximum USDC base units requested for withdrawal.
        uint256 amount;
        /// @notice Earliest timestamp at which finalization is allowed.
        uint256 unlockAt;
    }

    /// @notice Token held as prepaid reserves and paid out upon settlement.
    IERC20 public immutable usdc;

    /// @notice Immutable delay in seconds between a withdrawal request and finalization.
    uint256 public immutable WITHDRAW_DELAY;

    /// @notice EIP-712 type hash for Payment authorizations.
    bytes32 public constant PAYMENT_TYPEHASH = keccak256(
        "Payment(address from,address to,uint256 amount,uint256 fee,uint256 nonce,uint256 deadline,bytes32 ref)"
    );

    /// @notice Unspent prepaid balance for each payer.
    mapping(address => uint256) public reserve;

    /// @notice True for a settled or cancelled payer nonce.
    mapping(address => mapping(uint256 => bool)) public nonceUsed;

    /// @notice Current withdrawal intent for each account; a zero amount means none.
    mapping(address => WithdrawalRequest) public withdrawalRequest;

    /// @notice A required address was zero.
    error ZeroAddress();
    /// @notice A deposit or withdrawal amount was zero.
    error ZeroAmount();
    /// @notice A withdrawal exceeds the caller's reserve.
    error InsufficientReserve();
    /// @notice The withdrawal delay is outside the inclusive one-hour to thirty-day range.
    error InvalidDelay();
    /// @notice The caller has no pending withdrawal request.
    error NoWithdrawal();
    /// @notice The pending withdrawal cannot yet be finalized.
    /// @param unlockAt Earliest timestamp at which finalization is allowed.
    error WithdrawalLocked(uint256 unlockAt);
    /// @notice Payment validation failed with the code documented by check().
    /// @param code Validation rejection code.
    error PaymentRejected(uint8 code);
    /// @notice The payment and signature arrays differ in length.
    error BatchLengthMismatch();
    /// @notice More than 50 payments were supplied.
    error BatchTooLarge();
    /// @notice Only this contract may call isolated settlement.
    error NotSelf();

    /// @notice Emitted when a funder credits an account's prepaid reserve.
    event Deposited(address indexed account, address indexed funder, uint256 amount);
    /// @notice Emitted when an account creates or replaces its withdrawal request.
    event WithdrawRequested(address indexed account, uint256 amount, uint256 unlockAt);
    /// @notice Emitted when an account cancels its pending withdrawal request.
    event WithdrawCancelled(address indexed account);
    /// @notice Emitted when an account withdraws its prepaid reserve.
    event Withdrawn(address indexed account, uint256 amount);
    /// @notice Emitted when a payer burns an unused nonce.
    event NonceCancelled(address indexed from, uint256 nonce);
    /// @notice Emitted upon successful payment and courier fee transfer.
    event Settled(
        address indexed from,
        address indexed to,
        bytes32 indexed ref,
        uint256 nonce,
        uint256 amount,
        uint256 fee,
        address relayer
    );
    /// @notice Emitted for an item that fails batch payment validation or transfer.
    event Rejected(address indexed from, uint256 nonce, uint8 code);

    /// @notice Configure the reserve token, withdrawal delay, and v2 signing domain.
    /// @param usdc_ USDC token address for the intended network.
    /// @param withdrawDelay_ Withdrawal delay in seconds, from 1 hours through 30 days inclusive.
    constructor(address usdc_, uint256 withdrawDelay_) EIP712("MeshPay", "2") {
        if (usdc_ == address(0)) revert ZeroAddress();
        if (withdrawDelay_ < 1 hours || withdrawDelay_ > 30 days) revert InvalidDelay();
        usdc = IERC20(usdc_);
        WITHDRAW_DELAY = withdrawDelay_;
    }

    /// @notice Fund any account's reserve using tokens approved by the caller.
    /// @dev Intended for standard, non-fee-on-transfer USDC.
    /// @param account Account credited with the deposit.
    /// @param amount USDC base units pulled from the caller.
    function deposit(address account, uint256 amount) external nonReentrant {
        if (account == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        reserve[account] += amount;
        emit Deposited(account, msg.sender, amount);
    }

    /// @notice Request a delayed withdrawal, replacing any previous request and restarting its timer.
    /// @dev A pending request does NOT lock funds. The reserve stays spendable by signed
    ///      payments until finalizeWithdraw executes. Payments signed before this request
    ///      with deadline no later than unlockAt can still settle during the delay;
    ///      receivers rely on that window, subject to current reserve, nonce, and signature validity.
    /// @param amount Maximum USDC base units to withdraw after the delay.
    function requestWithdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (reserve[msg.sender] < amount) revert InsufficientReserve();

        uint256 unlockAt = block.timestamp + WITHDRAW_DELAY;
        withdrawalRequest[msg.sender] = WithdrawalRequest(amount, unlockAt);
        emit WithdrawRequested(msg.sender, amount, unlockAt);
    }

    /// @notice Cancel the caller's pending withdrawal without changing its reserve.
    function cancelWithdraw() external nonReentrant {
        if (withdrawalRequest[msg.sender].amount == 0) revert NoWithdrawal();
        delete withdrawalRequest[msg.sender];
        emit WithdrawCancelled(msg.sender);
    }

    /// @notice Finalize an unlocked withdrawal, paying the lesser of its amount and current reserve.
    /// @dev Payments may have spent the reserve during the delay, so the payout can be zero.
    ///      The reserve is decreased and the request deleted before transferring tokens.
    ///      A failed token transfer reverts the entire finalization, preserving the request.
    function finalizeWithdraw() external nonReentrant {
        WithdrawalRequest memory request = withdrawalRequest[msg.sender];
        if (request.amount == 0) revert NoWithdrawal();
        if (block.timestamp < request.unlockAt) revert WithdrawalLocked(request.unlockAt);

        uint256 balance = reserve[msg.sender];
        uint256 amount = request.amount < balance ? request.amount : balance;
        reserve[msg.sender] = balance - amount;
        delete withdrawalRequest[msg.sender];
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Compute the full EIP-712 digest to sign for a payment.
    /// @param p Payment authorization; v2 requires a nonzero deadline for settlement.
    /// @return digest Domain-separated payment hash.
    function paymentDigest(Payment calldata p) public view returns (bytes32 digest) {
        return _hashTypedDataV4(
            keccak256(abi.encode(PAYMENT_TYPEHASH, p.from, p.to, p.amount, p.fee, p.nonce, p.deadline, p.ref))
        );
    }

    /// @notice Burn an unused nonce belonging to the caller.
    /// @param nonce Nonce to cancel, invalidating any outstanding authorization using it.
    function cancelNonce(uint256 nonce) external nonReentrant {
        if (nonceUsed[msg.sender][nonce]) revert PaymentRejected(3);
        nonceUsed[msg.sender][nonce] = true;
        emit NonceCancelled(msg.sender, nonce);
    }

    /// @notice Pre-validate a payment against current onchain state.
    /// @dev This result does not reserve funds or guarantee later settlement.
    /// @param p Payment to validate.
    /// @param signature EOA or ERC-1271 signature for p.from.
    /// @return code 0: valid; 1: zero amount, recipient, or deadline, or amount-plus-fee overflow;
    ///         2: expired; 3: nonce used; 4: bad signature; 5: insufficient reserve for amount plus fee.
    /// @dev Code 6 means token transfer failed in settleBatch; check does not attempt transfers.
    function check(Payment calldata p, bytes calldata signature) public view returns (uint8 code) {
        return _check(p, signature);
    }

    /// @notice Settle a signed payment; anyone may act as courier and collect its fee.
    /// @param p Payment to settle.
    /// @param signature EOA or ERC-1271 signature for p.from.
    function settle(Payment calldata p, bytes calldata signature) external nonReentrant {
        uint8 code = _check(p, signature);
        if (code != 0) revert PaymentRejected(code);
        _settle(p, msg.sender);
    }

    /// @notice Settle up to 50 payments, skipping validation and token transfer failures.
    /// @dev Items execute in order, so repeated nonces receive code 3 after success.
    ///      Either transfer failing rolls back only that item and returns code 6.
    ///      Fees go to the original caller, not the external self-call boundary.
    /// @param ps Payments to validate and settle.
    /// @param sigs Corresponding EOA or ERC-1271 signatures.
    /// @return codes Validation code for each item, as documented by check().
    function settleBatch(Payment[] calldata ps, bytes[] calldata sigs)
        external
        nonReentrant
        returns (uint8[] memory codes)
    {
        uint256 length = ps.length;
        if (length != sigs.length) revert BatchLengthMismatch();
        if (length > 50) revert BatchTooLarge();

        codes = new uint8[](length);
        for (uint256 i = 0; i < length; ++i) {
            uint8 code = _check(ps[i], sigs[i]);
            codes[i] = code;
            if (code != 0) {
                emit Rejected(ps[i].from, ps[i].nonce, code);
                continue;
            }
            try this.settleIsolated(ps[i], msg.sender) {} catch {
                codes[i] = 6;
                emit Rejected(ps[i].from, ps[i].nonce, 6);
            }
        }
    }

    /// @notice Execute an already validated batch item through a self-only rollback boundary.
    /// @dev settleBatch holds the reentrancy guard; this function intentionally has no guard.
    /// @param p Payment already validated by settleBatch.
    /// @param courier Original caller of settleBatch, entitled to the signed fee.
    function settleIsolated(Payment calldata p, address courier) external {
        if (msg.sender != address(this)) revert NotSelf();
        _settle(p, courier);
    }

    /// @dev Validate in reject-code order, using current state for every item.
    /// @param p Payment to validate.
    /// @param signature EOA or ERC-1271 signature for p.from.
    /// @return Validation code documented by check(); never returns transfer-failure code 6.
    function _check(Payment calldata p, bytes calldata signature) internal view returns (uint8) {
        if (
            p.amount == 0 || p.to == address(0) || p.deadline == 0
                || p.fee > type(uint256).max - p.amount
        ) return 1;
        if (block.timestamp > p.deadline) return 2;
        if (nonceUsed[p.from][p.nonce]) return 3;
        if (!SignatureChecker.isValidSignatureNow(p.from, paymentDigest(p), signature)) return 4;
        if (reserve[p.from] < p.amount + p.fee) return 5;
        return 0;
    }

    /// @dev Called only after successful validation under the reentrancy guard.
    ///      Consume the nonce and total reserve before interacting with the token.
    /// @param p Validated payment to execute.
    /// @param courier Recipient of the signed fee and relayer recorded in the event.
    function _settle(Payment calldata p, address courier) internal {
        nonceUsed[p.from][p.nonce] = true;
        reserve[p.from] -= p.amount + p.fee;
        usdc.safeTransfer(p.to, p.amount);
        if (p.fee > 0) usdc.safeTransfer(courier, p.fee);
        emit Settled(p.from, p.to, p.ref, p.nonce, p.amount, p.fee, courier);
    }
}
