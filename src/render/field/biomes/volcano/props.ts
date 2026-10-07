// Props of the Emberspine Volcanic Belt: basalt columns, scoria boulders, fumaroles, sulfur crystals, obsidian,
// charred wood and flame maples, brazier, anvil, sword stuck in the ground.
// Colors are gathered in COL (same-colored parts merge into one mesh, so the fewer distinct colors the cheaper).

import * as THREE from 'three';
import { M, MS } from '../../../arenaKit.ts';
import type { FieldCtx } from '../../kit.ts';

export const COL = {
  basalt: 0x3a2f36,
  basalt2: 0x463a42,
  basaltTop: 0x5c4c55,
  scoria: 0x4c2e2c,
  rock: 0x2e2529,
  ash: 0x6e6266,
  iron: 0x2a2328,
  ironL: 0x4a3d44,
  ironTrim: 0x655560,
  bronze: 0xb8743a,
  stone: 0x6a5a5e,
  stoneD: 0x4c4048,
  stoneL: 0x857378,
  roof: 0x8a2c24,
  roofD: 0x5e1e1c,
  wood: 0x6e4a30,
  woodD: 0x4a3020,
  char: 0x221a1c,
  cloth: 0xb02a22,
  gold: 0xd8a040,
  cult: 0x3e2656,
  obsidian: 0x1c1b20,
  obsidianL: 0x3c4250,
  sulfurRock: 0xa89040,
  travertine: 0xe6dcc4,
  bone: 0xd8ccb4,
  leaf: [0x8a2c20, 0xa04424, 0x66201a],
  // Glowing
  ember: 0xff7a2a,
  fire: 0xffb040,
  sulfur: 0xe8c030,
  purple: 0x9a3aff,
  rune: 0xff9a4a,
};

/** Convert region-local coordinates, oriented along facing (0 = +z), to world coordinates */
export function local(x: number, z: number, facing: number) {
  const c = Math.cos(facing);
  const s = Math.sin(facing);
  return (lx: number, lz: number): [number, number] => [x + c * lx + s * lz, z - s * lx + c * lz];
}

/**
 * Basalt column cluster: several hexagonal columns of different heights crowded together; with tall set,
 * a towering forest of columns
 */
export function basalt(ctx: FieldCtx, x: number, z: number, s: number, tall = 0, solid = true): number {
  const { b, r } = ctx;
  ctx.place(x, z, s * 0.9);
  const n = 4 + Math.floor(r() * 4);
  let top = 0;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = i === 0 ? 0 : (0.55 + r() * 0.55) * s;
    const h = (0.7 + r() * 1.8) * s + (i < 3 ? tall * (0.5 + r() * 0.5) : tall * r() * 0.4);
    const rad = (0.34 + r() * 0.16) * s;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    const tilt = tall ? 0.03 : 0.1;
    const rx = (r() - 0.5) * tilt;
    const rz = (r() - 0.5) * tilt;
    const ry = r() * 6;
    b.add(new THREE.CylinderGeometry(rad, rad * 1.04, h + 0.6, 6), i % 2 ? COL.basalt : COL.basalt2, M(px, h / 2 - 0.3, pz, ry, 1, rx, rz));
    b.add(new THREE.CylinderGeometry(rad * 0.97, rad * 0.97, 0.1, 6), COL.basaltTop, M(px, h + 0.02, pz, ry, 1, rx, rz), false);
    top = Math.max(top, h);
  }
  if (solid) ctx.solids.add(x, z, s * 1.05);
  return top;
}

/** Ground slope (height difference / horizontal distance) */
export function slopeAt(ctx: FieldCtx, x: number, z: number, e = 1): number {
  return Math.hypot(ctx.h(x + e, z) - ctx.h(x - e, z), ctx.h(x, z + e) - ctx.h(x, z - e)) / (2 * e);
}

/**
 * Scoria boulder: a flat, dark red rock; with seam set, a glowing crack (buried deeper on a slope,
 * so the downhill side does not hang in the air)
 */
export function scoria(ctx: FieldCtx, x: number, z: number, s: number, seam = false, col = COL.scoria): void {
  const { b, r } = ctx;
  ctx.place(x, z, s * 0.6);
  const sink = Math.min(1.2, slopeAt(ctx, x, z, s)) * s * 0.75;
  const ry = r() * 6;
  const g = new THREE.DodecahedronGeometry(1, 0);
  g.scale(1.15, 0.72, 0.95);
  b.add(g, col, M(x, s * 0.42 - sink, z, ry, s, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4));
  if (seam) b.glow(new THREE.BoxGeometry(s * 1.6, s * 0.06, s * 0.08), COL.ember, M(x, s * 0.5 - sink, z, ry + 0.4, 1, 0, (r() - 0.5) * 0.5));
  if (s > 0.7) ctx.solids.add(x, z, s * 0.95);
}

/** Rubble (no collider) */
export function pebbles(ctx: FieldCtx, x: number, z: number, n: number, spread: number, col = COL.rock): void {
  const { b, r } = ctx;
  ctx.place(x, z);
  for (let i = 0; i < n; i++) {
    const s = 0.12 + r() * 0.22;
    b.add(new THREE.DodecahedronGeometry(s, 0), col, M(x + (r() - 0.5) * spread, s * 0.4, z + (r() - 0.5) * spread, r() * 6, 1, r(), r()), false);
  }
}

/** Fumarole: a low mound, a black opening, a ring of sulfur crystals; returns the vent position */
export function vent(ctx: FieldCtx, x: number, z: number, s = 1): THREE.Vector3 {
  const { b, r } = ctx;
  const y = ctx.place(x, z, 1.1 * s);
  b.add(new THREE.CylinderGeometry(0.5 * s, 1.3 * s, 0.7 * s, 9), COL.sulfurRock, M(x, 0.3 * s, z));
  b.add(new THREE.CylinderGeometry(0.36 * s, 0.36 * s, 0.06, 9), 0x120c0e, M(x, 0.66 * s, z), false);
  b.glow(new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 0.05, 8), COL.ember, M(x, 0.64 * s, z));
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    const d = (1.1 + r() * 0.6) * s;
    const g = new THREE.OctahedronGeometry(0.16 + r() * 0.12);
    g.scale(0.7, 1.8, 0.7);
    b.glow(g, COL.sulfur, M(x + Math.cos(a) * d, 0.15, z + Math.sin(a) * d, r() * 6, 1, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7));
  }
  ctx.solids.add(x, z, 1.0 * s);
  return new THREE.Vector3(x, y + 0.7 * s, z);
}

/** Sulfur crystal cluster (glowing) */
export function sulfur(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  ctx.place(x, z);
  b.add(new THREE.DodecahedronGeometry(0.45 * s, 0), COL.sulfurRock, M(x, 0.1 * s, z, r() * 6, 1, 0.3, 0.2));
  for (let i = 0; i < 4; i++) {
    const g = new THREE.OctahedronGeometry(0.22 * s);
    g.scale(0.6, 2.1, 0.6);
    b.glow(g, COL.sulfur, M(x + (r() - 0.5) * 0.7 * s, 0.35 * s, z + (r() - 0.5) * 0.7 * s, r() * 6, 0.7 + r() * 0.5, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8));
  }
}

/** Obsidian: black glass-like sharp slabs, the tips with a touch of purple light */
export function obsidian(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, s * 0.6);
  // Obsidian: angular black rock like broken glass (squat, blocky shapes, unlike the void crystals' slender spikes)
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(0.62 * s * (i ? 0.7 : 1), 0);
    g.scale(1.25, 0.72 + r() * 0.3, 0.95);
    const a = r() * Math.PI * 2;
    const d = i ? (0.55 + r() * 0.4) * s : 0;
    b.add(g, i % 2 ? COL.obsidianL : COL.obsidian, M(x + Math.cos(a) * d, 0.28 * s, z + Math.sin(a) * d, r() * 6, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
  }
  ctx.solids.add(x, z, 0.8 * s);
}

/** Charred dead tree: twisted trunk, a few bare branches, embers at the branch tips */
export function charredTree(ctx: FieldCtx, x: number, z: number, s: number, embers = true): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.3 * s);
  const lean = (r() - 0.5) * 0.25;
  const la = r() * 6;
  const h = (2.6 + r() * 1.6) * s;
  b.add(new THREE.CylinderGeometry(0.13 * s, 0.3 * s, h, 6), COL.char, M(x, h / 2 - 0.1, z, la, 1, lean, lean * 0.5));
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const y = h * (0.5 + r() * 0.4);
    const len = (0.8 + r() * 1.1) * s;
    const tilt = 0.6 + r() * 0.5;
    const dx = Math.cos(a) * Math.sin(tilt) * len * 0.5;
    const dz = Math.sin(a) * Math.sin(tilt) * len * 0.5;
    const dy = Math.cos(tilt) * len * 0.5;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
    b.add(new THREE.CylinderGeometry(0.03 * s, 0.09 * s, len, 5), COL.char, new THREE.Matrix4().compose(new THREE.Vector3(x + dx + lean * y * 0.2, y + dy, z + dz), q, new THREE.Vector3(1, 1, 1)));
    if (embers && r() < 0.5) b.glow(new THREE.SphereGeometry(0.07 * s, 5, 4), COL.ember, M(x + dx * 2 + lean * y * 0.2, y + dy * 2, z + dz * 2));
  }
  ctx.solids.add(x, z, 0.35 * s);
}

/** Flame maple: red-orange crown (the street trees of Rediron Keep, also beside the hot springs) */
export function emberMaple(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.3 * s);
  const lean = (r() - 0.5) * 0.25;
  b.add(new THREE.CylinderGeometry(0.14 * s, 0.3 * s, 2.4 * s, 6), COL.woodD, M(x, 1.2 * s, z, 0, 1, lean, 0));
  // Two or three branches slanting out, the leaf clumps spread at the branch tips: flat and layered, not a ball
  const nb = 3;
  const a0 = r() * Math.PI * 2;
  for (let i = 0; i < nb; i++) {
    const a = a0 + (i / nb) * Math.PI * 2 + (r() - 0.5) * 0.6;
    const L = (1.0 + r() * 0.4) * s;
    const bx = x + Math.cos(a) * L * 0.45;
    const bz = z + Math.sin(a) * L * 0.45;
    b.add(new THREE.CylinderGeometry(0.06 * s, 0.11 * s, L, 5), COL.woodD, M(bx, 2.3 * s + L * 0.29, bz, Math.PI - a, 1, 0, 0.95));
    const cx = x + Math.cos(a) * L * 0.85;
    const cz = z + Math.sin(a) * L * 0.85;
    const g = new THREE.DodecahedronGeometry((0.95 + r() * 0.3) * s, 0);
    g.scale(1.25, 0.55, 1.25);
    b.add(g, COL.leaf[i % 3], M(cx, (2.85 + r() * 0.5) * s, cz, r() * 6));
  }
  const top = new THREE.DodecahedronGeometry(1.05 * s, 0);
  top.scale(1.2, 0.6, 1.2);
  b.add(top, COL.leaf[(Math.floor(r() * 3) + 1) % 3], M(x, 3.55 * s, z, r() * 6));
  ctx.solids.add(x, z, 0.4 * s);
}

/** Dry grass clump (an accent for the scorched grassland, no collider) */
export function dryTuft(ctx: FieldCtx, x: number, z: number, s: number, col: number): void {
  const { b, r } = ctx;
  ctx.place(x, z);
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    const h = (0.5 + r() * 0.5) * s;
    b.add(new THREE.ConeGeometry(0.05 * s, h, 3), col, M(x + Math.cos(a) * 0.15 * s, h / 2, z + Math.sin(a) * 0.15 * s, r() * 6, 1, Math.cos(a) * 0.35, Math.sin(a) * 0.35), false);
  }
}

/** Brazier: a fire bowl on a three-legged iron stand; returns the flame position */
export function brazier(ctx: FieldCtx, x: number, z: number, h = 1.3, big = false): THREE.Vector3 {
  const { b } = ctx;
  const y = ctx.place(x, z, 0.4);
  const R = big ? 0.75 : 0.45;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(new THREE.CylinderGeometry(0.04, 0.06, h * 1.05, 4), COL.iron, M(x + Math.cos(a) * R * 0.45, h / 2, z + Math.sin(a) * R * 0.45, 0, 1, Math.sin(a) * 0.18, -Math.cos(a) * 0.18));
  }
  b.add(new THREE.CylinderGeometry(R, R * 0.55, R * 0.6, 10, 1, true), COL.ironL, M(x, h + R * 0.2, z));
  b.add(new THREE.TorusGeometry(R, 0.05, 4, 12), COL.ironTrim, M(x, h + R * 0.5, z, 0, 1, Math.PI / 2));
  b.glow(new THREE.CylinderGeometry(R * 0.85, R * 0.6, 0.12, 10), COL.ember, M(x, h + R * 0.4, z));
  const g = new THREE.ConeGeometry(R * 0.55, R * 1.6, 7);
  b.glow(g, COL.fire, M(x, h + R * 0.4 + R * 0.8, z));
  ctx.solids.add(x, z, R + 0.1);
  return new THREE.Vector3(x, y + h + R * 1.2, z);
}

/** Anvil */
export function anvil(ctx: FieldCtx, x: number, z: number, facing: number, hot = false): void {
  const { b } = ctx;
  ctx.place(x, z, 0.5);
  b.add(new THREE.CylinderGeometry(0.35, 0.45, 0.55, 8), COL.woodD, M(x, 0.27, z));
  b.add(new THREE.BoxGeometry(0.42, 0.32, 0.32), COL.iron, M(x, 0.7, z, facing));
  const L = local(x, z, facing);
  b.add(new THREE.BoxGeometry(0.95, 0.2, 0.42), COL.ironL, M(x, 0.95, z, facing));
  const [hx, hz] = L(0.62, 0);
  b.add(new THREE.ConeGeometry(0.16, 0.45, 6), COL.ironL, M(hx, 0.93, hz, facing, 1, 0, -Math.PI / 2));
  if (hot) {
    const [sx, sz] = L(-0.1, 0);
    b.glow(new THREE.BoxGeometry(0.62, 0.05, 0.08), COL.fire, M(sx, 1.08, sz, facing));
  }
  ctx.solids.add(x, z, 0.55);
}

/** A sword stuck in the ground (y is the ground height): blade, crossguard, grip, pommel; scale 1 is about 1.6 meters */
export function sword(ctx: FieldCtx, x: number, y: number, z: number, s: number, facing: number, tiltX: number, tiltZ: number, blade = COL.ironTrim, hilt = COL.iron, glow?: number): void {
  const { b } = ctx;
  // y is absolute height: temporarily zero the batch's lift
  const keep = b.lift;
  b.lift = 0;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, facing, tiltZ));
  const place = (g: THREE.BufferGeometry, col: number, ly: number, isGlow = false) => {
    const off = new THREE.Vector3(0, ly * s, 0).applyQuaternion(q);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x + off.x, y + off.y, z + off.z), q, new THREE.Vector3(s, s, s));
    if (isGlow) b.glow(g, col, m);
    else b.add(g, col, m);
  };
  // The blade is buried 0.3 into the ground
  place(new THREE.BoxGeometry(0.16, 1.05, 0.035), blade, 0.22);
  const tip = new THREE.ConeGeometry(0.113, 0.22, 4);
  tip.rotateY(Math.PI / 4);
  tip.scale(1, 1, 0.3);
  tip.rotateX(Math.PI);
  place(tip, blade, -0.37);
  place(new THREE.BoxGeometry(0.5, 0.07, 0.09), hilt, 0.78);
  place(new THREE.CylinderGeometry(0.035, 0.04, 0.3, 6), COL.woodD, 0.96);
  place(new THREE.SphereGeometry(0.06, 6, 5), hilt, 1.14);
  if (glow !== undefined) place(new THREE.BoxGeometry(0.05, 0.7, 0.045), glow, 0.28, true);
  b.lift = keep;
}

/** Round shield (lying on the ground or leaning against a rock) */
export function shield(ctx: FieldCtx, x: number, y: number, z: number, s: number, facing: number, tilt: number, face: number, rim: number): void {
  const { b } = ctx;
  const keep = b.lift;
  b.lift = 0;
  b.add(new THREE.CylinderGeometry(0.55 * s, 0.55 * s, 0.08, 12), face, M(x, y, z, facing, 1, tilt, 0));
  b.add(new THREE.TorusGeometry(0.55 * s, 0.05, 4, 12), rim, M(x, y, z, facing, 1, tilt + Math.PI / 2, 0));
  b.add(new THREE.SphereGeometry(0.12 * s, 6, 4), rim, M(x, y, z, facing, 1, tilt, 0));
  b.lift = keep;
}

/** Wooden crates and an ore pile (town, mine) */
export function oreCrates(ctx: FieldCtx, x: number, z: number, facing: number, ore = COL.ember): void {
  const { b, r } = ctx;
  ctx.place(x, z, 1);
  const L = local(x, z, facing);
  const [ax, az] = L(0, 0);
  b.add(new THREE.BoxGeometry(0.95, 0.9, 0.95), COL.wood, M(ax, 0.45, az, facing + r() * 0.3));
  const [bx, bz] = L(0.3, 0.1);
  b.add(new THREE.BoxGeometry(0.7, 0.7, 0.7), COL.woodD, M(bx, 1.25, bz, facing + r() * 0.5));
  const [cx, cz] = L(1.1, -0.2);
  b.add(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 10), COL.woodD, M(cx, 0.48, cz));
  b.add(new THREE.TorusGeometry(0.43, 0.04, 4, 12), COL.iron, M(cx, 0.72, cz, 0, 1, Math.PI / 2));
  const [ox, oz] = L(-0.9, 0.5);
  for (let i = 0; i < 5; i++) b.add(new THREE.DodecahedronGeometry(0.18 + r() * 0.1, 0), COL.rock, M(ox + (r() - 0.5) * 0.6, 0.15 + (i > 2 ? 0.2 : 0), oz + (r() - 0.5) * 0.5, r() * 6));
  b.glow(new THREE.OctahedronGeometry(0.12), ore, M(ox, 0.35, oz));
  ctx.solids.add(ax + 0.3, az, 1.1);
}

/**
 * Lava skylight: a ring of rocks around a small glowing lava hole in the ground (a prop, no terrain digging); returns the center
 */
export function skylight(ctx: FieldCtx, x: number, z: number, R: number): THREE.Vector3 {
  const { b, r } = ctx;
  const y = ctx.place(x, z, R);
  const disc = new THREE.CircleGeometry(R * 0.8, 12);
  disc.rotateX(-Math.PI / 2);
  b.glow(disc, COL.ember, M(x, 0.05, z));
  const inner = new THREE.CircleGeometry(R * 0.45, 10);
  inner.rotateX(-Math.PI / 2);
  b.glow(inner, COL.fire, M(x, 0.07, z));
  const n = Math.round(R * 5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.2;
    const s = 0.35 + r() * 0.3;
    b.add(new THREE.DodecahedronGeometry(s, 0), i % 2 ? COL.rock : COL.scoria, M(x + Math.cos(a) * R, s * 0.3, z + Math.sin(a) * R, r() * 6, 1, r(), r()));
  }
  ctx.solids.add(x, z, R + 0.3);
  return new THREE.Vector3(x, y + 0.1, z);
}

/** Bone arc (the ribs of the Dragon Skeleton) */
export function rib(ctx: FieldCtx, x: number, y: number, z: number, R: number, facing: number, thick: number): void {
  const g = new THREE.TorusGeometry(R, thick, 5, 10, Math.PI * 0.72);
  g.rotateZ(Math.PI * 0.14);
  const keep = ctx.b.lift;
  ctx.b.lift = 0;
  ctx.b.add(g, COL.bone, M(x, y, z, facing));
  ctx.b.lift = keep;
}

/** A scaled box (shorthand) */
export function box(ctx: FieldCtx, col: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, outline = true): void {
  ctx.b.add(new THREE.BoxGeometry(1, 1, 1), col, MS(x, y, z, sx, sy, sz, ry), outline);
}
