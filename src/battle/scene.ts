// Battle scene: the two spirits, the arena, the camera, the effects, and the various actions (entrance, charge, hit reaction, knock-out).

import * as THREE from 'three';
import { buildArena, type Arena, type RegionId } from '../render/arena.ts';
import { CameraRig } from '../render/camera.ts';
import { buildCreature } from '../render/species.ts';
import type { Creature } from '../render/creature.ts';
import { Stage } from '../render/stage.ts';
import { blobShadowTex, glowTex } from '../render/textures.ts';
import { ease, Tweens } from '../render/tween.ts';
import { GsapClock } from '../render/gsapClock.ts';
import { Vfx } from '../render/vfx.ts';
import { FieldFx } from '../render/fieldfx.ts';
import { getSpirit } from '../data.ts';
import type { Element } from '../../sim/types.ts';
import type { CombatantView, SideId } from '../engine/types.ts';

export const ELEMENT_COLOR: Record<Element, number> = {
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
export const ELEMENT_BRIGHT: Record<Element, number> = {
  water: 0xbff3ff,
  fire: 0xffd27a,
  nature: 0xd8f59a,
  wind: 0xffffff,
  earth: 0xffe0a0,
  thunder: 0xfff6a8,
  light: 0xffffff,
  dark: 0xff6ab0,
  neutral: 0xffffff,
};

export interface Slot {
  creature: Creature | null;
  view: CombatantView | null;
  home: THREE.Vector3;
  shadow: THREE.Mesh;
  trapCard: THREE.Mesh | null;
  aura: THREE.Mesh | null;
}

export class BattleScene {
  stage: Stage;
  tw = new Tweens();
  /** Clock for GSAP timelines (for newly written cinematics; older ones use tw) */
  gs = new GsapClock();
  rig: CameraRig;
  vfx = new Vfx();
  arena: Arena;
  root = new THREE.Group();
  slots: [Slot, Slot];
  field: Element | null = null;
  /** Arena effects (sky, fog, lighting, ground, ambient objects, particles), see render/fieldfx.ts */
  fieldFx: FieldFx;
  private time = 0;
  private off: () => void;
  portrait = false;

  constructor(stage: Stage, region: RegionId) {
    this.stage = stage;
    stage.clearScene();
    this.arena = buildArena(region);
    stage.scene.add(this.root);
    this.root.add(this.arena.group, this.vfx.group);
    stage.scene.fog = this.arena.group.userData.fog as THREE.Fog;
    this.rig = new CameraRig(stage.camera, this.tw);
    this.fieldFx = new FieldFx({ arena: this.arena, vfx: this.vfx, stage, root: this.root, tw: this.tw, shake: (a) => this.rig.addTrauma(a) });
    const mkShadow = () => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.03;
      this.root.add(m);
      return m;
    };
    this.slots = [
      { creature: null, view: null, home: new THREE.Vector3(-3.1, 0, 1.3), shadow: mkShadow(), trapCard: null, aura: null },
      { creature: null, view: null, home: new THREE.Vector3(3.1, 0, -1.3), shadow: mkShadow(), trapCard: null, aura: null },
    ];
    this.layoutCamera();
    this.off = stage.add((dt, fxDt, realDt) => this.update(dt, fxDt, realDt));
    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => this.layoutCamera();

  layoutCamera(): void {
    const w = this.stage.container.clientWidth;
    const h = this.stage.container.clientHeight;
    this.portrait = h > w;
    // A portrait screen has a narrow horizontal field of view, so both sides stand closer to the middle
    this.slots[0].home.set(this.portrait ? -2 : -3.1, 0, this.portrait ? 2 : 1.3);
    this.slots[1].home.set(this.portrait ? 2 : 3.1, 0, this.portrait ? -1.6 : -1.3);
    // A landscape screen has skill cards at the bottom, so the camera looks slightly downward to put the spirits in the upper middle of the frame; more pronounced on a short screen (phone in landscape)
    const short = !this.portrait && h < 560;
    const pos = this.portrait ? new THREE.Vector3(-0.8, 6.9, 15.5) : short ? new THREE.Vector3(-3.4, 4.3, 13) : new THREE.Vector3(-3.4, 4.1, 12.8);
    const look = this.portrait ? new THREE.Vector3(0.2, 0.9, 0) : short ? new THREE.Vector3(0.4, -0.3, -0.2) : new THREE.Vector3(0.4, 0.35, -0.2);
    this.rig.setBase(pos, look);
    this.stage.resize();
    this.vfx.setScale(h, this.stage.camera.fov);
  }

  /** After zooming, particle size has to follow the camera's field of view */
  syncParticleScale(): void {
    this.vfx.setScale(this.stage.container.clientHeight || window.innerHeight, this.stage.camera.fov);
  }

  private cleanups = new Set<() => void>();
  /** Cleanup to run when the scene is disposed (e.g. when leaving the battle midway, restore the camera and post-processing of an ultimate cinematic) */
  addCleanup(fn: () => void): () => void {
    this.cleanups.add(fn);
    return () => this.cleanups.delete(fn);
  }

  disposed = false;
  dispose(): void {
    this.disposed = true;
    for (const fn of [...this.cleanups]) {
      try {
        fn();
      } catch (e) {
        console.error('battle cleanup error', e);
      }
    }
    this.cleanups.clear();
    this.off();
    window.removeEventListener('resize', this.onResize);
    // Arena effects change global state (LIGHT, exposure), which must be restored before the arena is disposed
    this.fieldFx.dispose();
    this.tw.clear();
    this.gs.kill();
    this.vfx.clear();
    for (const s of this.slots) s.creature?.dispose();
    this.arena.dispose();
    this.stage.resetCinematic();
    this.rig.roll = 0;
  }

  private update(dt: number, fxDt: number, realDt: number): void {
    this.time += fxDt;
    this.tw.update(dt, fxDt, realDt);
    this.gs.update(dt * this.tw.speed, fxDt * this.tw.speed);
    for (const s of this.slots) {
      const c = s.creature;
      if (!c) continue;
      c.update(dt);
      s.shadow.position.x = c.root.position.x;
      s.shadow.position.z = c.root.position.z;
      // The higher off the ground, the smaller and fainter the contact shadow: at one body height it shrinks to 60% and fades to 40%
      const lift = c.groundGap + Math.max(0, c.root.position.y) + Math.max(0, c.body.position.y) * c.scaler.scale.y * c.root.scale.y;
      const up = Math.min(1, lift / Math.max(0.5, c.worldHeight));
      const sc = c.width * 1.1 * c.root.scale.x * (1 - 0.4 * up);
      s.shadow.scale.set(sc, sc, 1);
      (s.shadow.material as THREE.MeshBasicMaterial).opacity = 1 - 0.6 * up;
      if (s.aura) {
        s.aura.position.copy(c.root.position);
        s.aura.rotation.z += fxDt;
      }
      if (s.trapCard) {
        s.trapCard.position.y = 0.06 + Math.sin(this.time * 2) * 0.03;
        (s.trapCard.material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(this.time * 3) * 0.2;
      }
    }
    this.arena.update(fxDt, this.time, this.vfx);
    this.vfx.camPos.copy(this.stage.camera.position);
    this.fieldFx.update(fxDt, this.time);
    // Effects follow battle speed: at 2x speed, particle lifetime and the timeline shrink together
    this.vfx.update(fxDt * this.tw.speed);
    this.rig.update(fxDt, realDt);
  }

  // ───────────────────────── Spirits ─────────────────────────

  center(side: SideId): THREE.Vector3 {
    const c = this.slots[side].creature;
    const base = c ? c.root.position.clone() : this.slots[side].home.clone();
    return base.add(new THREE.Vector3(0, (c?.worldHeight ?? 1.5) * 0.5, 0));
  }

  /** World position of the head (for close-up framing); with no head node, takes the point at 75% of body height */
  head(side: SideId): THREE.Vector3 {
    const c = this.slots[side].creature;
    if (!c) return this.slots[side].home.clone().setY(1.1);
    if (c.head.parent) {
      c.root.updateMatrixWorld(true);
      const p = c.head.getWorldPosition(new THREE.Vector3());
      const base = c.root.position;
      // When the head node is too far from the body (e.g. a floating part), fall back to an estimate
      if (p.y > base.y + c.worldHeight * 0.25 && p.y < base.y + c.worldHeight * 1.3) return p;
    }
    return c.root.position.clone().add(new THREE.Vector3(0, c.worldHeight * 0.75, 0));
  }

  /** World position of the eyes (for eye glints) */
  eyes(side: SideId): THREE.Vector3[] {
    const c = this.slots[side].creature;
    if (!c) return [];
    c.root.updateMatrixWorld(true);
    return c.eyes.filter((e) => e.parent).map((e) => e.getWorldPosition(new THREE.Vector3()));
  }

  top(side: SideId): THREE.Vector3 {
    const c = this.slots[side].creature;
    const base = c ? c.root.position.clone() : this.slots[side].home.clone();
    return base.add(new THREE.Vector3(0, (c?.worldHeight ?? 1.5) + 0.3, 0));
  }

  faceEachOther(): void {
    for (const side of [0, 1] as SideId[]) {
      const c = this.slots[side].creature;
      if (!c) continue;
      const o = this.slots[side === 0 ? 1 : 0].home;
      c.root.rotation.y = Math.atan2(o.x - c.root.position.x, o.z - c.root.position.z);
    }
  }

  setSpirit(side: SideId, v: CombatantView): Creature {
    const s = this.slots[side];
    if (s.creature) {
      this.root.remove(s.creature.root);
      s.creature.dispose();
    }
    const sp = getSpirit(v.speciesId);
    const c = buildCreature(v.speciesId, v.stage, sp.rarity, { corrupted: v.corrupted });
    c.root.position.copy(s.home);
    this.root.add(c.root);
    s.creature = c;
    s.view = v;
    this.faceEachOther();
    return c;
  }

  async entry(side: SideId, fast = false): Promise<void> {
    const s = this.slots[side];
    const c = s.creature;
    if (!c) return;
    const el = s.view ? getSpirit(s.view.speciesId).elements[0] : 'neutral';
    const col = ELEMENT_COLOR[el];
    c.root.visible = true;
    c.root.scale.setScalar(0.01);
    c.root.position.copy(s.home).add(new THREE.Vector3(0, 1.2, 0));
    void this.vfx.circle(s.home.clone().add(new THREE.Vector3(0, 0.05, 0)), col, 2.2, 1.1, undefined, side);
    void this.vfx.pillar(s.home, col, 0.9, 10, 0.7);
    this.vfx.emit({ pos: s.home.clone().add(new THREE.Vector3(0, 0.3, 0)), count: 40, color: [col, ELEMENT_BRIGHT[el]], speed: [1, 4], dir: new THREE.Vector3(0, 1, 0), spread: 0.8, life: [0.5, 1.1], size: [0.12, 0.3] });
    await this.tw.wait(fast ? 0.1 : 0.25);
    await this.tw.to(fast ? 0.2 : 0.32, (k) => {
      c.root.scale.setScalar(Math.max(0.01, k));
      c.root.position.y = s.home.y + 1.2 * (1 - k);
    }, ease.outBack);
    void this.vfx.ring(s.home.clone().add(new THREE.Vector3(0, 0.05, 0)), ELEMENT_BRIGHT[el], 0.4, 3.2, 0.5);
    this.vfx.emit({ pos: s.home.clone().add(new THREE.Vector3(0, 0.1, 0)), count: 18, color: 0xffffff, speed: [1.5, 3], dir: new THREE.Vector3(0, 0.3, 0), spread: 1, life: [0.4, 0.8], size: [0.25, 0.5], intensity: 0.7, gravity: 1 });
    this.rig.addTrauma(0.18);
    await this.squash(side, 0.2);
  }

  async squash(side: SideId, amt: number, dur = 0.25): Promise<void> {
    const c = this.slots[side].creature;
    if (!c) return;
    await this.tw.to(dur, (k) => {
      const w = Math.sin(k * Math.PI) * amt * (1 - k * 0.5);
      c.pose.scale.set(1 + w * 0.6, 1 - w, 1 + w * 0.6);
    }, ease.linear);
    c.pose.scale.set(1, 1, 1);
  }

  async recall(side: SideId): Promise<void> {
    const s = this.slots[side];
    const c = s.creature;
    if (!c) return;
    const col = s.view ? ELEMENT_COLOR[getSpirit(s.view.speciesId).elements[0]] : 0xffffff;
    c.setFlash(0xffffff, 1);
    this.vfx.emit({ pos: this.center(side), count: 30, color: [col, 0xffffff], speed: [0.5, 2], dir: new THREE.Vector3(0, 1, 0), spread: 0.6, life: [0.4, 0.9], size: [0.15, 0.3] });
    await this.tw.to(0.25, (k) => c.root.scale.setScalar(Math.max(0.01, 1 - k)), ease.inCubic);
    c.root.visible = false;
  }

  async faint(side: SideId): Promise<void> {
    const s = this.slots[side];
    const c = s.creature;
    if (!c) return;
    const col = s.view ? ELEMENT_COLOR[getSpirit(s.view.speciesId).elements[0]] : 0xffffff;
    c.setFlash(0xffffff, 1);
    await this.tw.to(0.35, (k) => {
      c.pose.rotation.z = (side === 0 ? -1 : 1) * k * 0.4;
      c.pose.position.y = -k * 0.1;
    }, ease.outQuad);
    for (let i = 0; i < 4; i++) {
      this.vfx.emit({ pos: this.center(side), count: 20, color: [col, 0xffffff], speed: [0.4, 1.8], dir: new THREE.Vector3(0, 1, 0), spread: 0.7, life: [0.8, 1.6], size: [0.1, 0.3], radius: 0.5 });
    }
    await this.tw.to(0.55, (k) => {
      c.setOpacity(1 - k);
      c.root.scale.setScalar(1 - k * 0.3);
    }, ease.inQuad);
    c.root.visible = false;
    c.setOpacity(1);
    c.pose.rotation.z = 0;
    c.pose.position.y = 0;
  }

  /** Charge at the opponent; on return, stops in front of the opponent */
  async lunge(side: SideId, dur = 0.16): Promise<void> {
    const c = this.slots[side].creature;
    const t = this.slots[side === 0 ? 1 : 0];
    if (!c) return;
    const from = c.root.position.clone();
    const dir = t.home.clone().sub(from).setY(0).normalize();
    const reach = (t.creature?.width ?? 1) * 0.5 + c.width * 0.5 + 0.35;
    const to = t.home.clone().addScaledVector(dir, -reach);
    c.moving = 1;
    c.attackPose = 0.6;
    await this.tw.to(dur, (k) => {
      c.root.position.lerpVectors(from, to, k);
      c.root.position.y = Math.sin(k * Math.PI) * 0.35;
    }, ease.inQuad);
    c.moving = 0;
    c.attackPose = 1;
    this.tw.to(0.12, (k) => (c.pose.rotation.x = Math.sin(k * Math.PI) * 0.35), ease.linear);
  }

  async goHome(side: SideId, dur = 0.3): Promise<void> {
    const s = this.slots[side];
    const c = s.creature;
    if (!c) return;
    const from = c.root.position.clone();
    c.attackPose = 0;
    if (from.distanceTo(s.home) < 0.05) return;
    await this.tw.to(dur, (k) => {
      c.root.position.lerpVectors(from, s.home, k);
      c.root.position.y = Math.sin(k * Math.PI) * 0.4;
    }, ease.outQuad);
    c.root.position.copy(s.home);
    this.faceEachOther();
  }

  /** Attack pose (casting in place, wind-up) */
  async windup(side: SideId, dur = 0.22): Promise<void> {
    const c = this.slots[side].creature;
    if (!c) return;
    await this.tw.to(dur, (k) => {
      c.attackPose = k;
      c.pose.rotation.x = -k * 0.15;
    }, ease.outQuad);
  }

  release(side: SideId): void {
    const c = this.slots[side].creature;
    if (!c) return;
    this.tw.to(0.25, (k) => {
      c.attackPose = 1 - k;
      c.pose.rotation.x = -0.15 * (1 - k) + Math.sin(k * Math.PI) * 0.25;
    }, ease.outQuad);
  }

  /** Hit reaction: white flash, knockback, deformation, tremble */
  /** pinned: no knockback (when an ultimate pins the opponent), only the white flash, tremble and squash remain */
  hitReact(side: SideId, strength: number, fromSide: SideId, pinned = false): void {
    const s = this.slots[side];
    const c = s.creature;
    if (!c) return;
    c.setFlash(0xffffff, 1);
    const from = this.slots[fromSide].creature?.root.position ?? this.slots[fromSide].home;
    const dir = c.root.position.clone().sub(from).setY(0).normalize();
    const base = s.home.clone();
    const knock = pinned ? 0 : 0.15 + strength * 0.45;
    // Tremble during hit-stop (fx clock)
    this.tw.to(0.14, (k) => {
      c.pose.position.x = Math.sin(k * 80) * 0.05 * (1 - k) * (1 + strength);
    }, ease.linear, 'fx');
    void this.tw.to(0.35, (k) => {
      const push = k < 0.25 ? ease.outQuad(k / 0.25) : 1 - ease.inOutQuad((k - 0.25) / 0.75);
      // Do not touch the position while pinned: the ultimate may already have placed the opponent elsewhere
      if (!pinned) c.root.position.copy(base).addScaledVector(dir, knock * push);
      const w = Math.sin(Math.min(1, k * 2) * Math.PI) * (0.1 + strength * 0.15);
      c.pose.scale.set(1 + w, 1 - w, 1 + w);
      c.pose.rotation.x = -push * 0.25 * (1 + strength);
    }, ease.linear).then(() => {
      c.pose.scale.set(1, 1, 1);
      c.pose.rotation.x = 0;
      c.pose.position.x = 0;
    });
  }

  // ───────────────────────── Trap cards ─────────────────────────

  setTrapCard(side: SideId, on: boolean): void {
    const s = this.slots[side];
    if (on && !s.trapCard) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), new THREE.MeshBasicMaterial({ map: cardBackTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      m.rotation.x = -Math.PI / 2;
      const off = side === 0 ? new THREE.Vector3(1.3, 0.06, 1.2) : new THREE.Vector3(-1.3, 0.06, -1.2);
      m.position.copy(s.home).add(off);
      m.rotation.z = side === 0 ? 0.6 : -2.5;
      this.root.add(m);
      s.trapCard = m;
      this.vfx.emit({ pos: m.position.clone(), count: 16, color: 0xb08aff, speed: [0.5, 1.5], dir: new THREE.Vector3(0, 1, 0), spread: 0.8, life: [0.4, 0.8], size: [0.1, 0.2] });
    }
    if (!on && s.trapCard) {
      this.root.remove(s.trapCard);
      s.trapCard = null;
    }
  }

  /** Trap flips open: the card stands up, scales up and burns */
  async flipTrap(side: SideId, name: string, color: number): Promise<void> {
    const s = this.slots[side];
    const pos = s.trapCard?.position.clone() ?? s.home.clone().add(new THREE.Vector3(0, 0.1, 0));
    this.setTrapCard(side, false);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.7), new THREE.MeshBasicMaterial({ map: cardFrontTex(name, color), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.position.copy(pos);
    this.root.add(m);
    const cam = this.stage.camera.position;
    await this.tw.to(0.35, (k) => {
      m.position.y = pos.y + k * 1.6;
      m.lookAt(cam);
      m.rotateY(Math.PI * (1 - k));
      m.scale.setScalar(0.6 + k * 0.8);
    }, ease.outBack, 'fx');
    void this.vfx.flash(m.position.clone(), color, 4, 0.4);
    void this.vfx.ring(m.position.clone(), color, 0.3, 2.5, 0.5, cam.clone().sub(m.position));
    this.vfx.emit({ pos: m.position.clone(), count: 40, color: [color, 0xffffff], speed: [2, 5], life: [0.3, 0.7], size: [0.1, 0.25], atlas: 1 });
    await this.tw.wait(0.35, 'fx');
    await this.tw.to(0.25, (k) => {
      (m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      m.scale.setScalar(1.4 + k * 0.4);
    }, ease.inQuad, 'fx');
    this.root.remove(m);
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  }

  // ───────────────────────── Arena ─────────────────────────

  /** Expand/switch/exit the arena: the whole battlefield (sky, fog, lighting, ground, surroundings, particles) is rewritten; the returned Promise resolves when the expansion cinematic ends */
  setField(el: Element | null): Promise<void> {
    this.field = el;
    return this.fieldFx.set(el);
  }

  worldToScreen(p: THREE.Vector3): { x: number; y: number } {
    return this.stage.project(p);
  }
}

// ───────────────────────── Card textures ─────────────────────────

let backTex: THREE.Texture | null = null;
function cardBackTex(): THREE.Texture {
  if (backTex) return backTex;
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 368;
  const g = cv.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 368);
  grd.addColorStop(0, '#3a2470');
  grd.addColorStop(1, '#1a1040');
  g.fillStyle = grd;
  roundRect(g, 4, 4, 248, 360, 18);
  g.fill();
  g.strokeStyle = '#e8c870';
  g.lineWidth = 6;
  roundRect(g, 10, 10, 236, 348, 14);
  g.stroke();
  g.strokeStyle = '#b08aff';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(128, 184, 70, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const x = 128 + Math.cos(a) * 70;
    const y = 184 + Math.sin(a) * 70;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.fillStyle = '#e8c870';
  g.font = 'bold 36px "Noto Serif TC", serif';
  g.textAlign = 'center';
  g.fillText('伏', 128, 196);
  backTex = new THREE.CanvasTexture(cv);
  backTex.colorSpace = THREE.SRGBColorSpace;
  return backTex;
}

function cardFrontTex(name: string, color: number): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 368;
  const g = cv.getContext('2d')!;
  const c = new THREE.Color(color);
  const css = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
  const grd = g.createLinearGradient(0, 0, 0, 368);
  grd.addColorStop(0, '#fff6e0');
  grd.addColorStop(1, css);
  g.fillStyle = grd;
  roundRect(g, 4, 4, 248, 360, 18);
  g.fill();
  g.strokeStyle = '#8a5a1a';
  g.lineWidth = 8;
  roundRect(g, 10, 10, 236, 348, 14);
  g.stroke();
  g.fillStyle = '#2a1a3a';
  g.font = '900 34px "Noto Sans TC", sans-serif';
  g.textAlign = 'center';
  g.fillText('伏技發動', 128, 70);
  g.font = '900 40px "Noto Serif TC", serif';
  const chars = [...name];
  if (chars.length > 4) {
    g.fillText(chars.slice(0, 3).join(''), 128, 190);
    g.fillText(chars.slice(3).join(''), 128, 240);
  } else g.fillText(name, 128, 210);
  const glow = g.createRadialGradient(128, 300, 0, 128, 300, 60);
  glow.addColorStop(0, 'rgba(255,255,255,0.9)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(60, 240, 136, 120);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export { glowTex };
