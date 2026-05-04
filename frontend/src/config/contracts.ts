// Factory address — single canonical source. The factory deploys a SaleVault
// implementation in its constructor and clones it (EIP-1167) per sale.
export const SEALPAD_FACTORY_ADDRESS = (import.meta.env
  .VITE_SEALPAD_FACTORY_ADDRESS ||
  "0x3459ce37025955235aaF9eaB1D5B2b679BFEBd47") as `0x${string}`;

// ============================================================
//                      FACTORY ABI
// ============================================================
// Hand-curated subset. Update by hand when SealPadFactory.sol changes.
export const SEALPAD_FACTORY_ABI = [
  {
    type: "function",
    name: "createSale",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "saleToken", type: "address" },
          { name: "saleAmount", type: "uint256" },
          { name: "payToken", type: "address" },
          { name: "saleType", type: "uint8" },
          { name: "price", type: "uint64" },
          { name: "softCap", type: "uint64" },
          { name: "hardCap", type: "uint64" },
          { name: "maxPerUser", type: "uint64" },
          { name: "startTime", type: "uint64" },
          { name: "endTime", type: "uint64" },
          { name: "whitelistRoot", type: "bytes32" },
          { name: "cliffDuration", type: "uint64" },
          { name: "vestingDuration", type: "uint64" },
        ],
      },
    ],
    outputs: [{ name: "vault", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "implementation",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAllSales",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSales",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "salesByCreator",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "salesByParticipant",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isSale",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "SaleCreated",
    inputs: [
      { name: "vault", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "saleType", type: "uint8", indexed: false },
    ],
  },
] as const;

// ============================================================
//                      SALE VAULT ABI
// ============================================================
// Each sale lives in its own SaleVault clone. All function calls below
// target a specific vault address (no saleId argument anymore).
export const SALE_VAULT_ABI = [
  // ---------- WRITES ----------
  {
    type: "function",
    name: "cancelSale",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addDeposit",
    inputs: [{ name: "amount", type: "uint64" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "withdrawDeposit",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "contribute",
    inputs: [
      { name: "encAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "merkleProof", type: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "bid",
    inputs: [
      { name: "bidPrice", type: "uint64" },
      { name: "encAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "merkleProof", type: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "finalize",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settleFixed",
    inputs: [
      { name: "decryptedValues", type: "uint64[]" },
      { name: "decryptionProof", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settleDutch",
    inputs: [
      { name: "decryptedValues", type: "uint64[]" },
      { name: "decryptionProof", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claim",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ---------- VIEWS ----------
  {
    type: "function",
    name: "getSale",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "saleToken", type: "address" },
          { name: "saleAmount", type: "uint256" },
          { name: "payToken", type: "address" },
          { name: "saleType", type: "uint8" },
          { name: "price", type: "uint64" },
          { name: "softCap", type: "uint64" },
          { name: "hardCap", type: "uint64" },
          { name: "maxPerUser", type: "uint64" },
          { name: "startTime", type: "uint64" },
          { name: "endTime", type: "uint64" },
          { name: "whitelistRoot", type: "bytes32" },
          { name: "cliffDuration", type: "uint64" },
          { name: "vestingDuration", type: "uint64" },
          { name: "status", type: "uint8" },
          { name: "participantCount", type: "uint8" },
          { name: "clearingPrice", type: "uint64" },
          { name: "totalRaised", type: "uint64" },
          { name: "settledAt", type: "uint64" },
          { name: "saleTokenScale", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deposits",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasParticipated",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "userBidPrice",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getParticipant",
    inputs: [{ name: "index", type: "uint8" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allocations",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokensClaimed",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getContributionHandle",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getBidAmountHandle",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTotalContributedHandle",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_PARTICIPANTS",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },

  // ---------- EVENTS ----------
  {
    type: "event",
    name: "SaleSettled",
    inputs: [
      { name: "clearingPrice", type: "uint64", indexed: false },
      { name: "totalRaised", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SaleFailed",
    inputs: [],
  },
  {
    type: "event",
    name: "AllocationSet",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "tokens", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TokensClaimed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
