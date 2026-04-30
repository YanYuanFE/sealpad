import { useEffect, useRef } from "react";

type Props = {
  /** 0..1 — fraction of columns spawning streams at any moment. */
  density?: number;
  /** Pixels per frame for falling speed. */
  speed?: number;
  /** Font size in px (also acts as column width). */
  fontSize?: number;
  /** RGB triple for the glyph color. Default = brand-500. */
  color?: string;
  /** RGB triple for the trailing fade. Default = slate-50 (matches Hero bg). */
  bgColor?: string;
  /** 0..1 — alpha applied each frame to fade prior chars. Smaller = longer trail. */
  fadeAlpha?: number;
  className?: string;
};

const GLYPHS = "▓░█◆◇▢◯X$#@01ABCDEF<>{}/\\";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Matrix-style falling character rain rendered to a Canvas. Pure Canvas 2D
 * + RAF, no dependencies. Disables itself when prefers-reduced-motion is set.
 */
export function HashStream({
  density = 0.5,
  speed = 1.2,
  fontSize = 14,
  color = "255,81,0",
  bgColor = "255,255,255",
  fadeAlpha = 0.06,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (prefersReducedMotion()) return;

    let raf = 0;
    let drops: number[] = [];
    const colWidth = fontSize;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.font = `${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textBaseline = "top";
      const cols = Math.floor(w / colWidth);
      drops = Array.from({ length: cols }, () =>
        Math.random() < density ? Math.random() * -h : -h - Math.random() * h,
      );
    };
    resize();

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const draw = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;

      // Trail fade — each frame paints a translucent layer over the canvas,
      // gradually erasing previous chars so they leave a fading streak.
      ctx.fillStyle = `rgba(${bgColor},${fadeAlpha})`;
      ctx.fillRect(0, 0, w, h);

      // Body color for falling glyphs
      ctx.fillStyle = `rgba(${color},0.55)`;

      for (let i = 0; i < drops.length; i++) {
        const y = drops[i];
        if (y > -fontSize && y < h + fontSize) {
          const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          ctx.fillText(ch, i * colWidth, y);
        }
        drops[i] += speed;
        if (drops[i] > h + 80) {
          // Random respawn delay so columns don't synchronize
          drops[i] = -Math.random() * h * 0.6 - fontSize;
        }
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [density, speed, fontSize, color, bgColor, fadeAlpha]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
