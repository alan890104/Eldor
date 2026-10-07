// Star Gate Arena: ten tiers of opponents, all flattened to Lv 60, team cost cap 12.

import { getSpirit } from '../data.ts';
import type { ArtId } from '../engine/types.ts';

export const COST: Record<string, number> = { N: 2, R: 3, SR: 4, SSR: 5 };
export const COST_CAP = 12;

export interface ArenaFoe {
  name: string;
  title: string;
  team: string[];
  art: ArtId;
  ai: number;
  reward: { crystals: number; gold: number; tickets?: number };
}

export const ARENA: ArenaFoe[] = [
  { name: '新人 阿米', title: '見習', team: ['cloudfluff', 'monolith', 'skyreign'], art: 'oath_guard', ai: 0.55, reward: { crystals: 100, gold: 800 } },
  { name: '蘑菇愛好者 菲菲', title: '青銅', team: ['dreamcap', 'icecrown', 'pyrewing'], art: 'light_purify', ai: 0.62, reward: { crystals: 120, gold: 1000 } },
  { name: '牧羊人 托托', title: '青銅', team: ['stormram', 'eclipse_batlord', 'monolith'], art: 'aether_spring', ai: 0.68, reward: { crystals: 140, gold: 1200 } },
  { name: '公會新秀 蘿絲', title: '白銀', team: ['pyre_dragoon', 'oathsea_sage', 'elderwood_warden'], art: 'oath_break', ai: 0.72, reward: { crystals: 160, gold: 1400 } },
  { name: '伏技師 賽拉', title: '白銀', team: ['sand_reaper', 'soul_lantern', 'chime_sprite'], art: 'eye_insight', ai: 0.76, reward: { crystals: 180, gold: 1600, tickets: 1 } },
  { name: '劍聖 卡諾', title: '黃金', team: ['relic_blade', 'gale_weasel', 'magma_golem'], art: 'oath_gale', ai: 0.8, reward: { crystals: 200, gold: 1800 } },
  { name: '炎王之友 焰', title: '黃金', team: ['ignisar', 'grimoire', 'cloudfluff'], art: 'aether_spring', ai: 0.84, reward: { crystals: 220, gold: 2000, tickets: 1 } },
  { name: '潮汐歌者 瑟菈', title: '星輝', team: ['thalassene', 'gale_weasel', 'eclipse_batlord'], art: 'light_purify', ai: 0.88, reward: { crystals: 250, gold: 2200 } },
  { name: '雷狼 柯爾', title: '聖靈', team: ['voltarion', 'noxfang', 'monolith'], art: 'oath_break', ai: 0.92, reward: { crystals: 300, gold: 2500, tickets: 2 } },
  { name: '傳說締約者 艾爾達', title: '傳說', team: ['luminael', 'terragon', 'dreamcap'], art: 'eye_insight', ai: 0.96, reward: { crystals: 500, gold: 5000, tickets: 5 } },
];

export function teamCost(speciesIds: string[]): number {
  return speciesIds.reduce((s, id) => s + COST[getSpirit(id).rarity], 0);
}
