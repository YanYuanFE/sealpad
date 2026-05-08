import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { Warning } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { SALE_VAULT_ABI } from "@/config/contracts";
import { getErrorMessage } from "@/lib/constants";
import { useEnsureSepolia } from "@/lib/network";

type Props = {
  vaultAddress: `0x${string}`;
  onCancelled: () => Promise<unknown> | unknown;
  onError: (msg: string) => void;
};

/// Creator-only escape hatch. The contract allows cancelSale() only while the
/// sale is Active AND no one has joined yet, so we guard rendering by those
/// same conditions in SaleDetail. Cancelling returns the locked sale tokens
/// to the creator and flips status to Cancelled.
export function CancelSaleBanner({
  vaultAddress,
  onCancelled,
  onError,
}: Props) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { mutateAsync: writeContractAsync } = useWriteContract();
  const ensureSepolia = useEnsureSepolia();
  const [step, setStep] = useState<string | null>(null);

  const handle = async () => {
    if (!publicClient) return;
    const ok = window.confirm(
      "Cancel this sale?\n\n" +
        "Your locked sale tokens will be returned and the sale will be permanently set to Cancelled. " +
        "This only works because no one has joined yet — once anyone bids, cancellation is no longer available.",
    );
    if (!ok) return;
    onError("");
    try {
      setStep("Checking network...");
      await ensureSepolia();
      setStep("Simulating...");
      const { request } = await publicClient.simulateContract({
        address: vaultAddress,
        abi: SALE_VAULT_ABI,
        functionName: "cancelSale",
        args: [],
        account: address,
      });
      setStep("Sign cancellation...");
      const h = await writeContractAsync(request);
      setStep("Confirming...");
      await publicClient.waitForTransactionReceipt({ hash: h });
      toast.success("Sale cancelled — locked tokens returned");
      await onCancelled();
    } catch (err) {
      const msg = getErrorMessage(err, "Cancel failed");
      onError(msg);
      toast.error(msg);
    } finally {
      setStep(null);
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Warning
              size={18}
              weight="fill"
              className="text-amber-600 mt-0.5 shrink-0"
            />
            <div>
              <p className="font-mono text-[10px] tracking-widest text-amber-700 uppercase">
                Creator action
              </p>
              <p className="text-sm text-slate-700 mt-1">
                No participants yet — you can still cancel this sale and recover
                your locked sale tokens.
              </p>
            </div>
          </div>
          <button
            onClick={handle}
            disabled={!!step}
            className="border border-amber-400 hover:border-amber-600 text-amber-800 hover:text-amber-900 hover:bg-amber-100/40 px-4 py-2 rounded text-sm transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderRadius: "0.69px" }}
          >
            {step || "Cancel sale"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
