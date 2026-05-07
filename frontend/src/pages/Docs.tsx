import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Lock,
  ArrowRight,
  Hash,
  Lightning,
  Wallet,
  Coins,
  Article,
  ShieldCheck,
  Sparkle,
  GearSix,
  Clock,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyAddress } from "@/components/CopyAddress";
import { SEALPAD_FACTORY_ADDRESS } from "@/config/contracts";
import { REQUIRED_CHAIN_LABEL } from "@/lib/network";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "lifecycle", label: "Lifecycle" },
  { id: "sale-types", label: "Sale Types" },
  { id: "allocation", label: "Allocation & Vesting" },
  { id: "privacy", label: "Privacy" },
  { id: "participants", label: "Participants" },
  { id: "creators", label: "Creators" },
  { id: "developers", label: "Developers" },
  { id: "limits", label: "Limits" },
];

function useActiveSection() {
  const [active, setActive] = useState<string>(sections[0].id);

  useEffect(() => {
    const onScroll = () => {
      const threshold = 140;
      let current = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - threshold <= 0) {
          current = s.id;
        } else {
          break;
        }
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return active;
}

export function Docs() {
  const active = useActiveSection();

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="space-y-4">
        <p className="font-mono text-xs tracking-widest text-brand-600">
          DOCUMENTATION
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          How SealPad works
        </h1>
        <p className="text-slate-600 max-w-3xl">
          SealPad is a confidential token-sale platform built on the Zama FHEVM.
          Contribution amounts and Dutch auction bids stay encrypted on-chain
          until the sale ends — only the final clearing price and your own
          allocation become public.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Badge
            variant="outline"
            className="font-mono text-[10px] tracking-widest uppercase border-brand-200 text-brand-700 bg-brand-50/40 inline-flex items-center gap-1"
          >
            <Lock size={10} weight="fill" />
            FHE-encrypted
          </Badge>
          <Badge
            variant="outline"
            className="font-mono text-[10px] tracking-widest uppercase"
          >
            {REQUIRED_CHAIN_LABEL}
          </Badge>
          <CopyAddress address={SEALPAD_FACTORY_ADDRESS} truncate={false} />
        </div>
      </div>

      {/* Mobile ToC (chip strip) */}
      <Card className="lg:hidden">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="font-mono text-[11px] tracking-widest uppercase border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-300 px-3 py-1.5 rounded transition-colors"
              >
                {s.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two-column: sidebar + content */}
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12 lg:items-start">
        <aside className="hidden lg:block lg:sticky lg:top-24 self-start">
          <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase mb-3">
            Contents
          </p>
          <nav className="flex flex-col border-l border-slate-200">
            {sections.map((s, i) => {
              const isActive = active === s.id;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`flex items-center gap-3 py-2 pl-3 -ml-px border-l-2 text-sm transition-colors ${
                    isActive
                      ? "border-brand-500 text-brand-600 font-semibold"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span
                    className={`font-mono text-[10px] tracking-widest ${
                      isActive ? "text-brand-500" : "text-slate-400"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{s.label}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        <div className="space-y-12 min-w-0">
          {/* Overview */}
          <DocsSection
            id="overview"
            eyebrow="01 — OVERVIEW"
            icon={
              <Lightning
                size={18}
                weight="duotone"
                className="text-brand-500"
              />
            }
            title="What it is"
          >
            <p>
              SealPad runs two kinds of token sales on a factory + clone
              architecture (each sale lives in its own EIP-1167 vault deployed
              by <Code>SealPadFactory</Code>): a <strong>Fixed Price</strong>{" "}
              sale where everyone pays the same creator-set price, and a
              sealed-bid <strong>Dutch Auction</strong> where participants
              choose a public bid price plus an encrypted investment amount, and
              a uniform clearing price is discovered after the sale ends.
            </p>
            <p>
              The privacy guarantee comes from FHEVM: contributions and bids are{" "}
              <Code>euint64</Code> ciphertexts, never decrypted on-chain
              mid-sale. When the sale finalizes, only the values the protocol
              actually needs (per-user contribution and the running total) are
              made publicly decryptable, and the KMS proof is verified on-chain
              before any settlement math runs.
            </p>
          </DocsSection>

          {/* Lifecycle */}
          <DocsSection
            id="lifecycle"
            eyebrow="02 — LIFECYCLE"
            icon={
              <GearSix size={18} weight="duotone" className="text-brand-500" />
            }
            title="From creation to claim"
          >
            <ol className="space-y-2 list-decimal list-inside text-sm marker:text-brand-500 marker:font-semibold">
              <li>
                <strong>Active</strong> — created, sale tokens locked into the
                contract. Users deposit pay token and submit encrypted
                contributions or bids.
              </li>
              <li>
                <strong>Finalizing</strong> — anyone calls{" "}
                <Code>requestFinalize</Code> after <Code>endTime</Code>; once
                the reorg-safety window (<Code>FINALIZE_REORG_DELAY</Code> = 95
                blocks) has passed, anyone calls <Code>finalize</Code>, which
                publishes ciphertexts for KMS to decrypt.
              </li>
              <li>
                <strong>Settled</strong> — anyone submits the decrypted values
                plus the KMS proof via <Code>settleFixed</Code> or{" "}
                <Code>settleDutch</Code>. Allocations are written; the creator
                receives total payment; unsold tokens are returned to the
                creator.
              </li>
              <li>
                <strong>Failed</strong> — soft cap not met (or no participants).
                Pay-token deposits stay refundable; sale tokens are returned to
                the creator.
              </li>
              <li>
                <strong>Cancelled</strong> — the creator cancels before any
                participant has contributed or bid.
              </li>
            </ol>
            <Callout title="Why two phases?">
              FHEVM decryption is asynchronous: the contract can mark a
              ciphertext publicly decryptable, but the actual plaintext and KMS
              proof are produced off-chain and submitted in a follow-up call.
              The split between <Code>finalize</Code> and <Code>settle*</Code>{" "}
              reflects that.
            </Callout>
          </DocsSection>

          {/* Sale types */}
          <DocsSection
            id="sale-types"
            eyebrow="03 — SALE TYPES"
            icon={
              <Coins size={18} weight="duotone" className="text-brand-500" />
            }
            title="Fixed Price vs Dutch Auction"
          >
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    Fixed Price
                    <Badge className="bg-brand-100 text-brand-700 border-brand-200 font-mono text-[10px] tracking-widest uppercase hover:bg-brand-100">
                      Type 0
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2 text-slate-600">
                  <p>
                    Creator sets a single <Code>price</Code>. Each contribution
                    is FHE-clamped to the user's deposit and added to an
                    encrypted running total.
                  </p>
                  <p>
                    If the decrypted total exceeds the hard cap, every
                    participant is scaled down proportionally so the raise lands
                    exactly on the cap.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    Dutch Auction
                    <Badge className="bg-brand-100 text-brand-700 border-brand-200 font-mono text-[10px] tracking-widest uppercase hover:bg-brand-100">
                      Type 1
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2 text-slate-600">
                  <p>
                    The creator sets a <strong>floor</strong> price. Each bidder
                    picks their own <Code>bidPrice</Code> (public) ≥ floor and
                    an encrypted investment amount.
                  </p>
                  <p>
                    After the sale ends, bids are processed from highest price
                    down. The lowest accepted price becomes the uniform clearing
                    price — everyone above pays the same. Bidders at the
                    clearing price share the remaining tokens pro-rata.
                  </p>
                </CardContent>
              </Card>
            </div>
          </DocsSection>

          {/* Allocation & Vesting */}
          <DocsSection
            id="allocation"
            eyebrow="04 — ALLOCATION & VESTING"
            icon={
              <Clock size={18} weight="duotone" className="text-brand-500" />
            }
            title="Settlement outputs and release schedule"
          >
            <p>
              After settlement, <Code>allocations[user]</Code> is written
              on-chain and immutable. Tokens release over time according to the
              sale's vesting schedule and are pulled via <Code>claim()</Code>.
              Any deposit not converted into allocation stays withdrawable via{" "}
              <Code>withdrawDeposit()</Code>.
            </p>

            <Callout title="Fixed-price overflow scaling">
              <p className="mb-2 text-slate-700">
                When totalContributed &gt; hardCap, every contribution is scaled
                down pro-rata:
              </p>
              <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-700">{`scale                  = hardCap / totalContributed
effective_contribution = contribution × scale
tokens                 = effective_contribution / price
refund (→ deposit)     = contribution − effective_contribution`}</pre>
              <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                Example. hardCap = 1 USDC, price = 0.001 USDC/token, supply =
                1000 tokens. A contributes 1 USDC, B contributes 0.1 USDC.
                totalContributed = 1.1 USDC, scale ≈ 0.909. A gets{" "}
                <strong>909 tokens + 0.091 USDC refund</strong>; B gets{" "}
                <strong>91 tokens + 0.009 USDC refund</strong>. Total raise
                lands exactly on hardCap; total tokens distributed = saleAmount.
              </p>
            </Callout>

            <p className="pt-1">
              For Dutch auctions, only bids ≥ the uniform clearing price are
              filled. Bidders at exactly the clearing price share the remaining
              tokens pro-rata. Higher bids pay the same clearing price — the
              difference stays in their deposit.
            </p>

            <Callout title="Vesting (mirrors SaleVault._vestedAmount)">
              <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-700">{`cliffEnd = settledAt + cliffDuration
vestEnd  = cliffEnd   + vestingDuration

cliffDuration == 0 && vestingDuration == 0  →  vested = allocation
now < cliffEnd                              →  vested = 0
now >= vestEnd                              →  vested = allocation
else                                        →  vested = allocation × (now − cliffEnd) / vestingDuration`}</pre>
            </Callout>

            <p>
              <Code>claim()</Code> transfers <Code>vested − tokensClaimed</Code>{" "}
              and bumps <Code>tokensClaimed</Code>. Pull-based — call as often
              or as rarely as you like; the contract pays out only the delta.
              There is no schedule on the contract side, so the user controls
              cadence.
            </p>

            <div className="overflow-x-auto rounded border border-slate-200 mt-2">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left font-mono text-[10px] tracking-widest text-slate-500 uppercase px-3 py-2">
                      cliff
                    </th>
                    <th className="text-left font-mono text-[10px] tracking-widest text-slate-500 uppercase px-3 py-2">
                      vesting
                    </th>
                    <th className="text-left font-mono text-[10px] tracking-widest text-slate-500 uppercase px-3 py-2">
                      Behavior
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <code className="font-mono text-xs text-slate-900">
                        0
                      </code>
                    </td>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <code className="font-mono text-xs text-slate-900">
                        0
                      </code>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      Instant — full allocation claimable on settle.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <code className="font-mono text-xs text-slate-900">
                        0
                      </code>
                    </td>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <code className="font-mono text-xs text-slate-900">
                        7d
                      </code>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      Linear release over 7 days from settle.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <code className="font-mono text-xs text-slate-900">
                        30d
                      </code>
                    </td>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <code className="font-mono text-xs text-slate-900">
                        180d
                      </code>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      30-day cliff, then 6-month linear release.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DocsSection>

          {/* Privacy */}
          <DocsSection
            id="privacy"
            eyebrow="05 — PRIVACY PRIMITIVE"
            icon={
              <ShieldCheck
                size={18}
                weight="duotone"
                className="text-brand-500"
              />
            }
            title="Independent deposit pool"
          >
            <p>
              A user's <strong>deposit</strong> (public) is the upper bound of
              how much they can spend. The actual spend — the contribution or
              bid amount — is encrypted and FHE-clamped to that bound. Updating
              a contribution moves <em>only the ciphertext</em>; no funds change
              hands, so observers can't infer revisions from token transfers.
            </p>
            <Callout title="Withdrawal rules">
              <ul className="space-y-1 list-disc list-inside text-slate-700">
                <li>
                  Before contributing or bidding, you can call{" "}
                  <Code>withdrawDeposit</Code> at any time.
                </li>
                <li>
                  Once you submit a contribution or bid, the deposit is locked
                  until the sale enters Settled, Failed, or Cancelled.
                </li>
                <li>
                  After settlement, your remaining deposit (deposit minus your
                  share of the actual raise) is withdrawable.
                </li>
              </ul>
            </Callout>
          </DocsSection>

          {/* Participants */}
          <DocsSection
            id="participants"
            eyebrow="06 — FOR PARTICIPANTS"
            icon={
              <Wallet size={18} weight="duotone" className="text-brand-500" />
            }
            title="Buying tokens in a sale"
          >
            <div className="space-y-3">
              <Step n={1} title="Connect on Sepolia">
                SealPad runs on {REQUIRED_CHAIN_LABEL} only. The app warns you
                if your wallet is on a different network.
              </Step>
              <Step n={2} title="Add a deposit">
                On a sale page, send pay-token (ETH or ERC-20) via{" "}
                <Code>addDeposit</Code>. This is the maximum amount you might
                spend — increase it any time before the sale ends.
              </Step>
              <Step n={3} title="Submit an encrypted contribution or bid">
                Choose a quantity. The frontend encrypts it client-side via the
                FHEVM relayer SDK, then sends the ciphertext to{" "}
                <Code>contribute</Code> (Fixed Price) or <Code>bid</Code>{" "}
                (Dutch). Updating later moves no tokens.
              </Step>
              <Step n={4} title="Wait for finalize + settle">
                After <Code>endTime</Code>, anyone calls{" "}
                <Code>requestFinalize</Code>; once the 95-block reorg-safety
                window passes, anyone calls <Code>finalize</Code> to publish the
                ciphertexts. Once KMS produces the decryption proof, anyone
                submits it via <Code>settleFixed</Code> or{" "}
                <Code>settleDutch</Code>.
              </Step>
              <Step n={5} title="Claim & withdraw leftover deposit">
                Call <Code>claim</Code> to receive vested sale tokens, and{" "}
                <Code>withdrawDeposit</Code> for any unspent pay-token.
              </Step>
            </div>
            <div className="pt-2">
              <Link
                to="/app"
                className="inline-flex items-center gap-1.5 font-mono text-xs tracking-widest text-brand-600 hover:text-brand-700 transition-colors"
              >
                BROWSE LIVE SALES <ArrowRight size={12} weight="bold" />
              </Link>
            </div>
          </DocsSection>

          {/* Creators */}
          <DocsSection
            id="creators"
            eyebrow="07 — FOR CREATORS"
            icon={
              <Sparkle size={18} weight="duotone" className="text-brand-500" />
            }
            title="Launching a sale"
          >
            <p>
              The{" "}
              <Link
                to="/app/create"
                className="text-brand-600 underline-offset-2 hover:underline"
              >
                Create
              </Link>{" "}
              page locks <Code>saleAmount</Code> sale tokens into the contract
              and registers the parameters below.
            </p>
            <div className="overflow-x-auto rounded border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left font-mono text-[10px] tracking-widest text-slate-500 uppercase px-3 py-2">
                      Parameter
                    </th>
                    <th className="text-left font-mono text-[10px] tracking-widest text-slate-500 uppercase px-3 py-2">
                      Meaning
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <Param
                    name="saleToken"
                    desc="ERC-20 you're selling. Decimals are read from the token at create time and stored on the sale; any decimals are supported."
                  />
                  <Param
                    name="saleAmount"
                    desc="Total sale-token units locked. Unsold tokens return to you on settle."
                  />
                  <Param
                    name="payToken"
                    desc="address(0) for ETH, otherwise an ERC-20."
                  />
                  <Param
                    name="saleType"
                    desc="0 = Fixed Price, 1 = Dutch Auction."
                  />
                  <Param
                    name="price"
                    desc="Fixed: token price in pay-token raw units. Dutch: floor (minimum) bid price."
                  />
                  <Param
                    name="softCap / hardCap"
                    desc="Min and max total raise. Below softCap → sale fails. Above hardCap → contributions are scaled down (Fixed) or only the top bids fill the cap (Dutch)."
                  />
                  <Param
                    name="maxPerUser"
                    desc="Per-wallet contribution cap, in pay-token raw units. 0 = no cap."
                  />
                  <Param
                    name="startTime / endTime"
                    desc="UNIX seconds. The sale is only active in this window."
                  />
                  <Param
                    name="whitelistRoot"
                    desc="Merkle root of allowed wallets, or bytes32(0) for an open sale."
                  />
                  <Param
                    name="cliffDuration / vestingDuration"
                    desc="Linear vesting after settle. Both 0 = instant claim."
                  />
                </tbody>
              </table>
            </div>
          </DocsSection>

          {/* Developers */}
          <DocsSection
            id="developers"
            eyebrow="08 — FOR DEVELOPERS"
            icon={
              <Article size={18} weight="duotone" className="text-brand-500" />
            }
            title="Architecture & integration"
          >
            <p>
              Two contracts: <Code>contracts/SealPadFactory.sol</Code> deploys
              EIP-1167 clones of <Code>contracts/SaleVault.sol</Code> via
              OpenZeppelin's <Code>Clones.clone()</Code>. Each sale lives in its
              own vault clone — storage is isolated, FHE ACLs are keyed by the
              clone's own address. The factory keeps three indexes (
              <Code>allSales</Code>, <Code>salesByCreator</Code>,
              <Code>salesByParticipant</Code>) for cheap listing queries. The
              frontend uses a hand-curated ABI subset in{" "}
              <Code>frontend/src/config/contracts.ts</Code> — typechain output
              is not imported.
            </p>
            <Callout title="FHE settlement flow (per vault)">
              <pre className="font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{`vault.requestFinalize()
  → emits FinalizeRequested(blockNumber)
wait FINALIZE_REORG_DELAY (95 blocks)
vault.finalize()
  → marks ciphertexts publicly decryptable
  → emits SaleFinalizing
off-chain: KMS decrypts handles, produces proof
vault.settleFixed(decryptedValues, proof)
  → FHE.checkSignatures verifies proof
  → computes per-user allocation
  → transfers totalPayment to creator
  → returns unsold tokens to creator`}</pre>
            </Callout>
            <div className="grid md:grid-cols-2 gap-4">
              <KeyValue label="Network" value={REQUIRED_CHAIN_LABEL} />
              <KeyValue
                label="Factory"
                value={
                  <CopyAddress
                    address={SEALPAD_FACTORY_ADDRESS}
                    truncate={false}
                    className="text-slate-900"
                  />
                }
              />
              <KeyValue
                label="Solc"
                value="0.8.27, viaIR, evmVersion: cancun"
              />
              <KeyValue
                label="Max participants per sale"
                value="50 (O(n²) Dutch clearing bound)"
              />
            </div>
          </DocsSection>

          {/* Limits */}
          <DocsSection
            id="limits"
            eyebrow="09 — CONSTANTS & LIMITS"
            icon={
              <Hash size={18} weight="duotone" className="text-brand-500" />
            }
            title="The numbers to remember"
          >
            <div className="grid md:grid-cols-3 gap-4">
              <KeyValue label="MAX_PARTICIPANTS" value="50" />
              <KeyValue
                label="FINALIZE_REORG_DELAY"
                value="95 blocks (~19 min)"
              />
              <KeyValue
                label="Sale-token scale"
                value="10**decimals(), per sale"
              />
              <KeyValue
                label="Pay-token math"
                value="uint64 (FHE constraint)"
              />
              <KeyValue
                label="Sale-token decimals"
                value="Any (read at create)"
              />
              <KeyValue
                label="Whitelist hash"
                value="keccak256(abi.encodePacked(user))"
              />
              <KeyValue label="Vesting" value="Cliff + linear, both optional" />
            </div>
          </DocsSection>
        </div>
      </div>
    </div>
  );
}

function DocsSection({
  id,
  eyebrow,
  icon,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-mono text-[10px] tracking-widest text-brand-600 uppercase">
          {eyebrow}
        </p>
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 rounded border border-slate-200 p-4">
      <div className="font-mono text-xs tracking-widest text-brand-600 shrink-0 pt-0.5">
        {String(n).padStart(2, "0")}
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-600">{children}</p>
      </div>
    </div>
  );
}

function Param({ name, desc }: { name: string; desc: string }) {
  return (
    <tr>
      <td className="px-3 py-2.5 align-top whitespace-nowrap">
        <code className="font-mono text-xs text-slate-900">{name}</code>
      </td>
      <td className="px-3 py-2.5 text-slate-600">{desc}</td>
    </tr>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-slate-200 p-3">
      <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase mb-1">
        {label}
      </p>
      <div className="text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}

function Callout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
      <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
        {title}
      </p>
      <div className="text-slate-700">{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-xs bg-slate-100 text-slate-900 px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}
