import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { lessMotion } from "./motion";

/**
 * Ghost Jam: a Halloween FizzBuzz light wall (Boo for threes, Scary for fives,
 * BooScary for both), three ghosts dancing, and a beat that drives it all.
 *
 * The music is made in the browser with the Web Audio API (kick, clap,
 * hi-hats and a bass line, four bars at 120 BPM), not a recording, so there's
 * nothing to license and the lights land exactly on the beat: every note is
 * scheduled a little ahead on the audio clock, and the visual for it fires
 * when the clock reaches it.
 *
 * Flashing is kept slow (the big word appears once a bar), and with less
 * motion on (the system setting or the site's pause button) the wall and the
 * ghosts hold still while the music plays.
 *
 * Adapted from "Ghost Jam" by grauconejo13 on CodePen; the ghosts, colours
 * and music are new.
 */

const BPM = 120;
const STEP = 60 / BPM / 4; // a sixteenth note
const STEPS_PER_BAR = 16;
const BARS = 4;
const LOOP = STEP * STEPS_PER_BAR * BARS; // seconds
const LIGHTS = ["pumpkin", "ember", "candle", "slime", "moon"] as const;
const WORDS = ["BOO", "SCARY", "BOOSCARY", "JAM"];
// The bass's root note for each bar: A, A, G, E.
const ROOTS = [55, 55, 49, 41.2];
// Which sixteenths of a bar the bass plays.
const BASS_STEPS = new Set([0, 3, 6, 8, 11, 14]);
// The chord for each bar, as MIDI notes: A minor, A minor, G, then E major
// (the harmonic-minor turn that makes it sound spooky).
const CHORDS = [
  [57, 60, 64],
  [57, 60, 64],
  [55, 59, 62],
  [56, 59, 64],
] as const;
// The off-beat eighths, where the chord stabs land.
const STAB_STEPS = new Set([2, 6, 10, 14]);
// The theremin melody: [sixteenth, MIDI note, length in sixteenths] per bar.
const MELODY: [number, number, number][][] = [
  [[0, 76, 2], [2, 76, 1], [3, 74, 1], [4, 72, 2], [6, 71, 2], [8, 69, 4], [12, 72, 2], [14, 71, 2]],
  [[0, 69, 2], [2, 72, 2], [4, 76, 2], [6, 77, 2], [8, 76, 3], [11, 74, 1], [12, 72, 4]],
  [[0, 74, 2], [2, 71, 2], [4, 67, 2], [6, 71, 2], [8, 74, 3], [11, 76, 1], [12, 74, 4]],
  [[0, 76, 3], [3, 75, 1], [4, 76, 2], [6, 80, 2], [8, 83, 4], [12, 80, 2], [14, 76, 2]],
];
const mtof = (note: number) => 440 * 2 ** ((note - 69) / 12);

function spooky(n: number) {
  if (n % 15 === 0) return "BooScary";
  if (n % 3 === 0) return "Boo";
  if (n % 5 === 0) return "Scary";
  return String(n);
}

const CELLS = Array.from({ length: 100 }, (_, i) => {
  const value = spooky(i + 1);
  return { n: i + 1, value, kind: value === String(i + 1) ? "" : value.toLowerCase() };
});

// The crowd: a wave of fans arrives each time the loop comes round, until
// the floor is full.
const CROWD_WAVES = 5;
const FANS_PER_WAVE = 7;
const GLOWS = ["#ff7a18", "#9dff57", "#9fb4ff", "#ffd166", "#ff3d2e"];

/**
 * A fixed, seeded crowd, so the server and the browser draw the same one.
 * Three rows, front to back. Each wave stands in one row, and a wave that
 * joins a row already in use stands in the gaps between the fans there.
 */
const ROWS = [0, 1, 2, 0, 1] as const; // the row each wave joins
const FANS = (() => {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  return Array.from({ length: CROWD_WAVES * FANS_PER_WAVE }, (_, i) => {
    const wave = Math.floor(i / FANS_PER_WAVE);
    const slot = i % FANS_PER_WAVE;
    const row = ROWS[wave % ROWS.length];
    // A row's second wave shifts half a slot, into the gaps; the middle row
    // also starts a quarter-slot over, so no fan stands right behind another.
    const shift = (wave >= 3 ? 0.5 : 0) + (row === 1 ? 0.25 : 0);
    return {
      x: ((slot + 0.25 + shift) / FANS_PER_WAVE) * 100 + (rand() - 0.5) * 3,
      row,
      size: [0.95, 0.82, 0.7][row] + rand() * 0.08,
      arms: rand() > 0.35,
      glow: rand() > 0.55 ? GLOWS[Math.floor(rand() * GLOWS.length)] : null,
      // Half the crowd bounces on the beat, half on the off-beat.
      offbeat: rand() > 0.5,
      tilt: (rand() - 0.5) * 8,
    };
  });
})();

const fmtTime =(s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** The synthesiser: one context, a master bus, and a voice per drum. */
function makeSynth() {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.55;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);

  // One second of white noise, reused by the clap and the hats.
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const env = (t: number, peak: number, decay: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    g.connect(master);
    return g;
  };

  const kick = (t: number) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    o.connect(env(t, 1, 0.3));
    o.start(t);
    o.stop(t + 0.32);
  };

  const hiss = (t: number, cutoff: number, peak: number, decay: number) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = cutoff;
    s.connect(f).connect(env(t, peak, decay));
    s.start(t);
    s.stop(t + decay + 0.02);
  };

  const bass = (t: number, freq: number) => {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    o.connect(f).connect(env(t, 0.35, 0.14));
    o.start(t);
    o.stop(t + 0.16);
  };

  // A soft chord under each bar: detuned triangles through a low filter,
  // swelling in and fading out.
  const pad = (t: number, notes: readonly number[], dur: number) => {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.35);
    g.gain.setValueAtTime(0.05, t + dur - 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    f.connect(g).connect(master);
    for (const note of notes) {
      for (const cents of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = mtof(note);
        o.detune.value = cents;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  };

  // A short, bright chord on the off-beat, the house-music stab.
  const stab = (t: number, notes: readonly number[]) => {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 0.16);
    f.connect(env(t, 0.07, 0.2));
    for (const note of notes) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = mtof(note + 12);
      o.connect(f);
      o.start(t);
      o.stop(t + 0.22);
    }
  };

  // The lead: a theremin, a sine with vibrato that glides between notes,
  // into a dotted-eighth echo.
  const echo = ctx.createDelay(1);
  echo.delayTime.value = STEP * 3;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  echo.connect(feedback).connect(echo);
  echo.connect(wet).connect(master);
  let leadFreq = 0;

  const lead = (t: number, note: number, dur: number) => {
    const freq = mtof(note);
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(leadFreq || freq, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    leadFreq = freq;
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(freq * 0.012, t + Math.min(dur, 0.3));
    vibrato.connect(depth).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.03);
    g.gain.setValueAtTime(0.16, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(g);
    g.connect(master);
    g.connect(echo);
    o.start(t);
    vibrato.start(t);
    o.stop(t + dur + 0.1);
    vibrato.stop(t + dur + 0.1);
  };

  return { ctx, master, kick, clap: (t: number) => hiss(t, 1200, 0.5, 0.16), hat: (t: number, loud: boolean) => hiss(t, 7000, loud ? 0.22 : 0.09, 0.04), bass, pad, stab, lead };
}

export function GhostJam() {
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(1);
  // Fans in the crowd; kept through a pause, so the concert picks up again.
  const [crowd, setCrowd] = useState(0);

  const scene = useRef<HTMLDivElement>(null);
  const cells = useRef<(HTMLLIElement | null)[]>([]);
  const word = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const time = useRef<HTMLSpanElement>(null);

  const synth = useRef<ReturnType<typeof makeSynth> | null>(null);
  const engine = useRef<{ timer: number; frame: number; start: number; next: number; step: number; loops: number; queue: { t: number; step: number }[] } | null>(null);

  // Stop everything if the page goes away mid-jam.
  useEffect(() => () => stop(true), []);

  /** Lights a handful of cells in the night palette, leaving some of the last beat's on. */
  const lightWall = () => {
    for (const cell of cells.current) {
      if (cell && Math.random() > 0.3) cell.removeAttribute("data-light");
    }
    const count = 12 + Math.floor(Math.random() * 12);
    for (let i = 0; i < count; i++) {
      const cell = cells.current[Math.floor(Math.random() * cells.current.length)];
      cell?.setAttribute("data-light", LIGHTS[Math.floor(Math.random() * LIGHTS.length)]);
    }
  };

  const clearWall = () => cells.current.forEach((c) => c?.removeAttribute("data-light"));

  /** What the eye sees for one sixteenth, at the moment it is heard. */
  const onStep = (step: number) => {
    if (lessMotion()) return;
    const inBar = step % STEPS_PER_BAR;
    if (inBar % 4 === 0) {
      lightWall();
      scene.current?.classList.add("is-beat");
      window.setTimeout(() => scene.current?.classList.remove("is-beat"), 110);
    }
    // The big word: once a bar, on the one.
    if (inBar === 0 && word.current) {
      word.current.textContent = WORDS[Math.floor(Math.random() * WORDS.length)];
      word.current.classList.add("is-shown");
      window.setTimeout(() => word.current?.classList.remove("is-shown"), 260);
    }
  };

  const start = async () => {
    synth.current ??= makeSynth();
    const s = synth.current;
    await s.ctx.resume();
    const t0 = s.ctx.currentTime + 0.06;
    const e = { timer: 0, frame: 0, start: t0, next: t0, step: 0, loops: 1, queue: [] as { t: number; step: number }[] };
    engine.current = e;

    // Schedule a tenth of a second ahead, every 25ms.
    e.timer = window.setInterval(() => {
      while (e.next < s.ctx.currentTime + 0.1) {
        const inBar = e.step % STEPS_PER_BAR;
        const barIndex = Math.floor(e.step / STEPS_PER_BAR) % BARS;
        if (inBar % 4 === 0) s.kick(e.next);
        if (inBar === 4 || inBar === 12) s.clap(e.next);
        if (inBar % 2 === 0) s.hat(e.next, inBar % 4 === 2);
        if (BASS_STEPS.has(inBar)) s.bass(e.next, ROOTS[barIndex] * (inBar === 14 ? 2 : 1));
        // The first time round is drums, bass and pads; from the second loop
        // the stabs and the theremin join, as the crowd starts to arrive.
        if (inBar === 0) s.pad(e.next, CHORDS[barIndex], STEP * STEPS_PER_BAR);
        const full = e.step >= STEPS_PER_BAR * BARS;
        if (full && STAB_STEPS.has(inBar)) s.stab(e.next, CHORDS[barIndex]);
        const note = full ? MELODY[barIndex].find(([at]) => at === inBar) : undefined;
        if (note) s.lead(e.next, note[1], note[2] * STEP);
        e.queue.push({ t: e.next, step: e.step });
        e.next += STEP;
        e.step += 1;
      }
    }, 25);

    // Fire the visuals as the audio clock reaches them, and move the bar.
    const tick = () => {
      const now = s.ctx.currentTime;
      while (e.queue.length && e.queue[0].t <= now) onStep(e.queue.shift()!.step);
      const elapsed = Math.max(0, now - e.start);
      const pos = elapsed % LOOP;
      if (bar.current) bar.current.style.width = `${(pos / LOOP) * 100}%`;
      if (time.current) time.current.textContent = `${fmtTime(pos)} / ${fmtTime(LOOP)}`;
      const loops = Math.floor(elapsed / LOOP) + 1;
      // Each time the loop comes round, another wave of fans joins.
      // React only hears about it once a loop, not every frame.
      if (loops !== e.loops) {
        if (loops > 1) setCrowd((n) => Math.min(FANS.length, n + FANS_PER_WAVE));
        e.loops = loops;
        setLoop(loops);
      }
      e.frame = requestAnimationFrame(tick);
    };
    e.frame = requestAnimationFrame(tick);
    setPlaying(true);
  };

  function stop(closing = false) {
    const e = engine.current;
    if (e) {
      window.clearInterval(e.timer);
      cancelAnimationFrame(e.frame);
      engine.current = null;
    }
    if (closing) {
      synth.current?.ctx.close();
      synth.current = null;
      return;
    }
    synth.current?.ctx.suspend();
    clearWall();
    setPlaying(false);
  }

  return (
    <div ref={scene} className={`ghost-jam${playing ? " is-playing" : ""}`}>
      {/* The FizzBuzz wall: 1 to 100, lit in time with the music. */}
      <ol className="ghost-jam__wall" aria-label="Halloween FizzBuzz from 1 to 100">
        {CELLS.map((c, i) => (
          <li
            key={c.n}
            ref={(el) => {
              cells.current[i] = el;
            }}
            className={`ghost-jam__cell${c.kind ? ` is-${c.kind}` : ""}`}
          >
            <span className="ghost-jam__n" aria-hidden="true">
              {String(c.n).padStart(3, "0")}
            </span>
            <span className="ghost-jam__v">{c.value}</span>
          </li>
        ))}
      </ol>

      <header className="ghost-jam__head">
        <p className="ghost-jam__eyebrow">Halloween FizzBuzz · Spectral session</p>
        <p className="ghost-jam__title" aria-hidden="true">
          <span>Ghost</span> <span className="ghost-jam__outline">Jam</span>
        </p>
        <p className="ghost-jam__tagline">
          Boo. Scary. BooScary. <strong>Turn it up.</strong>
        </p>
      </header>

      <div className="ghost-jam__stage" aria-hidden="true">
        {/* The crescent moon, and a bat looping round it */}
        <div className="ghost-jam__sky">
          <span className="ghost-jam__moon" />
          <span className="ghost-jam__flight">
            <svg className="ghost-jam__bat" viewBox="0 0 64 30">
              <path className="ghost-jam__wing ghost-jam__wing--l" d="M27 13 Q16 2 2 8 Q8 11 7 16 Q12 13 15 18 Q19 14 23 19 Q25 15 28 17 Z" />
              <path className="ghost-jam__wing ghost-jam__wing--r" d="M37 13 Q48 2 62 8 Q56 11 57 16 Q52 13 49 18 Q45 14 41 19 Q39 15 36 17 Z" />
              <path d="M28 9 L29.5 4 L31 8.5 H33 L34.5 4 L36 9 Q38 13 36 18 Q32 23 28 18 Q26 13 28 9 Z" />
              <circle cx="30.4" cy="11.5" r="0.9" fill="#ffd166" />
              <circle cx="33.6" cy="11.5" r="0.9" fill="#ffd166" />
            </svg>
          </span>
        </div>
        {/* Stage lights, sweeping while the music plays. */}
        <span className="ghost-jam__beam ghost-jam__beam--a" />
        <span className="ghost-jam__beam ghost-jam__beam--b" />
        <span className="ghost-jam__beam ghost-jam__beam--c" />
        <span ref={word} className="ghost-jam__word">
          BOO
        </span>
        <div className="ghost-jam__band">
          <div className="ghost-jam__dancer ghost-jam__dancer--left">
            <Ghost costume="bow" />
            <span className="ghost-jam__shadow" />
          </div>
          <div className="ghost-jam__dancer ghost-jam__dancer--dj">
            <Ghost costume="headphones" />
            <Booth />
          </div>
          <div className="ghost-jam__dancer ghost-jam__dancer--right">
            <Ghost costume="hat" />
            <span className="ghost-jam__shadow" />
          </div>
        </div>
      </div>

      {/* The crowd, seen from behind, growing a wave each loop. */}
      <ol className="ghost-jam__crowd" aria-hidden="true">
        {FANS.slice(0, crowd).map((fan, i) => (
          <li
            key={i}
            className={`ghost-jam__fan is-row-${fan.row}${fan.offbeat ? " is-offbeat" : ""}`}
            style={{ "--x": `${fan.x}%`, "--s": fan.size, "--tilt": `${fan.tilt}deg` } as CSSProperties}
          >
            <Fan arms={fan.arms} glow={fan.glow} left={fan.tilt < 0} />
          </li>
        ))}
      </ol>

      <div className="ghost-jam__player">
        <div className="ghost-jam__eq" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} style={{ animationDelay: `${-((i * 0.13) % 0.5)}s` }} />
          ))}
        </div>
        <div className="ghost-jam__controls">
          <button
            type="button"
            className="ghost-jam__play"
            aria-pressed={playing}
            onClick={() => (playing ? stop() : start())}
          >
            <span className="ghost-jam__play-icon" aria-hidden="true">
              {playing ? "❚❚" : "▶"}
            </span>
            <span>
              <small>Spectral audio</small>
              <strong>{playing ? "Pause jam" : "Play jam"}</strong>
            </span>
          </button>
          <div className="ghost-jam__track">
            <p className="ghost-jam__track-top">
              <span aria-live="polite">
                {playing ? `Jamming${loop > 1 ? ` · loop ${loop}` : ""}` : "Ready"}
                {crowd ? ` · crowd of ${crowd}${crowd === FANS.length ? ", sold out" : ""}` : ""}
              </span>
              <span ref={time}>0:00 / {fmtTime(LOOP)}</span>
            </p>
            <span className="ghost-jam__progress" aria-hidden="true">
              <span ref={bar} />
            </span>
          </div>
        </div>
        <p className="ghost-jam__key">
          <span>03 → Boo</span>
          <span>05 → Scary</span>
          <span>15 → BooScary</span>
        </p>
      </div>
    </div>
  );
}

type Costume = "bow" | "headphones" | "hat";

/**
 * A sheet ghost with a wavy hem, in costume: a bow, the DJ's headphones, or a
 * witch's hat. The body, arms, eyes and mouth are separate shapes so the CSS
 * can move each in time (_ghost-jam.scss).
 */
function Ghost({ costume }: { costume: Costume }) {
  // Its own gradient ids: three ghosts sharing them would repeat an id.
  const id = useId().replace(/:/g, "");
  const sheet = `gj-sheet-${id}`;
  const glow = `gj-glow-${id}`;
  return (
    <svg className="ghost-jam__ghost" viewBox="0 -24 120 174">
      <defs>
        <linearGradient id={sheet} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbfbff" />
          <stop offset="0.7" stopColor="#dfe4fb" />
          <stop offset="1" stopColor="#b9c2ea" />
        </linearGradient>
        <radialGradient id={glow} cx="0.35" cy="0.25" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="ghost-jam__body">
        <path
          className="ghost-jam__sheet"
          fill={`url(#${sheet})`}
          d="M14 72 Q14 14 60 14 Q106 14 106 72 L106 132 Q97 144 88 132 Q79 120 70 132 Q61 144 52 132 Q43 120 34 132 Q25 144 14 132 Z"
        />
        <ellipse cx="46" cy="40" rx="20" ry="14" fill={`url(#${glow})`} />
        <g className="ghost-jam__eyes">
          <ellipse cx="45" cy="64" rx="7.5" ry="10.5" fill="#1a1020" />
          <ellipse cx="75" cy="64" rx="7.5" ry="10.5" fill="#1a1020" />
          <circle cx="47.5" cy="60" r="2.6" fill="#fff" />
          <circle cx="77.5" cy="60" r="2.6" fill="#fff" />
        </g>
        <ellipse className="ghost-jam__mouth" cx="60" cy="90" rx="6.5" ry="8.5" fill="#1a1020" />
        <ellipse cx="33" cy="81" rx="6.5" ry="3.2" fill="#ff8a8a" opacity="0.5" />
        <ellipse cx="87" cy="81" rx="6.5" ry="3.2" fill="#ff8a8a" opacity="0.5" />
        {costume === "bow" ? (
          <g className="ghost-jam__costume">
            <path d="M36 22 L18 10 L20 34 Z" fill="#ff7a18" />
            <path d="M36 22 L54 12 L50 36 Z" fill="#ff7a18" />
            <path d="M36 22 L20 34 L24 26 Z M36 22 L50 36 L46 28 Z" fill="#c4520a" />
            <circle cx="36" cy="23" r="5.5" fill="#ff3d2e" />
          </g>
        ) : null}
        {costume === "headphones" ? (
          <g className="ghost-jam__costume">
            <path d="M18 62 Q18 6 60 6 Q102 6 102 62" fill="none" stroke="#2a1d36" strokeWidth="7" strokeLinecap="round" />
            <rect x="5" y="50" width="20" height="30" rx="9" fill="#ff7a18" />
            <rect x="95" y="50" width="20" height="30" rx="9" fill="#ff7a18" />
            <rect className="ghost-jam__led" x="9" y="58" width="5" height="14" rx="2.5" fill="#ffd166" />
            <rect className="ghost-jam__led" x="106" y="58" width="5" height="14" rx="2.5" fill="#ffd166" />
          </g>
        ) : null}
        {costume === "hat" ? (
          <g className="ghost-jam__costume">
            <path d="M40 24 Q58 -2 64 -22 Q70 -10 84 -6 Q74 0 78 24 Z" fill="#6b3fa0" stroke="#b48cff" strokeWidth="1.5" />
            <path d="M44 16 Q60 12 78 16 L78 22 Q60 18 44 22 Z" fill="#9dff57" />
            <ellipse cx="60" cy="24" rx="36" ry="7" fill="#7d4cba" stroke="#b48cff" strokeWidth="1.5" />
          </g>
        ) : null}
      </g>
      {/* Arms over the sheet, so a raised arm shows against the body. */}
      <ellipse className="ghost-jam__arm ghost-jam__arm--l" cx="12" cy="84" rx="14" ry="8" fill="#eef1fd" stroke="#a9b3e0" strokeWidth="2" />
      <ellipse className="ghost-jam__arm ghost-jam__arm--r" cx="108" cy="84" rx="14" ry="8" fill="#eef1fd" stroke="#a9b3e0" strokeWidth="2" />
    </svg>
  );
}

/** The DJ's booth: two decks and a row of lights that chase while playing. */
function Booth() {
  return (
    <svg className="ghost-jam__booth" viewBox="0 0 240 78">
      <defs>
        <linearGradient id="gj-booth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1a26" />
          <stop offset="1" stopColor="#120a10" />
        </linearGradient>
      </defs>
      {/* Decks on top, seen at an angle */}
      <rect x="6" y="6" width="228" height="18" rx="5" fill="#3a2531" />
      <ellipse cx="62" cy="15" rx="34" ry="6" fill="#0d0709" />
      <ellipse className="ghost-jam__record" cx="62" cy="15" rx="12" ry="2.5" fill="#ff7a18" />
      <ellipse cx="178" cy="15" rx="34" ry="6" fill="#0d0709" />
      <ellipse className="ghost-jam__record" cx="178" cy="15" rx="12" ry="2.5" fill="#9fb4ff" />
      {/* The front panel */}
      <path d="M0 24 H240 L228 78 H12 Z" fill="url(#gj-booth)" />
      <path d="M0 24 H240" stroke="#ff7a18" strokeWidth="2" opacity="0.8" />
      <g className="ghost-jam__chase">
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={36 + i * 14} y="40" width="8" height="8" rx="2" fill={["#ff7a18", "#ffd166", "#9dff57", "#9fb4ff"][i % 4]} />
        ))}
      </g>
      <text x="120" y="68" textAnchor="middle" fontSize="10" fontWeight="800" letterSpacing="4" fill="#ffd166" opacity="0.8">
        GHOST FM
      </text>
    </svg>
  );
}

/**
 * A fan in the crowd, from behind: a sheet, maybe both arms up, or one arm
 * raised holding a glow stick. Some hold it in the left.
 */
function Fan({ arms, glow, left }: { arms: boolean; glow: string | null; left: boolean }) {
  return (
    <svg className="ghost-jam__fan-art" viewBox="-22 -34 104 110">
      {glow ? (
        // Mirrored across the body's centre for a left-handed fan.
        <g transform={left ? "translate(60 0) scale(-1 1)" : undefined}>
          <g className="ghost-jam__hand">
            <g transform="rotate(20 56 28)">
              {/* The stick: a soft halo, the tube, and a bright core */}
              <rect x="49" y="-44" width="20" height="42" rx="10" fill={glow} opacity="0.22" />
              <rect x="55" y="-38" width="8" height="32" rx="4" fill={glow} />
              <rect x="57" y="-35" width="2.5" height="24" rx="1.25" fill="#fff" opacity="0.65" />
              {/* The arm, reaching up to the stick */}
              <ellipse cx="59" cy="11" rx="6" ry="17" />
            </g>
          </g>
        </g>
      ) : arms ? (
        <g className="ghost-jam__fan-arms">
          <ellipse cx="2" cy="20" rx="6" ry="13" transform="rotate(-28 2 20)" />
          <ellipse cx="58" cy="20" rx="6" ry="13" transform="rotate(28 58 20)" />
        </g>
      ) : null}
      {/* The sheet, with the same wavy hem as the ghosts on stage */}
      <path d="M0 40 Q0 0 30 0 Q60 0 60 40 L60 64 Q55 72 50 64 Q45 56 40 64 Q35 72 30 64 Q25 56 20 64 Q15 72 10 64 Q5 56 0 64 Z" />
      {/* Moonlight catching the top of the head */}
      <path d="M4 34 Q6 3 30 3 Q54 3 56 34" fill="none" stroke="#9fb4ff" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
