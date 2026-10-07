// Tutorial battle: the first fight, fought together with the Dragon of the First Pact. The wild Cloudfluff acts by the script, and the tutorial hints (shown by BattleHUD) point at the button to press at each step.
//
//   Turn  Player (hint)                  Cloudfluff (script)  Aether (turn start → end)
//   1     Sigil Claw: basic attack       Strike               3 → 6 (a hit under First Pact's terms +1, turn +2)
//   2     Oathflame: channel             Hum (Fluff 1)        6 → 2 (cost 2, the other 4 points all poured into the dragon breath)
//   3     Sigil Claw: bank the Aether    Hum (Fluff 2)        2 → 5 (First Pact's Pact of Clash ends this turn)
//   4     Guard: block the puffball      Puffball             5 → 6 (the terms have ended, so guarding does not count as breaking the pact)
//   5     True Name: Eldarin (ultimate)  Hum                  6 → 5 (Cloudfluff is left with 1 HP; it then hums, and breaking the Grand Pact costs it 2)
//   6     Capture: the pact stone always succeeds
//
// Both sides carry the tutorial flag (HP never reaches zero), and the hints lock the other buttons, so the ultimate always fires on turn 5.
// The ultimate has to be the biggest number of the whole battle: damage is truncated when it would leave only 1 point, so Cloudfluff's HP is thickened separately (TUTORIAL_FOE.hpBoost),
// and the ultimate is further multiplied by the Star Gate resonance multiplier (TUTORIAL_ULT_BOOST), guaranteeing that a single hit cuts the remaining HP down to 1 point.
// With the fixed seed: Sigil Claw 41, Oathflame 163, ultimate 351 (about 2.2 times Oathflame), see tutorial.test.ts.

import { getSkill } from '../data.ts';
import type { Battle } from '../engine/battle.ts';
import type { TurnInput } from '../engine/types.ts';

/**
 * The tutorial battle's wild spirit: Lv 5 Cloudfluff, stats ×1.3 (still slower than Eldarin), HP a further ×1.5.
 * The three hits before the ultimate (Sigil Claw, Oathflame, Sigil Claw) only take off 40%, leaving the remaining 60% for the ultimate to finish in one go
 */
export const TUTORIAL_FOE = { speciesId: 'cloudfluff', level: 5, boost: 1.3, hpBoost: 1.5, loadout: ['strike', 'cloudfluff_hum', 'cloudfluff_puffball'] };

/** The ultimate multiplier from Star Gate resonance: even with no crit and the lowest roll, Cloudfluff is always brought down to 1 point */
export const TUTORIAL_ULT_BOOST = 3;

/** Battle seed of the tutorial battle */
export const TUTORIAL_SEED = 20261244;

/** Cloudfluff's action each turn (turn 4 throws a puffball with two stacks of Fluff, so the player can practice guarding) */
const FOE_SCRIPT = ['strike', 'cloudfluff_hum', 'cloudfluff_hum', 'cloudfluff_puffball'];
/** After which turn (the number of finished turns) guarding is taught */
const GUARD_TURN = 3;
const CLAW = 'eldarin_sigil_claw';
const FLAME = 'eldarin_oath_flame';

/** The tutorial spirit's next action; null hands over to the regular AI */
export function tutorialFoeAction(b: Battle): TurnInput | null {
  const id = FOE_SCRIPT[b.s.turn] ?? 'cloudfluff_hum';
  return b.canUse(1, id).ok ? { main: { type: 'skill', skillId: id } } : null;
}

// ───────────────────────── Tutorial hints ─────────────────────────

export interface Coach {
  /** The skill card pointed at */
  card?: number;
  /** Show the explanation on the Aether bar (the skill cards are then only outlined and show no separate bubble) */
  aether?: boolean;
  /** Points at the "Capture" button */
  capture?: boolean;
  /** Points at the "Guard" button (the tutorial battle normally does not show Guard) */
  guard?: boolean;
  /** Other skill cards are dimmed and cannot be clicked */
  lock?: boolean;
  text: string;
}

type UltState = 'locked' | 'charging' | 'ready' | 'used';

/** Skill cards (BattleHUD's cards; est is only used by the old tutorial) */
interface CoachCard {
  id: string;
  ok: boolean;
  cost?: number;
  est?: { dmg: number };
}

/** This turn's tutorial hint (decided by the state of the battle, and can be resumed from the start after a refresh) */
export function coachStep(b: Battle, cards: CoachCard[], ult: UltState | undefined, aether: number): Coach | null {
  return b.active(0).species.id === 'eldarin' ? eldarinStep(b, cards, ult, aether) : legacyStep(b, cards, ult, aether);
}

function eldarinStep(b: Battle, cards: CoachCard[], ult: UltState | undefined, aether: number): Coach {
  const t = b.s.turn;
  const at = (id: string) => cards.findIndex((c) => c.id === id && c.ok);
  const ultIdx = cards.findIndex((c) => getSkill(c.id).category === 'ultimate');
  const claw = at(CLAW);
  if (b.side(0).ultUsed) return { capture: true, lock: true, text: '艾爾達林：「我有手下留情。牠只是被光吸引過來的，沒有惡意。」丟出契約石，跟牠締約吧！' };
  if (t > GUARD_TURN && ult === 'ready' && cards[ultIdx]?.ok) return { card: ultIdx, lock: true, text: '靈能夠了！點金色的奧義卡，讓牠使出全力' };
  if (t === GUARD_TURN && b.canGuard(0).ok) return { guard: true, lock: true, text: '絨雲要丟絨球了！點「格擋」擋下來' };
  if (t === 1 && at(FLAME) >= 0) return { card: at(FLAME), lock: true, aether: true, text: `奧義先留著。「誓約龍炎」會把剩下的靈能全部灌進龍息，每點威力 +30，現在有 ${aether} 點，吐出去！` };
  if (t === 0 && claw >= 0) return { card: claw, lock: true, text: '點「契印爪」攻擊' };
  return {
    card: claw >= 0 ? claw : undefined,
    lock: claw >= 0,
    aether: true,
    text: `奧義要 5 點靈能，現在 ${aether} 點。每回合 +2，契印爪在「條款」生效時命中再 +1，用它把靈能存起來`,
  };
}

/** When an old save (starter partner picked from three) is stuck in the tutorial battle: attack → use 0-cost skills to bank Aether up to 5 → ultimate → weaken → capture */
function legacyStep(b: Battle, cards: CoachCard[], ult: UltState | undefined, aether: number): Coach | null {
  const turn = b.s.turn;
  const foe = b.active(1);
  const foeHp = foe.hp / foe.maxHp;
  const best = cards.reduce((bi, c, i) => (c.ok && c.est && c.est.dmg > (cards[bi]?.ok ? cards[bi].est?.dmg ?? -1 : -1) ? i : bi), -1);
  const ultIdx = cards.length - 1;
  if (ult === 'ready' && cards[ultIdx]?.ok) return { card: ultIdx, lock: true, text: '靈能集滿 5 點！點金色的奧義卡，讓夥伴使出全力' };
  if (ult === 'charging') {
    if (turn === 0 && best >= 0) return { card: best, lock: true, text: '點擊此技能卡發動攻擊' };
    const free = cards.findIndex((c) => c.ok && c.cost === 0 && c.est);
    return { card: free >= 0 ? free : undefined, lock: free >= 0, aether: true, text: `奧義要 5 點靈能，現在 ${aether} 點。每回合 +2，這回合用 0 費技能攻擊，把靈能存起來` };
  }
  if (foeHp >= 0.35 && best >= 0) return { card: best, lock: true, text: '再攻擊一次，削弱牠' };
  return { capture: true, lock: true, text: '牠已經很虛弱了！點「捕捉」擲出契約石' };
}
