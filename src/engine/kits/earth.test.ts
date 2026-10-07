// Mechanic tests for the earth group: `terragon` (Strata), `chronodragon` (Time Seal), `sand_reaper` (Deep Burial), `sandserpent` (Sinking), `rhino` (Gallop),
// `monolith` (Stone Oath), `digmole` (Surfacing), `gargoyle` (Stone Veins).
// node --test src/engine/kits/earth.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Battle } from '../battle.ts';
import type { SideId } from '../types.ts';
import type { SkillDef } from '../../../sim/types.ts';
import { registerTestSkills } from '../../data.ts';
import { chooseAction } from '../ai.ts';
import { duel, guard, hitsBy, sw, texts, traits, turn, use, useTestSkills } from '../testkit.ts';
import { FX, KIT } from './earth.ts';

useTestSkills();
/** A two-hit test physical skill (the Stone Oath is judged per hit) */
const DOUBLE: SkillDef = { id: 'x_earth_double', name: 'x_earth_double', en: 'x_earth_double', element: 'neutral', category: 'physical', cost: 0, power: 60, accuracy: 100, priority: 0, text: '測試用技能', tags: { hits: 2 } };
registerTestSkills([DOUBLE]);

// The opponent is always this group's own `monolith` (its old trait "Firm Stone" only affects itself being knocked out by an attack), using test skills
const FOE = 'monolith';

// ───────────────────────── `terragon`: Strata ─────────────────────────

const strata = (b: Battle, side: SideId = 0) => b.active(side).vars['e:ter:strata'] ?? 0;
const setStrata = (b: Battle, n: number) => void (b.active(0).vars['e:ter:strata'] = n);
const cap = (b: Battle) => Math.floor(b.active(0).maxHp * 0.25);

/** `terragon` vs `monolith`; clears the Sandstorm from entering (so the +1 stratum at the end of the turn does not disturb the counts) */
function terragon(skills: string[], foeSkills = ['t_wait', 't_blast', 't_strike']): Battle {
  const b = duel([{ id: 'terragon', skills }], [{ id: FOE, skills: foeSkills }]);
  b.s.field = null;
  return b;
}

test('Immovable Mountain: entering sets Sandstorm and gains 1 stratum; +1 stratum at the end of a turn under Sandstorm; cannot be forced to switch', () => {
  const b = duel([{ id: 'terragon', skills: ['t_wait'] }, { id: FOE }], [{ id: FOE, skills: ['t_wait'] }]);
  assert.equal(b.s.field?.element, 'earth');
  assert.equal(strata(b), 1);
  turn(b, 't_wait', 't_wait');
  assert.equal(strata(b), 2, '+1 stratum at the end of a turn under Sandstorm');
  b.forceSwitch(0);
  assert.equal(b.side(0).active, 0, 'Cannot be forced to switch');
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'kit:strata' && m.n === 2), 'Strata show in the mark row');
});

test('Strata: big damage is cut to 25% and shatters 1 stratum; small damage is unchanged and shatters nothing', () => {
  const b = terragon(['t_wait']);
  setStrata(b, 2);
  const t = b.active(0);
  b.active(1).stats.mag = 6000;
  turn(b, 't_wait', 't_blast');
  assert.equal(t.maxHp - t.hp, cap(b), 'A single hit does at most 25%');
  assert.equal(strata(b), 1);
  const hp = t.hp;
  turn(b, 't_wait', 't_strike');
  assert.ok(hp - t.hp < cap(b));
  assert.equal(strata(b), 1, 'An attack that was not reduced does not shatter strata');
  setStrata(b, 0);
  const hp2 = t.hp;
  turn(b, 't_wait', 't_blast');
  assert.ok(hp2 - t.hp > cap(b) || t.fainted, 'No cap without strata');
});

test('Shell Ram: +10 power per stratum (not spent)', () => {
  const b = terragon(['terragon_shell_ram']);
  setStrata(b, 0);
  const e0 = b.estimate(0, 'terragon_shell_ram');
  setStrata(b, 3);
  const e3 = b.estimate(0, 'terragon_shell_ram');
  assert.ok(Math.abs(e3 / e0 - 75 / 45) < 0.05, `${e0} → ${e3}`);
  turn(b, 'terragon_shell_ram', 't_wait');
  assert.equal(strata(b), 3);
});

test('Stratify: +2 strata, +3 under Sandstorm (cap 3)', () => {
  const b = terragon(['terragon_stratify']);
  setStrata(b, 0);
  turn(b, 'terragon_stratify', 't_wait');
  assert.equal(strata(b), 2);
  setStrata(b, 0);
  b.setField('earth', 3);
  turn(b, 'terragon_stratify', 't_wait');
  assert.equal(strata(b), 3);
});

test('Rockslide and Avalanche: collapse all strata for power; Avalanche ignores Guard', () => {
  const b = terragon(['terragon_rockslide', 'terragon_avalanche']);
  setStrata(b, 0);
  const r0 = b.estimate(0, 'terragon_rockslide');
  const a0 = b.estimate(0, 'terragon_avalanche');
  setStrata(b, 3);
  assert.ok(Math.abs(b.estimate(0, 'terragon_rockslide') / r0 - 195 / 75) < 0.05);
  assert.ok(Math.abs(b.estimate(0, 'terragon_avalanche') / a0 - 200 / 80) < 0.05);
  const foe = b.active(1);
  const ev = turn(b, 'terragon_avalanche', guard());
  assert.ok(ev.some((e) => e.k === 'guarded' && e.broke), 'Pierces Guard');
  assert.ok(foe.hp < foe.maxHp);
  assert.equal(strata(b), 0, 'All strata collapsed');
});

test('Ridge Charge: +1 stratum on hit', () => {
  const b = terragon(['terragon_ridge_charge']);
  setStrata(b, 0);
  turn(b, 'terragon_ridge_charge', 't_wait');
  assert.equal(strata(b), 1);
});

test('Tremor: on hit, destroys the trap the opponent has set', () => {
  const b = terragon(['terragon_tremor'], ['t_wait', 't_trap']);
  turn(b, 't_wait', { ...use('t_wait'), trap: 't_trap' });
  assert.ok(b.side(1).trap);
  turn(b, 'terragon_tremor', 't_wait');
  assert.equal(b.side(1).trap, null);
});

test('Soil Mend: heals 25%, and collapsing strata heals another 10% per stratum', () => {
  const b = terragon(['terragon_soil_mend']);
  const t = b.active(0);
  t.hp = Math.floor(t.maxHp * 0.3);
  setStrata(b, 2);
  const before = t.hp;
  turn(b, 'terragon_soil_mend', 't_wait');
  const gained = (t.hp - before) / t.maxHp;
  assert.ok(Math.abs(gained - 0.45) < 0.01, `Healed${gained}`);
  assert.equal(strata(b), 0);
});

test('Ageless Bedrock: for 3 turns strata cannot be shattered, and the cap still applies', () => {
  const b = terragon(['terragon_bedrock', 't_wait']);
  const t = b.active(0);
  t.maxHp *= 3;
  t.hp = t.maxHp;
  setStrata(b, 0);
  b.active(1).stats.mag = 6000;
  turn(b, 'terragon_bedrock', 't_wait');
  assert.equal(strata(b), 1);
  const hp = t.hp;
  turn(b, 't_wait', 't_blast');
  assert.equal(hp - t.hp, cap(b));
  assert.equal(strata(b), 1, 'Strata did not shatter');
  turn(b, 't_wait', 't_blast');
  assert.equal(strata(b), 1);
  turn(b, 't_wait', 't_blast');
  assert.equal(strata(b), 0, 'Strata can shatter again after 3 turns');
});

test('Leyline Sandstorm: Sandstorm for 5 turns and +1 stratum', () => {
  const b = terragon(['terragon_sand_surge']);
  setStrata(b, 0);
  turn(b, 'terragon_sand_surge', 't_wait');
  assert.equal(b.s.field?.element, 'earth');
  assert.equal(b.s.field?.turns, 4);
  assert.equal(strata(b), 2, 'Skill +1, and +1 again at the end of the turn under Sandstorm');
});

test('Mountain Backlash: gains 1 stratum first, and all damage reduced by strata is reflected', () => {
  const b = terragon(['terragon_backlash', 't_wait']);
  setStrata(b, 0);
  b.active(1).stats.mag = 6000;
  turn(b, { ...use('t_wait'), trap: 'terragon_backlash' }, 't_wait');
  const foe = b.active(1);
  const hp = foe.hp;
  const ev = turn(b, 't_wait', 't_blast');
  assert.match(texts(ev), /磐岳反震/);
  const dealt = ev.find((e) => e.k === 'hit' && e.side === 1) as { dmg: number } | undefined;
  assert.equal(dealt?.dmg, cap(b), 'With strata, this hit is cut to 25%');
  const reflected = ev.find((e) => e.k === 'damage' && e.target === 1 && e.reason === 'reflect') as { dmg: number } | undefined;
  assert.ok(reflected && reflected.dmg > 0 && foe.hp < hp);
  assert.equal(b.side(0).trap, null);
});

test('Stoneheart Kingdom: +1 stratum; the opponent takes 8% damage for every stratum lost', () => {
  const b = terragon(['terragon_kingdom', 'terragon_avalanche', 't_wait']);
  setStrata(b, 1);
  turn(b, 'terragon_kingdom', 't_wait');
  assert.equal(strata(b), 2);
  const foe = b.active(1);
  foe.stats.mag = 6000;
  const hp = foe.hp;
  const ev = turn(b, 't_wait', 't_blast');
  const k = ev.filter((e) => e.k === 'damage' && e.target === 1 && e.reason === 'kingdom') as { dmg: number }[];
  assert.equal(k.length, 1, '1 stratum shattered');
  assert.equal(k[0].dmg, Math.floor(foe.maxHp * 0.08));
  assert.equal(foe.hp, hp - k[0].dmg);
  foe.stats.mag = 1;
  const ev2 = turn(b, 'terragon_avalanche', 't_wait');
  const k2 = ev2.filter((e) => e.k === 'damage' && e.target === 1 && e.reason === 'kingdom') as { dmg: number }[];
  assert.equal(k2[0]?.dmg, Math.floor(foe.maxHp * 0.08 * 1), 'Collapsing 1 stratum counts too');
});

test('Mountainfall: collapses all strata (+50 per stratum), then refills to 3 strata', () => {
  const b = terragon(['t_wait']);
  setStrata(b, 0);
  const e0 = b.estimate(0, 'u_terragon');
  setStrata(b, 2);
  assert.ok(Math.abs(b.estimate(0, 'u_terragon') / e0 - 280 / 180) < 0.05);
  b.active(1).hp = b.active(1).maxHp * 10;
  b.active(1).maxHp *= 10;
  turn(b, 'u_terragon', 't_wait');
  assert.equal(strata(b), 3);
  assert.ok(b.side(0).ultUsed);
});

// ───────────────────────── `chronodragon`: Time Seal ─────────────────────────

const seal = (b: Battle, side: SideId = 1) => b.side(side).lasting.find((l) => l.key === 'sand_prophecy');

function chrono(skills: string[], foeSkills = ['t_wait', 't_blast', 't_strike'], foes = 1): Battle {
  const b = duel([{ id: 'chronodragon', skills }], Array.from({ length: foes }, () => ({ id: FOE, skills: foeSkills })));
  b.active(0).vars.rewound = 1; // Turn off the trait "Time Reversal" so it does not interfere with the HP calculation
  return b;
}

test('Time Seal: Sands of Prophecy engraves 4 stacks and comes due at the end of the turn 2 turns later (10% per stack)', () => {
  const b = chrono(['sand_prophecy', 't_wait']);
  const d = b.active(1);
  turn(b, 'sand_prophecy', 't_wait');
  assert.equal(seal(b)?.n, 4);
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'kit:seal' && m.n === 4), 'Time Seal shows on Chronos');
  assert.ok(b.view().sides[1].conds.some((m) => m.id === 'fx:sand_prophecy'), 'Also shows on the opponent side');
  turn(b, 't_wait', 't_wait');
  assert.equal(d.hp, d.maxHp);
  const ev = turn(b, 't_wait', 't_wait');
  assert.match(texts(ev), /預言應驗了/);
  assert.equal(d.maxHp - d.hp, Math.floor(d.maxHp * 0.4));
  assert.equal(seal(b), undefined);
});

test('Time Seal: a Guard on the turn it comes due blocks it and shatters it', () => {
  const b = chrono(['sand_prophecy', 't_wait']);
  const d = b.active(1);
  turn(b, 'sand_prophecy', 't_wait');
  turn(b, 't_wait', 't_wait');
  const ev = turn(b, 't_wait', guard());
  assert.match(texts(ev), /格擋擋下了應驗/);
  assert.equal(d.hp, d.maxHp);
  assert.equal(seal(b), undefined);
});

test('Sands of Prophecy: sees through Guard, Time Seal countdown +1; Sand Bolt adds a stack only when a Time Seal already exists', () => {
  const b = chrono(['sand_prophecy', 'chronodragon_sand_bolt']);
  turn(b, 'chronodragon_sand_bolt', 't_wait');
  assert.equal(seal(b), undefined, 'No seal is engraved when there is no Time Seal');
  turn(b, 'sand_prophecy', guard());
  assert.equal(seal(b)?.turns, 3, 'Freshly engraved with 3 turns, +1, then −1 at the end of the turn');
  turn(b, 'chronodragon_sand_bolt', 't_wait');
  assert.equal(seal(b)?.n, 5);
});

test('Time Flies: Time Seal countdown −1 (comes due at once when it reaches zero), and clears timed effects on the opponent', () => {
  const b = chrono(['sand_prophecy', 'chronodragon_hasten']);
  const d = b.active(1);
  turn(b, 'sand_prophecy', 't_wait');
  b.addLasting(1, 'terragon_bedrock', 3);
  turn(b, 'chronodragon_hasten', 't_wait');
  assert.equal(b.getLasting(1, 'terragon_bedrock'), undefined, 'Timed effects cleared');
  assert.equal(d.maxHp - d.hp, Math.floor(d.maxHp * 0.4), 'Countdown 2 → 1, comes due as soon as this turn ends');
});

test('Breath of Years and Gale of Ages: +1 stack (engraves a seal when there is none); countdown −1', () => {
  const b = chrono(['chronodragon_dune_breath', 'chronodragon_era_gale']);
  const d = b.active(1);
  d.maxHp *= 20;
  d.hp = d.maxHp;
  turn(b, 'chronodragon_dune_breath', 't_wait');
  assert.equal(seal(b)?.n, 1);
  assert.equal(seal(b)?.turns, 2);
  const hp = d.hp;
  turn(b, 'chronodragon_era_gale', 't_wait');
  assert.equal(seal(b), undefined, 'Countdown 2 → 1, comes due this turn');
  assert.ok(hp - d.hp > Math.floor(d.maxHp * 0.1));
});

test('Rewind: when moving last, returns to the HP at the start of the turn; when moving first, heals 25%', () => {
  const b = chrono(['chronodragon_rewind', 't_wait']);
  const c = b.active(0);
  c.stats.spd = 1;
  c.hp = Math.floor(c.maxHp * 0.9);
  const start = c.hp;
  b.active(1).stats.mag = 1000;
  turn(b, 'chronodragon_rewind', 't_blast');
  assert.equal(c.hp, start, 'Returns to the HP at the start of the turn');
  c.stats.spd = 99999;
  c.hp = Math.floor(c.maxHp * 0.5);
  const hp = c.hp;
  turn(b, 'chronodragon_rewind', 't_wait');
  assert.equal(c.hp - hp, Math.floor(c.maxHp * 0.25));
});

test('Convergence: after hitting, the Time Seal comes due at once, +20% per stack', () => {
  const b = chrono(['sand_prophecy', 'chronodragon_convergence']);
  const d = b.active(1);
  d.maxHp *= 20;
  d.hp = d.maxHp;
  turn(b, 'sand_prophecy', 't_wait');
  const ev = turn(b, 'chronodragon_convergence', 't_wait');
  const p = ev.find((e) => e.k === 'damage' && e.target === 1 && e.reason === 'prophecy') as { dmg: number } | undefined;
  assert.equal(p?.dmg, Math.floor(d.maxHp * 0.48));
  assert.equal(seal(b), undefined);
});

test('Corridor of Sand: negates the opponent attack and adds 2 stacks of Time Seal', () => {
  const b = chrono(['chronodragon_time_corridor', 't_wait']);
  b.active(1).stats.mag = 6000;
  turn(b, { ...use('t_wait'), trap: 'chronodragon_time_corridor' }, 't_wait');
  const c = b.active(0);
  const ev = turn(b, 't_wait', 't_blast');
  assert.ok(ev.some((e) => e.k === 'negate'));
  assert.equal(c.hp, c.maxHp);
  assert.equal(seal(b)?.n, 2);
});

test('Hourglass Flip: transfers status conditions to the opponent and adds 1 stack of Time Seal', () => {
  const b = chrono(['chronodragon_hourglass_flip', 't_wait']);
  b.applyStatus(0, 'burn');
  turn(b, 'chronodragon_hourglass_flip', 't_wait');
  assert.equal(b.active(0).status.burn, undefined);
  assert.ok(b.active(1).status.burn);
  assert.equal(seal(b)?.n, 1);
});

test('Eternal Return: for 3 turns, a Time Seal that comes due is engraved again with half the stacks', () => {
  const b = chrono(['sand_prophecy', 'chronodragon_eternal_return', 'chronodragon_convergence']);
  const d = b.active(1);
  d.maxHp *= 20;
  d.hp = d.maxHp;
  turn(b, 'sand_prophecy', 't_wait');
  turn(b, 'chronodragon_eternal_return', 't_wait');
  const ev = turn(b, 'chronodragon_convergence', 't_wait');
  assert.match(texts(ev), /永劫回歸/);
  assert.equal(seal(b)?.n, 2, 'Half of 4 stacks');
});

test('Millennium Sands: +15 power per stack of Time Seal (not spent)', () => {
  const b = chrono(['sand_prophecy', 'chronodragon_millennium']);
  const e0 = b.estimate(0, 'chronodragon_millennium');
  turn(b, 'sand_prophecy', 't_wait');
  assert.ok(Math.abs(b.estimate(0, 'chronodragon_millennium') / e0 - 180 / 120) < 0.05);
  turn(b, 'chronodragon_millennium', 't_wait');
  assert.equal(seal(b)?.n, 4);
});

test('End of Time: after hitting, the Time Seal comes due at once, with double damage per stack', () => {
  const b = chrono(['sand_prophecy', 't_wait']);
  const d = b.active(1);
  d.maxHp *= 20;
  d.hp = d.maxHp;
  turn(b, 'sand_prophecy', 't_wait');
  const ev = turn(b, 'u_chronodragon', 't_wait');
  const p = ev.find((e) => e.k === 'damage' && e.target === 1 && e.reason === 'prophecy') as { dmg: number } | undefined;
  assert.equal(p?.dmg, Math.floor(d.maxHp * 0.8));
});

test('Time Seal does not vanish on fainting: when the opponent faints it passes to the next spirit; it still comes due after Chronos faints', () => {
  // The opponent is knocked out on the turn the seal comes due: the Time Seal is carried to the replacement that comes in
  const b = chrono(['sand_prophecy', 't_blast'], ['t_wait'], 2);
  turn(b, 'sand_prophecy', 't_wait');
  turn(b, 't_wait', 't_wait');
  b.active(0).stats.mag = 99999;
  b.active(1).hp -= 1; // The "Firm Stone" of `monolith` keeps 1 HP only at full HP
  turn(b, 't_blast', 't_wait');
  assert.ok(b.active(1).fainted);
  assert.equal(seal(b)?.n, 4, 'Time Seal is still there');
  b.replace([null, 1]);
  const next = b.active(1);
  turn(b, 't_wait', 't_wait');
  assert.equal(next.maxHp - next.hp, Math.floor(next.maxHp * 0.4), 'The replacement spirit takes the Time Seal when it comes due');

  // After `chronodragon` faints, the Time Seal still comes due
  const c = duel([{ id: 'chronodragon', skills: ['sand_prophecy'] }, { id: FOE, skills: ['t_wait'] }], [{ id: FOE, skills: ['t_wait', 't_strike'] }]);
  c.active(0).vars.rewound = 1;
  turn(c, 'sand_prophecy', 't_wait');
  c.active(0).hp = 1;
  turn(c, 't_wait', 't_strike');
  assert.ok(c.side(0).team[0].fainted);
  c.replace([1, null]);
  const d = c.active(1);
  turn(c, 't_wait', 't_wait');
  assert.equal(d.maxHp - d.hp, Math.floor(d.maxHp * 0.4));
});

// ───────────────────────── `chronodragon`: the opponent AI knows to guard when the seal comes due ─────────────────────────

test('Time Seal aiFoeGuard: at countdown 1 the opponent gets a big bonus, at countdown 2 only when it can come due early; the opponent AI guards', () => {
  const b = chrono(['sand_prophecy', 't_wait']);
  b.active(0).ultimate = null; // No ultimate, and no skill that speeds up or converges
  const hint = KIT.chronodragon.aiFoeGuard!;
  assert.equal(hint(b, 0, 0), 0, 'No bonus without a Time Seal');
  turn(b, 'sand_prophecy', 't_wait');
  assert.equal(seal(b)?.turns, 2);
  assert.ok(hint(b, 0, 0) < 0, 'Countdown 2 and Chronos cannot bring it forward: hold the Guard back');
  turn(b, 't_wait', 't_wait');
  assert.equal(seal(b)?.turns, 1);
  assert.ok(hint(b, 0, 0) >= 30, 'Comes due as soon as this turn ends');
  const act = chooseAction(b, 1, { skill: 1 });
  assert.equal(act.main.type, 'guard', 'The opponent AI guards on the turn it comes due');

  const c = chrono(['sand_prophecy', 'chronodragon_convergence']);
  turn(c, 'sand_prophecy', 't_wait');
  assert.ok(KIT.chronodragon.aiFoeGuard!(c, 0, 0) > 20, 'Countdown 2 but Chronos can converge: worth gambling on a Guard');
});

test('Chronos AI reads Guard: when the opponent will probably guard it does not converge and delays with Sands of Prophecy instead; it converges when the opponent just guarded', () => {
  const b = chrono(['sand_prophecy', 'chronodragon_convergence'], ['t_wait']);
  const conv = FX.chronodragon_convergence.aiScore!;
  const proph = FX.sand_prophecy.aiScore!;
  turn(b, 'sand_prophecy', 't_wait');
  turn(b, 't_wait', 't_wait');
  assert.equal(seal(b)?.turns, 1);
  assert.ok(conv(b, 0, 0) < 0, 'The opponent has no attack to use and the Time Seal is about to come due: it will guard');
  assert.ok(proph(b, 0, 0) >= 50, 'Sands of Prophecy: sees through Guard and delays the Time Seal coming due');
  const c = chrono(['sand_prophecy', 'chronodragon_convergence'], ['t_wait']);
  turn(c, 'sand_prophecy', 't_wait');
  turn(c, 't_wait', guard());
  assert.equal(c.canGuard(1).ok, false, 'The opponent just guarded');
  assert.ok(conv(c, 0, 0) >= 50, 'The opponent cannot guard again: converge');
});

// ───────────────────────── `sand_reaper`: Deep Burial ─────────────────────────

const depth = (b: Battle) => b.view().sides[0].team[b.side(0).active].marks.find((m) => m.id === 'kit:depth')?.n ?? 0;
const setTrap = (skill: string, trap: string) => ({ ...use(skill), trap });
const PIT = 'sand_reaper_scythe_pit';
const SNARE = 'sand_reaper_throat_snare';

function reaper(skills: string[], foeSkills = ['t_wait', 't_strike', 't_war_cry'], foes = 1): Battle {
  return duel([{ id: 'sand_reaper', skills }], Array.from({ length: foes }, () => ({ id: FOE, skills: foeSkills })));
}

test('Deep Burial: a trap is buried at 1 level when set, +1 at the end of every turn while Sand Reaper is active (max 3); a different trap is counted afresh', () => {
  const b = reaper([PIT, SNARE, 't_wait']);
  turn(b, setTrap('t_wait', PIT), 't_wait');
  assert.equal(depth(b), 2, 'Buried at 1 level + 1 level at the end of the turn');
  turn(b, 't_wait', 't_wait');
  assert.equal(depth(b), 3);
  turn(b, 't_wait', 't_wait');
  assert.equal(depth(b), 3, 'Max 3 levels');
  turn(b, setTrap('t_wait', SNARE), 't_wait');
  assert.equal(depth(b), 2, 'Replaced by a new trap, so Deep Burial is counted afresh');
});

test('Scythe Pit: reduces damage by 20%, then after the attack resolves "Sand Pincer" deals 6% per level of Deep Burial; Lurk in Sand gives +1 Attack; Reaping Counter gets +50 power', () => {
  const b = reaper([PIT, 'sand_reaper_reaping_counter', 't_wait']);
  const d = b.active(1);
  turn(b, setTrap('t_wait', PIT), 't_wait');
  turn(b, 't_wait', 't_wait');
  assert.equal(depth(b), 3);
  const e0 = b.estimate(0, 'sand_reaper_reaping_counter');
  const ev = turn(b, 'sand_reaper_reaping_counter', 't_strike');
  const pin = ev.find((e) => e.k === 'damage' && e.target === 1 && e.reason === 'pincer') as { dmg: number } | undefined;
  assert.equal(pin?.dmg, Math.floor(d.maxHp * 0.18), 'Deep Burial 3 levels = 18%');
  assert.equal(b.active(0).stages.atk, 1, 'Trait "Lurk in Sand"');
  assert.equal(b.side(0).trap, null);
  assert.equal(depth(b), 0, 'Deep Burial resets to zero after the trap fires');
  // Our trap fired this turn: `sand_reaper_reaping_counter` +50 power (estimated within the same turn)
  const e1 = b.estimate(0, 'sand_reaper_reaping_counter');
  assert.ok(e1 / e0 > 1.4, `Reaping Counter 140/90 (including Attack +1):${e1}/${e0}`);
});

test('Throat Snare: when the opponent uses a status skill it is negated and the opponent is silenced, and Sand Pincer strikes by level', () => {
  const b = reaper([SNARE, 't_wait']);
  const d = b.active(1);
  turn(b, setTrap('t_wait', SNARE), 't_wait');
  const ev = turn(b, 't_wait', 't_war_cry');
  assert.ok(ev.some((e) => e.k === 'negate'));
  assert.equal(d.stages.atk, 0, 'Status skill negated');
  assert.ok(d.status.silence, 'Silenced');
  const pin = ev.find((e) => e.k === 'damage' && e.target === 1 && e.reason === 'pincer') as { dmg: number } | undefined;
  assert.equal(pin?.dmg, Math.floor(d.maxHp * 0.12), 'Deep Burial 2 levels');
});

test('Burrow: Deep Burial +2 and Defense +1; with no Sand Reaper trap only the Defense applies', () => {
  const b = reaper([PIT, 'sand_reaper_burrow']);
  turn(b, 'sand_reaper_burrow', 't_wait');
  assert.equal(depth(b), 0);
  assert.equal(b.active(0).stages.def, 1);
  turn(b, setTrap('sand_reaper_burrow', PIT), 't_wait');
  assert.equal(depth(b), 3, 'Buried at 1 level +2, capped at 3 at the end of the turn');
});

test('Upheaval Scythe and Sand Burial: power rises with each level of Deep Burial, and after hitting they uncover the trap (without firing it)', () => {
  const b = reaper([PIT, 'sand_reaper_upheaval', 'sand_reaper_sand_burial']);
  const d = b.active(1);
  d.maxHp *= 20;
  d.hp = d.maxHp;
  const u0 = b.estimate(0, 'sand_reaper_upheaval');
  const s0 = b.estimate(0, 'sand_reaper_sand_burial');
  turn(b, setTrap('t_wait', PIT), 't_wait');
  turn(b, 't_wait', 't_wait');
  assert.equal(depth(b), 3);
  assert.ok(Math.abs(b.estimate(0, 'sand_reaper_upheaval') / u0 - 155 / 65) < 0.05);
  assert.ok(Math.abs(b.estimate(0, 'sand_reaper_sand_burial') / s0 - 185 / 80) < 0.05);
  const ev = turn(b, 'sand_reaper_sand_burial', guard());
  assert.match(texts(ev), /掀開了深埋 3 層的伏技/);
  assert.ok(d.hp < d.maxHp, 'Ignores Guard');
  assert.equal(b.side(0).trap, null);
  assert.ok(!ev.some((e) => e.k === 'trap'), 'Uncovering does not count as firing');
  assert.equal(b.active(0).stages.atk, 0, 'Uncovering does not trigger Lurk in Sand');
});

test('Lurk Below and Scythe Storm: Deep Burial +1', () => {
  const b = reaper([SNARE, 'sand_reaper_molt', 'sand_reaper_scythe_storm']);
  b.active(0).hp = Math.floor(b.active(0).maxHp / 2);
  turn(b, setTrap('sand_reaper_molt', SNARE), 't_wait');
  assert.equal(depth(b), 3, 'Buried 1 + Lurk Below 1 + end of turn 1');
  assert.ok(b.active(0).hp > b.active(0).maxHp / 2);
  const c = reaper([SNARE, 'sand_reaper_scythe_storm']);
  turn(c, setTrap('sand_reaper_scythe_storm', SNARE), 't_wait');
  assert.equal(depth(c), 3);
});

test('Sand Chase: when the opponent switches, attacks at double power before it leaves', () => {
  const b = reaper(['sand_reaper_chase', 't_wait'], ['t_wait'], 2);
  const leaving = b.active(1);
  const ev = turn(b, 'sand_reaper_chase', sw(1));
  const hit = ev.findIndex((e) => e.k === 'hit' && e.side === 0);
  const out = ev.findIndex((e) => e.k === 'switchOut');
  assert.ok(hit >= 0 && hit < out, 'Hits before it leaves');
  assert.ok(leaving.hp < leaving.maxHp);
});

test('Pincer Jab: priority +1 when we have a trap set', () => {
  const b = reaper(['sand_reaper_pincer_jab', PIT]);
  b.active(0).stats.spd = 1;
  let ev = turn(b, 'sand_reaper_pincer_jab', 't_strike');
  assert.equal((ev.find((e) => e.k === 'use') as { side: SideId }).side, 1, 'No trap: the slower one moves last');
  ev = turn(b, setTrap('sand_reaper_pincer_jab', PIT), 't_strike');
  assert.equal((ev.find((e) => e.k === 'use') as { side: SideId }).side, 0, 'Priority +1 once a trap is set');
});

test('Pit of a Thousand Scythes: +40 power per level when flipping sand; the next trap set afterwards is buried 3 levels deep at once', () => {
  const b = reaper([PIT, SNARE, 't_wait']);
  const d = b.active(1);
  d.maxHp *= 20;
  d.hp = d.maxHp;
  b.active(0).ultimate = 'u_sand_reaper';
  const e0 = b.estimate(0, 'u_sand_reaper');
  turn(b, setTrap('t_wait', PIT), 't_wait');
  assert.ok(Math.abs(b.estimate(0, 'u_sand_reaper') / e0 - 250 / 170) < 0.05);
  turn(b, 'u_sand_reaper', 't_wait');
  assert.equal(b.side(0).trap, null, 'The trap was uncovered');
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'kit:depth' && m.n === 3), 'Shows the Deep Burial of the next trap');
  turn(b, setTrap('t_wait', SNARE), 't_wait');
  assert.equal(depth(b), 3);
});

// ───────────────────────── `sandserpent`: Sinking ─────────────────────────

const sink = (b: Battle) => b.active(1).lasting.find((l) => l.key === 'sandserpent_quicksand_vortex');

function serpent(skills: string[], foeSkills = ['t_wait', 't_strike', 't_blast'], foes = 1): Battle {
  return duel([{ id: 'sandserpent', skills }], Array.from({ length: foes }, () => ({ id: FOE, skills: foeSkills })));
}

test('Quicksand Domain: the opponent sinks 1 stack on entering; while on the field the opponent cannot switch voluntarily; Sinking shows on the Wyrm', () => {
  const b = serpent(['t_wait'], ['t_wait'], 2);
  assert.equal(sink(b)?.n, 1);
  assert.equal(b.canSwitch(1).ok, false);
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'kit:sink' && m.n === 1));
});

test('Struggle: a sinking opponent that acts with aether cost loses 3% per stack and sinks 1 more; 0-cost skills do not; Guard counts too', () => {
  const b = serpent(['t_wait']);
  const d = b.active(1);
  turn(b, 't_wait', 't_strike');
  assert.equal(d.hp, d.maxHp, '0-cost skills do not count as struggling');
  const ev = turn(b, 't_wait', 't_blast');
  const q = ev.find((e) => e.k === 'damage' && e.target === 1 && e.reason === 'quicksand') as { dmg: number } | undefined;
  assert.equal(q?.dmg, Math.floor(d.maxHp * 0.03));
  assert.equal(sink(b)?.n, 2, 'The more it struggles, the deeper it sinks');
  const hp = d.hp;
  const ev2 = turn(b, 't_wait', guard());
  assert.equal(hp - d.hp, Math.floor(d.maxHp * 0.06), 'Guard counts as struggling too (2 stacks)');
  assert.match(texts(ev2), /陷沒 3 層/);
  assert.equal(sink(b), undefined, 'Sinking from entering ends after 3 turns (struggling does not refresh the turns)');
});

test('Sand Fang, Tail Lash, Quicksand Vortex: Sinking +1 / +1 / +2 (refreshes 3 turns)', () => {
  const b = serpent(['sandserpent_sand_fang', 'sandserpent_tail_lash', 'sandserpent_quicksand_vortex']);
  b.active(1).lasting = [];
  turn(b, 'sandserpent_sand_fang', 't_wait');
  assert.equal(sink(b)?.n, 1);
  turn(b, 'sandserpent_tail_lash', 't_wait');
  assert.equal(sink(b)?.n, 2);
  b.active(1).lasting = [];
  turn(b, 'sandserpent_quicksand_vortex', 't_wait');
  assert.equal(sink(b)?.n, 2);
  assert.equal(b.active(1).stages.spd, -1);
});

test('Prison of Seven Pillars: Sinking +1; from the next turn a sinking opponent cannot use skills costing 4 or more, nor ultimates', () => {
  const b = serpent(['sandserpent_seven_pillars', 't_wait'], ['t_wait', 'stone_edge', 't_blast']);
  const d = b.active(1);
  d.maxHp *= 20;
  d.hp = d.maxHp;
  const ev = turn(b, 'sandserpent_seven_pillars', 'stone_edge');
  assert.equal(sink(b)?.n, 3, 'Entering 1 + 1 + 1 from the Stone Edge struggle');
  assert.ok(!ev.some((e) => e.k === 'fail'), 'No block on the turn the pillars go up');
  b.side(1).aether = 10;
  assert.equal(b.canUse(1, 'stone_edge').ok, false);
  assert.equal(b.canUse(1, 't_blast').ok, true, 'Costs of 3 or less work as usual');
  const ev2 = turn(b, 't_wait', 'stone_edge');
  assert.ok(ev2.some((e) => e.k === 'fail' && e.side === 1), 'Also blocked when acting');
  b.active(1).lasting = b.active(1).lasting.filter((l) => l.key !== 'sandserpent_quicksand_vortex');
  assert.equal(b.canUse(1, 'stone_edge').ok, true, 'Lifted once it is no longer sinking');
});

test('Breath of Sand: heals 25%, plus 5% per stack of the opponent Sinking', () => {
  const b = serpent(['sandserpent_sand_breath', 'sandserpent_quicksand_vortex']);
  const c = b.active(0);
  c.hp = 1;
  turn(b, 'sandserpent_sand_breath', 't_wait');
  assert.equal(c.hp - 1, Math.floor(c.maxHp * 0.25) + Math.floor(c.maxHp * 0.05));
});

test('Breath Squeeze: +10 power per point of opponent aether (up to +80)', () => {
  const b = serpent(['sandserpent_breath_squeeze']);
  b.side(1).aether = 0;
  const e0 = b.estimate(0, 'sandserpent_breath_squeeze');
  b.side(1).aether = 5;
  assert.ok(Math.abs(b.estimate(0, 'sandserpent_breath_squeeze') / e0 - 120 / 70) < 0.05);
  b.side(1).aether = 10;
  assert.ok(Math.abs(b.estimate(0, 'sandserpent_breath_squeeze') / e0 - 150 / 70) < 0.05, 'Up to +80');
});

test('Engulf: ignores Guard while the opponent is sinking; Collapse of the Sand Sea: +40 power at 3 stacks', () => {
  const b = serpent(['sandserpent_engulf', 'sandserpent_sand_sea']);
  const d = b.active(1);
  turn(b, 'sandserpent_engulf', guard());
  assert.ok(d.hp < d.maxHp, 'Guard cannot stop it while sinking');
  const c = serpent(['sandserpent_engulf']);
  c.active(1).lasting = [];
  turn(c, 'sandserpent_engulf', guard());
  assert.equal(c.active(1).hp, c.active(1).maxHp, 'Blocked by Guard as usual when not sinking');
  const e1 = b.estimate(0, 'sandserpent_sand_sea');
  sink(b)!.n = 3;
  assert.ok(Math.abs(b.estimate(0, 'sandserpent_sand_sea') / e1 - 180 / 140) < 0.05);
});

test('Engulfing Depths: the opponent loses 1 aether per stack of Sinking', () => {
  const b = serpent(['sandserpent_sinking_depths']);
  const d = b.active(1);
  d.maxHp *= 20;
  d.hp = d.maxHp;
  sink(b)!.n = 3;
  b.side(1).aether = 6;
  const ev = turn(b, 'sandserpent_sinking_depths', 't_wait');
  const lost = ev.find((e) => e.k === 'aether' && e.side === 1 && e.delta < 0) as { delta: number } | undefined;
  assert.equal(lost?.delta, -3, '3 stacks of Sinking = 3 aether lost');
});

test('Endless Quicksand: Sinking becomes 3 stacks and entangles the opponent', () => {
  const b = serpent(['t_wait']);
  const d = b.active(1);
  d.maxHp *= 20;
  d.hp = d.maxHp;
  b.active(0).ultimate = 'u_sandserpent';
  turn(b, 'u_sandserpent', 't_wait');
  assert.equal(sink(b)?.n, 3);
  assert.ok(d.bound);
});

// ───────────────────────── `rhino`: Gallop ─────────────────────────

const mom = (b: Battle) => b.active(0).vars['e:rhino:mom'] ?? 0;
const setMom = (b: Battle, n: number) => void (b.active(0).vars['e:rhino:mom'] = n);

/** `rhino` vs `monolith` (HP scaled up to avoid being knocked out); foes = number of opposing spirits */
function rhino(skills: string[], foeSkills = ['t_wait', 't_strike'], foes = 1): Battle {
  const b = duel([{ id: 'rhino', skills }], Array.from({ length: foes }, () => ({ id: FOE, skills: foeSkills })));
  for (const c of b.side(1).team) {
    c.maxHp *= 20;
    c.hp = c.maxHp;
  }
  return b;
}

test('Paw the Ground: can only start from 0 stacks of Gallop, which goes straight to 3 stacks (full speed); Gallop shows in the mark row', () => {
  const b = rhino(['rhino_paw_ground', 't_strike']);
  turn(b, 'rhino_paw_ground', 't_wait');
  assert.equal(mom(b), 3);
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'kit:momentum' && m.n === 3));
  assert.equal(b.canUse(0, 'rhino_paw_ground').ok, false, 'Cannot paw the ground when already running');
  setMom(b, 0);
  assert.equal(b.canUse(0, 'rhino_paw_ground').ok, true);
});

test('Run-up physical skills: Horn Butt, Trample, Canyon Run and Raging Hooves give Gallop +1 on hit; Head Shake and Heavy Stride are run-up status skills that give +1', () => {
  const b = rhino(['rhino_horn_butt', 'rhino_trample', 'rhino_canyon_run', 'rhino_rage_hooves', 'rhino_head_shake', 'rhino_heavy_step']);
  turn(b, 'rhino_horn_butt', 't_wait');
  assert.equal(mom(b), 1);
  turn(b, 'rhino_trample', 't_wait');
  assert.equal(mom(b), 2);
  assert.equal(b.active(1).stages.spd, -1, 'Trample: opponent Speed −1 stage');
  setMom(b, 0);
  turn(b, 'rhino_canyon_run', 't_wait');
  turn(b, 'rhino_rage_hooves', 't_wait');
  assert.equal(mom(b), 2);
  setMom(b, 0);
  turn(b, 'rhino_head_shake', 't_wait');
  turn(b, 'rhino_heavy_step', 't_wait');
  assert.equal(mom(b), 2, 'A turn with a run-up status skill does not stop');
});

test('Gallop: +8% physical damage per stack; Canyon Run gets +30 power instead at full speed', () => {
  const b = rhino(['t_strike', 'rhino_canyon_run']);
  const base = b.estimate(0, 't_strike');
  const run = b.estimate(0, 'rhino_canyon_run');
  setMom(b, 3);
  // The old trait "Charge": `rhino` is faster than `monolith`, physical +20% (added to Gallop's +24%)
  assert.ok(Math.abs(b.estimate(0, 't_strike') / base - 1.44 / 1.2) < 0.03);
  assert.ok(Math.abs(b.estimate(0, 'rhino_canyon_run') / run - (1.44 / 1.2) * (120 / 90)) < 0.04);
});

test('Stopping: Gallop resets to zero when this turn used neither a physical skill nor a run-up skill (other status skills or Guard)', () => {
  const b = rhino(['t_wait', 'rhino_horn_butt']);
  setMom(b, 2);
  const ev = turn(b, 't_wait', 't_wait');
  assert.equal(mom(b), 0);
  assert.match(texts(ev), /停下了腳步/);
  setMom(b, 2);
  turn(b, guard(), 't_wait');
  assert.equal(mom(b), 0, 'Guard is a stop too');
});

test('Wall Crash: below full speed a guarded physical skill → Gallop resets to zero with 8% loss per stack; at full speed a guarded non-Ram physical skill is simply blocked', () => {
  const b = rhino(['rhino_horn_butt', 't_strike']);
  const c = b.active(0);
  setMom(b, 2);
  const ev = turn(b, 'rhino_horn_butt', guard());
  assert.equal(mom(b), 0);
  assert.equal(c.maxHp - c.hp, Math.floor(c.maxHp * 0.16));
  assert.match(texts(ev), /撞牆/);
  // A basic physical skill (no hooks) that is guarded also hits the wall
  c.hp = c.maxHp;
  setMom(b, 1);
  turn(b, 't_strike', 't_wait');
  setMom(b, 1);
  turn(b, 't_strike', guard());
  assert.equal(mom(b), 0);
  assert.equal(c.maxHp - c.hp, Math.floor(c.maxHp * 0.08));
  // Full speed: `rhino_horn_butt` is guarded -> it is blocked, but no wall crash
  c.hp = c.maxHp;
  setMom(b, 3);
  turn(b, 'rhino_horn_butt', 't_wait');
  turn(b, 'rhino_horn_butt', guard());
  assert.equal(mom(b), 3);
  assert.equal(c.hp, c.maxHp);
});

test('Horn Charge: at full speed +70 power and ignores Guard, slows down after hitting (Gallop −1); below full speed a Guard causes a Wall Crash', () => {
  const b = rhino(['horn_charge']);
  const e0 = b.estimate(0, 'horn_charge');
  setMom(b, 3);
  assert.ok(Math.abs(b.estimate(0, 'horn_charge') / e0 - (1.44 / 1.2) * (120 / 50)) < 0.05);
  const d = b.active(1);
  const ev = turn(b, 'horn_charge', guard());
  assert.ok(d.hp < d.maxHp, 'A full-speed Ram breaks through the Guard');
  assert.equal(mom(b), 2, 'Slows down after breaking through');
  assert.match(texts(ev), /慢了下來/);
});

test('Siege Horn: +90 power at full speed, and after hitting it knocks the opponent away (forced switch); no knock-away below full speed', () => {
  const b = rhino(['rhino_siege_horn'], ['t_wait'], 2);
  turn(b, 'rhino_siege_horn', 't_wait');
  assert.equal(b.side(1).active, 0, 'Below full speed: no knock-away');
  const e0 = b.estimate(0, 'rhino_siege_horn');
  setMom(b, 3);
  assert.ok(b.estimate(0, 'rhino_siege_horn') / e0 > (140 / 50) * 0.98);
  const ev = turn(b, 'rhino_siege_horn', guard());
  assert.equal(b.side(1).active, 1, 'Knock-away: the opponent is forced to switch');
  assert.match(texts(ev), /撞飛/);
  assert.equal(mom(b), 2);
});

test('Ironhoof Breach: always ignores Guard; +40 power when the opponent guards, and no Wall Crash', () => {
  const b = rhino(['rhino_ironhoof']);
  const d = b.active(1);
  const e0 = b.estimate(0, 'rhino_ironhoof');
  d.guarding = true;
  assert.ok(Math.abs(b.estimate(0, 'rhino_ironhoof') / e0 - 100 / 60) < 0.03);
  d.guarding = false;
  setMom(b, 2);
  turn(b, 'rhino_ironhoof', guard());
  assert.ok(d.hp < d.maxHp);
  assert.equal(mom(b), 2, 'Breaks through the Guard: no Wall Crash, Gallop is kept');
});

test('Canyon Rampage: a Guard below full speed causes a Wall Crash; after hitting, Gallop becomes 3 stacks', () => {
  const b = rhino(['t_strike']);
  b.active(0).ultimate = 'u_rhino';
  setMom(b, 1);
  const ev = turn(b, 'u_rhino', guard());
  assert.match(texts(ev), /撞牆/);
  assert.equal(mom(b), 0);
  const c = rhino(['t_strike']);
  c.active(0).ultimate = 'u_rhino';
  turn(c, 'u_rhino', 't_wait');
  assert.equal(mom(c), 3);
});

test('Canyon Warbeast AI: paws the ground to start at 0 stacks and rams at full speed; opponent AI: does not guard at full speed, nor when Canyon Warbeast can reach full speed with a status skill', () => {
  const skills = ['rhino_paw_ground', 'rhino_siege_horn', 'rhino_horn_butt', 'rhino_ironhoof'];
  const b = duel([{ id: 'rhino', skills }], [{ id: FOE, skills: ['t_strike'] }]);
  // Neither side has an ultimate (an opposing ultimate that is fully charged would make the AI want to guard)
  b.active(0).ultimate = null;
  b.active(1).ultimate = null;
  assert.deepEqual(chooseAction(b, 0, { skill: 1 }).main, { type: 'skill', skillId: 'rhino_paw_ground' });
  setMom(b, 3);
  assert.deepEqual(chooseAction(b, 0, { skill: 1 }).main, { type: 'skill', skillId: 'rhino_siege_horn' });
  assert.equal(KIT.rhino.aiFoeGuard!(b, 0, 0), -30, 'Full speed: the Ram breaks through the Guard');
  const c = rhino(['rhino_horn_butt', 'rhino_head_shake']);
  c.active(0).vars['e:rhino:mom'] = 2;
  assert.equal(KIT.rhino.aiFoeGuard!(c, 0, 0), -20, 'Head Shake can top up straight to full speed, so the Guard is wasted');
  assert.ok(FX.rhino_paw_ground.canUse);
});

// ───────────────────────── `monolith`: Stone Oath ─────────────────────────

const VOW = 'e:mono:vow';
const vow = (b: Battle, side: SideId = 0) => b.active(side).vars[VOW] ?? 0;

/** `monolith` vs `rhino` (test skills); the opponent's ATK is raised to a one-hit kill */
function monolith(skills: string[], foeSkills = ['t_wait', 't_strike', DOUBLE.id]): Battle {
  const b = duel([{ id: 'monolith', skills }], [{ id: 'rhino', skills: foeSkills }]);
  b.active(0).ultimate = null;
  return b;
}

test('Stone Oath: Engrave sets the oath on hit (shown in the mark row); at 30% HP or more a lethal hit leaves 1 HP instead and the Stone Oath shatters', () => {
  const b = monolith(['monolith_engrave', 't_wait']);
  const m = b.active(0);
  turn(b, 'monolith_engrave', 't_wait');
  assert.equal(vow(b), 1);
  assert.ok(b.view().sides[0].team[0].marks.some((k) => k.id === 'kit:vow'), 'Stone Oath shows in the mark row');
  m.hp = Math.floor(m.maxHp * 0.5);
  b.active(1).stats.atk = 99999;
  const ev = turn(b, 't_wait', 't_strike');
  assert.equal(m.hp, 1);
  assert.equal(m.fainted, false);
  assert.equal(vow(b), 0, 'Stone Oath shattered');
  assert.match(texts(ev), /石誓」碎裂/);
  turn(b, 't_wait', 't_strike');
  assert.ok(m.fainted, 'Once the Stone Oath is shattered it can no longer block');
});

test('Stone Oath: does not trigger below 30% HP; at full HP the trait "Firm Stone" blocks first and the Stone Oath is kept; each hit of a multi-hit attack is judged separately', () => {
  const low = monolith(['t_wait']);
  low.active(0).vars[VOW] = 1;
  low.active(0).hp = Math.floor(low.active(0).maxHp * 0.29);
  low.active(1).stats.atk = 99999;
  turn(low, 't_wait', 't_strike');
  assert.ok(low.active(0).fainted, 'HP at 30% or below: Stone Oath does not trigger');

  const full = monolith(['t_wait']);
  full.active(0).vars[VOW] = 1;
  full.active(1).stats.atk = 99999;
  const ev = turn(full, 't_wait', 't_strike');
  assert.equal(full.active(0).hp, 1);
  assert.ok(traits(ev).includes('堅石'), 'Full HP: Firm Stone blocks');
  assert.equal(vow(full), 1, 'Stone Oath is kept');

  const multi = monolith(['t_wait']);
  multi.active(0).vars[VOW] = 1;
  multi.active(0).hp = Math.floor(multi.active(0).maxHp * 0.6);
  multi.active(1).stats.atk = 99999;
  turn(multi, 't_wait', DOUBLE.id);
  assert.ok(multi.active(0).fainted, 'The first hit is blocked by the Stone Oath, the second knocks it out');
});

test('Body Press: power +30 after being attacked this turn (the turn is recorded when hit)', () => {
  const b = monolith(['body_press', 't_wait']);
  const e0 = b.estimate(0, 'body_press');
  turn(b, 't_wait', 't_strike');
  assert.equal(b.active(0).vars['e:mono:hit'], b.s.turn, 'The turn is recorded when attacked');
  assert.ok(Math.abs(b.estimate(0, 'body_press') / e0 - 1) < 0.01, 'The AI estimate does not count a hit from the previous turn');
  // Real battle: priority -1, the opponent hits first, and `body_press` gets the bonus
  const c = monolith(['body_press', 't_wait']);
  const plain = hitsBy(turn(c, 'body_press', 't_wait'), 0)[0].dmg;
  const hit = hitsBy(turn(c, 'body_press', 't_strike'), 0)[0].dmg;
  assert.ok(hit / plain > 1.3 && hit / plain < 1.7);
});

test('Colossal Vow: taunts the opponent and swears the oath; Earthsplitter swears the oath after hitting', () => {
  const b = monolith(['monolith_colossus_vow', 't_wait']);
  turn(b, 'monolith_colossus_vow', 't_wait');
  assert.ok(b.active(1).status.taunt, 'Taunted');
  assert.equal(vow(b), 1);
  b.active(0).vars[VOW] = 0;
  b.active(0).ultimate = 'u_earth';
  turn(b, 'u_earth', 't_wait');
  assert.equal(vow(b), 1);
});

// ───────────────────────── `digmole`: Surfacing ─────────────────────────

const WHIFF = 'e:mole:whiff';

/** `digmole` (SPD 100) vs `monolith` (SPD 35) */
function mole(skills: string[], foeSkills = ['t_wait', 't_strike', 't_quick_strike']): Battle {
  const b = duel([{ id: 'digmole', skills }], [{ id: FOE, skills: foeSkills }]);
  b.active(0).ultimate = null;
  b.active(1).ultimate = null;
  return b;
}

test('Surfacing: opponent attacks whiff on the burrowing turn → the next surfacing strike gets +50% power and ignores Guard; the whiff is cleared after hitting', () => {
  const b = mole(['dig_strike', 't_wait']);
  const e0 = b.estimate(0, 'dig_strike');
  const ev = turn(b, 'dig_strike', 't_strike');
  assert.ok(ev.some((e) => e.k === 'miss' && e.side === 1), 'The opponent attack missed');
  assert.equal(b.active(0).vars[WHIFF], 1);
  assert.match(texts(ev), /撲空/);
  assert.ok(b.view().sides[0].team[0].marks.some((k) => k.id === 'kit:whiff'), 'The whiff shows in the mark row');
  b.active(0).hidden = false;
  assert.ok(Math.abs(b.estimate(0, 'dig_strike') / e0 - 1.5) < 0.03);
  b.active(0).hidden = true;
  const d = b.active(1);
  turn(b, 'dig_strike', guard());
  assert.ok(d.hp < d.maxHp, 'The surfacing strike after a whiff breaks through the Guard');
  assert.equal(b.active(0).vars[WHIFF], undefined, 'Cleared after hitting');
});

test('Surfacing: without a whiff it is blocked by Guard as usual; an opponent that moves first and whiffs before the surfacing strike counts for this one too', () => {
  const b = mole(['dig_strike', 't_wait']);
  turn(b, 'dig_strike', 't_wait');
  assert.equal(b.active(0).vars[WHIFF], undefined);
  const d = b.active(1);
  turn(b, 'dig_strike', guard());
  assert.equal(d.hp, d.maxHp, 'Guard blocks the surfacing strike');

  // An attack with priority +1 acts before the surfacing -> whiff, and this surfacing gets +50%
  const plain = mole(['dig_strike', 't_wait']);
  turn(plain, 'dig_strike', 't_wait');
  const base = hitsBy(turn(plain, 'dig_strike', 't_wait'), 0)[0].dmg;
  const fast = mole(['dig_strike', 't_wait']);
  turn(fast, 'dig_strike', 't_wait');
  const ev = turn(fast, 'dig_strike', 't_quick_strike');
  assert.ok(ev.some((e) => e.k === 'miss' && e.side === 1));
  const boosted = hitsBy(ev, 0)[0].dmg;
  assert.ok(boosted / base > 1.35 && boosted / base < 1.65);
});

test('Crystal Ambush: when the opponent has whiffed, surfacing gains 2 aether', () => {
  const run = (foe: string) => {
    const b = mole(['digmole_crystal_burst', 't_wait']);
    turn(b, 'digmole_crystal_burst', foe);
    b.side(0).aether = 3;
    const ev = b.resolveTurn([use('digmole_crystal_burst'), use('t_wait')]);
    return { ae: b.side(0).aether, text: texts(ev) };
  };
  const whiff = run('t_strike');
  const none = run('t_wait');
  assert.equal(whiff.ae - none.ae, 2);
  assert.match(whiff.text, /晶礦/);
});

test('Vein Seeker: Crystal Delver reveals the trap the opponent has set when entering', () => {
  const b = duel([{ id: FOE, skills: ['t_wait'] }, { id: 'digmole', skills: ['t_wait'] }], [{ id: FOE, skills: ['t_wait'] }]);
  b.side(1).trap = { skillId: 't_trap', setTurn: b.s.turn, revealed: false };
  const ev = turn(b, sw(1), 't_wait');
  assert.ok(traits(ev).includes('探脈'));
  assert.ok(ev.some((e) => e.k === 'reveal' && e.side === 1));
});

test('Crystal Delver AI: when the opponent estimates damage, an underground Crystal Delver that will surface first is estimated as usual; the opponent guards the surfacing strike (but not after a whiff)', () => {
  const b = mole(['dig_strike', 't_wait']);
  turn(b, 'dig_strike', 't_wait');
  assert.ok(b.active(0).hidden && b.active(0).charging);
  assert.ok(b.estimate(1, 't_strike') > 0, 'Crystal Delver is faster: the opponent attack lands after the surfacing strike');
  assert.equal(b.estimate(1, 't_quick_strike'), 0, 'Priority +1: lands before the surfacing strike, so it whiffs');
  assert.equal(KIT.digmole.aiFoeGuard!(b, 0, 0), 20, 'No whiff yet: guard against the surfacing strike');
  b.active(0).vars[WHIFF] = 1;
  assert.equal(KIT.digmole.aiFoeGuard!(b, 0, 0), -30, 'After a whiff the surfacing strike ignores Guard');
  assert.ok(FX.dig_strike.emergesFirst);
});

// ───────────────────────── `gargoyle`: Stone Veins ─────────────────────────

const veins = (b: Battle) => Math.max(0, -b.active(1).stages.spd);

test('Stone Veins: on entering and at the end of every turn Gatewarden lowers the opponent Speed by 1 stage (Stone Veins +1); Stone Veins show on Gatewarden', () => {
  const b = duel([{ id: 'gargoyle', skills: ['t_wait'] }], [{ id: FOE, skills: ['t_wait'] }]);
  assert.equal(veins(b), 1);
  turn(b, 't_wait', 't_wait');
  assert.equal(veins(b), 2);
  assert.ok(b.view().sides[0].team[0].marks.some((k) => k.id === 'kit:veins' && k.n === 2));
});

test('Crack: each vein adds power (Crackling Claw +30, Shatter the Statue +35, Millennial Seal +40 and counts 2 extra veins), and the veins reset to zero after hitting', () => {
  const b = duel([{ id: 'gargoyle', skills: ['gargoyle_crack', 'gargoyle_shatter', 't_wait'] }], [{ id: FOE, skills: ['t_wait'] }]);
  const d = b.active(1);
  b.active(0).ultimate = 'u_gargoyle';
  const at = (n: number, sk: string) => {
    d.stages.spd = -n;
    return b.estimate(0, sk);
  };
  assert.ok(Math.abs(at(3, 'gargoyle_crack') / at(0, 'gargoyle_crack') - 150 / 60) < 0.05);
  assert.ok(Math.abs(at(3, 'gargoyle_shatter') / at(0, 'gargoyle_shatter') - 190 / 85) < 0.05);
  assert.ok(Math.abs(at(3, 'u_gargoyle') / at(0, 'u_gargoyle') - 310 / 190) < 0.05);
  d.stages.spd = -3;
  const ev = turn(b, 'gargoyle_shatter', 't_wait');
  assert.match(texts(ev), /3 道「石紋」碎了/);
  assert.equal(d.stages.spd, -1, 'Reset to zero after shattering, then 1 more vein at the end of the turn');
});

test('Gatewarden AI: with fewer than 2 veins and room to engrave more, do not crack yet', () => {
  const b = duel([{ id: 'gargoyle', skills: ['gargoyle_grit', 'gargoyle_shatter', 'stone_gaze'] }], [{ id: FOE, skills: ['t_wait'] }]);
  b.active(1).stages.spd = -1;
  assert.ok(FX.gargoyle_shatter.aiScore!(b, 0, 40) < 0);
  b.active(1).stages.spd = -3;
  assert.ok(FX.gargoyle_shatter.aiScore!(b, 0, 40) > 0);
  assert.ok(FX.stone_gaze.aiScore!(b, 0, 40) < 0, 'Enough veins, so no more Stone Gaze');
});
