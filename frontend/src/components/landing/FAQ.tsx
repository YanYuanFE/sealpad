import { useState, useRef, useEffect } from "react";
import { Plus, Minus } from "@phosphor-icons/react";
import { Reveal } from "./shared/Reveal";

const faqs = [
  {
    q: "How is this different from Zero-Knowledge Proofs?",
    a: "ZKPs prove a statement is true without revealing inputs. FHE goes further — it lets a smart contract perform math (add, sub, min, comparisons) directly on encrypted data without ever decrypting. SealPad uses FHE so the contract itself never sees individual bid amounts.",
  },
  {
    q: "Can the project team see the bids?",
    a: "No. Bids are FHE-encrypted in the user's browser before being sent on-chain. The project team, MEV bots, validators, and other participants cannot read individual contributions. Only the final aggregate (total raised, clearing price) is decrypted by the KMS after the sale ends.",
  },
  {
    q: "Why is the deposit amount public?",
    a: "The deposit is your collateral upper bound — it caps your maximum contribution. Making it public costs no privacy because it's not your actual bid. Your encrypted bid is later FHE.min-clamped to this cap.",
  },
  {
    q: "Can I update my bid after submission?",
    a: "Yes — and crucially, no funds move when you do. Only the encrypted ciphertext is updated. There is zero on-chain trace of your bid revisions, which is impossible to achieve with a traditional Launchpad.",
  },
  {
    q: "What happens if the soft cap is not reached?",
    a: "The sale is marked Failed. All deposits become immediately withdrawable in full, and the project recovers its locked sale tokens.",
  },
  {
    q: "Is SealPad live on mainnet?",
    a: "Currently deployed on Sepolia testnet only as a Zama Developer Program submission. Mainnet deployment requires further auditing.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-32 px-6 md:px-8 bg-white">
      <div className="max-w-3xl mx-auto">
        <Reveal>
          <h2 className="font-display text-5xl text-center text-slate-900 mb-4">Queries</h2>
          <p className="text-center font-mono text-xs tracking-widest text-brand-600 mb-16">
            FREQUENTLY ASKED
          </p>
        </Reveal>

        <div className="space-y-4">
          {faqs.map((f, i) => (
            <Reveal key={i} delay={i * 80}>
              <FAQItem
                q={f.q}
                a={f.a}
                isOpen={open === i}
                onToggle={() => setOpen(open === i ? null : i)}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({
  q,
  a,
  isOpen,
  onToggle,
}: {
  q: string;
  a: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState(0);

  useEffect(() => {
    if (!contentRef.current) return;
    setMaxHeight(isOpen ? contentRef.current.scrollHeight : 0);
  }, [isOpen, a]);

  return (
    <div
      className={`border rounded-xl overflow-hidden bg-white transition-colors ${
        isOpen ? "border-brand-300 shadow-sm" : "border-slate-200"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center gap-6 p-6 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-900">{q}</span>
        <span
          className={`text-brand-500 shrink-0 transition-transform duration-300 ${
            isOpen ? "rotate-180" : "rotate-0"
          }`}
        >
          {isOpen ? <Minus size={20} weight="bold" /> : <Plus size={20} weight="bold" />}
        </span>
      </button>
      <div
        style={{ maxHeight: `${maxHeight}px` }}
        className="overflow-hidden transition-[max-height] duration-400 ease-out"
      >
        <div ref={contentRef} className="px-6 pb-6 text-slate-600 leading-relaxed">
          {a}
        </div>
      </div>
    </div>
  );
}
