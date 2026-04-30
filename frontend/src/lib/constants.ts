export const SaleTypeLabel = ["Fixed Price", "Dutch Auction"];
export const SaleStatusLabel = ["Active", "Finalizing", "Settled", "Failed", "Cancelled"];

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

export function getErrorMessage(err: unknown, prefix?: string): string {
  let msg = "Unknown error";
  if (err instanceof Error) {
    msg = err.message;
    // Extract revert reason from common patterns
    const revertMatch = msg.match(/reason="([^"]+)"/);
    if (revertMatch) msg = revertMatch[1];
    const customMatch = msg.match(/reverted with custom error '([^']+)'/);
    if (customMatch) msg = customMatch[1];
  } else if (typeof err === "string") {
    msg = err;
  }
  // Truncate long messages
  if (msg.length > 200) msg = msg.slice(0, 200) + "...";
  return prefix ? `${prefix}: ${msg}` : msg;
}
