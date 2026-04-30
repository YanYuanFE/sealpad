import { Lock } from "@phosphor-icons/react";

const items = [
  { addr: "0xAb..cD3f", sale: "#3", glyphs: "▓▓▓▓▓▓▓▓" },
  { addr: "0x7f..1e2a", sale: "#1", glyphs: "▓▓▓▓▓▓" },
  { addr: "0xC4..b9d5", sale: "#2", glyphs: "▓▓▓▓▓▓▓" },
  { addr: "0x12..89fe", sale: "#0", glyphs: "▓▓▓▓▓▓▓▓▓" },
  { addr: "0xEa..3a1c", sale: "#4", glyphs: "▓▓▓▓▓▓" },
  { addr: "0x5d..7b80", sale: "#3", glyphs: "▓▓▓▓▓▓▓▓" },
  { addr: "0x99..02af", sale: "#2", glyphs: "▓▓▓▓▓" },
  { addr: "0x3e..f1c2", sale: "#1", glyphs: "▓▓▓▓▓▓▓" },
];

/**
 * Auto-scrolling horizontal feed of "encrypted" bid events.
 * Pure CSS scroll, no JS/RAF needed.
 */
export function EncryptedTicker() {
  return (
    <div className="relative overflow-hidden border-y border-slate-200 bg-white py-3 group">
      {/* fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-10" />

      <div className="ticker-track flex gap-12 whitespace-nowrap font-mono text-xs text-slate-500">
        {[...items, ...items, ...items].map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            <span className="text-slate-700">{item.addr}</span>
            <span className="text-slate-400">bid</span>
            <span className="inline-flex items-center gap-1 text-slate-300">
              <Lock size={10} weight="fill" />
              {item.glyphs}
            </span>
            <span className="text-slate-400">on Sale {item.sale}</span>
          </span>
        ))}
      </div>

      <style>{`
        .ticker-track {
          animation: ticker-scroll 50s linear infinite;
        }
        .group:hover .ticker-track {
          animation-play-state: paused;
        }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-33.33%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track { animation: none; }
        }
      `}</style>
    </div>
  );
}
