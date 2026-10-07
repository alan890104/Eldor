// Instrument catalog: sampled (samples computed in dsp.ts) and live-synthesized (voices.ts). Songs pick instruments by name.

import { AMB, brassStab, DRUMS, epiano, ks, modal, piano, pluckAdd, spicc, type Partial } from './dsp.ts';
import { BOWS, bowSample, type Bowed, type BowInst } from './bow.ts';
import { GLIDERS, VOICES, type VoiceCall } from './voices.ts';

type Render = (sr: number, m: number, variant: number) => Float32Array | [Float32Array, Float32Array] | Bowed;

interface Sampled {
  kind: 'sample';
  render: Render;
  /** ring: the sample rings out naturally; damp: closed off with release seconds when the note ends */
  hold: 'ring' | 'damp';
  release?: number;
  level: number;
  /** Number of random variants (so drums do not sound machine-gunned) */
  variants?: number;
  /** Drums that do not follow pitch: always render the sample with this note */
  fixed?: number;
  /** Ambience: loops, the note length is the duration (attack / release come from opts.attack / release) */
  loop?: boolean;
  /** Minimum time a damp instrument rings (seconds): a note cut too short sounds electronic */
  minHold?: number;
  /** Bowed strings: one sample every few semitones (soft and hard layers), the sustain section loops, and pitch is made up with a rate change */
  bow?: BowInst & { name: string };
  /** Velocity determines timbre: the low-pass cutoff (Hz) for this note and velocity. The sample is the brightest strike; a light touch rolls off the highs */
  tone?: (m: number, vel: number) => number;
  /** Damping time by pitch (seconds); Infinity means no damper, so the string rings on even after release (the piano's highest strings) */
  damper?: (m: number) => number;
}
interface Live {
  kind: 'live';
  level: number;
}
export type InstDef = Sampled | Live;

const f0 = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** The factor by which decay gets faster as pitch rises */
const hiShort = (m: number, ref = 60, per = 24) => Math.pow(0.5, (m - ref) / per);

function modalInst(parts: Partial[], len: number, extra: Omit<Parameters<typeof modal>[3], 'len'> = {}, tscale = true): Render {
  return (sr, m) => {
    const k = tscale ? Math.min(2.2, Math.max(0.35, hiShort(m, 64, 30))) : 1;
    return modal(sr, f0(m), parts.map(([r, a, t]) => [r, a, t * k]), { len: Math.min(8, len * Math.max(0.5, k)), ...extra });
  };
}

/** The piano's velocity timbre: the softer the strike, the longer the hammer stays on the string and the fewer the highs (low-pass cutoff, Hz) */
const pianoTone = (m: number, v: number): number => 900 * Math.pow(2, (m - 40) / 24) * (1 + 14 * Math.pow(v, 2.5));
/** Piano dampers: bass strings are thick and settle slowly; the highest section (above F#6) has no damper */
const pianoDamper = (m: number): number => (m >= 90 ? Infinity : m < 45 ? 0.45 : m < 70 ? 0.25 : 0.16);

const S = (render: Render, level: number, hold: 'ring' | 'damp' = 'ring', release = 0.2): Sampled => ({ kind: 'sample', render, hold, level, release });
const D = (name: string, level: number, fixed?: number, variants = 3): Sampled => ({ kind: 'sample', render: (sr, m, v) => DRUMS[name](sr, m, 1000 + v * 17 + m), hold: 'ring', level, variants, fixed });

export const INSTRUMENTS: Record<string, InstDef> = {
  // ── Plucked strings
  harp: S((sr, m) => ks(sr, f0(m), { len: Math.min(6, 5 * hiShort(m, 48, 30) + 0.6), t60: 6 * hiShort(m, 48, 28), bright: 0.35, pos: 0.28, s: 0.5 }), 0.7),
  nylon: S((sr, m) => ks(sr, f0(m), { len: 3.2, t60: 3.4 * hiShort(m, 52, 30), bright: 0.5, pos: 0.18, s: 0.5 }), 0.7, 'damp', 0.35),
  /** Lute / oud: sharp, bright, short, double-strung */
  lute: S((sr, m) => ks(sr, f0(m), { len: 2.4, t60: 2.2 * hiShort(m, 52, 30), bright: 0.8, pos: 0.1, s: 0.42, detune: 4 }), 0.65, 'damp', 0.25),
  steel: S((sr, m) => ks(sr, f0(m), { len: 4, t60: 4.5 * hiShort(m, 52, 30), bright: 0.85, pos: 0.13, s: 0.35 }), 0.55, 'damp', 0.4),
  /** Hammered dulcimer: double-strung, bright, long */
  dulcimer: S((sr, m) => ks(sr, f0(m), { len: 4, t60: 3.5 * hiShort(m, 60, 30), bright: 0.9, pos: 0.12, s: 0.4, detune: 6 }), 0.55),
  pizz: S((sr, m) => ks(sr, f0(m), { len: 0.9, t60: 0.55 * hiShort(m, 48, 36), bright: 0.3, pos: 0.3, s: 0.5 }), 0.8),
  /** Plucked bass (double bass pizzicato) */
  pizzBass: { ...S((sr, m) => pluckAdd(sr, f0(m), { len: 2.2, t60: 1.6 * hiShort(m, 36, 24), pos: 0.22, tilt: 0.85, body: [98, 196], thump: 0.35 }), 1.1, 'damp', 0.35), minHold: 0.32 },
  // ── Struck melodic instruments
  kalimba: S(modalInst([[1, 1, 1.6], [5.95, 0.22, 0.14], [2.0, 0.05, 0.5]], 2.2, { click: { amp: 0.15, t: 0.006, hz: 3000 } }), 0.55),
  marimba: S(modalInst([[1, 1, 1.1], [3.93, 0.22, 0.22], [9.2, 0.05, 0.05]], 1.6, { attack: 0.0015, click: { amp: 0.35, t: 0.018, hz: 2.6, q: 0.7 } }), 0.65),
  vibes: S(modalInst([[1, 1, 3.5], [4.0, 0.2, 0.8], [10, 0.04, 0.15]], 4, { trem: [5.5, 0.35], attack: 0.002 }), 0.5, 'damp', 0.6),
  glock: S(modalInst([[1, 1, 2.4], [2.76, 0.35, 0.9], [5.4, 0.15, 0.4]], 3, { click: { amp: 0.1, t: 0.004, hz: 7000 } }), 0.35),
  celesta: S(modalInst([[1, 1, 1.4], [2, 0.18, 0.6], [4, 0.1, 0.25], [10.3, 0.03, 0.08]], 2, { click: { amp: 0.06, t: 0.005, hz: 5000 } }), 0.45),
  musicbox: S(modalInst([[1, 1, 1.5], [3.0, 0.18, 0.5], [5.95, 0.12, 0.3], [9.1, 0.05, 0.12]], 2.2, { click: { amp: 0.12, t: 0.003, hz: 6000 }, beat: 2 }), 0.4),
  /** Church bell: hum, prime, minor-third tierce, fifth, nominal (the pitch you hear) */
  bell: S((sr, m) => modal(sr, f0(m) / 2, [[0.5, 0.55, 9], [1, 0.7, 6], [1.183, 0.5, 4.5], [1.506, 0.28, 3.5], [2, 1, 4], [2.514, 0.3, 2.2], [2.662, 0.25, 2], [3.011, 0.2, 1.6], [4.166, 0.1, 1]], { len: 7, beat: 2.5, click: { amp: 0.2, t: 0.01, hz: 4000, q: 0.7 } }), 0.4),
  /** Tubular bell: brighter, shorter */
  chime: S((sr, m) => modal(sr, f0(m), [[1, 1, 3.5], [2.76, 0.5, 2], [5.4, 0.3, 1.2], [8.93, 0.12, 0.6]], { len: 4, click: { amp: 0.25, t: 0.006, hz: 5000 } }), 0.35),
  steelpan: S(modalInst([[1, 1, 1.4], [2, 0.55, 0.9], [3, 0.22, 0.5], [4.02, 0.1, 0.3]], 1.8, { bend: 1.02, bendT: 0.02, click: { amp: 0.1, t: 0.008, hz: 2500 } }), 0.5),
  piano: { ...S((sr, m) => piano(sr, m), 0.75, 'damp', 0.3), tone: (m, v) => pianoTone(m, v), damper: pianoDamper },
  /** Soft piano (felt-muted, used for narrative and the ending) */
  softPiano: { ...S((sr, m) => piano(sr, m, true), 0.8, 'damp', 0.45), tone: (m, v) => pianoTone(m, v) * 0.8, damper: (m) => pianoDamper(m) * 1.4 },
  epiano: S((sr, m) => epiano(sr, m), 0.6, 'damp', 0.3),
  /** Reversed piano (Rift, memories): swells in from nothing and is sucked in on the beat */
  revPiano: S((sr, m) => {
    const d = piano(sr, m, true).slice(0, Math.floor(sr * 1.8));
    d.reverse();
    return d;
  }, 0.6),
  // ── Drums (pitch is passed to tuned drums)
  kick: D('kick', 0.9, 36),
  boom: D('boom', 0.9, 36, 2),
  snare: D('snare', 0.55, 38),
  field: D('field', 0.5, 38),
  rim: D('rim', 0.4, 37),
  clap: D('clap', 0.9, 39),
  hat: D('hat', 0.6, 42, 4),
  ohat: D('ohat', 0.55, 46),
  ride: D('ride', 0.5, 51, 2),
  crash: D('crash', 0.3, 49, 2),
  swell: D('swell', 0.3, 49, 1),
  shaker: D('shaker', 0.25, 70, 4),
  tamb: D('tamb', 0.45, 54),
  taiko: D('taiko', 0.95),
  frame: D('frame', 0.7),
  darbuka: D('darbuka', 0.6),
  tom: D('tom', 0.7),
  timpani: D('timpani', 0.75),
  woodblock: D('woodblock', 0.4),
  clave: D('clave', 0.3, 75),
  anvil: D('anvil', 0.3),
  gong: D('gong', 0.5, undefined, 1),
  thunder: D('thunder', 0.6, 30, 2),
  thunderclap: D('thunderclap', 0.8, 30, 2),
  chain: D('chain', 0.3, 60),
  snap: D('snap', 0.35, 60),
  brush: D('brush', 0.3, 60),
  drip: D('drip', 0.25),
  // ── Short samples for fast figures
  spicc: S((sr, m) => spicc(sr, m), 0.55),
  brassStab: S((sr, m) => brassStab(sr, m), 0.55),
  // ── Ambience (stereo, seamless loops; pitch is meaningless)
  ...Object.fromEntries(
    Object.keys(AMB).map((name) => [
      name,
      { kind: 'sample', render: (sr: number) => [AMB[name](sr, 11), AMB[name](sr, 29)] as [Float32Array, Float32Array], hold: 'damp', level: ({ crickets: 0.2, rain: 0.25, void: 0.17, cave: 0.25, fire: 0.35 } as Record<string, number>)[name] ?? 0.4, fixed: 60, loop: true } satisfies Sampled,
    ]),
  ),
};

/** Volume of live-synthesized instruments (roughly aligned with the sampled instruments) */
const LIVE_LEVEL: Record<string, number> = {
  flute: 0.7, panflute: 0.7, ocarina: 0.7, whistle: 0.7,
  oboe: 1.4, bassoon: 1.4, trumpet: 1.3, trombone: 1.1,
  choir: 0.36, choirO: 0.3, choirOo: 0.26, menChoir: 0.37, chant: 0.31, soprano: 0.55,
  throat: 0.6, organ: 1.2, organFull: 1.2, accordion: 1.4, drone: 2,
  warmPad: 1.3, darkPad: 1.3, airPad: 5, synthLead: 1.4, powerGtr: 1.4, muteGtr: 1.4,
  bass: 0.5, synthBass: 0.5, sub: 0.5, distBass: 0.7,
};
for (const name of Object.keys(VOICES)) INSTRUMENTS[name] = { kind: 'live', level: LIVE_LEVEL[name] ?? 1 };
// Bowed strings: ensemble samples of players, computed offline (bow.ts)
for (const [name, b] of Object.entries(BOWS)) {
  const key = b.share ?? name;
  let seed = 0;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  INSTRUMENTS[name] = { kind: 'sample', render: (sr, m, v) => bowSample(sr, f0(m), b.def, v === 1, seed + m * 101 + v), hold: 'damp', level: b.level, release: b.release, bow: { ...b, name: key } };
}

export const isGlider = (name: string) => GLIDERS.has(name);

// ───────────────────────── Sample cache ─────────────────────────

const cache = new Map<string, AudioBuffer>();
/** Loop section of a bowed-string sample (seconds) */
const loops = new WeakMap<AudioBuffer, [number, number]>();
const keyOf = (sr: number, name: string, m: number, v: number) => `${sr}|${name}|${m}|${v}`;

function sampleMidi(def: Sampled, m: number): number {
  if (def.bow) return Math.round(m / def.bow.zone) * def.bow.zone;
  return def.fixed ?? Math.round(m);
}

/** How much memory bowed-string samples may take at most (bytes): beyond that the least recently used are dropped (notes already playing still hold a reference, so they are unaffected) */
const BOW_BUDGET = 48e6;
const bowUse = new Map<string, number>();
let bowBytes = 0;
function keepBow(k: string, b: AudioBuffer): void {
  if (!bowUse.has(k)) bowBytes += b.length * 4;
  bowUse.delete(k);
  bowUse.set(k, b.length * 4);
  for (const [old, n] of bowUse) {
    if (bowBytes <= BOW_BUDGET) break;
    bowUse.delete(old);
    cache.delete(old);
    bowBytes -= n;
  }
}

/** Which layer a bowed string uses at this velocity (times opts.bright); near the threshold both layers are prepared (velocity has a little randomness at playback) */
export function bowLayers(def: Sampled, vel: number, bright = 1): number[] {
  const x = vel * bright;
  const at = def.bow!.loudAt;
  if (Math.abs(x - at) < 0.06) return [0, 1];
  return [x > at ? 1 : 0];
}

/** How many variants of a sampled instrument to precompute (random variants for drums; the soft and hard layers for bowed strings) */
export const variantsOf = (def: Sampled): number => (def.bow ? 2 : def.variants ?? 1);

/** Compute (or fetch from the cache) a sample */
export function getSample(ctx: BaseAudioContext, name: string, m: number, variant = 0): AudioBuffer | null {
  const def = INSTRUMENTS[name];
  if (!def || def.kind !== 'sample') return null;
  const mm = sampleMidi(def, m);
  const v = variant % variantsOf(def);
  const k = keyOf(ctx.sampleRate, def.bow?.name ?? name, mm, v);
  let b = cache.get(k);
  if (!b) {
    const sr = def.bow ? Math.round(ctx.sampleRate * def.bow.rate) : ctx.sampleRate;
    const data = def.render(sr, mm, v);
    const chans = data instanceof Float32Array ? [data] : Array.isArray(data) ? data : [data.data];
    b = ctx.createBuffer(chans.length, chans[0].length, sr);
    chans.forEach((d, i) => b!.getChannelData(i).set(d));
    if (!(data instanceof Float32Array) && !Array.isArray(data)) loops.set(b, [data.loop[0] / sr, data.loop[1] / sr]);
    cache.set(k, b);
    if (def.bow) keepBow(k, b);
  } else if (def.bow) keepBow(k, b);
  return b;
}

/** Precompute the samples a song will use; after more than 12 ms of continuous computing, yield the main thread for a moment (so the screen does not stall) */
export async function prepare(ctx: BaseAudioContext, needs: Need[]): Promise<void> {
  let last = performance.now();
  for (const [name, m, layer] of needs) {
    const def = INSTRUMENTS[name];
    if (!def || def.kind !== 'sample') continue;
    for (let v = 0; v < variantsOf(def); v++) {
      if (layer !== undefined && v !== layer) continue;
      const k = keyOf(ctx.sampleRate, def.bow?.name ?? name, sampleMidi(def, m), v);
      if (cache.has(k)) continue;
      getSample(ctx, name, m, v);
      if (performance.now() - last > 12) {
        await new Promise((r) => setTimeout(r, 0));
        last = performance.now();
      }
    }
  }
}

/** The samples a song needs prepared: [instrument, pitch, only this layer (bowed strings)] */
export type Need = [string, number, number?];

/** Synchronous version (offline rendering, short play-once jingles) */
export function prepareSync(ctx: BaseAudioContext, needs: Need[]): void {
  for (const [name, m, layer] of needs) {
    const def = INSTRUMENTS[name];
    if (!def || def.kind !== 'sample') continue;
    for (let v = 0; v < variantsOf(def); v++) if (layer === undefined || v === layer) getSample(ctx, name, m, v);
  }
}

export interface NoteCall {
  ctx: BaseAudioContext;
  out: AudioNode;
  t: number;
  dur: number;
  m: number;
  vel: number;
  bends?: [number, number][];
  opts?: Record<string, number>;
}

/** Play one note */
export function playNote(name: string, c: NoteCall): void {
  const def = INSTRUMENTS[name];
  if (!def) throw new Error(`No such instrument: ${name}`);
  const amp = Math.pow(c.vel, 1.4) * def.level;
  if (def.kind === 'live') {
    const call: VoiceCall = { ctx: c.ctx, out: c.out, t: c.t, dur: c.dur, f: f0(c.m), vel: amp, bends: c.bends?.map(([at, m]) => [at, f0(m)]), o: c.opts ?? {} };
    VOICES[name](call);
    return;
  }
  if (def.bow) {
    playBow(def, name, c, amp);
    return;
  }
  const variant = Math.floor(Math.random() * (def.variants ?? 1));
  const b = getSample(c.ctx, name, c.m, variant);
  if (!b) return;
  const src = c.ctx.createBufferSource();
  src.buffer = b;
  // A fixed-pitch drum given a different note is tuned by changing the playback rate (taiko, tom and others are already computed by pitch and never reach here)
  if (def.fixed !== undefined && c.m && c.m !== def.fixed && (c.opts?.tune ?? 0) > 0) src.playbackRate.value = Math.pow(2, (c.m - def.fixed) / 12);
  const g = c.ctx.createGain();
  if (def.loop) {
    src.loop = true;
    const a = c.opts?.attack ?? 1.5;
    const r = c.opts?.release ?? 1.5;
    g.gain.setValueAtTime(0, c.t);
    g.gain.linearRampToValueAtTime(amp, c.t + a);
    g.gain.setValueAtTime(amp, c.t + Math.max(a, c.dur));
    g.gain.linearRampToValueAtTime(0, c.t + Math.max(a, c.dur) + r);
    src.connect(g).connect(c.out);
    src.start(c.t, (c.t * 7.3) % b.duration);
    src.stop(c.t + Math.max(a, c.dur) + r + 0.05);
    return;
  }
  g.gain.value = amp;
  if (def.tone) {
    const lp = c.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(c.ctx.sampleRate * 0.45, def.tone(c.m, c.vel));
    // The Web Audio low-pass Q is the resonance in decibels: -3 dB is roughly Butterworth, with no nasal tone
    lp.Q.value = -3;
    src.connect(lp).connect(g).connect(c.out);
  } else src.connect(g).connect(c.out);
  src.start(c.t);
  const r = c.opts?.release ?? def.damper?.(c.m) ?? def.release ?? 0.2;
  if (def.hold === 'damp' && !(c.opts?.ring ?? 0) && r !== Infinity) {
    const off = c.t + Math.max(def.minHold ?? 0.03, c.dur);
    g.gain.setValueAtTime(amp, off);
    g.gain.setTargetAtTime(1e-4, off, r / 4);
    src.stop(Math.min(off + r * 1.5, c.t + b.duration));
  } else src.stop(c.t + b.duration);
}

/** Bowed strings: pick the soft or hard layer, make up pitch with a rate change, loop the sustain section, and lift the bow when the note ends */
function playBow(def: Sampled, name: string, c: NoteCall, amp: number): void {
  const bw = def.bow!;
  const o = c.opts ?? {};
  let loud = c.vel * (o.bright ?? 1) > bw.loudAt ? 1 : 0;
  const root = sampleMidi(def, c.m);
  // If this layer is not prepared but the other one is: use the other for now, rather than computing on the fly during playback (that would stall)
  if (!cache.has(keyOf(c.ctx.sampleRate, bw.name, root, loud)) && cache.has(keyOf(c.ctx.sampleRate, bw.name, root, 1 - loud))) loud = 1 - loud;
  const b = getSample(c.ctx, name, c.m, loud);
  if (!b) return;
  const src = c.ctx.createBufferSource();
  src.buffer = b;
  const lp = loops.get(b);
  if (lp) {
    src.loop = true;
    src.loopStart = lp[0];
    src.loopEnd = lp[1];
  }
  const rate = src.playbackRate;
  rate.setValueAtTime(Math.pow(2, (c.m - root) / 12), c.t);
  const glide = o.glide ?? bw.glide;
  if (c.bends) for (const [at, m] of c.bends) rate.setTargetAtTime(Math.pow(2, (m - root) / 12), c.t + at, glide / 3);
  const a = Math.max(0.005, o.attack ?? bw.attack);
  const r = o.release ?? bw.release;
  const off = c.t + Math.max(c.dur, 0.06);
  const g = c.ctx.createGain();
  const p = g.gain;
  p.setValueAtTime(0, c.t);
  p.linearRampToValueAtTime(amp, c.t + Math.min(a, Math.max(0.005, off - c.t)));
  p.setValueAtTime(amp, off);
  p.setTargetAtTime(1e-4, off, r / 4);
  src.connect(g).connect(c.out);
  src.start(c.t);
  src.stop(off + r * 1.6 + 0.02);
}
