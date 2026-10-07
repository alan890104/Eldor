// Shared arena tools: the palette type, a batcher that merges static props, matrix shorthands, random numbers and common props (trees, pines, rocks, crystals, stone pillars).
// Each region's arena is written in arenas/*.ts and takes tools only from here, not depending on arena.ts (to avoid a circular import).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { inkScenery, tagInkPart } from './ink.ts';
import { sceneMaterial } from './spiritToon.ts';
import type { Vfx } from './vfx.ts';

export type RegionId =
  | 'hub'
  | 'forest'
  | 'isles'
  | 'volcano'
  | 'highland'
  | 'canyon'
  | 'plains'
  | 'holy'
  | 'shadow'
  | 'rift'
  | 'arena';

export interface Palette {
  /** Three colors of the sky dome from top to bottom */
  sky: [string, string, string];
  fog: number;
  fogNear: number;
  fogFar: number;
  /** Ground texture: base color, speckles, bright lines */
  ground: [string, string, string];
  /** Key light direction (normalized) */
  light: [number, number, number];
  ambient: number;
  rim: number;
  shadow: number;
  /** Color and motion style of the ambient particles */
  motes: number[];
  moteKind: 'float' | 'rise' | 'fall' | 'drift';
  /** The sky has stars */
  stars?: boolean;
  /** Some ambient particles use one cell of the particle atlas instead (example: the forest's leaves): [cell, probability] */
  moteAtlas?: [0 | 1 | 2 | 3, number];
}

/** The assembly environment passed to each region's build() */
export interface ArenaCtx {
  region: RegionId;
  P: Palette;
  /** Arena root node: dynamic objects (animated meshes, custom shaders) are added directly here */
  group: THREE.Group;
  /** Static prop batch: after build() ends it is merged by color into a small number of meshes */
  b: PropBatch;
  /** Random numbers (0 to 1) with a fixed seed per region */
  r: () => number;
  /** Pick a position within the ring [rMin, rMax]; with avoidFront it avoids the camera direction (the camera is at -x, +z) */
  ringPos: (rMin: number, rMax: number, avoidFront?: boolean) => readonly [number, number];
  /** Per-frame update: dt is the fx clock step, t is the accumulated scene time */
  extras: ((dt: number, t: number, vfx: Vfx) => void)[];
  /** Cleanup to run when the arena is disposed (custom materials, textures, render targets) */
  disposers: (() => void)[];
  /** Sky dome material: uniforms top / mid / bot (colors), uFlash, uTime, uStars */
  skyMat: THREE.ShaderMaterial;
  /** Ground (a disc of radius 34); its material can be replaced */
  ground: THREE.Mesh;
  /** The ring from the edge of the ground to the horizon */
  far: THREE.Mesh;
  /** Central magic circle */
  rune: THREE.Mesh;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
}

export interface RegionModule {
  palette: Palette;
  build(ctx: ArenaCtx): void;
}

// ───────────────────────── Static prop batch ─────────────────────────

export class PropBatch {
  protected inkPart = 0;
  private parts = new Map<string, THREE.BufferGeometry[]>();
  private noOutline = new Map<string, THREE.BufferGeometry[]>();
  private emissive = new Map<string, THREE.BufferGeometry[]>();

  /** Toon-shaded prop (outlined by default) */
  add(geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4, outline = true): void {
    // Template geometry is often reused, so always copy it before modifying (changing a non-indexed geometry directly would move the template itself)
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(m);
    // Props of the same color are merged into one mesh, with per-vertex part ids, so part lines still appear between props
    if (outline) tagInkPart(g, this.inkPart++);
    const map = outline ? this.parts : this.noOutline;
    const key = String(color);
    map.set(key, [...(map.get(key) ?? []), g]);
  }

  /** Self-lit prop (unlit, amplified by bloom) */
  glow(geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(m);
    const key = String(color);
    this.emissive.set(key, [...(this.emissive.get(key) ?? []), g]);
  }

  build(parent: THREE.Object3D): void {
    // The same MeshToon shading and post-process outline as the spirits; props without an outline hang on another group and are not tagged with the ink layer
    const lined = new THREE.Group();
    parent.add(lined);
    for (const [map, outline] of [[this.parts, true], [this.noOutline, false]] as const) {
      for (const [key, geos] of map) {
        const merged = mergeGeometries(geos);
        if (!merged) continue;
        const mesh = new THREE.Mesh(merged, sceneMaterial(Number(key), { rim: 0.35 }));
        (outline ? lined : parent).add(mesh);
      }
    }
    inkScenery(lined);
    for (const [key, geos] of this.emissive) {
      const merged = mergeGeometries(geos);
      if (!merged) continue;
      parent.add(new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ color: new THREE.Color(Number(key)).multiplyScalar(2.2), toneMapped: false })));
    }
  }
}

// ───────────────────────── Shorthands ─────────────────────────

/** Matrix of translation + Y rotation + uniform scale (X / Z rotation can be added) */
export const M = (x: number, y: number, z: number, ry = 0, s = 1, rx = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
/** Matrix of translation + non-uniform scale + Y rotation */
export const MS = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

/** Seeded random number generator (0 to 1) */
export function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ───────────────────────── Common props ─────────────────────────

export function tree(b: PropBatch, x: number, z: number, s: number, trunk: number, leaves: number[], r: () => number) {
  b.add(new THREE.CylinderGeometry(0.25, 0.4, 3, 7), trunk, M(x, 1.5 * s, z, 0, s));
  const n = 3;
  for (let i = 0; i < n; i++) {
    const ry = r() * 6;
    b.add(new THREE.IcosahedronGeometry(1.4 - i * 0.25, 1), leaves[i % leaves.length], M(x + Math.cos(ry) * 0.4 * s, (3 + i * 0.9) * s, z + Math.sin(ry) * 0.4 * s, ry, s));
  }
}

export function pine(b: PropBatch, x: number, z: number, s: number, trunk: number, leaf: number) {
  b.add(new THREE.CylinderGeometry(0.2, 0.3, 1.2, 6), trunk, M(x, 0.6 * s, z, 0, s));
  for (let i = 0; i < 3; i++) b.add(new THREE.ConeGeometry(1.5 - i * 0.35, 1.8, 8), leaf, M(x, (1.6 + i * 1.0) * s, z, i, s));
}

export function rock(b: PropBatch, x: number, z: number, s: number, col: number, r: () => number) {
  b.add(new THREE.DodecahedronGeometry(1, 0), col, M(x, 0.4 * s, z, r() * 6, s, r() * 0.5, r() * 0.5));
}

export function crystal(b: PropBatch, x: number, z: number, s: number, col: number, r: () => number) {
  for (let i = 0; i < 3; i++) {
    const g = new THREE.OctahedronGeometry(0.5);
    g.scale(0.6, 2.2, 0.6);
    b.glow(g, col, M(x + (r() - 0.5) * s, 0.9 * s, z + (r() - 0.5) * s, r() * 6, s * (0.6 + r() * 0.6), (r() - 0.5) * 0.6, (r() - 0.5) * 0.6));
  }
}

export function pillar(b: PropBatch, x: number, z: number, h: number, col: number, cap: number) {
  b.add(new THREE.CylinderGeometry(0.55, 0.6, h, 10), col, M(x, h / 2, z));
  b.add(new THREE.BoxGeometry(1.5, 0.35, 1.5), cap, M(x, h + 0.17, z));
  b.add(new THREE.BoxGeometry(1.5, 0.35, 1.5), cap, M(x, 0.17, z));
}
