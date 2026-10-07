// Offline synthesis of bowed string instruments: the whole of "a group of players bowing one note" is computed in advance, so playback only plays a sample and uses almost no CPU at runtime.
//
// Comparing against the spectra of real string recordings, there are three reasons the synthesized strings sound like brass:
//   1. Too clean: the overtones of real strings are smeared bands, with the scraping noise of the bow hair filling the space between partials; the synthesized ones are thin lines with pure black in between.
//   2. The ensemble is too fake: every player has different intonation, vibrato speed and bowing position, so the high partials spread out; two oscillators vibrating in sync are just a chorus.
//   3. The body is not messy enough: a wooden body has dozens of narrow, irregular resonances, and as the vibrato sweeps the partials across them their strength keeps flickering.
// So here every player is computed separately: a fixed intonation offset, slowly drifting intonation, their own vibrato, their own bowing point (the comb notches fall at different positions),
// and bow noise that appears in sync with each slip of the bow on the string; all of that is summed and then passed through a body of several dozen modes.
//
// The sample has two parts: the attack (the bow has just gripped the string, vibrato has not begun) and a sustain section that can loop seamlessly.
// All the modulation in the sustain section (vibrato, intonation drift, bow-pressure swell, bow noise) has the loop length as its period,
// and each player's frequency is also fine-tuned so that it covers a whole number of periods within the loop length, so there is no seam at the loop point.

import { rng } from './dsp.ts';

/** Body: a spectral envelope ([Hz, dB] polyline) plus narrow modes scattered according to the envelope */
export interface BodyDef {
  seed: number;
  env: [number, number][];
  lo: number;
  hi: number;
  /** Modes per octave */
  density: number;
  /** Q of the modes: low end, high end */
  q: [number, number];
  /** Fraction passed straight through (not colored by the modes) */
  dry: number;
  /** How far each mode jumps above and below the envelope (dB): the larger it is, the more uneven the body */
  rand: number;
}

export interface BowDef {
  /** Number of players: 1 is a solo */
  players: number;
  /** Fixed intonation offset between players (cents, standard deviation) */
  spread: number;
  /** Intonation that each player slowly drifts (cents) */
  drift: number;
  vibRate: number;
  /** Vibrato depth (cents) */
  vibDepth: number;
  /** How long after the attack vibrato begins (seconds) */
  vibDelay: number;
  /** Range of the bowing point (fraction of the string length): each player sits somewhere in it */
  beta: [number, number];
  /** Bow pressure: the frequency where the partials begin to roll off extra, [soft, hard] */
  corner: [number, number];
  /** Sustained bow noise (relative to the string tone) */
  noise: number;
  /** Attack scrape sound */
  scrape: number;
  /** Attack time (seconds), [soft, hard] */
  attack: [number, number];
  /** Time offset at which players come in (seconds) */
  onset: number;
  /** How many cents below the note the attack slides up from */
  scoop: number;
  body: BodyDef;
  /** Loop section length (seconds) */
  loop: number;
}

export interface Bowed {
  data: Float32Array;
  /** Loop section: [start, end] (samples) */
  loop: [number, number];
}

/** Attack section length (seconds): the attack and the vibrato fade-in must both finish before it ends, and the body's resonances must have settled */
const PRE = 0.62;
const TABLE = 2048;
/** Modulation (frequency, volume) is computed once every few samples, with linear interpolation in between */
const CR = 16;

/** Polyline envelope (linear interpolation on a log frequency axis), returns dB */
function envAt(env: [number, number][], f: number): number {
  if (f <= env[0][0]) return env[0][1];
  for (let i = 1; i < env.length; i++) {
    if (f <= env[i][0]) {
      const [f0, d0] = env[i - 1];
      const [f1, d1] = env[i];
      return d0 + ((d1 - d0) * Math.log(f / f0)) / Math.log(f1 / f0);
    }
  }
  return env[env.length - 1][1];
}

/** One period of the bowed string: a sawtooth with the partials at integer multiples of the bowing point cut out, then rolled off by bow pressure; partials are only added up to maxF */
function bowTable(f: number, beta: number, corner: number, maxF: number): Float32Array {
  const t = new Float32Array(TABLE);
  const K = Math.max(1, Math.min(400, Math.floor(maxF / f)));
  for (let k = 1; k <= K; k++) {
    const hz = k * f;
    const a = ((0.1 + Math.abs(Math.sin(Math.PI * k * beta))) / k) / Math.sqrt(1 + (hz / corner) ** 2);
    // Compute sin(2πkn/N) with a rotation recurrence, much faster than calling Math.sin at every point
    const th = (2 * Math.PI * k) / TABLE;
    const c = Math.cos(th);
    const s = Math.sin(th);
    let x = 0;
    let y = 1;
    for (let n = 0; n < TABLE; n++) {
      t[n] += a * x;
      const nx = x * c + y * s;
      y = y * c - x * s;
      x = nx;
    }
  }
  let mx = 0;
  for (let n = 0; n < TABLE; n++) mx = Math.max(mx, Math.abs(t[n]));
  for (let n = 0; n < TABLE; n++) t[n] /= mx;
  return t;
}

interface Mode {
  b0: number;
  a1: number;
  a2: number;
  g: number;
}

/** Scatter modes according to the envelope (band-pass, peak 0 dB); each seed is a different instrument */
function bodyModes(sr: number, b: BodyDef): Mode[] {
  const r = rng(b.seed);
  const out: Mode[] = [];
  const oct = Math.log2(b.hi / b.lo);
  const n = Math.round(oct * b.density);
  for (let i = 0; i < n; i++) {
    const f = b.lo * Math.pow(2, ((i + 0.5 + r() * 0.45) / n) * oct);
    if (f > sr * 0.45) continue;
    const u = Math.log2(f / b.lo) / oct;
    const q = b.q[0] + (b.q[1] - b.q[0]) * u;
    const db = envAt(b.env, f) + r() * b.rand;
    const w = (2 * Math.PI * f) / sr;
    const al = Math.sin(w) / (2 * q);
    const a0 = 1 + al;
    out.push({ b0: al / a0, a1: (-2 * Math.cos(w)) / a0, a2: (1 - al) / a0, g: Math.pow(10, db / 20) });
  }
  return out;
}

/** Smooth 0 -> 1 */
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * Compute one bowed-string sample. f is the pitch (Hz), loud decides bow pressure (brightness, bow noise, attack), and seed makes the players different for every note.
 * The returned sample can loop seamlessly across the loop interval.
 */
export function bowSample(sr: number, f: number, d: BowDef, loud: boolean, seed: number): Bowed {
  const r = rng(seed * 7919 + Math.round(f * 13));
  // The attack section and the loop section are both integer multiples of CR, so the modulation's sample grid lines up at the loop's head and tail
  const LS = Math.round((d.loop * sr) / CR) * CR;
  const L = LS / sr;
  const A = Math.round((PRE * sr) / CR) * CR;
  const N = A + LS;
  const sum = new Float32Array(N);
  const corner = loud ? d.corner[1] : d.corner[0];
  const atk = loud ? d.attack[1] : d.attack[0];
  const maxF = sr * 0.4;

  // All players share one stretch of bow noise whose period is the loop length (each reads from a different position): high-pass then low-pass, running two passes so the filter state joins up head to tail
  const nz = new Float32Array(LS);
  {
    const raw = new Float32Array(LS);
    for (let i = 0; i < LS; i++) raw[i] = r();
    let lp = 0;
    let hp = 0;
    const al = 1 - Math.exp((-2 * Math.PI * 6000) / sr);
    const ah = 1 - Math.exp((-2 * Math.PI * 700) / sr);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < LS; i++) {
        lp += al * (raw[i] - lp);
        hp += ah * (lp - hp);
        if (pass) nz[i] = lp - hp;
      }
    }
  }

  const tables = new Map<number, Float32Array>();
  const T = (beta: number) => {
    const k = Math.round(beta * 200);
    let t = tables.get(k);
    if (!t) tables.set(k, (t = bowTable(f, k / 200, corner, maxF)));
    return t;
  };

  const P = d.players;
  for (let p = 0; p < P; p++) {
    const solo = P === 1;
    const beta = d.beta[0] + (d.beta[1] - d.beta[0]) * (solo ? 0.5 : (r() + 1) / 2);
    const tab = T(beta);
    // Vibrato: every player has a different speed, depth and phase; the frequency is set to a whole number of periods within the loop length
    const vr = Math.max(1, Math.round(d.vibRate * (1 + r() * 0.07) * L)) / L;
    const vd = d.vibDepth * (solo ? 1 : 0.9 + r() * 0.3);
    const vph = (r() + 1) * Math.PI;
    // Intonation drift: three slow sinusoids whose period is the loop length
    const dr: [number, number, number][] = [1, 2, 3].map((k) => [k / L, d.drift * r() * 0.6, (r() + 1) * Math.PI]);
    // Bow-pressure swell: a very slow volume change (±5%)
    const bw: [number, number] = [(1 + Math.round((r() + 1) * 1.5)) / L, (r() + 1) * Math.PI];
    const det = solo ? 0 : d.spread * r() * 1.2;
    const on = solo ? 0 : ((r() + 1) / 2) * d.onset;
    const scoop = d.scoop * (0.6 + 0.4 * Math.abs(r()));
    const cents = (t: number, v: number) => {
      let c = vd * v * (Math.sin(2 * Math.PI * vr * t + vph) + 0.12 * Math.sin(4 * Math.PI * vr * t + vph * 2));
      for (const [hz, a, ph] of dr) c += a * Math.sin(2 * Math.PI * hz * t + ph);
      return c;
    };
    // Frequency fine-tuning: the sustain section's mean frequency times the loop length must come out to exactly a whole number of periods
    let m = 0;
    const S = 2048;
    for (let i = 0; i < S; i++) m += Math.pow(2, cents(PRE + (i / S) * L, 1) / 1200);
    m /= S;
    const target = f * Math.pow(2, det / 1200);
    const F = Math.max(1, Math.round(target * m * L)) / (m * L);

    const nOff = Math.floor(((r() + 1) / 2) * LS);
    const nAmt = d.noise * (loud ? 1.35 : 1) * (solo ? 1 : 0.8 + 0.4 * Math.abs(r()));
    const slip = beta;
    const amp = solo ? 1 : 1 / Math.sqrt(P);
    // Control rate: once every CR samples compute the frequency (the phase increment per sample) and the volume
    const nc = N / CR + 2;
    const inc = new Float64Array(nc);
    const env = new Float64Array(nc);
    for (let c = 0; c < nc; c++) {
      const t = (c * CR) / sr;
      const ta = t - on;
      if (ta < 0) continue;
      const v = smooth((t - d.vibDelay) / 0.35);
      const sc = -scoop * Math.exp(-ta / 0.045);
      inc[c] = (F * Math.pow(2, (cents(t, v) + sc) / 1200)) / sr;
      // Attack: the bow grips the string (a hard bow overshoots a little and then comes back); after that comes a very slow bow-pressure swell
      let e = smooth(ta / atk);
      if (loud) e *= 1 + 0.22 * e * Math.exp(-Math.max(0, ta - atk) / 0.08);
      env[c] = amp * e * (1 + 0.05 * Math.sin(2 * Math.PI * bw[0] * t + bw[1]));
    }
    let ph = (r() + 1) / 2;
    const i0 = Math.floor((on * sr) / CR) * CR;
    for (let i = i0; i < N; i++) {
      const c = (i / CR) | 0;
      const u = (i - c * CR) / CR;
      ph += inc[c] + (inc[c + 1] - inc[c]) * u;
      if (ph >= 1) ph -= 1;
      const x = ph * TABLE;
      const j = x | 0;
      const fr = x - j;
      const s0 = tab[j];
      const tone = s0 + (tab[(j + 1) & (TABLE - 1)] - s0) * fr;
      // Bow noise appears along with the slip of the bow on the string (the short stretch at the start of each period)
      const nzv = nz[(i + nOff) % LS] * (ph < slip ? 1 : 0.3) * nAmt;
      sum[i] += (env[c] + (env[c + 1] - env[c]) * u) * (tone + nzv);
    }
  }

  // The highs come in a little later on the attack: a one-pole low-pass from dark to fully open (the sustain section passes straight through)
  {
    let y = 0;
    const end = Math.floor((atk * 1.6 + 0.05) * sr);
    for (let i = 0; i < N; i++) {
      if (i >= end) {
        y = sum[i];
        continue;
      }
      const u = smooth(i / end);
      const fc = f * 3 + (sr * 0.45 - f * 3) * u * u;
      const a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
      y += a * (sum[i] - y);
      sum[i] = y;
    }
  }

  // The attack's scrape (non-periodic, finishing within the attack section)
  if (d.scrape > 0) {
    const sc = d.scrape * (loud ? 1.4 : 0.7);
    let lp = 0;
    let hp = 0;
    const al = 1 - Math.exp((-2 * Math.PI * 5000) / sr);
    const ah = 1 - Math.exp((-2 * Math.PI * 900) / sr);
    const len = Math.min(A - 1, Math.floor((atk + 0.12) * sr));
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      lp += al * (r() - lp);
      hp += ah * (lp - hp);
      sum[i] += (lp - hp) * sc * smooth(t / 0.006) * Math.exp(-t / (atk * 0.6 + 0.03));
    }
  }

  // Body: the direct signal + a bank of narrow modes in parallel
  const modes = bodyModes(sr, d.body);
  const out = new Float32Array(N);
  const dry = d.body.dry;
  for (let i = 0; i < N; i++) out[i] = sum[i] * dry;
  for (const md of modes) {
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    const { b0, a1, a2, g } = md;
    for (let i = 0; i < N; i++) {
      const x = sum[i];
      const y = b0 * (x - x2) - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      out[i] += g * y;
    }
  }

  // Set the volume by the sustain section's RMS (every pitch equally loud, the soft and hard layers equally loud too; loudness is left to velocity)
  let e2 = 0;
  for (let i = A; i < N; i++) e2 += out[i] * out[i];
  const k = 0.2 / Math.sqrt(e2 / LS + 1e-12);
  for (let i = 0; i < N; i++) out[i] *= k;
  return { data: out, loop: [A, N] };
}

// ───────────────────────── Instruments ─────────────────────────

/** How a bowed instrument is sampled and played */
export interface BowInst {
  def: BowDef;
  /** One sample every how many semitones; the notes in between are made up with a rate change */
  zone: number;
  /** What fraction of the device sample rate to compute at (strings have almost nothing above 12 kHz, and bass instruments even less; saves memory and time) */
  rate: number;
  /** Attack and release at playback (seconds); a song's opts.attack / release can override them */
  attack: number;
  release: number;
  /** Velocity (times opts.bright) above this value uses the hard-bow layer */
  loudAt: number;
  /** Glide time constant (seconds) */
  glide: number;
  level: number;
  /** Share another instrument's samples (the same group of players, only played differently) */
  share?: string;
}

// Body envelope: [Hz, dB]. The violin has an air resonance at 280 Hz, a main resonance at 450-550 Hz, a dip around 1.4 kHz, and a bridge peak at 2.5 kHz
const VIOLIN_BODY: BodyDef = { seed: 11, lo: 200, hi: 9000, density: 9, q: [36, 16], dry: 0.1, rand: 7, env: [[200, -12], [280, 0], [480, 2], [560, 3], [720, -2], [1000, 0], [1400, -4], [1900, 3], [2400, 9], [3000, 6], [3800, -2], [5000, -10], [7000, -20], [9000, -28]] };
/** String section: the averaged body of violins and violas, flatter */
const SECTION_BODY: BodyDef = { seed: 41, lo: 160, hi: 8000, density: 6, q: [28, 12], dry: 0.22, rand: 5, env: [[150, -14], [240, -2], [350, 0], [500, 1], [700, -1], [1000, 0], [1400, -3], [2000, 0], [2600, 1], [3500, -5], [5000, -14], [8000, -26]] };
const CELLO_BODY: BodyDef = { seed: 23, lo: 80, hi: 6000, density: 9, q: [34, 14], dry: 0.1, rand: 7, env: [[70, -14], [100, -2], [150, 0], [220, 2], [350, 0], [500, -2], [700, 0], [1000, -3], [1800, 1], [2500, -3], [4000, -13], [6000, -24]] };
const BASS_BODY: BodyDef = { seed: 31, lo: 45, hi: 4000, density: 7, q: [26, 10], dry: 0.22, rand: 5, env: [[40, -10], [60, 0], [100, 2], [150, 0], [300, -2], [600, -4], [1000, -6], [1500, -10], [2500, -18], [4000, -28]] };
const FIDDLE_BODY: BodyDef = { seed: 53, lo: 220, hi: 10000, density: 9, q: [36, 16], dry: 0.1, rand: 7, env: [[220, -12], [300, 0], [520, 2], [800, -2], [1100, 0], [1500, -4], [2200, 2], [3000, 6], [4000, 0], [6000, -10], [10000, -24]] };
/** Morin khuur (horsehead fiddle): a skin-covered square body, a 900 Hz nasal tone, few highs */
const MORIN_BODY: BodyDef = { seed: 67, lo: 150, hi: 7000, density: 7, q: [26, 12], dry: 0.14, rand: 6, env: [[150, -12], [240, 0], [400, -2], [900, 6], [1300, -2], [1700, -7], [2400, -3], [3500, -13], [5000, -22], [7000, -30]] };

const section = (body: BodyDef, players: number): BowDef => ({
  players,
  spread: 9,
  drift: 6,
  vibRate: 5.4,
  vibDepth: 20,
  vibDelay: 0.2,
  beta: [0.07, 0.16],
  corner: [2600, 5200],
  noise: 0.1,
  scrape: 0.6,
  attack: [0.12, 0.06],
  onset: 0.04,
  scoop: 12,
  body,
  loop: 1.6,
});

const solo = (body: BodyDef, vibRate: number, vibDepth: number, beta: number, corner: [number, number], noise: number): BowDef => ({
  players: 1,
  spread: 0,
  drift: 3,
  vibRate,
  vibDepth,
  vibDelay: 0.18,
  beta: [beta, beta],
  corner,
  noise,
  scrape: 0.5,
  attack: [0.08, 0.045],
  onset: 0,
  scoop: 14,
  body,
  loop: 1.5,
});

export const BOWS: Record<string, BowInst> = {
  /** String section: seven players */
  strings: { def: section(SECTION_BODY, 7), zone: 3, rate: 0.75, attack: 0.02, release: 0.4, loudAt: 0.72, glide: 0.09, level: 0.89 },
  /** The slow version of the string section (soft, long): the same samples */
  strPad: { def: section(SECTION_BODY, 7), zone: 3, rate: 0.75, attack: 0.6, release: 0.9, loudAt: 2, glide: 0.09, level: 0.81, share: 'strings' },
  violin: { def: solo(VIOLIN_BODY, 5.6, 22, 0.113, [3000, 6000], 0.05), zone: 3, rate: 0.75, attack: 0.02, release: 0.25, loudAt: 0.72, glide: 0.09, level: 0.57 },
  cello: { def: solo(CELLO_BODY, 5.2, 18, 0.12, [1800, 3600], 0.05), zone: 3, rate: 0.5, attack: 0.02, release: 0.3, loudAt: 0.72, glide: 0.09, level: 0.66 },
  /** Folk fiddle: brighter, with faster vibrato */
  fiddle: { def: solo(FIDDLE_BODY, 6.2, 12, 0.09, [4000, 8000], 0.06), zone: 3, rate: 0.75, attack: 0.015, release: 0.2, loudAt: 0.72, glide: 0.07, level: 0.6 },
  /** Morin khuur: horsehair bow, lots of breath noise, wide slow vibrato */
  morin: { def: solo(MORIN_BODY, 4.4, 26, 0.15, [2200, 4000], 0.14), zone: 3, rate: 0.75, attack: 0.03, release: 0.3, loudAt: 0.72, glide: 0.14, level: 0.81 },
  /** Cello section: five players, for sustained notes and harmony in the low-mid register (use cello for solos) */
  celli: { def: { ...section(CELLO_BODY, 5), vibDepth: 16, corner: [1500, 3000] }, zone: 3, rate: 0.5, attack: 0.03, release: 0.4, loudAt: 0.72, glide: 0.1, level: 0.66 },
  /** Double bass section: three players */
  contrabass: { def: { ...section(BASS_BODY, 3), vibDepth: 8, corner: [900, 1800], spread: 4 }, zone: 3, rate: 0.5, attack: 0.03, release: 0.35, loudAt: 0.72, glide: 0.1, level: 0.61 },
};
