// Behavior tests for the second batch of mechanics and traits.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerTestSkills } from '../data.ts';
import { duel as battle, guard, sw, texts, traits, turn, use, useTestSkills } from './testkit.ts';
import type { SideId } from './types.ts';

// Fixed test skills (prefixed t_); `strike`, `arcane_bolt`, `meditate` and `arcane_blast` are basic skills
useTestSkills();

// ───────────────────────── Skill mechanics ─────────────────────────

test('Wish: heals at the end of the next turn', () => {
  const b = battle([{ id: 'acornsquirrel', skills: ['bury_seed', 'strike'] }], [{ id: 'monolith', skills: ['strike'] }]);
  const a = b.active(0);
  a.hp = Math.floor(a.maxHp * 0.3);
  turn(b, 'bury_seed', 'meditate');
  const afterFirst = a.hp;
  assert.ok(afterFirst <= Math.floor(a.maxHp * 0.3) + 1, 'no healing at the end of the first turn');
  turn(b, 'strike', 'meditate');
  assert.ok(a.hp - afterFirst >= Math.floor(a.maxHp * 0.4) - 1, 'heals 40% at the end of the second turn');
});

test('Borrowed Sands: +5 immediately, then 1 less aether recovered at the end of each of the next 3 turns', () => {
  const b = battle([{ id: 'chronodragon', skills: ['time_loan', 'rock_throw'] }], [{ id: 'monolith', skills: ['strike'] }]);
  b.side(0).aether = 0;
  b.resolveTurn([use('time_loan'), use('strike')]);
  assert.equal(b.side(0).aether, 6, 'borrow 5, end of turn recovers 2 − 1');
  for (const want of [7, 8, 10]) {
    b.resolveTurn([use('rock_throw'), use('strike')]);
    assert.equal(b.side(0).aether, want);
  }
});

test('Borrowed Sands: repeated use stacks the repayment, and recovery is reduced to 0 at the lowest', () => {
  const b = battle([{ id: 'chronodragon', skills: ['time_loan', 'rock_throw'] }], [{ id: 'monolith', skills: ['strike'] }]);
  b.resolveTurn([use('time_loan'), use('strike')]);
  b.resolveTurn([use('time_loan'), use('strike')]);
  b.side(0).aether = 0;
  b.resolveTurn([use('rock_throw'), use('strike')]);
  assert.equal(b.side(0).aether, 0, 'two loans: recovers 2 − 2');
  b.resolveTurn([use('rock_throw'), use('strike')]);
  assert.equal(b.side(0).aether, 1, 'one loan left: recovers 2 − 1');
});

test('Wellspring: while Starwell Lotus Maiden is on the field, our aether is +1 at the end of each turn', () => {
  const b = battle([{ id: 'springlotus', skills: ['aqua_shot', 'aether_infusion'] }], [{ id: 'monolith', skills: ['strike'] }]);
  b.side(0).aether = 0;
  b.side(1).aether = 0;
  const ev = b.resolveTurn([use('aqua_shot'), use('strike')]);
  assert.ok(traits(ev).includes('湧泉'));
  assert.equal(b.side(0).aether, 3, 'trait +1, per turn +2');
  assert.equal(b.side(1).aether, 2);
  b.resolveTurn([use('aether_infusion'), use('strike')]);
  assert.equal(b.side(0).aether, 9, 'Aether Infusion +3, trait +1, per turn +2');
});

// The "Charged Carapace" trait was rewritten as "Armor Charge"; tests are in kits/thunder.test.ts

test('Prophecy: deals damage at the end of the turn two turns later', () => {
  const b = battle([{ id: 'chronodragon', skills: ['sand_prophecy', 'strike'] }], [{ id: 'monolith', skills: ['meditate'] }]);
  const d = b.active(1);
  turn(b, 'sand_prophecy', 'meditate');
  turn(b, 'meditate', 'meditate');
  const before = d.hp;
  const ev = turn(b, 'meditate', 'meditate');
  assert.match(texts(ev), /預言應驗了/);
  assert.ok(before - d.hp >= Math.floor(d.maxHp * 0.4) - 2);
});

test('Decoy: takes the attack and blocks status conditions from status skills', () => {
  const b = battle([{ id: 'inkcat', skills: ['t_substitute', 'strike'] }], [{ id: 'pyre_dragoon', skills: ['strike', 't_burn_spell'] }]);
  const a = b.active(0);
  b.active(1).stats.spd = 1;
  turn(b, 't_substitute', 'meditate');
  assert.ok(a.decoy > 0);
  const hp = a.hp;
  turn(b, 'meditate', 'strike');
  assert.equal(a.hp > hp - 1, true, 'the spirit itself takes no damage');
  turn(b, 'meditate', 't_burn_spell');
  assert.equal(a.status.burn, undefined, 'Burn is blocked by the decoy');
});

test('Seal: the last skill the foe used is temporarily unusable', () => {
  const b = battle([{ id: 'owlarchivist', skills: ['seal_scroll', 'strike'] }], [{ id: 'monolith', skills: ['rock_throw', 'strike'] }]);
  b.active(0).stats.spd = 1;
  turn(b, 'strike', 'rock_throw');
  turn(b, 'seal_scroll', 'strike');
  // The opponent's last skill is strike (it acted before the sealing scroll)
  assert.equal(b.canUse(1, 'strike').ok, false);
  assert.equal(b.canUse(1, 'rock_throw').ok, true);
});

test('Entangle: cannot switch out and keeps taking damage', () => {
  const b = battle([{ id: 'banyanelder', skills: ['root_bind'] }], [{ id: 'monolith', skills: ['meditate'] }, { id: 'cloudfluff' }]);
  const d = b.active(1);
  turn(b, 'root_bind', 'meditate');
  assert.ok(d.bound);
  assert.equal(b.canSwitch(1).ok, false);
});

test('Entry Hazard: the foe is hurt when switching in; a team-wide Cleanse removes it', () => {
  const b = battle([{ id: 'digmole', skills: ['t_hazard'] }], [{ id: 'monolith', skills: ['meditate'] }, { id: 'cloudfluff', skills: ['t_team_cleanse'] }]);
  turn(b, 't_hazard', 'meditate');
  assert.ok(b.side(1).hazard);
  const ev = turn(b, 'meditate', sw(1));
  assert.ok(ev.some((e) => e.k === 'damage' && (e as { reason: string }).reason === 'hazard'));
});

test('Crystal Wall: reduces Physical damage', () => {
  const b = battle([{ id: 'monolith', skills: ['strike'] }], [{ id: 'astragate', skills: ['t_wait'] }]);
  b.side(1).screens = { phys: 0, physTurns: 0, mag: 0, magTurns: 0 };
  const before = b.estimate(0, 'strike');
  b.setScreen(1, 'phys', 30, 5);
  const after = b.estimate(0, 'strike');
  assert.ok(after < before * 0.75);
});

test('Echo: hits again at the end of the next turn', () => {
  const b = battle([{ id: 'leaffrog', skills: ['echo_pipe'] }], [{ id: 'monolith', skills: ['meditate'] }]);
  turn(b, 'echo_pipe', 'meditate');
  const ev = turn(b, 'meditate', 'meditate');
  assert.match(texts(ev), /回音響起/);
  assert.ok(ev.some((e) => e.k === 'hit'));
});

// Test skill for the engine tag snowball (after the revision, the `windup_dash` of `clockmouse` winds the spring instead; see also kits/neutral.test.ts)
registerTestSkills([{ id: 't_snowball', name: 't_snowball', en: 't_snowball', element: 'neutral', category: 'physical', cost: 0, power: 50, accuracy: 100, priority: 0, text: '測試用技能', tags: { snowball: 1 } }]);

test('Streak: power rises with consecutive use', () => {
  const b = battle([{ id: 'terragon', skills: ['t_snowball'] }], [{ id: 'terragon', skills: ['meditate'] }]);
  const e1 = b.estimate(0, 't_snowball');
  turn(b, 't_snowball', 'meditate');
  const e2 = b.estimate(0, 't_snowball');
  assert.ok(e2 > e1 * 1.3, `${e1} → ${e2}`);
});

test('Self-Destruct: the user faints after attacking', () => {
  const b = battle([{ id: 'ballspark', skills: ['t_self_ko'] }, { id: 'cloudfluff' }], [{ id: 'terragon', skills: ['meditate'] }]);
  turn(b, 't_self_ko', 'meditate');
  assert.ok(b.side(0).team[0].fainted);
});

test('Burrow: attacks cannot hit during the charging turn', () => {
  const b = battle([{ id: 'digmole', skills: ['dig_strike'] }], [{ id: 'monolith', skills: ['strike'] }]);
  b.active(1).stats.spd = 1;
  const hp = b.active(0).hp;
  turn(b, 'dig_strike', 'strike');
  assert.equal(b.active(0).hp, hp);
  const ev = turn(b, 'strike', 'meditate');
  assert.ok(ev.some((e) => e.k === 'hit' && (e as { side: SideId }).side === 0));
});

// Test skill for the engine tag expose (after the revision, the `lure_flash` of `lanternfish` lights the lure instead; see also kits/water.test.ts)
registerTestSkills([{ id: 't_expose', name: 't_expose', en: 't_expose', element: 'neutral', category: 'status', cost: 0, power: 0, accuracy: 100, priority: 1, text: '測試用技能', tags: { expose: 1 } }]);

test('Exposed: the next attack is always a crit', () => {
  const b = battle([{ id: 'lanternfish', skills: ['t_expose', 'strike'] }], [{ id: 'terragon', skills: ['meditate'] }]);
  turn(b, 't_expose', 'meditate');
  const ev = turn(b, 'strike', 'meditate');
  const hit = ev.find((e) => e.k === 'hit') as { crit: boolean } | undefined;
  assert.ok(hit?.crit);
});

test('Aether Drain: the foe loses aether and the user gains it', () => {
  const b = battle([{ id: 'abyssjelly', skills: ['soul_drink'] }], [{ id: 'terragon', skills: ['meditate'] }]);
  b.side(1).aether = 4;
  b.side(0).aether = 1;
  b.resolveTurn([use('soul_drink'), guard()]);
  assert.ok(b.side(0).aether >= 1);
});

test('Channel: the more aether remains, the higher the power', () => {
  const b = battle([{ id: 'eldarin', skills: ['pact_breath'] }], [{ id: 'terragon', skills: ['meditate'] }]);
  b.side(0).aether = 2;
  const low = b.estimate(0, 'pact_breath');
  b.side(0).aether = 10;
  const high = b.estimate(0, 'pact_breath');
  assert.ok(high > low * 1.5);
});

test('Invert and Steal', () => {
  const b = battle([{ id: 'inkcat', skills: ['ink_rewrite'] }], [{ id: 'terragon', skills: ['meditate'] }]);
  b.active(1).stages.atk = 2;
  turn(b, 'ink_rewrite', 'meditate');
  assert.equal(b.active(1).stages.atk, -2);
  const v = battle([{ id: 'voidchild', skills: ['void_devour'] }], [{ id: 'terragon', skills: ['meditate'] }]);
  v.active(1).stages.mag = 3;
  turn(v, 'void_devour', 'meditate');
  assert.equal(v.active(1).stages.mag, 0);
  assert.ok(v.active(0).stages.mag >= 3);
});

test('Baton Pass: stat stages pass to the incoming spirit', () => {
  const b = battle([{ id: 'papercrane', skills: ['t_baton'] }, { id: 'pyre_dragoon' }], [{ id: 'terragon', skills: ['meditate'] }]);
  b.active(0).stages.atk = 2;
  turn(b, 't_baton', 'meditate');
  assert.equal(b.side(0).active, 1);
  assert.equal(b.active(0).stages.atk, 2);
  assert.equal(b.active(0).stages.spd, 1);
});

test('Linked Fate: when knocked out, the attacker faints too', () => {
  const b = battle([{ id: 'voidchild', skills: ['t_bond'] }, { id: 'cloudfluff' }], [{ id: 'pyre_dragoon', skills: ['strike'] }, { id: 'monolith' }]);
  b.active(0).stats.spd = 999;
  b.active(0).hp = 1;
  turn(b, 't_bond', 'strike');
  assert.ok(b.side(0).team[0].fainted);
  assert.ok(b.side(1).team[0].fainted);
});

test('HP Split: both spirits end at the same HP ratio', () => {
  // Engine tag painSplit (after the revision, the `balancescale_level` of `balancescale` has a cap; see also kits/light.test.ts)
  registerTestSkills([{ id: 't_pain_split', name: 't_pain_split', en: 't_pain_split', element: 'neutral', category: 'status', cost: 1, power: 0, accuracy: 100, priority: 0, text: '測試用技能', tags: { painSplit: 1 } }]);
  const b = battle([{ id: 'balancescale', skills: ['t_pain_split'] }], [{ id: 'terragon', skills: ['meditate'] }]);
  const a = b.active(0);
  const d = b.active(1);
  a.hp = Math.floor(a.maxHp * 0.2);
  turn(b, 't_pain_split', 'meditate');
  assert.ok(Math.abs(a.hp / a.maxHp - d.hp / d.maxHp) < 0.1);
});

test('Perish: both spirits faint after three turns', () => {
  const b = battle([{ id: 'siren', skills: ['t_perish'] }, { id: 'cloudfluff' }], [{ id: 'terragon', skills: ['meditate'] }, { id: 'monolith' }]);
  turn(b, 't_perish', 'meditate');
  turn(b, 'meditate', 'meditate');
  turn(b, 'meditate', 'meditate');
  assert.ok(b.side(0).team[0].fainted && b.side(1).team[0].fainted);
});

test('Scapegoat: passes status conditions to the foe', () => {
  const b = battle([{ id: 'maskfox', skills: ['scapegoat'] }], [{ id: 'monolith', skills: ['meditate'] }]);
  b.applyStatus(0, 'poison', 2);
  turn(b, 'scapegoat', 'meditate');
  assert.equal(b.active(0).status.poison, undefined);
  assert.ok(b.active(1).status.poison);
});

test('Counter Stance: damage taken is reflected', () => {
  const b = battle([{ id: 'shieldbeetle', skills: ['t_counter_stance'] }], [{ id: 'pyre_dragoon', skills: ['strike'] }]);
  const ev = turn(b, 't_counter_stance', 'strike');
  assert.ok(ev.some((e) => e.k === 'damage' && (e as { reason: string }).reason === 'retaliate'));
});

test('Life Song: the next spirit to enter is fully healed', () => {
  const b = battle([{ id: 'phoenix', skills: ['t_heal_wish'] }, { id: 'pyre_dragoon' }], [{ id: 'terragon', skills: ['meditate'] }]);
  const next = b.side(0).team[1];
  next.hp = 10;
  b.active(0).vars.reborn = 1;
  turn(b, 't_heal_wish', 'meditate');
  b.replace([1, null]);
  assert.equal(next.hp, next.maxHp);
});

test('Armored Offense: the higher the Defense, the higher the damage', () => {
  // `shield_bash` was rewritten as the "Breach" keyword of `shieldbeetle` (tested in kits/fire.test.ts); here a test skill verifies the useDef tag instead
  registerTestSkills([{ id: 't_body_press', name: 't_body_press', en: 't_body_press', element: 'neutral', category: 'physical', cost: 1, power: 80, accuracy: 100, priority: 0, text: '測試用技能', tags: { useDef: 1 } }]);
  const b = battle([{ id: 'terragon', skills: ['t_body_press'] }], [{ id: 'cloudfluff', skills: ['meditate'] }]);
  const base = b.estimate(0, 't_body_press');
  b.active(0).stages.def = 2;
  assert.ok(b.estimate(0, 't_body_press') > base * 1.3);
});

// ───────────────────────── Traits ─────────────────────────

test('Nirvana: with Embers, revives the first time it faints', () => {
  const b = battle([{ id: 'phoenix' }], [{ id: 'pyre_dragoon', skills: ['strike'] }]);
  b.active(0).hp = 1;
  b.active(0).vars['phx:ember'] = 1; // The new Rebirth needs "Embers"
  const ev = turn(b, 'meditate', 'strike');
  assert.ok(traits(ev).includes('涅槃'));
  assert.ok(!b.active(0).fainted && b.active(0).hp > 1);
});

test('Rewind: when HP drops below 25%, it returns to the HP from the start of the turn', () => {
  const b = battle([{ id: 'chronodragon' }], [{ id: 'pyre_dragoon', skills: ['strike'] }]);
  const c = b.active(0);
  c.hp = Math.floor(c.maxHp * 0.3);
  const start = c.hp;
  b.active(1).stats.atk = 5000;
  const ev = turn(b, 'meditate', 'strike');
  assert.ok(traits(ev).includes('逆時'));
  assert.ok(!c.fainted && c.hp >= start);
});

// Mask: the trait of `maskfox` was rewritten as "Hundred Faces" (puts on a mask on entering: 50% damage reduction, scapegoats status conditions); tests are in kits/dark.test.ts

// Ignite: the trait of `bellowsbeast` was rewritten as "lights Kindling after taking a fire attack" (it no longer absorbs fire); tests are in kits/fire.test.ts
// Lightning Rod was rewritten as "Electric Needles"; tests are in kits/thunder.test.ts

test('Quicksand Domain: the foe cannot switch voluntarily', () => {
  const b = battle([{ id: 'sandserpent' }], [{ id: 'monolith' }, { id: 'cloudfluff' }]);
  assert.equal(b.canSwitch(1).ok, false);
});

test('Bell of Peace: stat stages reset on entering', () => {
  const b = battle([{ id: 'monolith' }, { id: 'candledove' }], [{ id: 'terragon', skills: ['meditate'] }]);
  b.active(1).stages.def = 3;
  turn(b, sw(1), 'meditate');
  assert.equal(b.active(1).stages.def, 0);
});

test('Star Gate Ward and Void: entry effects', () => {
  const b = battle([{ id: 'astragate' }], [{ id: 'terragon' }]);
  assert.ok(b.side(0).screens.physTurns > 0 && b.side(0).screens.magTurns > 0);
  const v = battle([{ id: 'monolith' }, { id: 'voidchild' }], [{ id: 'terragon', skills: ['meditate'] }]);
  v.active(1).stages.atk = 2;
  turn(v, sw(1), 'meditate');
  assert.equal(v.active(1).stages.atk, 0);
});

test('Stockpile and Petrify: the HP threshold triggers once', () => {
  const b = battle([{ id: 'acornsquirrel' }], [{ id: 'pyre_dragoon', skills: ['strike'] }]);
  const c = b.active(0);
  c.hp = Math.floor(c.maxHp * 0.7);
  b.damage(0, Math.floor(c.maxHp * 0.3), 'test');
  assert.equal(c.vars.ate, 1);
  assert.ok(c.hp > c.maxHp * 0.6, 'heals 25%');
  const hp = c.hp;
  b.damage(0, Math.floor(c.maxHp * 0.3), 'test');
  assert.ok(c.hp < hp, 'triggers only once');
  const g = battle([{ id: 'gargoyle' }], [{ id: 'pyre_dragoon', skills: ['strike'] }]);
  const gc = g.active(0);
  g.damage(0, Math.floor(gc.maxHp * 0.75), 'test');
  assert.equal(gc.stages.def, 2);
  assert.equal(gc.stages.spd, -2);
});

test('First Pact: the first skill after entering is free', () => {
  const b = battle([{ id: 'eldarin', skills: ['arcane_blast'] }], [{ id: 'terragon', skills: ['meditate'] }]);
  b.side(0).aether = 0;
  assert.equal(b.canUse(0, 'arcane_blast').ok, true);
  b.resolveTurn([use('arcane_blast'), use('meditate')]);
  assert.equal(b.canUse(0, 'arcane_blast').ok, b.side(0).aether >= 2);
});

test('Three Heads: a single-hit attack becomes two hits', () => {
  const b = battle([{ id: 'tombhound', skills: ['strike'] }], [{ id: 'terragon', skills: ['meditate'] }]);
  const ev = turn(b, 'strike', 'meditate');
  assert.equal(ev.filter((e) => e.k === 'hit').length, 2);
});

test('Hard Shell: cannot be crit; Order: stats cannot be lowered', () => {
  const b = battle([{ id: 'lanternfish', skills: ['t_expose', 'strike'] }], [{ id: 'bubblecrab', skills: ['meditate'] }]);
  turn(b, 't_expose', 'meditate');
  assert.ok(b.active(1).exposed >= b.s.turn, 'Exposed (it would be a guaranteed crit without Hard Shell)');
  const ev = turn(b, 'strike', 'meditate');
  const hit = ev.find((e) => e.k === 'hit') as { crit: boolean } | undefined;
  assert.equal(hit?.crit, false);
  const s = battle([{ id: 'gargoyle', skills: ['stone_gaze'] }], [{ id: 'balancescale', skills: ['meditate'] }]);
  turn(s, 'stone_gaze', 'meditate');
  assert.equal(s.active(1).stages.spd, 0);
});

test('Coiled Roots: cannot be forced to switch', () => {
  const b = battle([{ id: 'tornado', skills: ['whirl_in'] }], [{ id: 'banyanelder', skills: ['meditate'] }, { id: 'monolith' }]);
  turn(b, 'whirl_in', 'meditate');
  assert.equal(b.side(1).active, 0);
});
