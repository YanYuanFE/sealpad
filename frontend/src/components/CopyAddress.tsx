import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";
import { toast } from "sonner";
import { shortenAddress } from "@/lib/constants";

type Props = {
  address: string;
  /** Pass false to render the full address instead of the truncated form. */
  truncate?: boolean;
  /** Optional override for the displayed text (e.g. ENS name). */
  display?: string;
  className?: string;
};

/**
 * Inline address chip that copies the full hex string to the clipboard
 * when clicked. Shows a brief check-mark confirmation on success.
 */
export function CopyAddress({
  address,
  truncate = true,
  display,
  className,
}: Props) {
  const [copied, setCopied] = useState(false);

  const text = display ?? (truncate ? shortenAddress(address) : address);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Click to copy ${address}`}
      aria-label={`Copy address ${address}`}
      className={`inline-flex items-center gap-1.5 font-mono text-xs text-slate-500 hover:text-slate-900 transition-colors group cursor-pointer ${
        className ?? ""
      }`}
    >
      <span>{text}</span>
      {copied ? (
        <Check size={12} weight="bold" className="text-brand-500" />
      ) : (
        <Copy
          size={12}
          weight="bold"
          className="opacity-40 group-hover:opacity-100 transition-opacity"
        />
      )}
    </button>
  );
}
