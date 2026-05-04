import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { Warning, ArrowsClockwise } from "@phosphor-icons/react";
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_LABEL } from "@/lib/network";

/**
 * Renders a red warning banner when a connected wallet sits on a chain
 * other than Sepolia. Includes a one-click switch button. Hides itself
 * when the wallet is disconnected or already on the correct chain.
 */
export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [err, setErr] = useState<string | null>(null);

  if (!isConnected) return null;
  if (chainId === REQUIRED_CHAIN_ID) return null;

  const handleSwitch = async () => {
    setErr(null);
    try {
      await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Switch failed");
    }
  };

  return (
    <div className="mb-6 border border-rose-300 bg-rose-50 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Warning
          size={22}
          weight="fill"
          className="text-rose-600 shrink-0 mt-0.5"
        />
        <div>
          <p className="font-semibold text-rose-900 text-sm">Wrong network</p>
          <p className="text-xs text-rose-700 font-mono mt-1">
            SealPad lives on {REQUIRED_CHAIN_LABEL} (chain {REQUIRED_CHAIN_ID})
            only. Your wallet is on chain {chainId ?? "?"}. Sending a
            transaction now would broadcast to the wrong network.
          </p>
          {err && <p className="text-xs text-rose-700 mt-1 font-mono">{err}</p>}
        </div>
      </div>
      <button
        onClick={handleSwitch}
        disabled={isPending}
        className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white px-4 py-2 rounded font-mono text-xs tracking-widest uppercase whitespace-nowrap transition-colors"
      >
        <ArrowsClockwise size={14} weight="bold" />
        {isPending ? "Switching..." : `Switch to ${REQUIRED_CHAIN_LABEL}`}
      </button>
    </div>
  );
}
