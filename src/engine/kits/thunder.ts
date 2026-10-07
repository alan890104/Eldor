// Skill hooks and kit hooks for the thunder group (data/kits/thunder.json). See docs/10-kit-authoring.md for how to write them.
// Only `import type { Battle }` is allowed (importing battle.ts at runtime would create a circular dependency).

import { getSkill } from '../../data.ts';
import type { Battle } from '../battle.ts';
import type { AttackResult, HitCtx, KitHooks, SkillHooks } from '../skillfx.ts';
import type { SideId } from '../types.ts';

// ═════════════════════════ `voltarion`: Swift Thunder ═════════════════════════
// With 3 stacks of charge, moving first and hitting with a thunder attack -> spends 3 stacks of charge and voids the opponent's action this turn (stun).
// A stunned spirit gains "Composure" (2 turns, including this one): it cannot be stunned again next turn.
// Stun and Composure are lasting effects placed on the opponent; the hooks borrow `voltarion_thunder_step` and `voltarion_startle` (the key is only a storage slot).

/** Stun: the action this turn is void */
const STUN = 'voltarion_thunder_step';
/** Composure: cannot be stunned again */
const CALM = 'voltarion_startle';
/** `voltarion_edict`: for the next 3 turns physical and magic skills get priority +1 */
const EDICT = 'voltarion_edict';
/** Charge that Swift Thunder needs */
const SWIFT_COST = 3;

const isStrike = (cat: string) => cat === 'physical' || cat === 'magic';

/** Whether the attacker will move first this turn (in a real battle) or in the estimate (AI, skill card) */
function goesFirst(b: Battle, c: HitCtx): boolean {
  if (!c.estimate) return !b.hasActed(c.defender);
  return likelyFirst(b, c.attacker, c.sk.id);
}

/** This skill's priority this turn (the skill itself plus `voltarion_edict`), for the AI's estimate */
function prioOf(b: Battle, id: SideId, skillId: string): number {
  const sk = getSkill(skillId);
  return sk.priority + (b.getLasting(id, EDICT) && isStrike(sk.category) ? 1 : 0);
}

/** Without relying on priority, whether it moves first on speed (when action order is reversed, the slower goes first) */
function speedFirst(b: Battle, id: SideId): boolean {
  const f = b.foe(id);
  const mine = b.effStat(b.active(id), 'spd', id);
  const theirs = b.effStat(b.active(f), 'spd', f);
  return b.s.reverseOrder ? mine < theirs : mine > theirs;
}

/** AI estimate: whether using this skill will move first (the opponent's priority is taken as 0) */
function likelyFirst(b: Battle, id: SideId, skillId: string): boolean {
  return prioOf(b, id, skillId) > 0 || speedFirst(b, id);
}

/** Whether the opponent can be stunned now (moved first, no Composure) */
function staggerable(b: Battle, c: HitCtx, res: AttackResult): boolean {
  if (c.estimate || c.followUp || res.ko || res.decoyBlocked) return false;
  const d = b.active(c.defender);
  if (d.fainted || b.hasActed(c.defender)) return false;
  return !b.getLasting(c.defender, CALM);
}

/**
 * Swift Thunder: stuns the opponent when the conditions hold. free = needs and spends no charge (`voltarion_sky_cannon`, `u_voltarion`).
 * Returns whether the stun succeeded.
 */
function swift(b: Battle, c: HitCtx, res: AttackResult, opts: { free?: boolean } = {}): boolean {
  if (c.sk.element !== 'thunder' || !staggerable(b, c, res)) return false;
  const me = b.active(c.attacker);
  if (!opts.free) {
    if (me.charges < SWIFT_COST) return false;
    b.addCharges(c.attacker, -SWIFT_COST);
  }
  b.traitEvent(c.attacker, '迅雷');
  b.text('迅雷不及掩耳！');
  b.addLasting(c.defender, STUN, 1, { from: c.attacker });
  b.addLasting(c.defender, CALM, 2, { from: c.attacker });
  return true;
}

/** Swift Thunder is ready (full charge, the opponent has no Composure) */
function swiftReady(b: Battle, id: SideId): boolean {
  return b.active(id).charges >= SWIFT_COST && !b.getLasting(b.foe(id), CALM);
}

// ───────────── AI: teach the AI to seize the initiative, fill up Swift Thunder, then cash it in ─────────────

/** The opponent can be "paralyzed" (preparation for seizing the initiative) */
function paralyzable(b: Battle, f: SideId): boolean {
  const d = b.active(f);
  return !d.elements.includes('thunder') && !d.status.paralyze && b.s.field?.element !== 'light';
}

/** The biggest estimated damage of both sides this turn */
function bestHits(b: Battle, id: SideId): { mine: number; theirs: number } {
  const f = b.foe(id);
  const best = (side: SideId, list: string[]) => {
    let m = 0;
    for (const s of list) {
      const sk = getSkill(s);
      if (sk.power > 0 && sk.category !== 'status' && sk.category !== 'trap' && b.canUse(side, s).ok) m = Math.max(m, b.estimate(side, s));
    }
    return m;
  };
  const foe = b.active(f);
  return { mine: best(id, b.active(id).skills), theirs: best(f, [...foe.skills, ...(foe.ultimate && !b.side(f).ultUsed ? [foe.ultimate] : [])]) };
}

/**
 * It should prepare (paralysis or `voltarion_edict`) rather than attack head-on: it loses on speed, cannot KO the opponent this turn, can survive one hit from the opponent,
 * and has a usable preparation skill. Returns the usable preparation: 'wave' (`thunder_wave`), 'edict' (`voltarion_edict`) or null.
 */
function setupWanted(b: Battle, id: SideId): 'wave' | 'edict' | null {
  const me = b.active(id);
  const f = b.foe(id);
  if (speedFirst(b, id) || b.getLasting(id, EDICT)) return null;
  const { mine, theirs } = bestHits(b, id);
  if (mine >= b.active(f).hp || theirs >= me.hp * 0.95) return null;
  if (me.skills.includes('thunder_wave') && paralyzable(b, f) && b.canUse(id, 'thunder_wave').ok) return 'wave';
  if (me.skills.includes(EDICT) && b.canUse(id, EDICT).ok) return 'edict';
  return null;
}

/**
 * The opponent can block priority attacks (e.g. Eye of the Gale) or thunder attacks (e.g. Lightning Rod): when an attack did not land and was not guarded, this is recorded on the opponent.
 * A priority attack blocked once is not used again; a thunder attack is given up only after 2 misses in a row (to avoid being misled by a one-off trap), and a hit restarts the count.
 */
function blockedBefore(b: Battle, id: SideId, skillId: string, thunderMisses = 2): boolean {
  const d = b.active(b.foe(id));
  if ((d.vars['e:vlt:noThunder'] ?? 0) >= thunderMisses && getSkill(skillId).element === 'thunder') return true;
  return !!d.vars['e:vlt:noPrio'] && prioOf(b, id, skillId) > 0;
}

/** Attack landed (afterAttack): records that it landed this turn */
function noteLanded(b: Battle, c: HitCtx): void {
  b.active(c.attacker).vars['e:vlt:landed'] = b.s.turn;
  b.active(c.defender).vars['e:vlt:noThunder'] = 0;
}
/** After the skill resolves (afterUse): when this turn's attack did not land and the opponent was neither guarding nor burrowed, records what the opponent can block */
function noteBlocked(b: Battle, id: SideId): void {
  const me = b.active(id);
  const d = b.active(b.foe(id));
  if (me.vars['e:vlt:landed'] === b.s.turn || d.fainted || d.guarding || d.hidden) return;
  if (me.actPriority > 0) d.vars['e:vlt:noPrio'] = 1;
  d.vars['e:vlt:noThunder'] = (d.vars['e:vlt:noThunder'] ?? 0) + 1;
}

/**
 * Shared AI score for thunder attacks: +35 when Swift Thunder is ready and it will move first; when it should prepare first, -60 for an attack with priority 0;
 * -150 for an attack that has been blocked; +40 when it loses on speed but a priority attack can KO directly.
 */
function strikeScore(b: Battle, id: SideId, skillId: string): number {
  if (blockedBefore(b, id, skillId)) return -150;
  let s = swiftReady(b, id) && likelyFirst(b, id, skillId) ? 35 : 0;
  const prio = prioOf(b, id, skillId) > 0;
  if (setupWanted(b, id) && !(prio && swiftReady(b, id))) s -= prio ? 30 : 60;
  if (prio && !speedFirst(b, id) && b.estimate(id, skillId) >= b.active(b.foe(id)).hp) s += 40;
  return s;
}

/** An ordinary thunder attack: carries only Swift Thunder */
const swiftOnly = (skillId: string): SkillHooks => ({
  afterAttack: (b, c, r) => {
    noteLanded(b, c);
    swift(b, c, r);
  },
  afterUse: (b, id) => noteBlocked(b, id),
  aiScore: (b, id) => strikeScore(b, id, skillId),
});

// ═════════════════════════ `thunderbird`: Storm Clock ═════════════════════════
// The "Storm Clock" has 3 notches: 1 on entering; it moves 1 notch at the end of each turn, and 1 more if a wind skill was used this turn.
// When it reaches 3 notches at the end of a turn -> the clock resets to zero, a "Thunderstorm" arrives for 2 turns (the clock does not move meanwhile), and a bolt strikes for 8% (trait "Thundercloud").
// In a "Thunderstorm", `thunderbird`'s multi-hit skills get +2 hits. The clock and the Thunderstorm both sit on the spirit and disappear on leaving.
// Every Thunderstorm arrives at the end of a turn (ultimate excepted), so a Thunderstorm always acts on "the next 2 turns".

/** Storm Clock (e: prefix, cleared on leaving) */
const CLOCK = 'e:tbd:clock';
/** At the end of the turn, compares with "skills used since entering" to tell whether a skill was used this turn */
const SEEN = 'e:tbd:seen';
/** Thunderstorm: a lasting effect; the hooks borrow `thunderbird_gather_clouds` (the key is only a storage slot) */
const STORM = 'thunderbird_gather_clouds';
const CLOCK_MAX = 3;
const STORM_TURNS = 2;
/** The bolt when a Thunderstorm arrives (% of max HP) */
const STORM_BOLT = 8;

const clockOf = (b: Battle, id: SideId) => b.active(id).vars[CLOCK] ?? 0;
/** How many turns the Thunderstorm has left (including this turn; 0 = not in a Thunderstorm) */
const stormLeft = (b: Battle, id: SideId) => b.active(id).lasting.find((l) => l.key === STORM)?.turns ?? 0;
const inStorm = (b: Battle, id: SideId) => stormLeft(b, id) > 0;

/** Thunderstorm arrives: clock resets to zero, Thunderstorm for 2 turns, bolt of 8% */
function stormArrives(b: Battle, id: SideId): void {
  b.active(id).vars[CLOCK] = 0;
  b.text('雷雲壓頂，「雷暴」降臨！');
  const l = b.addLasting(id, STORM, STORM_TURNS);
  // At the end of the turn it arrives it first loses 1, so give 1 extra turn to make the Thunderstorm act on the next 2 turns
  l.turns = STORM_TURNS + 1;
  const f = b.foe(id);
  if (b.active(f).fainted) return;
  b.traitEvent(id, '雷雲');
  b.trueDamage(f, STORM_BOLT, 'storm');
}

/** Extends the Thunderstorm by n turns */
function extendStorm(b: Battle, id: SideId, n: number): void {
  const l = b.active(id).lasting.find((x) => x.key === STORM);
  if (!l) return;
  l.turns += n;
  b.text(`「雷暴」延長了 ${n} 回合！`);
}

/** Advances the Storm Clock (it does not move during a Thunderstorm) */
function windClock(b: Battle, id: SideId, n: number): void {
  if (inStorm(b, id)) return;
  const c = b.active(id);
  c.vars[CLOCK] = Math.min(CLOCK_MAX, clockOf(b, id) + n);
}

/** Multi-hit skill: +2 hits during a Thunderstorm */
const stormHits = (b: Battle, c: HitCtx, n: number) => (inStorm(b, c.attacker) ? n + 2 : n);

// ───────────── AI: first use wind to fill the clock, then pour out the multi-hits during the Thunderstorm ─────────────

/** Using a wind skill this turn means the Thunderstorm arrives at the end of the turn (it will not without wind) */
function windBrings(b: Battle, id: SideId): boolean {
  if (inStorm(b, id)) return false;
  const n = clockOf(b, id);
  return n + 1 < CLOCK_MAX && n + 2 >= CLOCK_MAX;
}

/** Worth preparing a Thunderstorm first: cannot KO the opponent this turn, and can survive one hit from the opponent */
function safeToSetup(b: Battle, id: SideId): boolean {
  const { mine, theirs } = bestHits(b, id);
  return mine < b.active(b.foe(id)).hp && theirs < b.active(id).hp;
}

/** Can use `thunderbird_gather_clouds` to move the clock from 0 to a Thunderstorm next turn */
function gatherWanted(b: Battle, id: SideId): boolean {
  const me = b.active(id);
  return !inStorm(b, id) && clockOf(b, id) === 0 && me.skills.includes(STORM) && b.canUse(id, STORM).ok && safeToSetup(b, id);
}

/** Wind skills: a bonus when they can bring a Thunderstorm, a penalty during a Thunderstorm (the clock does not move) */
function windScore(b: Battle, id: SideId): number {
  if (inStorm(b, id)) return -25;
  return windBrings(b, id) && safeToSetup(b, id) ? 40 : 0;
}

/** Multi-hit skills: a bonus during a Thunderstorm; a penalty when it should first use wind to bring the Thunderstorm (when it can KO directly, the base score decides) */
function payoffScore(b: Battle, id: SideId, skillId: string): number {
  if (inStorm(b, id)) return 15;
  if (b.estimate(id, skillId) >= b.active(b.foe(id)).hp) return 0;
  if (windBrings(b, id) && safeToSetup(b, id)) return -40;
  if (gatherWanted(b, id)) return -20;
  return 0;
}

/** Hooks shared by multi-hit skills (also records whether the opponent can block thunder attacks, e.g. Lightning Rod) */
const stormBarrage = (skillId: string): SkillHooks => ({
  hits: stormHits,
  afterAttack: (b, c) => noteLanded(b, c),
  afterUse: (b, id) => noteBlocked(b, id),
  aiScore: (b, id) => (blockedBefore(b, id, skillId, 1) ? -150 : payoffScore(b, id, skillId)),
});

// ═════════════════════════ `stormram`: Overcharge ═════════════════════════
// Charge gained after the charge is full at 3 stacks overflows into "Overcharge" (max 3 stacks, e: key resets to zero on leaving; the engine's chargeOverflow hook).
// Discharge skills spend charge and Overcharge, and each stack of Overcharge is worth 2x the power of a stack of charge; at the end of the turn each stack of Overcharge leaks 5%.
// Trait "Static Wool" (rewritten): charge +1 on entering and +1 at the end of the turn each, and when full it also overflows into Overcharge.

const OC = 'e:srm:oc';
const OC_MAX = 3;
/** Leak: per stack of Overcharge, per turn (% of max HP) */
const LEAK = 5;
/** `stormram_insulate`: no leaking for 3 turns */
const INSULATE = 'stormram_insulate';

const ocOf = (b: Battle, id: SideId) => b.active(id).vars[OC] ?? 0;
/** Charge plus Overcharge */
const bankOf = (b: Battle, id: SideId) => b.active(id).charges + ocOf(b, id);

function addOvercharge(b: Battle, id: SideId, n: number): void {
  const c = b.active(id);
  const v = Math.min(OC_MAX, ocOf(b, id) + n);
  if (v === ocOf(b, id)) return;
  c.vars[OC] = v;
  b.text(`${c.name} 的羊毛過充了！（過充 ${v} 層）`);
}

/** Discharge: spends all charge and Overcharge */
function spendBank(b: Battle, id: SideId): void {
  const c = b.active(id);
  if (c.charges > 0) b.addCharges(id, -c.charges);
  c.vars[OC] = 0;
}

/** Worth banking one more turn: cannot KO the opponent this turn, and can survive one hit from the opponent (with some margin) */
function canBank(b: Battle, id: SideId): boolean {
  const { mine, theirs } = bestHits(b, id);
  // Leave a little margin for crits and follow-up attacks
  return mine < b.active(b.foe(id)).hp && theirs * 1.3 < b.active(id).hp;
}

/** AI for discharge skills: release quickly at 2 or more stacks of Overcharge; while still safe and Overcharge is below 2 stacks, bank first */
function releaseScore(b: Battle, id: SideId, skillId: string): number {
  if (bankOf(b, id) === 0) return -40;
  if (b.estimate(id, skillId) >= b.active(b.foe(id)).hp) return 0;
  if (ocOf(b, id) >= 2) return 15;
  return canBank(b, id) ? -25 : 0;
}

// ═════════════════════════ `stormhorse`: Thunder Hoof Pursuit ═════════════════════════
// After an attack hits a "paralyzed" opponent, the herd pursues: stomps once more with `stormhorse_thunder_hoof` (costs no aether, once per turn).
// When `stormhorse_thunder_hoof` hits a paralyzed opponent, the paralysis is extended by 1 turn (at most 2 turns left). The trait keeps "Stampede" (the old implementation).

const HOOF = 'stormhorse_thunder_hoof';
/** Already pursued this turn (stores the turn number; e: key cleared on leaving) */
const PURSUED = 'e:shr:pursued';
/** `stormhorse_gallop`: for 3 turns the pursuing `stormhorse_thunder_hoof` gets power +30 */
const GALLOP = 'stormhorse_gallop';

const paralyzed = (b: Battle, id: SideId) => !!b.active(id).status.paralyze;

/**
 * Pursuit: when the opponent is paralyzed and has not been pursued this turn, pursues with `stormhorse_thunder_hoof` times times.
 * force = needs no paralysis and is not limited to once per turn (`stormhorse_thunder_herd`, `u_stormhorse`).
 */
function pursue(b: Battle, c: HitCtx, res: AttackResult, times = 1, force = false): void {
  if (c.followUp || c.estimate || res.ko) return;
  const me = b.active(c.attacker);
  if (b.active(c.defender).fainted) return;
  if (!force && (!paralyzed(b, c.defender) || me.vars[PURSUED] === b.s.turn)) return;
  me.vars[PURSUED] = b.s.turn;
  for (let i = 0; i < times; i++) b.followUp(c.attacker, HOOF, 1, i === 0 ? '馬群追擊！' : undefined);
}

/** Extends paralysis by 1 turn (at most 2 turns left) */
function extendParalysis(b: Battle, id: SideId): void {
  const st = b.active(id).status.paralyze;
  if (st) st.turns = Math.min(2, st.turns + 1);
}

/** Pursuit is ready (the opponent is paralyzed and has not been pursued this turn) */
const pursuitReady = (b: Battle, id: SideId) => paralyzed(b, b.foe(id)) && b.active(id).vars[PURSUED] !== b.s.turn;

/** The opponent can be paralyzed */
function horseCanParalyze(b: Battle, id: SideId): boolean {
  const d = b.active(b.foe(id));
  return !d.elements.includes('thunder') && !d.status.paralyze && b.s.field?.element !== 'light';
}

/** `stormhorse` attacks: a bonus when pursuit is ready (the estimate does not include the pursuing `stormhorse_thunder_hoof`) */
const huntScore = (b: Battle, id: SideId) => (pursuitReady(b, id) ? 12 : 0);

/** Ordinary attack: pursues after hitting */
const withPursuit = (): SkillHooks => ({
  afterAttack: (b, c, r) => pursue(b, c, r),
  aiScore: (b, id) => huntScore(b, id),
});

// ═════════════════════════ `hedgehog`: Electric Needles ═════════════════════════
// Up to 5 "Electric Needles" on its back (e: key cleared on leaving). "Volley" skills spend all the needles, each adding 1 hit to the multi-hit.
// Trait "Lightning Rod" (rewritten): absorbs thunder attacks, Electric Needles +2 (the old implementation gave charge).

const NEEDLES = 'e:hog:needles';
const NEEDLE_MAX = 5;
const BRISTLE = 'hedgehog_bristle';

const needlesOf = (b: Battle, id: SideId) => b.active(id).vars[NEEDLES] ?? 0;
const isHog = (b: Battle, id: SideId) => b.active(id).species.id === 'hedgehog';

function addNeedles(b: Battle, id: SideId, n: number): void {
  const c = b.active(id);
  const v = Math.min(NEEDLE_MAX, needlesOf(b, id) + n);
  if (v === needlesOf(b, id)) return;
  c.vars[NEEDLES] = v;
  b.text(`${c.name} 背上的電針：${v} 根`);
}

/** The biggest estimated damage the opponent can deal to `hedgehog` (thunder attacks are absorbed by Lightning Rod and do not count) */
function hogThreat(b: Battle, id: SideId): number {
  const f = b.foe(id);
  const foe = b.active(f);
  let m = 0;
  for (const s of [...foe.skills, ...(foe.ultimate && !b.side(f).ultUsed ? [foe.ultimate] : [])]) {
    const sk = getSkill(s);
    if (sk.power > 0 && sk.element !== 'thunder' && sk.category !== 'status' && sk.category !== 'trap' && b.canUse(f, s).ok) m = Math.max(m, b.estimate(f, s));
  }
  return m;
}

/** All the opponent's attacks are thunder (they would only be absorbed by Lightning Rod) */
function onlyThunder(b: Battle, id: SideId): boolean {
  const foe = b.active(b.foe(id));
  const atks = foe.skills.map(getSkill).filter((sk) => sk.power > 0 && sk.category !== 'status' && sk.category !== 'trap');
  return atks.length > 0 && atks.every((sk) => sk.element === 'thunder');
}

/** Worth bristling to build needles first: fewer than 3 needles, cannot KO the opponent this turn, and can survive one hit from the opponent (the ones that can reach it) */
function hogCanBuild(b: Battle, id: SideId): boolean {
  const me = b.active(id);
  if (needlesOf(b, id) >= 3 || !me.skills.includes(BRISTLE) || !b.canUse(id, BRISTLE).ok) return false;
  return bestHits(b, id).mine < b.active(b.foe(id)).hp && hogThreat(b, id) * 1.3 < me.hp;
}

/** AI for volley skills: release quickly at 3 or more needles; while it can still safely build needles and has 1 or fewer, build first */
function volleyScore(b: Battle, id: SideId, skillId: string): number {
  if (b.estimate(id, skillId) >= b.active(b.foe(id)).hp) return 0;
  const n = needlesOf(b, id);
  if (n >= 3) return 15;
  return n <= 1 && hogCanBuild(b, id) ? -25 : 0;
}

/** Volley: hits + needles (extra = needles added before the volley, used by the ultimate); all needles are spent after use (even if guarded) */
const volley = (skillId: string, extra = 0): SkillHooks => ({
  hits: (b, c, base) => base + Math.min(NEEDLE_MAX, needlesOf(b, c.attacker) + extra),
  afterUse: (b, id) => {
    b.active(id).vars[NEEDLES] = 0;
  },
  aiScore: (b, id) => volleyScore(b, id, skillId),
});

// ═════════════════════════ `ballspark`: Criticality ═════════════════════════
// At the end of the turn, if an attack skill was used this turn -> "Criticality" +1 (max 3, e: key resets to zero on leaving). "Detonate" skills spend all Criticality for power,
// and Criticality does not rise on a turn that used a detonation. Trait "Unstable" (rewritten): when knocked out by an attack, the one who knocked it out takes 10% plus 5% per stack of Criticality.

const CRITICAL = 'e:bsp:critical';
const CRITICAL_MAX = 3;
/** Used a detonation this turn (stores the turn number) */
const DETONATED = 'e:bsp:detonated';
const BURST = 'ballspark_ball_burst';

const criticalOf = (b: Battle, id: SideId) => b.active(id).vars[CRITICAL] ?? 0;

function addCritical(b: Battle, id: SideId, n: number): void {
  const c = b.active(id);
  const v = Math.min(CRITICAL_MAX, criticalOf(b, id) + n);
  if (v === criticalOf(b, id)) return;
  c.vars[CRITICAL] = v;
  b.text(`${c.name} 越來越不穩定了！（臨界 ${v} 層）`);
}

/** Cannot survive the opponent's hit this turn */
const doomed = (b: Battle, id: SideId) => bestHits(b, id).theirs >= b.active(id).hp;

/**
 * AI for self-destruct skills: can KO the opponent's last spirit -> big bonus (the match ends directly, it does not faint);
 * can KO but the opponent still has a bench -> a one-for-one trade; when it cannot KO, it explodes only if it would not survive anyway and a teammate can take over.
 */
function blastScore(b: Battle, id: SideId, skillId: string): number {
  const f = b.foe(id);
  const ko = b.estimate(id, skillId) >= b.active(f).hp;
  if (ko) return b.aliveBench(f).length === 0 ? 80 : doomed(b, id) ? 45 : 25;
  return doomed(b, id) && b.aliveBench(id).length > 0 ? 20 : -150;
}

/** Detonate: power + per for each stack of Criticality; all Criticality is spent after use (even if guarded) */
const detonate = (per: number, ai: (b: Battle, id: SideId) => number): SkillHooks => ({
  power: (b, c, base) => base + per * criticalOf(b, c.attacker),
  afterUse: (b, id) => {
    const c = b.active(id);
    c.vars[CRITICAL] = 0;
    c.vars[DETONATED] = b.s.turn;
  },
  aiScore: ai,
});

/** Worth pressurizing first: Criticality at 1 or below, cannot KO the opponent this turn, can survive one hit from the opponent (with some margin), and has a detonation skill */
function ballCanPressurize(b: Battle, id: SideId): boolean {
  const me = b.active(id);
  if (criticalOf(b, id) > 1 || !me.skills.some((s) => s === BURST || s === 'ballspark_pop')) return false;
  const { mine, theirs } = bestHits(b, id);
  return mine < b.active(b.foe(id)).hp && theirs * 1.3 < me.hp;
}

// ═════════════════════════ `voltadillo`: Armor Charge ═════════════════════════
// When attacked, the shell gains +1 "stored charge" (max 4 notches, e: key). "Release" skills spend all the stored charge, +1 of our aether per notch;
// `voltadillo_shell_ram` and `voltadillo_thunder_roll` turn stored charge into power. Trait "Charged Carapace" (rewritten): when switching out or fainting, the remaining stored charge turns into our aether.

const PLATE = 'e:vdl:plate';
const PLATE_MAX = 4;
/** Attacked this turn (stores the turn number) */
const STRUCK = 'e:vdl:struck';
const ARMOR = 'voltadillo_thunder_armor';

const plateOf = (b: Battle, id: SideId) => b.active(id).vars[PLATE] ?? 0;
const isDillo = (b: Battle, id: SideId) => b.active(id).species.id === 'voltadillo';

function addPlate(b: Battle, id: SideId, n: number): void {
  const c = b.active(id);
  const v = Math.min(PLATE_MAX, plateOf(b, id) + n);
  if (v === plateOf(b, id)) return;
  c.vars[PLATE] = v;
  b.text(`${c.name} 的背甲蓄能：${v} 格`);
}

/** Release: spends all the stored charge, +1 of our aether per notch. Returns the number of notches released */
function releasePlate(b: Battle, id: SideId): number {
  const n = plateOf(b, id);
  if (n <= 0) return 0;
  b.active(id).vars[PLATE] = 0;
  b.text(`背甲放能：靈能 +${n}`);
  b.gainAether(id, n);
  return n;
}

/** AI for release: release at 3 or more notches, or when aether is not enough for a big skill; do not release when aether is nearly full (it would overflow) */
function plateReleaseScore(b: Battle, id: SideId): number {
  const n = plateOf(b, id);
  const ae = b.side(id).aether;
  if (n === 0 || ae + n > 10) return -100;
  if (n >= 3 && ae <= 6) return 30;
  return n >= 2 && ae < 3 ? 20 : -15;
}

export const FX: Record<string, SkillHooks> = {
  // `voltarion_thunder_step`: charge +1 when moving first (Swift Thunder is checked first, then charge accumulates). It also holds the lasting effect for "Stun"
  voltarion_thunder_step: {
    afterAttack: (b, c, r) => {
      noteLanded(b, c);
      swift(b, c, r);
      if (!c.followUp && !b.hasActed(c.defender)) b.addCharges(c.attacker, 1);
    },
    afterUse: (b, id) => noteBlocked(b, id),
    aiScore: (b, id) => {
      const base = strikeScore(b, id, 'voltarion_thunder_step');
      const me = b.active(id);
      if (me.charges >= SWIFT_COST || !likelyFirst(b, id, 'voltarion_thunder_step')) return base;
      // Ahead on speed, one stack short of Swift Thunder, cannot KO the opponent this turn and can survive: fill up with `voltarion_thunder_step` first, and stun next turn
      const f = b.foe(id);
      const hits = bestHits(b, id);
      const arm = me.charges === SWIFT_COST - 1 && !b.getLasting(f, CALM) && hits.mine < b.active(f).hp && hits.theirs < me.hp;
      return base + (arm ? 60 : 12);
    },
    lasting: {
      name: '震懾',
      // Guard (priority +3) always comes before Swift Thunder, so it can be used as usual
      blockAction: (_b, _owner, sk) => (sk.id === 'guard' ? null : '被震懾，無法行動'),
    },
  },

  // `voltarion_startle`: priority +1. It also holds the lasting effect for "Composure" (it has no hooks, used only for the check and display)
  voltarion_startle: {
    ...swiftOnly('voltarion_startle'),
    lasting: { name: '定神' },
  },

  // `voltarion_storm_net`: charge +2 when the opponent is already paralyzed (checked before the paralysis is applied)
  voltarion_storm_net: {
    afterAttack: (b, c, r) => {
      noteLanded(b, c);
      const was = !!b.active(c.defender).status.paralyze;
      swift(b, c, r);
      if (was && !r.ko) b.addCharges(c.attacker, 2);
    },
    afterUse: (b, id) => noteBlocked(b, id),
    aiScore: (b, id) => {
      const foe = b.active(b.foe(id));
      return strikeScore(b, id, 'voltarion_storm_net') + (foe.status.paralyze && b.active(id).charges < SWIFT_COST ? 15 : 0);
    },
  },

  // `voltarion_summon_storm`: the field and the charge are both resolved by tags; do not use it when the field is already Thundercloud with 2 or more turns left
  voltarion_summon_storm: {
    aiScore: (b, id) => {
      const f = b.s.field;
      if (f?.element === 'thunder' && f.turns >= 2) return -60;
      return b.active(id).charges < SWIFT_COST ? 8 : 0;
    },
  },

  // `voltarion_smite`: ignores guard; charge +2 when it breaks through a guard
  voltarion_smite: {
    afterAttack: (b, c, r) => {
      noteLanded(b, c);
      swift(b, c, r);
      if (c.guardBroken) b.addCharges(c.attacker, 2);
    },
    afterUse: (b, id) => noteBlocked(b, id),
    aiScore: (b, id) => {
      const f = b.foe(id);
      const foe = b.active(f);
      const sd = b.side(id);
      // The opponent may guard: we have Swift Thunder fully charged or the ultimate in hand
      const canGuard = foe.lastGuardTurn !== b.s.turn && b.side(f).aether >= 1;
      const threat = swiftReady(b, id) || (!!b.active(id).ultimate && !sd.ultUsed && sd.aether >= 5);
      return strikeScore(b, id, 'voltarion_smite') + (canGuard && threat ? 18 : 0);
    },
  },

  // `voltarion_rod_array`: reduces the damage of the attack taken by 30%, charge +3 for our active spirit
  voltarion_rod_array: {
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => ({ reduce: 0.3, after: () => b.addCharges(owner, 3) }),
    },
    aiScore: (b, id) => (b.active(id).charges < SWIFT_COST ? 30 : -30),
  },

  // `voltarion_flash`: priority +1; power +40 at full charge (power is computed first, and Swift Thunder spends the charge after the hit)
  voltarion_flash: {
    power: (b, c, p) => (b.active(c.attacker).charges >= SWIFT_COST ? p + 40 : p),
    afterAttack: (b, c, r) => {
      noteLanded(b, c);
      swift(b, c, r);
    },
    afterUse: (b, id) => noteBlocked(b, id),
    aiScore: (b, id) => strikeScore(b, id, 'voltarion_flash') + (swiftReady(b, id) ? 10 : 0),
  },

  // `voltarion_edict`: for 3 turns physical and magic skills get priority +1 (the charge is resolved by tags)
  voltarion_edict: {
    effect: (b, id) => void b.addLasting(id, EDICT, 3),
    lasting: {
      name: '雷令',
      priority: (_b, _o, sk) => (isStrike(sk.category) ? 1 : 0),
    },
    aiScore: (b, id) => {
      if (b.getLasting(id, EDICT)) return -100;
      if (b.active(b.foe(id)).vars['e:vlt:noPrio']) return -60;
      const want = setupWanted(b, id);
      if (want === 'edict') return 55;
      if (want === 'wave') return 25;
      const me = b.active(id);
      return !speedFirst(b, id) && me.hp > me.maxHp * 0.6 ? 20 : -15;
    },
  },

  // `voltarion_thunderclap`: power +40 and charge +1 when moving last
  voltarion_thunderclap: {
    power: (b, c, p) => (goesFirst(b, c) ? p : p + 40),
    afterAttack: (b, c, r) => {
      noteLanded(b, c);
      swift(b, c, r);
      if (!c.followUp && b.hasActed(c.defender)) b.addCharges(c.attacker, 1);
    },
    afterUse: (b, id) => noteBlocked(b, id),
    aiScore: (b, id) => strikeScore(b, id, 'voltarion_thunderclap'),
  },

  // `voltarion_sky_cannon`: charges; on release, hitting while moving first always stuns (no charge spent)
  voltarion_sky_cannon: {
    afterAttack: (b, c, r) => {
      noteLanded(b, c);
      swift(b, c, r, { free: true });
    },
    afterUse: (b, id) => noteBlocked(b, id),
    aiScore: (b, id) => {
      const foe = b.active(b.foe(id));
      if (blockedBefore(b, id, 'voltarion_sky_cannon')) return -150;
      if (foe.hp < foe.maxHp * 0.35) return -25;
      return !b.getLasting(b.foe(id), CALM) && likelyFirst(b, id, 'voltarion_sky_cannon') ? 15 : 0;
    },
  },

  // `voltarion_myriad`: power +60 when the opponent has Composure (it was just stunned last turn); this is the next hit after Swift Thunder
  voltarion_myriad: {
    ...swiftOnly('voltarion_myriad'),
    power: (b, c, p) => (b.getLasting(c.defender, CALM) ? p + 60 : p),
    aiScore: (b, id) => strikeScore(b, id, 'voltarion_myriad') + (b.getLasting(b.foe(id), CALM) ? 20 : 0),
  },

  // `u_voltarion`: priority +2; +40 power per stack of charge and spends them all; hitting while moving first always stuns
  u_voltarion: {
    power: (b, c, p) => p + 40 * b.active(c.attacker).charges,
    afterAttack: (b, c, r) => {
      noteLanded(b, c);
      swift(b, c, r, { free: true });
      const n = b.active(c.attacker).charges;
      if (n > 0) b.addCharges(c.attacker, -n);
    },
    afterUse: (b, id) => noteBlocked(b, id),
    aiScore: (b, id) => {
      if (blockedBefore(b, id, 'u_voltarion')) return -150;
      const n = b.active(id).charges;
      return n * 8 + (!b.getLasting(b.foe(id), CALM) && likelyFirst(b, id, 'u_voltarion') ? 20 : 0);
    },
  },

  // ─────────── `thunderbird` ───────────

  // `thunderbird_gust_feather`: a wind skill (the Storm Clock is advanced by the mechanic); it only teaches the AI when to use it
  thunderbird_gust_feather: { aiScore: (b, id) => windScore(b, id) },

  // `thunderbird_twin_bolt`: 2 hits, +2 hits during a Thunderstorm
  thunderbird_twin_bolt: stormBarrage('thunderbird_twin_bolt'),

  // `thunderbird_gather_clouds`: Storm Clock +2 (cannot be used during a Thunderstorm). It also holds the lasting effect for the "Thunderstorm"
  thunderbird_gather_clouds: {
    canUse: (b, id) => (inStorm(b, id) ? '「雷暴」中鐘不走' : null),
    effect: (b, id) => {
      windClock(b, id, 2);
      b.text(`「雷暴鐘」走到 ${clockOf(b, id)} 格。`);
    },
    aiScore: (b, id) => {
      if (clockOf(b, id) + 1 >= CLOCK_MAX) return -60;
      if (windBrings(b, id)) return -30;
      return safeToSetup(b, id) ? 45 : -30;
    },
    lasting: { name: '雷暴' },
  },

  // `thunderbird_bolt_rain`: 3 hits, each with 10% to paralyze (20% under Thundercloud); +2 hits during a Thunderstorm
  thunderbird_bolt_rain: {
    ...stormBarrage('thunderbird_bolt_rain'),
    onHit: (b, c, h) => {
      if (h.ko || c.estimate) return;
      const d = b.active(c.defender);
      if (d.fainted || d.status.paralyze || d.elements.includes('thunder')) return;
      const p = b.s.field?.element === 'thunder' ? 0.2 : 0.1;
      if (b.rng() < p) b.applyStatus(c.defender, 'paralyze');
    },
    aiScore: (b, id) => {
      if (blockedBefore(b, id, 'thunderbird_bolt_rain', 1)) return -150;
      const d = b.active(b.foe(id));
      return payoffScore(b, id, 'thunderbird_bolt_rain') + (!d.status.paralyze && !d.elements.includes('thunder') ? 6 : 0);
    },
  },

  // `thunderbird_sweep_clouds`: clears turns (resolved by tags); a bonus when the opponent has turn-based effects
  thunderbird_sweep_clouds: {
    aiScore: (b, id) => {
      const f = b.foe(id);
      const fsd = b.side(f);
      const n =
        [...b.active(f).lasting, ...fsd.lasting].filter((l) => l.from === f).length +
        (fsd.screens.physTurns > 0 || fsd.screens.magTurns > 0 ? 1 : 0) +
        (fsd.tailwind > 0 ? 1 : 0);
      return windScore(b, id) + n * 25;
    },
  },

  // `thunderbird_thousand_bolts`: 4 hits, +2 hits during a Thunderstorm
  thunderbird_thousand_bolts: stormBarrage('thunderbird_thousand_bolts'),

  // `thunderbird_cloud_ambush`: when the opponent uses a status skill, a bolt of 12%; the Storm Clock fills up (during a Thunderstorm it extends it by 1 turn instead)
  thunderbird_cloud_ambush: {
    trap: {
      on: 'foeStatus',
      fire: (b, owner) => {
        const f = b.foe(owner);
        if (!b.active(f).fainted) b.trueDamage(f, 12, 'storm');
        if (b.active(owner).species.id !== 'thunderbird') return;
        if (inStorm(b, owner)) extendStorm(b, owner, 1);
        else {
          b.active(owner).vars[CLOCK] = CLOCK_MAX;
          b.text('「雷暴鐘」走滿了！回合結束時「雷暴」降臨。');
        }
      },
    },
    aiScore: (b, id) => (inStorm(b, id) ? -20 : 30),
  },

  // `thunderbird_roost`: the heal is resolved by tags; the wind element advances the Storm Clock
  thunderbird_roost: { aiScore: (b, id) => windScore(b, id) },

  // `thunderbird_gale_spiral`: a wind attack with priority +1
  thunderbird_gale_spiral: {
    aiScore: (b, id) => {
      const f = b.foe(id);
      const ko = b.estimate(id, 'thunderbird_gale_spiral') >= b.active(f).hp;
      return windScore(b, id) + (ko && !speedFirst(b, id) ? 30 : 0);
    },
  },

  // `thunderbird_storm_unleashed`: during a Thunderstorm +3 hits for each remaining turn (max 2), and the Thunderstorm ends when used up (even if guarded)
  thunderbird_storm_unleashed: {
    hits: (b, c, n) => n + 3 * Math.min(2, stormLeft(b, c.attacker)),
    afterAttack: (b, c) => noteLanded(b, c),
    afterUse: (b, id) => {
      noteBlocked(b, id);
      if (!inStorm(b, id)) return;
      b.removeLasting(id, STORM);
      b.text('雷暴傾瀉殆盡，雲層散開了。');
    },
    aiScore: (b, id) => {
      if (blockedBefore(b, id, 'thunderbird_storm_unleashed', 1)) return -150;
      const left = stormLeft(b, id);
      if (left === 0) return b.estimate(id, 'thunderbird_storm_unleashed') >= b.active(b.foe(id)).hp ? 0 : -40;
      if (left === 1) return -5;
      // Thunderstorm with 2 turns left: pour it all out at once if we cannot survive the next hit, otherwise split it over two turns
      const { theirs } = bestHits(b, id);
      return theirs >= b.active(id).hp ? 25 : -35;
    },
  },

  // `u_thunderbird`: 5 hits, +2 hits during a Thunderstorm; after hitting, a Thunderstorm arrives for 2 turns (during a Thunderstorm it extends it by 2 turns)
  u_thunderbird: {
    hits: stormHits,
    afterAttack: (b, c) => {
      noteLanded(b, c);
      if (c.followUp) return;
      if (inStorm(b, c.attacker)) extendStorm(b, c.attacker, STORM_TURNS);
      else stormArrives(b, c.attacker);
    },
    afterUse: (b, id) => noteBlocked(b, id),
    aiScore: (b, id) => {
      if (blockedBefore(b, id, 'u_thunderbird', 1)) return -150;
      return inStorm(b, id) ? 25 : safeToSetup(b, id) ? 10 : 0;
    },
  },

  // ─────────── `stormram` ───────────

  // `stormram_discharge`: +25 per stack of charge and +50 per stack of Overcharge; all are spent after use (even if guarded)
  stormram_discharge: {
    power: (b, c, p) => p + 25 * b.active(c.attacker).charges + 50 * ocOf(b, c.attacker),
    afterUse: (b, id) => spendBank(b, id),
    aiScore: (b, id) => releaseScore(b, id, 'stormram_discharge'),
  },

  // `stormram_wool_charge`: charge +2, heals 10% (resolved by tags; when full it overflows into Overcharge)
  stormram_wool_charge: {
    aiScore: (b, id) => {
      if (b.active(id).charges >= 3 && ocOf(b, id) >= OC_MAX) return -80;
      if (!canBank(b, id)) return -20;
      return bankOf(b, id) <= 3 ? 30 : 0;
    },
  },

  // `stormram_vent`: spends all Overcharge, healing 12% per stack
  stormram_vent: {
    canUse: (b, id) => (ocOf(b, id) > 0 ? null : '沒有過充'),
    effect: (b, id) => {
      const n = ocOf(b, id);
      b.active(id).vars[OC] = 0;
      b.text('羊毛裡的過充靜靜地洩掉了。');
      b.heal(id, 12 * n);
    },
    aiScore: (b, id) => {
      const me = b.active(id);
      return ocOf(b, id) >= 2 && me.hp < me.maxHp * 0.45 && bestHits(b, id).mine < b.active(b.foe(id)).hp ? 50 : -40;
    },
  },

  // `stormram_wool_cushion`: keeps 1 HP when about to be knocked out; vents all Overcharge (so the leak does not shock itself) and refills charge to 3 stacks
  stormram_wool_cushion: {
    trap: {
      on: 'lethal',
      fire: (b, owner) => ({
        survive: true,
        after: () => {
          const c = b.active(owner);
          c.vars[OC] = 0;
          if (c.charges < 3) b.addCharges(owner, 3 - c.charges);
        },
      }),
    },
    aiScore: (b, id) => (b.active(id).hp > b.active(id).maxHp * 0.5 ? 35 : 15),
  },

  // `stormram_arc`: +20 per stack of Overcharge (not spent)
  stormram_arc: {
    power: (b, c, p) => p + 20 * ocOf(b, c.attacker),
  },

  // `stormram_insulate`: no leaking for 3 turns (the charge is resolved by tags)
  stormram_insulate: {
    effect: (b, id) => void b.addLasting(id, INSULATE, 3),
    lasting: { name: '絕緣' },
    aiScore: (b, id) => {
      if (b.getLasting(id, INSULATE)) return -100;
      return canBank(b, id) && bankOf(b, id) >= 2 ? 35 : -10;
    },
  },

  // `stormram_overload`: spends all Overcharge, 15% damage per stack (on a hit); ignores guard at 3 stacks of Overcharge
  stormram_overload: {
    pierceGuard: (b, id) => ocOf(b, id) >= OC_MAX,
    afterAttack: (b, c) => {
      const n = ocOf(b, c.attacker);
      if (n > 0 && !b.active(c.defender).fainted) b.trueDamage(c.defender, 15 * n, 'overload');
    },
    afterUse: (b, id) => void (b.active(id).vars[OC] = 0),
    aiScore: (b, id) => {
      const n = ocOf(b, id);
      if (n === 0) return -100;
      const foe = b.active(b.foe(id));
      const extra = (foe.maxHp * 0.15 * n) / Math.max(1, foe.hp);
      const ko = b.estimate(id, 'stormram_overload') + foe.maxHp * 0.15 * n >= foe.hp;
      return Math.min(1, extra) * 100 + (ko ? 60 : 0) + (n < 2 && canBank(b, id) ? -30 : 0);
    },
  },

  // `u_stormram`: +35 per stack of charge and Overcharge, all spent after use
  u_stormram: {
    power: (b, c, p) => p + 35 * bankOf(b, c.attacker),
    afterUse: (b, id) => spendBank(b, id),
    aiScore: (b, id) => (bankOf(b, id) >= 3 ? 20 : -20),
  },

  // ─────────── `stormhorse` ───────────

  // `stormhorse_thunder_hoof`: extends paralysis when it hits a paralyzed opponent; this is the skill the pursuit uses. Power +30 during `stormhorse_gallop`
  stormhorse_thunder_hoof: {
    power: (b, c, p) => (b.getLasting(c.attacker, GALLOP) ? p + 30 : p),
    afterAttack: (b, c, r) => {
      if (!r.ko && paralyzed(b, c.defender)) extendParalysis(b, c.defender);
      pursue(b, c, r);
    },
    aiScore: (b, id) => huntScore(b, id),
  },

  stormhorse_mane_jolt: withPursuit(),

  // `stormhorse_run_down`: hits first when the opponent switches (power x2)
  stormhorse_run_down: { ...withPursuit(), pursuit: 2 },

  // `stormhorse_trample`: +60 when the opponent is paralyzed, and clears the paralysis (no pursuit)
  stormhorse_trample: {
    power: (b, c, p) => (paralyzed(b, c.defender) ? p + 60 : p),
    afterAttack: (b, c) => {
      if (paralyzed(b, c.defender)) b.removeStatus(c.defender, 'paralyze');
    },
    aiScore: (b, id) => {
      const st = b.active(b.foe(id)).status.paralyze;
      if (!st) return -10;
      if (b.estimate(id, 'stormhorse_trample') >= b.active(b.foe(id)).hp) return 0;
      return st.turns <= 1 ? 10 : -20;
    },
  },

  // `stormhorse_static_mane`: when the opponent's attack hits, paralyzes the attacker
  stormhorse_static_mane: {
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => ({ after: () => void b.applyStatus(b.foe(owner), 'paralyze') }),
    },
    aiScore: (b, id) => (horseCanParalyze(b, id) ? 25 : -30),
  },

  // `stormhorse_gallop`: for 3 turns the pursuing `stormhorse_thunder_hoof` gets power +30 (speed is resolved by tags)
  stormhorse_gallop: {
    effect: (b, id) => void b.addLasting(id, GALLOP, 3),
    lasting: { name: '奔騰' },
    aiScore: (b, id) => {
      if (b.getLasting(id, GALLOP)) return -100;
      return canBank(b, id) && (paralyzed(b, b.foe(id)) || horseCanParalyze(b, id)) ? 25 : -20;
    },
  },

  // `stormhorse_stampede`: when the opponent is paralyzed, the pursuit becomes 2 hits of `stormhorse_thunder_hoof`
  stormhorse_stampede: {
    afterAttack: (b, c, r) => pursue(b, c, r, 2),
    aiScore: (b, id) => (pursuitReady(b, id) ? 30 : 0),
  },

  stormhorse_bolt_charge: withPursuit(),

  // `stormhorse_shock_hoof`: 60% to paralyze (the tag resolves after the pursuit check); power +40 when already paralyzed
  stormhorse_shock_hoof: {
    power: (b, c, p) => (paralyzed(b, c.defender) ? p + 40 : p),
    afterAttack: (b, c, r) => pursue(b, c, r),
    aiScore: (b, id) => huntScore(b, id) + (horseCanParalyze(b, id) ? 20 : 0),
  },

  // `stormhorse_thunder_herd`: always pursues once more after hitting (needs no paralysis, not limited to once per turn)
  stormhorse_thunder_herd: {
    afterAttack: (b, c, r) => pursue(b, c, r, 1, true),
    aiScore: (b, id) => huntScore(b, id) + 10,
  },

  // `u_stormhorse`: first paralyzes the opponent, then pursues with 2 hits of `stormhorse_thunder_hoof`
  u_stormhorse: {
    manual: ['status.paralyze'],
    afterAttack: (b, c, r) => {
      if (r.ko || c.followUp) return;
      if (!paralyzed(b, c.defender)) b.applyStatus(c.defender, 'paralyze');
      pursue(b, c, r, 2, true);
    },
    aiScore: (b, id) => (canBank(b, id) ? 0 : 10),
  },

  // ── `hedgehog` ──
  // `hedgehog_quill_shot` (starts at 1 hit), `hedgehog_needle_storm`, `hedgehog_quick_needle`: volley
  hedgehog_quill_shot: volley('hedgehog_quill_shot'),
  hedgehog_needle_storm: volley('hedgehog_needle_storm'),
  hedgehog_quick_needle: volley('hedgehog_quick_needle'),

  // `hedgehog_bristle`: Electric Needles +3
  hedgehog_bristle: {
    effect: (b, id) => addNeedles(b, id, 3),
    aiScore: (b, id) => (needlesOf(b, id) >= NEEDLE_MAX ? -80 : hogCanBuild(b, id) ? 25 : -20),
  },

  // `hedgehog_static_roll`: Electric Needles +1 after hitting
  hedgehog_static_roll: {
    afterAttack: (b, c) => {
      if (!c.estimate) addNeedles(b, c.attacker, 1);
    },
  },

  // `hedgehog_needle_coat`: fires on the opponent's physical attack; Electric Needles +2, and after the attack resolves the attacker takes 10%
  hedgehog_needle_coat: {
    trap: {
      on: 'foeAttack',
      when: (_b, _owner, ev) => ev.ctx.cat === 'physical',
      fire: (b, owner) => {
        if (isHog(b, owner)) addNeedles(b, owner, 2);
        return { after: () => b.trueDamage(b.foe(owner), 10, 'needle') };
      },
    },
    aiScore: (b, id) => {
      const foe = b.active(b.foe(id));
      return foe.skills.some((s) => getSkill(s).category === 'physical' && getSkill(s).element !== 'thunder') ? 10 : -40;
    },
  },

  // `hedgehog_lure_rod`: the opponent's attack (other than thunder, which is absorbed anyway) is void, Electric Needles +2
  hedgehog_lure_rod: {
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => {
        b.traitEvent(owner, '避雷針');
        if (isHog(b, owner)) addNeedles(b, owner, 2);
        return { negate: true };
      },
    },
    aiScore: (b, id) => (onlyThunder(b, id) ? -40 : hogThreat(b, id) >= b.active(id).hp * 0.3 ? 15 : 0),
  },

  // `u_hedgehog`: first adds 3 needles, then volley
  u_hedgehog: volley('u_hedgehog', 3),

  // ── `ballspark` ──
  // `ballspark_pop`: detonate (+30 per stack). Only worthwhile at 2 or more stacks of Criticality
  ballspark_pop: detonate(30, (b, id) => (criticalOf(b, id) === 0 ? -20 : criticalOf(b, id) >= 2 ? 10 : 0)),

  // `ballspark_ball_burst`: detonate (+35 per stack) plus self-destruct
  ballspark_ball_burst: detonate(35, (b, id) => blastScore(b, id, BURST)),

  // `u_ballspark`: detonate (+40 per stack) plus ignore guard plus self-destruct. Keep the ultimate when `ballspark_ball_burst` can already KO
  u_ballspark: detonate(40, (b, id) => {
    const burstKo = b.active(id).skills.includes(BURST) && b.canUse(id, BURST).ok && b.estimate(id, BURST) >= b.active(b.foe(id)).hp;
    return blastScore(b, id, 'u_ballspark') - (burstKo ? 40 : 0);
  }),

  // `ballspark_pressurize`: Criticality +2 (MAG +1 is resolved by tags)
  ballspark_pressurize: {
    effect: (b, id) => addCritical(b, id, 2),
    aiScore: (b, id) => (ballCanPressurize(b, id) ? 20 : -30),
  },

  // `ballspark_overheat_shot`: Criticality +1 after hitting
  ballspark_overheat_shot: {
    afterAttack: (b, c) => {
      if (!c.estimate) addCritical(b, c.attacker, 1);
    },
  },

  // `ballspark_chain_lightning`: +20 per stack of Criticality (not spent)
  ballspark_chain_lightning: {
    power: (b, c, base) => base + 20 * criticalOf(b, c.attacker),
  },

  // `ballspark_chain_blast`: when our spirit is knocked out by an attack, the one who knocked it out takes 20% and is paralyzed
  ballspark_chain_blast: {
    trap: {
      on: 'fainted',
      when: (b, _owner, ev) => ev.byAttack && !b.active(ev.by).fainted,
      fire: (b, _owner, ev) => {
        b.trueDamage(ev.by, 20, 'blast');
        if (!b.active(ev.by).fainted) b.applyStatus(ev.by, 'paralyze');
      },
    },
    aiScore: (b, id) => (b.aliveBench(id).length > 0 ? 10 : 0),
  },

  // ── `voltadillo` ──
  // `voltadillo_release`: stored charge -> our aether
  voltadillo_release: {
    canUse: (b, id) => (plateOf(b, id) > 0 ? null : '背甲沒有蓄能'),
    effect: (b, id) => void releasePlate(b, id),
    aiScore: (b, id) => plateReleaseScore(b, id),
  },

  // `voltadillo_curl`: stored charge +1 (DEF and RES +1 are resolved by tags)
  voltadillo_curl: {
    effect: (b, id) => addPlate(b, id, 1),
    aiScore: (b, id) => (b.active(id).stages.def >= 2 ? -25 : 0),
  },

  // `voltadillo_shell_ram`: +25 power per notch of stored charge, all stored charge is spent after use
  voltadillo_shell_ram: {
    power: (b, c, base) => base + 25 * plateOf(b, c.attacker),
    afterUse: (b, id) => {
      b.active(id).vars[PLATE] = 0;
    },
    aiScore: (b, id) => (plateOf(b, id) <= 1 ? -15 : 0),
  },

  // `voltadillo_charged_plate`: this attack -40%, stored charge +2 (the 1 notch for being hit is counted separately)
  voltadillo_charged_plate: {
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => {
        if (isDillo(b, owner)) addPlate(b, owner, 2);
        return { reduce: 0.4 };
      },
    },
    aiScore: () => 10,
  },

  // `voltadillo_thunder_roll`: +20 power per notch of stored charge, releases after use (+1 aether per notch)
  voltadillo_thunder_roll: {
    power: (b, c, base) => base + 20 * plateOf(b, c.attacker),
    afterUse: (b, id) => void releasePlate(b, id),
    // At 3 or more notches of stored charge, the power of `voltadillo_thunder_roll` catches up with `voltadillo_backlash`, and it can also trade back for aether
    aiScore: (b, id) => (plateOf(b, id) === 0 ? -25 : plateOf(b, id) >= 3 ? 20 : plateOf(b, id) === 2 ? 5 : -10),
  },

  // `voltadillo_backlash`: +35 when attacked this turn (in estimates: it usually moves last, expected +25). Damage computed with DEF is resolved by tags
  voltadillo_backlash: {
    power: (b, c, base) => {
      if (c.estimate) return base + 25;
      return base + (b.active(c.attacker).vars[STRUCK] === b.s.turn ? 35 : 0);
    },
  },

  // `voltadillo_sand_bath`: stored charge +1 (the heal is resolved by tags)
  voltadillo_sand_bath: {
    effect: (b, id) => addPlate(b, id, 1),
  },

  // `voltadillo_thunder_armor`: attacks taken -20% for 3 turns, and stored charge +1 more when hit
  voltadillo_thunder_armor: {
    effect: (b, id) => void b.addLasting(id, ARMOR, 3),
    lasting: {
      name: '雷鎧',
      reduce: () => 0.2,
      onHitTaken: (b, ctx) => {
        if (!b.active(ctx.defender).fainted) addPlate(b, ctx.defender, 1);
      },
    },
    aiScore: (b, id) => (b.getLasting(id, ARMOR) ? -100 : b.active(id).hp > b.active(id).maxHp * 0.5 ? 25 : 0),
  },

  // `u_voltadillo`: after hitting, stored charge is filled to 4 notches (DEF +1 is resolved by tags)
  u_voltadillo: {
    afterAttack: (b, c) => {
      if (!c.estimate) addPlate(b, c.attacker, PLATE_MAX);
    },
  },
};

/** Spirit id -> kit hooks (signature mechanics, rewritten traits, state marks) */
export const KIT: Record<string, KitHooks> = {
  voltarion: {
    // The trait keeps "Thunder Descent" (on entering, sets Thundercloud for 3 turns and charge +2, the old implementation); here only whether Swift Thunder is ready is shown
    marks: (b, id) => (b.active(id).charges >= SWIFT_COST ? [{ id: 'kit:swift', note: '迅雷' }] : []),
  },

  thunderbird: {
    // Trait "Thundercloud" (rewritten): the Storm Clock moves 1 notch first on entering; a bolt of 8% when a Thunderstorm arrives (see stormArrives)
    onEnter: (b, id) => {
      const c = b.active(id);
      c.vars[CLOCK] = 1;
      c.vars[SEEN] = c.usedSinceEnter;
    },
    // Storm Clock: +1 at the end of each turn, +1 more if a wind skill was used this turn; a Thunderstorm arrives when it reaches 3 notches. The clock does not move during a Thunderstorm
    onEndTurn: (b, id) => {
      const c = b.active(id);
      const used = c.usedSinceEnter !== (c.vars[SEEN] ?? 0);
      c.vars[SEEN] = c.usedSinceEnter;
      if (inStorm(b, id)) return;
      const wind = used && !!c.lastSkill && getSkill(c.lastSkill).element === 'wind';
      const n = Math.min(CLOCK_MAX, clockOf(b, id) + 1 + (wind ? 1 : 0));
      if (n >= CLOCK_MAX) stormArrives(b, id);
      else c.vars[CLOCK] = n;
    },
    marks: (b, id) => (inStorm(b, id) ? [] : [{ id: 'kit:storm_clock', n: clockOf(b, id), note: '雷暴鐘' }]),
  },

  stormram: {
    // Trait "Static Wool" (rewritten): charge +1 on entering and +1 at the end of the turn each. Charge that overflows past 3 stacks becomes Overcharge
    chargeOverflow: (b, id, n) => addOvercharge(b, id, n),
    onEnter: (b, id) => {
      b.traitEvent(id, '蓄電羊毛');
      b.addCharges(id, 1);
    },
    onEndTurn: (b, id) => {
      // Leak first (5% per stack of Overcharge, no leak while insulated), then charge +1
      const n = ocOf(b, id);
      if (n > 0 && !b.getLasting(id, INSULATE)) {
        b.traitEvent(id, '漏電');
        b.trueDamage(id, LEAK * n, 'leak');
      }
      if (!b.active(id).fainted) b.addCharges(id, 1);
    },
    marks: (b, id) => (ocOf(b, id) > 0 ? [{ id: 'kit:overcharge', n: ocOf(b, id), note: '過充' }] : []),
  },

  stormhorse: {
    // The trait keeps "Stampede" (old implementation). Shows "Pursuit" when the opponent is paralyzed and no pursuit has been made this turn
    marks: (b, id) => (pursuitReady(b, id) ? [{ id: 'kit:pursuit', note: '追擊' }] : []),
  },

  hedgehog: {
    // Trait "Lightning Rod" (rewritten): absorbs thunder attacks, Electric Needles +2
    absorb: (b, a) => {
      if (a.sk.element !== 'thunder') return false;
      b.traitEvent(a.defender, '避雷針');
      addNeedles(b, a.defender, 2);
      return true;
    },
    // Do not guard when the opponent has only thunder attacks (let Lightning Rod absorb them)
    aiGuard: (b, id) => (onlyThunder(b, id) ? -60 : 0),
    marks: (b, id) => (needlesOf(b, id) > 0 ? [{ id: 'kit:needles', n: needlesOf(b, id), note: '電針' }] : []),
  },

  ballspark: {
    // Criticality: at the end of the turn, +1 if an attack skill was used this turn (detonations excepted)
    onEndTurn: (b, id) => {
      const c = b.active(id);
      if (c.usedAttackThisTurn && c.vars[DETONATED] !== b.s.turn) addCritical(b, id, 1);
    },
    // Trait "Unstable" (rewritten): when knocked out by an attack, the one who knocked it out takes 10% plus 5% per stack of Criticality
    onFaint: (b, id, by, byAttack) => {
      if (!byAttack || by === id || b.active(by).fainted) return;
      b.traitEvent(id, '不穩定');
      b.trueDamage(by, 10 + 5 * criticalOf(b, id), 'blast');
    },
    // Opponent AI: considers guarding when `ballspark`'s detonation can KO us, or when Criticality is 2 or more and a self-destruct skill is available
    aiFoeGuard: (b, id) => {
      const f = b.foe(id);
      const ready = [BURST, 'u_ballspark'].filter((s) => (b.active(id).skills.includes(s) || b.active(id).ultimate === s) && b.canUse(id, s).ok);
      if (ready.length === 0) return 0;
      return ready.some((s) => b.estimate(id, s) >= b.active(f).hp) || criticalOf(b, id) >= 2 ? 25 : 0;
    },
    marks: (b, id) => (criticalOf(b, id) > 0 ? [{ id: 'kit:critical', n: criticalOf(b, id), note: '臨界' }] : []),
  },

  voltadillo: {
    // Trait "Charged Carapace" (rewritten): stored charge +1 when attacked; when switching out or fainting, the remaining stored charge turns into our aether
    onHitTaken: (b, a) => {
      const c = b.active(a.defender);
      if (c.fainted) return;
      c.vars[STRUCK] = b.s.turn;
      b.traitEvent(a.defender, '蓄能背甲');
      addPlate(b, a.defender, 1);
    },
    onLeave: (b, id, c) => {
      const n = c.vars[PLATE] ?? 0;
      if (n <= 0) return;
      c.vars[PLATE] = 0;
      b.traitEvent(id, '蓄能背甲');
      b.text(`背甲的蓄能交給了隊友：靈能 +${n}`);
      b.gainAether(id, n);
    },
    onFaint: (b, id) => {
      const c = b.active(id);
      const n = c.vars[PLATE] ?? 0;
      if (n <= 0 || b.aliveBench(id).length === 0) return;
      c.vars[PLATE] = 0;
      b.traitEvent(id, '蓄能背甲');
      b.text(`背甲的蓄能留給了隊友：靈能 +${n}`);
      b.gainAether(id, n);
    },
    marks: (b, id) => (plateOf(b, id) > 0 ? [{ id: 'kit:plate', n: plateOf(b, id), note: '蓄能' }] : []),
  },
};
