import { Reveal } from "./shared/Reveal";

/// Standalone historical-narrative beat between Hero and Features.
/// Saturn-style: one big centered quote, a mono CAPS sub-eyebrow underneath.
/// No CTAs, no dense info — this is a pacing moment.
export function NarrativeSection() {
  return (
    <section className="bg-cloud border-t border-b border-slate-200">
      <div className="mx-auto max-w-5xl px-6 md:px-8 py-32 lg:py-48 text-center">
        <Reveal direction="fade" duration={1100}>
          <h2 className="text-4xl md:text-6xl lg:text-7xl tracking-tight text-slate-900 font-medium leading-[1.08]">
            Public order books.
            <br />
            Then dark pools.
            <br />
            <span className="text-brand-500">Now FHE-native sales.</span>
          </h2>
        </Reveal>
        <Reveal direction="fade" delay={400}>
          <p className="mt-14 font-mono text-[10px] tracking-[0.22em] text-slate-500 uppercase">
            The third era of price discovery
          </p>
        </Reveal>
      </div>
    </section>
  );
}
