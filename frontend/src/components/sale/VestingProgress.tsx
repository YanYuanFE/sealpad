import { useLiveVesting } from "@/lib/use-live-vesting";
import type { SaleFormatters } from "@/lib/sale-formatters";

type Props = {
  vaultAddress: `0x${string}`;
  settledAt: bigint;
  cliffDuration: bigint;
  vestingDuration: bigint;
  allocation: bigint;
  fmt: SaleFormatters;
};

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

/// Horizontal vesting progress bar. Three states stacked left-to-right:
/// brand-500 (claimed) · brand-200 (vested, not yet claimed) · slate-100
/// (still vesting). A 1px obsidian "now" marker advances each second, so
/// the user can see release accruing in real time. A second light marker
/// shows the cliff end if cliffDuration > 0.
///
/// Mirrors the contract's `_vestedAmount` math exactly so what you see is
/// what `claim()` will pay out at this block.
export function VestingProgress({
  vaultAddress,
  settledAt,
  cliffDuration,
  vestingDuration,
  allocation,
  fmt,
}: Props) {
  const { now, claimed, vested } = useLiveVesting({
    vaultAddress,
    settledAt,
    cliffDuration,
    vestingDuration,
    allocation,
  });

  // Instant claim — no vesting bar needed.
  if (cliffDuration === 0n && vestingDuration === 0n) return null;

  const settled = Number(settledAt);
  const cliff = Number(cliffDuration);
  const vest = Number(vestingDuration);
  const cliffEnd = settled + cliff;
  const vestEnd = cliffEnd + vest;
  const total = cliff + vest;

  const claimedPct =
    allocation > 0n ? Number((claimed * 10000n) / allocation) / 100 : 0;
  const vestedPct =
    allocation > 0n ? Number((vested * 10000n) / allocation) / 100 : 0;
  const nowPct =
    total > 0 ? Math.min(100, Math.max(0, ((now - settled) / total) * 100)) : 0;
  const cliffPct = total > 0 ? (cliff / total) * 100 : 0;

  const inCliff = cliff > 0 && now < cliffEnd;
  const headerLabel =
    cliff > 0
      ? `Cliff ${formatDuration(cliff)} + ${formatDuration(vest)} linear`
      : `${formatDuration(vest)} linear`;
  const remainingLabel = (() => {
    if (now >= vestEnd) return "Fully vested";
    if (inCliff) return `Cliff ends in ${formatDuration(cliffEnd - now)}`;
    return `${formatDuration(vestEnd - now)} remaining`;
  })();

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.18em] text-slate-500 uppercase">
          {headerLabel}
        </span>
        <span
          className={`font-mono text-[10px] ${
            inCliff ? "text-slate-700" : "text-slate-500"
          }`}
        >
          {remainingLabel}
        </span>
      </div>

      <div className="relative h-2 bg-slate-100">
        {cliff > 0 && (
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${cliffPct}%`,
              backgroundImage:
                "repeating-linear-gradient(135deg, rgb(203 213 225) 0 2px, transparent 2px 5px)",
            }}
            aria-hidden="true"
          />
        )}
        <div
          className="absolute inset-y-0 left-0 bg-brand-500"
          style={{ width: `${claimedPct}%` }}
        />
        <div
          className="absolute inset-y-0 bg-brand-200"
          style={{
            left: `${claimedPct}%`,
            width: `${Math.max(0, vestedPct - claimedPct)}%`,
          }}
        />
        {cliff > 0 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-slate-700"
            style={{ left: `${cliffPct}%` }}
            title="Cliff end"
          />
        )}
        <div
          className="absolute -top-1 -bottom-1 w-px bg-slate-900"
          style={{ left: `${nowPct}%` }}
          title="Now"
        />
      </div>

      {cliff > 0 && (
        <div className="relative h-3 -mt-1.5">
          <span
            className="absolute -translate-x-1/2 font-mono text-[9px] tracking-[0.18em] text-slate-500 uppercase"
            style={{ left: `${cliffPct}%` }}
          >
            cliff
          </span>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 font-mono text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 bg-brand-500 inline-block" />
          Claimed {fmt.fmtSale(claimed)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 bg-brand-200 inline-block" />
          Vested {fmt.fmtSale(vested)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 bg-slate-100 inline-block border border-slate-200" />
          Total {fmt.fmtSale(allocation)}
        </span>
      </div>
    </div>
  );
}
