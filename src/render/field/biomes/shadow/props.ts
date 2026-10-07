// Props specific to Duskshade Hollow: lantern posts and extinguished lamps, stone lanterns, Society stone houses and the
// hall, the Thousand-Lamp Pillar and lamp strings, the gatekeeper hound statue,
// broken pillars, sarcophagi, gravestones, giant umbrella-mushroom trees, dead trees, crystal clusters, stalagmites, cocoons and moonbell flowers.
// All props are placed at absolute heights (first place takes the ground height, then lift is reset to zero),
// and the glowing lanterns are left to GlowSet to flicker together.

import * as THREE from 'three';
import { M, MS, type PropBatch } from '../../../arenaKit.ts';
import { GlowSet, V, catenary, leanDir, leanM, rope, segM, type ShroomCols } from '../../../arenas/_woods.ts';
import type { FieldCtx } from '../../kit.ts';
import type { Lamp } from './common.ts';
import { shadowsOf } from './fx.ts';

export const COL = {
  post: 0x2e2438,
  cap: 0x1e1828,
  tassel: 0x9a2a4a,
  lamp: 0xffb45a,
  window: 0xffc070,
  stone: 0x625c7e,
  stoneLight: 0x7e789c,
  stoneDark: 0x413a5c,
  slate: 0x2c2848,
  silver: 0xa4a2c8,
  wood: 0x4a3440,
  rune: 0xa46aff,
  cyan: 0x6ae8ff,
  moon: 0xc8d8ff,
  corrupt: 0xc03aff,
  silk: 0xd0dcff,
  rock: 0x3a3352,
  rockLight: 0x4e4668,
  dead: 0x3a3448,
  cloth: 0x3a2458,
};

export const SHROOM: ShroomCols = { stem: 0xd8ccee, caps: [0x5a3aa8, 0x3d4ab4, 0x7a3fb8], glows: [0xc46aff, 0x6ae8ff], spots: 0xe8dcff };
export const PALE = { trunk: 0xb8acc8, bark: 0x9a8eb0, leaves: [0x6a5a8e, 0x4a3c6c] };
export const DEEP = { trunk: 0x3d2c5c, bark: 0x30234a, leaves: [0x2c2050, 0x221a3e] };

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n);

/**
 * A local coordinate frame: origin (x, y, z), local +z facing `face`; only rotations about Y and local Z are allowed (for
 * rotation about X, rotate the geometry first)
 */
export function frame(x: number, y: number, z: number, face: number) {
  const c = Math.cos(face);
  const s = Math.sin(face);
  const at = (lx: number, lz: number): [number, number] => [x + c * lx + s * lz, z - s * lx + c * lz];
  return {
    at,
    m: (lx: number, ly: number, lz: number, ry = 0, sc = 1, rz = 0) => {
      const [wx, wz] = at(lx, lz);
      return M(wx, y + ly, wz, face + ry, sc, 0, rz);
    },
    ms: (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, ry = 0) => {
      const [wx, wz] = at(lx, lz);
      return MS(wx, y + ly, wz, sx, sy, sz, face + ry);
    },
    v: (lx: number, ly: number, lz: number) => {
      const [wx, wz] = at(lx, lz);
      return V(wx, y + ly, wz);
    },
  };
}

/** First take the ground height at (x, z); later props all use absolute heights */
export function ground(ctx: FieldCtx, x: number, z: number, spread = 0): number {
  const y = ctx.place(x, z, spread);
  ctx.b.lift = 0;
  return y;
}

// ───────────────────────── Lanterns ─────────────────────────

/** A hanging paper lantern: a short length of rope, a top cap, a glowing body, a bottom cap and a red tassel */
export function hangLantern(ctx: FieldCtx, glow: GlowSet, top: THREE.Vector3, s = 1): void {
  const { b } = ctx;
  b.add(cyl(0.012, 0.012, 0.2 * s, 3), COL.cap, M(top.x, top.y - 0.1 * s, top.z), false);
  const y = top.y - 0.2 * s;
  b.add(cyl(0.11 * s, 0.15 * s, 0.07 * s, 8), COL.cap, M(top.x, y, top.z));
  const body = new THREE.SphereGeometry(0.2 * s, 10, 7);
  body.scale(1, 1.3, 1);
  glow.add(body, M(top.x, y - 0.28 * s, top.z));
  b.add(cyl(0.13 * s, 0.1 * s, 0.06 * s, 8), COL.cap, M(top.x, y - 0.56 * s, top.z));
  b.add(new THREE.ConeGeometry(0.045 * s, 0.2 * s, 4), COL.tassel, M(top.x, y - 0.7 * s, top.z, 0, 1, Math.PI), false);
}

/** A lantern post along the road: a slightly crooked wooden post with a lamp arm reaching toward the road, hung with a warm-light lantern */
export function lanternPost(ctx: FieldCtx, glow: GlowSet, L: Lamp, lean: number): void {
  const { b } = ctx;
  const y = ground(ctx, L.x, L.z, 0.3);
  const H = 2.8;
  const ax = Math.sin(L.face);
  const az = Math.cos(L.face);
  b.add(cyl(0.24, 0.32, 0.36, 6), COL.stoneDark, M(L.x, y + 0.08, L.z));
  b.add(cyl(0.075, 0.11, H, 6), COL.post, M(L.x, y + H / 2, L.z, L.face, 1, 0, lean));
  const tx = L.x - az * Math.sin(lean) * H * 0.5;
  const tz = L.z + ax * Math.sin(lean) * H * 0.5;
  b.add(new THREE.ConeGeometry(0.13, 0.22, 5), COL.post, M(tx, y + H + 0.08, tz));
  b.add(box(0.07, 0.07, 1.0), COL.post, M(tx + ax * 0.45, y + H - 0.12, tz + az * 0.45, L.face));
  const brace = box(0.05, 0.05, 0.6);
  brace.rotateX(0.8);
  b.add(brace, COL.post, M(tx + ax * 0.2, y + H - 0.36, tz + az * 0.2, L.face));
  hangLantern(ctx, glow, V(tx + ax * 0.88, y + H - 0.16, tz + az * 0.88));
  ctx.solids.add(L.x, L.z, 0.3);
}

/** An extinguished lamp: a tilted post, a broken dark lantern, with corrupted amethyst growing at its foot */
export function deadLantern(ctx: FieldCtx, L: Lamp, r: () => number): void {
  const { b } = ctx;
  const y = ground(ctx, L.x, L.z, 0.3);
  const H = 2.6;
  const lean = (r() - 0.5) * 0.5;
  const ax = Math.sin(L.face);
  const az = Math.cos(L.face);
  b.add(cyl(0.24, 0.32, 0.36, 6), COL.stoneDark, M(L.x, y + 0.08, L.z));
  b.add(cyl(0.07, 0.1, H, 6), COL.dead, M(L.x, y + H / 2, L.z, L.face, 1, 0, lean));
  const tx = L.x - az * Math.sin(lean) * H * 0.5;
  const tz = L.z + ax * Math.sin(lean) * H * 0.5;
  const ty = y + H / 2 + (Math.cos(lean) * H) / 2;
  if (r() < 0.55) {
    // The lantern is still hanging, but dark and broken
    b.add(box(0.06, 0.06, 0.8), COL.dead, M(tx + ax * 0.35, ty - 0.1, tz + az * 0.35, L.face));
    const g = new THREE.IcosahedronGeometry(0.2, 0);
    g.scale(1, 1.3, 1);
    b.add(g, 0x2e2838, M(tx + ax * 0.7, ty - 0.5, tz + az * 0.7, r() * 3, 1, 0, 0.3));
  } else {
    // The lantern has fallen on the ground
    const g = new THREE.IcosahedronGeometry(0.22, 0);
    g.scale(1.3, 0.7, 1);
    b.add(g, 0x2e2838, M(L.x + ax * 0.8, y + 0.12, L.z + az * 0.8, r() * 3));
  }
  // Corrupted amethyst
  for (let i = 0; i < 2 + Math.floor(r() * 3); i++) {
    const a = r() * Math.PI * 2;
    const d = 0.4 + r() * 0.6;
    const sh = new THREE.OctahedronGeometry(0.16 + r() * 0.12);
    sh.scale(0.6, 2.2, 0.6);
    const rz = (r() - 0.5) * 0.8;
    if (i === 0) b.glow(sh, COL.corrupt, M(L.x + Math.cos(a) * d, y + 0.2, L.z + Math.sin(a) * d, a, 1, 0, rz));
    else b.add(sh, 0x2a1a3e, M(L.x + Math.cos(a) * d, y + 0.2, L.z + Math.sin(a) * d, a, 1, 0, rz));
  }
  ctx.solids.add(L.x, L.z, 0.3);
}

/** Stone lantern: a stone base, a thin pillar, a lamp chamber (glowing), and a four-cornered pyramid stone roof */
export function stoneLantern(ctx: FieldCtx, glow: GlowSet, x: number, z: number, face: number, s = 1): void {
  const { b } = ctx;
  const y = ground(ctx, x, z, 0.5 * s);
  const f = frame(x, y, z, face);
  b.add(cyl(0.5 * s, 0.62 * s, 0.35 * s, 6), COL.stoneDark, f.m(0, 0.12 * s, 0));
  b.add(cyl(0.18 * s, 0.24 * s, 1.1 * s, 6), COL.stone, f.m(0, 0.8 * s, 0));
  b.add(box(0.85 * s, 0.14 * s, 0.85 * s), COL.stone, f.m(0, 1.4 * s, 0));
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(box(0.1 * s, 0.5 * s, 0.1 * s), COL.stoneDark, f.m(lx * 0.25 * s, 1.72 * s, lz * 0.25 * s));
  glow.add(box(0.4 * s, 0.4 * s, 0.4 * s), f.m(0, 1.72 * s, 0));
  const roof = new THREE.ConeGeometry(0.72 * s, 0.5 * s, 4);
  roof.rotateY(Math.PI / 4);
  b.add(roof, COL.slate, f.m(0, 2.22 * s, 0));
  b.add(new THREE.SphereGeometry(0.1 * s, 6, 4), COL.stoneLight, f.m(0, 2.52 * s, 0));
  ctx.solids.add(x, z, 0.55 * s);
}

// ───────────────────────── Town buildings ─────────────────────────

export interface HouseOpts {
  wall?: number;
  roof?: number;
  /** Small glowing mushrooms on the roof */
  shrooms?: boolean;
  /** The lantern by the door */
  lamp?: boolean;
}

/**
 * A Society stone house: stone walls, corner stones, silver eave lines, a dark slate pyramid roof,
 * round windows glowing warm, and a lamp hung by the door
 */
export function stoneHouse(ctx: FieldCtx, glow: GlowSet, x: number, z: number, face: number, w: number, d: number, h: number, o: HouseOpts = {}): THREE.Vector3 {
  const { b, r } = ctx;
  const y = ground(ctx, x, z, Math.max(w, d) * 0.5);
  shadowsOf(ctx).push({ x, z, r: Math.max(w, d) * 0.85, amt: 0.45 });
  const f = frame(x, y, z, face);
  b.add(box(w + 0.6, 0.7, d + 0.6), COL.stoneDark, f.m(0, 0.05, 0));
  b.add(box(w, h, d), o.wall ?? COL.stone, f.m(0, h / 2 + 0.35, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.44, h + 0.05, 0.44), COL.stoneLight, f.m((sx * w) / 2, h / 2 + 0.35, (sz * d) / 2));
  // A ring at the foot of the wall and the eave line
  b.add(box(w + 0.9, 0.18, d + 0.9), COL.silver, f.m(0, h + 0.38, 0));
  const rh = Math.min(w, d) * 0.62;
  const roof = new THREE.ConeGeometry(1, 1, 4);
  roof.rotateY(Math.PI / 4);
  roof.scale((w + 1.3) / Math.SQRT2, rh, (d + 1.3) / Math.SQRT2);
  b.add(roof, o.roof ?? COL.slate, f.m(0, h + 0.47 + rh / 2, 0));
  b.glow(new THREE.OctahedronGeometry(0.2), COL.rune, f.m(0, h + 0.47 + rh + 0.25, 0));
  b.add(cyl(0.05, 0.05, 0.4, 4), COL.silver, f.m(0, h + 0.47 + rh + 0.02, 0));
  // Arched doorway
  b.add(box(1.0, 1.55, 0.14), COL.wood, f.m(0, 0.35 + 0.78, d / 2 + 0.04));
  const top = cyl(0.5, 0.5, 0.14, 12);
  top.rotateX(Math.PI / 2);
  b.add(top, COL.wood, f.m(0, 0.35 + 1.55, d / 2 + 0.04));
  const archG = new THREE.TorusGeometry(0.64, 0.11, 4, 12, Math.PI);
  b.add(archG, COL.stoneLight, f.m(0, 0.35 + 1.55, d / 2 + 0.07));
  for (const sx of [-1, 1]) b.add(box(0.2, 1.6, 0.2), COL.stoneLight, f.m(sx * 0.64, 0.35 + 0.8, d / 2 + 0.07));
  b.add(box(1.6, 0.16, 0.7), COL.stoneDark, f.m(0, 0.35, d / 2 + 0.5));
  // Round windows: both sides of the front, and the left and right walls
  const win = () => {
    const g = cyl(0.3, 0.3, 0.1, 10);
    g.rotateX(Math.PI / 2);
    return g;
  };
  const wy = h * 0.55 + 0.35;
  if (w > 3.4) for (const sx of [-1, 1]) glow.add(win(), f.m(sx * w * 0.3, wy, d / 2 + 0.02));
  for (const sx of [-1, 1]) glow.add(win(), f.m(sx * (w / 2 + 0.02), wy, 0, Math.PI / 2));
  for (const sx of [-1, 1]) {
    const fr = new THREE.TorusGeometry(0.33, 0.06, 4, 12);
    if (w > 3.4) b.add(fr, COL.silver, f.m(sx * w * 0.3, wy, d / 2 + 0.05), false);
  }
  // The lamp by the door
  if (o.lamp !== false) {
    b.add(box(0.06, 0.06, 0.5), COL.post, f.m(0.95, 2.35, d / 2 + 0.25));
    hangLantern(ctx, glow, f.v(0.95, 2.33, d / 2 + 0.48), 0.85);
  }
  // Small glowing mushrooms on the roof
  if (o.shrooms) {
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const lx = (r() - 0.5) * w * 0.8;
      const [mx, mz] = f.at(lx, (d / 2 + 0.3) * (r() < 0.5 ? 1 : -1));
      const s = 0.25 + r() * 0.2;
      b.add(cyl(0.04 * s * 3, 0.06 * s * 3, 0.5 * s, 5), SHROOM.stem, M(mx, y + h + 0.45 + 0.2 * s, mz));
      const cap = new THREE.SphereGeometry(0.4 * s, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      b.add(cap, SHROOM.caps[i % 3], M(mx, y + h + 0.45 + 0.45 * s, mz));
      b.glow(cyl(0.42 * s, 0.3 * s, 0.05, 8), SHROOM.glows[i % 2], M(mx, y + h + 0.45 + 0.43 * s, mz));
    }
  }
  const rr = Math.max(w, d) * 0.5 + 0.4;
  ctx.solids.add(x, z, rr);
  if (Math.abs(w - d) > 1.5) {
    const k = (Math.max(w, d) - Math.min(w, d)) / 2;
    const [ax, az] = w > d ? f.at(k, 0) : f.at(0, k);
    const [bx, bz] = w > d ? f.at(-k, 0) : f.at(0, -k);
    ctx.solids.add(ax, az, Math.min(w, d) * 0.6);
    ctx.solids.add(bx, bz, Math.min(w, d) * 0.6);
  }
  return V(x, y + h + 0.47 + rh * 0.8, z);
}

/**
 * Society Hall: a large stone hall with a two-tier roof, a glowing Eye of Dusk emblem on the front,
 * and two stone lanterns and a hanging curtain at the door
 */
export function hall(ctx: FieldCtx, glow: GlowSet, eye: GlowSet, x: number, z: number, face: number): void {
  const { b } = ctx;
  const w = 10;
  const d = 7.5;
  const h = 4.6;
  const y = ground(ctx, x, z, 5);
  const f = frame(x, y, z, face);
  b.add(box(w + 1.4, 0.9, d + 1.4), COL.stoneDark, f.m(0, 0.1, 0));
  b.add(box(w, h, d), COL.stone, f.m(0, h / 2 + 0.5, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(box(0.6, h + 0.2, 0.6), COL.stoneLight, f.m((sx * w) / 2, h / 2 + 0.5, (sz * d) / 2));
  // The colonnade at the front
  for (const sx of [-3.6, -1.2, 1.2, 3.6]) {
    b.add(cyl(0.3, 0.36, h - 0.3, 8), COL.stoneLight, f.m(sx, (h - 0.3) / 2 + 0.55, d / 2 + 1.5));
    b.add(box(0.8, 0.3, 0.8), COL.stoneDark, f.m(sx, 0.7, d / 2 + 1.5));
  }
  b.add(box(w + 0.6, 0.4, 2.6), COL.stoneDark, f.m(0, h + 0.35, d / 2 + 1.0));
  for (let i = 0; i < 3; i++) b.add(box(6 - i * 0.4, 0.22, 0.8), COL.stoneDark, f.m(0, 0.45 - i * 0.2, d / 2 + 2.9 + i * 0.7));
  // Two-tier roof
  b.add(box(w + 1.2, 0.2, d + 1.2), COL.silver, f.m(0, h + 0.6, 0));
  const r1 = new THREE.ConeGeometry(1, 1, 4);
  r1.rotateY(Math.PI / 4);
  r1.scale((w + 1.8) / Math.SQRT2, 2.4, (d + 1.8) / Math.SQRT2);
  b.add(r1, COL.slate, f.m(0, h + 0.7 + 1.2, 0));
  b.add(box(4.2, 2.0, 3.2), COL.stone, f.m(0, h + 2.6, 0));
  b.add(box(4.9, 0.16, 3.9), COL.silver, f.m(0, h + 3.62, 0));
  const r2 = new THREE.ConeGeometry(1, 1, 4);
  r2.rotateY(Math.PI / 4);
  r2.scale(5.2 / Math.SQRT2, 2.6, 4.2 / Math.SQRT2);
  b.add(r2, COL.slate, f.m(0, h + 3.7 + 1.3, 0));
  b.add(cyl(0.06, 0.06, 1.4, 4), COL.silver, f.m(0, h + 6.6, 0));
  eye.add(new THREE.OctahedronGeometry(0.34), f.m(0, h + 7.4, 0));
  // Eye of Dusk: the glowing ring and pupil on the front
  eye.add(new THREE.TorusGeometry(0.95, 0.09, 6, 28), f.m(0, h + 2.6, 1.62));
  const pupil = new THREE.SphereGeometry(0.34, 10, 8);
  pupil.scale(1, 1.5, 0.4);
  eye.add(pupil, f.m(0, h + 2.6, 1.62));
  // Main door and windows
  b.add(box(2.0, 3.0, 0.2), COL.wood, f.m(0, 2.0, d / 2 + 0.05));
  const dt = cyl(1.0, 1.0, 0.2, 14);
  dt.rotateX(Math.PI / 2);
  b.add(dt, COL.wood, f.m(0, 3.5, d / 2 + 0.05));
  glow.add(box(0.12, 2.4, 0.12), f.m(0, 2.2, d / 2 + 0.18));
  for (const sx of [-3.6, 3.6]) {
    const g = cyl(0.55, 0.55, 0.1, 12);
    g.rotateX(Math.PI / 2);
    glow.add(g, f.m(sx * 0.66, 3.2, d / 2 + 0.03));
  }
  for (const sx of [-1, 1]) for (const lz of [-1.8, 1.8]) {
    const g = box(0.1, 1.4, 0.7);
    glow.add(g, f.m(sx * (w / 2 + 0.02), 3.0, lz));
  }
  // Hanging curtain
  for (const sx of [-2.4, 2.4]) {
    b.add(box(1.0, 2.6, 0.06), COL.cloth, f.m(sx, h - 0.9, d / 2 + 2.35), false);
    b.glow(new THREE.TorusGeometry(0.22, 0.04, 4, 12), COL.rune, f.m(sx, h - 0.5, d / 2 + 2.4));
  }
  const [lx0, lz0] = f.at(-4.2, d / 2 + 4.6);
  const [lx1, lz1] = f.at(4.2, d / 2 + 4.6);
  stoneLantern(ctx, glow, lx0, lz0, face, 1.2);
  stoneLantern(ctx, glow, lx1, lz1, face, 1.2);
  ctx.solids.add(x, z, d * 0.62);
  for (const sx of [-1, 1]) {
    const [cx, cz] = f.at(sx * w * 0.32, 0);
    ctx.solids.add(cx, cz, d * 0.62);
  }
  for (const sx of [-3.6, -1.2, 1.2, 3.6]) {
    const [cx, cz] = f.at(sx, d / 2 + 1.5);
    ctx.solids.add(cx, cz, 0.45);
  }
}

/**
 * Thousand-Lamp Pillar: a tall stone pillar at the center of the village, topped with a large lantern cage;
 * returns the attachment points of the lamp strings
 */
export function lanternPillar(ctx: FieldCtx, glow: GlowSet, big: GlowSet, x: number, z: number): THREE.Vector3 {
  const { b } = ctx;
  const y = ground(ctx, x, z, 2.6);
  b.add(cyl(2.7, 3.0, 0.6, 8), COL.stoneDark, M(x, y + 0.15, z, Math.PI / 8));
  b.add(cyl(2.0, 2.2, 0.55, 8), COL.stone, M(x, y + 0.7, z, Math.PI / 8));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    stoneLanternMini(ctx, glow, x + Math.cos(a) * 2.45, y + 0.45, z + Math.sin(a) * 2.45, -a);
  }
  b.add(cyl(0.5, 0.66, 8.4, 8), COL.stone, M(x, y + 5.1, z, Math.PI / 8));
  for (const hy of [1.6, 3.8, 6.0]) b.add(cyl(0.72, 0.72, 0.28, 8), COL.silver, M(x, y + hy, z, Math.PI / 8));
  for (let i = 0; i < 4; i++) b.glow(box(0.08, 1.2, 0.08), COL.rune, M(x + Math.cos(i * 1.571) * 0.62, y + 4.9, z + Math.sin(i * 1.571) * 0.62));
  const ty = y + 9.3;
  b.add(cyl(1.25, 0.8, 0.35, 8), COL.stoneDark, M(x, ty, z, Math.PI / 8));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(box(0.08, 1.9, 0.08), COL.post, M(x + Math.cos(a) * 0.9, ty + 1.1, z + Math.sin(a) * 0.9));
  }
  const core = new THREE.SphereGeometry(0.72, 14, 10);
  core.scale(1, 1.25, 1);
  big.add(core, M(x, ty + 1.1, z));
  const roof = new THREE.ConeGeometry(1.5, 1.4, 8);
  b.add(roof, COL.slate, M(x, ty + 2.7, z, Math.PI / 8));
  b.add(new THREE.TorusGeometry(1.35, 0.07, 4, 16), COL.silver, M(x, ty + 2.05, z, 0, 1, Math.PI / 2));
  b.add(cyl(0.05, 0.05, 1.0, 4), COL.silver, M(x, ty + 3.8, z));
  b.glow(new THREE.OctahedronGeometry(0.3), COL.rune, M(x, ty + 4.5, z));
  ctx.solids.add(x, z, 3.0);
  return V(x, ty + 2.0, z);
}

function stoneLanternMini(ctx: FieldCtx, glow: GlowSet, x: number, y: number, z: number, face: number): void {
  const { b } = ctx;
  b.add(cyl(0.12, 0.16, 0.5, 5), COL.stoneDark, M(x, y + 0.25, z));
  glow.add(box(0.24, 0.24, 0.24), M(x, y + 0.62, z, face));
  const rf = new THREE.ConeGeometry(0.28, 0.24, 4);
  rf.rotateY(Math.PI / 4);
  b.add(rf, COL.slate, M(x, y + 0.86, z, face));
}

/**
 * Lamp string: a thin rope sagging between two points, with a row of small lanterns hung along it (mostly warm light,
 * with a few purple ones mixed in)
 */
export function festoon(ctx: FieldCtx, glow: GlowSet, a: THREE.Vector3, c: THREE.Vector3, sag: number, n: number): void {
  const { b } = ctx;
  b.lift = 0;
  rope(b, a, c, sag, 0.02, COL.cap, false, 10);
  const pts = catenary(a, c, sag, n + 1);
  for (let i = 1; i <= n; i++) {
    const p = pts[i];
    const g = new THREE.SphereGeometry(0.13, 7, 5);
    g.scale(1, 1.3, 1);
    const m = M(p.x, p.y - 0.2, p.z);
    if (i % 4 === 2) b.glow(g, COL.rune, m);
    else glow.add(g, m);
    b.add(cyl(0.01, 0.01, 0.12, 3), COL.cap, M(p.x, p.y - 0.06, p.z), false);
  }
}

// ───────────────────────── Stone objects of the ancient kingdom ─────────────────────────

/** Gatekeeper hound statue: crouching on a stone base with eyes glowing cold light (local +z is the direction the face points) */
export function hound(ctx: FieldCtx, eyes: GlowSet, x: number, z: number, face: number, s = 1): void {
  const { b } = ctx;
  const y = ground(ctx, x, z, 1.2 * s);
  const f = frame(x, y, z, face);
  const put = (g: THREE.BufferGeometry, col: number, lx: number, ly: number, lz: number) => b.add(g, col, f.m(lx * s, ly * s, lz * s, 0, s));
  put(box(1.7, 0.6, 2.5), COL.stoneDark, 0, 0.3, 0);
  put(box(1.0, 1.0, 1.6), COL.stone, 0, 1.05, -0.3);
  put(box(0.9, 1.45, 0.95), COL.stone, 0, 1.35, 0.4);
  put(new THREE.SphereGeometry(0.46, 10, 7), COL.stone, 0, 2.3, 0.62);
  put(box(0.38, 0.32, 0.55), COL.stone, 0, 2.16, 1.0);
  for (const sx of [-1, 1]) {
    put(new THREE.ConeGeometry(0.14, 0.45, 4), COL.stone, sx * 0.22, 2.78, 0.5);
    put(box(0.3, 0.95, 0.3), COL.stone, sx * 0.3, 1.0, 0.82);
    put(box(0.36, 0.2, 0.46), COL.stoneLight, sx * 0.3, 0.62, 0.9);
    eyes.add(new THREE.SphereGeometry(0.065 * s, 6, 4), f.m(sx * 0.16 * s, 2.36 * s, 1.07 * s));
  }
  put(new THREE.TorusGeometry(0.46, 0.07, 4, 12), COL.silver, 0, 1.95, 0.5);
  ctx.solids.add(x, z, 1.3 * s);
}

/** Stone pillar: a complete one has a capital, a broken one has a slanted top, with the fallen section lying beside it */
export function column(ctx: FieldCtx, x: number, z: number, h: number, rad: number, broken: boolean, r: () => number): void {
  const { b } = ctx;
  const y = ground(ctx, x, z, rad);
  shadowsOf(ctx).push({ x, z, r: rad * 3.2, amt: 0.5 });
  b.add(box(rad * 2.6, 0.5, rad * 2.6), COL.stoneDark, M(x, y + 0.15, z, r()));
  b.add(cyl(rad * 0.92, rad, h, 10), COL.stone, M(x, y + 0.4 + h / 2, z));
  if (broken) {
    const g = cyl(rad * 0.9, rad * 0.92, 0.6, 10);
    b.add(g, COL.stoneLight, M(x, y + 0.4 + h + 0.1, z, r() * 3, 1, 0, 0.35));
    const a = r() * Math.PI * 2;
    const d = rad * 2 + 0.8 + r();
    const dg = cyl(rad * 0.9, rad * 0.9, 1.2 + r(), 10);
    dg.rotateZ(Math.PI / 2);
    const [fx, fz] = [x + Math.cos(a) * d, z + Math.sin(a) * d];
    const fy = ctx.h(fx, fz);
    b.add(dg, COL.stone, M(fx, fy + rad * 0.8, fz, r() * 3));
    ctx.solids.add(fx, fz, rad + 0.3);
  } else {
    b.add(box(rad * 2.5, 0.4, rad * 2.5), COL.stoneLight, M(x, y + 0.4 + h + 0.2, z));
    b.add(cyl(rad * 1.2, rad * 0.92, 0.35, 10), COL.stone, M(x, y + 0.4 + h - 0.1, z));
  }
  ctx.solids.add(x, z, rad + 0.35);
}

/** Sarcophagus: a coffin body and lid; an open coffin lets purple light show through */
export function sarcophagus(ctx: FieldCtx, x: number, z: number, face: number, open: boolean): void {
  const { b } = ctx;
  const y = ground(ctx, x, z, 1.2);
  const f = frame(x, y, z, face);
  b.add(box(1.25, 0.25, 2.5), COL.stoneDark, f.m(0, 0.1, 0));
  b.add(box(1.1, 0.75, 2.3), COL.stone, f.m(0, 0.55, 0));
  if (open) {
    b.glow(box(0.86, 0.05, 2.0), COL.rune, f.m(0, 0.9, 0));
    b.add(box(1.25, 0.24, 2.45), COL.stoneLight, f.m(0.62, 0.72, 0.25, 0.25, 1, -0.35));
  } else {
    b.add(box(1.25, 0.24, 2.45), COL.stoneLight, f.m(0, 1.05, 0));
    b.add(box(0.5, 0.08, 1.2), COL.stone, f.m(0, 1.2, 0));
  }
  ctx.solids.add(x, z, 1.25);
}

/** Gravestone: a round-topped slab, often leaning to one side */
export function tombstone(ctx: FieldCtx, x: number, z: number, face: number, lean: number, s = 1): void {
  const { b } = ctx;
  const y = ground(ctx, x, z, 0.4);
  const f = frame(x, y, z, face);
  b.add(box(0.72 * s, 0.9 * s, 0.2 * s), COL.stone, f.m(0, 0.35 * s, 0, 0, 1, lean));
  const top = cyl(0.36 * s, 0.36 * s, 0.2 * s, 10);
  top.rotateX(Math.PI / 2);
  b.add(top, COL.stone, f.m(-Math.sin(lean) * 0.8 * s, 0.8 * s, 0, 0, 1, lean));
}

// ───────────────────────── Trees, rocks, crystals, cocoons, flowers ─────────────────────────

/**
 * Giant umbrella-mushroom tree (low-poly version): a slightly curved trunk, buttress roots, a flat cap,
 * dark gills under the cap, a ring of cold light on the cap edge, and hanging glowing threads;
 * large trees have side-branch small caps and shelf fungi
 */
export function umbrella(ctx: FieldCtx, x: number, z: number, R: number, H: number, pale: boolean): void {
  const { r, b } = ctx;
  const y = ground(ctx, x, z, R);
  shadowsOf(ctx).push({ x, z, r: R * 2.6, amt: 0.6 });
  const P = pale ? PALE : DEEP;
  const rim = pale ? COL.cyan : 0xc46aff;
  const big = R > 1.5;
  const a0 = r() * Math.PI * 2;
  const bend = H * (0.03 + r() * 0.03);
  const mid = V(x + Math.cos(a0) * bend * 0.4, y + H * 0.5, z + Math.sin(a0) * bend * 0.4);
  const top = V(x + Math.cos(a0) * bend, y + H, z + Math.sin(a0) * bend);
  const t1 = new THREE.CylinderGeometry(0.72, 1, 1, 9, 1, true);
  b.add(t1, P.trunk, segM(V(x, y - 0.4, z), mid, R));
  const t2 = new THREE.CylinderGeometry(0.66, 1, 1, 9, 1, true);
  b.add(t2, P.trunk, segM(mid, top.clone().setY(top.y - 0.2), R * 0.72));
  b.add(new THREE.CylinderGeometry(R, R * 1.45, R * 0.9, 9, 1, true), P.bark, M(x, y + R * 0.4, z, a0));
  const nr = big ? 5 : 3;
  for (let i = 0; i < nr; i++) {
    const a = a0 + (i / nr) * Math.PI * 2 + (r() - 0.5) * 0.6;
    const len = R * (1.7 + r() * 0.8);
    const base = V(x + Math.cos(a) * R * 0.85, y + R * 1.15, z + Math.sin(a) * R * 0.85);
    b.add(new THREE.ConeGeometry(R * 0.42, len, 4), P.bark, leanM(base, a, 2.15 + r() * 0.2, len, 1, 0.35));
  }
  // Cap
  const C = R * 3.5 * (0.9 + r() * 0.25);
  const cy = top.y - C * 0.05;
  const tilt = (r() - 0.5) * 0.12;
  const cap = new THREE.SphereGeometry(C, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  cap.scale(1, 0.4, 1);
  b.add(cap, P.leaves[0], M(top.x, cy, top.z, a0, 1, 0, tilt));
  b.add(new THREE.CylinderGeometry(C * 0.99, C * 0.42, C * 0.24, 12), P.leaves[1], M(top.x, cy - C * 0.12, top.z, a0, 1, 0, tilt));
  b.glow(new THREE.CylinderGeometry(C * 1.01, C * 1.01, C * 0.05, 18, 1, true), rim, M(top.x, cy - 0.02, top.z, a0, 1, 0, tilt));
  // Hanging fine threads, with a small light bead at the end
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r();
    const d = C * (0.72 + r() * 0.2);
    const p0 = V(top.x + Math.cos(a) * d, cy - C * 0.1, top.z + Math.sin(a) * d);
    const p1 = p0.clone().add(V(0, -(1.5 + r() * 3), 0));
    b.add(new THREE.CylinderGeometry(1, 1, 1, 3, 1, true), P.leaves[1], segM(p0, p1, 0.03), false);
    if (i % 2 === 0) b.glow(new THREE.OctahedronGeometry(0.08), rim, M(p1.x, p1.y, p1.z));
  }
  // Large tree: a small cap held up on a side branch
  if (big) {
    for (let i = 0; i < 2; i++) {
      const a = a0 + 1.4 + i * 2.6 + (r() - 0.5) * 0.6;
      const hy = y + H * (0.4 + i * 0.14 + r() * 0.06);
      const len = R * (2.4 + r());
      const base = V(x + Math.cos(a) * R * 0.6, hy, z + Math.sin(a) * R * 0.6);
      b.add(new THREE.CylinderGeometry(R * 0.08, R * 0.17, len, 6, 1, true), P.trunk, leanM(base, a, 1.0, len));
      const tip = base.clone().addScaledVector(leanDir(a, 1.0), len);
      const c2 = C * 0.36;
      const sc = new THREE.SphereGeometry(c2, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
      sc.scale(1, 0.45, 1);
      b.add(sc, P.leaves[0], M(tip.x, tip.y, tip.z, r() * 3));
      b.glow(new THREE.CylinderGeometry(c2 * 1.01, c2 * 1.01, c2 * 0.08, 10, 1, true), rim, M(tip.x, tip.y - 0.02, tip.z));
    }
  }
  const n = big ? 3 : Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const hy = 1.1 + i * 1.2 + r() * 0.6;
    const sa = r() * Math.PI * 2;
    const tr = R * (1 - (0.28 * hy) / (H * 0.5)) - 0.02;
    const s = 0.3 + r() * 0.3;
    const cx = x + Math.cos(sa) * tr;
    const cz = z + Math.sin(sa) * tr;
    b.add(new THREE.CylinderGeometry(s, s * 0.85, s * 0.18, 7, 1, false, 0, Math.PI), i % 2 ? 0x5a3aa8 : 0x3d4ab4, M(cx, y + hy, cz, -sa));
    b.glow(new THREE.CylinderGeometry(s * 0.95, s * 0.8, 0.05, 7, 1, false, 0, Math.PI), i % 2 ? 0xc46aff : COL.cyan, M(cx, y + hy - s * 0.1, cz, -sa));
  }
  ctx.solids.add(x, z, R * 1.2);
}

/**
 * Low-poly glowing mushroom: a slightly tilted stalk, a hemispherical or conical cap, and a ring of glowing gills under the
 * cap (lift must be set first)
 */
export function shroom(b: PropBatch, x: number, z: number, s: number, r: () => number, pointed = false): void {
  const lean = (r() - 0.5) * 0.35;
  const la = r() * Math.PI * 2;
  const cap = SHROOM.caps[Math.floor(r() * SHROOM.caps.length)];
  const glow = SHROOM.glows[Math.floor(r() * SHROOM.glows.length)];
  const stemLen = 0.62 * s;
  const base = V(x, 0, z);
  b.add(new THREE.CylinderGeometry(0.11 * s, 0.17 * s, stemLen, 6, 1, true), SHROOM.stem, leanM(base, la, lean, stemLen));
  const top = base.clone().addScaledVector(leanDir(la, lean), stemLen);
  const cr = 0.42 * s;
  if (pointed) b.add(new THREE.ConeGeometry(cr, cr * 1.3, 8, 1, true), cap, M(top.x, top.y + cr * 0.55, top.z));
  else {
    const g = new THREE.SphereGeometry(cr, 9, 3, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, 0.68, 1);
    b.add(g, cap, M(top.x, top.y - 0.02 * s, top.z, r() * 6));
  }
  b.glow(new THREE.CylinderGeometry(cr * 1.04, cr * 0.7, 0.07 * s, 9), glow, M(top.x, top.y - 0.045 * s, top.z));
}

/** Mushroom ring: a ring of glowing mushrooms of varying sizes */
export function shroomRing(ctx: FieldCtx, cx: number, cz: number, rr: number, n: number): void {
  const { b, r } = ctx;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3;
    const d = rr * (0.85 + r() * 0.3);
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    ctx.place(x, z);
    shroom(b, x, z, 0.5 + r() * 0.9 + (i % 4 === 0 ? 0.8 : 0), r, r() < 0.3);
  }
  b.lift = 0;
}

/** Low-poly bush: a few icosahedra clustered together */
export function shrub(ctx: FieldCtx, x: number, z: number, s: number, cols: number[]): void {
  const { b, r } = ctx;
  const y = ground(ctx, x, z, s * 0.5);
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = s * 0.45 * r();
    const rr = s * (0.45 + r() * 0.3);
    b.add(new THREE.IcosahedronGeometry(rr, 0), cols[i % cols.length], M(x + Math.cos(a) * d, y + rr * 0.7, z + Math.sin(a) * d, r() * 6, 1, 0, r()));
  }
}

/** Mossy rock: a flat patch of moss laid over a rock */
export function mossStone(ctx: FieldCtx, x: number, z: number, s: number, rock: number, moss: number): void {
  const { b, r } = ctx;
  const y = ground(ctx, x, z, s * 0.6);
  shadowsOf(ctx).push({ x, z, r: s * 1.6, amt: 0.5 });
  const ry = r() * 6;
  b.add(new THREE.DodecahedronGeometry(s, 0), rock, M(x, y + s * 0.5, z, ry, 1, 0, (r() - 0.5) * 0.4));
  const g = new THREE.DodecahedronGeometry(s * 0.92, 0);
  g.scale(1, 0.38, 1);
  b.add(g, moss, M(x, y + s * 1.02, z, ry + 0.4));
  ctx.solids.add(x, z, s * 0.9);
}

/** Dead tree: a bleached trunk and twisted dead branches (Unlit Wood) */
export function deadTree(ctx: FieldCtx, x: number, z: number, R: number, H: number): void {
  const { r, b } = ctx;
  const y = ground(ctx, x, z, R);
  shadowsOf(ctx).push({ x, z, r: R * 3, amt: 0.5 });
  const a0 = r() * Math.PI * 2;
  const top = V(x + Math.cos(a0) * H * 0.08, y + H, z + Math.sin(a0) * H * 0.08);
  b.add(new THREE.CylinderGeometry(0.4, 1, 1, 7, 1, true), 0x5a5470, segM(V(x, y - 0.3, z), top, R));
  b.add(new THREE.CylinderGeometry(R, R * 1.5, R * 0.8, 7, 1, true), 0x3e3852, M(x, y + R * 0.3, z, a0));
  for (let i = 0; i < 3; i++) {
    const a = a0 + (i / 3) * Math.PI * 2 + r() * 0.5;
    const len = R * (1.6 + r() * 0.6);
    b.add(new THREE.ConeGeometry(R * 0.4, len, 4), 0x3e3852, leanM(V(x + Math.cos(a) * R * 0.8, y + R, z + Math.sin(a) * R * 0.8), a, 2.2, len, 1, 0.35));
  }
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    const hy = y + H * (0.45 + r() * 0.5);
    const tr = R * (1 - 0.6 * ((hy - y) / H));
    const p0 = V(x + Math.cos(a0) * H * 0.08 * ((hy - y) / H) + Math.cos(a) * tr * 0.5, hy, z + Math.sin(a0) * H * 0.08 * ((hy - y) / H) + Math.sin(a) * tr * 0.5);
    const p1 = p0.clone().add(V(Math.cos(a) * (1.5 + r() * 2), 0.6 + r() * 1.5, Math.sin(a) * (1.5 + r() * 2)));
    const p2 = p1.clone().add(V(Math.cos(a + 0.8) * (0.8 + r()), 0.5 + r(), Math.sin(a + 0.8) * (0.8 + r())));
    b.add(new THREE.CylinderGeometry(0.6, 1, 1, 5, 1, true), 0x5a5470, segM(p0, p1, R * 0.16));
    b.add(new THREE.CylinderGeometry(0.3, 1, 1, 4, 1, true), 0x5a5470, segM(p1, p2, R * 0.09));
  }
  ctx.solids.add(x, z, R * 1.2);
}

/** Crystal cluster: a few glowing crystal columns slanting outward, with two or three dark ones beside them */
export function crystals(ctx: FieldCtx, x: number, z: number, s: number, col: number, dark: number): void {
  const { b, r } = ctx;
  const y = ground(ctx, x, z, s * 0.5);
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * s * 0.5;
    const g = new THREE.OctahedronGeometry(0.4 * s);
    g.scale(0.5, 2.4 + r(), 0.5);
    const m = M(x + Math.cos(a) * d, y + 0.5 * s, z + Math.sin(a) * d, a, 0.6 + r() * 0.6, 0, (r() - 0.5) * 0.9);
    if (i < 2) b.glow(g, col, m);
    else b.add(g, dark, m);
  }
  ctx.solids.add(x, z, s * 0.6);
}

/** Stalagmite: two or three stacked cones */
export function stalagmite(ctx: FieldCtx, x: number, z: number, s: number, col = COL.rock): void {
  const { b, r } = ctx;
  const y = ground(ctx, x, z, s * 0.6);
  shadowsOf(ctx).push({ x, z, r: s * 1.5, amt: 0.45 });
  b.add(new THREE.ConeGeometry(s * 0.7, s * 3.2, 7), col, M(x, y + s * 1.5, z, r() * 3));
  for (let i = 0; i < 2; i++) {
    const a = r() * Math.PI * 2;
    const hh = s * (1 + r() * 1.4);
    b.add(new THREE.ConeGeometry(s * 0.35, hh, 6), col, M(x + Math.cos(a) * s * 0.7, y + hh / 2 - 0.1, z + Math.sin(a) * s * 0.7, r() * 3, 1, 0, (r() - 0.5) * 0.3));
  }
  ctx.solids.add(x, z, s * 0.75);
}

/** Cocoon: a silvery-white elongated oval, hanging from silk or heaped on the ground */
export function cocoon(ctx: FieldCtx, p: THREE.Vector3, s: number, hang: number): void {
  const { b } = ctx;
  const g = new THREE.SphereGeometry(0.34 * s, 9, 7);
  g.scale(1, 1.8, 1);
  b.add(g, 0xd6d2ec, M(p.x, p.y, p.z, 0, 1, 0, (Math.sin(p.x * 3) * 0.2)));
  for (let i = 0; i < 3; i++) b.add(new THREE.TorusGeometry(0.3 * s, 0.025 * s, 3, 10), 0xb8b4d8, M(p.x, p.y - 0.25 * s + i * 0.25 * s, p.z, 0, 1 - Math.abs(i - 1) * 0.12, Math.PI / 2), false);
  if (hang > 0) b.glow(cyl(1, 1, 1, 3), COL.silk, segM(V(p.x, p.y + 0.55 * s, p.z), V(p.x, p.y + 0.55 * s + hang, p.z), 0.012));
}

/** Moonbell flower: a small clump of thin stalks topped with pale blue and pale purple small glowing balls */
export function moonbells(ctx: FieldCtx, x: number, z: number, n: number, yOff = 0): void {
  const { b, r } = ctx;
  const y = ground(ctx, x, z);
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * 1.3;
    const pz = z + (r() - 0.5) * 1.3;
    const hh = 0.3 + r() * 0.35;
    const py = (yOff ? y : y + (ctx.h(px, pz) - y) * 0.8) + yOff;
    b.add(new THREE.CylinderGeometry(0.015, 0.02, hh, 3, 1, true), 0x3a5a6a, M(px, py + hh / 2, pz), false);
    b.glow(new THREE.OctahedronGeometry(0.06 + r() * 0.03), i % 3 ? 0x9ad8ff : 0xc8a8ff, M(px, py + hh + 0.03, pz));
  }
}
