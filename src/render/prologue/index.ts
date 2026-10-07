// Prologue animation: one deterministic timeline (seconds) drives every picture; each segment (beat) sets up the world on entry,
// and each frame works out the camera, lighting and object states from the "in-segment time"; the narration is sent to React for display by the seconds in script.ts.
// The camera and staging depend only on time (particle details use random numbers), so &beat=N can start straight from a segment and seek() can fast-forward to any second.

import * as THREE from 'three';
import { Stage } from '../stage.ts';
import { CameraRig } from '../camera.ts';
import { Tweens } from '../tween.ts';
import { Vfx } from '../vfx.ts';
import { buildCreature } from '../species.ts';
import type { Creature } from '../creature.ts';
import { LIGHT } from '../toon.ts';
import { disposeTree } from '../stage.ts';
import { skyMaterial, voidMaterial } from './shaders.ts';
import { buildValley, type Valley } from './valley.ts';
import {
  buildChamber,
  buildCity,
  buildGate,
  buildGround,
  buildHeart,
  buildPerson,
  buildPillar,
  buildShard,
  buildSigil,
  buildSpire,
  buildTorrent,
  CHILD_LOOK,
  ELDA_LOOK,
  lerpColor,
  MASKED_LOOK,
  type City,
  type Gate,
  type Ground,
  type Heart,
  type Person,
  type Pillar,
  type Shard,
  type Torrent,
} from './sets.ts';
import { BEATS, LINES, TOTAL, type Line } from './script.ts';
import { BEAT_DEFS, type Beat } from './beats.ts';
import { camAt, lerp, type CamKey } from './util.ts';
import { HEART, HEART_SIZE, SPIRE_H, SPIRE_POS } from './layout.ts';

export interface PrologueEvents {
  onLine(line: Line | null): void;
  onDone(): void;
}

/** The world's mood: sky, ground and toon lighting change together */
export interface Mood {
  top: number;
  mid: number;
  bot: number;
  stars: number;
  nebula: number;
  smoke: number;
  day: number;
  horizon: number;
  ambient: [number, number, number];
  rim: [number, number, number];
  shadow: [number, number, number];
}

export const MOOD = {
  /** The Night of the Shattered Heart: a night tinted purple-red by the heart */
  night: { top: 0x040614, mid: 0x0e1236, bot: 0x221a44, stars: 1, nebula: 0.45, smoke: 0, day: 0, horizon: 0x1a1440, ambient: [0.1, 0.09, 0.2], rim: [1, 0.5, 0.85], shadow: [0.14, 0.1, 0.28] },
  /** The lost world: golden light of early morning */
  day: { top: 0x2a64c8, mid: 0x7ab4ec, bot: 0xffdcae, stars: 0, nebula: 0, smoke: 0, day: 1, horizon: 0xdcb080, ambient: [0.54, 0.47, 0.44], rim: [1.15, 0.8, 0.48], shadow: [0.46, 0.36, 0.62] },
  /** Aftermath: a dusk with a black hole left in the sky */
  dusk: { top: 0x0a0820, mid: 0x2a1848, bot: 0x6a3050, stars: 0.6, nebula: 0.3, smoke: 0.75, day: 0, horizon: 0x2a1848, ambient: [0.16, 0.11, 0.24], rim: [1, 0.55, 0.7], shadow: [0.16, 0.1, 0.26] },
  /** The night a thousand years later: a clean blue-black, a sky full of stars */
  late: { top: 0x030716, mid: 0x0a1638, bot: 0x1c2a58, stars: 1, nebula: 0.4, smoke: 0, day: 0, horizon: 0x101a3a, ambient: [0.12, 0.14, 0.24], rim: [0.6, 0.8, 1], shadow: [0.12, 0.14, 0.3] },
  black: { top: 0x000000, mid: 0x000000, bot: 0x000000, stars: 0, nebula: 0, smoke: 0, day: 0, horizon: 0x000000, ambient: [0.02, 0.02, 0.04], rim: [0.1, 0.1, 0.1], shadow: [0.02, 0.02, 0.04] },
} satisfies Record<string, Mood>;

/** The eight sacred spirits (the first is the one that catches the source crystal in the falling close-up) and their colors */
export const SACRED = ['ignisar', 'thalassene', 'sylvaron', 'aeroth', 'terragon', 'voltarion', 'luminael', 'noxfang'] as const;
export const SACRED_COLOR = [0xff6a2b, 0x3db7ff, 0x5fcb5a, 0x9fe8e0, 0xd8a45a, 0xc8a0ff, 0xffe680, 0xa060ff];
/** Small spirits born in the river of light */
export const SMALL = ['acornsquirrel', 'candledove', 'dandelion'] as const;

const _c1 = new THREE.Color();
const _c2 = new THREE.Color();

export class PrologueScene {
  stage: Stage;
  root = new THREE.Group();
  tw = new Tweens();
  rig: CameraRig;
  vfx = new Vfx();
  low: boolean;
  /** Global time (seconds) */
  t = 0;
  running = false;
  private beatIdx = -1;
  private lineIdx = -1;
  private off: () => void;
  private ev: PrologueEvents;
  private fov = 1;
  private lightBackup = { ambient: LIGHT.ambient.value.clone(), rim: LIGHT.rimColor.value.clone(), shadow: LIGHT.shadowTint.value.clone(), dir: LIGHT.dir.value.clone() };

  // World
  sky: THREE.Mesh;
  skyMat: THREE.ShaderMaterial;
  ground: Ground;
  city: City;
  gate: Gate;
  spire: THREE.Group;
  heart: Heart;
  wound: THREE.Mesh;
  woundMat: THREE.ShaderMaterial;
  chamber: THREE.Mesh;
  /** The lost world: village, trees, flowers, birds */
  valley: Valley;
  people: { masked: Person; elda: Person; child: Person };
  creatures = new Map<string, Creature>();
  shards: Shard[] = [];
  pillars: Pillar[] = [];
  /** The Void Blight's torrent (two: the main stream and a branch) */
  torrents: Torrent[] = [];
  sigils: { elda: THREE.Sprite; child: THREE.Sprite; spirit: THREE.Sprite; big: THREE.Sprite };
  /** Per-segment scratch state (cleared on entry) */
  mem: Record<string, unknown> = {};

  constructor(stage: Stage, ev: PrologueEvents, opts: { low?: boolean; startBeat?: number } = {}) {
    this.stage = stage;
    this.ev = ev;
    this.low = !!opts.low;
    stage.clearScene();
    stage.scene.add(this.root);
    this.root.add(this.vfx.group);
    this.rig = new CameraRig(stage.camera, this.tw);
    const low = this.low;

    this.skyMat = skyMaterial(low);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), this.skyMat);
    this.sky.frustumCulled = false;
    this.root.add(this.sky);
    this.ground = buildGround(low);
    this.root.add(this.ground.mesh);
    this.city = buildCity(low);
    this.root.add(this.city.group);
    this.gate = buildGate(low);
    this.root.add(this.gate.group);
    this.spire = buildSpire(SPIRE_POS, SPIRE_H);
    this.root.add(this.spire);
    this.heart = buildHeart(low, HEART_SIZE);
    this.heart.group.position.copy(HEART);
    this.root.add(this.heart.group);
    this.woundMat = voidMaterial(low);
    this.wound = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.woundMat);
    this.wound.visible = false;
    this.root.add(this.wound);
    this.chamber = buildChamber();
    this.chamber.visible = false;
    this.root.add(this.chamber);
    this.valley = buildValley(low);
    this.root.add(this.valley.group);

    const masked = buildPerson(MASKED_LOOK);
    const elda = buildPerson(ELDA_LOOK);
    const child = buildPerson(CHILD_LOOK);
    this.people = { masked, elda, child };
    for (const f of [masked, elda, child]) {
      f.g.visible = false;
      this.root.add(f.g);
    }
    this.sigils = { elda: buildSigil(), child: buildSigil(), spirit: buildSigil(0xfff0c0), big: buildSigil(0xffe0a0) };
    for (const s of Object.values(this.sigils)) this.root.add(s);

    for (const id of [...SACRED, ...SMALL, 'eldarin', 'cloudfluff']) this.addCreature(id, id);
    // Small spirits drifting by in the distance in the lost world
    this.addCreature('candledove', 'far1');
    this.addCreature('cloudfluff', 'far2');
    const cor = this.addCreature('cloudfluff', 'corrupt', true);
    // For the maddened eyes to be truly red: the original HDR red turns pink after desaturation and gamma, so use a pure red that does not overexpose
    for (const eye of cor.eyes)
      eye.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (mat?.isMeshBasicMaterial) mat.color.setRGB(1.25, 0.0, 0.02);
      });
    // The corrupted one no longer hums: hide the floating music notes
    for (const b of cor.bobbers) if (b.g.children.every((ch) => (ch as THREE.Mesh).material instanceof THREE.MeshBasicMaterial)) b.g.visible = false;
    for (let i = 0; i < 8; i++) {
      const s = buildShard(SACRED_COLOR[i], 0.55);
      s.g.visible = false;
      this.root.add(s.g);
      this.root.add(s.trail);
      this.shards.push(s);
      const pl = buildPillar(SACRED_COLOR[i]);
      this.root.add(pl.mesh);
      this.pillars.push(pl);
    }
    for (let i = 0; i < 2; i++) {
      const tr = buildTorrent(low);
      this.root.add(tr.mesh);
      this.torrents.push(tr);
    }

    stage.grade.letterbox = 1;
    stage.grade.vignette = 0.45;
    this.vfx.setScale(stage.container.clientHeight, stage.camera.fov);
    window.addEventListener('resize', this.onResize);
    this.prewarm();
    this.off = stage.add((_dt, _fxDt, realDt) => this.frame(realDt));
    const start = Math.max(0, Math.min(BEATS.length - 1, opts.startBeat ?? 0));
    this.t = BEATS[start].start;
    this.enterBeat(start);
    this.frame(0);
  }

  private onResize = (): void => this.vfx.setScale(this.stage.container.clientHeight, this.stage.camera.fov);

  /** Compile every shader first (including the various effects), so playback does not hitch on first compilation */
  private prewarm(): void {
    const far = new THREE.Vector3(0, -400, 0);
    void this.vfx.ring(far, 0xffffff, 0.1, 0.2, 0.1);
    void this.vfx.ring(far, 0xffffff, 0.1, 0.2, 0.1, new THREE.Vector3(0, 0, 1));
    void this.vfx.flash(far, 0xffffff, 0.1, 0.1);
    void this.vfx.glint(far, 0xffffff, 0.1, 0.1);
    void this.vfx.dome(far, 0xffffff, 0.1, 0.2, 0.1);
    this.vfx.emit({ pos: far, count: 1, color: 0xffffff });
    this.vfx.smoke({ pos: far, count: 1, color: 0x000000 });
    for (const tr of this.torrents) tr.path([far, far.clone().add(new THREE.Vector3(0, 1, 0)), far.clone().add(new THREE.Vector3(0, 2, 0))], 0.1, 0.1);
    this.stage.renderer.compile(this.stage.scene, this.stage.camera);
    this.vfx.clear();
  }

  private addCreature(id: string, key: string, corrupted = false): Creature {
    const rarity = SACRED.includes(id as (typeof SACRED)[number]) || id === 'eldarin' ? 'SSR' : 'N';
    const c = buildCreature(id, rarity === 'SSR' ? 3 : 1, rarity, { corrupted });
    c.root.visible = false;
    this.root.add(c.root);
    this.creatures.set(key, c);
    return c;
  }

  cr(key: string): Creature {
    return this.creatures.get(key)!;
  }

  /** Place and show a spirit (sits on the ground when y is omitted) */
  place(key: string, x: number, y: number | null, z: number, rotY: number, scale = 1): Creature {
    const c = this.cr(key);
    c.root.visible = true;
    c.root.position.set(x, y ?? 0, z);
    c.root.rotation.set(0, rotY, 0);
    c.root.scale.setScalar(scale);
    return c;
  }

  hideAllCreatures(): void {
    for (const c of this.creatures.values()) {
      c.root.visible = false;
      c.setOpacity(1);
      c.attackPose = 0;
      c.moving = 0;
      c.pose.position.set(0, 0, 0);
      c.pose.rotation.set(0, 0, 0);
      c.hover = 0;
      c.root.scale.setScalar(1);
      c.root.rotation.set(0, 0, 0);
      this.silhouette(c, 0);
      c.setGlowMul(1);
      // Motion weights of a lab model (`eldarin`'s sleep, wing spread...) are zeroed when the segment changes
      const act = c.act;
      for (const k of Object.keys(act)) act[k] = 0;
      for (const gm of c.glows) gm.opacity = 1;
      for (const m of c.outlines) m.visible = true;
    }
  }

  /** Press a spirit to a single color (amt 0 to 1); call it every frame after update so blinking / hit flash does not overwrite it */
  silhouette(c: Creature, amt: number, color: THREE.ColorRepresentation = 0x06040f): void {
    // applyFlash blackens the new model's eye highlights and gems (flashHooks) along with the rest
    c.applyFlash(color, amt);
  }

  /** Eyelids: 0 closed, 1 open (call after update) */
  eyelids(c: Creature, open: number): void {
    for (const e of c.eyes) e.scale.y = Math.max(0.04, open);
  }

  // ───────────────────────── Mood, camera, grading ─────────────────────────

  mood(a: Mood, b: Mood = a, k = 0): void {
    const u = this.skyMat.uniforms;
    lerpColor(u.uTop.value, _c1.set(a.top), _c2.set(b.top), k);
    lerpColor(u.uMid.value, _c1.set(a.mid), _c2.set(b.mid), k);
    lerpColor(u.uBot.value, _c1.set(a.bot), _c2.set(b.bot), k);
    u.uStars.value = lerp(a.stars, b.stars, k);
    u.uNebula.value = lerp(a.nebula, b.nebula, k);
    u.uSmoke.value = lerp(a.smoke, b.smoke, k);
    u.uClouds.value = lerp(a.day, b.day, k);
    const g = this.ground.mat.uniforms;
    g.uDay.value = lerp(a.day, b.day, k);
    lerpColor(g.uHorizon.value, _c1.set(a.horizon), _c2.set(b.horizon), k);
    LIGHT.ambient.value.set(lerp(a.ambient[0], b.ambient[0], k), lerp(a.ambient[1], b.ambient[1], k), lerp(a.ambient[2], b.ambient[2], k));
    LIGHT.rimColor.value.set(lerp(a.rim[0], b.rim[0], k), lerp(a.rim[1], b.rim[1], k), lerp(a.rim[2], b.rim[2], k));
    LIGHT.shadowTint.value.set(lerp(a.shadow[0], b.shadow[0], k), lerp(a.shadow[1], b.shadow[1], k), lerp(a.shadow[2], b.shadow[2], k));
  }

  /** A halo in some direction of the sky (the heart, dawn) */
  skyGlow(color: THREE.ColorRepresentation, amt: number, dir: THREE.Vector3): void {
    const u = this.skyMat.uniforms;
    u.uGlow.value.set(color);
    u.uGlowAmt.value = amt;
    u.uGlowDir.value.copy(dir);
  }

  cam(lt: number, keys: CamKey[]): void {
    this.fov = camAt(lt, keys, this.rig.pos, this.rig.look);
  }

  /** Set the zoom factor directly (a camera that does not use keyframes) */
  zoom(s: number): void {
    this.fov = s;
  }

  bloom(v: number): void {
    this.stage.bloom.strength = v;
  }

  /** Light up a patch of ground (the dragon under the gate, the lanterns) */
  groundLight(x: number, y: number, z: number, amt: number, color?: THREE.ColorRepresentation): void {
    const u = this.ground.mat.uniforms;
    u.uLit.value.set(x, y, z, amt);
    if (color !== undefined) u.uLitCol.value.set(color);
  }

  // ───────────────────────── Timeline ─────────────────────────

  private beat(): Beat | null {
    return this.beatIdx >= 0 ? BEAT_DEFS[this.beatIdx] : null;
  }

  private enterBeat(i: number): void {
    this.beat()?.leave?.(this);
    this.beatIdx = i;
    this.mem = {};
    // Every segment is set up from a clean state
    this.vfx.clear();
    this.hideAllCreatures();
    for (const f of Object.values(this.people)) {
      f.g.visible = false;
      f.rest();
    }
    for (const s of Object.values(this.sigils)) s.material.opacity = 0;
    for (const s of this.shards) {
      s.g.visible = false;
      s.trail.visible = false;
    }
    for (const pl of this.pillars) pl.mesh.visible = false;
    for (const tr of this.torrents) tr.mesh.visible = false;
    this.wound.visible = false;
    this.chamber.visible = false;
    this.valley.group.visible = false;
    this.valley.birdGroup.visible = true;
    this.sky.visible = true;
    this.ground.mesh.visible = true;
    this.skyMat.uniforms.uCrack.value = 0;
    this.skyMat.uniforms.uGlowAmt.value = 0;
    this.gate.portal.uniforms.uIgnite.value = 1;
    this.gate.portal.uniforms.uRim.value = 0;
    this.gate.beamMat.opacity = 0;
    const gu = this.ground.mat.uniforms;
    gu.uLit.value.w = 0;
    gu.uRivers.value = 0;
    gu.uCracks.value = 0;
    gu.uBlight.value = 0;
    gu.uFog.value.set(45, 140);
    gu.uLitR.value = 12;
    gu.uStain.value.set(0, 0, 0, 0);
    gu.uVeins.value = 0;
    const g = this.stage.grade;
    g.desat = 0;
    g.invert = 0;
    g.grain = 0;
    g.radial = 0;
    g.tint.set(1, 1, 1);
    g.lift.set(0, 0, 0);
    g.vignette = 0.45;
    g.vigCenter.set(0.5, 0.5);
    g.isolate = 0;
    g.letterbox = 1;
    this.rig.trauma = 0;
    this.rig.roll = 0;
    this.fov = 1;
    BEAT_DEFS[i].enter(this);
  }

  start(): void {
    this.running = true;
  }

  /** Skip: stop the timeline (the picture is handed to React to fade out) */
  stop(): void {
    this.running = false;
  }

  /** For development: fast-forward from the start of the current segment to target in steps of 1/60 s, then stop (for checking the storyboard with screenshots) */
  seek(target: number): void {
    let bi = 0;
    for (let i = 0; i < BEATS.length; i++) if (BEATS[i].start <= target) bi = i;
    this.t = BEATS[bi].start;
    this.lineIdx = -1;
    this.enterBeat(bi);
    this.running = true;
    while (this.t < target - 1e-6) this.frame(Math.min(1 / 60, target - this.t));
    this.running = false;
    this.frame(0);
  }

  private frame(realDt: number): void {
    // When stopped (the fade-out after a skip, the screenshot after a fast-forward) the picture is frozen and nothing advances any more
    if (!this.running && realDt > 0) return;
    if (this.running) this.t += realDt;
    const t = this.t;
    while (this.beatIdx + 1 < BEAT_DEFS.length && t >= BEATS[this.beatIdx + 1].start) this.enterBeat(this.beatIdx + 1);
    const beat = this.beat();
    const lt = t - BEATS[this.beatIdx].start;
    this.skyMat.uniforms.uTime.value = t;
    this.ground.mat.uniforms.uTime.value = t;
    this.gate.portal.uniforms.uTime.value = t;
    this.heart.mat.uniforms.uTime.value = t;
    this.woundMat.uniforms.uTime.value = t;
    for (const tr of this.torrents) tr.mat.uniforms.uTime.value = t;
    this.tw.update(realDt, realDt, realDt);
    for (const c of this.creatures.values()) if (c.root.visible) c.update(realDt);
    for (const f of Object.values(this.people)) if (f.g.visible) f.update(realDt);
    beat?.tick(this, lt, realDt);
    this.vfx.camPos.copy(this.rig.pos);
    this.ground.mat.uniforms.uCamPos.value.copy(this.rig.pos);
    this.vfx.update(realDt);
    this.rig.update(realDt, realDt);
    if (this.stage.fovScale !== this.fov) this.stage.setFovScale(this.fov);
    // Narration
    let li = -1;
    for (let i = 0; i < LINES.length; i++) if (t >= LINES[i].at && t < LINES[i].end) li = i;
    if (li !== this.lineIdx) {
      this.lineIdx = li;
      this.ev.onLine(li >= 0 ? LINES[li] : null);
    }
    (window as unknown as { __prologue: unknown }).__prologue = { beat: BEATS[this.beatIdx].id, t: +t.toFixed(2), phase: this.running ? 'play' : t >= TOTAL ? 'done' : 'stop', fps: Math.round(this.stage.fps) };
    if (this.running && t >= TOTAL) {
      this.running = false;
      this.ev.onDone();
    }
  }

  dispose(): void {
    this.off();
    window.removeEventListener('resize', this.onResize);
    this.beat()?.leave?.(this);
    this.tw.clear();
    this.vfx.clear();
    for (const c of this.creatures.values()) c.dispose();
    for (const s of this.shards) s.dispose();
    for (const f of Object.values(this.people)) f.av.dispose();
    this.stage.scene.remove(this.root);
    disposeTree(this.root);
    LIGHT.ambient.value.copy(this.lightBackup.ambient);
    LIGHT.rimColor.value.copy(this.lightBackup.rim);
    LIGHT.shadowTint.value.copy(this.lightBackup.shadow);
    LIGHT.dir.value.copy(this.lightBackup.dir);
    this.stage.resetCinematic();
    this.stage.bloom.strength = this.stage.bloomBase;
  }
}
