// "Arena": the arena's ranked battles, duels against famous opponents from every region, with the stands full of spectators.
// Concept: a bright epic. C major, often borrowing the bVII of Mixolydian (the Bb chord) as a signature, a 140 BPM entrance march.
// The core motif is the fanfare-like "triplet repeated note + upward leap of a fourth" (G G G -> C), and the snare's triplet grace notes follow it.
// Sections: intro (church bells, sustained horn, timpani roll, the trumpet plays the motif once first over a G chord)
// -> A trumpet theme, the glockenspiel layered an octave above, horns on long chords, the tuba walking the march's bass
// -> A' the theme goes to the horn (an octave lower), the trumpet above plays long notes and answers in triplets
// -> B turns to A minor, the tension of winning and losing: spiccato sixteenth notes, timpani eighth notes, snare rolls, the horn sings the minor version of the motif, trumpet long notes pushing upward
// -> C stands: the crowd's rhythm of stomp, stomp, clap; the trumpet shouts one phrase and the horn answers with one, and finally the two rise together in sixths
// -> D climax: the choir sings the enlarged theme in unison, trumpets and horns at full, the bells ring once more, stopping on a Bb chord that leads back to the opening C.

import { arp, bassline, grid, holdRoots, mel, pad, prog, rest, seq, stack, tr, vel, type SongDef } from './_kit.ts';

// ── Harmony (A A' B C D, 40 bars in all)
const cA = 'C | Bb | F | C | Am | Bb | F G | C';
const cB = 'Am | F | Dm | E | Am | F | Bb | G';
const cC = 'C | Bb | F | C | C | Bb | F | G';
const cD = 'C | Bb | F | C | Am | Bb | F | Bb';
const pA = prog(cA);
const pB = prog(cB);
const pC = prog(cC);
const pD = prog(cD);

// ── Theme (trumpet): the triplet repeated-note fanfare + upward leap of a fourth
const TH_HEAD =
  'G4:4/3 G4 G4 !C5:6 D5:2 E5:4 | !F5:6 E5:2 D5:4 Bb4:4 | A4:4/3 A4 A4 !C5:6 F5:2 A5:4 | G5:12 r:4 | ' +
  'E5:4/3 E5 E5 !A5:6 G5:2 E5:4 | !F5:6 G5:2 F5:4 D5:4 | ';
const TH = TH_HEAD + 'C5:4 D5:2 E5:2 F5:4 D5:4 | C5:8 r:8';
/** D section: in the last bar triplets climb up on Bb, leading back to the beginning */
const TH_D = TH_HEAD + 'C5:4 D5:2 E5:2 F5:4 A5:4 | Bb4:4/3 Bb4 Bb4 D5 D5 D5 F5 F5 F5 !Bb5:4';
/** A': while the horn sings the theme, the trumpet above plays long notes and answers with triplets where the theme pauses */
const TR_A2 = 'E5:16 | D5:16 | C5:16 | r:4 C5:4/3 C5 C5 E5:4 G5:4 | C5:16 | D5:16 | C5:8 B4:8 | r:8 G4:4/3 G4 G4 C5:4';
/** B: the trumpet's long notes push upward all the way */
const TR_B = 'R | R | R | R | E5:16 | F5:16 | F5:16 | G5:8 B5:8';
/** C: the trumpet shouts, the horn answers (the last two bars walk in sixths together) */
const TR_C = 'G4:4/3 G4 G4 !C5:4 r:8 | R | A4:4/3 A4 A4 !C5:4 F5:4 A5:4 | R | G4:4/3 G4 G4 !C5:4 E5:4 G5:4 | R | A5:8 G5:4 F5:4 | G5:4/3 G5 G5 G5 G5 G5 !B5:8';
const HN_C = 'R | F3:4/3 F3 F3 !Bb3:4 r:8 | R | G3:4/3 G3 G3 !C4:4 E4:4 G4:4 | R | F4:4/3 F4 F4 !Bb4:4 D5:4 F5:4 | C5:8 Bb4:4 A4:4 | B4:4/3 B4 B4 B4 B4 B4 !D5:8';
/** B: the horn sings the minor version of the motif */
const HN_B =
  'E4:4/3 E4 E4 !A4:6 C5:2 B4:4 | A4:6 C5:2 A4:4 F4:4 | D4:4/3 D4 D4 !F4:6 A4:2 D5:4 | C5:6 B4:2 G#4:8 | ' +
  'E4:4/3 E4 E4 !A4:6 C5:2 E5:4 | F5:6 E5:2 C5:4 A4:4 | D5:4/3 D5 D5 !F5:6 D5:2 Bb4:4 | B4:8 D5:4 F5:4';
/** D: the choir sings the enlarged theme in unison (no triplets, long notes sing the skeleton), an octave above and below */
const CHOIR_D = 'C5:8 E5:8 | F5:8 D5:8 | C5:4 F5:4 A5:8 | G5:16 | A5:8 G5:4 E5:4 | F5:8 D5:8 | C5:4 D5:4 F5:8 | D5:16';
/** C: the glockenspiel flashes in the gaps of the stands section */
const GL_C = 'r:8 G6:2 C7:2 E7:4 | R | r:8 A6:2 C7:2 F7:4 | R | r:8 G6:2 C7:2 E7:4 | R | r:8 A6:2 C7:2 F7:4 | r:8 B6:2 D7:2 G7:4';

// ── Snare: triplet ornament on the first beat (echoing the theme)
const MARCH = '!C4:4/3 ?C4 ?C4 C4:2 ?C4:2 !C4:2 ?C4:1 C4:1 C4:2 ?C4:1 C4:1';
const MARCH_FILL = '!C4:4/3 ?C4 ?C4 C4:2 ?C4:2 C4:1 C4:1 C4:1 C4:1 !C4:1 C4:1 C4:1 !C4:1';
const march = (n: number) => seq(...Array.from({ length: n }, (_, i) => mel(i % 4 === 3 ? MARCH_FILL : MARCH)));
const g = (s: string) => grid(s.replace(/\s/g, ''));
const R16 = '................';
const r = (s: string, n: number) => s.repeat(n);
const field = seq(march(8), vel(march(8), 0.8), g(r('XoooxoooXoooxoox', 7) + 'ooooxxxxXXXXXXXX'), g(r('o.o.x.o.o.o.x.o.', 7) + 'oooooooxxxxxXXXX'), march(8));
/** The stands' rhythm in the C section: stomp, stomp, clap */
const stomp = g(r(R16, 24) + r('X.X.....X.X.....', 7) + 'X.X.....X.X.X.X.' + r(R16, 8));
const clap = g(r(R16, 24) + r('....X.......X...', 7) + '....X.......XXXX' + r(R16, 8));
const cr = (bars: number, every: number, strong = true) => Array.from({ length: bars }, (_, i) => (i % every === 0 ? (strong ? 'X' : 'x') : '.') + '.'.repeat(15)).join('');
const crash = g(cr(8, 8) + cr(8, 8, false) + cr(8, 4) + cr(8, 8) + cr(8, 4));
/** Reversed cymbal: about 1.6 seconds before the D section */
const swell = g(r(R16, 31) + '.x..............' + r(R16, 8));

// ── Timpani and tuba
const timp = seq(
  bassline(pA, 'X.......x.......', '1', { base: 43 }),
  bassline(pA, 'X.......x.......', '1', { base: 43 }),
  bassline(pB, 'X.x.x.x.X.x.x.x.', '1 1 5 1', { base: 43 }),
  bassline(prog('C | Bb | F | C | C | Bb | F'), 'X...............', '1', { base: 43 }),
  '?G2:1*8 G2:1*4 !G2:1*4',
  bassline(pD, 'X.......X...x.x.', '1 1 5 1', { base: 43 }),
);
const tuba = seq(
  bassline(pA, 'X---....x---....', '1 5', { base: 36 }),
  bassline(pA, 'X---....x---....', '1 5', { base: 36 }),
  bassline(pB, 'X-------X-------', '1', { base: 36 }),
  bassline(pC, 'X---....X---....', '1 5', { base: 36 }),
  bassline(pD, 'X---..x.X---x...', '1 5 1 5', { base: 36 }),
);

/** Cello section: long open fifths under the tuba, giving the march its thickness */
const celli = seq(holdRoots(pA, 45, true, 0.55), holdRoots(pA, 45, true, 0.65), holdRoots(pB, 45, true, 0.7), holdRoots(pC, 45, true, 0.6), holdRoots(pD, 45, true, 0.8));

// ── Spiccato
const spA = arp(pA, '0 1 2 1 0 1 2 1', { rate: 2, center: 62 });
const spB = bassline(pB, 'xxxxxxxxxxxxxxxx', '1 1 8 1 5 1 8 1 1 1 8 1 5 1 8 5', { base: 45 });
const spC = arp(pC, '. 0 . 1 . 2 . 1', { rate: 2, center: 67 });
const spD = arp(pD, '0 1 2 3 2 1 2 3', { rate: 2, center: 62 });

// ── Intro: 4 bars (C | C | Bb | G)
const intro: SongDef['intro'] = [
  { name: '教堂鐘', inst: 'bell', part: 'C5:4 G4:4 Bb4:4 C4:4 | C5:4 G4:4 Bb4:4 C4:4 | R | R', gain: 1.4, pan: 0.1, rev: 0.55 },
  { name: '法國號', inst: 'horn', part: 'C3+G3+E4:32 Bb2+F3+D4:16 G2+D3+B3:16', gain: 0.6, pan: -0.2, rev: 0.5, opts: { attack: 0.3 } },
  { name: '小號', inst: 'trumpets', part: 'R | R | R | D5:4/3 D5 D5 !G5:6 F5:2 D5:4', gain: 0.9, pan: 0.1, rev: 0.4 },
  { name: '定音鼓', inst: 'timpani', part: '!C3:16 | r:12 G2:4 | R | ?G2:1*8 G2:1*4 !G2:1*4', gain: 0.6, rev: 0.35 },
  { name: '軍鼓', inst: 'field', part: g(r(R16, 3) + 'oooooooxxxxxXXXX'), gain: 1.3, rev: 0.3 },
  { name: '反向鈸', inst: 'swell', part: g(r(R16, 3) + '.x..............'), gain: 1, rev: 0.3 },
];

const song: SongDef = {
  title: '競技場',
  mood: '光明的競技場：C 大調帶 Bb 和弦的進行曲，小號號角主題、法國號、軍鼓與定音鼓，看台跺腳拍手，高潮時合唱齊唱。',
  bpm: 140,
  space: { size: 2.0, damp: 0.35, pre: 0.03, er: 0.4, mix: 0.9 },
  gain: 1,
  intro,
  tracks: [
    { name: '小號', inst: 'trumpets', part: seq(TH, TR_A2, TR_B, TR_C, TH_D), gain: 0.9, pan: 0.12, rev: 0.4, opts: { release: 0.14 } },
    { name: '法國號主題', inst: 'horns', part: seq(rest(8), tr(mel(TH), -12), HN_B, HN_C, rest(8)), gain: 0.8, pan: -0.2, rev: 0.45, opts: { release: 0.14 } },
    { name: '法國號和弦', inst: 'horn', part: seq(pad(pA, { center: 55, size: 3 }), rest(24), pad(pD, { center: 55, size: 3 })), gain: 0.5, pan: -0.3, rev: 0.5, opts: { attack: 0.12, release: 0.3 } },
    { name: '合唱', inst: 'choir', part: seq(rest(32), stack(mel(CHOIR_D), tr(mel(CHOIR_D), -12))), gain: 0.8, rev: 0.55, opts: { release: 0.4 } },
    { name: '鐘琴', inst: 'glock', part: seq(tr(mel(TH), 12), rest(16), GL_C, tr(mel(TH_D), 12)), gain: 0.8, pan: 0.3, rev: 0.45 },
    { name: '斷弓', inst: 'spicc', part: seq(spA, spA, spB, spC, spD), gain: 0.72, pan: 0.3, rev: 0.3 },
    { name: '低音號', inst: 'tuba', part: tuba, gain: 0.8, rev: 0.3, opts: { release: 0.14 } },
    { name: '大提琴聲部', inst: 'celli', part: celli, gain: 0.42, pan: -0.15, rev: 0.4, opts: { attack: 0.08, release: 0.35 } },
    { name: '定音鼓', inst: 'timpani', part: timp, gain: 0.55, rev: 0.35 },
    { name: '軍鼓', inst: 'field', part: field, gain: 1.3, pan: 0.1, rev: 0.3 },
    { name: '跺腳', inst: 'kick', part: stomp, gain: 0.42, rev: 0.4 },
    { name: '拍手', inst: 'clap', part: clap, gain: 2.0, pan: -0.1, rev: 0.45 },
    { name: '鈸', inst: 'crash', part: crash, gain: 1, pan: -0.25, rev: 0.35 },
    { name: '反向鈸', inst: 'swell', part: swell, gain: 1, rev: 0.3 },
    { name: '教堂鐘', inst: 'bell', part: seq(rest(32), 'C4:16', rest(7)), gain: 1.6, pan: 0.1, rev: 0.55 },
  ],
};

export default song;
