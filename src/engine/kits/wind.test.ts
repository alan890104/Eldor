// Mechanic tests for the wind group: node --test src/engine/kits/wind.test.ts
// `aeroth`: Sky Altitude (Airborne damage reduction, Shot Down, Sky Fall), the rewritten trait "Sky Sovereign", and every hooked skill.
// `gale_weasel`: Triple Sickle Chain (Trip -> Slash -> Salve, Triple Sickle Union), trait "Ambush Weasel". `tornado`: Storm Ring (entry damage, gusting the bench, whirling in), trait "Eye of the Gale".
// `lyrebird`: Lingering Echo (a [Song] leaves an echo, "Harmony" rings it again), trait "Heavenly Voice".
// `skyreign`: Triple Beat ([Beat] records beats, strong beat). `dandelion`: Fluff Seeds (sowing, sprouting a leech seed), trait "Carried Away by the Wind". `papercrane`: Letters (writing, receiving), trait "Entrusted".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseAction } from '../ai.ts';
import type { Battle } from '../battle.ts';
import { registerKitHooks } from './index.ts';
import { KIT } from './wind.ts';
import { duel, guard, hitsBy, sw, texts, traits, turn, use, useTestSkills } from '../testkit.ts';
import type { BattleEvent, SideId } from '../types.ts';

useTestSkills();
// The opposing spirits carry no kit hooks (other groups' mechanics may still be changing); only the behavior of the t_ test skills is left
for (const id of ['cloudfluff', 'digmole', 'icecrown', 'monolith']) registerKitHooks(id, null);

const ALT = 'e:aer:alt';
const alt = (b: Battle, id: SideId = 0) => b.active(id).vars[ALT] ?? 0;
const setAlt = (b: Battle, n: number) => void (b.active(0).vars[ALT] = n);
const altMark = (b: Battle) => b.view().sides[0].team[b.side(0).active].marks.find((m) => m.id === 'kit:altitude')?.n;
const dealtTo = (ev: BattleEvent[], attacker: SideId) => hitsBy(ev, attacker).reduce((a, h) => a + h.dmg + h.shieldDmg, 0);
/** Crits converted back to normal damage */
const plainDealt = (ev: BattleEvent[], attacker: SideId) => hitsBy(ev, attacker).reduce((a, h) => a + (h.dmg + h.shieldDmg) / (h.crit ? 1.5 : 1), 0);
const usedOrder = (ev: BattleEvent[]) => ev.filter((e) => e.k === 'use').map((e) => (e as { side: SideId }).side);
/** Lets a side survive (the tests check effects, not KOs) */
const sturdy = (b: Battle, id: SideId = 1) => {
  const d = b.active(id);
  d.maxHp = d.hp = 100000;
};

const eagle = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'aeroth', skills }, ...extra];
/** A slow, neutral-element opponent (SPD 60) that never beats the eagle to the punch */
const dummy = (skills = ['t_strike', 't_quick_strike', 't_wait'], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'cloudfluff', skills }, ...extra];

// ───────────────────────── Trait: Sky Sovereign ─────────────────────────

test('Sky Sovereign: entering opens Gale for 3 turns; the old trait (speed +1 on a KO) is disabled', () => {
  const b = duel(eagle(['t_wait']), dummy());
  assert.equal(b.s.field?.element, 'wind');
  assert.equal(b.s.field?.turns, 3);
  assert.ok(b.active(0).species.traitOverride);
  assert.equal(b.active(0).species.trait.name, '天穹主宰');
});

test('Sky Sovereign: a KO with a Skyfall attack does not spend Altitude', () => {
  const b = duel(eagle(['aeroth_stoop']), dummy(['t_wait'], [{ id: 'cloudfluff', skills: ['t_wait'] }]));
  setAlt(b, 2);
  b.active(1).hp = 1;
  const ev = turn(b, 'aeroth_stoop', 't_wait');
  assert.ok(b.side(1).team[0].fainted);
  assert.equal(alt(b), 2);
  assert.ok(traits(ev).includes('天穹主宰'));
});

// ───────────────────────── Mechanic: Sky Altitude ─────────────────────────

test('Skyskim: Altitude +1 after hitting (max 3), and the status row shows Altitude', () => {
  const b = duel(eagle(['aeroth_skim']), dummy());
  sturdy(b);
  assert.equal(altMark(b), undefined);
  turn(b, 'aeroth_skim', 't_wait');
  assert.equal(alt(b), 1);
  assert.equal(altMark(b), 1);
  for (let i = 0; i < 3; i++) turn(b, 'aeroth_skim', 't_wait');
  assert.equal(alt(b), 3);
});

test('Airborne: an attack that lands after Aeroth has already moved deals 15% less damage per Altitude', () => {
  const run = (a: number) => {
    const b = duel(eagle(['t_wait']), dummy(['t_strike']), 21);
    sturdy(b, 0);
    setAlt(b, a);
    const ev = turn(b, 't_wait', 't_strike');
    assert.deepEqual(usedOrder(ev), [0, 1], 'Aeroth is faster than the opponent and acts first');
    return dealtTo(ev, 1);
  };
  const base = run(0);
  const high = run(2);
  const r = high / base;
  assert.ok(r > 0.67 && r < 0.73, `Damage ratio at Altitude 2 ${r.toFixed(3)} ≈ 0.70`);
});

test('Shot Down: hit by an attack before acting resets Altitude to zero; being hit after moving first keeps it', () => {
  const b = duel(eagle(['t_wait']), dummy(['t_quick_strike', 't_strike']));
  sturdy(b, 0);
  setAlt(b, 3);
  turn(b, 't_wait', 't_strike');
  assert.equal(alt(b), 3, 'an attack that moves second does not shoot it down');
  const ev = turn(b, 't_wait', 't_quick_strike');
  assert.deepEqual(usedOrder(ev), [1, 0], 'the +1 priority attack goes before Aeroth');
  assert.equal(alt(b), 0);
  assert.match(texts(ev), /擊落/);
});

test('Altitude resets to zero on leaving the field', () => {
  const b = duel(eagle(['t_wait'], [{ id: 'cloudfluff', skills: ['t_wait'] }]), dummy(['t_wait']));
  setAlt(b, 3);
  turn(b, sw(1), 't_wait');
  turn(b, sw(0), 't_wait');
  assert.equal(b.active(0).species.id, 'aeroth');
  assert.equal(alt(b), 0);
});

// ───────────────────────── Skills ─────────────────────────

test('Stoop: +40 power per Altitude, and Altitude resets to zero after hitting', () => {
  const run = (a: number) => {
    const b = duel(eagle(['aeroth_stoop']), dummy(['t_wait']), 5);
    sturdy(b);
    b.s.field = null;
    setAlt(b, a);
    const ev = turn(b, 'aeroth_stoop', 't_wait');
    assert.equal(alt(b), 0);
    return plainDealt(ev, 0);
  };
  const r = run(3) / run(0);
  assert.ok(r > 3.2 && r < 3.6, `Altitude 3 (power 170) / Altitude 0 (power 50) = ${r.toFixed(2)} ≈ 3.4`);
});

test('a guarded Skyfall (Stoop) does not spend Altitude', () => {
  const b = duel(eagle(['aeroth_stoop']), dummy(['t_wait']));
  sturdy(b);
  setAlt(b, 3);
  turn(b, 'aeroth_stoop', guard());
  assert.equal(alt(b), 3);
});

test('Cloudsplitter: always crits at Altitude 3, not necessarily at Altitude 2', () => {
  let crits = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const b = duel(eagle(['aeroth_cloudsplit']), dummy(['t_wait']), seed);
    sturdy(b);
    setAlt(b, 3);
    const hits = hitsBy(turn(b, 'aeroth_cloudsplit', 't_wait'), 0);
    assert.ok(hits.every((h) => h.crit));
    assert.equal(alt(b), 0);
    const c = duel(eagle(['aeroth_cloudsplit']), dummy(['t_wait']), seed);
    sturdy(c);
    setAlt(c, 2);
    crits += hitsBy(turn(c, 'aeroth_cloudsplit', 't_wait'), 0).filter((h) => h.crit).length;
  }
  assert.ok(crits < 6);
});

test('Updraft: Altitude +2 and speed +1 stage', () => {
  const b = duel(eagle(['aeroth_updraft']), dummy(['t_wait']));
  turn(b, 'aeroth_updraft', 't_wait');
  assert.equal(alt(b), 2);
  assert.equal(b.active(0).stages.spd, 1);
});

test('Soaring Strike: Altitude +2 after hitting', () => {
  const b = duel(eagle(['aeroth_soar_strike']), dummy(['t_wait']));
  sturdy(b);
  turn(b, 'aeroth_soar_strike', 't_wait');
  assert.equal(alt(b), 2);
});

test('Thousand Plumes: hits 2 + Altitude times, and does not spend Altitude', () => {
  const b = duel(eagle(['aeroth_plumes']), dummy(['t_wait']));
  sturdy(b);
  assert.equal(hitsBy(turn(b, 'aeroth_plumes', 't_wait'), 0).length, 2);
  setAlt(b, 3);
  assert.equal(hitsBy(turn(b, 'aeroth_plumes', 't_wait'), 0).length, 5);
  assert.equal(alt(b), 3);
});

test("Turbulence: next turn the opponent's guard gets priority −3 and cannot keep up with Aeroth's attack; switching clears it", () => {
  const b = duel(eagle(['aeroth_turbulence', 'aeroth_skim']), dummy(['t_wait'], [{ id: 'cloudfluff', skills: ['t_wait'] }]));
  sturdy(b);
  turn(b, 'aeroth_turbulence', 't_wait');
  assert.ok(b.getLasting(1, 'aeroth_turbulence'));
  const ev = turn(b, 'aeroth_skim', guard());
  assert.deepEqual(usedOrder(ev), [0, 1], 'the guard is pushed behind Aeroth');
  assert.ok(dealtTo(ev, 0) > 0, 'the attack was not blocked');
  // Use `aeroth_turbulence` once more; the opponent switching out will clear it
  turn(b, 'aeroth_turbulence', 't_wait');
  turn(b, 't_wait', sw(1));
  assert.equal(b.getLasting(1, 'aeroth_turbulence'), undefined);
});

test("Sky Sweep: destroys the opponent's trap and blows away the entry hazard on our side", () => {
  const b = duel(eagle(['aeroth_clear_sky']), dummy(['t_wait', 't_trap']));
  turn(b, 't_wait', use('t_wait', 't_trap'));
  assert.ok(b.side(1).trap);
  b.side(0).hazard = { pct: 10, spd: 1 };
  const ev = turn(b, 'aeroth_clear_sky', 't_wait');
  assert.equal(b.side(1).trap, null);
  assert.equal(b.side(0).hazard, null);
  assert.ok(ev.some((e) => e.k === 'trapDestroyed'));
});

test('Headwind Counter: fires when Aeroth is attacked before it acts: it is not shot down, and counters with Skyskim ×2 (Altitude +1)', () => {
  const b = duel(eagle(['aeroth_headwind', 't_wait']), dummy(['t_quick_strike', 't_wait']));
  sturdy(b);
  sturdy(b, 0);
  turn(b, use('t_wait', 'aeroth_headwind'), 't_wait');
  assert.equal(b.side(0).trap?.skillId, 'aeroth_headwind');
  setAlt(b, 2);
  const ev = turn(b, 't_wait', 't_quick_strike');
  assert.equal(b.side(0).trap, null, 'the trap has fired');
  assert.equal(alt(b), 3, 'not shot down, and the counter Skyskim adds another +1');
  assert.ok(hitsBy(ev, 0).length >= 1, 'Aeroth counters');
  assert.match(texts(ev), /逆風擊/);
});

test('Headwind Counter: does not fire when Aeroth moves first', () => {
  const b = duel(eagle(['aeroth_headwind', 't_wait']), dummy(['t_strike']));
  sturdy(b, 0);
  turn(b, use('t_wait', 'aeroth_headwind'), 't_strike');
  turn(b, 't_wait', 't_strike');
  assert.equal(b.side(0).trap?.skillId, 'aeroth_headwind');
});

test('Circling Pivot: switches out after attacking, the circling keeps Altitude, and it is restored on the next entry', () => {
  const b = duel(eagle(['aeroth_circling', 't_wait'], [{ id: 'cloudfluff', skills: ['t_wait'] }]), dummy(['t_wait']));
  sturdy(b);
  setAlt(b, 3);
  turn(b, 'aeroth_circling', 't_wait');
  assert.equal(b.active(0).species.id, 'cloudfluff');
  assert.equal(b.side(0).team[0].vars[ALT], undefined, 'the e: key is cleared');
  turn(b, sw(0), 't_wait');
  assert.equal(b.active(0).species.id, 'aeroth');
  assert.equal(alt(b), 3);
  // An ordinary switch does not keep it
  turn(b, sw(1), 't_wait');
  turn(b, sw(0), 't_wait');
  assert.equal(alt(b), 0);
});

test('Circling Pivot: does not switch with no bench, and leaves no circling mark', () => {
  const b = duel(eagle(['aeroth_circling']), dummy(['t_wait']));
  sturdy(b);
  setAlt(b, 1);
  turn(b, 'aeroth_circling', 't_wait');
  assert.equal(b.active(0).vars['e:aer:circling'], undefined);
});

test('Empyrean Ascent: for 3 turns it cannot be shot down and Skyfall does not spend Altitude; timed effects can be cleared', () => {
  const b = duel(eagle(['aeroth_empyrean', 'aeroth_stoop', 't_wait']), dummy(['t_quick_strike', 't_wait']));
  sturdy(b);
  sturdy(b, 0);
  setAlt(b, 3);
  turn(b, 'aeroth_empyrean', 't_wait');
  assert.ok(b.getLasting(0, 'aeroth_empyrean'));
  turn(b, 't_wait', 't_quick_strike');
  assert.equal(alt(b), 3, 'cannot be shot down during Empyrean Ascent');
  turn(b, 'aeroth_stoop', 't_wait');
  assert.equal(alt(b), 3, 'Skyfall does not spend Altitude during Empyrean Ascent');
  assert.equal(b.getLasting(0, 'aeroth_empyrean'), undefined, 'ends after 3 turns');
  turn(b, 'aeroth_stoop', 't_wait');
  assert.equal(alt(b), 0);
  // Clears turn-based effects
  turn(b, 'aeroth_empyrean', 't_wait');
  assert.ok(b.clearLasting(0, 'own'));
  assert.equal(b.getLasting(0, 'aeroth_empyrean'), undefined);
});

test('Sunpiercer: ignores guard, +20 power per Altitude, and does not spend Altitude', () => {
  const b = duel(eagle(['aeroth_sunpierce']), dummy(['t_wait']));
  sturdy(b);
  setAlt(b, 3);
  const ev = turn(b, 'aeroth_sunpierce', guard());
  assert.ok(dealtTo(ev, 0) > 0);
  assert.equal(alt(b), 3);
  const lo = duel(eagle(['aeroth_sunpierce']), dummy(['t_wait']), 9);
  const hi = duel(eagle(['aeroth_sunpierce']), dummy(['t_wait']), 9);
  sturdy(lo);
  sturdy(hi);
  hi.active(0).vars[ALT] = 3;
  const r = plainDealt(turn(hi, 'aeroth_sunpierce', 't_wait'), 0) / plainDealt(turn(lo, 'aeroth_sunpierce', 't_wait'), 0);
  assert.ok(r > 1.6 && r < 1.72, `150 / 90 power ≈ 1.67 (actual ${r.toFixed(2)})`);
});

test('Skybreaker: priority +2, ignores guard, and Skyfall gets +50 per Altitude', () => {
  const b = duel(eagle(['t_wait']), dummy(['t_wait']));
  sturdy(b);
  b.active(0).ultimate = 'u_aeroth';
  setAlt(b, 3);
  const ev = turn(b, 'u_aeroth', guard());
  assert.ok(dealtTo(ev, 0) > 0, 'guard cannot stop it');
  assert.equal(alt(b), 0);
  assert.equal(b.estimate(0, 'u_aeroth') > 0, true);
});

test('AI: climbs first when Altitude is low, and uses Skyfall at Altitude 3', () => {
  const b = duel(eagle(['aeroth_skim', 'aeroth_cloudsplit', 'aeroth_updraft', 'aeroth_plumes']), dummy(['t_strike']));
  sturdy(b);
  // The opponent poses no ultimate threat, so the eagle need not guard
  b.side(1).ultUsed = true;
  const pick = () => {
    // Try the same situation several times and take the most common choice (the AI has some randomness)
    const n: Record<string, number> = {};
    for (let i = 0; i < 9; i++) {
      const m = chooseAction(b, 0, { skill: 1 }).main;
      const k = m.type === 'skill' ? m.skillId : m.type;
      n[k] = (n[k] ?? 0) + 1;
    }
    return Object.entries(n).sort((x, y) => y[1] - x[1])[0][0];
  };
  setAlt(b, 0);
  assert.ok(['aeroth_updraft', 'aeroth_skim'].includes(pick()));
  setAlt(b, 3);
  assert.equal(pick(), 'aeroth_cloudsplit');
});


// ═════════════════════════ `gale_weasel`: Triple Sickle Chain ═════════════════════════

const CHAIN = 'e:gw:chain';
const chain = (b: Battle, id: SideId = 0) => b.active(id).vars[CHAIN] ?? 0;
const setChain = (b: Battle, n: number) => void (b.active(0).vars[CHAIN] = n);
const chainMark = (b: Battle) => b.view().sides[0].team[b.side(0).active].marks.find((m) => m.id === 'kit:chain');
const weasel = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'gale_weasel', skills }, ...extra];
const offBalance = (b: Battle, id: SideId = 1) => !!b.getLasting(id, 'gale_weasel_trip');

test('Ambush Weasel: rewritten trait; it does not fire at the start of battle, and switching in moves the Triple Sickle Chain straight to [Trip]', () => {
  const b = duel([{ id: 'digmole', skills: ['t_wait'] }, { id: 'gale_weasel', skills: ['gale_weasel_slash'] }], dummy());
  assert.ok(b.side(0).team[1].species.traitOverride);
  assert.equal(b.side(0).team[1].species.trait.name, '伏鼬');
  const ev = turn(b, sw(1), 't_wait');
  assert.ok(traits(ev).includes('伏鼬'));
  assert.equal(chain(b), 1);
  const b2 = duel(weasel(['gale_weasel_slash']), dummy());
  assert.equal(chain(b2), 0, 'the start of battle does not count');
});

test('Tripping Sweep: after hitting, the opponent is off balance (its guard fails next turn), and the Chain advances to [Trip] and is shown', () => {
  const b = duel(weasel(['gale_weasel_trip', 'gale_weasel_slash']), dummy(['t_wait']));
  sturdy(b);
  turn(b, 'gale_weasel_trip', 't_wait');
  assert.equal(chain(b), 1);
  assert.equal(chainMark(b)?.n, 1);
  assert.ok(offBalance(b));
  const ev = turn(b, 'gale_weasel_slash', guard());
  assert.ok(ev.some((e) => e.k === 'fail' && e.side === 1), 'off balance: the guard fails');
  assert.ok(dealtTo(ev, 0) > 0);
});

test('The Chain does not start when Tripping Sweep is guarded', () => {
  const b = duel(weasel(['gale_weasel_trip']), dummy(['t_wait']));
  sturdy(b);
  turn(b, 'gale_weasel_trip', guard());
  assert.equal(chain(b), 0);
  assert.ok(!offBalance(b));
});

test('Sickle Slash: always crits after a Trip and advances the Chain to [Slash]; with no Trip the Chain resets to zero', () => {
  const b = duel(weasel(['gale_weasel_trip', 'gale_weasel_slash']), dummy(['t_wait']));
  sturdy(b);
  setChain(b, 1);
  const ev = turn(b, 'gale_weasel_slash', 't_wait');
  assert.ok(hitsBy(ev, 0).every((h) => h.crit));
  assert.equal(chain(b), 2);
  assert.equal(chainMark(b)?.note, '連環：斬');
  turn(b, 'gale_weasel_slash', 't_wait');
  assert.equal(chain(b), 0, 'wrong order (Slash after Slash)');
});

test('The Chain breaks when [Slash] is guarded', () => {
  const b = duel(weasel(['gale_weasel_slash']), dummy(['t_wait']));
  sturdy(b);
  setChain(b, 1);
  turn(b, 'gale_weasel_slash', guard());
  assert.equal(chain(b), 0);
});

test('Sickle Salve: at Chain 2, Triple Sickle Union follows up once with the [Slash] just used; then the Chain resets to zero', () => {
  const b = duel(weasel(['gale_weasel_slash', 'gale_weasel_salve']), dummy(['t_wait']));
  sturdy(b);
  setChain(b, 1);
  turn(b, 'gale_weasel_slash', 't_wait');
  b.active(0).hp = Math.floor(b.active(0).maxHp / 2);
  const ev = turn(b, 'gale_weasel_salve', 't_wait');
  assert.ok(texts(ev).includes('三鐮合一'));
  assert.equal(hitsBy(ev, 0).length, 1);
  assert.equal(hitsBy(ev, 0)[0].skillId, 'gale_weasel_slash');
  assert.ok(ev.some((e) => e.k === 'heal' && e.target === 0));
  assert.equal(chain(b), 0);
});

test('Ambush Weasel: a [Slash] after a [Trip] deals +20% damage; the Triple Sickle Union follow-up does not count', () => {
  const run = (c: number) => {
    const b = duel(weasel(['gale_weasel_slash']), dummy(['t_wait']));
    b.rng = () => 0.5;
    sturdy(b);
    setChain(b, c);
    return plainDealt(turn(b, 'gale_weasel_slash', 't_wait'), 0);
  };
  const r = run(1) / run(0);
  assert.ok(Math.abs(r - 1.2) < 0.02, `After a Trip ×${r.toFixed(3)}`);
  // The follow-up of Triple Sickle Union: the chain has already reset to zero, so no bonus
  const b = duel(weasel(['gale_weasel_slash', 'gale_weasel_salve']), dummy(['t_wait']));
  b.rng = () => 0.5;
  sturdy(b);
  setChain(b, 2);
  const f = plainDealt(turn(b, 'gale_weasel_salve', 't_wait'), 0);
  const r2 = f / run(0);
  assert.ok(Math.abs(r2 - 1) < 0.02, `Follow-up ×${r2.toFixed(3)}`);
});

test('Sickle Salve: with no Chain it only heals and does not follow up', () => {
  const b = duel(weasel(['gale_weasel_salve']), dummy(['t_wait']));
  const ev = turn(b, 'gale_weasel_salve', 't_wait');
  assert.equal(hitsBy(ev, 0).length, 0);
  assert.equal(chain(b), 0);
});

test('Lurking Sickle: cuts damage by 40% when the opponent attacks, the attacker is off balance, and the Chain advances to [Trip]', () => {
  const run = (trap: boolean) => {
    const b = duel(weasel(['t_wait', 'gale_weasel_snare']), dummy(['t_strike']), 5);
    sturdy(b, 0);
    if (trap) turn(b, use('t_wait', 'gale_weasel_snare'), 't_wait');
    const ev = turn(b, 't_wait', 't_strike');
    return { b, dmg: dealtTo(ev, 1) };
  };
  const base = run(false);
  const hit = run(true);
  const r = hit.dmg / base.dmg;
  assert.ok(r > 0.55 && r < 0.65, `Damage reduction ratio ${r.toFixed(3)} ≈ 0.6`);
  assert.equal(chain(hit.b), 1);
  assert.ok(offBalance(hit.b));
});

test('Pursuit Gale: when the opponent switches, strikes before it leaves the field (power ×2)', () => {
  const b = duel(weasel(['gale_weasel_chase']), [{ id: 'digmole', skills: ['t_wait'] }, { id: 'icecrown', skills: ['t_wait'] }]);
  sturdy(b);
  const ev = turn(b, 'gale_weasel_chase', sw(1));
  const hits = hitsBy(ev, 0);
  assert.equal(hits.length, 1);
  const hitIdx = ev.findIndex((e) => e.k === 'hit');
  const outIdx = ev.findIndex((e) => e.k === 'switchOut');
  assert.ok(hitIdx >= 0 && hitIdx < outIdx, 'the pursuit lands before the switch');
  assert.equal(b.side(1).active, 1);
});

test('Rending Gale: always crits mid-Chain and makes the opponent Bleed for 5 turns', () => {
  const b = duel(weasel(['gale_weasel_rend']), dummy(['t_wait']));
  sturdy(b);
  setChain(b, 1);
  const ev = turn(b, 'gale_weasel_rend', 't_wait');
  assert.ok(hitsBy(ev, 0).every((h) => h.crit));
  assert.ok((b.active(1).status.bleed?.turns ?? 0) >= 4, 'Bleed for 5 turns (already counted down once at the end of the turn)');
});

test('Hooking Kick: off balance, speed −1 stage, and the Chain advances to [Trip]', () => {
  const b = duel(weasel(['gale_weasel_hook']), dummy(['t_wait']));
  sturdy(b);
  turn(b, 'gale_weasel_hook', 't_wait');
  assert.ok(offBalance(b));
  assert.equal(b.active(1).stages.spd, -1);
  assert.equal(chain(b), 1);
});

test('Salve Blade: at Chain 2, Triple Sickle Union follows up with a [Slash] on top of the drain', () => {
  const b = duel(weasel(['gale_weasel_blade_salve']), dummy(['t_wait']));
  sturdy(b);
  setChain(b, 2);
  b.active(0).vars['gw:slash'] = 3; // The last [Slash] that landed: `gale_weasel_rend`
  const ev = turn(b, 'gale_weasel_blade_salve', 't_wait');
  const hits = hitsBy(ev, 0);
  assert.deepEqual(hits.map((h) => h.skillId), ['gale_weasel_blade_salve', 'gale_weasel_rend']);
  assert.equal(chain(b), 0);
});

test('Whirling Sickles: hits 3 times, and every hit crits mid-Chain', () => {
  const b = duel(weasel(['gale_weasel_whirl']), dummy(['t_wait']));
  sturdy(b);
  setChain(b, 1);
  const ev = turn(b, 'gale_weasel_whirl', 't_wait');
  const hits = hitsBy(ev, 0);
  assert.equal(hits.length, 3);
  assert.ok(hits.every((h) => h.crit));
});

test('Trinity Salve: after Triple Sickle Union the Chain returns to [Trip] and the opponent is off balance', () => {
  const b = duel(weasel(['gale_weasel_tri_salve']), dummy(['t_wait']));
  sturdy(b);
  setChain(b, 2);
  const ev = turn(b, 'gale_weasel_tri_salve', 't_wait');
  assert.equal(hitsBy(ev, 0).length, 2, 'one Salve Blade hit + the follow-up');
  assert.equal(chain(b), 1);
  assert.ok(offBalance(b));
});

test('Unseen Whirlwind: always crits, and after hitting follows up with the last [Slash]; the Chain is unaffected', () => {
  const b = duel(weasel(['gale_weasel_slash']), dummy(['t_wait']));
  sturdy(b);
  b.active(0).ultimate = 'u_gale_weasel';
  setChain(b, 1);
  const ev = turn(b, 'u_gale_weasel', 't_wait');
  const hits = hitsBy(ev, 0);
  assert.deepEqual(hits.map((h) => h.skillId), ['u_gale_weasel', 'gale_weasel_slash']);
  assert.ok(hits[0].crit);
  assert.equal(chain(b), 1);
});

test('AI: an off-balance opponent does not waste Aether on a guard', () => {
  const b = duel(weasel(['gale_weasel_trip', 'gale_weasel_rend']), dummy(['t_strike']));
  b.active(1).hp = Math.floor(b.active(1).maxHp * 0.3);
  b.addLasting(1, 'gale_weasel_trip', 2, { from: 0 });
  for (let i = 0; i < 9; i++) assert.notEqual(chooseAction(b, 1, { skill: 1 }).main.type, 'guard');
});

test('AI: [Trip] first at Chain 0, [Slash] at Chain 1', () => {
  const b = duel(weasel(['gale_weasel_trip', 'gale_weasel_rend', 'gale_weasel_tri_salve']), dummy(['t_strike']));
  sturdy(b);
  b.side(1).ultUsed = true;
  const pick = () => {
    const n: Record<string, number> = {};
    for (let i = 0; i < 9; i++) {
      const m = chooseAction(b, 0, { skill: 1 }).main;
      const k = m.type === 'skill' ? m.skillId : m.type;
      n[k] = (n[k] ?? 0) + 1;
    }
    return Object.entries(n).sort((x, y) => y[1] - x[1])[0][0];
  };
  assert.equal(pick(), 'gale_weasel_trip');
  setChain(b, 1);
  assert.equal(pick(), 'gale_weasel_rend');
  setChain(b, 2);
  assert.equal(pick(), 'gale_weasel_tri_salve');
});

// ═════════════════════════ `tornado`: Storm Ring ═════════════════════════

const STORM = 'e:tor:storm';
const storm = (b: Battle) => b.active(0).vars[STORM] ?? 0;
const setStorm = (b: Battle, n: number) => void (b.active(0).vars[STORM] = n);
const stormMark = (b: Battle) => b.view().sides[0].team[b.side(0).active].marks.find((m) => m.id === 'kit:storm')?.n;
const eye = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'tornado', skills }, ...extra];
/** Opponent team: a slow active spirit plus two bench spirits (not `cloudfluff`: when it leaves, it heals the spirit that replaces it) */
const foeTeam = (skills = ['t_wait']) => [
  { id: 'icecrown', skills },
  { id: 'digmole', skills: ['t_wait'] },
  { id: 'monolith', skills: ['t_wait'] },
];
const pct = (b: Battle, side: SideId, i: number) => b.side(side).team[i].hp / b.side(side).team[i].maxHp;

test('Eye of the Storm: rewritten trait (no longer blocks priority attacks); entering gives Storm Ring +1 and shows it', () => {
  const b = duel(eye(['t_wait']), dummy(['t_quick_strike']));
  assert.ok(b.active(0).species.traitOverride);
  assert.equal(storm(b), 1);
  assert.equal(stormMark(b), 1);
  const ev = turn(b, 't_wait', 't_quick_strike');
  assert.ok(dealtTo(ev, 1) > 0, 'the priority attack hits as usual');
});

test('Storm Ring: +1 at the end of each turn (max 3), and gusts the opposing bench (2% per level, cannot faint)', () => {
  const b = duel(eye(['t_wait']), foeTeam());
  turn(b, 't_wait', 't_wait');
  assert.equal(storm(b), 2);
  assert.ok(Math.abs(pct(b, 1, 1) - 0.98) < 0.011, `Bench −2% (${pct(b, 1, 1)})`);
  turn(b, 't_wait', 't_wait');
  turn(b, 't_wait', 't_wait');
  assert.equal(storm(b), 3);
  b.side(1).team[2].hp = 1;
  turn(b, 't_wait', 't_wait');
  assert.equal(b.side(1).team[2].hp, 1, 'does not faint from it');
  assert.ok(!b.side(1).team[2].fainted);
});

test('Storm Ring: an opposing spirit entering takes Storm Ring × 4% damage, then Storm Ring +1; resets to zero on leaving the field', () => {
  const b = duel(eye(['t_wait'], [{ id: 'monolith', skills: ['t_wait'] }]), foeTeam());
  setStorm(b, 2);
  turn(b, 't_wait', sw(1));
  // -8% on entering; at the end of the turn it is already active (not counted as bench)
  assert.ok(Math.abs(pct(b, 1, 1) - 0.92) < 0.011, `Entry −8% (${pct(b, 1, 1)})`);
  assert.equal(storm(b), 3);
  turn(b, sw(1), 't_wait');
  assert.equal(b.side(0).team[0].vars[STORM] ?? 0, 0);
});

test('Whirl In: pulls the opposing bench spirit with the lowest HP ratio onto the field, and the pulled-in spirit takes the entry damage', () => {
  const b = duel(eye(['whirl_in']), foeTeam());
  sturdy(b);
  b.side(1).team[2].hp = Math.floor(b.side(1).team[2].maxHp * 0.5);
  setStorm(b, 3);
  const ev = turn(b, 'whirl_in', 't_wait');
  assert.equal(b.side(1).active, 2);
  assert.ok(texts(ev).includes('捲進暴風圈'));
  assert.ok(pct(b, 1, 2) < 0.39, '50% − 12% entry damage');
});

test('Whirl In: an opponent under Root is not swept away', () => {
  const b = duel(eye(['whirl_in']), foeTeam());
  sturdy(b);
  b.applyStatus(1, 'root');
  turn(b, 'whirl_in', 't_wait');
  assert.equal(b.side(1).active, 0);
});

test('Squall Lash: after hitting, each opposing bench spirit takes Storm Ring × 3%', () => {
  const b = duel(eye(['tornado_squall']), foeTeam());
  sturdy(b);
  setStorm(b, 3);
  turn(b, 'tornado_squall', 't_wait');
  // `tornado_squall` 9% + end of turn 6%
  assert.ok(Math.abs(pct(b, 1, 1) - 0.85) < 0.021, `Bench −15% (${pct(b, 1, 1)})`);
});

test('Thunder Lash: power ×2 when the opponent entered this turn or last turn', () => {
  const run = (swap: boolean) => {
    const b = duel(eye(['tornado_lash', 't_wait']), [{ id: 'digmole', skills: ['t_wait'] }, { id: 'digmole', skills: ['t_wait'] }], 3);
    b.rng = () => 0.5; // Variance of fixed damage (0.95 to 1.05)
    sturdy(b);
    for (const m of b.side(1).team) m.maxHp = m.hp = 100000;
    turn(b, 't_wait', swap ? sw(1) : 't_wait');
    setStorm(b, 3); // An opponent entering raises Storm Ring by +1, so both sides line up (each Storm Ring level gives +10% attack damage)
    return plainDealt(turn(b, 'tornado_lash', 't_wait'), 0);
  };
  const r = run(true) / run(false);
  assert.ok(r > 1.85 && r < 2.15, `Power ratio ${r.toFixed(2)} ≈ 2`);
});

test("Scattering Gust: clears the opponent's stat boosts and timed effects, Storm Ring +1", () => {
  const b = duel(eye(['tornado_scatter']), dummy(['t_war_cry']));
  turn(b, 'tornado_scatter', 't_war_cry');
  // The opponent's boost happens after the dispel (it is slower), so blow it away once more
  assert.equal(b.active(1).stages.atk, 2);
  const before = storm(b);
  turn(b, 'tornado_scatter', 't_wait');
  assert.equal(b.active(1).stages.atk, 0);
  assert.equal(storm(b), Math.min(3, before + 2), 'Scattering Gust +1, end of turn +1');
});

test("Calm Eye: negates the opponent's priority attack and Storm Ring +2; ordinary attacks do not trigger it", () => {
  const b = duel(eye(['t_wait', 'tornado_calm_eye']), dummy(['t_quick_strike', 't_strike']));
  sturdy(b, 0);
  turn(b, use('t_wait', 'tornado_calm_eye'), 't_wait');
  const s0 = storm(b);
  const ev1 = turn(b, 't_wait', 't_strike');
  assert.ok(dealtTo(ev1, 1) > 0, 'an ordinary attack does not trigger it');
  assert.ok(b.side(0).trap, 'the trap is still set');
  setStorm(b, 0);
  const ev2 = turn(b, 't_wait', 't_quick_strike');
  assert.equal(dealtTo(ev2, 1), 0);
  assert.ok(ev2.some((e) => e.k === 'negate'));
  assert.equal(storm(b), 3, '+2, then +1 at the end of the turn');
  assert.ok(s0 >= 1);
});

test('Storm Collapse: spends all Storm Ring, and each level deals 7% to the whole opposing team', () => {
  const b = duel(eye(['tornado_collapse']), foeTeam());
  setStorm(b, 3);
  const hpBefore = b.active(1).hp;
  const ev = turn(b, 'tornado_collapse', 't_wait');
  const d = b.active(1);
  const hit = dealtTo(ev, 0);
  assert.ok(Math.abs(hpBefore - d.hp - hit - Math.floor(d.maxHp * 0.21)) <= 2, 'active −21% (fixed damage)');
  // Bench: `tornado_collapse` 21% + end of turn (Storm Ring 0 -> no gust)
  assert.ok(Math.abs(pct(b, 1, 1) - 0.79) < 0.011, `Bench −21% (${pct(b, 1, 1)})`);
  assert.equal(storm(b), 1, '+1 at the end of the turn after resetting to zero');
});

test('No Place to Hide: the bench share of Storm Collapse hits the active spirit instead (7% + 7% per level)', () => {
  const b = duel(eye(['tornado_collapse']), [{ id: 'icecrown', skills: ['t_wait'] }]);
  sturdy(b);
  setStorm(b, 3);
  const ev = turn(b, 'tornado_collapse', 't_wait');
  // `tornado_collapse` 21% + No Place to Hide 21%; at the end of the turn Storm Ring is 0, so no gust
  assert.equal(ev.filter((e) => e.k === 'damage' && e.target === 1 && e.reason === 'storm').reduce((a, e) => a + (e as { dmg: number }).dmg, 0), 42000);
  assert.ok(texts(ev).includes('無處可躲'));
  assert.equal(storm(b), 1);
});

test('Storm Collapse does not spend Storm Ring when guarded', () => {
  const b = duel(eye(['tornado_collapse']), foeTeam());
  setStorm(b, 3);
  turn(b, 'tornado_collapse', guard());
  assert.equal(storm(b), 3);
});

test('Vortex: Storm Ring +1 after hitting', () => {
  const b = duel(eye(['tornado_vortex']), dummy(['t_wait']));
  sturdy(b);
  setStorm(b, 0);
  const ev = turn(b, 'tornado_vortex', 't_wait');
  assert.ok(texts(ev).includes('渦旋捲起'));
  assert.equal(storm(b), 2, 'Vortex +1, end of turn +1');
});

test('Storm Courier: swaps with the bench, and the spirit that comes in gets a shield of Storm Ring × 10%', () => {
  const b = duel(eye(['tornado_courier'], [{ id: 'monolith', skills: ['t_wait'] }]), dummy(['t_wait']));
  setStorm(b, 3);
  turn(b, 'tornado_courier', 't_wait');
  assert.equal(b.side(0).active, 1);
  const m = b.active(0);
  assert.equal(m.shield?.amount, Math.floor(m.maxHp * 0.3));
});

test('Eye of Calm: heals 35%, Storm Ring −1', () => {
  const b = duel(eye(['tornado_eye_rest']), dummy(['t_wait']));
  b.active(0).hp = Math.floor(b.active(0).maxHp * 0.3);
  setStorm(b, 3);
  const ev = turn(b, 'tornado_eye_rest', 't_wait');
  assert.ok(ev.some((e) => e.k === 'heal' && e.target === 0));
  assert.equal(storm(b), 3, '−1, then +1 at the end of the turn');
  setStorm(b, 1);
  turn(b, 'tornado_eye_rest', 't_wait');
  assert.equal(storm(b), 1);
});

test('Maelstrom: Storm Ring becomes 3, then whirls in the weakest bench spirit (entry −12%)', () => {
  const b = duel(eye(['tornado_maelstrom']), foeTeam());
  sturdy(b);
  setStorm(b, 0);
  b.side(1).team[1].hp = Math.floor(b.side(1).team[1].maxHp * 0.6);
  turn(b, 'tornado_maelstrom', 't_wait');
  assert.equal(b.side(1).active, 1);
  assert.ok(Math.abs(pct(b, 1, 1) - 0.48) < 0.011, `60% − 12% (${pct(b, 1, 1)})`);
  assert.equal(storm(b), 3);
});

test('Eye of Calamity: each opposing bench spirit takes 20% (cannot faint), and Storm Ring becomes 3', () => {
  const b = duel(eye(['t_wait']), foeTeam());
  sturdy(b);
  b.active(0).ultimate = 'u_tornado';
  setStorm(b, 0);
  b.side(1).team[2].hp = 5;
  turn(b, 'u_tornado', 't_wait');
  assert.ok(Math.abs(pct(b, 1, 1) - 0.74) < 0.011, `Bench −20% then −6% (${pct(b, 1, 1)})`);
  assert.equal(b.side(1).team[2].hp, 1);
  assert.equal(storm(b), 3);
});

/** Storm damage the opponent's active spirit takes during the turn (true damage, not counted as an attack hit) */
const stormTo = (ev: BattleEvent[], side: SideId = 1) =>
  ev.filter((e) => e.k === 'damage' && e.target === side && e.reason === 'storm').reduce((a, e) => a + (e as { dmg: number }).dmg, 0);
const solo = (skills = ['t_wait']) => [{ id: 'icecrown', skills }];

test('No Place to Hide: with no opposing bench, the end-of-turn gust hits the active spirit instead (Storm Ring × 2%)', () => {
  const b = duel(eye(['t_wait']), solo());
  sturdy(b);
  setStorm(b, 2);
  const ev = turn(b, 't_wait', 't_wait');
  assert.equal(stormTo(ev), 4000, '100000 × 4%');
  assert.ok(texts(ev).includes('無處可躲'));
  // With a bench, it still gusts the bench as before; the active spirit is unaffected
  const b2 = duel(eye(['t_wait']), foeTeam());
  sturdy(b2);
  setStorm(b2, 2);
  assert.equal(stormTo(turn(b2, 't_wait', 't_wait')), 0);
});

test('No Place to Hide: Squall Lash hits the active spirit instead (Storm Ring × 3%)', () => {
  const b = duel(eye(['tornado_squall']), solo());
  sturdy(b);
  setStorm(b, 3);
  const ev = turn(b, 'tornado_squall', 't_wait');
  // `tornado_squall` 9% + end of turn 6%
  assert.equal(stormTo(ev), 15000);
});

test('No Place to Hide: Whirl In makes the active spirit take the entry damage instead (Storm Ring × 4%)', () => {
  const b = duel(eye(['whirl_in']), solo());
  sturdy(b);
  setStorm(b, 3);
  const ev = turn(b, 'whirl_in', 't_wait');
  assert.equal(b.side(1).active, 0);
  assert.ok(texts(ev).includes('無處可躲'));
  // `whirl_in` 12% + end of turn 6%
  assert.equal(stormTo(ev), 18000);
  // Nothing happens at Storm Ring 0
  const b2 = duel(eye(['whirl_in']), solo());
  sturdy(b2);
  setStorm(b2, 0);
  const ev2 = turn(b2, 'whirl_in', 't_wait');
  assert.ok(!texts(ev2).includes('捲進暴風圈'));
});

test('No Place to Hide: Eye of Calamity hits the active spirit for 20% instead; nothing extra on a KO', () => {
  const b = duel(eye(['t_wait']), solo());
  sturdy(b);
  b.active(0).ultimate = 'u_tornado';
  setStorm(b, 0);
  const ev = turn(b, 'u_tornado', 't_wait');
  // `u_tornado` 20% + end of turn (Storm Ring 3) 6%
  assert.equal(stormTo(ev), 26000);
  const k = duel(eye(['t_wait']), solo());
  k.active(0).ultimate = 'u_tornado';
  k.active(1).hp = 1;
  const ev2 = turn(k, 'u_tornado', 't_wait');
  assert.ok(k.active(1).fainted);
  assert.equal(stormTo(ev2), 0);
});

test('Storm Ring: each level raises the attack damage of Eye of the Gale by 10%', () => {
  const run = (n: number) => {
    const b = duel(eye(['t_strike']), solo());
    b.rng = () => 0.5;
    sturdy(b);
    setStorm(b, n);
    return plainDealt(turn(b, 't_strike', 't_wait'), 0);
  };
  const base = run(0);
  const r3 = run(3) / base;
  const r1 = run(1) / base;
  assert.ok(Math.abs(r3 - 1.3) < 0.02, `Storm Ring 3: ×${r3.toFixed(3)}`);
  assert.ok(Math.abs(r1 - 1.1) < 0.02, `Storm Ring 1: ×${r1.toFixed(3)}`);
  const b = duel(eye(['t_wait']), solo());
  setStorm(b, 2);
  assert.equal(KIT.tornado.attackBonus?.(b, { attacker: 0 } as never), 0.2);
});

test('AI: collapses at Storm Ring 3, builds up first when Storm Ring is low', () => {
  const b = duel(eye(['tornado_collapse', 'tornado_vortex', 'wind_bolt']), foeTeam(['t_strike']));
  sturdy(b);
  b.side(1).ultUsed = true;
  const pick = () => {
    const n: Record<string, number> = {};
    for (let i = 0; i < 9; i++) {
      const m = chooseAction(b, 0, { skill: 1 }).main;
      const k = m.type === 'skill' ? m.skillId : m.type;
      n[k] = (n[k] ?? 0) + 1;
    }
    return Object.entries(n).sort((x, y) => y[1] - x[1])[0][0];
  };
  setStorm(b, 3);
  assert.equal(pick(), 'tornado_collapse');
  setStorm(b, 0);
  assert.notEqual(pick(), 'tornado_collapse');
});

// ═════════════════════════ `lyrebird`: Lingering Echo ═════════════════════════

const ECHO = 'e:lyr:echo';
const echoMark = (b: Battle) => b.view().sides[0].team[b.side(0).active].marks.find((m) => m.id === 'kit:echo')?.note;
const lyre = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'lyrebird', skills }, ...extra];
const hpPct = (b: Battle, side: SideId, i: number) => b.side(side).team[i].hp / b.side(side).team[i].maxHp;

test('Heavenly Voice: rewritten trait (the old Mimicry is disabled)', () => {
  const b = duel(lyre(['t_wait']), dummy(['t_war_cry']));
  assert.ok(b.active(0).species.traitOverride);
  assert.equal(b.active(0).species.trait.name, '天籟');
  turn(b, 't_wait', 't_war_cry');
  assert.equal(b.active(0).stages.atk, 0, "no longer follows the opponent's boosts");
});

test('Lingering Echo: a finished [Song] leaves an echo and shows it; a new song replaces it; it vanishes on leaving the field', () => {
  const b = duel(lyre(['lyrebird_trill', 'lyrebird_wingsong'], [{ id: 'monolith', skills: ['t_wait'] }]), dummy(['t_wait']));
  sturdy(b);
  assert.equal(echoMark(b), undefined);
  turn(b, 'lyrebird_trill', 't_wait');
  assert.equal(echoMark(b), '餘音：清啼');
  turn(b, 'lyrebird_wingsong', 't_wait');
  assert.equal(echoMark(b), '餘音：振羽歌');
  turn(b, sw(1), 't_wait');
  assert.equal(b.side(0).team[0].vars[ECHO], undefined);
});

test('Clear Trill → Refrain: the tune (opponent speed −1) sounds once more, then the echo fades', () => {
  const b = duel(lyre(['lyrebird_trill', 'lyrebird_refrain']), dummy(['t_wait']));
  sturdy(b);
  turn(b, 'lyrebird_trill', 't_wait');
  assert.equal(b.active(1).stages.spd, -1);
  const ev = turn(b, 'lyrebird_refrain', 't_wait');
  assert.ok(texts(ev).includes('和聲'));
  assert.equal(b.active(1).stages.spd, -2);
  assert.equal(b.active(0).vars[ECHO], undefined);
  turn(b, 'lyrebird_refrain', 't_wait');
  assert.equal(b.active(1).stages.spd, -2, 'with no echo Refrain is just an ordinary attack');
});

test('a guarded Refrain does not ring Harmony, and the echo is kept', () => {
  const b = duel(lyre(['lyrebird_trill', 'lyrebird_refrain']), dummy(['t_wait']));
  sturdy(b);
  turn(b, 'lyrebird_trill', 't_wait');
  turn(b, 'lyrebird_refrain', guard());
  assert.equal(b.active(1).stages.spd, -1);
  assert.ok(b.active(0).vars[ECHO]);
});

test('Radiant Hymn: heals 20% and Cleanses; with Harmony it heals and Cleanses once more', () => {
  const b = duel(lyre(['lyrebird_hymn', 'lyrebird_refrain']), dummy(['t_wait']));
  sturdy(b);
  const c = b.active(0);
  c.hp = Math.floor(c.maxHp * 0.3);
  b.applyStatus(0, 'burn');
  turn(b, 'lyrebird_hymn', 't_wait');
  assert.ok(!c.status.burn);
  assert.ok(Math.abs(c.hp / c.maxHp - 0.5) < 0.02, `Healed to about 50% (${(c.hp / c.maxHp).toFixed(3)})`);
  b.applyStatus(0, 'poison', 1);
  turn(b, 'lyrebird_refrain', 't_wait');
  assert.ok(!c.status.poison, 'Harmony Cleanses once more');
  // Heals another 20% (the poison was cleared first); with no bench, Heavenly Voice does not fire (it only heals the bench)
  assert.ok(Math.abs(c.hp / c.maxHp - 0.7) < 0.02, `About 70% after Harmony (${(c.hp / c.maxHp).toFixed(3)})`);
});

test('Wingbeat Song → Rondo: MAG +1, heals 8%, and Harmony sounds once more', () => {
  const b = duel(lyre(['lyrebird_wingsong', 'lyrebird_rondo']), dummy(['t_wait']));
  sturdy(b);
  const c = b.active(0);
  c.hp = Math.floor(c.maxHp * 0.5);
  turn(b, 'lyrebird_wingsong', 't_wait');
  assert.equal(c.stages.mag, 1);
  assert.ok(Math.abs(c.hp / c.maxHp - 0.58) < 0.011, `Heals 8% (${(c.hp / c.maxHp).toFixed(3)})`);
  turn(b, 'lyrebird_rondo', 't_wait');
  assert.equal(c.stages.mag, 2);
  assert.equal(c.stages.spd, 0);
  assert.ok(Math.abs(c.hp / c.maxHp - 0.66) < 0.011, `Harmony heals another 8% (${(c.hp / c.maxHp).toFixed(3)})`);
});

test("Lament: lowers the higher of the opponent's ATK and MAG by 1 stage (not when a Decoy blocks it)", () => {
  // `cloudfluff`: MAG 65 > ATK 55 -> MAG -1
  const b = duel(lyre(['lyrebird_lament']), dummy(['t_wait', 't_substitute']));
  sturdy(b);
  turn(b, 'lyrebird_lament', 't_wait');
  assert.equal(b.active(1).stages.mag, -1);
  assert.equal(b.active(1).stages.atk, 0);
  // `digmole`: ATK 105 > MAG 35 -> ATK -1
  const p = duel(lyre(['lyrebird_lament']), [{ id: 'digmole', skills: ['t_wait'] }]);
  sturdy(p);
  turn(p, 'lyrebird_lament', 't_wait');
  assert.equal(p.active(1).stages.atk, -1);
  assert.equal(p.active(1).stages.mag, 0);
  const b2 = duel(lyre(['t_wait', 'lyrebird_lament']), dummy(['t_substitute']));
  sturdy(b2);
  turn(b2, 't_wait', 't_substitute');
  turn(b2, 'lyrebird_lament', 't_substitute');
  assert.equal(b2.active(1).stages.mag, 0);
});

test('Starlit Serenade: the whole team (bench included) heals 8%; Heavenly Voice: with Harmony the bench heals another 8%', () => {
  const b = duel(lyre(['lyrebird_serenade', 'lyrebird_refrain'], [{ id: 'monolith', skills: ['t_wait'] }]), dummy(['t_wait']));
  sturdy(b);
  const ally = b.side(0).team[1];
  ally.hp = Math.floor(ally.maxHp * 0.5);
  turn(b, 'lyrebird_serenade', 't_wait');
  assert.ok(Math.abs(hpPct(b, 0, 1) - 0.58) < 0.011, `Bench +8% (${hpPct(b, 0, 1)})`);
  const ev = turn(b, 'lyrebird_refrain', 't_wait');
  assert.ok(traits(ev).includes('天籟'));
  assert.ok(Math.abs(hpPct(b, 0, 1) - 0.74) < 0.011, `Harmony +8%, Heavenly Voice +8% (${hpPct(b, 0, 1)})`);
});

test('Heavenly Aria: MAG +1 stage and heals 10%', () => {
  const b = duel(lyre(['lyrebird_aria']), dummy(['t_wait']));
  sturdy(b);
  const c = b.active(0);
  c.hp = Math.floor(c.maxHp * 0.5);
  turn(b, 'lyrebird_aria', 't_wait');
  assert.equal(c.stages.mag, 1);
  assert.ok(Math.abs(c.hp / c.maxHp - 0.6) < 0.011);
});

test('Answering Call: cuts damage by 30% when the opponent attacks, and rings Harmony once', () => {
  const run = (trap: boolean) => {
    const b = duel(lyre(['lyrebird_wingsong', 't_wait', 'lyrebird_answer']), dummy(['t_strike']), 5);
    sturdy(b, 0);
    turn(b, 'lyrebird_wingsong', 't_wait');
    if (trap) turn(b, use('t_wait', 'lyrebird_answer'), 't_wait');
    else turn(b, 't_wait', 't_wait');
    const ev = turn(b, 't_wait', 't_strike');
    return { b, dmg: dealtTo(ev, 1) };
  };
  const base = run(false);
  const hit = run(true);
  const r = hit.dmg / base.dmg;
  assert.ok(r > 0.65 && r < 0.75, `Damage reduction ratio ${r.toFixed(3)} ≈ 0.7`);
  assert.equal(hit.b.active(0).stages.mag, 2, 'the echo of Wingbeat Song sounds once more');
});

test('Heavenly Finale: the whole team heals 15%, and Harmony rings twice', () => {
  const b = duel(lyre(['lyrebird_wingsong'], [{ id: 'monolith', skills: ['t_wait'] }]), dummy(['t_wait']));
  sturdy(b);
  b.active(0).ultimate = 'u_lyrebird';
  const ally = b.side(0).team[1];
  ally.hp = Math.floor(ally.maxHp * 0.5);
  turn(b, 'lyrebird_wingsong', 't_wait');
  turn(b, 'u_lyrebird', 't_wait');
  assert.equal(b.active(0).stages.mag, 3);
  assert.ok(Math.abs(hpPct(b, 0, 1) - 0.73) < 0.011, `Bench +15% + Heavenly Voice 8% (${hpPct(b, 0, 1)})`);
});

test('AI: sings first when there is no echo, rings Harmony when there is', () => {
  const b = duel(lyre(['lyrebird_wingsong', 'lyrebird_rondo', 'lyrebird_trill']), dummy(['t_strike']));
  sturdy(b);
  b.side(1).ultUsed = true;
  const pick = () => {
    const n: Record<string, number> = {};
    for (let i = 0; i < 9; i++) {
      const m = chooseAction(b, 0, { skill: 1 }).main;
      const k = m.type === 'skill' ? m.skillId : m.type;
      n[k] = (n[k] ?? 0) + 1;
    }
    return Object.entries(n).sort((x, y) => y[1] - x[1])[0][0];
  };
  assert.equal(pick(), 'lyrebird_wingsong');
  b.active(0).vars[ECHO] = 3; // `lyrebird_wingsong`
  assert.equal(pick(), 'lyrebird_rondo');
});

/** The action the AI picks most often over 9 choices */
const aiPick = (b: Battle, id: SideId = 0) => {
  const n: Record<string, number> = {};
  for (let i = 0; i < 9; i++) {
    const m = chooseAction(b, id, { skill: 1 }).main;
    const k = m.type === 'skill' ? m.skillId : m.type;
    n[k] = (n[k] ?? 0) + 1;
  }
  return Object.entries(n).sort((x, y) => y[1] - x[1])[0][0];
};
/** Each hit converted back to damage without a crit */
const segs = (ev: BattleEvent[], side: SideId) => hitsBy(ev, side).map((h) => (h.dmg + h.shieldDmg) / (h.crit ? 1.5 : 1));

// ═════════════════════════ `skyreign`: Triple Beat ═════════════════════════

const BEAT = 'e:sky:beat';
const beatN = (b: Battle) => b.active(0).vars[BEAT] ?? 0;
const beatMark = (b: Battle) => b.view().sides[0].team[b.side(0).active].marks.find((m) => m.id === 'kit:beat');
const falcon = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'skyreign', skills }, ...extra];

test('Triple Beat: at beat 2, the [Beat] hit that lands is a strong beat (damage +50%), and the beat resets to zero afterwards', () => {
  const run = (pre: number) => {
    const b = duel(falcon(['skyreign_dive']), dummy(['t_wait']), 11);
    sturdy(b);
    b.active(0).vars[BEAT] = pre;
    const ev = turn(b, 'skyreign_dive', 't_wait');
    return { b, ev, dmg: plainDealt(ev, 0) };
  };
  const off = run(0);
  const strong = run(2);
  assert.equal(beatN(off.b), 1, 'an ordinary single beat');
  assert.equal(beatN(strong.b), 0, 'the strong beat resets to zero after landing');
  assert.ok(texts(strong.ev).includes('強拍'));
  const r = strong.dmg / off.dmg;
  assert.ok(r > 1.35 && r < 1.65, `Strong beat ×${r.toFixed(3)} ≈ 1.5`);
});

test("Triple Beat: Quick Peck's 2 hits record two beats and show them; the first hit of the next Quick Peck is the strong beat", () => {
  const b = duel(falcon(['skyreign_peck']), dummy(['t_wait']));
  sturdy(b);
  assert.equal(beatMark(b), undefined);
  turn(b, 'skyreign_peck', 't_wait');
  assert.equal(beatN(b), 2);
  assert.equal(beatMark(b)?.n, 2);
  assert.match(beatMark(b)?.note ?? '', /強拍/);
  const [first, second] = segs(turn(b, 'skyreign_peck', 't_wait'), 0);
  assert.ok(first / second > 1.3, `The first hit is the strong beat (×${(first / second).toFixed(2)})`);
  assert.equal(beatN(b), 1);
});

test('Triple Beat: hits that are guarded or land on a Decoy record no beat; the beat resets to zero on leaving the field', () => {
  const b = duel(falcon(['skyreign_peck', 't_wait'], [{ id: 'monolith', skills: ['t_wait'] }]), dummy(['t_wait', 't_substitute']));
  sturdy(b);
  turn(b, 'skyreign_peck', guard());
  assert.equal(beatN(b), 0, 'guarded');
  turn(b, 't_wait', 't_substitute');
  turn(b, 'skyreign_peck', 't_wait');
  assert.equal(beatN(b), 0, 'landed on the Decoy');
  b.active(1).decoy = 0;
  turn(b, 'skyreign_peck', 't_wait');
  assert.equal(beatN(b), 2);
  turn(b, sw(1), 't_wait');
  assert.equal(b.side(0).team[0].vars[BEAT], undefined);
});

test("Swoop: the opponent's speed −1 stage when it lands on the strong beat", () => {
  const b = duel(falcon(['skyreign_swoop']), dummy(['t_wait']));
  sturdy(b);
  turn(b, 'skyreign_swoop', 't_wait');
  assert.equal(b.active(1).stages.spd, 0, 'not the strong beat');
  b.active(0).vars[BEAT] = 2;
  turn(b, 'skyreign_swoop', 't_wait');
  assert.equal(b.active(1).stages.spd, -1);
});

test('Ruffle: speed +1 stage, and the beat jumps to the second beat', () => {
  const b = duel(falcon(['skyreign_ruffle']), dummy(['t_wait']));
  const spd = b.active(0).stages.spd;
  turn(b, 'skyreign_ruffle', 't_wait');
  assert.equal(b.active(0).stages.spd, spd + 1);
  assert.equal(beatN(b), 2);
});

test('Triple Peck: one of its 3 hits is always a strong beat; power +30 when the opponent has a Decoy', () => {
  const b = duel(falcon(['skyreign_flurry']), dummy(['t_wait']));
  sturdy(b);
  const s = segs(turn(b, 'skyreign_flurry', 't_wait'), 0);
  assert.equal(s.length, 3);
  assert.ok(s[2] / s[0] > 1.3, 'the third hit is the strong beat');
  assert.equal(beatN(b), 0);
  // Substitute: every hit lands on the substitute (no beat recorded, no strong beat), power per hit 24 -> 34
  const d = duel(falcon(['skyreign_flurry']), dummy(['t_wait', 't_substitute']));
  sturdy(d);
  turn(d, 't_wait' as never, 't_substitute');
  const t = segs(turn(d, 'skyreign_flurry', 't_wait'), 0);
  const r = t[0] / s[0];
  assert.ok(r > 1.25 && r < 1.6, `Power 72 → 102 (×${r.toFixed(2)})`);
});

test('Skyfall Rend: landing on the strong beat leaves the beat at the second beat (the next hit is a strong beat again)', () => {
  const b = duel(falcon(['skyreign_skyfall']), dummy(['t_wait']));
  sturdy(b);
  turn(b, 'skyreign_skyfall', 't_wait');
  assert.equal(beatN(b), 1, 'not the strong beat: the beat is recorded as usual');
  b.active(0).vars[BEAT] = 2;
  const ev = turn(b, 'skyreign_skyfall', 't_wait');
  assert.ok(texts(ev).includes('強拍'));
  assert.equal(beatN(b), 2);
});

test("Falcon King's Triad: all 3 hits are strong beats (+50%), and the beat is unaffected", () => {
  const run = () => {
    const b = duel(falcon(['t_wait']), dummy(['t_wait']), 13);
    sturdy(b);
    b.active(0).ultimate = 'u_skyreign';
    b.active(0).vars[BEAT] = 1;
    const ev = turn(b, 'u_skyreign', 't_wait');
    return { b, dmg: plainDealt(ev, 0), n: hitsBy(ev, 0).length };
  };
  const strong = run();
  assert.equal(strong.n, 3);
  assert.equal(beatN(strong.b), 1);
  registerKitHooks('skyreign', null);
  try {
    const plain = run();
    const r = strong.dmg / plain.dmg;
    assert.ok(r > 1.4 && r < 1.6, `×${r.toFixed(3)} ≈ 1.5`);
  } finally {
    registerKitHooks('skyreign', KIT.skyreign);
  }
});

test('AI: uses the single heavy hit at the second beat, and Quick Peck first while the beat is early', () => {
  const b = duel(falcon(['skyreign_peck', 'skyreign_dive']), dummy(['t_wait']));
  b.side(1).ultUsed = true;
  b.active(0).vars[BEAT] = 0;
  assert.equal(aiPick(b), 'skyreign_peck');
  b.active(0).vars[BEAT] = 2;
  assert.equal(aiPick(b), 'skyreign_dive');
});

// ═════════════════════════ `dandelion`: Fluff Seeds ═════════════════════════

const SEEDS = 'dandelion_drift';
const seedsOf = (b: Battle, side: SideId = 1) => b.side(side).lasting.find((l) => l.key === SEEDS)?.n ?? 0;
const fluff = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'dandelion', skills }, ...extra];

test('Drift Away (rewritten): heals 20% when it switches out, and sows 1 Fluff Seed on the opponent side', () => {
  const b = duel(fluff(['t_wait'], [{ id: 'monolith', skills: ['t_wait'] }]), dummy(['t_wait']));
  assert.ok(b.active(0).species.traitOverride);
  assert.equal(b.active(0).species.trait.name, '隨風而去');
  const c = b.active(0);
  c.hp = Math.floor(c.maxHp * 0.5);
  const ev = turn(b, sw(1), 't_wait');
  assert.ok(traits(ev).includes('隨風而去'));
  assert.ok(Math.abs(c.hp / c.maxHp - 0.7) < 0.011, `Heals 20% (${(c.hp / c.maxHp).toFixed(3)})`);
  assert.ok(b.active(1).leechSeed, 'that Fluff Seed sprouts at the end of the turn');
  assert.equal(seedsOf(b), 0);
});

test('Drifting Fluff: sows 2 Fluff Seeds (shown on the opponent side) that sprout at once; Leech Seed drains 4% at the end of each turn', () => {
  const b = duel(fluff(['dandelion_drift']), dummy(['t_wait']));
  const me = b.active(0);
  me.hp = Math.floor(me.maxHp * 0.5);
  const foe = b.active(1);
  const ev = turn(b, 'dandelion_drift', 't_wait');
  assert.match(texts(ev), /寄生/);
  assert.ok(foe.leechSeed);
  assert.equal(seedsOf(b), 1);
  const cond = b.view().sides[1].conds.find((m) => m.id === `fx:${SEEDS}`);
  assert.equal(cond?.n, 1);
  assert.equal(cond?.note, '絮種');
  assert.ok(Math.abs(foe.hp / foe.maxHp - 0.96) < 0.011, `Drains 4% (${(foe.hp / foe.maxHp).toFixed(3)})`);
  assert.ok(me.hp > Math.floor(me.maxHp * 0.5), 'absorbed by our side');
});

test('Fluff Seeds: after Leech Seed has run 3 turns, the next Fluff Seed sprouts at the end of the turn', () => {
  const b = duel(fluff(['dandelion_drift', 't_wait']), dummy(['t_wait']));
  const foe = b.active(1);
  foe.maxHp = foe.hp = 10000;
  turn(b, 'dandelion_drift', 't_wait');
  turn(b, 't_wait', 't_wait');
  turn(b, 't_wait', 't_wait');
  assert.equal(foe.hp, 8800, 'Leech Seed for 3 turns, 4% each');
  assert.equal(foe.leechSeed, null);
  assert.equal(seedsOf(b), 1);
  turn(b, 't_wait', 't_wait');
  assert.ok(foe.leechSeed, 'the next Fluff Seed sprouts');
  assert.equal(foe.hp, 8800, 'nothing is drained on the turn it sprouts');
  assert.equal(seedsOf(b), 0);
  for (let i = 0; i < 3; i++) turn(b, 't_wait', 't_wait');
  assert.equal(foe.hp, 7600);
});

test('Fluff Seeds: the opponent cannot escape by switching, and the spirit that comes in sprouts at the end of the turn', () => {
  const b = duel(fluff(['dandelion_drift', 't_wait']), dummy(['t_wait'], [{ id: 'digmole', skills: ['t_wait'] }]));
  turn(b, 'dandelion_drift', 't_wait');
  turn(b, 't_wait', sw(1));
  assert.equal(b.active(1).species.id, 'digmole');
  assert.ok(b.active(1).leechSeed);
  assert.equal(b.side(1).team[0].leechSeed, null, 'Leech Seed is lifted on leaving the field');
  assert.equal(seedsOf(b), 0);
});

test('Fluff Seeds: they scatter after 5 turns with no sowing or sprouting', () => {
  const b = duel(fluff(['dandelion_sow', 't_wait']), dummy(['t_wait']));
  sturdy(b);
  b.active(1).leechSeed = { turns: 99 };
  turn(b, 'dandelion_sow', 't_wait');
  for (let i = 0; i < 3; i++) turn(b, 't_wait', 't_wait');
  assert.equal(seedsOf(b), 1);
  turn(b, 't_wait', 't_wait');
  assert.equal(seedsOf(b), 0);
});

test('Sow the Wind: sows 1 Fluff Seed after hitting; none when guarded', () => {
  const b = duel(fluff(['dandelion_sow']), dummy(['t_wait']));
  sturdy(b);
  b.active(1).leechSeed = { turns: 99 };
  turn(b, 'dandelion_sow', guard());
  assert.equal(seedsOf(b), 0);
  turn(b, 'dandelion_sow', 't_wait');
  turn(b, 'dandelion_sow', 't_wait');
  turn(b, 'dandelion_sow', 't_wait');
  turn(b, 'dandelion_sow', 't_wait');
  assert.equal(seedsOf(b), 3, 'at most 3 Fluff Seeds');
});

test('Fluff Shot, Sapping Sprout, Bursting Bloom: more power while the opponent is under Leech Seed (+20 / +30 / +50)', () => {
  for (const [id, base, bonus] of [['dandelion_puff', 55, 20], ['dandelion_sap', 65, 30], ['dandelion_bloom', 100, 50]] as const) {
    const run = (seeded: boolean) => {
      const b = duel(fluff([id]), dummy(['t_wait']), 17);
      sturdy(b);
      if (seeded) b.active(1).leechSeed = { turns: 3 };
      return plainDealt(turn(b, id, 't_wait'), 0);
    };
    const r = run(true) / run(false);
    const want = (base + bonus) / base;
    assert.ok(Math.abs(r - want) < 0.08, `${id} ×${r.toFixed(3)} ≈ ${want.toFixed(3)}`);
  }
});

test('Fluff Snare: a spirit the opponent sends in is put under Leech Seed at once, Fluff Seeds +1', () => {
  const b = duel(fluff(['t_wait', 'dandelion_web']), dummy(['t_wait'], [{ id: 'digmole', skills: ['t_wait'] }]));
  turn(b, use('t_wait', 'dandelion_web'), 't_wait');
  const ev = turn(b, 't_wait', sw(1));
  assert.ok(ev.some((e) => e.k === 'trap' && (e as { skillId: string }).skillId === 'dandelion_web'));
  assert.equal(b.active(1).species.id, 'digmole');
  assert.ok(b.active(1).leechSeed);
  assert.equal(seedsOf(b), 1, 'already under Leech Seed, so nothing sprouts at the end of the turn');
});

test('Thousand-Seed Gale: sows 1 Fluff Seed that sprouts at once; a Decoy blocks the sprouting', () => {
  const b = duel(fluff(['dandelion_squall']), dummy(['t_wait']));
  sturdy(b);
  turn(b, 'dandelion_squall', 't_wait');
  assert.equal(b.active(1).leechSeed?.turns, 2, 'sprouts mid-action: it has already drained once this turn');
  assert.equal(seedsOf(b), 0);
  const d = duel(fluff(['dandelion_squall', 't_wait']), dummy(['t_wait', 't_substitute']));
  sturdy(d);
  turn(d, 't_wait', 't_substitute');
  turn(d, 'dandelion_squall', 't_wait');
  assert.equal(d.active(1).leechSeed?.turns, 3, 'the Decoy blocks the instant sprout, so it sprouts at the end of the turn instead');
  assert.equal(seedsOf(d), 0);
});

test('Crown of Seeds: sows a full 3 Fluff Seeds and sprouts at once', () => {
  const b = duel(fluff(['t_wait']), dummy(['t_wait']));
  sturdy(b);
  b.active(0).ultimate = 'u_dandelion';
  turn(b, 'u_dandelion', 't_wait');
  assert.ok(b.active(1).leechSeed);
  assert.equal(seedsOf(b), 2);
});

test('AI: Drifting Fluff first when there are no Fluff Seeds, no more sowing once full', () => {
  const b = duel(fluff(['dandelion_drift', 'dandelion_puff']), dummy(['t_wait']));
  b.side(1).ultUsed = true;
  assert.equal(aiPick(b), 'dandelion_drift');
  b.addLasting(1, SEEDS, 5, { side: true, n: 3, from: 0 });
  b.active(1).leechSeed = { turns: 3 };
  assert.equal(aiPick(b), 'dandelion_puff');
});

// ═════════════════════════ `papercrane`: Letters ═════════════════════════

const LETTERS = 'e:pc:letters';
const POST = 'papercrane_relay';
const lettersN = (b: Battle) => b.active(0).vars[LETTERS] ?? 0;
const postOf = (b: Battle) => b.side(0).lasting.find((l) => l.key === POST);
const crane = (skills: string[], extra: { id: string; skills?: string[] }[] = [{ id: 'pyre_dragoon', skills: ['t_strike'] }]) => [{ id: 'papercrane', skills }, ...extra];

test('Entrust (rewritten): the old trait is disabled', () => {
  const b = duel(crane(['t_wait']), dummy(['t_wait']));
  assert.ok(b.active(0).species.traitOverride);
  assert.equal(b.active(0).species.trait.name, '託付');
});

test('Paper Cut, Fold a Letter, Thousand Letters: write letters (max 3, shown on the spirit)', () => {
  const b = duel(crane(['papercrane_cut', 'papercrane_fold', 'papercrane_thousand']), dummy(['t_wait']));
  sturdy(b);
  const c = b.active(0);
  c.hp = Math.floor(c.maxHp * 0.5);
  turn(b, 'papercrane_cut', 't_wait');
  assert.equal(lettersN(b), 1);
  turn(b, 'papercrane_fold', 't_wait');
  assert.equal(lettersN(b), 3);
  assert.ok(Math.abs(c.hp / c.maxHp - 0.55) < 0.011, 'Fold a Letter heals 5%');
  const mark = b.view().sides[0].team[0].marks.find((m) => m.id === 'kit:letters');
  assert.equal(mark?.n, 3);
  turn(b, 'papercrane_thousand', 't_wait');
  assert.equal(lettersN(b), 3, 'at most 3 letters');
  assert.equal(postOf(b), undefined, 'with a bench teammate it does not open them itself');
});

test('Special Delivery: sends the letters when it switches out, and the teammate who takes over gets +20% attack damage per letter', () => {
  const run = (letters: number) => {
    const b = duel(crane(['papercrane_relay']), dummy(['t_wait']), 19);
    sturdy(b);
    b.active(0).vars[LETTERS] = letters;
    turn(b, 'papercrane_relay', 't_wait');
    assert.equal(b.active(0).species.id, 'pyre_dragoon');
    const left = postOf(b)?.turns;
    const ev = turn(b, 't_strike', 't_wait');
    return { b, left, dmg: plainDealt(ev, 0) };
  };
  const none = run(0);
  assert.equal(postOf(none.b), undefined);
  const two = run(2);
  assert.equal(postOf(two.b)?.n, 2);
  assert.equal(two.left, 3, '3 turns remain after the turn it was sent');
  const r = two.dmg / none.dmg;
  assert.ok(r > 1.33 && r < 1.47, `×${r.toFixed(3)} ≈ 1.4`);
  const cond = two.b.view().sides[0].conds.find((m) => m.id === `fx:${POST}`);
  assert.equal(cond?.note, '收信');
});

test('Entrust: when Thousand Cranes is knocked out, it sends one extra letter', () => {
  const b = duel(crane(['t_wait']), dummy(['t_strike']));
  b.active(0).vars[LETTERS] = 1;
  b.active(0).hp = 1;
  const ev = turn(b, 't_wait', 't_strike');
  assert.ok(b.side(0).team[0].fainted);
  assert.ok(traits(ev).includes('託付'));
  assert.equal(postOf(b)?.n, 2);
  b.replace([1, null]);
  assert.equal(b.active(0).species.id, 'pyre_dragoon');
  assert.equal(b.active(0).stages.atk, 0, 'the old Entrust (ATK and MAG +1) is disabled');
});

test('Letters: with no bench teammate, writing 3 letters makes it open them itself', () => {
  const b = duel([{ id: 'papercrane', skills: ['papercrane_fold', 'papercrane_cut'] }], dummy(['t_wait']));
  sturdy(b);
  turn(b, 'papercrane_fold', 't_wait');
  assert.equal(postOf(b), undefined);
  const ev = turn(b, 'papercrane_cut', 't_wait');
  assert.match(texts(ev), /自己拆開/);
  assert.equal(lettersN(b), 0);
  assert.equal(postOf(b)?.n, 3);
});

test('Thousand Cranes: the whole team heals 15%, and the letters are filled to 3', () => {
  const b = duel(crane(['t_wait']), dummy(['t_wait']));
  sturdy(b);
  b.active(0).ultimate = 'u_papercrane';
  const ally = b.side(0).team[1];
  ally.hp = Math.floor(ally.maxHp * 0.5);
  turn(b, 'u_papercrane', 't_wait');
  assert.equal(lettersN(b), 3);
  assert.ok(Math.abs(ally.hp / ally.maxHp - 0.65) < 0.011);
});

test('AI: folds letters first when it has few, and sends them to a teammate when it has many', () => {
  const b = duel(crane(['papercrane_fold', 'papercrane_relay']), dummy(['t_wait']));
  b.side(1).ultUsed = true;
  assert.equal(aiPick(b), 'papercrane_fold');
  b.active(0).vars[LETTERS] = 3;
  assert.equal(aiPick(b), 'papercrane_relay');
});
