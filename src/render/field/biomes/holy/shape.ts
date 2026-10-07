// Dawnlight Holy City terrain and layout: several white stone islands floating on the sea of clouds, including the Outer City
// at the south end, the main island rising to the north (Cathedral and Belfry), the Sky Garden Isle in the east,
// the Seal Tower Isle in the north ringed by the Church's barrier, and the secret-realm islet in the northwest,
// joined only by a narrow Cloud Spine.
// The island edge is a white cliff dropping straight into the sea of clouds; islands are joined by stone bridges
// (the bridge deck is itself a narrow ridge of terrain).
// This module holds only pure functions and constants (it never touches three's scene), so the map can be previewed in Node.

import { smooth } from '../../compose.ts';
import type { XZ } from '../../kit.ts';

export const S = 125;
/** Height of the sea of clouds: the cliffs sink all the way down into it */
export const CLOUD_Y = -14;
export const TOWN: XZ = [0, 78];
export const TOWN_R = 18;
export const TOWER: XZ = [0, -72];
/**
 * Boundary between the Outer City (lower tier) and the main island (upper tier): a curved
 * retaining wall centered on TERRACE_C
 */
export const TERRACE_C: XZ = [0, 76];
export const TERRACE_R = 31;
export const LOW = 2;
export const HIGH = 7;
/** Grand stair: x within ±STAIR_W, z rises in a straight line from STAIR_Z[0] (bottom) to STAIR_Z[1] (top) */
export const STAIR_W = 6;
export const STAIR_Z: [number, number] = [50, 36];

// Landmark positions
export const CATHEDRAL = { x: -28, z: 11 };
/** The sun-mosaic plaza in front of the Cathedral (the obelisk at its center) */
export const MOSAIC: XZ = [-28, 42];
export const BELFRY: XZ = [13, 6];
export const GATE: XZ = [0, -15];
export const OVERLOOK: XZ = [-80, 16];
export const RUINS: XZ = [-56, -4];
export const FALLEN: XZ = [-61, 17];
export const GARDEN: XZ = [74, 30];
export const GLASS: XZ = [77, 3];
export const HILL: XZ = [73, -13];
export const TRIBUNAL: XZ = [-27, -76];
export const CAGES: XZ = [27, -78];
export const NEST: XZ = [-80, -51];
export const SPRING: XZ = [15, 41];

// ───────────────────────── Island shapes ─────────────────────────

interface Blob {
  x: number;
  z: number;
  rx: number;
  rz: number;
  /** Strength of the coastline undulation */
  n: number;
}

const MAIN: Blob[] = [
  { x: 0, z: 78, rx: 24, rz: 24, n: 0.3 },
  { x: -12, z: 36, rx: 44, rz: 32, n: 1 },
  { x: 0, z: 2, rx: 26, rz: 20, n: 0.7 },
  { x: -58, z: 12, rx: 28, rz: 30, n: 1 },
  { x: -30, z: -9, rx: 20, rz: 14, n: 0.8 },
];
const EAST: Blob = { x: 74, z: 12, rx: 26, rz: 36, n: 0.6 };
const HOLY: Blob = { x: 0, z: -72, rx: 40, rz: 31, n: 0.45 };
const NESTB: Blob = { x: NEST[0], z: NEST[1] + 1, rx: 12.5, rz: 12.5, n: 0.3 };

export interface Span {
  a: XZ;
  c: XZ;
  /** Half width (including the stone rim outside the railing) */
  w: number;
}
/** Stone bridges: the Holy Bridge (main island -> Seal Tower Isle), the Garden Bridge (main island -> Sky Garden Isle) */
export const BRIDGES: Span[] = [
  { a: [0, -12], c: [0, -48], w: 4.4 },
  { a: [22, 25.5], c: [54, 20], w: 3.8 },
];
/** Cloud Spine: a natural stone ridge to the secret-realm islet (not a road) */
export const SPINE: Span = { a: [-63, -10], c: [-78, -41], w: 3.3 };

const coast = (x: number, z: number) => 2.2 * Math.sin(x * 0.083 + z * 0.051 + 1.3) + 1.6 * Math.sin(z * 0.117 - x * 0.071) + 0.9 * Math.sin(x * 0.21 + z * 0.17 + 2);

function blob(o: Blob, x: number, z: number): number {
  const dx = x - o.x;
  const dz = z - o.z;
  const rho = Math.hypot(dx, dz);
  if (rho < 1e-3) return Math.min(o.rx, o.rz);
  const d = Math.hypot(dx / o.rx, dz / o.rz);
  return rho / d - rho + coast(x, z) * o.n;
}

/** Point to segment: the distance and the projection parameter t (0~1) */
export function segDist(a: XZ, c: XZ, x: number, z: number): [number, number] {
  const vx = c[0] - a[0];
  const vz = c[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz)));
  return [Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t), t];
}

const smax = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
};

function shoreMain(x: number, z: number): number {
  let s = blob(MAIN[0], x, z);
  for (let i = 1; i < MAIN.length; i++) s = smax(s, blob(MAIN[i], x, z), 10);
  return s;
}

const span = (o: Span, x: number, z: number) => o.w - segDist(o.a, o.c, x, z)[0];

/** Distance to the island edge (positive on the island, roughly in meters) */
export function shore(x: number, z: number): number {
  let s = Math.max(shoreMain(x, z), blob(EAST, x, z), blob(HOLY, x, z), blob(NESTB, x, z), span(SPINE, x, z));
  for (const br of BRIDGES) s = Math.max(s, span(br, x, z));
  return s;
}

// ───────────────────────── Height ─────────────────────────

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const und = (x: number, z: number) => 0.9 * Math.sin(x * 0.061 + 0.5) * Math.cos(z * 0.052 - 0.3) + 0.45 * Math.sin(x * 0.13 - z * 0.11 + 1.1);
/** A flat-topped swell: 1 inside rIn, 0 outside rOut */
const plateau = (x: number, z: number, c: XZ, rIn: number, rOut: number) => 1 - smooth(rIn, rOut, Math.hypot(x - c[0], z - c[1]));
const rect = (x: number, z: number, x0: number, x1: number, z0: number, z1: number, soft: number) => {
  const dx = Math.max(x0 - x, 0, x - x1);
  const dz = Math.max(z0 - z, 0, z - z1);
  return 1 - smooth(0, soft, Math.hypot(dx, dz));
};

/** Paved ground (0~1, for coloring the ground and for grass) */
export function paved(x: number, z: number): number {
  return Math.max(
    rect(x, z, -46, -10, -9, 25, 2.5),
    plateau(x, z, MOSAIC, 9, 11),
    plateau(x, z, [1, -5], 10, 12.5),
    plateau(x, z, OVERLOOK, 8, 10),
    plateau(x, z, BELFRY, 6, 8),
    plateau(x, z, [0, 31], 5.5, 8),
    plateau(x, z, SPRING, 7, 9),
  );
}

/** Places that must stay flat (0~1, for height) */
function flatMask(x: number, z: number): number {
  return Math.max(
    rect(x, z, -48, -2, -12, 31, 6),
    plateau(x, z, MOSAIC, 11, 16),
    plateau(x, z, [1, -5], 11, 16),
    plateau(x, z, OVERLOOK, 8, 12),
    plateau(x, z, BELFRY, 6, 10),
    plateau(x, z, [0, 31], 6, 10),
    plateau(x, z, SPRING, 7, 11),
  );
}

/** Sun mosaics on the round plazas: center, radius, number of rays */
export const SUNS: [number, number, number, number][] = [
  [MOSAIC[0], MOSAIC[1], 9.5, 24],
  [1, -5, 10.5, 16],
  [OVERLOOK[0], OVERLOOK[1], 8, 16],
];

function topMain(x: number, z: number): number {
  const dT = Math.hypot(x - TERRACE_C[0], z - TERRACE_C[1]);
  let tier = smooth(TERRACE_R - 0.9, TERRACE_R + 0.9, dT);
  const st = 1 - smooth(STAIR_W, STAIR_W + 2, Math.abs(x));
  if (st > 0 && z > 20) tier += (clamp01((STAIR_Z[0] - z) / (STAIR_Z[0] - STAIR_Z[1])) - tier) * st;
  const flat = flatMask(x, z);
  const lo = LOW + und(x, z) * 0.35 * smooth(TOWN_R, TOWN_R + 6, Math.hypot(x - TOWN[0], z - TOWN[1]));
  const roll = und(x, z) * 1.3 + 2.4 * plateau(x, z, RUINS, 8, 20) + 1.4 * plateau(x, z, [-66, 36], 3, 12) + 1.0 * plateau(x, z, [-26, -16], 2, 9);
  const hi = HIGH + roll * (1 - flat) * smooth(TERRACE_R + 1, TERRACE_R + 9, dT);
  return lo + (hi - lo) * tier;
}

function topEast(x: number, z: number): number {
  const flat = Math.max(rect(x, z, 63, 85, 19, 41, 5), plateau(x, z, GLASS, 10, 14));
  return 5 + und(x, z) * 0.9 * (1 - flat) + 5.5 * plateau(x, z, HILL, 4, 19) + 0.6 * plateau(x, z, GLASS, 10, 14);
}

const topHoly = (x: number, z: number) => 10 + und(x, z) * 0.4;
const topNest = (x: number, z: number) => 12.5 + 1.2 * plateau(x, z, NEST, 0, 11);

const SPINE_H: [number, number] = [topMain(SPINE.a[0], SPINE.a[1]), topNest(SPINE.c[0], SPINE.c[1])];
const topSpine = (x: number, z: number) => {
  const t = segDist(SPINE.a, SPINE.c, x, z)[1];
  return SPINE_H[0] + (SPINE_H[1] - SPINE_H[0]) * t + Math.sin(t * Math.PI) * 1.2;
};

/**
 * Island surface height (cliffs not yet cut): each island's height is blended by weight on the distance to its edge,
 * so bridges and the Cloud Spine form slopes naturally
 */
function topAt(x: number, z: number, parts: [number, (x: number, z: number) => number][]): number {
  let m = -Infinity;
  for (const [s] of parts) m = Math.max(m, s);
  let ws = 0;
  let hs = 0;
  for (const [s, f] of parts) {
    const d = s - m;
    if (d < -26) continue;
    const w = Math.exp(0.3 * d);
    ws += w;
    hs += w * f(x, z);
  }
  return hs / ws;
}

export interface Ground {
  s: number;
  top: number;
  h: number;
}

/** Raw terrain height: island surface + the rounded island edge + the cliffs dropping straight into the sea of clouds */
export function ground(x: number, z: number): Ground {
  const sm = shoreMain(x, z);
  const se = blob(EAST, x, z);
  const sh = blob(HOLY, x, z);
  const sn = blob(NESTB, x, z);
  const sp = span(SPINE, x, z);
  let s = Math.max(sm, se, sh, sn, sp);
  for (const br of BRIDGES) s = Math.max(s, span(br, x, z));
  const top = topAt(x, z, [
    [sm, topMain],
    [se, topEast],
    [sh, topHoly],
    [sn, topNest],
    [sp - 4, topSpine],
  ]);
  let h: number;
  if (s >= 1.6) h = top;
  else if (s >= 0) {
    const k = 1 - s / 1.6;
    h = top - 0.6 * k * k;
  } else h = top - 0.6 - 46 * smooth(0, 7, -s);
  return { s, top, h };
}

export const height = (x: number, z: number) => ground(x, z).h;

// ───────────────────────── Island edge ─────────────────────────

/**
 * Scan the whole map for the ring of points 1 meter inside the island edge (for colliders, so nobody walks off the cliff)
 */
export function rimPoints(th = 1): XZ[] {
  const out: XZ[] = [];
  const L = S - 2;
  for (let z = -L; z <= L; z += 1) {
    for (let x = -L; x <= L; x += 1) {
      const s = shore(x, z);
      if (s < th || s > th + 2.5) continue;
      if (shore(x + 1, z) < th || shore(x - 1, z) < th || shore(x, z + 1) < th || shore(x, z - 1) < th) out.push([x, z]);
    }
  }
  return out;
}

/** From the center (cx, cz) along angles a0 -> a1, find a chain of points on the island edge (shore = th), for railings */
export function traceRim(cx: number, cz: number, a0: number, a1: number, step: number, th = 1.05, rMax = 60): XZ[] {
  const pts: XZ[] = [];
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    if (shore(cx, cz) < th) continue;
    // Search from the outside in for the first position on the island, then bisect
    let lo = 0;
    let hi = rMax;
    for (let r = rMax; r > 0; r -= 1) {
      if (shore(cx + ca * r, cz + sa * r) >= th) {
        lo = r;
        hi = r + 1;
        break;
      }
    }
    for (let k = 0; k < 12; k++) {
      const m = (lo + hi) / 2;
      if (shore(cx + ca * m, cz + sa * m) >= th) lo = m;
      else hi = m;
    }
    pts.push([cx + ca * lo, cz + sa * lo]);
  }
  return pts;
}

// ───────────────────────── Layout ─────────────────────────

export const PATH: XZ[] = [
  [0, 69],
  [0, 58],
  [0, STAIR_Z[0]],
  [0, STAIR_Z[1]],
  [-2, 26],
  [-4, 12],
  [-2, 0],
  [0, -12],
  [0, -30],
  [0, -46],
  [0, -54],
];

export const TRAILS: XZ[][] = [
  // West loop: the plaza in front of the Cathedral -> Cloud Overlook
  [
    [-1, 34],
    [-14, 31.5],
    [-40, 31.5],
    [-60, 26],
    [-72, 18],
  ],
  // Cloud Overlook -> Old Chapel Ruins -> back to the main road in front of the Belfry
  [
    [-72, 18],
    [-68, 4],
    [-60, -10],
    [-44, -15],
    [-24, -14],
    [-4, -4],
  ],
  // East route: Garden Bridge -> Sky Garden
  [
    [1, 34],
    [12, 29],
    [22, 25.5],
    [54, 20],
    [62, 24],
  ],
  // Garden -> Stained-Glass Ring -> Cloud Pasture
  [
    [62, 24],
    [64, 14],
    [68, 4],
    [70, -8],
  ],
  // Seal Tower Isle: the Tribunal and the Purification Ward
  [
    [0, -48],
    [-14, -54],
    [-22, -66],
  ],
  [
    [0, -48],
    [14, -54],
    [22, -68],
  ],
];
