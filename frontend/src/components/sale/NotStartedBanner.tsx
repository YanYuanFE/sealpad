import { useEffect, useState } from "react";
import { Clock } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  startTime: bigint;
};

/// Pre-start banner. Shows a live countdown to startTime so users land on a
/// not-yet-active sale and immediately understand why the deposit / contribute
/// panels aren't here. Self-contained 1s ticker keeps the seconds digit smooth
/// without relying on the parent's coarser 30s tick.
export function NotStartedBanner({ startTime }: Props) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1_000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Number(startTime) - now;
  if (remaining <= 0) return null;

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const startsAt = new Date(Number(startTime) * 1000).toLocaleString();

  return (
    <Card>
      <CardContent className="py-10 text-center space-y-5">
        <div className="inline-flex items-center gap-2 font-mono text-xs tracking-widest text-brand-600 uppercase">
          <Clock size={12} weight="fill" />
          Sale starts in
        </div>
        <div className="flex items-center justify-center gap-3 md:gap-6">
          <Block label="Days" value={days} />
          <Separator />
          <Block label="Hours" value={hours} />
          <Separator />
          <Block label="Minutes" value={minutes} />
          <Separator />
          <Block label="Seconds" value={seconds} />
        </div>
        <p className="font-mono text-xs text-slate-500">Starts at {startsAt}</p>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          The sale isn&rsquo;t active yet. Deposit + contribute / bid will open
          once the start time is reached.
        </p>
      </CardContent>
    </Card>
  );
}

function Block({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center min-w-[64px]">
      <span className="text-3xl md:text-4xl font-bold text-slate-900 tabular-nums font-mono">
        {value.toString().padStart(2, "0")}
      </span>
      <span className="text-[10px] tracking-widest text-slate-500 uppercase mt-1">
        {label}
      </span>
    </div>
  );
}

function Separator() {
  return (
    <span className="text-3xl md:text-4xl text-slate-300 font-mono">:</span>
  );
}
