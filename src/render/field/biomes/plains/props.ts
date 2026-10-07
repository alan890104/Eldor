// Thunderpeal Plains props: nomad tents, carts, totem poles, ovoo, the dwarves' lightning-rod pillars,
// vitrified lightning tubes (fulgurites), the skeleton of the ancient thunderbeast, a lone tree split in two by lightning,
// granite boulder piles, wind-bent low trees and scattered traces of the migration.
// All assume the ground is at y = 0 and are lifted onto the terrain with ctx.place(); cloth that moves is handed to ClothSet.

import * as THREE from 'three';
import { M, MS } from '../../../arenaKit.ts';
import { leanDir, leanM, rope, segM, V } from '../../../arenas/_woods.ts';
import type { FieldCtx } from '../../kit.ts';
import { WIND, type ClothSet } from './cloth.ts';

export const C = {
  felt: 0xe8d8b6,
  feltDark: 0xc9b48e,
  roof: 0x3c4a8c,
  roof2: 0x2c3872,
  gold: 0xe6b64e,
  red: 0xb8433a,
  redDark: 0x7e2a2a,
  door: 0xd0662e,
  wood: 0x7a5230,
  woodDark: 0x553824,
  rope: 0x6a4a32,
  metal: 0x3a3642,
  stone: 0x626686,
  stoneDark: 0x474b6a,
  stoneFar: 0x34365a,
  bronze: 0xc98f4a,
  copper: 0xd88a52,
  spark: 0xffe25a,
  bolt: 0x9ad0ff,
  scorch: 0x221c2a,
  bone: 0xeae0c8,
  boneShade: 0xcabd9e,
  hole: 0x2a2432,
  granite: 0x8e887a,
  granite2: 0x7a7468,
  granite3: 0x9c9686,
  lichen: 0xb8ad6a,
  glass: 0x86a2d8,
  glassDark: 0x2c4262,
  glassMid: 0x4a6a98,
  glassHi: 0xd8e6ff,
  char: 0x2c2630,
  bark: 0x5e4632,
  leaf: [0x60783a, 0x6f8a44, 0x4e6634],
  hay: 0xd8bd6a,
};

/** Local matrix L placed relative to the base T */
const at = (T: THREE.Matrix4, L: THREE.Matrix4) => T.clone().multiply(L);
const WIND_A = Math.atan2(WIND.z, WIND.x);

// ───────────────────────── Tents (yurts) ─────────────────────────

export interface YurtOpts {
  roof?: number;
  /** A lamp hung by the door */
  lamp?: boolean;
  /** The chieftain's great tent: a cloth awning in front of the door, a thunder emblem on the lintel */
  great?: boolean;
}

/**
 * Nomad tent: felt round wall, indigo conical roof, gold eave ring and skylight, red door; the door faces the face direction.
 * Returns the position of the chimney top
 */
export function yurt(ctx: FieldCtx, x: number, z: number, face: number, R: number, o: YurtOpts = {}): THREE.Vector3 {
  const { b } = ctx;
  const y0 = ctx.place(x, z, R * 0.8);
  const T = M(x, 0, z, face);
  const W = R * 0.62;
  const roofH = R * 0.55;
  const roof = o.roof ?? C.roof;
  // Wooden base, round wall, rope bands and the red patterned band
  b.add(new THREE.CylinderGeometry(R + 0.22, R + 0.34, 0.36, 20), C.woodDark, at(T, M(0, 0.08, 0)));
  b.add(new THREE.CylinderGeometry(R, R * 1.03, W, 20), C.felt, at(T, M(0, 0.26 + W / 2, 0)));
  for (const f of [0.26, 0.78]) b.add(new THREE.TorusGeometry(R * 1.035, 0.05, 5, 28), C.rope, at(T, M(0, 0.26 + W * f, 0, 0, 1, Math.PI / 2)), false);
  b.add(new THREE.CylinderGeometry(R * 1.042, R * 1.042, W * 0.2, 20, 1, true), C.red, at(T, M(0, 0.26 + W * 0.52, 0)), false);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.22;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.3) continue;
    b.add(new THREE.OctahedronGeometry(0.13), C.gold, at(T, M(Math.cos(a) * R * 1.06, 0.26 + W * 0.52, Math.sin(a) * R * 1.06, -a + Math.PI / 2, 1)).multiply(MS(0, 0, 0, 1, 1.3, 0.3)), false);
  }
  // Roof: eave ring, cone, ropes pressing down the top, skylight and chimney
  const ye = 0.26 + W;
  b.add(new THREE.CylinderGeometry(R * 1.13, R * 1.13, 0.16, 20), C.gold, at(T, M(0, ye + 0.04, 0)));
  b.add(new THREE.ConeGeometry(R * 1.13, roofH, 20), roof, at(T, M(0, ye + 0.1 + roofH / 2, 0)));
  const top = V(0, ye + 0.1 + roofH - 0.05, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const e = V(Math.cos(a) * R * 1.1, ye + 0.16, Math.sin(a) * R * 1.1);
    const s = top.clone().lerp(e, 0.16);
    b.add(new THREE.CylinderGeometry(1, 1, 1, 4), C.rope, at(T, segM(s.clone().add(V(0, 0.04, 0)), e.clone().add(V(0, 0.06, 0)), 0.045)), false);
  }
  b.add(new THREE.CylinderGeometry(R * 0.2, R * 0.25, 0.32, 12), C.gold, at(T, M(0, top.y - roofH * 0.12, 0)));
  b.add(new THREE.CylinderGeometry(R * 0.12, R * 0.2, 0.22, 12), C.roof2, at(T, M(0, top.y + 0.02, 0)));
  const pipe = V(R * 0.34, ye + roofH * 0.62 + 0.7, -R * 0.2);
  b.add(new THREE.CylinderGeometry(0.08, 0.09, 1.3, 6), C.metal, at(T, M(pipe.x, pipe.y - 0.65, pipe.z)));
  b.add(new THREE.CylinderGeometry(0.14, 0.1, 0.12, 6), C.metal, at(T, M(pipe.x, pipe.y, pipe.z)));
  // Door: orange-red frame, dark red leaf, gold lintel
  b.add(new THREE.BoxGeometry(1.2, 1.6, 0.18), C.door, at(T, M(0, 0.26 + 0.8, R * 0.99)));
  b.add(new THREE.BoxGeometry(0.86, 1.34, 0.12), C.redDark, at(T, M(0, 0.26 + 0.7, R * 1.04)));
  b.add(new THREE.OctahedronGeometry(0.14), C.gold, at(T, M(0, 0.26 + 0.9, R * 1.1)).multiply(MS(0, 0, 0, 1, 1.4, 0.4)), false);
  b.add(new THREE.BoxGeometry(1.5, 0.2, 0.34), C.gold, at(T, M(0, 0.26 + 1.66, R * 1.0)));
  b.add(new THREE.BoxGeometry(1.7, 0.04, 1.2), C.red, at(T, M(0, 0.03, R + 1.0, 0.05)), false);
  b.add(new THREE.BoxGeometry(1.2, 0.05, 0.8), C.roof2, at(T, M(0, 0.05, R + 1.0, 0.05)), false);
  if (o.lamp) {
    b.add(new THREE.BoxGeometry(0.06, 0.5, 0.06), C.metal, at(T, M(0.95, 1.95, R * 1.04 + 0.12)));
    b.glow(new THREE.BoxGeometry(0.22, 0.28, 0.22), 0xffb35c, at(T, M(0.95, 1.6, R * 1.04 + 0.12)));
    b.add(new THREE.ConeGeometry(0.2, 0.14, 4), C.metal, at(T, M(0.95, 1.8, R * 1.04 + 0.12, Math.PI / 4)));
  }
  if (o.great) {
    // Awning in front of the door: two posts holding up a slanting sheet of indigo cloth
    for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.07, 0.09, 2.5, 6), C.wood, at(T, M(s * 1.5, 1.25, R + 2.2)));
    const aw = new THREE.BoxGeometry(3.4, 0.06, 2.6);
    b.add(aw, C.roof2, at(T, M(0, 2.3, R + 1.1, 0, 1, -0.2)));
    b.add(new THREE.BoxGeometry(3.4, 0.28, 0.05), C.gold, at(T, M(0, 2.1, R + 2.38)), false);
    // Thunder emblem on the lintel
    const sh = new THREE.Shape();
    const k = 0.55;
    sh.moveTo(0.05 * k, k);
    sh.lineTo(-0.55 * k, 0.05 * k);
    sh.lineTo(-0.05 * k, 0.05 * k);
    sh.lineTo(-0.4 * k, -k);
    sh.lineTo(0.55 * k, 0.22 * k);
    sh.lineTo(0.05 * k, 0.22 * k);
    sh.lineTo(0.35 * k, k);
    sh.closePath();
    const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false });
    b.glow(eg, C.spark, at(T, M(0, ye - 0.35, R * 1.05)));
  }
  ctx.solids.add(x, z, R + 0.35);
  return V(x + Math.cos(face) * pipe.x + Math.sin(face) * pipe.z, y0 + pipe.y + 0.1, z - Math.sin(face) * pipe.x + Math.cos(face) * pipe.z);
}

// ───────────────────────── Carts ─────────────────────────

/**
 * Nomad two-wheeled wooden cart: the shafts rest on the ground pointing toward face; with load it carries rolled felt and crates;
 * broken is missing a wheel and tilts on the ground
 */
export function cart(ctx: FieldCtx, x: number, z: number, face: number, load: boolean, broken = false): void {
  const { b, r } = ctx;
  ctx.place(x, z, 1.4);
  const tilt = broken ? 0.28 : 0;
  const T = M(x, broken ? -0.35 : 0, z, face, 1, 0, tilt);
  const wy = 0.75;
  b.add(new THREE.BoxGeometry(1.6, 0.16, 2.9), C.wood, at(T, M(0, 1.0, 0)));
  for (const s of [-1, 1]) {
    b.add(new THREE.BoxGeometry(0.08, 0.4, 2.9), C.woodDark, at(T, M(s * 0.78, 1.26, 0)));
    for (let k = -1; k <= 1; k++) b.add(new THREE.BoxGeometry(0.08, 0.5, 0.08), C.woodDark, at(T, M(s * 0.78, 1.2, k * 1.3)));
  }
  b.add(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), C.woodDark, at(T, M(0, wy, -0.3, 0, 1, 0, Math.PI / 2)));
  for (const s of broken ? [1] : [-1, 1]) {
    const wx = s * 1.02;
    b.add(new THREE.TorusGeometry(0.72, 0.075, 6, 18), C.woodDark, at(T, M(wx, wy, -0.3, Math.PI / 2)));
    b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8), C.wood, at(T, M(wx, wy, -0.3, 0, 1, 0, Math.PI / 2)));
    for (let k = 0; k < 6; k++) b.add(new THREE.BoxGeometry(0.05, 1.4, 0.06), C.wood, at(T, M(wx, wy, -0.3, 0, 1, (k / 6) * Math.PI)), false);
  }
  if (broken) {
    // The fallen wheel lies in the grass beside it
    b.add(new THREE.TorusGeometry(0.72, 0.075, 6, 18), C.woodDark, at(T, M(-2.2, 0.08, 0.6, 0, 1, Math.PI / 2, 0.4)));
    for (let k = 0; k < 3; k++) b.add(new THREE.BoxGeometry(0.05, 1.4, 0.06), C.wood, at(T, M(-2.2, 0.1, 0.6, 0, 1, Math.PI / 2, 0.4 + (k / 3) * Math.PI)), false);
  }
  // Shafts: slanting from the front of the cart down to the ground
  const ang = Math.atan2(0.95, 2.9);
  for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.09, 0.09, 3.1), C.wood, at(T, M(s * 0.42, 0.55, 2.75, 0, 1, ang)));
  if (load) {
    for (let k = 0; k < 3; k++) b.add(new THREE.CylinderGeometry(0.3, 0.3, 1.4, 10), k % 2 ? C.feltDark : C.felt, at(T, M(0, 1.38 + (k === 2 ? 0.5 : 0), -0.9 + k * 0.62 - (k === 2 ? 0.9 : 0), 0, 1, 0, Math.PI / 2)));
    b.add(new THREE.BoxGeometry(0.65, 0.55, 0.65), C.woodDark, at(T, M(0.3, 1.36, 0.9, r())));
    b.add(new THREE.BoxGeometry(0.5, 0.4, 0.5), C.red, at(T, M(-0.35, 1.3, 1.0, r())));
    // Bundled tent lattice frame
    for (let k = 0; k < 5; k++) b.add(new THREE.BoxGeometry(0.05, 0.05, 2.2), C.wood, at(T, M(-0.4 + k * 0.2, 1.95, -0.2, 0, 1, 0.1, (k % 2 ? 1 : -1) * 0.25)), false);
  }
  ctx.solids.add(x, z, 1.7);
}

// ───────────────────────── Totem poles, ovoo ─────────────────────────

/** Totem pole: painted segments, a half-length `stormhorse` head, topped by a spread-winged `thunderbird` (its eyes glow) */
export function totem(ctx: FieldCtx, x: number, z: number, face: number, H: number): THREE.Vector3 {
  const { b } = ctx;
  const y0 = ctx.place(x, z, 0.4);
  const T = M(x, 0, z, face);
  b.add(new THREE.CylinderGeometry(0.62, 0.72, 0.4, 8), C.stoneDark, at(T, M(0, 0.1, 0)));
  b.add(new THREE.CylinderGeometry(0.24, 0.3, H, 8), C.wood, at(T, M(0, H / 2, 0)));
  const bands = [C.red, C.roof, C.gold, C.red, C.roof];
  bands.forEach((c, i) => b.add(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 8), c, at(T, M(0, H * (0.18 + i * 0.13), 0))));
  // Head of the `stormhorse`
  const hy = H * 0.62;
  b.add(new THREE.BoxGeometry(0.42, 0.5, 0.9), C.roof, at(T, M(0, hy, 0.45, 0, 1, 0.35)));
  b.add(new THREE.BoxGeometry(0.34, 0.3, 0.5), C.roof, at(T, M(0, hy - 0.22, 0.95, 0, 1, 0.5)));
  for (const s of [-1, 1]) b.add(new THREE.ConeGeometry(0.08, 0.3, 4), C.roof2, at(T, M(s * 0.14, hy + 0.35, 0.3)));
  for (let k = 0; k < 4; k++) b.add(new THREE.BoxGeometry(0.06, 0.34, 0.14), C.gold, at(T, M(0, hy + 0.25 - k * 0.08, 0.15 - k * 0.14, 0, 1, -0.3)));
  for (const s of [-1, 1]) b.glow(new THREE.OctahedronGeometry(0.05), C.spark, at(T, M(s * 0.2, hy + 0.05, 0.72)));
  // `thunderbird` on top: spread wings, pointed beak, glowing eyes
  const ty = H + 0.3;
  b.add(new THREE.OctahedronGeometry(0.42), C.gold, at(T, M(0, ty, 0)).multiply(MS(0, 0, 0, 0.9, 1.3, 1)));
  for (const s of [-1, 1]) {
    b.add(new THREE.BoxGeometry(1.5, 0.1, 0.55), C.roof, at(T, M(s * 0.95, ty + 0.35, -0.05, 0, 1, 0, s * 0.4)));
    b.add(new THREE.BoxGeometry(0.6, 0.1, 0.45), C.gold, at(T, M(s * 1.75, ty + 0.72, -0.08, 0, 1, 0, s * 0.62)));
    b.glow(new THREE.OctahedronGeometry(0.06), C.spark, at(T, M(s * 0.14, ty + 0.25, 0.32)));
  }
  b.add(new THREE.ConeGeometry(0.1, 0.4, 5), C.red, at(T, M(0, ty + 0.1, 0.5, 0, 1, Math.PI / 2)));
  ctx.solids.add(x, z, 0.55);
  return V(x, y0 + ty + 0.4, z);
}

/**
 * Ovoo: a round mound of piled stones with a long pole hung with ribbons stuck in the middle,
 * and several prayer flags strung around it
 */
export function ovoo(ctx: FieldCtx, cloth: ClothSet, x: number, z: number, R: number, flags = true): void {
  const { b, r } = ctx;
  const y0 = ctx.place(x, z, R);
  const stone = [C.granite, C.granite2, C.granite3, C.stone];
  for (let k = 0; k < 4; k++) {
    const rr = R * (1 - k * 0.26);
    const n = Math.max(3, Math.round(rr * 5));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k * 0.4 + r() * 0.3;
      b.add(new THREE.DodecahedronGeometry(0.26 + r() * 0.2, 0), stone[(i + k) % stone.length], M(x + Math.cos(a) * rr * 0.85, 0.15 + k * 0.34, z + Math.sin(a) * rr * 0.85, r() * 6, 1, r(), r()));
    }
  }
  b.add(new THREE.DodecahedronGeometry(0.45, 0), C.granite, M(x, 1.45, z, r() * 6));
  const H = 3.8;
  b.add(new THREE.CylinderGeometry(0.06, 0.09, H, 6), C.wood, M(x, 0.6 + H / 2, z));
  // Three-pronged copper top
  b.add(new THREE.BoxGeometry(0.5, 0.06, 0.06), C.bronze, M(x, 0.6 + H, z));
  for (const s of [-1, 0, 1]) b.add(new THREE.ConeGeometry(0.05, 0.36, 5), C.bronze, M(x + s * 0.24, 0.6 + H + 0.2, z));
  const top = V(x, y0 + 0.6 + H - 0.2, z);
  const khadag = [0x3a6ad0, 0x4a7ae0, 0xf2efe6, 0x3a6ad0, 0xe8c44a];
  for (let i = 0; i < 5; i++) cloth.strip(top.clone().add(V((r() - 0.5) * 0.1, -i * 0.12, (r() - 0.5) * 0.1)), 1.4 + r() * 0.8, 0.16, khadag[i]);
  if (flags) {
    // Five-color prayer flags: from the pole top down to stakes in the ground
    const five = [0x3a6ad0, 0xf2efe6, 0xc8433a, 0x4a9a52, 0xe8c44a];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + r() * 0.8;
      const sx = x + Math.cos(a) * (R + 3.2);
      const sz = z + Math.sin(a) * (R + 3.2);
      const sy = ctx.place(sx, sz);
      b.add(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 5), C.wood, M(sx, 0.35, sz));
      const end = V(sx, sy + 0.7, sz);
      b.lift = 0;
      rope(b, top, end, 0.35, 0.02, C.rope, false, 8);
      const n = 7;
      for (let i = 1; i < n; i++) {
        const u0 = i / n;
        const u1 = u0 + 0.6 / n;
        const p0 = top.clone().lerp(end, u0).setY(top.y + (end.y - top.y) * u0 - 0.35 * 4 * u0 * (1 - u0));
        const p1 = top.clone().lerp(end, u1).setY(top.y + (end.y - top.y) * u1 - 0.35 * 4 * u1 * (1 - u1));
        cloth.hang(p0, p1, 0.32, five[(i + k) % 5], i * 0.7 + k, 0.25);
      }
    }
  }
  ctx.solids.add(x, z, R + 0.2);
}

// ───────────────────────── Lightning-rod pillars ─────────────────────────

/**
 * Lightning-rod pillar raised by the dwarves: hexagonal shaft, carved thunder patterns that charge up,
 * copper bands and a copper tip;
 * broken is snapped off by lightning. Returns the pillar top (strike point)
 */
export function rodPillar(ctx: FieldCtx, x: number, z: number, h: number, broken: boolean, glow: THREE.BufferGeometry[] | null, big = 1): THREE.Vector3 {
  const { b, r } = ctx;
  const y0 = ctx.place(x, z, 0.8 * big);
  const ry = r() * Math.PI;
  const T = M(x, 0, z, ry, 1, (r() - 0.5) * 0.08, (r() - 0.5) * 0.08).multiply(MS(0, 0, 0, big, 1, big));
  const lift = new THREE.Matrix4().makeTranslation(0, y0, 0);
  b.add(new THREE.BoxGeometry(1.7, 0.5, 1.7), C.stoneDark, at(T, M(0, 0.05, 0)));
  b.add(new THREE.BoxGeometry(1.2, 0.32, 1.2), C.stone, at(T, M(0, 0.45, 0)));
  b.add(new THREE.CylinderGeometry(0.3, 0.46, h, 6), C.stone, at(T, M(0, 0.6 + h / 2, 0)));
  // Carved band and copper bands
  b.add(new THREE.CylinderGeometry(0.44, 0.44, 0.14, 6), C.stoneDark, at(T, M(0, 0.6 + h * 0.2, 0)));
  if (!broken || h > 5) b.add(new THREE.CylinderGeometry(0.39, 0.39, 0.2, 6), C.bronze, at(T, M(0, 0.6 + h * (broken ? 0.55 : 0.78), 0)));
  // Charging thunder pattern: a zigzag on one face of the shaft
  const face = (L: THREE.Matrix4) => at(T, L);
  for (let i = 0; i < 4; i++) {
    const y = 0.6 + h * (0.3 + i * 0.1);
    if (broken && y > 0.6 + h * 0.8) break;
    const g = new THREE.BoxGeometry(0.05, h * 0.09, 0.04).applyMatrix4(face(M(i % 2 ? 0.06 : -0.06, y, 0.37 - (y - 0.6) / h * 0.14, 0, 1, 0, i % 2 ? 0.6 : -0.6)));
    if (glow) glow.push(g.applyMatrix4(lift));
    else b.glow(g, C.spark, new THREE.Matrix4());
  }
  let tip: THREE.Vector3;
  if (broken) {
    b.add(new THREE.ConeGeometry(0.34, 0.8, 5), C.stoneDark, at(T, M(0.05, 0.6 + h + 0.25, 0, r() * 6, 1, 0.3, 0.2)));
    b.add(new THREE.BoxGeometry(0.16, h * 0.4, 0.05), C.scorch, at(T, M(-0.1, 0.6 + h * 0.62, 0.38, 0, 1, 0, 0.18)), false);
    // The snapped-off pillar top lies beside it
    const a = r() * Math.PI * 2;
    const L = 1.2 + r() * 1.2;
    b.add(new THREE.CylinderGeometry(0.28, 0.32, L, 6), C.stone, M(x + Math.cos(a) * 1.8 * big, 0.25, z + Math.sin(a) * 1.8 * big, a, 1, 0, Math.PI / 2 - 0.08));
    tip = V(x, y0 + 0.6 + h + 0.4, z);
  } else {
    const yt = 0.6 + h;
    b.add(new THREE.CylinderGeometry(0.36, 0.32, 0.26, 6), C.bronze, at(T, M(0, yt + 0.1, 0)));
    b.add(new THREE.ConeGeometry(0.2, 1.1, 6), C.copper, at(T, M(0, yt + 0.75, 0)));
    b.add(new THREE.TorusGeometry(0.42, 0.05, 5, 16), C.bronze, at(T, M(0, yt + 0.5, 0, 0, 1, Math.PI / 2)));
    const g = new THREE.OctahedronGeometry(0.16).applyMatrix4(at(T, M(0, yt + 1.4, 0, 0.4)));
    if (glow) glow.push(g.applyMatrix4(lift));
    else b.glow(g, C.spark, new THREE.Matrix4());
    tip = V(x, y0 + yt + 1.4, z);
  }
  ctx.solids.add(x, z, 0.8 * big);
  return tip;
}

/**
 * Giant pillar of the Thunderpeal Dais: a pillar twice as thick, cage-like copper hoops,
 * a four-clawed copper crown and a glowing thunder core.
 * Returns the position of the thunder core
 */
export function giantPillar(ctx: FieldCtx, x: number, z: number, h: number, glow: THREE.BufferGeometry[]): THREE.Vector3 {
  const { b, r } = ctx;
  const y0 = ctx.place(x, z, 1.6);
  const T = M(x, 0, z, r() * Math.PI);
  const G = new THREE.Matrix4().makeTranslation(0, y0, 0).multiply(T);
  b.add(new THREE.CylinderGeometry(2.0, 2.4, 0.8, 6), C.stoneDark, at(T, M(0, 0.2, 0)));
  b.add(new THREE.CylinderGeometry(1.5, 1.8, 0.6, 6), C.stone, at(T, M(0, 0.85, 0)));
  b.add(new THREE.CylinderGeometry(0.72, 1.1, h, 6), C.stone, at(T, M(0, 1.1 + h / 2, 0)));
  for (const f of [0.28, 0.55, 0.8]) b.add(new THREE.CylinderGeometry(0.98 - f * 0.3, 0.98 - f * 0.3, 0.32, 6), C.bronze, at(T, M(0, 1.1 + h * f, 0)));
  for (let i = 0; i < 6; i++) {
    const y = 1.1 + h * (0.34 + i * 0.07);
    glow.push(new THREE.BoxGeometry(0.1, h * 0.06, 0.08).applyMatrix4(at(G, M(i % 2 ? 0.12 : -0.12, y, 0.9 - (y - 1.1) / h * 0.35, 0, 1, 0, i % 2 ? 0.6 : -0.6))));
  }
  const yt = 1.1 + h;
  b.add(new THREE.CylinderGeometry(0.85, 0.72, 0.4, 6), C.bronze, at(T, M(0, yt + 0.15, 0)));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const base = V(Math.cos(a) * 0.55, yt + 0.3, Math.sin(a) * 0.55);
    b.add(new THREE.ConeGeometry(0.14, 2.0, 5), C.copper, at(T, leanM(base, a, 0.35, 2.0)));
  }
  b.add(new THREE.ConeGeometry(0.28, 2.4, 6), C.copper, at(T, M(0, yt + 1.5, 0)));
  glow.push(new THREE.IcosahedronGeometry(0.42, 0).applyMatrix4(at(G, M(0, yt + 1.3, 0))));
  ctx.solids.add(x, z, 1.9);
  return V(x, y0 + yt + 1.3, z);
}

// ───────────────────────── Fulgurites (vitrified lightning marks) and glass ground ─────────────────────────

/** A glass tube sprouting from the ground that forks, with residual electric light at its tip */
export function fulgurite(ctx: FieldCtx, x: number, z: number, s: number, glow: THREE.BufferGeometry[]): THREE.Vector3 {
  const { b, r } = ctx;
  const y0 = ctx.place(x, z, 0.3 * s);
  let top = V(0, 0, 0);
  const grow = (p: THREE.Vector3, a: number, tilt: number, len: number, rad: number, depth: number): THREE.Vector3 => {
    let cur = p.clone();
    const n = 3;
    for (let i = 0; i < n; i++) {
      tilt = Math.min(1.1, Math.max(0, tilt + (r() - 0.5) * 0.5));
      a += (r() - 0.5) * 0.8;
      const next = cur.clone().addScaledVector(leanDir(a, tilt), len / n);
      const rr = rad * (1 - (i / n) * 0.5);
      b.add(new THREE.CylinderGeometry(0.8, 1, 1, 6), i % 2 ? C.glass : C.glassMid, M(x, 0, z).multiply(segM(cur, next, rr)));
      if (depth < 2 && r() < 0.45) grow(next, a + (r() - 0.5) * 2.4, tilt + 0.5, len * 0.5, rr * 0.6, depth + 1);
      cur = next;
    }
    glow.push(new THREE.OctahedronGeometry(rad * 0.9).applyMatrix4(M(x + cur.x, y0 + cur.y, z + cur.z, r() * 6)));
    return cur;
  };
  const arms = s > 2 ? 3 : 1 + Math.floor(r() * 2);
  for (let k = 0; k < arms; k++) {
    const t = grow(V(0, -0.2, 0), r() * Math.PI * 2, 0.15 + r() * 0.3, 1.2 * s * (0.7 + r() * 0.5), 0.14 * s, 0);
    if (t.y > top.y) top = t;
  }
  b.add(new THREE.CylinderGeometry(0.3 * s, 0.45 * s, 0.25, 7), C.glassDark, M(x, 0.02, z));
  ctx.solids.add(x, z, Math.max(0.35, 0.3 * s));
  return V(x + top.x, y0 + top.y, z + top.z);
}

/**
 * A huge feather dropped by the `thunderbird`: stuck slanting into the ground, golden vane, deep blue tip,
 * with a glowing thunder line on the vane
 */
export function feather(ctx: FieldCtx, x: number, z: number, ry: number, tilt: number, glow: THREE.BufferGeometry[]): void {
  const { b } = ctx;
  const y0 = ctx.place(x, z, 0.3);
  const T = M(x, -0.4, z, ry, 1.35, tilt, 0);
  const plate = (pts: number[][], depth: number): THREE.BufferGeometry => {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (const [px, py] of pts.slice(1)) sh.lineTo(px, py);
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    return g;
  };
  // Vane: wide on the left, narrow on the right, with a few split notches along the edge
  const vane = [
    [0, 0.5], [-0.38, 1.0], [-0.82, 2.0], [-0.98, 2.9], [-0.55, 3.05], [-0.9, 3.35], [-0.78, 3.9], [-0.42, 4.4], [0, 4.9],
    [0.34, 4.35], [0.52, 3.6], [0.24, 3.3], [0.58, 2.9], [0.6, 2.0], [0.46, 1.3], [0.2, 0.7],
  ];
  b.add(plate(vane, 0.06), C.gold, T);
  // Tip: deep blue, serrated along the lower edge
  const tip = [[-0.84, 3.62], [-0.78, 3.9], [-0.42, 4.4], [0, 4.9], [0.34, 4.35], [0.47, 3.8], [0.28, 3.62], [0.1, 3.84], [-0.16, 3.6], [-0.44, 3.82]];
  b.add(plate(tip, 0.09), 0x2c3a78, T);
  // Down at the quill's base
  b.add(new THREE.SphereGeometry(0.34, 6, 5), 0xf2e6c0, T.clone().multiply(MS(-0.05, 0.62, 0, 1, 0.9, 0.35)));
  // Shaft
  b.add(new THREE.CylinderGeometry(0.035, 0.08, 5.3, 5), 0xf2efe6, T.clone().multiply(M(0, 2.5, 0)));
  // Thunder line on the vane (glowing)
  const Tg = new THREE.Matrix4().makeTranslation(0, y0, 0).multiply(T);
  const zig = [[-0.28, 1.1], [-0.55, 1.9], [-0.3, 2.3], [-0.62, 3.0], [-0.4, 3.5]];
  for (let i = 1; i < zig.length; i++) {
    const [ax, ay] = zig[i - 1];
    const [bx, by] = zig[i];
    const len = Math.hypot(bx - ax, by - ay);
    const g = new THREE.BoxGeometry(0.07, len + 0.05, 0.12);
    g.applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.atan2(bx - ax, by - ay)));
    g.translate((ax + bx) / 2, (ay + by) / 2, 0);
    glow.push(g.applyMatrix4(Tg));
  }
  ctx.solids.add(x, z, 0.5);
}

/** Vitrified ground: patches of dark glass lying flat on the ground, with brighter reflections in the middle */
export function glassPlate(ctx: FieldCtx, x: number, z: number, rad: number): void {
  const { b, r } = ctx;
  const y0 = ctx.h(x, z);
  const n = 7 + Math.floor(r() * 4);
  const a = r() * 6;
  const sq = 0.6 + r() * 0.4;
  // Irregular outline: each corner gets its own radius, like shattered glass pieces
  const jag = Array.from({ length: n }, () => 0.45 + r() * 0.7);
  // A thin sheet of glass hugging the terrain (it won't sink into the soil or hang in the air even on a slope)
  const drape = (R: number, ox: number, oz: number, lift: number, rot: number): THREE.BufferGeometry => {
    const g = new THREE.CircleGeometry(R, n);
    const q = g.attributes.position;
    for (let i = 1; i < q.count; i++) {
      const k = jag[(i - 1) % n];
      q.setXY(i, q.getX(i) * k, q.getY(i) * k);
    }
    g.applyMatrix4(MS(0, 0, 0, 1, sq, 1));
    g.rotateZ(rot);
    g.rotateX(-Math.PI / 2);
    g.translate(ox, 0, oz);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, ctx.h(x + p.getX(i), z + p.getZ(i)) - y0 + lift);
    g.computeVertexNormals();
    return g;
  };
  const prev = b.lift;
  b.lift = y0;
  b.add(drape(rad, 0, 0, 0.08, a), C.glassDark, M(x, 0, z), false);
  const ox = (r() - 0.5) * rad * 0.4;
  const oz = (r() - 0.5) * rad * 0.4;
  b.add(drape(rad * 0.5, ox, oz, 0.1, a + 0.5), C.glassMid, M(x, 0, z), false);
  // A bright streak of reflection
  b.add(drape(rad * 0.16, ox + rad * 0.12, oz - rad * 0.1, 0.12, a), C.glassHi, M(x, 0, z), false);
  b.lift = prev;
}

// ───────────────────────── Skeleton of the ancient thunderbeast ─────────────────────────

/**
 * The skeleton of a gigantic ancient beast half-buried in the grass sea: the skull points toward head,
 * the spine extends along dir;
 * ribs arch up from the grass in pairs, and you can walk between the ribs into the chest cavity.
 */
export function skeleton(ctx: FieldCtx, hx: number, hz: number, dirA: number, glow: THREE.BufferGeometry[], L = 44): void {
  const { b, r } = ctx;
  const dx = Math.cos(dirA);
  const dz = Math.sin(dirA);
  const sx = -dz;
  const sz = dx;
  const ys = [1.4, 4.6, 6.6, 7.0, 6.4, 4.0, 1.4, -0.3, -1.6];
  const spineY = (s: number) => {
    const f = s * (ys.length - 1);
    const i = Math.min(ys.length - 2, Math.floor(f));
    const t = f - i;
    const tt = t * t * (3 - 2 * t);
    return ys[i] + (ys[i + 1] - ys[i]) * tt;
  };
  // The chest section is straight (the main road passes through the middle);
  // the neck curves to one side and the tail whips to the other
  const bend = (s: number) => (s < 0.19 ? 9 * Math.pow((0.19 - s) / 0.19, 1.6) : s > 0.58 ? -12 * Math.pow((s - 0.58) / 0.42, 1.5) : 0);
  const pt = (s: number) => {
    const x = hx + dx * s * L + sx * bend(s);
    const z = hz + dz * s * L + sz * bend(s);
    return V(x, ctx.h(x, z) + spineY(s), z);
  };
  b.lift = 0;
  // Spine: vertebra by vertebra, with spinous processes standing up on the back
  const nV = 34;
  let prev = pt(0.04);
  for (let i = 1; i <= nV; i++) {
    const s = 0.04 + (i / nV) * 0.96;
    const p = pt(s);
    const k = s < 0.2 ? 0.8 : s < 0.6 ? 1 : 1 - (s - 0.6) * 2.2;
    const rad = 0.5 * Math.max(0.28, k);
    b.add(new THREE.CylinderGeometry(1, 1, 1, 7), i % 2 ? C.bone : C.boneShade, segM(prev, p.clone().lerp(prev, 0.25), rad));
    // Spinous processes slant backward; those on the tail get smaller and smaller
    const sp = s < 0.62 ? 0.6 + k * 1.1 : 0.35;
    const spine = new THREE.Matrix4().compose(V(p.x, p.y + rad + sp * 0.4, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, -dirA + Math.PI / 2, 0, 'YXZ')), V(1, sp, 1));
    b.add(new THREE.BoxGeometry(0.2, 1, 0.45), C.bone, spine);
    if (i % 2 === 0 && s < 0.62) b.add(new THREE.BoxGeometry(1.6 * k + 0.4, 0.16, 0.26), C.boneShade, M(p.x, p.y, p.z, -dirA - Math.PI / 2));
    if (p.y - ctx.h(p.x, p.z) < 1.5) ctx.solids.add(p.x, p.z, rad + 0.35);
    prev = p;
  }
  // Ribs: curving from the spine out to both sides and down into the soil
  const nR = 10;
  for (let i = 0; i < nR; i++) {
    const s = 0.19 + (i / (nR - 1)) * 0.36;
    const p = pt(s);
    const prof = Math.sin(((i + 0.8) / (nR + 0.6)) * Math.PI);
    const W = 3.2 + prof * 3.6;
    for (const side of [-1, 1]) {
      const brokenAt = r() < 0.16 ? 0.5 + r() * 0.3 : 1;
      let q = p.clone();
      const n = 8;
      for (let k = 1; k <= n; k++) {
        const u = k / n;
        if (u > brokenAt) break;
        const lat = W * Math.sin(u * Math.PI * 0.52) * 1.08;
        const back = -u * 1.4;
        const x = p.x + sx * side * lat + dx * back;
        const z = p.z + sz * side * lat + dz * back;
        const gy = ctx.h(x, z);
        const y = gy + (p.y - gy) * (1 - Math.pow(u, 1.5)) - u * 0.5;
        const nq = V(x, y, z);
        b.add(new THREE.CylinderGeometry(1, 1, 1, 6), C.bone, segM(q, nq, 0.3 - u * 0.12));
        q = nq;
      }
      if (brokenAt < 1) b.add(new THREE.ConeGeometry(0.2, 0.6, 5), C.boneShade, M(q.x, q.y + 0.2, q.z, r() * 6, 1, 0.4, 0.3));
      else ctx.solids.add(q.x, q.z, 0.45);
    }
  }
  // Skull: long snout, open jaw, deep-set eye sockets, two zigzag horns
  const H = pt(0);
  const T = M(H.x, H.y - 1.5, H.z, -dirA - Math.PI / 2, 1, 0, 0.12);
  b.add(new THREE.SphereGeometry(1, 14, 10), C.bone, at(T, MS(0, 2.2, -0.8, 2.3, 1.9, 3.0)));
  b.add(new THREE.CylinderGeometry(0.8, 1.35, 3.8, 8), C.bone, at(T, M(0, 1.9, 2.4, 0, 1, Math.PI / 2 - 0.1)));
  b.add(new THREE.BoxGeometry(2.2, 0.45, 4.6), C.boneShade, at(T, M(0, 0.3, 2.1, 0, 1, 0.05)));
  for (const s of [-1, 1]) {
    b.add(new THREE.SphereGeometry(0.62, 10, 8), C.hole, at(T, MS(s * 1.9, 2.7, 0.45, 0.62, 0.9, 1.05)), false);
    for (let k = 0; k < 5; k++) {
      b.add(new THREE.ConeGeometry(0.12, 0.42, 5), C.bone, at(T, M(s * 0.68, 0.78, 1.3 + k * 0.62, 0, 1, Math.PI)));
      b.add(new THREE.ConeGeometry(0.1, 0.34, 5), C.bone, at(T, M(s * 0.62, 0.66, 1.6 + k * 0.62)));
    }
    // Zigzag horns: three segments, changing direction at each one
    let hp = V(s * 1.3, 3.7, -1.9);
    let ha = s > 0 ? 0.3 : Math.PI - 0.3;
    const segs = [2.4, 2.0, 1.6];
    segs.forEach((len, k) => {
      const tilt = k % 2 ? 0.55 : 1.05;
      const np = hp.clone().addScaledVector(leanDir(ha, tilt), len);
      np.z -= len * 0.45;
      b.add(new THREE.CylinderGeometry(1, 1, 1, 6), k === 2 ? C.boneShade : C.bone, at(T, segM(hp, np, 0.36 - k * 0.09)));
      hp = np;
      ha += s * (k % 2 ? 0.5 : -0.5);
    });
    b.add(new THREE.ConeGeometry(0.16, 0.8, 6), C.char, at(T, M(hp.x, hp.y + 0.3, hp.z)));
  }
  ctx.solids.add(H.x, H.z, 3.2);
  ctx.solids.add(H.x - dx * 2.6, H.z - dz * 2.6, 2);
  // Crystals of lightning still cling to the bones
  for (const s of [0.1, 0.33, 0.47]) {
    const p = pt(s);
    for (const side of [-1, 1]) {
      const off = 4.6 + r() * 1.6;
      const x = p.x + sx * side * off;
      const z = p.z + sz * side * off;
      const gy = ctx.h(x, z);
      for (let k = 0; k < 3; k++) {
        const g = new THREE.OctahedronGeometry(0.2 + r() * 0.15);
        g.scale(0.55, 2, 0.55);
        glow.push(g.applyMatrix4(M(x + (r() - 0.5) * 0.6, gy + 0.3, z + (r() - 0.5) * 0.6, r() * 6, 1, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7)));
      }
    }
  }
  // Scattered leg bones
  for (let k = 0; k < 4; k++) {
    const s = 0.2 + k * 0.14;
    const p = pt(s);
    const side = k % 2 ? 1 : -1;
    const x = p.x + sx * side * (8 + r() * 3);
    const z = p.z + sz * side * (8 + r() * 3);
    const gy = ctx.h(x, z);
    const a = r() * Math.PI;
    const len = 3 + r() * 1.5;
    const e0 = V(x - Math.cos(a) * len * 0.5, gy + 0.3, z - Math.sin(a) * len * 0.5);
    const e1 = V(x + Math.cos(a) * len * 0.5, gy + 0.3 + (k === 1 ? 1.4 : 0.1), z + Math.sin(a) * len * 0.5);
    b.add(new THREE.CylinderGeometry(1, 1, 1, 7), C.bone, segM(e0, e1, 0.22));
    for (const e of [e0, e1]) b.add(new THREE.SphereGeometry(0.36, 8, 6), C.boneShade, M(e.x, e.y, e.z));
    ctx.solids.add(x, z, 0.8);
  }
}

// ───────────────────────── Lone tree ─────────────────────────

/**
 * A lone tree split in two by lightning: one half is still alive, its crown growing with the wind;
 * the other half is charred black and dead, with electric light lingering in the split
 */
export function splitTree(ctx: FieldCtx, cloth: ClothSet, x: number, z: number, glow: THREE.BufferGeometry[]): THREE.Vector3 {
  const { b, r } = ctx;
  const y0 = ctx.place(x, z, 1.2);
  // Roots
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r() * 0.5;
    b.add(new THREE.CylinderGeometry(0.18, 0.5, 2.6, 6), C.bark, leanM(V(x + Math.cos(a) * 0.6, -0.3, z + Math.sin(a) * 0.6), a, 1.25, 2.6));
  }
  b.add(new THREE.CylinderGeometry(1.0, 1.4, 4.4, 10), C.bark, M(x, 2.1, z));
  // The living half: leaning toward downwind
  const aL = WIND_A + 0.3;
  const baseL = V(x + Math.cos(aL) * 0.4, 3.9, z + Math.sin(aL) * 0.4);
  const lenL = 7.8;
  b.add(new THREE.CylinderGeometry(0.42, 0.8, lenL, 9), C.bark, leanM(baseL, aL, 0.42, lenL));
  const tipL = baseL.clone().addScaledVector(leanDir(aL, 0.42), lenL);
  const leaves: THREE.Vector3[] = [tipL.clone().add(V(0, 0.8, 0))];
  const ribbonAt: THREE.Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const f = 0.3 + i * 0.15;
    const p = baseL.clone().addScaledVector(leanDir(aL, 0.42), lenL * f);
    const a = aL + (i % 2 ? 1 : -1) * (0.8 + r() * 0.7);
    const len = 2.6 + r() * 2.2;
    b.add(new THREE.CylinderGeometry(0.1, 0.24, len, 6), C.bark, leanM(p, a, 1.0 + r() * 0.3, len));
    const e = p.clone().addScaledVector(leanDir(a, 1.1), len);
    leaves.push(e.clone().add(V(0, 0.5, 0)));
    ribbonAt.push(p.clone().addScaledVector(leanDir(a, 1.1), len * 0.45));
  }
  for (const p of leaves) {
    for (let k = 0; k < 3; k++) {
      const s = 1.5 + r() * 1.1;
      const g = new THREE.IcosahedronGeometry(1, 1);
      b.add(g, C.leaf[k % 3], M(p.x + Math.cos(WIND_A) * k * 0.9 + (r() - 0.5), p.y + (r() - 0.3) * 0.8, p.z + Math.sin(WIND_A) * k * 0.9 + (r() - 0.5), -WIND_A, 1).multiply(MS(0, 0, 0, s * 1.35, s * 0.62, s)));
    }
  }
  // The dead half: toward upwind, charred black, with a broken top
  const aD = WIND_A + Math.PI - 0.2;
  const baseD = V(x + Math.cos(aD) * 0.4, 3.7, z + Math.sin(aD) * 0.4);
  const lenD = 6.2;
  b.add(new THREE.CylinderGeometry(0.3, 0.72, lenD, 8), C.char, leanM(baseD, aD, 0.5, lenD));
  const tipD = baseD.clone().addScaledVector(leanDir(aD, 0.5), lenD);
  b.add(new THREE.ConeGeometry(0.32, 1.2, 5), C.char, M(tipD.x, tipD.y + 0.4, tipD.z, r() * 6, 1, 0.3, -0.2));
  for (let i = 0; i < 3; i++) {
    const p = baseD.clone().addScaledVector(leanDir(aD, 0.5), lenD * (0.35 + i * 0.2));
    const a = aD + (i - 1) * 1.1;
    const len = 1.8 + r() * 1.6;
    b.add(new THREE.CylinderGeometry(0.04, 0.14, len, 5), C.char, leanM(p, a, 0.9 + r() * 0.4, len));
  }
  // Electric light in the split: a zigzag line running down from the fork
  const sa = WIND_A + Math.PI * 0.5;
  let py = 4.2;
  for (let k = 0; k < 6; k++) {
    const ny = py - 0.55;
    const off = (k % 2 ? 1 : -1) * 0.12;
    glow.push(new THREE.BoxGeometry(0.07, 0.62, 0.05).applyMatrix4(M(x + Math.cos(sa) * 1.12 + off * Math.sin(sa), y0 + (py + ny) / 2, z + Math.sin(sa) * 1.12 - off * Math.cos(sa), -sa + Math.PI / 2, 1, 0, k % 2 ? 0.45 : -0.45)));
    py = ny;
  }
  // Ribbon tied to a low branch
  const cols = [0x3a6ad0, 0xf2efe6, 0xe8c44a, 0xc8433a, 0x3a6ad0, 0x4a9a52, 0xf2efe6];
  ribbonAt.forEach((p, i) => {
    for (let k = 0; k < 2; k++) cloth.strip(V(p.x + (r() - 0.5) * 0.3, y0 + p.y - 0.1, p.z + (r() - 0.5) * 0.3), 1.2 + r() * 0.9, 0.14, cols[(i * 2 + k) % cols.length]);
  });
  ctx.solids.add(x, z, 1.6);
  return V(tipL.x, y0 + tipL.y, tipL.z);
}

/** Wind-bent low tree: a few scattered over the grassland, the crown blown into a patch stretched toward downwind */
export function bentTree(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.4 * s);
  const a = WIND_A + (r() - 0.5) * 0.4;
  const len = 3.2 * s;
  const tilt = 0.32 + r() * 0.2;
  b.add(new THREE.CylinderGeometry(0.16 * s, 0.3 * s, len, 7), C.bark, leanM(V(x, -0.1, z), a, tilt, len));
  const top = V(x, -0.1, z).addScaledVector(leanDir(a, tilt), len);
  const b2 = V(x, 0, z).addScaledVector(leanDir(a, tilt), len * 0.55);
  b.add(new THREE.CylinderGeometry(0.06 * s, 0.14 * s, len * 0.6, 5), C.bark, leanM(b2, a - 1.2, 0.9, len * 0.6));
  for (let k = 0; k < 4; k++) {
    const q = top.clone().add(V(Math.cos(a) * k * 0.7 * s + (r() - 0.5) * s, (r() - 0.2) * 0.6 * s, Math.sin(a) * k * 0.7 * s + (r() - 0.5) * s));
    const sc = s * (1.3 - k * 0.18);
    b.add(new THREE.IcosahedronGeometry(1, 1), C.leaf[k % 3], M(q.x, q.y + 0.3 * s, q.z, -a, 1).multiply(MS(0, 0, 0, sc * 1.5, sc * 0.55, sc)));
  }
  ctx.solids.add(x, z, 0.35 * s);
}

// ───────────────────────── Rocks ─────────────────────────

/** Rounded granite (a subdivided dodecahedron, flattened) */
export function granite(ctx: FieldCtx, x: number, y: number, z: number, sx: number, sy: number, sz: number, col: number, lichen = true): void {
  const { b, r } = ctx;
  b.add(new THREE.DodecahedronGeometry(1, 1), col, M(x, y, z, r() * 6, 1, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2).multiply(MS(0, 0, 0, sx, sy, sz)));
  if (lichen && r() < 0.7) b.add(new THREE.CircleGeometry(Math.min(sx, sz) * 0.45, 7), C.lichen, M(x + (r() - 0.5) * sx * 0.4, y + sy * 0.97, z + (r() - 0.5) * sz * 0.4, 0, 1, -Math.PI / 2, r() * 6), false);
}

/** Weathered granite slab: a flat prism with an irregular polygon outline and sharp edges */
function slab(ctx: FieldCtx, x: number, y: number, z: number, w: number, h: number, d: number, col: number): void {
  const { b, r } = ctx;
  const g = new THREE.CylinderGeometry(0.9, 1, 1, 7, 1);
  const p1 = r() * 6;
  const p2 = r() * 6;
  const q = g.attributes.position;
  for (let i = 0; i < q.count; i++) {
    const px = q.getX(i);
    const pz = q.getZ(i);
    const a = Math.atan2(pz, px);
    const f = 1 + 0.13 * Math.sin(3 * a + p1) + 0.08 * Math.sin(5 * a + p2);
    q.setXYZ(i, px * f, q.getY(i), pz * f);
  }
  g.computeVertexNormals();
  b.add(g, col, M(x, y, z, r() * 6, 1, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12).multiply(MS(0, 0, 0, w, h, d)));
  if (r() < 0.6) b.add(new THREE.CircleGeometry(Math.min(w, d) * 0.4, 7), C.lichen, M(x + (r() - 0.5) * w * 0.4, y + h * 0.52, z + (r() - 0.5) * d * 0.4, 0, 1, -Math.PI / 2, r() * 6), false);
}

/** Stacked rock tower (tor): granite slabs that narrow layer by layer upward, offset left and right */
export function tor(ctx: FieldCtx, x: number, z: number, W: number, layers: number): void {
  const { r } = ctx;
  ctx.place(x, z, W * 0.6);
  let y = -0.3;
  let w = W;
  let ox = 0;
  let oz = 0;
  for (let k = 0; k < layers; k++) {
    const h = w * (0.34 + r() * 0.16);
    slab(ctx, x + ox, y + h / 2, z + oz, w, h, w * (0.7 + r() * 0.3), [C.granite, C.granite2, C.granite3][k % 3]);
    y += h * 0.97;
    w *= 0.74 + r() * 0.12;
    ox += (r() - 0.5) * w * 0.45;
    oz += (r() - 0.5) * w * 0.45;
  }
  ctx.solids.add(x, z, W * 0.95);
}

/** Balanced rock: a big round stone sitting on a thin pedestal */
export function balancedRock(ctx: FieldCtx, x: number, z: number): void {
  ctx.place(x, z, 1.2);
  granite(ctx, x, 1.0, z, 1.6, 1.5, 1.3, C.granite2, false);
  granite(ctx, x + 0.2, 2.4, z, 1.0, 0.7, 0.9, C.granite, false);
  granite(ctx, x + 0.5, 4.6, z - 0.2, 2.7, 2.1, 2.4, C.granite3);
  ctx.solids.add(x, z, 1.7);
}

// ───────────────────────── Traces of the migration ─────────────────────────

/** A ring of stones left by an old tent */
export function stoneRing(ctx: FieldCtx, x: number, z: number, R: number): void {
  const { b, r } = ctx;
  const n = Math.round(R * 4.5);
  for (let i = 0; i < n; i++) {
    if (r() < 0.12) continue;
    const a = (i / n) * Math.PI * 2 + r() * 0.15;
    const px = x + Math.cos(a) * R;
    const pz = z + Math.sin(a) * R;
    ctx.place(px, pz);
    b.add(new THREE.DodecahedronGeometry(0.2 + r() * 0.16, 0), r() < 0.5 ? C.granite : C.granite2, M(px, 0.08, pz, r() * 6, 1, r(), r()));
  }
}

/** Hearth: a ring of stones, charred ground and a few half-burned logs */
export function firePit(ctx: FieldCtx, x: number, z: number, cold: boolean): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.8);
  b.add(new THREE.CircleGeometry(1.3, 12), C.scorch, M(x, 0.03, z, 0, 1, -Math.PI / 2), false);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    b.add(new THREE.DodecahedronGeometry(0.24, 0), 0x5c586e, M(x + Math.cos(a) * 0.95, 0.14, z + Math.sin(a) * 0.95, r() * 6, 0.85 + r() * 0.4, r() * 0.5));
  }
  for (let i = 0; i < 3; i++) b.add(new THREE.CylinderGeometry(0.08, 0.1, 1.0, 5), cold ? C.char : C.woodDark, M(x, 0.12, z, i * 2.1 + r(), 1, 0, Math.PI / 2 - 0.2));
  ctx.solids.add(x, z, 1.0);
}

/** Sheep skull: a curl-horned skull lying in the grass */
export function ramSkull(ctx: FieldCtx, x: number, z: number): void {
  const { b, r } = ctx;
  ctx.place(x, z);
  const a = r() * 6;
  const T = M(x, 0.25, z, a, 1, -0.3);
  b.add(new THREE.SphereGeometry(0.28, 8, 6), C.bone, at(T, MS(0, 0, 0, 1, 0.8, 1.3)));
  b.add(new THREE.BoxGeometry(0.22, 0.18, 0.4), C.boneShade, at(T, M(0, -0.05, 0.35)));
  for (const s of [-1, 1]) b.add(new THREE.TorusGeometry(0.2, 0.07, 5, 10, Math.PI * 1.5), C.boneShade, at(T, M(s * 0.28, 0.08, -0.05, Math.PI / 2, 1, 0, s * 0.8)));
}

/** Tent lattice frame blown over by the wind (crossed thin laths) */
export function lattice(ctx: FieldCtx, x: number, z: number, a: number): void {
  const { b } = ctx;
  ctx.place(x, z, 1);
  const T = M(x, 0.2, z, a, 1, -1.35);
  for (let k = -3; k <= 3; k++) {
    b.add(new THREE.BoxGeometry(0.05, 0.05, 2.4), C.wood, at(T, M(k * 0.35, 0, 0, 0.6)), false);
    b.add(new THREE.BoxGeometry(0.05, 0.05, 2.4), C.woodDark, at(T, M(k * 0.35, 0.05, 0, -0.6)), false);
  }
}

/** Stepping stones at the ford */
export function steppingStones(ctx: FieldCtx, a: [number, number], c: [number, number], n: number, waterY: number): void {
  const { b, r } = ctx;
  b.lift = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = a[0] + (c[0] - a[0]) * t + (r() - 0.5) * 0.7;
    const z = a[1] + (c[1] - a[1]) * t + (r() - 0.5) * 0.7;
    const gy = ctx.h(x, z);
    const top = Math.max(gy + 0.1, waterY + 0.12);
    const rad = 0.55 + r() * 0.3;
    b.add(new THREE.CylinderGeometry(rad * 0.9, rad, top - gy + 0.4, 7), r() < 0.5 ? C.granite : C.granite2, M(x, (top + gy - 0.4) / 2, z, r() * 6));
  }
}
