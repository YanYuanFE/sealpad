import { Link } from "react-router-dom";
import { useReadContract } from "wagmi";
import { Lightning, ArrowRight, GearSix, Lock } from "@phosphor-icons/react";
import {
  SEALPAD_FACTORY_ABI,
  SEALPAD_FACTORY_ADDRESS,
} from "@/config/contracts";
import { ScrambleText } from "./shared/ScrambleText";
import { CounterRollUp } from "./shared/CounterRollUp";
import { MagneticArea } from "./shared/MagneticArea";
import { HashStream } from "./shared/HashStream";

export function HeroSection() {
  const { data: total } = useReadContract({
    address: SEALPAD_FACTORY_ADDRESS,
    abi: SEALPAD_FACTORY_ABI,
    functionName: "totalSales",
  });
  const totalSales = total !== undefined ? Number(total) : 0;

  return (
    <section className="relative min-h-screen pt-32 pb-24 px-6 md:px-8 overflow-hidden bg-canvas">
      {/* Grid background — base layer */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#e5e7eb 1px,transparent 1px),linear-gradient(90deg,#e5e7eb 1px,transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      {/* Falling cipher chars — Matrix-style hash stream behind content */}
      <HashStream className="absolute inset-0 opacity-30 pointer-events-none mix-blend-darken" />
      {/* Subtle radial spotlight — Saturn orange */}
      <div
        className="absolute inset-0 opacity-70 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 80% 30%, rgba(255,81,0,0.10), transparent 55%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-block border border-brand-500 text-brand-600 font-mono text-xs px-3 py-1.5 rounded mb-10 animate-[pulse-soft_2.4s_ease-in-out_infinite]">
            <ScrambleText
              text="[ STATUS: LIVE ON SEPOLIA TESTNET ]"
              duration={900}
            />
          </span>
          <h1 className="font-display text-7xl lg:text-8xl leading-[0.95] tracking-tight text-slate-900">
            <ScrambleText text="PRIVATE" duration={700} delay={120} />
            <br />
            <ScrambleText text="LIQUIDITY" duration={900} delay={420} />
          </h1>
          <p className="mt-10 text-lg text-slate-600 max-w-xl">
            The first confidential token launchpad powered by{" "}
            <span className="text-brand-600 font-semibold">Zama FHE</span>.
            Encrypt your bids, protect your alpha, and launch with
            mathematically proven privacy on Ethereum.
          </p>
          <div className="mt-10 flex items-center gap-6 flex-wrap">
            <MagneticArea>
              <Link
                to="/app"
                className="bg-slate-900 text-white px-7 py-4 rounded inline-flex items-center gap-3 hover:bg-slate-800 transition-colors font-medium"
              >
                Create Launch
                <ArrowRight size={18} weight="bold" />
              </Link>
            </MagneticArea>
            <span className="font-mono text-xs text-slate-500 inline-flex items-center gap-1.5">
              <GearSix size={14} weight="fill" /> Fully On-chain
            </span>
            <span className="font-mono text-xs text-slate-500 inline-flex items-center gap-1.5">
              <Lock size={14} weight="fill" /> FHE-Hardened
            </span>
          </div>
        </div>

        <div className="relative bg-white border border-brand-200 rounded-lg p-6 shadow-sm">
          <div className="absolute -top-3 -right-3 w-10 h-10 bg-brand-500 rounded grid place-items-center text-white shadow-md shadow-brand-500/30 animate-[pulse-soft_2.4s_ease-in-out_infinite]">
            <Lightning size={18} weight="fill" />
          </div>
          <div className="font-mono text-xs text-brand-600 mb-6 inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
            LIVE NETWORK DATA // ENCRYPTED
          </div>
          <Stat label="Total Sales Created" mono>
            <CounterRollUp value={totalSales} />
          </Stat>
          <Stat label="FHE Primitives Used" mono>
            <CounterRollUp value={6} />
          </Stat>
          <Stat label="Sale Modes Supported" mono>
            <CounterRollUp value={2} />
          </Stat>
          <Stat label="Network">
            <span className="font-mono">Sepolia</span>
          </Stat>
        </div>
      </div>

      <div className="absolute bottom-6 inset-x-0 hidden md:flex justify-between px-8 font-mono text-[11px] text-slate-500">
        <span>
          [ <ScrambleText text="0x18C2..F42" mode="live" speed={180} /> ] —
          VERIFIED CONTRACT
        </span>
        <span>SCROLL TO DECRYPT PROTOCOL ↓</span>
        <span>[ CHAIN : 11155111 ]</span>
      </div>

      <style>{`
        @keyframes pulse-soft {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 81, 0, 0.0); }
          50% { box-shadow: 0 0 0 6px rgba(255, 81, 0, 0.08); }
        }
      `}</style>
    </section>
  );
}

function Stat({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between py-3 border-b border-slate-100 last:border-0">
      <span className="text-slate-600 text-sm">{label}</span>
      <span
        className={`font-semibold text-slate-900 ${mono ? "font-mono" : ""}`}
      >
        {children}
      </span>
    </div>
  );
}
