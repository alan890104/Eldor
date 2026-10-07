// Live-synthesized sustained instruments: flute, brass, choir, organ, accordion, throat singing (khoomei), chord pad, bass, distorted guitar, ambience.
// Each note builds a small group of nodes; sampled instruments (plucked strings, bells, drums) play samples computed with dsp.ts, in instruments.ts.

import { rng } from './dsp.ts';

export interface VoiceCall {
  ctx: BaseAudioContext;
  out: AudioNode;
  t: number;
  /** Note length (seconds) */
  dur: number;
  f: number;
  vel: number;
  /** Glide: [seconds from the start, target frequency] */
  bends?: [number, number][];
  /** Instrument parameters (a song's track.opts can override them) */
  o: Record<string, number>;
}

export type Voice = (c: VoiceCall) => void;

// ───────────────────────── Shared parts ─────────────────────────

const waves = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
/** A periodic wave from a custom harmonic table (organ, clarinet, oboe, brass) */
function wave(ctx: BaseAudioContext, key: string, amps: number[]): PeriodicWave {
  let m = waves.get(ctx);
  if (!m) waves.set(ctx, (m = new Map()));
  let w = m.get(key);
  if (!w) {
    const real = new Float32Array(amps.length + 1);
    const imag = new Float32Array(amps.length + 1);
    amps.forEach((a, i) => (imag[i + 1] = a));
    w = ctx.createPeriodicWave(real, imag);
    m.set(key, w);
  }
  return w;
}

/**
 * Baked waveform: compute the formant / body response straight into the amplitude of each harmonic, saving a filter (much cheaper on CPU).
 * amp(k, f) returns the amplitude of the k-th harmonic (at frequency f); cached once per pitch.
 */
function baked(ctx: BaseAudioContext, key: string, f0: number, amp: (k: number, f: number) => number, maxF = 9000): PeriodicWave {
  const semi = Math.round(12 * Math.log2(f0 / 440));
  const k = `${key}@${semi}`;
  let m = waves.get(ctx);
  if (!m) waves.set(ctx, (m = new Map()));
  let w = m.get(k);
  if (!w) {
    const fr = 440 * Math.pow(2, semi / 12);
    const n = Math.max(1, Math.min(96, Math.floor(maxF / fr)));
    const real = new Float32Array(n + 1);
    const imag = new Float32Array(n + 1);
    for (let i = 1; i <= n; i++) imag[i] = amp(i, i * fr);
    w = ctx.createPeriodicWave(real, imag);
    m.set(k, w);
  }
  return w;
}

/** Formant (Lorentzian peak): [center, bandwidth, gain] */
const peaks = (f: number, fs: [number, number, number][]): number => {
  let a = 0;
  for (const [F, bw, g] of fs) a += g / (1 + ((f - F) / (bw / 2)) ** 2);
  return a;
};

const noiseBufs = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBufs.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = b.getChannelData(0);
    const r = rng(99);
    for (let i = 0; i < d.length; i++) d[i] = r();
    noiseBufs.set(ctx, b);
  }
  return b;
}

function noiseSrc(ctx: BaseAudioContext, t: number, end: number): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx);
  s.loop = true;
  s.start(t, Math.random() * 2);
  s.stop(end);
  return s;
}

const breathBufs = new WeakMap<BaseAudioContext, AudioBuffer>();
/** Pre-filtered breath noise (a wide band-pass at 1.5-5 kHz), shared by the wind instruments, saving a filter on every note */
function breathSrc(ctx: BaseAudioContext, t: number, end: number): AudioBufferSourceNode {
  let b = breathBufs.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    const r = rng(77);
    let lp = 0;
    let hp = 0;
    for (let i = 0; i < d.length; i++) {
      const x = r();
      lp += 0.45 * (x - lp);
      hp += 0.08 * (lp - hp);
      d[i] = (lp - hp) * 2.2;
    }
    breathBufs.set(ctx, b);
  }
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.loop = true;
  s.start(t, Math.random() * 1.8);
  s.stop(end);
  return s;
}

function osc(ctx: BaseAudioContext, type: OscillatorType | PeriodicWave, f: number, t: number, end: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  if (typeof type === 'string') o.type = type as OscillatorType;
  else o.setPeriodicWave(type);
  o.frequency.setValueAtTime(f, t);
  if (detune) o.detune.setValueAtTime(detune, t);
  o.start(t);
  o.stop(end);
  return o;
}

function filt(ctx: BaseAudioContext, type: BiquadFilterType, f: number, q = 0.7, gain = 0): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  if (gain) b.gain.value = gain;
  return b;
}

function gainNode(ctx: BaseAudioContext, v = 1): GainNode {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

/** ADSR: attack, decay to the sustain ratio, release starting at t+dur. All use explicit ramps (different implementations compute the same result). Returns the time the sound actually ends */
function adsr(g: GainNode, t: number, dur: number, peak: number, a: number, d: number, s: number, r: number): number {
  const p = g.gain;
  const aa = Math.min(a, Math.max(0.003, dur * 0.9));
  const rel = t + Math.max(dur, aa + 0.005);
  const sus = Math.max(1e-4, peak * s);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + aa);
  const dEnd = t + aa + Math.max(0.001, d);
  let lv = peak;
  if (d > 0 && s < 1) {
    if (rel > dEnd) {
      p.exponentialRampToValueAtTime(sus, dEnd);
      lv = sus;
    } else {
      lv = peak * Math.pow(sus / peak, (rel - t - aa) / (dEnd - t - aa));
      p.exponentialRampToValueAtTime(Math.max(1e-4, lv), rel);
    }
  }
  p.setValueAtTime(Math.max(1e-4, lv), rel);
  p.exponentialRampToValueAtTime(1e-4, rel + r);
  p.setValueAtTime(0, rel + r + 0.005);
  return rel + r + 0.02;
}

/** Smoothly fade to 0 (the target of setTargetAtTime cannot be 0: some implementations diverge) */
function fadeTo0(p: AudioParam, t: number, tau: number): void {
  p.setTargetAtTime(1e-4, t, tau);
  p.setValueAtTime(0, t + tau * 9);
}

/** Apply glides to a frequency parameter */
function applyBends(p: AudioParam, c: VoiceCall, ratio = 1, glide = 0.07): void {
  if (!c.bends) return;
  for (const [at, f] of c.bends) p.setTargetAtTime(f * ratio, c.t + at, glide / 3);
}

/** Delayed vibrato: after delay seconds, wobble at depth cents and rate Hz */
function vibrato(ctx: BaseAudioContext, targets: AudioParam[], t: number, end: number, rate: number, cents: number, delay: number): void {
  if (cents <= 0) return;
  const lfo = osc(ctx, 'sine', rate * (0.96 + Math.random() * 0.08), t, end);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0, t + delay * 0.5);
  g.gain.linearRampToValueAtTime(cents, t + delay + 0.3);
  lfo.connect(g);
  for (const p of targets) g.connect(p);
}

function panned(ctx: BaseAudioContext, dest: AudioNode, pan: number): AudioNode {
  if (!pan || !ctx.createStereoPanner) return dest;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  p.connect(dest);
  return p;
}

// ───────────────────────── Woodwinds ─────────────────────────

/** Flute family: sine + a few overtones, breath noise, the "chiff" of the attack, delayed vibrato. kind determines the overtone amount and the breath amount */
function flute(harm: number[], breath: number, chiff: number, vibDepth: number): Voice {
  return (c) => {
    const { ctx, t, f, vel, o } = c;
    const a = o.attack ?? 0.05;
    const r = o.release ?? 0.12;
    const g = gainNode(ctx, 0);
    const end = adsr(g, t, c.dur, vel * 0.3, a, 0.2, 0.88, r);
    g.connect(c.out);
    const w = wave(ctx, `fl${harm.join(',')}`, harm);
    const s = osc(ctx, w, f, t, end);
    // The pitch starts slightly high and falls down to settle
    s.detune.setValueAtTime(18, t);
    s.detune.setTargetAtTime(0, t, 0.02);
    s.connect(g);
    // Breath noise and the attack "chiff" share one stretch of pre-filtered noise
    const ng = gainNode(ctx, 0);
    ng.gain.setValueAtTime(chiff * vel * 1.2, t);
    ng.gain.linearRampToValueAtTime(breath * (o.breath ?? 1), t + 0.05);
    breathSrc(ctx, t, end).connect(ng).connect(g);
    vibrato(ctx, [s.detune], t, end, o.vibRate ?? 5.2, o.vib ?? vibDepth, o.vibDelay ?? 0.28);
    applyBends(s.frequency, c, 1, o.glide ?? 0.06);
  };
}

/** Reed woodwinds (clarinet, oboe, bassoon): a custom harmonic table + resonance peaks */
function reed(key: string, harm: number[], formants: [number, number, number][], vibDepth: number): Voice {
  return (c) => {
    const { ctx, t, f, vel, o } = c;
    const g = gainNode(ctx, 0);
    const end = adsr(g, t, c.dur, vel * 0.2, o.attack ?? 0.035, 0.15, 0.85, o.release ?? 0.1);
    const lp = filt(ctx, 'lowpass', Math.min(8000, 1800 + vel * 3500), 0.5);
    lp.connect(g).connect(c.out);
    let node: AudioNode = lp;
    for (const [ff, q, gain] of formants) {
      const p = filt(ctx, 'peaking', ff, q, gain);
      p.connect(node);
      node = p;
    }
    const s = osc(ctx, wave(ctx, key, harm), f, t, end);
    s.connect(node);
    vibrato(ctx, [s.detune], t, end, 5, o.vib ?? vibDepth, 0.35);
    applyBends(s.frequency, c, 1, o.glide ?? 0.05);
  };
}

// ───────────────────────── Brass ─────────────────────────

/** Brass: the filter "blows open" on the attack, brighter the harder it is played; o.bright scales the brightness */
function brassV(harm: number[], key: string, open: number, sweepT: number, detunes: number[], vibDepth: number): Voice {
  return (c) => {
    const { ctx, t, f, vel, o } = c;
    const g = gainNode(ctx, 0);
    const end = adsr(g, t, c.dur, vel * 0.2, o.attack ?? 0.045, 0.25, 0.8, o.release ?? 0.14);
    const top = Math.min(10000, f * (2 + open * vel * (o.bright ?? 1)) + 400);
    const lp = filt(ctx, 'lowpass', top * 0.25, 1.1);
    lp.frequency.setValueAtTime(Math.max(120, f * 0.9), t);
    lp.frequency.linearRampToValueAtTime(top, t + sweepT);
    lp.frequency.setTargetAtTime(top * 0.7, t + sweepT, 0.4);
    lp.connect(g).connect(c.out);
    const w = wave(ctx, key, harm);
    const oscs = detunes.map((d, i) => {
      const s = osc(ctx, w, f, t, end, d);
      s.connect(panned(ctx, lp, detunes.length > 1 ? (i / (detunes.length - 1) - 0.5) * 0.5 : 0));
      // A slight lip tremble on the attack
      s.detune.setValueAtTime(d - 25, t);
      s.detune.linearRampToValueAtTime(d, t + 0.04);
      return s;
    });
    vibrato(ctx, oscs.map((s) => s.detune), t, end, 5, o.vib ?? vibDepth, 0.35);
    oscs.forEach((s) => applyBends(s.frequency, c));
  };
}

const harmonics = (n: number, pow: number, odd = 1): number[] => Array.from({ length: n }, (_, i) => ((i + 1) % 2 === 0 ? odd : 1) / Math.pow(i + 1, pow));

// ───────────────────────── Voices ─────────────────────────

/** Vowel formants: [frequency, bandwidth, gain] */
const VOWELS: Record<string, [number, number, number][]> = {
  a: [[800, 80, 1], [1150, 90, 0.5], [2900, 120, 0.1], [3900, 130, 0.06]],
  o: [[450, 70, 1], [800, 80, 0.3], [2830, 100, 0.05]],
  u: [[325, 50, 1], [700, 60, 0.15], [2530, 170, 0.03]],
  e: [[400, 60, 1], [1600, 80, 0.25], [2700, 120, 0.12]],
  i: [[300, 50, 1], [2200, 90, 0.2], [3000, 120, 0.15]],
  /** Male voice */
  A: [[650, 80, 1], [1080, 90, 0.5], [2650, 120, 0.2], [2900, 130, 0.12]],
  O: [[400, 70, 1], [750, 80, 0.4], [2400, 100, 0.08]],
  U: [[350, 60, 1], [600, 60, 0.2], [2400, 170, 0.03]],
};

/** Choir: vowel formants baked into the waveform; n voices, each detuned and with vibrato (two LFOs, one positive and one inverted), spread left and right */
function choirV(vowel: string, n: number, spread: number, vibDepth: number, breathy = 0): Voice {
  const fs = VOWELS[vowel].map(([F, bw, g]) => [F, bw * 3, g] as [number, number, number]);
  return (c) => {
    const { ctx, t, f, vel, o } = c;
    const g = gainNode(ctx, 0);
    const end = adsr(g, t, c.dur, vel * 0.5, o.attack ?? 0.25, 0.3, 0.9, o.release ?? 0.5);
    g.connect(c.out);
    const w = baked(ctx, `v${vowel}`, f, (k, hz) => peaks(hz, fs) / Math.pow(k, 0.6) + 0.002 / k, 7000);
    const voices: OscillatorNode[] = [];
    for (let i = 0; i < n; i++) {
      const det = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * spread;
      const s = osc(ctx, w, f, t, end, det);
      s.connect(panned(ctx, g, n === 1 ? 0 : (i / (n - 1) - 0.5) * 0.8));
      applyBends(s.frequency, c, 1, o.glide ?? 0.12);
      voices.push(s);
    }
    const depth = o.vib ?? vibDepth;
    if (depth > 0) {
      const l1 = osc(ctx, 'sine', 4.9 + Math.random() * 0.3, t, end);
      const l2 = osc(ctx, 'sine', 5.6 + Math.random() * 0.3, t, end);
      voices.forEach((v, i) => {
        const lg = ctx.createGain();
        lg.gain.setValueAtTime(0, t);
        lg.gain.linearRampToValueAtTime(depth * (i % 3 === 2 ? -1 : 1), t + 0.5);
        (i % 2 ? l2 : l1).connect(lg).connect(v.detune);
      });
    }
    if (breathy > 0) {
      const nn = noiseSrc(ctx, t, end);
      nn.connect(filt(ctx, 'bandpass', 2500, 0.8)).connect(gainNode(ctx, breathy)).connect(g);
    }
  };
}

/** Throat singing (khoomei): a sustained low note, with a narrow band-pass wandering along the harmonic series to sing a whistle-like second melody */
const throat: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.5, o.attack ?? 0.3, 0.2, 0.9, o.release ?? 0.4);
  g.connect(c.out);
  const s = osc(ctx, 'sawtooth', f, t, end);
  const s2 = osc(ctx, 'sawtooth', f, t, end, 5);
  const src = gainNode(ctx, 0.5);
  s.connect(src);
  s2.connect(src);
  // Chest resonance
  src.connect(filt(ctx, 'bandpass', 420, 2)).connect(gainNode(ctx, 1.3)).connect(g);
  src.connect(filt(ctx, 'lowpass', 300, 0.7)).connect(gainNode(ctx, 0.5)).connect(g);
  // Whistle overtones: a narrow band-pass moving between the 6th and 12th harmonics
  const bp = filt(ctx, 'bandpass', f * 8, 40);
  const bp2 = filt(ctx, 'bandpass', f * 8, 40);
  src.connect(bp).connect(bp2).connect(gainNode(ctx, 22 * (o.whistle ?? 1))).connect(g);
  const seq = [8, 9, 10, 9, 8, 12, 10, 8];
  const step = Math.max(0.35, c.dur / seq.length);
  let tt = t;
  for (let i = 0; tt < end; i++, tt += step) {
    const h = seq[i % seq.length] * f;
    bp.frequency.setTargetAtTime(h, tt, 0.06);
    bp2.frequency.setTargetAtTime(h, tt, 0.06);
  }
  vibrato(ctx, [s.detune, s2.detune], t, end, 4.4, 4, 0.5);
};

// ───────────────────────── Keyboards and reed organs ─────────────────────────

/** Organ: stops (overtones) + the airflow noise of the attack; o.full=1 opens all the stops (adds the 16' and mixture stops) */
const organ: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const full = (o.full ?? 0) > 0;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.14, 0.04, 0, 1, o.release ?? 0.3);
  const lp = filt(ctx, 'lowpass', full ? 9000 : 5000, 0.5);
  lp.connect(g).connect(c.out);
  const flue = full ? [1, 0.8, 0.45, 0.6, 0, 0.35, 0, 0.3, 0, 0, 0, 0.18, 0, 0, 0, 0.12] : [1, 0.55, 0.2, 0.3, 0, 0.12, 0, 0.1];
  const w = wave(ctx, full ? 'orgF' : 'orgP', flue);
  osc(ctx, w, f, t, end).connect(lp);
  // A slightly detuned second rank of stops (celeste)
  osc(ctx, w, f, t, end, 3).connect(panned(ctx, lp, 0.3));
  if (full) osc(ctx, 'sine', f / 2, t, end).connect(gainNode(ctx, 0.7)).connect(lp);
  const cn = noiseSrc(ctx, t, t + 0.12);
  const cg = gainNode(ctx, 0);
  cg.gain.setValueAtTime(0.1 * vel, t);
  fadeTo0(cg.gain, t + 0.01, 0.025);
  cn.connect(filt(ctx, 'bandpass', f * 3, 2)).connect(cg).connect(c.out);
};

/** Accordion (musette): two ranks of reeds detuned against each other beat in a "wah-wah", plus the bellows' dynamics */
const accordion: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.1, o.attack ?? 0.03, 0.2, 0.85, o.release ?? 0.08);
  const bp = filt(ctx, 'peaking', 1400, 1, 5);
  const lp = filt(ctx, 'lowpass', 4200, 0.6);
  bp.connect(lp).connect(g).connect(c.out);
  const w = wave(ctx, 'reed', harmonics(14, 0.75));
  for (const d of [-(o.musette ?? 13), 0, o.musette ?? 13]) osc(ctx, w, f, t, end, d).connect(bp);
};

/** Bagpipe / drone: a narrow-band sawtooth, very long and steady */
const drone: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.12, o.attack ?? 0.4, 0, 1, o.release ?? 0.6);
  const bp = filt(ctx, 'bandpass', f * 3, 0.9);
  const lp = filt(ctx, 'lowpass', 2500, 0.5);
  bp.connect(lp).connect(g).connect(c.out);
  osc(ctx, 'sawtooth', f, t, end).connect(bp);
  osc(ctx, 'sawtooth', f * 1.5, t, end, 2).connect(gainNode(ctx, 0.5)).connect(bp);
};

// ───────────────────────── Synthesizers ─────────────────────────

/** Chord pad: kind 0 warm (sawtooth low-pass), 1 glass (sine + FM sparkle), 2 dark (very low low-pass + sub-bass), 3 air (narrow-band noise) */
function padV(kind: 0 | 1 | 2 | 3): Voice {
  return (c) => {
    const { ctx, t, f, vel, o } = c;
    const g = gainNode(ctx, 0);
    const end = adsr(g, t, c.dur, vel * (kind === 3 ? 0.9 : kind === 1 ? 0.16 : 0.1), o.attack ?? 0.9, 0, 1, o.release ?? 1.2);
    g.connect(c.out);
    if (kind === 3) {
      const n = noiseSrc(ctx, t, end);
      const bp = filt(ctx, 'bandpass', f, 60);
      const bp2 = filt(ctx, 'bandpass', f * 2, 60);
      n.connect(bp).connect(gainNode(ctx, 1.2)).connect(g);
      n.connect(bp2).connect(gainNode(ctx, 0.5)).connect(g);
      return;
    }
    if (kind === 1) {
      const s = osc(ctx, 'sine', f, t, end);
      const m = osc(ctx, 'sine', f * 2.001, t, end);
      const mg = gainNode(ctx, f * 0.6);
      m.connect(mg).connect(s.frequency);
      const sh = osc(ctx, 'sine', f * 4, t, end, 6);
      s.connect(panned(ctx, g, -0.3));
      sh.connect(gainNode(ctx, 0.12)).connect(panned(ctx, g, 0.3));
      // A slowly breathing brightness
      const l = osc(ctx, 'sine', 0.18 + Math.random() * 0.1, t, end);
      l.connect(gainNode(ctx, f * 0.4)).connect(mg.gain);
      return;
    }
    const cut = kind === 2 ? 520 : o.cut ?? 1300;
    const lp = filt(ctx, 'lowpass', cut, 0.8);
    lp.connect(g);
    // The filter slowly opens and closes
    const l = osc(ctx, 'sine', 0.12 + Math.random() * 0.08, t, end);
    l.connect(gainNode(ctx, cut * 0.35)).connect(lp.frequency);
    for (const [d, p] of [[-11, -0.6], [0, 0], [11, 0.6]] as const) osc(ctx, 'sawtooth', f, t, end, d).connect(panned(ctx, lp, p));
    if (kind === 2) osc(ctx, 'sine', f / 2, t, end).connect(gainNode(ctx, 0.6)).connect(g);
  };
}

/** Glass harmonica: two nearly unison sines beat against each other, slow attack */
const glass: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.22, o.attack ?? 0.18, 0.5, 0.7, o.release ?? 0.8);
  g.connect(c.out);
  osc(ctx, 'sine', f, t, end).connect(panned(ctx, g, -0.25));
  osc(ctx, 'sine', f, t, end, 7).connect(panned(ctx, g, 0.25));
  osc(ctx, 'sine', f * 2, t, end, 3).connect(gainNode(ctx, 0.18)).connect(g);
};

/** Synth lead: sawtooth + square, low-pass, glide and vibrato (for the Rift and the rival) */
const synthLead: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.12, o.attack ?? 0.01, 0.2, 0.75, o.release ?? 0.1);
  const lp = filt(ctx, 'lowpass', o.cut ?? 3200, 2);
  lp.connect(g).connect(c.out);
  const s1 = osc(ctx, 'sawtooth', f, t, end, -6);
  const s2 = osc(ctx, 'square', f, t, end, 6);
  s1.connect(lp);
  s2.connect(gainNode(ctx, 0.6)).connect(lp);
  vibrato(ctx, [s1.detune, s2.detune], t, end, 5.8, o.vib ?? 14, 0.2);
  applyBends(s1.frequency, c, 1, o.glide ?? 0.05);
  applyBends(s2.frequency, c, 1, o.glide ?? 0.05);
};

/** Overdrive curve (each computed only once) */
const curves = new Map<string, Float32Array<ArrayBuffer>>();
function tanhCurve(drive: number, n: number, norm = true): Float32Array<ArrayBuffer> {
  const k = `${drive}|${n}|${norm}`;
  let c = curves.get(k);
  if (!c) {
    c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * drive) / (norm ? Math.tanh(drive) : 1);
    curves.set(k, c);
  }
  return c;
}

/** Distorted guitar: root + fifth + octave into overdrive, then through a cabinet; o.mute=1 is palm muting */
const powerGtr: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const mute = (o.mute ?? 0) > 0;
  const g = gainNode(ctx, 0);
  const end = mute ? adsr(g, t, Math.min(c.dur, 0.12), vel * 0.14, 0.004, 0.08, 0.3, 0.06) : adsr(g, t, c.dur, vel * 0.13, 0.005, 0.8, 0.6, 0.12);
  const ws = ctx.createWaveShaper();
  ws.curve = tanhCurve(o.drive ?? 7, 1024);
  const pre = gainNode(ctx, 0.5);
  const cab = filt(ctx, 'lowpass', mute ? 1500 : 3400, 1.1);
  const hp = filt(ctx, 'highpass', 90, 0.7);
  const mid = filt(ctx, 'peaking', 750, 1, -5);
  pre.connect(ws).connect(hp).connect(mid).connect(cab).connect(g).connect(c.out);
  for (const [ratio, det] of [[1, -5], [1.5, 4], [2, 3], [1, 8]] as const) osc(ctx, 'sawtooth', f * ratio, t, end, det).connect(pre);
};

// ───────────────────────── Bass ─────────────────────────

/** Fingerstyle bass: sine + triangle, a plucked-string low-pass envelope */
const fingerBass: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.5, 0.006, 0.6, 0.55, o.release ?? 0.08);
  const lp = filt(ctx, 'lowpass', 400, 1);
  lp.frequency.setValueAtTime(900 + vel * 900, t);
  lp.frequency.setTargetAtTime(350, t, 0.12);
  lp.connect(g).connect(c.out);
  osc(ctx, 'sine', f, t, end).connect(lp);
  osc(ctx, 'triangle', f, t, end).connect(gainNode(ctx, 0.6)).connect(lp);
  osc(ctx, 'sawtooth', f, t, end).connect(gainNode(ctx, 0.12)).connect(lp);
};

/** Synth bass: the envelope of a resonant low-pass goes "bwop" */
const synthBass: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.32, 0.004, 0.3, 0.7, o.release ?? 0.06);
  const lp = filt(ctx, 'lowpass', 200, o.q ?? 6);
  lp.frequency.setValueAtTime(Math.min(6000, f * (6 + vel * 10)), t);
  lp.frequency.setTargetAtTime(f * 2.2, t, o.env ?? 0.08);
  lp.connect(g).connect(c.out);
  osc(ctx, 'sawtooth', f, t, end, -4).connect(lp);
  osc(ctx, 'sawtooth', f, t, end, 4).connect(lp);
  osc(ctx, 'sine', f / 2, t, end).connect(gainNode(ctx, 0.8)).connect(g);
  const s = osc(ctx, 'square', f, t, end);
  s.connect(gainNode(ctx, 0.3)).connect(lp);
  applyBends(s.frequency, c);
};

/** Sub-bass: a pure sine */
const subBass: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.55, o.attack ?? 0.01, 0, 1, o.release ?? 0.1);
  g.connect(c.out);
  const s = osc(ctx, 'sine', f, t, end);
  s.connect(g);
  applyBends(s.frequency, c);
};

/** Distorted bass (the Rift, the rival): sawtooth + square overdriven */
const distBass: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.26, 0.005, 0.3, 0.8, o.release ?? 0.06);
  const ws = ctx.createWaveShaper();
  ws.curve = tanhCurve(4, 512, false);
  const lp = filt(ctx, 'lowpass', o.cut ?? 1400, 1.2);
  const pre = gainNode(ctx, 0.6);
  pre.connect(ws).connect(lp).connect(g).connect(c.out);
  osc(ctx, 'sawtooth', f, t, end).connect(pre);
  osc(ctx, 'square', f / 2, t, end).connect(pre);
  osc(ctx, 'sine', f / 2, t, end).connect(gainNode(ctx, 0.6)).connect(g);
};

// ───────────────────────── Ambience ─────────────────────────




/** Birdsong: random sine glide chirps */
const birds: Voice = (c) => {
  const { ctx, t, vel } = c;
  const end = t + c.dur;
  const r = rng(Math.floor(t * 53) + 7);
  for (let tt = t + Math.abs(r()) * 1.5; tt < end - 0.4; tt += 0.6 + Math.abs(r()) * 2.8) {
    const base = 2600 + Math.abs(r()) * 2400;
    const notes = 2 + Math.floor(Math.abs(r()) * 4);
    const pan = r() * 0.8;
    for (let k = 0; k < notes; k++) {
      const st = tt + k * (0.07 + Math.abs(r()) * 0.05);
      const s = osc(ctx, 'sine', base, st, st + 0.09);
      s.frequency.setValueAtTime(base * (1 + r() * 0.1), st);
      s.frequency.exponentialRampToValueAtTime(base * (1.3 + r() * 0.3), st + 0.06);
      const g = gainNode(ctx, 0);
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(vel * 0.05, st + 0.01);
      g.gain.linearRampToValueAtTime(0, st + 0.08);
      s.connect(g).connect(panned(ctx, c.out, pan));
    }
  }
};



/** Riser: band-pass noise and a sawtooth sweep upward together, reaching the top when the note ends and cutting off instantly (leading into the next beat's heavy hit) */
const riser: Voice = (c) => {
  const { ctx, t, vel, o } = c;
  const end = t + c.dur;
  const g = gainNode(ctx, 0);
  g.gain.setValueAtTime(1e-4, t);
  g.gain.exponentialRampToValueAtTime(vel * 0.8, end);
  g.gain.linearRampToValueAtTime(0, end + 0.03);
  g.connect(c.out);
  const n = noiseSrc(ctx, t, end + 0.05);
  const bp = filt(ctx, 'bandpass', o.from ?? 260, 1.6);
  bp.frequency.setValueAtTime(o.from ?? 260, t);
  bp.frequency.exponentialRampToValueAtTime(o.to ?? 7000, end);
  n.connect(bp).connect(g);
  const s = osc(ctx, 'sawtooth', 110, t, end + 0.05);
  s.frequency.exponentialRampToValueAtTime(440, end);
  s.connect(filt(ctx, 'lowpass', 1200, 0.7)).connect(gainNode(ctx, 0.25)).connect(g);
};

// ───────────────────────── Catalog ─────────────────────────

export const VOICES: Record<string, Voice> = {
  flute: flute([1, 0.08, 0.03], 0.05, 0.25, 11),
  /** Pan flute: lots of breath, few overtones, a very noticeable chiff on the attack */
  panflute: flute([1, 0.03, 0.05], 0.12, 0.55, 8),
  ocarina: flute([1, 0.02], 0.025, 0.1, 6),
  /** Tin whistle: bright, thin, with lots of ornaments */
  whistle: flute([1, 0.2, 0.08, 0.05], 0.06, 0.35, 9),
  clarinet: reed('cla', harmonics(12, 1, 0.12), [[1500, 1, 2]], 5),
  oboe: reed('obo', harmonics(16, 0.6), [[1100, 1.8, 7], [2800, 2, 5]], 10),
  bassoon: reed('bsn', harmonics(16, 0.7), [[500, 1.5, 6], [1150, 2, 4]], 6),
  horn: brassV(harmonics(14, 1.5), 'hrn', 1.6, 0.09, [0], 5),
  horns: brassV(harmonics(14, 1.5), 'hrn', 1.6, 0.1, [-6, 6], 4),
  trumpet: brassV(harmonics(20, 1.05), 'tpt', 5, 0.04, [0], 7),
  trumpets: brassV(harmonics(20, 1.05), 'tpt', 5, 0.05, [-7, 0, 7], 5),
  trombone: brassV(harmonics(20, 1.15), 'tbn', 3, 0.07, [-5, 5], 3),
  tuba: brassV(harmonics(12, 1.4), 'tba', 1.2, 0.08, [0], 2),
  /** Choir (female voices on the vowels a, o, u) and male voices (A, O, U) */
  choir: choirV('a', 3, 12, 16),
  choirOo: choirV('u', 3, 10, 12),
  choirO: choirV('o', 3, 10, 14),
  /** Male choir: the dwarves, the cult */
  menChoir: choirV('A', 3, 14, 10),
  /** Monk chant: a male o with almost no vibrato */
  chant: choirV('O', 3, 6, 2),
  /** Solo soprano (aria) */
  soprano: choirV('a', 1, 0, 45, 0.02),
  throat,
  organ,
  /** Organ with all stops */
  organFull: (c) => organ({ ...c, o: { full: 1, ...c.o } }),
  accordion,
  drone,
  warmPad: padV(0),
  glassPad: padV(1),
  darkPad: padV(2),
  airPad: padV(3),
  glass,
  synthLead,
  powerGtr,
  muteGtr: (c) => powerGtr({ ...c, o: { mute: 1, ...c.o } }),
  bass: fingerBass,
  synthBass,
  sub: subBass,
  distBass,
  birds,
  riser,
};

/** Instruments that support glide (the > marker) */
export const GLIDERS = new Set(['violin', 'cello', 'fiddle', 'morin', 'flute', 'panflute', 'ocarina', 'whistle', 'clarinet', 'oboe', 'bassoon', 'horn', 'trumpet', 'trombone', 'soprano', 'synthLead', 'synthBass', 'sub', 'strings']);
