// Thunderpeal Plains terrain: the positions of the landmarks on the map, the roads, the course of Thunder Creek,
// the rolling swells of the grassland, the pillar terrace, the Thunderpeal Dais that the Seal Tower stands on,
// the landforms of the Scorched Glass Flats and the secret realm "Thunderfall Heart";
// also the precomputed distance fields used for ground coloring (road ruts, the creek channel, the branching scorch marks of lightning strikes),
// and the fixed positions of the pillars.

import { rng } from '../../../arenaKit.ts';
import { samplePath, smooth } from '../../compose.ts';
import type { XZ } from '../../kit.ts';

/** Half side length of the map */
export const S = 120;
export const WATER = -1.0;
export const PATH_W = 2.2;

// ── Landmarks
export const TOWN: XZ = [-50, 78]; // Nomad Camp
export const TOWER: XZ = [52, -74]; // Thunderpeal Seal Tower (Thunderpeal Dais)
export const LONE: XZ = [-80, 40]; // Lone Tree Hill
export const RODS: XZ = [-54, -48]; // terrace of the lightning-rod pillar grove
export const BONES: XZ = [8, -13.5]; // skeleton of the ancient thunderbeast (the main road passes through its chest cavity)
export const SCAR: XZ = [70, -8]; // Scorched Glass Flats
export const TORS: XZ = [46, 60]; // boulder group of Thundermane Run
export const OLDCAMP: XZ = [14, 70]; // old camp left behind by the migration
export const HEART: XZ = [-86, -86]; // secret realm: Thunderfall Heart
export const SPRING: XZ = [-90, -14]; // source of Thunder Creek
export const MARSH: XZ = [80, 40]; // marsh that Thunder Creek flows into
export const FORD1: XZ = [-9, 19]; // ford of the main road
export const FORD2: XZ = [40, 25]; // ford of the eastern trail

/** Direction in front of the Seal Tower's gate (tower → town) */
const tdx = TOWN[0] - TOWER[0];
const tdz = TOWN[1] - TOWER[1];
const tdl = Math.hypot(tdx, tdz);
export const TOWER_DIR: XZ = [tdx / tdl, tdz / tdl];
export const towerAt = (d: number): XZ => [TOWER[0] + TOWER_DIR[0] * d, TOWER[1] + TOWER_DIR[1] * d];

// ── Roads
export const MAIN_PATH: XZ[] = [
  [-46, 75],
  [-41, 66],
  [-35, 56],
  [-27, 45],
  [-19, 33],
  FORD1,
  [-2.5, 6.5],
  [5.5, -6],
  [8, -13.5],
  [10.5, -21],
  [16, -28.5],
  towerAt(46),
  towerAt(34),
  towerAt(24.5),
  towerAt(17),
];

export const TRAILS: XZ[][] = [
  // To the west: Lone Tree Hill
  [[-19, 33], [-34, 31], [-50, 35], [-63, 38], [-72, 40]],
  // To the northwest: the pillar terrace (up the gentle slope on the terrace's southeast side)
  [[-2.5, 6.5], [-14, -5], [-27, -17], [-38, -28], [-48, -40]],
  // To the east: Scorched Glass Flats
  [[16, -28.5], [30, -21], [45, -12], [60, -8]],
  // Migration road: from the town eastward, past the old camp to the boulder group
  [[-38, 86], [-20, 83], [-2, 77], [14, 70], [30, 64], [42, 57]],
  // From the boulder group north, wading across Thunder Creek, to join the Scorched Glass Flats
  [[42, 57], [44, 42], FORD2, [47, 11], [60, -8]],
];

/** Roads with ruts (the main road and the migration road) */
const RUTTED = [MAIN_PATH, TRAILS[3]];

// ── Thunder Creek: flows from a spring below the western cliff, winds east, and finally runs into the marsh
export const CREEK: XZ[] = [
  SPRING,
  [-80, -8],
  [-70, -9],
  [-59, -2],
  [-47, 6],
  [-35, 6],
  [-22, 12],
  FORD1,
  [3, 16],
  [15, 21],
  [28, 27],
  FORD2,
  [52, 30],
  [64, 35],
  [74, 38],
  MARSH,
];

// ───────────────────────── Distance fields ─────────────────────────

/** Grid data covering the whole map, queried with bilinear interpolation */
class Grid {
  readonly n: number;
  readonly data: Float32Array;
  readonly x0: number;
  readonly z0: number;
  readonly res: number;
  constructor(x0: number, z0: number, span: number, res: number, fill = 0) {
    this.x0 = x0;
    this.z0 = z0;
    this.res = res;
    this.n = Math.round(span / res) + 1;
    this.data = new Float32Array(this.n * this.n).fill(fill);
  }
  at(x: number, z: number): number {
    const n = this.n;
    const fx = Math.min(n - 1.001, Math.max(0, (x - this.x0) / this.res));
    const fz = Math.min(n - 1.001, Math.max(0, (z - this.z0) / this.res));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const d = this.data;
    return d[j * n + i] * (1 - u) * (1 - v) + d[j * n + i + 1] * u * (1 - v) + d[(j + 1) * n + i] * (1 - u) * v + d[(j + 1) * n + i + 1] * u * v;
  }
}

/** Distance field to a set of polylines (sample points); anything beyond cap is recorded as cap */
function distanceGrid(lines: XZ[][], cap: number, res = 1, step = 1): Grid {
  const g = new Grid(-S, -S, S * 2, res, cap);
  const pts = lines.flatMap((l) => samplePath(l, step));
  const cell = 8;
  const buckets = new Map<number, XZ[]>();
  const key = (i: number, j: number) => i * 4096 + j;
  for (const p of pts) {
    const k = key(Math.floor(p[0] / cell), Math.floor(p[1] / cell));
    const b = buckets.get(k);
    if (b) b.push(p);
    else buckets.set(k, [p]);
  }
  const reach = Math.ceil(cap / cell);
  for (let j = 0; j < g.n; j++) {
    for (let i = 0; i < g.n; i++) {
      const x = g.x0 + i * res;
      const z = g.z0 + j * res;
      const ci = Math.floor(x / cell);
      const cj = Math.floor(z / cell);
      let best = cap * cap;
      for (let a = -reach; a <= reach; a++) {
        for (let c = -reach; c <= reach; c++) {
          const list = buckets.get(key(ci + a, cj + c));
          if (!list) continue;
          for (const p of list) {
            const d = (p[0] - x) ** 2 + (p[1] - z) ** 2;
            if (d < best) best = d;
          }
        }
      }
      g.data[j * g.n + i] = Math.sqrt(best);
    }
  }
  return g;
}

let roadG: Grid | null = null;
let rutG: Grid | null = null;
let creekG: Grid | null = null;
/**
 * Distance to the roads (main road + trails) (for terrain and coloring; same algorithm as the engine's pathDist, but precomputed)
 */
export const roadDist = (x: number, z: number) => (roadG ??= distanceGrid([MAIN_PATH, ...TRAILS], 24)).at(x, z);
/** Distance to the centerline of the rutted roads */
export const rutDist = (x: number, z: number) => (rutG ??= distanceGrid(RUTTED, 6)).at(x, z);
/** Distance to the centerline of the Thunder Creek channel */
export const creekDist = (x: number, z: number) => (creekG ??= distanceGrid([CREEK], 40, 1, 0.8)).at(x, z);

// ───────────────────────── Branching scorch marks of lightning strikes (Lichtenberg figures) ─────────────────────────

export interface Seg {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  w: number;
}

/** Discharge branches growing outward from the center: each branch wanders and forks as it goes, getting thinner farther out */
export function lichtenberg(cx: number, cz: number, R: number, arms: number, seed: number): Seg[] {
  const r = rng(seed);
  const segs: Seg[] = [];
  const grow = (x: number, z: number, a: number, w: number, len: number, depth: number) => {
    let px = x;
    let pz = z;
    const steps = Math.max(2, Math.round(len / 1.05));
    for (let i = 0; i < steps; i++) {
      // Bias toward growing outward, so the pattern is radial
      const out = Math.atan2(pz - cz, px - cx);
      let da = out - a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      a += (r() - 0.5) * 1.1 + da * 0.12;
      const st = 0.7 + r() * 0.7;
      const nx = px + Math.cos(a) * st;
      const nz = pz + Math.sin(a) * st;
      if (Math.hypot(nx - cx, nz - cz) > R) break;
      const ww = w * (1 - (i / steps) * 0.55);
      segs.push({ x0: px, z0: pz, x1: nx, z1: nz, w: ww });
      px = nx;
      pz = nz;
      if (depth < 4 && r() < 0.2 - depth * 0.02) grow(px, pz, a + (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.6), ww * 0.66, len * (0.3 + r() * 0.35) * (1 - i / steps * 0.4), depth + 1);
    }
  };
  for (let k = 0; k < arms; k++) {
    const a = (k / arms) * Math.PI * 2 + (r() - 0.5) * 0.7;
    grow(cx + Math.cos(a) * 1.2, cz + Math.sin(a) * 1.2, a, 0.75 + r() * 0.35, R * (0.65 + r() * 0.35), 0);
  }
  return segs;
}

/** Draw line segments into a local grid (values 0~1, highest at the line's center) */
function rasterize(segs: Seg[], cx: number, cz: number, half: number, res: number): Grid {
  const g = new Grid(cx - half, cz - half, half * 2, res, 0);
  for (const s of segs) {
    const pad = s.w * 1.6;
    const i0 = Math.max(0, Math.floor((Math.min(s.x0, s.x1) - pad - g.x0) / res));
    const i1 = Math.min(g.n - 1, Math.ceil((Math.max(s.x0, s.x1) + pad - g.x0) / res));
    const j0 = Math.max(0, Math.floor((Math.min(s.z0, s.z1) - pad - g.z0) / res));
    const j1 = Math.min(g.n - 1, Math.ceil((Math.max(s.z0, s.z1) + pad - g.z0) / res));
    const dx = s.x1 - s.x0;
    const dz = s.z1 - s.z0;
    const L2 = dx * dx + dz * dz || 1e-6;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = g.x0 + i * res;
        const z = g.z0 + j * res;
        const t = Math.min(1, Math.max(0, ((x - s.x0) * dx + (z - s.z0) * dz) / L2));
        const d = Math.hypot(x - (s.x0 + dx * t), z - (s.z0 + dz * t));
        const v = 1 - smooth(s.w * 0.25, s.w * 1.6, d);
        const k = j * g.n + i;
        if (v > g.data[k]) g.data[k] = v;
      }
    }
  }
  return g;
}

export const SCAR_SEGS = lichtenberg(SCAR[0], SCAR[1], 27, 7, 4242);
export const HEART_SEGS = lichtenberg(HEART[0], HEART[1], 14, 6, 777);
let scarG: Grid | null = null;
let heartG: Grid | null = null;
/** Discharge patterns of the Scorched Glass Flats (0~1) */
export const scarVein = (x: number, z: number) => (Math.abs(x - SCAR[0]) > 30 || Math.abs(z - SCAR[1]) > 30 ? 0 : (scarG ??= rasterize(SCAR_SEGS, SCAR[0], SCAR[1], 30, 0.5)).at(x, z));
export const heartVein = (x: number, z: number) => (Math.abs(x - HEART[0]) > 17 || Math.abs(z - HEART[1]) > 17 ? 0 : (heartG ??= rasterize(HEART_SEGS, HEART[0], HEART[1], 17, 0.5)).at(x, z));

// ───────────────────────── Pillar and lightning scorch positions (shared by ground coloring and props) ─────────────────────────

export interface Rod {
  x: number;
  z: number;
  /** Shaft height */
  h: number;
  /** Snapped off by lightning */
  broken: boolean;
  /** Radius of the scorch mark at its foot */
  scorch: number;
}

const CHEST_SPOTS: XZ[] = [
  [-75, 45],
  [3.9, -14.8],
  [47, 61],
  [-63, -56],
  [72, -5],
  [-89, -90],
];
export const CHESTS = CHEST_SPOTS;

function farFromRoads(x: number, z: number, m: number): boolean {
  return roadDist(x, z) > PATH_W + 1.5 + m && CHEST_SPOTS.every(([cx, cz]) => Math.hypot(cx - x, cz - z) > 3.5);
}

/** Radius of the terrace edge (varies with bearing) */
export function terraceRim(a: number): number {
  return 26 + Math.sin(a * 3 + 1) * 2.6 + Math.sin(a * 5 + 0.4) * 1.4;
}

function buildRods(): Rod[] {
  const r = rng(9090);
  const out: Rod[] = [];
  const ok = (x: number, z: number, gap: number) => out.every((o) => Math.hypot(o.x - x, o.z - z) > gap);
  // Pillar grove on the terrace: denser toward the terrace's center
  for (let tries = 0; tries < 900 && out.length < 46; tries++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 25;
    const x = RODS[0] + Math.cos(a) * d;
    const z = RODS[1] + Math.sin(a) * d;
    if (d > terraceRim(a) - 3) continue;
    if (!farFromRoads(x, z, 0.8) || !ok(x, z, 4.2)) continue;
    // Leave a walkway in front of the gap at the secret realm's entrance
    if (Math.hypot(x + 72, z + 70) < 5) continue;
    out.push({ x, z, h: 3.4 + r() * 5.6 * (1 - d / 40), broken: r() < 0.2, scorch: 1.4 + r() * 1.2 });
  }
  // Stray pillars scattered over the grassland
  const stray: XZ[] = [
    [-26, 12],
    [22, 44],
    [-58, 58],
    [2, -46],
    [38, -30],
    [-40, 12],
    [66, 20],
    [-6, 50],
    [84, -34],
    [-30, -62],
  ];
  for (const [x, z] of stray) if (farFromRoads(x, z, 1)) out.push({ x, z, h: 3 + r() * 3.5, broken: r() < 0.35, scorch: 1.6 + r() });
  return out;
}
export const RODS_LIST: Rod[] = buildRods();

/** The eight giant pillars around the tower on the Thunderpeal Dais (avoiding the approach in front of the tower) */
export const TOWER_RING: { x: number; z: number; h: number }[] = (() => {
  const out: { x: number; z: number; h: number }[] = [];
  const face = Math.atan2(TOWER_DIR[1], TOWER_DIR[0]);
  for (let i = 0; i < 9; i++) {
    const a = face + Math.PI / 9 + (i / 9) * Math.PI * 2;
    let da = a - face;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) < 0.3) continue;
    out.push({ x: TOWER[0] + Math.cos(a) * 28, z: TOWER[1] + Math.sin(a) * 28, h: 12 + (i % 3) * 1.6 });
  }
  return out;
})();

/** Pillars along both sides of the approach */
export const AVENUE: { x: number; z: number; h: number }[] = (() => {
  const out: { x: number; z: number; h: number }[] = [];
  const nx = -TOWER_DIR[1];
  const nz = TOWER_DIR[0];
  for (const [d, h] of [
    [31, 6.5],
    [39, 5.6],
    [47, 4.8],
  ] as const) {
    const [x, z] = towerAt(d);
    for (const s of [-1, 1]) out.push({ x: x + nx * s * 5.6, z: z + nz * s * 5.6, h });
  }
  return out;
})();

/** Spots on the grassland that have been struck by lightning */
export const STRIKES: XZ[] = [
  [-4, 36],
  [28, 8],
  [-44, -8],
  [12, -40],
  [56, 44],
  [-66, 14],
  [82, 4],
  [-20, 58],
];

/** Scorch intensity everywhere (0~1): at the pillars' feet, at the strike points on the grassland, on the Thunderpeal Dais */
export function scorchAt(x: number, z: number): number {
  let v = 0;
  for (const o of RODS_LIST) {
    const dx = x - o.x;
    const dz = z - o.z;
    if (Math.abs(dx) > 4 || Math.abs(dz) > 4) continue;
    const d = Math.hypot(dx, dz) + Math.sin(Math.atan2(dz, dx) * 5 + o.x) * 0.35;
    v = Math.max(v, 1 - smooth(o.scorch * 0.4, o.scorch, d));
  }
  for (const o of [...TOWER_RING, ...AVENUE]) {
    const d = Math.hypot(x - o.x, z - o.z);
    if (d < 5) v = Math.max(v, (1 - smooth(1.2, 4.2, d + Math.sin(Math.atan2(z - o.z, x - o.x) * 6) * 0.5)) * 0.9);
  }
  for (const [sx, sz] of STRIKES) {
    const dx = x - sx;
    const dz = z - sz;
    if (Math.abs(dx) > 6 || Math.abs(dz) > 6) continue;
    const a = Math.atan2(dz, dx);
    const d = Math.hypot(dx, dz) * (1 + 0.14 * Math.sin(a * 3 + sx) + 0.08 * Math.sin(a * 7 + sz));
    v = Math.max(v, (1 - smooth(0.8, 4.4, d)) * 0.85);
  }
  return v;
}

// ───────────────────────── Height ─────────────────────────

/** Large-scale swells of the grassland */
export function swell(x: number, z: number): number {
  return (
    2.0 * Math.sin(x * 0.034 + z * 0.021 + 0.7) +
    1.35 * Math.sin(-x * 0.019 + z * 0.043 + 2.1) +
    0.7 * Math.sin(x * 0.071 - z * 0.052 + 1.3) +
    0.28 * Math.sin(x * 0.15 + z * 0.12)
  );
}

const dome = (c: XZ, r0: number, r1: number, x: number, z: number) => 1 - smooth(r0, r1, Math.hypot(x - c[0], z - c[1]));
/** Smooth maximum */
const smax = (a: number, b: number, k: number) => {
  const hh = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + hh * hh * k * 0.25;
};

/** Height of the mountain wall the engine adds at the border (same formula, so the bearing can decide how much to keep) */
export function edgeMetric(x: number, z: number): number {
  return Math.max(Math.abs(x), Math.abs(z)) + Math.sin(x * 0.11) * 3 + Math.cos(z * 0.13) * 3;
}
const engineWall = (x: number, z: number) => smooth(S - 30, S - 4, edgeMetric(x, z)) * (18 + Math.sin(x * 0.21 + z * 0.17) * 4 + Math.sin(x * 0.07 - z * 0.05) * 5);

/** Direction of the gap in the stone ridge around the secret realm (toward the pillar grove) */
const GAP_A = Math.atan2(RODS[1] - HEART[1], RODS[0] - HEART[0]);

export function rawHeight(x: number, z: number): number {
  let h = 4.2 + swell(x, z);

  // Lone Tree Hill: the tallest round hill on the grassland
  h += 7.2 * Math.pow(dome(LONE, 2, 30, x, z), 1.3);
  // Thundermane Run: the gentle hill the boulder group stands on
  h += 2.6 * dome(TORS, 3, 24, x, z);

  // Pillar terrace: the edge is ringed by a steep scarp, and the southeast side (where the trail climbs up) is a gentle slope
  {
    const dx = x - RODS[0];
    const dz = z - RODS[1];
    const a = Math.atan2(dz, dx);
    const d = Math.hypot(dx, dz);
    let da = a - Math.atan2(-0.8, 0.6);
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const w = 2.5 + 9 * smooth(1.2, 0.2, Math.abs(da));
    const rim = terraceRim(a);
    h += 4.4 * (1 - smooth(rim - w * 0.6, rim + w * 0.4, d));
  }

  // Thunderpeal Dais: the high ground the tower stands on,
  // with a long slope on the approach side facing the town and rock scarps in the other directions
  {
    const dx = x - TOWER[0];
    const dz = z - TOWER[1];
    const a = Math.atan2(dz, dx);
    const d = Math.hypot(dx, dz);
    let da = a - Math.atan2(TOWER_DIR[1], TOWER_DIR[0]);
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const w = 3 + 16 * smooth(0.9, 0.1, Math.abs(da));
    const rim = 38 + Math.sin(a * 4 + 0.5) * 2.5 + Math.sin(a * 7) * 1.2;
    h += 6.2 * (1 - smooth(rim - w * 0.55, rim + w * 0.45, d));
  }

  // Scorched Glass Flats: a shallow basin burned out by one giant lightning strike; the skeleton lies in a low hollow
  h -= 2.2 * dome(SCAR, 5, 30, x, z);
  h -= 1.3 * dome(BONES, 8, 28, x, z);

  // Thunderfall Heart: a flat pit floor ringed by a stone ridge, with a gap only in the direction of the pillar grove
  {
    const dx = x - HEART[0];
    const dz = z - HEART[1];
    const d = Math.hypot(dx, dz);
    const a = Math.atan2(dz, dx);
    let da = a - GAP_A;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const gap = 1 - smooth(0.16, 0.36, Math.abs(da));
    const floor = 1 - smooth(13, 17, d);
    h += (2.6 - h) * floor;
    const crestR = 20 + Math.sin(a * 5 + 1) * 1.5;
    h += 9.5 * Math.exp(-(((d - crestR) / 4.2) ** 2)) * (1 - gap * 0.97) * (1 + 0.25 * Math.sin(a * 11));
  }

  // River valley: a wide, flat floodplain on both sides of Thunder Creek, with the channel winding along the valley floor
  const cd = creekDist(x, z);
  const valley = 1 - smooth(5, 28, cd);
  h += (1.3 - h) * valley * 0.85;
  // Banks: ease down further close to the channel, so the banks are grassy slopes rather than sheer walls
  h += (0.35 - h) * (1 - smooth(3, 13, cd)) * 0.8;
  // Don't dip low enough to hold water anywhere outside the water surface
  h = smax(h, WATER + 1.0, 1.2);
  // Spring pool and marsh
  const pool = Math.max(1 - smooth(3.5, 8, Math.hypot(x - SPRING[0], z - SPRING[1])), 1 - smooth(7, 17, Math.hypot(x - MARSH[0], z - MARSH[1]) + Math.sin(Math.atan2(z - MARSH[1], x - MARSH[0]) * 3) * 2));
  // Fords: the channel widens and shallows, so it can be waded across
  const ford = Math.max(1 - smooth(5, 13, Math.hypot(x - FORD1[0], z - FORD1[1])), 1 - smooth(4, 11, Math.hypot(x - FORD2[0], z - FORD2[1])));
  const half = 2.8 + ford * 2.6;
  const bed = WATER - 1.9 + ford * 1.4;
  const chan = Math.max(1 - smooth(half * 0.6, half + 3.4 + ford * 1.2, cd), pool);
  h += (Math.min(h, bed) - h) * chan;

  // Border: keep a full steep rock wall on the north (behind the tower) and press the other directions down into gentle hills,
  // so the grassland is seen to run on and on
  const keep = 0.42 + 0.72 * smooth(-40, -92, z);
  h -= engineWall(x, z) * (1 - keep);
  return h;
}

/** Water depth weight of the channel (1 = channel center): for coloring and props */
export function channel(x: number, z: number): number {
  const cd = creekDist(x, z);
  return 1 - smooth(2, 7, cd);
}
