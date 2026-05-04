export const SaleTypeLabel = ["Fixed Price", "Dutch Auction"];
export const SaleStatusLabel = [
  "Active",
  "Finalizing",
  "Settled",
  "Failed",
  "Cancelled",
];

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function isETHPayToken(token: string): boolean {
  return token === ZERO_ADDRESS || token === "0x" + "0".repeat(40);
}

export function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "Ended";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Lazy-imported in the function below so this module stays tree-shakeable.
// Duck-typed checks first; viem types provide the cleaner path when available.
import { BaseError, ContractFunctionRevertedError } from "viem";

export function getErrorMessage(err: unknown, prefix?: string): string {
  let msg = "Unknown error";

  if (err instanceof BaseError) {
    // viem v2: walk the cause chain for a contract-level revert. The named
    // custom error (e.g. InsufficientDeposit) lives on data.errorName.
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const errorName = revert.data?.errorName;
      if (errorName) {
        const args = revert.data?.args;
        msg =
          Array.isArray(args) && args.length > 0
            ? `${errorName}(${args.map((a) => String(a)).join(", ")})`
            : errorName;
      } else {
        msg = revert.shortMessage;
      }
    } else {
      msg = err.shortMessage;
    }
  } else if (err instanceof Error) {
    msg = err.message;
    // Legacy ethers shapes — kept for non-viem error sources.
    const revertMatch = msg.match(/reason="([^"]+)"/);
    if (revertMatch) msg = revertMatch[1];
    const customMatch = msg.match(/reverted with custom error '([^']+)'/);
    if (customMatch) msg = customMatch[1];
  } else if (typeof err === "string") {
    msg = err;
  }

  if (msg.length > 200) msg = msg.slice(0, 200) + "...";
  return prefix ? `${prefix}: ${msg}` : msg;
}
