// Seal Tower: every region has a demon-sealing tower that the player climbs floor by floor, and the tower screen plays for a long time.
// The idea is "theme and variations": the nine towers share one set of core material, and each region swaps in its local instruments, mode, tonic, tempo, reverb and ambience,
// so they sound like nine different pieces, yet you can tell at once that it is the same tower.
//
// All the core material is written on the C white keys: C is the tonic, D is degree 2 ... B is degree 7, and remap() then moves it to each region's tonic and mode.
// The same white-key A is b6 in minor and a natural 6 in Dorian; chords are also written as triads on the white keys,
// and after the move they automatically become the chords of that mode (the white-key Bdim is the bVII major triad in minor).
//   1. Ostinato (sampled instrument): the first sixteenth note of each beat is a top note climbing upward, followed by a 5, 1, 5 pendulum.
//      The top note rises one step per beat, and the whole thing also rises one step per bar (C D E F | D E F G | E F G A | F G A B), climbing for four bars and returning to the start, like going up a spiral staircase.
//   2. Lament bass 1, 7, 6, 5 (1, b7, b6, 5 in minor): the ostinato goes up while the bass goes down, and the two lines open apart in opposite directions.
//   3. Main motif: after a rest, 5, 1, 3 looks upward; at the end of the phrase a 6 sighs down to 5 (in minor, the semitone b6 to 5, the seal in the tower).
//      The question phrase stops on 5, the answer phrase stops on the third of the V chord, pulling back to the next round's tonic chord.
//   4. B section "the light at the top of the tower": the harmony moves to the major triads of the mode, and the melody sequences the main theme's motif (5 leaping up to 3, then 2 1 2) upward step by step,
//      finally stopping on the tonic an octave higher. In minor this leap is the minor-sixth version of the main theme's leap.
// Structure, 32 bars: A theme -> A' theme moved to the low instruments, with a long-note counterpoint added in the high register -> B the light at the top of the tower (counterpoint melody added) -> C the seal
// (the bass at half speed, the motif augmented into long notes, the ostinato reduced to the first beat of each bar, and the last bar climbs all the way up to join A).
// The differences between regions are all written in the PALETTE table, and tower() builds each piece from the table.

import { arp, bassline, grid, mapPitch, mel, midi, pad, prog, remap, rest, seq, slice, stack, vel, type Chd, type Ev, type Mode, type Part, type SongDef, type TrackDef } from './_kit.ts';

const BAR = 16;
/** One round of 32 bars: A 8, A' 8, B 8, C 8 */
const BARS = 32;

// ───────────────────────── Core material (C white keys) ─────────────────────────

/** Ostinato: four beats per bar, each beat "top note, G4, C5, G4" */
const ostBar = (tops: string[]) => tops.map((t) => `!${t}:1 G4 C5 G4`).join(' ');
const OST_A = mel([['C5', 'D5', 'E5', 'F5'], ['D5', 'E5', 'F5', 'G5'], ['E5', 'F5', 'G5', 'A5'], ['F5', 'G5', 'A5', 'B5']].map((b) => ostBar(b) + ' |').join(' '));
/** C section: the ostinato keeps only the first beat of each bar, the top note rises one step per bar; the last bar climbs all the way up to join the start */
const OST_C = seq(
  mel(['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5'].map((t) => `!${t}:1 G4 C5 G4 r:12 |`).join(' ')),
  slice(OST_A, 3 * BAR, 4 * BAR),
);
/** The B section's ostinato: climbing on the chord tones (each beat starts one chord tone higher and circles around) */
const OST_B_PAT = '0121123223433454';

/** Theme (8 bars: question 4 + answer 4) */
const THEME =
  'r:4 G4:2 C5:2 !E5:8 | D5:6 C5:2 D5:4 F5:4 | C5:8 E5:4 D5:4 | !A4:4 G4:12 | ' +
  'r:4 G4:2 C5:2 E5:6 F5:2 | !G5:8 F5:4 D5:4 | E5:6 D5:2 C5:4 A4:4 | B4:12 r:4 |';
/** A' high counterpoint: first follows the bass down a fifth, then climbs in the second half, pushing the music into the B section */
const DESC = 'G5:12 E5:4 | F5:12 D5:4 | E5:12 C5:4 | D5:8 B4:8 | G5:8 C6:8 | B5:12 G5:4 | A5:8 C6:8 | B5:8 !D6:8 |';
/** B melody: a sequence of the main theme's motif, G, A, B rising step by step, stopping on a high C */
const BMEL =
  'G4:4 !E5:6 D5:2 C5:2 D5:2 | E5:12 r:4 | A4:4 !F5:6 E5:2 D5:2 E5:2 | F5:12 r:4 | ' +
  'B4:4 !G5:6 F5:2 E5:2 F5:2 | G5:8 A5:4 B5:4 | !C6:12 B5:2 A5:2 | G5:8 D5:8 |';
/** C section: the main motif augmented into long notes, given to the low instruments */
const SEAL = 'G3:8 C4:8 | E4:16 | D4:8 F4:8 | E4:8 D4:8 | C4:16 | E4:8 C4:8 | A3:4 G3:12 | R |';
/** Echo high above in the C section: fragments of the main motif */
const ECHO = 'R | r:8 G5:2 C6:2 E6:4 | R | r:8 F6:4 D6:4 | R | r:8 E6:2 C6:2 A5:4 | R | R |';

/** Lament bass: every chord is built over C B A G */
const LAMENT = ['C', 'B', 'A', 'G'];
const lament = (up: string[], len = BAR) => prog(up.map((u, i) => `${u}/${LAMENT[i % 4]}:${len}`).join(' '));

/**
 * Harmony of each mode (white-key notation). a: the chords of the 8 A-section bars, built over the lament bass; b: the 8 B-section bars.
 * The B section deliberately picks the major triads of each mode (bIII bVI bVII in minor, IV in Dorian, bVII in Mixolydian, II in Lydian, bII in Phrygian dominant),
 * and every bar contains the melody's long note.
 */
const HARM = {
  aeolian: { a: ['C', 'Bdim', 'Am', 'G', 'C', 'G', 'F', 'G'], b: 'Em | Am | Bdim | Bdim/D | Em | Em/G | Am | Bdim' },
  dorian: { a: ['C', 'Bdim', 'F', 'G', 'C', 'G', 'F', 'G7'], b: 'Em | C/E | F | Bdim/F | Em | Em/G | F | Bdim' },
  phrygianDom: { a: ['C', 'G', 'Am', 'G', 'C', 'Bdim', 'Am', 'G7'], b: 'C | C/E | Dm | Dm/F | Bdim | G | C | G' },
  mixolydian: { a: ['C', 'Bdim', 'Am', 'G', 'C', 'G', 'Am', 'G7'], b: 'C | Am | F | Bdim | G | G/B | C | Bdim' },
  lydian: { a: ['C', 'Bdim', 'F', 'G', 'C', 'G', 'Am', 'Dm'], b: 'C | C/E | Dm | Dm/F | G | Em | C | G' },
  harmonicMinor: { a: ['C', 'G', 'F', 'G', 'C', 'Bdim', 'Am', 'G7'], b: 'Am | Em | F | F/A | G | G7 | Am | G' },
};

// ───────────────────────── Regional palette ─────────────────────────

/** The instrument used by one voice */
interface Ins {
  inst: string;
  /** Octaves to shift */
  oct?: number;
  gain?: number;
  pan?: number;
  rev?: number;
  dly?: number;
  hum?: number;
  opts?: Record<string, number>;
  /** Reversed instrument: the sound only peaks a few seconds after the note starts, so the whole melody is moved earlier by that much */
  early?: number;
}
/** Drums: a1 is bars 1 to 8 (if omitted, a is used), a is the A' section, b and c are 8 bars each, fill replaces the last bar; an empty string is a rest */
interface Drum extends Ins {
  name: string;
  pitch?: number;
  a1?: string;
  a: string;
  b: string;
  c: string;
  fill?: string;
}
interface Bass extends Ins {
  /** [rhythm, scale degree]: for sections A and B; the C section is 32 steps (one chord per two bars) */
  a: [string, string];
  b: [string, string];
  c: [string, string];
}
interface Pal {
  name: string;
  mood: string;
  /** Tonic (a note name, treated as the white-key C4) */
  tonic: string;
  mode: Mode;
  modeB?: Mode;
  modeC?: Mode;
  /** The mode used separately for the melody and ostinato (a pentatonic scale) */
  melMode?: Mode;
  /** Notes to alter after the mode change: { semitones relative to the tonic: semitones to change it to } (the Rift uses it to build an octatonic scale) */
  alt?: Record<number, number>;
  harm: { a: string[]; b: string };
  harmB?: string;
  bpm: number;
  swing?: number;
  swing16?: number;
  space: SongDef['space'];
  delay?: SongDef['delay'];
  gain: number;
  /** Center note of the chord pad (white key) */
  padCenter?: number;
  /** Number of notes in the B section chord pad (default 4; regions short on CPU use 3) */
  padSizeB?: number;
  ost: Ins;
  lead: Ins;
  low: Ins;
  desc: Ins;
  bLead: Ins;
  counter: Ins & { center?: number };
  seal: Ins;
  echo?: Ins;
  pad: Ins;
  bass: Bass;
  drums: Drum[];
  amb: Ins[];
  /** Sounds in the intro (the tower gate) */
  door: Ins & { part: string };
  /** Pentatonic: merge repeated notes, add glides to the melody */
  merge?: boolean;
  slide?: boolean;
  /** The region's own voices (K is this piece's chord progression) */
  extra?: (P: Pal, K: { cB: Chd[] }) => TrackDef[];
  /** Open-fifth long notes for the cello voice (thickness in the low mid range): false turns it off, a number is the volume */
  celli?: false | number;
}

const WHOLE = 'x---------------';
const LONG2 = 'x'.padEnd(32, '-');

export const PALETTE: Record<string, Pal> = {
  forest: {
    name: '翠語森林',
    mood: 'D 多利安，96 BPM。樹根纏住的古塔：雙簧管唱主題，卡林巴爬樓梯，框鼓走 3+3+2，玻璃墊與洞窟的風，偶爾一聲鳥叫從塔頂的縫漏進來。',
    tonic: 'D4',
    mode: 'dorian',
    harm: HARM.dorian,
    bpm: 96,
    space: { size: 2.6, damp: 0.5, pre: 0.02, er: 0.35, mix: 0.9 },
    gain: 1.12,
    ost: { inst: 'kalimba', oct: -1, gain: 0.3, pan: -0.25, rev: 0.3 },
    lead: { inst: 'oboe', gain: 1, pan: 0.15, rev: 0.4 },
    low: { inst: 'clarinet', oct: -1, gain: 0.8, pan: -0.1, rev: 0.4 },
    desc: { inst: 'oboe', gain: 0.55, pan: 0.3, rev: 0.45 },
    bLead: { inst: 'flute', gain: 1, pan: 0.15, rev: 0.45 },
    counter: { inst: 'clarinet', oct: -1, gain: 0.6, pan: -0.3, rev: 0.4, center: 66 },
    seal: { inst: 'clarinet', gain: 0.75, pan: -0.1, rev: 0.45 },
    echo: { inst: 'kalimba', gain: 0.45, pan: 0.35, rev: 0.6 },
    pad: { inst: 'glassPad', gain: 0.6, rev: 0.55 },
    bass: { inst: 'contrabass', oct: -1, gain: 0.6, a: [WHOLE, '1'], b: ['x-------x-------', '1 5'], c: [LONG2, '1'] },
    drums: [
      { name: '框鼓低', inst: 'frame', pitch: 38, gain: 0.75, rev: 0.2, a1: 'X...............', a: 'X.....x...x.....', b: 'X..x..x.X..x..x.', c: 'X...............|................', fill: 'X.....x...x.x.xx' },
      { name: '框鼓高', inst: 'frame', pitch: 64, gain: 0.3, pan: 0.3, rev: 0.2, a1: '', a: '....x.......x...', b: '..o.x..o..o.x.o.', c: '', fill: '........o.x.x.XX' },
    ],
    amb: [{ inst: 'cave', gain: 0.5, rev: 0.15 }],
    door: { inst: 'frame', part: 'D2:32', gain: 0.8, rev: 0.3 },
    extra: (P) => [
      { name: '鳥', inst: 'birds', part: at(17, 0, 'C4:112'), gain: 0.8, rev: 0.4 },
      { name: '水滴', inst: 'drip', part: seq(rest(24), inKey(P, 'C', mel('r:7 C7:1 r:8 | r:12 G6:1 r:3 | r:3 E7:1 r:12 | R | r:9 A6:1 r:6 | r:2 D7:1 r:13 | r:11 G6:1 r:4 | R |'))), gain: 1, rev: 0.5 },
    ],
  },

  isles: {
    name: '潮歌群島',
    mood: 'A 自然小調，88 BPM，B 段轉 A 多利安。半沉在海裡、結了冰的塔：玻璃琴唱主題，鋼片琴在高處爬樓梯，女聲合唱像從水底傳上來，沉在海底的鐘敲著封印動機，海浪在很遠的地方，殘響很長。',
    tonic: 'A3',
    mode: 'aeolian',
    modeB: 'dorian',
    harm: HARM.aeolian,
    harmB: HARM.dorian.b,
    bpm: 88,
    space: { size: 4.2, damp: 0.35, pre: 0.05, er: 0.25, mix: 1 },
    delay: { steps: 6, fb: 0.3, tone: 3200, mix: 0.5 },
    gain: 1.12,
    padCenter: 68,
    ost: { inst: 'celesta', oct: 1, gain: 0.35, pan: 0.25, rev: 0.5, dly: 0.25 },
    lead: { inst: 'glass', gain: 0.8, pan: -0.1, rev: 0.55 },
    low: { inst: 'choirOo', gain: 0.9, pan: -0.2, rev: 0.6 },
    desc: { inst: 'glass', gain: 0.55, pan: 0.25, rev: 0.6 },
    bLead: { inst: 'glass', gain: 0.85, pan: -0.1, rev: 0.55 },
    counter: { inst: 'choirOo', gain: 0.5, pan: 0.25, rev: 0.6, center: 64 },
    seal: { inst: 'bell', gain: 0.9, rev: 0.6 },
    echo: { inst: 'celesta', oct: 1, gain: 0.3, pan: 0.4, rev: 0.7, dly: 0.4 },
    pad: { inst: 'airPad', gain: 0.5, rev: 0.6 },
    bass: { inst: 'sub', oct: -1, gain: 0.4, a: [WHOLE, '1'], b: [WHOLE, '1'], c: [LONG2, '1'] },
    drums: [
      {
        name: '冰滴',
        inst: 'drip',
        gain: 1,
        rev: 0.5,
        a1: 'r:6 E6:1 r:9 | r:13 A6:1 r:2 |',
        a: 'r:2 E6:1 r:5 C7:1 r:7 | r:10 A6:1 r:3 G6:1 r:1 |',
        b: 'r:6 E6:1 r:5 A6:1 r:3 | r:2 C7:1 r:9 G6:1 r:3 |',
        c: 'r:9 A6:1 r:6 | R | r:4 E6:1 r:11 | R |',
      },
    ],
    amb: [{ inst: 'sea', gain: 0.18 }, { inst: 'cave', gain: 0.3 }],
    door: { inst: 'bell', part: 'A3:32', gain: 0.6, rev: 0.7 },
    extra: (P) => [
      { name: '沉鐘', inst: 'bell', part: seq(inKey(P, 'A', mel('C4:16 | R | R | R | R | R | R | R | G3:16 | R | R | R | R | R | R | R |')), inKey(P, 'B', mel('E4:16 | R | R | R | R | R | R | R |')), rest(8)), gain: 0.7, pan: -0.3, rev: 0.7 },
      { name: '鑼', inst: 'gong', part: stack(at(17, 0, 'A1:16'), at(25, 0, 'A1:16')), gain: 0.35, rev: 0.6 },
    ],
  },

  volcano: {
    name: '焰脊火山帶',
    mood: 'E 弗里吉亞屬，104 BPM。蓋在熔岩上的鍛造塔：魯特琴的十六分音符一路往上爬，法國號唱主題、長號接低音，低音號走哀歌低音，太鼓與鐵砧打鍛造的節奏，C 段有鎖鏈聲，底下一直是火。',
    tonic: 'E4',
    mode: 'phrygianDom',
    harm: HARM.phrygianDom,
    bpm: 104,
    space: { size: 2.2, damp: 0.6, pre: 0.015, er: 0.4, mix: 0.85 },
    gain: 0.85,
    padCenter: 57,
    ost: { inst: 'lute', oct: -1, gain: 0.7, pan: 0.25, rev: 0.25 },
    lead: { inst: 'horn', oct: -1, gain: 1.1, pan: -0.15, rev: 0.4 },
    low: { inst: 'trombone', oct: -2, gain: 0.75, pan: 0.1, rev: 0.35 },
    desc: { inst: 'trumpet', oct: -1, gain: 0.5, pan: 0.3, rev: 0.45 },
    bLead: { inst: 'horns', oct: -1, gain: 1, pan: -0.1, rev: 0.4 },
    counter: { inst: 'horn', oct: -1, gain: 0.6, pan: 0.3, rev: 0.4, center: 60 },
    seal: { inst: 'trombone', oct: -1, gain: 0.7, rev: 0.45 },
    echo: { inst: 'anvil', gain: 0.8, pan: 0.35, rev: 0.5 },
    pad: { inst: 'strPad', gain: 0.5, rev: 0.5 },
    padSizeB: 3,
    bass: { inst: 'tuba', oct: -1, gain: 0.75, a: ['x-----x-x-------', '1 5 1'], b: ['x-----x-x---x---', '1 5 1 8'], c: [LONG2, '1'] },
    drums: [
      { name: '太鼓', inst: 'taiko', pitch: 40, gain: 0.28, rev: 0.2, a1: 'X.......x.x.....', a: 'X..x..x.X...x.x.', b: 'X..x..x.X..x.xXx', c: 'X...............|........x.x.....', fill: 'X.x.X.x.XxXxXXXX' },
      { name: '鐵砧', inst: 'anvil', pitch: 88, gain: 0.5, pan: -0.35, rev: 0.3, a1: '', a: '....x.......x...', b: '..x...x...x...x.', c: '', fill: '' },
      { name: '鎖鏈', inst: 'chain', gain: 1, pan: 0.3, rev: 0.4, a1: '', a: '', b: '', c: 'x...............|................' },
    ],
    amb: [{ inst: 'fire', gain: 0.4 }, { inst: 'cave', gain: 0.3 }],
    door: { inst: 'taiko', part: '!E2:32', gain: 0.9, rev: 0.4 },
    extra: () => [{ name: '鑼', inst: 'gong', part: at(25, 0, 'E2:16'), gain: 0.4, rev: 0.5 }],
  },

  highland: {
    name: '蒼嘯高原',
    mood: 'G 混合利底亞，100 BPM，八分音符微搖擺。風口上的石塔：揚琴爬樓梯，排笛唱主題，豎琴接低音主題，法國號在 B 段吹對位，風笛式持續音壓在底下，低音 tom 帶一點搖擺，外面一直在颳風。',
    tonic: 'G3',
    mode: 'mixolydian',
    harm: HARM.mixolydian,
    bpm: 100,
    swing: 0.15,
    space: { size: 2.8, damp: 0.4, pre: 0.03, er: 0.3, mix: 0.9 },
    gain: 1,
    ost: { inst: 'dulcimer', gain: 0.6, pan: -0.25, rev: 0.35 },
    lead: { inst: 'panflute', oct: 1, gain: 0.9, pan: 0.15, rev: 0.45 },
    low: { inst: 'harp', gain: 0.85, pan: -0.1, rev: 0.4 },
    desc: { inst: 'panflute', gain: 0.65, pan: 0.25, rev: 0.5 },
    bLead: { inst: 'panflute', oct: 1, gain: 0.9, pan: 0.15, rev: 0.45 },
    counter: { inst: 'horn', gain: 0.6, pan: -0.3, rev: 0.45, center: 64 },
    seal: { inst: 'horn', gain: 0.7, pan: -0.1, rev: 0.5 },
    echo: { inst: 'harp', oct: 1, gain: 0.9, pan: 0.35, rev: 0.6 },
    pad: { inst: 'strPad', gain: 0.38, rev: 0.5 },
    bass: { inst: 'contrabass', gain: 0.6, a: [WHOLE, '1'], b: ['x-----x-x-------', '1 -5 1'], c: [LONG2, '1'] },
    drums: [
      { name: 'tom 低', inst: 'tom', pitch: 43, gain: 0.6, rev: 0.25, a1: 'X.......x.......', a: 'X.....x.X.......', b: 'X.....x.X...x.x.', c: 'X...............|................', fill: 'X.x.x.x.X.x.XXXX' },
      { name: 'tom 高', inst: 'tom', pitch: 50, gain: 0.4, pan: 0.3, rev: 0.25, a1: '', a: '....x.......x...', b: '....x..x....x.xx', c: '' },
      { name: '沙鈴', inst: 'shaker', gain: 1, pan: -0.3, rev: 0.2, a1: '', a: '', b: 'o.x.o.x.o.x.o.x.', c: '' },
    ],
    amb: [{ inst: 'wind', gain: 0.4 }, { inst: 'cave', gain: 0.25 }],
    door: { inst: 'tom', part: '!G2:32', gain: 0.7, rev: 0.4 },
    extra: (P) => [{ name: '持續音', inst: 'drone', part: seq(rest(8), inKey(P, 'A', mel('C3:128')), inKey(P, 'B', mel('C3:128')), rest(8)), gain: 0.4, rev: 0.4, opts: { attack: 1.5, release: 1.5 } }],
  },

  canyon: {
    name: '磐心峽谷',
    mood: 'C 小調，92 BPM。鑿進岩壁的塔：低音管唱主題，大提琴接低音主題，男聲合唱從頭到尾哼著和聲、C 段單獨唱封印動機，馬林巴在低處爬樓梯，boom 像心跳，低音 tom 在岩壁間回彈，水滴落在谷底，還有峽谷的回音。',
    tonic: 'C4',
    mode: 'aeolian',
    harm: HARM.aeolian,
    bpm: 92,
    space: { size: 3, damp: 0.55, pre: 0.04, er: 0.45, mix: 0.9 },
    delay: { steps: 6, fb: 0.35, tone: 1800, mix: 0.6 },
    gain: 0.8,
    ost: { inst: 'marimba', oct: -1, gain: 0.45, pan: -0.2, rev: 0.3 },
    lead: { inst: 'bassoon', oct: -1, gain: 1.2, pan: 0.1, rev: 0.4, dly: 0.2 },
    low: { inst: 'cello', oct: -1, gain: 0.9, pan: -0.15, rev: 0.45 },
    desc: { inst: 'horn', oct: -1, gain: 0.55, pan: 0.3, rev: 0.45, dly: 0.25 },
    bLead: { inst: 'horn', oct: -1, gain: 1, pan: 0.15, rev: 0.45, dly: 0.2 },
    counter: { inst: 'bassoon', gain: 0.65, pan: -0.25, rev: 0.4, center: 52 },
    seal: { inst: 'menChoir', oct: -1, gain: 0.95, rev: 0.55 },
    echo: { inst: 'marimba', gain: 0.6, pan: 0.35, rev: 0.5, dly: 0.4 },
    pad: { inst: 'menChoir', gain: 0.6, rev: 0.55 },
    padCenter: 55,
    padSizeB: 3,
    bass: { inst: 'contrabass', oct: -1, gain: 0.6, a: [WHOLE, '1'], b: ['x-------x-------', '1 5'], c: [LONG2, '1'] },
    drums: [
      { name: '心跳', inst: 'boom', gain: 0.45, rev: 0.2, a1: 'X..x............|................', a: 'X..x............', b: 'X..x............', c: 'X..x............|................' },
      { name: 'tom', inst: 'tom', pitch: 45, gain: 0.5, pan: 0.25, rev: 0.3, dly: 0.15, a1: '', a: '........x.....x.', b: 'x.....x...x.x...', c: '', fill: 'x.x.x.x.XxXxXXXX' },
      { name: '水滴', inst: 'drip', gain: 1, pan: -0.3, rev: 0.5, dly: 0.3, a1: 'r:5 G6:1 r:10 | r:12 C7:1 r:3 |', a: 'r:5 G6:1 r:10 | r:3 Eb7:1 r:8 C7:1 r:3 |', b: 'r:9 Bb6:1 r:6 | r:5 G6:1 r:10 |', c: 'r:5 G6:1 r:10 | R | R | r:12 C7:1 r:3 |' },
    ],
    amb: [{ inst: 'cave', gain: 0.55 }],
    door: { inst: 'boom', part: '!C2:32', gain: 0.7, rev: 0.4 },
  },

  plains: {
    name: '雷鳴荒原',
    mood: 'A 小調五聲，94 BPM。荒原上孤零零的塔：馬頭琴帶著滑音唱主題，大提琴接低音主題，鋼弦撥奏爬樓梯，框鼓跑馬蹄的節奏，C 段呼麥唱封印動機；塔門一開就是一聲落雷，B 段、C 段開頭再劈一次，遠處不時滾雷。',
    tonic: 'A3',
    mode: 'aeolian',
    melMode: 'minorPent',
    // The pentatonic melody clashes with B and F: the upper chords only use A C D E G (A, C, Dsus2, Asus4), and B and F stay in the bass only
    harm: { a: ['C', 'Em', 'Fsus2', 'Csus4', 'C5', 'Em', 'F5', 'Csus4'], b: 'Em | Am | Fsus2 | Fsus2/A | Em | Em/G | Am | Csus4/G' },
    bpm: 94,
    merge: true,
    slide: true,
    space: { size: 3, damp: 0.45, pre: 0.03, er: 0.3, mix: 0.9 },
    gain: 1.12,
    ost: { inst: 'steel', oct: -1, gain: 0.55, pan: 0.2, rev: 0.3 },
    lead: { inst: 'morin', gain: 0.9, pan: -0.1, rev: 0.4, opts: { glide: 0.14 } },
    low: { inst: 'cello', oct: -1, gain: 0.85, pan: 0.1, rev: 0.4, opts: { glide: 0.12 } },
    desc: { inst: 'strings', gain: 0.45, pan: 0.3, rev: 0.5 },
    bLead: { inst: 'morin', gain: 0.95, pan: -0.1, rev: 0.45, opts: { glide: 0.14 } },
    counter: { inst: 'cello', gain: 0.6, pan: 0.25, rev: 0.4, center: 57 },
    seal: { inst: 'throat', oct: -1, gain: 0.8, rev: 0.5 },
    echo: { inst: 'steel', gain: 0.8, pan: 0.35, rev: 0.55 },
    pad: { inst: 'strPad', gain: 0.38, rev: 0.5 },
    bass: { inst: 'pizzBass', oct: -1, gain: 0.5, a: ['x.......x.x.....', '1 1 5'], b: ['x.....x.x.x.....', '1 5 1 8'], c: [LONG2, '1'] },
    drums: [{ name: '框鼓', inst: 'frame', pitch: 45, gain: 0.6, rev: 0.25, a1: 'X.......X.......', a: 'X.xxX...X.xxX...', b: 'X.xxX.xxX.xxX.xx', c: 'X...............|................', fill: 'X.xxX.xxX.xxXxXX' }],
    amb: [{ inst: 'wind', gain: 0.3 }, { inst: 'cave', gain: 0.3 }],
    door: { inst: 'thunderclap', part: 'C4:32', gain: 0.9, rev: 0.4 },
    extra: () => [
      { name: '遠雷', inst: 'thunder', part: stack(at(5, 10, grid('o')), at(13, 10, grid('x')), at(21, 0, grid('x')), at(29, 6, grid('o'))), gain: 0.7, rev: 0.4 },
      { name: '落雷', inst: 'thunderclap', part: stack(at(16, 0, grid('X')), at(24, 0, grid('x'))), gain: 0.8, rev: 0.4 },
    ],
  },

  holy: {
    name: '曦光聖都',
    mood: 'Eb 利底亞，88 BPM，C 段落進 Eb 自然小調。被污染的聖塔：女聲合唱唱主題，修士吟唱接低音主題，女高音在上面唱對位與 B 段，管風琴鋪和聲與踏板低音，豎琴爬樓梯，管鐘報時；和聲裡一直夾著利底亞的增四度，到了 C 段整個掉進小調。',
    tonic: 'Eb4',
    mode: 'lydian',
    modeC: 'aeolian',
    harm: HARM.lydian,
    bpm: 88,
    space: { size: 3.8, damp: 0.3, pre: 0.05, er: 0.5, mix: 0.95 },
    gain: 1.08,
    ost: { inst: 'harp', oct: -1, gain: 0.45, pan: -0.25, rev: 0.45 },
    lead: { inst: 'choir', oct: -1, gain: 0.85, pan: 0.1, rev: 0.55 },
    low: { inst: 'chant', oct: -2, gain: 1, rev: 0.55 },
    desc: { inst: 'soprano', gain: 0.6, pan: 0.2, rev: 0.6 },
    bLead: { inst: 'soprano', gain: 0.7, pan: 0.1, rev: 0.6 },
    counter: { inst: 'chant', gain: 0.55, pan: -0.2, rev: 0.55, center: 50 },
    seal: { inst: 'chant', oct: -1, gain: 1, rev: 0.6 },
    echo: { inst: 'chime', oct: -1, gain: 0.7, pan: 0.3, rev: 0.6 },
    pad: { inst: 'organ', gain: 0.3, rev: 0.55 },
    bass: { inst: 'organ', oct: -1, gain: 0.35, a: [WHOLE, '1'], b: [WHOLE, '1'], c: [LONG2, '1'] },
    drums: [{ name: '定音鼓', inst: 'timpani', pitch: 39, gain: 0.5, rev: 0.4, a1: '', a: 'X...............|................', b: 'X...............|........o.o.o.xx', c: '', fill: 'r:8 ?Bb1:1 ?Bb1 ?Bb1 ?Bb1 Bb1 Bb1 Bb1 !Bb1' }],
    amb: [{ inst: 'cave', gain: 0.35 }, { inst: 'void', gain: 0.12 }],
    door: { inst: 'chime', part: 'Eb5:32', gain: 0.5, rev: 0.7 },
    extra: (P, K) => [
      {
        name: '管鐘',
        inst: 'chime',
        part: seq(
          inKey(P, 'A', mel('C5:16 | R | R | R | G4:16 | R | R | R | C5:16 | R | R | R | G4:16 | R | R | R |')),
          inKey(P, 'B', mel('C5:16 | R | R | R | G4:16 | R | R | R |')),
          inKey(P, 'C', mel('C5:16 | R | C5:16 | R | C5:16 | R | G4:16 | R |')),
        ),
        gain: 0.4,
        pan: -0.3,
        rev: 0.65,
      },
      { name: '合唱和聲', inst: 'choirOo', part: seq(rest(16), inKey(P, 'B', vel(pad(K.cB, { center: 64, size: 3 }), 0.6)), rest(8)), gain: 0.6, rev: 0.6 },
    ],
  },

  shadow: {
    name: '暮影幽境',
    mood: 'B 和聲小調，96 BPM。黑暗裡的鐘樓：音樂盒一格一格往上爬，大提琴唱主題，小提琴接高音，木魚像一座走不準的時鐘，外面是蟲鳴，空間很暗、很深。',
    tonic: 'B3',
    mode: 'harmonicMinor',
    harm: HARM.harmonicMinor,
    bpm: 96,
    space: { size: 3, damp: 0.8, pre: 0.03, er: 0.3, mix: 1 },
    gain: 1.12,
    padCenter: 57,
    ost: { inst: 'musicbox', gain: 0.4, pan: 0.2, rev: 0.45 },
    lead: { inst: 'cello', oct: -1, gain: 0.9, pan: -0.1, rev: 0.4, opts: { glide: 0.15 } },
    low: { inst: 'cello', oct: -2, gain: 0.85, pan: -0.15, rev: 0.4 },
    desc: { inst: 'violin', gain: 0.55, pan: 0.25, rev: 0.5 },
    bLead: { inst: 'violin', gain: 0.8, pan: 0.15, rev: 0.5 },
    counter: { inst: 'cello', gain: 0.65, pan: -0.25, rev: 0.45, center: 55 },
    seal: { inst: 'cello', oct: -1, gain: 0.85, rev: 0.45 },
    echo: { inst: 'musicbox', oct: 1, gain: 0.55, pan: 0.35, rev: 0.6 },
    pad: { inst: 'strPad', gain: 0.4, rev: 0.55 },
    bass: { inst: 'pizzBass', oct: -1, gain: 0.6, a: ['x.......x.......', '1 5'], b: ['x...x...x...x...', '1 5 8 5'], c: [LONG2, '1'] },
    drums: [
      { name: '滴答', inst: 'woodblock', pitch: 88, gain: 1, pan: 0.3, rev: 0.3, a1: 'x.......x.......', a: 'x.......x.......', b: 'x...x...x...x...', c: 'x...............', fill: 'x...x...x.x.xxxx' },
      { name: '滴答低', inst: 'woodblock', pitch: 81, gain: 0.9, pan: -0.3, rev: 0.3, a1: '', a: '....x.......x...', b: '..x...x...x...x.', c: '', fill: '' },
      { name: '悶響', inst: 'boom', gain: 0.5, rev: 0.3, a1: 'X...............|................|................|................', a: '', b: '', c: 'X...............|................' },
    ],
    amb: [{ inst: 'crickets', gain: 0.22 }, { inst: 'cave', gain: 0.3 }],
    door: { inst: 'boom', part: '!B1:32', gain: 0.6, rev: 0.4 },
  },

  rift: {
    name: '虛蝕裂隙',
    mood: "E 和聲小調，100 BPM，和裂隙的野外曲、遭遇戰同一個調。被虛蝕扯開的塔：小提琴唱主題，鋼琴爬樓梯、在 A' 段接主題，玻璃琴唱 B 段，倒放鋼琴在 C 段把動機的碎片吸進拍點，低音大提琴走哀歌低音，殘響 6 秒，而且會慢慢長出來。",
    tonic: 'E4',
    mode: 'harmonicMinor',
    harm: HARM.harmonicMinor,
    bpm: 100,
    // size 5.2: the impulse response is exactly 6 seconds long
    space: { size: 5.2, damp: 0.45, pre: 0.02, er: 0.1, mix: 0.9, bloom: 1.5 },
    gain: 1.1,
    ost: { inst: 'piano', oct: -1, gain: 0.35, pan: 0.2, rev: 0.45 },
    lead: { inst: 'violin', gain: 1.1, pan: -0.15, rev: 0.5 },
    low: { inst: 'piano', oct: -1, gain: 0.75, pan: -0.1, rev: 0.5 },
    desc: { inst: 'glass', gain: 0.5, pan: 0.3, rev: 0.6 },
    bLead: { inst: 'glass', gain: 0.75, pan: 0.1, rev: 0.55 },
    counter: { inst: 'cello', gain: 0.8, pan: -0.3, rev: 0.5, center: 60 },
    seal: { inst: 'piano', oct: -1, gain: 0.75, rev: 0.6, opts: { ring: 1 } },
    echo: { inst: 'revPiano', gain: 0.5, pan: 0.4, rev: 0.7, early: 1.8 },
    pad: { inst: 'airPad', gain: 0.5, rev: 0.6 },
    padCenter: 66,
    bass: { inst: 'contrabass', oct: -1, gain: 0.55, a: ['x--x--x---x-----', '1 1 8 1'], b: ['x--x--x---x-x---', '1 1 8 1 5'], c: [LONG2, '1'] },
    drums: [
      { name: '悶響', inst: 'boom', gain: 0.38, rev: 0.25, a1: 'X...............|................', a: 'X.........x.....', b: 'X.....x...x.....', c: 'X...............|................' },
      { name: '邊擊', inst: 'rim', gain: 0.8, pan: 0.35, rev: 0.35, a1: '', a: '...x.....x..x...', b: '.x.x..x..x.x.xx.', c: '', fill: 'x.x.xx.xxxxxXXXX' },
      { name: '彈指', inst: 'snap', gain: 1, pan: -0.35, rev: 0.4, a1: '', a: '', b: '....x.......x...', c: '' },
    ],
    amb: [{ inst: 'void', gain: 0.5 }],
    door: { inst: 'swell', part: 'r:21 C4:11', gain: 0.6, rev: 0.5 },
    extra: () => [{ name: '反向鈸', inst: 'swell', part: stack(at(8, 5, grid('x')), at(16, 5, grid('x')), at(32, 5, grid('x'))), gain: 0.35, rev: 0.4 }],
  },
};

// ───────────────────────── Generator ─────────────────────────

type Sec = 'A' | 'B' | 'C';

/** White key -> the region's tonic and mode (then apply alt) */
function toMode(p: Part, P: Pal, mode: Mode): Part {
  const tonic = midi(P.tonic);
  return mapPitch(p, (m) => {
    const x = remap(m, tonic, mode);
    const to = P.alt?.[(((x - tonic) % 12) + 12) % 12];
    return to === undefined ? x : x + to - ((((x - tonic) % 12) + 12) % 12);
  });
}
function modeOf(P: Pal, s: Sec, melodic: boolean): Mode {
  if (melodic && P.melMode) return P.melMode;
  return (s === 'B' ? P.modeB : s === 'C' ? P.modeC : undefined) ?? P.mode;
}
/** Move the material of one section into the region's mode */
function inKey(P: Pal, s: Sec, p: Part, melodic = false): Part {
  return toMode(p, P, modeOf(P, s, melodic));
}
/** Place at step `step` of bar `bar`; the whole part is one round long */
function at(bar: number, step: number, p: Part | string): Part {
  const q = typeof p === 'string' ? mel(p) : p;
  const off = (bar - 1) * BAR + step;
  return { ev: q.ev.map((e) => ({ ...e, t: e.t + off })), len: BARS * BAR };
}
/** Repeat p to exactly `bars` bars */
function fill(p: Part, bars: number): Part {
  const n = Math.round((bars * BAR) / p.len);
  if (Math.abs(n * p.len - bars * BAR) > 1e-6) throw new Error(`Length ${p.len} does not fill ${bars} bars`);
  return seq(...Array(n).fill(p));
}
/** Reversed instrument: the whole part moved earlier by `steps` steps (wrapping around to the end) */
function early(p: Part, steps: number): Part {
  return { ev: p.ev.map((e) => ({ ...e, t: (e.t - steps + p.len * 4) % p.len })), len: p.len };
}
/** Moving a pentatonic scale over creates repeated adjacent notes: merge them into one long note */
function merge(p: Part): Part {
  const out: Ev[] = [];
  for (const e of [...p.ev].sort((a, b) => a.t - b.t)) {
    const last = out[out.length - 1];
    if (last && last.m.length === 1 && e.m.length === 1 && last.m[0] === e.m[0] && Math.abs(last.t + last.d - e.t) < 1e-6) last.d += e.d;
    else out.push({ ...e });
  }
  return { ev: out, len: p.len };
}
/** Morin khuur style glide: a short note joined to the next note (within a fifth) glides over to it */
function slides(p: Part): Part {
  const ev = [...p.ev].sort((a, b) => a.t - b.t).map((e) => ({ ...e }));
  for (let i = 0; i + 1 < ev.length; i++) {
    const a = ev[i];
    const b = ev[i + 1];
    if (a.d <= 4 && Math.abs(a.t + a.d - b.t) < 1e-6 && a.m[0] !== b.m[0] && Math.abs(a.m[0] - b.m[0]) <= 5) a.glide = true;
  }
  return { ev, len: p.len };
}

function track(name: string, ins: Ins, part: Part, P: Pal): TrackDef {
  const steps = ins.early ? Math.round(ins.early / (15 / P.bpm)) : 0;
  return {
    name,
    inst: ins.inst,
    part: steps ? early(part, steps) : part,
    gain: ins.gain ?? 1,
    pan: ins.pan ?? 0,
    rev: ins.rev ?? 0.3,
    dly: ins.dly,
    hum: ins.hum,
    tr: 12 * (ins.oct ?? 0),
    opts: ins.opts,
  };
}

export function tower(region: string): SongDef {
  const P = PALETTE[region] ?? PALETTE.forest;
  const hB = P.harmB ?? P.harm.b;
  const cA = lament(P.harm.a);
  const cB = prog(hB);
  const cC = lament(P.harm.a.slice(0, 4), 2 * BAR);
  const pc = P.padCenter ?? 60;

  /** Melody: change the mode, then for a pentatonic scale merge notes and add glides */
  const tune = (s: Sec, src: string | Part) => {
    let p = inKey(P, s, typeof src === 'string' ? mel(src) : src, true);
    if (P.merge) p = merge(p);
    if (P.slide) p = slides(p);
    return p;
  };
  // The ostinato's velocity also follows the rise and fall of the sections: A light, A' a little stronger, B the brightest, C pulling back
  const ost = seq(
    inKey(P, 'A', seq(vel(fill(OST_A, 8), 0.78), vel(fill(OST_A, 8), 0.9)), true),
    inKey(P, 'B', arp(cB, OST_B_PAT, { rate: 1, center: 69, v: 0.85, accent: 4 }), true),
    inKey(P, 'C', vel(OST_C, 0.85), true),
  );
  const lead = seq(tune('A', THEME), rest(24));
  const low = seq(rest(8), tune('A', THEME), rest(16));
  const desc = seq(rest(8), tune('A', DESC), rest(16));
  const bLead = seq(rest(16), tune('B', BMEL), rest(8));
  const counter = seq(rest(16), inKey(P, 'B', arp(cB, '2-------1---0---', { rate: 1, center: P.counter.center ?? 57, size: 3 })), rest(8));
  const seal = seq(rest(24), tune('C', SEAL));
  const echo = seq(rest(24), tune('C', ECHO));
  const padP = seq(
    inKey(P, 'A', seq(vel(pad(cA, { center: pc }), 0.5), vel(pad(cA, { center: pc }), 0.62))),
    inKey(P, 'B', vel(pad(cB, { center: pc + 3, size: P.padSizeB ?? 4 }), 0.75)),
    inKey(P, 'C', vel(pad(cC, { center: pc - 3 }), 0.45)),
  );
  const bl = P.bass;
  const bassP = seq(
    inKey(P, 'A', seq(bassline(cA, ...bl.a, { base: 41 }), bassline(cA, ...bl.a, { base: 41 }))),
    inKey(P, 'B', bassline(cB, ...bl.b, { base: 41 })),
    inKey(P, 'C', bassline(cC, ...bl.c, { base: 41 })),
  );

  // Cello voice: open-fifth long notes over the lament bass, supporting 100 to 250 Hz; in regions whose bass is plucked or sub-bass, a contrabass long note is added
  const tenor = (c: Chd[], rh: string) => stack(bassline(c, rh, '1', { base: 45 }), bassline(c, rh, '5', { base: 45 }));
  const celliP = seq(
    inKey(P, 'A', seq(vel(tenor(cA, WHOLE), 0.5), vel(tenor(cA, WHOLE), 0.6))),
    inKey(P, 'B', vel(tenor(cB, WHOLE), 0.7)),
    inKey(P, 'C', vel(tenor(cC, LONG2), 0.65)),
  );
  const floorP = seq(
    inKey(P, 'A', seq(vel(bassline(cA, WHOLE, '1', { base: 33 }), 0.55), vel(bassline(cA, WHOLE, '1', { base: 33 }), 0.65))),
    inKey(P, 'B', vel(bassline(cB, WHOLE, '1', { base: 33 }), 0.7)),
    inKey(P, 'C', vel(bassline(cC, LONG2, '1', { base: 33 }), 0.7)),
  );
  const thinBass = ['pizzBass', 'sub', 'organ'].includes(bl.inst);

  const drumPart = (d: Drum) => {
    const g = (s: string) => (s.includes(':') ? mel(s) : grid(s, 1, d.pitch));
    const sec = (s: string | undefined, bars: number) => (s ? fill(g(s), bars) : rest(bars));
    const c = sec(d.c, 8);
    return seq(sec(d.a1 ?? d.a, 8), sec(d.a, 8), sec(d.b, 8), d.fill !== undefined ? seq(slice(c, 0, 7 * BAR), d.fill ? g(d.fill) : rest(1)) : c);
  };
  const ambNote = (bars: number) => mel(`C4:${bars * BAR}`);

  const tracks: TrackDef[] = [
    track('頑固音型', P.ost, ost, P),
    track('主題', P.lead, lead, P),
    track('低音主題', P.low, low, P),
    track('高音對位', P.desc, desc, P),
    track('塔頂旋律', P.bLead, bLead, P),
    track('B 段對位', P.counter, counter, P),
    track('封印動機', P.seal, seal, P),
    ...(P.echo ? [track('回聲', P.echo, echo, P)] : []),
    track('和弦墊', P.pad, padP, P),
    track('哀歌低音', bl, bassP, P),
    ...(P.celli === false ? [] : [track('大提琴聲部', { inst: 'celli', gain: P.celli ?? 0.4, pan: -0.15, rev: 0.35, opts: { attack: 0.12, release: 0.5 } }, celliP, P)]),
    ...(thinBass ? [track('低音大提琴長音', { inst: 'contrabass', gain: 0.45, rev: 0.3, opts: { attack: 0.1, release: 0.5 } }, floorP, P)] : []),
    ...P.drums.map((d) => ({ ...track(d.name, d, drumPart(d), P), tr: 0 })),
    ...P.amb.map((a) => ({ ...track(a.inst, { rev: 0.15, ...a, opts: { attack: 1, release: 2.5, ...a.opts } }, ambNote(BARS), P), tr: 0 })),
    ...(P.extra?.(P, { cB }) ?? []),
  ];

  // The reversed instrument's early notes wrap around to the end of a round; before first entering the main body, these notes are also put into the tail of the intro
  const lateStart = (ins: Ins, p: Part): TrackDef[] => {
    const steps = ins.early ? Math.round(ins.early / (15 / P.bpm)) : 0;
    const ev = p.ev.filter((e) => e.t < steps).map((e) => ({ ...e, t: 2 * BAR - steps + e.t }));
    return ev.length ? [{ ...track('前奏接主題', { ...ins, early: 0 }, { ev, len: 2 * BAR }, P), tile: false }] : [];
  };
  const intro: TrackDef[] = [
    { ...track('塔門', P.door, mel(P.door.part), P), tr: 0 },
    ...lateStart(P.lead, lead),
    track('低音', { ...bl, gain: (bl.gain ?? 1) * 0.8 }, inKey(P, 'A', mel('C3:32')), P),
    ...P.amb.map((a) => ({ ...track(a.inst, { rev: 0.15, ...a, opts: { attack: 2.5, release: 2.5, ...a.opts } }, ambNote(2), P), tr: 0 })),
  ];

  return {
    title: `伏魔塔・${P.name}`,
    mood: P.mood,
    bpm: P.bpm,
    swing: P.swing,
    swing16: P.swing16,
    space: P.space,
    delay: P.delay,
    gain: P.gain,
    intro,
    tracks,
  };
}
