// Landmarks of the rift: the Core Isle (the Seal Tower held to the isle by four huge chains), the Old Kingdom Road and the
// Uncrowned's Gate, the broken bridge in the north,
// the fallen statue of the Uncrowned King and the rolled-off crown, the colonnade of the kingdom ruins,
// the Inverted Quarter, the Blightcrystal Basin and the Eye of the Void, the knight's tomb, the strata slabs of the cracked fields,
// the Shattered Heart Altar on the secret-realm isle; and the dead trees, rocks, crystals and broken walls scattered around.

import * as THREE from 'three';
import { M, PropBatch, rng } from '../../../arenaKit.ts';
import { catenary, rope } from '../../../arenas/_woods.ts';
import type { FieldCtx } from '../../kit.ts';
import { scatterMask, shaftsAt } from '../../props.ts';
import { glowDisc } from './decals.ts';
import type { Banners, Flames } from './fx.ts';
import type { RiftClock } from './glsl.ts';
import type { Debris } from './void.ts';
import { COL, column, crystalCluster, deadTree, fallenColumn, shard, upthrust } from './props.ts';
import { BASIN, bridgeEnds, COLOSSUS, CRACKS, CRATER, CROWN, FIELD, GRAVES, HOLES, ISLE, land, RIN, sm, T, TOWN } from './shape.ts';
import { floatingIsland } from './void.ts';
import { SoloBatch } from './inst.ts';

const DEG = Math.PI / 180;
const IRON = 0x3a3444;
const STEEL = 0xa8aebe;
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// ───────────────────────── Core Isle ─────────────────────────

/** A chain strung from links (along a catenary, with adjacent links turned 90 degrees) */
function chain(b: PropBatch, a: THREE.Vector3, c: THREE.Vector3, sag: number, R: number, col: number): void {
  const len = a.distanceTo(c);
  const n = Math.max(4, Math.round(len / (R * 1.9)));
  const pts = catenary(a, c, sag, n);
  const up = V3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    const dir = q.clone().sub(p).normalize();
    const rot = new THREE.Quaternion().setFromUnitVectors(up, dir).multiply(new THREE.Quaternion().setFromAxisAngle(up, i % 2 ? Math.PI / 2 : 0));
    const g = new THREE.TorusGeometry(R, R * 0.26, 5, 10);
    g.scale(0.72, 1.3, 1);
    b.add(g, col, new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(0.5), rot, new THREE.Vector3(1, 1, 1)));
  }
}

/** A headless ancient knight statue: pedestal, armor, cape, both hands pressed on a sword planted in the ground (the head broke off long ago) */
function knightStatue(ctx: FieldCtx, x: number, z: number, face: number, s: number): void {
  const { b } = ctx;
  ctx.place(x, z, 1);
  const L = (lx: number, ly: number, lz: number, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(V3(x + Math.cos(face) * lx + Math.sin(face) * lz, ly, z - Math.sin(face) * lx + Math.cos(face) * lz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, face + ry, rz)), new THREE.Vector3(1, 1, 1));
  b.add(new THREE.BoxGeometry(1.9 * s, 0.5 * s, 1.9 * s), COL.stoneD, L(0, 0.25 * s, 0));
  b.add(new THREE.BoxGeometry(1.5 * s, 1.1 * s, 1.5 * s), COL.stone, L(0, 1.05 * s, 0));
  const y0 = 1.6 * s;
  // Legs, waist, breastplate, pauldrons
  for (const sx of [-0.28, 0.28]) b.add(new THREE.BoxGeometry(0.42 * s, 1.3 * s, 0.5 * s), COL.stoneL, L(sx * s, y0 + 0.65 * s, 0));
  b.add(new THREE.CylinderGeometry(0.62 * s, 0.5 * s, 0.7 * s, 8), COL.stone, L(0, y0 + 1.6 * s, 0));
  b.add(new THREE.CylinderGeometry(0.72 * s, 0.6 * s, 1.1 * s, 8), COL.stoneL, L(0, y0 + 2.45 * s, 0));
  for (const sx of [-1, 1]) b.add(new THREE.SphereGeometry(0.36 * s, 8, 6), COL.stoneL, L(sx * 0.75 * s, y0 + 2.9 * s, 0));
  // The snapped neck
  b.add(new THREE.CylinderGeometry(0.2 * s, 0.26 * s, 0.25 * s, 7), COL.stone, L(0, y0 + 3.1 * s, 0, 0, 0.2, 0.15));
  // Cape
  b.add(new THREE.BoxGeometry(1.3 * s, 2.8 * s, 0.14 * s), COL.stoneD, L(0, y0 + 1.6 * s, -0.4 * s, 0, 0.1, 0));
  // The arms pressing forward on the sword hilt
  for (const sx of [-1, 1]) b.add(new THREE.BoxGeometry(0.26 * s, 0.26 * s, 0.9 * s), COL.stoneL, L(sx * 0.42 * s, y0 + 2.2 * s, 0.4 * s, -sx * 0.35, -0.5, 0));
  b.add(new THREE.BoxGeometry(0.16 * s, 2.0 * s, 0.05 * s), COL.stoneL, L(0, y0 + 0.9 * s, 0.75 * s));
  b.add(new THREE.BoxGeometry(0.8 * s, 0.12 * s, 0.14 * s), COL.stone, L(0, y0 + 1.95 * s, 0.75 * s));
  b.add(new THREE.SphereGeometry(0.1 * s, 6, 5), COL.stone, L(0, y0 + 2.25 * s, 0.75 * s));
  // The corruption crack on the chest
  b.glow(new THREE.BoxGeometry(0.06 * s, 0.9 * s, 0.05 * s), COL.cryA, L(0.1 * s, y0 + 2.4 * s, 0.63 * s, 0, 0, 0.4));
  ctx.solids.add(x, z, 1.2 * s);
  b.lift = 0;
}

function towerIsland(ctx: FieldCtx, fl: Flames, r: () => number): void {
  const { b } = ctx;
  const hT = ctx.h(T[0], T[1]);
  const face = Math.atan2(TOWN[0] - T[0], TOWN[1] - T[1]);
  // The four huge chains: from the tower shaft to the anchor bases at the isle's edge, tethering the tower (and the rift) here
  for (const phi of [52, -52, 128, -128]) {
    const a = phi * DEG + face;
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    const ax = T[0] + dx * 22.6;
    const az = T[1] + dz * 22.6;
    const ah = ctx.place(ax, az, 1.6);
    b.add(new THREE.BoxGeometry(3.2, 1.0, 3.2), COL.stoneD, M(ax, 0.3, az, a));
    b.add(new THREE.BoxGeometry(2.2, 3.0, 2.2), COL.slab, M(ax, 2.2, az, a));
    b.add(new THREE.BoxGeometry(2.6, 0.5, 2.6), COL.stoneD, M(ax, 3.9, az, a));
    b.glow(new THREE.BoxGeometry(1.2, 1.8, 0.08), COL.cryB, M(ax - dx * 1.12, 2.2, az - dz * 1.12, a));
    const ring = new THREE.TorusGeometry(0.55, 0.16, 6, 12);
    b.add(ring, IRON, M(ax - dx * 1.25, 3.3, az - dz * 1.25, a));
    ctx.solids.add(ax, az, 1.9);
    b.lift = 0;
    chain(b, V3(T[0] + dx * 7.1, hT + 10.4, T[1] + dz * 7.1), V3(ax - dx * 1.3, ah + 3.2, az - dz * 1.3), 1.6, 0.36, IRON);
  }
  // The ring of stelae at the isle's edge: avoiding the tower door, the anchor bases and the broken bridge in the north
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r() * 0.2;
    const rel = wrap(a - face);
    if (Math.abs(rel) < 0.5 || Math.abs(Math.abs(rel) - 52 * DEG) < 0.2 || Math.abs(Math.abs(rel) - 128 * DEG) < 0.2 || Math.abs(Math.abs(rel) - Math.PI) < 0.3) continue;
    const d = 20.6 + r() * 1.6;
    const x = T[0] + Math.sin(a) * d;
    const z = T[1] + Math.cos(a) * d;
    if (land(x, z) < 1.6) continue;
    ctx.place(x, z, 0.8);
    const h = 2.4 + r() * 3.2;
    const fallen = r() < 0.25;
    if (fallen) {
      b.add(new THREE.BoxGeometry(1.2, h, 0.7), COL.stoneD, M(x, 0.4, z, a + 1.2, 1, Math.PI / 2 - 0.15, 0));
    } else {
      const tilt = (r() - 0.5) * 0.2;
      b.add(new THREE.BoxGeometry(1.3, h, 0.75), COL.stoneD, M(x, h / 2 - 0.2, z, a, 1, tilt, 0));
      b.glow(new THREE.BoxGeometry(0.14, h * 0.6, 0.05), COL.cryB, M(x - Math.sin(a) * 0.39, h * 0.5, z - Math.cos(a) * 0.39, a, 1, tilt, 0));
    }
    ctx.solids.add(x, z, 0.9);
    b.lift = 0;
  }
  // The bridgehead of the Old Kingdom Road: the Uncrowned's Gate (left pillar intact, right pillar broken,
  // the arch only half left) and two headless knight statues
  const gz = T[1] + 44 + 4.2;
  const gh = ctx.place(0, gz, 5);
  b.add(new THREE.BoxGeometry(1.6, 11, 1.6), COL.stoneD, M(-5.6, 5.5, gz));
  b.add(new THREE.BoxGeometry(2.2, 0.6, 2.2), COL.stone, M(-5.6, 11.1, gz));
  b.add(new THREE.BoxGeometry(1.6, 6.2, 1.6), COL.stoneD, M(5.6, 3.1, gz));
  b.add(new THREE.CylinderGeometry(0.3, 0.9, 1.0, 6), COL.stoneD, M(5.6, 6.5, gz, -0.4, 1, 0.2, -0.3));
  // The arch curves up and to the right from the top of the left pillar and breaks off just right of the middle
  b.add(new THREE.TorusGeometry(5.6, 0.65, 6, 18, Math.PI * 0.62), COL.stone, M(0, 11.2, gz, Math.PI));
  b.glow(new THREE.BoxGeometry(0.1, 7, 0.1), COL.cryA, M(-5.6, 5, gz - 0.82));
  for (const s of [-1, 1]) for (const bx of [-5.6, 5.6]) b.add(new THREE.BoxGeometry(2.4, 0.6, 2.4), COL.stone, M(bx, 0.3, gz + s * 0.1));
  ctx.solids.add(5.6, gz, 1.2);
  ctx.solids.add(-5.6, gz, 1.2);
  b.lift = 0;
  // The chain hanging from the broken arch
  const tipX = -5.6 * Math.cos(Math.PI * 0.62);
  const tipY = gh + 11.2 + 5.6 * Math.sin(Math.PI * 0.62);
  rope(b, V3(tipX, tipY, gz), V3(tipX + 0.4, tipY - 4.5, gz + 0.2), 0.2, 0.06, IRON);
  rope(b, V3(-1.5, gh + 16.5, gz), V3(-0.5, gh + 12.6, gz - 0.3), 0.1, 0.05, IRON);
  knightStatue(ctx, -6.2, gz + 4.8, Math.PI, 1.05);
  knightStatue(ctx, 6.2, gz + 4.8, Math.PI, 1.05);
  knightStatue(ctx, -4.6, T[1] + 22.7, Math.PI * 0.94, 0.95);
  knightStatue(ctx, 4.6, T[1] + 22.7, -Math.PI * 0.94, 0.95);
  // Will-o'-the-wisp lamps on both sides of the road (corrupted purple fire)
  for (const z of [T[1] + 30, T[1] + 38]) {
    for (const s of [-1, 1]) {
      const x = s * 4.2;
      const h0 = ctx.place(x, z, 0.4);
      b.add(new THREE.CylinderGeometry(0.14, 0.2, 2.4, 6), IRON, M(x, 1.2, z));
      b.add(new THREE.CylinderGeometry(0.34, 0.16, 0.25, 8), IRON, M(x, 2.45, z));
      fl.add(x, h0 + 2.55, z, 0.5, r() * 6, 1);
      ctx.solids.add(x, z, 0.35);
    }
  }
  b.lift = 0;
}

// ───────────────────────── Broken bridge ─────────────────────────

function brokenCauseway(ctx: FieldCtx, fl: Flames, r: () => number): void {
  const { b } = ctx;
  // The break of the outer-shore section (facing south) and the break of the isle section (facing north)
  const outerEnd = T[1] - 44 + 8;
  const innerEnd = T[1] - RIN - 4.5;
  for (const [ze, dir] of [
    [outerEnd, 1],
    [innerEnd, -1],
  ] as const) {
    for (let i = 0; i < 4; i++) {
      const x = -3.4 + i * 2.3 + (r() - 0.5) * 0.6;
      const z = ze + dir * (0.3 + r() * 0.6);
      const h = ctx.h(x, ze - dir * 1.5);
      const tilt = dir * (0.35 + r() * 0.6);
      b.add(new THREE.BoxGeometry(2.1, 0.55, 2.4), i % 2 ? COL.stone : COL.stoneD, M(x, h - 0.5 - r() * 0.6, z + dir * 0.6, (r() - 0.5) * 0.3, 1, tilt, (r() - 0.5) * 0.3));
    }
    const h = ctx.h(0, ze - dir * 1.5);
    rope(b, V3(-2.8, h - 0.4, ze + dir * 0.8), V3(-2.4, h - 5.5, ze + dir * 1.4), 0.3, 0.05, IRON);
    rope(b, V3(2.2, h - 0.5, ze + dir * 0.9), V3(2.6, h - 3.8, ze + dir * 1.2), 0.2, 0.05, IRON);
  }
  // A pair of tall lamp posts (wisp fire) at the north-shore bridgehead
  for (const s of [-1, 1]) {
    const x = s * 5.4;
    const z = T[1] - 44 - 3.5;
    if (land(x, z) < 1.5) continue;
    const h0 = ctx.place(x, z, 0.6);
    b.add(new THREE.BoxGeometry(1.0, 0.5, 1.0), COL.stoneD, M(x, 0.25, z));
    b.add(new THREE.CylinderGeometry(0.22, 0.3, 4.4, 8), COL.stone, M(x, 2.6, z));
    b.add(new THREE.CylinderGeometry(0.55, 0.25, 0.4, 8), IRON, M(x, 4.9, z));
    fl.add(x, h0 + 5.05, z, 0.7, r() * 6, 1);
    ctx.solids.add(x, z, 0.6);
  }
  b.lift = 0;
}

// ───────────────────────── Statue of the Uncrowned King and the kingdom ruins ─────────────────────────

function colossus(ctx: FieldCtx, r: () => number): void {
  const { b } = ctx;
  // The statue of the Uncrowned King: kneeling on a pedestal, both hands pressed on a huge sword planted into the pedestal,
  // facing the center of the rift; the head broke off long ago and rolled to the front of the pedestal,
  // and corrupted crystals grow from the break at the neck and from the knees. All dimensions use "pedestal coordinates":
  // z forward (toward the tower), x right, y up.
  const px = COLOSSUS[0] - 2;
  const pz = COLOSSUS[1] - 1;
  const ry = Math.atan2(T[0] - px, T[1] - pz);
  const base = ctx.place(px, pz, 6.2);
  const cs = Math.cos(ry);
  const sn = Math.sin(ry);
  const W = (lx: number, ly: number, lz: number) => V3(px + cs * lx + sn * lz, ly, pz - sn * lx + cs * lz);
  const at = (lx: number, ly: number, lz: number, rx = 0, rz = 0, dy = 0) => {
    const w = W(lx, ly, lz);
    return M(w.x, w.y, w.z, ry + dy, 1, rx, rz);
  };
  /** A cylinder from A to B (pedestal coordinates) */
  const limb = (A: [number, number, number], B: [number, number, number], r0: number, r1: number, col: number, seg = 9) => {
    const a = W(...A);
    const c = W(...B);
    const len = a.distanceTo(c);
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), c.clone().sub(a).normalize());
    b.add(new THREE.CylinderGeometry(r1, r0, len, seg), col, new THREE.Matrix4().compose(a.clone().lerp(c, 0.5), q, V3(1, 1, 1)));
  };
  // Pedestal
  b.add(new THREE.BoxGeometry(12.4, 3.4, 12.4), COL.stoneD, at(0, -0.7, 0));
  b.add(new THREE.BoxGeometry(10, 2.6, 10), COL.stone, at(0, 2.2, 0));
  b.add(new THREE.BoxGeometry(10.6, 0.5, 10.6), COL.stoneL, at(0, 3.6, 0));
  b.glow(new THREE.BoxGeometry(0.14, 2.2, 0.08), COL.cryA, at(-2.2, 2.0, 5.03, 0, 0.3));
  b.glow(new THREE.BoxGeometry(0.12, 1.6, 0.08), COL.cryB, at(3.1, 2.3, 5.03, 0, -0.5));
  const y0 = 3.85;
  // The huge sword planted into the pedestal (blade, guard, grip, pommel)
  b.add(new THREE.BoxGeometry(1.0, 7.6, 0.28), COL.stoneL, at(0, y0 + 3.6, 3.9));
  b.add(new THREE.BoxGeometry(0.3, 7.2, 0.34), COL.stone, at(0, y0 + 3.6, 3.9));
  b.add(new THREE.BoxGeometry(4.6, 0.55, 0.7), COL.gold, at(0, y0 + 7.6, 3.9));
  b.add(new THREE.CylinderGeometry(0.3, 0.3, 1.9, 8), COL.goldD, at(0, y0 + 8.8, 3.9));
  b.add(new THREE.OctahedronGeometry(0.55), COL.gold, at(0, y0 + 9.9, 3.9));
  // Left leg: knee raised (the foot on the front of the pedestal)
  b.add(new THREE.BoxGeometry(1.7, 1.0, 2.8), COL.stone, at(-1.7, y0 + 0.5, 1.9));
  limb([-1.7, y0 + 0.8, 1.7], [-1.7, y0 + 5.2, 1.7], 1.15, 0.95, COL.stoneL);
  b.add(new THREE.SphereGeometry(1.15, 10, 8), COL.stone, at(-1.7, y0 + 5.3, 1.8));
  limb([-1.7, y0 + 5.3, 1.8], [-1.5, y0 + 5.9, -1.3], 1.05, 1.3, COL.stoneL);
  b.add(new THREE.BoxGeometry(1.5, 3.2, 0.45), COL.stone, at(-1.7, y0 + 3.0, 2.85, -0.05));
  // Right leg: kneeling (knee on the ground, shin lying flat to the back)
  b.add(new THREE.SphereGeometry(1.1, 10, 8), COL.stone, at(1.7, y0 + 1.0, 0.5));
  limb([1.7, y0 + 1.0, 0.5], [1.5, y0 + 5.9, -1.3], 1.05, 1.3, COL.stoneL);
  limb([1.7, y0 + 0.8, 0.3], [1.7, y0 + 0.75, -3.9], 1.0, 0.85, COL.stoneL);
  b.add(new THREE.BoxGeometry(1.5, 1.6, 1.0), COL.stone, at(1.7, y0 + 0.8, -4.3, 0.3));
  // Waist and the hanging tassets
  b.add(new THREE.BoxGeometry(4.6, 2.0, 3.2), COL.stone, at(0, y0 + 6.2, -1.2));
  for (const sx of [-1.5, 0, 1.5]) b.add(new THREE.BoxGeometry(1.4, 2.2, 0.35), COL.stoneL, at(sx, y0 + 5.2, 0.5, -0.35));
  b.add(new THREE.BoxGeometry(4.8, 0.6, 3.4), COL.goldD, at(0, y0 + 7.1, -1.2));
  // Breastplate (a hexagonal prism, wide at the top and narrow at the bottom, leaning slightly forward)
  const chest = new THREE.CylinderGeometry(2.9, 2.2, 6.4, 6);
  chest.scale(1, 1, 0.62);
  b.add(chest, COL.stoneL, at(0, y0 + 10.4, -0.9, 0.14));
  b.add(new THREE.OctahedronGeometry(0.9).scale(1, 1.4, 0.4), COL.gold, at(0, y0 + 10.6, 0.95, 0.14));
  // The cape hanging down the back onto the pedestal
  b.add(new THREE.BoxGeometry(5.4, 10.4, 0.4), 0x4a1c34, at(0, y0 + 6.6, -3.1, -0.16));
  b.add(new THREE.BoxGeometry(6.2, 0.3, 3.2), 0x3c1629, at(0, y0 + 0.2, -4.9));
  // Pauldrons: two layers of hemisphere
  const dome = (R: number) => new THREE.SphereGeometry(R, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1.1);
  for (const s of [-1, 1]) {
    b.add(dome(1.55), COL.stone, at(s * 2.9, y0 + 12.5, -0.8, 0, -s * 0.55));
    b.add(dome(1.1), COL.stoneL, at(s * 3.25, y0 + 12.0, -0.8, 0, -s * 0.75));
    // Arms: the upper arm forward and down, the forearm drawn forward to the sword hilt
    limb([s * 3.0, y0 + 12.0, -0.6], [s * 2.6, y0 + 9.0, 1.5], 0.8, 0.7, COL.stoneL);
    b.add(new THREE.SphereGeometry(0.75, 8, 6), COL.stone, at(s * 2.6, y0 + 9.0, 1.5));
    limb([s * 2.6, y0 + 9.0, 1.5], [s * 0.75, y0 + 9.3, 3.7], 0.66, 0.6, COL.stoneL);
    b.add(new THREE.BoxGeometry(1.0, 1.1, 1.1), COL.stone, at(s * 0.62, y0 + 9.3, 3.9));
  }
  // The snapped neck: a cluster of glowing crystals grows from the break
  b.add(new THREE.CylinderGeometry(0.8, 0.95, 0.9, 8), COL.stone, at(0, y0 + 13.8, -0.65, 0.14));
  b.glow(new THREE.BoxGeometry(0.12, 3.6, 0.1), COL.cryA, at(0.6, y0 + 10.4, 1.1, 0.14, 0.35));
  b.glow(new THREE.BoxGeometry(0.1, 2.2, 0.1), COL.cryB, at(-1.1, y0 + 9.4, 1.0, 0.14, -0.5));
  const neck = W(0, 0, -0.6);
  const knee = W(-1.7, 0, 1.8);
  if (ctx.done >= ctx.floors) {
    // After purification: a crown made of light floats above the broken neck (the uncrowned king finally receives his crown)
    const cy = base + y0 + 15.3;
    b.lift = 0;
    b.glow(new THREE.TorusGeometry(1.6, 0.12, 6, 28), 0xffe0a0, M(neck.x, cy, neck.z, 0, 1, Math.PI / 2));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      b.glow(new THREE.ConeGeometry(0.22, 0.95, 4), 0xfff0c8, M(neck.x + Math.cos(a) * 1.6, cy + 0.52, neck.z + Math.sin(a) * 1.6, a));
    }
    b.glow(new THREE.OctahedronGeometry(0.4), 0xffffff, M(neck.x, cy + 0.3, neck.z));
    glowDisc(ctx, px, pz, 9, 0xffd890, 0.3);
  } else {
    // Use its own random stream: so the positions of other props do not shift between before and after purification
    const cr = rng(311);
    b.lift = base + y0 + 14.0;
    crystalCluster(b, neck.x, neck.z, 1.5, cr, true);
    // The cracks at the knees also grow crystals
    b.lift = base + y0 + 6.1;
    crystalCluster(b, knee.x, knee.z, 0.6, cr);
  }
  b.lift = base;
  ctx.solids.add(px, pz, 6.8);
  b.lift = 0;

  // Head: rolled in front of the pedestal, lying on its side gazing at the sky; purple light shows from the eye sockets
  const hp = W(3.2, 0, 10.2);
  const hx = hp.x;
  const hz = hp.z;
  ctx.place(hx, hz, 2.5);
  const hr = ry + 2.2;
  const H = (lx: number, ly: number, lz: number) => V3(hx + Math.cos(hr) * lx + Math.sin(hr) * lz, ly, hz - Math.sin(hr) * lx + Math.cos(hr) * lz);
  b.add(new THREE.SphereGeometry(2.4, 12, 10).scale(1, 1.12, 1.05), COL.stoneL, M(hx, 1.5, hz, hr, 1, 0, 0.5));
  // The helmet's cheek guards and the crown seat on top (the crown has long since vanished)
  b.add(new THREE.BoxGeometry(4.4, 0.7, 1.2), COL.stone, M(hx, 1.2, hz, hr, 1, 0, 0.5));
  const brow = H(0, 2.2, 2.0);
  b.add(new THREE.BoxGeometry(3.4, 0.55, 0.9), COL.stone, M(brow.x, brow.y, brow.z, hr, 1, 0, 0.5));
  const nose = H(0.3, 1.6, 2.45);
  b.add(new THREE.ConeGeometry(0.45, 1.3, 4), COL.stone, M(nose.x, nose.y, nose.z, hr, 1, Math.PI / 2, 0.5));
  for (const s of [-1, 1]) {
    const e = H(s * 0.85 - 0.2, 1.95 - s * 0.45, 2.2);
    b.glow(new THREE.SphereGeometry(0.3, 8, 6), ctx.done >= ctx.floors ? 0xffe0a0 : COL.cryB, M(e.x, e.y, e.z));
  }
  const beard = H(-0.55, 0.7, 2.1);
  b.add(new THREE.ConeGeometry(1.3, 2.2, 7), COL.stone, M(beard.x, beard.y, beard.z, hr, 1, 1.9, 0.5));
  b.glow(new THREE.BoxGeometry(0.1, 3.0, 0.1), COL.cryA, M(hx + 0.5, 2.1, hz + 0.4, hr, 1, 0.4, 0.9));
  ctx.solids.add(hx, hz, 2.8);
  b.lift = 0;
  // Rubble crumbled around the pedestal
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = 7.5 + r() * 4;
    const x = px + Math.cos(a) * d;
    const z = pz + Math.sin(a) * d;
    if (land(x, z) < 2 || Math.hypot(x - hx, z - hz) < 3.5 || ctx.pathDist(x, z) < 3.5) continue;
    ctx.place(x, z, 0.6);
    const k = 0.6 + r() * 0.9;
    b.add(new THREE.BoxGeometry(1.4 * k, 1.0 * k, 1.2 * k), r() < 0.5 ? COL.stone : COL.stoneL, M(x, 0.3 * k, z, r() * 6, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
    ctx.solids.add(x, z, 0.8 * k);
  }
  b.lift = 0;

  // Crown: rolled by the roadside, half buried in the ground, cracked with one corner missing
  {
    const [cx, cz] = CROWN;
    ctx.place(cx, cz, 2.5);
    // The crown lies on its side, half buried: its axis tilted 55 degrees outward from vertical, the points slanting upward
    const tilt = 0.96;
    const cr = 0.8;
    const rot = new THREE.Euler(-(Math.PI / 2 - tilt), cr, 0, 'YXZ');
    const q = new THREE.Quaternion().setFromEuler(rot);
    const band = new THREE.TorusGeometry(3.2, 0.55, 8, 28, Math.PI * 2 - 0.5);
    b.add(band, COL.gold, new THREE.Matrix4().compose(V3(cx, 1.1, cz), q, new THREE.Vector3(1, 1, 1)));
    const band2 = new THREE.TorusGeometry(3.25, 0.22, 6, 28, Math.PI * 2 - 0.5);
    b.add(band2, COL.goldD, new THREE.Matrix4().compose(V3(cx, 1.1, cz).add(V3(0, 0.55, 0).applyQuaternion(q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))))), q, new THREE.Vector3(1, 1, 1)));
    const up = V3(0, 0, 1).applyQuaternion(q);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * (Math.PI * 2 - 0.5) + 0.25;
      if (i === 4) continue;
      const local = V3(Math.cos(a) * 3.2, Math.sin(a) * 3.2, 0).applyQuaternion(q);
      const base = V3(cx, 1.1, cz).add(local);
      const tip = base.clone().addScaledVector(up, 2.0);
      const m = new THREE.Matrix4().compose(base.clone().lerp(tip, 0.5), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), up), new THREE.Vector3(1, 1, 1));
      b.add(new THREE.ConeGeometry(0.45, 2.0, 5), COL.gold, m);
      const gem = base.clone().addScaledVector(up, 0.2).addScaledVector(local.clone().normalize(), 0.5);
      b.glow(new THREE.OctahedronGeometry(0.28), i % 2 ? COL.cryA : COL.cryB, M(gem.x, gem.y, gem.z));
    }
    // The snapped-off point lies beside it
    b.add(new THREE.ConeGeometry(0.45, 2.0, 5), COL.gold, M(cx + 3.8, 0.4, cz + 2.4, 0.7, 1, 0, Math.PI / 2));
    ctx.solids.add(cx, cz, 3.4);
    glowDisc(ctx, cx, cz, 5, 0xffb86a, 0.22);
    b.lift = 0;
  }
}

/** Colonnade on both sides of the Old Kingdom Road: some still standing, some broken, some fallen on the ground */
function colonnade(ctx: FieldCtx, r: () => number): void {
  const { b } = ctx;
  const A: [number, number] = [-47, 12];
  const B: [number, number] = [-66, -26];
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const ux = (B[0] - A[0]) / len;
  const uz = (B[1] - A[1]) / len;
  const px = uz;
  const pz = -ux;
  const ry = Math.atan2(ux, uz);
  const n = Math.floor(len / 5.2);
  for (const side of [-1, 1]) {
    let prev: [number, number, number] | null = null;
    for (let i = 0; i <= n; i++) {
      const t = i * 5.2 + (r() - 0.5) * 0.6;
      const x = A[0] + ux * t + px * side * 7;
      const z = A[1] + uz * t + pz * side * 7;
      if (Math.hypot(x - CROWN[0], z - CROWN[1]) < 6.5 || !ctx.clear(x, z, 0.5) || land(x, z) < 3) {
        prev = null;
        continue;
      }
      ctx.place(x, z, 0.7);
      const k = r();
      if (k < 0.45) {
        const h = 5.5 + r() * 1.5;
        column(b, x, z, h, 1.1, false, r);
        if (prev && prev[2] > 5) {
          const [qx, qz] = prev;
          b.add(new THREE.BoxGeometry(1.2, 0.7, Math.hypot(x - qx, z - qz) + 1.2), COL.stoneL, M((x + qx) / 2, Math.min(h, prev[2]) + 0.8, (z + qz) / 2, ry));
        }
        prev = [x, z, h];
      } else if (k < 0.8) {
        column(b, x, z, 1.4 + r() * 2.8, 1.1, true, r);
        prev = null;
      } else {
        b.add(new THREE.BoxGeometry(1.4, 0.45, 1.4), COL.stoneD, M(x, 0.2, z, ry));
        fallenColumn(b, x + px * side * 3.2, z + pz * side * 3.2, 6, 1.1, ry + Math.PI / 2 + (r() - 0.5) * 0.6, r);
        ctx.solids.add(x + px * side * 3.2, z + pz * side * 3.2, 1.6);
        prev = null;
      }
      ctx.solids.add(x, z, 0.8);
      b.lift = 0;
    }
  }
}

// ───────────────────────── Inverted Quarter ─────────────────────────

function hangingHouse(b: PropBatch, x: number, z: number, w: number, d: number, h: number, ry: number, wall: number, roof: number): void {
  b.add(new THREE.BoxGeometry(w, h, d), wall, M(x, h / 2, z, ry));
  const roofH = Math.min(w, d) * 0.6;
  const prism = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  prism.rotateX(Math.PI / 2);
  prism.rotateZ(Math.PI);
  prism.scale((w * 0.62) / 0.866, roofH / 1.5, d + 0.5);
  b.add(prism, roof, M(x, h + roofH / 3, z, ry));
  const f = (lx: number, lz: number) => [x + Math.cos(ry) * lx + Math.sin(ry) * lz, z - Math.sin(ry) * lx + Math.cos(ry) * lz] as const;
  for (const s of [-0.28, 0.28]) {
    const [wx, wz] = f(s * w, d / 2 + 0.03);
    b.glow(new THREE.BoxGeometry(0.55, 0.6, 0.06), 0xff8ad0, M(wx, h * 0.6, wz, ry));
  }
  const [dx, dz] = f(0, d / 2 + 0.03);
  b.add(new THREE.BoxGeometry(0.8, 1.5, 0.08), 0x2a1e30, M(dx, 0.75, dz, ry));
}

function invertedDistrict(ctx: FieldCtx, clock: RiftClock, r: () => number): void {
  const { b } = ctx;
  const [cx, cz] = CRATER;
  const floor = ctx.h(cx, cz);
  // Pit floor: the foundation outlines left after the houses were lifted away whole
  const houses: [number, number, number, number, number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.4;
    const d = 4 + r() * 4.5;
    houses.push([Math.cos(a) * d, Math.sin(a) * d, 2.6 + r() * 1.4, 2.6 + r() * 1.2, 2.4 + r(), a + Math.PI / 2 + (r() - 0.5) * 0.4]);
  }
  for (const [lx, lz, w, d, , ry] of houses) {
    const x = cx + lx;
    const z = cz - lz;
    ctx.place(x, z, 1.5);
    const f = (ax: number, az: number) => [x + Math.cos(-ry) * ax + Math.sin(-ry) * az, z - Math.sin(-ry) * ax + Math.cos(-ry) * az] as const;
    for (const [ax, az, sw, sd] of [
      [0, d / 2, w, 0.3],
      [0, -d / 2, w, 0.3],
      [w / 2, 0, 0.3, d],
      [-w / 2, 0, 0.3, d],
    ] as const) {
      if (r() < 0.25) continue;
      const [qx, qz] = f(ax, az);
      b.add(new THREE.BoxGeometry(sw, 0.35 + r() * 0.5, sd), COL.stoneD, M(qx, 0.2, qz, -ry));
    }
  }
  b.lift = 0;

  // The block hanging upside down in the sky: first built the right way up (ground cover on top, houses above it), then flipped over entirely
  const pb = new SoloBatch();
  floatingIsland(pb, r, 12.5, 15, 0x4a4056, COL.slab);
  for (const [lx, lz, w, d, h, ry] of houses) hangingHouse(pb, lx, lz, w, d, h, ry, r() < 0.5 ? 0x8a7e92 : COL.stoneL, r() < 0.5 ? 0x4a2e5a : 0x3a2a4a);
  // Bell tower
  pb.add(new THREE.BoxGeometry(2.4, 8.5, 2.4), COL.stoneL, M(-1, 4.25, 1));
  pb.add(new THREE.BoxGeometry(2.8, 0.4, 2.8), COL.stoneD, M(-1, 6.2, 1));
  pb.add(new THREE.ConeGeometry(2.1, 3.2, 4), 0x3a2a4a, M(-1, 10.1, 1, Math.PI / 4));
  pb.add(new THREE.SphereGeometry(0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), COL.goldD, M(-1, 7.2, 1));
  pb.glow(new THREE.BoxGeometry(0.5, 0.9, 2.45), 0xff8ad0, M(-1, 7.4, 1));
  // Street lamps and dead trees
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2;
    const lx = Math.cos(a) * 9.5;
    const lz = Math.sin(a) * 9.5;
    pb.add(new THREE.CylinderGeometry(0.07, 0.1, 2.6, 5), IRON, M(lx, 1.3, lz));
    pb.glow(new THREE.OctahedronGeometry(0.22), COL.cryC, M(lx, 2.75, lz));
  }
  deadTree(pb, 5, -6, 1.1, r);
  deadTree(pb, -7, 5, 0.9, r);
  const g = new THREE.Group();
  pb.buildInto(g, ctx.disposers);
  const baseY = floor + 25;
  g.position.set(cx, baseY, cz);
  g.rotation.x = Math.PI;
  ctx.group.add(g);
  // Between the pit floor and the upside-down quarter: debris "falling" upward
  let t0 = 0;
  ctx.extras.push((dt, t, vfx) => {
    g.rotation.y = t * 0.025;
    g.position.y = baseY + Math.sin(t * 0.3) * 0.8;
    if (Math.hypot(vfx.camPos.x - cx, vfx.camPos.z - cz) > 80) return;
    t0 += dt;
    while (t0 > 0.12) {
      t0 -= 0.12;
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 10;
      vfx.smoke({ pos: V3(cx + Math.cos(a) * d, floor + 0.3, cz + Math.sin(a) * d), count: 1, color: [0x1a1024, 0x2a1a34], speed: [1.2, 2.2], dir: V3(0, 1, 0), spread: 0.08, life: [6, 9], size: [0.12, 0.3], sizeEnd: 0.6, drag: 0, intensity: 1 });
      if (Math.random() < 0.35) vfx.emit({ pos: V3(cx + Math.cos(a) * d, floor + 0.3, cz + Math.sin(a) * d), count: 1, color: [COL.cryC, COL.cryB], speed: [1.5, 2.5], dir: V3(0, 1, 0), spread: 0.1, life: [5, 8], size: [0.08, 0.14], sizeEnd: 0.5, drag: 0, intensity: 1.6 });
    }
  });
  void clock;
}

// ───────────────────────── Blightcrystal Basin ─────────────────────────

function crystalBasin(ctx: FieldCtx, r: () => number): void {
  const { b } = ctx;
  const [bx, bz] = BASIN;
  const n = ctx.low ? 16 : 30;
  let placed = 0;
  for (let tries = 0; tries < n * 6 && placed < n; tries++) {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 0.7) * 26;
    const x = bx + Math.cos(a) * d;
    const z = bz + Math.sin(a) * d;
    const s = 0.9 + (1 - d / 26) * 3.2 + r() * 0.8;
    if (!ctx.clear(x, z, s * 0.6) || land(x, z) < 2.5 + s * 0.5 || ctx.solids.blocked(x, z, s * 0.6)) continue;
    if (HOLES.some(([hx, hz, hr]) => Math.hypot(x - hx, z - hz) < hr + 1.5 + s * 0.4)) continue;
    ctx.place(x, z, s * 0.4);
    crystalCluster(b, x, z, s, r, s > 3 && r() < 0.5);
    if (s > 2.4) glowDisc(ctx, x, z, s * 2.2, r() < 0.5 ? 0xff3a8a : 0x9a4aff, 0.35);
    ctx.solids.add(x, z, s * 0.55);
    placed++;
  }
  // Giant crystals at the basin's outer edge: silhouettes visible from far away
  for (const [x, z, s] of [
    [88, -10, 6.5],
    [80, -26, 5.2],
    [60, -24, 4.2],
  ] as const) {
    if (land(x, z) < 4 || !ctx.clear(x, z, 2)) continue;
    ctx.place(x, z, 2);
    crystalCluster(b, x, z, s, r, true);
    glowDisc(ctx, x, z, s * 2.6, 0xc04aff, 0.45);
    ctx.solids.add(x, z, s * 0.6);
  }
  b.lift = 0;
  // The rim of the Eye of the Void: a ring of small glowing crystals
  for (const [hx, hz, hr] of HOLES) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + r() * 0.3;
      const d = hr + 1.1 + r() * 0.6;
      const x = hx + Math.cos(a) * d;
      const z = hz + Math.sin(a) * d;
      if (land(x, z) < 0.3) continue;
      ctx.place(x, z, 0.3);
      shard(b, x, -0.1, z, 0.35 + r() * 0.3, r() * 6, Math.sin(a) * -0.5, -Math.cos(a) * -0.5, COL.cryBody, r() < 0.5 ? COL.cryA : COL.cryC);
    }
    glowDisc(ctx, hx, hz, hr + 4, 0xff4ab0, 0.5);
  }
  b.lift = 0;
  let t0 = 0;
  ctx.extras.push((dt, _t, vfx) => {
    if (Math.hypot(vfx.camPos.x - bx, vfx.camPos.z - bz) > 90) return;
    t0 += dt;
    while (t0 > 0.1) {
      t0 -= 0.1;
      const [hx, hz, hr] = HOLES[Math.floor(Math.random() * HOLES.length)];
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * hr;
      vfx.emit({ pos: V3(hx + Math.cos(a) * d, ctx.h(hx, hz) - 1, hz + Math.sin(a) * d), count: 1, color: [COL.cryA, COL.cryB, 0xffffff], speed: [1, 2.2], dir: V3(0, 1, 0), spread: 0.25, life: [2, 3.5], size: [0.1, 0.2], sizeEnd: 0.4, intensity: 2 });
    }
  });
}

// ───────────────────────── Knight's tomb ─────────────────────────

function graveyard(ctx: FieldCtx, fl: Flames, bn: Banners, r: () => number): void {
  const { b } = ctx;
  const [gx, gz] = GRAVES;
  const face = Math.atan2(T[0] - gx, T[1] - gz);
  const cf = Math.cos(face);
  const sf = Math.sin(face);
  // Local coordinates: lz toward the tower (north), lx toward the right
  const W = (lx: number, lz: number) => [gx + cf * lx + sf * lz, gz - sf * lx + cf * lz] as const;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      if (r() < 0.15) continue;
      const [x, z] = W((col - 2) * 2.2 + (r() - 0.5) * 0.4, (row - 1.5) * 2.7 - 1);
      ctx.place(x, z, 0.6);
      b.add(new THREE.DodecahedronGeometry(0.7, 0).scale(1, 0.35, 1.5), 0x3a3040, M(x, 0.05, z, face));
      const tilt = (r() - 0.5) * 0.18;
      const tz = (r() - 0.5) * 0.18;
      b.add(new THREE.BoxGeometry(0.1, 1.3, 0.03), STEEL, M(x, 0.6, z, face + Math.PI / 2, 1, tilt, tz));
      b.add(new THREE.BoxGeometry(0.55, 0.08, 0.09), IRON, M(x, 1.28, z, face + Math.PI / 2, 1, tilt, tz));
      b.add(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5), 0x4a3222, M(x, 1.46, z, 0, 1, tilt, tz));
      b.add(new THREE.SphereGeometry(0.07, 6, 5), 0xc8a050, M(x, 1.63, z));
      const k = r();
      if (k < 0.3) {
        // The helmet hung on the sword hilt
        // Barrel helm: the helm body, the dome, the seam of the visor
        b.add(new THREE.CylinderGeometry(0.23, 0.25, 0.34, 8), 0x7a8090, M(x, 1.45, z, face));
        b.add(new THREE.SphereGeometry(0.23, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0x8a90a0, M(x, 1.62, z, face));
        b.add(new THREE.BoxGeometry(0.34, 0.05, 0.05), 0x18161c, M(x + sf * 0.235, 1.5, z + cf * 0.235, face), false);
        b.add(new THREE.BoxGeometry(0.04, 0.2, 0.05), 0x18161c, M(x + sf * 0.24, 1.42, z + cf * 0.24, face), false);
      } else if (k < 0.55) {
        const sh = new THREE.CylinderGeometry(0.38, 0.38, 0.07, 10);
        sh.rotateX(Math.PI / 2);
        b.add(sh, 0x2e4a8a, M(x - sf * 0.45, 0.38, z - cf * 0.45, face, 1, 0.3, 0));
      } else if (k < 0.8) {
        const [cx, cz] = [x + cf * 0.45, z - sf * 0.45];
        b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6), 0xf0e8d8, M(cx, 0.15, cz));
        fl.add(cx, ctx.h(cx, cz) + 0.26, cz, 0.13, r() * 6, 0);
      }
      ctx.solids.add(x, z, 0.5);
    }
  }
  b.lift = 0;
  // Monument and eternal flame
  const [mx, mz] = W(0, 8);
  const mh = ctx.place(mx, mz, 1.5);
  b.add(new THREE.BoxGeometry(2.6, 0.6, 2.6), COL.stoneD, M(mx, 0.3, mz, face));
  b.add(new THREE.CylinderGeometry(0.45, 0.8, 4.8, 4), 0x8a8494, M(mx, 3.0, mz, face + Math.PI / 4));
  b.add(new THREE.ConeGeometry(0.46, 0.8, 4), 0x8a8494, M(mx, 5.8, mz, face + Math.PI / 4));
  b.glow(new THREE.BoxGeometry(0.06, 2.4, 0.06), 0xffd27a, M(mx - sf * 0.62, 3.1, mz - cf * 0.62, face));
  const [fx, fz] = W(0, 6.6);
  b.add(new THREE.CylinderGeometry(0.5, 0.3, 0.45, 8), IRON, M(fx, mh - ctx.h(fx, fz) + 0.9, fz));
  b.add(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 6), IRON, M(fx, mh - ctx.h(fx, fz) + 0.35, fz));
  fl.add(fx, mh + 1.1, fz, 0.7, 1, 2);
  ctx.solids.add(mx, mz, 1.6);
  // The tattered order banner
  const [bx, bz] = W(2.2, 7.5);
  const bh = ctx.place(bx, bz);
  b.add(new THREE.CylinderGeometry(0.06, 0.08, 5, 5), 0x4a3222, M(bx, 2.5, bz, 0, 1, 0.08, 0.05));
  b.add(new THREE.BoxGeometry(1.3, 0.08, 0.08), 0x4a3222, M(bx + 0.1, 4.85, bz, face + Math.PI / 2));
  bn.add(bx + 0.1, bh + 4.8, bz, face, 1.2, 2.6, 3.3);
  ctx.solids.add(bx, bz, 0.3);
  // Iron fence (broken in places)
  for (let i = 0; i < 28; i++) {
    const t = i / 28;
    const per = t * 4;
    const side = Math.floor(per);
    const u = per - side;
    const lx = side === 0 ? -7 + u * 14 : side === 1 ? 7 : side === 2 ? 7 - u * 14 : -7;
    const lz = side === 0 ? -7 : side === 1 ? -7 + u * 17 : side === 2 ? 10 : 10 - u * 17;
    if (r() < 0.3) continue;
    const [x, z] = W(lx, lz);
    if (!ctx.clear(x, z, -1)) continue;
    ctx.place(x, z);
    b.add(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 4), IRON, M(x, 0.65, z, 0, 1, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3));
    b.add(new THREE.ConeGeometry(0.06, 0.18, 4), IRON, M(x, 1.35, z));
  }
  b.lift = 0;
}

// ───────────────────────── Cracked fields ─────────────────────────

function crackField(ctx: FieldCtx, r: () => number, debris?: Debris[]): void {
  const { b } = ctx;
  const [fx, fz] = FIELD;
  const dr = rng(6607);
  let n = 0;
  for (let tries = 0; tries < 40 && n < 8; tries++) {
    const a = r() * Math.PI * 2;
    const d = 3 + r() * 10;
    const x = fx + Math.cos(a) * d - 2;
    const z = fz + Math.sin(a) * d;
    // (One size smaller than before, and a bit farther from the paths: seen from the road it does not block the whole view above the road)
    const w = 2.4 + r() * 2.8;
    if (!ctx.clear(x, z, w * 0.5) || land(x, z) < 4 || ctx.solids.blocked(x, z, w * 0.5) || ctx.pathDist(x, z) < ctx.layout.pathW + w * 0.6 + 2) continue;
    ctx.place(x, z, w * 0.4);
    const h = 2.4 + r() * 2.6;
    upthrust(b, x, z, w, h, 0.8 + r() * 0.5, r() * Math.PI, 0.35 + r() * 0.5, r);
    ctx.solids.add(x, z, w * 0.45);
    // A few small chips of peeled-off stone circle above the rock slab
    if (debris) for (let j = 0; j < 4; j++) debris.push([x + (dr() - 0.5) * w, ctx.h(x, z) + h * 0.8 + 0.6 + dr() * 1.8, z + (dr() - 0.5) * w, 0.12 + dr() * 0.2, 0]);
    n++;
  }
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    const d = 8 + r() * 10;
    const x = fx + Math.cos(a) * d;
    const z = fz + Math.sin(a) * d;
    if (!ctx.clear(x, z, 1) || land(x, z) < 3 || ctx.solids.blocked(x, z, 1)) continue;
    ctx.place(x, z, 0.4);
    deadTree(b, x, z, 1 + r() * 0.4, r);
    ctx.solids.add(x, z, 0.45);
  }
  b.lift = 0;
}

// ───────────────────────── Secret realm: Shattered Heart Altar ─────────────────────────

function heartAltar(ctx: FieldCtx, clock: RiftClock, r: () => number): void {
  const { b } = ctx;
  // After purification, the Shattered Heart Crystal is restored to a warm gold
  const pure = ctx.done >= ctx.floors;
  const HEART = pure ? 0xffe0a0 : 0xff9ad8;
  const LINE = pure ? 0xffd27a : COL.cryC;
  const [ix, iz] = ISLE;
  const h0 = ctx.place(ix, iz, 3);
  b.add(new THREE.CylinderGeometry(3.2, 3.5, 0.5, 16), COL.stoneD, M(ix, 0.2, iz));
  b.add(new THREE.CylinderGeometry(2.4, 2.4, 0.2, 16), COL.stoneL, M(ix, 0.5, iz));
  b.glow(new THREE.TorusGeometry(2.7, 0.05, 4, 40), LINE, M(ix, 0.47, iz, 0, 1, Math.PI / 2));
  ctx.solids.add(ix, iz, 2.2);
  b.lift = 0;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const x = ix + Math.sin(a) * 6.8;
    const z = iz + Math.cos(a) * 6.8;
    if (land(x, z) < 1.5 || ctx.pathDist(x, z) < 3.2) continue;
    ctx.place(x, z, 0.6);
    const hh = 2.6 + r() * 1.8;
    b.add(new THREE.BoxGeometry(1.1, hh, 0.6), COL.stoneD, M(x, hh / 2 - 0.2, z, a, 1, (r() - 0.5) * 0.12, 0));
    b.glow(new THREE.BoxGeometry(0.12, hh * 0.55, 0.05), LINE, M(x - Math.sin(a) * 0.31, hh * 0.5, z - Math.cos(a) * 0.31, a));
    ctx.solids.add(x, z, 0.7);
    b.lift = 0;
  }
  // The Shattered Heart Crystal: suspended above the altar, pulsing with a heartbeat
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(HEART).multiplyScalar(2.4), toneMapped: false });
  const g = new THREE.IcosahedronGeometry(0.9, 0);
  g.scale(0.8, 1.35, 0.8);
  const heart = new THREE.Mesh(g, mat);
  const y = h0 + 3.6;
  heart.position.set(ix, y, iz);
  ctx.group.add(heart);
  const shardGeo = new THREE.OctahedronGeometry(0.25);
  shardGeo.scale(0.6, 1.6, 0.6);
  const orbit = new THREE.Group();
  orbit.position.set(ix, y, iz);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(shardGeo, mat);
    const a = (i / 6) * Math.PI * 2;
    m.position.set(Math.cos(a) * 1.9, Math.sin(a * 2) * 0.4, Math.sin(a) * 1.9);
    m.rotation.set(r(), r(), r());
    orbit.add(m);
  }
  ctx.group.add(orbit);
  glowDisc(ctx, ix, iz, 7, pure ? 0xffc860 : 0xff5ab8, 0.55);
  shaftsAt(ctx, ix, iz, [
    { x: 0, z: 0, w: 3.2, h: 26 },
    { x: 1.2, z: -0.8, w: 1.6, h: 22 },
  ], V3(0.05, 1, 0.08), pure ? 0xfff0c0 : 0xffb8e8, 0.3);
  ctx.disposers.push(() => {
    mat.dispose();
    g.dispose();
    shardGeo.dispose();
  });
  let t0 = 0;
  ctx.extras.push((dt, t, vfx) => {
    const beat = clock.uBeat.value;
    heart.rotation.y = t * 0.6;
    heart.position.y = y + Math.sin(t * 1.1) * 0.25;
    heart.scale.setScalar(1 + beat * 0.12);
    mat.color.setHex(HEART).multiplyScalar(2.1 + beat * 1.2);
    orbit.rotation.y = -t * 0.5;
    orbit.position.y = heart.position.y;
    if (Math.hypot(vfx.camPos.x - ix, vfx.camPos.z - iz) > 60) return;
    t0 += dt;
    while (t0 > 0.15) {
      t0 -= 0.15;
      vfx.emit({ pos: V3(ix, heart.position.y, iz), count: 1, color: pure ? [0xffe0a0, 0xffffff, 0xffc860] : [0xff9ad8, 0xffffff, COL.cryB], speed: [0.4, 1.2], spread: 1, life: [1.5, 2.5], size: [0.08, 0.16], sizeEnd: 0.3, intensity: 2 });
    }
  });
}

// ───────────────────────── Scattered around ─────────────────────────

function fill(ctx: FieldCtx, r: () => number): void {
  const { b } = ctx;
  const k = ctx.low ? 0.5 : 1;
  const keep: [number, number, number][] = [
    [TOWN[0], TOWN[1], 27],
    [T[0], T[1], 26],
    [COLOSSUS[0] - 2, COLOSSUS[1], 15],
    [CROWN[0], CROWN[1], 6],
    [CRATER[0], CRATER[1], 17],
    [BASIN[0], BASIN[1], 27],
    [GRAVES[0], GRAVES[1], 11],
    [ISLE[0], ISLE[1], 9],
    [FIELD[0], FIELD[1], 12],
  ];
  const free = (x: number, z: number, m: number) => land(x, z) > 3 + m && keep.every(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) > cr + m);
  // Clumps of trees alternate with open ground: low-frequency noise carves out the "dead woods"
  const grove = (x: number, z: number) => sm(0.1, 0.6, Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.052 - 0.7) + 0.35 * Math.sin(x * 0.11 + z * 0.09));
  scatterMask(ctx, Math.round(420 * k), 1.2, (x, z) => (free(x, z, 1) ? 0.08 + grove(x, z) * 0.55 : 0), (x, z) => {
    ctx.place(x, z, 0.4);
    deadTree(b, x, z, 0.85 + r() * 0.6, r);
    ctx.solids.add(x, z, 0.45);
  });
  // Rocks
  scatterMask(ctx, Math.round(160 * k), 1.5, (x, z) => (free(x, z, 1) ? 0.35 : 0), (x, z) => {
    const s = 0.7 + r() * 1.6;
    ctx.place(x, z, s * 0.5);
    b.add(new THREE.DodecahedronGeometry(s, 0), r() < 0.5 ? COL.stoneD : COL.stone, M(x, s * 0.35, z, r() * 6, 1, r() * 0.5, r() * 0.5));
    if (r() < 0.5) b.add(new THREE.DodecahedronGeometry(s * 0.45, 0), COL.stone, M(x + s * 0.9, s * 0.15, z + (r() - 0.5) * s, r() * 6));
    ctx.solids.add(x, z, s * 0.85);
  });
  // Small crystal clusters: more of them the closer to the Wound
  scatterMask(ctx, Math.round(260 * k), 1, (x, z) => {
    if (!free(x, z, 0.5)) return 0;
    const rT = Math.hypot(x - T[0], z - T[1]);
    return 0.12 + 0.5 * (1 - sm(46, 80, rT));
  }, (x, z) => {
    ctx.place(x, z, 0.3);
    crystalCluster(b, x, z, 0.45 + r() * 0.9, r);
    ctx.solids.add(x, z, 0.5);
  });
  // Broken walls of the old city: more in the west and north
  scatterMask(ctx, Math.round(120 * k), 2, (x, z) => (free(x, z, 2) ? (x < -30 || z < -60 ? 0.45 : 0.08) : 0), (x, z) => {
    const ry = r() * Math.PI;
    const len = 3 + r() * 5;
    ctx.place(x, z, len * 0.4);
    const segs = 3 + Math.floor(r() * 3);
    for (let i = 0; i < segs; i++) {
      const t = -len / 2 + ((i + 0.5) * len) / segs;
      const h = 0.6 + r() * 2.4;
      b.add(new THREE.BoxGeometry(0.8, h, len / segs + 0.05), i % 2 ? COL.stone : COL.stoneD, M(x + Math.sin(ry) * t, h / 2, z + Math.cos(ry) * t, ry));
    }
    for (let t = -len / 2; t <= len / 2; t += 1.2) ctx.solids.add(x + Math.sin(ry) * t, z + Math.cos(ry) * t, 0.7);
  });
  b.lift = 0;
}

// ───────────────────────── Assembly ─────────────────────────

export function buildRuins(ctx: FieldCtx, clock: RiftClock, fl: Flames, bn: Banners, debris?: Debris[]): void {
  const r = ctx.r;
  towerIsland(ctx, fl, r);
  brokenCauseway(ctx, fl, r);
  colossus(ctx, r);
  colonnade(ctx, r);
  invertedDistrict(ctx, clock, r);
  crystalBasin(ctx, r);
  graveyard(ctx, fl, bn, r);
  crackField(ctx, r, debris);
  heartAltar(ctx, clock, r);
  // Old lamp posts at both ends of the stone bridges
  for (const c of CRACKS) {
    for (const [ex, ez] of bridgeEnds(c, 10.5)) {
      for (const s of [-1, 1]) {
        const x = ex + c.dx * s * 4.8;
        const z = ez + c.dz * s * 4.8;
        if (land(x, z) < 1.5 || !ctx.clear(x, z, -1.5)) continue;
        const h0 = ctx.place(x, z, 0.5);
        ctx.b.add(new THREE.BoxGeometry(0.9, 0.4, 0.9), COL.stoneD, M(x, 0.2, z));
        ctx.b.add(new THREE.CylinderGeometry(0.2, 0.26, 3.2, 8), COL.stone, M(x, 1.9, z));
        ctx.b.add(new THREE.CylinderGeometry(0.44, 0.2, 0.34, 8), IRON, M(x, 3.6, z));
        fl.add(x, h0 + 3.72, z, 0.55, r() * 6, 1);
        ctx.solids.add(x, z, 0.5);
      }
    }
  }
  ctx.b.lift = 0;
  fill(ctx, r);
}
