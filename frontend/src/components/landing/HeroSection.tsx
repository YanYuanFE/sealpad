import { Link } from "react-router-dom";
import { useReadContract } from "wagmi";
import { ArrowRight } from "@phosphor-icons/react";
import {
  SEALPAD_FACTORY_ABI,
  SEALPAD_FACTORY_ADDRESS,
} from "@/config/contracts";
import { CipherGrid } from "./shared/CipherGrid";
import { CipherSwarm } from "./shared/CipherSwarm";
import { CountUp } from "./shared/CountUp";

export function HeroSection() {
  // Reuse the same query Home.tsx already runs — wagmi dedupes on queryKey,
  // so the landing page costs zero extra RPCs once Home has fetched.
  const { data: sales } = useReadContract({
    address: SEALPAD_FACTORY_ADDRESS,
    abi: SEALPAD_FACTORY_ABI,
    functionName: "getAllSales",
  });
  const totalSales = sales !== undefined ? sales.length : null;

  const factoryShort = `${SEALPAD_FACTORY_ADDRESS.slice(
    0,
    6,
  )}…${SEALPAD_FACTORY_ADDRESS.slice(-4)}`;

  return (
    <section className="relative bg-canvas border-b border-slate-200 overflow-hidden">
      <CipherSwarm />
      <div className="relative mx-auto max-w-7xl px-6 md:px-8 pt-32 pb-24 lg:pt-40 lg:pb-32">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16">
          {/* Left: product pitch */}
          <div className="lg:col-span-7">
            <p className="font-mono text-[11px] tracking-[0.18em] text-brand-500 uppercase">
              Confidential token sales · FHE-native
            </p>
            <h1 className="mt-10 text-5xl md:text-6xl lg:text-[5.25rem] leading-[1.02] tracking-tight text-slate-900 font-medium">
              Confidential
              <br />
              token sales.
              <br />
              <span className="text-slate-400">Settled in cleartext.</span>
            </h1>
            <p className="mt-10 max-w-prose text-lg text-slate-600 leading-relaxed">
              Bids stay encrypted on-chain until settlement. Only the clearing
              price and your own allocation ever become public.
            </p>
            <div className="mt-12 flex items-center gap-8 flex-wrap">
              <Link
                to="/app"
                className="bg-slate-900 hover:bg-slate-800 text-white px-7 py-3.5 transition-colors text-sm font-medium tracking-tight"
              >
                Browse live sales
              </Link>
              <Link
                to="/app/docs"
                className="text-sm text-slate-700 hover:text-brand-600 transition-colors inline-flex items-center gap-1.5"
              >
                Read documentation
                <ArrowRight size={14} weight="bold" />
              </Link>
            </div>
          </div>

          {/* Right: anchor numbers */}
          <div className="lg:col-span-5 mt-20 lg:mt-3 lg:border-l lg:border-slate-200 lg:pl-12">
            <div>
              <p className="font-mono text-[10px] tracking-[0.18em] text-brand-500 uppercase">
                Network state
              </p>
              <p className="mt-8 text-[5.5rem] lg:text-[7.5rem] leading-none tracking-tight text-slate-900 tabular-nums font-medium">
                {totalSales !== null ? (
                  <CountUp value={totalSales} pad={2} />
                ) : (
                  "—"
                )}
              </p>
              <p className="mt-3 text-sm text-slate-500">
                sales settled to date
              </p>
              <div className="mt-10">
                <CipherGrid />
              </div>
            </div>

            <dl className="mt-16 space-y-7 border-t border-slate-200 pt-8">
              <div>
                <dt className="font-mono text-[10px] tracking-[0.18em] text-slate-400 uppercase">
                  Network
                </dt>
                <dd className="mt-1.5 text-sm text-slate-900">Sepolia</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] tracking-[0.18em] text-slate-400 uppercase">
                  Factory
                </dt>
                <dd className="mt-1.5 text-sm text-slate-900 font-mono">
                  {factoryShort}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
