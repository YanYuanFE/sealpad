// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {Impl} from "@fhevm/solidity/lib/Impl.sol";
import {ZamaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

interface ISealPadFactory {
    function registerParticipant(address user) external;
}

/// @title SaleVault — single-sale clone deployed by SealPadFactory.
/// @notice Holds the state for one Fixed-Price or Dutch-Auction sale.
///         Logic is delegate-called from EIP-1167 clones; any storage writes
///         (including FHE coprocessor config) must happen via `initialize`.
contract SaleVault is ReentrancyGuard {
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

    /// @dev Mirrors the public getter shape; returned by `getSale()` so the
    ///      frontend ABI tuple stays stable.
    struct Sale {
        address creator;
        address saleToken;
        uint256 saleAmount;
        address payToken;
        SaleType saleType;
        uint64 price;
        uint64 softCap;
        uint64 hardCap;
        uint64 maxPerUser;
        uint64 startTime;
        uint64 endTime;
        bytes32 whitelistRoot;
        uint64 cliffDuration;
        uint64 vestingDuration;
        SaleStatus status;
        uint8 participantCount;
        uint64 clearingPrice;
        uint64 totalRaised;
        uint64 settledAt;
        uint256 saleTokenScale;
    }

    struct CreateSaleParams {
        address saleToken;
        uint256 saleAmount;
        address payToken;
        SaleType saleType;
        uint64 price;
        uint64 softCap;
        uint64 hardCap;
        uint64 maxPerUser;
        uint64 startTime;
        uint64 endTime;
        bytes32 whitelistRoot;
        uint64 cliffDuration;
        uint64 vestingDuration;
    }

    struct ClearingResult {
        uint64 clearingPrice;
        bool hasOverflow;
        uint256 overflowDemand;
        uint256 overflowRemaining;
        bool found;
        uint256 saleTokenScale;
    }

    // ============================================================
    //                         IMMUTABLES
    // ============================================================

    /// @notice The factory that deployed this vault. Only the factory can call
    ///         `initialize`. Vaults call back to factory.registerParticipant
    ///         on each user's first contribute/bid.
    address public immutable factory;

    // ============================================================
    //                          STATE
    // ============================================================

    bool private _initialized;

    address public creator;
    address public saleToken;
    uint256 public saleAmount;
    address public payToken;
    SaleType public saleType;
    uint64 public price;
    uint64 public softCap;
    uint64 public hardCap;
    uint64 public maxPerUser;
    uint64 public startTime;
    uint64 public endTime;
    bytes32 public whitelistRoot;
    uint64 public cliffDuration;
    uint64 public vestingDuration;
    SaleStatus public status;
    uint8 public participantCount;
    uint64 public clearingPrice;
    uint64 public totalRaised;
    uint64 public settledAt;
    uint256 public saleTokenScale;

    // Independent deposit pool (public amounts, sets per-user upper bound).
    mapping(address => uint64) public deposits;

    // Participant tracking.
    address[] internal _participants;
    mapping(address => bool) public hasParticipated;

    // Fixed Price: encrypted contributions + running total.
    mapping(address => euint64) internal _contributions;
    euint64 internal _totalContributed;

    // Dutch Auction: per-user public bid price + encrypted bid amount.
    mapping(address => uint64) public userBidPrice;
    mapping(address => euint64) internal _bidAmounts;

    // Post-settlement allocations (saleToken raw units).
    mapping(address => uint256) public allocations;
    mapping(address => uint256) public tokensClaimed;

    // ============================================================
    //                         CONSTANTS
    // ============================================================

    uint8 public constant MAX_PARTICIPANTS = 50;

    // ============================================================
    //                          EVENTS
    // ============================================================

    event SaleInitialized(address indexed creator, SaleType saleType);
    event SaleCancelled();
    event Deposited(address indexed user, uint64 amount, uint64 totalDeposit);
    event DepositWithdrawn(address indexed user, uint64 amount);
    event ContributionPlaced(address indexed user);
    event BidPlaced(address indexed user, uint64 bidPrice);
    event SaleFinalizing();
    event SaleSettled(uint64 clearingPrice, uint64 totalRaised);
    event SaleFailed();
    event AllocationSet(address indexed user, uint256 tokens);
    event TokensClaimed(address indexed user, uint256 amount);

    // ============================================================
    //                          ERRORS
    // ============================================================

    error InvalidParams();
    error AlreadyInitialized();
    error NotFactory();
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
    //                       CONSTRUCTOR
    // ============================================================

    /// @param _factory  Address of SealPadFactory. Stored as immutable, so all
    ///                  clones share the same factory reference (immutables
    ///                  are inlined into the implementation bytecode).
    constructor(address _factory) {
        factory = _factory;
        // The implementation contract is never used directly except as a
        // delegate-call target, but we set the FHE coprocessor here for
        // completeness. Clones populate their own coprocessor slots in
        // initialize() — see the comment there.
        Impl.setCoprocessor(ZamaConfig.getEthereumCoprocessorConfig());
    }

    // ============================================================
    //                       INITIALIZATION
    // ============================================================

    /// @notice Called by the factory immediately after Clones.clone() to set up
    ///         this sale. Pulls no tokens — the factory orchestrates the
    ///         saleToken transfer right after this call returns.
    function initialize(CreateSaleParams calldata p, address _creator) external {
        if (msg.sender != factory) revert NotFactory();
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;

        if (p.endTime <= p.startTime) revert InvalidParams();
        if (p.softCap == 0 || p.softCap > p.hardCap) revert InvalidParams();
        if (p.saleAmount == 0) revert InvalidParams();
        if (p.price == 0) revert InvalidParams();

        uint256 scale = 10 ** uint256(IERC20Metadata(p.saleToken).decimals());

        if (p.saleType == SaleType.FixedPrice && uint256(p.hardCap) > Math.mulDiv(p.saleAmount, p.price, scale))
            revert InvalidParams();

        // Clones don't run the implementation's constructor, so the FHE
        // coprocessor config in this clone's namespaced storage is zero.
        // Repopulate it here so subsequent FHE.* ops have somewhere to call.
        Impl.setCoprocessor(ZamaConfig.getEthereumCoprocessorConfig());

        creator = _creator;
        saleToken = p.saleToken;
        saleAmount = p.saleAmount;
        payToken = p.payToken;
        saleType = p.saleType;
        price = p.price;
        softCap = p.softCap;
        hardCap = p.hardCap;
        maxPerUser = p.maxPerUser;
        startTime = p.startTime;
        endTime = p.endTime;
        whitelistRoot = p.whitelistRoot;
        cliffDuration = p.cliffDuration;
        vestingDuration = p.vestingDuration;
        status = SaleStatus.Active;
        saleTokenScale = scale;

        if (p.saleType == SaleType.FixedPrice) {
            _totalContributed = FHE.asEuint64(0);
            FHE.allowThis(_totalContributed);
        }

        emit SaleInitialized(_creator, p.saleType);
    }

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

    /// @dev Centralizes the "first-time participant" bookkeeping: in-vault
    ///      tracking + factory callback so the global salesByParticipant
    ///      index is kept in sync.
    function _registerNewParticipant(address user) internal {
        if (participantCount >= MAX_PARTICIPANTS) revert MaxParticipantsReached();
        _participants.push(user);
        hasParticipated[user] = true;
        participantCount++;
        ISealPadFactory(factory).registerParticipant(user);
    }

    // ============================================================
    //                          CANCEL
    // ============================================================

    function cancelSale() external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        if (status != SaleStatus.Active) revert SaleNotActive();
        if (participantCount > 0) revert HasParticipants();

        status = SaleStatus.Cancelled;
        IERC20(saleToken).safeTransfer(creator, saleAmount);
        emit SaleCancelled();
    }

    // ============================================================
    //                     DEPOSIT FUNCTIONS
    // ============================================================

    function addDeposit(uint64 amount) external payable nonReentrant {
        if (status != SaleStatus.Active) revert SaleNotActive();
        if (block.timestamp < startTime) revert SaleNotStarted();
        if (block.timestamp >= endTime) revert SaleEnded();

        uint64 depositAmount;
        if (_isETH(payToken)) {
            depositAmount = uint64(msg.value);
            if (msg.value != uint256(depositAmount)) revert DepositMismatch();
        } else {
            if (msg.value != 0) revert DepositMismatch();
            depositAmount = amount;
            IERC20(payToken).safeTransferFrom(msg.sender, address(this), depositAmount);
        }

        deposits[msg.sender] += depositAmount;
        emit Deposited(msg.sender, depositAmount, deposits[msg.sender]);
    }

    function withdrawDeposit() external nonReentrant {
        bool isFinished =
            status == SaleStatus.Settled || status == SaleStatus.Failed || status == SaleStatus.Cancelled;
        bool noBid = !hasParticipated[msg.sender];

        if (!isFinished && !noBid) revert NotFinished();

        uint64 amt = deposits[msg.sender];
        if (amt == 0) revert NothingToWithdraw();

        deposits[msg.sender] = 0;
        _transferPayToken(payToken, msg.sender, amt);
        emit DepositWithdrawn(msg.sender, amt);
    }

    // ============================================================
    //                  CONTRIBUTE (Fixed Price)
    // ============================================================

    function contribute(
        externalEuint64 encAmount,
        bytes calldata inputProof,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        if (status != SaleStatus.Active) revert SaleNotActive();
        if (saleType != SaleType.FixedPrice) revert InvalidParams();
        if (block.timestamp < startTime) revert SaleNotStarted();
        if (block.timestamp >= endTime) revert SaleEnded();
        _checkWhitelist(whitelistRoot, msg.sender, merkleProof);

        uint64 userDeposit = deposits[msg.sender];
        if (userDeposit == 0) revert InsufficientDeposit();

        euint64 amount = FHE.fromExternal(encAmount, inputProof);
        uint64 cap = (maxPerUser > 0 && maxPerUser < userDeposit) ? maxPerUser : userDeposit;
        amount = FHE.min(amount, FHE.asEuint64(cap));
        FHE.allowThis(amount);
        FHE.allow(amount, msg.sender);

        if (hasParticipated[msg.sender]) {
            euint64 oldAmount = _contributions[msg.sender];
            _totalContributed = FHE.add(FHE.sub(_totalContributed, oldAmount), amount);
        } else {
            _registerNewParticipant(msg.sender);
            _totalContributed = FHE.add(_totalContributed, amount);
        }
        FHE.allowThis(_totalContributed);

        _contributions[msg.sender] = amount;
        emit ContributionPlaced(msg.sender);
    }

    // ============================================================
    //                  BID (Dutch Auction)
    // ============================================================

    function bid(
        uint64 bidPrice,
        externalEuint64 encAmount,
        bytes calldata inputProof,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        if (status != SaleStatus.Active) revert SaleNotActive();
        if (saleType != SaleType.DutchAuction) revert InvalidParams();
        if (bidPrice < price) revert PriceBelowFloor();
        if (block.timestamp < startTime) revert SaleNotStarted();
        if (block.timestamp >= endTime) revert SaleEnded();
        _checkWhitelist(whitelistRoot, msg.sender, merkleProof);

        uint64 userDeposit = deposits[msg.sender];
        if (userDeposit == 0) revert InsufficientDeposit();

        euint64 amount = FHE.fromExternal(encAmount, inputProof);
        uint64 cap = (maxPerUser > 0 && maxPerUser < userDeposit) ? maxPerUser : userDeposit;
        amount = FHE.min(amount, FHE.asEuint64(cap));
        FHE.allowThis(amount);
        FHE.allow(amount, msg.sender);

        if (!hasParticipated[msg.sender]) {
            _registerNewParticipant(msg.sender);
        }

        userBidPrice[msg.sender] = bidPrice;
        _bidAmounts[msg.sender] = amount;

        emit BidPlaced(msg.sender, bidPrice);
    }

    // ============================================================
    //                   FINALIZE (Phase 1)
    // ============================================================

    function finalize() external nonReentrant {
        if (status != SaleStatus.Active) revert SaleNotActive();
        if (block.timestamp < endTime) revert SaleNotEnded();

        if (participantCount == 0) {
            status = SaleStatus.Failed;
            IERC20(saleToken).safeTransfer(creator, saleAmount);
            emit SaleFailed();
            return;
        }

        status = SaleStatus.Finalizing;

        if (saleType == SaleType.FixedPrice) {
            FHE.makePubliclyDecryptable(_totalContributed);
        }

        for (uint8 i = 0; i < participantCount; i++) {
            address user = _participants[i];
            if (saleType == SaleType.FixedPrice) {
                FHE.makePubliclyDecryptable(_contributions[user]);
            } else {
                FHE.makePubliclyDecryptable(_bidAmounts[user]);
            }
        }

        emit SaleFinalizing();
    }

    // ============================================================
    //                  SETTLE FIXED PRICE (Phase 2)
    // ============================================================

    function settleFixed(uint64[] calldata decryptedValues, bytes calldata decryptionProof) external nonReentrant {
        if (status != SaleStatus.Finalizing) revert NotFinalizing();
        if (saleType != SaleType.FixedPrice) revert InvalidParams();

        uint256 n = participantCount;
        if (decryptedValues.length != 1 + n) revert InvalidParams();

        bytes32[] memory handles = new bytes32[](1 + n);
        handles[0] = euint64.unwrap(_totalContributed);
        for (uint256 i = 0; i < n; i++) {
            handles[1 + i] = euint64.unwrap(_contributions[_participants[i]]);
        }

        FHE.checkSignatures(handles, _encodeUint64Array(decryptedValues), decryptionProof);

        uint256 decryptedTotal = 0;
        for (uint256 i = 0; i < n; i++) {
            decryptedTotal += decryptedValues[1 + i];
        }

        if (decryptedTotal < softCap) {
            status = SaleStatus.Failed;
            IERC20(saleToken).safeTransfer(creator, saleAmount);
            emit SaleFailed();
            return;
        }

        bool isOverflow = decryptedTotal > hardCap;
        uint256 effectiveRaised = isOverflow ? uint256(hardCap) : decryptedTotal;

        uint256 totalPayment = 0;
        uint256 totalTokensAllocated = 0;

        for (uint256 i = 0; i < n; i++) {
            address user = _participants[i];
            uint64 contribution = decryptedValues[1 + i];

            uint256 effectiveContribution =
                isOverflow ? (uint256(contribution) * effectiveRaised) / decryptedTotal : contribution;

            uint256 tokens = (effectiveContribution * saleTokenScale) / price;
            uint256 payment = effectiveContribution;
            if (totalTokensAllocated + tokens > saleAmount) {
                tokens = saleAmount - totalTokensAllocated;
                payment = (tokens * price) / saleTokenScale;
            }

            allocations[user] = tokens;
            totalTokensAllocated += tokens;

            deposits[user] -= uint64(payment);
            totalPayment += payment;

            emit AllocationSet(user, tokens);
        }

        clearingPrice = price;
        totalRaised = uint64(totalPayment);
        settledAt = uint64(block.timestamp);
        status = SaleStatus.Settled;

        _transferPayToken(payToken, creator, totalPayment);

        uint256 unsold = saleAmount - totalTokensAllocated;
        if (unsold > 0) {
            IERC20(saleToken).safeTransfer(creator, unsold);
        }

        emit SaleSettled(price, totalRaised);
    }

    // ============================================================
    //                 SETTLE DUTCH AUCTION (Phase 2)
    // ============================================================

    function settleDutch(uint64[] calldata decryptedValues, bytes calldata decryptionProof) external nonReentrant {
        if (status != SaleStatus.Finalizing) revert NotFinalizing();
        if (saleType != SaleType.DutchAuction) revert InvalidParams();

        uint256 n = participantCount;
        if (decryptedValues.length != n) revert InvalidParams();

        _verifyDutchProof(n, decryptedValues, decryptionProof);

        ClearingResult memory cr = _computeClearing(n, decryptedValues);

        if (!cr.found) {
            status = SaleStatus.Failed;
            IERC20(saleToken).safeTransfer(creator, saleAmount);
            emit SaleFailed();
            return;
        }

        (uint256 totalPayment, uint256 totalTokens) = _computeDutchSettlementTotals(n, cr, decryptedValues);

        if (totalPayment < softCap) {
            status = SaleStatus.Failed;
            IERC20(saleToken).safeTransfer(creator, saleAmount);
            emit SaleFailed();
            return;
        }

        _settleDutchAllocations(n, cr, decryptedValues, totalPayment, totalTokens);
    }

    function _verifyDutchProof(
        uint256 n,
        uint64[] calldata decryptedValues,
        bytes calldata decryptionProof
    ) internal {
        bytes32[] memory handles = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            handles[i] = euint64.unwrap(_bidAmounts[_participants[i]]);
        }
        FHE.checkSignatures(handles, _encodeUint64Array(decryptedValues), decryptionProof);
    }

    /// @dev Find the clearing price by walking bid-price levels from highest
    ///      down. Within a level, demand is summed; if it exceeds remaining
    ///      capacity, the entire level shares pro-rata.
    function _computeClearing(
        uint256 n,
        uint64[] calldata decryptedValues
    ) internal view returns (ClearingResult memory cr) {
        uint256 acceptedTokens = 0;
        bool[] memory processed = new bool[](n);
        cr.saleTokenScale = saleTokenScale;

        for (uint256 round = 0; round < n; round++) {
            uint64 maxPrice = 0;
            for (uint256 i = 0; i < n; i++) {
                if (!processed[i] && decryptedValues[i] > 0) {
                    uint64 p = userBidPrice[_participants[i]];
                    if (p > maxPrice) {
                        maxPrice = p;
                    }
                }
            }

            if (maxPrice == 0) break;

            uint256 levelDemand = 0;
            for (uint256 i = 0; i < n; i++) {
                if (
                    !processed[i] &&
                    decryptedValues[i] > 0 &&
                    userBidPrice[_participants[i]] == maxPrice
                ) {
                    processed[i] = true;
                    levelDemand += (uint256(decryptedValues[i]) * saleTokenScale) / maxPrice;
                }
            }

            uint256 tokenCapacityAtPrice = Math.mulDiv(uint256(hardCap), saleTokenScale, maxPrice);
            if (tokenCapacityAtPrice > saleAmount) {
                tokenCapacityAtPrice = saleAmount;
            }

            cr.clearingPrice = maxPrice;
            cr.found = true;

            uint256 available = tokenCapacityAtPrice - acceptedTokens;
            if (levelDemand < available) {
                acceptedTokens += levelDemand;
            } else {
                if (levelDemand > available) {
                    cr.hasOverflow = true;
                    cr.overflowRemaining = available;
                    cr.overflowDemand = levelDemand;
                }
                break;
            }
        }
    }

    function _computeDutchSettlementTotals(
        uint256 n,
        ClearingResult memory cr,
        uint64[] calldata decryptedValues
    ) internal view returns (uint256 totalPayment, uint256 totalTokens) {
        for (uint256 i = 0; i < n; i++) {
            address user = _participants[i];
            (uint256 tokens, uint256 payment) = _computeUserDutchAllocation(
                decryptedValues[i],
                userBidPrice[user],
                cr
            );
            totalTokens += tokens;
            totalPayment += payment;
        }
    }

    function _settleDutchAllocations(
        uint256 n,
        ClearingResult memory cr,
        uint64[] calldata decryptedValues,
        uint256 totalPayment,
        uint256 totalTokens
    ) internal {
        for (uint256 i = 0; i < n; i++) {
            address user = _participants[i];
            uint64 uPrice = userBidPrice[user];
            uint64 contribution = decryptedValues[i];

            (uint256 tokens, uint256 payment) = _computeUserDutchAllocation(contribution, uPrice, cr);

            allocations[user] = tokens;

            if (payment > 0) {
                deposits[user] -= uint64(payment);
            }
            emit AllocationSet(user, tokens);
        }

        clearingPrice = cr.clearingPrice;
        totalRaised = uint64(totalPayment);
        settledAt = uint64(block.timestamp);
        status = SaleStatus.Settled;

        _transferPayToken(payToken, creator, totalPayment);

        uint256 unsold = saleAmount - totalTokens;
        if (unsold > 0) {
            IERC20(saleToken).safeTransfer(creator, unsold);
        }

        emit SaleSettled(cr.clearingPrice, totalRaised);
    }

    function _computeUserDutchAllocation(
        uint64 contribution,
        uint64 uPrice,
        ClearingResult memory cr
    ) internal pure returns (uint256 tokens, uint256 payment) {
        if (contribution == 0 || uPrice < cr.clearingPrice) return (0, 0);

        tokens = (uint256(contribution) * cr.saleTokenScale) / uPrice;

        if (uPrice == cr.clearingPrice && cr.hasOverflow) {
            tokens = (tokens * cr.overflowRemaining) / cr.overflowDemand;
        }

        payment = (tokens * cr.clearingPrice) / cr.saleTokenScale;
    }

    // ============================================================
    //                     CLAIM (with Vesting)
    // ============================================================

    function claim() external nonReentrant {
        if (status != SaleStatus.Settled) revert NotSettled();

        uint256 allocation = allocations[msg.sender];
        if (allocation == 0) revert NothingToClaim();

        uint256 vested = _vestedAmount(allocation);
        uint256 already = tokensClaimed[msg.sender];
        uint256 claimableAmt = vested - already;

        if (claimableAmt == 0) revert NothingToClaim();

        tokensClaimed[msg.sender] = vested;
        IERC20(saleToken).safeTransfer(msg.sender, claimableAmt);

        emit TokensClaimed(msg.sender, claimableAmt);
    }

    function _vestedAmount(uint256 allocation) internal view returns (uint256) {
        if (cliffDuration == 0 && vestingDuration == 0) return allocation;

        uint64 cliffEnd = settledAt + cliffDuration;
        uint64 vestEnd = cliffEnd + vestingDuration;

        if (block.timestamp < cliffEnd) return 0;
        if (block.timestamp >= vestEnd) return allocation;

        uint256 elapsed = block.timestamp - cliffEnd;
        return (allocation * elapsed) / vestingDuration;
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    function getSale() external view returns (Sale memory s) {
        s.creator = creator;
        s.saleToken = saleToken;
        s.saleAmount = saleAmount;
        s.payToken = payToken;
        s.saleType = saleType;
        s.price = price;
        s.softCap = softCap;
        s.hardCap = hardCap;
        s.maxPerUser = maxPerUser;
        s.startTime = startTime;
        s.endTime = endTime;
        s.whitelistRoot = whitelistRoot;
        s.cliffDuration = cliffDuration;
        s.vestingDuration = vestingDuration;
        s.status = status;
        s.participantCount = participantCount;
        s.clearingPrice = clearingPrice;
        s.totalRaised = totalRaised;
        s.settledAt = settledAt;
        s.saleTokenScale = saleTokenScale;
    }

    function getParticipant(uint8 index) external view returns (address) {
        return _participants[index];
    }

    function getContributionHandle(address user) external view returns (bytes32) {
        return euint64.unwrap(_contributions[user]);
    }

    function getBidAmountHandle(address user) external view returns (bytes32) {
        return euint64.unwrap(_bidAmounts[user]);
    }

    function getTotalContributedHandle() external view returns (bytes32) {
        return euint64.unwrap(_totalContributed);
    }

    function claimable(address user) external view returns (uint256) {
        if (status != SaleStatus.Settled) return 0;
        uint256 allocation = allocations[user];
        if (allocation == 0) return 0;
        uint256 vested = _vestedAmount(allocation);
        return vested - tokensClaimed[user];
    }

    // ============================================================
    //                     RECEIVE ETH
    // ============================================================

    receive() external payable {}
}
