# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Design decisions follow `.impeccable.md` at the repo root.** Read it before any frontend / visual change. It defines the brand tone (Deliberate · Hushed · Institutional), the palette (Saturn orange `#FF5100`, obsidian, white), the 0.69px micro-radii signature, and five overriding principles (Hush over hype · Real numbers not theatre · Whitespace is the product · Earn the orange · Sharp edges over rounded). It overrides "tasteful defaults" — when generic best-practice disagrees, that file wins.

## Project

**SealPad** — Confidential Token Sale Platform for the Zama Developer Program (Mainnet Season 2, Builder Track). Two-package monorepo (no workspace file): an FHEVM Hardhat project under `contracts/` and a Vite + React frontend under `frontend/`. The full design is in `TECHNICAL_DESIGN.md` (Chinese).

SealPad is now a factory + clone architecture. The `SealPadFactory` on Sepolia (chainId `11155111`) is at `0x7a65faf7A25443aB70DCcc069a6b42BF208f15e0`; the `SaleVault` implementation it clones from is at `0x723B4Df76567f2445A870E71e717B0D9694dB56a`. Only the factory address is hardcoded in `frontend/src/config/contracts.ts`; per-sale vault addresses come from `factory.getAllSales()` / `factory.salesByCreator(user)` / `factory.salesByParticipant(user)`. The local `contracts/deployments/sepolia/` directory is `.gitignore`d, so the factory address constant is the single canonical source.

## Common commands

All commands assume you have `cd`'d into the relevant package; there is no root-level package.json.

### contracts/

```bash
npm run compile              # hardhat compile + typechain (generates ./types)
npm run test                 # hardhat test (uses fhevm mock — required, tests skip otherwise)
npm run test:sepolia         # run tests against deployed Sepolia contract
npx hardhat test test/SealPadFactory.ts --grep "should accept encrypted contribution"   # single test
npm run coverage             # solidity-coverage
npm run lint                 # solhint + eslint + prettier check
npm run deploy:sepolia       # hardhat-deploy to Sepolia (writes to deployments/sepolia/)
npm run verify:sepolia       # etherscan verification
npm run chain                # local hardhat node (no auto-deploy)
```

Hardhat vars (set with `npx hardhat vars set <NAME>`):
- `MNEMONIC` — fallback to "test test ... junk" if unset
- `INFURA_API_KEY`, `ETHERSCAN_API_KEY`
- `DEPLOYER_PRIVATE_KEY` — if set, takes precedence over MNEMONIC for Sepolia

### frontend/

```bash
npm run dev          # vite dev server
npm run build        # tsc -b && vite build
npm run lint         # eslint
npm run preview      # vite preview
```

Frontend env: `VITE_SEALPAD_ADDRESS` overrides the hardcoded contract address. RPC is hardcoded to `https://ethereum-sepolia-rpc.publicnode.com` in `src/config/wagmi.ts`. `@` alias resolves to `frontend/src/`.

## Architecture

### Sale lifecycle (factory + per-sale vault, two modes)

`SealPadFactory.sol` deploys EIP-1167 clones of `SaleVault.sol` (one clone per sale) via OpenZeppelin's `Clones.clone()`. Each `SaleVault` supports both `FixedPrice` and `DutchAuction` sales via the `SaleType` enum (selected at `initialize` time). The factory holds three indexes — `allSales[]`, `salesByCreator(address) => address[]`, `salesByParticipant(address) => address[]` — and the participant index is kept in sync by a callback: vaults call `factory.registerParticipant(user)` on a user's first `contribute`/`bid`. The state machine inside each vault is:

```
Active → Finalizing → Settled    (success path)
                    → Failed     (softCap not reached or no participants)
Active → Cancelled               (creator cancels with no participants)
```

The `finalize` function is the single entry to phase 2 — it sets status to `Finalizing`, calls `FHE.makePubliclyDecryptable` on every encrypted handle that needs to be revealed (the running total for FixedPrice + every individual contribution/bid), and emits `SaleFinalizing`. Off-chain, KMS decrypts these handles, then anyone calls `settleFixed` or `settleDutch` with the decrypted values + KMS proof. `FHE.checkSignatures` verifies the proof on-chain before allocations are computed.

This split (finalize → KMS decrypt → settle) is the central reason each vault has two storage layouts: encrypted fields (`euint64`) before settlement, plain `uint256` `allocations` after.

Clone init quirk: EIP-1167 clones don't run the implementation's constructor, so the FHE coprocessor config (ACL/Coprocessor/KMSVerifier addresses written to ERC-7201 namespaced storage by `Impl.setCoprocessor`) is missing in fresh clones. `SaleVault.initialize` calls `Impl.setCoprocessor(ZamaConfig.getEthereumCoprocessorConfig())` explicitly to populate the clone's storage; without that, every FHE op on a fresh clone would fail.

### Independent deposit pool (vs. cWETH)

Unlike PrivacyPad's cWETH wrapping, SealPad uses an independent deposit pool: users `addDeposit` first (public amount, sets per-user upper bound), then `contribute` / `bid` with an FHE-encrypted amount that is `FHE.min`-clamped to the deposit. **No funds move when contributions are updated** — only the encrypted ciphertext changes, leaving no on-chain trace of bid revisions. This is the core privacy primitive; understanding it is required before changing `contribute`/`bid`/`addDeposit`/`withdrawDeposit`.

Withdrawal rules: `withdrawDeposit` succeeds if the sale is finished (Settled/Failed/Cancelled) **or** the user never participated. Once a user has called `contribute`/`bid`, their deposit is locked until settlement.

### Dutch Auction clearing — diverges from TECHNICAL_DESIGN.md

The implementation does **not** use the discrete tier-based design described in the design doc (`_tierBids[saleId][tierIndex][user]`). Instead:
- Each user picks an arbitrary `bidPrice` (public, must be `>= sale.price` which is the floor).
- `_bidAmounts[saleId][user]` holds one encrypted total investment per user.
- `_computeClearing` does an O(n²) selection-sort over participants from highest to lowest bid price, accumulating token demand against `saleAmount` until supply is exhausted. The price where exhaustion occurs is the clearing price; bidders at that exact price share `overflowRemaining` pro-rata via `tokens × overflowRemaining / overflowDemand`.
- Everyone who bids ≥ clearing price pays the **uniform** clearing price (excess refunded by leaving funds in `deposits`).
- `MAX_PARTICIPANTS = 50` keeps the O(n²) tractable.

If you read the design doc's "tier" terminology, mentally translate it to "user-chosen bid price" — the contract is correct, the doc is stale on this.

### Settlement input format

Both `settleFixed` and `settleDutch` take `uint64[] decryptedValues` ordered to match the handle order built inside the contract:
- `settleFixed`: `[totalContributed, contrib_user0, contrib_user1, ...]` (length = 1 + participantCount).
- `settleDutch`: `[bid_user0, bid_user1, ...]` (length = participantCount, in `_participants` order).

The contract reconstructs the handle array in the same order and passes both to `FHE.checkSignatures(handles, _encodeUint64Array(values), proof)`. `_encodeUint64Array` is a custom abi-encoder loop that concatenates `abi.encode(uint64)` per element — this exact encoding is what the KMS signs over, so do not change it without coordinating with the off-chain decryption pipeline.

### Vesting & claim

`_vestedAmount` returns `0` before cliff, full `allocation` after `cliffEnd + vestingDuration`, and a linear ratio between. Claim is pull-based. `cliffDuration == 0 && vestingDuration == 0` means instant claim.

### Frontend integration with FHE

`frontend/src/lib/fhevm.ts` is a singleton wrapper around `@zama-fhe/relayer-sdk/web`:
- `getFhevmInstance()` lazy-inits with `SepoliaConfig` + the project's RPC URL; the resulting instance is cached.
- `encryptBidAmount(userAddress, amount)` produces `{ handle, inputProof }` to pass directly to the contract's `contribute` / `bid` calls.

`SaleDetail.tsx` is the only page that calls `encryptBidAmount` (dynamic import to avoid loading the SDK on every page). It computes total cost as `quantity × pricePerToken` (Dutch uses user-entered bidPrice; FixedPrice uses `sale.price`), validates against `currentDeposit`, then calls `contribute` for FixedPrice or `bid` for Dutch.

The frontend tracks both pay-token and sale-token decimals dynamically by calling `decimals()` on the respective ERC-20 (ETH always uses `parseEther/formatEther`). Sale-token amounts (`sale.saleAmount`, `allocations`, `claimable`) are formatted via `parseUnits/formatUnits` keyed off the saleToken's decimals; the per-sale `sale.saleTokenScale = 10**decimals()` is also stored on-chain in the `Sale` struct so cost math (`computedCostRaw = quantity × price / saleTokenScale`) stays consistent across decimals.

### ABI source of truth

`frontend/src/config/contracts.ts` declares a hand-curated subset of the ABI as a `const` array (typed via `as const`). It is **not** generated from `contracts/types/`. When you add or modify a contract function/event you intend to call from the frontend, update this file by hand — the typechain output in `contracts/types/` is not imported by the frontend.

## Solidity / FHEVM specifics

- Solc `0.8.27`, `viaIR: true`, `evmVersion: cancun`, `runs: 800`. Always run `npm run compile` after editing `.sol` — typechain regenerates and the frontend ABI must be updated separately if signatures changed.
- `MAX_PARTICIPANTS = 50` is the only protocol-wide constant. The token-side scale is per-sale (`Sale.saleTokenScale = 10**IERC20Metadata.decimals()`, locked at `createSale`); all token-math sites (`settleFixed`, `_computeClearing`, `_computeUserDutchAllocation`, `createSale` hardCap check) use this per-sale scale via `s.saleTokenScale` or the `cr.saleTokenScale` mirror in `ClearingResult`.
- All payment math uses `uint64` for compatibility with FHE `euint64`. Token allocations are `uint256` because they're unencrypted and scaled by `saleTokenScale`. The `price` field semantics are uniform: payToken raw units per 1 whole sale token, regardless of decimals.
- `payToken == address(0)` means native ETH throughout the contract; the helper is `_isETH`.
- Tests live in `contracts/test/SealPadFactory.ts` and skip themselves if `fhevm.isMock` is false — the suite only runs under the FHEVM mock harness.

## Conventions and gotchas

- The frontend's hardcoded contract address is the single source of truth at runtime; redeploying requires updating the constant in `contracts.ts` (manually, or set `VITE_SEALPAD_ADDRESS`). `contracts/deployments/sepolia/` is `.gitignore`d, so the deployment artifact only lives on whichever machine ran `npm run deploy:sepolia`.
- `frontend/dist/` is `.gitignore`d (excluded along with `node_modules`); commit only sources, not build output.
- The Tailwind theme uses `--radius: 0` globally (intentional sharp-corner aesthetic). Custom colors live in `src/index.css` under `@theme inline` (`canvas`, `ink-dark`, `ink-medium`, `brand-500`).
- WalletConnect projectId in `wagmi.ts` is a placeholder (`"00000000000000000000000000000000"`); replace before any production deploy.
