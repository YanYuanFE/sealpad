import { Link } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";
import { Reveal } from "./shared/Reveal";

const projectPoints = [
  "Bidder strategy stays opaque to copy-traders and sniper bots.",
  "Two clearing modes — Fixed price and sealed-bid Dutch auction.",
  "Audited FHE primitives, EIP-1167 clones for storage isolation.",
];

const investorPoints = [
  "MEV-proof submission. The mempool sees ciphertext, not order flow.",
  "Re-bid without an on-chain trail. Only the ciphertext changes.",
  "On-chain privacy without trusting an off-chain coordinator.",
];

export function AudienceSplit() {
  return (
    <section className="bg-white border-t border-slate-200">
      <div className="mx-auto max-w-7xl">
        <div className="md:grid md:grid-cols-2 md:divide-x md:divide-slate-200">
          <Reveal direction="left">
            <AudienceCol
              eyebrow="For project teams"
              title="Launch to a quality audience."
              subtitle="A confidential sale tells your community you take their strategy seriously — and forces snipers to leave you alone."
              points={projectPoints}
              cta="Start a launch"
              href="/app/create"
            />
          </Reveal>
          <Reveal direction="right" delay={150}>
            <AudienceCol
              eyebrow="For investors"
              title="Hide your positions."
              subtitle="Bid for what you actually want, not what you can afford to telegraph. The clearing price is public; your size never has to be."
              points={investorPoints}
              cta="Browse live sales"
              href="/app"
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function AudienceCol({
  eyebrow,
  title,
  subtitle,
  points,
  cta,
  href,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  points: string[];
  cta: string;
  href: string;
}) {
  return (
    <div className="px-6 md:px-10 lg:px-16 py-20 lg:py-32">
      <p className="font-mono text-[11px] tracking-[0.18em] text-brand-500 uppercase">
        {eyebrow}
      </p>
      <h3 className="mt-8 text-3xl lg:text-4xl tracking-tight text-slate-900 font-medium leading-[1.1]">
        {title}
      </h3>
      <p className="mt-6 max-w-prose text-slate-600 leading-relaxed">
        {subtitle}
      </p>
      <ul className="mt-10 space-y-4 border-t border-slate-200 pt-6">
        {points.map((p, i) => (
          <li
            key={i}
            className="flex gap-4 text-sm text-slate-700 leading-relaxed"
          >
            <span className="font-mono text-[11px] text-slate-400 tabular-nums tracking-[0.18em] shrink-0 pt-1">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <Link
        to={href}
        className="mt-12 inline-flex items-center gap-1.5 text-sm text-slate-700 hover:text-brand-600 transition-colors"
      >
        {cta}
        <ArrowRight size={14} weight="bold" />
      </Link>
    </div>
  );
}
