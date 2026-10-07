// Astralgate summon sounds: all synthesized live, routed through their own bus (a limiter against clipping, a short delay for a sense of space).
//   crystal shatter -> rune pitch rise -> meteor (Doppler) -> gate-opening boom -> rarity stinger (R bright / SR chord / SSR brass choir + sub-bass) -> element roar.

import type { Element } from '../../sim/types.ts';
import { synth } from './sfx.ts';

type Wave = OscillatorType;

/** Bus: every summon sound -> limiter -> sfx; a copy is also sent to a feedback delay for reverb */
class SummonBus {
  private ctx: AudioContext | null = null;
  dry!: GainNode;
  wet!: GainNode;

  get(): { ctx: AudioContext; dry: GainNode; wet: GainNode } | null {
    const ctx = synth.ctx;
    if (!ctx) return null;
    if (this.ctx !== ctx) {
      this.ctx = ctx;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -9;
      lim.knee.value = 4;
      lim.ratio.value = 16;
      lim.attack.value = 0.002;
      lim.release.value = 0.16;
      this.dry = ctx.createGain();
      this.dry.gain.value = 0.85;
      this.dry.connect(lim).connect(synth.sfx);
      // Reverb: two feedback delays + low-pass give the bells and choir a sense of space
      this.wet = ctx.createGain();
      this.wet.gain.value = 0.32;
      for (const [d, fb] of [[0.093, 0.42], [0.157, 0.36]] as const) {
        const del = ctx.createDelay(1);
        del.delayTime.value = d;
        const g = ctx.createGain();
        g.gain.value = fb;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3200;
        this.wet.connect(del).connect(lp).connect(g).connect(del);
        lp.connect(lim);
      }
    }
    return { ctx, dry: this.dry, wet: this.wet };
  }
}

const bus = new SummonBus();
const now = () => synth.now;

interface ToneOpts {
  type?: Wave;
  f0: number;
  f1?: number;
  dur: number;
  gain?: number;
  attack?: number;
  delay?: number;
  detune?: number;
  /** Reverb send amount (0-1) */
  wet?: number;
  /** Low-pass cutoff (softens the sawtooth) */
  cutoff?: number;
  /** Vibrato: depth (cents) and rate (Hz) */
  vib?: [number, number];
}

function tone(o: ToneOpts): void {
  const b = bus.get();
  if (!b) return;
  const { ctx, dry, wet } = b;
  const t = now() + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f0, t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
  if (o.detune) osc.detune.value = o.detune;
  if (o.vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.vib[1];
    const lg = ctx.createGain();
    lg.gain.value = o.vib[0];
    lfo.connect(lg).connect(osc.detune);
    lfo.start(t);
    lfo.stop(t + o.dur + 0.05);
  }
  const g = ctx.createGain();
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  let head: AudioNode = osc;
  if (o.cutoff) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.cutoff;
    osc.connect(lp);
    head = lp;
  }
  head.connect(g).connect(dry);
  if (o.wet) {
    const s = ctx.createGain();
    s.gain.value = o.wet;
    g.connect(s).connect(wet);
  }
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

interface NoiseOpts {
  dur: number;
  gain?: number;
  type?: BiquadFilterType;
  f0: number;
  f1?: number;
  q?: number;
  attack?: number;
  delay?: number;
  wet?: number;
  /** Filter frequency curve (normalized time -> frequency), more freeform than f0 -> f1 */
  curve?: (k: number) => number;
}

function noise(o: NoiseOpts): void {
  const b = bus.get();
  if (!b) return;
  const { ctx, dry, wet } = b;
  const t = now() + (o.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.Q.value = o.q ?? 1;
  if (o.curve) {
    const n = 32;
    const arr = new Float32Array(n);
    for (let i = 0; i < n; i++) arr[i] = Math.max(20, o.curve(i / (n - 1)));
    f.frequency.setValueCurveAtTime(arr, t, o.dur);
  } else {
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
  }
  const g = ctx.createGain();
  const a = o.attack ?? 0.003;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f).connect(g).connect(dry);
  if (o.wet) {
    const s = ctx.createGain();
    s.gain.value = o.wet;
    g.connect(s).connect(wet);
  }
  src.start(t, Math.random() * 1.5);
  src.stop(t + o.dur + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/** Bell: a fundamental plus inharmonic high partials (which decay faster), like a crystal being struck */
function bell(f: number, dur: number, gain: number, delay = 0, wet = 0.5): void {
  tone({ type: 'sine', f0: f, dur, gain, delay, wet });
  tone({ type: 'sine', f0: f * 2.76, dur: dur * 0.45, gain: gain * 0.35, delay, wet });
  tone({ type: 'triangle', f0: f * 5.4, dur: dur * 0.2, gain: gain * 0.12, delay, wet });
}

/** Choir voice: several slightly detuned triangle waves through a low-pass, with a slow attack */
function choir(f: number, dur: number, gain: number, delay = 0, attack = 0.25): void {
  for (const d of [-9, 0, 8]) tone({ type: 'triangle', f0: f, dur, gain: gain / 3, delay, attack, detune: d, cutoff: 1800, wet: 0.7, vib: [6, 5.2] });
  tone({ type: 'sine', f0: f * 2, dur: dur * 0.8, gain: gain * 0.18, delay, attack: attack * 1.4, wet: 0.7 });
}

/** Brass: a low-pass over several detuned sawtooth waves, with a slight "blat" to the attack */
function brass(f: number, dur: number, gain: number, delay = 0): void {
  for (const d of [-7, 0, 6]) tone({ type: 'sawtooth', f0: f, dur, gain: gain / 3, delay, attack: 0.045, detune: d, cutoff: 2600, wet: 0.35 });
  tone({ type: 'square', f0: f / 2, dur: dur * 0.9, gain: gain * 0.22, delay, attack: 0.05, cutoff: 900, wet: 0.2 });
}

const PENTA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
const v = () => 0.97 + Math.random() * 0.06;

export const summonSfx = {
  /** The starlight crystal shatters into specks of light: a run of glass shards, then an upward shimmer as the specks flow into the Astralgate */
  crystalShatter(dur = 0.6) {
    noise({ type: 'highpass', f0: 5000, dur: 0.12, gain: 0.3, wet: 0.3 });
    for (let i = 0; i < 9; i++) {
      const f = PENTA[Math.floor(Math.random() * PENTA.length)] * (i % 3 === 2 ? 2 : 1);
      bell(f * v(), 0.5, 0.07, i * 0.035 + Math.random() * 0.02, 0.6);
    }
    // Specks of light converge: the noise sweeps from the mid range up to high frequencies, getting brighter and brighter
    noise({ type: 'bandpass', f0: 900, f1: 6500, q: 3, dur, gain: 0.22, attack: dur * 0.6, wet: 0.4 });
    tone({ type: 'sine', f0: 660, f1: 2640, dur, gain: 0.05, attack: dur * 0.5, wet: 0.6 });
  },
  /** Runes light up in order: bell notes, each higher than the last (i / n) */
  runeNote(i: number, n: number) {
    const f = PENTA[Math.min(PENTA.length - 1, Math.round((i / Math.max(1, n - 1)) * 7))];
    bell(f, 0.9, 0.11, 0, 0.6);
    noise({ type: 'highpass', f0: 7000, dur: 0.05, gain: 0.08 });
    if (i === n - 1) tone({ type: 'sine', f0: 60, f1: 40, dur: 0.4, gain: 0.3, delay: 0.02 });
  },
  /** Meteor streaking past: Doppler, the pitch climbs on approach and drops at the moment it passes; the wind swells from far to near */
  meteor(dur = 1.0) {
    const b = bus.get();
    if (!b) return;
    const peak = dur * 0.72;
    noise({ type: 'bandpass', q: 2.2, dur: dur + 0.35, gain: 0.42, attack: dur * 0.55, wet: 0.35, f0: 300, curve: (k) => (k < peak / (dur + 0.35) ? 350 + 3200 * Math.pow(k / (peak / (dur + 0.35)), 2.2) : 3550 - 3000 * Math.min(1, (k - peak / (dur + 0.35)) * 3)) });
    tone({ type: 'sawtooth', f0: 90, f1: 520, dur: peak, gain: 0.05, attack: peak * 0.7, cutoff: 1200, wet: 0.3 });
    tone({ type: 'sawtooth', f0: 520, f1: 140, dur: dur - peak + 0.3, gain: 0.05, delay: peak, cutoff: 1200 });
    tone({ type: 'sine', f0: 1800, f1: 2600, dur: peak, gain: 0.03, attack: peak * 0.8, wet: 0.6 });
    tone({ type: 'sine', f0: 2600, f1: 900, dur: 0.4, gain: 0.04, delay: peak, wet: 0.6 });
  },
  /** The meteor slams into the gate: a dull thud plus a flash of shimmer */
  meteorHit(rarity: 'R' | 'SR' | 'SSR') {
    tone({ type: 'sine', f0: 110, f1: 36, dur: 0.7, gain: rarity === 'SSR' ? 0.6 : 0.45 });
    noise({ type: 'lowpass', f0: 2500, f1: 120, dur: 0.6, gain: 0.4 });
    noise({ type: 'highpass', f0: 4000, f1: 9000, dur: 0.5, gain: 0.18, wet: 0.5 });
    const root = rarity === 'SSR' ? 784 : rarity === 'SR' ? 659 : 587;
    for (let i = 0; i < 3; i++) bell(root * [1, 1.5, 2][i], 0.9, 0.08, 0.02 + i * 0.05, 0.7);
  },
  /** The purple-to-gold surprise: a crack, a rapid upward slide, a golden chord */
  upgrade() {
    noise({ type: 'highpass', f0: 3000, dur: 0.16, gain: 0.35 });
    tone({ type: 'triangle', f0: 400, f1: 3200, dur: 0.32, gain: 0.12, wet: 0.5 });
    tone({ type: 'sine', f0: 70, f1: 32, dur: 0.8, gain: 0.55, delay: 0.3 });
    [784, 988, 1175, 1568].forEach((f, i) => bell(f, 1.4, 0.1, 0.32 + i * 0.045, 0.7));
    choir(392, 1.4, 0.16, 0.34, 0.12);
    choir(587, 1.4, 0.12, 0.34, 0.12);
  },
  /** Gate opens: sub-bass boom + rolling low-frequency noise + a swelling harmony pad */
  gateOpen() {
    tone({ type: 'sine', f0: 52, f1: 28, dur: 1.4, gain: 0.7 });
    noise({ type: 'lowpass', f0: 180, f1: 900, dur: 1.2, gain: 0.35, attack: 0.5, wet: 0.3 });
    noise({ type: 'bandpass', f0: 1200, f1: 5000, q: 1.5, dur: 0.8, gain: 0.16, attack: 0.3, wet: 0.5 });
    for (const [f, d] of [[261.6, 0], [392, 0.05], [523.3, 0.1]] as const) choir(f, 1.6, 0.11, d, 0.35);
  },
  /** Silhouette: a low drone + whisper-like highs, tightening more and more */
  silhouette(dur = 0.35) {
    tone({ type: 'sawtooth', f0: 90, f1: 220, dur, gain: 0.06, attack: dur * 0.8, cutoff: 700 });
    noise({ type: 'bandpass', f0: 1500, f1: 5000, q: 6, dur, gain: 0.14, attack: dur * 0.85, wet: 0.5 });
  },
  /** The reveal burst: graded by rarity */
  burst(rarity: 'R' | 'SR' | 'SSR') {
    noise({ type: 'highpass', f0: 3500, dur: 0.06, gain: 0.35 });
    if (rarity === 'R') {
      tone({ type: 'sine', f0: 160, f1: 70, dur: 0.22, gain: 0.3 });
      noise({ type: 'bandpass', f0: 2000, f1: 600, q: 1.5, dur: 0.25, gain: 0.2 });
    } else if (rarity === 'SR') {
      tone({ type: 'sine', f0: 120, f1: 45, dur: 0.45, gain: 0.45 });
      noise({ type: 'lowpass', f0: 3000, f1: 200, dur: 0.5, gain: 0.35 });
    } else {
      tone({ type: 'sine', f0: 90, f1: 30, dur: 1.1, gain: 0.7 });
      noise({ type: 'lowpass', f0: 4000, f1: 100, dur: 1.0, gain: 0.5 });
      noise({ type: 'highpass', f0: 5000, f1: 12000, dur: 0.9, gain: 0.2, wet: 0.6 });
    }
  },
  /** Rarity stinger: R a run of bright notes, SR a chord, SSR a fanfare of brass + choir */
  stinger(rarity: 'R' | 'SR' | 'SSR') {
    if (rarity === 'R') {
      [659, 784, 988, 1319].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.28, gain: 0.1, delay: i * 0.055, wet: 0.5 }));
      bell(1319, 0.8, 0.07, 0.2, 0.7);
      return;
    }
    if (rarity === 'SR') {
      const chord = [523, 659, 784, 1047];
      chord.forEach((f, i) => {
        tone({ type: 'sawtooth', f0: f, dur: 0.9, gain: 0.05, delay: i * 0.03, cutoff: 2200, wet: 0.5, detune: (i % 2 ? 5 : -5) });
        bell(f, 1.1, 0.06, i * 0.05, 0.7);
      });
      [1568, 2093, 2637].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.5, gain: 0.05, delay: 0.25 + i * 0.07, wet: 0.7 }));
      tone({ type: 'sine', f0: 100, f1: 40, dur: 0.5, gain: 0.35, delay: 0.05 });
      return;
    }
    // SSR: a short brass triple hit (V, I, I an octave up) + sub-bass and cymbal; the theme melody is picked up by the summon music's fanfare
    const seq: [number, number, number][] = [[392, 0, 0.14], [587, 0.12, 0.14], [784, 0.24, 0.7]];
    for (const [f, d, dur] of seq) brass(f, dur, 0.18, d);
    brass(294, 0.9, 0.1, 0.24);
    tone({ type: 'sine', f0: 60, f1: 28, dur: 1.2, gain: 0.7, delay: 0.24 });
    noise({ type: 'highpass', f0: 3000, f1: 9000, dur: 1.2, gain: 0.18, delay: 0.24, wet: 0.6 });
    [1568, 1976, 2349, 3136].forEach((f, i) => bell(f, 1.4, 0.05, 0.3 + i * 0.05, 0.8));
  },
  /** A holy spirit descends from the sky: a falling whistle + wind that keeps growing */
  descend(dur = 0.9) {
    tone({ type: 'sine', f0: 2200, f1: 260, dur, gain: 0.07, wet: 0.5 });
    tone({ type: 'sawtooth', f0: 1100, f1: 130, dur, gain: 0.035, cutoff: 1600 });
    noise({ type: 'bandpass', f0: 500, f1: 2400, q: 1.2, dur: dur + 0.1, gain: 0.35, attack: dur * 0.8 });
  },
  /** Landing: heavy impact + falling rubble + aftershock */
  land() {
    noise({ type: 'highpass', f0: 2000, dur: 0.04, gain: 0.4 });
    tone({ type: 'sine', f0: 100, f1: 30, dur: 0.8, gain: 0.7 });
    noise({ type: 'lowpass', f0: 1800, f1: 100, dur: 0.7, gain: 0.45 });
    for (let i = 0; i < 5; i++) noise({ type: 'bandpass', f0: 700 + Math.random() * 900, q: 4, dur: 0.08, gain: 0.12, delay: 0.08 + i * 0.05 });
  },
  /** The field fills the stage: a sound vocabulary per element */
  flood(el: Element) {
    switch (el) {
      case 'fire': // Ignition: a howl, crackling bursts, a burning tail
        noise({ type: 'bandpass', f0: 400, f1: 3200, q: 1.2, dur: 1.2, gain: 0.3, attack: 0.5 });
        [1, 1.25, 1.5, 2].forEach((m, i) => tone({ type: 'triangle', f0: 440 * m, dur: 1.3, gain: 0.05, attack: 0.15, delay: i * 0.07, wet: 0.5 }));
        for (let i = 0; i < 6; i++) noise({ type: 'highpass', f0: 3000, dur: 0.03, gain: 0.12, delay: 0.3 + Math.random() * 0.9 });
        break;
      case 'water': // Muffled thunder, a surge of waves, rain washing down
        tone({ type: 'sine', f0: 70, f1: 40, dur: 1.3, gain: 0.4, delay: 0.1 });
        noise({ type: 'lowpass', f0: 200, f1: 900, dur: 1.6, gain: 0.3, attack: 0.5 });
        noise({ type: 'highpass', f0: 3500, f1: 6000, dur: 2.0, gain: 0.14, attack: 0.7 });
        break;
      case 'nature': // Rustling, the dull creak of wood growing, spores popping
        noise({ type: 'bandpass', f0: 2500, q: 1.5, dur: 1.3, gain: 0.18, attack: 0.3 });
        tone({ type: 'triangle', f0: 180, f1: 330, dur: 0.7, gain: 0.12, cutoff: 900 });
        [1760, 2093, 2637, 3136].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.18, gain: 0.05, delay: 0.4 + i * 0.11, wet: 0.6 }));
        break;
      case 'wind': // A howl that builds from far to near, a high-frequency whoosh
        noise({ type: 'bandpass', f0: 400, f1: 3000, q: 2, dur: 1.5, gain: 0.35, attack: 0.5 });
        noise({ type: 'highpass', f0: 4000, f1: 9000, dur: 0.7, gain: 0.16, attack: 0.25, delay: 0.5 });
        break;
      case 'earth': // Ground rumble, stones colliding
        tone({ type: 'sine', f0: 50, f1: 32, dur: 1.6, gain: 0.55, attack: 0.15 });
        noise({ type: 'lowpass', f0: 600, f1: 220, dur: 1.8, gain: 0.35, attack: 0.4 });
        for (let i = 0; i < 6; i++) noise({ type: 'bandpass', f0: 500 + Math.random() * 700, q: 5, dur: 0.1, gain: 0.14, delay: 0.2 + i * 0.13 });
        break;
      case 'thunder': // Crackle, electric hum, rolling thunder
        noise({ type: 'highpass', f0: 1500, dur: 0.09, gain: 0.5, delay: 0.25 });
        noise({ type: 'lowpass', f0: 2500, f1: 150, dur: 1.5, gain: 0.4, delay: 0.27 });
        tone({ type: 'sawtooth', f0: 55, dur: 1.0, gain: 0.1, delay: 0.27, cutoff: 600 });
        tone({ type: 'square', f0: 110, dur: 0.6, gain: 0.03, delay: 0.3, cutoff: 1500 });
        break;
      case 'light': // Bells, sustained choir tones
        [523, 659, 784, 1047].forEach((f, i) => choir(f, 2.0, 0.09, i * 0.08, 0.4));
        bell(2093, 1.6, 0.09, 0.1, 0.8);
        noise({ type: 'highpass', f0: 6000, dur: 1.0, gain: 0.08, attack: 0.5, wet: 0.5 });
        break;
      case 'dark': // Reversed low howl, heartbeat, whispers
        noise({ type: 'lowpass', f0: 150, f1: 1400, dur: 1.2, gain: 0.32, attack: 1.0 });
        tone({ type: 'sawtooth', f0: 110, f1: 55, dur: 1.2, gain: 0.08, attack: 0.3, cutoff: 500 });
        tone({ type: 'sine', f0: 60, f1: 40, dur: 0.25, gain: 0.5, delay: 0.85 });
        tone({ type: 'sine', f0: 60, f1: 40, dur: 0.25, gain: 0.4, delay: 1.2 });
        noise({ type: 'bandpass', f0: 2200, f1: 3800, q: 8, dur: 0.9, gain: 0.08, attack: 0.4, delay: 0.3, wet: 0.7 });
        break;
      default: // Neutral: metallic clang + magic hum
        noise({ type: 'bandpass', f0: 2500, q: 2, dur: 0.25, gain: 0.25 });
        tone({ type: 'triangle', f0: 1200, f1: 900, dur: 0.3, gain: 0.08, wet: 0.5 });
        [1, 1.5, 2].forEach((m, i) => tone({ type: 'sine', f0: 262 * m, dur: 1.4, gain: 0.07, attack: 0.3, delay: i * 0.1, wet: 0.6 }));
    }
  },
  /** Roar: the sound material changes with the element */
  roar(el: Element) {
    const growl = (f0: number, f1: number, dur: number, gain: number, cutoff: number) => {
      for (const [d, fm] of [[0, 1], [7, 1.005], [-9, 1.498]] as const) tone({ type: 'sawtooth', f0: f0 * fm, f1: f1 * fm, dur, gain, attack: 0.04, detune: d, cutoff, wet: 0.3, vib: [18, 9] });
    };
    switch (el) {
      case 'fire': // Lion's roar: low sawtooth + crackling
        growl(98, 56, 0.95, 0.09, 1400);
        noise({ type: 'bandpass', f0: 520, f1: 180, q: 1.2, dur: 0.9, gain: 0.45, attack: 0.05 });
        noise({ type: 'highpass', f0: 2500, f1: 900, dur: 0.5, gain: 0.2 });
        break;
      case 'water': // Whale song: long gliding calls + surging waves
        for (const d of [-6, 0, 7]) tone({ type: 'sine', f0: 220, f1: 660, dur: 1.2, gain: 0.09, attack: 0.15, detune: d, wet: 0.8, vib: [12, 4.5] });
        tone({ type: 'triangle', f0: 110, f1: 330, dur: 1.2, gain: 0.05, attack: 0.2, cutoff: 900, wet: 0.7 });
        noise({ type: 'lowpass', f0: 300, f1: 1200, dur: 1.1, gain: 0.3, attack: 0.4 });
        noise({ type: 'highpass', f0: 5000, dur: 0.4, gain: 0.12, delay: 0.5 });
        break;
      case 'nature': // Stag call: a woody mid-range cry + rustling leaves
        for (const d of [-5, 0, 6]) tone({ type: 'triangle', f0: 330, f1: 520, dur: 0.8, gain: 0.08, attack: 0.08, detune: d, cutoff: 1600, wet: 0.6, vib: [25, 7] });
        noise({ type: 'bandpass', f0: 2800, q: 1.5, dur: 0.7, gain: 0.2, attack: 0.1 });
        tone({ type: 'square', f0: 140, f1: 90, dur: 0.25, gain: 0.08, cutoff: 500 });
        break;
      case 'wind': // Eagle cry: a piercing sustained high note + whoosh
        for (const d of [-4, 0, 5]) tone({ type: 'sawtooth', f0: 1600, f1: 900, dur: 0.75, gain: 0.05, attack: 0.03, detune: d, cutoff: 5000, wet: 0.6, vib: [30, 11] });
        noise({ type: 'highpass', f0: 2500, f1: 7000, dur: 0.6, gain: 0.35, attack: 0.05 });
        noise({ type: 'bandpass', f0: 800, f1: 3000, q: 2, dur: 0.8, gain: 0.25, attack: 0.3 });
        break;
      case 'earth': // Tortoise roar: extremely low-frequency rumble + colliding stones
        growl(55, 38, 1.2, 0.09, 600);
        tone({ type: 'sine', f0: 45, f1: 28, dur: 1.2, gain: 0.6 });
        noise({ type: 'lowpass', f0: 500, f1: 120, dur: 1.0, gain: 0.45 });
        for (let i = 0; i < 4; i++) noise({ type: 'bandpass', f0: 600 + i * 200, q: 5, dur: 0.1, gain: 0.15, delay: 0.1 + i * 0.09 });
        break;
      case 'thunder': // Qilin neigh: crackle + electrified high-frequency hiss
        noise({ type: 'highpass', f0: 1800, dur: 0.07, gain: 0.5 });
        for (const d of [-6, 0, 7]) tone({ type: 'sawtooth', f0: 700, f1: 1100, dur: 0.7, gain: 0.05, attack: 0.03, detune: d, cutoff: 3500, wet: 0.5, vib: [40, 14] });
        tone({ type: 'square', f0: 60, dur: 0.6, gain: 0.08, cutoff: 500 });
        noise({ type: 'lowpass', f0: 3000, f1: 200, dur: 0.9, gain: 0.35, delay: 0.05 });
        break;
      case 'light': // Pegasus's long neigh: bright high notes + bells
        for (const d of [-5, 0, 6]) tone({ type: 'sawtooth', f0: 880, f1: 1320, dur: 0.8, gain: 0.05, attack: 0.05, detune: d, cutoff: 3200, wet: 0.7, vib: [22, 8] });
        bell(1568, 1.4, 0.1, 0.05, 0.8);
        bell(2093, 1.2, 0.07, 0.12, 0.8);
        choir(523, 1.4, 0.1, 0.1, 0.2);
        break;
      case 'dark': // Wolf howl: a reversed intake of breath, then a drawn-out howl + heartbeat
        noise({ type: 'lowpass', f0: 200, f1: 2400, dur: 0.35, gain: 0.3, attack: 0.3 });
        for (const d of [-8, 0, 9]) tone({ type: 'sawtooth', f0: 330, f1: 520, dur: 1.1, gain: 0.06, attack: 0.12, delay: 0.3, detune: d, cutoff: 1500, wet: 0.7, vib: [20, 5.5] });
        tone({ type: 'sine', f0: 62, f1: 40, dur: 0.25, gain: 0.5, delay: 0.35 });
        tone({ type: 'sine', f0: 62, f1: 40, dur: 0.25, gain: 0.45, delay: 0.72 });
        break;
      default: // Dragon cry: a low growl with a metallic clang + magic hum
        growl(130, 80, 0.9, 0.08, 1800);
        noise({ type: 'bandpass', f0: 2600, q: 3, dur: 0.3, gain: 0.25 });
        [1, 1.5, 2, 3].forEach((m, i) => tone({ type: 'sine', f0: 196 * m, dur: 1.0, gain: 0.05, attack: 0.1, delay: i * 0.03, wet: 0.7 }));
    }
    // Wave of sound: every kind of roar has a low-frequency layer under it pushing forward
    tone({ type: 'sine', f0: 80, f1: 34, dur: 0.6, gain: 0.45 });
  },
  /** Nameplate lands: a clang plus a metallic tail */
  bannerHit() {
    noise({ type: 'highpass', f0: 6000, dur: 0.08, gain: 0.2 });
    tone({ type: 'triangle', f0: 2637, dur: 0.9, gain: 0.09, wet: 0.7 });
    tone({ type: 'sine', f0: 3951, dur: 0.6, gain: 0.05, delay: 0.03, wet: 0.7 });
    tone({ type: 'sine', f0: 120, f1: 50, dur: 0.35, gain: 0.35 });
  },
  /** Summary card flips over */
  card(i: number, rarity: string) {
    const f = rarity === 'SSR' ? 1568 : rarity === 'SR' ? 1175 : 880;
    tone({ type: 'triangle', f0: f * v(), dur: 0.16, gain: 0.07, delay: i * 0.05, wet: 0.4 });
    noise({ type: 'highpass', f0: 4000, dur: 0.04, gain: 0.08, delay: i * 0.05 });
  },
};
