import { Link } from "react-router-dom";
import { Reveal } from "./shared/Reveal";
import { ScrambleText } from "./shared/ScrambleText";
import { MagneticArea } from "./shared/MagneticArea";

export function FinalCTA() {
  return (
    <section className="py-24 px-6 md:px-8">
      <Reveal direction="scale">
        <div className="max-w-7xl mx-auto bg-brand-500 py-20 md:py-24 px-6 text-center text-white relative overflow-hidden">
          {/* animated grid */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none animate-[drift_20s_linear_infinite]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.15) 1px,transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          {/* glow blob */}
          <div
            className="absolute -top-10 -right-10 w-72 h-72 rounded-full pointer-events-none opacity-30"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)",
            }}
          />

          <div className="relative">
            <h2 className="font-display text-5xl md:text-6xl leading-tight">
              <ScrambleText
                text="Secure your"
                duration={800}
                trigger="viewport"
              />
              <br />
              <ScrambleText
                text="launch today."
                duration={1000}
                trigger="viewport"
                delay={300}
              />
            </h2>
            <p className="mt-6 max-w-xl mx-auto text-white/90">
              Join the privacy revolution. Launch your token on the only
              platform that mathematically guarantees confidentiality.
            </p>
            <div className="mt-10 flex justify-center gap-4 flex-wrap">
              <MagneticArea>
                <Link
                  to="/app"
                  className="inline-flex bg-white text-slate-900 px-7 py-4 rounded font-semibold hover:bg-slate-100 transition-colors"
                >
                  Launch Dashboard
                </Link>
              </MagneticArea>
              <MagneticArea>
                <a
                  href="https://github.com/YanYuanFE/sealpad"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex bg-slate-900 text-white px-7 py-4 rounded font-semibold hover:bg-slate-800 transition-colors"
                >
                  Read Documentation
                </a>
              </MagneticArea>
            </div>
          </div>

          <style>{`
            @keyframes drift {
              from { background-position: 0 0; }
              to { background-position: 48px 48px; }
            }
            @media (prefers-reduced-motion: reduce) {
              [class*="animate-[drift"] { animation: none; }
            }
          `}</style>
        </div>
      </Reveal>
    </section>
  );
}
