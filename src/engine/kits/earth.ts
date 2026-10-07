// Skill hooks and kit hooks for the earth group (data/kits/earth.json). See docs/10-kit-authoring.md for how to write them.
// Only `import type { Battle }` is allowed (importing battle.ts at runtime would create a circular dependency).

import { getSkill } from '../../data.ts';
import type { SkillDef } from '../../../sim/types.ts';
import type { Battle } from '../battle.ts';
import type { KitHooks, LastingState, SkillHooks } from '../skillfx.ts';
import { getVar, isAttack } from '../skillfx.ts';
import type { SideId } from '../types.ts';

// ───────────────────────── `terragon`: Strata ─────────────────────────
// Strata (0 to 3, reset to zero on leaving): with strata, each hit of an attack does at most 25% of max HP; the hit that was reduced shatters 1 stratum.
// "Collapse" = spends all the strata for power or healing. While `terragon_bedrock`'s lasting effect is on, strata are not shattered.
// Trait "Immovable Mountain": on entering, sets Sandstorm and gains 1 stratum; under Sandstorm, +1 stratum at the end of each turn. During `terragon_kingdom`, the opponent takes 8% damage for every stratum lost.

const TER = 'terragon';
const STRATA = 'e:ter:strata';
const STRATA_MAX = 3;
/** With strata, the cap on single-hit damage (a fraction of max HP) */
const STRATA_CAP = 0.25;
/** `terragon_backlash`: the damage this attack had reduced is to be reflected */
const BACKLASH = 'e:ter:backlash';
const EXCESS = 'e:ter:excess';
/** `terragon_kingdom`: strata shattered during an attack; the attacker takes damage only after the attack resolves (onHitTaken) */
const BROKEN = 'e:ter:broken';
const KINGDOM = 'terragon_kingdom';
const KINGDOM_PCT = 8;

const strata = (b: Battle, id: SideId): number => getVar(b, id, STRATA);
const isTerragon = (b: Battle, id: SideId): boolean => b.active(id).species.id === TER && !b.active(id).fainted;

/** Gains n strata (only `terragon` has strata) */
function addStrata(b: Battle, id: SideId, n: number): void {
  if (!isTerragon(b, id) || n <= 0) return;
  const c = b.active(id);
  const before = c.vars[STRATA] ?? 0;
  const after = Math.min(STRATA_MAX, before + n);
  if (after === before) return;
  c.vars[STRATA] = after;
  b.text(`${c.name} 堆起了岩層（${after} 層）`);
}

/** `terragon_kingdom`: when n strata are lost, the opponent takes 8% damage per stratum */
function kingdomStrike(b: Battle, id: SideId, n: number): void {
  const f = b.foe(id);
  if (n <= 0 || !b.getLasting(id, KINGDOM) || b.active(f).fainted || b.s.winner !== null) return;
  b.text(`磐心王國的矮人擲下了落石！`);
  b.trueDamage(f, KINGDOM_PCT * n, 'kingdom');
}

/** Collapse: spends all the strata and returns the number spent */
function collapse(b: Battle, id: SideId): number {
  const c = b.active(id);
  const n = c.vars[STRATA] ?? 0;
  if (n > 0) {
    c.vars[STRATA] = 0;
    b.text(`${c.name} 的 ${n} 層岩層崩落了！`);
    kingdomStrike(b, id, n);
  }
  return n;
}

/** Collapse-type attack: +per power per stratum, and all the strata are spent after the attack (read-only when estimating) */
const collapsePower = (per: number): Pick<SkillHooks, 'power' | 'afterAttack'> => ({
  power: (b, c, p) => p + per * strata(b, c.attacker),
  afterAttack: (b, c) => void collapse(b, c.attacker),
});

// ───────────────────────── `chronodragon`: Time Seal ─────────────────────────
// A Time Seal is a lasting effect on the opponent's side (key = `sand_prophecy`), n = stacks, turns = countdown.
// It comes due at the end of the turn where the countdown is 1 (10% of max HP per stack); if the opponent is guarding when it comes due, it is blocked and shatters.

const SEAL = 'sand_prophecy';
const SEAL_MAX = 5;
const SEAL_PCT = 10;
/** A freshly engraved Time Seal: comes due at the end of the turn 2 turns later (the countdown includes this turn) */
const SEAL_TURNS = 3;
const LOOP = 'chronodragon_eternal_return';

/** The Time Seal engraved on side's own side */
const sealOn = (b: Battle, side: SideId): LastingState | undefined => b.side(side).lasting.find((l) => l.key === SEAL);
/** Stacks of the Time Seal that `chronodragon` (id) engraved on the opponent's side */
const sealLayers = (b: Battle, id: SideId): number => sealOn(b, b.foe(id))?.n ?? 0;

/** Time Seal +n stacks: engraves a new Time Seal when there is none (countdown of 2 turns); adding stacks does not reset the countdown */
function addSeal(b: Battle, id: SideId, n: number): void {
  const f = b.foe(id);
  const s = sealOn(b, f);
  if (s) {
    const before = s.n;
    s.n = Math.min(SEAL_MAX, s.n + n);
    if (s.n > before) b.text(`時印 +${s.n - before} 層（${s.n} 層，${s.turns} 回合後應驗）`);
    return;
  }
  b.addLasting(f, SEAL, SEAL_TURNS, { n: Math.min(SEAL_MAX, n), side: true, from: id });
}

/** Time Seal countdown +/-delta; when it reaches zero it comes due at once */
function shiftSeal(b: Battle, id: SideId, delta: number): void {
  const f = b.foe(id);
  const s = sealOn(b, f);
  if (!s || delta === 0) return;
  s.turns += delta;
  if (s.turns <= 0) {
    detonate(b, f, 1);
    return;
  }
  b.text(delta < 0 ? `時間加速：時印剩 ${s.turns} 回合應驗` : `時間延宕：時印延後到 ${s.turns} 回合後應驗`);
}

/**
 * Comes due: the Time Seal on side's own side deals 10% x mult per stack to the active spirit, then disappears.
 * When the active spirit has fainted the Time Seal is kept (the next spirit sent in takes it); if it is guarding, it is blocked and shatters.
 * During `chronodragon_eternal_return`, after it comes due it is engraved again at half the stacks.
 */
function detonate(b: Battle, side: SideId, mult: number): void {
  const s = sealOn(b, side);
  const d = b.active(side);
  if (!s || d.fainted) return;
  b.removeLasting(side, SEAL);
  if (d.guarding) {
    b.text(`${d.name} 的格擋擋下了應驗，時印碎裂了！`);
    return;
  }
  b.text(`預言應驗了！（時印 ${s.n} 層${mult !== 1 ? ` × ${mult}` : ''}）`);
  b.trueDamage(side, Math.round(s.n * SEAL_PCT * mult), 'prophecy');
  const from = s.from;
  if (b.s.winner === null && b.getLasting(from, LOOP)) {
    const n = Math.max(1, Math.floor(s.n / 2));
    b.text('永劫回歸：預言再次刻下。');
    b.addLasting(side, SEAL, SEAL_TURNS, { n, side: true, from });
  }
}

/** When the opponent's active spirit faints, a Time Seal due this turn is carried to the next spirit (the countdown stays at 1) */
function carrySeal(b: Battle, id: SideId): void {
  const f = b.foe(id);
  const s = sealOn(b, f);
  if (s && s.turns <= 1 && b.active(f).fainted && b.aliveBench(f).length > 0) s.turns = 2;
}

// ───────────────────────── `sand_reaper`: Deep Burial ─────────────────────────
// A trap set by `sand_reaper` is buried 1 level deep the moment it is set, and while `sand_reaper` is active each turn end gives +1 (max 3). When the trap fires it deals 6% per level ("Sand Pincer");
// "Flip Sand" skills uncover an already buried trap (destroy it without firing), and each level raises power. Burial resets to zero when the trap leaves the trap slot.
// Burial is stored in a side's vars together with the trap's set turn (+1); when the trap slot holds a different card it is recounted.

const SR_TRAPS = ['sand_reaper_scythe_pit', 'sand_reaper_throat_snare'];
const DEPTH = 'sr:depth';
/** The set turn + 1 of the trap that the burial belongs to */
const DEPTH_AT = 'sr:depthAt';
/** `u_sand_reaper`: the next trap is buried 3 levels deep at once */
const PRIMED = 'sr:primed';
/** Burial recorded before the trap fires (when); by the time it fires (fire) the trap has already left the trap slot */
const PENDING = 'sr:pending';
/** The turn our trap fired + 1 (`sand_reaper_reaping_counter`) */
const FIRED = 'sr:fired';
const DEPTH_MAX = 3;
const PINCER_PCT = 6;

/** The trap slot holds a `sand_reaper` trap */
const srTrap = (b: Battle, id: SideId) => {
  const t = b.side(id).trap;
  return t && SR_TRAPS.includes(t.skillId) ? t : null;
};
/** The burial a newly set trap starts with: 1 level (3 levels for the first one after `u_sand_reaper`) */
const baseDepth = (b: Battle, id: SideId): number => (b.side(id).vars[PRIMED] ? DEPTH_MAX : 1);
/** Current burial of our trap (0 when there is no `sand_reaper` trap; read-only) */
function depthOf(b: Battle, id: SideId): number {
  const t = srTrap(b, id);
  const v = b.side(id).vars;
  if (!t) return 0;
  if (v[DEPTH_AT] !== t.setTurn + 1) return baseDepth(b, id);
  return v[DEPTH] ?? 0;
}
/** Burial +n (when the trap slot holds a new card, first count from the burial at the time it was set) */
function addDepth(b: Battle, id: SideId, n: number): void {
  const t = srTrap(b, id);
  if (!t) return;
  const v = b.side(id).vars;
  if (v[DEPTH_AT] !== t.setTurn + 1) {
    v[DEPTH] = baseDepth(b, id);
    v[DEPTH_AT] = t.setTurn + 1;
    delete v[PRIMED];
  }
  const before = v[DEPTH] ?? 0;
  v[DEPTH] = Math.min(DEPTH_MAX, before + n);
  if (v[DEPTH] > before) b.text(`沙下的伏技埋得更深了（深埋 ${v[DEPTH]} 層）`);
}
function clearDepth(b: Battle, id: SideId): void {
  const v = b.side(id).vars;
  delete v[DEPTH];
  delete v[DEPTH_AT];
  delete v[PENDING];
}
/** A trap's when: records the burial before it fires (by fire the trap has left the trap slot) */
const snapDepth = (b: Battle, owner: SideId): boolean => {
  b.side(owner).vars[PENDING] = depthOf(b, owner);
  return true;
};
/** Sand Pincer: when the trap fires, each level of burial deals 6% damage to the opponent */
function pincer(b: Battle, owner: SideId): void {
  const n = b.side(owner).vars[PENDING] ?? 0;
  clearDepth(b, owner);
  const f = b.foe(owner);
  if (n <= 0 || b.active(f).fainted || b.s.winner !== null) return;
  b.text(`沙鉗從沙底夾住了 ${b.active(f).name}！（深埋 ${n} 層）`);
  b.trueDamage(f, PINCER_PCT * n, 'pincer');
}
/** Flip Sand: uncovers the buried trap (destroys it without firing) and returns the burial level */
function flip(b: Battle, id: SideId): number {
  const n = depthOf(b, id);
  if (n <= 0) return 0;
  b.text(`${b.active(id).name} 掀開了深埋 ${n} 層的伏技！`);
  b.destroyTrap(id);
  clearDepth(b, id);
  return n;
}
/** Flip-Sand attack: +per power per level of burial (read-only when estimating), and uncovers the trap after hitting */
const flipPower = (per: number): Pick<SkillHooks, 'power' | 'afterAttack'> => ({
  power: (b, c, p) => p + per * depthOf(b, c.attacker),
  afterAttack: (b, c) => void flip(b, c.attacker),
});
/** AI for Flip-Sand skills: prefer flipping at 2 or more levels of burial; at only 1 level, evaluate as an ordinary attack (damage first in short fights) */
const flipScore = (hi: number) => (b: Battle, id: SideId) => {
  const n = depthOf(b, id);
  return n >= 2 ? hi : n === 1 ? 0 : -8;
};

// ───────────────────────── `sandserpent`: Sinking ─────────────────────────
// Sinking is a lasting effect on the opponent (key = `sandserpent_quicksand_vortex`), n = stacks (max 3), 3 turns, refreshed when the serpent makes it sink again.
// A sinking spirit "struggles" when it takes an action that costs aether (a skill or guard): 3% of max HP per stack, then Sinking +1.
// `sandserpent_seven_pillars`: a lasting effect on the opponent; after the turn the pillars go up, a sinking opponent cannot use skills costing 4 or more, nor ultimates.

const SINK = 'sandserpent_quicksand_vortex';
const SINK_MAX = 3;
const SINK_TURNS = 3;
const STRUGGLE_PCT = 3;
const PILLARS = 'sandserpent_seven_pillars';
/** The seven pillars are up (the block starts only after the turn they go up; e: prefix, cleared on leaving) */
const PILLARS_UP = 'e:ssp:pillars';
/** Cost of guard (GUARD_COST in battle.ts; battle.ts cannot be imported at runtime here) */
const GUARD_AE = 1;

/** The Sinking of the opponent (b.foe(id)) */
const sinkOn = (b: Battle, id: SideId): LastingState | undefined => b.active(b.foe(id)).lasting.find((l) => l.key === SINK);
const sinkLayers = (b: Battle, id: SideId): number => sinkOn(b, id)?.n ?? 0;

/** Sinking +n on the opponent (refreshed to 3 turns); set = becomes exactly n stacks */
function addSink(b: Battle, id: SideId, n: number, set = false): void {
  const f = b.foe(id);
  const d = b.active(f);
  if (d.fainted || n <= 0) return;
  const before = sinkOn(b, id)?.n ?? 0;
  const after = Math.min(SINK_MAX, set ? Math.max(before, n) : before + n);
  b.addLasting(f, SINK, SINK_TURNS, { n: after, from: id });
  if (after > before) b.text(`${d.name} 陷進了流沙（陷沒 ${after} 層）`);
}

/** The aether the holder's action costs this time (the release after a charge costs none) */
function spendOf(b: Battle, owner: SideId, sk: SkillDef): number {
  const c = b.active(owner);
  if (sk.id === 'guard') return GUARD_AE;
  if (c.charging === sk.id) return 0;
  return b.costFor(owner, sk);
}

// ───────────────────────── `rhino`: Gallop ─────────────────────────
// Gallop (0 to 3, e: prefix, resets to zero on leaving): built up by "run-up" skills, and each stack gives physical damage +8% (KIT.attackBonus). A "Ram" does not spend Gallop,
// it only charges forward. 3 stacks is "full speed": "Ram" skills ignore guard (pierceGuard), and after a full-speed Ram hits, Gallop -1 (slowing down).
// `rhino_paw_ground` can only start from 0 stacks (straight to full speed); to get back to full speed after slowing down, use run-up physical skills at the risk of hitting the wall, or top up with `rhino_head_shake` / `rhino_heavy_step`.
// Wall Crash: below full speed, a physical skill is guarded -> Gallop resets to zero, with 8% recoil per stack. Stopping: no physical skill or run-up status skill was used this turn -> resets to zero.
// Both are decided in KIT.rhino.onEndTurn (modeled on `griffin`: usedAttackThisTurn && the opponent is guarding, and the exclusive physical skill did not land this turn).

const RHINO = 'rhino';
const MOM = 'e:rhino:mom';
/** A run-up status skill was used this turn (stores the turn number) */
const RAN = 'e:rhino:ran';
/** This turn's exclusive physical skill landed (not guarded; stores the turn number) */
const LANDED = 'e:rhino:landed';
const MOM_MAX = 3;
const MOM_DMG = 0.08;
const CRASH_PCT = 8;
/** Cost of the ultimate (ULT_COST in battle.ts; battle.ts cannot be imported at runtime here) */
const ULT_AE = 5;

const mom = (b: Battle, id: SideId): number => getVar(b, id, MOM);
const fullSpeed = (b: Battle, id: SideId): boolean => mom(b, id) >= MOM_MAX;

/** Gallop becomes n stacks (only `rhino` has Gallop) */
function setMom(b: Battle, id: SideId, n: number): void {
  const c = b.active(id);
  if (c.species.id !== RHINO || c.fainted) return;
  const before = c.vars[MOM] ?? 0;
  const after = Math.max(0, Math.min(MOM_MAX, n));
  if (after <= before) return;
  c.vars[MOM] = after;
  b.text(after === MOM_MAX ? `${c.name} 全速衝刺！（奔勢 ${after} 層）` : `${c.name} 越跑越猛（奔勢 ${after} 層）`);
}
const addMom = (b: Battle, id: SideId, n: number): void => setMom(b, id, mom(b, id) + n);

/** After an exclusive physical skill lands: records "not guarded this turn" */
const landed = (b: Battle, id: SideId): void => {
  b.active(id).vars[LANDED] = b.s.turn;
};

/** Run-up physical skill: Gallop +n on hit */
const runHit = (n: number): Pick<SkillHooks, 'afterAttack'> => ({
  afterAttack: (b, c, r) => {
    landed(b, c.attacker);
    if (!r.decoyBlocked) addMom(b, c.attacker, n);
  },
});

/** Run-up status skill: Gallop +n, and records that it ran this turn (so it does not stop) */
const runStep =
  (n: number) =>
  (b: Battle, id: SideId): void => {
    b.active(id).vars[RAN] = b.s.turn;
    addMom(b, id, n);
  };

/** Slows down after a full-speed Ram hits: Gallop -1 */
function decelerate(b: Battle, id: SideId): void {
  const c = b.active(id);
  if (c.fainted || (c.vars[MOM] ?? 0) < MOM_MAX) return;
  c.vars[MOM] = MOM_MAX - 1;
  b.text(`${c.name} 撞穿了過去，速度慢了下來（奔勢 ${MOM_MAX - 1} 層）`);
}

/** Ram: at full speed +bonus power and ignores guard; after a full-speed hit Gallop -1 */
const ram = (bonus: number): Pick<SkillHooks, 'power' | 'pierceGuard' | 'afterAttack'> => ({
  power: (b, c, p) => p + (fullSpeed(b, c.attacker) ? bonus : 0),
  pierceGuard: (b, id) => fullSpeed(b, id),
  afterAttack: (b, c) => {
    landed(b, c.attacker);
    decelerate(b, c.attacker);
  },
});

// ── `rhino`'s guessing game over guarding ──
// At 1 to 2 stacks of Gallop (or with the ultimate fully charged), guarding or not is a mutual guess: the opponent guards -> `rhino` hits the wall; `rhino` uses `rhino_paw_ground` / `rhino_ironhoof` -> the guard is wasted.
// Both AIs use a mixed strategy, otherwise the fixed side would be read completely by the other:
// aiFoeGuard pulls the opponent's guard score to "about the same as its best attack", then adds a tilt and a +/-25 coin flip;
// each turn `rhino` guesses whether the opponent will guard with probability "50% + tilt" (rhinoFoeGuards).

/** Base score of the opponent AI's guard evaluation (same as ai.ts: ultimate threat 55, can KO 38, sixty percent 24, otherwise 12) */
function foeGuardBase(b: Battle, id: SideId): number {
  const me = b.active(id);
  const d = b.active(b.foe(id));
  const sd = b.side(id);
  const ultReady = !!me.ultimate && !sd.ultUsed;
  if (ultReady && sd.aether >= ULT_AE) return 55;
  let big = 0;
  for (const s of me.skills) if (isAttack(getSkill(s)) && b.canUse(id, s).ok) big = Math.max(big, b.estimate(id, s));
  return big >= d.hp ? 38 : big >= d.hp * 0.6 ? 24 : 12;
}

/** The opponent's best attack score (same as ai.ts: damage ratio x100, KO +60, -3 per point of cost) */
function foeAttackScore(b: Battle, id: SideId): number {
  const f = b.foe(id);
  const me = b.active(id);
  let best = 0;
  for (const s of b.active(f).skills) {
    const sk = getSkill(s);
    if (!isAttack(sk) || !b.canUse(f, s).ok) continue;
    const frac = b.estimate(f, s) / Math.max(1, me.hp);
    best = Math.max(best, Math.min(1, frac) * 100 + (frac >= 1 ? 60 : 0) - b.costFor(f, sk) * 3);
  }
  return best;
}

/** This turn a run-up status skill can go straight to full speed (`rhino_head_shake`, `rhino_heavy_step`; `rhino_paw_ground` can only start from 0 stacks): then `rhino` need not risk the wall crash, and a guard would only be wasted */
function statusRunToFull(b: Battle, id: SideId): boolean {
  const n = mom(b, id);
  const me = b.active(id);
  const run = (s: string, gain: number) => me.skills.includes(s) && n + gain >= MOM_MAX && b.canUse(id, s).ok;
  return run('rhino_head_shake', 1) || run('rhino_heavy_step', 1);
}

/** In the guessing game: Gallop at 1 to 2 stacks (or 0 stacks with the ultimate fully charged), and `rhino` has no safe way to reach full speed with a status skill */
function rhinoMindGame(b: Battle, id: SideId): boolean {
  const n = mom(b, id);
  const sd = b.side(id);
  const ultThreat = !!b.active(id).ultimate && !sd.ultUsed && sd.aether >= ULT_AE;
  return b.canGuard(b.foe(id)).ok && n < MOM_MAX && (n > 0 || ultThreat) && !statusRunToFull(b, id);
}

/** Tilt of guarding: the more Gallop, the more the wall crash hurts (+5 per stack); when `rhino` can use `rhino_ironhoof`, a guard may get broken instead (-10) */
function rhinoGuardTilt(b: Battle, id: SideId): number {
  const n = mom(b, id);
  const me = b.active(id);
  const breach = me.skills.includes('rhino_ironhoof') && b.canUse(id, 'rhino_ironhoof').ok;
  return 5 * n - (breach ? 10 : 0);
}

/** The opponent AI's guard bonus: -30 at full speed (the Ram breaks through a guard); -20 when `rhino` can reach full speed with a status skill (the guard is wasted); in the guessing game, pulled to about the same as the attack, then add the tilt and the coin flip */
function rhinoFoeGuardRoll(b: Battle, id: SideId): number {
  if (fullSpeed(b, id)) return -30;
  if (statusRunToFull(b, id) && mom(b, id) > 0) return -20;
  if (!rhinoMindGame(b, id)) return 0;
  return foeAttackScore(b, id) - foeGuardBase(b, id) + 3 + rhinoGuardTilt(b, id) + (b.rng() - 0.5) * 50;
}

/** `rhino`'s "read" this turn (guessed once per turn and stored so every skill's score is consistent; e: prefix, cleared on leaving) */
const READ_AT = 'e:rhino:readAt';
const READ = 'e:rhino:read';

/**
 * `rhino`'s AI: guesses whether the opponent will guard this turn (only in the guessing game).
 * `rhino` also uses a mixed strategy: it guesses the opponent will guard with probability "50% + tilt", rolled once per turn.
 */
function rhinoFoeGuards(b: Battle, id: SideId): boolean {
  if (!rhinoMindGame(b, id)) return false;
  const c = b.active(id);
  const t = b.s.turn;
  if (c.vars[READ_AT] !== t + 1) {
    c.vars[READ_AT] = t + 1;
    c.vars[READ] = b.rng() < 0.5 + rhinoGuardTilt(b, id) / 50 ? 1 : 0;
  }
  return c.vars[READ] === 1;
}

/** AI for run-up physical skills: preferred below full speed (accelerating while attacking); do not ram into it when the opponent is about to guard */
const runHitScore =
  (full: number) =>
  (b: Battle, id: SideId, base: number): number => {
    if (fullSpeed(b, id)) return full;
    return rhinoFoeGuards(b, id) ? -Math.max(35, base) : 12;
  };

/** AI for Ram: ram only at full speed (ignores guard, much more power); below full speed, do not hit the wall when the opponent is about to guard (even if the estimate says it can KO) */
const ramScore =
  (full: number) =>
  (b: Battle, id: SideId, base: number): number => {
    const n = mom(b, id);
    if (n >= MOM_MAX) return full;
    if (rhinoFoeGuards(b, id)) return -Math.max(40, base);
    return n === 0 ? -20 : -10;
  };

/** Whether the current attack can KO the opponent (if so there is no need to run up) */
function canFinish(b: Battle, id: SideId): boolean {
  const hp = b.active(b.foe(id)).hp;
  return b.active(id).skills.some((s) => isAttack(getSkill(s)) && b.canUse(id, s).ok && b.estimate(id, s) >= hp);
}

/** AI for run-up status skills (gain = the Gallop this skill gives): run when this step reaches full speed; fool the guard when the opponent is about to guard; unnecessary at full speed */
const runStepScore =
  (gain: number, lo: number) =>
  (b: Battle, id: SideId): number => {
    const n = mom(b, id);
    if (n >= MOM_MAX) return -40;
    if (canFinish(b, id)) return -20;
    if (rhinoFoeGuards(b, id)) return 45;
    if (n + gain >= MOM_MAX) return 40;
    return n === 0 ? lo : 0;
  };

// ───────────────────────── `monolith`: Stone Oath ─────────────────────────
// Stone Oath (e: prefix, disappears on leaving; at most 1): set by [Swear] skills. When `monolith` takes lethal attack damage with HP at or above 30%,
// it keeps 1 HP instead and the Stone Oath shatters (KIT.monolith.incoming; each hit is judged separately, so multi-hit attacks can break through).
// At full HP the old trait "Firm Stone" (battle.ts) blocks first and the Stone Oath is kept. `body_press`: power +40 after being attacked this turn (KIT.onHitTaken records the turn).

const MONO = 'monolith';
const VOW = 'e:mono:vow';
const VOW_MIN = 0.3;
/** Hit by an attack this turn (stores the turn number) */
const MONO_HIT = 'e:mono:hit';
const PRESS_BONUS = 30;

const hasVow = (b: Battle, id: SideId): boolean => getVar(b, id, VOW) > 0;

/** [Swear]: sets the Stone Oath (does not stack when one exists) */
function swear(b: Battle, id: SideId): void {
  const c = b.active(id);
  if (c.species.id !== MONO || c.fainted || c.vars[VOW]) return;
  c.vars[VOW] = 1;
  b.text(`${c.name} 立下了「石誓」！`);
}

/** AI for the Stone Oath: only worth setting when there is none and HP is still at or above 30% (at full HP Firm Stone is there, slightly less valuable) */
function vowScore(b: Battle, id: SideId, fresh: number): number {
  const c = b.active(id);
  if (hasVow(b, id)) return -20;
  if (c.hp < c.maxHp * VOW_MIN) return -25;
  return c.hp < c.maxHp ? fresh : fresh / 2;
}

// ───────────────────────── `digmole`: Surfacing ─────────────────────────
// "Burrow" skills (charge + dig tags, handled by the engine): on the turn of use it burrows underground, and on the next turn it surfaces to strike.
// Whiff: while `digmole` is underground the opponent's attacks miss. Judged at the end of the turn (the opponent attacked this turn, `digmole` was not hit, and it is still underground),
// it records WHIFF; if the opponent moves first before the surfacing strike and misses, that counts as one too. The next surfacing has power x1.5 and ignores guard, and is cleared after hitting.
// Opponent AI: when `digmole` is underground and has not whiffed yet, guarding against the surfacing is correct; once it has whiffed, guarding is wasted (aiFoeGuard).

const MOLE = 'digmole';
const WHIFF = 'e:mole:whiff';
/** Hit by an attack this turn (stores the turn number) */
const MOLE_HIT = 'e:mole:hit';
const WHIFF_MULT = 1.5;
const BURST_AE = 2;

/** The opponent has whiffed: recorded earlier, or this turn the opponent moved first before the surfacing and its attack missed */
function whiffed(b: Battle, id: SideId): boolean {
  const me = b.active(id);
  if (me.vars[WHIFF]) return true;
  const f = b.foe(id);
  return b.hasActed(f) && b.active(f).usedAttackThisTurn && me.vars[MOLE_HIT] !== b.s.turn;
}

/**
 * When the opponent uses sk, whether `digmole` will surface first (surfacing is priority 0: the opponent has negative priority, or at equal priority `digmole` is faster).
 * For b.estimate: when `digmole` surfaces first, the opponent's attack this turn lands. The AI should not treat an underground `digmole` as untouchable for the whole turn.
 * (Rare cases such as reversed action order are ignored)
 */
function emergesFirst(b: Battle, holder: SideId, sk: SkillDef): boolean {
  if (sk.priority !== 0) return sk.priority < 0;
  const f = b.foe(holder);
  return b.effStat(b.active(holder), 'spd', holder) > b.effStat(b.active(f), 'spd', f);
}

/** Surfacing: with a whiff, power x1.5 and ignores guard; the whiff is cleared after hitting (`digmole_crystal_burst` also returns aether) */
const burst = (ae = 0): Pick<SkillHooks, 'power' | 'pierceGuard' | 'afterAttack' | 'emergesFirst'> => ({
  emergesFirst,
  power: (b, c, p) => (whiffed(b, c.attacker) ? p * WHIFF_MULT : p),
  pierceGuard: (b, id) => whiffed(b, id),
  afterAttack: (b, c) => {
    const me = b.active(c.attacker);
    const w = whiffed(b, c.attacker);
    delete me.vars[WHIFF];
    if (w && ae > 0 && !me.fainted) {
      b.text(`${me.name} 從撲空的坑裡挖出了晶礦！`);
      b.gainAether(c.attacker, ae);
    }
  },
});

/** AI for burrowing: dig only when faster than the opponent (only then does the opponent, having already decided to attack, whiff); dig even more when the opponent's ultimate is charged (+35); when slower, digging only takes the hit first and then gets guarded */
const digScore =
  (hi: number) =>
  (b: Battle, id: SideId): number => {
    const f = b.foe(id);
    const fsd = b.side(f);
    const foe = b.active(f);
    const me = b.active(id);
    if (b.effStat(me, 'spd', id) <= b.effStat(foe, 'spd', f)) return -15;
    if (foe.ultimate && !fsd.ultUsed && fsd.aether >= ULT_AE) return 35;
    return 10 + hi;
  };

const DIG_SKILLS = ['dig_strike', 'digmole_upturn', 'digmole_crystal_burst', 'u_digmole'];

/** `digmole` can burrow this turn: it is faster than the opponent (the opponent's attack will miss), and has a usable burrow skill */
function moleCanDig(b: Battle, id: SideId): boolean {
  const me = b.active(id);
  const f = b.foe(id);
  if (me.charging || b.effStat(me, 'spd', id) <= b.effStat(b.active(f), 'spd', f)) return false;
  return DIG_SKILLS.some((s) => (me.skills.includes(s) || me.ultimate === s) && b.canUse(id, s).ok);
}

/**
 * The opponent AI's guard bonus:
 * `digmole` underground and not yet whiffed -> guard the surfacing (+20); already whiffed -> the surfacing ignores guard (-30).
 * When `digmole` may burrow this turn it is a guessing game: attacks will whiff, and a guard can block its ordinary attacks.
 * The opponent answers with a mixed strategy (as with `rhino`: the guard score pulled to about the best attack, plus a +/-25 coin flip), otherwise it would keep sending attacks into the ground to whiff.
 */
function moleFoeGuard(b: Battle, id: SideId): number {
  const me = b.active(id);
  if (me.charging && me.hidden) return me.vars[WHIFF] ? -30 : 20;
  if (!moleCanDig(b, id)) return 0;
  return foeAttackScore(b, id) - foeGuardBase(b, id) + 3 + (b.rng() - 0.5) * 50;
}

// ───────────────────────── `gargoyle`: Stone Veins ─────────────────────────
// Stone Veins = the number of SPD drop stages on the opponent's active spirit (0 to 4, shown on `gargoyle`; they vanish when the opponent switches). `gargoyle` engraves 1 on entering and at the end of each turn (KIT).
// "Crack" skills add power for each vein and shatter all the veins after hitting: the opponent's SPD drop resets to zero (written back as 0 directly, curse cannot stop it).

const GARG = 'gargoyle';

const veins = (b: Battle, id: SideId): number => Math.max(0, -b.active(b.foe(id)).stages.spd);

/** Shatters the veins: the opponent's SPD drop resets to zero */
function shatterVeins(b: Battle, id: SideId): void {
  const d = b.active(b.foe(id));
  const n = Math.max(0, -d.stages.spd);
  if (d.fainted || n === 0) return;
  d.stages.spd = 0;
  b.text(`${d.name} 身上的 ${n} 道「石紋」碎了，腳步不再沉重`);
}

/** Crack: +per power per vein (extra = how many extra to count), and shatters the veins after hitting */
const crack = (per: number, extra = 0): Pick<SkillHooks, 'power' | 'afterAttack'> => ({
  power: (b, c, p) => p + per * (veins(b, c.attacker) + extra),
  afterAttack: (b, c) => shatterVeins(b, c.attacker),
});

/** AI for Crack: with fewer than 2 veins and room to engrave more, do not strike yet (unless this hit can KO) */
const crackScore =
  (lo: number) =>
  (b: Battle, id: SideId, base: number): number => {
    const n = veins(b, id);
    if (base >= 100) return 0;
    const me = b.active(id);
    const more = ['stone_gaze', 'gargoyle_grit', 'gargoyle_gate_drop'].some((s) => me.skills.includes(s) && b.canUse(id, s).ok);
    if (n >= 3 || !more) return 5 * n;
    return n >= 2 ? 0 : lo;
  };

// ───────────────────────── Skill hooks ─────────────────────────

export const FX: Record<string, SkillHooks> = {
  // ── `terragon` ──
  terragon_shell_ram: {
    // `terragon_shell_ram`: +10 power per stratum (not spent)
    power: (b, c, p) => p + 10 * strata(b, c.attacker),
  },
  terragon_stratify: {
    // `terragon_stratify`: +2 strata (+3 under Sandstorm)
    effect: (b, id) => addStrata(b, id, b.s.field?.element === 'earth' ? 3 : 2),
    aiScore: (b, id) => {
      const n = strata(b, id);
      const f = b.active(b.foe(id));
      const c = b.active(id);
      if (n >= STRATA_MAX) return -100;
      // When about to KO the opponent, or when it cannot survive one capped hit itself, stop stacking strata
      if (f.hp < f.maxHp * 0.3 || c.hp < c.maxHp * 0.3) return -20;
      return n === 0 ? 70 : n === 1 ? 55 : 12;
    },
  },
  terragon_rockslide: {
    // `terragon_rockslide`: Collapse, +40 power per stratum
    ...collapsePower(40),
    aiScore: (b, id) => (strata(b, id) >= 2 ? 15 : -15),
  },
  terragon_ridge_charge: {
    // `terragon_ridge_charge`: +1 stratum on a hit
    afterAttack: (b, c, r) => {
      if (!r.decoyBlocked) addStrata(b, c.attacker, 1);
    },
    aiScore: (b, id) => (strata(b, id) < STRATA_MAX ? 10 : 0),
  },
  terragon_tremor: {
    // `terragon_tremor`: destroys the opponent's trap on a hit
    afterAttack: (b, c) => void b.destroyTrap(c.defender),
    aiScore: (b, id) => (b.side(b.foe(id)).trap ? 35 : 0),
  },
  terragon_soil_mend: {
    // `terragon_soil_mend`: the tag heals 25%, then collapses the strata, healing 10% per stratum
    effect: (b, id) => {
      const n = collapse(b, id);
      if (n > 0) b.heal(id, 10 * n);
    },
    aiScore: (b, id, base) => {
      const c = b.active(id);
      const missing = 1 - c.hp / c.maxHp;
      if (missing < 0.3) return -base - 20;
      return missing * strata(b, id) * 25;
    },
  },
  terragon_bedrock: {
    // `terragon_bedrock`: +1 stratum; for 3 turns strata are not shattered (see KIT.terragon.incoming)
    effect: (b, id) => {
      addStrata(b, id, 1);
      if (isTerragon(b, id)) b.addLasting(id, 'terragon_bedrock', 3);
    },
    lasting: { name: '萬古磐岩' },
    aiScore: (b, id) => {
      const c = b.active(id);
      if (b.getLasting(id, 'terragon_bedrock')) return -100;
      return c.hp > c.maxHp * 0.45 ? 45 : 10;
    },
  },
  terragon_sand_surge: {
    // `terragon_sand_surge`: Sandstorm for 5 turns (tag) plus 1 stratum
    effect: (b, id) => addStrata(b, id, 1),
    aiScore: (b) => (b.s.field?.element === 'earth' && b.s.field.turns >= 2 ? -40 : 0),
  },
  terragon_avalanche: {
    // `terragon_avalanche`: ignores guard (tag); Collapse, +40 power per stratum
    ...collapsePower(40),
    aiScore: (b, id) => {
      const n = strata(b, id);
      // With too few strata, stack first (`terragon_stratify` scores higher); when taunted and unable to stack strata it is still the best attack
      return n >= 3 ? 40 : n === 2 ? 20 : n === 1 ? -10 : -20;
    },
  },
  terragon_backlash: {
    // `terragon_backlash`: +1 stratum before the damage; the damage reduced by strata is reflected to the attacker
    trap: {
      on: 'foeAttack',
      when: (b, owner) => isTerragon(b, owner),
      fire: (b, owner, ev) => {
        const c = b.active(owner);
        addStrata(b, owner, 1);
        c.vars[BACKLASH] = 1;
        c.vars[EXCESS] = 0;
        return {
          after: () => {
            const ex = c.vars[EXCESS] ?? 0;
            delete c.vars[BACKLASH];
            delete c.vars[EXCESS];
            if (ex > 0 && !b.active(ev.ctx.attacker).fainted) {
              b.text('磐岳反震！');
              b.damage(ev.ctx.attacker, ex, 'reflect');
            }
          },
        };
      },
    },
    aiScore: (b, id) => (isTerragon(b, id) ? 40 : -100),
  },
  terragon_kingdom: {
    // `terragon_kingdom`: +1 stratum; for 3 turns, every stratum lost (shattered or collapsed) makes the opponent take 8% damage (see kingdomStrike)
    effect: (b, id) => {
      addStrata(b, id, 1);
      if (isTerragon(b, id)) b.addLasting(id, KINGDOM, 3);
    },
    lasting: { name: '磐心王國' },
    aiScore: (b, id) => {
      const c = b.active(id);
      if (b.getLasting(id, KINGDOM)) return -100;
      return c.hp > c.maxHp * 0.4 ? 45 : 10;
    },
  },
  u_terragon: {
    // `u_terragon`: Collapse +50 power per stratum, then refills to 3 strata
    power: (b, c, p) => p + 50 * strata(b, c.attacker),
    afterAttack: (b, c) => {
      collapse(b, c.attacker);
      addStrata(b, c.attacker, STRATA_MAX);
    },
    aiScore: (b, id) => (strata(b, id) >= 2 ? 30 : 0),
  },

  // ── `chronodragon` ──
  chronodragon_sand_bolt: {
    // `chronodragon_sand_bolt`: +1 stack when a Time Seal is already present
    afterAttack: (b, c, r) => {
      if (!r.decoyBlocked && sealOn(b, c.defender)) addSeal(b, c.attacker, 1);
    },
    aiScore: (b, id) => (sealLayers(b, id) > 0 && sealLayers(b, id) < SEAL_MAX ? 10 : 0),
  },
  sand_prophecy: {
    // `sand_prophecy`: +4 stacks; countdown +1 if the opponent guards this turn (the Time Seal's own coming due is written in lasting)
    effect: (b, id) => {
      addSeal(b, id, 4);
      if (b.active(b.foe(id)).guarding) shiftSeal(b, id, 1);
    },
    lasting: {
      name: '時印',
      onTurnEnd: (b, owner, e) => {
        if (e.turns <= 1) detonate(b, owner, 1);
      },
      onExpire: (b) => b.text('時印在無人的戰場上消散了。'),
    },
    aiScore: (b, id) => {
      const n = sealLayers(b, id);
      const s = sealOn(b, b.foe(id));
      // Reading the guard: when the Time Seal is due this turn and the opponent will most likely guard, add stacks and push the due date to the next turn, when the opponent cannot guard again
      if (s && s.turns <= 1 && foeLikelyGuards(b, id)) return 50;
      const f = b.active(b.foe(id));
      if (f.hp < f.maxHp * 0.2) return 0;
      return n === 0 ? 60 : n <= 2 ? 25 : -40;
    },
  },
  chronodragon_hasten: {
    // `chronodragon_hasten`: clears turns (tag) plus Time Seal countdown -1
    effect: (b, id) => shiftSeal(b, id, -1),
    aiScore: (b, id) => {
      const s = sealOn(b, b.foe(id));
      if (!s) return -10;
      return s.n >= 3 && s.turns >= 2 ? 30 : 0;
    },
  },
  chronodragon_dune_breath: {
    // `chronodragon_dune_breath`: +1 stack on a hit
    afterAttack: (b, c, r) => {
      if (!r.decoyBlocked) addSeal(b, c.attacker, 1);
    },
    aiScore: (b, id) => (sealLayers(b, id) < SEAL_MAX ? 8 : 0),
  },
  chronodragon_rewind: {
    // `chronodragon_rewind`: heals 25%; when moving last, returns to the HP at the start of this turn (at least 25%)
    effect: (b, id) => {
      const c = b.active(id);
      const base = Math.floor(c.maxHp * 0.25);
      const back = b.hasActed(b.foe(id)) ? c.hpAtTurnStart - c.hp : 0;
      if (back > base) b.text('時間回溯到了這一回合的開始……');
      b.healAmount(id, Math.max(base, back));
    },
    aiScore: (b, id) => {
      const c = b.active(id);
      const missing = 1 - c.hp / c.maxHp;
      return missing < 0.3 ? -20 : missing * 90;
    },
  },
  chronodragon_convergence: {
    // `chronodragon_convergence`: comes due immediately after hitting, +20% damage per stack
    afterAttack: (b, c, r) => {
      if (!r.decoyBlocked) detonate(b, c.defender, 1.2);
    },
    aiScore: (b, id) => {
      const n = sealLayers(b, id);
      const f = b.active(b.foe(id));
      if (n === 0) return -20;
      // Convergence is safest when the opponent has just guarded (it cannot guard this turn); when the Time Seal is due this turn the opponent will most likely guard, so use `sand_prophecy` to delay it instead
      const lethal = f.hp <= f.maxHp * n * 0.15;
      if (!b.canGuard(b.foe(id)).ok) return lethal ? 80 : n >= 2 ? 55 : 15;
      if (foeLikelyGuards(b, id)) return -40;
      return lethal ? 60 : n >= 3 ? 35 : 5;
    },
  },
  chronodragon_time_corridor: {
    // `chronodragon_time_corridor`: voids the attack and gives +2 stacks of Time Seal
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => {
        b.text('攻擊被送進了未來……');
        addSeal(b, owner, 2);
        return { negate: true };
      },
    },
    aiScore: (b, id) => {
      const f = b.foe(id);
      const me = b.active(id);
      const big = b.active(f).skills.some((s) => b.estimate(f, s) >= me.hp * 0.35);
      return big ? 25 : -20;
    },
  },
  chronodragon_era_gale: {
    // `chronodragon_era_gale`: Time Seal countdown -1 on a hit
    afterAttack: (b, c, r) => {
      if (!r.decoyBlocked) shiftSeal(b, c.attacker, -1);
    },
  },
  chronodragon_hourglass_flip: {
    // `chronodragon_hourglass_flip`: scapegoat (tag) plus Time Seal +1 stack
    effect: (b, id) => addSeal(b, id, 1),
    aiScore: (b, id) => {
      const n = Object.keys(b.active(id).status).length;
      return n > 0 ? 10 : -30;
    },
  },
  chronodragon_eternal_return: {
    // `chronodragon_eternal_return`: for 3 turns, after it comes due it is engraved again at half the stacks (see detonate)
    effect: (b, id) => void b.addLasting(id, LOOP, 3, { side: true }),
    lasting: { name: '永劫回歸' },
    aiScore: (b, id) => {
      if (b.getLasting(id, LOOP)) return -100;
      return sealLayers(b, id) >= 2 ? 45 : -20;
    },
  },
  chronodragon_millennium: {
    // `chronodragon_millennium`: +15 power per stack of Time Seal (not spent)
    power: (b, c, p) => p + 15 * sealLayers(b, c.attacker),
    aiScore: (b, id) => (sealLayers(b, id) >= 3 ? 10 : -5),
  },
  u_chronodragon: {
    // `u_chronodragon`: comes due immediately after hitting, damage x2 per stack
    afterAttack: (b, c, r) => {
      if (!r.decoyBlocked) detonate(b, c.defender, 2);
    },
    aiScore: (b, id) => {
      const n = sealLayers(b, id);
      const f = b.active(b.foe(id));
      if (n === 0) return -30;
      const lethal = f.hp <= f.maxHp * n * 0.2;
      if (!b.canGuard(b.foe(id)).ok) return lethal ? 90 : n >= 3 ? 55 : 10;
      if (foeLikelyGuards(b, id)) return -40;
      return lethal ? 70 : n >= 3 ? 40 : 0;
    },
  },

  // ── `sand_reaper` ──
  sand_reaper_pincer_jab: {
    // `sand_reaper_pincer_jab`: priority +1 when we have a trap set
    priority: (b, id) => (b.side(id).trap ? 1 : 0),
  },
  sand_reaper_scythe_pit: {
    // `sand_reaper_scythe_pit`: reduces damage by 20% when hit; after the attack resolves, Sand Pincer (6% per level of burial)
    trap: {
      on: 'foeAttack',
      when: (b, owner) => snapDepth(b, owner),
      fire: (b, owner) => ({ reduce: 0.2, after: () => pincer(b, owner) }),
    },
    aiScore: () => 30,
  },
  sand_reaper_throat_snare: {
    // `sand_reaper_throat_snare`: when the opponent uses a status skill, voids it and silences it for 2 turns; Sand Pincer
    trap: {
      on: 'foeStatus',
      when: (b, owner) => snapDepth(b, owner),
      fire: (b, owner) => {
        b.text('流沙鎖住了喉嚨！');
        pincer(b, owner);
        b.applyStatus(b.foe(owner), 'silence');
        return { negate: true };
      },
    },
    // Prefer setting this one when the opponent has status skills; when it does not, it can still serve as material for Flip Sand
    aiScore: (b, id) => (b.active(b.foe(id)).skills.some((s) => getSkill(s).category === 'status') ? 45 : 20),
  },
  sand_reaper_reaping_counter: {
    // `sand_reaper_reaping_counter`: +50 power when our trap fired this turn
    power: (b, c, p) => p + (b.side(c.attacker).vars[FIRED] === b.s.turn + 1 ? 50 : 0),
    // The trap can fire this turn and is a hit-triggered type: when the opponent acts it will step on it first
    aiScore: (b, id) => (b.trapReady(id) === 'sand_reaper_scythe_pit' ? 30 : b.side(id).vars[FIRED] === b.s.turn + 1 ? 30 : -5),
  },
  sand_reaper_burrow: {
    // `sand_reaper_burrow`: burial +2 (DEF +1 is resolved by tags)
    effect: (b, id) => addDepth(b, id, 2),
    aiScore: (b, id) => (!srTrap(b, id) ? -40 : depthOf(b, id) <= 1 ? 35 : -20),
  },
  sand_reaper_upheaval: {
    // `sand_reaper_upheaval`: Flip Sand, +30 power per level
    ...flipPower(30),
    aiScore: flipScore(25),
  },
  sand_reaper_molt: {
    // `sand_reaper_molt`: heals 25% (tag) plus burial +1
    effect: (b, id) => addDepth(b, id, 1),
  },
  sand_reaper_chase: {
    // `sand_reaper_chase`: pursuit (when the opponent switches, attacks at double power before it leaves)
    pursuit: 2,
  },
  sand_reaper_scythe_storm: {
    // `sand_reaper_scythe_storm`: burial +1 on a hit
    afterAttack: (b, c) => addDepth(b, c.attacker, 1),
  },
  sand_reaper_sand_burial: {
    // `sand_reaper_sand_burial`: ignores guard (tag); Flip Sand, +35 power per level
    ...flipPower(35),
    aiScore: flipScore(35),
  },
  u_sand_reaper: {
    // `u_sand_reaper`: Flip Sand +40 power per level; the next trap set afterwards is buried 3 levels deep at once
    power: (b, c, p) => p + 40 * depthOf(b, c.attacker),
    afterAttack: (b, c) => {
      flip(b, c.attacker);
      b.side(c.attacker).vars[PRIMED] = 1;
      b.text('沙底布滿了鐮刃：下一張伏技會直接深埋 3 層。');
    },
    aiScore: (b, id) => (depthOf(b, id) >= 2 ? 40 : -10),
  },

  // ── `sandserpent` ──
  sandserpent_sand_fang: {
    // `sandserpent_sand_fang`: Sinking +1 on a hit (refreshed to 3 turns)
    afterAttack: (b, c, r) => {
      if (!r.decoyBlocked) addSink(b, c.attacker, 1);
    },
    aiScore: (b, id) => {
      const s = sinkOn(b, id);
      return !s || s.turns <= 1 || s.n < SINK_MAX ? 10 : 0;
    },
  },
  sandserpent_quicksand_vortex: {
    // `sandserpent_quicksand_vortex`: Sinking +2 (SPD -1 is resolved by tags); the "Struggle" of Sinking itself is written in lasting
    effect: (b, id) => addSink(b, id, 2),
    lasting: {
      name: '陷沒',
      // Struggle: an action that costs aether pays HP first (3% per stack) and sinks deeper; `sandserpent_seven_pillars` blocks the big skills here
      blockAction: (b, owner, sk, e) => {
        const block = pillarsBlock(b, owner, sk);
        if (block) return block;
        const cost = spendOf(b, owner, sk);
        if (cost <= 0 || b.side(owner).aether < cost) return null;
        const c = b.active(owner);
        b.text(`${c.name} 在流沙裡掙扎……`);
        b.trueDamage(owner, STRUGGLE_PCT * e.n, 'quicksand');
        if (c.fainted) return '被流沙吞沒了';
        if (e.n < SINK_MAX) {
          e.n++;
          b.text(`越掙扎陷得越深（陷沒 ${e.n} 層）`);
        }
        return null;
      },
    },
    aiScore: (b, id) => {
      const n = sinkLayers(b, id);
      return n === 0 ? 55 : n < SINK_MAX ? 15 : -40;
    },
  },
  sandserpent_tail_lash: {
    // `sandserpent_tail_lash`: Sinking +1 on a hit
    afterAttack: (b, c, r) => {
      if (!r.decoyBlocked) addSink(b, c.attacker, 1);
    },
    aiScore: (b, id) => (sinkLayers(b, id) < SINK_MAX ? 10 : 0),
  },
  sandserpent_sand_breath: {
    // `sandserpent_sand_breath`: heals 25% (tag) plus 5% per stack of the opponent's Sinking
    effect: (b, id) => {
      const n = sinkLayers(b, id);
      if (n > 0) b.heal(id, 5 * n);
    },
  },
  sandserpent_breath_squeeze: {
    // `sandserpent_breath_squeeze`: +10 power for each point of the opponent's aether (max +80)
    power: (b, c, p) => p + Math.min(80, 10 * b.side(c.defender).aether),
  },
  sandserpent_seven_pillars: {
    // `sandserpent_seven_pillars`: Sinking +1 on a hit; for 3 turns, a sinking opponent cannot use skills costing 3 or more, nor ultimates (blocked by Sinking's blockAction when it acts)
    afterAttack: (b, c, r) => {
      if (r.decoyBlocked || b.active(c.defender).fainted) return;
      addSink(b, c.attacker, 1);
      // The block starts only after the turn the pillars go up (an action the opponent already chose this turn is unaffected): this turn plus the next 3 turns
      b.addLasting(c.defender, PILLARS, 4, { from: c.attacker });
    },
    lasting: {
      name: '七柱沙牢',
      canUse: (b, owner, sk) => pillarsBlock(b, owner, sk),
      onTurnEnd: (b, owner) => {
        b.active(owner).vars[PILLARS_UP] = 1;
      },
      onExpire: (b, owner) => {
        delete b.active(owner).vars[PILLARS_UP];
      },
    },
    aiScore: (b, id) => {
      const f = b.foe(id);
      if (b.getLasting(f, PILLARS)) return -30;
      const big = b.active(f).skills.some((s) => b.costFor(f, getSkill(s)) >= 4) || (!!b.active(f).ultimate && !b.side(f).ultUsed);
      return big ? 35 : -10;
    },
  },
  sandserpent_engulf: {
    // `sandserpent_engulf`: ignores guard when the opponent is sinking
    pierceGuard: (b, id) => !!sinkOn(b, id),
    aiScore: (b, id) => (sinkOn(b, id) && b.side(b.foe(id)).aether >= 1 ? 8 : 0),
  },
  sandserpent_sand_sea: {
    // `sandserpent_sand_sea`: +40 power when the opponent has 3 stacks of Sinking
    power: (b, c, p) => p + (sinkLayers(b, c.attacker) >= SINK_MAX ? 40 : 0),
  },
  sandserpent_sinking_depths: {
    // `sandserpent_sinking_depths`: on a hit, the opponent loses 1 aether per stack of Sinking
    afterAttack: (b, c, r) => {
      const n = sinkLayers(b, c.attacker);
      if (n <= 0 || r.decoyBlocked || b.side(c.defender).aether <= 0) return;
      b.text('流沙沒過了頭頂，吐不出一口氣！');
      b.drainAether(c.attacker, n, false);
    },
    aiScore: (b, id) => Math.min(sinkLayers(b, id), b.side(b.foe(id)).aether) * 10,
  },
  u_sandserpent: {
    // `u_sandserpent`: after hitting, Sinking becomes 3 stacks (the bind is resolved by tags)
    afterAttack: (b, c) => addSink(b, c.attacker, SINK_MAX, true),
    aiScore: (b, id) => (sinkLayers(b, id) < SINK_MAX ? 15 : 0),
  },

  // ── `rhino` ──
  rhino_horn_butt: {
    // `rhino_horn_butt`: run-up, +1 on a hit
    ...runHit(1),
    aiScore: runHitScore(-10),
  },
  rhino_paw_ground: {
    // `rhino_paw_ground` (start of the run): usable only at 0 stacks of Gallop; a run-up status skill, Gallop becomes 3 stacks (full speed)
    canUse: (b, id) => (mom(b, id) > 0 ? '已經在奔跑了：刨地只能在奔勢 0 層時起跑' : null),
    effect: runStep(MOM_MAX),
    aiScore: runStepScore(MOM_MAX, 45),
  },
  horn_charge: {
    // `horn_charge`: Ram, +70 at full speed
    ...ram(70),
    aiScore: ramScore(15),
  },
  rhino_trample: {
    // `rhino_trample`: run-up, +1 on a hit (the slowdown is resolved by tags)
    ...runHit(1),
    aiScore: runHitScore(-10),
  },
  rhino_head_shake: {
    // `rhino_head_shake`: cleanse (tag) plus run-up status skill +1
    effect: runStep(1),
    aiScore: (b, id) => (Object.keys(b.active(id).status).length > 0 ? 10 : runStepScore(1, 8)(b, id)),
  },
  rhino_canyon_run: {
    // `rhino_canyon_run`: run-up, +1 on a hit; already at full speed it gives +30 power instead
    power: (b, c, p) => p + (fullSpeed(b, c.attacker) ? 30 : 0),
    ...runHit(1),
    aiScore: runHitScore(5),
  },
  rhino_ironhoof: {
    // `rhino_ironhoof`: ignores guard (tag); +40 when the opponent guards
    power: (b, c, p) => p + (c.guardBroken ? 40 : 0),
    afterAttack: (b, c) => landed(b, c.attacker),
    aiScore: (b, id) => (rhinoFoeGuards(b, id) ? 45 : 0),
  },
  rhino_heavy_step: {
    // `rhino_heavy_step`: run-up status skill +1 (the heal is resolved by tags)
    effect: runStep(1),
    aiScore: (b, id) => (mom(b, id) >= MOM_MAX ? -10 : rhinoFoeGuards(b, id) ? 25 : 0),
  },
  rhino_rage_hooves: {
    // `rhino_rage_hooves`: run-up, +1 on a hit (the recoil is resolved by tags)
    ...runHit(1),
    aiScore: runHitScore(-5),
  },
  rhino_siege_horn: {
    // `rhino_siege_horn`: Ram, +90 at full speed, and knocks the opponent away after hitting
    ...ram(90),
    afterAttack: (b, c, r) => {
      landed(b, c.attacker);
      const full = fullSpeed(b, c.attacker);
      decelerate(b, c.attacker);
      const d = b.active(c.defender);
      if (!full || r.decoyBlocked || d.fainted || b.s.winner !== null || b.aliveBench(c.defender).length === 0) return;
      b.text(`${d.name} 被撞飛了！`);
      b.forceSwitch(c.defender);
    },
    aiScore: ramScore(20),
  },
  u_rhino: {
    // `u_rhino`: Ram (ignores guard at full speed); after hitting, Gallop becomes 3 stacks
    pierceGuard: (b, id) => fullSpeed(b, id),
    afterAttack: (b, c) => {
      landed(b, c.attacker);
      setMom(b, c.attacker, MOM_MAX);
    },
    // Below full speed and in the guessing game: the ultimate may crash into the shield (half the chance), so first run up to full speed with `rhino_paw_ground`, then cast it
    aiScore: (b, id, base) => {
      if (fullSpeed(b, id) || !rhinoMindGame(b, id)) return 10;
      return rhinoFoeGuards(b, id) ? -base - 20 : -base * 0.5;
    },
  },

  // ── `monolith` ──
  monolith_engrave: {
    // `monolith_engrave`: [Swear] after hitting
    afterAttack: (b, c) => swear(b, c.attacker),
    aiScore: (b, id) => vowScore(b, id, 15),
  },
  body_press: {
    // `body_press`: +40 after being attacked this turn (priority -1, so it mostly acts last)
    power: (b, c, p) => p + (!c.estimate && b.active(c.attacker).vars[MONO_HIT] === b.s.turn ? PRESS_BONUS : 0),
    // When the AI estimates, it has not been hit yet: when the opponent has an attack available, it counts the +40 at about a seventy percent chance
    aiScore: (b, id, base) => {
      const f = b.foe(id);
      const armed = b.active(f).skills.some((s) => isAttack(getSkill(s)) && b.canUse(f, s).ok);
      return armed ? Math.min(25, base * 0.4) : 0;
    },
  },
  monolith_colossus_vow: {
    // `monolith_colossus_vow`: taunt (tag) plus [Swear]
    effect: (b, id) => swear(b, id),
    aiScore: (b, id) => vowScore(b, id, 10),
  },
  u_earth: {
    // `u_earth`: [Swear] after hitting
    afterAttack: (b, c) => swear(b, c.attacker),
  },

  // ── `digmole` ──
  dig_strike: { ...burst(), aiScore: digScore(0) },
  digmole_upturn: { ...burst(), aiScore: digScore(4) },
  digmole_crystal_burst: { ...burst(BURST_AE), aiScore: digScore(0) },
  // `u_digmole`: the burrowing ultimate
  u_digmole: { ...burst(), aiScore: digScore(0) },
  // ── `gargoyle` ──
  gargoyle_crack: { ...crack(30), aiScore: crackScore(-25) },
  gargoyle_shatter: { ...crack(35), aiScore: crackScore(-35) },
  u_gargoyle: { ...crack(40, 2) },
  stone_gaze: {
    // `gargoyle_stone_gaze`: only worth spending a turn engraving when there are no veins (the slowdown and root are resolved by tags); with veins, striking with `gargoyle_grit` while engraving is better value
    aiScore: (b, id) => (veins(b, id) === 0 ? 5 : veins(b, id) >= 2 ? -30 : -10),
  },
};

/** `sandserpent_seven_pillars`: a sinking holder cannot use skills costing 3 or more, nor ultimates (returns the reason) */
function pillarsBlock(b: Battle, owner: SideId, sk: SkillDef): string | null {
  if (sk.id === 'guard' || !b.active(owner).vars[PILLARS_UP] || !b.getLasting(owner, PILLARS) || !b.getLasting(owner, SINK)) return null;
  const big = sk.category === 'ultimate' || b.costFor(owner, sk) >= 4;
  return big ? '七柱沙牢：陷沒時無法使用費用 4 以上的技能與奧義' : null;
}

// ───────────────────────── Kit hooks ─────────────────────────

export const KIT: Record<string, KitHooks> = {
  terragon: {
    // New trait "Immovable Mountain": on entering, sets Sandstorm for 3 turns and gains 1 stratum; cannot be forced to switch
    onEnter: (b, id) => {
      b.traitEvent(id, '不動磐岳');
      b.setField('earth', 3);
      addStrata(b, id, 1);
    },
    forceSwitchImmune: true,
    // Under Sandstorm, +1 stratum at the end of the turn
    onEndTurn: (b, id) => {
      const v = b.active(id).vars;
      delete v[BROKEN];
      delete v[BACKLASH];
      delete v[EXCESS];
      if (b.s.field?.element === 'earth') addStrata(b, id, 1);
    },
    // Strata: each hit does at most 25% of max HP, and the hit that was reduced shatters 1 stratum
    incoming: (b, a, dmg) => {
      const id = a.defender;
      const c = b.active(id);
      const n = c.vars[STRATA] ?? 0;
      const cap = Math.floor(c.maxHp * STRATA_CAP);
      if (n <= 0 || dmg <= cap) return dmg;
      if (c.vars[BACKLASH]) c.vars[EXCESS] = (c.vars[EXCESS] ?? 0) + (dmg - cap);
      if (b.getLasting(id, 'terragon_bedrock')) b.text(`岩層擋下了 ${dmg - cap} 點傷害（萬古磐岩：岩層不碎）`);
      else {
        c.vars[STRATA] = n - 1;
        if (b.getLasting(id, KINGDOM)) c.vars[BROKEN] = (c.vars[BROKEN] ?? 0) + 1;
        b.text(`岩層擋下了 ${dmg - cap} 點傷害，碎了 1 層（剩 ${n - 1} 層）`);
      }
      return cap;
    },
    // `terragon_kingdom`: only after the attack resolves does it strike back for the strata shattered by this attack (it does no damage in the middle of the attack)
    onHitTaken: (b, a) => {
      const c = b.active(a.defender);
      const n = c.vars[BROKEN] ?? 0;
      if (n > 0) {
        delete c.vars[BROKEN];
        kingdomStrike(b, a.defender, n);
      }
    },
    marks: (b, id) => {
      const n = strata(b, id);
      return n ? [{ id: 'kit:strata', n, note: '岩層' }] : [];
    },
  },
  chronodragon: {
    // Time Seal: shows the stacks and countdown engraved on the opponent's side; when the opponent faints, a Time Seal due this turn is carried to the next spirit
    onEndTurn: (b, id) => carrySeal(b, id),
    bench: {
      onTurnEnd: (b, side, self) => {
        if (!b.side(side).team[self].fainted) carrySeal(b, side);
      },
    },
    marks: (b, id) => {
      const s = sealOn(b, b.foe(id));
      return s ? [{ id: 'kit:seal', n: s.n, turns: s.turns, note: '時印' }] : [];
    },
    // Opponent AI: when the Time Seal comes due at the end of this turn, a guard is worth as much as the damage it blocks (more when it blocks a lethal one)
    aiFoeGuard: (b, id) => chronoGuardHint(b, id),
  },
  sand_reaper: {
    // Deep Burial: while `sand_reaper` is active, its own trap gets +1 level at the end of every turn (recounted when the trap slot holds a different card); the trait "Lurk in Sand" keeps the old implementation
    onEndTurn: (b, id) => {
      if (srTrap(b, id)) addDepth(b, id, 1);
      else clearDepth(b, id);
    },
    // `sand_reaper_reaping_counter`: records that our trap fired this turn
    onTrapActivated: (b, id) => {
      b.side(id).vars[FIRED] = b.s.turn + 1;
    },
    marks: (b, id) => {
      const n = depthOf(b, id);
      if (n > 0) return [{ id: 'kit:depth', n, note: '深埋' }];
      return b.side(id).vars[PRIMED] ? [{ id: 'kit:depth', n: DEPTH_MAX, note: '下一張伏技深埋' }] : [];
    },
  },
  sandserpent: {
    // New trait "Quicksand Domain": on entering, the opponent sinks 1 stack; while active, the opponent cannot switch voluntarily
    onEnter: (b, id) => {
      if (b.active(b.foe(id)).fainted) return;
      b.traitEvent(id, '流沙領域');
      addSink(b, id, 1);
    },
    lockFoeSwitch: true,
    // Sinking: shows the opponent's Sinking stacks and remaining turns
    marks: (b, id) => {
      const s = sinkOn(b, id);
      return s ? [{ id: 'kit:sink', n: s.n, turns: s.turns, note: '陷沒' }] : [];
    },
  },
  rhino: {
    // Gallop: each stack gives physical damage +8% (the old trait "Charge" works as before: physical +20% when faster than the opponent)
    attackBonus: (b, a) => (a.cat === 'physical' ? MOM_DMG * mom(b, a.attacker) : 0),
    onEndTurn: (b, id) => {
      const me = b.active(id);
      const n = mom(b, id);
      if (n <= 0) return;
      const t = b.s.turn;
      const foe = b.active(b.foe(id));
      // Wall Crash: below full speed, a physical skill is guarded (the exclusive physical skill did not land this turn)
      if (me.usedAttackThisTurn && foe.guarding && !foe.fainted && me.vars[LANDED] !== t) {
        if (n >= MOM_MAX) return;
        me.vars[MOM] = 0;
        b.text(`${me.name} 一頭撞上了 ${foe.name} 的格擋，撞牆了！`);
        b.trueDamage(id, CRASH_PCT * n, 'crash');
        return;
      }
      // Stopping: no physical skill or run-up status skill was used this turn
      if (!me.usedAttackThisTurn && me.vars[RAN] !== t) {
        me.vars[MOM] = 0;
        b.text(`${me.name} 停下了腳步，奔勢散了`);
      }
    },
    // Guarding is stopping: guard less while holding Gallop
    aiGuard: (b, id) => -12 * mom(b, id),
    aiFoeGuard: (b, id) => rhinoFoeGuardRoll(b, id),
    marks: (b, id) => {
      const n = mom(b, id);
      return n > 0 ? [{ id: 'kit:momentum', n, note: n >= MOM_MAX ? '奔勢・全速' : '奔勢' }] : [];
    },
  },
  monolith: {
    // Stone Oath: with HP at or above 30%, a lethal hit's damage is turned into keeping 1 HP (at full HP it is left to the old trait "Firm Stone", and the Stone Oath is kept)
    incoming: (b, a, dmg) => {
      const c = b.active(a.defender);
      if (!c.vars[VOW] || dmg < c.hp || c.hp <= 1 || c.hp < c.maxHp * VOW_MIN) return dmg;
      if (c.hp === c.maxHp && !c.species.traitOverride) return dmg;
      delete c.vars[VOW];
      b.text(`「石誓」碎裂！${c.name} 保留了 1 點生命`);
      return c.hp - 1;
    },
    onHitTaken: (b, a) => {
      b.active(a.defender).vars[MONO_HIT] = b.s.turn;
    },
    marks: (b, id) => (hasVow(b, id) ? [{ id: 'kit:vow', n: 1, note: '石誓' }] : []),
  },
  digmole: {
    // New trait "Vein Sense": on entering, reveals the opponent's trap that is set
    onEnter: (b, id) => {
      const t = b.side(b.foe(id)).trap;
      if (!t || t.revealed) return;
      b.traitEvent(id, '探脈');
      b.revealTrap(b.foe(id));
    },
    onHitTaken: (b, a) => {
      b.active(a.defender).vars[MOLE_HIT] = b.s.turn;
    },
    // Whiff: `digmole` is still underground, was not hit this turn, and the opponent used an attack
    onEndTurn: (b, id) => {
      const me = b.active(id);
      if (me.hidden && b.active(b.foe(id)).usedAttackThisTurn && me.vars[MOLE_HIT] !== b.s.turn && !me.vars[WHIFF]) {
        me.vars[WHIFF] = 1;
        b.text(`對手撲空了！${me.name} 下一次破土威力 +50%`);
      }
    },
    aiFoeGuard: (b, id) => moleFoeGuard(b, id),
    marks: (b, id) => (getVar(b, id, WHIFF) ? [{ id: 'kit:whiff', n: 1, note: '撲空：破土 +50%、無視格擋' }] : []),
  },
  gargoyle: {
    // Stone Veins: on entering, the opponent's SPD -1 stage (veins +1); the old trait "Petrify" works as before
    onEnter: (b, id) => {
      if (b.active(b.foe(id)).fainted) return;
      b.text(`${b.active(id).name} 的目光讓對手的腳步化成了石頭`);
      b.changeStage(b.foe(id), 'spd', -1, true);
    },
    // At the end of the turn, the opponent's SPD -1 stage (veins +1)
    onEndTurn: (b, id) => {
      const f = b.foe(id);
      if (b.active(f).fainted) return;
      b.changeStage(f, 'spd', -1, true);
    },
    marks: (b, id) => {
      const n = veins(b, id);
      return n > 0 ? [{ id: 'kit:veins', n, note: '石紋' }] : [];
    },
  },
};

/**
 * The opponent's (b.foe(id)) bonus when considering a guard.
 * Countdown 1: it comes due at the end of this turn, and the guard is worth about the damage it blocks.
 * Countdown 2: only worth gambling when `chronodragon` can bring it due early this turn (`chronodragon_convergence` x1.2, the ultimate x2, `chronodragon_hasten` / `chronodragon_era_gale` speeding it up),
 * because guarding this turn means it cannot guard next turn.
 */
function chronoGuardHint(b: Battle, id: SideId): number {
  const f = b.foe(id);
  const s = sealOn(b, f);
  if (!s) return 0;
  const d = b.active(f);
  const frac = (mult: number) => Math.min(1, (d.maxHp * s.n * SEAL_PCT * mult) / 100 / Math.max(1, d.hp));
  const lethal = (mult: number) => (d.maxHp * s.n * SEAL_PCT * mult) / 100 >= d.hp;
  if (s.turns <= 1) return frac(1) * 90 + (lethal(1) ? 50 : 0);
  if (s.turns !== 2) return -10;
  const me = b.active(id);
  const can = (k: string) => (me.skills.includes(k) || me.ultimate === k) && b.canUse(id, k).ok;
  const mult = can('u_chronodragon') ? 2 : can('chronodragon_convergence') ? 1.2 : can('chronodragon_hasten') || can('chronodragon_era_gale') ? 1 : 0;
  if (mult === 0) return -10;
  return frac(mult) * 70 + (lethal(mult) ? 30 : 0);
}

/** `chronodragon`'s AI estimate of whether the opponent will guard this turn (modeled on the opponent AI: guard score vs best attack score) */
function foeLikelyGuards(b: Battle, id: SideId): boolean {
  const f = b.foe(id);
  if (!b.canGuard(f).ok) return false;
  const me = b.active(id);
  let best = 0;
  for (const s of b.active(f).skills) {
    const sk = getSkill(s);
    if (sk.power > 0 && sk.category !== 'status' && sk.category !== 'trap' && b.canUse(f, s).ok) best = Math.max(best, b.estimate(f, s));
  }
  const attack = Math.min(1, best / Math.max(1, me.hp)) * 100 + (best >= me.hp ? 60 : 0);
  return 12 + chronoGuardHint(b, id) - 3 > attack;
}
