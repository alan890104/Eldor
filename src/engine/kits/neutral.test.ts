// Mechanics tests for the neutral group: node --test src/engine/kits/neutral.test.ts
// `eldarin`: pact clauses (signing, breach, penalty, cashing in) and the effect of each hook skill.
// `relic_blade`: Foresight and Sword Intent. `grimoire`: copybook (copy, transcribe, page-tearing, mirroring). `inkcat`: ink stains (splash, reverse, fling).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerKitHooks } from './index.ts';
import { KIT } from './neutral.ts';
import { duel, guard, hitsBy, sw, turn, use, useTestSkills } from '../testkit.ts';
import type { BattleEvent, SideId } from '../types.ts';
import { getSkill, getSpirit, learnedSkills } from '../../data.ts';
import { isAttack, skillCost, type Battle } from '../battle.ts';

useTestSkills();
// The test opponents carry no kit hooks (the group's mechanics may still be changing), leaving only the behavior of the t_ test skills
for (const id of ['cloudfluff', 'clockmouse', 'monolith']) registerKitHooks(id, null);

const CLAUSES = ['eldarin_clash_pact', 'eldarin_hush_pact', 'eldarin_name_pact', 'u_eldarin'];
const clause = (b: Battle, id: SideId = 0) => b.active(id).lasting.find((l) => CLAUSES.includes(l.key));
const breaches = (b: Battle) => b.active(0).vars['e:eld:breach'] ?? 0;
const marks = (b: Battle) => b.view().sides[0].team[b.side(0).active].marks;
const dealt = (ev: BattleEvent[], side: SideId) => hitsBy(ev, side).reduce((a, h) => a + h.dmg + h.shieldDmg, 0);
const usedOrder = (ev: BattleEvent[]) => ev.filter((e) => e.k === 'use').map((e) => (e as { side: SideId }).side);
/** Makes the opponent hold out (the tests check effects, not KOs) */
const sturdy = (b: Battle, id: SideId = 1) => {
  const d = b.active(id);
  d.maxHp = d.hp = 100000;
};
/** The first skill after entering is free (First Pact): spend it up front so it does not disturb the aether math */
const spendFree = (b: Battle) => void (b.active(0).usedSinceEnter = 1);

const dragon = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'eldarin', skills }, ...extra];
const foe = (skills = ['t_strike', 't_bolt', 't_wait'], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'cloudfluff', skills }, ...extra];

// ───────────────────────── Trait: First Pact ─────────────────────────

test('First Pact: signs the Pact of Clash for 3 turns on entering; the first skill after entering is free', () => {
  const b = duel(dragon(['eldarin_oath_flame', 't_wait']), foe());
  const l = clause(b);
  assert.equal(l?.key, 'eldarin_clash_pact');
  assert.equal(l?.turns, 3);
  b.side(0).aether = 0;
  assert.equal(b.canUse(0, 'eldarin_oath_flame').ok, true);
  assert.ok(marks(b).some((m) => m.id === 'fx:eldarin_clash_pact'));
});

test('First Pact: the clause lapses on leaving and is signed again on re-entering', () => {
  const b = duel(dragon(['t_wait'], [{ id: 'monolith', skills: ['t_wait'] }]), foe(['t_wait']));
  turn(b, sw(1), 't_wait');
  assert.equal(b.side(0).team[0].lasting.length, 0);
  turn(b, sw(0), 't_wait');
  assert.equal(clause(b)?.key, 'eldarin_clash_pact');
});

// ───────────────────────── Breach ─────────────────────────

test('Pact of Clash: a guard by the opponent is a breach and hands 2 aether to Eldarin', () => {
  const b = duel(dragon(['t_wait']), foe());
  b.side(0).aether = 3;
  b.side(1).aether = 5;
  b.resolveTurn([use('t_wait'), guard()]);
  // Opponent: 5 − 1 (guard) − 2 (penalty) + 2 (turn recovery); `eldarin`: 3 + 2 + 2
  assert.equal(b.side(1).aether, 4);
  assert.equal(b.side(0).aether, 7);
  assert.equal(breaches(b), 1);
  assert.ok(marks(b).some((m) => m.id === 'kit:breach' && m.n === 1));
});

test('Penalty short: each missing point of aether becomes a loss of 6% max HP', () => {
  const b = duel(dragon(['t_wait']), foe());
  b.side(1).aether = 1;
  const d = b.active(1);
  const hp = d.hp;
  b.resolveTurn([use('t_wait'), guard()]);
  assert.equal(hp - d.hp, Math.floor((d.maxHp * 12) / 100));
});

test('Pact of Clash: a voluntary switch is also a breach; a replacement after a KO does not count', () => {
  const b = duel(dragon(['t_wait', 'eldarin_verdict_fang']), foe(['t_wait'], [{ id: 'clockmouse', skills: ['t_wait'] }]));
  b.side(0).aether = 0;
  b.side(1).aether = 4;
  b.resolveTurn([use('t_wait'), sw(1)]);
  assert.equal(b.side(1).aether, 4);
  assert.equal(b.side(0).aether, 4);
  // Replacement after a KO: not counted as a breach at the end of next turn
  const c = duel(dragon(['eldarin_verdict_fang', 't_wait']), foe(['t_wait'], [{ id: 'clockmouse', skills: ['t_wait'] }]));
  c.active(1).hp = 1;
  turn(c, 'eldarin_verdict_fang', 't_wait');
  c.replace([null, 1]);
  c.side(1).aether = 4;
  c.resolveTurn([use('t_wait'), use('t_wait')]);
  assert.equal(c.side(1).aether, 6);
});

test('On the turn of signing only actions after the signing count (a guard always comes before signing)', () => {
  const b = duel(dragon(['eldarin_hush_pact', 'eldarin_clash_pact', 't_wait']), foe());
  turn(b, 'eldarin_hush_pact', 't_wait');
  assert.equal(clause(b)?.key, 'eldarin_hush_pact', 'the new clause replaces the old one');
  assert.equal(b.active(0).lasting.filter((l) => CLAUSES.includes(l.key)).length, 1);
  b.side(1).aether = 5;
  b.resolveTurn([use('eldarin_clash_pact'), guard()]);
  assert.equal(clause(b)?.key, 'eldarin_clash_pact');
  assert.equal(b.side(1).aether, 6, '5 − 1 guard + 2 recovery, no penalty');
});

test('Pact of Hush: the opponent breaches by using a status skill; Eldarin breaches too by setting a trap', () => {
  const b = duel(dragon(['eldarin_hush_pact', 't_wait', 'eldarin_oath_scale']), foe(['t_war_cry', 't_wait']));
  turn(b, 'eldarin_hush_pact', 't_wait');
  b.side(0).aether = 2;
  b.side(1).aether = 5;
  b.resolveTurn([use('t_wait'), use('t_war_cry')]);
  assert.equal(b.side(1).aether, 4, '5 − 1 − 2 + 2');
  assert.equal(b.side(0).aether, 6, '2 + 2 + 2');
  b.side(0).aether = 5;
  b.side(1).aether = 0;
  b.resolveTurn([use('t_wait', 'eldarin_oath_scale'), use('t_wait')]);
  assert.equal(b.side(0).aether, 3, '5 − 2 trap − 2 penalty + 2');
  assert.equal(b.side(1).aether, 4, '0 + 2 + 2');
});

test('Clearing turn-based effects can tear off the clause (Pactbreaker Claw)', () => {
  const b = duel(dragon(['t_wait']), [{ id: 'eldarin', skills: ['eldarin_pact_breaker'] }]);
  sturdy(b, 0);
  assert.ok(clause(b));
  turn(b, 't_wait', 'eldarin_pact_breaker');
  assert.equal(clause(b), undefined);
});

// ───────────────────────── Skills ─────────────────────────

test('Sigil Claw: +1 aether on a hit under a clause, none without one', () => {
  const b = duel(dragon(['eldarin_sigil_claw']), foe(['t_wait']));
  sturdy(b);
  b.side(0).aether = 0;
  b.resolveTurn([use('eldarin_sigil_claw'), use('t_wait')]);
  assert.equal(b.side(0).aether, 3);
  b.removeLasting(0, 'eldarin_clash_pact');
  b.side(0).aether = 0;
  b.resolveTurn([use('eldarin_sigil_claw'), use('t_wait')]);
  assert.equal(b.side(0).aether, 2);
});

test('Oathflame: Channel gives +30 per point under a clause, +20 without one', () => {
  const b = duel(dragon(['eldarin_oath_flame']), foe(['t_wait']));
  spendFree(b);
  b.side(0).aether = 10;
  const withPact = b.estimate(0, 'eldarin_oath_flame');
  b.removeLasting(0, 'eldarin_clash_pact');
  const without = b.estimate(0, 'eldarin_oath_flame');
  // (90 + 8 × 30) ÷ (90 + 8 × 20) = 330 ÷ 250
  assert.ok(withPact / without > 1.25 && withPact / without < 1.4, `${withPact} / ${without}`);
  sturdy(b);
  b.addLasting(0, 'eldarin_clash_pact', 3);
  b.resolveTurn([use('eldarin_oath_flame'), use('t_wait')]);
  assert.equal(b.side(0).aether, 2, 'Channel uses up all aether, leaving only the turn recovery');
});

test('Breath of the First Pact: Channel gives +20 per point; +25 per point under a clause', () => {
  const b = duel(dragon(['pact_breath']), foe(['t_wait']));
  spendFree(b);
  b.side(0).aether = 10;
  const withPact = b.estimate(0, 'pact_breath');
  b.removeLasting(0, 'eldarin_clash_pact');
  const without = b.estimate(0, 'pact_breath');
  // (75 + 8 × 25) ÷ (75 + 8 × 20) = 275 ÷ 235
  assert.ok(Math.abs(withPact / without - 275 / 235) < 0.03, `${withPact} / ${without}`);
});

test('Sigil Bolt: power +50 if the opponent has breached', () => {
  const b = duel(dragon(['eldarin_sigil_bolt']), foe(['t_wait']));
  const base = b.estimate(0, 'eldarin_sigil_bolt');
  b.active(0).vars['e:eld:breach'] = 1;
  const boosted = b.estimate(0, 'eldarin_sigil_bolt');
  assert.ok(Math.abs(boosted / base - 120 / 70) < 0.05, `${boosted} / ${base}`);
});

test('Settling Claw: +60 per breach (max +180), ends the clause after the attack', () => {
  const b = duel(dragon(['eldarin_settlement']), foe(['t_wait']));
  sturdy(b);
  const base = b.estimate(0, 'eldarin_settlement');
  b.active(0).vars['e:eld:breach'] = 2;
  assert.ok(Math.abs(b.estimate(0, 'eldarin_settlement') / base - 220 / 100) < 0.05);
  b.active(0).vars['e:eld:breach'] = 5;
  assert.ok(Math.abs(b.estimate(0, 'eldarin_settlement') / base - 280 / 100) < 0.05, 'at most +180');
  turn(b, 'eldarin_settlement', 't_wait');
  assert.equal(clause(b), undefined);
  assert.equal(breaches(b), 0);
});

test('Verdict Fang: pierces Guard; always crits if the opponent has breached', () => {
  const b = duel(dragon(['eldarin_verdict_fang']), foe(['t_wait']));
  sturdy(b);
  b.active(0).vars['e:eld:breach'] = 1;
  const ev = turn(b, 'eldarin_verdict_fang', guard());
  const hits = hitsBy(ev, 0);
  assert.ok(hits.length > 0 && hits[0].dmg > 0, 'pierces the guard');
  assert.equal(hits[0].crit, true);
});

test('Binding Tail: extends the clause by 1 turn (max 3 turns)', () => {
  const b = duel(dragon(['eldarin_binding_tail', 't_wait']), foe(['t_wait']));
  sturdy(b);
  turn(b, 't_wait', 't_wait');
  assert.equal(clause(b)?.turns, 2);
  turn(b, 'eldarin_binding_tail', 't_wait');
  assert.equal(clause(b)?.turns, 2, 'extended to 3, −1 at the end of the turn');
  turn(b, 't_wait', 't_wait');
  assert.equal(clause(b)?.turns, 1);
});

test('Oathwing Raid: priority +1 under a clause (acts before a faster opponent)', () => {
  const b = duel(dragon(['eldarin_oathwing']), [{ id: 'clockmouse', skills: ['t_strike'] }]);
  sturdy(b);
  sturdy(b, 0);
  assert.deepEqual(usedOrder(turn(b, 'eldarin_oathwing', 't_strike')), [0, 1]);
  b.removeLasting(0, 'eldarin_clash_pact');
  assert.deepEqual(usedOrder(turn(b, 'eldarin_oathwing', 't_strike')), [1, 0]);
});

test('Oath Scale: damage −40% when hit; under a clause the attacker breaches', () => {
  const plain = duel(dragon(['t_wait']), foe(['t_strike']));
  sturdy(plain, 0);
  const raw = dealt(turn(plain, 't_wait', 't_strike'), 1);
  const b = duel(dragon(['t_wait', 'eldarin_oath_scale']), foe(['t_strike']));
  sturdy(b, 0);
  turn(b, use('t_wait', 'eldarin_oath_scale'), 't_wait');
  b.side(0).aether = 0;
  b.side(1).aether = 5;
  const ev = b.resolveTurn([use('t_wait'), use('t_strike')]);
  assert.ok(ev.some((e) => e.k === 'trap' && e.side === 0));
  const got = dealt(ev, 1);
  assert.ok(got < raw * 0.7 && got > raw * 0.5, `${got} vs ${raw}`);
  assert.equal(b.side(1).aether, 5, '5 − 2 penalty + 2');
  assert.equal(b.side(0).aether, 4, '0 + 2 + 2');
  assert.equal(breaches(b), 1);
});

test('Pact of True Names: names the last skill the opponent used; using it again is a breach, using another is not', () => {
  const b = duel(dragon(['eldarin_name_pact', 't_wait']), foe(['t_strike', 't_bolt']));
  sturdy(b, 0);
  assert.equal(b.canUse(0, 'eldarin_name_pact').ok, false, 'the opponent has not used a skill yet');
  turn(b, 't_wait', 't_strike');
  // `eldarin` is faster than `cloudfluff`: it signs first (naming last turn's strike), and the opponent uses the bolt instead this turn
  turn(b, 'eldarin_name_pact', 't_bolt');
  assert.equal(clause(b)?.key, 'eldarin_name_pact');
  assert.equal(breaches(b), 0, 'using another skill: no breach');
  assert.ok(marks(b).some((m) => m.id === 'kit:truename' && m.note?.includes('t_strike')));
  b.side(1).aether = 5;
  b.resolveTurn([use('t_wait'), use('t_strike')]);
  assert.equal(b.side(1).aether, 5, '5 − 2 penalty + 2');
  assert.equal(breaches(b), 1);
});

test('Pact of True Names: skills used before the signing (same turn, the opponent acting first) do not count', () => {
  const b = duel(dragon(['eldarin_name_pact', 't_wait']), [{ id: 'clockmouse', skills: ['t_strike', 't_bolt'] }]);
  sturdy(b, 0);
  turn(b, 't_wait', 't_strike');
  turn(b, 'eldarin_name_pact', 't_strike');
  assert.equal(clause(b)?.key, 'eldarin_name_pact');
  assert.equal(breaches(b), 0);
  turn(b, 't_wait', 't_strike');
  assert.equal(breaches(b), 1);
});

test('True Name: Eldarin: pierces Guard; after a hit signs the universal pact (guarding, switching, status skills and traps all count as breaches)', () => {
  const b = duel(dragon(['t_wait']), foe(['t_war_cry', 't_wait']));
  sturdy(b);
  const ev = turn(b, 'u_eldarin', guard());
  assert.ok(dealt(ev, 0) > 0, 'pierces the guard');
  assert.equal(clause(b)?.key, 'u_eldarin');
  b.side(1).aether = 5;
  b.resolveTurn([use('t_wait'), use('t_war_cry')]);
  assert.equal(b.side(1).aether, 4, 'status skill breach: 5 − 1 − 2 + 2');
  b.side(1).aether = 5;
  b.resolveTurn([use('t_wait'), guard()]);
  assert.equal(b.side(1).aether, 4, 'guard breach: 5 − 1 − 2 + 2');
});

test('Eldarin AI: does not guard under the Pact of Clash (guarding is a breach), no effect without a clause', () => {
  const b = duel(dragon(['t_wait']), foe());
  const aiGuard = KIT.eldarin.aiGuard!;
  assert.ok(aiGuard(b, 0, 40) < 0, 'Pact of Clash: guarding is penalized');
  b.removeLasting(0, 'eldarin_clash_pact');
  assert.equal(aiGuard(b, 0, 40), 0);
  b.addLasting(0, 'eldarin_hush_pact', 3);
  assert.equal(aiGuard(b, 0, 40), 0, 'Pact of Hush does not forbid guarding');
});

// ═════════════════════════ `relic_blade`: Foresight ═════════════════════════

const blade = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'relic_blade', skills }, ...extra];
const intent = (b: Battle, id: SideId = 0) => b.active(id).vars['e:rb:intent'] ?? 0;
/** Fixed RNG: damage variance is fixed and there are no natural crits (only guaranteed crits crit) */
const calm = (b: Battle) => void ((b as { rng: () => number }).rng = () => 0.99);
const hitsOf = (ev: BattleEvent[], side: SideId, skillId: string) => hitsBy(ev, side).filter((h) => h.skillId === skillId);
const dmgOf = (ev: BattleEvent[], side: SideId, skillId: string) => hitsOf(ev, side, skillId).reduce((a, h) => a + h.dmg + h.shieldDmg, 0);
const near = (got: number, want: number, tol = 0.04) => Math.abs(got - want) < tol;

test('Foresight (1): a guard that blocks an attack → Sword Intent +1 and a counter with Relic Edge (trait "Sword Intent")', () => {
  const b = duel(blade(['t_wait']), foe(['t_strike']));
  sturdy(b);
  const ev = turn(b, guard(), 't_strike');
  assert.equal(intent(b), 1);
  assert.ok(ev.some((e) => e.k === 'trait' && e.side === 0 && e.name === '劍意'));
  assert.equal(hitsOf(ev, 0, 'relic_blade_edge').length, 1, 'the counter-slash');
  assert.ok(marks(b).some((m) => m.id === 'kit:intent' && m.n === 1));
});

test('Foresight (2): countering with a physical skill after being attacked → Sword Intent +1; acting first does not count', () => {
  const b = duel(blade(['relic_blade_edge']), foe(['t_strike', 't_quick_strike', 't_wait']));
  sturdy(b);
  sturdy(b, 0);
  turn(b, 'relic_blade_edge', 't_strike');
  assert.equal(intent(b), 0, 'Relic Blade is faster than Cloudfluff: it acts first, so it is not Foresight');
  turn(b, 'relic_blade_edge', 't_quick_strike');
  assert.equal(intent(b), 1, 'counter after the opponent lands a priority hit');
});

test('Foresight (2): accumulates only 1 stack per turn (the 3 hits of Swallow Reversal still count once); Sword Intent maxes out at 3 stacks', () => {
  const b = duel(blade(['relic_swallow']), foe(['t_quick_strike']));
  sturdy(b);
  sturdy(b, 0);
  const ev = turn(b, 'relic_swallow', 't_quick_strike');
  assert.equal(hitsOf(ev, 0, 'relic_swallow').length, 3, 'attacked first: 3 hits');
  assert.equal(intent(b), 1);
  b.active(0).vars['e:rb:intent'] = 3;
  turn(b, 'relic_swallow', 't_quick_strike');
  assert.equal(intent(b), 3);
});

test('Swallow Reversal: hits 2 times when it was not attacked first', () => {
  const b = duel(blade(['relic_swallow']), foe(['t_wait']));
  sturdy(b);
  assert.equal(hitsOf(turn(b, 'relic_swallow', 't_wait'), 0, 'relic_swallow').length, 2);
});

test('Sword Intent: +15% physical skill crit rate per stack (magic skills get none); resets to zero on leaving', () => {
  const b = duel(blade(['t_wait'], [{ id: 'monolith', skills: ['t_wait'] }]), foe(['t_wait']));
  const crit = KIT.relic_blade.critBonus!;
  b.active(0).vars['e:rb:intent'] = 2;
  const sk = { id: 't_strike' } as never;
  assert.ok(near(crit(b, { attacker: 0, defender: 1, sk, cat: 'physical' }), 0.3, 1e-9));
  assert.equal(crit(b, { attacker: 0, defender: 1, sk, cat: 'magic' }), 0);
  turn(b, sw(1), 't_wait');
  turn(b, sw(0), 't_wait');
  assert.equal(intent(b), 0);
});

test('Iaido: power +70 (75 → 145) when attacked first this turn, and triggers Foresight', () => {
  const plain = duel(blade(['iaido']), foe(['t_wait']));
  sturdy(plain);
  calm(plain);
  const base = dmgOf(turn(plain, 'iaido', 't_wait'), 0, 'iaido');
  const b = duel(blade(['iaido']), foe(['t_strike']));
  sturdy(b);
  sturdy(b, 0);
  calm(b);
  const got = dmgOf(turn(b, 'iaido', 't_strike'), 0, 'iaido');
  assert.ok(near(got / base, 145 / 75), `${got} / ${base}`);
  assert.equal(intent(b), 1);
});

test('Relic Edge: power +20 when attacked first this turn', () => {
  const plain = duel(blade(['relic_blade_edge']), foe(['t_wait']));
  sturdy(plain);
  calm(plain);
  const base = dmgOf(turn(plain, 'relic_blade_edge', 't_wait'), 0, 'relic_blade_edge');
  const b = duel(blade(['relic_blade_edge']), foe(['t_quick_strike']));
  sturdy(b);
  sturdy(b, 0);
  calm(b);
  const got = dmgOf(turn(b, 'relic_blade_edge', 't_quick_strike'), 0, 'relic_blade_edge');
  assert.ok(near(got / base, 75 / 55), `${got} / ${base}`);
});

test('Moonlit Drill: Attack +1 stage and gains 1 stack of Sword Intent', () => {
  const b = duel(blade(['relic_moon_drill']), foe(['t_wait']));
  turn(b, 'relic_moon_drill', 't_wait');
  assert.equal(b.active(0).stages.atk, 1);
  assert.equal(intent(b), 1);
});

test('Stance Breaker: dispels boosts; power +50 if the opponent used a status skill first this turn', () => {
  const plain = duel(blade(['relic_break_stance']), foe(['t_strike']));
  sturdy(plain);
  sturdy(plain, 0);
  calm(plain);
  const base = dmgOf(turn(plain, 'relic_break_stance', 't_strike'), 0, 'relic_break_stance');
  const b = duel(blade(['relic_break_stance']), foe(['t_war_cry']));
  sturdy(b);
  calm(b);
  const got = dmgOf(turn(b, 'relic_break_stance', 't_war_cry'), 0, 'relic_break_stance');
  assert.ok(near(got / base, 110 / 60), `${got} / ${base}`);
  assert.equal(b.active(1).stages.atk, 0, 'priority −1: the opponent boosts first, then gets dispelled');
});

test('Guardbreaker: pierces Guard; power +40 and gains 1 stack of Sword Intent when it breaks a guard', () => {
  const plain = duel(blade(['relic_guardbreak']), foe(['t_wait']));
  sturdy(plain);
  calm(plain);
  const base = dmgOf(turn(plain, 'relic_guardbreak', 't_wait'), 0, 'relic_guardbreak');
  assert.equal(intent(plain), 0);
  const b = duel(blade(['relic_guardbreak']), foe(['t_wait']));
  sturdy(b);
  calm(b);
  const got = dmgOf(turn(b, 'relic_guardbreak', guard()), 0, 'relic_guardbreak');
  assert.ok(near(got / base, 120 / 80), `${got} / ${base}`);
  assert.equal(intent(b), 1);
});

test('The First Cut: spends all Sword Intent, power +50 per stack', () => {
  const plain = duel(blade(['relic_first_cut']), foe(['t_wait']));
  sturdy(plain);
  calm(plain);
  const base = dmgOf(turn(plain, 'relic_first_cut', 't_wait'), 0, 'relic_first_cut');
  const b = duel(blade(['relic_first_cut']), foe(['t_wait']));
  sturdy(b);
  calm(b);
  b.active(0).vars['e:rb:intent'] = 2;
  const got = dmgOf(turn(b, 'relic_first_cut', 't_wait'), 0, 'relic_first_cut');
  assert.ok(near(got / base, 180 / 80), `${got} / ${base}`);
  assert.equal(intent(b), 0);
});

test('The First Cut: Sword Intent is spent even when guarded (the answer for opponents); when it hits after moving second, it spends the stacks and then triggers Foresight, leaving 1 stack', () => {
  const b = duel(blade(['relic_first_cut']), foe(['t_wait', 't_quick_strike']));
  sturdy(b);
  sturdy(b, 0);
  b.active(0).vars['e:rb:intent'] = 3;
  const ev = turn(b, 'relic_first_cut', guard());
  assert.equal(hitsOf(ev, 0, 'relic_first_cut').length, 0, 'guarded');
  assert.equal(intent(b), 0);
  b.active(0).vars['e:rb:intent'] = 2;
  turn(b, 'relic_first_cut', 't_quick_strike');
  assert.equal(intent(b), 1);
});

test('Silver Oath Thrust: always crits at 3 stacks of Sword Intent', () => {
  const b = duel(blade(['relic_oath_thrust']), foe(['t_wait']));
  sturdy(b);
  calm(b);
  assert.equal(hitsOf(turn(b, 'relic_oath_thrust', 't_wait'), 0, 'relic_oath_thrust')[0].crit, false);
  b.active(0).vars['e:rb:intent'] = 3;
  assert.equal(hitsOf(turn(b, 'relic_oath_thrust', 't_wait'), 0, 'relic_oath_thrust')[0].crit, true);
});

test('Zanshin: damage −30% when hit by an attack of the opponent, then counters with Relic Edge after the attack resolves (the counter counts as Foresight)', () => {
  const plain = duel(blade(['t_wait']), foe(['t_strike']));
  sturdy(plain, 0);
  calm(plain);
  const raw = dealt(turn(plain, 't_wait', 't_strike'), 1);
  const b = duel(blade(['t_wait', 'relic_zanshin']), foe(['t_strike']));
  sturdy(b);
  sturdy(b, 0);
  calm(b);
  turn(b, use('t_wait', 'relic_zanshin'), 't_wait');
  const ev = turn(b, 't_wait', 't_strike');
  assert.ok(ev.some((e) => e.k === 'trap' && e.side === 0));
  assert.ok(near(dealt(ev, 1) / raw, 0.7, 0.03), `${dealt(ev, 1)} / ${raw}`);
  assert.equal(hitsOf(ev, 0, 'relic_blade_edge').length, 1, 'counter');
  assert.equal(intent(b), 1);
});

test('Sword Domain: for 3 turns, counters with Relic Edge (×0.6) after each hit taken; a counter never triggers another counter', () => {
  const b = duel(blade(['relic_sword_domain', 't_wait']), [{ id: 'relic_blade', skills: ['relic_sword_domain', 't_strike'] }]);
  registerKitHooks('relic_blade', null);
  try {
    sturdy(b);
    sturdy(b, 0);
    // Both sides open `relic_sword_domain`: counters against each other do not loop forever
    turn(b, 'relic_sword_domain', 'relic_sword_domain');
    const ev = turn(b, 't_wait', 't_strike');
    assert.equal(hitsOf(ev, 0, 'relic_blade_edge').length, 1, 'hit taken → one counter');
    assert.equal(hitsOf(ev, 1, 'relic_blade_edge').length, 0, 'a counter does not trigger a counter from Sword Domain of the opponent');
    assert.equal(b.getLasting(0, 'relic_sword_domain')?.turns, 1, 'the turn it is set up counts as 1 turn');
  } finally {
    registerKitHooks('relic_blade', KIT.relic_blade);
  }
});

test('Millennial Flash: pierces Guard; spends all Sword Intent, power +40 per stack', () => {
  const plain = duel(blade(['t_wait']), foe(['t_wait']));
  sturdy(plain);
  calm(plain);
  const base = dmgOf(turn(plain, 'u_relic_blade', 't_wait'), 0, 'u_relic_blade');
  const b = duel(blade(['t_wait']), foe(['t_wait']));
  sturdy(b);
  calm(b);
  b.active(0).vars['e:rb:intent'] = 3;
  const got = dmgOf(turn(b, 'u_relic_blade', guard()), 0, 'u_relic_blade');
  assert.ok(near(got / base, 300 / 180), `${got} / ${base}`);
  assert.equal(intent(b), 0);
});

test('Relic Blade AI: prefers guarding when the opponent has an attack available', () => {
  const b = duel(blade(['t_wait']), foe(['t_strike']));
  assert.ok(KIT.relic_blade.aiGuard!(b, 0, 40) > 0);
  const c = duel(blade(['t_wait']), foe(['t_wait']));
  assert.ok(KIT.relic_blade.aiGuard!(c, 0, 40) < 0);
});

// ═════════════════════════ `grimoire`: Copybook ═════════════════════════

const book = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'grimoire', skills }, ...extra];
const pages = (b: Battle, id: SideId = 0) =>
  ['gm:p0', 'gm:p1', 'gm:p2'].map((k) => b.active(id).vars[k]).filter((h) => h !== undefined).length;
const pageNames = (b: Battle) => marks(b).filter((m) => m.id.startsWith('kit:page')).map((m) => m.note?.replace(/^.*：/, ''));
/** Makes the opponent use these skills in order (`grimoire` waits); note the opponent's `t_wait` is also a status skill, so it is copied too */
const fill = (b: Battle, list: string[]) => {
  for (const s of list) turn(b, 't_wait', s);
};
/** Sets the copybook directly (newest first); the same FNV hash as neutral.ts */
const fnv = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const seed = (b: Battle, list: string[]) => {
  ['gm:p0', 'gm:p1', 'gm:p2'].forEach((k, i) => {
    if (list[i]) b.active(0).vars[k] = fnv(list[i]);
    else delete b.active(0).vars[k];
  });
};

test('Copybook: attacks and status skills of the opponent are copied as the newest page; a repeat moves to newest; at most 3 pages, the oldest is pushed out', () => {
  const b = duel(book(['t_wait']), foe(['t_strike', 't_bolt', 't_war_cry', 't_heal']));
  sturdy(b, 0);
  fill(b, ['t_strike', 't_war_cry']);
  assert.deepEqual(pageNames(b), ['t_war_cry', 't_strike']);
  fill(b, ['t_strike']);
  assert.deepEqual(pageNames(b), ['t_strike', 't_war_cry'], 'a copied skill moves to newest');
  fill(b, ['t_bolt', 't_heal']);
  assert.deepEqual(pageNames(b), ['t_heal', 't_bolt', 't_strike'], 'when full the oldest is pushed out');
});

test('Copybook: an attack that was guarded is copied at the end of the turn; ultimates are not copied', () => {
  const b = duel(book(['t_wait']), foe(['t_strike']));
  sturdy(b, 0);
  turn(b, guard(), 't_strike');
  assert.deepEqual(pageNames(b), ['t_strike']);
  turn(b, 't_wait', 't_ult');
  assert.deepEqual(pageNames(b), ['t_strike']);
});

test('Chronicle: on entering, copies the skill the opponent used last; the Copybook is kept on leaving', () => {
  const b = duel([{ id: 'monolith', skills: ['t_wait'] }, { id: 'grimoire', skills: ['t_wait'] }], foe(['t_strike', 't_bolt']));
  sturdy(b, 0);
  turn(b, 't_wait', 't_bolt');
  // The opponent's guard (a system action) is not copied
  const ev = turn(b, sw(1), guard());
  assert.ok(ev.some((e) => e.k === 'trait' && e.name === '記述'));
  assert.deepEqual(pageNames(b), ['t_bolt']);
  turn(b, sw(0), 't_bolt');
  turn(b, sw(1), 't_bolt');
  assert.equal(b.side(0).team[1].vars['gm:p0'] !== undefined, true, 'kept on leaving');
});

test('Transcribe: casts the newest page (×0.8, physical skills are computed with Magic Power); the cost becomes that of the skill (at least 1)', () => {
  const b = duel(book(['transcribe', 't_strike']), foe(['t_strike', 't_blast']));
  sturdy(b);
  sturdy(b, 0);
  calm(b);
  assert.equal(b.canUse(0, 'transcribe').ok, false, 'the Copybook is empty');
  const direct = dmgOf(turn(b, 't_strike', 't_wait'), 0, 't_strike');
  fill(b, ['t_strike']);
  assert.equal(b.costFor(0, getSkill('transcribe')), 1);
  const ev = turn(b, 'transcribe', 't_wait');
  const got = dmgOf(ev, 0, 't_strike');
  const c = b.active(0);
  const want = 0.8 * (b.effStat(c, 'mag', 0) / b.effStat(c, 'atk', 0));
  assert.ok(near(got / direct, want, 0.05), `${got} / ${direct} vs ${want}`);
  fill(b, ['t_blast']);
  assert.equal(b.costFor(0, getSkill('transcribe')), 2);
});

test('Page Flare: tears off the oldest page, power +40', () => {
  const b = duel(book(['grimoire_page_flare']), foe(['t_strike', 't_bolt']));
  sturdy(b);
  sturdy(b, 0);
  calm(b);
  seed(b, []);
  const base = dmgOf(turn(b, 'grimoire_page_flare', 't_wait'), 0, 'grimoire_page_flare');
  seed(b, ['t_bolt', 't_strike']);
  const got = dmgOf(turn(b, 'grimoire_page_flare', 't_wait'), 0, 'grimoire_page_flare');
  assert.ok(near(got / base, 100 / 60), `${got} / ${base}`);
  // The oldest page (`t_strike`) is torn off; afterwards the opponent's `t_wait` is copied as a new page
  assert.deepEqual(pageNames(b), ['t_wait', 't_bolt']);
});

test('Bookburning: tears off all pages, power +50 per page', () => {
  const b = duel(book(['grimoire_burn_all']), foe(['t_strike', 't_bolt', 't_war_cry']));
  sturdy(b);
  sturdy(b, 0);
  calm(b);
  seed(b, []);
  const base = dmgOf(turn(b, 'grimoire_burn_all', 't_wait'), 0, 'grimoire_burn_all');
  seed(b, ['t_war_cry', 't_bolt', 't_strike']);
  const got = dmgOf(turn(b, 'grimoire_burn_all', 't_wait'), 0, 'grimoire_burn_all');
  assert.ok(near(got / base, 220 / 70), `${got} / ${base}`);
  assert.deepEqual(pageNames(b), ['t_wait'], 'all pages torn off; afterwards only the "Wait" of the opponent this turn remains');
  seed(b, ['t_bolt', 't_strike']);
  turn(b, 'grimoire_burn_all', guard());
  assert.equal(pages(b), 0, 'torn off even when guarded');
});

test('Page Storm: hit count = pages + 1 (max 4 hits)', () => {
  const b = duel(book(['grimoire_page_storm']), foe(['t_strike', 't_bolt', 't_war_cry']));
  sturdy(b);
  sturdy(b, 0);
  seed(b, []);
  assert.equal(hitsOf(turn(b, 'grimoire_page_storm', 't_wait'), 0, 'grimoire_page_storm').length, 1);
  seed(b, ['t_war_cry', 't_bolt', 't_strike']);
  assert.equal(hitsOf(turn(b, 'grimoire_page_storm', 't_wait'), 0, 'grimoire_page_storm').length, 4);
});

test('Page Ward: for 3 turns, skills in the Copybook deal −50% damage; other skills as usual', () => {
  const plain = duel(book(['t_wait']), foe(['t_strike', 't_bolt']));
  sturdy(plain, 0);
  calm(plain);
  const strike = dealt(turn(plain, 't_wait', 't_strike'), 1);
  const bolt = dealt(turn(plain, 't_wait', 't_bolt'), 1);
  const b = duel(book(['grimoire_page_ward', 't_wait']), foe(['t_strike', 't_bolt']));
  sturdy(b, 0);
  calm(b);
  seed(b, ['t_strike']);
  // In effect from the turn it is cast (`grimoire` is faster), 3 turns in total
  assert.ok(near(dealt(turn(b, 'grimoire_page_ward', 't_strike'), 1) / strike, 0.5, 0.03), 'Strike is in the Copybook: halved');
  assert.ok(near(dealt(turn(b, 't_wait', 't_bolt'), 1) / bolt, 1, 0.03), 'Arcane Bolt is not in the Copybook: normal (it is copied only after landing)');
  assert.ok(near(dealt(turn(b, 't_wait', 't_bolt'), 1) / bolt, 0.5, 0.03), 'after it is copied: halved');
});

test('Mirror Page: negates an attack from the Copybook used by the opponent and counters with the same skill (×0.8)', () => {
  const b = duel(book(['t_wait', 'grimoire_mirror_page']), foe(['t_bolt', 't_strike']));
  sturdy(b);
  sturdy(b, 0);
  seed(b, ['t_bolt']);
  turn(b, use('t_wait', 'grimoire_mirror_page'), 't_heal');
  const miss = turn(b, 't_wait', 't_strike');
  assert.ok(!miss.some((e) => e.k === 'trap' && e.side === 0), 'Strike is not in the Copybook: does not fire');
  const ev = turn(b, 't_wait', 't_bolt');
  assert.ok(ev.some((e) => e.k === 'trap' && e.side === 0));
  assert.equal(dealt(ev, 1), 0, 'the attack is negated');
  assert.equal(hitsOf(ev, 0, 't_bolt').length, 1, 'returned as is');
});

test('Red Annotation: Magic Power +1 stage; the next Transcribe has power ×1.5 (gone once used)', () => {
  const b = duel(book(['grimoire_annotate', 'transcribe']), foe(['t_bolt']));
  sturdy(b);
  sturdy(b, 0);
  calm(b);
  // `cloudfluff` is slower: each turn `grimoire` transcribes first, and only afterwards is the opponent's bolt copied as a new page
  turn(b, 'grimoire_annotate', 't_bolt');
  assert.equal(b.active(0).stages.mag, 1);
  const boosted = dmgOf(turn(b, 'transcribe', 't_bolt'), 0, 't_bolt');
  const plain = dmgOf(turn(b, 'transcribe', 't_bolt'), 0, 't_bolt');
  assert.ok(near(boosted / plain, 1.5), `${boosted} / ${plain}`);
});

test('Final Chapter: casts the strongest attack page; cost at least 2; ×1.3 when the Copybook holds 3 pages', () => {
  const b = duel(book(['grimoire_final_chapter', 't_blast']), foe(['t_bolt', 't_blast', 't_war_cry']));
  sturdy(b);
  sturdy(b, 0);
  calm(b);
  const direct = dmgOf(turn(b, 't_blast', 't_wait'), 0, 't_blast');
  seed(b, ['t_bolt', 't_blast']);
  assert.equal(b.costFor(0, getSkill('grimoire_final_chapter')), 2);
  const two = dmgOf(turn(b, 'grimoire_final_chapter', 't_wait'), 0, 't_blast');
  assert.ok(near(two / direct, 1), `${two} / ${direct}: the strongest is Arcane Blast, not the newest Arcane Bolt`);
  seed(b, ['t_war_cry', 't_bolt', 't_blast']);
  const three = dmgOf(turn(b, 'grimoire_final_chapter', 't_wait'), 0, 't_blast');
  assert.ok(near(three / direct, 1.3), `${three} / ${direct}`);
});

test('Codex of All Things: after a hit, casts the attack pages in the Copybook in order (×0.5)', () => {
  const b = duel(book(['t_wait']), foe(['t_bolt', 't_strike', 't_war_cry']));
  sturdy(b);
  sturdy(b, 0);
  seed(b, ['t_war_cry', 't_strike', 't_bolt']);
  const ev = turn(b, 'u_grimoire', 't_wait');
  assert.equal(hitsOf(ev, 0, 't_bolt').length, 1);
  assert.equal(hitsOf(ev, 0, 't_strike').length, 1);
  assert.deepEqual(pageNames(b), ['t_wait', 't_war_cry', 't_strike'], 'the ultimate does not use up pages (afterwards the Wait of the opponent pushes out the oldest page)');
});

// ═════════════════════════ `inkcat`: Ink Stains ═════════════════════════

const cat = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'inkcat', skills }, ...extra];
const st = (b: Battle, id: SideId = 0) => b.active(id).stages;
const stainMark = (b: Battle) => marks(b).find((m) => m.id === 'kit:stain');

test('Ink Splash: Defense −1 on itself after a hit (an ink stain); the mark shows the total stages of ink stains', () => {
  const b = duel(cat(['inkcat_splash']), foe(['t_wait']));
  sturdy(b);
  turn(b, 'inkcat_splash', 't_wait');
  assert.equal(st(b).def, -1);
  assert.equal(stainMark(b)?.n, 1);
});

test('Ink Dot: 0 cost, Speed −1 on itself after a hit', () => {
  const b = duel(cat(['inkcat_ink_dot']), foe(['t_wait']));
  sturdy(b);
  b.side(0).aether = 0;
  assert.equal(b.canUse(0, 'inkcat_ink_dot').ok, true);
  turn(b, 'inkcat_ink_dot', 't_wait');
  assert.equal(st(b).spd, -1);
});

test('Reverse Stroke: all ink stains flip into equal boosts; trait "Ink Resonance" gives +1 aether; cannot be used with no ink stains', () => {
  const b = duel(cat(['inkcat_reverse_stroke']), foe(['t_wait']));
  assert.equal(b.canUse(0, 'inkcat_reverse_stroke').ok, false);
  st(b).mag = -2;
  st(b).def = -1;
  st(b).atk = 1;
  b.side(0).aether = 5;
  const ev = b.resolveTurn([use('inkcat_reverse_stroke'), use('t_wait')]);
  assert.deepEqual([st(b).mag, st(b).def, st(b).atk], [2, 1, 1], 'boosts stay, only the drops flip');
  assert.ok(ev.some((e) => e.k === 'trait' && e.side === 0 && e.name === '墨韻'));
  assert.equal(b.side(0).aether, 5 - 1 + 1 + 2, '5 − 1 + Ink Resonance 1 + turn 2');
  assert.equal(stainMark(b), undefined);
});

test('Reverse Stroke: no boosts while cursed, so the ink stains do not flip and Ink Resonance does not trigger', () => {
  const b = duel(cat(['inkcat_reverse_stroke']), foe(['t_wait']));
  st(b).mag = -2;
  b.active(0).status.curse = { turns: 3 } as never;
  const ev = turn(b, 'inkcat_reverse_stroke', 't_wait');
  assert.equal(st(b).mag, -2);
  assert.ok(!ev.some((e) => e.k === 'trait' && e.name === '墨韻'));
});

test('Fling Ink: the ink stains of the user reset to zero, and the same stat of the opponent drops by as many stages', () => {
  const b = duel(cat(['inkcat_fling']), foe(['t_wait']));
  st(b).mag = -2;
  st(b).spd = -1;
  st(b).def = 1;
  turn(b, 'inkcat_fling', 't_wait');
  assert.deepEqual([st(b).mag, st(b).spd, st(b).def], [0, 0, 1]);
  assert.deepEqual([st(b, 1).mag, st(b, 1).spd, st(b, 1).def], [-2, -1, 0]);
});

test('Ink Rewrite: flips only the stat boosts of the opponent (drops unchanged), the user gets Magic Power +1', () => {
  const b = duel(cat(['ink_rewrite']), foe(['t_wait']));
  st(b, 1).atk = 2;
  st(b, 1).spd = -1;
  turn(b, 'ink_rewrite', 't_wait');
  assert.deepEqual([st(b, 1).atk, st(b, 1).spd], [-2, -1]);
  assert.equal(st(b).mag, 1);
});

test('Thick Ink: after a hit the user gets Magic Power −1 and the opponent Resistance −1', () => {
  const b = duel(cat(['inkcat_thick_ink']), foe(['t_wait']));
  sturdy(b);
  turn(b, 'inkcat_thick_ink', 't_wait');
  assert.equal(st(b).mag, -1);
  assert.equal(st(b, 1).res, -1);
});

test('Ink Rain: Speed −2 on itself after a hit (2 stages of ink stain at once)', () => {
  const b = duel(cat(['t_wait']), foe(['t_wait']));
  sturdy(b);
  turn(b, 'inkcat_ink_rain', 't_wait');
  assert.deepEqual([st(b).mag, st(b).spd], [0, -2]);
  assert.equal(stainMark(b)?.n, 2);
});

test('Dotting the Eye: flips the ink stains when it acts, and this attack is computed with the flipped Magic Power', () => {
  const clean = duel(cat(['inkcat_dragon_eye']), foe(['t_wait']));
  sturdy(clean);
  calm(clean);
  st(clean).mag = 2;
  const want = dmgOf(turn(clean, 'inkcat_dragon_eye', 't_wait'), 0, 'inkcat_dragon_eye');
  const b = duel(cat(['inkcat_dragon_eye']), foe(['t_wait']));
  sturdy(b);
  calm(b);
  st(b).mag = -2;
  const ev = turn(b, 'inkcat_dragon_eye', 't_wait');
  const got = dmgOf(ev, 0, 'inkcat_dragon_eye');
  assert.ok(near(got / want, 1, 0.02), `${got} vs ${want}`);
  assert.equal(st(b).mag, 2);
  assert.ok(ev.some((e) => e.k === 'trait' && e.name === '墨韻'));
});

test('Dotting the Eye: flips even when guarded (when it acts)', () => {
  const b = duel(cat(['inkcat_dragon_eye']), foe(['t_wait']));
  sturdy(b);
  st(b).def = -1;
  turn(b, 'inkcat_dragon_eye', guard());
  assert.equal(st(b).def, 1);
});

test('Ink Pool: fires when the opponent boosts, and flips the boosts of the opponent at the end of the turn', () => {
  const b = duel(cat(['t_wait', 'inkcat_ink_pool']), foe(['t_war_cry', 't_wait']));
  turn(b, use('t_wait', 'inkcat_ink_pool'), 't_wait');
  const ev = turn(b, 't_wait', 't_war_cry');
  assert.ok(ev.some((e) => e.k === 'trap' && e.side === 0));
  assert.equal(st(b, 1).atk, -2, '+2 flips to −2');
});

test('Ink Pool: when it fires with Scroll Cat already off the field, it flips right away', () => {
  const b = duel(cat(['t_wait', 'inkcat_ink_pool'], [{ id: 'monolith', skills: ['t_wait'] }]), foe(['t_war_cry', 't_wait']));
  turn(b, use('t_wait', 'inkcat_ink_pool'), 't_wait');
  turn(b, sw(1), 't_wait');
  turn(b, 't_wait', 't_war_cry');
  assert.equal(st(b, 1).atk, -2);
});

test('Reversed Scroll: flips its own ink stains and flips the stat boosts of the opponent', () => {
  const b = duel(cat(['inkcat_scroll_reversal']), foe(['t_wait']));
  assert.equal(b.canUse(0, 'inkcat_scroll_reversal').ok, false, 'neither side has anything to flip');
  st(b).mag = -1;
  st(b, 1).atk = 2;
  st(b, 1).def = -1;
  turn(b, 'inkcat_scroll_reversal', 't_wait');
  assert.equal(st(b).mag, 1);
  assert.deepEqual([st(b, 1).atk, st(b, 1).def], [-2, -1]);
});

test('Scroll of All Things: after a hit, flings the ink stains onto the opponent', () => {
  const b = duel(cat(['t_wait']), foe(['t_wait']));
  sturdy(b);
  st(b).mag = -1;
  st(b).def = -2;
  turn(b, 'u_inkcat', 't_wait');
  assert.deepEqual([st(b).mag, st(b).def], [0, 0]);
  assert.deepEqual([st(b, 1).mag, st(b, 1).def], [-1, -2]);
});

// ═════════════════════════ `cloudfluff`: Fluff ═════════════════════════
// At the top of the file the kit hooks of `cloudfluff` and `clockmouse` are turned off (they are opponents in other tests); the tests here turn them on temporarily.

const withKit = (id: 'cloudfluff' | 'clockmouse', fn: () => void) => () => {
  registerKitHooks(id, KIT[id]);
  try {
    fn();
  } finally {
    registerKitHooks(id, null);
  }
};
const fluff = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'cloudfluff', skills }, ...extra];
const rock = (skills = ['t_wait'], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'monolith', skills }, ...extra];
const fluffOf = (b: Battle, id: SideId = 0) => b.active(id).vars['e:cf:fluff'] ?? 0;

test(
  'Hum: 0 cost, Fluff +1, aether +1; Fluff maxes out at 3 stacks, the mark shows the stack count',
  withKit('cloudfluff', () => {
    const b = duel(fluff(['cloudfluff_hum']), rock());
    b.side(0).aether = 0;
    assert.equal(b.canUse(0, 'cloudfluff_hum').ok, true);
    b.resolveTurn([use('cloudfluff_hum'), use('t_wait')]);
    assert.equal(fluffOf(b), 1);
    assert.equal(b.side(0).aether, 0 + 1 + 2, 'Hum 1 + turn 2');
    assert.ok(marks(b).some((m) => m.id === 'kit:fluff' && m.n === 1));
    for (let i = 0; i < 3; i++) turn(b, 'cloudfluff_hum', 't_wait');
    assert.equal(fluffOf(b), 3);
  }),
);

test(
  'Tutorial: the gentle Lv5 kit of Cloudfluff (a 0-cost attack plus a harmless status skill) is Strike and Hum',
  withKit('cloudfluff', () => {
    // The same filter as gentleLoadout in src/ui/flows.ts
    const picks = learnedSkills(getSpirit('cloudfluff'), 5).filter((id) => {
      const sk = getSkill(id);
      const t = sk.tags as Record<string, number>;
      if (isAttack(sk)) return sk.category !== 'ultimate' && skillCost(sk) === 0;
      return sk.category === 'status' && !Object.keys(t).some((k) => k.startsWith('status.') || ['trueDamage', 'heal', 'teamHeal', 'regen', 'drain'].includes(k));
    });
    assert.deepEqual(picks, ['strike', 'cloudfluff_hum']);
  }),
);

test(
  'Puff Up: Defense +1, Resistance +1, Fluff +1',
  withKit('cloudfluff', () => {
    const b = duel(fluff(['cloudfluff_puff_up']), rock());
    turn(b, 'cloudfluff_puff_up', 't_wait');
    assert.deepEqual([st(b).def, st(b).res], [1, 1]);
    assert.equal(fluffOf(b), 1);
  }),
);

test(
  'Puffball (+35 per stack) / Giant Puffball (+30 per stack): spend all Fluff',
  withKit('cloudfluff', () => {
    for (const [sk, base, per] of [
      ['cloudfluff_puffball', 60, 35],
      ['cloudfluff_big_puffball', 90, 30],
    ] as const) {
      const plain = duel(fluff([sk]), rock());
      sturdy(plain);
      calm(plain);
      plain.side(0).aether = 5;
      const want = dmgOf(turn(plain, sk, 't_wait'), 0, sk);
      const b = duel(fluff([sk]), rock());
      sturdy(b);
      calm(b);
      b.side(0).aether = 5;
      b.active(0).vars['e:cf:fluff'] = 2;
      const got = dmgOf(turn(b, sk, 't_wait'), 0, sk);
      assert.ok(near(got / want, (base + 2 * per) / base, 0.08), `${sk}: ${got} vs ${want}`);
      assert.equal(fluffOf(b), 0, 'Fluff is used up');
    }
  }),
);

test(
  'Fluffy Pounce: 0 cost, Fluff +1 after a hit',
  withKit('cloudfluff', () => {
    const b = duel(fluff(['cloudfluff_fluff_pounce']), rock());
    sturdy(b);
    b.side(0).aether = 0;
    assert.equal(b.canUse(0, 'cloudfluff_fluff_pounce').ok, true);
    turn(b, 'cloudfluff_fluff_pounce', 't_wait');
    assert.equal(fluffOf(b), 1);
  }),
);

test(
  'Soft Cushion: damage −30% when hit by an attack of the opponent, Fluff +1',
  withKit('cloudfluff', () => {
    const plain = duel(fluff(['t_wait', 'cloudfluff_cushion']), rock(['t_strike']));
    calm(plain);
    const want = dmgOf(turn(plain, 't_wait', 't_strike'), 1, 't_strike');
    const b = duel(fluff(['t_wait', 'cloudfluff_cushion']), rock(['t_strike', 't_wait']));
    calm(b);
    turn(b, use('t_wait', 'cloudfluff_cushion'), 't_wait');
    const ev = turn(b, 't_wait', 't_strike');
    assert.ok(ev.some((e) => e.k === 'trap' && e.side === 0));
    const got = dmgOf(ev, 1, 't_strike');
    assert.ok(near(got / want, 0.7, 0.05), `${got} vs ${want}`);
    assert.equal(fluffOf(b), 1);
  }),
);

test(
  'Cloud Nap: heals 25%, Fluff goes straight to 3 stacks',
  withKit('cloudfluff', () => {
    const b = duel(fluff(['cloudfluff_cloud_nap']), rock());
    const c = b.active(0);
    c.hp = Math.floor(c.maxHp / 2);
    const hp = c.hp;
    turn(b, 'cloudfluff_cloud_nap', 't_wait');
    assert.equal(c.hp - hp, Math.floor(c.maxHp / 4));
    assert.equal(fluffOf(b), 3);
  }),
);

test(
  'Fluff Shield: 25% shield, Fluff +1',
  withKit('cloudfluff', () => {
    const b = duel(fluff(['cloudfluff_fluff_shield']), rock());
    turn(b, 'cloudfluff_fluff_shield', 't_wait');
    assert.ok((b.active(0).shield?.amount ?? 0) > 0);
    assert.equal(fluffOf(b), 1);
  }),
);

test(
  'Roll Away and Warm Fluff: switches in a teammate after the attack; at the end of the turn the teammate gains a shield of 10% + 5% per Fluff stack (that turn only)',
  withKit('cloudfluff', () => {
    const b = duel(fluff(['cloudfluff_roll_away'], [{ id: 'monolith', skills: ['t_wait'] }]), rock());
    sturdy(b);
    const ally = b.side(0).team[1];
    b.active(0).vars['e:cf:fluff'] = 2;
    const ev = turn(b, 'cloudfluff_roll_away', 't_wait');
    assert.equal(b.side(0).active, 1);
    assert.ok(ev.some((e) => e.k === 'trait' && e.side === 0 && e.name === '暖絨'));
    assert.equal(ally.shield?.amount, Math.floor((ally.maxHp * 20) / 100));
    ally.shield = null;
    turn(b, 't_wait', 't_wait');
    assert.equal(ally.shield, null, 'does not trigger again next turn');
  }),
);

test(
  'Warm Fluff: also triggers on a voluntary switch (10% with no Fluff); does not trigger if Cloudfluff did not leave the field; Fluff is used up on leaving',
  withKit('cloudfluff', () => {
    const b = duel(fluff(['t_wait'], [{ id: 'monolith', skills: ['t_wait'] }]), rock());
    const ally = b.side(0).team[1];
    let ev = turn(b, 't_wait', 't_wait');
    assert.ok(!ev.some((e) => e.k === 'trait' && e.name === '暖絨'));
    ev = turn(b, sw(1), 't_wait');
    assert.ok(ev.some((e) => e.k === 'trait' && e.name === '暖絨'));
    assert.equal(ally.shield?.amount, Math.floor(ally.maxHp / 10));
    assert.equal(b.side(0).team[0].vars['e:cf:fluff'] ?? 0, 0);
  }),
);

test(
  'Cloud Chorus: after a hit, the whole team of our side (bench included) heals 15%',
  withKit('cloudfluff', () => {
    const b = duel(fluff(['t_wait'], [{ id: 'monolith', skills: ['t_wait'] }]), rock());
    sturdy(b);
    const [me, ally] = b.side(0).team;
    me.hp = Math.floor(me.maxHp / 2);
    ally.hp = Math.floor(ally.maxHp / 2);
    const [h0, h1] = [me.hp, ally.hp];
    turn(b, 'u_cloudfluff', 't_wait');
    assert.ok(me.hp > h0 && ally.hp > h1);
  }),
);

// ═════════════════════════ `clockmouse`: Clockwork ═════════════════════════

const mouse = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'clockmouse', skills }, ...extra];
const spring = (b: Battle, id: SideId = 0) => b.active(id).vars['e:cm:spring'] ?? 0;
/** `clockmouse` is slower than the opponent: only priority lets it act first */
const slow = (b: Battle) => void (b.active(0).stats.spd = 1);

test(
  'Clockwork: fully wound to 3 coils on entering; cleared on leaving and wound full again on re-entering; the mark shows the coils',
  withKit('clockmouse', () => {
    const b = duel(mouse(['clockmouse_gear_bite', 't_wait'], [{ id: 'monolith', skills: ['t_wait'] }]), rock());
    sturdy(b);
    assert.equal(spring(b), 3);
    assert.ok(marks(b).some((m) => m.id === 'kit:spring' && m.n === 3 && m.note === '發條'));
    turn(b, 'clockmouse_gear_bite', 't_wait');
    assert.equal(spring(b), 2);
    turn(b, sw(1), 't_wait');
    assert.equal(b.side(0).team[0].vars['e:cm:spring'] ?? 0, 0);
    turn(b, sw(0), 't_wait');
    assert.equal(spring(b), 3);
  }),
);

test(
  'Release: priority +1 while wound, Clockwork −1 after acting; no more priority once stalled',
  withKit('clockmouse', () => {
    const b = duel(mouse(['clockmouse_gear_bite']), rock(['t_strike']));
    sturdy(b);
    b.active(0).maxHp = b.active(0).hp = 100000;
    slow(b);
    let ev = turn(b, 'clockmouse_gear_bite', 't_strike');
    assert.deepEqual(usedOrder(ev), [0, 1], 'priority');
    assert.equal(spring(b), 2);
    b.active(0).vars['e:cm:spring'] = 0;
    ev = turn(b, 'clockmouse_gear_bite', 't_strike');
    assert.deepEqual(usedOrder(ev), [1, 0], 'stalled: speed decides');
    assert.ok(marks(b).some((m) => m.id === 'kit:spring' && m.note === '停擺'));
  }),
);

test(
  'Windup Dash and Full Gear: also Release attacks',
  withKit('clockmouse', () => {
    for (const sk of ['windup_dash', 'clockmouse_full_gear']) {
      const b = duel(mouse([sk]), rock(['t_strike']));
      sturdy(b);
      b.active(0).maxHp = b.active(0).hp = 100000;
      slow(b);
      b.side(0).aether = 5;
      const ev = turn(b, sk, 't_strike');
      assert.deepEqual(usedOrder(ev), [0, 1], sk);
      assert.equal(spring(b), 2, sk);
    }
  }),
);

test(
  'Wind-Up (trait): Clockwork +1 at the end of a turn with no Release attack used (max 3 coils); no winding if one was used',
  withKit('clockmouse', () => {
    const b = duel(mouse(['clockmouse_gear_bite', 't_wait']), rock());
    sturdy(b);
    b.active(0).vars['e:cm:spring'] = 1;
    let ev = turn(b, 't_wait', 't_wait');
    assert.equal(spring(b), 2);
    assert.ok(ev.some((e) => e.k === 'trait' && e.side === 0 && e.name === '上發條'));
    turn(b, 'clockmouse_gear_bite', 't_wait');
    assert.equal(spring(b), 1, 'Release −1, no winding at the end of the turn');
    turn(b, 't_wait', 't_wait');
    turn(b, 't_wait', 't_wait');
    ev = turn(b, 't_wait', 't_wait');
    assert.equal(spring(b), 3);
    assert.ok(!ev.some((e) => e.k === 'trait' && e.name === '上發條'), 'no more winding when full');
  }),
);

test(
  'Rapid Release: hit count = coils + 1 (max 4 hits), Clockwork resets to zero after acting',
  withKit('clockmouse', () => {
    for (const [n, want] of [
      [3, 4],
      [1, 2],
      [0, 1],
    ]) {
      const b = duel(mouse(['clockmouse_chain_release']), rock());
      sturdy(b);
      b.side(0).aether = 5;
      b.active(0).vars['e:cm:spring'] = n;
      const ev = turn(b, 'clockmouse_chain_release', 't_wait');
      assert.equal(hitsOf(ev, 0, 'clockmouse_chain_release').length, want, `Clockwork ${n}`);
      assert.equal(spring(b), 0);
    }
  }),
);

test(
  'Rewind Gear: Clockwork +1 after a hit; it is not a Release attack, so Wind-Up still winds at the end of the turn (+2 in one turn)',
  withKit('clockmouse', () => {
    const b = duel(mouse(['clockmouse_rewind']), rock());
    sturdy(b);
    b.active(0).vars['e:cm:spring'] = 0;
    const ev = turn(b, 'clockmouse_rewind', 't_wait');
    assert.equal(spring(b), 2);
    assert.ok(ev.some((e) => e.k === 'trait' && e.name === '上發條'));
  }),
);

test(
  'Wind Up: 0 cost, fully winds the Clockwork; Mainspring: fully winds the Clockwork, Attack +1',
  withKit('clockmouse', () => {
    const b = duel(mouse(['clockmouse_wind_up', 'clockmouse_mainspring']), rock());
    b.active(0).vars['e:cm:spring'] = 0;
    b.side(0).aether = 0;
    assert.equal(b.canUse(0, 'clockmouse_wind_up').ok, true);
    turn(b, 'clockmouse_wind_up', 't_wait');
    assert.equal(spring(b), 3);
    b.active(0).vars['e:cm:spring'] = 0;
    turn(b, 'clockmouse_mainspring', 't_wait');
    assert.equal(spring(b), 3);
    assert.equal(st(b).atk, 1);
  }),
);

test(
  'Gear Jam: seals the last skill the opponent used',
  withKit('clockmouse', () => {
    const b = duel(mouse(['t_wait', 'clockmouse_gear_jam']), rock(['t_strike', 't_wait']));
    b.active(0).maxHp = b.active(0).hp = 100000;
    b.active(1).stats.spd = 1;
    turn(b, 't_wait', 't_strike');
    turn(b, 'clockmouse_gear_jam', 't_wait');
    assert.equal(b.active(1).disabled?.skill, 't_strike');
    assert.equal(b.canUse(1, 't_strike').ok, false);
  }),
);

test(
  'Mousetrap: when a spirit of the opponent enters, attacks with Gear Bite (×1.5); does not spend Clockwork',
  withKit('clockmouse', () => {
    const b = duel(mouse(['t_wait', 'clockmouse_mousetrap']), rock(['t_wait'], [{ id: 'monolith', skills: ['t_wait'] }]));
    turn(b, use('t_wait', 'clockmouse_mousetrap'), 't_wait');
    const ev = turn(b, 't_wait', sw(1));
    assert.ok(ev.some((e) => e.k === 'trap' && e.side === 0));
    assert.equal(hitsOf(ev, 0, 'clockmouse_gear_bite').length, 1);
    assert.equal(spring(b), 3);
  }),
);

test(
  'All Gears Turning: spends all Clockwork, power +20 per coil; priority while wound',
  withKit('clockmouse', () => {
    const plain = duel(mouse(['t_wait']), rock(['t_strike']));
    sturdy(plain);
    calm(plain);
    plain.active(0).maxHp = plain.active(0).hp = 100000;
    slow(plain);
    plain.active(0).vars['e:cm:spring'] = 0;
    const want = dmgOf(turn(plain, 'u_clockmouse', 't_strike'), 0, 'u_clockmouse');
    const b = duel(mouse(['t_wait']), rock(['t_strike']));
    sturdy(b);
    calm(b);
    b.active(0).maxHp = b.active(0).hp = 100000;
    slow(b);
    const ev = turn(b, 'u_clockmouse', 't_strike');
    assert.deepEqual(usedOrder(ev), [0, 1]);
    const got = dmgOf(ev, 0, 'u_clockmouse');
    assert.ok(near(got / want, 240 / 180, 0.08), `${got} vs ${want}`);
    assert.equal(spring(b), 0);
  }),
);
