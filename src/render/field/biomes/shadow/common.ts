// Shared data for the Duskshade Hollow field: map size, landmark positions, raw terrain height, roads,
// lantern positions along the road, and the cracks in the ceiling.
// shadow.ts (terrain and layout) and the split-off modules (town, wild, shaders) all take from here and never import one another.

import { samplePath, smooth } from '../../compose.ts';
import type { XZ } from '../../kit.ts';

export const sm = smooth;

// ───────────────────────── Landmark positions ─────────────────────────

/** Half the side length: a great underground cavern of 240 × 240 meters */
export const S = 120;
/** Lampglow Village (southeast) */
export const TOWN: XZ = [42, 74];
export const TOWN_R = 17;
/** Spawn point: facing the Seal Tower */
export const SPAWN: XZ = [25.5, 45.5];
/**
 * No giant trees along the line of sight from the spawn point to the tower (no planting where a canopy of radius rad touches
 * the line), leaving a long corridor through the woods from which the tower lamp is visible
 */
export function blocksTowerView(x: number, z: number, rad: number): boolean {
  const dx = TOWER[0] - SPAWN[0];
  const dz = TOWER[1] - SPAWN[1];
  const l = Math.hypot(dx, dz);
  const px = x - SPAWN[0];
  const pz = z - SPAWN[1];
  const t = (px * dx + pz * dz) / (l * l);
  if (t < 0.04 || t > 0.92) return false;
  return Math.abs(px * dz - pz * dx) / l < rad + 1.5;
}
/** Position of the town panorama camera (dev viewer &cam=town): no tall rocks or giant trees on the line of sight in front of the camera */
const TOWN_CAM: XZ = [TOWN[0] + 26, TOWN[1] + 30];
/** Whether this point (radius rad) would block the town panorama camera */
export function blocksTownView(x: number, z: number, rad: number): boolean {
  const dx = TOWN[0] - TOWN_CAM[0];
  const dz = TOWN[1] - TOWN_CAM[1];
  const l = Math.hypot(dx, dz);
  const px = x - TOWN_CAM[0];
  const pz = z - TOWN_CAM[1];
  const t = (px * dx + pz * dz) / l;
  if (t < -6 || t > 24) return false;
  const d = Math.abs(px * dz - pz * dx) / l;
  return d - rad < 3 + Math.max(0, t) * 0.4;
}
/** Thousand-Lamp Pillar: the lamp pillar at the center of the village */
export const PILLAR: XZ = [46, 73];
/** Duskshade Seal Tower (on the plateau in the northwest) */
export const TOWER: XZ = [-30, -78];
/** How much higher the northern plateau is than the lowland */
export const PLATEAU = 8;
/** Everdark Lake */
export const WATER = -1;
export const LAKE: XZ = [-46, 8];
/** Sunken Moon Isle (secret realm) */
export const ISLE: XZ = [-53, 3];
/** Moonspring Falls: a thin waterfall dropping from a crack in the ceiling into the lake */
export const FALLS: XZ = [-45, -5];
/** Sunken Tomb: a sunken rectangular courtyard (center, rotation, half-width, half-depth) */
export const CRYPT: XZ = [-58, 62];
export const CRYPT_ROT = 0.35;
export const CRYPT_HW = 10;
export const CRYPT_HD = 7;
export const CRYPT_FLOOR = -0.4;
/** Unlit Wood (east) */
export const GROVE: XZ = [72, 10];
/** Silkthread Vale (a shallow valley on the northeast plateau) */
export const SILK: XZ = [60, -68];
/** Moonlit Glade (the center of Capwood) */
export const GLADE: XZ = [15, -10];
/** Glowgrass Meadow (north of the village) */
export const MEADOW: XZ = [14, 36];
/** Pier: extending into the lake from the east shore */
export const PIER: [XZ, XZ] = [[-15, 8.5], [-31, 8.5]];
/** The sunken old stone causeway: stepping through shallow water from the northwest shore to Sunken Moon Isle */
export const CAUSEWAY: XZ[] = [[-64, -18], [-59, -11], [-61.5, -5], [-57, 0]];

/** Floor-to-ceiling stalactite-stalagmite pillars: x, z, radius */
export const COLUMNS: [number, number, number][] = [
  [27, 2, 4.2],
  [-3, 61, 3.4],
  [74, 42, 3.8],
  [-84, -30, 4.6],
  [30, -58, 4.2],
  [-66, 36, 3.4],
  [92, 70, 4.0],
  [-30, 90, 4.4],
];

/** Rolling small hills: x, z, radius, height */
const HILLS: [number, number, number, number][] = [
  [44, 22, 18, 3],
  [-28, 40, 14, 2.4],
  [42, -22, 16, 2.4],
  [-88, 64, 16, 3],
  [92, -6, 14, 2.5],
  [10, 88, 14, 2.4],
  [-62, 92, 16, 2.8],
  [-8, 72, 12, 1.8],
];

// ───────────────────────── Gorge coordinates ─────────────────────────

const AXL = Math.hypot(TOWN[0] - TOWER[0], TOWN[1] - TOWER[1]);
/** Direction the tower door faces (the unit vector pointing from the tower to the village) */
export const AX: XZ = [(TOWN[0] - TOWER[0]) / AXL, (TOWN[1] - TOWER[1]) / AXL];
/** The point in front of the tower door where the tower is entered */
export const DOOR: XZ = [TOWER[0] + AX[0] * 16.5, TOWER[1] + AX[1] * 16.5];
/** Gorge coordinates: u is the distance from the tower door toward the village, v is lateral (positive leans northeast) */
export function gorgeUV(x: number, z: number): [number, number] {
  const px = x - DOOR[0];
  const pz = z - DOOR[1];
  return [px * AX[0] + pz * AX[1], px * AX[1] - pz * AX[0]];
}
export function gorgeAt(u: number, v: number): XZ {
  return [DOOR[0] + AX[0] * u + AX[1] * v, DOOR[1] + AX[1] * u - AX[0] * v];
}
/** The direction toward the village inside the gorge (radians, 0 = +z) */
export const GORGE_FACE = Math.atan2(AX[0], AX[1]);
/** The Tomb Gate: the mouth of the gorge */
export const GATE_U = 36;

// ───────────────────────── Roads ─────────────────────────

export const PATH: XZ[] = [
  [42, 86],
  [37, 72],
  [34, 60],
  [28, 48],
  [18, 38],
  [7, 28],
  [-3, 17],
  [-11, 6],
  [-11.5, -5],
  [-7, -16],
  gorgeAt(40, 0),
  gorgeAt(27, 0),
  gorgeAt(14, 0),
  gorgeAt(1.2, 0),
];

export const TRAILS: XZ[][] = [
  // 0 pier
  [[-11, 6], [PIER[0][0], PIER[0][1]]],
  // 1 to the Sunken Tomb
  [[-1, 20], [-14, 32], [-30, 46], [-45, 56], [-53, 60]],
  // 2 the lake's west shore: from the tomb northward, leading to the old stone causeway
  [[-59, 54], [-72, 42], [-80, 22], [-80, 2], [-73, -11], [-65, -19]],
  // 3 east: Unlit Wood, Root Slope, Silkthread Vale
  [[32, 52], [46, 40], [60, 26], [70, 12], [78, -2], [82, -14], [82, -28], [79, -44], [72, -57], [62, -64]],
  // 4 plateau: in front of the tower <-> Silkthread Vale
  [[-17, -65], [-4, -72], [16, -74], [36, -72], [51, -67]],
  // 5 Moonlit Glade
  [[-11.5, -2], [2, -7], [11, -10]],
];

// ───────────────────────── Terrain ─────────────────────────

/** The cliff line of the northern plateau (z less than this is plateau) */
export const zEdge = (x: number) => -40 + 4 * Math.sin(x * 0.045 + 0.6) + 2.5 * Math.sin(x * 0.12);

/** The root slope climbing the plateau in the east */
const RA: XZ = [83, -22];
const RB: XZ = [77, -56];

function segDist(x: number, z: number, a: XZ, b: XZ): [number, number] {
  const ax = b[0] - a[0];
  const az = b[1] - a[1];
  const t = Math.min(1, Math.max(0, ((x - a[0]) * ax + (z - a[1]) * az) / (ax * ax + az * az)));
  return [Math.hypot(x - (a[0] + ax * t), z - (a[1] + az * t)), t];
}

export function polyDist(pts: XZ[], x: number, z: number): number {
  let m = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) m = Math.min(m, segDist(x, z, pts[i], pts[i + 1])[0]);
  return m;
}

export const lakeR = (a: number) => 24 + 3.5 * Math.sin(3 * a + 0.7) + 2 * Math.sin(5 * a - 1.1) + 1.2 * Math.sin(8 * a);
/** Distance to the lakeshore (negative inside the lake; the shoreline is about lakeR − 2.7) */
export function lakeEdge(x: number, z: number): number {
  const lx = x - LAKE[0];
  const lz = z - LAKE[1];
  return Math.hypot(lx, lz) - (lakeR(Math.atan2(lz, lx)) - 2.7);
}

/** Local coordinates of the tomb courtyard */
export function cryptLocal(x: number, z: number): [number, number] {
  const dx = x - CRYPT[0];
  const dz = z - CRYPT[1];
  const c = Math.cos(CRYPT_ROT);
  const s = Math.sin(CRYPT_ROT);
  return [dx * c + dz * s, -dx * s + dz * c];
}
export function cryptWorld(qx: number, qz: number): XZ {
  const c = Math.cos(CRYPT_ROT);
  const s = Math.sin(CRYPT_ROT);
  return [CRYPT[0] + qx * c - qz * s, CRYPT[1] + qx * s + qz * c];
}
/** Distance to the edge of the tomb courtyard (0 inside the courtyard) */
export function cryptDist(x: number, z: number): number {
  const [qx, qz] = cryptLocal(x, z);
  return Math.hypot(Math.max(Math.abs(qx) - CRYPT_HW, 0), Math.max(Math.abs(qz) - CRYPT_HD, 0));
}

/** Plateau fraction (0 lowland, 1 plateau top) */
export function upMask(x: number, z: number): number {
  const [u, v] = gorgeUV(x, z);
  const ze = zEdge(x);
  const north = sm(ze + 3, ze - 3, z);
  const tongue = (1 - sm(12, 16, Math.abs(v))) * (1 - sm(36, 42, u));
  return Math.max(north, tongue);
}

export function rawHeight(x: number, z: number): number {
  let h = 0.9 * Math.sin(x * 0.047 + 1.3) * Math.cos(z * 0.041 - 0.4) + 0.55 * Math.sin(x * 0.1 - z * 0.083) + 0.25 * Math.sin(x * 0.23 + z * 0.19);
  for (const [cx, cz, r, a] of HILLS) h += a * (1 - sm(r * 0.25, r, Math.hypot(x - cx, z - cz)));
  // The gentle slope the village sits on
  h += 1.0 * (1 - sm(12, 30, Math.hypot(x - TOWN[0], z - TOWN[1])));
  // The meadow is flatter
  h *= 1 - 0.55 * (1 - sm(10, 26, Math.hypot(x - MEADOW[0], z - MEADOW[1])));

  // ── Northern plateau: north of the cliff line it is high, at PLATEAU; the gorge cuts through the tongue of rock the
  // plateau sticks out, climbing gently from the lowland to the front of the tower
  const [u, v] = gorgeUV(x, z);
  const av = Math.abs(v);
  const ze = zEdge(x);
  const north = sm(ze + 3, ze - 3, z);
  const tongue = (1 - sm(12, 16, av)) * (1 - sm(36, 42, u));
  const up = Math.max(north, tongue);
  // The rock ridges on both sides of the gorge are a bit higher than the plateau
  const rim = 3.2 * sm(0, 10, u) * (1 - sm(34, 40, u)) * (1 - sm(10, 15, av)) * tongue;
  let hp = up * (PLATEAU + 0.8 * Math.sin(x * 0.07) * Math.cos(z * 0.09)) + rim;
  const floor = PLATEAU * (1 - sm(10, 40, u));
  hp += (floor - hp) * (1 - sm(6.5, 9.5, av));
  // The root slope in the east
  const [rd, rt] = segDist(x, z, RA, RB);
  hp += (PLATEAU * sm(0.05, 0.95, rt) - hp) * (1 - sm(4.5, 7.5, rd));
  h += hp;

  // Low ground outside the lake cannot go below the water surface (the whole map shares one water level), so it is propped up with a smooth floor
  if (h < 0.2) h = 0.2 - 0.6 * (1 - Math.exp((h - 0.2) / 0.6));

  // ── Shallows under Everdark Lake, Sunken Moon Isle, the old stone causeway and the pier
  const lx = x - LAKE[0];
  const lz = z - LAKE[1];
  const R = lakeR(Math.atan2(lz, lx));
  const bowl = 1 - sm(R - 11, R + 0.5, Math.hypot(lx, lz));
  h += (-5.2 - h) * bowl;
  const di = Math.hypot(x - ISLE[0], z - ISLE[1]);
  h += (0.7 + 0.2 * Math.sin(x * 0.8) * Math.cos(z * 0.7) - h) * (1 - sm(6, 10, di));
  const dc = polyDist(CAUSEWAY, x, z);
  if (dc < 3) h = Math.max(h, -0.88 - sm(1.2, 2.6, dc) * 5);
  const [pd, pt] = segDist(x, z, PIER[0], PIER[1]);
  if (pd < 1.6 && pt < 0.999) h = Math.max(h, -0.56);

  // ── Sunken Tomb: a raised mound all around, with a sunken courtyard in the middle
  const cd = cryptDist(x, z);
  h += 2.6 * sm(3.5, 6.5, cd) * (1 - sm(11, 20, cd));
  h += (CRYPT_FLOOR - h) * (1 - sm(0, 4.5, cd));
  // ── The hollow of Unlit Wood, the shallow valley of Silkthread Vale
  const dg = Math.hypot(x - GROVE[0], z - GROVE[1]);
  h -= 1.2 * (1 - sm(5, 16, dg));
  if (dg < 18) h = Math.max(h, -0.45);
  h -= 3.4 * (1 - sm(6, 15, Math.hypot(x - SILK[0], z - SILK[1])));
  // ── The stalagmite mounds at the foot of the stalactite-stalagmite pillars
  for (const [cx, cz, r] of COLUMNS) h += 1.3 * (1 - sm(r, r + 5, Math.hypot(x - cx, z - cz)));
  // ── Cave wall: the boundary is raised further, to join the ceiling
  const m = Math.max(Math.abs(x), Math.abs(z)) + Math.sin(x * 0.09 + z * 0.05) * 4;
  h += 16 * sm(S - 26, S - 2, m) + 3 * sm(S - 20, S, m) * Math.sin(x * 0.31 + z * 0.23);
  return h;
}

// ───────────────────────── Cave ceiling ─────────────────────────

/** Ceiling height: over 70 meters at the center, descending toward the cave wall to meet the cliffs; arched above the tower */
export function ceilH(x: number, z: number): number {
  const m = Math.max(Math.abs(x), Math.abs(z));
  let y = 72 + 4 * Math.sin(x * 0.031 + 0.5) * Math.cos(z * 0.027) + 2.5 * Math.sin(x * 0.083 - z * 0.061) + 1.2 * Math.sin(x * 0.21 + z * 0.17);
  y += 12 * (1 - sm(20, 64, Math.hypot(x - TOWER[0], z - TOWER[1])));
  y -= 44 * sm(S - 50, S + 12, m);
  y -= 14 * sm(S + 12, S + 36, m);
  return y;
}

export interface Crack {
  x: number;
  z: number;
  rx: number;
  rz: number;
  rot: number;
}

/** Cracks in the ceiling that let moonlight through */
export const CRACKS: Crack[] = [
  { x: TOWER[0], z: TOWER[1], rx: 19, rz: 15, rot: 0.4 },
  { x: GLADE[0], z: GLADE[1], rx: 8.5, rz: 4.2, rot: 0.6 },
  { x: FALLS[0], z: FALLS[1], rx: 6, rz: 2.8, rot: -0.3 },
  { x: CRYPT[0], z: CRYPT[1], rx: 7.5, rz: 2.4, rot: 1.1 },
  { x: SILK[0], z: SILK[1], rx: 6, rz: 3, rot: 0.2 },
  { x: 8, z: 42, rx: 5, rz: 1.8, rot: -0.7 },
];

// ───────────────────────── Lanterns along the road ─────────────────────────

export interface Lamp {
  x: number;
  z: number;
  /** The direction the lamp arm extends (toward the road) */
  face: number;
  /** lamp is a lantern post, dead is an extinguished lamp, stone is a stone lantern */
  kind: 'lamp' | 'dead' | 'stone';
}

function lampsAlong(pts: XZ[], every: number, off: number, kind: (s: number, x: number, z: number) => Lamp['kind'] | null, first = every * 0.5): Lamp[] {
  const sp = samplePath(pts, 1.5);
  const out: Lamp[] = [];
  let acc = 0;
  let next = first;
  let side = 1;
  for (let i = 1; i < sp.length; i++) {
    const [x0, z0] = sp[i - 1];
    const [x1, z1] = sp[i];
    acc += Math.hypot(x1 - x0, z1 - z0);
    if (acc < next) continue;
    next += every;
    const tl = Math.hypot(x1 - x0, z1 - z0) || 1;
    const nx = -(z1 - z0) / tl;
    const nz = (x1 - x0) / tl;
    const x = x1 + nx * off * side;
    const z = z1 + nz * off * side;
    const k = kind(acc, x, z);
    if (k) out.push({ x, z, face: Math.atan2(-nx * side, -nz * side), kind: k });
    side = -side;
  }
  return out;
}

const dTown = (x: number, z: number) => Math.hypot(x - TOWN[0], z - TOWN[1]);
const dTower = (x: number, z: number) => Math.hypot(x - TOWER[0], z - TOWER[1]);

export const LAMPS: Lamp[] = [
  // Main road: one lamp every 12 meters, alternating left and right; the village and the gorge are laid out separately
  ...lampsAlong(PATH, 12, 3.9, (_s, x, z) => {
    if (dTown(x, z) < TOWN_R + 3 || dTower(x, z) < 24) return null;
    const [u, v] = gorgeUV(x, z);
    if (u < GATE_U + 4 && Math.abs(v) < 12) return null;
    return 'lamp';
  }),
  // Stone lanterns in the gorge (between the stelae)
  ...[12, 19, 26, 33].map((u, i): Lamp => {
    const [x, z] = gorgeAt(u, i % 2 ? 5.4 : -5.4);
    return { x, z, face: 0, kind: 'stone' };
  }),
  // The path to the tomb
  ...lampsAlong(TRAILS[1], 15, 3.4, (_s, x, z) => (cryptDist(x, z) < 3 ? null : 'lamp'), 8),
  // The lake's west shore: only the first few are lit, and the rest are extinguished
  ...lampsAlong(TRAILS[2], 17, 3.4, (s) => (s < 20 ? 'lamp' : s < 70 ? 'dead' : null), 6),
  // East: still lit leaving the village, all out once inside Unlit Wood
  ...lampsAlong(TRAILS[3], 13, 3.6, (s) => (s < 28 ? 'lamp' : s < 90 ? 'dead' : null), 8),
  // Stone lanterns on the plateau
  ...lampsAlong(TRAILS[4], 15, 3.6, (s, x, z) => (dTower(x, z) < 24 || s > 64 ? null : 'stone'), 10),
];

/** A lit lamp (warm glow on the ground) */
export const LIT = LAMPS.filter((l) => l.kind !== 'dead');

// ───────────────────────── Randomness ─────────────────────────

/** A small reproducible random number generator (mulberry32) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sections that grow different props before and after purification run on an independent random stream: the main stream draws only one seed,
 * so the layout elsewhere (forest, cave wall, ...) is exactly the same before and after purification,
 * and the player does not see trees change places on coming back.
 */
export function isolated(ctx: { r: () => number }, fn: () => void): void {
  const main = ctx.r;
  ctx.r = rng(Math.floor(main() * 2147483647));
  try {
    fn();
  } finally {
    ctx.r = main;
  }
}

