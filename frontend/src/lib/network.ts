import { useAccount, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";

export const REQUIRED_CHAIN = sepolia;
export const REQUIRED_CHAIN_ID = sepolia.id; // 11155111
export const REQUIRED_CHAIN_LABEL = "SEPOLIA";

/**
 * Returns an async guard that forces the wallet onto Sepolia before any
 * write transaction. Call `await ensureSepolia()` at the top of every
 * handler that calls writeContract — if the wallet is on the wrong chain,
 * it triggers a programmatic chain switch (with the wallet's prompt). If
 * the user rejects, it throws a clear error that the handler's catch can
 * surface.
 *
 * Defense-in-depth: also pass `chainId: REQUIRED_CHAIN_ID` to the
 * writeContractAsync call itself — wagmi will refuse to sign anything
 * targeted at any other chain.
 */
export function useEnsureSepolia() {
  const { chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  return async (): Promise<void> => {
    if (!isConnected) {
      throw new Error("Connect your wallet first.");
    }
    if (chainId === REQUIRED_CHAIN_ID) return;
    try {
      await switchChainAsync({ chainId: REQUIRED_CHAIN_ID });
    } catch {
      throw new Error(
        `Wrong network. SealPad is deployed on ${REQUIRED_CHAIN_LABEL} (chain ${REQUIRED_CHAIN_ID}) only. Switch your wallet and try again.`,
      );
    }
  };
}
