// Interface of the ultimate cinematic script. The director calls the script at four points:
//   use event → windup (announcement, true name release)
//   before the first hit/miss/guarded → deliver (the move itself, held at the moment before impact)
//   every hit → impact (the default hit cinematic plays as usual; this only adds to it)
//   guarded without breaking through → guarded, then settle; miss → settle
//   after the attack ends and the spirits return to position → finish (afterglow, camera pulled back, post-processing restored)

import type { Element, SkillDef } from '../../../sim/types.ts';
import type { BattleEvent, BattleView, SideId } from '../../engine/types.ts';
import type { BattleUI } from '../director.ts';
import type { BattleScene } from '../scene.ts';
import type { Cine } from './cine.ts';

export type HitEv = Extract<BattleEvent, { k: 'hit' }>;

export interface UltCtx {
  sc: BattleScene;
  ui: BattleUI;
  cine: Cine;
  /** The caster */
  side: SideId;
  foe: SideId;
  skill: SkillDef;
  el: Element;
  speciesId: string;
  /** Display name */
  who: string;
  physical: boolean;
  /** The state of the battle at the moment of the use event (readable mechanic markers, e.g. tide level, strata count) */
  view: BattleView;
  /** The latest state of the battle (used at wrap-up: markers after the hit, e.g. the corona and azure flame the ultimate opened) */
  latest(): BattleView;
  /** Waiting on the world clock: stops during hit-stop, shortened by battle speed */
  wait(sec: number): Promise<void>;
  /** Scratch state passed between scripts (e.g. persistent VFX to switch off at wrap-up) */
  mem: Record<string, unknown>;
}

export interface UltScript {
  windup(c: UltCtx): Promise<void>;
  deliver(c: UltCtx): Promise<void>;
  impact?(c: UltCtx, ev: HitEv): void;
  /** true: on impact, do not stack the director's generic hit VFX (light orb, slash marks, particles, element VFX, white flash, chromatic aberration); the impact visuals are made entirely by impact; hit-stop, shake, sound and damage numbers play as usual */
  quietHit?: boolean;
  /** true: on impact the opponent is not knocked back (only the hit flash and tremble remain); for ultimates that pin the opponent in a cage, a seal and the like */
  pinFoe?: boolean;
  guarded?(c: UltCtx): Promise<void>;
  /** After a miss, or after being blocked (when there is no hit climax to wrap up the cinematic state) */
  settle?(c: UltCtx): void;
  finish(c: UltCtx): Promise<void>;
}
