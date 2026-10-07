// The field exploration scene: terrain, grass sea, props, towns, the Seal Tower, treasure chests, residents and wild spirits;
// third-person camera and character movement (input comes from the UI component), and it notifies the UI when the player
// touches a wild spirit or presses the interact key.

import * as THREE from 'three';
import { MenuScene } from '../scenes.ts';
import { PALETTES, type Palette, type RegionId } from '../arena.ts';
import { LIGHT } from '../toon.ts';
import { sceneMaterial } from '../spiritToon.ts';
import { inkScenery } from '../ink.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { blobShadowTex } from '../textures.ts';
import { buildCreature } from '../species.ts';
import type { Creature } from '../creature.ts';
import type { Stage } from '../stage.ts';
import { rng } from '../arenaKit.ts';
import { getSpirit, stageForLevel } from '../../data.ts';
import { REGIONS, type NpcDef } from '../../game/campaign.ts';
import { rollWild, type WildSpawn } from '../../game/field.ts';
import { Avatar, blobShadow, npcOutfit, type Outfit } from './avatar.ts';
import { compose, smooth, type Composed } from './compose.ts';
import { Solids, type Biome, type FieldCtx } from './kit.ts';
import { VBatch } from './vbatch.ts';
import { Grass } from './grass.ts';
import { Terrain, buildWater } from './terrain.ts';
import { Tower } from './tower.ts';
import { ease } from '../tween.ts';

export interface WildSave {
  key: number;
  spawn: WildSpawn;
  zone: number;
  x: number;
  z: number;
}

/** State kept when leaving the field (into a battle or the tower), so the player can pick up where they left off on return */
export interface FieldSession {
  x: number;
  z: number;
  yaw: number;
  camYaw: number;
  camPitch: number;
  camDist: number;
  wilds: WildSave[];
  seq: number;
  /** The destination being auto-navigated to when the player left (resumed after returning from battle) */
  nav?: NavGoal;
}

/** An auto-navigation destination: walk until within `arrive` meters of (x, z) */
export interface NavGoal {
  x: number;
  z: number;
  label: string;
  arrive: number;
}

/** A place on the world map that can be clicked */
export interface MapMark extends NavGoal {
  kind: 'tower' | 'town' | 'waypoint' | 'chest' | 'npc';
}

export type Interact =
  | { kind: 'tower'; label: string }
  | { kind: 'chest'; id: number; label: string }
  | { kind: 'npc'; id: number; label: string }
  | { kind: 'waypoint'; label: string };

export interface FieldOpts {
  regionIdx: number;
  region: RegionId;
  biome: Biome;
  floors: number;
  floorsDone: number;
  openedChests: boolean[];
  npcs: NpcDef[];
  lead: { speciesId: string; stage: 1 | 2 | 3 } | null;
  outfit: Outfit;
  session: FieldSession | null;
  low: boolean;
  onEncounter: (w: WildSave) => void;
}

export interface WildLabel {
  key: number;
  x: number;
  y: number;
  name: string;
  level: number;
  corrupted: boolean;
  alert: boolean;
  dist: number;
}

type WildState = 'idle' | 'wander' | 'flee' | 'chase' | 'approach' | 'notice';

interface Wild {
  key: number;
  spawn: WildSpawn;
  zone: number;
  c: Creature;
  x: number;
  z: number;
  heading: number;
  state: WildState;
  timer: number;
  tx: number;
  tz: number;
  fly: number;
  /** How much a spirit has noticed the player (the exclamation mark above its head) */
  alert: number;
  radius: number;
  shadow: THREE.Mesh;
}

interface Chest {
  group: THREE.Group;
  lid: THREE.Group;
  glow: THREE.Mesh;
  x: number;
  z: number;
  open: boolean;
}

const WALK = 6.2;
const RUN = 10.5;
/** Start and end distances (world units) where the scene outline fades with distance */
const FIELD_INK_NEAR = 18;
const FIELD_INK_FAR = 80;

export class FieldScene extends MenuScene {
  readonly o: FieldOpts;
  readonly comp: Composed;
  readonly terrain: Terrain;
  readonly layout: Biome['layout'];
  readonly palette: Palette;
  private solids = new Solids();
  private grass: Grass | null = null;
  private waterUpdate: ((t: number) => void) | null = null;
  private waterDispose: (() => void) | null = null;
  readonly waterLevel: number;
  /** Color of the water (or lava) on the minimap, sRGB 0-1 */
  private mapWater: [number, number, number] = [0.25, 0.55, 0.85];
  private tower: Tower;
  private extras: FieldCtx['extras'] = [];
  private disposers: (() => void)[] = [];
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  /** The scene outline fade distances before entering the scene, restored on leave */
  private inkPrev: [number, number];

  // Player
  player: Avatar;
  pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private vy = 0;
  yaw = 0;
  private playerShadow: THREE.Mesh;
  private follower: Creature | null = null;
  private followPos = new THREE.Vector3();
  private trail: THREE.Vector3[] = [];

  // Camera
  camYaw = 0;
  camPitch = 0.36;
  camDist = 11;
  private camTarget = new THREE.Vector3();
  /** How far the camera is pulled in when a building blocks it (pulled in at once on contact, eased back out after leaving) */
  private camReach = 99;
  private lastManualCam = -10;
  /** A fixed camera (dev viewer, cutscenes); when null it follows the character */
  camOverride: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;

  /** Written every frame by the UI component: x right, z forward (-1 to 1); run is sprint, jump is jump (the frame it is pressed) */
  input = { x: 0, z: 0, run: false, jump: false };
  /** Pause movement (dialogue, encounter cutscene) */
  frozen = false;
  /** Auto-navigation: follow the waypoints; any arrow-key press by the player cancels it */
  private navState: (NavGoal & { pts: [number, number][]; i: number; stuck: number; replans: number; avoid: [number, number][]; look: number; final: boolean }) | null = null;
  /**
   * Why navigation ended (the UI component clears it to null after reading): arrived means it got there,
   * blocked means it was stopped and cannot continue
   */
  navEnd: 'arrived' | 'blocked' | null = null;

  private wilds: Wild[] = [];
  private seq = 1;
  private spawnT: number[] = [];
  /** For the first few seconds after entering (or returning from battle), spirits do not notice the hero and touching one does not start a battle */
  private grace = 2.5;
  private chests: Chest[] = [];
  private npcs: { a: Avatar; x: number; z: number; face: number; shadow: THREE.Mesh }[] = [];
  private waypoint: THREE.Group;
  private waypointMat: THREE.MeshBasicMaterial;
  near: Interact | null = null;
  private moteT = 0;
  private shadowTex = blobShadowTex();
  private encountering = false;
  /** Radius of the Void Blight erosion (centered on the Seal Tower) */
  erodeR = 0;
  private rnd = Math.random;

  constructor(stage: Stage, o: FieldOpts) {
    super(stage);
    this.o = o;
    const biome = o.biome;
    this.layout = biome.layout;
    const L = this.layout;
    const base = PALETTES[o.region];
    this.palette = { ...base, ...biome.palette };
    const P = this.palette;
    LIGHT.dir.value.set(...P.light).normalize();
    LIGHT.ambient.value.set(P.ambient);
    LIGHT.rimColor.value.set(P.rim);
    LIGHT.shadowTint.value.set(P.shadow);
    const [fogNear, fogFar] = biome.fog ?? [70, 260];
    stage.scene.fog = new THREE.Fog(new THREE.Color(P.fog), fogNear, fogFar);
    stage.camera.far = 1400;
    stage.camera.updateProjectionMatrix();
    stage.setFovScale(stage.container.clientWidth < stage.container.clientHeight ? 1.08 : 1.42);
    // The field camera sits about 11 meters from the hero (5.5-22), seeing farther than in battle:
    // the scene outline starts fading at FIELD_INK_NEAR and drops to 35% at FIELD_INK_FAR
    const ink = stage.ink.core.style;
    this.inkPrev = [ink.sceneNear, ink.sceneFar];
    ink.sceneNear = FIELD_INK_NEAR;
    ink.sceneFar = FIELD_INK_FAR;

    // ── Terrain
    this.comp = compose(biome);
    const C = biome.cols;
    const cGrass = new THREE.Color(C.grass);
    const cGrass2 = new THREE.Color(C.grass2);
    const cPath = new THREE.Color(C.path);
    const cCliff = new THREE.Color(C.cliff);
    const cSand = new THREE.Color(C.sand ?? C.path);
    const cPlaza = new THREE.Color(C.plaza ?? C.path);
    this.waterLevel = biome.water ? biome.water.level : -Infinity;
    if (biome.water) {
      const w = biome.water;
      const hex = (c: number, k: number) => ((c >> k) & 255) / 255;
      const mix = (k: number) => hex(w.shallow, k) * 0.4 + hex(w.deep, k) * 0.6;
      this.mapWater = w.lava ? [0.98, 0.45, 0.12] : [mix(16), mix(8), mix(0)];
    }
    const wl = this.waterLevel;
    const noise = (x: number, z: number) => Math.sin(x * 0.13 + Math.sin(z * 0.07) * 2) * Math.cos(z * 0.11 + Math.sin(x * 0.05) * 2);
    this.terrain = new Terrain({
      size: L.size,
      seg: Math.round(L.size * (o.low ? 1.4 : 2)),
      height: this.comp.height,
      color: (x, z, h, slope, out) => {
        out.copy(cGrass).lerp(cGrass2, smooth(-0.4, 0.6, noise(x, z)));
        const pd = this.comp.pathDist(x, z);
        const pw = L.pathW;
        out.lerp(cPath, 1 - smooth(pw * 0.55, pw + 0.9 + noise(x * 3, z * 3) * 0.6, pd));
        const dt = Math.hypot(x - L.town[0], z - L.town[1]);
        out.lerp(cPlaza, (1 - smooth(L.townR * 0.55, L.townR * 0.7, dt)) * 0.85);
        const dw = Math.hypot(x - L.tower[0], z - L.tower[1]);
        out.lerp(cPlaza, (1 - smooth(15, 19, dw)) * 0.8);
        if (h < wl + 0.9) out.lerp(cSand, smooth(wl + 0.9, wl + 0.2, h));
        out.lerp(cCliff, smooth(0.55, 0.95, slope));
        biome.paint?.(x, z, h, slope, out);
      },
    });
    this.root.add(this.terrain.mesh);
    let waterMesh: THREE.Mesh | null = null;
    if (biome.water) {
      const w = buildWater(this.terrain, biome.water);
      waterMesh = w.mesh;
      this.root.add(w.mesh);
      this.waterUpdate = w.update;
      this.waterDispose = w.dispose;
    }

    // ── Sky (a large dome that follows the camera: gradient, sun glow, slowly drifting clouds)
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(P.sky[0]) },
        mid: { value: new THREE.Color(P.sky[1]) },
        bot: { value: new THREE.Color(P.sky[2]) },
        sunDir: { value: new THREE.Vector3(...P.light).normalize() },
        uTime: { value: 0 },
        uStars: { value: P.stars ? 1 : 0 },
        uFog: { value: new THREE.Color(P.fog) },
      },
      vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; uniform float uTime; uniform float uStars; uniform vec3 uFog;
        varying vec3 vP;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
        float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += vnoise(p) * a; p *= 2.03; a *= 0.5; } return s; }
        void main(){
          float h = vP.y;
          vec3 c = h > 0.1 ? mix(mid, top, smoothstep(0.1, 0.75, h)) : mix(bot, mid, smoothstep(-0.08, 0.1, h));
          float sd = max(dot(vP, normalize(sunDir)), 0.0);
          c += vec3(1.0, 0.92, 0.75) * (pow(sd, 400.0) * 1.2 + pow(sd, 18.0) * 0.18) * (1.0 - uStars);
          // Clouds: fbm projected onto the sky plane
          if (h > 0.02) {
            vec2 uv = vP.xz / (h + 0.18) * 1.4 + vec2(uTime * 0.012, uTime * 0.004);
            float cl = smoothstep(0.52, 0.78, fbm(uv));
            float lit = 0.85 + 0.25 * sd;
            c = mix(c, mix(mid, vec3(1.0), 0.75) * lit, cl * smoothstep(0.02, 0.25, h) * 0.8 * (1.0 - uStars * 0.7));
          }
          if (uStars > 0.5 && h > 0.1) {
            vec2 q = floor(vP.xz / (h + 0.3) * 160.0);
            float s = hash(q);
            c += vec3(step(0.996, s)) * (0.6 + 0.4 * sin(uTime * 2.0 + s * 50.0)) * smoothstep(0.1, 0.4, h);
          }
          // Blends into the fog color near the horizon
          c = mix(c, uFog, smoothstep(0.16, -0.04, h) * 0.85);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat);
    this.sky.renderOrder = -10;
    this.root.add(this.sky);
    const hemi = new THREE.HemisphereLight(new THREE.Color(P.sky[1]), new THREE.Color(C.grass2), 1.4);
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(...P.light);
    this.root.add(hemi, sun);

    // ── Region props: colors are written into vertex colors, and each chunk is merged into just three meshes, so more colors never add draw calls
    const b = new VBatch(36);
    const r = rng(o.regionIdx * 977 + 13);
    const group = new THREE.Group();
    this.root.add(group);
    const avoid: [number, number, number][] = [
      [L.town[0], L.town[1], L.townR + 2],
      [L.tower[0], L.tower[1], 22],
      [L.waypoint[0], L.waypoint[1], 4],
      ...L.chests.map(([x, z]) => [x, z, 3] as [number, number, number]),
      ...L.npcs.map(([x, z]) => [x, z, 2] as [number, number, number]),
    ];
    const h = (x: number, z: number) => this.terrain.heightAt(x, z);
    const ctx: FieldCtx = {
      layout: L,
      terrain: this.terrain,
      h,
      b,
      place: (x, z, spread = 0) => {
        let m = h(x, z);
        if (spread > 0) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) m = Math.min(m, h(x + dx * spread, z + dz * spread));
        b.lift = m;
        return m;
      },
      solids: this.solids,
      r,
      group,
      extras: this.extras,
      disposers: this.disposers,
      pathDist: this.comp.pathDist,
      clear: (x, z, margin = 0) => this.comp.pathDist(x, z) > L.pathW + 1.5 + margin && avoid.every(([ax, az, ar]) => Math.hypot(x - ax, z - az) > ar + margin),
      scatter: (n, [x0, x1, z0, z1], margin, fn) => {
        let placed = 0;
        for (let tries = 0; placed < n && tries < n * 12; tries++) {
          const x = x0 + r() * (x1 - x0);
          const z = z0 + r() * (z1 - z0);
          if (!ctx.clear(x, z, margin)) continue;
          if (h(x, z) < wl + 0.3) continue;
          fn(x, z, placed++);
        }
      },
      low: o.low,
      waterLevel: wl,
      water: waterMesh,
      done: o.floorsDone,
      floors: o.floors,
    };
    biome.decorate(ctx);
    b.lift = 0;
    b.build(group);
    this.disposers.push(() => b.dispose());
    // Beyond the fog's far distance only the fog color remains, so hiding a whole chunk makes no visible difference
    // Prop chunks that fog swallows by 60% or more get no outline: the lines fade to invisible with the fog,
    // and the normal pass also skips these chunks (the fog is changed by weather, so it is computed from the current fog every frame)
    this.extras.push((_dt, _t, vfx) => {
      const f = stage.scene.fog as THREE.Fog | null;
      b.cull(vfx.camPos, fogFar, f?.isFog ? f.near + (f.far - f.near) * 0.6 : Infinity);
    });

    // ── Grass sea
    const gs = biome.grass;
    if (gs !== false) {
      const tipCol = gs?.tip ?? new THREE.Color(C.grass).lerp(new THREE.Color(0xfff2a0), 0.35).getHex();
      this.grass = new Grass(this.terrain, {
        density: (gs?.density ?? 1.1) * (o.low ? 0.4 : 1),
        height: gs?.height,
        range: o.low ? 38 : 58,
        tip: tipCol,
        seed: o.regionIdx * 31 + 5,
        cover: (x, z, hh, slope) => {
          if (hh < wl + 0.35) return 0;
          const pd = this.comp.pathDist(x, z);
          if (pd < L.pathW + 0.6) return 0;
          if (Math.hypot(x - L.town[0], z - L.town[1]) < L.townR * 0.72) return 0;
          if (Math.hypot(x - L.tower[0], z - L.tower[1]) < 19) return 0;
          if (this.solids.blocked(x, z, 0.2)) return 0;
          const edge = 1 - smooth(L.pathW + 0.6, L.pathW + 3, pd);
          const base = (1 - smooth(0.45, 0.75, slope)) * (1 - edge * 0.7);
          if (gs?.cover) return base * gs.cover(x, z, hh, slope);
          return base * (0.55 + 0.45 * smooth(-0.6, 0.4, noise(x * 1.3, z * 1.3)));
        },
        color: gs?.color ?? ((x, z, out) => void out.copy(cGrass).lerp(cGrass2, smooth(-0.4, 0.6, noise(x, z)))),
      });
      this.root.add(this.grass.group);
    }

    // ── Seal Tower (door facing the town)
    const [tx, tz] = L.tower;
    const face = Math.atan2(L.town[0] - tx, L.town[1] - tz);
    this.tower = new Tower(tx, h(tx, tz), tz, face, o.floors, biome.tower);
    this.tower.setProgress(o.floorsDone, o.floors);
    this.root.add(this.tower.group);
    this.solids.add(tx, tz, this.tower.radius);

    // ── Void Blight erosion: spreads outward from the Seal Tower whose seal has loosened; it recedes a little with each
    // floor broken through, and disappears once all are broken through
    const maxR = Math.min(L.size * 0.55, 72);
    this.erodeR = o.floorsDone >= o.floors ? 0 : 22 + (maxR - 22) * (1 - o.floorsDone / o.floors);
    this.terrain.setErosion(tx, tz, this.erodeR, 1);
    this.grass?.setErosion(tx, tz, this.erodeR, 1);
    if (this.erodeR > 0) this.buildVoidCrystals(tx, tz, this.erodeR);

    // ── Teleport circle (back to the world map)
    this.waypoint = new THREE.Group();
    const [wx, wz] = L.waypoint;
    this.waypoint.position.set(wx, h(wx, wz) + 0.05, wz);
    const wpBaseMat = sceneMaterial(biome.tower.stone, { rim: 0.35 });
    const wpBase = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.3, 24), wpBaseMat);
    wpBase.position.y = 0.1;
    inkScenery(wpBase);
    this.disposers.push(() => {
      wpBase.geometry.dispose();
      wpBaseMat.dispose();
    });
    this.waypointMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(biome.tower.glow).multiplyScalar(1.6), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const wpRing = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.8, 40), this.waypointMat);
    wpRing.rotation.x = -Math.PI / 2;
    wpRing.position.y = 0.27;
    const wpCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), this.waypointMat);
    wpCore.position.y = 2.1;
    wpCore.name = 'core';
    this.waypoint.add(wpBase, wpRing, wpCore);
    this.root.add(this.waypoint);

    // ── Treasure chest
    L.chests.forEach(([x, z], i) => this.chests.push(this.buildChest(x, z, o.openedChests[i] ?? false)));

    // ── Residents
    o.npcs.forEach((npc, i) => {
      const spot = L.npcs[i];
      if (!spot) return;
      const a = new Avatar(npcOutfit(npc.look));
      a.root.position.set(spot[0], h(spot[0], spot[1]), spot[1]);
      a.root.rotation.y = spot[2];
      const sh = blobShadow(this.shadowTex, 1.2);
      sh.position.set(spot[0], h(spot[0], spot[1]) + 0.04, spot[1]);
      this.root.add(a.root, sh);
      this.solids.add(spot[0], spot[1], 0.5);
      this.npcs.push({ a, x: spot[0], z: spot[1], face: spot[2], shadow: sh });
    });

    // ── Hero and companions
    this.player = new Avatar(o.outfit);
    this.root.add(this.player.root);
    this.playerShadow = blobShadow(this.shadowTex, 1.3);
    this.root.add(this.playerShadow);
    const s = o.session;
    if (s) {
      this.pos.set(s.x, h(s.x, s.z), s.z);
      this.yaw = s.yaw;
      this.camYaw = s.camYaw;
      this.camPitch = s.camPitch;
      this.camDist = s.camDist;
      this.seq = s.seq;
    } else {
      const [sx, sz, sf] = L.spawn;
      this.pos.set(sx, h(sx, sz), sz);
      this.yaw = sf;
      this.camYaw = sf + Math.PI;
    }
    if (o.lead) {
      const f = buildCreature(o.lead.speciesId, o.lead.stage, getSpirit(o.lead.speciesId).rarity);
      f.root.scale.multiplyScalar(0.82);
      this.follower = f;
      this.followPos.copy(this.pos).add(new THREE.Vector3(Math.sin(this.yaw) * 2, 0, Math.cos(this.yaw) * 2));
      f.root.position.copy(this.followPos);
      const sh = blobShadow(this.shadowTex, f.width * 1.1);
      sh.position.y = 0.04 - f.root.position.y;
      f.root.add(sh);
      this.root.add(f.root);
      this.creatures.push(f);
    }
    this.camTarget.copy(this.pos).add(new THREE.Vector3(0, 1.5, 0));

    // ── Wild spirits
    this.spawnT = L.zones.map(() => 0);
    if (s) {
      for (const w of s.wilds) this.addWild(w.spawn, w.zone, w.x, w.z, w.key);
    } else {
      L.zones.forEach((zn, zi) => {
        for (let i = 0; i < zn.count; i++) this.spawnIn(zi, true);
      });
    }
    this.placeCamera(0, true);
    if (s?.nav) this.navigate(s.nav);
  }

  // ───────────────────────── Build ─────────────────────────

  private buildChest(x: number, z: number, open: boolean): Chest {
    const g = new THREE.Group();
    const y = this.terrain.heightAt(x, z);
    g.position.set(x, y, z);
    g.rotation.y = Math.atan2(this.layout.town[0] - x, this.layout.town[1] - z) + (x % 1);
    const wood = sceneMaterial(0x8a4a2a, { rim: 0.35 });
    const gold = sceneMaterial(0xf2c24a, { rim: 0.5, surface: 'metal', emissive: 0x4a3200, emissiveAmt: 1 });
    this.disposers.push(() => {
      wood.dispose();
      gold.dispose();
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), wood);
    body.position.y = 0.35;
    g.add(body);
    for (const sx of [-0.45, 0.45]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.74, 0.84), gold);
      band.position.set(sx, 0.35, 0);
      g.add(band);
    }
    const lid = new THREE.Group();
    lid.position.set(0, 0.7, -0.4);
    const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12, 1, false, 0, Math.PI), wood);
    lidMesh.rotation.z = Math.PI / 2;
    lidMesh.rotation.y = Math.PI / 2;
    lidMesh.position.set(0, 0, 0.4);
    lid.add(lidMesh);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.08), gold);
    lock.position.set(0, -0.02, 0.82);
    lid.add(lock);
    g.add(lid);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 16, 12),
      new THREE.MeshBasicMaterial({ map: blobShadowTex(), color: 0xffd86a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    glow.scale.set(1, 0.5, 1);
    glow.position.y = 0.6;
    g.add(glow);
    const sh = blobShadow(this.shadowTex, 2);
    sh.position.y = 0.03;
    g.add(sh);
    if (open) {
      lid.rotation.x = -1.9;
      glow.visible = false;
    }
    // The chest body, metal bands and lid go through the scene outline; the glow and shadow are translucent, so inkScenery skips them automatically
    inkScenery(g);
    this.root.add(g);
    this.solids.add(x, z, 0.8);
    return { group: g, lid, glow, x, z, open };
  }

  /** Void crystal clusters growing in the erosion area: black-purple crystals with a magenta glow at the center */
  private buildVoidCrystals(cx: number, cz: number, R: number): void {
    const body: THREE.BufferGeometry[] = [];
    const cores: THREE.BufferGeometry[] = [];
    const r = rng(this.o.regionIdx * 53 + 1);
    const n = Math.round((this.o.low ? 30 : 60) * (R / 60));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0, tries = 0; i < n && tries < n * 8; tries++) {
      const a = r() * Math.PI * 2;
      const d = 14 + Math.sqrt(r()) * (R - 16);
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const big = r() < 0.25;
      // Large clusters must stay farther from buildings and props, so they do not poke into a tent or house
      if (this.comp.pathDist(x, z) < this.layout.pathW + 1.5 || this.solids.blocked(x, z, big ? 4 : 2)) continue;
      if (this.terrain.heightAt(x, z) < this.waterLevel + 0.2) continue;
      i++;
      const y = this.terrain.heightAt(x, z);
      const k = big ? 1.4 + r() * 1.2 : 0.5 + r() * 0.6;
      const shards = big ? 5 : 3;
      for (let j = 0; j < shards; j++) {
        const g = new THREE.OctahedronGeometry(1, 0);
        const len = k * (j === 0 ? 2.2 : 1.1 + r() * 0.9);
        g.scale(k * 0.4, len, k * 0.4);
        g.translate(0, len * 0.5, 0);
        q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.9, r() * 6, (r() - 0.5) * 0.9));
        m.compose(new THREE.Vector3(x + (r() - 0.5) * k, y - 0.1, z + (r() - 0.5) * k), q, new THREE.Vector3(1, 1, 1));
        body.push(g.clone().applyMatrix4(m));
        cores.push(g.scale(0.42, 0.75, 0.42).applyMatrix4(m));
      }
      if (big) this.solids.add(x, z, k * 0.8);
    }
    if (!body.length) return;
    // An octahedron has no index to begin with, so merge it directly
    const merged = mergeGeometries(body);
    const coreMerged = mergeGeometries(cores);
    if (!merged || !coreMerged) return;
    merged.computeVertexNormals();
    const mat = sceneMaterial(0x24103a, { rim: 0.9, emissive: 0x5a0a5a, emissiveAmt: 0.3 });
    const mesh = new THREE.Mesh(merged, mat);
    inkScenery(mesh);
    const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.2, 1.3), toneMapped: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(coreMerged, coreMat);
    this.root.add(mesh, core);
    this.extras.push((_dt, t) => (coreMat.opacity = 0.6 + Math.sin(t * 2.3) * 0.25));
    this.disposers.push(() => {
      merged.dispose();
      coreMerged.dispose();
      mat.dispose();
      coreMat.dispose();
    });
  }

  private addWild(spawn: WildSpawn, zone: number, x: number, z: number, key?: number): Wild {
    const c = buildCreature(spawn.speciesId, stageForLevel(spawn.level), getSpirit(spawn.speciesId).rarity, { corrupted: spawn.corrupted });
    c.root.scale.multiplyScalar(0.9);
    const fly = c.archetype === 'bird' ? 1.3 : c.archetype === 'float' ? 0.5 : 0;
    const sh = blobShadow(this.shadowTex, Math.max(1, c.width * 1.1));
    this.root.add(c.root, sh);
    this.creatures.push(c);
    const w: Wild = {
      key: key ?? this.seq++,
      spawn,
      zone,
      c,
      x,
      z,
      heading: Math.random() * Math.PI * 2,
      state: 'idle',
      timer: 1 + Math.random() * 3,
      tx: x,
      tz: z,
      fly,
      alert: 0,
      radius: Math.max(0.5, c.width * 0.45),
      shadow: sh,
    };
    if (spawn.corrupted) {
      // Purple mist drifts around corrupted spirits
      c.root.userData.corrupt = true;
    }
    this.wilds.push(w);
    this.placeWild(w);
    return w;
  }

  private spawnIn(zi: number, anywhere = false): void {
    const zn = this.layout.zones[zi];
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * zn.r;
      const x = zn.x + Math.cos(a) * d;
      const z = zn.z + Math.sin(a) * d;
      if (!this.walkable(x, z, 0.8)) continue;
      if (Math.hypot(x - this.pos.x, z - this.pos.z) < (anywhere ? 14 : 28)) continue;
      // On land eroded by the Void Blight, most spirits are already corrupted
      const eroded = Math.hypot(x - this.layout.tower[0], z - this.layout.tower[1]) < this.erodeR - 4;
      // Once the Seal Tower is fully broken through, the Void Blight recedes from this area and only a few scattered corrupted spirits remain
      const purified = this.o.floorsDone >= this.o.floors;
      const corruptChance = purified ? (zn.corrupt ?? 0) * 0.2 : eroded ? Math.max(zn.corrupt ?? 0, 0.55) : zn.corrupt ?? 0;
      const spawn = rollWild(this.o.regionIdx, zn.tier, { species: zn.species, corruptChance });
      this.addWild(spawn, zi, x, z);
      return;
    }
  }

  private removeWild(w: Wild): void {
    this.root.remove(w.shadow);
    w.shadow.geometry.dispose();
    (w.shadow.material as THREE.Material).dispose();
    this.removeCreature(w.c);
    this.wilds = this.wilds.filter((x) => x !== w);
  }

  // ───────────────────────── Terrain queries ─────────────────────────

  private walkable(x: number, z: number, r = 0.45): boolean {
    const S = this.layout.size - 3;
    if (Math.abs(x) > S || Math.abs(z) > S) return false;
    if (this.terrain.heightAt(x, z) < this.waterLevel - 0.5) return false;
    if (this.comp.edge(x, z) > 0.35 && this.layout.edge === 'cliff') return false;
    if (this.layout.edge === 'void' && this.comp.edge(x, z) > 0.5) return false;
    return !this.solids.blocked(x, z, r);
  }

  /** Move from (x0, z0) to (x1, z1): slides along walls when blocked; returns the actual position */
  private step(x0: number, z0: number, x1: number, z1: number, r: number, climb = 1.1): [number, number] {
    const h0 = this.terrain.heightAt(x0, z0);
    const ok = (x: number, z: number) => {
      if (!this.walkable(x, z, 0)) return false;
      const d = Math.hypot(x - x0, z - z0);
      const dh = this.terrain.heightAt(x, z) - h0;
      return dh < climb * d + 0.02;
    };
    let x = x1;
    let z = z1;
    if (!ok(x, z)) {
      if (ok(x1, z0)) z = z0;
      else if (ok(x0, z1)) x = x0;
      else return [x0, z0];
    }
    const p = { x, z };
    this.solids.push(p, r);
    if (!ok(p.x, p.z)) return [x0, z0];
    return [p.x, p.z];
  }

  // ───────────────────────── Camera ─────────────────────────

  /** Drag to rotate the camera (pixels) */
  rotateCam(dx: number, dy: number): void {
    this.camYaw -= dx * 0.0055;
    this.camPitch = Math.min(1.15, Math.max(0.12, this.camPitch + dy * 0.004));
    this.lastManualCam = this.time;
  }

  zoomCam(d: number): void {
    this.camDist = Math.min(22, Math.max(5.5, this.camDist * (1 + d)));
  }

  private placeCamera(dt: number, snap = false): void {
    if (this.camOverride) {
      this.rig.pos.copy(this.camOverride.pos);
      this.rig.look.copy(this.camOverride.look);
      this.vfx.camPos.copy(this.camOverride.pos);
      return;
    }
    const goal = new THREE.Vector3(this.pos.x, this.pos.y + 1.45, this.pos.z);
    if (snap) this.camTarget.copy(goal);
    else this.camTarget.lerp(goal, 1 - Math.exp(-dt * 10));
    const t = this.camTarget;
    const cp = Math.cos(this.camPitch);
    // If a building (a large collider) lies between the camera and the hero, pull the camera in,
    // so it does not end up inside a house and black out the screen
    const sx = Math.sin(this.camYaw) * cp;
    const sz = Math.cos(this.camYaw) * cp;
    let reach = this.camDist;
    for (let d = 1.2; d < this.camDist; d += 0.5) {
      const x = t.x + sx * d;
      const z = t.z + sz * d;
      if (this.solids.near(x, z).some((o) => o.r >= 1.6 && Math.hypot(x - o.x, z - o.z) < o.r + 0.35 && Math.hypot(t.x - o.x, t.z - o.z) > o.r)) {
        reach = Math.max(2.6, d - 0.6);
        break;
      }
    }
    this.camReach = reach < this.camReach || snap ? reach : this.camReach + (reach - this.camReach) * (1 - Math.exp(-dt * 2.5));
    const dist = Math.min(this.camDist, this.camReach);
    // While pulled in by a blocker the camera also rises, looking down from above the shoulder instead of seeing only the back of the head
    const rise = Math.max(0, Math.min(this.camDist, 6) - dist) * 0.55;
    const cam = new THREE.Vector3(t.x + sx * dist, t.y + Math.sin(this.camPitch) * dist + rise, t.z + sz * dist);
    // Do not go through the ground or a cliff wall: search back along the camera line for the first position that clears the ground
    for (let k = 0; k < 8; k++) {
      const gh = this.terrain.heightAt(cam.x, cam.z) + 0.9;
      if (cam.y >= gh) break;
      cam.lerp(t, 0.18);
      cam.y = Math.max(cam.y, gh * 0.6 + cam.y * 0.4);
    }
    cam.y = Math.max(cam.y, this.terrain.heightAt(cam.x, cam.z) + 0.8);
    // The line of sight is raised a bit above the camera pitch: the hero lands in the lower third of the screen,
    // and the horizon and the distant tower stay in frame
    const dy = cam.y - t.y;
    const dh = Math.max(0.5, Math.hypot(cam.x - t.x, cam.z - t.z));
    const bias = 0.15 * (1 - THREE.MathUtils.smoothstep(this.camPitch, 0.5, 1.1));
    const look = Math.max(0, Math.atan2(dy, dh) - bias);
    this.rig.pos.copy(cam);
    this.rig.look.set(t.x, cam.y - dh * Math.tan(look), t.z);
    this.vfx.camPos.copy(cam);
  }

  // ───────────────────────── Per frame ─────────────────────────

  protected tick(dt: number, fxDt: number): void {
    dt = Math.min(dt, 0.05);
    this.updatePlayer(dt);
    this.updateFollower(dt);
    this.updateWilds(dt);
    this.updateNpcs(dt);
    this.updateInteract();
    this.placeCamera(dt);
    const t = this.time;
    this.sky.position.copy(this.rig.pos);
    this.skyMat.uniforms.uTime.value = t;
    this.terrain.setTime(t);
    this.waterUpdate?.(t);
    this.grass?.update(t, this.pos, this.follower ? this.followPos : this.pos, this.pos);
    const nearTower = Math.hypot(this.pos.x - this.layout.tower[0], this.pos.z - this.layout.tower[1]) < 90;
    this.tower.update(dt, t, this.vfx, nearTower);
    const core = this.waypoint.getObjectByName('core');
    if (core) {
      core.rotation.y += dt * 1.4;
      core.position.y = 2.1 + Math.sin(t * 2) * 0.2;
    }
    this.waypointMat.opacity = 0.6 + Math.sin(t * 2.4) * 0.2;
    for (const c of this.chests) {
      if (!c.open) {
        c.glow.scale.setScalar(1 + Math.sin(t * 3 + c.x) * 0.08);
        c.glow.scale.y *= 0.5;
      }
    }
    for (const e of this.extras) e(fxDt, t, this.vfx);
    this.emitMotes(fxDt);
  }

  private updatePlayer(dt: number): void {
    const inp = this.frozen ? { x: 0, z: 0, run: false, jump: false } : this.input;
    const fx = -Math.sin(this.camYaw);
    const fz = -Math.cos(this.camYaw);
    const rx = Math.cos(this.camYaw);
    const rz = -Math.sin(this.camYaw);
    let mx = fx * inp.z + rx * inp.x;
    let mz = fz * inp.z + rz * inp.x;
    const len = Math.hypot(mx, mz);
    let mag = Math.min(1, len);
    let run = inp.run;
    // Auto-navigation: hand control back as soon as the player acts, otherwise head for the next waypoint
    if (this.navState && len > 0.1) this.cancelNav();
    const steer = this.navState && !this.frozen ? this.steerNav() : null;
    if (steer) {
      [mx, mz, run] = steer;
      mag = 1;
    } else if (len > 0.01) {
      mx /= len;
      mz /= len;
    }
    const speed = (run ? RUN : WALK) * mag;
    const tvx = mx * speed;
    const tvz = mz * speed;
    const grounded = this.pos.y <= this.terrain.heightAt(this.pos.x, this.pos.z) + 0.02;
    const acc = grounded ? 14 : 4;
    this.vel.x += (tvx - this.vel.x) * Math.min(1, dt * acc);
    this.vel.z += (tvz - this.vel.z) * Math.min(1, dt * acc);
    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    const [px, pz] = this.step(this.pos.x, this.pos.z, nx, nz, 0.45, grounded ? 1.1 : 3);
    const moved = Math.hypot(px - this.pos.x, pz - this.pos.z) / Math.max(dt, 1e-4);
    this.pos.x = px;
    this.pos.z = pz;
    if (steer) this.checkStuck(dt, moved);
    // Jump and gravity
    const gh = this.terrain.heightAt(px, pz);
    if (inp.jump && grounded) this.vy = 7.2;
    this.input.jump = false;
    this.vy -= 24 * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= gh) {
      if (this.vy < -9) this.vfx.emit({ pos: this.pos.clone().setY(gh + 0.1), count: 8, color: [0xf2ead8, 0xd8ccb0], speed: [0.8, 2], life: [0.3, 0.6], size: [0.15, 0.3], sizeEnd: 1.5, dir: new THREE.Vector3(0, 0.3, 0), spread: 1 });
      this.pos.y = gh;
      this.vy = 0;
    }
    // Stick to the ground going downhill (do not stay airborne)
    if (this.vy === 0 && this.pos.y > gh && this.pos.y - gh < 0.5) this.pos.y = gh;
    if (mag > 0.05 && moved > 0.3) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 12);
    }
    this.player.root.position.copy(this.pos);
    this.player.root.rotation.y = this.yaw;
    this.player.speed = this.frozen ? 0 : Math.min(moved, RUN);
    this.player.air = this.pos.y > gh + 0.15;
    this.player.update(dt);
    this.playerShadow.position.set(this.pos.x, gh + 0.05, this.pos.z);
    this.playerShadow.scale.setScalar(Math.max(0.4, 1 - (this.pos.y - gh) * 0.15));
    // Kick up dust or grass bits under the feet when running
    if (moved > 8 && grounded && Math.random() < dt * 14) {
      this.vfx.emit({ pos: this.pos.clone().setY(gh + 0.1), count: 1, color: [0xe8e0c8, 0xc8d8a0], speed: [0.3, 0.8], life: [0.4, 0.7], size: [0.18, 0.3], sizeEnd: 1.6, dir: new THREE.Vector3(0, 1, 0), spread: 1 });
    }
    // The camera slowly swings behind the character (no automatic turning within 1.5 s of a manual camera turn)
    if (moved > 1 && this.time - this.lastManualCam > 1.5 && inp.z >= -0.2) {
      let d = this.yaw + Math.PI - this.camYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.camYaw += d * Math.min(1, dt * 0.9) * Math.min(1, Math.abs(inp.x) + (steer ? 0.6 : 0.25));
    }
    if (this.follower) {
      const last = this.trail[this.trail.length - 1];
      if (!last || last.distanceTo(this.pos) > 0.4) {
        this.trail.push(this.pos.clone());
        if (this.trail.length > 30) this.trail.shift();
      }
    }
  }

  private updateFollower(dt: number): void {
    const f = this.follower;
    if (!f) return;
    // Follows the trail point about 2.2 meters behind
    let target = this.trail[0] ?? this.pos;
    let acc = 0;
    for (let i = this.trail.length - 1; i > 0; i--) {
      acc += this.trail[i].distanceTo(this.trail[i - 1]);
      if (acc > 2.2) {
        target = this.trail[i - 1];
        break;
      }
    }
    const d = Math.hypot(target.x - this.followPos.x, target.z - this.followPos.z);
    if (d > 12) this.followPos.copy(target);
    const sp = d > 0.3 ? Math.min(d * 5, RUN + 1) : 0;
    if (d > 0.01) {
      const k = Math.min(1, (sp * dt) / d);
      const nx = this.followPos.x + (target.x - this.followPos.x) * k;
      const nz = this.followPos.z + (target.z - this.followPos.z) * k;
      if (sp > 0.2) f.root.rotation.y = Math.atan2(target.x - this.followPos.x, target.z - this.followPos.z);
      this.followPos.x = nx;
      this.followPos.z = nz;
    }
    const gh = this.terrain.heightAt(this.followPos.x, this.followPos.z);
    this.followPos.y = gh;
    const fly = f.archetype === 'bird' ? 1.1 + Math.sin(this.time * 2.2) * 0.15 : 0;
    f.root.position.set(this.followPos.x, gh + fly, this.followPos.z);
    const sh = f.root.children[f.root.children.length - 1];
    sh.position.y = (0.04 - fly) / f.root.scale.y;
    f.moving = Math.min(1, sp / 4);
  }

  private updateWilds(dt: number): void {
    const px = this.pos.x;
    const pz = this.pos.z;
    const running = this.player.speed > WALK + 0.5;
    this.grace -= dt;
    for (const w of [...this.wilds]) {
      const dx = px - w.x;
      const dz = pz - w.z;
      const dist = Math.hypot(dx, dz);
      const far = dist > 95;
      w.c.root.visible = !far;
      w.shadow.visible = !far;
      if (far) continue;
      // A distant spirit is only about twenty pixels tall on screen (beyond about 32 body heights),
      // where lines are invisible: take it off the outline layer, and the normal pass skips these meshes
      w.c.setInk(dist < 32 * Math.max(1, w.c.worldHeight));
      const sp = w.spawn;
      // Noticing: running is loud; approaching from behind is less likely to be noticed
      const toward = (Math.sin(w.heading) * dx + Math.cos(w.heading) * dz) / (dist || 1);
      const sense = (running ? 11 : 6.5) * (toward < -0.2 ? 0.55 : 1) * (sp.corrupted ? 1.5 : 1);
      const noticed = dist < sense && !this.frozen && this.grace <= 0;
      let speed = 0;
      w.timer -= dt;
      switch (w.state) {
        case 'idle':
          if (noticed && sp.temper !== 'calm') {
            w.state = 'notice';
            w.timer = 0.55;
            w.heading = Math.atan2(dx, dz);
          } else if (w.timer <= 0) {
            const zn = this.layout.zones[w.zone];
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * zn.r;
            w.tx = zn.x + Math.cos(a) * d;
            w.tz = zn.z + Math.sin(a) * d;
            w.state = 'wander';
            w.timer = 6;
          }
          break;
        case 'notice':
          w.alert = Math.min(1, w.alert + dt * 4);
          w.heading = Math.atan2(dx, dz);
          if (w.timer <= 0) {
            w.state = sp.temper === 'shy' ? 'flee' : sp.temper === 'fierce' ? 'chase' : 'approach';
            w.timer = sp.temper === 'fierce' ? 7 : 4;
            if (sp.temper === 'fierce') this.vfx.emit({ pos: w.c.root.position.clone().setY(w.c.root.position.y + w.c.worldHeight + 0.4), count: 6, color: [0xff5a5a, 0xffd0d0], speed: [1, 2], life: [0.3, 0.5], size: [0.15, 0.25] });
          }
          break;
        case 'wander': {
          const d = Math.hypot(w.tx - w.x, w.tz - w.z);
          if (noticed && sp.temper !== 'calm') {
            w.state = 'notice';
            w.timer = 0.55;
          } else if (d < 0.6 || w.timer <= 0) {
            w.state = 'idle';
            w.timer = 1.5 + Math.random() * 4;
          } else {
            w.heading = turn(w.heading, Math.atan2(w.tx - w.x, w.tz - w.z), dt * 4);
            speed = 1.4;
          }
          break;
        }
        case 'flee':
          w.heading = turn(w.heading, Math.atan2(-dx, -dz), dt * 7);
          speed = 5.6;
          if (w.timer <= 0 || dist > 22) {
            w.state = 'idle';
            w.timer = 2;
            w.alert = 0;
          }
          break;
        case 'chase':
          w.heading = turn(w.heading, Math.atan2(dx, dz), dt * 5);
          speed = 5.2;
          if (w.timer <= 0 || dist > 26) {
            w.state = 'idle';
            w.timer = 3;
            w.alert = 0;
          }
          break;
        case 'approach':
          w.heading = turn(w.heading, Math.atan2(dx, dz), dt * 5);
          speed = dist > 2.5 ? 2.4 : 0;
          if (w.timer <= 0 || dist > 16) {
            w.state = 'idle';
            w.timer = 2;
            w.alert = 0;
          }
          break;
      }
      if (w.state !== 'notice') w.alert = Math.max(0, w.alert - dt * (w.state === 'idle' || w.state === 'wander' ? 2 : 0));
      if (speed > 0) {
        const nx = w.x + Math.sin(w.heading) * speed * dt;
        const nz = w.z + Math.cos(w.heading) * speed * dt;
        const zn = this.layout.zones[w.zone];
        // Do not stray too far from its own territory
        const leash = Math.hypot(nx - zn.x, nz - zn.z) < zn.r + 14;
        const [ax, az] = leash ? this.step(w.x, w.z, nx, nz, w.radius, 0.9) : [w.x, w.z];
        if (ax === w.x && az === w.z) {
          w.heading += Math.PI * (0.5 + Math.random() * 0.5);
          if (w.state === 'wander') w.state = 'idle';
        }
        w.x = ax;
        w.z = az;
      }
      w.c.moving = Math.min(1, speed / 3);
      this.placeWild(w);
      // Start a battle on contact
      if (!this.frozen && !this.encountering && this.grace <= 0 && dist < w.radius + 0.75 && Math.abs(this.pos.y - this.terrain.heightAt(w.x, w.z)) < 1.8) {
        this.startEncounter(w);
        return;
      }
      if (sp.corrupted && Math.random() < dt * 3) {
        this.vfx.emit({ pos: w.c.root.position.clone().add(new THREE.Vector3(0, w.c.worldHeight * 0.5, 0)), count: 1, color: [0x9a3aff, 0x3a0a5a], speed: [0.2, 0.6], dir: new THREE.Vector3(0, 1, 0), spread: 0.6, life: [0.8, 1.4], size: [0.3, 0.5], sizeEnd: 1.8, radius: w.c.width * 0.4, intensity: 1.2 });
      }
    }
    // Replenish the count: new spirits slowly appear where the player cannot see
    this.layout.zones.forEach((zn, zi) => {
      const n = this.wilds.filter((w) => w.zone === zi).length;
      if (n >= zn.count) return;
      this.spawnT[zi] += dt;
      if (this.spawnT[zi] > 9) {
        this.spawnT[zi] = 0;
        this.spawnIn(zi);
      }
    });
  }

  private placeWild(w: Wild): void {
    const gh = this.terrain.heightAt(w.x, w.z);
    const y = Math.max(gh, this.waterLevel - 0.2);
    const hover = w.fly ? w.fly + Math.sin(this.time * 2 + w.key) * 0.2 : 0;
    w.c.root.position.set(w.x, y + hover, w.z);
    w.c.root.rotation.y = w.heading;
    w.shadow.position.set(w.x, gh + 0.05, w.z);
  }

  private startEncounter(w: Wild): void {
    this.encountering = true;
    this.frozen = true;
    // The spirit turns and hops; the camera pushes in and the screen flashes white, then control passes to the UI component to enter battle
    w.heading = Math.atan2(this.pos.x - w.x, this.pos.z - w.z);
    this.yaw = Math.atan2(w.x - this.pos.x, w.z - this.pos.z);
    this.player.root.rotation.y = this.yaw;
    w.alert = 1;
    const c = w.c;
    const y0 = c.root.position.y;
    void this.tw.to(0.35, (k) => (c.root.position.y = y0 + Math.sin(k * Math.PI) * 0.6), ease.outQuad);
    this.stage.shockwave(0.5, 0.5, 0.8, 0.6);
    this.stage.chromatic(0.8);
    this.o.onEncounter({ key: w.key, spawn: w.spawn, zone: w.zone, x: w.x, z: w.z });
  }

  private updateNpcs(dt: number): void {
    for (const n of this.npcs) {
      const d = Math.hypot(this.pos.x - n.x, this.pos.z - n.z);
      const want = d < 7 ? Math.atan2(this.pos.x - n.x, this.pos.z - n.z) : n.face;
      n.a.root.rotation.y = turn(n.a.root.rotation.y, want, dt * 5);
      n.a.wave = Math.max(0, n.a.wave - dt * 0.8);
      n.a.speed = 0;
      n.a.update(dt);
    }
  }

  private updateInteract(): void {
    let best: Interact | null = null;
    let bd = Infinity;
    const p = this.pos;
    const consider = (x: number, z: number, r: number, it: Interact) => {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < r && d < bd) {
        bd = d;
        best = it;
      }
    };
    const t = this.tower.door;
    const floor = this.o.floorsDone;
    consider(t.x, t.z, 5.5, { kind: 'tower', label: floor >= this.o.floors ? '進入伏魔塔（已全部突破）' : `進入伏魔塔・第 ${floor + 1} 層` });
    this.chests.forEach((c, i) => !c.open && consider(c.x, c.z, 2.4, { kind: 'chest', id: i, label: '打開寶箱' }));
    this.npcs.forEach((n, i) => consider(n.x, n.z, 2.8, { kind: 'npc', id: i, label: `和${this.o.npcs[i].name}說話` }));
    consider(this.layout.waypoint[0], this.layout.waypoint[1], 2.6, { kind: 'waypoint', label: '傳送陣：返回世界地圖' });
    this.near = this.frozen ? null : best;
  }

  private emitMotes(dt: number): void {
    const P = this.palette;
    this.moteT += dt;
    while (this.moteT > 0.08) {
      this.moteT -= 0.08;
      const p = new THREE.Vector3(this.pos.x + (Math.random() - 0.5) * 36, 0, this.pos.z + (Math.random() - 0.5) * 36);
      const gh = this.terrain.heightAt(p.x, p.z);
      const kind = P.moteKind;
      p.y = gh + (kind === 'fall' ? 7 + Math.random() * 4 : kind === 'rise' ? 0.2 : 0.6 + Math.random() * 4);
      this.vfx.emit({
        pos: p,
        count: 1,
        color: P.motes,
        speed: kind === 'drift' ? [0.8, 1.6] : [0.2, 0.6],
        dir: kind === 'rise' ? new THREE.Vector3(0, 1, 0) : kind === 'fall' ? new THREE.Vector3(0, -1, 0) : kind === 'drift' ? new THREE.Vector3(1, 0.2, 0) : undefined,
        spread: 0.3,
        life: [3, 5],
        size: [0.1, 0.2],
        sizeEnd: 0.6,
        drag: 0.05,
        intensity: 1.4,
        atlas: P.moteAtlas && Math.random() < P.moteAtlas[1] ? P.moteAtlas[0] : 0,
      });
    }
  }

  // ───────────────────────── For the UI component ─────────────────────────

  /** The chest-opening animation; returns false if it was already opened */
  openChest(i: number): boolean {
    const c = this.chests[i];
    if (!c || c.open) return false;
    c.open = true;
    void this.tw.to(0.45, (k) => (c.lid.rotation.x = -1.9 * k), ease.outBack);
    c.glow.visible = false;
    const p = c.group.position.clone().setY(c.group.position.y + 0.9);
    this.vfx.emit({ pos: p, count: 40, color: [0xffe28a, 0xffffff, 0xffc24a], speed: [2, 5], dir: new THREE.Vector3(0, 1, 0), spread: 0.7, life: [0.6, 1.2], size: [0.12, 0.28], gravity: -6, atlas: 1 });
    void this.vfx.ring(p.clone().setY(c.group.position.y + 0.1), 0xffd86a, 0.4, 3, 0.6);
    return true;
  }

  /** Makes the resident wave while talking to them */
  greet(i: number): void {
    const n = this.npcs[i];
    if (n) n.a.wave = 1;
  }

  /** Nameplate positions of nearby wild spirits (screen coordinates) */
  labels(): WildLabel[] {
    const out: WildLabel[] = [];
    for (const w of this.wilds) {
      const dist = Math.hypot(this.pos.x - w.x, this.pos.z - w.z);
      if (dist > 20 || !w.c.root.visible) continue;
      const p = this.stage.project(w.c.root.position.clone().add(new THREE.Vector3(0, w.c.worldHeight * 0.9 + 0.5, 0)));
      if (!p.visible) continue;
      const sp = getSpirit(w.spawn.speciesId);
      out.push({ key: w.key, x: p.x, y: p.y, name: sp.name, level: w.spawn.level, corrupted: w.spawn.corrupted, alert: w.alert > 0.3, dist });
    }
    return out;
  }

  /** For the minimap: positions of the wild spirits */
  wildDots(): { x: number; z: number; corrupted: boolean }[] {
    return this.wilds.map((w) => ({ x: w.x, z: w.z, corrupted: w.spawn.corrupted }));
  }

  chestDots(): { x: number; z: number; open: boolean }[] {
    return this.chests.map((c) => ({ x: c.x, z: c.z, open: c.open }));
  }

  /** Screen position of a world coordinate (for dialogue boxes and prompts) */
  screenOf(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    return this.stage.project(new THREE.Vector3(x, y, z));
  }

  /** The wrap-up of the encounter cutscene: flash the screen white (the UI component calls it before switching to battle) */
  flashOut(): void {
    this.stage.screenFlash(0xffffff, 0.9, 2.5);
  }

  /** State kept on leaving; `exclude` is the spirit just fought */
  snapshot(exclude?: number, atTown = false): FieldSession {
    const [sx, sz, sf] = this.layout.spawn;
    return {
      x: atTown ? sx : this.pos.x,
      z: atTown ? sz : this.pos.z,
      yaw: atTown ? sf : this.yaw,
      camYaw: atTown ? sf + Math.PI : this.camYaw,
      camPitch: this.camPitch,
      camDist: this.camDist,
      wilds: this.wilds.filter((w) => w.key !== exclude).map((w) => ({ key: w.key, spawn: w.spawn, zone: w.zone, x: w.x, z: w.z })),
      seq: this.seq,
      nav: this.navState && !atTown ? { x: this.navState.x, z: this.navState.z, label: this.navState.label, arrive: this.navState.arrive } : undefined,
    };
  }

  // ───────────────────────── Auto-navigation ─────────────────────────

  /** Places on the world map that can be clicked to travel to */
  mapMarks(): MapMark[] {
    const R = REGIONS[this.o.regionIdx];
    const L = this.layout;
    const d = this.tower.door;
    const out: MapMark[] = [
      { kind: 'tower', x: d.x, z: d.z, label: R.tower, arrive: 3 },
      { kind: 'town', x: L.town[0], z: L.town[1], label: R.town, arrive: 5 },
      { kind: 'waypoint', x: L.waypoint[0], z: L.waypoint[1], label: '傳送陣', arrive: 2.2 },
    ];
    this.chests.forEach((c) => !c.open && out.push({ kind: 'chest', x: c.x, z: c.z, label: '寶箱', arrive: 2.2 }));
    this.npcs.forEach((n, i) => out.push({ kind: 'npc', x: n.x, z: n.z, label: this.o.npcs[i].name, arrive: 2.3 }));
    return out;
  }

  /** The current navigation destination (null when not navigating) */
  get nav(): NavGoal | null {
    return this.navState;
  }

  /** Walk automatically to the destination; returns false if no route is found */
  navigate(goal: NavGoal): boolean {
    const pts = this.findPath(goal.x, goal.z, goal.arrive);
    if (!pts) return false;
    this.navState = { ...goal, pts, i: 0, stuck: 0, replans: 0, avoid: [], look: 0, final: false };
    this.navEnd = null;
    return true;
  }

  cancelNav(): void {
    this.navState = null;
  }

  /** For the minimap: the remaining navigation route (starting from the character's current position) */
  navRoute(): [number, number][] {
    const nv = this.navState;
    return nv ? [[this.pos.x, this.pos.z], ...nv.pts.slice(nv.i)] : [];
  }

  /** Direction (world coordinates) toward the next waypoint and whether to run; navigation ends on arrival */
  private steerNav(): [number, number, boolean] | null {
    const nv = this.navState!;
    const p = this.pos;
    const last = nv.pts[nv.pts.length - 1];
    const dGoal = Math.hypot(nv.x - p.x, nv.z - p.z);
    if (dGoal <= nv.arrive) {
      this.navState = null;
      this.navEnd = 'arrived';
      return null;
    }
    // The path is finished but a little short (the destination itself cannot be stood on): head straight for the destination
    // and count it as arrived if blocked; if still far off, the route is bad, so find it again
    if (nv.final || (nv.i >= nv.pts.length - 1 && Math.hypot(last[0] - p.x, last[1] - p.z) < 0.5)) {
      if (dGoal <= nv.arrive + 4.5) {
        nv.final = true;
        return [(nv.x - p.x) / dGoal, (nv.z - p.z) / dGoal, false];
      }
      nv.stuck = 99;
    }
    // Only switch to the next waypoint once reached (turning early would cut across cliff edges and slopes);
    // every 0.2 s check whether a later point can already be reached in a straight line
    while (nv.i < nv.pts.length - 1 && Math.hypot(nv.pts[nv.i][0] - p.x, nv.pts[nv.i][1] - p.z) < 0.7) nv.i++;
    if (this.time - nv.look > 0.2) {
      nv.look = this.time;
      for (let k = Math.min(nv.pts.length - 1, nv.i + 3); k > nv.i; k--) {
        if (this.clearLine(p.x, p.z, nv.pts[k][0], nv.pts[k][1])) {
          nv.i = k;
          break;
        }
      }
    }
    const [wx, wz] = nv.pts[nv.i];
    const d = Math.hypot(wx - p.x, wz - p.z) || 1;
    // Remaining path length: run when far, walk when near, so as not to overshoot
    let left = d;
    for (let k = nv.i; k < nv.pts.length - 1; k++) left += Math.hypot(nv.pts[k + 1][0] - nv.pts[k][0], nv.pts[k + 1][1] - nv.pts[k][1]);
    return [(wx - p.x) / d, (wz - p.z) / d, left > 5];
  }

  /**
   * Stuck (pushing without moving) for over a second: treat the stuck spot as impassable and find a route again from the
   * current position; give up if still stuck after three tries
   */
  private checkStuck(dt: number, moved: number): void {
    const nv = this.navState;
    if (!nv) return;
    nv.stuck = moved < 1 ? nv.stuck + dt : 0;
    if (nv.final && nv.stuck > 0.35) {
      this.navState = null;
      this.navEnd = 'arrived';
      return;
    }
    if (nv.stuck < 1.1) return;
    nv.avoid.push([this.pos.x, this.pos.z]);
    const pts = nv.replans < 3 ? this.findPath(nv.x, nv.z, nv.arrive, nv.avoid) : null;
    if (!pts) {
      this.navState = null;
      this.navEnd = 'blocked';
      return;
    }
    nv.pts = pts;
    nv.i = 0;
    nv.stuck = 0;
    nv.look = this.time;
    nv.replans++;
  }

  /**
   * Find a route with A* on a 1-meter grid, with the same rules as actual movement (colliders, water, boundary, slopes too steep to climb);
   * main roads are cheaper than open ground, so the route follows roads where it can. If the target itself cannot be stood
   * on (in water, inside a house), walk to the nearest spot less than 4 meters from it.
   * Returns the straightened waypoints (excluding the start), or null if none is found
   */
  private findPath(tx: number, tz: number, arrive: number, avoid: [number, number][] = []): [number, number][] | null {
    const S = this.layout.size - 3;
    const N = Math.floor(S * 2) + 1;
    const clampI = (v: number) => Math.max(0, Math.min(N - 1, Math.round(v + S)));
    const start = clampI(this.pos.z) * N + clampI(this.pos.x);
    // Start: the character is not necessarily on a grid point (half the body may be on a slope),
    // so start from a grid point reachable in a straight walk from nearby
    const seeds: [number, number][] = [];
    for (let a = -1; a <= 2; a++) {
      for (let b = -1; b <= 2; b++) {
        const gx = Math.floor(this.pos.x) + a;
        const gz = Math.floor(this.pos.z) + b;
        if (Math.abs(gx) > S || Math.abs(gz) > S) continue;
        const d = Math.hypot(gx - this.pos.x, gz - this.pos.z);
        if (d <= 1.6 && this.walkable(gx, gz, 0.45) && this.clearLine(this.pos.x, this.pos.z, gx, gz)) seeds.push([(gz + S) * N + (gx + S), d]);
      }
    }
    if (!seeds.length) seeds.push([start, 0]);
    const g = new Float32Array(N * N).fill(Infinity);
    const from = new Int32Array(N * N).fill(-1);
    const done = new Uint8Array(N * N);
    // Cost of each cell: NaN means not computed yet, Infinity means impassable
    const cost = new Float32Array(N * N).fill(NaN);
    const pw = this.layout.pathW + 0.5;
    const th = this.terrain;
    const cellCost = (k: number, x: number, z: number) => {
      let c = cost[k];
      if (Number.isNaN(c)) {
        if (!this.walkable(x, z, 0.45)) c = Infinity;
        else {
          c = this.comp.pathDist(x, z) < pw ? 1 : 1.35;
          // Places where it got stuck before: very expensive but not sealed off (the character stands right there,
          // and sealing it would lock itself in)
          if (avoid.some(([ax, az]) => Math.hypot(x - ax, z - az) < 1.8)) c *= 6;
          // Cells next to a steep step (stone pillar, cliff edge): the grid point itself is reachable,
          // but the triangle crossing over is too steep and would snag, so go around when possible
          const h = th.heightAt(x, z);
          const relief = Math.max(Math.abs(th.heightAt(x + 1, z) - h), Math.abs(th.heightAt(x - 1, z) - h), Math.abs(th.heightAt(x, z + 1) - h), Math.abs(th.heightAt(x, z - 1) - h));
          if (relief > 1) c *= 4;
        }
        cost[k] = c;
      }
      return c;
    };
    // Binary heap: [f, cell] stored interleaved
    const heap: number[] = [];
    const push = (f: number, k: number) => {
      heap.push(f, k);
      let i = heap.length / 2 - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p * 2] <= heap[i * 2]) break;
        [heap[p * 2], heap[i * 2]] = [heap[i * 2], heap[p * 2]];
        [heap[p * 2 + 1], heap[i * 2 + 1]] = [heap[i * 2 + 1], heap[p * 2 + 1]];
        i = p;
      }
    };
    const pop = (): number => {
      const k = heap[1];
      // Move the last entry to the top and sift it down (the array's tail yields the cell first, then f)
      const lk = heap.pop()!;
      const lf = heap.pop()!;
      const n = heap.length / 2;
      if (n > 0) {
        heap[0] = lf;
        heap[1] = lk;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < n && heap[l * 2] < heap[m * 2]) m = l;
          if (r < n && heap[r * 2] < heap[m * 2]) m = r;
          if (m === i) break;
          [heap[m * 2], heap[i * 2]] = [heap[i * 2], heap[m * 2]];
          [heap[m * 2 + 1], heap[i * 2 + 1]] = [heap[i * 2 + 1], heap[m * 2 + 1]];
          i = m;
        }
      }
      return k;
    };
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [k, d] of seeds) {
      if (d >= g[k]) continue;
      g[k] = d;
      push(d + Math.hypot((k % N) - S - tx, Math.floor(k / N) - S - tz), k);
    }
    let goal = -1;
    let closest = seeds[0][0];
    let closestD = Infinity;
    while (heap.length) {
      const c = pop();
      if (done[c]) continue;
      done[c] = 1;
      const cx = (c % N) - S;
      const cz = Math.floor(c / N) - S;
      const dt = Math.hypot(cx - tx, cz - tz);
      if (dt <= arrive) {
        goal = c;
        break;
      }
      if (dt < closestD) [closestD, closest] = [dt, c];
      const h0 = this.terrain.heightAt(cx, cz);
      for (const [dx, dz] of dirs) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (Math.abs(nx) > S || Math.abs(nz) > S) continue;
        const k = (nz + S) * N + (nx + S);
        if (done[k]) continue;
        const step = Math.hypot(dx, dz);
        const cc = cellCost(k, nx, nz);
        if (cc === Infinity || this.terrain.heightAt(nx, nz) - h0 > 1.1 * step + 0.02) continue;
        const ng = g[c] + step * cc;
        if (ng >= g[k]) continue;
        g[k] = ng;
        from[k] = c;
        push(ng + Math.hypot(nx - tx, nz - tz), k);
      }
    }
    if (goal < 0 && closestD <= arrive + 4) goal = closest;
    if (goal < 0) return null;
    const cells: [number, number][] = [];
    for (let k = goal; k !== -1; k = from[k]) cells.push([(k % N) - S, Math.floor(k / N) - S]);
    cells.reverse();
    // Straighten: skip the middle points by going to the farthest waypoint that can be walked to directly from the current point
    const out: [number, number][] = [];
    let ax = this.pos.x;
    let az = this.pos.z;
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.clearLine(ax, az, cells[j][0], cells[j][1])) j--;
      out.push(cells[j]);
      [ax, az] = cells[j];
      i = j + 1;
    }
    return out.length ? out : [[this.pos.x, this.pos.z]];
  }

  /** Whether walking straight between two points would be blocked (colliders, water, boundary, slopes too steep to climb) */
  private clearLine(x0: number, z0: number, x1: number, z1: number): boolean {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(d / 0.25);
    let ph = this.terrain.heightAt(x0, z0);
    for (let k = 1; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      const z = z0 + ((z1 - z0) * k) / n;
      if (!this.walkable(x, z, 0.5)) return false;
      const h = this.terrain.heightAt(x, z);
      if (h - ph > 1.1 * (d / n) + 0.02) return false;
      ph = h;
    }
    return true;
  }

  /**
   * Reachability check (for development): breadth-first search from the spawn point on a 1-meter grid (slope, water,
   * boundary and colliders all follow the actual movement rules),
   * returning the targets that cannot be reached (tower door, chests, residents, teleport circle, spirit areas).
   */
  checkReach(): { ok: boolean; problems: string[]; reached: number } {
    const L = this.layout;
    const S = L.size - 3;
    const N = Math.floor(S * 2) + 1;
    const idx = (x: number, z: number) => Math.round(z + S) * N + Math.round(x + S);
    const seen = new Uint8Array(N * N);
    const [sx, sz] = L.spawn;
    const q: number[] = [];
    const start = idx(sx, sz);
    seen[start] = 1;
    q.push(start);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (q.length) {
      const c = q.pop()!;
      const cx = (c % N) - S;
      const cz = Math.floor(c / N) - S;
      const h0 = this.terrain.heightAt(cx, cz);
      for (const [dx, dz] of dirs) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (Math.abs(nx) > S || Math.abs(nz) > S) continue;
        const k = idx(nx, nz);
        if (seen[k]) continue;
        if (!this.walkable(nx, nz, 0.45)) continue;
        if (this.terrain.heightAt(nx, nz) - h0 > 1.1 * Math.hypot(dx, dz) + 0.02) continue;
        seen[k] = 1;
        q.push(k);
      }
    }
    const near = (x: number, z: number, r: number) => {
      for (let a = -Math.ceil(r); a <= Math.ceil(r); a++) {
        for (let b = -Math.ceil(r); b <= Math.ceil(r); b++) {
          if (a * a + b * b > r * r) continue;
          const px = Math.round(x) + a;
          const pz = Math.round(z) + b;
          if (Math.abs(px) <= S && Math.abs(pz) <= S && seen[idx(px, pz)]) return true;
        }
      }
      return false;
    };
    // When unreachable, point out where it is stuck: the nearest reachable point, and the collider between it and the target
    // (if none, a steep slope, water or the boundary)
    const why = (x: number, z: number) => {
      let best = Infinity;
      let bx = 0;
      let bz = 0;
      for (let a = -30; a <= 30; a++) {
        for (let b = -30; b <= 30; b++) {
          const px = Math.round(x) + a;
          const pz = Math.round(z) + b;
          const d = Math.hypot(px - x, pz - z);
          if (d < best && Math.abs(px) <= S && Math.abs(pz) <= S && seen[idx(px, pz)]) [best, bx, bz] = [d, px, pz];
        }
      }
      if (best === Infinity) return '：30 公尺內都走不到';
      const len = Math.max(best, 1e-3);
      const hits = this.solids.list.filter((o) => {
        // The target's own collider (chest, resident) does not count
        if (Math.hypot(o.x - x, o.z - z) < 0.5) return false;
        const t = Math.max(0, Math.min(1, ((o.x - bx) * (x - bx) + (o.z - bz) * (z - bz)) / (len * len)));
        return Math.hypot(bx + (x - bx) * t - o.x, bz + (z - bz) * t - o.z) < o.r + 0.45;
      });
      const list = hits.slice(0, 4).map((o) => `(${o.x.toFixed(1)}, ${o.z.toFixed(1)}, r ${o.r.toFixed(2)})`).join(' ');
      return `：最近走得到 (${bx}, ${bz})，差 ${best.toFixed(1)} 公尺；${hits.length ? `中間擋著 ${list}${hits.length > 4 ? ` 等 ${hits.length} 個` : ''}` : '中間沒有碰撞體（陡坡、水或邊界）'}`;
    };
    const problems: string[] = [];
    const [dx, dz] = [this.tower.door.x, this.tower.door.z];
    if (!near(dx, dz, 4.5)) problems.push(`塔門 (${dx.toFixed(0)}, ${dz.toFixed(0)}) 走不到${why(dx, dz)}`);
    L.chests.forEach(([x, z], i) => !near(x, z, 2.2) && problems.push(`寶箱 ${i} (${x}, ${z}) 走不到${why(x, z)}`));
    L.npcs.forEach(([x, z], i) => !near(x, z, 2.5) && problems.push(`居民 ${i} (${x}, ${z}) 走不到${why(x, z)}`));
    if (!near(L.waypoint[0], L.waypoint[1], 2.4)) problems.push(`傳送陣 (${L.waypoint[0]}, ${L.waypoint[1]}) 走不到${why(L.waypoint[0], L.waypoint[1])}`);
    L.zones.forEach((zn, i) => !near(zn.x, zn.z, zn.r) && problems.push(`精靈區域 ${i} (${zn.x}, ${zn.z}) 走不到${why(zn.x, zn.z)}`));
    const species = new Set(REGIONS[this.o.regionIdx].explore.map((e) => e.speciesId));
    L.zones.forEach((zn, i) => zn.species?.forEach((sp) => !species.has(sp) && problems.push(`精靈區域 ${i} 的 ${sp} 不在地區出沒表`)));
    if (L.npcs.length !== this.o.npcs.length) problems.push(`居民位置 ${L.npcs.length} 個，但地區有 ${this.o.npcs.length} 位居民`);
    let reached = 0;
    for (const v of seen) reached += v;
    return { ok: problems.length === 0, problems, reached };
  }

  /** The minimap base image: terrain colors plus contour shading */
  mapImage(px = 200): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(px, px);
    const S = this.layout.size;
    const geo = this.terrain.mesh.geometry;
    const col = geo.getAttribute('color') as THREE.BufferAttribute;
    const n = this.terrain.seg + 1;
    for (let j = 0; j < px; j++) {
      for (let i = 0; i < px; i++) {
        const x = -S + ((i + 0.5) / px) * S * 2;
        const z = -S + ((j + 0.5) / px) * S * 2;
        const gi = Math.min(n - 1, Math.round(((x + S) / (2 * S)) * (n - 1)));
        const gj = Math.min(n - 1, Math.round(((z + S) / (2 * S)) * (n - 1)));
        const k = gj * n + gi;
        const h = this.terrain.heightAt(x, z);
        const shade = Math.max(0.55, Math.min(1.25, 1 + (this.terrain.heightAt(x - 1.5, z - 1.5) - h) * 0.25));
        let r = col.getX(k) * shade;
        let gg = col.getY(k) * shade;
        let b = col.getZ(k) * shade;
        if (h < this.waterLevel) [r, gg, b] = this.mapWater;
        const o = (j * px + i) * 4;
        img.data[o] = Math.min(255, r * 255);
        img.data[o + 1] = Math.min(255, gg * 255);
        img.data[o + 2] = Math.min(255, b * 255);
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  override dispose(): void {
    super.dispose();
    for (const d of this.disposers) d();
    this.terrain.dispose();
    this.grass?.dispose();
    this.waterDispose?.();
    this.tower.dispose();
    this.skyMat.dispose();
    this.player.dispose();
    for (const n of this.npcs) n.a.dispose();
    const ink = this.stage.ink.core.style;
    [ink.sceneNear, ink.sceneFar] = this.inkPrev;
    this.stage.setFovScale(1);
    this.stage.camera.far = 400;
    this.stage.camera.updateProjectionMatrix();
  }
}

function turn(from: number, to: number, k: number): number {
  let d = to - from;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return from + d * Math.min(1, k);
}
