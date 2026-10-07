// Wild encounter in the Rift, "Upside-Down Waltz": E minor, 3/4 time, quarter note = 180 (one second per bar, one turn per beat).
// In the Rift heaven and earth are turned over, so it is written as a fast, dark waltz, completely unlike the other battle themes' four-four charge.
// The otherworldly feel comes not from noise but from "displaced modulation": between the chords of E minor are inserted chords with a chromatic relationship, such as C minor and Ab major,
// each chord is consonant by itself but joined to the next by only a single common note (C major -> C minor share G, C minor -> Ab share C and Eb,
// Ab -> B7 share Eb = D#), which sounds like the floor under your feet being quietly swapped out; in the end it always passes through B7 back to E minor, so the tonal center stays very stable.
// The vibraphone's arpeggio, four eighth notes per group, laid over three-beat time makes a 4-against-3 cross-rhythm, which is this piece's "twist".
// Sections (56 bars, about 56 seconds):
//   A   Violin sings the theme, the harp plays "oom, pah, pah", the vibraphone's off-beat arpeggio flashes above
//   A'  Strings in unison take the theme, the horns play long-note counterpoint, spiccato strings change over to plucking chords, the snare drum is accented on beat three
//   B   Soprano sings long notes over the harp arpeggios, the harmony floats to G major, Eb major and B major, the drums are left with only the kick and shaker
//   C   First four bars: only the glass harmonica turning the theme up high, a timpani heartbeat and the wind of the void; last four bars: the violin climbs upward, a snare roll rushes back to A

import { arp, bassline, grid, mel, midi, pad, prog, rest, seq, slice, strum, vel, type Part, type SongDef } from './_kit.ts';

const M = 12;
const m = (s: string) => mel(s, M);
const P = (s: string) => prog(s, M);
const R = (bars: number) => rest(bars, M);
const g = (s: string, pitch?: number) => grid(s, 1, pitch);

// ── Harmony (two bars per chord, '%' sustains; the arpeggios therefore span bars, so the 4-against-3 cross-rhythm can play out completely)
const A = P('Em | % | C | % | Am | % | B7 | % | Em | % | Cm | % | Ab | % | B7 | %');
const B = P('G | % | Eb | % | B | % | Em | % | G | % | Eb | % | Cm | % | B7 | %');
const C = P('Em | % | Cm | % | Ab | % | B7 | %');
const C2 = P('Ab | % | B7 | %');

// ── Melody
/** Theme: the broken chord turns once upward and falls back; in the second phrase E becomes Eb, climbs to Eb6, and passes through D# (the same note) back to B7 */
const TUNE = m('B4:4 E5:4 G5:4 | F#5:8 E5:4 | E5:4 G5:4 C6:4 | B5:8 G5:4 | A5:8 G5:2 F#5:2 | E5:8 C5:4 | D#5:4 F#5:4 A5:4 | G5:6 F#5:2 E5:2 D#5:2 | B4:4 E5:4 G5:4 | F#5:8 E5:4 | Eb5:4 G5:4 C6:4 | D6:4 C6:4 G5:4 | Eb6:8 C6:4 | C6:4 Ab5:4 Eb5:4 | D#5:4 F#5:4 B5:4 | A5:6 G5:2 F#5:2 D#5:2');
/** A' horn counterpoint: long notes on the third and seventh of the chords */
const HORN = m('G4:12 | F#4:12 | G4:12 | E4:12 | E4:12 | C4:12 | D#4:12 | F#4:12 | G4:12 | F#4:12 | G4:12 | Eb4:12 | Eb4:12 | C4:12 | D#4:12 | F#4:12');
/** B section soprano: long notes, landing on a new chord tone every two bars */
const SOP = m('D5:12 | B4:8 D5:4 | G5:12 | F5:4 Eb5:4 Bb4:4 | D#5:12 | F#5:8 D#5:4 | E5:12 | E5:8 B4:4 | D5:8 G5:4 | B5:12 | Bb5:8 G5:4 | Eb5:12 | G5:8 C6:4 | C6:8 B5:4 | A5:8 F#5:4 | D#5:12');
/** C section glass harmonica: the head of the theme turns in the high octave, and the second phrase bends to follow C minor */
const BOX = m('B5:4 E6:4 G6:4 | F#6:8 E6:4 | Eb6:4 G6:4 C7:4 | D7:4 C7:4 G6:4');
/** C section rise: climbing all the way along Ab and B7 */
const CLIMB = m('Eb5:4 Ab5:4 C6:4 | Eb6:12 | D#5:4 F#5:4 A5:4 | B5:4 A5:4 F#5:4');

// ── Accompaniment
const OOMPAH = '....x...x...';
const hemiola = (p: typeof A, v = 1) => vel(arp(p, '0123', { rate: 2, center: 76, size: 4 }), v);
const waltz = (p: typeof A) => strum(p, OOMPAH, { center: 60, size: 3, spread: 0.006 });

// ── Percussion (12 steps per bar)
const rep = (s: string, n: number) => s.repeat(n);
const KICK_A = rep(rep('X...........', 3) + 'X.......x.x.', 4);
const KICK_A2 = rep('X...........X.....x.....', 8);
const SNARE_A2 = rep(rep('....o...X...', 7) + '....x.x.xxXX', 2);
const SHAKER = rep('x.o.x.o.x.o.', 16);

/** Reversed piano: sampled for 1.8 seconds, strongest at the tail, started 22 steps early so it breathes in exactly at the first beat of the next section */
const suck = (at: number, notes: string): Part => ({ ev: [{ t: at - 22, d: 22, m: notes.split('+').map(midi), v: 0.9 }], len: 56 * M });

const song: SongDef = {
  title: '倒懸圓舞曲',
  mood: 'E 小調的急速圓舞曲，一小節一轉。小提琴唱主題，和聲在 E 小調與 C 小調、降 A 大調之間錯位地轉；B 段女高音唱長音，C 段只剩玻璃琴與心跳，再衝回主題。',
  bpm: 180,
  meter: M,
  gain: 1.15,
  space: { size: 3.0, damp: 0.35, pre: 0.025, er: 0.3, mix: 0.9 },
  delay: { steps: 6, fb: 0.35, tone: 3500, mix: 0.5 },
  intro: [
    { name: '玻璃琴', inst: 'glass', part: m('B5:4 E6:4 G6:4 | F#6:8 E6:4 | D#6:4 F#6:4 B6:4 | A6:4 G6:4 F#6:4'), tr: -12, gain: 0.9, pan: 0.2, rev: 0.6, dly: 0.35 },
    { name: '虛空', inst: 'void', part: m('C4:48'), gain: 0.5, rev: 0.3, opts: { attack: 0.8, release: 0.6 } },
    { name: '定音鼓', inst: 'timpani', part: seq(m('R | R | B2:12'), g('o.o.x.x.XxXX', 47)), gain: 0.7, rev: 0.3 },
    { name: '倒放鋼琴', inst: 'revPiano', part: { ev: [{ t: 26, d: 22, m: [52, 64, 71], v: 0.9 }], len: 48 }, gain: 0.55, rev: 0.4 },
  ],
  tracks: [
    // ── Main melody
    { name: '小提琴', inst: 'violin', part: seq(TUNE, R(16), R(16), R(4), CLIMB), gain: 2.0, pan: 0.1, rev: 0.35 },
    { name: '鋼片琴', inst: 'celesta', part: seq(R(8), slice(TUNE, 8 * M, 16 * M), R(40)), tr: 12, gain: 0.5, pan: 0.35, rev: 0.5, dly: 0.2 },
    { name: '弦樂齊奏', inst: 'strings', part: seq(R(16), TUNE, R(24)), gain: 2.0, pan: 0.05, rev: 0.35, opts: { attack: 0.02, release: 0.2, bright: 1.2 } },
    { name: '法國號', inst: 'horns', part: seq(R(16), HORN, R(24)), gain: 0.6, pan: -0.3, rev: 0.45, opts: { release: 0.15 } },
    { name: '女高音', inst: 'soprano', part: seq(R(32), SOP, R(8)), gain: 1.3, pan: 0.05, rev: 0.55 },
    { name: '玻璃琴', inst: 'glass', part: seq(R(48), BOX, R(4)), tr: -12, gain: 0.9, pan: 0.2, rev: 0.6, dly: 0.4 },
    // ── Harmony
    { name: '豎琴蓬恰恰', inst: 'harp', part: seq(waltz(A), R(40)), gain: 0.4, pan: -0.25, rev: 0.3 },
    { name: '斷弓和弦', inst: 'spicc', part: seq(R(16), waltz(A), R(20), waltz(C2)), gain: 0.55, pan: -0.25, rev: 0.3 },
    { name: '豎琴琶音', inst: 'harp', part: seq(R(32), arp(B, '0 1 2 3 4 3 2 1 2 3 2 1', { rate: 2, center: 60, size: 4 }), R(8)), gain: 0.4, pan: -0.3, rev: 0.4 },
    { name: '顫音琴', inst: 'vibes', part: seq(hemiola(A, 0.7), hemiola(A), R(20), hemiola(C2, 0.9)), gain: 0.35, pan: 0.35, rev: 0.4, dly: 0.25 },
    { name: '弦樂墊', inst: 'strPad', part: seq(R(32), vel(pad(B, { center: 60, size: 3 }), 0.6), R(4), vel(pad(C2, { center: 60, size: 3 }), 0.75)), gain: 0.6, pan: -0.15, rev: 0.45 },
    // ── Bass
    { name: '低音大提琴', inst: 'contrabass', part: seq(bassline(A, 'x-----......', '1 5', { base: 40 }), bassline(A, 'x-----......', '1 5', { base: 40 }), bassline(B, 'x-----------', '1 5', { base: 40 }), bassline(C, 'x-----......', '1 5', { base: 40 })), gain: 0.6, opts: { attack: 0.02 } },
    { name: '虛空', inst: 'void', part: seq(R(48), m('C4:48'), R(4)), gain: 0.5, rev: 0.3, opts: { attack: 1, release: 1.5 } },
    // ── Percussion
    { name: '定音鼓', inst: 'timpani', part: seq(bassline(A, 'X.......................', '1', { base: 40 }), bassline(A, 'X.......................', '1', { base: 40 }), bassline(B, 'x.......................', '1', { base: 40 }), g(rep('X.......o...', 4), 40), g('............|............|............|o.o.x.x.XxXX', 47)), gain: 0.7, rev: 0.3 },
    { name: '大鼓', inst: 'kick', part: seq(g(KICK_A), g(KICK_A2), g(rep('X.......................', 8)), R(4), g(rep('X...........', 4))), gain: 0.45 },
    { name: '軍鼓', inst: 'field', part: seq(R(16), g(SNARE_A2), R(16), R(4), g('x..x..x..x..|x.x.x.x.x.x.|xxxxxxxxxxxx|XxXxXxXxXXXX')), gain: 0.45, pan: 0.15, rev: 0.3 },
    { name: '沙鈴', inst: 'shaker', part: seq(g(SHAKER), g(SHAKER), g(rep('o.o.o.o.o.o.', 16)), R(8)), gain: 1.0, pan: 0.3 },
    { name: '中鼓', inst: 'tom', part: seq(R(15), g('X.x.x.X.X.X.'), R(15), g('X.x.x.X.XxXx'), R(23), g('X.X.X.X.XXXX')), gain: 0.6, pan: -0.2, rev: 0.3 },
    { name: '鈸', inst: 'crash', part: seq(g('X...........'), R(15), g('X...........'), R(7), g('X...........'), R(7), g('X...........'), R(23)), gain: 0.5, rev: 0.3 },
    { name: '反向鈸', inst: 'swell', part: seq(R(30), g('........X...|............'), R(22), g('........X...|............')), gain: 0.45, rev: 0.3 },
    { name: '倒放鋼琴', inst: 'revPiano', part: suck(16 * M, 'E3+E4+B4'), gain: 0.5, pan: -0.1, rev: 0.4 },
    { name: '倒放鋼琴二', inst: 'revPiano', part: suck(32 * M, 'G3+D4+G4'), gain: 0.5, pan: 0.1, rev: 0.4 },
  ],
};

export default song;
