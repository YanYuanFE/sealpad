import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { SALE_VAULT_ABI } from "@/config/contracts";

type Args = {
  vaultAddress: `0x${string}`;
  settledAt: bigint;
  cliffDuration: bigint;
  vestingDuration: bigint;
  allocation: bigint;
};

/// Real-time vesting state, mirroring SaleVault._vestedAmount.
///
/// The contract's `claimable(user)` view only changes block-by-block, but the
/// vested amount accrues continuously. This hook ticks once a second so the
/// UI reflects the value `claim()` would pay out at this exact moment.
///
/// Returns: { now, claimed, vested, claimable }.
/// `claimed` comes from `tokensClaimed[user]` (5s polling for post-claim
/// freshness); the rest is derived locally.
export function useLiveVesting({
  vaultAddress,
  settledAt,
  cliffDuration,
  vestingDuration,
  allocation,
}: Args) {
  const { address } = useAccount();

  const { data: tokensClaimedRaw } = useReadContract({
    address: vaultAddress,
    abi: SALE_VAULT_ABI,
    functionName: "tokensClaimed",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5_000,
    },
  });
  const claimed = (tokensClaimedRaw as bigint | undefined) ?? 0n;

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);

  let vested: bigint;
  if (cliffDuration === 0n && vestingDuration === 0n) {
    vested = allocation;
  } else {
    const settled = Number(settledAt);
    const cliff = Number(cliffDuration);
    const cliffEnd = settled + cliff;
    const vestEnd = cliffEnd + Number(vestingDuration);
    if (now >= vestEnd) {
      vested = allocation;
    } else if (now < cliffEnd) {
      vested = 0n;
    } else {
      const elapsed = BigInt(now - cliffEnd);
      vested = (allocation * elapsed) / vestingDuration;
    }
  }

  const claimable = vested > claimed ? vested - claimed : 0n;

  return { now, claimed, vested, claimable };
}
