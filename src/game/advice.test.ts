import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAdvice } from './advice.ts';
import { devSave } from './devsave.ts';

test('At the level cap with enough materials, the first suggestion is Breakthrough', () => {
  const d = devSave();
  const a = getAdvice(d);
  assert.ok(a.length > 0);
  assert.match(a[0].id, /^break-/);
});

test('When the foe is a higher level than the party, it suggests exploring; the Arena shows no leveling hint', () => {
  const d = devSave();
  assert.ok(getAdvice(d, { foeLevel: 99, regionIdx: 1 }).some((x) => x.id === 'level'));
  assert.ok(!getAdvice(d, { foeLevel: 99, arena: true }).some((x) => x.id === 'level'));
});

test('When the foe element is given, it suggests an effective element', () => {
  const d = devSave();
  assert.ok(getAdvice(d, { foeElements: ['fire'] }).some((x) => x.id === 'type'));
});
