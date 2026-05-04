// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SaleVault} from "./SaleVault.sol";

/// @title SealPadFactory — deploys and indexes SaleVault clones.
/// @notice Single entrypoint for creating sales. Each sale lives in its own
///         EIP-1167 clone of the SaleVault implementation. The factory keeps a
///         global registry of vaults plus per-creator and per-participant
///         indexes so the frontend can answer listing queries in O(1) RPC
///         calls instead of scanning every sale.
contract SealPadFactory {
    using SafeERC20 for IERC20;

    // ============================================================
    //                         IMMUTABLES
    // ============================================================

    /// @notice The SaleVault implementation that all clones delegatecall into.
    ///         Deployed once in the factory's constructor.
    address public immutable implementation;

    // ============================================================
    //                          STATE
    // ============================================================

    /// @notice All vaults ever deployed by this factory, in creation order.
    address[] public allSales;

    /// @notice Quick check: is this address a vault we created? Used by
    ///         registerParticipant to reject calls from random contracts.
    mapping(address => bool) public isSale;

    mapping(address => address[]) internal _salesByCreator;
    mapping(address => address[]) internal _salesByParticipant;

    // ============================================================
    //                          EVENTS
    // ============================================================

    event SaleCreated(address indexed vault, address indexed creator, SaleVault.SaleType saleType);

    // ============================================================
    //                          ERRORS
    // ============================================================

    error NotASale();

    // ============================================================
    //                       CONSTRUCTOR
    // ============================================================

    constructor() {
        implementation = address(new SaleVault(address(this)));
    }

    // ============================================================
    //                       CREATE SALE
    // ============================================================

    /// @notice Deploy a new SaleVault clone and seed it with sale tokens.
    /// @dev Caller must approve `saleAmount` of `p.saleToken` to this factory
    ///      first; the factory pulls the tokens directly into the new vault
    ///      after `initialize` validates the parameters.
    function createSale(SaleVault.CreateSaleParams calldata p) external returns (address vault) {
        vault = Clones.clone(implementation);

        // Initialize first so any param error (bad decimals, bad caps, etc.)
        // reverts before we move tokens. Both calls are inside the same tx,
        // so the clone never lingers half-initialized on success or failure.
        SaleVault(payable(vault)).initialize(p, msg.sender);

        IERC20(p.saleToken).safeTransferFrom(msg.sender, vault, p.saleAmount);

        isSale[vault] = true;
        allSales.push(vault);
        _salesByCreator[msg.sender].push(vault);

        emit SaleCreated(vault, msg.sender, p.saleType);
    }

    // ============================================================
    //                  PARTICIPATION CALLBACK
    // ============================================================

    /// @notice Called by a SaleVault clone when a user contributes or bids
    ///         for the first time. Updates the global participant index.
    /// @dev The `isSale[msg.sender]` gate is what makes this safe to expose:
    ///      only known vaults can register participants.
    function registerParticipant(address user) external {
        if (!isSale[msg.sender]) revert NotASale();
        _salesByParticipant[user].push(msg.sender);
    }

    // ============================================================
    //                       VIEW FUNCTIONS
    // ============================================================

    function getAllSales() external view returns (address[] memory) {
        return allSales;
    }

    function totalSales() external view returns (uint256) {
        return allSales.length;
    }

    function salesByCreator(address creator) external view returns (address[] memory) {
        return _salesByCreator[creator];
    }

    function salesByParticipant(address user) external view returns (address[] memory) {
        return _salesByParticipant[user];
    }
}
