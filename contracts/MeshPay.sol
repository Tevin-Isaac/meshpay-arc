// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title MeshPay
/// @notice Prepaid USDC payments signed offline and submitted by any courier.
/// @dev Signatures authorize payments, not encryption. The signing device must control
///      `from` or be authorized by its ERC-1271 wallet; there is no device-key registry.
///      Offline acceptance is not final: reserves, nonces, and wallet signatures can
///      change before settlement. Amounts use the configured USDC token's base units.
contract MeshPay is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice An authorization bound to this contract and chain by EIP-712.
    struct Payment {
        address from;
        address to;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    /// @notice Token held as prepaid reserves and paid out upon settlement.
    IERC20 public immutable usdc;

    /// @notice EIP-712 type hash for Payment authorizations.
    bytes32 public constant PAYMENT_TYPEHASH = keccak256(
        "Payment(address from,address to,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    /// @notice Unspent prepaid balance for each payer.
    mapping(address => uint256) public reserve;

    /// @notice True for a settled or cancelled payer nonce.
    mapping(address => mapping(uint256 => bool)) public nonceUsed;

    /// @notice A required address was zero.
    error ZeroAddress();
    /// @notice A deposit or withdrawal amount was zero.
    error ZeroAmount();
    /// @notice A withdrawal exceeds the caller's reserve.
    error InsufficientReserve();
    /// @notice Payment validation failed with the code documented by check().
    error PaymentRejected(uint8 code);
    /// @notice The payment and signature arrays differ in length.
    error BatchLengthMismatch();
    /// @notice More than 50 payments were supplied.
    error BatchTooLarge();
    /// @notice Only this contract may call isolated settlement.
    error NotSelf();

    /// @notice Emitted when a funder credits an account's prepaid reserve.
    event Deposited(address indexed account, address indexed funder, uint256 amount);
    /// @notice Emitted when an account withdraws its prepaid reserve.
    event Withdrawn(address indexed account, uint256 amount);
    /// @notice Emitted when a payer burns an unused nonce.
    event NonceCancelled(address indexed from, uint256 nonce);
    /// @notice Emitted upon successful payment to the signed recipient.
    event Settled(
        address indexed from,
        address indexed to,
        uint256 nonce,
        uint256 amount,
        address relayer
    );
    /// @notice Emitted for an item that fails batch payment validation.
    event Rejected(address indexed from, uint256 nonce, uint8 code);

    /// @param usdc_ USDC token address for the intended network.
    constructor(address usdc_) EIP712("MeshPay", "1") {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
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

    /// @notice Withdraw the caller's reserve to the caller.
    /// @param amount USDC base units to withdraw.
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (reserve[msg.sender] < amount) revert InsufficientReserve();

        reserve[msg.sender] -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Compute the full EIP-712 digest to sign for a payment.
    /// @param p Payment authorization; a zero deadline means no expiry.
    /// @return digest Domain-separated payment hash.
    function paymentDigest(Payment calldata p) public view returns (bytes32 digest) {
        return _hashTypedDataV4(
            keccak256(abi.encode(PAYMENT_TYPEHASH, p.from, p.to, p.amount, p.nonce, p.deadline))
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
    /// @return code 0: valid; 1: zero amount or recipient; 2: expired;
    ///         3: nonce used; 4: bad signature; 5: insufficient reserve.
    /// @dev Code 6 means token transfer failed in settleBatch; check does not attempt transfers.
    function check(Payment calldata p, bytes calldata signature) external view returns (uint8 code) {
        return _check(p, signature);
    }

    /// @notice Settle a signed payment; anyone may act as courier.
    /// @param p Payment to settle.
    /// @param signature EOA or ERC-1271 signature for p.from.
    function settle(Payment calldata p, bytes calldata signature) external nonReentrant {
        uint8 code = _check(p, signature);
        if (code != 0) revert PaymentRejected(code);
        _settle(p);
    }

    /// @notice Settle up to 50 payments, skipping validation and token transfer failures.
    /// @dev Items execute in order, so repeated nonces receive code 3 after success.
    ///      Token transfer failures roll back only the failed item and return code 6.
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
            try this.settleIsolated(ps[i]) {} catch {
                codes[i] = 6;
                emit Rejected(ps[i].from, ps[i].nonce, 6);
            }
        }
    }

    /// @dev Self-only settlement boundary; settleBatch holds the reentrancy guard.
    function settleIsolated(Payment calldata p) external {
        if (msg.sender != address(this)) revert NotSelf();
        _settle(p);
    }

    /// @dev Validate in reject-code order, using current state for every item.
    function _check(Payment calldata p, bytes calldata signature) internal view returns (uint8) {
        if (p.amount == 0 || p.to == address(0)) return 1;
        if (p.deadline != 0 && block.timestamp > p.deadline) return 2;
        if (nonceUsed[p.from][p.nonce]) return 3;
        if (!SignatureChecker.isValidSignatureNow(p.from, paymentDigest(p), signature)) return 4;
        if (reserve[p.from] < p.amount) return 5;
        return 0;
    }

    /// @dev Called only after successful validation under the reentrancy guard.
    ///      Consume the nonce and reserve before interacting with the token.
    function _settle(Payment calldata p) internal {
        nonceUsed[p.from][p.nonce] = true;
        reserve[p.from] -= p.amount;
        usdc.safeTransfer(p.to, p.amount);
        emit Settled(p.from, p.to, p.nonce, p.amount, msg.sender);
    }
}
