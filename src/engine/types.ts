// Types for the battle engine. The engine is pure logic with no dependence on the UI; the UI only reads events and snapshots.

import type { Element, SpiritDef, Stats, StatusId } from '../../sim/types.ts';
import type { LastingState } from './skillfx.ts';

export type SideId = 0 | 1;
export type StageStat = 'atk' | 'mag' | 'def' | 'res' | 'spd';

/** A spirit in the save data */
export interface SpiritInstance {
  uid: string;
  speciesId: string;
  level: number;
  exp: number;
  /** Breakthrough stage (1-3; a breakthrough at Lv 20 and another at Lv 40), not a form: each spirit has only one form and one name */
  stage: 1 | 2 | 3;
  resonance: number;
  /** The 4 skills it carries */
  loadout: string[];
  bond?: number;
  corrupted?: boolean;
}

export type ArtId =
  | 'oath_break'
  | 'oath_guard'
  | 'oath_gale'
  | 'eye_insight'
  | 'light_purify'
  | 'aether_spring';

export interface StatusState {
  turns: number;
  stacks?: number;
}

export interface Combatant {
  uid: string;
  species: SpiritDef;
  name: string;
  elements: Element[];
  level: number;
  stage: 1 | 2 | 3;
  stats: Stats;
  maxHp: number;
  hp: number;
  stages: Record<StageStat, number>;
  status: Partial<Record<StatusId, StatusState>>;
  /** Toughness: remaining turns of control immunity */
  toughness: number;
  shield: { amount: number; turns: number } | null;
  charges: number;
  /** The skill being charged */
  charging: string | null;
  lastGuardTurn: number;
  guarding: boolean;
  skills: string[];
  ultimate: string | null;
  fainted: boolean;
  corrupted: boolean;
  // Scratch state for traits and skills
  arcaneChain: number;
  nextPriorityBoost: boolean;
  hitByPhysicalThisTurn: boolean;
  usedAttackThisTurn: boolean;
  leechSeed: { turns: number } | null;
  regen: number;
  // ── Second batch of mechanics ──
  /** Generic counters for traits and skills (e.g. clockwork winds, whether the mask has broken) */
  vars: Record<string, number>;
  /** Remaining HP of the substitute */
  decoy: number;
  /** The sealed skill */
  disabled: { skill: string; turns: number } | null;
  /** The last skill used (the target of a seal) */
  lastSkill: string | null;
  /** Bind: cannot switch out, loses HP at the end of the turn */
  bound: { turns: number; pct: number } | null;
  /** Perish countdown (0 = none) */
  perish: number;
  /** Exposed: remaining turns; the next attack taken during that time is always a crit */
  exposed: number;
  /** Shared fate: if knocked out before its own next action, the one who knocked it out faints too */
  bondActive: boolean;
  lastBondTurn: number;
  /** Echo: hits again at the end of next turn */
  echo: { skill: string; turns: number; mult: number } | null;
  /** Chain: how many times in a row the same skill has been used */
  snowball: { skill: string; n: number } | null;
  /** Burrowed (attacks cannot hit) */
  hidden: boolean;
  /** Counter stance: the multiplier reflected when attacked this turn */
  retaliate: number;
  /** HP at the start of this turn (Time Reversal) */
  hpAtTurnStart: number;
  /** The turn it entered the field */
  enteredTurn: number;
  /** Number of skills used since entering */
  usedSinceEnter: number;
  /** Priority value of this turn's action */
  actPriority: number;
  /** The wild spirit in the tutorial: its HP never drops to 0 (so the player can practice capturing) and the pact stone always succeeds */
  tutorial?: boolean;
  /** Lasting effects on it ("for N turns ...", see LastingHooks in skillfx.ts); cleared on leaving the field */
  lasting: LastingState[];
}

export interface TrapSlot {
  skillId: string;
  setTurn: number;
  revealed: boolean;
}

export interface SideState {
  name: string;
  team: Combatant[];
  active: number;
  aether: number;
  trap: TrapSlot | null;
  ultUsed: boolean;
  /** Ultimate power multiplier (the tutorial's "Star Gate Resonance"; 1 when absent) */
  ultBoost?: number;
  art: ArtId | null;
  artUsed: boolean;
  tailwind: number;
  isAI: boolean;
  /** Skills the opponent has used this battle (the `grimoire` trait) */
  seenFoeSkills: string[];
  /** The last attack skill this side used (for the opponent's copy skill) */
  lastAttackSkill: string | null;
  // Flags for this turn
  artThisTurn: ArtId | null;
  trapDisabledTurn: number;
  // ── Second batch of mechanics: side conditions ──
  /** Entry hazard: damage / speed drop when the opponent switches in */
  hazard: { pct: number; spd: number } | null;
  /** Crystal wall / light screen: reduces the physical / magic damage taken */
  screens: { phys: number; physTurns: number; mag: number; magTurns: number };
  /** Wish: when the turn count reaches zero, the active spirit heals */
  wish: { pct: number; turns: number } | null;
  /** Doom: when the turn count reaches zero, the active spirit takes damage (placed on the side being doomed) */
  doom: { pct: number; turns: number } | null;
  /** Song of Life: the next spirit to enter heals fully */
  healWish: boolean;
  /** Baton: the stat stages and shield the next spirit to enter inherits */
  baton: { stages: Record<StageStat, number>; shield: { amount: number; turns: number } | null } | null;
  /** The last status skill this side used (Mimic) */
  lastStatusSkill: string | null;
  /** Hourglass Advance: remaining turns of each loan; each loan lowers aether recovery by 1 at the end of the turn */
  aeLoans: number[];
  /** Per-side counters for skill hooks (kept for the whole battle) */
  vars: Record<string, number>;
  /** Lasting effects on the side: they act on that side's active spirit and persist across switches */
  lasting: LastingState[];
}

export interface FieldState {
  element: Element;
  turns: number;
}

export type BattleKind = 'wild' | 'trainer' | 'arena';

export interface BattleState {
  turn: number;
  sides: [SideState, SideState];
  field: FieldState | null;
  kind: BattleKind;
  seed: number;
  rngState: number;
  winner: SideId | 'draw' | null;
  captured: boolean;
  maxTurns: number;
  /** The side waiting for a replacement */
  pendingReplace: [boolean, boolean];
  /** Remaining turns of reversed action order (Trick Room-style): at equal priority the slower one acts first */
  reverseOrder?: number;
}

export type MainAction =
  | { type: 'skill'; skillId: string }
  /** System action "guard": takes no skill slot, costs 1 aether, priority +3, cannot be used on consecutive turns */
  | { type: 'guard' }
  | { type: 'switch'; to: number }
  | { type: 'capture'; stone: 'basic' | 'advanced' | 'master' };

export interface TurnInput {
  main: MainAction;
  trap?: string;
  art?: boolean;
}

// ───────────────────────── Snapshots and events ─────────────────────────

export interface CombatantView {
  uid: string;
  speciesId: string;
  name: string;
  level: number;
  stage: 1 | 2 | 3;
  elements: Element[];
  hp: number;
  maxHp: number;
  shield: number;
  charges: number;
  charging: boolean;
  seeded: boolean;
  fainted: boolean;
  stages: Record<StageStat, number>;
  status: { id: StatusId; turns: number; stacks?: number }[];
  corrupted: boolean;
  /** State marks for the second batch of mechanics and traits (substitute, seal, bind, perish ...) */
  marks: MarkView[];
}

export interface MarkView {
  id: string;
  /** Value (e.g. remaining substitute HP %, perish countdown) */
  n?: number;
  /** Remaining turns */
  turns?: number;
  /** Extra text (e.g. the name of the sealed skill) */
  note?: string;
}

export interface SideView {
  name: string;
  active: number;
  aether: number;
  hasTrap: boolean;
  trapId: string | null;
  trapRevealed: string | null;
  ultUsed: boolean;
  artUsed: boolean;
  tailwind: number;
  team: CombatantView[];
  /** Side conditions (entry hazard, crystal wall, light screen, wish, doom, Song of Life) */
  conds: MarkView[];
}

export interface BattleView {
  turn: number;
  field: FieldState | null;
  sides: [SideView, SideView];
  /** Remaining turns of reversed action order (0 or omitted = normal) */
  reverseOrder?: number;
}

export type HitTierName = 'light' | 'medium' | 'heavy' | 'crit' | 'ko' | 'ultimate';

export type BattleEventBody =
  | { k: 'turn'; turn: number }
  | { k: 'aether'; side: SideId; value: number; delta: number }
  | { k: 'art'; side: SideId; art: ArtId }
  | { k: 'trapSet'; side: SideId; skillId: string }
  | { k: 'switchOut'; side: SideId; idx: number }
  | { k: 'switchIn'; side: SideId; idx: number }
  | { k: 'field'; element: Element | null; turns: number }
  | { k: 'use'; side: SideId; skillId: string; ult: boolean; copied?: boolean }
  | { k: 'charge'; side: SideId; skillId: string }
  | { k: 'fail'; side: SideId; reason: string }
  | { k: 'trap'; side: SideId; skillId: string; chain: number }
  | { k: 'negate'; side: SideId; skillId: string }
  | { k: 'reveal'; side: SideId; skillId: string }
  | { k: 'trapDestroyed'; side: SideId; skillId: string }
  | { k: 'miss'; side: SideId }
  | { k: 'guarded'; side: SideId; broke?: boolean }
  | {
      k: 'hit';
      side: SideId;
      target: SideId;
      skillId: string;
      dmg: number;
      shieldDmg: number;
      crit: boolean;
      eff: number;
      ko: boolean;
      hitIndex: number;
      hits: number;
      ratio: number;
      ult: boolean;
      tier: HitTierName;
    }
  | { k: 'damage'; target: SideId; dmg: number; reason: string; ko: boolean }
  | { k: 'heal'; target: SideId; amount: number }
  | { k: 'shield'; target: SideId; amount: number }
  | { k: 'shieldBreak'; target: SideId }
  | { k: 'status'; target: SideId; status: StatusId; stacks?: number }
  | { k: 'statusEnd'; target: SideId; status: StatusId }
  | { k: 'resist'; target: SideId; reason: string }
  | { k: 'stat'; target: SideId; stat: StageStat; delta: number }
  | { k: 'charges'; target: SideId; value: number }
  | { k: 'dispel'; target: SideId }
  | { k: 'cleanse'; target: SideId; team: boolean }
  | { k: 'faint'; side: SideId; idx: number }
  | { k: 'trait'; side: SideId; name: string }
  | { k: 'capture'; success: boolean; shakes: number; stone: 'basic' | 'advanced' | 'master' }
  | { k: 'text'; text: string }
  | { k: 'end'; winner: SideId | 'draw' };

export type BattleEvent = BattleEventBody & { view: BattleView };
