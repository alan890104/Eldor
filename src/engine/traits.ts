// Legacy traits not yet rewritten by a kit: plugged into the battle engine as hooks (a few live in battle.ts, gated by legacyTrait(c)).
// When a kit (data/kits) rewrites a trait, both these and the old implementation in battle.ts are disabled; the new trait is written as KIT in src/engine/kits/<group>.ts.

import type { SkillDef } from '../../sim/types.ts';
import { AETHER } from '../../sim/formulas.ts';
import type { Battle } from './battle.ts';
import { KIT_FX } from './kits/index.ts';
import { CORRUPTION } from './corruption.ts';
import type { AttackCtx, KitHooks } from './skillfx.ts';
import type { Combatant, SideId, StageStat } from './types.ts';

export type { AttackCtx };

export interface TraitHooks {
  /** On entering the field (battle start, switch, replacement) */
  onEnter?(b: Battle, id: SideId): void;
  /** On switching out (a faint does not count). c is the spirit leaving */
  onLeave?(b: Battle, id: SideId, c: Combatant): void;
  /** At the end of the turn (active and not fainted) */
  onEndTurn?(b: Battle, id: SideId): void;
  /** Attacker: damage bonus (additive) */
  attackBonus?(b: Battle, a: AttackCtx): number;
  /** Attacker: overrides the type-effectiveness multiplier (e.g. ignore resistance); eff is the original multiplier, and the UI's "super effective / not very effective" also follows the returned value */
  typeMult?(b: Battle, a: AttackCtx, eff: number): number;
  /** Attacker: crit chance bonus */
  critBonus?(b: Battle, a: AttackCtx): number;
  /** Attacker: turns a single hit into several, with the power split of each hit */
  hitSplit?: number[];
  /** Attacker: priority bonus */
  priorityBonus?(b: Battle, id: SideId, sk: SkillDef): number;
  /** Attacker: the first skill after entering costs no aether (ultimates excepted) */
  freeFirstSkill?: boolean;
  /** Defender: cannot be crit */
  critImmune?: boolean;
  /** Defender: attacks with priority +1 or higher have no effect on it */
  blockPriority?: boolean;
  /** Defender: accuracy multiplier for the opponent's attacks */
  accuracyMult?(b: Battle, a: AttackCtx): number;
  /** Defender: absorbs the attack (returning true means no damage and no added effects) */
  absorb?(b: Battle, a: AttackCtx): boolean;
  /** Defender: modifies the damage of a single hit (e.g. mask) */
  incoming?(b: Battle, a: AttackCtx, dmg: number): number;
  /** Defender: when an attack is successfully guarded */
  onGuarded?(b: Battle, id: SideId): void;
  /** Defender: after being attacked */
  onHitTaken?(b: Battle, a: AttackCtx, dealt: number): void;
  /** After HP decreases (including dropping to 0 before fainting); can revive or trigger threshold effects here */
  hpTrigger?(b: Battle, id: SideId, prevHp: number): void;
  /** When knocked out */
  onFaint?(b: Battle, id: SideId, by: SideId, byAttack: boolean): void;
  /** Stat stages cannot be lowered by the opponent */
  blockStatDrop?: boolean;
  /** After the opponent uses a status skill */
  onFoeStatusSkill?(b: Battle, id: SideId, sk: SkillDef): void;
  /** When our own trap activates */
  onTrapActivated?(b: Battle, id: SideId): void;
  /** Stat multiplier */
  statMult?(b: Battle, id: SideId, key: StageStat): number;
  /** Cannot be forced to switch */
  forceSwitchImmune?: boolean;
  /** While active, the opponent cannot switch voluntarily */
  lockFoeSwitch?: boolean;
}

const once = (c: Combatant, key: string): boolean => {
  if (c.vars[key]) return false;
  c.vars[key] = 1;
  return true;
};

export const TRAITS: Record<string, TraitHooks> = {
  // ── Emerald Whisper Forest ──
  springlotus: {
    // Spring Surge: while active, our aether +1 at the end of each turn
    onEndTurn(b, id) {
      if (b.side(id).aether >= AETHER.max) return;
      b.traitEvent(id, '湧泉');
      b.gainAether(id, 1);
    },
  },
  acornsquirrel: {
    // Hoarding: heals 25% the first time HP drops below 50%
    hpTrigger(b, id) {
      const c = b.active(id);
      if (c.hp <= 0 || c.hp * 2 > c.maxHp || !once(c, 'ate')) return;
      b.traitEvent(id, '囤糧');
      b.heal(id, 25);
    },
  },

  // ── Tidesong Isles ──
  bubblecrab: {
    // Hard Shell: cannot be crit
    critImmune: true,
  },
  swordfish: {
    // Wavebreaker: the first attack skill after entering has priority +1 (`struck` is cleared on leaving)
    priorityBonus(b, id, sk) {
      const isAtk = sk.category === 'physical' || sk.category === 'magic';
      return isAtk && !b.active(id).vars.struck ? 1 : 0;
    },
  },

  // ── Stonehart Canyon ──
  gargoyle: {
    // Petrify: the first time HP drops below 30%, DEF and RES +2, SPD −2
    hpTrigger(b, id) {
      const c = b.active(id);
      if (c.hp <= 0 || c.hp * 10 > c.maxHp * 3 || !once(c, 'petrified')) return;
      b.traitEvent(id, '石化');
      b.changeStage(id, 'def', 2);
      b.changeStage(id, 'res', 2);
      b.changeStage(id, 'spd', -2);
    },
  },
  rhino: {
    // Charge: physical damage +20% when faster than the opponent
    attackBonus(b, a) {
      if (a.cat !== 'physical') return 0;
      const c = b.active(a.attacker);
      const d = b.active(a.defender);
      return b.effStat(c, 'spd', a.attacker) > b.effStat(d, 'spd', a.defender) ? 0.2 : 0;
    },
  },

  // ── Thunderpeal Wilds ──
  stormhorse: {
    // Stampede: damage +8% for each non-fainted bench spirit
    attackBonus(b, a) {
      return 0.08 * b.aliveBench(a.attacker).length;
    },
  },

  // ── Dawnlight Holy City ──
  candledove: {
    // Bell of Peace: on entering, both sides' stat stages reset to zero
    onEnter(b, id) {
      const any = ([id, b.foe(id)] as SideId[]).some((s) => Object.values(b.active(s).stages).some((v) => v !== 0));
      if (!any) return;
      b.traitEvent(id, '和平鐘聲');
      b.resetStages(id);
      b.resetStages(b.foe(id));
    },
  },

  // ── Duskshade Realm ──
  abyssjelly: {
    // Paralytic Tentacles: 30% to paralyze the attacker when hit by a physical attack
    onHitTaken(b, a) {
      if (a.cat !== 'physical' || b.active(a.attacker).fainted || b.rng() >= 0.3) return;
      b.traitEvent(a.defender, '麻痺觸手');
      b.applyStatus(a.attacker, 'paralyze');
    },
  },
  tombhound: {
    // Three Heads: a single hit becomes 2 hits, the second with 40% power
    hitSplit: [1, 0.4],
  },
  weaverspider: {
    // Weaving: when our trap activates, the opponent's SPD −1
    onTrapActivated(b, id) {
      const f = b.foe(id);
      if (b.active(f).fainted) return;
      b.traitEvent(id, '織網');
      b.changeStage(f, 'spd', -1, true);
    },
  },

  // ── Legend ──
  astragate: {
    // Star Gate Ward: on entering, crystal wall and light screen for 3 turns (−20%)
    onEnter(b, id) {
      b.traitEvent(id, '星門結界');
      b.setScreen(id, 'phys', 20, 3);
      b.setScreen(id, 'mag', 20, 3);
    },
  },
  chronodragon: {
    // Time Reversal: the first time HP drops below 25% (including being knocked out), HP returns to what it was at the start of this turn
    hpTrigger(b, id) {
      const c = b.active(id);
      if (c.hp * 4 > c.maxHp || c.hpAtTurnStart * 4 <= c.maxHp || !once(c, 'rewound')) return;
      b.traitEvent(id, '逆時');
      const before = c.hp;
      c.hp = Math.max(c.hp, c.hpAtTurnStart);
      if (c.hp > before) b.healEvent(id, c.hp - before);
    },
  },
};

/** Temporary counters cleared on leaving (other flags, such as "once per battle" ones, are kept); keys starting with 'e:' are cleared too */
export const PER_ENTRY_VARS = ['struck'];

/** This spirit uses the legacy trait implementation (its kit does not rewrite the trait). Every hard-coded spirit trait in battle.ts must check this first */
export function legacyTrait(c: Combatant): boolean {
  return !c.species.traitOverride;
}

const NONE: KitHooks[] = [];

/** The trait hooks currently in effect: the legacy trait (when not rewritten) plus the kit hooks (KIT) */
export function traitHooks(c: Combatant): (TraitHooks | KitHooks)[] {
  const legacy = legacyTrait(c) ? TRAITS[c.species.id] : undefined;
  const kit = KIT_FX[c.species.id];
  const base = !legacy && !kit ? NONE : legacy && kit ? [legacy, kit] : [(legacy ?? kit)!];
  // A corrupted spirit additionally gets the corruption trait
  return c.corrupted ? [...base, CORRUPTION] : base;
}

/** Kit hooks (undefined when there are none) */
export function kitHooks(c: Combatant): KitHooks | undefined {
  return KIT_FX[c.species.id];
}

export function traitOf(c: Combatant): TraitHooks | undefined {
  return legacyTrait(c) ? TRAITS[c.species.id] : undefined;
}
