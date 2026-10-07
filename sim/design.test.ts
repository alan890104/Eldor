// Design constraint tests: after a data or formula change, npm test catches whatever breaks the balance rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_ERRORS, SKILLS, SPIRITS, SKILL_BY_ID, SYSTEM_SKILL_IDS } from './data.ts';
import { checkBudget } from './kitrules.ts';
import {
  ADVANTAGE,
  bst,
  computeDamage,
  computeStats,
  defenseFactor,
  ELEMENT_ORDER,
  RARITY_BST,
  RESISTED,
  RING,
  singleTypeMultiplier,
  statStageMultiplier,
  typeMultiplier,
} from './formulas.ts';
import {
  cdf,
  featuredDistribution,
  firstSsrDistribution,
  LIMITED_BANNER,
  longRunRates,
} from './gacha.ts';

test('Six-element ring: each element is effective against exactly 1 and resisted by exactly 1', () => {
  for (const a of RING) {
    const row = RING.map((d) => singleTypeMultiplier(a, d));
    assert.equal(row.filter((m) => m === ADVANTAGE).length, 1, a);
    assert.equal(row.filter((m) => m === RESISTED).length, 1, a);
  }
});

test('Matchups are reciprocal: if A is effective against B, then B attacking A is resisted', () => {
  for (const a of RING) {
    for (const d of RING) {
      if (singleTypeMultiplier(a, d) === ADVANTAGE) {
        assert.equal(singleTypeMultiplier(d, a), RESISTED, `${a}→${d}`);
      }
    }
  }
});

test('Light and Dark are effective against each other; Neutral is neutral against everything', () => {
  assert.equal(singleTypeMultiplier('light', 'dark'), ADVANTAGE);
  assert.equal(singleTypeMultiplier('dark', 'light'), ADVANTAGE);
  for (const e of ELEMENT_ORDER) {
    assert.equal(singleTypeMultiplier('neutral', e), 1);
    assert.equal(singleTypeMultiplier(e, 'neutral'), 1);
  }
});

test('Dual-element matchups take the average', () => {
  // water hitting fire/earth: (1.5 + 1) / 2
  assert.equal(typeMultiplier('water', ['fire', 'earth']), 1.25);
});

test('At equal level with a defense base stat of 100, the defense coefficient is 0.5', () => {
  const def = computeStats({ hp: 100, atk: 100, mag: 100, def: 100, res: 100, spd: 100 }, 60, 3).def;
  assert.equal(defenseFactor(def, 60), 0.5);
});

test('Stat stage bounds and symmetry', () => {
  assert.equal(statStageMultiplier(4), 2);
  assert.equal(statStageMultiplier(-4), 0.5);
  assert.equal(statStageMultiplier(9), 2);
  for (let s = 1; s <= 4; s++) {
    assert.ok(Math.abs(statStageMultiplier(s) * statStageMultiplier(-s) - 1) < 1e-12);
  }
});

test('Damage reduction caps at 75% and damage is at least 1', () => {
  const base = { attack: 700, defense: 700, power: 100, attackerLevel: 60 };
  const full = computeDamage(base);
  const capped = computeDamage({ ...base, damageReduction: [0.5, 0.5, 0.5] });
  assert.equal(capped, Math.floor(full * 0.25));
  assert.equal(computeDamage({ ...base, attack: 1, power: 1 }), 1);
});

test('Every spirit has a base stat total that matches its rarity standard', () => {
  for (const sp of SPIRITS) assert.equal(bst(sp.base), RARITY_BST[sp.rarity], sp.id);
});

test('The data catalog loads without errors (duplicate ids, overridden basic skills, missing kits)', () => {
  assert.deepEqual(CATALOG_ERRORS.map((e) => `[${e.where}] ${e.msg}`), []);
});

test('Skill ids are unique and every skill a spirit references exists', () => {
  assert.equal(SKILL_BY_ID.size, SKILLS.length);
  for (const sp of SPIRITS) {
    for (const id of [...sp.learnset.map((e) => e.id), sp.ultimate]) assert.ok(SKILL_BY_ID.has(id), `${sp.id} → ${id}`);
    assert.equal(SKILL_BY_ID.get(sp.ultimate)!.category, 'ultimate', sp.id);
  }
});

test('System actions (Guard) never appear in a learnset', () => {
  for (const sp of SPIRITS) {
    for (const e of sp.learnset) assert.ok(!SYSTEM_SKILL_IDS.has(e.id), `${sp.id} → ${e.id}`);
  }
});

test('Exclusive skills appear only on their designated spirit', () => {
  for (const s of SKILLS.filter((x) => x.exclusive)) {
    const holders = SPIRITS.filter((sp) => sp.learnset.some((e) => e.id === s.id) || sp.ultimate === s.id);
    assert.deepEqual(holders.map((h) => h.id), [s.exclusive], s.id);
  }
});

test('Basic skills have no exclusive field and are placed only on spirits of the same element or Neutral', () => {
  for (const s of SKILLS.filter((x) => x.basic)) {
    assert.equal(s.exclusive, undefined, s.id);
    for (const sp of SPIRITS.filter((x) => x.learnset.some((e) => e.id === s.id))) {
      assert.ok(s.element === 'neutral' || sp.elements.includes(s.element), `${sp.id} → ${s.id}`);
    }
  }
});

test('Every spirit has a 0-cost attack at Lv 1', () => {
  for (const sp of SPIRITS) {
    const has = sp.learnset.some((e) => {
      const s = SKILL_BY_ID.get(e.id);
      return e.lv === 1 && !!s && s.cost === 0 && s.power > 0 && s.category !== 'ultimate';
    });
    assert.ok(has, sp.id);
  }
});

test('Every skill is within its own budget range (basic 0.85-1.05, regular 0.85-1.15, flagship skills by rarity)', () => {
  const bad = SKILLS.map((s) => ({ s, b: checkBudget(s) }))
    .filter(({ b }) => !b.ok)
    .map(({ s, b }) => `${s.id} ${b.kind} ${b.result.ratio.toFixed(2)}（${b.lo}～${b.hi}）`);
  assert.deepEqual(bad, []);
});

test('Every trap has a trigger condition and a speed; non-trap skills have neither', () => {
  for (const s of SKILLS) {
    if (s.category === 'trap') {
      assert.ok(s.trigger && s.trapSpeed, s.id);
    } else {
      assert.equal(s.trigger, undefined, s.id);
      assert.equal(s.trapSpeed, undefined, s.id);
    }
  }
});

test('Pull probabilities sum to 1 and a drop is guaranteed within the hard pity', () => {
  const one = firstSsrDistribution(LIMITED_BANNER);
  assert.ok(Math.abs(cdf(one, LIMITED_BANNER.hardPity) - 1) < 1e-9);
  const feat = featuredDistribution(LIMITED_BANNER);
  assert.ok(Math.abs(cdf(feat, LIMITED_BANNER.hardPity * 2) - 1) < 1e-9);
});

test('The overall probability falls within the design range', () => {
  const r = longRunRates(LIMITED_BANNER);
  assert.ok(r.ssr > 0.025 && r.ssr < 0.035, `SSR ${r.ssr}`);
  assert.ok(r.sr > 0.15 && r.sr < 0.18, `SR ${r.sr}`);
  assert.ok(Math.abs(r.ssr + r.sr + r.r - 1) < 1e-9);
});

test('Hit tiers: knockout is highest, crit outranks heavy, the rest are tiered by damage ratio', async () => {
  const { hitTier, HIT_FEEL, multiHitStopMs } = await import('./feel.ts');
  assert.equal(hitTier({ damageRatio: 0.9, crit: true, ko: true }), 'ko');
  assert.equal(hitTier({ damageRatio: 0.1, crit: true }), 'crit');
  assert.equal(hitTier({ damageRatio: 0.4 }), 'heavy');
  assert.equal(hitTier({ damageRatio: 0.2 }), 'medium');
  assert.equal(hitTier({ damageRatio: 0.05 }), 'light');
  const order = ['light', 'medium', 'heavy', 'crit', 'ko'] as const;
  for (let i = 1; i < order.length; i++) {
    assert.ok(HIT_FEEL[order[i]].hitStopMs > HIT_FEEL[order[i - 1]].hitStopMs);
    assert.ok(HIT_FEEL[order[i]].trauma >= HIT_FEEL[order[i - 1]].trauma);
  }
  assert.equal(multiHitStopMs('heavy', 5, 5), HIT_FEEL.heavy.hitStopMs);
  assert.ok(multiHitStopMs('heavy', 1, 5) < HIT_FEEL.heavy.hitStopMs);
});

test('A learnset is sorted by level, starts at Lv 1 and does not exceed Lv 55', () => {
  for (const sp of SPIRITS) {
    const lvs = sp.learnset.map((e) => e.lv);
    assert.ok(lvs.length > 0, sp.id);
    assert.equal(lvs[0], 1, sp.id);
    assert.ok(lvs.every((lv, i) => i === 0 || lv >= lvs[i - 1]), `${sp.id} is not sorted by level`);
    assert.ok(lvs[lvs.length - 1] <= 55, sp.id);
  }
});
