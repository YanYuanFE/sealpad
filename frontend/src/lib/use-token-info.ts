import { useReadContracts } from "wagmi";
import { isAddress } from "viem";

const ERC20_INFO_ABI = [
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
] as const;

export type TokenInfo =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; symbol: string; decimals: number };

/// Read ERC-20 symbol() + decimals() for an arbitrary input string.
///
/// - `idle`    - no input, or input isn't a valid address yet
/// - `loading` - RPC in flight
/// - `error`   - either call reverted; treat as "not a real ERC-20"
/// - `success` - both calls returned; symbol + decimals are usable
///
/// Both reads share a queryKey with wagmi, so calling this hook from
/// multiple components for the same address only triggers one RPC.
export function useTokenInfo(address: string): TokenInfo {
  const valid = address.length > 0 && isAddress(address);
  const addr = valid ? (address as `0x${string}`) : undefined;

  const { data, isLoading, isError } = useReadContracts({
    contracts: addr
      ? [
          { address: addr, abi: ERC20_INFO_ABI, functionName: "symbol" },
          { address: addr, abi: ERC20_INFO_ABI, functionName: "decimals" },
        ]
      : [],
    query: { enabled: valid, retry: 0 },
  });

  if (!valid) return { status: "idle" };
  if (isLoading) return { status: "loading" };
  if (isError) return { status: "error" };

  const sym = data?.[0];
  const dec = data?.[1];
  if (!sym || !dec) return { status: "loading" };

  if (sym.status !== "success" || dec.status !== "success") {
    return { status: "error" };
  }

  return {
    status: "success",
    symbol: sym.result as string,
    decimals: Number(dec.result),
  };
}
