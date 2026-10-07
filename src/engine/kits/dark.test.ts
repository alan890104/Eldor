// Mechanic tests for the dark group: `noxfang` (Hunt Mark / Hunt Kill), `voidchild` (Void Belly / Devour), `soul_lantern` (Netherlamp / Soulfire), `weaverspider` (Webstrands / Reweave),
// `eclipse_batlord` (Night Kiss / drain), `tombhound` (Burning Heads / Flame Maw), `abyssjelly` (Spirit Threads) and `maskfox` (Mask / Scapegoat).
// node --test src/engine/kits/dark.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duel, guard, sw, texts, traits, turn, use, useTestSkills, hitsBy } from '../testkit.ts';
import type { Battle } from '../battle.ts';
import { chooseAction } from '../ai.ts';
import type { BattleEvent } from '../types.ts';

useTestSkills();

const marks = (b: Battle) => b.active(1).vars['e:nox:mark'] ?? 0;
const belly = (b: Battle) => b.active(0).vars['vc:belly'] ?? 0;
const executed = (ev: BattleEvent[]) => ev.some((e) => e.k === 'damage' && e.reason === 'execute');
const used = (ev: BattleEvent[], side: 0 | 1, id: string) => ev.some((e) => e.k === 'use' && e.side === side && e.skillId === id);
/** The opponent does nothing when it uses this skill (t_wait is a status skill that does nothing) */
const WAIT = 't_wait';

// ═════════════════════════ `noxfang` ═════════════════════════

const nox = (skills: string[], foe = 'soul_lantern', foeSkills = [WAIT, 't_strike', 't_war_cry', 't_heal']) =>
  duel([{ id: 'noxfang', skills }, { id: 'noxfang', skills: ['noxfang_shadow_fang'] }], [{ id: foe, skills: foeSkills }, { id: foe, skills: foeSkills }]);

test('Night Hunter (Noxfang): entering sets Eternal Night for 3 turns (rewritten trait)', () => {
  const b = nox(['noxfang_shadow_fang']);
  assert.deepEqual(b.s.field, { element: 'dark', turns: 3 });
});

test('Shadow Fang (Noxfang): a hit leaves 1 Hunt Mark; the mark row shows the execute line (Eternal Night +10%)', () => {
  const b = nox(['noxfang_shadow_fang']);
  turn(b, 'noxfang_shadow_fang', WAIT);
  assert.equal(marks(b), 1);
  const m = b.view().sides[0].team[0].marks.find((x) => x.id === 'kit:hunt');
  assert.equal(m?.n, 1);
  assert.match(m?.note ?? '', /斬殺線 16%/);
});

test('Hunt Kill (Noxfang): after a hit the opponent faints at once if its HP ≤ the execute line; without Eternal Night only the Hunt Marks count', () => {
  const b = nox(['noxfang_shadow_fang']);
  const d = b.active(1);
  d.vars['e:nox:mark'] = 2; // 3 stacks after the hit: 18% + Eternal Night 10% = 28%
  d.hp = Math.floor(b.estimate(0, 'noxfang_shadow_fang') + d.maxHp * 0.2);
  const ev = turn(b, 'noxfang_shadow_fang', WAIT);
  assert.ok(executed(ev), 'Shadow Fang leaves it below the execute line → Hunt Kill');
  assert.ok(b.active(1).fainted);

  const c = nox(['noxfang_shadow_fang']);
  c.s.field = null;
  c.active(1).vars['e:nox:mark'] = 1; // No Eternal Night: 6% + 1 stack after the hit = 12%
  c.active(1).hp = Math.floor(c.active(1).maxHp * 0.3);
  const ev2 = turn(c, 'noxfang_shadow_fang', WAIT);
  const left = c.active(1).hp / c.active(1).maxHp;
  assert.equal(executed(ev2), left <= 0.12 && left > 0, 'Hunt Kill only when it drops to 12% or below');
  assert.ok(!executed(ev2) || c.active(1).fainted);
});

test('Hunt Mark (Noxfang): disappears when the opponent switches out; also disappears when Noxfang leaves', () => {
  const b = nox(['noxfang_shadow_fang', 'noxfang_throat_rend']);
  turn(b, 'noxfang_throat_rend', WAIT);
  assert.equal(marks(b), 2);
  turn(b, 'noxfang_shadow_fang', sw(1));
  assert.equal(b.side(1).active, 1);
  const first = b.side(1).team[0];
  assert.equal(first.vars['e:nox:mark'], undefined, 'the departed prey has its Hunt Marks cleared');
  assert.equal(marks(b), 1, 'the newly entered spirit gets 1 stack from Shadow Fang');
  turn(b, sw(1), WAIT);
  assert.equal(marks(b), 0, 'Noxfang leaves, so the Hunt Marks disappear');
});

test('Blood Scent (Noxfang): the opponent gains 2 Hunt Marks; the user gets Attack and Speed +1', () => {
  const b = nox(['noxfang_blood_scent']);
  turn(b, 'noxfang_blood_scent', WAIT);
  assert.equal(marks(b), 2);
  assert.equal(b.active(0).stages.atk, 1);
  assert.equal(b.active(0).stages.spd, 1);
});

test('Pounce (Noxfang): power +35 at 3 or more Hunt Mark stacks', () => {
  const b = nox(['noxfang_pounce']);
  b.s.field = null;
  const plain = b.estimate(0, 'noxfang_pounce');
  b.active(1).vars['e:nox:mark'] = 3;
  const boosted = b.estimate(0, 'noxfang_pounce');
  assert.ok(Math.abs(boosted / plain - 90 / 55) < 0.02, `${boosted} / ${plain}`);
});

test('Nightfall (Noxfang): sets Eternal Night for 5 turns and leaves 1 Hunt Mark', () => {
  const b = nox(['noxfang_nightfall']);
  b.s.field = { element: 'fire', turns: 2 };
  turn(b, 'noxfang_nightfall', WAIT);
  assert.equal(b.s.field?.element, 'dark');
  assert.equal(b.s.field?.turns, 4, '5 turns, 1 already elapsed at the end of this turn');
  assert.equal(marks(b), 1);
});

test('Throat Rend (Noxfang): a hit leaves 2 Hunt Marks', () => {
  const b = nox(['noxfang_throat_rend']);
  turn(b, 'noxfang_throat_rend', WAIT);
  assert.equal(marks(b), 2);
});

test('Hunt Down (Noxfang): when the opponent switches, hits at double power before it leaves', () => {
  const b = nox(['noxfang_hunt_down']);
  const target = b.active(1);
  target.hp = target.maxHp = 99999;
  const hp = target.hp;
  const est = b.estimate(0, 'noxfang_hunt_down');
  const ev = turn(b, 'noxfang_hunt_down', sw(1));
  const hit = hitsBy(ev, 0)[0];
  assert.ok(hit, 'the pursuit hits');
  assert.ok(hit.dmg > est * 1.6, `pursuit ${hit.dmg} should be about double ${est}`);
  assert.ok(target.hp < hp);
  assert.equal(b.side(1).active, 1, 'the switch completes as usual');
});

test('Shadow Pounce (Noxfang): after the opponent attacks, counters with Shadow Fang at ×1.5 power; with the trait, 2 Hunt Marks in total', () => {
  const b = nox(['noxfang_shadow_ambush', 'noxfang_shadow_fang']);
  b.active(0).stats.spd = 1; // Let the opponent attack first
  turn(b, use(WAIT, 'noxfang_shadow_ambush'), WAIT);
  const ev = turn(b, WAIT, 't_strike');
  assert.ok(ev.some((e) => e.k === 'trap' && e.side === 0 && e.skillId === 'noxfang_shadow_ambush'));
  assert.ok(used(ev, 0, 'noxfang_shadow_fang'), 'the counter-attacking Shadow Fang');
  assert.equal(marks(b), 2, 'Night Hunter 1 stack + Shadow Fang 1 stack');
  const fang = hitsBy(ev, 0)[0];
  const plain = b.estimate(0, 'noxfang_shadow_fang');
  assert.ok(fang.dmg > plain * 1.3, 'power ×1.5');
});

test('Dark Moon Claws (Noxfang): 2 hits, 1 Hunt Mark per hit', () => {
  const b = nox(['noxfang_moon_claws']);
  const ev = turn(b, 'noxfang_moon_claws', WAIT);
  assert.equal(hitsBy(ev, 0).length, 2);
  assert.equal(marks(b), 2);
});

test('Blood Moon Snare (Noxfang): when the opponent uses a status skill, curses it first (the boost fails) and leaves 2 Hunt Marks', () => {
  const b = nox(['noxfang_bloodmoon_snare']);
  b.active(0).stats.spd = 9999;
  turn(b, use(WAIT, 'noxfang_bloodmoon_snare'), 't_strike');
  const ev = turn(b, WAIT, 't_war_cry');
  assert.ok(ev.some((e) => e.k === 'trap' && e.side === 0));
  assert.ok(b.active(1).status.curse, 'cursed');
  assert.equal(b.active(1).stages.atk, 0, 'the curse blocked this boost');
  assert.equal(marks(b), 3, 'trap 2 stacks + Night Hunter 1 stack');
});

test('Hunting Moon Howl (Noxfang): the opponent gains 3 Hunt Marks and fear; the user gets Attack +1', () => {
  const b = nox(['noxfang_moon_howl'], 'cloudfluff');
  b.active(0).stats.spd = 9999;
  const ev = turn(b, 'noxfang_moon_howl', 't_strike');
  assert.equal(marks(b), 3);
  assert.ok(ev.some((e) => e.k === 'status' && e.target === 1 && e.status === 'fear'));
  assert.equal(hitsBy(ev, 1).length, 0, 'the opponent is too afraid to attack');
  assert.equal(b.active(0).stages.atk, 1);
});

test('Lunar Rend (Noxfang): always crits at 3 or more Hunt Mark stacks', () => {
  const b = nox(['noxfang_lunar_rend']);
  b.active(1).vars['e:nox:mark'] = 3;
  b.active(1).hp = b.active(1).maxHp = 99999;
  const ev = turn(b, 'noxfang_lunar_rend', WAIT);
  assert.ok(hitsBy(ev, 0)[0].crit);
});

test('Killing Fang (Noxfang): priority +2, execute line +12%', () => {
  const b = nox(['noxfang_kill_fang']);
  b.s.field = null;
  b.active(1).vars['e:nox:mark'] = 0; // Only the +12%
  const d = b.active(1);
  const est = b.estimate(0, 'noxfang_kill_fang');
  d.hp = Math.floor(est + d.maxHp * 0.08);
  const ev = turn(b, 'noxfang_kill_fang', WAIT);
  assert.ok(executed(ev) || d.fainted, 'about 8% left after the hit, which is ≤ 12%');
});

test('Pack Feast (Noxfang): 3 hits, each hit checks for Hunt Kill', () => {
  const b = nox(['noxfang_pack_feast']);
  const d = b.active(1);
  b.active(1).vars['e:nox:mark'] = 4;
  d.hp = Math.floor(d.maxHp * 0.5);
  const ev = turn(b, 'noxfang_pack_feast', WAIT);
  assert.ok(executed(ev), 'dropping below the execute line mid-skill triggers Hunt Kill');
  assert.ok(hitsBy(ev, 0).length < 3, 'the remaining hits do not land after the Hunt Kill');
});

test('Eclipse Fang (Noxfang): always crits, execute line ×2', () => {
  const b = nox(['noxfang_shadow_fang']);
  b.side(0).aether = 10;
  const d = b.active(1);
  d.vars['e:nox:mark'] = 2; // (12% + 10%) × 2 = 44%
  const est = b.estimate(0, 'u_noxfang');
  d.hp = Math.floor(est * 1.5 + d.maxHp * 0.35); // About 35% left after the crit
  const ev = turn(b, 'u_noxfang', WAIT);
  assert.ok(hitsBy(ev, 0)[0].crit);
  assert.ok(executed(ev), 'about 35% left, which is ≤ 44%');
});

// ═════════════════════════ `voidchild` ═════════════════════════

const vc = (skills: string[], foe = 'soul_lantern', foeSkills = [WAIT, 't_strike', 't_war_cry', 't_heal']) =>
  duel([{ id: 'voidchild', skills }, { id: 'voidchild', skills: ['voidchild_nibble'] }], [{ id: foe, skills: foeSkills }, { id: foe, skills: foeSkills }]);

test('Void (Nephe): devours on entering; with no boosts on the opponent it erodes 4% of max HP, Void Belly +1', () => {
  const b = vc(['voidchild_nibble']);
  const d = b.active(1);
  const cut = Math.floor(d.stats.hp * 0.04);
  assert.equal(d.maxHp, d.stats.hp - cut, 'max HP is reduced');
  assert.equal(d.hp, d.maxHp, 'HP drops with it');
  assert.equal(belly(b), 1);
  assert.equal(b.view().sides[0].team[0].marks.find((m) => m.id === 'kit:belly')?.n, 1);
});

test('Devour (Nephe): when the opponent has boosts, dispels them instead (stat boosts and shields)', () => {
  const b = vc(['voidchild_nibble']);
  b.active(0).stats.spd = 9999;
  turn(b, 'voidchild_nibble', 't_war_cry');
  assert.equal(b.active(1).stages.atk, 2, 'Void Nibble moves first, so the opponent has no boost yet → erodes HP instead');
  b.giveShield(1, 20);
  const maxHp = b.active(1).maxHp;
  turn(b, 'voidchild_nibble', WAIT);
  assert.equal(b.active(1).stages.atk, 0);
  assert.equal(b.active(1).shield, null);
  assert.equal(b.active(1).maxHp, maxHp, 'no HP is eroded while there are boosts to devour');
  assert.equal(belly(b), 3, 'entering 1 + two Void Nibbles');
});

test('Void Belly (Nephe): +5% damage per stack; +2 when it knocks out the opponent', () => {
  const b = vc(['voidchild_nibble']);
  b.active(0).vars['vc:belly'] = 0;
  const plain = b.estimate(0, 'voidchild_nibble');
  b.active(0).vars['vc:belly'] = 4;
  const fed = b.estimate(0, 'voidchild_nibble');
  assert.ok(Math.abs(fed / plain - 1.2) < 0.02, `${fed} / ${plain}`);
  b.active(0).vars['vc:belly'] = 0;
  b.active(1).hp = 1;
  turn(b, 'voidchild_nibble', WAIT);
  assert.ok(b.side(1).team[0].fainted);
  assert.equal(belly(b), 2);
});

test('Void Burst (Nephe): power +40 and spends 1 stack while it has Void Belly', () => {
  const b = vc(['voidchild_burst']);
  b.active(0).vars['vc:belly'] = 0;
  const plain = b.estimate(0, 'voidchild_burst');
  b.active(0).vars['vc:belly'] = 1;
  const fed = b.estimate(0, 'voidchild_burst');
  assert.ok(Math.abs(fed / plain - (90 / 50) * 1.05) < 0.03);
  turn(b, 'voidchild_burst', WAIT);
  assert.equal(belly(b), 0);
});

test('Digest (Nephe): cleanses first, then heals (a curse cannot stop it); Void Belly +1 per status condition removed', () => {
  const b = vc(['voidchild_digest']);
  const me = b.active(0);
  me.hp = Math.floor(me.maxHp / 2);
  b.applyStatus(0, 'curse');
  b.applyStatus(0, 'burn');
  const hp = me.hp;
  turn(b, 'voidchild_digest', WAIT);
  assert.deepEqual(Object.keys(me.status), []);
  assert.ok(me.hp >= hp + Math.floor(me.maxHp * 0.2) - 1, 'heals 20%');
  assert.equal(belly(b), 3, 'entering 1 + two status conditions');
});

test('Devouring Wave (Nephe): devours on hit', () => {
  const b = vc(['voidchild_shade_wave']);
  turn(b, 'voidchild_shade_wave', WAIT);
  assert.equal(belly(b), 2);
});

test('Void Maw (Nephe): steals when the opponent boosts, Void Belly +2', () => {
  const b = vc(['voidchild_void_maw']);
  turn(b, use(WAIT, 'voidchild_void_maw'), WAIT);
  const ev = turn(b, WAIT, 't_war_cry');
  assert.ok(ev.some((e) => e.k === 'trap' && e.side === 0 && e.skillId === 'voidchild_void_maw'));
  assert.equal(b.active(1).stages.atk, 0);
  assert.equal(b.active(0).stages.atk, 2);
  assert.equal(belly(b), 3);
});

test('Swallow the Sky (Nephe): the field disappears at the end of this turn, Void Belly +1 per turn it had left (max 3)', () => {
  const b = vc(['voidchild_swallow_sky']);
  b.setField('fire', 5);
  turn(b, 'voidchild_swallow_sky', WAIT);
  assert.equal(b.s.field, null);
  assert.equal(belly(b), 4, 'entering 1 + 3');
  assert.equal(b.active(0).stages.mag, 1);
});

test('Void Devour (Nephe): steals boosts; with none, erodes 6% of max HP instead', () => {
  const b = vc(['void_devour']);
  b.active(1).stages.atk = 2;
  turn(b, 'void_devour', WAIT);
  assert.equal(b.active(0).stages.atk, 2);
  assert.equal(b.active(1).stages.atk, 0);
  const d = b.active(1);
  const before = d.maxHp;
  turn(b, 'void_devour', WAIT);
  assert.equal(before - d.maxHp, Math.floor(d.stats.hp * 0.06));
  assert.equal(belly(b), 3);
});

test('Devour Time (Nephe): clears turn-based effects on the opponent, Void Belly +1 when something is swallowed', () => {
  const b = vc(['voidchild_eat_time']);
  b.setScreen(1, 'mag', 30, 5);
  turn(b, 'voidchild_eat_time', WAIT);
  assert.equal(b.side(1).screens.magTurns, 0);
  assert.equal(belly(b), 2);
  turn(b, 'voidchild_eat_time', WAIT);
  assert.equal(belly(b), 2, 'nothing left to devour');
});

test('Void Collapse (Nephe): power +25 per Void Belly stack, cleared after the attack', () => {
  const b = vc(['voidchild_collapse']);
  b.active(0).vars['vc:belly'] = 0;
  const plain = b.estimate(0, 'voidchild_collapse');
  b.active(0).vars['vc:belly'] = 3;
  const fed = b.estimate(0, 'voidchild_collapse');
  assert.ok(Math.abs(fed / plain - (165 / 90) * 1.15) < 0.03, `${fed} / ${plain}`);
  b.active(1).hp = b.active(1).maxHp = 99999;
  turn(b, 'voidchild_collapse', WAIT);
  assert.equal(belly(b), 0);
});

test('Sealing Maw (Nephe): seals the last skill the opponent used for 3 turns, Void Belly +1', () => {
  const b = vc(['voidchild_seal']);
  b.active(0).stats.spd = 9999;
  turn(b, WAIT, 't_war_cry');
  turn(b, 'voidchild_seal', WAIT);
  assert.equal(b.canUse(1, 't_war_cry').ok, false);
  assert.equal(belly(b), 2);
});

test('World Erosion (Nephe): erodes 8% of max HP', () => {
  const b = vc(['voidchild_erosion']);
  const d = b.active(1);
  d.hp = d.maxHp = 99999;
  d.stats.hp = 99999;
  turn(b, 'voidchild_erosion', WAIT);
  assert.equal(d.maxHp, 99999 - Math.floor(99999 * 0.08));
  assert.equal(belly(b), 2);
});

test('Void Wall (Nephe): acts first and swallows the first attack, Void Belly +2; cannot be used twice in a row', () => {
  const b = vc(['voidchild_void_wall']);
  b.active(0).stats.spd = 1;
  const hp = b.active(0).hp;
  const ev = turn(b, 'voidchild_void_wall', 't_strike');
  assert.equal(b.active(0).hp, hp, 'the attack is swallowed');
  assert.ok(ev.some((e) => e.k === 'negate'));
  assert.equal(belly(b), 3);
  assert.equal(b.canUse(0, 'voidchild_void_wall').ok, false);
  turn(b, WAIT, 't_strike');
  assert.ok(b.active(0).hp < hp, 'only the first attack is swallowed');
  assert.equal(b.canUse(0, 'voidchild_void_wall').ok, true);
});

test('Void Advent (Nephe): after the opponent uses a status skill or lands an attack, Nephe devours once', () => {
  const b = vc(['voidchild_void_advent']);
  b.active(0).stats.spd = 9999;
  turn(b, 'voidchild_void_advent', 't_strike');
  assert.equal(b.active(0).stages.mag, 1);
  assert.equal(belly(b), 2, 'entering 1 + the opponent attack hit 1');
  turn(b, WAIT, 't_war_cry');
  assert.equal(b.active(1).stages.atk, 0, 'the boost is devoured');
  assert.equal(belly(b), 3);
  const max = b.active(1).maxHp;
  turn(b, WAIT, 't_strike');
  assert.ok(b.active(1).maxHp < max, 'with no boosts, HP is eroded');
  assert.equal(belly(b), 4);
});

test('Void Eclipse (Nephe): devours the unused ultimate of the opponent, so our side can use one more', () => {
  const b = vc(['voidchild_nibble']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  turn(b, 'u_voidchild', WAIT);
  assert.equal(b.side(1).ultUsed, true, 'the opponent can no longer use its ultimate');
  assert.equal(b.side(0).ultUsed, false, 'our side can use it once more');
  assert.equal(b.canUse(0, 'u_voidchild').ok, true);
  turn(b, 'u_voidchild', WAIT);
  assert.equal(b.side(0).ultUsed, true, 'the second time there is no ultimate left to devour');
});

// ═════════════════════════ `soul_lantern` ═════════════════════════

/** Opponent for the Netherlamp and `weaverspider` tests: Bloodthirst Instinct only works on physical skills, and in the tests the opponent only uses magic (t_bolt) */
const FOE = 'eclipse_batlord';
const FOE_SKILLS = [WAIT, 't_bolt', 't_war_cry', 't_trap'];
const burns = (ev: BattleEvent[]) => ev.filter((e) => e.k === 'damage' && e.reason === 'soulfire') as Extract<BattleEvent, { k: 'damage' }>[];

const sl = (skills: string[]) =>
  duel([{ id: 'soul_lantern', skills }, { id: 'soul_lantern', skills: ['soul_lantern_wisp'] }], [{ id: FOE, skills: FOE_SKILLS }, { id: FOE, skills: FOE_SKILLS }]);

test('Netherlamp: with a trap set, it is revealed at the end of the turn and burns the opponent with Soulfire for 5% (10% while cursed); the mark row shows it', () => {
  const b = sl(['soul_lantern_wisp', 'soul_lantern_lure_lamp']);
  const max = b.active(1).maxHp;
  const ev = turn(b, use('soul_lantern_wisp', 'soul_lantern_lure_lamp'), WAIT);
  assert.equal(burns(ev).length, 1);
  assert.equal(burns(ev)[0].dmg, Math.floor(max * 0.05));
  assert.equal(b.side(0).trap?.revealed, true, 'a lit lamp is revealed');
  const m = b.view().sides[0].team[0].marks.find((x) => x.id === 'kit:lamp');
  assert.equal(m?.n, 5);
  b.applyStatus(1, 'curse');
  const ev2 = turn(b, WAIT, WAIT);
  assert.equal(burns(ev2)[0].dmg, Math.floor(max * 0.1));
  // No trap, no burning
  const c = sl(['soul_lantern_wisp']);
  assert.equal(burns(turn(c, 'soul_lantern_wisp', WAIT)).length, 0);
});

test('Everlit: while the lamp is lit, the curse on the opponent does not lose turns; once it goes out the countdown resumes', () => {
  const b = sl(['soul_lantern_wisp', 'soul_lantern_lure_lamp']);
  b.applyStatus(1, 'curse');
  const t0 = b.active(1).status.curse!.turns;
  turn(b, use(WAIT, 'soul_lantern_lure_lamp'), WAIT);
  turn(b, WAIT, WAIT);
  assert.equal(b.active(1).status.curse!.turns, t0);
  b.side(0).trap = null;
  turn(b, WAIT, WAIT);
  assert.equal(b.active(1).status.curse!.turns, t0 - 1);
});

test('Lure Lamp: when an attack of the opponent hits, curses the attacker and the lamp goes out', () => {
  const b = sl(['soul_lantern_wisp', 'soul_lantern_lure_lamp']);
  turn(b, use(WAIT, 'soul_lantern_lure_lamp'), WAIT);
  assert.ok(!b.active(1).status.curse);
  turn(b, WAIT, 't_bolt');
  assert.ok(b.active(1).status.curse);
  assert.equal(b.side(0).trap, null);
});

test('Soul-Lock Lamp: when the opponent uses a status skill, negates it and curses the opponent', () => {
  const b = sl(['soul_lantern_wisp', 'soul_lantern_seal_lamp']);
  turn(b, use(WAIT, 'soul_lantern_seal_lamp'), WAIT);
  turn(b, WAIT, 't_war_cry');
  assert.equal(b.active(1).stages.atk ?? 0, 0, 'the boost is negated');
  assert.ok(b.active(1).status.curse);
  assert.equal(b.side(0).trap, null);
});

test('Soul Wisp and Wraith Step: power rises while the lamp is lit (+25 / +30)', () => {
  const b = sl(['soul_lantern_wisp', 'soul_lantern_wraith_step']);
  const w0 = b.estimate(0, 'soul_lantern_wisp');
  const s0 = b.estimate(0, 'soul_lantern_wraith_step');
  b.placeTrap(0, 'soul_lantern_lure_lamp');
  assert.ok(Math.abs(b.estimate(0, 'soul_lantern_wisp') / w0 - 70 / 45) < 0.05);
  assert.ok(Math.abs(b.estimate(0, 'soul_lantern_wraith_step') / s0 - 80 / 50) < 0.05);
});

test('Ghost Flame: while the lamp is lit, Soulfire burns one extra time right after the hit', () => {
  const b = sl(['soul_lantern_ghost_flame', 'soul_lantern_lure_lamp']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  turn(b, use(WAIT, 'soul_lantern_lure_lamp'), WAIT);
  assert.equal(burns(turn(b, 'soul_lantern_ghost_flame', WAIT)).length, 2, 'after the hit 1 + end of turn 1');
  const c = sl(['soul_lantern_ghost_flame']);
  c.active(1).hp = c.active(1).maxHp = 99999;
  assert.equal(burns(turn(c, 'soul_lantern_ghost_flame', WAIT)).length, 0);
});

test('Lamp Whisper: reveals the trap of the opponent (destroys it instead while the lamp is lit), the user gets Magic Power +1', () => {
  const b = sl(['soul_lantern_lamp_whisper']);
  turn(b, WAIT, use(WAIT, 't_trap'));
  const ev = turn(b, 'soul_lantern_lamp_whisper', WAIT);
  assert.ok(ev.some((e) => e.k === 'reveal' && e.side === 1));
  assert.ok(!ev.some((e) => e.k === 'trapDestroyed'));
  assert.equal(b.active(0).stages.mag, 1);

  const c = sl(['soul_lantern_lamp_whisper', 'soul_lantern_lure_lamp']);
  turn(c, use(WAIT, 'soul_lantern_lure_lamp'), use(WAIT, 't_trap'));
  const ev2 = turn(c, 'soul_lantern_lamp_whisper', WAIT);
  assert.ok(ev2.some((e) => e.k === 'trapDestroyed' && e.side === 1));
  assert.equal(c.side(1).trap, null);
});

test('Hang the Lamp: while the lamp is lit, hangs the Netherlamp on the opponent (freeing the trap slot); it keeps burning for 3 turns; lighting another makes both lamps burn', () => {
  const b = sl(['soul_lantern_hang_lamp', 'soul_lantern_lure_lamp']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  turn(b, use(WAIT, 'soul_lantern_lure_lamp'), WAIT);
  const ev = turn(b, 'soul_lantern_hang_lamp', WAIT);
  assert.equal(b.side(0).trap, null, 'our trap moves onto the opponent');
  assert.ok(b.getLasting(1, 'soul_lantern_hang_lamp'));
  assert.equal(burns(ev).length, 1, 'the hung lamp still burns');
  // The opponent's attacks cannot put out a hung lamp; light another -> both lamps burn
  const ev2 = turn(b, use(WAIT, 'soul_lantern_lure_lamp'), 't_bolt');
  assert.ok(b.getLasting(1, 'soul_lantern_hang_lamp'));
  assert.equal(burns(ev2).length, 2);
  const m = b.view().sides[0].team[0].marks.find((x) => x.id === 'kit:lamp');
  assert.match(m?.note ?? '', /×2/);
  // Everlit: even only a hung lamp keeps the curse from decreasing
  b.side(0).trap = null;
  b.applyStatus(1, 'curse');
  const t0 = b.active(1).status.curse!.turns;
  turn(b, WAIT, WAIT);
  assert.equal(b.active(1).status.curse!.turns, t0);
  // No lamp: it is just an ordinary attack
  const c = sl(['soul_lantern_hang_lamp']);
  c.active(1).hp = c.active(1).maxHp = 99999;
  turn(c, 'soul_lantern_hang_lamp', WAIT);
  assert.ok(!c.getLasting(1, 'soul_lantern_hang_lamp'));
});

test('Soul Drain: drains 50%; 100% while the lamp is lit', () => {
  const drained = (lit: boolean) => {
    const b = sl(['soul_lantern_soul_drain']);
    b.active(1).hp = b.active(1).maxHp = 99999;
    if (lit) b.placeTrap(0, 'soul_lantern_lure_lamp');
    const me = b.active(0);
    me.hp = 1;
    const ev = b.resolveTurn([use('soul_lantern_soul_drain'), use(WAIT)]);
    const dealt = hitsBy(ev, 0).reduce((s, h) => s + h.dmg, 0);
    return (me.hp - 1) / dealt;
  };
  assert.ok(Math.abs(drained(false) - 0.5) < 0.02);
  assert.ok(Math.abs(drained(true) - 1) < 0.02);
});

test('Karma Fire: removes the curse from the opponent and adds 6% of max HP damage per remaining turn', () => {
  const b = sl(['soul_lantern_karma_fire']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  b.applyStatus(1, 'curse');
  const n = b.active(1).status.curse!.turns;
  const ev = turn(b, 'soul_lantern_karma_fire', WAIT);
  const k = ev.filter((e) => e.k === 'damage' && e.reason === 'karma') as Extract<BattleEvent, { k: 'damage' }>[];
  assert.equal(k.length, 1);
  assert.equal(k[0].dmg, Math.floor(99999 * 0.06 * n));
  assert.ok(!b.active(1).status.curse);
});

test('Lamplit Rest: heals 30%; Magic Power +1 as well while the lamp is lit', () => {
  const b = sl(['soul_lantern_lamp_rest']);
  b.active(0).hp = 1;
  turn(b, 'soul_lantern_lamp_rest', WAIT);
  assert.ok(b.active(0).hp > 1);
  assert.equal(b.active(0).stages.mag ?? 0, 0);
  b.placeTrap(0, 'soul_lantern_lure_lamp');
  turn(b, 'soul_lantern_lamp_rest', WAIT);
  assert.equal(b.active(0).stages.mag, 1);
});

test('Thousand Lamps: lights a Lure Lamp when no trap is set; otherwise Soulfire burns once right away', () => {
  const b = sl(['soul_lantern_thousand_lamps']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  const ev = turn(b, 'soul_lantern_thousand_lamps', WAIT);
  assert.equal(b.side(0).trap?.skillId, 'soul_lantern_lure_lamp');
  assert.equal(burns(ev).length, 1, 'it starts burning at the end of the turn it was lit');
  const ev2 = turn(b, 'soul_lantern_thousand_lamps', WAIT);
  assert.equal(burns(ev2).length, 2, 'a lamp is already lit: after the hit 1 + end of turn 1');
});

test('Ten Thousand Lamps: curses the opponent, Soulfire doubled for 3 turns', () => {
  const b = sl(['soul_lantern_wisp', 'soul_lantern_lure_lamp']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  const ev = turn(b, use('u_soul_lantern', 'soul_lantern_lure_lamp'), WAIT);
  assert.ok(b.active(1).status.curse);
  assert.equal(burns(ev)[0].dmg, Math.floor(99999 * 0.2), 'curse 10% × 2');
});

// ═════════════════════════ `weaverspider` ═════════════════════════

const web = (b: Battle) => b.active(0).vars['e:ws:web'] ?? 0;
/** Opponent SPD 9999: the opponent acts first, so it never triggers the webstrand for "using a skill before the opponent" */
const ws = (skills: string[]) => {
  const b = duel([{ id: 'weaverspider', skills }, { id: 'weaverspider', skills: ['weaverspider_silk_shot'] }], [{ id: FOE, skills: FOE_SKILLS }, { id: FOE, skills: FOE_SKILLS }]);
  b.active(1).stats.spd = 9999;
  return b;
};

test('Silk Shot (Dreamweaver Spider): Webstrands +1 on hit; the mark row shows the Webstrands', () => {
  const b = ws(['weaverspider_silk_shot']);
  turn(b, 'weaverspider_silk_shot', WAIT);
  assert.equal(web(b), 1);
  const m = b.view().sides[0].team[0].marks.find((x) => x.id === 'kit:web');
  assert.equal(m?.n, 1);
});

test('Webstrands (Dreamweaver Spider): +1 when it uses a skill before the opponent (max 3, gone on leaving)', () => {
  const b = ws(['weaverspider_silk_shot', 'weaverspider_weave']);
  b.active(1).stats.spd = 1;
  turn(b, 'weaverspider_silk_shot', WAIT);
  assert.equal(web(b), 2, 'hit 1 + acting first 1');
  turn(b, 'weaverspider_weave', WAIT);
  assert.equal(web(b), 3, 'at most 3');
  turn(b, sw(1), WAIT);
  turn(b, WAIT, WAIT);
  turn(b, sw(0), WAIT);
  assert.equal(web(b), 0, 'gone on leaving');
});

test('Snare Web (Dreamweaver Spider): cuts damage by 30%, roots the attacker, the trait lowers its Speed by 1; sets the trap again if Webstrands remain', () => {
  const b = ws(['weaverspider_silk_shot', 'weaverspider_snare_web']);
  turn(b, use(WAIT, 'weaverspider_snare_web'), WAIT);
  b.active(0).vars['e:ws:web'] = 1;
  const est = b.estimate(1, 't_bolt');
  const ev = turn(b, WAIT, 't_bolt');
  const hit = hitsBy(ev, 1)[0];
  if (!hit.crit) assert.ok(hit.dmg <= est * 0.8 && hit.dmg >= est * 0.55, `${hit.dmg} / ${est}`);
  assert.ok(b.active(1).status.root);
  assert.equal(b.active(1).stages.spd, -1);
  assert.equal(b.side(0).trap?.skillId, 'weaverspider_snare_web', 'the trap is set again');
  assert.equal(web(b), 0);
  // Fires again: no webstrands are left, so the trap disappears after this firing
  turn(b, WAIT, 't_bolt');
  assert.equal(b.active(1).stages.spd, -2);
  assert.equal(b.side(0).trap, null);
});

test('Dream-Binding Net (Dreamweaver Spider): negates the status skill of the opponent, Magic Power −1; sets the trap again if Webstrands remain', () => {
  const b = ws(['weaverspider_silk_shot', 'weaverspider_dream_net']);
  turn(b, use(WAIT, 'weaverspider_dream_net'), 't_bolt');
  b.active(0).vars['e:ws:web'] = 2;
  turn(b, WAIT, 't_war_cry');
  assert.equal(b.active(1).stages.atk ?? 0, 0);
  assert.equal(b.active(1).stages.mag, -1);
  assert.equal(b.side(0).trap?.skillId, 'weaverspider_dream_net');
  assert.equal(web(b), 1);
});

test('Weave (Dreamweaver Spider): Webstrands +2, Resistance +1', () => {
  const b = ws(['weaverspider_weave']);
  turn(b, 'weaverspider_weave', WAIT);
  assert.equal(web(b), 2);
  assert.equal(b.active(0).stages.res, 1);
});

test('Spider Bite (Dreamweaver Spider): the opponent gets Speed −1 on hit', () => {
  const b = ws(['weaverspider_venom_bite']);
  turn(b, 'weaverspider_venom_bite', WAIT);
  assert.equal(b.active(1).stages.spd, -1);
});

test('Prey (Dreamweaver Spider): power +20 per stage of Speed drop on the opponent (max +80)', () => {
  const b = ws(['weaverspider_prey']);
  const p0 = b.estimate(0, 'weaverspider_prey');
  b.active(1).stages.spd = -2;
  assert.ok(Math.abs(b.estimate(0, 'weaverspider_prey') / p0 - 115 / 75) < 0.05);
  b.active(1).stages.spd = -6;
  assert.ok(Math.abs(b.estimate(0, 'weaverspider_prey') / p0 - 155 / 75) < 0.05);
});

test('Reel In (Dreamweaver Spider): power +35 per Webstrand, cleared after the attack', () => {
  const b = ws(['weaverspider_reel_in']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  const p0 = b.estimate(0, 'weaverspider_reel_in');
  b.active(0).vars['e:ws:web'] = 3;
  assert.ok(Math.abs(b.estimate(0, 'weaverspider_reel_in') / p0 - 190 / 85) < 0.05);
  turn(b, 'weaverspider_reel_in', WAIT);
  assert.equal(web(b), 0);
});

test('Sticky Web (Dreamweaver Spider): lays an entry hazard and Webstrands +1', () => {
  const b = ws(['sticky_web']);
  turn(b, 'sticky_web', WAIT);
  assert.ok(b.side(1).hazard);
  assert.equal(web(b), 1);
});

test('Silk Bind and Cocoon (Dreamweaver Spider): Webstrands +1 (Cocoon also heals 30%)', () => {
  const b = ws(['weaverspider_silk_bind', 'weaverspider_cocoon']);
  turn(b, 'weaverspider_silk_bind', WAIT);
  assert.equal(web(b), 1);
  b.active(0).hp = 1;
  turn(b, 'weaverspider_cocoon', WAIT);
  assert.equal(web(b), 2);
  assert.ok(b.active(0).hp > b.active(0).maxHp * 0.25);
});

test('Silk Sense (Dreamweaver Spider): destroys the trap of the opponent, Webstrands +1', () => {
  const b = ws(['weaverspider_sense']);
  turn(b, WAIT, use(WAIT, 't_trap'));
  turn(b, 'weaverspider_sense', WAIT);
  assert.equal(b.side(1).trap, null);
  assert.equal(web(b), 1);
});

test('Thousand Threads (Dreamweaver Spider): refills Webstrands; setting the trap again costs no Webstrands for 3 turns', () => {
  const b = ws(['weaverspider_thousand_threads', 'weaverspider_snare_web']);
  turn(b, use('weaverspider_thousand_threads', 'weaverspider_snare_web'), WAIT);
  assert.equal(web(b), 3);
  assert.ok(b.getLasting(0, 'weaverspider_thousand_threads'));
  turn(b, WAIT, 't_bolt');
  assert.equal(b.side(0).trap?.skillId, 'weaverspider_snare_web');
  assert.equal(web(b), 3, 'none spent');
});

test('Dreamweb Prophecy (Dreamweaver Spider): refills Webstrands; sets Snare Web when no trap is set', () => {
  const b = ws(['weaverspider_silk_shot']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  turn(b, 'u_weaverspider', WAIT);
  assert.equal(web(b), 3);
  assert.equal(b.side(0).trap?.skillId, 'weaverspider_snare_web');
});

// ═════════════════════════ `eclipse_batlord` ═════════════════════════

const KISS = 'eclipse_batlord_night_kiss';
const kissFeeds = (ev: BattleEvent[]) => ev.filter((e) => e.k === 'damage' && e.reason === 'kiss') as Extract<BattleEvent, { k: 'damage' }>[];
const dealtBy = (ev: BattleEvent[], side: 0 | 1) => hitsBy(ev, side).reduce((s, h) => s + h.dmg, 0);
/** The opponent uses test skills (no trap: the Netherlamp will not light) */
const BAT_FOE_SKILLS = [WAIT, 't_strike', 't_war_cry', 't_heal'];
const bat = (skills: string[]) =>
  duel([{ id: 'eclipse_batlord', skills }, { id: 'eclipse_batlord', skills: ['eclipse_batlord_night_kiss'] }], [{ id: 'soul_lantern', skills: BAT_FOE_SKILLS }, { id: 'soul_lantern', skills: BAT_FOE_SKILLS }]);

test('Night Kiss (Eclipse Batlord): after a hit the opponent is kissed for 3 turns; when its attack hits the Batlord it loses 30% of that damage and the Batlord heals the same amount', () => {
  const b = bat(['eclipse_batlord_night_kiss']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  turn(b, 'eclipse_batlord_night_kiss', WAIT);
  assert.ok(b.getLasting(1, KISS));
  const m = b.view().sides[0].team[0].marks.find((x) => x.id === 'kit:kiss');
  assert.equal(m?.n, 30);
  b.active(0).hp = Math.floor(b.active(0).maxHp / 2);
  const hp0 = b.active(0).hp;
  const f0 = b.active(1).hp;
  const ev = turn(b, WAIT, 't_strike');
  const dealt = dealtBy(ev, 1);
  const feed = kissFeeds(ev);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].dmg, Math.floor(dealt * 0.3));
  assert.equal(b.active(0).hp, hp0 - dealt + feed[0].dmg, 'the Batlord heals the same amount');
  assert.equal(b.active(1).hp, f0 - feed[0].dmg);
  // Status skills do not feed blood; after 3 turns Night Kiss disappears
  assert.equal(kissFeeds(turn(b, WAIT, 't_war_cry')).length, 0);
  assert.ok(!b.getLasting(1, KISS));
});

test('Night Kiss (Eclipse Batlord): disappears when the Batlord leaves; also disappears when the opponent leaves', () => {
  const b = bat(['eclipse_batlord_night_kiss']);
  turn(b, 'eclipse_batlord_night_kiss', WAIT);
  assert.ok(b.getLasting(1, KISS));
  turn(b, sw(1), WAIT);
  assert.ok(!b.getLasting(1, KISS));
  const c = bat(['eclipse_batlord_night_kiss']);
  turn(c, 'eclipse_batlord_night_kiss', WAIT);
  turn(c, WAIT, sw(1));
  turn(c, WAIT, sw(0));
  assert.ok(!c.getLasting(1, KISS));
});

test('Screech (Eclipse Batlord): taunts the opponent (no guarding, no status skills) and reveals its trap', () => {
  // The Netherlamp reveals traps by itself, so `tombhound` is used as the opponent here
  const b = duel([{ id: 'eclipse_batlord', skills: ['eclipse_batlord_screech'] }], [{ id: 'tombhound', skills: [WAIT, 't_strike', 't_war_cry', 't_trap'] }]);
  turn(b, WAIT, use(WAIT, 't_trap'));
  const ev = turn(b, 'eclipse_batlord_screech', WAIT);
  assert.ok(b.active(1).status.taunt);
  assert.ok(ev.some((e) => e.k === 'reveal' && e.side === 1));
  assert.equal(b.canGuard(1).ok, false);
  assert.equal(b.canUse(1, 't_war_cry').ok, false);
});

test('Hang Upside Down (Eclipse Batlord): attack damage taken this turn −50%, the Night Kiss drain becomes 100%; cannot be used twice in a row', () => {
  const run = (stance: boolean) => {
    const b = bat(['eclipse_batlord_night_kiss', 'eclipse_batlord_hang']);
    b.active(1).hp = b.active(1).maxHp = 99999;
    turn(b, 'eclipse_batlord_night_kiss', WAIT);
    b.active(0).hp = Math.floor(b.active(0).maxHp / 2);
    const ev = turn(b, stance ? 'eclipse_batlord_hang' : WAIT, 't_strike');
    return { b, dealt: dealtBy(ev, 1), feed: kissFeeds(ev)[0]?.dmg ?? 0 };
  };
  const plain = run(false);
  const hang = run(true);
  assert.ok(hang.dealt >= plain.dealt * 0.4 && hang.dealt <= plain.dealt * 0.6, `${hang.dealt} / ${plain.dealt}`);
  assert.equal(plain.feed, Math.floor(plain.dealt * 0.3));
  assert.equal(hang.feed, hang.dealt, 'Hang Upside Down: not a drop is lost');
  assert.equal(hang.b.canUse(0, 'eclipse_batlord_hang').ok, false, 'cannot be used twice in a row');
  turn(hang.b, WAIT, WAIT);
  assert.equal(hang.b.canUse(0, 'eclipse_batlord_hang').ok, true);
});

test('Blood Fang (Eclipse Batlord): always crits while the opponent is taunted; applies Night Kiss on hit', () => {
  const b = bat(['eclipse_batlord_blood_fang']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  b.applyStatus(1, 'taunt');
  const ev = turn(b, 'eclipse_batlord_blood_fang', WAIT);
  assert.ok(hitsBy(ev, 0).length > 0 && hitsBy(ev, 0).every((h) => h.crit));
  assert.ok(b.getLasting(1, KISS));
});

test('Bloodlust and Deep Drink (Eclipse Batlord): heals 15% more when the opponent is under Night Kiss / drains 12% of the opponent from the wound', () => {
  const b = bat(['eclipse_batlord_bloodlust', 'eclipse_batlord_drink_deep']);
  const max = b.active(0).maxHp;
  b.active(0).hp = 1;
  turn(b, 'eclipse_batlord_bloodlust', WAIT);
  assert.equal(b.active(0).hp, 1, 'no Night Kiss: boosts only');
  assert.equal(b.active(0).stages.atk, 1);
  assert.equal(b.active(0).stages.spd, 1);
  b.addLasting(1, KISS, 3, { from: 0 });
  turn(b, 'eclipse_batlord_bloodlust', WAIT);
  assert.equal(b.active(0).hp, 1 + Math.floor(max * 0.15));
  b.active(0).hp = 1;
  const ev = turn(b, 'eclipse_batlord_drink_deep', WAIT);
  assert.equal(kissFeeds(ev)[0]?.dmg, Math.floor(b.active(1).maxHp * 0.12));
  assert.equal(b.active(0).hp, 1 + Math.floor(max * 0.3));
});

test('Blood Moon (Eclipse Batlord): power +50 when the opponent is already under Night Kiss', () => {
  const b = bat(['eclipse_batlord_blood_moon']);
  const e0 = b.estimate(0, 'eclipse_batlord_blood_moon');
  b.addLasting(1, KISS, 3, { from: 0 });
  assert.ok(Math.abs(b.estimate(0, 'eclipse_batlord_blood_moon') / e0 - 150 / 100) < 0.05);
});

test('Eclipse (Eclipse Batlord): Eternal Night for 5 turns, the user gets Speed +1', () => {
  const b = bat(['eclipse_batlord_eclipse']);
  turn(b, 'eclipse_batlord_eclipse', WAIT);
  assert.equal(b.s.field?.element, 'dark');
  assert.equal(b.active(0).stages.spd, 1);
});

test('Eclipse Feast (Eclipse Batlord): Night Kiss plus taunt, drain doubled (60%) for 3 turns', () => {
  const b = bat(['eclipse_batlord_night_kiss']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  turn(b, 'u_eclipse_batlord', WAIT);
  assert.ok(b.getLasting(1, KISS));
  assert.ok(b.active(1).status.taunt);
  b.active(0).hp = Math.floor(b.active(0).maxHp / 2);
  const ev = turn(b, WAIT, 't_strike');
  assert.equal(kissFeeds(ev)[0]?.dmg, Math.floor(dealtBy(ev, 1) * 0.6));
});

test('Bloodthirst Instinct (Eclipse Batlord): heals 20% when it knocks out an opponent under Night Kiss (a KO by an attack or by the Night Kiss drain both count)', () => {
  const b = bat(['eclipse_batlord_night_kiss']);
  const max = b.active(0).maxHp;
  turn(b, 'eclipse_batlord_night_kiss', WAIT);
  b.active(1).hp = 1;
  b.active(0).hp = 1;
  const ev = turn(b, 'eclipse_batlord_night_kiss', WAIT);
  assert.ok(b.active(1).fainted);
  assert.ok(traits(ev).includes('吸血本能'));
  assert.equal(b.active(0).hp, 1 + Math.floor(max * 0.2));
  // The opponent drains itself dry with the blood it dealt itself
  const c = bat(['eclipse_batlord_night_kiss']);
  turn(c, 'eclipse_batlord_night_kiss', WAIT);
  c.active(1).hp = 1;
  c.active(0).hp = Math.floor(c.active(0).maxHp / 2);
  const ev2 = turn(c, WAIT, 't_strike');
  assert.ok(c.active(1).fainted);
  assert.ok(traits(ev2).includes('吸血本能'));
  // No Night Kiss: it does not trigger
  const d = bat(['eclipse_batlord_night_kiss']);
  d.active(1).hp = 1;
  assert.ok(!traits(turn(d, 'eclipse_batlord_night_kiss', WAIT)).includes('吸血本能'));
});

// ═════════════════════════ `tombhound` ═════════════════════════

const HEADS = 'e:th:heads';
const heads = (b: Battle) => b.active(0).vars[HEADS] ?? 0;
/** `eclipse_batlord` is dark element and can be burned; uses test skills, no Night Kiss */
const th = (skills: string[]) =>
  duel([{ id: 'tombhound', skills }, { id: 'tombhound', skills: ['tombhound_grave_bite'] }], [{ id: FOE, skills: FOE_SKILLS }, { id: FOE, skills: FOE_SKILLS }]);

test('Burning Heads (Three-Headed Warden): when the opponent reaches the end of the turn burning, lights 1 head (max 3); the mark row shows it; they go out on leaving', () => {
  const b = th(['tombhound_grave_bite']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  turn(b, WAIT, WAIT);
  assert.equal(heads(b), 0, 'no burn, no head lit');
  b.applyStatus(1, 'burn');
  turn(b, WAIT, WAIT);
  assert.equal(heads(b), 1);
  const m = b.view().sides[0].team[0].marks.find((x) => x.id === 'kit:heads');
  assert.equal(m?.n, 1);
  b.active(1).status.burn!.turns = 9;
  for (let i = 0; i < 3; i++) turn(b, WAIT, WAIT);
  assert.equal(heads(b), 3, 'at most 3 heads');
  delete b.active(1).status.burn;
  turn(b, sw(1), WAIT);
  turn(b, sw(0), WAIT);
  assert.equal(heads(b), 0, 'they go out on leaving');
});

test('Hellfire (Three-Headed Warden): burns and lights 2 heads, and the end-of-turn burn lights 1 more (all three heads aflame)', () => {
  const b = th(['tombhound_hellfire']);
  turn(b, 'tombhound_hellfire', WAIT);
  assert.ok(b.active(1).status.burn);
  assert.equal(heads(b), 3);
});

test('Flame Maw (Three-Headed Warden): power +25 per burning head; they go out on use, even when guarded', () => {
  const b = th(['tombhound_flame_maw']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  const e0 = b.estimate(0, 'tombhound_flame_maw');
  b.active(0).vars[HEADS] = 3;
  assert.ok(Math.abs(b.estimate(0, 'tombhound_flame_maw') / e0 - 115 / 40) < 0.05);
  const ev = turn(b, 'tombhound_flame_maw', guard());
  assert.ok(ev.some((e) => e.k === 'guarded' && e.side === 1));
  assert.equal(heads(b), 0);
});

test('Triple Maw (Three-Headed Warden): power +25 per burning head, bites twice (Three Heads); extends the burn by 1 turn on hit', () => {
  const b = th(['tombhound_triple_maw']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  const e0 = b.estimate(0, 'tombhound_triple_maw');
  b.active(0).vars[HEADS] = 2;
  assert.ok(Math.abs(b.estimate(0, 'tombhound_triple_maw') / e0 - 110 / 60) < 0.05);
  b.applyStatus(1, 'burn');
  const t0 = b.active(1).status.burn!.turns;
  const ev = turn(b, 'tombhound_triple_maw', WAIT);
  assert.equal(hitsBy(ev, 0).length, 2, 'Three Heads: a single-hit attack bites twice');
  assert.equal(b.active(1).status.burn!.turns, t0, 'extended by 1 turn, then reduced by 1 at the end of the turn');
  assert.equal(heads(b), 1, 'after the bite, the end-of-turn burn lights 1 more head');
});

test('Scorching Howl and Soulbrand Fang (Three-Headed Warden): extend the burn; biting a burning opponent lights 1 head', () => {
  const b = th(['tombhound_scorch_howl', 'tombhound_brand_fang']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  turn(b, 'tombhound_brand_fang', WAIT);
  assert.equal(heads(b), 0);
  b.applyStatus(1, 'burn');
  const t0 = b.active(1).status.burn!.turns;
  turn(b, 'tombhound_scorch_howl', WAIT);
  assert.equal(b.active(0).stages.atk, 1);
  assert.equal(b.active(1).stages.def, -1);
  assert.equal(b.active(1).status.burn!.turns, t0);
  assert.equal(heads(b), 1);
  turn(b, 'tombhound_brand_fang', WAIT);
  assert.equal(heads(b), 3, 'hit 1 + end of turn 1');
});

test('Soul Chase (Three-Headed Warden): when the opponent switches, hits at double power before it leaves', () => {
  const b = th(['tombhound_soul_chase']);
  const target = b.active(1);
  target.hp = target.maxHp = 99999;
  const est = b.estimate(0, 'tombhound_soul_chase');
  const ev = turn(b, 'tombhound_soul_chase', sw(1));
  assert.ok(target.hp < 99999);
  assert.ok(dealtBy(ev, 0) > est * 1.6, `${dealtBy(ev, 0)} / ${est}`);
  assert.equal(b.side(1).active, 1);
});

test('Hell Gate and Three-Headed Hellfire (Three-Headed Warden): burn and curse; the ultimate gets +30 per burning head and burns the opponent', () => {
  const b = th(['tombhound_hellgate']);
  turn(b, 'tombhound_hellgate', WAIT);
  assert.ok(b.active(1).status.burn);
  assert.ok(b.active(1).status.curse);
  const c = th(['tombhound_grave_bite']);
  c.active(1).hp = c.active(1).maxHp = 99999;
  const e0 = c.estimate(0, 'u_tombhound');
  c.active(0).vars[HEADS] = 3;
  assert.ok(Math.abs(c.estimate(0, 'u_tombhound') / e0 - 230 / 140) < 0.05);
  turn(c, 'u_tombhound', WAIT);
  assert.ok(c.active(1).status.burn);
  assert.equal(heads(c), 1, 'the burning heads are spent, then the end-of-turn burn lights 1 more');
});

// ═════════════════════════ `abyssjelly` ═════════════════════════

/** Opponent: `eclipse_batlord` (dark element, can be paralyzed) using test skills */
const jelly = (skills: string[]) =>
  duel([{ id: 'abyssjelly', skills }, { id: 'abyssjelly', skills: ['abyssjelly_sting'] }], [{ id: FOE, skills: FOE_SKILLS }, { id: FOE, skills: FOE_SKILLS }]);
/** Resolves a turn without refilling aether, and returns both sides' aether at the end */
const aetherAfter = (b: Battle, a: string, c: string) => {
  const ev = b.resolveTurn([use(a), use(c)]);
  return { ev, a0: b.side(0).aether, a1: b.side(1).aether };
};

test('Spirit Threads (Queen of Eternal Night): a paralyzed opponent loses 1 aether at the end of every turn; the mark row shows it; nothing is drained when the opponent has no aether', () => {
  const run = (para: boolean) => {
    const b = jelly(['abyssjelly_sting']);
    if (para) b.applyStatus(1, 'paralyze');
    b.side(0).aether = 3;
    b.side(1).aether = 4;
    return { b, ...aetherAfter(b, WAIT, WAIT) };
  };
  const off = run(false);
  const on = run(true);
  assert.equal(on.a1, off.a1 - 1);
  assert.equal(on.a0, off.a0 + 1);
  assert.match(texts(on.ev), /靈絲纏著/);
  assert.ok(on.b.view().sides[0].team[0].marks.some((x) => x.id === 'kit:threads'));
  assert.ok(!off.b.view().sides[0].team[0].marks.some((x) => x.id === 'kit:threads'));
  const c = jelly(['abyssjelly_sting']);
  c.applyStatus(1, 'paralyze');
  c.side(1).aether = 0;
  assert.doesNotMatch(texts(aetherAfter(c, WAIT, WAIT).ev), /靈絲纏著/);
});

test('Soul Drink and Draining Glow (Queen of Eternal Night): drain 1 aether; Draining Glow drains 1 more from a paralyzed opponent', () => {
  const b = jelly(['soul_drink', 'abyssjelly_drain_pulse']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  b.side(0).aether = 3;
  b.side(1).aether = 4;
  const r = aetherAfter(b, 'soul_drink', WAIT);
  assert.equal(r.a1, 4 - 1 + 2, 'drained 1, recovers 2 at the end of the turn');
  assert.equal(r.a0, 3 - 1 + 1 + 2);
  const c = jelly(['abyssjelly_drain_pulse']);
  c.active(1).hp = c.active(1).maxHp = 99999;
  c.applyStatus(1, 'paralyze');
  c.side(0).aether = 3;
  c.side(1).aether = 6;
  const r2 = aetherAfter(c, 'abyssjelly_drain_pulse', WAIT);
  assert.match(texts(r2.ev), /汲光波/);
  assert.equal(r2.a1, 6 - 2 + 2, 'Draining Glow 1 + Spirit Threads 1');
});

test('Numbing Tendril, Spirit Threads and Light of Endless Night (Queen of Eternal Night): paralyze the opponent', () => {
  const b = jelly(['abyssjelly_numb', 'abyssjelly_threads']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  turn(b, 'abyssjelly_numb', WAIT);
  assert.ok(b.active(1).status.paralyze);
  assert.equal(b.active(1).stages.spd, -1);
  delete b.active(1).status.paralyze;
  turn(b, 'abyssjelly_threads', WAIT);
  assert.ok(b.active(1).status.paralyze);
  const c = jelly(['abyssjelly_sting']);
  c.active(1).hp = c.active(1).maxHp = 99999;
  c.side(1).aether = 6;
  const ev = c.resolveTurn([use('u_abyssjelly'), use(WAIT)]);
  assert.ok(c.active(1).status.paralyze);
  assert.ok(ev.some((e) => e.k === 'aether' && e.side === 1 && e.delta === -1));
});

test('Night Tide (Queen of Eternal Night): Channel, the more aether is left the higher the power; Deep Glow: heals 10% more while the opponent is paralyzed', () => {
  const b = jelly(['abyssjelly_night_tide', 'abyssjelly_deep_glow']);
  b.side(0).aether = 3;
  const low = b.estimate(0, 'abyssjelly_night_tide');
  b.side(0).aether = 7;
  assert.ok(Math.abs(b.estimate(0, 'abyssjelly_night_tide') / low - 160 / 100) < 0.05);
  const max = b.active(0).maxHp;
  b.active(0).hp = 1;
  turn(b, 'abyssjelly_deep_glow', WAIT);
  assert.equal(b.active(0).hp, 1);
  assert.equal(b.active(0).stages.mag, 1);
  assert.equal(b.active(0).stages.res, 1);
  b.applyStatus(1, 'paralyze');
  turn(b, 'abyssjelly_deep_glow', WAIT);
  assert.equal(b.active(0).hp, 1 + Math.floor(max * 0.1));
});

// ═════════════════════════ `maskfox` ═════════════════════════

const MASK = 'maskfox_new_face';
/** Opponent: `eclipse_batlord` (no entry effect); `hex` (curse) is used to test the scapegoat */
const FOX_FOE_SKILLS = [WAIT, 't_strike', 'hex', 't_war_cry'];
const fox = (skills: string[]) =>
  duel([{ id: 'maskfox', skills }, { id: 'maskfox', skills: ['maskfox_fox_claw'] }], [{ id: FOE, skills: FOX_FOE_SKILLS }, { id: FOE, skills: FOX_FOE_SKILLS }]);

test('Hundred Masks (Hundred-Mask Fox): puts on a Mask on entering; the Mask shatters when it is attacked, cutting that damage by 50%', () => {
  const hitBy = (mask: boolean) => {
    const b = fox(['maskfox_fox_claw']);
    b.active(0).hp = b.active(0).maxHp = 99999;
    if (!mask) b.removeLasting(0, MASK);
    const ev = turn(b, WAIT, 't_strike');
    return { b, dmg: dealtBy(ev, 1), ev };
  };
  const masked = hitBy(true);
  const bare = hitBy(false);
  assert.ok(masked.dmg >= bare.dmg * 0.4 && masked.dmg <= bare.dmg * 0.6, `${masked.dmg} / ${bare.dmg}`);
  assert.match(texts(masked.ev), /面具碎裂/);
  assert.ok(!masked.b.getLasting(0, MASK), 'the shattered Mask is removed at the end of the turn');
  // Falls off by itself after 3 turns
  const c = fox(['maskfox_fox_claw']);
  assert.ok(c.getLasting(0, MASK));
  for (let i = 0; i < 3; i++) turn(c, WAIT, WAIT);
  assert.ok(!c.getLasting(0, MASK));
});

test('Scapegoat from the Mask (Hundred-Mask Fox): a status condition inflicted by the opponent lands back on the opponent; the same on the turn the Mask shatters', () => {
  const b = fox(['maskfox_fox_claw']);
  const ev = turn(b, WAIT, 'hex');
  assert.ok(!b.active(0).status.curse);
  assert.ok(b.active(1).status.curse, 'the curse is scapegoated back');
  assert.match(texts(ev), /嫁禍/);
  assert.ok(b.getLasting(0, MASK), 'scapegoating does not shatter the Mask');
  b.getLasting(0, MASK)!.n = 1;
  b.applyStatus(0, 'burn');
  assert.ok(!b.active(0).status.burn);
  assert.ok(b.active(1).status.burn);
  // Without a Mask it gets hit as usual
  const c = fox(['maskfox_fox_claw']);
  c.removeLasting(0, MASK);
  turn(c, WAIT, 'hex');
  assert.ok(c.active(0).status.curse);
  // Two `maskfox` scapegoating each other do not bounce back endlessly
  const d = duel([{ id: 'maskfox', skills: ['hex'] }], [{ id: 'maskfox', skills: ['hex'] }]);
  turn(d, 'hex', WAIT);
  assert.equal(!!d.active(0).status.curse !== !!d.active(1).status.curse, true);
});

test('New Face, Face Change and Hundred Faces (Hundred-Mask Fox): put on a new Mask (a shattered one is replaced too)', () => {
  const b = fox(['maskfox_new_face', 'maskfox_face_change']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  b.removeLasting(0, MASK);
  turn(b, 'maskfox_new_face', WAIT);
  assert.ok(b.getLasting(0, MASK));
  assert.equal(b.active(0).stages.atk, 1);
  b.removeLasting(0, MASK);
  turn(b, 'maskfox_face_change', WAIT);
  assert.ok(b.getLasting(0, MASK));
  b.getLasting(0, MASK)!.n = 1;
  turn(b, 'maskfox_new_face', WAIT);
  assert.equal(b.getLasting(0, MASK)?.n, 0, 'the shattered Mask is replaced');
  b.removeLasting(0, MASK);
  turn(b, 'u_maskfox', WAIT);
  assert.ok(b.getLasting(0, MASK));
  assert.ok(b.active(1).status.curse);
});

test('Mask Toss (Hundred-Mask Fox): power +30 while wearing a Mask, and the Mask shatters; Frame-Up: power +25 per status condition on the opponent', () => {
  const b = fox(['maskfox_mask_toss', 'maskfox_frame']);
  b.active(1).hp = b.active(1).maxHp = 99999;
  const withMask = b.estimate(0, 'maskfox_mask_toss');
  const f0 = b.estimate(0, 'maskfox_frame');
  b.applyStatus(1, 'curse');
  b.applyStatus(1, 'burn');
  assert.ok(Math.abs(b.estimate(0, 'maskfox_frame') / f0 - 110 / 60) < 0.05);
  turn(b, 'maskfox_mask_toss', WAIT);
  assert.ok(!b.getLasting(0, MASK));
  assert.ok(Math.abs(b.estimate(0, 'maskfox_mask_toss') / withMask - 60 / 90) < 0.05);
});

test('Hundred-Mask Fox AI: does not throw Mask Toss while wearing a Mask (unless it can KO); once the Mask is gone Mask Toss is used as usual', () => {
  const pick = (b: Battle) => {
    const a = chooseAction(b, 0, { skill: 1 }).main;
    return a.type === 'skill' ? a.skillId : a.type;
  };
  const b = fox(['maskfox_mask_toss', 'maskfox_fox_claw']);
  b.side(0).aether = 3; // Cannot use an ultimate
  b.side(1).aether = 0; // The opponent cannot use an ultimate: no hurry to guard
  assert.ok(b.getLasting(0, MASK));
  const tossMasked = b.estimate(0, 'maskfox_mask_toss');
  const claw = b.estimate(0, 'maskfox_fox_claw');
  // `maskfox_mask_toss` hits harder, but keeping the Mask to block a hit is better value
  b.active(1).hp = tossMasked * 2;
  assert.equal(pick(b), 'maskfox_fox_claw');
  // `maskfox_mask_toss` can KO and `maskfox_fox_claw` cannot: throw it
  b.active(1).hp = Math.floor((tossMasked + claw) / 2);
  assert.ok(b.active(1).hp > claw);
  assert.equal(pick(b), 'maskfox_mask_toss');
  // The Mask is gone: `maskfox_mask_toss` is just an ordinary 1-cost attack, no penalty
  b.removeLasting(0, MASK);
  b.active(1).hp = b.estimate(0, 'maskfox_mask_toss') * 2;
  assert.equal(pick(b), 'maskfox_mask_toss');
});

test('Feigned Sleep (Hundred-Mask Fox): heals 35%; Speed +1 more while wearing a Mask. Scapegoat: passes its own status conditions to the opponent', () => {
  const b = fox(['maskfox_mask_rest', 'scapegoat']);
  const max = b.active(0).maxHp;
  b.active(0).hp = 1;
  turn(b, 'maskfox_mask_rest', WAIT);
  assert.equal(b.active(0).hp, 1 + Math.floor(max * 0.35));
  assert.equal(b.active(0).stages.spd, 1);
  b.removeLasting(0, MASK);
  b.applyStatus(0, 'poison', 2);
  turn(b, 'scapegoat', WAIT);
  assert.ok(!b.active(0).status.poison);
  assert.ok(b.active(1).status.poison);
});
