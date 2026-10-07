// Astralgate summon music: cues that follow the cutscene -> switch the loops and one-shot sections in the music engine. The song itself is in music/songs/summon.ts.
// Only one loop (idle, tension, afterglow) plays at a time, with a crossfade when it changes; the one-shot sections (build-up, meteor, upgrade to gold, gate opening, fanfare, summary) are layered on top.

import type { Element } from '../../sim/types.ts';
import { synth } from './sfx.ts';
import { SongPlayer, playOnce, prepareSong, prepareSongSync, type SongDef } from './music/engine.ts';
import * as score from './music/songs/summon.ts';

type LoopState = 'idle' | 'tension' | 'afterglow';
export type SummonCue = 'idle' | 'build' | 'drop' | 'upgrade' | 'gate' | 'ssr' | 'summary';

const LOOPS: Record<LoopState, SongDef> = { idle: score.idle, tension: score.tension, afterglow: score.afterglow };

class SummonMusic {
  private ctx: BaseAudioContext | null = null;
  private loop: SongPlayer | null = null;
  private loopState: LoopState | null = null;
  private shots: SongPlayer[] = [];
  private timer: number | null = null;
  running = false;

  private ensure(): boolean {
    const ctx = synth.ctx;
    if (!ctx) return false;
    // The context changed (e.g. a test attached an OfflineAudioContext): the old players are discarded
    if (this.ctx !== ctx) {
      this.ctx = ctx;
      this.loop = null;
      this.loopState = null;
      this.shots = [];
    }
    return true;
  }

  /** Summon pool screen: start the idle loop (do nothing if it is already playing) */
  start(): void {
    if (!this.ensure()) return;
    if (this.timer === null) {
      this.timer = window.setInterval(() => {
        if (this.ctx && this.loop) this.loop.tick(this.ctx.currentTime + (document.hidden ? 1.6 : 0.25));
      }, 25);
    }
    // Already playing (in any state): do not interrupt; music.resume() calls in on every unlock
    if (this.running) return;
    this.running = true;
    this.switchLoop('idle', this.ctx!.currentTime + 0.05, 1.2);
    // Compute the string samples for the build-up hit in the background, so pressing summon does not stutter
    void prepareSong(this.ctx!, score.build(1.3));
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.loop?.stop(0.6);
    this.loop = null;
    this.loopState = null;
    for (const s of this.shots) s.stop(0.5);
    this.shots = [];
  }

  /** Switch loops: the old one fades out, the new one fades in from startAt (its first beat aligned to startAt) */
  private switchLoop(state: LoopState, startAt: number, fadeIn = 0.3): void {
    const ctx = this.ctx!;
    this.loop?.stop(0.3);
    prepareSongSync(ctx, LOOPS[state]);
    this.loop = new SongPlayer(ctx, synth.music, LOOPS[state], startAt, fadeIn);
    this.loopState = state;
  }

  private endLoop(fade = 0.25): void {
    this.loop?.stop(fade);
    this.loop = null;
    this.loopState = null;
  }

  private shot(def: SongDef): SongPlayer {
    const p = playOnce(this.ctx!, synth.music, def);
    this.shots = this.shots.filter((s) => s !== p).slice(-8);
    this.shots.push(p);
    return p;
  }

  /** Cutscene cue: called by SummonScene on the matching visual beat */
  cue(c: SummonCue, arg?: number | Element): void {
    if (!this.ensure() || !this.running) return;
    const now = this.ctx!.currentTime;
    switch (c) {
      case 'idle':
        if (this.loopState !== 'idle') this.switchLoop('idle', now + 0.05, 0.8);
        break;
      case 'build':
        this.endLoop();
        this.shot(score.build(typeof arg === 'number' ? arg : 1.3));
        break;
      case 'drop':
        this.shot(score.drop);
        break;
      case 'upgrade':
        this.shot(score.upgrade);
        break;
      case 'gate':
        this.shot(score.gate);
        this.switchLoop('tension', now + 0.07, 0.15);
        break;
      case 'ssr':
        this.endLoop(0.2);
        this.shot(score.fanfare(typeof arg === 'string' ? arg : 'neutral'));
        // Hand over to the afterglow when the fanfare ends
        this.switchLoop('afterglow', now + 0.03 + score.FANFARE_SEC, 0.2);
        break;
      case 'summary':
        this.endLoop();
        this.shot(score.resolve);
        this.switchLoop('idle', now + 0.02 + score.RESOLVE_TO_IDLE, 1.0);
        break;
    }
  }
}

export const summonMusic = new SummonMusic();
