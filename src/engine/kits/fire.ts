// Skill hooks and kit hooks for the fire group (data/kits/fire.json). See docs/10-kit-authoring.md for how to write them.
// Only `import type { Battle }` is allowed (importing battle.ts at runtime would create a circular dependency).

import { getSkill, GUARD_ID } from '../../data.ts';
import type { Battle } from '../battle.ts';
import { isAttack } from '../skillfx.ts';
import type { KitHooks, SkillHooks } from '../skillfx.ts';
import type { MarkView, SideId } from '../types.ts';

// ═════════════════════════ `ignisar`: Flame Hue ═════════════════════════
// The mane flame has three colors: 0 Red Flame -> 1 White Flame -> 2 Azure Flame (stored under an e: key, reset on leaving; it enters as White Flame).
// - Royal Flame Domain: on entering, sets Blazing Sun; the sun burns only for the king (when the opponent's fire attack hits `ignisar`, the sun bonus is removed).
// - Heating up: +1 at the end of each turn under Blazing Sun, +1 after the first hit taken each turn, `ignisar_royal_roar`, `ignisar_high_noon`.
// - White Flame and above: fire attacks are never "resisted" (KIT.typeMult takes >= 1) and are not weakened by "Downpour" (KIT.attackBonus restores the x0.7).
// - Azure Flame: fire attacks ignore guard and shields (skill hook pierceGuard); "Overheat" -8% at the end of the turn.
// - Release: `ignisar_white_breath` / `ignisar_corona_burst` / `ignisar_banked_mane` reset the hue to zero, trading it for power, aether or healing.
// - Corona (a lasting effect created by the ultimate): the hue is fixed at Azure Flame, no Overheat, and releasing does not cool it.

const IGN = 'ignisar';
const HUE = 'e:ign:hue';
/** Already heated up from a hit this turn (stores the turn number) */
const WRATH = 'e:ign:wrath';
const HUE_NAME = ['赤焰', '白焰', '蒼焰'] as const;
/** Corona: the lasting effect created by the ultimate `u_ignisar` */
const CORONA = 'u_ignisar';
/** Endless Day: the lasting effect that holds the Blazing Sun */
const ENDLESS = 'ignisar_endless_day';
/** Azure Flame's Overheat damage (% of max HP) */
const OVERHEAT = 8;

const isIgnisar = (b: Battle, id: SideId): boolean => b.active(id).species.id === IGN;
const sunny = (b: Battle): boolean => b.s.field?.element === 'fire';

/** While in Corona */
function inCorona(b: Battle, id: SideId): boolean {
  return isIgnisar(b, id) && b.active(id).lasting.some((l) => l.key === CORONA);
}

/** The current hue: 0 Red Flame, 1 White Flame, 2 Azure Flame (fixed at Azure Flame during Corona; 0 when the spirit is not `ignisar`) */
export function hueOf(b: Battle, id: SideId): number {
  if (!isIgnisar(b, id)) return 0;
  if (inCorona(b, id)) return 2;
  return Math.max(0, Math.min(2, b.active(id).vars[HUE] ?? 0));
}

/** Changes the hue (no change during Corona) */
function setHue(b: Battle, id: SideId, v: number): void {
  const c = b.active(id);
  if (!isIgnisar(b, id) || c.fainted || inCorona(b, id)) return;
  const before = hueOf(b, id);
  const next = Math.max(0, Math.min(2, v));
  if (next === before) return;
  c.vars[HUE] = next;
  b.text(`${c.name} 的鬃焰${next > before ? '燒成' : '退回'}「${HUE_NAME[next]}」！`);
}

/** Releases the hue: resets it to zero and returns the number of stages spent (during Corona it does not cool, returns 0) */
function ventHue(b: Battle, id: SideId): number {
  if (inCorona(b, id)) return 0;
  const n = hueOf(b, id);
  if (n > 0) setHue(b, id, 0);
  return n;
}

/** Azure Flame: this spirit's fire attacks ignore guard and shields */
const bluePierce = (b: Battle, id: SideId): boolean => hueOf(b, id) >= 2;

/** Corona: skill cost -1 */
const coronaCost = (b: Battle, id: SideId, base: number): number => (inCorona(b, id) ? Math.max(0, base - 1) : base);

/** AI: when the hit is already enough for a KO, do not let the combo score adjustments interfere */
const KO_SCORE = 150;

/** Number of turn-based effects the opponent "created for itself" (what `ignisar_purge` can burn away) */
function foeTurnEffects(b: Battle, id: SideId): number {
  const f = b.foe(id);
  const d = b.active(f);
  const sd = b.side(f);
  const own = [...d.lasting, ...sd.lasting].filter((l) => l.from === f).length;
  return own + (sd.screens.physTurns > 0 || sd.screens.magTurns > 0 ? 1 : 0) + (sd.tailwind > 0 ? 1 : 0) + (d.regen > 0 ? 1 : 0);
}

/** Skill hooks of `ignisar` */
const IGNISAR_FX: Record<string, SkillHooks> = {
  ignisar_mane_flare: {
    cost: coronaCost,
    // `ignisar_mane_flare`: +15 power per hue stage
    power: (b, c, p) => p + 15 * hueOf(b, c.attacker),
    pierceGuard: bluePierce,
  },
  ignisar_royal_roar: {
    cost: coronaCost,
    // `ignisar_royal_roar`: hue +1 (the ATK -1 is resolved by tags)
    effect: (b, id) => setHue(b, id, hueOf(b, id) + 1),
    aiScore: (b, id) => {
      const h = hueOf(b, id);
      if (inCorona(b, id) || h >= 2) return -80;
      if (h === 0) return 45;
      // White Flame with Blazing Sun: it turns Azure Flame at the end of the turn anyway, so the roar only brings it one turn earlier
      return sunny(b) ? 5 : 35;
    },
  },
  ignisar_radiant_claw: {
    cost: coronaCost,
    // `ignisar_radiant_claw`: always crits at Azure Flame
    critBonus: (b, c) => (hueOf(b, c.attacker) >= 2 ? 1 : 0),
    pierceGuard: bluePierce,
  },
  ignisar_sunrise: {
    cost: coronaCost,
    aiScore: (b) => (sunny(b) && (b.s.field?.turns ?? 0) >= 2 ? -60 : 10),
  },
  ignisar_white_breath: {
    cost: coronaCost,
    // `ignisar_white_breath`: +35 per stage, returns to Red Flame after hitting
    power: (b, c, p) => p + 35 * hueOf(b, c.attacker),
    afterAttack: (b, c) => void ventHue(b, c.attacker),
    pierceGuard: bluePierce,
    aiScore: (b, id, base) => {
      if (base >= KO_SCORE) return 0;
      const h = hueOf(b, id);
      if (inCorona(b, id)) return 15;
      return h >= 2 ? 30 : h === 1 ? (sunny(b) ? -20 : 0) : -50;
    },
  },
  ignisar_purge: {
    cost: coronaCost,
    pierceGuard: bluePierce,
    aiScore: (b, id) => foeTurnEffects(b, id) * 30,
  },
  ignisar_lion_pounce: {
    cost: coronaCost,
    // `ignisar_lion_pounce`: priority +1 at Azure Flame
    priority: (b, id) => (hueOf(b, id) >= 2 ? 1 : 0),
    pierceGuard: bluePierce,
    aiScore: (b, id) => (hueOf(b, id) >= 2 && b.active(id).hp * 3 < b.active(id).maxHp ? 15 : 0),
  },
  ignisar_corona_burst: {
    cost: coronaCost,
    // `ignisar_corona_burst`: +40 per stage; returns to Red Flame after hitting, +1 aether for each stage spent
    power: (b, c, p) => p + 40 * hueOf(b, c.attacker),
    afterAttack: (b, c) => {
      const n = ventHue(b, c.attacker);
      if (n > 0) b.gainAether(c.attacker, n);
    },
    pierceGuard: bluePierce,
    aiScore: (b, id, base) => {
      if (base >= KO_SCORE) return 0;
      if (inCorona(b, id)) return 30;
      const h = hueOf(b, id);
      return h >= 2 ? 45 : h === 1 ? (sunny(b) ? -25 : 5) : -60;
    },
  },
  ignisar_banked_mane: {
    cost: coronaCost,
    // `ignisar_banked_mane`: spends all the hue, healing 20% per stage (the cleanse is resolved by tags)
    effect: (b, id) => {
      const n = ventHue(b, id);
      if (n > 0) b.heal(id, 20 * n);
    },
    aiScore: (b, id) => {
      const c = b.active(id);
      const st = Object.keys(c.status).length;
      const h = inCorona(b, id) ? 0 : hueOf(b, id);
      if (h === 0) return st ? 5 : -100;
      const missing = 1 - c.hp / c.maxHp;
      return Math.min(missing, 0.2 * h) * 160 - (missing < 0.35 ? 30 : 0) + st * 10;
    },
  },
  ignisar_no_retreat: {
    // `ignisar_no_retreat`: when the opponent declares a switch, the switch fails and the opponent is burned
    trap: {
      on: 'foeLeave',
      when: (b, owner) => !b.active(b.foe(owner)).fainted,
      fire: (b, owner) => {
        const f = b.foe(owner);
        b.text(`在王的面前，${b.active(f).name} 無路可退！`);
        b.applyStatus(f, 'burn');
        return { negate: true };
      },
    },
    aiScore: (b, id) => {
      if (b.aliveBench(b.foe(id)).length === 0) return -100;
      return hueOf(b, id) >= 1 ? 25 : -10;
    },
  },
  ignisar_royal_verdict: {
    cost: coronaCost,
    pierceGuard: bluePierce,
    aiScore: (b, id) => {
      const d = b.active(b.foe(id));
      const ups = Object.values(d.stages).reduce((a, v) => a + Math.max(0, v), 0);
      return ups * 12 + (d.shield ? 15 : 0);
    },
  },
  ignisar_high_noon: {
    cost: coronaCost,
    // `ignisar_high_noon`: hue +1 after hitting
    afterAttack: (b, c) => setHue(b, c.attacker, hueOf(b, c.attacker) + 1),
    pierceGuard: bluePierce,
    aiScore: (b, id) => (inCorona(b, id) || hueOf(b, id) >= 2 ? -10 : 15),
  },
  ignisar_endless_day: {
    cost: coronaCost,
    // `ignisar_endless_day`: the 5 turns of Blazing Sun are set by tags; this creates the turn-based effect that "holds the Blazing Sun" (restoring the sun is written in KIT.onEndTurn)
    effect: (b, id) => void b.addLasting(id, ENDLESS, 5),
    lasting: { name: '永晝' },
    aiScore: (b, id) => {
      if (b.getLasting(id, ENDLESS)) return -80;
      return sunny(b) && (b.s.field?.turns ?? 0) >= 3 ? -40 : 20;
    },
  },
  u_ignisar: {
    // `u_ignisar`: after it fires (even if guarded), enters Corona for 3 turns
    pierceGuard: bluePierce,
    afterUse: (b, id) => {
      const c = b.active(id);
      if (!isIgnisar(b, id)) return;
      c.vars[HUE] = 2;
      b.traitEvent(id, '日冕');
      b.addLasting(id, CORONA, 3);
    },
    lasting: { name: '日冕' },
    aiScore: (b, id, base) => {
      if (base >= KO_SCORE) return 20;
      const h = hueOf(b, id);
      return h >= 2 ? 45 : h === 1 && sunny(b) ? -30 : 0;
    },
  },
};

/** Kit hooks of `ignisar` (Flame Hue, Royal Flame Domain) */
const IGNISAR_KIT: KitHooks = {
  // Trait "Royal Flame Domain": on entering, sets Blazing Sun for 3 turns (a Holy Spirit's field) and enters as White Flame
  onEnter(b, id) {
    b.traitEvent(id, '王焰領域');
    b.setField('fire', 3);
    setHue(b, id, 1);
  },
  // The sun burns only for the king: the Blazing Sun's x1.3 is removed from the opponent's fire attacks that hit `ignisar`
  incoming(b, a, dmg) {
    if (a.sk.element !== 'fire' || !sunny(b) || a.defender === a.attacker) return dmg;
    return Math.floor(dmg / 1.3);
  },
  // End of turn: Endless Day restores the sun -> Azure Flame overheats -> heats up under the sun
  onEndTurn(b, id) {
    const c = b.active(id);
    const endless = b.getLasting(id, ENDLESS);
    if (endless && !sunny(b)) {
      b.text('永晝：烈陽再次升起！');
      b.setField('fire', endless.turns);
    }
    if (inCorona(b, id)) return;
    const h = hueOf(b, id);
    if (h >= 2) {
      b.text(`${c.name} 的蒼焰過熱了！`);
      b.trueDamage(id, OVERHEAT, 'overheat');
      if (c.fainted || c.hp <= 0) return;
    }
    if (h < 2 && sunny(b)) setHue(b, id, h + 1);
  },
  // Hue: rises one stage after the first hit taken each turn (King's Wrath: the slower king is hit first and burns even brighter)
  onHitTaken(b, a) {
    const id = a.defender;
    const c = b.active(id);
    if (c.fainted || c.vars[WRATH] === b.s.turn) return;
    c.vars[WRATH] = b.s.turn;
    setHue(b, id, hueOf(b, id) + 1);
  },
  // White Flame and above: fire attacks are not resisted (effectiveness at least x1, and the UI no longer shows "not very effective")
  typeMult(b, a, eff) {
    if (a.sk.element !== 'fire' || hueOf(b, a.attacker) < 1) return eff;
    return Math.max(eff, 1);
  },
  // White Flame and above: also not weakened by Downpour (the field's x0.7 is restored to x1 with a bonus; Downpour is not a type matchup, so typeMult is not changed)
  attackBonus(b, a) {
    if (a.sk.element !== 'fire' || hueOf(b, a.attacker) < 1 || b.s.field?.element !== 'water') return 0;
    return 1 / 0.7 - 1;
  },
  marks(b, id): MarkView[] {
    const h = hueOf(b, id);
    return [{ id: 'kit:hue', note: h >= 2 && !inCorona(b, id) ? '蒼焰・過熱' : HUE_NAME[h] }];
  },
};

// ═════════════════════════ `magma_golem`: Forged Runes ═════════════════════════
// Three runes (e: keys, the cooldown disappears on leaving): Flame Rune (burns after casting), Edge Rune (casting always crits), Heavy Rune (casting ignores guard and shields).
// - A skill marked "Forge In" forges in once used (the golem forges itself, even if guarded).
// - A "Cast" attack is delivered with all the runes and clears them after use (even if guarded); they are not cleared during `golem_eternal_forge`.
// - Magma Body (the rewritten trait): when hit by a physical attack, 30% to burn the attacker; always burns while a Flame Rune is on.

const GOLEM = 'magma_golem';
type Rune = 'flame' | 'edge' | 'heavy';
const RUNES: Rune[] = ['flame', 'edge', 'heavy'];
const RUNE_NAME: Record<Rune, string> = { flame: '焰紋', edge: '鋒紋', heavy: '重紋' };
const runeKey = (r: Rune): string => `e:mgl:${r}`;
/** `golem_eternal_forge`: the lasting effect that stops casting from clearing the runes */
const ETERNAL = 'golem_eternal_forge';

const isGolem = (b: Battle, id: SideId): boolean => b.active(id).species.id === GOLEM;
export const hasRune = (b: Battle, id: SideId, r: Rune): boolean => isGolem(b, id) && !!b.active(id).vars[runeKey(r)];
export const runeCount = (b: Battle, id: SideId): number => RUNES.filter((r) => hasRune(b, id, r)).length;

/** Forges in runes (ones already present are not duplicated) */
function forge(b: Battle, id: SideId, ...rs: Rune[]): void {
  const c = b.active(id);
  if (!isGolem(b, id) || c.fainted) return;
  const added = rs.filter((r) => !c.vars[runeKey(r)]);
  if (!added.length) return;
  for (const r of added) c.vars[runeKey(r)] = 1;
  b.text(`${c.name} 鍛入了${added.map((r) => `「${RUNE_NAME[r]}」`).join('')}！`);
}

/** After casting: clears the runes (kept during `golem_eternal_forge`) */
function spendRunes(b: Battle, id: SideId): void {
  if (!isGolem(b, id) || !runeCount(b, id)) return;
  if (b.getLasting(id, ETERNAL)) {
    b.text('永燃熔爐：紋沒有冷卻！');
    return;
  }
  for (const r of RUNES) delete b.active(id).vars[runeKey(r)];
}

/** AI: the opponent's most painful hit this turn (estimated) could already knock us out -> no time to forge slowly */
function inDanger(b: Battle, id: SideId): boolean {
  const f = b.foe(id);
  let best = 0;
  for (const s of b.active(f).skills) if (isAttack(getSkill(s)) && b.canUse(f, s).ok) best = Math.max(best, b.estimate(f, s));
  return best >= b.active(id).hp;
}

/** AI: score of a casting attack (the more runes, the more it wants to cast) */
function castScore(b: Battle, id: SideId, base: number): number {
  // Heavy Rune: when the opponent has a shield or can still guard, this hit lands for sure (the AI's estimate cannot see shields or guards)
  const f = b.foe(id);
  const sure = hasRune(b, id, 'heavy') && (!!b.active(f).shield || b.canGuard(f).ok) ? 20 : 0;
  if (base >= KO_SCORE) return sure;
  const n = runeCount(b, id);
  const eternal = b.getLasting(id, ETERNAL) ? 25 : 0;
  if (n === 0) return inDanger(b, id) ? 0 : eternal - 35;
  return eternal + sure + 12 * n + (hasRune(b, id, 'edge') ? 25 : 0);
}

/** Hooks shared by casting attacks: Edge Rune always crits, Heavy Rune ignores guard, Flame Rune burns after hitting, cleared after use */
function casting(power?: SkillHooks['power']): SkillHooks {
  return {
    power,
    critBonus: (b, c) => (hasRune(b, c.attacker, 'edge') ? 1 : 0),
    pierceGuard: (b, id) => hasRune(b, id, 'heavy'),
    afterAttack: (b, c) => {
      if (hasRune(b, c.attacker, 'flame') && !b.active(c.defender).fainted) b.applyStatus(c.defender, 'burn');
    },
    afterUse: (b, id) => spendRunes(b, id),
    aiScore: castScore,
  };
}

/** AI: a status skill that forges in a rune (do not forge one already present; go first when about to be knocked out) */
const forgeScore = (r: Rune, want: number) => (b: Battle, id: SideId): number =>
  hasRune(b, id, r) ? -70 : inDanger(b, id) ? -50 : want + 8 * runeCount(b, id);

const GOLEM_FX: Record<string, SkillHooks> = {
  golem_forge_fist: {
    // `golem_forge_fist`: forges in the Flame Rune
    afterUse: (b, id) => forge(b, id, 'flame'),
    aiScore: (b, id) => (hasRune(b, id, 'flame') ? 0 : 15),
  },
  golem_quench: {
    // `golem_quench`: forges in the Edge Rune (ATK +1 is resolved by tags)
    effect: (b, id) => forge(b, id, 'edge'),
    aiScore: (b, id) => {
      if (hasRune(b, id, 'edge')) return b.active(id).stages.atk >= 2 ? -80 : -30;
      return inDanger(b, id) ? -50 : 30 + 8 * runeCount(b, id);
    },
  },
  golem_cast_strike: casting(),
  golem_anvil_stance: {
    // `golem_anvil_stance`: forges in the Heavy Rune (the shield is resolved by tags)
    effect: (b, id) => forge(b, id, 'heavy'),
    aiScore: forgeScore('heavy', 22),
  },
  golem_magma_mend: {
    // `golem_magma_mend`: heals 30% (tag) and forges in the Flame Rune
    effect: (b, id) => forge(b, id, 'flame'),
    aiScore: (b, id) => {
      const c = b.active(id);
      const missing = 1 - c.hp / c.maxHp;
      return (missing < 0.3 ? -40 : 0) + (hasRune(b, id, 'flame') ? 0 : 10);
    },
  },
  golem_lava_hammer: {
    // `golem_lava_hammer`: forges in the Heavy Rune
    afterUse: (b, id) => forge(b, id, 'heavy'),
    aiScore: (b, id) => (hasRune(b, id, 'heavy') ? 0 : 15),
  },
  // `golem_thousand_hammers`: +25 per rune
  golem_thousand_hammers: casting((b, c, p) => p + 25 * runeCount(b, c.attacker)),
  golem_lava_pit: {
    // `golem_lava_pit`: reduces the opponent's physical hit by 40% and forges in all three runes
    trap: {
      on: 'foeAttack',
      when: (_b, _owner, ev) => ev.ctx.cat === 'physical',
      fire: (b, owner) => {
        b.text('熔岩陷坑：衝擊落在滾燙的鐵砧上！');
        forge(b, owner, 'flame', 'edge', 'heavy');
        return { reduce: 0.4 };
      },
    },
    aiScore: (b, id) => {
      const d = b.active(b.foe(id));
      return d.stats.atk >= d.stats.mag ? 30 : -40;
    },
  },
  golem_trample: {
    aiScore: (b, id) => (b.side(b.foe(id)).trap ? 60 : -25),
  },
  golem_eternal_forge: {
    // `golem_eternal_forge`: for 3 turns casting does not clear the runes, and forges in the Flame Rune
    effect: (b, id) => {
      b.addLasting(id, ETERNAL, 3);
      forge(b, id, 'flame');
    },
    lasting: { name: '永燃熔爐' },
    aiScore: (b, id) => (b.getLasting(id, ETERNAL) ? -100 : inDanger(b, id) ? -50 : runeCount(b, id) >= 2 ? 45 : 5),
  },
  u_magma_golem: {
    ...casting(),
    // `u_magma_golem`: after casting, forges in all three runes (without clearing first)
    afterUse: (b, id) => forge(b, id, 'flame', 'edge', 'heavy'),
    aiScore: (b, id, base) => castScore(b, id, base) + (b.getLasting(id, ETERNAL) ? 30 : 10),
  },
};

const GOLEM_KIT: KitHooks = {
  // Trait "Magma Body": when hit by a physical attack, 30% to burn the attacker; always burns while a Flame Rune is on
  onHitTaken(b, a) {
    if (a.cat !== 'physical') return;
    const f = b.active(a.attacker);
    if (f.fainted || f.status.burn || f.elements.includes('fire')) return;
    if (!hasRune(b, a.defender, 'flame') && b.rng() >= 0.3) return;
    b.traitEvent(a.defender, '熔岩之軀');
    b.applyStatus(a.attacker, 'burn');
  },
  marks(b, id): MarkView[] {
    const on = RUNES.filter((r) => hasRune(b, id, r)).map((r) => RUNE_NAME[r][0]);
    return on.length ? [{ id: 'kit:rune', n: on.length, note: `鍛紋：${on.join('・')}` }] : [];
  },
};

// ═════════════════════════ `phoenix`: Embers ═════════════════════════
// - Self-burn skills: after use, first gain Embers, then burn HP (burning to death is the moment of Rebirth, which uses the Embers just gained).
// - Rebirth (the rewritten trait): the first time it is knocked out, if it has Embers, it burns them all to revive (10% HP each) and clears status conditions;
//   the reborn chick is "Newborn": it acts last next turn (guard is unaffected). With no Embers, or when cursed, there is no Rebirth.
// - `phoenix_cinder_wing` (power scales with Embers) and `phoenix_ember_nova` / `phoenix_ember_veil` (spend Embers): cashing in weakens Rebirth.
// - After the ultimate `u_phoenix` hits: +2 Embers; if Rebirth is already used -> it is lit again.
// Embers and Rebirth are kept under keys without e: (kept for the whole battle, not lost on switching).

const PHX = 'phoenix';
const EMBER = 'phx:ember';
/** 1 = Rebirth has been used */
const REBORN = 'phx:reborn';
/** Newborn: the turn after Rebirth (stores the turn number), last in action order */
const NEWBORN = 'phx:newborn';
const EMBER_MAX = 5;
/** Rebirth: % HP restored per Ember */
const REBIRTH_PER = 10;

const isPhoenix = (b: Battle, id: SideId): boolean => b.active(id).species.id === PHX;
export const embersOf = (b: Battle, id: SideId): number => (isPhoenix(b, id) ? Math.max(0, Math.min(EMBER_MAX, b.active(id).vars[EMBER] ?? 0)) : 0);
export const rebornUsed = (b: Battle, id: SideId): boolean => !!b.active(id).vars[REBORN];

function addEmbers(b: Battle, id: SideId, n: number): void {
  const c = b.active(id);
  if (!isPhoenix(b, id) || c.fainted) return;
  const next = Math.min(EMBER_MAX, embersOf(b, id) + n);
  if (next === embersOf(b, id)) return;
  c.vars[EMBER] = next;
  b.text(`${c.name} 的餘燼：${next} 點`);
}

/** HP cost of self-burn (% of max HP) */
const burnCost = (b: Battle, id: SideId, pct: number): number => Math.floor((b.active(id).maxHp * pct) / 100);

/** Self-burn skill: gains n Embers and loses pct% HP after use; cannot be used once Rebirth is spent and HP is too low */
function selfBurn(pct: number, n: number): SkillHooks {
  return {
    canUse: (b, id) => (isPhoenix(b, id) && rebornUsed(b, id) && b.active(id).hp <= burnCost(b, id, pct) ? '生命不足，無法焚身' : null),
    afterUse: (b, id) => {
      const c = b.active(id);
      addEmbers(b, id, n);
      b.text(`${c.name} 焚身！`);
      b.damage(id, burnCost(b, id, pct), 'selfburn');
    },
    aiScore: (b, id, base) => {
      if (base >= KO_SCORE) return 0;
      const c = b.active(id);
      const after = (c.hp - burnCost(b, id, pct)) / c.maxHp;
      // Before Rebirth: Embers are the fuel for Rebirth (the first one matters most), and burning close to death is fine; after Rebirth is used: do not burn yourself to the danger line
      if (!rebornUsed(b, id)) return embersOf(b, id) === 0 ? 25 : 6 * n;
      return after < 0.25 ? -45 : 0;
    },
  };
}

const PHOENIX_FX: Record<string, SkillHooks> = {
  phoenix_burning_plume: selfBurn(5, 1),
  phoenix_holy_pyre: selfBurn(5, 1),
  phoenix_skyfire: selfBurn(10, 2),
  phoenix_soul_kindle: {
    ...selfBurn(10, 2),
    aiScore: (b, id) => {
      if (rebornUsed(b, id)) return -60;
      const ae = b.side(id).aether;
      return ae <= 2 ? 25 : ae >= 5 ? -50 : -10;
    },
  },
  rebirth_flame: {
    aiScore: (b, id) => {
      const c = b.active(id);
      const missing = 1 - c.hp / c.maxHp;
      // Before Rebirth there is no hurry to heal (a faint will revive it anyway); only after Rebirth is used does healing truly save it
      return (missing < 0.35 ? -50 : 0) + (rebornUsed(b, id) ? 25 : -15) + (Object.keys(c.status).length ? 10 : 0);
    },
  },
  phoenix_cinder_wing: {
    // `phoenix_cinder_wing`: +15 per Ember (not consumed)
    power: (b, c, p) => p + 15 * embersOf(b, c.attacker),
  },
  phoenix_dawn_wing: {
    effect: (b, id) => addEmbers(b, id, 1),
    aiScore: (b, id) => (b.active(id).stages.mag >= 2 ? -60 : 10),
  },
  phoenix_ash_pact: {
    // `phoenix_ash_pact`: after our spirit is knocked out, the opponent takes 15% damage and is burned
    trap: {
      on: 'fainted',
      when: (b, owner) => !b.active(b.foe(owner)).fainted,
      fire: (b, owner) => {
        const f = b.foe(owner);
        b.text('灰燼之約：倒下的火焰纏上了對手！');
        b.trueDamage(f, 15, 'trap');
        if (!b.active(f).fainted) b.applyStatus(f, 'burn');
      },
    },
    aiScore: (b, id) => (b.aliveBench(id).length > 0 ? 20 : -30),
  },
  phoenix_ember_veil: {
    // `phoenix_ember_veil`: spends all Embers, 12% shield per Ember
    canUse: (b, id) => (embersOf(b, id) > 0 ? null : '沒有餘燼'),
    effect: (b, id) => {
      const n = embersOf(b, id);
      b.active(id).vars[EMBER] = 0;
      b.giveShield(id, 12 * n);
    },
    aiScore: (b, id) => {
      const n = embersOf(b, id);
      const c = b.active(id);
      if (!rebornUsed(b, id)) return -40;
      return n >= 2 && c.hp * 2 < c.maxHp ? 10 * n : -30;
    },
  },
  phoenix_ember_nova: {
    // `phoenix_ember_nova`: spends all Embers, +40 per Ember (consumed on use, even if guarded)
    power: (b, c, p) => p + 40 * embersOf(b, c.attacker),
    afterUse: (b, id) => {
      if (isPhoenix(b, id)) b.active(id).vars[EMBER] = 0;
    },
    aiScore: (b, id, base) => {
      if (base >= KO_SCORE) return 0;
      const n = embersOf(b, id);
      // Before Rebirth, Embers are Rebirth's fuel (using them all means no revival); only cash them in after Rebirth
      return rebornUsed(b, id) ? 10 * n - 20 : -60;
    },
  },
  u_phoenix: {
    // `u_phoenix`: +2 Embers after hitting; if Rebirth is already used -> it is lit again
    afterAttack: (b, c) => {
      const id = c.attacker;
      if (!isPhoenix(b, id)) return;
      addEmbers(b, id, 2);
      if (rebornUsed(b, id)) {
        delete b.active(id).vars[REBORN];
        b.traitEvent(id, '不滅之焰');
        b.text('涅槃之火再次點燃！');
      }
    },
    aiScore: (b, id, base) => (rebornUsed(b, id) ? 60 : base >= KO_SCORE ? 20 : 0),
  },
};

const PHOENIX_KIT: KitHooks = {
  // Newborn: the freshly reborn chick is sluggish and acts last on the turn after Rebirth (guard is unaffected)
  priorityBonus(b, id, sk) {
    return sk.id !== GUARD_ID && b.active(id).vars[NEWBORN] === b.s.turn ? -3 : 0;
  },
  // Trait "Rebirth": the first time it is knocked out, if it has Embers, it burns them all to revive (10% each) and clears status conditions; acts last next turn
  hpTrigger(b, id) {
    const c = b.active(id);
    const n = embersOf(b, id);
    if (c.hp > 0 || c.vars[REBORN] || n === 0) return;
    // Curse blocks healing, and also blocks Rebirth (the dark element's answer; `rebirth_flame` can lift the curse first)
    if (c.status.curse) {
      b.text(`詛咒纏身，${c.name} 無法涅槃……`);
      return;
    }
    c.vars[REBORN] = 1;
    c.vars[NEWBORN] = b.s.turn + 1;
    c.vars[EMBER] = 0;
    b.traitEvent(id, '涅槃');
    b.text(`${n} 點餘燼燃盡，${c.name} 從灰燼中重生！`);
    c.status = {};
    c.hp = Math.max(1, Math.floor((c.maxHp * REBIRTH_PER * n) / 100));
    b.healEvent(id, c.hp);
  },
  marks(b, id): MarkView[] {
    const n = embersOf(b, id);
    // The mark is shown between turns: the next turn is the Newborn turn
    const newborn = b.active(id).vars[NEWBORN] === b.s.turn + 1;
    const c = b.active(id);
    const ready = n === 0 ? '涅槃・缺餘燼' : c.status.curse ? '涅槃・被詛咒封住' : '涅槃';
    const out: MarkView[] = [{ id: 'kit:rebirth', note: rebornUsed(b, id) ? (newborn ? '新生・最後行動' : '涅槃已用') : ready }];
    if (n > 0) out.unshift({ id: 'kit:ember', n, note: '餘燼' });
    return out;
  },
};

// ═════════════════════════ `pyre_dragoon`: Momentum ═════════════════════════
// `pyre_dragoon`'s positive SPD stage is its "Momentum" (no separate counter; the mark shows it directly): the faster it runs, the sooner it strikes.
// - Building: `pyre_dragoon_tail_dash`, `pyre_dragoon_red_scale` (+1), `pyre_dragoon_dance` (+2), trait "Dragoon's Heart" (+1 the first time HP <= 50%, once per battle).
// - Charge: `pyre_dragoon_charge` (+25 per stage) and `pyre_dragoon_crimson_charge` (+30 per stage; Momentum is kept when it knocks out the opponent) spend all positive SPD stages after use.
// - Ultimate `u_pyre_dragoon`: +20 per stage, not consumed.

const PYD = 'pyre_dragoon';
/** `pyre_dragoon_crimson_charge` knocked out the opponent this turn (stores the turn number): Momentum is kept */
const BREAKTHROUGH = 'e:pyd:ko';
/** Dragoon's Heart has been kindled (once per battle, not reset on leaving) */
const HEART = 'pyd:heart';
/** Momentum cap (the SPD stage cap) */
const MOMENTUM_MAX = 4;
/** Power per stage of Momentum: `pyre_dragoon_charge`, `pyre_dragoon_crimson_charge`, `u_pyre_dragoon` (matches the descriptions in fire.json) */
const CHARGE_PER = 25;
const CRIMSON_PER = 30;
const DRAGONBLADE_PER = 20;
/** SPD boost of Dragoon's Heart */
const HEART_SPD = 1;

const isDragoon = (b: Battle, id: SideId): boolean => b.active(id).species.id === PYD;
/** Current Momentum (the positive SPD stage; 0 when the spirit is not `pyre_dragoon`) */
export const momentumOf = (b: Battle, id: SideId): number => (isDragoon(b, id) ? Math.max(0, b.active(id).stages.spd) : 0);

/** AI: score of a charge (build Momentum first when there is none; the more Momentum, the more it wants to charge; when `pyre_dragoon_crimson_charge` can KO, keep charging with the Momentum) */
function chargeScore(keepOnKo: boolean) {
  return (b: Battle, id: SideId, base: number): number => {
    const n = momentumOf(b, id);
    if (base >= KO_SCORE) return keepOnKo && n > 0 ? 15 : 0;
    if (n === 0) return inDanger(b, id) ? 0 : -30;
    return n >= 2 ? 10 : 0;
  };
}

/** Hooks shared by charges: power per stage of Momentum, spends all Momentum after use (keepOnKo: kept when the opponent is knocked out) */
function charge(per: number, keepOnKo: boolean): SkillHooks {
  return {
    power: (b, c, p) => p + per * momentumOf(b, c.attacker),
    afterAttack: keepOnKo
      ? (b, c, res) => {
          if (res.ko) b.active(c.attacker).vars[BREAKTHROUGH] = b.s.turn;
        }
      : undefined,
    afterUse: (b, id) => {
      const n = momentumOf(b, id);
      if (n === 0) return;
      const c = b.active(id);
      if (keepOnKo && c.vars[BREAKTHROUGH] === b.s.turn) {
        b.text(`突破！${c.name} 的衝勢沒有停下來！`);
        return;
      }
      b.text(`${c.name} 把 ${n} 階衝勢全部打了出去！`);
      b.changeStage(id, 'spd', -n);
    },
    aiScore: chargeScore(keepOnKo),
  };
}

/** AI: status skills that build Momentum (do not build more when Momentum is already enough or when about to be knocked out) */
const buildScore = (gain: number) => (b: Battle, id: SideId): number => {
  const n = momentumOf(b, id);
  if (n + gain > MOMENTUM_MAX) return -60;
  if (inDanger(b, id)) return -40;
  return n >= 2 ? -25 : 0;
};

const DRAGOON_FX: Record<string, SkillHooks> = {
  // `pyre_dragoon_tail_dash`: SPD +1 is resolved by tags
  pyre_dragoon_tail_dash: {
    aiScore: (b, id) => (momentumOf(b, id) >= MOMENTUM_MAX ? -20 : 8),
  },
  pyre_dragoon_charge: charge(CHARGE_PER, false),
  pyre_dragoon_red_scale: {
    // `pyre_dragoon_red_scale`: 25% shield and SPD +1 are resolved by tags (the AI cannot see the shield, so the score is added here)
    aiScore: (b, id) => {
      const c = b.active(id);
      if (c.shield) return -60;
      return (momentumOf(b, id) >= MOMENTUM_MAX ? -30 : 0) + (c.hp < c.maxHp * 0.6 ? 10 : 0);
    },
  },
  // `pyre_dragoon_pursuit`: if the opponent switches, acts first at power x2 before it leaves
  pyre_dragoon_pursuit: { pursuit: 2 },
  pyre_dragoon_dance: {
    // `pyre_dragoon_dance`: ATK +1 and SPD +2 are resolved by tags
    aiScore: buildScore(2),
  },
  pyre_dragoon_crimson_charge: charge(CRIMSON_PER, true),
  u_pyre_dragoon: {
    // `u_pyre_dragoon`: +20 per stage of Momentum (not consumed); ignoring guard and shields is resolved by tags
    power: (b, c, p) => p + DRAGONBLADE_PER * momentumOf(b, c.attacker),
  },
};

const DRAGOON_KIT: KitHooks = {
  // Trait "Dragoon's Heart": the first time HP drops below 50%, SPD +1 stage (once per battle)
  hpTrigger(b, id) {
    const c = b.active(id);
    if (c.hp <= 0 || c.hp * 2 > c.maxHp || c.vars[HEART]) return;
    c.vars[HEART] = 1;
    b.traitEvent(id, '龍騎之心');
    b.changeStage(id, 'spd', HEART_SPD);
  },
  marks(b, id): MarkView[] {
    const n = momentumOf(b, id);
    return n > 0 ? [{ id: 'kit:momentum', n, note: '衝勢' }] : [];
  },
};

// ═════════════════════════ `steameel`: Vaporize ═════════════════════════
// Fire skills leave "Residual Heat" and water skills leave "Moisture" (only the latest kind is kept; e: key, dissipates on leaving).
// - Tracking: at the end of the turn (KIT.onEndTurn), if a skill was used this turn (usedSinceEnter increased), the state is left according to the element of the last skill.
// - Vaporize: using an exclusive attack while holding the opposite element's state -> power x1.3 and burns after hitting; the state dissipates after use (no new one is left this turn).
// - `steameel_boiling_vortex`: after hitting, swaps the state to Residual Heat and immediately follows up with `steameel_steam_jet` (power x0.5, always vaporizes).
// - Ultimate `u_steameel`: always vaporizes.
// - Trait "Steam Rise": SPD x1.5 under Blazing Sun and Downpour; vaporizing attacks are not weakened by these two fields (KIT.attackBonus restores the x0.7).

const STM = 'steameel';
/** Current state: 1 Residual Heat (fire), 2 Moisture (water) */
const VAPOR = 'e:stm:vapor';
/** Number of skills already seen at the end of the turn (compared with usedSinceEnter) */
const SEEN = 'e:stm:seen';
/** Vaporized this turn (stores the turn number): the state dissipates and no new one is left */
const VENTED = 'e:stm:vented';
const HEAT = 1;
const MIST = 2;
const VAPOR_NAME: Record<number, string> = { [HEAT]: '餘熱', [MIST]: '水氣' };
const VAPOR_MULT = 1.3;
const JET = 'steameel_steam_jet';
/** Follow-up multiplier of `steameel_boiling_vortex` */
const VORTEX_FOLLOW = 0.5;

const isSteameel = (b: Battle, id: SideId): boolean => b.active(id).species.id === STM;
/** Current state (0 none, 1 Residual Heat, 2 Moisture) */
export const vaporOf = (b: Battle, id: SideId): number => (isSteameel(b, id) ? (b.active(id).vars[VAPOR] ?? 0) : 0);

/** Whether a skill of this element would vaporize now (holding the opposite element's state) */
function primed(b: Battle, id: SideId, element: string): boolean {
  const v = vaporOf(b, id);
  return (v === HEAT && element === 'water') || (v === MIST && element === 'fire');
}

/** Exclusive attacks that vaporize; the ultimate `u_steameel` always vaporizes */
const STEAM_SKILLS = new Set([JET, 'steameel_magma_spout', 'scald_steam', 'steameel_magma_surge', 'steameel_boiling_vortex', 'u_steameel']);
const ALWAYS_STEAM = 'u_steameel';

/** Whether this hit is a vaporizing attack (used by the trait "Steam Rise") */
function vaporizing(b: Battle, id: SideId, sk: { id: string; element: string }): boolean {
  if (!isSteameel(b, id) || !STEAM_SKILLS.has(sk.id)) return false;
  return sk.id === ALWAYS_STEAM || primed(b, id, sk.element);
}

/** The state dissipates (no new one is left this turn) */
function vent(b: Battle, id: SideId): void {
  const c = b.active(id);
  delete c.vars[VAPOR];
  c.vars[VENTED] = b.s.turn;
}

/** AI: how many points the burn from vaporizing is worth */
function burnScore(b: Battle, id: SideId): number {
  const f = b.foe(id);
  return b.active(f).status.burn || b.statusBlocked(f, 'burn') ? 0 : 12;
}

/** Hooks shared by vaporizing attacks (el: the skill's element, for the AI; always: always vaporizes) */
function steaming(el: 'fire' | 'water', always = false): SkillHooks {
  const on = (b: Battle, id: SideId, element: string): boolean => always || primed(b, id, element);
  return {
    power: (b, c, p) => (on(b, c.attacker, c.sk.element) ? p * VAPOR_MULT : p),
    afterAttack: (b, c) => {
      if (on(b, c.attacker, c.sk.element) && !b.active(c.defender).fainted) b.applyStatus(c.defender, 'burn');
    },
    afterUse: (b, id, sk) => {
      if (on(b, id, sk.element)) vent(b, id);
    },
    // The power x1.3 is already in the estimate; the burn is added here
    aiScore: (b, id, base) => (base < KO_SCORE && on(b, id, el) ? burnScore(b, id) : 0),
  };
}

const STEAMEEL_FX: Record<string, SkillHooks> = {
  steameel_steam_jet: steaming('water'),
  steameel_magma_spout: steaming('fire'),
  scald_steam: steaming('water'),
  steameel_magma_surge: steaming('fire'),
  steameel_boiling_vortex: {
    ...steaming('fire'),
    // `steameel_boiling_vortex`: after hitting (its own vaporize resolves first), swaps to Residual Heat and follows up with `steameel_steam_jet` -> always vaporizes
    afterAttack: (b, c) => {
      const id = c.attacker;
      if (primed(b, id, 'fire') && !b.active(c.defender).fainted) b.applyStatus(c.defender, 'burn');
      if (b.active(c.defender).fainted) return;
      b.active(id).vars[VAPOR] = HEAT;
      b.followUp(id, JET, VORTEX_FOLLOW, '漩渦翻起滾燙的蒸汽！');
    },
    // The state always dissipates after use
    afterUse: (b, id) => vent(b, id),
    aiScore: (b, id, base) => {
      if (base >= KO_SCORE) return 0;
      const hp = Math.max(1, b.active(b.foe(id)).hp);
      // Estimate of the follow-up: `steameel_steam_jet` x0.5, always vaporizes (if the current state would already make it vaporize, first divide out that x1.3)
      const jet = (b.estimate(id, JET) / (primed(b, id, 'water') ? VAPOR_MULT : 1)) * VAPOR_MULT * VORTEX_FOLLOW;
      const now = Math.min(100, base);
      const total = now + (jet / hp) * 100;
      return Math.min(100, total) - now + (total >= 100 ? 50 : 0) + burnScore(b, id);
    },
  },
  steameel_scald_fog: {
    // `steameel_scald_fog`: reduces the opponent's hit by 40% and burns the attacker after the attack resolves
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => {
        const f = b.foe(owner);
        b.text('燙霧：滾燙的白霧裹住了攻擊者！');
        return {
          reduce: 0.4,
          after: () => {
            if (!b.active(f).fainted) b.applyStatus(f, 'burn');
          },
        };
      },
    },
  },
  u_steameel: steaming('water', true),
};

const STEAMEEL_KIT: KitHooks = {
  // First step of Vaporize: if a skill was used this turn, leaves Residual Heat / Moisture according to the last skill's element (none on a turn it vaporized)
  onEndTurn(b, id) {
    const c = b.active(id);
    if (c.usedSinceEnter <= (c.vars[SEEN] ?? 0)) return;
    c.vars[SEEN] = c.usedSinceEnter;
    if (c.vars[VENTED] === b.s.turn) return;
    const el = c.lastSkill ? getSkill(c.lastSkill).element : null;
    const next = el === 'fire' ? HEAT : el === 'water' ? MIST : 0;
    if (!next) {
      delete c.vars[VAPOR];
      return;
    }
    if (c.vars[VAPOR] !== next) b.text(`${c.name} 身上留下了「${VAPOR_NAME[next]}」。`);
    c.vars[VAPOR] = next;
  },
  // Trait "Steam Rise": vaporizing attacks are not weakened by Blazing Sun or Downpour (restores the x0.7)
  attackBonus(b, a) {
    const f = b.s.field?.element;
    const weakened = (f === 'water' && a.sk.element === 'fire') || (f === 'fire' && a.sk.element === 'water');
    return weakened && vaporizing(b, a.attacker, a.sk) ? 1 / 0.7 - 1 : 0;
  },
  // Trait "Steam Rise": SPD x1.5 under Blazing Sun or Downpour
  statMult(b, _id, key) {
    const f = b.s.field?.element;
    return key === 'spd' && (f === 'fire' || f === 'water') ? 1.5 : 1;
  },
  marks(b, id): MarkView[] {
    const v = vaporOf(b, id);
    return v ? [{ id: 'kit:vapor', note: VAPOR_NAME[v] }] : [];
  },
};

// ═════════════════════════ `pyrewing`: Scale Dust ═════════════════════════
// Scale dust is recorded on the opponent (e: key, dissipates when the opponent leaves); the mark is shown on `pyrewing`.
// - Scattering: `pyrewing_dust`, `pyrewing_moth_swarm` (per hit), `pyrewing_dust_cloud`, `pyrewing_dust_trap`, trait "Fire Scale Dust" (the attacker gets 1 stack when it hits with a physical attack).
// - Igniting: `pyrewing_ignite` (6% per stack) and `pyrewing_wildfire` (9% per stack) spend all the dust to deal a percentage of the opponent's max HP, and also burn if there was dust.
// - Ultimate `u_pyrewing`: after hitting, fills up to 3 stacks and ignites immediately (6% per stack).

const PYW = 'pyrewing';
/** Stacks of scale dust on the opponent */
const DUST = 'e:pyw:dust';
const DUST_MAX = 3;

/** Stacks of scale dust on the opponent (the side opposite id) */
export function dustOn(b: Battle, id: SideId): number {
  const d = b.active(b.foe(id));
  return d.fainted ? 0 : Math.max(0, Math.min(DUST_MAX, d.vars[DUST] ?? 0));
}

/** Scattering: the opponent of the id side gets n stacks of scale dust */
function scatter(b: Battle, id: SideId, n: number): void {
  const d = b.active(b.foe(id));
  if (d.fainted || n <= 0) return;
  const before = dustOn(b, id);
  const v = Math.min(DUST_MAX, before + n);
  if (v === before) return;
  d.vars[DUST] = v;
  b.text(`${d.name} 身上的「鱗粉」：${v} 層`);
}

/** Igniting: spends all the dust on the opponent, pct% max HP damage per stack, and burns if there was dust */
function kindleDust(b: Battle, id: SideId, pct: number): void {
  const f = b.foe(id);
  const n = dustOn(b, id);
  if (n === 0) return;
  delete b.active(f).vars[DUST];
  b.text(`點燃！${n} 層鱗粉一起燒了起來！`);
  b.trueDamage(f, pct * n, 'dust');
  if (!b.active(f).fainted) b.applyStatus(f, 'burn');
}

/** AI: score of igniting (the estimate cannot see percentage damage or the burn, so it is added here; scatter dust first when there is none) */
function igniteScore(pct: number) {
  return (b: Battle, id: SideId, base: number): number => {
    if (base >= KO_SCORE) return 0;
    const n = dustOn(b, id);
    if (n === 0) return -35;
    const d = b.active(b.foe(id));
    const now = Math.min(100, base);
    const total = now + ((d.maxHp * pct * n) / 100 / Math.max(1, d.hp)) * 100;
    return Math.min(100, total) - now + (total >= 100 ? 50 : 0) + burnScore(b, id) + (n >= 2 ? 10 : 0);
  };
}

/** Hooks shared by igniting attacks */
function igniting(pct: number): SkillHooks {
  return {
    afterAttack: (b, c) => {
      if (!b.active(c.defender).fainted) kindleDust(b, c.attacker, pct);
    },
    aiScore: igniteScore(pct),
  };
}

/** AI: dust-scattering skills (do not scatter more when the dust is full) */
const dustScore = (gain: number) => (b: Battle, id: SideId): number => {
  const n = dustOn(b, id);
  if (n >= DUST_MAX) return -30;
  return n + gain >= 2 ? 12 : 6;
};

const PYREWING_FX: Record<string, SkillHooks> = {
  pyrewing_dust: {
    // `pyrewing_dust`: 1 stack of dust after hitting
    afterAttack: (b, c) => scatter(b, c.attacker, 1),
    aiScore: dustScore(1),
  },
  pyrewing_ignite: igniting(6),
  pyrewing_dust_cloud: {
    // `pyrewing_dust_cloud`: 2 stacks of dust (MAG +1 is resolved by tags)
    effect: (b, id) => scatter(b, id, 2),
    aiScore: (b, id) => (dustOn(b, id) >= 2 ? -40 : 10),
  },
  pyrewing_dust_trap: {
    // `pyrewing_dust_trap`: reduces the opponent's hit by 30%, and the attacker gets 2 stacks of dust
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => {
        b.text('粉塵陷阱：翅膀一振，鱗粉撲滿了攻擊者！');
        scatter(b, owner, 2);
        return { reduce: 0.3 };
      },
    },
  },
  pyrewing_moth_swarm: {
    // `pyrewing_moth_swarm`: 1 stack of dust per hit
    onHit: (b, c) => {
      if (!c.estimate) scatter(b, c.attacker, 1);
    },
    aiScore: dustScore(2),
  },
  pyrewing_wildfire: igniting(9),
  u_pyrewing: {
    // `u_pyrewing`: after hitting, fills up to 3 stacks and ignites (6% per stack)
    afterAttack: (b, c) => {
      if (b.active(c.defender).fainted) return;
      scatter(b, c.attacker, DUST_MAX);
      kindleDust(b, c.attacker, 6);
    },
  },
};

const PYREWING_KIT: KitHooks = {
  // Trait "Fire Scale Dust": when hit by a physical attack, the attacker gets 1 stack of dust
  onHitTaken(b, a) {
    if (a.cat !== 'physical' || b.active(a.attacker).fainted) return;
    b.traitEvent(a.defender, '火鱗粉');
    scatter(b, a.defender, 1);
  },
  marks(b, id): MarkView[] {
    const n = dustOn(b, id);
    return n > 0 ? [{ id: 'kit:dust', n, note: '對手的鱗粉' }] : [];
  },
};

// ═════════════════════════ `bellowsbeast`: Kindling ═════════════════════════
// Kindling is a switch (e: key, goes out on leaving). While lit, the next fire attack "Flares Up": damage +50% (KIT.attackBonus).
// - Lighting: `bellowsbeast_bellows`, `bellowsbeast_coal_roll` (when not flaring up), `bellowsbeast_ash_mend`, `bellowsbeast_backfire` (trap), trait "Ignite" (when hit by a fire attack).
// - Going out: at the end of the turn, if a fire attack was used after lighting, it goes out (the usedSinceEnter at lighting time is recorded to tell the order).
// - `bellowsbeast_furnace_burst`: x4/3 more when flaring up (+100% in total); ultimate `u_bellowsbeast`: always flares up and does not consume the Kindling.
// - Trait "Ignite": lights the Kindling after taking a fire attack (KIT.onHitTaken). The old "absorb fire" made it fully immune to fire, which hard-countered `ignisar`, and was removed.

const BLW = 'bellowsbeast';
const SPARK = 'e:blw:spark';
/** usedSinceEnter when the Kindling was lit (only fire attacks used after that burn it out) */
const SPARK_AT = 'e:blw:sparkAt';
const SPARK_BONUS = 0.5;
const U_BLW = 'u_bellowsbeast';

const isBellows = (b: Battle, id: SideId): boolean => b.active(id).species.id === BLW;
/** The Kindling is lit */
export const sparkLit = (b: Battle, id: SideId): boolean => isBellows(b, id) && !!b.active(id).vars[SPARK];
/** The Kindling that was already lit before this action (this hit is a flare-up) */
function blazedNow(b: Battle, id: SideId): boolean {
  const c = b.active(id);
  return sparkLit(b, id) && (c.vars[SPARK_AT] ?? 0) < c.usedSinceEnter;
}

/** Lights the Kindling */
function lightSpark(b: Battle, id: SideId): void {
  const c = b.active(id);
  if (!isBellows(b, id) || c.fainted) return;
  const was = !!c.vars[SPARK];
  c.vars[SPARK] = 1;
  c.vars[SPARK_AT] = c.usedSinceEnter;
  if (!was) b.text(`${c.name} 的「火種」點燃了！`);
}

/** AI: skills that light the Kindling (do not light it again if already lit) */
const sparkScore = (b: Battle, id: SideId): number => (sparkLit(b, id) ? -45 : inDanger(b, id) ? -20 : 15);

const BELLOWS_FX: Record<string, SkillHooks> = {
  bellowsbeast_bellows: {
    // `bellowsbeast_bellows`: lights the Kindling (ATK +1 is resolved by tags)
    effect: (b, id) => lightSpark(b, id),
    aiScore: sparkScore,
  },
  bellowsbeast_coal_roll: {
    // `bellowsbeast_coal_roll`: lights the Kindling after hitting; does not light it when this hit is itself a flare-up
    afterAttack: (b, c) => {
      if (!blazedNow(b, c.attacker)) lightSpark(b, c.attacker);
    },
    aiScore: (b, id) => (sparkLit(b, id) ? 0 : 12),
  },
  forge_hammer: {
    // `forge_hammer`: burns after hitting when flaring up (overrides the old "x2 when Ignite")
    afterAttack: (b, c) => {
      if (blazedNow(b, c.attacker) && !b.active(c.defender).fainted) b.applyStatus(c.defender, 'burn');
    },
    aiScore: (b, id, base) => (base < KO_SCORE && sparkLit(b, id) ? burnScore(b, id) : 0),
  },
  bellowsbeast_backfire: {
    // `bellowsbeast_backfire`: reduces the opponent's hit by 30% and lights the Kindling
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => {
        b.text('回火：衝進來的力道被吸進了爐裡！');
        lightSpark(b, owner);
        return { reduce: 0.3 };
      },
    },
  },
  bellowsbeast_furnace_burst: {
    // `bellowsbeast_furnace_burst`: x4/3 more when flaring up (+100% in total), burns after hitting
    power: (b, c, p) => (sparkLit(b, c.attacker) ? (p * (1 + 2 * SPARK_BONUS)) / (1 + SPARK_BONUS) : p),
    afterAttack: (b, c) => {
      if (blazedNow(b, c.attacker) && !b.active(c.defender).fainted) b.applyStatus(c.defender, 'burn');
    },
    aiScore: (b, id, base) => (base >= KO_SCORE ? 0 : sparkLit(b, id) ? 20 : -25),
  },
  bellowsbeast_ash_mend: {
    // `bellowsbeast_ash_mend`: heals 30% (tag) and lights the Kindling
    effect: (b, id) => lightSpark(b, id),
    aiScore: (b, id) => {
      const c = b.active(id);
      return (c.hp > c.maxHp * 0.7 ? -40 : 0) + (sparkLit(b, id) ? 0 : 10);
    },
  },
};

const BELLOWS_KIT: KitHooks = {
  // Flare-up: fire attacks +50% while the Kindling is lit; the ultimate always flares up
  attackBonus(b, a) {
    if (!isBellows(b, a.attacker)) return 0;
    if (a.sk.id === U_BLW) return SPARK_BONUS;
    return sparkLit(b, a.attacker) && a.sk.element === 'fire' ? SPARK_BONUS : 0;
  },
  // Trait "Ignite": lights the Kindling after taking a fire attack
  onHitTaken(b, a) {
    if (a.sk.element !== 'fire') return;
    b.traitEvent(a.defender, '引火');
    lightSpark(b, a.defender);
  },
  // A fire attack (the ultimate excepted) used after lighting -> the Kindling goes out
  onEndTurn(b, id) {
    const c = b.active(id);
    if (!c.vars[SPARK] || c.usedSinceEnter <= (c.vars[SPARK_AT] ?? 0) || !c.lastSkill || c.lastSkill === U_BLW) return;
    const sk = getSkill(c.lastSkill);
    if (!isAttack(sk) || sk.element !== 'fire') return;
    delete c.vars[SPARK];
    delete c.vars[SPARK_AT];
  },
  marks(b, id): MarkView[] {
    return sparkLit(b, id) ? [{ id: 'kit:spark', note: '火種' }] : [];
  },
};

// ═════════════════════════ `shieldbeetle`: Hold ═════════════════════════
// Hold 0 to 3 (e: key, resets to zero on leaving): +1 at the end of a turn where it guards or uses a status skill and makes no attack; a successful guard (trait "Knight's Shield") and `shieldbeetle_shield_wall` give +1 immediately.
// - Each stack lowers the damage of attacks taken by 12% (KIT.incoming).
// - Breach: `shield_bash` (+35 per stack), `shieldbeetle_iron_charge` (+40), `shieldbeetle_crimson_lance` (+40, ignores guard and shields at 3 stacks), ultimate `u_shieldbeetle` (+40, 25% shield after hitting).

const SHB = 'shieldbeetle';
const HOLD = 'e:shb:hold';
/** Number of skills already seen at the end of the turn (compared with usedSinceEnter) */
const HOLD_SEEN = 'e:shb:seen';
const HOLD_MAX = 3;
const HOLD_CUT = 0.12;
/** Power per stack of Hold: `shield_bash`, `shieldbeetle_iron_charge`, `shieldbeetle_crimson_lance`, `u_shieldbeetle` (matches the descriptions in fire.json) */
const BASH_PER = 35;
const CHARGE_HOLD_PER = 40;
const LANCE_PER = 40;
const SIEGE_PER = 40;

const isBeetle = (b: Battle, id: SideId): boolean => b.active(id).species.id === SHB;
/** Current stacks of Hold */
export const holdOf = (b: Battle, id: SideId): number => (isBeetle(b, id) ? Math.max(0, Math.min(HOLD_MAX, b.active(id).vars[HOLD] ?? 0)) : 0);

function addHold(b: Battle, id: SideId, n: number): void {
  const c = b.active(id);
  if (!isBeetle(b, id) || c.fainted) return;
  const before = holdOf(b, id);
  const v = Math.min(HOLD_MAX, before + n);
  if (v === before) return;
  c.vars[HOLD] = v;
  b.text(`${c.name} 的「固守」：${v} 層`);
}

/** AI: score of Breach (guard first when there is no Hold; the more stacks, the more it wants to charge) */
function breachScore(b: Battle, id: SideId, base: number): number {
  if (base >= KO_SCORE) return 0;
  const n = holdOf(b, id);
  if (n === 0) return inDanger(b, id) ? 0 : -30;
  return n >= 2 ? 15 : 0;
}

/** Hooks shared by Breach attacks */
function breach(per: number, pierceFull = false): SkillHooks {
  return {
    power: (b, c, p) => p + per * holdOf(b, c.attacker),
    pierceGuard: pierceFull ? (b, id) => holdOf(b, id) >= HOLD_MAX : undefined,
    afterUse: (b, id) => {
      const n = holdOf(b, id);
      if (n === 0) return;
      delete b.active(id).vars[HOLD];
      b.text(`破陣！${n} 層固守一口氣衝了出去！`);
    },
    aiScore: breachScore,
  };
}

/** AI: guarding status skills (once Hold is full, it should Breach) */
const guardScore = (b: Battle, id: SideId): number => (holdOf(b, id) >= HOLD_MAX ? -30 : inDanger(b, id) ? -10 : 10);

const BEETLE_FX: Record<string, SkillHooks> = {
  // `shieldbeetle_raise`, `shieldbeetle_heat_shell`, `shieldbeetle_oath`: effects are resolved by tags; a turn without an attack gives Hold +1 (KIT.onEndTurn)
  shieldbeetle_raise: { aiScore: (b, id) => (b.active(id).shield ? -40 : guardScore(b, id)) },
  shieldbeetle_heat_shell: { aiScore: guardScore },
  shieldbeetle_oath: { aiScore: guardScore },
  shield_bash: breach(BASH_PER),
  shieldbeetle_shield_wall: {
    // `shieldbeetle_shield_wall`: reduces the opponent's hit by 50% and Hold +1
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => {
        b.text('盾牆：赤鐵的盾面擋下了衝擊！');
        addHold(b, owner, 1);
        return { reduce: 0.5 };
      },
    },
  },
  shieldbeetle_iron_charge: breach(CHARGE_HOLD_PER),
  shieldbeetle_crimson_lance: breach(LANCE_PER, true),
  // `u_shieldbeetle`: Breach (+40 per stack); the 25% shield after hitting is resolved by tags
  u_shieldbeetle: breach(SIEGE_PER),
};

const BEETLE_KIT: KitHooks = {
  // Hold: +1 at the end of a turn where it guards or uses a status skill and makes no attack
  onEndTurn(b, id) {
    const c = b.active(id);
    const used = c.usedSinceEnter > (c.vars[HOLD_SEEN] ?? 0);
    c.vars[HOLD_SEEN] = c.usedSinceEnter;
    const guarded = c.lastGuardTurn === b.s.turn;
    if ((used || guarded) && !c.usedAttackThisTurn) addHold(b, id, 1);
  },
  // Each stack of Hold: attack damage taken -12%
  incoming(b, a, dmg) {
    const n = holdOf(b, a.defender);
    return n > 0 ? Math.floor(dmg * (1 - HOLD_CUT * n)) : dmg;
  },
  // Trait "Knight's Shield": Hold +1 on a successful guard (plus the +1 at the end of the turn, +2 in total on a guard turn)
  onGuarded(b, id) {
    b.traitEvent(id, '騎士之盾');
    addHold(b, id, 1);
  },
  marks(b, id): MarkView[] {
    const n = holdOf(b, id);
    return n > 0 ? [{ id: 'kit:hold', n, note: '固守' }] : [];
  },
};

// ═════════════════════════ Exports ═════════════════════════

/** Skill id -> skill hooks */
export const FX: Record<string, SkillHooks> = {
  ...IGNISAR_FX,
  ...GOLEM_FX,
  ...PHOENIX_FX,
  ...DRAGOON_FX,
  ...STEAMEEL_FX,
  ...PYREWING_FX,
  ...BELLOWS_FX,
  ...BEETLE_FX,
};

/** Spirit id -> kit hooks (signature mechanics, rewritten traits, state marks) */
export const KIT: Record<string, KitHooks> = {
  ignisar: IGNISAR_KIT,
  magma_golem: GOLEM_KIT,
  phoenix: PHOENIX_KIT,
  pyre_dragoon: DRAGOON_KIT,
  steameel: STEAMEEL_KIT,
  pyrewing: PYREWING_KIT,
  bellowsbeast: BELLOWS_KIT,
  shieldbeetle: BEETLE_KIT,
};
