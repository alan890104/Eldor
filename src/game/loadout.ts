// Auto loadout: newly obtained spirits, enemies and arena opponents all pick 4 skills with this set of rules; on loading a save, sanitizeLoadout fixes the skill bar.
// The rules only look at the learnset, skill tags and core (the kit's loadout priority order), and hard-code no skill id.

import { findSkill, findSpirit, getSpirit, learnedSkills, SYSTEM_SKILL_IDS } from '../data.ts';
import type { SkillDef, SpiritDef } from '../../sim/types.ts';
import type { SpiritInstance } from '../engine/types.ts';

function isDamaging(s: SkillDef): boolean {
  return s.category === 'physical' || s.category === 'magic';
}

/** Skills that can go in the skill bar (exist, are not ultimates, are not system actions) */
function equippable(id: string): SkillDef | undefined {
  const s = findSkill(id);
  return s && s.category !== 'ultimate' && !SYSTEM_SKILL_IDS.has(id) ? s : undefined;
}

/** Loadout score of an attack skill: based on the stat the skill actually uses, same element, accuracy and conditional bonuses */
function attackScore(sp: SpiritDef, s: SkillDef): number {
  const best = Math.max(sp.base.atk, sp.base.mag);
  // "Defense as offense" (useDef) looks at armor, "borrow the foe's power" (foeAtk) looks at the opponent (about 95), "refraction" (bestDef) takes the higher attack stat
  const stat = s.tags.useDef ? sp.base.def : s.tags.foeAtk ? 95 : s.tags.bestDef ? best : s.category === 'physical' ? sp.base.atk : sp.base.mag;
  const statMatch = Math.max(0.45, Math.min(1.4, stat / best));
  const stab = sp.elements.includes(s.element) ? 1.2 : 1;
  const extra = (s.tags.aetherPower ?? 0) * 2 + (s.tags.snowball ? s.power * 0.4 : 0) + (s.tags.cond ?? 0) + (s.tags.custom ?? 0);
  const selfKO = s.tags.selfKO ? 0.5 : 1;
  const sig = s.tags.sig ? 1.15 : 1;
  return (s.power + extra) * statMatch * stab * (s.accuracy / 100) * selfKO * sig;
}

/** Loadout score of a support skill: field > signature > other status skills > traps */
function utilityScore(s: SkillDef): number {
  let v = s.category === 'trap' ? 40 : 50;
  if (s.tags.field) v += 40;
  if (s.tags.sig) v += 30;
  if (s.tags.custom || s.tags.cond) v += 10;
  return v - s.cost;
}

/**
 * Pick up to 4 skills by level:
 * core (in order) → best 0-cost attack → best high-cost attack → best support (field, status, trap) → fill by score.
 * When a 0-cost attack has been learned, one is always taken.
 */
export function defaultLoadout(speciesId: string, level: number): string[] {
  const sp = getSpirit(speciesId);
  const learned = learnedSkills(sp, level)
    .map(equippable)
    .filter((s): s is SkillDef => !!s);
  const attacks = learned.filter(isDamaging).sort((a, b) => attackScore(sp, b) - attackScore(sp, a));
  const utility = learned.filter((s) => !isDamaging(s)).sort((a, b) => utilityScore(b) - utilityScore(a));
  const picked: SkillDef[] = [];
  const add = (s: SkillDef | undefined) => {
    if (s && !picked.includes(s) && picked.length < 4) picked.push(s);
  };
  const core = (sp.core ?? []).map((id) => learned.find((s) => s.id === id));
  for (const s of core) add(s);
  add(attacks.find((s) => s.cost === 0));
  add(attacks.find((s) => s.cost >= 2 && !picked.includes(s)));
  add(utility[0]);
  // Fill by score: alternate between attack and support, to avoid all four being status skills
  const rest = [...attacks, ...utility].filter((s) => !picked.includes(s));
  rest.sort((a, b) => (isDamaging(b) ? attackScore(sp, b) : utilityScore(b)) - (isDamaging(a) ? attackScore(sp, a) : utilityScore(a)));
  for (const s of rest) add(s);
  // Guarantee a 0-cost attack (replaces the last skill; when core already fills all 4, the last core is replaced)
  const zero = attacks.find((s) => s.cost === 0);
  if (zero && !picked.some((s) => isDamaging(s) && s.cost === 0)) {
    if (picked.length < 4) picked.push(zero);
    else picked[picked.length - 1] = zero;
  }
  return picked.map((s) => s.id);
}

/**
 * Fix the skill bar in a save: remove skills that no longer exist, have not yet been learned at the current level, or cannot be carried;
 * when something was removed (or it was empty to begin with), fill up to 4 with defaultLoadout. Returns whether anything changed.
 * Called when reading the local save, the cloud save and the test save; skill ids will change again later, so it has to run on every load.
 */
export function sanitizeLoadout(inst: SpiritInstance): boolean {
  const sp = findSpirit(inst.speciesId);
  if (!sp) return false;
  const learned = new Set(learnedSkills(sp, inst.level));
  const before = Array.isArray(inst.loadout) ? inst.loadout : [];
  const kept = [...new Set(before)].filter((id) => learned.has(id) && !!equippable(id)).slice(0, 4);
  const dropped = kept.length !== before.length;
  if (dropped || kept.length === 0) {
    for (const id of defaultLoadout(inst.speciesId, inst.level)) {
      if (kept.length >= 4) break;
      if (!kept.includes(id)) kept.push(id);
    }
  }
  const changed = kept.length !== before.length || kept.some((id, i) => id !== before[i]);
  if (changed) inst.loadout = kept;
  return changed;
}
