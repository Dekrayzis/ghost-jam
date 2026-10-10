import type { Light } from "./palette";
import { pick, seeded } from "./random";

/**
 * The crowd: a wave of fans arrives each time the loop comes round, until the
 * floor is full. Fans stand in three rows, front to back; each wave joins one
 * row, and a wave joining a row already in use stands in the gaps there.
 */

export const CROWD_WAVES = 5;
export const FANS_PER_WAVE = 7;

/** The row each wave joins, and how big a fan in each row is drawn. */
const WAVE_ROWS = [0, 1, 2, 0, 1] as const;
const ROW_SIZES = [0.95, 0.82, 0.7];
const GLOWS: Light[] = ["pumpkin", "slime", "moon", "candle", "ember"];

export type FanSpec = {
  /** Across the floor, in percent. */
  x: number;
  row: 0 | 1 | 2;
  size: number;
  arms: boolean;
  glow: Light | null;
  /** Bounces on the off-beat rather than the beat. */
  offbeat: boolean;
  tilt: number;
};

export const FANS: FanSpec[] = (() => {
  const rand = seeded(7);
  return Array.from({ length: CROWD_WAVES * FANS_PER_WAVE }, (_, i) => {
    const wave = Math.floor(i / FANS_PER_WAVE);
    const slot = i % FANS_PER_WAVE;
    const row = WAVE_ROWS[wave];
    // A row's second wave shifts half a slot, into the gaps; the middle row
    // also starts a quarter-slot over, so no fan stands right behind another.
    const repeat = WAVE_ROWS.indexOf(row) < wave;
    const shift = (repeat ? 0.5 : 0) + (row === 1 ? 0.25 : 0);
    return {
      x: ((slot + 0.25 + shift) / FANS_PER_WAVE) * 100 + (rand() - 0.5) * 3,
      row,
      size: ROW_SIZES[row] + rand() * 0.08,
      arms: rand() > 0.35,
      glow: rand() > 0.55 ? pick(GLOWS, rand) : null,
      offbeat: rand() > 0.5,
      tilt: (rand() - 0.5) * 8,
    };
  });
})();
