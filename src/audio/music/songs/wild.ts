// Wild encounters (wild:<region>): one battle song, with each region swapping in its own mode, tonic, tempo, instruments, groove and space.
//
// The shared core is written on the C white keys, then moved to each region's mode with remap():
//   A section theme: two repeated notes (dotted eighth) followed by a sixth leaping up, then stepwise all the way back down (a 3+3+2 syncopation). The sixth leap echoes the main theme's major sixth.
//     The first four bars sequence downward by thirds along I, vi, IV, with the fourth bar running up to the dominant; in the last four bars, bar two turns the motif around (a sixth leaping down, then climbing back).
//   B section: a singing phrase of long notes, starting from vi, with bar three quoting the leitmotif directly (5 -> 3 -> 2 -> 1 -> 2); regions in minor naturally get the minor-sixth version.
//     The B section has a counterpoint mostly in quarter notes (the lead of the previous section switches over to play it).
//   C section: the first four bars are the breakthrough, with only the drums, a low-register octave riff and a question-and-answer between the two leads (original form against inversion);
//     in the last four bars the chords go up one step every half bar, the motif shrinks to a third, and climbs all the way to the highest point.
//   T: a two-bar transition, the whole band in unison on 3+3+2 accents, and a final run of sixteenth notes sliding from high back to the theme's first note. T is also played once as the intro.
// Harmony is written as scale degrees (0 = tonic), stacked in thirds on that region's scale to make chords; when stacking gives a diminished triad, a seventh chord a third lower is used instead (vii° -> V7, Dorian vi° -> IV7,
// Lydian #iv° -> II7). So the same harmony yields the IV major triad in Dorian, the II major triad in Lydian and V7 in harmonic minor,
// and each mode's signature note comes out by itself.
// Loop: A (8) A' (8) B (8) C (8) T (2) = 34 bars, about 51 to 57 seconds depending on tempo.
// The differences between regions are all written in PALETTE: the instruments and octaves of the lead and of the one that takes over, the ostinato, the chord pad, the bass, the accent chords, the rhythm of each drum track, reverb and delay.
// The Rift (wild:rift) does not use this generator and is handled by its own file; any region not found here uses the Astralgate Plaza version.

import { arp, bassline, grid, holdRoots, mapPitch, mel, midi, pad, remap, rest, seq, slice, strum, vel, MODES, type Chd, type Mode, type Part, type SongDef, type TrackDef } from './_kit.ts';

// ───────────────────────── Shared core (C white keys) ─────────────────────────

/** A section theme (harmony 0 | 5 | 3 | 4 | 0 | 5 | 3 4 | 0) */
const A_MEL = mel(
  '!E5:3 E5:3 !C6:2 B5:2 A5:2 G5:4 | !C5:3 C5:3 !A5:2 G5:2 F5:2 E5:4 | !A4:3 A4:3 !F5:2 E5:2 D5:2 C5:4 | !B4:2 C5:1 D5:1 E5:2 F5:2 !G5:6 r:2 |' +
    '!E5:3 E5:3 !C6:2 B5:2 A5:2 G5:4 | !C6:3 C6:3 !E5:2 F5:2 G5:2 A5:4 | !F5:2 A5:2 C6:2 A5:2 !B5:2 A5:2 G5:2 F5:2 | !E5:2 D5:2 C5:8 r:4 |',
);
/** A' section long-note line for the second voice (all chord tones) */
const A_CTR = mel('G4:8 E4:8 | E4:8 A4:8 | A4:8 C5:8 | B4:8 D5:8 | C5:8 G4:8 | A4:8 E5:8 | C5:8 D5:8 | E5:12 r:4 |');
/** B section (harmony 5 | 6 | 0 | 2 | 5 | 6 | 1 | 4): bar three is the leitmotif */
const B_MEL = mel(
  'C5:4 E5:4 !A5:8 | !F5:6 E5:2 D5:4 B4:4 | G4:4 !E5:6 D5:2 C5:2 D5:2 | !E5:12 r:4 |' +
    'C5:4 E5:4 !A5:6 B5:2 | !D6:6 C6:2 B5:4 F5:4 | !A5:6 G5:2 F5:4 D5:4 | !B5:6 A5:2 G5:8 |',
);
/** B section counterpoint: it moves while the melody holds long notes */
const B_CTR = mel('A4:6 G4:2 E4:4 C4:4 | D4:6 E4:2 F4:4 D4:4 | C4:4 E4:4 G4:6 F4:2 | E4:4 G4:4 B4:8 | A4:6 G4:2 E4:4 C4:4 | B3:4 D4:4 F4:6 E4:2 | D4:4 F4:4 A4:6 G4:2 | G4:4 B4:4 D5:8 |');
/** C section first half: lead A shouts the head of the motif */
const C_CALL = mel('!E5:3 E5:3 !C6:2 r:8 | R | !A4:3 A4:3 !F5:2 r:8 | R |');
/** C section first half: lead B answers with the inversion */
const C_RESP = mel('r:8 !C6:3 C6:3 !E5:2 | R | r:8 !F5:3 F5:3 !A4:2 | R |');
/** C section second half: the chords go up one step every half bar, and the motif shrinks to a third */
const C_BUILD = mel('!C5:3 C5:3 E5:2 !D5:3 D5:3 F5:2 | !E5:3 E5:3 G5:2 !F5:3 F5:3 A5:2 | !G5:3 G5:3 B5:2 !A5:3 A5:3 C6:2 | !B5:3 B5:3 !D6:2 C6:2 B5:2 A5:2 G5:2 |');
/** Transition (also the intro): a 3+3+2 unison on the dominant chord, followed by a descending run of sixteenth notes back to A */
const T_MEL = mel('!G4:3 G4:3 !B4:2 !D5:3 D5:3 !G5:2 | !G5:2 r:2 !G5:2 r:2 D6:1 C6:1 B5:1 A5:1 G5:1 F5:1 E5:1 D5:1 |');
/** Bass riff (first half of the C section, written on the tonic, shifted by chord degree) */
const C_RIFF = mel('!C4:2 C4:1 C4:1 !C5:2 C4:2 B4:2 C4:2 !G4:2 A4:2 |');

type Sec = 'A' | 'A2' | 'B' | 'C' | 'T';
const LOOP: Sec[] = ['A', 'A2', 'B', 'C', 'T'];
const BARS: Record<Sec, number> = { A: 8, A2: 8, B: 8, C: 8, T: 2 };
const HARM: Record<Sec, string> = {
  A: '0 | 5 | 3 | 4 | 0 | 5 | 3 4 | 0',
  A2: '0 | 5 | 3 | 4 | 0 | 5 | 3 4 | 0',
  B: '5 | 6 | 0 | 2 | 5 | 6 | 1 | 4',
  C: '0 | 0 | 3 | 4 | 0 1 | 2 3 | 4 5 | 6',
  T: '4 | 4',
};

// ───────────────────────── Small tools ─────────────────────────

const WHITE = [0, 2, 4, 5, 7, 9, 11];

/** Shift by k degrees on the white keys (for parallel thirds, sixths and riff shifting; done before the mode change, so it is always a note of that mode) */
function diaNote(m: number, k: number): number {
  const rel = m - 60;
  const oct = Math.floor(rel / 12);
  const pc = rel - oct * 12;
  let i = WHITE.indexOf(pc);
  let off = 0;
  if (i < 0) {
    i = WHITE.indexOf(pc - 1);
    off = 1;
  }
  const j = i + k;
  const o2 = Math.floor(j / 7);
  return 60 + (oct + o2) * 12 + WHITE[j - o2 * 7] + off;
}
const dia = (p: Part, k: number): Part => mapPitch(p, (m) => diaNote(m, k));

/** Tremolo: a long note split into continuous short notes (how the lute and the yangqin sing long notes) */
function tremolo(p: Part, rate: number, min = 4): Part {
  const ev: Part['ev'] = [];
  for (const e of p.ev) {
    if (e.d < min) {
      ev.push(e);
      continue;
    }
    for (let s = 0; s < e.d - 1e-6; s += rate) ev.push({ ...e, t: e.t + s, d: Math.min(rate, e.d - s), v: s === 0 ? e.v : e.v * (s % (rate * 2) ? 0.62 : 0.74) });
  }
  return { ev, len: p.len };
}

/** Glide: slide into a long note only by small intervals (the morin khuur's technique) */
function slides(p: Part): Part {
  const ev = p.ev.map((e) => ({ ...e })).sort((a, b) => a.t - b.t);
  for (let i = 0; i + 1 < ev.length; i++) {
    const a = ev[i];
    const b = ev[i + 1];
    const iv = Math.abs(b.m[0] - a.m[0]);
    const joined = Math.abs(a.t + a.d - b.t) < 1e-6 && a.m.length === 1 && iv > 0;
    if (joined && b.d >= 6 && iv <= 5) a.glide = true;
  }
  return { ev, len: p.len };
}

// ───────────────────────── Palette types ─────────────────────────

/** Voice roles: mel melody, resp the answer in the C section, ctr counterpoint, third/sixth parallel thirds/sixths below, up3 parallel thirds above */
type Role = 'mel' | 'resp' | 'ctr' | 'third' | 'sixth' | 'up3';
type Pats = Partial<Record<Sec, string>>;

interface Voice {
  name: string;
  inst: string;
  gain?: number;
  pan?: number;
  rev?: number;
  dly?: number;
  opts?: Record<string, number>;
  /** Tremolo interval (steps) */
  trem?: number;
  /** Glide into long notes */
  slide?: boolean;
  /** [role, transposition in semitones, velocity multiplier] for each section */
  secs: Partial<Record<Sec, [Role, number, number?]>>;
}
interface Osti {
  name: string;
  inst: string;
  pat: string;
  rate?: number;
  center: number;
  size?: number;
  gain?: number;
  pan?: number;
  rev?: number;
  dly?: number;
  opts?: Record<string, number>;
  /** Velocity of each section, or [the figure this section switches to, velocity] */
  secs: Partial<Record<Sec, number | [string, number]>>;
  /** Velocity multiplier of the first four bars of the C section (the breakthrough); default 0, giving way to the drums and the bass riff */
  brk?: number;
}
interface PadDef {
  name: string;
  inst: string;
  center: number;
  size?: number;
  gain?: number;
  pan?: number;
  rev?: number;
  opts?: Record<string, number>;
  /** Velocity of each section; the C section appears only in the second half (the climb) */
  secs: Partial<Record<Sec, number>>;
}
interface Bass {
  name: string;
  inst: string;
  /** The lowest note of bassline */
  base: number;
  /** Transposition of the C section riff (the riff is written in the tonic's octave) */
  riffOct?: number;
  gain?: number;
  pan?: number;
  rev?: number;
  opts?: Record<string, number>;
  /** [rhythm, scale degree] for each section; when the C section has riffOct it is used only in the second half */
  secs: Partial<Record<Sec, [string, string]>>;
}
/** Chord accents (unison chords made with strum): one rhythm per section, the length a whole number of bars; a trailing ! means play only once */
interface Stab extends Pats {
  name: string;
  inst: string;
  center: number;
  size?: number;
  spread?: number;
  gain?: number;
  pan?: number;
  rev?: number;
  opts?: Record<string, number>;
}
/** Drums: one drum score per section (looped to fill), fill replaces the last bar of A, A' and B; a trailing ! means play only once */
interface Hit extends Pats {
  name: string;
  inst: string;
  pitch?: string | number;
  fill?: string;
  gain?: number;
  pan?: number;
  rev?: number;
  opts?: Record<string, number>;
}
interface Kit {
  /** Place a piece into a certain bar of a certain section in the loop (shift is extra steps, may be negative; going past the end wraps around to the start of the loop) */
  at: (s: Sec, bar: number, p: Part, shift?: number) => Part;
  len: number;
}
interface Region {
  name: string;
  mood: string;
  tonic: number;
  mode: Mode;
  bpm: number;
  swing?: number;
  space: SongDef['space'];
  delay?: SongDef['delay'];
  gain?: number;
  voices: Voice[];
  osti?: Osti[];
  pads?: PadDef[];
  bass: Bass[];
  stabs?: Stab[];
  drums: Hit[];
  extra?: (k: Kit) => TrackDef[];
  /** Long-note floor of the low strings (see floorLine): false turns it off, a number is the volume of the two voices */
  floor?: false | { bass?: number; tenor?: number };
}

// ───────────────────────── Palette ─────────────────────────

const PALETTE: Record<string, Region> = {
  // Astralgate Plaza (tutorial battle, default): D major, horns and strings, a jazz drum kit. The leitmotif appears in the B section in the original key.
  hub: {
    name: '星門廣場',
    mood: 'D 大調，152 BPM。法國號唱主題，弦樂接手，斷弓弦樂的十六分音符在底下跑，爵士鼓組的大鼓跟著旋律打 3+3+2。明亮的冒險。',
    tonic: 62,
    mode: 'ionian',
    bpm: 152,
    space: { size: 1.8, damp: 0.35, pre: 0.02, er: 0.3, mix: 0.8 },
    voices: [
      { name: '法國號', inst: 'horn', gain: 1.4, pan: -0.2, rev: 0.4, secs: { A: ['mel', -12], A2: ['ctr', 0, 0.8], B: ['ctr', 0, 0.9], C: ['mel', -12], T: ['mel', -12] } },
      { name: '弦樂', inst: 'strings', gain: 0.85, pan: 0.2, rev: 0.4, opts: { attack: 0.05, release: 0.3 }, secs: { A2: ['mel', 0], B: ['mel', 0], C: ['resp', 0], T: ['mel', 0] } },
      { name: '鐘琴', inst: 'glock', gain: 0.3, pan: 0.35, rev: 0.4, secs: { A2: ['mel', 12, 0.8] } },
    ],
    osti: [{ name: '斷弓弦樂', inst: 'spicc', pat: '0 1 2 1 3 1 2 1', rate: 1, center: 57, gain: 0.55, pan: 0.1, rev: 0.25, secs: { A: ['0 . 2 . 1 . 2 .', 0.8], A2: 0.9, B: 0.8, C: 1, T: 0.9 } }],
    pads: [{ name: '弦樂墊', inst: 'strPad', center: 55, size: 3, gain: 0.6, rev: 0.5, secs: { A: 0.5, A2: 0.6, B: 0.8, C: 0.7, T: 0.7 } }],
    bass: [{ name: '低音撥奏', inst: 'pizzBass', base: 33, riffOct: -24, gain: 0.5, secs: { A: ['X..x..x.X..x..x.', '1 1 8 1 1 5'], B: ['x.......x.x.....', '1 1 5'], C: ['x.x.x.x.x.x.x.x.', '1 8'], T: ['X..X..X.X..X..X.', '1'] } }],
    stabs: [
      {
        name: '銅管重音',
        inst: 'brassStab',
        center: 62,
        size: 3,
        gain: 0.5,
        pan: -0.1,
        rev: 0.3,
        A2: 'X...............|................|X...............|..........X.....',
        C: '................|X..X..X.X.......|................|X..X..X.X.......|X...............|................|X...............|X.......X.......',
        T: 'X..X..X.X..X..X.|X...X...........',
      },
    ],
    drums: [
      { name: '大鼓', inst: 'kick', gain: 0.45, A: 'X..x..x.X..x..x.', B: 'X.......X.x.....', C: 'X..x..x.X..x..x.|X..x..x.X.......|X..x..x.X..x..x.|X..x..x.X.......|X...X...X...X...', T: 'X..X..X.X..X..X.|X...X...X...X...' },
      {
        name: '小鼓',
        inst: 'snare',
        gain: 0.65,
        pan: 0.05,
        A: '....X.......X...',
        A2: '....X.......X..o',
        B: '........X.......',
        C: '................|................|................|................|....X.......X...|....X.......X..o|x.x.x.x.x.x.x.x.|xxxxxxxxXXXXXXXX',
        T: '..........X.....|....X...xxxxXXXX',
        fill: '....X.......XoXX',
      },
      { name: '腳踏鈸', inst: 'hat', gain: 1.6, pan: 0.25, A: 'x.x.x.x.x.x.x.x.', A2: 'x.xox.xox.xox.xo', C: '................|................|................|................|x.x.x.x.x.x.x.x.|x.xox.xox.xox.xo|xoxoxoxoxoxoxoxo|xxxxxxxxxxxxxxxx' },
      { name: '疊音鈸', inst: 'ride', gain: 1.2, pan: -0.25, B: 'x.x.x.x.x.x.x.x.' },
      { name: '中鼓', inst: 'tom', pitch: 'D3', gain: 0.6, pan: 0.2, C: '................|..........x.x...|................|..........x.x...', fill: '........x.x.....' },
      { name: '低鼓', inst: 'tom', pitch: 'G2', gain: 0.7, pan: -0.2, C: '................|..............xx|................|..............xx', fill: '............x.x.' },
      { name: '鈸', inst: 'crash', gain: 0.55, A: 'X!', A2: 'X!', B: 'X!', C: 'X...............|................|................|................|X!', T: 'X!' },
    ],
  },

  // Whisperwood: D Dorian, flute and kalimba, the 3+3+2 of the frame drum, a light swing.
  forest: {
    name: '翠語森林',
    mood: 'D 多利安，148 BPM，八分音符微微搖擺。長笛主奏，卡林巴撥頑固音型，框鼓打 3+3+2，沙鈴、邊擊與木魚是輕鼓組；B 段單簧管唱、長笛在上面吹對位。輕快、有草味的戰鬥。',
    tonic: 62,
    mode: 'dorian',
    bpm: 148,
    swing: 0.14,
    space: { size: 2.2, damp: 0.55, pre: 0.03, er: 0.25, mix: 0.75 },
    delay: { steps: 3, fb: 0.28, tone: 2600, mix: 0.5 },
    voices: [
      { name: '長笛', inst: 'flute', gain: 1.35, pan: 0.15, rev: 0.4, dly: 0.15, secs: { A: ['mel', 0], A2: ['ctr', 12, 0.75], B: ['ctr', 12, 0.85], C: ['mel', 0], T: ['mel', 0] } },
      { name: '單簧管', inst: 'clarinet', gain: 0.8, pan: -0.2, rev: 0.35, secs: { A2: ['mel', 0], B: ['mel', -12], C: ['resp', -12], T: ['sixth', 0] } },
    ],
    osti: [{ name: '卡林巴', inst: 'kalimba', pat: '0 2 1 3 2 1 0 2', rate: 2, center: 69, gain: 0.55, pan: -0.3, rev: 0.3, dly: 0.2, secs: { A: 0.8, A2: 1, B: ['0 2 1 2 0 2 1 3 . 2 1 2 0 2 3 2', 0.85], C: 1, T: 0.9 }, brk: 0.6 }],
    pads: [{ name: '弦樂墊', inst: 'strPad', center: 57, size: 3, gain: 0.45, rev: 0.55, secs: { A2: 0.5, B: 0.7, C: 0.6, T: 0.5 } }],
    stabs: [{ name: '古典吉他', inst: 'nylon', center: 57, size: 3, spread: 0.018, gain: 0.45, pan: 0.3, rev: 0.3, A2: 'x..x..x.x...x...', B: 'x..x..x.x.x.x...', C: '................|................|................|................|x..x..x.x..x..x.', T: 'X..X..X.X..X..X.|X...............' }],
    bass: [{ name: '低音撥奏', inst: 'pizzBass', base: 33, riffOct: -24, gain: 0.6, secs: { A: ['x..x..x.x.......', '1 1 5 8'], B: ['x.....x.x.....x.', '1 5 8 5'], C: ['x.x.x.x.x.x.x.x.', '1 8 5 8'], T: ['X..X..X.X..X..X.', '1'] } }],
    drums: [
      { name: '框鼓低', inst: 'frame', pitch: 'A2', gain: 0.6, A: 'X..x..x.X.....x.', B: 'X.....x.X.....x.', C: 'X..x..x.X..x..x.', T: 'X..X..X.X..X..X.|X.x.X.x.xxxxXXXX' },
      { name: '框鼓高', inst: 'frame', pitch: 'E3', gain: 0.55, pan: 0.2, A: '....o.......x..o', A2: '..o.x..o..o.x..o', B: '....x.......x...', C: '..o.x.o...o.x.oo', fill: '....x...x.x.xxxx' },
      { name: '沙鈴', inst: 'shaker', gain: 1.6, pan: -0.3, A: 'xoxoxoxoxoxoxoxo', A2: 'xoxxxoxxxoxxxoxx', B: 'x.x.x.x.x.x.x.x.', C: 'xoxoxoxoxoxoxoxo' },
      { name: '邊擊', inst: 'rim', gain: 1.3, pan: 0.15, A2: '....x.......x...', B: '....x.......x..x', C: '................|................|................|................|....x.......x...' },
      { name: '大鼓', inst: 'kick', gain: 0.5, A2: 'x.........x.....', B: 'x.........x.....', C: 'x.........x.....' },
      { name: '木魚', inst: 'woodblock', pitch: 'A5', gain: 1, pan: 0.35, C: '................|x.x..x.x..x.....|................|x.x..x.x..x.x.x.' },
      { name: '木魚低', inst: 'woodblock', pitch: 'E5', gain: 1, pan: -0.35, C: '................|.x..x..x..x.x...|................|.x..x..x..x.x.x.', fill: '..........x.x.x.' },
    ],
  },

  // Tidesong Isles: A Mixolydian, tin whistle and accordion, bodhran, a heavy swing turning into the bounce of a jig.
  isles: {
    name: '潮歌群島',
    mood: 'A 混合利底亞，156 BPM，重搖擺。錫哨在高音區吹主題，手風琴一邊打反拍和弦一邊接旋律，寶思蘭鼓帶著跳，副歌有拍手。像在甲板上打架。',
    tonic: 69,
    mode: 'mixolydian',
    bpm: 156,
    swing: 0.3,
    gain: 1.1,
    space: { size: 1.3, damp: 0.3, pre: 0.01, er: 0.45, mix: 0.6 },
    voices: [
      { name: '錫哨', inst: 'whistle', gain: 1.3, pan: 0.2, rev: 0.3, secs: { A: ['mel', 0], A2: ['ctr', 12, 0.6], B: ['ctr', 12, 0.6], C: ['mel', 0], T: ['mel', 0] } },
      { name: '手風琴', inst: 'accordion', gain: 0.9, pan: -0.2, rev: 0.3, secs: { A2: ['mel', -12], B: ['mel', -12], C: ['resp', -12], T: ['mel', -12] } },
    ],
    stabs: [
      { name: '手風琴伴奏', inst: 'accordion', center: 62, size: 3, spread: 0.003, gain: 0.5, pan: -0.35, rev: 0.25, A: '..x...x...x...x.', T: 'X..X..X.X..X..X.|X...X...........' },
      { name: '鋼弦吉他', inst: 'steel', center: 57, size: 3, spread: 0.02, gain: 0.5, pan: 0.35, rev: 0.25, A2: 'x...x.x.x...x.x.', B: 'x..x..x.x..x..x.', C: 'X..X..X.X.......|X..X..X.X.......|X..X..X.X.......|X..X..X.X.......|x.x.x.x.x.x.x.x.', T: 'X..X..X.X..X..X.|X...............' },
    ],
    bass: [{ name: '低音撥奏', inst: 'pizzBass', base: 40, riffOct: -24, gain: 0.6, secs: { A: ['x...x...x...x...', '1 5'], B: ['x.....x.x...x...', '1 5 1 5'], C: ['x.x.x.x.x.x.x.x.', '1 5 1 5'], T: ['X..X..X.X..X..X.', '1'] } }],
    pads: [{ name: '弦樂墊', inst: 'strPad', center: 60, size: 3, gain: 0.4, rev: 0.5, secs: { B: 0.7, C: 0.6 } }],
    drums: [
      { name: '寶思蘭鼓', inst: 'frame', pitch: 'A2', gain: 0.7, A: 'X.o.x.o.X.o.x.oo', B: 'X...x.o.X...x.o.', C: 'X.xxX.xxX.x.X.xx', T: 'X..X..X.X..X..X.|X.x.X.x.xxxxXXXX' },
      { name: '鼓框', inst: 'frame', pitch: 'D3', gain: 0.55, pan: 0.2, A: '....x.......x...', A2: '....x..o....x.o.', B: '....x.......x...', C: '..x...x...x...x.', fill: '....x...x.xxxxxx' },
      { name: '拍手', inst: 'clap', gain: 1.1, pan: -0.15, A2: '....x.......x...', B: '....x.......x...', C: '................|................|................|................|....x.......x...' },
      { name: '跺腳', inst: 'kick', gain: 0.35, A: 'X.......X.......', B: 'X.......X.......', C: 'X.......X.......' },
      { name: '鈴鼓', inst: 'tamb', gain: 1.2, pan: 0.35, B: 'x.x.x.x.x.x.x.x.', C: '................|................|................|................|x.x.x.x.x.x.x.x.' },
    ],
    extra: (k) => [{ name: '海浪', inst: 'sea', part: k.at('C', 0, mel('C4:64'), -8), gain: 0.5, rev: 0.1, opts: { attack: 1.2, release: 1.5 } }],
  },

  // Emberspine: E Phrygian dominant, lute tremolo, an oboe like a zurna, taiko, the hand drum's maqsum and an anvil.
  volcano: {
    name: '焰脊火山帶',
    mood: 'E 弗里吉亞屬，144 BPM。魯特琴用顫奏唱主題，雙簧管接手像一支嗩吶，銅管重音砸在拍點上；太鼓、手鼓打 maqsum 節奏，鐵砧在反拍敲。異國、炙熱。',
    tonic: 64,
    mode: 'phrygianDom',
    bpm: 144,
    space: { size: 2.6, damp: 0.6, pre: 0.02, er: 0.35, mix: 0.85 },
    voices: [
      { name: '魯特琴', inst: 'lute', trem: 1, gain: 1.55, pan: -0.2, rev: 0.3, secs: { A: ['mel', -12], A2: ['mel', -12, 0.75], B: ['ctr', 0, 0.85], C: ['mel', -12], T: ['mel', -12] } },
      { name: '雙簧管', inst: 'oboe', gain: 1.0, pan: 0.2, rev: 0.4, opts: { vib: 14 }, secs: { A2: ['mel', 0], B: ['mel', 0], C: ['resp', 0], T: ['mel', 0] } },
    ],
    osti: [{ name: '斷弓低弦', inst: 'spicc', pat: '0 0 1 0 2 0 1 0', rate: 1, center: 52, gain: 0.7, pan: 0.15, rev: 0.25, secs: { A: ['0 . 0 1 0 . 2 .', 0.8], A2: 0.9, B: 0.8, C: 1, T: 0.9 } }],
    pads: [{ name: '弦樂墊', inst: 'strings', center: 55, size: 3, gain: 0.5, rev: 0.5, opts: { attack: 0.3, release: 0.6 }, secs: { A: 0.5, A2: 0.6, B: 0.8, C: 0.7, T: 0.7 } }],
    stabs: [
      {
        name: '銅管重音',
        inst: 'brassStab',
        center: 59,
        size: 3,
        gain: 0.35,
        rev: 0.35,
        A: 'X.........x.....|..........X.....',
        A2: 'X.....x...x.....',
        B: 'X...............',
        C: '................|X..X..X.X.......|................|X..X..X.X.......|X...............|X...............|X.......X.......|X...X...X...X...',
        T: 'X..X..X.X..X..X.|X...X...........',
      },
    ],
    bass: [
      { name: '低音撥奏', inst: 'pizzBass', base: 36, riffOct: -24, gain: 0.45, secs: { A: ['x.xx..x.x.xx..x.', '1'], B: ['x.....x.x.......', '1 5 1'], C: ['x.x.x.x.x.x.x.x.', '1 8'], T: ['X..X..X.X..X..X.', '1'] } },
      { name: '次低頻', inst: 'sub', base: 28, gain: 0.45, opts: { release: 0.3 }, secs: { A: ['x-------x-------', '1'], B: ['x-------x-------', '1'], C: ['x-------x-------', '1'], T: ['x-------x-------', '1'] } },
    ],
    drums: [
      { name: '太鼓低', inst: 'taiko', pitch: 'C2', gain: 0.24, A: 'X.......X.....x.', B: 'X.......X.......', C: 'X..x..x.X..x..x.', T: 'X..X..X.X..X..X.|X...X...X.X.XXXX' },
      { name: '太鼓高', inst: 'taiko', pitch: 'G2', gain: 0.3, pan: 0.25, A2: '......x.......x.', B: '..........x.....', C: '................|x.x.x.x.x.x.x.x.|................|x.x.x.x.x.x.x.x.|......x.......x.|......x.......x.|..x...x...x...x.|x.x.x.x.xxxxxxxx', fill: '........x.x.xxxx' },
      { name: '手鼓 doum', inst: 'darbuka', pitch: 'A3', gain: 0.7, pan: -0.15, A: 'x.......x.......', B: 'x.......x.......', C: 'x.......x.......' },
      { name: '手鼓 tek', inst: 'darbuka', pitch: 'C5', gain: 1.3, pan: 0.3, A: '..x...x.o...x.oo', A2: '..x.o.x.o.o.x.oo', B: '..x...x.....x...', C: '..x.o.x.o.o.x.oo' },
      { name: '鐵砧', inst: 'anvil', pitch: 'D6', gain: 0.9, pan: 0.4, A: '......x.......x.', B: '..............x.', C: '................|................|................|................|......x.......x.' },
      { name: '鑼', inst: 'gong', pitch: 'E2', gain: 0.5, rev: 0.5, A: 'X!', B: 'X!', C: '................|................|................|................|X!' },
    ],
    extra: (k) => [{ name: '火', inst: 'fire', part: k.at('A', 0, mel(`C4:${k.len}`)), gain: 0.35, rev: 0.1, opts: { attack: 0.5, release: 0.5 } }],
  },

  // Galecrest: G Lydian, panpipes and yangqin, tambourine; the yangqin circles in groups of three eighth notes, out of step with the four beats, so it sounds like drifting.
  highland: {
    name: '蒼嘯高原',
    mood: 'G 利底亞，158 BPM。排笛吹主題，揚琴三個八分音符一組繞圈、跟四拍子錯開，A\' 起弦樂在高八度把旋律拉上去、排笛改吹長音；鈴鼓十六分音符，大鼓只打第一拍和第三拍後半，整首是飄著的。',
    tonic: 55,
    mode: 'lydian',
    bpm: 158,
    space: { size: 2.4, damp: 0.25, pre: 0.03, er: 0.2, mix: 0.85 },
    delay: { steps: 3, fb: 0.3, tone: 3500, mix: 0.5 },
    voices: [
      { name: '排笛', inst: 'panflute', gain: 1, pan: 0.15, rev: 0.45, dly: 0.2, secs: { A: ['mel', 0], A2: ['ctr', 12, 0.8], B: ['ctr', 12, 0.85], C: ['mel', 0], T: ['mel', 0] } },
      { name: '高音弦樂', inst: 'strings', gain: 0.75, pan: -0.15, rev: 0.45, opts: { attack: 0.08, release: 0.4 }, secs: { A2: ['mel', 12], B: ['mel', 12], C: ['resp', 12], T: ['mel', 12] } },
    ],
    osti: [{ name: '揚琴', inst: 'dulcimer', pat: '0 1 2', rate: 2, center: 67, gain: 0.85, pan: -0.3, rev: 0.35, secs: { A: ['0 . 2 . 1 .', 0.8], A2: 0.9, B: ['0 . 2 . 1 .', 0.8], C: 1, T: 0.9 }, brk: 0.7 }],
    pads: [{ name: '空氣墊', inst: 'airPad', center: 67, size: 3, gain: 0.8, rev: 0.6, secs: { A: 0.6, A2: 0.7, B: 0.9, C: 0.8, T: 0.8 } }],
    bass: [
      { name: '低音撥奏', inst: 'pizzBass', base: 38, riffOct: -12, gain: 0.65, secs: { A: ['x.....x...x.....', '1 5 8'], B: ['x.........x.....', '1 5'], C: ['x.x...x.x.x...x.', '1 8 5 8'], T: ['X..X..X.X..X..X.', '1'] } },
      { name: '次低頻', inst: 'sub', base: 26, gain: 0.5, opts: { release: 0.3 }, secs: { A: ['x-------x-------', '1'], B: ['x-------x-------', '1'], C: ['x-------x-------', '1'], T: ['x-------x-------', '1'] } },
    ],
    drums: [
      { name: '鈴鼓', inst: 'tamb', gain: 1.8, pan: 0.3, A: 'x.xox.xox.xox.xo', B: 'x.x.x.x.x.x.x.x.', C: 'xoxoxoxoxoxoxoxo' },
      { name: '大鼓', inst: 'kick', gain: 0.5, A: 'X.........x.....', B: 'X.........x.....', C: 'X.........x.....|X.........x.....|X.........x.....|X.........x.....|X.....x...x.....', T: 'X..X..X.X..X..X.|X...X...X...X...' },
      { name: '框鼓', inst: 'frame', pitch: 'D3', gain: 0.6, pan: -0.2, A: '......x.......x.', A2: '....x.x.....x.x.', B: '....x.......x...', C: '..x.x.x...x.x.x.', T: '................|....x.x.xxxxXXXX', fill: '....x.x.x.x.xxxx' },
      { name: '拍手', inst: 'clap', gain: 1.2, pan: 0.1, A2: '....x.......x...', B: '....x.......x...' },
      { name: '鈸', inst: 'crash', gain: 0.45, A: 'X!', A2: 'X!', B: 'X!', C: '................|................|................|................|X!' },
      { name: '管鐘', inst: 'chime', pitch: 67, gain: 0.35, pan: 0.4, rev: 0.6, A: 'X!', B: 'X!', T: 'X!' },
    ],
    extra: (k) => [{ name: '風', inst: 'wind', part: k.at('A', 0, mel(`C4:${k.len}`)), gain: 0.35, rev: 0.2, opts: { attack: 0.5, release: 0.5 } }],
  },

  // Stoneheart Canyon: C natural minor, the bassoon sings the theme in the low register, the tuba holds long notes, the male choir shouts accents, the mid drum plays half-speed downbeats.
  canyon: {
    name: '磐心峽谷',
    mood: 'C 自然小調，144 BPM，半速的重拍。低音管在低音區唱主題，低音號在底下吹長音，男聲合唱在重拍上喊和弦，B 段男聲合唱唱主旋律；中鼓、低鼓與地鳴鼓，峽谷的回聲放在延遲裡。沉重。',
    tonic: 60,
    mode: 'aeolian',
    bpm: 144,
    gain: 0.9,
    space: { size: 2.8, damp: 0.5, pre: 0.045, er: 0.5, mix: 0.85 },
    delay: { steps: 6, fb: 0.22, tone: 1600, mix: 0.4 },
    voices: [
      { name: '低音管', inst: 'bassoon', gain: 1.3, pan: -0.15, rev: 0.35, dly: 0.12, secs: { A: ['mel', -12], A2: ['mel', -12, 0.85], B: ['ctr', 0, 0.6], C: ['mel', -24], T: ['mel', -12] } },
      { name: '低音號', inst: 'tuba', gain: 0.9, pan: 0.1, rev: 0.3, secs: { A2: ['ctr', -24], T: ['sixth', -24] } },
      { name: '男聲合唱', inst: 'menChoir', gain: 1.3, pan: 0.15, rev: 0.5, dly: 0.1, secs: { B: ['mel', -24] } },
    ],
    osti: [{ name: '斷弓低弦', inst: 'spicc', pat: '0 0 0 1 0 0 2 0', rate: 2, center: 45, gain: 0.6, pan: 0.2, rev: 0.25, secs: { A: 0.8, A2: 0.9, B: ['0 . 0 . 0 . 0 .', 0.8], C: 1, T: 0.9 } }],
    pads: [{ name: '弦樂墊', inst: 'strPad', center: 52, size: 3, gain: 0.55, rev: 0.5, secs: { B: 0.75, C: 0.7, T: 0.7 } }],
    stabs: [
      {
        name: '男聲重音',
        inst: 'menChoir',
        center: 55,
        size: 3,
        spread: 0.002,
        gain: 0.55,
        pan: -0.1,
        rev: 0.5,
        opts: { attack: 0.03, release: 0.3 },
        A: 'X--.......x-....|X--.............',
        A2: 'X--...x-..x-....',
        C: '................|X-.X-.X-X-......|................|X-.X-.X-X-......|X---............|X---............|X---....X---....|X---X---X---X---',
        T: 'X-------X-------|X---............',
      },
      { name: '銅管重音', inst: 'brassStab', center: 52, size: 3, gain: 0.4, rev: 0.3, A: 'X.........x.....|X...............', A2: 'X.....x...x.....', C: '................|X..X..X.X.......|................|X..X..X.X.......', T: 'X..X..X.X..X..X.|X...X...........' },
    ],
    bass: [
      { name: '低音撥奏', inst: 'pizzBass', base: 32, riffOct: -24, gain: 0.55, secs: { A: ['X.......x.x.....', '1 1 5'], B: ['X.......x.......', '1 5'], C: ['x.x.x.x.x.x.x.x.', '1 8'], T: ['X..X..X.X..X..X.', '1'] } },
      { name: '次低頻', inst: 'sub', base: 28, gain: 0.6, opts: { release: 0.3 }, secs: { A: ['x-------x-------', '1'], B: ['x-------x-------', '1'], C: ['x-------x-------', '1'], T: ['x-------x-------', '1'] } },
    ],
    drums: [
      { name: '地鳴鼓', inst: 'boom', gain: 0.35, A: 'X...............', B: 'X.......X.......', C: 'X...............|X...............|X...............|X...............|X.......X.......', T: 'X..X..X.X..X..X.|X.......X.......' },
      { name: '大鼓', inst: 'kick', gain: 0.5, A: '......x...x.....', A2: '......x...x...x.', B: '..........x.....', C: '...x..x....x..x.' },
      { name: '小鼓', inst: 'snare', gain: 0.6, A: '........X.......', B: '........X.......', C: '................|................|................|................|........X.......|........X.......|....X.......X...|x.x.x.x.XxXxXXXX', T: '................|....X...xxxxXXXX', fill: '........X...XoXX' },
      { name: '中鼓', inst: 'tom', pitch: 'G2', gain: 0.5, pan: 0.25, A: '...x..x.....x...', A2: '...x..x.....x.x.', B: '............x...', C: '...x..x.....x.x.|x.x.x.x.x.x.x.x.|...x..x.....x.x.|x.x.x.x.x.x.x.x.', fill: '....x.x.x.x.....' },
      { name: '低鼓', inst: 'tom', pitch: 'C2', gain: 0.5, pan: -0.25, A: 'X.............x.', B: 'X...............', C: 'X..X..X.X..X..X.', fill: '............X.XX' },
      { name: '鎖鏈', inst: 'chain', gain: 1, pan: 0.4, C: 'X!', T: 'X!' },
    ],
  },

  // Stormreach: A minor, morin khuur glides, a galloping frame drum; the transition, B and C each hit a close thunder on their first beat (thunderbolt + cymbal + brass chord), and A' opens with distant muffled thunder.
  // The intro is the transition, so the very first beat of a battle is a thunderbolt. The first half of the C section adds a throat-singing drone.
  plains: {
    name: '雷鳴荒原',
    mood: 'A 小調，160 BPM，全曲最快。馬頭琴滑著唱主題，弦樂在底下拉長音對位，撥弦與框鼓都是 x.xx 的奔馬節奏，太鼓壓重拍。開戰第一拍、B 段與 C 段開頭各劈一記近雷，鈸和銅管和弦一起砸下去，A\' 開頭遠處再滾一聲悶雷；C 段突破口換成呼麥的主音持續音。狂野。',
    tonic: 57,
    mode: 'aeolian',
    bpm: 160,
    gain: 0.88,
    space: { size: 2.0, damp: 0.4, pre: 0.02, er: 0.15, mix: 0.7 },
    voices: [
      { name: '馬頭琴', inst: 'morin', slide: true, gain: 1.5, pan: -0.1, rev: 0.35, opts: { glide: 0.14, release: 0.2 }, secs: { A: ['mel', 0], A2: ['mel', 0, 0.9], B: ['mel', 0], C: ['mel', -12], T: ['mel', 0] } },
      { name: '弦樂', inst: 'strings', gain: 0.8, pan: 0.2, rev: 0.4, opts: { attack: 0.06, release: 0.3 }, secs: { A2: ['ctr', 0, 0.85], B: ['ctr', 0], C: ['resp', 0], T: ['mel', 12] } },
    ],
    osti: [{ name: '撥弦', inst: 'pizz', pat: '0.00 1.11 2.22 1.11', rate: 1, center: 57, gain: 0.8, pan: 0.3, rev: 0.25, secs: { A: 0.85, A2: 1, B: 0.85, C: 1, T: 0.9 }, brk: 0.8 }],
    pads: [{ name: '弦樂墊', inst: 'strPad', center: 52, size: 3, gain: 0.5, rev: 0.5, secs: { A: 0.5, A2: 0.6, B: 0.8, C: 0.7, T: 0.7 } }],
    bass: [
      { name: '低音撥奏', inst: 'pizzBass', base: 33, riffOct: -24, gain: 0.35, secs: { A: ['x.xxx.xxx.xxx.xx', '1'], B: ['x.xx....x.xx....', '1 1 1 5 5 5'], C: ['x.xxx.xxx.xxx.xx', '1'], T: ['X..X..X.X..X..X.', '1'] } },
      { name: '次低頻', inst: 'sub', base: 28, gain: 0.5, opts: { release: 0.3 }, secs: { A: ['x-------x-------', '1'], B: ['x-------x-------', '1'], C: ['x-------x-------', '1'], T: ['x-------x-------', '1'] } },
    ],
    stabs: [{ name: '閃電銅管', inst: 'brassStab', center: 60, size: 3, gain: 0.55, pan: -0.1, rev: 0.35, T: 'X..X..X.X..X..X.|X...X...........', B: 'X!', C: 'X!' }],
    drums: [
      { name: '框鼓奔馳', inst: 'frame', pitch: 'A2', gain: 0.55, A: 'X.xxx.xxX.xxx.xx', C: 'X.xxx.xxX.xxx.xx', B: 'X.xx....X.xx....', T: 'X..X..X.X..X..X.|X.xxX.xxxxxxXXXX' },
      { name: '框鼓高', inst: 'frame', pitch: 'E3', gain: 0.5, pan: 0.25, A: '....x.......x...', A2: '....x.o.....x.o.', B: '....x.xx....x.xx', C: '....x.......x...', fill: '....x.x.x.x.xxxx' },
      { name: '太鼓', inst: 'taiko', pitch: 'C2', gain: 0.35, A: 'X.......X.......', B: 'X.......X..x....', C: 'X..x..x.X..x..x.', T: 'X..X..X.X..X..X.|X...X...X...X...' },
      { name: '鈴鼓', inst: 'tamb', gain: 1.5, pan: -0.35, A2: 'x.x.x.x.x.x.x.x.', B: 'x.x.x.x.x.x.x.x.' },
      { name: '落雷', inst: 'thunderclap', gain: 0.9, rev: 0.4, T: 'X!', B: 'X!', C: 'X!' },
      { name: '遠雷', inst: 'thunder', gain: 0.6, rev: 0.3, A2: 'X!' },
      { name: '鈸', inst: 'crash', gain: 0.9, A2: 'X!', B: 'X!', C: 'X!', T: 'X!' },
    ],
    extra: (k) => [
      { name: '呼麥', inst: 'throat', part: k.at('C', 0, mel('A2:62')), gain: 0.6, pan: 0.1, rev: 0.4 },
      { name: '風', inst: 'wind', part: k.at('A', 0, mel(`C4:${k.len}`)), gain: 0.3, rev: 0.2, opts: { attack: 0.5, release: 0.5 } },
    ],
  },

  // Aurelia: Eb Lydian, trumpet lead, organ, choir accents, a march of timpani and snare drum; a church bell strikes at the start of each section.
  holy: {
    name: '曦光聖都',
    mood: 'Eb 利底亞，146 BPM，行進。小號唱主題，A\' 合唱在上面唱長音，B 段合唱唱旋律、小號吹對位；管風琴全音栓鋪和聲，豎琴在上面跑琶音，定音鼓與軍鼓打行進，段落開頭敲鐘。光明的史詩。',
    tonic: 63,
    mode: 'lydian',
    bpm: 146,
    space: { size: 3.0, damp: 0.3, pre: 0.035, er: 0.3, mix: 0.85 },
    voices: [
      { name: '小號', inst: 'trumpet', gain: 1.2, pan: 0.15, rev: 0.4, secs: { A: ['mel', -12], A2: ['mel', -12], B: ['ctr', 0, 0.85], C: ['mel', -12], T: ['mel', -12] } },
      { name: '合唱', inst: 'choir', gain: 0.9, pan: -0.15, rev: 0.55, secs: { A2: ['ctr', 0, 0.85], B: ['mel', -12], C: ['resp', -12], T: ['third', -12] } },
    ],
    osti: [{ name: '豎琴', inst: 'harp', pat: '0 1 2 3 4 3 2 1', rate: 2, center: 70, gain: 0.45, pan: 0.3, rev: 0.45, secs: { A: ['0 . 2 . 3 . 2 .', 0.7], A2: 0.8, B: 0.9, C: 0.9, T: 0.8 } }],
    pads: [{ name: '管風琴', inst: 'organFull', center: 58, size: 3, gain: 0.45, rev: 0.55, secs: { A: 0.55, A2: 0.65, B: 0.8, C: 0.75, T: 0.8 } }],
    stabs: [
      { name: '合唱重音', inst: 'choir', center: 67, size: 3, spread: 0.002, gain: 0.6, pan: 0.1, rev: 0.6, opts: { attack: 0.04, release: 0.4 }, A: 'X---............|................', C: '................|X-.X-.X-X-......|................|X-.X-.X-X-......', T: 'X-.X-.X-X-.X-.X-|X---............' },
      { name: '銅管重音', inst: 'brassStab', center: 60, size: 3, gain: 0.45, rev: 0.4, A2: 'X...............|..........X.....', C: '................|X..X..X.X.......|................|X..X..X.X.......|X...............|X...............|X.......X.......|X...X...X...X...', T: 'X..X..X.X..X..X.|X...X...........' },
    ],
    bass: [
      { name: '低音大提琴', inst: 'contrabass', base: 34, riffOct: -24, gain: 0.65, opts: { release: 0.15 }, secs: { A: ['x.......x.......', '1 5'], B: ['x.......x.......', '1 1'], C: ['x...x...x...x...', '1 8'], T: ['X..X..X.X..X..X.', '1'] } },
    ],
    drums: [
      { name: '定音鼓', inst: 'timpani', pitch: 'Eb2', gain: 0.45, A: 'X.......X.......', A2: 'X.....x.X.......', B: 'X...............', C: 'X..x..x.X..x..x.|X...............|X..x..x.X..x..x.|X...............|X...X...X...X...|X.x.X.x.X.x.X.x.|x.x.x.x.x.x.x.x.|X.X.X.X.XxXxXXXX', T: 'X..X..X.X..X..X.|X...X...........' },
      { name: '定音鼓低', inst: 'timpani', pitch: 'Bb1', gain: 0.45, A: '............x.x.', A2: '............x.x.', B: '........x.......', T: '................|........X.X.X.X.' },
      { name: '軍鼓', inst: 'field', gain: 1.1, pan: 0.1, A: 'X..x..x.x...x...', A2: 'X..x..x.x.x.x.xx', B: '....x.......x...', C: '................|X..X..X.X.......|................|X..X..X.X.......|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|xxxxxxxxxxxxxxxx|xxxxxxxxXXXXXXXX', T: '................|....X...xxxxXXXX', fill: 'x.x.x.x.xxxxXXXX' },
      { name: '鈸', inst: 'crash', gain: 0.5, A: 'X!', A2: 'X!', B: 'X!', C: '................|................|................|................|X!', T: 'X!' },
      { name: '鐘', inst: 'bell', pitch: 'Eb4', gain: 0.55, pan: -0.3, rev: 0.6, A: 'X!', B: 'X!', C: '................|................|................|................|X!' },
    ],
  },

  // Umbral Hollow: B harmonic minor, a music box sings the theme (an echo with delay added), pizzicato quietly walking underneath, the clarinet takes over in the low register; violin in the B section. A pendulum-like wood block.
  shadow: {
    name: '暮影幽境',
    mood: 'B 和聲小調，150 BPM，半速的低鼓。音樂盒在高音區唱主題，回聲拖在後面；撥奏弦樂在底下踮腳，單簧管用低音區接手，B 段換小提琴拉，帶增二度的吉普賽味；木魚像鐘擺一樣滴答。陰暗小調。',
    tonic: 59,
    mode: 'harmonicMinor',
    bpm: 150,
    space: { size: 2.6, damp: 0.7, pre: 0.04, er: 0.2, mix: 0.9 },
    delay: { steps: 3, fb: 0.38, tone: 2200, mix: 0.6 },
    voices: [
      { name: '音樂盒', inst: 'musicbox', gain: 1.3, pan: 0.2, rev: 0.45, dly: 0.35, secs: { A: ['mel', 12], A2: ['mel', 12, 0.65], C: ['mel', 12], T: ['mel', 12] } },
      { name: '單簧管', inst: 'clarinet', gain: 0.85, pan: -0.2, rev: 0.35, secs: { A2: ['mel', -12], B: ['ctr', 0, 0.85], C: ['resp', -12], T: ['mel', -12] } },
      { name: '小提琴', inst: 'violin', gain: 1.1, pan: 0.1, rev: 0.45, opts: { vib: 22 }, secs: { B: ['mel', 0] } },
    ],
    osti: [{ name: '撥奏', inst: 'pizz', pat: '0 . 2 . 1 . 2 .', rate: 1, center: 59, gain: 0.8, pan: 0.3, rev: 0.3, secs: { A: 0.8, A2: 1, B: ['0 2 1 2', 0.8], C: 1, T: 0.9 }, brk: 0.6 }],
    pads: [{ name: '陰暗墊', inst: 'darkPad', center: 52, size: 3, gain: 0.5, rev: 0.5, secs: { A2: 0.6, B: 0.8, C: 0.7, T: 0.7 } }],
    bass: [
      { name: '低音撥奏', inst: 'pizzBass', base: 33, riffOct: -24, gain: 0.5, secs: { A: ['X.......x..x....', '1 1 5'], B: ['X.......x.......', '1 5'], C: ['x.x.x.x.x.x.x.x.', '1 8'], T: ['X..X..X.X..X..X.', '1'] } },
      { name: '次低頻', inst: 'sub', base: 28, gain: 0.5, opts: { release: 0.3 }, secs: { A: ['x-------x-------', '1'], B: ['x-------x-------', '1'], C: ['x-------x-------', '1'], T: ['x-------x-------', '1'] } },
    ],
    drums: [
      { name: '低鼓', inst: 'boom', gain: 0.3, A: 'X.........x.....', B: 'X...............', C: 'X.........x.....', T: 'X..X..X.X..X..X.|X.......X.......' },
      { name: '木魚滴', inst: 'woodblock', pitch: 'E5', gain: 1.4, pan: 0.3, A: 'x.......x.......', B: 'x.......x.......', C: 'x.......x.......' },
      { name: '木魚答', inst: 'woodblock', pitch: 'B4', gain: 1.4, pan: -0.3, A: '....x.......x...', B: '....x.......x...', C: '....x.......x...' },
      { name: '邊擊', inst: 'rim', gain: 2, A2: '........x.......', B: '........x.....o.', C: '................|................|................|................|........x.......' },
      { name: '低音鼓', inst: 'tom', pitch: 'F#2', gain: 0.65, pan: -0.15, A2: '..............x.', C: '................|x..x..x.x..x..x.|................|x..x..x.x..x..x.|......x.......x.|......x.......x.|..x...x...x...x.|x.x.x.x.xxxxxxxx', T: '................|....x...x.x.xxxx', fill: '........x..x.xx.' },
      { name: '刷子', inst: 'brush', gain: 1.2, pan: 0.2, B: 'x...x...x...x...' },
      { name: '水滴', inst: 'drip', pitch: 'B5', gain: 1, pan: 0.4, rev: 0.6, A2: '.......x........|..............x.|...x............|........x.......' },
      { name: '鎖鏈', inst: 'chain', gain: 1, pan: -0.4, C: 'X!' },
    ],
  },
};

// ───────────────────────── Generator ─────────────────────────

interface Built {
  R: Region;
  sc: readonly number[];
  map: (m: number) => number;
  prog: (s: Sec) => Chd[];
}

/** The actual root degree after stacking thirds (a diminished triad becomes a seventh chord a third lower) */
function rootDeg(deg: number, sc: readonly number[]): number {
  const n = sc.length;
  const at = (k: number) => sc[((k % n) + n) % n] + 12 * Math.floor(k / n);
  return at(deg + 2) - at(deg) === 3 && at(deg + 4) - at(deg) === 6 ? deg - 2 : deg;
}

/** Stack thirds on a scale degree (0-based); a diminished triad becomes a seventh chord a third lower */
function degChord(deg: number, sc: readonly number[], tonicPc: number, seventh: boolean): Omit<Chd, 't' | 'd'> {
  const n = sc.length;
  const at = (k: number) => sc[((k % n) + n) % n] + 12 * Math.floor(k / n);
  let r = deg;
  let tones = [at(r), at(r + 2), at(r + 4)];
  if (tones[1] - tones[0] === 3 && tones[2] - tones[0] === 6) {
    r = deg - 2;
    tones = [at(r), at(r + 2), at(r + 4), at(r + 6)];
  } else if (seventh) tones.push(at(r + 6));
  const iv = tones.map((x) => x - tones[0]);
  const root = (((tonicPc + at(r)) % 12) + 12) % 12;
  return { sym: `級${deg}`, root, iv, bass: root, third: iv.includes(4) ? 4 : iv.includes(3) ? 3 : 0 };
}

function makeBuilt(R: Region): Built {
  const sc: readonly number[] = MODES[R.mode];
  const map = (m: number) => remap(m, R.tonic, R.mode);
  const cache = new Map<Sec, Chd[]>();
  const prog = (s: Sec): Chd[] => {
    let out = cache.get(s);
    if (out) return out;
    out = [];
    let t = 0;
    for (const bar of HARM[s].split('|')) {
      const toks = bar.trim().split(/\s+/).filter(Boolean);
      const d = 16 / toks.length;
      for (const tok of toks) {
        const c = degChord(parseInt(tok, 10), sc, R.tonic % 12, tok.endsWith('^'));
        out.push({ ...c, t, d });
        t += d;
      }
    }
    cache.set(s, out);
    return out;
  };
  return { R, sc, map, prog };
}

/** White-key source of each role in each section */
function rolePart(role: Role, s: Sec): Part {
  const main = s === 'A' || s === 'A2' ? A_MEL : s === 'B' ? B_MEL : s === 'C' ? seq(C_CALL, C_BUILD) : T_MEL;
  switch (role) {
    case 'mel':
      return main;
    case 'resp':
      return s === 'C' ? seq(C_RESP, C_BUILD) : main;
    case 'ctr':
      return s === 'B' ? B_CTR : s === 'C' ? seq(rest(4), dia(C_BUILD, -2)) : s === 'T' ? dia(T_MEL, -2) : A_CTR;
    case 'third':
      return dia(main, -2);
    case 'sixth':
      return dia(main, -5);
    case 'up3':
      return dia(main, 2);
  }
}

/** Expand a drum score/rhythm to the whole section: loop to fill; a trailing ! means play only once; fill replaces the last bar */
function expand(src: string, s: Sec, fill?: string): string {
  const n = BARS[s] * 16;
  let p = src.replace(/[\s|]/g, '');
  const once = p.endsWith('!');
  if (once) p = p.slice(0, -1);
  let out = once ? p.padEnd(n, '.') : p.repeat(Math.ceil(n / p.length));
  out = out.slice(0, n);
  if (fill && !once && s !== 'C' && s !== 'T') out = out.slice(0, n - 16) + fill.replace(/[\s|]/g, '');
  return out;
}

const pitchOf = (p?: string | number): number | undefined => (p === undefined ? undefined : typeof p === 'number' ? p : midi(p));
const common = (x: { name: string; inst: string; gain?: number; pan?: number; rev?: number; dly?: number; opts?: Record<string, number> }) => ({ name: x.name, inst: x.inst, gain: x.gain, pan: x.pan, rev: x.rev, dly: x.dly, opts: x.opts });

/** Velocity of the low strings in each section: thickest in the sprint section */
const FLOOR_V: Record<Sec, number> = { A: 0.55, A2: 0.65, B: 0.6, C: 0.75, T: 0.8 };

/** Assemble all tracks of the given section from the palette */
function build(B: Built, secs: Sec[], withExtra: boolean): TrackDef[] {
  const { R, sc, map, prog } = B;
  const out: TrackDef[] = [];
  const along = (f: (s: Sec) => Part | null): Part => seq(...secs.map((s) => f(s) ?? rest(BARS[s])));

  for (const v of R.voices) {
    let p = along((s) => {
      const spec = v.secs[s];
      if (!spec) return null;
      const [role, shift, k = 1] = spec;
      let q = mapPitch(rolePart(role, s), (m) => map(m) + shift);
      if (k !== 1) q = vel(q, k);
      return v.trem ? tremolo(q, v.trem) : q;
    });
    if (v.slide) p = slides(p);
    out.push({ ...common(v), part: p });
  }
  for (const o of R.osti ?? []) {
    const p = along((s) => {
      const spec = o.secs[s];
      if (spec === undefined) return null;
      const [pat, k] = typeof spec === 'number' ? [o.pat, spec] : spec;
      const q = vel(arp(prog(s), pat, { rate: o.rate ?? 2, center: o.center, size: o.size }), k);
      if (s !== 'C') return q;
      return seq(o.brk ? vel(slice(q, 0, 64), o.brk) : rest(4), slice(q, 64, 128));
    });
    out.push({ ...common(o), part: p });
  }
  for (const d of R.pads ?? []) {
    const p = along((s) => {
      const k = d.secs[s];
      if (k === undefined) return null;
      const q = vel(pad(prog(s), { center: d.center, size: d.size }), k);
      return s === 'C' ? seq(rest(4), slice(q, 64, 128)) : q;
    });
    out.push({ ...common(d), part: p });
  }
  for (const b of R.bass) {
    const p = along((s) => {
      const spec = b.secs[s] ?? (s === 'A2' ? b.secs.A : undefined);
      if (!spec) return null;
      const q = bassline(prog(s), spec[0], spec[1], { base: b.base });
      if (s !== 'C' || b.riffOct === undefined) return q;
      const shift = (deg: number) => {
        const e = rootDeg(deg, sc);
        return e <= 2 ? e : e - 7;
      };
      const riff = seq(...[0, 0, 3, 4].map((deg) => dia(C_RIFF, shift(deg))));
      return seq(vel(mapPitch(riff, (m) => map(m) + (b.riffOct ?? 0)), 0.8), slice(q, 64, 128));
    });
    out.push({ ...common(b), part: p });
  }
  if (R.floor !== false) {
    const f = R.floor ?? {};
    const low = (base: number, fifth: boolean) => along((s) => vel(holdRoots(prog(s), base, fifth), FLOOR_V[s]));
    out.push({ name: '低音大提琴長音', inst: 'contrabass', part: low(33, false), gain: f.bass ?? 0.5, rev: 0.3, opts: { attack: 0.08, release: 0.4 } });
    out.push({ name: '大提琴長音', inst: 'celli', part: low(45, true), gain: f.tenor ?? 0.4, pan: -0.15, rev: 0.35, opts: { attack: 0.1, release: 0.4 } });
  }
  for (const st of R.stabs ?? []) {
    const p = along((s) => {
      const src = st[s];
      return src ? strum(prog(s), expand(src, s), { center: st.center, size: st.size ?? 3, spread: st.spread ?? 0.004 }) : null;
    });
    out.push({ ...common(st), part: p });
  }
  for (const h of R.drums) {
    const p = along((s) => {
      const src = h[s] ?? (s === 'A2' ? h.A : undefined);
      return src ? grid(expand(src, s, h.fill), 1, pitchOf(h.pitch)) : null;
    });
    out.push({ ...common(h), part: p });
  }
  if (withExtra && R.extra) {
    const starts = new Map<Sec, number>();
    let acc = 0;
    for (const s of secs) {
      starts.set(s, acc);
      acc += BARS[s] * 16;
    }
    const len = acc;
    const at = (s: Sec, bar: number, p: Part, shift = 0): Part => {
      const off = (starts.get(s) ?? 0) + bar * 16 + shift;
      return { ev: p.ev.map((e) => ({ ...e, t: (((e.t + off) % len) + len) % len })).sort((a, b) => a.t - b.t), len };
    };
    out.push(...R.extra({ at, len }));
  }
  return out.filter((t) => typeof t.part !== 'string' && t.part.ev.length > 0);
}

export function wild(region: string): SongDef {
  const R = PALETTE[region] ?? PALETTE.hub;
  const B = makeBuilt(R);
  return {
    title: `野外遭遇戰・${R.name}`,
    mood: R.mood,
    bpm: R.bpm,
    swing: R.swing,
    space: R.space,
    delay: R.delay,
    gain: R.gain,
    intro: build(B, ['T'], false),
    tracks: build(B, LOOP, true),
  };
}
