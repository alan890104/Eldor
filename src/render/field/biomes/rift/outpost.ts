// The Knights' Outpost: a camp with its back to the south-shore cliff. Sharpened wooden palisades enclose half a ring,
// the two watchtowers at the north gate fly blue-and-gold banners, and cheval-de-frise barricades line up outside the gate;
// the campfire is at the center of the camp, with the command tent and lamp-strung tents to the south,
// and guards stand at the gate and the cliff edge. In all that void-blight purple,
// this is the only place with warm firelight.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, rng } from '../../../arenaKit.ts';
import { rope } from '../../../arenas/_woods.ts';
import { blobShadowTex } from '../../../textures.ts';
import { Avatar, blobShadow, npcOutfit } from '../../avatar.ts';
import { crates, lampPost, type FieldCtx } from '../../kit.ts';
import { samplePath } from '../../compose.ts';
import { buildCamp, campTent } from './camp.ts';
import { glowDisc } from './decals.ts';
import type { RiftClock } from './glsl.ts';
import { Banners, Flames } from './fx.ts';
import { COL } from './props.ts';
import { land, TOWN } from './shape.ts';

const WOOD = 0x6a4a32;
const WOOD_D = 0x4a3222;
const WOOD_L = 0x8a6444;
const CANVAS = 0xd8c8a8;
const BLUE = 0x2e4a8a;
const IRON = 0x4a4a58;
const STEEL = 0xaab0c0;
const GOLD = 0xe8c060;

const [CX, CZ] = TOWN;
const PAL_R = 19;
/** A point on the camp's outer rim: a is the angle measured clockwise from north (-z) */
const onRing = (a: number, R = PAL_R): [number, number] => [CX + Math.sin(a) * R, CZ - Math.cos(a) * R];

// ───────────────────────── Buildings and props of the camp ─────────────────────────

/** Sharpened wooden palisade: follows the arc of the camp's outer rim, with a gap left at the north gate */
function palisade(ctx: FieldCtx): void {
  const { b, r } = ctx;
  const a0 = (-126 * Math.PI) / 180;
  const a1 = -a0;
  const gate = (16 * Math.PI) / 180;
  const n = Math.round(((a1 - a0) * PAL_R) / 0.52);
  let prev: [number, number, number] | null = null;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    if (Math.abs(a) < gate) {
      prev = null;
      continue;
    }
    const R = PAL_R + (r() - 0.5) * 0.2;
    const [x, z] = onRing(a, R);
    const gh = ctx.place(x, z);
    const h = 3.1 + r() * 0.8;
    const tx = (r() - 0.5) * 0.08;
    const tz = (r() - 0.5) * 0.08;
    b.add(new THREE.CylinderGeometry(0.2, 0.24, h, 6), r() < 0.5 ? WOOD : WOOD_L, M(x, h / 2 - 0.2, z, a, 1, tx, tz));
    b.add(new THREE.ConeGeometry(0.2, 0.6, 6), WOOD_L, M(x - tz * h * 0.5, h - 0.2 + 0.3, z + tx * h * 0.5, a, 1, tx, tz));
    if (prev && i % 3 === 0) {
      // Horizontal lashing timber
      const [px, pz, ph] = prev;
      const len = Math.hypot(x - px, z - pz);
      const ang = Math.atan2(x - px, z - pz);
      ctx.b.lift = 0;
      for (const y of [1.0, 2.3]) b.add(new THREE.BoxGeometry(0.14, 0.18, len + 0.3), WOOD_D, M((x + px) / 2, (gh + ph) / 2 + y, (z + pz) / 2, ang));
    }
    if (i % 3 === 0) prev = [x, z, gh];
    if (i % 2 === 0) ctx.solids.add(x, z, 0.55);
  }
  b.lift = 0;
}

/** Watchtower: a four-legged wooden frame, a platform, railings, a sloped roof; a brazier on the platform */
function watchtower(ctx: FieldCtx, fl: Flames, bn: Banners, x: number, z: number, face: number, r: () => number): number {
  const { b } = ctx;
  const gh = ctx.place(x, z, 1.4);
  const P = 5.2;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    b.add(new THREE.CylinderGeometry(0.17, 0.2, P + 3.2, 6), WOOD_D, M(x + sx * 1.25, (P + 3.2) / 2, z + sz * 1.25, 0, 1, sz * 0.03, -sx * 0.03));
  }
  // Diagonal braces
  for (const s of [-1, 1]) {
    b.add(new THREE.BoxGeometry(0.1, 3.6, 0.12), WOOD, M(x + s * 1.25, 2.4, z, 0, 1, 0.7, 0));
    b.add(new THREE.BoxGeometry(0.12, 3.6, 0.1), WOOD, M(x, 2.4, z + s * 1.25, 0, 1, 0, 0.7));
  }
  b.add(new THREE.BoxGeometry(3.2, 0.25, 3.2), WOOD_L, M(x, P, z, face));
  for (const [sx, sz, w, d] of [[0, -1.5, 3.2, 0.1], [0, 1.5, 3.2, 0.1], [-1.5, 0, 0.1, 3.2], [1.5, 0, 0.1, 3.2]] as const) b.add(new THREE.BoxGeometry(w, 1.0, d), WOOD, M(x + sx, P + 0.6, z + sz, 0));
  // Roof
  b.add(new THREE.ConeGeometry(2.6, 1.6, 4), BLUE, M(x, P + 3.3, z, Math.PI / 4));
  b.add(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 4), WOOD_D, M(x, P + 4.5, z));
  // Ladder (facing the inside of the camp)
  const lx = x - Math.sin(face) * 1.5;
  const lz = z - Math.cos(face) * 1.5;
  for (const s of [-0.35, 0.35]) b.add(new THREE.BoxGeometry(0.08, P + 0.6, 0.08), WOOD_L, M(lx + Math.cos(face) * s, (P + 0.6) / 2, lz - Math.sin(face) * s, face, 1, -0.12, 0));
  for (let i = 0; i < 9; i++) b.add(new THREE.BoxGeometry(0.72, 0.06, 0.08), WOOD_L, M(lx - Math.sin(face) * (0.12 - i * 0.07), 0.4 + i * 0.6, lz - Math.cos(face) * (0.12 - i * 0.07), face));
  // Brazier on the platform
  b.add(new THREE.CylinderGeometry(0.42, 0.25, 0.35, 8), IRON, M(x + Math.cos(face) * 0.9, P + 0.3, z - Math.sin(face) * 0.9));
  fl.add(x + Math.cos(face) * 0.9, gh + P + 0.45, z - Math.sin(face) * 0.9, 0.9, r() * 6);
  // Banner hanging outward
  bn.add(x + Math.sin(face) * 1.62, gh + P - 0.1, z + Math.cos(face) * 1.62, face, 1.4, 3.4, r() * 6);
  ctx.solids.add(x, z, 1.9);
  b.lift = 0;
  return gh + P + 0.13;
}

/** Cheval de frise: sharpened stakes crossing through a horizontal beam (along the ry direction) */
function chevaux(ctx: FieldCtx, x: number, z: number, ry: number, len: number): void {
  const { b } = ctx;
  ctx.place(x, z, len * 0.4);
  const dx = Math.sin(ry);
  const dz = Math.cos(ry);
  const qLog = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
  b.add(new THREE.CylinderGeometry(0.16, 0.16, len, 6), WOOD_D, new THREE.Matrix4().compose(new THREE.Vector3(x, 0.75, z), qLog, new THREE.Vector3(1, 1, 1)));
  const n = Math.max(2, Math.round(len / 0.8));
  for (let i = 0; i <= n; i++) {
    const t = -len / 2 + (len * i) / n;
    const px = x + dx * t;
    const pz = z + dz * t;
    for (const s of [-1, 1]) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, s * 0.8 + (i % 2 ? 0.08 : -0.08))));
      b.add(new THREE.CylinderGeometry(0.02, 0.09, 2.3, 5), i % 2 ? WOOD_L : WOOD, new THREE.Matrix4().compose(new THREE.Vector3(px, 0.75, pz), q, new THREE.Vector3(1, 1, 1)));
    }
    if (i % 2 === 0) ctx.solids.add(px, pz, 0.9);
  }
  b.lift = 0;
}

/** Command tent: a large rectangular tent with the ridge along x; the door faces north (the center of the camp) */
function commandTent(ctx: FieldCtx, bn: Banners, x: number, z: number, r: () => number): void {
  const { b } = ctx;
  const gh = ctx.place(x, z, 4);
  const W = 9;
  const D = 6;
  const H = 2.3;
  b.add(new THREE.BoxGeometry(W + 0.6, 0.25, D + 0.6), WOOD_D, M(x, 0.1, z));
  b.add(new THREE.BoxGeometry(W, H, D), CANVAS, M(x, H / 2 + 0.2, z));
  // Blue trim
  b.add(new THREE.BoxGeometry(W + 0.04, 0.35, D + 0.04), BLUE, M(x, H + 0.05, z));
  // Roof: a triangular prism
  const roof = new THREE.CylinderGeometry(1, 1, W + 0.8, 3, 1);
  roof.rotateZ(Math.PI / 2);
  roof.rotateX(-Math.PI / 2);
  roof.scale(1, 1.25, (D * 0.62) / 0.866);
  b.add(roof, CANVAS, M(x, H + 0.2 + 0.62, z));
  // Door flaps (north side): two panels thrown open
  for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(1.1, 2.1, 0.06), BLUE, M(x + s * 0.9, 1.25, z - D / 2 - 0.05, s * 0.5));
  b.add(new THREE.BoxGeometry(1.4, 2.0, 0.04), 0x2a2018, M(x, 1.2, z - D / 2 + 0.02));
  // Tall posts and banners at both ends
  for (const s of [-1, 1]) {
    const px = x + s * (W / 2 + 0.5);
    const pz = z - D / 2 - 0.4;
    b.add(new THREE.CylinderGeometry(0.1, 0.12, 6.4, 6), WOOD_D, M(px, 3.2, pz));
    b.add(new THREE.BoxGeometry(1.7, 0.1, 0.1), WOOD_D, M(px, 6.2, pz));
    b.add(new THREE.SphereGeometry(0.16, 8, 6), GOLD, M(px, 6.5, pz));
    bn.add(px, gh + 6.15, pz - 0.02, 0, 1.5, 3.8, r() * 6);
    ctx.solids.add(px, pz, 0.3);
  }
  // War table in front of the door: an unrolled map and a Source Crystal weighing it down
  const tz = z - D / 2 - 2.2;
  b.add(new THREE.BoxGeometry(2.4, 0.12, 1.4), WOOD_L, M(x, 0.95, tz));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(new THREE.BoxGeometry(0.1, 0.9, 0.1), WOOD_D, M(x + sx * 1.05, 0.45, tz + sz * 0.55));
  b.add(new THREE.BoxGeometry(1.9, 0.02, 1.1), 0xe8dcc0, M(x, 1.02, tz, 0.05), false);
  b.glow(new THREE.OctahedronGeometry(0.12), 0xffd27a, M(x + 0.5, 1.16, tz - 0.2));
  b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), 0xf2f2f2, M(x - 0.6, 1.18, tz + 0.2));
  ctx.solids.add(x, z, 4.6);
  ctx.solids.add(x - 3, z, 3.2);
  ctx.solids.add(x + 3, z, 3.2);
  ctx.solids.add(x, tz, 1.2);
  b.lift = 0;
}

/** Weapon rack: a few long spears and shields leaning against it */
function weaponRack(ctx: FieldCtx, x: number, z: number, ry: number, r: () => number): void {
  const { b } = ctx;
  ctx.place(x, z, 1);
  const dx = Math.cos(ry);
  const dz = -Math.sin(ry);
  for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.12, 1.5, 0.12), WOOD_D, M(x + dx * s * 1.1, 0.75, z + dz * s * 1.1, ry));
  b.add(new THREE.BoxGeometry(2.4, 0.1, 0.12), WOOD, M(x, 1.35, z, ry));
  b.add(new THREE.BoxGeometry(2.4, 0.1, 0.12), WOOD, M(x, 0.5, z, ry));
  for (let i = 0; i < 5; i++) {
    const t = -0.9 + i * 0.45;
    const px = x + dx * t;
    const pz = z + dz * t;
    b.add(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 4), WOOD_L, M(px, 1.3, pz, 0, 1, 0.12, 0));
    b.add(new THREE.ConeGeometry(0.07, 0.35, 4), STEEL, M(px, 2.7, pz + 0.15, 0, 1, 0.12, 0));
  }
  // Shields leaning in front of the rack
  for (const s of [-0.6, 0.6]) {
    const sh = new THREE.CylinderGeometry(0.45, 0.45, 0.08, 12);
    sh.rotateX(Math.PI / 2);
    const px = x + dx * s - Math.sin(ry) * 0.35;
    const pz = z + dz * s - Math.cos(ry) * 0.35;
    b.add(sh, BLUE, M(px, 0.48, pz, ry, 1, -0.25, 0));
    b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8).rotateX(Math.PI / 2), GOLD, M(px - Math.sin(ry) * 0.05, 0.49, pz - Math.cos(ry) * 0.05, ry, 1, -0.25, 0));
  }
  ctx.solids.add(x, z, 1.3);
  void r;
  b.lift = 0;
}

/** Tripod brazier */
function brazier(ctx: FieldCtx, fl: Flames, x: number, z: number, r: () => number): void {
  const { b } = ctx;
  const gh = ctx.place(x, z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(new THREE.CylinderGeometry(0.04, 0.05, 1.3, 4), IRON, M(x + Math.cos(a) * 0.25, 0.6, z + Math.sin(a) * 0.25, 0, 1, Math.sin(a) * 0.3, -Math.cos(a) * 0.3));
  }
  b.add(new THREE.CylinderGeometry(0.45, 0.22, 0.35, 8), IRON, M(x, 1.25, z));
  fl.add(x, gh + 1.35, z, 0.75, r() * 6);
  ctx.solids.add(x, z, 0.5);
}

/** Campfire at the center of the camp: a stone ring, a woodpile, benches around it */
function campfire(ctx: FieldCtx, fl: Flames, x: number, z: number, r: () => number): void {
  const { b } = ctx;
  const gh = ctx.place(x, z, 1.5);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    b.add(new THREE.DodecahedronGeometry(0.26, 0), COL.stone, M(x + Math.cos(a) * 0.95, 0.12, z + Math.sin(a) * 0.95, r() * 6));
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    b.add(new THREE.CylinderGeometry(0.09, 0.11, 1.3, 5), WOOD_D, M(x, 0.35, z, a, 1, 1.1, 0));
  }
  fl.add(x, gh + 0.1, z, 1.6, 0);
  fl.add(x + 0.25, gh + 0.1, z - 0.2, 1.1, 2);
  fl.add(x - 0.25, gh + 0.1, z + 0.15, 1.0, 4);
  // Benches: split logs
  for (const a of [0.4, 2.3, 4.2]) {
    const px = x + Math.cos(a) * 2.6;
    const pz = z + Math.sin(a) * 2.6;
    ctx.place(px, pz, 1);
    b.add(new THREE.CylinderGeometry(0.28, 0.28, 2.0, 8), WOOD, M(px, 0.3, pz, -a, 1, 0, Math.PI / 2));
    ctx.solids.add(px, pz, 0.8);
  }
  ctx.solids.add(x, z, 1.2);
  b.lift = 0;
}

/** Golden ward pillar: a Source Crystal hanging above a stone pillar, with a faint ring of light on the ground */
function wardPylon(ctx: FieldCtx, x: number, z: number, glows: THREE.BufferGeometry[]): void {
  const { b } = ctx;
  const gh = ctx.place(x, z, 0.8);
  b.add(new THREE.BoxGeometry(1.2, 0.5, 1.2), COL.stoneD, M(x, 0.25, z, Math.PI / 4));
  b.add(new THREE.CylinderGeometry(0.32, 0.45, 2.8, 6), 0x8a8494, M(x, 1.9, z));
  b.add(new THREE.TorusGeometry(0.42, 0.07, 5, 12), GOLD, M(x, 3.3, z, 0, 1, Math.PI / 2));
  const g = new THREE.OctahedronGeometry(0.34);
  g.scale(0.8, 1.5, 0.8);
  g.translate(x, gh + 3.9, z);
  glows.push(g);
  glowDisc(ctx, x, z, 4.5, 0xffc860, 0.35);
  ctx.solids.add(x, z, 0.8);
  b.lift = 0;
}

/** The position and heading s meters along a polyline */
function along(pts: readonly (readonly [number, number])[], s: number): [number, number, number, number] {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const l = Math.hypot(bx - ax, bz - az);
    if (s <= l || i + 2 === pts.length) {
      const t = Math.min(1, s / l);
      return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / l, (bz - az) / l];
    }
    s -= l;
  }
  return [pts[0][0], pts[0][1], 0, -1];
}

/**
 * Waymarker lamps the Knights planted beside the main road: a wooden pole,
 * a crossarm hung with a lantern and a small triangular pennant, marked all the way to the great road's bridgehead.
 * The closer to the Wound, the more dilapidated; the last one has already fallen to the ground, its lamp out.
 */
function pathMarker(ctx: FieldCtx, fl: Flames, bn: Banners, x: number, z: number, side: number, dx: number, dz: number, fallen: boolean, r: () => number): void {
  const { b } = ctx;
  const gh = ctx.place(x, z);
  // Crossarm pointing toward the road
  const ax = -dz * side;
  const az = dx * side;
  const face = Math.atan2(ax, az);
  if (!fallen) {
    b.add(new THREE.CylinderGeometry(0.07, 0.1, 2.9, 6), WOOD_D, M(x, 1.45, z));
    b.add(new THREE.BoxGeometry(0.07, 0.07, 0.9), WOOD_D, M(x + ax * 0.4, 2.75, z + az * 0.4, face));
    const lx = x + ax * 0.78;
    const lz = z + az * 0.78;
    b.add(new THREE.BoxGeometry(0.3, 0.06, 0.3), IRON, M(lx, 2.43, lz));
    b.add(new THREE.BoxGeometry(0.3, 0.06, 0.3), IRON, M(lx, 2.05, lz));
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) b.add(new THREE.BoxGeometry(0.03, 0.4, 0.03), IRON, M(lx + ox * 0.13, 2.24, lz + oz * 0.13), false);
    b.add(new THREE.CylinderGeometry(0.01, 0.01, 0.25, 3), IRON, M(lx, 2.6, lz), false);
    fl.add(lx, gh + 2.1, lz, 0.32, r() * 6);
    glowDisc(ctx, x + ax * 0.5, z + az * 0.5, 3.6, 0xffb060, 0.4);
    bn.add(x - ax * 0.05, gh + 2.55, z - az * 0.05, face + Math.PI / 2, 0.42, 0.85, r() * 6);
  } else {
    // Fallen lamp pole: falls to the outside of the road, the lantern thrown aside
    const ox = -ax;
    const oz = -az;
    const cx = x + ox * 1.3;
    const cz = z + oz * 1.3;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(ox, 0.18, oz).normalize());
    b.add(new THREE.CylinderGeometry(0.07, 0.1, 2.9, 6), WOOD_D, new THREE.Matrix4().compose(new THREE.Vector3(cx, 0.22, cz), q, new THREE.Vector3(1, 1, 1)));
    b.add(new THREE.CylinderGeometry(0.1, 0.12, 0.5, 6), WOOD_D, M(x, 0.25, z, 0, 1, 0.3, 0.2));
    b.add(new THREE.BoxGeometry(0.3, 0.36, 0.3), IRON, M(x + ox * 2.7 + dx * 0.5, 0.16, z + oz * 2.7 + dz * 0.5, r() * 6, 1, 0.4, 1.2));
  }
  ctx.solids.add(x, z, 0.3);
  b.lift = 0;
}

/** Remaining paving stones of the Old Kingdom Road: scattered along the main road, some missing, some tilted up */
function pavers(ctx: FieldCtx, pts: readonly (readonly [number, number])[], s0: number, s1: number, r: () => number): void {
  const { b } = ctx;
  const cols = [COL.stone, COL.stoneD, 0x4c4258];
  const step = ctx.low ? 1.6 : 1.15;
  for (let s = s0; s < s1; s += step) {
    const [px, pz, dx, dz] = along(pts, s);
    const ry = Math.atan2(dx, dz);
    // The further north (the closer to the Wound), the more ruined
    const keep = 0.72 - 0.25 * ((s - s0) / (s1 - s0));
    for (const u of [-1.05, 0.05, 1.1]) {
      if (r() > keep) continue;
      const lu = u + (r() - 0.5) * 0.35;
      const x = px - dz * lu + dx * (r() - 0.5) * 0.4;
      const z = pz + dx * lu + dz * (r() - 0.5) * 0.4;
      if (land(x, z) < 1.2) continue;
      ctx.place(x, z);
      const w = 0.85 + r() * 0.3;
      const d = 0.9 + r() * 0.35;
      const lifted = r() < 0.08;
      b.add(new THREE.BoxGeometry(w, 0.16, d), cols[Math.floor(r() * 3)], M(x, lifted ? 0.12 : 0.02, z, ry + (r() - 0.5) * 0.18, 1, lifted ? 0.25 : (r() - 0.5) * 0.04, (r() - 0.5) * 0.04), false);
    }
  }
  b.lift = 0;
}

// ───────────────────────── Assembly ─────────────────────────

export function buildOutpost(ctx: FieldCtx, clock: RiftClock, fl: Flames, bn: Banners): void {
  const { b, r } = ctx;
  const pylonGlow: THREE.BufferGeometry[] = [];

  palisade(ctx);
  // North gate: two watchtowers and the crest above the lintel
  const ga = (12.5 * Math.PI) / 180;
  const [lx, lz] = onRing(-ga);
  const [rx, rz] = onRing(ga);
  const platY = watchtower(ctx, fl, bn, lx, lz, Math.PI, r);
  watchtower(ctx, fl, bn, rx, rz, Math.PI, r);
  {
    const mx = (lx + rx) / 2;
    const mz = (lz + rz) / 2 - 0.2;
    const gh = ctx.place(mx, mz, 3);
    const span = Math.hypot(rx - lx, rz - lz);
    b.add(new THREE.BoxGeometry(span, 0.45, 0.5), WOOD_D, M(mx, 6.6, mz));
    b.add(new THREE.BoxGeometry(span * 0.8, 0.3, 0.4), WOOD, M(mx, 7.0, mz));
    const shield = new THREE.CylinderGeometry(0.85, 0.85, 0.15, 6);
    shield.rotateX(Math.PI / 2);
    b.add(shield, BLUE, M(mx, 6.55, mz - 0.35));
    b.add(new THREE.OctahedronGeometry(0.4).scale(1, 1.4, 0.4), GOLD, M(mx, 6.55, mz - 0.45));
    void gh;
    b.lift = 0;
  }
  // Cheval-de-frise barricades outside the gate: lined up on both sides along the camp's outer rim,
  // with a path left in the middle
  for (const [x, z, ry, len] of [
    [-6, 51.5, Math.PI / 2 + 0.25, 4.2],
    [-12.5, 54.5, Math.PI / 2 + 0.6, 4.2],
    [-17.5, 59.5, Math.PI / 2 + 0.95, 4.2],
    [17.5, 51.5, Math.PI / 2 - 0.25, 4.2],
    [24, 54.5, Math.PI / 2 - 0.6, 4.2],
    [-1.5, 47.5, Math.PI / 2 + 0.15, 2.6],
    [12.5, 47.5, Math.PI / 2 - 0.2, 2.6],
  ] as const)
    chevaux(ctx, x, z, ry, len);
  brazier(ctx, fl, 1.2, 54.2, r);
  brazier(ctx, fl, 10.8, 54.2, r);

  // Inside the camp: command tent, tents, campfire, weapon racks, supplies
  commandTent(ctx, bn, CX, 86.5, r);
  const tents: [number, number, number, number][] = [
    [-6, 69, 2.4, 0x2e4a8a],
    [-8.5, 78.5, 2.6, 0x8a2e3a],
    [-3.5, 88, 2.2, 0x2e4a8a],
    [17.5, 79, 2.5, 0x8a2e3a],
    [16.5, 88.5, 2.2, 0x2e4a8a],
    [20.5, 61, 2.1, 0x2e4a8a],
  ];
  // The tents and the lived-in corners of the camp use their own random numbers (so later placement is not disturbed)
  const cr = rng(3301);
  for (const [x, z, R, roof] of tents) campTent(ctx, bn, x, z, R, CANVAS, roof, Math.atan2(CX - x, CZ - z), cr);
  b.lift = 0;
  campfire(ctx, fl, -0.5, 73, r);
  glowDisc(ctx, -0.5, 73, 7, 0xff9a40, 0.55);
  weaponRack(ctx, -1.5, 62.5, 0.5, r);
  weaponRack(ctx, 13.5, 64, -0.5, r);
  crates(ctx, -9.5, 64, 0x8a6a42, WOOD_D);
  crates(ctx, 21, 84.5, 0x8a6a42, WOOD_D);
  crates(ctx, 0.5, 91, 0x8a6a42, WOOD_D);
  b.lift = 0;
  for (const [x, z] of [
    [2.8, 67],
    [9.2, 67],
    [2.8, 79.5],
    [9.5, 76],
  ] as const)
    lampPost(ctx, x, z, WOOD_D, 0xffc870, 2.8);
  b.lift = 0;
  // String lights between the tents
  const lanternGeo: THREE.BufferGeometry[] = [];
  const strings: [[number, number, number], [number, number, number]][] = [
    [[CX - 5, 6.1, 86.5 - 3.4], [-3.5, 3.4, 88]],
    [[CX + 5, 6.1, 86.5 - 3.4], [16.5, 3.4, 88.5]],
    [[-8.5, 3.9, 78.5], [-6, 3.6, 69]],
    [[17.5, 3.9, 79], [20.5, 3.4, 61]],
  ];
  for (const [a, c] of strings) {
    const A = new THREE.Vector3(a[0], ctx.h(a[0], a[2]) + a[1], a[2]);
    const C = new THREE.Vector3(c[0], ctx.h(c[0], c[2]) + c[1], c[2]);
    rope(b, A, C, 0.9, 0.025, WOOD_D);
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      const p = A.clone().lerp(C, t);
      p.y -= Math.sin(t * Math.PI) * 0.9 + 0.2;
      lanternGeo.push(new THREE.BoxGeometry(0.16, 0.2, 0.16).translate(p.x, p.y, p.z));
    }
  }
  // Ward pillar
  wardPylon(ctx, -6, 83, pylonGlow);
  wardPylon(ctx, 13.5, 71.5, pylonGlow);
  wardPylon(ctx, -10.5, 72.5, pylonGlow);
  buildCamp(ctx, fl, bn, cr);
  // Waymarker at the camp gate
  {
    const x = 11;
    const z = 49.5;
    ctx.place(x, z);
    b.add(new THREE.BoxGeometry(0.14, 2.0, 0.14), WOOD_D, M(x, 1.0, z));
    b.add(new THREE.BoxGeometry(1.3, 0.34, 0.08), WOOD_L, M(x, 1.6, z, 0.3, 1, 0, 0.1));
    ctx.solids.add(x, z, 0.3);
    b.lift = 0;
  }

  // The main road: the Knights' waymarker lamps are planted all the way to the great road's bridgehead;
  // underfoot are the remaining paving stones of the Old Kingdom Road
  // (after purification, the fallen one is also set upright and lit again)
  const road = ctx.layout.path.slice(3);
  const pure = ctx.done >= ctx.floors;
  const mr = rng(2027);
  for (const [s, side, fallen] of [
    [8.5, -1, false],
    [19, 1, false],
    [25.5, -1, !pure],
  ] as const) {
    const [px, pz, dx, dz] = along(road, s);
    pathMarker(ctx, fl, bn, px + dz * side * 2.9, pz - dx * side * 2.9, side, dx, dz, fallen, mr);
  }
  // The paving stones follow the road surface the engine has smoothed (so that at bends they do not stray off the road and
  // press into the curbstones)
  const full = samplePath(ctx.layout.path, 1);
  let k0 = 0;
  for (let i = 0; i < full.length; i++) if (Math.hypot(full[i][0] - road[0][0], full[i][1] - road[0][1]) < Math.hypot(full[k0][0] - road[0][0], full[k0][1] - road[0][1])) k0 = i;
  pavers(ctx, full.slice(k0), 6, 56, r);

  // Breathing warm light: the string lights, the ward Source Crystal
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc060).multiplyScalar(2.2), toneMapped: false });
  const gold = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd27a).multiplyScalar(2.4), toneMapped: false });
  const lg = mergeGeometries(lanternGeo.map((g) => g.toNonIndexed()));
  const pg = mergeGeometries(pylonGlow.map((g) => g.toNonIndexed()));
  if (lg) ctx.group.add(new THREE.Mesh(lg, warm));
  const pylonMesh = pg ? new THREE.Mesh(pg, gold) : null;
  if (pylonMesh) ctx.group.add(pylonMesh);

  // Guards (cannot be talked to, just standing watch)
  const shadowTex = blobShadowTex();
  const guards: Avatar[] = [];
  const guard = (x: number, z: number, face: number, look: 'guard' | 'knight', y?: number) => {
    const a = new Avatar(npcOutfit(look));
    const gy = y ?? ctx.h(x, z);
    a.root.position.set(x, gy, z);
    a.root.rotation.y = face;
    ctx.group.add(a.root);
    const sh = blobShadow(shadowTex, 1.2);
    sh.position.set(x, gy + 0.04, z);
    ctx.group.add(sh);
    ctx.solids.add(x, z, 0.5);
    guards.push(a);
    ctx.disposers.push(() => {
      a.dispose();
      sh.geometry.dispose();
      (sh.material as THREE.Material).dispose();
    });
  };
  guard(2.6, 52.6, Math.PI, 'guard');
  guard(9.4, 52.6, Math.PI, 'guard');
  guard(lx + 0.5, lz - 0.6, Math.PI + 0.3, 'knight', platY);
  guard(CX + 3.2, 81.4, -0.3, 'knight');
  guard(-9, 91.5, 0.4, 'guard');
  ctx.disposers.push(() => {
    shadowTex.dispose();
    warm.dispose();
    gold.dispose();
    lg?.dispose();
    pg?.dispose();
  });

  let emberT = 0;
  ctx.extras.push((dt, t, vfx) => {
    for (const a of guards) a.update(dt);
    const k = 2.1 + Math.sin(t * 1.7) * 0.25 + Math.sin(t * 4.3) * 0.08;
    warm.color.setHex(0xffc060).multiplyScalar(k);
    if (pylonMesh) {
      pylonMesh.position.y = Math.sin(t * 1.2) * 0.12;
      gold.color.setHex(0xffd27a).multiplyScalar(2.2 + Math.sin(t * 2) * 0.35);
    }
    // Campfire sparks (emitted only when the player is nearby)
    if (Math.hypot(vfx.camPos.x - CX, vfx.camPos.z - CZ) > 70) return;
    emberT += dt;
    while (emberT > 0.07) {
      emberT -= 0.07;
      const src = Math.random() < 0.6 ? [-0.5, 73, 0.6] : Math.random() < 0.5 ? [1.2, 54.2, 1.4] : [10.8, 54.2, 1.4];
      const gh = ctx.h(src[0], src[1]);
      vfx.emit({ pos: new THREE.Vector3(src[0] + (Math.random() - 0.5) * 0.5, gh + src[2], src[1] + (Math.random() - 0.5) * 0.5), count: 1, color: [0xffc060, 0xff7a30, 0xffe0a0], speed: [0.8, 2.2], dir: new THREE.Vector3(0.1, 1, 0.05), spread: 0.35, life: [0.8, 1.6], size: [0.05, 0.1], sizeEnd: 0.2, drag: 0.4, intensity: 2 });
    }
  });
}
