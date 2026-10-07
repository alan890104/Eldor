// Mechanic tests for the nature group: `sylvaron` (Wither and Bloom: Wither, Leaves), `banyanelder` (Aerial Roots), `elderwood_warden` (Ancient Bark Shield), `owlarchivist` (See-Through),
// `dreamcap` (Phantom Spores), `acornsquirrel` (Stashed Fruit), `leaffrog` (Rejuvenation).
// node --test src/engine/kits/nature.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Battle } from '../battle.ts';
import type { BattleEvent, SideId } from '../types.ts';
import { duel, guard, hitsBy, sw, texts, traits, turn, use, useTestSkills } from '../testkit.ts';
import { NATURE_KEYS } from './nature.ts';
import { SKILLS } from '../../data.ts';

const SKILLS_INDEX = (id: string) => SKILLS.findIndex((s) => s.id === id) + 1;

useTestSkills();

const { LEAF, WITHER, REALM, LEAF_MAX } = NATURE_KEYS;
// The opponent is `dreamcap` of the same group (its old trait only works on physical attackers, and `sylvaron` is all magic), using test skills
const FOE = 'dreamcap';
const FOE_SKILLS = ['t_wait', 't_heal', 't_strike', 't_bolt'];

const leaves = (b: Battle, side: SideId = 0) => b.active(side).vars[LEAF] ?? 0;
const setLeaves = (b: Battle, n: number) => void (b.active(0).vars[LEAF] = n);
const pct = (b: Battle, side: SideId, p: number) => Math.floor((b.active(side).maxHp * p) / 100);
const witherDmg = (ev: BattleEvent[], side: SideId) =>
  ev.filter((e) => e.k === 'damage' && e.reason === 'wither' && e.target === side).map((e) => (e as { dmg: number }).dmg);
const heals = (ev: BattleEvent[], side: SideId) => ev.filter((e) => e.k === 'heal' && e.target === side).map((e) => (e as { amount: number }).amount);

/** `sylvaron` vs `dreamcap`; clean = clears the Grove Domain and Wither from entering, so one skill can be tested alone */
function syl(skills: string[], clean = true, foe: { id: string; skills?: string[] }[] = [{ id: FOE, skills: FOE_SKILLS }]): Battle {
  const b = duel([{ id: 'sylvaron', skills: ['t_wait', ...skills] }], foe);
  if (clean) {
    b.s.field = null;
    b.removeLasting(1, WITHER);
  }
  return b;
}

// ───────────────────────── Traits and mechanics ─────────────────────────

test('Evergreen Blessing: entering opens Grove Domain for 3 turns and withers the opponent for 2 turns (the old trait is disabled)', () => {
  const b = syl([], false);
  assert.equal(b.s.field?.element, 'nature');
  assert.equal(b.s.field?.turns, 3);
  assert.equal(b.getLasting(1, WITHER)?.turns, 2);
  assert.equal(b.getLasting(1, WITHER)?.from, 0);
  assert.ok(b.active(0).species.traitOverride, 'the trait has been rewritten');
  assert.ok(b.view().sides[1].team[0].marks.some((m) => m.id === `fx:${WITHER}` && m.note === '枯萎'), 'Wither shows in the mark row of the opponent');
});

test('Wither: healing received becomes an equal loss of HP (healing skills and Grove Domain both count), and each time 1 Leaf grows', () => {
  const b = syl([], false);
  const f = b.active(1);
  const ev = turn(b, 't_wait', 't_heal');
  assert.deepEqual(witherDmg(ev, 1), [pct(b, 1, 30), pct(b, 1, 5)], 'healing 30% → lose 30%; Grove Domain 5% → lose 5%');
  assert.equal(f.hp, f.maxHp - pct(b, 1, 30) - pct(b, 1, 5));
  assert.equal(heals(ev, 1).length, 0, 'no healing at all');
  assert.equal(leaves(b), 2);
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'kit:leaf' && m.n === 2), 'Leaves show in the mark row');
  assert.match(texts(ev), /回復變成了傷害/);
});

test('Leaves: at most 5, kept on leaving the field; each Leaf lowers attack damage taken by 5%', () => {
  const a = syl([]);
  const b = syl([]);
  setLeaves(b, 4);
  const d0 = hitsBy(turn(a, 't_wait', 't_strike'), 1)[0].dmg;
  const d4 = hitsBy(turn(b, 't_wait', 't_strike'), 1)[0].dmg;
  assert.ok(Math.abs(d4 - Math.floor(d0 * 0.8)) <= 1, `4 Leaves cut damage by 20% (${d0} → ${d4})`);
  // Cap, and kept after leaving
  const c = duel([{ id: 'sylvaron', skills: ['t_wait'] }, { id: FOE }], [{ id: FOE, skills: FOE_SKILLS }]);
  c.active(0).vars[LEAF] = LEAF_MAX;
  turn(c, 't_wait', 't_heal');
  assert.equal(leaves(c), LEAF_MAX, 'at most 5 Leaves');
  turn(c, sw(1), 't_wait');
  turn(c, sw(0), 't_wait');
  assert.equal(c.active(0).species.id, 'sylvaron');
  assert.equal(leaves(c), LEAF_MAX, 'kept on leaving the field');
});

// ───────────────────────── Skills ─────────────────────────

test('Withering Leaf: on hit the opponent withers for 1 turn (the Grove Domain healing at the end of this turn becomes damage)', () => {
  const b = syl(['sylvaron_wither_leaf']);
  b.s.field = { element: 'nature', turns: 3 };
  const ev = turn(b, 'sylvaron_wither_leaf', 't_wait');
  assert.match(texts(ev), /獲得「枯萎」（1 回合）/);
  assert.deepEqual(witherDmg(ev, 1), [pct(b, 1, 5)]);
  assert.equal(b.getLasting(1, WITHER), undefined, 'gone after the end of the turn');
});

test('Spring Rain: both sides heal 15%, and a withered opponent loses 15% instead', () => {
  const b = syl(['sylvaron_spring_rain']);
  b.active(0).hp = Math.floor(b.active(0).maxHp / 2);
  const hp0 = b.active(0).hp;
  const ev1 = turn(b, 'sylvaron_spring_rain', 't_strike');
  assert.equal(witherDmg(ev1, 1).length, 0, 'no Wither: the opponent heals normally (no amount at full HP)');
  b.active(0).hp = hp0;
  b.addLasting(1, WITHER, 2, { from: 0 });
  const ev2 = turn(b, 'sylvaron_spring_rain', 't_wait');
  assert.deepEqual(witherDmg(ev2, 1), [pct(b, 1, 15)]);
  assert.deepEqual(heals(ev2, 0), [pct(b, 0, 15)]);
  assert.equal(leaves(b), 1);
});

test('Root Siphon: drains 50%, 100% when the opponent is withered', () => {
  const b = syl(['sylvaron_root_siphon']);
  b.active(0).hp = 100;
  const ev1 = turn(b, 'sylvaron_root_siphon', 't_wait');
  const d1 = hitsBy(ev1, 0)[0].dmg;
  assert.deepEqual(heals(ev1, 0), [Math.floor(d1 * 0.5)]);
  b.active(0).hp = 100;
  b.active(1).hp = b.active(1).maxHp;
  b.addLasting(1, WITHER, 2, { from: 0 });
  const ev2 = turn(b, 'sylvaron_root_siphon', 't_wait');
  const d2 = hitsBy(ev2, 0)[0].dmg;
  assert.deepEqual(heals(ev2, 0), [d2]);
});

test('Leaf Flurry: 2 hits plus 1 hit per Leaf, and all Leaves are spent', () => {
  const b = syl(['sylvaron_leaf_flurry']);
  setLeaves(b, 3);
  const ev = turn(b, 'sylvaron_leaf_flurry', 't_wait');
  assert.equal(hitsBy(ev, 0).length, 5);
  assert.equal(leaves(b), 0);
});

test('Canopy Veil (trap): damage −30% when hit, and Sylvaron grows 2 Leaves (also while on the bench)', () => {
  const a = syl(['sylvaron_canopy']);
  const d0 = hitsBy(turn(a, 't_wait', 't_strike'), 1)[0].dmg;
  const b = syl(['sylvaron_canopy']);
  turn(b, { ...use('t_wait'), trap: 'sylvaron_canopy' }, 't_wait');
  const ev = turn(b, 't_wait', 't_strike');
  assert.ok(ev.some((e) => e.k === 'trap' && e.skillId === 'sylvaron_canopy'));
  const d1 = hitsBy(ev, 1)[0].dmg;
  assert.ok(d1 < d0 * 0.75, `Damage reduced (${d0} → ${d1})`);
  assert.equal(leaves(b), 2);
  // Bench: the trap belongs to the team, so when a teammate is hit, the `sylvaron` on the bench grows Leaves too
  const c = duel([{ id: FOE, skills: ['t_wait'] }, { id: 'sylvaron' }], [{ id: FOE, skills: FOE_SKILLS }]);
  c.side(0).trap = { skillId: 'sylvaron_canopy', setTurn: 0, revealed: false };
  turn(c, 't_wait', 't_strike');
  assert.equal(c.side(0).team[1].vars[LEAF], 2);
});

test('Grove Revival: Grove Domain for 5 turns, and the opponent withers for 2 turns (a Decoy blocks the Wither)', () => {
  const b = syl(['sylvaron_grove']);
  turn(b, 'sylvaron_grove', 't_wait');
  assert.equal(b.s.field?.element, 'nature');
  assert.equal(b.s.field?.turns, 4, '5 turns, 1 turn has already passed this turn');
  assert.equal(b.getLasting(1, WITHER)?.turns, 1);
  const c = syl(['sylvaron_grove']);
  c.active(1).decoy = 100;
  const ev = turn(c, 'sylvaron_grove', 't_wait');
  assert.equal(c.getLasting(1, WITHER), undefined);
  assert.match(texts(ev), /替身擋下了枯萎/);
});

test('Blighting Breath: the opponent withers for 3 turns, and its timed effects are removed', () => {
  const b = syl(['sylvaron_blight_breath']);
  b.setScreen(1, 'phys', 20, 5);
  turn(b, 'sylvaron_blight_breath', 't_wait');
  assert.equal(b.side(1).screens.physTurns, 0, 'Crystal Wall removed');
  assert.equal(b.getLasting(1, WITHER)?.turns, 2, '3 turns, 1 turn has already passed this turn');
});

test('Sweet Rain: both sides heal 20%; a withered opponent has its Wither extended by 2 turns', () => {
  const b = syl(['sylvaron_sweet_rain']);
  b.addLasting(1, WITHER, 2, { from: 0 });
  const ev = turn(b, 'sylvaron_sweet_rain', 't_wait');
  assert.deepEqual(witherDmg(ev, 1), [pct(b, 1, 20)]);
  assert.match(texts(ev), /獲得「枯萎」（4 回合）/);
  assert.equal(b.getLasting(1, WITHER)?.turns, 3);
  // No Wither: it is not extended (and the opponent does not wither either)
  const c = syl(['sylvaron_sweet_rain']);
  c.active(1).hp = 100;
  const ev2 = turn(c, 'sylvaron_sweet_rain', 't_wait');
  assert.deepEqual(heals(ev2, 1), [pct(c, 1, 20)], 'without Wither the opponent is healed');
  assert.equal(c.getLasting(1, WITHER), undefined);
});

test('Morning Dew: when the opponent is withered, it heals 15% after the hit (= loses 15%); no extra effect without Wither', () => {
  const b = syl(['sylvaron_morning_dew']);
  b.addLasting(1, WITHER, 2, { from: 0 });
  const ev = turn(b, 'sylvaron_morning_dew', 't_wait');
  assert.deepEqual(witherDmg(ev, 1), [pct(b, 1, 15)]);
  const c = syl(['sylvaron_morning_dew']);
  c.active(1).hp = 100;
  const ev2 = turn(c, 'sylvaron_morning_dew', 't_wait');
  assert.equal(heals(ev2, 1).length, 0);
  assert.equal(witherDmg(ev2, 1).length, 0);
});

test('Photosynthesis: spends all Leaves for 1 Aether each; cannot be used without Leaves', () => {
  const b = syl(['sylvaron_photosynthesis']);
  assert.equal(b.canUse(0, 'sylvaron_photosynthesis').reason, '沒有萬葉');
  setLeaves(b, 3);
  b.side(0).aether = 2;
  b.resolveTurn([use('sylvaron_photosynthesis'), use('t_wait')]);
  assert.equal(leaves(b), 0);
  assert.equal(b.side(0).aether, 2 + 3 + 2, '+3, plus the +2 at the end of the turn');
});

test('Forest Roar: +15 power per Leaf, not consumed; Myriad Storm: +30 per Leaf, consumed after use (even if guarded)', () => {
  const b = syl(['sylvaron_forest_roar', 'sylvaron_leaf_storm']);
  const r0 = b.estimate(0, 'sylvaron_forest_roar');
  const s0 = b.estimate(0, 'sylvaron_leaf_storm');
  setLeaves(b, 4);
  const r4 = b.estimate(0, 'sylvaron_forest_roar');
  const s4 = b.estimate(0, 'sylvaron_leaf_storm');
  // Leaves do not affect the attacker's stats in the estimate; the ratio is about the power ratio
  assert.ok(Math.abs(r4 / r0 - 160 / 100) < 0.03, `Forest Roar ${r0} → ${r4}`);
  assert.ok(Math.abs(s4 / s0 - 210 / 90) < 0.03, `Myriad Storm ${s0} → ${s4}`);
  turn(b, 'sylvaron_forest_roar', 't_wait');
  assert.equal(leaves(b), 4, 'Forest Roar does not consume Leaves');
  turn(b, 'sylvaron_leaf_storm', guard());
  assert.equal(leaves(b), 0, 'Myriad Storm consumes Leaves even when guarded');
});

test('Withering Realm: Grove Domain for 5 turns plus Wither on the opponent side for 4 turns; a spirit that switches in also withers', () => {
  const b = syl(['sylvaron_withering_realm'], true, [
    { id: FOE, skills: FOE_SKILLS },
    { id: FOE, skills: FOE_SKILLS },
  ]);
  turn(b, 'sylvaron_withering_realm', 't_wait');
  assert.equal(b.s.field?.element, 'nature');
  assert.ok(b.side(1).lasting.some((l) => l.key === REALM && l.turns === 3));
  turn(b, 't_wait', sw(1));
  assert.equal(b.side(1).active, 1);
  const ev = turn(b, 't_wait', 't_heal');
  assert.deepEqual(witherDmg(ev, 1), [pct(b, 1, 30), pct(b, 1, 5)], 'the newly entered spirit also withers');
});

test("Eternal Spring (ultimate): after hitting, Wither for 3 turns and both sides heal 20% (the opponent's healing becomes damage); all effects fail when guarded", () => {
  const b = syl([]);
  b.active(0).hp = 200;
  const ev = turn(b, 'u_sylvaron', 't_wait');
  assert.ok(hitsBy(ev, 0).length === 1);
  assert.deepEqual(witherDmg(ev, 1), [pct(b, 1, 20)]);
  assert.deepEqual(heals(ev, 0), [pct(b, 0, 20)]);
  assert.equal(b.getLasting(1, WITHER)?.turns, 2);
  const c = syl([]);
  const ev2 = turn(c, 'u_sylvaron', guard());
  assert.equal(witherDmg(ev2, 1).length, 0);
  assert.equal(c.getLasting(1, WITHER), undefined);
});

test('AI: uses Sweet Rain only when the opponent is withered; uses Myriad Storm when it has many Leaves', async () => {
  const { chooseAction } = await import('../ai.ts');
  const b = syl(['sylvaron_sweet_rain', 'sylvaron_leaf_storm', 'sylvaron_wither_leaf']);
  b.side(0).aether = 5;
  const pick = () => {
    const a = chooseAction(b, 0, { skill: 1 });
    return a.main.type === 'skill' ? a.main.skillId : a.main.type;
  };
  assert.notEqual(pick(), 'sylvaron_sweet_rain', 'no Sweet Rain without Wither');
  b.addLasting(1, WITHER, 3, { from: 0 });
  assert.equal(pick(), 'sylvaron_sweet_rain', 'Sweet Rain when withered');
  setLeaves(b, 5);
  assert.equal(pick(), 'sylvaron_leaf_storm', 'Myriad Storm at 5 Leaves');
});

// ───────────────────────── `banyanelder`: Aerial Roots ─────────────────────────

const { ROOT, ROOT_MAX, TANGLE, SEED } = NATURE_KEYS;
// Opponent: `bubblecrab` (Hard Shell: cannot be crit, so damage is steadier), using test skills
const CRAB = 'bubblecrab';
const roots = (b: Battle, side: SideId = 1) => b.active(side).vars[ROOT] ?? 0;
const setRoots = (b: Battle, n: number, side: SideId = 1) => void (b.active(side).vars[ROOT] = n);

/** `banyanelder` vs `bubblecrab` (the opposing team can be specified) */
function ban(skills: string[], foe: { id: string; skills?: string[] }[] = [{ id: CRAB, skills: FOE_SKILLS }], team: string[] = []): Battle {
  return duel([{ id: 'banyanelder', skills: ['t_wait', ...skills] }, ...team.map((id) => ({ id }))], foe);
}

test('Coiled Roots (rewritten trait): cannot be forcibly switched out, and no longer recovers HP at the end of the turn', () => {
  const b = duel([{ id: 'tornado', skills: ['whirl_in'] }], [{ id: 'banyanelder', skills: ['t_wait'] }, { id: CRAB }]);
  assert.ok(b.active(1).species.traitOverride, 'the trait has been rewritten');
  b.active(1).hp = 500;
  const ev = turn(b, 'whirl_in', 't_wait');
  assert.equal(b.side(1).active, 0, 'was not swept away');
  assert.equal(heals(ev, 1).length, 0, "the old trait's end-of-turn healing is disabled");
});

test("Aerial Roots: with aerial roots present, 1 more grows at the end of each turn (max 4); shown in the Elder Banyan's mark row", () => {
  const b = ban([]);
  turn(b, 't_wait', 't_wait');
  assert.equal(roots(b), 0, 'no roots means none grow on their own');
  setRoots(b, 1);
  turn(b, 't_wait', 't_wait');
  assert.equal(roots(b), 2);
  turn(b, 't_wait', 't_wait');
  turn(b, 't_wait', 't_wait');
  turn(b, 't_wait', 't_wait');
  assert.equal(roots(b), ROOT_MAX, 'at most 4 roots');
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'kit:root' && m.n === 4));
});

test('Aerial Roots: each root lowers damage the opponent deals to Elder Banyan by 5% and raises damage it takes from Elder Banyan by 5%', () => {
  const a = ban([]);
  const b = ban([]);
  setRoots(b, 4);
  const taken0 = hitsBy(turn(a, 't_wait', 't_strike'), 1)[0].dmg;
  const taken4 = hitsBy(turn(b, 't_wait', 't_strike'), 1)[0].dmg;
  assert.ok(Math.abs(taken4 - Math.floor(taken0 * 0.8)) <= 1, `Damage taken −20% (${taken0} → ${taken4})`);
  // Test with magic (the "Bounce Shell" of `bubblecrab` deducts a fixed amount from each hit of a physical attack)
  const c = ban(['t_bolt']);
  const d = ban(['t_bolt']);
  setRoots(d, 4);
  const dealt0 = hitsBy(turn(c, 't_bolt', 't_wait'), 0)[0].dmg;
  const dealt4 = hitsBy(turn(d, 't_bolt', 't_wait'), 0)[0].dmg;
  assert.ok(Math.abs(dealt4 / dealt0 - 1.2) < 0.02, `Damage dealt +20% (${dealt0} → ${dealt4})`);
});

test('Aerial Roots: when the opponent guards successfully, 2 roots snap instead, and Elder Banyan gains 1 Aether per root', () => {
  const b = ban([]);
  setRoots(b, 3);
  b.side(0).aether = 2;
  const ev = b.resolveTurn([use('t_wait'), guard()]);
  assert.equal(roots(b), 1);
  assert.equal(b.side(0).aether, 2 + 2 + 2, '2 roots snapped +2, plus the +2 at the end of the turn');
  assert.match(texts(ev), /掙斷了 2 根氣根/);
  assert.ok(traits(ev).includes('盤根'));
});

test('Aerial Roots: vanish when the opponent or Elder Banyan leaves the field', () => {
  const b = ban([], [{ id: CRAB, skills: FOE_SKILLS }, { id: 'cloudfluff', skills: FOE_SKILLS }]);
  setRoots(b, 3);
  turn(b, 't_wait', sw(1));
  assert.equal(roots(b), 0, 'the spirit the opponent switched in has no roots');
  assert.equal(b.side(1).team[0].vars[ROOT], undefined, "the departed spirit's roots are cleared");
  const c = ban([], [{ id: CRAB, skills: FOE_SKILLS }], [CRAB]);
  setRoots(c, 3);
  turn(c, sw(1), 't_wait');
  assert.equal(roots(c), 0, "when Elder Banyan leaves, the opponent's roots vanish");
});

test('Aerial Root Lash: grows 1 root on hit (1 more at the end of the turn)', () => {
  const b = ban(['banyanelder_root_lash']);
  turn(b, 'banyanelder_root_lash', 't_wait');
  assert.equal(roots(b), 2);
});

test('Strangler Seed: grows 1 root, then 1 extra root per turn for 3 turns; DEF +1; a Decoy blocks it', () => {
  const b = ban(['banyanelder_seed_root']);
  turn(b, 'banyanelder_seed_root', 't_wait');
  assert.equal(roots(b), 3, '1 root, 2 more at the end of the turn');
  assert.equal(b.active(0).stages.def, 1);
  assert.ok(b.view().sides[1].team[0].marks.some((m) => m.id === `fx:${SEED}`), 'Strangler Seed shows in the mark row of the opponent');
  setRoots(b, 4);
  turn(b, 't_wait', guard());
  assert.equal(roots(b), 2, 'guarding still snaps 2 roots');
  turn(b, 't_wait', 't_wait');
  assert.equal(roots(b), 4, 'grows back the next turn');
  const c = ban(['banyanelder_seed_root'], [{ id: CRAB, skills: ['t_substitute', 't_wait'] }]);
  c.active(1).stats.spd = 999;
  const ev = turn(c, 'banyanelder_seed_root', 't_substitute');
  assert.equal(roots(c), 0);
  assert.equal(c.getLasting(1, SEED), undefined);
  assert.match(texts(ev), /替身擋下了氣根/);
});

test('Coiled Root Crush: +10 power per root; Strangle: +15 per root', () => {
  const b = ban(['banyanelder_root_crush', 'banyanelder_strangle']);
  const c0 = b.estimate(0, 'banyanelder_root_crush');
  const s0 = b.estimate(0, 'banyanelder_strangle');
  setRoots(b, 4);
  const c4 = b.estimate(0, 'banyanelder_root_crush');
  const s4 = b.estimate(0, 'banyanelder_strangle');
  // 4 roots give another +20% damage
  assert.ok(Math.abs(c4 / c0 - (115 / 75) * 1.2) < 0.03, `Coiled Root Crush ${c0} → ${c4}`);
  assert.ok(Math.abs(s4 / s0 - (140 / 80) * 1.2) < 0.03, `Strangle ${s0} → ${s4}`);
});

test('Strangle: ignores guard at 4 roots, is blocked at 3 roots', () => {
  const b = ban(['banyanelder_strangle']);
  setRoots(b, 3);
  assert.equal(hitsBy(turn(b, 'banyanelder_strangle', guard()), 0).length, 0, '3 roots: guarded');
  const c = ban(['banyanelder_strangle']);
  setRoots(c, 4);
  const ev = turn(c, 'banyanelder_strangle', guard());
  assert.equal(hitsBy(ev, 0).length, 1, '4 roots: ignores guard');
  assert.equal(roots(c), 2, 'guarding still snaps 2 roots');
});

test('Hanging Root: power ×2 when the opponent guarded last turn (it cannot guard again this turn)', () => {
  const a = ban(['banyanelder_hanging_root']);
  const d1 = hitsBy(turn(a, 'banyanelder_hanging_root', 't_wait'), 0)[0].dmg;
  const b = ban(['banyanelder_hanging_root']);
  turn(b, 't_wait', guard());
  assert.ok(b.estimate(0, 'banyanelder_hanging_root') > a.estimate(0, 'banyanelder_hanging_root') * 1.8, 'the estimate at selection time is also ×2');
  const d2 = hitsBy(turn(b, 'banyanelder_hanging_root', 't_wait'), 0)[0].dmg;
  assert.ok(d2 > d1 * 1.8, `${d1} → ${d2}`);
  const d3 = hitsBy(turn(b, 'banyanelder_hanging_root', 't_wait'), 0)[0].dmg;
  assert.ok(d3 < d1 * 1.2, 'a guard two turns ago does not count');
});

test('Thousand Roots: hits 3 times, grows 1 root on hit and Entangles (6%)', () => {
  const b = ban(['root_bind']);
  const ev = turn(b, 'root_bind', 't_wait');
  assert.equal(hitsBy(ev, 0).length, 3);
  assert.equal(roots(b), 2, '1 root, 1 more at the end of the turn');
  assert.equal(b.active(1).bound?.pct, 6);
});

test('Snaring Roots (Quick): at the end of a turn where the opponent did not attack, the roots grow to 4 and Entangle; does not fire when the opponent attacks', () => {
  const b = ban(['banyanelder_root_snare']);
  setRoots(b, 1);
  b.resolveTurn([use('t_wait', 'banyanelder_root_snare'), use('t_strike')]);
  assert.equal(roots(b), 2, 'the opponent attacked: only the usual 1 root grows');
  assert.ok(b.side(0).trap, 'the trap is still set');
  const ev = turn(b, 't_wait', guard());
  assert.match(texts(ev), /掙斷了 2 根氣根/);
  assert.equal(roots(b), ROOT_MAX, 'after a guard snaps roots, the trap fires and refills them');
  assert.equal(b.active(1).bound?.pct, 4);
  assert.equal(b.side(0).trap, null);
  // Quick: it can fire on the turn it is set (the opponent boosting or healing also counts as not attacking)
  const c = ban(['banyanelder_root_snare']);
  c.resolveTurn([use('t_wait', 'banyanelder_root_snare'), use('t_heal')]);
  assert.equal(roots(c), ROOT_MAX);
});

test('Growth Rings: ATK and DEF +1 each; +2 each when the opponent has 4 roots', () => {
  const b = ban(['banyanelder_growth_rings']);
  turn(b, 'banyanelder_growth_rings', 't_wait');
  assert.deepEqual([b.active(0).stages.atk, b.active(0).stages.def], [1, 1]);
  const c = ban(['banyanelder_growth_rings']);
  setRoots(c, 4);
  turn(c, 'banyanelder_growth_rings', 't_wait');
  assert.deepEqual([c.active(0).stages.atk, c.active(0).stages.def], [2, 2]);
});

test('Falling Trunk: 25% recoil; no recoil when the opponent has 3 or more roots', () => {
  const b = ban(['banyanelder_felled_trunk']);
  const ev = turn(b, 'banyanelder_felled_trunk', 't_wait');
  const dealt = hitsBy(ev, 0)[0].dmg;
  const recoil = ev.filter((e) => e.k === 'damage' && e.reason === 'recoil' && e.target === 0);
  assert.equal(recoil.length, 1);
  assert.equal((recoil[0] as { dmg: number }).dmg, Math.floor(dealt * 0.25));
  const c = ban(['banyanelder_felled_trunk']);
  setRoots(c, 3);
  const ev2 = turn(c, 'banyanelder_felled_trunk', 't_wait');
  assert.equal(ev2.filter((e) => e.k === 'damage' && e.reason === 'recoil').length, 0);
});

test('Uproot: spends all roots, and each root makes the opponent lose 6% max HP', () => {
  const b = ban(['banyanelder_uproot']);
  setRoots(b, 4);
  const ev = turn(b, 'banyanelder_uproot', 't_wait');
  const squeeze = ev.filter((e) => e.k === 'damage' && e.reason === 'bind' && e.target === 1).map((e) => (e as { dmg: number }).dmg);
  assert.deepEqual(squeeze, [pct(b, 1, 24)]);
  assert.equal(roots(b), 0, 'no more growth after uprooting');
});

test('Gnarled Knot: roots grow to 4, guarding cannot snap them for 3 turns; ATK +1', () => {
  const b = ban(['banyanelder_tangle']);
  turn(b, 'banyanelder_tangle', 't_wait');
  assert.equal(roots(b), ROOT_MAX);
  assert.equal(b.active(0).stages.atk, 1);
  assert.equal(b.getLasting(1, TANGLE)?.turns, 2);
  assert.ok(b.view().sides[1].team[0].marks.some((m) => m.id === `fx:${TANGLE}`), 'shown in the mark row of the opponent');
  const ev = turn(b, 't_wait', guard());
  assert.equal(roots(b), ROOT_MAX, 'guard cannot snap them');
  assert.match(texts(ev), /掙不斷氣根/);
});

test('One Tree, a Forest (ultimate): +30 power per root, ignores guard', () => {
  const b = ban([]);
  const u0 = b.estimate(0, 'u_banyanelder');
  setRoots(b, 4);
  const u4 = b.estimate(0, 'u_banyanelder');
  assert.ok(Math.abs(u4 / u0 - (230 / 110) * 1.2) < 0.03, `${u0} → ${u4}`);
  const ev = turn(b, 'u_banyanelder', guard());
  assert.equal(hitsBy(ev, 0).length, 1, 'ignores guard');
});

test('AI: plants Strangler Seed first when there are no roots, uses Strangle at 4 roots; the opponent AI considers guarding to break free when there are many roots', async () => {
  const { chooseAction } = await import('../ai.ts');
  const b = ban(['banyanelder_seed_root', 'banyanelder_strangle', 'banyanelder_root_lash']);
  b.side(0).aether = 4;
  const pick = () => {
    const a = chooseAction(b, 0, { skill: 1 });
    return a.main.type === 'skill' ? a.main.skillId : a.main.type;
  };
  assert.equal(pick(), 'banyanelder_seed_root', 'Strangler Seed first when there are no roots');
  setRoots(b, 4);
  assert.equal(pick(), 'banyanelder_strangle', 'Strangle at 4 roots');
  const { KIT } = await import('./nature.ts');
  assert.ok((KIT.banyanelder.aiFoeGuard?.(b, 0, 0) ?? 0) > 0, 'at 4 roots the opponent AI wants to guard more');
  b.addLasting(1, TANGLE, 3, { from: 0 });
  assert.ok((KIT.banyanelder.aiFoeGuard?.(b, 0, 0) ?? 0) < 0, 'guarding is useless during Gnarled Knot');
});

test("AI: with no roots, opens with Thousand Roots if it has it (Entangle first, then Strangler Seed), so Strangler Seed does not take over the flagship skill's opening", async () => {
  const { chooseAction } = await import('../ai.ts');
  const b = ban(['banyanelder_seed_root', 'root_bind', 'banyanelder_root_lash']);
  b.side(0).aether = 4;
  b.side(1).aether = 0;
  const a = chooseAction(b, 0, { skill: 1 });
  assert.equal(a.main.type === 'skill' ? a.main.skillId : a.main.type, 'root_bind');
});

// ───────────────────────── `elderwood_warden`: Ancient Bark Shield ─────────────────────────

const { WOOD_CAP, SEEN } = NATURE_KEYS;
// Opponent: `monolith` (no kit hooks; its old trait "Firm Stone" only fires when taking lethal damage at full HP), using test skills
const MONO = 'monolith';
/** Wood shield (a percentage of max HP, rounded) */
const wood = (b: Battle, side: SideId = 0) => {
  const c = b.active(side);
  return c.shield ? Math.round((c.shield.amount / c.maxHp) * 100) : 0;
};

/** `elderwood_warden` vs `monolith` */
function ward(skills: string[], foe: { id: string; skills?: string[] }[] = [{ id: MONO, skills: FOE_SKILLS }]): Battle {
  return duel([{ id: 'elderwood_warden', skills: ['t_wait', 't_strike', ...skills] }], foe);
}

test("Forest's Shelter (rewritten trait): gains a 10% wood shield at the end of a turn with no attack, and none on an attacking turn; no longer heals", () => {
  const b = ward([]);
  assert.ok(b.active(0).species.traitOverride, 'the trait has been rewritten');
  b.active(0).hp = 500;
  let ev = turn(b, 't_wait', 't_wait');
  assert.equal(wood(b), 10);
  assert.ok(traits(ev).includes('森之庇護'));
  assert.equal(heals(ev, 0).length, 0, "the old trait's end-of-turn healing is disabled");
  ev = turn(b, 't_strike', 't_wait');
  assert.equal(wood(b), 10, 'not gained on an attacking turn (the earlier wood shield remains)');
  assert.ok(!traits(ev).includes('森之庇護'));
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'kit:wood' && m.n === 10 && m.note === '木盾 10%'), 'wood shield shows in the mark row');
});

test('Wood shield: stacks up to 50%; dissolves if not gained again for 3 turns', () => {
  const b = ward(['elderwood_warden_shoulder_log']);
  turn(b, 'elderwood_warden_shoulder_log', 't_wait');
  assert.equal(wood(b), 45, 'Shoulder the Log 35% + trait 10% (an ordinary shield keeps the larger value, the wood shield stacks)');
  turn(b, 'elderwood_warden_shoulder_log', 't_wait');
  assert.equal(wood(b), WOOD_CAP, 'at most 50%');
  turn(b, 't_strike', 't_wait');
  assert.equal(wood(b), WOOD_CAP);
  turn(b, 't_strike', 't_wait');
  assert.equal(wood(b), 0, 'dissolves 3 turns after it was gained');
});

test('Log Slam: +2 power per 1% of wood shield, spends all of it; wood shield knocked off earlier this turn counts too', () => {
  const a = ward(['elderwood_warden_log_slam']);
  const e0 = a.estimate(0, 'elderwood_warden_log_slam');
  const b = ward(['elderwood_warden_shoulder_log', 'elderwood_warden_log_slam']);
  turn(b, 'elderwood_warden_shoulder_log', 't_wait');
  const e45 = b.estimate(0, 'elderwood_warden_log_slam');
  assert.ok(Math.abs(e45 / e0 - 130 / 40) < 0.05, `45% wood shield: power 40 → 130 (${e0} → ${e45})`);
  // The opponent moves first and knocks the wood shield down to 5%: it still counts the 45% from the end of last turn
  b.active(0).shield!.amount = Math.floor(b.active(0).maxHp * 0.05);
  assert.equal(b.estimate(0, 'elderwood_warden_log_slam'), e45, 'wood shield knocked off earlier this turn counts too');
  const ev = turn(b, 'elderwood_warden_log_slam', 't_wait');
  assert.equal(hitsBy(ev, 0).length, 1);
  assert.equal(wood(b), 0, 'spends all the wood shield');
  assert.match(texts(ev), /把整面木盾砸了出去/);
  assert.equal(b.estimate(0, 'elderwood_warden_log_slam'), e0, 'no bonus after slamming');
  // Spent even if guarded
  const c = ward(['elderwood_warden_log_slam']);
  c.giveShield(0, 30);
  assert.equal(hitsBy(turn(c, 'elderwood_warden_log_slam', guard()), 0).length, 0);
  assert.equal(wood(c), 0, 'slammed away even when guarded');
});

test('Ancient Log Crash: +5 power per 2% of wood shield (power 200 at a full 50%)', () => {
  const b = ward(['elderwood_warden_ancient_slam']);
  const e0 = b.estimate(0, 'elderwood_warden_ancient_slam');
  b.giveShield(0, 50);
  const e50 = b.estimate(0, 'elderwood_warden_ancient_slam');
  assert.ok(Math.abs(e50 / e0 - 200 / 75) < 0.05, `${e0} → ${e50}`);
  turn(b, 'elderwood_warden_ancient_slam', 't_wait');
  assert.equal(wood(b), 0);
});

test('Paw Swipe, Bark Charge: gain 5% / 15% wood shield after hitting (stacking); none when guarded', () => {
  const b = ward(['elderwood_warden_paw_swipe', 'elderwood_warden_bark_charge']);
  turn(b, 'elderwood_warden_paw_swipe', 't_wait');
  assert.equal(wood(b), 5);
  turn(b, 'elderwood_warden_bark_charge', 't_wait');
  assert.equal(wood(b), 20);
  turn(b, 'elderwood_warden_bark_charge', guard());
  assert.equal(wood(b), 20, 'guarded: no wood shield');
});

test("Shoulder the Log, Thousand-Layer Moss, Guardian Heart, Grove Roar: each one's wood shield amount and extra effect", () => {
  const b = ward(['elderwood_warden_moss_layers']);
  turn(b, 'elderwood_warden_moss_layers', 't_wait');
  assert.equal(wood(b), 45, '35% + trait 10%');
  assert.equal(b.active(0).stages.def, 1);
  const c = ward(['elderwood_warden_guardian_heart']);
  c.applyStatus(0, 'burn');
  assert.ok(c.active(0).status.burn);
  turn(c, 'elderwood_warden_guardian_heart', 't_wait');
  assert.equal(c.active(0).status.burn, undefined, 'Cleanse');
  assert.equal(wood(c), 35, '25% + trait 10%');
  const d = ward(['elderwood_warden_roar']);
  turn(d, 'elderwood_warden_roar', 't_wait');
  assert.ok(d.active(1).status.taunt, 'Taunt');
  assert.equal(wood(d), 25, '15% + trait 10%');
});

test("Warden's Stand: damage −30% when Elderwood Warden is attacked, then gains a 15% wood shield", () => {
  const a = ward([]);
  turn(a, 't_strike', 't_wait');
  const d0 = hitsBy(turn(a, 't_strike', 't_strike'), 1)[0].dmg;
  const b = ward(['elderwood_warden_ward_snare']);
  turn(b, use('t_strike', 'elderwood_warden_ward_snare'), 't_wait');
  assert.ok(b.side(0).trap, 'the opponent did not attack: the trap is still set');
  const ev = turn(b, 't_strike', 't_strike');
  const d1 = hitsBy(ev, 1)[0].dmg;
  assert.ok(ev.some((e) => e.k === 'trap' && e.side === 0));
  assert.ok(Math.abs(d1 / d0 - 0.7) < 0.08, `Damage −30% (${d0} → ${d1})`);
  assert.equal(wood(b), 15, "no trait wood shield on an attacking turn, only the trap's 15%");
});

test('Mountain Anchor: ignores guard while it has wood shield, and does not spend it', () => {
  const b = ward(['elderwood_warden_mountain_slam']);
  assert.equal(hitsBy(turn(b, 'elderwood_warden_mountain_slam', guard()), 0).length, 0, 'no wood shield: guarded');
  const c = ward(['elderwood_warden_mountain_slam']);
  c.giveShield(0, 20);
  assert.equal(hitsBy(turn(c, 'elderwood_warden_mountain_slam', guard()), 0).length, 1, 'with wood shield: ignores guard');
  assert.equal(wood(c), 20, 'does not spend the wood shield');
});

test('Thousand-Year Ward (ultimate): +3 power per 1% of wood shield, then shoulders a 30% wood shield again; no re-shouldering when guarded', () => {
  const b = ward([]);
  const u0 = b.estimate(0, 'u_elderwood_warden');
  b.giveShield(0, 40);
  const u40 = b.estimate(0, 'u_elderwood_warden');
  assert.ok(Math.abs(u40 / u0 - 230 / 110) < 0.05, `${u0} → ${u40}`);
  turn(b, 'u_elderwood_warden', 't_wait');
  assert.equal(wood(b), 30);
  const c = ward([]);
  c.giveShield(0, 40);
  turn(c, 'u_elderwood_warden', guard());
  assert.equal(wood(c), 0, 'the wood shield is still slammed away, but not shouldered again');
});

test('AI: Shoulder the Log first when there is no wood shield, Ancient Log Crash when there is plenty', async () => {
  const { chooseAction } = await import('../ai.ts');
  const b = ward(['elderwood_warden_shoulder_log', 'elderwood_warden_ancient_slam', 'elderwood_warden_paw_swipe']);
  b.side(0).aether = 4;
  b.side(1).aether = 0; // The opponent cannot use an ultimate: the AI will not want to guard
  const pick = () => {
    const a = chooseAction(b, 0, { skill: 1 });
    return a.main.type === 'skill' ? a.main.skillId : a.main.type;
  };
  assert.equal(pick(), 'elderwood_warden_shoulder_log', 'Shoulder the Log when there is no wood shield');
  b.giveShield(0, 45);
  assert.equal(pick(), 'elderwood_warden_ancient_slam', 'slam at 45% wood shield');
});

// ───────────────────────── `owlarchivist`: See-Through ─────────────────────────

/** The skill of the opponent that is seen through */
const seen = (b: Battle) => {
  const i = b.active(1).vars[SEEN] ?? 0;
  return i > 0 ? b.active(1).skills[i - 1] : undefined;
};

/** `owlarchivist` vs `monolith` (opponent skills: t_wait, t_heal, t_strike, t_bolt; it sees through t_strike at the start) */
function owl(skills: string[], foe: { id: string; skills?: string[] }[] = [{ id: MONO, skills: FOE_SKILLS }], team: string[] = []): Battle {
  return duel([{ id: 'owlarchivist', skills: ['t_wait', 't_bolt', ...skills] }, ...team.map((id) => ({ id }))], foe);
}

test("Record (rewritten trait): on entering, sees through the opponent's skill (the highest-power attack skill if it has used none); shown in the Archive Owl's mark row", () => {
  const b = owl([]);
  assert.ok(b.active(0).species.traitOverride, 'the trait has been rewritten');
  assert.equal(seen(b), 't_strike');
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'kit:insight' && m.note === '看穿：t_strike'));
  // Switched in midway: sees through the opponent's last used skill
  const c = duel([{ id: CRAB, skills: ['t_wait'] }, { id: 'owlarchivist', skills: ['t_wait'] }], [{ id: MONO, skills: FOE_SKILLS }]);
  turn(c, 't_wait', 't_heal');
  const ev = turn(c, sw(1), 't_wait');
  assert.ok(traits(ev).includes('記錄'));
  assert.equal(seen(c), 't_heal', "when switching in, the opponent's last used skill is t_heal (this turn's t_wait comes after the switch)");
});

test('See-Through: damage −40% when the seen-through skill hits Archive Owl, other skills are unaffected', () => {
  const a = owl([]);
  delete a.active(1).vars[SEEN];
  const b = owl([]);
  const d0 = hitsBy(turn(a, 't_wait', 't_strike'), 1)[0].dmg;
  const d1 = hitsBy(turn(b, 't_wait', 't_strike'), 1)[0].dmg;
  assert.ok(Math.abs(d1 - Math.floor(d0 * 0.6)) <= 1, `${d0} → ${d1}`);
  const c = owl([]);
  delete c.active(1).vars[SEEN];
  const d = owl([]);
  assert.equal(hitsBy(turn(d, 't_wait', 't_bolt'), 1)[0].dmg, hitsBy(turn(c, 't_wait', 't_bolt'), 1)[0].dmg, 'skills not seen through work as usual');
});

test('See-Through: at the end of a turn where the opponent uses the seen-through skill, it is sealed for 2 turns and the See-Through ends', () => {
  const b = owl([]);
  const ev0 = turn(b, 't_wait', 't_bolt');
  assert.equal(seen(b), 't_strike', 'using other skills does not trigger it');
  assert.ok(!traits(ev0).includes('看穿'));
  const ev = turn(b, 't_wait', 't_strike');
  assert.ok(traits(ev).includes('看穿'));
  assert.match(texts(ev), /「t_strike」被封印了/);
  assert.equal(seen(b), undefined, 'See-Through ends');
  assert.equal(b.canUse(1, 't_strike').ok, false);
  turn(b, 't_wait', 't_bolt');
  assert.equal(b.canUse(1, 't_strike').ok, false, 'still sealed on turn 2');
  turn(b, 't_wait', 't_bolt');
  assert.equal(b.canUse(1, 't_strike').ok, true, 'unsealed after 2 turns');
});

test('See-Through: only one at a time; vanishes when the opponent or Archive Owl leaves the field; never sees through an ultimate', () => {
  const b = owl(['owlarchivist_record'], [{ id: MONO, skills: FOE_SKILLS }, { id: 'cloudfluff', skills: FOE_SKILLS }], [CRAB]);
  b.active(0).stats.spd = 999;
  turn(b, 't_wait', 't_heal');
  turn(b, 'owlarchivist_record', 't_wait');
  assert.equal(seen(b), 't_heal', 'the new one replaces the old t_strike');
  turn(b, 't_wait', sw(1));
  assert.equal(seen(b), undefined, 'the spirit the opponent switched in is not seen through');
  assert.equal(b.side(1).team[0].vars[SEEN], undefined, "the departed spirit's See-Through is cleared");
  const c = owl([], [{ id: MONO, skills: FOE_SKILLS }], [CRAB]);
  turn(c, sw(1), 't_wait');
  assert.equal(seen(c), undefined, 'See-Through vanishes when Archive Owl leaves');
  const d = owl(['owlarchivist_record']);
  d.active(1).lastSkill = d.active(1).species.ultimate;
  turn(d, 'owlarchivist_record', 't_wait');
  assert.equal(seen(d), 't_strike', 'when the last skill was an ultimate, it sees through the highest-power attack skill instead');
});

test("Record, Racing Quill, Rain of Words: see through the opponent's last used skill; not when the attack is guarded", () => {
  const b = owl(['owlarchivist_record', 'owlarchivist_quill', 'owlarchivist_word_rain']);
  b.active(0).stats.spd = 999;
  turn(b, 't_wait', 't_bolt');
  turn(b, 'owlarchivist_quill', 't_heal');
  assert.equal(seen(b), 't_bolt', 'Racing Quill');
  const ev = turn(b, 'owlarchivist_word_rain', 't_wait');
  assert.equal(hitsBy(ev, 0).length, 3, 'Rain of Words hits 3 times');
  assert.equal(seen(b), 't_heal', 'Rain of Words');
  turn(b, 'owlarchivist_record', 't_heal');
  assert.equal(seen(b), 't_wait', 'Record (the t_heal the opponent used next is not the seen-through skill)');
  const c = owl(['owlarchivist_quill']);
  turn(c, 't_wait', 't_bolt');
  turn(c, 'owlarchivist_quill', guard());
  assert.equal(seen(c), 't_strike', 'guarded: no new skill seen through');
});

test('Night Reading / Decipher / Night Patrol: power +40 / +60 / +30 when an opponent skill is sealed; Decipher extends the seal by 1 turn', () => {
  const ids = ['owlarchivist_night_reading', 'owlarchivist_decipher', 'owlarchivist_night_patrol'];
  const b = owl(ids);
  const e0 = ids.map((id) => b.estimate(0, id));
  turn(b, 't_wait', 't_strike');
  const e1 = ids.map((id) => b.estimate(0, id));
  const want = [120 / 80, 155 / 95, 80 / 50];
  ids.forEach((id, i) => assert.ok(Math.abs(e1[i] / e0[i] - want[i]) < 0.05, `${id}: ${e0[i]} → ${e1[i]}`));
  const f = b.active(1);
  const t0 = f.disabled!.turns;
  const ev = turn(b, 'owlarchivist_decipher', 't_bolt');
  assert.equal(f.disabled?.turns, t0 + 1);
  assert.match(texts(ev), /封印延長了 1 回合/);
});

test("Foreshadow: negates the opponent's seen-through attack skill (it is still sealed); other attacks do not trigger it", () => {
  const b = owl(['owlarchivist_foreshadow']);
  b.resolveTurn([use('t_wait', 'owlarchivist_foreshadow'), use('t_wait')]);
  let ev = b.resolveTurn([use('t_wait'), use('t_bolt')]);
  assert.equal(hitsBy(ev, 1).length, 1, 't_bolt not seen through: hits as usual');
  assert.ok(b.side(0).trap, 'the trap is still set');
  ev = b.resolveTurn([use('t_wait'), use('t_strike')]);
  assert.equal(hitsBy(ev, 1).length, 0, 'the seen-through t_strike is negated');
  assert.match(texts(ev), /早就寫在書上了/);
  assert.equal(b.side(0).trap, null);
  assert.equal(b.canUse(1, 't_strike').ok, false, 'used: still sealed at the end of the turn');
});

test("Sealing Scroll: after hitting, seals the seen-through skill for 2 turns without ending See-Through (it is still seen through once unsealed); with no See-Through it seals the opponent's last used skill; no effect when guarded", () => {
  const b = owl(['seal_scroll']);
  b.active(0).stats.spd = 999;
  turn(b, 't_wait', 't_bolt');
  const ev = turn(b, 'seal_scroll', 't_bolt');
  assert.equal(hitsBy(ev, 0).length, 1);
  assert.equal(b.canUse(1, 't_strike').ok, false, 'what is sealed is the seen-through t_strike, not the last used t_bolt');
  assert.equal(b.canUse(1, 't_bolt').ok, true);
  assert.equal(seen(b), 't_strike', 'See-Through is not ended');
  turn(b, 't_wait', 't_bolt');
  assert.equal(b.canUse(1, 't_strike').ok, false, 'still sealed on turn 2');
  turn(b, 't_wait', 't_bolt');
  assert.equal(b.canUse(1, 't_strike').ok, true, 'unsealed after 2 turns');
  const ev2 = turn(b, 't_wait', 't_strike');
  assert.ok(traits(ev2).includes('看穿'), 'used again after unsealing: still seen through');
  assert.equal(b.canUse(1, 't_strike').ok, false, 'sealed again after use');
  assert.equal(seen(b), undefined, 'only now does the See-Through end');
  const c = owl(['seal_scroll']);
  delete c.active(1).vars[SEEN];
  c.active(1).stats.spd = 999;
  turn(c, 'seal_scroll', 't_bolt');
  assert.equal(c.canUse(1, 't_bolt').ok, false, "no See-Through: seals the opponent's last used skill");
  const d = owl(['seal_scroll']);
  turn(d, 'seal_scroll', guard());
  assert.equal(d.canUse(1, 't_strike').ok, true);
  assert.equal(seen(d), 't_strike', 'guarded: See-Through remains');
});

test('Millennial Seal (ultimate): after hitting, seals the seen-through skill for 3 turns without ending See-Through (it sees through first when there is none); no effect when guarded', () => {
  const b = owl([]);
  b.active(0).stats.spd = 999;
  turn(b, 't_wait', 't_bolt');
  turn(b, 'u_owlarchivist', 't_heal');
  assert.equal(b.active(1).disabled?.skill, 't_strike', 'seals the seen-through t_strike, not the last used t_bolt');
  assert.equal(b.active(1).disabled?.turns, b.s.turn + 3);
  assert.equal(seen(b), 't_strike', 'See-Through is not ended');
  const a = owl([]);
  a.active(0).stats.spd = 999;
  delete a.active(1).vars[SEEN];
  turn(a, 't_wait', 't_bolt');
  turn(a, 'u_owlarchivist', 't_heal');
  assert.equal(a.active(1).disabled?.skill, 't_bolt', 'no See-Through: first sees through the last used t_bolt, then seals it');
  const c = owl([]);
  turn(c, 'u_owlarchivist', guard());
  assert.equal(c.active(1).disabled, null);
  assert.equal(seen(c), 't_strike');
});

test('AI: Sealing Scroll when something is seen through, Decipher when the opponent is sealed; the ultimate only when the opponent cannot guard', async () => {
  const { chooseAction } = await import('../ai.ts');
  const { FX } = await import('./nature.ts');
  const b = owl(['seal_scroll', 'owlarchivist_decipher']);
  b.side(0).aether = 5;
  b.side(1).aether = 0; // The opponent cannot use an ultimate: the AI will not want to guard
  const pick = () => {
    const a = chooseAction(b, 0, { skill: 1 });
    return a.main.type === 'skill' ? a.main.skillId : a.main.type;
  };
  assert.equal(pick(), 'seal_scroll', 'something seen through, nothing sealed yet: Sealing Scroll');
  turn(b, 't_wait', 't_strike');
  b.side(0).aether = 5;
  b.side(1).aether = 0;
  assert.equal(pick(), 'owlarchivist_decipher', 'opponent sealed: Decipher');
  const ult = FX.u_owlarchivist.aiScore!;
  assert.ok(ult(b, 0, 0) < 0, 'no ultimate when the opponent can guard');
  b.side(1).aether = 10;
  turn(b, 't_wait', guard());
  assert.ok(ult(b, 0, 0) > 0, 'ultimate when the opponent guarded last turn (it cannot guard this turn)');
});

// ───────────────────────── `dreamcap`: Phantom Spores ─────────────────────────

const { FRUIT, FRUIT_MAX, ECHO } = NATURE_KEYS;
const poison = (b: Battle, side: SideId = 1) => b.active(side).status.poison?.stacks ?? 0;
/** Number of times the opponent failed to act this turn because it was asleep */
const asleep = (ev: BattleEvent[], side: SideId = 1) => ev.filter((e) => e.k === 'fail' && e.side === side && e.reason === '睡著了……').length;
/** How many turns it slept in total after Enter Dream (including the turn of Enter Dream) */
function sleepLen(b: Battle, first: BattleEvent[]): number {
  let n = asleep(first);
  for (let i = 0; i < 5 && b.active(1).status.sleep; i++) n += asleep(turn(b, 't_wait', 't_wait'));
  return n;
}

/** `dreamcap` vs `monolith` (earth element: can be poisoned, can fall asleep) */
function shroom(skills: string[], foe: { id: string; skills?: string[] }[] = [{ id: MONO, skills: FOE_SKILLS }]): Battle {
  return duel([{ id: 'dreamcap', skills: ['t_wait', 't_bolt', ...skills] }], foe);
}

test('Phantom Spores (Dream Dust): when the opponent has 3 or more Poison stacks, spends 3 to put it to Sleep for 3 turns; with fewer than 3 stacks nothing happens and nothing is spent', () => {
  const b = shroom(['dreamcap_dream_dust']);
  b.applyStatus(1, 'poison', 2);
  let ev = turn(b, 'dreamcap_dream_dust', 't_wait');
  assert.equal(b.active(1).status.sleep, undefined, '2 stacks: it cannot fall asleep');
  assert.equal(poison(b), 2, 'nothing spent');
  assert.match(texts(ev), /毒還不夠深/);
  b.applyStatus(1, 'poison', 2);
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'kit:spore' && m.n === 4), "the opponent's Poison stacks show in the Dreamveil Matron's mark row");
  ev = turn(b, 'dreamcap_dream_dust', 't_strike');
  assert.equal(poison(b), 1, '4 stacks − 3 stacks');
  assert.match(texts(ev), /沉入夢中/);
  // Sleeps 3 turns: `monolith` is slower, so it sleeps through the 1st turn in the same turn; 3 failed actions in total, then it wakes and acts
  let slept = asleep(ev);
  for (let i = 0; i < 3; i++) slept += asleep(turn(b, 't_wait', 't_strike'));
  assert.equal(slept, 3, 'Sleep for 3 turns (ordinary Sleep is 2 turns)');
  assert.equal(b.active(1).status.sleep, undefined, 'woke up');
  // Cannot fall asleep (toughness): nothing is spent
  const c = shroom(['dreamcap_dream_dust']);
  c.applyStatus(1, 'poison', 3);
  c.active(1).toughness = 2;
  turn(c, 'dreamcap_dream_dust', 't_wait');
  assert.equal(c.active(1).status.sleep, undefined);
  assert.equal(poison(c), 3, 'if it cannot fall asleep, nothing is spent');
});

test('Dreamveil Cloud: Enter Dream after hitting; no effect when guarded', () => {
  const b = shroom(['dreamcap_dream_cloud']);
  b.applyStatus(1, 'poison', 3);
  const ev = turn(b, 'dreamcap_dream_cloud', 't_wait');
  assert.equal(hitsBy(ev, 0).length, 1);
  assert.equal(poison(b), 0);
  assert.equal(sleepLen(b, ev), 3, 'damage resolves first, and only then does it fall asleep (this hit does not wake it)');
  const c = shroom(['dreamcap_dream_cloud']);
  c.applyStatus(1, 'poison', 3);
  turn(c, 'dreamcap_dream_cloud', guard());
  assert.equal(c.active(1).status.sleep, undefined);
  assert.equal(poison(c), 3);
  // With fewer than 3 stacks it is treated as an ordinary attack, with no hint
  const d = shroom(['dreamcap_dream_cloud']);
  assert.doesNotMatch(texts(turn(d, 'dreamcap_dream_cloud', 't_wait')), /毒還不夠深/);
});

test('Rude Awakening: hitting a sleeping opponent wakes it and poisons it for 3 stacks; against an awake opponent it is an ordinary attack', () => {
  const b = shroom(['dreamcap_rude_awakening']);
  b.applyStatus(1, 'sleep');
  turn(b, 'dreamcap_rude_awakening', 't_wait');
  assert.equal(b.active(1).status.sleep, undefined, 'woke up');
  assert.equal(poison(b), 3);
  const c = shroom(['dreamcap_rude_awakening']);
  turn(c, 'dreamcap_rude_awakening', 't_wait');
  assert.equal(poison(c), 0);
});

test('Spore Coat: for 4 turns, an opponent that hits Dreamveil Matron with an attack (physical or magic) is poisoned for 2 stacks', () => {
  const b = shroom(['dreamcap_spore_coat']);
  turn(b, 'dreamcap_spore_coat', 't_wait');
  assert.equal(poison(b), 0);
  turn(b, 't_wait', 't_bolt');
  assert.equal(poison(b), 2, 'magic counts too');
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'fx:dreamcap_spore_coat'), "Spore Coat shows in the Dreamveil Matron's mark row");
  turn(b, 't_wait', 't_wait');
  turn(b, 't_wait', 't_wait');
  assert.equal(b.getLasting(0, 'dreamcap_spore_coat'), undefined, 'gone after 4 turns');
  turn(b, 't_wait', 't_bolt');
  assert.ok(poison(b) <= 2, 'no more Poison once it is gone');
});

test('Fairy Ring: when an opponent with 3 or more Poison stacks attacks, that attack is negated and it Enters Dream; with fewer than 3 stacks it does not fire', () => {
  const b = shroom(['dreamcap_fairy_ring']);
  b.resolveTurn([use('t_wait', 'dreamcap_fairy_ring'), use('t_wait')]);
  b.applyStatus(1, 'poison', 2);
  let ev = b.resolveTurn([use('t_wait'), use('t_strike')]);
  assert.equal(hitsBy(ev, 1).length, 1, '2 stacks: hits as usual');
  assert.ok(b.side(0).trap, 'the trap is still set');
  b.applyStatus(1, 'poison', 1);
  ev = b.resolveTurn([use('t_wait'), use('t_strike')]);
  assert.equal(hitsBy(ev, 1).length, 0, '3 stacks: the attack is negated');
  assert.match(texts(ev), /踩進了菌圈/);
  assert.equal(poison(b), 0);
  assert.ok(b.active(1).status.sleep, 'Entered Dream');
  assert.equal(b.side(0).trap, null);
});

test('Dreamveil Matron (ultimate): after hitting, Poison 3 stacks then Enter Dream (it can fall asleep even if it was not poisoned)', () => {
  const b = shroom([]);
  const ev = turn(b, 'u_dreamcap', 't_wait');
  assert.equal(poison(b), 0, 'the 3 stacks of Poison just applied are all turned into Sleep');
  assert.equal(sleepLen(b, ev), 3);
});

test('AI (Dreamveil Matron): uses Dream Dust when it can Enter Dream, not with fewer than 3 stacks; does not guard against a sleeping opponent and does not wake it up', async () => {
  const { chooseAction } = await import('../ai.ts');
  const { KIT } = await import('./nature.ts');
  const b = shroom(['dreamcap_dream_dust', 'toxic_spores', 'dreamcap_spore_shot']);
  b.side(1).aether = 0;
  const pick = () => {
    const a = chooseAction(b, 0, { skill: 1 });
    return a.main.type === 'skill' ? a.main.skillId : a.main.type;
  };
  assert.notEqual(pick(), 'dreamcap_dream_dust', 'no Enter Dream when not poisoned');
  b.applyStatus(1, 'poison', 3);
  assert.equal(pick(), 'dreamcap_dream_dust', '3 stacks: Enter Dream');
  b.applyStatus(1, 'sleep', undefined, 3);
  assert.ok((KIT.dreamcap.aiGuard?.(b, 0, 0) ?? 0) < 0, 'no need to guard against a sleeping opponent');
  const { FX } = await import('./nature.ts');
  assert.ok((FX.dreamcap_spore_shot.aiScore?.(b, 0, 0) ?? 0) < 0, 'when the opponent will sleep for several more turns, does not use Spore Shot to wake it');
});

// ───────────────────────── `acornsquirrel`: Stashed Fruit ─────────────────────────

const fruitsOf = (b: Battle, side: SideId = 0) => b.active(side).vars[FRUIT] ?? 0;

/** `acornsquirrel` vs `monolith`; the old trait "Hoarding" (heals 25% the first time at half HP) is marked as already used, so stashed fruit can be tested on its own */
function squirrel(skills: string[], team: string[] = [], hoard = false): Battle {
  const b = duel([{ id: 'acornsquirrel', skills: ['t_wait', 't_strike', ...skills] }, ...team.map((id) => ({ id }))], [{ id: MONO, skills: [...FOE_SKILLS, 't_blast'] }]);
  if (!hoard) b.active(0).vars.ate = 1;
  return b;
}

test("Stashed Fruit (Bury Acorns): buries 2, max 3; shown in the Grove Hoarder's mark row; kept on leaving the field", () => {
  const b = squirrel(['acornsquirrel_bury_acorns'], [CRAB]);
  turn(b, 'acornsquirrel_bury_acorns', 't_wait');
  assert.equal(fruitsOf(b), 2);
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'kit:fruit' && m.n === 2 && m.note === '藏果 2／3'));
  const ev = turn(b, 'acornsquirrel_bury_acorns', 't_wait');
  assert.equal(fruitsOf(b), FRUIT_MAX, 'at most 3');
  assert.match(texts(ev), /埋下了 1 顆藏果/);
  turn(b, sw(1), 't_wait');
  turn(b, sw(0), 't_wait');
  assert.equal(fruitsOf(b), FRUIT_MAX, 'kept on leaving the field');
});

test('Stashed Fruit: after being attacked, at 50% HP or below it eats 1: heals 15% and ATK +1 stage; at most 1 per turn; no eating above 50%', async () => {
  const b = squirrel([]);
  const c = b.active(0);
  c.vars[FRUIT] = 2;
  c.hp = c.maxHp;
  turn(b, 't_wait', 't_strike');
  assert.equal(fruitsOf(b), 2, 'still above 50%: does not eat');
  c.hp = Math.floor(c.maxHp * 0.5) + 5;
  const before = c.hp;
  const ev = turn(b, 't_wait', 't_blast');
  const dmg = hitsBy(ev, 1)[0].dmg;
  assert.equal(fruitsOf(b), 1);
  assert.equal(c.stages.atk, 1);
  assert.equal(c.hp, before - dmg + Math.floor(c.maxHp * 0.15), 'heals 15%');
  assert.ok(traits(ev).includes('藏果'));
  // Hit again in the same turn (calling the stashed-fruit hit trigger directly): it does not eat again
  const { KIT } = await import('./nature.ts');
  const hit = { attacker: 1, defender: 0 } as unknown as Parameters<NonNullable<typeof KIT.acornsquirrel.onHitTaken>>[1];
  KIT.acornsquirrel.onHitTaken?.(b, hit, 1);
  assert.equal(fruitsOf(b), 1, 'at most 1 per turn');
  c.hp = Math.floor(c.maxHp * 0.3);
  turn(b, 't_wait', 't_strike');
  assert.equal(fruitsOf(b), 0, 'can eat again next turn');
  assert.equal(c.stages.atk, 2);
});

test('Stockpile (old trait kept): the first time HP drops to 50% or below it heals 25% first, and only then comes the stashed fruit', () => {
  const b = squirrel([], [], true);
  const c = b.active(0);
  c.vars[FRUIT] = 1;
  c.hp = Math.floor(c.maxHp * 0.55);
  const ev = turn(b, 't_wait', 't_blast');
  assert.ok(traits(ev).includes('囤糧'), 'eats the Stockpile first');
  assert.equal(c.vars.ate, 1);
  if (c.hp * 2 <= c.maxHp) assert.equal(fruitsOf(b), 0, 'still at half or below after healing: eats the stashed fruit too');
  else assert.equal(fruitsOf(b), 1, 'healed to above half: the stashed fruit is kept');
});

test('Cone Toss: with no stashed fruit, buries 1 after hitting; with fruit it does not bury', () => {
  const b = squirrel(['acornsquirrel_cone_toss']);
  turn(b, 'acornsquirrel_cone_toss', 't_wait');
  assert.equal(fruitsOf(b), 1);
  turn(b, 'acornsquirrel_cone_toss', 't_wait');
  assert.equal(fruitsOf(b), 1, 'no burying when it has fruit');
});

test('Nutshell Guard, Hoard Rush, Sneaky Stash, Plant a Grove, Bountiful Harvest: each buries stashed fruit', () => {
  const b = squirrel(['acornsquirrel_nut_shell', 'acornsquirrel_hoard_rush', 'acornsquirrel_grove_planting']);
  turn(b, 'acornsquirrel_nut_shell', 't_wait');
  assert.equal(fruitsOf(b), 1);
  assert.equal(b.active(0).stages.def, 1);
  turn(b, 'acornsquirrel_hoard_rush', 't_wait');
  assert.equal(fruitsOf(b), 2, 'Hoard Rush hits');
  turn(b, 'acornsquirrel_hoard_rush', guard());
  assert.equal(fruitsOf(b), 2, 'guarded: none');
  const c = squirrel(['acornsquirrel_grove_planting']);
  c.active(0).hp = Math.floor(c.active(0).maxHp * 0.5);
  turn(c, 'acornsquirrel_grove_planting', 't_wait');
  assert.equal(fruitsOf(c), 2);
  assert.equal(c.active(0).hp, Math.floor(c.active(0).maxHp * 0.5) + Math.floor(c.active(0).maxHp * 0.1));
  const d = squirrel([]);
  turn(d, 'u_acornsquirrel', 't_wait');
  assert.equal(fruitsOf(d), FRUIT_MAX, 'ultimate: buries to the max');
  const e = squirrel(['acornsquirrel_stash_snare']);
  turn(e, use('t_strike', 'acornsquirrel_stash_snare'), 't_wait');
  const t0 = duel([{ id: 'acornsquirrel', skills: ['t_strike'] }], [{ id: MONO, skills: FOE_SKILLS }]);
  t0.active(0).vars.ate = 1;
  turn(t0, 't_strike', 't_wait');
  const d0 = hitsBy(turn(t0, 't_strike', 't_strike'), 1)[0].dmg;
  const ev = turn(e, 't_strike', 't_strike');
  const d1 = hitsBy(ev, 1)[0].dmg;
  assert.ok(ev.some((x) => x.k === 'trap' && x.side === 0), 'Sneaky Stash fires');
  assert.ok(Math.abs(d1 / d0 - 0.8) < 0.08, `Damage −20% (${d0} → ${d1})`);
  assert.equal(fruitsOf(e), 1, 'Sneaky Stash: buries 1');
});

test('AI (Grove Hoarder): buries fruit first when it has none, does not bury when full', async () => {
  const { chooseAction } = await import('../ai.ts');
  const b = squirrel(['acornsquirrel_bury_acorns', 'acornsquirrel_quick_bite']);
  b.side(1).aether = 0;
  const pick = () => {
    const a = chooseAction(b, 0, { skill: 1 });
    return a.main.type === 'skill' ? a.main.skillId : a.main.type;
  };
  assert.equal(pick(), 'acornsquirrel_bury_acorns');
  b.active(0).vars[FRUIT] = FRUIT_MAX;
  assert.notEqual(pick(), 'acornsquirrel_bury_acorns');
});

// ───────────────────────── `leaffrog`: Rejuvenation ─────────────────────────

const echoOf = (b: Battle) => b.active(0).vars[ECHO] ?? 0;

/** `leaffrog` vs `monolith` */
function frog(skills: string[], team: string[] = []): Battle {
  return duel([{ id: 'leaffrog', skills: ['t_wait', ...skills] }, ...team.map((id) => ({ id }))], [{ id: MONO, skills: FOE_SKILLS }]);
}

test("Rejuvenation (Echo Pipe): leaves an echo after hitting, which sounds again at the end of next turn at 50% power, and Grovepipe King heals HP equal to the echo's damage", () => {
  const b = frog(['echo_pipe']);
  const c = b.active(0);
  let ev = turn(b, 'echo_pipe', 't_wait');
  const main = hitsBy(ev, 0)[0].dmg;
  assert.ok(echoOf(b) > 0);
  assert.doesNotMatch(texts(ev), /回音響起/, 'does not sound this turn');
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'kit:echo' && m.note === '回音：回音笛（50%）'));
  c.hp = Math.floor(c.maxHp * 0.5);
  ev = turn(b, 't_wait', 't_wait');
  assert.match(texts(ev), /「回音笛」的回音響起/);
  const echo = hitsBy(ev, 0);
  assert.equal(echo.length, 1);
  assert.ok(Math.abs(echo[0].dmg / main - 0.5) < 0.1, `Echo about 50% (${main} → ${echo[0].dmg})`);
  assert.equal(c.hp, Math.floor(c.maxHp * 0.5) + echo[0].dmg, "Rejuvenation: heals an amount equal to the echo's damage");
  assert.equal(echoOf(b), 0);
});

test('Rejuvenation: playing a "pipe" before the echo has sounded makes the old echo sound at once; when the opponent guards, the echo is blocked', () => {
  const b = frog(['echo_pipe', 'leaffrog_water_pipe']);
  turn(b, 'echo_pipe', 't_wait');
  const ev = turn(b, 'leaffrog_water_pipe', 't_wait');
  assert.equal(hitsBy(ev, 0).length, 2, 'Water Pipe + the echo of Echo Pipe');
  assert.match(texts(ev), /「回音笛」的回音響起/);
  assert.equal(b.active(0).vars[ECHO], SKILLS_INDEX('leaffrog_water_pipe'), 'the new echo is Water Pipe');
  const c = frog(['echo_pipe']);
  turn(c, 'echo_pipe', 't_wait');
  c.active(0).hp = Math.floor(c.active(0).maxHp * 0.5);
  const ev2 = turn(c, 't_wait', guard());
  assert.equal(hitsBy(ev2, 0).length, 0, 'the echo is guarded');
  assert.equal(c.active(0).hp, Math.floor(c.active(0).maxHp * 0.5), 'no Rejuvenation');
});

test('Grove Concert: echo power 100%; an echo does not leave another echo; the echo vanishes when Grovepipe King leaves the field', () => {
  const b = frog(['leaffrog_grove_concert'], [CRAB]);
  const main = hitsBy(turn(b, 'leaffrog_grove_concert', 't_wait'), 0)[0].dmg;
  const ev = turn(b, 't_wait', 't_wait');
  const echo = hitsBy(ev, 0)[0].dmg;
  assert.ok(Math.abs(echo / main - 1) < 0.12, `Echo 100% (${main} → ${echo})`);
  assert.equal(echoOf(b), 0, 'the echo is gone once it has sounded');
  turn(b, 'leaffrog_grove_concert', 't_wait');
  turn(b, sw(1), 't_wait');
  assert.equal(b.side(0).team[0].vars[ECHO], undefined, 'the echo vanishes on leaving the field');
});

test("Echo Valley: damage −30% when the opponent attacks, and that move is recorded as Grovepipe King's echo (struck back at the end of next turn)", () => {
  const a = frog([]);
  turn(a, 't_wait', 't_wait');
  const d0 = hitsBy(turn(a, 't_wait', 't_blast'), 1)[0].dmg;
  const b = duel([{ id: 'leaffrog', skills: ['t_wait', 'leaffrog_echo_valley'] }], [{ id: MONO, skills: [...FOE_SKILLS, 't_blast'] }]);
  b.resolveTurn([use('t_wait', 'leaffrog_echo_valley'), use('t_wait')]);
  b.side(0).aether = 10;
  b.side(1).aether = 10;
  const ev = turn(b, 't_wait', 't_blast');
  const d1 = hitsBy(ev, 1)[0].dmg;
  assert.ok(Math.abs(d1 / d0 - 0.7) < 0.08, `Damage −30% (${d0} → ${d1})`);
  assert.ok(b.view().sides[0].team[0].marks.some((m) => m.id === 'kit:echo' && m.note === '回音：t_blast（50%）'));
  const ev2 = turn(b, 't_wait', 't_wait');
  assert.match(texts(ev2), /「t_blast」的回音響起/);
  assert.equal(hitsBy(ev2, 0).length, 1, "Grovepipe King strikes back with the opponent's move");
});

test('Morning Dew (rewritten trait): at the end of a turn where an echo sounds, cleanses one of its own status conditions; not without an echo', () => {
  const b = frog(['echo_pipe']);
  b.applyStatus(0, 'burn');
  turn(b, 't_wait', 't_wait');
  assert.ok(b.active(0).status.burn, "no echo: no cleanse (the old trait's 30% is disabled)");
  turn(b, 'echo_pipe', 't_wait');
  const ev = turn(b, 't_wait', 't_wait');
  assert.equal(b.active(0).status.burn, undefined);
  assert.ok(traits(ev).includes('晨露'));
});

test('AI (Grovepipe King): prefers playing a "pipe" over Aqua Shot of similar power', async () => {
  const { chooseAction } = await import('../ai.ts');
  const b = frog(['aqua_shot', 'echo_pipe']);
  b.side(1).aether = 0;
  const a = chooseAction(b, 0, { skill: 1 });
  assert.equal(a.main.type === 'skill' ? a.main.skillId : a.main.type, 'echo_pipe');
});
