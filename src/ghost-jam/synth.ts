import { STEP, mtof } from "./music";

export type Synth = ReturnType<typeof makeSynth>;

/**
 * The instruments, all synthesised: no samples. One audio context, a master
 * bus through a compressor, and a voice per instrument, each played at an
 * exact audio-clock time `t`.
 */
export function makeSynth() {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);

  // One second of white noise, reused by the clap and the hats.
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  // ---- Building blocks --------------------------------------------------------

  /** A volume that starts at `peak` and dies away over `decay`: a struck sound. */
  const hit = (t: number, peak: number, decay: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    g.connect(master);
    return g;
  };

  /** A volume that swells in over `attack`, holds until `hold`, and fades out by `end`. */
  const swell = (t: number, peak: number, attack: number, hold: number, end: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, hold);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    return g;
  };

  /** A filter of the given type at `freq` Hz, feeding `to`. */
  const filter = (type: BiquadFilterType, freq: number, to: AudioNode) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.connect(to);
    return f;
  };

  /** An oscillator sounding from `t` until `end`, feeding `to`. */
  const tone = (type: OscillatorType, freq: number, t: number, end: number, to: AudioNode, detune = 0) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(to);
    o.start(t);
    o.stop(end);
    return o;
  };

  /** A burst of noise through a high-pass filter: the clap and the hats. */
  const hiss = (t: number, cutoff: number, peak: number, decay: number) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.connect(filter("highpass", cutoff, hit(t, peak, decay)));
    s.start(t);
    s.stop(t + decay + 0.02);
  };

  // ---- The instruments --------------------------------------------------------

  const kick = (t: number) => {
    const o = tone("sine", 150, t, t + 0.32, hit(t, 1, 0.3));
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  };

  const clap = (t: number) => hiss(t, 1200, 0.5, 0.16);
  const hat = (t: number, accent: boolean) => hiss(t, 7000, accent ? 0.22 : 0.09, 0.04);

  // A plucked sawtooth, its filter closing as it sounds.
  const bass = (t: number, freq: number) => {
    const f = filter("lowpass", 900, hit(t, 0.35, 0.14));
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    tone("sawtooth", freq, t, t + 0.16, f);
  };

  // A soft chord under each bar: detuned triangles through a low filter.
  const pad = (t: number, notes: readonly number[], dur: number) => {
    const g = swell(t, 0.05, 0.35, t + dur - 0.3, t + dur);
    g.connect(master);
    const f = filter("lowpass", 900, g);
    for (const note of notes) {
      for (const cents of [-7, 7]) tone("triangle", mtof(note), t, t + dur + 0.05, f, cents);
    }
  };

  // A short, bright chord on the off-beat: the house-music stab.
  const stab = (t: number, notes: readonly number[]) => {
    const f = filter("lowpass", 2600, hit(t, 0.07, 0.2));
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 0.16);
    for (const note of notes) tone("sawtooth", mtof(note + 12), t, t + 0.22, f);
  };

  // The lead: a theremin, a sine with vibrato that glides between notes, into
  // a dotted-eighth echo.
  const echo = ctx.createDelay(1);
  echo.delayTime.value = STEP * 3;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  echo.connect(feedback).connect(echo);
  echo.connect(wet).connect(master);
  let lastLead = 0;

  const lead = (t: number, note: number, dur: number) => {
    const freq = mtof(note);
    const end = t + dur + 0.1;
    const g = swell(t, 0.16, 0.03, t + dur - 0.05, t + dur + 0.08);
    g.connect(master);
    g.connect(echo);
    const o = tone("sine", freq, t, end, g);
    o.frequency.setValueAtTime(lastLead || freq, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    lastLead = freq;
    // Vibrato that deepens as the note holds.
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(freq * 0.012, t + Math.min(dur, 0.3));
    depth.connect(o.frequency);
    tone("sine", 5.5, t, end, depth);
  };

  return { ctx, kick, clap, hat, bass, pad, stab, lead };
}
