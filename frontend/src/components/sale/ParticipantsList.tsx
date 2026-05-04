import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { Lock } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyAddress } from "@/components/CopyAddress";
import { ScrambleText } from "@/components/landing/shared/ScrambleText";
import { SALE_VAULT_ABI } from "@/config/contracts";
import type { SaleData } from "@/lib/sale-types";
import type { SaleFormatters } from "@/lib/sale-formatters";

type Props = {
  vaultAddress: `0x${string}`;
  sale: SaleData;
  fmt: SaleFormatters;
};

export function ParticipantsList({ vaultAddress, sale, fmt }: Props) {
  const { address } = useAccount();
  const isDutch = sale.saleType === 1;
  const participantCount = sale.participantCount ?? 0;

  const participantCalls = useMemo(
    () =>
      Array.from({ length: participantCount }, (_, i) => ({
        address: vaultAddress,
        abi: SALE_VAULT_ABI,
        functionName: "getParticipant" as const,
        args: [i] as const,
      })),
    [participantCount, vaultAddress],
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

  // Stable string for cache-key dependency arrays so the deposit/bid-price
  // queries below don't churn on each parent render.
  const participantsKey = useMemo(
    () => participantAddrs.join(","),
    [participantAddrs],
  );

  const bidPriceCalls = useMemo(
    () =>
      participantAddrs.map((addr) => ({
        address: vaultAddress,
        abi: SALE_VAULT_ABI,
        functionName: "userBidPrice" as const,
        args: [addr as `0x${string}`] as const,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vaultAddress, participantsKey],
  );

  const { data: bidPriceResults } = useReadContracts({
    contracts: bidPriceCalls,
    query: { enabled: participantAddrs.length > 0 && isDutch },
  });

  const depositCalls = useMemo(
    () =>
      participantAddrs.map((addr) => ({
        address: vaultAddress,
        abi: SALE_VAULT_ABI,
        functionName: "deposits" as const,
        args: [addr as `0x${string}`] as const,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vaultAddress, participantsKey],
  );

  const { data: depositResults } = useReadContracts({
    contracts: depositCalls,
    query: { enabled: participantAddrs.length > 0 },
  });

  if (participantCount === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Participants</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Array.from({ length: participantCount }, (_, i) => {
            const addr = participantResults?.[i]?.result as string | undefined;
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
                ? fmt.fmtPay(pDeposit) + " " + fmt.tokenLabel
                : "...";
            const statusLabel = sale.status >= 2 ? "Remaining:" : "Deposit:";

            return (
              <div
                key={i}
                className={`flex flex-col gap-2 rounded-md border p-3 text-sm ${
                  isMe ? "border-brand-300 bg-brand-50/40" : "border-slate-200"
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
                      <span className="text-xs text-slate-500">Bid Price:</span>
                      <span className="font-mono text-xs text-slate-900">
                        {fmt.fmtPay(pBidPrice)} {fmt.tokenLabel}/token
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
                      <ScrambleText text="ENCRYPTED" mode="live" speed={200} />
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
