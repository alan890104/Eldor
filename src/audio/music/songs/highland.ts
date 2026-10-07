// Galecrest (`highland`): a wind-element cliff plateau, where winged messengers fly back and forth between the floating stones.
// D Mixolydian (C natural), 4/4, 104 BPM. The picture is wind and flight: underneath, a sixteenth-note reel figure keeps running (the wind),
// while the melody above flies on long notes (wings spread, gliding); the two differ greatly in speed, and the feeling of flight lies in that gap.
// The wind comes first on entry: a strong wind rises at once, the ocarina's pure tone slowly slides (the howl of wind through rock crevices), and the drone and dulcimer only enter in bar two.
// A bagpipe-style drone (the open fifth D and A) pads the A section throughout, and the harmony moves between D and C (I and bVII), which is the sound of the highland.
// Theme motif: a dotted leap (D5 E5) followed by a long note hanging in the air (A5), once more a leap to C6 (the signature note of bVII), and in the second phrase a leap to D6, E6 before landing.
// The reel figure is an arpeggio along the mode (root, fifth, octave, tenth, ninth), so over the D chord it carries C natural, and over the C chord it carries B.
// A: the pan flute sings for 8 bars over the drone, the dulcimer runs the reel figure, the harp sweeps upward at the start of phrases (a gust of wind), and the strings swell up every two bars.
// B: the drone stops, the strings take over the melody toward C major (bVII) and G, the reel figure switches to spiccato strings an octave lower; the pan flute answers within the strings' long notes.
// C: only wind, the wind's howl and a solo dulcimer (a breathing section), the dulcimer using tremolo in place of long notes; in the last two bars the drone and reel figure return, and a reversed cymbal sucks into A'.
// A': everyone. The pan flute's second phrase flies higher and lands on D6, then adds a four-bar gliding tail, stopping on the C chord (bVII), leading back to the opening D.

import { degree, grid, holdRoots, mel, midi, pad, prog, progLen, rest, seq, tr, vel, type Chd, type Ev, type Part, type SongDef } from './_kit.ts';

const R = (n: number) => rest(n);
/** Merge adjacent identical chords into one long chord (for the string pad and bass) */
const slow = (h: string) => h.split('|').map((s) => s.trim()).map((c, i, a) => (i > 0 && c === a[i - 1] ? '%' : c)).join(' | ');
/** One long root note per chord (placed in the octave counted from lo) */
const roots = (p: Chd[], lo: number, v = 0.78): Part => ({ ev: p.map((c) => ({ t: c.t, d: c.d, m: [lo + ((c.bass - (lo % 12) + 12) % 12)], v })), len: progLen(p) });
/** Harp sweep upward: a run of sixteenth notes, the last note left ringing, rest the rest of the time */
const sweep = (notes: string, bars: number): Part => {
  const ns = notes.split(' ');
  return mel(ns.map((n, i) => `${n}:${i === ns.length - 1 ? 16 * bars - (ns.length - 1) : 1}`).join(' '));
};
/** Drum notation: 16 characters per bar */
const g = (...bars: string[]) => grid(bars.join(''));
const E = '................';

// ── Reel figure: sixteenth notes, the numbers are mode degrees counted up from the chord root (0 root, 4 fifth, 7 octave, 8 ninth, 9 tenth, 6 seventh)
const REEL = [0, 4, 7, 4, 9, 4, 7, 4, 8, 4, 7, 4, 9, 7, 6, 4];
/** Each chord root's degree in D Mixolydian, so that the base of each chord's figure falls within G3-E4 */
const ROOT: Record<string, number> = { D: 0, Em: 1, C: -1, G: -4, Am: -3 };
const D4 = midi('D4');
function reel(h: string, v = 0.78): Part {
  const p = prog(h);
  const ev: Ev[] = [];
  for (const c of p) {
    const r = ROOT[c.sym];
    if (r === undefined) throw new Error(`The reel figure has no such chord: ${c.sym}`);
    for (let s = 0; s < c.d; s++) {
      const acc = s % 4 === 0 ? 1.12 : s % 2 ? 0.78 : 0.92;
      ev.push({ t: c.t + s, d: 1, m: [degree(D4, 'mixolydian', r + REEL[s % 16])], v: Math.min(1, v * acc) });
    }
  }
  return { ev, len: progLen(p) };
}

// ── Harmony (8 bars each for A, B, C; A' 8 bars plus a 4-bar tail)
const hA = 'D | D | C | C | D | D | G C | D';
const hB = 'C | G | Am | Em | C | G | Am | C';
const hA2 = 'D | D | C | C | D | D | G C | D | C | C | G | C';

// ── A: pan flute theme. A dotted leap, long notes hanging in the air; the question stops on the G5 of the C chord, the answer lands on D5
const A_MEL = [
  'D5:3 E5:1 A5:12 | B5:3 A5:1 F#5:4 A5:8 | E5:3 G5:1 C6:12 | D6:3 C6:1 A5:4 G5:8 |',
  'D5:3 E5:1 A5:4 D6:8 | E6:6 D6:2 C6:4 A5:4 | B5:6 A5:2 G5:4 E5:4 | D5:12 r:4',
].join(' ');

// ── A': the second phrase flies higher and lands on D6; the four-bar tail glides in the air
const A2_MEL = [
  'D5:3 E5:1 A5:12 | B5:3 A5:1 F#5:4 A5:8 | E5:3 G5:1 C6:12 | D6:3 C6:1 A5:4 G5:8 |',
  'D5:3 E5:1 A5:4 D6:8 | E6:3 F#6:1 E6:4 D6:4 A5:4 | D6:6 B5:2 C6:4 E6:4 | D6:12 r:4 |',
  'E6:16 | D6:8 C6:8 | B5:16 | C6:6 G5:2 E5:8',
].join(' ');

// ── B: the strings' soaring melody (arpeggios take off upward, the second half of each bar hangs up high), the pan flute answers within the long notes
const B_STR = [
  'G4:3 C5:1 E5:4 G5:8 | D5:3 G5:1 B5:4 D6:8 | C6:6 B5:2 A5:8 | B5:6 A5:2 G5:8 |',
  'G4:3 C5:1 E5:4 C6:8 | D5:3 G5:1 B5:4 E6:8 | E6:6 D6:2 C6:4 A5:4 | G5:12 r:4',
].join(' ');
const B_FLUTE = 'R | r:8 G5:2 A5:2 B5:4 | R | r:8 E6:2 D6:2 B5:4 | R | r:8 A5:2 B5:2 G5:4 | R | r:8 E6:2 D6:2 C6:4';

// ── A' string counterpoint: in the middle register under the pan flute
const A2_CTR = [
  'F#4:16 | A4:8 D5:8 | G4:16 | E4:8 G4:8 |',
  'A4:16 | F#4:8 A4:8 | D5:8 E5:8 | D5:8 F#5:8 |',
  'G5:16 | E5:8 G5:8 | D5:16 | E5:8 C5:8',
].join(' ');

// ── C: dulcimer solo (a breathing section, harmony D D C C D Am G C). Tremolo in place of long notes, the theme's leap slowed down and broken apart
const C_SOLO = [
  'D5:2 A5:2 (D6:1 ?D6:1)*6 | C6:1 D6:1 C6:2 A5:4 B5:2 A5:2 F#5:4 | E5:2 G5:2 (C6:1 ?C6:1)*6 | B5:1 C6:1 B5:2 G5:4 A5:2 G5:2 E5:4 |',
  'D5:2 A5:2 D6:4 (E6:1 ?E6:1)*4 | C6:2 B5:2 A5:4 (E5:1 ?E5:1)*2 r:4 | D5:2 G5:2 B5:4 (A5:1 ?A5:1)*2 G5:4 | E5:2 G5:2 C6:4 B5:2 A5:2 G5:2 E5:2',
].join(' ');

// ── Harp: gusts of wind (sweeping upward), changing with the chords
const SW_D = 'A3 D4 F#4 A4 D5 F#5 A5 D6';
const SW_C = 'G3 C4 E4 G4 C5 E5 G5 C6';
const SW_G = 'G3 B3 D4 G4 B4 D5 G5 B5';
const HARP = seq(
  // A: D D C C D D (G C) D
  sweep(SW_D, 2), sweep(SW_C, 2), sweep(SW_D, 2), R(1), sweep(SW_D, 1),
  // B: C G Am Em C G Am C
  sweep(SW_C, 1), sweep(SW_G, 1), R(2), sweep(SW_C, 1), sweep(SW_G, 1), R(2),
  // C: rest
  R(8),
  // A': D D C C D D (G C) D C C G C
  sweep(SW_D, 2), sweep(SW_C, 2), sweep(SW_D, 2), R(1), sweep(SW_D, 1), sweep(SW_C, 2), sweep(SW_G, 1), sweep(SW_C, 1),
);

/** Wind howl: the ocarina is almost a pure tone, sliding slowly, no vibrato, with more breath noise, sounding like wind through rock crevices */
const HOWL = { glide: 0.9, vib: 0, attack: 0.9, release: 1.5, breath: 3 };
/** The wind howls in the loop: three gusts in the C section, and one in the tail's last two bars (leading back to the opening) */
const HOWL_LOOP = seq(R(16), mel('A4:6> E5:12> D5:6> A5:8'), R(1), mel('D5:6> B5:10> A5:8> E5:8'), R(1), mel('A4:6> D5:10'), R(1), R(8), R(2), mel('D5:6> B5:10> G5:16'));

const song: SongDef = {
  title: '蒼嘯高原',
  mood: '風屬性野外。D 混合利底亞、4/4、104 BPM：一進場就是風聲與風嘯，揚琴的十六分音符里爾音型一直跑，排笛與弦樂在上面用長音飛；中段只剩風與揚琴。',
  bpm: 104,
  space: { size: 2.4, damp: 0.22, pre: 0.03, er: 0.28, mix: 0.9 },
  delay: { steps: 6, fb: 0.32, tone: 3600, mix: 0.5 },
  gain: 1,
  intro: [
    // The first second is wind: strong wind and howl; in the second bar the drone and reel figure enter
    { name: '風', inst: 'wind', part: mel('!C4:32'), gain: 1.8, rev: 0.15, opts: { attack: 0.5, release: 2 } },
    { name: '風嘯', inst: 'ocarina', part: mel('D5:6> A5:10> G5:6> D6:10'), gain: 0.6, pan: -0.35, rev: 0.7, dly: 0.3, opts: HOWL },
    { name: '持續音', inst: 'drone', part: mel('r:12 D3:20'), gain: 0.8, rev: 0.35, opts: { attack: 1.5 } },
    { name: '揚琴', inst: 'dulcimer', part: seq(R(1), vel(reel('D'), 0.55)), gain: 0.6, pan: -0.3, rev: 0.35 },
    { name: '反向鈸', inst: 'swell', part: mel('r:20.9 C4:11.1'), gain: 0.3, rev: 0.3 },
    { name: '鈴鼓', inst: 'tamb', part: g(E, 'o.o.o.o.o.o.oooo'), gain: 0.5, pan: 0.3, rev: 0.2 },
  ],
  tracks: [
    // Melody
    { name: '排笛', inst: 'panflute', part: seq(A_MEL, B_FLUTE, R(8), A2_MEL), gain: 1, pan: 0.12, rev: 0.4, dly: 0.14, opts: { glide: 0.14 } },
    { name: '弦樂旋律', inst: 'strings', part: seq(R(8), B_STR, R(8), vel(mel(A2_CTR), 0.62)), gain: 0.85, pan: -0.25, rev: 0.45, opts: { attack: 0.18, release: 0.5, glide: 0.12 } },
    { name: '揚琴獨奏', inst: 'dulcimer', part: seq(R(16), C_SOLO, R(12)), gain: 2, pan: -0.1, rev: 0.4, dly: 0.35 },
    // Reel figure
    { name: '揚琴里爾', inst: 'dulcimer', part: seq(reel(hA), R(8), R(7), vel(reel('C'), 0.6), reel(hA2)), gain: 0.8, pan: -0.35, rev: 0.3 },
    { name: '斷弓里爾', inst: 'spicc', part: seq(R(8), tr(reel(hB, 0.8), -12), R(8), tr(reel(hA2, 0.7), -12)), gain: 0.6, pan: 0.3, rev: 0.3 },
    { name: '豎琴', inst: 'harp', part: HARP, gain: 0.5, pan: 0.38, rev: 0.45, dly: 0.12 },
    // Pad and bass
    {
      name: '弦樂墊',
      inst: 'strPad',
      part: seq(vel(pad(prog(slow(hA)), { center: 64 }), 0.5), vel(pad(prog(slow(hB)), { center: 62 }), 0.45), R(6), vel(pad(prog('G | C'), { center: 64 }), 0.42), vel(pad(prog(slow(hA2)), { center: 64 }), 0.55)),
      gain: 0.6,
      rev: 0.55,
      opts: { attack: 1.4, release: 1.4 },
    },
    { name: '持續音', inst: 'drone', part: seq(mel('D3:128'), R(8), R(6), mel('D3:224')), gain: 0.8, rev: 0.35, opts: { attack: 1.2, release: 1.2 } },
    { name: '低音大提琴', inst: 'contrabass', part: seq(roots(prog(slow(hA)), 36, 0.6), roots(prog(slow(hB)), 36, 0.7), R(8), roots(prog(slow(hA2)), 36, 0.68)), gain: 0.65, rev: 0.3, opts: { attack: 0.4, release: 0.8 } },
    // Cello section: long open fifths, the highland's floor must be wide
    { name: '大提琴聲部', inst: 'celli', part: seq(holdRoots(prog(slow(hA)), 45, true, 0.5), holdRoots(prog(slow(hB)), 45, true, 0.6), R(8), holdRoots(prog(slow(hA2)), 45, true, 0.6)), gain: 0.38, pan: -0.15, rev: 0.4, opts: { attack: 0.4, release: 0.8 } },
    // Percussion
    {
      name: '鈴鼓',
      inst: 'tamb',
      part: seq(
        g(...Array(7).fill('X...o.o.x...o.o.'), 'X...o.o.x.o.oooo'),
        g(...Array(7).fill('X.o.o.o.x.o.o.o.'), 'X...o...x.......'),
        g(...Array(7).fill(E), 'o.o.o.o.o.o.oooo'),
        g(...Array(11).fill('X.o.o.o.x.o.o.o.'), 'X.o.o.o.x.o.oooo'),
      ),
      gain: 0.9,
      pan: 0.3,
      rev: 0.2,
    },
    {
      name: '軍鼓',
      inst: 'field',
      part: seq(
        g(E, E, E, '............oooo', E, E, E, '..........oooooo'),
        g(E, E, E, '............oooo', ...Array(4).fill(E)),
        g(...Array(6).fill(E), 'o...o...o.o.o.o.', 'ooooooooxxxxxxxx'),
        g(E, E, E, '............oooo', E, E, E, '..........oooooo', E, E, E, '............oooo'),
      ),
      gain: 0.75,
      pan: -0.12,
      rev: 0.25,
    },
    { name: '反向鈸', inst: 'swell', part: seq(R(23), mel('r:4.9 C4:11.1'), R(12)), gain: 0.3, rev: 0.3 },
    // Ambience
    { name: '風嘯', inst: 'ocarina', part: HOWL_LOOP, gain: 0.7, pan: -0.4, rev: 0.7, dly: 0.3, opts: HOWL },
    { name: '風', inst: 'wind', part: mel('C4:128 C4:128 !C4:128 C4:192'), gain: 1.8, rev: 0.12, opts: { attack: 2, release: 2 } },
  ],
};

export default song;
