// Shared safety net and small utilities for SSR ultimates; not a template.
// Every SSR cinematic is designed on its own: how the opening is announced, how the true name release is shot, the signature shot, the impact climax and the afterglow are all decided by ssr/<spirit id>.ts itself,
// and they must grow out of that spirit's own mechanic and model. This file is only responsible for:
//   - restoring the camera, post-processing and music at wrap-up (whatever happens mid-cinematic)
//   - fallback handling for being guarded (without breaking through) and for a miss
//   - a few commonly used helpers (settle, eyeGlint)

import type * as THREE from 'three';
import { synth } from '../../audio/sfx.ts';
import { ultSfx } from './cine.ts';
import { ultGuarded } from './generic.ts';
import type { HitEv, UltCtx, UltScript } from './types.ts';

export interface SsrScript {
  /** use event: everything from the announcement to just before the move is released (how many beats, how they are shot, and when the ultimate's name is shown are all its own decisions) */
  windup(c: UltCtx): Promise<void>;
  /** The move itself, held at the moment before impact (called before the first hit/miss/guarded event) */
  deliver(c: UltCtx): Promise<void>;
  /** Each hit (the default hit-stop, shake and damage numbers play as usual): its own impact climax */
  impact?(c: UltCtx, ev: HitEv): void;
  /** true: do not stack the director's generic hit VFX and white flash (night and dark-stage ultimates would be washed out to a chalky grey); the impact visuals are made entirely by impact */
  quietHit?: boolean;
  /** true: on impact the opponent is not knocked back and stays where the ultimate placed them (cage, seal) */
  pinFoe?: boolean;
  /** Guarded (without breaking through); by default the barrier is almost shattered and finally holds */
  guarded?(c: UltCtx): Promise<void>;
  /** Wrap up the cinematic state after a block or a miss; defaults to settle() */
  settle?(c: UltCtx): void;
  /** Afterglow: switch off its own persistent VFX, restore model colors... (the camera and post-processing are restored afterwards by the safety net) */
  after?(c: UltCtx): Promise<void>;
}

/**
 * Wrap up the cinematic state: colors return, speed lines and radial blur stop, bloom is pressed back to normal, and after holding for hold seconds the camera pulls back to the wide shot
 * (the post-hit battle text, such as mechanic triggers and knock-outs, is read in the wide shot). Usable by both the impact climax and a miss.
 */
export function settle(c: UltCtx, hold = 0.5, dur = 0.3): void {
  const { sc, cine } = c;
  void cine.look({ desat: 0, isolate: 0, tint: 0xffffff, lift: 0x000000, vignette: 0.45, grain: 0, lines: 0, radial: 0, haze: 0, bloom: sc.stage.bloomBase * 0.85 }, dur);
  void c.wait(hold).then(() => {
    cine.track(null);
    void sc.rig.reset(0.8);
    void cine.look({ fov: 1, roll: 0 }, 0.8);
  });
}

/** Eye glint: a four-pointed star on each eye (on the head when there are no eye nodes) */
export function eyeGlint(c: UltCtx, color: THREE.ColorRepresentation, size = 1): void {
  const { sc, side } = c;
  const h = sc.slots[side].creature?.worldHeight ?? 1.5;
  const eyes = sc.eyes(side);
  for (const e of eyes.length ? eyes : [sc.head(side)]) void sc.vfx.glint(e, color, (0.22 + h * 0.06) * size, 0.6, 2.8);
  ultSfx.shing();
}

function fail(c: UltCtx, beat: string, e: unknown): void {
  console.error(`Ultimate cutscene error: ${c.speciesId}, beat ${beat}`, e);
}

/**
 * Wrap an SSR cinematic in the safety net: if any stage errors, it is only logged and the battle carries on,
 * and wrap-up always restores the camera, post-processing, time scale and music (the cinematic touches the sky, fog and time, so it cannot be left stuck halfway).
 */
export function defineSsr(s: SsrScript): UltScript {
  const guarded = s.guarded ?? ultGuarded;
  return {
    quietHit: s.quietHit,
    pinFoe: s.pinFoe,
    async windup(c) {
      try {
        await s.windup(c);
      } catch (e) {
        fail(c, 'windup', e);
      }
    },
    async deliver(c) {
      try {
        await s.deliver(c);
      } catch (e) {
        fail(c, 'deliver', e);
      }
    },
    impact(c, ev) {
      try {
        s.impact?.(c, ev);
      } catch (e) {
        fail(c, 'impact', e);
      }
    },
    async guarded(c) {
      try {
        await guarded(c);
      } catch (e) {
        fail(c, 'guarded', e);
      }
    },
    settle(c) {
      try {
        if (s.settle) s.settle(c);
        else settle(c);
      } catch (e) {
        fail(c, 'settle', e);
      }
    },
    async finish(c) {
      try {
        await s.after?.(c);
      } catch (e) {
        fail(c, 'after', e);
      }
      synth.restoreMusic(400);
      await c.wait(0.3);
      await c.cine.restore(0.6);
    },
  };
}
