// Remains of the old world: small scenes placed by hand, one by one, across the four pieces of land.
// A stone house with a collapsed roof (walls alternately high and low, the roof beam fallen at a slant inside),
// a giant stone hand reaching out of the ground, a broken arch spanning the old road,
// a fountain in the old city's plaza filled with void, a round tower with only half a ring left,
// a statue of a saint toppled and broken into several pieces, the skeleton of a giant beast (its ribs arch into a passage
// that can be walked through),
// and a ring of obelisks carved with runes. Around every one of them float rock fragments (gravity can no longer be relied on here).

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import type { FieldCtx } from '../../kit.ts';
import { glowDisc } from './decals.ts';
import type { Flames } from './fx.ts';
import { COL, crystalCluster } from './props.ts';
import { ironLamp } from './roadside.ts';
import { HEAL, pavingPatch, rubblePile, seg, STONE, taperTube } from './scatter.ts';
import { land } from './shape.ts';
import type { Debris } from './void.ts';

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const WALL = [0x7a7088, 0x6a5e74, 0x5e5268, 0x72687f];
const BONE = 0xb8aec4;
const BONE_D = 0x8e849c;
const BEAM = 0x3a2a24;

/** Local coordinates: lz points toward the direction of face, lx points right */
function frame(x: number, z: number, face: number) {
  const c = Math.cos(face);
  const s = Math.sin(face);
  return (lx: number, lz: number) => [x + c * lx + s * lz, z - s * lx + c * lz] as const;
}

const crackCol = () => (HEAL.pure ? 0xffd890 : COL.cryA);

// ───────────────────────── Stone house with a collapsed roof ─────────────────────────

function ruinedHouse(ctx: FieldCtx, x: number, z: number, face: number, w: number, d: number, r: () => number, debris: Debris[]): void {
  const { b } = ctx;
  const W = frame(x, z, face);
  pavingPatch(ctx, x, z, face, Math.max(2, Math.round(w / 1.1) - 1), Math.max(2, Math.round(d / 1.1) - 1), r);
  const H = 2.6 + r() * 1.2;
  // Four walls: each section about a meter, with the height undulating slowly along the wall (as if gnawed away),
  // and a doorway in the middle of the front
  const sides: [number, number, number, number, boolean][] = [
    // Start lx, lz, direction (0 along x, 1 along z), length, whether it is the front
    [-w / 2, d / 2, 0, w, true],
    [-w / 2, -d / 2, 0, w, false],
    [-w / 2, -d / 2, 1, d, false],
    [w / 2, -d / 2, 1, d, false],
  ];
  const drop = r() * 4;
  for (const [sx, sz, dir, len, front] of sides) {
    const n = Math.max(2, Math.round(len / 1.05));
    let hh = H * (0.5 + r() * 0.5);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const lx = dir === 0 ? sx + t * len : sx;
      const lz = dir === 0 ? sz : sz + t * len;
      if (front && Math.abs(t - 0.5) < 0.13) continue;
      hh = Math.min(H, Math.max(0.25, hh + (r() - 0.5) * 1.3));
      // One corner has collapsed entirely
      const corner = Math.hypot(lx - (drop > 2 ? w / 2 : -w / 2), lz - (drop % 2 > 1 ? d / 2 : -d / 2));
      let h = hh * (0.25 + 0.75 * Math.min(1, corner / (Math.max(w, d) * 0.6)));
      if (r() < 0.1) continue;
      // Window in the side wall: only the short stretch below the sill
      const win = !front && dir === 1 && Math.abs(t - 0.5) < 0.2 && h > 1.6;
      if (win) h = 1.0;
      const [px, pz] = W(lx, lz);
      if (land(px, pz) < 1) continue;
      ctx.place(px, pz);
      const ry = face + (dir === 0 ? 0 : Math.PI / 2);
      const segLen = len / n + 0.04;
      b.add(new THREE.BoxGeometry(segLen, h, 0.45), WALL[Math.floor(r() * WALL.length)], M(px, h / 2 - 0.1, pz, ry));
      // A crooked stone on top of the break
      if (r() < 0.35) b.add(new THREE.BoxGeometry(segLen * 0.6, 0.25, 0.5), WALL[0], M(px, h - 0.05, pz, ry + (r() - 0.5) * 0.3, 1, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3));
      if (win) b.add(new THREE.BoxGeometry(segLen, 0.3, 0.5), WALL[1], M(px, 2.35, pz, ry));
      if (h > 0.6) ctx.solids.add(px, pz, 0.5);
    }
  }
  b.lift = 0;
  // Door frame
  for (const s of [-1, 1]) {
    const [px, pz] = W(s * 0.75, d / 2);
    ctx.place(px, pz);
    b.add(new THREE.BoxGeometry(0.35, 2.3, 0.55), WALL[2], M(px, 1.05, pz, face));
    ctx.solids.add(px, pz, 0.35);
  }
  {
    const [px, pz] = W(0, d / 2);
    ctx.place(px, pz);
    if (r() < 0.6) b.add(new THREE.BoxGeometry(1.9, 0.35, 0.6), WALL[0], M(px, 2.3, pz, face, 1, 0, (r() - 0.5) * 0.15));
  }
  // Remaining stub of a chimney (in the back corner)
  {
    const [px, pz] = W(w / 2 - 0.5, -d / 2 + 0.5);
    ctx.place(px, pz);
    const ch = H + 0.6 + r();
    b.add(new THREE.BoxGeometry(0.9, ch, 0.9), WALL[3], M(px, ch / 2 - 0.1, pz, face));
    b.add(new THREE.BoxGeometry(1.05, 0.2, 1.05), WALL[0], M(px, ch - 0.1, pz, face));
    ctx.solids.add(px, pz, 0.6);
  }
  // The roof beam fallen into the house and a pile of broken tiles
  for (let i = 0; i < 2; i++) {
    const [ax, az] = W((r() - 0.5) * w * 0.7, -d / 2 + 0.2);
    const [cx, cz] = W((r() - 0.5) * w * 0.6, d * (0.05 + r() * 0.3));
    const ah = ctx.h(ax, az) + H * (0.6 + r() * 0.3);
    const ch = ctx.h(cx, cz) + 0.1;
    b.lift = 0;
    seg(b, V3(ax, ah, az), V3(cx, ch, cz), 0.14, 0.12, BEAM, 5);
  }
  for (let i = 0; i < 7; i++) {
    const [px, pz] = W((r() - 0.5) * w * 0.8, (r() - 0.3) * d * 0.7);
    ctx.place(px, pz);
    b.add(new THREE.BoxGeometry(0.5 + r() * 0.3, 0.05, 0.35 + r() * 0.2), 0x3a2a4a, M(px, 0.08 + r() * 0.15, pz, r() * 6, 1, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6), false);
  }
  // Tiles and stones floating above the roof
  for (let i = 0; i < 4; i++) {
    const [px, pz] = W((r() - 0.5) * w, (r() - 0.5) * d);
    debris.push([px, ctx.h(px, pz) + H + 0.8 + r() * 2.5, pz, 0.18 + r() * 0.2, r() < 0.5 ? 1 : 0]);
  }
  b.lift = 0;
}

// ───────────────────────── Giant stone hand ─────────────────────────

/**
 * The hand of a statue reaching out of the ground: the forearm slanting out of the ground, the palm facing forward,
 * the fingers curling toward the palm, as if about to grab something
 */
function giantHand(ctx: FieldCtx, x: number, z: number, face: number, s: number, r: () => number, debris: Debris[]): void {
  const { b } = ctx;
  const gy = ctx.place(x, z, 2 * s);
  b.lift = 0;
  const f = V3(Math.sin(face), 0, Math.cos(face));
  const Y = V3(f.x * 0.42, 1, f.z * 0.42).normalize();
  const Z = f.clone().addScaledVector(Y, -f.dot(Y)).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
  const base = V3(x, gy - 1.2, z);
  const wrist = base.clone().addScaledVector(Y, 3.6 * s);
  const P = (lx: number, ly: number, lz: number) => wrist.clone().addScaledVector(X, lx).addScaledVector(Y, ly).addScaledVector(Z, lz);
  const basis = new THREE.Matrix4().makeBasis(X, Y, Z);
  const at = (p: THREE.Vector3, lm = new THREE.Matrix4()) => new THREE.Matrix4().copy(basis).setPosition(p).multiply(lm);
  const col = STONE[2];
  // Forearm and bracer
  seg(b, base, wrist, 0.95 * s, 0.78 * s, STONE[0], 8);
  b.add(new THREE.CylinderGeometry(0.9 * s, 0.95 * s, 0.6 * s, 8), COL.goldD, at(P(0, -0.9 * s, 0)));
  // Palm
  b.add(new THREE.BoxGeometry(2.0 * s, 2.3 * s, 0.85 * s), col, at(P(0, 1.1 * s, 0)));
  // Fingers: two joints curling toward the palm (+Z); one of them is broken
  const broken = Math.floor(r() * 4);
  for (let i = 0; i < 4; i++) {
    const lx = (-0.72 + i * 0.48) * s;
    const L1 = (1.15 - Math.abs(i - 1.5) * 0.12) * s;
    const c1 = 0.25 + r() * 0.35;
    const c2 = c1 + 0.55 + r() * 0.4;
    const k0 = P(lx, 2.25 * s, 0);
    const d1 = Y.clone().multiplyScalar(Math.cos(c1)).addScaledVector(Z, Math.sin(c1));
    const k1 = k0.clone().addScaledVector(d1, L1);
    b.add(new THREE.DodecahedronGeometry(0.27 * s, 0), col, M(k0.x, k0.y, k0.z, r() * 6));
    seg(b, k0, k1, 0.25 * s, 0.22 * s, col, 6);
    if (i === broken) {
      b.glow(new THREE.CylinderGeometry(0.15 * s, 0.2 * s, 0.06, 6), crackCol(), at(k1));
      continue;
    }
    const d2 = Y.clone().multiplyScalar(Math.cos(c2)).addScaledVector(Z, Math.sin(c2));
    const k2 = k1.clone().addScaledVector(d2, L1 * 0.85);
    b.add(new THREE.DodecahedronGeometry(0.23 * s, 0), col, M(k1.x, k1.y, k1.z, r() * 6));
    seg(b, k1, k2, 0.21 * s, 0.16 * s, col, 6);
  }
  // Thumb
  const t0 = P(1.0 * s, 0.6 * s, 0.25 * s);
  const t1 = t0.clone().addScaledVector(X.clone().multiplyScalar(0.55).addScaledVector(Y, 0.6).addScaledVector(Z, 0.55).normalize(), 1.1 * s);
  const t2 = t1.clone().addScaledVector(Y.clone().multiplyScalar(0.5).addScaledVector(Z, 0.8).addScaledVector(X, -0.3).normalize(), 0.8 * s);
  seg(b, t0, t1, 0.3 * s, 0.26 * s, col, 6);
  seg(b, t1, t2, 0.24 * s, 0.18 * s, col, 6);
  // Corruption cracks on the back of the hand and the forearm
  b.glow(new THREE.BoxGeometry(0.08 * s, 1.8 * s, 0.05), crackCol(), at(P(0.3 * s, 0.9 * s, -0.44 * s), M(0, 0, 0, 0, 1, 0, 0.35)));
  b.glow(new THREE.BoxGeometry(0.07 * s, 2.2 * s, 0.05), crackCol(), at(P(-0.2 * s, -1.8 * s, -0.8 * s), M(0, 0, 0, 0, 1, 0, -0.25)));
  if (!HEAL.pure) {
    b.lift = ctx.h(x, z);
    crystalCluster(b, x - f.x * 1.4 * s + X.x * 0.8 * s, z - f.z * 1.4 * s + X.z * 0.8 * s, 0.9 * s, r);
    b.lift = 0;
  }
  // Soil and rubble dug up by the hand
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    rubblePile(ctx, x + Math.cos(a) * 1.9 * s, z + Math.sin(a) * 1.9 * s, 0.5 + r() * 0.4, r, false);
  }
  ctx.b.lift = 0;
  ctx.solids.add(x, z, 1.5 * s);
  const pc = P(0, 1.1 * s, 0);
  ctx.solids.add(pc.x, pc.z, 1.2 * s);
  for (let i = 0; i < 6; i++) debris.push([pc.x + (r() - 0.5) * 5 * s, pc.y + (r() - 0.3) * 3, pc.z + (r() - 0.5) * 5 * s, 0.15 + r() * 0.3, 0]);
}

// ───────────────────────── Broken arch ─────────────────────────

/**
 * A broken arch spanning the road: the left pillar is intact, the right pillar is snapped halfway up,
 * only a stretch of the arch extends from the left pillar, and the arch stones have fallen on both sides (the road surface stays clear)
 */
function brokenArch(ctx: FieldCtx, x: number, z: number, face: number, span: number, H: number, r: () => number): void {
  const { b } = ctx;
  const W = frame(x, z, face);
  const R = span / 2;
  const gh = ctx.place(x, z, R);
  for (const s of [-1, 1]) {
    const [px, pz] = W(s * R, 0);
    ctx.place(px, pz, 0.8);
    const h = s < 0 ? H : H * (0.4 + r() * 0.15);
    b.add(new THREE.BoxGeometry(1.6, 0.5, 1.6), STONE[3], M(px, 0.2, pz, face));
    b.add(new THREE.BoxGeometry(1.1, h, 1.1), WALL[1], M(px, h / 2, pz, face));
    if (s < 0) {
      b.add(new THREE.BoxGeometry(1.45, 0.4, 1.45), WALL[0], M(px, h + 0.2, pz, face));
      b.glow(new THREE.BoxGeometry(0.06, h * 0.7, 0.06), crackCol(), M(px + Math.sin(face) * 0.56, h * 0.45, pz + Math.cos(face) * 0.56, face));
    } else {
      b.add(new THREE.CylinderGeometry(0.3, 0.7, 0.6, 5), WALL[1], M(px, h + 0.2, pz, r() * 6, 1, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4));
    }
    ctx.solids.add(px, pz, 0.85);
  }
  b.lift = gh;
  b.add(new THREE.TorusGeometry(R, 0.5, 6, 16, Math.PI * (0.5 + r() * 0.15)), WALL[0], M(x, H + 0.4, z, face + Math.PI));
  // Fallen arch stones: lined up on the two outer sides of the arch
  for (let i = 0; i < 5; i++) {
    const s = i % 2 ? 1 : -1;
    const [px, pz] = W(s * (R + 1.2 + r() * 1.5), (r() - 0.5) * 3);
    if (land(px, pz) < 1.5) continue;
    ctx.place(px, pz);
    const g = new THREE.CylinderGeometry(0.55, 0.4, 0.8, 4);
    b.add(g, WALL[Math.floor(r() * WALL.length)], M(px, 0.3, pz, r() * 6, 1, Math.PI / 2 + (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
  }
  b.lift = 0;
}

// ───────────────────────── Fountain in the old city's plaza ─────────────────────────

function voidFountain(ctx: FieldCtx, fl: Flames, x: number, z: number, r: () => number, debris: Debris[]): void {
  const { b } = ctx;
  pavingPatch(ctx, x, z, 0.3, 11, 11, r);
  const gh = ctx.place(x, z, 3.5);
  const R = 3.2;
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (i === 4 || i === 5) continue;
    const fall = i === 11;
    const px = x + Math.cos(a) * (R + (fall ? 0.7 : 0));
    const pz = z + Math.sin(a) * (R + (fall ? 0.7 : 0));
    b.add(new THREE.BoxGeometry(0.5, 0.75, (2 * Math.PI * R) / n + 0.08), WALL[i % 3], M(px, fall ? 0.2 : 0.3, pz, -a, 1, 0, fall ? 1.2 : 0));
  }
  // The basin is filled with void: a black-purple water surface, a faint glow
  b.add(new THREE.CylinderGeometry(R - 0.2, R - 0.2, 0.08, 18), HEAL.pure ? 0x3a6a8a : 0x1a0c26, M(x, 0.35, z), false);
  glowDisc(ctx, x, z, R + 1.5, HEAL.pure ? 0x9ad8ff : 0x9a4aff, 0.4);
  // The pedestal in the center and a statue of which only the lower half remains
  b.add(new THREE.CylinderGeometry(0.7, 0.9, 1.4, 8), WALL[1], M(x, 0.9, z));
  b.add(new THREE.CylinderGeometry(1.5, 0.6, 0.35, 10), WALL[0], M(x, 1.7, z, 0, 1, 0.12, 0.05));
  b.add(new THREE.CylinderGeometry(0.45, 0.75, 1.5, 7), 0x8a8096, M(x, 2.6, z, 0, 1, 0.05, 0));
  b.add(new THREE.CylinderGeometry(0.25, 0.45, 0.3, 6), 0x8a8096, M(x, 3.45, z, r() * 6, 1, 0.4, 0.2));
  b.glow(new THREE.BoxGeometry(0.05, 1.1, 0.05), crackCol(), M(x + 0.5, 2.5, z, 0.3, 1, 0, 0.3));
  ctx.solids.add(x, z, R + 0.4);
  b.lift = 0;
  // Old iron street lamps and stone benches at the four corners
  for (let i = 0; i < 4; i++) {
    const a = 0.3 + (i / 4) * Math.PI * 2 + Math.PI / 4;
    const px = x + Math.cos(a) * 6.2;
    const pz = z + Math.sin(a) * 6.2;
    if (land(px, pz) < 2 || ctx.solids.blocked(px, pz, 0.4)) continue;
    ironLamp(ctx, fl, px, pz, Math.atan2(x - px, z - pz), i === 2 ? 2 : i === 1 ? 1 : 0, r);
  }
  for (let i = 0; i < 3; i++) {
    const a = 0.3 + (i / 3) * Math.PI * 2;
    const px = x + Math.cos(a) * 5.0;
    const pz = z + Math.sin(a) * 5.0;
    if (land(px, pz) < 2 || ctx.solids.blocked(px, pz, 0.6)) continue;
    ctx.place(px, pz, 0.8);
    const ry = -a + Math.PI / 2;
    b.add(new THREE.BoxGeometry(1.8, 0.16, 0.55), WALL[0], M(px, 0.5, pz, ry, 1, i === 1 ? 0.25 : 0, 0));
    for (const s of [-0.7, 0.7]) b.add(new THREE.BoxGeometry(0.25, 0.45, 0.45), WALL[2], M(px + Math.cos(ry) * s, 0.22, pz - Math.sin(ry) * s, ry));
    ctx.solids.add(px, pz, 0.7);
  }
  for (let i = 0; i < 6; i++) debris.push([x + (r() - 0.5) * 4, gh + 2.5 + r() * 3, z + (r() - 0.5) * 4, 0.2 + r() * 0.2, 1]);
  b.lift = 0;
}

// ───────────────────────── Half-ring round tower ─────────────────────────

function towerStump(ctx: FieldCtx, x: number, z: number, R: number, face: number, r: () => number, debris: Debris[]): void {
  const { b } = ctx;
  pavingPatch(ctx, x, z, face, Math.round(R * 1.6), Math.round(R * 1.6), r);
  const n = Math.round((Math.PI * 2 * R) / 1.1);
  const Hm = 6.5 + r() * 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Tallest at the back, with the whole front (the face direction) collapsed
    const rel = Math.cos(a - (Math.PI / 2 - face));
    const k = Math.min(1, Math.max(0, (0.55 - rel) / 1.2));
    let h = 0.3 + Hm * k * k * (0.8 + r() * 0.35);
    if (h < 0.5 && r() < 0.5) continue;
    h = Math.max(0.35, h);
    const px = x + Math.cos(a) * R;
    const pz = z + Math.sin(a) * R;
    ctx.place(px, pz);
    const ry = -a + Math.PI / 2;
    b.add(new THREE.BoxGeometry((2 * Math.PI * R) / n + 0.1, h, 0.85), WALL[i % 4], M(px, h / 2 - 0.1, pz, ry));
    // Arrow slits and crenellations
    if (h > 4 && i % 3 === 0) b.add(new THREE.BoxGeometry(0.22, 0.9, 0.9), 0x1a1420, M(px, h * 0.55, pz, ry), false);
    if (h > Hm * 0.75 && i % 2 === 0) b.add(new THREE.BoxGeometry(0.6, 0.6, 0.95), WALL[0], M(px, h + 0.25, pz, ry));
    if (h > 0.6) ctx.solids.add(px, pz, 0.6);
  }
  b.lift = 0;
  // The collapsed side: stones have rolled out across the ground
  const fx = Math.sin(face);
  const fz = Math.cos(face);
  for (let i = 0; i < 4; i++) {
    const d = R + 1.5 + r() * 3;
    const a = (r() - 0.5) * 1.4;
    const px = x + (fx * Math.cos(a) - fz * Math.sin(a)) * d;
    const pz = z + (fz * Math.cos(a) + fx * Math.sin(a)) * d;
    if (land(px, pz) < 2) continue;
    rubblePile(ctx, px, pz, 0.8 + r() * 0.5, r, true);
  }
  ctx.b.lift = 0;
  // A surviving stretch of spiral stair on the inside
  for (let i = 0; i < 7; i++) {
    const a = Math.PI / 2 - face + Math.PI + (i - 3) * 0.22;
    const px = x + Math.cos(a) * (R - 0.9);
    const pz = z + Math.sin(a) * (R - 0.9);
    ctx.place(px, pz);
    const y = 0.3 + (i + 1) * 0.42;
    b.add(new THREE.BoxGeometry(1.2, 0.2, 0.55), WALL[1], M(px, y, pz, -a));
  }
  b.lift = 0;
  // Above the collapsed side, wall stones still float near their original positions
  for (let i = 0; i < 9; i++) {
    const a = Math.PI / 2 - face + (r() - 0.5) * 1.6;
    const px = x + Math.cos(a) * R;
    const pz = z + Math.sin(a) * R;
    debris.push([px, ctx.h(px, pz) + 1.5 + r() * 5, pz, 0.3 + r() * 0.25, 0]);
  }
}

// ───────────────────────── Toppled statue of a saint ─────────────────────────

function fallenSaint(ctx: FieldCtx, x: number, z: number, face: number, s: number, r: () => number): void {
  const { b } = ctx;
  const W = frame(x, z, face);
  ctx.place(x, z, 1.5 * s);
  // Pedestal and the two feet snapped at the ankles
  b.add(new THREE.BoxGeometry(2.4 * s, 1.1 * s, 2.4 * s), STONE[3], M(x, 0.5 * s, z, face));
  b.add(new THREE.BoxGeometry(2.7 * s, 0.25 * s, 2.7 * s), WALL[0], M(x, 1.1 * s, z, face));
  for (const sx of [-0.35, 0.35]) {
    const [px, pz] = W(sx * s, 0.2 * s);
    b.add(new THREE.BoxGeometry(0.42 * s, 0.7 * s, 0.75 * s), 0x8a8096, M(px, 1.55 * s, pz, face, 1, 0, (r() - 0.5) * 0.2));
  }
  ctx.solids.add(x, z, 1.5 * s);
  b.lift = 0;
  // The body (robe) fallen in front: two pieces
  let off = 2.2 * s;
  for (let i = 0; i < 2; i++) {
    const len = (i === 0 ? 3.0 : 2.4) * s;
    const [px, pz] = W((r() - 0.5) * 0.6 * s, off + len / 2);
    if (land(px, pz) < 2) break;
    ctx.place(px, pz, 0.8 * s);
    const rad = (i === 0 ? 0.85 : 0.7) * s;
    b.add(new THREE.CylinderGeometry(rad * 0.85, rad, len, 7), 0x8a8096, M(px, rad * 0.8, pz, face + (r() - 0.5) * 0.3, 1, Math.PI / 2, 0));
    // Folds of the robe
    b.add(new THREE.BoxGeometry(rad * 1.8, 0.15 * s, len * 0.9), WALL[0], M(px, rad * 1.45, pz, face + (r() - 0.5) * 0.2));
    ctx.solids.add(px, pz, rad + 0.3);
    if (i === 0 && !HEAL.pure) {
      const [cx, cz] = W(0, off + len);
      b.lift = ctx.h(cx, cz);
      crystalCluster(b, cx, cz, 0.7 * s, r);
    }
    off += len + 0.4 * s;
  }
  // The head that snapped off and rolled away, and a raised arm
  const [hx, hz] = W(1.8 * s, off + 0.8 * s);
  if (land(hx, hz) > 2) {
    ctx.place(hx, hz, 0.8 * s);
    b.add(new THREE.SphereGeometry(0.75 * s, 10, 8), 0x9a90a6, M(hx, 0.6 * s, hz, r() * 6, 1, 0.3, 1.2));
    b.add(new THREE.CylinderGeometry(0.8 * s, 0.8 * s, 0.3 * s, 10, 1, true), COL.goldD, M(hx, 0.75 * s, hz, r() * 6, 1, 0.3, 1.2));
    ctx.solids.add(hx, hz, 0.9 * s);
  }
  const [ax, az] = W(-1.9 * s, 3 * s);
  if (land(ax, az) > 2) {
    ctx.place(ax, az);
    b.add(new THREE.CylinderGeometry(0.25 * s, 0.3 * s, 2.2 * s, 6), 0x8a8096, M(ax, 0.3 * s, az, face + 1.2, 1, Math.PI / 2, 0));
  }
  b.lift = 0;
}

// ───────────────────────── Skeleton of a giant beast ─────────────────────────

/**
 * A giant beast that died lying prone: the spine on top, the ribs arching to the ground on both sides with a walkable space
 * below; the skull rests in front and the tail vertebrae trail on the ground
 */
function beastSkeleton(ctx: FieldCtx, x: number, z: number, face: number, s: number, r: () => number): void {
  const { b } = ctx;
  const W = frame(x, z, face);
  const L = 13 * s;
  const spine: THREE.Vector3[] = [];
  const nV = 16;
  for (let i = 0; i <= nV; i++) {
    const t = i / nV;
    const lz = -L / 2 + t * L;
    const [px, pz] = W(Math.sin(t * 3.1) * 0.6 * s, lz);
    // The back ridge is high in the middle and drops to the ground at the head and tail ends
    const y = ctx.h(px, pz) + 4.2 * s * Math.pow(Math.sin(Math.PI * (0.1 + t * 0.8)), 1.3);
    spine.push(V3(px, y, pz));
  }
  b.lift = 0;
  for (let i = 0; i < nV; i++) {
    seg(b, spine[i], spine[i + 1], 0.24 * s, 0.22 * s, BONE_D, 6);
    const p = spine[i];
    b.add(new THREE.DodecahedronGeometry(0.34 * s, 0), BONE, M(p.x, p.y, p.z, r() * 6));
    b.add(new THREE.ConeGeometry(0.12 * s, 0.8 * s, 4), BONE, M(p.x, p.y + 0.5 * s, p.z, face, 1, -0.4, 0));
  }
  // Ribs: pair after pair arching down from the spine to both sides
  for (let i = 3; i <= 12; i++) {
    const p = spine[i];
    const env = Math.sin(Math.PI * ((i - 2) / 11));
    const reach = (2.6 + env * 1.3) * s;
    for (const sd of [-1, 1]) {
      if (r() < 0.12) continue;
      const pts: THREE.Vector3[] = [];
      const [ex, ez] = W(sd * reach + Math.sin(((i + 0.5) / nV) * 3.1) * 0.6 * s, -L / 2 + (i / nV) * L + 0.6 * s);
      const ey = ctx.h(ex, ez) - 0.1;
      for (let k = 0; k <= 7; k++) {
        const t = k / 7;
        // From the spine first outward, then curving down to the ground
        const out = Math.sin(t * Math.PI * 0.5);
        const q = p.clone().lerp(V3(ex, ey, ez), out);
        q.y = p.y + (ey - p.y) * (t * t) + Math.sin(t * Math.PI) * 0.9 * s;
        pts.push(q);
      }
      b.add(taperTube(pts, 0.2 * s, 0.09 * s, 5), BONE, new THREE.Matrix4());
      ctx.solids.add(ex, ez, 0.4 * s);
    }
  }
  // Skull: a long snout, a jaw, two pairs of backward-curving horns, and a faint glow still in the eye sockets
  const [hx, hz] = W(0.3 * s, L / 2 + 1.6 * s);
  const hy = ctx.h(hx, hz);
  b.add(new THREE.BoxGeometry(1.6 * s, 1.3 * s, 3.2 * s), BONE, M(hx, hy + 0.75 * s, hz, face + 0.15, 1, 0.12, 0.08));
  const [jx, jz] = W(0.5 * s, L / 2 + 1.9 * s);
  b.add(new THREE.BoxGeometry(1.3 * s, 0.35 * s, 2.9 * s), BONE_D, M(jx, ctx.h(jx, jz) + 0.18 * s, jz, face + 0.3, 1, -0.05, 0));
  for (const sd of [-1, 1]) {
    const [cx, cz] = W(0.3 * s + sd * 0.7 * s, L / 2 + 0.4 * s);
    const hornBase = V3(cx, hy + 1.2 * s, cz);
    const [tx, tz] = W(0.3 * s + sd * 1.8 * s, L / 2 - 1.8 * s);
    b.add(taperTube([hornBase, V3((cx + tx) / 2, hy + 2.6 * s, (cz + tz) / 2), V3(tx, hy + 2.2 * s, tz)], 0.28 * s, 0.03 * s, 5), BONE_D, new THREE.Matrix4());
    const [ox, oz] = W(0.3 * s + sd * 0.55 * s, L / 2 + 1.0 * s);
    b.glow(new THREE.SphereGeometry(0.13 * s, 6, 4), HEAL.pure ? 0xffe8b0 : 0xff5ab8, M(ox, hy + 1.05 * s, oz));
  }
  ctx.solids.add(hx, hz, 1.6 * s);
  // Tail
  for (let i = 0; i < 6; i++) {
    const [px, pz] = W(-Math.sin(i * 0.6) * 1.4 * s, -L / 2 - (i + 0.5) * 0.9 * s);
    if (land(px, pz) < 1.5) break;
    ctx.place(px, pz);
    b.add(new THREE.DodecahedronGeometry((0.3 - i * 0.03) * s, 0), BONE, M(px, 0.15 * s, pz, r() * 6));
  }
  // Crystals growing out of the bones
  if (!HEAL.pure) {
    for (const i of [5, 9]) {
      const p = spine[i];
      b.lift = p.y - 0.1;
      crystalCluster(b, p.x, p.z, 0.45 * s, r);
    }
  }
  b.lift = 0;
}

// ───────────────────────── Obelisk ring ─────────────────────────

function obelisks(ctx: FieldCtx, x: number, z: number, n: number, R: number, r: () => number): void {
  const { b } = ctx;
  const glow = HEAL.pure ? 0xffd890 : 0xb07aff;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3;
    const px = x + Math.cos(a) * R;
    const pz = z + Math.sin(a) * R;
    if (land(px, pz) < 2 || ctx.solids.blocked(px, pz, 0.8)) continue;
    ctx.place(px, pz, 0.7);
    const face = Math.atan2(x - px, z - pz);
    const h = 3.5 + r() * 3.5;
    const fallen = r() < 0.2;
    b.add(new THREE.BoxGeometry(1.6, 0.5, 1.6), STONE[3], M(px, 0.2, pz, face));
    if (fallen) {
      b.add(new THREE.CylinderGeometry(0.4, 0.62, h, 4), WALL[1], M(px - Math.sin(face) * h * 0.55, 0.45, pz - Math.cos(face) * h * 0.55, face + Math.PI / 4, 1, Math.PI / 2, 0));
    } else {
      const tilt = (r() - 0.5) * 0.18;
      b.add(new THREE.CylinderGeometry(0.42, 0.62, h, 4), WALL[i % 3], M(px, h / 2 + 0.4, pz, face + Math.PI / 4, 1, tilt, 0));
      b.add(new THREE.ConeGeometry(0.45, 0.9, 4), WALL[0], M(px + Math.sin(tilt) * h * 0.0, h + 0.85, pz, face + Math.PI / 4, 1, tilt, 0));
      // The face toward the center is carved with glowing runes
      for (let k = 0; k < 3; k++) b.glow(new THREE.BoxGeometry(0.28, 0.12, 0.04), glow, M(px + Math.sin(face) * 0.44, 1.4 + k * 0.7, pz + Math.cos(face) * 0.44, face, 1, tilt, 0));
    }
    ctx.solids.add(px, pz, 0.85);
  }
  // The altar stone in the middle and the magic circle on the ground
  ctx.place(x, z, 1);
  b.add(new THREE.BoxGeometry(1.8, 0.6, 1.2), WALL[2], M(x, 0.25, z, r() * 3));
  b.glow(new THREE.TorusGeometry(R * 0.55, 0.04, 3, 32), glow, M(x, 0.08, z, 0, 1, Math.PI / 2));
  glowDisc(ctx, x, z, R * 0.9, glow, 0.25);
  ctx.solids.add(x, z, 1);
  b.lift = 0;
}

// ───────────────────────── Assembly ─────────────────────────

/** Find a spot with room: start from (x, z) and, if it does not fit, nudge a little around it */
function spot(ctx: FieldCtx, x: number, z: number, rad: number): [number, number] | null {
  const L = ctx.layout;
  const ok = (px: number, pz: number) =>
    land(px, pz) > rad + 2 &&
    ctx.pathDist(px, pz) > L.pathW + 1 + rad * 0.8 &&
    !ctx.solids.blocked(px, pz, rad * 0.8) &&
    L.chests.every(([cx, cz]) => Math.hypot(cx - px, cz - pz) > rad + 3) &&
    L.zones.every((zn) => Math.hypot(zn.x - px, zn.z - pz) > zn.r * 0.5 + rad * 0.6);
  for (let k = 0; k < 12; k++) {
    const a = k * 2.4;
    const d = k === 0 ? 0 : 1.5 + k * 0.7;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    if (ok(px, pz)) return [px, pz];
  }
  return null;
}

export function buildRelics(ctx: FieldCtx, fl: Flames, r: () => number, spots: [number, number, number][], debris: Debris[]): void {
  const put = (x: number, z: number, rad: number, fn: (x: number, z: number) => void) => {
    const p = spot(ctx, x, z, rad);
    if (!p) return;
    fn(p[0], p[1]);
    spots.push([p[0], p[1], rad * 0.8]);
    ctx.b.lift = 0;
  };
  // The broken arch spanning the old road (positioned on the road, no need to find open ground)
  brokenArch(ctx, -30, 31, Math.atan2(-17.5, -7.6), 9, 7.5, r);
  brokenArch(ctx, -20, -79.2, Math.atan2(16, -6), 8.6, 7, r);
  spots.push([-30, 31, 2.5], [-20, -79.2, 2.5]);
  // South: the abandoned village southwest of the spawn point, the giant hand reaching out of the ground west of the camp,
  // the giant beast skeleton to the southeast
  put(-39, 53, 4, (x, z) => ruinedHouse(ctx, x, z, 0.5, 5.5, 4.4, r, debris));
  put(-46, 60, 3.5, (x, z) => ruinedHouse(ctx, x, z, 1.2, 4.6, 4, r, debris));
  put(-32, 45, 3, (x, z) => ruinedHouse(ctx, x, z, -0.3, 4.2, 3.6, r, debris));
  put(-27, 80, 3, (x, z) => giantHand(ctx, x, z, 2.6, 1.05, r, debris));
  put(52, 57, 6, (x, z) => beastSkeleton(ctx, x, z, 2.2, 1, r));
  put(40, 80, 3.5, (x, z) => ruinedHouse(ctx, x, z, -0.8, 5, 4, r, debris));
  // West: the old city plaza, round tower, toppled saint statue, ruined houses, obelisk
  put(-80, 45, 6, (x, z) => voidFountain(ctx, fl, x, z, r, debris));
  put(-90, 10, 5, (x, z) => towerStump(ctx, x, z, 3.6, 1.2, r, debris));
  put(-76, -33, 4, (x, z) => fallenSaint(ctx, x, z, 0.9, 1, r));
  put(-80, -54, 3.5, (x, z) => ruinedHouse(ctx, x, z, 2.1, 5, 4.2, r, debris));
  put(-92, -24, 4, (x, z) => obelisks(ctx, x, z, 5, 3.6, r));
  put(-72, 28, 3, (x, z) => ruinedHouse(ctx, x, z, 0.2, 4.4, 3.8, r, debris));
  // North: the giant beast skeleton, the obelisk ring
  put(10, -94, 5, (x, z) => beastSkeleton(ctx, x, z, Math.PI / 2 + 0.2, 0.8, r));
  put(50, -90, 4, (x, z) => obelisks(ctx, x, z, 4, 3.2, r));
  put(-58, -88, 3, (x, z) => ruinedHouse(ctx, x, z, 0.8, 4.2, 3.6, r, debris));
  // East: a cluster of ruined houses, a second giant hand, a toppled saint statue
  put(76, 36, 3.5, (x, z) => ruinedHouse(ctx, x, z, -0.4, 5, 4.2, r, debris));
  put(84, 42, 3, (x, z) => ruinedHouse(ctx, x, z, 0.9, 4, 3.6, r, debris));
  put(86, -40, 3, (x, z) => giantHand(ctx, x, z, -2.2, 0.9, r, debris));
  put(70, 18, 4, (x, z) => fallenSaint(ctx, x, z, 2.6, 0.9, r));
  put(92, 8, 4, (x, z) => towerStump(ctx, x, z, 3, -1.4, r, debris));
}
