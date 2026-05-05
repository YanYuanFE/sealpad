import { Reveal } from "./shared/Reveal";

const guarantees = [
  {
    n: "01",
    title: "Cipher bids",
    desc: "Bids are FHE-encrypted in your browser. The vault contract, the project team, validators, and MEV searchers never see individual contributions — only the final aggregate is decrypted at settlement.",
  },
  {
    n: "02",
    title: "Hidden volume",
    desc: "Aggregate demand stays encrypted on-chain until the sale ends. Whales aren't tracked; sniper bots can't model the demand curve in real time.",
  },
  {
    n: "03",
    title: "Traceless updates",
    desc: "Re-bidding moves no funds. Only the ciphertext changes. There's no on-chain trail showing a user revised their position from 5 ETH to 12 ETH.",
  },
];

export function FeaturesSection() {
  return (
    <section id="protocol" className="bg-white border-t border-slate-200">
      <div className="mx-auto max-w-7xl px-6 md:px-8 py-32 lg:py-40">
        <Reveal>
          <div className="lg:max-w-3xl">
            <p className="font-mono text-[11px] tracking-[0.18em] text-brand-500 uppercase">
              What you get
            </p>
            <h2 className="mt-10 text-4xl md:text-5xl lg:text-[3.5rem] leading-[1.05] tracking-tight text-slate-900 font-medium">
              Three guarantees
              <br />
              public order books can't make.
            </h2>
          </div>
        </Reveal>

        <div className="mt-20 lg:mt-24 grid md:grid-cols-3 gap-12 lg:gap-16">
          {guarantees.map((g, i) => (
            <Reveal key={g.n} delay={i * 100} direction="up">
              <div>
                <span className="font-mono text-2xl text-slate-400 tabular-nums tracking-tight">
                  {g.n}
                </span>
                <div className="mt-6 h-px bg-slate-200" />
                <h3 className="mt-8 text-2xl font-medium text-slate-900 tracking-tight">
                  {g.title}
                </h3>
                <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                  {g.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
