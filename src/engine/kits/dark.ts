// Skill hooks and kit hooks for the dark group (data/kits/dark.json). See docs/10-kit-authoring.md for how to write them.
// Only `import type { Battle }` is allowed (importing battle.ts at runtime would create a circular dependency).

import type { Battle } from '../battle.ts';
import { getVar, isAttack, type AttackResult, type HitCtx, type KitHooks, type SkillHooks } from '../skillfx.ts';
import type { SideId } from '../types.ts';
import { getSkill } from '../../data.ts';

// ═════════════════════════ `noxfang`: Hunt Mark and Hunt Kill ═════════════════════════
// Hunt Marks are recorded on the "prey" (the opponent's active spirit), under keys with the e: prefix, cleared automatically when the prey leaves; also cleared when `noxfang` leaves or faints.
// Execute line = 6% per stack, +10% more under Eternal Night. After `noxfang`'s attack hits, if the opponent's HP <= the execute line it faints at once (Hunt Kill).

const NOX_MARK = 'e:nox:mark';
const NOX_MAX = 5;
const NOX_LINE = 6;
const NOX_NIGHT = 10;

/** Stacks of Hunt Mark on the opponent */
function noxMarks(b: Battle, id: SideId): number {
  const d = b.active(b.foe(id));
  return d.fainted ? 0 : (d.vars[NOX_MARK] ?? 0);
}

/** The current execute line (%): 6% per stack of Hunt Mark, +10% under Eternal Night */
function noxLine(b: Battle, id: SideId, extraMarks = 0): number {
  const marks = Math.min(NOX_MAX, noxMarks(b, id) + extraMarks);
  return marks * NOX_LINE + (b.s.field?.element === 'dark' ? NOX_NIGHT : 0);
}

/** The opponent gains n stacks of Hunt Mark */
function addMarks(b: Battle, id: SideId, n: number): void {
  const d = b.active(b.foe(id));
  if (d.fainted || n <= 0) return;
  const before = d.vars[NOX_MARK] ?? 0;
  const v = Math.min(NOX_MAX, before + n);
  if (v === before) return;
  d.vars[NOX_MARK] = v;
  b.text(`${d.name} 身上的「獵痕」：${v} 層（斬殺線 ${noxLine(b, id)}%）`);
}

function clearMarks(b: Battle, id: SideId): void {
  delete b.active(b.foe(id)).vars[NOX_MARK];
}

interface HuntOpts {
  /** Execute line bonus (%) */
  bonus?: number;
  /** Execute line multiplier */
  mult?: number;
}

function huntLine(b: Battle, id: SideId, o: HuntOpts, extraMarks = 0): number {
  return noxLine(b, id, extraMarks) * (o.mult ?? 1) + (o.bonus ?? 0);
}

/** Hunt Kill check: after a hit, if the opponent's HP <= the execute line it is knocked out at once. Returns whether it was a Hunt Kill */
function hunt(b: Battle, c: HitCtx, o: HuntOpts = {}): boolean {
  if (c.estimate) return false;
  const d = b.active(c.defender);
  if (d.fainted || d.hp <= 0 || b.active(c.attacker).fainted) return false;
  const line = huntLine(b, c.attacker, o);
  if (line <= 0 || d.hp * 100 > d.maxHp * line) return false;
  b.traitEvent(c.attacker, '獵殺');
  b.text(`獵殺！${d.name} 的生命低於斬殺線 ${line}%`);
  b.damage(c.defender, d.hp, 'execute');
  return true;
}

/** AI: a big bonus when this hit would drop the opponent below the execute line (estimated) */
function huntAi(b: Battle, id: SideId, skillId: string, o: HuntOpts & { add?: number } = {}): number {
  const d = b.active(b.foe(id));
  if (d.fainted) return 0;
  const est = b.estimate(id, skillId);
  if (est >= d.hp) return 0;
  return (d.hp - est) * 100 <= d.maxHp * huntLine(b, id, o, o.add ?? 0) ? 80 : 0;
}

/** `noxfang`'s attack: leaves n stacks of Hunt Mark after hitting, then checks for a Hunt Kill */
function noxStrike(skillId: string, n: number, o: HuntOpts = {}): SkillHooks {
  return {
    afterAttack: (b, c, r) => {
      if (r.decoyBlocked) return;
      addMarks(b, c.attacker, n);
      hunt(b, c, o);
    },
    aiScore: (b, id) => huntAi(b, id, skillId, { ...o, add: n }),
  };
}

/** Status skill that stacks Hunt Marks: not used once they are full */
function markSetupAi(b: Battle, id: SideId, n: number): number {
  const m = noxMarks(b, id);
  const d = b.active(b.foe(id));
  if (m + n > NOX_MAX + 1) return -40;
  return d.hp / d.maxHp > 0.5 ? 15 : -10;
}

// ═════════════════════════ `voidchild`: Void Belly and Devour ═════════════════════════
// Void Belly is recorded on `voidchild` (no e: prefix, kept on leaving). Each stack gives `voidchild` +5% damage, and is spent by exclusive skills.
// Devour: dispels the opponent's stat boosts and shields; when there are none, it erodes 4% of max HP instead (max HP and HP drop together).

const VC = 'voidchild';
const BELLY = 'vc:belly';
const BELLY_MAX = 5;
/** Max HP can be eroded down to this fraction of the original at most */
const ERODE_FLOOR = 0.5;

function belly(b: Battle, id: SideId): number {
  return getVar(b, id, BELLY);
}

/** Void Belly +n (only `voidchild` itself accumulates it) */
function feed(b: Battle, id: SideId, n: number): void {
  const c = b.active(id);
  if (c.fainted || c.species.id !== VC || n <= 0) return;
  const before = c.vars[BELLY] ?? 0;
  const v = Math.min(BELLY_MAX, before + n);
  if (v === before) return;
  c.vars[BELLY] = v;
  b.text(`${c.name} 的「虛腹」：${v} 層`);
}

/** Spends all the Void Belly and returns the number of stacks */
function empty(b: Battle, id: SideId): number {
  const c = b.active(id);
  const n = c.vars[BELLY] ?? 0;
  if (n > 0) {
    c.vars[BELLY] = 0;
    b.text(`${c.name} 釋放了 ${n} 層「虛腹」！`);
  }
  return n;
}

/** Erodes pct% of the opponent's max HP: max HP and HP drop together (at most half of max HP can be eroded) */
function erode(b: Battle, id: SideId, pct: number): void {
  const f = b.foe(id);
  const d = b.active(f);
  if (d.fainted) return;
  const amt = Math.max(1, Math.floor((d.stats.hp * pct) / 100));
  const cut = Math.max(0, Math.min(amt, d.maxHp - Math.ceil(d.stats.hp * ERODE_FLOOR)));
  if (cut > 0) {
    d.maxHp -= cut;
    d.hpAtTurnStart = Math.min(d.hpAtTurnStart, d.maxHp);
  }
  b.text(`虛無蝕去了 ${d.name} ${pct}% 的最大生命！`);
  b.damage(f, amt, 'erode');
}

/** Devour: dispels the opponent's stat boosts and shields; when there are none, erodes 4% of max HP instead. Void Belly +1 */
function devour(b: Battle, id: SideId): void {
  const f = b.foe(id);
  const d = b.active(f);
  if (d.fainted || b.active(id).fainted) return;
  if (d.shield || Object.values(d.stages).some((v) => v > 0)) {
    b.text(`${b.active(id).name} 吞噬了 ${d.name} 的強化！`);
    b.dispel(f);
  } else {
    erode(b, id, 4);
  }
  feed(b, id, 1);
}

/** `voidchild`'s attack: Void Belly +2 on a KO, otherwise runs onLand */
function vcStrike(onLand?: (b: Battle, c: HitCtx, r: AttackResult) => void): SkillHooks['afterAttack'] {
  return (b, c, r) => {
    if (r.ko) feed(b, c.attacker, 2);
    else if (!r.decoyBlocked) onLand?.(b, c, r);
  };
}

/** Number of turn-based effects the opponent (spirit and side) holds that it created itself */
function foeOwnLasting(b: Battle, id: SideId): number {
  const f = b.foe(id);
  const d = b.active(f);
  const sd = b.side(f);
  const own = [...d.lasting, ...sd.lasting].filter((l) => l.from === f).length;
  return own + (sd.screens.physTurns > 0 || sd.screens.magTurns > 0 ? 1 : 0) + (sd.tailwind > 0 ? 1 : 0) + (d.regen > 0 ? 1 : 0);
}

/** Whether the opponent will use skills that raise its own stats (for the AI) */
function foeBuffs(b: Battle, id: SideId): boolean {
  return b.active(b.foe(id)).skills.some((s) => Object.entries(getSkill(s).tags).some(([k, v]) => k.startsWith('self.') && v > 0));
}

/** Whether the opponent has attack skills (for the AI) */
/** The opponent AI will probably guard against this hit (same guard threshold as ai.ts: it can guard, and the estimated damage >= 60% of the opponent's HP) */
function guardBait(b: Battle, id: SideId, skillId: string): boolean {
  const f = b.foe(id);
  return b.canGuard(f).ok && b.estimate(id, skillId) >= b.active(f).hp * 0.6;
}

function foeAttacks(b: Battle, id: SideId): boolean {
  const d = b.active(b.foe(id));
  return d.skills.some((s) => isAttack(getSkill(s))) || (!!d.ultimate && !b.side(b.foe(id)).ultUsed);
}

// ═════════════════════════ `soul_lantern`: Netherlamp and Soulfire ═════════════════════════
// While `soul_lantern` is active, our trap that is set is a lit "Netherlamp". At the end of the turn it is revealed and burns the opponent with "Soulfire"
// (5% of max HP, 10% when cursed; doubled during `u_soul_lantern`). The lamp goes out when the trap fires or is destroyed.
// `soul_lantern_hang_lamp` hangs the lit lamp on the opponent (a lasting effect on the opponent, 3 turns, gone when the opponent leaves): it still burns, but cannot be put out by a trigger.
// Everlit (trait): while the lamp is lit, the opponent's curse does not lose turns (+1 before the end-of-turn status countdown cancels it out).

const SL = 'soul_lantern';
const SOULFIRE = 5;

const HUNG = 'soul_lantern_hang_lamp';

/** A Netherlamp is hung on the opponent */
function lampHung(b: Battle, id: SideId): boolean {
  return !!b.getLasting(b.foe(id), HUNG);
}

/** The lamp is lit: `soul_lantern` is active, and we have a trap set or a Netherlamp is hung on the opponent */
function lampLit(b: Battle, id: SideId): boolean {
  const me = b.active(id);
  return !me.fainted && me.species.id === SL && (!!b.side(id).trap || lampHung(b, id));
}

/** Soulfire damage (% of max HP) */
function soulfirePct(b: Battle, id: SideId): number {
  const pct = b.active(b.foe(id)).status.curse ? SOULFIRE * 2 : SOULFIRE;
  return b.getLasting(id, 'u_soul_lantern') ? pct * 2 : pct;
}

/** Soulfire burns the opponent once */
function soulfire(b: Battle, id: SideId): void {
  const f = b.foe(id);
  const d = b.active(f);
  if (d.fainted) return;
  const pct = soulfirePct(b, id);
  b.text(`冥燈的「魂焰」燒灼了 ${d.name} 的魂魄！`);
  b.trueDamage(f, pct, 'soulfire');
}

// ═════════════════════════ `weaverspider`: Webstrands and Reweave ═════════════════════════
// Webstrands are recorded on `weaverspider` (e: prefix, gone on leaving, at most 3). After `weaverspider`'s trap fires,
// if there are still webstrands, it spends 1 and sets the same trap again (nothing is spent during `weaverspider_thousand_threads`). Reel-in skills spend the webstrands all at once for power.

const WS = 'weaverspider';
const WEB = 'e:ws:web';
const WEB_MAX = 3;

function strands(b: Battle, id: SideId): number {
  const me = b.active(id);
  return me.species.id === WS ? (me.vars[WEB] ?? 0) : 0;
}

function addStrands(b: Battle, id: SideId, n: number): void {
  const me = b.active(id);
  if (me.fainted || me.species.id !== WS || n <= 0) return;
  const before = me.vars[WEB] ?? 0;
  const v = Math.min(WEB_MAX, before + n);
  if (v === before) return;
  me.vars[WEB] = v;
  b.text(`蛛網的「網絲」：${v} 條`);
}

/** Spends all the webstrands and returns the count */
function takeStrands(b: Battle, id: SideId): number {
  const n = strands(b, id);
  if (n > 0) b.active(id).vars[WEB] = 0;
  return n;
}

/** After `weaverspider`'s trap fires: with webstrands (or during `weaverspider_thousand_threads`), sets the same trap again */
function reweave(b: Battle, owner: SideId, skillId: string): void {
  const me = b.active(owner);
  if (me.fainted || me.species.id !== WS || b.side(owner).trap || b.s.winner !== null) return;
  const free = !!b.getLasting(owner, 'weaverspider_thousand_threads');
  if (!free) {
    const n = me.vars[WEB] ?? 0;
    if (n < 1) return;
    me.vars[WEB] = n - 1;
  }
  b.placeTrap(owner, skillId);
  b.text(`蛛網重新織好，「${getSkill(skillId).name}」再次蓋上了${free ? '' : `（網絲剩 ${me.vars[WEB]} 條）`}。`);
}

function foeHasStatusSkills(b: Battle, id: SideId): boolean {
  return b.active(b.foe(id)).skills.some((s) => getSkill(s).category === 'status');
}

// ═════════════════════════ `eclipse_batlord`: Night Kiss ═════════════════════════
// Night Kiss is a lasting effect on the opponent (key = the Night Kiss skill id, from = the bat lord), cleared automatically when the opponent leaves, and removed by the kit hook when the bat lord leaves or faints.
// When an opponent under Night Kiss hits the bat lord with an attack (the lasting effect's onDealt), the opponent loses HP equal to 30% of that damage, and the bat lord heals the same amount.
// Doubled for 3 turns during `u_eclipse_batlord`; on the turn of `eclipse_batlord_hang` it becomes 100%.
// Bloodthirst Instinct (the rewritten trait): when it knocks out an opponent under Night Kiss, the bat lord heals 20% of max HP (both the bat lord's attacks and Night Kiss's drain count).

const BAT = 'eclipse_batlord';
const KISS = 'eclipse_batlord_night_kiss';
const KISS_PCT = 0.3;
const FEAST_HEAL = 20;
const HANG = 'eclipse_batlord_hang';
const FEAST = 'u_eclipse_batlord';

/** Whether id's opponent is under Night Kiss */
function kissed(b: Battle, id: SideId): boolean {
  const f = b.foe(id);
  return !b.active(f).fainted && !!b.getLasting(f, KISS);
}

/** Puts id's opponent under Night Kiss for 3 turns (refreshed when already under it) */
function kiss(b: Battle, id: SideId): void {
  const f = b.foe(id);
  if (b.active(f).fainted || b.active(id).fainted) return;
  b.addLasting(f, KISS, 3, { from: id });
}

/** The bat lord's current drain ratio */
function feedRate(b: Battle, bat: SideId): number {
  if (b.getLasting(bat, HANG)) return 1;
  return b.getLasting(bat, FEAST) ? KISS_PCT * 2 : KISS_PCT;
}

/** Bloodthirst Instinct: heals 20% when it knocks out an opponent under Night Kiss (called before the opponent faints: Night Kiss is still on the opponent) */
function feast(b: Battle, bat: SideId): void {
  const c = b.active(bat);
  if (c.fainted || c.hp <= 0) return;
  b.traitEvent(bat, '吸血本能');
  b.heal(bat, FEAST_HEAL);
}

/** How much damage the opponent's attacks are estimated to deal to the bat lord (the AI judges when to use `eclipse_batlord_hang`) */
function foeBestHit(b: Battle, id: SideId): number {
  const f = b.foe(id);
  const foe = b.active(f);
  let best = 0;
  for (const s of foe.skills) if (isAttack(getSkill(s)) && b.canUse(f, s).ok) best = Math.max(best, b.estimate(f, s));
  return best;
}

// ═════════════════════════ `tombhound`: Burning Heads ═════════════════════════
// When the opponent is "burned" at the end of the turn (it will take burn damage at the end of this turn), `tombhound` lights 1 head (at most 3, goes out on leaving: the key has the e: prefix).
// The power of "Flame Maw" skills rises with the Burning Heads and they are spent on use (afterUse: even if guarded or missed).

const TH = 'tombhound';
const HEADS = 'e:th:heads';
const HEADS_MAX = 3;

function heads(b: Battle, id: SideId): number {
  return getVar(b, id, HEADS);
}

function lightHeads(b: Battle, id: SideId, n: number): void {
  const c = b.active(id);
  if (c.fainted || n <= 0) return;
  const before = heads(b, id);
  const v = Math.min(HEADS_MAX, before + n);
  if (v === before) return;
  c.vars[HEADS] = v;
  b.text(`${c.name} 點燃了一顆頭！（燃首 ${v}）`);
}

/** Flame Maw: +per power per Burning Head, and the heads go out after use */
function maw(per: number): SkillHooks {
  return {
    power: (b, c, p) => p + per * heads(b, c.attacker),
    afterUse: (b, id) => {
      const n = heads(b, id);
      if (!n) return;
      b.active(id).vars[HEADS] = 0;
      b.text(`${n} 顆燃首一口噬下，頭上的火熄了。`);
    },
    // Do not bite while fewer than 2 heads are lit (unless this bite alone can KO)
    aiScore: (b, id) => {
      const n = heads(b, id);
      return n >= 3 ? 20 : n === 2 ? 5 : -25;
    },
  };
}

/** When the opponent is burning, extends the burn by 1 turn */
function stokeBurn(b: Battle, id: SideId): boolean {
  const d = b.active(b.foe(id));
  if (d.fainted || !d.status.burn) return false;
  d.status.burn.turns += 1;
  b.text(`${d.name} 身上的冥火燒得更久了！`);
  return true;
}

// ═════════════════════════ `abyssjelly`: Spirit Threads ═════════════════════════
// An opponent that is "paralyzed" is bound by the Spirit Threads: at the end of every turn (kit hook onEndTurn), if the opponent still has aether, 1 point is drained to our side.
// The trait keeps the old "Paralytic Tentacles" (traits.ts: 30% to paralyze the attacker when hit by a physical attack).

/** Whether id's opponent is paralyzed */
function foeParalyzed(b: Battle, id: SideId): boolean {
  const d = b.active(b.foe(id));
  return !d.fainted && !!d.status.paralyze;
}

/** Drains 1 point of the opponent's aether to our side (does nothing when the opponent has no aether) */
function siphon(b: Battle, id: SideId, text: string): void {
  if (b.side(b.foe(id)).aether <= 0) return;
  b.text(text);
  b.drainAether(id, 1, true);
}

// ═════════════════════════ `maskfox`: Mask ═════════════════════════
// The Mask is a lasting effect on `maskfox` (key = the `maskfox_new_face` skill id, 3 turns): after the hit that it reduced by 50% it is marked shattered (n = 1),
// and on the turn it shatters it still scapegoats status conditions back (the status that an attack adds resolves after the hit is taken), and it is removed at the end of the turn.

const MASK = 'maskfox_new_face';
const MASK_TURNS = 3;
/** While scapegoating, do not scapegoat again (two `maskfox` bouncing it back and forth) */
let framing = false;

/** Wearing an intact Mask */
function masked(b: Battle, id: SideId): boolean {
  const l = b.active(id).fainted ? undefined : b.getLasting(id, MASK);
  return !!l && !l.n;
}

/** Puts on a new Mask (3 turns; a shattered Mask is replaced too) */
function putMask(b: Battle, id: SideId): void {
  if (b.active(id).fainted) return;
  b.addLasting(id, MASK, MASK_TURNS, { n: 0 });
}

// ═════════════════════════ Skill hooks ═════════════════════════

/** Skill id -> skill hooks */
export const FX: Record<string, SkillHooks> = {
  // ───────────── `noxfang` ─────────────
  noxfang_shadow_fang: noxStrike('noxfang_shadow_fang', 1),
  noxfang_blood_scent: {
    effect: (b, id) => addMarks(b, id, 2),
    aiScore: (b, id) => markSetupAi(b, id, 2),
  },
  noxfang_pounce: {
    // `noxfang_pounce`: power +35 when the opponent has 3 or more stacks of Hunt Mark
    power: (b, c, p) => (noxMarks(b, c.attacker) >= 3 ? p + 35 : p),
    ...noxStrike('noxfang_pounce', 0),
  },
  noxfang_nightfall: {
    effect: (b, id) => addMarks(b, id, 1),
    aiScore: (b, id) => (b.s.field?.element === 'dark' ? -60 : noxMarks(b, id) >= 2 ? 20 : 5),
  },
  noxfang_throat_rend: noxStrike('noxfang_throat_rend', 2),
  noxfang_hunt_down: {
    // `noxfang_hunt_down`: when the opponent switches, hits at double power before it leaves
    pursuit: 2,
    ...noxStrike('noxfang_hunt_down', 1),
  },
  noxfang_shadow_ambush: {
    // `noxfang_shadow_ambush`: after the opponent's attack resolves, counters with `noxfang_shadow_fang` at 1.5x power
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => ({ after: () => b.followUp(owner, 'noxfang_shadow_fang', 1.5, '伏影撲出！') }),
    },
    aiScore: (b, id) => (foeAttacks(b, id) ? 35 : -60),
  },
  noxfang_moon_claws: {
    // Each hit leaves 1 stack of Hunt Mark, and the Hunt Kill is checked after it finishes
    onHit: (b, c) => addMarks(b, c.attacker, 1),
    afterAttack: (b, c, r) => void (r.decoyBlocked || hunt(b, c)),
    aiScore: (b, id) => huntAi(b, id, 'noxfang_moon_claws', { add: 2 }),
  },
  noxfang_bloodmoon_snare: {
    // `noxfang_bloodmoon_snare`: when the opponent uses a status skill, curses it and leaves 2 stacks of Hunt Mark before the skill takes effect
    trap: {
      on: 'foeStatus',
      fire: (b, owner) => {
        b.applyStatus(b.foe(owner), 'curse');
        addMarks(b, owner, 2);
      },
    },
    aiScore: (b, id) => (b.active(b.foe(id)).skills.some((s) => getSkill(s).category === 'status') ? 20 : -40),
  },
  noxfang_moon_howl: {
    effect: (b, id) => addMarks(b, id, 3),
    aiScore: (b, id) => markSetupAi(b, id, 3),
  },
  noxfang_lunar_rend: {
    // `noxfang_lunar_rend`: always crits at 3 or more stacks of Hunt Mark
    critBonus: (b, c) => (noxMarks(b, c.attacker) >= 3 ? 1 : 0),
    ...noxStrike('noxfang_lunar_rend', 0),
  },
  noxfang_kill_fang: noxStrike('noxfang_kill_fang', 0, { bonus: 12 }),
  noxfang_pack_feast: {
    // `noxfang_pack_feast`: each hit leaves 1 stack of Hunt Mark and checks for a Hunt Kill at once
    onHit: (b, c, h) => {
      addMarks(b, c.attacker, 1);
      if (!h.ko) hunt(b, c);
    },
    aiScore: (b, id) => huntAi(b, id, 'noxfang_pack_feast', { add: 3 }),
  },
  u_noxfang: noxStrike('u_noxfang', 0, { mult: 2 }),

  // ───────────── `voidchild` ─────────────
  voidchild_nibble: {
    afterAttack: vcStrike((b, c) => devour(b, c.attacker)),
    // When Void Belly is plentiful but aether is not enough for `voidchild_collapse`, store aether with the 0-cost `voidchild_nibble`
    aiScore: (b, id) => {
      const ae = b.side(id).aether;
      const saving = belly(b, id) >= 3 && ae < 3 && b.active(id).skills.includes('voidchild_collapse');
      return saving ? 40 : belly(b, id) < BELLY_MAX ? 6 : 0;
    },
  },
  voidchild_burst: {
    // `voidchild_burst`: power +40 with Void Belly, spends 1 stack
    power: (b, c, p) => (belly(b, c.attacker) >= 1 ? p + 40 : p),
    afterAttack: (b, c, r) => {
      const me = b.active(c.attacker);
      if ((me.vars[BELLY] ?? 0) >= 1) me.vars[BELLY] -= 1;
      if (r.ko) feed(b, c.attacker, 2);
    },
    aiScore: (b, id) => (belly(b, id) >= 1 ? 8 : -25),
  },
  voidchild_digest: {
    // `voidchild_digest`: cleanse first (+1 Void Belly for each status condition removed), then heal (so a curse cannot stop the heal)
    manual: ['cleanse', 'heal'],
    effect: (b, id) => {
      const n = Object.keys(b.active(id).status).length;
      if (n > 0) b.cleanse(id);
      b.heal(id, 20);
      feed(b, id, n);
    },
  },
  voidchild_shade_wave: {
    afterAttack: vcStrike((b, c) => devour(b, c.attacker)),
  },
  voidchild_void_maw: {
    // `voidchild_void_maw`: when the opponent raises its stats, steals all its boosts, Void Belly +2
    trap: {
      on: 'foeBuff',
      fire: (b, owner) => {
        b.stealStages(owner);
        feed(b, owner, 2);
      },
    },
    aiScore: (b, id) => (foeBuffs(b, id) ? 30 : -30),
  },
  voidchild_swallow_sky: {
    // `voidchild_swallow_sky`: the field disappears at the end of this turn, Void Belly +1 for each remaining turn (max 3)
    effect: (b, id) => {
      const fd = b.s.field;
      if (!fd) {
        b.text('沒有可以吞下的場地。');
        return;
      }
      const n = Math.min(3, fd.turns);
      fd.turns = 1;
      b.text(`${b.active(id).name} 吞下了天空：場地將在本回合結束時消失！`);
      feed(b, id, n);
    },
    aiScore: (b) => {
      const fd = b.s.field;
      if (!fd) return -60;
      return fd.element === 'dark' ? -30 : 30 + 5 * Math.min(3, fd.turns);
    },
  },
  void_devour: {
    // `void_devour`: when there are no stat boosts to steal, erodes 6% instead; the stealing itself is resolved by tags
    afterAttack: vcStrike((b, c) => {
      const d = b.active(c.defender);
      if (!Object.values(d.stages).some((v) => v > 0)) erode(b, c.attacker, 6);
      feed(b, c.attacker, 1);
    }),
    aiScore: () => 8,
  },
  voidchild_eat_time: {
    // `voidchild_eat_time`: clears the opponent's turn-based effects, Void Belly +1 when something was swallowed
    manual: ['dispelTurns'],
    afterAttack: vcStrike((b, c) => {
      if (b.clearLasting(c.defender, 'own')) feed(b, c.attacker, 1);
    }),
    aiScore: (b, id) => 25 * foeOwnLasting(b, id) - 5,
  },
  voidchild_collapse: {
    // `voidchild_collapse`: spends all the Void Belly, +25 power per stack
    power: (b, c, p) => p + 25 * belly(b, c.attacker),
    afterAttack: (b, c, r) => {
      empty(b, c.attacker);
      if (r.ko) feed(b, c.attacker, 2);
    },
    // When the opponent can guard, or has a trap set and this hit cannot KO it, do not slam the Void Belly down yet (the Void Belly stays for next turn; first use a cheap attack to draw out the guard and the trap)
    aiScore: (b, id) => {
      const f = b.foe(id);
      const lethalThroughTrap = b.estimate(id, 'voidchild_collapse') * 0.7 >= b.active(f).hp;
      return (
        (belly(b, id) >= 3 ? 30 : belly(b, id) <= 1 ? -30 : 0) -
        (guardBait(b, id, 'voidchild_collapse') ? 60 : 0) -
        (b.side(f).trap && !lethalThroughTrap ? 25 : 0)
      );
    },
  },
  voidchild_seal: {
    // `voidchild_seal`: Void Belly +1 when the seal succeeds (the seal itself is resolved by tags)
    effect: (b, id) => {
      const d = b.active(b.foe(id));
      if (d.disabled && d.disabled.turns > b.s.turn) feed(b, id, 1);
    },
  },
  voidchild_erosion: {
    afterAttack: vcStrike((b, c) => {
      erode(b, c.attacker, 8);
      feed(b, c.attacker, 1);
    }),
  },
  voidchild_void_wall: {
    // Cannot be used on consecutive turns (like guard, to avoid keeping the mouth open all the time)
    canUse: (b, id) => (getVar(b, id, 'e:vc:wall') === b.s.turn && b.s.turn > 0 ? '不能連續使用' : null),
    effect: (b, id) => {
      b.active(id).vars['e:vc:wall'] = b.s.turn;
      b.addLasting(id, 'voidchild_void_wall', 2);
    },
    lasting: {
      name: '虛無之壁',
      immune: (b, ctx) => {
        b.removeLasting(ctx.defender, 'voidchild_void_wall');
        b.text(`${b.active(ctx.defender).name} 吞下了這次攻擊！`);
        feed(b, ctx.defender, 2);
        return true;
      },
    },
    aiScore: (b, id) => {
      if (b.getLasting(id, 'voidchild_void_wall') || !foeAttacks(b, id)) return -100;
      // The more the opponent's biggest hit hurts, the more it is worth devouring it first
      const f = b.foe(id);
      const me = b.active(id);
      const foeC = b.active(f);
      let big = 0;
      for (const s of [...foeC.skills, ...(foeC.ultimate && !b.side(f).ultUsed ? [foeC.ultimate] : [])]) {
        if (isAttack(getSkill(s)) && b.canUse(f, s).ok) big = Math.max(big, b.estimate(f, s));
      }
      const threat = big / Math.max(1, me.hp);
      return threat >= 0.35 && belly(b, id) < BELLY_MAX ? 30 + Math.min(60, threat * 60) : -20;
    },
  },
  voidchild_void_advent: {
    effect: (b, id) => void b.addLasting(id, 'voidchild_void_advent', 3),
    lasting: {
      name: '虛無降臨',
      // Devours once after the opponent's attack hits `voidchild` (status skills are handled by the kit hook's onFoeStatusSkill)
      onHitTaken: (b, ctx) => devour(b, ctx.defender),
    },
    aiScore: (b, id) => (b.getLasting(id, 'voidchild_void_advent') ? -100 : 35),
  },
  u_voidchild: {
    // `u_voidchild`: spends all the Void Belly (+20 per stack); devours the opponent's ultimate when it has not used one this battle
    power: (b, c, p) => p + 20 * belly(b, c.attacker),
    afterAttack: (b, c, r) => {
      empty(b, c.attacker);
      const fs = b.side(c.defender);
      if (!fs.ultUsed) {
        fs.ultUsed = true;
        b.side(c.attacker).ultUsed = false;
        b.traitEvent(c.attacker, '吞天');
        b.text(`${b.active(c.attacker).name} 吞噬了 ${fs.name} 的奧義！對手本場不能再使用奧義，我方可以再發動一次。`);
      }
      if (r.ko) feed(b, c.attacker, 2);
    },
    aiScore: (b, id) => (b.side(b.foe(id)).ultUsed ? 0 : 25),
  },

  // ── `soul_lantern` ──
  soul_lantern_wisp: {
    power: (b, c, p) => (lampLit(b, c.attacker) ? p + 25 : p),
  },
  soul_lantern_lure_lamp: {
    // `soul_lantern_lure_lamp`: when the opponent's attack hits, curses the attacker before the damage (the drain of this attack also misses)
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => void b.applyStatus(b.foe(owner), 'curse'),
    },
    aiScore: (b, id) => (foeAttacks(b, id) ? 45 : -40),
  },
  soul_lantern_ghost_flame: {
    // `soul_lantern_ghost_flame`: when the lamp is lit, Soulfire burns once immediately after hitting
    afterAttack: (b, c, r) => {
      if (!r.ko && !r.decoyBlocked && lampLit(b, c.attacker)) soulfire(b, c.attacker);
    },
    aiScore: (b, id) => (lampLit(b, id) ? soulfirePct(b, id) : 0),
  },
  soul_lantern_lamp_whisper: {
    // `soul_lantern_lamp_whisper`: reveals the opponent's trap; when the lamp is lit, it destroys it instead
    manual: ['revealTrap'],
    effect: (b, id) => {
      const f = b.foe(id);
      if (!b.side(f).trap) return;
      if (lampLit(b, id)) {
        b.text('冥燈照出了藏著的伏技，將它燒毀！');
        b.destroyTrap(f);
      } else b.revealTrap(f);
    },
    aiScore: (b, id) => {
      const t = b.side(b.foe(id)).trap;
      if (!t) return -10;
      return lampLit(b, id) ? 35 : t.revealed ? -10 : 10;
    },
  },
  soul_lantern_seal_lamp: {
    // `soul_lantern_seal_lamp`: when the opponent uses a status skill, voids it and curses the opponent
    trap: {
      on: 'foeStatus',
      fire: (b, owner) => {
        b.applyStatus(b.foe(owner), 'curse');
        return { negate: true };
      },
    },
    aiScore: (b, id) => (foeHasStatusSkills(b, id) ? 25 : -50),
  },
  soul_lantern_hang_lamp: {
    // `soul_lantern_hang_lamp`: moves our trap that is set (the Netherlamp) onto the opponent, where it keeps burning for 3 turns and cannot be put out by a trigger; the trap slot is freed so another lamp can be lit
    afterAttack: (b, c, r) => {
      const id = c.attacker;
      if (r.ko || r.decoyBlocked || !b.side(id).trap) return;
      // The lamp is moved to the opponent, not destroyed: it clears the trap slot directly (no trapDestroyed is sent)
      b.side(id).trap = null;
      b.addLasting(c.defender, HUNG, 3, { from: id });
      b.text(`冥燈掛上了 ${b.active(c.defender).name} 的身上！`);
    },
    lasting: { name: '懸燈' },
    aiScore: (b, id) => (b.side(id).trap && !lampHung(b, id) ? 25 + 2 * soulfirePct(b, id) : -30),
  },
  soul_lantern_soul_drain: {
    // `soul_lantern_soul_drain`: when the lamp is lit, the drain becomes 100% (another 50% heal on top of the tag's 50%)
    afterAttack: (b, c, r) => {
      if (r.dealt > 0 && !r.decoyBlocked && lampLit(b, c.attacker)) b.healAmount(c.attacker, Math.floor(r.dealt * 0.5));
    },
  },
  soul_lantern_wraith_step: {
    power: (b, c, p) => (lampLit(b, c.attacker) ? p + 30 : p),
  },
  soul_lantern_karma_fire: {
    // `soul_lantern_karma_fire`: removes the opponent's curse, and for each remaining turn adds damage of 6% of max HP
    afterAttack: (b, c, r) => {
      if (r.ko || r.decoyBlocked) return;
      const curse = b.active(c.defender).status.curse;
      if (!curse) return;
      const n = curse.turns;
      b.removeStatus(c.defender, 'curse');
      b.text(`詛咒燃成業火！（剩 ${n} 回合）`);
      b.trueDamage(c.defender, 6 * n, 'karma');
    },
    aiScore: (b, id) => {
      const curse = b.active(b.foe(id)).status.curse;
      return curse ? 6 * curse.turns : -15;
    },
  },
  soul_lantern_lamp_rest: {
    // `soul_lantern_lamp_rest`: when the lamp is lit, MAG +1 stage as well
    effect: (b, id) => {
      if (lampLit(b, id)) b.changeStage(id, 'mag', 1);
    },
  },
  soul_lantern_thousand_lamps: {
    // `soul_lantern_thousand_lamps`: lights a lure lamp when there is no trap; if there is one, Soulfire burns once immediately
    afterAttack: (b, c, r) => {
      if (r.decoyBlocked) return;
      const id = c.attacker;
      if (!b.side(id).trap) {
        b.placeTrap(id, 'soul_lantern_lure_lamp');
        b.text('點亮了一盞「引魂燈」！');
      } else if (!r.ko) soulfire(b, id);
    },
    aiScore: (b, id) => (b.side(id).trap ? soulfirePct(b, id) : 25),
  },
  u_soul_lantern: {
    // `u_soul_lantern`: Soulfire doubled for 3 turns (the curse is applied by tags)
    afterAttack: (b, c) => void b.addLasting(c.attacker, 'u_soul_lantern', 3),
    lasting: { name: '萬燈引魂' },
  },

  // ── `weaverspider` ──
  weaverspider_silk_shot: {
    onHit: (b, c) => addStrands(b, c.attacker, 1),
  },
  weaverspider_snare_web: {
    // `weaverspider_snare_web`: reduces the opponent's hit by 30% and roots the attacker; after resolution it sets again according to the webstrands (SPD -1 stage is handled by the trait "Weaving")
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => ({
        reduce: 0.3,
        after: () => {
          const f = b.foe(owner);
          if (!b.active(f).fainted) b.applyStatus(f, 'root');
          reweave(b, owner, 'weaverspider_snare_web');
        },
      }),
    },
    aiScore: (b, id) => (foeAttacks(b, id) ? 40 : -40),
  },
  weaverspider_weave: {
    effect: (b, id) => addStrands(b, id, 2),
    aiScore: (b, id) => (strands(b, id) >= 2 ? -40 : 10),
  },
  weaverspider_prey: {
    // `weaverspider_prey`: +20 power for each stage of the opponent's SPD drop (up to +80)
    power: (b, c, p) => p + 20 * Math.min(4, Math.max(0, -(b.active(c.defender).stages.spd ?? 0))),
  },
  weaverspider_dream_net: {
    // `weaverspider_dream_net`: when the opponent uses a status skill, voids it and MAG -1 stage, then sets again according to the webstrands (SPD -1 stage is handled by the trait "Weaving")
    trap: {
      on: 'foeStatus',
      fire: (b, owner) => ({
        negate: true,
        after: () => {
          const f = b.foe(owner);
          if (!b.active(f).fainted) b.changeStage(f, 'mag', -1, true);
          reweave(b, owner, 'weaverspider_dream_net');
        },
      }),
    },
    aiScore: (b, id) => (foeHasStatusSkills(b, id) ? 30 : -50),
  },
  weaverspider_reel_in: {
    // `weaverspider_reel_in`: spends all the webstrands, +35 power per strand
    power: (b, c, p) => p + 35 * strands(b, c.attacker),
    afterAttack: (b, c) => void takeStrands(b, c.attacker),
    // Reel in when the webstrands are full; when no web is set and aether is not enough to also set one, set the web first
    aiScore: (b, id) => {
      const n = strands(b, id);
      const base = n >= 3 ? 25 : n === 2 ? 0 : -40;
      return base - (!b.side(id).trap && b.side(id).aether < 4 ? 20 : 0);
    },
  },
  sticky_web: {
    effect: (b, id) => addStrands(b, id, 1),
    aiScore: (b, id) => (b.aliveBench(b.foe(id)).length === 0 || b.side(b.foe(id)).hazard ? -80 : 10),
  },
  weaverspider_silk_bind: {
    onHit: (b, c) => addStrands(b, c.attacker, 1),
  },
  weaverspider_sense: {
    effect: (b, id) => addStrands(b, id, 1),
    aiScore: (b, id) => (b.side(b.foe(id)).trap ? 20 : -40),
  },
  weaverspider_cocoon: {
    effect: (b, id) => addStrands(b, id, 1),
  },
  weaverspider_thousand_threads: {
    // `weaverspider_thousand_threads`: the webstrands are filled; for 3 turns setting again spends no webstrands
    effect: (b, id) => {
      addStrands(b, id, WEB_MAX);
      b.addLasting(id, 'weaverspider_thousand_threads', 3);
    },
    lasting: { name: '千絲萬縷' },
    aiScore: (b, id) => (b.getLasting(id, 'weaverspider_thousand_threads') ? -100 : strands(b, id) <= 1 ? 30 : 5),
  },
  u_weaverspider: {
    // `u_weaverspider`: the webstrands are filled; when there is no trap, sets `weaverspider_snare_web`
    afterAttack: (b, c) => {
      const id = c.attacker;
      addStrands(b, id, WEB_MAX);
      if (!b.side(id).trap) {
        b.placeTrap(id, 'weaverspider_snare_web');
        b.text('夢網預言：一張「纏絲網」悄悄張開了。');
      }
    },
  },

  // ── `eclipse_batlord` ──
  eclipse_batlord_night_kiss: {
    // `eclipse_batlord_night_kiss`: after hitting, the opponent is under Night Kiss for 3 turns. Night Kiss itself is a lasting effect on the opponent: when the opponent's attack hits the bat lord, part of its blood is drained
    afterAttack: (b, c, r) => {
      if (!r.decoyBlocked && !r.ko) kiss(b, c.attacker);
    },
    aiScore: (b, id) => (kissed(b, id) ? 0 : 15),
    lasting: {
      name: '夜吻',
      // Bloodthirst Instinct: the bat lord's attack knocks out an opponent under Night Kiss (called before the opponent faints, when HP is already zero)
      onHitTaken: (b, ctx) => {
        if (b.active(ctx.defender).hp <= 0 && b.active(ctx.attacker).species.id === BAT) feast(b, ctx.attacker);
      },
      onDealt: (b, ctx, dealt) => {
        const bat = ctx.defender;
        const bc = b.active(bat);
        if (bc.species.id !== BAT || bc.fainted || bc.hp <= 0) return;
        const rate = feedRate(b, bat);
        const amt = Math.floor(dealt * rate);
        if (amt <= 0) return;
        b.text(`夜吻的傷口湧出鮮血，被 ${bc.name} 吸走了！`);
        b.healAmount(bat, amt);
        const foe = b.active(ctx.attacker);
        if (amt >= foe.hp) feast(b, bat);
        b.damage(ctx.attacker, amt, 'kiss');
      },
    },
  },
  eclipse_batlord_screech: {
    // `eclipse_batlord_screech`: taunt and revealing a trap are resolved by tags; kiss first, then force it to act
    // Only worth taunting when the opponent is under Night Kiss and has a status skill available (or will guard)
    aiScore: (b, id) => {
      const foe = b.active(b.foe(id));
      if (foe.status.taunt) return -60;
      const hasStatus = foe.skills.some((s) => getSkill(s).category === 'status');
      return (kissed(b, id) ? 0 : -25) + (hasStatus ? 0 : -15);
    },
  },
  eclipse_batlord_wing_dive: {
    afterAttack: (b, c, r) => {
      if (!r.decoyBlocked && !r.ko) kiss(b, c.attacker);
    },
    aiScore: (b, id) => (kissed(b, id) ? 0 : 15),
  },
  eclipse_batlord_hang: {
    // `eclipse_batlord_hang`: damage reduced by 50% this turn; Night Kiss's drain becomes 100% (feedRate). Cannot be used on consecutive turns
    // While choosing actions s.turn is still last turn (same check as guard and bond)
    canUse: (b, id) => (b.active(id).vars['e:bat:hang'] === b.s.turn ? '不能連續使用' : null),
    effect: (b, id) => {
      b.active(id).vars['e:bat:hang'] = b.s.turn;
      b.addLasting(id, HANG, 1);
    },
    lasting: { name: '倒懸', reduce: () => 0.5 },
    // The more the opponent's hit hurts, the more `eclipse_batlord_hang` is worth; worth more still when there is a Night Kiss
    aiScore: (b, id) => {
      const me = b.active(id);
      const hit = foeBestHit(b, id);
      if (hit <= 0) return -60;
      let s = Math.min(45, (hit / me.maxHp) * 100) - 25;
      if (kissed(b, id)) s += 25;
      if (b.active(b.foe(id)).status.taunt) s += 10;
      if (hit >= me.hp) s += 15;
      return s;
    },
  },
  eclipse_batlord_blood_fang: {
    // `eclipse_batlord_blood_fang`: always crits while the opponent is taunted
    critBonus: (b, c) => (b.active(c.defender).status.taunt ? 1 : 0),
    afterAttack: (b, c, r) => {
      if (!r.decoyBlocked && !r.ko) kiss(b, c.attacker);
    },
  },
  eclipse_batlord_bloodlust: {
    // `eclipse_batlord_bloodlust`: heals another 15% when the opponent is under Night Kiss
    effect: (b, id) => {
      if (kissed(b, id)) b.heal(id, 15);
    },
  },
  eclipse_batlord_drink_deep: {
    // `eclipse_batlord_drink_deep`: when the opponent is under Night Kiss, drinks blood from the wound as well (the opponent loses 12% of max HP)
    effect: (b, id) => {
      if (!kissed(b, id)) return;
      b.text('蝠王從夜吻的傷口痛飲！');
      b.trueDamage(b.foe(id), 12, 'kiss');
    },
    aiScore: (b, id) => (kissed(b, id) ? 10 : 0),
  },
  eclipse_batlord_blood_moon: {
    // `eclipse_batlord_blood_moon`: power +50 when the opponent is already under Night Kiss; Night Kiss is refreshed after hitting
    power: (b, c, p) => p + (kissed(b, c.attacker) ? 50 : 0),
    afterAttack: (b, c, r) => {
      if (!r.decoyBlocked && !r.ko) kiss(b, c.attacker);
    },
  },
  u_eclipse_batlord: {
    // `u_eclipse_batlord`: Night Kiss for 3 turns, and drain doubled for 3 turns (the taunt is applied by tags)
    afterAttack: (b, c, r) => {
      if (!r.decoyBlocked && !r.ko) kiss(b, c.attacker);
      b.addLasting(c.attacker, FEAST, 3);
    },
    lasting: { name: '月蝕血宴' },
  },

  // ── `tombhound` ──
  tombhound_hellfire: {
    // `tombhound_hellfire`: the burn is applied by tags, then 2 heads are lit (the end-of-turn burn lights 1 more: all three heads burn next turn)
    effect: (b, id) => lightHeads(b, id, 2),
    aiScore: (b, id) => {
      const f = b.foe(id);
      return b.active(f).status.burn || b.statusBlocked(f, 'burn') ? -60 : 10;
    },
  },
  tombhound_flame_maw: maw(25),
  tombhound_scorch_howl: {
    // `tombhound_scorch_howl`: when the opponent is burning, extends the burn by 1 turn
    effect: (b, id) => void stokeBurn(b, id),
    aiScore: (b, id) => (b.active(b.foe(id)).status.burn ? 10 : 0),
  },
  tombhound_triple_maw: {
    // `tombhound_triple_maw`: +25 per Burning Head; after hitting, extends the burn by 1 turn
    ...maw(25),
    afterAttack: (b, c, r) => {
      if (!r.ko && !r.decoyBlocked) stokeBurn(b, c.attacker);
    },
  },
  tombhound_brand_fang: {
    // `tombhound_brand_fang`: lights 1 head when the opponent is burning
    afterAttack: (b, c, r) => {
      if (!r.ko && !r.decoyBlocked && b.active(c.defender).status.burn) lightHeads(b, c.attacker, 1);
    },
  },
  tombhound_soul_chase: {
    // `tombhound_soul_chase`: when the opponent switches, hits at double power before it leaves
    pursuit: 2,
  },
  u_tombhound: {
    // `u_tombhound`: +30 per Burning Head (the burn is applied by tags)
    ...maw(30),
    aiScore: (b, id) => heads(b, id) * 8,
  },

  // ── `abyssjelly` ──
  soul_drink: {
    // `soul_drink`: the drain is resolved by tags; worth more when the opponent is about to use its ultimate
    aiScore: (b, id) => {
      const ae = b.side(b.foe(id)).aether;
      return ae <= 0 ? -30 : ae >= 5 ? 20 : 5;
    },
  },
  abyssjelly_numb: {
    aiScore: (b, id) => (foeParalyzed(b, id) || b.statusBlocked(b.foe(id), 'paralyze') ? -40 : 5),
  },
  abyssjelly_drain_pulse: {
    // `abyssjelly_drain_pulse`: when the opponent is paralyzed, drains another 1 point of aether after hitting
    afterAttack: (b, c, r) => {
      if (!r.ko && !r.decoyBlocked && foeParalyzed(b, c.attacker)) siphon(b, c.attacker, '汲光波順著靈絲汲走了靈能！');
    },
  },
  abyssjelly_deep_glow: {
    // `abyssjelly_deep_glow`: heals another 10% when the opponent is paralyzed
    effect: (b, id) => {
      if (foeParalyzed(b, id)) b.heal(id, 10);
    },
  },

  // ── `maskfox` ──
  maskfox_new_face: {
    // `maskfox_new_face`: puts on a new Mask (ATK +1 is resolved by tags). The Mask itself is this skill's lasting effect
    effect: (b, id) => putMask(b, id),
    aiScore: (b, id) => (masked(b, id) ? -30 : 10),
    lasting: {
      name: '面具',
      reduce: (_b, _c, e) => (e.n ? 0 : 0.5),
      onHitTaken: (b, _c, _d, e) => {
        if (e.n) return;
        e.n = 1;
        b.text('面具碎裂了！');
      },
      // `scapegoat`: a status condition the opponent inflicts lands on the opponent itself instead
      blockStatus: (b, owner, st) => {
        if (framing) return false;
        const f = b.foe(owner);
        framing = true;
        try {
          if (!b.active(f).fainted) {
            b.text('面具底下的百面狐笑了。「嫁禍」！');
            b.applyStatus(f, st);
          }
        } finally {
          framing = false;
        }
        return true;
      },
      onTurnEnd: (b, owner, e) => {
        if (e.n) b.removeLasting(owner, MASK);
      },
    },
  },
  maskfox_mask_toss: {
    // `maskfox_mask_toss`: +30 power while wearing the Mask, and the Mask shatters (thrown away on use, even if guarded)
    power: (b, c, p) => p + (masked(b, c.attacker) ? 30 : 0),
    afterUse: (b, id) => {
      if (!masked(b, id)) return;
      b.removeLasting(id, MASK);
      b.text('百面狐把面具砸了出去！');
    },
    // Do not throw the Mask before it has blocked an attack for it (throwing it loses one damage reduction and one scapegoat); throw it when this hit can KO (the KO score is >= 160)
    aiScore: (b, id, s) => (masked(b, id) && s < 150 ? -25 : 0),
  },
  maskfox_face_change: {
    // `maskfox_face_change`: puts on a new Mask after hitting
    afterAttack: (b, c) => putMask(b, c.attacker),
  },
  maskfox_frame: {
    // `maskfox_frame`: +25 power for each kind of status condition on the opponent
    power: (b, c, p) => p + 25 * Object.keys(b.active(c.defender).status).length,
  },
  maskfox_mask_rest: {
    // `maskfox_mask_rest`: SPD +1 more while wearing the Mask
    effect: (b, id) => {
      if (masked(b, id)) b.changeStage(id, 'spd', 1);
    },
  },
  u_maskfox: {
    // `u_maskfox`: puts on a new Mask after hitting (the curse is applied by tags)
    afterAttack: (b, c) => putMask(b, c.attacker),
  },
};

// Webstrands: +1 when `weaverspider` uses a skill before the opponent (the opponent has not acted this turn)
for (const [k, h] of Object.entries(FX)) {
  if ((k.startsWith('weaverspider_') || k === 'sticky_web' || k === 'u_weaverspider') && !h.trap) {
    h.afterUse = (b, id) => {
      if (!b.hasActed(b.foe(id)) && !b.active(b.foe(id)).fainted) addStrands(b, id, 1);
    };
  }
}

// ═════════════════════════ Kit hooks ═════════════════════════

/** Spirit id -> kit hooks (signature mechanics, rewritten traits, state marks) */
export const KIT: Record<string, KitHooks> = {
  noxfang: {
    // Night Hunter: on entering, sets Eternal Night for 3 turns; when our trap fires, the opponent gains 1 stack of Hunt Mark
    onEnter: (b, id) => {
      b.traitEvent(id, '夜之獵手');
      b.setField('dark', 3);
    },
    onTrapActivated: (b, id) => {
      if (b.active(b.foe(id)).fainted) return;
      b.traitEvent(id, '夜之獵手');
      addMarks(b, id, 1);
    },
    onLeave: (b, id) => clearMarks(b, id),
    onFaint: (b, id) => clearMarks(b, id),
    marks: (b, id) => {
      const n = noxMarks(b, id);
      const line = noxLine(b, id);
      return n || line ? [{ id: 'kit:hunt', n, note: `獵痕（斬殺線 ${line}%）` }] : [];
    },
  },
  voidchild: {
    // Nothingness: devours the opponent once on entering; each stack of Void Belly gives +5% damage
    onEnter: (b, id) => {
      if (b.active(b.foe(id)).fainted) return;
      b.traitEvent(id, '虛無');
      devour(b, id);
    },
    attackBonus: (b, a) => 0.05 * getVar(b, a.attacker, BELLY),
    onFoeStatusSkill: (b, id) => {
      if (b.getLasting(id, 'voidchild_void_advent')) devour(b, id);
    },
    marks: (b, id) => {
      const n = belly(b, id);
      return n ? [{ id: 'kit:belly', n, note: '虛腹' }] : [];
    },
  },
  soul_lantern: {
    // Netherlamp: while the lamp is lit, at the end of the turn it reveals the trap and burns the opponent with Soulfire; Everlit: the opponent's curse does not lose turns
    onEndTurn: (b, id) => {
      if (!lampLit(b, id)) return;
      const foe = b.active(b.foe(id));
      if (foe.fainted) return;
      if (foe.status.curse) foe.status.curse.turns += 1;
      if (b.side(id).trap) {
        b.revealTrap(id);
        soulfire(b, id);
      }
      if (lampHung(b, id)) soulfire(b, id);
    },
    marks: (b, id) => {
      if (!lampLit(b, id)) return [];
      const lamps = (b.side(id).trap ? 1 : 0) + (lampHung(b, id) ? 1 : 0);
      const pct = soulfirePct(b, id);
      return [{ id: 'kit:lamp', n: pct, note: `冥燈${lamps > 1 ? ' ×2' : ''}（魂焰 ${pct}%）` }];
    },
  },
  weaverspider: {
    // The trait keeps the old "Weaving" (traits.ts: when our trap fires, the opponent's SPD -1 stage); here only the webstrands are shown
    marks: (b, id) => {
      const n = strands(b, id);
      return n ? [{ id: 'kit:web', n, note: '網絲' }] : [];
    },
  },
  eclipse_batlord: {
    // Night Kiss follows the bat lord: when the bat lord leaves or faints, the Night Kiss on the opponent disappears. Bloodthirst Instinct (drain doubled below 50% HP) is resolved in feedRate
    onLeave: (b, id) => b.removeLasting(b.foe(id), KISS),
    onFaint: (b, id) => b.removeLasting(b.foe(id), KISS),
    marks: (b, id) => {
      if (!kissed(b, id)) return [];
      const pct = Math.round(feedRate(b, id) * 100);
      return [{ id: 'kit:kiss', n: pct, note: `夜吻（吸血 ${pct}%）` }];
    },
  },
  tombhound: {
    // Burning Heads: when the opponent enters the end of the turn burning, lights 1 head. The trait keeps the old "Three Heads" (hitSplit in traits.ts)
    onEndTurn: (b, id) => {
      const f = b.active(b.foe(id));
      if (f.fainted || !f.status.burn) return;
      lightHeads(b, id, 1);
    },
    marks: (b, id) => {
      const n = heads(b, id);
      return n ? [{ id: 'kit:heads', n, note: '燃首' }] : [];
    },
  },
  abyssjelly: {
    // Spirit Threads: a paralyzed opponent has 1 point of aether drained at the end of every turn (the trait keeps the old "Paralytic Tentacles")
    onEndTurn: (b, id) => {
      if (!foeParalyzed(b, id)) return;
      siphon(b, id, `靈絲纏著 ${b.active(b.foe(id)).name}，汲走了 1 點靈能！`);
    },
    marks: (b, id) => (foeParalyzed(b, id) ? [{ id: 'kit:threads', n: 1, note: '靈絲（每回合汲取 1 點靈能）' }] : []),
  },
  maskfox: {
    // Hundred Faces: puts on the Mask on entering (the Mask's effect is written in the lasting effect of `maskfox_new_face`)
    onEnter: (b, id) => {
      b.traitEvent(id, '百面');
      putMask(b, id);
    },
  },
};
