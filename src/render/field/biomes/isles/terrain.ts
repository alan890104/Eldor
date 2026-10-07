// The terrain of Tidesong Isles: a string of islands floating on the sea (Harbor Isle, Lighthouse Cape, Palm Grove Isle,
// Hot Spring Isle, Icefield Isle, Windy Cape, Wreck Reef, Coral Atoll, Siren Reef),
// which gradually turns from warm beaches into an icefield from south to north. The islands are joined by "boardwalks"
// (narrow causeways raised above the water, planked with wood)
// and "shoals" (sandbars 20 cm under the water that can be waded across); everywhere else is deep water that cannot be crossed.

import * as THREE from 'three';
import { samplePath, smooth } from '../../compose.ts';
import type { XZ } from '../../kit.ts';

export const SIZE = 132;
export const WL = 0;
export const TOWN: XZ = [-6, 78];
export const TOWN_R = 15;
export const TOWER: XZ = [4, -88];
export const PATH_W = 2.2;

// ───────────────────────── Landmark positions ─────────────────────────

/** The lighthouse (on top of Lighthouse Cape) */
export const LIGHTHOUSE: XZ = [42.5, 66];
/** The deep-water anchorage in the harbor (in front of the quay) */
export const BASIN = { x: -9, z: 52, rx: 27, rz: 8.5 };
/** Springheart Pool (on the summit of Palm Grove Isle) */
export const POND: XZ = [-13, 17];
export const POND_R = 5.2;
/** Sacred Whale bones: head toward the north (the direction of the icefield), the spine following the main road */
export const WHALE_HEAD: XZ = [10.2, -10.5];
export const WHALE_TAIL: XZ = [6.4, 7.5];
/** Coral Atoll */
export const ATOLL = { x: -65, z: 40, R: 15, W: 3.4 };
/** Wreck Reef */
export const WRECK: XZ = [60, 16];
/** Windy Cape (sea stacks and seabirds) */
export const CAPE: XZ = [-54, -2];
/** Foghorn Hot Springs: travertine pools stepping down toward the north */
export const SPRINGS: { x: number; z: number; r: number; y: number }[] = [
  { x: 21, z: -24.5, r: 3.2, y: 2.35 },
  { x: 24.5, z: -28.6, r: 3.0, y: 1.85 },
  { x: 21.3, z: -32.8, r: 2.7, y: 1.35 },
  { x: 26, z: -33.8, r: 2.3, y: 0.85 },
];
/** Ice bay: the Order's black-sailed ship and the trapped Sacred Whale */
export const BAY = { x: -36, z: -88, rx: 17, rz: 11, rot: 0.55 };
export const SHIP: XZ = [-40, -90];
export const TRAPPED_WHALE: XZ = [-27, -96];
/** Siren Reef (secret realm): a lagoon ringed by sea stacks */
export const REEF = { x: -72, z: -52, R: 12 };
/** Penguin Ice Cliff (the icefield's east cape) */
export const ROOKERY: XZ = [53, -69];

// ───────────────────────── Roads ─────────────────────────

export const PATH: XZ[] = [
  [-6, 84],
  [-5, 70],
  [-4, 61],
  [-2, 51],
  [0, 42],
  [1, 33],
  [-2, 24],
  [1, 14],
  [6, 5],
  [8.3, -3],
  [10, -13],
  [12, -21],
  [14, -27],
  [11, -36],
  [8, -46],
  [6, -56],
  [4.5, -63],
  [3.4, -68],
];

export const TRAILS: XZ[][] = [
  // Town -> fishing harbor
  [[-13, 74], [-22, 67.5], [-31, 64]],
  // Fishing harbor -> Coral Atoll (shoal)
  [[-31, 64], [-40, 60], [-48, 55], [-54, 50.5]],
  // Town -> lighthouse
  [[2, 77], [14, 75], [26, 71.5], [34, 68], [39.5, 66.5]],
  // Palm Grove Isle -> Wreck Reef (boardwalk)
  [[4, 10], [16, 12], [28, 14], [40, 15.5], [52, 17]],
  // Palm Grove Isle -> Windy Cape (shoal)
  [[-3, 9], [-16, 7], [-28, 4], [-38, 1.5], [-45, 0]],
  // Icefield east: Penguin Ice Cliff
  [[6, -60], [18, -63], [31, -65.5], [43, -67]],
  // Icefield west: Ice Bay Overlook
  [[5.4, -62], [-6, -67], [-14, -74]],
];

/** A shoal that can be walked but is not drawn as a road: the secret sandbar leading to Siren Reef */
export const HIDDEN_BAR: XZ[] = [[-59, -11], [-63, -22], [-66.5, -32], [-66, -41.5]];

/** Quays that can be walked onto (not counted as roads, just raised narrow causeways): the fishing harbor's two piers */
export const PIERS: XZ[][] = [
  [[-26, 61], [-27.2, 54], [-28.5, 47]],
  [[-37, 61], [-39, 55], [-41, 49]],
];

/** Road segments over water inside these circles are shoals; the others are boardwalks */
const WADE: [number, number, number][] = [
  [10, -12, 11],
  [-39, 60, 8],
  [-48, 54, 9],
  [-28, 3.5, 14],
];

// ───────────────────────── Noise ─────────────────────────

function hash2(i: number, j: number): number {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function vnoise(x: number, z: number): number {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fx = x - i;
  const fz = z - j;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j);
  const b = hash2(i + 1, j);
  const c = hash2(i, j + 1);
  const d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, z: number): number {
  return vnoise(x, z) * 0.5 + vnoise(x * 2.03 + 17.1, z * 2.03 + 9.4) * 0.3 + vnoise(x * 4.1 + 3.3, z * 4.1 + 31.7) * 0.2;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smax = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
};
const smin = (a: number, b: number, k: number) => -smax(-a, -b, k);

/** How cold it is: 0 is the warm south, 1 is the northern icefield (with a bit of noise at the boundary) */
export function cold(x: number, z: number): number {
  return smooth(-18, -46, z + (fbm(x * 0.05 + 3, z * 0.05) - 0.5) * 18);
}

// ───────────────────────── Islands ─────────────────────────

interface Isle {
  x: number;
  z: number;
  rx: number;
  rz: number;
  rot: number;
  /** Inland height */
  top: number;
  /** Relief */
  hill: number;
  /** Steepness of the coast (0 beach, 1 cliff), which can vary by position */
  cliff: (x: number, z: number) => number;
  wob: number;
  seed: number;
  /** Length multiplier of the gentle slope (default 1) */
  rise?: number;
  /** Inland height varying by position (a tilted plateau); if absent, use top */
  topAt?: (x: number, z: number) => number;
}

const flatCliff = (c: number) => () => c;

const ISLES: Isle[] = [
  // Harbor Isle: where Lighthouse Harbor is, with the quay on the north shore and a beach on the south shore
  { x: -6, z: 81, rx: 47, rz: 19, rot: 0.02, top: 2.2, hill: 1.6, cliff: flatCliff(0), wob: 0.07, seed: 1 },
  // Lighthouse Cape: the east and south sides facing the sea are cliffs, and the west side facing the town is a gentle slope
  {
    x: 38,
    z: 68.5,
    rx: 18.5,
    rz: 12.5,
    rot: -0.4,
    top: 7.2,
    hill: 0.6,
    cliff: (x) => smooth(30, 47, x) * 0.95,
    wob: 0.1,
    seed: 2,
    topAt: (x) => lerp(2.6, 7.4, smooth(27, 41, x)),
  },
  // Palm Grove Isle: the large central island, with its west half rising into a small hill
  { x: 0, z: 16, rx: 30, rz: 17.5, rot: 0.12, top: 2.4, hill: 2.2, cliff: flatCliff(0.05), wob: 0.1, seed: 3 },
  // Hot Spring Isle: where warm meets cold
  { x: 14, z: -30, rx: 17.5, rz: 10.5, rot: -0.25, top: 2.1, hill: 0.8, cliff: flatCliff(0.2), wob: 0.1, seed: 4 },
  // Icefield Isle: ice cliffs all around, with only the middle of the south side (where the wooden bridge comes ashore) a gentle slope
  {
    x: 2,
    z: -83,
    rx: 66,
    rz: 26,
    rot: 0.03,
    top: 3.9,
    hill: 1.6,
    cliff: (x, z) => 0.92 - 0.92 * Math.exp(-(((x - 7) / 13) ** 2)) * smooth(-72, -62, z),
    wob: 0.11,
    seed: 5,
  },
  // Icefield east cape: the ice cliff where the penguins live
  { x: 51, z: -66, rx: 18, rz: 11, rot: 0.35, top: 3.0, hill: 1.0, cliff: (x, z) => 0.3 + 0.6 * smooth(-62, -74, z) + 0.3 * smooth(56, 68, x), wob: 0.12, seed: 6 },
  // Windy Cape: a tall headland in the west, with a gentle slope on the east side that can be climbed
  {
    x: -55,
    z: -2,
    rx: 17,
    rz: 12,
    rot: 0.3,
    top: 7.4,
    hill: 0.9,
    cliff: (x) => 0.08 + 0.84 * smooth(-60, -70, x),
    wob: 0.1,
    seed: 7,
    topAt: (x) => lerp(1.4, 7.8, smooth(-46, -67, x)),
  },
  // Wreck Reef: a low flat sandbar
  { x: 60, z: 16, rx: 13, rz: 8.5, rot: 0.3, top: 0.75, hill: 0.25, cliff: flatCliff(0), wob: 0.14, seed: 8 },
  // Small islands in the open sea (not reachable, so the sea is not empty)
  { x: 86, z: 52, rx: 8, rz: 5.5, rot: 0.6, top: 1.2, hill: 0.4, cliff: flatCliff(0), wob: 0.15, seed: 9 },
  { x: -90, z: 78, rx: 7, rz: 5, rot: -0.3, top: 1.0, hill: 0.3, cliff: flatCliff(0), wob: 0.15, seed: 10 },
  { x: 88, z: -24, rx: 7, rz: 6, rot: 0.2, top: 2.6, hill: 0.8, cliff: flatCliff(0.7), wob: 0.2, seed: 11 },
  { x: -92, z: 14, rx: 6, rz: 8, rot: 0.1, top: 3.5, hill: 0.8, cliff: flatCliff(0.85), wob: 0.2, seed: 12 },
];

/**
 * Island height: compute the distance from the coast along a ray; on land it goes beach -> gentle slope -> inland,
 * and in the sea a ring of wadeable shelf -> deep water
 */
function isleHeight(I: Isle, x: number, z: number): number {
  const dx = x - I.x;
  const dz = z - I.z;
  const c = Math.cos(I.rot);
  const s = Math.sin(I.rot);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const u = lx / I.rx;
  const v = lz / I.rz;
  const rho = Math.hypot(lx, lz);
  const th = Math.atan2(v, u);
  const wob =
    1 +
    I.wob * (Math.sin(th * 3 + I.seed) * 0.5 + Math.sin(th * 5 + I.seed * 2.1) * 0.3 + Math.sin(th * 9 + I.seed * 0.7) * 0.2) +
    (fbm(x * 0.07 + I.seed * 7.3, z * 0.07) - 0.5) * 0.14;
  const d = Math.hypot(u, v) / wob;
  // Beyond twice the radius, treat it as deep sea
  if (d > 2.2) return -4.5;
  const R = d > 1e-4 ? rho / d : 1e6;
  const inside = R - rho;
  // The coast's steepness is taken at the point where this ray meets the coast (so the profile along one ray stays consistent)
  const k = rho > 1e-4 ? R / rho : 0;
  const cl = Math.min(1, Math.max(0, I.cliff(I.x + dx * k, I.z + dz * k)));
  if (inside >= 0) {
    // The gentle-slope and cliff profiles are computed separately and then blended by steepness (the slope length is fixed
    // and is not squeezed by direction),
    // and every ray climbs to the inland height before reaching the island's center, so the center shows no fault line
    const top = I.topAt ? I.topAt(x, z) : I.top;
    const spanG = Math.min(19 * (I.rise ?? 1), R * 0.8);
    const bwG = Math.min(7, spanG * 0.4);
    const gentle = 0.95 * smooth(0, bwG, inside) + (top - 0.95) * smooth(bwG, spanG, inside);
    const spanC = Math.min(3.6, R * 0.8);
    const bwC = Math.min(1.6, spanC * 0.4);
    const steep = 0.3 * smooth(0, bwC, inside) + (top - 0.3) * smooth(bwC, spanC, inside);
    let h = lerp(gentle, steep, cl);
    h += I.hill * (fbm(x * 0.045 + I.seed, z * 0.045 - I.seed) - 0.38) * 2 * smooth(bwG, Math.max(spanG + 0.5, Math.min(spanG + 10, R * 0.95)), inside);
    return h;
  }
  const e = -inside;
  const shelf = lerp(3.2, 0.5, cl);
  return -0.32 * smooth(0, 1.2, e) - 4.2 * smooth(shelf, shelf + 7, e);
}

/** Coral Atoll: a ring of sand, with a wadeable lagoon inside the ring (with a few blue holes) and a gap on the south side */
function atollHeight(x: number, z: number): number {
  const dx = x - ATOLL.x;
  const dz = z - ATOLL.z;
  const rho = Math.hypot(dx, dz);
  if (rho > ATOLL.R + 20) return -4.5;
  const th = Math.atan2(dz, dx);
  const R = ATOLL.R * (1 + 0.07 * Math.sin(th * 3 + 1) + 0.04 * Math.sin(th * 5 + 2));
  let da = Math.abs(th - 1.95);
  if (da > Math.PI) da = Math.PI * 2 - da;
  const W = ATOLL.W * (0.75 + 0.5 * fbm(x * 0.1, z * 0.1)) * smooth(0.25, 0.6, da);
  const s = Math.abs(rho - R);
  const inBand = W - s;
  if (inBand >= 0) return 0.95 * smooth(0, 2.6, inBand) + 0.35 * smooth(2.6, 4, inBand);
  if (rho < R) {
    // Lagoon: mostly knee deep, with a few deeper blue holes
    let floor = -0.34;
    for (const [hx, hz, hr] of [[-66, 34, 3.2], [-60, 44, 2.4], [-70, 42, 2.2]] as const) floor -= 1.8 * (1 - smooth(hr * 0.5, hr, Math.hypot(x - hx, z - hz)));
    return lerp(0, floor, smooth(0, 1.6, -inBand));
  }
  const e = -inBand;
  return -0.32 * smooth(0, 1.2, e) - 4.2 * smooth(3, 12, e);
}

/** Siren Reef: a ring of shallow reef in the middle of the deep sea, with a small patch of sand at the center */
function reefHeight(x: number, z: number): number {
  const rho = Math.hypot(x - REEF.x, z - REEF.z);
  if (rho > REEF.R + 12) return -4.5;
  const R = REEF.R * (1 + 0.06 * Math.sin(Math.atan2(z - REEF.z, x - REEF.x) * 4));
  const islet = 0.75 * (1 - smooth(2.5, 5, rho));
  return -0.36 + islet - 4.2 * smooth(R, R + 6, rho);
}

/** The dug-out ice bay: ice cliffs all around, opening to the northwest */
function bayCarve(x: number, z: number): number {
  const c = Math.cos(BAY.rot);
  const s = Math.sin(BAY.rot);
  const dx = x - BAY.x;
  const dz = z - BAY.z;
  const u = (dx * c - dz * s) / BAY.rx;
  const v = (dx * s + dz * c) / BAY.rz;
  const d = Math.hypot(u, v) * (1 + (fbm(x * 0.12, z * 0.12) - 0.5) * 0.18);
  // Bay mouth: extending to the sea toward the northwest
  const t = Math.max(0, Math.min(1, ((x - BAY.x) * -0.72 + (z - BAY.z) * -0.69) / 34));
  const mx = BAY.x - 0.72 * 34 * t;
  const mz = BAY.z - 0.69 * 34 * t;
  const dm = Math.hypot(x - mx, z - mz) / (10 + 6 * t);
  const k = Math.min(d, dm);
  return lerp(-4.2, 99, smooth(0.9, 1.05, k));
}

/** The islands themselves (without the boardwalks and shoals yet) */
export function baseHeight(x: number, z: number): number {
  let h = -4.5 + (fbm(x * 0.03, z * 0.03) - 0.5) * 1.2;
  for (const I of ISLES) h = smax(h, isleHeight(I, x, z), 1.2);
  h = smax(h, atollHeight(x, z), 1.0);
  h = smax(h, reefHeight(x, z), 1.0);
  // The small hill on the west side of Palm Grove Isle and Springheart Pool on its summit
  const dp = Math.hypot(x - POND[0], z - POND[1]);
  h += 3.2 * (1 - smooth(4, 17, dp));
  const rim = POND_R + 1.1;
  if (dp < rim + 3) {
    const bowl = 1 - smooth(POND_R - 1.5, rim, dp);
    h -= bowl * 0.7;
  }
  // Hot Spring Isle: travertine pools stepping down (the pool floor is below the water surface and the pool rim is raised)
  for (const p of SPRINGS) {
    const dd = Math.hypot(x - p.x, z - p.z);
    if (dd > p.r + 5) continue;
    const pad = 1 - smooth(p.r + 0.6, p.r + 3.5, dd);
    h = lerp(h, p.y + 0.2, pad);
    h -= 0.5 * (1 - smooth(p.r - 1.4, p.r - 0.2, dd));
  }
  // Harbor anchorage: dug deeper in front of the quay, so the shore is a crisp embankment
  {
    const u = (x - BASIN.x) / BASIN.rx;
    const v = (z - BASIN.z) / BASIN.rz;
    const d = Math.hypot(u, v) * (1 + (fbm(x * 0.1, z * 0.1) - 0.5) * 0.2);
    if (d < 1.6) h = smin(h, lerp(-9, 99, smooth(0.85, 1.25, d)), 1.5);
  }
  // Ice bay
  if (Math.hypot(x - BAY.x, z - BAY.z) < 60) h = smin(h, bayCarve(x, z), 1.2);
  return h;
}

// ───────────────────────── Boardwalks and shoals ─────────────────────────

/** Segment index: query the distance to the nearest segment */
class SegIndex {
  private cell = 8;
  private grid = new Map<number, number[]>();
  readonly segs: number[] = [];
  add(ax: number, az: number, bx: number, bz: number): void {
    const k = this.segs.length / 4;
    this.segs.push(ax, az, bx, bz);
    const pad = 12;
    const c = this.cell;
    for (let i = Math.floor((Math.min(ax, bx) - pad) / c); i <= Math.floor((Math.max(ax, bx) + pad) / c); i++) {
      for (let j = Math.floor((Math.min(az, bz) - pad) / c); j <= Math.floor((Math.max(az, bz) + pad) / c); j++) {
        const key = i * 4096 + j;
        const a = this.grid.get(key);
        if (a) a.push(k);
        else this.grid.set(key, [k]);
      }
    }
  }
  dist(x: number, z: number): number {
    const list = this.grid.get(Math.floor(x / this.cell) * 4096 + Math.floor(z / this.cell));
    if (!list) return 99;
    let best = 99;
    const s = this.segs;
    for (const k of list) {
      const ax = s[k * 4];
      const az = s[k * 4 + 1];
      const bx = s[k * 4 + 2];
      const bz = s[k * 4 + 3];
      const vx = bx - ax;
      const vz = bz - az;
      const l2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
      const d = Math.hypot(x - ax - vx * t, z - az - vz * t);
      if (d < best) best = d;
    }
    return best;
  }
}

const inWade = (x: number, z: number) => WADE.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r);

/** Sample points of the roads (main road + paths), using the same sampling as compose */
export const ROADS: XZ[][] = [samplePath(PATH), ...TRAILS.map((t) => samplePath(t))];
const roadIdx = new SegIndex();
const deckIdx = new SegIndex();
const wadeIdx = new SegIndex();
const pierIdx = new SegIndex();
const barIdx = new SegIndex();

/** Boardwalk road sections (for props): each section is a run of consecutive sample points */
export const DECKS: XZ[][] = [];

for (const road of ROADS) {
  let run: XZ[] = [];
  for (let i = 0; i + 1 < road.length; i++) {
    const [ax, az] = road[i];
    const [bx, bz] = road[i + 1];
    roadIdx.add(ax, az, bx, bz);
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    if (inWade(mx, mz)) wadeIdx.add(ax, az, bx, bz);
    else deckIdx.add(ax, az, bx, bz);
    // Boardwalk: road sections that are over water (or on a very low shore) and not shoals
    const wet = baseHeight(mx, mz) < 0.5 && !inWade(mx, mz);
    if (wet) {
      if (!run.length) run.push(road[i]);
      run.push(road[i + 1]);
    } else if (run.length) {
      DECKS.push(run);
      run = [];
    }
  }
  if (run.length) DECKS.push(run);
}
// Ones that are too short (just a small stretch of shore) do not count as a boardwalk
for (let i = DECKS.length - 1; i >= 0; i--) {
  const run = DECKS[i];
  let len = 0;
  for (let k = 1; k < run.length; k++) len += Math.hypot(run[k][0] - run[k - 1][0], run[k][1] - run[k - 1][1]);
  if (len < 6) DECKS.splice(i, 1);
}
for (const p of PIERS) {
  const pts = samplePath(p, 1);
  for (let i = 0; i + 1 < pts.length; i++) pierIdx.add(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
}
const barPts = samplePath(HIDDEN_BAR, 1.2);
for (let i = 0; i + 1 < barPts.length; i++) barIdx.add(barPts[i][0], barPts[i][1], barPts[i + 1][0], barPts[i + 1][1]);

/** Distance to the road centerline */
export const roadDist = (x: number, z: number) => roadIdx.dist(x, z);
export const DECK_Y = 0.42;

/** Raw terrain height (compose will further flatten the roads, level the town and tower base, and sink the surroundings into the sea) */
export function islesHeight(x: number, z: number): number {
  const base = baseHeight(x, z);
  let h = base;
  // Boardwalk: raised in the middle to above the water, and dug toward deep water on both sides (so after the road is
  // flattened the two sides do not become one big shoal)
  const dd = deckIdx.dist(x, z);
  if (dd < 8) {
    if (dd < 2.05) h = Math.max(h, DECK_Y);
    else {
      const deep = smooth(-0.4, -1.8, base) * (1 - smooth(4.5, 8, dd));
      h = Math.max(h, lerp(DECK_Y, -99, smooth(2.05, 2.5, dd)));
      h = lerp(h, Math.min(h, -8), deep * smooth(2.05, 3.0, dd));
    }
  }
  // Shoal: a sandbar 20 cm under the water, slowly getting deeper to both sides
  const dw = wadeIdx.dist(x, z);
  if (dw < 11) h = Math.max(h, lerp(-0.2, -4.5, smooth(2.6, 10, dw)));
  const db = barIdx.dist(x, z);
  if (db < 9) h = Math.max(h, lerp(-0.28, -4.5, smooth(1.5, 7, db)));
  // Pier: a narrow strip, not flattened by the road
  const dp = pierIdx.dist(x, z);
  if (dp < 3) h = dp < 1.25 ? Math.max(h, DECK_Y) : Math.max(h, lerp(DECK_Y, -4.5, smooth(1.25, 1.9, dp)));
  return h;
}

/** The pier's centerline (for props) */
export const PIER_LINES: XZ[][] = PIERS.map((p) => samplePath(p, 1));

// ───────────────────────── Ground coloring ─────────────────────────

const C = (h: number) => new THREE.Color(h);
const SNOW = C(0xf1f6fd);
const SNOW_SHADE = C(0xd6e4f2);
const ICE = C(0x8fcbeb);
const ICE_DEEP = C(0x5fa8d8);
const SHINGLE = C(0xa9b3bf);
const WET_SAND = C(0xd8c08c);
const PACKED = C(0xc4d3e2);
const REEF_COLS = [C(0xf08c9c), C(0x6fd0b6), C(0xb99cf0), C(0xf6c56a)];
const SEABED_N = C(0x566a80);
const TRAVERTINE = C(0xf2e6cc);
const OCHRE = C(0xd88a52);
const LILAC = C(0xb8a6e6);
const TOWER_STONE = C(0xd4e0ec);
const ABYSS = C(0x14406a);
const POND_BED = C(0x5a9a7a);
const STRATA_A = C(0x8a94a4);
const STRATA_B = C(0xb4a48c);
const MOSS = C(0x7aa86a);
const GRASS_SLOPE = C(0x5ea650);
const _c = new THREE.Color();

/** Warmth near the hot springs: the snow melts */
function springWarmth(x: number, z: number): number {
  let w = 0;
  for (const p of SPRINGS) w = Math.max(w, 1 - smooth(p.r + 2, p.r + 9, Math.hypot(x - p.x, z - p.z)));
  return w;
}

export function islesPaint(x: number, z: number, h: number, slope: number, out: THREE.Color): void {
  const k = cold(x, z) * (1 - springWarmth(x, z) * 0.85);
  // South: a grassy slope that is merely a bit steep is still grass (the engine paints slopes of 0.55 and above as rock
  // wall, and here it is covered back), and only real sea cliffs show layer after layer of rock strata
  if (slope > 0.45 && k < 0.8) {
    const grassy = (1 - k) * smooth(1.1, 1.7, h) * smooth(0.45, 0.6, slope) * (1 - smooth(0.8, 1.1, slope));
    if (grassy > 0) out.lerp(GRASS_SLOPE, grassy * 0.9);
    _c.copy(STRATA_A).lerp(STRATA_B, 0.5 + 0.5 * Math.sin(h * 2.3 + fbm(x * 0.1, z * 0.1) * 3));
    out.lerp(_c, smooth(0.8, 1.15, slope) * (1 - k) * 0.85);
  }
  const n = fbm(x * 0.09, z * 0.09);
  // South: wet sand near the waterline, coral patches under water
  if (k < 1) {
    const w = (1 - k) * (1 - smooth(0.05, 0.4, h)) * smooth(-0.6, -0.05, h);
    if (w > 0) out.lerp(WET_SAND, w * 0.55);
    if (h < -0.2) {
      const m = fbm(x * 0.16 + 40, z * 0.16);
      const pick = REEF_COLS[Math.floor(fbm(x * 0.05 - 9, z * 0.05 + 4) * 4) % 4];
      const amt = (1 - k) * smooth(0.52, 0.66, m) * smooth(-0.2, -0.7, h) * (1 - smooth(-2.2, -3.6, h));
      if (amt > 0) out.lerp(pick, amt * 0.7);
    }
  }
  // North: snow cover, ice cliffs, gray gravel beaches, the dark bedrock under water
  if (k > 0) {
    const onLand = smooth(0.25, 0.9, h);
    _c.copy(SNOW).lerp(SNOW_SHADE, smooth(0.35, 0.75, n));
    out.lerp(_c, k * onLand * (1 - smooth(0.55, 0.85, slope)) * 0.96);
    _c.copy(ICE).lerp(ICE_DEEP, smooth(0.4, 0.7, fbm(x * 0.2, z * 0.2 + h * 0.3)));
    out.lerp(_c, k * smooth(0.5, 0.9, slope) * smooth(0.2, 0.8, h));
    out.lerp(SHINGLE, k * (1 - onLand) * smooth(-0.3, 0.1, h) * 0.8);
    out.lerp(SEABED_N, k * smooth(-0.3, -1.2, h) * 0.7);
    const pd = roadDist(x, z);
    out.lerp(PACKED, k * (1 - smooth(PATH_W * 0.6, PATH_W + 0.8, pd)) * onLand * 0.85);
  }
  // The floor of Springheart Pool: moss color
  const dpd = Math.hypot(x - POND[0], z - POND[1]);
  if (dpd < POND_R + 1.5) out.lerp(POND_BED, (1 - smooth(POND_R - 0.5, POND_R + 1.2, dpd)) * 0.9);
  // Deep-water seabed: blends into the color of the sea
  out.lerp(ABYSS, smooth(-1.8, -3.6, h) * 0.9);
  // Hot springs: white travertine and orange mineral streaks
  for (const p of SPRINGS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d > p.r + 5) continue;
    const t = 1 - smooth(p.r + 1, p.r + 4, d);
    out.lerp(MOSS, (1 - smooth(p.r + 3, p.r + 8, d)) * (1 - t) * 0.7);
    out.lerp(TRAVERTINE, t * 0.9);
    out.lerp(OCHRE, t * smooth(0.5, 0.66, fbm(x * 0.5, z * 0.5)) * 0.65);
  }
  // The plaza in front of the tower: ice-blue flagstones
  const dt = Math.hypot(x - TOWER[0], z - TOWER[1]);
  if (dt < 20) out.lerp(TOWER_STONE, (1 - smooth(14, 19, dt)) * 0.75);
  // Siren Reef: pale purple sand
  const dr = Math.hypot(x - REEF.x, z - REEF.z);
  if (dr < REEF.R + 6) out.lerp(LILAC, (1 - smooth(REEF.R - 2, REEF.R + 5, dr)) * 0.55);
  void slope;
}

/** Grass coverage: grows only inland in the south (not on beaches or the icefield) */
export function grassCover(x: number, z: number, h: number): number {
  const k = cold(x, z) * (1 - springWarmth(x, z) * 0.9);
  for (const p of SPRINGS) if (Math.hypot(x - p.x, z - p.z) < p.r + 1.6) return 0;
  if (k > 0.85) return 0;
  const dp = Math.hypot(x - POND[0], z - POND[1]);
  if (dp < POND_R + 0.8) return 0;
  return (1 - smooth(0.3, 0.85, k)) * smooth(1.05, 1.7, h) * (0.45 + 0.55 * smooth(0.3, 0.55, fbm(x * 0.07, z * 0.07)));
}
