// Hooks GSAP timelines up to the project's clocks: GSAP does not run on its own, the scene's main loop advances two paused root timelines.
//   world: stops during hit-stop (like the world clock in tween.ts); use it for character actions and the ordering of a cinematic
//   fx: keeps running during hit-stop; use it for effects and screen post-processing
// Both are multiplied by the battle speed. When the scene is disposed, kill() clears every child timeline, and interrupted timelines fire onInterrupt.
//
// Usage:
//   const tl = sc.gs.timeline('world');
//   tl.call(() => cine.cut(a, b), [], 0).to(gate, { open: 1, duration: 0.4 }, 0.3).addLabel('impact', 1.2);
//   await playTimeline(tl);

import { gsap } from 'gsap';

export type GsClock = 'world' | 'fx';

export class GsapClock {
  readonly world = gsap.timeline({ paused: true, autoRemoveChildren: true });
  readonly fx = gsap.timeline({ paused: true, autoRemoveChildren: true });

  /** Called by the scene every frame; dt is already multiplied by the battle speed and is 0 during hit-stop */
  update(dt: number, fxDt: number): void {
    if (dt > 0) this.world.totalTime(this.world.totalTime() + dt);
    if (fxDt > 0) this.fx.totalTime(this.fx.totalTime() + fxDt);
  }

  /** A new timeline that starts running from now */
  timeline(clock: GsClock = 'world', vars?: gsap.TimelineVars): gsap.core.Timeline {
    const root = this[clock];
    const tl = gsap.timeline(vars);
    root.add(tl, root.time());
    return tl;
  }

  /** Kill every timeline that is still running (when leaving a battle) */
  kill(): void {
    for (const root of [this.world, this.fx]) {
      for (const c of root.getChildren(false, true, true)) c.kill();
      root.clear();
    }
  }
}

/** Wait for a timeline to finish; the wait also ends when it is killed, so the code after it never hangs (the timeline's own onComplete and onInterrupt are still called) */
export function playTimeline(tl: gsap.core.Timeline): Promise<void> {
  return new Promise((resolve) => {
    if (tl.progress() >= 1) return resolve();
    for (const ev of ['onComplete', 'onInterrupt'] as const) {
      const prev = tl.eventCallback(ev) as (() => void) | null;
      tl.eventCallback(ev, () => {
        prev?.();
        resolve();
      });
    }
  });
}
