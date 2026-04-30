import { useRef } from "react";
import type { ReactNode, MouseEvent } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** 0..1 — fraction of the cursor offset translated. */
  strength?: number;
  /** px — cursor influence radius. */
  range?: number;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Wraps a child element so it gets gently pulled toward the cursor
 * when the pointer is within `range`px.
 */
export function MagneticArea({
  children,
  className,
  strength = 0.35,
  range = 90,
}: Props) {
  const innerRef = useRef<HTMLSpanElement>(null);

  const onMouseMove = (e: MouseEvent<HTMLSpanElement>) => {
    if (prefersReducedMotion()) return;
    const el = innerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > range) {
      el.style.transform = "translate3d(0,0,0)";
      return;
    }
    const factor = (1 - dist / range) * strength;
    el.style.transform = `translate3d(${dx * factor}px, ${dy * factor}px, 0)`;
  };

  const onMouseLeave = () => {
    const el = innerRef.current;
    if (el) el.style.transform = "translate3d(0,0,0)";
  };

  return (
    <span
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={className}
      style={{ display: "inline-block" }}
    >
      <span
        ref={innerRef}
        style={{
          display: "inline-block",
          transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "transform",
        }}
      >
        {children}
      </span>
    </span>
  );
}
