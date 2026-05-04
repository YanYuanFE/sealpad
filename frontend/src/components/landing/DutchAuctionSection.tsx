import { Link } from "react-router-dom";
import { EyeSlash, ChartLineDown } from "@phosphor-icons/react";
import { ScrambleText } from "./shared/ScrambleText";
import { Reveal } from "./shared/Reveal";
import { MagneticArea } from "./shared/MagneticArea";

export function DutchAuctionSection() {
  return (
    <section id="launchpad" className="py-32 px-6 md:px-8 bg-white">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <Reveal direction="left">
          <div>
            <h2 className="font-display text-5xl text-slate-900">
              Dutch Auction
              <br />
              Simulator
            </h2>
            <p className="mt-6 text-slate-600 max-w-xl">
              Experience how SealPad protects your strategy during a sealed
              Dutch auction. Bidders pick their own price, encrypt their amount,
              and settle at a uniform clearing price.
            </p>
            <div className="mt-10 space-y-6">
              <FeatureRow
                Icon={EyeSlash}
                title="Invisible Bid Volume"
                desc="Others see that a bid happened, but not the amount or whose strategy it represents."
              />
              <FeatureRow
                Icon={ChartLineDown}
                title="Fair Price Discovery"
                desc="Price drops until all tokens are sold. Everyone above the clearing line pays the same final price."
              />
            </div>
          </div>
        </Reveal>

        <Reveal direction="right" delay={150}>
          <div className="bg-slate-900 rounded-xl p-6 text-white relative overflow-hidden">
            {/* faint scan line accent */}
            <div
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                background:
                  "linear-gradient(180deg, transparent 0%, transparent 50%, rgba(255,81,0,0.06) 50%, rgba(255,81,0,0.06) 51%, transparent 51%)",
                backgroundSize: "100% 4px",
              }}
            />

            <div className="flex justify-between font-mono text-[11px] text-brand-300 mb-4 relative">
              <span className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                CONFIDENTIAL SIMULATOR // ACTIVE
              </span>
              <span>SEPOLIA TESTNET</span>
            </div>

            <div className="relative h-56 border border-slate-700 rounded-md grid place-items-center font-mono text-3xl tracking-[0.4em] text-brand-500/70 overflow-hidden">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "linear-gradient(#FF510044 1px,transparent 1px),linear-gradient(90deg,#FF510044 1px,transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />
              <ScrambleText
                text="ENCRYPTED"
                mode="live"
                speed={90}
                scrambleChars="▓░█◆◇▢◯X$#@01ABCDEF"
                className="relative"
              />
              <span className="absolute bottom-3 left-3 font-mono text-[10px] tracking-widest text-slate-500">
                ENCRYPTED PAYLOAD
              </span>
              <span className="absolute top-3 right-3 font-mono text-[10px] tracking-widest text-brand-400 inline-flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-brand-400 animate-pulse" />
                FHE-WRAPPED
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6 relative">
              <Box label="YOUR BID (ENCRYPTED)" value="$2,500" liveScramble />
              <Box label="CURRENT PRICE" value="$5.33" />
            </div>

            <MagneticArea className="mt-6 block">
              <Link
                to="/app"
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-mono text-sm tracking-widest py-3 rounded transition-colors flex items-center justify-center"
              >
                ENCRYPT &amp; SUBMIT BID
              </Link>
            </MagneticArea>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FeatureRow({
  Icon,
  title,
  desc,
}: {
  Icon: React.ComponentType<{
    size?: number;
    weight?: "bold" | "fill" | "regular";
  }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-full bg-brand-50 grid place-items-center text-brand-600 shrink-0">
        <Icon size={18} weight="bold" />
      </div>
      <div>
        <h4 className="font-semibold text-slate-900">{title}</h4>
        <p className="text-sm text-slate-600 mt-1">{desc}</p>
      </div>
    </div>
  );
}

function Box({
  label,
  value,
  liveScramble,
}: {
  label: string;
  value: string;
  liveScramble?: boolean;
}) {
  return (
    <div className="bg-slate-800 p-4 rounded">
      <div className="font-mono text-[10px] tracking-widest text-slate-400">
        {label}
      </div>
      <div className="text-2xl font-mono text-brand-300 mt-1">
        {liveScramble ? (
          <ScrambleText text={value} mode="live" speed={140} />
        ) : (
          value
        )}
      </div>
    </div>
  );
}
