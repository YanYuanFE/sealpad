import { useState } from "react";
import { useAccount, useReadContract, useSignTypedData } from "wagmi";
import { toast } from "sonner";
import { EyeSlash, Lock } from "@phosphor-icons/react";
import { SALE_VAULT_ABI } from "@/config/contracts";
import { getErrorMessage } from "@/lib/constants";
import type { SaleData } from "@/lib/sale-types";
import type { SaleFormatters } from "@/lib/sale-formatters";

type Props = {
  vaultAddress: `0x${string}`;
  sale: SaleData;
  fmt: SaleFormatters;
};

/// Inline reveal control for the user's own encrypted contribution / bid.
/// Reads the user's handle from the vault, runs the EIP-712 user-decryption
/// flow, and displays the cleartext locally — only this browser tab sees the
/// plaintext. The on-chain ACL is set up at contribute/bid time via
/// FHE.allow(amount, msg.sender) in SaleVault, so the relayer accepts the
/// request without a separate ACL grant.
///
/// Designed to slot into a label-value row (e.g. "Contribution: <reveal>").
export function RevealMyBidButton({ vaultAddress, sale, fmt }: Props) {
  const { address, isConnected } = useAccount();
  const { mutateAsync: signTypedDataAsync } = useSignTypedData();
  const [revealed, setRevealed] = useState<bigint | null>(null);
  const [step, setStep] = useState<string | null>(null);

  const isDutch = sale.saleType === 1;
  const handleFn = isDutch ? "getBidAmountHandle" : "getContributionHandle";

  const { data: handleRaw } = useReadContract({
    address: vaultAddress,
    abi: SALE_VAULT_ABI,
    functionName: handleFn,
    args: address ? [address] : undefined,
    query: { enabled: !!address && isConnected },
  });

  const handle =
    typeof handleRaw === "string" ? (handleRaw as `0x${string}`) : null;
  const handleIsZero =
    handle ===
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  const reveal = async () => {
    if (!address || !handle || handleIsZero) return;
    try {
      setStep("Sign EIP-712...");
      const { userDecryptOwnHandle } = await import("@/lib/fhevm");
      const value = await userDecryptOwnHandle({
        vaultAddress,
        userAddress: address,
        handle,
        signTypedDataAsync: (args) =>
          signTypedDataAsync({
            domain: args.domain,
            types: args.types,
            primaryType: args.primaryType,
            message: args.message,
          }) as Promise<`0x${string}`>,
      });
      setRevealed(value);
    } catch (err) {
      const msg = getErrorMessage(err, "Reveal failed");
      toast.error(msg);
    } finally {
      setStep(null);
    }
  };

  if (!isConnected || handleIsZero || !handle) return null;

  if (revealed !== null) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-900">
        {fmt.fmtPay(revealed)} {fmt.tokenLabel}
        <button
          onClick={() => setRevealed(null)}
          title="Hide value"
          className="text-slate-400 hover:text-slate-700 transition-colors"
        >
          <EyeSlash size={11} weight="fill" />
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={reveal}
      disabled={!!step}
      className="inline-flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase border border-brand-200 hover:border-brand-300 hover:bg-brand-50/40 text-brand-700 bg-brand-50/40 px-2 py-1 rounded transition-colors disabled:opacity-60"
    >
      <Lock size={10} weight="fill" />
      {step || "REVEAL"}
    </button>
  );
}
