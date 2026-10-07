import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featuredFor, pay, pityLeft, poolOf, pull, pullCost, pullsAvailable, PULL_COST, setFeatured, spiritRates } from './gachaGame.ts';
import { LIMITED_BANNER } from '../../sim/gacha.ts';
import { newSave } from './save.ts';

test('A summon spends Pact Tickets first and covers any shortfall with Starlight Stones', () => {
  const d = newSave();
  d.inv.tickets = 5;
  d.inv.crystals = 900;
  assert.equal(pullsAvailable(d), 11);
  assert.deepEqual(pullCost(d, 10), { tickets: 5, crystals: 5 * PULL_COST, ok: true });
  assert.equal(pay(d, 10), true);
  assert.equal(d.inv.tickets, 0);
  assert.equal(d.inv.crystals, 900 - 5 * PULL_COST);
  assert.equal(pullsAvailable(d), 1);
});

test('Every summon count offered for display can actually be paid for', () => {
  const d = newSave();
  d.inv.tickets = 3;
  d.inv.crystals = 1000;
  const n = pullsAvailable(d);
  for (let i = 0; i < n; i++) assert.equal(pay(d, 1), true);
  assert.equal(pullsAvailable(d), 0);
  assert.equal(pay(d, 1), false);
});

test('Nothing is deducted when holdings are insufficient', () => {
  const d = newSave();
  d.inv.tickets = 5;
  d.inv.crystals = 600;
  assert.equal(pullCost(d, 10).ok, false);
  assert.equal(pay(d, 10), false);
  assert.equal(d.inv.tickets, 5);
  assert.equal(d.inv.crystals, 600);
});

test(`An SSR is guaranteed within ${LIMITED_BANNER.hardPity} pulls (even with the worst luck)`, () => {
  const d = newSave();
  const res = pull(d, 'standard', LIMITED_BANNER.hardPity, () => 0.999999);
  assert.equal(res.filter((r) => r.rarity === 'SSR').length, 1);
  assert.equal(res[LIMITED_BANNER.hardPity - 1].rarity, 'SSR');
  assert.equal(d.pity.count, 0);
});

test('When an old save has more pity pulls than the new pity cap, the next pull is guaranteed to be an SSR', () => {
  const d = newSave();
  d.pity.count = 70;
  assert.equal(pityLeft(d), 1);
  assert.equal(pull(d, 'standard', 1, () => 0.999999)[0].rarity, 'SSR');
});

test('The pool contains every SSR (Legends included), SR and R', () => {
  assert.equal(poolOf('SSR').length, 12);
  for (const id of ['eldarin', 'astragate', 'voidchild', 'chronodragon']) assert.ok(poolOf('SSR').includes(id));
  assert.equal(poolOf('SR').length, 15);
  assert.equal(poolOf('R').length, 15);
});

test('Chosen rate-up: any SSR can be chosen, a non-SSR cannot; landing the rate-up gives the chosen spirit', () => {
  const d = newSave();
  assert.equal(setFeatured(d, 'inkcat'), false);
  assert.equal(setFeatured(d, 'voidchild'), true);
  assert.equal(featuredFor(d), 'voidchild');
  d.pity.count = LIMITED_BANNER.hardPity - 1;
  // rng 0: SSR, and the 50% roll counts as UP
  const [r] = pull(d, 'up', 1, () => 0);
  assert.equal(r.speciesId, 'voidchild');
  assert.equal(r.featured, true);
});

test('Chosen rate-up: after an off-banner SSR and a change of choice, the next SSR is guaranteed to be the newly chosen one', () => {
  const d = newSave();
  setFeatured(d, 'eldarin');
  d.pity.count = LIMITED_BANNER.hardPity - 1;
  // The first random number makes the SSR hit, the second fails the 50% roll, the third picks the first spirit in the pool (anything other than eldarin counts as off-banner)
  const seq = [0, 0.99, 0];
  const lost = pull(d, 'up', 1, () => seq.shift() ?? 0)[0];
  assert.notEqual(lost.speciesId, 'eldarin');
  assert.equal(d.pity.guaranteed, true);
  setFeatured(d, 'chronodragon');
  d.pity.count = LIMITED_BANNER.hardPity - 1;
  const won = pull(d, 'up', 1, () => 0.99)[0];
  assert.equal(won.speciesId, 'chronodragon');
  assert.equal(d.pity.guaranteed, false);
});

test('Published rates: the probabilities sum to 1 and the rate-up spirit has the highest', () => {
  for (const banner of ['up', 'standard'] as const) {
    const list = spiritRates(banner, 'astragate');
    const sum = list.reduce((a, x) => a + x.rate, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `${banner} sums to ${sum}`);
    assert.equal(list.filter((x) => x.rarity === 'SSR').length, 12);
  }
  const up = spiritRates('up', 'astragate').filter((x) => x.rarity === 'SSR');
  assert.equal(up[0].id, 'astragate');
  assert.ok(up.slice(1).every((x) => x.rate < up[0].rate));
});
