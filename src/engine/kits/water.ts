// Skill hooks and kit hooks for the water group (data/kits/water.json). See docs/10-kit-authoring.md for how to write them.
// Only `import type { Battle }` is allowed (importing battle.ts at runtime would create a circular dependency).

import type { Battle } from '../battle.ts';
import { getVar, type KitHooks, type SkillHooks } from '../skillfx.ts';
import type { SkillDef } from '../../../sim/types.ts';
import type { MarkView, SideId } from '../types.ts';

// ═════════════════════════ `thalassene`: Tide ═════════════════════════
// "Tide" switches between high tide and low tide at the end of every turn (it enters at high tide).
// High tide: attack damage taken -20%, and each hit taken raises the tide level by 1 (max 3). Low tide: attack damage dealt +20%.
// The tide level is spent by exclusive skills; `thalassene_riptide` holds the tide for one turn; `thalassene_moonpull` doubles the tide effects; the ultimate `u_thalassene` ("Spring Tide") enjoys both sides at once.

const THAL = 'thalassene';
/** 0 = high tide, 1 = low tide (e: prefix, cleared on leaving) */
const EBB = 'e:ths:ebb';
/** Tide level 0 to 3 */
const TIDE = 'e:ths:tide';
/** 1 = the tide does not switch at the end of this turn (`thalassene_riptide`) */
const HOLD = 'e:ths:hold';
const TIDE_MAX = 3;
/** Base tide effect: damage reduction at high tide, damage bonus at low tide */
const TIDE_EFFECT = 0.2;
/** Spring Tide (the lasting effect created by the ultimate) */
const SPRING = 'u_thalassene';
/** `thalassene_moonpull` (lasting effect: tide effects doubled) */
const MOON = 'thalassene_moonpull';

const isThal = (b: Battle, id: SideId): boolean => {
  const c = b.active(id);
  return c.species.id === THAL && !c.fainted;
};
const inSpring = (b: Battle, id: SideId): boolean => !!b.getLasting(id, SPRING);
/** Currently at high tide (Spring Tide counts too) */
const flood = (b: Battle, id: SideId): boolean => isThal(b, id) && (getVar(b, id, EBB) === 0 || inSpring(b, id));
/** Currently at low tide (Spring Tide counts too) */
const ebb = (b: Battle, id: SideId): boolean => isThal(b, id) && (getVar(b, id, EBB) === 1 || inSpring(b, id));
/** `thalassene_moonpull`: tide effects doubled */
const amp = (b: Battle, id: SideId): number => (b.getLasting(id, MOON) ? 2 : 1);
const tideOf = (b: Battle, id: SideId): number => (isThal(b, id) ? getVar(b, id, TIDE) : 0);

function addTide(b: Battle, id: SideId, n: number): void {
  if (!isThal(b, id)) return;
  const c = b.active(id);
  const before = c.vars[TIDE] ?? 0;
  const v = Math.min(TIDE_MAX, before + n);
  if (v === before) return;
  c.vars[TIDE] = v;
  b.text(`${c.name} 的「潮位」${v}／${TIDE_MAX}`);
}

/** Spends all the tide level and returns the number of stacks spent */
function spendTide(b: Battle, id: SideId): number {
  if (!isThal(b, id)) return 0;
  const c = b.active(id);
  const n = c.vars[TIDE] ?? 0;
  if (n > 0) {
    c.vars[TIDE] = 0;
    b.text(`${c.name} 消耗了 ${n} 層「潮位」！`);
  }
  return n;
}

/** Whether next turn is still low tide (held tide or Spring Tide). Used by the AI to decide "cast now or wait" */
const ebbNext = (b: Battle, id: SideId): boolean => {
  const c = b.active(id);
  return inSpring(b, id) || (c.vars[HOLD] ? c.vars[EBB] === 1 : c.vars[EBB] !== 1);
};

/**
 * AI: when the low-tide burst is likely to be guarded (the opponent can still guard, and this hit would hurt it badly), first use `thalassene_riptide` to hold the low tide:
 * if the opponent guards this turn, it cannot guard again next turn, while the tide is still low.
 */
function baitGuard(b: Battle, id: SideId): boolean {
  if (!ebb(b, id) || inSpring(b, id) || tideOf(b, id) < 2) return false;
  const c = b.active(id);
  if (!c.skills.includes('thalassene_riptide') || !b.canUse(id, 'thalassene_riptide').ok) return false;
  const f = b.foe(id);
  if (!b.canGuard(f).ok) return false;
  const payoffs = ['thalassene_raging_tide', 'thalassene_backwash'].filter((s) => c.skills.includes(s));
  const big = Math.max(0, ...payoffs.map((s) => b.estimate(id, s)));
  return big >= b.active(f).hp * 0.6;
}

// ═════════════════════════ `siren`: Reverie ═════════════════════════
// The siren's exclusive attacks do not wake an opponent that is asleep (keepSleep); each hit on a sleeping opponent gives it +1 "Dream Depth" (max 3).
// Dream Depth is stored on the "opponent" (e: prefix, cleared when the opponent leaves) and is spent by `siren_nightmare`, `siren_dream_eater`, `siren_dream_theft` and `siren_dream_siphon`.
// Cost: after the opponent wakes up, its "toughness" lasts 1 turn longer (it cannot be put to sleep again right away).

const SIREN = 'siren';
/** Dream Depth 0 to 3 (stored on the spirit whose dreams are being stolen) */
const DREAM = 'e:sir:dream';
/** 1 = the opponent was still asleep at the end of the last turn (Lost Melody uses it to detect "waking up") */
const SLEPT = 'e:sir:slept';
const DREAM_MAX = 3;
/** The opponent's toughness at the end of the turn it wakes (before the decrement): 1 turn more than the engine's 2 */
const WAKE_TOUGHNESS = 3;
/** `siren_nightmare`: % of max HP the opponent loses per stack of Dream Depth */
const NIGHTMARE_PCT = 12;

const asleep = (b: Battle, side: SideId): boolean => !!b.active(side).status.sleep;
/** Dream Depth on the opponent of side id */
const dreamOf = (b: Battle, id: SideId): number => getVar(b, b.foe(id), DREAM);

/** Whether the opponent can be put to sleep now (for the AI: already controlled, toughness and Sanctuary all make it fail) */
function sleepable(b: Battle, id: SideId): boolean {
  const d = b.active(b.foe(id));
  if (d.fainted || d.toughness > 0 || b.s.field?.element === 'light') return false;
  return !d.status.sleep && !d.status.freeze && !d.status.fear;
}

function addDream(b: Battle, id: SideId, n: number): void {
  const d = b.active(b.foe(id));
  if (d.fainted) return;
  const before = d.vars[DREAM] ?? 0;
  const v = Math.min(DREAM_MAX, before + n);
  if (v === before) return;
  d.vars[DREAM] = v;
  b.text(`${d.name} 的「夢深」${v}／${DREAM_MAX}`);
}

/** Spends the Dream Depth on the opponent (at most max stacks) and returns the number of stacks spent */
function spendDream(b: Battle, id: SideId, max = DREAM_MAX): number {
  const d = b.active(b.foe(id));
  const have = d.vars[DREAM] ?? 0;
  const n = Math.min(have, max);
  if (n > 0) {
    d.vars[DREAM] = have - n;
    b.text(`吞下了 ${d.name} 的 ${n} 層「夢深」！`);
  }
  return n;
}

/** Reverie: exclusive attacks do not wake a sleeping opponent; a hit on a sleeping opponent gives Dream Depth +1 (extra: added on top) */
const dreamHit = (extra = 0): Pick<SkillHooks, 'keepSleep' | 'onHit'> => ({
  keepSleep: () => true,
  onHit: (b, c, h) => {
    if (!c.estimate && !h.ko && h.dmg > 0 && asleep(b, c.defender)) addDream(b, c.attacker, 1 + extra);
  },
});

/** AI for sleep skills: do not waste them when the opponent cannot fall asleep (the engine's base score does not know about toughness) */
const sleepScore = (b: Battle, id: SideId, base: number): number => {
  if (!sleepable(b, id)) return -base - 20;
  const d = b.active(b.foe(id));
  return d.hp / d.maxHp > 0.3 ? 10 : -10;
};

// ═════════════════════════ `oathsea_sage`: Chant ═════════════════════════
// "Chant" is the engine's c.arcaneChain: +1 for every magic attack (ultimates included), max 3;
// it resets to zero when a status skill, a physical skill or a guard is used, or on leaving (the engine updates it in afterSkill at the very end of skill resolution; traps have no effect on it).
// "Coda" spends all the Chant: afterUse sets it to -1, and the engine's following afterSkill (magic +1) brings it back to 0.

/** `oathsea_sage_shell_ward`: the Chant to restore at the end of this turn (the engine zeroes the Chant after a status skill) */
const KEEP = 'e:oat:keep';
const CHANT_MAX = 3;
/** Tidal Chant: magic damage bonus per stack of Chant */
const CHANT_BONUS = 0.08;

const chantOf = (b: Battle, id: SideId): number => Math.max(0, b.active(id).arcaneChain);

/** Coda: spends all the Chant and returns the number of stacks spent */
function spendChant(b: Battle, id: SideId): number {
  const c = b.active(id);
  const n = Math.max(0, c.arcaneChain);
  if (n > 0) b.text(`${c.name} 收束了 ${n} 層「詠唱」！`);
  c.arcaneChain = -1;
  return n;
}

/** Sets the Chant; shown = the number of stacks displayed (set in a skill's afterUse, the engine adds +1 afterwards) */
function setChant(b: Battle, id: SideId, n: number, shown = n): void {
  const c = b.active(id);
  const v = Math.min(CHANT_MAX, n);
  if (v === c.arcaneChain) return;
  c.arcaneChain = v;
  b.text(`${c.name} 的「詠唱」${Math.min(CHANT_MAX, Math.max(0, shown))}／${CHANT_MAX}`);
}

/** AI for Coda: the deeper the Chant, the more it wants to wrap up */
const codaScore = (n: number): number => (n === 0 ? -30 : n === 1 ? -12 : n === 2 ? 4 : 15);

// ═════════════════════════ `swordfish`: Crest ═════════════════════════
// An exclusive attack that hits before the opponent acts this turn -> gains a "Crest" (0 or 1).
// "Wave Pierce" skills spend the Crest: a power bonus and ignoring guard and shields; a Wave Pierce skill itself does not gain a Crest.

const CREST = 'e:swf:crest';

const hasCrest = (b: Battle, id: SideId): boolean => getVar(b, id, CREST) > 0;

function gainCrest(b: Battle, id: SideId): void {
  const c = b.active(id);
  if (c.fainted || c.vars[CREST]) return;
  c.vars[CREST] = 1;
  b.text(`${c.name} 乘上了「浪尖」！`);
}

/** Crest builder: gains a Crest when it hits before the opponent acts */
const crestBuilder: Pick<SkillHooks, 'afterAttack' | 'aiScore'> = {
  afterAttack: (b, c, r) => {
    if (r.hits > 0 && !r.decoyBlocked && !r.ko && !b.hasActed(c.defender)) gainCrest(b, c.attacker);
  },
  // Already has a Crest: prefer a Wave Pierce skill
  aiScore: (b, id) => (hasCrest(b, id) ? -8 : 0),
};

/** Wave Pierce: with a Crest, power +bonus and ignores guard and shields; the Crest is spent after use */
const crestPayoff = (bonus: number): Pick<SkillHooks, 'power' | 'pierceGuard' | 'afterUse' | 'aiScore'> => ({
  power: (b, c, p) => (hasCrest(b, c.attacker) ? p + bonus : p),
  pierceGuard: (b, id) => hasCrest(b, id),
  afterUse: (b, id) => {
    const c = b.active(id);
    if (!c.vars[CREST]) return;
    c.vars[CREST] = 0;
    b.text(`${c.name} 乘著浪尖貫穿而過！`);
  },
  aiScore: (b, id) => {
    if (!hasCrest(b, id)) return -35;
    const f = b.foe(id);
    // Wave Pierce is worth more when the opponent may guard
    return 15 + (b.canGuard(f).ok && b.side(f).aether >= 1 ? 10 : 0);
  },
});

// ═════════════════════════ `springlotus`: Full Spring ═════════════════════════
// Our aether >= 5 before using a skill -> "Full Spring" (attack damage taken -15%). The hook runs during skill resolution (the cost is already paid), so it judges by "current aether + this cost";
// for estimates (AI, skill card) the cost is not paid yet, so it just looks at the current aether.

const FULL_AT = 5;
/** Spring Surge: aether kept back */
const SURGE_KEEP = 5;
const STAR_FONT = 'springlotus_star_font';

const fullNow = (b: Battle, id: SideId): boolean => b.side(id).aether >= FULL_AT;
/** Whether it was at Full Spring before this use (during skill resolution the cost is already paid and must be added back; in estimates it is not paid yet) */
const fullFor = (b: Battle, id: SideId, sk: SkillDef, estimate = false): boolean =>
  b.side(id).aether + (estimate ? 0 : b.costFor(id, sk)) >= FULL_AT;

// ═════════════════════════ `icecrown`: Frost ═════════════════════════
// After an [Ice] skill hits, the opponent gets +1 "Frost" (stored on the opponent, cleared when the opponent leaves); at 3 stacks it freezes and Frost resets to zero.
// When it cannot freeze (water element, toughness, already controlled, Blazing Sun, Sanctuary), Frost stays at 3 stacks and waits for the next [Ice] hit to try again.

/** Frost 0 to 3 (stored on the opponent) */
const FROST = 'e:ice:frost';
const FROST_MAX = 3;

const frostOf = (b: Battle, id: SideId): number => getVar(b, b.foe(id), FROST);
const frozen = (b: Battle, side: SideId): boolean => !!b.active(side).status.freeze;

/** Whether the opponent can be frozen now (so that every hit does not show "No effect" while Frost sits at 3 stacks) */
function canFreeze(b: Battle, side: SideId): boolean {
  const d = b.active(side);
  if (d.fainted || d.elements.includes('water') || d.toughness > 0) return false;
  if (d.status.freeze || d.status.sleep || d.status.fear) return false;
  const field = b.s.field?.element;
  return field !== 'fire' && field !== 'light';
}

/** The opponent of side id gets Frost +n; it freezes at 3 stacks */
function addFrost(b: Battle, id: SideId, n: number): void {
  const f = b.foe(id);
  const d = b.active(f);
  if (d.fainted || n <= 0) return;
  const before = d.vars[FROST] ?? 0;
  const v = Math.min(FROST_MAX, before + n);
  if (v !== before) {
    d.vars[FROST] = v;
    b.text(`${d.name} 的「霜」${v}／${FROST_MAX}`);
  }
  if (v >= FROST_MAX && canFreeze(b, f) && b.applyStatus(f, 'freeze')) {
    d.vars[FROST] = 0;
    b.text(`${d.name} 被霜封住了！`);
  }
}

/** [Ice]: Frost +1 after each hit */
const iceHit = (hits = 1): Pick<SkillHooks, 'onHit' | 'aiScore'> => ({
  onHit: (b, c, h) => {
    if (!c.estimate && !h.ko && h.dmg > 0) addFrost(b, c.attacker, 1);
  },
  // Prefer this skill when it can fill Frost and lock the opponent down
  aiScore: (b, id) => (frostOf(b, id) + hits >= FROST_MAX && canFreeze(b, b.foe(id)) ? 20 : 0),
});

/** `shatter_lance`: power +bonus against a frozen opponent (priority +1 is written on the skill itself) */
const shatter = (bonus: number): Pick<SkillHooks, 'power' | 'aiScore'> => ({
  power: (b, c, p) => (frozen(b, c.defender) ? p + bonus : p),
  aiScore: (b, id) => (frozen(b, b.foe(id)) ? 20 : -10),
});

// ═════════════════════════ `bubblecrab`: Bounce Shell ═════════════════════════
// When hit by a physical attack, each hit's damage is reduced by 5% of max HP ("bounce off"), and the bounced damage is reflected to the attacker after the attack resolves.
// While `bubblecrab_bubble_wall` is up, magic attacks bounce off too. incoming is called only in real resolution (not in estimates).

/** Damage accumulated by this attack to be reflected */
const BOUNCE = 'e:crab:bounce';
/** The turn of the latest bounce (`bubblecrab_bubble_burst`) */
const BOUNCED = 'e:crab:bounced';
/** Amount bounced per hit: % of max HP */
const BOUNCE_PCT = 0.05;
const WALL = 'bubblecrab_bubble_wall';

const bouncedThisTurn = (b: Battle, id: SideId): boolean => b.active(id).vars[BOUNCED] === b.s.turn;

// ═════════════════════════ `lanternfish`: Lure ═════════════════════════
// While the Lure is lit, when the opponent's attack hits `lanternfish` -> the opponent becomes "Exposed" (the engine's exposed: for this turn and the next, the next attack taken is always a crit), and the Lure goes out.

const LURE = 'e:lan:lure';

const lureLit = (b: Battle, id: SideId): boolean => getVar(b, id, LURE) > 0;
const exposedNow = (b: Battle, side: SideId): boolean => {
  const e = b.active(side).exposed;
  return e > 0 && e >= b.s.turn;
};

function lightLure(b: Battle, id: SideId): void {
  const c = b.active(id);
  if (c.fainted || c.vars[LURE]) return;
  c.vars[LURE] = 1;
  b.text(`${c.name} 點亮了「燈餌」。`);
}

/** Side becomes Exposed (for this turn and the next) */
function exposeFoe(b: Battle, side: SideId, text: string): void {
  const d = b.active(side);
  if (d.fainted) return;
  d.exposed = b.s.turn + 1;
  b.text(`${d.name} ${text}`);
}

/** Illuminate: power +bonus against an Exposed opponent */
const illuminate = (bonus: number): Pick<SkillHooks, 'power' | 'aiScore'> => ({
  power: (b, c, p) => (exposedNow(b, c.defender) ? p + bonus : p),
  aiScore: (b, id) => (exposedNow(b, b.foe(id)) ? 15 : 0),
});

// ═════════════════════════ Skill hooks ═════════════════════════

export const FX: Record<string, SkillHooks> = {
  // ── `thalassene` ──
  thalassene_tide_chime: {
    // `thalassene_tide_chime`: tide level +1 after hitting at high tide; power +20 at low tide
    power: (b, c, p) => (ebb(b, c.attacker) ? p + 20 : p),
    afterAttack: (b, c) => {
      if (flood(b, c.attacker)) addTide(b, c.attacker, 1);
    },
    aiScore: (b, id) => (flood(b, id) && tideOf(b, id) < TIDE_MAX ? 8 : 0),
  },
  thalassene_tide_veil: {
    // `thalassene_tide_veil`: 30% shield; at high tide, tide level +2
    effect: (b, id) => {
      if (flood(b, id)) addTide(b, id, 2);
    },
    aiScore: (b, id) => {
      const c = b.active(id);
      if (c.shield && c.shield.amount >= c.maxHp * 0.2) return -30;
      if (!flood(b, id)) return c.hp < c.maxHp * 0.5 ? 5 : -15;
      return tideOf(b, id) <= 1 ? 32 : 12;
    },
  },
  thalassene_backwash: {
    // `thalassene_backwash`: spends all the tide level, +25 power per stack (spent even if guarded)
    power: (b, c, p) => p + 25 * tideOf(b, c.attacker),
    afterUse: (b, id) => void spendTide(b, id),
    aiScore: (b, id) => {
      const n = tideOf(b, id);
      if (n === 0) return -35;
      if (baitGuard(b, id)) return -30;
      return ebb(b, id) ? 10 + n * 8 : n >= 2 && !ebbNext(b, id) ? -5 : -20;
    },
  },
  thalassene_abyss_cradle: {
    // `thalassene_abyss_cradle`: heals 38%; at high tide, tide level +1
    effect: (b, id) => {
      if (flood(b, id)) addTide(b, id, 1);
    },
    aiScore: (b, id) => (flood(b, id) ? 6 : 0),
  },
  thalassene_whale_billow: {
    // `thalassene_whale_billow`: tide level +1 after hitting at high tide (the main damage dealer of high-tide turns)
    afterAttack: (b, c) => {
      if (flood(b, c.attacker)) addTide(b, c.attacker, 1);
    },
    aiScore: (b, id) => (ebb(b, id) && !inSpring(b, id) && tideOf(b, id) >= 2 ? -10 : 0),
  },
  thalassene_low_tide: {
    // `thalassene_low_tide`: reveals the opponent's trap; at low tide it destroys it instead
    afterAttack: (b, c) => {
      if (ebb(b, c.attacker)) b.destroyTrap(c.defender);
    },
    aiScore: (b, id) => {
      const t = b.side(b.foe(id)).trap;
      if (!t) return -25;
      return ebb(b, id) ? 45 : t.revealed ? -10 : 20;
    },
  },
  thalassene_riptide: {
    // `thalassene_riptide`: tide level +1; after use the tide does not switch at the end of this turn (the tide is held even if guarded)
    afterUse: (b, id) => {
      if (!isThal(b, id)) return;
      addTide(b, id, 1);
      const c = b.active(id);
      c.vars[HOLD] = 1;
      b.text(`${c.name} 逆轉了浪勢：潮汐將停留在「${c.vars[EBB] ? '退潮' : '漲潮'}」！`);
    },
    aiScore: (b, id) => {
      if (inSpring(b, id)) return -10;
      const f = b.foe(id);
      const fsd = b.side(f);
      // At low tide: hold the low tide so the opponent cannot guard again next turn; at high tide: if the opponent has stored up enough for its ultimate, stretch the high tide by one more turn
      if (baitGuard(b, id)) return 40;
      if (ebb(b, id)) return tideOf(b, id) >= 1 ? 14 : 6;
      return fsd.aether >= 5 && !fsd.ultUsed && !!b.active(f).ultimate ? 18 : -8;
    },
  },
  thalassene_washout: {
    // `thalassene_washout`: dispel; at low tide it also clears turn-based effects
    afterAttack: (b, c) => {
      if (ebb(b, c.attacker)) b.clearLasting(c.defender, 'own');
    },
    aiScore: (b, id) => {
      const f = b.foe(id);
      const d = b.active(f);
      const ups = Object.values(d.stages).reduce((a, v) => a + Math.max(0, v), 0) + (d.shield ? 1 : 0);
      const turnFx = [...d.lasting, ...b.side(f).lasting].filter((l) => l.from === f).length;
      return ups * 14 + (ebb(b, id) ? turnFx * 18 : 0) - (ups === 0 && turnFx === 0 ? 10 : 0);
    },
  },
  thalassene_undertow: {
    // `thalassene_undertow`: reduces the damage of the attack taken by 40%, tide level +2
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => {
        addTide(b, owner, 2);
        return { reduce: 0.4 };
      },
    },
    aiScore: (b, id) => (isThal(b, id) ? 20 : 0),
  },
  thalassene_rip_current: {
    // `thalassene_rip_current`: when the opponent declares a switch, the switch fails and it is rooted for 2 turns
    trap: {
      on: 'foeLeave',
      fire: (b, owner) => {
        const f = b.foe(owner);
        b.text(`離岸流把 ${b.active(f).name} 捲回了戰場！`);
        b.applyStatus(f, 'root');
        return { negate: true };
      },
    },
    aiScore: (b, id) => (b.aliveBench(b.foe(id)).length > 0 ? 5 : -100),
  },
  thalassene_ark_song: {
    // `thalassene_ark_song`: spends all the tide level, heals the whole team (bench included) 10% plus 8% per stack
    manual: ['teamHeal'],
    effect: (b, id) => {
      const n = spendTide(b, id);
      const pct = 10 + 8 * n;
      const sd = b.side(id);
      for (const [i, m] of sd.team.entries()) {
        if (m.fainted) continue;
        if (i === sd.active) b.heal(id, pct);
        else m.hp = Math.min(m.maxHp, m.hp + Math.floor((m.maxHp * pct) / 100));
      }
    },
    aiScore: (b, id) => {
      const c = b.active(id);
      const missing = 1 - c.hp / c.maxHp;
      const n = tideOf(b, id);
      return missing * n * 30 - (n === 0 ? 20 : 0);
    },
  },
  thalassene_raging_tide: {
    // `thalassene_raging_tide`: spends all the tide level, +40 power per stack; priority +1 at low tide
    power: (b, c, p) => p + 40 * tideOf(b, c.attacker),
    priority: (b, id) => (ebb(b, id) ? 1 : 0),
    afterUse: (b, id) => void spendTide(b, id),
    aiScore: (b, id) => {
      const n = tideOf(b, id);
      if (n <= 1) return -40;
      if (baitGuard(b, id)) return -30;
      return ebb(b, id) ? 20 + n * 6 : ebbNext(b, id) ? -25 : -5;
    },
  },
  thalassene_moonpull: {
    // `thalassene_moonpull`: tide effects doubled for 3 turns, tide level +1
    effect: (b, id) => {
      b.addLasting(id, MOON, 3);
      addTide(b, id, 1);
    },
    lasting: { name: '月引' },
    aiScore: (b, id) => {
      const c = b.active(id);
      if (b.getLasting(id, MOON)) return -60;
      const hp = c.hp / c.maxHp;
      // Best used at high tide: this turn's damage reduction doubled, and next turn's low tide bursts with a full tide level
      return hp > 0.4 ? 30 + (flood(b, id) && ebbNext(b, id) ? 15 : 0) + (TIDE_MAX - tideOf(b, id)) * 4 : -20;
    },
  },
  u_thalassene: {
    // `u_thalassene`: spends all the tide level, +30 power per stack; in Spring Tide for 4 turns (it sets in even if guarded)
    power: (b, c, p) => p + 30 * tideOf(b, c.attacker),
    afterUse: (b, id) => {
      if (!isThal(b, id)) return;
      spendTide(b, id);
      b.addLasting(id, SPRING, 4);
    },
    lasting: { name: '大潮' },
    aiScore: (b, id) => {
      if (inSpring(b, id)) return -40;
      // Best moment: the opponent has just guarded (it cannot guard this turn)
      const f = b.foe(id);
      if (baitGuard(b, id)) return -30;
      const base = 20 + tideOf(b, id) * 10 + (b.getLasting(id, MOON) ? 15 : 0);
      if (!b.canGuard(f).ok) return base + 25;
      // The opponent can guard and this hit is big enough to be worth guarding: it will most likely be blocked (Spring Tide still sets in, but the damage is wasted)
      const big = b.estimate(id, SPRING) >= b.active(f).hp * 0.5;
      return base - (big ? 30 : 0) - (tideOf(b, id) < 2 ? 15 : 0);
    },
  },

  // ── `siren` ──
  siren_hum: {
    // `siren_hum`: against a sleeping opponent Dream Depth gets another +1 (+2 in total)
    ...dreamHit(1),
    aiScore: (b, id) => (asleep(b, b.foe(id)) && dreamOf(b, id) < DREAM_MAX ? 14 : 0),
  },
  siren_lullaby: {
    // `siren_lullaby`: sleep
    aiScore: sleepScore,
  },
  siren_song: {
    // `siren_song`: sleep plus RES -1
    aiScore: (b, id, base) => sleepScore(b, id, base) + 4,
  },
  siren_dream_eater: {
    // `siren_dream_eater`: spends all Dream Depth, +20 power per stack, drains 30% (spent only on a hit; this hit's Reverie stack is left for the next skill)
    keepSleep: () => true,
    power: (b, c, p) => p + 20 * dreamOf(b, c.attacker),
    onHit: (b, c, h) => {
      if (c.estimate) return;
      spendDream(b, c.attacker);
      if (!h.ko && h.dmg > 0 && asleep(b, c.defender)) addDream(b, c.attacker, 1);
    },
    aiScore: (b, id) => {
      const n = dreamOf(b, id);
      if (n === 0) return -25;
      // The opponent is still asleep and Dream Depth is not full: keep building with other skills; with only 1 stack, hold it for now
      if (asleep(b, b.foe(id)) && n < DREAM_MAX) return -10;
      return n === 1 ? -8 : n * 5;
    },
  },
  siren_abyss_whisper: {
    // `siren_abyss_whisper`: power +20 against a sleeping opponent
    ...dreamHit(),
    power: (b, c, p) => (asleep(b, c.defender) ? p + 20 : p),
  },
  siren_maelstrom: {
    // `siren_maelstrom`: roots for 2 turns so a sleeping opponent cannot switch away
    ...dreamHit(),
    aiScore: (b, id) => {
      const f = b.foe(id);
      const d = b.active(f);
      if (d.status.root) return -10;
      return (asleep(b, f) || dreamOf(b, id) >= 2) && b.aliveBench(f).length > 0 ? 16 : 0;
    },
  },
  siren_nightmare: {
    // `siren_nightmare`: spends all Dream Depth, the opponent loses 12% max HP per stack (does not wake it, guard cannot stop it)
    manual: ['trueDamage'],
    canUse: (b, id) => (dreamOf(b, id) > 0 ? null : '對手沒有「夢深」'),
    effect: (b, id) => {
      const n = spendDream(b, id);
      if (n > 0) b.trueDamage(b.foe(id), NIGHTMARE_PCT * n, 'nightmare');
    },
    aiScore: (b, id) => {
      const n = dreamOf(b, id);
      const d = b.active(b.foe(id));
      const frac = Math.floor((d.maxHp * NIGHTMARE_PCT * n) / 100) / Math.max(1, d.hp);
      // Percentage damage cannot be reduced or guarded: a sure KO takes priority over an estimated KO
      if (frac >= 1) return 175;
      // The opponent is still asleep and Dream Depth is not full: hit again to deepen the dream
      if (asleep(b, b.foe(id)) && n < DREAM_MAX) return frac * 60 - 15;
      return frac * 100 + (b.canGuard(b.foe(id)).ok ? 8 : 0);
    },
  },
  siren_lure: {
    // `siren_lure`: puts the opponent's spirit to sleep when it switches in
    trap: {
      on: 'foeEnter',
      fire: (b, owner) => {
        const f = b.foe(owner);
        b.text(`誘歌迴盪，${b.active(f).name} 的眼皮越來越重……`);
        b.applyStatus(f, 'sleep');
      },
    },
    aiScore: (b, id) => (b.aliveBench(b.foe(id)).length > 0 ? 5 : -100),
  },
  siren_dream_theft: {
    // `siren_dream_theft`: after hitting, if the opponent has Dream Depth and stat boosts: spends 1 stack and takes all its stat boosts
    ...dreamHit(),
    afterAttack: (b, c, r) => {
      if (r.hits === 0 || r.decoyBlocked || b.active(c.attacker).fainted) return;
      const d = b.active(c.defender);
      if (d.fainted || !Object.values(d.stages).some((v) => v > 0)) return;
      if (spendDream(b, c.attacker, 1) > 0) b.stealStages(c.attacker);
    },
    aiScore: (b, id) => {
      const f = b.foe(id);
      const ups = Object.values(b.active(f).stages).reduce((a, v) => a + Math.max(0, v), 0);
      return dreamOf(b, id) > 0 || asleep(b, f) ? ups * 14 : 0;
    },
  },
  siren_phantom_chorus: {
    // `siren_phantom_chorus`: reduces the damage of the attack taken by 30% and puts the attacker to sleep
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => ({ reduce: 0.3, after: () => void b.applyStatus(b.foe(owner), 'sleep') }),
    },
    aiScore: (b, id) => (sleepable(b, id) ? 15 : 0),
  },
  siren_dream_siphon: {
    // `siren_dream_siphon`: spends all Dream Depth (this hit's included), draining 1 aether from the opponent per stack
    ...dreamHit(),
    afterAttack: (b, c, r) => {
      if (r.hits === 0 || r.decoyBlocked || b.active(c.attacker).fainted) return;
      const n = spendDream(b, c.attacker);
      if (n > 0) b.drainAether(c.attacker, n, true);
    },
    aiScore: (b, id) => {
      const f = b.foe(id);
      const fsd = b.side(f);
      const n = Math.min(DREAM_MAX, dreamOf(b, id) + (asleep(b, f) ? 1 : 0));
      const got = Math.min(fsd.aether, n);
      if (got === 0) return -25;
      // When the opponent is about to be able to use its ultimate, steal it (the ultimate costs 5, see ULT_COST in battle.ts)
      const ultSoon = !!b.active(f).ultimate && !fsd.ultUsed && fsd.aether >= 4 && fsd.aether - got < 5;
      // Can steal only 1 point and cannot stop the opponent's ultimate: build Dream Depth first
      if (got < 2 && !ultSoon) return -12;
      return got * 14 + (ultSoon ? 20 : 0);
    },
  },
  u_siren: {
    // `u_siren`: puts the opponent to sleep after hitting and fills Dream Depth
    ...dreamHit(),
    afterAttack: (b, c, r) => {
      if (r.hits === 0 || r.decoyBlocked || r.ko || b.active(c.attacker).fainted) return;
      addDream(b, c.attacker, DREAM_MAX);
    },
    aiScore: (b, id) => {
      const f = b.foe(id);
      const n = dreamOf(b, id);
      // Safest when the opponent has just guarded or is asleep; fill Dream Depth, then follow with `siren_nightmare`
      const open = !b.canGuard(f).ok || asleep(b, f);
      return (sleepable(b, id) || asleep(b, f) ? 15 : 0) + (DREAM_MAX - n) * 5 + (open ? 20 : -10);
    },
  },

  // ── `oathsea_sage` ──
  oathsea_sage_crest: {
    // `oathsea_sage_crest`: spends all the Chant, +30 power per stack
    power: (b, c, p) => p + 30 * chantOf(b, c.attacker),
    afterUse: (b, id) => void spendChant(b, id),
    aiScore: (b, id) => codaScore(chantOf(b, id)),
  },
  oathsea_sage_verse: {
    // `oathsea_sage_verse`: Chant gets +1 extra (the engine's afterSkill adds another +1)
    afterUse: (b, id) => setChant(b, id, chantOf(b, id) + 1, chantOf(b, id) + 2),
    aiScore: (b, id) => (chantOf(b, id) < CHANT_MAX - 1 ? 10 : 0),
  },
  oathsea_sage_shell_ward: {
    // `oathsea_sage_shell_ward`: 25% shield, does not break the Chant (the engine zeroes the Chant and it is restored at the end of the turn)
    afterUse: (b, id) => {
      const c = b.active(id);
      const n = Math.max(0, c.arcaneChain);
      if (n > 0) c.vars[KEEP] = n;
    },
    aiScore: (b, id) => {
      const c = b.active(id);
      if (c.shield && c.shield.amount >= c.maxHp * 0.15) return -30;
      return chantOf(b, id) >= 2 && c.hp < c.maxHp * 0.7 ? 12 : 0;
    },
  },
  oathsea_sage_mist_coda: {
    // `oathsea_sage_mist_coda`: spends all the Chant, heals 10% per stack (heals even if guarded)
    afterUse: (b, id) => {
      const n = spendChant(b, id);
      if (n > 0) b.heal(id, 10 * n);
    },
    aiScore: (b, id) => {
      const c = b.active(id);
      const n = chantOf(b, id);
      return n === 0 ? -30 : (1 - c.hp / c.maxHp) * n * 25 - 10;
    },
  },
  oathsea_sage_resonance: {
    // `oathsea_sage_resonance`: +50 power at 3 stacks of Chant (not spent)
    power: (b, c, p) => (chantOf(b, c.attacker) >= CHANT_MAX ? p + 50 : p),
  },
  oathsea_sage_frost_coda: {
    // `oathsea_sage_frost_coda`: spends all the Chant; freezes the opponent when 3 stacks were spent (freezes only on a hit)
    manual: ['status.freeze'],
    afterAttack: (b, c, r) => {
      if (r.hits > 0 && !r.decoyBlocked && !r.ko && chantOf(b, c.attacker) >= CHANT_MAX) b.applyStatus(c.defender, 'freeze');
    },
    afterUse: (b, id) => void spendChant(b, id),
    aiScore: (b, id) => {
      const d = b.active(b.foe(id));
      const freezable = !d.elements.includes('water') && d.toughness === 0 && !d.status.freeze && !d.status.sleep && !d.status.fear;
      return chantOf(b, id) >= CHANT_MAX && freezable ? 45 : -25;
    },
  },
  oathsea_sage_tide_ward: {
    // `oathsea_sage_tide_ward`: reduces the damage of the attack taken by 30%, Chant +1
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => {
        setChant(b, owner, chantOf(b, owner) + 1);
        return { reduce: 0.3 };
      },
    },
    aiScore: () => 10,
  },
  oathsea_sage_oath_coda: {
    // `oathsea_sage_oath_coda`: spends all the Chant, +35 power per stack; ignores guard and shields when 3 stacks were spent
    manual: ['ignoreGuard'],
    power: (b, c, p) => p + 35 * chantOf(b, c.attacker),
    pierceGuard: (b, id) => chantOf(b, id) >= CHANT_MAX,
    afterUse: (b, id) => void spendChant(b, id),
    aiScore: (b, id) => {
      const n = chantOf(b, id);
      return codaScore(n) + (n >= CHANT_MAX && b.canGuard(b.foe(id)).ok ? 10 : 0) - (n <= 1 ? 10 : 0);
    },
  },
  u_oathsea_sage: {
    // `u_oathsea_sage`: +20 power per stack of Chant; the Chant is filled after hitting (the engine's afterSkill keeps it at 3)
    power: (b, c, p) => p + 20 * chantOf(b, c.attacker),
    afterAttack: (b, c, r) => {
      if (r.hits > 0 && !b.active(c.attacker).fainted) setChant(b, c.attacker, CHANT_MAX);
    },
    aiScore: (b, id) => (chantOf(b, id) >= 2 ? 10 : -10),
  },

  // ── `swordfish` ──
  swordfish_dart: { ...crestBuilder },
  swordfish_fin_slash: { ...crestBuilder },
  swordfish_riptide_lunge: { ...crestBuilder },
  swordfish_undercut: {
    ...crestBuilder,
    aiScore: (b, id) => {
      const me = b.active(id);
      const f = b.foe(id);
      const foeFaster = b.effStat(b.active(f), 'spd', f) >= b.effStat(me, 'spd', id);
      return (hasCrest(b, id) ? -8 : 0) + (foeFaster ? 12 : 0);
    },
  },
  wave_pierce: { ...crestPayoff(40) },
  swordfish_breaker: {
    // `swordfish_breaker`: Wave Pierce +40; always crits when the opponent guards this turn
    ...crestPayoff(40),
    critBonus: (b, c) => (hasCrest(b, c.attacker) && b.active(c.defender).guarding ? 1 : 0),
  },
  swordfish_thousand_crests: { ...crestPayoff(60) },
  u_swordfish: {
    // `u_swordfish`: Wave Pierce +60
    ...crestPayoff(60),
    aiScore: (b, id) => (hasCrest(b, id) ? 20 : -15),
  },
  swordfish_ride_wind: {
    // `swordfish_ride_wind`: only worth it when the opponent is faster
    aiScore: (b, id) => {
      const me = b.active(id);
      const f = b.foe(id);
      if (me.stages.spd >= 2) return -30;
      // The engine's base score for boosts is very high; when already faster than the opponent, it is better to attack this turn (and gain a Crest)
      return b.effStat(b.active(f), 'spd', f) >= b.effStat(me, 'spd', id) ? 25 : -35;
    },
  },
  swordfish_scale_guard: {
    // `swordfish_scale_guard`: reduces the damage of the attack taken by 30% and gains a Crest
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => {
        if (b.active(owner).species.id === 'swordfish') gainCrest(b, owner);
        return { reduce: 0.3 };
      },
    },
    aiScore: (b, id) => (hasCrest(b, id) ? 0 : 12),
  },

  // ── `springlotus` ──
  springlotus_dew: {
    // `springlotus_dew`: power +30 at Full Spring
    power: (b, c, p) => (fullFor(b, c.attacker, c.sk, c.estimate) ? p + 30 : p),
  },
  aether_infusion: {
    // `aether_infusion`: aether +3. Costs a whole turn without attacking, so use it only when aether runs dry
    aiScore: (b, id) => (b.side(id).aether <= 2 ? 10 : -40),
  },
  springlotus_lotus_dew: {
    // `springlotus_lotus_dew`: heals 25%; at Full Spring another +15% (40% in total)
    effect: (b, id, sk) => {
      if (fullFor(b, id, sk)) b.heal(id, 15);
    },
    aiScore: (b, id) => (fullNow(b, id) ? 10 : 0),
  },
  springlotus_vine_siphon: {
    // `springlotus_vine_siphon`: drains 50% at Full Spring
    afterAttack: (b, c, r) => {
      if (r.dealt > 0 && !r.decoyBlocked && fullFor(b, c.attacker, c.sk)) b.healAmount(c.attacker, Math.floor(r.dealt * 0.5));
    },
    aiScore: (b, id) => {
      const c = b.active(id);
      return fullNow(b, id) ? (1 - c.hp / c.maxHp) * 30 : 0;
    },
  },
  springlotus_gift: {
    // `springlotus_gift`: with no bench it is just 1 cost for 2 aether
    aiScore: (b, id) => (b.aliveBench(id).length === 0 ? -30 : 0),
  },
  springlotus_surge: {
    // `springlotus_surge`: pours out the aether beyond 5, +30 power per point (poured out even if guarded)
    power: (b, c, p) => {
      const left = b.side(c.attacker).aether - (c.estimate ? b.costFor(c.attacker, c.sk) : 0);
      return p + 30 * Math.max(0, left - SURGE_KEEP);
    },
    afterUse: (b, id) => {
      const n = b.side(id).aether - SURGE_KEEP;
      if (n <= 0) return;
      b.text(`${b.active(id).name} 倒出了 ${n} 點靈能！`);
      b.gainAether(id, -n);
    },
    aiScore: (b, id) => {
      const extra = b.side(id).aether - 2 - SURGE_KEEP;
      return extra <= 0 ? -25 : extra * 4;
    },
  },
  springlotus_rain: {
    // `springlotus_rain`: heals the whole team 22%; at Full Spring it cleanses the whole team
    effect: (b, id, sk) => {
      if (fullFor(b, id, sk)) b.cleanse(id, true);
    },
    aiScore: (b, id) => {
      const sd = b.side(id);
      const hurt = sd.team.filter((m) => !m.fainted && m.hp < m.maxHp * 0.7).length;
      const ailing = sd.team.some((m) => !m.fainted && Object.keys(m.status).length > 0);
      return hurt * 8 + (ailing && fullNow(b, id) ? 20 : 0) - (hurt === 0 ? 30 : 0);
    },
  },
  springlotus_bloom: {
    // `springlotus_bloom`: power +40 at Full Spring
    power: (b, c, p) => (fullFor(b, c.attacker, c.sk, c.estimate) ? p + 40 : p),
  },
  springlotus_star_font: {
    // `springlotus_star_font`: on our side for 3 turns, aether +1 at the end of each turn (persists across switches)
    effect: (b, id) => void b.addLasting(id, STAR_FONT, 3, { side: true }),
    lasting: {
      name: '星泉',
      onTurnEnd: (b, owner) => {
        b.text('星泉湧出靈能。');
        b.gainAether(owner, 1);
      },
    },
    aiScore: (b, id) => (b.getLasting(id, STAR_FONT) ? -60 : b.side(id).aether <= 7 ? 20 : 0),
  },
  u_springlotus: {
    // `u_springlotus`: aether +3 and heals the whole team 15% (tags); no hurry to use it when aether is nearly full
    aiScore: (b, id) => (b.side(id).aether >= 9 ? -10 : 5),
  },

  // ── `icecrown` ──
  icecrown_snowball: iceHit(),
  frost_breath: iceHit(),
  icecrown_hailstorm: iceHit(2),
  icecrown_blizzard: iceHit(),
  shatter_lance: { ...shatter(50) },
  icecrown_crown_shatter: { ...shatter(70) },
  icecrown_permafrost: {
    // `icecrown_permafrost`: Frost +2 (a status skill, guard cannot stop it)
    effect: (b, id) => addFrost(b, id, 2),
    aiScore: (b, id) => {
      const f = b.foe(id);
      if (b.active(f).elements.includes('water') || frostOf(b, id) >= FROST_MAX) return -40;
      return frostOf(b, id) >= 1 && canFreeze(b, f) ? 25 : 5;
    },
  },
  icecrown_ice_trap: {
    // `icecrown_ice_trap`: reduces the damage of the attack taken by 30%, the attacker gets Frost +2
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => ({ reduce: 0.3, after: () => addFrost(b, owner, 2) }),
    },
    aiScore: (b, id) => (b.active(b.foe(id)).elements.includes('water') ? -20 : 10),
  },
  u_icecrown: {
    // `u_icecrown`: Frost +3 after hitting
    afterAttack: (b, c, r) => {
      if (r.hits > 0 && !r.decoyBlocked && !r.ko) addFrost(b, c.attacker, FROST_MAX);
    },
    aiScore: (b, id) => (canFreeze(b, b.foe(id)) ? 15 : -10),
  },

  // ── `bubblecrab` ──
  bubblecrab_harden: {
    aiScore: (b, id) => (b.active(id).stages.def >= 3 ? -40 : 0),
  },
  bubblecrab_bubble_wall: {
    // `bubblecrab_bubble_wall`: for 3 turns magic attacks bounce off too (the 15% heal is handled by tags)
    effect: (b, id) => void b.addLasting(id, WALL, 3),
    lasting: { name: '泡沫牆' },
    aiScore: (b, id) => (b.getLasting(id, WALL) ? -60 : b.active(id).hp < b.active(id).maxHp * 0.7 ? 10 : -5),
  },
  bubblecrab_bubble_burst: {
    // `bubblecrab_bubble_burst`: power +50 if an attack was bounced this turn
    power: (b, c, p) => (bouncedThisTurn(b, c.attacker) ? p + 50 : p),
  },

  // ── `lanternfish` ──
  lanternfish_glim: { ...illuminate(20) },
  lanternfish_beam: { ...illuminate(30) },
  // `lanternfish_abyss_ray`: Illuminate +40 (the signature finisher)
  lanternfish_abyss_ray: { ...illuminate(40) },
  lure_flash: {
    // `lure_flash`: priority +1, lights the Lure (SPD -1 is handled by tags)
    effect: (b, id) => lightLure(b, id),
    // Light the lamp only when it is off and the opponent is not Exposed yet (0 cost, priority; trades for the next hit's crit and Illuminate)
    aiScore: (b, id) => {
      const c = b.active(id);
      if (lureLit(b, id) || exposedNow(b, b.foe(id))) return -40;
      return c.hp / c.maxHp >= 0.5 ? 40 : 0;
    },
  },
  lanternfish_deep_glow: {
    // `lanternfish_deep_glow`: lights the Lure, heals 20%
    effect: (b, id) => lightLure(b, id),
    aiScore: (b, id) => (lureLit(b, id) || exposedNow(b, b.foe(id)) ? -15 : 10),
  },
  lanternfish_lantern_snare: {
    // `lanternfish_lantern_snare`: reduces the damage of the attack taken by 30% and the attacker becomes Exposed
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => ({ reduce: 0.3, after: () => exposeFoe(b, b.foe(owner), '被燈籠照出了破綻！') }),
    },
    aiScore: () => 10,
  },
  u_lanternfish: {
    // `u_lanternfish`: lights the Lure after hitting (it does not get Illuminate: the big move is the start of the next round of bait)
    afterAttack: (b, c, r) => {
      if (r.hits > 0 && !b.active(c.attacker).fainted) lightLure(b, c.attacker);
    },
  },
};

// ═════════════════════════ Kit hooks ═════════════════════════

export const KIT: Record<string, KitHooks> = {
  thalassene: {
    onEnter: (b, id) => {
      const c = b.active(id);
      c.vars[EBB] = 0;
      c.vars[TIDE] = 0;
      c.vars[HOLD] = 0;
    },
    // Low tide: attack damage dealt +20% (+40% with `thalassene_moonpull`)
    attackBonus: (b, a) => (ebb(b, a.attacker) ? TIDE_EFFECT * amp(b, a.attacker) : 0),
    // High tide: attack damage taken -20% (-40% with `thalassene_moonpull`)
    incoming: (b, a, dmg) => (dmg > 0 && flood(b, a.defender) ? Math.max(1, Math.round(dmg * (1 - TIDE_EFFECT * amp(b, a.defender)))) : dmg),
    // High tide: tide level +1 for each hit taken
    onHitTaken: (b, a) => {
      if (flood(b, a.defender)) addTide(b, a.defender, 1);
    },
    // End of turn: the tide switches (no switch when `thalassene_riptide` holds the tide)
    onEndTurn: (b, id) => {
      const c = b.active(id);
      if (c.vars[HOLD]) {
        c.vars[HOLD] = 0;
        b.text(`潮汐停留在「${c.vars[EBB] ? '退潮' : '漲潮'}」。`);
        return;
      }
      c.vars[EBB] = c.vars[EBB] ? 0 : 1;
      b.text(`潮汐轉為「${c.vars[EBB] ? '退潮' : '漲潮'}」。`);
    },
    marks: (b, id) => {
      const c = b.active(id);
      const phase = inSpring(b, id) ? '大潮' : c.vars[EBB] ? '退潮' : '漲潮';
      const out: MarkView[] = [{ id: 'kit:tide-phase', note: `${phase}${c.vars[HOLD] && !inSpring(b, id) ? '（停潮）' : ''}` }];
      const n = c.vars[TIDE] ?? 0;
      if (n > 0) out.push({ id: 'kit:tide', n, note: '潮位' });
      return out;
    },
  },
  siren: {
    // On entering, reset the "woke up" detection according to whether the opponent is currently asleep (avoids stale records from when the siren was not on the field)
    onEnter: (b, id) => {
      const d = b.active(b.foe(id));
      if (!d.fainted) d.vars[SLEPT] = d.status.sleep ? 1 : 0;
    },
    // At the end of the turn when the opponent wakes from sleep:
    // Reverie's cost: the woken opponent's "toughness" lasts 1 turn longer (the engine gives 2; here it is topped up to 3 before the decrement);
    // Lost Melody (the rewritten trait): Dream Depth +1
    onEndTurn: (b, id) => {
      const d = b.active(b.foe(id));
      if (d.fainted) return;
      if (d.status.sleep) {
        d.vars[SLEPT] = 1;
        return;
      }
      if (!d.vars[SLEPT]) return;
      d.vars[SLEPT] = 0;
      d.toughness = Math.max(d.toughness, WAKE_TOUGHNESS);
      b.text(`${d.name} 從夢中驚醒，格外清醒！`);
      b.traitEvent(id, '失落的旋律');
      addDream(b, id, 1);
    },
    // AI: while the opponent is asleep it certainly cannot act this turn, so no need to guard
    aiGuard: (b, id) => (asleep(b, b.foe(id)) ? -200 : 0),
    // Reverie: Dream Depth is stored on the opponent and displayed on the siren's side (marked as the opponent's)
    marks: (b, id) => {
      const n = dreamOf(b, id);
      return n > 0 ? [{ id: 'kit:dream', n, note: '對手的夢深' }] : [];
    },
  },
  oathsea_sage: {
    // Tidal Chant (the rewritten trait): each stack of Chant gives magic attacks +8% damage
    attackBonus: (b, a) => (a.cat === 'magic' ? CHANT_BONUS * chantOf(b, a.attacker) : 0),
    // `oathsea_sage_shell_ward`: at the end of the turn, restores the Chant interrupted by a status skill
    onEndTurn: (b, id) => {
      const c = b.active(id);
      const keep = c.vars[KEEP];
      if (!keep) return;
      c.vars[KEEP] = 0;
      setChant(b, id, Math.max(0, c.arcaneChain) + keep);
    },
    marks: (b, id) => {
      const n = chantOf(b, id);
      return n > 0 ? [{ id: 'kit:chant', n, note: '詠唱' }] : [];
    },
  },
  swordfish: {
    marks: (b, id) => (hasCrest(b, id) ? [{ id: 'kit:crest', note: '浪尖' }] : []),
  },
  springlotus: {
    // Full Spring: attack damage taken -15%
    incoming: (b, a, dmg) => (fullNow(b, a.defender) ? Math.floor(dmg * 0.85) : dmg),
    marks: (b, id) => (fullNow(b, id) ? [{ id: 'kit:fullspring', note: '滿泉' }] : []),
  },
  icecrown: {
    // Do not guard while the opponent is frozen: it cannot move this turn, which is exactly the moment for `shatter_lance`
    aiGuard: (b, id) => (frozen(b, b.foe(id)) ? -200 : 0),
    marks: (b, id) => {
      const n = frostOf(b, id);
      return n > 0 ? [{ id: 'kit:frost', n, note: '對手的霜' }] : [];
    },
  },
  bubblecrab: {
    // Bounce Shell: each hit of a physical attack (magic too while `bubblecrab_bubble_wall` is up) is reduced by 5% of max HP, and the reduced amount is recorded
    incoming: (b, a, dmg) => {
      if (dmg <= 0 || (a.cat !== 'physical' && !b.getLasting(a.defender, WALL))) return dmg;
      const c = b.active(a.defender);
      const cut = Math.min(dmg - 1, Math.floor(c.maxHp * BOUNCE_PCT));
      if (cut <= 0) return dmg;
      c.vars[BOUNCE] = (c.vars[BOUNCE] ?? 0) + cut;
      c.vars[BOUNCED] = b.s.turn;
      return dmg - cut;
    },
    // Reflected once after the attack resolves
    onHitTaken: (b, a) => {
      const c = b.active(a.defender);
      const n = c.vars[BOUNCE] ?? 0;
      if (!n) return;
      c.vars[BOUNCE] = 0;
      if (c.fainted) return;
      b.text(`${c.name} 的硬殼彈開了攻擊！`);
      b.damage(a.attacker, n, 'bounce');
    },
    onEndTurn: (b, id) => void (b.active(id).vars[BOUNCE] = 0),
  },
  lanternfish: {
    // Lure: after the opponent's attack hits `lanternfish`, the opponent becomes Exposed and the Lure goes out
    onHitTaken: (b, a) => {
      const c = b.active(a.defender);
      if (!c.vars[LURE] || b.active(a.attacker).fainted) return;
      c.vars[LURE] = 0;
      exposeFoe(b, a.attacker, '咬上了燈餌，露出了破綻！');
      // Lure Glow (the rewritten trait): heals 10% when the bait is taken
      if (!c.fainted) {
        b.traitEvent(a.defender, '誘光');
        b.heal(a.defender, 10);
      }
    },
    marks: (b, id) => (lureLit(b, id) ? [{ id: 'kit:lure', note: '燈餌' }] : []),
  },
};
