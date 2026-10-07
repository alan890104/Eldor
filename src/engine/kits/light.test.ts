// Mechanic tests for the light group: `luminael` (Backlight), `astragate` (Star Gate Seal).
// node --test src/engine/kits/light.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Battle } from '../battle.ts';
import type { BattleEvent, SideId } from '../types.ts';
import { duel, guard, hitsBy, sw, texts, turn, use, useTestSkills } from '../testkit.ts';
import { KIT } from './light.ts';

useTestSkills();

// The opponent is `monolith` (slow; its old trait "Firm Stone" saves it only at full HP), using test skills
const FOE = 'monolith';
const FOE_SKILLS = ['t_wait', 't_strike', 't_quick_strike', 't_war_cry', 't_bolt'];

/** Which side acts first this turn */
const firstActor = (ev: BattleEvent[]): SideId | undefined => (ev.find((e) => e.k === 'use') as { side: SideId } | undefined)?.side;
const damageBy = (ev: BattleEvent[], target: SideId, reason: string) =>
  ev.filter((e) => e.k === 'damage' && e.target === target && e.reason === reason).reduce((s, e) => s + (e as { dmg: number }).dmg, 0);
const healed = (ev: BattleEvent[], target: SideId) => ev.filter((e) => e.k === 'heal' && e.target === target).reduce((s, e) => s + (e as { amount: number }).amount, 0);
const mark = (b: Battle, side: SideId, id: string) => b.view().sides[side].team[b.side(side).active].marks.find((m) => m.id === id);

// ───────────────────────── `luminael`: Backlight ─────────────────────────

const INVERT = 'luminael_dawnlight';

function luminael(skills: string[], foeSkills = FOE_SKILLS): Battle {
  const b = duel([{ id: 'luminael', skills }], [{ id: FOE, skills: foeSkills }]);
  // `luminael` is faster than `monolith`: at equal priority `luminael` normally goes first
  b.active(0).stats.spd = 500;
  b.active(1).stats.spd = 100;
  b.active(1).maxHp = b.active(1).hp = 99999;
  return b;
}

test('Dawnlight Inversion: reverses the order and flips the sign of attack skill priority; using it again restores normal', () => {
  const b = luminael(['luminael_dawnlight', 'luminael_star_lance', 't_wait']);
  // Normally: `luminael_star_lance` (-2) moves last
  assert.equal(firstActor(turn(b, 'luminael_star_lance', 't_strike')), 1);
  turn(b, 'luminael_dawnlight', 't_wait');
  assert.ok((b.s.reverseOrder ?? 0) > 0, 'action order is reversed');
  assert.ok(b.getLasting(0, INVERT) && b.getLasting(1, INVERT), 'both sides have Backlight');
  // Backlight: -2 becomes +2, beating the opponent's priority-0 attack
  assert.equal(firstActor(turn(b, 'luminael_star_lance', 't_strike')), 0);
  // The opponent's +1 attack becomes -1: even later than `luminael`'s status skill
  assert.equal(firstActor(turn(b, 't_wait', 't_quick_strike')), 0);
  // Ends naturally after 3 turns (including the turn it was set up)
  assert.equal(b.s.reverseOrder, 0);
  assert.ok(!b.getLasting(0, INVERT) && !b.getLasting(1, INVERT));
});

test('Dawnlight Inversion: status skills are not flipped (Trick Room lets the slower go first); using it again under Backlight restores normal', () => {
  const b = luminael(['luminael_dawnlight', 'luminael_star_lance', 't_wait']);
  turn(b, 'luminael_dawnlight', 't_wait');
  assert.equal(firstActor(turn(b, 't_wait', 't_wait')), 1);
  turn(b, 'luminael_dawnlight', 't_wait');
  assert.equal(b.s.reverseOrder, 0);
  assert.ok(!b.getLasting(0, INVERT) && !b.getLasting(1, INVERT));
  assert.equal(firstActor(turn(b, 'luminael_star_lance', 't_strike')), 1);
});

test('Backlight: when the order is turned back to normal some other way, the priority flip lapses with it', () => {
  const b = luminael(['luminael_dawnlight', 'luminael_star_lance']);
  turn(b, 'luminael_dawnlight', 't_wait');
  b.toggleReverseOrder(0);
  assert.equal(firstActor(turn(b, 'luminael_star_lance', 't_strike')), 1, 'a leftover priority flip alone has no effect');
  assert.ok(!b.getLasting(0, INVERT) && !b.getLasting(1, INVERT), 'cleared at the end of the turn');
});

test('Morningstar Inversion: Backlight for 5 turns and raises Magic Power', () => {
  const b = luminael(['luminael_morningstar_inversion']);
  turn(b, 'luminael_morningstar_inversion', 't_wait');
  assert.equal(b.active(0).stages.mag, 1);
  assert.equal(b.getLasting(0, INVERT)?.turns, 4);
  assert.equal(b.s.reverseOrder, 4);
});

test('Dawn Plume: heals 10% after a hit when acting first, none when acting second', () => {
  const b = luminael(['luminael_dawn_plume', 'luminael_dawnlight']);
  const me = b.active(0);
  me.hp = Math.floor(me.maxHp / 2);
  assert.equal(healed(turn(b, 'luminael_dawn_plume', 't_wait'), 0), 0, 'priority −1, acts second');
  turn(b, 'luminael_dawnlight', 't_wait');
  const hp = me.hp;
  const ev = turn(b, 'luminael_dawn_plume', 't_strike');
  assert.equal(firstActor(ev), 0);
  assert.equal(healed(ev, 0), Math.floor(me.maxHp * 0.1));
  assert.ok(me.hp > hp - 1 - hitsBy(ev, 1).reduce((s, h) => s + h.dmg, 0));
});

test('Dusk Judgment: power ×2 when acting second and the opponent did not attack this turn', () => {
  const b = luminael(['luminael_dusk_judgment']);
  b.active(1).stats.res = 3000;
  const base = b.estimate(0, 'luminael_dusk_judgment');
  const a = hitsBy(turn(b, 'luminael_dusk_judgment', 't_strike'), 0)[0];
  const c = hitsBy(turn(b, 'luminael_dusk_judgment', 't_wait'), 0)[0];
  assert.ok(a && c && !a.crit && !c.crit);
  assert.ok(a.dmg <= base * 1.05, `opponent attacked: normal power ${a.dmg} / ${base}`);
  assert.ok(c.dmg / a.dmg > 1.6 && c.dmg / a.dmg < 2.5, `opponent did not attack: ×2 (${a.dmg} → ${c.dmg})`);
});

test('Morningstar Verdict: always crits when acting first', () => {
  const b = luminael(['luminael_morningstar_verdict', 'luminael_dawnlight']);
  b.active(1).stats.res = 3000;
  turn(b, 'luminael_dawnlight', 't_wait');
  for (let i = 0; i < 2; i++) {
    const ev = turn(b, 'luminael_morningstar_verdict', 't_strike');
    assert.equal(firstActor(ev), 0);
    assert.ok(hitsBy(ev, 0)[0]?.crit, 'acting first under Backlight: crit');
  }
});

test('Morningstar Oath: negates a status skill used by the opponent; sets up Backlight for 3 turns when the order is normal', () => {
  const b = luminael(['t_wait', 'luminael_morningstar_oath']);
  turn(b, { ...use('t_wait'), trap: 'luminael_morningstar_oath' }, 't_wait');
  assert.ok(b.side(0).trap);
  const ev = turn(b, 't_wait', 't_war_cry');
  assert.ok(ev.some((e) => e.k === 'negate' && e.side === 1), 'the status skill is negated');
  assert.equal(b.active(1).stages.atk, 0);
  assert.ok((b.s.reverseOrder ?? 0) > 0 && b.getLasting(0, INVERT) && b.getLasting(1, INVERT), 'Backlight is set up');
  assert.equal(b.side(0).trap, null);
});

test('Dawn and Dusk as One: counts as acting both first and second (Dawn Plume heals, Verdict crits)', () => {
  const b = luminael(['luminael_twin_stars', 'luminael_dawn_plume', 'luminael_morningstar_verdict']);
  b.active(1).stats.res = 3000;
  turn(b, 'luminael_twin_stars', 't_wait');
  assert.equal(mark(b, 0, 'kit:lum_phase')?.note, '晨昏');
  const me = b.active(0);
  me.hp = Math.floor(me.maxHp / 2);
  const ev = turn(b, 'luminael_dawn_plume', 't_strike');
  assert.equal(firstActor(ev), 1, 'actually acts second');
  assert.equal(healed(ev, 0), Math.floor(me.maxHp * 0.1), 'still counts as acting first');
  const ev2 = turn(b, 'luminael_morningstar_verdict', 't_strike');
  assert.equal(firstActor(ev2), 1);
  assert.ok(hitsBy(ev2, 0)[0]?.crit);
});

test('Morningstar Revelation: sets up Backlight for 5 turns after a hit when the order is normal', () => {
  const b = luminael(['u_luminael', 't_wait']);
  b.active(1).stats.res = 5000;
  b.active(1).maxHp = b.active(1).hp = 99999;
  turn(b, 'u_luminael', 't_wait');
  assert.equal(b.s.reverseOrder, 4);
  assert.ok(b.getLasting(0, INVERT) && b.getLasting(1, INVERT));
});

test('Morningstar Revelation: pierces Guard under Backlight', () => {
  const b = luminael(['u_luminael', 'luminael_dawnlight']);
  b.active(1).stats.res = 5000;
  b.active(1).maxHp = b.active(1).hp = 99999;
  turn(b, 'luminael_dawnlight', 't_wait');
  const ev = turn(b, 'u_luminael', guard());
  assert.ok(ev.some((e) => e.k === 'guarded' && e.broke), 'the guard is pierced');
  assert.ok((hitsBy(ev, 0)[0]?.dmg ?? 0) > 0);
  assert.ok((b.s.reverseOrder ?? 0) > 0, 'a hit under Backlight does not turn the order back');
});

test('Mark: dusk (normal) / dawn (under Backlight)', () => {
  const b = luminael(['luminael_dawnlight']);
  assert.equal(mark(b, 0, 'kit:lum_phase')?.note, '昏');
  turn(b, 'luminael_dawnlight', 't_wait');
  assert.equal(mark(b, 0, 'kit:lum_phase')?.note, '晨');
});

// ───────────────────────── `astragate`: Star Gate Seal ─────────────────────────

const STAR = 'e:ast:star';
const star = (b: Battle) => b.active(0).vars[STAR] ?? 0;
const setStar = (b: Battle, n: number) => void (b.active(0).vars[STAR] = n);

function astragate(skills: string[], foeSkills = FOE_SKILLS, bench = false): Battle {
  const b = duel([{ id: 'astragate', skills }, ...(bench ? [{ id: FOE }] : [])], [{ id: FOE, skills: foeSkills }]);
  b.active(1).maxHp = b.active(1).hp = 99999;
  b.active(1).stats.atk = 900;
  return b;
}

test('A guard that blocks an attack: seals that skill for 3 turns and stores the damage of the whole attack as Starlight', () => {
  const b = astragate(['t_wait']);
  const ev = turn(b, guard(), 't_strike');
  assert.ok(ev.some((e) => e.k === 'guarded' && e.side === 0));
  assert.equal(b.active(1).disabled?.skill, 't_strike');
  assert.equal(b.canUse(1, 't_strike').ok, false);
  turn(b, 't_wait', 't_wait');
  turn(b, 't_wait', 't_wait');
  assert.equal(b.canUse(1, 't_strike').ok, false, 'still unusable on the 3rd turn of the seal');
  turn(b, 't_wait', 't_wait');
  assert.equal(b.canUse(1, 't_strike').ok, true, 'lifted after 3 turns');
  assert.ok(star(b) > 0 && star(b) <= Math.floor(b.active(0).maxHp * 0.4));
  assert.match(texts(ev), /星門封存了/);
  assert.equal(mark(b, 0, 'kit:ast_star')?.n, Math.round((star(b) / b.active(0).maxHp) * 100));
});

test('Starlight caps at 40% of max HP', () => {
  const b = astragate(['t_wait']);
  b.active(1).stats.atk = 20000;
  turn(b, guard(), 't_strike');
  assert.equal(star(b), Math.floor(b.active(0).maxHp * 0.4));
});

test('Starstone Strike: power +30 when a skill of the opponent is sealed', () => {
  const b = astragate(['astragate_starstone_strike']);
  const e0 = b.estimate(0, 'astragate_starstone_strike');
  b.active(1).disabled = { skill: 't_strike', turns: b.s.turn + 2 };
  const e1 = b.estimate(0, 'astragate_starstone_strike');
  assert.ok(Math.abs(e1 / e0 - 83 / 53) < 0.05, `${e0} → ${e1}`);
});

test('Open Gate skills: Gate Stream releases 100%, Starflood Gate 150% and the ultimate 200% of the Starlight as fixed damage', () => {
  for (const [skill, mult] of [['astragate_gate_stream', 1], ['astragate_gate_flood', 1.5], ['u_astragate', 2]] as const) {
    const b = astragate([skill]);
    setStar(b, 300);
    const ev = turn(b, skill, 't_wait');
    assert.equal(damageBy(ev, 1, 'starlight'), Math.floor(300 * mult), skill);
    assert.equal(star(b), 0);
  }
});

test('Open Gate: just an ordinary attack without Starlight', () => {
  const b = astragate(['astragate_gate_flood']);
  const ev = turn(b, 'astragate_gate_flood', 't_wait');
  assert.equal(damageBy(ev, 1, 'starlight'), 0);
  assert.ok(hitsBy(ev, 0).length === 1);
});

test('Starlight Bulwark: priority +3, damage −50% this turn and blocks (seals, stores the whole attack, reflects half of the reduced part); cannot be used twice in a row', () => {
  const b = astragate(['starlight_bulwark', 't_wait']);
  const foe = b.active(1);
  const ev = turn(b, 'starlight_bulwark', 't_quick_strike');
  assert.equal(firstActor(ev), 0);
  const dealt = hitsBy(ev, 1)[0].dmg;
  assert.ok(dealt > 0, 'still takes half the damage');
  assert.equal(star(b), dealt * 2, 'the whole attack (before reduction) is stored as Starlight');
  assert.equal(damageBy(ev, 1, 'reflect'), Math.floor(dealt * 0.5), 'half of the reduced part is reflected back');
  assert.equal(foe.disabled?.skill, 't_quick_strike');
  assert.equal(b.canUse(0, 'starlight_bulwark').ok, false, 'cannot be used twice in a row');
  turn(b, 't_wait', 't_wait');
  assert.equal(b.canUse(0, 'starlight_bulwark').ok, true);
});

test('Meteor Counter: power +50 when a skill of the opponent is sealed (back to normal once the seal lifts)', () => {
  const b = astragate(['astragate_meteor_counter', 't_wait']);
  const e0 = b.estimate(0, 'astragate_meteor_counter');
  turn(b, guard(), 't_strike');
  assert.equal(b.active(1).disabled?.skill, 't_strike');
  const e1 = b.estimate(0, 'astragate_meteor_counter');
  assert.ok(Math.abs(e1 / e0 - 1.5) < 0.05, `${e0} → ${e1}`);
  for (let i = 0; i < 3; i++) turn(b, 't_wait', 't_wait');
  assert.ok(Math.abs(b.estimate(0, 'astragate_meteor_counter') / e0 - 1) < 0.05, 'the seal is lifted');
});

test('Gate Reversal: negates an attack skill used by the opponent and counts it as blocked (seal + Starlight)', () => {
  const b = astragate(['t_wait', 'astragate_gate_reversal']);
  turn(b, { ...use('t_wait'), trap: 'astragate_gate_reversal' }, 't_wait');
  const hp = b.active(0).hp;
  const ev = turn(b, 't_wait', 't_strike');
  assert.ok(ev.some((e) => e.k === 'negate' && e.side === 1));
  assert.equal(b.active(0).hp, hp, 'the attack is negated');
  assert.equal(b.active(1).disabled?.skill, 't_strike');
  assert.ok(star(b) > 0);
  assert.equal(b.side(0).trap, null);
});

test('Star Mending: heals 15%, then turns the Starlight into the same amount of HP', () => {
  const b = astragate(['astragate_star_mending']);
  const me = b.active(0);
  me.hp = Math.floor(me.maxHp * 0.3);
  setStar(b, 200);
  const hp = me.hp;
  turn(b, 'astragate_star_mending', 't_wait');
  assert.equal(me.hp - hp, Math.floor(me.maxHp * 0.15) + 200);
  assert.equal(star(b), 0);
});

test('Sealed Gate: for 3 turns every attack that lands counts as blocked (seals, stores 40% of the damage)', () => {
  const b = astragate(['astragate_gate_seal', 't_wait']);
  turn(b, 'astragate_gate_seal', 't_wait');
  const ev = turn(b, 't_wait', 't_strike');
  const dealt = hitsBy(ev, 1)[0].dmg;
  assert.equal(star(b), Math.floor(dealt * 0.4));
  assert.equal(b.active(1).disabled?.skill, 't_strike');
  turn(b, 't_wait', 't_bolt');
  turn(b, 't_wait', 't_wait');
  assert.equal(b.getLasting(0, 'astragate_gate_seal'), undefined, 'ends after 3 turns');
});

test('Starlight dissipates on leaving', () => {
  const b = astragate(['t_wait'], FOE_SKILLS, true);
  setStar(b, 300);
  turn(b, sw(1), 't_wait');
  turn(b, sw(0), 't_wait');
  assert.equal(star(b), 0);
});

test('Open Gate: pierces Guard with Starlight; can be guarded without it', () => {
  const b = astragate(['astragate_gate_flood']);
  setStar(b, 300);
  const ev = turn(b, 'astragate_gate_flood', guard());
  assert.ok(ev.some((e) => e.k === 'guarded' && e.side === 1 && e.broke), 'the guard is broken through');
  assert.equal(damageBy(ev, 1, 'starlight'), 450);
  const b2 = astragate(['astragate_gate_flood']);
  const ev2 = turn(b2, 'astragate_gate_flood', guard());
  assert.ok(ev2.some((e) => e.k === 'guarded' && e.side === 1 && !e.broke), 'no Starlight: blocked as usual');
  assert.equal(hitsBy(ev2, 0).length, 0);
});

test('AI hook: Astra does not want to guard when Starlight is full; the opponent does not want to guard when Astra can open the gate', () => {
  const b = astragate(['astragate_gate_flood', 't_wait']);
  const kit = KIT.astragate;
  setStar(b, 0);
  assert.equal(kit.aiFoeGuard?.(b, 0, 0), 0);
  setStar(b, Math.floor(b.active(0).maxHp * 0.4));
  assert.ok((kit.aiFoeGuard?.(b, 0, 0) ?? 0) < 0, 'a guard cannot stop an Open Gate');
  assert.ok((kit.aiGuard?.(b, 0, 0) ?? 0) < 0, 'with Starlight full, open the gate first');
});

// ───────────────────────── `chime_sprite`: Chime Rhythm ─────────────────────────

const TONES = 'e:chm:tones';
const tones = (b: Battle) => b.active(0).vars[TONES] ?? 0;
const setTones = (b: Battle, n: number) => void (b.active(0).vars[TONES] = n);
const chords = (b: Battle) => b.active(0).vars['chm:chords'] ?? 0;
const [MING, QING, SHOU] = [1, 2, 4];

function chime(skills: string[], foeSkills = FOE_SKILLS): Battle {
  const b = duel([{ id: 'chime_sprite', skills }], [{ id: FOE, skills: foeSkills }]);
  b.active(1).maxHp = b.active(1).hp = 99999;
  return b;
}

test('Clear Tone: records "Ward" on entering and reveals the trap the opponent has set', () => {
  const b = duel([{ id: FOE, skills: ['t_wait'] }, { id: 'chime_sprite', skills: ['t_wait'] }], [{ id: FOE, skills: ['t_wait', 't_trap'] }]);
  turn(b, 't_wait', { ...use('t_wait'), trap: 't_trap' });
  assert.equal(b.side(1).trap?.revealed, false);
  const ev = turn(b, sw(1), 't_wait');
  assert.ok(ev.some((e) => e.k === 'reveal' && e.side === 1), 'the trap is revealed');
  assert.equal(tones(b), SHOU);
  assert.equal(mark(b, 0, 'kit:chm_tones')?.note, '鈴律・守');
});

test('Chime Rhythm: an attack records "Ring" and a status skill records "Clear"; when all three tones are collected, a "Chord" (12% damage to the opponent, 12% heal for itself) fires and clears them', () => {
  const b = chime(['chime_ring', 'chime_clear_bell']);
  const me = b.active(0);
  assert.equal(tones(b), SHOU, 'the "Ward" from entering');
  turn(b, 'chime_ring', 't_wait');
  assert.equal(tones(b), SHOU | MING);
  me.hp = Math.floor(me.maxHp / 2);
  const ev = turn(b, 'chime_clear_bell', 't_wait');
  assert.equal(damageBy(ev, 1, 'chime'), Math.floor(b.active(1).maxHp * 0.12));
  assert.ok(healed(ev, 0) >= Math.floor(me.maxHp * 0.12) + Math.floor(me.maxHp * 0.25), 'Clear Bell 25% + Chord 12%');
  assert.equal(tones(b), 0, 'cleared after the Chord');
  assert.equal(chords(b), 1);
  assert.equal(mark(b, 0, 'kit:chm_chords')?.n, 1);
});

test('Ward Bell: damage −50% when the opponent attacks, records "Ward" when it fires', () => {
  const b = chime(['t_wait', 'chime_ward_bell']);
  setTones(b, 0);
  const base = hitsBy(turn(b, 't_wait', 't_strike'), 1)[0].dmg;
  turn(b, { ...use('t_wait'), trap: 'chime_ward_bell' }, 't_wait');
  setTones(b, 0);
  const ev = turn(b, 't_wait', 't_strike');
  assert.ok(ev.some((e) => e.k === 'trap' && e.side === 0));
  const dmg = hitsBy(ev, 1)[0].dmg;
  assert.ok(dmg / base > 0.4 && dmg / base < 0.6, `${base} → ${dmg}`);
  assert.equal(tones(b) & SHOU, SHOU);
});

test('Matins: records "Clear" and "Ring" at once', () => {
  const b = chime(['chime_matins']);
  setTones(b, 0);
  turn(b, 'chime_matins', 't_wait');
  assert.equal(tones(b), QING | MING);
});

test('Bell Ward: priority +3, damage −40% this turn, records "Ward" instead of "Clear"', () => {
  const b = chime(['t_wait', 'chime_bell_ward']);
  const base = hitsBy(turn(b, 't_wait', 't_quick_strike'), 1)[0].dmg;
  setTones(b, 0);
  const ev = turn(b, 'chime_bell_ward', 't_quick_strike');
  assert.equal(firstActor(ev), 0);
  const dmg = hitsBy(ev, 1)[0].dmg;
  assert.ok(dmg / base > 0.5 && dmg / base < 0.7, `${base} → ${dmg}`);
  assert.equal(tones(b), SHOU);
});

test('Chime Note: +20 power per tone; Resonant Light: +40 with "Ward"; Grand Carillon: +40 per Chord', () => {
  const b = chime(['chime_ring', 'chime_resonance', 'chime_crescendo']);
  setTones(b, 0);
  const r0 = b.estimate(0, 'chime_ring');
  const s0 = b.estimate(0, 'chime_resonance');
  setTones(b, MING | SHOU);
  assert.ok(Math.abs(b.estimate(0, 'chime_ring') / r0 - 85 / 45) < 0.05);
  assert.ok(Math.abs(b.estimate(0, 'chime_resonance') / s0 - 125 / 85) < 0.05);
  const c0 = b.estimate(0, 'chime_crescendo');
  b.active(0).vars['chm:chords'] = 2;
  assert.ok(Math.abs(b.estimate(0, 'chime_crescendo') / c0 - 160 / 80) < 0.05);
  b.active(0).vars['chm:chords'] = 9;
  assert.ok(Math.abs(b.estimate(0, 'chime_crescendo') / c0 - 240 / 80) < 0.05, 'at most +160');
});

test('Hush Bell: negates a status skill used by the opponent and records "Ward"', () => {
  const b = chime(['t_wait', 'chime_silence_bell']);
  turn(b, { ...use('t_wait'), trap: 'chime_silence_bell' }, 't_wait');
  setTones(b, 0);
  const ev = turn(b, 't_wait', 't_war_cry');
  assert.ok(ev.some((e) => e.k === 'negate' && e.side === 1));
  assert.equal(b.active(1).stages.atk, 0);
  assert.equal(tones(b) & SHOU, SHOU);
});

test('Sanctus: records "Ward" at the end of each turn for 3 turns (together with its own "Clear" and the "Ring" of an attack it makes a Chord)', () => {
  const b = chime(['chime_sanctus', 'chime_ring']);
  setTones(b, 0);
  turn(b, 'chime_sanctus', 't_wait');
  assert.equal(tones(b), QING | SHOU);
  const ev = turn(b, 'chime_ring', 't_wait');
  assert.ok(damageBy(ev, 1, 'chime') > 0, 'Chord');
  assert.equal(tones(b), SHOU, 'after the Chord clears the tones, Sanctus records "Ward" again at the end of the same turn');
});

test('Dispelling Toll: destroys the trap of the opponent after a hit', () => {
  const b = chime(['chime_dispel_toll', 't_wait'], ['t_wait', 't_trap']);
  turn(b, 't_wait', { ...use('t_wait'), trap: 't_trap' });
  assert.ok(b.side(1).trap);
  turn(b, 'chime_dispel_toll', 't_wait');
  assert.equal(b.side(1).trap, null);
});

test('Dawn Carillon: fires a Chord right after a hit, without clearing the recorded tones', () => {
  const b = chime(['u_chime_sprite']);
  setTones(b, 0);
  const ev = turn(b, 'u_chime_sprite', 't_wait');
  assert.equal(damageBy(ev, 1, 'chime'), Math.floor(b.active(1).maxHp * 0.12));
  assert.equal(chords(b), 1);
  assert.equal(tones(b), MING, 'the ultimate itself records "Ring"');
});

// ───────────────────────── `griffin`: Riding ─────────────────────────

const riding = (b: Battle) => (b.active(0).vars['e:grf:mount'] ?? 0) > 0;
const uses = (ev: BattleEvent[], side: SideId, id: string) => ev.filter((e) => e.k === 'use' && e.side === side && e.skillId === id).length;

function griffin(skills: string[], foeSkills = FOE_SKILLS): Battle {
  const b = duel([{ id: 'griffin', skills }], [{ id: FOE, skills: foeSkills }]);
  b.active(1).maxHp = b.active(1).hp = 99999;
  b.active(1).stats.def = 3000;
  return b;
}

test('Paladin\'s Oath: the rider mounts on entering', () => {
  const b = griffin(['t_wait']);
  assert.ok(riding(b));
  assert.equal(mark(b, 0, 'kit:grf_rider')?.note, '騎乘');
});

test('Riding: after an exclusive attack hits, the rider follows up with Knight\'s Lance (×0.5); basic skills get no follow-up', () => {
  const b = griffin(['griffin_charge', 'radiant_slash']);
  const ev = turn(b, 'griffin_charge', 't_wait');
  assert.equal(uses(ev, 0, 'griffin_lance'), 1, 'the rider follows up');
  const [main, rider] = hitsBy(ev, 0);
  assert.ok(rider && rider.dmg > 0 && rider.dmg < main.dmg);
  const ev2 = turn(b, 'radiant_slash', 't_wait');
  assert.equal(uses(ev2, 0, 'griffin_lance'), 0, 'basic skills get no follow-up');
});

test('Knight\'s Lance itself follows up once, and a follow-up never triggers another follow-up', () => {
  const b = griffin(['griffin_lance']);
  const ev = turn(b, 'griffin_lance', 't_wait');
  assert.equal(uses(ev, 0, 'griffin_lance'), 2);
  const [main, rider] = hitsBy(ev, 0);
  assert.ok(Math.abs(rider.dmg / main.dmg - 0.5) < 0.15, `${main.dmg} / ${rider.dmg}`);
});

test('Unseating: taking 25% or more attack damage at once; the attack being guarded', () => {
  const b = griffin(['griffin_lance', 'griffin_remount', 't_wait']);
  const me = b.active(0);
  // Make the opponent's hit about 50% of the griffin's max HP
  b.active(1).stats.atk = Math.ceil((b.active(1).stats.atk * me.maxHp * 0.5) / b.estimate(1, 't_strike'));
  turn(b, 't_wait', 't_strike');
  assert.ok(!me.fainted && me.hp < me.maxHp * 0.7);
  assert.ok(!riding(b), 'a heavy hit unseats the rider');
  assert.equal(mark(b, 0, 'kit:grf_rider')?.note, '落鞍');
  b.active(1).stats.atk = 10;
  turn(b, 'griffin_remount', 't_wait');
  assert.ok(riding(b), 'remounted');
  assert.equal(b.active(0).stages.spd, 1);
  const ev = turn(b, 'griffin_lance', guard());
  assert.equal(uses(ev, 0, 'griffin_lance'), 1, 'guarded: no follow-up');
  assert.ok(!riding(b), 'being guarded unseats the rider');
});

test('Twin Lances: follows up 2 times while riding; Paladin\'s Horn: mounts and heals 30%', () => {
  const b = griffin(['griffin_twin_lance', 'griffin_rally']);
  const ev = turn(b, 'griffin_twin_lance', 't_wait');
  assert.equal(uses(ev, 0, 'griffin_lance'), 2);
  b.active(0).vars['e:grf:mount'] = 0;
  const me = b.active(0);
  me.hp = Math.floor(me.maxHp / 2);
  const hp = me.hp;
  turn(b, 'griffin_rally', 't_wait');
  assert.ok(riding(b));
  assert.equal(me.hp - hp, Math.floor(me.maxHp * 0.3));
});

test('Paladin Charge: +35 while riding; Lone Wing\'s Wrath: +60 while unseated', () => {
  const b = griffin(['griffin_charge', 'griffin_lone_wrath']);
  const cm = b.estimate(0, 'griffin_charge');
  const wm = b.estimate(0, 'griffin_lone_wrath');
  b.active(0).vars['e:grf:mount'] = 0;
  assert.ok(Math.abs(cm / b.estimate(0, 'griffin_charge') - 120 / 85) < 0.05);
  assert.ok(Math.abs(b.estimate(0, 'griffin_lone_wrath') / wm - 140 / 80) < 0.05);
});

test('Rider\'s Sacrifice: usable only while riding; priority +3, damage −60% this turn, the rider is unseated at the end of the turn', () => {
  const b = griffin(['griffin_sacrifice', 't_wait']);
  b.active(1).stats.atk = 600;
  const base = hitsBy(turn(b, 't_wait', 't_quick_strike'), 1)[0].dmg;
  b.active(0).vars['e:grf:mount'] = 1;
  const ev = turn(b, 'griffin_sacrifice', 't_quick_strike');
  assert.equal(firstActor(ev), 0);
  const dmg = hitsBy(ev, 1)[0].dmg;
  assert.ok(dmg / base > 0.3 && dmg / base < 0.5, `${base} → ${dmg}`);
  assert.ok(!riding(b));
  assert.equal(b.canUse(0, 'griffin_sacrifice').ok, false, 'cannot be used while unseated');
});

test('Oath of the Guardian: when it would be knocked out while riding it keeps 1 HP, and the rider is unseated', () => {
  const b = griffin(['t_wait', 'griffin_oath_guard']);
  turn(b, { ...use('t_wait'), trap: 'griffin_oath_guard' }, 't_wait');
  b.active(1).stats.atk = 90000;
  turn(b, 't_wait', 't_strike');
  assert.equal(b.active(0).hp, 1);
  assert.ok(!riding(b));
});

test('Cavalry Breach: while riding the rider follows up at full power (×1.0), then is unseated', () => {
  const b = griffin(['griffin_cavalry', 'griffin_lance']);
  const ev = turn(b, 'griffin_cavalry', 't_wait');
  const hits = hitsBy(ev, 0);
  assert.equal(uses(ev, 0, 'griffin_lance'), 1);
  const lance = hitsBy(turn(b, 'griffin_lance', 't_wait'), 0)[0].dmg;
  assert.ok(Math.abs(hits[1].dmg / lance - 1) < 0.2, `full-power follow-up ≈ Knight's Lance itself (${hits[1].dmg} / ${lance})`);
  assert.ok(!riding(b));
});

test('Winged Paladin: mounts after a hit and follows up 3 times', () => {
  const b = griffin(['u_griffin']);
  b.active(0).vars['e:grf:mount'] = 0;
  const ev = turn(b, 'u_griffin', 't_wait');
  assert.ok(riding(b));
  assert.equal(uses(ev, 0, 'griffin_lance'), 3);
});

// ───────────────────────── `balancescale`: Counterweight ─────────────────────────

/** `balancescale` vs `monolith`; clears the stat changes caused by entry traits. foeMagic: makes the opponent's MAG higher than its ATK */
function scale(skills: string[], foeSkills = FOE_SKILLS, foeMagic = false): Battle {
  const b = duel([{ id: 'balancescale', skills }], [{ id: FOE, skills: foeSkills }]);
  b.active(1).maxHp = b.active(1).hp = 99999;
  if (foeMagic) b.active(1).stats.mag = b.active(1).stats.atk * 2;
  b.resetStages(0);
  b.resetStages(1);
  return b;
}
const st = (b: Battle, side: SideId) => b.active(side).stages;

test('Order: on entering, the higher of the opponent Attack and Magic Power −1; its own stat stages cannot be lowered by the opponent', () => {
  const b = duel([{ id: 'balancescale', skills: ['t_wait'] }], [{ id: FOE, skills: ['t_wait'] }]);
  assert.equal(st(b, 1).atk, -1, 'Monolith Colossus has the higher Attack');
  b.changeStage(0, 'mag', -1, true);
  assert.equal(st(b, 0).mag, 0);
});

test('Counterweight skill: user +1, the same stat of the opponent −1 (the Counterweight mechanic); uses Attack when the opponent Attack is higher; the scale difference is shown on the spirit', () => {
  const b = scale(['balancescale_weight']);
  turn(b, 'balancescale_weight', 't_wait');
  assert.equal(st(b, 0).atk, 1);
  assert.equal(st(b, 1).atk, -1);
  assert.equal(mark(b, 0, 'kit:bs_scale')?.n, 2);
  const m = scale(['balancescale_weight'], FOE_SKILLS, true);
  turn(m, 'balancescale_weight', 't_wait');
  assert.equal(st(m, 0).mag, 1);
  assert.equal(st(m, 1).mag, -1);
});

test('The Counterweight mechanic only lowers by the stages actually gained (no drop once already at +4); Scale Stance, Double Counterweight', () => {
  const b = scale(['balancescale_double_weight', 'balancescale_stance']);
  st(b, 0).mag = 3;
  turn(b, 'balancescale_double_weight', 't_wait');
  assert.equal(st(b, 0).mag, 4);
  assert.equal(st(b, 1).mag, -1, 'only 1 stage was gained');
  turn(b, 'balancescale_stance', 't_wait');
  assert.deepEqual([st(b, 0).def, st(b, 0).res, st(b, 1).def, st(b, 1).res], [1, 1, -1, -1]);
});

test('[Judgment] Scale Ray +5 per point of scale difference; Scale\'s Judgment +15 per point (max +90); the ultimate +10 per point', () => {
  const b = scale(['balancescale_scale_ray', 'balancescale_judgment', 'u_balancescale']);
  // Use speed to create a scale difference (speed does not affect damage)
  const r0 = b.estimate(0, 'balancescale_scale_ray');
  const j0 = b.estimate(0, 'balancescale_judgment');
  const u0 = b.estimate(0, 'u_balancescale');
  st(b, 0).spd = 2;
  st(b, 1).spd = -2;
  assert.ok(Math.abs(b.estimate(0, 'balancescale_scale_ray') / r0 - 70 / 50) < 0.05);
  assert.ok(Math.abs(b.estimate(0, 'balancescale_judgment') / j0 - 125 / 65) < 0.05);
  assert.ok(Math.abs(b.estimate(0, 'u_balancescale') / u0 - 210 / 170) < 0.05);
  st(b, 0).spd = 4;
  st(b, 1).spd = -4;
  assert.ok(Math.abs(b.estimate(0, 'balancescale_judgment') / j0 - 155 / 65) < 0.05, 'at most +90');
});

test('Equalizing Wave: when the opponent side is heavier, clears the stat boosts of the opponent after a hit', () => {
  const b = scale(['balancescale_equalize']);
  st(b, 1).def = 2;
  turn(b, 'balancescale_equalize', 't_wait');
  assert.equal(st(b, 1).def, 0);
  st(b, 0).spd = 3;
  st(b, 1).def = 1;
  turn(b, 'balancescale_equalize', 't_wait');
  assert.equal(st(b, 1).def, 1, 'not cleared when the scale side is heavier');
});

test('Level the Scales: HP ratios move toward the average, each changing by at most 20%; cannot be used twice in a row', () => {
  const b = scale(['balancescale_level', 't_wait']);
  const me = b.active(0);
  const foe = b.active(1);
  me.hp = Math.floor(me.maxHp * 0.2);
  foe.hp = foe.maxHp;
  turn(b, 'balancescale_level', 't_wait');
  assert.ok(Math.abs(me.hp - Math.floor(me.maxHp * 0.4)) <= 1, 'the user gains at most 20%');
  assert.ok(Math.abs(foe.hp - Math.ceil(foe.maxHp * 0.8)) <= 1, 'the opponent loses at most 20%');
  assert.equal(b.canUse(0, 'balancescale_level').ok, false);
  turn(b, 't_wait', 't_wait');
  assert.equal(b.canUse(0, 'balancescale_level').ok, true);
  // When the gap is small it only moves toward the average
  me.hp = Math.floor(me.maxHp * 0.5);
  foe.hp = Math.floor(foe.maxHp * 0.6);
  turn(b, 'balancescale_level', 't_wait');
  assert.ok(Math.abs(me.hp / me.maxHp - foe.hp / foe.maxHp) < 0.01);
});

test('Counterpoise: when a stat of the opponent rises, the same stat of the scale gets +1 (the Counterweight mechanic lowers the opponent by another 1)', () => {
  const b = scale(['t_wait', 'balancescale_counterpoise']);
  turn(b, { ...use('t_wait'), trap: 'balancescale_counterpoise' }, 't_wait');
  turn(b, 't_wait', 't_war_cry');
  assert.equal(st(b, 0).atk, 1);
  assert.equal(st(b, 1).atk, 1, 'opponent +2 −1');
  assert.equal(b.side(0).trap, null);
});

test('Balance Verdict: both sides reset to zero; each point of scale difference deals 5% of max HP damage to the opponent (max 40%)', () => {
  const b = scale(['balance_verdict']);
  st(b, 0).mag = 3;
  st(b, 1).mag = -3;
  st(b, 1).atk = 1;
  const ev = turn(b, 'balance_verdict', 't_wait');
  assert.equal(damageBy(ev, 1, 'verdict'), Math.floor(b.active(1).maxHp * 0.25), 'scale difference 5 → 25%');
  assert.ok(Object.values(st(b, 0)).every((v) => v === 0) && Object.values(st(b, 1)).every((v) => v === 0));
  st(b, 0).mag = 4;
  st(b, 0).res = 4;
  st(b, 1).mag = -4;
  const ev2 = turn(b, 'balance_verdict', 't_wait');
  assert.equal(damageBy(ev2, 1, 'verdict'), Math.floor(b.active(1).maxHp * 0.4), 'at most 40%');
});

test('Scale of Justice (ultimate): Magic Power and Resistance +1 after a hit (the Counterweight mechanic)', () => {
  const b = scale(['u_balancescale']);
  turn(b, 'u_balancescale', 't_wait');
  assert.deepEqual([st(b, 0).mag, st(b, 0).res, st(b, 1).mag, st(b, 1).res], [1, 1, -1, -1]);
});

// ───────────────────────── `candledove`: Peace ─────────────────────────

function dove(skills: string[], foeSkills = FOE_SKILLS): Battle {
  const b = duel([{ id: 'candledove', skills }], [{ id: FOE, skills: foeSkills }]);
  b.active(0).maxHp = b.active(0).hp = 99999;
  b.active(1).maxHp = b.active(1).hp = 99999;
  return b;
}

test('Peace: stat boosts of both sides are cleared at the end of the turn while drops are kept; the mark is shown on the spirit', () => {
  const b = dove(['t_wait']);
  st(b, 0).mag = 2;
  st(b, 0).def = -1;
  st(b, 1).res = -2;
  turn(b, 't_wait', 't_war_cry');
  assert.deepEqual([st(b, 0).mag, st(b, 0).def], [0, -1], 'its own boosts are cleared too');
  assert.deepEqual([st(b, 1).atk, st(b, 1).res], [0, -2], 'a boost of the opponent this turn does not survive the end of the turn');
  assert.equal(mark(b, 0, 'kit:cd_peace')?.note, '和平');
});

test('Peace: boosting and then attacking in the same turn, the boost still applies (it is only cleared at the end of the turn)', () => {
  const b = dove(['t_wait'], ['t_strike']);
  st(b, 1).atk = 2;
  const boosted = b.estimate(1, 't_strike');
  turn(b, 't_wait', 't_strike');
  assert.equal(st(b, 1).atk, 0);
  assert.ok(b.estimate(1, 't_strike') < boosted);
});

test('Morning Bell: all stat stages of both sides reset to zero (rises and drops) and heals 15%', () => {
  const b = dove(['candledove_bell_toll']);
  b.active(0).hp = 50000;
  st(b, 0).def = -2;
  st(b, 1).atk = -1;
  st(b, 1).spd = 1;
  const ev = turn(b, 'candledove_bell_toll', 't_wait');
  assert.ok(Object.values(st(b, 0)).every((v) => v === 0) && Object.values(st(b, 1)).every((v) => v === 0));
  assert.equal(healed(ev, 0), Math.floor(99999 * 0.15));
});

test('Truce: destroys the trap when the opponent sets one, and heals 10%', () => {
  const b = dove(['t_wait', 'candledove_truce'], ['t_wait', 't_trap']);
  b.active(0).hp = 50000;
  turn(b, use('t_wait', 'candledove_truce'), 't_wait');
  const ev = turn(b, 't_wait', use('t_wait', 't_trap'));
  assert.equal(b.side(1).trap, null, 'the trap of the opponent is destroyed');
  assert.equal(b.side(0).trap, null, 'Truce is used up');
  assert.equal(healed(ev, 0), Math.floor(99999 * 0.1));
});

// ───────────────────────── `prismsnail`: Facets ─────────────────────────

const FACETS = 'e:pri:facets';
const facets = (b: Battle) => b.active(0).vars[FACETS] ?? 0;

function snail(skills: string[], foeSkills = FOE_SKILLS): Battle {
  const b = duel([{ id: 'prismsnail', skills }], [{ id: FOE, skills: foeSkills }]);
  b.active(0).maxHp = b.active(0).hp = 99999;
  b.active(1).maxHp = b.active(1).hp = 99999;
  return b;
}
const dealtTo = (ev: BattleEvent[], attacker: SideId) => hitsBy(ev, attacker).reduce((s, h) => s + h.dmg, 0);

test('Prism (rewritten): reflects 20% + 10% per facet of a magic attack; a physical attack shatters 1 facet and is not reflected', () => {
  const b = snail(['t_wait']);
  b.active(0).vars[FACETS] = 2;
  const ev = turn(b, 't_wait', 't_bolt');
  const dealt = dealtTo(ev, 1);
  assert.ok(dealt > 0);
  assert.equal(damageBy(ev, 1, 'reflect'), Math.max(1, Math.floor(dealt * 0.4)), 'only the rewritten Prism (the old trait no longer stacks)');
  assert.equal(facets(b), 2, 'magic does not shatter facets');
  const ev2 = turn(b, 't_wait', 't_strike');
  assert.equal(damageBy(ev2, 1, 'reflect'), 0);
  assert.equal(facets(b), 1);
  assert.equal(mark(b, 0, 'kit:ps_facet')?.n, 1);
});

test('Prism: no reflection when knocked out', () => {
  const b = snail(['t_wait']);
  b.active(0).hp = 1;
  const ev = turn(b, 't_wait', 't_bolt');
  assert.ok(b.active(0).fainted);
  assert.equal(damageBy(ev, 1, 'reflect'), 0);
});

test('Facets: Polish, Rose Window and Stained Glass give +1 each, Glass Armor fills to 3, at most 3 facets', () => {
  const b = snail(['prismsnail_polish', 'prismsnail_rose_window', 'prismsnail_stained_glass', 'prismsnail_glass_armor']);
  turn(b, 'prismsnail_polish', 't_wait');
  assert.equal(facets(b), 1);
  assert.equal(st(b, 0).res, 1);
  turn(b, 'prismsnail_rose_window', 't_wait');
  assert.equal(facets(b), 2);
  assert.ok(b.side(0).screens.magTurns > 0);
  turn(b, 'prismsnail_stained_glass', 't_wait');
  assert.equal(facets(b), 3);
  turn(b, 'prismsnail_polish', 't_wait');
  assert.equal(facets(b), 3, 'at most 3 facets');
  b.active(0).vars[FACETS] = 0;
  turn(b, 'prismsnail_glass_armor', 't_wait');
  assert.equal(facets(b), 3);
  assert.equal(st(b, 0).def, 1);
});

test('[Prismatic] Glint +5 per facet, Prism Refraction +10, Seven-Color Ray +10, the ultimate +20', () => {
  const b = snail(['prismsnail_glint', 'prism_refract', 'prismsnail_rainbow', 'u_prismsnail']);
  const ids = ['prismsnail_glint', 'prism_refract', 'prismsnail_rainbow', 'u_prismsnail'];
  const base = ids.map((id) => b.estimate(0, id));
  b.active(0).vars[FACETS] = 3;
  const want = [65 / 50, 115 / 85, 145 / 115, 230 / 170];
  ids.forEach((id, i) => assert.ok(Math.abs(b.estimate(0, id) / base[i] - want[i]) < 0.05, id));
});

test('Rose Window Radiance: fills the facets to 3 after a hit', () => {
  const b = snail(['u_prismsnail']);
  turn(b, 'u_prismsnail', 't_wait');
  assert.equal(facets(b), 3);
});

test('Mirror Shell: damage −30% when the opponent attacks, and facets +1 before the damage (Prism counts this facet; a physical skill then smashes it)', () => {
  const b = snail(['t_wait', 'prismsnail_mirror']);
  const plain = dealtTo(turn(b, 't_wait', 't_bolt'), 1);
  turn(b, use('t_wait', 'prismsnail_mirror'), 't_wait');
  const ev = turn(b, 't_wait', 't_bolt');
  const dealt = dealtTo(ev, 1);
  assert.ok(ev.some((e) => e.k === 'trap' && e.side === 0 && e.skillId === 'prismsnail_mirror'));
  assert.ok(Math.abs(dealt / plain - 0.7) < 0.1, `30% damage reduction (${dealt}/${plain})`);
  assert.equal(facets(b), 1);
  assert.equal(damageBy(ev, 1, 'reflect'), Math.max(1, Math.floor(dealt * 0.3)), '20% + the 1 facet just polished');
  turn(b, use('t_wait', 'prismsnail_mirror'), 't_wait');
  turn(b, 't_wait', 't_strike');
  assert.equal(facets(b), 1, 'physical skill: +1, then 1 facet is smashed');
});
