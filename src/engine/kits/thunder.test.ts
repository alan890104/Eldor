// Mechanic tests for the thunder group: node --test src/engine/kits/thunder.test.ts
// `voltarion`: Swift Thunder (full charge plus hitting while moving first -> stun), Composure, plus the effect of every hooked skill.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Battle } from '../battle.ts';
import { registerKitHooks } from './index.ts';
import { KIT } from './thunder.ts';
import { chooseAction } from '../ai.ts';
import { duel, guard, hitsBy, sw, traits, turn, use, useTestSkills } from '../testkit.ts';
import type { BattleEvent, SideId } from '../types.ts';

useTestSkills();
// The opposing spirits carry no kit hooks (other groups' mechanics may still be changing); only the behavior of the t_ test skills is left
for (const id of ['cloudfluff', 'monolith']) registerKitHooks(id, null);

const STUN = 'voltarion_thunder_step';
const CALM = 'voltarion_startle';
const STUNNED = '被震懾，無法行動';

const kirin = (skills: string[]) => [{ id: 'voltarion', skills }];
/** Opponent: a sluggish `cloudfluff` (neutral, can be paralyzed), with one bench spirit for the switch tests */
const foe = (skills = ['t_strike', 't_bolt', 't_wait', 't_quick_strike']) => [{ id: 'cloudfluff', skills }, { id: 'cloudfluff', skills }];
/** Lets the opponent survive (the tests check effects, not KOs) */
const sturdy = (b: Battle, id: SideId = 1) => {
  const d = b.active(id);
  d.maxHp = d.hp = 100000;
};
const setSpd = (b: Battle, id: SideId, v: number) => void (b.active(id).stats.spd = v);
const setCharges = (b: Battle, n: number) => void (b.active(0).charges = n);
const failsOf = (ev: BattleEvent[], side: SideId) => ev.filter((e) => e.k === 'fail' && (e as { side: SideId }).side === side).map((e) => (e as { reason: string }).reason);
const usedBy = (ev: BattleEvent[], side: SideId) => ev.filter((e) => e.k === 'use' && (e as { side: SideId }).side === side).map((e) => (e as { skillId: string }).skillId);
const dealt = (ev: BattleEvent[], side: SideId) => hitsBy(ev, side).reduce((a, h) => a + h.dmg + h.shieldDmg, 0);
const swiftMark = (b: Battle) => b.view().sides[0].team[b.side(0).active].marks.some((m) => m.id === 'kit:swift');

/** The qilin is fast, the opponent is slow and survives */
function ready(skills: string[], foeSkills?: string[]): Battle {
  const b = duel(kirin(skills), foe(foeSkills));
  sturdy(b);
  setSpd(b, 0, 500);
  setSpd(b, 1, 10);
  return b;
}

// ───────────────────────── Traits and mechanics ─────────────────────────

test('Thunder Descent (unchanged): entering sets Thundercloud for 3 turns and grants 2 stacks of charge; at 3 stacks the Swift Thunder mark shows', () => {
  const b = duel(kirin(['voltarion_thunder_step']), foe());
  assert.equal(b.s.field?.element, 'thunder');
  assert.equal(b.s.field?.turns, 3);
  assert.equal(b.active(0).charges, 2);
  assert.equal(swiftMark(b), false);
  setCharges(b, 3);
  assert.equal(swiftMark(b), true);
});

test('Swift Thunder: with 3 stacks of charge, moving first and hitting spends the 3 stacks, stuns the opponent for the turn, and gives it Composure', () => {
  const b = ready(['voltarion_thunder_step']);
  setCharges(b, 3);
  const ev = turn(b, 'voltarion_thunder_step', 't_strike');
  assert.deepEqual(usedBy(ev, 1), [], 'Opponent did not act');
  assert.ok(failsOf(ev, 1).includes(STUNNED));
  assert.equal(dealt(ev, 1), 0);
  // The 3 stacks are spent, then `voltarion_thunder_step` moves first and gives +1
  assert.equal(b.active(0).charges, 1);
  assert.ok(b.getLasting(1, CALM), 'Opponent gains Composure');
  assert.equal(b.getLasting(1, STUN), undefined, 'Stun lasts only this turn');
});

test('Composure: a spirit that was just stunned cannot be stunned again next turn, and the charge is not wasted', () => {
  const b = ready(['voltarion_thunder_step']);
  setCharges(b, 3);
  turn(b, 'voltarion_thunder_step', 't_strike');
  setCharges(b, 3);
  const ev = turn(b, 'voltarion_thunder_step', 't_strike');
  assert.deepEqual(usedBy(ev, 1), ['t_strike'], 'Acts normally during Composure');
  assert.equal(b.active(0).charges, 3);
  // After Composure ends it can be stunned again
  const ev2 = turn(b, 'voltarion_thunder_step', 't_strike');
  assert.ok(failsOf(ev2, 1).includes(STUNNED));
});

test('Swift Thunder: no stun with fewer than 3 stacks of charge, or when moving last', () => {
  const b = ready(['voltarion_thunder_step']);
  setCharges(b, 2);
  let ev = turn(b, 'voltarion_thunder_step', 't_strike');
  assert.deepEqual(usedBy(ev, 1), ['t_strike']);
  // The opponent seizes the initiative with a priority attack: the qilin moves last, charge is kept
  setCharges(b, 3);
  ev = turn(b, 'voltarion_thunder_step', 't_quick_strike');
  assert.deepEqual(usedBy(ev, 1), ['t_quick_strike']);
  assert.equal(b.active(0).charges, 3);
  assert.equal(b.getLasting(1, CALM), undefined);
});

test('Counters to Swift Thunder: Guard (priority +3) blocks the attack so there is no stun and the charge is kept; switching out leaves the field first', () => {
  const b = ready(['voltarion_thunder_step']);
  setCharges(b, 3);
  let ev = turn(b, 'voltarion_thunder_step', guard());
  assert.ok(ev.some((e) => e.k === 'guarded'));
  assert.equal(b.active(0).charges, 3, 'Charge is not spent when guarded');
  assert.equal(b.getLasting(1, CALM), undefined);
  // A switch always goes first: the incoming spirit takes the attack, but the opponent has already acted, so it is not stunned
  ev = turn(b, 'voltarion_thunder_step', sw(1));
  assert.equal(b.side(1).active, 1);
  assert.equal(b.getLasting(1, CALM), undefined);
  assert.equal(b.active(0).charges, 3);
});

test('Stun: status skills and ultimates are blocked too (via the new lasting-effect hook blockAction)', () => {
  const b = duel(kirin(['voltarion_thunder_step']), [{ id: 'cloudfluff', skills: ['t_war_cry'] }]);
  sturdy(b);
  setSpd(b, 0, 500);
  setSpd(b, 1, 10);
  setCharges(b, 3);
  const ev = turn(b, 'voltarion_thunder_step', 't_war_cry');
  assert.ok(failsOf(ev, 1).includes(STUNNED));
  assert.equal(b.active(1).stages.atk, 0, 'The buff did not apply');
});

// ───────────────────────── Skills ─────────────────────────

test('Thunder Step: gains 1 stack of charge when moving first, none when moving last', () => {
  const b = ready(['voltarion_thunder_step']);
  setCharges(b, 0);
  turn(b, 'voltarion_thunder_step', 't_wait');
  assert.equal(b.active(0).charges, 1);
  setSpd(b, 1, 5000);
  turn(b, 'voltarion_thunder_step', 't_wait');
  assert.equal(b.active(0).charges, 1);
});

test('Startling Bolt: priority +1, so Swift Thunder triggers first even when slower', () => {
  const b = ready(['voltarion_startle']);
  setSpd(b, 1, 5000);
  setCharges(b, 3);
  const ev = turn(b, 'voltarion_startle', 't_strike');
  assert.deepEqual(usedBy(ev, 0), ['voltarion_startle']);
  assert.ok(failsOf(ev, 1).includes(STUNNED));
});

test('Storm Net: gains 2 stacks of charge when the opponent is already paralyzed', () => {
  const b = ready(['voltarion_storm_net']);
  setCharges(b, 0);
  b.applyStatus(1, 'paralyze');
  turn(b, 'voltarion_storm_net', 't_wait');
  assert.equal(b.active(0).charges, 2);
  b.removeStatus(1, 'paralyze');
  b.s.field = null;
  setCharges(b, 0);
  turn(b, 'voltarion_storm_net', 't_wait');
  assert.equal(b.active(0).charges, 0, 'No charge gained when the opponent is not paralyzed');
});

test('Summon Storm: resets Thundercloud for 5 turns and gains 2 stacks of charge', () => {
  const b = ready(['voltarion_summon_storm']);
  b.s.field = { element: 'fire', turns: 2 };
  setCharges(b, 0);
  turn(b, 'voltarion_summon_storm', 't_wait');
  assert.equal(b.s.field?.element, 'thunder');
  assert.equal(b.s.field?.turns, 4, '5 turns, 4 left after this turn ends');
  assert.equal(b.active(0).charges, 2);
});

test('Thunder Smite: ignores Guard; breaking through a Guard gains 2 stacks of charge (the guarding opponent has already acted, so it is not stunned)', () => {
  const b = ready(['voltarion_smite']);
  setCharges(b, 1);
  const ev = turn(b, 'voltarion_smite', guard());
  assert.ok(dealt(ev, 0) > 0, 'Pierces Guard');
  assert.equal(b.active(0).charges, 3);
  assert.equal(b.getLasting(1, CALM), undefined);
  // Next turn the opponent cannot guard on consecutive turns, so Swift Thunder is ready
  const ev2 = turn(b, 'voltarion_smite', 't_strike');
  assert.ok(failsOf(ev2, 1).includes(STUNNED));
});

test('Lightning Rod Array: reduces damage by 30% when attacked, and the active ally gains 3 stacks of charge', () => {
  const b = ready(['voltarion_rod_array', 't_wait']);
  const d = b.active(0);
  d.maxHp = d.hp = 100000;
  const plain = dealt(turn(b, 't_wait', 't_strike'), 1);
  setCharges(b, 0);
  // An ordinary trap: it can fire only from the turn after it is set
  turn(b, { ...use('t_wait'), trap: 'voltarion_rod_array' }, 't_wait');
  assert.equal(b.active(0).charges, 0);
  const ev = turn(b, 't_wait', 't_strike');
  assert.ok(ev.some((e) => e.k === 'trap' && (e as { skillId: string }).skillId === 'voltarion_rod_array'));
  assert.equal(b.active(0).charges, 3);
  const reduced = dealt(ev, 1);
  assert.ok(reduced < plain * 0.8, `Damage reduction:${reduced} vs ${plain}`);
});

test('Thunderflash: priority +1; power +40 at full charge', () => {
  const b = ready(['voltarion_flash']);
  setCharges(b, 2);
  const low = b.estimate(0, 'voltarion_flash');
  setCharges(b, 3);
  const high = b.estimate(0, 'voltarion_flash');
  const r = high / low;
  assert.ok(r > 1.4 && r < 1.55, `125 / 85 ≈ 1.47, actual${r.toFixed(2)}`);
  setSpd(b, 1, 5000);
  const ev = turn(b, 'voltarion_flash', 't_strike');
  assert.equal(usedBy(ev, 1).length, 0, 'Priority moves first and stuns');
});

test('Thunder Edict: for 3 turns physical and magic skills get priority +1, and gains 1 stack of charge', () => {
  const b = ready(['voltarion_edict', 'voltarion_thunder_step']);
  setSpd(b, 1, 5000);
  setCharges(b, 0);
  turn(b, 'voltarion_edict', 't_wait');
  assert.equal(b.active(0).charges, 1);
  assert.ok(b.getLasting(0, 'voltarion_edict'));
  setCharges(b, 3);
  const ev = turn(b, 'voltarion_thunder_step', 't_strike');
  const order = ev.filter((e) => e.k === 'use').map((e) => (e as { side: SideId }).side);
  assert.equal(order[0], 0, 'Slower but moves first');
  assert.ok(failsOf(ev, 1).includes(STUNNED));
  turn(b, 'voltarion_thunder_step', 't_wait');
  assert.equal(b.getLasting(0, 'voltarion_edict'), undefined, 'Ends after 3 turns');
});

test('Thunderclap: power +40 and gains 1 stack of charge when moving last', () => {
  const b = ready(['voltarion_thunderclap']);
  const first = b.estimate(0, 'voltarion_thunderclap');
  setSpd(b, 1, 5000);
  const second = b.estimate(0, 'voltarion_thunderclap');
  const r = second / first;
  assert.ok(r > 1.45 && r < 1.55, `120 / 80 = 1.5, actual${r.toFixed(2)}`);
  setCharges(b, 0);
  turn(b, 'voltarion_thunderclap', 't_strike');
  assert.equal(b.active(0).charges, 1);
  setSpd(b, 1, 10);
  turn(b, 'voltarion_thunderclap', 't_strike');
  assert.equal(b.active(0).charges, 1, 'No charge gained when moving first');
});

test('Heaven Cannon: Charging turn; on release, moving first and hitting stuns without needing any charge', () => {
  const b = ready(['voltarion_sky_cannon']);
  setCharges(b, 0);
  const ev1 = turn(b, 'voltarion_sky_cannon', 't_wait');
  assert.equal(b.active(0).charging, 'voltarion_sky_cannon');
  assert.equal(dealt(ev1, 0), 0);
  const ev2 = turn(b, 'voltarion_sky_cannon', 't_strike');
  assert.ok(dealt(ev2, 0) > 0);
  assert.ok(failsOf(ev2, 1).includes(STUNNED));
  assert.equal(b.active(0).charges, 0);
});

test('Myriad Thunder: power +60 while the opponent has Composure (just stunned)', () => {
  const b = ready(['voltarion_myriad', 'voltarion_thunder_step']);
  const plain = b.estimate(0, 'voltarion_myriad');
  setCharges(b, 3);
  turn(b, 'voltarion_thunder_step', 't_strike');
  assert.ok(b.getLasting(1, CALM));
  const boosted = b.estimate(0, 'voltarion_myriad');
  const r = boosted / plain;
  assert.ok(r > 1.45 && r < 1.55, `180 / 120 = 1.5, actual${r.toFixed(2)}`);
});

test('Ninefold Judgment: priority +2, +40 per stack of charge and spends all of it; hitting first stuns even without charge', () => {
  const b = ready(['t_wait']);
  const ult = 'u_voltarion';
  setCharges(b, 0);
  const zero = b.estimate(0, ult);
  setCharges(b, 3);
  const full = b.estimate(0, ult);
  const r = full / zero;
  assert.ok(r > 1.75 && r < 1.85, `270 / 150 = 1.8, actual${r.toFixed(2)}`);
  setCharges(b, 1);
  setSpd(b, 1, 5000);
  const ev = turn(b, ult, 't_strike');
  assert.equal(b.active(0).charges, 0);
  assert.ok(failsOf(ev, 1).includes(STUNNED), 'Priority +2 moves first, and even 1 stack of charge stuns');
});

// ═════════════════════════ `thunderbird`: Storm Clock ═════════════════════════

const STORM = 'thunderbird_gather_clouds';
const bird = (skills: string[]) => [{ id: 'thunderbird', skills }];
const clock = (b: Battle) => b.active(0).vars['e:tbd:clock'] ?? 0;
const storm = (b: Battle) => b.getLasting(0, STORM)?.turns ?? 0;
const hitsOf = (ev: BattleEvent[], skillId: string) => hitsBy(ev, 0).filter((h) => h.skillId === skillId).length;
const clockMark = (b: Battle) => b.view().sides[0].team[b.side(0).active].marks.find((m) => m.id === 'kit:storm_clock');
/** The bird is fast, the opponent is slow and survives */
function birdReady(skills: string[], foeSkills?: string[]): Battle {
  const b = duel(bird(skills), foe(foeSkills));
  sturdy(b);
  setSpd(b, 0, 500);
  setSpd(b, 1, 10);
  return b;
}
/** Brings the Thunderstorm directly: sets the clock to 2, then passes a turn with `thunderbird_gust_feather` */
function toStorm(b: Battle): void {
  b.active(0).vars['e:tbd:clock'] = 2;
  turn(b, 'thunderbird_gust_feather', 't_wait');
  assert.equal(storm(b), 2, 'Thunderstorm arrives and lasts the next 2 turns');
}

test('Stormcloud (rewritten): the Storm Clock starts at 1 notch on entering and is shown; the old trait "lightning every 2 turns" no longer fires', () => {
  const b = birdReady(['thunderbird_gather_clouds', 'thunderbird_twin_bolt']);
  assert.equal(clock(b), 1);
  assert.equal(clockMark(b)?.n, 1);
  // Turn 1 `thunderbird_gather_clouds`: 1 + 2 = 3 -> at the end of the turn the Thunderstorm arrives and a bolt strikes for 8% (`thunderbird_gather_clouds` itself deals no damage)
  const hp0 = b.active(1).hp;
  turn(b, 'thunderbird_gather_clouds', 't_wait');
  const bolt = hp0 - b.active(1).hp;
  assert.equal(storm(b), 2);
  assert.equal(clock(b), 0);
  assert.equal(clockMark(b), undefined, 'The clock is hidden during a Thunderstorm');
  assert.ok(Math.abs(bolt - b.active(1).maxHp * 0.08) <= 1, `Lightning strike 8%:${bolt}`);
  // Turn 2 (an even turn) no longer has the old trait's 8%: the bird guards, the opponent waits, HP is unchanged
  const hp1 = b.active(1).hp;
  turn(b, guard(), 't_wait');
  assert.equal(b.active(1).hp, hp1);
});

test('Storm Clock: advances 1 notch at the end of each turn, 1 more if a wind skill was used; it does not move during a Thunderstorm, which ends after 2 turns', () => {
  const b = birdReady(['thunderbird_gust_feather', 'thunderbird_twin_bolt']);
  b.active(0).vars['e:tbd:clock'] = 0;
  turn(b, 'thunderbird_twin_bolt', 't_wait');
  assert.equal(clock(b), 1, 'Thunder element: advances only 1 notch');
  turn(b, 'thunderbird_gust_feather', 't_wait');
  assert.equal(storm(b), 2, '1 + 1 + 1 = 3: Thunderstorm arrives');
  turn(b, 'thunderbird_gust_feather', 't_wait');
  assert.equal(clock(b), 0, 'The clock does not move during a Thunderstorm, even for wind');
  assert.equal(storm(b), 1);
  turn(b, 'thunderbird_twin_bolt', 't_wait');
  assert.equal(storm(b), 0, 'Ends after 2 turns');
  assert.equal(clock(b), 0);
  turn(b, 'thunderbird_twin_bolt', 't_wait');
  assert.equal(clock(b), 1, 'The clock moves again after the Thunderstorm ends');
});

test('Storm Clock: on leaving, both the clock and the Thunderstorm vanish; re-entering starts again from 1 notch', () => {
  const b = duel([...bird(['thunderbird_gust_feather']), { id: 'cloudfluff', skills: ['t_wait'] }], foe());
  sturdy(b);
  toStorm(b);
  turn(b, sw(1), 't_wait');
  turn(b, sw(0), 't_wait');
  assert.equal(storm(b), 0);
  assert.equal(clock(b), 2, '1 notch on entering, +1 at the end of the turn');
});

test('Counter to the Thunderstorm: removing timed effects clears it', () => {
  const b = birdReady(['thunderbird_gust_feather', 't_wait'], ['thunderbird_sweep_clouds', 't_wait']);
  toStorm(b);
  turn(b, 't_wait', 'thunderbird_sweep_clouds');
  assert.equal(storm(b), 0);
});

test('Gust Feather: a wind attack that advances the Storm Clock', () => {
  const b = birdReady(['thunderbird_gust_feather']);
  b.active(0).vars['e:tbd:clock'] = 0;
  const ev = turn(b, 'thunderbird_gust_feather', 't_wait');
  assert.equal(hitsOf(ev, 'thunderbird_gust_feather'), 1);
  assert.equal(clock(b), 2);
});

test('Twin Bolt: hits 2 times, 4 during a Thunderstorm', () => {
  const b = birdReady(['thunderbird_gust_feather', 'thunderbird_twin_bolt']);
  b.active(0).vars['e:tbd:clock'] = 0;
  assert.equal(hitsOf(turn(b, 'thunderbird_twin_bolt', 't_wait'), 'thunderbird_twin_bolt'), 2);
  toStorm(b);
  assert.equal(hitsOf(turn(b, 'thunderbird_twin_bolt', 't_wait'), 'thunderbird_twin_bolt'), 4);
});

test('Gather Clouds: Storm Clock +2; cannot be used during a Thunderstorm', () => {
  const b = birdReady(['thunderbird_gust_feather', 'thunderbird_gather_clouds']);
  b.active(0).vars['e:tbd:clock'] = 0;
  turn(b, 'thunderbird_gather_clouds', 't_wait');
  assert.equal(storm(b), 2, '0 + 2 + 1 = 3: Thunderstorm from next turn');
  assert.equal(b.canUse(0, 'thunderbird_gather_clouds').ok, false);
});

test('Bolt Rain: hits 3 times (5 during a Thunderstorm), 10% paralysis per hit; thunder-element opponents cannot be paralyzed', () => {
  const b = birdReady(['thunderbird_gust_feather', 'thunderbird_bolt_rain']);
  b.active(0).vars['e:tbd:clock'] = 0;
  const rng = b.rng.bind(b);
  (b as { rng: () => number }).rng = () => 0.05;
  const ev = turn(b, 'thunderbird_bolt_rain', 't_wait');
  (b as { rng: () => number }).rng = rng;
  assert.equal(hitsOf(ev, 'thunderbird_bolt_rain'), 3);
  assert.ok(b.active(1).status.paralyze, 'Rolled within 10%: paralyzed');
  delete b.active(1).status.paralyze;
  toStorm(b);
  assert.equal(hitsOf(turn(b, 'thunderbird_bolt_rain', 't_wait'), 'thunderbird_bolt_rain'), 5);
  const t = duel(bird(['thunderbird_bolt_rain']), [{ id: 'voltarion', skills: ['t_wait'] }]);
  sturdy(t);
  (t as { rng: () => number }).rng = () => 0.05;
  const ev2 = turn(t, 'thunderbird_bolt_rain', 't_wait');
  assert.equal(t.active(1).status.paralyze, undefined);
  assert.ok(!ev2.some((e) => e.k === 'resist'), 'Does not show "paralysis has no effect" on every hit');
});

test('Cloud Sweep: clears timed effects on the opponent and advances the Storm Clock', () => {
  const b = birdReady(['thunderbird_sweep_clouds']);
  b.active(0).vars['e:tbd:clock'] = 0;
  b.addLasting(1, 'voltarion_edict', 3);
  turn(b, 'thunderbird_sweep_clouds', 't_wait');
  assert.equal(b.getLasting(1, 'voltarion_edict'), undefined);
  assert.equal(clock(b), 2);
});

test('Thousand Bolts: hits 4 times, 6 during a Thunderstorm', () => {
  const b = birdReady(['thunderbird_gust_feather', 'thunderbird_thousand_bolts']);
  b.active(0).vars['e:tbd:clock'] = 0;
  assert.equal(hitsOf(turn(b, 'thunderbird_thousand_bolts', 't_wait'), 'thunderbird_thousand_bolts'), 4);
  toStorm(b);
  assert.equal(hitsOf(turn(b, 'thunderbird_thousand_bolts', 't_wait'), 'thunderbird_thousand_bolts'), 6);
});

test('Cloud Ambush: when the opponent uses a status skill, lightning strikes for 12% and the Storm Clock fills up (during a Thunderstorm it extends it by 1 turn instead)', () => {
  const b = birdReady(['thunderbird_twin_bolt', 'thunderbird_cloud_ambush', 't_wait', 'thunderbird_gust_feather']);
  b.active(0).vars['e:tbd:clock'] = 0;
  turn(b, { ...use('t_wait'), trap: 'thunderbird_cloud_ambush' }, 't_strike');
  assert.equal(clock(b), 1, 'An attack does not trigger it');
  const hp = b.active(1).hp;
  const ev = turn(b, 't_wait', 't_wait');
  assert.ok(ev.some((e) => e.k === 'trap' && (e as { skillId: string }).skillId === 'thunderbird_cloud_ambush'));
  const lost = hp - b.active(1).hp;
  // 12% ambush + 8% from the Thunderstorm arriving
  assert.ok(Math.abs(lost - b.active(1).maxHp * 0.2) <= 2, `Total 20%:${lost}`);
  assert.equal(storm(b), 2);
  // Triggered again during a Thunderstorm: extends it by 1 turn
  turn(b, { ...use('t_wait'), trap: 'thunderbird_cloud_ambush' }, 't_strike');
  assert.equal(storm(b), 1);
  turn(b, 't_wait', 't_wait');
  assert.equal(storm(b), 1, '1 − 1 + 1');
});

test('Cloud Roost: heals 40% of max HP and advances the Storm Clock', () => {
  const b = birdReady(['thunderbird_roost']);
  b.active(0).vars['e:tbd:clock'] = 0;
  const me = b.active(0);
  me.hp = Math.floor(me.maxHp * 0.3);
  turn(b, 'thunderbird_roost', 't_wait');
  assert.ok(Math.abs(me.hp - me.maxHp * 0.7) <= 2);
  assert.equal(clock(b), 2);
});

test('Gale Spiral: priority +1, moves first even when slower; advances the Storm Clock', () => {
  const b = birdReady(['thunderbird_gale_spiral']);
  b.active(0).vars['e:tbd:clock'] = 0;
  setSpd(b, 1, 5000);
  const ev = turn(b, 'thunderbird_gale_spiral', 't_strike');
  const order = ev.filter((e) => e.k === 'use').map((e) => (e as { side: SideId }).side);
  assert.deepEqual(order, [0, 1]);
  assert.equal(clock(b), 2);
});

test('Storm Unleashed: 4 hits outside a Thunderstorm; 10 hits with 2 turns of Thunderstorm left, 7 hits with 1 turn left, after which the Thunderstorm ends (even when guarded)', () => {
  const b = birdReady(['thunderbird_gust_feather', 'thunderbird_storm_unleashed']);
  b.active(0).vars['e:tbd:clock'] = 0;
  const id = 'thunderbird_storm_unleashed';
  assert.equal(hitsOf(turn(b, id, 't_wait'), id), 4);
  toStorm(b);
  assert.equal(hitsOf(turn(b, id, 't_wait'), id), 10);
  assert.equal(storm(b), 0);
  toStorm(b);
  turn(b, 'thunderbird_gust_feather', 't_wait');
  assert.equal(storm(b), 1);
  assert.equal(hitsOf(turn(b, id, 't_wait'), id), 7);
  toStorm(b);
  const ev = turn(b, id, guard());
  assert.equal(hitsOf(ev, id), 0);
  assert.equal(storm(b), 0, 'Guarded, yet the Thunderstorm still clears');
});

test('Thunderbird Descent: hits 5 times and a Thunderstorm arrives after the hit; during a Thunderstorm 7 hits and extends it by 2 turns', () => {
  const b = birdReady(['thunderbird_gust_feather']);
  b.active(0).vars['e:tbd:clock'] = 0;
  const hp = b.active(1).hp;
  const ev = turn(b, 'u_thunderbird', 't_wait');
  assert.equal(hitsOf(ev, 'u_thunderbird'), 5);
  assert.equal(storm(b), 2);
  assert.ok(hp - b.active(1).hp > b.active(1).maxHp * 0.08, 'Includes the 8% lightning strike');
  b.side(0).ultUsed = false;
  const ev2 = turn(b, 'u_thunderbird', 't_wait');
  assert.equal(hitsOf(ev2, 'u_thunderbird'), 7);
  assert.equal(storm(b), 3, '2 − 1 + 2');
});

// ═════════════════════════ `stormram`: Overcharge ═════════════════════════

const ram = (skills: string[]) => [{ id: 'stormram', skills }];
const ocOf = (b: Battle) => b.active(0).vars['e:srm:oc'] ?? 0;
const setBank = (b: Battle, ch: number, oc: number) => {
  b.active(0).charges = ch;
  b.active(0).vars['e:srm:oc'] = oc;
};
/** The ram is slow, the opponent is fast (it takes the hit first); both sides survive */
function ramReady(skills: string[], foeSkills?: string[]): Battle {
  const b = duel(ram(skills), foe(foeSkills));
  sturdy(b);
  sturdy(b, 0);
  return b;
}

test('Charged Wool (rewritten): gains 1 stack of charge on entering and at the end of each turn', () => {
  const b = ramReady(['t_wait']);
  assert.equal(b.active(0).charges, 1);
  turn(b, 't_wait', 't_wait');
  assert.equal(b.active(0).charges, 2);
});

test('Overcharge: charge past 3 stacks overflows into Overcharge (max 3 stacks), and a mark is shown', () => {
  const b = ramReady(['t_wait']);
  setBank(b, 3, 0);
  b.addCharges(0, 2);
  assert.equal(b.active(0).charges, 3);
  assert.equal(ocOf(b), 2);
  b.addCharges(0, 5);
  assert.equal(ocOf(b), 3, 'Max 3 stacks');
  const mark = b.view().sides[0].team[b.side(0).active].marks.find((m) => m.id === 'kit:overcharge');
  assert.equal(mark?.n, 3);
});

test('Cost of Overcharge: each stack leaks 5% of max HP at the end of the turn', () => {
  const b = ramReady(['t_wait']);
  setBank(b, 3, 1);
  const me = b.active(0);
  const hp = me.hp;
  turn(b, 't_wait', 't_wait');
  // At the end of the turn it first leaks 1 x 5%, then charge +1 (overflowing into the 2nd stack of Overcharge)
  assert.ok(Math.abs(hp - me.hp - me.maxHp * 0.05) <= 2, `Leak${hp - me.hp}`);
  assert.equal(ocOf(b), 2);
});

test('Discharge: +25 per stack of charge and +50 per stack of Overcharge; all are spent after use, even if guarded', () => {
  const b = ramReady(['stormram_discharge']);
  setBank(b, 0, 0);
  const bare = b.estimate(0, 'stormram_discharge');
  setBank(b, 3, 3);
  const full = b.estimate(0, 'stormram_discharge');
  const r = full / bare;
  assert.ok(r > 6.4 && r < 6.8, `265 / 40 ≈ 6.6, actual${r.toFixed(2)}`);
  turn(b, 'stormram_discharge', guard());
  assert.equal(ocOf(b), 0);
  assert.equal(b.active(0).charges, 1, 'Still fully discharged when guarded, then +1 at the end of the turn');
});

test('Wool Charge: gains 2 stacks of charge and heals 10%, overflowing into Overcharge when full', () => {
  const b = ramReady(['stormram_wool_charge']);
  setBank(b, 0, 0);
  const me = b.active(0);
  me.hp = Math.floor(me.maxHp / 2);
  const hp = me.hp;
  turn(b, 'stormram_wool_charge', 't_wait');
  assert.equal(me.charges, 3, '2 + 1 at the end of the turn');
  assert.ok(Math.abs(me.hp - hp - me.maxHp * 0.1) <= 2, 'Heals 10%');
  setBank(b, 2, 0);
  turn(b, 'stormram_wool_charge', 't_wait');
  // 2 + 2 = 4 -> 1 stack of Overcharge; +1 at the end of the turn -> 2 stacks
  assert.equal(ocOf(b), 2);
});

test('Vent: cannot be used without Overcharge; spends all Overcharge, healing 12% per stack', () => {
  const b = ramReady(['stormram_vent']);
  setBank(b, 3, 0);
  assert.equal(b.canUse(0, 'stormram_vent').ok, false);
  setBank(b, 3, 2);
  const me = b.active(0);
  me.hp = Math.floor(me.maxHp / 2);
  const hp = me.hp;
  turn(b, 'stormram_vent', 't_wait');
  // Heals 24% (Overcharge is fully vented, so no leak); +1 charge at the end of the turn overflows into 1 stack of Overcharge
  assert.ok(Math.abs(me.hp - hp - me.maxHp * 0.24) <= 3, `Healed${me.hp - hp}`);
  assert.equal(ocOf(b), 1);
});

test('Horn Cannon: gains 2 stacks of charge after hitting', () => {
  const b = ramReady(['stormram_horn_cannon']);
  setBank(b, 0, 0);
  turn(b, 'stormram_horn_cannon', 't_wait');
  assert.equal(b.active(0).charges, 3, '2 + 1 at the end of the turn');
});

test('Wool Cushion: when about to be knocked out, survives with 1 HP, vents all Overcharge and refills charge to 3 stacks (cannot be finished off by the leak)', () => {
  const b = duel(ram(['t_wait', 'stormram_wool_cushion']), foe());
  sturdy(b);
  turn(b, { ...use('t_wait'), trap: 'stormram_wool_cushion' }, 't_wait');
  setBank(b, 1, 2);
  const me = b.active(0);
  me.hp = 5;
  turn(b, 't_wait', 't_strike');
  assert.equal(me.fainted, false);
  assert.equal(me.hp, 1);
  assert.equal(me.charges, 3);
  assert.equal(ocOf(b), 1, 'After venting everything, the +1 at the end of the turn overflows into 1 stack');
});

test('Overcharge Arc: +20 power per stack of Overcharge, not spent', () => {
  const b = ramReady(['stormram_arc']);
  setBank(b, 3, 0);
  const bare = b.estimate(0, 'stormram_arc');
  setBank(b, 3, 3);
  const r = b.estimate(0, 'stormram_arc') / bare;
  assert.ok(r > 1.7 && r < 1.8, `140 / 80 = 1.75, actual${r.toFixed(2)}`);
  turn(b, 'stormram_arc', 't_wait');
  assert.equal(ocOf(b), 3);
});

test('Insulated Wool: Overcharge does not leak for 3 turns', () => {
  const b = ramReady(['stormram_insulate', 't_wait']);
  setBank(b, 3, 2);
  const me = b.active(0);
  const hp = me.hp;
  turn(b, 'stormram_insulate', 't_wait');
  turn(b, 't_wait', 't_wait');
  assert.equal(me.hp, hp);
  assert.ok(b.getLasting(0, 'stormram_insulate'));
});

test('Megavolt Overload: 15% damage per stack of Overcharge, spending only Overcharge; ignores Guard at 3 stacks, and below 3 stacks it is still spent when blocked', () => {
  const b = ramReady(['stormram_overload']);
  setBank(b, 3, 2);
  const d = b.active(1);
  let hp = d.hp;
  let ev = turn(b, 'stormram_overload', 't_wait');
  const hit = dealt(ev, 0);
  assert.ok(Math.abs(hp - d.hp - hit - d.maxHp * 0.3) <= 2, '30% percentage damage');
  assert.equal(b.active(0).charges, 3, 'Charge is kept');
  assert.equal(ocOf(b), 1, 'Overcharge used up; charge is kept, and the +1 at the end of the turn overflows 1 stack again');
  setBank(b, 3, 2);
  hp = d.hp;
  ev = turn(b, 'stormram_overload', guard());
  assert.equal(d.hp, hp, 'Guarded');
  assert.equal(ocOf(b), 1, 'Overcharge is still spent (1 stack overflows again at the end of the turn)');
  turn(b, 't_wait', 't_wait');
  setBank(b, 3, 3);
  hp = d.hp;
  turn(b, 'stormram_overload', guard());
  assert.ok(hp - d.hp > d.maxHp * 0.45 - 2, '3 stacks: ignores Guard');
});

test('Thunderhorn Judgment: +35 power per stack of charge and Overcharge, all spent after use', () => {
  const b = ramReady(['t_wait']);
  setBank(b, 0, 0);
  const bare = b.estimate(0, 'u_stormram');
  setBank(b, 3, 3);
  const r = b.estimate(0, 'u_stormram') / bare;
  assert.ok(r > 2.1 && r < 2.2, `390 / 180 ≈ 2.17, actual${r.toFixed(2)}`);
  turn(b, 'u_stormram', 't_wait');
  assert.equal(ocOf(b), 0);
  assert.equal(b.active(0).charges, 1);
});

// ═════════════════════════ `stormhorse`: Thunder Hoof Pursuit ═════════════════════════

const HOOF = 'stormhorse_thunder_hoof';
const horse = (skills: string[]) => [{ id: 'stormhorse', skills }];
const hoofs = (ev: BattleEvent[]) => usedBy(ev, 0).filter((s) => s === HOOF).length;
const para = (b: Battle, turns = 2) => void (b.active(1).status.paralyze = { turns });
function horseReady(skills: string[], foeSkills?: string[]): Battle {
  const b = duel(horse(skills), foe(foeSkills));
  sturdy(b);
  setSpd(b, 0, 500);
  setSpd(b, 1, 10);
  return b;
}

test('Thunder Hoof Pursuit: after an attack hits a paralyzed opponent, an extra Thunder Hoof follows (once per turn); no pursuit when the opponent is not paralyzed', () => {
  const b = horseReady(['stormhorse_mane_jolt', HOOF]);
  (b as { rng: () => number }).rng = () => 0.99;
  let ev = turn(b, 'stormhorse_mane_jolt', 't_wait');
  assert.equal(hoofs(ev), 0);
  para(b);
  ev = turn(b, 'stormhorse_mane_jolt', 't_wait');
  assert.deepEqual(usedBy(ev, 0), ['stormhorse_mane_jolt', HOOF]);
  assert.ok(ev.some((e) => e.k === 'text' && (e as { text: string }).text === '馬群追擊！'));
});

test('Thunder Hoof: hitting a paralyzed opponent extends the paralysis by 1 turn (at most 2 turns left); without a stomp it wears off as usual', () => {
  const b = horseReady([HOOF, 't_wait']);
  para(b, 1);
  turn(b, HOOF, 't_wait');
  assert.equal(b.active(1).status.paralyze?.turns, 1, 'Extended to 2 (a pursuit stomp does not exceed 2), −1 at the end of the turn');
  turn(b, 't_wait', 't_wait');
  assert.equal(b.active(1).status.paralyze, undefined, 'No hit this turn, so the paralysis ends');
});

test('Paralysis removes the priority of Guard: the faster Storm Steed still stomps, and the pursuit still happens', () => {
  const b = horseReady([HOOF]);
  para(b);
  const ev = turn(b, HOOF, guard());
  assert.equal(hoofs(ev), 2);
});

test('Thunder Hoof Pursuit: thunder-element opponents cannot be paralyzed, so they are not pursued', () => {
  const b = duel(horse(['stormhorse_shock_hoof']), [{ id: 'voltarion', skills: ['t_wait'] }]);
  sturdy(b);
  (b as { rng: () => number }).rng = () => 0.01;
  const ev = turn(b, 'stormhorse_shock_hoof', 't_wait');
  assert.equal(b.active(1).status.paralyze, undefined);
  assert.equal(hoofs(ev), 0);
});

test('Mane Jolt: 30% to paralyze the opponent (the added paralysis comes after the pursuit check, so there is no pursuit this time)', () => {
  const b = horseReady(['stormhorse_mane_jolt']);
  (b as { rng: () => number }).rng = () => 0.1;
  const ev = turn(b, 'stormhorse_mane_jolt', 't_wait');
  assert.ok(b.active(1).status.paralyze);
  assert.equal(hoofs(ev), 0);
});

test('Run Down: when the opponent switches, hits before it leaves, power ×2', () => {
  const b = horseReady(['stormhorse_run_down']);
  const d0 = b.active(1);
  const plain = dealt(turn(b, 'stormhorse_run_down', 't_wait'), 0);
  const hp = d0.hp;
  turn(b, 'stormhorse_run_down', sw(1));
  const chased = hp - d0.hp;
  assert.ok(chased > plain * 1.8, `Pursuing a switch:${chased} vs ${plain}`);
  assert.notEqual(b.active(1), d0, 'Still switched out');
});

test('Trample: power +60 when the opponent is paralyzed, and cures the paralysis (no pursuit)', () => {
  const b = horseReady(['stormhorse_trample']);
  const plain = b.estimate(0, 'stormhorse_trample');
  para(b);
  const r = b.estimate(0, 'stormhorse_trample') / plain;
  assert.ok(r > 1.7 && r < 1.8, `140 / 80 = 1.75, actual${r.toFixed(2)}`);
  const ev = turn(b, 'stormhorse_trample', 't_wait');
  assert.equal(b.active(1).status.paralyze, undefined);
  assert.equal(hoofs(ev), 0);
});

test('Static Mane: when an opponent attack hits, paralyzes the attacker', () => {
  const b = horseReady(['t_wait', 'stormhorse_static_mane']);
  const me = b.active(0);
  me.maxHp = me.hp = 100000;
  turn(b, { ...use('t_wait'), trap: 'stormhorse_static_mane' }, 't_wait');
  turn(b, 't_wait', 't_strike');
  assert.ok(b.active(1).status.paralyze);
});

test('Gallop: for 3 turns the pursuing Thunder Hoof gets power +30, and speed +1', () => {
  const b = horseReady(['stormhorse_gallop', HOOF]);
  const plain = b.estimate(0, HOOF);
  turn(b, 'stormhorse_gallop', 't_wait');
  assert.equal(b.active(0).stages.spd, 1);
  const r = b.estimate(0, HOOF) / plain;
  assert.ok(r > 1.7 && r < 1.8, `70 / 40 = 1.75, actual${r.toFixed(2)}`);
});

test('Stampede: when the opponent is paralyzed, the pursuit becomes 2 Thunder Hoof stomps', () => {
  const b = horseReady(['stormhorse_stampede']);
  para(b);
  const ev = turn(b, 'stormhorse_stampede', 't_wait');
  assert.deepEqual(usedBy(ev, 0), ['stormhorse_stampede', HOOF, HOOF]);
});

test('Bolt Charge: priority +1, and it also pursues', () => {
  const b = horseReady(['stormhorse_bolt_charge']);
  setSpd(b, 1, 5000);
  para(b);
  const ev = turn(b, 'stormhorse_bolt_charge', 't_quick_strike');
  assert.equal(usedBy(ev, 0)[0], 'stormhorse_bolt_charge');
  assert.equal((ev.find((e) => e.k === 'use') as { side: SideId }).side, 0, 'Priority +1 vs priority +1, but paralysis zeroes the opponent priority');
  assert.equal(hoofs(ev), 1);
});

test('Shock Hoof: 60% to paralyze the opponent; power +40 when the opponent is already paralyzed', () => {
  const b = horseReady(['stormhorse_shock_hoof']);
  const plain = b.estimate(0, 'stormhorse_shock_hoof');
  (b as { rng: () => number }).rng = () => 0.5;
  turn(b, 'stormhorse_shock_hoof', 't_wait');
  assert.ok(b.active(1).status.paralyze);
  const r = b.estimate(0, 'stormhorse_shock_hoof') / plain;
  assert.ok(r > 1.6 && r < 1.7, `100 / 60 ≈ 1.67, actual${r.toFixed(2)}`);
});

test('Thunder Herd: always pursues once after hitting (no paralysis needed, and not subject to the once-per-turn limit)', () => {
  const b = horseReady(['stormhorse_thunder_herd']);
  (b as { rng: () => number }).rng = () => 0.99;
  const ev = turn(b, 'stormhorse_thunder_herd', 't_wait');
  assert.deepEqual(usedBy(ev, 0), ['stormhorse_thunder_herd', HOOF]);
});

test('Ten Thousand Hooves: paralyzes the opponent first, then pursues with 2 Thunder Hoof stomps', () => {
  const b = horseReady(['t_wait']);
  const ev = turn(b, 'u_stormhorse', 't_wait');
  assert.deepEqual(usedBy(ev, 0), ['u_stormhorse', HOOF, HOOF]);
  assert.ok(b.active(1).status.paralyze);
});

// ═════════════════════════ `hedgehog`: Electric Needles ═════════════════════════

const hog = (skills: string[]) => [{ id: 'hedgehog', skills }];
const needles = (b: Battle) => b.active(0).vars['e:hog:needles'] ?? 0;
const setNeedles = (b: Battle, n: number) => void (b.active(0).vars['e:hog:needles'] = n);
const fixRng = (b: Battle, v = 0.5) => void ((b as { rng: () => number }).rng = () => v);
/** `hedgehog` is fast, the opponent is slow, both sides survive */
function hogReady(skills: string[], foeSkills?: string[]): Battle {
  const b = duel(hog(skills), foe(foeSkills));
  sturdy(b);
  sturdy(b, 0);
  setSpd(b, 0, 500);
  setSpd(b, 1, 10);
  return b;
}

test('Lightning Rod (rewritten): absorbs thunder-element attacks (no damage), needles +2 and a mark is shown; other attacks still hurt', () => {
  const b = hogReady(['t_wait'], ['spark', 'volt_claw', 't_strike']);
  const me = b.active(0);
  const hp = me.hp;
  let ev = turn(b, 't_wait', 'spark');
  assert.equal(me.hp, hp, 'Thunder-element magic is absorbed');
  assert.ok(traits(ev).includes('避雷針'));
  assert.equal(needles(b), 2);
  assert.equal(me.charges, 0, 'No longer grants charge after the rewrite');
  turn(b, 't_wait', 'volt_claw');
  assert.equal(needles(b), 4, 'Thunder-element physical skills are absorbed too');
  ev = turn(b, 't_wait', 'volt_claw');
  assert.equal(needles(b), 5, 'Max 5 needles');
  const mark = b.view().sides[0].team[b.side(0).active].marks.find((m) => m.id === 'kit:needles');
  assert.equal(mark?.n, 5);
  turn(b, 't_wait', 't_strike');
  assert.ok(me.hp < hp, 'Neutral-element attacks still hurt');
});

test('Bristle: needles +3', () => {
  const b = hogReady(['hedgehog_bristle']);
  turn(b, 'hedgehog_bristle', 't_wait');
  assert.equal(needles(b), 3);
  turn(b, 'hedgehog_bristle', 't_wait');
  assert.equal(needles(b), 5);
});

test('Quill Shot: 1 hit with no needles; "Volley" adds 1 hit per needle (30 per hit), spending all needles; they are spent even if guarded', () => {
  const b = hogReady(['hedgehog_quill_shot']);
  let ev = turn(b, 'hedgehog_quill_shot', 't_wait');
  assert.equal(hitsBy(ev, 0).length, 1);
  setNeedles(b, 3);
  ev = turn(b, 'hedgehog_quill_shot', 't_wait');
  assert.equal(hitsBy(ev, 0).length, 4);
  assert.equal(needles(b), 0);
  setNeedles(b, 3);
  turn(b, 't_wait', 't_wait');
  ev = turn(b, 'hedgehog_quill_shot', guard());
  assert.equal(hitsBy(ev, 0).length, 0);
  assert.equal(needles(b), 0, 'Needles are released even when guarded');
});

test('Needle Storm: starts at 3 hits, +1 hit per needle, and the estimate counts them too', () => {
  const b = hogReady(['hedgehog_needle_storm']);
  const bare = b.estimate(0, 'hedgehog_needle_storm');
  setNeedles(b, 5);
  const r = b.estimate(0, 'hedgehog_needle_storm') / bare;
  assert.ok(r > 2.6 && r < 2.7, `8 hits / 3 hits ≈ 2.67, actual${r.toFixed(2)}`);
  const ev = turn(b, 'hedgehog_needle_storm', 't_wait');
  assert.equal(hitsBy(ev, 0).length, 8);
  assert.equal(needles(b), 0);
});

test('Quick Needle: priority +1 (moves first even when slower), starts at 2 hits and volleys the needles', () => {
  const b = hogReady(['hedgehog_quick_needle']);
  setSpd(b, 0, 10);
  setSpd(b, 1, 500);
  setNeedles(b, 2);
  const ev = turn(b, 'hedgehog_quick_needle', 't_strike');
  const first = ev.find((e) => e.k === 'use') as { side: SideId };
  assert.equal(first.side, 0, 'Lightning Rod King moves first');
  assert.equal(hitsBy(ev, 0).length, 4);
});

test('Static Roll: needles +1 after hitting; none when guarded', () => {
  const b = hogReady(['hedgehog_static_roll']);
  turn(b, 'hedgehog_static_roll', 't_wait');
  assert.equal(needles(b), 1);
  turn(b, 't_wait', 't_wait');
  turn(b, 'hedgehog_static_roll', guard());
  assert.equal(needles(b), 1);
});

test('Needle Coat: when the opponent uses a physical attack, the attacker takes 10% damage and needles +2; magic attacks do not trigger it', () => {
  const b = hogReady(['t_wait', 'hedgehog_needle_coat'], ['t_strike', 't_bolt']);
  turn(b, { ...use('t_wait'), trap: 'hedgehog_needle_coat' }, 't_wait');
  const d = b.active(1);
  turn(b, 't_wait', 't_bolt');
  assert.ok(b.side(0).trap, 'Magic attack does not trigger');
  const hp = d.hp;
  turn(b, 't_wait', 't_strike');
  assert.equal(b.side(0).trap, null);
  assert.ok(Math.abs(hp - d.hp - d.maxHp * 0.1) <= 2, `Attacker takes 10%:${hp - d.hp}`);
  assert.equal(needles(b), 2);
});

test('Lure Rod: opponent attacks (other than thunder element) are negated, needles +2; thunder-element attacks are still absorbed by Lightning Rod and do not use up the trap', () => {
  const b = hogReady(['t_wait', 'hedgehog_lure_rod'], ['t_strike', 'spark']);
  turn(b, { ...use('t_wait'), trap: 'hedgehog_lure_rod' }, 't_wait');
  turn(b, 't_wait', 'spark');
  assert.ok(b.side(0).trap, 'Thunder-element attack is absorbed first');
  assert.equal(needles(b), 2);
  const me = b.active(0);
  const hp = me.hp;
  const ev = turn(b, 't_wait', 't_strike');
  assert.equal(me.hp, hp, 'Attack is negated');
  assert.ok(ev.some((e) => e.k === 'negate'));
  assert.equal(needles(b), 4);
});

test('Myriad Needle Return: first refills 3 needles (max 5) and then volleys them: 6 hits with no needles, 8 hits with 4', () => {
  const b = hogReady(['t_wait']);
  let ev = turn(b, 'u_hedgehog', 't_wait');
  assert.equal(hitsBy(ev, 0).length, 6);
  assert.equal(needles(b), 0);
  const c = duel(hog(['t_wait']), foe());
  sturdy(c);
  c.active(0).vars['e:hog:needles'] = 4;
  ev = turn(c, 'u_hedgehog', 't_wait');
  assert.equal(hitsBy(ev, 0).length, 8);
});

test('Lightning Rod King AI: does not guard when the opponent has only thunder-element attacks (leaves them for Lightning Rod to absorb)', () => {
  const b = hogReady(['hedgehog_needle_storm', 'volt_claw'], ['spark', 'thunderbolt']);
  const k = KIT.hedgehog;
  assert.equal(k.aiGuard?.(b, 0, 0), -60);
  const c = hogReady(['hedgehog_needle_storm'], ['t_strike', 'spark']);
  assert.equal(KIT.hedgehog.aiGuard?.(c, 0, 0), 0);
});

// ═════════════════════════ `ballspark`: Criticality ═════════════════════════

const ball = (skills: string[]) => [{ id: 'ballspark', skills }];
const crit = (b: Battle) => b.active(0).vars['e:bsp:critical'] ?? 0;
const setCrit = (b: Battle, n: number) => void (b.active(0).vars['e:bsp:critical'] = n);
function ballReady(skills: string[], foeSkills?: string[]): Battle {
  const b = duel(ball(skills), foe(foeSkills));
  sturdy(b);
  sturdy(b, 0);
  setSpd(b, 0, 500);
  setSpd(b, 1, 10);
  return b;
}

test('Criticality: +1 at the end of a turn in which an attack skill was used (max 3 stacks, mark shown); using only status skills does not raise it', () => {
  const b = ballReady(['spark', 't_wait']);
  turn(b, 't_wait', 't_wait');
  assert.equal(crit(b), 0);
  turn(b, 'spark', 't_wait');
  assert.equal(crit(b), 1);
  turn(b, 'spark', guard());
  assert.equal(crit(b), 2, 'A guarded attack still counts as used');
  turn(b, 'spark', 't_wait');
  turn(b, 'spark', 't_wait');
  assert.equal(crit(b), 3, 'Max 3 stacks');
  const mark = b.view().sides[0].team[b.side(0).active].marks.find((m) => m.id === 'kit:critical');
  assert.equal(mark?.n, 3);
});

test('Pop: Detonate, +30 power per stack of Criticality; Criticality drops to zero and does not rise again this turn', () => {
  const b = ballReady(['ballspark_pop']);
  const bare = b.estimate(0, 'ballspark_pop');
  setCrit(b, 3);
  const r = b.estimate(0, 'ballspark_pop') / bare;
  assert.ok(r > 3.2 && r < 3.3, `130 / 40 = 3.25, actual${r.toFixed(2)}`);
  turn(b, 'ballspark_pop', 't_wait');
  assert.equal(crit(b), 0);
});

test('Ball Lightning Burst: Detonate (+35 per stack), then self-destructs; faints even when guarded', () => {
  const b = ballReady(['ballspark_ball_burst']);
  const bare = b.estimate(0, 'ballspark_ball_burst');
  setCrit(b, 2);
  const r = b.estimate(0, 'ballspark_ball_burst') / bare;
  assert.ok(r > 1.42 && r < 1.46, `230 / 160 ≈ 1.44, actual${r.toFixed(2)}`);
  turn(b, 'ballspark_ball_burst', 't_wait');
  assert.equal(b.side(0).team[0].fainted, true);
  const c = ballReady(['ballspark_ball_burst']);
  turn(c, 'ballspark_ball_burst', guard());
  assert.equal(c.side(0).team[0].fainted, true, 'Self-destructs even when guarded');
});

test('Ball Lightning Burst: when it knocks out the last opposing spirit the match ends, and Ball Lightning Core does not faint', () => {
  const b = duel(ball(['ballspark_ball_burst']), [{ id: 'cloudfluff', skills: ['t_wait'] }]);
  b.active(1).hp = 1;
  turn(b, 'ballspark_ball_burst', 't_wait');
  assert.equal(b.s.winner, 0);
  assert.equal(b.active(0).fainted, false);
});

test('Ball Lightning Core: ignores Guard, +40 per stack of Criticality, then self-destructs', () => {
  const b = ballReady(['t_wait']);
  setCrit(b, 2);
  const d = b.active(1);
  const hp = d.hp;
  turn(b, 'u_ballspark', guard());
  assert.ok(d.hp < hp, 'Ignores Guard');
  assert.equal(b.side(0).team[0].fainted, true);
});

test('Pressurize: Criticality +2, Magic Power +1', () => {
  const b = ballReady(['ballspark_pressurize']);
  turn(b, 'ballspark_pressurize', 't_wait');
  assert.equal(crit(b), 2);
  assert.equal(b.active(0).stages.mag, 1);
});

test('Chain Lightning: +20 power per stack of Criticality, not spent (still +1 at the end of the turn)', () => {
  const b = ballReady(['ballspark_chain_lightning']);
  const bare = b.estimate(0, 'ballspark_chain_lightning');
  setCrit(b, 2);
  const r = b.estimate(0, 'ballspark_chain_lightning') / bare;
  assert.ok(r > 1.38 && r < 1.42, `140 / 100 = 1.4, actual${r.toFixed(2)}`);
  turn(b, 'ballspark_chain_lightning', 't_wait');
  assert.equal(crit(b), 3);
});

test('Overheat Shot: Criticality +1 after hitting, +1 more at the end of the turn', () => {
  const b = ballReady(['ballspark_overheat_shot']);
  turn(b, 'ballspark_overheat_shot', 't_wait');
  assert.equal(crit(b), 2);
});

test('Unstable (rewritten): when knocked out by an attack, the attacker takes 10% + 5% per stack of Criticality as damage', () => {
  const b = ballReady(['t_wait']);
  setSpd(b, 0, 10);
  setSpd(b, 1, 500);
  setCrit(b, 2);
  b.active(0).hp = 1;
  const d = b.active(1);
  const hp = d.hp;
  const ev = turn(b, 't_wait', 't_strike');
  assert.ok(traits(ev).includes('不穩定'));
  assert.ok(Math.abs(hp - d.hp - d.maxHp * 0.2) <= 2, `20%:${hp - d.hp}`);
});

test('Sympathetic Blast: when an ally spirit is knocked out by an attack, the attacker takes 20% damage and is paralyzed', () => {
  const b = duel([{ id: 'ballspark', skills: ['t_wait', 'ballspark_chain_blast'] }, { id: 'voltadillo', skills: ['t_wait'] }], foe());
  sturdy(b);
  turn(b, { ...use('t_wait'), trap: 'ballspark_chain_blast' }, 't_wait');
  turn(b, sw(1), 't_wait');
  b.active(0).hp = 1;
  const d = b.active(1);
  const hp = d.hp;
  turn(b, 't_wait', 't_strike');
  assert.equal(b.side(0).team[1].fainted, true);
  assert.ok(Math.abs(hp - d.hp - d.maxHp * 0.2) <= 2, `20%:${hp - d.hp}`);
  assert.ok(d.status.paralyze);
});

test('Ball Lightning Core AI: does not self-destruct when it cannot KO the last opponent; detonates when it can (saves the ultimate when Ball Lightning Burst is enough)', () => {
  const b = duel(ball(['ballspark_ball_burst', 'spark']), [{ id: 'cloudfluff', skills: ['t_wait'] }]);
  sturdy(b);
  assert.notDeepEqual(chooseAction(b, 0, { skill: 1 }).main, { type: 'skill', skillId: 'ballspark_ball_burst' });
  const c = duel(ball(['ballspark_ball_burst', 'spark']), [{ id: 'cloudfluff', skills: ['t_wait'] }]);
  c.active(1).hp = Math.floor(c.estimate(0, 'ballspark_ball_burst') * 0.9);
  assert.deepEqual(chooseAction(c, 0, { skill: 1 }).main, { type: 'skill', skillId: 'ballspark_ball_burst' });
});

// ═════════════════════════ `voltadillo`: Armor Charge ═════════════════════════

const dillo = (skills: string[]) => [{ id: 'voltadillo', skills }];
const plate = (b: Battle) => b.active(0).vars['e:vdl:plate'] ?? 0;
const setPlate = (b: Battle, n: number) => void (b.active(0).vars['e:vdl:plate'] = n);
/** `voltadillo` is slow, the opponent is fast (it takes the hit first); both sides survive */
function dilloReady(skills: string[], foeSkills?: string[]): Battle {
  const b = duel(dillo(skills), foe(foeSkills));
  sturdy(b);
  sturdy(b, 0);
  setSpd(b, 0, 10);
  setSpd(b, 1, 500);
  return b;
}

test('Storage Plating (rewritten): +1 stored charge each time it is attacked (max 4 notches, mark shown); no longer grants aether directly', () => {
  const b = dilloReady(['t_wait']);
  b.side(0).aether = 0;
  b.resolveTurn([use('t_wait'), use('t_strike')]);
  assert.equal(plate(b), 1);
  assert.equal(b.side(0).aether, 2, 'Only the 2 points of per-turn recovery');
  for (let i = 0; i < 4; i++) turn(b, 't_wait', 't_strike');
  assert.equal(plate(b), 4, 'Max 4 notches');
  const mark = b.view().sides[0].team[b.side(0).active].marks.find((m) => m.id === 'kit:plate');
  assert.equal(mark?.n, 4);
});

test('Storage Plating: when switching out, the remaining stored charge turns into our aether for the teammate', () => {
  const b = duel([{ id: 'voltadillo', skills: ['t_wait'] }, { id: 'cloudfluff', skills: ['t_wait'] }], foe());
  sturdy(b);
  setPlate(b, 3);
  b.side(0).aether = 0;
  const ev = b.resolveTurn([sw(1), use('t_wait')]);
  assert.ok(traits(ev).includes('蓄能背甲'));
  assert.equal(b.side(0).aether, 3 + 2, 'Stored charge 3 + per-turn recovery 2');
  assert.equal(b.side(0).team[0].vars['e:vdl:plate'] ?? 0, 0);
});

test('Storage Plating: when fainting (with teammates left), stored charge turns into our aether', () => {
  const b = duel([{ id: 'voltadillo', skills: ['t_wait'] }, { id: 'cloudfluff', skills: ['t_wait'] }], foe());
  sturdy(b);
  setSpd(b, 1, 500);
  setPlate(b, 2);
  b.active(0).hp = 1;
  b.side(0).aether = 0;
  b.resolveTurn([use('t_wait'), use('t_strike')]);
  assert.equal(b.side(0).team[0].fainted, true);
  assert.equal(b.side(0).aether, 3 + 2, 'Stored charge 2 + 1 notch from the knockout hit + per-turn recovery 2');
});

test('Release: cannot be used without stored charge; spends all stored charge, our aether +1 per notch', () => {
  const b = dilloReady(['voltadillo_release']);
  assert.equal(b.canUse(0, 'voltadillo_release').ok, false);
  setPlate(b, 3);
  b.side(0).aether = 0;
  b.resolveTurn([use('voltadillo_release'), use('t_wait')]);
  assert.equal(plate(b), 0);
  assert.equal(b.side(0).aether, 3 + 2);
});

test('Curl: stored charge +1, Defense and Resistance +1', () => {
  const b = dilloReady(['voltadillo_curl']);
  turn(b, 'voltadillo_curl', 't_wait');
  assert.equal(plate(b), 1);
  assert.equal(b.active(0).stages.def, 1);
  assert.equal(b.active(0).stages.res, 1);
});

test('Shell Ram: +25 power per notch of stored charge, which is used up', () => {
  const b = dilloReady(['voltadillo_shell_ram']);
  const bare = b.estimate(0, 'voltadillo_shell_ram');
  setPlate(b, 4);
  const r = b.estimate(0, 'voltadillo_shell_ram') / bare;
  assert.ok(r > 2.6 && r < 2.7, `160 / 60 ≈ 2.67, actual${r.toFixed(2)}`);
  turn(b, 'voltadillo_shell_ram', 't_wait');
  assert.equal(plate(b), 0);
});

test('Charged Plate: opponent attack damage −40%, stored charge +2 (+3 in total with the 1 notch from being hit)', () => {
  const b = dilloReady(['t_wait', 'voltadillo_charged_plate']);
  fixRng(b);
  const me = b.active(0);
  let hp = me.hp;
  turn(b, { ...use('t_wait'), trap: 'voltadillo_charged_plate' }, 't_strike');
  const full = hp - me.hp;
  setPlate(b, 0);
  hp = me.hp;
  turn(b, 't_wait', 't_strike');
  const cut = hp - me.hp;
  assert.ok(Math.abs(cut / full - 0.6) < 0.02, `−40%:${cut} / ${full}`);
  assert.equal(plate(b), 3);
});

test('Thunder Roll: +20 power per notch of stored charge, then releases it after use (our aether +1 per notch)', () => {
  const b = dilloReady(['voltadillo_thunder_roll']);
  const bare = b.estimate(0, 'voltadillo_thunder_roll');
  setPlate(b, 4);
  const r = b.estimate(0, 'voltadillo_thunder_roll') / bare;
  assert.ok(r > 2.55 && r < 2.65, `130 / 50 = 2.6, actual${r.toFixed(2)}`);
  b.side(0).aether = 5;
  b.resolveTurn([use('voltadillo_thunder_roll'), use('t_wait')]);
  assert.equal(plate(b), 0);
  assert.equal(b.side(0).aether, 5 - 3 + 4 + 2);
});

test('Shell Backlash: priority −1; power +35 if it was attacked this turn', () => {
  const b = dilloReady(['voltadillo_backlash']);
  fixRng(b);
  const d = b.active(1);
  let hp = d.hp;
  turn(b, 'voltadillo_backlash', 't_wait');
  const plain = hp - d.hp;
  hp = d.hp;
  turn(b, 'voltadillo_backlash', 't_strike');
  const hit = hp - d.hp;
  assert.ok(Math.abs(hit / plain - 80 / 45) < 0.05, `80 / 45:${hit} / ${plain}`);
});

test('Sand Bath: heals 25%, stored charge +1', () => {
  const b = dilloReady(['voltadillo_sand_bath']);
  const me = b.active(0);
  me.hp = Math.floor(me.maxHp / 2);
  const hp = me.hp;
  turn(b, 'voltadillo_sand_bath', 't_wait');
  assert.ok(Math.abs(me.hp - hp - me.maxHp * 0.25) <= 2);
  assert.equal(plate(b), 1);
});

test('Thunder Armor: attacks taken −20% for 3 turns, and stored charge +1 more when hit', () => {
  const b = dilloReady(['voltadillo_thunder_armor', 't_wait']);
  fixRng(b);
  const me = b.active(0);
  let hp = me.hp;
  turn(b, 't_wait', 't_strike');
  const full = hp - me.hp;
  setPlate(b, 0);
  turn(b, 'voltadillo_thunder_armor', 't_wait');
  hp = me.hp;
  turn(b, 't_wait', 't_strike');
  const cut = hp - me.hp;
  assert.ok(Math.abs(cut / full - 0.8) < 0.02, `−20%:${cut} / ${full}`);
  assert.equal(plate(b), 2, 'Hit 1 + Thunder Armor 1');
  turn(b, 't_wait', 't_wait');
  assert.equal(b.getLasting(0, 'voltadillo_thunder_armor'), undefined, 'Ends after 3 turns');
});

test('Megavolt Fortress: stored charge refills to 4 notches after hitting, Defense +1', () => {
  const b = dilloReady(['t_wait']);
  turn(b, 'u_voltadillo', 't_wait');
  assert.equal(plate(b), 4);
  assert.equal(b.active(0).stages.def, 1);
});
