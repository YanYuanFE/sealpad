import { useEffect, useState } from "react";
import {
  useBlockNumber,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { SALE_VAULT_ABI } from "@/config/contracts";
import { getErrorMessage } from "@/lib/constants";
import { REQUIRED_CHAIN_ID, useEnsureSepolia } from "@/lib/network";

type Props = {
  vaultAddress: `0x${string}`;
  /// `Sale.finalizeRequestedAt` from the parent. 0 means request hasn't been
  /// made yet — we render the request button. >0 means we're inside the
  /// reorg-safety countdown and need to wait before showing the finalize
  /// button.
  finalizeRequestedAt: bigint;
  onTransitioned: () => Promise<unknown> | unknown;
  onError: (msg: string) => void;
};

export function FinalizeBanner({
  vaultAddress,
  finalizeRequestedAt,
  onTransitioned,
  onError,
}: Props) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const ensureSepolia = useEnsureSepolia();
  const [step, setStep] = useState<string | null>(null);

  const { data: reorgDelayRaw } = useReadContract({
    address: vaultAddress,
    abi: SALE_VAULT_ABI,
    functionName: "FINALIZE_REORG_DELAY",
  });
  const { data: blockNumber } = useBlockNumber({ watch: true });

  // Re-render every 6s so the countdown updates even when block.number doesn't
  // tick on cached RPC responses. wagmi's useBlockNumber({watch:true}) is the
  // primary signal but this is a cheap belt-and-braces.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 6_000);
    return () => window.clearInterval(id);
  }, []);

  const requested = finalizeRequestedAt > 0n;
  const reorgDelay = typeof reorgDelayRaw === "bigint" ? reorgDelayRaw : 95n;
  const earliestBlock = finalizeRequestedAt + reorgDelay;
  const blocksRemaining =
    requested && typeof blockNumber === "bigint"
      ? earliestBlock > blockNumber
        ? earliestBlock - blockNumber
        : 0n
      : null;
  const reorgWindowOpen =
    requested && blocksRemaining !== null && blocksRemaining > 0n;
  const readyToFinalize =
    requested && blocksRemaining !== null && blocksRemaining === 0n;

  const handleRequest = async () => {
    if (!publicClient) return;
    onError("");
    try {
      setStep("Checking network...");
      await ensureSepolia();
      setStep("Sign request...");
      const h = await writeContractAsync({
        address: vaultAddress,
        abi: SALE_VAULT_ABI,
        functionName: "requestFinalize",
        args: [],
        chainId: REQUIRED_CHAIN_ID,
      });
      setStep("Confirming...");
      await publicClient.waitForTransactionReceipt({ hash: h });
      toast.success("Finalization requested");
      await onTransitioned();
    } catch (err) {
      const msg = getErrorMessage(err, "Request failed");
      onError(msg);
      toast.error(msg);
    } finally {
      setStep(null);
    }
  };

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
      await onTransitioned();
    } catch (err) {
      const msg = getErrorMessage(err, "Finalize failed");
      onError(msg);
      toast.error(msg);
    } finally {
      setStep(null);
    }
  };

  if (reorgWindowOpen) {
    // Sepolia ≈ 12s/block, so ~95 blocks ≈ 19 minutes. Display both block and
    // approximate time remaining to set expectations.
    const remaining = Number(blocksRemaining ?? 0n);
    const minutes = Math.ceil((remaining * 12) / 60);
    return (
      <Card>
        <CardContent className="py-6 text-center space-y-3">
          <p className="font-mono text-xs tracking-widest text-brand-600 uppercase">
            Reorg-safety window
          </p>
          <p className="text-slate-700">
            Finalization request submitted. Waiting{" "}
            <span className="font-mono font-bold">{remaining}</span> more block
            {remaining === 1 ? "" : "s"} (~{minutes} min) before publishing
            ciphertexts for KMS decryption.
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            The delay protects against chain reorgs that could otherwise let an
            attacker grab decrypted bids and keep them after the on-chain ACL
            grant gets reverted.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (readyToFinalize) {
    return (
      <Card>
        <CardContent className="py-6 text-center space-y-4">
          <p className="font-mono text-xs tracking-widest text-brand-600 uppercase">
            Reorg window cleared
          </p>
          <p className="text-slate-600">
            Ready to publish FHE handles for KMS decryption.
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

  // requested == false → first step
  return (
    <Card>
      <CardContent className="py-6 text-center space-y-4">
        <p className="text-slate-600">
          Sale has ended. Request finalization to start the reorg-safety window.
        </p>
        <button
          onClick={handleRequest}
          disabled={!!step}
          className="bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white px-8 py-3 rounded font-semibold transition-colors"
        >
          {step || "Request Finalize"}
        </button>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          A short waiting period (~19 minutes on Sepolia) follows before the
          actual finalize step, so encrypted bids can&rsquo;t be exfiltrated by
          a chain reorg.
        </p>
      </CardContent>
    </Card>
  );
}
