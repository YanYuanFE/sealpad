// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title SealPad — Confidential Token Sale Platform
/// @notice Supports Fixed Price and Dutch Auction sales with FHE-encrypted contributions.
///         Dutch Auction: users choose their own bid price (public) + encrypted amount.
///         Independent deposit pool: deposit first, then contribute/bid without moving funds.
contract SealPad is ZamaEthereumConfig, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================================
    //                           TYPES
    // ============================================================

    enum SaleType {
        FixedPrice,
        DutchAuction
    }
    enum SaleStatus {
        Active,
        Finalizing,
        Settled,
        Failed,
        Cancelled
    }

    struct Sale {
        address creator;
        address saleToken;
        uint256 saleAmount;
        address payToken; // address(0) = native ETH
        SaleType saleType;
        uint64 price; // FixedPrice: token price | Dutch: floor price (min bid)
        // Caps
        uint64 softCap; // min total raise (payToken units)
        uint64 hardCap; // max total raise
        uint64 maxPerUser; // per-user max contribution (0 = no limit)
        // Time
        uint64 startTime;
        uint64 endTime;
        // Whitelist
        bytes32 whitelistRoot; // bytes32(0) = no whitelist
        // Vesting
        uint64 cliffDuration; // seconds, 0 = no vesting
        uint64 vestingDuration; // linear release seconds after cliff
        // State
        SaleStatus status;
        uint8 participantCount;
        // Settlement results (set after settle)
        uint64 clearingPrice;
        uint64 totalRaised;
        uint64 settledAt;
    }

    // ============================================================
    //                          STORAGE
    // ============================================================

    uint256 public nextSaleId;
    mapping(uint256 => Sale) internal _sales;

    // Independent deposit pool
    mapping(uint256 => mapping(address => uint64)) public deposits;

    // Participant tracking
    mapping(uint256 => address[]) internal _participants;
    mapping(uint256 => mapping(address => bool)) public hasParticipated;

    // Fixed Price: encrypted contributions + running total
    mapping(uint256 => mapping(address => euint64)) internal _contributions;
    mapping(uint256 => euint64) internal _totalContributed;

    // Dutch Auction: user bid price (public) + encrypted bid amount
    mapping(uint256 => mapping(address => uint64)) public userBidPrice;
    mapping(uint256 => mapping(address => euint64)) internal _bidAmounts;

    // Post-settlement allocations (saleToken units)
    mapping(uint256 => mapping(address => uint256)) public allocations;
    mapping(uint256 => mapping(address => uint256)) public tokensClaimed;

    // Dutch Auction clearing result (used internally during settle)
    struct ClearingResult {
        uint64 clearingPrice;
        bool hasOverflow;
        uint256 overflowDemand; // total tokens demanded at clearing price level
        uint256 overflowRemaining; // remaining tokens when clearing price reached
        uint64 totalContributed;
        bool found; // whether a clearing price was determined
    }

    // ============================================================
    //                         CONSTANTS
    // ============================================================

    uint8 public constant MAX_PARTICIPANTS = 50;
    uint256 public constant PRICE_SCALE = 1e18;

    // ============================================================
    //                          EVENTS
    // ============================================================

    event SaleCreated(uint256 indexed saleId, address indexed creator, SaleType saleType);
    event SaleCancelled(uint256 indexed saleId);
    event Deposited(uint256 indexed saleId, address indexed user, uint64 amount, uint64 totalDeposit);
    event DepositWithdrawn(uint256 indexed saleId, address indexed user, uint64 amount);
    event ContributionPlaced(uint256 indexed saleId, address indexed user);
    event BidPlaced(uint256 indexed saleId, address indexed user, uint64 bidPrice);
    event SaleFinalizing(uint256 indexed saleId);
    event SaleSettled(uint256 indexed saleId, uint64 clearingPrice, uint64 totalRaised);
    event SaleFailed(uint256 indexed saleId);
    event AllocationSet(uint256 indexed saleId, address indexed user, uint256 tokens);
    event TokensClaimed(uint256 indexed saleId, address indexed user, uint256 amount);

    // ============================================================
    //                          ERRORS
    // ============================================================

    error InvalidParams();
    error SaleNotActive();
    error SaleNotStarted();
    error SaleEnded();
    error SaleNotEnded();
    error NotCreator();
    error HasParticipants();
    error MaxParticipantsReached();
    error InsufficientDeposit();
    error DepositMismatch();
    error PriceBelowFloor();
    error NotWhitelisted();
    error NotFinalizing();
    error NotSettled();
    error NotFinished();
    error NothingToClaim();
    error NothingToWithdraw();
    error ETHTransferFailed();

    // ============================================================
    //                     INTERNAL HELPERS
    // ============================================================

    function _isETH(address token) internal pure returns (bool) {
        return token == address(0);
    }

    function _transferPayToken(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (_isETH(token)) {
            (bool ok, ) = to.call{value: amount}("");
            if (!ok) revert ETHTransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    function _checkWhitelist(bytes32 root, address user, bytes32[] calldata proof) internal pure {
        if (root == bytes32(0)) return;
        bytes32 leaf = keccak256(abi.encodePacked(user));
        if (!MerkleProof.verify(proof, root, leaf)) revert NotWhitelisted();
    }

    function _encodeUint64Array(uint64[] calldata values) internal pure returns (bytes memory result) {
        for (uint256 i = 0; i < values.length; i++) {
            result = bytes.concat(result, abi.encode(values[i]));
        }
    }

    // ============================================================
    //                     CREATE / CANCEL
    // ============================================================

    struct CreateSaleParams {
        address saleToken;
        uint256 saleAmount;
        address payToken;
        SaleType saleType;
        uint64 price; // FixedPrice: token price | Dutch: floor price
        uint64 softCap;
        uint64 hardCap;
        uint64 maxPerUser; // 0 = no limit
        uint64 startTime;
        uint64 endTime;
        bytes32 whitelistRoot; // bytes32(0) = no whitelist
        uint64 cliffDuration; // 0 = no vesting
        uint64 vestingDuration;
    }

    function createSale(CreateSaleParams calldata p) external nonReentrant returns (uint256 saleId) {
        if (p.endTime <= p.startTime) revert InvalidParams();
        if (p.softCap == 0 || p.softCap > p.hardCap) revert InvalidParams();
        if (p.saleAmount == 0) revert InvalidParams();
        if (p.price == 0) revert InvalidParams();
        if (p.saleType == SaleType.FixedPrice && uint256(p.hardCap) > Math.mulDiv(p.saleAmount, p.price, PRICE_SCALE))
            revert InvalidParams();

        saleId = nextSaleId++;

        Sale storage s = _sales[saleId];
        s.creator = msg.sender;
        s.saleToken = p.saleToken;
        s.saleAmount = p.saleAmount;
        s.payToken = p.payToken;
        s.saleType = p.saleType;
        s.price = p.price;
        s.softCap = p.softCap;
        s.hardCap = p.hardCap;
        s.maxPerUser = p.maxPerUser;
        s.startTime = p.startTime;
        s.endTime = p.endTime;
        s.whitelistRoot = p.whitelistRoot;
        s.cliffDuration = p.cliffDuration;
        s.vestingDuration = p.vestingDuration;
        s.status = SaleStatus.Active;

        // Lock sale tokens
        IERC20(p.saleToken).safeTransferFrom(msg.sender, address(this), p.saleAmount);

        // Initialize encrypted accumulator for Fixed Price
        if (p.saleType == SaleType.FixedPrice) {
            _totalContributed[saleId] = FHE.asEuint64(0);
            FHE.allowThis(_totalContributed[saleId]);
        }

        emit SaleCreated(saleId, msg.sender, p.saleType);
    }

    function cancelSale(uint256 saleId) external nonReentrant {
        Sale storage s = _sales[saleId];
        if (msg.sender != s.creator) revert NotCreator();
        if (s.status != SaleStatus.Active) revert SaleNotActive();
        if (s.participantCount > 0) revert HasParticipants();

        s.status = SaleStatus.Cancelled;
        IERC20(s.saleToken).safeTransfer(s.creator, s.saleAmount);
        emit SaleCancelled(saleId);
    }

    // ============================================================
    //                     DEPOSIT FUNCTIONS
    // ============================================================

    function addDeposit(uint256 saleId, uint64 amount) external payable nonReentrant {
        Sale storage s = _sales[saleId];
        if (s.status != SaleStatus.Active) revert SaleNotActive();
        if (block.timestamp < s.startTime) revert SaleNotStarted();
        if (block.timestamp >= s.endTime) revert SaleEnded();

        uint64 depositAmount;
        if (_isETH(s.payToken)) {
            depositAmount = uint64(msg.value);
            if (msg.value != uint256(depositAmount)) revert DepositMismatch();
        } else {
            if (msg.value != 0) revert DepositMismatch();
            depositAmount = amount;
            IERC20(s.payToken).safeTransferFrom(msg.sender, address(this), depositAmount);
        }

        deposits[saleId][msg.sender] += depositAmount;
        emit Deposited(saleId, msg.sender, depositAmount, deposits[saleId][msg.sender]);
    }

    function withdrawDeposit(uint256 saleId) external nonReentrant {
        Sale storage s = _sales[saleId];
        bool isFinished =
            s.status == SaleStatus.Settled || s.status == SaleStatus.Failed || s.status == SaleStatus.Cancelled;
        bool noBid = !hasParticipated[saleId][msg.sender];

        if (!isFinished && !noBid) revert NotFinished();

        uint64 amt = deposits[saleId][msg.sender];
        if (amt == 0) revert NothingToWithdraw();

        deposits[saleId][msg.sender] = 0;
        _transferPayToken(s.payToken, msg.sender, amt);
        emit DepositWithdrawn(saleId, msg.sender, amt);
    }

    // ============================================================
    //                  CONTRIBUTE (Fixed Price)
    // ============================================================

    function contribute(
        uint256 saleId,
        externalEuint64 encAmount,
        bytes calldata inputProof,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        Sale storage s = _sales[saleId];
        if (s.status != SaleStatus.Active) revert SaleNotActive();
        if (s.saleType != SaleType.FixedPrice) revert InvalidParams();
        if (block.timestamp < s.startTime) revert SaleNotStarted();
        if (block.timestamp >= s.endTime) revert SaleEnded();
        _checkWhitelist(s.whitelistRoot, msg.sender, merkleProof);

        uint64 userDeposit = deposits[saleId][msg.sender];
        if (userDeposit == 0) revert InsufficientDeposit();

        euint64 amount = FHE.fromExternal(encAmount, inputProof);
        uint64 cap = (s.maxPerUser > 0 && s.maxPerUser < userDeposit) ? s.maxPerUser : userDeposit;
        amount = FHE.min(amount, FHE.asEuint64(cap));
        FHE.allowThis(amount);
        FHE.allow(amount, msg.sender);

        if (hasParticipated[saleId][msg.sender]) {
            euint64 oldAmount = _contributions[saleId][msg.sender];
            _totalContributed[saleId] = FHE.add(FHE.sub(_totalContributed[saleId], oldAmount), amount);
        } else {
            if (s.participantCount >= MAX_PARTICIPANTS) revert MaxParticipantsReached();
            _totalContributed[saleId] = FHE.add(_totalContributed[saleId], amount);
            _participants[saleId].push(msg.sender);
            hasParticipated[saleId][msg.sender] = true;
            s.participantCount++;
        }
        FHE.allowThis(_totalContributed[saleId]);

        _contributions[saleId][msg.sender] = amount;
        emit ContributionPlaced(saleId, msg.sender);
    }

    // ============================================================
    //                  BID (Dutch Auction)
    // ============================================================

    /// @notice Place or update a Dutch Auction bid.
    /// @param bidPrice User's chosen price per token (public, must >= floor price).
    /// @param encAmount FHE-encrypted total investment amount (capped at deposit).
    function bid(
        uint256 saleId,
        uint64 bidPrice,
        externalEuint64 encAmount,
        bytes calldata inputProof,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        Sale storage s = _sales[saleId];
        if (s.status != SaleStatus.Active) revert SaleNotActive();
        if (s.saleType != SaleType.DutchAuction) revert InvalidParams();
        if (bidPrice < s.price) revert PriceBelowFloor();
        if (block.timestamp < s.startTime) revert SaleNotStarted();
        if (block.timestamp >= s.endTime) revert SaleEnded();
        _checkWhitelist(s.whitelistRoot, msg.sender, merkleProof);

        uint64 userDeposit = deposits[saleId][msg.sender];
        if (userDeposit == 0) revert InsufficientDeposit();

        euint64 amount = FHE.fromExternal(encAmount, inputProof);
        uint64 cap = (s.maxPerUser > 0 && s.maxPerUser < userDeposit) ? s.maxPerUser : userDeposit;
        amount = FHE.min(amount, FHE.asEuint64(cap));
        FHE.allowThis(amount);
        FHE.allow(amount, msg.sender);

        if (!hasParticipated[saleId][msg.sender]) {
            if (s.participantCount >= MAX_PARTICIPANTS) revert MaxParticipantsReached();
            _participants[saleId].push(msg.sender);
            hasParticipated[saleId][msg.sender] = true;
            s.participantCount++;
        }

        userBidPrice[saleId][msg.sender] = bidPrice;
        _bidAmounts[saleId][msg.sender] = amount;

        emit BidPlaced(saleId, msg.sender, bidPrice);
    }

    // ============================================================
    //                   FINALIZE (Phase 1)
    // ============================================================

    function finalize(uint256 saleId) external nonReentrant {
        Sale storage s = _sales[saleId];
        if (s.status != SaleStatus.Active) revert SaleNotActive();
        if (block.timestamp < s.endTime) revert SaleNotEnded();

        if (s.participantCount == 0) {
            s.status = SaleStatus.Failed;
            IERC20(s.saleToken).safeTransfer(s.creator, s.saleAmount);
            emit SaleFailed(saleId);
            return;
        }

        s.status = SaleStatus.Finalizing;

        if (s.saleType == SaleType.FixedPrice) {
            FHE.makePubliclyDecryptable(_totalContributed[saleId]);
        }

        // Mark all individual amounts for decryption
        for (uint8 i = 0; i < s.participantCount; i++) {
            address user = _participants[saleId][i];
            if (s.saleType == SaleType.FixedPrice) {
                FHE.makePubliclyDecryptable(_contributions[saleId][user]);
            } else {
                FHE.makePubliclyDecryptable(_bidAmounts[saleId][user]);
            }
        }

        emit SaleFinalizing(saleId);
    }

    // ============================================================
    //                  SETTLE FIXED PRICE (Phase 2)
    // ============================================================

    /// @param decryptedValues [totalContributed, contrib_user0, contrib_user1, ...]
    function settleFixed(
        uint256 saleId,
        uint64[] calldata decryptedValues,
        bytes calldata decryptionProof
    ) external nonReentrant {
        Sale storage s = _sales[saleId];
        if (s.status != SaleStatus.Finalizing) revert NotFinalizing();
        if (s.saleType != SaleType.FixedPrice) revert InvalidParams();

        uint256 n = s.participantCount;
        if (decryptedValues.length != 1 + n) revert InvalidParams();

        bytes32[] memory handles = new bytes32[](1 + n);
        handles[0] = euint64.unwrap(_totalContributed[saleId]);
        for (uint256 i = 0; i < n; i++) {
            handles[1 + i] = euint64.unwrap(_contributions[saleId][_participants[saleId][i]]);
        }

        FHE.checkSignatures(handles, _encodeUint64Array(decryptedValues), decryptionProof);

        uint64 decryptedTotal = decryptedValues[0];

        if (decryptedTotal < s.softCap) {
            s.status = SaleStatus.Failed;
            IERC20(s.saleToken).safeTransfer(s.creator, s.saleAmount);
            emit SaleFailed(saleId);
            return;
        }

        bool isOverflow = decryptedTotal > s.hardCap;
        uint64 effectiveRaised = isOverflow ? s.hardCap : decryptedTotal;

        uint256 totalPayment = 0;
        uint256 totalTokensAllocated = 0;

        for (uint256 i = 0; i < n; i++) {
            address user = _participants[saleId][i];
            uint64 contribution = decryptedValues[1 + i];

            uint256 effectiveContribution =
                isOverflow ? (uint256(contribution) * effectiveRaised) / decryptedTotal : contribution;

            uint256 tokens = (effectiveContribution * PRICE_SCALE) / s.price;
            uint256 payment = effectiveContribution;
            if (totalTokensAllocated + tokens > s.saleAmount) {
                tokens = s.saleAmount - totalTokensAllocated;
                payment = (tokens * s.price) / PRICE_SCALE;
            }

            allocations[saleId][user] = tokens;
            totalTokensAllocated += tokens;

            deposits[saleId][user] -= uint64(payment);
            totalPayment += payment;

            emit AllocationSet(saleId, user, tokens);
        }

        s.clearingPrice = s.price;
        s.totalRaised = uint64(totalPayment);
        s.settledAt = uint64(block.timestamp);
        s.status = SaleStatus.Settled;

        _transferPayToken(s.payToken, s.creator, totalPayment);

        uint256 unsold = s.saleAmount - totalTokensAllocated;
        if (unsold > 0) {
            IERC20(s.saleToken).safeTransfer(s.creator, unsold);
        }

        emit SaleSettled(saleId, s.price, s.totalRaised);
    }

    // ============================================================
    //                 SETTLE DUTCH AUCTION (Phase 2)
    // ============================================================

    /// @param decryptedValues [amount_user0, amount_user1, ...] in participant order
    function settleDutch(
        uint256 saleId,
        uint64[] calldata decryptedValues,
        bytes calldata decryptionProof
    ) external nonReentrant {
        Sale storage s = _sales[saleId];
        if (s.status != SaleStatus.Finalizing) revert NotFinalizing();
        if (s.saleType != SaleType.DutchAuction) revert InvalidParams();

        uint256 n = s.participantCount;
        if (decryptedValues.length != n) revert InvalidParams();

        // Verify KMS proof
        _verifyDutchProof(saleId, n, decryptedValues, decryptionProof);

        // Compute clearing price by sorting bids by price descending
        ClearingResult memory cr = _computeClearing(saleId, s, n, decryptedValues);

        if (!cr.found) {
            s.status = SaleStatus.Failed;
            IERC20(s.saleToken).safeTransfer(s.creator, s.saleAmount);
            emit SaleFailed(saleId);
            return;
        }

        (uint256 totalPayment, uint256 totalTokens) = _computeDutchSettlementTotals(saleId, n, cr, decryptedValues);

        if (totalPayment < s.softCap) {
            s.status = SaleStatus.Failed;
            IERC20(s.saleToken).safeTransfer(s.creator, s.saleAmount);
            emit SaleFailed(saleId);
            return;
        }

        _settleDutchAllocations(saleId, s, n, cr, decryptedValues, totalPayment, totalTokens);
    }

    function _verifyDutchProof(
        uint256 saleId,
        uint256 n,
        uint64[] calldata decryptedValues,
        bytes calldata decryptionProof
    ) internal {
        bytes32[] memory handles = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            handles[i] = euint64.unwrap(_bidAmounts[saleId][_participants[saleId][i]]);
        }
        FHE.checkSignatures(handles, _encodeUint64Array(decryptedValues), decryptionProof);
    }

    /// @dev Find clearing price by processing bids from highest price to lowest.
    ///      Uses selection-sort order (O(n^2), acceptable for n <= 50).
    function _computeClearing(
        uint256 saleId,
        Sale storage s,
        uint256 n,
        uint64[] calldata decryptedValues
    ) internal view returns (ClearingResult memory cr) {
        uint256 remaining = s.saleAmount;
        bool[] memory processed = new bool[](n);

        // Sum total contributed
        for (uint256 i = 0; i < n; i++) {
            cr.totalContributed += decryptedValues[i];
        }

        // Process bid price levels from highest to lowest.
        for (uint256 round = 0; round < n; round++) {
            // Find the highest unprocessed bid price level.
            uint64 maxPrice = 0;
            for (uint256 i = 0; i < n; i++) {
                if (!processed[i] && decryptedValues[i] > 0) {
                    uint64 p = userBidPrice[saleId][_participants[saleId][i]];
                    if (p > maxPrice) {
                        maxPrice = p;
                    }
                }
            }

            if (maxPrice == 0) break; // no more valid bids

            uint256 levelDemand = 0;
            for (uint256 i = 0; i < n; i++) {
                if (
                    !processed[i] &&
                    decryptedValues[i] > 0 &&
                    userBidPrice[saleId][_participants[saleId][i]] == maxPrice
                ) {
                    processed[i] = true;
                    levelDemand += (uint256(decryptedValues[i]) * PRICE_SCALE) / maxPrice;
                }
            }

            if (levelDemand <= remaining) {
                remaining -= levelDemand;
                cr.clearingPrice = maxPrice;
                cr.found = true;
            } else {
                cr.clearingPrice = maxPrice;
                cr.found = true;
                cr.hasOverflow = true;
                cr.overflowRemaining = remaining;
                cr.overflowDemand = levelDemand;
                break;
            }
        }
    }

    function _computeDutchSettlementTotals(
        uint256 saleId,
        uint256 n,
        ClearingResult memory cr,
        uint64[] calldata decryptedValues
    ) internal view returns (uint256 totalPayment, uint256 totalTokens) {
        for (uint256 i = 0; i < n; i++) {
            address user = _participants[saleId][i];
            (uint256 tokens, uint256 payment) = _computeUserDutchAllocation(
                decryptedValues[i],
                userBidPrice[saleId][user],
                cr
            );
            totalTokens += tokens;
            totalPayment += payment;
        }
    }

    function _settleDutchAllocations(
        uint256 saleId,
        Sale storage s,
        uint256 n,
        ClearingResult memory cr,
        uint64[] calldata decryptedValues,
        uint256 totalPayment,
        uint256 totalTokens
    ) internal {
        for (uint256 i = 0; i < n; i++) {
            address user = _participants[saleId][i];
            uint64 uPrice = userBidPrice[saleId][user];
            uint64 contribution = decryptedValues[i];

            (uint256 tokens, uint256 payment) = _computeUserDutchAllocation(contribution, uPrice, cr);

            allocations[saleId][user] = tokens;

            if (payment > 0) {
                deposits[saleId][user] -= uint64(payment);
            }
            emit AllocationSet(saleId, user, tokens);
        }

        s.clearingPrice = cr.clearingPrice;
        s.totalRaised = uint64(totalPayment);
        s.settledAt = uint64(block.timestamp);
        s.status = SaleStatus.Settled;

        _transferPayToken(s.payToken, s.creator, totalPayment);

        uint256 unsold = s.saleAmount - totalTokens;
        if (unsold > 0) {
            IERC20(s.saleToken).safeTransfer(s.creator, unsold);
        }

        emit SaleSettled(saleId, cr.clearingPrice, s.totalRaised);
    }

    function _computeUserDutchAllocation(
        uint64 contribution,
        uint64 uPrice,
        ClearingResult memory cr
    ) internal pure returns (uint256 tokens, uint256 payment) {
        if (contribution == 0 || uPrice < cr.clearingPrice) return (0, 0);

        // Tokens user wants at their bid price
        tokens = (uint256(contribution) * PRICE_SCALE) / uPrice;

        if (uPrice == cr.clearingPrice && cr.hasOverflow) {
            // Pro-rata at clearing price level
            tokens = (tokens * cr.overflowRemaining) / cr.overflowDemand;
        }

        // Everyone pays uniform clearing price
        payment = (tokens * cr.clearingPrice) / PRICE_SCALE;
    }

    // ============================================================
    //                     CLAIM (with Vesting)
    // ============================================================

    function claim(uint256 saleId) external nonReentrant {
        Sale storage s = _sales[saleId];
        if (s.status != SaleStatus.Settled) revert NotSettled();

        uint256 allocation = allocations[saleId][msg.sender];
        if (allocation == 0) revert NothingToClaim();

        uint256 vested = _vestedAmount(s, allocation);
        uint256 already = tokensClaimed[saleId][msg.sender];
        uint256 claimableAmt = vested - already;

        if (claimableAmt == 0) revert NothingToClaim();

        tokensClaimed[saleId][msg.sender] = vested;
        IERC20(s.saleToken).safeTransfer(msg.sender, claimableAmt);

        emit TokensClaimed(saleId, msg.sender, claimableAmt);
    }

    function _vestedAmount(Sale storage s, uint256 allocation) internal view returns (uint256) {
        if (s.cliffDuration == 0 && s.vestingDuration == 0) return allocation;

        uint64 cliffEnd = s.settledAt + s.cliffDuration;
        uint64 vestEnd = cliffEnd + s.vestingDuration;

        if (block.timestamp < cliffEnd) return 0;
        if (block.timestamp >= vestEnd) return allocation;

        uint256 elapsed = block.timestamp - cliffEnd;
        return (allocation * elapsed) / s.vestingDuration;
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    function getSale(uint256 saleId) external view returns (Sale memory) {
        return _sales[saleId];
    }

    function getParticipant(uint256 saleId, uint8 index) external view returns (address) {
        return _participants[saleId][index];
    }

    function getContributionHandle(uint256 saleId, address user) external view returns (bytes32) {
        return euint64.unwrap(_contributions[saleId][user]);
    }

    function getBidAmountHandle(uint256 saleId, address user) external view returns (bytes32) {
        return euint64.unwrap(_bidAmounts[saleId][user]);
    }

    function getTotalContributedHandle(uint256 saleId) external view returns (bytes32) {
        return euint64.unwrap(_totalContributed[saleId]);
    }

    function claimable(uint256 saleId, address user) external view returns (uint256) {
        Sale storage s = _sales[saleId];
        if (s.status != SaleStatus.Settled) return 0;
        uint256 allocation = allocations[saleId][user];
        if (allocation == 0) return 0;
        uint256 vested = _vestedAmount(s, allocation);
        return vested - tokensClaimed[saleId][user];
    }

    // ============================================================
    //                     RECEIVE ETH
    // ============================================================

    receive() external payable {}
}
