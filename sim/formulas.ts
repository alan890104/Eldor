// Eldor's core numeric formulas. Every formula in the docs (docs/) follows this file;
// the real battle engine should import from here too, so the client, the server and simulation results stay consistent.

import type { Element, Rarity, Stage, StatKey, Stats } from './types.ts';

// ───────────────────────── Elements ─────────────────────────

export const ELEMENT_LABEL: Record<Element, string> = {
  water: '水',
  fire: '火',
  nature: '木',
  wind: '風',
  earth: '地',
  thunder: '雷',
  light: '光',
  dark: '暗',
  neutral: '無',
};

export const ELEMENT_ORDER: Element[] = [
  'water',
  'fire',
  'nature',
  'wind',
  'earth',
  'thunder',
  'light',
  'dark',
  'neutral',
];

/** Six-element ring: each element has the advantage over the next one on the ring (water→fire→nature→wind→earth→thunder→water) */
export const RING: Element[] = ['water', 'fire', 'nature', 'wind', 'earth', 'thunder'];

export const ADVANTAGE = 1.5;
export const RESISTED = 0.75;
/** Same-element bonus (the skill's element matches the spirit's element) */
export const STAB = 1.2;

export function singleTypeMultiplier(attack: Element, defend: Element): number {
  if (attack === 'neutral' || defend === 'neutral') return 1;
  if (
    (attack === 'light' && defend === 'dark') ||
    (attack === 'dark' && defend === 'light')
  ) {
    return ADVANTAGE;
  }
  const i = RING.indexOf(attack);
  const j = RING.indexOf(defend);
  if (i < 0 || j < 0) return 1;
  if ((i + 1) % RING.length === j) return ADVANTAGE;
  if ((j + 1) % RING.length === i) return RESISTED;
  return 1;
}

/** Dual-element defender: the average of the two elements' multipliers */
export function typeMultiplier(attack: Element, defend: readonly Element[]): number {
  const sum = defend.reduce((s, d) => s + singleTypeMultiplier(attack, d), 0);
  return sum / defend.length;
}

// ───────────────────────── Stats ─────────────────────────

export const STAT_LABEL: Record<StatKey, string> = {
  hp: '生命',
  atk: '力量',
  mag: '魔力',
  def: '護甲',
  res: '抗魔',
  spd: '速度',
};

export const STAT_KEYS: StatKey[] = ['hp', 'atk', 'mag', 'def', 'res', 'spd'];

export const MAX_LEVEL = 60;
export const HP_FACTOR = 2;

export const STAGE_MULT: Record<Stage, number> = { 1: 0.85, 2: 0.93, 3: 1 };
export const STAGE_LEVEL_CAP: Record<Stage, number> = { 1: 20, 2: 40, 3: 60 };

/** Standard base stat total (BST) for each rarity */
export const RARITY_BST: Record<Rarity, number> = { N: 450, R: 480, SR: 510, SSR: 540 };

/** Cumulative all-stat bonus for resonance R0 to R5 (PvE only; disabled in the standard Arena) */
export const RESONANCE_BONUS = [0, 0.03, 0.03, 0.06, 0.06, 0.1];

/** Growth factor: each level gained adds 10% of the base stat */
export function growth(level: number): number {
  return 1 + level / 10;
}

export function computeStat(
  key: StatKey,
  base: number,
  level: number,
  stage: Stage,
  resonance = 0,
): number {
  const mult = growth(level) * STAGE_MULT[stage] * (1 + RESONANCE_BONUS[resonance]);
  return Math.floor(base * mult * (key === 'hp' ? HP_FACTOR : 1));
}

export function computeStats(base: Stats, level: number, stage: Stage, resonance = 0): Stats {
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = computeStat(k, base[k], level, stage, resonance);
  return out;
}

export function bst(base: Stats): number {
  return STAT_KEYS.reduce((s, k) => s + base[k], 0);
}

// ───────────────────────── Stat stages ─────────────────────────

export const MAX_STAT_STAGE = 4;

/** +n stages → 1 + 0.25n (max ×2); −n stages → 1 / (1 + 0.25n) (min ×0.5) */
export function statStageMultiplier(stage: number): number {
  const s = Math.max(-MAX_STAT_STAGE, Math.min(MAX_STAT_STAGE, Math.trunc(stage)));
  return s >= 0 ? 1 + 0.25 * s : 1 / (1 - 0.25 * s);
}

// ───────────────────────── Damage ─────────────────────────

export const CRIT_RATE = 0.05;
export const CRIT_MULT = 1.5;
/** Floor of the damage-reduction multiplier: all reductions multiplied together cut at most 75% */
export const MIN_REDUCTION_MULT = 0.25;
export const ROLL_MIN = 0.95;
export const ROLL_MAX = 1.05;

/** Defense constant K: equals "a stage III defense of base stat 100 at the attacker's level" */
export function defenseConstant(attackerLevel: number): number {
  return 10 * (attackerLevel + 10);
}

/** Defense factor = K / (K + effective defense). It is 0.5 at equal levels with a defense base stat of 100 */
export function defenseFactor(defense: number, attackerLevel: number, armorPen = 0): number {
  const k = defenseConstant(attackerLevel);
  return k / (k + defense * (1 - armorPen));
}

export interface DamageInput {
  /** Effective attack (physical skills use atk, magic uses mag; stat stage already applied) */
  attack: number;
  /** Effective defense (physical skills use def, magic uses res; stat stage already applied) */
  defense: number;
  power: number;
  attackerLevel: number;
  typeMult?: number;
  stab?: boolean;
  crit?: boolean;
  /** Damage-bonus zone: the sum of all of the attacker's bonuses (e.g. 0.3 = +30%) */
  damageBonus?: number;
  /** Damage-reduction zone: each of the defender's reduction sources is multiplied separately (e.g. [0.2, 0.1]) */
  damageReduction?: number[];
  /** Field zone (e.g. a fire skill under scorching sun: 1.3) */
  fieldMult?: number;
  armorPen?: number;
  /** Roll 0.95 to 1.05; defaults to 1 (the expected value) */
  roll?: number;
}

export function computeDamage(i: DamageInput): number {
  const base = i.attack * (i.power / 100);
  const defense = defenseFactor(i.defense, i.attackerLevel, i.armorPen ?? 0);
  const element = (i.typeMult ?? 1) * (i.stab ? STAB : 1);
  const crit = i.crit ? CRIT_MULT : 1;
  const bonus = 1 + (i.damageBonus ?? 0);
  const reduction = Math.max(
    MIN_REDUCTION_MULT,
    (i.damageReduction ?? []).reduce((m, r) => m * (1 - r), 1),
  );
  const field = i.fieldMult ?? 1;
  const roll = i.roll ?? 1;
  return Math.max(1, Math.floor(base * defense * element * crit * bonus * reduction * field * roll));
}

// ───────────────────────── Turn order ─────────────────────────

export const SWITCH_PRIORITY = 6;

export interface OrderKey {
  priority: number;
  speed: number;
}

/** A negative result means a acts first; 0 means a speed tie (the battle engine breaks it randomly) */
export function compareOrder(a: OrderKey, b: OrderKey): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return b.speed - a.speed;
}

// ───────────────────────── Aether (AE) ─────────────────────────

export const AETHER = {
  start: 3,
  perTurn: 2,
  max: 10,
} as const;

/** Aether available at the start of turn `turn`, assuming none was ever spent */
export function aetherAtTurnStart(turn: number): number {
  return Math.min(AETHER.max, AETHER.start + AETHER.perTurn * (turn - 1));
}

// ───────────────────────── Capture ─────────────────────────

export const CAPTURE_BASE: Record<Rarity, number> = { N: 0.45, R: 0.25, SR: 0.08, SSR: 0 };
export const CAPTURE_STONE = { basic: 1, advanced: 1.5, master: 2.5 } as const;
export const CAPTURE_STATUS = { none: 1, other: 1.2, control: 1.5 } as const;

export function captureChance(
  rarity: Rarity,
  hpRatio: number,
  stone: keyof typeof CAPTURE_STONE,
  status: keyof typeof CAPTURE_STATUS,
): number {
  const hpTerm = 1 - (2 / 3) * Math.max(0, Math.min(1, hpRatio));
  return Math.min(1, CAPTURE_BASE[rarity] * hpTerm * CAPTURE_STONE[stone] * CAPTURE_STATUS[status]);
}

// ───────────────────────── Experience ─────────────────────────

/** EXP needed to go from level to level+1 */
export function expToNext(level: number): number {
  return 2 * level * level + 24 * level + 40;
}

/** Cumulative EXP needed to go from level 1 to `level` */
export function totalExpTo(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += expToNext(l);
  return sum;
}

/** EXP for defeating one wild spirit (full for the spirit that fought, 50% for party members that did not) */
export function battleExp(enemyLevel: number, myLevel: number): number {
  const base = 20 + 10 * enemyLevel;
  const diff = enemyLevel - myLevel;
  let mult: number;
  if (diff >= 0) mult = 1 + 0.04 * Math.min(diff, 5);
  else if (diff >= -4) mult = 1;
  else mult = 0.5;
  return Math.floor(base * mult);
}

// ───────────────────────── Breakthrough materials ─────────────────────────

export const BREAKTHROUGH_COST = {
  /** Stage I → II (requires Lv 20) */
  toStage2: { breakStone: 5, gold: 5_000 },
  /** Stage II → III (requires Lv 40) */
  toStage3: { breakStone: 15, primalShard: 3, gold: 30_000 },
} as const;

// ───────────────────────── Randomness ─────────────────────────

/** Reproducible random numbers (mulberry32). The battle engine and simulations always use seeded randomness. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
