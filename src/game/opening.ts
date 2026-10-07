// Opening: the first pact of a new save (Eldarin, Dragon of the First Pact), and the rival Kael's partner.
// The old opening was a pick of one in three (Pyre Dragoon / Oathsea Sage / Elderwood Warden); an old save's starter is still one of those three, and the rules here must keep working for them.

import type { SpiritInstance } from '../engine/types.ts';
import type { EnemyDef, StageDef } from './campaign.ts';
import { addSpirit, type SaveData } from './save.ts';

/** The first spirit: the Dragon of the First Pact who wakes when the Star Gate is rekindled */
export const FIRST_PARTNER = 'eldarin';
/** Level at the time of the pact (the same as the old pick-one-of-three starter; the forest's balance is tuned to a main force of Lv 5 to 6) */
export const FIRST_LEVEL = 5;
/** Skill bar at the time of the pact: the basic attack goes leftmost, and the tutorial battle teaches Sigil Claw → Oathflame in order */
export const FIRST_LOADOUT = ['eldarin_sigil_claw', 'eldarin_oath_flame', 'pact_breath'];

/** Form a pact with the Dragon of the First Pact: it joins the team, is recorded as the starter partner, and the new-player guide advances to the tutorial battle. Calling it again does not give an extra spirit */
export function signFirstContract(d: SaveData): SpiritInstance {
  const had = d.spirits.find((s) => s.speciesId === FIRST_PARTNER);
  d.starter = FIRST_PARTNER;
  d.tutorial = 'battle';
  if (had) return had;
  const { spirit } = addSpirit(d, FIRST_PARTNER, FIRST_LEVEL);
  spirit.loadout = [...FIRST_LOADOUT];
  return spirit;
}

// ───────────────────────── Rival ─────────────────────────

/** Rival Kael's partner: the Pyre Dragoon revered as guardian by the knights of the Crimson Iron Fortress */
export const RIVAL_PARTNER = 'pyre_dragoon';

/** Old saves from the pick-one-of-three era: the rival brings the spirit that counters the protagonist's starter. Kept as is, so the rival does not change partners halfway through */
const LEGACY_RIVAL: Record<string, string> = { pyre_dragoon: 'oathsea_sage', oathsea_sage: 'elderwood_warden', elderwood_warden: 'pyre_dragoon' };

/**
 * The old rival countered the protagonist's starter by element; the new one has no matchup against Eldarin, so a level bonus makes up the pressure instead (by stage id).
 * Simulated with random SR/R teammates: with no bonus, the tournament (v3) win rate was nearly double the old average; after +4 it returns to a gap consistent with the other floors of the same region;
 * the duel under the thunderclouds (p3) only gets 1 level, since going up to Lv 40 would break through to stage III early and add an ultimate; before fighting side by side (r2) no bonus is needed.
 */
export const RIVAL_LEVEL_BONUS: Record<string, number> = { v3: 4, p3: 1 };

export function isLegacyStarter(starter: string): boolean {
  return starter in LEGACY_RIVAL;
}

/** The rival's partner (according to the save's starter partner) */
export function rivalPartner(starter: string): string {
  return LEGACY_RIVAL[starter] ?? RIVAL_PARTNER;
}

/** The enemy team of a stage: swaps 'RIVAL' for the rival's partner (the new version also adds a level adjustment) */
export function stageTeam(st: StageDef, starter: string): EnemyDef[] {
  const legacy = isLegacyStarter(starter);
  return (st.team ?? []).map((t) => (t.speciesId === 'RIVAL' ? { ...t, speciesId: rivalPartner(starter), level: t.level + (legacy ? 0 : RIVAL_LEVEL_BONUS[st.id] ?? 0) } : t));
}
