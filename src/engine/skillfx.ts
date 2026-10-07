// Skill hooks: an exclusive skill's special effect is written as hooks, which the battle engine calls at fixed moments.
// Each element group has one file, src/engine/kits/<group>.ts, exporting FX: Record<skill id, SkillHooks>;
// the merged table is SKILL_FX (src/engine/kits/index.ts). See docs/10-kit-authoring.md for how to write them, with examples.
//
// Principles:
// - Use tags (see sim/budget.ts) for any effect they can express; the engine resolves them automatically. Write hooks only for what tags cannot do.
// - Hooks change the battle through Battle's public methods (b.damage, b.applyStatus, b.changeStage ...); do not modify b.s directly.
// - For counters use c.vars (per spirit) or b.side(id).vars (per side); prefix the key with the skill or spirit to avoid collisions.
//   Keys starting with 'e:' are cleared when the spirit leaves the field; the rest are kept for the whole battle.
// - power / accuracy / hits / critBonus are also called when the AI and UI estimate damage (ctx.estimate = true);
//   then they may only read: no dice rolls, no state changes.

import type { SkillDef, StatusId } from '../../sim/types.ts';
import type { Battle } from './battle.ts';
import type { TraitHooks } from './traits.ts';
import type { MarkView, SideId, StageStat } from './types.ts';

/** Basic information about an attack (trait hooks use this too) */
export interface AttackCtx {
  /** Attacker */
  attacker: SideId;
  /** Defender */
  defender: SideId;
  /** The skill being resolved (the copied skill for transcribe and mimic) */
  sk: SkillDef;
  /** Computed with ATK / DEF (physical) or MAG / RES (magic) */
  cat: 'physical' | 'magic';
}

/** The attack information a skill hook receives */
export interface HitCtx extends AttackCtx {
  /** The defender is guarding, but this attack ignores guard */
  guardBroken: boolean;
  /** A follow-up attack (echo, b.followUp): not this turn's main action */
  followUp: boolean;
  /** Only estimating damage (the AI, the preview on the skill card): no dice rolls, no state changes */
  estimate: boolean;
}

/** The result of each hit */
export interface HitInfo {
  /** Which hit (counting from 1) */
  index: number;
  hits: number;
  /** Damage dealt by this hit (including the part absorbed by the shield) */
  dmg: number;
  crit: boolean;
  /** This hit knocked out the opponent */
  ko: boolean;
}

/** The result after all hits of an attack are resolved */
export interface AttackResult {
  /** Total damage (including the parts absorbed by the shield and the substitute) */
  dealt: number;
  /** The opponent was knocked out */
  ko: boolean;
  /** Number of hits that actually landed */
  hits: number;
  /** All the damage landed on the substitute (added effects do not apply) */
  decoyBlocked: boolean;
}

/** The result of switching to another skill (transcribe, mimic) */
export interface Redirect {
  /** Id of the skill actually used */
  skill: string;
  /** Aether actually paid */
  cost: number;
  /** Power multiplier */
  powerMult?: number;
  /** Text shown before use */
  text?: string;
}

// ───────────────────────── Traps ─────────────────────────

/**
 * Events that trigger a trap. owner is the trap's owner and foe is the opponent (b.foe(owner)).
 * - foeEnter: after the opponent's spirit enters by switch or replacement (battle start does not count)
 * - foeLeave: after the opponent declares a switch, before it leaves (negate = the switch fails)
 * - foeAttack: after the opponent's attack passes the hit check, before damage (can reduce, reflect or nullify)
 * - foeStatus: when the opponent uses a status skill, before its effect resolves (negate = the status skill has no effect)
 * - foeSetTrap: after the opponent sets a trap (negate = destroy that trap)
 * - foeTrapFire: when the opponent's trap fires (chain; should be a counter trap; negate = nullify it)
 * - foeCharge: when the opponent starts charging (negate = interrupt the charge)
 * - foeBuff: after the opponent's stat stage rises
 * - foeHeal: after the opponent restores HP
 * - lethal: when our spirit is about to be knocked out by an attack (survive = keep 1 HP)
 * - fainted: after our spirit is knocked out by the opponent
 * - turnEnd: at the end of the turn (after status damage and traits)
 */
export type TrapEvent =
  | { on: 'foeEnter' }
  | { on: 'foeLeave'; to: number }
  | { on: 'foeAttack'; ctx: AttackCtx; eff: number }
  | { on: 'foeStatus'; sk: SkillDef }
  | { on: 'foeSetTrap'; skillId: string }
  | { on: 'foeTrapFire'; skillId: string }
  | { on: 'foeCharge'; skillId: string }
  | { on: 'foeBuff'; stat: StageStat; delta: number }
  | { on: 'foeHeal'; amount: number }
  | { on: 'lethal'; ctx: AttackCtx; dmg: number }
  | { on: 'fainted'; by: SideId; byAttack: boolean }
  | { on: 'turnEnd' };

export type TrapEventName = TrapEvent['on'];
export const TRAP_EVENTS: TrapEventName[] = ['foeEnter', 'foeLeave', 'foeAttack', 'foeStatus', 'foeSetTrap', 'foeTrapFire', 'foeCharge', 'foeBuff', 'foeHeal', 'lethal', 'fainted', 'turnEnd'];

/** What a trap returns to the engine after it fires (depending on the event, only some fields are meaningful) */
export interface TrapResult {
  /** foeAttack: damage reduction ratio for this attack (0 to 1; combined with other reductions, at most 75%) */
  reduce?: number;
  /** foeAttack: reflects this fraction of the original damage back to the attacker */
  reflect?: number;
  /** foeAttack / foeStatus / foeSetTrap / foeTrapFire / foeCharge / foeLeave: nullifies the opponent's action */
  negate?: boolean;
  /** lethal: keep 1 HP */
  survive?: boolean;
  /** foeAttack: after the attack resolves, our spirit switches with a bench spirit */
  escape?: boolean;
  /** foeAttack: runs after the attack resolves (if the attacker is still active), e.g. to freeze the attacker */
  after?: () => void;
}

type TrapSpecOf<E extends TrapEventName> = {
  /** The triggering event */
  on: E;
  /** Extra condition (omitted = fires whenever the event happens) */
  when?(b: Battle, owner: SideId, ev: Extract<TrapEvent, { on: E }>): boolean;
  /** Fires the effect; the trap has already been removed from the trap slot and the chain has already resolved */
  fire(b: Battle, owner: SideId, ev: Extract<TrapEvent, { on: E }>): TrapResult | void;
};
/** A trap's hooks: on decides the triggering event, when the extra condition, fire runs the effect */
export type TrapHooks = { [E in TrapEventName]: TrapSpecOf<E> }[TrapEventName];

// ───────────────────────── Lasting effects ─────────────────────────

/** State of one lasting effect ("for N turns ...") */
export interface LastingState {
  /** Id of the effect: the id of the skill that created it (the hooks live in that skill's lasting) */
  key: string;
  /** Remaining turns (including the turn it was created; −1 at the end of each turn, ends at zero) */
  turns: number;
  /** Free-use value (stacks, strength) */
  n: number;
  /** The side that created the effect */
  from: SideId;
}

/**
 * Hooks of a lasting effect: after it is created with b.addLasting(target, skill id, turns),
 * the engine calls these functions while the effect exists. owner is the side the effect sits on (on a spirit it follows the spirit
 * and is cleared on leaving the field; on the side (side: true) it acts on that side's active spirit and persists across switches).
 */
export interface LastingHooks {
  /** Name shown in the status bar (defaults to the skill name) */
  name?: string;
  /** When the holder attacks: damage bonus (additive, 0.3 = +30%) */
  attackBonus?(b: Battle, ctx: HitCtx, e: LastingState): number;
  /** When the holder is attacked: damage reduction ratio (0 to 1; combined with other reductions, at most 75%) */
  reduce?(b: Battle, ctx: HitCtx, e: LastingState): number;
  /** The holder is completely unaffected by this attack (no damage and no added effects, e.g. "immune to fire attacks for N turns") */
  immune?(b: Battle, ctx: HitCtx, e: LastingState): boolean;
  /** When the holder attacks: crit chance bonus */
  critBonus?(b: Battle, ctx: HitCtx, e: LastingState): number;
  /** Priority bonus for the holder's actions */
  priority?(b: Battle, owner: SideId, sk: SkillDef, e: LastingState): number;
  /** The holder cannot use certain skills: returns the reason */
  canUse?(b: Battle, owner: SideId, sk: SkillDef, e: LastingState): string | null;
  /** After the holder is attacked */
  onHitTaken?(b: Battle, ctx: HitCtx, dealt: number, e: LastingState): void;
  /** After the holder's attack deals damage */
  onDealt?(b: Battle, ctx: HitCtx, dealt: number, e: LastingState): void;
  /** The holder cannot fall into this status condition */
  blockStatus?(b: Battle, owner: SideId, st: StatusId, e: LastingState): boolean;
  /** The holder cannot restore HP */
  blockHeal?(b: Battle, owner: SideId, e: LastingState): boolean;
  /**
   * When the holder receives healing (checked before curse and blockHeal): returning true turns this heal into losing the same amount of HP (e.g. wither).
   * amount is the amount that was going to be restored (including overflow). Called only on actual healing (not on estimates), so counters can be accumulated here.
   */
  invertHeal?(b: Battle, owner: SideId, amount: number, e: LastingState): boolean;
  /** At the end of each turn (before the decrement) */
  onTurnEnd?(b: Battle, owner: SideId, e: LastingState): void;
  /** When the effect ends (turns reach zero; not called when it is cleared by leaving the field) */
  onExpire?(b: Battle, owner: SideId, e: LastingState): void;
  /**
   * The holder's action this time is void (e.g. stun): returns the reason (shown as the action failing); returns null if it may act.
   * Checked after control statuses and seals; sk is the skill the holder is about to use (the system action guard is asked too, with sk.id 'guard')
   */
  blockAction?(b: Battle, owner: SideId, sk: SkillDef, e: LastingState): string | null;
}

// ───────────────────────── Skill hooks ─────────────────────────

export interface SkillHooks {
  // ── Availability, cost, priority ──
  /** Extra usage condition: returns the reason when it cannot be used (shown on the skill card) */
  canUse?(b: Battle, id: SideId): string | null;
  /** Actual cost (defaults to the skill's cost) */
  cost?(b: Battle, id: SideId, base: number): number;
  /** Priority bonus (added to the skill's priority) */
  priority?(b: Battle, id: SideId): number;

  // ── Attack numbers (shared by real battles and estimates) ──
  /** Conditional power: returns the new power (base already includes the tags' power modifiers) */
  power?(b: Battle, ctx: HitCtx, base: number): number;
  /** Accuracy (0 to 100) */
  accuracy?(b: Battle, ctx: HitCtx, base: number): number;
  /** Crit chance bonus (additive, 0.2 = +20%) */
  critBonus?(b: Battle, ctx: HitCtx): number;
  /** Number of hits: power per hit = power / the tag's hits; for estimates return the expected value (may be fractional) */
  hits?(b: Battle, ctx: HitCtx, base: number): number;
  /** Conditional "ignore guard": when it returns true, this attack ignores guard and shields (same effect as the ignoreGuard tag; e.g. the Azure Flame of `ignisar`) */
  pierceGuard?(b: Battle, id: SideId): boolean;

  // ── Attack resolution ──
  /** After each hit (not called for hits absorbed by a substitute) */
  onHit?(b: Battle, ctx: HitCtx, hit: HitInfo): void;
  /** After all hits of the attack resolve (called only if it landed); before recoil, drain and added effects */
  afterAttack?(b: Battle, ctx: HitCtx, res: AttackResult): void;
  /** When it returns true, this hit does not wake an opponent that is asleep (e.g. the "Reverie" of `siren`); checked before onHit */
  keepSleep?(b: Battle, ctx: HitCtx): boolean;

  // ── Status skills ──
  /** Custom effect of a status skill: runs after the tag effects and before the post-attack switch (not run on a miss; a substitute does not block it automatically, so check yourself) */
  effect?(b: Battle, id: SideId, sk: SkillDef): void;

  // ── Common ──
  /** After the skill fully resolves (called for both attacks and status skills; not called if the user has left the field or fainted) */
  afterUse?(b: Battle, id: SideId, sk: SkillDef): void;
  /** Switch to another skill (transcribe, mimic): returns the skill to use; returning a string means the failure reason */
  redirect?(b: Battle, id: SideId): Redirect | string;
  /** Pursuit: if the opponent switches this turn, acts first at power x n before it leaves */
  pursuit?: number;
  /** Tags that count toward the budget but are not resolved automatically by the engine (the hooks implement the effect), e.g. ['heal', 'status.bleed'] */
  manual?: string[];
  /** The trap's trigger and effect (required for a trap) */
  trap?: TrapHooks;
  /** The lasting effect this skill creates (b.addLasting(target, this skill's id, turns)) */
  lasting?: LastingHooks;
  /** Extra score added when the AI evaluates this skill (base = the score computed from tags; a typical attack is about 20 to 100) */
  aiScore?(b: Battle, id: SideId, base: number): number;
  /**
   * While charging underground: returns true when the holder will surface and strike before the opponent acts with sk.
   * b.estimate by default estimates a target underground as 0 damage; when this returns true it estimates as usual (the opponent's attack lands after the surfacing).
   */
  emergesFirst?(b: Battle, holder: SideId, sk: SkillDef): boolean;
}

// ───────────────────────── Kit hooks (signature mechanics) ─────────────────────────

/**
 * Kit hooks: each spirit's signature mechanic and (rewritten) trait, written as KIT[spirit id] in src/engine/kits/<group>.ts.
 * Same shape as the trait hooks (TraitHooks, see traits.ts); the engine calls it at every moment it calls trait hooks,
 * and marks can additionally show the mechanic's state (stacks, form, countdown ...) on the battle screen.
 * When a kit rewrites the trait ("trait") in data/kits, the old trait implementation is disabled and the new trait must be written here.
 */
export interface KitHooks extends TraitHooks {
  /** State marks: returns the marks to show (e.g. { id: 'kit:heat', n: 3, note: 'Heat' }) */
  marks?(b: Battle, id: SideId): MarkView[];
  /** AI: extra score when considering "guard" (e.g. a negative score when its own clause forbids guarding) */
  aiGuard?(b: Battle, id: SideId, base: number): number;
  /** AI: extra score when the opponent (the side whose id is this spirit's) considers "guard" (e.g. a Time Seal about to come due, so the opponent AI knows to guard) */
  aiFoeGuard?(b: Battle, id: SideId, base: number): number;
  /** While active, after an opponent's spirit enters (switch, forced switch, replacement; battle start does not count). id is this spirit's side (e.g. Storm Ring) */
  onFoeEnter?(b: Battle, id: SideId): void;
  /** When gaining a charge goes past the 3-stack cap: n is the number of overflowed stacks (e.g. Overcharge) */
  chargeOverflow?(b: Battle, id: SideId, n: number): void;
  /** Effects that also trigger while on the bench (not sent out, not fainted), like a hand trap in Yu-Gi-Oh! */
  bench?: BenchHooks;
}

/**
 * Bench effects: the engine calls these at these moments while the spirit is on the bench. self is the spirit's index in the team
 * (b.side(side).team[self]). Once-per-battle effects are recorded in team[self].vars.
 * Do not switch spirits in the middle of attack resolution (onAllyHit); to "jump out", use b.switchTo in onAllyFaint / onTurnEnd.
 */
export interface BenchHooks {
  /** When our active spirit is knocked out (after the faint, before the replacement) */
  onAllyFaint?(b: Battle, side: SideId, self: number, byAttack: boolean): void;
  /** After our active spirit is attacked */
  onAllyHit?(b: Battle, side: SideId, self: number, ctx: AttackCtx, dealt: number): void;
  /** After the opponent uses a skill (attack, status skill, ultimate; traps do not count) */
  onFoeSkill?(b: Battle, side: SideId, self: number, sk: SkillDef): void;
  /** At the end of the turn */
  onTurnEnd?(b: Battle, side: SideId, self: number): void;
}

// ───────────────────────── Small helpers for hooks ─────────────────────────

export function isAttack(s: SkillDef): boolean {
  return s.category === 'physical' || s.category === 'magic' || s.category === 'ultimate';
}

/** Number of status conditions on the spirit */
export function statusCount(b: Battle, side: SideId): number {
  return Object.keys(b.active(side).status).length;
}

/** Sum of positive stat stages */
export function buffTotal(b: Battle, side: SideId): number {
  return Object.values(b.active(side).stages).reduce((a, v) => a + Math.max(0, v), 0);
}

/** Reads a spirit counter (defaults to 0) */
export function getVar(b: Battle, side: SideId, key: string): number {
  return b.active(side).vars[key] ?? 0;
}

/** Adds to or subtracts from a spirit counter and returns the new value (with optional min and max) */
export function addVar(b: Battle, side: SideId, key: string, delta: number, max = Infinity, min = 0): number {
  const c = b.active(side);
  const v = Math.max(min, Math.min(max, (c.vars[key] ?? 0) + delta));
  c.vars[key] = v;
  return v;
}
