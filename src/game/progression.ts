// Experience, leveling, breakthrough, and the settlement of stage rewards.

import { battleExp, expToNext, STAGE_LEVEL_CAP } from '../../sim/formulas.ts';
import { findSkill, getSpirit, learnedSkills, SYSTEM_SKILL_IDS } from '../data.ts';
import type { SpiritInstance } from '../engine/types.ts';
import type { Reward } from './campaign.ts';
import type { SaveData } from './save.ts';

/** The game's experience multiplier (the design document's curve is for long-term live service, while the single-player main story should be faster; the higher the level, the higher the multiplier) */
export function expRate(level: number): number {
  return 2 + level * 0.07;
}

export const BREAKTHROUGH_COST = {
  2: { gold: 3000, breakStones: 5, shards: 0 },
  3: { gold: 8000, breakStones: 10, shards: 3 },
} as const;

export interface LevelGain {
  uid: string;
  before: number;
  after: number;
  exp: number;
  newSkills: string[];
  capped: boolean;
}

export function levelCap(s: SpiritInstance): number {
  return STAGE_LEVEL_CAP[s.stage];
}

/** Give a spirit experience and return the level-up info. At the stage cap, experience stays at full. */
export function giveExp(s: SpiritInstance, amount: number): LevelGain {
  const before = s.level;
  const oldLearned = learnedSkills(getSpirit(s.speciesId), s.level);
  s.exp += amount;
  const cap = levelCap(s);
  while (s.level < cap && s.exp >= expToNext(s.level)) {
    s.exp -= expToNext(s.level);
    s.level++;
  }
  let capped = false;
  if (s.level >= cap) {
    s.exp = Math.min(s.exp, expToNext(s.level) - 1);
    capped = s.level < 60;
  }
  const newLearned = learnedSkills(getSpirit(s.speciesId), s.level).filter((id) => !oldLearned.includes(id));
  // Newly learned skill: placed automatically if the skill bar has an open slot
  for (const id of newLearned) {
    if (s.loadout.length < 4 && !s.loadout.includes(id)) s.loadout.push(id);
  }
  return { uid: s.uid, before, after: s.level, exp: amount, newSkills: newLearned, capped };
}

export function canBreakthrough(s: SpiritInstance): boolean {
  return s.stage < 3 && s.level >= levelCap(s);
}

export function breakthroughCost(s: SpiritInstance) {
  return BREAKTHROUGH_COST[(s.stage + 1) as 2 | 3];
}

export function hasBreakthroughMaterials(d: SaveData, s: SpiritInstance): boolean {
  if (s.stage >= 3) return false;
  const c = breakthroughCost(s);
  return d.inv.gold >= c.gold && d.inv.breakStones >= c.breakStones && d.inv.shards >= c.shards;
}

export function breakthrough(d: SaveData, s: SpiritInstance): boolean {
  if (!canBreakthrough(s) || !hasBreakthroughMaterials(d, s)) return false;
  const c = breakthroughCost(s);
  d.inv.gold -= c.gold;
  d.inv.breakStones -= c.breakStones;
  d.inv.shards -= c.shards;
  s.stage = (s.stage + 1) as 2 | 3;
  d.stats.breakthroughs++;
  return true;
}

/** Experience each deployed spirit gets after a battle victory */
export function battleExpFor(s: SpiritInstance, defeated: { level: number }[], boss: boolean): number {
  const sum = defeated.reduce((a, e) => a + battleExp(e.level, s.level), 0);
  return Math.floor(sum * expRate(s.level) * (boss ? 1.5 : 1));
}

export function applyReward(d: SaveData, r: Reward, scale = 1): Reward {
  const got: Reward = {
    gold: Math.floor(r.gold * scale),
    crystals: r.crystals ? Math.floor(r.crystals * scale) : 0,
    tickets: r.tickets ? Math.floor(r.tickets * scale) : 0,
    breakStones: r.breakStones ? Math.max(scale < 1 ? 0 : 1, Math.floor(r.breakStones * scale)) : 0,
    shards: r.shards ? Math.floor(r.shards * scale) : 0,
    potions: r.potions ? Math.floor(r.potions * scale) : 0,
    stones: r.stones ? Math.floor(r.stones * scale) : 0,
    advStones: r.advStones ? Math.floor(r.advStones * scale) : 0,
    masterStones: r.masterStones ? Math.floor(r.masterStones * scale) : 0,
  };
  d.inv.gold += got.gold;
  d.inv.crystals += got.crystals ?? 0;
  d.inv.tickets += got.tickets ?? 0;
  d.inv.breakStones += got.breakStones ?? 0;
  d.inv.shards += got.shards ?? 0;
  d.inv.potions += got.potions ?? 0;
  d.inv.stones.basic += got.stones ?? 0;
  d.inv.stones.advanced += got.advStones ?? 0;
  d.inv.stones.master += got.masterStones ?? 0;
  return got;
}

/** Experience potion: one bottle gives experience equal to a "same-level wild spirit × 4" */
export function potionExp(s: SpiritInstance): number {
  return Math.floor(battleExp(s.level, s.level) * 4 * expRate(s.level));
}

/**
 * Validity of a skill loadout: 1 to 4 skills, no duplicates, all skills the spirit has already learned at its current level (ultimates and guard do not take a skill-bar slot).
 * When level is omitted the level is not checked. When it returns the "bring at least one 0-cost attack" recommendation it can still be saved (it is only a reminder).
 */
export function validateLoadout(speciesId: string, loadout: string[], level = 60): string | null {
  if (loadout.length === 0) return '至少要有一個技能';
  if (loadout.length > 4) return '最多 4 個技能';
  if (new Set(loadout).size !== loadout.length) return '不能重複攜帶同一個技能';
  const learned = learnedSkills(getSpirit(speciesId), level);
  for (const id of loadout) {
    const s = findSkill(id);
    if (!s || s.category === 'ultimate' || SYSTEM_SKILL_IDS.has(id)) return '這個技能不能放進技能欄';
    if (!learned.includes(id)) return '尚未習得這個技能';
  }
  if (!loadout.some((id) => findSkill(id)!.cost === 0 && findSkill(id)!.power > 0)) return '建議至少帶一個 0 費攻擊';
  return null;
}
