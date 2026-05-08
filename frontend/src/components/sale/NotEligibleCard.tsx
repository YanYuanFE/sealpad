import { XCircle } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  userAddress: `0x${string}` | undefined;
};

export function NotEligibleCard({ userAddress }: Props) {
  const short = userAddress
    ? `${userAddress.slice(0, 6)}…${userAddress.slice(-4)}`
    : "your wallet";
  return (
    <Card className="border-rose-200 bg-rose-50/40">
      <CardContent className="py-8">
        <div className="flex items-start gap-3">
          <XCircle
            size={20}
            weight="fill"
            className="text-rose-600 mt-0.5 shrink-0"
          />
          <div className="space-y-2">
            <p className="font-mono text-xs tracking-widest text-rose-700">
              NOT ELIGIBLE
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              {short} is not on this sale&apos;s whitelist.
            </h2>
            <p className="text-sm text-slate-600">
              This sale is restricted to addresses pre-approved by the
              creator. Switch to a whitelisted wallet, or contact the creator
              to be added.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
