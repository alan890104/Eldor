// 3D cinematic for the Star Gate summon:
//   Opening: starlight stones shatter into motes that flow into the Star Gate (0.6 s) → eight runes light up in turn, the pitch climbing → a meteor streaks across the sky (color = the highest rarity of this pull, purple turning gold is allowed) → the Star Gate opens
//   Reveal: the gate fires an orb that lands on the display stand, silhouette → bursts open to reveal; R is clean and quick, SR has a light pillar and screen shake, SSR is a full scene
//   SSR: the sacred spirit descends from the Star Gate and lands; its element field floods the sky and ground in an instant; low-angle close-up, silhouette bursts, roar, hit-stop, screen shake, phone vibration, and finally the name card settles in
// Honesty principle: the meteor color is never higher than the actual result (the purple → gold upgrade is the only exception, and only happens when there really is an SSR).
// It can be skipped at any time: abort() invalidates the flow in progress and restores the stage.

import * as THREE from 'three';
import { MenuScene } from '../scenes.ts';
import type { Stage } from '../stage.ts';
import type { Creature } from '../creature.ts';
import { runeCircleTex } from '../textures.ts';
import { crackTex } from '../fxtex.ts';
import { LIGHT } from '../toon.ts';
import { inkScenery } from '../ink.ts';
import { sceneMaterial } from '../spiritToon.ts';
import { additive } from '../vfx.ts';
import { ease } from '../tween.ts';
import { getSpirit } from '../../data.ts';
import type { Element } from '../../../sim/types.ts';
import { summonSfx } from '../../audio/summonSfx.ts';
import { summonMusic } from '../../audio/summonMusic.ts';
import { synth } from '../../audio/sfx.ts';
import { buildGate, crystal, dimRune, lightRune, meteor, skyMaterial, slowRing, RARITY_COLOR, RARITY_HI, type Gate } from './gate.ts';
import { ELEMENT_COLOR, ELEMENT_DEEP, ELEMENT_HI, startFlood, type Flood } from './flood.ts';
import { signatureFor, type Signature } from './signature.ts';

export type SummonRarity = 'R' | 'SR' | 'SSR';
export type RevealBeat = 'silhouette' | 'burst' | 'banner' | 'settled';

const UP = new THREE.Vector3(0, 1, 0);
const GATE_POS = new THREE.Vector3(0, 6.0, -6);
const PED_POS = new THREE.Vector3(0, 0, 2.5);
/** Ambient light and shade color under the close-up key light: close to neutral and on the bright side, the spirit is exposed with its own colors */
const KEY_AMBIENT = new THREE.Color(0xaaa2bc);
const KEY_SHADOW = new THREE.Color(0x4a4468);

/** Phone vibration (silently skipped when unsupported) */
export function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no vibration API */
  }
}

function pedestal(): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(1.6, 1.85, 0.5, 40);
  const m = new THREE.Mesh(geo, sceneMaterial(0x4e4478, { rim: 0.35 }));
  m.position.y = 0.25;
  g.add(m);
  const top = new THREE.Mesh(new THREE.CircleGeometry(1.55, 48), new THREE.MeshBasicMaterial({ map: runeCircleTex(2), color: new THREE.Color(0x8a6aff).multiplyScalar(0.8), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.51;
  top.name = 'rune';
  g.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.04, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8a6aff).multiplyScalar(1.3), toneMapped: false }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.36;
  ring.name = 'ring';
  g.add(ring);
  // The stone platform goes into the ink layer; the runes and halos on the platform are self-lit and get no lines
  inkScenery(g);
  return g;
}

export class SummonScene extends MenuScene {
  gate: Gate;
  sky: THREE.Mesh;
  skyMat: THREE.ShaderMaterial;
  ped: THREE.Group;
  floorRune: THREE.Mesh;
  current: Creature | null = null;
  spin = 0.3;
  /** Silhouette amount 0 to 1: every frame the spirit is pressed to black (fades out for the close-up, so the face lights up first) */
  silhouette = 0;
  /** Key light: 0 to 1, turns the light direction toward the camera side and brightens the ambient light, so the close-up's face and colors read (does not affect the floor, which is an unlit material) */
  key = 0;
  private keyDir = new THREE.Vector3(0, 0.5, 1).normalize();
  /** Vignette: base is set by the field, pulse is a momentary darkening at the burst, and tick writes the two merged into grade */
  vig = 0.35;
  vigPulse = 0;
  /** Flow generation: abort() / hurry() invalidate the old flow */
  private gen = 0;
  private flood: Flood | null = null;
  private sig: Signature | null = null;
  /** The scene's original lighting (interpolated from here when the field floods in) */
  light0 = { dir: new THREE.Vector3(), ambient: new THREE.Color(), rim: new THREE.Color(), shadow: new THREE.Color() };
  /** The reveal currently playing (for hurry) */
  busy = false;
  /** This scene's bloom baseline (lower than stage.bloomBase) */
  readonly bloom0 = 0.5;

  constructor(stage: Stage) {
    super(stage);
    LIGHT.dir.value.set(0.3, 0.8, 0.6).normalize();
    LIGHT.ambient.value.set(0x6a6098);
    LIGHT.rimColor.value.set(0xc8b8ff);
    LIGHT.shadowTint.value.set(0x2e2460);
    this.snapLight();
    stage.scene.fog = new THREE.Fog(0x07041a, 26, 110);
    // This scene piles up many additive effects: raise the bloom threshold and lower its intensity, so highlights read as "light on a dark base"
    stage.bloom.threshold = 1.12;
    stage.bloom.strength = this.bloom0;
    this.skyMat = skyMaterial();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), this.skyMat);
    this.root.add(this.sky);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshBasicMaterial({ color: 0x0d0a24 }));
    floor.rotation.x = -Math.PI / 2;
    this.root.add(floor);
    this.floorRune = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshBasicMaterial({ map: runeCircleTex(4), color: new THREE.Color(0x8a6aff).multiplyScalar(0.9), transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.floorRune.rotation.x = -Math.PI / 2;
    this.floorRune.position.y = 0.02;
    this.root.add(this.floorRune);
    // Distant standing pillars: they give the field depth. They use the scene toon material but stay out of the ink layer: the outline only computes one box enclosing all ink objects,
    // and the pillars sit on both sides of the screen, with some behind the camera during the reveal close-up, which would pull the whole screen into the line-computation range (about 20% more per frame at phone size);
    // the pillars are in fog, 20 or more from the camera, so their lines are faint anyway, and they separate from the sky by brightness
    const cols = new THREE.Group();
    const colGeo = new THREE.CylinderGeometry(0.35, 0.5, 9, 10);
    const colMat = sceneMaterial(0x3a3160, { rim: 0.45, emissive: 0x2a1a60, emissiveAmt: 0.1 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(Math.cos(a) * 17, 4.5, Math.sin(a) * 17 - 4);
      cols.add(col);
    }
    this.root.add(cols);
    this.gate = buildGate(5);
    this.gate.group.position.copy(GATE_POS);
    this.root.add(this.gate.group);
    this.ped = pedestal();
    this.ped.position.copy(PED_POS);
    this.root.add(this.ped);
    this.rig.setBase(this.gateCam.pos.clone(), this.gateCam.look.clone());
  }

  /** Idle camera: backs off to a distance where the whole Star Gate ring is visible (at 16:9 the ring's top is about 13% below the top of the frame, leaving room for the ten-pull progress bar) */
  private gateCam = { pos: new THREE.Vector3(0, 3.4, 19), look: new THREE.Vector3(0, 5.6, -2) };

  get portrait(): boolean {
    return this.stage.container.clientHeight > this.stage.container.clientWidth;
  }

  gatePos(): THREE.Vector3 {
    return GATE_POS.clone();
  }

  pedPos(): THREE.Vector3 {
    return PED_POS.clone();
  }

  /** The current spirit's height (a sensible value when there is no spirit) */
  get h(): number {
    return this.current?.worldHeight ?? 1.6;
  }

  center(): THREE.Vector3 {
    return PED_POS.clone().setY(0.5 + this.h * 0.5);
  }

  head(): THREE.Vector3 {
    const c = this.current;
    if (!c) return this.center();
    const p = new THREE.Vector3();
    c.head.getWorldPosition(p);
    // Some models' head node has no offset, so fall back to the height estimate
    if (p.distanceToSquared(c.root.position) < 1e-4) return PED_POS.clone().setY(0.5 + this.h * 0.8);
    return p;
  }

  eyes(): THREE.Vector3[] {
    return (this.current?.eyes ?? []).map((e) => e.getWorldPosition(new THREE.Vector3()));
  }

  private snapLight(): void {
    this.light0.dir.copy(LIGHT.dir.value);
    this.light0.ambient.copy(LIGHT.ambient.value);
    this.light0.rim.copy(LIGHT.rimColor.value);
    this.light0.shadow.copy(LIGHT.shadowTint.value);
  }

  restoreLight(): void {
    LIGHT.dir.value.copy(this.light0.dir);
    LIGHT.ambient.value.copy(this.light0.ambient);
    LIGHT.rimColor.value.copy(this.light0.rim);
    LIGHT.shadowTint.value.copy(this.light0.shadow);
  }

  /** Layer the key light onto the current lighting (called by flood every frame while the field is flooding in) */
  applyKey(): void {
    if (this.key <= 0) return;
    LIGHT.dir.value.lerp(this.keyDir, this.key).normalize();
    LIGHT.ambient.value.lerp(KEY_AMBIENT, this.key * 0.7);
    LIGHT.shadowTint.value.lerp(KEY_SHADOW, this.key * 0.5);
  }

  /** Key light aimed from the spirit's head toward the camera position (slightly above, like a studio's frontal key light) */
  aimKey(camPos: THREE.Vector3): void {
    this.keyDir.copy(camPos).sub(this.head()).normalize().add(new THREE.Vector3(0, 0.45, 0)).normalize();
  }

  /** Wait (fx clock); returns false when the flow has been skipped */
  async wait(sec: number, g: number): Promise<boolean> {
    await this.tw.wait(sec, 'fx');
    return g === this.gen;
  }

  /** At the reveal the camera pushes in on the display stand, framed by the spirit's height so the spirit lands in the upper middle of the frame (the info card is below) */
  private revealFrame(h: number): { pos: THREE.Vector3; look: THREE.Vector3 } {
    const look = new THREE.Vector3(0, 0.5 + h * 0.45, PED_POS.z);
    const d = Math.max(5.2, h * 2.3 + 2.6) * (this.portrait ? 1.35 : 1);
    return { pos: look.clone().add(new THREE.Vector3(0, d * 0.22, d)), look };
  }

  private frameReveal(h: number, dur = 0.5): void {
    const f = this.revealFrame(h);
    this.rig.base.pos.copy(f.pos);
    this.rig.base.look.copy(f.look);
    void this.rig.reset(dur);
  }

  protected tick(_dt: number, fxDt: number): void {
    this.skyMat.uniforms.uTime.value = this.time;
    this.gate.portalMat.uniforms.uTime.value = this.time;
    this.gate.seal.rotation.z += fxDt * this.spin;
    this.gate.seal2.rotation.z -= fxDt * this.spin * 0.7;
    this.floorRune.rotation.z += fxDt * 0.1;
    const rune = this.ped.getObjectByName('rune');
    if (rune) rune.rotation.z += fxDt * 0.4;
    this.vfx.camPos.copy(this.stage.camera.position);
    // Apply the silhouette on the same frame: with setFlash alone, the next frame's update would decay it once before applying, and at a low frame rate color would show through the silhouette
    if (this.silhouette > 0 && this.current) {
      this.current.setFlash(0x000000, this.silhouette);
      this.current.applyFlash();
    }
    if (!this.flood) {
      this.restoreLight();
      this.applyKey();
    }
    this.stage.grade.vignette = Math.min(0.97, this.vig + this.vigPulse);
    // Floating motes at the edge of the Star Gate
    if (Math.random() < fxDt * (14 + this.spin * 8)) {
      const a = Math.random() * Math.PI * 2;
      this.vfx.emit({ pos: GATE_POS.clone().add(new THREE.Vector3(Math.cos(a) * 5.2, Math.sin(a) * 5.2, 0.3)), count: 1, color: [0xb08aff, 0x9ab8ff, 0xfff0a0], speed: [0.2, 0.8], life: [0.8, 1.4], size: [0.1, 0.22], intensity: 1.4 });
    }
  }

  private setPortal(color: number, hi: number, hot = 0): void {
    const u = this.gate.portalMat.uniforms;
    u.uColor.value.set(color);
    u.uHi.value.set(hi);
    u.uHot.value = hot;
    this.gate.sealMat.color.set(color).multiplyScalar(0.85);
    (this.gate.ringMat.uniforms.uEmissive.value as THREE.Color).set(color);
  }

  private setPedColor(color: number): void {
    const rune = this.ped.getObjectByName('rune') as THREE.Mesh | undefined;
    const ring = this.ped.getObjectByName('ring') as THREE.Mesh | undefined;
    if (rune) (rune.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(0.8);
    if (ring) (ring.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(1.3);
  }

  // ───────────────────────── Opening ─────────────────────────

  /**
   * Summon opening: crystals converge → runes light up → meteor → (purple turns gold) → the gate opens.
   * best is the highest rarity of this pull; upgradeFake only takes effect when best is SSR (the meteor first poses as purple).
   */
  async intro(best: SummonRarity, upgradeFake: boolean): Promise<void> {
    const g = ++this.gen;
    this.busy = true;
    const gate = GATE_POS.clone();
    this.rig.setBase(this.gateCam.pos.clone(), this.gateCam.look.clone());
    void this.rig.reset(0.01);
    // ① Starlight stones: float up along an arc in front of the camera and shatter one by one, the motes flowing to the Star Gate; the music starts building (until the meteor launches)
    summonMusic.cue('build', 0.62 + this.gate.runes.length * 0.085);
    summonSfx.crystalShatter(0.6);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = (i - (n - 1) / 2) / ((n - 1) / 2);
      const p = new THREE.Vector3(t * (this.portrait ? 2.0 : 3.8), 2.5 + Math.abs(t) * 0.3 + (i % 2) * 0.2, this.gateCam.pos.z - 6.3 - Math.abs(t) * 0.6);
      void crystal(this.vfx, p, gate, 0.16 + Math.abs(t) * 0.22 + (i % 2) * 0.06, 0.95);
    }
    this.spin = 1.2;
    void this.tw.to(0.7, (k) => (this.gate.portalMat.uniforms.uHot.value = k * 0.25), ease.inQuad, 'fx');
    void this.tw.to(0.6, (k) => {
      this.rig.pos.lerpVectors(this.gateCam.pos, this.gateCam.pos.clone().add(new THREE.Vector3(0, 0.3, -0.8)), k);
    }, ease.inOutQuad, 'fx');
    if (!(await this.wait(0.62, g))) return;
    // ② Runes light up in turn, the pitch climbing
    for (let i = 0; i < this.gate.runes.length; i++) {
      const r = this.gate.runes[i];
      lightRune(r, this.tw);
      summonSfx.runeNote(i, this.gate.runes.length);
      const wp = r.mesh.getWorldPosition(new THREE.Vector3());
      this.vfx.emit({ pos: wp, count: 10, color: [r.color.getHex(), 0xffffff], speed: [0.8, 2.2], life: [0.3, 0.6], size: [0.08, 0.18], drag: 2, intensity: 1.2, atlas: 1 });
      this.spin = 1.2 + (i + 1) * 0.35;
      if (!(await this.wait(0.085, g))) return;
    }
    (this.gate.ringMat.uniforms.uEmissiveAmt as { value: number }).value = 0.45;
    // ③ Meteor: the color may only under-report
    const shown: SummonRarity = upgradeFake && best === 'SSR' ? 'SR' : best;
    const col = RARITY_COLOR[shown];
    const hi = RARITY_HI[shown];
    const side = Math.random() < 0.5 ? -1 : 1;
    const from = new THREE.Vector3(side * 30, 24, -30);
    const apex = new THREE.Vector3(side * 11, 17, -14);
    summonMusic.cue('drop');
    summonSfx.meteor(0.95);
    const flight = meteor(this.vfx, from, apex, gate, col, hi, 0.95);
    // The camera tilts up slightly to look at the sky, then returns to the Star Gate
    void this.tw.to(0.5, (k) => this.rig.look.lerpVectors(this.gateCam.look, new THREE.Vector3(side * 3, 9, -10), k), ease.inOutQuad, 'fx');
    if (!(await this.wait(0.5, g))) return;
    void this.tw.to(0.45, (k) => this.rig.look.lerpVectors(new THREE.Vector3(side * 3, 9, -10), this.gateCam.look, k), ease.inOutQuad, 'fx');
    if (!(await this.wait(0.45, g))) return;
    void flight;
    // The meteor crashes into the Star Gate
    this.setPortal(col, hi, 0.5);
    this.setPedColor(col);
    this.stage.screenFlash(col, shown === 'SSR' ? 0.35 : 0.28, 5);
    this.rig.addTrauma(shown === 'SSR' ? 0.55 : 0.4);
    buzz(shown === 'SSR' ? [40, 30, 80] : 40);
    summonSfx.meteorHit(shown);
    void slowRing(this.vfx, gate, col, 1, 14, 0.8, new THREE.Vector3(0, 0, 1), 0.9);
    this.vfx.emit({ pos: gate, count: 220, color: [col, hi, 0xffffff], speed: [4, 13], life: [0.6, 1.4], size: [0.12, 0.3], atlas: 1, drag: 1.5, intensity: 1.2 });
    const uv = this.stage.toUv(gate);
    this.stage.shockwave(uv.x, uv.y, 0.8, 0.6, 0.8);
    for (const r of this.gate.runes) lightRune(r, this.tw, 1.2);
    if (upgradeFake && best === 'SSR') {
      if (!(await this.wait(0.55, g))) return;
      // ④ Upgrade: the purple gate "cracks open" and golden light bursts from the crack
      summonSfx.upgrade();
      summonMusic.cue('upgrade');
      this.silhouetteHint();
      if (!(await this.wait(0.3, g))) return;
      this.setPortal(RARITY_COLOR.SSR, RARITY_HI.SSR, 0.7);
      this.setPedColor(RARITY_COLOR.SSR);
      this.stage.screenFlash(0xffb830, 0.22, 6);
      this.stage.chromatic(1);
      this.rig.addTrauma(0.7);
      buzz([60, 40, 120]);
      void this.column(gate.clone().setY(0), 0xffb830, 1.2, 24, 1.2, 0.3);
      void slowRing(this.vfx, gate, 0xffb830, 1, 18, 0.9, new THREE.Vector3(0, 0, 1), 0.5);
      void slowRing(this.vfx, gate, 0xffd870, 0.5, 9, 0.6, new THREE.Vector3(0, 0, 1), 0.4);
      this.vfx.emit({ pos: gate, count: 220, color: [0xffb830, 0xffd870, 0xff8a20], speed: [5, 16], life: [0.7, 1.6], size: [0.12, 0.3], atlas: 1, drag: 1.2, intensity: 1 });
      this.skyMat.uniforms.uGlow.value = 0.22;
      void this.tw.to(0.8, (k) => (this.skyMat.uniforms.uGlow.value = 0.22 * (1 - k)), ease.outQuad, 'fx');
      if (!(await this.wait(0.55, g))) return;
    }
    // ⑤ Gate opening: the iris opens, a sub-bass boom, the whole sky lights up; the beat returns
    summonSfx.gateOpen();
    summonMusic.cue('gate');
    void this.tw.to(0.55, (k) => (this.gate.portalMat.uniforms.uOpen.value = k), ease.outCubic, 'fx');
    void this.tw.to(0.6, (k) => (this.gate.sealMat.opacity = 0.55 * (1 - k) + 0.2), ease.outQuad, 'fx');
    this.skyMat.uniforms.uGlow.value = Math.max(this.skyMat.uniforms.uGlow.value as number, 0.3);
    void this.tw.to(1.2, (k) => (this.skyMat.uniforms.uGlow.value = 0.3 * (1 - k) + 0.1), ease.outQuad, 'fx');
    this.rig.addTrauma(0.35);
    buzz(30);
    void slowRing(this.vfx, gate, hi, 0.5, 9, 0.8, new THREE.Vector3(0, 0, 1), 0.6);
    this.vfx.emit({ pos: gate, count: 120, color: [col, hi], speed: [2, 6], dir: new THREE.Vector3(0, 0, 1), spread: 0.9, life: [0.6, 1.2], size: [0.1, 0.25], drag: 1.2, intensity: 1.1 });
    if (!(await this.wait(0.5, g))) return;
    this.spin = 0.7;
    this.busy = false;
  }

  /** Soft light pillar (dimmer than vfx.pillar, with no white core): fades in, holds, fades out */
  private column(pos: THREE.Vector3, color: number, radius: number, height: number, dur: number, alpha = 0.8, behind = false): Promise<void> {
    const geo = new THREE.CylinderGeometry(radius, radius * 1.15, height, 24, 1, true);
    geo.translate(0, height / 2, 0);
    const mat = additive(color, undefined, 0.55);
    mat.depthTest = false;
    // behind: draw only the far side of the cylinder, so the pillar stays behind the spirit and does not overlap it
    if (behind) mat.side = THREE.BackSide;
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    return this.vfx.spawn(m, dur, (k) => {
      const w = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      m.scale.set(0.5 + w * 0.6, 1, 0.5 + w * 0.6);
      mat.opacity = w * alpha;
    });
  }

  /** A hint before the upgrade: golden light seeps through the gate seam and the runes on the ground flash once */
  private silhouetteHint(): void {
    const gate = GATE_POS.clone();
    this.vfx.emit({ pos: gate, count: 40, color: [0xffc040, 0xfff0a0], speed: [0.5, 2], life: [0.4, 0.8], size: [0.1, 0.22], radius: 4, drag: 2, intensity: 1, atlas: 1 });
    void this.tw.to(0.3, (k) => (this.gate.portalMat.uniforms.uHot.value = 0.5 + Math.sin(k * Math.PI) * 0.6), ease.linear, 'fx');
    (this.floorRune.material as THREE.MeshBasicMaterial).color.set(0xffc040).multiplyScalar(1.6);
  }

  // ───────────────────────── Reveal ─────────────────────────

  /**
   * Reveal one spirit. onBeat notifies the UI to show the info card at "bursts open to reveal" (R / SR) or at "name card" (SSR).
   * The returned promise resolves when the cinematic ends (the next one can be tapped); it also resolves when hurry / abort is called.
   */
  async reveal(speciesId: string, rarity: string, stage: 1 | 2 | 3 = 3, onBeat?: (b: RevealBeat) => void): Promise<void> {
    const g = ++this.gen;
    this.busy = true;
    this.clearCurrent();
    const sp = getSpirit(speciesId);
    const el = sp.elements[0];
    const r: SummonRarity = rarity === 'SSR' ? 'SSR' : rarity === 'SR' ? 'SR' : 'R';
    if (r === 'SSR') await this.revealSsr(speciesId, stage, el, g, onBeat);
    else await this.revealBasic(speciesId, stage, el, r, g, onBeat);
    if (g !== this.gen) return;
    this.busy = false;
    onBeat?.('settled');
  }

  private spawn(speciesId: string, stage: 1 | 2 | 3): Creature {
    const c = this.addCreature(speciesId, stage, PED_POS.clone().setY(0.5), 0);
    this.current = c;
    return c;
  }

  /** R / SR: the orb falls from the Star Gate → the silhouette grows → bursts open to reveal */
  private async revealBasic(speciesId: string, stage: 1 | 2 | 3, el: Element, r: SummonRarity, g: number, onBeat?: (b: RevealBeat) => void): Promise<void> {
    const col = RARITY_COLOR[r];
    const hi = RARITY_HI[r];
    const sr = r === 'SR';
    this.setPortal(col, hi, sr ? 0.5 : 0.3);
    this.setPedColor(ELEMENT_COLOR[el]);
    const c = this.spawn(speciesId, stage);
    c.root.scale.setScalar(0.001);
    this.silhouette = 1;
    const h = c.worldHeight;
    this.frameReveal(h, 0.45);
    const target = PED_POS.clone().setY(0.5 + h * 0.5);
    summonSfx.silhouette(sr ? 0.4 : 0.28);
    onBeat?.('silhouette');
    await this.vfx.projectile(GATE_POS.clone(), target, col, sr ? 0.7 : 0.5, sr ? 0.26 : 0.22, 0.4, true);
    if (g !== this.gen) return;
    // The silhouette grows
    void this.tw.to(sr ? 0.3 : 0.24, (k) => c.root.scale.setScalar(Math.max(0.001, k)), ease.outBack, 'fx');
    void this.vfx.ring(PED_POS.clone().setY(0.6), col, 0.3, sr ? 3.2 : 2.2, 0.5);
    if (sr) void this.column(PED_POS.clone(), col, h * 0.35 + 0.5, 12, 0.7, 0.3);
    this.vfx.emit({ pos: PED_POS.clone().setY(0.6), count: sr ? 40 : 20, color: [col, hi], speed: [1, 3], dir: UP, spread: 0.5, life: [0.4, 0.8], size: [0.08, 0.18], radius: 1, gravity: -1, drag: 1.5, intensity: 1 });
    if (!(await this.wait(sr ? 0.32 : 0.24, g))) return;
    // Bursts open to reveal
    this.silhouette = 0;
    c.setFlash(hi, 0.8);
    summonSfx.burst(r);
    summonSfx.stinger(r);
    onBeat?.('burst');
    const center = this.center();
    void this.vfx.ring(PED_POS.clone().setY(0.6), col, 0.5, sr ? 5.5 : 3.5, 0.6);
    this.vfx.emit({ pos: center, count: sr ? 150 : 60, color: [col, ELEMENT_COLOR[el], hi], speed: [3, sr ? 9 : 6], life: [0.5, 1.1], size: [0.08, 0.2], atlas: 1, drag: 2, intensity: 0.9 });
    if (sr) {
      void this.vfx.circle(PED_POS.clone().setY(0.55), col, 3.2, 1.0, undefined, 1);
      this.stage.screenFlash(col, 0.28, 5);
      this.stage.chromatic(0.5);
      this.stage.hitStop(60);
      this.rig.addTrauma(0.35);
      buzz([25, 20, 45]);
      void this.rig.push(0.08, 0.25, center).then(() => { if (g === this.gen) void this.rig.reset(0.6); });
    } else {
      this.stage.screenFlash(hi, 0.14, 7);
      this.rig.addTrauma(0.15);
      buzz(20);
    }
    c.attackPose = 1;
    void this.tw.to(0.8, (k) => (c.attackPose = 1 - k), ease.outQuad, 'fx');
    if (!(await this.wait(sr ? 0.35 : 0.2, g))) return;
  }

  /** SSR: descent → the field floods in → close-up silhouette bursts + roar → name card */
  private async revealSsr(speciesId: string, stage: 1 | 2 | 3, el: Element, g: number, onBeat?: (b: RevealBeat) => void): Promise<void> {
    const col = RARITY_COLOR.SSR;
    const ec = ELEMENT_COLOR[el];
    const eh = ELEMENT_HI[el];
    const ed = ELEMENT_DEEP[el];
    const gate = GATE_POS.clone();
    synth.dropMusic(6000);
    this.setPortal(ec, eh, 0.35);
    this.setPedColor(ec);
    const c = this.spawn(speciesId, stage);
    const h = c.worldHeight;
    this.silhouette = 1;
    this.sig = signatureFor(this, speciesId, el);
    const fall = this.sig.fall ?? { height: 0, dur: 0.85 };
    // ① Descent: the camera drops low to look up at the Star Gate, and the spirit falls out of the gate as a silhouette, its tail trailing light in its element color
    const start = gate.clone().add(new THREE.Vector3(0, fall.height, 0.6));
    const landing = PED_POS.clone().setY(0.5);
    c.root.position.copy(start);
    c.root.scale.setScalar(0.6);
    this.stage.grade.letterbox = 1;
    this.stage.bloom.strength = 0.65;
    const camPos = PED_POS.clone().add(new THREE.Vector3(this.portrait ? 0 : -2.2, 1.1, this.portrait ? 8.5 : 7));
    this.rig.claim();
    this.rig.pos.copy(camPos);
    this.rig.look.copy(gate);
    summonSfx.descend(fall.dur);
    onBeat?.('silhouette');
    this.skyMat.uniforms.uGlow.value = 0.3;
    void this.column(gate.clone().setY(0), ec, 1.0, 14, fall.dur + 0.3, 0.35);
    void slowRing(this.vfx, gate, eh, 0.5, 12, 0.7, new THREE.Vector3(0, 0, 1), 1.4);
    this.sig.enter?.();
    let acc = 0;
    await this.tw.to(fall.dur, (k) => {
      const kk = ease.inQuad(k);
      c.root.position.lerpVectors(start, landing, kk);
      c.root.scale.setScalar(0.6 + 0.4 * k);
      this.rig.look.lerpVectors(gate, landing.clone().setY(0.5 + h * 0.5), ease.inOutQuad(k));
      acc += 12;
      const n = Math.floor(acc);
      acc -= n;
      this.vfx.emit({ pos: c.root.position.clone().setY(c.root.position.y + h * 0.5), count: n, color: [ec, eh, col], speed: [0.5, 2], life: [0.3, 0.7], size: [0.1, 0.24], sizeEnd: 0.03, radius: h * 0.3, drag: 1.5, intensity: 1 });
    }, ease.linear, 'fx');
    if (g !== this.gen) return;
    // ② Landing: hit-stop, screen shake, phone vibration, the ground cracks, dust
    c.root.position.copy(landing);
    c.root.scale.setScalar(1);
    this.stage.hitStop(120);
    this.rig.addTrauma(0.75);
    this.stage.chromatic(0.6);
    buzz([70, 30, 40]);
    summonSfx.land();
    void this.vfx.ring(PED_POS.clone().setY(0.55), ec, 0.5, 12, 0.7);
    void this.vfx.decal(PED_POS.clone().setY(0.56), crackTex(2), ec, h * 2 + 4, 3, Math.random() * 6.28, 1.6);
    this.vfx.smoke({ pos: PED_POS.clone().setY(0.6), count: 60, color: [0x3a2a5a, 0x5a4a7a], speed: [2, 6], dir: UP, spread: 1.2, life: [0.8, 1.5], size: [0.5, 1.2], sizeEnd: 2, radius: 1.5, gravity: -0.5, drag: 2 });
    this.vfx.emit({ pos: PED_POS.clone().setY(0.6), count: 80, color: [ec, eh], speed: [3, 8], dir: UP, spread: 1.1, life: [0.5, 1], size: [0.1, 0.24], radius: 1.2, gravity: 4, drag: 1, intensity: 1 });
    const uv = this.stage.toUv(landing);
    this.stage.shockwave(uv.x, uv.y, 1, 0.6, 0.9);
    this.sig.land?.();
    // ③ The field floods in: the sky, lighting and weather all change together to its element
    this.flood = startFlood(this, el);
    summonSfx.flood(el);
    if (!(await this.wait(0.12, g))) return;
    void this.flood.ramp(1, 0.5);
    // Camera: low-angle full body → low-angle close-up (pushing in along an arc)
    const wide = this.revealFrame(h);
    this.rig.claim();
    void this.tw.to(0.35, (k) => {
      this.rig.pos.lerpVectors(camPos, wide.pos, ease.outCubic(k));
      this.rig.look.lerpVectors(landing.clone().setY(0.5 + h * 0.5), wide.look, ease.outCubic(k));
    }, ease.linear, 'fx');
    if (!(await this.wait(0.55, g))) return;
    const head = this.head();
    const yaw = this.portrait ? 0.15 : 0.42;
    const d = (h * 0.85 + 1.5) * (this.portrait ? 1.25 : 1);
    const close = head.clone().add(new THREE.Vector3(Math.sin(yaw) * d, -h * 0.12, Math.cos(yaw) * d));
    const closeLook = head.clone().add(new THREE.Vector3(0, -h * 0.05, 0));
    const p0 = this.rig.pos.clone();
    const l0 = this.rig.look.clone();
    this.rig.claim();
    void this.tw.to(0.5, (k) => {
      const kk = ease.inOutQuad(k);
      this.rig.pos.lerpVectors(p0, close, kk);
      this.rig.look.lerpVectors(l0, closeLook, kk);
      this.stage.setFovScale(1 - 0.18 * kk);
    }, ease.linear, 'fx');
    // Close-up: the frontal key light comes on and the silhouette fades, so the player sees its face and colors before the burst
    this.aimKey(close);
    void this.tw.to(0.4, (k) => {
      this.key = k;
      this.silhouette = 1 - k;
    }, ease.inOutQuad, 'fx');
    summonSfx.silhouette(0.5);
    if (!(await this.wait(0.5, g))) return;
    // ④ Burst: a brief flash in the element color (gone within 0.2 s), hit-stop, slow motion, speed lines, roar, screen shake, phone vibration.
    //    After that the spirit keeps normal exposure, against a dark-edged field in its element color
    this.silhouette = 0;
    this.key = 1;
    c.setFlash(ed, 0.7);
    summonSfx.burst('SSR');
    this.stage.screenFlash(ed, 0.5, 4);
    this.vigPulse = 0.5;
    void this.tw.to(0.5, (k) => (this.vigPulse = 0.5 * (1 - k)), ease.outQuad, 'fx');
    this.stage.hitStop(90);
    this.stage.slowMo(0.7, 200);
    this.stage.chromatic(1.3);
    this.rig.addTrauma(0.9);
    buzz([90, 40, 60, 40, 140]);
    const hp = this.head();
    void this.vfx.ring(PED_POS.clone().setY(0.6), ec, 0.5, h * 3 + 6, 0.6);
    this.vfx.emit({ pos: hp, count: 160, color: [ec, eh, ed], speed: [2, 7], life: [0.4, 0.9], size: [0.06, 0.16], sizeEnd: 0.02, radius: h * 0.3, drag: 2.5, intensity: 0.9, atlas: 1 });
    const huv = this.stage.toUv(hp);
    this.stage.shockwave(huv.x, huv.y, 1.2, 0.7, 1.2);
    this.stage.grade.lines = 0.45;
    this.stage.grade.linesColor.set(ed);
    this.stage.grade.radial = 0.22;
    this.stage.grade.radialCenter.set(huv.x, huv.y);
    void this.tw.to(0.6, (k) => {
      this.stage.grade.lines = 0.45 * (1 - k);
      this.stage.grade.radial = 0.22 * Math.max(0, 1 - k * 2);
    }, ease.outQuad, 'fx');
    for (const e of this.eyes()) void this.vfx.glint(e, eh, 0.12 + h * 0.05, 0.5, 2.4);
    this.sig.climax?.();
    if (!(await this.wait(0.12, g))) return;
    // Roar: sound waves push toward the camera ring by ring
    summonSfx.roar(el);
    c.attackPose = 1;
    const toCam = this.stage.camera.position.clone().sub(hp).normalize();
    for (let i = 0; i < 3; i++) {
      void this.vfx.ring(hp.clone().addScaledVector(toCam, 0.4 + i * 0.5), i % 2 ? ed : ec, 0.2, h * 0.6 + 0.8 + i * 0.4, 0.45, toCam);
      if (!(await this.wait(0.07, g))) return;
    }
    this.rig.addTrauma(0.4);
    if (!(await this.wait(0.25, g))) return;
    // ⑤ Name card: a short brass hit + a horn theme, the camera slowly pulls back to full body, and the field recedes to the background still raining on
    synth.restoreMusic(150);
    summonSfx.stinger('SSR');
    summonMusic.cue('ssr', el);
    onBeat?.('banner');
    buzz([30, 30, 30]);
    const f = this.revealFrame(h);
    this.rig.base.pos.copy(f.pos);
    this.rig.base.look.copy(f.look);
    void this.rig.moveTo(f.pos, f.look, 1.3, ease.inOutQuad);
    void this.tw.to(1.0, (k) => {
      this.stage.setFovScale(0.82 + 0.18 * k);
      this.stage.grade.letterbox = 1 - k;
    }, ease.inOutQuad, 'fx');
    void this.tw.to(1.0, (k) => (c.attackPose = 1 - k), ease.outQuad, 'fx');
    void this.flood.ramp(0.55, 1.2);
    void this.column(PED_POS.clone(), col, h * 0.35 + 0.6, 16, 1.4, 0.3, true);
    this.vfx.emit({ pos: this.center(), count: 200, color: [col, 0xfff0a0, ec], speed: [2, 8], life: [0.8, 1.6], size: [0.1, 0.24], atlas: 1, drag: 1.2, gravity: -1, intensity: 1 });
    if (!(await this.wait(0.7, g))) return;
    summonSfx.bannerHit();
    if (!(await this.wait(0.5, g))) return;
  }

  /** Results screen: a closing cadence, then back to the banner's loop */
  summary(): void {
    summonMusic.cue('summary');
  }

  // ───────────────────────── Abort and restore ─────────────────────────

  /** The player tapped the next one: wrap the current cinematic up immediately into the state where "the spirit stands on the platform" */
  hurry(): void {
    if (!this.busy) return;
    this.gen++;
    this.tw.clear();
    this.vfx.clear();
    this.killShow();
    this.busy = false;
    const c = this.current;
    if (c) {
      c.root.position.copy(PED_POS).setY(0.5);
      c.root.scale.setScalar(1);
      c.setFlash(0xffffff, 0);
      c.attackPose = 0;
      this.frameReveal(c.worldHeight, 0.25);
    }
  }

  /** Skip everything: restore the stage, with the gate left open */
  abort(): void {
    this.gen++;
    this.tw.clear();
    this.vfx.clear();
    this.killShow();
    this.busy = false;
    this.clearCurrent();
    this.gate.portalMat.uniforms.uOpen.value = 1;
    this.gate.portalMat.uniforms.uHot.value = 0.25;
    this.gate.sealMat.opacity = 0.2;
    this.skyMat.uniforms.uGlow.value = 0.1;
    this.rig.base.pos.copy(this.gateCam.pos);
    this.rig.base.look.copy(this.gateCam.look);
    void this.rig.reset(0.4);
    this.spin = 0.7;
  }

  private killShow(): void {
    this.silhouette = 0;
    this.key = 0;
    this.vig = 0.35;
    this.vigPulse = 0;
    this.sig?.kill();
    this.sig = null;
    this.flood?.kill();
    this.flood = null;
    this.restoreLight();
    this.skyMat.uniforms.uFloodAmt.value = 0;
    this.stage.resetCinematic();
    this.stage.bloom.strength = this.bloom0;
    this.rig.roll = 0;
    this.rig.trauma = 0;
    synth.restoreMusic(400);
  }

  private clearCurrent(): void {
    if (this.current) this.removeCreature(this.current);
    this.current = null;
  }

  /** Results finished: clear the spirit, close the gate, return to the idle camera */
  clearReveal(): void {
    this.gen++;
    this.tw.clear();
    this.vfx.clear();
    this.killShow();
    this.busy = false;
    this.clearCurrent();
    this.rig.base.pos.copy(this.gateCam.pos);
    this.rig.base.look.copy(this.gateCam.look);
    void this.rig.reset(0.6);
    this.setPortal(0x8a9aff, 0xe0e8ff, 0);
    this.setPedColor(0x8a6aff);
    (this.floorRune.material as THREE.MeshBasicMaterial).color.set(0x8a6aff).multiplyScalar(1.2);
    void this.tw.to(0.5, (k) => (this.gate.portalMat.uniforms.uOpen.value = 1 - k), ease.inOutQuad, 'fx');
    this.gate.sealMat.opacity = 0.55;
    this.skyMat.uniforms.uGlow.value = 0;
    (this.gate.ringMat.uniforms.uEmissiveAmt as { value: number }).value = 0.12;
    for (const r of this.gate.runes) dimRune(r);
    this.spin = 0.3;
  }

  dispose(): void {
    this.killShow();
    this.stage.bloom.threshold = 1.0;
    this.stage.bloom.strength = this.stage.bloomBase;
    super.dispose();
  }
}
