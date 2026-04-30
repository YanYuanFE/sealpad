import { Link } from "react-router-dom";
import { GithubLogo } from "@phosphor-icons/react";
import { LogoMark } from "@/components/LogoMark";

const links = [
  { href: "#protocol", label: "PROTOCOL" },
  { href: "#flow", label: "LAUNCHPAD" },
  { href: "#architecture", label: "ARCHITECTURE" },
  { href: "https://github.com/YanYuanFE/sealpad", label: "DOCS", external: true },
];

export function Navbar() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-20 px-6 md:px-8 flex items-center justify-between bg-white/80 backdrop-blur border-b border-slate-200">
      <Link to="/" className="flex items-center gap-3">
        <LogoMark size={36} />
        <span className="font-bold tracking-wider text-slate-900">SEALPAD</span>
      </Link>

      <ul className="hidden lg:flex items-center gap-10 font-mono text-xs tracking-widest text-slate-700">
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

      <div className="flex items-center gap-4">
        <a
          href="https://github.com/YanYuanFE/sealpad"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex text-slate-700 hover:text-brand-600 transition-colors"
          aria-label="GitHub"
        >
          <GithubLogo size={20} />
        </a>
        <Link
          to="/app"
          className="font-mono text-xs tracking-widest bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded transition-colors"
        >
          LAUNCH APP
        </Link>
      </div>
    </nav>
  );
}
