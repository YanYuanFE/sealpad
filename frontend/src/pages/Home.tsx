import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useReadContract, useReadContracts } from "wagmi";
import { erc20Abi, formatEther, formatUnits } from "viem";
import { Plus, Lock } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEALPAD_ADDRESS, SEALPAD_ABI } from "@/config/contracts";
import {
  SaleTypeLabel,
  SaleStatusLabel,
  isETHPayToken,
  formatDuration,
} from "@/lib/constants";

const StatusVariant = [
  "secondary",
  "default",
  "default",
  "destructive",
  "secondary",
] as const;

type SaleData = {
  creator: string;
  saleToken: string;
  saleAmount: bigint;
  payToken: string;
  saleType: number;
  price: bigint;
  softCap: bigint;
  hardCap: bigint;
  maxPerUser: bigint;
  startTime: bigint;
  endTime: bigint;
  whitelistRoot: string;
  cliffDuration: bigint;
  vestingDuration: bigint;
  status: number;
  participantCount: number;
  clearingPrice: bigint;
  totalRaised: bigint;
  settledAt: bigint;
  saleTokenScale: bigint;
};

function SaleCard({
  id,
  sale,
  payTokenDecimals,
  now,
}: {
  id: number;
  sale: SaleData;
  payTokenDecimals?: number;
  now: number;
}) {
  const start = Number(sale.startTime);
  const end = Number(sale.endTime);
  const isETH = isETHPayToken(sale.payToken);
  const tokenLabel = isETH ? "ETH" : "tokens";
  const decimals = isETH ? 18 : (payTokenDecimals ?? 6);
  const fmtPrice = (raw: bigint | number) =>
    isETH ? formatEther(BigInt(raw)) : formatUnits(BigInt(raw), decimals);

  let timeInfo = "";
  if (sale.status === 0) {
    if (now < start) timeInfo = `Starts in ${formatDuration(start - now)}`;
    else if (now < end) timeInfo = `Ends in ${formatDuration(end - now)}`;
    else timeInfo = "Ended — awaiting finalize";
  }

  return (
    <Link to={`/app/sale/${id}`} className="block group">
      <Card className="transition-all hover:border-brand-300 hover:shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold text-slate-900">
            Sale #{id}
          </CardTitle>
          <Badge
            variant={
              StatusVariant[sale.status] as
                | "default"
                | "secondary"
                | "destructive"
            }
            className="font-mono text-[10px] tracking-widest uppercase"
          >
            {SaleStatusLabel[sale.status]}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
                Type
              </p>
              <p className="font-medium text-slate-900 mt-1">
                {SaleTypeLabel[sale.saleType]}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
                {sale.saleType === 0 ? "Price" : "Floor"}
              </p>
              <p className="font-mono font-medium text-slate-900 mt-1">
                {fmtPrice(sale.price)} {tokenLabel}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
                Hard Cap
              </p>
              <p className="font-mono font-medium text-slate-900 mt-1">
                {fmtPrice(sale.hardCap)} {tokenLabel}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
                Sealed Bids
              </p>
              <p className="font-medium text-slate-900 mt-1 inline-flex items-center gap-1.5">
                {sale.participantCount}
                <Lock size={12} weight="fill" className="text-brand-500" />
              </p>
            </div>
          </div>
          {timeInfo && (
            <p className="mt-3 text-xs text-slate-500 font-mono">{timeInfo}</p>
          )}
          {sale.status === 2 && (
            <p className="mt-3 text-sm text-brand-600 font-medium">
              Cleared at {fmtPrice(sale.clearingPrice)} {tokenLabel} · Raised{" "}
              {fmtPrice(sale.totalRaised)} {tokenLabel}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export function Home() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      30_000,
    );
    return () => window.clearInterval(id);
  }, []);

  const { data: nextId } = useReadContract({
    address: SEALPAD_ADDRESS,
    abi: SEALPAD_ABI,
    functionName: "nextSaleId",
    query: { refetchInterval: 15000 },
  });

  const saleCount = nextId !== undefined ? Number(nextId) : 0;

  const saleCalls = useMemo(
    () =>
      Array.from({ length: saleCount }, (_, i) => ({
        address: SEALPAD_ADDRESS,
        abi: SEALPAD_ABI,
        functionName: "getSale" as const,
        args: [BigInt(i)] as const,
      })),
    [saleCount],
  );

  const { data: saleResults } = useReadContracts({
    contracts: saleCalls,
    query: { enabled: saleCount > 0, refetchInterval: 30000 },
  });

  // Resolve which sales need a payToken.decimals() lookup. Stable string
  // identity ("0|0xabc,1|0xdef,...") lets useMemo bail out when the underlying
  // pay-token addresses haven't actually changed across saleResults refetches.
  const payTokenLookupKey = useMemo(() => {
    if (!saleResults) return "";
    const parts: string[] = [];
    for (let i = 0; i < saleCount; i++) {
      const sale = saleResults[i]?.result as unknown as SaleData | undefined;
      if (!sale || isETHPayToken(sale.payToken)) continue;
      parts.push(`${i}|${sale.payToken.toLowerCase()}`);
    }
    return parts.join(",");
  }, [saleResults, saleCount]);

  const payTokenDecimalCalls = useMemo(() => {
    if (!payTokenLookupKey) return [];
    return payTokenLookupKey.split(",").map((entry) => {
      const [idStr, address] = entry.split("|");
      return { id: Number(idStr), address: address as `0x${string}` };
    });
  }, [payTokenLookupKey]);

  const payTokenDecimalContracts = useMemo(
    () =>
      payTokenDecimalCalls.map(({ address }) => ({
        address,
        abi: erc20Abi,
        functionName: "decimals" as const,
      })),
    [payTokenDecimalCalls],
  );

  const { data: payTokenDecimalResults } = useReadContracts({
    contracts: payTokenDecimalContracts,
    query: {
      enabled: payTokenDecimalContracts.length > 0,
      refetchInterval: 30000,
    },
  });

  const payTokenDecimalsBySaleId = useMemo(() => {
    const map = new Map<number, number>();
    payTokenDecimalCalls.forEach(({ id }, index) => {
      const result = payTokenDecimalResults?.[index]?.result;
      if (typeof result === "number") {
        map.set(id, result);
      } else if (typeof result === "bigint") {
        map.set(id, Number(result));
      }
    });
    return map;
  }, [payTokenDecimalCalls, payTokenDecimalResults]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="font-mono text-xs tracking-widest text-brand-600 mb-2">
            CONFIDENTIAL LAUNCHPAD
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Token Sales
          </h1>
          <p className="text-slate-600 mt-1">
            Encrypted contributions. Fair price discovery. On-chain settlement.
          </p>
        </div>
        <Link
          to="/app/create"
          className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded font-medium transition-colors"
        >
          <Plus size={16} weight="bold" />
          Create Sale
        </Link>
      </div>

      {saleCount === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            <Lock
              size={28}
              weight="duotone"
              className="mx-auto mb-3 text-brand-500"
            />
            <p>No sales yet. Be the first to launch one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {Array.from({ length: saleCount }, (_, i) => saleCount - 1 - i).map(
            (id) => {
              const result = saleResults?.[id];
              if (!result?.result) return null;
              return (
                <SaleCard
                  key={id}
                  id={id}
                  sale={result.result as unknown as SaleData}
                  payTokenDecimals={payTokenDecimalsBySaleId.get(id)}
                  now={now}
                />
              );
            },
          )}
        </div>
      )}
    </div>
  );
}
