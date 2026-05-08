import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAccount, useReadContract } from "wagmi";
import { isAddress, getAddress } from "viem";
import { Lock } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CopyAddress } from "@/components/CopyAddress";
import {
  SEALPAD_FACTORY_ABI,
  SEALPAD_FACTORY_ADDRESS,
  SALE_VAULT_ABI,
} from "@/config/contracts";
import { SaleTypeLabel, SaleStatusLabel } from "@/lib/constants";
import type { SaleData } from "@/lib/sale-types";
import { useSaleFormatters } from "@/lib/sale-formatters";
import { DepositPanel } from "@/components/sale/DepositPanel";
import { ContributePanel } from "@/components/sale/ContributePanel";
import { FinalizeBanner } from "@/components/sale/FinalizeBanner";
import { NotEligibleCard } from "@/components/sale/NotEligibleCard";
import { NotStartedBanner } from "@/components/sale/NotStartedBanner";
import { SettleBanner } from "@/components/sale/SettleBanner";
import { ClaimPanel } from "@/components/sale/ClaimPanel";
import { WithdrawButton } from "@/components/sale/WithdrawButton";
import { ParticipantsList } from "@/components/sale/ParticipantsList";
import { useParticipantAddresses } from "@/lib/use-participant-addresses";
import { useWhitelistEligibility } from "@/lib/use-whitelist-eligibility";

export function SaleDetail() {
  const { address: vaultParam } = useParams<{ address: string }>();
  // Normalize to checksummed form so wagmi's query key is stable across casings.
  const validVaultAddress = !!vaultParam && isAddress(vaultParam);
  const vaultAddress = (
    validVaultAddress
      ? getAddress(vaultParam!)
      : "0x0000000000000000000000000000000000000000"
  ) as `0x${string}`;
  const { address, isConnected } = useAccount();

  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  // 30s tick keeps the start/end countdown fresh without re-running on every
  // unrelated state change. The component remounts when the URL param changes,
  // so the interval is naturally scoped to the page view.
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Verify the vault address actually came out of the factory before talking
  // to it. A random 0x... that hits getSale would silently return zero state.
  const { data: isKnownVault } = useReadContract({
    address: SEALPAD_FACTORY_ADDRESS,
    abi: SEALPAD_FACTORY_ABI,
    functionName: "isSale",
    args: [vaultAddress],
    query: { enabled: validVaultAddress },
  });

  const idResolvable = validVaultAddress && isKnownVault === true;

  const { data: saleRaw, refetch } = useReadContract({
    address: vaultAddress,
    abi: SALE_VAULT_ABI,
    functionName: "getSale",
    query: { enabled: idResolvable },
  });
  const sale = saleRaw as unknown as SaleData | undefined;

  const { data: userDeposit, refetch: refetchDeposit } = useReadContract({
    address: vaultAddress,
    abi: SALE_VAULT_ABI,
    functionName: "deposits",
    args: address ? [address] : undefined,
    query: { enabled: !!address && idResolvable },
  });

  const { data: hasJoined } = useReadContract({
    address: vaultAddress,
    abi: SALE_VAULT_ABI,
    functionName: "hasParticipated",
    args: address ? [address] : undefined,
    query: { enabled: !!address && idResolvable },
  });

  const { data: userAllocation } = useReadContract({
    address: vaultAddress,
    abi: SALE_VAULT_ABI,
    functionName: "allocations",
    args: address ? [address] : undefined,
    query: { enabled: !!address && sale?.status === 2 },
  });

  const fmt = useSaleFormatters(sale);
  const participantAddrs = useParticipantAddresses(
    vaultAddress,
    sale?.participantCount ?? 0,
  );

  // Whitelist eligibility — when not eligible we hide the Deposit/Contribute
  // panels entirely and show a single NotEligibleCard instead. Hook must run
  // unconditionally; it no-ops when sale isn't whitelisted (root == 0).
  const eligibility = useWhitelistEligibility({
    vaultAddress,
    whitelistRoot:
      sale?.whitelistRoot ??
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    userAddress: address,
  });

  // The settle path needs to read every encrypted handle, then ask the parent
  // to refresh sale state on success. Same pattern for finalize, claim, deposit.
  const handleSettleError = (msg: string) => setError(msg || null);
  const refreshAll = async () => {
    await Promise.all([refetch(), refetchDeposit()]);
  };
  const refreshAfterClaim = async () => {
    await refetch();
  };

  if (!validVaultAddress || isKnownVault === false) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-3">
          <p className="font-mono text-xs tracking-widest text-slate-500 uppercase">
            NOT FOUND
          </p>
          <p className="text-slate-700">
            {validVaultAddress
              ? "This address isn't a SealPad sale."
              : "That URL doesn't look like a sale address."}
          </p>
          {validVaultAddress && (
            <p className="font-mono text-xs text-slate-500 break-all">
              {vaultParam}
            </p>
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

  if (!sale || !fmt) {
    return <p className="text-slate-500">Loading sale...</p>;
  }

  const isStarted = now >= Number(sale.startTime);
  const isEnded = now >= Number(sale.endTime);
  const currentDeposit = userDeposit ?? 0n;
  const isDutch = sale.saleType === 1;

  const blockedByWhitelist = eligibility.status === "not_eligible";

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
            Sale
          </h1>
          <CopyAddress
            address={vaultAddress}
            truncate={false}
            className="mt-1"
          />
        </div>
        <Badge
          variant={statusVariant}
          className="font-mono text-[10px] tracking-widest uppercase"
        >
          {sale.status === 0 && !isStarted
            ? "Pending Start"
            : sale.status === 0 && isEnded
              ? "Ended"
              : SaleStatusLabel[sale.status]}
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
                  {fmt.saleLabel}
                  <CopyAddress address={sale.saleToken} />
                </span>
              }
            />
            <Detail
              label="Total Supply"
              value={
                <span className="font-mono">
                  {fmt.fmtSale(sale.saleAmount)} {fmt.saleLabel}
                </span>
              }
            />
            <Detail label="Payment" value={fmt.tokenLabel} />
            <Detail
              label={isDutch ? "Floor Price" : "Price"}
              value={
                <span className="font-mono">
                  {fmt.fmtPay(sale.price)} {fmt.tokenLabel}
                </span>
              }
            />
            <Detail
              label="Soft / Hard Cap"
              value={
                <span className="font-mono">
                  {fmt.fmtPay(sale.softCap)} / {fmt.fmtPay(sale.hardCap)}{" "}
                  {fmt.tokenLabel}
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
                  {fmt.fmtPay(sale.price)} {fmt.tokenLabel}
                </span>
                ). Clearing price is determined by demand. Everyone above
                clearing pays the same uniform price.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <ParticipantsList vaultAddress={vaultAddress} sale={sale} fmt={fmt} />

      <Separator />

      {sale.status === 0 && !isStarted && (
        <NotStartedBanner startTime={sale.startTime} />
      )}

      {sale.status === 0 &&
        isStarted &&
        !isEnded &&
        isConnected &&
        (blockedByWhitelist ? (
          <NotEligibleCard userAddress={address} />
        ) : (
          <>
            <DepositPanel
              vaultAddress={vaultAddress}
              sale={sale}
              fmt={fmt}
              currentDeposit={currentDeposit}
              onDeposited={refetchDeposit}
              onError={handleSettleError}
            />
            <ContributePanel
              vaultAddress={vaultAddress}
              sale={sale}
              fmt={fmt}
              currentDeposit={currentDeposit}
              hasJoined={!!hasJoined}
              eligibility={eligibility}
              onSubmitted={refreshAll}
              onError={handleSettleError}
            />
          </>
        ))}

      {sale.status === 0 && isEnded && (
        <FinalizeBanner
          vaultAddress={vaultAddress}
          finalizeRequestedAt={sale.finalizeRequestedAt}
          onTransitioned={refetch}
          onError={handleSettleError}
        />
      )}

      {sale.status === 1 && (
        <SettleBanner
          vaultAddress={vaultAddress}
          sale={sale}
          participantAddrs={participantAddrs}
          onSettled={refetch}
          onError={handleSettleError}
        />
      )}

      {sale.status === 2 && (
        <ClaimPanel
          vaultAddress={vaultAddress}
          sale={sale}
          fmt={fmt}
          isConnected={isConnected}
          currentDeposit={currentDeposit}
          userAllocation={userAllocation}
          onClaimed={refreshAfterClaim}
          onWithdrawn={refetchDeposit}
          onError={handleSettleError}
        />
      )}

      {(sale.status === 3 || sale.status === 4) && isConnected && (
        <Card>
          <CardContent className="py-6 text-center space-y-4">
            <p className="text-slate-600">
              {sale.status === 3
                ? "Sale failed (soft cap not reached)."
                : "Sale was cancelled."}
            </p>
            {currentDeposit > 0n && (
              <WithdrawButton
                vaultAddress={vaultAddress}
                label="Withdraw Deposit"
                onWithdrawn={refetchDeposit}
                onError={handleSettleError}
              />
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
