import { GithubLogo } from "@phosphor-icons/react";
import { LogoMark } from "@/components/LogoMark";

const cols = [
  {
    title: "PROTOCOL",
    links: [
      { label: "How It Works", href: "#flow" },
      { label: "Privacy Model", href: "#protocol" },
      { label: "Architecture", href: "#architecture" },
      { label: "Launchpad", href: "/app" },
    ],
  },
  {
    title: "RESOURCES",
    links: [
      { label: "Documentation", href: "/app/docs" },
      {
        label: "GitHub",
        href: "https://github.com/YanYuanFE/sealpad",
        external: true,
      },
      { label: "Zama Docs", href: "https://docs.zama.org", external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="pt-24 pb-12 px-6 md:px-8 bg-slate-50 border-t border-slate-200">
      <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <LogoMark size={32} />
            <span className="font-bold tracking-wider text-slate-900">
              SEALPAD
            </span>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
            Confidential token sales on FHEVM.
            <br />
            Sealed bids, uniform clearing, no on-chain trace.
          </p>
          <a
            href="https://github.com/YanYuanFE/sealpad"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-slate-700 hover:text-brand-600 transition-colors"
          >
            <GithubLogo size={18} />
            <span className="text-sm">GitHub</span>
          </a>
        </div>

        {cols.map((c) => (
          <FooterCol key={c.title} title={c.title} links={c.links} />
        ))}
      </div>
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-200 flex flex-wrap justify-between gap-4 font-mono text-[11px] tracking-[0.12em] text-slate-500">
        <span>© 2026 SealPad</span>
        <div className="flex gap-6 flex-wrap">
          <span>Built on Zama FHEVM</span>
          <span>Sepolia</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <h5 className="font-mono text-xs tracking-widest text-slate-500 mb-4">
        {title}
      </h5>
      <ul className="space-y-3 text-slate-700 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noopener noreferrer" : undefined}
              className="hover:text-brand-600 transition-colors"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
