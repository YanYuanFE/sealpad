import { Reveal } from "./shared/Reveal";

const layers = [
  {
    n: "01",
    title: "FHE primitives",
    desc: "euint64 ciphertexts, FHE.add / FHE.min / FHE.makePubliclyDecryptable. Bid arithmetic happens directly on encrypted operands; the contract never sees plaintext.",
  },
  {
    n: "02",
    title: "Zama fhEVM coprocessor",
    desc: "Off-chain coprocessor performs the encrypted computation. ACL-gated handles ensure only the vault and KMS can request decryption.",
  },
  {
    n: "03",
    title: "KMS threshold decryption",
    desc: "After finalize(), KMS produces signed cleartext for the handles the protocol declared publicly decryptable. FHE.checkSignatures verifies on-chain before settlement math runs.",
  },
  {
    n: "04",
    title: "Solidity 0.8.27 · EIP-1167",
    desc: "Each sale lives in its own minimal-proxy clone. ReentrancyGuard, viaIR, cancun. Storage isolation per vault.",
  },
];

export function TechSection() {
  return (
    <section
      id="architecture"
      className="bg-white border-t border-slate-200 relative overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-8 py-32 lg:py-40 relative">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16">
          <Reveal direction="left" className="lg:col-span-5">
            <p className="font-mono text-[11px] tracking-[0.18em] text-brand-500 uppercase">
              Architecture
            </p>
            <h2 className="mt-10 text-4xl md:text-5xl lg:text-[3.5rem] leading-[1.05] tracking-tight text-slate-900 font-medium">
              Four layers.
              <br />
              No surprises.
            </h2>
            <p className="mt-8 max-w-prose text-lg text-slate-600 leading-relaxed">
              SealPad sits between Ethereum's settlement and Zama's encrypted
              compute. Every layer below is auditable on-chain or in published
              cryptographic specifications.
            </p>
          </Reveal>

          <Reveal
            direction="right"
            delay={150}
            className="lg:col-span-7 mt-16 lg:mt-2"
          >
            <ol className="divide-y divide-slate-200 border-y border-slate-200">
              {layers.map((l) => (
                <li key={l.n} className="grid grid-cols-12 gap-6 py-7 lg:py-8">
                  <div className="col-span-2 lg:col-span-1">
                    <span className="font-mono text-[11px] tracking-[0.18em] text-slate-400 tabular-nums">
                      {l.n}
                    </span>
                  </div>
                  <div className="col-span-10 lg:col-span-11">
                    <h3 className="text-base font-medium text-slate-900 tracking-tight">
                      {l.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                      {l.desc}
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
