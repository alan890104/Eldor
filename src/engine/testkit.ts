// Test helpers: build a battle, submit actions, read events, plus fixed test skills (prefixed t_, registered only in the test process).
// The group skill tests (src/engine/kits/<group>.test.ts) can use them directly too.

import { registerTestSkills } from '../data.ts';
import type { SkillDef } from '../../sim/types.ts';
import { Battle } from './battle.ts';
import { registerSkillHooks } from './kits/index.ts';
import type { BattleEvent, SideId, SpiritInstance, TurnInput } from './types.ts';

const T = (id: string, category: SkillDef['category'], cost: number, power: number, tags: Record<string, number> = {}, priority = 0): SkillDef => ({
  id,
  name: id,
  en: id,
  element: 'neutral',
  category,
  cost,
  power,
  accuracy: 100,
  priority,
  text: '測試用技能',
  tags,
});

/** Fixed test skills: plain numbers, resolved by tags alone, so they do not vanish when the skill table is revised */
export const TEST_SKILLS: SkillDef[] = [
  T('t_strike', 'physical', 0, 60),
  T('t_bolt', 'magic', 0, 60),
  T('t_blast', 'magic', 2, 100),
  T('t_quick_strike', 'physical', 1, 60, {}, 1),
  T('t_war_cry', 'status', 1, 0, { 'self.atk': 2 }),
  T('t_substitute', 'status', 2, 0, { decoy: 25 }),
  T('t_counter_stance', 'status', 1, 0, { retaliate: 1 }, 3),
  /** A status skill that does nothing (used to "skip" a turn) */
  T('t_wait', 'status', 0, 0),
  T('t_heal', 'status', 1, 0, { heal: 30 }),
  T('t_charge', 'magic', 1, 100, { charge: 1 }),
  /** A trap that fires at the end of the turn and has no effect (used to trigger the opponent's counter traps) */
  { ...T('t_trap', 'trap', 1, 0), trapSpeed: 'normal', trigger: '回合結束時' },
  // One for each generic engine tag (these used to borrow old skills in tests; now that the old skills are gone, they use these)
  T('t_self_ko', 'magic', 3, 200, { selfKO: 1 }),
  T('t_heal_wish', 'status', 3, 0, { healWish: 1 }),
  T('t_perish', 'status', 2, 0, { perish: 3 }),
  T('t_baton', 'status', 2, 0, { 'self.spd': 1, baton: 1, pivot: 1 }),
  T('t_bond', 'status', 2, 0, { bond: 1 }),
  T('t_burn_spell', 'status', 1, 0, { 'status.burn': 1 }),
  T('t_hazard', 'status', 1, 0, { hazard: 12 }),
  T('t_team_cleanse', 'status', 1, 0, { teamCleanse: 1, heal: 15 }),
  T('t_multi_hit', 'physical', 3, 125, { hits: 5 }),
  { ...T('t_ult', 'ultimate', 5, 220), damageType: 'auto' },
  /** Rain (water-element field) */
  { ...T('t_rain', 'status', 2, 0, { field: 1 }), element: 'water' },
];

/** Registers the test skills (call once at the top of each test file) */
export function useTestSkills(): void {
  registerTestSkills(TEST_SKILLS);
  registerSkillHooks('t_trap', { trap: { on: 'turnEnd', fire: () => {} } });
}

export type Spec = { id: string; skills?: string[]; level?: number };

export function inst(s: Spec, uid: string): SpiritInstance {
  const level = s.level ?? 60;
  return {
    uid,
    speciesId: s.id,
    level,
    exp: 0,
    stage: level >= 40 ? 3 : level >= 20 ? 2 : 1,
    resonance: 0,
    loadout: s.skills ?? ['t_strike', 't_bolt'],
  };
}

/** Builds a battle where both sides are driven by the test; both sides' aether is set to 10 */
export function duel(a: Spec[], b: Spec[], seed = 7): Battle {
  const bt = Battle.create({
    kind: 'trainer',
    seed,
    sides: [
      { name: 'A', spirits: a.map((s, i) => inst(s, `a${i}`)), isAI: false },
      { name: 'B', spirits: b.map((s, i) => inst(s, `b${i}`)), isAI: false },
    ],
  });
  bt.start();
  bt.side(0).aether = 10;
  bt.side(1).aether = 10;
  return bt;
}

export const use = (skillId: string, trap?: string): TurnInput => ({ main: { type: 'skill', skillId }, ...(trap ? { trap } : {}) });
export const sw = (to: number): TurnInput => ({ main: { type: 'switch', to } });
export const guard = (): TurnInput => ({ main: { type: 'guard' } });

/** Resolves one turn, then refills both sides' aether to 10 */
export function turn(b: Battle, a: TurnInput | string, c: TurnInput | string): BattleEvent[] {
  const ev = b.resolveTurn([typeof a === 'string' ? use(a) : a, typeof c === 'string' ? use(c) : c]);
  b.side(0).aether = 10;
  b.side(1).aether = 10;
  return ev;
}

export const texts = (ev: BattleEvent[]) => ev.filter((e) => e.k === 'text').map((e) => (e as { text: string }).text).join('｜');
export const traits = (ev: BattleEvent[]) => ev.filter((e) => e.k === 'trait').map((e) => (e as { name: string }).name);
export const kinds = (ev: BattleEvent[]) => ev.map((e) => e.k);
export const hitsBy = (ev: BattleEvent[], side: SideId) => ev.filter((e) => e.k === 'hit' && (e as { side: SideId }).side === side) as Extract<BattleEvent, { k: 'hit' }>[];
