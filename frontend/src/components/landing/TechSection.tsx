import { Reveal } from "./shared/Reveal";
import { ScrambleText } from "./shared/ScrambleText";

export function TechSection() {
  return (
    <section
      id="architecture"
      className="py-32 px-6 md:px-8 bg-slate-900 text-white relative overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 80% 50%, rgba(255,81,0,0.25), transparent 60%)",
        }}
      />

      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10">
        <Reveal direction="left">
          <div>
            <span className="inline-block border border-brand-400 text-brand-300 font-mono text-xs px-3 py-1.5 rounded">
              TECHNICAL STACK
            </span>
            <h2 className="font-display mt-8 text-5xl lg:text-6xl leading-tight">
              Cipher-Native
              <br />
              Infrastructure
            </h2>
            <p className="mt-8 text-slate-300 max-w-xl">
              SealPad operates at the intersection of Zama's fhEVM and
              Ethereum's security. We use{" "}
              <span className="text-brand-300 font-medium">
                "Blind Smart Contracts"
              </span>{" "}
              that process logic on hidden states without ever decrypting them.
            </p>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <TechBox
                title="Fully Homomorphic Encryption"
                desc="The 'Holy Grail' of cryptography. Compute without decrypting."
                delay={0}
              />
              <TechBox
                title="Zama fhEVM"
                desc="Privacy-first execution layer for the next generation of dApps."
                delay={100}
              />
              <TechBox
                title="KMS Threshold Decryption"
                desc="Aggregate values are revealed only after distributed-key signature verification."
                delay={200}
              />
              <TechBox
                title="Solidity 0.8.27"
                desc="Cancun EVM, viaIR enabled, ReentrancyGuard hardened."
                delay={300}
              />
            </div>
          </div>
        </Reveal>

        <Reveal direction="scale" delay={200}>
          <div className="relative aspect-square grid place-items-center">
            {/* concentric rings — outer rings rotate slowly in opposite directions */}
            <div className="absolute inset-0 rounded-full border border-brand-500/15 animate-[orbit-slow_60s_linear_infinite]" />
            <div className="absolute inset-8 rounded-full border border-brand-500/25 animate-[orbit-rev_45s_linear_infinite]" />
            <div className="absolute inset-16 rounded-full border border-brand-500/40 animate-[orbit-slow_30s_linear_infinite]" />
            <div className="absolute inset-24 rounded-full border border-brand-500/60 animate-[pulse-ring_3s_ease-in-out_infinite]" />

            {/* orbiting dots */}
            <div className="absolute inset-0 animate-[orbit-slow_18s_linear_infinite]">
              <span className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-brand-400 shadow-md shadow-brand-400/50" />
            </div>
            <div className="absolute inset-8 animate-[orbit-rev_22s_linear_infinite]">
              <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand-300" />
            </div>
            <div className="absolute inset-16 animate-[orbit-slow_14s_linear_infinite]">
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-500" />
            </div>

            {/* core */}
            <div className="bg-brand-500 text-slate-900 px-6 py-4 rounded-lg font-mono text-sm z-10 shadow-2xl shadow-brand-500/30 animate-[core-pulse_3s_ease-in-out_infinite]">
              <div className="font-bold tracking-wider">FHE CORE UNIT</div>
              <div className="text-xs opacity-70 mt-1">
                [ <ScrambleText text="01011101" mode="live" speed={140} /> ]
              </div>
              <div className="text-xs opacity-70">[ ENCRYPTED ]</div>
            </div>
          </div>
        </Reveal>
      </div>

      <style>{`
        @keyframes orbit-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbit-rev {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.04); }
        }
        @keyframes core-pulse {
          0%, 100% { box-shadow: 0 10px 40px -8px rgba(255, 81, 0, 0.4); }
          50% { box-shadow: 0 10px 60px 4px rgba(255, 81, 0, 0.55); }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="animate-[orbit"], [class*="animate-[pulse-ring"], [class*="animate-[core-pulse"] {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}

function TechBox({
  title,
  desc,
  delay = 0,
}: {
  title: string;
  desc: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} direction="up">
      <div className="p-5 bg-slate-800/60 rounded-lg border border-slate-700 backdrop-blur hover:border-brand-500/40 hover:bg-slate-800/80 transition-colors h-full">
        <h4 className="font-semibold text-brand-300">{title}</h4>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </Reveal>
  );
}
