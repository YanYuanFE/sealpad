import { useEffect, useState } from "react";

const COLS = 32;
const ROWS = 2;
const TOTAL = COLS * ROWS;

type State = "empty" | "sealed" | "hot";

// Hand-tuned starting pattern — stable across mounts so the visual reads
// designed, not noisy. ~16% sealed, ~8% hot, the rest empty.
function initialGrid(): State[] {
  const grid: State[] = new Array(TOTAL).fill("empty");
  for (const i of [4, 11, 17, 23, 27, 36, 41, 49, 54, 60]) grid[i] = "sealed";
  for (const i of [8, 21, 33, 47, 58]) grid[i] = "hot";
  return grid;
}

// Weighted state sampler for idle flips — empty is most likely so the grid
// stays visually quiet over time instead of drifting to all-orange.
const FLIP_STATES: State[] = [
  "empty",
  "empty",
  "empty",
  "empty",
  "sealed",
  "sealed",
  "hot",
];

/// Cipher block grid — SealPad's hero data-viz. 64 small cells in three
/// states (empty / sealed / hot). Once every ~1.2s one cell flips. Pure
/// decoration; encodes no live data. Chosen specifically because the
/// "sealed-bid → encrypted block" metaphor is SealPad's own; the more
/// common single-color tick ruler belongs to other brands.
export function CipherGrid() {
  const [grid, setGrid] = useState<State[]>(initialGrid);

  useEffect(() => {
    const id = window.setInterval(() => {
      setGrid((prev) => {
        const next = [...prev];
        const idx = Math.floor(Math.random() * TOTAL);
        next[idx] = FLIP_STATES[Math.floor(Math.random() * FLIP_STATES.length)];
        return next;
      });
    }, 1200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="grid gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {grid.map((state, i) => (
        <div
          key={i}
          className={`aspect-square transition-colors duration-500 ${
            state === "hot"
              ? "bg-brand-500"
              : state === "sealed"
                ? "bg-slate-900"
                : "bg-slate-200"
          }`}
        />
      ))}
    </div>
  );
}
