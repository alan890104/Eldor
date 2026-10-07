// Stoneheart Canyon (`canyon`): a sandstone gorge of the earth element, a dwarf kingdom built on the back of a sleeping giant tortoise.
// C Dorian (A natural, Bb), 4/4, 84 BPM, with a heavy tread.
// Signature: a bass drum "thud, thud" every two bars, the giant tortoise's heartbeat, never stopping from the intro to the end of the loop.
// The theme is the bassoon's work song: three strikes on the same C (like a pickaxe hitting three times), then carried up Eb F G; in bar two A natural lands on F, which is where the Dorian flavour is.
// The humor comes from the bassoon: low notes that suddenly drop an octave, a B natural that should not be there, a stubborn accent at the end of a phrase. The tuba goes "oom" on the downbeat and the tom goes "clack" on beats two and four, the rhythm of the pick.
// A: the work song of bassoon + tuba, the male voices shout once on the downbeat of even-numbered bars (odd-numbered bars are the heartbeat).
// B: male choir + horn, the pride of the kingdom, C minor -> Ab -> Bb, the second phrase stops on a C major triad (a Picardy cadence), with the horn singing that E natural.
// C: quiet. Water drops, heartbeat, the cello sings the work song's motif at double length, and the three Cs that were funny become solemn.
// A': all the dwarves sing along with the bassoon (male voices in unison on the melody), the horn holds long notes above; in the last bar F -> G, leading back to the opening Cm.

import { bassline, grid, mel, pad, prog, progLen, rest, seq, vel, type Chd, type Part, type SongDef } from './_kit.ts';

const R = (n: number) => rest(n);
/** One long root note per chord */
/** Merge adjacent identical chords into one long chord */
const slow = (h: string) => h.split('|').map((s) => s.trim()).map((c, i, a) => (i > 0 && c === a[i - 1] ? '%' : c)).join(' | ');
const roots = (p: Chd[], lo: number, v = 0.78): Part => ({ ev: p.map((c) => ({ t: c.t, d: c.d, m: [lo + ((c.bass - (lo % 12) + 12) % 12)], v })), len: progLen(p) });
const E = '................';

// ── Harmony (8 bars per section)
const hA = 'Cm | F | Cm | Gm | Cm | F | Bb | Cm';
const hB = 'Cm | Ab | Bb | Cm | Cm | Ab | Bb | C';
const hC = 'Cm | Cm | F | F | Cm | Ab | Bb | G';
const hA2 = 'Cm | F | Cm | Gm | Cm | F | Bb | F G';
/** The first seven bars of A' (the tuba of the eighth bar is written separately) */
const hA2a = 'Cm | F | Cm | Gm | Cm | F | Bb';

// ── A: the bassoon's work song
const WORK = [
  '!C3:2 ?C3:2 !C3:2 r:2 Eb3:2 F3:2 G3:4 | A3:3 G3:1 F3:2 Eb3:2 F3:4 r:4 |',
  '!C3:2 ?C3:2 !C3:2 r:2 G3:2 Bb3:2 C4:4 | D4:2 C4:2 Bb3:2 A3:2 G3:2 r:2 ?D3:1 !G2:3 |',
  '!C3:2 ?C3:2 !C3:2 r:2 Eb3:2 F3:2 G3:4 | A3:3 Bb3:1 C4:2 D4:2 Eb4:4 r:2 ?D4:1 ?C4:1 |',
  'D4:2 C4:2 Bb3:2 F3:2 D3:4 r:2 B2:2 |',
].join(' ');
const WORK_END_A = '!C3:4 r:4 ?G2:2 ?G2:2 !C3:4';
/** The last bar of A': F -> G, stubbornly stopping on G2, leading back to the three Cs at the beginning */
const WORK_END_A2 = '!C3:2 r:2 A2:2 C3:2 !B2:4 r:2 ?G2:1 !G2:1';

// ── B: the horn's kingdom melody (a dotted rhythm climbing upward, the second phrase an octave higher, finally singing up to E5)
const HORN_B = [
  'G3:3 C4:1 C4:8 D4:2 Eb4:2 | Eb4:3 Ab4:1 Ab4:8 G4:2 F4:2 | F4:3 Bb4:1 Bb4:6 C5:2 D5:4 | C5:12 r:4 |',
  'G4:3 C5:1 C5:8 D5:2 Eb5:2 | Eb5:6 D5:2 C5:4 Ab4:4 | Bb4:4 D5:4 F5:6 D5:2 | E5:16',
].join(' ');
/** Bar four of the B section: the bassoon cannot help knocking three times again */
const BSN_B = 'R | R | R | r:8 ?C3:2 ?C3:2 !C3:2 r:2 | R*4';

// ── C: the cello plays the work song at double length
const CELLO_C = [
  'C4:4 C4:4 C4:4 r:4 | Eb4:4 F4:4 G4:8 | A4:6 G4:2 F4:4 Eb4:4 | F4:12 r:4 |',
  'C4:4 C4:4 C4:4 G4:4 | C5:8 Bb4:4 Ab4:4 | G4:6 F4:2 D4:8 | D4:8 B3:8',
].join(' ');

// ── A': the horn holds long notes above
const HORN_A2 = 'G4:16 | A4:8 C5:8 | G4:16 | Bb4:8 A4:8 | G4:12 Bb4:4 | C5:8 A4:8 | Bb4:8 D5:8 | C5:8 B4:8';

// ── Percussion
/** Pickaxe: the tom goes "clack" on beats two and four, with a light pickup stroke before */
const PICK = 'r:3 ?G3:1 !C3:4 r:3 ?G3:1 !C3:4';
const PICK_FILL = 'r:3 ?G3:1 !C3:4 r:2 G3:1 G3:1 !C3:2 C3:1 C3:1';
/** Stone: the "clack" of the pick tip hitting stone (a woodblock tuned low serves as the stone), layered with the tom */
const STONE = 'r:4 !D5:4 r:4 !E5:4';
/** Phrase end: after the strike, gravel rolls down */
const STONE_FILL = 'r:4 !D5:4 r:4 !E5:1 ?A5:1 ?F5:1 ?C6:1';
/** The three strikes of the intro, ending with gravel rolling down */
const STONE_HIT = '!D5:4 !E5:4 !D5:2 ?A5:1 ?F5:1 ?C6:1 ?G5:1 r:2';
/** Heartbeat: one "thud, thud", once every two bars */
const beat = (v: number, n: number) => vel(grid(('X.o.' + '.'.repeat(28)).repeat(n)), v);

const song: SongDef = {
  title: '磐心峽谷',
  mood: '地屬性野外。C 多利安、4/4、84 BPM：地鳴與鎬子敲石開場，低音管與低音號的工作歌，中鼓、木魚與定音鼓敲出鶴嘴鋤的節奏，每兩小節一次巨龜的心跳；B 段男聲合唱與法國號，C 段只剩水滴、心跳與大提琴。',
  bpm: 84,
  space: { size: 3, damp: 0.62, pre: 0.035, er: 0.45, mix: 0.85 },
  gain: 1,
  intro: [
    // On entry first the ground rumble and the tortoise's heartbeat, then three pickaxe strikes on stone (gravel rolling down); these three strikes are the three Cs at the opening of the bassoon theme
    { name: '地鳴', inst: 'thunder', part: mel('!C1:32'), gain: 1.1, rev: 0.25, opts: { tune: 1 } },
    { name: '心跳', inst: 'boom', part: beat(1, 1), gain: 0.9, rev: 0.2 },
    { name: '鎬子', inst: 'tom', part: mel('R | !C3:4 !C3:4 !C3:4 r:4'), gain: 0.6, pan: 0.3, rev: 0.3 },
    { name: '石', inst: 'woodblock', part: mel(`R | ${STONE_HIT}`), gain: 1.2, pan: 0.3, rev: 0.35 },
    { name: '洞窟', inst: 'cave', part: mel('C4:32'), gain: 1.2, rev: 0.2, opts: { attack: 1, release: 2 } },
    { name: '水滴', inst: 'drip', part: mel('r:5 G6:2 r:9 | R'), gain: 1, pan: -0.3, rev: 0.5 },
    { name: '低音大提琴', inst: 'contrabass', part: mel('r:16 C2:16'), gain: 0.5, rev: 0.3, opts: { attack: 1 } },
  ],
  tracks: [
    // Melody
    { name: '低音管', inst: 'bassoon', part: seq(WORK, WORK_END_A, BSN_B, R(8), WORK, WORK_END_A2), gain: 1.15, pan: 0.12, rev: 0.3, opts: { vib: 4 } },
    { name: '男聲齊唱', inst: 'menChoir', part: seq(R(24), vel(seq(WORK, WORK_END_A2), 0.9)), gain: 0.85, pan: -0.1, rev: 0.4, opts: { attack: 0.06, release: 0.25 } },
    { name: '法國號', inst: 'horn', part: seq(R(8), HORN_B, R(8), vel(mel(HORN_A2), 0.72)), gain: 1, pan: -0.25, rev: 0.45 },
    { name: '大提琴', inst: 'cello', part: seq(R(16), CELLO_C, R(8)), gain: 0.9, pan: 0.2, rev: 0.45, opts: { vib: 12, glide: 0.1 } },
    // Choir and bass
    { name: '男聲合唱', inst: 'menChoir', part: seq(R(8), pad(prog(hB), { center: 55, size: 3 }), R(16)), gain: 0.45, rev: 0.55, opts: { attack: 0.35, release: 0.8 } },
    {
      name: '吆喝',
      inst: 'menChoir',
      part: seq(mel('R | !C3+G3:2 r:14 | R | !G2+D3:2 r:14 | R | !C3+G3:2 r:14 | R | !C3+G3:2 r:14'), R(24)),
      gain: 0.75,
      pan: 0.05,
      rev: 0.35,
      opts: { attack: 0.02, release: 0.3 },
    },
    {
      name: '低音號',
      inst: 'tuba',
      part: seq(bassline(prog(hA), 'x---....x---....', '1 -5'), bassline(prog(hB), 'x---------------', '1'), R(8), bassline(prog(hA2a), 'x---....x---....', '1 -5'), mel('F2:4 r:4 G1:4 r:4')),
      gain: 0.8,
      rev: 0.25,
    },
    {
      name: '低音大提琴',
      inst: 'contrabass',
      part: seq(roots(prog(hA), 36, 0.55), roots(prog(hB), 36, 0.7), roots(prog(slow(hC)), 31, 0.6), roots(prog(hA2), 36, 0.62)),
      gain: 0.55,
      rev: 0.3,
      opts: { attack: 0.3, release: 0.6 },
    },
    // Percussion
    {
      name: '鎬子',
      inst: 'tom',
      part: seq(mel(`${PICK} | ${PICK} | ${PICK} | ${PICK_FILL} | ${PICK} | ${PICK} | ${PICK} | ${PICK_FILL}`), R(16), mel(`${PICK} | ${PICK} | ${PICK} | ${PICK_FILL} | ${PICK} | ${PICK} | ${PICK} | ${PICK_FILL}`)),
      gain: 0.42,
      pan: 0.3,
      rev: 0.2,
    },
    {
      name: '定音鼓',
      inst: 'timpani',
      part: seq(
        mel('!C3:16 | R | R | r:8 ?G2:2 G2:2 !C3:4 | !C3:16 | R | R | r:8 G2:1 G2:1 G2:1 G2:1 G2:1 G2:1 G2:1 G2:1'),
        bassline(prog(hB), 'X.......x.......', '1', { base: 43 }),
        R(8),
        mel('!C3:16 | R | R | r:8 ?G2:2 G2:2 !C3:4 | !C3:16 | R | R | r:8 ?G2:2 G2:2 !G2:2 G2:1 G2:1'),
      ),
      gain: 0.75,
      rev: 0.3,
    },
    {
      name: '石',
      inst: 'woodblock',
      part: seq(mel(`${STONE} | ${STONE} | ${STONE} | ${STONE_FILL} | ${STONE} | ${STONE} | ${STONE} | ${STONE_FILL}`), R(16), mel(`${STONE} | ${STONE} | ${STONE} | ${STONE_FILL} | ${STONE} | ${STONE} | ${STONE} | ${STONE_FILL}`)),
      gain: 1,
      pan: 0.3,
      rev: 0.3,
    },
    { name: '心跳', inst: 'boom', part: seq(beat(0.85, 8), beat(1, 4), beat(0.85, 4)), gain: 0.7, rev: 0.2 },
    // Ground rumble: at the start of the loop and the start of the C section, the tortoise turns over once
    { name: '地鳴', inst: 'thunder', part: mel('!C1:16 R*15 !C1:16 R*15'), gain: 0.9, rev: 0.25, opts: { tune: 1 } },
    // Ambience
    {
      name: '水滴',
      inst: 'drip',
      part: seq(
        mel('r:13 G6:2 r:1 | R | R | r:6 C6:2 r:8 | R | r:10 Eb6:2 r:4 | R | R'),
        mel('R | r:7 Bb5:2 r:7 | R | R | r:12 G6:2 r:2 | R | R | R'),
        mel('r:5 G6:2 r:9 | r:2 Eb6:2 r:6 C6:2 r:4 | r:11 Bb5:2 r:3 | r:4 G6:2 r:3 F6:2 r:5 | r:9 C6:2 r:5 | r:1 Eb6:2 r:10 G6:2 r:1 | r:6 D6:2 r:8 | r:3 Bb5:2 r:7 C6:2 r:2'),
        mel('R | R | r:9 Eb6:2 r:5 | R | R | r:3 G6:2 r:11 | R | R'),
      ),
      gain: 1.4,
      pan: -0.35,
      rev: 0.55,
    },
    { name: '洞窟', inst: 'cave', part: mel('C4:128 C4:128 C4:128 C4:128'), gain: 1, rev: 0.2, opts: { attack: 2, release: 2 } },
  ],
};

export default song;
