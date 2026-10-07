// Offline synthesis: compute instrument samples directly in JS (Karplus-Strong for plucked strings, modal synthesis for bells and xylophone, additive synthesis for piano, the drum kit) and reverb impulse responses.
// Computed once and kept in a cache; playback needs only one AudioBufferSourceNode, so it uses almost no CPU at runtime.

/** Reproducible random numbers (the same note comes out the same every time) */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

/** RBJ biquad filter */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  private sr: number;
  constructor(sr: number, type: 'lp' | 'hp' | 'bp' | 'peak', f: number, q = 0.707, gainDb = 0) {
    this.sr = sr;
    this.set(type, f, q, gainDb);
  }
  set(type: 'lp' | 'hp' | 'bp' | 'peak', f: number, q = 0.707, gainDb = 0): void {
    const w = (2 * Math.PI * Math.min(f, this.sr * 0.45)) / this.sr;
    const cw = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
    if (type === 'lp') {
      b0 = (1 - cw) / 2;
      b1 = 1 - cw;
      b2 = b0;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else if (type === 'hp') {
      b0 = (1 + cw) / 2;
      b1 = -(1 + cw);
      b2 = b0;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else if (type === 'bp') {
      b0 = al;
      b1 = 0;
      b2 = -al;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else {
      const A = Math.pow(10, gainDb / 40);
      b0 = 1 + al * A;
      b1 = -2 * cw;
      b2 = 1 - al * A;
      a0 = 1 + al / A;
      a1 = -2 * cw;
      a2 = 1 - al / A;
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }
  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

export function normalize(d: Float32Array, peak = 0.9): Float32Array {
  let mx = 0;
  for (let i = 0; i < d.length; i++) mx = Math.max(mx, Math.abs(d[i]));
  if (mx > 0) {
    const k = peak / mx;
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
  return d;
}

/** 10 ms fade-out at the tail to avoid a click from truncation */
function tailFade(d: Float32Array, sr: number): Float32Array {
  const n = Math.min(d.length, Math.floor(sr * 0.01));
  for (let i = 0; i < n; i++) d[d.length - 1 - i] *= i / n;
  return d;
}

// ───────────────────────── Plucked string: Karplus-Strong ─────────────────────────

export interface KsOpts {
  /** Length in seconds */
  len: number;
  /** Seconds to decay to -60 dB (at this pitch) */
  t60: number;
  /** Pluck brightness 0-1 (low-pass on the excitation) */
  bright: number;
  /** Pluck position 0-0.5 (comb filter, the smaller the sharper) */
  pos: number;
  /** Weight of the loop filter (0.5 is darkest, the smaller the brighter) */
  s?: number;
  /** Detune of the second string (cents); 0 means a single string */
  detune?: number;
  seed?: number;
}

function ksString(sr: number, f: number, o: KsOpts, seed: number): Float32Array {
  const n = Math.floor(o.len * sr);
  const y = new Float32Array(n);
  const s = o.s ?? 0.5;
  const P = sr / f;
  const L = Math.max(2, Math.floor(P - s - 0.2));
  const frac = P - s - L;
  const C = (1 - frac) / (1 + frac);
  const g = Math.pow(10, -3 / (o.t60 * f));
  // Excitation: low-pass-filtered noise with a delayed copy subtracted (the pluck position)
  const r = rng(seed);
  const exc = new Float32Array(L + 1);
  let lp = 0;
  const a = 0.05 + 0.95 * o.bright;
  for (let i = 0; i <= L; i++) {
    lp += a * (r() - lp);
    exc[i] = lp;
  }
  const pd = Math.max(1, Math.floor(L * o.pos));
  let mean = 0;
  for (let i = 0; i <= L; i++) mean += exc[i];
  mean /= L + 1;
  let apIn = 0;
  let apOut = 0;
  for (let i = 0; i < n; i++) {
    let x = 0;
    if (i <= L) x = exc[i] - mean - (i >= pd ? exc[i - pd] - mean : 0);
    const d1 = i - L >= 0 ? y[i - L] : 0;
    const d2 = i - L - 1 >= 0 ? y[i - L - 1] : 0;
    const lpv = (1 - s) * d1 + s * d2;
    const ap = C * lpv + apIn - C * apOut;
    apIn = lpv;
    apOut = ap;
    y[i] = x + g * ap;
  }
  return y;
}

export function ks(sr: number, f: number, o: KsOpts): Float32Array {
  const y = ksString(sr, f, o, o.seed ?? Math.round(f * 7));
  if (o.detune) {
    const y2 = ksString(sr, f * Math.pow(2, o.detune / 1200), o, (o.seed ?? 3) + 991);
    for (let i = 0; i < y.length; i++) y[i] = 0.55 * (y[i] + y2[i]);
  }
  // Remove DC and soften the highest frequencies
  const hp = new Biquad(sr, 'hp', 40);
  const lpf = new Biquad(sr, 'lp', Math.min(12000, f * 24));
  for (let i = 0; i < y.length; i++) y[i] = lpf.run(hp.run(y[i]));
  return tailFade(normalize(y), sr);
}

// ───────────────────────── Modal: bells, xylophone, kalimba... ─────────────────────────

/** [frequency ratio, amplitude, decay seconds (T60)] */
export type Partial = [number, number, number];

export interface ModalOpts {
  len: number;
  /** Attack time (seconds) */
  attack?: number;
  /** Strike noise: amplitude, decay seconds, band-pass center (as a multiple of the fundamental, or absolute Hz) */
  click?: { amp: number; t: number; hz: number; q?: number };
  /** Pitch bend down on the attack (ratio; returns to 1 within bendT seconds) */
  bend?: number;
  bendT?: number;
  /** Tremolo (amplitude modulation): rate in Hz, depth 0-1 */
  trem?: [number, number];
  /** Add a detuned copy of each partial (cents), to produce a bell's beating */
  beat?: number;
  seed?: number;
}

export function modal(sr: number, f: number, parts: Partial[], o: ModalOpts): Float32Array {
  const n = Math.floor(o.len * sr);
  const y = new Float32Array(n);
  const nyq = sr * 0.45;
  const att = Math.max(1, Math.floor((o.attack ?? 0.001) * sr));
  const r = rng(o.seed ?? Math.round(f * 13));
  for (const [ratio, amp, t60] of parts) {
    const pf = f * ratio;
    if (pf >= nyq) continue;
    const copies = o.beat ? [1, Math.pow(2, o.beat / 1200)] : [1];
    for (const cm of copies) {
      const w0 = (2 * Math.PI * pf * cm) / sr;
      const k = Math.pow(10, -3 / (t60 * sr));
      let env = amp / copies.length;
      let ph = r() * 0.3;
      for (let i = 0; i < n; i++) {
        let w = w0;
        if (o.bend && o.bendT) {
          const tt = i / sr;
          w = w0 * (1 + (o.bend - 1) * Math.exp(-tt / o.bendT));
        }
        ph += w;
        y[i] += Math.sin(ph) * env;
        env *= k;
        if (env < 1e-6) break;
      }
    }
  }
  for (let i = 0; i < att && i < n; i++) y[i] *= i / att;
  if (o.click) {
    const c = o.click;
    const hz = c.hz < 40 ? c.hz * f : c.hz;
    const bp = new Biquad(sr, 'bp', hz, c.q ?? 1.2);
    const k = Math.pow(10, -3 / (c.t * sr));
    let env = c.amp;
    for (let i = 0; i < n && env > 1e-5; i++) {
      y[i] += bp.run(r()) * env;
      env *= k;
    }
  }
  if (o.trem) {
    const [rate, depth] = o.trem;
    for (let i = 0; i < n; i++) y[i] *= 1 - depth * 0.5 * (1 - Math.cos((2 * Math.PI * rate * i) / sr));
  }
  return tailFade(normalize(y), sr);
}

// ───────────────────────── Piano ─────────────────────────
//
// Modal synthesis: each partial of each string is a decaying oscillator. The parameters are calibrated against measurements of real pianos and piano recordings from Apple Loops:
// - 1 to 3 strings per note (1 for the bass, 2 for the low-mid, 3 for the rest); each string is out of tune by a fraction of a cent and has a slightly different inharmonicity coefficient,
//   and the beating between partials makes the sound alive rather than an electronic organ.
// - Two-stage decay: the vertical vibration of the string hands its energy quickly to the soundboard (dropping about 12 dB right after the attack), while the horizontal vibration leaves a long tail;
//   high partials get an extra loss proportional to the square of frequency (the Chaigne and Askenfelt string damping model).
// - Excitation spectrum: partial amplitude is about inversely proportional to the square root of frequency, then falls away past a knee; the hammer strikes at about 1/8 to 1/13 of the string length, so partials near that point are weak.
//   The sample is struck brightest (forte) and at playback is rolled off with a low-pass according to velocity (tone in instruments.ts): a light touch is dark, a hard strike bright.
// - Soundboard: a fixed set of resonance peaks shapes the body's timbre; on the attack, the low-frequency thud of the soundboard being struck, and the hammer's brief scrape.
// - Stretch tuning: bass slightly flat and treble slightly sharp (the Railsback curve), so octaves do not clash because of inharmonicity.

/** Stretch tuning (cents) */
export function pianoStretch(m: number): number {
  const d = m - 64;
  return Math.sign(d) * 0.004 * Math.pow(Math.abs(d), 2.2);
}

/** Inharmonicity coefficient: smallest in the low-mid register, growing toward the lowest notes and the treble */
function pianoB(m: number): number {
  return m <= 40 ? 6e-5 * Math.pow(2, (40 - m) / 14) : 6e-5 * Math.pow(2, (m - 40) / 9.3);
}

/** Seconds for the tail to decay 60 dB (fundamental) */
export const pianoSustain = (m: number): number => Math.min(30, Math.max(0.9, 30 * Math.pow(2, -(m - 21) / 19)));

/** Frequency response of the soundboard and body (dB): shared by every note of the same piano */
let boardDb: ((f: number) => number) | null = null;
function board(f: number): number {
  if (!boardDb) {
    const r = rng(90210);
    const modes: [number, number, number][] = [];
    for (let i = 0; i < 34; i++) {
      const fc = 70 * Math.pow(3200 / 70, (i + 0.5 + r() * 0.45) / 34);
      modes.push([fc, 4.5 * r(), 3 + 4 * Math.abs(r())]);
    }
    boardDb = (x) => {
      let g = 0;
      for (const [fc, gain, q] of modes) {
        const u = ((x - fc) * 2 * q) / fc;
        g += gain / (1 + u * u);
      }
      return g;
    };
  }
  // The soundboard radiates poorly at very low frequencies: it drops 12 dB per octave below 45 Hz
  const hp = 1 / Math.sqrt(1 + Math.pow(45 / f, 4));
  return Math.pow(10, boardDb(f) / 20) * hp;
}

/** Piano sample: soft is the soft voicing (felt, warm, used for narrative and the ending) */
export function piano(sr: number, m: number, soft = false): Float32Array {
  const r = rng(m * 31 + (soft ? 7 : 0));
  const f0 = 440 * Math.pow(2, (m - 69 + pianoStretch(m) / 100) / 12);
  const Ts = pianoSustain(m);
  const len = Math.min(9, Math.max(1.6, Ts * 0.85));
  const n = Math.floor(len * sr);
  const acc = new Float64Array(n);
  const nyq = sr * 0.45;
  const B = pianoB(m);
  // Strings: how many, each one's detuning (cents), and the differences in inharmonicity coefficient
  const nStr = m < 30 ? 1 : m < 42 ? 2 : 3;
  const strings: [number, number][] = [];
  for (let k = 0; k < nStr; k++) {
    const cents = nStr === 1 ? 0 : (k - (nStr - 1) / 2) * (0.9 + 0.6 * r()) + 0.35 * r();
    strings.push([f0 * Math.pow(2, cents / 1200), B * (1 + 0.02 * r())]);
  }
  // The knee of the excitation spectrum moves up with pitch; the soft voicing is darker
  const oct = Math.pow(2, (m - 40) / 24);
  const fk = (soft ? 650 : 1200) * oct;
  const fe = (soft ? 1700 : 3000) * oct;
  // Hammer strike point (as a fraction of string length): about 1/8 for the bass, about 1/13 for the treble
  const beta = 1 / (8 + Math.max(0, m - 21) * 0.058);
  // Decay: σ = base loss + b3·ω²; the early stage (handed over to the soundboard) is fast, the later stage (the tail) is slow
  const Tf = Ts / 3.2;
  const prompt = soft ? 0.66 : 0.72;
  const b3 = soft ? 1.4e-9 : 0.9e-9;
  for (let p = 1; p < 400; p++) {
    const fp = p * f0 * Math.sqrt(1 + B * p * p);
    if (fp > nyq) break;
    const lp = 1 / (1 + (fp / fk) * (fp / fk));
    const ex = Math.exp(-fp / fe);
    let amp = Math.sqrt((f0 / fp) * lp * ex);
    amp *= Math.abs(Math.sin(Math.PI * p * beta)) * 0.92 + 0.08;
    amp *= board(fp);
    if (amp < 3e-4) {
      if (fp > fk * 4) break;
      continue;
    }
    const w2 = Math.pow(2 * Math.PI * fp, 2);
    const s1 = 6.9 / Tf + b3 * w2;
    const s2 = 6.9 / Ts + b3 * w2;
    const k1 = Math.exp(-s1 / sr);
    const k2 = Math.exp(-s2 / sr);
    for (const [fs, Bs] of strings) {
      // Each partial is also shifted a tiny bit (string non-uniformity, bridge coupling), so the beats between strings do not all cancel neatly together
      const jit = nStr > 1 ? Math.pow(2, (0.45 * r()) / 1200) : 1;
      const w = (2 * Math.PI * p * fs * jit * Math.sqrt(1 + Bs * p * p)) / sr;
      const cw = Math.cos(w);
      const sw = Math.sin(w);
      // A struck string starts from rest: every partial starts from sin 0
      let re = 1;
      let im = 0;
      let e1 = (amp * prompt) / nStr;
      let e2 = (amp * (1 - prompt)) / nStr;
      const stop = amp * 1e-4 / nStr;
      for (let i = 0; i < n; i++) {
        acc[i] += im * (e1 + e2);
        const nr = re * cw - im * sw;
        im = re * sw + im * cw;
        re = nr;
        e1 *= k1;
        e2 *= k2;
        if (e1 + e2 < stop) break;
      }
    }
  }
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = acc[i];
  // Set the volume by the energy in the first 0.25 s after the attack (rather than the peak): every note sounds equally loud, and loudness is left to playback velocity
  let e = 0;
  const w = Math.min(n, Math.floor(sr * 0.25));
  for (let i = 0; i < w; i++) e += y[i] * y[i];
  const rms = Math.sqrt(e / w) || 1;
  // The soundboard thud when struck: a few low-frequency soundboard modes, brief; relatively noticeable in the treble (short strings, quiet string sound)
  const knockAmp = rms * (soft ? 0.35 : 0.55) * Math.min(1.6, Math.max(0.5, (m - 30) / 40));
  const knock: [number, number, number][] = [[96, 0.13, 1], [168, 0.09, 0.8], [281, 0.06, 0.6], [470, 0.035, 0.4]];
  for (const [fq, dec, a] of knock) {
    const bp = new Biquad(sr, 'bp', fq, 2.2);
    const kd = Math.pow(10, -3 / (dec * sr));
    let env = knockAmp * a * 6;
    for (let i = 0; i < n && env > 1e-6; i++) {
      y[i] += bp.run(r()) * env;
      env *= kd;
    }
  }
  // The hammer's scrape: mid-high frequencies, a few milliseconds
  const hb = new Biquad(sr, 'bp', Math.min(5000, 1400 + f0 * 2), 0.9);
  let he = rms * (soft ? 0.25 : 0.6);
  const hk = Math.pow(10, -3 / (0.006 * sr));
  for (let i = 0; i < n && he > 1e-6; i++) {
    y[i] += hb.run(r()) * he;
    he *= hk;
  }
  // Attack: it takes a moment for the hammer to push the string away (longer with the soft voicing's felt)
  const att = Math.floor(sr * (soft ? 0.004 : 0.0015));
  for (let i = 0; i < att && i < n; i++) y[i] *= i / att;
  const g = 0.25 / rms;
  for (let i = 0; i < n; i++) y[i] *= g;
  return tailFade(y, sr);
}

/** Electric piano (Rhodes feel): 1:1 FM, modulation index decaying over time, plus a tuning-fork tine ring in the highs */
export function epiano(sr: number, m: number): Float32Array {
  const f = 440 * Math.pow(2, (m - 69) / 12);
  const t60 = Math.max(1.2, 6 * Math.pow(0.5, (m - 48) / 24));
  const len = Math.min(5, t60 * 0.8);
  const n = Math.floor(len * sr);
  const y = new Float32Array(n);
  const w = (2 * Math.PI * f) / sr;
  const k = Math.pow(10, -3 / (t60 * sr));
  const kt = Math.pow(10, -3 / (0.35 * sr));
  let env = 1;
  let tine = 0.12;
  let pc = 0;
  let pm = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const I = 1.6 * Math.exp(-t / 0.3) + 0.35;
    pc += w;
    pm += w;
    y[i] = Math.sin(pc + I * Math.sin(pm)) * env + Math.sin(pc * 7.1) * tine;
    env *= k;
    tine *= kt;
  }
  const att = Math.floor(sr * 0.003);
  for (let i = 0; i < att; i++) y[i] *= i / att;
  return tailFade(normalize(y), sr);
}

// ───────────────────────── Drum kit and percussion ─────────────────────────

type Gen = (sr: number, m: number, seed: number) => Float32Array;

function buf(sr: number, len: number): Float32Array {
  return new Float32Array(Math.floor(sr * len));
}
const decay = (sr: number, t60: number) => Math.pow(10, -3 / (t60 * sr));

/** Swept sine (the drum body) */
function sweep(y: Float32Array, sr: number, f0: number, f1: number, tf: number, amp: number, t60: number, delay = 0): void {
  let ph = 0;
  let env = amp;
  const k = decay(sr, t60);
  for (let i = Math.floor(delay * sr); i < y.length; i++) {
    const t = i / sr - delay;
    const f = f1 + (f0 - f1) * Math.exp(-t / tf);
    ph += (2 * Math.PI * f) / sr;
    y[i] += Math.sin(ph) * env;
    env *= k;
    if (env < 1e-6) break;
  }
}

/** One hit of filtered noise */
function noiseHit(y: Float32Array, sr: number, seed: number, filters: [type: 'lp' | 'hp' | 'bp', f: number, q?: number][], amp: number, t60: number, attack = 0.0005, delay = 0): void {
  const r = rng(seed);
  const fl = filters.map(([t, f, q]) => new Biquad(sr, t, f, q ?? 0.8));
  const k = decay(sr, t60);
  let env = amp;
  const a = Math.max(1, attack * sr);
  const d0 = Math.floor(delay * sr);
  for (let i = d0; i < y.length; i++) {
    let x = r();
    for (const f of fl) x = f.run(x);
    const j = i - d0;
    y[i] += x * env * (j < a ? j / a : 1);
    if (j >= a) env *= k;
    if (env < 1e-6) break;
  }
}

/** 808-style metallic tone: six square waves (cymbal, tambourine) */
function metal(y: Float32Array, sr: number, base: number, amp: number, t60: number, hp: number, delay = 0): void {
  const ratios = [1, 1.483, 1.804, 2.546, 2.63, 3.897];
  const k = decay(sr, t60);
  const phs = ratios.map(() => 0);
  const bpf = new Biquad(sr, 'hp', hp, 0.7);
  const bp2 = new Biquad(sr, 'hp', hp, 0.7);
  let env = amp;
  for (let i = Math.floor(delay * sr); i < y.length; i++) {
    let x = 0;
    for (let j = 0; j < ratios.length; j++) {
      phs[j] += (base * ratios[j]) / sr;
      x += phs[j] % 1 < 0.5 ? 1 : -1;
    }
    y[i] += bp2.run(bpf.run(x / 6)) * env;
    env *= k;
    if (env < 1e-6) break;
  }
}

const sat = (y: Float32Array, drive: number): Float32Array => {
  for (let i = 0; i < y.length; i++) y[i] = Math.tanh(y[i] * drive) / Math.tanh(drive);
  return y;
};

export const DRUMS: Record<string, Gen> = {
  kick: (sr, _m, s) => {
    const y = buf(sr, 0.5);
    sweep(y, sr, 170, 46, 0.03, 1, 0.45);
    noiseHit(y, sr, s, [['lp', 6000]], 0.25, 0.012);
    return sat(y, 1.6);
  },
  /** Long-tailed bass drum (the ground rumble of electronic and epic music) */
  boom: (sr, _m, s) => {
    const y = buf(sr, 1.6);
    sweep(y, sr, 110, 34, 0.09, 1, 1.4);
    noiseHit(y, sr, s, [['lp', 900]], 0.3, 0.3, 0.002);
    return sat(y, 1.3);
  },
  snare: (sr, _m, s) => {
    const y = buf(sr, 0.45);
    sweep(y, sr, 260, 180, 0.02, 0.55, 0.14);
    sweep(y, sr, 400, 330, 0.02, 0.2, 0.08);
    noiseHit(y, sr, s, [['hp', 1400], ['lp', 9500]], 0.75, 0.28);
    return sat(y, 1.4);
  },
  /** Field snare (march, epic): the long tail of the snare wires */
  field: (sr, _m, s) => {
    const y = buf(sr, 0.7);
    sweep(y, sr, 230, 170, 0.03, 0.4, 0.2);
    noiseHit(y, sr, s, [['hp', 900], ['lp', 7000], ['bp', 3200, 0.6]], 0.8, 0.55);
    return y;
  },
  rim: (sr, _m, s) => {
    const y = buf(sr, 0.15);
    sweep(y, sr, 520, 500, 0.01, 0.5, 0.05);
    noiseHit(y, sr, s, [['bp', 1800, 2]], 0.8, 0.03);
    return y;
  },
  clap: (sr, _m, s) => {
    const y = buf(sr, 0.5);
    for (let i = 0; i < 4; i++) noiseHit(y, sr, s + i, [['bp', 1250, 1.4]], i === 3 ? 0.9 : 0.55, i === 3 ? 0.25 : 0.02, 0.0005, i * 0.009);
    return y;
  },
  hat: (sr, _m, s) => {
    const y = buf(sr, 0.12);
    metal(y, sr, 330, 0.7, 0.05, 7000);
    noiseHit(y, sr, s, [['hp', 8000]], 0.25, 0.04);
    return y;
  },
  ohat: (sr, _m, s) => {
    const y = buf(sr, 0.6);
    metal(y, sr, 330, 0.6, 0.45, 6500);
    noiseHit(y, sr, s, [['hp', 7000]], 0.2, 0.35);
    return y;
  },
  ride: (sr, _m, s) => {
    const y = buf(sr, 2.2);
    metal(y, sr, 410, 0.35, 1.8, 4000);
    sweep(y, sr, 3400, 3400, 1, 0.08, 1.2);
    noiseHit(y, sr, s, [['hp', 6000]], 0.1, 0.6);
    return y;
  },
  crash: (sr, _m, s) => {
    const y = buf(sr, 3.2);
    metal(y, sr, 290, 0.35, 2.4, 3500);
    noiseHit(y, sr, s, [['hp', 3000], ['lp', 12000]], 0.7, 2.6, 0.003);
    return y;
  },
  /** Reversed cymbal: sucked in toward the next beat */
  swell: (sr, m, s) => {
    const y = DRUMS.crash(sr, m, s).slice(0, Math.floor(sr * 1.6));
    y.reverse();
    const n = Math.floor(sr * 0.01);
    for (let i = 0; i < n; i++) y[y.length - 1 - i] *= i / n;
    return y;
  },
  shaker: (sr, _m, s) => {
    const y = buf(sr, 0.14);
    noiseHit(y, sr, s, [['bp', 6500, 1.1], ['hp', 3500]], 0.9, 0.07, 0.012);
    return y;
  },
  tamb: (sr, _m, s) => {
    const y = buf(sr, 0.35);
    for (let i = 0; i < 3; i++) metal(y, sr, 520 + i * 37, 0.3, 0.18, 7500, i * 0.006);
    noiseHit(y, sr, s, [['hp', 6000]], 0.3, 0.16);
    return y;
  },
  /** Taiko: big and low, the slap of leather + a long drum body */
  taiko: (sr, m, s) => {
    const y = buf(sr, 1.4);
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 62;
    sweep(y, sr, f * 1.6, f, 0.025, 1, 1.1);
    sweep(y, sr, f * 2.6, f * 1.52, 0.02, 0.25, 0.4);
    noiseHit(y, sr, s, [['lp', 900]], 0.5, 0.08);
    noiseHit(y, sr, s + 1, [['bp', 2200, 0.8]], 0.12, 0.03);
    return sat(y, 1.5);
  },
  /** Frame drum (a tambourine without jingles, the hand drum): a low thud + the slap of fingers */
  frame: (sr, m, s) => {
    const y = buf(sr, 0.6);
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 95;
    sweep(y, sr, f * 1.3, f, 0.02, 0.8, 0.45);
    noiseHit(y, sr, s, [['bp', 1400, 1]], 0.35, 0.03);
    return y;
  },
  /** Darbuka: below C4 is the doum (low), above is the tek (high, crisp) */
  darbuka: (sr, m, s) => {
    const y = buf(sr, 0.5);
    if (m && m < 60) {
      sweep(y, sr, 150, 105, 0.02, 1, 0.4);
      noiseHit(y, sr, s, [['lp', 1200]], 0.2, 0.03);
    } else {
      sweep(y, sr, 900, 820, 0.01, 0.4, 0.06);
      noiseHit(y, sr, s, [['bp', 3200, 1.4]], 0.9, 0.025);
    }
    return y;
  },
  tom: (sr, m, s) => {
    const y = buf(sr, 0.8);
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 110;
    sweep(y, sr, f * 1.5, f, 0.04, 1, 0.55);
    noiseHit(y, sr, s, [['bp', 1100, 0.8]], 0.2, 0.05);
    return sat(y, 1.3);
  },
  /** Timpani: slightly inharmonic partials, mallet-head noise */
  timpani: (sr, m, s) => {
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 73;
    const y = modal(sr, f, [[1, 1, 2.2], [1.504, 0.55, 1.4], [1.742, 0.3, 1.1], [2.0, 0.25, 0.9], [2.245, 0.15, 0.7]], { len: 2.4, bend: 1.03, bendT: 0.03, click: { amp: 0.25, t: 0.06, hz: 380, q: 0.7 }, seed: s });
    return y;
  },
  woodblock: (sr, m, s) => {
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 1100;
    return modal(sr, f, [[1, 1, 0.09], [2.53, 0.3, 0.05]], { len: 0.2, click: { amp: 0.3, t: 0.01, hz: 3000 }, seed: s });
  },
  clave: (sr, _m, s) => modal(sr, 2500, [[1, 1, 0.12], [2.7, 0.2, 0.05]], { len: 0.2, seed: s }),
  /** Anvil: a smith's metallic strike (by pitch) */
  anvil: (sr, m, s) => {
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 1320;
    return modal(sr, f, [[1, 1, 1.8], [2.03, 0.5, 1.2], [3.31, 0.35, 0.8], [4.62, 0.2, 0.5], [6.9, 0.12, 0.3]], { len: 2, beat: 3, click: { amp: 0.8, t: 0.012, hz: 5000, q: 0.6 }, seed: s });
  },
  /** Gong (tam-tam): a metallic cloud that slowly blooms */
  gong: (sr, m, s) => {
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 90;
    const r = rng(s + 5);
    const parts: Partial[] = [];
    for (let i = 0; i < 26; i++) parts.push([1 + i * 0.37 + r() * 0.15 + (i > 6 ? i * i * 0.02 : 0), 1 / (1 + i * 0.25), 5 - i * 0.12]);
    const y = modal(sr, f, parts, { len: 6, attack: 0.25, beat: 4, seed: s });
    return y;
  },
  /** Thunder: distant rolling low frequencies */
  thunder: (sr, _m, s) => {
    const y = buf(sr, 5);
    const r = rng(s);
    const lp = new Biquad(sr, 'lp', 260, 0.7);
    const lp2 = new Biquad(sr, 'lp', 400, 0.7);
    let env = 0;
    let target = 1;
    let brown = 0;
    for (let i = 0; i < y.length; i++) {
      const t = i / sr;
      if (i % 2400 === 0) target = Math.max(0, 1 - t / 4.5) * (0.4 + 0.6 * Math.abs(r()));
      env += (target - env) * 0.0008;
      brown = brown * 0.985 + r() * 0.15;
      y[i] = lp2.run(lp.run(brown)) * env * (t < 0.05 ? t / 0.05 : 1);
    }
    noiseHit(y, sr, s + 3, [['bp', 700, 0.6]], 0.25, 0.4, 0.004);
    return normalize(y);
  },
  /** Close thunderclap: first a tearing crack, then right after a dull boom, then rolling out into several waves of thunder from near to far */
  thunderclap: (sr, _m, s) => {
    const y = buf(sr, 6);
    const r = rng(s);
    noiseHit(y, sr, s, [['hp', 900]], 1, 0.35, 0.0005);
    let t = 0.01;
    for (let i = 0; i < 14; i++) {
      t += 0.008 + Math.abs(r()) * 0.03 * (1 + i * 0.25);
      noiseHit(y, sr, s + 10 + i, [['bp', 1800 + Math.abs(r()) * 3000, 0.9]], 0.5 * Math.pow(0.85, i), 0.06, 0.0003, t);
    }
    noiseHit(y, sr, s + 40, [['lp', 180], ['lp', 180]], 1.4, 1.6, 0.004, 0.02);
    const lp = new Biquad(sr, 'lp', 320, 0.7);
    const lp2 = new Biquad(sr, 'lp', 500, 0.7);
    let env = 0;
    let target = 1;
    let brown = 0;
    for (let i = 0; i < y.length; i++) {
      const tt = i / sr;
      if (i % 3000 === 0) target = Math.max(0, 1 - tt / 5.5) * (0.3 + 0.7 * Math.abs(r()));
      env += (target - env) * 0.0006;
      brown = brown * 0.985 + r() * 0.15;
      y[i] += lp2.run(lp.run(brown)) * env * 2.2 * Math.min(1, tt / 0.15);
    }
    return normalize(sat(y, 1.2));
  },
  /** Chains clashing (the cult, the forge) */
  chain: (sr, _m, s) => {
    const y = buf(sr, 0.6);
    const r = rng(s);
    for (let i = 0; i < 9; i++) {
      const t = Math.abs(r()) * 0.35;
      const f = 2200 + Math.abs(r()) * 3000;
      const part = modal(sr, f, [[1, 1, 0.12], [1.7, 0.6, 0.08], [2.9, 0.3, 0.05]], { len: 0.2, seed: s + i });
      const off = Math.floor(t * sr);
      for (let j = 0; j < part.length && off + j < y.length; j++) y[off + j] += part[j] * (0.3 + 0.2 * Math.abs(r()));
    }
    return normalize(y);
  },
  /** Finger castanets / finger snap */
  snap: (sr, _m, s) => {
    const y = buf(sr, 0.12);
    noiseHit(y, sr, s, [['bp', 2600, 3]], 1, 0.025);
    return y;
  },
  /** A brush sweeping past, like a maidenhair fern (jazz brush) */
  brush: (sr, _m, s) => {
    const y = buf(sr, 0.3);
    noiseHit(y, sr, s, [['bp', 4200, 0.7]], 0.8, 0.18, 0.03);
    return y;
  },
  /** Water drop (cave, inside the tower) */
  drip: (sr, m, s) => {
    const y = buf(sr, 0.4);
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 1400;
    let ph = 0;
    let env = 1;
    const k = decay(sr, 0.12);
    for (let i = 0; i < y.length; i++) {
      const t = i / sr;
      ph += (2 * Math.PI * f * (1 + 1.6 * Math.exp(-t / 0.012))) / sr;
      y[i] = Math.sin(ph) * env * Math.min(1, t / 0.001);
      env *= k;
    }
    void s;
    return y;
  },
};

// ───────────────────────── Reverb ─────────────────────────

export interface SpaceOpts {
  /** Reverb time (seconds, decay by 60 dB) */
  size: number;
  /** 0 bright to 1 dark (how fast the highs decay) */
  damp?: number;
  /** Pre-delay (seconds) */
  pre?: number;
  /** Early reflection amount 0-1 */
  er?: number;
  /** Attack time (seconds); above 0 it is a reverb that "grows in" (a reversed feel, the void) */
  bloom?: number;
}

/** Generate a stereo impulse response: decaying noise, with the highs eaten away over time */
export function impulse(sr: number, o: SpaceOpts): [Float32Array, Float32Array] {
  const len = Math.floor(sr * Math.min(8, o.size * 1.15 + (o.pre ?? 0) + 0.05));
  const pre = Math.floor((o.pre ?? 0.012) * sr);
  const damp = o.damp ?? 0.45;
  const out: [Float32Array, Float32Array] = [new Float32Array(len), new Float32Array(len)];
  for (let ch = 0; ch < 2; ch++) {
    const r = rng(1234 + ch * 777);
    const d = out[ch];
    const k = Math.pow(10, -3 / (o.size * sr));
    let env = 1;
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      // The low-pass coefficient shrinks over time: darker toward the end
      const a = Math.max(0.02, (1 - damp * 0.85) * Math.exp((-t * damp * 3) / Math.max(0.5, o.size)));
      lp += a * (r() - lp);
      let v = lp * env;
      if (o.bloom) v *= 1 - Math.exp(-t / o.bloom);
      d[i] = v;
      env *= k;
    }
    // Early reflections
    const er = o.er ?? 0.3;
    if (er > 0) {
      for (let j = 0; j < 8; j++) {
        const at = pre + Math.floor((0.004 + Math.abs(r()) * 0.06) * sr);
        if (at < len) d[at] += er * (0.5 + 0.5 * Math.abs(r())) * (r() > 0 ? 1 : -1) * 0.6;
      }
    }
  }
  // Energy normalization: rooms of different sizes come out equally loud
  let e = 0;
  for (const d of out) for (let i = 0; i < d.length; i++) e += d[i] * d[i];
  const g = 1 / Math.sqrt(e / 2 + 1e-9);
  for (const d of out) for (let i = 0; i < d.length; i++) d[i] *= g * 0.5;
  return out;
}

// ───────────────────────── Short sampled notes (for fast figures, much cheaper than live synthesis) ─────────────────────────

/** Spiccato strings: a set of detuned sawtooth harmonics, body resonance, the rustle of the bow hair, very short */
export function spicc(sr: number, m: number): Float32Array {
  const f = 440 * Math.pow(2, (m - 69) / 12);
  const y = new Float32Array(Math.floor(sr * 0.42));
  const nyq = sr * 0.42;
  const body = (hz: number) => 0.4 + 1.2 / (1 + ((hz - 450) / 250) ** 2) + 0.7 / (1 + ((hz - 1300) / 500) ** 2) + 0.5 / (1 + ((hz - 3000) / 900) ** 2);
  const r = rng(m * 5 + 1);
  for (const det of [-7, 0, 7]) {
    const ff = f * Math.pow(2, det / 1200);
    for (let k = 1; k < 40; k++) {
      const hz = ff * k;
      if (hz > nyq) break;
      const amp = (body(hz) / k) / (1 + (hz / 4500) ** 2);
      const w = (2 * Math.PI * hz) / sr;
      let ph = r() * Math.PI;
      for (let i = 0; i < y.length; i++) {
        ph += w;
        y[i] += Math.sin(ph) * amp;
      }
    }
  }
  const noise = new Biquad(sr, 'bp', Math.min(7000, f * 5), 1.2);
  for (let i = 0; i < y.length; i++) {
    const t = i / sr;
    const env = Math.min(1, t / 0.008) * (0.25 + 0.75 * Math.exp(-t / 0.06)) * Math.exp(-t / 0.22);
    y[i] = y[i] * env + noise.run(r()) * 0.6 * Math.exp(-t / 0.03);
  }
  return tailFade(normalize(y), sr);
}

/** Brass stab: a short note where the filter blows open quickly and then closes again */
export function brassStab(sr: number, m: number): Float32Array {
  const f = 440 * Math.pow(2, (m - 69) / 12);
  const y = new Float32Array(Math.floor(sr * 0.55));
  const nyq = sr * 0.42;
  const r = rng(m * 3 + 9);
  const cut = (t: number) => f * (1.2 + 5 * Math.min(1, t / 0.035) * Math.exp(-t / 0.35));
  for (const det of [-6, 6]) {
    const ff = f * Math.pow(2, det / 1200);
    for (let k = 1; k < 36; k++) {
      const hz = ff * k;
      if (hz > nyq) break;
      const w = (2 * Math.PI * hz) / sr;
      let ph = r() * Math.PI;
      for (let i = 0; i < y.length; i++) {
        ph += w;
        const c = cut(i / sr);
        y[i] += (Math.sin(ph) / Math.pow(k, 1.05)) / (1 + (hz / c) ** 2);
      }
    }
  }
  for (let i = 0; i < y.length; i++) {
    const t = i / sr;
    y[i] *= Math.min(1, t / 0.012) * Math.exp(-t / 0.28);
  }
  return tailFade(normalize(y), sr);
}

// ───────────────────────── Ambience (seamless loops computed in advance) ─────────────────────────

/** Crossfade the tail into the beginning, making a sample that loops seamlessly */
function seamless(y: Float32Array, sr: number, xf = 1): Float32Array {
  const n = Math.floor(xf * sr);
  const out = y.slice(0, y.length - n);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    out[i] = out[i] * Math.sqrt(k) + y[y.length - n + i] * Math.sqrt(1 - k);
  }
  return out;
}

/** Band-pass noise that varies over time: centers(t) gives the center frequency */
function movingBand(y: Float32Array, sr: number, seed: number, q: number, amp: number, center: (t: number) => number, gain: (t: number) => number = () => 1): void {
  const r = rng(seed);
  const bq = new Biquad(sr, 'bp', center(0), q);
  for (let i = 0; i < y.length; i++) {
    if (i % 64 === 0) bq.set('bp', center(i / sr), q);
    y[i] += bq.run(r()) * amp * gain(i / sr);
  }
}

const smoothWalk = (seed: number, len: number, step: number) => {
  const r = rng(seed);
  const pts = Array.from({ length: Math.ceil(len / step) + 2 }, () => Math.abs(r()));
  pts[pts.length - 1] = pts[0];
  return (t: number) => {
    const x = t / step;
    const i = Math.floor(x);
    const k = x - i;
    const a = pts[i % pts.length];
    const b = pts[(i + 1) % pts.length];
    return a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * k));
  };
};

export const AMB: Record<string, (sr: number, seed: number) => Float32Array> = {
  /** Wind: two band-pass noises that wander slowly in frequency, with an occasional strong gust */
  wind: (sr, s) => {
    const len = 13;
    const y = new Float32Array(Math.floor(sr * len));
    const w1 = smoothWalk(s, len, 1.3);
    const w2 = smoothWalk(s + 5, len, 0.9);
    const gust = smoothWalk(s + 9, len, 2.2);
    movingBand(y, sr, s, 3, 1, (t) => 350 + w1(t) * 900, (t) => 0.4 + gust(t));
    movingBand(y, sr, s + 1, 9, 0.8, (t) => 1100 + w2(t) * 1800, (t) => 0.2 + gust(t) * gust(t));
    return seamless(normalize(y), sr, 1.5);
  },
  /** Sea: low surging waves (period 5.5 s) + the hiss of spray */
  sea: (sr, s) => {
    const period = 5.5;
    const len = period * 2 + 1.5;
    const y = new Float32Array(Math.floor(sr * len));
    const r = rng(s);
    const lp = new Biquad(sr, 'lp', 420, 0.6);
    const hp = new Biquad(sr, 'hp', 3000, 0.5);
    for (let i = 0; i < y.length; i++) {
      const t = i / sr;
      const ph = (t % period) / period;
      const swell = 0.25 + 0.75 * Math.pow(Math.sin(Math.PI * ph), 2);
      const foam = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (ph - 0.35) / 0.4)))) ** 3;
      const x = r();
      y[i] = lp.run(x) * swell * 1.4 + hp.run(x) * foam * 0.25;
    }
    return seamless(normalize(y), sr, 1.5);
  },
  /** Fire: low-frequency roar + random crackles */
  fire: (sr, s) => {
    const len = 9;
    const y = new Float32Array(Math.floor(sr * len));
    const r = rng(s);
    const lp = new Biquad(sr, 'lp', 160, 0.8);
    const roar = smoothWalk(s + 2, len, 0.7);
    for (let i = 0; i < y.length; i++) y[i] = lp.run(r()) * (0.6 + 0.6 * roar(i / sr)) * 2.2;
    for (let t = 0.05; t < len - 1.2; t += 0.03 + Math.abs(r()) * 0.3) {
      const bq = new Biquad(sr, 'bp', 1800 + Math.abs(r()) * 3500, 2);
      const a = 0.15 + Math.abs(r()) * 0.45;
      const i0 = Math.floor(t * sr);
      for (let j = 0; j < sr * 0.03 && i0 + j < y.length; j++) y[i0 + j] += bq.run(r()) * a * Math.exp(-j / (sr * 0.004));
    }
    return seamless(normalize(y), sr, 1);
  },
  /** Crickets: 4.4 kHz pulses, in bursts */
  crickets: (sr, s) => {
    const len = 8;
    const y = new Float32Array(Math.floor(sr * len));
    const r = rng(s);
    for (const [hz, rate, amp] of [[4400, 28, 1], [5100, 34, 0.6]] as const) {
      let ph = 0;
      let on = 0;
      for (let i = 0; i < y.length; i++) {
        const t = i / sr;
        if (i % Math.floor(sr * 0.45) === 0) on = Math.abs(r()) > 0.4 ? 1 : 0;
        ph += (2 * Math.PI * hz) / sr;
        const pulse = Math.sin(Math.PI * ((t * rate) % 1)) ** 4;
        y[i] += Math.sin(ph) * pulse * on * amp;
      }
    }
    const lp = new Biquad(sr, 'lp', 6000, 0.7);
    for (let i = 0; i < y.length; i++) y[i] = lp.run(y[i]);
    return seamless(normalize(y), sr, 0.6);
  },
  /** Rain: the hiss of high-frequency noise + scattered water drops */
  rain: (sr, s) => {
    const len = 8;
    const y = new Float32Array(Math.floor(sr * len));
    const r = rng(s);
    const hp = new Biquad(sr, 'hp', 1800, 0.5);
    const lp = new Biquad(sr, 'lp', 9000, 0.5);
    for (let i = 0; i < y.length; i++) y[i] = lp.run(hp.run(r())) * 0.5;
    for (let t = 0.1; t < len - 1; t += 0.01 + Math.abs(r()) * 0.06) {
      const i0 = Math.floor(t * sr);
      const a = Math.abs(r()) * 0.6;
      for (let j = 0; j < 200 && i0 + j < y.length; j++) y[i0 + j] += r() * a * Math.exp(-j / 30);
    }
    return seamless(normalize(y), sr, 1);
  },
  /** Void: slowly moving narrow-band noise, low-frequency sines in a tritone (the Rift) */
  void: (sr, s) => {
    const len = 14;
    const y = new Float32Array(Math.floor(sr * len));
    const w = smoothWalk(s, len, 3.5);
    movingBand(y, sr, s, 14, 2.5, (t) => 110 + w(t) * 500);
    for (const [hz, a] of [[55, 0.35], [77.8, 0.2], [110.3, 0.12]] as const) {
      const k = Math.round(hz * (len - 2)) / (len - 2);
      for (let i = 0; i < y.length; i++) y[i] += Math.sin((2 * Math.PI * k * i) / sr) * a * (0.6 + 0.4 * Math.sin((2 * Math.PI * i) / sr / 7));
    }
    return seamless(normalize(y), sr, 2);
  },
  /** Cave: very low air sound (inside the tower, canyon floor) */
  cave: (sr, s) => {
    const len = 10;
    const y = new Float32Array(Math.floor(sr * len));
    const w = smoothWalk(s, len, 2.5);
    movingBand(y, sr, s, 1.2, 1, (t) => 90 + w(t) * 120);
    movingBand(y, sr, s + 3, 6, 0.25, (t) => 600 + w(t) * 300);
    return seamless(normalize(y), sr, 1.5);
  },
};

// ───────────────────────── Plucked string (additive): bass plucks ─────────────────────────

export interface PluckOpts {
  len: number;
  /** Seconds for the fundamental to decay to -60 dB; higher harmonics progressively faster */
  t60: number;
  /** Pluck position 0-0.5 (decides which harmonics are weakened) */
  pos: number;
  /** Harmonic slope (the larger, the darker) */
  tilt: number;
  /** Frequencies of the body resonances (Hz): they sound together at the instant of the pluck and vanish quickly */
  body: number[];
  /** Amount of the finger's dull thump */
  thump: number;
}

/**
 * Additive-synthesis plucked string: each harmonic decays on its own (the higher, the faster), slightly inharmonic, plus body resonance and the finger's dull thump.
 * In the bass range Karplus-Strong decays down to a pure sine (like a synthesizer); this model keeps the woody mid-range.
 */
export function pluckAdd(sr: number, f: number, o: PluckOpts): Float32Array {
  const n = Math.floor(o.len * sr);
  const y = new Float32Array(n);
  const nyq = Math.min(sr * 0.42, 7000);
  const B = 0.00012;
  const r = rng(Math.round(f * 11));
  for (let h = 1; h <= 40; h++) {
    const fh = h * f * Math.sqrt(1 + B * h * h);
    if (fh > nyq) break;
    const amp = (Math.abs(Math.sin(Math.PI * h * o.pos)) + 0.05) / Math.pow(h, o.tilt);
    const t60 = o.t60 / (1 + 0.45 * (h - 1));
    const k = Math.pow(10, -3 / (t60 * sr));
    const w = (2 * Math.PI * fh) / sr;
    let env = amp;
    let ph = r() * 0.2;
    for (let i = 0; i < n && env > 1e-6; i++) {
      ph += w;
      y[i] += Math.sin(ph) * env;
      env *= k;
    }
  }
  for (const hz of o.body) {
    const w = (2 * Math.PI * hz) / sr;
    const k = Math.pow(10, -3 / (0.22 * sr));
    let env = 0.35;
    for (let i = 0; i < n && env > 1e-6; i++) {
      y[i] += Math.sin(w * i) * env;
      env *= k;
    }
  }
  const lp = new Biquad(sr, 'lp', 350, 0.7);
  const kt = Math.pow(10, -3 / (0.05 * sr));
  let env = o.thump;
  for (let i = 0; i < n && env > 1e-6; i++) {
    y[i] += lp.run(r()) * env * 3;
    env *= kt;
  }
  const att = Math.floor(sr * 0.003);
  for (let i = 0; i < att && i < n; i++) y[i] *= i / att;
  return tailFade(normalize(y), sr);
}
