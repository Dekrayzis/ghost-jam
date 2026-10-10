"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Bat, Booth, Fan, Ghost } from "./art";
import { CROWD_WAVES, FANS, FANS_PER_WAVE } from "./crowd";
import { lessMotion } from "./motion";
import { BEAT, LOOP, STEP, STEPS_PER_BAR, STEPS_PER_BEAT, playStep } from "./music";
import { LIGHTS } from "./palette";
import { pick } from "./random";
import { FADE, makeSynth, type Band, type Synth } from "./synth";

/**
 * Ghost Jam: a Halloween FizzBuzz light wall (Boo for threes, Scary for fives,
 * BooScary for both), staged as a concert. Three ghosts dance to a track
 * synthesised live in the browser (music.ts, synth.ts), and a crowd of fans
 * fills the floor, a wave each loop, until the show sells out (crowd.ts).
 *
 * Sight and sound share one clock: every note is scheduled a little ahead on
 * the audio clock, and the visual for it fires when the clock, less the
 * output latency, reaches it: when the note is heard, not when it is sent.
 *
 * Flashing is kept slow (the big word appears once a bar), and with less
 * motion on, the wall, ghosts and crowd hold still while the music plays.
 *
 * Adapted from "Ghost Jam" by grauconejo13 on CodePen. The original used
 * animated GIFs and a commercial song; here everything is made in code.
 */

/** How often the scheduler wakes, and how far ahead it books notes. */
const SCHEDULE_EVERY_MS = 25;
const LOOKAHEAD = 0.1;
/** A moment's grace before the first note, so it isn't clipped. */
const START_DELAY = 0.06;
const BEAT_FLASH_MS = 110;
const WORD_MS = 260;
const WORDS = ["BOO", "SCARY", "BOOSCARY", "JAM"];

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

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** A step booked on the audio clock, waiting for its visuals. */
type Booked = { t: number; step: number };

/** The running sequencer: its timers, where it has got to, and what's booked. */
type Engine = {
  band: Band;
  timer: number;
  frame: number;
  start: number;
  next: number;
  step: number;
  loops: number;
  queue: Booked[];
};

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

  const synth = useRef<Synth | null>(null);
  const engine = useRef<Engine | null>(null);
  // Set while the audio is waking up, so a quick second press can't start a
  // second sequencer.
  const starting = useRef(false);
  const timers = useRef(new Set<number>());
  // The pending suspend after a pause, cancelled if play is pressed first.
  const sleep = useRef(0);

  /** setTimeout, remembered so it can be cleared when the component goes. */
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  };

  /**
   * A short-lived flag on an element. Set as a data attribute rather than a
   * class: React owns className and would wipe a class it didn't set.
   */
  const flash = (el: HTMLElement | null, flag: string, ms: number) => {
    if (!el) return;
    el.dataset[flag] = "";
    later(() => delete el.dataset[flag], ms);
  };

  /** Lights a handful of cells in the night palette, leaving some of the last beat's on. */
  const lightWall = () => {
    for (const cell of cells.current) {
      if (cell && Math.random() > 0.3) delete cell.dataset.light;
    }
    const count = 12 + Math.floor(Math.random() * 12);
    for (let i = 0; i < count; i++) {
      const cell = pick(cells.current);
      if (cell) cell.dataset.light = pick(LIGHTS);
    }
  };

  const clearWall = () => cells.current.forEach((cell) => cell && delete cell.dataset.light);

  /** What the eye sees for one step, at the moment it is heard. */
  const onStep = (step: number) => {
    if (lessMotion()) return;
    const at = step % STEPS_PER_BAR;
    if (at % STEPS_PER_BEAT === 0) {
      lightWall();
      flash(scene.current, "beat", BEAT_FLASH_MS);
    }
    // The big word: once a bar, on the one.
    if (at === 0 && word.current) {
      word.current.textContent = pick(WORDS);
      flash(word.current, "shown", WORD_MS);
    }
  };

  const start = async () => {
    if (starting.current || engine.current) return;
    starting.current = true;
    window.clearTimeout(sleep.current);
    synth.current ??= makeSynth();
    const s = synth.current;
    try {
      await s.ctx.resume();
    } catch {
      return;
    } finally {
      starting.current = false;
    }
    // The component may have gone (closing the context) while the audio woke.
    if (synth.current !== s || engine.current) return;

    /** The audio clock as heard: what is coming out of the speakers now. */
    const heard = () => s.ctx.currentTime - (s.ctx.outputLatency || s.ctx.baseLatency || 0);

    const t0 = s.ctx.currentTime + START_DELAY;
    const e: Engine = { band: s.band(), timer: 0, frame: 0, start: t0, next: t0, step: 0, loops: 1, queue: [] };
    engine.current = e;

    // Book every step that falls inside the look-ahead window.
    e.timer = window.setInterval(() => {
      const now = s.ctx.currentTime;
      // After a stall, skip the steps whose time has passed rather than
      // playing them all at once, and carry on in time.
      if (e.next < now) {
        const missed = Math.ceil((now - e.next) / STEP);
        e.next += missed * STEP;
        e.step += missed;
      }
      while (e.next < now + LOOKAHEAD) {
        playStep(e.band, e.step, e.next);
        e.queue.push({ t: e.next, step: e.step });
        e.next += STEP;
        e.step += 1;
      }
      // With the animation loop paused (a hidden tab), only the latest steps
      // matter: keep the queue from growing.
      if (e.queue.length > 64) e.queue.splice(0, e.queue.length - 64);
    }, SCHEDULE_EVERY_MS);

    // Fire the visuals as the notes are heard, and move the bar. Only the
    // latest step that is due gets its visuals; any older ones are dropped,
    // so a return to a hidden tab doesn't replay a backlog in one frame.
    const tick = () => {
      const now = heard();
      let due = 0;
      while (due < e.queue.length && e.queue[due].t <= now) due++;
      if (due) onStep(e.queue.splice(0, due)[due - 1].step);
      const elapsed = Math.max(0, now - e.start);
      const pos = elapsed % LOOP;
      if (bar.current) bar.current.style.scale = `${pos / LOOP} 1`;
      if (time.current) time.current.textContent = `${fmtTime(pos)} / ${fmtTime(LOOP)}`;
      // Each time the loop comes round, another wave of fans joins. React
      // only hears about it once a loop, not every frame.
      const loops = Math.floor(elapsed / LOOP) + 1;
      if (loops !== e.loops) {
        e.loops = loops;
        setLoop(loops);
        setCrowd((n) => Math.min(FANS.length, n + FANS_PER_WAVE));
      }
      e.frame = requestAnimationFrame(tick);
    };
    e.frame = requestAnimationFrame(tick);
    // The music starts again from the top, so the loop count does too.
    setLoop(1);
    setPlaying(true);
  };

  const stop = (closing = false) => {
    const e = engine.current;
    if (e) {
      window.clearInterval(e.timer);
      cancelAnimationFrame(e.frame);
      // Fade out and cut loose everything this run booked, so none of it
      // (notes ahead, the pad, the echo) sounds when play is pressed again.
      e.band.end();
      engine.current = null;
    }
    window.clearTimeout(sleep.current);
    if (closing) {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current.clear();
      void synth.current?.ctx.close().catch(() => {});
      synth.current = null;
      return;
    }
    // Rest the audio once the fade is done.
    const s = synth.current;
    sleep.current = window.setTimeout(() => {
      if (!engine.current && synth.current === s) void s?.ctx.suspend().catch(() => {});
    }, FADE * 1000 + 60);
    clearWall();
    setPlaying(false);
  };

  // Stop everything if the page goes away mid-jam.
  useEffect(() => () => stop(true), []);

  const soldOut = crowd === CROWD_WAVES * FANS_PER_WAVE;
  const status = [
    playing ? "Jamming" : "Ready",
    playing && loop > 1 && `loop ${loop}`,
    crowd > 0 && `crowd of ${crowd}${soldOut ? ", sold out" : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      ref={scene}
      className={`ghost-jam${playing ? " is-playing" : ""}`}
      // The dance is timed in beats, so it keeps in step if the tempo changes.
      style={{ "--beat": `${BEAT}s` } as CSSProperties}
    >
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
            <Bat />
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
            <span key={i} style={{ animationDelay: `calc(var(--beat) * ${-((i * 0.26) % 1).toFixed(2)})` }} />
          ))}
        </div>
        <div className="ghost-jam__controls">
          <button
            type="button"
            className="ghost-jam__play"
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
              <span aria-live="polite">{status}</span>
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
