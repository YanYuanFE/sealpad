import { useEffect, useState } from "react";
import { getAddress, type Address, type Hex } from "viem";
import { buildMerkleTree, getProofForAddress, isEmptyRoot } from "@/lib/merkle";
import { fetchWhitelist } from "@/lib/whitelist-api";

export type WhitelistStatus =
  | "idle" // sale isn't whitelisted (or wallet not connected)
  | "loading"
  | "eligible"
  | "not_eligible"
  | "missing" // backend has no entry; UI should fall back to manual paste
  | "corrupt"; // backend returned data but its root doesn't match on-chain

export type WhitelistEligibility = {
  status: WhitelistStatus;
  autoProof: Hex[] | null;
};

export function useWhitelistEligibility({
  vaultAddress,
  whitelistRoot,
  userAddress,
}: {
  vaultAddress: Address;
  whitelistRoot: string;
  userAddress: Address | undefined;
}): WhitelistEligibility {
  const [status, setStatus] = useState<WhitelistStatus>("idle");
  const [autoProof, setAutoProof] = useState<Hex[] | null>(null);

  const isWhitelisted = !isEmptyRoot(whitelistRoot);

  useEffect(() => {
    if (!isWhitelisted || !userAddress) {
      setStatus("idle");
      setAutoProof(null);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setAutoProof(null);

    (async () => {
      try {
        const data = await fetchWhitelist(vaultAddress, whitelistRoot as Hex);
        if (cancelled) return;
        if (!data) {
          setStatus("missing");
          return;
        }
        // Trust nothing the API returns until we re-derive the root and
        // compare to the on-chain whitelistRoot. Anyone can POST here.
        const checksummed = data.addresses.map((a) => getAddress(a));
        const recomputed = buildMerkleTree(checksummed);
        if (recomputed.root.toLowerCase() !== whitelistRoot.toLowerCase()) {
          setStatus("corrupt");
          return;
        }
        const proof = getProofForAddress(checksummed, userAddress);
        if (cancelled) return;
        if (proof === null) {
          setStatus("not_eligible");
        } else {
          setAutoProof(proof);
          setStatus("eligible");
        }
      } catch {
        if (!cancelled) setStatus("missing");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isWhitelisted, userAddress, vaultAddress, whitelistRoot]);

  return { status, autoProof };
}
