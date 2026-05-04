import { useState } from "react";
import { useAccount, useReadContract, useSignTypedData } from "wagmi";
import { toast } from "sonner";
import { Eye, EyeSlash, Lock } from "@phosphor-icons/react";
import { SALE_VAULT_ABI } from "@/config/contracts";
import { getErrorMessage } from "@/lib/constants";
import type { SaleData } from "@/lib/sale-types";
import type { SaleFormatters } from "@/lib/sale-formatters";

type Props = {
  vaultAddress: `0x${string}`;
  sale: SaleData;
  fmt: SaleFormatters;
};

/// "Reveal my bid" button. Reads the user's encrypted contribution / bid
/// amount handle from the vault, then runs the EIP-712 user-decryption flow
/// — only this browser tab sees the plaintext.
///
/// The ACL was granted at contribute/bid time via `FHE.allow(amount, msg.sender)`
/// in SaleVault, so the relayer accepts the request. No on-chain state changes;
/// the cleartext stays in component state until page refresh.
export function RevealMyBidButton({ vaultAddress, sale, fmt }: Props) {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
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
      <div className="rounded border border-brand-200 bg-brand-50/40 p-3 text-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest text-brand-700 uppercase inline-flex items-center gap-1.5">
            <Eye size={10} weight="fill" />
            {isDutch ? "Your Bid Amount" : "Your Contribution"}
          </span>
          <button
            onClick={() => setRevealed(null)}
            className="font-mono text-[10px] tracking-widest text-slate-500 hover:text-slate-900"
          >
            <EyeSlash size={10} weight="fill" className="inline mr-1" />
            HIDE
          </button>
        </div>
        <p className="font-mono font-bold text-slate-900">
          {fmt.fmtPay(revealed)} {fmt.tokenLabel}
        </p>
        <p className="text-xs text-slate-500">
          Decrypted privately via EIP-712 — nobody else sees this value.
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={reveal}
      disabled={!!step}
      className="w-full inline-flex items-center justify-center gap-2 border border-brand-200 hover:border-brand-300 hover:bg-brand-50/40 text-brand-700 px-4 py-2.5 rounded text-sm font-medium transition-colors disabled:opacity-60"
    >
      <Lock size={12} weight="fill" />
      {step ||
        (isDutch
          ? "Reveal my bid amount (private)"
          : "Reveal my contribution (private)")}
    </button>
  );
}
