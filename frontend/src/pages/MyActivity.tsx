import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SEALPAD_FACTORY_ABI,
  SEALPAD_FACTORY_ADDRESS,
  SALE_VAULT_ABI,
} from "@/config/contracts";
import {
  SaleTypeLabel,
  SaleStatusLabel,
  shortenAddress,
} from "@/lib/constants";

type SaleSummary = {
  saleType: number;
  status: number;
  participantCount: number;
};

export function MyActivity() {
  const { address, isConnected } = useAccount();

  // Two cheap factory views replace the old "scan every sale" approach.
  const { data: createdAddrsRaw } = useReadContract({
    address: SEALPAD_FACTORY_ADDRESS,
    abi: SEALPAD_FACTORY_ABI,
    functionName: "salesByCreator",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 30000 },
  });
  const { data: participatedAddrsRaw } = useReadContract({
    address: SEALPAD_FACTORY_ADDRESS,
    abi: SEALPAD_FACTORY_ABI,
    functionName: "salesByParticipant",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 30000 },
  });

  const myCreated = useMemo(
    () =>
      createdAddrsRaw
        ? (createdAddrsRaw as readonly string[]).map((a) => a)
        : [],
    [createdAddrsRaw],
  );
  const myParticipated = useMemo(
    () =>
      participatedAddrsRaw
        ? (participatedAddrsRaw as readonly string[]).map((a) => a)
        : [],
    [participatedAddrsRaw],
  );

  const allAddrs = useMemo(() => {
    const set = new Set([...myCreated, ...myParticipated]);
    return Array.from(set);
  }, [myCreated, myParticipated]);

  const summaryCalls = useMemo(
    () =>
      allAddrs.map((addr) => ({
        address: addr as `0x${string}`,
        abi: SALE_VAULT_ABI,
        functionName: "getSale" as const,
      })),
    [allAddrs],
  );

  const { data: summaryResults } = useReadContracts({
    contracts: summaryCalls,
    query: { enabled: summaryCalls.length > 0 },
  });

  const summaryByAddr = useMemo(() => {
    const map = new Map<string, SaleSummary>();
    allAddrs.forEach((addr, i) => {
      const r = summaryResults?.[i]?.result as unknown as
        | SaleSummary
        | undefined;
      if (r) map.set(addr, r);
    });
    return map;
  }, [allAddrs, summaryResults]);

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-slate-500">
          Connect your wallet to see your activity.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="font-mono text-xs tracking-widest text-brand-600 mb-2">
          PERSONAL DASHBOARD
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          My Activity
        </h1>
      </div>

      {myCreated.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">As Creator</h2>
          <div className="grid gap-3">
            {myCreated.map((addr) => (
              <ActivityRow
                key={`c-${addr}`}
                vaultAddress={addr}
                summary={summaryByAddr.get(addr)}
              />
            ))}
          </div>
        </div>
      )}

      {myParticipated.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">As Investor</h2>
          <div className="grid gap-3">
            {myParticipated.map((addr) => (
              <ActivityRow
                key={`p-${addr}`}
                vaultAddress={addr}
                summary={summaryByAddr.get(addr)}
                tag="Participated"
              />
            ))}
          </div>
        </div>
      )}

      {myCreated.length === 0 && myParticipated.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            No activity yet. Browse sales or create one.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ActivityRow({
  vaultAddress,
  summary,
  tag,
}: {
  vaultAddress: string;
  summary?: SaleSummary;
  tag?: string;
}) {
  return (
    <Link to={`/app/sale/${vaultAddress}`}>
      <Card className="transition-colors hover:border-brand-300">
        <CardContent className="flex items-center justify-between py-4 flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold text-slate-900 inline-flex items-center gap-2">
              Sale
              <span className="font-mono text-xs text-slate-500">
                {shortenAddress(vaultAddress)}
              </span>
            </span>
            {summary && (
              <span className="text-sm text-slate-500">
                {SaleTypeLabel[summary.saleType]}
              </span>
            )}
            {tag ? (
              <Badge className="bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-50">
                {tag}
              </Badge>
            ) : (
              summary && (
                <span className="text-sm text-slate-500">
                  {summary.participantCount} participants
                </span>
              )
            )}
          </div>
          {summary && (
            <Badge
              variant={summary.status === 2 ? "default" : "secondary"}
              className="font-mono text-[10px] tracking-widest uppercase"
            >
              {SaleStatusLabel[summary.status]}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
