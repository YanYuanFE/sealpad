import { useReadContract } from "wagmi";
import {
  erc20Abi,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
} from "viem";
import { isETHPayToken } from "@/lib/constants";
import type { SaleData } from "@/lib/sale-types";

/// Aggregate formatter helpers for one sale. All amounts the UI displays go
/// through fmtPay (pay-token decimals — ETH or ERC-20) or fmtSale (sale-token
/// decimals — read from the saleToken's decimals() at view time). Cost math
/// uses saleTokenScale rather than a hardcoded 1e18 so non-18-decimal sale
/// tokens stay accurate.
export type SaleFormatters = {
  isETH: boolean;
  tokenLabel: string;
  saleLabel: string;
  decimals: number;
  saleTokenDecimals: number;
  saleTokenScale: bigint;
  fmtPay: (v: bigint | number) => string;
  fmtSale: (v: bigint | number) => string;
  parsePay: (v: string) => bigint;
  tryParsePay: (v: string) => bigint | null;
  tryParseSaleTokens: (v: string) => bigint | null;
};

/// Returns a complete formatter bundle for a sale, or `null` if the sale
/// hasn't loaded yet. The hook reads payToken / saleToken metadata once.
export function useSaleFormatters(sale: SaleData | undefined): SaleFormatters | null {
  const isETH = sale ? isETHPayToken(sale.payToken) : false;

  const { data: payTokenSymbol } = useReadContract({
    address: sale?.payToken as `0x${string}`,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: !!sale && !isETH },
  });

  const { data: payTokenDecimals } = useReadContract({
    address: sale?.payToken as `0x${string}`,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: !!sale && !isETH },
  });

  const { data: saleTokenSymbol } = useReadContract({
    address: sale?.saleToken as `0x${string}`,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: !!sale },
  });

  const { data: saleTokenDecimalsRaw } = useReadContract({
    address: sale?.saleToken as `0x${string}`,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: !!sale },
  });

  if (!sale) return null;

  const decimals = isETH ? 18 : (payTokenDecimals ?? 6);
  const saleTokenDecimals =
    saleTokenDecimalsRaw !== undefined ? Number(saleTokenDecimalsRaw) : 18;
  const saleTokenScale = sale.saleTokenScale ?? 10n ** 18n;
  const tokenLabel = isETH ? "ETH" : (payTokenSymbol ?? "tokens");
  const saleLabel = saleTokenSymbol ?? "SALE";

  const fmtPay = (v: bigint | number) =>
    isETH ? formatEther(BigInt(v)) : formatUnits(BigInt(v), decimals);
  const fmtSale = (v: bigint | number) =>
    formatUnits(BigInt(v), saleTokenDecimals);
  const parsePay = (v: string) =>
    isETH ? parseEther(v) : parseUnits(v, decimals);
  const tryParsePay = (v: string) => {
    const normalized = v.trim();
    if (!normalized) return null;
    try {
      return parsePay(normalized);
    } catch {
      return null;
    }
  };
  const tryParseSaleTokens = (v: string) => {
    const normalized = v.trim();
    if (!normalized) return null;
    try {
      return parseUnits(normalized, saleTokenDecimals);
    } catch {
      return null;
    }
  };

  return {
    isETH,
    tokenLabel,
    saleLabel,
    decimals,
    saleTokenDecimals,
    saleTokenScale,
    fmtPay,
    fmtSale,
    parsePay,
    tryParsePay,
    tryParseSaleTokens,
  };
}
