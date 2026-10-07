// Wolf sounds (for noxfang's ultimate): prefers the ElevenLabs-generated audio files (sfx/noxfang-*.mp3);
// when a file cannot be fetched or is not decoded yet, the synthesized version computed offline below is used instead.
// A wolf howl is an almost pure-tone sustained note: it starts as a coarse low growl in the throat, then as the mouth slowly opens the sound brightens and rises,
// holds at the top with a little vibrato, and finally falls away downward. The formants move with the mouth shape; a layer an octave lower is added to build up the body size,
// two distant wolves answer in turn, and the main howl is sent into a valley echo. It is computed once and cached, so playback is only a few AudioBufferSourceNodes.

import { Biquad, rng } from './music/dsp.ts';
import { impulseBuffer } from './music/engine.ts';
import { playSample, preloadSample, sampleFetched } from './samples.ts';
import { synth } from './sfx.ts';
import growlUrl from './sfx/noxfang-growl.mp3';
import howlUrl from './sfx/noxfang-howl.mp3';

type Keys = [t: number, v: number][];

/** Cosine-smooth interpolation between keypoints. t usually only moves forward, so remembering the last position avoids searching from the start each time */
function curve(keys: Keys): (t: number) => number {
  let i = 1;
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    if (t < keys[i - 1][0]) i = 1;
    while (i < keys.length && t > keys[i][0]) i++;
    if (i >= keys.length) return keys[keys.length - 1][1];
    const [t0, v0] = keys[i - 1];
    const [t1, v1] = keys[i];
    const u = (t - t0) / (t1 - t0);
    return v0 + (v1 - v0) * (0.5 - 0.5 * Math.cos(Math.PI * u));
  };
}

/** Smooth random drift (-1 to 1), one control point every `step` seconds */
function wander(r: () => number, len: number, step: number): (t: number) => number {
  const pts: Keys = [];
  for (let t = 0; t <= len + step; t += step) pts.push([t, r()]);
  return curve(pts);
}

/** Formant: a bell-shaped frequency response */
const res = (f: number, fc: number, bw: number): number => 1 / (1 + ((f - fc) / bw) ** 2);

interface Voice {
  /** Pitch (Hz) */
  pitch: Keys;
  /** Volume 0-1 */
  amp: Keys;
  /** How far the mouth is open, 0-1: formants shift up and there is more high-frequency content */
  open: Keys;
  /** Throat roughness 0-1: more subharmonics, an irregular tremor of thirty-odd Hz, and more breath noise */
  rough: Keys;
  /** Vibrato depth (as a fraction of pitch), appearing only after the note is held */
  vib: number;
  /** Breath noise level */
  breath: number;
  /** How much further the highs fall off (an extra exponent on the harmonic amplitudes); a wolf howl is almost all fundamental with very weak overtones */
  tilt?: number;
  len: number;
  seed: number;
}

/** One call from one wolf: harmonic stacking (shaped by formants) + roughness + breath noise */
function voice(sr: number, v: Voice): Float32Array {
  const n = Math.floor(v.len * sr);
  const y = new Float32Array(n);
  const P = curve(v.pitch);
  const A = curve(v.amp);
  const O = curve(v.open);
  const R = curve(v.rough);
  const r = rng(v.seed);
  const drift = wander(r, v.len, 0.14);
  const jitter = wander(r, v.len, 0.025);
  const amps = new Float64Array(33);
  const n1 = new Biquad(sr, 'bp', 700, 1.4);
  const n2 = new Biquad(sr, 'bp', 1400, 1.8);
  let ph = 0;
  let rph = 0;
  let K = 1;
  let a = 0;
  let o = 0;
  let ro = 0;
  let f = 0;
  let jt = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // Updating pitch and jitter once every 8 samples is fine enough (0.2 ms)
    if ((i & 7) === 0) {
      const dr = drift(t);
      jt = jitter(t);
      const vib = v.vib * Math.min(1, Math.max(0, (t - 0.55) / 0.5)) * Math.sin(2 * Math.PI * (4.6 + 0.4 * dr) * t);
      f = P(t) * (1 + 0.007 * dr + 0.004 * ro * jt + vib);
    }
    if ((i & 63) === 0) {
      a = A(t);
      o = O(t);
      ro = R(t);
      const F1 = 460 + 540 * o;
      const F2 = 1050 + 700 * o;
      const F3 = 2500 + 400 * o;
      const top = Math.min(32, Math.floor((sr * 0.45) / f));
      K = 1;
      for (let k = 1; k <= top; k++) {
        const fk = k * f;
        amps[k] = (1 + 0.9 * res(fk, F1, 150 + 90 * o) + 0.5 * res(fk, F2, 220) + 0.2 * res(fk, F3, 320)) / Math.pow(k, 2.3 - 0.5 * o + (v.tilt ?? 0));
        // Harmonics more than 50 dB below the fundamental are inaudible, so skip them
        if (amps[k] > amps[1] * 3e-3) K = k;
      }
      n1.set('bp', F1, 1.4);
      n2.set('bp', F2, 1.8);
    }
    ph += (2 * Math.PI * f) / sr;
    if (ph > 4 * Math.PI) ph -= 4 * Math.PI;
    // sin(k·ph) is computed recursively, much faster than calling sin once per harmonic
    const s1 = Math.sin(ph);
    const c2 = 2 * Math.cos(ph);
    let sPrev = 0;
    let sCur = s1;
    let sum = amps[1] * s1;
    for (let k = 2; k <= K; k++) {
      const sNext = c2 * sCur - sPrev;
      sum += amps[k] * sNext;
      sPrev = sCur;
      sCur = sNext;
    }
    // Roughness: the vocal cords tremble irregularly (amplitude fluctuation of thirty-odd Hz) plus a subharmonic an octave lower
    rph += (2 * Math.PI * (33 + 9 * jt)) / sr;
    const am = 1 - ro * 0.6 * (0.5 + 0.5 * Math.sin(rph));
    const sub = ro * 0.45 * Math.sin(ph * 0.5) * amps[1];
    const w = r();
    const br = (n1.run(w) * 0.65 + n2.run(w) * 0.35) * v.breath * (0.35 + 1.4 * ro) * 6;
    y[i] = a * (sum * am + sub + br);
  }
  return y;
}

/** Sense of distance: air absorbs the highs */
function far(sr: number, d: Float32Array, cut: number): Float32Array {
  const lp = new Biquad(sr, 'lp', cut, 0.6);
  for (let i = 0; i < d.length; i++) d[i] = lp.run(d[i]);
  return d;
}

function peakTo(d: Float32Array[], peak: number): void {
  let mx = 0;
  for (const c of d) for (let i = 0; i < c.length; i++) mx = Math.max(mx, Math.abs(c[i]));
  const k = mx > 0 ? peak / mx : 1;
  for (const c of d) for (let i = 0; i < c.length; i++) c[i] *= k;
}

/** Main howl (a large-bodied wolf: it starts lower than an ordinary wolf) */
const MAIN: Omit<Voice, 'seed'> = {
  len: 3.5,
  pitch: [[0, 150], [0.18, 225], [0.45, 355], [0.85, 418], [1.4, 442], [2.1, 434], [2.6, 405], [3.0, 352], [3.35, 250], [3.5, 220]],
  amp: [[0, 0], [0.07, 0.5], [0.35, 0.78], [0.8, 1], [2.3, 0.95], [2.9, 0.7], [3.3, 0.25], [3.5, 0]],
  open: [[0, 0.08], [0.3, 0.3], [0.85, 0.85], [2.2, 0.92], [2.9, 0.45], [3.5, 0.15]],
  rough: [[0, 1], [0.28, 0.85], [0.6, 0.2], [0.95, 0], [2.8, 0], [3.2, 0.35], [3.5, 0.55]],
  vib: 0.011,
  breath: 0.08,
};

/** The two distant answering wolves: higher in pitch and shorter */
const PACK: [start: number, pan: number, gain: number, v: Omit<Voice, 'seed'>][] = [
  [1.25, -0.75, 0.3, {
    len: 2.4,
    pitch: [[0, 300], [0.3, 470], [0.9, 522], [1.6, 505], [2.1, 430], [2.4, 330]],
    amp: [[0, 0], [0.15, 0.6], [0.6, 1], [1.8, 0.85], [2.4, 0]],
    open: [[0, 0.2], [0.6, 0.85], [1.9, 0.8], [2.4, 0.3]],
    rough: [[0, 0.4], [0.35, 0], [2.4, 0]],
    vib: 0.014,
    breath: 0.06,
  }],
  [2.0, 0.7, 0.22, {
    len: 2.0,
    pitch: [[0, 280], [0.25, 392], [0.9, 412], [1.5, 396], [2.0, 330]],
    amp: [[0, 0], [0.15, 0.6], [0.5, 1], [1.5, 0.8], [2.0, 0]],
    open: [[0, 0.2], [0.5, 0.8], [1.6, 0.75], [2.0, 0.3]],
    rough: [[0, 0.35], [0.3, 0], [2.0, 0]],
    vib: 0.013,
    breath: 0.06,
  }],
];

/** Growl in the dark: very low, very coarse, mouth almost closed */
const GROWL: Omit<Voice, 'seed'> = {
  len: 1.0,
  pitch: [[0, 82], [0.25, 90], [0.7, 76], [1.0, 66]],
  amp: [[0, 0], [0.08, 0.75], [0.35, 1], [0.75, 0.8], [1.0, 0]],
  open: [[0, 0.1], [0.4, 0.25], [1.0, 0.05]],
  rough: [[0, 1], [1.0, 1]],
  vib: 0,
  tilt: -0.8,
  breath: 0.22,
};

/** Computed at a fixed sample rate and converted by the browser at playback, so it can be computed before audio is unlocked */
const SR = 44100;

interface Waves {
  main: Float32Array;
  pack: [Float32Array, Float32Array];
  growl: Float32Array;
}

// Split into pieces: computed one piece at a time when idle so the screen is never blocked all at once; if playback comes before they are done, the rest is finished on the spot
const part: { body?: Float32Array; low?: Float32Array; pack?: Float32Array[]; growl?: Float32Array } = {};
const steps: (() => void)[] = [
  () => (part.body = voice(SR, { ...MAIN, seed: 41 })),
  // Chest resonance an octave lower: almost only the fundamental, which builds up body size without making the pitch sound lower
  () => (part.low = voice(SR, { ...MAIN, seed: 42, pitch: MAIN.pitch.map(([t, f]) => [t, f * 0.5 * 1.004]), open: MAIN.open.map(([t, o]) => [t, o * 0.45]), breath: 0.03, tilt: 1.5 })),
  ...PACK.map(([, , gain, v], j) => () => {
    const d = far(SR, voice(SR, { ...v, seed: 90 + j }), 1900);
    peakTo([d], gain);
    (part.pack ??= [])[j] = d;
  }),
  () => {
    const g = voice(SR, { ...GROWL, seed: 7 });
    peakTo([g], 0.9);
    part.growl = g;
  },
];
let waves: Waves | null = null;

function allWaves(): Waves {
  if (waves) return waves;
  while (steps.length) steps.shift()!();
  const body = part.body!;
  for (let i = 0; i < body.length; i++) body[i] += part.low![i] * 0.35;
  peakTo([body], 0.9);
  // The pack: placed left and right, farther away
  const len = Math.ceil(Math.max(...PACK.map(([s, , , v]) => s + v.len)) * SR);
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  PACK.forEach(([start, pan], j) => {
    const d = part.pack![j];
    const off = Math.floor(start * SR);
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < d.length && off + i < len; i++) {
      L[off + i] += d[i] * gl;
      R[off + i] += d[i] * gr;
    }
  });
  waves = { main: body, pack: [L, R], growl: part.growl! };
  return waves;
}

/** Called when the ultimate's script loads: fetch the audio files first; only if the files cannot be fetched, compute the synthesized fallback piece by piece during idle time */
export function warmWolf(): void {
  preloadSample(growlUrl);
  void sampleFetched(howlUrl).then((ok) => {
    if (ok) return;
    const idle = (cb: () => void): void => {
      const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(cb, { timeout: 1500 });
      else setTimeout(cb, 40);
    };
    const next = (): void => {
      if (waves || !steps.length) return;
      steps.shift()!();
      idle(next);
    };
    idle(next);
  });
}

let bufs: { ctx: BaseAudioContext; main: AudioBuffer; pack: AudioBuffer; growl: AudioBuffer } | null = null;

function buffers(ctx: BaseAudioContext): NonNullable<typeof bufs> {
  if (bufs?.ctx === ctx) return bufs;
  const w = allWaves();
  const mk = (chs: Float32Array[]): AudioBuffer => {
    const b = ctx.createBuffer(chs.length, chs[0].length, SR);
    chs.forEach((c, i) => b.getChannelData(i).set(c));
    return b;
  };
  bufs = { ctx, main: mk([w.main]), pack: mk(w.pack), growl: mk([w.growl]) };
  return bufs;
}

/** Valley: long reverb, on the dark side */
const VALLEY = { size: 3.6, damp: 0.6, pre: 0.05, er: 0.35 };

/** The long howl. Synthesized version: main howl in the center with a valley echo, the two distant wolves answering */
export function playHowl(gain = 1): void {
  if (playSample(howlUrl, { gain: gain * 0.6 })) return;
  const ctx = synth.ctx;
  if (!ctx) return;
  const b = buffers(ctx);
  const t = ctx.currentTime + 0.01;
  const out = ctx.createGain();
  out.gain.value = gain;
  out.connect(synth.sfx);
  const rev = ctx.createConvolver();
  rev.buffer = impulseBuffer(ctx, VALLEY);
  rev.connect(out);
  // The valley echo: darker and quieter each time
  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.43;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1600;
  const fb = ctx.createGain();
  fb.gain.value = 0.34;
  echo.connect(lp);
  lp.connect(fb).connect(echo);
  lp.connect(out);
  const send = (src: AudioNode, g: number, dest: AudioNode): void => {
    const s = ctx.createGain();
    s.gain.value = g;
    src.connect(s).connect(dest);
  };
  const main = ctx.createBufferSource();
  main.buffer = b.main;
  main.connect(out);
  send(main, 0.32, rev);
  send(main, 0.3, echo);
  const pack = ctx.createBufferSource();
  pack.buffer = b.pack;
  send(pack, 0.55, out);
  send(pack, 1.1, rev);
  main.start(t);
  pack.start(t);
  setTimeout(() => out.disconnect(), 11000);
}

/** Growl in the dark */
export function playGrowl(gain = 1): void {
  if (playSample(growlUrl, { gain: gain * 0.7 })) return;
  const ctx = synth.ctx;
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = buffers(ctx).growl;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(synth.sfx);
  src.start(ctx.currentTime + 0.01);
}
