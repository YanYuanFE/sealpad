import { Link, Outlet, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { LogoMark } from "@/components/LogoMark";
import { NetworkBanner } from "@/components/NetworkBanner";
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_LABEL } from "@/lib/network";

const navItems = [
  { to: "/app", label: "Sales" },
  { to: "/app/create", label: "Create" },
  { to: "/app/my", label: "My Activity" },
  { to: "/app/docs", label: "Docs" },
];

export function Layout() {
  const location = useLocation();
  const { isConnected, chainId } = useAccount();
  const onCorrectChain = !isConnected || chainId === REQUIRED_CHAIN_ID;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5">
              <LogoMark size={32} />
              <span className="font-bold tracking-wider text-slate-900 text-sm">
                SEALPAD
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              {navItems.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`text-sm transition-colors ${
                      active
                        ? "text-brand-600 font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`hidden sm:inline-flex items-center gap-2 h-10 font-mono text-[10px] tracking-widest border px-3 rounded ${
                onCorrectChain
                  ? "text-brand-700 border-brand-200 bg-brand-50"
                  : "text-rose-700 border-rose-300 bg-rose-50"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  onCorrectChain ? "bg-brand-500" : "bg-rose-500 animate-pulse"
                }`}
              />
              {onCorrectChain
                ? REQUIRED_CHAIN_LABEL
                : `WRONG CHAIN · ${chainId}`}
            </span>
            <ConnectButton showBalance={false} chainStatus="none" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <NetworkBanner />
        <Outlet />
      </main>
    </div>
  );
}
