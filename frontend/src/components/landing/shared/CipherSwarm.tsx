import { useEffect, useRef } from "react";

type Color = "empty" | "sealed" | "hot";

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: Color;
  rotation: number;
  rotationSpeed: number;
};

// rgba prefixes — alpha appended at draw time so each particle's depth
// translates directly into opacity.
const RGBA: Record<Color, string> = {
  empty: "229, 231, 235", // slate-200
  sealed: "24, 24, 24", // slate-900
  hot: "255, 81, 0", // brand-500
};

const COUNT = 80;
// z range: -Z_RANGE (far) … +Z_RANGE (near). Used both for projection and
// the wrap-around when a particle drifts past the boundary.
const Z_RANGE = 420;

function pickColor(): Color {
  const r = Math.random();
  if (r < 0.1) return "hot"; // ~10%
  if (r < 0.28) return "sealed"; // ~18%
  return "empty"; // ~72%
}

/// Hero background swarm — small "cipher block" particles drifting in a
/// pseudo-3D field. Depth is faked: a particle's z controls its scale and
/// opacity (back = small + faint, near = larger + denser). Three colors
/// mirror the CipherGrid metaphor (empty / sealed / hot). Designed to read
/// as institutional ambient, not loud — 80% slate-200, slow drift, no
/// pulsing, no sudden state changes.
///
/// Pure Canvas 2D, zero deps. Respects prefers-reduced-motion by rendering
/// one static frame and bailing out of the animation loop.
export function CipherSwarm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const particles: Particle[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      z: Math.random() * 2 * Z_RANGE - Z_RANGE,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      vz: (Math.random() - 0.5) * 0.35,
      size: 5 + Math.random() * 22,
      color: pickColor(),
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.0035,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      // Sort back-to-front so near particles overlap far ones correctly.
      particles.sort((a, b) => a.z - b.z);

      for (const p of particles) {
        const t = (p.z + Z_RANGE) / (2 * Z_RANGE); // 0 = far, 1 = near
        const scale = 0.35 + t * 0.85;
        const baseAlpha =
          p.color === "hot" ? 0.85 : p.color === "sealed" ? 0.65 : 0.5;
        const alpha = baseAlpha * (0.2 + t * 0.8);
        const s = p.size * scale;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = `rgba(${RGBA[p.color]}, ${alpha.toFixed(3)})`;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
    };

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let raf = 0;

    const tick = () => {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        p.rotation += p.rotationSpeed;

        if (p.x < -40) p.x = width + 40;
        else if (p.x > width + 40) p.x = -40;
        if (p.y < -40) p.y = height + 40;
        else if (p.y > height + 40) p.y = -40;
        if (p.z < -Z_RANGE) p.z = Z_RANGE;
        else if (p.z > Z_RANGE) p.z = -Z_RANGE;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    if (reduced) {
      draw();
    } else {
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
