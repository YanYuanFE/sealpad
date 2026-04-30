import type { ReactNode } from "react";
import { useScrollReveal } from "./useScrollReveal";

type Direction = "up" | "down" | "left" | "right" | "scale" | "fade";

type Props = {
  children: ReactNode;
  /** Stagger delay in ms. */
  delay?: number;
  /** Direction the element travels in from. */
  direction?: Direction;
  /** Duration in ms. */
  duration?: number;
  className?: string;
  threshold?: number;
};

const initialClasses: Record<Direction, string> = {
  up: "opacity-0 translate-y-6",
  down: "opacity-0 -translate-y-6",
  left: "opacity-0 -translate-x-6",
  right: "opacity-0 translate-x-6",
  scale: "opacity-0 scale-95",
  fade: "opacity-0",
};

const visibleClasses = "opacity-100 translate-x-0 translate-y-0 scale-100";

export function Reveal({
  children,
  delay = 0,
  direction = "up",
  duration = 700,
  className = "",
  threshold = 0.15,
}: Props) {
  const [ref, visible] = useScrollReveal<HTMLDivElement>({ threshold });
  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
        transitionDuration: `${duration}ms`,
        willChange: "transform, opacity",
      }}
      className={`transition-all ease-out ${
        visible ? visibleClasses : initialClasses[direction]
      } ${className}`}
    >
      {children}
    </div>
  );
}
