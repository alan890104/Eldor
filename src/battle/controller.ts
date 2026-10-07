// Battle controller: ties together the engine, the AI, the cinematics and the UI state.

import * as THREE from 'three';
import { Battle, type TeamSpec } from '../engine/battle.ts';
import { chooseAction, chooseReplacement } from '../engine/ai.ts';
import type { BattleKind, BattleView, SideId, TurnInput } from '../engine/types.ts';
import type { RegionId } from '../render/arena.ts';
import type { Stage } from '../render/stage.ts';
import { ease } from '../render/tween.ts';
import type { Element } from '../../sim/types.ts';
import { BattleScene } from './scene.ts';
import { Director, type BattleUI } from './director.ts';
import { sfx } from '../audio/sfx.ts';

export interface BattleSetup {
  kind: BattleKind;
  region: RegionId;
  enemyName: string;
  player: TeamSpec;
  enemy: TeamSpec;
  aiSkill: number;
  stones?: { basic: number; advanced: number; master: number };
  seed?: number;
  boss?: boolean;
  /** Opening story blessing (the stat multiplier must also be set on player.boost) */
  blessing?: { name: string; text: string };
  /** Music (a track id from music/catalog.ts); if omitted, picked by kind and region */
  music?: string;
  /** Scripted enemy actions (the tutorial battle): return null to hand over to the regular AI */
  foeScript?: (b: Battle) => TurnInput | null;
}

export interface BattleResult {
  winner: SideId | 'draw';
  captured: boolean;
  turns: number;
  /** Enemy spirits that were knocked out (for the experience calculation) */
  defeated: { speciesId: string; level: number }[];
  capturedSpirit?: { speciesId: string; level: number };
  stonesUsed: { basic: number; advanced: number; master: number };
}

export type Phase = 'intro' | 'input' | 'playing' | 'replace' | 'end';

export interface Banner {
  id: number;
  text: string;
  sub: string;
  color: number;
  side: SideId | null;
}

export interface Cutin {
  id: number;
  side: SideId;
  spirit: string;
  skill: string;
  element: Element;
  ssr: boolean;
}

export interface HudState {
  view: BattleView | null;
  phase: Phase;
  log: string[];
  banner: Banner | null;
  cutin: Cutin | null;
  speed: number;
  result: BattleResult | null;
  /** Auto battle: the AI picks on the player's behalf */
  auto: boolean;
}

let seq = 1;

export class BattleController {
  battle: Battle;
  scene: BattleScene;
  director: Director;
  setup: BattleSetup;
  state: HudState = { view: null, phase: 'intro', log: [], banner: null, cutin: null, speed: 1, result: null, auto: false };
  private listeners = new Set<() => void>();
  floatLayer: HTMLElement | null = null;
  stones: { basic: number; advanced: number; master: number };
  stonesUsed = { basic: 0, advanced: 0, master: 0 };
  onEnd: ((r: BattleResult) => void) | null = null;
  private ui: BattleUI;

  constructor(stage: Stage, setup: BattleSetup) {
    this.setup = setup;
    this.stones = { ...(setup.stones ?? { basic: 0, advanced: 0, master: 0 }) };
    this.battle = Battle.create({
      kind: setup.kind,
      seed: setup.seed ?? Math.floor(Math.random() * 1e9),
      sides: [setup.player, setup.enemy],
    });
    this.scene = new BattleScene(stage, setup.region);
    const ui: BattleUI = {
      view: (v) => this.set({ view: v }),
      float: (t, w, c) => this.float(t, w, c),
      banner: (text, sub, color, side) => {
        const b = { id: seq++, text, sub, color, side };
        this.set({ banner: b });
        setTimeout(() => {
          if (this.state.banner?.id === b.id) this.set({ banner: null });
        }, 1300 / this.state.speed);
      },
      log: (t) => this.set({ log: [...this.state.log.slice(-60), t] }),
      cutin: (side, spirit, skill, element, ssr = false) => {
        const c = { id: seq++, side, spirit, skill, element, ssr };
        this.set({ cutin: c });
        setTimeout(() => {
          if (this.state.cutin?.id === c.id) this.set({ cutin: null });
        }, 1500 / this.state.speed);
      },
    };
    this.ui = ui;
    this.director = new Director(this.scene, ui);
    this.director.names = [setup.player.name, setup.enemy.name];
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getState = () => this.state;

  private set(p: Partial<HudState>): void {
    const prev = this.state.phase;
    this.state = { ...this.state, ...p };
    for (const l of this.listeners) l();
    if (p.phase && p.phase !== prev) this.maybeAuto();
  }

  private disposed = false;

  setAuto(on: boolean): void {
    this.set({ auto: on });
    this.maybeAuto();
  }

  private maybeAuto(): void {
    if (!this.state.auto || this.disposed) return;
    const phase = this.state.phase;
    const b = this.battle;
    if (phase !== 'input' && phase !== 'replace') return;
    window.setTimeout(() => {
      if (!this.state.auto || this.disposed || this.state.phase !== phase) return;
      if (phase === 'input') void this.submit(chooseAction(b, 0, { skill: 0.9 }));
      else void this.chooseReplacement(chooseReplacement(b, 0));
    }, 450 / this.state.speed);
  }

  setSpeed(s: number): void {
    this.director.setSpeed(s);
    this.set({ speed: s });
  }

  private float(text: string, world: THREE.Vector3, cls: string): void {
    const layer = this.floatLayer;
    if (!layer) return;
    const p = this.scene.worldToScreen(world);
    const el = document.createElement('div');
    el.className = `float ${cls}`;
    el.textContent = text;
    el.style.left = `${p.x + (Math.random() - 0.5) * 30}px`;
    el.style.top = `${p.y}px`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  async start(): Promise<void> {
    const sc = this.scene;
    // Opening camera: sweeps in from high above
    const base = sc.rig.base;
    const startPos = base.pos.clone().add(new THREE.Vector3(10, 8, -6));
    sc.rig.setBase(base.pos.clone(), base.look.clone());
    sc.rig.pos.copy(startPos);
    sc.rig.look.set(0, 0.5, 0);
    void sc.rig.moveTo(base.pos.clone(), base.look.clone(), 1.6, ease.inOutQuad);
    await sc.tw.wait(0.5);
    await this.director.play(this.battle.start());
    if (this.setup.blessing) await this.playBlessing(this.setup.blessing);
    this.set({ phase: 'input', view: this.battle.view() });
  }

  /** Story blessing: a golden light pillar lands on our spirit */
  private async playBlessing(b: { name: string; text: string }): Promise<void> {
    const sc = this.scene;
    const home = sc.slots[0].home;
    const c = sc.slots[0].creature;
    sfx.charge(1.2);
    for (let i = 0; i < 3; i++) {
      sc.vfx.emit({ pos: home.clone().add(new THREE.Vector3(0, 6, 0)), count: 30, color: [0xffe080, 0xffffff], speed: [4, 8], dir: new THREE.Vector3(0, -1, 0), spread: 0.35, life: [0.4, 0.8], size: [0.15, 0.35], atlas: 1, intensity: 2 });
      await sc.tw.wait(0.25);
    }
    sc.stage.screenFlash(0xfff0b0, 0.8, 2.5);
    sfx.levelUp();
    void sc.vfx.pillar(home, 0xffd060, 1.5, 14, 1.4);
    void sc.vfx.ring(home.clone().setY(0.1), 0xffe080, 0.5, 6, 1);
    sc.vfx.emit({ pos: home.clone().setY(1), count: 90, color: [0xffd060, 0xffffff, 0xfff4b0], speed: [2, 6], life: [0.6, 1.3], size: [0.12, 0.3], atlas: 1, drag: 1.5 });
    if (c) {
      c.setFlash(0xfff0b0, 1);
      c.attackPose = 1;
      void sc.tw.to(0.9, (k) => (c.attackPose = 1 - k), ease.outQuad);
    }
    sc.rig.addTrauma(0.25);
    this.ui.banner(b.name, b.text, 0xffd060, 0);
    this.ui.log(`${b.name}：${b.text}`);
    await sc.tw.wait(1.3);
  }

  async submit(input: TurnInput): Promise<void> {
    if (this.state.phase !== 'input') return;
    if (input.main.type === 'capture') {
      const st = input.main.stone;
      if (this.stones[st] <= 0) return;
      this.stones[st]--;
      this.stonesUsed[st]++;
    }
    this.set({ phase: 'playing' });
    const ai = this.setup.foeScript?.(this.battle) ?? chooseAction(this.battle, 1, { skill: this.setup.aiSkill });
    const events = this.battle.resolveTurn([input, ai]);
    await this.director.play(events);
    await this.afterTurn();
  }

  private async afterTurn(): Promise<void> {
    const b = this.battle;
    if (b.s.winner !== null) return this.finish();
    if (b.needsReplacement(1) && !b.needsReplacement(0)) {
      await this.director.play(b.replace([null, chooseReplacement(b, 1)]));
    }
    if (b.needsReplacement(0)) {
      this.set({ phase: 'replace', view: b.view() });
      return;
    }
    if (b.s.winner !== null) return this.finish();
    this.set({ phase: 'input', view: b.view() });
  }

  async chooseReplacement(idx: number): Promise<void> {
    if (this.state.phase !== 'replace') return;
    this.set({ phase: 'playing' });
    const b = this.battle;
    const enemy = b.needsReplacement(1) ? chooseReplacement(b, 1) : null;
    await this.director.play(b.replace([idx, enemy]));
    await this.afterTurn();
  }

  private async finish(): Promise<void> {
    const b = this.battle;
    const defeated = b.side(1).team.filter((c) => c.fainted).map((c) => ({ speciesId: c.species.id, level: c.level }));
    const winner = b.s.winner ?? 'draw';
    const cap = b.s.captured ? b.active(1) : null;
    const result: BattleResult = {
      winner,
      captured: b.s.captured,
      turns: b.s.turn,
      defeated: b.s.captured ? defeated.concat(cap ? [{ speciesId: cap.species.id, level: cap.level }] : []) : defeated,
      capturedSpirit: cap ? { speciesId: cap.species.id, level: cap.level } : undefined,
      stonesUsed: this.stonesUsed,
    };
    // Victory camera
    const sc = this.scene;
    const side: SideId = winner === 1 ? 1 : 0;
    const c = sc.slots[side].creature;
    if (c && c.root.visible) {
      const center = sc.center(side);
      sc.rig.orbit = { center, radius: 4.5, height: 1, angle: side === 0 ? 1.2 : -1.2, speed: 0.35 };
      void sc.tw.to(0.6, (k) => (c.attackPose = Math.sin(k * Math.PI)), ease.linear);
    }
    await sc.tw.wait(0.6);
    this.set({ phase: 'end', result });
    this.onEnd?.(result);
  }

  dispose(): void {
    this.disposed = true;
    this.scene.dispose();
    this.listeners.clear();
  }
}
