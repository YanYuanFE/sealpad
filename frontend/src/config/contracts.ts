// Contract address — update after deployment
export const SEALPAD_ADDRESS = (import.meta.env.VITE_SEALPAD_ADDRESS || "0x18C28BEFDfE6107Ee83d1D1D173D6C88bD335F42") as `0x${string}`;

// ABI — only the functions we need on the frontend
export const SEALPAD_ABI = [
  // ==================== CREATE / CANCEL ====================
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
    outputs: [{ name: "saleId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelSale",
    inputs: [{ name: "saleId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ==================== DEPOSIT ====================
  {
    type: "function",
    name: "addDeposit",
    inputs: [
      { name: "saleId", type: "uint256" },
      { name: "amount", type: "uint64" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "withdrawDeposit",
    inputs: [{ name: "saleId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ==================== CONTRIBUTE / BID ====================
  {
    type: "function",
    name: "contribute",
    inputs: [
      { name: "saleId", type: "uint256" },
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
      { name: "saleId", type: "uint256" },
      { name: "bidPrice", type: "uint64" },
      { name: "encAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "merkleProof", type: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ==================== FINALIZE / SETTLE ====================
  {
    type: "function",
    name: "finalize",
    inputs: [{ name: "saleId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settleFixed",
    inputs: [
      { name: "saleId", type: "uint256" },
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
      { name: "saleId", type: "uint256" },
      { name: "decryptedValues", type: "uint64[]" },
      { name: "decryptionProof", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ==================== CLAIM ====================
  {
    type: "function",
    name: "claim",
    inputs: [{ name: "saleId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ==================== VIEW ====================
  {
    type: "function",
    name: "getSale",
    inputs: [{ name: "saleId", type: "uint256" }],
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
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextSaleId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deposits",
    inputs: [
      { name: "saleId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasParticipated",
    inputs: [
      { name: "saleId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "userBidPrice",
    inputs: [
      { name: "saleId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getParticipant",
    inputs: [
      { name: "saleId", type: "uint256" },
      { name: "index", type: "uint8" },
    ],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allocations",
    inputs: [
      { name: "saleId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimable",
    inputs: [
      { name: "saleId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokensClaimed",
    inputs: [
      { name: "saleId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getContributionHandle",
    inputs: [
      { name: "saleId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getBidAmountHandle",
    inputs: [
      { name: "saleId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTotalContributedHandle",
    inputs: [{ name: "saleId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },

  // ==================== EVENTS ====================
  {
    type: "event",
    name: "SaleCreated",
    inputs: [
      { name: "saleId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "saleType", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SaleSettled",
    inputs: [
      { name: "saleId", type: "uint256", indexed: true },
      { name: "clearingPrice", type: "uint64", indexed: false },
      { name: "totalRaised", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SaleFailed",
    inputs: [{ name: "saleId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "AllocationSet",
    inputs: [
      { name: "saleId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "tokens", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TokensClaimed",
    inputs: [
      { name: "saleId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
