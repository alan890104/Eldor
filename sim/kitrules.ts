// Kit rules: rarity tiers, budget windows, learnset structure checks.
// Shared by sim/kits.test.ts, sim/design.test.ts and sim/kit-status.ts; see docs/10-kit-authoring.md.

import { evaluateSkill, type BudgetResult } from './budget.ts';
import {
  CATALOG_ERRORS,
  GROUP_OF_SPIRIT,
  KIT_FILES,
  SKILL_BY_ID,
  SKILL_SOURCE,
  SPIRIT_BY_ID,
  SPIRITS,
  SYSTEM_SKILL_IDS,
  type KitGroup,
} from './catalog.ts';
import type { Rarity, SkillDef, SpiritDef } from './types.ts';

// ───────────────────────── Rarity tiers ─────────────────────────

export interface TierRule {
  /** Number of learnset entries (excluding the ultimate) */
  size: [number, number];
  /** Maximum number of basic skills */
  maxBasic: number;
  /** Number of flagship skills (tags.sig) */
  sig: [number, number];
  /** Upper limit of a flagship skill's budget ratio (the lower limit is always 1.00) */
  sigMax: number;
}

/**
 * Higher rarity means more learnable skills, more flagship skills (fewer basic skills), and more flagship skills, which are also stronger.
 * An SSR's strength lies in its unique mechanic and a complete kit, not in overwhelming numbers (the budget window for flagship skills is the same at every rarity).
 */
export const TIERS: Record<Rarity, TierRule> = {
  N: { size: [10, 12], maxBasic: 5, sig: [1, 1], sigMax: 1.2 },
  R: { size: [11, 13], maxBasic: 4, sig: [1, 2], sigMax: 1.25 },
  SR: { size: [12, 14], maxBasic: 3, sig: [2, 2], sigMax: 1.3 },
  SSR: { size: [13, 15], maxBasic: 2, sig: [2, 3], sigMax: 1.35 },
};

/** Basic skills: plain, slightly below the usual budget */
export const BASIC_WINDOW: [number, number] = [0.85, 1.05];
/** Ordinary (non-flagship) flagship skills, ultimates and legacy skills */
export const NORMAL_WINDOW: [number, number] = [0.85, 1.15];
export const SIG_MIN = 1.0;

export const LEARN_RULES = {
  /** Latest level at which the last skill can be learned (the level cap is 60) */
  lastLevel: 55,
  /** Basic skills must be learned by this level at the latest */
  basicByLevel: 25,
  /** Minimum number of skills at Lv 1 (one of them is a 0-cost attack) */
  atLv1: 2,
  /** Minimum number of skills learned by Lv 20 */
  by20: 5,
  /** Minimum number of skills learned by Lv 40 */
  by40: 8,
  /** Maximum number of traps */
  maxTraps: 2,
  /** Minimum number of attack skills (physical or magic) */
  minAttacks: 5,
  /** Minimum number of status skills or traps */
  minUtility: 2,
};

// ───────────────────────── Budget ─────────────────────────

export type BudgetKind = 'basic' | 'normal' | 'sig' | 'ultimate' | 'system';

export interface BudgetCheck {
  kind: BudgetKind;
  /** The rarity, when the budget is computed by the owner's rarity */
  rarity?: Rarity;
  result: BudgetResult;
  lo: number;
  hi: number;
  ok: boolean;
}

/** A flagship skill in a group file: the tier rules apply by the owner's rarity */
function tieredOwner(skill: SkillDef): SpiritDef | undefined {
  const src = SKILL_SOURCE.get(skill.id);
  if (src === 'basic' || src === 'system' || src === 'test' || !skill.exclusive) return undefined;
  return SPIRIT_BY_ID.get(skill.exclusive);
}

/** Which budget window a skill should fall in, and what its actual ratio is */
export function checkBudget(skill: SkillDef): BudgetCheck {
  const src = SKILL_SOURCE.get(skill.id);
  const owner = tieredOwner(skill);
  const rarity = owner?.rarity;
  const result = evaluateSkill(skill, rarity);
  let kind: BudgetKind;
  let lo: number;
  let hi: number;
  if (src === 'basic') [kind, lo, hi] = ['basic', ...BASIC_WINDOW];
  else if (src === 'system') [kind, lo, hi] = ['system', ...NORMAL_WINDOW];
  else if (skill.category === 'ultimate') [kind, lo, hi] = ['ultimate', ...NORMAL_WINDOW];
  else if (!owner) [kind, lo, hi] = ['normal', ...NORMAL_WINDOW];
  else if (skill.tags.sig) [kind, lo, hi] = ['sig', SIG_MIN, TIERS[owner.rarity].sigMax];
  else [kind, lo, hi] = ['normal', ...NORMAL_WINDOW];
  const ok = result.ratio >= lo - 1e-9 && result.ratio <= hi + 1e-9;
  return { kind, rarity, result, lo, hi, ok };
}

// ───────────────────────── Kit structure ─────────────────────────

const isAttackSkill = (s: SkillDef) => s.category === 'physical' || s.category === 'magic';

/** The spirits that use this skill (in the learnset or as the ultimate) */
export function holdersOf(id: string): string[] {
  return SPIRITS.filter((sp) => sp.ultimate === id || sp.learnset.some((e) => e.id === id)).map((sp) => sp.id);
}

export interface KitReport {
  spirit: string;
  group: KitGroup | undefined;
  problems: string[];
}

/** Check one spirit's kit */
export function checkKit(sp: SpiritDef): KitReport {
  const problems: string[] = [];
  const p = (msg: string) => problems.push(`${sp.id}: ${msg}`);
  const group = GROUP_OF_SPIRIT.get(sp.id);
  const ls = sp.learnset;
  const lvs = ls.map((e) => e.lv);

  // ── learnset structure ──
  if (ls.length === 0) p('learnset is empty');
  if (lvs.some((lv, i) => i > 0 && lv < lvs[i - 1])) p('learnset is not sorted by level');
  if (lvs.length && lvs[0] !== 1) p('the first skill must be learned at Lv 1');
  if (lvs.some((lv) => !Number.isInteger(lv) || lv < 1 || lv > LEARN_RULES.lastLevel)) p(`learn level must be an integer from 1 to ${LEARN_RULES.lastLevel}`);
  const ids = ls.map((e) => e.id);
  if (new Set(ids).size !== ids.length) p('learnset has a duplicate skill');
  const defs: SkillDef[] = [];
  for (const id of ids) {
    const s = SKILL_BY_ID.get(id);
    if (!s) p(`skill ${id} does not exist`);
    else if (SYSTEM_SKILL_IDS.has(id)) p(`${id} is a system action and cannot be in the learnset`);
    else if (s.category === 'ultimate') p(`${id} is an ultimate and can only be set as the ultimate`);
    else defs.push(s);
  }
  const ult = SKILL_BY_ID.get(sp.ultimate);
  if (!ult) p(`ultimate ${sp.ultimate || '(not set)'} does not exist`);
  else if (ult.category !== 'ultimate') p(`ultimate ${sp.ultimate} does not have category ultimate`);
  const zeroAtLv1 = ls.some((e) => {
    const s = SKILL_BY_ID.get(e.id);
    return e.lv === 1 && !!s && isAttackSkill(s) && s.cost === 0;
  });
  if (!zeroAtLv1) p('Lv 1 must have a 0-cost attack skill');
  for (const id of sp.core ?? []) if (!ids.includes(id)) p(`core skill ${id} is not in the learnset`);
  for (const s of defs) {
    if (s.basic && s.element !== 'neutral' && !sp.elements.includes(s.element)) p(`basic skill ${s.id} (${s.element}) does not match an element of this spirit`);
  }
  // ── Rarity rules ──
  const tier = TIERS[sp.rarity];
  if (!sp.mechanic?.name || !sp.mechanic.text) p('missing signature mechanic ("mechanic": { "name", "text" })');
  if (ls.length < tier.size[0] || ls.length > tier.size[1]) p(`${sp.rarity} learnset needs ${tier.size[0]} to ${tier.size[1]} skills (now ${ls.length})`);
  if (ls.filter((e) => e.lv === 1).length < LEARN_RULES.atLv1) p(`Lv 1 needs at least ${LEARN_RULES.atLv1} skills`);
  if (ls.filter((e) => e.lv <= 20).length < LEARN_RULES.by20) p(`at least ${LEARN_RULES.by20} skills must be learned by Lv 20`);
  if (ls.filter((e) => e.lv <= 40).length < LEARN_RULES.by40) p(`at least ${LEARN_RULES.by40} skills must be learned by Lv 40`);

  const basics = ls.filter((e) => SKILL_BY_ID.get(e.id)?.basic);
  if (basics.length > tier.maxBasic) p(`${sp.rarity} allows at most ${tier.maxBasic} basic skills (now ${basics.length})`);
  for (const e of basics) if (e.lv > LEARN_RULES.basicByLevel) p(`basic skill ${e.id} must be learned by Lv ${LEARN_RULES.basicByLevel} (now Lv ${e.lv})`);

  const own = [...defs.filter((s) => !s.basic), ...(ult ? [ult] : [])];
  for (const s of own) {
    const src = SKILL_SOURCE.get(s.id);
    if (src !== group) p(`exclusive skill ${s.id} must be defined in data/kits/${group}.json (now in ${src})`);
    if (s.exclusive !== sp.id) p(`exclusive skill ${s.id} must have "exclusive" set to "${sp.id}"`);
    const holders = holdersOf(s.id);
    if (holders.length !== 1) p(`exclusive skill ${s.id} can be used by only one spirit (now: ${holders.join(', ')})`);
  }
  const traps = defs.filter((s) => s.category === 'trap').length;
  if (traps > LEARN_RULES.maxTraps) p(`at most ${LEARN_RULES.maxTraps} trap skills (now ${traps})`);
  const attacks = defs.filter(isAttackSkill).length;
  if (attacks < LEARN_RULES.minAttacks) p(`at least ${LEARN_RULES.minAttacks} attack skills needed (now ${attacks})`);
  const utility = defs.filter((s) => s.category === 'status' || s.category === 'trap').length;
  if (utility < LEARN_RULES.minUtility) p(`at least ${LEARN_RULES.minUtility} status or trap skills needed (now ${utility})`);

  const sigs = defs.filter((s) => s.tags.sig);
  if (sigs.length < tier.sig[0] || sigs.length > tier.sig[1]) p(`${sp.rarity} needs ${tier.sig[0]} to ${tier.sig[1]} flagship skills (sig) (now ${sigs.length})`);
  for (const s of sigs) if (s.basic) p(`basic skill ${s.id} cannot be a flagship skill`);
  if (ult?.tags.sig) p('an ultimate cannot be tagged sig');

  for (const s of own) {
    const b = checkBudget(s);
    if (!b.ok) p(`${s.id} budget ratio ${b.result.ratio.toFixed(2)} is outside the ${b.kind} range ${b.lo.toFixed(2)} to ${b.hi.toFixed(2)} (${b.result.parts.join('; ')})`);
  }
  return { spirit: sp.id, group, problems };
}

/** Group-level problems: load errors, skills defined in a group file that nobody uses, flagship skills that belong to another group */
export function checkGroupFile(g: KitGroup): string[] {
  const out = CATALOG_ERRORS.filter((e) => e.where === g).map((e) => e.msg);
  const members = new Set(Object.keys(KIT_FILES[g].spirits ?? {}));
  for (const s of KIT_FILES[g].skills ?? []) {
    if (s.basic) continue;
    if (s.exclusive && !members.has(s.exclusive)) out.push(`${s.id}: exclusive is ${s.exclusive}, but that spirit is not in ${g}.json`);
    if (holdersOf(s.id).length === 0) out.push(`${s.id}: defined but no spirit uses it`);
    if (s.category === 'trap' && (!s.trigger || !s.trapSpeed)) out.push(`${s.id}: a trap skill must have trigger and trapSpeed`);
    if (s.category !== 'trap' && (s.trigger !== undefined || s.trapSpeed !== undefined)) out.push(`${s.id}: only trap skills can have trigger or trapSpeed`);
  }
  return out;
}

