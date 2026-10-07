// Music engine: compile a song (SongDef) into events and play it with look-ahead scheduling; each song carries its own mixing console (per-track volume / pan / reverb and delay send amounts) and its own spatial reverb.
// The same code can also be attached to an OfflineAudioContext for offline rendering (for the score-checking tool and loudness measurement).

import { impulse, type SpaceOpts } from './dsp.ts';
import { bowLayers, INSTRUMENTS, isGlider, playNote, prepare, prepareSync, type Need } from './instruments.ts';
import { mel, type Part } from './notation.ts';

export interface TrackDef {
  /** Track name (for the mixer and the score-check report) */
  name?: string;
  inst: string;
  /** Events: made with mel(), grid(), pad(), arp()...; a string is parsed as a melody using the song's meter */
  part: Part | string;
  /** Volume (linear, default 1) */
  gain?: number;
  /** Pan, -1 left to 1 right */
  pan?: number;
  /** Reverb send amount 0-1 (default 0.25) */
  rev?: number;
  /** Delay send amount 0-1 */
  dly?: number;
  /** Transpose (semitones) */
  tr?: number;
  /** Humanize: upper bound of timing jitter in seconds (default 0.008 for melody, 0.003 for drums) */
  hum?: number;
  /** Instrument parameter overrides (attack, release, vib, bright, cut...) */
  opts?: Record<string, number>;
  /** false: do not loop to fill (play once at the start of the section) */
  tile?: boolean;
}

export interface SongDef {
  /** Song title (shown in the listening room) */
  title: string;
  /** One sentence on the mood and instrumentation */
  mood: string;
  bpm: number;
  /** Sixteenth notes per bar (4/4 = 16, 3/4 = 12, 6/8 = 12, 7/8 = 14, 5/4 = 20) */
  meter?: number;
  /** Eighth-note swing 0-0.5 (0.33 ~ a triplet feel) */
  swing?: number;
  /** Sixteenth-note swing */
  swing16?: number;
  /** Spatial reverb; mix is the level the reverb returns at (default 1) */
  space: SpaceOpts & { mix?: number };
  /** Delay: steps is the delay length (in sixteenth notes) */
  delay?: { steps: number; fb?: number; tone?: number; mix?: number };
  /** Level correction for the whole song */
  gain?: number;
  /** Mastering EQ (filled in by MASTERING in catalog.ts from measurements): warm is the body added at 150 Hz (dB), cut is the amount pulled at 1.3 kHz (dB), trim is the level that restores loudness (dB) */
  master?: { warm?: number; cut?: number; trim?: number };
  /** Intro (plays once) */
  intro?: TrackDef[];
  /** Main body (loops) */
  tracks: TrackDef[];
  /** Plays once (short jingle, fanfare): stops when the main body ends */
  once?: boolean;
}

interface CEv {
  t: number;
  d: number;
  m: number[];
  v: number;
  tr: number;
  bends?: [number, number][];
  strum?: number;
}
interface CSec {
  len: number;
  ev: CEv[];
}

/** Compile one section into sorted events; shorter tracks loop to fill the whole section */
export function compileSection(tracks: TrackDef[], meter: number): CSec {
  const parts = tracks.map((tk) => (typeof tk.part === 'string' ? mel(tk.part, meter) : tk.part));
  const maxLen = Math.max(meter, ...parts.map((p) => p.len));
  const len = Math.ceil(maxLen / meter - 1e-6) * meter;
  const ev: CEv[] = [];
  tracks.forEach((tk, ti) => {
    const p = parts[ti];
    if (!p.len) return;
    const reps = tk.tile === false ? 1 : Math.max(1, Math.floor(len / p.len + 1e-6));
    const src = [...p.ev].sort((a, b) => a.t - b.t);
    const glide = isGlider(tk.inst);
    for (let r = 0; r < reps; r++) {
      const off = r * p.len;
      for (let i = 0; i < src.length; i++) {
        const e = src[i];
        if (e.t + off >= len) break;
        const c: CEv = { t: e.t + off, d: e.d, m: e.m, v: e.v, tr: ti, strum: e.strum };
        // Glide: merge the following notes in, turning them into pitch changes of the same voice
        if (glide && e.glide) {
          c.bends = [];
          let j = i;
          while (src[j]?.glide && src[j + 1]) {
            const nx = src[j + 1];
            c.bends.push([nx.t - e.t, nx.m[0]]);
            c.d = nx.t + nx.d - e.t;
            j++;
          }
          i = j;
        }
        ev.push(c);
      }
    }
  });
  ev.sort((a, b) => a.t - b.t);
  return { len, ev };
}

/** The samples a song will use (computed in advance) */
export function sampleNeeds(def: SongDef): Need[] {
  const out = new Map<string, Need>();
  const meter = def.meter ?? 16;
  for (const set of [def.intro ?? [], def.tracks]) {
    for (const tk of set) {
      const inst = INSTRUMENTS[tk.inst];
      if (!inst) throw new Error(`"${def.title}" uses an instrument that does not exist: ${tk.inst}`);
      if (inst.kind !== 'sample') continue;
      const p = typeof tk.part === 'string' ? mel(tk.part, meter) : tk.part;
      for (const e of p.ev) {
        const ms = e.m.length ? e.m : [0];
        for (const m of ms) {
          const mm = m + (tk.tr ?? 0);
          // For bowed strings, prepare only the velocity layers that will be used
          if (inst.bow) for (const v of bowLayers(inst, e.v, tk.opts?.bright)) out.set(`${tk.inst}|${mm}|${v}`, [tk.inst, mm, v]);
          else out.set(`${tk.inst}|${mm}`, [tk.inst, mm]);
        }
      }
    }
  }
  return [...out.values()];
}

interface TrackBus {
  input: GainNode;
  def: TrackDef;
}

/** A song that is playing */
export class SongPlayer {
  readonly out: GainNode;
  private sections: CSec[];
  private sec = 0;
  private idx = 0;
  private secStart: number;
  private readonly sd: number;
  private buses: TrackBus[][] = [];
  private stopped = false;
  /** A play-once song has finished scheduling */
  private done = false;
  private nodes: AudioNode[] = [];
  private ctx: BaseAudioContext;
  readonly def: SongDef;

  constructor(ctx: BaseAudioContext, dest: AudioNode, def: SongDef, startAt: number, fadeIn = 0) {
    this.ctx = ctx;
    this.def = def;
    const meter = def.meter ?? 16;
    this.sd = 60 / def.bpm / 4;
    this.sections = [];
    if (def.intro?.length) this.sections.push(compileSection(def.intro, meter));
    this.sections.push(compileSection(def.tracks, meter));
    this.secStart = startAt;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(fadeIn > 0 ? 0 : 1, ctx.currentTime);
    if (fadeIn > 0) {
      this.out.gain.setValueAtTime(0, startAt);
      this.out.gain.linearRampToValueAtTime(1, startAt + fadeIn);
    }
    this.out.connect(dest);
    // Master bus: dry, reverb, delay -> overall volume -> (mastering EQ)
    const master = ctx.createGain();
    const mq = def.master;
    master.gain.value = (def.gain ?? 1) * Math.pow(10, (mq?.trim ?? 0) / 20);
    if (mq && (mq.warm || mq.cut)) {
      // Cut the rumble below 30 Hz first, so adding body does not eat the dynamics
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 30;
      hp.Q.value = 0.6;
      const warm = ctx.createBiquadFilter();
      warm.type = 'peaking';
      warm.frequency.value = 150;
      warm.Q.value = 0.7;
      warm.gain.value = mq.warm ?? 0;
      const cut = ctx.createBiquadFilter();
      cut.type = 'peaking';
      cut.frequency.value = 1300;
      cut.Q.value = 0.9;
      cut.gain.value = -(mq.cut ?? 0);
      master.connect(hp).connect(warm).connect(cut).connect(this.out);
    } else master.connect(this.out);
    const rev = ctx.createConvolver();
    rev.normalize = false;
    rev.buffer = impulseBuffer(ctx, def.space);
    const revRet = ctx.createGain();
    revRet.gain.value = def.space.mix ?? 1;
    rev.connect(revRet).connect(master);
    let dly: AudioNode | null = null;
    if (def.delay) {
      const d = def.delay;
      const time = Math.min(1.9, d.steps * this.sd);
      const inG = ctx.createGain();
      const dl = ctx.createDelay(2);
      const dr = ctx.createDelay(2);
      dl.delayTime.value = time;
      dr.delayTime.value = time;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = d.tone ?? 2800;
      const fb = ctx.createGain();
      fb.gain.value = d.fb ?? 0.35;
      const ret = ctx.createGain();
      ret.gain.value = d.mix ?? 0.8;
      const pl = ctx.createStereoPanner();
      const pr = ctx.createStereoPanner();
      pl.pan.value = -0.7;
      pr.pan.value = 0.7;
      inG.connect(lp).connect(dl);
      dl.connect(pl).connect(ret);
      dl.connect(dr);
      dr.connect(pr).connect(ret);
      dr.connect(fb).connect(dl);
      ret.connect(master);
      // The delay's echoes also feed a little into the reverb
      const rs = ctx.createGain();
      rs.gain.value = 0.3;
      ret.connect(rs).connect(rev);
      dly = inG;
      this.nodes.push(inG, dl, dr, fb, ret);
    }
    for (const set of [def.intro ?? [], def.tracks]) {
      const row: TrackBus[] = [];
      for (const tk of set) {
        const input = ctx.createGain();
        input.gain.value = tk.gain ?? 1;
        const pan = ctx.createStereoPanner();
        pan.pan.value = tk.pan ?? 0;
        input.connect(pan).connect(master);
        const rs = ctx.createGain();
        rs.gain.value = tk.rev ?? 0.25;
        input.connect(rs).connect(rev);
        if (dly && tk.dly) {
          const ds = ctx.createGain();
          ds.gain.value = tk.dly;
          input.connect(ds).connect(dly);
        }
        row.push({ input, def: tk });
      }
      this.buses.push(row);
    }
    if (!def.intro?.length) this.sections.unshift({ len: 0, ev: [] });
    this.nodes.push(master, rev, revRet);
  }

  /** Seconds: one sixteenth note */
  get stepDur(): number {
    return this.sd;
  }

  /** Which bar is currently playing (for the listening room display) */
  position(now: number): { section: 'intro' | 'loop'; bar: number } {
    const meter = this.def.meter ?? 16;
    return { section: this.sec === 0 ? 'intro' : 'loop', bar: Math.max(0, Math.floor((now - this.secStart) / this.sd / meter)) + 1 };
  }

  private timeOf(step: number): number {
    const d = this.def;
    let s = step;
    const i = Math.floor(step + 1e-6);
    if (Math.abs(step - i) < 1e-6) {
      if (d.swing && i % 4 === 2) s += d.swing * 2;
      else if (d.swing16 && i % 2 === 1) s += d.swing16;
    }
    return this.secStart + s * this.sd;
  }

  /** Schedule notes up to horizon seconds */
  tick(horizon: number): void {
    if (this.stopped || this.done) return;
    for (let guard = 0; guard < 64; guard++) {
      const sec = this.sections[this.sec];
      while (this.idx < sec.ev.length) {
        const e = sec.ev[this.idx];
        const at = this.timeOf(e.t);
        if (at >= horizon) return;
        this.fire(e, at);
        this.idx++;
      }
      const end = this.secStart + sec.len * this.sd;
      if (end >= horizon) return;
      if (this.def.once && this.sec === this.sections.length - 1) {
        this.finish(end);
        return;
      }
      // Next section: after the intro go to the main body; the main body loops
      this.secStart = end;
      this.sec = Math.min(this.sections.length - 1, this.sec + 1);
      this.idx = 0;
    }
  }

  private fire(e: CEv, at: number): void {
    const bus = this.buses[this.sec][e.tr];
    const tk = bus.def;
    const inst = INSTRUMENTS[tk.inst];
    const drum = inst.kind === 'sample' && (inst.variants ?? 0) > 0;
    const hum = tk.hum ?? (drum ? 0.003 : 0.008);
    const t = Math.max(this.ctx.currentTime + 0.005, at + (Math.random() - 0.5) * hum);
    const vel = Math.min(1, e.v * (1 + (Math.random() - 0.5) * 0.1));
    const dur = e.d * this.sd;
    const ms = e.m.length ? e.m : [0];
    ms.forEach((m, k) => {
      playNote(tk.inst, {
        ctx: this.ctx,
        out: bus.input,
        t: t + (e.strum ? k * e.strum : 0),
        dur,
        m: m ? m + (tk.tr ?? 0) : 0,
        vel,
        bends: e.bends?.map(([s, bm]) => [s * this.sd, bm + (tk.tr ?? 0)] as [number, number]),
        opts: tk.opts,
      });
    });
  }

  /** A play-once song has finished playing: release after the reverb tail ends */
  private finish(end: number): void {
    this.done = true;
    const tail = Math.max(0, end - this.ctx.currentTime) + (this.def.space.size ?? 1) + 1.5;
    setTimeout(() => this.out.disconnect(), tail * 1000);
  }

  /** Fade out and release */
  stop(fade = 0.8): void {
    if (this.stopped) return;
    this.stopped = true;
    const now = this.ctx.currentTime;
    const g = this.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + fade);
    setTimeout(() => this.out.disconnect(), (fade + 0.3) * 1000);
  }
}

const irCache = new Map<string, AudioBuffer>();
/** Impulse response of the reverb (the same space settings are computed only once) */
export function impulseBuffer(ctx: BaseAudioContext, space: SpaceOpts): AudioBuffer {
  const key = `${ctx.sampleRate}|${space.size}|${space.damp}|${space.pre}|${space.er}|${space.bloom}`;
  let b = irCache.get(key);
  if (!b) {
    const [l, r] = impulse(ctx.sampleRate, space);
    b = ctx.createBuffer(2, l.length, ctx.sampleRate);
    b.getChannelData(0).set(l);
    b.getChannelData(1).set(r);
    irCache.set(key, b);
  }
  return b;
}

/** A short jingle that plays once: prepare the samples synchronously and schedule everything at once */
export function playOnce(ctx: BaseAudioContext, dest: AudioNode, def: SongDef): SongPlayer {
  prepareSongSync(ctx, def);
  const p = new SongPlayer(ctx, dest, { ...def, once: true }, ctx.currentTime + 0.03);
  p.tick(ctx.currentTime + 60);
  return p;
}

/** Compute samples in advance (done in batches on the main thread) */
export function prepareSong(ctx: BaseAudioContext, def: SongDef): Promise<void> {
  return prepare(ctx, sampleNeeds(def));
}

/** Synchronous version (for offline rendering) */
export function prepareSongSync(ctx: BaseAudioContext, def: SongDef): void {
  prepareSync(ctx, sampleNeeds(def));
}

/** Offline rendering: returns the left and right channels */
export async function renderOffline(OAC: new (ch: number, len: number, sr: number) => OfflineAudioContext, def: SongDef, seconds: number, sr = 44100, solo?: number[]): Promise<[Float32Array, Float32Array]> {
  const ctx = new OAC(2, Math.floor(seconds * sr), sr);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  // The music bus volume in the game (sfx.ts: master 0.8 x music 0.45)
  const bus = ctx.createGain();
  bus.gain.value = 0.36;
  bus.connect(comp).connect(ctx.destination);
  const d = solo ? { ...def, tracks: def.tracks.map((t, i) => (solo.includes(i) ? t : { ...t, gain: 0 })), intro: def.intro?.map((t) => ({ ...t, gain: 0 })) } : def;
  prepareSongSync(ctx, d);
  const p = new SongPlayer(ctx, bus, d, 0.05);
  p.tick(seconds);
  const buf = await ctx.startRendering();
  return [buf.getChannelData(0), buf.getChannelData(1)];
}
