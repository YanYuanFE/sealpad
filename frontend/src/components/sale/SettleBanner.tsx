import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { Lock } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { SALE_VAULT_ABI } from "@/config/contracts";
import { getErrorMessage } from "@/lib/constants";
import { useEnsureSepolia } from "@/lib/network";
import type { SaleData } from "@/lib/sale-types";

type Props = {
  vaultAddress: `0x${string}`;
  sale: SaleData;
  participantAddrs: string[];
  onSettled: () => Promise<unknown> | unknown;
  onError: (msg: string) => void;
};

/// Drives the second phase of settlement: read every encrypted handle, ask the
/// KMS for plaintexts, then submit the values + proof to the vault. Handle
/// reads run in Promise.all so a 50-bidder sale doesn't take 50 sequential
/// round-trips.
export function SettleBanner({
  vaultAddress,
  sale,
  participantAddrs,
  onSettled,
  onError,
}: Props) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const ensureSepolia = useEnsureSepolia();
  const [step, setStep] = useState<string | null>(null);

  const handleSettle = async () => {
    if (!publicClient) return;
    onError("");
    try {
      setStep("Checking network...");
      await ensureSepolia();
      setStep("Reading encrypted handles...");

      // FixedPrice: [totalContributedHandle, contrib_user0, contrib_user1, ...]
      // Dutch:      [bidAmount_user0, bidAmount_user1, ...]
      let handles: `0x${string}`[];

      if (sale.saleType === 0) {
        const reads = await Promise.all([
          publicClient.readContract({
            address: vaultAddress,
            abi: SALE_VAULT_ABI,
            functionName: "getTotalContributedHandle",
          }),
          ...participantAddrs.map((addr) =>
            publicClient.readContract({
              address: vaultAddress,
              abi: SALE_VAULT_ABI,
              functionName: "getContributionHandle",
              args: [addr as `0x${string}`],
            }),
          ),
        ]);
        handles = reads as `0x${string}`[];
      } else {
        const reads = await Promise.all(
          participantAddrs.map((addr) =>
            publicClient.readContract({
              address: vaultAddress,
              abi: SALE_VAULT_ABI,
              functionName: "getBidAmountHandle",
              args: [addr as `0x${string}`],
            }),
          ),
        );
        handles = reads as `0x${string}`[];
      }

      setStep("Requesting KMS public decryption...");
      const { publicDecryptHandles } = await import("@/lib/fhevm");
      const { values, proof } = await publicDecryptHandles(handles);

      setStep("Simulating settlement...");
      const { request } = await publicClient.simulateContract({
        address: vaultAddress,
        abi: SALE_VAULT_ABI,
        functionName: sale.saleType === 0 ? "settleFixed" : "settleDutch",
        args: [values, proof],
        account: address,
      });
      setStep("Sign settlement...");
      const h = await writeContractAsync(request);
      setStep("Confirming...");
      await publicClient.waitForTransactionReceipt({ hash: h });
      toast.success("Sale settled!");
      await onSettled();
    } catch (err) {
      const msg = getErrorMessage(err, "Settle failed");
      onError(msg);
      toast.error(msg);
    } finally {
      setStep(null);
    }
  };

  return (
    <Card>
      <CardContent className="py-6 text-center space-y-4">
        <Lock size={28} weight="duotone" className="mx-auto text-brand-500" />
        <p className="text-slate-700">
          FHE handles published for KMS public decryption.
        </p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Anyone can now finish the sale by fetching the decrypted values from
          the relayer and submitting them on-chain with the KMS proof.
        </p>
        <button
          onClick={handleSettle}
          disabled={!!step}
          className="bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded font-semibold transition-colors"
        >
          {step || "Settle Sale"}
        </button>
      </CardContent>
    </Card>
  );
}
