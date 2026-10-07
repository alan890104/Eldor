// Save for development testing (add ?devsave to the URL).

import { REGIONS } from './campaign.ts';
import { sanitizeLoadout } from './loadout.ts';
import { FIRST_PARTNER } from './opening.ts';
import { addSpirit, newSave, type SaveData } from './save.ts';

/** ?devsave=late: a late-game save that is only missing the final stage */
export function devSave(kind = ''): SaveData {
  const d = kind === 'late' ? lateSave() : earlySave();
  for (const s of d.spirits) sanitizeLoadout(s);
  return d;
}

function lateSave(): SaveData {
  const d = newSave();
  d.starter = FIRST_PARTNER;
  d.art = 'oath_break';
  for (const [id, lv] of [['luminael', 60], ['noxfang', 60], [FIRST_PARTNER, 60], ['oathsea_sage', 56], ['gale_weasel', 56]] as const) {
    const r = addSpirit(d, id, lv, true);
    r.spirit.stage = 3;
    d.dex[id] = 'owned';
  }
  d.party = d.spirits.slice(0, 3).map((s) => s.uid);
  REGIONS.forEach((r, ri) => r.stages.forEach((s, si) => {
    if (!(ri === REGIONS.length - 1 && si === r.stages.length - 1)) d.cleared[s.id] = 1;
  }));
  d.seenStory.push(...REGIONS.map((r) => `intro-${r.id}`), 'tour-hub');
  d.inv = { gold: 200000, crystals: 8000, tickets: 30, breakStones: 60, shards: 20, potions: 20, stardust: 0, stones: { basic: 10, advanced: 5, master: 2 } };
  return d;
}

function earlySave(): SaveData {
  const d = newSave();
  d.starter = FIRST_PARTNER;
  d.art = 'oath_break';
  const add = (id: string, lv: number, stage?: 1 | 2 | 3) => {
    const r = addSpirit(d, id, lv, true);
    if (stage) r.spirit.stage = stage;
    return r.spirit;
  };
  add(FIRST_PARTNER, 20, 1);
  add('oathsea_sage', 24);
  add('gale_weasel', 25);
  add('stormram', 18);
  add('noxfang', 42);
  add('luminael', 40);
  add('cloudfluff', 12);
  d.party = d.spirits.slice(0, 3).map((s) => s.uid);
  for (const r of REGIONS.slice(0, 2)) for (const s of r.stages) d.cleared[s.id] = 1;
  d.seenStory.push('intro-forest', 'intro-isles', 'intro-volcano', 'tour-hub');
  d.inv = { gold: 50000, crystals: 5000, tickets: 20, breakStones: 40, shards: 10, potions: 10, stardust: 0, stones: { basic: 10, advanced: 5, master: 2 } };
  for (const s of d.spirits) d.dex[s.speciesId] = 'owned';
  return d;
}
