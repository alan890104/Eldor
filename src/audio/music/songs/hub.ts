// "Astralgate Plaza", the main town's song: the party, codex, quests and battle results all use this one and the player stays a long time, so it is written as a small waltz that is neither noisy nor tiresome.
// G major, 3/4, 132 BPM. The pizzicato bass plays "oom" on beat one, the classical guitar plays "pah, pah" on beats two and three, and the accordion (musette) sings the melody, like a tavern at the edge of the plaza.
// The core motif is the rising arpeggio B D G, followed by the waltz's "long, short, long" swinging figure (F# E D, C B A, B A G).
// A section (accordion, 16 bars, bar 10 borrows Cm6 for a touch of nostalgia) -> B section turns to E minor, the clarinet takes the melody and quotes the leitmotif:
// the minor sixth B4 -> G5, then F# E F#; bar 3 directly sings the main theme's original A4 F#5 E5 D#5 E5; in the second half the accordion accompanies a third below,
// and at the end, on D7, the leitmotif is sung once as is (A4 F#5 E5 D5 E5), and the voices naturally lead back to the B4 of A.
// A' is the accordion with ornaments, the glockenspiel flashing an octave higher along with it, and the turnaround uses a chromatic descent E -> Eb -> D (C, Cm6, G) back to the beginning.

import { arp, bassline, grid, holdRoots, mel, prog, rest, seq, stack, strum, type SongDef } from './_kit.ts';

const M = 12;
const m = (s: string) => mel(s, M);
const R = (n: number) => rest(n, M);
const p = (s: string) => prog(s, M);

// ── Harmony
const cA = 'G | D7 | Am7 | D7 | G | Em | Am7 D7 | G | C | Cm6 | G/D | E7 | Am7 | D7 | G | B7';
const cB = 'Em | Em | B7 | B7:4 Em:8 | C | G | F#m7b5 | B7 | Em | Em | Am | B7 | C | Am7 | D7 | D7';
const cA2 = 'G | D7 | Am7 | D7 | G | Em | Am7 D7 | G | C | Cm6 | G/D | E7 | Am7 | D7 | G | G';
const cT = 'C | Cm6 | G | D7';
const pA = p(cA);
const pB = p(cB);
const pA2 = p(cA2);
const pT = p(cT);

// ── Accordion melody
const ACC_A = m(`
  B4:4 D5:4 G5:4 | F#5:6 E5:2 D5:4 | C5:6 B4:2 A4:4 | D5:8 r:4 |
  B4:4 D5:4 G5:4 | B5:6 A5:2 G5:4 | A5:6 G5:2 F#5:4 | G5:8 r:4 |
  G5:2 A5:2 G5:2 E5:2 C5:4 | G5:2 A5:2 G5:2 Eb5:2 C5:4 | B4:4 D5:4 G5:4 | G#5:6 F#5:2 E5:4 |
  C6:6 B5:2 A5:4 | F#5:4 G5:4 A5:4 | G5:12 | r:4 D#5:4 F#5:4 |`);
/** Second half of the B section: the accordion accompanies a third below the clarinet, and the final C5 resolves to the B4 at the start of the A section */
const ACC_B = seq(R(8), m(`
  G4:8 B4:4 | B4:4 A4:4 G4:4 | A4:4 E5:8 | D#5:8 B4:4 |
  E5:6 D5:2 C5:4 | C5:6 B4:2 A4:4 | F#4:4 D5:6 C5:2 | B4:4 C5:8 |`));
/** A': a variation with passing notes and neighbor tones added */
const ACC_A2 = m(`
  B4:2 C5:2 D5:4 G5:4 | A5:4 F#5:2 E5:2 D5:4 | C5:4 E5:2 C5:2 A4:4 | D5:8 r:4 |
  B4:2 C5:2 D5:4 G5:4 | B5:4 C6:2 B5:2 G5:4 | C6:4 A5:2 G5:2 F#5:4 | G5:8 r:4 |
  G5:2 A5:2 G5:2 E5:2 C5:2 E5:2 | G5:2 A5:2 G5:2 Eb5:2 C5:2 Eb5:2 | D5:4 G5:4 B5:4 | D6:6 B5:2 G#5:4 |
  C6:6 B5:2 A5:4 | F#5:6 E5:2 F#5:4 | G5:12 | r:12 |`);
/** Turnaround: a chromatic descent E -> Eb -> D, ending with a run of eighth notes that lands on the B4 at the start */
const ACC_T = m('E5:12 | Eb5:12 | D5:4 G5:4 B5:4 | A5:2 G5:2 F#5:2 E5:2 D5:2 C5:2 |');

// ── Clarinet: the fill phrases and counterpoint of the A section, the main melody of the B section (the leitmotif)
const CLA_A = m(`
  R | R | R | r:6 F#4:2 A4:2 C5:2 |
  R | R | R | r:6 B4:2 A4:2 F#4:2 |
  E4:8 G4:4 | Eb4:8 G4:4 | D4:4 G4:4 B4:4 | E5:6 D5:2 B4:4 |
  A4:6 G4:2 C5:4 | A4:4 B4:4 C5:4 | B4:12 | R |`);
const CLA_B = m(`
  B4:4 G5:6 F#5:2 | E5:4 F#5:8 | A4:4 F#5:6 E5:2 | D#5:4 E5:8 |
  E5:4 C6:6 B5:2 | A5:4 B5:8 | A5:6 G5:2 F#5:2 E5:2 | D#5:8 r:4 |
  B4:4 G5:6 F#5:2 | E5:4 F#5:2 G5:2 A5:4 | C6:4 B5:4 A5:4 | B5:6 A5:2 F#5:4 |
  G5:6 F#5:2 E5:4 | E5:6 D5:2 C5:4 | A4:4 F#5:6 E5:2 | D5:4 E5:8 |`);
const CLA_A2 = m(`
  R | R | R | r:6 F#4:2 A4:2 C5:2 |
  R | R | R | r:6 B4:2 A4:2 F#4:2 |
  R | R | R | R |
  A4:6 G4:2 C5:4 | A4:4 B4:4 C5:4 | B4:12 | R |`);
const CLA_T = m('C5:12 | C5:12 | B4:12 | C5:6 A4:6 |');

// ── Glockenspiel: in the A section only a touch at the ends of phrases; in A' it flashes along with the accordion an octave higher
const GLK_A = m(`
  R | R | R | r:8 F#6:4 |
  R | R | R | r:8 B6:4 |
  R | R | R | R |
  R | R | r:4 D6:4 G6:4 | R |`);
const GLK_A2 = m(`
  R | R | R | r:4 F#6:2 A6:2 C7:4 |
  R | R | R | r:4 B6:2 A6:2 G6:4 |
  G6:2 A6:2 G6:2 E6:2 C6:4 | G6:2 A6:2 G6:2 Eb6:2 C6:4 | D6:4 G6:4 B6:4 | R |
  R | R | r:4 D6:4 G6:4 | B6:4 A6:4 G6:4 |`);
const GLK_T = m('r:4 G6:4 E6:4 | r:4 G6:4 Eb6:4 | R | R |');

// ── Accompaniment: oom, pah, pah. In the B section the guitar switches to arpeggios, and beats two and three go to the woodblock
const OOM = 'x-----......';
const PAH = '....x...o...';
const GTR = seq(
  strum(pA, PAH, { center: 57, size: 4, spread: 0.012 }),
  arp(pB, '0 1 2 3 2 1', { rate: 2, center: 58 }),
  strum(pA2, PAH, { center: 57, size: 4, spread: 0.012 }),
  strum(pT, PAH, { center: 57, size: 4, spread: 0.012 }),
);
const BASS = seq(bassline(pA, OOM, '1'), bassline(pB, OOM, '1'), bassline(pA2, OOM, '1 5'), bassline(pT, OOM, '1'));
/** Cello section: long open fifths on the chord bass, very light, only to give the waltz a woody thickness underneath */
const CELLI = seq(holdRoots(pA, 45, true, 0.5), holdRoots(pB, 45, true, 0.62), holdRoots(pA2, 45, true, 0.55), holdRoots(pT, 45, true, 0.5));

// ── Light percussion: in the A section one tambourine hit every two bars, in A' it shakes lightly along with the guitar; in the B section the woodblock goes "tick, tock"
const TAMB = seq(
  grid('x.......................'.repeat(8)),
  R(16),
  grid(('x...o...o...' + '....o...o...'.repeat(3)).repeat(4)),
  grid('x...........' + '............'.repeat(2) + 'o.o.o.o.x.x.'),
);
const WOOD = seq(R(16), stack(grid('....x.......'.repeat(16), 1, 79), grid('........o...'.repeat(16), 1, 74)), R(20));

const song: SongDef = {
  title: '星門廣場',
  mood: '主城。G 大調的小圓舞曲：手風琴唱旋律，吉他與低音撥奏打「嗯、恰、恰」，中段單簧管在 E 小調唱起主導動機。',
  bpm: 132,
  meter: M,
  swing: 0.05,
  gain: 1.22,
  space: { size: 1.2, damp: 0.5, pre: 0.012, er: 0.45, mix: 0.8 },
  intro: [
    { name: '吉他', inst: 'nylon', part: strum(p('G | D7'), PAH, { center: 57, size: 4, spread: 0.012 }), gain: 0.55, pan: -0.3, rev: 0.3 },
    { name: '低音撥奏', inst: 'pizzBass', part: bassline(p('G | D7'), OOM, '1'), gain: 0.8, rev: 0.15 },
    { name: '鐘琴', inst: 'glock', part: m('r:8 D6:4 | r:8 A6:4 |'), gain: 0.4, pan: 0.35, rev: 0.4 },
  ],
  tracks: [
    { name: '手風琴', inst: 'accordion', part: seq(ACC_A, ACC_B, ACC_A2, ACC_T), gain: 1.0, pan: -0.08, rev: 0.32, opts: { musette: 10 } },
    { name: '單簧管', inst: 'clarinet', part: seq(CLA_A, CLA_B, CLA_A2, CLA_T), gain: 0.75, pan: 0.25, rev: 0.35 },
    { name: '鐘琴', inst: 'glock', part: seq(GLK_A, R(16), GLK_A2, GLK_T), gain: 0.55, pan: 0.35, rev: 0.4 },
    { name: '吉他', inst: 'nylon', part: GTR, gain: 0.55, pan: -0.3, rev: 0.3 },
    { name: '低音撥奏', inst: 'pizzBass', part: BASS, gain: 0.7, rev: 0.15 },
    { name: '大提琴聲部', inst: 'celli', part: CELLI, gain: 0.32, pan: -0.15, rev: 0.35, opts: { attack: 0.18, release: 0.5 } },
    { name: '鈴鼓', inst: 'tamb', part: TAMB, gain: 0.9, pan: 0.2, rev: 0.2 },
    { name: '木魚', inst: 'woodblock', part: WOOD, gain: 0.35, pan: -0.2, rev: 0.2 },
  ],
};

export default song;
