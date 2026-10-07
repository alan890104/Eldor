// Data access for the design tools: shares the merged result of sim/catalog.ts with the game (data/spirits.json + data/kits/*.json).

import { SKILL_BY_ID } from './catalog.ts';
import type { SkillDef } from './types.ts';

export {
  CATALOG_ERRORS,
  GROUP_OF_SPIRIT,
  KIT_FILES,
  KIT_GROUPS,
  SKILL_BY_ID,
  SKILL_SOURCE,
  SKILLS,
  SPIRIT_BY_ID,
  SPIRITS,
  SYSTEM_SKILL_IDS,
} from './catalog.ts';

export function skill(id: string): SkillDef {
  const s = SKILL_BY_ID.get(id);
  if (!s) throw new Error(`unknown skill ${id}`);
  return s;
}
