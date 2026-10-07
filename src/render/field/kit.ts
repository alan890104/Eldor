// Shared field tools: the map layout type, a chunked prop batch (whole far chunks are culled), collision circles, town buildings and common props.
// Each region's field is written in biomes/*.ts and takes its tools only from here, arenaKit.ts and arenas/_woods.ts.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, PropBatch, type Palette } from '../arenaKit.ts';
import type { Vfx } from '../vfx.ts';
import type { Terrain, WaterOpts } from './terrain.ts';
import type { Tier } from '../../game/field.ts';

export type XZ = [number, number];

/** An area where wild spirits appear */
export interface SpawnZone {
  x: number;
  z: number;
  r: number;
  tier: Tier;
  /** How many are present at once */
  count: number;
  /** Species restricted to appear here (must be in the region's spawn table) */
  species?: string[];
  /** Chance that a corrupted spirit appears */
  corrupt?: number;
  /** Flying spirits hover in mid-air here */
  name?: string;
}

/** A field map layout: the town is in the south (+z), the Seal Tower in the north (-z), and a road connects them */
export interface FieldLayout {
  /** Half the side length */
  size: number;
  /** Spawn point and the character's facing (radians: 0 faces +z (south), pi faces -z (north)) */
  spawn: [number, number, number];
  town: XZ;
  /** Town platform radius */
  townR: number;
  tower: XZ;
  /** The main road: control points from the town to the Seal Tower */
  path: XZ[];
  /** Other paths */
  trails?: XZ[][];
  /** Road width (half-width) */
  pathW: number;
  zones: SpawnZone[];
  chests: XZ[];
  /** Positions and facings of the town residents, matching the region data's npcs in order */
  npcs: [number, number, number][];
  /** Teleport circle: back to the world map */
  waypoint: XZ;
  /** Boundary: cliff means cliff walls all around, water means sea all around */
  edge: 'cliff' | 'water' | 'void';
}

export interface GroundCols {
  grass: number;
  grass2: number;
  path: number;
  cliff: number;
  sand?: number;
  /** Stone-slab color of the town plaza */
  plaza?: number;
}

export interface Biome {
  layout: FieldLayout;
  /** Sky, fog and light (defaults to the battle arena's palette) */
  palette?: Partial<Palette>;
  /** Fog distances (the field is seen from farther away) */
  fog?: [number, number];
  cols: GroundCols;
  /** Raw terrain height (roads, towns and tower bases are flattened afterward) */
  height(x: number, z: number): number;
  /** Custom ground color (called after the default coloring, so it may modify out) */
  paint?(x: number, z: number, h: number, slope: number, out: THREE.Color): void;
  water?: WaterOpts;
  /**
   * Grass sea settings; false means no grass (lava ground, above the clouds, ...).
   * cover returns a 0-1 grass ratio (which is then multiplied by the default avoidance rules: roads, town, tower, water, steep slopes, colliders);
   * color is the grass color (defaults to cols.grass / grass2), and tip is the blade tip color.
   */
  grass?: false | { density?: number; height?: number; tip?: number; cover?: (x: number, z: number, h: number, slope: number) => number; color?: (x: number, z: number, out: THREE.Color) => void };
  /** Seal Tower appearance */
  tower: TowerStyle;
  decorate(ctx: FieldCtx): void;
}

export interface TowerStyle {
  stone: number;
  stoneDark: number;
  trim: number;
  roof: number;
  /** Colors of the source crystal and the runes */
  glow: number;
  /** Eave style: pagoda is an upturned-eave pagoda, spire is a pointed spire, ruin is a crumbling stone tower */
  kind?: 'pagoda' | 'spire' | 'ruin';
}

// ───────────────────────── Prop batch ─────────────────────────

/**
 * A chunked prop batch: used like PropBatch, but props are split into chunks by position,
 * each chunk is merged into its own mesh, and chunks the camera cannot see are culled whole.
 * lift is added to the height of every prop (to move props that only build at y = 0 onto the terrain).
 */
export class FieldBatch extends PropBatch {
  lift = 0;
  private chunks = new Map<string, PropBatch>();
  private chunk: number;
  constructor(chunk = 32) {
    super();
    this.chunk = chunk;
  }
  private at(m: THREE.Matrix4): PropBatch {
    const e = m.elements;
    const key = `${Math.floor(e[12] / this.chunk)},${Math.floor(e[14] / this.chunk)}`;
    let b = this.chunks.get(key);
    if (!b) this.chunks.set(key, (b = new PropBatch()));
    return b;
  }
  private lifted(m: THREE.Matrix4): THREE.Matrix4 {
    return this.lift ? new THREE.Matrix4().makeTranslation(0, this.lift, 0).multiply(m) : m;
  }
  override add(geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4, outline = true): void {
    const mm = this.lifted(m);
    this.at(mm).add(geo, color, mm, outline);
  }
  override glow(geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4): void {
    const mm = this.lifted(m);
    this.at(mm).glow(geo, color, mm);
  }
  override build(parent: THREE.Object3D): void {
    for (const b of this.chunks.values()) {
      const g = new THREE.Group();
      b.build(g);
      parent.add(g);
    }
  }
}

// ───────────────────────── Collision ─────────────────────────

export interface Solid {
  x: number;
  z: number;
  r: number;
}

/** Circular colliders, with a grid to speed up queries */
export class Solids {
  private grid = new Map<string, Solid[]>();
  private cell = 8;
  list: Solid[] = [];
  add(x: number, z: number, r: number): void {
    const s = { x, z, r };
    this.list.push(s);
    const c = this.cell;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) {
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
        const k = `${i},${j}`;
        const a = this.grid.get(k);
        if (a) a.push(s);
        else this.grid.set(k, [s]);
      }
    }
  }
  near(x: number, z: number): Solid[] {
    return this.grid.get(`${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`) ?? [];
  }
  /** Push a circle of radius r out of all colliders; returns whether it hit any */
  push(p: { x: number; z: number }, r: number): boolean {
    let hit = false;
    for (const s of this.near(p.x, p.z)) {
      const dx = p.x - s.x;
      const dz = p.z - s.z;
      const d = Math.hypot(dx, dz);
      const min = s.r + r;
      if (d < min) {
        hit = true;
        if (d < 1e-4) {
          p.x += min;
          continue;
        }
        p.x = s.x + (dx / d) * min;
        p.z = s.z + (dz / d) * min;
      }
    }
    return hit;
  }
  blocked(x: number, z: number, r: number): boolean {
    return this.near(x, z).some((s) => Math.hypot(x - s.x, z - s.z) < s.r + r);
  }
}

// ───────────────────────── Assembling the environment ─────────────────────────

export interface FieldCtx {
  layout: FieldLayout;
  terrain: Terrain;
  /** Ground height */
  h: (x: number, z: number) => number;
  /** Prop batch; use place(x, z) to first set lift to the ground height there */
  b: FieldBatch;
  /** Lift props added afterward onto the ground at (x, z) (takes the lowest point around, so props do not float) */
  place: (x: number, z: number, spread?: number) => number;
  solids: Solids;
  r: () => number;
  group: THREE.Group;
  extras: ((dt: number, t: number, vfx: Vfx) => void)[];
  disposers: (() => void)[];
  /** Distance to the main road (including paths) */
  pathDist: (x: number, z: number) => number;
  /** Whether the spot is far enough from the town, tower, roads, teleport circle and chests (check before placing large props) */
  clear: (x: number, z: number, margin?: number) => boolean;
  /** Scatter n random points within [x0, x1] × [z0, z1] (avoiding positions where clear does not pass) */
  scatter: (n: number, box: [number, number, number, number], margin: number, fn: (x: number, z: number, i: number) => void) => void;
  /** True on low graphics: prop counts are halved */
  low: boolean;
  /** Water level (-Infinity when there is no water) */
  waterLevel: number;
  /** The water surface built by the engine (null when there is no water); to swap in your own sea or lava shader, change its material / uniforms */
  water: THREE.Mesh | null;
  /**
   * Floors of the Seal Tower broken through so far and the total floors (done >= floors means the region is purified,
   * and the scene may change: freed captive creatures, the Order withdrawing, ...)
   */
  done: number;
  floors: number;
}

// ───────────────────────── Town props ─────────────────────────

export interface HouseStyle {
  wall: number;
  roof: number;
  trim: number;
  /** Warm light of the windows */
  window: number;
}

/** A small hut with a gable roof: the door faces the `facing` direction (radians, 0 = +z) */
export function house(ctx: FieldCtx, x: number, z: number, facing: number, w: number, d: number, h: number, st: HouseStyle): void {
  const { b } = ctx;
  ctx.place(x, z, Math.max(w, d) / 2);
  const rot = (lx: number, ly: number, lz: number, s = 1, rx = 0, rz = 0) =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(x + Math.cos(facing) * lx + Math.sin(facing) * lz, ly, z - Math.sin(facing) * lx + Math.cos(facing) * lz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, facing, rz)),
      new THREE.Vector3(s, s, s),
    );
  // Foundation, walls, roof
  b.add(new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4), st.trim, rot(0, 0.05, 0));
  b.add(new THREE.BoxGeometry(w, h, d), st.wall, rot(0, h / 2 + 0.3, 0));
  // Triangular-prism roof: extends along the depth direction (z), with the eaves jutting out
  const roofH = Math.min(w, d) * 0.55;
  const prism = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  prism.rotateX(Math.PI / 2);
  prism.rotateZ(Math.PI);
  prism.scale((w * 0.62) / 0.866, roofH / 1.5, d + 0.7);
  b.add(prism, st.roof, rot(0, h + 0.3 + roofH / 3, 0));
  // Chimney
  b.add(new THREE.BoxGeometry(0.45, 1.2, 0.45), st.trim, rot(w * 0.25, h + roofH * 0.6 + 0.4, -d * 0.2));
  // Door and windows
  b.add(new THREE.BoxGeometry(0.9, 1.5, 0.12), st.trim, rot(0, 1.05, d / 2 + 0.02));
  b.glow(new THREE.BoxGeometry(0.62, 0.55, 0.1), st.window, rot(-w * 0.3, h * 0.55 + 0.3, d / 2 + 0.02));
  b.glow(new THREE.BoxGeometry(0.62, 0.55, 0.1), st.window, rot(w * 0.3, h * 0.55 + 0.3, d / 2 + 0.02));
  ctx.solids.add(x, z, Math.max(w, d) * 0.62);
}

/** Domed tent (nomad camp, outpost) */
export function tent(ctx: FieldCtx, x: number, z: number, R: number, cloth: number, trim: number, facing = 0): void {
  const { b } = ctx;
  ctx.place(x, z, R);
  b.add(new THREE.CylinderGeometry(R, R, 1.4, 12), cloth, M(x, 0.7, z));
  b.add(new THREE.ConeGeometry(R * 1.1, R * 0.9, 12), trim, M(x, 1.4 + R * 0.45, z));
  b.add(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 5), trim, M(x, 1.9 + R * 0.9, z));
  b.add(new THREE.BoxGeometry(0.9, 1.1, 0.1), trim, M(x + Math.sin(facing) * R, 0.55, z + Math.cos(facing) * R, facing));
  ctx.solids.add(x, z, R + 0.2);
}

/** Street lamp: a glowing lampshade */
export function lampPost(ctx: FieldCtx, x: number, z: number, post: number, light: number, h = 2.6): void {
  const { b } = ctx;
  ctx.place(x, z);
  b.add(new THREE.CylinderGeometry(0.07, 0.1, h, 6), post, M(x, h / 2, z));
  b.add(new THREE.BoxGeometry(0.34, 0.08, 0.34), post, M(x, h, z));
  b.glow(new THREE.OctahedronGeometry(0.2), light, M(x, h + 0.22, z));
  b.add(new THREE.ConeGeometry(0.28, 0.2, 4), post, M(x, h + 0.5, z, Math.PI / 4));
  ctx.solids.add(x, z, 0.3);
}

/** A run of wooden fence: along a -> c */
export function fence(ctx: FieldCtx, a: XZ, c: XZ, col: number): void {
  const { b } = ctx;
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const n = Math.max(1, Math.round(len / 1.6));
  const ang = Math.atan2(c[0] - a[0], c[1] - a[1]);
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((c[0] - a[0]) * i) / n;
    const z = a[1] + ((c[1] - a[1]) * i) / n;
    ctx.place(x, z);
    b.add(new THREE.BoxGeometry(0.16, 1.0, 0.16), col, M(x, 0.5, z));
    if (i < n) {
      const mx = x + (c[0] - a[0]) / n / 2;
      const mz = z + (c[1] - a[1]) / n / 2;
      b.add(new THREE.BoxGeometry(0.08, 0.1, len / n), col, M(mx, 0.72, mz, ang));
      b.add(new THREE.BoxGeometry(0.08, 0.1, len / n), col, M(mx, 0.38, mz, ang));
    }
  }
}

/** Well */
export function well(ctx: FieldCtx, x: number, z: number, stone: number, wood: number, roof: number): void {
  const { b } = ctx;
  ctx.place(x, z, 1.2);
  b.add(new THREE.CylinderGeometry(1.0, 1.1, 0.9, 14), stone, M(x, 0.45, z));
  b.add(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 14), 0x2a4a6a, M(x, 0.86, z), false);
  for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.14, 1.9, 0.14), wood, M(x + s * 0.85, 1.4, z));
  b.add(new THREE.ConeGeometry(1.4, 0.8, 4), roof, M(x, 2.6, z, Math.PI / 4));
  ctx.solids.add(x, z, 1.2);
}

/** Signpost */
export function signpost(ctx: FieldCtx, x: number, z: number, facing: number, wood: number): void {
  const { b } = ctx;
  ctx.place(x, z);
  b.add(new THREE.BoxGeometry(0.14, 1.8, 0.14), wood, M(x, 0.9, z));
  b.add(new THREE.BoxGeometry(1.2, 0.36, 0.08), wood, M(x, 1.5, z, facing, 1, 0, 0.12));
  b.add(new THREE.BoxGeometry(1.0, 0.3, 0.08), wood, M(x, 1.05, z, facing + 0.9, 1, 0, -0.1));
  ctx.solids.add(x, z, 0.25);
}

/** A pile of crates and barrels (town corners) */
export function crates(ctx: FieldCtx, x: number, z: number, wood: number, band: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, 1);
  b.add(new THREE.BoxGeometry(0.9, 0.9, 0.9), wood, M(x, 0.45, z, r()));
  b.add(new THREE.BoxGeometry(0.7, 0.7, 0.7), wood, M(x + 0.3, 1.25, z + 0.1, r()));
  b.add(new THREE.CylinderGeometry(0.4, 0.4, 0.95, 10), band, M(x + 1.0, 0.48, z - 0.3));
  ctx.solids.add(x + 0.4, z, 1.0);
}

/** A small stone-paved square: a ring of low stone curbs plus a central flower bed */
export function plaza(ctx: FieldCtx, x: number, z: number, R: number, stone: number, flower: number[]): void {
  const { b, r } = ctx;
  const n = Math.round(R * 2.6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Leave gaps for the road (north, south)
    if (Math.abs(Math.sin(a)) < 0.2) continue;
    const px = x + Math.cos(a) * R;
    const pz = z + Math.sin(a) * R;
    ctx.place(px, pz);
    b.add(new THREE.BoxGeometry(1.2, 0.35, 0.5), stone, M(px, 0.1, pz, -a + Math.PI / 2));
  }
  ctx.place(x, z, 2);
  b.add(new THREE.CylinderGeometry(1.6, 1.75, 0.5, 12), stone, M(x, 0.25, z));
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 1.2;
    b.add(new THREE.IcosahedronGeometry(0.22, 0), flower[i % flower.length], M(x + Math.cos(a) * d, 0.6, z + Math.sin(a) * d), false);
  }
  ctx.solids.add(x, z, 1.8);
}

// ───────────────────────── Field props ─────────────────────────

/** A clump of flowers (a grass-land accent) */
export function flowers(ctx: FieldCtx, x: number, z: number, cols: number[], n = 5): void {
  const { b, r } = ctx;
  ctx.place(x, z);
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * 1.4;
    const pz = z + (r() - 0.5) * 1.4;
    b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 3), 0x3f8a3a, M(px, 0.17, pz), false);
    b.add(new THREE.IcosahedronGeometry(0.1, 0), cols[i % cols.length], M(px, 0.38, pz), false);
  }
}

/** Stone archway (ruins, town gate) */
export function arch(ctx: FieldCtx, x: number, z: number, facing: number, w: number, h: number, stone: number, glow?: number): void {
  const { b } = ctx;
  ctx.place(x, z, w / 2);
  const side = (s: number) => [x + Math.cos(facing) * s * w * 0.5, z - Math.sin(facing) * s * w * 0.5] as const;
  for (const s of [-1, 1]) {
    const [px, pz] = side(s);
    b.add(new THREE.BoxGeometry(0.9, h, 0.9), stone, M(px, h / 2, pz, facing));
    ctx.solids.add(px, pz, 0.7);
  }
  const top = new THREE.TorusGeometry(w * 0.5, 0.42, 6, 14, Math.PI);
  b.add(top, stone, M(x, h, z, facing));
  if (glow !== undefined) b.glow(new THREE.OctahedronGeometry(0.3), glow, M(x, h + w * 0.5 + 0.1, z));
}

/** A simple wooden or stone plank bridge (along a -> c; height y follows the ground at both ends) */
export function bridge(ctx: FieldCtx, a: XZ, c: XZ, width: number, deck: number, rail: number, yOff = 0.25): void {
  const { b, h } = ctx;
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const n = Math.max(2, Math.round(len / 0.7));
  const ang = Math.atan2(c[0] - a[0], c[1] - a[1]);
  const y0 = h(a[0], a[1]);
  const y1 = h(c[0], c[1]);
  const nx = Math.cos(ang);
  const nz = -Math.sin(ang);
  ctx.b.lift = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a[0] + (c[0] - a[0]) * t;
    const z = a[1] + (c[1] - a[1]) * t;
    const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 0.6 + yOff;
    b.add(new THREE.BoxGeometry(width, 0.14, 0.6), deck, M(x, y, z, ang));
    if (i % 3 === 0) {
      for (const s of [-1, 1]) {
        b.add(new THREE.BoxGeometry(0.14, 1.0, 0.14), rail, M(x + nx * s * width * 0.5, y + 0.5, z + nz * s * width * 0.5));
        b.add(new THREE.CylinderGeometry(0.14, 0.14, 4, 5), rail, M(x + nx * s * width * 0.5, y - 2, z + nz * s * width * 0.5));
      }
    }
  }
  for (const s of [-1, 1]) {
    const p0 = new THREE.Vector3(a[0] + nx * s * width * 0.5, y0 + 1 + yOff, a[1] + nz * s * width * 0.5);
    const p1 = new THREE.Vector3(c[0] + nx * s * width * 0.5, y1 + 1 + yOff, c[1] + nz * s * width * 0.5);
    const mid = p0.clone().lerp(p1, 0.5);
    mid.y += 0.6;
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
    b.add(new THREE.TubeGeometry(curve, 12, 0.06, 4), rail, new THREE.Matrix4());
  }
}

/** Merge a group of geometry that moves together (e.g. runes that glow and breathe); returns a function that adjusts the brightness */
export function glowGroup(parent: THREE.Object3D, disposers: (() => void)[], color: number, geos: THREE.BufferGeometry[]): (k: number) => void {
  const base = new THREE.Color(color);
  const mat = new THREE.MeshBasicMaterial({ color: base.clone().multiplyScalar(2.2), toneMapped: false, transparent: true });
  const merged = geos.length ? mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))) : null;
  if (merged) parent.add(new THREE.Mesh(merged, mat));
  disposers.push(() => {
    mat.dispose();
    merged?.dispose();
  });
  return (k) => mat.color.copy(base).multiplyScalar(k);
}
