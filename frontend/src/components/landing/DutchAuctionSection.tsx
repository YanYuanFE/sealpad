import { Reveal } from "./shared/Reveal";

const steps = [
  {
    n: "01",
    title: "Bidder picks a price",
    desc: "Any price ≥ the creator's floor. The price is public; the amount you commit at that price is encrypted.",
  },
  {
    n: "02",
    title: "Encrypted commitment",
    desc: "An FHE-clamped amount, capped by your public deposit. Updates leak no on-chain trace — only the ciphertext changes.",
  },
  {
    n: "03",
    title: "Bids sort at settlement",
    desc: "After endTime, bids are processed highest-to-lowest. The lowest accepted price becomes the uniform clearing price.",
  },
  {
    n: "04",
    title: "One price for everyone",
    desc: "Bidders above the clearing pay the same uniform price. The unspent deposit stays withdrawable.",
  },
];

export function DutchAuctionSection() {
  return (
    <section id="launchpad" className="bg-cloud border-t border-slate-200">
      <div className="mx-auto max-w-7xl px-6 md:px-8 py-32 lg:py-40">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16">
          <Reveal direction="left" className="lg:col-span-5">
            <p className="font-mono text-[11px] tracking-[0.18em] text-brand-500 uppercase">
              Dutch auction
            </p>
            <h2 className="mt-10 text-4xl md:text-5xl lg:text-[3.5rem] leading-[1.05] tracking-tight text-slate-900 font-medium">
              Sealed bids.
              <br />
              Uniform clearing.
            </h2>
            <p className="mt-8 max-w-prose text-lg text-slate-600 leading-relaxed">
              A confidential variant of the classic Dutch auction. Public price,
              encrypted volume. The market clears at a single uniform price;
              nobody overpays.
            </p>
          </Reveal>

          <Reveal
            direction="right"
            delay={150}
            className="lg:col-span-7 mt-16 lg:mt-2"
          >
            <ol className="divide-y divide-slate-200 border-y border-slate-200">
              {steps.map((s) => (
                <li key={s.n} className="grid grid-cols-12 gap-6 py-7 lg:py-8">
                  <div className="col-span-2 lg:col-span-1">
                    <span className="font-mono text-[11px] tracking-[0.18em] text-slate-400 tabular-nums">
                      {s.n}
                    </span>
                  </div>
                  <div className="col-span-10 lg:col-span-11">
                    <h3 className="text-base font-medium text-slate-900 tracking-tight">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
