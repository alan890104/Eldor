// Highland natural props: wind-bent flag trees, shrubs stretched downwind, wind-eroded rocks and stone-forest pillars,
// natural stone arches, dandelion clumps, Wing Folk waymarker cairns, dry-stone walls, and rope fences hung with feather flags.
// All follow the same wind (WX, WZ).

import * as THREE from 'three';
import { M, MS } from '../../../arenaKit.ts';
import { catenary, segM, V } from '../../../arenas/_woods.ts';
import type { FieldCtx, XZ } from '../../kit.ts';
import type { Anim } from './anim.ts';
import { banner } from './fx.ts';
import { WX, WZ } from './shape.ts';

/** Horizontal angle the wind blows toward (the ry for M(): makes the object's +z axis face downwind) */
export const WIND_RY = Math.atan2(WX, WZ);

// Shared indexed geometry (PropBatch copies it into a non-indexed version, so it can be reused)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 6);
const CYL4 = new THREE.CylinderGeometry(1, 1, 1, 4);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const SPH = new THREE.SphereGeometry(1, 8, 6);

export const C = {
  trunk: 0x7a5a40,
  bark: 0x5e4432,
  leaves: [0x5f9e50, 0x72b25a, 0x4e8c48],
  leavesDry: [0x8aa858, 0x9cb864, 0x7a9a50],
  rock: 0xb3a58e,
  rockDark: 0x8f8374,
  rockLight: 0xd3c6ac,
  stone: 0xc9c0ae,
  wood: 0x8a6a48,
  woodDark: 0x5e4634,
  rope: 0x6a5642,
  cloth: [0x3fb2c9, 0xf6f1e6, 0xf7c95c, 0x86d1e6, 0xf2a3b8],
};

const col = (c: number) => new THREE.Color(c);

// ───────────────────────── Plants ─────────────────────────

/** Flag tree: the trunk leans downwind and all the foliage grows on the leeward side, like a flag held out by the wind */
export function windTree(ctx: FieldCtx, x: number, z: number, s: number, leaves = C.leaves): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.4 * s);
  const lean = 0.35 + r() * 0.35;
  const pts = [V(x, -0.2, z)];
  const segs = 3;
  for (let i = 0; i < segs; i++) {
    const p = pts[i];
    const up = (1.25 - i * 0.2) * s;
    pts.push(V(p.x + WX * lean * (i + 1) * 0.42 * s + (r() - 0.5) * 0.15 * s, p.y + up, p.z + WZ * lean * (i + 1) * 0.42 * s + (r() - 0.5) * 0.15 * s));
  }
  for (let i = 0; i < segs; i++) b.add(CYL, C.trunk, segM(pts[i], pts[i + 1], (0.26 - i * 0.06) * s));
  // Branches on the leeward side
  const top = pts[segs];
  const mid = pts[1].clone().lerp(pts[2], 0.5);
  const br = V(mid.x + WX * 1.4 * s, mid.y + 0.4 * s, mid.z + WZ * 1.4 * s);
  b.add(CYL, C.trunk, segM(mid, br, 0.08 * s));
  // Crown: spreads out downwind, getting smaller farther downwind
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const cx = top.x + WX * (k * 2.1 - 0.3) * s + (r() - 0.5) * 0.4 * s;
    const cz = top.z + WZ * (k * 2.1 - 0.3) * s + (r() - 0.5) * 0.4 * s;
    const cy = top.y + (0.2 - k * 0.55) * s + (r() - 0.5) * 0.3 * s;
    const ss = (1.15 - k * 0.45) * s;
    b.add(new THREE.IcosahedronGeometry(1, 1), leaves[i % leaves.length], MS(cx, cy, cz, ss * 1.1, ss * 0.62, ss * 0.85, WIND_RY + (r() - 0.5) * 0.4));
  }
  b.add(new THREE.IcosahedronGeometry(1, 1), leaves[1], MS(br.x, br.y, br.z, 0.75 * s, 0.45 * s, 0.6 * s, WIND_RY));
  ctx.solids.add(x + WX * 0.3 * s, z + WZ * 0.3 * s, 0.38 * s);
}

/** A low shrub stretched downwind */
export function windShrub(ctx: FieldCtx, x: number, z: number, s: number, leaves = C.leaves): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.4 * s);
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const k = i / Math.max(1, n - 1);
    const ss = s * (0.8 - k * 0.3);
    b.add(new THREE.IcosahedronGeometry(1, 1), leaves[i % leaves.length], MS(x + WX * k * 0.9 * s, ss * 0.42, z + WZ * k * 0.9 * s, ss * 0.8, ss * 0.55, ss * 1.25, WIND_RY + (r() - 0.5) * 0.3));
  }
}

/** A dandelion clump: white puffballs and a few yellow flowers that have not gone to seed */
export function dandelions(ctx: FieldCtx, x: number, z: number, n: number): void {
  const { b, r } = ctx;
  ctx.place(x, z);
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * 1.8;
    const pz = z + (r() - 0.5) * 1.8;
    const h = 0.35 + r() * 0.45;
    const lean = 0.08 + r() * 0.1;
    const top = V(px + WX * lean, h, pz + WZ * lean);
    b.add(CYL4, 0x5f9448, segM(V(px, 0, pz), top, 0.018), false);
    if (r() < 0.8) b.add(new THREE.IcosahedronGeometry(0.11 + r() * 0.05, 1), 0xfbfaf2, M(top.x, top.y + 0.06, top.z), false);
    else b.add(new THREE.IcosahedronGeometry(0.08, 0), 0xffd24a, M(top.x, top.y + 0.03, top.z), false);
  }
}

/** A small clump of wildflowers (the highland's blue, white and yellow) */
export function wildflowers(ctx: FieldCtx, x: number, z: number, n: number, cols: number[]): void {
  const { b, r } = ctx;
  ctx.place(x, z);
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * 1.6;
    const pz = z + (r() - 0.5) * 1.6;
    const h = 0.2 + r() * 0.2;
    b.add(CYL4, 0x5a8a44, M(px, h / 2, pz, 0, 1).multiply(new THREE.Matrix4().makeScale(0.015, h, 0.015)), false);
    b.add(new THREE.IcosahedronGeometry(0.075, 0), cols[i % cols.length], M(px, h + 0.03, pz), false);
  }
}

// ───────────────────────── Rocks ─────────────────────────

/** Wind-eroded rock: a rock block rounded on the windward face and stretched downwind */
export function windRock(ctx: FieldCtx, x: number, z: number, s: number, rock = C.rock): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.5 * s);
  const g = new THREE.DodecahedronGeometry(1, 0);
  b.add(g, rock, new THREE.Matrix4().compose(V(x, 0.35 * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 0.3, WIND_RY + (r() - 0.5) * 0.5, r() * 0.3)), V(0.8 * s, 0.6 * s, 1.4 * s)));
  if (r() < 0.5) b.add(new THREE.DodecahedronGeometry(1, 0), C.rockDark, M(x + WX * s * 1.1, 0.15 * s, z + WZ * s * 1.1, r() * 6, 0.45 * s, r(), r()));
  ctx.solids.add(x, z, 0.85 * s);
}

/**
 * Stone-forest pillar: stacked section by section, waist thinned by the wind, leaning further downwind the higher it goes,
 * with a wider cap rock on top; some shafts have a hole blown through them.
 */
export function hoodoo(ctx: FieldCtx, x: number, z: number, h: number, w: number, strata: number[]): void {
  const { b, r } = ctx;
  ctx.place(x, z, w * 0.6);
  const n = Math.max(3, Math.round(h / (w * 1.3)));
  const segH = h / n;
  let y = -0.4;
  let ox = 0;
  let oz = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const ww = w * (1 - t * 0.35) * (0.9 + r() * 0.2);
    const waist = ww * (0.55 + r() * 0.2);
    const c = strata[i % strata.length];
    // Each section: a cut rock block wider at the top (upper half) + a thin waist (lower half)
    b.add(new THREE.CylinderGeometry(waist, ww, segH * 0.45, 7), c, M(x + ox, y + segH * 0.225, z + oz, r() * 6));
    b.add(new THREE.CylinderGeometry(ww * 0.92, waist * 1.05, segH * 0.55, 7), c, M(x + ox, y + segH * 0.72, z + oz, r() * 6));
    y += segH;
    ox += WX * segH * 0.07 * (1 + t);
    oz += WZ * segH * 0.07 * (1 + t);
  }
  // Cap rock
  const cap = new THREE.DodecahedronGeometry(1, 0);
  b.add(cap, C.rockDark, new THREE.Matrix4().compose(V(x + ox + WX * 0.3 * w, y + 0.35 * w, z + oz + WZ * 0.3 * w), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, WIND_RY, 0)), V(w * 1.15, w * 0.45, w * 1.5)));
  // A small tuft of grass on top
  b.add(new THREE.IcosahedronGeometry(1, 1), 0x86b46a, MS(x + ox, y + 0.75 * w, z + oz, w * 0.7, w * 0.18, w * 0.9, WIND_RY));
  ctx.solids.add(x, z, w * 0.95);
}

/** Natural stone arch: two inward-leaning rock pillars + an arch top, walkable underneath */
export function stoneArch(ctx: FieldCtx, x: number, z: number, facing: number, span: number, h: number, strata: number[]): void {
  const { b, r } = ctx;
  ctx.place(x, z, span * 0.5);
  const cx = Math.cos(facing);
  const cz = -Math.sin(facing);
  for (const s of [-1, 1]) {
    const bx = x + cx * s * span * 0.5;
    const bz = z + cz * s * span * 0.5;
    const n = 3;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const a = V(bx - cx * s * span * 0.12 * t0 * t0, t0 * h - 0.3, bz - cz * s * span * 0.12 * t0 * t0);
      const c2 = V(bx - cx * s * span * 0.12 * t1 * t1, t1 * h, bz - cz * s * span * 0.12 * t1 * t1);
      b.add(new THREE.CylinderGeometry(1, 1.15, 1, 7), strata[i % strata.length], segM(a, c2, 1.1 - t0 * 0.25));
    }
    ctx.solids.add(bx, bz, 1.2);
  }
  const arc = new THREE.TorusGeometry(span * 0.42, 0.9, 6, 12, Math.PI);
  b.add(arc, strata[1], M(x, h - 0.2, z, facing));
  b.add(new THREE.DodecahedronGeometry(1, 0), strata[0], MS(x, h + span * 0.42 + 0.4, z, span * 0.35, 0.8, 1.2, facing + r() * 0.2));
}

// ───────────────────────── Wing Folk things ─────────────────────────

/** Waymarker cairn: a stack of flat stones with a feather staff tied with cloth strips stuck in the top */
export function cairn(ctx: FieldCtx, anim: Anim, x: number, z: number, s = 1): void {
  const { b, r } = ctx;
  const g = ctx.place(x, z, 0.5);
  let y = 0;
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const w = (0.55 - i * 0.07) * s;
    const hh = (0.22 + r() * 0.08) * s;
    b.add(new THREE.DodecahedronGeometry(1, 0), i % 2 ? C.rockLight : C.stone, MS(x + (r() - 0.5) * 0.08, y + hh * 0.5, z + (r() - 0.5) * 0.08, w, hh * 0.6, w * 0.9, r() * 6));
    y += hh * 0.85;
  }
  b.add(CYL4, C.woodDark, M(x, y + 0.5 * s, z).multiply(new THREE.Matrix4().makeScale(0.03, 1.1 * s, 0.03)));
  banner(anim.flags, x, g + y + 1.0 * s, z, 0.9 * s, 0.14 * s, [col(C.cloth[r() < 0.5 ? 0 : 2])], r() * 6, 0.5);
  ctx.solids.add(x, z, 0.5 * s);
}

/** Dry-stone wall: a low wall stacked along a polyline (the shepherds' pens and field boundaries) */
export function stoneWall(ctx: FieldCtx, pts: XZ[], hgt = 0.9, cols = [C.stone, C.rockLight, C.rock]): void {
  const { b, r } = ctx;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k];
    const [bx, bz] = pts[k + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 0.55));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      ctx.place(x, z);
      const rows = Math.round(hgt / 0.3);
      for (let j = 0; j < rows; j++) {
        const w = 0.5 + r() * 0.2;
        b.add(BOX, cols[(i + j) % cols.length], new THREE.Matrix4().compose(V(x + (r() - 0.5) * 0.08, 0.15 + j * 0.29, z + (r() - 0.5) * 0.08), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang + (r() - 0.5) * 0.25, (r() - 0.5) * 0.1)), V(0.55 - j * 0.05, 0.28, w)));
      }
      if (i % 2 === 0) ctx.solids.add(x, z, 0.45);
    }
  }
}

/**
 * Rope fence with feather flags: a row of wooden posts with rope strung between them,
 * small feather flags hanging from the rope and drifting downwind
 */
export function flagRail(ctx: FieldCtx, anim: Anim, pts: XZ[], spacing = 3.2, flags = true): void {
  const { b, r } = ctx;
  b.lift = 0;
  const posts: THREE.Vector3[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k];
    const [bx, bz] = pts[k + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / spacing));
    for (let i = k === 0 ? 0 : 1; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n;
      const z = az + ((bz - az) * i) / n;
      const y = ctx.h(x, z);
      b.add(CYL, C.woodDark, M(x, y + 0.55, z).multiply(new THREE.Matrix4().makeScale(0.09, 1.3, 0.09)));
      b.add(SPH, C.cloth[2], M(x, y + 1.25, z).multiply(new THREE.Matrix4().makeScale(0.1, 0.1, 0.1)));
      posts.push(V(x, y + 1.15, z));
      ctx.solids.add(x, z, 0.25);
    }
  }
  for (let i = 0; i < posts.length - 1; i++) {
    const pts2 = catenary(posts[i], posts[i + 1], 0.25, 6);
    for (let k = 0; k < 6; k++) b.add(CYL4, C.rope, segM(pts2[k], pts2[k + 1], 0.025), false);
    if (!flags) continue;
    for (let k = 1; k < 6; k += 2) {
      const p = pts2[k];
      featherFlag(anim, p.x, p.y, p.z, col(C.cloth[Math.floor(r() * C.cloth.length)]), r() * 6);
    }
  }
}

/** Feather-shaped small flag hung on a rope: the flag root hangs at (x, y, z), the flag tip drifts downwind */
export function featherFlag(anim: Anim, x: number, y: number, z: number, c: THREE.Color, phase: number, s = 1): void {
  const L = 0.9 * s;
  const w = 0.2 * s;
  const a: [number, number, number] = [x, y + w * 0.5, z];
  const b2: [number, number, number] = [x, y - w * 0.5, z];
  const m1: [number, number, number] = [x + WX * L * 0.5, y + w * 0.2 - L * 0.2, z + WZ * L * 0.5];
  const m2: [number, number, number] = [x + WX * L * 0.5, y - w * 0.8 - L * 0.2, z + WZ * L * 0.5];
  const tip: [number, number, number] = [x + WX * L, y - L * 0.45, z + WZ * L];
  anim.flags.quad(a, b2, m2, m1, c, [0, 0, 0.5, 0.5], phase);
  anim.flags.tri(m1, m2, tip, c, [0.5, 0.5, 1], phase);
}

/** Flagpole: a long downwind flag on top (the Wing Folk's feather flag) */
export function flagPole(ctx: FieldCtx, anim: Anim, x: number, z: number, h: number, cols: number[], len = 3.2, fork = true): void {
  const { b, r } = ctx;
  const g = ctx.place(x, z);
  b.add(CYL, C.woodDark, M(x, h / 2 - 0.2, z).multiply(new THREE.Matrix4().makeScale(0.1, h + 0.4, 0.1)));
  b.add(SPH, C.cloth[2], M(x, h + 0.1, z).multiply(new THREE.Matrix4().makeScale(0.16, 0.16, 0.16)));
  banner(anim.flags, x, g + h - 0.1, z, len, 0.7 * (len / 3.2), cols.map(col), r() * 6, 0.7, fork);
  ctx.solids.add(x, z, 0.25);
}

/** Wooden post with a lamp: a crossarm at the top holds up a storm lantern */
export function windLamp(ctx: FieldCtx, glow: { add: (g: THREE.BufferGeometry, m: THREE.Matrix4) => void }, x: number, z: number, facing: number, post = C.woodDark, cap = 0x3f8fae): void {
  const { b } = ctx;
  ctx.place(x, z);
  b.add(CYL, post, M(x, 1.35, z).multiply(new THREE.Matrix4().makeScale(0.09, 2.7, 0.09)));
  const ax = x + Math.sin(facing) * 0.55;
  const az = z + Math.cos(facing) * 0.55;
  b.add(BOX, post, M((x + ax) / 2, 2.6, (z + az) / 2, facing).multiply(new THREE.Matrix4().makeScale(0.06, 0.06, 0.6)));
  b.add(new THREE.ConeGeometry(0.2, 0.18, 6), cap, M(ax, 2.38, az));
  glow.add(new THREE.CylinderGeometry(0.11, 0.13, 0.26, 6), M(ax, 2.18, az).premultiply(new THREE.Matrix4().makeTranslation(0, ctx.b.lift, 0)));
  b.add(new THREE.CylinderGeometry(0.14, 0.12, 0.05, 6), cap, M(ax, 2.03, az));
  ctx.solids.add(x, z, 0.25);
}
