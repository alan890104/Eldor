// Skill hooks and kit hooks for the light group (data/kits/light.json). See docs/10-kit-authoring.md for how to write them.
// Only `import type { Battle }` is allowed (importing battle.ts at runtime would create a circular dependency).

import { getSkill } from '../../data.ts';
import type { SkillDef } from '../../../sim/types.ts';
import type { Battle } from '../battle.ts';
import { getVar, isAttack, type HitCtx, type KitHooks, type SkillHooks } from '../skillfx.ts';
import type { SideId, StageStat } from '../types.ts';

// ═════════════════════════ `luminael`: Backlight ═════════════════════════
// "Backlight" = Trick Room-style (the slower acts first) plus the priority of attack skills flipped in sign (guard, switching and status skills unchanged).
// Most of `luminael`'s attacks have negative priority: normally it moves last (dusk), and under Backlight it strikes first (dawn).
// The priority flip is a lasting effect on both sides (the hook is borrowed on `luminael_dawnlight`); the speed reversal uses the engine's toggleReverseOrder.
// The two are switched on and off together; when someone turns the order back to normal some other way, the priority flip stops working too.

/** Backlight (a lasting effect on both sides) */
const INVERT = 'luminael_dawnlight';
/** `luminael_twin_stars` (Dawn and Dusk on the Same Day): counts as both moving first and moving last */
const TWIN = 'luminael_twin_stars';

/** `luminael`'s Backlight is in effect (action order is reversed, and at least one side has the Backlight priority flip) */
function inLight(b: Battle): boolean {
  return !!b.s.reverseOrder && (!!b.getLasting(0, INVERT) || !!b.getLasting(1, INVERT));
}

/**
 * Toggles Backlight: when the order is normal it sets up for turns turns; when it is already reversed (whoever caused it) it returns to normal. Returns whether Backlight was set up.
 */
function toggleLight(b: Battle, id: SideId, turns: number): boolean {
  if (b.s.reverseOrder) {
    b.toggleReverseOrder(0);
    b.removeLasting(0, INVERT);
    b.removeLasting(1, INVERT);
    return false;
  }
  b.toggleReverseOrder(turns);
  b.addLasting(id, INVERT, turns, { side: true, from: id });
  b.addLasting(b.foe(id), INVERT, turns, { side: true, from: id });
  return true;
}

/** This skill's actual priority under the current order rules (under Backlight an attack skill's priority is flipped in sign) */
function effPriority(b: Battle, sk: SkillDef): number {
  return inLight(b) && isAttack(sk) ? -sk.priority : sk.priority;
}

/** Whether it acts before the opponent on speed alone (ignoring priority); when action order is reversed the slower goes first */
function speedFirst(b: Battle, id: SideId): boolean {
  const f = b.foe(id);
  const mine = b.effStat(b.active(id), 'spd', id);
  const theirs = b.effStat(b.active(f), 'spd', f);
  return b.s.reverseOrder ? mine < theirs : mine > theirs;
}

/** Predicts whether using this skill moves first (assuming the opponent uses a skill with priority 0) */
function predictFirst(b: Battle, id: SideId, sk: SkillDef): boolean {
  const p = effPriority(b, sk);
  return p !== 0 ? p > 0 : speedFirst(b, id);
}

/** "Moves first": the opponent has not acted this turn (predicted when estimating). Always true under Dawn and Dusk on the Same Day */
function actsFirst(b: Battle, id: SideId, c?: HitCtx): boolean {
  if (b.getLasting(id, TWIN)) return true;
  if (c?.estimate) return predictFirst(b, id, c.sk);
  return !b.hasActed(b.foe(id));
}

/** "Moves last": the opponent has already acted this turn (predicted when estimating). Always true under Dawn and Dusk on the Same Day */
function actsLast(b: Battle, id: SideId, c?: HitCtx): boolean {
  if (b.getLasting(id, TWIN)) return true;
  if (c?.estimate) return !predictFirst(b, id, c.sk);
  return b.hasActed(b.foe(id));
}

/** AI: whether to set up Backlight */
function lightScore(b: Battle, id: SideId): number {
  if (inLight(b)) return -150; // Its own Backlight is still up: do not lift it by hand
  const me = b.active(id);
  const f = b.foe(id);
  const foe = b.active(f);
  const slower = b.effStat(me, 'spd', id) < b.effStat(foe, 'spd', f);
  if (b.s.reverseOrder) return slower ? -120 : 45; // The opponent's Trick Room: lift it only if it is bad for us
  if (foe.hp / foe.maxHp <= 0.3) return -20; // Close to finishing, so better to just attack
  const neg = me.skills.filter((s) => isAttack(getSkill(s)) && getSkill(s).priority < 0).length;
  return 18 + neg * 12 + (slower ? 18 : 0);
}

/** The Backlight lasting effect: the priority of attack skills is flipped in sign */
const INVERT_LASTING: SkillHooks['lasting'] = {
  name: '逆光',
  priority: (b, _owner, sk) => (b.s.reverseOrder && isAttack(sk) ? -2 * sk.priority : 0),
  // The order has been turned back to normal (someone else's Trick Room): the priority flip ends too
  onTurnEnd: (b, owner) => {
    if (!b.s.reverseOrder) b.removeLasting(owner, INVERT);
  },
};

// ═════════════════════════ `astragate`: Star Gate Seal ═════════════════════════
// When an attack is "blocked" (guard, `starlight_bulwark`, `astragate_gate_seal`, `astragate_gate_reversal`): that skill is sealed for 3 turns, and the blocked damage is stored as "Starlight".
// Starlight is stored on it as HP points ('e:' prefix, dissipates on leaving), at most 40% of max HP; "Open Gate" skills turn it into fixed damage.

const AST = 'astragate';
const STAR = 'e:ast:star';
const STAR_CAP = 0.4;
/** Turns a blocked skill is sealed */
const SEAL_TURNS = 3;
/** Release multiplier of Open Gate: `astragate_gate_stream` x1 / `astragate_gate_flood` x1.5 / the ultimate x2 */
const STREAM_MULT = 1;
const FLOOD_MULT = 1.5;
const ULT_MULT = 2;
/** `starlight_bulwark` (damage reduction this turn and a block; the whole attack's damage is stored as Starlight) */
const BULWARK = 'starlight_bulwark';
const BULWARK_TURN = 'e:ast:bulwark';
const BULWARK_REDUCE = 50;
const BULWARK_REFLECT = 0.5;
/** `astragate_gate_seal` (for 3 turns, every attack that hits counts as blocked) */
const SEAL = 'astragate_gate_seal';
const SEAL_STORE = 0.4;

const isAstragate = (b: Battle, id: SideId): boolean => b.active(id).species.id === AST && !b.active(id).fainted;
const starOf = (b: Battle, id: SideId): number => getVar(b, id, STAR);
const starCap = (b: Battle, id: SideId): number => Math.floor(b.active(id).maxHp * STAR_CAP);
/** "Open Gate": ignores guard while there is Starlight */
const hasStar = (b: Battle, id: SideId): boolean => starOf(b, id) > 0;
/** Has an Open Gate skill in hand (in the skill slots, or an ultimate not yet used) */
const canOpen = (b: Battle, id: SideId): boolean => {
  const c = b.active(id);
  return c.skills.some((s) => GATES.includes(s) && b.canUse(id, s).ok) || (c.ultimate === 'u_astragate' && b.canUse(id, 'u_astragate').ok);
};
const GATES = ['astragate_gate_stream', 'astragate_gate_flood'];
/** The opponent has a skill that is "sealed" */
const sealed = (b: Battle, f: SideId): boolean => {
  const dis = b.active(f).disabled;
  return !!dis && dis.turns >= b.s.turn;
};

/** Stores Starlight (only `astragate` has a Star Gate); returns the amount actually stored */
function store(b: Battle, id: SideId, amount: number): number {
  if (!isAstragate(b, id) || amount <= 0) return 0;
  const c = b.active(id);
  const before = starOf(b, id);
  c.vars[STAR] = Math.min(starCap(b, id), before + Math.floor(amount));
  return c.vars[STAR] - before;
}

/** Block: seals the opponent's attack skill it just used (ultimates excepted) for SEAL_TURNS turns, and stores amount as Starlight */
function block(b: Battle, id: SideId, amount: number): void {
  if (!isAstragate(b, id)) return;
  const f = b.foe(id);
  const d = b.active(f);
  b.traitEvent(id, '星門封存');
  const last = d.lastSkill ? getSkill(d.lastSkill) : null;
  if (!d.fainted && last && isAttack(last) && last.category !== 'ultimate') b.disableSkill(f, SEAL_TURNS);
  const got = store(b, id, amount);
  if (got > 0) b.text(`星門封存了 ${got} 點星輝（${Math.round((starOf(b, id) / b.active(id).maxHp) * 100)}%）。`);
}

/** Open Gate: releases all the Starlight, dealing fixed damage of mult times it. Starlight is kept when the opponent is knocked out or the hit lands on a substitute */
function release(b: Battle, c: HitCtx, ko: boolean, decoy: boolean, mult: number): void {
  const id = c.attacker;
  const s = starOf(b, id);
  if (s <= 0 || ko || decoy || b.active(c.defender).fainted) return;
  b.active(id).vars[STAR] = 0;
  b.text('開門！星輝傾瀉而出！');
  b.damage(c.defender, Math.floor(s * mult), 'starlight');
}

/** AI: extra score for Open Gate skills (the estimate does not include the fixed damage from Starlight) */
function releaseScore(b: Battle, id: SideId, skillId: string, mult: number): number {
  const s = starOf(b, id) * mult;
  const foe = b.active(b.foe(id));
  if (starOf(b, id) < b.active(id).maxHp * 0.08) return -15; // Too little Starlight: keep storing it
  let add = Math.min(100, (s / Math.max(1, foe.hp)) * 100);
  const est = b.estimate(id, skillId);
  if (est < foe.hp && est + s >= foe.hp) add += 60;
  return add;
}

/** About what fraction of our HP the opponent's strongest hit would take (for the AI) */
function threatOf(b: Battle, id: SideId): number {
  const f = b.foe(id);
  const foe = b.active(f);
  let best = 0;
  for (const s of foe.skills) if (isAttack(getSkill(s)) && b.canUse(f, s).ok) best = Math.max(best, b.estimate(f, s));
  return best / Math.max(1, b.active(id).hp);
}

// ═════════════════════════ `chime_sprite`: Chime Rhythm ═════════════════════════
// An attack records "Ring", a status skill records "Clear", and our own trap firing records "Ward" (a bitmask, cleared on leaving with the 'e:' prefix). When all three tones are collected -> "Chord":
// clears the three tones, the opponent takes 12% of max HP damage, and `chime_sprite` heals 12%. A skill's tone is recorded at the end of the turn (when a trap fires, "Ward" is recorded at once).

const CHM = 'chime_sprite';
const TONES = 'e:chm:tones';
/** Number of skills whose tone has already been recorded (compared with usedSinceEnter to tell whether a skill was used this turn) */
const TONE_USED = 'e:chm:used';
/** Number of Chords this battle (kept on leaving) */
const CHORDS = 'chm:chords';
const MING = 1;
const QING = 2;
const SHOU = 4;
const FULL = MING | QING | SHOU;
const CHORD_PCT = 12;
const MATINS = 'chime_matins';
const BELL_WARD = 'chime_bell_ward';
const SANCTUS = 'chime_sanctus';

const isChime = (b: Battle, id: SideId): boolean => b.active(id).species.id === CHM && !b.active(id).fainted;
const tonesOf = (b: Battle, id: SideId): number => getVar(b, id, TONES);
const toneCount = (m: number): number => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
const chordsOf = (b: Battle, id: SideId): number => getVar(b, id, CHORDS);

/** Chord: the opponent takes 12% damage and the user heals 12%. keep = does not clear the recorded tones (ultimate) */
function chord(b: Battle, id: SideId, keep = false): void {
  if (!isChime(b, id)) return;
  const c = b.active(id);
  if (!keep) c.vars[TONES] = 0;
  c.vars[CHORDS] = chordsOf(b, id) + 1;
  b.traitEvent(id, '和鳴');
  const f = b.foe(id);
  if (!b.active(f).fainted) b.trueDamage(f, CHORD_PCT, 'chime');
  if (!c.fainted) b.heal(id, CHORD_PCT);
}

/** Records tones; a Chord happens when all three are collected */
function addTone(b: Battle, id: SideId, bits: number): void {
  if (!isChime(b, id) || !bits) return;
  const c = b.active(id);
  c.vars[TONES] = tonesOf(b, id) | bits;
  if (c.vars[TONES] === FULL) chord(b, id);
}

/** The tone this skill records */
function toneOfSkill(skillId: string): number {
  if (skillId === MATINS) return QING | MING;
  if (skillId === BELL_WARD) return SHOU;
  const sk = getSkill(skillId);
  if (isAttack(sk)) return MING;
  return sk.category === 'status' ? QING : 0;
}

/** AI: the tone this skill completes (a big bonus for completing a Chord; when a trap is already ready to fire, "Ward" counts as nearly there) */
function toneScore(b: Battle, id: SideId, skillId: string): number {
  const have = tonesOf(b, id);
  const add = toneOfSkill(skillId) & ~have;
  if (!add) return 0;
  const after = have | add;
  const trapSoon = !!b.trapReady(id);
  return toneCount(add) * 10 + (after === FULL ? 40 : trapSoon && (after | SHOU) === FULL ? 20 : 0);
}

// ═════════════════════════ `griffin`: Riding ═════════════════════════
// While the rider is in the saddle, after the griffin's exclusive attack hits, the rider follows up with `griffin_lance` (x0.5). It is unseated when guarded, or when taking 25% or more attack damage at once.
// The riding state is an 'e:' variable (it dismounts on leaving); the trait "Paladin's Oath" puts the rider in the saddle on entering.

const GRF = 'griffin';
const MOUNT = 'e:grf:mount';
const LANCE = 'griffin_lance';
const RIDER_MULT = 0.5;
const DISMOUNT_PCT = 0.25;
const SACRIFICE = 'griffin_sacrifice';

const mounted = (b: Battle, id: SideId): boolean => b.active(id).species.id === GRF && getVar(b, id, MOUNT) > 0;

function mount(b: Battle, id: SideId): void {
  const c = b.active(id);
  if (c.species.id !== GRF || c.fainted || mounted(b, id)) return;
  c.vars[MOUNT] = 1;
  b.text('騎士躍上了鞍！');
}

function dismount(b: Battle, id: SideId, why: string): void {
  if (!mounted(b, id)) return;
  b.active(id).vars[MOUNT] = 0;
  b.text(`${why}騎士落鞍了！`);
}

/** The rider pursues times times (no pursuit for the pursuit itself, a KO, or a hit on a substitute) */
function ride(b: Battle, c: HitCtx, ko: boolean, decoy: boolean, times = 1, mult = RIDER_MULT): void {
  const id = c.attacker;
  if (c.followUp || ko || decoy || !mounted(b, id)) return;
  for (let i = 0; i < times; i++) b.followUp(id, LANCE, mult, i === 0 ? '騎士舉槍追擊！' : '騎士再刺一槍！');
}

/** AI: the value of the rider's pursuit (about the pursuit damage as a fraction of the opponent's HP) */
function riderScore(b: Battle, id: SideId, times = 1, mult = RIDER_MULT): number {
  if (!mounted(b, id)) return 0;
  const foe = b.active(b.foe(id));
  return Math.min(60, ((b.estimate(id, LANCE) * mult * times) / Math.max(1, foe.hp)) * 100);
}

/** Common hooks for exclusive attacks: the rider pursues after hitting */
const riding = (times = 1, mult = RIDER_MULT): SkillHooks => ({
  afterAttack: (b, c, r) => ride(b, c, r.ko, r.decoyBlocked, times, mult),
  aiScore: (b, id) => riderScore(b, id, times, mult),
});

// ═════════════════════════ `balancescale`: Counterweight ═════════════════════════
// When an exclusive skill raises its own stat, the opponent's same stat drops by the same number of stages (as many as it actually rose).
// Scale difference = the scale's stat-stage total minus the opponent's stat-stage total; [Judgment] skills get stronger with the scale difference. The old trait "Order" (stats cannot be lowered by the opponent) works as before.

const STATS: StageStat[] = ['atk', 'mag', 'def', 'res', 'spd'];
/** The turn `balancescale_level` was last used (cannot be used on consecutive turns) */
const LEVEL_TURN = 'e:bs:level';

/** Counterweight: own stat +n, the opponent's same stat -(the stages that actually rose) */
function raise(b: Battle, id: SideId, stat: StageStat, n: number): void {
  const c = b.active(id);
  if (c.fainted) return;
  const before = c.stages[stat];
  b.changeStage(id, stat, n);
  const real = c.stages[stat] - before;
  const f = b.foe(id);
  if (real > 0 && !b.active(f).fainted) b.changeStage(f, stat, -real, true);
}

const stageSum = (b: Battle, id: SideId): number => STATS.reduce((s, k) => s + b.active(id).stages[k], 0);
/** Scale difference (may be negative) */
const scaleDiff = (b: Battle, id: SideId): number => stageSum(b, id) - stageSum(b, b.foe(id));
/** The scale difference used by [Judgment] (0 or more) */
const weight = (b: Battle, id: SideId): number => Math.max(0, scaleDiff(b, id));

/** The stat to add weight to: ATK when the opponent's ATK is higher than its MAG, otherwise MAG */
function weightStat(b: Battle, id: SideId): StageStat {
  const f = b.foe(id);
  const foe = b.active(f);
  return b.effStat(foe, 'atk', f) > b.effStat(foe, 'mag', f) ? 'atk' : 'mag';
}

/** AI: score of weight-adding skills (do not stack once the stat is already very high) */
function weighScore(b: Battle, id: SideId, stats: StageStat[], n: number): number {
  const c = b.active(id);
  const room = stats.reduce((s, k) => s + Math.min(n, 4 - c.stages[k]), 0);
  if (room <= 0) return -60;
  const foe = b.active(b.foe(id));
  if (foe.hp / foe.maxHp < 0.3 || c.hp / c.maxHp < 0.35) return -10; // Close to finishing, just attack
  return 25 + room * 14 - weight(b, id) * 3;
}

/** AI: a [Judgment] attack holds back while the scale difference is small and it is still healthy (add weight first) */
function judgeScore(b: Battle, id: SideId): number {
  const c = b.active(id);
  const canWeigh = c.skills.some((s) => (s === 'balancescale_weight' || s === 'balancescale_stance' || s === 'balancescale_double_weight') && b.canUse(id, s).ok);
  return canWeigh && weight(b, id) < 2 && c.hp / c.maxHp > 0.5 ? -20 : 0;
}

// ═════════════════════════ `candledove`: Peace ═════════════════════════
// While active, at the end of every turn the stat boosts of both active spirits are removed (drops are kept). The old trait "Bell of Peace" (both sides' stats reset on entering) works as before.

/** Removes all of id's stat boosts; returns whether anything was removed */
function clearUps(b: Battle, id: SideId): boolean {
  const c = b.active(id);
  if (c.fainted) return false;
  let any = false;
  for (const k of STATS) {
    if (c.stages[k] > 0) {
      b.changeStage(id, k, -c.stages[k]);
      any = true;
    }
  }
  return any;
}

const upsOf = (b: Battle, id: SideId): number => STATS.reduce((s, k) => s + Math.max(0, b.active(id).stages[k]), 0);
const downsOf = (b: Battle, id: SideId): number => STATS.reduce((s, k) => s + Math.max(0, -b.active(id).stages[k]), 0);

// ═════════════════════════ `prismsnail`: Facets ═════════════════════════
// Facets 0 to 3 (e: prefix, reset to zero on leaving). Trait "Prism" (rewritten): when hit by a magic attack it reflects 20% plus 10% per facet; when hit by a physical attack it shatters 1 facet.

const FACETS = 'e:pri:facets';
/** The base reflect of Prism and the bonus per facet */
const PRISM_BASE = 0.2;
const PRISM_PER = 0.1;
const facetsOf = (b: Battle, id: SideId): number => getVar(b, id, FACETS);

function addFacets(b: Battle, id: SideId, n: number): void {
  const c = b.active(id);
  if (c.species.id !== 'prismsnail' || c.fainted) return;
  const before = facetsOf(b, id);
  c.vars[FACETS] = Math.max(0, Math.min(3, before + n));
  if (c.vars[FACETS] > before) b.text(`聖窗巨蝸的殼磨出了新的稜面（${c.vars[FACETS]} 面）。`);
}

/** AI: the value of adding facets (higher when the opponent is a magic type; not needed when full) */
function facetScore(b: Battle, id: SideId, n: number): number {
  const room = Math.min(n, 3 - facetsOf(b, id));
  if (room <= 0) return -50;
  const f = b.foe(id);
  const foe = b.active(f);
  const magic = b.effStat(foe, 'mag', f) >= b.effStat(foe, 'atk', f);
  return room * (magic ? 18 : 6);
}

// ───────────────────────── Skill hooks ─────────────────────────

/** Skill id -> skill hooks */
export const FX: Record<string, SkillHooks> = {
  // ── `luminael` ──
  luminael_dawn_plume: {
    // Heals 10% after hitting when it moved first
    afterAttack: (b, c) => {
      if (actsFirst(b, c.attacker, c) && !b.active(c.attacker).fainted) b.heal(c.attacker, 10);
    },
  },
  luminael_dawnlight: {
    effect: (b, id) => void toggleLight(b, id, 3),
    lasting: INVERT_LASTING,
    aiScore: (b, id) => lightScore(b, id) - 6,
  },
  luminael_dusk_judgment: {
    // Moving last and the opponent made no attack this turn: power x2 (when estimating, only "Dawn and Dusk on the Same Day plus moving first" is certain)
    power: (b, c, p) => {
      if (c.estimate) return b.getLasting(c.attacker, TWIN) && predictFirst(b, c.attacker, c.sk) ? p * 2 : p;
      return actsLast(b, c.attacker, c) && !b.active(c.defender).usedAttackThisTurn ? p * 2 : p;
    },
    // When the opponent's last skill was a status skill (in a rhythm of boosting and setting traps), the moves-last judgment (`luminael_dusk_judgment`) is worth more
    aiScore: (b, id) => {
      const last = b.active(b.foe(id)).lastSkill;
      return last && getSkill(last).category === 'status' && !predictFirst(b, id, getSkill('luminael_dusk_judgment')) ? 20 : 0;
    },
  },
  luminael_morningstar_verdict: {
    // Always crits when it moved first
    critBonus: (b, c) => (actsFirst(b, c.attacker, c) ? 1 : 0),
    // The estimate does not include crits: when it is predicted to move first, add it here
    aiScore: (b, id) => (actsFirstPredicted(b, id, 'luminael_morningstar_verdict') ? 30 : 0),
  },
  luminael_daybreak: {
    // Only worthwhile when the opponent has turn-based effects it created itself (crystal wall, light screen, tailwind, lasting boosts ...)
    aiScore: (b, id) => {
      const f = b.foe(id);
      const sd = b.side(f);
      const foe = b.active(f);
      const n = [...foe.lasting, ...sd.lasting].filter((l) => l.from === f).length + (sd.screens.physTurns > 0 || sd.screens.magTurns > 0 ? 1 : 0) + (sd.tailwind > 0 ? 1 : 0);
      return n > 0 ? 22 * n : -10;
    },
  },
  luminael_morningstar_inversion: {
    effect: (b, id) => void toggleLight(b, id, 5),
    aiScore: (b, id) => lightScore(b, id),
  },
  luminael_meteor: {
    // Priority +2 becomes -2 under Backlight: do not use it inside Backlight
    aiScore: (b) => (inLight(b) ? -35 : 0),
  },
  luminael_morningstar_oath: {
    trap: {
      on: 'foeStatus',
      fire: (b, owner) => {
        b.text('晨星的誓言：虛偽的伎倆不會得逞！');
        if (!b.s.reverseOrder) toggleLight(b, owner, 3);
        return { negate: true };
      },
    },
    aiScore: (b, id) => (b.active(b.foe(id)).skills.some((s) => getSkill(s).category === 'status') ? 40 : -60),
  },
  luminael_twin_stars: {
    effect: (b, id) => void b.addLasting(id, TWIN, 3),
    lasting: { name: '晨昏同天' },
    aiScore: (b, id) => {
      if (b.getLasting(id, TWIN)) return -80;
      const me = b.active(id);
      const payoff = ['luminael_morningstar_verdict', 'luminael_dusk_judgment', 'luminael_dawn_plume'].filter((s) => me.skills.includes(s)).length;
      return payoff > 0 ? 20 + payoff * 12 : -40;
    },
  },
  u_luminael: {
    // Ignores guard under Backlight; when the order is normal, sets up Backlight for 5 turns after hitting
    pierceGuard: (b) => inLight(b),
    afterAttack: (b, c) => {
      if (!b.s.reverseOrder && !b.active(c.attacker).fainted) toggleLight(b, c.attacker, 5);
    },
  },

  // ── `astragate` ──
  astragate_starstone_strike: {
    // Power +30 when the opponent has a skill sealed
    power: (b, c, p) => (sealed(b, c.defender) ? p + 30 : p),
  },
  astragate_gate_stream: {
    pierceGuard: hasStar,
    afterAttack: (b, c, r) => release(b, c, r.ko, r.decoyBlocked, STREAM_MULT),
    aiScore: (b, id) => releaseScore(b, id, 'astragate_gate_stream', STREAM_MULT),
  },
  starlight_bulwark: {
    canUse: (b, id) => (getVar(b, id, BULWARK_TURN) === b.s.turn && b.s.turn > 0 ? '不能連續使用' : null),
    effect: (b, id) => {
      b.active(id).vars[BULWARK_TURN] = b.s.turn;
      b.addLasting(id, BULWARK, 1, { n: BULWARK_REDUCE });
    },
    lasting: {
      name: '星輝壁壘',
      reduce: (_b, _c, e) => e.n / 100,
      // Block: seals that skill, stores the whole attack's damage (before reduction = actual damage / (1 - r)) as Starlight; the part that was reduced is also reflected at half
      onHitTaken: (b, c, dealt, e) => {
        const r = e.n / 100;
        const blocked = Math.floor((dealt * r) / (1 - r));
        block(b, c.defender, dealt + blocked);
        if (!b.active(c.attacker).fainted && blocked > 0) b.damage(c.attacker, Math.max(1, Math.floor(blocked * BULWARK_REFLECT)), 'reflect');
      },
    },
    aiScore: (b, id) => {
      const foe = b.active(b.foe(id));
      const t = threatOf(b, id);
      let s = t >= 0.2 ? 32 + Math.min(30, t * 40) : -15;
      if (foe.status.taunt) s += 30; // A taunted opponent can only attack
      if (!b.canGuard(id).ok && t >= 0.2) s += 15; // Just guarded: switch to the bulwark to keep blocking
      if (starOf(b, id) >= starCap(b, id)) s -= 25;
      return s;
    },
  },
  astragate_meteor_counter: {
    // The opponent has already attacked this turn: power +50 (when estimating: it counts if the opponent is faster)
    power: (b, c, p) => (sealed(b, c.defender) ? p + 50 : p),
  },
  astragate_gate_flood: {
    pierceGuard: hasStar,
    afterAttack: (b, c, r) => release(b, c, r.ko, r.decoyBlocked, FLOOD_MULT),
    aiScore: (b, id) => releaseScore(b, id, 'astragate_gate_flood', FLOOD_MULT),
  },
  astragate_gate_reversal: {
    trap: {
      on: 'foeAttack',
      fire: (b, owner, ev) => {
        const f = b.foe(owner);
        const est = b.estimate(f, ev.ctx.sk.id);
        b.text('星門反轉！攻擊被吸進了門後。');
        block(b, owner, est);
        return { negate: true };
      },
    },
    aiScore: (b, id) => (threatOf(b, id) >= 0.2 ? 45 : 5),
  },
  astragate_star_mending: {
    // The tag heals 15% first, then Starlight is converted into the same amount of HP
    effect: (b, id) => {
      const s = starOf(b, id);
      if (s <= 0) return;
      b.active(id).vars[STAR] = 0;
      b.text('星輝化為療癒之光。');
      b.healAmount(id, s);
    },
    aiScore: (b, id) => {
      const c = b.active(id);
      const miss = 1 - c.hp / c.maxHp;
      if (miss < 0.2) return -40;
      return (starOf(b, id) / c.maxHp) * 120;
    },
  },
  astragate_gate_seal: {
    effect: (b, id) => void b.addLasting(id, SEAL, 3),
    lasting: {
      name: '星門全閉',
      onHitTaken: (b, c, dealt) => block(b, c.defender, dealt * SEAL_STORE),
    },
    aiScore: (b, id) => (b.getLasting(id, SEAL) ? -80 : threatOf(b, id) >= 0.15 ? 40 : 0),
  },
  u_astragate: {
    pierceGuard: hasStar,
    afterAttack: (b, c, r) => release(b, c, r.ko, r.decoyBlocked, ULT_MULT),
    aiScore: (b, id) => releaseScore(b, id, 'u_astragate', ULT_MULT),
  },

  // ── `chime_sprite` ──
  chime_ring: {
    // In Chime Rhythm, +20 power for every tone
    power: (b, c, p) => p + 20 * toneCount(tonesOf(b, c.attacker)),
    aiScore: (b, id) => toneScore(b, id, 'chime_ring'),
  },
  chime_clear_bell: {
    aiScore: (b, id) => toneScore(b, id, 'chime_clear_bell'),
  },
  chime_ward_bell: {
    trap: { on: 'foeAttack', fire: () => ({ reduce: 0.5 }) },
    aiScore: (b, id) => (tonesOf(b, id) & SHOU ? 10 : 45) + (threatOf(b, id) >= 0.2 ? 15 : 0),
  },
  chime_dispel_toll: {
    aiScore: (b, id) => toneScore(b, id, 'chime_dispel_toll') + (b.side(b.foe(id)).trap ? 25 : 0),
  },
  chime_matins: {
    aiScore: (b, id) => toneScore(b, id, MATINS),
  },
  chime_bell_ward: {
    effect: (b, id) => void b.addLasting(id, BELL_WARD, 1, { n: 40 }),
    lasting: { name: '鐘罩', reduce: (_b, _c, e) => e.n / 100 },
    aiScore: (b, id) => toneScore(b, id, BELL_WARD) + (threatOf(b, id) >= 0.3 ? 20 : -15),
  },
  chime_resonance: {
    // In Chime Rhythm, +40 power when "Ward" is present
    power: (b, c, p) => (tonesOf(b, c.attacker) & SHOU ? p + 40 : p),
    aiScore: (b, id) => toneScore(b, id, 'chime_resonance'),
  },
  chime_silence_bell: {
    trap: { on: 'foeStatus', fire: () => ({ negate: true }) },
    aiScore: (b, id) => {
      const hasStatus = b.active(b.foe(id)).skills.some((s) => getSkill(s).category === 'status');
      return hasStatus ? (tonesOf(b, id) & SHOU ? 25 : 45) : -80;
    },
  },
  chime_sanctus: {
    effect: (b, id) => void b.addLasting(id, SANCTUS, 3),
    lasting: { name: '聖詠', onTurnEnd: (b, owner) => addTone(b, owner, SHOU) },
    aiScore: (b, id) => (b.getLasting(id, SANCTUS) ? -80 : (tonesOf(b, id) & SHOU ? 5 : 30) + toneScore(b, id, SANCTUS)),
  },
  chime_crescendo: {
    // +40 power for every Chord so far this battle (up to +160)
    power: (b, c, p) => p + 40 * Math.min(4, chordsOf(b, c.attacker)),
    aiScore: (b, id) => toneScore(b, id, 'chime_crescendo'),
  },
  u_chime_sprite: {
    // Chords immediately after hitting (does not clear the recorded tones)
    afterAttack: (b, c) => chord(b, c.attacker, true),
  },

  // ── `griffin` ──
  griffin_lance: riding(),
  griffin_remount: {
    effect: (b, id) => mount(b, id),
    aiScore: (b, id) => (mounted(b, id) ? -60 : 45),
  },
  holy_dive: riding(),
  griffin_charge: {
    ...riding(),
    power: (b, c, p) => (mounted(b, c.attacker) ? p + 35 : p),
  },
  griffin_sacrifice: {
    canUse: (b, id) => (mounted(b, id) ? null : '騎士不在鞍上'),
    effect: (b, id) => void b.addLasting(id, SACRIFICE, 1, { n: 60 }),
    lasting: {
      name: '捨身護主',
      reduce: (_b, _c, e) => e.n / 100,
      onTurnEnd: (b, owner) => dismount(b, owner, '騎士捨身護主，'),
    },
    aiScore: (b, id) => (threatOf(b, id) >= 0.4 ? 35 : -40),
  },
  griffin_twin_lance: riding(2),
  griffin_lone_wrath: {
    ...riding(),
    // Power +60 when the rider is not in the saddle
    power: (b, c, p) => (mounted(b, c.attacker) ? p : p + 60),
  },
  griffin_gale_thrust: riding(),
  griffin_oath_guard: {
    trap: {
      on: 'lethal',
      when: (b, owner) => mounted(b, owner),
      fire: (b, owner) => {
        b.text('騎士捨身擋在獅鷲身前！');
        dismount(b, owner, '');
        return { survive: true };
      },
    },
    aiScore: (b, id) => (mounted(b, id) ? 30 + (threatOf(b, id) >= 0.6 ? 30 : 0) : -80),
  },
  griffin_rally: {
    effect: (b, id) => mount(b, id),
    aiScore: (b, id) => (mounted(b, id) ? -15 : 40),
  },
  griffin_cavalry: {
    // While riding, after hitting the rider pursues at full strength (x1.0), then is unseated
    afterAttack: (b, c, r) => {
      if (c.followUp || !mounted(b, c.attacker)) return;
      ride(b, c, r.ko, r.decoyBlocked, 1, 1);
      dismount(b, c.attacker, '騎士衝入敵陣，');
    },
    aiScore: (b, id) => riderScore(b, id, 1, 1),
  },
  // ── `balancescale` ──
  balancescale_scale_ray: {
    // [Judgment] +5 per point of scale difference (up to +40)
    power: (b, c, p) => p + 5 * Math.min(8, weight(b, c.attacker)),
  },
  balancescale_weight: {
    // MAG +1; when the opponent's ATK is higher than its MAG, ATK +1 instead (Counterweight pushes down the opponent's main attack stat)
    effect: (b, id) => raise(b, id, weightStat(b, id), 1),
    aiScore: (b, id) => weighScore(b, id, [weightStat(b, id)], 1),
  },
  balancescale_equalize: {
    // When the opponent is heavier, removes the opponent's stat boosts after hitting
    afterAttack: (b, c, r) => {
      if (!r.ko && !r.decoyBlocked && scaleDiff(b, c.attacker) < 0) b.dispel(c.defender);
    },
    aiScore: (b, id) => (scaleDiff(b, id) < 0 ? Math.min(50, -scaleDiff(b, id) * 12) : 0),
  },
  balancescale_level: {
    // HP ratios move toward the average, each changing by at most 20% of max HP; cannot be used on consecutive turns
    canUse: (b, id) => (getVar(b, id, LEVEL_TURN) === b.s.turn && b.s.turn > 0 ? '不能連續使用' : null),
    effect: (b, id) => {
      b.active(id).vars[LEVEL_TURN] = b.s.turn;
      const f = b.foe(id);
      const me = b.active(id);
      const foe = b.active(f);
      if (foe.fainted) return;
      const avg = (me.hp / me.maxHp + foe.hp / foe.maxHp) / 2;
      const shift = (c: typeof me) => Math.max(-0.2 * c.maxHp, Math.min(0.2 * c.maxHp, Math.round(avg * c.maxHp) - c.hp));
      const dMe = Math.trunc(shift(me));
      const dFoe = Math.trunc(shift(foe));
      b.text('秤平：天平的兩端往中間靠攏。');
      if (dFoe < 0) b.damage(f, -dFoe, 'split');
      else if (dFoe > 0) b.healAmount(f, dFoe);
      if (dMe > 0) b.healAmount(id, dMe);
      else if (dMe < 0) b.damage(id, -dMe, 'split');
    },
    aiScore: (b, id) => {
      const me = b.active(id);
      const foe = b.active(b.foe(id));
      const gap = foe.hp / foe.maxHp - me.hp / me.maxHp;
      return gap > 0.2 ? Math.min(90, gap * 110) : -40;
    },
  },
  balancescale_stance: {
    effect: (b, id) => {
      raise(b, id, 'def', 1);
      raise(b, id, 'res', 1);
    },
    aiScore: (b, id) => weighScore(b, id, ['def', 'res'], 1) - 6,
  },
  balancescale_judgment: {
    // [Judgment] +15 per point of scale difference (up to +90)
    power: (b, c, p) => p + 15 * Math.min(6, weight(b, c.attacker)),
    aiScore: judgeScore,
  },
  balancescale_counterpoise: {
    trap: {
      on: 'foeBuff',
      fire: (b, owner, ev) => {
        if (ev.on !== 'foeBuff') return;
        b.text('天平失衡了！公義天秤壓回另一端。');
        raise(b, owner, ev.stat, 1);
      },
    },
    aiScore: (b, id) => (b.active(b.foe(id)).skills.some((s) => Object.keys(getSkill(s).tags).some((k) => k.startsWith('self.'))) ? 45 : -40),
  },
  balancescale_double_weight: {
    effect: (b, id) => raise(b, id, 'mag', 2),
    aiScore: (b, id) => weighScore(b, id, ['mag'], 2),
  },
  balance_verdict: {
    // [Judgment] both sides' stats reset to zero; for every point of scale difference zeroed, the opponent takes 5% of max HP damage (up to 40%)
    effect: (b, id) => {
      const n = weight(b, id);
      const f = b.foe(id);
      b.text('均衡裁決：天平的兩端回到同一個高度。');
      b.resetStages(id);
      if (!b.active(f).fainted) {
        b.resetStages(f);
        if (n > 0) b.trueDamage(f, Math.min(40, 5 * n), 'verdict');
      }
    },
    aiScore: (b, id) => {
      const f = b.foe(id);
      const foe = b.active(f);
      const n = weight(b, id);
      const dmg = (Math.min(40, 5 * n) / 100) * foe.maxHp;
      const foeUps = STATS.reduce((s, k) => s + Math.max(0, foe.stages[k]), 0);
      if (n < 4 && foeUps < 2) return -40; // Not heavy enough yet: add weight first
      return (dmg / Math.max(1, foe.hp)) * 100 + (dmg >= foe.hp ? 60 : 0) + foeUps * 12;
    },
  },
  u_balancescale: {
    // [Judgment] +10 per point of scale difference (up to +80); after hitting, own MAG and RES +1 (Counterweight)
    power: (b, c, p) => p + 10 * Math.min(8, weight(b, c.attacker)),
    afterAttack: (b, c) => {
      if (c.followUp) return;
      raise(b, c.attacker, 'mag', 1);
      raise(b, c.attacker, 'res', 1);
    },
  },

  u_griffin: {
    // After hitting, mounts the rider and pursues 3 times
    afterAttack: (b, c, r) => {
      if (c.followUp || b.active(c.attacker).fainted) return;
      mount(b, c.attacker);
      ride(b, c, r.ko, r.decoyBlocked, 3);
    },
  },

  // ── `candledove` ──
  candledove_bell_toll: {
    // Both sides' stat stages all reset to zero (the 15% heal is handled by tags)
    effect: (b, id) => {
      const f = b.foe(id);
      b.text('晨鐘響起：雙方的能力回到原點。');
      b.resetStages(id);
      if (!b.active(f).fainted) b.resetStages(f);
    },
    // Only worthwhile if it clears its own stat drops; the opponent's stat drops are cleared too (the cost)
    aiScore: (b, id) => {
      const f = b.foe(id);
      const v = downsOf(b, id) * 18 + upsOf(b, f) * 10 - downsOf(b, f) * 14;
      return v > 0 ? v : -40;
    },
  },
  candledove_truce: {
    trap: {
      on: 'foeSetTrap',
      fire: (b, owner) => {
        b.text('休戰協定：對手的伏技被收了起來。');
        b.heal(owner, 10);
        return { negate: true };
      },
    },
    aiScore: (b, id) => (b.active(b.foe(id)).skills.some((s) => getSkill(s).category === 'trap') ? 40 : -60),
  },

  // ── `prismsnail` ──
  prismsnail_glint: {
    // [Prism] +5 per facet
    power: (b, c, p) => p + 5 * facetsOf(b, c.attacker),
  },
  prismsnail_polish: {
    effect: (b, id) => addFacets(b, id, 1),
    aiScore: (b, id) => facetScore(b, id, 1),
  },
  prism_refract: {
    // [Prism] +10 per facet
    power: (b, c, p) => p + 10 * facetsOf(b, c.attacker),
  },
  prismsnail_rose_window: {
    effect: (b, id) => addFacets(b, id, 1),
    aiScore: (b, id) => facetScore(b, id, 1) / 2,
  },
  prismsnail_mirror: {
    trap: {
      on: 'foeAttack',
      // Damage -30%; facets +1 before the damage (Prism's reflect counts this facet, and a physical attack will shatter it again)
      fire: (b, owner) => {
        b.text('鏡殼：琉璃殼迎著攻擊亮了起來。');
        addFacets(b, owner, 1);
        return { reduce: 0.3 };
      },
    },
    aiScore: (b, id) => (b.active(b.foe(id)).skills.some((s) => isAttack(getSkill(s))) ? 30 : -60),
  },
  prismsnail_glass_armor: {
    effect: (b, id) => addFacets(b, id, 3),
    aiScore: (b, id) => facetScore(b, id, 3),
  },
  prismsnail_rainbow: {
    // [Prism] +10 per facet
    power: (b, c, p) => p + 10 * facetsOf(b, c.attacker),
  },
  prismsnail_stained_glass: {
    effect: (b, id) => addFacets(b, id, 1),
    aiScore: (b, id) => (facetsOf(b, id) < 3 ? 8 : 0),
  },
  u_prismsnail: {
    // [Prism] +20 per facet; the facets are filled after hitting
    power: (b, c, p) => p + 20 * facetsOf(b, c.attacker),
    afterAttack: (b, c) => {
      if (!c.followUp) addFacets(b, c.attacker, 3);
    },
  },
};

/** Predicts whether this skill will move first (for the AI) */
function actsFirstPredicted(b: Battle, id: SideId, skillId: string): boolean {
  return !!b.getLasting(id, TWIN) || predictFirst(b, id, getSkill(skillId));
}

// ───────────────────────── Kit hooks ─────────────────────────

/** Spirit id -> kit hooks (signature mechanics, rewritten traits, state marks) */
export const KIT: Record<string, KitHooks> = {
  luminael: {
    // Dawn (a negative-priority judgment will move first) / Dusk (it will move last) / Dawn-Dusk (Dawn and Dusk on the Same Day)
    marks: (b, id) => {
      const twin = b.getLasting(id, TWIN);
      const dawn = predictFirst(b, id, getSkill('luminael_star_lance'));
      return [{ id: 'kit:lum_phase', note: twin ? '晨昏' : dawn ? '晨' : '昏' }];
    },
  },
  astragate: {
    // Guard blocks an attack: seals and stores the whole attack's damage
    onGuarded: (b, id) => {
      const f = b.foe(id);
      const last = b.active(f).lastSkill;
      const sk = last ? getSkill(last) : null;
      block(b, id, sk && isAttack(sk) ? b.estimate(f, sk.id) : 0);
    },
    marks: (b, id) => {
      const s = starOf(b, id);
      return s > 0 ? [{ id: 'kit:ast_star', n: Math.round((s / b.active(id).maxHp) * 100), note: '星輝' }] : [];
    },
    // More willing to guard when the Star Gate has room and the opponent is a threat; open the gate first when Starlight is full
    aiGuard: (b, id) => (starOf(b, id) >= starCap(b, id) * 0.9 ? -20 : threatOf(b, id) >= 0.2 ? 10 : 0),
    // The opponent's AI: when `astragate` has Starlight and can open the gate, a guard cannot stop it
    aiFoeGuard: (b, id) => (hasStar(b, id) && canOpen(b, id) ? -45 : 0),
  },
  chime_sprite: {
    // Trait "Clear Tone": on entering, reveals the opponent's trap and records "Ward"
    onEnter: (b, id) => {
      b.traitEvent(id, '清音');
      const f = b.foe(id);
      if (b.side(f).trap) b.revealTrap(f);
      addTone(b, id, SHOU);
    },
    // At the end of the turn, records the tone of this turn's skills (attack "Ring", status skill "Clear"; `chime_matins` gives two tones; `chime_bell_ward` records "Ward")
    onEndTurn: (b, id) => {
      const c = b.active(id);
      if (c.usedSinceEnter <= getVar(b, id, TONE_USED)) return;
      c.vars[TONE_USED] = c.usedSinceEnter;
      if (c.lastSkill) addTone(b, id, toneOfSkill(c.lastSkill));
    },
    // Our own trap fires: records "Ward"
    onTrapActivated: (b, id) => addTone(b, id, SHOU),
    marks: (b, id) => {
      const m = tonesOf(b, id);
      const out: { id: string; n?: number; note?: string }[] = [];
      const notes = (m & MING ? '鳴' : '') + (m & QING ? '清' : '') + (m & SHOU ? '守' : '');
      if (notes) out.push({ id: 'kit:chm_tones', note: `鈴律・${notes}` });
      const n = chordsOf(b, id);
      if (n > 0) out.push({ id: 'kit:chm_chords', n, note: '和鳴' });
      return out;
    },
  },
  griffin: {
    // Trait "Paladin's Oath": on entering, the rider mounts
    onEnter: (b, id) => {
      b.traitEvent(id, '聖騎之誓');
      mount(b, id);
    },
    // Taking 25% or more attack damage at once: unseated
    onHitTaken: (b, a, dealt) => {
      if (dealt >= b.active(a.defender).maxHp * DISMOUNT_PCT) dismount(b, a.defender, '重擊之下，');
    },
    // The attack was guarded: unseated
    onEndTurn: (b, id) => {
      const me = b.active(id);
      const foe = b.active(b.foe(id));
      if (me.usedAttackThisTurn && foe.guarding) dismount(b, id, '攻擊被盾牌彈開，');
    },
    marks: (b, id) => [{ id: 'kit:grf_rider', note: mounted(b, id) ? '騎乘' : '落鞍' }],
  },
  balancescale: {
    // Trait "Order": stats cannot be lowered by the opponent; on entering, the higher of the opponent's ATK and MAG -1
    blockStatDrop: true,
    onEnter: (b, id) => {
      const f = b.foe(id);
      if (b.active(f).fainted) return;
      b.traitEvent(id, '秩序');
      b.changeStage(f, weightStat(b, id), -1, true);
    },
    // Scale difference (the difference between the scale's and the opponent's stat-stage totals)
    marks: (b, id) => {
      const n = scaleDiff(b, id);
      return n !== 0 ? [{ id: 'kit:bs_scale', n, note: '秤差' }] : [];
    },
  },
  candledove: {
    // Peace: at the end of the turn, removes the stat boosts of both active spirits (the old trait "Bell of Peace" still works on entering)
    onEndTurn: (b, id) => {
      const f = b.foe(id);
      const mine = clearUps(b, id);
      const theirs = clearUps(b, f);
      if (mine || theirs) b.text('和平：燭光下，強化的力量平息了。');
    },
    marks: () => [{ id: 'kit:cd_peace', note: '和平' }],
  },
  prismsnail: {
    // Trait "Prism" (rewritten): while not fainted, reflects 20% of magic attacks plus 10% per facet; a physical attack shatters 1 facet
    onHitTaken: (b, a, dealt) => {
      const id = a.defender;
      if (b.active(id).hp <= 0) return; // Once the shell is broken it cannot be folded back
      if (a.cat === 'magic') {
        const pct = PRISM_BASE + PRISM_PER * facetsOf(b, id);
        b.traitEvent(id, '稜鏡');
        b.damage(a.attacker, Math.max(1, Math.floor(dealt * pct)), 'reflect');
      } else if (facetsOf(b, id) > 0) {
        b.active(id).vars[FACETS] = facetsOf(b, id) - 1;
        b.text(`武技敲碎了 1 面稜面（剩 ${facetsOf(b, id)} 面）。`);
      }
    },
    marks: (b, id) => {
      const n = facetsOf(b, id);
      return n > 0 ? [{ id: 'kit:ps_facet', n, note: '稜面' }] : [];
    },
  },
};
