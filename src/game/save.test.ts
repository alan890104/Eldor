import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, normalizeSave, type SaveData } from './save.ts';

test('Old save: the old keys evoStones, evolutions and quest evolve1 move to the new Breakthrough keys with counts unchanged, and the old keys are removed', () => {
  const old = JSON.parse(JSON.stringify(newSave())) as Record<string, unknown> & { inv: Record<string, unknown>; stats: Record<string, unknown> };
  delete old.inv.breakStones;
  old.inv.evoStones = 37;
  delete old.stats.breakthroughs;
  old.stats.evolutions = 4;
  old.claimed = ['boss1', 'evolve1'];
  const d = normalizeSave(old as unknown as SaveData);
  assert.equal(d.inv.breakStones, 37);
  assert.equal(d.stats.breakthroughs, 4);
  assert.ok(!('evoStones' in d.inv), 'old key inv.evoStones is removed');
  assert.ok(!('evolutions' in d.stats), 'old key stats.evolutions is removed');
  assert.deepEqual(d.claimed, ['boss1', 'breakthrough1']);
  // Other fields stay as before
  assert.equal(d.inv.gold, newSave().inv.gold);
  assert.deepEqual(d.inv.stones, newSave().inv.stones);
});

test('A new save reads back unchanged; when both new and old keys exist, the new key wins', () => {
  const d = newSave();
  d.inv.breakStones = 9;
  d.stats.breakthroughs = 2;
  assert.deepEqual(normalizeSave(JSON.parse(JSON.stringify(d)) as SaveData).inv, d.inv);
  const both = JSON.parse(JSON.stringify(d)) as SaveData & { inv: { evoStones?: number } };
  both.inv.evoStones = 50;
  const n = normalizeSave(both);
  assert.equal(n.inv.breakStones, 9);
  assert.ok(!('evoStones' in n.inv));
});
