// Mechanic tests for the water group: node --test src/engine/kits/water.test.ts
// `thalassene`: Tide (high tide / low tide), tide level, plus the effect of every hooked skill.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseAction } from '../ai.ts';
import type { Battle } from '../battle.ts';
import { registerKitHooks } from './index.ts';
import { duel, guard, hitsBy, sw, texts, turn, use, useTestSkills } from '../testkit.ts';
import type { BattleEvent, SideId } from '../types.ts';

useTestSkills();
// The opposing spirits carry no kit hooks (other groups' mechanics may still be changing); only the behavior of the t_ test skills is left
for (const id of ['monolith', 'clockmouse', 'cloudfluff']) registerKitHooks(id, null);

const EBB = 'e:ths:ebb';
const TIDE = 'e:ths:tide';
const tide = (b: Battle, id: SideId = 0) => b.active(id).vars[TIDE] ?? 0;
const setTide = (b: Battle, n: number) => void (b.active(0).vars[TIDE] = n);
const setEbb = (b: Battle, ebb: boolean) => void (b.active(0).vars[EBB] = ebb ? 1 : 0);
const mark = (b: Battle, id: string) => b.view().sides[0].team[b.side(0).active].marks.find((m) => m.id === id);
const phase = (b: Battle) => mark(b, 'kit:tide-phase')?.note;
const dealtTo = (ev: BattleEvent[], attacker: SideId) => hitsBy(ev, attacker).reduce((a, h) => a + h.dmg + h.shieldDmg, 0);
const usedOrder = (ev: BattleEvent[]) => ev.filter((e) => e.k === 'use').map((e) => (e as { side: SideId }).side);

const whale = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'thalassene', skills }, ...extra];
const slowFoe = (skills = ['t_strike', 't_bolt', 't_wait']) => [{ id: 'monolith', skills }];

// ───────────────────────── Mechanic: Tide ─────────────────────────

test('Tide: enters at high tide and switches at the end of every turn; being hit at high tide raises the tide level by 1, being hit at low tide does not', () => {
  const b = duel(whale(['t_wait']), slowFoe());
  assert.equal(phase(b), '漲潮');
  assert.equal(mark(b, 'kit:tide'), undefined, 'Tide level is not shown at 0');
  turn(b, 't_wait', 't_strike');
  assert.equal(tide(b), 1, '+1 when hit at high tide');
  assert.equal(mark(b, 'kit:tide')?.n, 1);
  assert.equal(phase(b), '退潮');
  turn(b, 't_wait', 't_strike');
  assert.equal(tide(b), 1, 'Not raised when hit at low tide');
  assert.equal(phase(b), '漲潮');
});

test('Tide: attack damage taken −20% at high tide; attack damage dealt +20% at low tide', () => {
  const b = duel(whale(['t_wait', 'tidal_surge']), slowFoe());
  const flood = dealtTo(turn(b, 't_wait', 't_bolt'), 1);
  const ebb = dealtTo(turn(b, 't_wait', 't_bolt'), 1);
  const r = flood / ebb;
  assert.ok(r > 0.72 && r < 0.88, `High tide / low tide damage taken ratio${r.toFixed(2)} ≈ 0.8`);
  setEbb(b, false);
  const lo = b.estimate(0, 'tidal_surge');
  setEbb(b, true);
  const hi = b.estimate(0, 'tidal_surge');
  assert.ok(Math.abs(hi / lo - 1.2) < 0.02, `Low tide damage bonus${(hi / lo).toFixed(3)}`);
});

test('Tide: the tide level and the tide reset on leaving, and re-entering starts at high tide', () => {
  const b = duel(whale(['t_wait'], [{ id: 'cloudfluff' }]), slowFoe());
  setTide(b, 3);
  setEbb(b, true);
  turn(b, sw(1), 't_wait');
  turn(b, sw(0), 't_wait');
  assert.equal(tide(b), 0);
  assert.equal(phase(b), '退潮', 'Enters at high tide, switches to low tide when this turn ends');
});

// ───────────────────────── Skills ─────────────────────────

test('Tide Chime: tide level +1 after hitting at high tide; power +20 at low tide', () => {
  const b = duel(whale(['thalassene_tide_chime']), slowFoe());
  setEbb(b, false);
  const lo = b.estimate(0, 'thalassene_tide_chime');
  setEbb(b, true);
  const hi = b.estimate(0, 'thalassene_tide_chime');
  assert.ok(Math.abs(hi / lo - (70 / 50) * 1.2) < 0.03, `Low tide${(hi / lo).toFixed(2)}`);
  setEbb(b, false);
  turn(b, 'thalassene_tide_chime', 't_wait');
  assert.equal(tide(b), 1);
  turn(b, 'thalassene_tide_chime', 't_wait');
  assert.equal(tide(b), 1, 'No tide level gain at low tide');
});

test('Tide Veil: 30% shield; tide level +2 at high tide, none at low tide', () => {
  const b = duel(whale(['thalassene_tide_veil']), slowFoe());
  turn(b, 'thalassene_tide_veil', 't_wait');
  const c = b.active(0);
  assert.equal(c.shield?.amount, Math.floor(c.maxHp * 0.3));
  assert.equal(tide(b), 2);
  turn(b, 'thalassene_tide_veil', 't_wait');
  assert.equal(tide(b), 2);
});

test('Backwash: +25 power per tide level; spent on use (even if guarded)', () => {
  const b = duel(whale(['thalassene_backwash']), slowFoe());
  const base = b.estimate(0, 'thalassene_backwash');
  setTide(b, 2);
  const up = b.estimate(0, 'thalassene_backwash');
  assert.ok(Math.abs(up / base - 120 / 70) < 0.03);
  turn(b, 'thalassene_backwash', guard());
  assert.equal(tide(b), 0, 'Tide level is spent even when guarded');
});

test('Abyssal Cradle: heals 38%; tide level +1 at high tide', () => {
  const b = duel(whale(['thalassene_abyss_cradle']), slowFoe());
  const c = b.active(0);
  c.hp = Math.floor(c.maxHp / 2);
  const before = c.hp;
  turn(b, 'thalassene_abyss_cradle', 't_wait');
  assert.ok(c.hp - before >= Math.floor(c.maxHp * 0.38));
  assert.equal(tide(b), 1);
});

test('Whale Billow: tide level +1 after hitting at high tide; none at low tide', () => {
  const b = duel(whale(['thalassene_whale_billow']), slowFoe(['t_wait']));
  turn(b, 'thalassene_whale_billow', 't_wait');
  assert.equal(tide(b), 1);
  turn(b, 'thalassene_whale_billow', 't_wait');
  assert.equal(tide(b), 1);
});

test('Low Tide: reveals the opponent trap at high tide; destroys it at low tide instead', () => {
  // t_trap fires only at the end of the turn after it is set, so it is still in the trap slot when attacking
  const b = duel(whale(['thalassene_low_tide', 't_wait']), slowFoe(['t_wait', 't_trap']));
  turn(b, 't_wait', { ...use('t_wait'), trap: 't_trap' });
  assert.ok(b.side(1).trap, 'The opponent sets a trap');
  setEbb(b, false);
  const ev = b.resolveTurn([use('thalassene_low_tide'), use('t_wait')]);
  assert.ok(ev.some((e) => e.k === 'reveal' && e.side === 1), 'High tide: reveal');
  const c = duel(whale(['thalassene_low_tide', 't_wait']), slowFoe(['t_wait', 't_trap']));
  turn(c, 't_wait', { ...use('t_wait'), trap: 't_trap' });
  setEbb(c, true);
  const ev2 = c.resolveTurn([use('thalassene_low_tide'), use('t_wait')]);
  assert.ok(ev2.some((e) => e.k === 'trapDestroyed' && e.side === 1), 'Low tide: destroy');
  assert.equal(c.side(1).trap, null);
});

test('Riptide: tide level +1, and the tide does not switch at the end of this turn (the tide is held even when guarded)', () => {
  const b = duel(whale(['thalassene_riptide', 't_wait']), slowFoe());
  setEbb(b, true);
  turn(b, 'thalassene_riptide', guard());
  assert.equal(phase(b), '退潮', 'Stays at low tide');
  assert.equal(tide(b), 1);
  turn(b, 'thalassene_riptide', 't_wait');
  assert.equal(phase(b), '退潮', 'Held once more');
  assert.equal(tide(b), 2);
  turn(b, 't_wait', 't_wait');
  assert.equal(phase(b), '漲潮', 'Switches normally when the tide is not held');
});

test('Washout: dispels the opponent; at low tide it also clears timed effects on the opponent', () => {
  const b = duel(whale(['thalassene_washout']), slowFoe());
  b.changeStage(1, 'atk', 2);
  b.addLasting(1, 'thalassene_moonpull', 5);
  setEbb(b, false);
  turn(b, 'thalassene_washout', 't_wait');
  assert.equal(b.active(1).stages.atk, 0, 'Dispelled');
  assert.ok(b.getLasting(1, 'thalassene_moonpull'), 'High tide does not clear timed effects');
  turn(b, 'thalassene_washout', 't_wait');
  assert.equal(b.getLasting(1, 'thalassene_moonpull'), undefined, 'Low tide clears timed effects');
});

test('Undertow (trap): damage from that attack −40% when attacked, tide level +2', () => {
  const b = duel(whale(['thalassene_undertow', 't_wait']), slowFoe());
  turn(b, use('t_wait', 'thalassene_undertow'), 't_wait');
  // Next turn is low tide (no high-tide damage reduction); compare the damage with and without a trap
  const ev = turn(b, 't_wait', 't_bolt');
  assert.ok(ev.some((e) => e.k === 'trap' && e.side === 0 && e.skillId === 'thalassene_undertow'));
  assert.equal(tide(b), 2);
  turn(b, 't_wait', 't_wait');
  const plain = dealtTo(turn(b, 't_wait', 't_bolt'), 1);
  const cut = dealtTo(ev, 1);
  assert.ok(cut / plain < 0.7, `Trap damage reduction${(cut / plain).toFixed(2)}`);
});

test('Rip Current (trap): when the opponent declares a switch, the switch fails and the opponent is rooted', () => {
  const b = duel(whale(['thalassene_rip_current', 't_wait']), [{ id: 'monolith', skills: ['t_wait'] }, { id: 'cloudfluff', skills: ['t_wait'] }]);
  turn(b, use('t_wait', 'thalassene_rip_current'), 't_wait');
  const ev = turn(b, 't_wait', sw(1));
  assert.ok(ev.some((e) => e.k === 'fail' && e.side === 1 && e.reason === '替換失敗'));
  assert.equal(b.side(1).active, 0);
  // Earth element is immune to root: try again with an opponent that is not earth element
  const c = duel(whale(['thalassene_rip_current', 't_wait']), [{ id: 'cloudfluff', skills: ['t_wait'] }, { id: 'monolith', skills: ['t_wait'] }]);
  turn(c, use('t_wait', 'thalassene_rip_current'), 't_wait');
  turn(c, 't_wait', sw(1));
  assert.equal(c.side(1).active, 0);
  assert.ok(c.active(1).status.root, 'Rooted');
  assert.equal(c.canSwitch(1).ok, false);
});

test('Ark Song: spends all tide levels; the whole team (bench included) heals 10% + 8% per level', () => {
  const b = duel(whale(['thalassene_ark_song'], [{ id: 'cloudfluff' }]), slowFoe());
  const me = b.active(0);
  const mate = b.side(0).team[1];
  me.hp = Math.floor(me.maxHp / 2);
  mate.hp = Math.floor(mate.maxHp / 2);
  const [h0, h1] = [me.hp, mate.hp];
  setTide(b, 2);
  turn(b, 'thalassene_ark_song', 't_wait');
  assert.equal(tide(b), 0, 'All tide levels spent');
  assert.equal(mate.hp - h1, Math.floor(mate.maxHp * 0.26));
  assert.ok(me.hp - h0 >= Math.floor(me.maxHp * 0.26));
});

test('Raging Tide: +40 power per tide level, which is spent; priority +1 at low tide', () => {
  const b = duel(whale(['thalassene_raging_tide']), [{ id: 'clockmouse', skills: ['t_wait', 't_strike'] }]);
  const foe = b.active(1);
  foe.maxHp = foe.hp = 999999;
  const base = b.estimate(0, 'thalassene_raging_tide');
  setTide(b, 3);
  const up = b.estimate(0, 'thalassene_raging_tide');
  assert.ok(Math.abs(up / base - 220 / 100) < 0.03);
  // High tide: the faster opponent acts first
  setEbb(b, false);
  assert.deepEqual(usedOrder(turn(b, 'thalassene_raging_tide', 't_wait')), [1, 0]);
  assert.equal(tide(b), 0, 'Tide levels spent');
  // Low tide: priority +1, beating the opponent to the punch
  setEbb(b, true);
  setTide(b, 2);
  assert.deepEqual(usedOrder(turn(b, 'thalassene_raging_tide', 't_wait')), [0, 1]);
});

test('Moonpull: priority +2; for 3 turns tide effects are doubled (high tide cuts damage by 40%), tide level +1', () => {
  const b = duel(whale(['thalassene_moonpull', 't_wait']), [{ id: 'clockmouse', skills: ['t_bolt', 't_wait'] }]);
  const plainFlood = dealtTo(turn(b, 't_wait', 't_bolt'), 1); // High tide -20%
  turn(b, 't_wait', 't_wait'); // Low tide
  const ev = turn(b, 'thalassene_moonpull', 't_bolt'); // High tide: `thalassene_moonpull` acts first, so damage is already reduced by 40% this turn
  assert.deepEqual(usedOrder(ev), [0, 1]);
  const moonFlood = dealtTo(ev, 1);
  const r = moonFlood / plainFlood;
  assert.ok(r > 0.68 && r < 0.82, `Moonpull high tide / ordinary high tide${r.toFixed(2)} ≈ 0.75`);
  assert.ok(tide(b) >= 1);
  assert.ok(b.getLasting(0, 'thalassene_moonpull'));
  turn(b, 't_wait', 't_wait');
  turn(b, 't_wait', 't_wait');
  assert.equal(b.getLasting(0, 'thalassene_moonpull'), undefined, 'Ends after 3 turns');
});

test('Spring Tide Aria (ultimate): +30 per tide level spent; Spring Tide lasts 4 turns with both high tide and low tide effects at once, and sets up even when guarded', () => {
  const b = duel(whale(['tidal_surge', 't_wait']), slowFoe());
  const c = b.active(0);
  c.ultimate = 'u_thalassene';
  const base = b.estimate(0, 'u_thalassene');
  setTide(b, 2);
  assert.ok(Math.abs(b.estimate(0, 'u_thalassene') / base - 200 / 140) < 0.03);
  setEbb(b, false);
  const floodPlain = b.estimate(0, 'tidal_surge');
  turn(b, 'u_thalassene', guard());
  assert.equal(tide(b), 0);
  assert.ok(b.getLasting(0, 'u_thalassene'), 'Spring Tide sets up even when guarded');
  assert.equal(phase(b), '大潮');
  // The current tide is low, but Spring Tide also counts as high tide: hits taken add tide level and the damage taken is reduced
  turn(b, 't_wait', 't_strike');
  assert.equal(tide(b), 1, 'Being hit in Spring Tide also builds tide level');
  setEbb(b, false);
  assert.ok(b.estimate(0, 'tidal_surge') / floodPlain > 1.15, 'The low tide damage bonus applies at high tide too');
});

// ───────────────────────── AI ─────────────────────────

test('AI: at low tide with full tide level while the opponent can still guard, it uses Riptide to hold the low tide; if the opponent just guarded it goes straight to Raging Tide', () => {
  const pick = (canGuard: boolean) => {
    const b = duel(whale(['thalassene_tide_chime', 'thalassene_riptide', 'thalassene_raging_tide', 'thalassene_tide_veil']), slowFoe());
    setEbb(b, true);
    setTide(b, 3);
    b.side(0).ultUsed = true;
    b.active(1).hp = Math.floor(b.active(1).maxHp * 0.6);
    if (!canGuard) b.active(1).lastGuardTurn = b.s.turn;
    const n: Record<string, number> = {};
    for (let i = 0; i < 20; i++) {
      const m = chooseAction(b, 0, { skill: 1 }).main;
      const k = m.type === 'skill' ? m.skillId : m.type;
      n[k] = (n[k] ?? 0) + 1;
    }
    return n;
  };
  assert.ok((pick(true).thalassene_riptide ?? 0) >= 15, JSON.stringify(pick(true)));
  assert.ok((pick(false).thalassene_raging_tide ?? 0) >= 15, JSON.stringify(pick(false)));
});

// ═════════════════════════ `siren`: Reverie ═════════════════════════

const DREAM = 'e:sir:dream';
const siren = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'siren', skills }, ...extra];
const dream = (b: Battle) => b.active(1).vars[DREAM] ?? 0;
const setDream = (b: Battle, n: number) => void (b.active(1).vars[DREAM] = n);
const sleep = (b: Battle, turns = 2) => void (b.active(1).status.sleep = { turns });
const isAsleep = (b: Battle) => !!b.active(1).status.sleep;
const sleepyFoe = (skills = ['t_strike', 't_bolt', 't_wait']) => [{ id: 'monolith', skills }];

test('Reverie: exclusive attacks do not wake a sleeping opponent and give Dream Depth +1 on hit; ordinary attacks still wake it', () => {
  const b = duel(siren(['siren_abyss_whisper', 't_bolt', 't_wait']), sleepyFoe());
  assert.deepEqual(usedOrder(turn(b, 't_wait', 't_wait')), [0, 1], 'The siren is faster than the test opponent');
  sleep(b, 3);
  turn(b, 'siren_abyss_whisper', 't_wait');
  assert.ok(isAsleep(b), 'Abyssal Whisper did not wake the opponent');
  assert.equal(dream(b), 1);
  assert.equal(mark(b, 'kit:dream')?.n, 1, 'Dream Depth shows on the siren side');
  turn(b, 't_bolt', 't_wait');
  assert.ok(!isAsleep(b), 'An ordinary attack wakes it');
  assert.equal(dream(b), 2, 'An ordinary attack adds no Dream Depth; Lost Melody gives +1 at the end of the turn it wakes');
  turn(b, 'siren_abyss_whisper', 't_wait');
  assert.equal(dream(b), 2, 'An awake opponent gains no Dream Depth');
});

test('Reverie: Dream Depth maxes at 3 stacks and clears when the opponent leaves', () => {
  const b = duel(siren(['siren_hum', 't_wait']), sleepyFoe(['t_wait']).concat([{ id: 'cloudfluff', skills: ['t_wait'] }]));
  sleep(b, 5);
  turn(b, 'siren_hum', 't_wait');
  turn(b, 'siren_hum', 't_wait');
  assert.equal(dream(b), 3);
  turn(b, 't_wait', sw(1));
  turn(b, 't_wait', sw(0));
  assert.equal(dream(b), 0);
  assert.equal(mark(b, 'kit:dream'), undefined);
});

test('Abyssal Whisper: power +20 against a sleeping opponent', () => {
  const b = duel(siren(['siren_abyss_whisper']), sleepyFoe());
  const awake = b.estimate(0, 'siren_abyss_whisper');
  sleep(b);
  const sleeping = b.estimate(0, 'siren_abyss_whisper');
  assert.ok(Math.abs(sleeping / awake - 110 / 90) < 0.03, `${(sleeping / awake).toFixed(2)}`);
});

test('Low Hum: Dream Depth +2 when hitting a sleeping opponent; none when it is awake', () => {
  const b = duel(siren(['siren_hum']), sleepyFoe(['t_wait']));
  turn(b, 'siren_hum', 't_wait');
  assert.equal(dream(b), 0);
  sleep(b);
  turn(b, 'siren_hum', 't_wait');
  assert.equal(dream(b), 2);
  assert.ok(isAsleep(b));
});

test('Lullaby / Siren Song: put the opponent to sleep; the AI does not waste sleep while the opponent has toughness', () => {
  // 90% accuracy: find a seed that hits
  let b = duel(siren(['siren_song', 'siren_abyss_whisper']), sleepyFoe(['t_wait']));
  for (let seed = 1; seed < 20; seed++) {
    b = duel(siren(['siren_song', 'siren_abyss_whisper']), sleepyFoe(['t_wait']), seed);
    turn(b, 'siren_song', 't_wait');
    if (isAsleep(b)) break;
  }
  assert.ok(isAsleep(b));
  assert.equal(b.active(1).stages.res, -1);
  delete b.active(1).status.sleep;
  b.active(1).toughness = 2;
  b.side(0).ultUsed = true;
  for (let i = 0; i < 10; i++) {
    const m = chooseAction(b, 0, { skill: 1 }).main;
    assert.ok(!(m.type === 'skill' && m.skillId === 'siren_song'), 'No sleep while it has toughness');
  }
});

test('Dream Eater: +20 power per stack of Dream Depth, spends all Dream Depth after hitting but keeps the stack from this hit; drains 30%', () => {
  const b = duel(siren(['siren_dream_eater']), sleepyFoe(['t_wait']));
  const plain = b.estimate(0, 'siren_dream_eater');
  setDream(b, 3);
  const full = b.estimate(0, 'siren_dream_eater');
  assert.ok(Math.abs(full / plain - 115 / 55) < 0.05, `${(full / plain).toFixed(2)}`);
  sleep(b);
  const me = b.active(0);
  me.hp = Math.floor(me.maxHp / 2);
  const before = me.hp;
  const ev = turn(b, 'siren_dream_eater', 't_wait');
  assert.equal(dream(b), 1, 'After spending 3 stacks, this hit engraves 1 stack again');
  assert.ok(isAsleep(b));
  assert.equal(me.hp - before, Math.floor(dealtTo(ev, 0) * 0.3));
});

test('Dream Eater: Dream Depth is not spent when guarded', () => {
  const b = duel(siren(['siren_dream_eater']), sleepyFoe(['t_wait']));
  setDream(b, 2);
  turn(b, 'siren_dream_eater', guard());
  assert.equal(dream(b), 2);
});

test('Nightmare: cannot be used without Dream Depth; the opponent loses 12% of max HP per stack, it does not wake the opponent and Guard cannot stop it', () => {
  const b = duel(siren(['siren_nightmare', 't_wait']), sleepyFoe(['t_wait']));
  assert.equal(b.canUse(0, 'siren_nightmare').ok, false);
  setDream(b, 3);
  const d = b.active(1);
  const hp = d.hp;
  turn(b, 'siren_nightmare', guard());
  assert.equal(hp - d.hp, Math.floor(d.maxHp * 0.36), 'Guard cannot stop it');
  assert.equal(dream(b), 0);
  setDream(b, 1);
  sleep(b);
  const ev = turn(b, 'siren_nightmare', 't_wait');
  const nm = ev.filter((e) => e.k === 'damage' && e.reason === 'nightmare') as Extract<BattleEvent, { k: 'damage' }>[];
  assert.deepEqual(nm.map((e) => e.dmg), [Math.floor(d.maxHp * 0.12)]);
  assert.ok(isAsleep(b), 'Nightmare does not wake the opponent');
});

test("Siren's Maelstrom: roots a sleeping opponent, which stays asleep", () => {
  // `monolith` (earth) is immune to root, so switch to a neutral-element opponent
  const b = duel(siren(['siren_maelstrom']), [{ id: 'clockmouse', skills: ['t_wait'] }]);
  sleep(b, 3);
  turn(b, 'siren_maelstrom', 't_wait');
  assert.ok(b.active(1).status.root);
  assert.ok(isAsleep(b));
  assert.equal(dream(b), 1);
});

test('Luring Song: puts the opponent spirit to sleep when it switches in', () => {
  const b = duel(siren(['t_wait', 'siren_lure']), sleepyFoe(['t_wait']).concat([{ id: 'cloudfluff', skills: ['t_wait'] }]));
  turn(b, use('t_wait', 'siren_lure'), 't_wait');
  assert.ok(b.side(0).trap);
  turn(b, 't_wait', sw(1));
  assert.equal(b.active(1).species.id, 'cloudfluff');
  assert.ok(isAsleep(b));
  assert.equal(b.side(0).trap, null);
});

test('Dream Theft: when the opponent has Dream Depth and stat boosts, spends 1 stack to steal the buffs; steals nothing without Dream Depth', () => {
  const b = duel(siren(['siren_dream_theft', 't_wait']), sleepyFoe(['t_war_cry', 't_wait']));
  turn(b, 't_wait', 't_war_cry');
  assert.equal(b.active(1).stages.atk, 2);
  turn(b, 'siren_dream_theft', 't_wait');
  assert.equal(b.active(1).stages.atk, 2, 'Awake and no Dream Depth: nothing stolen');
  setDream(b, 2);
  turn(b, 'siren_dream_theft', 't_wait');
  assert.equal(b.active(1).stages.atk, 0);
  assert.equal(b.active(0).stages.atk, 2);
  assert.equal(dream(b), 1);
});

test('Dream Theft: against a sleeping opponent, the Dream Depth engraved by this very hit can be used to steal', () => {
  const b = duel(siren(['siren_dream_theft', 't_wait']), sleepyFoe(['t_war_cry', 't_wait']));
  turn(b, 't_wait', 't_war_cry');
  sleep(b);
  turn(b, 'siren_dream_theft', 't_wait');
  assert.equal(b.active(0).stages.atk, 2);
  assert.equal(dream(b), 0);
});

test('Phantom Chorus: damage from that attack −30% when attacked, and the attacker falls asleep', () => {
  const b = duel(siren(['t_wait', 'siren_phantom_chorus']), sleepyFoe(['t_bolt', 't_wait']));
  const plain = dealtTo(turn(b, 't_wait', 't_bolt'), 1);
  b.active(1).toughness = 0;
  turn(b, use('t_wait', 'siren_phantom_chorus'), 't_wait');
  const cut = dealtTo(turn(b, 't_wait', 't_bolt'), 1);
  const r = cut / plain;
  assert.ok(r > 0.62 && r < 0.78, `Damage reduction ratio${r.toFixed(2)}`);
  assert.ok(isAsleep(b));
});

test('Dream Siphon: spends all Dream Depth (including this hit), stealing 1 aether per stack', () => {
  const b = duel(siren(['siren_dream_siphon']), sleepyFoe(['t_wait']));
  setDream(b, 2);
  sleep(b);
  b.side(0).aether = 3;
  b.side(1).aether = 10;
  b.resolveTurn([use('siren_dream_siphon'), use('t_wait')]);
  assert.equal(dream(b), 0);
  assert.equal(b.side(1).aether, 10 - 3 + 2, 'Lost 3 (+2 at the end of the turn)');
  assert.equal(b.side(0).aether, 3 - 2 + 3 + 2, 'Paid 2, stole 3 (+2 at the end of the turn)');
});

test('Lost Finale: puts the opponent to sleep after hitting and refills Dream Depth', () => {
  const b = duel(siren(['t_wait']), sleepyFoe(['t_wait']));
  b.active(0).ultimate = 'u_siren';
  b.active(1).hp = b.active(1).maxHp * 10;
  turn(b, 'u_siren', 't_wait');
  assert.ok(isAsleep(b));
  assert.equal(dream(b), 3);
});

test('AI: reaps with Nightmare when it is a sure KO; while the opponent is still asleep and Dream Depth is not full, it keeps attacking', () => {
  const pick = (asleepNow: boolean, n: number, hpPct = 1) => {
    const b = duel(siren(['siren_abyss_whisper', 'siren_nightmare', 'siren_hum', 'siren_lullaby']), sleepyFoe(['t_wait']));
    b.side(0).ultUsed = true;
    b.side(1).aether = 0;
    b.active(1).toughness = 2;
    setDream(b, n);
    if (asleepNow) sleep(b);
    b.active(1).hp = Math.floor(b.active(1).maxHp * hpPct);
    const k: Record<string, number> = {};
    for (let i = 0; i < 20; i++) {
      const m = chooseAction(b, 0, { skill: 1 }).main;
      const s = m.type === 'skill' ? m.skillId : m.type;
      k[s] = (k[s] ?? 0) + 1;
    }
    return k;
  };
  const awake = pick(false, 3, 0.34);
  assert.ok((awake.siren_nightmare ?? 0) >= 15, JSON.stringify(awake));
  const building = pick(true, 1);
  assert.ok((building.siren_nightmare ?? 0) <= 5, JSON.stringify(building));
});

test('Lost Melody (rewritten trait): Dream Depth +1 at the end of the turn the opponent wakes; the old trait sleep damage is disabled', () => {
  const b = duel(siren(['t_wait']), sleepyFoe(['t_wait']));
  sleep(b, 2);
  const hp = b.active(1).hp;
  turn(b, 't_wait', 't_wait');
  assert.ok(isAsleep(b));
  assert.equal(b.active(1).hp, hp, 'Old trait (−10% per turn while asleep) disabled');
  assert.equal(dream(b), 0);
  const ev = turn(b, 't_wait', 't_wait');
  assert.ok(!isAsleep(b));
  assert.equal(dream(b), 1);
  assert.ok(ev.some((e) => e.k === 'trait' && e.name === '失落的旋律'));
  turn(b, 't_wait', 't_wait');
  assert.equal(dream(b), 1, 'Triggers only once, on the turn it wakes');
});

test('AI: the siren does not guard while the opponent is asleep', () => {
  const b = duel(siren(['siren_hum', 'siren_abyss_whisper']), sleepyFoe(['t_strike']));
  b.active(1).ultimate = 'u_siren';
  sleep(b);
  for (let i = 0; i < 10; i++) assert.notEqual(chooseAction(b, 0, { skill: 1 }).main.type, 'guard');
});

// ═════════════════════════ `oathsea_sage`: Chant ═════════════════════════

const sage = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'oathsea_sage', skills }, ...extra];
const chant = (b: Battle) => Math.max(0, b.active(0).arcaneChain);
const setChant = (b: Battle, n: number) => void (b.active(0).arcaneChain = n);

test('Chant: +1 for each consecutive magic attack (max 3); status skills, physical skills and Guard reset it to zero; shown on the spirit', () => {
  const b = duel(sage(['aqua_shot', 't_wait', 't_strike']), sleepyFoe(['t_wait']));
  b.active(1).hp = b.active(1).maxHp * 10;
  for (let i = 0; i < 4; i++) turn(b, 'aqua_shot', 't_wait');
  assert.equal(chant(b), 3);
  assert.equal(mark(b, 'kit:chant')?.n, 3);
  turn(b, 't_wait', 't_wait');
  assert.equal(chant(b), 0, 'A status skill interrupts the Chant');
  turn(b, 'aqua_shot', 't_wait');
  turn(b, 't_strike', 't_wait');
  assert.equal(chant(b), 0, 'A physical skill interrupts the Chant');
  turn(b, 'aqua_shot', 't_wait');
  turn(b, guard(), 't_wait');
  assert.equal(chant(b), 0, 'Guard interrupts the Chant');
  assert.equal(mark(b, 'kit:chant'), undefined);
});

test('Tidal Chant (rewritten trait): each stack of Chant gives magic attacks +8% damage', () => {
  const b = duel(sage(['aqua_shot']), sleepyFoe(['t_wait']));
  const base = b.estimate(0, 'aqua_shot');
  setChant(b, 3);
  const r = b.estimate(0, 'aqua_shot') / base;
  assert.ok(Math.abs(r - 1.24) < 0.03, r.toFixed(3));
});

test('Tidemark Verse: Chant +1 extra (+2 in total)', () => {
  const b = duel(sage(['oathsea_sage_verse']), sleepyFoe(['t_wait']));
  turn(b, 'oathsea_sage_verse', 't_wait');
  assert.equal(chant(b), 2);
  turn(b, 'oathsea_sage_verse', 't_wait');
  assert.equal(chant(b), 3);
});

test('Crest Coda: +30 power per stack, Chant resets to zero after use (even if guarded)', () => {
  const b = duel(sage(['oathsea_sage_crest']), sleepyFoe(['t_wait']));
  const base = b.estimate(0, 'oathsea_sage_crest');
  setChant(b, 2);
  const r = b.estimate(0, 'oathsea_sage_crest') / base;
  assert.ok(Math.abs(r - (120 / 60) * 1.16) < 0.05, r.toFixed(3));
  turn(b, 'oathsea_sage_crest', guard());
  assert.equal(chant(b), 0);
});

test('Shell Charm: 25% shield, Chant is restored at the end of the turn', () => {
  const b = duel(sage(['oathsea_sage_shell_ward']), sleepyFoe(['t_wait']));
  setChant(b, 2);
  turn(b, 'oathsea_sage_shell_ward', 't_wait');
  const c = b.active(0);
  assert.equal(c.shield?.amount, Math.floor(c.maxHp * 0.25));
  assert.equal(chant(b), 2);
});

test('Mist Coda: spends the Chant, healing 10% per stack', () => {
  const b = duel(sage(['oathsea_sage_mist_coda']), sleepyFoe(['t_wait']));
  const c = b.active(0);
  c.hp = Math.floor(c.maxHp / 2);
  const hp = c.hp;
  setChant(b, 2);
  turn(b, 'oathsea_sage_mist_coda', 't_wait');
  assert.equal(c.hp - hp, Math.floor(c.maxHp * 0.2));
  assert.equal(chant(b), 0);
});

test('Tidemark Resonance: power +50 at 3 stacks of Chant, which is not spent', () => {
  const b = duel(sage(['oathsea_sage_resonance']), sleepyFoe(['t_wait']));
  setChant(b, 2);
  const two = b.estimate(0, 'oathsea_sage_resonance');
  setChant(b, 3);
  const three = b.estimate(0, 'oathsea_sage_resonance');
  assert.ok(Math.abs(three / two - (140 / 90) * (1.24 / 1.16)) < 0.05, (three / two).toFixed(3));
  turn(b, 'oathsea_sage_resonance', 't_wait');
  assert.equal(chant(b), 3);
});

test('Frostwave Coda: freezes the opponent when it spends 3 stacks; 2 stacks do not', () => {
  const b = duel(sage(['oathsea_sage_frost_coda']), sleepyFoe(['t_wait']));
  setChant(b, 2);
  turn(b, 'oathsea_sage_frost_coda', 't_wait');
  assert.ok(!b.active(1).status.freeze);
  assert.equal(chant(b), 0);
  setChant(b, 3);
  // Freeze is lifted on the opponent's action this turn; look at the events
  const ev = turn(b, 'oathsea_sage_frost_coda', 't_wait');
  assert.ok(ev.some((e) => e.k === 'status' && e.target === 1 && e.status === 'freeze'));
  assert.ok(ev.some((e) => e.k === 'fail' && e.side === 1), 'The opponent cannot act this turn');
});

test('Tidesong Ward: damage from that attack −30% when attacked, Chant +1', () => {
  const b = duel(sage(['t_wait', 'aqua_shot', 'oathsea_sage_tide_ward']), sleepyFoe(['t_bolt', 't_wait']));
  const plain = dealtTo(turn(b, 't_wait', 't_bolt'), 1);
  turn(b, use('aqua_shot', 'oathsea_sage_tide_ward'), 't_wait');
  assert.equal(chant(b), 1);
  const cut = dealtTo(turn(b, 'aqua_shot', 't_bolt'), 1);
  assert.ok(cut / plain > 0.62 && cut / plain < 0.78, (cut / plain).toFixed(2));
  assert.equal(chant(b), 3, 'Ward +1, Aqua Shot +1');
});

test('Oathsea Coda: +35 power per stack; ignores Guard when it spends 3 stacks, and is blocked at 2 stacks', () => {
  const b = duel(sage(['oathsea_sage_oath_coda']), sleepyFoe(['t_wait']));
  setChant(b, 2);
  assert.equal(hitsBy(turn(b, 'oathsea_sage_oath_coda', guard()), 0).length, 0, 'Blocked at 2 stacks');
  assert.equal(chant(b), 0);
  setChant(b, 3);
  b.active(1).lastGuardTurn = -5;
  assert.ok(dealtTo(turn(b, 'oathsea_sage_oath_coda', guard()), 0) > 0, 'Ignores Guard at 3 stacks');
});

test('Deep Blue Aria: +20 power per stack, Chant refills after hitting', () => {
  const b = duel(sage(['t_wait']), sleepyFoe(['t_wait']));
  b.active(0).ultimate = 'u_oathsea_sage';
  b.active(1).hp = b.active(1).maxHp * 10;
  turn(b, 'u_oathsea_sage', 't_wait');
  assert.equal(chant(b), 3);
});

// ═════════════════════════ `swordfish`: Crest ═════════════════════════

const fish = (skills: string[]) => [{ id: 'swordfish', skills }];
const crest = (b: Battle) => (b.active(0).vars['e:swf:crest'] ?? 0) > 0;
const setCrest = (b: Battle, on: boolean) => void (b.active(0).vars['e:swf:crest'] = on ? 1 : 0);

test('Crest: hitting before the opponent acts rides the Crest; it does not if the opponent acts first', () => {
  const b = duel(fish(['swordfish_fin_slash', 't_wait']), sleepyFoe(['t_quick_strike', 't_wait']));
  turn(b, 'swordfish_fin_slash', 't_wait');
  assert.ok(crest(b));
  assert.equal(b.view().sides[0].team[0].marks.find((m) => m.id === 'kit:crest')?.note, '浪尖');
  setCrest(b, false);
  // Wavebreaker (the first attack after entering has priority +1) is already used up: the opponent's priority attack acts first
  turn(b, 'swordfish_fin_slash', 't_quick_strike');
  assert.ok(!crest(b), 'The opponent moved first');
});

test('Wave Pierce: with a Crest, power +40, ignores Guard and spends the Crest; without a Crest it is blocked', () => {
  const b = duel(fish(['wave_pierce', 't_wait']), sleepyFoe(['t_wait']));
  const plain = b.estimate(0, 'wave_pierce');
  setCrest(b, true);
  assert.ok(Math.abs(b.estimate(0, 'wave_pierce') / plain - 115 / 75) < 0.05);
  assert.ok(dealtTo(turn(b, 'wave_pierce', guard()), 0) > 0, 'Ignores Guard');
  assert.ok(!crest(b), 'Spends the Crest; Wave Pierce itself does not ride the Crest');
  b.active(1).lastGuardTurn = -5;
  assert.equal(hitsBy(turn(b, 'wave_pierce', guard()), 0).length, 0, 'Blocked without a Crest');
});

test('Wavebreaker: a Wave Pierce against a guarding opponent is always a crit', () => {
  const b = duel(fish(['swordfish_breaker']), sleepyFoe(['t_wait']));
  setCrest(b, true);
  const h = hitsBy(turn(b, 'swordfish_breaker', guard()), 0);
  assert.equal(h.length, 1);
  assert.ok(h[0].crit);
});

test('Thousand Crests: power +60 with a Crest', () => {
  const b = duel(fish(['swordfish_thousand_crests']), sleepyFoe(['t_wait']));
  const plain = b.estimate(0, 'swordfish_thousand_crests');
  setCrest(b, true);
  assert.ok(Math.abs(b.estimate(0, 'swordfish_thousand_crests') / plain - 155 / 95) < 0.05);
});

test('Surging Flash: priority +1; with a Crest, power +60 and ignores Guard', () => {
  const b = duel(fish(['t_wait']), sleepyFoe(['t_wait']));
  b.active(0).ultimate = 'u_swordfish';
  setCrest(b, true);
  assert.ok(dealtTo(turn(b, 'u_swordfish', guard()), 0) > 0);
  assert.ok(!crest(b));
});

test('Reverse Scale: damage from that attack −30% when attacked, and rides the Crest', () => {
  const b = duel(fish(['t_wait', 'swordfish_scale_guard']), sleepyFoe(['t_strike', 't_wait']));
  const plain = dealtTo(turn(b, 't_wait', 't_strike'), 1);
  turn(b, use('t_wait', 'swordfish_scale_guard'), 't_wait');
  const cut = dealtTo(turn(b, 't_wait', 't_strike'), 1);
  assert.ok(cut / plain > 0.62 && cut / plain < 0.78, (cut / plain).toFixed(2));
  assert.ok(crest(b));
});

test('Undertow Cut / Riptide Lunge: ride the Crest when they hit first; Undertow Cut lowers the opponent Speed', () => {
  const b = duel(fish(['swordfish_undercut', 'swordfish_riptide_lunge']), sleepyFoe(['t_wait']));
  turn(b, 'swordfish_undercut', 't_wait');
  assert.ok(crest(b));
  assert.equal(b.active(1).stages.spd, -1);
  setCrest(b, false);
  turn(b, 'swordfish_riptide_lunge', 't_wait');
  assert.ok(crest(b));
});

test('AI: uses Wave Pierce with a Crest; without a Crest it uses Beak Dart first to ride the Crest', () => {
  const pick = (on: boolean) => {
    const b = duel(fish(['swordfish_dart', 'swordfish_breaker', 'swordfish_riptide_lunge', 'swordfish_fin_slash']), sleepyFoe(['t_wait']));
    b.side(0).ultUsed = true;
    b.side(1).aether = 0;
    setCrest(b, on);
    const m = chooseAction(b, 0, { skill: 1 }).main;
    return m.type === 'skill' ? m.skillId : m.type;
  };
  assert.equal(pick(true), 'swordfish_breaker');
  assert.notEqual(pick(false), 'swordfish_breaker');
});

// ═════════════════════════ `springlotus`: Full Spring ═════════════════════════

const lotus = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'springlotus', skills }, ...extra];
/** Resolves one turn after setting the aether (unlike turn(), it does not refill aether to 10) */
const step = (b: Battle, ae: number, a: string, c = 't_wait') => {
  b.side(0).aether = ae;
  return b.resolveTurn([use(a), use(c)]);
};

test('Full Spring: our aether is ≥ 5 before using a skill; Dewdrop and Lotus Bloom gain power at Full Spring', () => {
  const b = duel(lotus(['springlotus_dew', 'springlotus_bloom']), sleepyFoe(['t_wait']));
  b.side(0).aether = 4;
  const dew = b.estimate(0, 'springlotus_dew');
  const bloom = b.estimate(0, 'springlotus_bloom');
  assert.equal(mark(b, 'kit:fullspring'), undefined);
  b.side(0).aether = 5;
  assert.equal(mark(b, 'kit:fullspring')?.note, '滿泉');
  assert.ok(Math.abs(b.estimate(0, 'springlotus_dew') / dew - 80 / 50) < 0.05);
  assert.ok(Math.abs(b.estimate(0, 'springlotus_bloom') / bloom - 135 / 95) < 0.05);
});

test('Full Spring: attack damage taken −15% at aether ≥ 5', () => {
  const b = duel(lotus(['t_wait']), sleepyFoe(['t_bolt']));
  b.side(0).aether = 4;
  const low = dealtTo(b.resolveTurn([use('t_wait'), use('t_bolt')]), 1);
  b.side(0).aether = 6;
  const full = dealtTo(b.resolveTurn([use('t_wait'), use('t_bolt')]), 1);
  assert.ok(full / low > 0.78 && full / low < 0.92, (full / low).toFixed(2));
});

test('Lotus Dew: heals 25%; 40% at Full Spring (≥ 5 before use counts, even if only 4 remain after paying the cost)', () => {
  const b = duel(lotus(['springlotus_lotus_dew']), sleepyFoe(['t_wait']));
  const c = b.active(0);
  c.hp = 1;
  step(b, 4, 'springlotus_lotus_dew');
  assert.equal(c.hp - 1, Math.floor(c.maxHp * 0.25));
  c.hp = 1;
  step(b, 5, 'springlotus_lotus_dew');
  assert.equal(c.hp - 1, Math.floor(c.maxHp * 0.25) + Math.floor(c.maxHp * 0.15));
});

test('Spring Vine: drains 50% at Full Spring', () => {
  const b = duel(lotus(['springlotus_vine_siphon']), sleepyFoe(['t_wait']));
  const c = b.active(0);
  c.hp = 1;
  step(b, 4, 'springlotus_vine_siphon');
  assert.equal(c.hp, 1, 'No drain without Full Spring');
  const ev = step(b, 7, 'springlotus_vine_siphon');
  assert.equal(c.hp - 1, Math.floor(dealtTo(ev, 0) * 0.5));
});

test('Wellspring Surge: pours out aether above 5, +30 power per point', () => {
  const b = duel(lotus(['springlotus_surge']), sleepyFoe(['t_wait']));
  b.side(0).aether = 7;
  const low = b.estimate(0, 'springlotus_surge');
  b.side(0).aether = 9;
  assert.ok(Math.abs(b.estimate(0, 'springlotus_surge') / low - 130 / 70) < 0.05, 'After paying 2 and 7 remain: 2 points poured out');
  step(b, 9, 'springlotus_surge');
  assert.equal(b.side(0).aether, 5 + 2 + 1, 'Poured down to 5; +2 at the end of the turn, +1 from Wellspring');
});

test('Sweet Rain: the whole team heals 22%; at Full Spring it cleanses the whole team', () => {
  const b = duel(lotus(['springlotus_rain']), sleepyFoe(['t_wait']));
  const c = b.active(0);
  c.status.poison = { turns: 4, stacks: 1 };
  step(b, 3, 'springlotus_rain');
  assert.ok(c.status.poison, 'No cleanse without Full Spring');
  step(b, 8, 'springlotus_rain');
  assert.ok(!c.status.poison);
});

test('Starfont: our side for 3 turns, aether +1 at the end of each turn, and it persists after a switch', () => {
  const b = duel(lotus(['springlotus_star_font', 't_wait'], [{ id: 'cloudfluff', skills: ['t_wait'] }]), sleepyFoe(['t_wait']));
  step(b, 4, 'springlotus_star_font');
  assert.equal(b.side(0).aether, 4 - 2 + 2 + 1 + 1, 'Paid 2; +2 at the end of the turn, +1 from Wellspring, +1 from Starfont');
  b.side(0).aether = 0;
  b.resolveTurn([sw(1), use('t_wait')]);
  assert.equal(b.side(0).aether, 2 + 1, 'Starfont still gives +1 after switching out (Wellspring no longer triggers)');
});

test("Spring's Gift: our aether +2, then switches out; Starfont Lotus: aether +3, whole team heals 15%", () => {
  const b = duel(lotus(['springlotus_gift', 't_wait'], [{ id: 'cloudfluff', skills: ['t_wait'] }]), sleepyFoe(['t_wait']));
  step(b, 3, 'springlotus_gift');
  assert.equal(b.active(0).species.id, 'cloudfluff');
  assert.equal(b.side(0).aether, 3 - 1 + 2 + 2, 'Paid 1, +2; +2 at the end of the turn (Wellspring has left)');
  const c = duel(lotus(['t_wait'], [{ id: 'cloudfluff', skills: ['t_wait'] }]), sleepyFoe(['t_wait']));
  c.active(0).ultimate = 'u_springlotus';
  c.active(1).hp = c.active(1).maxHp * 10;
  const bench = c.side(0).team[1];
  bench.hp = 1;
  step(c, 5, 'u_springlotus');
  assert.equal(c.side(0).aether, 0 + 3 + 2 + 1);
  assert.equal(bench.hp, 1 + Math.floor(bench.maxHp * 0.15));
});

test('AI: Aether Infusion is used only when aether runs low; Ride the Wind only when the opponent is faster', () => {
  const b = duel(lotus(['springlotus_dew', 'aether_infusion']), sleepyFoe(['t_wait']));
  b.side(0).ultUsed = true;
  b.side(1).aether = 0;
  b.side(0).aether = 8;
  const m = chooseAction(b, 0, { skill: 1 }).main;
  assert.ok(m.type === 'skill' && m.skillId === 'springlotus_dew');
  const f = duel(fish(['swordfish_ride_wind', 'swordfish_dart']), [{ id: 'clockmouse', skills: ['t_wait'] }]);
  f.side(0).ultUsed = true;
  f.side(1).aether = 0;
  f.active(1).stages.spd = 4;
  const hint = (id: string) => (f.active(1).stages.spd = id === 'fast' ? 4 : -4);
  hint('fast');
  const fast = chooseAction(f, 0, { skill: 1 }).main;
  hint('slow');
  const slow = chooseAction(f, 0, { skill: 1 }).main;
  assert.ok(fast.type === 'skill' && fast.skillId === 'swordfish_ride_wind', JSON.stringify(fast));
  assert.ok(slow.type === 'skill' && slow.skillId !== 'swordfish_ride_wind', JSON.stringify(slow));
});

// ═════════════════════════ `icecrown`: Frost ═════════════════════════

const ice = (skills: string[]) => [{ id: 'icecrown', skills }];
const frost = (b: Battle) => b.active(1).vars['e:ice:frost'] ?? 0;
const froze = (ev: BattleEvent[]) => ev.some((e) => e.k === 'status' && e.target === 1 && e.status === 'freeze');

test('Frost: after an [Ice] skill hits, the opponent Frost +1 (shown on Icecrown Emperor); at 3 stacks it freezes and Frost resets to zero', () => {
  const b = duel(ice(['icecrown_snowball', 't_wait']), sleepyFoe(['t_wait']));
  turn(b, 'icecrown_snowball', 't_wait');
  assert.equal(frost(b), 1);
  assert.equal(mark(b, 'kit:frost')?.n, 1);
  assert.equal(mark(b, 'kit:frost')?.note, '對手的霜');
  turn(b, 'icecrown_snowball', 't_wait');
  assert.equal(frost(b), 2);
  const ev = turn(b, 'icecrown_snowball', 't_wait');
  assert.ok(froze(ev), 'Freezes at the 3rd stack');
  assert.ok(ev.some((e) => e.k === 'fail' && e.side === 1), 'The opponent cannot act this turn');
  assert.equal(frost(b), 0);
  assert.equal(mark(b, 'kit:frost'), undefined);
});

test('Frost: each of the 2 hits of Hailstorm gives +1; water-element opponents cannot be frozen, so Frost stays at 3 stacks', () => {
  const b = duel(ice(['icecrown_hailstorm']), [{ id: 'swordfish', skills: ['t_wait'] }]);
  turn(b, 'icecrown_hailstorm', 't_wait');
  assert.equal(frost(b), 2);
  const ev = turn(b, 'icecrown_hailstorm', 't_wait');
  assert.equal(frost(b), 3);
  assert.ok(!froze(ev));
});

test('Frost: cleared when the opponent leaves', () => {
  const b = duel(ice(['icecrown_hailstorm', 't_wait']), [{ id: 'monolith', skills: ['t_wait'] }, { id: 'clockmouse', skills: ['t_wait'] }]);
  turn(b, 'icecrown_hailstorm', 't_wait');
  assert.equal(frost(b), 2);
  turn(b, 't_wait', sw(1));
  assert.equal(frost(b), 0, 'The spirit that switched in has no Frost');
  turn(b, 't_wait', sw(0));
  assert.equal(frost(b), 0, 'Cleared again on switching back');
});

test('Shatter Lance / Crown Shatter: power +50 / +70 against a frozen opponent; priority hits before the opponent thaws, and Chill always crits', () => {
  const b = duel(ice(['shatter_lance', 'icecrown_crown_shatter']), sleepyFoe(['t_quick_strike', 't_wait']));
  const lance = b.estimate(0, 'shatter_lance');
  const crown = b.estimate(0, 'icecrown_crown_shatter');
  b.active(1).status.freeze = { turns: 2 };
  assert.ok(Math.abs(b.estimate(0, 'shatter_lance') / lance - 125 / 75) < 0.03);
  assert.ok(Math.abs(b.estimate(0, 'icecrown_crown_shatter') / crown - 165 / 95) < 0.03);
  const ev = turn(b, 'shatter_lance', 't_quick_strike');
  const h = hitsBy(ev, 0);
  assert.equal(h.length, 1);
  assert.ok(h[0].crit, 'Chill: always crits against a frozen opponent');
  assert.equal(hitsBy(ev, 1).length, 0, 'A frozen opponent cannot move');
});

test('Permafrost: Frost +2, opponent Speed −1', () => {
  const b = duel(ice(['icecrown_permafrost']), sleepyFoe(['t_wait']));
  turn(b, 'icecrown_permafrost', 't_wait');
  assert.equal(frost(b), 2);
  assert.equal(b.active(1).stages.spd, -1);
});

test('Ice Trap: damage from that attack −30% when attacked, attacker Frost +2', () => {
  const b = duel(ice(['t_wait', 'icecrown_ice_trap']), sleepyFoe(['t_strike', 't_wait']));
  const plain = dealtTo(turn(b, 't_wait', 't_strike'), 1);
  turn(b, use('t_wait', 'icecrown_ice_trap'), 't_wait');
  const cut = dealtTo(turn(b, 't_wait', 't_strike'), 1);
  assert.ok(cut / plain > 0.62 && cut / plain < 0.78, (cut / plain).toFixed(2));
  assert.equal(frost(b), 2);
});

test('Crown of Winter: Frost +3 after hitting, freezing directly', () => {
  const b = duel(ice(['t_wait']), sleepyFoe(['t_wait']));
  b.active(0).ultimate = 'u_icecrown';
  b.active(1).hp = b.active(1).maxHp * 10;
  const ev = turn(b, 'u_icecrown', 't_wait');
  assert.ok(froze(ev));
  assert.equal(frost(b), 0);
});

test('AI: uses an [Ice] skill when it can fill up Frost; does not guard while the opponent is frozen', () => {
  const pick = (setup: (b: Battle) => void) => {
    const b = duel(ice(['icecrown_snowball', 'shatter_lance', 'torrent_strike']), sleepyFoe(['t_wait']));
    b.side(0).ultUsed = true;
    setup(b);
    const m = chooseAction(b, 0, { skill: 1 }).main;
    return m.type === 'skill' ? m.skillId : m.type;
  };
  assert.equal(
    pick((b) => {
      b.side(1).aether = 0;
      b.active(1).vars['e:ice:frost'] = 2;
    }),
    'icecrown_snowball',
  );
  assert.notEqual(
    pick((b) => {
      b.side(1).aether = 10;
      b.active(1).status.freeze = { turns: 2 };
    }),
    'guard',
  );
});

// ═════════════════════════ `bubblecrab`: Bounce Shell ═════════════════════════

const crab = (skills: string[]) => [{ id: 'bubblecrab', skills }];
const bounced = (ev: BattleEvent[]) =>
  ev.filter((e) => e.k === 'damage' && e.target === 1 && e.reason === 'bounce').reduce((a, e) => a + (e as { dmg: number }).dmg, 0);

test('Bounce Shell: each hit of a physical attack is reduced by 5% of max HP and reflected to the attacker all at once after the attack resolves; magic is not', () => {
  const b = duel(crab(['t_wait']), sleepyFoe(['t_strike', 't_bolt', 't_multi_hit']));
  const cut = Math.floor(b.active(0).maxHp * 0.05);
  const est = b.estimate(1, 't_strike');
  const ev = turn(b, 't_wait', 't_strike');
  assert.equal(bounced(ev), cut);
  const h = hitsBy(ev, 1)[0];
  assert.ok(Math.abs(h.dmg - (est - cut)) <= est * 0.06 + 1, `${h.dmg} vs ${est} − ${cut}`);
  assert.ok(texts(ev).includes('硬殼彈開了攻擊'));
  assert.equal(bounced(turn(b, 't_wait', 't_bolt')), 0, 'Magic is not bounced');
  const multi = turn(b, 't_wait', 't_multi_hit');
  const segs = hitsBy(multi, 1).filter((x) => x.dmg > 0).length;
  assert.ok(segs >= 2);
  assert.ok(bounced(multi) > cut, 'Every hit of a multi-hit attack is bounced');
});

test('Bubble Wall: magic attacks are bounced too for 3 turns', () => {
  const b = duel(crab(['t_wait', 'bubblecrab_bubble_wall']), sleepyFoe(['t_bolt', 't_wait']));
  turn(b, 'bubblecrab_bubble_wall', 't_wait');
  assert.ok(bounced(turn(b, 't_wait', 't_bolt')) > 0);
  assert.ok(bounced(turn(b, 't_wait', 't_bolt')) > 0);
  assert.equal(bounced(turn(b, 't_wait', 't_bolt')), 0, 'Ends after 3 turns');
});

test('Armored Offense: Reef Slam is calculated from Defense (it grows stronger with Defense +1 stage); Aqua Claw still uses Attack', () => {
  const b = duel(crab(['reef_slam', 'aqua_claw']), sleepyFoe(['t_wait']));
  const slam = b.estimate(0, 'reef_slam');
  const claw = b.estimate(0, 'aqua_claw');
  b.active(0).stages.def = 1;
  assert.ok(b.estimate(0, 'reef_slam') / slam > 1.15);
  assert.equal(b.estimate(0, 'aqua_claw'), claw);
});

test('Bubble Burst: power +50 when an attack was bounced this turn', () => {
  const b = duel(crab(['bubblecrab_bubble_burst']), sleepyFoe(['t_quick_strike', 't_wait']));
  const plain = b.estimate(0, 'bubblecrab_bubble_burst');
  b.active(0).vars['e:crab:bounced'] = b.s.turn;
  assert.ok(Math.abs(b.estimate(0, 'bubblecrab_bubble_burst') / plain - 105 / 55) < 0.03);
  b.active(0).vars['e:crab:bounced'] = 0;
  // Real battle: the opponent's priority physical attack gets bounced first
  const ev = turn(b, 'bubblecrab_bubble_burst', 't_quick_strike');
  assert.ok(bounced(ev) > 0);
  assert.ok(hitsBy(ev, 0)[0].dmg > plain * 1.5);
});

// ═════════════════════════ `lanternfish`: Lure ═════════════════════════

const lamp = (skills: string[]) => [{ id: 'lanternfish', skills }];
const lit = (b: Battle) => (b.active(0).vars['e:lan:lure'] ?? 0) > 0;
const exposed = (b: Battle) => b.active(1).exposed >= b.s.turn;

test('Lure: once lit, when an opponent attack hits → the opponent becomes Exposed and the Lure goes out; the next hit is always a crit', () => {
  const b = duel(lamp(['lure_flash', 'lanternfish_glim', 't_wait']), sleepyFoe(['t_strike', 't_wait']));
  turn(b, 'lure_flash', 't_wait');
  assert.ok(lit(b), 'Status skills do not take the bait');
  assert.equal(mark(b, 'kit:lure')?.note, '燈餌');
  assert.equal(b.active(1).stages.spd, -1);
  turn(b, 't_wait', 't_strike');
  assert.ok(!lit(b));
  assert.ok(exposed(b));
  const h = hitsBy(turn(b, 'lanternfish_glim', 't_wait'), 0);
  assert.ok(h[0].crit);
  assert.ok(!exposed(b), 'Exposed was used up');
});

test('Lure Flash: priority +1, so an opponent attacking in the same turn takes the bait', () => {
  const b = duel(lamp(['lure_flash']), sleepyFoe(['t_quick_strike']));
  turn(b, 'lure_flash', 't_quick_strike');
  assert.ok(exposed(b));
  assert.ok(!lit(b));
});

test('Illuminate: Glimmer, Lantern Beam and Abyss Ray gain +20 / +30 / +40 power against an Exposed opponent', () => {
  const b = duel(lamp(['lanternfish_glim', 'lanternfish_beam', 'lanternfish_abyss_ray']), sleepyFoe(['t_wait']));
  const ids = ['lanternfish_glim', 'lanternfish_beam', 'lanternfish_abyss_ray'];
  const base = ids.map((id) => b.estimate(0, id));
  b.active(1).exposed = b.s.turn + 1;
  const want = [70 / 50, 115 / 85, 135 / 95];
  ids.forEach((id, i) => assert.ok(Math.abs(b.estimate(0, id) / base[i] - want[i]) < 0.03, id));
});

test('Lure Light (rewritten trait): heals 10% when the opponent takes the Lure bait; the old trait (accuracy −30% on the first turn after entering) is disabled', () => {
  const b = duel(lamp(['lure_flash', 't_wait']), sleepyFoe(['t_strike', 't_wait']));
  let hitsOnEntry = 0;
  for (let i = 0; i < 6; i++) {
    const x = duel(lamp(['t_wait']), sleepyFoe(['t_strike']), 100 + i);
    hitsOnEntry += hitsBy(turn(x, 't_wait', 't_strike'), 1).length;
  }
  assert.equal(hitsOnEntry, 6, 'The first turn after entering no longer lowers accuracy');
  turn(b, 'lure_flash', 't_wait');
  b.active(0).hp = Math.floor(b.active(0).maxHp / 2);
  const ev = turn(b, 't_wait', 't_strike');
  const dmg = dealtTo(ev, 1);
  const heal = Math.floor(b.active(0).maxHp * 0.1);
  assert.ok(Math.abs(b.active(0).hp - (Math.floor(b.active(0).maxHp / 2) - dmg + heal)) <= 1);
  assert.ok(ev.some((e) => e.k === 'trait' && e.side === 0));
});

test('Lantern Snare: damage from that attack −30% when attacked, and the attacker becomes Exposed', () => {
  const b = duel(lamp(['t_wait', 'lanternfish_lantern_snare']), sleepyFoe(['t_bolt', 't_wait']));
  const plain = dealtTo(turn(b, 't_wait', 't_bolt'), 1);
  turn(b, use('t_wait', 'lanternfish_lantern_snare'), 't_wait');
  const cut = dealtTo(turn(b, 't_wait', 't_bolt'), 1);
  assert.ok(cut / plain > 0.62 && cut / plain < 0.78, (cut / plain).toFixed(2));
  assert.ok(exposed(b));
});

test('Lantern Mother: lights the Lure after hitting', () => {
  const b = duel(lamp(['t_wait']), sleepyFoe(['t_wait']));
  b.active(0).ultimate = 'u_lanternfish';
  b.active(1).hp = b.active(1).maxHp * 10;
  turn(b, 'u_lanternfish', 't_wait');
  assert.ok(lit(b));
});

test('AI: lights the Lure first when it is not lit; attacks directly when it is lit', () => {
  const pick = (on: boolean) => {
    const b = duel(lamp(['lanternfish_glim', 'lure_flash', 'lanternfish_beam', 'lanternfish_abyss_ray']), sleepyFoe(['t_wait']));
    b.side(0).ultUsed = true;
    b.side(1).aether = 0;
    b.active(0).vars['e:lan:lure'] = on ? 1 : 0;
    const m = chooseAction(b, 0, { skill: 1 }).main;
    return m.type === 'skill' ? m.skillId : m.type;
  };
  assert.equal(pick(false), 'lure_flash');
  assert.notEqual(pick(true), 'lure_flash');
});
