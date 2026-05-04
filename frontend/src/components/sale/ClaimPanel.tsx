import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SALE_VAULT_ABI } from "@/config/contracts";
import { getErrorMessage } from "@/lib/constants";
import { REQUIRED_CHAIN_ID, useEnsureSepolia } from "@/lib/network";
import type { SaleData } from "@/lib/sale-types";
import type { SaleFormatters } from "@/lib/sale-formatters";
import { WithdrawButton } from "./WithdrawButton";

type Props = {
  vaultAddress: `0x${string}`;
  sale: SaleData;
  fmt: SaleFormatters;
  isConnected: boolean;
  currentDeposit: bigint;
  userAllocation: bigint | undefined;
  userClaimable: bigint | undefined;
  onClaimed: () => Promise<unknown> | unknown;
  onWithdrawn: () => Promise<unknown> | unknown;
  onError: (msg: string) => void;
};

/// Settled-state result card. Shows clearing price + total raised, optional
/// allocation row + claim button, and the leftover-deposit withdraw button.
export function ClaimPanel({
  vaultAddress,
  sale,
  fmt,
  isConnected,
  currentDeposit,
  userAllocation,
  userClaimable,
  onClaimed,
  onWithdrawn,
  onError,
}: Props) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const ensureSepolia = useEnsureSepolia();
  const [step, setStep] = useState<string | null>(null);

  const handleClaim = async () => {
    if (!publicClient) return;
    onError("");
    try {
      setStep("Checking network...");
      await ensureSepolia();
      setStep("Sign claim...");
      const h = await writeContractAsync({
        address: vaultAddress,
        abi: SALE_VAULT_ABI,
        functionName: "claim",
        args: [],
        chainId: REQUIRED_CHAIN_ID,
      });
      setStep("Confirming...");
      await publicClient.waitForTransactionReceipt({ hash: h });
      toast.success("Tokens claimed!");
      await onClaimed();
    } catch (err) {
      const msg = getErrorMessage(err, "Claim failed");
      onError(msg);
      toast.error(msg);
    } finally {
      setStep(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Result</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md bg-brand-50 border border-brand-100 p-4">
          <p className="text-sm font-semibold text-brand-800">
            Clearing Price:{" "}
            <span className="font-mono">
              {fmt.fmtPay(sale.clearingPrice)} {fmt.tokenLabel}
            </span>
          </p>
          <p className="text-sm text-brand-700 mt-1">
            Total Raised:{" "}
            <span className="font-mono">
              {fmt.fmtPay(sale.totalRaised)} {fmt.tokenLabel}
            </span>
          </p>
        </div>

        {isConnected && userAllocation !== undefined && userAllocation > 0n && (
          <div className="space-y-3">
            <div className="rounded border border-slate-200 p-3 text-sm">
              <p className="text-slate-500">Your Allocation</p>
              <p className="font-mono font-bold text-lg text-slate-900 mt-1">
                {fmt.fmtSale(userAllocation)} {fmt.saleLabel}
              </p>
            </div>
            {userClaimable !== undefined && userClaimable > 0n && (
              <button
                onClick={handleClaim}
                disabled={!!step}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white py-3 rounded font-semibold transition-colors"
              >
                {step ||
                  `Claim ${fmt.fmtSale(userClaimable)} ${fmt.saleLabel}`}
              </button>
            )}
          </div>
        )}

        {isConnected && currentDeposit > 0n && (
          <WithdrawButton
            vaultAddress={vaultAddress}
            label={`Withdraw Remaining Deposit (${fmt.fmtPay(currentDeposit)} ${fmt.tokenLabel})`}
            className="w-full border border-slate-300 hover:border-slate-400 text-slate-700 py-2.5 rounded text-sm transition-colors"
            onWithdrawn={onWithdrawn}
            onError={onError}
          />
        )}
      </CardContent>
    </Card>
  );
}
