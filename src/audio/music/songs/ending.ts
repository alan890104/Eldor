// "Origin Heart" ending: the scene after the final boss falls and the Rift closes. A victory with tears in its eyes, which in the end must leave the warmth of "the adventure is not over yet".
// E major (a whole tone above the main theme), 4/4, 66 BPM, the long reverb of a hall. The whole piece is the leitmotif's journey home:
// P: a solo felt piano slowly plays out the first section of the main theme (the major sixth B4 -> G#5, then F# E F#), the left hand opens out arpeggios with the pedal; bar 7 borrows Am6.
// S: the strings enter and sing this piece's own melody: from C#6 all the way down toward home in a "long, short, long, long" pattern (the opposite direction to the leitmotif's upward leap),
//   the cello walks a contrary counterpoint beneath; at bar 5 E5 -> C#6 hides the sixth leap back in.
// V: a wordless soprano vocalise, with choirOo padding the harmony beneath: at bar 5, over C# minor, it sings the minor-sixth version of the motif (G#5 -> E6),
//   and the C natural over Am6 in bar 7 is the place in the whole piece that most wants to cry.
// T: full orchestra: trumpets and choir sing the theme together one last time, with horn counterpoint, timpani and a reversed cymbal pushing in; at bar 6 the melody's highest point C#6 goes to the strings and soprano (the trumpets and choir drop an octave and support from below),
//   the ending is a minor plagal cadence E -> Am6/E, with the soprano stopping on the C natural.
// The coda has only the music box playing the motif, C resolving to B, the clockwork slowly running down, and finally stopping on F# (the second degree, not a full ending), which leads back to the opening piano.

import { arp, bassline, grid, mel, pad, prog, rest, seq, stack, vel, type Chd, type SongDef } from './_kit.ts';

// ── Harmony (8 bars per section, 4 bars for the coda)
const cP = 'E | C#m7 | Amaj7 | B7sus4 B7 | E/G# | Amaj7 | Am6 B7 | E';
const cS = 'A | E/G# | F#m7 | B7sus4 B7 | C#m | G#m | A | Bsus4 B';
const cV = 'E | F#m7 | Aadd9 | B7sus4 B7 | C#m | A | Am6 | E/B B7';
const cT = 'E | C#m | A | Bsus4 B | E | C#m7 | F#m7 B7 | E Am6/E';
const pP = prog(cP);
const pS = prog(cS);
const pV = prog(cV);
const pT = prog(cT);

// ── P: piano solo (the first section of the main theme, in E major)
const P_MEL = `B4:4 G#5:6 F#5:2 E5:2 F#5:2 | G#5:4 C#5:4 E5:6 D#5:2 | C#5:4 A5:6 G#5:2 F#5:2 E5:2 | F#5:12 r:4 |
  B4:4 G#5:6 F#5:2 E5:2 F#5:2 | G#5:4 B5:4 C#6:6 B5:2 | A5:4 G#5:2 F#5:2 F#5:4 E5:2 F#5:2 | E5:12 r:4`;

// ── S: the strings sing this piece's own melody, the cello a contrary counterpoint
const S_MEL = `C#6:6 B5:2 A5:4 E5:4 | G#5:6 F#5:2 E5:4 B4:4 | A5:6 G#5:2 F#5:4 C#5:4 | E5:8 D#5:8 |
  E5:4 C#6:12 | B5:6 A5:2 G#5:4 D#5:4 | C#5:4 A5:8 G#5:2 F#5:2 | F#5:12 r:4`;
const S_CELLO = 'C#4:8 E4:8 | B3:8 E4:8 | A3:8 C#4:8 | A3:4 B3:4 C#4:4 D#4:4 | E4:8 C#4:8 | B3:8 D#4:8 | A3:8 C#4:8 | E4:8 D#4:8';

// ── V: wordless soprano vocalise
const V_SOP = `B4:4 G#5:8 F#5:2 E5:2 | F#5:12 r:4 | C#5:4 A5:8 G#5:2 F#5:2 | E5:8 D#5:8 |
  G#5:4 E6:12 | C#6:6 B5:2 A5:4 E5:4 | C6:6 B5:2 A5:4 F#5:4 | G#5:8 F#5:8`;

// ── T: full orchestra. Trumpets and choir sing the theme; at bar 6 the trumpets and choir drop an octave, and the highest point C#6 goes to the strings and soprano
const T_TPT = `B4:4 G#5:6 F#5:2 E5:2 F#5:2 | G#5:4 C#5:4 E5:6 D#5:2 | C#5:4 A5:6 G#5:2 F#5:2 E5:2 | F#5:12 r:4 |
  B4:4 G#5:6 F#5:2 E5:2 F#5:2 | G#4:4 B4:4 C#5:6 B4:2 | A5:4 G#5:2 F#5:2 F#5:4 E5:2 F#5:2 | E5:12 r:4`;
const T_TOP = `B4:4 G#5:6 F#5:2 E5:2 F#5:2 | G#5:4 C#5:4 E5:6 D#5:2 | C#5:4 A5:6 G#5:2 F#5:2 E5:2 | F#5:12 r:4 |
  B4:4 G#5:6 F#5:2 E5:2 F#5:2 | G#5:4 B5:4 C#6:6 B5:2 | A5:4 G#5:2 F#5:2 F#5:4 E5:2 F#5:2 | E5:12 r:4`;
const T_SOP = 'R | R | R | R | r:8 B5:8 | G#5:4 B5:4 C#6:6 B5:2 | C#6:8 B5:4 A5:4 | B5:8 C6:8';
const T_HORNS = 'E4:16 | E4:8 G#4:8 | A4:8 C#5:8 | B4:8 A4:8 | G#4:16 | C#5:8 E5:8 | C#5:8 D#5:8 | B4:8 C5:8';

// ── Coda: only the music box. The motif above, the comb-tooth bass below
const C_BOX = stack(
  mel('B5:4 G#6:6 F#6:2 E6:2 F#6:2 | G#6:4 E6:4 C#6:8 | B5:4 G#6:8 F#6:4 | E6:4 F#6:12'),
  vel(mel('E4:4 B4:4 E5:4 B4:4 | A4:4 E5:4 A5:4 E5:4 | E4:4 B4:4 E5:4 B4:4 | A4:4 E5:4 B4:4 D#5:4'), 0.55),
);

// ── Accompaniment
const LH = (p: Chd[], v: number) => arp(p, '0 1 2 3 4 3 2 1', { rate: 2, center: 55, v });
const PIANO_LH = seq(LH(pP, 0.5), LH(pS, 0.38), rest(16), rest(4));
const PIANO_BASS = seq(bassline(pP, 'x-------x-------', '1 1', { base: 36, v: 0.55 }), bassline(pS, 'x---------------', '1', { base: 36, v: 0.4 }), rest(20));
const HARP = seq(rest(16), arp(pV, '0 1 2 3 4 3 2 1', { rate: 2, center: 62, v: 0.5 }), arp(pT, '0 1 2 3 4 5 4 3 2 1 2 3 4 3 2 1', { rate: 1, center: 60, v: 0.55 }), rest(4));
const STRPAD = seq(rest(8), vel(pad(pS, { center: 60 }), 0.5), vel(pad(pV, { center: 60 }), 0.6), vel(pad(pT, { center: 60, size: 3 }), 0.7), rest(4));
const CHOIR_PAD = seq(rest(16), vel(pad(pV, { center: 64, size: 3, gap: 2 }), 0.6), vel(pad(pT, { center: 64, size: 3, gap: 2 }), 0.75), rest(4));
const BASS = seq(rest(8), bassline(pS, 'x---------------', '1', { base: 36 }), bassline(pV, 'x---------------', '1', { base: 36 }), bassline(pT, 'x-------x-------', '1 5', { base: 36 }), rest(4));

// ── Percussion: a roll in the last bar of V, a reversed cymbal, a cymbal at the start of T
const TIMP = seq(
  rest(23),
  seq(vel(mel('(B2:1)*8'), 0.4), vel(mel('(B2:1)*4'), 0.65), mel('(B2:1)*4')),
  '!E2:4 r:12 | R | A2:4 r:12 | B2:4 r:4 B2:2 B2:2 B2:4 | !E2:4 r:12 | A2:4 r:12 | F#2:4 r:4 B2:4 r:4 | E2:8 A2:8',
  rest(4),
);
const SWELL = seq(rest(23), grid('.........x......'), rest(12));
const CRASH = seq(rest(24), grid('X...............'), rest(3), grid('x...............'), rest(7));

const song: SongDef = {
  title: '源初之心',
  mood: '結局。毛氈鋼琴獨奏主導動機，弦樂與大提琴接上，女高音吟唱，全樂團最後一次唱出主題，尾聲只剩音樂盒。',
  bpm: 66,
  gain: 1.1,
  space: { size: 3.2, damp: 0.42, pre: 0.03, er: 0.3, mix: 0.95 },
  tracks: [
    { name: '鋼琴右手', inst: 'softPiano', part: seq(P_MEL, rest(28)), gain: 1.2, pan: 0.05, rev: 0.45, hum: 0.02 },
    { name: '鋼琴左手', inst: 'softPiano', part: PIANO_LH, gain: 0.7, pan: -0.15, rev: 0.5, hum: 0.02, opts: { ring: 1 } },
    { name: '鋼琴低音', inst: 'softPiano', part: PIANO_BASS, gain: 0.7, pan: -0.1, rev: 0.5, opts: { ring: 1 } },
    { name: '弦樂旋律', inst: 'strings', part: seq(rest(8), S_MEL, rest(8), T_TOP, rest(4)), gain: 0.8, pan: 0.2, rev: 0.5, opts: { attack: 0.18 } },
    { name: '大提琴', inst: 'cello', part: seq(rest(8), S_CELLO, rest(20)), gain: 0.75, pan: -0.3, rev: 0.45 },
    { name: '女高音', inst: 'soprano', part: seq(rest(16), V_SOP, T_SOP, rest(4)), gain: 0.8, pan: 0.1, rev: 0.55 },
    { name: '合唱墊', inst: 'choirOo', part: CHOIR_PAD, gain: 0.6, pan: 0, rev: 0.6 },
    { name: '合唱', inst: 'choir', part: seq(rest(24), T_TPT, rest(4)), gain: 0.55, pan: -0.1, rev: 0.55 },
    { name: '小號', inst: 'trumpets', part: seq(rest(24), T_TPT, rest(4)), gain: 0.6, pan: 0.15, rev: 0.45, opts: { release: 0.14 } },
    { name: '法國號', inst: 'horn', part: seq(rest(24), T_HORNS, rest(4)), gain: 0.85, pan: -0.3, rev: 0.5, opts: { release: 0.14 } },
    { name: '弦樂墊', inst: 'strPad', part: STRPAD, gain: 0.6, rev: 0.55 },
    { name: '豎琴', inst: 'harp', part: HARP, gain: 0.55, pan: 0.35, rev: 0.5 },
    { name: '低音', inst: 'contrabass', part: BASS, gain: 0.5, rev: 0.3 },
    { name: '定音鼓', inst: 'timpani', part: TIMP, gain: 0.7, rev: 0.45 },
    { name: '反向鈸', inst: 'swell', part: SWELL, gain: 0.6, rev: 0.4 },
    { name: '鈸', inst: 'crash', part: CRASH, gain: 0.5, rev: 0.5 },
    { name: '音樂盒', inst: 'musicbox', part: seq(rest(32), C_BOX), gain: 1.3, pan: 0.1, rev: 0.55 },
  ],
};

export default song;
