// Background music: one track per scene (the track list is in music/catalog.ts, the engine in music/engine.ts).
// When switching, the old track fades out and the new one fades in; song files and instrument samples are prepared on first play.

import { synth } from './sfx.ts';
import { summonMusic } from './summonMusic.ts';
import { SongPlayer, playOnce, prepareSong } from './music/engine.ts';
import { loadSong } from './music/catalog.ts';
import { JINGLES } from './music/songs/jingles.ts';

/** Song id: title, hub, map, ending, summon, field:<region>, tower:<region>, wild:<region>, trainer, rival, arena, corrupt, cult, boss, final; none is silence */
export type SongId = string;

class Music {
  private current: SongId = 'none';
  private player: SongPlayer | null = null;
  private timer: number | null = null;
  /** Incremented on every song change: when async preparation finishes, only start playing if it is still the same song */
  private token = 0;

  disabled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nomusic');

  get playing(): SongId {
    return this.current;
  }

  play(id: SongId): void {
    if (this.disabled) return;
    if (id === this.current) return;
    this.stop();
    this.current = id;
    if (id === 'none') return;
    synth.unlock();
    const ctx = synth.ctx;
    if (!ctx) return;
    // The summon track follows the cutscene, so it is handed to its own sequencer
    if (id === 'summon') {
      summonMusic.start();
      return;
    }
    const tok = ++this.token;
    this.prep = loadSong(id)
      .then(async (def) => {
        await prepareSong(ctx, def);
        this.warmJingles(ctx);
        if (tok !== this.token || this.current !== id) return;
        this.player = new SongPlayer(ctx, synth.music, def, ctx.currentTime + 0.08, def.intro?.length ? 0.05 : 1.2);
        this.ensureTimer();
      })
      .catch((e) => console.warn('[music]', e));
  }

  /** Preparation of the current song (preparing the next one in advance queues behind it, so it does not compete for the main thread) */
  private prep: Promise<void> = Promise.resolve();
  /** Pre-compute the samples of songs that may play later (e.g. this region's wild encounter theme), so there is no wait when actually switching */
  preload(id: SongId): void {
    if (this.disabled) return;
    const ctx = synth.ctx;
    if (!ctx) return;
    this.prep = this.prep.then(() => loadSong(id).then((def) => prepareSong(ctx, def))).catch(() => {});
  }

  /** If audio has not been unlocked yet, replay once it is */
  resume(): void {
    const id = this.current;
    if (id === 'summon') {
      summonMusic.start();
      return;
    }
    if (id !== 'none' && !this.player) {
      this.current = 'none';
      this.play(id);
    }
  }

  stop(): void {
    if (this.current === 'summon') summonMusic.stop();
    this.token++;
    this.player?.stop(0.9);
    this.player = null;
    this.current = 'none';
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** Stop the soundtrack and play a short jingle (victory / defeat); stay silent afterwards until the next screen calls play() */
  sting(id: 'victory' | 'defeat'): void {
    this.stop();
    if (this.disabled) return;
    const ctx = synth.ctx;
    if (!ctx) return;
    playOnce(ctx, synth.music, JINGLES[id]);
  }

  private warmed = false;
  /** The short jingles for victory / defeat / obtaining something are prepared synchronously on the spot: once the first song is ready, compute their samples in the background */
  private warmJingles(ctx: BaseAudioContext): void {
    if (this.warmed) return;
    this.warmed = true;
    void (async () => {
      for (const j of Object.values(JINGLES)) await prepareSong(ctx, j);
    })();
  }

  private ensureTimer(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => {
      const ctx = synth.ctx;
      if (!ctx || !this.player) return;
      // A background tab's timer is throttled to about once per second, so schedule further ahead to avoid dropouts
      const ahead = document.hidden ? 1.6 : 0.25;
      this.player.tick(ctx.currentTime + ahead);
    }, 25);
  }
}

export const music = new Music();
