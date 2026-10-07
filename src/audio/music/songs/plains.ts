// Stormreach (`plains`), "Thunder Chaser": a grassland that stretches beyond sight, with ever-rolling thunderclouds overhead, and nomadic tribes riding horses and following the thunderclouds as they migrate.
// C minor, 4/4, 132 BPM. The very first second is a close lightning strike, and the whole piece has three protagonists:
//   Thunder: a lightning strike (a tearing crack followed by a dull boom and rolling thunder) lands on the first beat of a section, while distant muffled thunder rolls through the quiet sections;
//       timpani rolls push each strike out, and for the flash itself brass stabs and a cymbal crash down together.
//   Horses: a "da, da-da" galloping rhythm (an eighth note followed by two sixteenths), growing from the frame drum's distant hoofbeats into a whole company of cavalry in low strings and toms.
//   People: the morin khuur sings a broad theme, sliding upward at phrase ends; in the storm section strings and trumpets sing a higher second theme, with the choir padding behind.
// The harmony follows the epic i, VI, III, VII (Cm Ab Eb Bb); the storm section ends on a G major triad, returning to C minor for the quiet section.
// Sections (28 bars, about 51 seconds):
//   A   Grassland: wind, distant hoofbeats, solo morin khuur, distant muffled thunder in bar 4
//   A'  Thunderclouds press in: a lightning strike, the strings take up the theme with the horn an octave below, low strings and toms begin to gallop
//   B   Storm: the second theme sung in unison, strings above and trumpets below, choir and taiko come in, lightning strikes with flashes in bars 1 and 5
//   C   Rain: only rain, distant thunder and morin khuur, a timpani roll leads back to A

import { bassline, grid, pad, prog, rest, seq, strum, tr, vel, type SongDef } from './_kit.ts';

// ── Harmony
const A = prog('Cm | Ab | Eb | Bb | Cm | Ab | Ab:8 Bb:8 | Cm');
const B = prog('Ab | Eb | Bb | Cm | Ab | Eb | Bb | Gsus4:8 G:8');
const C = prog('Cm | Ab | Fm | G');

// ── Melody
/** Theme: a leap of a fourth up from C, the highest points on Eb and F, the phrase end sliding back to C */
const MEL_A = 'C5:6 G4:2> C5:4 D5:4 | Eb5:12 D5:2 C5:2 | Bb4:6 G4:2> Bb4:4 C5:4 | D5:16 | Eb5:6 D5:2 C5:4 Eb5:4 | F5:8 Eb5:4 C5:4 | Eb5:4 C5:4 D5:4 F5:4 | C5:12 r:4';
/** The storm's second theme: big leaps of a sixth, each phrase higher than the last, finally stopping on G */
const MEL_B = 'C5:4 Eb5:4 Ab5:8 | G5:6 F5:2 Eb5:8 | F5:4 D5:4 Bb5:8 | G5:12 r:4 | C6:4 Bb5:4 Ab5:8 | G5:4 Bb5:4 Eb6:8 | D6:6 C6:2 Bb5:4 F5:4 | G5:16';
/** The horn's long-note counterpoint in the storm section */
const HORN_B = 'Ab4:16 | G4:16 | F4:16 | Eb4:16 | Ab4:16 | Bb4:16 | F4:16 | C4:8 B3:8';
/** The morin khuur in the rain: the opening of the theme, landing on the leading tone B */
const MEL_C = 'C5:6 G4:2> C5:4 D5:4 | Eb5:12 r:4 | Ab4:6 F4:2> Ab4:4 C5:4 | B4:12 r:4';

// ── Gallop: "da, da-da"
const GALLOP = 'X.xxX.xxX.xxX.xx';
const GALLOP_SOFT = 'x.oox.oox.oox.oo';

const song: SongDef = {
  title: '追雷者',
  mood: 'C 小調的草原暴風。開頭就是一聲落雷，框鼓的馬蹄聲長成整隊騎兵的奔馳；馬頭琴唱寬闊的主題，暴風段弦樂與小號齊唱第二主題，合唱與太鼓壓上來。',
  bpm: 132,
  gain: 0.55,
  space: { size: 3.2, damp: 0.5, pre: 0.03, er: 0.3, mix: 0.8 },
  intro: [
    { name: '落雷', inst: 'thunderclap', part: grid('X...............|................'), gain: 1.1, rev: 0.4 },
    { name: '風', inst: 'wind', part: 'C4:32', gain: 0.7, opts: { attack: 0.3, release: 1.5 } },
    { name: '低音大提琴', inst: 'contrabass', part: 'C2:32', gain: 0.7, opts: { attack: 0.8 } },
    { name: '定音鼓', inst: 'timpani', part: grid('................|o.o.o.o.x.x.XXXX', 1, 43), gain: 0.7, rev: 0.3 },
    { name: '框鼓', inst: 'frame', part: grid('................|x.oox.oox.oox.oo'), gain: 0.5, pan: 0.2, rev: 0.3 },
  ],
  tracks: [
    // ── Melody
    { name: '馬頭琴', inst: 'morin', part: seq(MEL_A, rest(8), rest(8), MEL_C), gain: 1.5, pan: 0.05, rev: 0.4 },
    { name: '弦樂', inst: 'strings', part: seq(rest(8), MEL_A, MEL_B, rest(4)), gain: 1.6, pan: 0.1, rev: 0.35, opts: { attack: 0.03, release: 0.25, bright: 1.15 } },
    { name: '法國號', inst: 'horns', part: seq(rest(8), tr(seq(MEL_A), -12), HORN_B, rest(4)), gain: 0.55, pan: -0.3, rev: 0.45, opts: { release: 0.15 } },
    { name: '小號', inst: 'trumpets', part: seq(rest(16), tr(seq(MEL_B), -12), rest(4)), gain: 0.6, pan: -0.1, rev: 0.35, opts: { release: 0.12 } },
    { name: '合唱', inst: 'choir', part: seq(rest(16), vel(pad(B, { center: 64, size: 3 }), 0.65), rest(4)), gain: 0.8, pan: 0.15, rev: 0.5, opts: { attack: 0.2 } },
    // ── Harmony and bass
    { name: '弦樂墊', inst: 'strPad', part: seq(vel(pad(A, { center: 55, size: 3 }), 0.55), vel(pad(A, { center: 55, size: 3 }), 0.7), rest(8), vel(pad(C, { center: 55, size: 3 }), 0.55)), gain: 0.8, pan: -0.15, rev: 0.45 },
    { name: '奔馳低音', inst: 'spicc', part: seq(rest(8), bassline(A, GALLOP, '1', { base: 48 }), bassline(B, GALLOP, '1', { base: 48 }), rest(4)), gain: 0.7, pan: -0.1, rev: 0.2 },
    { name: '低音大提琴', inst: 'contrabass', part: seq(bassline(A, 'x---------------', '1', { base: 36 }), bassline(A, 'x-------x-------', '1 5', { base: 36 }), bassline(B, 'x-------x-------', '1 5', { base: 36 }), bassline(C, 'x---------------', '1', { base: 36 })), gain: 0.7 },
    // ── Thunder and lightning
    { name: '落雷', inst: 'thunderclap', part: seq(rest(8), grid('X...............'), rest(7), grid('X...............'), rest(3), grid('X...............'), rest(7)), gain: 1.0, rev: 0.4 },
    { name: '遠雷', inst: 'thunder', part: seq(rest(3), grid('X...............'), rest(21), grid('....X...........'), rest(2)), gain: 0.9, pan: -0.3, rev: 0.5 },
    { name: '閃電', inst: 'brassStab', part: seq(rest(8), strum(prog('Cm'), 'X...............', { center: 60, size: 4, spread: 0 }), rest(7), strum(prog('Ab'), 'X...............', { center: 60, size: 4, spread: 0 }), rest(3), strum(prog('Ab'), 'X...............', { center: 60, size: 4, spread: 0 }), rest(7)), gain: 0.7, rev: 0.4 },
    { name: '鈸', inst: 'crash', part: seq(rest(8), grid('X...............'), rest(7), grid('X...............'), rest(3), grid('X...............'), rest(7)), gain: 0.55, rev: 0.3 },
    { name: '定音鼓', inst: 'timpani', part: seq(rest(7), grid('o.o.o.o.x.x.xxXX', 1, 43), rest(7), grid('o.o.x.x.x.xxXXXX', 1, 43), bassline(B, 'X...............', '1', { base: 36 }), rest(3), grid('o.o.o.o.x.x.xxXX', 1, 43)), gain: 0.75, rev: 0.3 },
    // ── Hooves and drums
    { name: '框鼓', inst: 'frame', part: seq(grid(GALLOP_SOFT.repeat(8)), grid(GALLOP.repeat(8)), grid(GALLOP.repeat(8)), grid('x.......x.......'.repeat(4))), gain: 0.5, pan: 0.2, rev: 0.3 },
    { name: '中鼓', inst: 'tom', part: seq(rest(8), grid(('X.......x.......'.repeat(3) + 'X.......x.x.xxxx').repeat(2)), grid(('X.......X.......'.repeat(3) + 'X.x.X.x.XxXxXXXX').repeat(2)), rest(4)), gain: 0.55, pan: -0.2, rev: 0.3 },
    { name: '太鼓', inst: 'taiko', part: seq(rest(16), grid('X.......X.......'.repeat(7) + 'X...X...X.X.XXXX'), rest(4)), gain: 0.7, rev: 0.25 },
    { name: '反向鈸', inst: 'swell', part: seq(rest(15), grid('...X............'), rest(12)), gain: 0.45, rev: 0.3 },
    // ── Weather
    { name: '風', inst: 'wind', part: seq('C4:128', rest(20)), gain: 0.6, opts: { attack: 0.5, release: 2 } },
    { name: '雨', inst: 'rain', part: seq(rest(16), 'C4:192'), gain: 0.6, opts: { attack: 2, release: 1.5 } },
  ],
};

export default song;
