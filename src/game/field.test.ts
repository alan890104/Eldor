import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSpirit } from '../data.ts';
import { REGIONS, isRegionUnlocked, isStageUnlocked, nextFloor, towerProgress } from './campaign.ts';
import { chestReward, rollWild, wildLevelRange } from './field.ts';

test('Every region has a town, a Seal Tower, three residents and field spirits; floor ids are unique', () => {
  const ids = new Set<string>();
  for (const r of REGIONS) {
    assert.ok(r.town && r.tower, r.id);
    assert.equal(r.npcs.length, 3, r.id);
    assert.ok(r.explore.length >= 5, r.id);
    assert.ok(r.stages.length >= 6, r.id);
    assert.equal(r.stages[r.stages.length - 1].kind, 'boss', `the top floor of ${r.id} is the Source Crystal Trial`);
    for (const st of r.stages) {
      assert.ok(!ids.has(st.id), st.id);
      ids.add(st.id);
      assert.notEqual(st.kind, 'wild', 'wild battles happen in the field, not inside the Seal Tower');
      assert.ok(st.team && st.team.length > 0, st.id);
      for (const t of st.team!) if (t.speciesId !== 'RIVAL') assert.ok(getSpirit(t.speciesId), t.speciesId);
    }
    for (const e of r.explore) assert.ok(getSpirit(e.speciesId), e.speciesId);
  }
});

test('The Seal Tower is cleared floor by floor, and clearing the top floor unlocks the next region', () => {
  const cleared: Record<string, number> = {};
  assert.equal(nextFloor(cleared, 0), 0);
  assert.ok(!isStageUnlocked(cleared, 0, 1));
  assert.ok(!isRegionUnlocked(cleared, 1));
  const forest = REGIONS[0];
  forest.stages.slice(0, -1).forEach((s) => (cleared[s.id] = 1));
  assert.equal(towerProgress(cleared, 0), forest.stages.length - 1);
  assert.ok(isStageUnlocked(cleared, 0, forest.stages.length - 1));
  assert.ok(!isRegionUnlocked(cleared, 1));
  cleared[forest.stages[forest.stages.length - 1].id] = 1;
  assert.equal(nextFloor(cleared, 0), -1);
  assert.ok(isRegionUnlocked(cleared, 1));
});

test('Wild spirits: species come from the region spawn table, levels are in range, and only N rarity appears near towns', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  REGIONS.forEach((r, i) => {
    const allowed = new Set(r.explore.map((e) => e.speciesId));
    for (let k = 0; k < 200; k++) {
      const tier = (k % 3) as 0 | 1 | 2;
      const w = rollWild(i, tier, { corruptChance: 0.3 }, rnd);
      assert.ok(allowed.has(w.speciesId), `${r.id} ${w.speciesId}`);
      const [lo, hi] = wildLevelRange(i, tier, w.corrupted);
      assert.ok(w.level >= lo && w.level <= Math.min(60, hi), `${r.id} Lv ${w.level}`);
      if (w.corrupted) assert.equal(w.temper, 'fierce');
      if (tier === 0 && r.explore.some((e) => getSpirit(e.speciesId).rarity === 'N')) assert.equal(getSpirit(w.speciesId).rarity, 'N');
    }
  });
});

test('Areas restricted to certain species spawn only those species', () => {
  const w = rollWild(0, 1, { species: ['leaffrog'] });
  assert.equal(w.speciesId, 'leaffrog');
});

test('Chest rewards are fixed, and the last large chest holds Pact Tickets', () => {
  assert.deepEqual(chestReward(0, 1, 6), chestReward(0, 1, 6));
  assert.equal(chestReward(0, 5, 6).tickets, 1);
  assert.ok(chestReward(3, 0, 6).gold > chestReward(0, 0, 6).gold);
});
