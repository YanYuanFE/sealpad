import { Reveal } from "./shared/Reveal";

const standards: [string, string, string][] = [
  ["Bid Confidentiality", "None (Public)", "Full Encryption"],
  ["Front-running Protection", "Vulnerable", "Guaranteed"],
  ["MEV Resistance", "Optional / Costly", "Native Protocol"],
  ["Price Discovery", "Manipulated", "Pure Demand"],
  ["Re-bid Without Trace", "Impossible", "Ciphertext-only Update"],
];

export function PrivacyStandards() {
  return (
    <section className="py-32 px-6 md:px-8 relative bg-cloud">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="font-display text-5xl text-center text-slate-900 mb-4">
            Privacy Standards
          </h2>
          <p className="text-center font-mono text-xs tracking-widest text-brand-600 mb-16">
            FEATURE PARITY MATRIX
          </p>
        </Reveal>

        <Reveal direction="scale" delay={150}>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="grid grid-cols-3 px-6 md:px-8 py-5 font-mono text-xs tracking-widest text-slate-500 border-b border-slate-200 bg-slate-50">
              <span>FEATURE</span>
              <span>STANDARD IDO</span>
              <span>SEALPAD (FHE)</span>
            </div>
            {standards.map(([f, std, sp], i) => (
              <Reveal key={f} delay={i * 80} direction="left">
                <div
                  className={`grid grid-cols-3 px-6 md:px-8 py-6 items-center text-sm md:text-base ${
                    i < standards.length - 1 ? "border-b border-slate-100" : ""
                  } hover:bg-slate-50/60 transition-colors`}
                >
                  <span className="font-semibold text-slate-900">{f}</span>
                  <span className="text-rose-500 line-through decoration-rose-300">
                    {std}
                  </span>
                  <span className="text-brand-600 font-medium inline-flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-brand-500 text-white grid place-items-center text-xs">
                      ✓
                    </span>
                    {sp}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
