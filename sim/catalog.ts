// Data catalog: merges data/spirits.json (identities) and data/kits/*.json (kits and skill definitions) into
// the skill table and spirit table shared by the game (src/data.ts) and the design tools (sim/data.ts).
//
// File layout (see docs/10-kit-authoring.md):
//   _system.json  display definitions for system actions (guard); never appears in a learnset
//   _basic.json   basic skills: spirits of the same element, or elementless spirits, can put them in a learnset
//   <group>.json  the spirit kits and flagship skills of each element group
// Two group files defining the same id, or a group file overriding a basic/system skill, are both recorded in CATALOG_ERRORS
// (sim/kits.test.ts fails the groups involved).
// A load error does not throw, so that one half-edited group does not stop everyone from testing.

import spiritsJson from '../data/spirits.json' with { type: 'json' };
import systemKit from '../data/kits/_system.json' with { type: 'json' };
import basicKit from '../data/kits/_basic.json' with { type: 'json' };
import fireKit from '../data/kits/fire.json' with { type: 'json' };
import waterKit from '../data/kits/water.json' with { type: 'json' };
import natureKit from '../data/kits/nature.json' with { type: 'json' };
import windKit from '../data/kits/wind.json' with { type: 'json' };
import earthKit from '../data/kits/earth.json' with { type: 'json' };
import thunderKit from '../data/kits/thunder.json' with { type: 'json' };
import lightKit from '../data/kits/light.json' with { type: 'json' };
import darkKit from '../data/kits/dark.json' with { type: 'json' };
import neutralKit from '../data/kits/neutral.json' with { type: 'json' };
import type { KitEntry, KitFile, SkillDef, SpiritDef, SpiritIdentity } from './types.ts';

/** The nine element groups (spirits are grouped by their first element), one data/kits/<group>.json per group */
export const KIT_GROUPS = ['fire', 'water', 'nature', 'wind', 'earth', 'thunder', 'light', 'dark', 'neutral'] as const;
export type KitGroup = (typeof KIT_GROUPS)[number];
/** The file a skill definition comes from */
export type SkillSource = 'system' | 'basic' | KitGroup | 'test';

const asKit = (x: unknown) => x as KitFile;
/** The raw contents of each group file (kits.test uses it to check "defined in its own file") */
export const KIT_FILES: Record<KitGroup, KitFile> = {
  fire: asKit(fireKit),
  water: asKit(waterKit),
  nature: asKit(natureKit),
  wind: asKit(windKit),
  earth: asKit(earthKit),
  thunder: asKit(thunderKit),
  light: asKit(lightKit),
  dark: asKit(darkKit),
  neutral: asKit(neutralKit),
};
export const SYSTEM_FILE = asKit(systemKit);
export const BASIC_FILE = asKit(basicKit);

export interface CatalogProblem {
  /** The file with the problem (group name, basic, system) or 'spirits' */
  where: SkillSource | 'spirits';
  msg: string;
}
/** Problems found while loading (duplicate id, overriding a basic skill, a spirit without a kit, ...) */
export const CATALOG_ERRORS: CatalogProblem[] = [];

const skillMap = new Map<string, SkillDef>();
const sourceMap = new Map<string, SkillSource>();

function addSkill(def: SkillDef, src: SkillSource): void {
  const prev = sourceMap.get(def.id);
  if (prev !== undefined) {
    const msg =
      prev === 'basic' || prev === 'system'
        ? `skill ${def.id} is already a ${prev === 'basic' ? 'basic' : 'system'} skill and cannot be redefined in ${src} (use a different id)`
        : `duplicate skill id: ${def.id} is defined in both ${prev} and ${src}`;
    CATALOG_ERRORS.push({ where: src, msg });
    if (prev !== src) CATALOG_ERRORS.push({ where: prev, msg });
    return;
  }
  if (src === 'basic' && !def.basic) CATALOG_ERRORS.push({ where: src, msg: `${def.id}: skills in _basic.json must set "basic": true` });
  if (src !== 'basic' && def.basic) CATALOG_ERRORS.push({ where: src, msg: `${def.id}: only skills in _basic.json can set basic` });
  skillMap.set(def.id, def);
  sourceMap.set(def.id, src);
}

for (const s of SYSTEM_FILE.skills) addSkill(s, 'system');
for (const s of BASIC_FILE.skills) addSkill(s, 'basic');
for (const g of KIT_GROUPS) for (const s of KIT_FILES[g].skills ?? []) addSkill(s, g);

/** All skill definitions (including basic and system skills) */
export const SKILLS: SkillDef[] = [...skillMap.values()];
export const SKILL_BY_ID: Map<string, SkillDef> = skillMap;
/** Which file a skill definition comes from */
export const SKILL_SOURCE: ReadonlyMap<string, SkillSource> = sourceMap;
/** System actions (cannot be learned or carried) */
export const SYSTEM_SKILL_IDS: ReadonlySet<string> = new Set(SYSTEM_FILE.skills.map((s) => s.id));
/** Id of the display definition of the system guard */
export const GUARD_ID = 'guard';

// ───────────────────────── Spirits ─────────────────────────

const identities = spiritsJson as unknown as SpiritIdentity[];
const groupOf = new Map<string, KitGroup>();
const kitOf = new Map<string, KitEntry>();
for (const g of KIT_GROUPS) {
  for (const [id, kit] of Object.entries(KIT_FILES[g].spirits ?? {})) {
    const prev = groupOf.get(id);
    if (prev) {
      const msg = `spirit ${id} has a kit defined in both ${prev} and ${g}`;
      CATALOG_ERRORS.push({ where: g, msg }, { where: prev, msg });
      continue;
    }
    groupOf.set(id, g);
    kitOf.set(id, kit);
  }
}
for (const id of groupOf.keys()) {
  if (!identities.some((s) => s.id === id)) CATALOG_ERRORS.push({ where: groupOf.get(id)!, msg: `kit ${id} is not in data/spirits.json` });
}

export const SPIRITS: SpiritDef[] = identities.map((sp) => {
  const kit = kitOf.get(sp.id);
  if (!kit) {
    CATALOG_ERRORS.push({ where: 'spirits', msg: `spirit ${sp.id} has no kit (data/kits/${sp.elements[0]}.json)` });
    return { ...sp, learnset: [], ultimate: '' };
  }
  const g = groupOf.get(sp.id)!;
  if (g !== sp.elements[0]) CATALOG_ERRORS.push({ where: g, msg: `spirit ${sp.id} has first element ${sp.elements[0]}, so its kit belongs in ${sp.elements[0]}.json` });
  const def: SpiritDef = { ...sp, learnset: kit.learnset ?? [], ultimate: kit.ultimate ?? '' };
  if (kit.core) def.core = kit.core;
  if (kit.mechanic) def.mechanic = kit.mechanic;
  if (kit.concept) def.concept = kit.concept;
  if (kit.trait) {
    def.trait = kit.trait;
    def.traitOverride = true;
  }
  return def;
});
export const SPIRIT_BY_ID: Map<string, SpiritDef> = new Map(SPIRITS.map((s) => [s.id, s]));
/** Which group file a spirit's kit is in */
export const GROUP_OF_SPIRIT: ReadonlyMap<string, KitGroup> = groupOf;

/** Test only: register (or overwrite) skill definitions, e.g. fixed skills for tests */
export function registerSkills(defs: SkillDef[], src: SkillSource = 'test'): void {
  for (const d of defs) {
    const i = SKILLS.findIndex((s) => s.id === d.id);
    if (i >= 0) SKILLS[i] = d;
    else SKILLS.push(d);
    skillMap.set(d.id, d);
    sourceMap.set(d.id, src);
  }
}
