// Skill hooks and kit hooks for the wind group (data/kits/wind.json). See docs/10-kit-authoring.md for how to write them.
// Only `import type { Battle }` is allowed (importing battle.ts at runtime would create a circular dependency).

import { getSkill } from '../../data.ts';
import type { Battle } from '../battle.ts';
import { getVar, type AttackResult, type HitCtx, type KitHooks, type SkillHooks } from '../skillfx.ts';
import type { SideId } from '../types.ts';

// ───────────────────────── `aeroth`: Sky Altitude ─────────────────────────
// Altitude 0 to 3 (e: key, resets to zero on leaving).
// - Airborne: with altitude, attacks that land after its own action this turn do -15% damage per stack of altitude (KIT.incoming).
// - Shot Down: hit before it has acted this turn, altitude resets to zero (KIT.onHitTaken); `aeroth_empyrean` and `aeroth_headwind` can block this.
// - Sky Fall: each stack of altitude raises power, and altitude resets to zero after hitting (`aeroth_stoop`, `aeroth_cloudsplit`, `u_aeroth`).
// - Trait "Sky Sovereign" (rewritten): on entering, sets Gale for 3 turns; knocking out the opponent with a Sky Fall does not spend altitude.
// - Circling: when `aeroth_circling` switches out, the altitude is stored in aer:circle and restored on the next entry.

const ALT = 'e:aer:alt';
const ALT_MAX = 3;
/** Airborne: damage reduction per stack of altitude */
const ALT_GUARD = 0.15;
/** `aeroth_headwind`: it cannot be Shot Down this turn (value = turn number) */
const WARD = 'e:aer:ward';
/** The Airborne hint is shown only once per turn (value = turn number) */
const DODGED = 'e:aer:dodged';
/** `aeroth_circling`: keep the altitude on this leave */
const CIRCLING = 'e:aer:circling';
/** Altitude kept while circling (not an e: key, it survives leaving and is taken back on entering) */
const CIRCLE = 'aer:circle';
const EMPYREAN = 'aeroth_empyrean';

const altOf = (b: Battle, id: SideId): number => getVar(b, id, ALT);

/** Altitude rises (max 3) */
function rise(b: Battle, id: SideId, n: number): void {
  const c = b.active(id);
  if (c.fainted || c.hp <= 0) return;
  const before = altOf(b, id);
  const after = Math.min(ALT_MAX, before + n);
  if (after === before) return;
  c.vars[ALT] = after;
  b.text(`${c.name} 乘風爬升，高度 ${after}！`);
}

/** The cost of a Sky Fall: altitude resets to zero (kept during `aeroth_empyrean`, or when a Sky Fall knocks out the opponent) */
function landDive(b: Battle, ctx: HitCtx, res: AttackResult): void {
  const id = ctx.attacker;
  if (altOf(b, id) <= 0 || b.getLasting(id, EMPYREAN)) return;
  if (res.ko) {
    b.traitEvent(id, '天穹主宰');
    return;
  }
  b.active(id).vars[ALT] = 0;
}

/** Sky Fall skill: +per power per stack of altitude, and altitude resets to zero after hitting */
function dive(per: number): Pick<SkillHooks, 'power' | 'afterAttack'> {
  return {
    power: (b, c, p) => p + per * altOf(b, c.attacker),
    afterAttack: landDive,
  };
}

/** The opponent may strike before the eagle (it is faster, or carries a decent priority attack): the AI uses this to judge whether it will be Shot Down */
function foeMayStrikeFirst(b: Battle, id: SideId): boolean {
  const f = b.foe(id);
  const foe = b.active(f);
  if (foe.fainted) return false;
  if (b.effStat(foe, 'spd', f) > b.effStat(b.active(id), 'spd', id)) return true;
  return foe.skills.some((s) => {
    const sk = getSkill(s);
    return (sk.category === 'physical' || sk.category === 'magic') && (sk.priority >= 2 || (sk.priority > 0 && sk.power >= 60));
  });
}

/** Estimate of the biggest damage the opponent can deal now (AI: whether it would be knocked out first if it climbed one more turn) */
function foeBestHit(b: Battle, id: SideId): number {
  const f = b.foe(id);
  const foe = b.active(f);
  const list = [...foe.skills, ...(foe.ultimate && !b.side(f).ultUsed ? [foe.ultimate] : [])];
  let best = 0;
  for (const s of list) if (b.canUse(f, s).ok) best = Math.max(best, b.estimate(f, s));
  return best;
}

/**
 * AI: the higher the altitude, the more it wants a Sky Fall; while it can still climb safely, climb to 3 first and then strike.
 * No waiting when it can KO (base already includes +60), the opponent cannot guard this turn, it would be Shot Down first, or it is about to faint.
 */
function diveScore(b: Battle, id: SideId, base: number): number {
  const a = altOf(b, id);
  const me = b.active(id);
  const noGuard = !b.canGuard(b.foe(id)).ok;
  const safe = noGuard ? 10 : 0;
  if (base >= 150) return 10 + safe;
  if (a > 0 && b.getLasting(id, EMPYREAN)) return 25 + safe;
  if (a >= ALT_MAX) return 25 + safe;
  if (noGuard && a >= 1) return 20;
  const hurry = foeMayStrikeFirst(b, id) || me.hp < me.maxHp * 0.35 || me.hp <= foeBestHit(b, id) * 1.3 * (1 - ALT_GUARD * Math.min(ALT_MAX, a + 1));
  if (hurry) return a === 2 ? 10 : -10;
  return a === 2 ? -45 : -60;
}

// ───────────────────────── `gale_weasel`: Triple Sickle Chain ─────────────────────────
// Chain 0 to 2 (e: key, resets to zero on leaving): 1 = just hit with a [Trip], 2 = then hit with a [Slash].
// - [Trip] hit: the opponent is "Off-Balance" (its guard fails next turn), chain = 1.
// - [Slash]: always crits at chain 1; after hitting chain = 2, otherwise it resets to zero.
// - [Salve]: at chain 2, "Triple Sickle Union" follows up once with the [Slash] just used, then the chain resets to zero (`gale_weasel_tri_salve` goes back to 1).
// - When the three forms miss, are guarded or come out of order, the chain resets to zero; other skills and guard do not affect the chain.
// - The chain advances only after the skill fully resolves (afterUse), so the crit check looks at the chain from before the use.
// - Trait "Ambush Weasel" (rewritten): a [Slash] at chain 1 does +20% damage (KIT.attackBonus); on entering by switch or replacement (battle start does not count), the chain goes straight to [Trip].

const CHAIN = 'e:gw:chain';
/** This use landed (recorded in afterAttack, read and cleared in afterUse) */
const LANDED = 'e:gw:landed';
/** The [Slash] that last landed: index in SLASHES + 1 (used by Triple Sickle Union and the ultimate; kept after leaving) */
const LAST_SLASH = 'gw:slash';
const SLASHES = ['gale_weasel_slash', 'gale_weasel_chase', 'gale_weasel_rend', 'gale_weasel_whirl'];
/** Trait "Ambush Weasel": damage bonus for a [Slash] that follows a [Trip] */
const CHAIN_BONUS = 0.2;
/** The "Off-Balance" lasting effect is attached to `gale_weasel_trip` */
const OFF_BALANCE = 'gale_weasel_trip';
type Form = 'trip' | 'slash' | 'salve';

const chainOf = (b: Battle, id: SideId): number => getVar(b, id, CHAIN);

/** The opponent becomes "Off-Balance": its guard fails this turn and the next */
function unbalance(b: Battle, id: SideId): void {
  const f = b.foe(id);
  const d = b.active(f);
  if (d.fainted || d.hp <= 0) return;
  b.addLasting(f, OFF_BALANCE, 2, { from: id });
  b.text(`${d.name} 被絆倒，失去了平衡！`);
}

/** Triple Sickle Union: follows up once with the last [Slash] */
function trinity(b: Battle, id: SideId): void {
  const sk = SLASHES[(b.active(id).vars[LAST_SLASH] ?? 1) - 1] ?? SLASHES[0];
  b.followUp(id, sk, 1, '三鐮合一！');
}

/** Shared by the three forms: recorded on hit, and the chain advances or breaks after full resolution */
function form(kind: Form): Pick<SkillHooks, 'afterAttack' | 'afterUse'> {
  return {
    afterAttack: (b, c) => {
      if (c.followUp) return;
      b.active(c.attacker).vars[LANDED] = 1;
    },
    afterUse: (b, id, sk) => {
      const c = b.active(id);
      const landed = sk.category === 'status' || c.vars[LANDED] === 1;
      delete c.vars[LANDED];
      const prev = chainOf(b, id);
      if (kind === 'trip') {
        c.vars[CHAIN] = landed ? 1 : 0;
        if (landed) unbalance(b, id);
      } else if (kind === 'slash') {
        if (landed) c.vars[LAST_SLASH] = SLASHES.indexOf(sk.id) + 1;
        c.vars[CHAIN] = landed && prev === 1 ? 2 : 0;
        // `gale_weasel_rend`: when it hits during a chain, always inflicts bleed for 5 turns (wind element does not bleed: the tag already showed "No effect", so it is not repeated)
        const f = b.foe(id);
        const d = b.active(f);
        if (sk.id === 'gale_weasel_rend' && landed && prev === 1 && !d.fainted && !d.elements.includes('wind')) {
          if (!d.status.bleed) b.applyStatus(f, 'bleed');
          const bleed = b.active(f).status.bleed;
          if (bleed) bleed.turns = Math.max(bleed.turns, 5);
        }
      } else {
        c.vars[CHAIN] = 0;
        if (!landed || prev !== 2) return;
        trinity(b, id);
        // `gale_weasel_tri_salve`: the chain goes back to [Trip]
        if (sk.id === 'gale_weasel_tri_salve' && !b.active(id).fainted) {
          b.active(id).vars[CHAIN] = 1;
          unbalance(b, id);
        }
      }
    },
  };
}

/** [Slash]: always crits at chain 1 (follow-ups do not count) */
const slashCrit = (b: Battle, c: HitCtx): number => (!c.followUp && chainOf(b, c.attacker) === 1 ? 1 : 0);

/** AI: use [Trip] when the chain is at zero; not when already tripped or when it is time to apply a salve */
function tripScore(b: Battle, id: SideId): number {
  const n = chainOf(b, id);
  return n === 0 ? 25 : n === 1 ? -25 : -35;
}

/** AI: use [Slash] after tripping; apply a salve first when it is time. Attack as usual when it can KO */
function slashScore(b: Battle, id: SideId, base: number): number {
  if (base >= 150) return 10;
  const n = chainOf(b, id);
  return n === 1 ? 35 : n === 2 ? -30 : -10;
}

/** AI: use [Salve] at chain 2; otherwise only when healing is needed */
function salveScore(b: Battle, id: SideId, bonus: number, heals: boolean): number {
  if (chainOf(b, id) === 2) return bonus;
  const c = b.active(id);
  if (heals) return c.hp < c.maxHp * 0.4 ? 5 : -45;
  return -10;
}

// ───────────────────────── `tornado`: Storm Ring ─────────────────────────
// Storm Ring 0 to 3 (e: key, resets to zero on leaving); each level gives `tornado` attacks +10% damage (KIT.attackBonus).
// - While active, at the end of every turn: each bench spirit of the opponent takes Storm Ring x 2% (leaving at least 1 HP; with no bench, the active spirit instead), then Storm Ring +1 (KIT.onEndTurn).
// - When an opponent's spirit enters, it takes Storm Ring x 4% (KIT.onFoeEnter, a new hook); trait "Eye of the Gale" (rewritten): Storm Ring +1 afterwards, and +1 on entering as well.
// - `whirl_in`: pulls the bench spirit with the lowest HP ratio onto the field with b.forceSwitch(opponent, chosen index) (root, Coiled Roots and so on still block it as usual).
// - No Place to Hide: when the opponent has no bench, the damage aimed at the bench (end of turn, `tornado_squall`, `tornado_collapse`, `u_tornado`) hits the active spirit instead;
//   `whirl_in` instead deals the entry damage (Storm Ring x 4%) to the active spirit. The Storm Ring matters only in duels and endgames.

const STORM = 'e:tor:storm';
const STORM_MAX = 3;
/** Each level of Storm Ring gives `tornado` attacks +10% damage */
const STORM_AURA = 0.1;
/** `whirl_in` hit (recorded in afterAttack, the switch happens in afterUse: no switching spirits in the middle of attack resolution) */
const PULL = 'e:tor:pull';

const stormOf = (b: Battle, id: SideId): number => getVar(b, id, STORM);

function setStorm(b: Battle, id: SideId, n: number, why?: string): void {
  const c = b.active(id);
  if (c.fainted) return;
  const before = stormOf(b, id);
  const after = Math.max(0, Math.min(STORM_MAX, n));
  if (after === before) return;
  c.vars[STORM] = after;
  if (why) b.text(`${why}暴風圈 ${after} 級！`);
}

/** The opponent's bench spirits take pct% of max HP damage (they cannot faint from it); returns how many took damage */
function hitBench(b: Battle, id: SideId, pct: number): number {
  if (pct <= 0) return 0;
  const sd = b.side(b.foe(id));
  let n = 0;
  sd.team.forEach((m, i) => {
    if (i === sd.active || m.fainted || m.hp <= 1) return;
    m.hp = Math.max(1, m.hp - Math.floor((m.maxHp * pct) / 100));
    n++;
  });
  return n;
}

/** Gust: when the opponent has a bench, hits the bench (pct% each, they cannot faint from it); with no bench, hits the active spirit instead; returns whether anything was hit */
function gust(b: Battle, id: SideId, pct: number, benchText: string, soloText: string): boolean {
  if (pct <= 0) return false;
  const f = b.foe(id);
  if (b.aliveBench(f).length === 0) {
    if (b.active(f).fainted) return false;
    b.text(soloText);
    b.trueDamage(f, pct, 'storm');
    return true;
  }
  if (hitBench(b, id, pct) === 0) return false;
  b.text(benchText);
  return true;
}

/** The opponent's bench spirit with the lowest HP ratio (undefined when there is none) */
function weakestBench(b: Battle, id: SideId): number | undefined {
  const f = b.foe(id);
  const team = b.side(f).team;
  let best: number | undefined;
  for (const i of b.aliveBench(f)) if (best === undefined || team[i].hp / team[i].maxHp < team[best].hp / team[best].maxHp) best = i;
  return best;
}

/** `whirl_in`: pulls the opponent's lowest-HP-ratio bench spirit onto the field (with no bench, the active spirit takes the entry damage) */
function pullIn(b: Battle, id: SideId): void {
  const to = weakestBench(b, id);
  const f = b.foe(id);
  if (b.active(f).fainted || b.s.winner !== null) return;
  if (to === undefined) {
    const n = stormOf(b, id);
    if (n <= 0) return;
    b.text(`無處可躲，${b.active(f).name} 被捲進暴風圈（${n} 級）！`);
    b.trueDamage(f, 4 * n, 'storm');
    return;
  }
  const before = b.side(f).active;
  b.text(`暴風把 ${b.side(f).team[to].name} 捲了進來！`);
  b.forceSwitch(f, to);
  if (b.side(f).active === before) b.text('……但沒有被捲走。');
}

/** Whirl-in skills: recorded on hit, the switch happens after full resolution */
const pullHooks: Pick<SkillHooks, 'manual' | 'afterAttack' | 'afterUse'> = {
  manual: ['forceSwitch'],
  afterAttack: (b, c, r) => {
    if (!c.followUp && !r.decoyBlocked) b.active(c.attacker).vars[PULL] = 1;
  },
  afterUse: (b, id) => {
    const c = b.active(id);
    if (!c.vars[PULL]) return;
    delete c.vars[PULL];
    pullIn(b, id);
  },
};

/** AI: the value of a whirl-in (a bench exists, the bigger the Storm Ring, the more it wants it when the weakest bench spirit is badly hurt) */
function pullScore(b: Battle, id: SideId): number {
  const to = weakestBench(b, id);
  if (to === undefined) return 6 * stormOf(b, id) - 10;
  const m = b.side(b.foe(id)).team[to];
  const n = stormOf(b, id);
  return 5 + 8 * n + (m.hp / m.maxHp < 0.4 ? 15 : 0);
}

// ───────────────────────── `lyrebird`: Lingering Echo ─────────────────────────
// Lingering Echo (e: key, disappears on leaving) = the last [Song] sung (index in SONGS + 1).
// - The "tune" effect of a [Song] is resolved entirely by tune() (the tags are set to manual, the budget still counts them); Harmony rings it once more with the same function.
// - Harmony (`lyrebird_refrain`, `lyrebird_rondo`, `lyrebird_answer`: once; the ultimate: twice): on hit the Lingering Echo rings again, then it fades.
// - Trait "Heavenly Voice" (rewrites the old "Mimicry"): on Harmony, each of our bench spirits heals 8%.

const ECHO = 'e:lyr:echo';
const SONGS = ['lyrebird_trill', 'lyrebird_hymn', 'lyrebird_wingsong', 'lyrebird_lament', 'lyrebird_serenade', 'lyrebird_aria'];

const echoOf = (b: Battle, id: SideId): string | undefined => SONGS[getVar(b, id, ECHO) - 1];

/** Each of our bench spirits heals pct% (changes HP directly, same as the team-heal tag) */
function healBench(b: Battle, id: SideId, pct: number): void {
  const sd = b.side(id);
  sd.team.forEach((m, i) => {
    if (i !== sd.active && !m.fainted) m.hp = Math.min(m.maxHp, m.hp + Math.floor((m.maxHp * pct) / 100));
  });
}

/** The higher of the opponent's ATK and MAG (the target of `lyrebird_lament`'s weakening) */
const mainStat = (b: Battle, f: SideId): 'atk' | 'mag' => {
  const d = b.active(f);
  return d.stats.atk >= d.stats.mag ? 'atk' : 'mag';
};

/** The "tune" of a [Song]: used both when singing and when Harmony rings it again */
function tune(b: Battle, id: SideId, song: string): void {
  const f = b.foe(id);
  const foeUp = !b.active(f).fainted;
  switch (song) {
    case 'lyrebird_trill':
      if (foeUp) b.changeStage(f, 'spd', -1, true);
      break;
    case 'lyrebird_hymn':
      b.heal(id, 20);
      b.cleanse(id);
      break;
    case 'lyrebird_wingsong':
      b.changeStage(id, 'mag', 1);
      b.heal(id, 8);
      break;
    case 'lyrebird_lament':
      if (foeUp) b.changeStage(f, mainStat(b, f), -1, true);
      break;
    case 'lyrebird_serenade':
      b.heal(id, 8);
      healBench(b, id, 8);
      break;
    case 'lyrebird_aria':
      b.changeStage(id, 'mag', 1);
      b.heal(id, 10);
      break;
  }
}

/** Harmony: the Lingering Echo rings times more times, then fades; trait "Heavenly Voice": bench teammates heal 8% each */
function harmonize(b: Battle, id: SideId, times: number): void {
  const c = b.active(id);
  const song = echoOf(b, id);
  if (!song || c.fainted) return;
  delete c.vars[ECHO];
  b.text(`和聲！餘音「${getSkill(song).name}」再響${times > 1 ? ` ${times} 次` : '一次'}。`);
  for (let i = 0; i < times && !b.active(id).fainted; i++) tune(b, id, song);
  if (b.active(id).fainted || b.aliveBench(id).length === 0) return;
  b.traitEvent(id, '天籟');
  healBench(b, id, 8);
  b.text('歌聲傳到後備席，隊友各回復 8%。');
}

/** Hooks of a [Song]: the tune resolves when the attack hits or the status skill is used, and the Lingering Echo is left after full resolution */
function song(tags: string[]): Pick<SkillHooks, 'manual' | 'afterAttack' | 'effect' | 'afterUse'> {
  return {
    manual: tags,
    afterAttack: (b, c, r) => {
      if (c.followUp) return;
      // When a substitute blocks it, the tune that acts on the opponent is blocked too
      if (r.decoyBlocked && (c.sk.id === 'lyrebird_trill' || c.sk.id === 'lyrebird_lament')) return;
      tune(b, c.attacker, c.sk.id);
    },
    effect: (b, id, sk) => tune(b, id, sk.id),
    afterUse: (b, id, sk) => {
      const c = b.active(id);
      c.vars[ECHO] = SONGS.indexOf(sk.id) + 1;
    },
  };
}

/** Harmony skill: after hitting, the Lingering Echo rings times more times */
function harmony(times: number): Pick<SkillHooks, 'afterAttack'> {
  return {
    afterAttack: (b, c) => {
      if (!c.followUp) harmonize(b, c.attacker, times);
    },
  };
}

/** AI: how much the echo left by this song is worth (the value of ringing it again in Harmony) */
function echoValue(b: Battle, id: SideId, songId: string | undefined): number {
  if (!songId) return 0;
  const c = b.active(id);
  const hurt = 1 - c.hp / c.maxHp;
  const f = b.active(b.foe(id));
  switch (songId) {
    case 'lyrebird_hymn':
      return hurt > 0.35 || Object.keys(c.status).length > 0 ? 35 : 5;
    case 'lyrebird_wingsong':
      // When the opponent hits hard, do not first sing a pure-buff song (it would take a hit before the Harmony)
      return foeBestHit(b, id) >= c.hp * 0.35 ? -20 : (c.stages.mag < 2 ? 15 : 0) + (hurt > 0.2 ? 10 : 0);
    case 'lyrebird_aria':
      return (c.stages.mag < 4 ? 20 : 0) + (hurt > 0.2 ? 15 : 0);
    case 'lyrebird_lament':
      return f.stages[mainStat(b, b.foe(id))] > -3 ? 15 : 0;
    case 'lyrebird_trill':
      return f.stages.spd > -2 ? 10 : 0;
    case 'lyrebird_serenade':
      return hurt > 0.2 || b.aliveBench(id).length > 0 ? 15 : 5;
    default:
      return 0;
  }
}

/** AI: sing a [Song] when there is no Lingering Echo; when there is already a good one, use Harmony first */
function songScore(b: Battle, id: SideId, songId: string): number {
  const cur = echoOf(b, id);
  const own = echoValue(b, id, songId);
  if (!cur) return own;
  if (cur === songId) return -25;
  return own - echoValue(b, id, cur) - 10;
}

/** AI: use a Harmony skill when there is a Lingering Echo */
function harmonyScore(b: Battle, id: SideId, base: number, times: number): number {
  const cur = echoOf(b, id);
  if (!cur) return base >= 150 ? 0 : -25;
  return 10 + echoValue(b, id, cur) * times;
}

// ───────────────────────── `skyreign`: Triple Beat ─────────────────────────
// Beat 0 to 2 (e: key, resets to zero on leaving): each hit of a [Beat] skill gives +1; when the beat is 2, the hit that lands is the "Strong Beat" (the third beat):
// damage +50% (KIT.attackBonus, read when each hit's damage is computed), and it resets to zero afterwards. Hits that are guarded or land on a substitute do not call onHit and record no beat.
// - `skyreign_skyfall`: when it lands on the strong beat, the beat stays at the second beat (the next hit is still a strong beat). `u_skyreign`: every hit is a strong beat and does not affect the beat.
// - Trait "Ride the Wind" keeps the old behavior (SPD +1 on entering).

const BEAT = 'e:sky:beat';
const STRONG = 0.5;
const BEAT_SKILLS = new Set(['skyreign_peck', 'skyreign_swoop', 'skyreign_flurry', 'skyreign_dive', 'skyreign_flit', 'skyreign_falcon', 'skyreign_skyfall']);

const beatOf = (b: Battle, id: SideId): number => getVar(b, id, BEAT);
/** The next [Beat] hit is the strong beat */
const strongNext = (b: Battle, id: SideId): boolean => beatOf(b, id) === 2;

/** [Beat]: records a beat for each hit that lands, and the strong-beat hit resets it to zero after it is delivered; onStrong runs after a strong-beat hit */
function beat(onStrong?: (b: Battle, ctx: HitCtx, ko: boolean) => void): Pick<SkillHooks, 'onHit'> {
  return {
    onHit(b, ctx, hit) {
      const c = b.active(ctx.attacker);
      if (beatOf(b, ctx.attacker) < 2) {
        c.vars[BEAT] = beatOf(b, ctx.attacker) + 1;
        return;
      }
      c.vars[BEAT] = 0;
      b.text('強拍！');
      onStrong?.(b, ctx, hit.ko);
    },
  };
}

/** AI: a single heavy hit waits for the strong beat before striking; while the beat is early, use a quick peck to record a beat first (when it can KO, base is already high enough) */
function heavyBeatScore(b: Battle, id: SideId): number {
  if (strongNext(b, id)) return 15;
  return beatOf(b, id) === 0 ? -12 : -6;
}

// ───────────────────────── `dandelion`: Fluff Seeds ─────────────────────────
// Fluff Seeds: a lasting effect on the opponent's side (key = dandelion_drift, n = stacks 1 to 3, 5 turns; refreshed by sowing or sprouting).
// - At the end of every turn (the lasting hook on the opponent's active spirit), if the opponent has no leech seed, 1 stack sprouts: leech seed for 3 turns.
//   The leech seed is the engine's built-in one (loses 4% at the end of every turn, absorbed by our active spirit; cleared by leaving or a cleanse).
// - Trait "Carried Away by the Wind" (rewritten): on switching out, heals 20% and sows 1 stack of Fluff Seeds.

const SEEDS = 'dandelion_drift';
const SEED_MAX = 3;
const SEED_TURNS = 5;

/** Stacks of Fluff Seeds on the opponent's side (f) */
const seedsOn = (b: Battle, f: SideId): number => b.side(f).lasting.find((l) => l.key === SEEDS)?.n ?? 0;

/** [Sow]: sows n stacks of Fluff Seeds on the side of id's opponent (max 3 stacks, refreshes the turns) */
function sow(b: Battle, id: SideId, n: number): void {
  const f = b.foe(id);
  const next = Math.min(SEED_MAX, seedsOn(b, f) + n);
  b.addLasting(f, SEEDS, SEED_TURNS, { side: true, n: next, from: id });
  b.text(`絮種 ${next} 層。`);
}

/**
 * Sprout: when the active spirit on the opponent's side (f) has no leech seed, spends 1 stack of Fluff Seeds to give it a leech seed for 3 turns.
 * A leech seed ticks down last at the end of every turn: sprouting at the end of the turn must give 1 extra turn (atTurnEnd), sprouting during an action does not.
 */
function sprout(b: Battle, f: SideId, atTurnEnd: boolean): boolean {
  const c = b.active(f);
  const l = b.side(f).lasting.find((x) => x.key === SEEDS);
  if (!l || l.n <= 0 || c.fainted || c.leechSeed) return false;
  root(b, f, atTurnEnd);
  l.n--;
  if (l.n <= 0) b.removeLasting(f, SEEDS);
  else l.turns = Math.max(l.turns, SEED_TURNS);
  return true;
}

/** Gives f's active spirit a leech seed for 3 turns (unchanged if it already has one) */
function root(b: Battle, f: SideId, atTurnEnd: boolean): void {
  const c = b.active(f);
  if (c.fainted || c.leechSeed) return;
  c.leechSeed = { turns: atTurnEnd ? 4 : 3 };
  b.text(`絮種在 ${c.name} 身上發芽了，${c.name} 被「寄生」！`);
}

// ───────────────────────── `papercrane`: Letters ─────────────────────────
// Letters 0 to 3 (e: key): increased by [Write] skills. When `papercrane` switches out (KIT.onLeave) or faints (trait "Entrusted": 1 extra letter attached), it sends them:
// our side "Receives Letters" (key = papercrane_relay, n = number of letters, 4 = the turn of sending plus the next 3 turns), and the active spirit's attack damage gets +20% per letter.
// With no bench teammate, the letters are received by itself once 3 are written.

const LETTERS = 'e:pc:letters';
const LETTER_MAX = 3;
const POST = 'papercrane_relay';
const POST_BONUS = 0.2;
const POST_TURNS = 4;

const lettersOf = (b: Battle, id: SideId): number => getVar(b, id, LETTERS);

/** Sends n letters: our side receives them (if already receiving, takes the larger count and recounts the turns) */
function post(b: Battle, id: SideId, n: number): void {
  if (n <= 0) return;
  const cur = b.side(id).lasting.find((l) => l.key === POST)?.n ?? 0;
  b.addLasting(id, POST, POST_TURNS, { side: true, n: Math.max(cur, n), from: id });
}

/** [Write] n letters; with no bench teammate, it receives them itself once 3 are written */
function write(b: Battle, id: SideId, n: number): void {
  const c = b.active(id);
  if (c.fainted) return;
  const next = Math.min(LETTER_MAX, lettersOf(b, id) + n);
  c.vars[LETTERS] = next;
  b.text(`${c.name} 寫好了信（${next} 封）。`);
  if (next >= LETTER_MAX && b.aliveBench(id).length === 0) {
    b.text('沒有隊友可以收信，千羽鶴自己拆開了信。');
    c.vars[LETTERS] = 0;
    post(b, id, next);
  }
}

/** A [Write] attack: writes letters after hitting */
const writeOnHit = (n: number): Pick<SkillHooks, 'afterAttack'> => ({
  afterAttack(b, c) {
    if (!c.followUp) write(b, c.attacker, n);
  },
});

/** AI: wants to write letters while the letters are not yet full */
const writeScore = (b: Battle, id: SideId, n: number): number => {
  const left = LETTER_MAX - lettersOf(b, id);
  return left <= 0 ? -10 : 6 * Math.min(n, left);
};

/** Skill id -> skill hooks */
export const FX: Record<string, SkillHooks> = {
  aeroth_skim: {
    // `aeroth_skim`: altitude +1 after hitting
    afterAttack: (b, c) => rise(b, c.attacker, 1),
    aiScore: (b, id) => (altOf(b, id) < ALT_MAX ? 20 : -10),
  },
  aeroth_stoop: {
    // `aeroth_stoop`: Sky Fall, +40 per stack
    ...dive(40),
    aiScore: (b, id, base) => diveScore(b, id, base),
  },
  aeroth_updraft: {
    // `aeroth_updraft`: altitude +2 (SPD +1 is resolved by tags)
    effect: (b, id) => rise(b, id, 2),
    aiScore: (b, id) => {
      const a = altOf(b, id);
      return a <= 1 ? 30 : a === 2 ? -5 : -45;
    },
  },
  aeroth_turbulence: {
    // `aeroth_turbulence`: all the opponent's actions next turn get priority -3 (lasts 2 turns including this one; this turn's order is already set)
    afterAttack: (b, c, r) => {
      if (r.ko || r.decoyBlocked) return;
      b.addLasting(c.defender, 'aeroth_turbulence', 2, { from: c.attacker });
    },
    lasting: { name: '亂流', priority: () => -3 },
    aiScore: (b, id) => {
      if (b.getLasting(b.foe(id), 'aeroth_turbulence')) return -25;
      return altOf(b, id) >= 2 || foeMayStrikeFirst(b, id) ? 18 : 0;
    },
  },
  aeroth_plumes: {
    // `aeroth_plumes`: 2 + altitude hits (25 per hit), does not spend altitude
    hits: (b, c) => 2 + altOf(b, c.attacker),
  },
  aeroth_clear_sky: {
    // `aeroth_clear_sky`: destroying a trap is resolved by tags; here it also blows away the entry hazard on our side
    effect: (b, id) => {
      const sd = b.side(id);
      if (!sd.hazard) return;
      sd.hazard = null;
      b.text(`狂風吹散了 ${sd.name} 陣地的入場陷阱！`);
    },
    aiScore: (b, id) => (b.side(id).hazard ? 25 : 0),
  },
  aeroth_cloudsplit: {
    // `aeroth_cloudsplit`: +45 per stack; always crits at altitude 3
    ...dive(45),
    critBonus: (b, c) => (altOf(b, c.attacker) >= ALT_MAX ? 1 : 0),
    aiScore: (b, id, base) => diveScore(b, id, base) + (altOf(b, id) >= ALT_MAX ? 20 : 0),
  },
  aeroth_soar_strike: {
    // `aeroth_soar_strike`: altitude +2 after hitting
    afterAttack: (b, c) => rise(b, c.attacker, 2),
    aiScore: (b, id) => {
      const a = altOf(b, id);
      return a <= 1 ? 15 : a === 2 ? 0 : -15;
    },
  },
  aeroth_headwind: {
    // `aeroth_headwind`: fires when the eagle is attacked before it has acted: it cannot be Shot Down this turn, and after the attack resolves it counters with `aeroth_skim` x2
    trap: {
      on: 'foeAttack',
      when: (b, owner) => b.active(owner).species.id === 'aeroth' && !b.hasActed(owner),
      fire: (b, owner) => {
        const c = b.active(owner);
        c.vars[WARD] = b.s.turn;
        b.text(`${c.name} 迎著逆風展翼，沒有被擊落！`);
        return { after: () => b.followUp(owner, 'aeroth_skim', 2, '逆風擊！') };
      },
    },
    aiScore: (b, id) => (foeMayStrikeFirst(b, id) ? 45 : -20),
  },
  aeroth_circling: {
    // `aeroth_circling`: switch after attacking (tag); marks "Circling" before the switch, and KIT.onLeave keeps the altitude
    afterAttack: (b, c) => void (b.active(c.attacker).vars[CIRCLING] = 1),
    // When the switch did not happen (no bench, rooted), the mark is cancelled
    afterUse: (b, id) => void delete b.active(id).vars[CIRCLING],
    aiScore: (b, id) => (b.aliveBench(id).length > 0 && altOf(b, id) >= 2 && b.active(id).hp < b.active(id).maxHp * 0.5 ? 20 : 0),
  },
  aeroth_empyrean: {
    // `aeroth_empyrean`: for 3 turns it cannot be Shot Down and Sky Fall does not spend altitude (a turn-based effect, can be cleared)
    effect: (b, id) => void b.addLasting(id, EMPYREAN, 3),
    lasting: { name: '凌霄' },
    aiScore: (b, id) => (b.getLasting(id, EMPYREAN) ? -60 : altOf(b, id) >= 2 ? 40 : -20),
  },
  aeroth_sunpierce: {
    // `aeroth_sunpierce`: +20 per stack of altitude, not spent (ignoring guard is resolved by tags)
    power: (b, c, p) => p + 20 * altOf(b, c.attacker),
    aiScore: (b, id) => (altOf(b, id) >= ALT_MAX && b.canGuard(b.foe(id)).ok && b.side(b.foe(id)).aether >= 1 ? 10 : 0),
  },
  u_aeroth: {
    // `u_aeroth`: Sky Fall, +50 per stack (priority +2 and ignoring guard are resolved by tags)
    ...dive(50),
    aiScore: (b, id, base) => diveScore(b, id, base) + 10,
  },

  // ── `gale_weasel` ──
  gale_weasel_trip: {
    // `gale_weasel_trip` [Trip]: Off-Balance (guard fails this turn and the next)
    ...form('trip'),
    lasting: { name: '失衡', blockAction: (_b, _o, sk) => (sk.id === 'guard' ? '失去平衡，無法格擋' : null) },
    aiScore: (b, id) => tripScore(b, id),
  },
  gale_weasel_hook: {
    // `gale_weasel_hook` [Trip]: Off-Balance (SPD -1 is resolved by tags)
    ...form('trip'),
    aiScore: (b, id) => tripScore(b, id) + 5,
  },
  gale_weasel_slash: {
    // `gale_weasel_slash` [Slash]
    ...form('slash'),
    critBonus: slashCrit,
    aiScore: slashScore,
  },
  gale_weasel_chase: {
    // `gale_weasel_chase` [Slash]: follows up x2 when the opponent switches
    ...form('slash'),
    critBonus: slashCrit,
    pursuit: 2,
    aiScore: (b, id, base) => slashScore(b, id, base) - 5,
  },
  gale_weasel_rend: {
    // `gale_weasel_rend` [Slash]: 30% to bleed (tag); always bleeds for 5 turns during a chain (handled in form)
    ...form('slash'),
    critBonus: slashCrit,
    aiScore: (b, id, base) => slashScore(b, id, base) + 5,
  },
  gale_weasel_whirl: {
    // `gale_weasel_whirl` [Slash]: three hits, every hit crits during a chain
    ...form('slash'),
    critBonus: slashCrit,
    aiScore: slashScore,
  },
  gale_weasel_salve: {
    // `gale_weasel_salve` [Salve]: the heal is resolved by tags; at chain 2, Triple Sickle Union
    ...form('salve'),
    aiScore: (b, id) => salveScore(b, id, 45, true),
  },
  gale_weasel_blade_salve: {
    // `gale_weasel_blade_salve` [Salve]: an attacking salve (drain is resolved by tags)
    ...form('salve'),
    aiScore: (b, id) => salveScore(b, id, 40, false),
  },
  gale_weasel_tri_salve: {
    // `gale_weasel_tri_salve` [Salve]: the finished form of `gale_weasel_blade_salve`; after Triple Sickle Union the chain goes back to [Trip] and the opponent is Off-Balance
    ...form('salve'),
    aiScore: (b, id) => salveScore(b, id, 50, false),
  },
  gale_weasel_snare: {
    // `gale_weasel_snare` [Trip]: reduces damage by 40% and the attacker becomes Off-Balance; while `gale_weasel` is active the chain goes to [Trip]
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => ({
        reduce: 0.4,
        after: () => {
          unbalance(b, owner);
          const c = b.active(owner);
          if (c.species.id === 'gale_weasel' && !c.fainted) c.vars[CHAIN] = 1;
        },
      }),
    },
    aiScore: (b, id) => (chainOf(b, id) === 0 ? 20 : -10),
  },
  u_gale_weasel: {
    // `u_gale_weasel`: always crits (tag); after hitting, Triple Sickle Union (not one of the three forms, does not affect the chain)
    afterAttack: (b, c) => void (b.active(c.attacker).vars[LANDED] = 1),
    afterUse: (b, id) => {
      const c = b.active(id);
      const hit = c.vars[LANDED] === 1;
      delete c.vars[LANDED];
      if (hit) trinity(b, id);
    },
  },

  // ── `tornado` ──
  whirl_in: {
    // `whirl_in`: after hitting, pulls the bench spirit with the lowest HP ratio onto the field
    ...pullHooks,
    aiScore: (b, id) => pullScore(b, id),
  },
  tornado_maelstrom: {
    // `tornado_maelstrom`: Storm Ring becomes 3, then whirls in (the pulled spirit takes 12% entry damage)
    manual: ['forceSwitch'],
    afterAttack: (b, c, r) => {
      if (c.followUp) return;
      setStorm(b, c.attacker, STORM_MAX, '大漩渦成形，');
      if (!r.decoyBlocked) b.active(c.attacker).vars[PULL] = 1;
    },
    afterUse: pullHooks.afterUse,
    aiScore: (b, id) => (weakestBench(b, id) === undefined ? (stormOf(b, id) <= 1 ? 15 : 0) : pullScore(b, id) + 10),
  },
  tornado_squall: {
    // `tornado_squall`: after hitting, each bench spirit of the opponent takes Storm Ring x 3% (with no bench, the active spirit instead)
    afterAttack: (b, c) => {
      const n = stormOf(b, c.attacker);
      if (!c.followUp) gust(b, c.attacker, n * 3, `狂風颳過對手的後備精靈（各 −${n * 3}%）！`, `狂風直撲而來（−${n * 3}%）！`);
    },
    aiScore: (b, id) => {
      const bench = b.aliveBench(b.foe(id)).length;
      return bench === 0 ? stormOf(b, id) * 6 - 5 : bench * stormOf(b, id) * 5 - 5;
    },
  },
  tornado_lash: {
    // `tornado_lash`: power x2 when the opponent entered this turn or last turn (battle start does not count)
    power: (b, c, p) => {
      const d = b.active(c.defender);
      return d.enteredTurn > 0 && d.enteredTurn >= b.s.turn - 1 ? p * 2 : p;
    },
    aiScore: (b, id) => {
      const d = b.active(b.foe(id));
      return d.enteredTurn > 0 && d.enteredTurn >= b.s.turn - 1 ? 20 : -15;
    },
  },
  tornado_scatter: {
    // `tornado_scatter`: dispel buffs and clearing turns are resolved by tags; Storm Ring +1
    effect: (b, id) => setStorm(b, id, stormOf(b, id) + 1, '強風呼嘯，'),
    aiScore: (b, id) => {
      const f = b.foe(id);
      const ups = Object.values(b.active(f).stages).reduce((a, v) => a + Math.max(0, v), 0);
      const turns = b.lastingOf(f).filter(([l]) => l.from === f).length;
      return ups + turns === 0 ? -45 : 10 * ups + 25 * turns;
    },
  },
  tornado_calm_eye: {
    // `tornado_calm_eye`: the opponent's priority attacks have no effect, Storm Ring +2
    trap: {
      on: 'foeAttack',
      when: (b, owner) => b.active(b.foe(owner)).actPriority > 0,
      fire: (b, owner) => {
        const c = b.active(owner);
        b.text('颶風的中心一片寂靜，先制的攻擊撲了空！');
        if (c.species.id === 'tornado') setStorm(b, owner, stormOf(b, owner) + 2, '');
        return { negate: true };
      },
    },
    aiScore: (b, id) => {
      const f = b.foe(id);
      const foe = b.active(f);
      const quick = foe.skills.some((s) => {
        const sk = getSkill(s);
        return (sk.category === 'physical' || sk.category === 'magic') && (sk.priority > 0 || (b.s.field?.element === 'wind' && sk.element === 'wind'));
      });
      return quick ? 40 : -30;
    },
  },
  tornado_collapse: {
    // `tornado_collapse`: spends all the Storm Ring, 7% of the opponent's whole team per level (the bench cannot faint from it; with No Place to Hide, the bench's share hits the active spirit instead)
    afterAttack: (b, c, r) => {
      const id = c.attacker;
      const n = stormOf(b, id);
      if (c.followUp || n <= 0) return;
      b.active(id).vars[STORM] = 0;
      b.text(`暴風圈收束成一點，轟然炸開（${n} 級）！`);
      if (!r.ko && !b.active(c.defender).fainted) b.trueDamage(c.defender, 7 * n, 'storm');
      gust(b, id, 7 * n, `對手的後備精靈也被捲入（各 −${7 * n}%）！`, `無處可躲，爆風再次直擊（−${7 * n}%）！`);
    },
    aiScore: (b, id, base) => {
      const n = stormOf(b, id);
      if (base >= 150 && n > 0) return 10;
      return n >= STORM_MAX ? 30 + 8 * b.aliveBench(b.foe(id)).length : n === 2 ? -5 : -50;
    },
  },
  tornado_vortex: {
    // `tornado_vortex`: Storm Ring +1 after hitting
    afterAttack: (b, c) => setStorm(b, c.attacker, stormOf(b, c.attacker) + 1, '渦旋捲起，'),
    aiScore: (b, id) => (stormOf(b, id) < STORM_MAX ? 10 : -5),
  },
  tornado_courier: {
    // `tornado_courier`: switches with a bench spirit (handled here, so the Storm Ring can be read before leaving); the spirit that comes in gets a shield of Storm Ring x 10%
    manual: ['pivot'],
    effect: (b, id) => {
      const n = stormOf(b, id);
      if (!b.autoSwitch(id)) return;
      if (n > 0) {
        b.text('颶風把信託平安送達：');
        b.giveShield(id, 10 * n);
      }
    },
    aiScore: (b, id) => {
      const c = b.active(id);
      if (b.aliveBench(id).length === 0) return -80;
      return c.hp < c.maxHp * 0.35 && stormOf(b, id) >= 2 ? 25 : -40;
    },
  },
  tornado_eye_rest: {
    // `tornado_eye_rest`: the heal is resolved by tags; Storm Ring -1
    effect: (b, id) => setStorm(b, id, stormOf(b, id) - 1),
    aiScore: (b, id) => {
      const c = b.active(id);
      return c.hp < c.maxHp * 0.45 ? 25 : c.hp > c.maxHp * 0.75 ? -60 : -15;
    },
  },
  u_tornado: {
    // `u_tornado`: 20% to each bench spirit (they cannot faint from it; with no bench, the active spirit instead), Storm Ring becomes 3
    afterAttack: (b, c, r) => {
      if (c.followUp) return;
      if (!r.ko) gust(b, c.attacker, 20, '天災席捲了對手的後備精靈（各 −20%）！', '天災直撲而來（−20%）！');
      setStorm(b, c.attacker, STORM_MAX, '天災之眼睜開，');
    },
    aiScore: (b, id) => {
      const bench = b.aliveBench(b.foe(id)).length;
      return (bench === 0 ? 20 : 6 * bench) + (stormOf(b, id) <= 1 ? 10 : 0);
    },
  },

  // ── `lyrebird` ──
  lyrebird_trill: { ...song(['foe.spd']), aiScore: (b, id) => songScore(b, id, 'lyrebird_trill') },
  lyrebird_hymn: { ...song(['heal', 'cleanse']), aiScore: (b, id) => songScore(b, id, 'lyrebird_hymn') },
  lyrebird_wingsong: { ...song(['self.mag', 'heal']), aiScore: (b, id) => songScore(b, id, 'lyrebird_wingsong') },
  lyrebird_lament: { ...song(['foe.atk']), aiScore: (b, id) => songScore(b, id, 'lyrebird_lament') },
  lyrebird_serenade: { ...song(['teamHeal']), aiScore: (b, id) => songScore(b, id, 'lyrebird_serenade') },
  lyrebird_aria: { ...song(['self.mag', 'heal']), aiScore: (b, id) => songScore(b, id, 'lyrebird_aria') },
  lyrebird_refrain: { ...harmony(1), aiScore: (b, id, base) => harmonyScore(b, id, base, 1) },
  lyrebird_rondo: { ...harmony(1), aiScore: (b, id, base) => harmonyScore(b, id, base, 1) },
  lyrebird_answer: {
    // `lyrebird_answer`: reduces damage by 30%; Harmony once when the lyrebird is active (after the attack resolves)
    trap: {
      on: 'foeAttack',
      fire: (b, owner) => ({
        reduce: 0.3,
        after: () => {
          if (b.active(owner).species.id === 'lyrebird') harmonize(b, owner, 1);
        },
      }),
    },
    aiScore: (b, id) => (echoOf(b, id) ? 25 : -10),
  },
  u_lyrebird: {
    // `u_lyrebird`: the whole-team heal is resolved by tags; Harmony twice
    ...harmony(2),
    aiScore: (b, id) => (echoOf(b, id) ? 10 + echoValue(b, id, echoOf(b, id)) * 2 : -10),
  },

  // ── `skyreign` (the strong beat's damage bonus is in KIT.attackBonus) ──
  skyreign_peck: {
    ...beat(),
    // When the beat reaches the second beat, do not waste the strong beat on a quick peck
    aiScore: (b, id) => (strongNext(b, id) ? -10 : 8),
  },
  skyreign_swoop: {
    // `skyreign_swoop`: on the strong beat, the opponent's SPD -1
    ...beat((b, c, ko) => {
      if (!ko) b.changeStage(c.defender, 'spd', -1, true);
    }),
    aiScore: (b, id) => heavyBeatScore(b, id),
  },
  skyreign_ruffle: {
    // `skyreign_ruffle`: SPD +1 is resolved by tags; the beat jumps to the second beat
    effect: (b, id) => {
      b.active(id).vars[BEAT] = 2;
      b.text('拍子跳到第二拍：下一段〔拍〕是強拍！');
    },
    // Only worth it when the opponent is faster and we cannot be KO'd in one hit
    aiScore: (b, id) => {
      if (strongNext(b, id)) return -60;
      const c = b.active(id);
      if (foeBestHit(b, id) >= c.hp * 0.5) return -30;
      const f = b.foe(id);
      return b.effStat(b.active(f), 'spd', f) >= b.effStat(c, 'spd', id) ? 15 : -5;
    },
  },
  skyreign_flurry: {
    ...beat(),
    // `skyreign_flurry`: power +30 when the opponent has a shield or substitute
    power: (b, c, base) => {
      const d = b.active(c.defender);
      return d.shield || d.decoy > 0 ? base + 30 : base;
    },
  },
  skyreign_dive: { ...beat(), aiScore: (b, id) => heavyBeatScore(b, id) },
  skyreign_flit: {
    ...beat(),
    // `skyreign_flit`: the switch is resolved by tags (the cost: the beat resets to zero); retreat only when about to faint
    aiScore: (b, id) => {
      const c = b.active(id);
      return b.aliveBench(id).length > 0 && c.hp < c.maxHp * 0.4 ? 10 : -5;
    },
  },
  skyreign_falcon: { ...beat(), aiScore: (b, id) => heavyBeatScore(b, id) },
  skyreign_skyfall: {
    // `skyreign_skyfall`: when it lands on the strong beat, the beat stays at the second beat (the next [Beat] hit is still a strong beat)
    ...beat((b, c) => {
      b.active(c.attacker).vars[BEAT] = 2;
      b.text('拍子沒有停：下一段〔拍〕還是強拍！');
    }),
    aiScore: (b, id) => heavyBeatScore(b, id) + (strongNext(b, id) ? 10 : 0),
  },

  // ── `dandelion` ──
  dandelion_drift: {
    // `dandelion_drift`: sows 2 stacks, and sprouts immediately when the opponent has no leech seed (the Fluff Seeds themselves = a lasting effect keyed by this skill on the opponent's side)
    effect: (b, id) => {
      sow(b, id, 2);
      sprout(b, b.foe(id), false);
    },
    lasting: {
      name: '絮種',
      // End of turn: when the opponent's active spirit has no leech seed, 1 stack sprouts
      onTurnEnd: (b, owner) => {
        sprout(b, owner, true);
      },
    },
    aiScore: (b, id) => {
      const n = seedsOn(b, b.foe(id));
      return n >= SEED_MAX ? -60 : n === 2 ? -15 : b.active(b.foe(id)).leechSeed ? 10 : 35;
    },
  },
  dandelion_sow: {
    afterAttack: (b, c) => {
      if (!c.followUp) sow(b, c.attacker, 1);
    },
    aiScore: (b, id) => (seedsOn(b, b.foe(id)) < SEED_MAX ? 6 : -5),
  },
  // Opponent has a leech seed: power increased
  dandelion_puff: { power: (b, c, base) => (b.active(c.defender).leechSeed ? base + 20 : base) },
  dandelion_sap: { power: (b, c, base) => (b.active(c.defender).leechSeed ? base + 30 : base) },
  dandelion_bloom: { power: (b, c, base) => (b.active(c.defender).leechSeed ? base + 50 : base) },
  dandelion_web: {
    // `dandelion_web`: the spirit that enters gets a leech seed immediately, Fluff Seeds +1
    trap: {
      on: 'foeEnter',
      fire: (b, owner) => {
        root(b, b.foe(owner), false);
        sow(b, owner, 1);
      },
    },
    aiScore: (b, id) => (b.aliveBench(b.foe(id)).length > 0 ? 10 : -80),
  },
  dandelion_squall: {
    // `dandelion_squall`: sows 1 stack; sprouts immediately when the opponent has no leech seed (a substitute can block the sprouting)
    afterAttack: (b, c, r) => {
      if (c.followUp) return;
      sow(b, c.attacker, 1);
      if (!r.decoyBlocked && !r.ko) sprout(b, c.defender, false);
    },
    aiScore: (b, id) => (seedsOn(b, b.foe(id)) < SEED_MAX ? 6 : 0) + (b.active(b.foe(id)).leechSeed ? 0 : 8),
  },
  u_dandelion: {
    // `u_dandelion`: sows up to 3 stacks; sprouts immediately when the opponent has no leech seed
    afterAttack: (b, c, r) => {
      if (c.followUp) return;
      sow(b, c.attacker, SEED_MAX);
      if (!r.decoyBlocked && !r.ko) sprout(b, c.defender, false);
    },
  },

  // ── `papercrane` ──
  papercrane_cut: { ...writeOnHit(1), aiScore: (b, id) => writeScore(b, id, 1) },
  papercrane_gust: { ...writeOnHit(1), aiScore: (b, id) => writeScore(b, id, 1) },
  papercrane_thousand: { ...writeOnHit(2), aiScore: (b, id) => writeScore(b, id, 2) },
  papercrane_fold: {
    // `papercrane_fold`: the heal is resolved by tags; writes 2 letters
    effect: (b, id) => write(b, id, 2),
    aiScore: (b, id) => {
      const n = lettersOf(b, id);
      return n >= LETTER_MAX ? -50 : n === 2 ? -5 : 12;
    },
  },
  papercrane_relay: {
    // `papercrane_relay`: the switch is resolved by tags, and the letters are sent in KIT.onLeave. "Receives Letters" (a lasting effect keyed by this skill on our side) is also attached here
    lasting: {
      name: '收信',
      attackBonus: (_b, _c, e) => POST_BONUS * e.n,
    },
    // The more letters, the more it wants to hand them over; with no bench it is just an ordinary attack
    aiScore: (b, id) => {
      if (b.aliveBench(id).length === 0) return 0;
      const n = lettersOf(b, id);
      return n >= 2 ? 20 + 10 * n : n === 0 ? -20 : 0;
    },
  },
  u_papercrane: {
    // `u_papercrane`: the whole-team heal is resolved by tags; the letters are filled to 3
    afterAttack: (b, c) => {
      if (!c.followUp) write(b, c.attacker, LETTER_MAX);
    },
  },
};

/** Spirit id -> kit hooks (signature mechanics, rewritten traits, state marks) */
export const KIT: Record<string, KitHooks> = {
  aeroth: {
    // Sky Sovereign: on entering, sets Gale for 3 turns; when returning from circling, restores the altitude
    onEnter(b, id) {
      b.traitEvent(id, '天穹主宰');
      b.setField('wind', 3);
      const c = b.active(id);
      const kept = c.vars[CIRCLE] ?? 0;
      if (kept > 0) {
        c.vars[CIRCLE] = 0;
        c.vars[ALT] = Math.min(ALT_MAX, kept);
        b.text(`${c.name} 結束盤旋俯衝而下，高度 ${c.vars[ALT]}！`);
      }
    },
    // Leaving by `aeroth_circling`: keeps the altitude (e: keys are cleared only after this)
    onLeave(_b, _id, c) {
      if (c.vars[CIRCLING]) c.vars[CIRCLE] = c.vars[ALT] ?? 0;
    },
    // Airborne: having already acted this turn, attacks that land afterwards do -15% per stack of altitude
    incoming(b, a, dmg) {
      const id = a.defender;
      const alt = altOf(b, id);
      if (alt <= 0 || dmg <= 0 || !b.hasActed(id)) return dmg;
      const c = b.active(id);
      if (c.vars[DODGED] !== b.s.turn) {
        c.vars[DODGED] = b.s.turn;
        b.text(`${c.name} 在高空（高度 ${alt}），傷害 −${Math.round(ALT_GUARD * alt * 100)}%`);
      }
      return Math.floor(dmg * (1 - ALT_GUARD * alt));
    },
    // Shot Down: hit before it has acted, altitude resets to zero
    onHitTaken(b, a) {
      const id = a.defender;
      const c = b.active(id);
      if (c.hp <= 0 || b.hasActed(id) || altOf(b, id) <= 0) return;
      if (c.vars[WARD] === b.s.turn || b.getLasting(id, EMPYREAN)) return;
      c.vars[ALT] = 0;
      b.text(`${c.name} 還沒出手就被擊中，從高空被擊落了！`);
    },
    marks(b, id) {
      const n = altOf(b, id);
      return n > 0 ? [{ id: 'kit:altitude', n, note: '高度' }] : [];
    },
  },
  gale_weasel: {
    // Ambush Weasel: a [Slash] that follows a [Trip] does +20% damage (the follow-up of Triple Sickle Union lands after the chain resets to zero, so it does not count)
    attackBonus(b, a) {
      return chainOf(b, a.attacker) === 1 && SLASHES.includes(a.sk.id) ? CHAIN_BONUS : 0;
    },
    // Ambush Weasel: on entering by switch or replacement (battle start does not count), the chain goes straight to [Trip]
    onEnter(b, id) {
      if (b.s.turn === 0) return;
      b.traitEvent(id, '伏鼬');
      b.active(id).vars[CHAIN] = 1;
    },
    // When the opponent is Off-Balance, the AI should not waste aether on a guard
    aiFoeGuard(b, id) {
      return b.getLasting(b.foe(id), OFF_BALANCE) ? -200 : 0;
    },
    marks(b, id) {
      const n = chainOf(b, id);
      return n > 0 ? [{ id: 'kit:chain', n, note: n === 1 ? '連環：絆' : '連環：斬' }] : [];
    },
  },
  lyrebird: {
    // Heavenly Voice (bench healing on Harmony) is written in harmonize; here only the Lingering Echo is shown
    marks(b, id) {
      const song = echoOf(b, id);
      return song ? [{ id: 'kit:echo', note: `餘音：${getSkill(song).name}` }] : [];
    },
  },
  tornado: {
    // Each level of Storm Ring: `tornado` attacks +10% damage
    attackBonus(b, a) {
      return STORM_AURA * stormOf(b, a.attacker);
    },
    // Eye of the Gale: Storm Ring +1 on entering
    onEnter(b, id) {
      b.traitEvent(id, '風眼');
      setStorm(b, id, stormOf(b, id) + 1, '颶風之眼現身，');
    },
    // Opponent enters: it takes Storm Ring x 4%, then Storm Ring +1 (Eye of the Gale)
    onFoeEnter(b, id) {
      const f = b.foe(id);
      const n = stormOf(b, id);
      if (n > 0) {
        b.text(`${b.active(f).name} 被捲進暴風圈（${n} 級）！`);
        b.trueDamage(f, 4 * n, 'storm');
      }
      if (n < STORM_MAX) {
        b.traitEvent(id, '風眼');
        setStorm(b, id, n + 1, '');
      }
    },
    // End of turn: gusts the opponent's bench (the active opponent when there is no bench), then Storm Ring +1
    onEndTurn(b, id) {
      const n = stormOf(b, id);
      gust(b, id, 2 * n, `暴風颳傷了對手的後備精靈（各 −${2 * n}%）。`, `無處可躲，暴風颳向 ${b.active(b.foe(id)).name}！`);
      setStorm(b, id, n + 1, '風勢增強，');
    },
    marks(b, id) {
      const n = stormOf(b, id);
      return n > 0 ? [{ id: 'kit:storm', n, note: '暴風圈' }] : [];
    },
  },
  skyreign: {
    // Strong beat: when the beat is 2, the [Beat] hit that lands does +50% damage; every hit of `u_skyreign` is a strong beat
    attackBonus(b, a) {
      if (a.sk.id === 'u_skyreign') return STRONG;
      return BEAT_SKILLS.has(a.sk.id) && strongNext(b, a.attacker) ? STRONG : 0;
    },
    marks(b, id) {
      const n = beatOf(b, id);
      return n > 0 ? [{ id: 'kit:beat', n, note: n === 2 ? '拍子：下一段是強拍' : '拍子' }] : [];
    },
  },
  dandelion: {
    // Carried Away by the Wind (rewritten): on switching out, heals 20% and sows 1 stack of Fluff Seeds
    onLeave(b, id) {
      b.traitEvent(id, '隨風而去');
      b.heal(id, 20);
      sow(b, id, 1);
    },
    marks(b, id) {
      const n = seedsOn(b, b.foe(id));
      return n > 0 ? [{ id: 'kit:seeds', n, note: '對手陣地的絮種' }] : [];
    },
  },
  papercrane: {
    // Switching out: sends the letters
    onLeave(b, id, c) {
      const n = c.vars[LETTERS] ?? 0;
      if (n <= 0) return;
      b.text(`${c.name} 把 ${n} 封信交給了隊友！`);
      post(b, id, n);
    },
    // Entrusted (rewritten): when knocked out, attaches 1 extra letter and sends them
    onFaint(b, id) {
      if (b.aliveBench(id).length === 0) return;
      b.traitEvent(id, '託付');
      post(b, id, Math.min(LETTER_MAX, lettersOf(b, id) + 1));
    },
    marks(b, id) {
      const n = lettersOf(b, id);
      return n > 0 ? [{ id: 'kit:letters', n, note: '信' }] : [];
    },
  },
};
