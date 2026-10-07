// Score and sound effects for the prologue animation. Instruments and reverb both use the music/ engine (the same set as every scene), and every time point is read from CUE in render/prologue/script.ts.
// Each frame the scheduler gets the animation's time t, converts the events within the next 0.5 s to audio time and plays them, so picture and sound never drift.
//
// The score quotes the leitmotif of the main theme, the Eldor Overture: a major-sixth leap A -> F#, followed by E D E.
//   0-20    Night of the Shattered Heart: a low drone on D and a heartbeat, with a low bell struck under every beat; as the hand reaches in, the violins tighten up high;
//           at the scream, horns and trombones roar dissonantly in unison while the bass crawls down by semitones; after the shatter, eight bell strokes descend,
//           spiccato strings flee in sixteenth notes, with choir and timpani; when the pact mark lights up the bells rise and a riser pushes up to the cut to black.
//   20-23   One deep bell, a soft D major choir.
//   23-40   The lost world: over harp arpeggios, the flute sings the leitmotif's first phrase (D, Bm, G, A); small bells for the spirits' birth;
//           a bell as foreheads touch, and as the pact mark appears the glockenspiel plays the motif's major sixth.
//   40-57   Aftermath: horns and trumpets sing the motif big, with a timpani hit and a bell each time a source crystal is caught; the Void section keeps only a dissonant dark pad,
//           long cello notes and a faint heartbeat; as the Astralgate goes dark the timpani walks downward, and the world sinks into silence.
//   57-72   The present: a low pizzicato, the meteors' chimes; the string pad and the high harp return; when the Astralgate lights up the trumpets play the motif's major sixth A -> F#,
//           when the dragon opens its eyes E D E follows, coming to rest on D major bells and choir.
// Music goes through the synth.music bus and sound effects through synth.sfx, and both follow the volumes in the settings.

import { synth } from './sfx.ts';
import { CUE } from '../render/prologue/script.ts';
import { INSTRUMENTS, playNote, prepare } from './music/instruments.ts';
import { impulseBuffer } from './music/engine.ts';
import { arp, mel, pad, prog, type Part } from './music/notation.ts';
import { midi } from './music/theory.ts';

const freq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** The soundtrack's tracks: instrument, volume, pan, reverb send */
const TRACKS: Record<string, { inst: string; gain: number; pan?: number; rev?: number; opts?: Record<string, number> }> = {
  drone: { inst: 'darkPad', gain: 0.7, rev: 0.5 },
  low: { inst: 'contrabass', gain: 0.8, rev: 0.35 },
  pad: { inst: 'strPad', gain: 0.9, pan: -0.15, rev: 0.5 },
  choir: { inst: 'choir', gain: 0.9, pan: 0.1, rev: 0.6 },
  choirOo: { inst: 'choirOo', gain: 0.9, pan: -0.1, rev: 0.6 },
  violin: { inst: 'violin', gain: 0.8, pan: 0.2, rev: 0.55 },
  cello: { inst: 'cello', gain: 0.9, pan: -0.1, rev: 0.55 },
  flute: { inst: 'flute', gain: 1.3, pan: 0.1, rev: 0.45 },
  harp: { inst: 'harp', gain: 0.7, pan: -0.25, rev: 0.45 },
  celesta: { inst: 'celesta', gain: 0.6, pan: 0.3, rev: 0.55 },
  glock: { inst: 'glock', gain: 0.6, pan: 0.3, rev: 0.6 },
  bell: { inst: 'bell', gain: 0.9, rev: 0.6 },
  chime: { inst: 'chime', gain: 0.7, pan: 0.2, rev: 0.6 },
  glass: { inst: 'glassPad', gain: 0.5, pan: 0.2, rev: 0.7 },
  horns: { inst: 'horns', gain: 0.8, pan: -0.25, rev: 0.45, opts: { release: 0.3 } },
  trumpets: { inst: 'trumpets', gain: 0.75, pan: 0.15, rev: 0.45, opts: { release: 0.4 } },
  trombone: { inst: 'trombone', gain: 0.8, pan: -0.1, rev: 0.4 },
  spicc: { inst: 'spicc', gain: 1.3, pan: -0.1, rev: 0.25 },
  pluck: { inst: 'pizzBass', gain: 1.0, rev: 0.45 },
  timp: { inst: 'timpani', gain: 0.9, rev: 0.35 },
  crash: { inst: 'crash', gain: 0.55, rev: 0.3 },
  boom: { inst: 'boom', gain: 0.8, rev: 0.4 },
  thunder: { inst: 'thunder', gain: 0.9, rev: 0.4 },
  riser: { inst: 'riser', gain: 0.45, rev: 0.3 },
  void: { inst: 'void', gain: 0.7, rev: 0.2 },
};
/** The hall's reverb (soundtrack) and a smaller space (sound effects) */
const HALL = { size: 3.2, damp: 0.45, pre: 0.03, er: 0.3 };
const ROOM = { size: 2.0, damp: 0.5, pre: 0.015, er: 0.4 };

type NoteEv = { t: number; k: string; m: number[]; d: number; v: number; opts?: Record<string, number> };
type FnEv = { t: number; fn: (at: number) => void };
type Ev = NoteEv | FnEv;

/** The leitmotif (first phrase of the main theme's A section) */
const MOTIF = 'A4:4 F#5:6 E5:2 D5:2 E5:2 | F#5:4 B4:4 D5:6 C#5:2 | B4:4 G5:6 F#5:2 E5:2 D5:2 | E5:12 r:4';

let noiseBuf: AudioBuffer | null = null;
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

class PrologueMusic {
  private ctx: BaseAudioContext | null = null;
  /** Buses for music and sound effects */
  private mus: GainNode | null = null;
  private fx: GainNode | null = null;
  private master: GainNode | null = null;
  private tracks = new Map<string, AudioNode>();
  private events: Ev[] = [];
  private cursor = 0;
  running = false;

  // ───────────────────────── Soundtrack ─────────────────────────

  /** Input of one track (wired up the first time it is used: volume, pan, reverb send) */
  private track(k: string): AudioNode {
    let n = this.tracks.get(k);
    if (n) return n;
    const ctx = this.ctx!;
    const def = TRACKS[k];
    const g = ctx.createGain();
    g.gain.value = def.gain;
    const p = ctx.createStereoPanner();
    p.pan.value = def.pan ?? 0;
    g.connect(p).connect(this.mus!);
    const send = ctx.createGain();
    send.gain.value = def.rev ?? 0.3;
    p.connect(send).connect(this.musRev!);
    this.tracks.set(k, g);
    return g;
  }
  private musRev: AudioNode | null = null;

  private play(e: NoteEv, at: number): void {
    const def = TRACKS[e.k];
    const out = this.track(e.k);
    for (const m of e.m) playNote(def.inst, { ctx: this.ctx!, out, t: at, dur: e.d, m, vel: e.v, opts: { ...def.opts, ...e.opts } });
  }

  // ───────────────────────── Sound effects (pure sound design, no instruments) ─────────────────────────

  private osc(type: OscillatorType, f: number, t: number, stop: number, detune = 0): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = f;
    if (detune) o.detune.value = detune;
    o.start(t);
    o.stop(stop);
    return o;
  }

  private env(g: GainNode, t: number, peak: number, attack: number, dur: number, release = 0.05): GainNode {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.setValueAtTime(Math.max(0.0002, peak), t + Math.max(attack, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack, dur) + release);
    return g;
  }

  private lp(cut: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx!.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cut;
    f.Q.value = q;
    return f;
  }

  private sub(f: number, t: number, dur: number, gain: number, attack = 0.01, f1?: number): void {
    const o = this.osc('sine', f, t, t + dur + 0.3);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.env(this.ctx!.createGain(), t, gain, attack, dur, 0.25);
    o.connect(g).connect(this.fx!);
  }

  private noise(t: number, dur: number, gain: number, type: BiquadFilterType, f0: number, f1: number | null, q: number, attack: number, release = 0.05): void {
    const src = this.ctx!.createBufferSource();
    src.buffer = noiseBuffer(this.ctx!);
    src.loop = true;
    const flt = this.ctx!.createBiquadFilter();
    flt.type = type;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t);
    if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.env(this.ctx!.createGain(), t, gain, attack, dur, release);
    src.connect(flt).connect(g).connect(this.fx!);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + release + 0.1);
  }

  private impact(t: number, gain: number): void {
    const o = this.ctx!.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(this.fx!);
    o.start(t);
    o.stop(t + 1);
    this.noise(t, 0.08, gain * 0.7, 'highpass', 2500, null, 1, 0.002);
    this.noise(t, 0.9, gain * 0.5, 'lowpass', 900, 80, 1, 0.01);
  }

  private heartbeat(t: number, gain: number): void {
    for (const [dt, g0] of [[0, 1], [0.19, 0.7]] as const) {
      const o = this.ctx!.createOscillator();
      o.frequency.setValueAtTime(62, t + dt);
      o.frequency.exponentialRampToValueAtTime(34, t + dt + 0.12);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(gain * g0, t + dt + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.22);
      o.connect(g).connect(this.fx!);
      o.start(t + dt);
      o.stop(t + dt + 0.3);
    }
  }

  /** Glass-like shards */
  private shatter(t: number, gain: number): void {
    for (let i = 0; i < 26; i++) {
      const f = 1800 + Math.random() * 5200;
      const at = t + Math.random() * 0.4;
      const dur = 0.5 + Math.random() * 0.6;
      for (const [r, gm, dm] of [[1, 1, 1], [2.76, 0.33, 0.45]] as const) {
        const o = this.osc('sine', f * r, at, at + dur * dm + 0.1);
        const g = this.ctx!.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(gain * 0.35 * gm, at + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur * dm);
        o.connect(g).connect(this.fx!);
      }
    }
    this.noise(t, 0.5, gain, 'highpass', 3500, null, 0.8, 0.002, 0.4);
  }

  /** The Heart's scream: a swept sawtooth + vibrato, through a band-pass */
  private shriek(t: number, dur: number, gain: number): void {
    const o = this.osc('sawtooth', 2300, t, t + dur + 0.2);
    o.frequency.exponentialRampToValueAtTime(760, t + dur);
    const lfo = this.osc('sine', 9, t, t + dur + 0.2);
    const lg = this.ctx!.createGain();
    lg.gain.value = 40;
    lfo.connect(lg).connect(o.detune);
    const flt = this.ctx!.createBiquadFilter();
    flt.type = 'bandpass';
    flt.Q.value = 2.5;
    flt.frequency.setValueAtTime(2200, t);
    flt.frequency.exponentialRampToValueAtTime(700, t + dur);
    const g = this.env(this.ctx!.createGain(), t, gain, 0.05, dur, 0.2);
    o.connect(flt).connect(g).connect(this.fx!);
  }

  private whoosh(t: number, dur: number, gain: number, pitch = 1): void {
    this.noise(t, dur, gain, 'bandpass', 500 * pitch, 2600 * pitch, 1.5, dur * 0.4, 0.1);
  }

  /** The dragon's low roar */
  private roar(t: number, gain: number): void {
    const flt = this.ctx!.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 700;
    const g = this.env(this.ctx!.createGain(), t, gain, 0.12, 1.1, 0.4);
    flt.connect(g).connect(this.fx!);
    for (const [f, d] of [[92, 0], [138, 7], [61, -5]] as const) {
      const o = this.osc('sawtooth', f, t, t + 1.7, d);
      o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 1.4);
      const lfo = this.osc('square', 27, t, t + 1.7);
      const lg = this.ctx!.createGain();
      lg.gain.value = 30;
      lfo.connect(lg).connect(o.detune);
      o.connect(flt);
    }
    this.noise(t, 1.2, gain * 0.7, 'bandpass', 320, 200, 1.2, 0.1, 0.3);
  }

  /** Electric-sounding flicker */
  private flicker(t: number, gain: number): void {
    for (let i = 0; i < 4; i++) this.noise(t + i * 0.028, 0.02, gain * (i === 0 ? 1 : 0.5), 'bandpass', 2400 + Math.random() * 2000, null, 4, 0.002);
    this.osc('square', 110, t, t + 0.06).connect(this.env(this.ctx!.createGain(), t, gain * 0.25, 0.003, 0.05)).connect(this.fx!);
  }

  /** Cuts in the overall volume (cut to black, the Void, under the gate) */
  private duck(at: number, points: [dt: number, v: number][]): void {
    const g = this.master!.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.value, at);
    for (const [dt, v] of points) g.linearRampToValueAtTime(v, at + dt);
  }

  // ───────────────────────── Score ─────────────────────────

  private compose(): void {
    const ev = this.events;
    const C = CUE;
    /** One note or chord: 'D3+F#3+A3' */
    const N = (k: string, t: number, notes: string, d: number, v = 0.8, opts?: Record<string, number>) => ev.push({ t, k, m: notes.split('+').map(midi), d, v, opts });
    /** A mini score, placed at t seconds according to bpm */
    const P = (k: string, t: number, part: Part | string, bpm: number, v = 1, tr = 0, opts?: Record<string, number>) => {
      const p = typeof part === 'string' ? mel(part) : part;
      const sd = 60 / bpm / 4;
      for (const e of p.ev) ev.push({ t: t + e.t * sd, k, m: e.m.map((m) => m + tr), d: e.d * sd, v: e.v * v, opts });
    };
    const F = (t: number, fn: (at: number) => void) => ev.push({ t, fn });
    /** Timpani roll, crescendo */
    const roll = (t: number, note: string, dur: number, v: number) => {
      const n = Math.floor(dur / 0.07);
      for (let i = 0; i < n; i++) N('timp', t + i * 0.07, note, 0.3, v * (0.35 + (0.65 * i) / n));
    };
    /** A harp arpeggio for one chord, filling exactly dur seconds */
    const harp = (t: number, dur: number, sym: string, center: number, v = 0.8) => P('harp', t, arp(prog(sym), '0 1 2 3 4 3 2 1', { rate: 2, center, size: 4 }), 240 / dur, v);

    // ── Night of the Shattered Heart
    N('drone', 0, 'D2+A2', C.shatter, 0.55, { attack: 3.5 });
    N('low', 0, 'D2', C.shatter, 0.5, { attack: 3 });
    N('glass', 0.5, 'A5+D6+F#6', 6, 0.3, { attack: 2.5 });
    for (const hb of C.heartbeats) {
      F(hb, (at) => this.heartbeat(at, 0.9));
      N('bell', hb, 'D3', 1.6, 0.3);
    }
    N('drone', C.reach - 0.9, 'Eb3', 8.2, 0.35, { attack: 2.5 });
    N('violin', C.reach - 0.5, 'E6', 2.3, 0.45, { attack: 1.7 });
    N('pad', C.reach - 0.5, 'B2+D3+F#3', 3.8, 0.45, { attack: 2 });
    N('chime', C.touch, 'A6', 1.4, 0.8);
    N('chime', C.touch + 0.03, 'Bb6', 1.2, 0.6);
    N('violin', C.touch, 'E6+F6', 2.0, 0.5, { attack: 1.6 });
    F(C.touch, (at) => this.sub(freq(38), at, 0.5, 0.2, 0.01, 30));
    // Scream: the brass roar dissonantly in unison while the bass crawls down by semitones
    F(C.scream, (at) => {
      this.shriek(at, 1.9, 0.22);
      this.impact(at, 0.6);
    });
    N('horns', C.scream, 'C#4+D4+G#4', 0.8, 1, { attack: 0.03 });
    N('trombone', C.scream, 'D3+G#3', 0.9, 1, { attack: 0.03 });
    N('thunder', C.scream, 'C2', 4.2, 0.8);
    P('low', C.scream + 0.3, 'D3:4 C#3:4 C3:4 B2:4 | Bb2:16', 120, 0.8);
    for (const d of [0.9, 1.35, 2.5, 3.0, 3.75]) F(C.scream + d, (at) => this.heartbeat(at, 0.7));
    // Shatter: eight descending bell strokes, a timpani roll, spiccato strings fleeing in sixteenth notes
    F(C.shatter, (at) => {
      this.impact(at, 1.0);
      this.shatter(at, 0.5);
      this.sub(freq(26), at, 1.2, 0.3, 0.01);
      this.whoosh(at, 0.6, 0.3, 1.4);
    });
    N('crash', C.shatter, 'C4', 2, 0.9);
    ['D6', 'C#6', 'B5', 'A5', 'G5', 'F#5', 'E5', 'D5'].forEach((n, i) => N('chime', C.shatter + 0.1 + i * C.shardGap * 2, n, 2.2, 0.85));
    roll(C.shatter + 0.1, 'D2', 1.0, 0.7);
    const sd = 60 / 140 / 4;
    const run = Math.floor((C.black - C.shatter - 0.4) / sd);
    for (let i = 0; i < run; i++) N('spicc', C.shatter + 0.4 + i * sd, i % 8 < 4 ? (i % 2 ? 'B3' : 'B2') : i % 2 ? 'D4' : 'D3', sd, (i % 4 === 0 ? 1 : 0.6) * (0.55 + (0.45 * i) / run));
    N('low', C.shatter + 0.4, 'B1', C.ground - C.shatter - 0.4, 0.6);
    F(C.ground, (at) => {
      this.whoosh(at, 0.4, 0.25, 0.8);
      this.roar(at + 0.15, 0.55);
    });
    N('timp', C.ground, 'B1', 1.2, 0.9);
    N('choir', C.ground, 'B3+D4+F#4', C.mark - C.ground, 0.6, { attack: 0.5 });
    N('low', C.ground, 'B1', C.mark - C.ground, 0.7);
    // The pact mark ignites: bells rise, a riser pushes up to the cut to black
    N('timp', C.mark, 'G2', 1.2, 1);
    N('choir', C.mark, 'G3+D4+G4+B4', C.black - C.mark, 0.75, { attack: 0.3 });
    N('low', C.mark, 'G1', C.black - C.mark, 0.8);
    ['D5', 'A5', 'D6'].forEach((n, i) => N('bell', C.mark + i * 0.07, n, 2.4, 0.8));
    N('glass', C.mark, 'D6+F#6+A6+D7', C.black - C.mark, 0.45, { attack: 1 });
    N('riser', C.mark, 'D4', C.black - C.mark, 0.9);
    F(C.mark, (at) => this.noise(at, 0.3, 0.12, 'highpass', 5000, null, 1, 0.005, 0.4));
    F(C.black, (at) => {
      this.impact(at, 1.0);
      this.duck(at, [[0.06, 0], [0.64, 0], [0.65, 1]]);
    });
    N('crash', C.black, 'C4', 2, 0.8);

    // ── Title
    N('bell', C.title, 'D3', 4, 1);
    N('bell', C.title, 'D4', 3, 0.6);
    N('low', C.title, 'D2', 2.8, 0.5, { attack: 0.3 });
    N('choirOo', C.title + 0.2, 'D4+F#4+A4+D5', 2.6, 0.85, { attack: 1.2 });

    // ── The lost world: over the harp, the flute sings the leitmotif's first phrase (D, Bm, G, A, one bar each, landing exactly on the "child and spirit" scene)
    const T0 = C.dawn + 0.5;
    const bpmLost = 240 / ((C.meet - T0) / 4);
    const lost = prog('D | Bm | G | A');
    N('pad', C.dawn, 'D3+F#3+A3', T0 - C.dawn + 0.1, 0.4, { attack: 0.5 });
    P('pad', T0, pad(lost, { center: 57, size: 3 }), bpmLost, 0.55);
    P('harp', T0, arp(lost, '0 1 2 3 4 3 2 1', { rate: 2, center: 62, size: 4 }), bpmLost, 0.8);
    P('low', T0, 'D2:16 | B1:16 | G1:16 | A1:16', bpmLost, 0.5);
    P('flute', T0, MOTIF, bpmLost);
    P('celesta', T0, 'R | R | B5:4 G6:6 F#6:2 E6:2 D6:2 | E6:12 r:4', bpmLost, 0.6);
    C.births.forEach((b, i) => {
      N('glock', b, ['A5', 'B5', 'C#6'][i], 1.2, 0.8);
      N('celesta', b + 0.08, ['D6', 'E6', 'F#6'][i], 1.4, 0.7);
      F(b, (at) => this.noise(at, 0.12, 0.12, 'bandpass', 3000, 5000, 2, 0.005));
    });
    // The child and the spirit: G, turning to A as foreheads touch, and when the pact mark appears it settles back to D
    N('pad', C.meet, 'G2+B2+D3+G3', C.forehead - C.meet + 0.2, 0.5, { attack: 0.8 });
    N('choirOo', C.meet, 'G3+B3+D4', C.forehead - C.meet + 0.4, 0.4, { attack: 1 });
    harp(C.meet, C.forehead - C.meet, 'G', 64, 0.6);
    N('low', C.meet, 'G1', C.forehead - C.meet, 0.5);
    N('bell', C.forehead, 'D5', 2.6, 0.8);
    N('chime', C.forehead, 'F#7', 0.4, 0.25);
    N('pad', C.forehead, 'A2+C#3+E3+A3', C.mark2 - C.forehead + 0.2, 0.5, { attack: 0.5 });
    harp(C.forehead, C.mark2 - C.forehead, 'A', 64, 0.6);
    N('low', C.forehead, 'A1', C.mark2 - C.forehead, 0.5);
    ['D5', 'A5', 'D6', 'A6'].forEach((n, i) => N('bell', C.mark2 + i * 0.08, n, 2.6, 0.7));
    P('glock', C.mark2 + 0.4, 'A5:4 F#6:12', 76, 0.8);
    N('glass', C.mark2, 'D6+F#6+A6+D7', 3, 0.45, { attack: 1 });
    N('pad', C.mark2 + 0.2, 'D3+A3+D4+F#4', 3.2, 0.6, { attack: 0.8 });
    N('choir', C.mark2 + 0.4, 'D4+F#4+A4+D5', 3.0, 0.5, { attack: 1.2 });
    N('low', C.mark2, 'D2', 3.0, 0.6);
    F(C.mark2, (at) => this.noise(at, 0.25, 0.08, 'highpass', 5000, null, 1, 0.005, 0.3));

    // ── Aftermath: horns and trumpets sing the motif big, leading into the D major of the ring panorama
    roll(C.fall, 'D2', 0.7, 0.8);
    F(C.fall, (at) => this.noise(at, 0.7, 0.1, 'lowpass', 200, 2500, 1, 0.6));
    const T1 = C.fall + 0.6;
    const bpmAfter = 240 / ((C.ringWide - T1) / 2);
    N('timp', T1, 'D2', 1.2, 1);
    N('crash', T1, 'C4', 2, 0.7);
    P('horns', T1, 'A4:4 F#5:6 E5:2 D5:2 E5:2 | F#5:4 A5:4 D6:8', bpmAfter, 1, -12);
    P('trumpets', T1, 'R | F#5:4 A5:4 D6:8', bpmAfter, 0.9);
    P('choir', T1, pad(prog('D | Bm:8 Asus4:8'), { center: 64, size: 3 }), bpmAfter, 0.6);
    P('pad', T1, pad(prog('D | Bm:8 Asus4:8'), { center: 52, size: 3 }), bpmAfter, 0.6);
    P('low', T1, 'D2:16 | B1:8 A1:8', bpmAfter, 0.7);
    ['D5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6', 'A6'].forEach((n, i) => {
      const t = C.catches + i * C.catchGap;
      N('timp', t, i % 2 ? 'A1' : 'D2', 0.8, 0.6);
      N('chime', t, n, 1.8, 0.8);
      F(t, (at) => this.noise(at, 0.2, 0.15, 'bandpass', 1800, 4000, 1.5, 0.005));
    });
    N('crash', C.ringWide, 'C4', 2, 0.8);
    N('timp', C.ringWide, 'D2', 1.2, 1);
    N('horns', C.ringWide, 'D4+F#4+A4', 1.1, 0.9, { attack: 0.08 });
    N('trumpets', C.ringWide, 'D5', 1.1, 0.9, { attack: 0.08 });
    N('choir', C.ringWide, 'D4+F#4+A4+D5+F#5', 1.15, 0.8, { attack: 0.3 });
    N('low', C.ringWide, 'D2', 1.2, 0.8);
    N('glass', C.ringWide, 'A5+D6+F#6', 1.2, 0.5, { attack: 0.3 });
    // The Void: the music is pulled out, leaving only a dissonant dark pad, long cello notes and a faint heartbeat
    F(C.blight - 0.1, (at) => this.duck(at, [[0.15, 0.12], [0.9, 1]]));
    N('drone', C.blight + 0.1, 'D2+Eb2+Ab2', 5.4, 0.55, { attack: 1.5 });
    N('void', C.blight, 'C4', 5.6, 0.8, { attack: 1.5, release: 0.6 });
    N('cello', C.blight + 0.6, 'Bb3', 4.2, 0.45, { attack: 1.2 });
    for (const d of [1.0, 2.4]) F(C.blight + d, (at) => this.heartbeat(at, 0.45));
    F(C.redEye - 0.6, (at) => this.noise(at, 0.6, 0.16, 'bandpass', 800, 3200, 2, 0.55, 0.02));
    F(C.redEye, (at) => {
      this.noise(at, 0.06, 0.35, 'highpass', 3000, null, 1, 0.002);
      const o = this.osc('sine', 2800, at, at + 0.5);
      o.frequency.exponentialRampToValueAtTime(1900, at + 0.4);
      o.connect(this.env(this.ctx!.createGain(), at, 0.05, 0.01, 0.3, 0.15)).connect(this.fx!);
      this.sub(freq(31), at, 0.4, 0.18, 0.01, 25);
      this.roar(at + 0.05, 0.3);
    });
    // The Astralgate goes dark: the timpani walks downward
    N('pad', C.gateOff - 0.8, 'B2+D3+F#3', 2.2, 0.45, { attack: 0.4 });
    for (const [dt, n] of [[0.2, 'A2'], [0.8, 'F2'], [1.6, 'D2']] as const) N('timp', C.gateOff - 0.8 + dt, n, 1, 0.6);
    for (let i = 0; i < 3; i++) F(C.gateOff - 0.7 + i * 0.25, (at) => this.flicker(at, 0.12));
    F(C.gateOff, (at) => {
      const o = this.osc('sawtooth', 220, at, at + 1.0);
      o.frequency.exponentialRampToValueAtTime(48, at + 0.85);
      o.connect(this.lp(700)).connect(this.env(this.ctx!.createGain(), at, 0.06, 0.02, 0.8, 0.1)).connect(this.fx!);
      this.noise(at, 0.5, 0.1, 'lowpass', 1200, 100, 1, 0.01, 0.2);
    });
    N('bell', C.sleep, 'D4', 3.2, 0.6);
    N('pad', C.sleep, 'G2+Bb2+D3', 2.4, 0.4, { attack: 0.8 });
    F(C.sleep + 1, (at) => this.noise(at, 1.6, 0.1, 'lowpass', 160, 60, 1, 0.5, 0.5));
    F(C.millennium - 0.4, (at) => this.duck(at, [[0.4, 0], [0.89, 0], [0.9, 1]]));

    // ── The present: low pizzicato, meteors, the Astralgate lights up again
    N('pluck', C.millennium + 0.6, 'D2', 3, 0.9);
    F(C.millennium + 0.6, (at) => this.sub(freq(26), at, 2.5, 0.08, 0.3));
    C.meteors.forEach((mt, i) => {
      F(mt - 0.35, (at) => this.whoosh(at, 0.35, 0.05, 2.2));
      N('celesta', mt, ['D6', 'A5', 'F#6', 'E6', 'B5', 'A6'][i % 6], 1.6, 0.55);
    });
    const T2 = C.millennium + 2.5;
    N('pad', T2, 'D3+A3+D4+F#4+A4', 6.5, 0.55, { attack: 2.2 });
    N('low', T2, 'D2', 6.5, 0.5, { attack: 1.5 });
    const barNow = 1.5;
    ['D', 'G', 'A', 'D'].forEach((sym, i) => harp(T2 + 0.5 + i * barNow, barNow, sym, 84, 0.55));
    C.flickers.forEach((f) => {
      F(f, (at) => this.flicker(at, 0.2));
      N('glock', f, 'D5', 0.5, 0.45);
    });
    const T3 = C.flickers[0] - 0.2;
    N('riser', T3, 'D4', C.gateOn - T3, 0.9);
    N('choir', T3 + 1.0, 'G3+B3+D4', 1.0, 0.45, { attack: 0.6 });
    N('choir', T3 + 2.0, 'A3+C#4+E4', 1.0, 0.65, { attack: 0.5 });
    roll(T3 + 1.5, 'D2', C.gateOn - T3 - 1.5, 0.8);
    // The Astralgate lights up: the trumpets play the motif's major sixth
    F(C.gateOn, (at) => {
      this.impact(at, 0.6);
      this.sub(freq(26), at, 1.6, 0.14, 0.02);
    });
    N('crash', C.gateOn, 'C4', 2.5, 0.9);
    N('timp', C.gateOn, 'D2', 1.2, 1);
    N('horns', C.gateOn, 'D4+F#4+A4', 1.4, 0.9, { attack: 0.06 });
    P('trumpets', C.gateOn + 0.1, 'A4:4 F#5:12', 76, 1);
    N('choir', C.gateOn, 'D4+F#4+A4+D5', C.under - C.gateOn + 4.5, 0.6, { attack: 0.2 });
    N('low', C.gateOn, 'D2', C.end - C.gateOn + 1, 0.6);
    ['D6', 'A6'].forEach((n, i) => N('bell', C.gateOn + i * 0.06, n, 3, 0.8));
    N('glass', C.gateOn, 'A5+D6+F#6+A6', 6, 0.4, { attack: 2.4 });
    F(C.under, (at) => {
      this.whoosh(at, 0.3, 0.2, 0.7);
      this.duck(at, [[0.25, 0.3]]);
      this.noise(at, 4.6, 0.05, 'lowpass', 110, null, 1, 0.8, 0.8);
    });
    // The dragon opens its eyes: the trumpets continue with E D E, coming to rest on D major bells and choir
    F(C.eye, (at) => {
      this.duck(at, [[1.0, 1]]);
      const o = this.osc('sine', 4200, at, at + 0.4);
      o.connect(this.env(this.ctx!.createGain(), at, 0.05, 0.005, 0.25, 0.1)).connect(this.fx!);
    });
    N('bell', C.eye, 'D5', 3.2, 0.9);
    N('bell', C.eye + 0.05, 'D6', 2.4, 0.6);
    N('timp', C.eye, 'D2', 1.2, 0.8);
    N('horns', C.eye + 0.25, 'D4+F#4+A4', 2.4, 0.8, { attack: 1.2 });
    P('trumpets', C.eye + 0.4, 'E5:3 D5:3 E5:10', 76, 0.95);
    N('crash', C.end, 'C4', 3, 0.8);
    N('bell', C.end, 'D7', 4, 0.8);
    N('bell', C.end + 0.04, 'D6', 3.5, 0.7);
    N('choir', C.end, 'D4+F#4+A4+D5', 2.2, 0.8, { attack: 0.25 });
    F(C.end, (at) => this.sub(freq(26), at, 1.6, 0.14, 0.02));

    ev.sort((a, b) => a.t - b.t);
  }

  // ───────────────────────── Control ─────────────────────────

  /** Start from animation time t0 (events before t0 are skipped) */
  start(t0 = 0): void {
    this.stop(0);
    const ctx = synth.ctx;
    if (!ctx) return;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(synth.music);
    this.mus = ctx.createGain();
    this.mus.gain.value = 1;
    this.mus.connect(this.master);
    const rev = ctx.createConvolver();
    rev.buffer = impulseBuffer(ctx, HALL);
    this.musRev = rev;
    rev.connect(this.master);
    this.fx = ctx.createGain();
    this.fx.gain.value = 0.8;
    this.fx.connect(synth.sfx);
    const rev2 = ctx.createConvolver();
    rev2.buffer = impulseBuffer(ctx, ROOM);
    const wet2 = ctx.createGain();
    wet2.gain.value = 0.22;
    this.fx.connect(rev2).connect(wet2).connect(synth.sfx);
    this.tracks.clear();
    this.events = [];
    this.compose();
    this.cursor = 0;
    while (this.cursor < this.events.length && this.events[this.cursor].t < t0 - 0.05) this.cursor++;
    // Compute the samples that will be needed first (yielding the main thread every few), since computing them on first contact would stall the picture
    const needs: [string, number][] = [];
    for (const e of this.events.slice(this.cursor)) {
      if (!('k' in e)) continue;
      const inst = TRACKS[e.k].inst;
      if (INSTRUMENTS[inst]?.kind === 'sample') for (const m of e.m) needs.push([inst, m]);
    }
    void prepare(ctx, needs);
    this.running = true;
  }

  /** Called every frame: schedule the events within the next 0.5 s onto the audio clock */
  tick(t: number): void {
    if (!this.running || !this.ctx) return;
    const base = this.ctx.currentTime - t;
    while (this.cursor < this.events.length && this.events[this.cursor].t <= t + 0.5) {
      const e = this.events[this.cursor++];
      const at = Math.max(this.ctx.currentTime + 0.005, base + e.t);
      try {
        if ('fn' in e) e.fn(at);
        else this.play(e, at);
      } catch (err) {
        console.error('prologue music', err);
      }
    }
  }

  stop(fade = 0.4): void {
    if (!this.running) return;
    this.running = false;
    const m = this.master;
    const f = this.fx;
    const ctx = this.ctx;
    if (m && f && ctx) {
      const t = ctx.currentTime;
      for (const g of [m, f]) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + fade);
      }
      setTimeout(() => {
        m.disconnect();
        f.disconnect();
      }, fade * 1000 + 100);
    }
    this.master = null;
    this.mus = null;
    this.musRev = null;
    this.fx = null;
    this.tracks.clear();
    this.events = [];
  }
}

export const prologueMusic = new PrologueMusic();
