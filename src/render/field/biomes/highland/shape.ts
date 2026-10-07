// Azurehowl Highlands terrain skeleton: the plateau outline floating on the cloud sea (hand-drawn control points + distance field),
// the Cloudrift Chasm cutting in from the east with Skyridge spanning it, the terraces rising in tiers from south to north
// (Station Terrace -> Windherd Terrace -> Windsong Terrace -> the Seal Tower's tower terrace),
// and Floatstone Hollow in the northeast corner.
// The station sits on the highest cliff top at the south end, looking north over the whole plateau:
// cliff top -> Windherd Meadow (low) -> chasm -> Windsong Terrace -> tower terrace.
// The distance field landD(x, z) is positive on land (meters) and negative beyond the cliff; terrain, coloring, the grass sea,
// cliff walls and collision all follow it.

import * as THREE from 'three';
import { smooth } from '../../compose.ts';
import type { XZ } from '../../kit.ts';

/** Half side length of the map */
export const S = 125;
/** Height of each terrace: Station Cliff top, Windherd Meadow, Windsong Terrace, tower terrace */
export const L0 = 24;
export const L1 = 12;
export const L2 = 16;
export const L3 = 20;
/** Height of the cloud sea */
export const SEA = -14;
/** Ground height beyond the cliff (under the cloud sea) */
const DEEP = -60;

export const TOWN: XZ = [-4, 71];
export const TOWN_R = 15.5;
export const TOWER: XZ = [-4, -74];
/** Floatstone Hollow: a sunken hollow in the northeast corner, with huge floating rocks drifting overhead */
export const BASIN: XZ = [58, -50];
export const BASIN_R = 14;
export const BASIN_H = 4;
/** Windmill Hill */
export const MILL_HILL: XZ = [42, 20];
/** Windsong Stone Ring */
export const RING: XZ = [-24, -33];
/** Letter Crane Cliff (the headland reaching east into the cloud sea) */
export const SHRINE: XZ = [88, 25];
/** Shepherd's hut */
export const HUT: XZ = [-66, 40];

/** Wind direction (grass, flags, clouds and fluff all follow it; matches the wind of the grass-sea shader) */
const WL = Math.hypot(0.8, 0.45);
export const WX = 0.8 / WL;
export const WZ = 0.45 / WL;

// ───────────────────────── Outline ─────────────────────────

/** Control points of the plateau's outer edge (clockwise: north -> east -> south -> west), then smoothed with Catmull-Rom */
const OUTLINE: XZ[] = [
  [-4, -98], [12, -96], [26, -91], [38, -94], [52, -89], [64, -83], [74, -77], [83, -69], [84, -61],
  // The gap where Floatstone Hollow opens to the east
  [74, -56], [70, -50], [75, -43], [86, -38], [95, -27], [97, -12], [95, 2], [90, 10],
  // Letter Crane Cliff: a headland reaching east
  [87, 15], [96, 19], [100, 26], [96, 33], [86, 36], [80, 41], [84, 50], [90, 60], [86, 71], [76, 80],
  [62, 86], [46, 89], [32, 92], [18, 93], [6, 92], [-2, 95], [-14, 95], [-24, 92], [-36, 90],
  [-48, 87], [-60, 84], [-72, 77], [-82, 67], [-88, 55], [-92, 45],
  // A small bay on the west side (windward)
  [-84, 38], [-78, 31], [-84, 23], [-94, 16], [-97, 4], [-95, -4], [-89, -12], [-96, -24], [-97, -38], [-92, -48],
  // A gap beyond the stone forest
  [-84, -54], [-88, -62], [-96, -67], [-90, -78], [-80, -86], [-66, -92], [-50, -95], [-34, -94], [-20, -97],
];

/** Rock tongue below the launch deck (the Wing Folk leap into the wind from here) */
const TONGUE: [XZ, XZ, number] = [[-8, 91], [-12, 101], 3.4];

/** Center line of the Cloudrift Chasm: x, z, half-width (narrowing from the exit in the east westward to its end) */
const CHASM: [number, number, number][] = [
  [108, -15, 12], [90, -10, 10], [74, -14, 9], [58, -8, 10], [42, -12, 9.5], [30, -10, 10.5], [20, -11, 11],
  [10, -13, 9], [0, -10, 7.5], [-10, -13, 6.5], [-22, -10, 4.5], [-33, -12, 0],
];

/** Skyridge: the natural rock bridge spanning the chasm (center line and half-width); the main road crosses over it */
const RIDGE: [number, number, number][] = [
  [21, 8, 6.5], [19.5, -3, 5.6], [21.5, -11, 5.2], [20, -19, 5.6], [18, -30, 6.5],
];

// ───────────────────────── Distance field ─────────────────────────

const GS = 2;
const GN = Math.round((2 * S) / GS) + 1;
let outlineGrid: Float32Array | null = null;
let outlinePts: XZ[] = [];

/** Signed distance to the outer outline (2 m grid, bilinearly interpolated on query) */
function buildOutline(): Float32Array {
  const curve = new THREE.CatmullRomCurve3(OUTLINE.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  outlinePts = curve.getSpacedPoints(380).map((p) => [p.x, p.z] as XZ);
  const P = outlinePts;
  const n = P.length - 1;
  const g = new Float32Array(GN * GN);
  for (let j = 0; j < GN; j++) {
    const z = -S + j * GS;
    for (let i = 0; i < GN; i++) {
      const x = -S + i * GS;
      let best = 1e9;
      let inside = false;
      for (let k = 0; k < n; k++) {
        const ax = P[k][0];
        const az = P[k][1];
        const bx = P[k + 1][0];
        const bz = P[k + 1][1];
        const ex = bx - ax;
        const ez = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
        const dx = x - ax - ex * t;
        const dz = z - az - ez * t;
        const d2 = dx * dx + dz * dz;
        if (d2 < best) best = d2;
        // Ray casting for inside/outside
        if (az > z !== bz > z && x < ax + ((z - az) * ex) / ez) inside = !inside;
      }
      g[j * GN + i] = inside ? Math.sqrt(best) : -Math.sqrt(best);
    }
  }
  return g;
}

function outlineD(x: number, z: number): number {
  const g = outlineGrid ?? (outlineGrid = buildOutline());
  const fx = Math.min(GN - 1.001, Math.max(0, (x + S) / GS));
  const fz = Math.min(GN - 1.001, Math.max(0, (z + S) / GS));
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  return g[j * GN + i] * (1 - u) * (1 - v) + g[j * GN + i + 1] * u * (1 - v) + g[(j + 1) * GN + i] * (1 - u) * v + g[(j + 1) * GN + i + 1] * u * v;
}

/** Signed distance to a chain of "capsules of varying thickness" (negative inside a capsule) */
function capsules(pts: [number, number, number][], x: number, z: number): number {
  let best = 1e9;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az, ar] = pts[k];
    const [bx, bz, br] = pts[k + 1];
    const ex = bx - ax;
    const ez = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
    const d = Math.hypot(x - ax - ex * t, z - az - ez * t) - (ar + (br - ar) * t);
    if (d < best) best = d;
  }
  return best;
}

/** Fine undulation of the cliff edge (keeps the outline from being too smooth) */
const rimNoise = (x: number, z: number) => 0.9 * Math.sin(x * 0.31 + z * 0.17) + 0.6 * Math.sin(x * 0.13 - z * 0.37 + 1.3) + 0.35 * Math.sin(x * 0.71 + z * 0.53);

/** Signed distance of the land (exact version) */
function landDExact(x: number, z: number): number {
  const [[ax, az], [bx, bz], tr] = TONGUE;
  const tongue = tr - capsules([[ax, az, 0], [bx, bz, 0]], x, z);
  const outer = Math.max(outlineD(x, z), tongue);
  // The chasm cuts away the land, and Skyridge joins it back
  const chasm = capsules(CHASM, x, z);
  const ridge = -capsules(RIDGE, x, z);
  return Math.min(outer, Math.max(chasm, ridge)) + rimNoise(x, z) * 0.55;
}

// Terrain, coloring, cliff rim and grass distribution all query landD: compute it once on a 1 m grid, then bilinearly interpolate
// (terrain vertices fall exactly on grid points, so they get the exact value).
const LN = 2 * S + 1;
let ldGrid: Float32Array | null = null;

/** Signed distance of the land: positive on land (meters), negative beyond the cliff */
export function landD(x: number, z: number): number {
  if (!ldGrid) {
    ldGrid = new Float32Array(LN * LN);
    for (let j = 0; j < LN; j++) for (let i = 0; i < LN; i++) ldGrid[j * LN + i] = landDExact(-S + i, -S + j);
  }
  const fx = x + S;
  const fz = z + S;
  if (!(fx >= 0 && fz >= 0 && fx < LN - 1 && fz < LN - 1)) return landDExact(x, z);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  const g = ldGrid;
  const k = j * LN + i;
  return (g[k] * (1 - u) + g[k + 1] * u) * (1 - v) + (g[k + LN] * (1 - u) + g[k + LN + 1] * u) * v;
}

// ───────────────────────── Terraces ─────────────────────────

/** Boundary between Station Cliff top and Windherd Meadow (the cliff top is in the south) */
export const zA = (x: number) => 45 + 3 * Math.sin(0.05 * x + 0.5) + 2 * Math.sin(0.13 * x + 1.3);

/**
 * Boundary between Windherd Meadow and Windsong Terrace: along the center line inside the chasm,
 * and a sheer cliff west of the chasm's end
 */
export function zB(x: number): number {
  if (x < -33) return -12 + 3 * Math.sin(0.09 * (x + 33));
  for (let k = 0; k < CHASM.length - 1; k++) {
    const [x0, z0] = CHASM[k];
    const [x1, z1] = CHASM[k + 1];
    if (x <= x0 && x >= x1) return z0 + ((z1 - z0) * (x - x0)) / (x1 - x0);
  }
  return CHASM[0][1];
}

/** Small rock shelf in the stone forest (steep walls, cannot be climbed) */
export const BUTTES: [number, number, number, number][] = [
  [-76, -44, 6.5, 7],
  [-56, -73, 5.5, 6],
  [-82, -66, 4.5, 8.5],
  [-46, -60, 4, 5],
  [-70, 8, 5, 5],
];

/** Small hills on Windherd Meadow */
const KNOLLS: [number, number, number, number][] = [
  [-30, 12, 10, 2.2],
  [62, 44, 11, 2.6],
  [-14, 36, 7, 1.4],
  [70, -24, 12, 2.4],
  [-30, -60, 12, 2],
];

/** Slope: cuts a ramp of half-width w from a (height ha) to b (height hb) (only digs lower, never builds up, unless fill) */
export const RAMPS: [XZ, number, XZ, number, number][] = [
  // Station Cliff top -> Windherd Meadow (the main road slants down hugging the cliff wall)
  [[-1, 50], L0, [15, 35], L1 + 0.4, 3.6],
  // Windsong Terrace -> Floatstone Hollow (rock cleft)
  [[30, -33], L2, [50, -47.5], BASIN_H, 3.2],
];

function ramp(h: number, x: number, z: number, [[ax, az], ha, [bx, bz], hb, w]: [XZ, number, XZ, number, number]): number {
  const ex = bx - ax;
  const ez = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
  const rd = Math.hypot(x - ax - ex * t, z - az - ez * t);
  if (rd > w + 2.5) return h;
  const rh = ha + (hb - ha) * smooth(0, 1, t);
  return h + (Math.min(rh, h) - h) * (1 - smooth(w, w + 2.5, rd));
}

/** Width of Station Cliff (the west side becomes a gentle slope) */
export const wA = (x: number) => 4.5 + 30 * (1 - smooth(-66, -40, x));
/** Width of Windsong Terrace's front edge (a long slope on Skyridge) */
export const wB = (x: number) => 4.5 + 15 * (1 - smooth(6, 15, Math.abs(x - 20)));
/** Radius of the tower terrace (by azimuth) */
export const mesaR = (a: number) => 30 + 2.5 * Math.sin(3 * a + 0.4) + 1.5 * Math.sin(7 * a + 1.1);
/** Radius of Floatstone Hollow (by azimuth) */
export const basinR = (a: number) => BASIN_R + 1.6 * Math.sin(3 * a + 1) + 0.8 * Math.sin(5 * a + 2.2);
/** Radius of the small rock shelf (by azimuth) */
export const butteR = ([bx, bz, br]: [number, number, number, number], a: number) => br + 0.8 * Math.sin(3 * a + bx) + 0.5 * Math.sin(5 * a + bz);

/** Base height of the terraces (before the cliffs are added) */
export function terrace(x: number, z: number): number {
  let h = L0;
  // Station Cliff top -> Windherd Meadow: the west is a large gentle slope (Shepherd's Slope), elsewhere sheer cliffs
  const za = zA(x);
  const wa = wA(x);
  h += (L1 - L0) * smooth(za + wa / 2, za - wa / 2, z);
  // Windherd Meadow -> Windsong Terrace: a long slope on Skyridge
  const zb = zB(x);
  const wb = wB(x);
  h += (L2 - L1) * smooth(zb + wb / 2, zb - wb / 2, z);
  // Undulation
  h += 0.9 * Math.sin(0.05 * x + 1) * Math.cos(0.045 * z) + 0.5 * Math.sin(0.13 * x - 0.09 * z) + 0.25 * Math.sin(0.31 * x + 0.27 * z);
  // Windmill Hill and small hills
  h += 4.2 * (1 - smooth(0, 20, Math.hypot(x - MILL_HILL[0], z - MILL_HILL[1])));
  for (const [kx, kz, kr, kh] of KNOLLS) h += kh * (1 - smooth(0, kr, Math.hypot(x - kx, z - kz)));
  // The west side of Windherd Meadow slopes gently toward the cliff edge
  h -= 2.2 * smooth(-40, -88, x) * (1 - smooth(20, 34, z)) * smooth(-16, -4, z);
  // Tower terrace
  if (z < -30) {
    const tx = x - TOWER[0];
    const tz = z - TOWER[1];
    const rM = mesaR(Math.atan2(tz, tx));
    h += (L3 - h) * smooth(rM + 2.4, rM - 2.4, Math.hypot(tx, tz)) * smooth(-30, -40, z);
  }
  // Small rock shelf
  for (const bt of BUTTES) {
    const [bx, bz, br, bh] = bt;
    const d = Math.hypot(x - bx, z - bz);
    if (d > br + 3) continue;
    const rr = butteR(bt, Math.atan2(z - bz, x - bx));
    h += bh * smooth(rr + 1.3, rr - 1.3, d);
  }
  // Floatstone Hollow
  const bx = x - BASIN[0];
  const bz = z - BASIN[1];
  const bd = Math.hypot(bx, bz);
  if (bd < BASIN_R + 5) {
    const rB = basinR(Math.atan2(bz, bx));
    const inBasin = smooth(rB + 2.6, rB - 2.6, bd);
    // Small pool at the bottom of the hollow
    const pond = 0.7 * (1 - smooth(2.5, 5, Math.hypot(x - POND[0], z - POND[1])));
    h += (BASIN_H - pond - h) * inBasin;
  }
  for (const rp of RAMPS) h = ramp(h, x, z, rp);
  // Waterfall pool below Station Cliff
  h -= 0.9 * (1 - smooth(2.6, 4.8, Math.hypot(x - FALL_POND[0], z - FALL_POND[1])));
  return h;
}

/** Waterfall pool below Station Cliff */
export const FALL_POND: XZ = [-26, 36.5];

/** Pool in Floatstone Hollow (the giant floating rock's waterfall lands here) */
export const POND: XZ = [BASIN[0] + 3, BASIN[1] + 3];

/** Raw terrain height: terraces, and beyond the cliff edge it drops under the cloud sea */
export function rawHeight(x: number, z: number): number {
  const d = landD(x, z);
  const base = terrace(x, z);
  if (d >= 0) return base;
  return base + (DEEP - base) * smooth(0, 1.7, -d);
}

// ───────────────────────── Cliff edge outline ─────────────────────────

export interface RimPoint {
  x: number;
  z: number;
  /** Direction pointing out of the cliff */
  nx: number;
  nz: number;
  /** Cumulative length along the outline */
  s: number;
}

/** Extract the landD = 0 contour with marching squares and chain it into several evenly sampled polylines (the cliff edge) */
export function rimLoops(step = 1.4): RimPoint[][] {
  const G = 1;
  const N = Math.round((2 * S) / G) + 1;
  const v = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) v[j * N + i] = landD(-S + i * G, -S + j * G);
  // One intersection point per grid edge crossed by the contour; key = grid edge index
  const pt = new Map<number, XZ>();
  const edgeKey = (i: number, j: number, horiz: boolean) => (j * N + i) * 2 + (horiz ? 0 : 1);
  const cross = (i: number, j: number, horiz: boolean): number => {
    const k = edgeKey(i, j, horiz);
    if (!pt.has(k)) {
      const a = v[j * N + i];
      const b = horiz ? v[j * N + i + 1] : v[(j + 1) * N + i];
      const t = a / (a - b);
      pt.set(k, horiz ? [-S + (i + t) * G, -S + j * G] : [-S + i * G, -S + (j + t) * G]);
    }
    return k;
  };
  const adj = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  };
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      const c0 = v[j * N + i] > 0;
      const c1 = v[j * N + i + 1] > 0;
      const c2 = v[(j + 1) * N + i + 1] > 0;
      const c3 = v[(j + 1) * N + i] > 0;
      const es: number[] = [];
      if (c0 !== c1) es.push(cross(i, j, true));
      if (c1 !== c2) es.push(cross(i + 1, j, false));
      if (c3 !== c2) es.push(cross(i, j + 1, true));
      if (c0 !== c3) es.push(cross(i, j, false));
      if (es.length === 2) link(es[0], es[1]);
      else if (es.length === 4) {
        link(es[0], es[1]);
        link(es[2], es[3]);
      }
    }
  }
  // Chain into polylines
  const seen = new Set<number>();
  const loops: XZ[][] = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const line: XZ[] = [];
    let cur = start;
    let prev = -1;
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur);
      line.push(pt.get(cur)!);
      const nb = adj.get(cur)!.filter((k) => k !== prev && !seen.has(k));
      prev = cur;
      cur = nb[0];
    }
    if (line.length > 12) loops.push(line);
  }
  // Resample evenly, and compute the outward direction from the distance field's gradient
  const out: RimPoint[][] = [];
  for (const line of loops) {
    const closed = Math.hypot(line[0][0] - line[line.length - 1][0], line[0][1] - line[line.length - 1][1]) < 2;
    const pts = closed ? [...line, line[0]] : line;
    const res: RimPoint[] = [];
    let acc = 0;
    let next = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k];
      const [bx, bz] = pts[k + 1];
      const len = Math.hypot(bx - ax, bz - az);
      while (next <= acc + len) {
        const t = len > 0 ? (next - acc) / len : 0;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        const e = 0.5;
        let gx = landD(x - e, z) - landD(x + e, z);
        let gz = landD(x, z - e) - landD(x, z + e);
        const gl = Math.hypot(gx, gz) || 1;
        gx /= gl;
        gz /= gl;
        res.push({ x, z, nx: gx, nz: gz, s: next });
        next += step;
      }
      acc += len;
    }
    out.push(res);
  }
  return out;
}
