import { Link } from "react-router-dom";
import {
  Rocket,
  Notebook,
  Users,
  ChartBar,
  Code,
  Shield,
  Flag,
  Lock,
  CaretRight,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import { Reveal } from "./shared/Reveal";

type IconType = ComponentType<{
  size?: number;
  weight?: "bold" | "fill" | "regular";
}>;

type Item = { Icon: IconType; t: string };

const projectItems: Item[] = [
  { Icon: Users, t: "Quality community without sniper bots" },
  { Icon: ChartBar, t: "Multiple auction modes (Fixed Price + Dutch)" },
  { Icon: Code, t: "Verified FHE smart-contract templates" },
];

const investorItems: Item[] = [
  { Icon: Shield, t: "MEV-proof submission & execution" },
  { Icon: Flag, t: "No front-running on your orders" },
  { Icon: Lock, t: "On-chain privacy without the hassle" },
];

export function AudienceSplit() {
  return (
    <section className="bg-white border-y border-slate-200">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
        <Reveal direction="left">
          <AudienceCol
            Icon={Rocket}
            title="For Project Teams"
            subtitle="Protect your token value from day one"
            items={projectItems}
            cta="START FUNDRAISING"
            href="/app/create"
          />
        </Reveal>
        <Reveal direction="right" delay={150}>
          <AudienceCol
            Icon={Notebook}
            title="For Investors"
            subtitle="Hide your positions from copy-traders"
            items={investorItems}
            cta="EXPLORE LAUNCHES"
            href="/app"
          />
        </Reveal>
      </div>
    </section>
  );
}

function AudienceCol({
  Icon,
  title,
  subtitle,
  items,
  cta,
  href,
}: {
  Icon: IconType;
  title: string;
  subtitle: string;
  items: Item[];
  cta: string;
  href: string;
}) {
  return (
    <div className="p-12 lg:p-16">
      <div className="w-16 h-16 rounded-lg bg-slate-900 text-brand-300 grid place-items-center mb-8">
        <Icon size={28} weight="bold" />
      </div>
      <h3 className="text-3xl font-semibold text-slate-900">{title}</h3>
      <p className="text-slate-600 mt-2">{subtitle}</p>
      <ul className="mt-8 space-y-4">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-3 text-slate-700">
            <span className="text-brand-600 shrink-0">
              <it.Icon size={18} weight="bold" />
            </span>
            <span>{it.t}</span>
          </li>
        ))}
      </ul>
      <Link
        to={href}
        className="inline-flex items-center gap-1 mt-10 font-mono text-xs tracking-widest text-brand-600 hover:text-brand-700 transition-colors"
      >
        {cta}
        <CaretRight size={12} weight="bold" />
      </Link>
    </div>
  );
}
