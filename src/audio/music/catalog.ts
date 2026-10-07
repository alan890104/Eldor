// Track list: scene -> song. Song files are loaded on demand (downloaded only when the scene switches).
// Regional versions (Seal Tower, wild encounters) are varied by one generator from the region's instruments and mode.

import type { SongDef } from './engine.ts';

type Loader = () => Promise<SongDef>;
const d = (p: Promise<{ default: SongDef }>) => p.then((m) => m.default);

export const REGION_IDS = ['forest', 'isles', 'volcano', 'highland', 'canyon', 'plains', 'holy', 'shadow', 'rift'] as const;
export const REGION_NAMES: Record<string, string> = {
  forest: '翠語森林',
  isles: '潮歌群島',
  volcano: '焰脊火山帶',
  highland: '蒼嘯高原',
  canyon: '磐心峽谷',
  plains: '雷鳴荒原',
  holy: '曦光聖都',
  shadow: '暮影幽境',
  rift: '虛蝕裂隙',
  hub: '星門廣場',
};

export const SONGS: Record<string, Loader> = {
  title: () => d(import('./songs/title.ts')),
  hub: () => d(import('./songs/hub.ts')),
  map: () => d(import('./songs/map.ts')),
  ending: () => d(import('./songs/ending.ts')),
  'field:forest': () => d(import('./songs/forest.ts')),
  'field:isles': () => d(import('./songs/isles.ts')),
  'field:volcano': () => d(import('./songs/volcano.ts')),
  'field:highland': () => d(import('./songs/highland.ts')),
  'field:canyon': () => d(import('./songs/canyon.ts')),
  'field:plains': () => d(import('./songs/plains.ts')),
  'field:holy': () => d(import('./songs/holy.ts')),
  'field:shadow': () => d(import('./songs/shadow.ts')),
  'field:rift': () => d(import('./songs/rift.ts')),
  trainer: () => d(import('./songs/trainer.ts')),
  rival: () => d(import('./songs/rival.ts')),
  arena: () => d(import('./songs/arena.ts')),
  corrupt: () => d(import('./songs/corrupt.ts')),
  cult: () => d(import('./songs/cult.ts')),
  boss: () => d(import('./songs/boss.ts')),
  final: () => d(import('./songs/final.ts')),
};
for (const r of REGION_IDS) {
  SONGS[`tower:${r}`] = () => import('./songs/tower.ts').then((m) => m.tower(r));
  SONGS[`wild:${r}`] = () => import('./songs/wild.ts').then((m) => m.wild(r));
}
SONGS['wild:hub'] = () => import('./songs/wild.ts').then((m) => m.wild('hub'));
// The Rift's wild encounter is a separately written waltz, not produced by the generator
SONGS['wild:rift'] = () => d(import('./songs/wildRift.ts'));

/**
 * Mastering EQ: after measuring each song's spectrum, add body in the low-mids (an orchestral recording is centered at 63-250 Hz, and 1 kHz sits 5-7 dB below it).
 * warm: how many dB to add at 150 Hz; cut: how many dB to pull at 1.3 kHz; trim: pull the loudness back to the original level (dB). Songs not listed are already thick enough and are left alone.
 * The numbers are measured: the amount by which (500 Hz + 1 kHz) exceeds (125 + 250 Hz); warm makes up 70% of it and cut takes back 30%.
 */
export const MASTERING: Record<string, NonNullable<SongDef['master']>> = {
  title: { warm: 5, cut: 2, trim: -1.6 },
  hub: { warm: 4.5, cut: 2, trim: -0.9 },
  map: { warm: 3, cut: 1, trim: -1.6 },
  ending: { warm: 2, cut: 1, trim: -0.5 },
  'field:forest': { warm: 3, cut: 1, trim: -1.1 },
  'field:isles': { warm: 2.5, cut: 1, trim: -0.9 },
  'field:highland': { warm: 6, cut: 2.5, trim: -0.3 },
  'field:plains': { warm: 1.5, cut: 0.5, trim: -0.3 },
  'field:holy': { warm: 3.5, cut: 1.5, trim: -0.9 },
  'field:shadow': { warm: 6, cut: 2.5, trim: -1.3 },
  'field:rift': { warm: 3.5, cut: 1.5, trim: -0.9 },
  rival: { warm: 1, cut: 0.5, trim: -0.9 },
  arena: { warm: 1.5, cut: 0.5, trim: -0.8 },
  corrupt: { warm: 2.5, cut: 1, trim: -0.9 },
  cult: { warm: 2, cut: 1, trim: -1.3 },
  boss: { warm: 1, cut: 0.5, trim: -0.6 },
  'tower:forest': { warm: 1.5, cut: 0.5, trim: -0.8 },
  'wild:forest': { warm: 3.5, cut: 1.5, trim: -1.2 },
  'tower:isles': { warm: 5, cut: 2, trim: -1.5 },
  'tower:highland': { warm: 3.5, cut: 1.5, trim: -1.4 },
  'wild:highland': { warm: 2, cut: 1, trim: -1.1 },
  'tower:canyon': { warm: 2, cut: 1, trim: -1.2 },
  'wild:canyon': { warm: 0.5, cut: 0, trim: -0.7 },
  'tower:plains': { warm: 2, cut: 1, trim: -0.8 },
  'wild:plains': { warm: 3, cut: 1, trim: -1.2 },
  'tower:holy': { warm: 6.5, cut: 2.5, trim: -1.3 },
  'wild:holy': { warm: 4, cut: 1.5, trim: -1.6 },
  'tower:shadow': { warm: 2.5, cut: 1, trim: -1.3 },
  'wild:shadow': { warm: 1.5, cut: 0.5, trim: -1 },
  'tower:rift': { warm: 3.5, cut: 1.5, trim: -0.8 },
  'wild:rift': { warm: 3, cut: 1.5, trim: -0.4 },
  'wild:hub': { warm: 1.5, cut: 0.5, trim: -0.9 },
};
for (const [id, load] of Object.entries(SONGS)) SONGS[id] = () => load().then((def) => (MASTERING[id] && !def.master ? { ...def, master: MASTERING[id] } : def));

/** Categories for the listening room */
export const GROUPS: [string, string[]][] = [
  ['主題與城鎮', ['title', 'hub', 'map', 'ending']],
  ['野外', REGION_IDS.map((r) => `field:${r}`)],
  ['伏魔塔', REGION_IDS.map((r) => `tower:${r}`)],
  ['野外遭遇戰', ['wild:hub', ...REGION_IDS.map((r) => `wild:${r}`)]],
  ['對戰', ['trainer', 'rival', 'arena', 'corrupt', 'cult', 'boss', 'final']],
];

export async function loadSong(id: string): Promise<SongDef> {
  const l = SONGS[id];
  if (!l) throw new Error(`No such track: ${id}`);
  return l();
}

/** Battle music: by stage kind and region */
export function battleSong(kind: 'wild' | 'trainer' | 'corrupt' | 'cult' | 'rival' | 'boss' | 'final' | 'arena', region: string): string {
  if (kind === 'wild') return SONGS[`wild:${region}`] ? `wild:${region}` : 'wild:hub';
  return kind;
}
