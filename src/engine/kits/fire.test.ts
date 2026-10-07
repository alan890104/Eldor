// Mechanic tests for the fire group: node --test src/engine/kits/fire.test.ts
// `ignisar`: Flame Hue (Red Flame / White Flame / Azure Flame), Royal Flame Domain; `magma_golem`: Forged Runes, Magma Body; `phoenix`: Embers, Rebirth;
// `pyre_dragoon`: Momentum, Dragoon's Heart; `steameel`: Vaporize, Steam Rise; `pyrewing`: Scale Dust; `bellowsbeast`: Kindling, Ignite; `shieldbeetle`: Hold, Knight's Shield;
// plus the effect of every hooked skill.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSkill } from '../../data.ts';
import { chooseAction } from '../ai.ts';
import type { Battle } from '../battle.ts';
import type { AttackCtx } from '../skillfx.ts';
import { dustOn, embersOf, hasRune, holdOf, hueOf, KIT, momentumOf, rebornUsed, runeCount, sparkLit, vaporOf } from './fire.ts';
import { registerKitHooks } from './index.ts';
import { duel, guard, hitsBy, sw, turn, use, useTestSkills } from '../testkit.ts';
import type { BattleEvent, SideId } from '../types.ts';

useTestSkills();
// The opposing spirits carry no kit hooks (other groups' mechanics may still be changing); only the behavior of the t_ test skills is left
for (const id of ['monolith', 'cloudfluff', 'bubblecrab']) registerKitHooks(id, null);

const HUE = 'e:ign:hue';
const setHue = (b: Battle, n: number) => void (b.active(0).vars[HUE] = n);
const hueMark = (b: Battle) => b.view().sides[0].team[b.side(0).active].marks.find((m) => m.id === 'kit:hue')?.note;
const dealtTo = (ev: BattleEvent[], attacker: SideId) => hitsBy(ev, attacker).reduce((a, h) => a + h.dmg + h.shieldDmg, 0);
/** Damage with crit and variance removed (a crit x1.5 converted back to normal damage) */
const plainDealt = (ev: BattleEvent[], attacker: SideId) => hitsBy(ev, attacker).reduce((a, h) => a + (h.dmg + h.shieldDmg) / (h.crit ? 1.5 : 1), 0);
const usedOrder = (ev: BattleEvent[]) => ev.filter((e) => e.k === 'use').map((e) => (e as { side: SideId }).side);
const noSun = (b: Battle) => void (b.s.field = null);
/** Lets the opponent survive (the tests check effects, not KOs) */
const sturdy = (b: Battle, id: SideId = 1) => {
  const d = b.active(id);
  d.maxHp = d.hp = 100000;
};

const lion = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'ignisar', skills }, ...extra];
const foe = (skills = ['t_strike', 't_bolt', 't_wait'], id = 'monolith') => [{ id, skills }];

// ───────────────────────── Trait: Royal Flame Domain ─────────────────────────

test('Hue: enters at White Flame; Royal Flame Domain starts 3 turns of Blazing Sun, and Hue rises one step at the end of each sunny turn', () => {
  const b = duel(lion(['t_wait']), foe(['t_wait']));
  assert.equal(b.s.field?.element, 'fire');
  assert.equal(b.s.field?.turns, 3);
  assert.equal(hueOf(b, 0), 1);
  assert.equal(hueMark(b), '白焰');
  turn(b, 't_wait', 't_wait');
  assert.equal(hueOf(b, 0), 2);
  assert.equal(hueMark(b), '蒼焰・過熱');
  setHue(b, 0);
  assert.equal(hueMark(b), '赤焰');
});

test('Royal Flame Domain: Blazing Sun burns only for the king, so fire attacks against Ignisar get no sun boost', () => {
  const b = duel(lion(['t_wait']), foe(['ember']), 3);
  const sun = plainDealt(turn(b, 't_wait', 'ember'), 1);
  noSun(b);
  const none = plainDealt(turn(b, 't_wait', 'ember'), 1);
  const r = sun / none;
  assert.ok(r > 0.9 && r < 1.1, `Damage ratio with Blazing Sun / without ${r.toFixed(2)} ≈ 1 (an ordinary spirit gets 1.3)`);
});

test('Hue: resets on leaving the field; re-entering starts at White Flame again', () => {
  const b = duel(lion(['t_wait'], [{ id: 'cloudfluff', skills: ['t_wait'] }]), foe(['t_wait']));
  setHue(b, 2);
  turn(b, sw(1), 't_wait');
  assert.equal(b.side(0).team[0].vars[HUE], undefined, 'cleared on leaving the field');
  turn(b, sw(0), 't_wait');
  assert.equal(b.active(0).species.id, 'ignisar');
  assert.equal(hueOf(b, 0), 2, 'enters at White Flame; the re-opened Blazing Sun raises it one more step at the end of the turn');
});

// ───────────────────────── Mechanic: Flame Hue ─────────────────────────

test('Azure Flame: overheats at the end of the turn and loses 8% max HP; without Blazing Sun Hue does not rise on its own', () => {
  const b = duel(lion(['t_wait']), foe(['t_wait']));
  const c = b.active(0);
  setHue(b, 2);
  const hp = c.hp;
  turn(b, 't_wait', 't_wait');
  assert.equal(hp - c.hp, Math.floor(c.maxHp * 0.08));
  noSun(b);
  setHue(b, 0);
  turn(b, 't_wait', 't_wait');
  assert.equal(hueOf(b, 0), 0);
});

test('Hue: rises one step after the first attack received each turn (the slower king is hit first and burns even hotter)', () => {
  const b = duel(lion(['t_wait']), foe(['t_strike', 't_wait']));
  noSun(b);
  setHue(b, 0);
  turn(b, 't_wait', 't_strike');
  assert.equal(hueOf(b, 0), 1);
  turn(b, 't_wait', 't_wait');
  assert.equal(hueOf(b, 0), 1, 'not hit and no Blazing Sun: unchanged');
  turn(b, 't_wait', 't_strike');
  assert.equal(hueOf(b, 0), 2);
});

test('White Flame or higher: fire attacks are not resisted and are not weakened by Downpour', () => {
  const b = duel(lion(['ignisar_mane_flare']), foe(['t_wait'], 'bubblecrab'));
  const ctx: AttackCtx = { attacker: 0, defender: 1, sk: getSkill('ignisar_mane_flare'), cat: 'magic' };
  const mult = () => KIT.ignisar.typeMult!(b, ctx, 0.75);
  const bonus = () => KIT.ignisar.attackBonus!(b, ctx);
  setHue(b, 0);
  assert.equal(mult(), 0.75, 'Red Flame: resisted as usual');
  assert.equal(b.effOf(0, ctx.sk, 'magic'), 0.75);
  const red = b.estimate(0, 'ignisar_mane_flare');
  setHue(b, 1);
  assert.equal(mult(), 1, 'White Flame: the matchup multiplier returns to ×1');
  assert.equal(b.effOf(0, ctx.sk, 'magic'), 1, 'the in-battle multiplier (which also decides the "not very effective" text)');
  assert.equal(KIT.ignisar.typeMult!(b, ctx, 2), 2, 'super effective is unaffected');
  assert.equal(bonus(), 0, 'no Downpour: nothing to make up');
  const white = b.estimate(0, 'ignisar_mane_flare');
  assert.ok(Math.abs(white / red - (60 / 45) / 0.75) < 0.02, `White Flame ${white.toFixed(0)} / Red Flame ${red.toFixed(0)}`);
  const ev = turn(b, 'ignisar_mane_flare', 't_wait');
  const hit = ev.find((e) => e.k === 'hit' && e.side === 0) as { eff?: number } | undefined;
  assert.equal(hit?.eff, 1, 'the hit event is no longer "not very effective"');
  b.s.field = { element: 'water', turns: 3 };
  assert.ok(Math.abs(bonus() - (1 / 0.7 - 1)) < 1e-9, 'the ×0.7 from Downpour is made up');
});

test('Azure Flame: fire attacks ignore guard and shields; at White Flame they are guarded as usual', () => {
  const a = duel(lion(['ignisar_mane_flare']), foe(['t_wait']));
  let ev = turn(a, 'ignisar_mane_flare', guard());
  assert.ok(ev.some((e) => e.k === 'guarded' && !e.broke), 'White Flame is guarded');
  assert.equal(dealtTo(ev, 0), 0);

  const b = duel(lion(['ignisar_mane_flare']), foe(['t_wait']));
  setHue(b, 2);
  ev = turn(b, 'ignisar_mane_flare', guard());
  assert.ok(ev.some((e) => e.k === 'guarded' && e.broke), 'Azure Flame breaks through the guard');
  assert.ok(dealtTo(ev, 0) > 0);

  const c = duel(lion(['ignisar_mane_flare']), foe(['t_wait']));
  setHue(c, 2);
  c.giveShield(1, 30);
  ev = turn(c, 'ignisar_mane_flare', 't_wait');
  const h = hitsBy(ev, 0)[0];
  assert.equal(h.shieldDmg, 0, 'ignores the shield');
  assert.ok(h.dmg > 0);
});

// ───────────────────────── Skills ─────────────────────────

test('Mane Flare: +15 power per Hue step', () => {
  const b = duel(lion(['ignisar_mane_flare']), foe(['t_wait']));
  setHue(b, 1);
  const w = b.estimate(0, 'ignisar_mane_flare');
  setHue(b, 2);
  const bl = b.estimate(0, 'ignisar_mane_flare');
  assert.ok(Math.abs(bl / w - 75 / 60) < 0.02);
});

test('Royal Roar: Hue rises one step and the opponent gets ATK −1; the AI roars at Red Flame and does not at Azure Flame', () => {
  const b = duel(lion(['ignisar_royal_roar', 'ignisar_mane_flare', 'ignisar_corona_burst']), foe(['t_wait']));
  sturdy(b);
  noSun(b);
  setHue(b, 0);
  // The opponent has no aether (so it will not use an ultimate), and the AI does not need to guard
  const pick = () => {
    b.side(1).aether = 0;
    b.active(0).lastGuardTurn = b.s.turn;
    return (chooseAction(b, 0, { skill: 1 }).main as { skillId?: string }).skillId;
  };
  assert.equal(pick(), 'ignisar_royal_roar', 'roars first at Red Flame');
  turn(b, 'ignisar_royal_roar', 't_wait');
  assert.equal(hueOf(b, 0), 1);
  assert.equal(b.active(1).stages.atk, -1);
  setHue(b, 2);
  assert.equal(pick(), 'ignisar_corona_burst', 'releases Corona Burst at Azure Flame');
});

test('Radiant Claw: always crits at Azure Flame', () => {
  const b = duel(lion(['ignisar_radiant_claw']), foe(['t_wait']));
  sturdy(b);
  setHue(b, 2);
  for (let i = 0; i < 3; i++) {
    const ev = turn(b, 'ignisar_radiant_claw', 't_wait');
    assert.ok(hitsBy(ev, 0).every((h) => h.crit));
    setHue(b, 2);
  }
});

test('White-Hot Breath: +35 power per step, back to Red Flame after hitting', () => {
  const b = duel(lion(['ignisar_white_breath']), foe(['t_wait']));
  sturdy(b);
  noSun(b);
  setHue(b, 0);
  const red = b.estimate(0, 'ignisar_white_breath');
  setHue(b, 2);
  const blue = b.estimate(0, 'ignisar_white_breath');
  assert.ok(Math.abs(blue / red - 140 / 70) < 0.02);
  turn(b, 'ignisar_white_breath', 't_wait');
  assert.equal(hueOf(b, 0), 0);
});

test("Purging Blaze: removes the opponent side's timed effects (Crystal Wall, Light Veil)", () => {
  const b = duel(lion(['ignisar_purge']), foe(['t_wait']));
  sturdy(b);
  b.setScreen(1, 'phys', 20, 5);
  b.setScreen(1, 'mag', 20, 5);
  turn(b, 'ignisar_purge', 't_wait');
  assert.equal(b.side(1).screens.physTurns, 0);
  assert.equal(b.side(1).screens.magTurns, 0);
});

test('Lion Pounce: +1 priority at Azure Flame, moving before a faster opponent', () => {
  const b = duel(lion(['ignisar_lion_pounce']), foe(['t_strike']));
  sturdy(b);
  b.active(1).stats.spd = 9999;
  noSun(b);
  setHue(b, 1);
  assert.deepEqual(usedOrder(turn(b, 'ignisar_lion_pounce', 't_strike')), [1, 0]);
  setHue(b, 2);
  assert.deepEqual(usedOrder(turn(b, 'ignisar_lion_pounce', 't_strike')), [0, 1]);
});

test('Corona Burst: +40 power per step; back to Red Flame after hitting, and each step spent gives 1 Aether', () => {
  const b = duel(lion(['ignisar_corona_burst']), foe(['t_wait']));
  sturdy(b);
  setHue(b, 0);
  const red = b.estimate(0, 'ignisar_corona_burst');
  setHue(b, 2);
  const blue = b.estimate(0, 'ignisar_corona_burst');
  assert.ok(Math.abs(blue / red - 160 / 80) < 0.02);
  b.side(0).aether = 5;
  b.resolveTurn([use('ignisar_corona_burst'), use('t_wait')]);
  assert.equal(b.side(0).aether, 5 - 3 + 2 + 2, 'costs 3, two steps spent +2, end of turn +2');
  assert.equal(hueOf(b, 0), 1, 'back to Red Flame; in Blazing Sun it rises to White Flame again at the end of the turn');
});

test('Banked Mane: spends all Hue, heals 20% per step, and cleanses status conditions', () => {
  const b = duel(lion(['ignisar_banked_mane']), foe(['t_wait']));
  noSun(b);
  const c = b.active(0);
  setHue(b, 2);
  c.hp = Math.floor(c.maxHp * 0.3);
  b.applyStatus(0, 'poison', 2);
  const before = c.hp;
  turn(b, 'ignisar_banked_mane', 't_wait');
  assert.equal(hueOf(b, 0), 0);
  assert.equal(c.status.poison, undefined);
  assert.equal(c.hp, before + Math.floor((c.maxHp * 40) / 100), 'heals 40%, no overheating');
});

test('No Retreat: when the opponent declares a switch, the switch fails and the opponent is burned', () => {
  const b = duel(lion(['t_wait', 'ignisar_no_retreat']), [
    { id: 'monolith', skills: ['t_wait'] },
    { id: 'cloudfluff', skills: ['t_wait'] },
  ]);
  turn(b, use('t_wait', 'ignisar_no_retreat'), 't_wait');
  assert.equal(b.side(0).trap?.skillId, 'ignisar_no_retreat');
  const ev = turn(b, 't_wait', sw(1));
  assert.equal(b.side(1).active, 0, 'switch failed');
  assert.ok(b.active(1).status.burn, 'Burn');
  assert.ok(ev.some((e) => e.k === 'fail' && e.reason === '替換失敗'));
  assert.equal(b.side(0).trap, null);
});

test("Royal Verdict: dispels the opponent's buffs and shield", () => {
  const b = duel(lion(['ignisar_royal_verdict']), foe(['t_wait']));
  sturdy(b);
  b.changeStage(1, 'atk', 2);
  turn(b, 'ignisar_royal_verdict', 't_wait');
  assert.equal(b.active(1).stages.atk, 0);
});

test('High Noon: Hue rises one step after hitting', () => {
  const b = duel(lion(['ignisar_high_noon']), foe(['t_wait']));
  sturdy(b);
  noSun(b);
  setHue(b, 0);
  turn(b, 'ignisar_high_noon', 't_wait');
  assert.equal(hueOf(b, 0), 1);
});

test('Endless Day: for 5 turns Blazing Sun is restored at the end of the turn even if overwritten; it stops working once timed effects are cleared', () => {
  const b = duel(lion(['ignisar_endless_day', 't_wait']), foe(['t_wait', 't_rain']));
  turn(b, 'ignisar_endless_day', 't_wait');
  assert.equal(b.s.field?.element, 'fire');
  assert.ok(b.getLasting(0, 'ignisar_endless_day'));
  turn(b, 't_wait', 't_rain');
  assert.equal(b.s.field?.element, 'fire', 'Downpour is overwritten back to Blazing Sun');
  b.clearLasting(0, 'own');
  turn(b, 't_wait', 't_rain');
  assert.equal(b.s.field?.element, 'water', 'Endless Day cannot hold after being cleared');
});

test('Corona Roar: after use (even if guarded) enters Corona: Hue locked at Azure Flame, no overheating, skill costs −1', () => {
  const b = duel(lion(['ignisar_corona_burst', 't_wait']), foe(['t_wait']));
  sturdy(b);
  noSun(b);
  setHue(b, 0);
  const ev = turn(b, 'u_ignisar', guard());
  assert.ok(ev.some((e) => e.k === 'guarded' && !e.broke), 'ultimate is guarded at Red Flame');
  assert.ok(b.getLasting(0, 'u_ignisar'), 'Corona still begins');
  assert.equal(hueOf(b, 0), 2);
  assert.equal(b.costFor(0, getSkill('ignisar_corona_burst')), 2);
  const c = b.active(0);
  const hp = c.hp;
  b.side(0).aether = 3;
  b.resolveTurn([use('ignisar_corona_burst'), use('t_wait')]);
  assert.equal(hueOf(b, 0), 2, 'releasing during Corona does not cool Hue down');
  assert.equal(c.hp, hp, 'no overheating during Corona');
  assert.equal(b.side(0).aether, 3 - 2 + 2, 'cost −1; no Hue spent, so no Aether back');
});

test('Corona Roar: used at Azure Flame, the ultimate also breaks through guard', () => {
  const b = duel(lion(['t_wait']), foe(['t_wait']));
  sturdy(b);
  setHue(b, 2);
  const ev = turn(b, 'u_ignisar', guard());
  assert.ok(ev.some((e) => e.k === 'guarded' && e.broke));
  assert.ok(dealtTo(ev, 0) > 0);
});

// ═════════════════════════ `magma_golem`: Forged Runes ═════════════════════════

const golem = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'magma_golem', skills }, ...extra];
const runeMark = (b: Battle) => b.view().sides[0].team[b.side(0).active].marks.find((m) => m.id === 'kit:rune')?.note;
const setRunes = (b: Battle, ...rs: ('flame' | 'edge' | 'heavy')[]) => {
  for (const r of rs) b.active(0).vars[`e:mgl:${r}`] = 1;
};

test('Forge Fist: forges a Flame Rune (even if guarded); the mark shows the runes held', () => {
  const b = duel(golem(['golem_forge_fist']), foe(['t_wait']));
  sturdy(b);
  assert.equal(runeMark(b), undefined);
  turn(b, 'golem_forge_fist', guard());
  assert.ok(hasRune(b, 0, 'flame'));
  assert.equal(runeMark(b), '鍛紋：焰');
});

test('Quench: forges an Edge Rune and ATK +1; Casting Blow carrying an Edge Rune always crits, and the runes clear after casting', () => {
  const b = duel(golem(['golem_quench', 'golem_cast_strike']), foe(['t_wait']));
  sturdy(b);
  turn(b, 'golem_quench', 't_wait');
  assert.ok(hasRune(b, 0, 'edge'));
  assert.equal(b.active(0).stages.atk, 1);
  const ev = turn(b, 'golem_cast_strike', 't_wait');
  assert.ok(hitsBy(ev, 0).every((h) => h.crit), 'Edge Rune: always crits');
  assert.equal(runeCount(b, 0), 0, 'runes clear after casting');
});

test('Anvil Stance: forges a Heavy Rune and grants a shield; casting with a Heavy Rune breaks through guard, without one it is blocked (the rune is still spent)', () => {
  const b = duel(golem(['golem_anvil_stance', 'golem_cast_strike', 't_wait']), foe(['t_wait']));
  sturdy(b);
  turn(b, 'golem_anvil_stance', 't_wait');
  assert.ok(hasRune(b, 0, 'heavy'));
  assert.ok((b.active(0).shield?.amount ?? 0) >= Math.floor(b.active(0).maxHp * 0.2) - 1, '20% shield');
  let ev = turn(b, 'golem_cast_strike', guard());
  assert.ok(ev.some((e) => e.k === 'guarded' && e.broke), 'Heavy Rune: ignores guard');
  assert.ok(dealtTo(ev, 0) > 0);
  turn(b, 't_wait', 't_wait');
  setRunes(b, 'edge');
  ev = turn(b, 'golem_cast_strike', guard());
  assert.ok(ev.some((e) => e.k === 'guarded' && !e.broke), 'no Heavy Rune: guarded');
  assert.equal(runeCount(b, 0), 0, 'guarded, and the rune is spent anyway');
});

test('Flame Rune: a cast that hits burns the opponent', () => {
  const b = duel(golem(['golem_cast_strike']), foe(['t_wait']));
  sturdy(b);
  setRunes(b, 'flame');
  turn(b, 'golem_cast_strike', 't_wait');
  assert.ok(b.active(1).status.burn);
});

test('Thousand Hammers: +25 power per rune', () => {
  const b = duel(golem(['golem_thousand_hammers']), foe(['t_wait']));
  sturdy(b);
  const none = b.estimate(0, 'golem_thousand_hammers');
  setRunes(b, 'flame', 'heavy');
  const two = b.estimate(0, 'golem_thousand_hammers');
  assert.ok(Math.abs(two / none - 160 / 110) < 0.02, `Two runes ${two.toFixed(0)} / no runes ${none.toFixed(0)}`);
});

test('Magma Mend: heals 30% and forges a Flame Rune; Lava Hammer: forges a Heavy Rune', () => {
  const b = duel(golem(['golem_magma_mend', 'golem_lava_hammer']), foe(['t_wait']));
  sturdy(b);
  const c = b.active(0);
  c.hp = Math.floor(c.maxHp / 2);
  const hp = c.hp;
  turn(b, 'golem_magma_mend', 't_wait');
  assert.equal(c.hp - hp, Math.floor(c.maxHp * 0.3));
  assert.ok(hasRune(b, 0, 'flame'));
  turn(b, 'golem_lava_hammer', 't_wait');
  assert.ok(hasRune(b, 0, 'heavy'));
});

test('Lava Pit: cuts damage by 40% when an opposing physical skill hits, and forges all three runes; magic does not trigger it', () => {
  const b = duel(golem(['t_wait', 'golem_lava_pit']), foe(['t_strike', 't_bolt']));
  const plain = plainDealt(turn(b, 't_wait', 't_strike'), 1);
  turn(b, use('t_wait', 'golem_lava_pit'), 't_wait');
  turn(b, 't_wait', 't_bolt');
  assert.equal(b.side(0).trap?.skillId, 'golem_lava_pit', 'magic does not trigger');
  const ev = turn(b, 't_wait', 't_strike');
  assert.equal(b.side(0).trap, null);
  assert.equal(runeCount(b, 0), 3);
  const cut = plainDealt(ev, 1) / plain;
  assert.ok(cut > 0.5 && cut < 0.7, `Ratio after damage reduction ${cut.toFixed(2)} ≈ 0.6`);
});

test('Trample: destroys the trap the opponent has set', () => {
  const b = duel(golem(['golem_trample']), foe(['t_wait', 't_trap']));
  sturdy(b);
  turn(b, 't_wait', use('t_wait', 't_trap'));
  assert.ok(b.side(1).trap);
  turn(b, 'golem_trample', 't_wait');
  assert.equal(b.side(1).trap, null);
});

test('Undying Forge: for 3 turns casting does not clear runes (and forges a Flame Rune); they clear as usual once the effect ends', () => {
  const b = duel(golem(['golem_eternal_forge', 'golem_cast_strike', 't_wait']), foe(['t_wait']));
  sturdy(b);
  setRunes(b, 'edge');
  turn(b, 'golem_eternal_forge', 't_wait');
  assert.ok(hasRune(b, 0, 'flame'));
  turn(b, 'golem_cast_strike', 't_wait');
  turn(b, 'golem_cast_strike', 't_wait');
  assert.equal(runeCount(b, 0), 2, 'runes remain after two casts');
  assert.equal(b.getLasting(0, 'golem_eternal_forge'), undefined, 'expires after 3 turns');
  turn(b, 'golem_cast_strike', 't_wait');
  assert.equal(runeCount(b, 0), 0);
});

test('Molten Colossus: casts with runes carried, then forges all three runes after use', () => {
  const b = duel(golem(['t_wait']), foe(['t_wait']));
  sturdy(b);
  setRunes(b, 'edge');
  const ev = turn(b, 'u_magma_golem', 't_wait');
  assert.ok(hitsBy(ev, 0).every((h) => h.crit), 'Edge Rune crit');
  assert.equal(runeCount(b, 0), 3);
});

test('Magma Body: with a Flame Rune, a physical attacker is always burned; a magic attacker is not; the runes cool and vanish on leaving the field', () => {
  const b = duel(golem(['t_wait'], [{ id: 'cloudfluff', skills: ['t_wait'] }]), foe(['t_strike', 't_bolt']));
  setRunes(b, 'flame');
  turn(b, 't_wait', 't_bolt');
  assert.ok(!b.active(1).status.burn, 'magic does not trigger');
  const ev = turn(b, 't_wait', 't_strike');
  assert.ok(b.active(1).status.burn);
  assert.ok(ev.some((e) => e.k === 'trait' && e.name === '熔岩之軀'));
  turn(b, sw(1), 't_wait');
  turn(b, sw(0), 't_wait');
  assert.equal(runeCount(b, 0), 0, 'runes cool off after leaving the field');
});

test('AI: Magma Golem forges first when it has no runes, and casts only once it has enough', () => {
  const b = duel(golem(['golem_thousand_hammers', 'golem_quench', 'golem_forge_fist']), foe(['t_wait']));
  sturdy(b);
  b.side(1).aether = 0;
  const pick = () => {
    const a = chooseAction(b, 0, { skill: 1 });
    return a.main.type === 'skill' ? a.main.skillId : a.main.type;
  };
  assert.equal(pick(), 'golem_quench');
  setRunes(b, 'edge', 'flame');
  assert.equal(pick(), 'golem_thousand_hammers');
});

// ═════════════════════════ `phoenix`: Embers and Rebirth ═════════════════════════

const bird = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'phoenix', skills }, ...extra];
const setEmbers = (b: Battle, n: number) => void (b.active(0).vars['phx:ember'] = n);
const phxMarks = (b: Battle) => b.view().sides[0].team[b.side(0).active].marks.map((m) => `${m.note}${m.n ?? ''}`).join('｜');

test('Burning Plume: loses 5% HP and gains 1 Ember after use; Skyfire: loses 10% and gains 2; Embers cap at 5', () => {
  const b = duel(bird(['phoenix_burning_plume', 'phoenix_skyfire']), foe(['t_wait']));
  sturdy(b);
  const c = b.active(0);
  assert.equal(phxMarks(b), '涅槃・缺餘燼');
  turn(b, 'phoenix_burning_plume', 't_wait');
  assert.equal(c.maxHp - c.hp, Math.floor(c.maxHp * 0.05));
  assert.equal(embersOf(b, 0), 1);
  assert.equal(phxMarks(b), '餘燼1｜涅槃');
  const hp = c.hp;
  turn(b, 'phoenix_skyfire', 't_wait');
  assert.equal(hp - c.hp, Math.floor(c.maxHp * 0.1));
  assert.equal(embersOf(b, 0), 3);
  turn(b, 'phoenix_skyfire', 't_wait');
  turn(b, 'phoenix_skyfire', 't_wait');
  assert.equal(embersOf(b, 0), 5, 'at most 5');
});

test('Nirvana: burns all Embers to revive (10% per Ember) and cleanses status conditions; the reborn spirit acts last next turn', () => {
  const b = duel(bird(['t_wait']), foe(['t_strike', 't_wait']));
  const c = b.active(0);
  setEmbers(b, 3);
  c.status.poison = { turns: 3, stacks: 2 };
  c.hp = 1;
  const ev = turn(b, 't_wait', 't_strike');
  assert.ok(ev.some((e) => e.k === 'trait' && e.name === '涅槃'));
  assert.ok(!c.fainted);
  assert.equal(c.hp, Math.floor(c.maxHp * 0.3));
  assert.equal(embersOf(b, 0), 0);
  assert.ok(!c.status.poison, 'status conditions cleansed');
  assert.ok(rebornUsed(b, 0));
  assert.equal(phxMarks(b), '新生・最後行動');
  assert.deepEqual(usedOrder(turn(b, 't_wait', 't_wait')), [1, 0], 'reborn: slower than an opponent with 35 speed');
  assert.deepEqual(usedOrder(turn(b, 't_wait', 't_wait')), [0, 1], 'then the original speed is restored');
  c.hp = 1;
  turn(b, 't_wait', 't_strike');
  assert.ok(c.fainted, 'Nirvana works once per battle');
});

test('Nirvana: no revival without Embers or while Cursed', () => {
  const a = duel(bird(['t_wait']), foe(['t_strike']));
  a.active(0).hp = 1;
  turn(a, 't_wait', 't_strike');
  assert.ok(a.active(0).fainted, 'no Embers');
  const b = duel(bird(['t_wait']), foe(['t_strike']));
  setEmbers(b, 4);
  b.active(0).hp = 1;
  b.active(0).status.curse = { turns: 3 };
  assert.equal(phxMarks(b), '餘燼4｜涅槃・被詛咒封住');
  turn(b, 't_wait', 't_strike');
  assert.ok(b.active(0).fainted, 'cannot use Nirvana while Cursed');
});

test('Burning Plume killing its own user still triggers Nirvana (using the Ember just gained); once Nirvana is spent, Burning Plume cannot be used when HP is too low', () => {
  const b = duel(bird(['phoenix_burning_plume', 't_wait']), foe(['t_wait']));
  sturdy(b);
  const c = b.active(0);
  c.hp = 5;
  turn(b, 'phoenix_burning_plume', 't_wait');
  assert.ok(!c.fainted && rebornUsed(b, 0));
  assert.equal(c.hp, Math.floor(c.maxHp * 0.1), '1 Ember → 10%');
  c.hp = Math.floor(c.maxHp * 0.05);
  assert.equal(b.canUse(0, 'phoenix_burning_plume').ok, false);
  c.hp += 1;
  assert.equal(b.canUse(0, 'phoenix_burning_plume').ok, true);
});

test('Cinder Wing: +15 power per Ember (not consumed)', () => {
  const b = duel(bird(['phoenix_cinder_wing']), foe(['t_wait']));
  sturdy(b);
  const none = b.estimate(0, 'phoenix_cinder_wing');
  setEmbers(b, 4);
  const four = b.estimate(0, 'phoenix_cinder_wing');
  assert.ok(Math.abs(four / none - 135 / 75) < 0.02);
  turn(b, 'phoenix_cinder_wing', 't_wait');
  assert.equal(embersOf(b, 0), 4);
});

test('Ember Nova: +40 power per Ember, consuming all Embers on use (even if guarded)', () => {
  const b = duel(bird(['phoenix_ember_nova']), foe(['t_wait']));
  sturdy(b);
  const none = b.estimate(0, 'phoenix_ember_nova');
  setEmbers(b, 3);
  const three = b.estimate(0, 'phoenix_ember_nova');
  assert.ok(Math.abs(three / none - 210 / 90) < 0.02);
  turn(b, 'phoenix_ember_nova', guard());
  assert.equal(embersOf(b, 0), 0);
});

test('Ember Veil: consumes all Embers for a 12% shield each; cannot be used without Embers', () => {
  const b = duel(bird(['phoenix_ember_veil']), foe(['t_wait']));
  assert.equal(b.canUse(0, 'phoenix_ember_veil').ok, false);
  setEmbers(b, 3);
  turn(b, 'phoenix_ember_veil', 't_wait');
  assert.equal(b.active(0).shield?.amount, Math.floor(b.active(0).maxHp * 0.36));
  assert.equal(embersOf(b, 0), 0);
});

test('Soul Kindle: loses 10% HP, gains 2 Embers and 2 Aether', () => {
  const b = duel(bird(['phoenix_soul_kindle']), foe(['t_wait']));
  const c = b.active(0);
  b.side(0).aether = 1;
  b.resolveTurn([use('phoenix_soul_kindle'), use('t_wait')]);
  assert.equal(c.maxHp - c.hp, Math.floor(c.maxHp * 0.1));
  assert.equal(embersOf(b, 0), 2);
  assert.equal(b.side(0).aether, 1 + 2 + 2, '+2 (Soul Kindle) + end of turn +2');
});

test('Dawn Wing: MAG and SPD +1, gains 1 Ember', () => {
  const b = duel(bird(['phoenix_dawn_wing']), foe(['t_wait']));
  turn(b, 'phoenix_dawn_wing', 't_wait');
  assert.equal(b.active(0).stages.mag, 1);
  assert.equal(b.active(0).stages.spd, 1);
  assert.equal(embersOf(b, 0), 1);
});

test('Rebirth Flame: heals 35% and cleanses own status conditions', () => {
  const b = duel(bird(['rebirth_flame']), foe(['t_wait']));
  const c = b.active(0);
  c.hp = Math.floor(c.maxHp / 2);
  c.status.poison = { turns: 3, stacks: 1 };
  const hp = c.hp;
  turn(b, 'rebirth_flame', 't_wait');
  assert.ok(!c.status.poison);
  assert.ok(c.hp - hp >= Math.floor(c.maxHp * 0.35) - Math.ceil(c.maxHp * 0.1), 'heals about 35%');
});

test('Ash Pact: after an ally spirit is knocked out, the opponent takes 15% damage and is burned', () => {
  const b = duel(bird(['t_wait', 'phoenix_ash_pact'], [{ id: 'cloudfluff', skills: ['t_wait'] }]), foe(['t_strike', 't_wait']));
  turn(b, use('t_wait', 'phoenix_ash_pact'), 't_wait');
  b.active(0).hp = 1;
  const d = b.active(1);
  const ev = turn(b, 't_wait', 't_strike');
  assert.ok(b.side(0).team[0].fainted, 'no Embers, so no Nirvana');
  const trapHit = ev.find((e) => e.k === 'damage' && e.target === 1 && e.reason === 'trap') as { dmg: number } | undefined;
  assert.equal(trapHit?.dmg, Math.floor(d.maxHp * 0.15));
  assert.ok(d.status.burn);
});

test('Undying Flame: +2 Embers after hitting; if Nirvana was already used it re-ignites it, allowing one more revival', () => {
  const b = duel(bird(['t_wait']), foe(['t_strike', 't_wait']));
  sturdy(b);
  const c = b.active(0);
  setEmbers(b, 1);
  c.hp = 1;
  turn(b, 't_wait', 't_strike');
  assert.ok(rebornUsed(b, 0));
  turn(b, 'u_phoenix', 't_wait');
  assert.equal(embersOf(b, 0), 2);
  assert.ok(!rebornUsed(b, 0), 'Nirvana re-ignited');
  c.hp = 1;
  turn(b, 't_wait', 't_strike');
  assert.ok(!c.fainted);
  assert.equal(c.hp, Math.floor(c.maxHp * 0.2));
});

test('AI: before Nirvana is used, it does not burn all its Embers on Ember Nova', () => {
  const b = duel(bird(['phoenix_ember_nova', 'phoenix_cinder_wing']), foe(['t_wait']));
  sturdy(b);
  b.side(1).aether = 0;
  setEmbers(b, 3);
  const pick = () => {
    b.active(0).lastGuardTurn = b.s.turn;
    const a = chooseAction(b, 0, { skill: 1 });
    return a.main.type === 'skill' ? a.main.skillId : a.main.type;
  };
  assert.equal(pick(), 'phoenix_cinder_wing');
  b.active(0).vars['phx:reborn'] = 1;
  assert.equal(pick(), 'u_phoenix', 'Nirvana used: re-ignite it with the ultimate first');
  b.side(0).ultUsed = true;
  assert.equal(pick(), 'phoenix_ember_nova', 'Nirvana and ultimate both used: safe to cash in the Embers');
});

// ═════════════════════════ `pyre_dragoon`: Momentum and Dragoon's Heart ═════════════════════════

const dragoon = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'pyre_dragoon', skills }, ...extra];
const marksOf = (b: Battle, side: SideId = 0) => b.view().sides[side].team[b.side(side).active].marks;
/** The AI's choice this turn (without letting it guard) */
const aiPick = (b: Battle, side: SideId = 0) => {
  b.active(side).lastGuardTurn = b.s.turn;
  const a = chooseAction(b, side, { skill: 1 });
  return a.main.type === 'skill' ? a.main.skillId : a.main.type;
};

test('Tail Dash: +1 SPD stage after hitting = Momentum +1, and the "Momentum" mark shows on the spirit', () => {
  const b = duel(dragoon(['pyre_dragoon_tail_dash']), foe(['t_wait']));
  sturdy(b);
  turn(b, 'pyre_dragoon_tail_dash', 't_wait');
  assert.equal(momentumOf(b, 0), 1);
  assert.deepEqual(marksOf(b).find((m) => m.id === 'kit:momentum'), { id: 'kit:momentum', n: 1, note: '衝勢' });
  // A SPD drop does not count as Momentum
  b.active(0).stages.spd = -2;
  assert.equal(momentumOf(b, 0), 0);
  assert.equal(marksOf(b).find((m) => m.id === 'kit:momentum'), undefined);
});

test('Dragoon Charge: +25 power per Momentum step, consuming all Momentum on use; no SPD drop when there is no Momentum', () => {
  const b = duel(dragoon(['pyre_dragoon_charge', 't_wait']), foe(['t_wait']));
  sturdy(b);
  const base = b.estimate(0, 'pyre_dragoon_charge');
  b.active(0).stages.spd = 2;
  const boosted = b.estimate(0, 'pyre_dragoon_charge');
  const r = boosted / base;
  assert.ok(Math.abs(r - 125 / 75) < 0.03, `Power ratio ${r.toFixed(2)} ≈ (75 + 50) / 75`);
  const ev = turn(b, 'pyre_dragoon_charge', 't_wait');
  assert.equal(b.active(0).stages.spd, 0);
  assert.ok(ev.some((e) => e.k === 'text' && e.text.includes('2 階衝勢全部打了出去')));
  b.active(0).stages.spd = -1;
  turn(b, 'pyre_dragoon_charge', 't_wait');
  assert.equal(b.active(0).stages.spd, -1, 'negative SPD stages are unaffected');
});

test('Crimson Charge: +30 power per Momentum step; Momentum is kept when it KOs the opponent and spent when it does not', () => {
  const b = duel(dragoon(['pyre_dragoon_crimson_charge']), [...foe(['t_wait']), { id: 'cloudfluff', skills: ['t_wait'] }]);
  const base = b.estimate(0, 'pyre_dragoon_crimson_charge');
  b.active(0).stages.spd = 3;
  const r = b.estimate(0, 'pyre_dragoon_crimson_charge') / base;
  assert.ok(Math.abs(r - 180 / 90) < 0.03, `Power ratio ${r.toFixed(2)} ≈ (90 + 90) / 90`);
  b.active(1).hp = 1;
  const ev = turn(b, 'pyre_dragoon_crimson_charge', 't_wait');
  assert.ok(b.side(1).team[0].fainted);
  assert.equal(momentumOf(b, 0), 3, 'KO: Momentum kept');
  assert.ok(ev.some((e) => e.k === 'text' && e.text.includes('突破')));
  // After the opponent's replacement comes in, this hit cannot KO
  sturdy(b);
  turn(b, 'pyre_dragoon_crimson_charge', 't_wait');
  assert.equal(momentumOf(b, 0), 0, 'no KO: Momentum spent');
});

test("Dragon Knight's Heart: SPD +1 stage the first time HP drops to 50% or below (once per battle)", () => {
  const b = duel(dragoon(['t_wait']), foe(['t_strike', 't_wait']));
  const c = b.active(0);
  c.hp = Math.floor(c.maxHp * 0.5) + 1;
  const ev = turn(b, 't_wait', 't_strike');
  assert.ok(c.hp * 2 <= c.maxHp);
  assert.ok(ev.some((e) => e.k === 'trait' && e.name === '龍騎之心'));
  assert.equal(momentumOf(b, 0), 1);
  c.stages.spd = 0;
  c.hp = c.maxHp;
  turn(b, 't_wait', 't_wait');
  c.hp = Math.floor(c.maxHp * 0.5) + 1;
  turn(b, 't_wait', 't_strike');
  assert.equal(momentumOf(b, 0), 0, 'only once per battle');
});

test('Pursuit Slash: when the opponent switches, hits first at double power before it leaves the field', () => {
  const b = duel(dragoon(['pyre_dragoon_pursuit']), [...foe(['t_wait']), { id: 'cloudfluff', skills: ['t_wait'] }]);
  sturdy(b);
  const plain = plainDealt(turn(b, 'pyre_dragoon_pursuit', 't_wait'), 0);
  const d = b.active(1);
  const ev = turn(b, 'pyre_dragoon_pursuit', sw(1));
  const hit = hitsBy(ev, 0)[0] as { target?: SideId } | undefined;
  assert.ok(hit, 'pursuit hit lands');
  const r = plainDealt(ev, 0) / plain;
  assert.ok(r > 1.6 && r < 2.5, `Pursuit / normal damage ratio ${r.toFixed(2)} ≈ 2`);
  assert.ok(d.hp < d.maxHp);
  assert.equal(b.active(1).species.id, 'cloudfluff', 'the switch still goes through after the pursuit');
});

test('Crimson Dragonblade: +20 power per Momentum step (not consumed), ignores guard', () => {
  const b = duel(dragoon(['t_wait']), foe(['t_wait']));
  sturdy(b);
  const base = b.estimate(0, 'u_pyre_dragoon');
  b.active(0).stages.spd = 2;
  const r = b.estimate(0, 'u_pyre_dragoon') / base;
  assert.ok(Math.abs(r - 220 / 180) < 0.03, `Power ratio ${r.toFixed(2)} ≈ (180 + 40) / 180`);
  const ev = turn(b, 'u_pyre_dragoon', guard());
  assert.ok(hitsBy(ev, 0).length > 0 && dealtTo(ev, 0) > 0, 'guard cannot stop it');
  assert.equal(momentumOf(b, 0), 2, 'Momentum is not consumed');
});

test('Red Scale: 25% shield and Momentum +1; the AI does not use it again while the shield is up', () => {
  const b = duel(dragoon(['pyre_dragoon_red_scale', 'flame_claw']), foe(['t_wait']));
  sturdy(b);
  b.side(1).aether = 0;
  b.side(0).ultUsed = true;
  const c = b.active(0);
  turn(b, 'pyre_dragoon_red_scale', 't_wait');
  assert.equal(momentumOf(b, 0), 1);
  assert.equal(c.shield?.amount, Math.floor(c.maxHp * 0.25), '25% shield');
  assert.equal(aiPick(b), 'flame_claw');
});

test('AI: Pyre Dragoon builds up Momentum first when it has none, and charges once it has enough', () => {
  const b = duel(dragoon(['pyre_dragoon_crimson_charge', 'pyre_dragoon_dance', 'flame_claw']), foe(['t_wait']));
  sturdy(b);
  b.side(1).aether = 0;
  b.side(0).ultUsed = true;
  assert.equal(aiPick(b), 'pyre_dragoon_dance');
  b.active(0).stages.spd = 3;
  b.active(0).stages.atk = 1;
  assert.equal(aiPick(b), 'pyre_dragoon_crimson_charge');
});

// ═════════════════════════ `steameel`: Vaporize and Steam Rise ═════════════════════════

const eel = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'steameel', skills }, ...extra];
const vaporMark = (b: Battle) => marksOf(b).find((m) => m.id === 'kit:vapor')?.note;

test('Vaporize: a fire skill leaves afterheat; the next water exclusive attack gets power ×1.3 and burns, then the afterheat fades', () => {
  const b = duel(eel(['ember', 'steameel_steam_jet']), foe(['t_wait']));
  sturdy(b);
  const plain = b.estimate(0, 'steameel_steam_jet');
  turn(b, 'ember', 't_wait');
  delete b.active(1).status.burn;
  assert.equal(vaporOf(b, 0), 1);
  assert.equal(vaporMark(b), '餘熱');
  const r = b.estimate(0, 'steameel_steam_jet') / plain;
  assert.ok(Math.abs(r - 1.3) < 0.03, `Vaporize power ratio ${r.toFixed(2)} ≈ 1.3`);
  turn(b, 'steameel_steam_jet', 't_wait');
  assert.ok(b.active(1).status.burn, 'Vaporize burn');
  assert.equal(vaporOf(b, 0), 0, 'fades after Vaporize, leaving no moisture');
  assert.equal(vaporMark(b), undefined);
});

test('Vaporize: a water skill leaves moisture so a fire skill vaporizes; using the same element twice does not vaporize; a basic skill only leaves the state and does not vaporize itself', () => {
  const b = duel(eel(['aqua_shot', 'steameel_steam_jet', 'steameel_magma_spout', 'ember']), foe(['t_wait']));
  sturdy(b);
  turn(b, 'aqua_shot', 't_wait');
  assert.equal(vaporMark(b), '水氣');
  turn(b, 'steameel_steam_jet', 't_wait');
  assert.ok(!b.active(1).status.burn, 'same element does not vaporize');
  assert.equal(vaporMark(b), '水氣');
  turn(b, 'ember', 't_wait');
  delete b.active(1).status.burn;
  assert.equal(vaporMark(b), '餘熱', 'a basic skill does not vaporize, it only swaps in afterheat');
  turn(b, 'aqua_shot', 't_wait');
  turn(b, 'steameel_magma_spout', 't_wait');
  assert.ok(b.active(1).status.burn);
  assert.equal(vaporOf(b, 0), 0);
});

test('Vaporize: a turn without acting leaves the state unchanged; it fades on leaving the field', () => {
  const b = duel(eel(['ember', 't_wait'], [{ id: 'cloudfluff', skills: ['t_wait'] }]), foe(['t_wait']));
  turn(b, 'ember', 't_wait');
  turn(b, guard(), 't_wait');
  assert.equal(vaporMark(b), '餘熱', 'a guard does not count as using a skill');
  turn(b, sw(1), 't_wait');
  turn(b, sw(0), 't_wait');
  assert.equal(vaporOf(b, 0), 0);
});

test('Boiling Vortex: after hitting it follows up with Steam Jet (×0.5, always vaporizes) and burns; the state is used up', () => {
  const b = duel(eel(['steameel_boiling_vortex']), foe(['t_wait']));
  sturdy(b);
  const ev = turn(b, 'steameel_boiling_vortex', 't_wait');
  const uses = ev.filter((e) => e.k === 'use' && e.side === 0).map((e) => (e as { skillId: string }).skillId);
  assert.deepEqual(uses, ['steameel_boiling_vortex', 'steameel_steam_jet']);
  assert.equal(hitsBy(ev, 0).length, 2);
  assert.ok(b.active(1).status.burn);
  assert.equal(vaporOf(b, 0), 0);
});

test('Steam Cyclone: always vaporizes (×1.3 and burns even with no state)', () => {
  const b = duel(eel(['t_wait']), foe(['t_wait']));
  sturdy(b);
  turn(b, 'u_steameel', 't_wait');
  assert.ok(b.active(1).status.burn);
  assert.equal(vaporOf(b, 0), 0);
});

test('Scalding Fog: cuts damage by 40% when an opposing attack hits, and burns the attacker', () => {
  const b = duel(eel(['t_wait', 'steameel_scald_fog']), foe(['t_bolt', 't_wait']));
  const plain = plainDealt(turn(b, 't_wait', 't_bolt'), 1);
  turn(b, use('t_wait', 'steameel_scald_fog'), 't_wait');
  assert.equal(b.side(0).trap?.skillId, 'steameel_scald_fog');
  const ev = turn(b, 't_wait', 't_bolt');
  assert.equal(b.side(0).trap, null);
  assert.ok(b.active(1).status.burn);
  const cut = plainDealt(ev, 1) / plain;
  assert.ok(cut > 0.5 && cut < 0.7, `Ratio after damage reduction ${cut.toFixed(2)} ≈ 0.6`);
});

test('Steam Surge: Sea Fog opens Downpour; in Downpour SPD ×1.5; a vaporized fire attack is not weakened by Downpour, an unvaporized one is ×0.7 as usual', () => {
  const b = duel(eel(['steameel_fog', 'steameel_magma_spout']), foe(['t_wait']));
  sturdy(b);
  const dry = b.estimate(0, 'steameel_magma_spout');
  const spd = b.effStat(b.active(0), 'spd', 0);
  turn(b, 'steameel_fog', 't_wait');
  assert.equal(b.s.field?.element, 'water');
  assert.ok(Math.abs(b.effStat(b.active(0), 'spd', 0) - spd * 1.5) < 1e-6, 'SPD ×1.5 in Downpour');
  assert.equal(vaporMark(b), '水氣', 'Sea Fog also leaves moisture');
  const steam = b.estimate(0, 'steameel_magma_spout') / dry;
  assert.ok(Math.abs(steam - 1.3) < 0.03, `Vaporized: Downpour / no field ${steam.toFixed(2)} ≈ 1.3 (not weakened)`);
  delete b.active(0).vars['e:stm:vapor'];
  const plain = b.estimate(0, 'steameel_magma_spout') / dry;
  assert.ok(Math.abs(plain - 0.7) < 0.03, `Not vaporized: Downpour / no field ${plain.toFixed(2)} ≈ 0.7`);
});

// ═════════════════════════ `pyrewing`: Scale Dust ═════════════════════════

const moth = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'pyrewing', skills }, ...extra];
const setDust = (b: Battle, n: number) => void (b.active(1).vars['e:pyw:dust'] = n);
const dustHit = (ev: BattleEvent[]) => (ev.find((e) => e.k === 'damage' && e.reason === 'dust') as { dmg: number } | undefined)?.dmg;

test('Dust Flutter: after hitting, the opponent is coated with 1 layer of Scale Dust (max 3), the mark shows on Pyrewing Queen; the dust fades when the opponent leaves the field', () => {
  const b = duel(moth(['pyrewing_dust']), [...foe(['t_wait']), { id: 'cloudfluff', skills: ['t_wait'] }]);
  sturdy(b);
  turn(b, 'pyrewing_dust', 't_wait');
  assert.equal(dustOn(b, 0), 1);
  assert.deepEqual(marksOf(b).find((m) => m.id === 'kit:dust'), { id: 'kit:dust', n: 1, note: '對手的鱗粉' });
  setDust(b, 3);
  turn(b, 'pyrewing_dust', 't_wait');
  assert.equal(dustOn(b, 0), 3, 'at most 3 layers');
  turn(b, 'pyrewing_dust', sw(1));
  turn(b, 'pyrewing_dust', sw(0));
  assert.equal(dustOn(b, 0), 1, 'fades on leaving the field; on coming back only the 1 layer dusted this turn remains');
});

test('Ignite: consumes all Scale Dust for 6% max HP damage per layer and a Burn; with no Scale Dust neither happens', () => {
  const b = duel(moth(['pyrewing_ignite']), foe(['t_wait']));
  sturdy(b);
  const d = b.active(1);
  const none = turn(b, 'pyrewing_ignite', 't_wait');
  assert.equal(dustHit(none), undefined);
  assert.ok(!d.status.burn);
  setDust(b, 2);
  const ev = turn(b, 'pyrewing_ignite', 't_wait');
  assert.equal(dustHit(ev), Math.floor((d.maxHp * 12) / 100));
  assert.ok(d.status.burn);
  assert.equal(dustOn(b, 0), 0);
});

test('Wildfire: 9% per layer; Thousand Moth Blaze: fills up to 3 layers and ignites them (6% per layer)', () => {
  const b = duel(moth(['pyrewing_wildfire', 't_wait']), foe(['t_wait']));
  sturdy(b);
  const d = b.active(1);
  setDust(b, 3);
  assert.equal(dustHit(turn(b, 'pyrewing_wildfire', 't_wait')), Math.floor((d.maxHp * 27) / 100));
  const ev = turn(b, 'u_pyrewing', 't_wait');
  assert.equal(dustHit(ev), Math.floor((d.maxHp * 18) / 100));
  assert.equal(dustOn(b, 0), 0);
});

test('Moth Swarm: each of the two hits dusts 1 layer; Dust Cloud: 2 layers and MAG +1', () => {
  const b = duel(moth(['pyrewing_moth_swarm', 'pyrewing_dust_cloud']), foe(['t_wait']));
  sturdy(b);
  turn(b, 'pyrewing_moth_swarm', 't_wait');
  assert.equal(dustOn(b, 0), 2);
  setDust(b, 0);
  turn(b, 'pyrewing_dust_cloud', 't_wait');
  assert.equal(dustOn(b, 0), 2);
  assert.equal(b.active(0).stages.mag, 1);
});

test('Dust Snare: cuts damage by 30% when an opposing attack hits, and the attacker is coated with 2 layers of Scale Dust', () => {
  const b = duel(moth(['t_wait', 'pyrewing_dust_trap']), foe(['t_bolt', 't_wait']));
  const plain = plainDealt(turn(b, 't_wait', 't_bolt'), 1);
  turn(b, use('t_wait', 'pyrewing_dust_trap'), 't_wait');
  const ev = turn(b, 't_wait', 't_bolt');
  assert.equal(b.side(0).trap, null);
  assert.equal(dustOn(b, 0), 2);
  const cut = plainDealt(ev, 1) / plain;
  assert.ok(cut > 0.6 && cut < 0.8, `Ratio after damage reduction ${cut.toFixed(2)} ≈ 0.7`);
});

test('Fire Scale Dust: an attacker using a physical skill is coated with 1 layer of Scale Dust; a magic attacker is not', () => {
  const b = duel(moth(['t_wait']), foe(['t_strike', 't_bolt']));
  turn(b, 't_wait', 't_bolt');
  assert.equal(dustOn(b, 0), 0);
  const ev = turn(b, 't_wait', 't_strike');
  assert.equal(dustOn(b, 0), 1);
  assert.ok(ev.some((e) => e.k === 'trait' && e.name === '火鱗粉'));
});

test('AI: Pyrewing Queen dusts first when it has no Scale Dust, and ignites once there is enough', () => {
  const b = duel(moth(['pyrewing_ignite', 'pyrewing_dust']), foe(['t_wait']));
  sturdy(b);
  b.side(1).aether = 0;
  b.side(0).ultUsed = true;
  assert.equal(aiPick(b), 'pyrewing_dust');
  setDust(b, 3);
  assert.equal(aiPick(b), 'pyrewing_ignite');
});

// ═════════════════════════ `bellowsbeast`: Kindling and Ignite ═════════════════════════

const beast = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'bellowsbeast', skills }, ...extra];

test('Bellows: lights the Kindling (the mark shows it); the next fire attack combusts ×1.5 and the Kindling goes out; a Neutral attack does not use up the Kindling', () => {
  const b = duel(beast(['bellowsbeast_bellows', 'flame_claw', 'heavy_blow']), foe(['t_wait']));
  sturdy(b);
  const plain = b.estimate(0, 'flame_claw');
  turn(b, 'bellowsbeast_bellows', 't_wait');
  assert.ok(sparkLit(b, 0));
  assert.equal(marksOf(b).find((m) => m.id === 'kit:spark')?.note, '火種');
  b.active(0).stages.atk = 0;
  const r = b.estimate(0, 'flame_claw') / plain;
  assert.ok(Math.abs(r - 1.5) < 0.03, `Combust ${r.toFixed(2)} ≈ 1.5`);
  turn(b, 'heavy_blow', 't_wait');
  assert.ok(sparkLit(b, 0), 'a Neutral attack does not use up the Kindling');
  turn(b, 'flame_claw', 't_wait');
  assert.ok(!sparkLit(b, 0), 'a fire attack uses up the Kindling');
});

test('Draw Flame: after taking a fire attack the Kindling is lit (damage is taken as usual; it no longer absorbs the flame)', () => {
  const b = duel(beast(['t_wait']), foe(['ember', 't_bolt']));
  const c = b.active(0);
  turn(b, 't_wait', 't_bolt');
  assert.ok(!sparkLit(b, 0));
  const hp = c.hp;
  const ev = turn(b, 't_wait', 'ember');
  assert.ok(c.hp < hp, 'a fire attack still deals damage as usual');
  assert.ok(sparkLit(b, 0));
  assert.ok(ev.some((e) => e.k === 'trait' && e.name === '引火'));
});

test('Coal Roll: lights the Kindling after hitting when none is lit; does not relight when it is itself combusting', () => {
  const b = duel(beast(['bellowsbeast_coal_roll']), foe(['t_wait']));
  sturdy(b);
  turn(b, 'bellowsbeast_coal_roll', 't_wait');
  assert.ok(sparkLit(b, 0));
  turn(b, 'bellowsbeast_coal_roll', 't_wait');
  assert.ok(!sparkLit(b, 0), 'this hit combusts, the Kindling is used up and not relit');
});

test('Forge Hammer: burns after hitting while combusting; Furnace Burst: ×2 while combusting', () => {
  const b = duel(beast(['forge_hammer', 'bellowsbeast_furnace_burst', 'bellowsbeast_bellows']), foe(['t_wait']));
  sturdy(b);
  turn(b, 'forge_hammer', 't_wait');
  assert.ok(!b.active(1).status.burn, 'no Kindling, no Burn');
  const plain = b.estimate(0, 'bellowsbeast_furnace_burst');
  turn(b, 'bellowsbeast_bellows', 't_wait');
  b.active(0).stages.atk = 0;
  const r = b.estimate(0, 'bellowsbeast_furnace_burst') / plain;
  assert.ok(Math.abs(r - 2) < 0.05, `Furnace Burst ${r.toFixed(2)} ≈ 2`);
  turn(b, 'forge_hammer', 't_wait');
  assert.ok(b.active(1).status.burn);
});

test('Backfire: cuts damage by 30% when an opposing attack hits and lights the Kindling; Ember Mend: heals 30% and lights the Kindling', () => {
  const b = duel(beast(['t_wait', 'bellowsbeast_backfire', 'bellowsbeast_ash_mend', 'flame_claw']), foe(['t_bolt', 't_wait']));
  const plain = plainDealt(turn(b, 't_wait', 't_bolt'), 1);
  turn(b, use('t_wait', 'bellowsbeast_backfire'), 't_wait');
  const ev = turn(b, 't_wait', 't_bolt');
  assert.equal(b.side(0).trap, null);
  assert.ok(sparkLit(b, 0));
  const cut = plainDealt(ev, 1) / plain;
  assert.ok(cut > 0.6 && cut < 0.8, `Ratio after damage reduction ${cut.toFixed(2)} ≈ 0.7`);
  turn(b, 'flame_claw', 't_wait');
  assert.ok(!sparkLit(b, 0));
  const c = b.active(0);
  c.hp = Math.floor(c.maxHp / 2);
  const hp = c.hp;
  turn(b, 'bellowsbeast_ash_mend', 't_wait');
  assert.equal(c.hp - hp, Math.floor(c.maxHp * 0.3));
  assert.ok(sparkLit(b, 0));
});

test('Furnace Burst: no Burn without Kindling; burns after hitting while combusting', () => {
  const b = duel(beast(['bellowsbeast_furnace_burst', 'bellowsbeast_bellows']), foe(['t_wait']));
  sturdy(b);
  turn(b, 'bellowsbeast_furnace_burst', 't_wait');
  assert.ok(!b.active(1).status.burn);
  turn(b, 'bellowsbeast_bellows', 't_wait');
  turn(b, 'bellowsbeast_furnace_burst', 't_wait');
  assert.ok(b.active(1).status.burn);
  assert.ok(!sparkLit(b, 0));
});

test('Furnace Fury: combusts even without Kindling, and does not use up the Kindling', () => {
  const b = duel(beast(['bellowsbeast_bellows', 't_wait']), foe(['t_wait']));
  sturdy(b);
  const plain = b.estimate(0, 'u_bellowsbeast');
  turn(b, 'bellowsbeast_bellows', 't_wait');
  b.active(0).stages.atk = 0;
  assert.ok(Math.abs(b.estimate(0, 'u_bellowsbeast') / plain - 1) < 0.03, '×1.5 with or without Kindling');
  turn(b, 'u_bellowsbeast', 't_wait');
  assert.ok(sparkLit(b, 0), 'Kindling kept');
});

// ═════════════════════════ `shieldbeetle`: Hold and Knight's Shield ═════════════════════════

const beetle = (skills: string[], extra: { id: string; skills?: string[] }[] = []) => [{ id: 'shieldbeetle', skills }, ...extra];
const setHold = (b: Battle, n: number) => void (b.active(0).vars['e:shb:hold'] = n);

test("Hold: +1 on a turn of a status skill, +2 on a turn of guarding (Knight's Shield), nothing on a turn of attacking; max 3 stacks, reset to zero on leaving the field", () => {
  const b = duel(beetle(['shieldbeetle_raise', 'flame_claw'], [{ id: 'cloudfluff', skills: ['t_wait'] }]), foe(['t_strike', 't_wait']));
  sturdy(b);
  turn(b, 'shieldbeetle_raise', 't_wait');
  assert.equal(holdOf(b, 0), 1);
  assert.deepEqual(marksOf(b).find((m) => m.id === 'kit:hold'), { id: 'kit:hold', n: 1, note: '固守' });
  turn(b, 'flame_claw', 't_wait');
  assert.equal(holdOf(b, 0), 1, 'no gain on a turn of attacking');
  const ev = turn(b, guard(), 't_strike');
  assert.ok(ev.some((e) => e.k === 'trait' && e.name === '騎士之盾'));
  assert.equal(holdOf(b, 0), 3, 'successful guard +1, end of turn +1');
  turn(b, 'shieldbeetle_raise', 't_wait');
  assert.equal(holdOf(b, 0), 3, 'at most 3 stacks');
  turn(b, sw(1), 't_wait');
  turn(b, sw(0), 't_wait');
  assert.equal(holdOf(b, 0), 0);
});

test('Hold: each stack cuts attack damage taken by 12%', () => {
  const b = duel(beetle(['t_wait']), foe(['t_bolt']));
  const c = b.active(0);
  c.maxHp = c.hp = 100000;
  const plain = plainDealt(turn(b, 't_wait', 't_bolt'), 1);
  setHold(b, 2);
  const r = plainDealt(turn(b, 't_wait', 't_bolt'), 1) / plain;
  assert.ok(r > 0.68 && r < 0.84, `Damage ratio with 2 stacks of Hold ${r.toFixed(2)} ≈ 0.76`);
});

test('Breach: Shield Bash +35 per stack, Iron Charge +40 per stack, all Hold consumed after use', () => {
  const b = duel(beetle(['shield_bash', 'shieldbeetle_iron_charge']), foe(['t_wait']));
  sturdy(b);
  const bash = b.estimate(0, 'shield_bash');
  const iron = b.estimate(0, 'shieldbeetle_iron_charge');
  setHold(b, 2);
  assert.ok(Math.abs(b.estimate(0, 'shield_bash') / bash - 105 / 35) < 0.1, 'Shield Bash (35 + 70) / 35');
  assert.ok(Math.abs(b.estimate(0, 'shieldbeetle_iron_charge') / iron - 140 / 60) < 0.05, 'Iron Charge (60 + 80) / 60');
  const ev = turn(b, 'shield_bash', 't_wait');
  assert.equal(holdOf(b, 0), 0);
  assert.ok(ev.some((e) => e.k === 'text' && e.text.includes('破陣')));
});

test('Crimson Lance: ignores guard at 3 stacks of Hold; guarded below 3 stacks', () => {
  const b = duel(beetle(['shieldbeetle_crimson_lance']), foe(['t_wait']));
  sturdy(b);
  setHold(b, 2);
  assert.equal(dealtTo(turn(b, 'shieldbeetle_crimson_lance', guard()), 0), 0, 'guarded at 2 stacks');
  turn(b, 'shieldbeetle_crimson_lance', 't_wait');
  setHold(b, 3);
  assert.ok(dealtTo(turn(b, 'shieldbeetle_crimson_lance', guard()), 0) > 0, 'ignores guard at 3 stacks');
});

test('Shield Wall: cuts damage by 50% when an opposing attack hits, Hold +1', () => {
  const b = duel(beetle(['t_wait', 'shieldbeetle_shield_wall', 'flame_claw']), foe(['t_bolt', 't_wait']));
  const c = b.active(0);
  c.maxHp = c.hp = 100000;
  const plain = plainDealt(turn(b, 'flame_claw', 't_bolt'), 1);
  turn(b, use('flame_claw', 'shieldbeetle_shield_wall'), 't_wait');
  assert.equal(holdOf(b, 0), 0);
  const ev = turn(b, 'flame_claw', 't_bolt');
  assert.equal(b.side(0).trap, null);
  assert.equal(holdOf(b, 0), 1);
  const cut = plainDealt(ev, 1) / plain;
  assert.ok(cut > 0.4 && cut < 0.6, `Ratio after damage reduction ${cut.toFixed(2)} ≈ 0.5`);
});

test('Crimson Siege: Breach +40 per stack, and a 25% shield after hitting', () => {
  const b = duel(beetle(['t_wait']), foe(['t_wait']));
  sturdy(b);
  const plain = b.estimate(0, 'u_shieldbeetle');
  setHold(b, 3);
  assert.ok(Math.abs(b.estimate(0, 'u_shieldbeetle') / plain - 290 / 170) < 0.05, '(170 + 120) / 170');
  turn(b, 'u_shieldbeetle', 't_wait');
  assert.equal(holdOf(b, 0), 0);
  assert.equal(b.active(0).shield?.amount, Math.floor(b.active(0).maxHp * 0.25));
});

test('AI: Ironclad Knight guards first when it has no Hold, and breaches once there is enough', () => {
  const b = duel(beetle(['shieldbeetle_iron_charge', 'shieldbeetle_heat_shell']), foe(['t_wait']));
  sturdy(b);
  b.side(1).aether = 0;
  b.side(0).ultUsed = true;
  b.active(0).hp = Math.floor(b.active(0).maxHp * 0.8);
  assert.equal(aiPick(b), 'shieldbeetle_heat_shell');
  setHold(b, 3);
  assert.equal(aiPick(b), 'shieldbeetle_iron_charge');
});
