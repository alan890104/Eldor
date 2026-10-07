// Sound effects: all synthesized live with Web Audio (no audio files needed). A hit sound has three layers: transient + body + tail.

import type { Element } from '../../sim/types.ts';
import type { HitTierName } from '../engine/types.ts';
import { playOnce } from './music/engine.ts';
import { JINGLES } from './music/songs/jingles.ts';

type Wave = OscillatorType;

class Synth {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfx!: GainNode;
  music!: GainNode;
  private noiseBuf!: AudioBuffer;
  private duckGain!: GainNode;
  enabled = true;
  volume = { master: 0.8, sfx: 0.9, music: 0.45 };

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.attach(new AC());
  }

  /** Attach the whole audio graph to the given context (used by unlock; in tests it can be attached to an OfflineAudioContext to measure peaks) */
  attach(ctx: AudioContext): void {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume.master;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.volume.sfx;
    this.sfx.connect(this.master);
    this.duckGain = ctx.createGain();
    this.duckGain.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = this.volume.music;
    this.music.connect(this.duckGain);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  setVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.enabled ? this.volume.master : 0;
    this.sfx.gain.value = this.volume.sfx;
    this.music.gain.value = this.volume.music;
  }

  duck(db: number, ms = 350): void {
    if (!this.ctx || db >= 0) return;
    const g = this.duckGain.gain;
    const t = this.now;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.pow(10, db / 20), t);
    g.linearRampToValueAtTime(1, t + ms / 1000);
  }

  /** The ultimate's "music drop-out": the music falls to near silence within 0.12 s and holds; the duck() on the hit pulls it back (and it returns on its own after holdMs at most) */
  dropMusic(holdMs = 4000): void {
    if (!this.ctx) return;
    const g = this.duckGain.gain;
    const t = this.now;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.03, t + 0.12);
    g.setValueAtTime(0.03, t + holdMs / 1000);
    g.linearRampToValueAtTime(1, t + holdMs / 1000 + 0.6);
  }

  /** Bring the music back (when the ultimate misses or is interrupted) */
  restoreMusic(ms = 300): void {
    if (!this.ctx) return;
    const g = this.duckGain.gain;
    const t = this.now;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(1, t + ms / 1000);
  }

  tone(o: { type?: Wave; f0: number; f1?: number; dur: number; gain?: number; attack?: number; delay?: number; dest?: AudioNode; detune?: number }): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = this.now + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const a = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g).connect(o.dest ?? this.sfx);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  noise(o: { dur: number; gain?: number; type?: BiquadFilterType; f0: number; f1?: number; q?: number; attack?: number; delay?: number; dest?: AudioNode }): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = this.now + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'lowpass';
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const a = o.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.4, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(g).connect(o.dest ?? this.sfx);
    src.start(t, Math.random() * 1.5);
    src.stop(t + o.dur + 0.05);
  }
}

export const synth = new Synth();
const v = () => 0.96 + Math.random() * 0.08;

export const sfx = {
  click() {
    synth.tone({ type: 'triangle', f0: 1400 * v(), f1: 900, dur: 0.06, gain: 0.12 });
  },
  hover() {
    synth.tone({ type: 'sine', f0: 2200 * v(), dur: 0.04, gain: 0.04 });
  },
  confirm() {
    synth.tone({ type: 'triangle', f0: 880, dur: 0.12, gain: 0.14 });
    synth.tone({ type: 'triangle', f0: 1320, dur: 0.18, gain: 0.12, delay: 0.06 });
  },
  error() {
    synth.tone({ type: 'square', f0: 180, f1: 140, dur: 0.14, gain: 0.08 });
  },
  aether() {
    synth.tone({ type: 'sine', f0: 1760 * v(), dur: 0.18, gain: 0.08 });
    synth.tone({ type: 'sine', f0: 2640 * v(), dur: 0.12, gain: 0.05, delay: 0.03 });
  },
  whoosh(pitch = 1) {
    synth.noise({ type: 'bandpass', f0: 600 * pitch, f1: 2400 * pitch, q: 2, dur: 0.22, gain: 0.28, attack: 0.08 });
  },
  swish() {
    synth.noise({ type: 'highpass', f0: 3000, f1: 6000, dur: 0.14, gain: 0.25, attack: 0.02 });
  },
  charge(dur = 0.6) {
    synth.tone({ type: 'sawtooth', f0: 120, f1: 900, dur, gain: 0.07, attack: dur * 0.8 });
    synth.noise({ type: 'bandpass', f0: 400, f1: 3000, q: 4, dur, gain: 0.12, attack: dur * 0.9 });
  },
  cast(el: Element) {
    const base = ELEMENT_PITCH[el];
    for (let i = 0; i < 3; i++) synth.tone({ type: 'sine', f0: base * [1, 1.25, 1.5][i], dur: 0.35, gain: 0.07, delay: i * 0.05 });
    synth.noise({ type: 'bandpass', f0: 800, f1: 4000, q: 3, dur: 0.4, gain: 0.08, attack: 0.3 });
  },
  hit(tier: HitTierName, el: Element, physical: boolean) {
    const big = tier === 'heavy' || tier === 'crit' || tier === 'ko' || tier === 'ultimate';
    // ① transient
    synth.noise({ type: 'highpass', f0: physical ? 2500 : 3500, dur: 0.035, gain: big ? 0.55 : 0.4 });
    synth.tone({ type: 'square', f0: physical ? 180 : 260, f1: 60, dur: 0.06, gain: 0.18 });
    // ② body (by element)
    elementBody(el, big);
    // ③ low end
    if (big) synth.tone({ type: 'sine', f0: 90, f1: 38, dur: 0.45, gain: 0.55 });
    else synth.tone({ type: 'sine', f0: 140, f1: 60, dur: 0.18, gain: 0.3 });
    // ④ accents
    if (tier === 'crit') {
      synth.tone({ type: 'triangle', f0: 2093, dur: 0.5, gain: 0.12, delay: 0.02 });
      synth.tone({ type: 'triangle', f0: 3136, dur: 0.4, gain: 0.08, delay: 0.05 });
    }
    if (tier === 'ko' || tier === 'ultimate') {
      synth.noise({ type: 'lowpass', f0: 1200, f1: 80, dur: 1.2, gain: 0.35 });
      synth.tone({ type: 'sawtooth', f0: 220, f1: 55, dur: 0.9, gain: 0.12 });
    }
  },
  guard() {
    synth.tone({ type: 'square', f0: 1200, f1: 800, dur: 0.12, gain: 0.12 });
    synth.tone({ type: 'triangle', f0: 2400, dur: 0.6, gain: 0.1 });
    synth.noise({ type: 'bandpass', f0: 3000, q: 8, dur: 0.4, gain: 0.15 });
  },
  shieldBreak() {
    for (let i = 0; i < 5; i++) synth.tone({ type: 'triangle', f0: 2000 + Math.random() * 3000, dur: 0.25, gain: 0.06, delay: i * 0.02 });
    synth.noise({ type: 'highpass', f0: 4000, dur: 0.3, gain: 0.25 });
  },
  heal() {
    for (let i = 0; i < 4; i++) synth.tone({ type: 'sine', f0: [660, 830, 990, 1320][i], dur: 0.4, gain: 0.08, delay: i * 0.07 });
  },
  buff() {
    synth.tone({ type: 'triangle', f0: 440, f1: 880, dur: 0.3, gain: 0.1 });
    synth.tone({ type: 'triangle', f0: 660, f1: 1320, dur: 0.3, gain: 0.07, delay: 0.08 });
  },
  debuff() {
    synth.tone({ type: 'triangle', f0: 700, f1: 300, dur: 0.35, gain: 0.1 });
  },
  status() {
    synth.tone({ type: 'sawtooth', f0: 300, f1: 180, dur: 0.3, gain: 0.07 });
    synth.noise({ type: 'bandpass', f0: 900, q: 5, dur: 0.3, gain: 0.08 });
  },
  trapSet() {
    synth.noise({ type: 'lowpass', f0: 2500, f1: 400, dur: 0.12, gain: 0.35 });
    synth.tone({ type: 'sine', f0: 160, f1: 80, dur: 0.1, gain: 0.3 });
  },
  trapFlip() {
    synth.noise({ type: 'bandpass', f0: 400, f1: 3000, q: 1.5, dur: 0.3, gain: 0.3, attack: 0.2 });
    synth.tone({ type: 'sine', f0: 110, f1: 55, dur: 0.35, gain: 0.5, delay: 0.28 });
    synth.tone({ type: 'sawtooth', f0: 330, dur: 0.5, gain: 0.08, delay: 0.28 });
    synth.tone({ type: 'sawtooth', f0: 415, dur: 0.5, gain: 0.06, delay: 0.28 });
  },
  /** Field set-up: each of the eight fields has its own sound, a cast impact first and then that field's ambience */
  field(el: Element) {
    switch (el) {
      case 'water': // Downpour: a muffled rumble of thunder rolls through, then rain washes down
        synth.tone({ type: 'sine', f0: 70, f1: 42, dur: 1.3, gain: 0.4, delay: 0.2 });
        synth.noise({ type: 'lowpass', f0: 200, f1: 900, dur: 1.6, gain: 0.3, attack: 0.5 });
        synth.noise({ type: 'highpass', f0: 3000, f1: 5000, dur: 1.9, gain: 0.13, attack: 0.9 });
        break;
      case 'fire': // Blazing sun: a bright, rising, shimmering chord + hot wind
        [1, 1.25, 1.5, 2].forEach((m, i) => synth.tone({ type: 'triangle', f0: 520 * m, dur: 1.3, gain: 0.07, attack: 0.15, delay: i * 0.08 }));
        synth.noise({ type: 'bandpass', f0: 500, f1: 3500, q: 1.2, dur: 1.4, gain: 0.16, attack: 0.7 });
        break;
      case 'nature': // Forest realm: rustling leaves, the dull creak of wood growing, a few bird calls
        synth.noise({ type: 'bandpass', f0: 2500, q: 1.5, dur: 1.2, gain: 0.18, attack: 0.3 });
        synth.tone({ type: 'triangle', f0: 220, f1: 330, dur: 0.6, gain: 0.12 });
        [1760, 2093, 2637].forEach((f, i) => synth.tone({ type: 'sine', f0: f, dur: 0.25, gain: 0.05, delay: 0.5 + i * 0.12 }));
        break;
      case 'wind': // Gale: a howl that builds from far to near
        synth.noise({ type: 'bandpass', f0: 400, f1: 3000, q: 2, dur: 1.5, gain: 0.35, attack: 0.6 });
        synth.noise({ type: 'highpass', f0: 4000, f1: 8000, dur: 0.8, gain: 0.15, attack: 0.3, delay: 0.5 });
        break;
      case 'earth': // Sandstorm: low-frequency ground rumble + sand scraping past
        synth.tone({ type: 'sine', f0: 55, f1: 35, dur: 1.6, gain: 0.5, attack: 0.2 });
        synth.noise({ type: 'lowpass', f0: 600, f1: 250, dur: 1.8, gain: 0.35, attack: 0.4 });
        synth.noise({ type: 'highpass', f0: 5000, dur: 1.2, gain: 0.08, attack: 0.6 });
        break;
      case 'thunder': // Thundercloud: a crack, then rolling thunder
        synth.noise({ type: 'highpass', f0: 1500, dur: 0.1, gain: 0.5, delay: 0.3 });
        synth.noise({ type: 'lowpass', f0: 2500, f1: 150, dur: 1.6, gain: 0.4, delay: 0.32 });
        synth.tone({ type: 'sawtooth', f0: 50, dur: 0.6, gain: 0.12, delay: 0.32 });
        break;
      case 'light': // Sacred ground: bells and sustained choir tones
        [523, 659, 784, 1047].forEach((f, i) => synth.tone({ type: 'sine', f0: f, dur: 1.8, gain: 0.07, attack: 0.4, delay: i * 0.1 }));
        synth.tone({ type: 'triangle', f0: 2093, dur: 1.4, gain: 0.08, delay: 0.1 });
        synth.noise({ type: 'highpass', f0: 6000, dur: 1.0, gain: 0.1, attack: 0.5 });
        break;
      case 'dark': // Endless night: a reversed low howl + two heartbeats
        synth.noise({ type: 'lowpass', f0: 150, f1: 1200, dur: 1.2, gain: 0.3, attack: 1.0 });
        synth.tone({ type: 'sawtooth', f0: 110, f1: 55, dur: 1.2, gain: 0.1, attack: 0.3 });
        synth.tone({ type: 'sine', f0: 60, f1: 40, dur: 0.25, gain: 0.5, delay: 0.9 });
        synth.tone({ type: 'sine', f0: 60, f1: 40, dur: 0.25, gain: 0.4, delay: 1.25 });
        break;
      default: {
        const b = ELEMENT_PITCH[el] / 2;
        for (let i = 0; i < 3; i++) synth.tone({ type: 'sine', f0: b * [1, 1.5, 2][i], dur: 1.4, gain: 0.08, attack: 0.3, delay: i * 0.1 });
        synth.noise({ type: 'lowpass', f0: 300, f1: 2000, dur: 1.2, gain: 0.12, attack: 0.5 });
      }
    }
  },
  faint() {
    synth.tone({ type: 'sine', f0: 880, f1: 110, dur: 0.9, gain: 0.15 });
    for (let i = 0; i < 6; i++) synth.tone({ type: 'sine', f0: 1600 + i * 300, dur: 0.2, gain: 0.04, delay: 0.3 + i * 0.06 });
  },
  summon() {
    synth.tone({ type: 'sine', f0: 523, dur: 0.5, gain: 0.1 });
    synth.tone({ type: 'sine', f0: 784, dur: 0.5, gain: 0.08, delay: 0.08 });
    synth.noise({ type: 'bandpass', f0: 500, f1: 4000, q: 2, dur: 0.5, gain: 0.15, attack: 0.3 });
    synth.tone({ type: 'sine', f0: 120, f1: 50, dur: 0.4, gain: 0.4, delay: 0.45 });
  },
  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) => synth.tone({ type: 'triangle', f0: f, dur: 0.3, gain: 0.12, delay: i * 0.08 }));
  },
  /** Fanfare: played by the soundtrack's orchestra (music/songs/jingles.ts), routed through the sfx bus */
  fanfare(big = false) {
    if (!synth.ctx) return;
    playOnce(synth.ctx, synth.sfx, big ? JINGLES.fanfareBig : JINGLES.fanfareSmall);
  },
  shake(n: number) {
    synth.tone({ type: 'square', f0: 220 + n * 40, f1: 160, dur: 0.08, gain: 0.12 });
    synth.noise({ type: 'lowpass', f0: 1500, dur: 0.06, gain: 0.2 });
  },
  captureOk() {
    [784, 988, 1175, 1568].forEach((f, i) => synth.tone({ type: 'triangle', f0: f, dur: 0.4, gain: 0.12, delay: i * 0.07 }));
    synth.noise({ type: 'highpass', f0: 5000, dur: 0.6, gain: 0.15, delay: 0.1 });
  },
  captureFail() {
    synth.noise({ type: 'bandpass', f0: 2000, q: 2, dur: 0.2, gain: 0.3 });
    synth.tone({ type: 'sawtooth', f0: 400, f1: 150, dur: 0.3, gain: 0.1 });
  },
  whooshBig() {
    synth.noise({ type: 'bandpass', f0: 200, f1: 3000, q: 1, dur: 0.8, gain: 0.35, attack: 0.5 });
    synth.tone({ type: 'sawtooth', f0: 60, f1: 400, dur: 0.8, gain: 0.08, attack: 0.6 });
  },
  impactBig() {
    synth.noise({ type: 'lowpass', f0: 3000, f1: 60, dur: 1.5, gain: 0.6 });
    synth.tone({ type: 'sine', f0: 70, f1: 30, dur: 1.2, gain: 0.7 });
  },
};

const ELEMENT_PITCH: Record<Element, number> = {
  water: 392,
  fire: 330,
  nature: 440,
  wind: 587,
  earth: 196,
  thunder: 494,
  light: 659,
  dark: 247,
  neutral: 523,
};

function elementBody(el: Element, big: boolean): void {
  const g = big ? 1.3 : 1;
  switch (el) {
    case 'fire':
      synth.noise({ type: 'lowpass', f0: 2500, f1: 300, dur: 0.5 * g, gain: 0.35 * g });
      synth.noise({ type: 'bandpass', f0: 1200, q: 0.8, dur: 0.25, gain: 0.2, delay: 0.05 });
      break;
    case 'water':
      synth.noise({ type: 'bandpass', f0: 1500, f1: 400, q: 3, dur: 0.35 * g, gain: 0.3 });
      synth.tone({ type: 'sine', f0: 900, f1: 300, dur: 0.15, gain: 0.12 });
      break;
    case 'nature':
      synth.noise({ type: 'bandpass', f0: 3000, q: 1.5, dur: 0.25, gain: 0.22 });
      synth.tone({ type: 'triangle', f0: 300, f1: 180, dur: 0.12, gain: 0.2 });
      break;
    case 'wind':
      synth.noise({ type: 'highpass', f0: 2000, f1: 5000, dur: 0.3, gain: 0.3, attack: 0.02 });
      break;
    case 'earth':
      synth.noise({ type: 'lowpass', f0: 800, f1: 100, dur: 0.5 * g, gain: 0.5 });
      synth.tone({ type: 'sine', f0: 70, f1: 40, dur: 0.4, gain: 0.5 });
      break;
    case 'thunder':
      synth.noise({ type: 'highpass', f0: 1500, dur: 0.08, gain: 0.5 });
      synth.noise({ type: 'lowpass', f0: 3000, f1: 200, dur: 0.6 * g, gain: 0.35, delay: 0.03 });
      synth.tone({ type: 'sawtooth', f0: 60, dur: 0.3, gain: 0.1 });
      break;
    case 'light':
      synth.tone({ type: 'triangle', f0: 1568, dur: 0.6, gain: 0.1 });
      synth.tone({ type: 'triangle', f0: 2093, dur: 0.5, gain: 0.07, delay: 0.03 });
      synth.noise({ type: 'highpass', f0: 5000, dur: 0.4, gain: 0.15 });
      break;
    case 'dark':
      synth.tone({ type: 'sawtooth', f0: 110, f1: 55, dur: 0.5, gain: 0.12 });
      synth.noise({ type: 'lowpass', f0: 600, f1: 150, dur: 0.5, gain: 0.3 });
      break;
    default:
      synth.noise({ type: 'bandpass', f0: 2500, q: 2, dur: 0.2, gain: 0.25 });
      synth.tone({ type: 'triangle', f0: 1200, f1: 900, dur: 0.2, gain: 0.08 });
  }
}
