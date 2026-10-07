import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSkill } from '../data.ts';
import { Battle, ULT_COST } from '../engine/battle.ts';
import type { BattleEvent, SpiritInstance, TurnInput } from '../engine/types.ts';
import { FIRST_LEVEL, FIRST_LOADOUT, FIRST_PARTNER } from './opening.ts';
import { coachStep, tutorialFoeAction, TUTORIAL_FOE, TUTORIAL_SEED, TUTORIAL_ULT_BOOST } from './tutorial.ts';

const inst = (uid: string, speciesId: string, level: number, loadout: string[]): SpiritInstance => ({ uid, speciesId, level, exp: 0, stage: 1, resonance: 0, loadout });

/** Same setup as startTutorialBattle in flows.ts */
function tutorialBattle(seed: number): Battle {
  const b = Battle.create({
    kind: 'wild',
    seed,
    sides: [
      { name: '締約者', isAI: false, awaken: true, ultBoost: TUTORIAL_ULT_BOOST, tutorial: true, spirits: [inst('p', FIRST_PARTNER, FIRST_LEVEL, [...FIRST_LOADOUT])] },
      { name: '野生精靈', isAI: true, tutorial: true, boost: TUTORIAL_FOE.boost, hpBoost: TUTORIAL_FOE.hpBoost, spirits: [inst('f', TUTORIAL_FOE.speciesId, TUTORIAL_FOE.level, [...TUTORIAL_FOE.loadout])] },
    ],
  });
  b.start();
  return b;
}

interface Step {
  action: string;
  events: BattleEvent[];
  /** Damage the player dealt to Cloudfluff this turn */
  dealt: number;
  foeHp: number;
  aether: number;
}

/** Play a whole battle following the tutorial hints exactly */
function play(seed: number): { b: Battle; steps: Step[] } {
  const b = tutorialBattle(seed);
  const steps: Step[] = [];
  for (let i = 0; i < 12 && b.s.winner === null; i++) {
    const c = b.active(0);
    const cards = [...c.skills, ...(c.ultimate ? [c.ultimate] : [])].map((id) => ({ id, ok: b.canUse(0, id).ok }));
    const sd = b.side(0);
    const ult = sd.ultUsed ? 'used' : sd.aether >= ULT_COST ? 'ready' : 'charging';
    const coach = coachStep(b, cards, ult, sd.aether);
    assert.ok(coach, `turn ${i + 1} has no hint`);
    let input: TurnInput;
    let action: string;
    if (coach.capture) [input, action] = [{ main: { type: 'capture', stone: 'basic' } }, 'capture'];
    else if (coach.guard) [input, action] = [{ main: { type: 'guard' } }, 'guard'];
    else {
      assert.ok(coach.card !== undefined && cards[coach.card].ok, `the skill hinted on turn ${i + 1} cannot be used`);
      action = cards[coach.card].id;
      input = { main: { type: 'skill', skillId: action } };
    }
    const hp = b.active(1).hp;
    const events = b.resolveTurn([input, tutorialFoeAction(b) ?? { main: { type: 'skill', skillId: 'cloudfluff_hum' } }]);
    steps.push({ action, events, dealt: hp - b.active(1).hp, foeHp: b.active(1).hp, aether: b.side(0).aether });
  }
  return { b, steps };
}

const PLAN = ['eldarin_sigil_claw', 'eldarin_oath_flame', 'eldarin_sigil_claw', 'guard', 'u_eldarin', 'capture'];

test('Tutorial battle: following the hints, the ultimate always fires on turn 5 and the pact is formed on turn 6 (any seed)', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { b, steps } = play(seed);
    assert.deepEqual(steps.map((s) => s.action), PLAN, `seed ${seed}`);
    assert.ok(steps[4].events.some((e) => e.k === 'use' && e.side === 0 && e.ult), `seed ${seed}: the ultimate did not fire`);
    // Even without a crit, the ultimate always cuts Cloudfluff down to exactly 1 HP (the true name is not for killing; that is left to the pact stone)
    assert.equal(steps[4].foeHp, 1, `seed ${seed}: Cloudfluff has ${steps[4].foeHp} HP left after the ultimate`);
    assert.equal(b.s.winner, 0);
    assert.equal(b.s.captured, true);
    assert.ok(b.active(0).hp > 0);
  }
});

test('Tutorial battle: Guard blocks the puffball from Cloudfluff', () => {
  const { steps } = play(TUTORIAL_SEED);
  const guard = steps[3];
  assert.ok(guard.events.some((e) => e.k === 'use' && e.side === 1 && e.skillId === 'cloudfluff_puffball'), 'Cloudfluff did not throw the puffball');
  assert.ok(guard.events.some((e) => e.k === 'guarded' && e.side === 0 && !e.broke), 'the Guard did not block');
  // Pact of Clash ends at the end of turn 3, so guarding does not count as breaking the pact
  assert.ok(!guard.events.some((e) => e.k === 'text' && e.text.includes('違約')));
});

test('Tutorial battle (fixed seed): the ultimate is the biggest hit of the whole fight, at least 1.6 times any earlier hit', () => {
  const { b, steps } = play(TUTORIAL_SEED);
  const before = steps.slice(0, 4).flatMap((s) => s.events);
  assert.ok(!before.some((e) => e.k === 'hit' && e.side === 0 && e.crit), 'a crit appeared before the ultimate, pick another seed');
  const ult = steps[4];
  assert.equal(ult.foeHp, 1);
  const max = b.active(1).maxHp;
  const prior = Math.max(...steps.slice(0, 4).map((s) => s.dealt));
  assert.ok(ult.dealt >= prior * 1.6, `ultimate ${ult.dealt}, previous biggest hit ${prior}`);
  assert.ok(ult.dealt >= max * 0.5, `the ultimate dealt only ${ult.dealt}/${max}`);
  // Damage number on screen: that of the ultimate blow (not several segments added up)
  const ultHits = ult.events.filter((e) => e.k === 'hit' && e.side === 0);
  assert.equal(ultHits.length, 1);
  assert.equal(getSkill('u_eldarin').category, 'ultimate');
});
