// Dawnlight Holy City building parts: white stone columns, balustrades, holy candle lamps, the Outer City's white-walled
// blue-roofed houses, the domed chapel, angel statues, fountains, the Cathedral (rose window, triple arch, flying buttresses,
// twin towers and spires), the Belfry, the triumphal arch, the obelisk, cypresses, flowering trees and hedges.
// All assembled in local coordinates: frame() first lifts the prop to the ground, then returns a function that turns a local
// matrix into a world matrix.

import * as THREE from 'three';
import { M, MS } from '../../../arenaKit.ts';
import type { FieldCtx, XZ } from '../../kit.ts';

/**
 * Fixed colors of the holy city: white stone is never pure white (so bloom does not smear it
 * into one blur), gold is the accent
 */
export const C = {
  stone: 0xdcd3c1,
  stoneDark: 0xb9ad96,
  wall: 0xe9e3d6,
  marble: 0xf0ece4,
  gold: 0xe2b34a,
  goldDeep: 0xc79634,
  glow: 0xffd45a,
  warm: 0xffc46a,
  door: 0x4a4670,
  roof: 0x8ea3cc,
  roof2: 0x7b90c0,
  roofTeal: 0x86b4b8,
  cypress: 0x4f7f5a,
  cypress2: 0x5f9064,
  hedge: 0x629656,
  hedge2: 0x578a4d,
  blossom: [0xfbeef2, 0xf6d8e4, 0xfff4e6],
  goldLeaf: [0xf2d27a, 0xe8bf5a, 0xf7e2a0],
  trunk: 0x9a7a62,
  rock: 0xd9d0c2,
  rock2: 0xc4b9a8,
  cloud: 0xfbf7f0,
  cloudShade: 0xe9e3ef,
  flower: [0xffffff, 0xffe27a, 0xffb8cf, 0xc8b4ff, 0xfff1b8],
};

export type At = (L: THREE.Matrix4) => THREE.Matrix4;

/**
 * Lifts the props that follow to the ground at (x, z) (the lowest point within spread), and returns
 * local coordinates -> world coordinates
 */
export function frame(ctx: FieldCtx, x: number, z: number, face: number, spread = 0, y?: number): At {
  if (y === undefined) ctx.place(x, z, spread);
  else ctx.b.lift = y;
  const T = M(x, 0, z, face);
  return (L) => T.clone().multiply(L);
}

/** Local (lx, lz) to world coordinates (face is a rotation about the Y axis) */
export function toWorld(x: number, z: number, face: number, lx: number, lz: number): XZ {
  const c = Math.cos(face);
  const s = Math.sin(face);
  return [x + c * lx + s * lz, z - s * lx + c * lz];
}

/** Covers a local rectangle with a row of round colliders (center lx, lz, width w (local x), depth d (local z)) */
export function solidRect(ctx: FieldCtx, x: number, z: number, face: number, lx: number, lz: number, w: number, d: number): void {
  const r = Math.min(w, d) / 2;
  const L = Math.max(w, d);
  const n = Math.max(1, Math.ceil((L - 2 * r) / (r * 0.9)) + 1);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * (L - 2 * r);
    const [wx, wz] = toWorld(x, z, face, lx + (w >= d ? t : 0), lz + (w >= d ? 0 : t));
    ctx.solids.add(wx, wz, r * 1.08);
  }
}

const Box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const Cyl = (a: number, b: number, h: number, n = 10) => new THREE.CylinderGeometry(a, b, h, n);

/** Triangular-prism roof: the ridge runs along local z, the base at y = 0 and the ridge at y = h */
export function prism(len: number, w: number, h: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  g.rotateX(Math.PI / 2);
  g.rotateZ(Math.PI);
  g.scale(w / 2 / 0.866, h / 1.5, len);
  g.translate(0, h / 3, 0);
  return g;
}

/** Hip roof (square pyramid): base at y = 0 */
export function hipRoof(w: number, d: number, h: number): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(1, 1, 4, 1);
  g.rotateY(Math.PI / 4);
  g.scale(w / Math.SQRT2, h, d / Math.SQRT2);
  g.translate(0, h / 2, 0);
  return g;
}

// ───────────────────────── Columns, balustrades, lamps ─────────────────────────

/** White stone column (base, shaft, capital); total height h + 1.2 */
export function column(ctx: FieldCtx, at: At, x: number, y: number, z: number, h: number, r = 0.34, col = C.wall): void {
  const b = ctx.b;
  b.add(Box(r * 3.3, 0.32, r * 3.3), C.stoneDark, at(M(x, y + 0.16, z)));
  b.add(Cyl(r * 1.35, r * 1.5, 0.24, 12), C.stone, at(M(x, y + 0.44, z)));
  b.add(Cyl(r, r * 1.08, h, 10), col, at(M(x, y + 0.56 + h / 2, z)));
  b.add(Cyl(r * 1.55, r, 0.4, 10), C.stone, at(M(x, y + 0.56 + h + 0.2, z)));
  b.add(Box(r * 3.3, 0.26, r * 3.3), C.stoneDark, at(M(x, y + 0.56 + h + 0.53, z)));
}

export interface RailOpts {
  /** Balustrade post spacing */
  spacing?: number;
  /** A square pier every this many meters (0 = none) */
  pier?: number;
  /** The gold ball atop a pier glows */
  glowPier?: boolean;
  /** Add colliders along the line */
  solid?: boolean;
  /** Push the railing toward one side (along the normal, in meters) */
  y?: (x: number, z: number) => number;
}

/**
 * White stone balustrade: short posts + handrail + base along a polyline (world coordinates),
 * with a square pier every so often
 */
export function balustrade(ctx: FieldCtx, pts: XZ[], o: RailOpts = {}): void {
  const { b } = ctx;
  const sp = o.spacing ?? 0.55;
  const hy = o.y ?? ((x: number, z: number) => ctx.h(x, z));
  b.lift = 0;
  let acc = 0;
  let nextPost = 0;
  let nextPier = o.pier ? o.pier * 0.5 : Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [cx, cz] = pts[i + 1];
    const len = Math.hypot(cx - ax, cz - az);
    if (len < 1e-3) continue;
    const ya = hy(ax, az);
    const yc = hy(cx, cz);
    const ry = Math.atan2(-(cz - az), cx - ax);
    const rz = Math.atan2(yc - ya, len);
    const mx = (ax + cx) / 2;
    const mz = (az + cz) / 2;
    const my = (ya + yc) / 2;
    b.add(Box(len + 0.06, 0.2, 0.42), C.stoneDark, M(mx, my + 0.02, mz, ry, 1, 0, rz));
    b.add(Box(len + 0.06, 0.13, 0.34), C.stone, M(mx, my + 0.86, mz, ry, 1, 0, rz));
    while (nextPost <= acc + len) {
      const t = (nextPost - acc) / len;
      const x = ax + (cx - ax) * t;
      const z = az + (cz - az) * t;
      const y = ya + (yc - ya) * t;
      if (nextPier <= nextPost + sp * 0.5) {
        b.add(Box(0.5, 1.12, 0.5), C.stone, M(x, y + 0.56, z, ry));
        b.add(Box(0.62, 0.12, 0.62), C.stoneDark, M(x, y + 1.14, z, ry));
        if (o.glowPier) b.glow(new THREE.OctahedronGeometry(0.13), C.glow, M(x, y + 1.33, z));
        else b.add(new THREE.SphereGeometry(0.14, 8, 6), C.gold, M(x, y + 1.3, z), false);
        nextPier += o.pier!;
      } else {
        b.add(Cyl(0.075, 0.11, 0.68, 6), C.marble, M(x, y + 0.46, z), false);
      }
      if (o.solid) ctx.solids.add(x, z, 0.4);
      nextPost += sp;
    }
    acc += len;
  }
}

/** Holy candle lamp: white stone base, thin gold post, warm light inside a gold cage, a small gold crown on top */
export function lamp(ctx: FieldCtx, x: number, z: number, h = 3.2, y?: number): void {
  const { b } = ctx;
  const at = frame(ctx, x, z, 0, 0, y);
  b.add(Box(0.55, 0.45, 0.55), C.stoneDark, at(M(0, 0.2, 0)));
  b.add(Cyl(0.07, 0.1, h, 6), C.gold, at(M(0, 0.4 + h / 2, 0)));
  b.add(Cyl(0.26, 0.2, 0.1, 8), C.goldDeep, at(M(0, 0.4 + h, 0)));
  const g = new THREE.SphereGeometry(0.2, 8, 6);
  g.scale(1, 1.3, 1);
  b.glow(g, C.warm, at(M(0, 0.4 + h + 0.3, 0)));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.add(Cyl(0.02, 0.02, 0.6, 3), C.gold, at(M(Math.cos(a) * 0.24, 0.4 + h + 0.32, Math.sin(a) * 0.24)), false);
  }
  b.add(new THREE.ConeGeometry(0.32, 0.36, 8), C.gold, at(M(0, 0.4 + h + 0.8, 0)));
  b.glow(new THREE.OctahedronGeometry(0.08), C.glow, at(M(0, 0.4 + h + 1.05, 0)));
  if (y === undefined) ctx.solids.add(x, z, 0.35);
}

// ───────────────────────── Outer City houses ─────────────────────────

export interface HouseOpts {
  w: number;
  d: number;
  h: number;
  roof?: number;
  /** Corner round tower: -1 front left, 1 front right */
  turret?: -1 | 1;
  /** Small dome at the center of the roof (gold or blue) */
  dome?: number;
  /** Flower box on the second-floor balcony */
  flowers?: boolean;
}

/**
 * Outer City white-walled house: stone plinth, string course, gold-trimmed eaves, blue-tiled hip roof,
 * arched door and windows (the windows glow warm)
 */
export function townhouse(ctx: FieldCtx, x: number, z: number, face: number, o: HouseOpts): void {
  const { b, r } = ctx;
  const { w, d, h } = o;
  const at = frame(ctx, x, z, face, Math.max(w, d) * 0.5);
  const y = 0.3;
  b.add(Box(w + 0.6, 1.2, d + 0.6), C.stoneDark, at(M(0, -0.3, 0)));
  b.add(Box(w, h, d), C.wall, at(M(0, y + h / 2, 0)));
  if (h > 5) b.add(Box(w + 0.16, 0.2, d + 0.16), C.stone, at(M(0, y + h * 0.5, 0)));
  b.add(Box(w + 0.5, 0.36, d + 0.5), C.stoneDark, at(M(0, y + h + 0.1, 0)));
  b.add(Box(w + 0.56, 0.08, d + 0.56), C.gold, at(M(0, y + h - 0.12, 0)), false);
  const rh = Math.min(w, d) * 0.5 + 0.6;
  b.add(hipRoof(w + 0.9, d + 0.9, rh), o.roof ?? C.roof, at(M(0, y + h + 0.28, 0)));
  b.add(new THREE.SphereGeometry(0.16, 8, 6), C.gold, at(M(0, y + h + 0.28 + rh, 0)), false);
  if (o.dome !== undefined) {
    const dr = Math.min(w, d) * 0.28;
    b.add(Cyl(dr, dr, 1.0, 14), C.wall, at(M(0, y + h + rh * 0.55 + 0.5, 0)));
    b.add(new THREE.SphereGeometry(dr * 1.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), o.dome, at(M(0, y + h + rh * 0.55 + 1.0, 0)));
    b.glow(new THREE.OctahedronGeometry(0.18), C.glow, at(M(0, y + h + rh * 0.55 + 1.2 + dr, 0)));
  }
  // Door
  b.add(Box(1.2, 2.1, 0.14), C.door, at(M(0, y + 1.05, d / 2 + 0.02)), false);
  b.add(new THREE.CircleGeometry(0.6, 10, 0, Math.PI), C.door, at(M(0, y + 2.1, d / 2 + 0.035)), false);
  b.add(new THREE.TorusGeometry(0.68, 0.09, 5, 12, Math.PI), C.gold, at(M(0, y + 2.1, d / 2 + 0.06)), false);
  b.add(Box(1.9, 0.2, 0.9), C.stone, at(M(0, 0.1, d / 2 + 0.4)));
  // Windows: two on each side of the front, one or two on the sides; with two floors, a whole row on the second floor
  const floors = h > 5 ? 2 : 1;
  const win = (lx: number, ly: number, lz: number, ry: number) => {
    const T = at(M(lx, ly, lz, ry));
    b.glow(Box(0.64, 1.0, 0.06), C.warm, T.clone().multiply(M(0, 0, 0)));
    b.glow(new THREE.CircleGeometry(0.32, 8, 0, Math.PI), C.warm, T.clone().multiply(M(0, 0.5, 0.035)));
    b.add(Box(0.9, 0.12, 0.2), C.stoneDark, T.clone().multiply(M(0, -0.58, 0.06)));
  };
  for (let f = 0; f < floors; f++) {
    const wy = y + 1.4 + f * (h * 0.5);
    const nx = Math.max(1, Math.floor(w / 2.2));
    for (let i = 0; i < nx; i++) {
      const lx = -w / 2 + (w / nx) * (i + 0.5);
      if (f === 0 && Math.abs(lx) < 1.1) continue;
      win(lx, wy, d / 2 + 0.03, 0);
      // Windows on the back too (many houses have their backs to the plaza and face the sea of clouds)
      win(lx, wy, -d / 2 - 0.03, Math.PI);
      if (f === 1 && o.flowers) {
        b.add(Box(0.9, 0.3, 0.36), C.stoneDark, at(M(lx, wy - 0.7, d / 2 + 0.22)));
        for (let k = 0; k < 3; k++) b.add(new THREE.IcosahedronGeometry(0.17, 0), C.flower[(i + k) % C.flower.length], at(M(lx - 0.28 + k * 0.28, wy - 0.45, d / 2 + 0.26)), false);
      }
    }
    const nz = Math.max(1, Math.floor(d / 2.6));
    for (let i = 0; i < nz; i++) {
      const lz = -d / 2 + (d / nz) * (i + 0.5);
      win(w / 2 + 0.03, wy, lz, Math.PI / 2);
      win(-w / 2 - 0.03, wy, lz, -Math.PI / 2);
    }
  }
  // Blue and white drapes on the walls
  if (r() < 0.5) {
    b.add(Box(0.7, 1.8, 0.05), 0x6f86c4, at(M(-w / 2 + 0.6, y + h - 1.2, d / 2 + 0.05)), false);
    b.add(Box(0.7, 0.14, 0.06), C.gold, at(M(-w / 2 + 0.6, y + h - 2.1, d / 2 + 0.06)), false);
  }
  if (o.turret) {
    const tx = (o.turret * w) / 2;
    const tz = d / 2;
    const th = h + 2.6;
    b.add(Cyl(1.15, 1.25, th, 12), C.wall, at(M(tx, th / 2, tz)));
    b.add(new THREE.TorusGeometry(1.2, 0.1, 5, 16), C.stoneDark, at(M(tx, th, tz, 0, 1, Math.PI / 2)));
    b.add(new THREE.ConeGeometry(1.55, 3.4, 12), o.roof ?? C.roof, at(M(tx, th + 1.7, tz)));
    b.add(Cyl(0.03, 0.05, 1.0, 4), C.gold, at(M(tx, th + 3.8, tz)));
    b.glow(new THREE.OctahedronGeometry(0.14), C.glow, at(M(tx, th + 4.35, tz)));
    b.glow(Box(0.3, 1.1, 0.1), C.warm, at(M(tx + o.turret * 0.3, th - 2.2, tz + 1.12, o.turret * 0.3)));
  }
  solidRect(ctx, x, z, face, 0, 0, w + 0.7, d + 0.7);
  if (o.turret) {
    const [wx, wz] = toWorld(x, z, face, (o.turret * w) / 2, d / 2);
    ctx.solids.add(wx, wz, 1.35);
  }
}

// ───────────────────────── Statues and fountains ─────────────────────────

/** Angel statue (facing local +z): robe, two wings, halo, raising a glowing holy orb high; about 3.4 * s tall */
export function angel(ctx: FieldCtx, at: At, x: number, y: number, z: number, ry: number, s = 1, orb = true): void {
  const { b } = ctx;
  const T = (L: THREE.Matrix4) => at(M(x, y, z, ry, s).multiply(L));
  b.add(new THREE.ConeGeometry(0.55, 2.0, 12), C.marble, T(M(0, 1.0, 0)));
  b.add(Cyl(0.19, 0.28, 0.62, 10), C.marble, T(M(0, 2.2, 0)));
  b.add(new THREE.SphereGeometry(0.2, 12, 8), C.marble, T(M(0, 2.66, 0.02)));
  for (const sd of [-1, 1]) {
    const wing = new THREE.SphereGeometry(1, 10, 8);
    wing.scale(0.09, 0.95, 0.42);
    b.add(wing, C.marble, T(M(sd * 0.42, 2.35, -0.3, sd * 0.5, 1, 0.15, -sd * 0.45)));
    const wing2 = new THREE.SphereGeometry(1, 8, 6);
    wing2.scale(0.08, 0.6, 0.3);
    b.add(wing2, C.marble, T(M(sd * 0.62, 1.75, -0.36, sd * 0.4, 1, 0.1, -sd * 0.7)));
    // The raised arm
    b.add(Cyl(0.06, 0.07, 0.8, 5), C.marble, T(M(sd * 0.2, 2.8, 0.05, 0, 1, 0, -sd * 0.25)));
  }
  b.glow(new THREE.TorusGeometry(0.24, 0.03, 4, 16), C.glow, T(M(0, 2.98, -0.05, 0, 1, Math.PI / 2 - 0.25)));
  if (orb) b.glow(new THREE.SphereGeometry(0.24, 12, 8), C.glow, T(M(0, 3.35, 0.05)));
}

/** Angel statue on a pedestal (collides) */
export function statue(ctx: FieldCtx, x: number, z: number, ry: number, s = 1): void {
  const { b } = ctx;
  const at = frame(ctx, x, z, 0, 0.8);
  b.add(Box(1.5 * s, 0.4, 1.5 * s), C.stoneDark, at(M(0, 0.1, 0)));
  b.add(Box(1.1 * s, 1.6 * s, 1.1 * s), C.stone, at(M(0, 0.3 + 0.8 * s, 0)));
  b.add(Box(1.35 * s, 0.22, 1.35 * s), C.stoneDark, at(M(0, 0.3 + 1.6 * s, 0)));
  b.add(Box(1.14 * s, 0.08, 1.14 * s), C.gold, at(M(0, 0.3 + 1.1 * s, 0)), false);
  angel(ctx, at, 0, 0.42 + 1.6 * s, 0, ry, s * 0.9);
  ctx.solids.add(x, z, 0.9 * s);
}

// ───────────────────────── Trees and hedges ─────────────────────────

/** Cypress: a slender, tall, dark green flame shape */
export function cypress(ctx: FieldCtx, x: number, z: number, h: number, solid = true): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.3);
  const col = r() < 0.5 ? C.cypress : C.cypress2;
  b.add(Cyl(0.12, 0.16, 0.8, 5), C.trunk, M(x, 0.4, z));
  const g = new THREE.SphereGeometry(1, 8, 10);
  g.scale(0.62 + h * 0.03, h * 0.5, 0.62 + h * 0.03);
  b.add(g, col, M(x, 0.6 + h * 0.5, z, r() * 6));
  const tip = new THREE.ConeGeometry(0.34 + h * 0.02, h * 0.34, 7);
  b.add(tip, col, M(x, 0.6 + h * 0.86, z, r() * 6));
  if (solid) ctx.solids.add(x, z, 0.55);
}

/**
 * Flowering tree: a slightly bent trunk, two branches, the crown a dome piled up from rings of small
 * flower clusters (white, pink or gold)
 */
export function flowerTree(ctx: FieldCtx, x: number, z: number, s: number, cols: number[], solid = true): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.4 * s);
  const la = r() * Math.PI * 2;
  const lean = 0.08 + r() * 0.12;
  const th = 2.3 * s;
  b.add(Cyl(0.13 * s, 0.24 * s, th, 7), C.trunk, M(x, th / 2, z, -la, 1, 0, lean));
  const tx = x - Math.sin(lean) * Math.cos(la) * th * 0.5;
  const tz = z + Math.sin(lean) * Math.sin(la) * th * 0.5;
  for (let i = 0; i < 2; i++) {
    const a = la + (i ? 2.3 : -0.9);
    b.add(Cyl(0.06 * s, 0.1 * s, 1.3 * s, 5), C.trunk, M(tx + Math.cos(a) * 0.35 * s, th * 0.92, tz + Math.sin(a) * 0.35 * s, -a, 1, 0, 0.75));
  }
  const cy = th + 0.5 * s;
  const puff = (px: number, py: number, pz: number, rr: number, col: number) => {
    const g = new THREE.IcosahedronGeometry(rr, 1);
    g.scale(1, 0.8, 1);
    b.add(g, col, M(px, py, pz, r() * 6));
  };
  puff(tx, cy + 0.7 * s, tz, 1.05 * s, cols[0]);
  const n = 5 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5;
    const d = (1.05 + r() * 0.25) * s;
    puff(tx + Math.cos(a) * d, cy + (r() - 0.3) * 0.4 * s, tz + Math.sin(a) * d, (0.7 + r() * 0.2) * s, cols[(i + 1) % cols.length]);
  }
  for (let i = 0; i < 2; i++) {
    const a = r() * Math.PI * 2;
    puff(tx + Math.cos(a) * 1.5 * s, cy - 0.55 * s, tz + Math.sin(a) * 1.5 * s, 0.48 * s, cols[i % cols.length]);
  }
  if (solid) ctx.solids.add(x, z, 0.45 * s);
}

/** Neatly trimmed hedge (along a -> c) */
export function hedge(ctx: FieldCtx, a: XZ, c: XZ, h = 0.9, w = 0.9, solid = false): void {
  const { b } = ctx;
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const n = Math.max(1, Math.round(len / 3));
  const ry = Math.atan2(-(c[1] - a[1]), c[0] - a[0]);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = a[0] + (c[0] - a[0]) * t;
    const z = a[1] + (c[1] - a[1]) * t;
    ctx.place(x, z, len / n / 2);
    b.add(Box(len / n + 0.02, h, w), i % 2 ? C.hedge : C.hedge2, M(x, h / 2 - 0.05, z, ry));
    if (solid) ctx.solids.add(x, z, w * 0.6);
  }
}

/** Stone bench */
export function bench(ctx: FieldCtx, x: number, z: number, ry: number): void {
  const { b } = ctx;
  const at = frame(ctx, x, z, ry, 0.8);
  b.add(Box(2.0, 0.14, 0.6), C.stone, at(M(0, 0.5, 0)));
  for (const s of [-0.75, 0.75]) b.add(Box(0.3, 0.45, 0.5), C.stoneDark, at(M(s, 0.22, 0)));
  ctx.solids.add(x, z, 0.8);
}

// ───────────────────────── Cathedral ─────────────────────────

/** One arch segment: a dark doorway + gold columns + a semicircular arch, with warm light showing through */
function portal(ctx: FieldCtx, at: At, x: number, y: number, z: number, w: number, h: number, lit: boolean): void {
  const { b } = ctx;
  const r = w / 2;
  b.add(Box(w, h, 0.5), C.door, at(M(x, y + h / 2, z - 0.2)), false);
  b.add(new THREE.CircleGeometry(r, 16, 0, Math.PI), C.door, at(M(x, y + h, z + 0.06)), false);
  for (const s of [-1, 1]) b.add(Cyl(0.16, 0.16, h, 8), C.gold, at(M(x + s * (r + 0.12), y + h / 2, z + 0.12)));
  b.add(new THREE.TorusGeometry(r + 0.12, 0.18, 8, 18, Math.PI), C.gold, at(M(x, y + h, z + 0.12)));
  b.add(new THREE.TorusGeometry(r + 0.5, 0.16, 6, 18, Math.PI), C.stoneDark, at(M(x, y + h, z + 0.05)));
  b.add(new THREE.ConeGeometry(r + 0.9, r * 1.5, 3), C.wall, at(M(x, y + h + r + 0.55, z - 0.1, 0, 1, 0, 0)).multiply(MS(0, 0, 0, 1, 1, 0.25)));
  if (lit) b.glow(Box(w * 0.5, h * 0.84, 0.08), C.warm, at(M(x, y + h * 0.42, z + 0.12)));
}

/** Cathedral: the front faces local +z; returns the height of the spire tip */
export function cathedral(ctx: FieldCtx, x: number, z: number, face: number): void {
  const { b } = ctx;
  const at = frame(ctx, x, z, face, 15);
  const Y = 1.3;
  // Plinth and the main stair at the front
  b.add(Box(34, Y + 3, 38), C.stoneDark, at(M(0, Y / 2 - 1.5, -5.5)));
  b.add(Box(34.4, 0.22, 38.4), C.stone, at(M(0, Y, -5.5)), false);
  // Plinth sides: a cornice and a row of pilasters, so it is not one blank wall
  b.add(Box(34.5, 0.3, 38.5), C.stone, at(M(0, Y - 0.34, -5.5)), false);
  for (let lz = -23; lz <= 12; lz += 3.5) for (const s of [-1, 1]) b.add(Box(0.3, Y + 1.2, 0.7), C.stone, at(M(s * 17.08, Y / 2 - 0.9, lz)), false);
  for (let lx = -14; lx <= 14; lx += 3.5) b.add(Box(0.7, Y + 1.2, 0.3), C.stone, at(M(lx, Y / 2 - 0.9, -24.58)), false);
  for (let k = 0; k < 6; k++) {
    const hk = (Y * (k + 1)) / 6;
    b.add(Box(20 - k * 0.6, hk + 0.6, 0.8), C.stone, at(M(0, hk / 2 - 0.3, 17.4 - k * 0.8)));
  }
  // Nave
  const NH = 19;
  b.add(Box(14, NH, 28), C.wall, at(M(0, Y + NH / 2, -2)));
  b.add(Box(14.6, 0.5, 28.4), C.stoneDark, at(M(0, Y + NH, -2)));
  b.add(prism(28.6, 15, 7.5), C.roof, at(M(0, Y + NH + 0.2, -2)));
  b.add(prism(0.8, 14.2, 7.2), C.wall, at(M(0, Y + NH + 0.2, 12.1)));
  b.add(Box(0.3, 0.3, 28.8), C.gold, at(M(0, Y + NH + 7.75, -2)), false);
  // Sun emblem on the gable
  b.glow(new THREE.TorusGeometry(0.95, 0.13, 6, 24), C.glow, at(M(0, Y + NH + 3.0, 12.55)));
  b.glow(new THREE.CircleGeometry(0.55, 16), C.glow, at(M(0, Y + NH + 3.0, 12.52)));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.glow(Box(0.12, 0.5, 0.06), C.glow, at(M(Math.cos(a) * 1.35, Y + NH + 3.0 + Math.sin(a) * 1.35, 12.54, 0, 1, 0, a - Math.PI / 2)));
  }
  // Rose window
  const wy = Y + 12.4;
  b.add(new THREE.TorusGeometry(3.2, 0.3, 8, 32), C.gold, at(M(0, wy, 12.1)));
  const glass = [0xff8a78, 0x7ab8ff, 0xffd45a, 0x8ae0a0, 0xc79aff, 0x7ab8ff];
  for (let i = 0; i < 12; i++) b.glow(new THREE.CircleGeometry(3.0, 2, (i / 12) * Math.PI * 2, Math.PI / 6), glass[i % glass.length], at(M(0, wy, 12.03)));
  for (let i = 0; i < 6; i++) b.add(Box(0.14, 6.0, 0.12), C.gold, at(M(0, wy, 12.16, 0, 1, 0, (i / 6) * Math.PI)), false);
  b.add(new THREE.TorusGeometry(1.1, 0.12, 6, 18), C.gold, at(M(0, wy, 12.18)));
  b.add(new THREE.TorusGeometry(2.1, 0.08, 6, 24), C.gold, at(M(0, wy, 12.17)), false);
  b.glow(new THREE.CircleGeometry(0.95, 16), 0xfff4d8, at(M(0, wy, 12.2)));
  // Gallery of Kings: a row of small arched niches below the rose window
  b.add(Box(14.4, 0.35, 0.6), C.stoneDark, at(M(0, Y + 8.3, 12.2)));
  for (let i = 0; i < 9; i++) {
    const lx = -5.6 + i * 1.4;
    b.add(Box(0.7, 1.5, 0.1), C.door, at(M(lx, Y + 9.3, 12.06)), false);
    b.add(new THREE.CircleGeometry(0.35, 8, 0, Math.PI), C.door, at(M(lx, Y + 10.05, 12.07)), false);
  }
  b.add(Box(14.4, 0.3, 0.6), C.stoneDark, at(M(0, Y + 10.8, 12.2)));
  // Triple arch
  portal(ctx, at, 0, Y, 12.05, 3.4, 5.4, true);
  portal(ctx, at, -4.6, Y, 12.05, 2.1, 4.1, false);
  portal(ctx, at, 4.6, Y, 12.05, 2.1, 4.1, false);
  // Side aisles: sloped roofs, arched windows
  for (const sx of [-1, 1]) {
    b.add(Box(7, 9, 22), C.wall, at(M(sx * 10.5, Y + 4.5, -3)));
    b.add(Box(7.6, 0.4, 22.6), C.stoneDark, at(M(sx * 10.5, Y + 9, -3)));
    b.add(Box(8.2, 0.35, 22.8), C.roof2, at(M(sx * 10.6, Y + 10.3, -3, 0, 1, 0, sx * -0.36)));
    for (const wz of [-11, -5.5, 0, 5.5]) {
      b.add(Box(0.14, 3.6, 1.3), C.door, at(M(sx * 14.02, Y + 4.4, wz)), false);
      b.glow(Box(0.1, 2.9, 0.62), C.warm, at(M(sx * 14.08, Y + 4.3, wz)));
      b.add(new THREE.ConeGeometry(0.8, 1.0, 4), C.stoneDark, at(M(sx * 14.05, Y + 6.7, wz, Math.PI / 4)).multiply(MS(0, 0, 0, 0.3, 1, 1)));
    }
    // Nave clerestory windows
    for (const wz of [-13, -8, -3, 2, 7]) b.glow(Box(0.1, 4.2, 0.9), C.warm, at(M(sx * 7.06, Y + 14.2, wz)));
    // Flying buttresses: outer piers + pinnacles, with slanted braces up to the nave wall
    for (const bz of [-13, -7.5, -2, 3.5]) {
      b.add(Box(1.5, 12, 1.5), C.stone, at(M(sx * 15.2, Y + 6, bz)));
      b.add(new THREE.ConeGeometry(1.0, 2.6, 4), C.roof, at(M(sx * 15.2, Y + 13.3, bz, Math.PI / 4)));
      b.glow(new THREE.OctahedronGeometry(0.2), C.glow, at(M(sx * 15.2, Y + 14.9, bz)));
      b.add(Box(9.2, 0.75, 0.8), C.stone, at(M(sx * 11.1, Y + 14.1, bz, 0, 1, 0, sx * -0.4)));
      b.add(Box(7.6, 0.5, 0.6), C.stoneDark, at(M(sx * 11.4, Y + 12.4, bz, 0, 1, 0, sx * -0.4)));
    }
    // Twin towers
    const tx = sx * 9.6;
    const TH = 30;
    b.add(Box(5.8, TH, 5.8), C.wall, at(M(tx, Y + TH / 2, 9.4)));
    for (const ly of [8.3, 16, 24, TH]) b.add(Box(6.4, 0.45, 6.4), C.stoneDark, at(M(tx, Y + ly, 9.4)));
    for (const ly of [12, 20]) {
      for (const [ox, oz, ry] of [[0, 2.93, 0], [sx * 2.93, 0, Math.PI / 2]] as const) {
        b.add(Box(1.0, 3.6, 0.2), C.door, at(M(tx + ox, Y + ly, 9.4 + oz, ry)), false);
        b.glow(Box(0.42, 2.8, 0.1), C.warm, at(M(tx + ox * 1.02, Y + ly - 0.2, 9.4 + oz * 1.02, ry)));
      }
    }
    // Bell-chamber openings at the tops of the towers
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      b.add(Box(1.6, 3.6, 0.2), C.door, at(M(tx + Math.sin(a) * 2.93, Y + 27.5, 9.4 + Math.cos(a) * 2.93, a)), false);
    }
    // Octagonal spires and four small corner pinnacles
    b.add(new THREE.ConeGeometry(3.4, 11, 8), C.roof, at(M(tx, Y + TH + 5.7, 9.4, Math.PI / 8)));
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      b.add(new THREE.ConeGeometry(0.55, 3.0, 4), C.roof2, at(M(tx + px * 2.7, Y + TH + 1.7, 9.4 + pz * 2.7, Math.PI / 4)));
      b.glow(new THREE.OctahedronGeometry(0.14), C.glow, at(M(tx + px * 2.7, Y + TH + 3.35, 9.4 + pz * 2.7)));
    }
    b.add(Cyl(0.06, 0.12, 2.0, 6), C.gold, at(M(tx, Y + TH + 12.1, 9.4)));
    b.glow(new THREE.OctahedronGeometry(0.45), C.glow, at(M(tx, Y + TH + 13.3, 9.4)));
  }
  // Apse: a semicircular wall and a half-cone roof
  b.add(new THREE.CylinderGeometry(7, 7, 16, 18, 1, false, Math.PI / 2, Math.PI), C.wall, at(M(0, Y + 8, -16)));
  b.add(new THREE.ConeGeometry(7.5, 7, 18, 1, false, Math.PI / 2, Math.PI), C.roof, at(M(0, Y + 19.5, -16)));
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + ((i + 0.5) / 5) * Math.PI;
    b.glow(Box(0.8, 4.2, 0.1), C.warm, at(M(Math.sin(a) * 7.03, Y + 9, -16 + Math.cos(a) * 7.03, a)));
  }
  // Central slender spire
  b.add(Cyl(1.3, 1.5, 4, 8), C.wall, at(M(0, Y + NH + 8.5, -6)));
  b.add(new THREE.ConeGeometry(1.5, 11, 8), C.gold, at(M(0, Y + NH + 16, -6)));
  b.glow(new THREE.OctahedronGeometry(0.4), C.glow, at(M(0, Y + NH + 22, -6)));
  // Collision
  solidRect(ctx, x, z, face, 0, -5.5, 34, 38);
  solidRect(ctx, x, z, face, 0, 15.5, 20, 4);
}

// ───────────────────────── Belfry ─────────────────────────

/**
 * Belfry: a square tower, arched windows on all four sides of the bell chamber, a hip-roofed spire; the bell itself is
 * made by the caller as a swinging object. Returns the bell's hanging height (world coordinates)
 */
export function belfry(ctx: FieldCtx, x: number, z: number, face: number): number {
  const { b } = ctx;
  const at = frame(ctx, x, z, face, 3.5);
  const y0 = ctx.b.lift;
  const W = 5.6;
  b.add(Box(8, 1.2, 8), C.stoneDark, at(M(0, 0, 0)));
  b.add(Box(7, 0.4, 7), C.stone, at(M(0, 0.7, 0)));
  b.add(Box(W, 24, W), C.wall, at(M(0, 0.9 + 12, 0)));
  for (const ly of [7, 14, 21]) b.add(Box(W + 0.6, 0.4, W + 0.6), C.stoneDark, at(M(0, 0.9 + ly, 0)));
  // Tall windows on the shaft and the door at the bottom
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const ox = Math.sin(a) * (W / 2 + 0.03);
    const oz = Math.cos(a) * (W / 2 + 0.03);
    for (const ly of [10.5, 17.5]) {
      b.add(Box(0.9, 3.0, 0.1), C.door, at(M(ox, 0.9 + ly, oz, a)), false);
      b.glow(Box(0.36, 2.3, 0.08), C.warm, at(M(ox * 1.01, 0.9 + ly - 0.2, oz * 1.01, a)));
    }
  }
  b.add(Box(1.5, 2.6, 0.2), C.door, at(M(0, 2.2, W / 2 + 0.05)), false);
  b.add(new THREE.TorusGeometry(0.8, 0.1, 5, 12, Math.PI), C.gold, at(M(0, 3.5, W / 2 + 0.08)), false);
  // Bell chamber: square pillars at the four corners, an arched opening on each side
  const by = 0.9 + 24;
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) b.add(Box(1.3, 6, 1.3), C.wall, at(M(px * (W / 2 - 0.65), by + 3, pz * (W / 2 - 0.65))));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    b.add(new THREE.TorusGeometry(1.5, 0.28, 6, 14, Math.PI), C.wall, at(M(Math.sin(a) * (W / 2 - 0.3), by + 4.1, Math.cos(a) * (W / 2 - 0.3), a)));
    b.add(new THREE.TorusGeometry(1.62, 0.1, 5, 14, Math.PI), C.gold, at(M(Math.sin(a) * (W / 2 - 0.12), by + 4.1, Math.cos(a) * (W / 2 - 0.12), a)), false);
    b.add(Box(W, 0.35, 0.5), C.stoneDark, at(M(Math.sin(a) * (W / 2 - 0.25), by + 0.2, Math.cos(a) * (W / 2 - 0.25), a)));
  }
  b.add(Box(W + 0.8, 0.6, W + 0.8), C.stoneDark, at(M(0, by + 6.2, 0)));
  b.add(Box(W + 1.0, 0.1, W + 1.0), C.gold, at(M(0, by + 5.92, 0)), false);
  b.add(hipRoof(W + 0.6, W + 0.6, 9), C.roof, at(M(0, by + 6.5, 0)));
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    b.add(new THREE.ConeGeometry(0.45, 2.2, 4), C.roof2, at(M(px * (W / 2 + 0.1), by + 7.6, pz * (W / 2 + 0.1), Math.PI / 4)));
    b.glow(new THREE.OctahedronGeometry(0.12), C.glow, at(M(px * (W / 2 + 0.1), by + 8.8, pz * (W / 2 + 0.1))));
  }
  b.add(Cyl(0.07, 0.14, 2.4, 6), C.gold, at(M(0, by + 16.6, 0)));
  b.glow(new THREE.OctahedronGeometry(0.5), C.glow, at(M(0, by + 18.2, 0)));
  ctx.solids.add(x, z, 4.4);
  return y0 + by + 4.6;
}

// ───────────────────────── Other landmark parts ─────────────────────────

/** Triumphal arch: two square piers + a semicircular arch + a parapet and sun emblem on top (the front faces local ±z) */
export function triumph(ctx: FieldCtx, x: number, z: number, face: number, span = 8, h = 8): void {
  const { b } = ctx;
  const at = frame(ctx, x, z, face, span / 2 + 1);
  const pw = 3.2;
  for (const s of [-1, 1]) {
    const px = s * (span / 2 + pw / 2);
    b.add(Box(pw + 0.5, 0.8, 3.6), C.stoneDark, at(M(px, 0.2, 0)));
    b.add(Box(pw, h, 3.0), C.wall, at(M(px, h / 2, 0)));
    for (const fz of [-1, 1]) {
      column(ctx, at, px, 0.6, fz * 1.75, h - 2.2, 0.28, C.marble);
      b.glow(Box(0.7, 1.8, 0.06), C.warm, at(M(px, h * 0.45, fz * 1.53)));
    }
    const [wx, wz] = toWorld(x, z, face, px, 0);
    ctx.solids.add(wx, wz, 2.0);
  }
  const rr = span / 2;
  b.add(new THREE.TorusGeometry(rr + 0.5, 0.55, 6, 20, Math.PI), C.wall, at(M(0, h - rr * 0.3, 0)).multiply(MS(0, 0, 0, 1, 1, 5.4)));
  b.add(new THREE.TorusGeometry(rr + 0.08, 0.14, 5, 20, Math.PI), C.gold, at(M(0, h - rr * 0.3, 1.52)), false);
  b.add(new THREE.TorusGeometry(rr + 0.08, 0.14, 5, 20, Math.PI), C.gold, at(M(0, h - rr * 0.3, -1.52)), false);
  const top = h - rr * 0.3 + rr + 0.9;
  b.add(Box(span + pw * 2 + 0.4, top - h + 1.2, 3.2), C.wall, at(M(0, (top + h) / 2 - 0.1, 0)));
  b.add(Box(span + pw * 2 + 1.0, 0.5, 3.8), C.stoneDark, at(M(0, top + 0.5, 0)));
  b.add(Box(span + pw * 2 + 0.2, 0.12, 3.3), C.gold, at(M(0, top - 0.3, 0)), false);
  for (const fz of [-1, 1]) {
    b.glow(new THREE.TorusGeometry(1.0, 0.12, 6, 20), C.glow, at(M(0, top - 0.9, fz * 1.62)));
    b.glow(new THREE.CircleGeometry(0.55, 14), C.glow, at(M(0, top - 0.9, fz * 1.63, fz > 0 ? 0 : Math.PI)));
  }
  angel(ctx, at, 0, top + 0.75, 0, 0, 1.25);
}

/** Obelisk: a slender four-sided pyramid column with a gold tip */
export function obelisk(ctx: FieldCtx, x: number, z: number, h: number): void {
  const { b } = ctx;
  const at = frame(ctx, x, z, 0, 1.2);
  b.add(Box(2.6, 0.6, 2.6), C.stoneDark, at(M(0, 0.2, 0)));
  b.add(Box(1.9, 1.2, 1.9), C.stone, at(M(0, 1.0, 0)));
  const g = new THREE.CylinderGeometry(0.42, 0.72, h, 4, 1);
  g.rotateY(Math.PI / 4);
  b.add(g, C.marble, at(M(0, 1.6 + h / 2, 0)));
  const tip = new THREE.ConeGeometry(0.6, 1.3, 4);
  tip.rotateY(Math.PI / 4);
  b.add(tip, C.gold, at(M(0, 1.6 + h + 0.65, 0)));
  b.glow(new THREE.OctahedronGeometry(0.3), C.glow, at(M(0, 1.6 + h + 1.7, 0)));
  ctx.solids.add(x, z, 1.4);
}

/** Circular colonnade pavilion (a small domed temple): n columns in a ring, with a ring beam and a dome above */
export function tholos(ctx: FieldCtx, x: number, z: number, R: number, n: number, h: number, dome: number, broken = 0): void {
  const { b, r } = ctx;
  const at = frame(ctx, x, z, 0, R);
  b.add(new THREE.CylinderGeometry(R + 1.2, R + 1.6, 0.9, 24), C.stoneDark, at(M(0, 0.05, 0)));
  b.add(new THREE.CylinderGeometry(R + 0.7, R + 1.0, 0.5, 24), C.stone, at(M(0, 0.6, 0)));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const cx = Math.cos(a) * R;
    const cz = Math.sin(a) * R;
    const keep = broken ? r() > broken : true;
    const hh = keep ? h : h * (0.2 + r() * 0.45);
    column(ctx, at, cx, 0.85, cz, hh, 0.36);
    const [wx, wz] = toWorld(x, z, 0, cx, cz);
    ctx.solids.add(wx, wz, 0.55);
  }
  if (!broken) {
    b.add(new THREE.CylinderGeometry(R + 0.7, R + 0.7, 1.0, 24, 1, true), C.wall, at(M(0, 0.85 + h + 1.7, 0)));
    b.add(new THREE.TorusGeometry(R + 0.7, 0.2, 5, 28), C.gold, at(M(0, 0.85 + h + 1.2, 0, 0, 1, Math.PI / 2)), false);
    b.add(new THREE.SphereGeometry(R + 0.9, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), dome, at(M(0, 0.85 + h + 2.1, 0)).multiply(MS(0, 0, 0, 1, 0.7, 1)));
    b.add(Cyl(0.5, 0.6, 1.0, 10), C.wall, at(M(0, 0.85 + h + 2.1 + (R + 0.9) * 0.7 + 0.3, 0)));
    b.glow(new THREE.OctahedronGeometry(0.4), C.glow, at(M(0, 0.85 + h + 2.1 + (R + 0.9) * 0.7 + 1.3, 0)));
  }
}
