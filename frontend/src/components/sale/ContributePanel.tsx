import { useMemo, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { CheckCircle, Lock, Warning } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SALE_VAULT_ABI } from "@/config/contracts";
import { getErrorMessage } from "@/lib/constants";
import { isEmptyRoot, tryParseProofJson } from "@/lib/merkle";
import { useEnsureSepolia } from "@/lib/network";
import type { WhitelistEligibility } from "@/lib/use-whitelist-eligibility";
import type { SaleData } from "@/lib/sale-types";
import type { SaleFormatters } from "@/lib/sale-formatters";

type Props = {
  vaultAddress: `0x${string}`;
  sale: SaleData;
  fmt: SaleFormatters;
  currentDeposit: bigint;
  hasJoined: boolean;
  eligibility: WhitelistEligibility;
  onSubmitted: () => Promise<unknown> | unknown;
  onError: (msg: string) => void;
};

export function ContributePanel({
  vaultAddress,
  sale,
  fmt,
  currentDeposit,
  hasJoined,
  eligibility,
  onSubmitted,
  onError,
}: Props) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { mutateAsync: writeContractAsync } = useWriteContract();
  const ensureSepolia = useEnsureSepolia();

  const [quantityInput, setQuantityInput] = useState("");
  const [bidPriceInput, setBidPriceInput] = useState("");
  const [proofInput, setProofInput] = useState("");
  const [step, setStep] = useState<string | null>(null);

  const isDutch = sale.saleType === 1;
  const floorPriceFormatted = fmt.fmtPay(sale.price);

  const isWhitelisted = !isEmptyRoot(sale.whitelistRoot);
  const { status: whitelistStatus, autoProof } = eligibility;

  // Allow manual paste only when auto-fetch couldn't help.
  const allowManualProof =
    whitelistStatus === "missing" || whitelistStatus === "corrupt";

  const parsedProof = useMemo(
    () =>
      isWhitelisted && allowManualProof
        ? tryParseProofJson(proofInput, address as `0x${string}` | undefined)
        : [],
    [isWhitelisted, allowManualProof, proofInput, address],
  );
  const proofInvalid =
    isWhitelisted && allowManualProof && parsedProof === null;

  const quantityRaw = fmt.tryParseSaleTokens(quantityInput);
  const bidPriceRaw = isDutch ? fmt.tryParsePay(bidPriceInput) : null;

  const bidPriceInvalid =
    isDutch && bidPriceInput.trim() !== "" && bidPriceRaw === null;
  const bidPriceBelowFloor =
    isDutch && bidPriceRaw !== null && bidPriceRaw < sale.price;
  const quantityInvalid = quantityInput.trim() !== "" && quantityRaw === null;
  const quantityIsPositive = quantityRaw !== null && quantityRaw > 0n;
  const effectivePriceRaw = isDutch ? bidPriceRaw : sale.price;

  const computedCostRaw =
    quantityRaw !== null && effectivePriceRaw !== null && effectivePriceRaw > 0n
      ? (quantityRaw * effectivePriceRaw) / fmt.saleTokenScale
      : null;
  const computedCost =
    computedCostRaw !== null ? fmt.fmtPay(computedCostRaw) : "";
  const costExceedsDeposit =
    computedCostRaw !== null && computedCostRaw > currentDeposit;

  // Whitelist gating: block submission unless we have a usable proof.
  const whitelistBlocked =
    isWhitelisted &&
    !(
      whitelistStatus === "eligible" ||
      (allowManualProof && parsedProof !== null && parsedProof.length > 0)
    );

  const disabled =
    !!step ||
    !quantityIsPositive ||
    quantityInvalid ||
    computedCostRaw === null ||
    computedCostRaw === 0n ||
    costExceedsDeposit ||
    currentDeposit === 0n ||
    (isDutch && (bidPriceRaw === null || bidPriceBelowFloor)) ||
    whitelistBlocked ||
    (allowManualProof && proofInvalid);

  const handleSubmit = async () => {
    if (
      !publicClient ||
      !address ||
      computedCostRaw === null ||
      computedCostRaw === 0n ||
      !quantityIsPositive
    )
      return;
    onError("");
    try {
      setStep("Checking network...");
      await ensureSepolia();
      setStep("Encrypting with FHE...");

      if (computedCostRaw > currentDeposit) {
        throw new Error("Cost exceeds your deposit");
      }
      if (isDutch && bidPriceRaw === null) {
        throw new Error("Invalid bid price");
      }

      const { encryptBidAmount } = await import("@/lib/fhevm");
      const encrypted = await encryptBidAmount(
        vaultAddress,
        address,
        computedCostRaw,
      );

      // Prefer auto-fetched proof; fall back to manually-pasted proof when
      // the backend couldn't help. For non-whitelisted sales, send [].
      const merkleProof: `0x${string}`[] = isWhitelisted
        ? (autoProof ?? parsedProof ?? [])
        : [];

      if (isDutch) {
        const resolvedBidPrice = bidPriceRaw;
        if (resolvedBidPrice === null) {
          throw new Error("Invalid bid price");
        }
        setStep("Simulating bid...");
        const { request } = await publicClient.simulateContract({
          address: vaultAddress,
          abi: SALE_VAULT_ABI,
          functionName: "bid",
          args: [
            resolvedBidPrice,
            encrypted.handle,
            encrypted.inputProof,
            merkleProof,
          ],
          account: address,
        });
        setStep("Sign bid...");
        const h = await writeContractAsync(request);
        setStep("Confirming...");
        await publicClient.waitForTransactionReceipt({ hash: h });
        toast.success("Bid submitted!");
      } else {
        setStep("Simulating contribution...");
        const { request } = await publicClient.simulateContract({
          address: vaultAddress,
          abi: SALE_VAULT_ABI,
          functionName: "contribute",
          args: [encrypted.handle, encrypted.inputProof, merkleProof],
          account: address,
        });
        setStep("Sign contribution...");
        const h = await writeContractAsync(request);
        setStep("Confirming...");
        await publicClient.waitForTransactionReceipt({ hash: h });
        toast.success("Contribution submitted!");
      }
      await onSubmitted();
    } catch (err) {
      const msg = getErrorMessage(err, "Bid failed");
      onError(msg);
      toast.error(msg);
    } finally {
      setStep(null);
    }
  };

  const title = isDutch
    ? hasJoined
      ? "Step 2 · Update Bid"
      : "Step 2 · Place Bid"
    : hasJoined
      ? "Step 2 · Update Contribution"
      : "Step 2 · Contribute";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isWhitelisted && (
          <div
            className="border border-slate-200 px-3 py-2.5 space-y-2 bg-slate-50/60"
            style={{ borderRadius: "0.69px" }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono tracking-widest text-slate-500">
                WHITELIST
              </span>
              {whitelistStatus === "loading" && (
                <span className="text-xs text-slate-500">Checking…</span>
              )}
              {whitelistStatus === "eligible" && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle size={14} weight="fill" /> Eligible
                </span>
              )}
              {(whitelistStatus === "missing" ||
                whitelistStatus === "corrupt") && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                  <Warning size={14} weight="fill" /> Manual proof required
                </span>
              )}
            </div>

            {whitelistStatus === "eligible" && (
              <p className="text-xs text-slate-500">
                Your wallet is on the whitelist. Proof was generated locally
                from the published address list and will be sent with your
                submission.
              </p>
            )}

            {(whitelistStatus === "missing" ||
              whitelistStatus === "corrupt") && (
              <>
                <p className="text-xs text-amber-700">
                  {whitelistStatus === "corrupt"
                    ? "Published whitelist data doesn't match the on-chain root. Falling back to manual proof."
                    : "Whitelist hasn't been published to the backend. Paste your proof JSON manually below."}
                </p>
                <textarea
                  value={proofInput}
                  onChange={(e) => setProofInput(e.target.value)}
                  placeholder='Paste your proof (e.g. ["0x...", "0x..."]) or the full bundle JSON.'
                  rows={3}
                  className={`w-full font-mono text-xs px-3 py-2 border focus:outline-none resize-y ${
                    proofInvalid
                      ? "border-rose-400 focus:border-rose-500"
                      : "border-slate-300 focus:border-brand-500"
                  }`}
                  style={{ borderRadius: "0.69px" }}
                />
                {proofInvalid && (
                  <p className="text-xs text-rose-600">
                    Couldn&apos;t parse a proof for your address from this JSON.
                  </p>
                )}
                {!proofInvalid && parsedProof && parsedProof.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Proof loaded ({parsedProof.length} node
                    {parsedProof.length === 1 ? "" : "s"}).
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {isDutch && (
          <div className="space-y-2">
            <Label>Your Bid Price ({fmt.tokenLabel} per token)</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder={`Min ${floorPriceFormatted} ${fmt.tokenLabel}`}
              value={bidPriceInput}
              onChange={(e) => setBidPriceInput(e.target.value)}
              className={
                bidPriceBelowFloor || bidPriceInvalid ? "border-rose-400" : ""
              }
            />
            {bidPriceInvalid && (
              <p className="text-xs text-rose-600">Enter a valid bid price.</p>
            )}
            {bidPriceBelowFloor && (
              <p className="text-xs text-rose-600">
                Bid price must be at least {floorPriceFormatted}{" "}
                {fmt.tokenLabel} (floor price).
              </p>
            )}
            <p className="text-xs text-slate-500">
              <strong>Public</strong> — your chosen price per token. Floor:{" "}
              {floorPriceFormatted} {fmt.tokenLabel}.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Token Quantity ({fmt.saleLabel})</Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="How many tokens to buy"
            value={quantityInput}
            onChange={(e) => setQuantityInput(e.target.value)}
          />
          {quantityInvalid && (
            <p className="text-xs text-rose-600">
              Enter a valid token quantity.
            </p>
          )}
          {computedCost && (
            <div
              className={`flex items-center justify-between rounded border px-3 py-2.5 text-sm ${
                costExceedsDeposit
                  ? "border-rose-300 bg-rose-50/40"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <span className="text-slate-500">Total cost</span>
              <span className="font-mono font-bold text-slate-900">
                {computedCost} {fmt.tokenLabel}
              </span>
            </div>
          )}
          {costExceedsDeposit && (
            <p className="text-xs text-rose-600">
              Cost exceeds your deposit ({fmt.fmtPay(currentDeposit)}{" "}
              {fmt.tokenLabel}). Add more deposit first.
            </p>
          )}
          <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
            <Lock size={10} weight="fill" className="text-brand-500" />
            <span>
              <strong>FHE-encrypted</strong> — nobody can see how many tokens
              you're buying.
              {isDutch && " Everyone above clearing pays the uniform price."}
            </span>
          </p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={disabled}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded font-semibold transition-colors"
        >
          {step || (hasJoined ? "Update (no transfer)" : "Encrypt & Submit")}
        </button>
      </CardContent>
    </Card>
  );
}
