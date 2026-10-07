// Music theory helpers: note names, modes, chord symbols, voicing and mode remapping. All pure functions, so Node can run them directly too (for the score-checking tool).

/** Note name to MIDI: C4 = 60. Supports #, b, ##, bb */
export function midi(name: string): number {
  const m = /^([A-Ga-g])(##|bb|#|b)?(-?\d)$/.exec(name.trim());
  if (!m) throw new Error(`Unrecognized note name: ${name}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase() as 'C'];
  const acc = m[2] === '#' ? 1 : m[2] === '##' ? 2 : m[2] === 'b' ? -1 : m[2] === 'bb' ? -2 : 0;
  return 12 * (Number(m[3]) + 1) + base + acc;
}

export const freq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const noteName = (m: number): string => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

/** Modes and scales (semitones relative to the tonic) */
export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  /** Phrygian dominant scale (Spanish / Middle Eastern flavour) */
  phrygianDom: [0, 1, 4, 5, 7, 8, 10],
  /** Hungarian minor (the Gypsy flavour of the augmented fourth) */
  hungarianMinor: [0, 2, 3, 6, 7, 8, 11],
  lydianDom: [0, 2, 4, 6, 7, 9, 10],
  /** Double harmonic (Byzantine) scale */
  doubleHarmonic: [0, 1, 4, 5, 7, 8, 11],
  majorPent: [0, 2, 4, 7, 9],
  minorPent: [0, 3, 5, 7, 10],
  /** Japanese miyako-bushi (the In scale), used only to give the Rift an alien feel */
  inSen: [0, 1, 5, 7, 10],
  wholeTone: [0, 2, 4, 6, 8, 10],
  /** Half-whole diminished scale */
  octatonic: [0, 1, 3, 4, 6, 7, 9, 10],
} as const satisfies Record<string, readonly number[]>;
export type Mode = keyof typeof MODES;

/** Chord qualities (semitones relative to the root; slash-chord bass not included) */
const QUALITIES: Record<string, number[]> = {
  '': [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  '+': [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  sus: [0, 5, 7],
  '5': [0, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  mmaj7: [0, 3, 7, 11],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  '7sus4': [0, 5, 7, 10],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  '9': [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  '7b9': [0, 4, 7, 10, 13],
  '7#9': [0, 4, 7, 10, 15],
  m11: [0, 3, 7, 10, 14, 17],
  '11': [0, 7, 10, 14, 17],
  maj7s11: [0, 4, 7, 11, 18],
  '6/9': [0, 4, 7, 9, 14],
  /** Stacked fourths (ethereal, floating) */
  q: [0, 5, 10],
  q4: [0, 5, 10, 15],
};

export interface ChordInfo {
  sym: string;
  /** Root pitch class 0-11 */
  root: number;
  /** Semitones relative to the root (sorted, may be > 12) */
  iv: number[];
  /** Bass pitch class (differs from the root for inversions) */
  bass: number;
  /** Third: minor third 3, major third 4, no third 0 (used when a bass line writes "3") */
  third: number;
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = (s: string): number => {
  const m = /^([A-G])(#|b)?$/.exec(s);
  if (!m) throw new Error(`Unrecognized root note: ${s}`);
  return (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
};

/** Parse a chord symbol: Am7, F#m7b5, Bb/D, Gsus4, C5, Ebmaj7s11, Dq4... */
export function chord(sym: string): ChordInfo {
  const m = /^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/.exec(sym.trim());
  if (!m) throw new Error(`Unrecognized chord: ${sym}`);
  const root = pcOf(m[1]);
  const q = m[2];
  const iv = QUALITIES[q];
  if (!iv) throw new Error(`Unrecognized chord quality "${q}" (${sym})`);
  const third = iv.includes(4) ? 4 : iv.includes(3) ? 3 : 0;
  return { sym, root, iv: [...iv], bass: m[3] ? pcOf(m[3]) : root, third };
}

/** Voice the chord around center (close position); if prev is given, pick the smoothest inversion */
export function voice(c: ChordInfo, center = 60, prev?: number[], size?: number): number[] {
  const pcs = c.iv.map((i) => (c.root + i) % 12);
  const uniq = [...new Set(pcs)];
  const n = size ?? Math.max(3, uniq.length);
  // List every inversion: starting from the first note above center-7, stack upward
  const cands: number[][] = [];
  for (let inv = 0; inv < uniq.length; inv++) {
    for (const lo of [center - 9, center - 3]) {
      const out: number[] = [];
      let p = lo;
      for (let k = 0; k < n; k++) {
        const pc = uniq[(inv + k) % uniq.length];
        while (((p % 12) + 12) % 12 !== pc) p++;
        out.push(p);
        p++;
      }
      cands.push(out);
    }
  }
  const score = (v: number[]): number => {
    const mid = (v[0] + v[v.length - 1]) / 2;
    let s = Math.abs(mid - center) * 0.6;
    if (prev && prev.length) {
      for (let i = 0; i < v.length; i++) s += Math.abs(v[i] - prev[Math.min(i, prev.length - 1)]);
    }
    return s;
  };
  cands.sort((a, b) => score(a) - score(b));
  return cands[0];
}

/** The note at degree deg of the mode (0-based, may be negative or exceed 7), with tonic as the tonic */
export function degree(tonic: number, mode: Mode, deg: number): number {
  const sc = MODES[mode];
  const n = sc.length;
  const oct = Math.floor(deg / n);
  const i = ((deg % n) + n) % n;
  return tonic + oct * 12 + sc[i];
}

/**
 * Mode remapping: map notes written on C's natural notes (white keys) to the same scale degree of tonic + mode.
 * Accidentals are kept as a "semitone offset", so a C major melody can be written and dropped into Phrygian or harmonic minor.
 * base is the original's tonic (by default the C in the octave of C = 60).
 */
export function remap(m: number, tonic: number, mode: Mode, base = 60): number {
  const WHITE = [0, 2, 4, 5, 7, 9, 11];
  const rel = m - base;
  const oct = Math.floor(rel / 12);
  const pc = ((rel % 12) + 12) % 12;
  let idx = WHITE.indexOf(pc);
  let off = 0;
  if (idx < 0) {
    idx = WHITE.indexOf(pc - 1);
    off = 1;
  }
  const sc: readonly number[] = MODES[mode];
  if (sc.length === 7) return tonic + oct * 12 + sc[idx] + off;
  // Pentatonic and other non-heptatonic scales: take the nearest scale note
  const target = MODES.ionian[idx];
  let best = sc[0];
  for (const s of sc) if (Math.abs(s - target) < Math.abs(best - target)) best = s;
  return tonic + oct * 12 + best + off;
}

/** Roman-numeral chords (build a triad in the given mode): 'i', 'IV', 'bVII', 'v7', 'ii°' */
export function roman(rn: string, tonicPc: number, mode: Mode): string {
  const m = /^(b|#)?(i{1,3}|iv|vi{0,2}|I{1,3}|IV|VI{0,2})(°|\+)?(.*)$/.exec(rn);
  if (!m) throw new Error(`Unrecognized scale degree: ${rn}`);
  const ROM = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];
  const deg = ROM.indexOf(m[2].toLowerCase());
  const sc: readonly number[] = MODES[mode];
  const pc = (tonicPc + sc[deg % sc.length] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0) + 12) % 12;
  const minor = m[2] === m[2].toLowerCase();
  const q = m[3] === '°' ? 'dim' : m[3] === '+' ? 'aug' : minor ? 'm' : '';
  return NAMES[pc] + q + (m[4] ?? '');
}
