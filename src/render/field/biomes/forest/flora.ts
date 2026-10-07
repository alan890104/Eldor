// Vegetation: first the structural giant trees (the giant-tree colonnade, the tree line along the cliff top, the ancient woods
// around the tower, the tree wall on the rim wall), then mid-size trees filled in on a jittered grid by canopy density
// woods(), and finally the understory ferns, shrubs, flower clumps, mushrooms and mossy rocks.
// Dense forest alternates with clearings, and the roadside has a border of ferns and flowers.

import * as THREE from 'three';
import { smooth } from '../../compose.ts';
import type { FieldCtx, XZ } from '../../kit.ts';
import { cliffW, cliffZ, lakeE, MAIN_PATH, MEADOW, plateauK, S, TRAILS, WL, woods } from './geo.ts';
import { birch, bushAt, COL, fernAt, fir, flowerBush, flowerPatch, FLOWERS, giant, logAt, mossRockAt, MX, oak, put, shroomCluster, T, wallTree } from './plants.ts';

/** Structural giant trees: [x, z, radius, height] */
const GIANTS: [number, number, number, number][] = [
  // Giant-tree colonnade: where the main road enters the forest from the Wildflower Slope, pairs of giant trees on both sides
  [13, 12, 2.2, 30],
  [-8, 15, 2.0, 27],
  [12, -3, 2.4, 33],
  [-18, 13, 1.8, 25],
  [21, 1, 1.9, 27],
  // Tree line along the cliff top: seen from the lowland, a row of giant trees stands on the cliff
  [-34, -52, 2.3, 32],
  [-20, -51, 2.0, 29],
  [35, -58, 2.2, 31],
  [44, -54, 2.0, 28],
  [-62, -50, 2.1, 30],
  // Ancient woods around the tower
  [51, -68, 2.6, 36],
  [52, -92, 2.4, 34],
  [-15, -92, 2.6, 37],
  [-16, -70, 2.2, 32],
  [-30, -82, 2.3, 33],
  [66, -80, 2.2, 31],
  [-2, -95, 2.0, 30],
  [36, -97, 2.1, 30],
  // North shore of the lake and the east slope
  [52, -14, 2.1, 29],
  [72, -8, 2.3, 31],
  [72, -34, 2.0, 28],
  [80, 20, 2.2, 30],
  // West woods and south slope (the old trees around the village)
  [-80, -18, 2.3, 32],
  [-82, 40, 2.1, 30],
  [-42, 64, 2.4, 33],
  [-64, 70, 2.1, 30],
  [30, 80, 2.2, 31],
  [46, 64, 2.0, 28],
  [66, 50, 2.3, 32],
  [-78, 6, 2.0, 28],
];

/** Jittered grid: one random point per cell */
function jitter(r: () => number, cell: number, lo: number, hi: number, fn: (x: number, z: number) => void): void {
  for (let gz = lo; gz < hi; gz += cell) for (let gx = lo; gx < hi; gx += cell) fn(gx + r() * cell, gz + r() * cell);
}

function slopeAt(ctx: FieldCtx, x: number, z: number): number {
  const h = ctx.h;
  return Math.hypot(h(x + 1, z) - h(x - 1, z), h(x, z + 1) - h(x, z - 1)) / 2;
}

/** No large trees on the fixed cameras (the dev-view town/tower presets) or on important sight lines */
const VIEWS: [number, number, number, number, number][] = [
  [22, 100, 2, 78, 8],
  [26, -28, 19, -64, 6],
  // Tower camera: the stretch of view near the camera is wider
  [26, -30, 17, -50, 11],
  // Leave the area beside the Fallen Giant clear, so the whole trunk can be seen
  [-58, 37, -24, 28, 7.5],
];
function inView(x: number, z: number): boolean {
  for (const [ax, az, bx, bz, w] of VIEWS) {
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) < w) return true;
  }
  return false;
}

const meadowE = (x: number, z: number) => Math.hypot((x - MEADOW.x) / MEADOW.rx, (z - MEADOW.z) / MEADOW.rz);

export function buildFlora(ctx: FieldCtx): void {
  const { b, r, low } = ctx;
  const kt = low ? 0.62 : 1;
  const ku = low ? 0.5 : 1;

  // ── Structural giant trees
  for (const [x, z, R, H] of GIANTS) {
    if (!ctx.clear(x, z, R + 1) || ctx.solids.blocked(x, z, R)) continue;
    giant(ctx, x, z, { R, H, leaves: r() < 0.3 ? [COL.leafDark, COL.leaf[1], COL.leaf[0]] : COL.leaf });
  }

  // ── Rim wall: the outer tree wall. Walkable foothills get colliding trees; higher up are silhouettes without outlines
  jitter(r, 7.5, -S + 3, S - 3, (x, z) => {
    const m = Math.max(Math.abs(x), Math.abs(z));
    if (m < S - 30 || m > S - 2) return;
    if (!ctx.clear(x, z, 2) || inView(x, z)) return;
    if (m < S - 19) {
      if (r() > 0.7 * kt || ctx.solids.blocked(x, z, 2)) return;
      if (r() < 0.4) giant(ctx, x, z, { R: 1.5 + r() * 0.8, H: 20 + r() * 10, lite: true, leaves: r() < 0.5 ? [COL.leafDark, COL.leaf[1]] : COL.leaf });
      else if (r() < 0.5) fir(ctx, x, z, 1.4 + r() * 0.7);
      else oak(ctx, x, z, 1.6 + r() * 0.6, [COL.leafDark, COL.leaf[1], COL.leaf[0]]);
    } else {
      if (r() > 0.95 * kt) return;
      wallTree(ctx, x, z, 0.95 + r() * 0.45);
    }
  });

  // ── Scrub on the rim wall slope: low clumps pressed flat against the slope (squashed along the normal) that cover
  // the bare slope (no outline, no collision)
  const up = new THREE.Vector3(0, 1, 0);
  const nrm = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const mat = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const mound = (x: number, z: number, s: number, color: number) => {
    const h = ctx.h;
    nrm.set(h(x - 1, z) - h(x + 1, z), 2, h(x, z - 1) - h(x, z + 1)).normalize();
    q.setFromUnitVectors(up, nrm).multiply(q2.setFromAxisAngle(up, r() * 6));
    pos.set(x, h(x, z), z).addScaledVector(nrm, -s * 0.18);
    put(b, low ? T.ico0 : T.ico1, color, mat.compose(pos, q, scl.set(s * 1.25, s * 0.62, s * 1.05)), false);
  };
  b.lift = 0;
  jitter(r, low ? 7 : 5.5, -S + 3, S - 3, (x, z) => {
    const m = Math.max(Math.abs(x), Math.abs(z));
    if (m < S - 27 || m > S - 3 || inView(x, z)) return;
    if (!ctx.clear(x, z, 1)) return;
    const s = 1.8 + r() * 1.6;
    mound(x, z, s, r() < 0.5 ? COL.leafDark : r() < 0.5 ? COL.leaf[1] : 0x5e8e48);
    if (r() < 0.5) mound(x + s * 0.8, z - s * 0.6, s * 0.65, COL.leaf[0]);
  });

  // ── Giant trees scattered through the dense forest
  jitter(r, 17, -S + 20, S - 20, (x, z) => {
    const w = woods(x, z);
    if (w < 0.72 || r() > 0.5 * kt) return;
    if (!ctx.clear(x, z, 4) || ctx.solids.blocked(x, z, 5) || inView(x, z)) return;
    if (ctx.h(x, z) < WL + 0.8 || slopeAt(ctx, x, z) > 0.5) return;
    giant(ctx, x, z, { R: 1.4 + r() * 0.7, H: 19 + r() * 9, lite: r() < 0.5 });
  });

  // ── Mid-size trees: by canopy density
  jitter(r, 5.4, -S + 6, S - 6, (x, z) => {
    const m = Math.max(Math.abs(x), Math.abs(z));
    if (m > S - 30) return;
    const w = woods(x, z);
    if (r() > w * 0.95 * kt) return;
    // Leave room for the camera beside the road (the camera follows 11 meters behind the character and 5 meters above the ground;
    // a canopy hanging too low would block it)
    if (!ctx.clear(x, z, 2.2) || inView(x, z)) return;
    const pd = ctx.pathDist(x, z);
    const hh = ctx.h(x, z);
    if (hh < WL + 0.6) return;
    const sl = slopeAt(ctx, x, z);
    if (sl > 0.85) return;
    if (ctx.solids.blocked(x, z, 1.4)) return;
    const pk = plateauK(x, z);
    const me = meadowE(x, z);
    const u = r();
    if (pd < 9) {
      // Roadside: birches and firs with slender trunks and high canopies, which block the camera less
      if (u < 0.55) birch(ctx, x, z, 1.1 + r() * 0.4);
      else fir(ctx, x, z, 1.1 + r() * 0.4);
    } else if (pk > 0.9) {
      if (u < 0.35) fir(ctx, x, z, 1.2 + r() * 0.6);
      else oak(ctx, x, z, 1.4 + r() * 0.7, r() < 0.4 ? [COL.leafDark, COL.leaf[0]] : COL.leaf);
    } else if (me < 1.6) {
      if (u < 0.45) birch(ctx, x, z, 1.0 + r() * 0.4);
      else oak(ctx, x, z, 1.2 + r() * 0.5, COL.leaf);
    } else if (u < 0.1) fir(ctx, x, z, 1.2 + r() * 0.6);
    else if (u < 0.22) birch(ctx, x, z, 1.1 + r() * 0.4);
    else oak(ctx, x, z, 1.3 + r() * 0.8, r() < 0.3 ? [COL.leafDark, COL.leaf[1], COL.leaf[0]] : COL.leaf);
  });

  // ── Rubble slope at the cliff foot: large and small mossy rocks
  for (let x = -96; x < 60; x += 3.2) {
    if (r() > 0.55 * kt) continue;
    const z = cliffZ(x) + 1 + r() * 7;
    if (!ctx.clear(x, z, 1) || ctx.h(x, z) < WL + 0.4) continue;
    if (ctx.solids.blocked(x, z, 1.2)) continue;
    mossRockAt(ctx, x, z, 0.6 + r() * 1.3);
  }
  // Also place a row along the cliff-top edge (seen from below, the cliff top has the outline of rocks and shrubs)
  for (let x = -96; x < 40; x += 4) {
    if (r() > 0.45 * kt) continue;
    const z = cliffZ(x) - cliffW(x) - 2.2 - r() * 3;
    if (!ctx.clear(x, z, 1) || ctx.solids.blocked(x, z, 1)) continue;
    // Cliff top: do not take the lowest point around (it would land on the cliff face and float in mid-air)
    if (r() < 0.5) mossRockAt(ctx, x, z, 0.8 + r() * 1.0, true, 0);
    else bushAt(ctx, x, z, 1.2 + r() * 0.8);
  }

  // ── Understory: ferns, shrubs, mushrooms, mossy rocks; flower clumps on the grassland
  jitter(r, 2.7, -S + 6, S - 6, (x, z) => {
    const m = Math.max(Math.abs(x), Math.abs(z));
    if (m > S - 24) return;
    if (!ctx.clear(x, z, 0.2)) return;
    const hh = ctx.h(x, z);
    if (hh < WL + 0.35) return;
    if (ctx.solids.blocked(x, z, 0.6)) return;
    const w = woods(x, z);
    const me = meadowE(x, z);
    const u = r();
    if (me < 1.05) {
      if (u < 0.3 * ku) flowerPatch(ctx, x, z, FLOWERS, 5 + Math.floor(r() * 4), 1.6);
      else if (u < 0.33 * ku) flowerBush(ctx, x, z, 0.8 + r() * 0.5, FLOWERS[Math.floor(r() * FLOWERS.length)]);
      return;
    }
    if (slopeAt(ctx, x, z) > 0.9) return;
    if (u < w * 0.34 * ku) fernAt(ctx, x, z, 0.8 + r() * 0.8);
    else if (u < w * 0.34 * ku + 0.07 * ku) bushAt(ctx, x, z, 0.8 + r() * 0.9);
    else if (u < w * 0.34 * ku + 0.07 * ku + w * w * 0.05 * ku) shroomCluster(ctx, x, z, 2 + Math.floor(r() * 3), 1.2);
    else if (u < w * 0.34 * ku + 0.07 * ku + w * w * 0.05 * ku + 0.012) mossRockAt(ctx, x, z, 0.4 + r() * 0.6);
    else if (w < 0.35 && u > 1 - 0.12 * ku) flowerPatch(ctx, x, z, FLOWERS, 4, 1.2);
  });

  // ── Fallen logs
  for (let i = 0; i < 24 * kt; i++) {
    const x = (r() * 2 - 1) * (S - 30);
    const z = (r() * 2 - 1) * (S - 30);
    if (woods(x, z) < 0.45 || !ctx.clear(x, z, 3.5) || ctx.solids.blocked(x, z, 3)) continue;
    if (slopeAt(ctx, x, z) > 0.35 || ctx.h(x, z) < WL + 0.5) continue;
    logAt(ctx, x, z, 3.5 + r() * 3, r() * Math.PI);
  }

  // ── Roadside border: ferns, flowers, small stones, so the road looks like one worn by walkers
  const roads: XZ[][] = [MAIN_PATH, ...TRAILS];
  for (const line of roads) {
    const curve = new THREE.CatmullRomCurve3(line.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const n = Math.round(curve.getLength() / 2.2);
    const pts = curve.getSpacedPoints(n);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const t = pts[i].clone().sub(pts[i - 1]).normalize();
      for (const side of [-1, 1]) {
        if (r() > 0.55 * ku) continue;
        const off = 3.3 + r() * 1.8;
        const x = p.x - t.z * side * off;
        const z = p.z + t.x * side * off;
        if (!ctx.clear(x, z, -0.3) || ctx.h(x, z) < WL + 0.4) continue;
        if (ctx.solids.blocked(x, z, 0.5)) continue;
        const w = woods(x, z);
        const u = r();
        if (lakeE(x, z) < 1.3) continue;
        if (w > 0.4 && u < 0.6) fernAt(ctx, x, z, 0.7 + r() * 0.5);
        else if (u < 0.75) flowerPatch(ctx, x, z, FLOWERS, 4, 1.0);
        else if (u < 0.88) bushAt(ctx, x, z, 0.6 + r() * 0.5);
        else mossRockAt(ctx, x, z, 0.3 + r() * 0.3, false);
      }
    }
  }
  void smooth;
}
