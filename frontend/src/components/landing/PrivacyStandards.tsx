import { Reveal } from "./shared/Reveal";

const rows: [string, string, string][] = [
  ["Bid amounts", "Public from block 0", "FHE-encrypted (euint64)"],
  ["Volume signal", "Visible to MEV bots", "Aggregate stays encrypted"],
  ["Re-bid privacy", "Every revision visible", "No on-chain trace"],
  ["Clearing mechanism", "Pre-set by issuer", "Demand-driven, uniform"],
  ["Front-running", "Same-block exposed", "Ciphertext is opaque"],
];

export function PrivacyStandards() {
  return (
    <section className="bg-cloud border-t border-slate-200">
      <div className="mx-auto max-w-5xl px-6 md:px-8 py-32 lg:py-40">
        <Reveal>
          <div className="lg:max-w-3xl">
            <p className="font-mono text-[11px] tracking-[0.18em] text-brand-500 uppercase">
              Side by side
            </p>
            <h2 className="mt-10 text-4xl md:text-5xl lg:text-[3.5rem] leading-[1.05] tracking-tight text-slate-900 font-medium">
              How SealPad differs
              <br />
              from a public sale.
            </h2>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="mt-20 lg:mt-24 border-y border-slate-200">
            <div className="grid grid-cols-12 gap-4 py-5 font-mono text-[10px] tracking-[0.18em] text-slate-400 uppercase">
              <span className="col-span-4 lg:col-span-3" />
              <span className="col-span-4 lg:col-span-5">Public sale</span>
              <span className="col-span-4 lg:col-span-4 text-brand-500">
                SealPad
              </span>
            </div>
            <div className="divide-y divide-slate-200 border-t border-slate-200">
              {rows.map(([label, std, sp]) => (
                <div
                  key={label}
                  className="grid grid-cols-12 gap-4 py-7 items-baseline"
                >
                  <span className="col-span-4 lg:col-span-3 text-sm text-slate-500">
                    {label}
                  </span>
                  <span className="col-span-4 lg:col-span-5 text-sm text-slate-500">
                    {std}
                  </span>
                  <span className="col-span-4 lg:col-span-4 text-sm text-slate-900 font-medium">
                    {sp}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
