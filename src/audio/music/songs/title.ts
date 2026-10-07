// Main theme "Eldor Overture": the leitmotif of the whole game.
// Motif: a major-sixth leap A4 -> F#5, followed by an echo of E5 D5 E5 ("the other side of the mountain"). The world map, the ending and the final battle all quote it.
// D major, 76 BPM. Harp arpeggios open -> the flute sings the first phrase -> the horn takes the second -> the strings sing the chorus (rising to a high point on B5) -> full orchestra (trumpets, choir, timpani, snare) -> the celesta coda returns to the opening.

import { arp, bassline, grid, holdRoots, pad, prog, rest, seq, vel, type SongDef } from './_kit.ts';

// ── Main melody
const A1 = 'A4:4 F#5:6 E5:2 D5:2 E5:2 | F#5:4 B4:4 D5:6 C#5:2 | B4:4 G5:6 F#5:2 E5:2 D5:2 | E5:12 r:4';
const A2 = 'A4:4 F#5:6 E5:2 D5:2 E5:2 | F#5:4 A5:4 B5:6 A5:2 | G5:4 F#5:2 E5:2 E5:4 D5:2 E5:2 | D5:12 r:4';
const B = 'G5:6 F#5:2 E5:4 D5:4 | E5:6 F#5:2 E5:4 C#5:4 | C#5:6 D5:2 E5:4 F#5:4 | B5:8 A5:4 F#5:4 | G5:6 F#5:2 E5:4 B4:4 | E5:6 D5:2 C#5:4 E5:4 | D5:4 F#5:4 A5:8 | G5:4 F#5:4 E5:8';
const CODA = 'A5:4 F#6:6 E6:2 D6:2 E6:2 | D6:16 | A5:4 F#6:6 E6:2 D6:2 E6:2 | E6:12 r:4';
/** The horn's counterpoint during the chorus (long notes, moving downward) */
const B_HORN = 'B4:8 A4:8 | C#5:8 A4:8 | A4:16 | F#4:8 B4:8 | B4:8 G4:8 | A4:16 | A4:8 F#4:8 | B4:8 C#5:8';

// ── Harmony
const cA1 = 'D | Bm | G | A';
const cA2 = 'D | Bm | Em7 A7 | D';
const cB = 'G | A | F#m | Bm | Em | A/C# | D | Asus4 A';
const cCoda = 'D | G/D | D | Asus4 A';
const cIntro = 'D | Bm | G | Asus4 A';

const all = prog(`${cA1} | ${cA2} | ${cB} | ${cA1} | ${cA2} | ${cCoda}`);
const quiet = prog(`${cA1} | ${cA2}`);
const bridge = prog(cB);
const full = prog(`${cA1} | ${cA2}`);
const coda = prog(cCoda);
const intro = prog(cIntro);

const song: SongDef = {
  title: '艾爾多序曲',
  mood: '主題曲。遼闊、帶一點鄉愁的英雄感：豎琴與長笛起頭，最後全樂團齊奏。',
  bpm: 76,
  space: { size: 2.8, damp: 0.4, pre: 0.025, er: 0.35, mix: 0.9 },
  intro: [
    { name: '豎琴', inst: 'harp', part: arp(intro, '0 1 2 3 4 3 2 1', { rate: 2, center: 62 }), gain: 0.8, pan: -0.2, rev: 0.45 },
    { name: '弦樂', inst: 'strPad', part: vel(pad(intro, { center: 57 }), 0.5), gain: 0.7, rev: 0.5 },
    { name: '低音', inst: 'contrabass', part: bassline(intro, 'x---------------', '1', { base: 38 }), gain: 0.6 },
    { name: '鐘琴', inst: 'glock', part: 'r:12 A6:4 | R | r:12 F#6:4 | E6:8 r:8', gain: 0.5, pan: 0.3, rev: 0.6 },
  ],
  tracks: [
    { name: '長笛', inst: 'flute', part: seq(A1, rest(24)), gain: 0.9, pan: 0.15, rev: 0.45 },
    { name: '法國號', inst: 'horn', part: seq(rest(4), A2, B_HORN, rest(12)), tr: -12, gain: 0.85, pan: -0.25, rev: 0.5, opts: { release: 0.14 } },
    { name: '弦樂旋律', inst: 'strings', part: seq(rest(8), B, rest(12)), gain: 0.85, pan: 0.2, rev: 0.45, opts: { attack: 0.12 } },
    { name: '小號', inst: 'trumpets', part: seq(rest(16), A1, A2, rest(4)), gain: 0.75, pan: 0.1, rev: 0.4, opts: { release: 0.14 } },
    { name: '法國號齊奏', inst: 'horns', part: seq(rest(16), A1, A2, rest(4)), tr: -12, gain: 0.6, pan: -0.3, rev: 0.45, opts: { release: 0.14 } },
    { name: '鋼片琴尾聲', inst: 'celesta', part: seq(rest(24), CODA), gain: 0.7, pan: 0.25, rev: 0.6 },
    { name: '豎琴', inst: 'harp', part: arp(all, '0 1 2 3 4 3 2 1', { rate: 2, center: 62 }), gain: 0.7, pan: -0.35, rev: 0.4 },
    {
      name: '弦樂墊',
      inst: 'strPad',
      part: seq(vel(pad(quiet, { center: 57 }), 0.55), vel(pad(bridge, { center: 57 }), 0.75), pad(full, { center: 57, size: 4 }), vel(pad(coda, { center: 57 }), 0.5)),
      gain: 0.75,
      rev: 0.45,
    },
    { name: '合唱', inst: 'choirOo', part: seq(rest(8), vel(pad(bridge, { center: 62 }), 0.7), pad(full, { center: 64 }), rest(4)), gain: 0.55, rev: 0.6 },
    {
      name: '低音',
      inst: 'contrabass',
      part: seq(bassline(quiet, 'x---------------', '1', { base: 38 }), bassline(bridge, 'x-------x-------', '1 5', { base: 38 }), bassline(full, 'x-------x---x---', '1 1 5', { base: 38 }), bassline(coda, 'x---------------', '1', { base: 38 })),
      gain: 0.8,
    },
    // Cello section: sustained open fifths above the bass, thickest when the full orchestra plays in unison
    { name: '大提琴聲部', inst: 'celli', part: seq(holdRoots(quiet, 45, true, 0.5), holdRoots(bridge, 45, true, 0.7), holdRoots(full, 45, true, 0.85), holdRoots(coda, 45, true, 0.55)), gain: 0.45, pan: -0.15, rev: 0.45, opts: { attack: 0.2, release: 0.6 } },
    { name: '定音鼓', inst: 'timpani', part: seq(rest(7), '!D3:1 ?D3:1 D3:1 D3:1 D3:1 D3:1 D3:1 D3:1 !A2:8', bassline(bridge, 'x...............', '1', { base: 38 }), bassline(full, 'X.......x.....x.', '1 5 1', { base: 38 }), rest(4)), gain: 0.8, rev: 0.4 },
    { name: '軍鼓', inst: 'field', part: seq(rest(16), grid('x..xx.x.x..xx.x.'.repeat(7) + 'x.x.xxxxXxxxXXXX'), rest(4)), gain: 0.55, pan: 0.1, rev: 0.35 },
    { name: '鈸', inst: 'crash', part: seq(rest(16), grid('X...............'), rest(7), grid('x...............'), rest(3)), gain: 0.7, rev: 0.4 },
  ],
};

export default song;
