// Global state: the save + the current screen. React subscribes through useStore().

import { useSyncExternalStore } from 'react';
import type { BattleResult, BattleSetup } from '../battle/controller.ts';
import type { Line } from '../game/campaign.ts';
import { loadSave, newSave, normalizeSave, writeSave, type SaveData } from '../game/save.ts';
import { scheduleSync } from '../game/cloud.ts';
import { devSave } from '../game/devsave.ts';
import { claimable } from '../game/quests.ts';
import type { AdviceContext } from '../game/advice.ts';
import type { RegionId } from '../render/arena.ts';
import type { LevelGain } from '../game/progression.ts';
import type { Reward } from '../game/campaign.ts';
import type { PullResult } from '../game/gachaGame.ts';

export interface ResultInfo {
  result: BattleResult;
  title: string;
  /** Stage or opponent name */
  subtitle?: string;
  gains: LevelGain[];
  reward: Reward | null;
  captured: { speciesId: string; level: number; kind: string } | null;
  firstClear: boolean;
  next: () => void;
  /** Used to generate growth advice after a defeat */
  advice?: AdviceContext;
}

/** The opponent previewed before battle */
export interface FoePreview {
  speciesId: string;
  level: number;
  stage: 1 | 2 | 3;
}

export type Screen =
  | { name: 'title' }
  | { name: 'story'; lines: Line[]; bg: RegionId; next: () => void }
  /** Prologue animation (the origin of the world); continues to next whether watched or skipped */
  | { name: 'prologue'; next: () => void }
  | { name: 'hub' }
  | { name: 'map' }
  /** A region's field (3D exploration) */
  | { name: 'region'; idx: number }
  /** A region's tower (the main-story stages) */
  | { name: 'tower'; idx: number }
  | { name: 'party'; purpose: 'stage' | 'arena' | 'explore'; onGo: () => void; back: () => void; cap?: number; foes?: FoePreview[]; foeTitle?: string }
  | { name: 'battle'; setup: BattleSetup; onEnd: (r: BattleResult) => void; tutorial?: boolean }
  | { name: 'result'; info: ResultInfo }
  | { name: 'team'; uid?: string; tab?: 'spirits' | 'items'; from?: Screen }
  | { name: 'summon'; tutorial?: boolean }
  | { name: 'summonPlay'; results: PullResult[]; back: () => void }
  | { name: 'arena' }
  | { name: 'dex' }
  | { name: 'settings' }
  | { name: 'quests' }
  | { name: 'ending' };

class Store {
  save: SaveData = new URLSearchParams(location.search).has('devsave') ? devSave(new URLSearchParams(location.search).get('devsave') ?? '') : (loadSave() ?? newSave());
  hasSave = !!loadSave() || new URLSearchParams(location.search).has('devsave');
  screen: Screen = { name: 'title' };
  toast: { id: number; text: string } | null = null;
  help = false;
  sid = 0;
  private listeners = new Set<() => void>();
  private snap = { save: this.save, screen: this.screen, toast: this.toast, help: this.help, v: 0, sid: 0 };

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  get = () => this.snap;

  private emit(): void {
    this.snap = { save: this.save, screen: this.screen, toast: this.toast, help: this.help, v: this.snap.v + 1, sid: this.sid };
    for (const l of this.listeners) l();
  }

  go(s: Screen): void {
    this.screen = s;
    this.sid++;
    this.emit();
  }

  mutate(fn: (d: SaveData) => void): void {
    const before = new Set(claimable(this.save).map((q) => q.id));
    fn(this.save);
    writeSave(this.save);
    scheduleSync(() => this.save);
    this.hasSave = true;
    this.emit();
    const fresh = claimable(this.save).filter((q) => !before.has(q.id));
    if (fresh.length) this.showToast(`★ 任務達成：${fresh.map((q) => q.name).join('、')}（到主城「任務」領取）`);
  }

  setHelp(on: boolean): void {
    this.help = on;
    this.emit();
  }

  reset(): void {
    this.save = newSave();
    this.emit();
  }

  /** Switch to another save (one downloaded from the cloud): write it locally and re-render */
  adoptSave(d: SaveData): void {
    this.save = normalizeSave(d);
    writeSave(this.save);
    this.hasSave = true;
    this.emit();
  }

  showToast(text: string): void {
    const t = { id: Date.now() + Math.random(), text };
    this.toast = t;
    this.emit();
    setTimeout(() => {
      if (this.toast?.id === t.id) {
        this.toast = null;
        this.emit();
      }
    }, 2200);
  }
}

export const store = new Store();

export function useStore() {
  return useSyncExternalStore(store.subscribe, store.get);
}

// For testing: with ?devsave it can be driven from the console
if (new URLSearchParams(location.search).has('devsave')) (window as unknown as { __store: Store }).__store = store;
