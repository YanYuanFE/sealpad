import { useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useBalance,
  useReadContract,
} from "wagmi";
import { erc20Abi } from "viem";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SALE_VAULT_ABI } from "@/config/contracts";
import { getErrorMessage } from "@/lib/constants";
import { REQUIRED_CHAIN_ID, useEnsureSepolia } from "@/lib/network";
import type { SaleData } from "@/lib/sale-types";
import type { SaleFormatters } from "@/lib/sale-formatters";

type Props = {
  vaultAddress: `0x${string}`;
  sale: SaleData;
  fmt: SaleFormatters;
  currentDeposit: bigint;
  /// Called after a successful deposit so the parent can refresh
  /// vault state + the deposit balance hook.
  onDeposited: () => Promise<unknown> | unknown;
  onError: (msg: string) => void;
};

export function DepositPanel({
  vaultAddress,
  sale,
  fmt,
  currentDeposit,
  onDeposited,
  onError,
}: Props) {
  const { address } = useAccount();
  const { mutateAsync: writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const ensureSepolia = useEnsureSepolia();

  const [depositInput, setDepositInput] = useState("");
  const [step, setStep] = useState<string | null>(null);

  // ETH path: useBalance for native gas balance.
  const { data: ethBalance } = useBalance({
    address,
    query: { enabled: fmt.isETH && !!address },
  });
  // ERC-20 path: balanceOf(user). wagmi v2's useBalance dropped the `token`
  // shortcut, so we go through useReadContract.
  const { data: erc20Balance } = useReadContract({
    address: sale.payToken as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !fmt.isETH && !!address },
  });
  const walletBalanceRaw: bigint | undefined = fmt.isETH
    ? ethBalance?.value
    : (erc20Balance as bigint | undefined);

  const handleDeposit = async () => {
    if (!publicClient || !depositInput || !address) return;
    onError("");
    try {
      setStep("Checking network...");
      await ensureSepolia();
      const raw = fmt.parsePay(depositInput);
      if (!fmt.isETH) {
        // Skip approve if the existing allowance to the vault already covers
        // this deposit. Saves a wallet popup + ~46k gas when the user is
        // topping up.
        setStep("Checking allowance...");
        const currentAllowance = (await publicClient.readContract({
          address: sale.payToken as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, vaultAddress],
        })) as bigint;
        if (currentAllowance < raw) {
          setStep("Sign approval...");
          const ah = await writeContractAsync({
            address: sale.payToken as `0x${string}`,
            abi: erc20Abi,
            functionName: "approve",
            args: [vaultAddress, raw],
            chainId: REQUIRED_CHAIN_ID,
          });
          setStep("Confirming approval...");
          await publicClient.waitForTransactionReceipt({ hash: ah });
          toast.success("Token approved");
        }
      }
      setStep("Simulating deposit...");
      const { request } = await publicClient.simulateContract({
        address: vaultAddress,
        abi: SALE_VAULT_ABI,
        functionName: "addDeposit",
        args: [raw],
        account: address,
        ...(fmt.isETH ? { value: raw } : {}),
      });
      setStep("Depositing...");
      const h = await writeContractAsync(request);
      setStep("Confirming...");
      await publicClient.waitForTransactionReceipt({ hash: h });
      toast.success("Deposit confirmed!");
      setDepositInput("");
      await onDeposited();
    } catch (err) {
      const msg = getErrorMessage(err, "Deposit failed");
      onError(msg);
      toast.error(msg);
    } finally {
      setStep(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1 · Deposit Collateral</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
          <span className="text-slate-500">Your deposit</span>
          <span className="font-mono font-bold text-slate-900">
            {fmt.fmtPay(currentDeposit)} {fmt.tokenLabel}
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Add Deposit ({fmt.tokenLabel})</Label>
            <span className="text-xs text-slate-500 font-mono">
              Balance:{" "}
              {walletBalanceRaw !== undefined
                ? `${Number(fmt.fmtPay(walletBalanceRaw)).toFixed(6)} ${fmt.tokenLabel}`
                : "..."}
            </span>
          </div>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Amount to add"
            value={depositInput}
            onChange={(e) => setDepositInput(e.target.value)}
          />
          <p className="text-xs text-slate-500">
            Deposit is <strong>public</strong> — sets the upper bound of your
            contribution.
          </p>
        </div>
        <button
          onClick={handleDeposit}
          disabled={!!step || !depositInput || Number(depositInput) <= 0}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded font-semibold transition-colors"
        >
          {step || "Add Deposit"}
        </button>
      </CardContent>
    </Card>
  );
}
