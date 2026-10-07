// 3D scenes for the menus: title, hub city, display stand (party / codex / breakthrough). The world map is in worldmap/, the Star Gate summon in summon/.

import * as THREE from 'three';
import { buildArena, type Arena, type RegionId } from './arena.ts';
import type { Creature } from './creature.ts';
import { Stage } from './stage.ts';
import { runeCircleTex } from './textures.ts';
import { SILHOUETTE_3D, silhouetteCreature } from './thumbs.ts';
import { LIGHT } from './toon.ts';
import { sceneMaterial } from './spiritToon.ts';
import { inkScenery } from './ink.ts';
import { ease } from './tween.ts';
import { getSpirit } from '../data.ts';
import type { Element } from '../../sim/types.ts';
import { sfx, synth } from '../audio/sfx.ts';

import { MenuScene } from './menuScene.ts';

export { MenuScene };
export { MapScene, type MapIsland } from './worldmap/index.ts';

const EL_COLOR: Record<Element, number> = {
  water: 0x3db7ff,
  fire: 0xff6a2b,
  nature: 0x5fcb5a,
  wind: 0x9fe8e0,
  earth: 0xc49a5a,
  thunder: 0xc8a0ff,
  light: 0xffe680,
  dark: 0x9a5aff,
  neutral: 0xdde4ff,
};

function pedestal(color: number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(1.5, 1.7, 0.5, 32);
  const m = new THREE.Mesh(geo, sceneMaterial(0xe8e0f8, { rim: 0.4 }));
  m.position.y = 0.25;
  g.add(m);
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(1.45, 48),
    new THREE.MeshBasicMaterial({ map: runeCircleTex(2), color: new THREE.Color(color).multiplyScalar(1.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.51;
  top.name = 'rune';
  g.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.04, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), toneMapped: false }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.36;
  ring.name = 'ring';
  g.add(ring);
  // The pedestal uses the post-process outline; runes and halos are self-lit materials, which inkScenery skips automatically
  inkScenery(g);
  return g;
}

/** Neutral color of the pedestal when showing a silhouette (keeps the pedestal's default purple) */
const NEUTRAL_PEDESTAL = 0xb08aff;

function setPedestalColor(p: THREE.Group, color: number): void {
  const rune = p.getObjectByName('rune') as THREE.Mesh | undefined;
  const ring = p.getObjectByName('ring') as THREE.Mesh | undefined;
  if (rune) (rune.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(1.8);
  if (ring) (ring.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(2.2);
}

// ───────────────────────── Title ─────────────────────────

/**
 * Title: the logo and buttons are in the center of the screen, spirits stand on the left and right sides, and the Star Gate in the background stays behind the logo.
 * The camera no longer orbits all the way around (that would swing a spirit behind the buttons); it only pans slightly left and right and bobs up and down.
 * Positions are converted from screen coordinates: each spirit's side toward the center always stays outside the UI column (the width keepClear gives),
 * and they are recomputed when the viewport aspect changes.
 */
export class TitleScene extends MenuScene {
  arena: Arena;
  /** Camera baseline: a low angle looking at the Star Gate, with every ground-standing spirit's feet in frame */
  private static CAM = new THREE.Vector3(0, 2.6, 12);
  private static LOOK = new THREE.Vector3(0, 2.4, -6);
  /** Amplitude of the left-right pan (world units), about 0.03 in screen displacement */
  private static SWAY = 0.6;
  /**
   * Spirit placement: side is left/right, z is depth (smaller is farther), lift is the height flying in the air (world units), out is the fraction of the screen to push the inner edge farther outward.
   * The two in the front row guard both sides of the buttons; the two with wings fly up and behind, their faces above the front row's heads; the sea spirit floats farthest at the upper right (the upper left corner holds the "Watch Prologue" button)
   */
  private spots: { c: Creature; side: -1 | 1; z: number; out: number }[] = [];
  /** Half-width of the UI column (screen coordinates, 0 to 1); spirits may not enter it */
  private clear = 0.5;
  private aspect = 0;
  constructor(stage: Stage) {
    super(stage);
    this.arena = buildArena('arena');
    this.root.add(this.arena.group);
    stage.scene.fog = this.arena.group.userData.fog;
    const specs: [string, -1 | 1, number, number, number][] = [
      ['ignisar', -1, 0.5, 0, 0.02],
      ['noxfang', 1, 0.5, 0, 0.02],
      ['luminael', -1, -5, 2.8, 0.05],
      ['aeroth', 1, -5, 2.8, 0.05],
      ['thalassene', 1, -13, 6, 0.1],
    ];
    for (const [id, side, z, lift, out] of specs) {
      const c = this.addCreature(id, 3, new THREE.Vector3(0, 0, z));
      // Raise the body rather than the whole spirit: the shadow stays on the ground
      c.hover += lift / c.scaler.scale.y;
      // The hovering pegasus: wings spread and flapping, forelegs tucked forward (the new model's motion weights; the eagle already flaps its wings, so leave it)
      if (lift > 0 && 'spread' in c.act) {
        c.act.spread = 1;
        if ('beat' in c.act) c.act.beat = 1;
        if ('rear' in c.act) c.act.rear = 0.3;
      }
      this.spots.push({ c, side, z, out });
    }
    this.rig.setBase(TitleScene.CAM, TitleScene.LOOK);
    this.place();
  }

  /** The UI reports the half-width of the center column (logo and buttons) as a screen fraction from 0 to 1 */
  keepClear(halfWidth: number): void {
    this.clear = Math.min(0.7, Math.max(0.2, halfWidth));
    this.place();
  }

  /** Place each spirit on the two sides for the current aspect ratio: the inner edge is beyond clear + out, facing the camera and turned slightly toward the center */
  private place(): void {
    const cam = this.stage.camera;
    this.aspect = cam.aspect;
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect;
    // The screen displacement caused by the pan, plus a small margin
    const swayNdc = 0.05;
    for (const s of this.spots) {
      const depth = TitleScene.CAM.z - s.z;
      const half = (s.c.width * 0.5) / (depth * tanH);
      const ndc = s.side * (this.clear + s.out + swayNdc + half);
      s.c.root.position.set(ndc * depth * tanH, 0, s.z);
      s.c.root.rotation.y = -s.side * 0.45;
    }
  }

  protected tick(dt: number, fxDt: number): void {
    this.arena.update(fxDt, this.time, this.vfx);
    if (this.stage.camera.aspect !== this.aspect) this.place();
    this.rig.pos.set(TitleScene.CAM.x + Math.sin(this.time * 0.11) * TitleScene.SWAY, TitleScene.CAM.y + Math.sin(this.time * 0.17) * 0.15, TitleScene.CAM.z);
    this.rig.look.copy(TitleScene.LOOK);
    if (Math.random() < dt * 2) {
      const c = this.creatures[Math.floor(Math.random() * this.creatures.length)];
      c.attackPose = 1;
      void this.tw.to(0.8, (k) => (c.attackPose = 1 - k), ease.outQuad);
    }
  }
  dispose(): void {
    super.dispose();
    this.arena.dispose();
  }
}

// ───────────────────────── Hub city ─────────────────────────

export class HubScene extends MenuScene {
  arena: Arena;
  /** Amplitude of the camera's left-right sway */
  private sway = 1.2;
  constructor(stage: Stage, party: { speciesId: string; stage: 1 | 2 | 3 }[]) {
    super(stage);
    this.arena = buildArena('hub');
    this.root.add(this.arena.group);
    stage.scene.fog = this.arena.group.userData.fog;
    const spots = [new THREE.Vector3(0, 0, 1.5), new THREE.Vector3(-3.2, 0, 0), new THREE.Vector3(3.2, 0, 0)];
    party.slice(0, 3).forEach((p, i) => this.addCreature(p.speciesId, p.stage, spots[i], i === 0 ? 0.3 : i === 1 ? 0.6 : -0.4));
    this.rig.setBase(new THREE.Vector3(-1.5, 3.4, 11.5), new THREE.Vector3(0.8, 2.6, -4));
  }
  /**
   * The hub city menu takes the right half: the party moves to the empty space at the lower left (starters in front), and the sway is halved,
   * so on a phone in landscape and on wide screens the spirits' faces are never covered by the menu
   */
  besideMenu(): void {
    const spots: [number, number, number][] = [[-2.2, 2.2, 0.45], [-4.9, 0.4, 0.6], [-1, -1.8, 0.25]];
    this.creatures.forEach((c, i) => {
      const [x, z, ry] = spots[i];
      c.root.position.set(x, 0, z);
      c.root.rotation.y = ry;
    });
    this.sway = 0.6;
  }
  protected tick(dt: number, fxDt: number): void {
    this.arena.update(fxDt, this.time, this.vfx);
    this.rig.pos.x = -1.5 + Math.sin(this.time * 0.15) * this.sway;
    if (Math.random() < dt * 0.6 && this.creatures.length) {
      const c = this.creatures[Math.floor(Math.random() * this.creatures.length)];
      const y0 = c.root.position.y;
      void this.tw.to(0.5, (k) => (c.root.position.y = y0 + Math.sin(k * Math.PI) * 0.5), ease.linear);
    }
  }
  dispose(): void {
    super.dispose();
    this.arena.dispose();
  }
}

// ───────────────────────── Ending ─────────────────────────

/** Ending: the partner who fought stands in the front row, the other contracted spirits form a semicircle, and fireworks go off in the night sky */
export class EndingScene extends MenuScene {
  arena: Arena;
  private fw = 1.2;
  constructor(stage: Stage, party: { speciesId: string; stage: 1 | 2 | 3 }[], others: { speciesId: string; stage: 1 | 2 | 3 }[]) {
    super(stage);
    this.arena = buildArena('hub');
    this.root.add(this.arena.group);
    stage.scene.fog = this.arena.group.userData.fog;
    const front = [new THREE.Vector3(0, 0, 2), new THREE.Vector3(-3, 0, 1.2), new THREE.Vector3(3, 0, 1.2)];
    party.slice(0, 3).forEach((p, i) => this.addCreature(p.speciesId, p.stage, front[i], [0, 0.5, -0.5][i]));
    const back = others.slice(0, 9);
    back.forEach((p, i) => {
      const a = Math.PI * (0.18 + (0.64 * i) / Math.max(1, back.length - 1));
      const pos = new THREE.Vector3(Math.cos(a) * 7.5, 0, 0.5 - Math.sin(a) * 5.5);
      this.addCreature(p.speciesId, p.stage, pos, Math.atan2(-pos.x, 6 - pos.z) * 0.8);
    });
    this.rig.setBase(new THREE.Vector3(0, 3.2, 13.5), new THREE.Vector3(0, 3.3, -2));
  }
  protected tick(dt: number, fxDt: number): void {
    this.arena.update(fxDt, this.time, this.vfx);
    this.rig.pos.x = Math.sin(this.time * 0.18) * 3;
    if (Math.random() < dt * 1.2 && this.creatures.length) {
      const c = this.creatures[Math.floor(Math.random() * this.creatures.length)];
      const y0 = c.root.position.y;
      void this.tw.to(0.5, (k) => (c.root.position.y = y0 + Math.sin(k * Math.PI) * 0.6), ease.linear);
    }
    this.fw -= fxDt;
    if (this.fw <= 0) {
      this.fw = 0.45 + Math.random() * 0.8;
      const cols = Object.values(EL_COLOR);
      const col = cols[Math.floor(Math.random() * cols.length)];
      const at = new THREE.Vector3((Math.random() - 0.5) * 22, 5.5 + Math.random() * 3.5, -13 + Math.random() * 4);
      this.vfx.emit({ pos: at, count: 80, color: [col, 0xffffff], speed: [4, 7], life: [1, 1.7], size: [0.14, 0.3], gravity: 2.5, drag: 1.4, atlas: 1, intensity: 2.6 });
      void this.vfx.ring(at, col, 0.2, 3.5, 0.5, new THREE.Vector3(0, 0, 1));
      synth.tone({ type: 'sine', f0: 110, f1: 40, dur: 0.35, gain: 0.12 });
    }
  }
  dispose(): void {
    super.dispose();
    this.arena.dispose();
  }
}

// ───────────────────────── Display stand ─────────────────────────

export class ShowcaseScene extends MenuScene {
  arena: Arena;
  pedestals: THREE.Group[] = [];
  slots: (Creature | null)[] = [];
  spin = -0.6;
  /** The spirit shown as a silhouette (one not yet met in the codex) */
  private dark = new Set<Creature>();
  private drag: { x: number; v: number } | null = null;
  private dragV = 0;
  private autoSpin = true;
  private onDown = (e: PointerEvent) => {
    this.drag = { x: e.clientX, v: 0 };
    this.autoSpin = false;
  };
  private onMove = (e: PointerEvent) => {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x;
    this.drag.x = e.clientX;
    this.spin += dx * 0.012;
    this.dragV = dx * 0.012;
  };
  private onUp = () => {
    this.drag = null;
  };

  constructor(stage: Stage, count = 1, region: RegionId = 'hub') {
    super(stage);
    this.arena = buildArena(region);
    this.root.add(this.arena.group);
    stage.scene.fog = this.arena.group.userData.fog;
    for (let i = 0; i < count; i++) {
      const p = pedestal(NEUTRAL_PEDESTAL);
      p.position.set((i - (count - 1) / 2) * 4.2, 0, 0);
      this.root.add(p);
      this.pedestals.push(p);
      this.slots.push(null);
    }
    this.frame();
    const el = stage.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
  }

  /** offsetX: shift the protagonist to the right; lift: move toward the top of the screen (used when a portrait screen has a panel below); tilt: the camera looks down and the protagonist moves up; zoom: zoom-in factor */
  frame(offsetX = 0, lift = 0, tilt = 0, zoom = 1): void {
    const n = this.pedestals.length;
    const portrait = this.stage.container.clientHeight > this.stage.container.clientWidth;
    const dist = (n > 1 ? (portrait ? 20 : 12.5) : portrait ? 10 : 7.2) / zoom;
    this.rig.setBase(new THREE.Vector3(offsetX, 2.8 - lift, dist), new THREE.Vector3(offsetX, 1.6 - lift - tilt, 0));
  }

  /** Place the protagonist at the given horizontal pixel position on screen (used when there are panels on both sides); zoom below 1 pulls back, so even a narrow gap fits the whole spirit */
  frameAt(centerPx: number, lift = 0, zoom = 1): void {
    const w = this.stage.container.clientWidth;
    const h = Math.max(1, this.stage.container.clientHeight);
    const dist = (h > w ? 10 : 7.2) / zoom;
    const halfW = dist * Math.tan(THREE.MathUtils.degToRad(this.stage.camera.fov / 2)) * (w / h);
    this.frame(((w / 2 - centerPx) / (w / 2)) * halfW, lift, 0, zoom);
  }

  /**
   * silhouette: a spirit not yet met shows only a clean black silhouette (the same applyFlash as the portrait and summon silhouettes),
   * and the pedestal and the entrance motes use a neutral purple, so the element is not revealed
   */
  show(i: number, speciesId: string, stage: 1 | 2 | 3, flash = true, corrupted = false, silhouette = false): Creature {
    const old = this.slots[i];
    if (old) this.removeCreature(old);
    const p = this.pedestals[i];
    const c = this.addCreature(speciesId, stage, p.position.clone().setY(0.5), 0, corrupted);
    this.slots[i] = c;
    const col = silhouette ? NEUTRAL_PEDESTAL : EL_COLOR[getSpirit(speciesId).elements[0]];
    setPedestalColor(p, col);
    if (silhouette) {
      this.dark.add(c);
      silhouetteCreature(c, SILHOUETTE_3D);
    }
    if (flash) {
      c.root.scale.setScalar(0.01);
      void this.tw.to(0.35, (k) => c.root.scale.setScalar(Math.max(0.01, k)), ease.outBack);
      this.vfx.emit({ pos: p.position.clone().setY(1), count: 30, color: [col, 0xffffff], speed: [1, 3], life: [0.4, 0.8], size: [0.1, 0.25], atlas: 1 });
      void this.vfx.ring(p.position.clone().setY(0.55), col, 0.5, 2.5, 0.5);
    }
    return c;
  }

  protected removeCreature(c: Creature): void {
    this.dark.delete(c);
    super.removeCreature(c);
  }

  /** The silhouette is reapplied every frame after the spirit's own update (white flash decay), so no color shows through at a low frame rate */
  private keepDark(): void {
    for (const c of this.dark) {
      c.setFlash(SILHOUETTE_3D, 1);
      c.applyFlash();
    }
  }

  /** Show or hide the display stand and spirit (hidden when a panel fills the screen, the background stays) */
  setShowcaseVisible(v: boolean): void {
    for (const p of this.pedestals) p.visible = v;
    for (const c of this.slots) if (c) c.root.visible = v;
  }

  /** The spirit hops happily (tap interaction) */
  cheer(i = 0): void {
    const c = this.slots[i];
    if (!c) return;
    const y0 = 0.5;
    void this.tw.to(0.5, (k) => (c.root.position.y = y0 + Math.sin(k * Math.PI) * 0.7), ease.linear);
    this.vfx.emit({ pos: c.root.position.clone().add(new THREE.Vector3(0, c.worldHeight + 0.2, 0)), count: 10, color: [0xff8ab0, 0xffd0e0], speed: [0.8, 1.6], dir: new THREE.Vector3(0, 1, 0), spread: 0.6, life: [0.6, 1], size: [0.18, 0.28], atlas: 1 });
  }

  async breakthrough(i: number, speciesId: string, toStage: 1 | 2 | 3): Promise<void> {
    const c = this.slots[i];
    if (!c) return;
    const p = this.pedestals[i];
    const el = getSpirit(speciesId).elements[0];
    const col = EL_COLOR[el];
    const center = p.position.clone().setY(0.5 + c.worldHeight / 2);
    void this.rig.moveTo(new THREE.Vector3(p.position.x, 2, 5), center, 1.2, ease.inOutQuad);
    this.stage.setLetterbox(1);
    synth.duck(-12, 3000);
    sfx.charge(2.4);
    // White light pulse
    for (let beat = 0; beat < 8; beat++) {
      const period = 0.42 - beat * 0.035;
      c.setFlash(0xffffff, 0.4 + beat * 0.08);
      synth.tone({ type: 'sine', f0: 60, f1: 40, dur: 0.18, gain: 0.5 });
      this.vfx.emit({ pos: center, count: 20 + beat * 6, color: [col, 0xffffff], speed: [2.5, 3.5], inward: true, life: [0.3, 0.45], size: [0.1, 0.25], drag: 0 });
      await this.tw.to(period, (k) => c.pose.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.08), ease.linear);
    }
    c.flash = 1;
    this.stage.screenFlash(0xffffff, 1, 1.2);
    sfx.impactBig();
    await this.tw.wait(0.25);
    this.removeCreature(c);
    const n = this.addCreature(speciesId, toStage, p.position.clone().setY(0.5));
    this.slots[i] = n;
    n.setFlash(0xffffff, 1);
    this.stage.slowMo(0.35, 500);
    void this.vfx.ring(p.position.clone().setY(0.6), col, 0.5, 7, 1);
    void this.vfx.pillar(p.position, col, 1.4, 14, 1.2);
    this.vfx.emit({ pos: center, count: 160, color: [col, 0xffffff, 0xfff4b0], speed: [3, 9], life: [0.6, 1.4], size: [0.12, 0.3], atlas: 1, drag: 2 });
    sfx.fanfare(true);
    n.attackPose = 1;
    void this.tw.to(1.2, (k) => (n.attackPose = 1 - k), ease.outQuad);
    this.rig.addTrauma(0.4);
    await this.tw.wait(1.2);
    this.stage.setLetterbox(0);
    await this.rig.reset(0.8);
  }

  protected tick(dt: number, fxDt: number): void {
    this.arena.update(fxDt, this.time, this.vfx);
    if (!this.drag) {
      this.dragV *= Math.exp(-dt * 3);
      this.spin += this.dragV;
      if (this.autoSpin) this.spin += dt * 0.25;
    }
    for (const c of this.slots) if (c) c.root.rotation.y = this.pedestals.length > 1 ? -0.4 : this.spin;
    this.keepDark();
    for (const p of this.pedestals) {
      const rune = p.getObjectByName('rune');
      if (rune) rune.rotation.z += fxDt * 0.3;
    }
  }

  dispose(): void {
    super.dispose();
    this.arena.dispose();
    const el = this.stage.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
  }
}
