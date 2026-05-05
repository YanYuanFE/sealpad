import { useEffect, useState } from "react";

type Props = {
  value: number;
  duration?: number;
  /// pad with leading zeros to this width
  pad?: number;
};

/// One-shot animated count-up from 0 to `value`, with quart-out easing.
/// Used in the hero so the network state number animates in on load
/// instead of just popping into place. No looping, no bounce.
///
/// Re-runs whenever `value` or `duration` change (including the
/// StrictMode dev-mode remount), driven by useEffect deps; no extra
/// "started" guard is needed.
export function CountUp({ value, duration = 1400, pad = 0 }: Props) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.floor(eased * value));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{String(display).padStart(pad, "0")}</>;
}
