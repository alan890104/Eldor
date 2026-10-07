// Rules of field exploration (independent of the screen, to ease testing): wild spirit levels and personalities, field battle and treasure chest rewards.

import { getSpirit } from '../data.ts';
import { REGIONS, type Reward, type WildEntry } from './campaign.ts';

/** Danger level of a field area: 0 near the town, 1 field, 2 around the Seal Tower and hidden realms */
export type Tier = 0 | 1 | 2;

/**
 * Wild spirit personalities:
 * shy runs on seeing a person (approach slowly from behind), calm wanders on its own, curious comes over out of curiosity,
 * fierce charges at a person on sight (corrupted spirits are always like this).
 */
export type Temper = 'shy' | 'calm' | 'curious' | 'fierce';

export interface WildSpawn {
  speciesId: string;
  level: number;
  corrupted: boolean;
  temper: Temper;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Personality is set by species (fixed, so the player can learn each spirit's habits) */
export function temperOf(speciesId: string): Temper {
  const sp = getSpirit(speciesId);
  if (sp.rarity === 'SR') return 'shy';
  return (['shy', 'calm', 'curious', 'calm', 'fierce'] as const)[hash(speciesId) % 5];
}

export function pickWeighted<T extends { weight: number }>(list: T[], rnd = Math.random): T {
  const total = list.reduce((a, b) => a + b.weight, 0);
  let r = rnd() * total;
  for (const e of list) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return list[list.length - 1];
}

/** Level range of wild spirits: the region's base level plus an amount by danger level */
export function wildLevelRange(regionIdx: number, tier: Tier, corrupted = false): [number, number] {
  const L = REGIONS[regionIdx].level;
  if (corrupted) return [L + 2 + tier, L + 4 + tier];
  return tier === 0 ? [Math.max(2, L - 3), L] : tier === 1 ? [L - 1, L + 2] : [L + 1, L + 4];
}

/** Spawn a wild spirit in an area; species can restrict the species that appear in that area */
export function rollWild(regionIdx: number, tier: Tier, opts: { species?: string[]; corruptChance?: number } = {}, rnd = Math.random): WildSpawn {
  const region = REGIONS[regionIdx];
  let pool: WildEntry[] = region.explore;
  if (opts.species?.length) {
    const only = region.explore.filter((e) => opts.species!.includes(e.speciesId));
    if (only.length) pool = only;
  }
  // Rare spirits appear only in more dangerous places
  if (tier === 0) {
    const common = pool.filter((e) => getSpirit(e.speciesId).rarity === 'N');
    if (common.length) pool = common;
  } else if (tier === 1) {
    const noSR = pool.filter((e) => getSpirit(e.speciesId).rarity !== 'SR');
    if (noSR.length) pool = noSR;
  }
  const pick = pickWeighted(pool, rnd);
  const corrupted = rnd() < (opts.corruptChance ?? 0);
  const [lo, hi] = wildLevelRange(regionIdx, tier, corrupted);
  const level = Math.min(60, lo + Math.floor(rnd() * (hi - lo + 1)));
  return { speciesId: pick.speciesId, level, corrupted, temper: corrupted ? 'fierce' : temperOf(pick.speciesId) };
}

/** Reward for beating a wild spirit */
export function wildReward(w: WildSpawn, rnd = Math.random): Reward {
  const reward: Reward = { gold: Math.round((60 + w.level * 8) * (w.corrupted ? 1.5 : 1)) };
  if (w.corrupted || rnd() < 0.3) reward.breakStones = w.corrupted ? 2 : 1;
  if (rnd() < 0.12) reward.crystals = 30;
  if (rnd() < 0.08) reward.potions = 1;
  if (rnd() < (w.corrupted ? 0.25 : 0.1)) reward.advStones = 1;
  return reward;
}

/** Contents of a field treasure chest: fixed by region and chest number (the last is the big chest hidden deepest) */
export function chestReward(regionIdx: number, n: number, total: number): Reward {
  const L = REGIONS[regionIdx].level;
  if (n === total - 1) return { gold: 300 + L * 30, tickets: 1, advStones: 2 };
  const kinds: Reward[] = [
    { gold: 150 + L * 20, stones: 3 },
    { gold: 100 + L * 15, potions: 2 },
    { gold: 100 + L * 15, breakStones: 2 + Math.floor(L / 15) },
    { gold: 120 + L * 15, crystals: 50 },
    { gold: 100 + L * 15, advStones: 1, stones: 2 },
  ];
  return kinds[n % kinds.length];
}

export const chestId = (regionId: string, n: number) => `${regionId}:${n}`;
