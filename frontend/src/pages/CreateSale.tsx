import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import {
  erc20Abi,
  parseUnits,
  parseEther,
  isAddress,
  parseEventLogs,
} from "viem";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SEALPAD_FACTORY_ABI,
  SEALPAD_FACTORY_ADDRESS,
} from "@/config/contracts";
import { ZERO_ADDRESS, getErrorMessage } from "@/lib/constants";
import { REQUIRED_CHAIN_ID, useEnsureSepolia } from "@/lib/network";

// ============================================================
//                       TIME UTILITIES
// ============================================================

const UNIT_SECONDS = {
  minutes: 60,
  hours: 3600,
  days: 86400,
  weeks: 604800,
  months: 2592000, // 30 days
} as const;
type DurationUnit = keyof typeof UNIT_SECONDS;

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if ((m > 0 && d === 0) || (parts.length === 0 && m > 0)) parts.push(`${m}m`);
  if (parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

function unitToSeconds(value: string, unit: DurationUnit): number {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  return n * UNIT_SECONDS[unit];
}

// ============================================================
//                       PRIMITIVES
// ============================================================

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center transition-colors ${
        checked ? "bg-brand-500" : "bg-slate-300"
      }`}
      style={{ borderRadius: "0.69px" }}
    >
      {label && <span className="sr-only">{label}</span>}
      <span
        className="absolute top-1 h-4 w-4 bg-white shadow transition-transform"
        style={{
          borderRadius: "0.69px",
          transform: checked ? "translateX(24px)" : "translateX(4px)",
        }}
      />
    </button>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white border border-slate-200 text-slate-700 hover:border-slate-400"
      }`}
      style={{ borderRadius: "0.69px" }}
    >
      {children}
    </button>
  );
}

function UnitSelect({
  value,
  onChange,
  units,
}: {
  value: DurationUnit;
  onChange: (v: DurationUnit) => void;
  units: DurationUnit[];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DurationUnit)}>
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {units.map((u) => (
          <SelectItem key={u} value={u}>
            {u.charAt(0).toUpperCase() + u.slice(1)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FieldHint({
  children,
  error,
}: {
  children?: React.ReactNode;
  error?: boolean;
}) {
  if (!children) return null;
  return (
    <p
      className={`text-xs font-mono ${error ? "text-rose-600" : "text-slate-500"}`}
    >
      {children}
    </p>
  );
}

// ============================================================
//                       MAIN COMPONENT
// ============================================================

export function CreateSale() {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const publicClient = usePublicClient();
  const { mutateAsync: writeContractAsync } = useWriteContract();
  const ensureSepolia = useEnsureSepolia();

  // Sale config
  const [saleType, setSaleType] = useState(0); // 0 = Fixed, 1 = Dutch
  const [saleToken, setSaleToken] = useState("");
  const [saleAmount, setSaleAmount] = useState("1000");
  const [payTokenChoice, setPayTokenChoice] = useState<"ETH" | "ERC20">("ETH");
  const [payTokenAddress, setPayTokenAddress] = useState("");
  const [price, setPrice] = useState("0.001");
  const [softCap, setSoftCap] = useState("0.01");
  const [hardCap, setHardCap] = useState("1");
  const [maxPerUser, setMaxPerUser] = useState("0");

  // Schedule — defaults: starts in 5 min, ends 1 hour later
  const [startTime, setStartTime] = useState<Date | undefined>(
    () => new Date(Date.now() + 5 * 60 * 1000),
  );
  const [endTime, setEndTime] = useState<Date | undefined>(
    () => new Date(Date.now() + 60 * 60 * 1000),
  );

  // Vesting (off by default)
  const [vestingEnabled, setVestingEnabled] = useState(false);
  const [cliffValue, setCliffValue] = useState("0");
  const [cliffUnit, setCliffUnit] = useState<DurationUnit>("days");
  const [vestingValue, setVestingValue] = useState("7");
  const [vestingUnit, setVestingUnit] = useState<DurationUnit>("days");

  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isETH = payTokenChoice === "ETH";
  const isValidSaleToken = saleToken !== "" && isAddress(saleToken);
  const isValidPayToken =
    payTokenChoice === "ETH" ||
    (payTokenAddress !== "" && isAddress(payTokenAddress));

  // ---------- Derived schedule state ----------
  const startUnix = startTime ? Math.floor(startTime.getTime() / 1000) : null;
  const endUnix = endTime ? Math.floor(endTime.getTime() / 1000) : null;
  const nowUnix = Math.floor(Date.now() / 1000);
  const durationSec =
    startUnix !== null && endUnix !== null ? endUnix - startUnix : 0;

  const startInPast = startUnix !== null && startUnix <= nowUnix;
  const endBeforeStart =
    startUnix !== null && endUnix !== null && endUnix <= startUnix;
  const tooShort = durationSec > 0 && durationSec < 60;

  // Decimal-string validators. `parseUnits` is the runtime source of truth,
  // but we use these for cheap form-level gating without needing live token
  // decimals. The regex rejects empty / Infinity / NaN / "1e10" / "abc".
  const decimalRe = /^\d+(\.\d+)?$/;
  const isPositiveDecimal = (s: string) => {
    const v = s.trim();
    if (!decimalRe.test(v)) return false;
    const n = Number(v);
    return Number.isFinite(n) && n > 0;
  };
  const isNonNegativeDecimal = (s: string) => {
    const v = s.trim();
    if (!decimalRe.test(v)) return false;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0;
  };

  const scheduleValid =
    startUnix !== null &&
    endUnix !== null &&
    !startInPast &&
    !endBeforeStart &&
    !tooShort;

  // ---------- Derived vesting state ----------
  const cliffSec = useMemo(
    () => (vestingEnabled ? unitToSeconds(cliffValue, cliffUnit) : 0),
    [vestingEnabled, cliffValue, cliffUnit],
  );
  const vestingSec = useMemo(
    () => (vestingEnabled ? unitToSeconds(vestingValue, vestingUnit) : 0),
    [vestingEnabled, vestingValue, vestingUnit],
  );
  const vestingValid = !vestingEnabled || cliffSec + vestingSec > 0; // at least one of them must be > 0 when enabled

  // ---------- Cap validation ----------
  const softCapValid = isPositiveDecimal(softCap);
  const hardCapValid = isPositiveDecimal(hardCap);
  const capOrderValid =
    softCapValid && hardCapValid && Number(hardCap) >= Number(softCap);
  const maxPerUserValid = isNonNegativeDecimal(maxPerUser);

  // Mirror SaleVault.initialize's check: for fixed-price sales, hardCap must
  // be reachable given saleAmount × price. We can't compute this in raw units
  // here without live token decimals, but a float check using the same
  // user-entered numbers catches the common case (e.g. "10000 tokens at 0.00001
  // ETH each, hardCap 1 ETH" → max raise is only 0.1 ETH, would revert).
  const isFixedPrice = saleType === 0;
  const maxFixedRaise = useMemo(() => {
    if (!isFixedPrice) return null;
    if (!isPositiveDecimal(saleAmount) || !isPositiveDecimal(price))
      return null;
    return Number(saleAmount) * Number(price);
  }, [isFixedPrice, saleAmount, price]);
  const hardCapExceedsCapacity =
    isFixedPrice &&
    hardCapValid &&
    maxFixedRaise !== null &&
    Number(hardCap) > maxFixedRaise;

  const formValid =
    isValidSaleToken &&
    isValidPayToken &&
    isPositiveDecimal(saleAmount) &&
    isPositiveDecimal(price) &&
    !hardCapExceedsCapacity &&
    softCapValid &&
    hardCapValid &&
    capOrderValid &&
    maxPerUserValid &&
    scheduleValid &&
    vestingValid;

  const handleCreate = async () => {
    if (!publicClient || !formValid || !address) return;
    setError(null);
    try {
      setStep("Checking network...");
      await ensureSepolia();

      setStep("Reading sale token decimals...");
      const [saleTokenDecimalsRaw, currentAllowance] = await Promise.all([
        publicClient.readContract({
          address: saleToken as `0x${string}`,
          abi: erc20Abi,
          functionName: "decimals",
        }),
        publicClient.readContract({
          address: saleToken as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, SEALPAD_FACTORY_ADDRESS],
        }),
      ]);
      const saleTokenDecimals = Number(saleTokenDecimalsRaw);
      const saleAmountRaw = parseUnits(saleAmount, saleTokenDecimals);

      // Skip the approve tx if the existing allowance already covers this
      // sale's lock amount. Saves the user a wallet popup + ~46k gas on a
      // re-create or a topped-up allowance.
      if ((currentAllowance as bigint) < saleAmountRaw) {
        setStep("Sign token approval...");
        const approveHash = await writeContractAsync({
          address: saleToken as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [SEALPAD_FACTORY_ADDRESS, saleAmountRaw],
          chainId: REQUIRED_CHAIN_ID,
        });
        setStep("Confirming approval...");
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        toast.success("Token approved");
      }

      setStep(
        isETH
          ? "Preparing sale parameters..."
          : "Reading payment token decimals...",
      );
      const payToken = (
        isETH ? ZERO_ADDRESS : payTokenAddress
      ) as `0x${string}`;
      const payTokenDecimals = isETH
        ? 18
        : Number(
            await publicClient.readContract({
              address: payToken,
              abi: erc20Abi,
              functionName: "decimals",
            }),
          );

      setStep("Sign sale creation...");

      const parsePayAmount = (label: string, v: string) => {
        try {
          return isETH ? parseEther(v) : parseUnits(v, payTokenDecimals);
        } catch {
          throw new Error(
            `${label} is not a valid amount for the chosen pay token.`,
          );
        }
      };

      const params = {
        saleToken: saleToken as `0x${string}`,
        saleAmount: saleAmountRaw,
        payToken,
        saleType,
        price: parsePayAmount("Price", price),
        softCap: parsePayAmount("Soft cap", softCap),
        hardCap: parsePayAmount("Hard cap", hardCap),
        // 0 = "no limit"; treat any string that parses to 0 the same way.
        maxPerUser: parsePayAmount("Max per user", maxPerUser.trim() || "0"),
        startTime: BigInt(startUnix!),
        endTime: BigInt(endUnix!),
        whitelistRoot:
          "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
        cliffDuration: BigInt(cliffSec),
        vestingDuration: BigInt(vestingSec),
      };

      // Pre-flight via eth_call so contract-level reverts (InvalidParams,
      // SaleEnded, etc.) surface as a readable toast before the wallet popup.
      setStep("Simulating sale creation...");
      const { request } = await publicClient.simulateContract({
        address: SEALPAD_FACTORY_ADDRESS,
        abi: SEALPAD_FACTORY_ABI,
        functionName: "createSale",
        args: [params],
        account: address,
      });

      setStep("Sign sale creation...");
      const createHash = await writeContractAsync(request);

      setStep("Confirming...");
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: createHash,
      });

      // Parse the SaleCreated log so we can navigate straight to the new vault.
      const events = parseEventLogs({
        abi: SEALPAD_FACTORY_ABI,
        eventName: "SaleCreated",
        logs: receipt.logs,
      });
      const vaultAddress =
        (events[0]?.args as { vault?: string } | undefined)?.vault ?? null;

      toast.success("Sale created!");
      navigate(vaultAddress ? `/app/sale/${vaultAddress}` : "/app");
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setStep(null);
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-slate-500">
          Connect your wallet to create a sale.
        </CardContent>
      </Card>
    );
  }

  // ============================================================
  //                          RENDER
  // ============================================================

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="font-mono text-xs tracking-widest text-brand-600 mb-2">
          NEW LAUNCH
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Create Token Sale
        </h1>
        <p className="text-slate-600 mt-1 text-sm">
          Configure parameters, then approve and launch.
        </p>
      </div>

      {/* ---------- 1. Sale Type & Token ---------- */}
      <Card>
        <CardHeader>
          <CardTitle>1 · Sale Type & Token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Sale Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <ToggleButton
                active={saleType === 0}
                onClick={() => setSaleType(0)}
              >
                Fixed Price
              </ToggleButton>
              <ToggleButton
                active={saleType === 1}
                onClick={() => setSaleType(1)}
              >
                Dutch Auction
              </ToggleButton>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sale Token Address (ERC-20)</Label>
            <Input
              placeholder="0x..."
              value={saleToken}
              onChange={(e) => setSaleToken(e.target.value)}
              className={
                saleToken && !isValidSaleToken ? "border-rose-400" : ""
              }
            />
            {saleToken && !isValidSaleToken && (
              <FieldHint error>Not a valid Ethereum address.</FieldHint>
            )}
          </div>

          <div className="space-y-2">
            <Label>Total Tokens for Sale</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={saleAmount}
              onChange={(e) => setSaleAmount(e.target.value)}
            />
            <FieldHint>
              Whole tokens. Decimals are read from the token at create time.
            </FieldHint>
          </div>
        </CardContent>
      </Card>

      {/* ---------- 2. Pricing & Caps ---------- */}
      <Card>
        <CardHeader>
          <CardTitle>2 · Pricing & Caps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Payment Currency</Label>
            <div className="grid grid-cols-2 gap-2">
              <ToggleButton
                active={isETH}
                onClick={() => setPayTokenChoice("ETH")}
              >
                ETH
              </ToggleButton>
              <ToggleButton
                active={!isETH}
                onClick={() => setPayTokenChoice("ERC20")}
              >
                ERC-20
              </ToggleButton>
            </div>
            {!isETH && (
              <Input
                placeholder="0x... ERC-20 address"
                value={payTokenAddress}
                onChange={(e) => setPayTokenAddress(e.target.value)}
                className={
                  payTokenAddress && !isAddress(payTokenAddress)
                    ? "border-rose-400"
                    : ""
                }
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>
              {saleType === 0
                ? `Price per Token (${isETH ? "ETH" : "pay token"})`
                : `Floor Price (${isETH ? "ETH" : "pay token"})`}
            </Label>
            <Input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            {saleType === 1 && (
              <FieldHint>
                Investors can bid any price above this floor. Clearing price is
                determined by demand.
              </FieldHint>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Soft Cap ({isETH ? "ETH" : "pay token"})</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={softCap}
                onChange={(e) => setSoftCap(e.target.value)}
                className={
                  softCap.trim() !== "" && !softCapValid
                    ? "border-rose-400"
                    : ""
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Hard Cap ({isETH ? "ETH" : "pay token"})</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={hardCap}
                onChange={(e) => setHardCap(e.target.value)}
                className={
                  hardCap.trim() !== "" && !hardCapValid
                    ? "border-rose-400"
                    : ""
                }
              />
            </div>
          </div>
          {(softCap.trim() !== "" || hardCap.trim() !== "") &&
            (!softCapValid || !hardCapValid || !capOrderValid) && (
              <FieldHint error>
                {!softCapValid || !hardCapValid
                  ? "Caps must be positive decimal numbers."
                  : "Soft cap must be ≤ Hard cap."}
              </FieldHint>
            )}
          {hardCapExceedsCapacity && maxFixedRaise !== null && (
            <FieldHint error>
              Hard cap {hardCap} {isETH ? "ETH" : "pay token"} exceeds the
              maximum possible raise ({maxFixedRaise}{" "}
              {isETH ? "ETH" : "pay token"}) — at {price} per token ×{" "}
              {saleAmount} tokens, the sale can&rsquo;t raise more than that.
              Reduce hard cap or sell more tokens.
            </FieldHint>
          )}

          <div className="space-y-2">
            <Label>Max Per User ({isETH ? "ETH" : "pay token"})</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={maxPerUser}
              onChange={(e) => setMaxPerUser(e.target.value)}
            />
            <FieldHint>0 = no per-user limit.</FieldHint>
          </div>
        </CardContent>
      </Card>

      {/* ---------- 3. Schedule ---------- */}
      <Card>
        <CardHeader>
          <CardTitle>3 · Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <DateTimePicker
                value={startTime}
                onChange={setStartTime}
                error={startInPast}
                fromDate={new Date()}
                placeholder="Select start"
              />
              {startInPast && (
                <FieldHint error>Start time must be in the future.</FieldHint>
              )}
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <DateTimePicker
                value={endTime}
                onChange={setEndTime}
                error={endBeforeStart || tooShort}
                fromDate={startTime ?? new Date()}
                placeholder="Select end"
              />
              {endBeforeStart && (
                <FieldHint error>End time must be after start time.</FieldHint>
              )}
              {!endBeforeStart && tooShort && (
                <FieldHint error>Sale must run at least 1 minute.</FieldHint>
              )}
            </div>
          </div>

          {scheduleValid && (
            <div
              className="bg-slate-50 border border-slate-200 px-4 py-3 text-sm flex items-center justify-between"
              style={{ borderRadius: "0.69px" }}
            >
              <span className="text-slate-500 font-mono text-xs tracking-widest">
                DURATION
              </span>
              <span className="font-mono font-semibold text-slate-900">
                {formatDuration(durationSec)}
              </span>
            </div>
          )}

          <FieldHint>
            Times are interpreted in your local timezone (
            {Intl.DateTimeFormat().resolvedOptions().timeZone}).
          </FieldHint>
        </CardContent>
      </Card>

      {/* ---------- 4. Vesting ---------- */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>4 · Vesting</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono tracking-widest text-slate-500">
              {vestingEnabled ? "ENABLED" : "DISABLED"}
            </span>
            <Toggle
              checked={vestingEnabled}
              onChange={setVestingEnabled}
              label="Enable vesting"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!vestingEnabled ? (
            <p className="text-sm text-slate-500">
              Tokens are claimable in full immediately after settlement.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Cliff Period</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={cliffValue}
                    onChange={(e) => setCliffValue(e.target.value)}
                    className="flex-1"
                  />
                  <UnitSelect
                    value={cliffUnit}
                    onChange={setCliffUnit}
                    units={["minutes", "hours", "days", "weeks"]}
                  />
                </div>
                <FieldHint>
                  Time after settlement before any tokens can be claimed. 0 = no
                  cliff.
                </FieldHint>
              </div>

              <div className="space-y-2">
                <Label>Linear Vesting Duration</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={vestingValue}
                    onChange={(e) => setVestingValue(e.target.value)}
                    className="flex-1"
                  />
                  <UnitSelect
                    value={vestingUnit}
                    onChange={setVestingUnit}
                    units={["minutes", "hours", "days", "weeks", "months"]}
                  />
                </div>
                <FieldHint>
                  After the cliff, tokens unlock linearly over this period.
                </FieldHint>
              </div>

              {!vestingValid && (
                <FieldHint error>
                  When enabled, cliff or vesting duration must be greater than
                  zero.
                </FieldHint>
              )}

              {vestingValid && (
                <div
                  className="bg-slate-50 border border-slate-200 px-4 py-3 space-y-1.5 text-sm"
                  style={{ borderRadius: "0.69px" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-mono text-xs tracking-widest">
                      CLIFF
                    </span>
                    <span className="font-mono text-slate-900">
                      {formatDuration(cliffSec)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-mono text-xs tracking-widest">
                      VESTING
                    </span>
                    <span className="font-mono text-slate-900">
                      {formatDuration(vestingSec)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                    <span className="text-slate-500 font-mono text-xs tracking-widest">
                      TOTAL UNLOCK
                    </span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatDuration(cliffSec + vestingSec)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------- Submit ---------- */}
      {error && (
        <div
          className="bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700"
          style={{ borderRadius: "0.69px" }}
        >
          {error}
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={!!step || !formValid}
        className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3.5 rounded font-semibold transition-colors"
      >
        {step || (formValid ? "Create Sale" : "Fix the highlighted fields")}
      </button>
    </div>
  );
}
