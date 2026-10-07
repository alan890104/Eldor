// Helpers for balance analysis: a standard opponent, a representative attack, and the number of hits needed for a KO.

import { SKILL_BY_ID } from './data.ts';
import {
  computeDamage,
  computeStats,
  MAX_LEVEL,
  typeMultiplier,
} from './formulas.ts';
import type { SkillDef, SpiritDef, Stats } from './types.ts';

/** The "standard spirit": every base stat is 80 (BST 480, equivalent to R) */
export const STANDARD_BASE: Stats = { hp: 80, atk: 80, mag: 80, def: 80, res: 80, spd: 80 };

export function statsAtMax(base: Stats): Stats {
  return computeStats(base, MAX_LEVEL, 3);
}

export function isDamaging(s: SkillDef): boolean {
  return s.category === 'physical' || s.category === 'magic';
}

/** Representative attack: the damaging skill in the learnset with cost ≤ 2 and the spirit's own element that has the highest expected power using that spirit's stats */
export function representativeAttack(sp: SpiritDef): SkillDef {
  const stats = sp.base;
  let best: SkillDef | undefined;
  let bestScore = -1;
  for (const { id } of sp.learnset) {
    const s = SKILL_BY_ID.get(id);
    if (!s || !isDamaging(s) || s.cost > 2) continue;
    if (!sp.elements.includes(s.element)) continue;
    const stat = s.category === 'physical' ? stats.atk : stats.mag;
    const score = s.power * (s.accuracy / 100) * stat;
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  if (best) return best;
  return basicAttack(stats.atk >= stats.mag ? 'physical' : 'magic', 60);
}

/** An elementless attack used for analysis (not in the skill table) */
export function basicAttack(category: 'physical' | 'magic', power: number): SkillDef {
  return {
    id: `_${category}_${power}`,
    name: category === 'physical' ? 'Standard physical' : 'Standard magic',
    en: 'Reference',
    element: 'neutral',
    category,
    cost: 0,
    power,
    accuracy: 100,
    priority: 0,
    text: '',
    tags: {},
  };
}

export interface HitResult {
  damage: number;
  percent: number;
  hitsToKo: number;
}

export function hit(
  attacker: { base: Stats; elements: readonly string[] },
  defender: { base: Stats; elements: readonly string[] },
  s: SkillDef,
  level = MAX_LEVEL,
): HitResult {
  const a = computeStats(attacker.base, level, 3);
  const d = computeStats(defender.base, level, 3);
  const physical = s.category === 'physical';
  const damage = computeDamage({
    attack: physical ? a.atk : a.mag,
    defense: physical ? d.def : d.res,
    power: s.power,
    attackerLevel: level,
    typeMult: typeMultiplier(s.element, defender.elements as SpiritDef['elements']),
    stab: attacker.elements.includes(s.element),
  });
  return { damage, percent: damage / d.hp, hitsToKo: Math.ceil(d.hp / damage) };
}
