import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { SALE_VAULT_ABI } from "@/config/contracts";
import { getErrorMessage } from "@/lib/constants";
import { REQUIRED_CHAIN_ID, useEnsureSepolia } from "@/lib/network";

type Props = {
  vaultAddress: `0x${string}`;
  onFinalized: () => Promise<unknown> | unknown;
  onError: (msg: string) => void;
};

export function FinalizeBanner({ vaultAddress, onFinalized, onError }: Props) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const ensureSepolia = useEnsureSepolia();
  const [step, setStep] = useState<string | null>(null);

  const handleFinalize = async () => {
    if (!publicClient) return;
    onError("");
    try {
      setStep("Checking network...");
      await ensureSepolia();
      setStep("Sign finalize...");
      const h = await writeContractAsync({
        address: vaultAddress,
        abi: SALE_VAULT_ABI,
        functionName: "finalize",
        args: [],
        chainId: REQUIRED_CHAIN_ID,
      });
      setStep("Requesting FHE decryption...");
      await publicClient.waitForTransactionReceipt({ hash: h });
      toast.success("Sale finalized — awaiting decryption");
      await onFinalized();
    } catch (err) {
      const msg = getErrorMessage(err, "Finalize failed");
      onError(msg);
      toast.error(msg);
    } finally {
      setStep(null);
    }
  };

  return (
    <Card>
      <CardContent className="py-6 text-center space-y-4">
        <p className="text-slate-600">
          Sale has ended. Ready for finalization.
        </p>
        <button
          onClick={handleFinalize}
          disabled={!!step}
          className="bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white px-8 py-3 rounded font-semibold transition-colors"
        >
          {step || "Finalize Sale"}
        </button>
      </CardContent>
    </Card>
  );
}
