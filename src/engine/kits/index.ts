// Merges the hooks of every group: SKILL_FX (skill id -> skill hooks) and KIT_FX (spirit id -> kit hooks).
// An id defined by two group files is recorded in FX_ERRORS.
// Every group file is listed here explicitly (no import.meta.glob, so both node tests and vite can use it).

import type { KitGroup } from '../../../sim/catalog.ts';
import type { KitHooks, SkillHooks } from '../skillfx.ts';
import * as fire from './fire.ts';
import * as water from './water.ts';
import * as nature from './nature.ts';
import * as wind from './wind.ts';
import * as earth from './earth.ts';
import * as thunder from './thunder.ts';
import * as light from './light.ts';
import * as dark from './dark.ts';
import * as neutral from './neutral.ts';

interface GroupModule {
  FX: Record<string, SkillHooks>;
  KIT?: Record<string, KitHooks>;
}

export const GROUP_MODULES: Record<KitGroup, GroupModule> = { fire, water, nature, wind, earth, thunder, light, dark, neutral };

/** Skill id -> skill hooks */
export const SKILL_FX: Record<string, SkillHooks> = {};
/** Spirit id -> kit hooks */
export const KIT_FX: Record<string, KitHooks> = {};
/** Which group file defined a hook ('test' for ones registered by tests) */
export const FX_SOURCE = new Map<string, KitGroup | 'test'>();
/** Problems found while merging (duplicate definitions) */
export const FX_ERRORS: { where: KitGroup; msg: string }[] = [];

const kitOwner = new Map<string, KitGroup>();
for (const [g, mod] of Object.entries(GROUP_MODULES) as [KitGroup, GroupModule][]) {
  for (const [id, h] of Object.entries(mod.FX ?? {})) {
    const prev = FX_SOURCE.get(id);
    if (prev) {
      const msg = `技能掛勾 ${id} 同時定義在 ${prev}.ts 與 ${g}.ts`;
      FX_ERRORS.push({ where: g, msg }, { where: prev as KitGroup, msg });
      continue;
    }
    SKILL_FX[id] = h;
    FX_SOURCE.set(id, g);
  }
  for (const [id, h] of Object.entries(mod.KIT ?? {})) {
    const prev = kitOwner.get(id);
    if (prev) {
      const msg = `技能組掛勾 ${id} 同時定義在 ${prev}.ts 與 ${g}.ts`;
      FX_ERRORS.push({ where: g, msg }, { where: prev, msg });
      continue;
    }
    KIT_FX[id] = h;
    kitOwner.set(id, g);
  }
}

/** Test only: registers skill hooks */
export function registerSkillHooks(id: string, h: SkillHooks): void {
  SKILL_FX[id] = h;
  FX_SOURCE.set(id, 'test');
}

/** Test only: registers (or removes) kit hooks */
export function registerKitHooks(spiritId: string, h: KitHooks | null): void {
  if (h) KIT_FX[spiritId] = h;
  else delete KIT_FX[spiritId];
}
