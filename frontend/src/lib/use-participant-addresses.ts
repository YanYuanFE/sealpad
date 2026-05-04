import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { SALE_VAULT_ABI } from "@/config/contracts";

/// Reads the sorted list of participant addresses for a vault. Used both by
/// ParticipantsList and SettleBanner — the latter needs the addresses to
/// build the FHE handle list in the order the contract expects.
export function useParticipantAddresses(
  vaultAddress: `0x${string}`,
  participantCount: number,
): string[] {
  const calls = useMemo(
    () =>
      Array.from({ length: participantCount }, (_, i) => ({
        address: vaultAddress,
        abi: SALE_VAULT_ABI,
        functionName: "getParticipant" as const,
        args: [i] as const,
      })),
    [participantCount, vaultAddress],
  );

  const { data } = useReadContracts({
    contracts: calls,
    query: { enabled: participantCount > 0 },
  });

  return useMemo(
    () =>
      Array.from(
        { length: participantCount },
        (_, i) => data?.[i]?.result as string | undefined,
      ).filter((a): a is string => typeof a === "string"),
    [participantCount, data],
  );
}
