import { useCallback, useEffect, useRef, useState } from "react";

type Mode = "settle" | "live";
type Trigger = "mount" | "viewport" | "hover";

type Props = {
  /** Final text to display (also the static fallback for reduced-motion users). */
  text: string;
  /** "settle" — scramble then reveal once. "live" — keep cycling forever (encrypted look). */
  mode?: Mode;
  /** When to kick off the settle animation. */
  trigger?: Trigger;
  /** Total settle duration in ms. */
  duration?: number;
  /** Live-mode update interval in ms. */
  speed?: number;
  /** Delay (ms) before settle starts, useful for staggering multiple lines. */
  delay?: number;
  /** Pool of glyphs to draw random chars from. */
  scrambleChars?: string;
  className?: string;
};

const DEFAULT_CHARS = "▓░█◆◇▢◯X$#@01ABCDEF";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrambleString(
  text: string,
  chars: string,
  revealedCount = 0,
): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (i < revealedCount) {
      out += ch;
    } else if (ch === " " || ch === "\n") {
      out += ch;
    } else {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return out;
}

export function ScrambleText({
  text,
  mode = "settle",
  trigger = "mount",
  duration = 1200,
  speed = 70,
  delay = 0,
  scrambleChars = DEFAULT_CHARS,
  className,
}: Props) {
  const [display, setDisplay] = useState(() =>
    mode === "settle" ? scrambleString(text, scrambleChars) : text,
  );
  const ref = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live mode — cycle chars at fixed interval
  useEffect(() => {
    if (mode !== "live") return;
    if (prefersReducedMotion()) {
      setDisplay(text);
      return;
    }
    const id = setInterval(() => {
      setDisplay(scrambleString(text, scrambleChars));
    }, speed);
    return () => clearInterval(id);
  }, [mode, text, speed, scrambleChars]);

  const runSettle = useCallback(() => {
    if (prefersReducedMotion()) {
      setDisplay(text);
      return;
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - start) / duration, 1);
      if (t >= 1) {
        setDisplay(text);
        rafRef.current = null;
        return;
      }
      const revealed = Math.floor(t * text.length);
      setDisplay(scrambleString(text, scrambleChars, revealed));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [text, duration, scrambleChars]);

  // Settle mode — trigger-based start
  useEffect(() => {
    if (mode !== "settle") return;
    const startWithDelay = () => {
      timeoutRef.current = setTimeout(runSettle, delay);
    };

    if (trigger === "mount") {
      startWithDelay();
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    if (trigger === "viewport") {
      const el = ref.current;
      if (!el) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            startWithDelay();
            observer.disconnect();
          }
        },
        { threshold: 0.2 },
      );
      observer.observe(el);
      return () => {
        observer.disconnect();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mode, trigger, delay, runSettle]);

  return (
    <span
      ref={ref}
      className={className}
      onMouseEnter={
        mode === "settle" && trigger === "hover" ? runSettle : undefined
      }
      style={{ whiteSpace: "pre-wrap" }}
    >
      {display}
    </span>
  );
}
