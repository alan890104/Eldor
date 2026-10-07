// Tests for the kit rules themselves: use a fictional R spirit kit to confirm the "full rules" pass and violations are caught.
// This example is also a reference for a valid kit (see docs/10-kit-authoring.md).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUP_OF_SPIRIT, registerSkills, SPIRIT_BY_ID, SPIRITS } from './catalog.ts';
import { checkBudget, checkKit } from './kitrules.ts';
import type { SkillDef, SpiritDef } from './types.ts';

const X = 'x_emberfox';
const S = (id: string, category: SkillDef['category'], cost: number, power: number, tags: Record<string, number>, extra: Partial<SkillDef> = {}): SkillDef => ({
  id,
  name: id,
  en: id,
  element: 'fire',
  category,
  cost,
  power,
  accuracy: 100,
  priority: 0,
  exclusive: X,
  text: '範例',
  tags,
  ...extra,
});

const KIT: SkillDef[] = [
  S('x_jab', 'physical', 0, 55, { 'status.burn': 0.1 }),
  S('x_kindle', 'status', 1, 0, { 'self.atk': 1, custom: 45 }),
  S('x_step', 'physical', 1, 70, { 'status.burn': 0.2 }),
  S('x_guard', 'status', 2, 0, { shield: 30, custom: 45 }),
  S('x_burnout', 'physical', 2, 90, { sig: 1, custom: 40 }),
  S('x_cinder', 'trap', 2, 0, { trueDamage: 15, 'status.burn': 1, odds: 0.6 }, { trapSpeed: 'normal', trigger: '對手精靈替換入場時' }),
  S('x_drive', 'physical', 3, 135, {}),
  S('x_fang', 'physical', 4, 145, { critRate: 0.2 }),
  S('x_ult', 'ultimate', 5, 200, { 'status.burn': 1, custom: -15 }),
];

const spirit: SpiritDef = {
  ...SPIRIT_BY_ID.get('pyre_dragoon')!,
  id: X,
  rarity: 'R',
  learnset: [
    { lv: 1, id: 'flame_claw' },
    { lv: 1, id: 'x_jab' },
    { lv: 5, id: 'x_kindle' },
    { lv: 9, id: 'blaze_slash' },
    { lv: 13, id: 'x_step' },
    { lv: 17, id: 'x_guard' },
    { lv: 20, id: 'fireball' },
    { lv: 24, id: 'heat_up' },
    { lv: 28, id: 'x_burnout' },
    { lv: 33, id: 'x_cinder' },
    { lv: 38, id: 'x_drive' },
    { lv: 45, id: 'x_fang' },
  ],
  ultimate: 'x_ult',
  core: ['x_burnout', 'x_kindle'],
  mechanic: { name: '餘燼', text: '範例機制' },
};

// Temporarily add the example to the catalog (affects only this test process)
registerSkills(KIT, 'fire');
SPIRITS.push(spirit);
SPIRIT_BY_ID.set(X, spirit);
(GROUP_OF_SPIRIT as Map<string, string>).set(X, 'fire');

test('The example R kit satisfies the full rules', () => {
  assert.deepEqual(checkKit(spirit).problems, []);
});

test('Flagship skill and ultimate budget ranges are computed by rarity', () => {
  const sig = checkBudget(KIT.find((s) => s.id === 'x_burnout')!);
  assert.equal(sig.kind, 'sig');
  assert.equal(sig.lo, 1);
  assert.equal(sig.hi, 1.25);
  const ult = checkBudget(KIT.find((s) => s.id === 'x_ult')!);
  assert.equal(ult.kind, 'ultimate');
  assert.equal(ult.result.target, 175 + 80);
});

test('Violations are caught: missing mechanic, too many or too late basic skills, flagship skill count, learnset too short', () => {
  const bad = (patch: Partial<SpiritDef>) => checkKit({ ...spirit, ...patch }).problems.join('\n');
  assert.match(bad({ mechanic: undefined }), /signature mechanic/);
  assert.match(bad({ learnset: [...spirit.learnset, { lv: 30, id: 'ember' }] }), /basic skill/);
  assert.match(bad({ learnset: spirit.learnset.filter((e) => e.id !== 'x_burnout') }), /flagship skills/);
  assert.match(bad({ learnset: spirit.learnset.slice(0, 8) }), /11 to 13/);
  assert.match(bad({ learnset: spirit.learnset.map((e) => (e.id === 'x_jab' ? { ...e, lv: 3 } : e)) }), /Lv 1/);
});
