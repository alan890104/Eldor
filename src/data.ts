// Data access for the game: spirit and skill definitions come from data/spirits.json and data/kits/*.json (shared with the design docs);
// see sim/catalog.ts for the merge rules.

import { registerSkills, SKILL_BY_ID, SKILLS, SPIRIT_BY_ID, SPIRITS, SYSTEM_SKILL_IDS } from '../sim/catalog.ts';
import type { SkillDef, SpiritDef } from '../sim/types.ts';

export { SKILLS, SPIRITS, SYSTEM_SKILL_IDS };
export { GUARD_ID } from '../sim/catalog.ts';

export function getSkill(id: string): SkillDef {
  const s = SKILL_BY_ID.get(id);
  if (!s) throw new Error(`unknown skill ${id}`);
  return s;
}

/** Returns undefined when not found (for places like loading an old save that can meet a deleted skill) */
export function findSkill(id: string): SkillDef | undefined {
  return SKILL_BY_ID.get(id);
}

export function hasSkill(id: string): boolean {
  return SKILL_BY_ID.has(id);
}

export function getSpirit(id: string): SpiritDef {
  const s = SPIRIT_BY_ID.get(id);
  if (!s) throw new Error(`unknown spirit ${id}`);
  return s;
}

export function findSpirit(id: string): SpiritDef | undefined {
  return SPIRIT_BY_ID.get(id);
}

/** Skills learned by a given level (learnset entries with lv ≤ level, sorted by level, with duplicate and nonexistent ids dropped) */
export function learnedSkills(sp: SpiritDef, level: number): string[] {
  const out: string[] = [];
  for (const e of [...sp.learnset].sort((a, b) => a.lv - b.lv)) {
    if (e.lv <= level && !out.includes(e.id) && SKILL_BY_ID.has(e.id)) out.push(e.id);
  }
  return out;
}

/** The level at which this spirit learns the skill, per its learnset (undefined when the skill is not in the learnset) */
export function learnLevel(sp: SpiritDef, id: string): number | undefined {
  let lv: number | undefined;
  for (const e of sp.learnset) if (e.id === id && (lv === undefined || e.lv < lv)) lv = e.lv;
  return lv;
}

export function stageForLevel(level: number): 1 | 2 | 3 {
  return level >= 40 ? 3 : level >= 20 ? 2 : 1;
}

export function displayName(sp: SpiritDef): string {
  return sp.name;
}

/** Test only: registers fixed skills for tests (affects only the current test process) */
export function registerTestSkills(defs: SkillDef[]): void {
  registerSkills(defs, 'test');
}
