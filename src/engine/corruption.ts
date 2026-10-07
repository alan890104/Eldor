// Corruption (the void-eroded body): rules for spirits tainted by void erosion, applied through traitHooks to a `corrupted` combatant.
// Frenzy: ATK and MAG x1.2. Erosion: loses 1/12 of max HP at the end of each turn. Photophobia: takes light damage x1.3.
// A corrupted spirit cannot be caught with a pact stone (captureOdds in battle.ts); it has to be knocked out and purified first.

import type { KitHooks } from './skillfx.ts';

export const CORRUPT_POWER = 1.2;
export const CORRUPT_DECAY = 100 / 12;
export const CORRUPT_LIGHT = 1.3;

export const CORRUPTION: KitHooks = {
  statMult(_b, _id, key) {
    return key === 'atk' || key === 'mag' ? CORRUPT_POWER : 1;
  },
  onEndTurn(b, id) {
    b.trueDamage(id, CORRUPT_DECAY, 'corrupt');
  },
  incoming(_b, a, dmg) {
    return a.sk.element === 'light' ? dmg * CORRUPT_LIGHT : dmg;
  },
};
