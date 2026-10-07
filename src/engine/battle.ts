// The Eldor battle engine. Rules are in docs/04-battle.md and docs/05-skill-design.md.
// resolveTurn() resolves a whole turn at once and returns the list of events; every event carries a snapshot of the moment,
// so the UI only has to play the events in order and update the HUD from the snapshots.
// Special skill effects are not written here: tags are resolved automatically by the engine, and what tags cannot do is written as skill hooks (SKILL_FX,
// src/engine/kits/<group>.ts, interface in skillfx.ts); traits live in traits.ts and in the kit hooks (KIT).
// The only skill id in this file is the system action "guard" (GUARD_ID).

import { findSkill, getSkill, getSpirit, GUARD_ID, SYSTEM_SKILL_IDS } from '../data.ts';
import {
  captureChance,
  computeDamage,
  computeStats,
  statStageMultiplier,
  typeMultiplier,
  AETHER,
  CRIT_RATE,
} from '../../sim/formulas.ts';
import { hitTier } from '../../sim/feel.ts';
import type { Element, SkillDef, StatusId } from '../../sim/types.ts';
import { kitHooks, legacyTrait, PER_ENTRY_VARS, traitHooks } from './traits.ts';
import { SKILL_FX } from './kits/index.ts';
import { isAttack, type AttackCtx, type AttackResult, type BenchHooks, type HitCtx, type LastingHooks, type LastingState, type SkillHooks, type TrapEvent, type TrapResult } from './skillfx.ts';
import type {
  ArtId,
  BattleEvent,
  BattleEventBody,
  BattleKind,
  BattleState,
  BattleView,
  Combatant,
  CombatantView,
  MarkView,
  SideId,
  SideState,
  SpiritInstance,
  StageStat,
  TurnInput,
} from './types.ts';

export const ULT_COST = 5;
export const CONTROL: StatusId[] = ['freeze', 'sleep', 'fear'];
const TIMED: StatusId[] = ['burn', 'poison', 'bleed', 'paralyze', 'root', 'silence', 'taunt', 'curse'];
const STATUS_TURNS: Record<StatusId, number> = {
  burn: 3,
  poison: 4,
  bleed: 3,
  freeze: 1,
  sleep: 2,
  fear: 1,
  paralyze: 2,
  root: 2,
  silence: 2,
  taunt: 2,
  curse: 3,
};
const IMMUNITY: Partial<Record<Element, StatusId>> = {
  fire: 'burn',
  water: 'freeze',
  nature: 'poison',
  wind: 'bleed',
  earth: 'root',
  thunder: 'paralyze',
  light: 'silence',
  dark: 'fear',
};
const SSR_FIELD: Record<string, Element> = {
  ignisar: 'fire',
  thalassene: 'water',
  sylvaron: 'nature',
  aeroth: 'wind',
  terragon: 'earth',
  voltarion: 'thunder',
  luminael: 'light',
  noxfang: 'dark',
};
const STATUS_LABEL: Record<StatusId, string> = {
  burn: '灼燒',
  poison: '中毒',
  bleed: '裂傷',
  freeze: '冰凍',
  sleep: '睡眠',
  fear: '恐懼',
  paralyze: '麻痺',
  root: '束縛',
  silence: '沉默',
  taunt: '挑釁',
  curse: '詛咒',
};

export interface TeamSpec {
  name: string;
  spirits: SpiritInstance[];
  isAI: boolean;
  art?: ArtId | null;
  /** Arena: everything is flattened to Lv 60, stage III, resonance R0 */
  normalize?: boolean;
  /** Stat multiplier (a story blessing, e.g. Nova's blessing in the final battle) */
  boost?: number;
  /** Tutorial "Star Gate Resonance": allows the ultimate before stage III */
  awaken?: boolean;
  /** Tutorial "Star Gate Resonance": ultimate power multiplier */
  ultBoost?: number;
  /** HP multiplier, applied on top of boost (tutorial: the wild spirit can take a full ultimate hit) */
  hpBoost?: number;
  /** The wild spirit in the tutorial: its HP never drops to 0 and the pact stone always succeeds */
  tutorial?: boolean;
}

export interface CreateOptions {
  sides: [TeamSpec, TeamSpec];
  kind: BattleKind;
  seed: number;
  maxTurns?: number;
}

/** Skills that can go in a skill slot: they exist, are not ultimates and are not system actions (an unknown id in an old save or a test does not crash) */
function loadable(id: string): boolean {
  const s = findSkill(id);
  return !!s && s.category !== 'ultimate' && !SYSTEM_SKILL_IDS.has(id);
}

export function makeCombatant(inst: SpiritInstance, normalize = false, boost = 1): Combatant {
  const species = getSpirit(inst.speciesId);
  const level = normalize ? 60 : inst.level;
  const stage = normalize ? 3 : inst.stage;
  const resonance = normalize ? 0 : inst.resonance;
  const stats = computeStats(species.base, level, stage, resonance);
  if (boost !== 1) for (const k of Object.keys(stats) as (keyof typeof stats)[]) stats[k] = Math.round(stats[k] * boost);
  return {
    uid: inst.uid,
    species,
    name: species.name,
    elements: species.elements,
    level,
    stage,
    stats,
    maxHp: stats.hp,
    hp: stats.hp,
    stages: { atk: 0, mag: 0, def: 0, res: 0, spd: 0 },
    status: {},
    toughness: 0,
    shield: null,
    charges: 0,
    charging: null,
    lastGuardTurn: -10,
    guarding: false,
    skills: [...new Set(inst.loadout.filter(loadable))].slice(0, 4),
    ultimate: stage === 3 && findSkill(species.ultimate)?.category === 'ultimate' ? species.ultimate : null,
    fainted: false,
    corrupted: !!inst.corrupted,
    arcaneChain: 0,
    nextPriorityBoost: false,
    hitByPhysicalThisTurn: false,
    usedAttackThisTurn: false,
    leechSeed: null,
    regen: 0,
    vars: {},
    decoy: 0,
    disabled: null,
    lastSkill: null,
    bound: null,
    perish: 0,
    exposed: 0,
    bondActive: false,
    lastBondTurn: -10,
    echo: null,
    snowball: null,
    hidden: false,
    retaliate: 0,
    hpAtTurnStart: stats.hp,
    enteredTurn: 0,
    usedSinceEnter: 0,
    actPriority: 0,
    lasting: [],
  };
}

export { isAttack };

/** Cost of the system action "guard" */
export const GUARD_COST = 1;

/** A skill's hooks (an empty object when there are none) */
export function fxOf(skillId: string): SkillHooks {
  return SKILL_FX[skillId] ?? NO_FX;
}
const NO_FX: SkillHooks = {};

export function skillCost(s: SkillDef): number {
  return s.category === 'ultimate' ? ULT_COST : s.cost;
}

export interface UsableResult {
  ok: boolean;
  reason?: string;
}

export class Battle {
  s: BattleState;
  private events: BattleEvent[] = [];

  constructor(state: BattleState) {
    this.s = state;
  }

  static create(o: CreateOptions): Battle {
    const mk = (t: TeamSpec): SideState => ({
      name: t.name,
      team: t.spirits.map((i) => {
        const c = makeCombatant(i, t.normalize, t.boost);
        if (t.awaken) c.ultimate = c.species.ultimate;
        if (t.hpBoost) c.maxHp = c.hp = c.stats.hp = Math.round(c.stats.hp * t.hpBoost);
        if (t.tutorial) c.tutorial = true;
        return c;
      }),
      active: 0,
      aether: AETHER.start,
      trap: null,
      ultUsed: false,
      ...(t.ultBoost ? { ultBoost: t.ultBoost } : {}),
      art: t.art ?? null,
      artUsed: false,
      tailwind: 0,
      isAI: t.isAI,
      seenFoeSkills: [],
      lastAttackSkill: null,
      artThisTurn: null,
      trapDisabledTurn: -1,
      hazard: null,
      screens: { phys: 0, physTurns: 0, mag: 0, magTurns: 0 },
      wish: null,
      doom: null,
      healWish: false,
      baton: null,
      lastStatusSkill: null,
      aeLoans: [],
      vars: {},
      lasting: [],
    });
    return new Battle({
      turn: 0,
      sides: [mk(o.sides[0]), mk(o.sides[1])],
      field: null,
      kind: o.kind,
      seed: o.seed,
      rngState: o.seed >>> 0,
      winner: null,
      captured: false,
      maxTurns: o.maxTurns ?? 30,
      pendingReplace: [false, false],
    });
  }

  // ───────────────────────── Basic utilities ─────────────────────────

  /** Sides that have already acted this turn (used to decide who moved first / last) */
  private acted = new Set<SideId>();

  /** This side has already acted this turn (a skill hook decides "moved last" with b.hasActed(b.foe(id))) */
  hasActed(id: SideId): boolean {
    return this.acted.has(id);
  }

  /** Random numbers for battle (0 to 1): always use this one, so replays and tests stay consistent */
  rng(): number {
    let a = (this.s.rngState = (this.s.rngState + 0x6d2b79f5) >>> 0);
    a = Math.imul(a ^ (a >>> 15), a | 1);
    a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  }

  /** One side's state (aether, trap, side conditions, vars ...) */
  side(id: SideId): SideState {
    return this.s.sides[id];
  }

  /** The spirit a side currently has active */
  active(id: SideId): Combatant {
    const sd = this.s.sides[id];
    return sd.team[sd.active];
  }

  /** Which side the opponent is */
  foe(id: SideId): SideId {
    return id === 0 ? 1 : 0;
  }

  private emit(body: BattleEventBody): void {
    this.events.push({ ...body, view: this.view() } as BattleEvent);
  }

  private flush(): BattleEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  view(): BattleView {
    const cv = (c: Combatant): CombatantView => ({
      uid: c.uid,
      speciesId: c.species.id,
      name: c.name,
      level: c.level,
      stage: c.stage,
      elements: c.elements,
      hp: c.hp,
      maxHp: c.maxHp,
      shield: c.shield?.amount ?? 0,
      charges: c.charges,
      charging: !!c.charging,
      seeded: !!c.leechSeed,
      fainted: c.fainted,
      stages: { ...c.stages },
      status: (Object.keys(c.status) as StatusId[]).map((id) => ({
        id,
        turns: c.status[id]!.turns,
        stacks: c.status[id]!.stacks,
      })),
      corrupted: c.corrupted,
      marks: this.marksOf(c),
    });
    const sv = (sd: SideState) => ({
      name: sd.name,
      active: sd.active,
      aether: sd.aether,
      hasTrap: !!sd.trap,
      trapId: sd.trap?.skillId ?? null,
      trapRevealed: sd.trap?.revealed ? sd.trap.skillId : null,
      ultUsed: sd.ultUsed,
      artUsed: sd.artUsed,
      tailwind: sd.tailwind,
      team: sd.team.map(cv),
      conds: this.condsOf(sd),
    });
    return {
      turn: this.s.turn,
      field: this.s.field ? { ...this.s.field } : null,
      sides: [sv(this.s.sides[0]), sv(this.s.sides[1])],
      ...(this.s.reverseOrder ? { reverseOrder: this.s.reverseOrder } : {}),
    };
  }

  /** Mechanic marks on a spirit (for the UI) */
  private marksOf(c: Combatant): MarkView[] {
    const out: MarkView[] = [];
    const t = this.s.turn;
    if (c.decoy > 0) out.push({ id: 'decoy', n: Math.round((c.decoy / c.maxHp) * 100) });
    if (c.disabled && c.disabled.turns > t) out.push({ id: 'disabled', turns: Math.max(1, c.disabled.turns - t), note: getSkill(c.disabled.skill).name });
    if (c.bound) out.push({ id: 'bound', turns: c.bound.turns, n: c.bound.pct });
    if (c.perish > 0) out.push({ id: 'perish', n: c.perish });
    if (c.exposed > t) out.push({ id: 'exposed', turns: Math.max(1, c.exposed - t) });
    if (c.bondActive) out.push({ id: 'bond' });
    if (c.echo) out.push({ id: 'echo', note: getSkill(c.echo.skill).name });
    if (c.hidden) out.push({ id: 'hidden' });
    if (c.retaliate > 0) out.push({ id: 'retaliate' });
    if (c.snowball && c.snowball.n > 0) out.push({ id: 'snowball', n: c.snowball.n, note: getSkill(c.snowball.skill).name });
    // Marks for lasting effects and for a kit's signature mechanic (hooks are called only for the active spirit)
    const sid = this.s.sides.findIndex((sd) => sd.team[sd.active] === c);
    for (const l of c.lasting) out.push({ id: `fx:${l.key}`, turns: l.turns, n: l.n || undefined, note: this.lastingName(l) });
    if (sid >= 0 && !c.fainted) {
      const km = kitHooks(c)?.marks;
      if (km) out.push(...km(this, sid as SideId));
    }
    return out;
  }

  private lastingName(l: LastingState): string {
    return SKILL_FX[l.key]?.lasting?.name ?? findSkill(l.key)?.name ?? l.key;
  }

  /** Side conditions (for the UI) */
  private condsOf(sd: SideState): MarkView[] {
    const out: MarkView[] = [];
    if (sd.hazard) out.push({ id: 'hazard', n: sd.hazard.pct, note: sd.hazard.spd ? `速度 −${sd.hazard.spd}` : undefined });
    if (sd.screens.physTurns > 0) out.push({ id: 'screenPhys', n: sd.screens.phys, turns: sd.screens.physTurns });
    if (sd.screens.magTurns > 0) out.push({ id: 'screenMag', n: sd.screens.mag, turns: sd.screens.magTurns });
    if (sd.wish) out.push({ id: 'wish', n: sd.wish.pct, turns: sd.wish.turns });
    if (sd.doom) out.push({ id: 'doom', n: sd.doom.pct, turns: sd.doom.turns });
    if (sd.healWish) out.push({ id: 'healWish' });
    if (sd.aeLoans.length) out.push({ id: 'aeLoan', n: this.loanDebt(sd), turns: Math.max(...sd.aeLoans) });
    for (const l of sd.lasting) out.push({ id: `fx:${l.key}`, turns: l.turns, n: l.n || undefined, note: this.lastingName(l) });
    return out;
  }

  effStat(c: Combatant, key: StageStat, sideId: SideId): number {
    let v = c.stats[key] * statStageMultiplier(c.stages[key]);
    if (key === 'spd') {
      if (c.status.paralyze) v *= 0.5;
      if (this.side(sideId).tailwind > 0) v *= 1.5;
    }
    for (const h of traitHooks(c)) if (h.statMult) v *= h.statMult(this, sideId, key);
    return v;
  }

  /** Aether a skill actually costs (First Pact: the first skill after entering is free; hooks can change the cost) */
  costFor(id: SideId, sk: SkillDef): number {
    const c = this.active(id);
    if (sk.category !== 'ultimate' && c.usedSinceEnter === 0 && traitHooks(c).some((h) => h.freeFirstSkill)) return 0;
    const f = SKILL_FX[sk.id]?.cost;
    return f ? Math.max(0, f(this, id, skillCost(sk))) : skillCost(sk);
  }

  aliveBench(id: SideId): number[] {
    const sd = this.side(id);
    return sd.team.map((c, i) => (!c.fainted && i !== sd.active ? i : -1)).filter((i) => i >= 0);
  }

  // ───────────────────────── Availability ─────────────────────────

  canUse(id: SideId, skillId: string, extraAether = 0): UsableResult {
    const c = this.active(id);
    const sd = this.side(id);
    const sk = getSkill(skillId);
    if (c.fainted) return { ok: false, reason: '已倒下' };
    if (sk.category === 'trap') return { ok: false, reason: '伏技只能設置' };
    if (sk.category === 'ultimate') {
      if (c.ultimate !== skillId) return { ok: false, reason: '未解鎖' };
      if (sd.ultUsed) return { ok: false, reason: '本場已使用' };
    }
    const cost = this.costFor(id, sk);
    if (sd.aether + extraAether < cost) return { ok: false, reason: '靈能不足' };
    if (c.disabled && c.disabled.skill === skillId && c.disabled.turns >= this.s.turn + 1) return { ok: false, reason: '封印中' };
    if (c.status.silence && (sk.category === 'magic' || sk.category === 'status'))
      return { ok: false, reason: '沉默中' };
    if (c.status.taunt && sk.category === 'status') return { ok: false, reason: '挑釁中' };
    if (c.status.fear && isAttack(sk)) return { ok: false, reason: '恐懼中' };
    const custom = SKILL_FX[sk.id]?.canUse?.(this, id);
    if (custom) return { ok: false, reason: custom };
    for (const [l, h] of this.lastingOf(id)) {
      const r = h.canUse?.(this, id, sk, l);
      if (r) return { ok: false, reason: r };
    }
    const tags = this.tagsOf(sk);
    if (tags.decoy && (c.decoy > 0 || c.hp * 100 <= c.maxHp * tags.decoy)) return { ok: false, reason: c.decoy > 0 ? '已有替身' : '生命不足' };
    if (tags.healWish && this.aliveBench(id).length === 0) return { ok: false, reason: '沒有後備' };
    if (tags.bond && c.lastBondTurn === this.s.turn) return { ok: false, reason: '不能連續使用' };
    return { ok: true };
  }

  /** Whether the system action "guard" can be chosen: 1 aether, not on consecutive turns, not while taunted */
  canGuard(id: SideId, extraAether = 0): UsableResult {
    const c = this.active(id);
    if (c.fainted) return { ok: false, reason: '已倒下' };
    if (c.charging) return { ok: false, reason: '蓄力中' };
    if (c.lastGuardTurn === this.s.turn) return { ok: false, reason: '不能連續格擋' };
    if (c.status.taunt) return { ok: false, reason: '挑釁中' };
    if (this.side(id).aether + extraAether < GUARD_COST) return { ok: false, reason: '靈能不足' };
    return { ok: true };
  }

  canSwitch(id: SideId): UsableResult {
    const c = this.active(id);
    if (c.status.root) return { ok: false, reason: '束縛中' };
    if (c.bound) return { ok: false, reason: '纏繞中' };
    const foe = this.active(this.foe(id));
    if (!foe.fainted && !c.fainted && traitHooks(foe).some((h) => h.lockFoeSwitch)) return { ok: false, reason: foe.species.trait.name };
    if (c.charging) return { ok: false, reason: '蓄力中' };
    if (this.aliveBench(id).length === 0) return { ok: false, reason: '沒有後備' };
    return { ok: true };
  }

  canSetTrap(id: SideId, skillId: string, reservedAether: number): UsableResult {
    const c = this.active(id);
    const sk = getSkill(skillId);
    if (sk.category !== 'trap' || !c.skills.includes(skillId)) return { ok: false, reason: '不在技能欄' };
    if (c.status.taunt) return { ok: false, reason: '挑釁中' };
    if (this.side(id).aether < sk.cost + reservedAether) return { ok: false, reason: '靈能不足' };
    return { ok: true };
  }

  // ───────────────────────── Battle start and replacement ─────────────────────────

  start(): BattleEvent[] {
    this.emit({ k: 'turn', turn: 0 });
    this.emit({ k: 'switchIn', side: 0, idx: this.side(0).active });
    this.emit({ k: 'switchIn', side: 1, idx: this.side(1).active });
    this.enterEffects(this.bySpeed([0, 1]));
    return this.flush();
  }

  needsReplacement(id: SideId): boolean {
    return this.s.pendingReplace[id];
  }

  /** Replacement: choices[i] is the index that side switches in (null if no replacement is needed) */
  replace(choices: [number | null, number | null]): BattleEvent[] {
    const entered: SideId[] = [];
    for (const id of [0, 1] as SideId[]) {
      const idx = choices[id];
      if (!this.s.pendingReplace[id]) continue;
      const bench = this.aliveBench(id);
      const to = idx !== null && bench.includes(idx) ? idx : bench[0];
      if (to === undefined) continue;
      this.side(id).active = to;
      this.s.pendingReplace[id] = false;
      this.emit({ k: 'switchIn', side: id, idx: to });
      entered.push(id);
    }
    this.enterEffects(this.bySpeed(entered));
    this.checkWinner();
    // An entry hazard can make the replacement faint immediately, which needs another replacement
    for (const id of [0, 1] as SideId[]) this.s.pendingReplace[id] = this.s.winner === null && this.active(id).fainted && this.aliveBench(id).length > 0;
    return this.flush();
  }

  /** Sort by speed (the slower goes first while action order is reversed) */
  private bySpeed(ids: SideId[]): SideId[] {
    const dir = this.s.reverseOrder ? -1 : 1;
    return [...ids].sort(
      (a, b) => dir * (this.effStat(this.active(b), 'spd', b) - this.effStat(this.active(a), 'spd', a)),
    );
  }

  // ───────────────────────── Turn resolution ─────────────────────────

  resolveTurn(inputs: [TurnInput, TurnInput]): BattleEvent[] {
    if (this.s.winner !== null) return [];
    const st = this.s;
    st.turn++;
    this.acted.clear();
    for (const id of [0, 1] as SideId[]) {
      const c = this.active(id);
      c.hpAtTurnStart = c.hp;
    }
    this.emit({ k: 'turn', turn: st.turn });

    // Oathbearer art
    for (const id of this.bySpeed([0, 1])) {
      const sd = this.side(id);
      if (inputs[id].art && sd.art && !sd.artUsed) this.useArt(id, sd.art);
    }

    // Setting traps
    for (const id of [0, 1] as SideId[]) {
      const t = inputs[id].trap;
      if (!t) continue;
      const main = inputs[id].main;
      const mainCost = main.type === 'skill' ? skillCost(getSkill(main.skillId)) : main.type === 'guard' ? GUARD_COST : 0;
      if (!this.canSetTrap(id, t, this.active(id).charging ? 0 : mainCost).ok) continue;
      const sk = getSkill(t);
      this.side(id).aether -= sk.cost;
      this.side(id).trap = { skillId: t, setTurn: st.turn, revealed: false };
      this.emit({ k: 'trapSet', side: id, skillId: t });
      this.emit({ k: 'aether', side: id, value: this.side(id).aether, delta: -sk.cost });
      // Traps that respond to the opponent "setting a trap"
      const r = this.fireTrap(this.foe(id), { on: 'foeSetTrap', skillId: t });
      if (r?.negate && this.side(id).trap?.skillId === t) {
        this.side(id).trap = null;
        this.emit({ k: 'trapDestroyed', side: id, skillId: t });
      }
      r?.after?.();
    }

    // Action ordering
    type Q = { side: SideId; uid: string; input: TurnInput; prio: number; spd: number; tie: number; done: boolean };
    const queue: Q[] = ([0, 1] as SideId[]).map((id) => {
      const c = this.active(id);
      let input = inputs[id];
      if (c.charging) input = { main: { type: 'skill', skillId: c.charging } };
      return {
        side: id,
        uid: c.uid,
        input,
        prio: this.priorityOf(id, input),
        spd: this.effStat(c, 'spd', id),
        tie: this.rng(),
        done: false,
      };
    });
    const dir = st.reverseOrder ? -1 : 1;
    queue.sort((a, b) => b.prio - a.prio || dir * (b.spd - a.spd) || a.tie - b.tie);
    for (const q of queue) this.active(q.side).actPriority = q.prio;

    for (const q of queue) {
      if (st.winner !== null) break;
      if (q.done) continue;
      q.done = true;
      this.acted.add(q.side);
      const m = q.input.main;
      if (m.type === 'switch') {
        if (!this.canSwitch(q.side).ok || !this.aliveBench(q.side).includes(m.to)) continue;
        // Traps that respond to a "switch" (they can make the switch fail)
        const r = this.fireTrap(this.foe(q.side), { on: 'foeLeave', to: m.to });
        if (r?.negate) this.emit({ k: 'fail', side: q.side, reason: '替換失敗' });
        r?.after?.();
        if (r?.negate || this.active(q.side).fainted || st.winner !== null) continue;
        // Pursuit: the opponent's skill hits before the switch-out
        const other = queue.find((x) => x.side !== q.side && !x.done);
        const pid = other && other.input.main.type === 'skill' ? other.input.main.skillId : null;
        const pm = pid ? SKILL_FX[pid]?.pursuit : undefined;
        if (other && pid && pm && !this.active(other.side).fainted && this.canUse(other.side, pid).ok) {
          other.done = true;
          this.acted.add(other.side);
          this.useSkill(other.side, pid, { powerMult: pm });
          if (this.active(q.side).fainted || st.winner !== null) continue;
        }
        if (this.canSwitch(q.side).ok && this.aliveBench(q.side).includes(m.to)) {
          this.doSwitch(q.side, m.to);
        }
      } else if (m.type === 'capture') {
        this.doCapture(q.side, m.stone);
      } else if (m.type === 'guard') {
        const actor = this.active(q.side);
        if (actor.fainted || actor.uid !== q.uid) continue;
        this.doGuard(q.side);
      } else {
        const actor = this.active(q.side);
        if (actor.fainted || actor.uid !== q.uid) continue;
        this.useSkill(q.side, m.skillId, { charged: !!actor.charging });
      }
    }

    if (st.winner === null) this.endPhase();
    // Refill aether at the end of the turn, so it can be seen and used when choosing the next turn
    if (st.winner === null) for (const id of [0, 1] as SideId[]) this.regenAether(id);
    return this.flush();
  }

  /** Repayment of the advance: −1 per loan, deducted at most until recovery reaches zero */
  private loanDebt(sd: SideState): number {
    return Math.min(AETHER.perTurn, sd.aeLoans.length);
  }

  /** End-of-turn aether recovery, minus the repayment of the Hourglass Advance */
  private regenAether(id: SideId): void {
    const sd = this.side(id);
    const debt = this.loanDebt(sd);
    sd.aeLoans = sd.aeLoans.map((n) => n - 1).filter((n) => n > 0);
    if (debt > 0) this.text(`償還預支的靈能：${sd.name} 本回合靈能回復 −${debt}`);
    this.gainAether(id, AETHER.perTurn - debt);
  }

  private priorityOf(id: SideId, input: TurnInput): number {
    const m = input.main;
    if (m.type !== 'skill' && m.type !== 'guard') return 6;
    const c = this.active(id);
    const sk = getSkill(m.type === 'guard' ? GUARD_ID : m.skillId);
    let p = sk.priority;
    if (this.s.field?.element === 'wind' && sk.element === 'wind') p += 1;
    if (c.nextPriorityBoost && isAttack(sk)) p += 1;
    if (this.side(id).artThisTurn === 'oath_gale') p += 1;
    for (const h of traitHooks(c)) if (h.priorityBonus) p += h.priorityBonus(this, id, sk);
    if (m.type === 'skill') p += SKILL_FX[sk.id]?.priority?.(this, id) ?? 0;
    for (const [l, h] of this.lastingOf(id)) if (h.priority) p += h.priority(this, id, sk, l);
    if (c.status.paralyze && p > 0) p = 0;
    return Math.min(5, p);
  }

  /** Aether ±n (0 to 10) */
  gainAether(id: SideId, n: number): void {
    const sd = this.side(id);
    const before = sd.aether;
    sd.aether = Math.max(0, Math.min(AETHER.max, sd.aether + n));
    if (sd.aether !== before) this.emit({ k: 'aether', side: id, value: sd.aether, delta: sd.aether - before });
  }

  private spend(id: SideId, n: number): boolean {
    const sd = this.side(id);
    if (sd.aether < n) return false;
    if (n > 0) {
      sd.aether -= n;
      this.emit({ k: 'aether', side: id, value: sd.aether, delta: -n });
    }
    return true;
  }

  // ───────────────────────── Oathbearer art ─────────────────────────

  private useArt(id: SideId, art: ArtId): void {
    const sd = this.side(id);
    sd.artUsed = true;
    sd.artThisTurn = art;
    this.emit({ k: 'art', side: id, art });
    const f = this.foe(id);
    switch (art) {
      case 'eye_insight': {
        const t = this.side(f).trap;
        if (t) {
          t.revealed = true;
          this.side(f).trapDisabledTurn = this.s.turn;
          this.emit({ k: 'reveal', side: f, skillId: t.skillId });
        }
        break;
      }
      case 'light_purify':
        this.cleanse(id);
        break;
      case 'aether_spring':
        this.gainAether(id, 3);
        break;
      default:
        break;
    }
  }

  // ───────────────────────── Traps ─────────────────────────

  /** The trap is ready to fire (from the turn after it was set; a quick trap, or the Eternal Night field, allows the same turn). Returns the trap id */
  trapReady(id: SideId): string | null {
    const sd = this.side(id);
    const t = sd.trap;
    if (!t || sd.trapDisabledTurn === this.s.turn) return null;
    const sk = getSkill(t.skillId);
    const quick = sk.trapSpeed === 'quick' || this.s.field?.element === 'dark';
    if (t.setTurn >= this.s.turn && !quick) return null;
    return t.skillId;
  }

  /**
   * When an event happens, checks whether owner's trap responds: the trap is ready, the hook's on matches the event, and when holds.
   * Returns the result after firing (null when it was countered); also null when it did not fire.
   */
  private fireTrap(owner: SideId, ev: TrapEvent): TrapResult | null {
    const id = this.trapReady(owner);
    if (!id) return null;
    const tr = SKILL_FX[id]?.trap;
    if (!tr || tr.on !== ev.on) return null;
    const spec = tr as { when?: (b: Battle, o: SideId, e: TrapEvent) => boolean; fire: (b: Battle, o: SideId, e: TrapEvent) => TrapResult | void };
    if (spec.when && !spec.when(this, owner, ev)) return null;
    if (!this.activateTrap(owner)) return null;
    return spec.fire(this, owner, ev) ?? {};
  }

  /** Fires a trap and handles the counter chain (the opponent's on: 'foeTrapFire' traps can respond). Returns whether the trap resolved successfully. */
  private activateTrap(owner: SideId, chainBase = 2): boolean {
    const sd = this.side(owner);
    const t = sd.trap!;
    sd.trap = null;
    this.emit({ k: 'trap', side: owner, skillId: t.skillId, chain: chainBase });
    const opp = this.foe(owner);
    const cid = this.trapReady(opp);
    const ctr = cid ? SKILL_FX[cid]?.trap : undefined;
    const ev: TrapEvent = { on: 'foeTrapFire', skillId: t.skillId };
    if (cid && ctr?.on === 'foeTrapFire' && (!ctr.when || ctr.when(this, opp, ev))) {
      this.side(opp).trap = null;
      this.emit({ k: 'trap', side: opp, skillId: cid, chain: chainBase + 1 });
      this.onTrapActivated(opp);
      const r = ctr.fire(this, opp, ev) ?? {};
      if (r.negate) this.emit({ k: 'negate', side: owner, skillId: t.skillId });
      r.after?.();
      if (r.negate) return false;
    }
    this.onTrapActivated(owner);
    return true;
  }

  private onTrapActivated(id: SideId): void {
    const c = this.active(id);
    if (c.fainted) return;
    if (legacyTrait(c) && c.species.id === 'sand_reaper') {
      this.emit({ k: 'trait', side: id, name: '伏沙' });
      this.changeStage(id, 'atk', 1);
      this.gainAether(id, 1);
    }
    for (const h of traitHooks(c)) h.onTrapActivated?.(this, id);
  }

  // ───────────────────────── Switching ─────────────────────────

  private doSwitch(id: SideId, to: number): void {
    const sd = this.side(id);
    const old = this.active(id);
    const leavingSpecies = old.fainted || !legacyTrait(old) ? null : old.species.id;
    if (!old.fainted) {
      for (const h of traitHooks(old)) h.onLeave?.(this, id, old);
      this.onLeave(old);
      this.emit({ k: 'switchOut', side: id, idx: sd.active });
    }
    sd.active = to;
    this.emit({ k: 'switchIn', side: id, idx: to });
    if (leavingSpecies === 'thalassene') {
      this.emit({ k: 'trait', side: id, name: '深海之歌' });
      this.giveShield(id, 20);
    }
    this.enterEffects([id]);
  }

  private onLeave(c: Combatant): void {
    c.stages = { atk: 0, mag: 0, def: 0, res: 0, spd: 0 };
    if (c.status.poison) {
      const stacks = Math.floor((c.status.poison.stacks ?? 1) / 2);
      if (stacks <= 0) delete c.status.poison;
      else c.status.poison.stacks = stacks;
    }
    c.leechSeed = null;
    c.charging = null;
    c.arcaneChain = 0;
    c.nextPriorityBoost = false;
    c.guarding = false;
    c.decoy = 0;
    c.disabled = null;
    c.bound = null;
    c.perish = 0;
    c.exposed = 0;
    c.bondActive = false;
    c.echo = null;
    c.snowball = null;
    c.hidden = false;
    c.retaliate = 0;
    c.lasting = [];
    for (const k of PER_ENTRY_VARS) delete c.vars[k];
    for (const k of Object.keys(c.vars)) if (k.startsWith('e:')) delete c.vars[k];
  }

  /** Side effects on entering: baton, Song of Life, entrust, entry hazard */
  private arrive(id: SideId): void {
    const sd = this.side(id);
    const c = this.active(id);
    c.enteredTurn = this.s.turn;
    c.usedSinceEnter = 0;
    c.hpAtTurnStart = c.hp;
    if (sd.healWish) {
      sd.healWish = false;
      this.emit({ k: 'text', text: '生命之歌迴響著……' });
      c.status = {};
      this.emit({ k: 'cleanse', target: id, team: false });
      const amt = c.maxHp - c.hp;
      if (amt > 0) {
        c.hp = c.maxHp;
        this.emit({ k: 'heal', target: id, amount: amt });
      }
    }
    if (sd.baton) {
      const bt = sd.baton;
      sd.baton = null;
      this.emit({ k: 'text', text: '接力！' });
      for (const k of Object.keys(bt.stages) as StageStat[]) {
        const delta = bt.stages[k] - c.stages[k];
        if (delta !== 0) {
          c.stages[k] = bt.stages[k];
          this.emit({ k: 'stat', target: id, stat: k, delta });
        }
      }
      if (bt.shield) {
        c.shield = { ...bt.shield };
        this.emit({ k: 'shield', target: id, amount: c.shield.amount });
      }
    }
    if (sd.hazard && this.s.turn > 0) {
      const hz = sd.hazard;
      if (hz.pct > 0) this.trueDamage(id, hz.pct, 'hazard');
      if (!c.fainted && hz.spd > 0) this.changeStage(id, 'spd', -hz.spd, true);
    }
  }

  private enterEffects(ids: SideId[]): void {
    for (const id of ids) this.arrive(id);
    for (const id of ids) {
      const c = this.active(id);
      if (c.fainted) continue;
      const f = this.foe(id);
      const sid = c.species.id;
      const legacy = legacyTrait(c);
      const fieldEl = legacy ? SSR_FIELD[sid] : undefined;
      if (fieldEl) {
        this.emit({ k: 'trait', side: id, name: c.species.trait.name });
        this.setField(fieldEl, 3);
        if (sid === 'voltarion') this.addCharges(id, 2);
        if (sid === 'luminael') this.revealTrap(f);
      }
      if (legacy && sid === 'skyreign') {
        this.emit({ k: 'trait', side: id, name: '乘風' });
        this.changeStage(id, 'spd', 1);
      }
      if (legacy && sid === 'chime_sprite' && this.side(f).trap) {
        this.emit({ k: 'trait', side: id, name: '清音' });
        this.revealTrap(f);
      }
      // The opponent's entry traps
      if (this.s.turn > 0) this.fireTrap(f, { on: 'foeEnter' })?.after?.();
      // The kit of the opponent's active spirit: when the opponent enters (e.g. Storm Ring)
      if (this.s.turn > 0 && !this.active(id).fainted && !this.active(f).fainted) kitHooks(this.active(f))?.onFoeEnter?.(this, f);
      if (!this.active(id).fainted) for (const h of traitHooks(this.active(id))) h.onEnter?.(this, id);
    }
  }

  /** Reveals owner's trap (it stays in effect) */
  revealTrap(owner: SideId): void {
    const t = this.side(owner).trap;
    if (t && !t.revealed) {
      t.revealed = true;
      this.emit({ k: 'reveal', side: owner, skillId: t.skillId });
    }
  }

  /** Switches in the bench spirit with the highest HP ratio (switch after attacking, "Wind Escape"); returns false when there is no bench or it is rooted */
  autoSwitch(id: SideId): boolean {
    const bench = this.aliveBench(id);
    if (bench.length === 0 || this.active(id).status.root) return false;
    const sd = this.side(id);
    bench.sort((a, b) => sd.team[b].hp / sd.team[b].maxHp - sd.team[a].hp / sd.team[a].maxHp);
    this.doSwitch(id, bench[0]);
    return true;
  }

  // ───────────────────────── Capture ─────────────────────────

  /** The current success rate of throwing a pact stone (shown in the UI, and also used for the actual roll) */
  captureOdds(id: SideId, stone: 'basic' | 'advanced' | 'master'): number {
    const d = this.active(this.foe(id));
    if (d.tutorial) return 1;
    // A corrupted spirit cannot be pacted: knock it out first to purify it
    if (d.corrupted) return 0;
    const hasControl = CONTROL.some((s) => d.status[s]);
    const hasOther = Object.keys(d.status).length > 0;
    return captureChance(d.species.rarity, d.hp / d.maxHp, stone, hasControl ? 'control' : hasOther ? 'other' : 'none');
  }

  private doCapture(id: SideId, stone: 'basic' | 'advanced' | 'master'): void {
    const p = this.captureOdds(id, stone);
    const roll = this.rng();
    const success = roll < p;
    const shakes = success ? 3 : Math.min(2, Math.floor((p / Math.max(roll, 0.001)) * 3));
    this.emit({ k: 'capture', success, shakes, stone });
    if (success) {
      this.s.captured = true;
      this.s.winner = id;
      this.emit({ k: 'end', winner: id });
    }
  }

  // ───────────────────────── Skills ─────────────────────────

  private useSkill(id: SideId, skillId: string, opts: { charged?: boolean; powerMult?: number } = {}): void {
    const c = this.active(id);
    const sd = this.side(id);
    const f = this.foe(id);
    let sk = getSkill(skillId);
    if (sk.category === 'trap') return;
    // Shared fate lasts only until its own next action
    c.bondActive = false;
    if (this.controlBlocks(id, sk)) return;

    // Switch to another skill (`transcribe`, mimic)
    let copied = false;
    let powerMult = opts.powerMult ?? 1;
    const redirect = SKILL_FX[sk.id]?.redirect;
    if (redirect) {
      const r = redirect(this, id);
      if (typeof r === 'string') {
        this.emit({ k: 'fail', side: id, reason: r });
        return;
      }
      if (!this.spend(id, r.cost)) {
        this.emit({ k: 'fail', side: id, reason: '靈能不足' });
        return;
      }
      this.emit({ k: 'use', side: id, skillId: sk.id, ult: false });
      if (r.text) this.emit({ k: 'text', text: r.text });
      sk = getSkill(r.skill);
      copied = true;
      powerMult *= r.powerMult ?? 1;
    } else if (!opts.charged) {
      if (sk.category === 'ultimate') {
        if (sd.ultUsed || !this.spend(id, ULT_COST)) {
          this.emit({ k: 'fail', side: id, reason: '無法發動奧義' });
          return;
        }
        sd.ultUsed = true;
        powerMult *= sd.ultBoost ?? 1;
      } else {
        const cost = this.costFor(id, sk);
        if (cost < sk.cost) this.emit({ k: 'trait', side: id, name: c.species.trait.name });
        if (!this.spend(id, cost)) {
          this.emit({ k: 'fail', side: id, reason: '靈能不足' });
          return;
        }
      }
    }
    c.lastSkill = skillId;
    c.usedSinceEnter++;

    // Charging (burrow: attacks cannot hit while charging)
    const tags = this.tagsOf(sk);
    if (tags.charge && !opts.charged) {
      c.charging = sk.id;
      this.emit({ k: 'charge', side: id, skillId: sk.id });
      if (tags.dig) {
        c.hidden = true;
        this.emit({ k: 'text', text: `${c.name} 潛入了地底！` });
      }
      // Traps that respond to "charging" (they can interrupt it)
      const r = this.fireTrap(f, { on: 'foeCharge', skillId: sk.id });
      if (r?.negate && c.charging) {
        c.charging = null;
        c.hidden = false;
        this.emit({ k: 'text', text: '蓄力被打斷了！' });
      }
      r?.after?.();
      return;
    }
    if (opts.charged) {
      c.charging = null;
      c.hidden = false;
    }

    if (!copied) this.emit({ k: 'use', side: id, skillId: sk.id, ult: sk.category === 'ultimate' });
    else this.emit({ k: 'use', side: id, skillId: sk.id, ult: false, copied: true });

    const seenBefore = this.side(f).seenFoeSkills.includes(sk.id);
    if (!seenBefore) this.side(f).seenFoeSkills.push(sk.id);

    if (isAttack(sk)) {
      this.doAttack(id, sk, powerMult, seenBefore);
      sd.lastAttackSkill = sk.category === 'ultimate' ? sd.lastAttackSkill : sk.id;
      c.usedAttackThisTurn = true;
      c.vars.struck = 1;
      // Self-KO: the user faints after attacking
      if (tags.selfKO && !c.fainted && this.s.winner === null && this.active(id) === c) this.damage(id, c.hp, 'selfko');
    } else {
      this.doStatusSkill(id, sk);
      sd.lastStatusSkill = sk.id;
      const foeC = this.active(f);
      if (!foeC.fainted && this.s.winner === null) for (const h of traitHooks(foeC)) h.onFoeStatusSkill?.(this, f, sk);
    }
    const after = SKILL_FX[sk.id]?.afterUse;
    if (after && this.active(id) === c && !c.fainted && this.s.winner === null) after(this, id, sk);
    this.benchEvent(f, (h, i) => h.onFoeSkill?.(this, f, i, sk));
    this.afterSkill(id, sk);
  }

  /** Bench effects: calls the kit hooks' bench for each bench spirit of side (not sent out, not fainted) */
  private benchEvent(side: SideId, fn: (h: BenchHooks, idx: number) => void): void {
    if (this.s.winner !== null) return;
    const sd = this.side(side);
    sd.team.forEach((m, i) => {
      if (i === sd.active || m.fainted || this.s.winner !== null) return;
      const h = kitHooks(m)?.bench;
      if (h) fn(h, i);
    });
  }

  /**
   * Control statuses and seals: when the spirit cannot act, sends an event and returns true.
   * system = a system action (guard): not affected by silence or seal.
   */
  private controlBlocks(id: SideId, sk: SkillDef, system = false): boolean {
    const c = this.active(id);
    if (c.status.freeze) {
      delete c.status.freeze;
      c.toughness = 2;
      this.emit({ k: 'fail', side: id, reason: '冰凍中，無法行動' });
      this.emit({ k: 'statusEnd', target: id, status: 'freeze' });
      return true;
    }
    if (c.status.sleep) {
      const s = c.status.sleep;
      s.turns--;
      this.emit({ k: 'fail', side: id, reason: '睡著了……' });
      if (s.turns <= 0) {
        delete c.status.sleep;
        c.toughness = 2;
        this.emit({ k: 'statusEnd', target: id, status: 'sleep' });
      }
      return true;
    }
    if (c.status.fear) {
      delete c.status.fear;
      c.toughness = 2;
      this.emit({ k: 'statusEnd', target: id, status: 'fear' });
      if (isAttack(sk)) {
        this.emit({ k: 'fail', side: id, reason: '因恐懼而不敢攻擊' });
        return true;
      }
    }
    if (!system && c.status.silence && (sk.category === 'magic' || sk.category === 'status')) {
      this.emit({ k: 'fail', side: id, reason: '沉默中，無法詠唱' });
      return true;
    }
    if (c.status.taunt && sk.category === 'status') {
      this.emit({ k: 'fail', side: id, reason: '被挑釁，只想攻擊' });
      return true;
    }
    if (!system && c.disabled && c.disabled.skill === sk.id && c.disabled.turns >= this.s.turn) {
      this.emit({ k: 'fail', side: id, reason: `「${sk.name}」被封印了` });
      return true;
    }
    // A lasting effect voids this action (e.g. stun)
    for (const [l, h] of this.lastingOf(id)) {
      const r = h.blockAction?.(this, id, sk, l);
      if (r) {
        this.emit({ k: 'fail', side: id, reason: r });
        return true;
      }
    }
    return false;
  }

  /** System action "guard": immune to attacks this turn (traps can still fire); always fails on consecutive turns */
  private doGuard(id: SideId): void {
    const c = this.active(id);
    const g = getSkill(GUARD_ID);
    c.bondActive = false;
    if (this.controlBlocks(id, g, true)) return;
    if (!this.spend(id, GUARD_COST)) {
      this.emit({ k: 'fail', side: id, reason: '靈能不足' });
      return;
    }
    this.emit({ k: 'use', side: id, skillId: GUARD_ID, ult: false });
    if (c.lastGuardTurn === this.s.turn - 1) {
      this.emit({ k: 'fail', side: id, reason: '連續格擋失敗' });
    } else {
      c.guarding = true;
    }
    c.lastGuardTurn = this.s.turn;
    this.afterSkill(id, g);
  }

  private afterSkill(id: SideId, sk: SkillDef): void {
    const c = this.active(id);
    if (c.fainted) return;
    // Tidal Chant
    const magic = sk.category === 'magic' || (sk.category === 'ultimate' && this.attackCategory(c, sk) === 'magic');
    c.arcaneChain = magic ? Math.min(3, c.arcaneChain + 1) : 0;
    if (isAttack(sk)) c.nextPriorityBoost = false;
    if (c.status.bleed) this.trueDamage(id, 5, 'bleed');
  }

  attackCategory(c: Combatant, sk: SkillDef, foeSide?: SideId): 'physical' | 'magic' {
    // Refraction: computed with the lower of the opponent's DEF and RES
    if (this.tagsOf(sk).bestDef && foeSide !== undefined) {
      const d = this.active(foeSide);
      return this.effStat(d, 'def', foeSide) <= this.effStat(d, 'res', foeSide) ? 'physical' : 'magic';
    }
    if (sk.category === 'physical' || sk.category === 'magic') return sk.category;
    const dt = sk.damageType ?? 'auto';
    if (dt === 'physical' || dt === 'magic') return dt;
    return c.stats.atk >= c.stats.mag ? 'physical' : 'magic';
  }

  private fieldMult(el: Element): number {
    const f = this.s.field?.element;
    if (!f) return 1;
    if (el === f) return 1.3;
    if (f === 'water' && el === 'fire') return 0.7;
    if (f === 'fire' && el === 'water') return 0.7;
    return 1;
  }

  /** Power modifiers from tags (HP, speed, chain) plus the skill hook's conditional power */
  private condPower(id: SideId, sk: SkillDef, base: number, ctx: HitCtx): number {
    const c = this.active(id);
    const f = this.foe(id);
    const d = this.active(f);
    let p = base;
    const t = this.tagsOf(sk);
    const hpR = c.hp / c.maxHp;
    if (t.hpHigh) p *= Math.max(0.25, hpR);
    if (t.hpLow) p *= 1 + 1.5 * (1 - hpR);
    if (t.spdPower) p *= Math.max(0.6, Math.min(2, this.effStat(c, 'spd', id) / Math.max(1, this.effStat(d, 'spd', f))));
    if (t.snowball && c.snowball?.skill === sk.id) p *= 1.5 ** c.snowball.n;
    const fp = SKILL_FX[sk.id]?.power;
    if (fp) p = fp(this, ctx, p);
    return p;
  }

  /** The hook context of an attack */
  private hitCtx(id: SideId, sk: SkillDef, o: { guardBroken?: boolean; followUp?: boolean; estimate?: boolean } = {}): HitCtx {
    const f = this.foe(id);
    return {
      attacker: id,
      defender: f,
      sk,
      cat: this.attackCategory(this.active(id), sk, f),
      guardBroken: !!o.guardBroken,
      followUp: !!o.followUp,
      estimate: !!o.estimate,
    };
  }

  /** Estimates damage (for the AI and skill cards): no dice rolls, no crits, no traps triggered */
  estimate(id: SideId, skillId: string): number {
    const sk = getSkill(skillId);
    if (!isAttack(sk)) return 0;
    const c = this.active(id);
    const f = this.foe(id);
    const d = this.active(f);
    const t = this.tagsOf(sk);
    const ctx = this.hitCtx(id, sk, { guardBroken: d.guarding, estimate: true });
    const cat = ctx.cat;
    let power = this.condPower(id, sk, sk.power, ctx);
    if (t.aetherPower) power += t.aetherPower * Math.max(0, this.side(id).aether - skillCost(sk));
    if (d.hidden && !(d.charging && SKILL_FX[d.charging]?.emergesFirst?.(this, f, sk))) return 0;
    const fx = SKILL_FX[sk.id];
    const baseHits = t.hits ?? 1;
    if (fx?.hits) power *= Math.max(0, fx.hits(this, ctx, baseHits)) / baseHits;
    const split = baseHits === 1 && sk.category !== 'ultimate' ? this.hitSplitOf(c) : undefined;
    if (split) power *= split.reduce((a, b) => a + b, 0);
    const acc = fx?.accuracy ? fx.accuracy(this, ctx, sk.accuracy) : sk.accuracy;
    return this.rawDamage(id, sk, cat, power, { roll: 1, crit: false, reduce: 0, seen: false, ctx }) * (Math.min(100, acc) / 100);
  }

  /** Type-effectiveness multiplier (including typeMult overrides from the attacker's trait / kit) */
  effOf(id: SideId, sk: SkillDef, cat: 'physical' | 'magic'): number {
    const c = this.active(id);
    const f = this.foe(id);
    let eff = typeMultiplier(sk.element, this.active(f).elements);
    const a: AttackCtx = { attacker: id, defender: f, sk, cat };
    for (const h of traitHooks(c)) if (h.typeMult) eff = h.typeMult(this, a, eff);
    return eff;
  }

  /** A trait's multi-hit attack (Three Heads) */
  private hitSplitOf(c: Combatant): number[] | undefined {
    for (const h of traitHooks(c)) if (h.hitSplit) return h.hitSplit;
    return undefined;
  }

  private rawDamage(
    id: SideId,
    sk: SkillDef,
    cat: 'physical' | 'magic',
    power: number,
    o: { roll: number; crit: boolean; reduce: number; seen: boolean; ctx?: HitCtx },
  ): number {
    const c = this.active(id);
    const f = this.foe(id);
    const d = this.active(f);
    const ctx = o.ctx ?? this.hitCtx(id, sk);
    const t = this.tagsOf(sk);
    const eff = this.effOf(id, sk, cat);
    let bonus = 0;
    const actx: AttackCtx = { attacker: id, defender: f, sk, cat };
    for (const h of traitHooks(c)) if (h.attackBonus) bonus += h.attackBonus(this, actx);
    for (const [l, h] of this.lastingOf(id)) if (h.attackBonus) bonus += h.attackBonus(this, ctx, l);
    const red: number[] = [];
    if (o.reduce) red.push(o.reduce);
    const scr = this.side(f).screens;
    if (cat === 'physical' && scr.physTurns > 0) red.push(scr.phys / 100);
    if (cat === 'magic' && scr.magTurns > 0) red.push(scr.mag / 100);
    if (this.side(f).artThisTurn === 'oath_guard') red.push(0.4);
    for (const [l, h] of this.lastingOf(f)) {
      const r = h.reduce?.(this, ctx, l) ?? 0;
      if (r > 0) red.push(r);
    }
    let field = this.fieldMult(sk.element);
    if (cat === 'physical' && c.status.burn) field *= 0.8;
    const pen = t.armorPen ?? 0;
    let attack = cat === 'physical' ? this.effStat(c, 'atk', id) : this.effStat(c, 'mag', id);
    if (t.useDef) attack = this.effStat(c, 'def', id);
    if (t.foeAtk) attack = this.effStat(d, 'atk', f);
    return computeDamage({
      attack,
      defense: cat === 'physical' ? this.effStat(d, 'def', f) : this.effStat(d, 'res', f),
      power,
      attackerLevel: c.level,
      typeMult: eff,
      stab: c.elements.includes(sk.element),
      crit: o.crit,
      damageBonus: bonus,
      damageReduction: red,
      fieldMult: field,
      armorPen: Math.min(0.8, pen),
      roll: o.roll,
    });
  }

  private doAttack(id: SideId, sk: SkillDef, powerMult: number, seen: boolean, echo = false): void {
    const c = this.active(id);
    const f = this.foe(id);
    const d = this.active(f);
    const ult = sk.category === 'ultimate';
    const t = this.tagsOf(sk);
    const fx = SKILL_FX[sk.id];
    if (c.snowball && c.snowball.skill !== sk.id) c.snowball = null;
    if (d.fainted) {
      this.emit({ k: 'fail', side: id, reason: '沒有目標' });
      return;
    }
    // Eye of the Gale: priority attacks have no effect
    if (!echo && c.actPriority > 0 && traitHooks(d).some((h) => h.blockPriority)) {
      this.emit({ k: 'trait', side: f, name: d.species.trait.name });
      this.emit({ k: 'fail', side: id, reason: `被${d.species.trait.name}擋下了` });
      c.snowball = null;
      return;
    }
    // A burrowed target cannot be hit
    if (d.hidden) {
      this.emit({ k: 'miss', side: id });
      c.snowball = null;
      return;
    }
    const ignoreGuard = !!t.ignoreGuard || this.side(id).artThisTurn === 'oath_break' || !!fx?.pierceGuard?.(this, id);
    const cat = this.attackCategory(c, sk, f);
    const actx: AttackCtx = { attacker: id, defender: f, sk, cat };
    const guardBroken = d.guarding && ignoreGuard;
    const ctx: HitCtx = { ...actx, guardBroken, followUp: echo, estimate: false };
    let acc = fx?.accuracy ? fx.accuracy(this, ctx, sk.accuracy) : sk.accuracy;
    for (const h of traitHooks(d)) if (h.accuracyMult) acc *= h.accuracyMult(this, actx);
    if (acc < 100 && this.rng() * 100 >= acc) {
      this.emit({ k: 'miss', side: id });
      c.snowball = null;
      return;
    }
    if (d.guarding && !ignoreGuard) {
      this.emit({ k: 'guarded', side: f });
      for (const h of traitHooks(d)) h.onGuarded?.(this, f);
      c.snowball = null;
      return;
    }
    if (guardBroken) this.emit({ k: 'guarded', side: f, broke: true });
    // Immunity from lasting effects (e.g. immune to attacks of some element for N turns)
    for (const [l, lh] of this.lastingOf(f)) {
      if (lh.immune?.(this, ctx, l)) {
        this.emit({ k: 'resist', target: f, reason: `${this.lastingName(l)}：攻擊無效` });
        this.emit({ k: 'negate', side: id, skillId: sk.id });
        c.snowball = null;
        return;
      }
    }
    const eff = this.effOf(id, sk, actx.cat);

    // Trait absorption (Ignite, Lightning Rod)
    for (const h of traitHooks(d)) if (h.absorb?.(this, actx)) return;

    // The defender's hit-triggered traps (on: 'foeAttack')
    let reduce = 0;
    let reflect = 0;
    let escape = false;
    const after: (() => void)[] = [];
    const tr = this.fireTrap(f, { on: 'foeAttack', ctx: actx, eff });
    if (tr) {
      if (tr.negate) {
        this.emit({ k: 'negate', side: id, skillId: sk.id });
        c.snowball = null;
        if (tr.after && !c.fainted) tr.after();
        return;
      }
      reduce = tr.reduce ?? 0;
      reflect = tr.reflect ?? 0;
      escape = !!tr.escape;
      if (tr.after) after.push(tr.after);
    }

    let power = this.condPower(id, sk, sk.power, ctx) * powerMult;
    // Fate: random power
    if (t.gamble && !echo) {
      const rolls = [0.5, 0.75, 1, 1.25, 1.5, 2];
      const m = rolls[Math.floor(this.rng() * rolls.length)];
      power *= m;
      this.emit({ k: 'text', text: `命運之骰：威力 ×${m}` });
    }
    // Pour: spends the remaining aether to raise power
    if (t.aetherPower && !echo) {
      const sd = this.side(id);
      const n = sd.aether;
      if (n > 0) {
        power += t.aetherPower * n;
        sd.aether = 0;
        this.emit({ k: 'aether', side: id, value: 0, delta: -n });
      }
    }
    const baseHits = t.hits ?? 1;
    const split = baseHits === 1 && !ult && !fx?.hits ? this.hitSplitOf(c) : undefined;
    const count = fx?.hits ? Math.max(1, Math.round(fx.hits(this, ctx, baseHits))) : baseHits;
    const parts = split ?? Array.from({ length: count }, () => 1 / baseHits);
    const hits = parts.length;
    const exposed = d.exposed >= this.s.turn;
    const critImmune = traitHooks(d).some((h) => h.critImmune);
    let dealt = 0;
    let landed = 0;
    let ko = false;
    let decoyBlocked = false;
    for (let h = 0; h < hits; h++) {
      if (d.fainted || d.hp <= 0) break;
      landed++;
      let critChance = CRIT_RATE + (t.critRate ?? 0);
      for (const hk of traitHooks(c)) if (hk.critBonus) critChance += hk.critBonus(this, actx);
      if (fx?.critBonus) critChance += fx.critBonus(this, ctx);
      for (const [l, lh] of this.lastingOf(id)) if (lh.critBonus) critChance += lh.critBonus(this, ctx, l);
      if (cat === 'physical' && legacyTrait(c) && c.species.id === 'icecrown' && d.status.freeze) critChance = 1;
      if (exposed) critChance = 1;
      let crit = critChance >= 0.95 || this.rng() < critChance;
      if (critImmune) crit = false;
      let dmg = this.rawDamage(id, sk, cat, power * parts[h], {
        roll: 0.95 + this.rng() * 0.1,
        crit,
        reduce,
        seen,
        ctx,
      });
      // Substitute: the substitute takes the whole hit, with no overflow
      if (d.decoy > 0) {
        const absorbed = Math.min(d.decoy, dmg);
        d.decoy -= absorbed;
        decoyBlocked = true;
        dealt += absorbed;
        this.emit({ k: 'hit', side: id, target: f, skillId: sk.id, dmg: 0, shieldDmg: absorbed, crit, eff, ko: false, hitIndex: h + 1, hits, ratio: absorbed / d.maxHp, ult, tier: hitTier({ damageRatio: absorbed / d.maxHp, crit, ko: false, ultimate: ult }) });
        if (d.decoy <= 0) {
          d.decoy = 0;
          this.emit({ k: 'text', text: '替身被打破了！' });
        }
        continue;
      }
      for (const hk of traitHooks(d)) if (hk.incoming) dmg = hk.incoming(this, actx, dmg);
      let shieldDmg = 0;
      if (d.shield && !ignoreGuard) {
        shieldDmg = Math.min(d.shield.amount, dmg);
        d.shield.amount -= shieldDmg;
        dmg -= shieldDmg;
        if (d.shield.amount <= 0) {
          d.shield = null;
          this.emit({ k: 'shieldBreak', target: f });
        }
      }
      if (dmg >= d.hp && d.hp > 1) {
        // Lethal damage: a trap that keeps 1 HP (on: 'lethal') or Firm Stone
        const lr = this.fireTrap(f, { on: 'lethal', ctx: actx, dmg });
        if (lr?.survive) {
          dmg = d.hp - 1;
        } else if (legacyTrait(d) && d.species.id === 'monolith' && d.hp === d.maxHp) {
          this.emit({ k: 'trait', side: f, name: '堅石' });
          dmg = d.hp - 1;
        }
        lr?.after?.();
      }
      if (d.tutorial && dmg >= d.hp) dmg = Math.max(0, d.hp - 1);
      const prevHp = d.hp;
      d.hp = Math.max(0, d.hp - dmg);
      dealt += dmg + shieldDmg;
      ko = d.hp <= 0;
      const ratio = (dmg + shieldDmg) / d.maxHp;
      this.emit({
        k: 'hit',
        side: id,
        target: f,
        skillId: sk.id,
        dmg,
        shieldDmg,
        crit,
        eff,
        ko,
        hitIndex: h + 1,
        hits,
        ratio,
        ult,
        tier: hitTier({ damageRatio: ratio, crit, ko, ultimate: ult }),
      });
      if (d.hp < prevHp) this.hpTriggers(f, prevHp);
      ko = d.hp <= 0;
      if (cat === 'physical') d.hitByPhysicalThisTurn = true;
      if (d.status.freeze && sk.element === 'fire' && !ko) {
        delete d.status.freeze;
        this.emit({ k: 'statusEnd', target: f, status: 'freeze' });
      }
      if (d.status.sleep && dmg > 0 && !ko && !fx?.keepSleep?.(this, ctx)) {
        delete d.status.sleep;
        d.toughness = 2;
        this.emit({ k: 'statusEnd', target: f, status: 'sleep' });
      }
      fx?.onHit?.(this, ctx, { index: h + 1, hits, dmg: dmg + shieldDmg, crit, ko });
      if (ko) break;
    }
    if (exposed && dealt > 0) d.exposed = 0;

    // Skill hook: costs of conditional skills, custom effects after the attack
    fx?.afterAttack?.(this, ctx, { dealt, ko, hits: landed, decoyBlocked } satisfies AttackResult);

    // Reflect
    if (reflect > 0 && !c.fainted && dealt > 0) {
      const orig = dealt / (1 - reduce);
      this.damage(id, Math.floor(orig * reflect), 'reflect');
    }
    // Counter stance
    if (d.retaliate > 0 && dealt > 0 && !c.fainted && d.hp > 0) {
      this.emit({ k: 'text', text: '反擊架勢！' });
      this.damage(id, Math.max(1, Math.floor(dealt * d.retaliate)), 'retaliate');
    }

    // The defender's on-hit traits
    if (cat === 'physical' && !c.fainted && dealt > 0 && !decoyBlocked && legacyTrait(d)) {
      if (d.species.id === 'dreamcap' && this.rng() < 0.3) {
        this.emit({ k: 'trait', side: f, name: '孢子外殼' });
        this.applyStatus(id, 'poison', 1);
      }
    }
    if (dealt > 0 && !decoyBlocked && !c.fainted) {
      for (const hk of traitHooks(d)) hk.onHitTaken?.(this, actx, dealt);
      for (const [l, lh] of this.lastingOf(f)) lh.onHitTaken?.(this, ctx, dealt, l);
    }
    if (dealt > 0 && !decoyBlocked) this.benchEvent(f, (h, i) => h.onAllyHit?.(this, f, i, actx, dealt));
    if (dealt > 0 && !decoyBlocked && !c.fainted) for (const [l, lh] of this.lastingOf(id)) lh.onDealt?.(this, ctx, dealt, l);

    // Drain and recoil
    if (!c.fainted && dealt > 0) {
      const drain = t.drain ?? 0;
      if (drain > 0) this.healAmount(id, Math.floor(dealt * drain));
      if (t.recoil) this.damage(id, Math.floor(dealt * t.recoil), 'recoil');
    }

    // Chain: counts consecutive uses after a hit
    if (t.snowball && dealt > 0) c.snowball = c.snowball?.skill === sk.id ? { skill: sk.id, n: Math.min(2, c.snowball.n + 1) } : { skill: sk.id, n: 1 };

    if (ko) {
      this.faint(f, id, true);
    }

    for (const fn of after) if (!this.active(id).fainted && this.s.winner === null) fn();

    if (this.s.winner !== null) return;
    const target = this.active(f);
    if (!target.fainted && !decoyBlocked) {
      this.applyTargetEffects(id, sk);
      // Bind
      if (t.bind && !target.bound && !target.fainted) {
        target.bound = { turns: 3, pct: t.bind };
        this.emit({ k: 'text', text: `${target.name} 被纏住了！` });
      }
    }
    // Aether drain
    if (t.aeDrain && !echo) this.drainAether(id, t.aeDrain, !!t.aeSteal);
    if (!c.fainted) this.applySelfEffects(id, sk);
    // Echo: hits once more at the end of next turn
    if (t.echo && !echo && !c.fainted) c.echo = { skill: sk.id, turns: 2, mult: t.echo };

    if (t.forceSwitch && !decoyBlocked && this.s.winner === null && !this.active(f).fainted) this.forceSwitch(f);
    if (escape && !this.active(f).fainted && this.s.winner === null) this.autoSwitch(f);
    if (t.pivot && !this.active(id).fainted && this.s.winner === null) this.autoSwitch(id);
  }

  private doStatusSkill(id: SideId, sk: SkillDef): void {
    const f = this.foe(id);
    // Traps that respond to a status skill (on: 'foeStatus', e.g. "Shadow Ambush Array")
    const tr = this.fireTrap(f, { on: 'foeStatus', sk });
    if (tr?.negate) {
      this.emit({ k: 'negate', side: id, skillId: sk.id });
      tr.after?.();
      return;
    }
    tr?.after?.();
    if (this.active(id).fainted || this.s.winner !== null) return;
    const t = this.tagsOf(sk);
    const FOE_TAGS = ['disable', 'invertStages', 'stealStages', 'expose', 'transferStatus', 'painSplit', 'dispel', 'dispelTurns'];
    const targetsFoe = Object.keys(t).some((k) => k.startsWith('status.') || k.startsWith('foe.') || FOE_TAGS.includes(k));
    if (targetsFoe && sk.accuracy < 100 && this.rng() * 100 >= sk.accuracy) {
      this.emit({ k: 'miss', side: id });
      this.applySelfEffects(id, sk);
      return;
    }
    const d = this.active(f);
    if (!d.fainted) {
      if (d.decoy > 0 && targetsFoe && !t.painSplit) this.emit({ k: 'resist', target: f, reason: '替身擋下了效果' });
      else this.applyTargetEffects(id, sk);
    }
    this.applySideEffects(id, sk);
    this.applySelfEffects(id, sk);
    // The skill hook's custom effect
    const fx = SKILL_FX[sk.id]?.effect;
    if (fx && !this.active(id).fainted && this.s.winner === null) fx(this, id, sk);
    // Switching by a status skill (baton)
    if (t.pivot && !this.active(id).fainted && this.s.winner === null && !this.autoSwitch(id)) this.side(id).baton = null;
  }

  /** Effects on the opponent's side: entry hazard, doom (a substitute cannot block them) */
  private applySideEffects(id: SideId, sk: SkillDef): void {
    const f = this.foe(id);
    const t = this.tagsOf(sk);
    const fsd = this.side(f);
    if (t.hazard || t.hazardSpd) {
      const hz = fsd.hazard ?? { pct: 0, spd: 0 };
      fsd.hazard = { pct: Math.max(hz.pct, t.hazard ?? 0), spd: Math.max(hz.spd, t.hazardSpd ?? 0) };
      this.emit({ k: 'text', text: `${fsd.name} 的陣地佈下了「${sk.name}」！` });
    }
    if (t.doom) {
      if (fsd.doom) this.emit({ k: 'fail', side: id, reason: '預言已在進行中' });
      else {
        fsd.doom = { pct: t.doom, turns: 3 };
        this.emit({ k: 'text', text: `${this.side(id).name} 預言了 2 回合後的災厄……` });
      }
    }
  }

  /**
   * Tag effects on the opponent (status conditions, stat drops, dispel, seal ...). Called after a skill attack hits and for status skills;
   * a trap hook can also use b.applyTargetEffects(owner, trap) to apply the trap's tags to the opponent.
   */
  applyTargetEffects(id: SideId, sk: SkillDef): void {
    const f = this.foe(id);
    const d = this.active(f);
    if (d.fainted) return;
    const t = this.tagsOf(sk);
    for (const [key, v] of Object.entries(t)) {
      if (!key.startsWith('status.')) continue;
      const st = key.slice(7) as StatusId;
      if (st === 'poison') {
        if (v >= 1) this.applyStatus(f, 'poison', v);
        else if (this.rng() < v) this.applyStatus(f, 'poison', 1);
        continue;
      }
      let chance = v;
      if (st === 'paralyze' && sk.element === 'thunder' && this.s.field?.element === 'thunder') chance *= 2;
      if (chance >= 1 || this.rng() < chance) this.applyStatus(f, st);
    }
    const fc = t.foeChance ?? 1;
    for (const [key, v] of Object.entries(t)) {
      if (!key.startsWith('foe.')) continue;
      if (fc >= 1 || this.rng() < fc) this.changeStage(f, key.slice(4) as StageStat, v, true);
    }
    if (t.dispel) this.dispel(f);
    if (t.dispelTurns) this.clearLasting(f, 'own');
    if (t.disable) this.disableSkill(f, t.disable);
    if (t.invertStages) this.invertStages(f);
    if (t.stealStages) this.stealStages(id);
    if (t.expose) {
      d.exposed = this.s.turn + t.expose;
      this.emit({ k: 'text', text: `${d.name} 露出了破綻！` });
    }
    if (t.perish && !d.perish && !this.active(id).perish) {
      d.perish = t.perish;
      this.active(id).perish = t.perish;
      this.emit({ k: 'text', text: `終焉之歌響起：${t.perish} 回合後雙方都將倒下！` });
    }
    if (t.painSplit) this.painSplit(id);
    if (t.transferStatus) this.transferStatus(id);
    if (t.revealTrap) this.revealTrap(f);
    if (t.destroyTrap) this.destroyTrap(f);
  }

  /** Tag effects on oneself (stat boosts, healing, shields, field ...). Called after an attack hits and for status skills */
  applySelfEffects(id: SideId, sk: SkillDef): void {
    const c = this.active(id);
    if (c.fainted) return;
    const t = this.tagsOf(sk);
    for (const [key, v] of Object.entries(t)) {
      if (key.startsWith('self.')) this.changeStage(id, key.slice(5) as StageStat, v);
    }
    const sd = this.side(id);
    if (t.wish) {
      if (sd.wish) this.emit({ k: 'fail', side: id, reason: '已經許過願了' });
      else {
        sd.wish = { pct: t.wish, turns: 2 };
        this.emit({ k: 'text', text: '許下了願望，下回合結束時實現。' });
      }
    }
    if (t.decoy && c.decoy <= 0) {
      const amt = Math.floor((c.maxHp * t.decoy) / 100);
      if (c.hp > amt) {
        c.hp -= amt;
        this.emit({ k: 'damage', target: id, dmg: amt, reason: 'decoy', ko: false });
        c.decoy = amt;
        this.emit({ k: 'text', text: `${c.name} 製造了替身！` });
      }
    }
    if (t.copyStages) this.copyStages(id);
    if (t.bond) {
      c.bondActive = true;
      c.lastBondTurn = this.s.turn;
      this.emit({ k: 'text', text: `${c.name} 結下了同命咒！` });
    }
    if (t.retaliate) {
      c.retaliate = t.retaliate;
      this.emit({ k: 'text', text: `${c.name} 擺出了反擊架勢！` });
    }
    if (t.screenPhys) this.setScreen(id, 'phys', t.screenPhys, 5);
    if (t.screenMag) this.setScreen(id, 'mag', t.screenMag, 5);
    if (t.baton) sd.baton = { stages: { ...c.stages }, shield: c.shield ? { ...c.shield } : null };
    if (t.healWish) {
      sd.healWish = true;
      this.emit({ k: 'text', text: `${c.name} 唱起了生命之歌……` });
      this.damage(id, c.hp, 'sacrifice');
      return;
    }
    if (t.heal) this.heal(id, t.heal);
    if (t.teamHeal) {
      for (const [i, m] of this.side(id).team.entries()) {
        if (m.fainted) continue;
        if (i === this.side(id).active) this.heal(id, t.teamHeal);
        else m.hp = Math.min(m.maxHp, m.hp + Math.floor((m.maxHp * t.teamHeal) / 100));
      }
    }
    if (t.shield) this.giveShield(id, t.shield);
    if (t.teamCleanse) this.cleanse(id, true);
    else if (t.cleanse) this.cleanse(id);
    if (t.charges && t.charges > 0) this.addCharges(id, t.charges);
    if (t.aeGain) this.gainAether(id, t.aeGain);
    if (t.aeLoan) this.side(id).aeLoans.push(t.aeLoan);
    if (t.field) this.setField(sk.element, 5);
  }

  // ───────────────────────── State operations ─────────────────────────

  /** Whether this status condition is certain to be blocked right now (type immunity, Sanctuary, freeze under Blazing Sun, toughness)? Sends no event; for the AI to judge */
  statusBlocked(target: SideId, st: StatusId): boolean {
    const c = this.active(target);
    if (c.fainted || c.elements.some((e) => IMMUNITY[e] === st)) return true;
    if (this.s.field?.element === 'light') return true;
    if (st === 'freeze' && this.s.field?.element === 'fire') return true;
    return CONTROL.includes(st) && (c.toughness > 0 || CONTROL.some((x) => c.status[x]));
  }

  /** Applies a status condition (type immunity, Sanctuary, toughness and lasting effects can all block it); for poison, stacks = number of stacks. Returns whether it succeeded */
  applyStatus(target: SideId, st: StatusId, stacks?: number, turnsOverride?: number): boolean {
    const c = this.active(target);
    if (c.fainted) return false;
    if (c.elements.some((e) => IMMUNITY[e] === st)) {
      this.emit({ k: 'resist', target, reason: `${STATUS_LABEL[st]}無效` });
      return false;
    }
    if (this.s.field?.element === 'light') {
      this.emit({ k: 'resist', target, reason: '聖域守護' });
      return false;
    }
    if (st === 'freeze' && this.s.field?.element === 'fire') {
      this.emit({ k: 'resist', target, reason: '烈陽下無法冰凍' });
      return false;
    }
    if (CONTROL.includes(st) && (c.toughness > 0 || CONTROL.some((x) => c.status[x]))) {
      this.emit({ k: 'resist', target, reason: '韌性' });
      return false;
    }
    for (const [l, h] of this.lastingOf(target)) {
      if (h.blockStatus?.(this, target, st, l)) {
        this.emit({ k: 'resist', target, reason: `${this.lastingName(l)}：${STATUS_LABEL[st]}無效` });
        return false;
      }
    }
    if (st === 'poison') {
      const cur = c.status.poison;
      const n = Math.min(5, (cur?.stacks ?? 0) + (stacks ?? 1));
      c.status.poison = { turns: STATUS_TURNS.poison, stacks: n };
      this.emit({ k: 'status', target, status: st, stacks: n });
      return true;
    }
    c.status[st] = { turns: turnsOverride ?? STATUS_TURNS[st] };
    this.emit({ k: 'status', target, status: st });
    return true;
  }

  /** Stat stage ±delta (−4 to +4). byFoe: a change caused by the opponent (the Order trait blocks drops); a rise triggers the opponent's foeBuff traps */
  changeStage(target: SideId, stat: StageStat, delta: number, byFoe = false): void {
    const c = this.active(target);
    if (c.fainted || delta === 0) return;
    if (delta < 0 && byFoe && traitHooks(c).some((h) => h.blockStatDrop)) {
      this.emit({ k: 'resist', target, reason: `【${c.species.trait.name}】能力不會被降低` });
      return;
    }
    if (delta > 0 && c.status.curse) {
      this.emit({ k: 'resist', target, reason: '詛咒中無法強化' });
      return;
    }
    const before = c.stages[stat];
    c.stages[stat] = Math.max(-4, Math.min(4, before + delta));
    const real = c.stages[stat] - before;
    if (real !== 0) this.emit({ k: 'stat', target, stat, delta: real });
    // Traps that respond to a "stat rise"
    if (real > 0) this.fireTrap(this.foe(target), { on: 'foeBuff', stat, delta: real })?.after?.();
  }

  /** Heals pct% of max HP (curse and heal-blocking lasting effects stop it) */
  heal(target: SideId, pct: number): void {
    const c = this.active(target);
    this.healAmount(target, Math.floor((c.maxHp * pct) / 100));
  }

  /** Heals a fixed amount of HP */
  healAmount(target: SideId, amount: number): void {
    const c = this.active(target);
    if (c.fainted || amount <= 0) return;
    // A lasting effect turns healing into HP loss (e.g. wither)
    for (const [l, h] of this.lastingOf(target)) {
      if (h.invertHeal?.(this, target, amount, l)) {
        this.emit({ k: 'text', text: `「${this.lastingName(l)}」：${c.name} 的回復變成了傷害！` });
        this.damage(target, amount, 'wither');
        return;
      }
    }
    if (c.status.curse) {
      this.emit({ k: 'resist', target, reason: '詛咒中無法回復' });
      return;
    }
    for (const [l, h] of this.lastingOf(target)) {
      if (h.blockHeal?.(this, target, l)) {
        this.emit({ k: 'resist', target, reason: `${this.lastingName(l)}：無法回復` });
        return;
      }
    }
    const real = Math.min(c.maxHp - c.hp, amount);
    if (real <= 0) return;
    c.hp += real;
    this.emit({ k: 'heal', target, amount: real });
    // Traps that respond to "healing"
    this.fireTrap(this.foe(target), { on: 'foeHeal', amount: real })?.after?.();
  }

  /** Shield (pct% of max HP, 3 turns; the larger value is kept) */
  giveShield(target: SideId, pct: number): void {
    const c = this.active(target);
    if (c.fainted) return;
    if (c.status.curse) {
      this.emit({ k: 'resist', target, reason: '詛咒中無法獲得護盾' });
      return;
    }
    const amount = Math.floor((c.maxHp * pct) / 100);
    if (!c.shield || c.shield.amount < amount) c.shield = { amount, turns: 3 };
    else c.shield.turns = 3;
    this.emit({ k: 'shield', target, amount: c.shield.amount });
  }

  /** Dispel (removes buffs): removes positive stat stages and shields. Turn-based effects use clearLasting */
  dispel(target: SideId): void {
    const c = this.active(target);
    let any = false;
    for (const k of Object.keys(c.stages) as StageStat[]) {
      if (c.stages[k] > 0) {
        c.stages[k] = 0;
        any = true;
      }
    }
    if (c.shield) {
      c.shield = null;
      any = true;
    }
    if (any) this.emit({ k: 'dispel', target });
  }

  /** Cleanse: removes status conditions, leech seed and bind (team = the whole team, and also clears our side's entry hazard) */
  cleanse(target: SideId, team = false): void {
    const sd = this.side(target);
    const list = team ? sd.team : [this.active(target)];
    for (const c of list) {
      if (c.fainted) continue;
      c.status = {};
      c.leechSeed = null;
      c.bound = null;
    }
    // A team-wide cleanse also clears our side's entry hazard
    if (team && sd.hazard) sd.hazard = null;
    this.emit({ k: 'cleanse', target, team });
  }

  /** Charge ±n (0 to 3 stacks) */
  addCharges(target: SideId, n: number): void {
    const c = this.active(target);
    if (c.fainted) return;
    const before = c.charges;
    c.charges = Math.max(0, Math.min(3, c.charges + n));
    if (c.charges !== before) this.emit({ k: 'charges', target, value: c.charges });
    // Charge past the 3-stack cap is handed to the kit (e.g. Overcharge)
    if (n > 0 && before + n > 3) kitHooks(c)?.chargeOverflow?.(this, target, before + n - 3);
  }

  /** Sets the field (extends it when the element is the same) */
  setField(el: Element, turns: number): void {
    const cur = this.s.field;
    if (cur && cur.element === el) cur.turns = Math.max(cur.turns, turns);
    else this.s.field = { element: el, turns };
    this.emit({ k: 'field', element: el, turns: this.s.field!.turns });
  }

  /** Fixed damage: subtracts HP directly (bypassing shields and damage reduction); faints at 0. reason is shown in the log and the animation */
  damage(target: SideId, amount: number, reason: string): void {
    const c = this.active(target);
    if (c.fainted || amount <= 0) return;
    const real = Math.min(c.tutorial ? c.hp - 1 : c.hp, amount);
    if (real <= 0) return;
    const prev = c.hp;
    c.hp -= real;
    this.emit({ k: 'damage', target, dmg: real, reason, ko: c.hp <= 0 });
    // Choosing to faint (self-destruct, Song of Life) does not trigger revival-type traits
    if (reason !== 'selfko' && reason !== 'sacrifice' && reason !== 'perish') this.hpTriggers(target, prev);
    if (c.hp <= 0) this.faint(target, this.foe(target));
  }

  /** Traits that react after HP decreases (threshold effects, revival). Called before the faint is decided */
  hpTriggers(target: SideId, prevHp: number): void {
    const c = this.active(target);
    for (const h of traitHooks(c)) h.hpTrigger?.(this, target, prevHp);
  }

  // ── Helpers for traits and the new mechanics ──

  traitEvent(side: SideId, name: string): void {
    this.emit({ k: 'trait', side, name });
  }

  text(text: string): void {
    this.emit({ k: 'text', text });
  }

  /** When HP has been changed directly, adds a heal event for the UI */
  healEvent(target: SideId, amount: number): void {
    if (amount > 0) this.emit({ k: 'heal', target, amount });
  }

  removeStatus(target: SideId, st: StatusId): void {
    const c = this.active(target);
    if (!c.status[st]) return;
    delete c.status[st];
    this.emit({ k: 'statusEnd', target, status: st });
  }

  /** Seals the opponent's last used skill for turns turns */
  disableSkill(target: SideId, turns: number): void {
    const d = this.active(target);
    const last = d.lastSkill;
    if (!last || getSkill(last).category === 'ultimate' || d.fainted) {
      this.emit({ k: 'fail', side: this.foe(target), reason: '沒有可封印的技能' });
      return;
    }
    d.disabled = { skill: last, turns: this.s.turn + turns };
    this.emit({ k: 'text', text: `${d.name} 的「${getSkill(last).name}」被封印了！` });
  }

  resetStages(target: SideId): void {
    const c = this.active(target);
    for (const k of Object.keys(c.stages) as StageStat[]) {
      if (c.stages[k] !== 0) {
        this.emit({ k: 'stat', target, stat: k, delta: -c.stages[k] });
        c.stages[k] = 0;
      }
    }
  }

  setScreen(id: SideId, kind: 'phys' | 'mag', pct: number, turns: number): void {
    const sc = this.side(id).screens;
    if (kind === 'phys') {
      sc.phys = Math.max(sc.physTurns > 0 ? sc.phys : 0, pct);
      sc.physTurns = Math.max(sc.physTurns, turns);
    } else {
      sc.mag = Math.max(sc.magTurns > 0 ? sc.mag : 0, pct);
      sc.magTurns = Math.max(sc.magTurns, turns);
    }
    this.emit({ k: 'text', text: `${this.side(id).name} 展開了「${kind === 'phys' ? '晶壁' : '光幕'}」！` });
  }

  /** Forced switch ("Blow Away", `whirl_in`): has no effect on a rooted or bound target, or with Coiled Roots. to: the bench spirit to switch in (random when omitted) */
  forceSwitch(target: SideId, to?: number): void {
    const d = this.active(target);
    if (d.fainted || this.aliveBench(target).length === 0) return;
    if (traitHooks(d).some((h) => h.forceSwitchImmune)) {
      this.emit({ k: 'trait', side: target, name: d.species.trait.name });
      this.emit({ k: 'resist', target, reason: '不會被強制替換' });
      return;
    }
    if (d.status.root || d.bound) return;
    const bench = this.aliveBench(target);
    this.doSwitch(target, to !== undefined && bench.includes(to) ? to : bench[Math.floor(this.rng() * bench.length)]);
  }

  /** Aether drain: the opponent loses n points, and with steal the user gains the same amount */
  drainAether(id: SideId, n: number, steal: boolean): void {
    const f = this.foe(id);
    const fsd = this.side(f);
    const got = Math.min(fsd.aether, n);
    if (got <= 0) return;
    fsd.aether -= got;
    this.emit({ k: 'aether', side: f, value: fsd.aether, delta: -got });
    if (steal) this.gainAether(id, got);
  }

  /** Trace: raises own stat stages to the opponent's positive stages */
  copyStages(id: SideId): void {
    const c = this.active(id);
    const d = this.active(this.foe(id));
    let any = false;
    for (const k of Object.keys(c.stages) as StageStat[]) {
      if (d.stages[k] > 0 && d.stages[k] > c.stages[k]) {
        this.changeStage(id, k, d.stages[k] - c.stages[k]);
        any = true;
      }
    }
    if (!any) this.emit({ k: 'fail', side: id, reason: '對手沒有可臨摹的強化' });
  }

  /** Steal: takes all of the opponent's positive stat stages */
  stealStages(id: SideId): void {
    const f = this.foe(id);
    const d = this.active(f);
    let any = false;
    for (const k of Object.keys(d.stages) as StageStat[]) {
      const v = d.stages[k];
      if (v > 0) {
        d.stages[k] = 0;
        this.emit({ k: 'stat', target: f, stat: k, delta: -v });
        this.changeStage(id, k, v);
        any = true;
      }
    }
    if (any) this.emit({ k: 'text', text: '奪走了對手的強化！' });
  }

  /** Invert: flips the sign of the opponent's stat stages */
  invertStages(target: SideId): void {
    const d = this.active(target);
    const lowering = Object.values(d.stages).some((v) => v > 0);
    if (lowering && traitHooks(d).some((h) => h.blockStatDrop)) {
      this.emit({ k: 'resist', target, reason: `【${d.species.trait.name}】能力不會被降低` });
      return;
    }
    let any = false;
    for (const k of Object.keys(d.stages) as StageStat[]) {
      const v = d.stages[k];
      if (v !== 0) {
        d.stages[k] = -v;
        this.emit({ k: 'stat', target, stat: k, delta: -2 * v });
        any = true;
      }
    }
    if (!any) this.emit({ k: 'fail', side: this.foe(target), reason: '對手沒有能力變化' });
  }

  /** Split: both sides' HP is averaged by ratio */
  painSplit(id: SideId): void {
    const f = this.foe(id);
    const c = this.active(id);
    const d = this.active(f);
    const r = (c.hp / c.maxHp + d.hp / d.maxHp) / 2;
    for (const [side, x] of [[id, c], [f, d]] as [SideId, Combatant][]) {
      const next = Math.max(1, Math.round(r * x.maxHp));
      const delta = next - x.hp;
      x.hp = next;
      if (delta > 0) this.emit({ k: 'heal', target: side, amount: delta });
      else if (delta < 0) this.emit({ k: 'damage', target: side, dmg: -delta, reason: 'split', ko: false });
    }
  }

  /** `scapegoat`: transfers the user's status conditions to the opponent */
  transferStatus(id: SideId): void {
    const c = this.active(id);
    const f = this.foe(id);
    const list = Object.entries(c.status) as [StatusId, { turns: number; stacks?: number }][];
    if (list.length === 0) {
      this.emit({ k: 'fail', side: id, reason: '沒有可轉移的異常' });
      return;
    }
    c.status = {};
    this.emit({ k: 'cleanse', target: id, team: false });
    for (const [st, v] of list) this.applyStatus(f, st, st === 'poison' ? v.stacks : undefined);
  }

  // ── Lasting effects ("for N turns ...", the hooks are written in the lasting of the skill that creates them) ──

  /**
   * Creates or refreshes a lasting effect. key = skill id (the hooks are written in SKILL_FX[key].lasting); turns includes this turn.
   * With side: true it sits on the side (kept after switching, acts on the active spirit); otherwise it sits on the active spirit (cleared on leaving).
   */
  addLasting(target: SideId, key: string, turns: number, opts: { n?: number; side?: boolean; from?: SideId } = {}): LastingState {
    const list = opts.side ? this.side(target).lasting : this.active(target).lasting;
    let l = list.find((x) => x.key === key);
    if (l) {
      l.turns = Math.max(l.turns, turns);
      if (opts.n !== undefined) l.n = opts.n;
    } else {
      l = { key, turns, n: opts.n ?? 0, from: opts.from ?? target };
      list.push(l);
    }
    this.emit({ k: 'text', text: `${opts.side ? this.side(target).name : this.active(target).name} 獲得「${this.lastingName(l)}」（${turns} 回合）` });
    return l;
  }

  /** Reads a lasting effect (looks on the active spirit first, then on the side) */
  getLasting(target: SideId, key: string): LastingState | undefined {
    return this.active(target).lasting.find((x) => x.key === key) ?? this.side(target).lasting.find((x) => x.key === key);
  }

  /** Removes a lasting effect (onExpire is not called) */
  removeLasting(target: SideId, key: string): void {
    const c = this.active(target);
    c.lasting = c.lasting.filter((x) => x.key !== key);
    const sd = this.side(target);
    sd.lasting = sd.lasting.filter((x) => x.key !== key);
  }

  /**
   * Clears turn-based effects (the "clear turns" of Seer): own = effects the target created for itself (buffs), foe = effects the opponent put on the target (debuffs), all = both.
   * own also clears the target side's crystal wall, light screen, tailwind and the regeneration on the spirit. Returns whether anything was cleared.
   */
  clearLasting(target: SideId, which: 'own' | 'foe' | 'all' = 'own'): boolean {
    const c = this.active(target);
    const sd = this.side(target);
    const keep = (l: LastingState) => (which === 'all' ? false : which === 'own' ? l.from !== target : l.from === target);
    const before = c.lasting.length + sd.lasting.length;
    c.lasting = c.lasting.filter(keep);
    sd.lasting = sd.lasting.filter(keep);
    let any = c.lasting.length + sd.lasting.length < before;
    if (which !== 'foe') {
      if (sd.screens.physTurns > 0 || sd.screens.magTurns > 0) {
        sd.screens = { phys: 0, physTurns: 0, mag: 0, magTurns: 0 };
        any = true;
      }
      if (sd.tailwind > 0) {
        sd.tailwind = 0;
        any = true;
      }
      if (c.regen > 0) {
        c.regen = 0;
        any = true;
      }
    }
    if (any) this.emit({ k: 'text', text: `${c.name} 的回合類效果被消除了！` });
    return any;
  }

  /**
   * Reverses action order (Trick Room-style): for turns turns, at equal priority the slower acts first (the order on entering and at the end of the turn is reversed too).
   * Using it again while already reversed restores normal order.
   */
  toggleReverseOrder(turns: number): void {
    if (this.s.reverseOrder) {
      this.s.reverseOrder = 0;
      this.emit({ k: 'text', text: '行動順序恢復正常了。' });
    } else {
      this.s.reverseOrder = turns;
      this.emit({ k: 'text', text: `空間扭曲了！${turns} 回合內速度慢的精靈先行動。` });
    }
  }

  /** Destroys owner's trap that is set (without firing it). Returns whether a trap was destroyed */
  destroyTrap(owner: SideId): boolean {
    const tr = this.side(owner).trap;
    if (!tr) return false;
    this.side(owner).trap = null;
    this.emit({ k: 'trapDestroyed', side: owner, skillId: tr.skillId });
    return true;
  }

  /**
   * Places a trap directly from a skill hook (no aether spent, skill slots not checked): replaces any existing trap and sends a trapSet event.
   * setTurn defaults to this turn (an ordinary trap can fire from the next turn); pass this.s.turn - 1 for one that can fire immediately.
   */
  placeTrap(owner: SideId, skillId: string, setTurn = this.s.turn): void {
    this.side(owner).trap = { skillId, setTurn, revealed: false };
    this.emit({ k: 'trapSet', side: owner, skillId });
  }

  /** Pays aether (the cost of a skill hook): when there is not enough, nothing is deducted and false is returned */
  payAether(id: SideId, n: number): boolean {
    return this.spend(id, n);
  }

  /** Switches in the given bench spirit (ignores root and bind; the target must not be fainted or already active). Do not call it in the middle of attack resolution */
  switchTo(id: SideId, to: number): boolean {
    const m = this.side(id).team[to];
    if (!m || m.fainted || to === this.side(id).active || this.s.winner !== null) return false;
    this.doSwitch(id, to);
    return true;
  }

  /** The lasting effects currently in force for a side (on the active spirit plus on the side) with their hooks */
  lastingOf(side: SideId): [LastingState, LastingHooks][] {
    const c = this.active(side);
    const sd = this.side(side);
    if (c.lasting.length === 0 && sd.lasting.length === 0) return [];
    const out: [LastingState, LastingHooks][] = [];
    for (const l of [...c.lasting, ...sd.lasting]) {
      const h = SKILL_FX[l.key]?.lasting;
      if (h) out.push([l, h]);
    }
    return out;
  }

  /** End of turn: lasting effects lose 1 turn; those that reach zero call onExpire and are removed */
  private tickLasting(id: SideId, list: LastingState[]): LastingState[] {
    if (list.length === 0) return list;
    const keep: LastingState[] = [];
    for (const l of list) {
      if (--l.turns > 0) {
        keep.push(l);
        continue;
      }
      this.emit({ k: 'text', text: `「${this.lastingName(l)}」的效果結束了。` });
      SKILL_FX[l.key]?.lasting?.onExpire?.(this, id, l);
    }
    return keep;
  }

  private tagCache = new Map<SkillDef, Record<string, number>>();

  /** The tags the engine actually resolves: the skill's tags minus those the hook declares as manual (a manual tag's effect is implemented by the hook) */
  tagsOf(sk: SkillDef): Record<string, number> {
    const manual = SKILL_FX[sk.id]?.manual;
    if (!manual || manual.length === 0) return sk.tags;
    let t = this.tagCache.get(sk);
    if (!t) {
      t = { ...sk.tags };
      for (const k of manual) delete t[k];
      this.tagCache.set(sk, t);
    }
    return t;
  }

  /**
   * Follow-up attack: attacks once more immediately with skillId (any attack skill) at power x mult.
   * Costs no aether and does not count as the main action (no priority check, no Fate, Pour, aether drain or echo).
   */
  followUp(id: SideId, skillId: string, mult = 1, text?: string): void {
    const sk = getSkill(skillId);
    if (!isAttack(sk) || this.s.winner !== null || this.active(id).fainted || this.active(this.foe(id)).fainted) return;
    if (text) this.emit({ k: 'text', text });
    this.emit({ k: 'use', side: id, skillId: sk.id, ult: false });
    this.doAttack(id, sk, mult, true, true);
  }

  /** Percentage damage: pct% of the target's max HP (at least 1) */
  trueDamage(target: SideId, pct: number, reason: string): void {
    const c = this.active(target);
    this.damage(target, Math.max(1, Math.floor((c.maxHp * pct) / 100)), reason);
  }

  private faint(id: SideId, by: SideId, byAttack = false): void {
    const c = this.active(id);
    if (c.fainted) return;
    c.fainted = true;
    c.hp = 0;
    c.charging = null;
    c.shield = null;
    c.decoy = 0;
    c.hidden = false;
    c.perish = 0;
    c.bound = null;
    c.echo = null;
    this.emit({ k: 'faint', side: id, idx: this.side(id).active });
    for (const h of traitHooks(c)) h.onFaint?.(this, id, by, byAttack);
    const killer = this.active(by);
    // Shared fate: when knocked out by an attack, the one who knocked it out faints too
    if (byAttack && c.bondActive && by !== id && !killer.fainted) {
      c.bondActive = false;
      this.emit({ k: 'text', text: '同命咒發動！' });
      this.damage(by, killer.hp, 'bond');
    }
    // Traps for when our spirit is knocked out (on: 'fainted')
    if (by !== id) this.fireTrap(id, { on: 'fainted', by, byAttack })?.after?.();
    this.benchEvent(id, (h, i) => h.onAllyFaint?.(this, id, i, byAttack));
    this.checkWinner();
  }

  private checkWinner(): void {
    if (this.s.winner !== null) return;
    const dead = (id: SideId) => this.side(id).team.every((c) => c.fainted);
    const d0 = dead(0);
    const d1 = dead(1);
    if (d0 || d1) {
      this.s.winner = d0 && d1 ? 'draw' : d0 ? 1 : 0;
      this.emit({ k: 'end', winner: this.s.winner });
    }
  }

  // ───────────────────────── End phase ─────────────────────────

  private endPhase(): void {
    const st = this.s;
    for (const id of this.bySpeed([0, 1])) {
      if (st.winner !== null) return;
      const c = this.active(id);
      if (c.fainted) continue;
      const f = this.foe(id);
      if (c.status.burn) this.trueDamage(id, 6, 'burn');
      if (!c.fainted && c.status.poison) this.trueDamage(id, 3 * (c.status.poison.stacks ?? 1), 'poison');
      if (!c.fainted && c.leechSeed) {
        const amt = Math.max(1, Math.floor(c.maxHp * 0.04));
        this.damage(id, amt, 'leech');
        this.healAmount(f, amt);
      }
      if (!c.fainted && st.field?.element === 'earth' && !c.elements.includes('earth')) this.trueDamage(id, 5, 'sand');
      if (!c.fainted && c.bound) this.trueDamage(id, c.bound.pct, 'bind');
      if (c.fainted) continue;
      if (st.field?.element === 'nature') this.heal(id, 5);
      if (st.field?.element === 'water' && c.elements.includes('water')) this.heal(id, 5);
      if (c.regen > 0) this.heal(id, 6);
      for (const h of traitHooks(c)) if (!c.fainted && st.winner === null) h.onEndTurn?.(this, id);
      for (const [l, h] of this.lastingOf(id)) if (!c.fainted && st.winner === null) h.onTurnEnd?.(this, id, l);
    }
    if (st.winner !== null) return;
    // End-of-turn traps (on: 'turnEnd') and bench effects
    for (const id of this.bySpeed([0, 1])) {
      if (st.winner !== null) return;
      if (!this.active(id).fainted) this.fireTrap(id, { on: 'turnEnd' })?.after?.();
      this.benchEvent(id, (h, i) => h.onTurnEnd?.(this, id, i));
    }
    if (st.winner !== null) return;

    // Wish and doom
    for (const id of [0, 1] as SideId[]) {
      const sd = this.side(id);
      const c = this.active(id);
      if (sd.wish && --sd.wish.turns <= 0) {
        const pct = sd.wish.pct;
        sd.wish = null;
        if (!c.fainted) {
          this.emit({ k: 'text', text: '願望實現了！' });
          this.heal(id, pct);
        }
      }
      if (sd.doom && --sd.doom.turns <= 0) {
        const pct = sd.doom.pct;
        sd.doom = null;
        if (!c.fainted && st.winner === null) {
          this.emit({ k: 'text', text: '預言應驗了！' });
          this.trueDamage(id, pct, 'doom');
        }
      }
    }
    if (st.winner !== null) return;
    // Echo
    for (const id of this.bySpeed([0, 1])) {
      const c = this.active(id);
      if (c.fainted || !c.echo || st.winner !== null) continue;
      if (--c.echo.turns > 0) continue;
      const sk = getSkill(c.echo.skill);
      const mult = c.echo.mult;
      c.echo = null;
      if (this.active(this.foe(id)).fainted) continue;
      this.emit({ k: 'text', text: `「${sk.name}」的回音響起！` });
      this.emit({ k: 'use', side: id, skillId: sk.id, ult: false });
      this.doAttack(id, sk, mult, true, true);
    }
    if (st.winner !== null) return;
    // Perish countdown
    for (const id of [0, 1] as SideId[]) {
      const c = this.active(id);
      if (c.fainted || c.perish <= 0 || st.winner !== null) continue;
      c.perish--;
      if (c.perish === 0) {
        this.emit({ k: 'text', text: `${c.name} 聽完了終焉之歌……` });
        this.damage(id, c.hp, 'perish');
      }
    }
    if (st.winner !== null) return;

    // Lasting turns tick down
    for (const id of [0, 1] as SideId[]) {
      const sd = this.side(id);
      for (const c of sd.team) {
        c.guarding = false;
        c.hitByPhysicalThisTurn = false;
        c.usedAttackThisTurn = false;
        if (c.fainted) continue;
        const isActive = c === this.active(id);
        if (c.toughness > 0) c.toughness--;
        if (!isActive) continue;
        for (const k of TIMED) {
          const s = c.status[k];
          if (!s) continue;
          s.turns--;
          if (s.turns <= 0) {
            delete c.status[k];
            this.emit({ k: 'statusEnd', target: id, status: k });
          }
        }
        if (c.shield && --c.shield.turns <= 0) {
          c.shield = null;
          this.emit({ k: 'shieldBreak', target: id });
        }
        if (c.leechSeed && --c.leechSeed.turns <= 0) c.leechSeed = null;
        if (c.regen > 0) c.regen--;
        c.retaliate = 0;
        if (c.bound && --c.bound.turns <= 0) {
          c.bound = null;
          this.emit({ k: 'text', text: `${c.name} 掙脫了纏繞。` });
        }
        if (c.disabled && c.disabled.turns <= st.turn) {
          c.disabled = null;
          this.emit({ k: 'text', text: `${c.name} 的技能封印解除了。` });
        }
        if (c.exposed && c.exposed <= st.turn) c.exposed = 0;
        c.lasting = this.tickLasting(id, c.lasting);
      }
      sd.lasting = this.tickLasting(id, sd.lasting);
      if (sd.tailwind > 0) sd.tailwind--;
      if (sd.screens.physTurns > 0 && --sd.screens.physTurns === 0) this.emit({ k: 'text', text: `${sd.name} 的晶壁消失了。` });
      if (sd.screens.magTurns > 0 && --sd.screens.magTurns === 0) this.emit({ k: 'text', text: `${sd.name} 的光幕消失了。` });
      sd.artThisTurn = null;
    }
    if (st.reverseOrder && --st.reverseOrder <= 0) {
      st.reverseOrder = 0;
      this.emit({ k: 'text', text: '行動順序恢復正常了。' });
    }
    if (st.field) {
      st.field.turns--;
      if (st.field.turns <= 0) {
        st.field = null;
        this.emit({ k: 'field', element: null, turns: 0 });
      }
    }

    if (st.turn >= st.maxTurns && st.winner === null) {
      const score = (id: SideId) =>
        this.side(id).team.reduce((s, c) => s + (c.fainted ? 0 : c.hp / c.maxHp), 0);
      const a = score(0);
      const b = score(1);
      st.winner = a === b ? 'draw' : a > b ? 0 : 1;
      this.emit({ k: 'end', winner: st.winner });
      return;
    }
    for (const id of [0, 1] as SideId[]) {
      st.pendingReplace[id] = this.active(id).fainted && this.aliveBench(id).length > 0;
    }
  }
}
