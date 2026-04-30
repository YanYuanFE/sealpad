import { Link } from "react-router-dom";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEALPAD_ADDRESS, SEALPAD_ABI } from "@/config/contracts";
import { SaleTypeLabel, SaleStatusLabel } from "@/lib/constants";

export function MyActivity() {
  const { address, isConnected } = useAccount();

  const { data: nextId } = useReadContract({
    address: SEALPAD_ADDRESS,
    abi: SEALPAD_ABI,
    functionName: "nextSaleId",
  });

  const saleCount = nextId !== undefined ? Number(nextId) : 0;

  const saleCalls = Array.from({ length: saleCount }, (_, i) => ({
    address: SEALPAD_ADDRESS,
    abi: SEALPAD_ABI,
    functionName: "getSale" as const,
    args: [BigInt(i)] as const,
  }));

  const { data: saleResults } = useReadContracts({
    contracts: saleCalls,
    query: { enabled: saleCount > 0 },
  });

  const participatedCalls = address
    ? Array.from({ length: saleCount }, (_, i) => ({
        address: SEALPAD_ADDRESS,
        abi: SEALPAD_ABI,
        functionName: "hasParticipated" as const,
        args: [BigInt(i), address] as const,
      }))
    : [];

  const { data: participatedResults } = useReadContracts({
    contracts: participatedCalls,
    query: { enabled: saleCount > 0 && !!address },
  });

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-slate-500">
          Connect your wallet to see your activity.
        </CardContent>
      </Card>
    );
  }

  const myCreated: number[] = [];
  const myParticipated: number[] = [];

  for (let i = 0; i < saleCount; i++) {
    const sale = saleResults?.[i]?.result as { creator?: string } | undefined;
    if (!sale) continue;
    if (sale.creator?.toLowerCase() === address?.toLowerCase()) {
      myCreated.push(i);
    }
    if (participatedResults?.[i]?.result === true) {
      myParticipated.push(i);
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="font-mono text-xs tracking-widest text-brand-600 mb-2">
          PERSONAL DASHBOARD
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Activity</h1>
      </div>

      {myCreated.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">As Creator</h2>
          <div className="grid gap-3">
            {myCreated.map((id) => (
              <ActivityRow key={id} id={id} sale={saleResults![id].result as never} />
            ))}
          </div>
        </div>
      )}

      {myParticipated.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">As Investor</h2>
          <div className="grid gap-3">
            {myParticipated.map((id) => (
              <ActivityRow
                key={id}
                id={id}
                sale={saleResults![id].result as never}
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
  id,
  sale,
  tag,
}: {
  id: number;
  sale: { saleType: number; status: number; participantCount: number };
  tag?: string;
}) {
  return (
    <Link to={`/app/sale/${id}`}>
      <Card className="transition-colors hover:border-brand-300">
        <CardContent className="flex items-center justify-between py-4 flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold text-slate-900">Sale #{id}</span>
            <span className="text-sm text-slate-500">{SaleTypeLabel[sale.saleType]}</span>
            {tag ? (
              <Badge className="bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-50">
                {tag}
              </Badge>
            ) : (
              <span className="text-sm text-slate-500">
                {sale.participantCount} participants
              </span>
            )}
          </div>
          <Badge
            variant={sale.status === 2 ? "default" : "secondary"}
            className="font-mono text-[10px] tracking-widest uppercase"
          >
            {SaleStatusLabel[sale.status]}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}
