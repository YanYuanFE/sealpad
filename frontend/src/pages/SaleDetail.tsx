import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  usePublicClient,
  useBalance,
} from "wagmi";
import {
  erc20Abi,
  parseUnits,
  parseEther,
  formatUnits,
  formatEther,
} from "viem";
import { toast } from "sonner";
import { Lock } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrambleText } from "@/components/landing/shared/ScrambleText";
import { CopyAddress } from "@/components/CopyAddress";
import { SEALPAD_ADDRESS, SEALPAD_ABI } from "@/config/contracts";
import {
  SaleTypeLabel,
  SaleStatusLabel,
  isETHPayToken,
  getErrorMessage,
} from "@/lib/constants";
import { REQUIRED_CHAIN_ID, useEnsureSepolia } from "@/lib/network";

export function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const saleId = Number(id);
  const { address, isConnected } = useAccount();

  const [depositInput, setDepositInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [bidPriceInput, setBidPriceInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [depositStep, setDepositStep] = useState<string | null>(null);
  const [bidStep, setBidStep] = useState<string | null>(null);
  const [finalizeStep, setFinalizeStep] = useState<string | null>(null);
  const [settleStep, setSettleStep] = useState<string | null>(null);
  const [claimStep, setClaimStep] = useState<string | null>(null);
  const [withdrawStep, setWithdrawStep] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  // 30s tick keeps the start/end countdown fresh without re-running on every
  // unrelated state change. The component remounts when saleId changes via
  // route param, so the interval is naturally scoped to the page view.
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const validId = Number.isInteger(saleId) && saleId >= 0;

  const { data: nextSaleId } = useReadContract({
    address: SEALPAD_ADDRESS,
    abi: SEALPAD_ABI,
    functionName: "nextSaleId",
  });

  const idOutOfRange =
    validId && nextSaleId !== undefined && BigInt(saleId) >= nextSaleId;
  const idResolvable = validId && !idOutOfRange;

  const { data: sale, refetch } = useReadContract({
    address: SEALPAD_ADDRESS,
    abi: SEALPAD_ABI,
    functionName: "getSale",
    args: [BigInt(saleId)],
    query: { enabled: idResolvable },
  });

  const isETH = sale ? isETHPayToken(sale.payToken) : false;

  const { data: payTokenSymbol } = useReadContract({
    address: sale?.payToken as `0x${string}`,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: !!sale && !isETH },
  });

  const { data: payTokenDecimals } = useReadContract({
    address: sale?.payToken as `0x${string}`,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: !!sale && !isETH },
  });

  const { data: saleTokenSymbol } = useReadContract({
    address: sale?.saleToken as `0x${string}`,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: !!sale },
  });

  const { data: saleTokenDecimalsRaw } = useReadContract({
    address: sale?.saleToken as `0x${string}`,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: !!sale },
  });

  const { data: ethBalance } = useBalance({
    address,
    query: { enabled: isETH && !!address },
  });

  const { data: userDeposit, refetch: refetchDeposit } = useReadContract({
    address: SEALPAD_ADDRESS,
    abi: SEALPAD_ABI,
    functionName: "deposits",
    args: address ? [BigInt(saleId), address] : undefined,
    query: { enabled: !!address },
  });

  const { data: hasJoined } = useReadContract({
    address: SEALPAD_ADDRESS,
    abi: SEALPAD_ABI,
    functionName: "hasParticipated",
    args: address ? [BigInt(saleId), address] : undefined,
    query: { enabled: !!address },
  });

  const { data: userAllocation } = useReadContract({
    address: SEALPAD_ADDRESS,
    abi: SEALPAD_ABI,
    functionName: "allocations",
    args: address ? [BigInt(saleId), address] : undefined,
    query: { enabled: !!address && sale?.status === 2 },
  });

  const { data: userClaimable } = useReadContract({
    address: SEALPAD_ADDRESS,
    abi: SEALPAD_ABI,
    functionName: "claimable",
    args: address ? [BigInt(saleId), address] : undefined,
    query: { enabled: !!address && sale?.status === 2 },
  });

  const participantCount = sale?.participantCount ?? 0;
  const participantCalls = useMemo(
    () =>
      Array.from({ length: participantCount }, (_, i) => ({
        address: SEALPAD_ADDRESS,
        abi: SEALPAD_ABI,
        functionName: "getParticipant" as const,
        args: [BigInt(saleId), i] as const,
      })),
    [participantCount, saleId],
  );

  const { data: participantResults } = useReadContracts({
    contracts: participantCalls,
    query: { enabled: participantCount > 0 },
  });

  const participantAddrs = useMemo(
    () =>
      Array.from(
        { length: participantCount },
        (_, i) => participantResults?.[i]?.result as string | undefined,
      ).filter((a): a is string => typeof a === "string"),
    [participantCount, participantResults],
  );

  // Joined identity is a stable string the dependency array can compare on,
  // preventing wagmi from re-keying queries when participantAddrs is a new
  // array reference but the contents are the same.
  const participantsKey = useMemo(
    () => participantAddrs.join(","),
    [participantAddrs],
  );

  const bidPriceCalls = useMemo(
    () =>
      participantAddrs.map((addr) => ({
        address: SEALPAD_ADDRESS,
        abi: SEALPAD_ABI,
        functionName: "userBidPrice" as const,
        args: [BigInt(saleId), addr as `0x${string}`] as const,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saleId, participantsKey],
  );

  const { data: bidPriceResults } = useReadContracts({
    contracts: bidPriceCalls,
    query: { enabled: participantAddrs.length > 0 && sale?.saleType === 1 },
  });

  const depositCalls = useMemo(
    () =>
      participantAddrs.map((addr) => ({
        address: SEALPAD_ADDRESS,
        abi: SEALPAD_ABI,
        functionName: "deposits" as const,
        args: [BigInt(saleId), addr as `0x${string}`] as const,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saleId, participantsKey],
  );

  const { data: depositResults } = useReadContracts({
    contracts: depositCalls,
    query: { enabled: participantAddrs.length > 0 },
  });

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const ensureSepolia = useEnsureSepolia();

  if (!validId || idOutOfRange) {
    const total = nextSaleId !== undefined ? Number(nextSaleId) : null;
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-3">
          <p className="font-mono text-xs tracking-widest text-slate-500 uppercase">
            NOT FOUND
          </p>
          <p className="text-slate-700">
            Sale #{String(id)} doesn&apos;t exist.
          </p>
          {total !== null && total > 0 && (
            <p className="text-sm text-slate-500">
              Currently {total} sale{total === 1 ? "" : "s"} (#0
              {total > 1 ? `–#${total - 1}` : ""}).
            </p>
          )}
          {total === 0 && (
            <p className="text-sm text-slate-500">No sales have been created yet.</p>
          )}
          <Link
            to="/app"
            className="inline-block mt-2 font-mono text-xs tracking-widest text-brand-600 hover:text-brand-700"
          >
            ← BACK TO SALES
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!sale) {
    return <p className="text-slate-500">Loading sale...</p>;
  }

  const decimals = isETH ? 18 : (payTokenDecimals ?? 6);
  const saleTokenDecimals =
    saleTokenDecimalsRaw !== undefined ? Number(saleTokenDecimalsRaw) : 18;
  const saleTokenScale = sale.saleTokenScale ?? 10n ** 18n;
  const tokenLabel = isETH ? "ETH" : (payTokenSymbol ?? "tokens");
  const saleLabel = saleTokenSymbol ?? "SALE";
  const fmtPay = (v: bigint | number) =>
    isETH ? formatEther(BigInt(v)) : formatUnits(BigInt(v), decimals);
  const fmtSale = (v: bigint | number) =>
    formatUnits(BigInt(v), saleTokenDecimals);
  const parsePay = (v: string) =>
    isETH ? parseEther(v) : parseUnits(v, decimals);
  const tryParsePay = (v: string) => {
    const normalized = v.trim();
    if (!normalized) return null;
    try {
      return parsePay(normalized);
    } catch {
      return null;
    }
  };
  const tryParseSaleTokens = (v: string) => {
    const normalized = v.trim();
    if (!normalized) return null;
    try {
      return parseUnits(normalized, saleTokenDecimals);
    } catch {
      return null;
    }
  };

  const isStarted = now >= Number(sale.startTime);
  const isEnded = now >= Number(sale.endTime);
  const currentDeposit = userDeposit ?? 0n;
  const isDutch = sale.saleType === 1;

  const handleDeposit = async () => {
    if (!publicClient || !depositInput) return;
    setError(null);
    try {
      setDepositStep("Checking network...");
      await ensureSepolia();
      const raw = parsePay(depositInput);
      if (!isETH) {
        setDepositStep("Sign approval...");
        const ah = await writeContractAsync({
          address: sale.payToken as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [SEALPAD_ADDRESS, raw],
          chainId: REQUIRED_CHAIN_ID,
        });
        setDepositStep("Confirming approval...");
        await publicClient.waitForTransactionReceipt({ hash: ah });
        toast.success("Token approved");
      }
      setDepositStep("Depositing...");
      const h = await writeContractAsync({
        address: SEALPAD_ADDRESS,
        abi: SEALPAD_ABI,
        functionName: "addDeposit",
        args: [BigInt(saleId), raw],
        chainId: REQUIRED_CHAIN_ID,
        ...(isETH ? { value: raw } : {}),
      });
      setDepositStep("Confirming...");
      await publicClient.waitForTransactionReceipt({ hash: h });
      toast.success("Deposit confirmed!");
      setDepositInput("");
      await refetchDeposit();
    } catch (err) {
      const msg = getErrorMessage(err, "Deposit failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setDepositStep(null);
    }
  };

  const floorPriceFormatted = fmtPay(sale.price);
  const quantityRaw = tryParseSaleTokens(quantityInput);
  const bidPriceRaw = isDutch ? tryParsePay(bidPriceInput) : null;
  const bidPriceInvalid =
    isDutch && bidPriceInput.trim() !== "" && bidPriceRaw === null;
  const bidPriceBelowFloor =
    isDutch && bidPriceRaw !== null && bidPriceRaw < sale.price;
  const quantityInvalid = quantityInput.trim() !== "" && quantityRaw === null;
  const quantityIsPositive = quantityRaw !== null && quantityRaw > 0n;
  const effectivePriceRaw = isDutch ? bidPriceRaw : sale.price;
  const computedCostRaw =
    quantityRaw !== null && effectivePriceRaw !== null && effectivePriceRaw > 0n
      ? (quantityRaw * effectivePriceRaw) / saleTokenScale
      : null;
  const computedCost = computedCostRaw !== null ? fmtPay(computedCostRaw) : "";
  const costExceedsDeposit =
    computedCostRaw !== null && computedCostRaw > currentDeposit;
  const contributionDisabled =
    !!bidStep ||
    !quantityIsPositive ||
    quantityInvalid ||
    computedCostRaw === null ||
    computedCostRaw === 0n ||
    costExceedsDeposit ||
    currentDeposit === 0n ||
    (isDutch && (bidPriceRaw === null || bidPriceBelowFloor));

  const handleContribute = async () => {
    if (
      !publicClient ||
      !address ||
      computedCostRaw === null ||
      computedCostRaw === 0n ||
      !quantityIsPositive
    )
      return;
    setError(null);
    try {
      setBidStep("Checking network...");
      await ensureSepolia();
      setBidStep("Encrypting with FHE...");

      if (computedCostRaw > currentDeposit) {
        throw new Error("Cost exceeds your deposit");
      }
      if (isDutch && bidPriceRaw === null) {
        throw new Error("Invalid bid price");
      }

      const { encryptBidAmount } = await import("@/lib/fhevm");
      const encrypted = await encryptBidAmount(address, computedCostRaw);

      if (isDutch) {
        const resolvedBidPrice = bidPriceRaw;
        if (resolvedBidPrice === null) {
          throw new Error("Invalid bid price");
        }
        setBidStep("Sign bid...");
        const h = await writeContractAsync({
          address: SEALPAD_ADDRESS,
          abi: SEALPAD_ABI,
          functionName: "bid",
          args: [
            BigInt(saleId),
            resolvedBidPrice,
            encrypted.handle,
            encrypted.inputProof,
            [],
          ],
          chainId: REQUIRED_CHAIN_ID,
        });
        setBidStep("Confirming...");
        await publicClient.waitForTransactionReceipt({ hash: h });
        toast.success("Bid submitted!");
      } else {
        setBidStep("Sign contribution...");
        const h = await writeContractAsync({
          address: SEALPAD_ADDRESS,
          abi: SEALPAD_ABI,
          functionName: "contribute",
          args: [BigInt(saleId), encrypted.handle, encrypted.inputProof, []],
          chainId: REQUIRED_CHAIN_ID,
        });
        setBidStep("Confirming...");
        await publicClient.waitForTransactionReceipt({ hash: h });
        toast.success("Contribution submitted!");
      }
      await refetch();
    } catch (err) {
      const msg = getErrorMessage(err, "Bid failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setBidStep(null);
    }
  };

  const handleFinalize = async () => {
    if (!publicClient) return;
    setError(null);
    try {
      setFinalizeStep("Checking network...");
      await ensureSepolia();
      setFinalizeStep("Sign finalize...");
      const h = await writeContractAsync({
        address: SEALPAD_ADDRESS,
        abi: SEALPAD_ABI,
        functionName: "finalize",
        args: [BigInt(saleId)],
        chainId: REQUIRED_CHAIN_ID,
      });
      setFinalizeStep("Requesting FHE decryption...");
      await publicClient.waitForTransactionReceipt({ hash: h });
      toast.success("Sale finalized — awaiting decryption");
      await refetch();
    } catch (err) {
      const msg = getErrorMessage(err, "Finalize failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setFinalizeStep(null);
    }
  };

  const handleSettle = async () => {
    if (!publicClient) return;
    setError(null);
    try {
      setSettleStep("Checking network...");
      await ensureSepolia();
      setSettleStep("Reading encrypted handles...");

      // Build the handle list in the exact order the contract expects.
      // FixedPrice: [totalContributedHandle, contrib_user0, contrib_user1, ...]
      // Dutch:      [bidAmount_user0, bidAmount_user1, ...]
      // All handle reads are parallelizable — they're independent view calls.
      let handles: `0x${string}`[];

      if (sale.saleType === 0) {
        const reads = await Promise.all([
          publicClient.readContract({
            address: SEALPAD_ADDRESS,
            abi: SEALPAD_ABI,
            functionName: "getTotalContributedHandle",
            args: [BigInt(saleId)],
          }),
          ...participantAddrs.map((addr) =>
            publicClient.readContract({
              address: SEALPAD_ADDRESS,
              abi: SEALPAD_ABI,
              functionName: "getContributionHandle",
              args: [BigInt(saleId), addr as `0x${string}`],
            }),
          ),
        ]);
        handles = reads as `0x${string}`[];
      } else {
        const reads = await Promise.all(
          participantAddrs.map((addr) =>
            publicClient.readContract({
              address: SEALPAD_ADDRESS,
              abi: SEALPAD_ABI,
              functionName: "getBidAmountHandle",
              args: [BigInt(saleId), addr as `0x${string}`],
            }),
          ),
        );
        handles = reads as `0x${string}`[];
      }

      setSettleStep("Requesting KMS public decryption...");
      const { publicDecryptHandles } = await import("@/lib/fhevm");
      const { values, proof } = await publicDecryptHandles(handles);

      setSettleStep("Sign settlement...");
      const h = await writeContractAsync({
        address: SEALPAD_ADDRESS,
        abi: SEALPAD_ABI,
        functionName: sale.saleType === 0 ? "settleFixed" : "settleDutch",
        args: [BigInt(saleId), values, proof],
        chainId: REQUIRED_CHAIN_ID,
      });
      setSettleStep("Confirming...");
      await publicClient.waitForTransactionReceipt({ hash: h });
      toast.success("Sale settled!");
      await refetch();
    } catch (err) {
      const msg = getErrorMessage(err, "Settle failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setSettleStep(null);
    }
  };

  const handleClaim = async () => {
    if (!publicClient) return;
    setError(null);
    try {
      setClaimStep("Checking network...");
      await ensureSepolia();
      setClaimStep("Sign claim...");
      const h = await writeContractAsync({
        address: SEALPAD_ADDRESS,
        abi: SEALPAD_ABI,
        functionName: "claim",
        args: [BigInt(saleId)],
        chainId: REQUIRED_CHAIN_ID,
      });
      setClaimStep("Confirming...");
      await publicClient.waitForTransactionReceipt({ hash: h });
      toast.success("Tokens claimed!");
      await refetch();
    } catch (err) {
      const msg = getErrorMessage(err, "Claim failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setClaimStep(null);
    }
  };

  const handleWithdraw = async () => {
    if (!publicClient) return;
    setError(null);
    try {
      setWithdrawStep("Checking network...");
      await ensureSepolia();
      setWithdrawStep("Sign withdrawal...");
      const h = await writeContractAsync({
        address: SEALPAD_ADDRESS,
        abi: SEALPAD_ABI,
        functionName: "withdrawDeposit",
        args: [BigInt(saleId)],
        chainId: REQUIRED_CHAIN_ID,
      });
      setWithdrawStep("Confirming...");
      await publicClient.waitForTransactionReceipt({ hash: h });
      toast.success("Deposit withdrawn!");
      await refetchDeposit();
    } catch (err) {
      const msg = getErrorMessage(err, "Withdrawal failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setWithdrawStep(null);
    }
  };

  const statusVariant: "default" | "secondary" | "destructive" =
    sale.status === 2
      ? "default"
      : sale.status === 0
        ? "secondary"
        : "destructive";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-brand-600 mb-1">
            CONFIDENTIAL SALE
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Sale #{saleId}
          </h1>
        </div>
        <Badge
          variant={statusVariant}
          className="font-mono text-[10px] tracking-widest uppercase"
        >
          {SaleStatusLabel[sale.status]}
        </Badge>
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Detail label="Type" value={SaleTypeLabel[sale.saleType]} />
            <Detail
              label="Sale Token"
              value={
                <span className="inline-flex items-center gap-2">
                  {saleLabel}
                  <CopyAddress address={sale.saleToken} />
                </span>
              }
            />
            <Detail
              label="Total Supply"
              value={
                <span className="font-mono">
                  {fmtSale(sale.saleAmount)} {saleLabel}
                </span>
              }
            />
            <Detail label="Payment" value={tokenLabel} />
            <Detail
              label={isDutch ? "Floor Price" : "Price"}
              value={
                <span className="font-mono">
                  {fmtPay(sale.price)} {tokenLabel}
                </span>
              }
            />
            <Detail
              label="Soft / Hard Cap"
              value={
                <span className="font-mono">
                  {fmtPay(sale.softCap)} / {fmtPay(sale.hardCap)} {tokenLabel}
                </span>
              }
            />
            <Detail
              label="Deadline"
              value={new Date(Number(sale.endTime) * 1000).toLocaleString()}
            />
            <Detail
              label="Participants"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {sale.participantCount}
                  <Lock size={12} weight="fill" className="text-brand-500" />
                </span>
              }
            />
          </div>

          {(Number(sale.cliffDuration) > 0 ||
            Number(sale.vestingDuration) > 0) && (
            <div className="border-t border-slate-100 pt-3">
              <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase mb-1">
                Vesting
              </p>
              <p className="font-medium text-slate-900">
                {Number(sale.cliffDuration) > 0
                  ? `${Number(sale.cliffDuration) / 86400}d cliff`
                  : "No cliff"}
                {" + "}
                {Number(sale.vestingDuration) > 0
                  ? `${Number(sale.vestingDuration) / 86400}d linear`
                  : "instant"}
              </p>
            </div>
          )}

          {isDutch && (
            <div className="border-t border-slate-100 pt-3">
              <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase mb-1">
                Dutch Auction
              </p>
              <p className="text-slate-700">
                Users bid at their own price (min{" "}
                <span className="font-mono">
                  {fmtPay(sale.price)} {tokenLabel}
                </span>
                ). Clearing price is determined by demand. Everyone above
                clearing pays the same uniform price.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {participantCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Participants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: participantCount }, (_, i) => {
                const addr = participantResults?.[i]?.result as
                  | string
                  | undefined;
                if (!addr) return null;
                const isMe =
                  address && addr.toLowerCase() === address.toLowerCase();
                const pIdx = participantAddrs.indexOf(addr);
                const pBidPrice =
                  isDutch && pIdx >= 0
                    ? (bidPriceResults?.[pIdx]?.result as bigint | undefined)
                    : undefined;
                const pDeposit =
                  pIdx >= 0
                    ? (depositResults?.[pIdx]?.result as bigint | undefined)
                    : undefined;
                const depositDisplay =
                  pDeposit !== undefined
                    ? fmtPay(pDeposit) + " " + tokenLabel
                    : "...";
                const statusLabel =
                  sale.status >= 2 ? "Remaining:" : "Deposit:";

                return (
                  <div
                    key={i}
                    className={`flex flex-col gap-2 rounded-md border p-3 text-sm ${
                      isMe
                        ? "border-brand-300 bg-brand-50/40"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 font-mono text-xs">
                          #{i + 1}
                        </span>
                        {isMe ? (
                          <Badge className="bg-brand-100 text-brand-700 border-brand-200 hover:bg-brand-100">
                            You
                          </Badge>
                        ) : (
                          <CopyAddress address={addr} />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          {statusLabel}
                        </span>
                        <span className="font-mono text-xs text-slate-900">
                          {depositDisplay}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      {isDutch && pBidPrice !== undefined ? (
                        <>
                          <span className="text-xs text-slate-500">
                            Bid Price:
                          </span>
                          <span className="font-mono text-xs text-slate-900">
                            {fmtPay(pBidPrice)} {tokenLabel}/token
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-slate-500">
                            Contribution:
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono tracking-widest uppercase border-brand-200 text-brand-700 bg-brand-50/40 inline-flex items-center gap-1"
                          >
                            <Lock size={10} weight="fill" />
                            <ScrambleText
                              text="ENCRYPTED"
                              mode="live"
                              speed={180}
                            />
                          </Badge>
                        </>
                      )}
                    </div>
                    {isDutch && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Amount:</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono tracking-widest uppercase border-brand-200 text-brand-700 bg-brand-50/40 inline-flex items-center gap-1"
                        >
                          <Lock size={10} weight="fill" />
                          <ScrambleText
                            text="ENCRYPTED"
                            mode="live"
                            speed={200}
                          />
                        </Badge>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {sale.status === 0 && isStarted && !isEnded && isConnected && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Step 1 · Deposit Collateral</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
                <span className="text-slate-500">Your deposit</span>
                <span className="font-mono font-bold text-slate-900">
                  {fmtPay(currentDeposit)} {tokenLabel}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Add Deposit ({tokenLabel})</Label>
                  <span className="text-xs text-slate-500 font-mono">
                    Balance:{" "}
                    {isETH
                      ? ethBalance
                        ? `${Number(formatEther(ethBalance.value)).toFixed(6)} ETH`
                        : "..."
                      : "..."}
                  </span>
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Amount to add"
                  value={depositInput}
                  onChange={(e) => setDepositInput(e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Deposit is <strong>public</strong> — sets the upper bound of
                  your contribution.
                </p>
              </div>
              <button
                onClick={handleDeposit}
                disabled={
                  !!depositStep || !depositInput || Number(depositInput) <= 0
                }
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded font-semibold transition-colors"
              >
                {depositStep || "Add Deposit"}
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {isDutch
                  ? hasJoined
                    ? "Step 2 · Update Bid"
                    : "Step 2 · Place Bid"
                  : hasJoined
                    ? "Step 2 · Update Contribution"
                    : "Step 2 · Contribute"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isDutch && (
                <div className="space-y-2">
                  <Label>Your Bid Price ({tokenLabel} per token)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder={`Min ${floorPriceFormatted} ${tokenLabel}`}
                    value={bidPriceInput}
                    onChange={(e) => setBidPriceInput(e.target.value)}
                    className={
                      bidPriceBelowFloor || bidPriceInvalid
                        ? "border-rose-400"
                        : ""
                    }
                  />
                  {bidPriceInvalid && (
                    <p className="text-xs text-rose-600">
                      Enter a valid bid price.
                    </p>
                  )}
                  {bidPriceBelowFloor && (
                    <p className="text-xs text-rose-600">
                      Bid price must be at least {floorPriceFormatted}{" "}
                      {tokenLabel} (floor price).
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    <strong>Public</strong> — your chosen price per token.
                    Floor: {floorPriceFormatted} {tokenLabel}.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Token Quantity ({saleLabel})</Label>
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
                      {computedCost} {tokenLabel}
                    </span>
                  </div>
                )}
                {costExceedsDeposit && (
                  <p className="text-xs text-rose-600">
                    Cost exceeds your deposit ({fmtPay(currentDeposit)}{" "}
                    {tokenLabel}). Add more deposit first.
                  </p>
                )}
                <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
                  <Lock size={10} weight="fill" className="text-brand-500" />
                  <span>
                    <strong>FHE-encrypted</strong> — nobody can see how many
                    tokens you're buying.
                    {isDutch &&
                      " Everyone above clearing pays the uniform price."}
                  </span>
                </p>
              </div>
              <button
                onClick={handleContribute}
                disabled={contributionDisabled}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded font-semibold transition-colors"
              >
                {bidStep ||
                  (hasJoined ? "Update (no transfer)" : "Encrypt & Submit")}
              </button>
            </CardContent>
          </Card>
        </>
      )}

      {sale.status === 0 && isEnded && (
        <Card>
          <CardContent className="py-6 text-center space-y-4">
            <p className="text-slate-600">
              Sale has ended. Ready for finalization.
            </p>
            <button
              onClick={handleFinalize}
              disabled={!!finalizeStep}
              className="bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white px-8 py-3 rounded font-semibold transition-colors"
            >
              {finalizeStep || "Finalize Sale"}
            </button>
          </CardContent>
        </Card>
      )}

      {sale.status === 1 && (
        <Card>
          <CardContent className="py-6 text-center space-y-4">
            <Lock
              size={28}
              weight="duotone"
              className="mx-auto text-brand-500"
            />
            <p className="text-slate-700">
              FHE handles published for KMS public decryption.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Anyone can now finish the sale by fetching the decrypted values
              from the relayer and submitting them on-chain with the KMS proof.
            </p>
            <button
              onClick={handleSettle}
              disabled={!!settleStep}
              className="bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded font-semibold transition-colors"
            >
              {settleStep || "Settle Sale"}
            </button>
          </CardContent>
        </Card>
      )}

      {sale.status === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-brand-50 border border-brand-100 p-4">
              <p className="text-sm font-semibold text-brand-800">
                Clearing Price:{" "}
                <span className="font-mono">
                  {fmtPay(sale.clearingPrice)} {tokenLabel}
                </span>
              </p>
              <p className="text-sm text-brand-700 mt-1">
                Total Raised:{" "}
                <span className="font-mono">
                  {fmtPay(sale.totalRaised)} {tokenLabel}
                </span>
              </p>
            </div>

            {isConnected &&
              userAllocation !== undefined &&
              userAllocation > 0n && (
                <div className="space-y-3">
                  <div className="rounded border border-slate-200 p-3 text-sm">
                    <p className="text-slate-500">Your Allocation</p>
                    <p className="font-mono font-bold text-lg text-slate-900 mt-1">
                      {fmtSale(userAllocation)} {saleLabel}
                    </p>
                  </div>
                  {userClaimable !== undefined && userClaimable > 0n && (
                    <button
                      onClick={handleClaim}
                      disabled={!!claimStep}
                      className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white py-3 rounded font-semibold transition-colors"
                    >
                      {claimStep ||
                        `Claim ${fmtSale(userClaimable)} ${saleLabel}`}
                    </button>
                  )}
                </div>
              )}

            {isConnected && BigInt(currentDeposit) > 0n && (
              <button
                onClick={handleWithdraw}
                disabled={!!withdrawStep}
                className="w-full border border-slate-300 hover:border-slate-400 text-slate-700 py-2.5 rounded text-sm transition-colors"
              >
                {withdrawStep ||
                  `Withdraw Remaining Deposit (${fmtPay(currentDeposit)} ${tokenLabel})`}
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {(sale.status === 3 || sale.status === 4) && isConnected && (
        <Card>
          <CardContent className="py-6 text-center space-y-4">
            <p className="text-slate-600">
              {sale.status === 3
                ? "Sale failed (soft cap not reached)."
                : "Sale was cancelled."}
            </p>
            {BigInt(currentDeposit) > 0n && (
              <button
                onClick={handleWithdraw}
                disabled={!!withdrawStep}
                className="border border-slate-300 hover:border-slate-400 text-slate-700 px-6 py-2.5 rounded text-sm transition-colors"
              >
                {withdrawStep || "Withdraw Deposit"}
              </button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
        {label}
      </p>
      <p className="font-medium text-slate-900 mt-1">{value}</p>
    </div>
  );
}
