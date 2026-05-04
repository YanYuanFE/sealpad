/// Shape returned by SaleVault.getSale(). Mirrors the Sale struct in
/// contracts/contracts/SaleVault.sol; keep in sync when fields change.
export type SaleData = {
  creator: string;
  saleToken: string;
  saleAmount: bigint;
  payToken: string;
  saleType: number;
  price: bigint;
  softCap: bigint;
  hardCap: bigint;
  maxPerUser: bigint;
  startTime: bigint;
  endTime: bigint;
  whitelistRoot: string;
  cliffDuration: bigint;
  vestingDuration: bigint;
  status: number;
  participantCount: number;
  clearingPrice: bigint;
  totalRaised: bigint;
  settledAt: bigint;
  saleTokenScale: bigint;
};
