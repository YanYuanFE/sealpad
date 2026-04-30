import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
  /** Start animation only when scrolled into view. */
  startOnView?: boolean;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function CounterRollUp({
  value,
  duration = 1400,
  format = (n) => Math.round(n).toLocaleString(),
  className,
  startOnView = true,
}: Props) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }

    const start = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const startTime = performance.now();
      const tick = () => {
        const t = Math.min((performance.now() - startTime) / duration, 1);
        const eased = easeOutCubic(t);
        setDisplay(value * eased);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    if (!startOnView) {
      start();
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          start();
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, startOnView]);

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  );
}
