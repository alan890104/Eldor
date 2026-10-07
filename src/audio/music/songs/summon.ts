// Music for the Astralgate summon (D major): it follows the performance, switched by summonMusic.ts at cue points. It uses the same engine and orchestra as the other scenes.
//   idle      Summon pool screen: a loop of bouncing bass, harp arpeggios and light drums; the hook melody is sung every two rounds (16 bars)
//   build     Summon pressed: strings on a suspended chord swell, noise rises, a snare roll gets denser, the kick speeds up; everything is pulled out the instant the meteor launches
//   drop      Meteor flight: only a single sub-bass line is left, so the meteor's Doppler effect sings alone
//   upgrade   Purple to gold: a fast upward glide + a golden major triad
//   gate      Gate opens: cymbal and timpani, then a tense pulsing loop (the R/SR reveal rides on top of it)
//   fanfare   SSR nameplate: a two-bar fanfare theme, flavored by element, then into a bright afterglow loop
//   resolve   Result: an IV, V, I cadence + bells rising, back to idle

import type { Element } from '../../../../sim/types.ts';
import { arp, bassline, grid, mel, pad, prog, rest, seq, type Ev, type Part, type SongDef } from './_kit.ts';

/** Loop tempo */
export const LOOP_BPM = 104;
/** Fanfare tempo */
export const FANFARE_BPM = 128;

const HOOK = 'D5:2 E5:2 F#5:2 A5:2 F#5:2 E5:2 D5:4 | C#5:2 E5:2 A5:4 G#5:2 F#5:2 E5:4 | G5:3 F#5:1 E5:2 D5:2 B4:2 D5:2 G5:4 | F#5:2 E5:2 C#5:4 D5:8';
const HOOK_UP = 'D6:2 E6:2 F#6:2 A6:2 F#6:2 E6:2 D6:4 | C#6:2 E6:2 A6:4 G#6:2 F#6:2 E6:4 | G6:3 F#6:1 E6:2 D6:2 B5:2 D6:2 G6:4 | F#6:2 E6:2 C#6:4 D6:8';
const EIGHT = 'D | A | Bm | G | D | A | G | A';
/** One glockenspiel note every two bars: two octaves above the chord's third */
const SPARKLE = 'A6:10 r:6 | R | F#6:10 r:6 | R | A6:10 r:6 | R | D6:10 r:6 | R';

/** The summon pool screen loop: 16 bars, the hook melody only in bars 5 to 8 */
export const idle: SongDef = {
  title: '星門',
  mood: '卡池畫面的輕快循環',
  bpm: LOOP_BPM,
  space: { size: 1.8, damp: 0.35, mix: 0.85 },
  tracks: [
    { name: '和弦墊', inst: 'warmPad', part: pad(prog(`${EIGHT} | ${EIGHT}`), { center: 66, size: 4 }), gain: 0.55, rev: 0.4, opts: { attack: 0.25, release: 0.3, cut: 1500 } },
    { name: '貝斯', inst: 'bass', part: bassline(prog(`${EIGHT} | ${EIGHT}`), 'x--...x-x--.x-x-', '1 1 1 5 8', { base: 33 }), gain: 0.9 },
    { name: '豎琴', inst: 'harp', part: arp(prog(EIGHT), '0.12.3..4.56.7..', { rate: 1, center: 66, size: 4 }), gain: 0.55, pan: -0.25, rev: 0.35 },
    { name: '勾子', inst: 'flute', part: seq(rest(4), HOOK, rest(8)), gain: 0.8, pan: 0.15, rev: 0.35 },
    { name: '鐘琴', inst: 'glock', part: SPARKLE, gain: 0.4, pan: 0.3, rev: 0.5 },
    { name: '大鼓', inst: 'kick', part: grid('x.......x.......'), gain: 0.55, rev: 0.05 },
    { name: '拍手', inst: 'clap', part: grid('....x.......x...'), gain: 0.35, rev: 0.2 },
    { name: '鈸', inst: 'hat', part: grid('x.xox.xox.xox..o'), gain: 0.45, pan: 0.2, rev: 0.1 },
    { name: '開鈸', inst: 'ohat', part: grid('..............x.'), gain: 0.4, pan: 0.2, rev: 0.1 },
  ],
};

/** Afterglow after an SSR: the same loop, brighter, sung every round, with choir and glockenspiel layered on the melody */
export const afterglow: SongDef = {
  title: '星門・餘韻',
  mood: 'SSR 揭曉後的明亮循環',
  bpm: LOOP_BPM,
  space: { size: 2.0, damp: 0.3, mix: 0.9 },
  tracks: [
    { name: '和弦墊', inst: 'warmPad', part: pad(prog(EIGHT), { center: 66, size: 4 }), gain: 0.65, rev: 0.4, opts: { attack: 0.25, release: 0.3, cut: 2400 } },
    { name: '合唱', inst: 'choirOo', part: pad(prog(EIGHT), { center: 62, size: 3 }), gain: 0.6, rev: 0.55, opts: { attack: 0.5 } },
    { name: '貝斯', inst: 'bass', part: bassline(prog(EIGHT), 'x--...x-x--.x-x-', '1 1 1 5 8', { base: 33 }), gain: 0.9 },
    { name: '豎琴', inst: 'harp', part: arp(prog(EIGHT), '0.12.3..4.56.7..', { rate: 1, center: 66, size: 4 }), gain: 0.6, pan: -0.25, rev: 0.35 },
    { name: '勾子', inst: 'flute', part: seq(HOOK, HOOK), gain: 0.95, pan: 0.15, rev: 0.35 },
    { name: '勾子高八度', inst: 'glock', part: seq(HOOK_UP, HOOK_UP), gain: 0.3, pan: -0.1, rev: 0.45 },
    { name: '鐘琴', inst: 'glock', part: SPARKLE, gain: 0.5, pan: 0.3, rev: 0.5 },
    { name: '大鼓', inst: 'kick', part: grid('x...x...x...x...'), gain: 0.6, rev: 0.05 },
    { name: '小鼓', inst: 'snare', part: grid('....x.......x...'), gain: 0.5, rev: 0.2 },
    { name: '鈸', inst: 'hat', part: grid('xoxoxoxoxoxoxo.o'), gain: 0.5, pan: 0.2, rev: 0.1 },
    { name: '開鈸', inst: 'ohat', part: grid('..............x.'), gain: 0.45, pan: 0.2, rev: 0.1 },
  ],
};

/** Tense pulse after the gate opens: Dsus2 never resolves, and the celesta up high ticks like the second hand of a countdown (2 bars) */
export const tension: SongDef = {
  title: '星門・開門',
  mood: '揭曉前的脈動',
  bpm: LOOP_BPM,
  space: { size: 1.6, damp: 0.45, mix: 0.8 },
  tracks: [
    { name: '和弦墊', inst: 'warmPad', part: mel('D4+E4+A4+D5:16 | D4+E4+A4+D5:16'), gain: 0.5, rev: 0.4, opts: { attack: 0.2, release: 0.3, cut: 1100 } },
    { name: '貝斯', inst: 'bass', part: '!D2:2 ?D2:2 !D2:2 ?D2:2 !D2:2 ?D2:2 !D2:2 F2:2', gain: 0.9 },
    { name: '鈸', inst: 'hat', part: grid('xoooxoooxoooxooo'), gain: 0.4, pan: 0.2, rev: 0.1 },
    { name: '大鼓', inst: 'kick', part: grid('x.......x.......'), gain: 0.55 },
    { name: '低鼓', inst: 'tom', part: grid('......x.......x.', 1, 45), gain: 0.35, rev: 0.2 },
    { name: '小鼓', inst: 'snare', part: grid('............o...'), gain: 0.4, rev: 0.2 },
    { name: '秒針', inst: 'celesta', part: 'r:2 D5:2 r:2 D5:2 r:2 A5:2 r:2 D5:2', gain: 0.45, pan: -0.3, rev: 0.4 },
    { name: '鐘琴', inst: 'glock', part: 'R | D6:8 r:8', gain: 0.35, pan: 0.3, rev: 0.5 },
  ],
};

// ───────────────────────── One-shot sections (bpm 60: one step = 0.25 s, so they are easy to lay out in seconds) ─────────────────────────

const S = (sec: number) => sec * 4;
const once = (title: string, tracks: SongDef['tracks'], size = 1.8): SongDef => ({ title, mood: '', bpm: 60, once: true, space: { size, damp: 0.4, mix: 0.85 }, tracks: tracks.map((t) => ({ hum: 0, ...t })) });
const part = (ev: Ev[], len: number): Part => ({ ev, len });
const hit = (sec: number, v = 0.8, m: number[] = []): Ev => ({ t: S(sec), d: 1, m, v });

/** Summon pressed: the meteor launches after dur seconds */
export function build(dur: number): SongDef {
  const L = S(dur);
  const snares: Ev[] = [];
  const hats: Ev[] = [];
  let t = 0;
  let gap = 0.17;
  while (t < dur - 0.02) {
    const k = t / dur;
    snares.push(hit(t, 0.2 + 0.8 * k));
    if (k > 0.75) hats.push(hit(t, 0.7));
    t += gap;
    gap = Math.max(0.038, gap * 0.86);
  }
  const kicks: Ev[] = [];
  for (let tk = 0; tk < dur - 0.05; tk += 0.29) kicks.push(hit(tk, 0.5 + 0.35 * (tk / dur)));
  kicks.push(hit(dur - 0.02, 1));
  const end = L + S(1.2);
  return once('召喚・蓄力', [
    { inst: 'strings', part: part([{ t: 0, d: L, m: [57, 62, 64, 69], v: 0.9 }], end), gain: 0.9, rev: 0.4, opts: { attack: dur * 0.9, release: 0.15 } },
    { inst: 'choirOo', part: part([{ t: L * 0.4, d: L * 0.6, m: [57, 64], v: 0.8 }], end), gain: 0.8, rev: 0.5, opts: { attack: dur * 0.5, release: 0.15 } },
    { inst: 'riser', part: part([{ t: 0, d: S(dur + 0.9), m: [60], v: 0.7 }], end), gain: 0.7, rev: 0.3 },
    { inst: 'snare', part: part(snares, end), gain: 0.5, rev: 0.25 },
    { inst: 'hat', part: part(hats, end), gain: 0.4 },
    { inst: 'kick', part: part(kicks, end), gain: 0.7 },
    { inst: 'bass', part: part([{ t: 0, d: L / 2, m: [38], v: 0.7 }, { t: L / 2, d: L / 2, m: [45], v: 0.75 }], end), gain: 0.9 },
    { inst: 'crash', part: part([hit(dur - 0.02, 0.6)], end), gain: 0.6, rev: 0.3 },
  ]);
}

/** Meteor flight: the sub-bass on D1 */
export const drop: SongDef = once('召喚・流星', [{ inst: 'sub', part: part([{ t: 0, d: S(0.8), m: [26], v: 0.8 }], S(1.6)), opts: { attack: 0.15, release: 0.5 } }]);

/** Purple to gold: an upward glide, a golden D major triad */
export const upgrade: SongDef = once('召喚・升金', [
  { inst: 'synthLead', part: part([{ t: 0, d: S(0.3), m: [57], v: 0.6, glide: true }, { t: S(0.3), d: 0.4, m: [93], v: 0.6 }], S(1.8)), gain: 0.5, opts: { glide: 0.3, release: 0.05 } },
  { inst: 'trumpets', part: part([{ t: S(0.3), d: S(0.9), m: [62, 66, 69, 74], v: 0.85, strum: 0.03 }], S(1.8)), gain: 0.8, rev: 0.4 },
  { inst: 'choir', part: part([{ t: S(0.3), d: S(1.2), m: [62, 69], v: 0.85 }], S(1.8)), gain: 0.8, rev: 0.5, opts: { attack: 0.1 } },
  { inst: 'timpani', part: part([hit(0.3, 0.9, [38])], S(1.8)), gain: 0.8 },
  { inst: 'crash', part: part([hit(0.3, 0.7)], S(1.8)), gain: 0.6, rev: 0.3 },
]);

/** The gate-opening hit (summonMusic then starts the tense loop) */
export const gate: SongDef = once('召喚・開門', [
  { inst: 'crash', part: part([hit(0, 0.8)], S(1)), gain: 0.65, rev: 0.3 },
  { inst: 'timpani', part: part([hit(0, 0.9, [38])], S(1)), gain: 0.85 },
]);

/** Dark element: press the major scale's 3rd, 6th and 7th degrees down into minor */
const minor = (m: number): number => {
  const pc = (((m - 2) % 12) + 12) % 12;
  return pc === 4 || pc === 9 || pc === 11 ? m - 1 : m;
};

/** SSR fanfare (2 bars, 128 BPM), flavored by element; when it ends summonMusic hands over to the afterglow loop */
export function fanfare(el: Element): SongDef {
  const trn = el === 'earth' ? -2 : 0;
  const fix = (m: number) => (el === 'dark' ? minor(m) : m) + trn;
  const E = 2; // eighth note = 2 steps
  const MEL: [number, number, number][] = [[74, 0, 1], [69, 1, 1], [74, 2, 1], [78, 3, 1], [81, 4, 2], [78, 6, 1], [81, 7, 1], [83, 8, 2], [81, 10, 1], [78, 11, 1], [86, 12, 4]];
  const mev = (k = 0): Ev[] => MEL.map(([m, s, l]) => ({ t: s * E, d: l * E * 0.95, m: [fix(m) + k], v: 0.85 }));
  const LEN = 32;
  const CH: [number[], number, number][] = [[[50, 62, 66, 69, 74], 0, 8], [[43, 55, 59, 62, 67], 8, 2], [[45, 57, 61, 64, 69], 10, 2], [[50, 62, 66, 69, 74], 12, 6]];
  const padEv: Ev[] = [];
  const choirEv: Ev[] = [];
  const bassEv: Ev[] = [];
  for (const [ch, s, l] of CH) {
    const tones = ch.slice(1).map(fix);
    padEv.push({ t: s * E, d: l * E, m: tones, v: 0.8 });
    choirEv.push({ t: s * E, d: l * E, m: tones.slice(0, 3), v: 0.8 });
    bassEv.push({ t: s * E, d: l * E * 0.9, m: [ch[0] - 12 + trn], v: 0.9 });
  }
  const kick: Ev[] = [];
  const hat: Ev[] = [];
  const ohat: Ev[] = [];
  const snare: Ev[] = [];
  const timp: Ev[] = [];
  const snap: Ev[] = [];
  for (let i = 0; i < 16; i += 2) {
    kick.push({ t: i * E, d: 1, m: [], v: 0.85 });
    (el === 'wind' && i % 4 === 2 ? ohat : hat).push({ t: i * E, d: 1, m: [], v: 0.8 });
    hat.push({ t: (i + 1) * E, d: 1, m: [], v: 0.45 });
    if (i % 4 === 2) snare.push({ t: i * E, d: 1, m: [], v: 0.9 });
    if (i % 8 === 0 || i === 12) timp.push({ t: i * E, d: 1, m: [el === 'earth' ? 36 : 38], v: el === 'earth' ? 1 : el === 'fire' ? 0.9 : 0.8 });
    if (el === 'thunder') {
      if (i % 4 === 0) snap.push({ t: i * E, d: 1, m: [], v: 1 });
      snare.push({ t: (i + 1) * E, d: 1, m: [], v: 0.4 });
    }
  }
  if (el === 'dark') for (const d of [0.55, 0.9]) timp.push({ t: 12 * E + d * (FANFARE_BPM / 60) * 4, d: 1, m: [33], v: 0.8 });
  const tracks: SongDef['tracks'] = [
    { name: '號角', inst: 'trumpets', part: part(mev(), LEN), gain: 0.9, rev: 0.35, hum: 0 },
    { name: '和弦墊', inst: 'warmPad', part: part(padEv, LEN), gain: 0.55, rev: 0.4, opts: { attack: 0.05, cut: 2200 } },
    { name: '合唱', inst: 'choir', part: part(choirEv, LEN), gain: el === 'water' || el === 'light' ? 0.85 : 0.6, rev: 0.5, opts: { attack: 0.08 } },
    { name: '貝斯', inst: 'bass', part: part(bassEv, LEN), gain: 0.9 },
    { name: '大鼓', inst: 'kick', part: part(kick, LEN), gain: 0.7 },
    { name: '鈸', inst: 'hat', part: part(hat, LEN), gain: 0.45, pan: 0.2 },
    { name: '小鼓', inst: 'snare', part: part(snare, LEN), gain: 0.55, rev: 0.2 },
    { name: '定音鼓', inst: 'timpani', part: part(timp, LEN), gain: 0.85, rev: 0.25 },
    { name: '過門', inst: 'tom', part: part([52, 48, 43].map((m, i) => ({ t: 10 * E + i, d: 1, m: [m], v: 0.8 })), LEN), gain: 0.6, rev: 0.2 },
    { name: '鈸', inst: 'crash', part: part([{ t: 0, d: 1, m: [], v: 0.8 }, { t: 12 * E, d: 1, m: [], v: 0.9 }], LEN), gain: 0.6, rev: 0.3 },
    { name: '地鳴', inst: 'boom', part: part([{ t: 0, d: 1, m: [], v: 0.8 }, { t: 12 * E, d: 1, m: [], v: 0.9 }], LEN), gain: 0.7 },
  ];
  if (ohat.length) tracks.push({ inst: 'ohat', part: part(ohat, LEN), gain: 0.45, pan: 0.2 });
  if (snap.length) tracks.push({ inst: 'snap', part: part(snap, LEN), gain: 0.7, rev: 0.2 });
  if (el === 'fire') tracks.push({ name: '火：低八度的長號', inst: 'trombone', part: part(mev(-12), LEN), gain: 0.6, rev: 0.3 });
  if (el === 'nature') tracks.push({ name: '自然：豎琴高八度', inst: 'harp', part: part(mev(12), LEN), gain: 0.55, pan: -0.3, rev: 0.4 });
  if (el === 'wind') tracks.push({ name: '風：長笛高八度', inst: 'flute', part: part(mev(12), LEN), gain: 0.6, pan: 0.3, rev: 0.4 });
  if (el === 'light') tracks.push({ name: '光：鐘琴高八度', inst: 'glock', part: part(mev(12), LEN), gain: 0.5, pan: 0.3, rev: 0.5 });
  if (el === 'neutral') tracks.push({ name: '無：木頭的敲擊', inst: 'rim', part: part(mev().map((e) => ({ ...e, m: [] })), LEN), gain: 0.5 });
  if (el === 'water') tracks.push({ name: '水：往上滑的正弦', inst: 'sub', part: part([{ t: 0, d: 1, m: [57], v: 0.5, glide: true }, { t: 1, d: 10, m: [76], v: 0.5 }], LEN), gain: 0.35, rev: 0.6, opts: { glide: 1.0, release: 0.3 } });
  if (el === 'thunder') tracks.push({ name: '雷：銅管重音', inst: 'brassStab', part: part([0, 8, 12].map((s) => ({ t: s * E, d: 1, m: [74, 78, 81], v: 0.8 })), LEN), gain: 0.5, rev: 0.25 });
  return { title: '召喚・SSR', mood: '', bpm: FANFARE_BPM, once: true, space: { size: 2.2, damp: 0.35, mix: 0.9 }, tracks };
}

/** Resolve: IV, V, I, bells rising */
export const resolve: SongDef = once('召喚・結算', [
  { inst: 'warmPad', part: part([[[55, 59, 62, 67], 0, 0.42], [[57, 61, 64, 69], 0.42, 0.42], [[62, 66, 69, 74], 0.84, 2.2]].map(([m, t, d]) => ({ t: S(t as number), d: S(d as number), m: m as number[], v: 0.85 })), S(4)), gain: 0.6, rev: 0.4, opts: { attack: 0.03, cut: 2400 } },
  { inst: 'harp', part: part([[[67, 71, 74, 79], 0], [[69, 73, 76, 81], 0.42], [[74, 78, 81, 86], 0.84]].map(([m, t]) => ({ t: S(t as number), d: S(0.6), m: m as number[], v: 0.8, strum: 0.03 })), S(4)), gain: 0.6, rev: 0.4 },
  { inst: 'bass', part: part([[31, 0, 0.42], [33, 0.42, 0.42], [38, 0.84, 2.0]].map(([m, t, d]) => ({ t: S(t), d: S(d), m: [m], v: 0.9 })), S(4)), gain: 0.9 },
  { inst: 'kick', part: part([0, 0.42, 0.84].map((t) => hit(t, 0.85)), S(4)), gain: 0.65 },
  { inst: 'crash', part: part([hit(0.84, 0.6)], S(4)), gain: 0.55, rev: 0.3 },
  { inst: 'celesta', part: part([74, 78, 81, 86, 90].map((m, i) => ({ t: S(0.9 + i * 0.07), d: S(1.6), m: [m], v: 0.8 })), S(4)), gain: 0.6, pan: 0.25, rev: 0.5 },
  { inst: 'choirOo', part: part([{ t: S(0.84), d: S(2.2), m: [62, 69], v: 0.8 }], S(4)), gain: 0.7, rev: 0.5, opts: { attack: 0.2 } },
]);

/** Time to return to idle after the result (seconds) */
export const RESOLVE_TO_IDLE = 3.0;
/** Length of the SSR fanfare (seconds): the afterglow follows */
export const FANFARE_SEC = (32 * 60) / FANFARE_BPM / 4;
