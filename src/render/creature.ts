// Procedural spirit: builds a chibi model from basic geometry and exposes control points for idle animation, hit flash and so on.

import * as THREE from 'three';
import { FX_TIME, glowMaterial, outlineMaterial, toonMaterial } from './toon.ts';
import { spiritMaterial, type SpiritMaterial, type SpiritSurface } from './spiritToon.ts';
import { INK_LAYER, registerInkRoot } from './ink.ts';
import type { LabModel } from './lab/shapes.ts';

const _flash = new THREE.Color();

export type Archetype = 'quad' | 'biped' | 'bird' | 'float' | 'crawl';
type V3 = [number, number, number];
/** Parts with outline: false get no outline (surface markings, blush, pupils); surface only has an effect on post-process outline spirits */
export type PartOpts = { outline?: boolean; emissive?: THREE.ColorRepresentation; emissiveAmt?: number; surface?: SpiritSurface };

export class Creature {
  /** World position (the battle director moves this layer) */
  root = new THREE.Group();
  /** Size normalization */
  scaler = new THREE.Group();
  /** Height in world coordinates (for UI anchors) */
  worldHeight = 1.5;
  /** Deformation and forward lean, origin at the feet */
  pose = new THREE.Group();
  /** Idle bob */
  body = new THREE.Group();
  head: THREE.Group = new THREE.Group();
  mats: (THREE.ShaderMaterial | SpiritMaterial)[] = [];
  /** Post-process outline version: the material is spiritToon, the parts enable INK_LAYER, and there is no back-face outline mesh */
  ink = false;
  outlines: THREE.ShaderMaterial[] = [];
  glows: THREE.MeshBasicMaterial[] = [];
  legs: { g: THREE.Group; phase: number; amp: number }[] = [];
  arms: { g: THREE.Group; side: number; base: THREE.Euler }[] = [];
  wings: { g: THREE.Group; side: number; base: number; amp: number; speed: number }[] = [];
  tails: { g: THREE.Group; phase: number; amp: number; axis: 'y' | 'x' | 'z' }[] = [];
  ears: { g: THREE.Group; phase: number }[] = [];
  spinners: { g: THREE.Object3D; speed: number; axis: 'x' | 'y' | 'z' }[] = [];
  flickers: { g: THREE.Object3D; base: THREE.Vector3; speed: number; amt: number }[] = [];
  bobbers: { g: THREE.Object3D; base: number; amp: number; speed: number; phase: number }[] = [];
  eyes: THREE.Group[] = [];
  height = 1.5;
  width = 1;
  archetype: Archetype = 'quad';
  /** 0 = idle, 1 = walking */
  moving = 0;
  /** 0 to 1: attack pose (forelimbs raised, wings spread) */
  attackPose = 0;
  time = Math.random() * 10;
  private blinkIn = 2 + Math.random() * 3;
  private blinkT = 0;
  hover = 0;
  /** Height of the model's lowest point above the ground (world units, hover excluded): greater than 0 only when a lab model floats by itself, used for the battle contact shadow */
  groundGap = 0;
  flash = 0;
  flashColor = new THREE.Color(1, 1, 1);
  /** Corruption: the body twitches now and then (set by render/corruption.ts) */
  corrupt = false;
  private twitchIn = 2 + Math.random() * 3;
  private twitchT = 0;
  /** Other add-ons that fade in and out with it (corruption's black mist and so on) */
  fadeHooks: ((o: number) => void)[] = [];
  /** Other materials that the white flash and the silhouette must also reach (a lab model's eye highlights and gems) */
  flashHooks: ((color: THREE.Color, amt: number) => void)[] = [];
  /** Extra per-frame animation (corruption's black mist and so on) */
  tickHooks: ((dt: number, t: number) => void)[] = [];
  /** The lab model plugged into the game (render/labCreature.ts): it does its own idle motion, and Creature only handles the shell */
  lab: LabModel | null = null;
  /** Named anchors (mouth, horn tip, shell...), fetched by ultimate scripts with anchor(name); old models have none */
  anchors: Record<string, THREE.Object3D> = {};

  constructor() {
    this.root.add(this.scaler);
    this.scaler.add(this.pose);
    this.pose.add(this.body);
  }

  /** Named anchor; returns null if there is none, and the script falls back to an estimate itself */
  anchor(name: string): THREE.Object3D | null {
    return this.anchors[name] ?? null;
  }

  /** Motion weight for cinematics (a lab model's LabModel.act); writing it does nothing for an old model or one without this motion */
  get act(): Record<string, number> {
    return (this.lab?.act ?? (this._noAct ??= {})) as Record<string, number>;
  }
  private _noAct?: Record<string, number>;

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    FX_TIME.value = performance.now() / 1000;
    if (this.lab) {
      this.updateLab(dt, t);
      return;
    }
    const h = this.height;
    const walk = this.moving;
    // Idle bob
    const bobAmp = this.archetype === 'bird' || this.archetype === 'float' ? 0.06 : 0.018;
    const bobSpd = this.archetype === 'bird' ? 3.2 : this.archetype === 'float' ? 1.6 : 2.4;
    this.body.position.y = this.hover + Math.sin(t * bobSpd) * bobAmp * h + walk * Math.abs(Math.sin(t * 10)) * 0.05 * h;
    if (this.archetype === 'float') this.body.rotation.z = Math.sin(t * 0.9) * 0.05;
    const breathe = 1 + Math.sin(t * bobSpd) * 0.015;
    this.body.scale.set(1 / Math.sqrt(breathe), breathe, 1 / Math.sqrt(breathe));
    this.head.rotation.z = Math.sin(t * 0.7) * 0.06;
    this.head.rotation.x = Math.sin(t * 1.1) * 0.04 - this.attackPose * 0.15;

    for (const l of this.legs) {
      l.g.rotation.x = Math.sin(t * 10 + l.phase) * 0.6 * walk * l.amp;
    }
    for (const a of this.arms) {
      a.g.rotation.x = a.base.x + Math.sin(t * 2 + a.side) * 0.08 - this.attackPose * 1.4 + Math.sin(t * 10 + a.side * 3) * walk * 0.5;
      a.g.rotation.z = a.base.z + a.side * this.attackPose * 0.3;
    }
    for (const w of this.wings) {
      const flap = Math.sin(t * w.speed) * w.amp;
      w.g.rotation.z = w.side * (w.base + flap + this.attackPose * 0.5);
    }
    for (const tl of this.tails) {
      tl.g.rotation[tl.axis] = Math.sin(t * 3 + tl.phase) * tl.amp * (1 + walk);
    }
    for (const e of this.ears) {
      const tw = Math.max(0, Math.sin(t * 0.8 + e.phase) - 0.9) * 6;
      e.g.rotation.z = Math.sin(t * 20) * 0.15 * tw;
    }
    for (const s of this.spinners) s.g.rotation[s.axis] += s.speed * dt;
    for (const f of this.flickers) {
      const k = 1 + Math.sin(t * f.speed) * f.amt * 0.6 + Math.sin(t * f.speed * 2.7 + 1.3) * f.amt * 0.4;
      f.g.scale.set(f.base.x * (2 - k) * 0.5 + f.base.x * 0.5, f.base.y * k, f.base.z * (2 - k) * 0.5 + f.base.z * 0.5);
    }
    for (const b of this.bobbers) {
      b.g.position.y = b.base + Math.sin(t * b.speed + b.phase) * b.amp;
    }

    // Blink
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkT = 0.14;
      this.blinkIn = 2 + Math.random() * 4;
    }
    let eyeY = 1;
    if (this.blinkT > 0) {
      this.blinkT -= dt;
      eyeY = 0.1 + Math.abs(this.blinkT / 0.14 - 0.5) * 1.8;
    }
    for (const e of this.eyes) e.scale.y = eyeY;

    // Corruption twitch: every few seconds the body gives a sudden shudder
    if (this.corrupt) {
      this.twitchIn -= dt;
      if (this.twitchIn <= 0) {
        this.twitchT = 0.16;
        this.twitchIn = 1.8 + Math.random() * 3.5;
      }
      if (this.twitchT > 0) {
        this.twitchT -= dt;
        const k = this.twitchT / 0.16;
        this.body.position.x = (Math.random() - 0.5) * 0.06 * h * k;
        this.head.rotation.z += (Math.random() - 0.5) * 0.5 * k;
      } else this.body.position.x = 0;
    }
    for (const f of this.tickHooks) f(dt, t);

    // Hit white flash
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
    this.applyFlash();
  }

  /**
   * Per-frame update for a lab model: the idle motion (breathing, looking around, blinking, tail sway) is left to the model, and this only layers on the shell's pose
   * (hover lift, walking bob, the attack pose's chest-out), then applies the corruption twitch, the add-on animations and the hit white flash. Time is the accumulated dt, and everything freezes when timeScale is 0.
   */
  private updateLab(dt: number, t: number): void {
    const h = this.height;
    this.body.position.y = this.hover + this.moving * Math.abs(Math.sin(t * 10)) * 0.04 * h;
    this.body.rotation.x = -this.attackPose * 0.12;
    this.lab!.update(t, dt);
    if (this.corrupt) {
      this.twitchIn -= dt;
      if (this.twitchIn <= 0) {
        this.twitchT = 0.16;
        this.twitchIn = 1.8 + Math.random() * 3.5;
      }
      if (this.twitchT > 0) {
        this.twitchT -= dt;
        this.body.position.x = (Math.random() - 0.5) * 0.06 * h * (this.twitchT / 0.16);
      } else this.body.position.x = 0;
    }
    for (const f of this.tickHooks) f(dt, t);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
    this.applyFlash();
  }

  /** Apply the white flash to the materials: called every frame by update; a portrait's silhouette is given a color and intensity directly */
  applyFlash(color: THREE.ColorRepresentation = this.flashColor, amt = this.flash): void {
    const col = _flash.set(color);
    for (const m of this.mats) {
      m.uniforms.uFlashAmt.value = amt;
      m.uniforms.uFlash.value.copy(col);
    }
    for (const f of this.flashHooks) f(col, amt);
  }

  setFlash(color: THREE.ColorRepresentation, amount = 1): void {
    this.flashColor.set(color);
    this.flash = amount;
  }

  /**
   * Multiply the body's emission by k (0 off, 1 unchanged, above 1 brighter): used when another spirit's ultimate dims or lights up the opponent.
   * A new model's glow lives in the spirit material (uGlowMul), while an old model's glowing parts (glows) have their color changed; for old models, remember the original colors and restore them yourself, since this only handles new models.
   */
  private inkMeshes: THREE.Object3D[] | null = null;
  private inkOn = true;

  /**
   * Temporarily take the whole spirit out of (or back into) the outline layer: a distant field spirit is only a few dozen pixels, so the lines are invisible, and the normal pass also skips drawing these meshes.
   * Only touches meshes that were already on the outline layer; does nothing when the state has not changed.
   */
  setInk(on: boolean): void {
    if (on === this.inkOn) return;
    this.inkOn = on;
    if (!this.inkMeshes) {
      this.inkMeshes = [];
      this.root.traverse((o) => {
        if (o.layers.isEnabled(INK_LAYER)) this.inkMeshes!.push(o);
      });
    }
    for (const o of this.inkMeshes) {
      if (on) o.layers.enable(INK_LAYER);
      else o.layers.disable(INK_LAYER);
    }
  }

  setGlowMul(k: number): void {
    for (const m of this.mats) if (m.uniforms.uGlowMul) m.uniforms.uGlowMul.value = k;
  }

  /** Backlight rim light (new models only): k is the strength (0 turns it off), color is the color; makes the shape stand out in a night silhouette */
  setBacklight(k: number, color?: THREE.ColorRepresentation): void {
    for (const m of this.mats) {
      const u = m.uniforms as unknown as { uBack?: { value: number }; uBackCol?: { value: THREE.Color } };
      if (!u.uBack) continue;
      u.uBack.value = k;
      if (color !== undefined) u.uBackCol?.value.set(color);
    }
  }

  setOpacity(o: number): void {
    for (const m of this.mats) {
      m.transparent = o < 1;
      m.uniforms.uOpacity.value = o;
    }
    for (const m of this.outlines) {
      m.transparent = o < 1;
      m.uniforms.uOpacity.value = o;
    }
    for (const m of this.glows) {
      m.transparent = true;
      m.opacity = o;
    }
    for (const f of this.fadeHooks) f(o);
  }

  dispose(): void {
    const mats = new Set<THREE.Material>([...this.mats, ...this.outlines, ...this.glows]);
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      // A lab model's materials are not all registered in mats (highlights, starfield), so dispose them together
      if (this.lab && m.material) for (const x of Array.isArray(m.material) ? m.material : [m.material]) mats.add(x);
    });
    for (const m of mats) m.dispose();
  }
}

/**
 * Assembly helper: adds a part to the given parent, adding the outline and registering the material automatically.
 * When ink is true it uses the post-process outline version: the material becomes spiritToon, the part enables INK_LAYER so render/ink.ts draws the line, and no back-face outline mesh is stacked on.
 */
export class Kit {
  private cache = new Map<string, THREE.ShaderMaterial | SpiritMaterial>();
  private outlineMat: THREE.ShaderMaterial | null = null;
  c: Creature;
  outline: number;
  readonly ink: boolean;
  constructor(c: Creature, outline = 0.028, opts: { ink?: boolean } = {}) {
    this.c = c;
    this.outline = outline;
    this.ink = opts.ink ?? false;
    c.ink = this.ink;
    if (this.ink) registerInkRoot(c.root);
    else {
      this.outlineMat = outlineMaterial(outline);
      c.outlines.push(this.outlineMat);
    }
  }

  mat(color: THREE.ColorRepresentation, emissive?: THREE.ColorRepresentation, emissiveAmt = 0, surface: SpiritSurface = 'matte'): THREE.ShaderMaterial | SpiritMaterial {
    const key = `${new THREE.Color(color).getHexString()}|${emissive ?? ''}|${emissiveAmt}|${this.ink ? surface : ''}`;
    let m = this.cache.get(key);
    if (!m) {
      m = this.ink ? spiritMaterial(color, { emissive, emissiveAmt, surface }) : toonMaterial(color, { emissive, emissiveAmt });
      this.cache.set(key, m);
      this.c.mats.push(m);
    }
    return m;
  }

  group(parent: THREE.Object3D, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]): THREE.Group {
    const g = new THREE.Group();
    g.position.set(...pos);
    g.rotation.set(...rot);
    parent.add(g);
    return g;
  }

  mesh(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    color: THREE.ColorRepresentation,
    pos: V3 = [0, 0, 0],
    rot: V3 = [0, 0, 0],
    o: PartOpts = {},
  ): THREE.Mesh {
    const m = new THREE.Mesh(geo, this.mat(color, o.emissive, o.emissiveAmt, o.surface));
    m.position.set(...pos);
    m.rotation.set(...rot);
    parent.add(m);
    if (o.outline !== false) {
      if (this.ink) m.layers.enable(INK_LAYER);
      else m.add(new THREE.Mesh(geo, this.outlineMat!));
    }
    return m;
  }

  sphere(parent: THREE.Object3D, color: THREE.ColorRepresentation, r: number, pos: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
    const g = new THREE.SphereGeometry(r, 24, 18);
    g.scale(...scale);
    return this.mesh(parent, g, color, pos, rot, o);
  }

  capsule(parent: THREE.Object3D, color: THREE.ColorRepresentation, r: number, len: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
    const g = new THREE.CapsuleGeometry(r, len, 6, 14);
    return this.mesh(parent, g, color, pos, rot, o);
  }

  cone(parent: THREE.Object3D, color: THREE.ColorRepresentation, r: number, h: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], seg = 14, o: PartOpts = {}): THREE.Mesh {
    const g = new THREE.ConeGeometry(r, h, seg, 1);
    g.translate(0, h / 2, 0);
    return this.mesh(parent, g, color, pos, rot, o);
  }

  /** Curved horn / claw: a tapered tube along an arc */
  horn(parent: THREE.Object3D, color: THREE.ColorRepresentation, r: number, len: number, curve: number, pos: V3, rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(new THREE.Vector3(0, t * len, -Math.sin(t * Math.PI * 0.5) * curve));
    }
    const path = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(path, 16, r, 10, false);
    // Taper the end of the tube
    const p = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const t = Math.min(1, Math.max(0, v.y / len));
      const center = path.getPoint(t);
      const k = 1 - t * 0.92;
      v.sub(center).multiplyScalar(k).add(center);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return this.mesh(parent, g, color, pos, rot, o);
  }

  cyl(parent: THREE.Object3D, color: THREE.ColorRepresentation, rt: number, rb: number, h: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], seg = 16, o: PartOpts = {}): THREE.Mesh {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1);
    return this.mesh(parent, g, color, pos, rot, o);
  }

  torus(parent: THREE.Object3D, color: THREE.ColorRepresentation, R: number, r: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], arc = Math.PI * 2, o: PartOpts = {}): THREE.Mesh {
    const g = new THREE.TorusGeometry(R, r, 10, 32, arc);
    return this.mesh(parent, g, color, pos, rot, o);
  }

  lathe(parent: THREE.Object3D, color: THREE.ColorRepresentation, profile: [number, number][], pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
    // LatheGeometry needs a profile running bottom to top so the normals face outward
    const pts = profile[0][1] > profile[profile.length - 1][1] ? [...profile].reverse() : profile;
    const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 28);
    return this.mesh(parent, g, color, pos, rot, o);
  }

  /** Flat fan / leaf (wing, feather, fin) */
  blade(parent: THREE.Object3D, color: THREE.ColorRepresentation, len: number, wid: number, thick: number, pos: V3, rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
    const g = new THREE.SphereGeometry(0.5, 16, 10);
    g.scale(wid, len, thick);
    g.translate(0, len / 2, 0);
    return this.mesh(parent, g, color, pos, rot, o);
  }

  glow(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, intensity = 2.2, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], opacity = 1): THREE.Mesh {
    const m = glowMaterial(color, intensity, opacity);
    this.c.glows.push(m);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    parent.add(mesh);
    return mesh;
  }

  glowSphere(parent: THREE.Object3D, color: THREE.ColorRepresentation, r: number, pos: V3 = [0, 0, 0], intensity = 2.2, scale: V3 = [1, 1, 1], opacity = 1): THREE.Mesh {
    const g = new THREE.SphereGeometry(r, 16, 12);
    g.scale(...scale);
    return this.glow(parent, g, color, intensity, pos, [0, 0, 0], opacity);
  }

  /** Flame: several glowing cones stacked together, flickering */
  flame(parent: THREE.Object3D, color: THREE.ColorRepresentation, core: THREE.ColorRepresentation, size: number, pos: V3, rot: V3 = [0, 0, 0]): THREE.Group {
    const g = this.group(parent, pos, rot);
    const outer = new THREE.ConeGeometry(size * 0.5, size * 1.6, 12);
    outer.translate(0, size * 0.6, 0);
    const inner = new THREE.ConeGeometry(size * 0.3, size * 1.1, 10);
    inner.translate(0, size * 0.45, 0);
    this.glow(g, new THREE.SphereGeometry(size * 0.5, 12, 10), color, 2.4, [0, 0, 0], [0, 0, 0], 0.95);
    this.glow(g, outer, color, 2.2, [0, 0, 0], [0, 0, 0], 0.85);
    this.glow(g, inner, core, 3, [0, 0.02, 0]);
    this.c.flickers.push({ g, base: g.scale.clone(), speed: 9 + Math.random() * 4, amt: 0.25 });
    return g;
  }

  /** Big eyes */
  eyes(
    head: THREE.Object3D,
    o: { x: number; y: number; z: number; r: number; iris: THREE.ColorRepresentation; glow?: boolean; sharp?: boolean; yaw?: number },
  ): void {
    for (const side of [-1, 1]) {
      const g = this.group(head, [side * o.x, o.y, o.z], [0, side * (o.yaw ?? 0.28), 0]);
      const r = o.r;
      const sclera = new THREE.SphereGeometry(r, 20, 16);
      sclera.scale(1, o.sharp ? 0.75 : 1.18, 0.45);
      this.mesh(g, sclera, 0xffffff, [0, 0, 0], [0, 0, o.sharp ? side * 0.25 : 0]);
      if (o.glow) {
        this.glowSphere(g, o.iris, r * 0.7, [0, 0, r * 0.2], 2.6, [1, o.sharp ? 0.8 : 1.15, 0.4]);
        this.glowSphere(g, 0xffffff, r * 0.28, [0, 0, r * 0.32], 3, [0.5, 1, 0.5]);
      } else {
        const iris = new THREE.SphereGeometry(r * 0.74, 18, 14);
        iris.scale(1, o.sharp ? 0.85 : 1.15, 0.42);
        this.mesh(g, iris, o.iris, [0, -r * 0.05, r * 0.2], [0, 0, 0], { outline: false });
        const pupil = new THREE.SphereGeometry(r * 0.42, 14, 12);
        pupil.scale(o.sharp ? 0.55 : 1, 1.1, 0.4);
        this.mesh(g, pupil, 0x14101c, [0, -r * 0.05, r * 0.3], [0, 0, 0], { outline: false });
        this.glowSphere(g, 0xffffff, r * 0.24, [-r * 0.3, r * 0.34, r * 0.42], 1.6);
        this.glowSphere(g, 0xffffff, r * 0.11, [r * 0.28, -r * 0.3, r * 0.42], 1.4);
      }
      this.c.eyes.push(g);
    }
  }

  /** Blush */
  blush(head: THREE.Object3D, x: number, y: number, z: number, r: number, color: THREE.ColorRepresentation = 0xff9aa8): void {
    for (const side of [-1, 1]) {
      this.sphere(head, color, r, [side * x, y, z], [1, 0.55, 0.3], [0, side * 0.5, 0], { outline: false });
    }
  }
}
