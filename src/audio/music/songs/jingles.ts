// Short jingles (play once): victory, defeat, fanfare. They use the same orchestra as the score, and both victory and defeat quote the leitmotif (the A -> F# sixth leap).

import { arp, grid, mel, pad, prog, rest, seq, type SongDef } from './_kit.ts';

/** Small fanfare (treasure chest, contracting, tactic, summary): a D major triad rushing upward, with the glockenspiel scattered behind */
export const fanfareSmall: SongDef = {
  title: '小號角',
  mood: '短促明亮的號角',
  bpm: 140,
  once: true,
  space: { size: 1.6, damp: 0.35, mix: 0.8 },
  tracks: [
    { inst: 'trumpet', part: 'D5:1 F#5:1 A5:1 !D6:9 r:4', gain: 0.9, rev: 0.3 },
    { inst: 'harp', part: 'D4:1 F#4:1 A4:1 D5:1 F#5:1 A5:1 D6:6 r:4', gain: 0.7, pan: -0.3, rev: 0.35 },
    { inst: 'glock', part: 'r:3 D6:1 F#6:1 A6:1 D7:6 r:4', gain: 0.55, pan: 0.3, rev: 0.45 },
  ],
};

/** Big fanfare (breakthrough): the leitmotif rushes up to D6, with choir and cymbal */
export const fanfareBig: SongDef = {
  title: '大號角',
  mood: '突破的輝煌瞬間',
  bpm: 120,
  once: true,
  space: { size: 2.2, damp: 0.35, mix: 0.9 },
  tracks: [
    { inst: 'trumpets', part: 'A4:2 F#5:4 E5:1 D5:1 E5:2 !A5:6 | !D6:12 r:4', gain: 0.85, rev: 0.35 },
    { inst: 'horns', part: 'D4:2 A4:4 A4:1 F#4:1 A4:2 !C#5:6 | !A4:12 r:4', gain: 0.7, pan: -0.25, rev: 0.4 },
    { inst: 'strings', part: pad(prog('D | D'), { center: 60 }), gain: 0.7, rev: 0.4, opts: { attack: 0.05 } },
    { inst: 'choir', part: seq(rest(1), mel('D4+F#4+A4+D5:12 r:4')), gain: 0.7, rev: 0.5, opts: { attack: 0.08 } },
    { inst: 'timpani', part: '!D3:1 D3:1 D3:1 D3:1 A2:4 D3:8 | !D3:8 r:8', gain: 0.8, rev: 0.3 },
    { inst: 'harp', part: arp(prog('D'), '0123456789ab....', { rate: 1, center: 60 }), gain: 0.6, pan: 0.3, rev: 0.4 },
    { inst: 'crash', part: seq(rest(1), grid('X...............')), gain: 0.6, rev: 0.3 },
  ],
};

/** Victory: the brass sing the leitmotif, and a plagal cadence G -> D settles on D6 */
export const victory: SongDef = {
  title: '勝利',
  mood: '戰鬥勝利的號角',
  bpm: 124,
  once: true,
  space: { size: 2.2, damp: 0.35, mix: 0.9 },
  tracks: [
    { inst: 'trumpets', part: 'A4:2 F#5:4 E5:1 D5:1 E5:2 B5:2 A5:4 | !D6:12 r:4', gain: 0.9, rev: 0.35 },
    { inst: 'horns', part: 'D4:2 A4:4 A4:1 F#4:1 A4:2 G4:2 E4:4 | F#4:12 r:4', gain: 0.7, pan: -0.25, rev: 0.4 },
    { inst: 'strings', part: pad(prog('D | G/D:4 D:12'), { center: 60 }), gain: 0.75, rev: 0.4, opts: { attack: 0.05 } },
    { inst: 'contrabass', part: 'D2:16 | D2:12 r:4', gain: 0.7 },
    { inst: 'timpani', part: '!D3:2 A2:2 D3:4 r:8 | !D3:1 D3:1 D3:1 D3:1 !D3:4 r:8', gain: 0.8, rev: 0.3 },
    { inst: 'field', part: grid('........oooxxxXX|X...............'), gain: 0.5, rev: 0.25 },
    { inst: 'harp', part: seq(arp(prog('D'), '0123456789ab....', { rate: 1, center: 60 }), rest(1)), gain: 0.6, pan: 0.3, rev: 0.4 },
    { inst: 'glock', part: 'r:16 | D6:2 F#6:2 A6:2 D7:6 r:4', gain: 0.5, pan: 0.35, rev: 0.5 },
    { inst: 'crash', part: seq(rest(1), grid('X...............')), gain: 0.65, rev: 0.3 },
  ],
};

/** Defeat: the minor version of the leitmotif (A -> F, a minor sixth), slowly sinking */
export const defeat: SongDef = {
  title: '戰敗',
  mood: '低落但不絕望',
  bpm: 72,
  once: true,
  space: { size: 2.6, damp: 0.5, mix: 0.9 },
  tracks: [
    { inst: 'horn', part: 'A4:4 F5:6 E5:2 D5:4 | D5:12 r:4', gain: 0.8, rev: 0.45 },
    { inst: 'strPad', part: pad(prog('Dm | Gm/D:8 Dm:8'), { center: 57 }), gain: 0.8, rev: 0.5 },
    { inst: 'contrabass', part: 'D2:16 | D2:12 r:4', gain: 0.6 },
    { inst: 'celesta', part: 'r:16 | r:8 A5:2 F5:2 D5:4', gain: 0.5, pan: 0.3, rev: 0.6 },
  ],
};

export const JINGLES = { fanfareSmall, fanfareBig, victory, defeat };
export type JingleId = keyof typeof JINGLES;
