// "Pactbearer Duel": the challenge theme of the contractors of each region inside the Seal Tower (apprentice, fisherman, guard, scholar, bard).
// Idea: a friendly match. A Dorian, 156 BPM funk-rock: a syncopated drum kit with snare ghost notes, a fingerstyle bass jumping octaves, spiccato strings running an ostinato,
// brass hits landing on the syncopation points. The core motif is the anticipated "E -> G -> A" (a minor third + a whole tone upward, like raising the chin in a taunt),
// paired with Dorian's signature: the F# in the IV chord, D major.
// Sections: intro (brass 3+3+2 accents and a drum fill) -> A the violin sings the motif -> A' the trumpet cuts in during the violin's gaps
// -> B chorus: the trumpet sings the hook in a 3+3+2 rhythm, string long notes underneath, the violin sings a counterpoint up high
// -> C turns to E Dorian, the violin and trumpet take turns throwing phrases at each other (the trumpet answers back with the motif's inversion), pizzicato runs sixteenth notes, and in the end the two play together
// -> B' full-band chorus, trumpets in unison -> a stop-time hit on E7#9 leads back to the start.

import { bassline, grid, holdRoots, pad, prog, rest, seq, strum, vel, type Chd, type Part, type SongDef } from './_kit.ts';

// ── Harmony (A A B C B', 40 bars in total)
// A: Am7 | D9 | Am7 | D9 | Am7 | D9 | Cmaj7 | D
// B: Cmaj7 | D | Em7 | Am7 | Cmaj7 | D | Esus4 | E7#9 (stop)
// C: Em7 | A9 | Em7 | A9 | Cmaj7 | D | Bm7 (fast run) | E7#9 (stop)
const cA = 'Am7 | D9 | Am7 | D9 | Am7 | D9 | Cmaj7 | D';
/** The seven bars before the stop bar of the B section */
const cB7 = 'Cmaj7 | D | Em7 | Am7 | Cmaj7 | D | Esus4';
/** The six bars before the fast run of the C section */
const cC6 = 'Em7 | A9 | Em7 | A9 | Cmaj7 | D';
const pA = prog(cA);

// ── Main melody: violin
const VA =
  'r:2 E5:1 G5:1 !A5:4 G5:2 E5:2 r:2 D5:2 | E5:2 F#5:6 E5:2 D5:2 r:4 | r:2 E5:1 G5:1 !A5:4 C6:2 B5:2 r:2 A5:2 | B5:3 A5:3 F#5:6 r:4 | ' +
  'r:2 A5:1 C6:1 !D6:4 C6:2 A5:2 r:2 G5:2 | A5:2 F#5:4 E5:2 D5:4 E5:4 | ';
const VA_END1 = 'r:2 E5:1 G5:1 B5:6 A5:2 G5:4 | F#5:6 G5:2 A5:4 r:4';
const VA_END2 = 'r:2 E5:1 G5:1 B5:4 C6:4 D6:4 | E6:6 D6:2 B5:2 A5:2 r:4';
/** First chorus: the first four bars are left to the trumpet, and the last four sing long notes up high */
const VB1 = 'R | R | R | R | E6:16 | F#6:8 E6:8 | E6:16 | !D6:4 r:2 !D6:2 r:8';
/** C section: the violin throws first (the motif moved to E Dorian), and the trumpet answers back; in bar 7 both hold a long note together */
const VC = 'r:2 B5:1 D6:1 !E6:4 D6:2 B5:2 r:2 A5:2 | B5:2 C#6:6 B5:2 A5:2 r:4 | R | R | r:2 G5:1 B5:1 !C6:4 B5:2 G5:2 r:2 E5:2 | R | B5:8 D6:8 | !D6:2 r:4 !D6:2 r:8';
/** The last chorus: the violin sings a counterpoint above the trumpet */
const VB2 = 'E6:8 D6:4 E6:4 | F#6:8 E6:4 D6:4 | B5:8 D6:4 E6:4 | E6:12 r:4 | E6:8 D6:4 E6:4 | F#6:8 A6:4 F#6:4 | E6:16 | !D6:4 r:2 !D6:2 r:2 D6:2 r:4';

// ── Trumpet
/** A': imitates the motif in the gaps at the ends of the violin's phrases */
const TA2 = 'R | r:12 E5:1 G5:1 !A5:2 | R | r:12 F#5:1 G5:1 !A5:2 | R | r:12 E5:1 G5:1 !A5:2 | G4:8 A4:8 | F#4:8 r:4 D5:2 E5:2';
/** Chorus hook: a 3+3+2 syncopation, the motif turned around (G -> E -> G -> A) */
const HOOK =
  '!G5:3 E5:3 G5:2 A5:6 r:2 | !A5:3 F#5:3 A5:2 B5:6 r:2 | !B5:3 G5:3 E5:2 G5:4 B5:2 A5:2 | A5:10 r:2 E5:2 F#5:2 | ' +
  '!G5:3 E5:3 G5:2 A5:6 r:2 | !A5:3 F#5:3 A5:2 C6:6 r:2 | B5:3 A5:3 E5:2 B5:8 | !G#5:4 r:2 !G#5:2 r:2 B5:2 r:4';
/** C section answer-back: the inversion of the motif (E -> D -> B), then moved onto the D chord */
const TC = 'R | R | r:2 E5:1 D5:1 !B4:4 D5:2 E5:2 r:2 G5:2 | F#5:6 E5:2 C#5:2 E5:2 r:4 | R | r:2 F#5:1 E5:1 !D5:4 E5:2 F#5:2 r:2 A5:2 | F#5:8 A5:8 | !G#5:2 r:4 !G#5:2 r:8';

// ── Pizzicato: the sixteenth-note fast run in the C section (filling the gaps between the violin and the trumpet)
const PZ_C = 'R | r:12 E5:1 F#5:1 G5:1 A5:1 | R | r:12 B4:1 C#5:1 D5:1 E5:1 | R | r:12 D5:1 E5:1 F#5:1 A5:1 | B4:1 D5:1 E5:1 F#5:1 A5:1 B5:1 D6:1 E6:1 F#6:1 E6:1 D6:1 B5:1 A5:1 F#5:1 E5:1 D5:1 | !E5:2 r:4 !E5:2 r:8';

// ── Stop bar (E7#9: hits on positions 0, 6 and 10 together, a drum fill on the last beat)
const STOP_BASS = '!E2:3 r:3 !E2:2 r:2 E2:2 r:1 G2:1 G#2:1 B2:1';
const stopStab = strum(prog('E7#9'), 'X.....X...x.....', { center: 64, size: 3, spread: 0.004 });

// ── Bass: fingerstyle octave jumps
const RA = 'X-.x..x-.x.x.xx.';
const bass = (c: string, rh: string, line: string): Part => bassline(prog(c), rh, line, { base: 33 });
const bassA = seq(bass('Am7 | D9 | Am7 | D9 | Am7 | D9', RA, '1 8 1 8 b7 8 5'), bass('Cmaj7', RA, '1 8 1 8 6 8 5'), bass('D', RA, '1 8 1 8 b7 8 5'));
const bassB = seq(bass(cB7, 'X-.x-.x.X-.x-.x.', '1 8 5 1 8 5'), STOP_BASS);
const bassC = seq(bass('Em7 | A9 | Em7 | A9', 'X.xx..x.x.xx..x.', '1 8 8 1 8 1 8 b7'), bass('Cmaj7 | D | Bm7', 'X.xx..x.x.xx..x.', '1 8 8 1 8 1 8 5'), STOP_BASS);
/** Cello voice under the chorus: open-fifth long notes, left out in the stop bars */
const celliB = seq(holdRoots(prog(cB7), 45, true, 0.7), rest(1));

// ── Spiccato ostinato (written with bassline: the scale degrees follow the chords)
const RIFF = (c: string) => bassline(prog(c), 'X.xx..x.x.xx..x.', '1 1 5 8 1 1 5 3', { base: 55 });
const GALLOP = (c: string) => bassline(prog(c), 'X.xxX.x.X.xxX.x.', '8 5 3 8 5 8 5 3 8 5', { base: 55 });
const spA = RIFF(cA);
const spB = seq(GALLOP(cB7), '!E4:2 r:4 !E4:2 r:2 E4:2 r:4');
const spC = seq(RIFF(cC6), 'B3:1 D4:1 E4:1 F#4:1 A4:1 B4:1 D5:1 E5:1 F#5:1 E5:1 D5:1 B4:1 A4:1 F#4:1 E4:1 D4:1', '!E4:2 r:4 !E4:2 r:8');

// ── Brass hits
const stab = (p: Chd[], rh: string) => strum(p, rh, { center: 64, size: 3, spread: 0.004 });
const stA = stab(pA, '..........X..x........x.....X...');
const stB = seq(stab(prog(cB7), 'X..x..x.........'), stopStab);
const stC = seq(stab(prog(cC6), '......X.......x.'), rest(1), stopStab);

// ── String long notes (chorus)
const strB = seq(pad(prog('C | D | Em | Am | C | D | Esus4'), { center: 60, size: 3 }), 'E4+G#4+D5:3 r:13');

// ── Drums
const g = (s: string) => grid(s.replace(/\s/g, ''));
const rep = (s: string, n: number) => s.repeat(n);
// A: syncopated kick, snare on beats two and four with ghost notes, sixteenth-note hi-hat, open hi-hat on the second half of beat four
const KA = 'X.x...x...x..x..';
const SA = '....X..o.o..X..o';
const HA = 'x.xox.x.x.xox...';
const OA = '..............x.';
// Fill in bar 8
const KA8 = 'X.x...x...x.....';
const SA8 = '....X..o.o..XoXX';
// B: the kick follows 3+3+2, open hi-hat on the off-beats
const KB = 'X..x..x.X..x..x.';
const SB = '....X..o....X..o';
const HB = 'x...x...x...x...';
const OB = '..x...x...x...x.';
// Stop bar
const KS = 'X.....X...X.....';
const SS = 'X.....X...X.oxXX';
// C: snare removed, only rim clicks and light hi-hat remain; in bar 7 a four-beat kick + snare crescendo
const KC = 'X.........x.....';
const RC = '....x.......x..o';
const HC = 'x.o.x.o.x.o.x.oo';
const KC7 = 'X...X...X...X...';
const SC7 = 'o.o.o.o.x.x.xxXX';

const kick = g(rep(KA, 7) + KA8 + rep(KA, 7) + KA8 + rep(KB, 7) + KS + rep(KC, 6) + KC7 + KS + rep(KB, 7) + KS);
const snare = g(rep(SA, 7) + SA8 + rep(SA, 7) + SA8 + rep(SB, 7) + SS + rep('................', 6) + SC7 + SS + rep(SB, 7) + SS);
const rim = g(rep('................', 24) + rep(RC, 6) + rep('................', 10));
const hat = g(rep(HA, 16) + rep(HB, 7) + '................' + rep(HC, 7) + '................' + rep(HB, 7) + '................');
const ohat = g(rep(OA, 16) + rep(OB, 7) + '................' + rep('................', 8) + rep(OB, 7) + '................');
const crash = g('X' + '.'.repeat(127) + 'x' + '.'.repeat(127) + ('X' + '.'.repeat(63)) + ('x' + '.'.repeat(63)) + ('X' + '.'.repeat(127)) + ('X' + '.'.repeat(63)) + ('x' + '.'.repeat(63)));

// ── Intro: two bars, brass 3+3+2 accents, a drum fill in the second half of the second bar
const cIntro = prog('Am7 | D9');
const intro: SongDef['intro'] = [
  { name: '銅管重音', inst: 'brassStab', part: stab(cIntro, 'X..x..x.........'), gain: 0.4, pan: 0.15, rev: 0.2 },
  { name: '斷弓', inst: 'spicc', part: 'r:8 A3:1 C4:1 D4:1 E4:1 G4:1 A4:1 C5:1 E5:1 | R', gain: 0.75, pan: -0.3, rev: 0.2 },
  { name: '貝斯', inst: 'bass', part: 'A1:3 A1:3 A2:2 r:8 | D2:3 D2:3 D3:2 r:4 E2:1 G2:1 G#2:1 r:1', gain: 0.68, opts: { release: 0.08 } },
  { name: '大鼓', inst: 'kick', part: g('X..x..x.........' + 'X..x..x.........'), gain: 0.5 },
  { name: '小鼓', inst: 'snare', part: g('................' + '........oxoxXxXX'), gain: 1.4, rev: 0.15 },
  { name: '踩鈸', inst: 'hat', part: g('x.xox.x.x.xox.x.' + 'x.xox.x.........'), gain: 3.5, pan: 0.25 },
  { name: '鈸', inst: 'crash', part: g('X...............'), gain: 1.0, rev: 0.2 },
];

const song: SongDef = {
  title: '締約者對決',
  mood: '自信、好勝又好玩的友誼賽：A 多利安 funk-rock，切分鼓組與指彈貝斯，斷弓弦樂頑固音型，小提琴唱動機，小號吹副歌勾子。',
  bpm: 156,
  swing16: 0.06,
  space: { size: 1.0, damp: 0.45, pre: 0.01, er: 0.35, mix: 0.8 },
  gain: 1,
  intro,
  tracks: [
    { name: '小提琴', inst: 'violin', part: seq(VA + VA_END1, VA + VA_END2, VB1, VC, VB2), gain: 1.65, pan: 0.18, rev: 0.32, opts: { attack: 0.03, vib: 16, release: 0.15 } },
    { name: '小號', inst: 'trumpet', part: seq(rest(8), TA2, HOOK, TC, rest(8)), gain: 1.45, pan: -0.15, rev: 0.3, opts: { release: 0.12 } },
    { name: '小號齊奏', inst: 'trumpets', part: seq(rest(32), HOOK), gain: 0.95, pan: -0.1, rev: 0.3, opts: { release: 0.12 } },
    { name: '斷弓', inst: 'spicc', part: seq(vel(spA, 0.8), spA, spB, spC, spB), gain: 0.68, pan: -0.3, rev: 0.2 },
    { name: '撥奏', inst: 'pizz', part: seq(rest(24), PZ_C, rest(8)), gain: 1.25, pan: 0.35, rev: 0.25 },
    { name: '銅管重音', inst: 'brassStab', part: seq(stA, stA, stB, stC, stB), gain: 0.3, pan: 0.1, rev: 0.2 },
    { name: '弦樂', inst: 'strings', part: seq(rest(16), vel(strB, 0.6), rest(8), strB), gain: 0.45, rev: 0.45, opts: { attack: 0.15, release: 0.4 } },
    { name: '貝斯', inst: 'bass', part: seq(bassA, bassA, bassB, bassC, bassB), gain: 0.72, opts: { release: 0.12 } },
    { name: '大提琴聲部', inst: 'celli', part: seq(rest(16), celliB, rest(8), celliB), gain: 0.42, pan: -0.2, rev: 0.35, opts: { attack: 0.06, release: 0.3 } },
    { name: '大鼓', inst: 'kick', part: kick, gain: 0.5 },
    { name: '小鼓', inst: 'snare', part: snare, gain: 1.4, rev: 0.15 },
    { name: '邊擊', inst: 'rim', part: rim, gain: 2.0, pan: 0.1, rev: 0.15 },
    { name: '踩鈸', inst: 'hat', part: hat, gain: 3.5, pan: 0.25, rev: 0.1 },
    { name: '開鈸', inst: 'ohat', part: ohat, gain: 2.5, pan: 0.25, rev: 0.12 },
    { name: '鈸', inst: 'crash', part: crash, gain: 1.0, pan: -0.2, rev: 0.2 },
  ],
};

export default song;
