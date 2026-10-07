// Stoneheart Canyon's natural props: fallen rocks and collapsed blocks at the wall feet, junipers, sage bushes, dead trees,
// scattered hoodoos and rock piles on the valley floor and mesa tops, desert wildflowers; the whole plateau and distant spires
// around the outside of the map; vultures circling overhead, dust devils wandering the valleys, tumbleweeds rolling by, and the
// occasional rock falling from a cliff top.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FieldCtx, XZ } from '../../kit.ts';
import { flowers } from '../../kit.ts';
import { RIM, SHELL, SIZE, SPOT, TOWER, TOWN, floorH, isFloor, smooth, vnoise, wallDist } from './geo.ts';
import { COL, MX, dynMesh } from './pal.ts';
import { bandCol, hoodoo } from './sites.ts';
import { dustDevilMaterial, plateauMaterial } from './shaders.ts';

export function buildNature(ctx: FieldCtx, rails: XZ[]): void {
  const railNear = railIndex(rails);
  talus(ctx, railNear);
  plants(ctx, railNear);
  tops(ctx);
  outerPlateau(ctx);
  ctx.b.lift = 0;
  life(ctx);
}

/** Quick lookup near the rails */
function railIndex(rails: XZ[]): (x: number, z: number, m: number) => boolean {
  const cell = 8;
  const map = new Map<string, XZ[]>();
  for (const p of rails) {
    const k = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)}`;
    const a = map.get(k);
    if (a) a.push(p);
    else map.set(k, [p]);
  }
  return (x, z, m) => {
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [px, pz] of map.get(`${cx + i},${cz + j}`) ?? []) if (Math.hypot(px - x, pz - z) < m) return true;
    return false;
  };
}

/** Keep clear of special places: the town (on the shell), the quicksand, the dig pit and the pools */
function special(x: number, z: number, m = 0): boolean {
  if (Math.hypot(x - SHELL[0], z - SHELL[1]) < SHELL[2] + 3 + m) return true;
  if (Math.hypot(x - SPOT.quick[0], z - SPOT.quick[1]) < 12.5 + m) return true;
  if (Math.hypot(x - SPOT.dig[0], z - SPOT.dig[1]) < 11 + m) return true;
  if (Math.hypot(x - SPOT.head[0], z - (SPOT.head[1] + 3)) < 13 + m) return true;
  if (Math.hypot(x + 67, z - 22) < 8.5 + m) return true; // Glassworks
  return false;
}

/**
 * No trees or big rocks in front of a landmark (the camera follows behind the player and would be blocked when looking at the
 * landmark)
 */
function viewBlocked(x: number, z: number): boolean {
  if (Math.hypot(x - SPOT.shrine[0], z - SPOT.shrine[1]) < 12) return true;
  // The whole dead-end alley where the fossil lies (visible all the way to the end from the mouth of the valley)
  {
    const [ax, az, bx, bz] = [54, 30, 78, 9];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    if (Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t) < 9) return true;
  }
  if (Math.hypot(x - SPOT.mine[0] + 6, z - SPOT.mine[1] - 5) < 8) return true;
  if (Math.hypot(x - SPOT.grotto[0], z - SPOT.grotto[1]) < 13) return true;
  return false;
}

// ───────────────────────── Fallen rock ─────────────────────────

function talus(ctx: FieldCtx, railNear: (x: number, z: number, m: number) => boolean): void {
  const { b, r } = ctx;
  const S = SIZE - 6;
  const k = ctx.low ? 0.5 : 1;
  // Scree at the wall feet (the small pieces don't block the way)
  let n = 0;
  for (let i = 0; i < 9000 && n < 520 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    const d = wallDist(x, z);
    if (d < -3.2 || d > 0.2 || special(x, z)) continue;
    if (ctx.pathDist(x, z) < ctx.layout.pathW + 0.8 || railNear(x, z, 1.4)) continue;
    const big = r() < 0.18;
    const s = big ? 0.9 + r() * 1.3 : 0.25 + r() * 0.5;
    if (big && (!ctx.clear(x, z, 0.5) || ctx.solids.blocked(x, z, s))) continue;
    const y = ctx.place(x, z, s * 0.5);
    const g = r() < 0.5 ? new THREE.DodecahedronGeometry(1, 0) : new THREE.BoxGeometry(1.6, 0.9, 1.2);
    b.add(g, bandCol(y + 2 + r() * 8), MX(x, s * 0.3, z, s * (0.8 + r() * 0.5), s * (0.55 + r() * 0.3), s * (0.8 + r() * 0.5), r() * 6, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5), big);
    if (big) ctx.solids.add(x, z, s * 0.85);
    n++;
  }
  // Big blocks that have fallen from the rock wall (squared-off layered rock)
  n = 0;
  for (let i = 0; i < 3000 && n < 46 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    const d = wallDist(x, z);
    if (d < -5 || d > -1.2 || special(x, z, 2) || viewBlocked(x, z) || !ctx.clear(x, z, 2.5) || railNear(x, z, 3.5)) continue;
    const s = 1.6 + r() * 1.6;
    if (ctx.solids.blocked(x, z, s * 1.2)) continue;
    const y = ctx.place(x, z, s);
    const layers = 1 + Math.floor(r() * 2);
    for (let l = 0; l < layers; l++) {
      b.add(new THREE.BoxGeometry(s * 1.5, s * 0.55, s * 1.1), bandCol(y + 4 + l * 2 + r() * 6), MX(x + (r() - 0.5) * 0.4, s * 0.22 + l * s * 0.52, z + (r() - 0.5) * 0.4, 1 - l * 0.12, 1, 1 - l * 0.15, r() * 6, (r() - 0.5) * 0.3, (r() - 0.5) * 0.35));
    }
    ctx.solids.add(x, z, s * 0.95);
    n++;
  }
  // Scattered hoodoos on the valley floor
  n = 0;
  for (let i = 0; i < 2000 && n < 16 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    const d = wallDist(x, z);
    if (d < -7 || d > -2.5 || special(x, z, 2) || viewBlocked(x, z) || !ctx.clear(x, z, 2.5) || railNear(x, z, 3) || ctx.solids.blocked(x, z, 2)) continue;
    if (Math.hypot(x - SPOT.hoodoo[0], z - SPOT.hoodoo[1]) < 20) continue;
    hoodoo(ctx, x, z, 3 + r() * 4.5);
    n++;
  }
}

// ───────────────────────── Plants ─────────────────────────

/** Juniper: a twisted trunk, flat clumps of gray-green needles */
function juniper(ctx: FieldCtx, x: number, z: number, s: number, solid: boolean): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.4 * s);
  const lean = (r() - 0.5) * 0.5;
  const ry = r() * 6;
  b.add(new THREE.CylinderGeometry(0.1 * s, 0.24 * s, 1.8 * s, 5), COL.bark, MX(x, 0.85 * s, z, 1, 1, 1, ry, lean, lean * 0.6));
  b.add(new THREE.CylinderGeometry(0.06 * s, 0.1 * s, 1.1 * s, 4), COL.bark, MX(x + Math.cos(ry) * 0.4 * s, 1.6 * s, z + Math.sin(ry) * 0.4 * s, 1, 1, 1, ry, -lean * 1.5, 0.9), false);
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = (0.3 + r() * 0.6) * s;
    const rr = (0.55 + r() * 0.4) * s;
    b.add(new THREE.IcosahedronGeometry(rr, 0), COL.juniper[i % 3], MX(x + Math.cos(a) * d + lean * s, (1.7 + r() * 0.9) * s, z + Math.sin(a) * d, 1.2, 0.72, 1.2, r() * 6));
  }
  if (solid) ctx.solids.add(x, z, 0.35 * s);
}

/** Sage bush: a low gray-green shrub */
function sage(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.3 * s);
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 0.35 * s;
    const rr = (0.3 + r() * 0.25) * s;
    b.add(new THREE.IcosahedronGeometry(rr, 0), COL.sage[i % 3], MX(x + Math.cos(a) * d, rr * 0.7, z + Math.sin(a) * d, 1, 0.75, 1, r() * 6), false);
  }
  if (r() < 0.3) b.add(new THREE.IcosahedronGeometry(0.12 * s, 0), 0xf2c848, MX(x, 0.55 * s, z, 1, 1, 1), false);
}

/** Dead tree: bleached, twisted branches */
function snag(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.3);
  const ry = r() * 6;
  const lean = 0.12 + r() * 0.12;
  // Trunk: leans from the ground up to the top; two branches split off from it (attached to the trunk, so they don't float
  // beside it)
  const base = new THREE.Vector3(x, -0.1, z);
  const top = new THREE.Vector3(x + Math.sin(ry) * lean * 2.6 * s, 2.6 * s, z + Math.cos(ry) * lean * 2.6 * s);
  stick(b, base, top, 0.22 * s, 0.07 * s, COL.snag, true);
  for (const [u, da, len, up] of [[0.55, 1.9, 1.3, 0.9], [0.78, -2.1, 1.0, 1.2], [0.35, 3.4, 0.6, 0.5]] as const) {
    const a = base.clone().lerp(top, u);
    const dir = ry + da;
    const e = new THREE.Vector3(a.x + Math.sin(dir) * len * s, a.y + up * len * s, a.z + Math.cos(dir) * len * s);
    stick(b, a, e, 0.07 * s * (1 - u * 0.4), 0.025 * s, COL.snag, false);
  }
  ctx.solids.add(x, z, 0.3 * s);
}

/** A tapered cylinder between two points (coordinates relative to b.lift) */
function stick(b: FieldCtx['b'], a: THREE.Vector3, e: THREE.Vector3, r0: number, r1: number, col: number, outline: boolean): void {
  const d = e.clone().sub(a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 5);
  const m = new THREE.Matrix4().compose(a.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1));
  b.add(g, col, m, outline);
}

function plants(ctx: FieldCtx, railNear: (x: number, z: number, m: number) => boolean): void {
  const { r } = ctx;
  const S = SIZE - 6;
  const k = ctx.low ? 0.5 : 1;
  // Junipers: clump after clump on the valley floor along the wall feet (noise decides where they grow)
  let n = 0;
  for (let i = 0; i < 6000 && n < 120 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    const d = wallDist(x, z);
    // Hug the wall foot and stay a bit away from the main road (the camera follows behind the player, and big trees would block
    // the view)
    if (d > -0.8 || d < -5.5 || special(x, z, 1) || viewBlocked(x, z)) continue;
    if (r() > smooth(0.35, 0.7, vnoise(x * 0.06 + 20, z * 0.06))) continue;
    if (!ctx.clear(x, z, 2.5) || railNear(x, z, 2.5) || ctx.solids.blocked(x, z, 1.2)) continue;
    juniper(ctx, x, z, 0.8 + r() * 0.6, true);
    n++;
  }
  // Sage
  n = 0;
  for (let i = 0; i < 8000 && n < 380 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    if (!isFloor(x, z, 0.3) || special(x, z)) continue;
    if (r() > 0.25 + smooth(0.3, 0.7, vnoise(x * 0.08, z * 0.08 + 9)) * 0.75) continue;
    if (ctx.pathDist(x, z) < ctx.layout.pathW + 0.6 || railNear(x, z, 1.2) || ctx.solids.blocked(x, z, 0.4)) continue;
    sage(ctx, x, z, 0.7 + r() * 0.7);
    n++;
  }
  // Dead trees
  n = 0;
  for (let i = 0; i < 3000 && n < 26 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    if (!isFloor(x, z, 1.5) || special(x, z, 1) || viewBlocked(x, z) || !ctx.clear(x, z, 1.2) || railNear(x, z, 2) || ctx.solids.blocked(x, z, 1)) continue;
    snag(ctx, x, z, 0.9 + r() * 0.7);
    n++;
  }
  // Desert wildflowers in the basin and by the Glassworks
  const fc = [0xf08a3a, 0xe2503a, 0xf2c848, 0xf6e0c8];
  n = 0;
  for (let i = 0; i < 3000 && n < 70 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    if (!isFloor(x, z, 1) || special(x, z)) continue;
    const near = Math.min(Math.hypot(x - TOWN[0], z - TOWN[1]) - 34, Math.hypot(x - SPOT.glass[0], z - SPOT.glass[1]) - 6);
    if (near > 22 || near < 0) continue;
    if (ctx.pathDist(x, z) < ctx.layout.pathW + 0.5 || ctx.solids.blocked(x, z, 0.5)) continue;
    flowers(ctx, x, z, fc, 4);
    n++;
  }
  // Rock piles at the forks (the dwarves use them to mark the way)
  for (const [x, z] of [[6, -18], [-18, 12], [-44, 18], [40, -18], [62, -40], [-38, -30], [14, -62]] as const) {
    if (!isFloor(x, z, 0.5) || ctx.solids.blocked(x, z, 0.8) || ctx.pathDist(x, z) < ctx.layout.pathW + 0.6) continue;
    cairn(ctx, x, z);
  }
}

function cairn(ctx: FieldCtx, x: number, z: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.5);
  let y = 0;
  for (let i = 0; i < 5; i++) {
    const s = 0.55 - i * 0.08;
    b.add(new THREE.DodecahedronGeometry(1, 0), i % 2 ? COL.stone2 : 0xa88a70, MX(x + (r() - 0.5) * 0.08, y + s * 0.35, z, s, s * 0.55, s * 0.9, r() * 6));
    y += s * 0.62;
  }
  ctx.solids.add(x, z, 0.5);
}

// ───────────────────────── Mesa tops ─────────────────────────

/**
 * Mesa tops and wall ledges: sparse junipers, small spire rocks and loose stones (so the view from above or from a height isn't
 * one big empty expanse)
 */
function tops(ctx: FieldCtx): void {
  const { b, r } = ctx;
  const S = SIZE - 3;
  const k = ctx.low ? 0.5 : 1;
  let n = 0;
  for (let i = 0; i < 9000 && n < 260 * k; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    const d = wallDist(x, z);
    if (d < 1.5 || special(x, z, 2)) continue;
    const y = ctx.h(x, z);
    const up = y - floorH(x, z);
    if (up < 5) continue;
    // Only place them on flat ground
    const e = 0.8;
    const sl = Math.max(Math.abs(ctx.h(x + e, z) - ctx.h(x - e, z)), Math.abs(ctx.h(x, z + e) - ctx.h(x, z - e))) / (2 * e);
    if (sl > 0.3) continue;
    const pick = r();
    if (pick < 0.5) {
      if (r() > smooth(0.35, 0.65, vnoise(x * 0.05 + 7, z * 0.05))) continue;
      juniper(ctx, x, z, 1 + r() * 1.2, false);
    } else if (pick < 0.62) {
      // Small hoodoos
      hoodoo(ctx, x, z, 2.5 + r() * 3, false);
    } else {
      ctx.place(x, z, 0.6);
      const s = 0.4 + r() * 1.1;
      b.add(new THREE.DodecahedronGeometry(1, 0), bandCol(y + 1 + r() * 3), MX(x, s * 0.3, z, s * 1.2, s * 0.6, s, r() * 6), s > 0.9);
    }
    n++;
  }
}

// ───────────────────────── Outer plateau and the distance ─────────────────────────

function outerPlateau(ctx: FieldCtx): void {
  const S = SIZE;
  const W = 900;
  const shape = new THREE.Shape([new THREE.Vector2(-W, -W), new THREE.Vector2(W, -W), new THREE.Vector2(W, W), new THREE.Vector2(-W, W)]);
  shape.holes.push(new THREE.Path([new THREE.Vector2(-S + 0.5, -S + 0.5), new THREE.Vector2(-S + 0.5, S - 0.5), new THREE.Vector2(S - 0.5, S - 0.5), new THREE.Vector2(S - 0.5, -S + 0.5)]));
  const top = new THREE.ShapeGeometry(shape);
  top.rotateX(-Math.PI / 2);
  top.translate(0, RIM + 0.02, 0);
  // A ring of wall going down from the map edge (so no gap shows if the terrain edge happens to sit lower than the plateau)
  const skirt = new THREE.BufferGeometry();
  const pos: number[] = [];
  const nrm: number[] = [];
  const corners: [number, number, number, number][] = [
    [-S, -S, S, -S],
    [S, -S, S, S],
    [S, S, -S, S],
    [-S, S, -S, -S],
  ];
  const y0 = RIM - 14;
  for (const [x0, z0, x1, z1] of corners) {
    const nx = -(z1 - z0);
    const nz = x1 - x0;
    const l = Math.hypot(nx, nz);
    pos.push(x0, y0, z0, x1, y0, z1, x1, RIM, z1, x0, y0, z0, x1, RIM, z1, x0, RIM, z0);
    for (let i = 0; i < 6; i++) nrm.push(nx / l, 0, nz / l);
  }
  skirt.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  skirt.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  const mat = plateauMaterial(0xb06a44, 0x8a8a54);
  const m1 = new THREE.Mesh(top, mat);
  const m2 = new THREE.Mesh(skirt, mat);
  mat.side = THREE.DoubleSide;
  ctx.group.add(m1, m2);
  ctx.disposers.push(() => {
    top.dispose();
    skirt.dispose();
    mat.dispose();
  });
  // Sparse junipers and rocks on the outer plateau (so looking outward from a height isn't one big empty flat)
  const { b, r } = ctx;
  for (let i = 0; i < (ctx.low ? 50 : 110); i++) {
    const x = (r() * 2 - 1) * 200;
    const z = (r() * 2 - 1) * 200;
    const m = Math.max(Math.abs(x), Math.abs(z));
    if (m < S + 3) continue;
    b.lift = RIM;
    if (r() < 0.65) {
      const k = 1 + r() * 1.4;
      b.add(new THREE.CylinderGeometry(0.12 * k, 0.22 * k, 1.6 * k, 5), COL.bark, MX(x, 0.8 * k, z, 1, 1, 1), false);
      b.add(new THREE.IcosahedronGeometry(1, 0), COL.juniper[i % 3], MX(x, 2.0 * k, z, 1.3 * k, 0.9 * k, 1.3 * k, r() * 6), false);
    } else {
      const k = 0.8 + r() * 1.6;
      b.add(new THREE.DodecahedronGeometry(1, 0), bandCol(4 + r() * 10), MX(x, 0.3 * k, z, 1.3 * k, 0.6 * k, k, r() * 6), false);
    }
  }
  // Distant spires and mesas: a ring of silhouettes
  b.lift = 0;
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + r() * 0.15;
    const d = S * 1.35 + r() * 170;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    mesa(ctx, x, z, 9 + r() * 16, 14 + r() * 38);
  }
}

/** Distant mesa: a cylinder of strata narrowing toward the top, with a dark bedding line between layers */
function mesa(ctx: FieldCtx, x: number, z: number, w: number, h: number): void {
  const { b, r } = ctx;
  const n = 3 + Math.floor(r() * 3);
  const ry = r() * 6;
  let y = RIM;
  let rad = w;
  for (let i = 0; i < n; i++) {
    const hb = (h / n) * (0.7 + r() * 0.6);
    const top = rad * (0.8 + r() * 0.14);
    b.add(new THREE.CylinderGeometry(top, rad, hb, 7), bandCol(y + hb * 0.5 - RIM + 3), MX(x, y + hb / 2, z, 1, 1, 1, ry + i * 0.3), false);
    y += hb;
    rad = top;
  }
  b.add(new THREE.CylinderGeometry(rad * 0.98, rad, 0.8, 7), 0xa05a3e, MX(x, y + 0.4, z, 1, 1, 1, ry), false);
}

// ───────────────────────── Moving things ─────────────────────────

function life(ctx: FieldCtx): void {
  // Vultures: circle slowly over the canyon, flapping their wings now and then
  const birds: { g: THREE.Group; wl: THREE.Object3D; wr: THREE.Object3D; cx: number; cz: number; R: number; y: number; sp: number; ph: number }[] = [];
  const body = new THREE.CapsuleGeometry(0.28, 0.9, 3, 6);
  body.rotateX(Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    g.add(dynMesh(ctx, body.clone(), 0x3a2a26));
    const wing = new THREE.BoxGeometry(2.6, 0.06, 0.8);
    wing.translate(1.3, 0, 0);
    const wl = dynMesh(ctx, wing.clone(), 0x2e2220);
    const wr = dynMesh(ctx, wing.clone(), 0x2e2220);
    wr.scale.x = -1;
    g.add(wl, wr);
    const head = dynMesh(ctx, new THREE.SphereGeometry(0.2, 6, 5), 0xd8b8a0, false);
    head.position.z = 0.75;
    g.add(head);
    ctx.group.add(g);
    const [cx, cz] = [[0, -20], [-40, -30], [40, 0], [10, 30], [-30, 40]][i];
    birds.push({ g, wl, wr, cx, cz, R: 22 + i * 7, y: 46 + i * 5, sp: 0.12 + i * 0.02, ph: i * 1.7 });
  }
  body.dispose();
  // Dust devils: wander the Quicksand Hollow and Hoodoo Valley
  const devils: { m: THREE.Mesh; cx: number; cz: number; R: number; sp: number; ph: number }[] = [];
  const dmat = dustDevilMaterial(0xe0b080);
  ctx.disposers.push(() => dmat.dispose());
  for (const [cx, cz, R] of [[SPOT.quick[0] + 4, SPOT.quick[1] + 2, 11], [SPOT.hoodoo[0], SPOT.hoodoo[1] + 2, 9], [-24, 44, 12]] as const) {
    const geo = new THREE.CylinderGeometry(3.4, 0.45, 15, 20, 6, true);
    geo.translate(0, 7.5, 0);
    const m = new THREE.Mesh(geo, dmat);
    m.renderOrder = 5;
    ctx.group.add(m);
    ctx.disposers.push(() => geo.dispose());
    devils.push({ m, cx, cz, R, sp: 0.05 + devils.length * 0.013, ph: devils.length * 2.1 });
  }
  // Tumbleweeds: roll across the basin with the wind (toward the east)
  // A tangle of twigs: dozens of thin twigs passing through the center of the ball, in random directions
  const twigs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 26; i++) {
    const g = new THREE.BoxGeometry(0.035, 0.035, 0.7 + Math.random() * 0.45);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)));
    g.translate((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25);
    twigs.push(g);
  }
  const weedGeo = mergeGeometries(twigs)!;
  twigs.forEach((g) => g.dispose());
  const weeds: { m: THREE.Mesh; z: number; x0: number; x1: number; sp: number; x: number }[] = [];
  for (const [z, x0, x1] of [[34, -50, -12], [58, 36, 52], [-12, 36, 62], [-40, -70, -42]] as const) {
    const m = dynMesh(ctx, weedGeo.clone(), 0xa88a58, false);
    ctx.group.add(m);
    weeds.push({ m, z, x0, x1, sp: 2.6 + Math.random(), x: x0 + Math.random() * (x1 - x0) });
  }
  weedGeo.dispose();

  let rockT = 3;
  ctx.extras.push((dt, t, vfx) => {
    dmat.uniforms.uTime.value = t;
    for (const bd of birds) {
      const a = t * bd.sp + bd.ph;
      const x = bd.cx + Math.cos(a) * bd.R;
      const z = bd.cz + Math.sin(a) * bd.R;
      bd.g.position.set(x, bd.y + Math.sin(t * 0.3 + bd.ph) * 2, z);
      bd.g.rotation.set(0, Math.atan2(-Math.sin(a), Math.cos(a)), 0.28);
      const flap = Math.max(0, Math.sin(t * 0.4 + bd.ph * 3)) > 0.85 ? Math.sin(t * 9) * 0.5 : 0.08;
      bd.wl.rotation.z = flap;
      bd.wr.rotation.z = -flap;
    }
    for (const d of devils) {
      const a = t * d.sp + d.ph;
      const x = d.cx + Math.cos(a) * d.R * 0.6 + Math.sin(a * 2.3) * d.R * 0.4;
      const z = d.cz + Math.sin(a * 1.3) * d.R * 0.6;
      d.m.position.set(x, ctx.h(x, z) - 0.3, z);
      d.m.rotation.y = -t * 2.2;
      if (Math.random() < dt * 6 && vfx.camPos.distanceTo(d.m.position) < 80) {
        vfx.smoke({ pos: d.m.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.3, (Math.random() - 0.5) * 2)), count: 1, color: [0xe0b080, 0xc8966a], speed: [1, 2.5], dir: new THREE.Vector3(0.3, 1, 0), spread: 0.6, life: [1.5, 2.5], size: [0.5, 0.9], sizeEnd: 2.2, drag: 0.3, intensity: 0.6 });
      }
    }
    for (const w of weeds) {
      w.x += dt * w.sp;
      if (w.x > w.x1) w.x = w.x0;
      const bump = Math.abs(Math.sin(t * 4 + w.x)) * 0.35;
      w.m.position.set(w.x, ctx.h(w.x, w.z) + 0.55 + bump, w.z + Math.sin(w.x * 0.3) * 1.5);
      w.m.rotation.z -= (dt * w.sp) / 0.55;
    }
    // The ground trembles: now and then rocks roll down from a cliff top near the camera
    rockT -= dt;
    if (rockT < 0) {
      rockT = 2.5 + Math.random() * 5;
      for (let k = 0; k < 12; k++) {
        const a = Math.random() * Math.PI * 2;
        const d = 12 + Math.random() * 28;
        const x = vfx.camPos.x + Math.cos(a) * d;
        const z = vfx.camPos.z + Math.sin(a) * d;
        const wd = wallDist(x, z);
        if (wd < 1.5 || wd > 5) continue;
        const y = ctx.h(x, z);
        vfx.emit({ pos: new THREE.Vector3(x, y + 0.3, z), count: 6, color: [0x9a5a3a, 0xc07a4a], speed: [0.5, 1.5], dir: new THREE.Vector3(0, 0.2, 0), spread: 1, life: [1.2, 1.8], size: [0.12, 0.22], gravity: -12, intensity: 0.9 });
        vfx.smoke({ pos: new THREE.Vector3(x, y, z), count: 3, color: 0xd0a078, speed: [0.3, 0.8], dir: new THREE.Vector3(0, -0.5, 0), spread: 0.6, life: [1.5, 2.5], size: [0.5, 0.9], sizeEnd: 2, intensity: 0.5 });
        break;
      }
    }
  });
  void TOWER;
}
