import { Reveal } from "./shared/Reveal";

const phases = [
  {
    n: "01",
    title: "Active",
    desc: "Users deposit pay-token (the public upper bound) and submit FHE-encrypted contributions or bids. Updates leak no on-chain trace.",
  },
  {
    n: "02",
    title: "Finalizing",
    desc: "Anyone calls requestFinalize after endTime. After a 95-block reorg-safety window, anyone calls finalize to publish the encrypted handles for KMS to decrypt.",
  },
  {
    n: "03",
    title: "Settled",
    desc: "KMS produces signed cleartext. Anyone submits settleFixed or settleDutch with the proof; the contract verifies, then writes allocations and clearing price.",
  },
  {
    n: "04",
    title: "Claim",
    desc: "Vested sale tokens via claim. Unspent pay-token via withdrawDeposit. Both are pull-based; the contract never moves funds without a signature.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="flow" className="bg-canvas border-t border-slate-200">
      <div className="mx-auto max-w-7xl px-6 md:px-8 py-32 lg:py-40">
        <Reveal>
          <div className="lg:max-w-3xl">
            <p className="font-mono text-[11px] tracking-[0.18em] text-brand-500 uppercase">
              Lifecycle
            </p>
            <h2 className="mt-10 text-4xl md:text-5xl lg:text-[3.5rem] leading-[1.05] tracking-tight text-slate-900 font-medium">
              From creation to claim.
            </h2>
            <p className="mt-8 max-w-prose text-lg text-slate-600 leading-relaxed">
              Every sale moves through four phases. The split between finalize
              and settle reflects FHEVM's two-step decryption: ciphertexts are
              marked publicly decryptable on-chain, then the KMS proof is
              verified before settlement math runs.
            </p>
          </div>
        </Reveal>

        <div className="mt-20 lg:mt-24 grid md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-10">
          {phases.map((p, i) => (
            <Reveal key={p.n} delay={i * 100} direction="up">
              <div>
                <span className="font-mono text-[11px] tracking-[0.18em] text-slate-400 tabular-nums">
                  {p.n}
                </span>
                <div className="mt-4 h-px bg-slate-200" />
                <h3 className="mt-6 text-xl font-medium text-slate-900 tracking-tight">
                  {p.title}
                </h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  {p.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
