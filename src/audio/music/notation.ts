// Notation: turn "mini score" strings and chord progressions into events. The time unit is always the sixteenth note (step).
//
// Melody string:
//   E5:4 D5:2 C5:2 | B4:8 r:8 |      note name:length (in sixteenth notes), r is a rest, | is a bar line (each bar's length is checked)
//   E5:4 D5 C5 B4                     omit the length to reuse the previous one
//   C4+E4+G4:16                       a chord (sounding together)
//   !E5:4  ?E5:2                      ! accent, ? soft (ghost note)
//   E5:4> G5:4                        > glide into the next note (only effective on instruments that support glide)
//   E5:4/3                            fractional length (tuplet: a triplet eighth note = 4/3)
//   (E5:2 D5:2)*4   R*2               parenthesized groups repeat; R is a full bar of rest
//   .                                 same as r (reuses the length)
//
// Drum string: one character per step. X accent, x normal, o soft, . or - rest; spaces and | are ignored. res can stretch one character into several steps.

import { chord, voice, type ChordInfo } from './theory.ts';
import { midi } from './theory.ts';

export interface Ev {
  /** Start (step) */
  t: number;
  /** Length (step) */
  d: number;
  /** Pitch (MIDI); drums may be an empty array or a note used for tuning */
  m: number[];
  /** Velocity 0-1 */
  v: number;
  /** Glide into the next note */
  glide?: boolean;
  /** Chord strum: the delay in seconds applied to each note in turn */
  strum?: number;
}

export interface Part {
  ev: Ev[];
  /** Total length (step) */
  len: number;
}

const VEL = { normal: 0.78, accent: 1, ghost: 0.42 };

/** Parse a melody string */
export function mel(src: string, meter = 16): Part {
  const ev: Ev[] = [];
  let t = 0;
  let dur = 4;
  let barStart = 0;
  let barNo = 1;
  let lastR = false;
  // Expand repeats: (...)*n and token*n
  const expanded = expandRepeats(src);
  for (const raw of expanded.split(/\s+/)) {
    if (!raw) continue;
    if (raw === '|') {
      // R is a complete bar by itself, so a bar line right after it needs no further check (the "R*3 |" style)
      if (lastR && Math.abs(t - barStart) < 1e-6) {
        lastR = false;
        continue;
      }
      if (Math.abs(t - barStart - meter) > 1e-6) throw new Error(`Bar ${barNo} is ${+(t - barStart).toFixed(3)} long, expected ${meter}: ...${src.slice(0, 60)}`);
      barStart = t;
      barNo++;
      continue;
    }
    if (raw === 'R') {
      const atBar = Math.abs(t - barStart) < 1e-6;
      t += meter;
      if (atBar) {
        barStart = t;
        barNo++;
      }
      lastR = atBar;
      continue;
    }
    lastR = false;
    let tok = raw;
    let v = VEL.normal;
    if (tok[0] === '!') {
      v = VEL.accent;
      tok = tok.slice(1);
    } else if (tok[0] === '?') {
      v = VEL.ghost;
      tok = tok.slice(1);
    }
    let glide = false;
    if (tok.endsWith('>')) {
      glide = true;
      tok = tok.slice(0, -1);
    }
    const [pitch, len] = tok.split(':');
    if (len) {
      const [a, b] = len.split('/');
      dur = b ? Number(a) / Number(b) : Number(a);
      if (!(dur > 0)) throw new Error(`Invalid duration: ${raw}`);
    }
    if (pitch !== 'r' && pitch !== '.') {
      const m = pitch.split('+').map(midi);
      ev.push({ t, d: dur, m, v, glide: glide || undefined });
    }
    t += dur;
  }
  return { ev, len: t };
}

function expandRepeats(src: string): string {
  let s = src.replace(/\|/g, ' | ');
  // Expand parentheses from the inside out
  for (let guard = 0; guard < 50 && s.includes('('); guard++) {
    s = s.replace(/\(([^()]*)\)\*(\d+)/g, (_, body: string, n: string) => Array(Number(n)).fill(body).join(' '));
    s = s.replace(/\(([^()]*)\)(?!\*)/g, (_, body: string) => body);
  }
  // Repeat a single token: R*4, E5:2*3
  s = s.replace(/(\S+)\*(\d+)/g, (_, tok: string, n: string) => Array(Number(n)).fill(tok).join(' '));
  return s;
}

/** Drum notation: x normal, X accent, o soft, . - rest. pitch is for tuned drums */
export function grid(src: string, res = 1, pitch?: number): Part {
  const ev: Ev[] = [];
  let t = 0;
  for (const ch of src) {
    if (ch === ' ' || ch === '|' || ch === '\n') continue;
    const v = ch === 'X' ? VEL.accent : ch === 'x' ? VEL.normal : ch === 'o' ? VEL.ghost : 0;
    if (v) ev.push({ t, d: res, m: pitch === undefined ? [] : [pitch], v });
    t += res;
  }
  return { ev, len: t };
}

// ───────────────────────── Chord progressions ─────────────────────────

export interface Chd extends ChordInfo {
  t: number;
  d: number;
}

/**
 * Chord progression: 'Am | F | C G | E7'. Bars are separated by |, and chords within one bar split it equally;
 * lengths can also be written: 'C:12 G:4'. '%' means the previous chord carries on for one bar.
 */
export function prog(src: string, meter = 16): Chd[] {
  const out: Chd[] = [];
  let t = 0;
  for (const bar of src.split('|')) {
    const toks = bar.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    const explicit = toks.some((x) => x.includes(':'));
    const each = meter / toks.length;
    for (const tok of toks) {
      const [sym, len] = tok.split(':');
      const d = explicit ? Number(len ?? 0) || each : each;
      if (sym === '%') {
        if (out.length) out[out.length - 1].d += d;
      } else out.push({ ...chord(sym), t, d });
      t += d;
    }
  }
  return out;
}

export const progLen = (p: Chd[]): number => (p.length ? p[p.length - 1].t + p[p.length - 1].d : 0);

/** Sustained chords (chord pad, strings, choir, organ) */
export function pad(p: Chd[], opts: { center?: number; size?: number; v?: number; gap?: number } = {}): Part {
  const center = opts.center ?? 60;
  let prev: number[] | undefined;
  const ev = p.map((c) => {
    const m = voice(c, center, prev, opts.size);
    prev = m;
    return { t: c.t, d: c.d - (opts.gap ?? 0), m, v: opts.v ?? VEL.normal };
  });
  return { ev, len: progLen(p) };
}

/**
 * Arpeggio: pattern uses digits to pick chord tones (0 is the lowest; beyond the number of chord tones it goes up an octave); '.' is a rest, '-' extends the previous note.
 * rate is the number of steps per character. The pattern restarts at the start of each chord.
 */
export function arp(p: Chd[], pattern: string, opts: { rate?: number; center?: number; size?: number; v?: number; accent?: number } = {}): Part {
  const rate = opts.rate ?? 2;
  const pat = pattern.replace(/\s+/g, '');
  const ev: Ev[] = [];
  let prev: number[] | undefined;
  for (const c of p) {
    const vc = voice(c, opts.center ?? 64, prev, opts.size);
    prev = vc;
    let k = 0;
    for (let s = 0; s < c.d - 1e-6; s += rate, k++) {
      const ch = pat[k % pat.length];
      if (ch === '.') continue;
      if (ch === '-') {
        if (ev.length) ev[ev.length - 1].d += rate;
        continue;
      }
      const idx = parseInt(ch, 36);
      const n = vc.length;
      const m = vc[idx % n] + 12 * Math.floor(idx / n);
      const acc = opts.accent && k % opts.accent === 0 ? 1.15 : 1;
      ev.push({ t: c.t + s, d: Math.min(rate, c.d - s), m: [m], v: Math.min(1, (opts.v ?? VEL.normal) * acc) });
    }
  }
  return { ev, len: progLen(p) };
}

/** What to stack above the bass: prefer a perfect fifth; if there is none (diminished chord, inversion, passing bass), look in turn for a sixth, a fourth, a third */
const ABOVE = [7, 8, 9, 5, 4, 3, 6];

/**
 * Sustained bass-string notes: one note per chord (the chord's bass, placed in the octave counted from base), held for the whole chord;
 * the same bass note continues without re-bowing. With fifth, one more chord tone is stacked on top (usually an open fifth).
 */
export function holdRoots(p: Chd[], base: number, fifth = false, v = 0.8): Part {
  const ev: Ev[] = [];
  for (const c of p) {
    // Passing bass (a slash bass that is not a chord tone): just follows the bass, with no fifth stacked (stacking it would clash with the chord)
    const pcs = new Set(c.iv.map((i) => (c.root + i) % 12));
    const bass = c.bass;
    let low = base + ((bass - (base % 12) + 12) % 12);
    if (low > base + 7) low -= 12;
    const m = [low];
    if (fifth && pcs.has(bass)) {
      const up = ABOVE.find((k) => pcs.has((bass + k) % 12));
      if (up !== undefined) m.push(low + up);
    }
    const last = ev[ev.length - 1];
    if (last && last.m.join() === m.join() && last.t + last.d === c.t) last.d += c.d;
    else ev.push({ t: c.t, d: c.d, m, v });
  }
  return { ev, len: progLen(p) };
}

/**
 * Bass: rhythm is a drum-notation-style string (loops every bar; '-' extends), line is the scale degrees used in turn:
 * 1 root, 3 chord third, 5 fifth, 8 octave, b7 / 7 / 2 / 4 / 6, b2 (Phrygian); separated by spaces and used cyclically.
 * 1 is the chord's bass (inversions); oct is the octave the root sits in (counted from C2 by default).
 */
export function bassline(p: Chd[], rhythm: string, line = '1', opts: { base?: number; v?: number; meter?: number } = {}): Part {
  const rh = rhythm.replace(/[\s|]/g, '');
  const steps = line.trim().split(/\s+/);
  const base = opts.base ?? 36;
  const ev: Ev[] = [];
  let li = 0;
  for (const c of p) {
    // 1 is the chord's bass (the note after the slash for an inversion), placed in the octave counted from base
    let low = base + ((c.bass - (base % 12) + 12) % 12);
    if (low > base + 7) low -= 12;
    // Other degrees are computed relative to the root, placed at the nearest position above the bass
    const rootAbove = low + ((c.root - c.bass + 12) % 12);
    for (let s = 0; s < c.d; s++) {
      const ch = rh[(c.t + s) % rh.length];
      if (ch === '-') {
        if (ev.length) ev[ev.length - 1].d += 1;
        continue;
      }
      if (ch !== 'x' && ch !== 'X' && ch !== 'o') continue;
      const deg = steps[li++ % steps.length];
      let m: number;
      if (deg === '1') m = low;
      else if (deg === '8') m = low + 12;
      else if (deg === '-8') m = low - 12;
      else {
        m = rootAbove + degOffset(deg, c);
        if (!deg.startsWith('-')) while (m < low) m += 12;
      }
      ev.push({ t: c.t + s, d: 1, m: [m], v: ch === 'X' ? 1 : ch === 'o' ? 0.5 : opts.v ?? VEL.normal });
    }
  }
  return { ev, len: progLen(p) };
}

function degOffset(deg: string, c: ChordInfo): number {
  const map: Record<string, number> = { '1': 0, b2: 1, '2': 2, b3: 3, '3': c.third || 4, '4': 5, b5: 6, '5': c.iv.includes(6) && !c.iv.includes(7) ? 6 : c.iv.includes(8) ? 8 : 7, b6: 8, '6': 9, b7: 10, '7': 11, '8': 12, '10': 12 + (c.third || 4), '-5': -5, '-4': -7, '-b7': -2, '-7': -1, '-8': -12 };
  const v = map[deg];
  if (v === undefined) throw new Error(`Unrecognized bass scale degree: ${deg}`);
  return v;
}

/** Strum: rhythm loops every bar, x downstroke, X heavy, o soft, '-' extends */
export function strum(p: Chd[], rhythm: string, opts: { center?: number; size?: number; spread?: number; v?: number } = {}): Part {
  const rh = rhythm.replace(/[\s|]/g, '');
  const ev: Ev[] = [];
  let prev: number[] | undefined;
  for (const c of p) {
    const vc = voice(c, opts.center ?? 58, prev, opts.size ?? 5);
    prev = vc;
    for (let s = 0; s < c.d; s++) {
      const ch = rh[(c.t + s) % rh.length];
      if (ch === '-') {
        if (ev.length) ev[ev.length - 1].d += 1;
        continue;
      }
      if (ch !== 'x' && ch !== 'X' && ch !== 'o') continue;
      ev.push({ t: c.t + s, d: 1, m: vc, v: ch === 'X' ? 1 : ch === 'o' ? 0.5 : opts.v ?? VEL.normal, strum: opts.spread ?? 0.014 });
    }
  }
  return { ev, len: progLen(p) };
}

// ───────────────────────── Combining ─────────────────────────

/** Concatenate: join one after another */
export function seq(...parts: (Part | string)[]): Part {
  const ev: Ev[] = [];
  let t = 0;
  for (const p of parts) {
    const q = typeof p === 'string' ? mel(p) : p;
    for (const e of q.ev) ev.push({ ...e, t: e.t + t });
    t += q.len;
  }
  return { ev, len: t };
}

/** Stack: sound together, the length is the longest */
export function stack(...parts: Part[]): Part {
  return { ev: parts.flatMap((p) => p.ev).sort((a, b) => a.t - b.t), len: Math.max(0, ...parts.map((p) => p.len)) };
}

/** Repeat n times */
export function loop(p: Part, n: number): Part {
  return seq(...Array(n).fill(p));
}

/** Rest for n bars */
export const rest = (bars: number, meter = 16): Part => ({ ev: [], len: bars * meter });

/** Transpose (semitones) */
export function tr(p: Part, semis: number): Part {
  return { ev: p.ev.map((e) => ({ ...e, m: e.m.map((x) => x + semis) })), len: p.len };
}

/** Rewrite pitches note by note (mode remapping and so on) */
export function mapPitch(p: Part, f: (m: number) => number): Part {
  return { ev: p.ev.map((e) => ({ ...e, m: e.m.map(f) })), len: p.len };
}

/** Velocity multiplier */
export function vel(p: Part, k: number): Part {
  return { ev: p.ev.map((e) => ({ ...e, v: Math.min(1, e.v * k) })), len: p.len };
}

/** Take only a section (step range) */
export function slice(p: Part, from: number, to: number): Part {
  return { ev: p.ev.filter((e) => e.t >= from && e.t < to).map((e) => ({ ...e, t: e.t - from, d: Math.min(e.d, to - e.t) })), len: to - from };
}
