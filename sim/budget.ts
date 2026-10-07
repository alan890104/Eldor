// Skill budget: converts each skill's effects into "power points" and compares them with the budget its cost earns.
// It is a design-time balance check, not the real in-battle resolution.
// Conversion basis: a neutral, same-element 110-power attack takes about 33% of the opponent's HP, so 1% HP ≈ 3 points.

import type { Rarity, SkillDef, StatusId } from './types.ts';

/** Budget for cost 0 to 6 (non-trap, non-ultimate) */
export const COST_BUDGET = [60, 85, 110, 135, 155, 175, 195];
/** Extra budget for an ultimate's "once per battle" limit (legacy shared ultimates, or when no rarity is given) */
export const ULTIMATE_PREMIUM = 80;
/** Extra budget for a signature ultimate by the owner's rarity: an SSR's ultimate is the move that defines the whole battle */
export const ULTIMATE_PREMIUM_BY_RARITY: Record<Rarity, number> = { N: 80, R: 80, SR: 80, SSR: 100 };
/** A trap takes no action and trades value only for aether: 25 × cost + 20 (the value of hidden information) */
export const TRAP_PER_COST = 25;
export const TRAP_BASE = 20;
/** Allowed deviation */
export const BUDGET_TOLERANCE = 0.15;

/** Value of applying that status once at 100%; for poison, per stack */
export const STATUS_VALUE: Record<StatusId, number> = {
  burn: 70,
  poison: 30,
  bleed: 50,
  freeze: 90,
  sleep: 100,
  fear: 55,
  paralyze: 55,
  root: 25,
  silence: 55,
  taunt: 55,
  curse: 50,
};

/** Value per stat stage (a buff on self, or a debuff on the opponent) */
export const STAGE_VALUE: Record<string, number> = {
  atk: 40,
  mag: 40,
  def: 30,
  res: 30,
  spd: 25,
};
/** A drop in the user's own stats (the price paid) counts at 0.75× */
const SELF_DRAWBACK = 0.75;

const PRIORITY_VALUE: Record<number, number> = {
  [-3]: -30,
  [-2]: -20,
  [-1]: -10,
  0: 0,
  1: 25,
  2: 45,
  3: 60,
};

/** Expected value of one "standard attack", used for damage-reduction/reflect traps */
const TYPICAL_HIT = 110 * 0.8;

export interface BudgetResult {
  value: number;
  target: number;
  ratio: number;
  parts: string[];
}

/** The budget a cost earns; rarity = the rarity of the signature ultimate's owner (decides the ultimate premium) */
export function targetBudget(skill: SkillDef, rarity?: Rarity): number {
  if (skill.category === 'trap') return TRAP_PER_COST * skill.cost + TRAP_BASE;
  const base = COST_BUDGET[skill.cost];
  if (base === undefined) throw new Error(`${skill.id}: cost ${skill.cost} is outside the budget table`);
  if (skill.category !== 'ultimate') return base;
  return base + (rarity ? ULTIMATE_PREMIUM_BY_RARITY[rarity] : ULTIMATE_PREMIUM);
}

function isAttack(skill: SkillDef): boolean {
  return skill.category === 'physical' || skill.category === 'magic' || skill.category === 'ultimate';
}

/** A skill's valuation; rarity only affects an ultimate's target budget (see targetBudget) */
export function evaluateSkill(skill: SkillDef, rarity?: Rarity): BudgetResult {
  const parts: string[] = [];
  let value = 0;
  const add = (v: number, label: string) => {
    if (v === 0) return;
    value += v;
    parts.push(`${label} ${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`);
  };

  const power = skill.power;
  if (power > 0) add(power, 'power');
  if (isAttack(skill)) {
    const pv = PRIORITY_VALUE[skill.priority];
    if (pv === undefined) throw new Error(`${skill.id}: priority ${skill.priority} is out of range`);
    add(pv, `priority ${skill.priority > 0 ? '+' : ''}${skill.priority}`);
  }

  const t = skill.tags;
  const foeChance = t.foeChance ?? 1;
  for (const [key, raw] of Object.entries(t)) {
    const n = raw;
    if (key.startsWith('status.')) {
      const id = key.slice(7) as StatusId;
      const v = STATUS_VALUE[id];
      if (v === undefined) throw new Error(`${skill.id}: unknown status condition ${id}`);
      add(v * n, `status:${id}×${n}`);
      continue;
    }
    if (key.startsWith('self.')) {
      const stat = key.slice(5);
      const v = STAGE_VALUE[stat];
      if (v === undefined) throw new Error(`${skill.id}: unknown stat ${stat}`);
      add(n >= 0 ? v * n : v * n * SELF_DRAWBACK, `self ${stat}${n > 0 ? '+' : ''}${n}`);
      continue;
    }
    if (key.startsWith('foe.')) {
      const stat = key.slice(4);
      const v = STAGE_VALUE[stat];
      if (v === undefined) throw new Error(`${skill.id}: unknown stat ${stat}`);
      add((n <= 0 ? -v * n : -v * n * SELF_DRAWBACK) * foeChance, `foe ${stat}${n > 0 ? '+' : ''}${n}`);
      continue;
    }
    switch (key) {
      case 'foeChance':
      case 'odds':
      case 'hits':
        break;
      case 'heal':
        add(2.5 * n, `heal ${n}%`);
        break;
      case 'teamHeal':
        add(3.75 * n, `team heal ${n}%`);
        break;
      case 'shield':
        add(2.2 * n, `shield ${n}%`);
        break;
      case 'trueDamage':
        add(3 * n, `percent damage ${n}%`);
        break;
      case 'selfDamage':
        add(-2 * n, `self damage ${n}%`);
        break;
      case 'drain':
        add(power * n * 0.8, `drain ${n * 100}%`);
        break;
      case 'recoil':
        add(-power * n * 0.8, `recoil ${n * 100}%`);
        break;
      case 'charge':
        add(-45 * n, 'charging');
        break;
      case 'armorPen':
        add(power * n * 0.6, `ignore defense ${n * 100}%`);
        break;
      case 'critRate':
        add(power * 0.5 * n, `crit rate +${Math.round(n * 100)}%`);
        break;
      case 'ignoreGuard':
        add(20 * n, 'pierce Guard');
        break;
      case 'dispel':
        add(25 * n, 'dispel');
        break;
      case 'dispelTurns':
        add(35 * n, 'dispel timed effects');
        break;
      case 'cleanse':
        add(25 * n, 'cleanse self');
        break;
      case 'teamCleanse':
        add(50 * n, 'cleanse team');
        break;
      case 'forceSwitch':
        add(50 * n, 'forced switch');
        break;
      case 'pivot':
        add(30 * n, 'pivot');
        break;
      case 'field':
        add(90 * n, 'field');
        break;
      case 'side':
        add(90 * n, 'own-side effect');
        break;
      case 'charges':
        add(12 * n, `Electric Charge ${n > 0 ? '+' : ''}${n}`);
        break;
      case 'revealTrap':
        add(25 * n, 'reveal trap');
        break;
      case 'destroyTrap':
        add(65 * n, 'destroy trap');
        break;
      case 'negateTrap':
        add(110 * n, 'negate trap');
        break;
      case 'negateSkill':
        add(90 * n, 'negate skill');
        break;
      case 'block':
        add(85 * n, 'Guard');
        break;
      case 'lifeSave':
        add(100 * n, 'survive at 1 HP');
        break;
      case 'reduce':
        add(TYPICAL_HIT * n, `damage reduction ${n * 100}%`);
        break;
      case 'reflect':
        add(TYPICAL_HIT * n, `reflect ${n * 100}%`);
        break;
      case 'aeGain':
        add(25 * n, `Aether +${n}`);
        break;
      case 'aeDrain':
        add(25 * n, `foe Aether -${n}`);
        break;
      case 'aeLoan':
        // For the next n turns, 1 less aether is regained per turn; payment is deferred, so it is discounted by 20%
        add(-20 * n, `Advance: -1 Aether regained for the next ${n} turns`);
        break;
      // ── Second batch of mechanics ──
      case 'useDef':
      case 'foeAtk':
      case 'aeSteal':
        // The value of turning defense into offense / borrowing power depends on the user and is estimated separately via cond; stolen aether is counted together with aeDrain
        if (key === 'aeSteal') add(25 * (t.aeDrain ?? 0) * n, 'gain drained Aether');
        break;
      case 'bestDef':
        add(power * 0.12 * n, 'Refraction');
        break;
      case 'hpHigh':
        add(-power * 0.2 * n, 'power falls with HP');
        break;
      case 'hpLow':
        add(power * 0.2 * n, 'Last Stand');
        break;
      case 'spdPower':
        add(power * 0.1 * n, 'power scales with speed');
        break;
      case 'snowball':
        add(power * 0.35 * n, 'Streak');
        break;
      case 'gamble':
        add(power * 0.04 * n, 'Fate (expected)');
        break;
      case 'selfKO':
        add(-60 * n, 'Self-Destruct');
        break;
      case 'echo':
        add(power * n * 0.8, `Echo ${n * 100}%`);
        break;
      case 'bind':
        add(n * 3 * 2.4 * 0.8 + 25, `Entangle ${n}%×3`);
        break;
      case 'expose':
        add(50 * n, 'Exposed');
        break;
      case 'aetherPower':
        add(n * 2, 'Channel (expected 2 points)');
        break;
      case 'dig':
        add(45 * n, 'Burrow evasion');
        break;
      case 'wish':
        add(n * 2.5 * 0.9, `Wish ${n}%`);
        break;
      case 'doom':
        add(n * 3 * 0.85, `Prophecy ${n}%`);
        break;
      case 'decoy':
        add(n * 1.5 + 60, `Decoy ${n}%`);
        break;
      case 'disable':
        add(25 * n + 30, `Seal ${n} turns`);
        break;
      case 'copyStages':
        add(60 * n, 'Copy stages');
        break;
      case 'stealStages':
        add(60 * n, 'Steal buffs');
        break;
      case 'invertStages':
        add(60 * n, 'Invert stages');
        break;
      case 'baton':
        add(50 * n, 'Baton Pass');
        break;
      case 'bond':
        add(100 * n, 'Linked Fate');
        break;
      case 'painSplit':
        add(85 * n, 'HP Split');
        break;
      case 'perish':
        add(100, 'Perish');
        break;
      case 'transferStatus':
        add(60 * n, 'Scapegoat');
        break;
      case 'retaliate':
        add(TYPICAL_HIT * n * 0.9, `Counter Stance ${n * 100}%`);
        break;
      case 'hazard':
        add(5 * n, `Entry Hazard ${n}%`);
        break;
      case 'hazardSpd':
        add(45 * n, `Entry Hazard speed -${n}`);
        break;
      case 'screenPhys':
      case 'screenMag':
        add(3.5 * n, `${key === 'screenPhys' ? 'Crystal Wall' : 'Light Veil'} ${n}%`);
        break;
      case 'healWish':
        add(120 * n, 'Life Song');
        break;
      case 'cond':
        add(n, 'conditional bonus (expected)');
        break;
      case 'custom':
        // A signature effect implemented by a skill hook: the designer's estimated value in points (as with cond, the note must explain how it was estimated)
        add(n, 'exclusive effect (estimate)');
        break;
      case 'sig':
        // Flagship skill: adds no value, but allows a higher budget ratio (see sim/kitrules.ts)
        parts.push('flagship skill');
        break;
      case 'adjust':
        add(n, 'manual adjustment');
        break;
      default:
        throw new Error(`${skill.id}: unknown budget tag ${key}`);
    }
  }

  if (skill.category === 'trap') {
    const odds = t.odds ?? 1;
    if (odds !== 1) {
      parts.push(`trigger chance ×${odds}`);
      value *= odds;
    }
  } else if (skill.accuracy < 100) {
    parts.push(`accuracy ×${skill.accuracy / 100}`);
    value *= skill.accuracy / 100;
  }

  const target = targetBudget(skill, rarity);
  return { value, target, ratio: value / target, parts };
}

export function withinBudget(r: BudgetResult): boolean {
  return Math.abs(r.ratio - 1) <= BUDGET_TOLERANCE + 1e-9;
}
