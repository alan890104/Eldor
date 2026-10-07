// Skill hooks and kit hooks for the nature group (data/kits/nature.json). See docs/10-kit-authoring.md for how to write them.
// Only `import type { Battle }` is allowed (importing battle.ts at runtime would create a circular dependency).

import type { Battle } from '../battle.ts';
import { isAttack } from '../skillfx.ts';
import type { KitHooks, LastingHooks, SkillHooks } from '../skillfx.ts';
import type { Combatant, SideId } from '../types.ts';
import { getSkill, SKILLS } from '../../data.ts';

// ───────────────────────── `sylvaron`: Wither and Bloom ─────────────────────────
// "Wither" (a lasting effect, placed on the opponent; `sylvaron_withering_realm` places it on the opponent's side): any healing received turns into losing the same amount of HP
//   (the engine hook LastingHooks.invertHeal, checked in healAmount in battle.ts).
// Each time HP is lost this way, `sylvaron` grows 1 "Leaf" (0 to 5, kept on leaving; it grows even while `sylvaron` is on the bench).
// `sylvaron_spring_rain`, `sylvaron_sweet_rain`, `sylvaron_morning_dew`, the ultimate and the "Grove Domain" field make healing happen; `sylvaron_leaf_storm`, `sylvaron_leaf_flurry`, `sylvaron_forest_roar` and `sylvaron_photosynthesis` spend or use the Leaves.
// Trait "Myriad Leaf Blessing" (rewritten): on entering, sets Grove Domain for 3 turns and withers the opponent for 2 turns; each Leaf lowers the attack damage taken by 5%.

const SYL = 'sylvaron';
/** Leaves (kept for the whole battle) */
const LEAF = 'syl:leaf';
const LEAF_MAX = 5;
/** Damage reduction per Leaf */
const LEAF_GUARD = 0.05;
/** Id of the Wither lasting effect (on the spirit): the hooks are written in the lasting of `sylvaron_wither_leaf` */
const WITHER = 'sylvaron_wither_leaf';
/** Id of the Wither lasting effect (on the opponent's side, `sylvaron_withering_realm`) */
const REALM = 'sylvaron_withering_realm';

/** This side's `sylvaron` (the active one first, then the bench; fainted ones do not count) */
function sylOf(b: Battle, side: SideId): Combatant | undefined {
  const a = b.active(side);
  if (a.species.id === SYL && !a.fainted) return a;
  return b.side(side).team.find((m) => m.species.id === SYL && !m.fainted);
}

/** Number of Leaves on the active spirit */
const leaves = (b: Battle, id: SideId): number => b.active(id).vars[LEAF] ?? 0;

/** `sylvaron` grows n Leaves (it grows even when not on the field) */
function growLeaves(b: Battle, side: SideId, n: number): void {
  const s = sylOf(b, side);
  if (!s || n <= 0) return;
  const before = s.vars[LEAF] ?? 0;
  const after = Math.min(LEAF_MAX, before + n);
  if (after === before) return;
  s.vars[LEAF] = after;
  b.text(`${s.name} 長出萬葉（${after} 片）`);
}

/** Spends all the active `sylvaron`'s Leaves and returns the count */
function shedLeaves(b: Battle, id: SideId): number {
  const c = b.active(id);
  const n = c.vars[LEAF] ?? 0;
  if (n > 0) {
    c.vars[LEAF] = 0;
    b.text(`${c.name} 的 ${n} 片萬葉紛紛落下！`);
  }
  return n;
}

/** The opponent (side) is withered: on the spirit or on the side */
const withered = (b: Battle, side: SideId): boolean => !!(b.getLasting(side, WITHER) || b.getLasting(side, REALM));

/** Withers the opponent for n turns (the longer one is kept when already withered) */
function wither(b: Battle, id: SideId, turns: number): void {
  const f = b.foe(id);
  if (b.active(f).fainted) return;
  b.addLasting(f, WITHER, turns, { from: id });
}

/** A status skill applies Wither: a substitute blocks it (like other status-skill debuffs) */
function witherByStatus(b: Battle, id: SideId, turns: number): void {
  const f = b.foe(id);
  if (b.active(f).decoy > 0) {
    b.text('替身擋下了枯萎！');
    return;
  }
  wither(b, id, turns);
}

/** Both active spirits heal pct%: the opponent first (when withered it becomes damage), then itself */
function healBoth(b: Battle, id: SideId, pct: number): void {
  const f = b.foe(id);
  if (!b.active(f).fainted) b.heal(f, pct);
  if (!b.active(id).fainted && b.s.winner === null) b.heal(id, pct);
}

/** The Wither hooks: healing turns into HP loss, and the side of whoever applied it has its `sylvaron` grow Leaves */
const witherHooks = (name: string): LastingHooks => ({
  name,
  invertHeal: (b, _owner, _amount, e) => {
    growLeaves(b, e.from, 1);
    return true;
  },
});

// ───────────────────────── `banyanelder`: Aerial Roots ─────────────────────────
// "Aerial Roots" (0 to 4) coil around the opponent: stored in the opponent spirit's vars (e: prefix, cleared automatically when the opponent leaves); also cleared when the banyan leaves or faints.
// Each root: the opponent's attack damage against the banyan -5% (KIT incoming), and the banyan's attack damage against it +5% (KIT attackBonus).
// End of turn (the banyan's onEndTurn): with roots present, it grows 1 more (2 roots during `banyanelder_seed_root`); if the opponent guarded successfully this turn, 2 roots are broken off instead (they cannot be broken during `banyanelder_tangle`).
// Trait "Coiled Roots" (rewritten): cannot be forced to switch; for every root the opponent breaks, the banyan gains 1 aether.
// Guard is the opponent's only way to break free (besides leaving): `banyanelder_strangle` and the ultimate ignore guard at 4 roots, `banyanelder_hanging_root` hits the gap after a guard,
// `banyanelder_tangle` makes guards unable to break the roots; `banyanelder_root_snare` coils an opponent that does not attack (guarding, boosting and healing all count).

/** Aerial Roots (placed on the coiled spirit) */
const ROOT = 'e:ban:root';
const ROOT_MAX = 4;
/** Damage change per Aerial Root */
const ROOT_PCT = 0.05;
/** Number of roots broken by one guard */
const ROOT_SHED = 2;
/** `banyanelder_tangle` (a lasting effect on the opponent): guards cannot break the roots during it */
const TANGLE = 'banyanelder_tangle';
/** `banyanelder_seed_root` (a lasting effect on the opponent): the roots grow 1 more per turn during it */
const SEED = 'banyanelder_seed_root';

/** Number of roots on a spirit */
const rootsOn = (c: Combatant): number => (c.fainted ? 0 : (c.vars[ROOT] ?? 0));
/** Number of roots on the opponent of the banyan (id) */
const roots = (b: Battle, id: SideId): number => rootsOn(b.active(b.foe(id)));

/** The banyan (id) grows n roots on the opponent, and returns the number of roots actually grown */
function growRoots(b: Battle, id: SideId, n: number): number {
  const f = b.active(b.foe(id));
  if (f.fainted || n <= 0) return 0;
  const before = rootsOn(f);
  const after = Math.min(ROOT_MAX, before + n);
  if (after === before) return 0;
  f.vars[ROOT] = after;
  b.text(`${f.name} 身上的氣根越纏越緊（${after} 根）`);
  return after - before;
}

/** Status skills and traps check for a substitute before growing roots: a substitute blocks them (returns true when blocked) */
function decoyBlocks(b: Battle, id: SideId): boolean {
  if (b.active(b.foe(id)).decoy <= 0) return false;
  b.text('替身擋下了氣根！');
  return true;
}

/** Clears the roots on the opponent of the banyan (id), and returns the original count */
function clearRoots(b: Battle, id: SideId): number {
  const f = b.active(b.foe(id));
  const n = f.vars[ROOT] ?? 0;
  delete f.vars[ROOT];
  return n;
}

/** The opponent (opposite the banyan) is under `banyanelder_tangle`: guards cannot break the roots */
const tangled = (b: Battle, id: SideId): boolean => !!b.getLasting(b.foe(id), TANGLE);

/**
 * Side guarded last turn (it cannot guard again this turn). The turn counter goes +1 when resolution starts:
 * while choosing actions (AI, estimates) b.s.turn is still last turn, and during resolution it is this turn.
 */
function foeGuardedLastTurn(b: Battle, side: SideId, choosing: boolean): boolean {
  const last = choosing ? b.s.turn : b.s.turn - 1;
  return last > 0 && b.active(side).lastGuardTurn === last;
}

// ───────────────────────── `elderwood_warden`: Ancient Bark Shield ─────────────────────────
// The "wood shield" is the engine's shield (c.shield): the `elderwood_warden`'s wood shield stacks (a normal shield keeps the larger value), up to 50% of max HP,
// and every gain restarts the 3-turn count. Dispel, curse, multi-hits and ignoring shields counter it as usual.
// A "Log Slam" attack: power + k for every 1% of wood shield, and all the wood shield is spent after use (even if guarded). Wood shield knocked off this turn counts too:
//   it uses the larger of "the wood shield at the end of last turn" and "the wood shield now" (`elderwood_warden` is slow, so it almost always takes a hit before slamming).
// Trait "Forest's Shelter" (rewritten): at the end of a turn where no attack skill was used, gains 10% wood shield (replaces the old 8% heal).

const WOOD_CAP = 50;
/** Wood shield at the end of last turn (%): used by Log Slam; e: prefix, cleared on leaving */
const WOOD_PREV = 'e:ew:woodPrev';

/** The active spirit's wood shield (a percentage of max HP, may be fractional) */
const woodPct = (c: Combatant): number => (c.shield && !c.fainted ? (c.shield.amount / c.maxHp) * 100 : 0);
/** The wood shield used by Log Slam: what was knocked off this turn counts too */
const slamPct = (c: Combatant): number => (c.fainted ? 0 : Math.max(woodPct(c), c.vars[WOOD_PREV] ?? 0));

/** `elderwood_warden` gains pct% wood shield (stacking, max 50%); restrictions such as curse are handled by giveShield */
function addWood(b: Battle, id: SideId, pct: number): void {
  const c = b.active(id);
  if (c.fainted || pct <= 0) return;
  const total = Math.min(WOOD_CAP, woodPct(c) + pct);
  b.giveShield(id, total);
}

/** Log Slam: spends all the wood shield and returns the percentage spent */
function spendWood(b: Battle, id: SideId): number {
  const c = b.active(id);
  const p = slamPct(c);
  delete c.vars[WOOD_PREV];
  if (p > 0) {
    c.shield = null;
    b.text(`${c.name} 把整面木盾砸了出去！`);
  }
  return p;
}

/** Log Slam hooks: power +k for every 1% of wood shield; spent after use */
const logSlam = (k: number, extra: Partial<SkillHooks> = {}): SkillHooks => ({
  power: (b, c, p) => p + Math.floor(k * slamPct(b.active(c.attacker))),
  afterUse: (b, id) => void spendWood(b, id),
  aiScore: (b, id) => {
    const w = slamPct(b.active(id));
    return w >= 30 ? 45 : w >= 15 ? 10 : -35;
  },
  ...extra,
});

// ───────────────────────── `owlarchivist`: See-Through ─────────────────────────
// "See-Through": recorded on the opponent (e: prefix, cleared automatically when the opponent leaves; also cleared when the owl leaves or faints). Only one at a time.
// What it sees through: the opponent's last used skill; when there is none, the opponent's highest-power attack skill (so it can see through the opponent's main move from the very start).
// A seen-through skill does -40% damage against the owl (KIT incoming). At the end of a turn where the opponent used it after being seen (usedSinceEnter higher than at the time,
// and the last one used is that skill), that skill is sealed for 2 turns and the See-Through ends (KIT onEndTurn).
// `seal_scroll` and `u_owlarchivist` seal the seen-through skill directly without ending the See-Through: after it is unsealed it still does -40% when used again, and gets sealed again after use.
// Trait "Record" (rewritten): sees through on entering (replaces the old "seal for 1 turn").

/** The seen-through skill: index in the opponent's skill slots + 1 (0 or absent = nothing seen through) */
const SEEN = 'e:owl:seen';
/** The opponent's usedSinceEnter when it was seen through: only a later use counts as "using it again" */
const SEEN_AT = 'e:owl:seenAt';
const SEEN_CUT = 0.4;

/** The seen-through skill of the owl's (id) opponent */
const seenOf = (b: Battle, id: SideId): string | undefined => {
  const f = b.active(b.foe(id));
  const i = f.fainted ? 0 : (f.vars[SEEN] ?? 0);
  return i > 0 ? f.skills[i - 1] : undefined;
};

/** The skill to see through: the opponent's last used skill; when there is none (or it is an ultimate, or not in the skill slots), the opponent's highest-power attack skill */
function seeTarget(f: Combatant): number {
  const last = f.lastSkill;
  const i = last ? f.skills.indexOf(last) : -1;
  if (i >= 0 && getSkill(f.skills[i]).category !== 'ultimate') return i;
  let best = -1;
  for (let j = 0; j < f.skills.length; j++) {
    const sk = getSkill(f.skills[j]);
    if (!isAttack(sk) || sk.category === 'ultimate') continue;
    if (best < 0 || sk.power > getSkill(f.skills[best]).power) best = j;
  }
  return best;
}

/** See-Through (see seeTarget) */
function see(b: Battle, id: SideId): void {
  const f = b.active(b.foe(id));
  const i = f.fainted ? -1 : seeTarget(f);
  if (i < 0) {
    b.text('沒有可以看穿的技能。');
    return;
  }
  const last = f.skills[i];
  f.vars[SEEN] = i + 1;
  f.vars[SEEN_AT] = f.usedSinceEnter;
  b.text(`${b.active(id).name} 看穿了 ${f.name} 的「${getSkill(last).name}」！`);
}

function clearSeen(b: Battle, id: SideId): void {
  const f = b.active(b.foe(id));
  delete f.vars[SEEN];
  delete f.vars[SEEN_AT];
}

/** Seals the opponent's given skill for n turns (same computation as the engine's disableSkill, but for a given skill) */
function sealSkill(b: Battle, id: SideId, skill: string, n: number): void {
  const f = b.active(b.foe(id));
  if (f.fainted) return;
  f.disabled = { skill, turns: b.s.turn + n };
  b.text(`${f.name} 的「${getSkill(skill).name}」被封印了！`);
}

/** The opponent has a skill currently sealed */
const foeSealed = (b: Battle, id: SideId): boolean => {
  const f = b.active(b.foe(id));
  return !f.fainted && !!f.disabled && f.disabled.turns >= b.s.turn;
};

// ── Small helpers for the AI ──
const foeOf = (b: Battle, id: SideId) => b.active(b.foe(id));
const hpPct = (c: Combatant) => c.hp / c.maxHp;
/** Owl: whether seeing through is worthwhile (the opponent has a last skill, nothing is seen through yet, nothing is currently sealed) */
function owlSeeScore(b: Battle, id: SideId): number {
  const f = foeOf(b, id);
  const i = seeTarget(f);
  if (i < 0) return -40;
  const target = f.skills[i];
  if (seenOf(b, id) === target || f.disabled?.skill === target) return -30;
  return seenOf(b, id) ? 5 : 30;
}

// ───────────────────────── `dreamcap`: Phantom Spores ─────────────────────────
// "Enter Dream": when the opponent has 3 or more stacks of poison and can fall asleep, spends 3 stacks of poison and puts it to sleep for 3 turns (normal sleep is 2 turns).
// With fewer than 3 stacks, or when it cannot fall asleep (type immunity, toughness, Sanctuary ...), nothing happens and no poison is spent. Taking an attack still wakes it.
// The state is simply the opponent's poison stacks (which the engine already shows); `dreamcap`'s mark row additionally hints "Enter Dream needs 3 stacks".
// The trait keeps "Spore Shell" (when hit by a physical attack, 30% to poison the attacker for 1 stack).

const DREAM_COST = 3;
const DREAM_SLEEP = 3;
/** Rude Awakening: the opponent was asleep when this attack hit (recorded by the keepSleep hook) */
const WOKE = 'e:dc:woke';

const poisonOf = (c: Combatant): number => (c.fainted ? 0 : (c.status.poison?.stacks ?? 0));
/** Whether Enter Dream is possible now */
const canDream = (b: Battle, id: SideId): boolean => poisonOf(foeOf(b, id)) >= DREAM_COST && !b.statusBlocked(b.foe(id), 'sleep');

/** Enter Dream: returns true on success; quiet = no hint when there are fewer than 3 stacks (the Enter Dream attached to an attack) */
function dream(b: Battle, id: SideId, quiet = false): boolean {
  const fid = b.foe(id);
  const f = b.active(fid);
  if (f.fainted) return false;
  if (poisonOf(f) < DREAM_COST) {
    if (!quiet) b.text(`${f.name} 的毒還不夠深，沒有入夢。`);
    return false;
  }
  if (b.statusBlocked(fid, 'sleep') || !b.applyStatus(fid, 'sleep', undefined, DREAM_SLEEP)) return false;
  const p = f.status.poison!;
  p.stacks = (p.stacks ?? 0) - DREAM_COST;
  if (p.stacks <= 0) b.removeStatus(fid, 'poison');
  b.text(`${f.name} 吸進了幻孢，沉入夢中……（中毒 −${DREAM_COST} 層）`);
  return true;
}

// ───────────────────────── `acornsquirrel`: Stashed Fruit ─────────────────────────
// "Stashed Fruit" is stored on `acornsquirrel` (no e: prefix: kept on leaving), up to 3.
// After being attacked with HP at or below 50%, it automatically eats 1 (at most 1 per turn): heals 15%, ATK +1 stage.
// Trait "Hoarding" keeps the old version (the first time HP drops below 50%, heals 25%, once per battle): the feast is eaten once, the stashed fruit is the everyday snack.
// "Wish" keeps the old skill `bury_seed` (heals 40% at the end of next turn).

const FRUIT = 'acs:fruit';
const FRUIT_MAX = 3;
const FRUIT_HEAL = 15;
/** Ate stashed fruit this turn (stores the turn number) */
const ATE = 'e:acs:ate';

const fruits = (c: Combatant): number => c.vars[FRUIT] ?? 0;

/** Buries n stashed fruit (max 3); returns the number actually buried */
function buryFruit(b: Battle, id: SideId, n: number): number {
  const c = b.active(id);
  if (c.fainted) return 0;
  const k = Math.min(n, FRUIT_MAX - fruits(c));
  if (k <= 0) {
    b.text(`${c.name} 的藏果已經埋滿了。`);
    return 0;
  }
  c.vars[FRUIT] = fruits(c) + k;
  b.text(`${c.name} 埋下了 ${k} 顆藏果（${fruits(c)}／${FRUIT_MAX}）。`);
  return k;
}

/** Eats 1 stashed fruit: heals 15%, ATK +1 stage */
function eatFruit(b: Battle, id: SideId): boolean {
  const c = b.active(id);
  if (c.fainted || fruits(c) <= 0) return false;
  c.vars[FRUIT] = fruits(c) - 1;
  c.vars[ATE] = b.s.turn;
  b.traitEvent(id, '藏果');
  b.text(`${c.name} 挖出藏果吃掉了！（剩 ${fruits(c)} 顆）`);
  b.heal(id, FRUIT_HEAL);
  b.changeStage(id, 'atk', 1);
  return true;
}

// ───────────────────────── `leaffrog`: Rejuvenation ─────────────────────────
// After a [Pipe] skill hits it leaves an "echo": at the end of next turn (KIT onEndTurn) it hits once more with b.followUp (50% power;
// `leaffrog_grove_concert` and the ultimate 100%), and `leaffrog` heals HP equal to the echo's damage (Rejuvenation). The echo does not use the engine's echo tag:
// the engine remembers only one echo at a time and a new one overwrites the old; here it becomes "when a new echo appears, the old one rings at once".
// `leaffrog_echo_valley` (a trap) records the opponent's move as `leaffrog`'s echo. The skill is stored in vars as its index in SKILLS + 1 (e: prefix, cleared on leaving).
// Trait "Morning Dew" (rewritten): at the end of a turn where an echo rang, cures one of its own status conditions (replaces the old 30% chance).

const ECHO = 'e:lf:echo';
const ECHO_AT = 'e:lf:echoAt';
const ECHO_PCT = 'e:lf:echoPct';
/** An echo rang this turn (stores the turn number), used by Morning Dew */
const RANG = 'e:lf:rang';

const echoSkill = (c: Combatant): string | undefined => {
  const i = c.vars[ECHO] ?? 0;
  return i > 0 ? SKILLS[i - 1]?.id : undefined;
};

/** The echo rings: attacks again at skill power x pct%, and `leaffrog` heals HP equal to the damage */
function ringEcho(b: Battle, id: SideId): void {
  const c = b.active(id);
  const skill = echoSkill(c);
  const pct = c.vars[ECHO_PCT] ?? 50;
  delete c.vars[ECHO];
  delete c.vars[ECHO_AT];
  delete c.vars[ECHO_PCT];
  if (!skill || c.fainted) return;
  const f = b.active(b.foe(id));
  if (f.fainted) return;
  const before = f.hp;
  c.vars[RANG] = b.s.turn;
  b.followUp(id, skill, pct / 100, `「${getSkill(skill).name}」的回音響起！`);
  const dealt = before - f.hp;
  if (dealt > 0 && !c.fainted && c.hp < c.maxHp) {
    b.text(`回春：${c.name} 回復了生命。`);
    b.healAmount(id, dealt);
  }
}

/** Leaves an echo (when there is already one, the old one rings first) */
function setEcho(b: Battle, id: SideId, skill: string, pct: number): void {
  const c = b.active(id);
  if (c.fainted) return;
  if (c.vars[ECHO]) ringEcho(b, id);
  if (c.fainted || b.s.winner !== null) return;
  c.vars[ECHO] = SKILLS.findIndex((x) => x.id === skill) + 1;
  c.vars[ECHO_AT] = b.s.turn + 1;
  c.vars[ECHO_PCT] = pct;
}

/** [Pipe] skill: leaves an echo after hitting (the echo itself does not leave another echo) */
const pipe = (pct = 50, extra: Partial<SkillHooks> = {}): SkillHooks => ({
  afterAttack: (b, c, res) => {
    if (c.followUp || res.decoyBlocked || b.active(c.defender).fainted) return;
    setEcho(b, c.attacker, c.sk.id, pct);
  },
  // AI: the estimate looks only at this hit; the value of the echo (and Rejuvenation) is added separately
  aiScore: () => (pct >= 100 ? 35 : 20),
  ...extra,
});

export const FX: Record<string, SkillHooks> = {
  sylvaron_wither_leaf: {
    // `sylvaron_wither_leaf`: withers for 1 turn on a hit (the Wither lasting effect is also hooked here)
    afterAttack: (b, c, res) => {
      if (!res.decoyBlocked) wither(b, c.attacker, 1);
    },
    lasting: witherHooks('枯萎'),
    aiScore: (b, id) => (withered(b, b.foe(id)) ? 0 : 22),
  },
  sylvaron_spring_rain: {
    // `sylvaron_spring_rain`: both sides heal 15%
    manual: ['heal'],
    effect: (b, id) => healBoth(b, id, 15),
    aiScore: (b, id) => {
      if (withered(b, b.foe(id))) return 50;
      return hpPct(b.active(id)) < 0.45 && hpPct(foeOf(b, id)) > 0.9 ? 10 : -45;
    },
  },
  sylvaron_root_siphon: {
    // `sylvaron_root_siphon`: drains 50%, 100% when withered
    manual: ['drain'],
    afterAttack: (b, c, res) => {
      if (res.dealt <= 0 || b.active(c.attacker).fainted) return;
      const rate = withered(b, c.defender) ? 1 : 0.5;
      b.healAmount(c.attacker, Math.floor(res.dealt * rate));
    },
    aiScore: (b, id) => (1 - hpPct(b.active(id))) * 20,
  },
  sylvaron_leaf_flurry: {
    // `sylvaron_leaf_flurry`: 2 hits plus 1 hit per Leaf, spent after use
    hits: (b, c, base) => base + leaves(b, c.attacker),
    afterUse: (b, id) => void shedLeaves(b, id),
    aiScore: (b, id) => (leaves(b, id) >= 2 ? 15 : leaves(b, id) === 0 ? -10 : 0),
  },
  sylvaron_canopy: {
    // `sylvaron_canopy` (trap): -30% when hit, `sylvaron` grows 2 Leaves
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => {
        growLeaves(b, owner, 2);
        return { reduce: 0.3 };
      },
    },
    aiScore: (b, id) => (sylOf(b, id) && (sylOf(b, id)!.vars[LEAF] ?? 0) < LEAF_MAX ? 25 : -10),
  },
  sylvaron_grove: {
    // `sylvaron_grove`: Grove Domain for 5 turns (tag) plus Wither for 2 turns
    effect: (b, id) => witherByStatus(b, id, 2),
    aiScore: (b, id) => (b.s.field?.element === 'nature' ? (withered(b, b.foe(id)) ? -20 : 10) : 15),
  },
  sylvaron_blight_breath: {
    // `sylvaron_blight_breath`: clears turns (tag) plus Wither for 3 turns
    effect: (b, id) => witherByStatus(b, id, 3),
    aiScore: (b, id) => {
      const l = b.getLasting(b.foe(id), WITHER);
      if (b.getLasting(b.foe(id), REALM)) return -40;
      return !l ? 45 : l.turns <= 1 ? 20 : -25;
    },
  },
  sylvaron_sweet_rain: {
    // `sylvaron_sweet_rain`: both sides heal 20%; extends Wither by 2 turns when the opponent is withered
    manual: ['heal'],
    effect: (b, id) => {
      const f = b.foe(id);
      const was = withered(b, f);
      healBoth(b, id, 20);
      if (!was || b.active(f).fainted || b.s.winner !== null) return;
      // Extends the Wither on the spirit (the side's Wither has a fixed turn count; when only the side is withered, the spirit's counts from the side's remaining turns)
      const own = b.active(f).lasting.find((l) => l.key === WITHER)?.turns ?? 0;
      const realm = b.side(f).lasting.find((l) => l.key === REALM)?.turns ?? 0;
      b.addLasting(f, WITHER, Math.max(own, realm) + 2, { from: id });
    },
    aiScore: (b, id) => {
      if (withered(b, b.foe(id))) return 60;
      return hpPct(b.active(id)) < 0.4 && hpPct(foeOf(b, id)) > 0.9 ? 10 : -50;
    },
  },
  sylvaron_morning_dew: {
    // `sylvaron_morning_dew`: when the opponent is withered, it heals 15% after the hit (= loses 15%)
    afterAttack: (b, c, res) => {
      if (res.decoyBlocked || b.active(c.defender).fainted || !withered(b, c.defender)) return;
      b.heal(c.defender, 15);
    },
    aiScore: (b, id) => (withered(b, b.foe(id)) ? 30 : -25),
  },
  sylvaron_photosynthesis: {
    // `sylvaron_photosynthesis`: Leaves -> aether
    canUse: (b, id) => (leaves(b, id) > 0 ? null : '沒有萬葉'),
    effect: (b, id) => {
      const n = shedLeaves(b, id);
      if (n > 0) b.gainAether(id, n);
    },
    aiScore: (b, id) => {
      const n = leaves(b, id);
      const ae = b.side(id).aether;
      const ultReady = !!b.active(id).ultimate && !b.side(id).ultUsed;
      if (n >= 2 && ultReady && ae < 5 && ae + n >= 5) return 55;
      return n >= 3 && ae <= 2 ? 30 : -20;
    },
  },
  sylvaron_forest_roar: {
    // `sylvaron_forest_roar`: +15 per Leaf (not spent)
    power: (b, c, p) => p + 15 * leaves(b, c.attacker),
  },
  sylvaron_leaf_storm: {
    // `sylvaron_leaf_storm`: spends all the Leaves, +30 each
    power: (b, c, p) => p + 30 * leaves(b, c.attacker),
    afterUse: (b, id) => void shedLeaves(b, id),
    aiScore: (b, id) => {
      const n = leaves(b, id);
      return n >= 4 ? 45 : n >= 3 ? 30 : n <= 1 ? -30 : 0;
    },
  },
  sylvaron_withering_realm: {
    // `sylvaron_withering_realm`: Grove Domain for 5 turns (tag) plus Wither on the opponent's side for 4 turns (switching cannot escape it)
    effect: (b, id) => void b.addLasting(b.foe(id), REALM, 4, { side: true, from: id }),
    lasting: witherHooks('枯萎（陣地）'),
    aiScore: (b, id) => {
      if (b.side(b.foe(id)).lasting.some((l) => l.key === REALM)) return -80;
      return withered(b, b.foe(id)) && b.s.field?.element === 'nature' ? 15 : 45;
    },
  },
  u_sylvaron: {
    // `u_sylvaron`: Wither for 3 turns after hitting, both sides heal 20% (the opponent's healing always becomes damage)
    manual: ['heal'],
    afterAttack: (b, c, res) => {
      if (res.decoyBlocked) return;
      wither(b, c.attacker, 3);
      healBoth(b, c.attacker, 20);
    },
    // The best moment is when the opponent guarded last turn (it cannot guard this turn)
    aiScore: (b, id) => (foeOf(b, id).lastGuardTurn === b.s.turn ? 45 : 15),
  },

  // ── `banyanelder` ──
  banyanelder_root_lash: {
    // `banyanelder_root_lash`: grows 1 Aerial Root on a hit
    afterAttack: (b, c, res) => {
      if (!res.decoyBlocked) growRoots(b, c.attacker, 1);
    },
    aiScore: (b, id) => (roots(b, id) === 0 ? 20 : 0),
  },
  banyanelder_seed_root: {
    // `banyanelder_seed_root`: grows 1 root, and for 3 turns grows 1 more each turn (DEF +1 is resolved by tags)
    effect: (b, id) => {
      if (decoyBlocks(b, id)) return;
      growRoots(b, id, 1);
      b.addLasting(b.foe(id), SEED, 3, { from: id });
    },
    lasting: { name: '寄根' },
    aiScore: (b, id) => {
      if (b.getLasting(b.foe(id), SEED)) return -60;
      const n = roots(b, id);
      return n === 0 ? 45 : n <= 2 ? 10 : -30;
    },
  },
  banyanelder_root_crush: {
    // `banyanelder_root_crush`: +10 per root
    power: (b, c, p) => p + 10 * rootsOn(b.active(c.defender)),
  },
  banyanelder_hanging_root: {
    // `banyanelder_hanging_root`: power x2 when the opponent guarded last turn (it cannot guard this turn)
    power: (b, c, p) => (foeGuardedLastTurn(b, c.defender, !!c.estimate) ? p * 2 : p),
    aiScore: (b, id) => (foeGuardedLastTurn(b, b.foe(id), true) ? 40 : 0),
  },
  banyanelder_root_snare: {
    // `banyanelder_root_snare`: at the end of a turn where the opponent made no attack (after the guard breaks roots), the roots fill to 4 and coil for 3 turns
    // (when the banyan is not on the field there is only the coiling: the roots follow the banyan)
    trap: {
      on: 'turnEnd',
      when: (b, owner) => {
        const f = b.active(b.foe(owner));
        return !f.fainted && !f.usedAttackThisTurn;
      },
      fire: (b, owner) => {
        const f = b.active(b.foe(owner));
        if (decoyBlocks(b, owner)) return;
        if (b.active(owner).species.id === 'banyanelder') growRoots(b, owner, ROOT_MAX);
        if (!f.bound && !f.fainted) {
          f.bound = { turns: 3, pct: 4 };
          b.text(`${f.name} 被纏住了！`);
        }
      },
    },
    // More worth setting when the opponent may not attack (wants to guard to break free, fears the ultimate); useless during `banyanelder_tangle`
    aiScore: (b, id) => {
      if (tangled(b, id)) return -60;
      const ultReady = !b.side(id).ultUsed && b.side(id).aether >= 5;
      return roots(b, id) >= 3 || ultReady ? 40 : 20;
    },
  },
  banyanelder_growth_rings: {
    // `banyanelder_growth_rings`: ATK and DEF +1 each (tag); +1 more each when the opponent has 4 roots
    effect: (b, id) => {
      if (roots(b, id) < ROOT_MAX) return;
      b.changeStage(id, 'atk', 1);
      b.changeStage(id, 'def', 1);
    },
    aiScore: (b, id) => {
      const st = b.active(id).stages;
      if (st.atk >= 3) return -60;
      return roots(b, id) >= ROOT_MAX ? 35 : roots(b, id) >= 2 ? 0 : -25;
    },
  },
  root_bind: {
    // `root_bind`: grows 1 Aerial Root after hitting (the bind is resolved by tags)
    afterAttack: (b, c, res) => {
      if (!res.decoyBlocked) growRoots(b, c.attacker, 1);
    },
    aiScore: (b, id) => {
      const n = roots(b, id);
      return n <= 1 ? 55 : n >= ROOT_MAX && foeOf(b, id).bound ? -30 : 0;
    },
  },
  banyanelder_felled_trunk: {
    // `banyanelder_felled_trunk`: recoil 25% (waived when the opponent has 3 or more roots), resolved here
    manual: ['recoil'],
    afterAttack: (b, c, res) => {
      if (res.dealt <= 0 || rootsOn(b.active(c.defender)) >= 3) return;
      b.damage(c.attacker, Math.floor(res.dealt * 0.25), 'recoil');
    },
    aiScore: (b, id) => (roots(b, id) >= 3 ? 10 : -20),
  },
  banyanelder_strangle: {
    // `banyanelder_strangle`: +15 per root; ignores guard at 4 roots
    power: (b, c, p) => p + 15 * rootsOn(b.active(c.defender)),
    pierceGuard: (b, id) => roots(b, id) >= ROOT_MAX,
    aiScore: (b, id) => {
      const n = roots(b, id);
      return n >= ROOT_MAX ? 45 : n >= 3 ? 15 : n <= 1 ? -30 : 0;
    },
  },
  banyanelder_uproot: {
    // `banyanelder_uproot`: spends all the roots, 6% of max HP per root (the roots' +5% is already counted in this hit)
    afterAttack: (b, c, res) => {
      if (res.decoyBlocked) return;
      const n = clearRoots(b, c.attacker);
      if (n <= 0) return;
      b.text(`${b.active(c.defender).name} 身上的 ${n} 根氣根被連根拔起！`);
      if (!b.active(c.defender).fainted) b.trueDamage(c.defender, 6 * n, 'bind');
    },
    // For finishing: only worth pulling them out when the opponent is about to faint
    aiScore: (b, id) => {
      const n = roots(b, id);
      return n >= 3 && hpPct(foeOf(b, id)) <= 0.3 ? 50 : -35;
    },
  },
  banyanelder_tangle: {
    // `banyanelder_tangle`: the roots fill to 4, guards cannot break them for 3 turns (ATK +1 is resolved by tags)
    effect: (b, id) => {
      if (decoyBlocks(b, id)) return;
      growRoots(b, id, ROOT_MAX);
      b.addLasting(b.foe(id), TANGLE, 3, { from: id });
    },
    lasting: { name: '盤根錯節' },
    aiScore: (b, id) => (tangled(b, id) ? -80 : roots(b, id) <= 2 ? 35 : 15),
  },
  u_banyanelder: {
    // `u_banyanelder`: +30 per root, ignores guard (tag)
    power: (b, c, p) => p + 30 * rootsOn(b.active(c.defender)),
    aiScore: (b, id) => {
      const n = roots(b, id);
      return n >= 3 ? 35 : n <= 1 ? -40 : 0;
    },
  },

  // ── `elderwood_warden` ──
  elderwood_warden_paw_swipe: {
    // `elderwood_warden_paw_swipe`: 5% wood shield after hitting (stacking)
    manual: ['shield'],
    afterAttack: (b, c, res) => {
      if (!res.decoyBlocked) addWood(b, c.attacker, 5);
    },
  },
  elderwood_warden_shoulder_log: {
    // `elderwood_warden_shoulder_log`: 35% wood shield (stacking)
    manual: ['shield'],
    effect: (b, id) => addWood(b, id, 35),
    aiScore: (b, id) => {
      const w = woodPct(b.active(id));
      return w >= 40 ? -60 : w < 15 ? 30 : 0;
    },
  },
  elderwood_warden_log_slam: logSlam(2),
  elderwood_warden_roar: {
    // `elderwood_warden_roar`: taunt (tag) plus 15% wood shield
    manual: ['shield'],
    effect: (b, id) => addWood(b, id, 15),
    aiScore: (b, id) => (foeOf(b, id).status.taunt ? -40 : 0),
  },
  elderwood_warden_guardian_heart: {
    // `elderwood_warden_guardian_heart`: cleanse (tag) plus 25% wood shield
    manual: ['shield'],
    effect: (b, id) => addWood(b, id, 25),
    aiScore: (b, id) => (Object.keys(b.active(id).status).length > 0 ? 30 : -10),
  },
  elderwood_warden_bark_charge: {
    // `elderwood_warden_bark_charge`: 15% wood shield after hitting (stacking)
    manual: ['shield'],
    afterAttack: (b, c, res) => {
      if (!res.decoyBlocked) addWood(b, c.attacker, 15);
    },
  },
  elderwood_warden_ancient_slam: logSlam(2.5),
  elderwood_warden_moss_layers: {
    // `elderwood_warden_moss_layers`: 35% wood shield (stacking) plus DEF +1 (tag)
    manual: ['shield'],
    effect: (b, id) => addWood(b, id, 35),
    aiScore: (b, id) => (woodPct(b.active(id)) >= 40 ? -60 : 10),
  },
  elderwood_warden_ward_snare: {
    // `elderwood_warden_ward_snare`: when `elderwood_warden` is attacked, damage -30%, and after the attack resolves it gains 15% wood shield
    trap: {
      on: 'foeAttack',
      when: (b, owner) => b.active(owner).species.id === 'elderwood_warden',
      fire: (b, owner) => ({ reduce: 0.3, after: () => addWood(b, owner, 15) }),
    },
  },
  elderwood_warden_mountain_slam: {
    // `elderwood_warden_mountain_slam`: ignores guard while it has wood shield (does not spend the wood shield)
    pierceGuard: (b, id) => woodPct(b.active(id)) > 0,
  },
  u_elderwood_warden: {
    // `u_elderwood_warden`: Log Slam (+3 per 1%), and after hitting it shoulders 30% wood shield again
    manual: ['shield'],
    power: (b, c, p) => p + Math.floor(3 * slamPct(b.active(c.attacker))),
    afterAttack: (b, c) => void (b.active(c.attacker).vars['e:ew:ultHit'] = 1),
    afterUse: (b, id) => {
      const c = b.active(id);
      spendWood(b, id);
      if (c.vars['e:ew:ultHit']) addWood(b, id, 30);
      delete c.vars['e:ew:ultHit'];
    },
    aiScore: (b, id) => (slamPct(b.active(id)) >= 25 ? 40 : -20),
  },

  // ── `owlarchivist` ──
  owlarchivist_record: {
    // `owlarchivist_record`: sees through the opponent's last used skill (revealing a trap is resolved by tags)
    effect: (b, id) => see(b, id),
    aiScore: (b, id) => owlSeeScore(b, id),
  },
  owlarchivist_quill: {
    // `owlarchivist_quill`: sees through after hitting
    afterAttack: (b, c, res) => {
      if (!res.decoyBlocked) see(b, c.attacker);
    },
    aiScore: (b, id) => owlSeeScore(b, id),
  },
  owlarchivist_night_reading: {
    // `owlarchivist_night_reading`: +40 when the opponent has a skill sealed
    power: (b, c, p) => (foeSealed(b, c.attacker) ? p + 40 : p),
  },
  owlarchivist_foreshadow: {
    // `owlarchivist_foreshadow`: when the opponent attacks with the seen-through skill, makes that attack void
    trap: {
      on: 'foeAttack',
      when: (b, owner, ev) => !!ev.ctx && ev.ctx.sk.id === seenOf(b, owner),
      fire: (b) => {
        b.text('早就寫在書上了！');
        return { negate: true };
      },
    },
    aiScore: (b, id) => (seenOf(b, id) && isAttack(getSkill(seenOf(b, id)!)) ? 45 : -60),
  },
  seal_scroll: {
    // `seal_scroll`: after hitting, seals the seen-through skill for 2 turns without ending the See-Through; with nothing seen through, seals the opponent's last used skill for 2 turns (no effect when guarded)
    manual: ['disable'],
    afterAttack: (b, c, res) => {
      if (res.decoyBlocked || b.active(c.defender).fainted) return;
      const seen = seenOf(b, c.attacker);
      if (seen) {
        // The See-Through does not end: after it is unsealed and used again it is still -40%, and gets sealed again after use
        sealSkill(b, c.attacker, seen, 2);
      } else {
        b.disableSkill(c.defender, 2);
      }
    },
    aiScore: (b, id) => (seenOf(b, id) ? 25 : foeSealed(b, id) ? -40 : 0),
  },
  owlarchivist_word_rain: {
    // `owlarchivist_word_rain`: sees through after hitting
    afterAttack: (b, c, res) => {
      if (!res.decoyBlocked) see(b, c.attacker);
    },
    aiScore: (b, id) => owlSeeScore(b, id),
  },
  owlarchivist_decipher: {
    // `owlarchivist_decipher`: +60 when the opponent has a skill sealed, and extends the seal by 1 turn
    power: (b, c, p) => (foeSealed(b, c.attacker) ? p + 60 : p),
    afterAttack: (b, c) => {
      const f = b.active(c.defender);
      if (!f.fainted && foeSealed(b, c.attacker) && f.disabled) {
        f.disabled.turns += 1;
        b.text(`「${getSkill(f.disabled.skill).name}」的封印延長了 1 回合。`);
      }
    },
    aiScore: (b, id) => (foeSealed(b, id) ? 40 : -15),
  },
  owlarchivist_night_patrol: {
    // `owlarchivist_night_patrol`: +30 when the opponent has a skill sealed
    power: (b, c, p) => (foeSealed(b, c.attacker) ? p + 30 : p),
  },
  u_owlarchivist: {
    // `u_owlarchivist`: after hitting, seals the seen-through skill for 3 turns without ending the See-Through (sees through first when nothing is seen through)
    manual: ['disable'],
    afterAttack: (b, c, res) => {
      if (res.decoyBlocked || b.active(c.defender).fainted) return;
      if (!seenOf(b, c.attacker)) see(b, c.attacker);
      const seen = seenOf(b, c.attacker);
      if (seen) sealSkill(b, c.attacker, seen, 3);
    },
    // Cast only when the opponent guarded last turn (it cannot guard this turn), otherwise it will most likely be blocked
    aiScore: (b, id) => (foeOf(b, id).lastGuardTurn === b.s.turn ? 45 : -15),
  },

  // ── `dreamcap` ──
  dreamcap_spore_shot: {
    // `dreamcap_spore_shot` (poison is resolved by tags): do not wake the opponent when it is asleep
    aiScore: (b, id) => (foeOf(b, id).status.sleep && (foeOf(b, id).status.sleep?.turns ?? 0) > 1 ? -30 : 0),
  },
  dreamcap_dream_dust: {
    // `dreamcap_dream_dust`: Enter Dream
    manual: ['status.sleep'],
    effect: (b, id) => void dream(b, id),
    aiScore: (b, id) => (canDream(b, id) ? 60 : -80),
  },
  dreamcap_rude_awakening: {
    // `dreamcap_rude_awakening`: when it hits a sleeping opponent (which will wake), the opponent is poisoned for 3 stacks
    keepSleep: (b, c) => {
      b.active(c.attacker).vars[WOKE] = 1;
      return false;
    },
    afterAttack: (b, c, res) => {
      const me = b.active(c.attacker);
      const woke = !!me.vars[WOKE];
      delete me.vars[WOKE];
      if (woke && !res.decoyBlocked && !b.active(c.defender).fainted) b.applyStatus(c.defender, 'poison', 3);
    },
    aiScore: (b, id) => {
      const sl = foeOf(b, id).status.sleep;
      return sl ? (sl.turns <= 1 ? 35 : -30) : -5;
    },
  },
  dreamcap_spore_coat: {
    // `dreamcap_spore_coat`: for 4 turns, an opponent that hits `dreamcap` with an attack is poisoned for 2 stacks (the lasting effect sits on `dreamcap`)
    effect: (b, id) => void b.addLasting(id, 'dreamcap_spore_coat', 4, { from: id }),
    lasting: {
      name: '孢衣',
      onHitTaken: (b, ctx) => {
        if (!b.active(ctx.attacker).fainted) b.applyStatus(ctx.attacker, 'poison', 2);
      },
    },
    aiScore: (b, id) => (b.getLasting(id, 'dreamcap_spore_coat') ? -60 : hpPct(b.active(id)) > 0.5 ? 30 : 5),
  },
  dreamcap_dream_cloud: {
    // `dreamcap_dream_cloud`: Enter Dream after hitting
    afterAttack: (b, c, res) => {
      if (!res.decoyBlocked && !b.active(c.defender).fainted) dream(b, c.attacker, true);
    },
    aiScore: (b, id) => (canDream(b, id) ? 35 : 0),
  },
  dreamcap_cap_bloom: {
    // `dreamcap_cap_bloom` (resolved by tags): open the umbrella while the opponent is asleep
    aiScore: (b, id) => (foeOf(b, id).status.sleep ? 30 : 0),
  },
  dreamcap_fairy_ring: {
    // `dreamcap_fairy_ring`: when an opponent with 3 or more stacks of poison attacks, makes that attack void and enters the dream
    trap: {
      on: 'foeAttack',
      when: (b, owner) => canDream(b, owner),
      fire: (b, owner) => {
        b.text('踩進了菌圈！');
        return { negate: true, after: () => void dream(b, owner) };
      },
    },
    aiScore: (b, id) => (poisonOf(foeOf(b, id)) >= 2 ? 30 : -20),
  },
  u_dreamcap: {
    // `u_dreamcap`: poisons for 3 stacks after hitting, then Enter Dream
    manual: ['status.poison', 'status.sleep'],
    afterAttack: (b, c, res) => {
      if (res.decoyBlocked || b.active(c.defender).fainted) return;
      b.applyStatus(c.defender, 'poison', 3);
      dream(b, c.attacker);
    },
    aiScore: (b, id) => (b.statusBlocked(b.foe(id), 'sleep') ? -20 : 30),
  },

  // ── `acornsquirrel` ──
  acornsquirrel_cone_toss: {
    // `acornsquirrel_cone_toss`: when there is no stashed fruit, buries 1 after hitting
    afterAttack: (b, c, res) => {
      if (!res.decoyBlocked && fruits(b.active(c.attacker)) === 0) buryFruit(b, c.attacker, 1);
    },
  },
  acornsquirrel_bury_acorns: {
    // `acornsquirrel_bury_acorns`: buries 2 stashed fruit
    effect: (b, id) => void buryFruit(b, id, 2),
    aiScore: (b, id) => {
      const n = fruits(b.active(id));
      return n >= FRUIT_MAX ? -80 : n === 0 ? 35 : n === 1 ? 10 : -20;
    },
  },
  acornsquirrel_nut_shell: {
    // `acornsquirrel_nut_shell`: DEF +1 (tag) plus buries 1 stashed fruit
    effect: (b, id) => void buryFruit(b, id, 1),
    aiScore: (b, id) => (fruits(b.active(id)) >= FRUIT_MAX ? -40 : 0),
  },
  acornsquirrel_hoard_rush: {
    // `acornsquirrel_hoard_rush`: buries 1 stashed fruit after hitting
    afterAttack: (b, c, res) => {
      if (!res.decoyBlocked) buryFruit(b, c.attacker, 1);
    },
  },
  acornsquirrel_stash_snare: {
    // `acornsquirrel_stash_snare`: when `acornsquirrel` is attacked, damage -20%, and after the attack resolves it buries 1 stashed fruit
    trap: {
      on: 'foeAttack',
      when: (b, owner) => b.active(owner).species.id === 'acornsquirrel',
      fire: (b, owner) => ({ reduce: 0.2, after: () => void buryFruit(b, owner, 1) }),
    },
  },
  acornsquirrel_grove_planting: {
    // `acornsquirrel_grove_planting`: buries 2 stashed fruit plus heals 10% (tag)
    effect: (b, id) => void buryFruit(b, id, 2),
    aiScore: (b, id) => (fruits(b.active(id)) >= 2 ? -50 : 20),
  },
  u_acornsquirrel: {
    // `u_acornsquirrel`: after hitting, fills the stashed fruit to 3
    afterAttack: (b, c, res) => {
      if (!res.decoyBlocked) buryFruit(b, c.attacker, FRUIT_MAX);
    },
  },

  // ── `leaffrog` ──
  echo_pipe: pipe(),
  leaffrog_water_pipe: pipe(),
  leaffrog_grove_concert: pipe(100),
  leaffrog_chorus: pipe(),
  u_leaffrog: pipe(100),
  leaffrog_echo_valley: {
    // `leaffrog_echo_valley`: when the opponent attacks, damage -30%, and after the attack resolves that move is recorded as `leaffrog`'s echo (50%)
    trap: {
      on: 'foeAttack',
      when: (b, owner) => b.active(owner).species.id === 'leaffrog',
      fire: (b, owner, ev) => ({
        reduce: 0.3,
        after: () => {
          if (ev.ctx && isAttack(ev.ctx.sk) && ev.ctx.sk.category !== 'ultimate') setEcho(b, owner, ev.ctx.sk.id, 50);
        },
      }),
    },
  },
};

export const KIT: Record<string, KitHooks> = {
  sylvaron: {
    // Myriad Leaf Blessing (the rewritten trait): on entering, sets Grove Domain for 3 turns and withers the opponent for 2 turns
    onEnter: (b, id) => {
      b.traitEvent(id, '萬葉庇佑');
      b.setField('nature', 3);
      wither(b, id, 2);
    },
    // Myriad Leaf Blessing (trait): each Leaf lowers the attack damage taken by 5% (keeping Leaves is defense, spending them is offense)
    incoming: (b, a, dmg) => {
      const n = leaves(b, a.defender);
      return n > 0 ? Math.floor(dmg * (1 - LEAF_GUARD * n)) : dmg;
    },
    marks: (b, id) => {
      const n = leaves(b, id);
      return n > 0 ? [{ id: 'kit:leaf', n, note: `萬葉（受到傷害 −${Math.round(LEAF_GUARD * n * 100)}%）` }] : [];
    },
  },
  banyanelder: {
    // Coiled Roots (the rewritten trait): cannot be forced to switch
    forceSwitchImmune: true,
    // Aerial Roots: the banyan's damage against the coiled opponent +5% per root, and the damage it takes from it -5% per root
    attackBonus: (b, a) => ROOT_PCT * rootsOn(b.active(a.defender)),
    incoming: (b, a, dmg) => {
      const n = rootsOn(b.active(a.attacker));
      return n > 0 ? Math.floor(dmg * (1 - ROOT_PCT * n)) : dmg;
    },
    // End of turn: the roots grow 1 more; if the opponent guarded successfully this turn, 2 roots break (they cannot break during `banyanelder_tangle`), and the banyan gains 1 aether for each root broken
    onEndTurn: (b, id) => {
      const f = foeOf(b, id);
      const n = rootsOn(f);
      if (n <= 0) return;
      if (f.guarding && !tangled(b, id)) {
        const k = Math.min(ROOT_SHED, n);
        f.vars[ROOT] = n - k;
        b.text(`${f.name} 掙斷了 ${k} 根氣根！`);
        b.traitEvent(id, '盤根');
        b.gainAether(id, k);
        return;
      }
      if (f.guarding) b.text(`「盤根錯節」：${f.name} 掙不斷氣根！`);
      growRoots(b, id, b.getLasting(b.foe(id), SEED) ? 2 : 1);
    },
    onLeave: (b, id) => void clearRoots(b, id),
    onFaint: (b, id) => void clearRoots(b, id),
    marks: (b, id) => {
      const n = roots(b, id);
      return n > 0 ? [{ id: 'kit:root', n, note: `對手的氣根（±${Math.round(ROOT_PCT * n * 100)}%）` }] : [];
    },
    // Lets the opponent AI know to guard to break free when there are many roots (during `banyanelder_tangle` they cannot be broken, so guarding is pointless)
    aiFoeGuard: (b, id) => {
      const n = roots(b, id);
      if (tangled(b, id)) return -20;
      return n >= ROOT_MAX ? 30 : n >= 3 ? 18 : 0;
    },
  },
  elderwood_warden: {
    // Forest's Shelter (the rewritten trait): at the end of a turn where no attack skill was used, gains 10% wood shield
    onEndTurn: (b, id) => {
      const c = b.active(id);
      if (!c.usedAttackThisTurn) {
        b.traitEvent(id, '森之庇護');
        addWood(b, id, 10);
      }
      // Records the wood shield at the end of this turn (one that expires at the end of this turn does not count), for Log Slam next turn
      c.vars[WOOD_PREV] = c.shield && c.shield.turns > 1 ? woodPct(c) : 0;
    },
    marks: (b, id) => {
      const w = Math.floor(woodPct(b.active(id)));
      return w > 0 ? [{ id: 'kit:wood', n: w, note: `木盾 ${w}%` }] : [];
    },
  },
  owlarchivist: {
    // Record (the rewritten trait): on entering, sees through the opponent's last used skill
    onEnter: (b, id) => {
      const f = b.active(b.foe(id));
      if (f.fainted || seeTarget(f) < 0) return;
      b.traitEvent(id, '記錄');
      see(b, id);
    },
    // See-Through: the seen-through skill does -40% damage against the owl
    incoming: (b, a, dmg) => (a.sk.id === seenOf(b, a.defender) ? Math.floor(dmg * (1 - SEEN_CUT)) : dmg),
    // The opponent uses the seen-through skill again -> sealed for 2 turns at the end of the turn, and the See-Through ends
    onEndTurn: (b, id) => {
      const f = b.active(b.foe(id));
      const seen = seenOf(b, id);
      if (!seen || f.lastSkill !== seen || f.usedSinceEnter <= (f.vars[SEEN_AT] ?? 0)) return;
      b.traitEvent(id, '看穿');
      clearSeen(b, id);
      sealSkill(b, id, seen, 2);
    },
    onLeave: (b, id) => clearSeen(b, id),
    onFaint: (b, id) => clearSeen(b, id),
    marks: (b, id) => {
      const seen = seenOf(b, id);
      return seen ? [{ id: 'kit:insight', note: `看穿：${getSkill(seen).name}` }] : [];
    },
  },
  dreamcap: {
    // AI: no need to guard while the opponent is asleep
    aiGuard: (b, id) => (foeOf(b, id).status.sleep ? -80 : 0),
    // Phantom Spores: the mark row hints the opponent's poison stacks (Enter Dream needs 3 stacks)
    marks: (b, id) => {
      const n = poisonOf(foeOf(b, id));
      return n > 0 ? [{ id: 'kit:spore', n, note: n >= DREAM_COST ? '幻孢：可以入夢' : `幻孢：入夢還差 ${DREAM_COST - n} 層` }] : [];
    },
  },
  acornsquirrel: {
    // Stashed Fruit: after being attacked with HP at or below 50%, eats 1 (at most 1 per turn)
    onHitTaken: (b, a) => {
      const c = b.active(a.defender);
      if (c.fainted || c.hp * 2 > c.maxHp || c.vars[ATE] === b.s.turn) return;
      eatFruit(b, a.defender);
    },
    marks: (b, id) => {
      const n = fruits(b.active(id));
      return n > 0 ? [{ id: 'kit:fruit', n, note: `藏果 ${n}／${FRUIT_MAX}` }] : [];
    },
  },
  leaffrog: {
    // Rejuvenation: the echo rings at the end of the turn after it is left; Morning Dew (the rewritten trait): at the end of a turn where an echo rang, cures one status condition
    onEndTurn: (b, id) => {
      const c = b.active(id);
      if (c.vars[ECHO] && (c.vars[ECHO_AT] ?? 0) <= b.s.turn) ringEcho(b, id);
      if (c.fainted || c.vars[RANG] !== b.s.turn) return;
      const st = (Object.keys(c.status) as (keyof typeof c.status)[])[0];
      if (!st) return;
      b.traitEvent(id, '晨露');
      b.removeStatus(id, st);
    },
    marks: (b, id) => {
      const c = b.active(id);
      const sk = echoSkill(c);
      return sk ? [{ id: 'kit:echo', note: `回音：${getSkill(sk).name}（${c.vars[ECHO_PCT] ?? 50}%）` }] : [];
    },
  },
};

/** For tests: the key names the mechanics use */
export const NATURE_KEYS = { LEAF, WITHER, REALM, LEAF_MAX, ROOT, ROOT_MAX, TANGLE, SEED, WOOD_CAP, SEEN, FRUIT, FRUIT_MAX, ECHO } as const;
