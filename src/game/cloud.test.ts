import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, isRealConflict, type CloudSave } from './cloudSync.ts';
import type { SaveData } from './save.ts';

const save = (starter: string, updatedAt: number): SaveData => ({ starter, updatedAt } as unknown as SaveData);
const cloud = (starter: string, updatedAt: number, rev = 1): CloudSave => ({ rev, updatedAt, data: save(starter, updatedAt) });

test('No cloud save: upload if there is progress, otherwise do nothing', () => {
  assert.equal(decide(save('eldarin', 10), null), 'pushLocal');
  // An old save (with the starter partner picked from three) also counts as having progress
  assert.equal(decide(save('pyre_dragoon', 10), null), 'pushLocal');
  assert.equal(decide(save('', 10), null), 'same');
  assert.equal(decide(null, null), 'same');
});

test('Cloud has no progress but local does: upload', () => {
  assert.equal(decide(save('eldarin', 10), cloud('', 99)), 'pushLocal');
});

test('Local has no progress but cloud does: load the cloud save', () => {
  assert.equal(decide(save('', 999), cloud('eldarin', 10)), 'useCloud');
  assert.equal(decide(null, cloud('oathsea_sage', 10)), 'useCloud');
});

test('Both have progress: the newer save time wins, equal does nothing', () => {
  assert.equal(decide(save('a', 10), cloud('b', 20)), 'useCloud');
  assert.equal(decide(save('a', 30), cloud('b', 20)), 'pushLocal');
  assert.equal(decide(save('a', 20), cloud('b', 20)), 'same');
});

test('Upload rejected: it is a real conflict only when the cloud save is newer', () => {
  assert.equal(isRealConflict(save('a', 10), cloud('b', 20)), true);
  assert.equal(isRealConflict(save('a', 30), cloud('b', 20)), false);
  assert.equal(isRealConflict(save('a', 10), cloud('', 20)), false);
  assert.equal(isRealConflict(save('a', 10), null), false);
});
