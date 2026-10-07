import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canBreakthrough, hasBreakthroughMaterials } from './progression.ts';
import { devSave } from './devsave.ts';

test('A final-stage spirit needs no Breakthrough materials and cannot undergo Breakthrough', () => {
  const d = devSave();
  const s = d.spirits.find((x) => x.stage === 3);
  assert.ok(s, 'devSave should contain a Stage III spirit');
  assert.equal(hasBreakthroughMaterials(d, s), false);
  assert.equal(canBreakthrough(s), false);
});
