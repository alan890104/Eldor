// Battle rules for corruption (the void-eroded body).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerTestSkills } from '../data.ts';
import { Battle } from './battle.ts';
import { CORRUPT_DECAY } from './corruption.ts';
import { hitsBy, inst, turn, useTestSkills } from './testkit.ts';

useTestSkills();
registerTestSkills([
  { id: 't_light', name: 't_light', en: 't_light', element: 'light', category: 'magic', cost: 0, power: 60, accuracy: 100, priority: 0, text: '測試用技能', tags: {} },
]);

function make(foeCorrupted: boolean, opts: { mineCorrupted?: boolean; kind?: 'trainer' | 'wild' } = {}): Battle {
  const b = Battle.create({
    kind: opts.kind ?? 'trainer',
    seed: 7,
    sides: [
      { name: 'A', spirits: [{ ...inst({ id: 'monolith', skills: ['t_strike', 't_wait', 't_light'] }, 'a0'), corrupted: !!opts.mineCorrupted }], isAI: false },
      { name: 'B', spirits: [{ ...inst({ id: 'monolith', skills: ['t_strike', 't_wait'] }, 'b0'), corrupted: foeCorrupted }], isAI: false },
    ],
  });
  b.start();
  b.side(0).aether = 10;
  b.side(1).aether = 10;
  return b;
}

test('Corrupted: the Void Blight consumes 1/12 of max HP at the end of each turn', () => {
  const b = make(true);
  const c = b.active(1);
  turn(b, 't_wait', 't_wait');
  assert.equal(c.maxHp - c.hp, Math.floor((c.maxHp * CORRUPT_DECAY) / 100));
  const n = make(false);
  turn(n, 't_wait', 't_wait');
  assert.equal(n.active(1).hp, n.active(1).maxHp, 'a normal spirit loses no HP');
});

test('Corrupted: Attack and Magic Power rise (damage about ×1.2)', () => {
  const dealt = (corrupted: boolean) => hitsBy(turn(make(false, { mineCorrupted: corrupted }), 't_strike', 't_wait'), 0).reduce((a, h) => a + h.dmg, 0);
  const normal = dealt(false);
  const angry = dealt(true);
  assert.ok(angry > normal * 1.12 && angry < normal * 1.3, `${normal} → ${angry}`);
});

test('Corrupted: takes ×1.3 damage from Light, other elements unchanged', () => {
  const hit = (corrupted: boolean, skill: string) => hitsBy(turn(make(corrupted), skill, 't_wait'), 0).reduce((a, h) => a + h.dmg, 0);
  const light = hit(true, 't_light') / hit(false, 't_light');
  assert.ok(light > 1.25 && light < 1.35, `Light ×${light.toFixed(2)}`);
  assert.ok(Math.abs(hit(true, 't_strike') - hit(false, 't_strike')) <= 1, 'Neutral damage is the same');
});

test('A corrupted spirit cannot be captured, a normal wild spirit can', () => {
  assert.equal(make(true, { kind: 'wild' }).captureOdds(0, 'master'), 0);
  assert.ok(make(false, { kind: 'wild' }).captureOdds(0, 'master') > 0);
});
