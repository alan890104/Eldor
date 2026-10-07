// Skill hooks and kit hooks for the neutral group (data/kits/neutral.json). For how to write them, see docs/10-kit-authoring.md.
// Only `import type { Battle }` is allowed (importing battle.ts at runtime would create a circular dependency).

import { findSkill, getSkill, SKILLS, SYSTEM_SKILL_IDS } from '../../data.ts';
import type { Battle } from '../battle.ts';
import { addVar, type KitHooks, type LastingHooks, type LastingState, type Redirect, type SkillHooks } from '../skillfx.ts';
import { statStageMultiplier } from '../../../sim/formulas.ts';
import type { SkillDef } from '../../../sim/types.ts';
import type { SideId, StageStat } from '../types.ts';

// ═════════════════════════ `eldarin`: Pact Clauses ═════════════════════════
//
// A "pact" skill creates a lasting effect on `eldarin` (key = skill id) that acts as the "clause": only one at a time, 3 turns,
// cleared together with the lasting effect when `eldarin` leaves the field; the opponent's "clear turn-based effects" can also tear it off (it is `eldarin`'s own turn-based effect).
// At end of turn (KIT.onEndTurn) both sides are checked for breaking the clause this turn; the side that breaks it gives the other 2 aether
// (each point it is short becomes a loss of 6% max HP). The opponent's breach count is recorded in e:eld:breach, for `eldarin_settlement`, `eldarin_sigil_bolt` and `eldarin_verdict_fang` to cash in.
// On the turn of signing, only actions taken after the signing count: guard, switch and trap-setting always come before signing, so that turn is not checked;
// status skills are checked at the moment of use (onFoeStatusSkill), and the true name takes the skill-use count at signing as its baseline.

/** Actions the clause restricts */
interface Rule {
  /** Using guard */
  guard?: boolean;
  /** Voluntary switch (a replacement after a faint does not count) */
  swap?: boolean;
  /** Using a status skill or setting a trap */
  arts?: boolean;
  /** Using the named skill (true name) */
  named?: boolean;
}

const CLAUSES: Record<string, Rule> = {
  eldarin_clash_pact: { guard: true, swap: true },
  eldarin_hush_pact: { arts: true },
  eldarin_name_pact: { named: true },
  u_eldarin: { guard: true, swap: true, arts: true },
};

/** Penalty */
const FEE = 2;
/** Max HP % lost for each point of aether it is short */
const FEE_HP = 6;
const CLAUSE_TURNS = 3;

// Counters on `eldarin` (e: prefix, cleared on leaving the field)
const V = {
  /** The opponent's breach count during this clause */
  breach: 'e:eld:breach',
  /** The turn the clause was signed */
  signT: 'e:eld:signT',
  /** The opponent has already broken the clause this turn (recorded at the moment a status skill is used) */
  foeBrokeT: 'e:eld:foeBrokeT',
  /** True name: hash of the named skill id */
  named: 'e:eld:named',
  /** True name: hash of the uid of the opponent's active spirit, and its number of skills used (the baseline for checking "whether it used the named skill this turn") */
  snapUid: 'e:eld:snapUid',
  snapUsed: 'e:eld:snapUsed',
};

/** String hash (vars hold only numbers: skill ids and uids are recorded as hashes) */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The clause currently in force (only ever on `eldarin`) */
function clauseOf(b: Battle, id: SideId): LastingState | undefined {
  return b.active(id).lasting.find((l) => l.key in CLAUSES);
}

const breaches = (b: Battle, id: SideId): number => (clauseOf(b, id) ? (b.active(id).vars[V.breach] ?? 0) : 0);

/** Records the opponent's current skill-use count (the true name's baseline) */
function snapshot(b: Battle, id: SideId): void {
  const c = b.active(id);
  const d = b.active(b.foe(id));
  c.vars[V.snapUid] = hash(d.uid);
  c.vars[V.snapUsed] = d.usedSinceEnter;
}

/** Sign a clause: replaces any other clause; signing the same one again refreshes the turns and keeps the breach count */
function sign(b: Battle, id: SideId, key: string, banner = '契約條款'): void {
  const c = b.active(id);
  if (c.fainted) return;
  for (const k of Object.keys(CLAUSES)) if (k !== key) b.removeLasting(id, k);
  if (!c.lasting.some((l) => l.key === key)) c.vars[V.breach] = 0;
  b.traitEvent(id, banner);
  b.addLasting(id, key, CLAUSE_TURNS);
  c.vars[V.signT] = b.s.turn;
  snapshot(b, id);
}

/** Breach: payer gives the other side 2 aether; each point it is short becomes a loss of 6% max HP */
function breach(b: Battle, payer: SideId): void {
  const recv = b.foe(payer);
  const have = Math.min(FEE, b.side(payer).aether);
  const miss = FEE - have;
  const paid = have === 0 ? '沒有靈能可交，以生命抵付' : `交出 ${have} 點靈能${miss > 0 ? `，不足的 ${miss} 點以生命抵付` : ''}`;
  b.text(`${b.active(payer).name} 違約了！${paid}。`);
  if (have > 0) b.drainAether(recv, have, true);
  if (miss > 0 && !b.active(payer).fainted) b.trueDamage(payer, FEE_HP * miss, 'breach');
}

/** Opponent breach: pay the penalty and record it on the clause */
function foeBreach(b: Battle, id: SideId): void {
  const c = b.active(id);
  if (clauseOf(b, id)) c.vars[V.breach] = (c.vars[V.breach] ?? 0) + 1;
  breach(b, b.foe(id));
}

/** The opponent used the named true-name skill this turn */
function usedNamed(b: Battle, id: SideId): boolean {
  const c = b.active(id);
  const d = b.active(b.foe(id));
  if (!d.lastSkill || c.vars[V.named] === undefined) return false;
  const base = hash(d.uid) === c.vars[V.snapUid] ? (c.vars[V.snapUsed] ?? 0) : 0;
  return d.usedSinceEnter > base && hash(d.lastSkill) === c.vars[V.named];
}

/** Name of the named true-name skill (for display): finds the skill with the same hash among the opponent team's skills */
function namedSkill(b: Battle, id: SideId): string | null {
  const h = b.active(id).vars[V.named];
  if (h === undefined) return null;
  for (const m of b.side(b.foe(id)).team) {
    for (const s of [...m.skills, ...(m.ultimate ? [m.ultimate] : []), ...(m.lastSkill ? [m.lastSkill] : [])]) {
      if (hash(s) === h) return findSkill(s)?.name ?? null;
    }
  }
  return null;
}

/** End of turn: settle both sides' breaches this turn */
function settle(b: Battle, id: SideId): void {
  const c = b.active(id);
  const l = clauseOf(b, id);
  const t = b.s.turn;
  if (!l) {
    snapshot(b, id);
    return;
  }
  const r = CLAUSES[l.key];
  const fresh = c.vars[V.signT] === t;
  const f = b.foe(id);
  const d = b.active(f);
  let foeBroke = c.vars[V.foeBrokeT] === t;
  if (!d.fainted && !fresh) {
    if (r.guard && d.lastGuardTurn === t) foeBroke = true;
    if (r.swap && d.enteredTurn === t) foeBroke = true;
    if (r.arts && b.side(f).trap?.setTurn === t) foeBroke = true;
  }
  if (!d.fainted && r.named && usedNamed(b, id)) foeBroke = true;
  let selfBroke = false;
  if (!fresh && r.guard && c.lastGuardTurn === t) selfBroke = true;
  if (!fresh && r.arts && b.side(id).trap?.setTurn === t) selfBroke = true;
  if (foeBroke && !d.fainted) foeBreach(b, id);
  if (selfBroke && !c.fainted) breach(b, id);
  if (!c.fainted) snapshot(b, id);
}

/** The clause's lasting effect: its name and the cleanup when it ends */
const clauseLasting = (name: string): LastingHooks => ({
  name,
  onExpire: (b, owner) => {
    b.active(owner).vars[V.breach] = 0;
  },
});

/** Aether that pouring actually puts in (when estimating, subtracts the cost not yet paid) */
function pourAether(b: Battle, id: SideId, estimate: boolean, skillId: string): number {
  const a = b.side(id).aether;
  return estimate ? Math.max(0, a - b.costFor(id, getSkill(skillId))) : a;
}

/** AI: when to sign a pact (no clause in force and the opponent still healthy enough; more eager when the first skill after entering is free) */
function pactAi(b: Battle, id: SideId, base: number, key: string): number {
  const l = clauseOf(b, id);
  const d = b.active(b.foe(id));
  if (d.hp / d.maxHp < 0.3) return -60;
  if (l && l.key === key && l.turns >= 2) return -90;
  if (l && l.turns >= 2) return -50;
  const free = b.active(id).usedSinceEnter === 0 ? 12 : 0;
  return 48 + free - base;
}

/** AI: save aether before pouring (exceptions: it can KO, or the first skill after entering is free) */
function pourAi(b: Battle, id: SideId, skillId: string): number {
  const d = b.active(b.foe(id));
  if (b.estimate(id, skillId) >= d.hp) return 25;
  const n = pourAether(b, id, true, skillId);
  if (b.costFor(id, getSkill(skillId)) === 0 && n >= 3) return 15;
  return n >= 5 ? 12 : n >= 3 ? -8 : -30;
}

const ELDARIN_FX: Record<string, SkillHooks> = {
  eldarin_sigil_claw: {
    // `eldarin_sigil_claw`: aether +1 when it hits during a clause
    afterAttack: (b, c) => {
      if (clauseOf(b, c.attacker)) b.gainAether(c.attacker, 1);
    },
    aiScore: (b, id) => (clauseOf(b, id) ? 10 : 0),
  },
  eldarin_clash_pact: {
    effect: (b, id) => sign(b, id, 'eldarin_clash_pact'),
    lasting: clauseLasting('交鋒之約'),
    aiScore: (b, id, base) => pactAi(b, id, base, 'eldarin_clash_pact') + (b.aliveBench(b.foe(id)).length > 0 ? 6 : 0),
  },
  pact_breath: {
    // `pact_breath`: +20 per poured point (tag); +25 per point during a clause (+5 added here)
    power: (b, c, p) => (clauseOf(b, c.attacker) ? p + 5 * pourAether(b, c.attacker, c.estimate, 'pact_breath') : p),
    aiScore: (b, id) => pourAi(b, id, 'pact_breath'),
  },
  eldarin_sigil_bolt: {
    // `eldarin_sigil_bolt`: +50 if the opponent has breached during this clause
    power: (b, c, p) => (breaches(b, c.attacker) > 0 ? p + 50 : p),
  },
  eldarin_oath_scale: {
    // `eldarin_oath_scale`: 40% damage reduction when hit; during a clause the opponent breaches
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => {
        if (clauseOf(b, owner) && !b.active(b.foe(owner)).fainted) foeBreach(b, owner);
        return { reduce: 0.4 };
      },
    },
    aiScore: (b, id) => {
      const l = clauseOf(b, id);
      if (l && CLAUSES[l.key].arts) return -300;
      return l ? 30 : 5;
    },
  },
  eldarin_binding_tail: {
    // `eldarin_binding_tail`: clause +1 turn (max 3)
    afterAttack: (b, c) => {
      const l = clauseOf(b, c.attacker);
      if (l && l.turns < CLAUSE_TURNS) b.addLasting(c.attacker, l.key, l.turns + 1);
    },
    aiScore: (b, id) => {
      const l = clauseOf(b, id);
      return l && l.turns < CLAUSE_TURNS ? 12 : 0;
    },
  },
  eldarin_hush_pact: {
    effect: (b, id) => sign(b, id, 'eldarin_hush_pact'),
    lasting: clauseLasting('禁術之約'),
    aiScore: (b, id, base) => {
      const arts = b.active(b.foe(id)).skills.filter((s) => {
        const cat = findSkill(s)?.category;
        return cat === 'status' || cat === 'trap';
      }).length;
      return arts === 0 ? -100 : pactAi(b, id, base, 'eldarin_hush_pact') + Math.min(20, arts * 8);
    },
  },
  eldarin_settlement: {
    // `eldarin_settlement`: +60 per breach (up to +180); ends the clause after the attack
    power: (b, c, p) => p + 60 * Math.min(3, breaches(b, c.attacker)),
    afterAttack: (b, c) => {
      const l = clauseOf(b, c.attacker);
      if (!l) return;
      b.removeLasting(c.attacker, l.key);
      b.active(c.attacker).vars[V.breach] = 0;
      b.text('條款結清了。');
    },
    aiScore: (b, id) => {
      const n = breaches(b, id);
      return n > 0 ? 8 * n : clauseOf(b, id) ? -15 : 0;
    },
  },
  eldarin_oathwing: {
    // `eldarin_oathwing`: priority +1 during a clause
    priority: (b, id) => (clauseOf(b, id) ? 1 : 0),
  },
  eldarin_oath_flame: {
    // `eldarin_oath_flame`: during a clause, pouring gives +30 per point (the tag gives +20, +10 added here)
    power: (b, c, p) => (clauseOf(b, c.attacker) ? p + 10 * pourAether(b, c.attacker, c.estimate, 'eldarin_oath_flame') : p),
    aiScore: (b, id) => pourAi(b, id, 'eldarin_oath_flame'),
  },
  eldarin_verdict_fang: {
    // `eldarin_verdict_fang`: ignores guard (tag); always crits an opponent that has breached
    critBonus: (b, c) => (breaches(b, c.attacker) > 0 ? 1 : 0),
  },
  eldarin_name_pact: {
    // `eldarin_name_pact`: names the skill the opponent used last (ultimates excluded)
    canUse: (b, id) => {
      const last = b.active(b.foe(id)).lastSkill;
      return last && getSkill(last).category !== 'ultimate' ? null : '沒有可指定的技能';
    },
    effect: (b, id) => {
      const last = b.active(b.foe(id)).lastSkill;
      if (!last || getSkill(last).category === 'ultimate') {
        b.text('沒有可指定的技能。');
        return;
      }
      b.active(id).vars[V.named] = hash(last);
      sign(b, id, 'eldarin_name_pact');
      b.text(`真名：「${getSkill(last).name}」被寫進了條款！`);
    },
    lasting: clauseLasting('真名之約'),
    aiScore: (b, id, base) => {
      const f = b.foe(id);
      const last = b.active(f).lastSkill;
      if (!last) return -100;
      const sk = getSkill(last);
      const me = b.active(id);
      const threat = sk.category === 'physical' || sk.category === 'magic' ? Math.min(30, (40 * b.estimate(f, last)) / Math.max(1, me.hp)) : 10;
      return pactAi(b, id, base, 'eldarin_name_pact') + threat;
    },
  },
  u_eldarin: {
    // `u_eldarin`: ignores guard (tag); signs the All Pacts clause after it hits
    afterAttack: (b, c) => sign(b, c.attacker, 'u_eldarin'),
    lasting: clauseLasting('萬約'),
    aiScore: (b, id) => {
      const d = b.active(b.foe(id));
      const l = clauseOf(b, id);
      return d.hp / d.maxHp > 0.4 && l?.key !== 'u_eldarin' ? 40 : 0;
    },
  },
};

const ELDARIN_KIT: KitHooks = {
  // Trait "First Pact" (rewritten): signs `eldarin_clash_pact` on entering; the first skill after entering is free
  freeFirstSkill: true,
  onEnter: (b, id) => sign(b, id, 'eldarin_clash_pact', '初契'),
  onFoeStatusSkill: (b, id) => {
    const l = clauseOf(b, id);
    if (l && CLAUSES[l.key].arts) b.active(id).vars[V.foeBrokeT] = b.s.turn;
  },
  onEndTurn: (b, id) => settle(b, id),
  // AI: when its own clause forbids guarding, guarding costs an extra 2 aether in penalty to the opponent; it does not guard unless the hit would be lethal
  aiGuard: (b, id, base) => {
    const l = clauseOf(b, id);
    if (!l || !CLAUSES[l.key].guard) return 0;
    return base >= 55 ? -25 : -45;
  },
  marks: (b, id) => {
    const l = clauseOf(b, id);
    if (!l) return [];
    const out = [];
    const n = b.active(id).vars[V.breach] ?? 0;
    if (n > 0) out.push({ id: 'kit:breach', n, note: '違約' });
    if (l.key === 'eldarin_name_pact') {
      const nm = namedSkill(b, id);
      if (nm) out.push({ id: 'kit:truename', note: `真名：${nm}` });
    }
    return out;
  },
};

// ═════════════════════════ `relic_blade`: Foresight ═════════════════════════
//
// "Sword Intent" is kept on `relic_blade` (e: prefix, reset to 0 on leaving the field). Foresight: (1) a guard blocks an attack (KIT.onGuarded, which also triggers the counter of the trait "Sword Intent");
// (2) after being attacked this turn (KIT.onHitTaken records the turn), it counters with a physical skill hit (each physical skill's afterAttack, once per turn).
// Each stack of Sword Intent: physical crit rate +15% (KIT.critBonus). Counters all use a follow-up attack of `relic_blade_edge`; a counter never triggers another counter.

const RB = {
  intent: 'e:rb:intent',
  /** Attacked this turn (records the turn number) */
  hitT: 'e:rb:hitT',
  /** Already used Foresight by counterattacking this turn */
  readT: 'e:rb:readT',
  /** The opponent used a status skill this turn */
  foeArtT: 'e:rb:foeArtT',
  /** A counter is in progress (prevents a counter from triggering another) */
  riposte: 'e:rb:riposte',
  /** `relic_first_cut` hit this turn (Foresight is resolved after it acts) */
  landT: 'e:rb:landT',
};
const INTENT_MAX = 3;
/** Physical crit rate per stack of Sword Intent */
const INTENT_CRIT = 0.15;

const intentOf = (b: Battle, id: SideId): number => b.active(id).vars[RB.intent] ?? 0;

function gainIntent(b: Battle, id: SideId): void {
  const c = b.active(id);
  if (c.fainted || intentOf(b, id) >= INTENT_MAX) return;
  const n = addVar(b, id, RB.intent, 1, INTENT_MAX);
  b.text(`${c.name} 的「劍意」${n}／${INTENT_MAX}`);
}

/** Spend all Sword Intent and return the stack count */
function spendIntent(b: Battle, id: SideId): number {
  const n = intentOf(b, id);
  if (n > 0) {
    b.active(id).vars[RB.intent] = 0;
    b.text(`${b.active(id).name} 釋放了 ${n} 層「劍意」！`);
  }
  return n;
}

/** Already been attacked this turn (uncertain when estimating, so the caller supplies an expected value) */
function hitThisTurn(b: Battle, id: SideId): boolean {
  const c = b.active(id);
  return c.vars[RB.hitT] === b.s.turn || c.hitByPhysicalThisTurn;
}

/** Foresight (2): after being attacked, counter with a physical skill hit (once per turn) */
function counterRead(b: Battle, id: SideId): void {
  const c = b.active(id);
  if (c.fainted || !hitThisTurn(b, id) || c.vars[RB.readT] === b.s.turn) return;
  c.vars[RB.readT] = b.s.turn;
  b.traitEvent(id, '見切');
  gainIntent(b, id);
}

/** Counter: a follow-up attack with `relic_blade_edge` (no counter during a counter) */
function riposte(b: Battle, id: SideId, mult: number, text: string): void {
  const c = b.active(id);
  if (c.fainted || c.vars[RB.riposte] || b.active(b.foe(id)).fainted) return;
  c.vars[RB.riposte] = 1;
  try {
    b.followUp(id, 'relic_blade_edge', mult, text);
  } finally {
    c.vars[RB.riposte] = 0;
  }
}

/** Attack hook: after a hit, check Foresight */
const readAfter: SkillHooks['afterAttack'] = (b, c) => counterRead(b, c.attacker);

const RELIC_FX: Record<string, SkillHooks> = {
  relic_blade_edge: {
    // `relic_blade_edge`: +20 if attacked earlier this turn (half counted when estimating)
    power: (b, c, p) => p + (c.estimate ? 10 : hitThisTurn(b, c.attacker) ? 20 : 0),
    afterAttack: readAfter,
  },
  iaido: {
    // `iaido`: +70 if attacked earlier this turn (counted at a 0.8 chance when estimating)
    power: (b, c, p) => p + (c.estimate ? 56 : hitThisTurn(b, c.attacker) ? 70 : 0),
    afterAttack: readAfter,
    aiScore: (b, id) => {
      const f = b.foe(id);
      const foeAttacks = b.active(f).skills.some((s) => {
        const cat = findSkill(s)?.category;
        return (cat === 'physical' || cat === 'magic') && b.canUse(f, s).ok;
      });
      return foeAttacks ? 8 : -40;
    },
  },
  relic_moon_drill: {
    effect: (b, id) => gainIntent(b, id),
    aiScore: (b, id) => (intentOf(b, id) >= INTENT_MAX ? -20 : 6),
  },
  relic_break_stance: {
    // `relic_break_stance`: +50 if the opponent used a status skill earlier this turn
    power: (b, c, p) => p + (c.estimate ? 15 : b.active(c.attacker).vars[RB.foeArtT] === b.s.turn ? 50 : 0),
    afterAttack: readAfter,
    aiScore: (b, id) => {
      const d = b.active(b.foe(id));
      const ups = Object.values(d.stages).reduce((a, v) => a + Math.max(0, v), 0) + (d.shield ? 1 : 0);
      return ups * 14;
    },
  },
  relic_swallow: {
    // `relic_swallow`: 3 hits if attacked earlier this turn
    hits: (b, c) => (c.estimate ? 2.5 : hitThisTurn(b, c.attacker) ? 3 : 2),
    afterAttack: readAfter,
  },
  relic_zanshin: {
    // `relic_zanshin`: 30% damage reduction when hit, then counters with `relic_blade_edge` after the attack resolves
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => ({ reduce: 0.3, after: () => riposte(b, owner, 1, '殘心！') }),
    },
    aiScore: () => 20,
  },
  relic_guardbreak: {
    // `relic_guardbreak`: ignores guard (tag); +40 if it breaks a guard, Sword Intent +1
    power: (b, c, p) => (c.guardBroken ? p + 40 : p),
    afterAttack: (b, c) => {
      if (c.guardBroken) {
        b.traitEvent(c.attacker, '見切');
        gainIntent(b, c.attacker);
      }
      counterRead(b, c.attacker);
    },
    aiScore: (b, id) => {
      const fsd = b.side(b.foe(id));
      const d = b.active(b.foe(id));
      return d.lastGuardTurn !== b.s.turn && fsd.aether >= 1 && intentOf(b, id) >= 2 ? 10 : 0;
    },
  },
  relic_first_cut: {
    // `relic_first_cut`: +50 per stack of Sword Intent (Sword Intent's crit rate still applies to this cut). It spends all Sword Intent as it acts, even if blocked or missed,
    // which is how the opponent can answer it. Foresight for this cut is resolved after the spend, so a `relic_first_cut` that hits when moving second leaves 1 stack.
    power: (b, c, p) => p + 50 * intentOf(b, c.attacker),
    afterAttack: (b, c) => void (b.active(c.attacker).vars[RB.landT] = b.s.turn),
    afterUse: (b, id) => {
      spendIntent(b, id);
      if (b.active(id).vars[RB.landT] === b.s.turn) counterRead(b, id);
    },
    aiScore: (b, id) => {
      const n = intentOf(b, id);
      return n >= 2 ? 25 : n === 1 ? 0 : -35;
    },
  },
  relic_iron_cleave: {
    afterAttack: readAfter,
  },
  relic_oath_thrust: {
    // `relic_oath_thrust`: always crits at full Sword Intent
    critBonus: (b, c) => (intentOf(b, c.attacker) >= INTENT_MAX ? 1 : 0),
    afterAttack: readAfter,
    aiScore: (b, id) => {
      const d = b.active(b.foe(id));
      return d.hp / d.maxHp < 0.25 ? 15 : 0;
    },
  },
  relic_sword_domain: {
    // `relic_sword_domain`: for 3 turns, counters with `relic_blade_edge` after being hit (×0.6); a counter (a follow-up attack) does not trigger another counter
    effect: (b, id) => void b.addLasting(id, 'relic_sword_domain', 3),
    lasting: {
      name: '劍界',
      onHitTaken: (b, ctx) => {
        if (ctx.followUp) return;
        riposte(b, ctx.defender, 0.6, '劍界：返刃！');
      },
    },
    aiScore: (b, id) => {
      const me = b.active(id);
      if (b.getLasting(id, 'relic_sword_domain')) return -100;
      return me.hp / me.maxHp > 0.45 ? 30 : -10;
    },
  },
  u_relic_blade: {
    // `u_relic_blade`: ignores guard (tag); spends all Sword Intent as it acts, +40 per stack
    power: (b, c, p) => p + 40 * intentOf(b, c.attacker),
    afterUse: (b, id) => void spendIntent(b, id),
  },
};

const RELIC_KIT: KitHooks = {
  // Trait "Sword Intent" (rewritten): a guard that blocks an attack gives Foresight (1) and counters with `relic_blade_edge`
  onGuarded: (b, id) => {
    b.traitEvent(id, '劍意');
    gainIntent(b, id);
    riposte(b, id, 1, '返刃！');
  },
  onHitTaken: (b, a) => {
    b.active(a.defender).vars[RB.hitT] = b.s.turn;
  },
  onFoeStatusSkill: (b, id) => {
    b.active(id).vars[RB.foeArtT] = b.s.turn;
  },
  critBonus: (b, a) => (a.cat === 'physical' ? INTENT_CRIT * intentOf(b, a.attacker) : 0),
  // AI: when the opponent has an attack available, guarding is the opening move of a counter
  aiGuard: (b, id) => {
    const f = b.foe(id);
    const d = b.active(f);
    const canHit = d.skills.some((s) => {
      const cat = findSkill(s)?.category;
      return (cat === 'physical' || cat === 'magic') && b.canUse(f, s).ok;
    });
    return canHit ? 8 : -20;
  },
  marks: (b, id) => {
    const n = intentOf(b, id);
    return n > 0 ? [{ id: 'kit:intent', n, note: '劍意' }] : [];
  },
};

// ═════════════════════════ `grimoire`: Copybook ═════════════════════════
//
// The copybook is kept on `grimoire` (gm:p0 to gm:p2, p0 newest; no e: prefix, so it survives leaving the field). vars hold only numbers, so skill-id hashes are stored
// and looked up in the full skill table. When pages are copied: when an opponent's attack hits `grimoire` (KIT.onHitTaken, recording the skill actually used), when the opponent uses a status skill
// (KIT.onFoeStatusSkill), and at end of turn, which catches up on attacks that were blocked or missed (a snapshot of lastSkill and the use count).
// "Transcribe" skills use redirect to cast a skill from the copybook; physical skills are converted by the multiplier MAG ÷ ATK, which is the same as computing with MAG.

const PAGES = ['gm:p0', 'gm:p1', 'gm:p2'];
const GM = {
  snapUid: 'e:gm:snapUid',
  snapUsed: 'e:gm:snapUsed',
  /** `grimoire_annotate`: the next transcribe has ×1.5 power */
  annot: 'e:gm:annot',
};
/** Skills that are not copied: the transcribe type (copying them would only recast themselves) */
const COPY_SKILLS = new Set(['transcribe', 'grimoire_final_chapter']);

const idByHash = new Map<number, string>();
function skillOfHash(h: number): string | undefined {
  let id = idByHash.get(h);
  if (id === undefined) {
    for (const s of SKILLS) idByHash.set(hash(s.id), s.id);
    id = idByHash.get(h);
  }
  return id;
}

/** The pages of the copybook (newest first) */
function pagesOf(b: Battle, id: SideId): string[] {
  const c = b.active(id);
  const out: string[] = [];
  for (const k of PAGES) {
    const h = c.vars[k];
    const s = h ? skillOfHash(h) : undefined;
    if (s) out.push(s);
  }
  return out;
}

function setPages(b: Battle, id: SideId, list: string[]): void {
  const c = b.active(id);
  PAGES.forEach((k, i) => {
    if (list[i]) c.vars[k] = hash(list[i]);
    else delete c.vars[k];
  });
}

function recordable(skillId: string): boolean {
  const s = findSkill(skillId);
  return !!s && s.category !== 'ultimate' && s.category !== 'trap' && !SYSTEM_SKILL_IDS.has(skillId) && !COPY_SKILLS.has(skillId);
}

/** Copy one page (an existing one moves to newest; when full, the oldest is pushed out) */
function record(b: Battle, id: SideId, skillId: string): void {
  if (!recordable(skillId) || b.active(id).fainted) return;
  const list = pagesOf(b, id);
  const had = list.indexOf(skillId);
  if (had === 0) return;
  if (had > 0) list.splice(had, 1);
  list.unshift(skillId);
  setPages(b, id, list.slice(0, PAGES.length));
  if (had < 0) b.text(`${b.active(id).name} 把「${getSkill(skillId).name}」抄進了抄本。`);
}

function gmSnapshot(b: Battle, id: SideId): void {
  const c = b.active(id);
  const d = b.active(b.foe(id));
  c.vars[GM.snapUid] = hash(d.uid);
  c.vars[GM.snapUsed] = d.usedSinceEnter;
}

/** Catch up: attacks the opponent used since the last snapshot that did not land (blocked or missed) */
function syncPages(b: Battle, id: SideId): void {
  const c = b.active(id);
  const d = b.active(b.foe(id));
  const base = hash(d.uid) === c.vars[GM.snapUid] ? (c.vars[GM.snapUsed] ?? 0) : 0;
  const last = d.lastSkill ? findSkill(d.lastSkill) : undefined;
  if (!d.fainted && last && d.usedSinceEnter > base && (last.category === 'physical' || last.category === 'magic')) record(b, id, last.id);
  gmSnapshot(b, id);
}

const isAttackSkill = (s: SkillDef | undefined): s is SkillDef => !!s && (s.category === 'physical' || s.category === 'magic');

/** Physical skills are computed with MAG instead: MAG ÷ ATK */
function conv(b: Battle, id: SideId, sk: SkillDef): number {
  if (sk.category !== 'physical') return 1;
  const c = b.active(id);
  return b.effStat(c, 'mag', id) / Math.max(1, b.effStat(c, 'atk', id));
}

const newestPage = (b: Battle, id: SideId): string | undefined => pagesOf(b, id)[0];
/** The attack page with the highest power (the newer one on a tie) */
function strongestPage(b: Battle, id: SideId): string | undefined {
  let best: SkillDef | undefined;
  for (const p of pagesOf(b, id)) {
    const s = getSkill(p);
    if (isAttackSkill(s) && (!best || s.power > best.power)) best = s;
  }
  return best?.id;
}

/** Transcribe: cast one page (redirect) */
function castPage(b: Battle, id: SideId, self: string, page: string | undefined, mult: number): Redirect | string {
  if (!page) return '抄本裡沒有可施展的頁';
  const sk = getSkill(page);
  const c = b.active(id);
  const annot = c.vars[GM.annot] ? 1.5 : 1;
  c.vars[GM.annot] = 0;
  return { skill: page, cost: b.costFor(id, getSkill(self)), powerMult: mult * annot * conv(b, id, sk), text: `翻開抄本：「${sk.name}」！` };
}

/** AI: score a transcribe as an attack (base is the status skill's score) */
function copyAi(b: Battle, id: SideId, base: number, page: string | undefined, mult: number): number {
  if (!page) return -100;
  const sk = getSkill(page);
  if (!isAttackSkill(sk)) return 22 - base;
  const d = b.active(b.foe(id));
  const annot = b.active(id).vars[GM.annot] ? 1.5 : 1;
  const dmg = b.estimate(id, page) * mult * annot * conv(b, id, sk);
  const frac = dmg / Math.max(1, d.hp);
  return Math.min(1, frac) * 100 + (frac >= 1 ? 60 : 0) - base;
}

/** Multiplier of `grimoire_final_chapter`: ×1.3 when the copybook is full */
const chapterMult = (b: Battle, id: SideId): number => (pagesOf(b, id).length >= PAGES.length ? 1.3 : 1);

const GRIMOIRE_FX: Record<string, SkillHooks> = {
  transcribe: {
    // `transcribe`: casts the newest page (×0.8); cost = that skill's cost (at least 1)
    canUse: (b, id) => (pagesOf(b, id).length ? null : '抄本是空的'),
    cost: (b, id) => {
      const p = newestPage(b, id);
      return Math.max(1, p ? getSkill(p).cost : 1);
    },
    redirect: (b, id) => {
      syncPages(b, id);
      return castPage(b, id, 'transcribe', newestPage(b, id), 0.8);
    },
    aiScore: (b, id, base) => copyAi(b, id, base, newestPage(b, id), 0.8),
  },
  grimoire_page_flare: {
    // `grimoire_page_flare`: tears off the oldest page, +40 (torn as it acts: even if blocked or missed)
    power: (b, c, p) => (pagesOf(b, c.attacker).length ? p + 40 : p),
    afterUse: (b, id) => {
      const list = pagesOf(b, id);
      if (!list.length) return;
      const torn = list.pop()!;
      setPages(b, id, list);
      b.text(`撕下了「${getSkill(torn).name}」那一頁。`);
    },
  },
  grimoire_page_ward: {
    // `grimoire_page_ward`: for 3 turns, hits from skills in the copybook do −50%
    effect: (b, id) => void b.addLasting(id, 'grimoire_page_ward', 3),
    lasting: {
      name: '頁之壁',
      reduce: (b, ctx) => (pagesOf(b, ctx.defender).includes(ctx.sk.id) ? 0.5 : 0),
    },
    aiScore: (b, id) => {
      if (b.getLasting(id, 'grimoire_page_ward')) return -100;
      const attacks = pagesOf(b, id).filter((p) => isAttackSkill(getSkill(p))).length;
      return attacks ? 18 + attacks * 6 : -50;
    },
  },
  grimoire_page_storm: {
    // `grimoire_page_storm`: hits = pages + 1 (max 4)
    hits: (b, c) => Math.min(4, pagesOf(b, c.attacker).length + 1),
  },
  grimoire_burn_all: {
    // `grimoire_burn_all`: tears off every page, +50 per page
    power: (b, c, p) => p + 50 * pagesOf(b, c.attacker).length,
    afterUse: (b, id) => {
      const n = pagesOf(b, id).length;
      if (!n) return;
      setPages(b, id, []);
      b.text(`${n} 頁抄本在魔焰中化為灰燼！`);
    },
    aiScore: (b, id) => {
      const n = pagesOf(b, id).length;
      return n >= 3 ? 20 : n === 2 ? 5 : -40;
    },
  },
  grimoire_mirror_page: {
    // `grimoire_mirror_page`: when the opponent uses an attack that is in the copybook, it is negated and countered with the same skill (×0.8)
    trap: {
      on: 'foeAttack',
      when: (b, owner, ev) => pagesOf(b, owner).includes(ev.ctx.sk.id),
      fire: (b, owner, ev) => ({
        negate: true,
        after: () => b.followUp(owner, ev.ctx.sk.id, 0.8 * conv(b, owner, ev.ctx.sk), `倒寫之頁：「${ev.ctx.sk.name}」原封奉還！`),
      }),
    },
    aiScore: (b, id) => (pagesOf(b, id).some((p) => isAttackSkill(getSkill(p))) ? 40 : -100),
  },
  grimoire_annotate: {
    // `grimoire_annotate`: MAG +1 (tag); the next transcribe ×1.5
    effect: (b, id) => {
      b.active(id).vars[GM.annot] = 1;
      b.text('朱筆圈點了抄本：下一次複寫威力 ×1.5。');
    },
    aiScore: (b, id) => (b.active(id).vars[GM.annot] ? -60 : strongestPage(b, id) ? 8 : -20),
  },
  grimoire_final_chapter: {
    // `grimoire_final_chapter`: casts the highest-power attack page, cost = that skill's cost (at least 2); ×1.3 when the copybook has 3 pages
    canUse: (b, id) => (strongestPage(b, id) ? null : '抄本裡沒有攻擊頁'),
    cost: (b, id) => {
      const p = strongestPage(b, id);
      return Math.max(2, p ? getSkill(p).cost : 2);
    },
    redirect: (b, id) => {
      syncPages(b, id);
      return castPage(b, id, 'grimoire_final_chapter', strongestPage(b, id), chapterMult(b, id));
    },
    aiScore: (b, id, base) => copyAi(b, id, base, strongestPage(b, id), chapterMult(b, id)),
  },
  u_grimoire: {
    // `u_grimoire`: after it hits, casts every attack page in turn (×0.5)
    afterAttack: (b, c) => {
      for (const p of pagesOf(b, c.attacker)) {
        const sk = getSkill(p);
        if (!isAttackSkill(sk)) continue;
        if (b.s.winner !== null || b.active(c.attacker).fainted || b.active(c.defender).fainted) return;
        b.followUp(c.attacker, p, 0.5 * conv(b, c.attacker, sk), `萬象禁典：「${sk.name}」`);
      }
    },
    aiScore: (b, id) => (pagesOf(b, id).filter((p) => isAttackSkill(getSkill(p))).length >= 2 ? 20 : 0),
  },
};

const GRIMOIRE_KIT: KitHooks = {
  // Trait "Chronicle" (rewritten): on entering, copies the skill the opponent used last
  onEnter: (b, id) => {
    const d = b.active(b.foe(id));
    if (!d.fainted && d.lastSkill && recordable(d.lastSkill)) {
      b.traitEvent(id, '記述');
      record(b, id, d.lastSkill);
    }
    gmSnapshot(b, id);
  },
  onHitTaken: (b, a) => {
    record(b, a.defender, a.sk.id);
    gmSnapshot(b, a.defender);
  },
  onFoeStatusSkill: (b, id, sk) => {
    record(b, id, sk.id);
    gmSnapshot(b, id);
  },
  onEndTurn: (b, id) => syncPages(b, id),
  // One mark per page, the newest page first
  marks: (b, id) => pagesOf(b, id).map((p, i) => ({ id: `kit:page${i}`, note: `${i === 0 ? '新頁' : '抄本'}：${getSkill(p).name}` })),
};

// ═════════════════════════ `inkcat`: Ink Stains ═════════════════════════
//
// Ink stains are simply `inkcat`'s own stat drops (no separate state is stored; the mark shows the total stages). Splash-type skills stain it with the tag self.X −1;
// reversing (`inkcat_reverse_stroke`, `inkcat_dragon_eye`, `inkcat_scroll_reversal`) turns each drop into an equal rise; flinging (`inkcat_fling`, the ultimate) passes the drops to the opponent.
// Both flipping and flinging go through changeStage: a curse blocks the flip, the opponent's "stats cannot be lowered" blocks the flung ink, and a flip also counts as a stat rise (it triggers the opponent's traps that react to boosts).

const STATS: StageStat[] = ['atk', 'mag', 'def', 'res', 'spd'];
const INK = {
  /** `inkcat_ink_pool` fired this turn (reverses at end of turn) */
  pool: 'e:ink:pool',
};

/** Total ink-stain stages (the sum of its own stat drops) */
const stainsOf = (b: Battle, id: SideId): number => STATS.reduce((a, k) => a + Math.max(0, -b.active(id).stages[k]), 0);
/** Total stages of the opponent's stat rises */
const upsOf = (b: Battle, id: SideId): number => STATS.reduce((a, k) => a + Math.max(0, b.active(id).stages[k]), 0);

/** Reverse its own ink stains (−N becomes +N); trait "Ink Resonance": gain 1 aether if any flip succeeded */
function flipStains(b: Battle, id: SideId): void {
  const c = b.active(id);
  if (c.fainted) return;
  let flipped = false;
  for (const k of STATS) {
    const v = c.stages[k];
    if (v >= 0) continue;
    b.changeStage(id, k, -2 * v);
    if (c.stages[k] > v) flipped = true;
  }
  if (flipped && !c.fainted) {
    b.traitEvent(id, '墨韻');
    b.gainAether(id, 1);
  }
}

/** Fling ink: its own stat drops are zeroed, and the opponent's same stat drops by the same number of stages */
function flingStains(b: Battle, id: SideId): void {
  const c = b.active(id);
  const f = b.foe(id);
  if (c.fainted) return;
  const list = STATS.filter((k) => c.stages[k] < 0).map((k) => [k, c.stages[k]] as const);
  if (!list.length) return;
  b.text(`${c.name} 把墨漬甩了出去！`);
  for (const [k, v] of list) {
    b.changeStage(id, k, -v);
    if (!b.active(f).fainted) b.changeStage(f, k, v, true);
  }
}

/** Invert the opponent's stat rises (+N becomes −N; drops are unchanged) */
function invertUps(b: Battle, id: SideId): void {
  const f = b.foe(id);
  const d = b.active(f);
  if (d.fainted) return;
  const ups = STATS.filter((k) => d.stages[k] > 0);
  if (!ups.length) {
    b.text(`${d.name} 沒有能力提升可以塗改。`);
    return;
  }
  for (const k of ups) b.changeStage(f, k, -2 * d.stages[k], true);
}

/** Whether the opponent has a skill that raises stats (for traps and AI) */
function foeCanBuff(b: Battle, id: SideId): boolean {
  return b.active(b.foe(id)).skills.some((s) => Object.entries(findSkill(s)?.tags ?? {}).some(([k, v]) => k.startsWith('self.') && v > 0));
}

const INK_FX: Record<string, SkillHooks> = {
  inkcat_reverse_stroke: {
    canUse: (b, id) => (stainsOf(b, id) > 0 ? null : '身上沒有墨漬'),
    effect: (b, id) => flipStains(b, id),
    aiScore: (b, id) => {
      const d = b.active(b.foe(id));
      if (d.hp / d.maxHp < 0.35) return -40;
      // Flipping a MAG stain is the best value (the next hit gets stronger directly)
      const magStain = Math.max(0, -b.active(id).stages.mag);
      return Math.min(95, 22 * stainsOf(b, id) + 18 * magStain);
    },
  },
  ink_rewrite: {
    // `ink_rewrite` (overwrite): only reverses the opponent's rises; MAG +1 is settled by the tag
    effect: (b, id) => invertUps(b, id),
    aiScore: (b, id) => (upsOf(b, b.foe(id)) > 0 ? 12 * upsOf(b, b.foe(id)) : -35),
  },
  inkcat_fling: {
    canUse: (b, id) => (stainsOf(b, id) > 0 ? null : '身上沒有墨漬'),
    effect: (b, id) => flingStains(b, id),
    aiScore: (b, id) => {
      const d = b.active(b.foe(id));
      if (d.hp / d.maxHp < 0.25) return -40;
      return stainsOf(b, id) >= 2 ? 26 : 0;
    },
  },
  inkcat_dragon_eye: {
    // `inkcat_dragon_eye`: reverses the stains as it acts, and this attack is computed with the reversed MAG (the stains only actually flip after it acts, so the MAG difference is added here first)
    power: (b, c, p) => {
      const me = b.active(c.attacker);
      const s = me.stages.mag;
      if (s >= 0 || me.status.curse) return p;
      return (p * statStageMultiplier(-s)) / statStageMultiplier(s);
    },
    afterUse: (b, id) => flipStains(b, id),
    aiScore: (b, id) => 8 * stainsOf(b, id),
  },
  inkcat_ink_pool: {
    // `inkcat_ink_pool`: fires when the opponent raises stats; at end of turn it reverses the opponent's rises (after the opponent's whole action has resolved, flipped all at once; see INK_KIT.onEndTurn).
    // If the trap stays on the field after `inkcat` has switched out, it reverses immediately when it fires.
    trap: {
      on: 'foeBuff',
      fire: (b, owner) => {
        const c = b.active(owner);
        if (c.species.id === 'inkcat') {
          c.vars[INK.pool] = b.s.turn;
          b.text(`${b.active(b.foe(owner)).name} 踩進了墨池……`);
        } else invertUps(b, owner);
      },
    },
    aiScore: (b, id) => (foeCanBuff(b, id) ? 25 : -40),
  },
  inkcat_scroll_reversal: {
    canUse: (b, id) => (stainsOf(b, id) > 0 || upsOf(b, b.foe(id)) > 0 ? null : '沒有可以反轉的能力變化'),
    effect: (b, id) => {
      flipStains(b, id);
      if (upsOf(b, b.foe(id)) > 0) invertUps(b, id);
    },
    aiScore: (b, id) => 12 * stainsOf(b, id) + 12 * upsOf(b, b.foe(id)) - 10,
  },
  u_inkcat: {
    afterAttack: (b, c) => flingStains(b, c.attacker),
  },
};

const INK_KIT: KitHooks = {
  onEndTurn: (b, id) => {
    const c = b.active(id);
    if (c.vars[INK.pool] !== b.s.turn) return;
    c.vars[INK.pool] = 0;
    b.text('墨池翻了過來！');
    invertUps(b, id);
  },
  marks: (b, id) => {
    const n = stainsOf(b, id);
    return n > 0 ? [{ id: 'kit:stain', n, note: '墨漬' }] : [];
  },
};

// ═════════════════════════ `cloudfluff`: Fluff ═════════════════════════
//
// Fluff is kept on `cloudfluff` (e: prefix). When it switches out (KIT.onLeave, e: not yet cleared) the shield amount of "Warm Fluff" is recorded on `cloudfluff`,
// and at the end of the same turn the bench hook (bench.onTurnEnd) wraps the active teammate in that shield (a full-HP teammate can use it too, so nothing is wasted).

const CF = {
  fluff: 'e:cf:fluff',
  /** "Warm Fluff": the turn of the switch-out and the shield percentage (no e: prefix: it must still be readable after leaving the field) */
  handoffT: 'cf:handoffT',
  handoffPct: 'cf:handoffPct',
};
const FLUFF_MAX = 3;

const fluffOf = (b: Battle, id: SideId): number => b.active(id).vars[CF.fluff] ?? 0;
function gainFluff(b: Battle, id: SideId, n = 1): void {
  const c = b.active(id);
  if (c.fainted || fluffOf(b, id) >= FLUFF_MAX) return;
  const v = addVar(b, id, CF.fluff, n, FLUFF_MAX);
  b.text(`${c.name} 蓬了起來（蓬鬆 ${v}／${FLUFF_MAX}）`);
}
/** Puffball: spends all fluff */
function spendFluff(b: Battle, id: SideId): void {
  const n = fluffOf(b, id);
  if (n <= 0) return;
  b.active(id).vars[CF.fluff] = 0;
  b.text(`${n} 層蓬鬆揉成了絨球！`);
}
const puffball = (per: number): SkillHooks => ({
  power: (b, c, p) => p + per * fluffOf(b, c.attacker),
  afterUse: (b, id) => spendFluff(b, id),
  aiScore: (b, id) => 10 * fluffOf(b, id) - 8,
});

const CLOUD_FX: Record<string, SkillHooks> = {
  cloudfluff_hum: {
    effect: (b, id) => gainFluff(b, id),
    aiScore: (b, id) => (fluffOf(b, id) >= FLUFF_MAX ? -25 : 10),
  },
  cloudfluff_puffball: puffball(35),
  cloudfluff_big_puffball: puffball(30),
  cloudfluff_cushion: {
    // `cloudfluff_cushion`: 30% damage reduction when hit, fluff +1 (the AI sets it with the default 55% chance)
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => ({ reduce: 0.3, after: () => (b.active(owner).species.id === 'cloudfluff' ? gainFluff(b, owner) : undefined) }),
    },
  },
  cloudfluff_puff_up: {
    effect: (b, id) => gainFluff(b, id),
  },
  cloudfluff_fluff_pounce: {
    afterAttack: (b, c) => gainFluff(b, c.attacker),
    // Fluff not yet full: it would rather pounce to build up fluff than simply ram
    aiScore: (b, id) => (fluffOf(b, id) < FLUFF_MAX ? 8 : 0),
  },
  cloudfluff_roll_away: {
    // `cloudfluff_roll_away`: switches after attacking (tag); wants to roll more when it has fluff and a bench
    aiScore: (b, id) => (b.aliveBench(id).length > 0 ? 10 * fluffOf(b, id) : -10),
  },
  cloudfluff_cloud_nap: {
    effect: (b, id) => {
      const c = b.active(id);
      if (c.fainted) return;
      c.vars[CF.fluff] = FLUFF_MAX;
      b.text(`${c.name} 窩成一朵雲，蓬鬆到了極點！`);
    },
    aiScore: (b, id) => (FLUFF_MAX - fluffOf(b, id)) * 6,
  },
  cloudfluff_fluff_shield: {
    effect: (b, id) => gainFluff(b, id),
  },
};

const CLOUD_KIT: KitHooks = {
  // Trait "Warm Fluff" (rewritten): records the fluff when switching out, and at end of turn wraps the active teammate in a shield
  onLeave: (b, id, c) => {
    c.vars[CF.handoffT] = b.s.turn;
    c.vars[CF.handoffPct] = 10 + 5 * (c.vars[CF.fluff] ?? 0);
  },
  bench: {
    onTurnEnd: (b, side, self) => {
      const m = b.side(side).team[self];
      if (m.vars[CF.handoffT] !== b.s.turn) return;
      m.vars[CF.handoffT] = -1;
      const ally = b.active(side);
      if (ally.fainted) return;
      b.traitEvent(side, '暖絨');
      b.text(`${m.name} 把一身蓬鬆裹在 ${ally.name} 身上。`);
      b.giveShield(side, m.vars[CF.handoffPct] ?? 10);
    },
  },
  marks: (b, id) => {
    const n = fluffOf(b, id);
    return n > 0 ? [{ id: 'kit:fluff', n, note: '蓬鬆' }] : [];
  },
};

// ═════════════════════════ `clockmouse`: Clockwork ═════════════════════════

const CM = {
  spring: 'e:cm:spring',
  /** Used a release attack this turn (the trait "Wind-Up" does not wind) */
  usedT: 'e:cm:usedT',
};
const SPRING_MAX = 3;

const springOf = (b: Battle, id: SideId): number => b.active(id).vars[CM.spring] ?? 0;
function setSpring(b: Battle, id: SideId, n: number): void {
  b.active(id).vars[CM.spring] = Math.max(0, Math.min(SPRING_MAX, n));
}
/** Release attack: +1 priority when it has winds; winds −1 after it acts (all: reset to zero) */
function release(all = false): SkillHooks {
  return {
    priority: (b, id) => (springOf(b, id) > 0 ? 1 : 0),
    afterUse: (b, id) => {
      const c = b.active(id);
      c.vars[CM.usedT] = b.s.turn;
      const n = springOf(b, id);
      if (n <= 0) return;
      setSpring(b, id, all ? 0 : n - 1);
      if (springOf(b, id) === 0) b.text(`${c.name} 的發條停擺了。`);
    },
  };
}
function windScore(b: Battle, id: SideId): number {
  const n = springOf(b, id);
  return n === 0 ? 35 : n === 1 ? 12 : -40;
}

const CLOCK_FX: Record<string, SkillHooks> = {
  clockmouse_gear_bite: release(),
  windup_dash: release(),
  clockmouse_full_gear: release(),
  clockmouse_chain_release: {
    ...release(true),
    hits: (b, c) => Math.min(4, springOf(b, c.attacker) + 1),
  },
  u_clockmouse: {
    ...release(true),
    power: (b, c, p) => p + 20 * springOf(b, c.attacker),
  },
  clockmouse_rewind: {
    afterAttack: (b, c) => {
      if (springOf(b, c.attacker) >= SPRING_MAX) return;
      setSpring(b, c.attacker, springOf(b, c.attacker) + 1);
      b.text(`${b.active(c.attacker).name} 倒轉齒輪，上緊了一圈（發條 ${springOf(b, c.attacker)}）`);
    },
    aiScore: (b, id) => (springOf(b, id) <= 1 ? 10 : -5),
  },
  clockmouse_wind_up: {
    effect: (b, id) => {
      setSpring(b, id, SPRING_MAX);
      b.text(`${b.active(id).name} 把發條上滿了！`);
    },
    aiScore: windScore,
  },
  clockmouse_mainspring: {
    effect: (b, id) => {
      setSpring(b, id, SPRING_MAX);
      b.text(`${b.active(id).name} 上緊了主發條！`);
    },
    aiScore: (b, id) => windScore(b, id) + 10,
  },
  clockmouse_gear_jam: {
    aiScore: (b, id) => {
      const last = b.active(b.foe(id)).lastSkill;
      return last && findSkill(last)?.category !== 'status' ? 12 : -20;
    },
  },
  clockmouse_mousetrap: {
    // `clockmouse_mousetrap`: when the opponent's spirit enters the field, attacks with `clockmouse_gear_bite` (×1.5); the follow-up attack does not spend winds
    trap: {
      on: 'foeEnter',
      fire: (b, owner) => ({ after: () => b.followUp(owner, 'clockmouse_gear_bite', 1.5, '鼠夾啪地夾住了！') }),
    },
    aiScore: (b, id) => (b.aliveBench(b.foe(id)).length > 0 ? 20 : -60),
  },
};

const CLOCK_KIT: KitHooks = {
  onEnter: (b, id) => setSpring(b, id, SPRING_MAX),
  // Trait "Wind-Up" (rewritten): if it used no release attack this turn, winds +1 at end of turn
  onEndTurn: (b, id) => {
    const c = b.active(id);
    if (c.vars[CM.usedT] === b.s.turn || springOf(b, id) >= SPRING_MAX) return;
    setSpring(b, id, springOf(b, id) + 1);
    b.traitEvent(id, '上發條');
  },
  marks: (b, id) => {
    const n = springOf(b, id);
    return [{ id: 'kit:spring', n, note: n > 0 ? '發條' : '停擺' }];
  },
};

export const FX: Record<string, SkillHooks> = { ...ELDARIN_FX, ...RELIC_FX, ...GRIMOIRE_FX, ...INK_FX, ...CLOUD_FX, ...CLOCK_FX };

/** Spirit id → kit hooks (signature mechanics, rewritten traits, state marks) */
export const KIT: Record<string, KitHooks> = {
  eldarin: ELDARIN_KIT,
  relic_blade: RELIC_KIT,
  grimoire: GRIMOIRE_KIT,
  inkcat: INK_KIT,
  cloudfluff: CLOUD_KIT,
  clockmouse: CLOCK_KIT,
};
