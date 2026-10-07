// Whisperwood (`forest`): a nature-element wild song. Giant trees, glowing mushroom rings, forest folk living in the trees.
// F Lydian, 4/4, 96 BPM, a slight sixteenth-note swing. The B natural (#4) is the source of the magic feel, and the G major triad (degree II) keeps lifting F brighter.
// Core motif: the arpeggio C, F, A rising, then falling back to G, F, C (looking up at the canopy). Sequenced once on G/F, it sings exactly the B that is the #4.
// Groove: the kalimba's syncopated sixteenth notes feed a dotted-eighth delay, like dew bouncing between leaves; hand drum plus shaker, no drum kit.
// Sections: A the ocarina theme (the question stops on the B of a G chord, the answer uses E to lead to F)
//      B the kalimba and marimba trade question and answer (F, G, Am, C), the motif shrinks to sixteenth notes, and in the last bar the two instruments cut in on each other
//      C the glowing mushroom ring: all rhythm is pulled out, the celesta plays the motif at double length, a glass pad holds it up; a D♭ major seventh chord is borrowed as an odd-colored light, and the G chord brings the B back
//      A' the flute sings the theme, the ocarina sings long notes below, in the second half the two flutes play in parallel thirds, and a rising harp scale leads back to the beginning.

import { arp, grid, holdRoots, mel, pad, prog, rest, seq, stack, vel, type SongDef } from './_kit.ts';

// ── Harmony (8 bars per section)
const cA = 'F | G/F | Am7 | G | F | G/F | Dm7 Em7 | Fadd9';
const cB = 'F | G | Am | C | F | G | Am7 | Csus4 C';
const cC = 'Fmaj7 | G/F | Em7 | Am7 | Dbmaj7 | Dbmaj7 | Gsus4 | G';
const cA2 = 'F | G/F | Am7 | G | F | G/F | Dm7 Em7 | F';

const pA = prog(cA);
const pB = prog(cB);
const pC = prog(cC);
/** The glass pad uses an add9 chord for those two D♭ bars, to keep C and D♭ from sitting side by side in the pad; the light of the major seventh is left to the celesta */
const pCpad = prog('Fmaj7 | G/F | Em7 | Am7 | Dbadd9 | Dbadd9 | Gsus4 | G');
const pA2 = prog(cA2);
const pIntro = prog('F | G/F');

// ── Theme (ocarina)
/** Question: the motif on F, sequenced on G/F (B5 = #4), stopping on B4 in bar 4 */
const A1 = 'C5:3 F5:1 A5:4 G5:2 F5:2 C5:4 | D5:3 G5:1 B5:4 A5:2 G5:2 D5:4 | C6:6 B5:2 A5:2 G5:2 E5:4 | G5:4 D5:2 E5:2 B4:6 r:2';
/** Answer: the sequence climbs to D6, then comes back down using the motif's inversion (a downward arpeggio), with E leading to F */
const A2 = 'C5:3 F5:1 A5:4 G5:2 F5:2 C5:4 | D5:3 G5:1 B5:4 C6:2 D6:2 B5:4 | A5:3 F5:1 D5:4 G5:3 E5:1 B4:4 | C5:2 E5:2 F5:10 r:2';
/** The second half of A': the flute's parallel thirds above the ocarina */
const A2_HI = 'F5:3 A5:1 C6:4 B5:2 A5:2 F5:4 | F5:3 B5:1 D6:4 E6:2 F6:2 D6:4 | C6:3 A5:1 F5:4 B5:3 G5:1 D5:4 | E5:2 G5:2 A5:10 r:2';
/** The first half of A': the ocarina's long notes under the flute's theme */
const A_LOW = 'A4:12 C5:4 | B4:12 G4:4 | E5:8 C5:8 | D5:12 r:4';

// ── B section: question and answer
const KAL_B =
  'r:2 C5:1 F5:1 A5:2 G5:1 A5:1 C6:3 A5:1 G5:4 | r:2 D5:1 G5:1 B5:2 A5:1 B5:1 D6:3 B5:1 A5:4 | R | R | ' +
  'C6:1 A5:1 F5:2 G5:2 A5:2 r:8 | D6:1 B5:1 G5:2 A5:2 B5:2 r:8 | E6:1 C6:1 A5:2 B5:2 C6:2 r:8 | F5:2 G5:2 C6:4 G5:2 C6:2 E6:4';
const MAR_B =
  'R | R | r:2 E4:1 A4:1 C5:2 B4:1 C5:1 E5:3 C5:1 A4:4 | r:2 G4:1 C5:1 E5:2 D5:1 E5:1 G5:3 E5:1 D5:2 C5:2 | ' +
  'r:8 F4:1 A4:1 C5:2 B4:2 A4:2 | r:8 G4:1 B4:1 D5:2 C5:2 B4:2 | r:8 A4:1 C5:1 E5:2 D5:2 C5:2 | F4:2 G4:2 C5:4 E4:2 G4:2 C5:4';

// ── C section: the glowing mushroom ring (celesta, the motif at double length)
const CEL_C = 'C5:6 F5:2 A5:8 | D5:6 G5:2 B5:8 | E6:6 D6:2 B5:8 | C6:6 B5:2 A5:4 E5:4 | Db5:6 F5:2 Ab5:8 | C6:6 Bb5:2 Ab5:4 F5:4 | G5:6 C6:2 D6:8 | B5:12 r:4';
/** Scattered fireflies above the ring (glockenspiel, trailing off with the delay) */
const FIREFLY = 'r:10 A6:2 r:4 | R | r:6 B6:2 r:8 | r:12 E6:4 | r:10 Ab6:2 r:4 | r:4 F6:2 r:10 | r:8 D6:2 r:6 | R';

// ── Harp ornaments: arpeggios and rising scales at phrase ends
const HARP_A = 'R | R | R | r:8 G4:2 B4:2 D5:2 G5:2 | R | R | R | r:8 F4:1 G4:1 A4:1 B4:1 C5:1 D5:1 E5:1 F5:1';
const HARP_A2 = 'R | R | R | r:8 G4:2 B4:2 D5:2 G5:2 | R | R | R | r:8 C5:1 D5:1 E5:1 F5:1 G5:1 A5:1 B5:1 C6:1';
const HARP_B_END = seq(rest(7), 'r:8 C4:2 E4:2 G4:2 C5:2');

// ── Bass (pizzicato double bass): at least an eighth note for each note, mostly roots, fifths and stepwise motion, few octave leaps
/** A: dotted quarter, quarter, dotted quarter; in bar 2 F, G, A walk up into Am, in bar 4 G, D, E use E to lead back to F */
const BASS_A = 'F2:6 C3:4 A2:6 | F2:6 G2:4 A2:6 | A2:6 E2:4 G2:6 | G2:6 D2:4 E2:6 | F2:6 C3:4 A2:6 | F2:6 G2:4 A2:6 | D2:8 E2:8 | F2:10 C2:6';
/** B: while the marimba and kalimba converse, the bass walks arpeggios */
const BASS_B = 'F2:6 A2:4 C3:6 | G2:6 B2:4 D3:6 | A2:6 C3:4 E3:6 | C3:6 G2:4 E2:6 | F2:6 A2:4 C3:6 | G2:6 B2:4 D3:6 | A2:6 G2:4 E2:6 | C2:8 G2:4 E2:4';
/** C: one long note per bar */
const BASS_C = 'F2:16 | F2:16 | E2:16 | A2:16 | Db2:16 | Db2:16 | G2:16 | G2:16';

// ── Hand drum (frame drum, low thud + high slap) and shaker
const FL = 43;
const FH = 55;
const frameA = stack(grid('X.....x...x.....'.repeat(7) + 'X.....x...x.x...', 1, FL), grid('....x.......x.o.'.repeat(7) + '....x..o.o.oxoxx', 1, FH));
const frameB = stack(grid('X.....x...x..x..'.repeat(7) + 'X.....x.X.X.X...', 1, FL), grid('....x..o....x.oo'.repeat(7) + '....x..o.x.x.xxx', 1, FH));
const SHAKER = 'o.x.o.xoo.x.o.xo';

const song: SongDef = {
  title: '翠語森林',
  mood: 'F 利底亞的森林散步曲：陶笛與長笛唱主題，卡林巴切分音型帶延遲，馬林巴、豎琴、手鼓、鳥叫；中段是只剩鋼片琴與玻璃墊的菌圈。',
  bpm: 96,
  swing16: 0.1,
  space: { size: 2.0, damp: 0.35, pre: 0.02, er: 0.3, mix: 0.9 },
  delay: { steps: 6, fb: 0.32, tone: 2600, mix: 0.7 },
  intro: [
    { name: '卡林巴', inst: 'kalimba', part: arp(pIntro, '0..2..4..3..1.2.', { rate: 1, center: 64, size: 4, accent: 16 }), gain: 0.75, pan: -0.25, rev: 0.3, dly: 0.35 },
    { name: '玻璃墊', inst: 'glassPad', part: vel(pad(pIntro, { center: 57 }), 0.4), gain: 0.7, rev: 0.5, opts: { attack: 2 } },
    { name: '鳥鳴', inst: 'birds', part: 'C4:32', gain: 1.8, rev: 0.25 },
    { name: '豎琴', inst: 'harp', part: 'R | r:8 C5:1 D5:1 E5:1 F5:1 G5:1 A5:1 B5:1 C6:1', gain: 0.55, pan: 0.3, rev: 0.4 },
  ],
  tracks: [
    // Melody
    { name: '陶笛', inst: 'ocarina', part: seq(A1, A2, rest(16), A_LOW, A2), gain: 1.25, pan: 0.12, rev: 0.4, dly: 0.08 },
    { name: '長笛', inst: 'flute', part: seq(rest(24), A1, A2_HI), gain: 0.72, pan: -0.2, rev: 0.4, dly: 0.08 },
    { name: '卡林巴問', inst: 'kalimba', part: seq(rest(8), KAL_B, rest(16)), gain: 0.85, pan: -0.3, rev: 0.3, dly: 0.25 },
    { name: '馬林巴答', inst: 'marimba', part: seq(rest(8), MAR_B, rest(16)), gain: 0.8, pan: 0.3, rev: 0.28 },
    { name: '鋼片琴', inst: 'celesta', part: seq(rest(16), CEL_C, rest(8)), gain: 0.85, pan: 0.15, rev: 0.5, dly: 0.3 },
    // Accompaniment
    {
      name: '卡林巴頑固',
      inst: 'kalimba',
      part: seq(arp(pA, '0..2..4..3..1.2.', { rate: 1, center: 64, size: 4, accent: 16 }), rest(16), arp(pA2, '0..2..4..3..1.2.', { rate: 1, center: 64, size: 4, accent: 16 })),
      gain: 0.5,
      pan: -0.25,
      rev: 0.28,
      dly: 0.35,
    },
    { name: '螢火', inst: 'glock', part: seq(rest(16), FIREFLY, rest(8)), gain: 0.5, pan: 0.4, rev: 0.5, dly: 0.55 },
    { name: '豎琴', inst: 'harp', part: seq(HARP_A, HARP_B_END, arp(pC, '0 1 2 3 4 . . .', { rate: 2, center: 55 }), HARP_A2), gain: 0.55, pan: 0.3, rev: 0.45 },
    {
      name: '玻璃墊',
      inst: 'glassPad',
      part: seq(vel(pad(pA, { center: 57 }), 0.42), vel(pad(pB, { center: 57 }), 0.5), vel(pad(pCpad, { center: 58 }), 0.8), vel(pad(pA2, { center: 57 }), 0.5)),
      gain: 0.7,
      rev: 0.55,
    },
    { name: '低音', inst: 'pizzBass', part: seq(BASS_A, BASS_B, vel(mel(BASS_C), 0.7), BASS_A), gain: 0.75 },
    // Cello section: long open fifths on the chord bass, very light, giving the pizzicato bass a woody floor
    { name: '大提琴聲部', inst: 'celli', part: seq(holdRoots(pA, 45, true, 0.5), holdRoots(pB, 45, true, 0.55), holdRoots(pC, 45, true, 0.5), holdRoots(pA2, 45, true, 0.55)), gain: 0.3, pan: -0.15, rev: 0.4, opts: { attack: 0.3, release: 0.6 } },
    // Rhythm (the whole C section rests)
    { name: '手鼓', inst: 'frame', part: seq(frameA, frameB, rest(8), frameB), gain: 0.7, pan: 0.05, rev: 0.18 },
    { name: '沙鈴', inst: 'shaker', part: seq(rest(8), grid(SHAKER.repeat(8)), rest(8), grid(SHAKER.repeat(8))), gain: 0.55, pan: 0.35, rev: 0.15 },
    // Ambience
    /** Birdsong is cut into sections of 8 bars: each section is scheduled on its own, so the whole round of chirps is not built all at the start */
    { name: '鳥鳴', inst: 'birds', part: 'C4:128 C4:128 C4:128 C4:128', gain: 1.8, rev: 0.25 },
  ],
};

export default song;
