import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSpirit, getSkill } from '../data.ts';
import { allStages, REGIONS } from './campaign.ts';
import { FIRST_LEVEL, FIRST_LOADOUT, FIRST_PARTNER, RIVAL_LEVEL_BONUS, RIVAL_PARTNER, rivalPartner, signFirstContract, stageTeam } from './opening.ts';
import { validateLoadout } from './progression.ts';
import { newSave, normalizeSave, partySpirits, type SaveData } from './save.ts';

test('New save: forms a pact with the First Pact dragon at Lv 5 and enters the tutorial battle', () => {
  const d = newSave();
  assert.equal(d.starter, '');
  const s = signFirstContract(d);
  assert.equal(d.starter, FIRST_PARTNER);
  assert.equal(FIRST_PARTNER, 'eldarin');
  assert.equal(getSkill(findSpirit(FIRST_PARTNER)!.ultimate).category, 'ultimate');
  assert.equal(findSpirit(FIRST_PARTNER)!.rarity, 'SSR');
  assert.equal(s.level, FIRST_LEVEL);
  assert.deepEqual(s.loadout, FIRST_LOADOUT);
  assert.deepEqual(partySpirits(d).map((x) => x.speciesId), [FIRST_PARTNER]);
  assert.equal(d.dex[FIRST_PARTNER], 'owned');
  assert.equal(d.tutorial, 'battle');
});

test('Calling the pact repeatedly (refresh, double-click) neither adds a spirit nor adds resonance', () => {
  const d = newSave();
  signFirstContract(d);
  signFirstContract(d);
  assert.equal(d.spirits.length, 1);
  assert.equal(d.spirits[0].resonance, 0);
});

test('The skill slots at pact time are valid and carry a 0-cost attack', () => {
  assert.equal(validateLoadout(FIRST_PARTNER, FIRST_LOADOUT, FIRST_LEVEL), null);
});

test('Rival partner: a new save gets Pyre Dragoon, an old save keeps the matchup from the pick-one-of-three era', () => {
  assert.equal(RIVAL_PARTNER, 'pyre_dragoon');
  assert.equal(rivalPartner('eldarin'), 'pyre_dragoon');
  assert.equal(rivalPartner(''), 'pyre_dragoon');
  assert.equal(rivalPartner('pyre_dragoon'), 'oathsea_sage');
  assert.equal(rivalPartner('oathsea_sage'), 'elderwood_warden');
  assert.equal(rivalPartner('elderwood_warden'), 'pyre_dragoon');
});

test('Rival stage: a new save gets its levels topped up, an old save keeps its party unchanged', () => {
  const rivals = allStages().filter(({ stage }) => stage.team?.some((t) => t.speciesId === 'RIVAL'));
  assert.ok(rivals.length >= 3);
  for (const { stage } of rivals) {
    const raw = stage.team!.find((t) => t.speciesId === 'RIVAL')!;
    const fresh = stageTeam(stage, 'eldarin');
    const legacy = stageTeam(stage, 'oathsea_sage');
    assert.ok(!fresh.some((t) => t.speciesId === 'RIVAL') && !legacy.some((t) => t.speciesId === 'RIVAL'));
    const f = fresh[stage.team!.indexOf(raw)];
    const l = legacy[stage.team!.indexOf(raw)];
    assert.equal(f.speciesId, 'pyre_dragoon');
    assert.equal(f.level, raw.level + (RIVAL_LEVEL_BONUS[stage.id] ?? 0));
    assert.deepEqual(l, { ...raw, speciesId: 'elderwood_warden' });
    // The other team members are unaffected
    stage.team!.forEach((t, i) => t.speciesId !== 'RIVAL' && assert.deepEqual(fresh[i], t));
  }
  // Stages with no rival are left untouched
  const plain = REGIONS[0].stages[0];
  assert.deepEqual(stageTeam(plain, 'eldarin'), plain.team);
});

test('An old save (pick-one-of-three era) loads as usual: the starter partner, party and rival are unchanged', () => {
  const old = {
    version: 1,
    createdAt: 1,
    updatedAt: 2,
    playerName: '締約者',
    path: 'sword',
    art: 'oath_break',
    starter: 'pyre_dragoon',
    spirits: [{ uid: 's1', speciesId: 'pyre_dragoon', level: 12, exp: 0, stage: 1, resonance: 0, loadout: [] }],
    party: ['s1'],
    inv: { gold: 10, crystals: 0, tickets: 0, evoStones: 0, shards: 0, potions: 0, stardust: 0, stones: { basic: 1, advanced: 0, master: 0 } },
    cleared: { f1: 1 },
    seenStory: [],
    pity: { count: 0, guaranteed: false, sr: 0 },
    dex: { pyre_dragoon: 'owned' },
    arena: { best: 0 },
    settings: { speed: 1, sfx: 1, music: 1, lowfx: false, auto: false, quality: 'auto' },
    ending: false,
    uidSeq: 2,
  } as unknown as SaveData;
  const d = normalizeSave(JSON.parse(JSON.stringify(old)) as SaveData);
  assert.equal(d.starter, 'pyre_dragoon');
  assert.equal(d.tutorial, undefined);
  assert.deepEqual(partySpirits(d).map((s) => s.speciesId), ['pyre_dragoon']);
  assert.ok(d.spirits[0].loadout.length > 0);
  assert.ok(!d.spirits.some((s) => s.speciesId === FIRST_PARTNER), 'an old save is not given Eldarin');
  assert.equal(rivalPartner(d.starter), 'oathsea_sage');
});
