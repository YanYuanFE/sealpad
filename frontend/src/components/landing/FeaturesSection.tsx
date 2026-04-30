import { ArrowDown } from "@phosphor-icons/react";
import { Reveal } from "./shared/Reveal";

const problemPairs = [
  {
    bad: {
      title: "Public Bidding",
      desc: "Competitors see your entry size and price instantly, leading to front-running.",
    },
    good: {
      title: "Cipher Bids",
      desc: "Every bid is encrypted with FHE. Only the final clearing price is ever revealed.",
    },
  },
  {
    bad: {
      title: "Whale Tracking",
      desc: "Large positions are targeted by bots the moment they are recorded on-chain.",
    },
    good: {
      title: "Hidden Volume",
      desc: "Volume is computed in a black box. Aggregate demand stays dark until the auction ends.",
    },
  },
  {
    bad: {
      title: "MEV Extraction",
      desc: "Searchers extract value from your transactions before they even land in a block.",
    },
    good: {
      title: "MEV Shielding",
      desc: "Encrypted payloads prevent validators from seeing trade details, eliminating MEV.",
    },
  },
];

export function FeaturesSection() {
  return (
    <section id="protocol" className="py-32 px-6 md:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <Reveal>
          <div className="text-center mb-20">
            <h2 className="font-display text-5xl text-slate-900">The Privacy Problem</h2>
            <p className="mt-4 font-mono text-xs tracking-widest text-brand-600">
              STANDARD IDOS EXPOSE YOUR STRATEGY
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6">
          {problemPairs.map((p, i) => (
            <Reveal key={i} delay={i * 120}>
              <div className="flex flex-col gap-8">
                <ProblemCard tone="bad" {...p.bad} />
                <div className="flex justify-center text-brand-500 animate-bounce-slow">
                  <ArrowDown size={20} weight="bold" />
                </div>
                <ProblemCard tone="good" {...p.good} />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }
        .animate-bounce-slow { animation: bounce-slow 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .animate-bounce-slow { animation: none; }
        }
      `}</style>
    </section>
  );
}

function ProblemCard({
  tone,
  title,
  desc,
}: {
  tone: "bad" | "good";
  title: string;
  desc: string;
}) {
  const isBad = tone === "bad";
  return (
    <div
      className={`relative p-6 rounded-lg border transition-shadow hover:shadow-md ${
        isBad ? "bg-rose-50/40 border-rose-100" : "bg-brand-50/40 border-brand-100"
      }`}
    >
      <span
        className={`absolute top-4 right-4 w-6 h-6 rounded-full grid place-items-center text-white text-xs ${
          isBad ? "bg-rose-400" : "bg-brand-500"
        }`}
      >
        {isBad ? "✕" : "✓"}
      </span>
      <h3 className="font-semibold text-slate-900 pr-8">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{desc}</p>
    </div>
  );
}
