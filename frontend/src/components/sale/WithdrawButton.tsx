import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { SALE_VAULT_ABI } from "@/config/contracts";
import { getErrorMessage } from "@/lib/constants";
import { useEnsureSepolia } from "@/lib/network";

type Props = {
  vaultAddress: `0x${string}`;
  /// Display label, e.g. "Withdraw Deposit" or "Withdraw Remaining Deposit (X ETH)"
  label: string;
  className?: string;
  onWithdrawn: () => Promise<unknown> | unknown;
  onError: (msg: string) => void;
};

/// Wraps SaleVault.withdrawDeposit() in a self-contained button.
/// Used both in the Failed/Cancelled card and the Settled result card.
export function WithdrawButton({
  vaultAddress,
  label,
  className,
  onWithdrawn,
  onError,
}: Props) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const ensureSepolia = useEnsureSepolia();
  const [step, setStep] = useState<string | null>(null);

  const handle = async () => {
    if (!publicClient) return;
    onError("");
    try {
      setStep("Checking network...");
      await ensureSepolia();
      setStep("Simulating...");
      const { request } = await publicClient.simulateContract({
        address: vaultAddress,
        abi: SALE_VAULT_ABI,
        functionName: "withdrawDeposit",
        args: [],
        account: address,
      });
      setStep("Sign withdrawal...");
      const h = await writeContractAsync(request);
      setStep("Confirming...");
      await publicClient.waitForTransactionReceipt({ hash: h });
      toast.success("Deposit withdrawn!");
      await onWithdrawn();
    } catch (err) {
      const msg = getErrorMessage(err, "Withdrawal failed");
      onError(msg);
      toast.error(msg);
    } finally {
      setStep(null);
    }
  };

  return (
    <button
      onClick={handle}
      disabled={!!step}
      className={
        className ??
        "border border-slate-300 hover:border-slate-400 text-slate-700 px-6 py-2.5 rounded text-sm transition-colors"
      }
    >
      {step || label}
    </button>
  );
}
