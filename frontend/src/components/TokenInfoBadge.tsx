import { useTokenInfo } from "@/lib/use-token-info";

type Props = { address: string };

/// Inline status pill shown beneath an ERC-20 address input.
/// Reads symbol() + decimals() and tells the user whether they typed
/// a real token. Mute styling — uses the same slate / rose palette as
/// the rest of the form (no green checkmarks).
export function TokenInfoBadge({ address }: Props) {
  const info = useTokenInfo(address);

  if (info.status === "idle") return null;

  if (info.status === "loading") {
    return (
      <p className="mt-1.5 font-mono text-[10px] tracking-[0.18em] text-slate-400 uppercase animate-pulse">
        Reading token info…
      </p>
    );
  }

  if (info.status === "error") {
    return (
      <p className="mt-1.5 text-xs text-rose-600">
        Not a valid ERC-20 contract on this chain.
      </p>
    );
  }

  return (
    <p className="mt-1.5 text-xs text-slate-600">
      <span className="font-mono font-semibold text-slate-900">
        {info.symbol}
      </span>
    </p>
  );
}
