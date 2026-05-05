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
    a: "Yes — and crucially, no funds move when you do. Only the encrypted ciphertext is updated. There is zero on-chain trace of your bid revisions, which is impossible to achieve with a traditional launchpad.",
  },
  {
    q: "What happens if the soft cap is not reached?",
    a: "The sale is marked Failed. All deposits become immediately withdrawable in full, and the project recovers its locked sale tokens.",
  },
  {
    q: "Is SealPad live on mainnet?",
    a: "Currently deployed on Sepolia testnet only. Mainnet deployment requires further auditing.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-cloud border-t border-slate-200">
      <div className="mx-auto max-w-5xl px-6 md:px-8 py-32 lg:py-40">
        <Reveal>
          <div className="lg:max-w-3xl">
            <p className="font-mono text-[11px] tracking-[0.18em] text-brand-500 uppercase">
              Questions
            </p>
            <h2 className="mt-10 text-4xl md:text-5xl lg:text-[3.5rem] leading-[1.05] tracking-tight text-slate-900 font-medium">
              The shortlist.
            </h2>
          </div>
        </Reveal>

        <div className="mt-20 lg:mt-24 border-y border-slate-200">
          {faqs.map((f, i) => (
            <Reveal key={i} delay={i * 60}>
              <FAQItem
                q={f.q}
                a={f.a}
                isOpen={open === i}
                isLast={i === faqs.length - 1}
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
  isLast,
  onToggle,
}: {
  q: string;
  a: string;
  isOpen: boolean;
  isLast: boolean;
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
      className={`${isLast ? "" : "border-b border-slate-200"} ${
        isOpen ? "bg-white" : ""
      } transition-colors`}
    >
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-baseline gap-6 py-6 text-left hover:text-brand-600 transition-colors"
      >
        <span className="text-base lg:text-lg font-medium text-slate-900 tracking-tight">
          {q}
        </span>
        <span className="text-slate-400 shrink-0 self-center">
          {isOpen ? (
            <Minus size={16} weight="bold" />
          ) : (
            <Plus size={16} weight="bold" />
          )}
        </span>
      </button>
      <div
        style={{ maxHeight: `${maxHeight}px` }}
        className="overflow-hidden transition-[max-height] duration-400 ease-out"
      >
        <div
          ref={contentRef}
          className="pb-6 max-w-prose text-sm text-slate-600 leading-relaxed"
        >
          {a}
        </div>
      </div>
    </div>
  );
}
