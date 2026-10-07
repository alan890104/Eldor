import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimable, QUESTS, questState } from './quests.ts';
import { newSave } from './save.ts';
import { devSave } from './devsave.ts';

test('Quest ids are unique and targets are positive', () => {
  const ids = new Set(QUESTS.map((q) => q.id));
  assert.equal(ids.size, QUESTS.length);
  for (const q of QUESTS) assert.ok(q.target > 0, q.id);
});

test('A new save has no claimable quests; progress never exceeds the target', () => {
  const d = newSave();
  assert.equal(claimable(d).length, 0);
  d.stats.captures = 99;
  const s = questState(d, QUESTS.find((q) => q.id === 'capture5')!);
  assert.equal(s.value, 5);
  assert.ok(s.done);
});

test('A claimed quest is no longer listed as claimable', () => {
  const d = devSave();
  const ready = claimable(d);
  assert.ok(ready.length > 0);
  d.claimed.push(ready[0].id);
  assert.ok(!claimable(d).some((q) => q.id === ready[0].id));
});
