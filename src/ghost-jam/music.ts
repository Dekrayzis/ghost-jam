import type { Band } from "./synth";

/**
 * The track, as data: tempo, the beat pattern, and four bars of song. Change
 * the music here; synth.ts only knows how to make each sound.
 */

export const BPM = 120;
/** A sixteenth note, in seconds: one step of the sequencer. */
export const STEP = 60 / BPM / 4;
/** A beat, in seconds; the stylesheet's dance moves are timed in these (--beat). */
export const BEAT = 60 / BPM;
export const STEPS_PER_BAR = 16;
export const STEPS_PER_BEAT = 4;
export const BARS = 4;
/** One time round the four bars, in seconds. */
export const LOOP = STEP * STEPS_PER_BAR * BARS;
/** The stabs and the lead join from the second time round. */
const FULL_FROM = STEPS_PER_BAR * BARS;

export const mtof = (note: number) => 440 * 2 ** ((note - 69) / 12);

const steps = (...at: number[]) => new Set(at);

/** Which sixteenths of a bar each part plays on. */
const PATTERN = {
  kick: steps(0, 4, 8, 12),
  clap: steps(4, 12),
  hat: steps(0, 2, 4, 6, 8, 10, 12, 14),
  hatAccent: steps(2, 6, 10, 14),
  bass: steps(0, 3, 6, 8, 11, 14),
  bassOctave: steps(14),
  stab: steps(2, 6, 10, 14), // the off-beat eighths
};

/** A melody note: the sixteenth it starts on, a MIDI note, its length in sixteenths. */
type Note = readonly [at: number, note: number, length: number];
type Bar = { root: number; chord: readonly number[]; melody: readonly Note[] };

/**
 * Four bars, as MIDI notes: A minor, A minor, G, then E major (the
 * harmonic-minor turn that makes it sound spooky). `root` is the bass note.
 */
const SONG: readonly Bar[] = [
  {
    root: 33,
    chord: [57, 60, 64],
    melody: [[0, 76, 2], [2, 76, 1], [3, 74, 1], [4, 72, 2], [6, 71, 2], [8, 69, 4], [12, 72, 2], [14, 71, 2]],
  },
  {
    root: 33,
    chord: [57, 60, 64],
    melody: [[0, 69, 2], [2, 72, 2], [4, 76, 2], [6, 77, 2], [8, 76, 3], [11, 74, 1], [12, 72, 4]],
  },
  {
    root: 31,
    chord: [55, 59, 62],
    melody: [[0, 74, 2], [2, 71, 2], [4, 67, 2], [6, 71, 2], [8, 74, 3], [11, 76, 1], [12, 74, 4]],
  },
  {
    root: 28,
    chord: [56, 59, 64],
    melody: [[0, 76, 3], [3, 75, 1], [4, 76, 2], [6, 80, 2], [8, 83, 4], [12, 80, 2], [14, 76, 2]],
  },
];

/** Everything that sounds on one step, played at audio time `t`. */
export function playStep(band: Band, step: number, t: number) {
  const at = step % STEPS_PER_BAR;
  const bar = SONG[Math.floor(step / STEPS_PER_BAR) % BARS];

  if (PATTERN.kick.has(at)) band.kick(t);
  if (PATTERN.clap.has(at)) band.clap(t);
  if (PATTERN.hat.has(at)) band.hat(t, PATTERN.hatAccent.has(at));
  if (PATTERN.bass.has(at)) band.bass(t, mtof(bar.root + (PATTERN.bassOctave.has(at) ? 12 : 0)));
  if (at === 0) band.pad(t, bar.chord, STEP * STEPS_PER_BAR);

  if (step < FULL_FROM) return;
  if (PATTERN.stab.has(at)) band.stab(t, bar.chord);
  const note = bar.melody.find(([start]) => start === at);
  if (note) band.lead(t, note[1], note[2] * STEP);
}
