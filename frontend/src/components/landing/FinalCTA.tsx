import { Link } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";
import { Reveal } from "./shared/Reveal";

export function FinalCTA() {
  return (
    <section className="bg-canvas border-t border-slate-200">
      <div className="mx-auto max-w-5xl px-6 md:px-8 py-32 lg:py-48 text-center">
        <Reveal>
          <p className="font-mono text-[11px] tracking-[0.18em] text-brand-500 uppercase">
            Get started
          </p>
          <h2 className="mt-10 text-4xl md:text-5xl lg:text-[4rem] leading-[1.02] tracking-tight text-slate-900 font-medium">
            Confidential by default.
          </h2>
          <p className="mt-8 max-w-prose mx-auto text-lg text-slate-600 leading-relaxed">
            Launch a sale or browse what's live. Sepolia testnet only — no
            mainnet capital at stake.
          </p>
          <div className="mt-12 flex justify-center items-center gap-8 flex-wrap">
            <Link
              to="/app"
              className="bg-slate-900 hover:bg-slate-800 text-white px-7 py-3.5 transition-colors text-sm font-medium tracking-tight"
            >
              Launch dashboard
            </Link>
            <Link
              to="/app/docs"
              className="text-sm text-slate-700 hover:text-brand-600 transition-colors inline-flex items-center gap-1.5"
            >
              Read documentation
              <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
