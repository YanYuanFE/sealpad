import { Reveal } from "./shared/Reveal";
import { ScrambleText } from "./shared/ScrambleText";

const flowSteps = [
  {
    n: "01",
    title: "Encrypted Entry",
    desc: "User bids are encrypted locally before submission. The network only ever sees ciphertext.",
  },
  {
    n: "02",
    title: "The Zama FHE Engine",
    desc: "Smart contracts perform mathematical operations (+, −, min) directly on encrypted bids. Clearing price and allocation are computed without the contract or any validator knowing the individual values.",
    featured: true,
  },
  {
    n: "03",
    title: "Blind Tallying",
    desc: "Demand curves are constructed in the ciphertext space. True price discovery occurs in total darkness.",
  },
  {
    n: "04",
    title: "Atomic Settlement",
    desc: "Once the auction concludes, KMS-decrypted aggregates trigger token distribution and refunds — all on-chain.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="flow" className="py-32 px-6 md:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <Reveal>
          <h2 className="font-display text-5xl text-slate-900 mb-4">Confidential Flow</h2>
          <p className="text-slate-600 max-w-3xl mb-6">
            Powered by Zama's Fully Homomorphic Encryption, computations happen on
            encrypted data without ever needing to decrypt it.
          </p>
          <div className="font-mono text-xs text-brand-600 mb-12 inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
            SECURE COMPUTATION ACTIVE
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-6">
          {flowSteps.map((s, i) => (
            <Reveal key={s.n} delay={i * 100} direction={i % 2 === 0 ? "left" : "right"}>
              <div
                className={`p-8 rounded-xl border h-full ${
                  s.featured
                    ? "bg-slate-900 text-white border-slate-700 md:row-span-2 relative overflow-hidden"
                    : "bg-white border-slate-200"
                }`}
              >
                {s.featured && (
                  <div
                    className="pointer-events-none absolute inset-0 opacity-30"
                    style={{
                      background:
                        "radial-gradient(circle at 70% 20%, rgba(255,81,0,0.25), transparent 50%)",
                    }}
                  />
                )}
                <div
                  className={`relative font-mono text-2xl ${
                    s.featured ? "text-brand-300" : "text-brand-600"
                  }`}
                >
                  {s.n}
                </div>
                <h3
                  className={`relative mt-4 text-2xl font-bold ${
                    s.featured ? "text-white" : "text-slate-900"
                  }`}
                >
                  {s.featured ? (
                    <ScrambleText text={s.title} duration={1100} trigger="viewport" />
                  ) : (
                    s.title
                  )}
                </h3>
                <p
                  className={`relative mt-4 leading-relaxed ${
                    s.featured ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  {s.desc}
                </p>
                {s.featured && (
                  <div className="relative mt-6 flex gap-3 flex-wrap">
                    <span className="border border-brand-400 text-brand-300 font-mono text-[10px] tracking-widest px-3 py-1.5 rounded">
                      PRIVACY-PRESERVING EVM
                    </span>
                    <span className="border border-brand-400 text-brand-300 font-mono text-[10px] tracking-widest px-3 py-1.5 rounded">
                      ZERO LEAKAGE
                    </span>
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
