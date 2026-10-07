// Terrain skeleton of the Emberspine Volcanic Belt: landmark coordinates, the course and channel of the lava river, the hot
// spring terraces, the crater, the plateau and the height of the distant main peak. The height function and the decoration
// share this data, so props, lava bands and hot spring water surfaces line up with the terrain.

import * as THREE from 'three';
import { samplePath, smooth } from '../../compose.ts';
import type { XZ } from '../../kit.ts';

/** Half the side length of the map */
export const S = 120;
/** Fog color (the sky dome's horizon blends into this color too) */
export const FOG = 0x5a2a22;
/** Lava surface height (the engine's water surface, lava: true) */
export const LAVA = -1;

// ───────────────────────── Landmarks ─────────────────────────

/** Rediron Keep: the iron-walled forge city */
export const TOWN: XZ = [36, 66];
export const TOWN_R = 21;
/** Town wall radius (inside the flattened area) */
export const WALL_R = 19;
/** Emberspine Seal Tower: on the northern basalt plateau, next to the crater */
export const TOWER: XZ = [12, -74];
/** Magma Crater: the lava pit west of the tower, where the Order draws its fire */
export const CRATER: XZ = [-32, -84];
/** The lava lake in the east (the end of the lava river; it also catches the lavafall from the plateau) */
export const LAKE: XZ = [84, -38];
/** Phoenix Nest: the high mesa in the northeast (secret realm) */
export const MESA: XZ = [82, -83];
export const MESA_TOP = 21;
/** Sulfur Hot Spring Terraces */
export const SPRINGS: XZ = [-64, -62];
/** Basalt Colonnade */
export const COLONNADE: XZ = [-54, 24];
/** Abandoned Mine mouth (southwest cliff wall) */
export const MINE: XZ = [-87, 77];
const KNOLL: XZ = [-101, 93];
/** Sword Mound */
export const SWORDS: XZ = [68, 34];
/**
 * Geyser Flats: the silica sinter terrace in the east, where several sinter mounds take turns shooting up jets of scalding
 * water
 */
export const GEYSER: XZ = [86, 8];
/** Sinter mounds: [relative x, relative z, size, eruption period (seconds)] */
export const GEYSER_VENTS: [number, number, number, number][] = [
  [0, 0, 1.5, 9],
  [7.5, -5, 1.0, 6.5],
  [-7.5, 0.5, 1.1, 7.5],
  [7, 8, 0.8, 5],
  [-8, -6, 0.9, 11],
];
/** Cold Lava Plain (the black lava ground outside the town, in the south) */
export const FIELD: XZ = [-6, 36];
/** Basalt Gate: before the main road climbs onto the plateau, two basalt crags flank the road */
export const CRAG_W: XZ = [-18, -36];
export const CRAG_E: XZ = [5, -30];
/** Cinder cones on the Cold Lava Plain (small volcanic hills with a small crater on top) */
export const CONES: [number, number, number, number][] = [
  [-27, 55, 9, 16],
  [58, 8, 7, 13],
];
/** The distant Emberspine Peak (off the map, northwest) */
export const VOLC: XZ = [-80, -212];
export const VOLC_H = 128;
export const VOLC_RIM = 17;
const VOLC_R = 165;
/** Height of the northern plateau (where the tower and crater are) */
export const PLATEAU = 7;

/** Main road: town square -> North Gate -> Cold Lava Plain -> stone bridge -> Basalt Gate -> Tower Approach */
export const PATH: XZ[] = [
  [36, 74],
  [35, 60],
  [33, 47],
  [29, 34],
  [19, 23],
  [8, 14],
  [2, 5],
  [-2, -9],
  [-8, -21],
  [-6, -33],
  [3, -42],
  [11, -50],
  [14.5, -56],
];

export const TRAILS: XZ[][] = [
  // West route: Cold Lava Plain -> Basalt Colonnade -> natural stone arch -> hot springs
  [[8, 14], [-10, 20], [-30, 22], [-45, 16], [-55, 4], [-58, -12], [-58, -28], [-59, -44], [-62, -54]],
  // mine branch
  [[-30, 22], [-44, 40], [-62, 58], [-79, 71]],
  // East route: from the foot of the ridge along the cliff to the Sword Mound, then east to Geyser Flats
  [[19, 23], [33, 22], [47, 27], [60, 36], [72, 25], [79, 16]],
  // hot springs -> north bank -> back to the main road
  [[-59, -44], [-42, -47], [-27, -46], [-12, -41], [-6, -33]],
  // east along the north bank: the lava lake shore
  [[3, -42], [22, -38], [40, -42], [56, -48]],
];

// ───────────────────────── Lava river ─────────────────────────

/**
 * Lava river centerline: flows down from the lavafall on the northwest cliff wall, winds across the middle of the map and
 * empties into the lava lake in the east
 */
const RIVER_CTRL: XZ[] = [
  [-112, -80],
  [-101, -68],
  [-88, -56],
  [-74, -46],
  [-60, -37],
  [-45, -27],
  [-30, -17],
  [-15, -8],
  [0, -2],
  [14, -3],
  [28, -9],
  [42, -17],
  [55, -25],
  [66, -31],
  [76, -36],
];

/** River half-width: narrow at the source, wide in the middle reach; t is the fraction along the river */
export function riverHalfWidth(t: number): number {
  return 2.2 + 2.2 * smooth(0, 0.22, t) + 0.55 * Math.sin(t * 19 + 1.3) + 0.35 * Math.sin(t * 47);
}

export interface Crossing {
  /** Bridge center on the channel centerline */
  c: XZ;
  /** Bridge heading (radians, atan2(dx, dz)) */
  ang: number;
  /** Half the length of the bridge deck (along the road) */
  half: number;
  /** Road sample points (the bridge section) */
  pts: XZ[];
  kind: 'stone' | 'arch';
}

interface Grid {
  river: Float32Array;
  riverT: Float32Array;
  bridge: Float32Array;
  deep: Float32Array;
}

const GN = S * 2 + 1;
let grid: Grid | null = null;
let riverPts: XZ[] = [];
let riverTs: number[] = [];
let crossings: Crossing[] = [];

function segDist(px: number, pz: number, a: XZ, b: XZ): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const L2 = dx * dx + dz * dz || 1;
  const t = Math.min(1, Math.max(0, ((px - a[0]) * dx + (pz - a[1]) * dz) / L2));
  return Math.hypot(a[0] + dx * t - px, a[1] + dz * t - pz);
}

/** Finds where roads cross the lava river (one on the main road, one on the west route) */
function findCrossings(): Crossing[] {
  const out: Crossing[] = [];
  const roads: [XZ[], Crossing['kind']][] = [
    [samplePath(PATH, 0.5), 'stone'],
    [samplePath(TRAILS[0], 0.5), 'arch'],
  ];
  for (const [road, kind] of roads) {
    let best = 1e9;
    let bi = 0;
    road.forEach(([x, z], i) => {
      for (const [rx, rz] of riverPts) {
        const d = Math.hypot(rx - x, rz - z);
        if (d < best) {
          best = d;
          bi = i;
        }
      }
    });
    const n = 22; // ±11 m
    const pts = road.slice(Math.max(0, bi - n), Math.min(road.length, bi + n + 1));
    const a = pts[0];
    const b = pts[pts.length - 1];
    out.push({ c: road[bi], ang: Math.atan2(b[0] - a[0], b[1] - a[1]), half: 7.5, pts, kind });
  }
  return out;
}

function init(): Grid {
  if (grid) return grid;
  const curve = new THREE.CatmullRomCurve3(RIVER_CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const n = Math.round(curve.getLength());
  riverPts = curve.getSpacedPoints(n).map((p) => [p.x, p.z] as XZ);
  riverTs = riverPts.map((_, i) => i / n);
  crossings = findCrossings();
  const river = new Float32Array(GN * GN);
  const riverT = new Float32Array(GN * GN);
  const bridge = new Float32Array(GN * GN);
  const deep = new Float32Array(GN * GN);
  const cell = 10;
  const buckets = new Map<string, number[]>();
  riverPts.forEach(([x, z], i) => {
    const k = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    const a = buckets.get(k);
    if (a) a.push(i);
    else buckets.set(k, [i]);
  });
  for (let j = 0; j < GN; j++) {
    for (let i = 0; i < GN; i++) {
      const x = -S + i;
      const z = -S + j;
      let best = 80;
      let bt = 0;
      const cx = Math.floor(x / cell);
      const cz = Math.floor(z / cell);
      for (let a = -3; a <= 3; a++) {
        for (let b = -3; b <= 3; b++) {
          const list = buckets.get(`${cx + a},${cz + b}`);
          if (!list) continue;
          for (const k of list) {
            const d = Math.hypot(riverPts[k][0] - x, riverPts[k][1] - z);
            if (d < best) {
              best = d;
              bt = riverTs[k];
            }
          }
        }
      }
      river[j * GN + i] = best;
      riverT[j * GN + i] = bt;
      let br = 0;
      let dp = 0;
      for (const c of crossings) {
        let m = 1e9;
        for (let k = 0; k < c.pts.length - 1; k++) m = Math.min(m, segDist(x, z, c.pts[k], c.pts[k + 1]));
        br = Math.max(br, 1 - smooth(2.4, 3.4, m));
        dp = Math.max(dp, 1 - smooth(9, 17, Math.hypot(x - c.c[0], z - c.c[1])));
      }
      bridge[j * GN + i] = br;
      deep[j * GN + i] = dp;
    }
  }
  grid = { river, riverT, bridge, deep };
  return grid;
}

function lerpGrid(a: Float32Array, x: number, z: number): number {
  const fx = Math.min(GN - 1.001, Math.max(0, x + S));
  const fz = Math.min(GN - 1.001, Math.max(0, z + S));
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  return a[j * GN + i] * (1 - u) * (1 - v) + a[j * GN + i + 1] * u * (1 - v) + a[(j + 1) * GN + i] * (1 - u) * v + a[(j + 1) * GN + i + 1] * u * v;
}

/** Distance to the lava river's centerline */
export function riverDist(x: number, z: number): number {
  return lerpGrid(init().river, x, z);
}

/** Sample points of the lava river's centerline (one point per meter) and the fraction along the river */
export function riverSamples(): { pts: XZ[]; ts: number[] } {
  init();
  return { pts: riverPts, ts: riverTs };
}

export function getCrossings(): Crossing[] {
  init();
  return crossings;
}

// ───────────────────────── Height ─────────────────────────

const smin = (a: number, b: number, k: number) => {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
};

/**
 * River bank profile: s is the distance from the lava edge (>0 is on the bank); the bank slopes gently (a player who slides
 * down can walk back up) and gets steeply deeper below the lava surface. 9 to 13 m from the edge it returns to the original
 * terrain (highland turns straight into a cliff there).
 */
function bank(h: number, s: number, floor: number, slope = 0.6): number {
  const b = s < 0 ? Math.max(floor, LAVA - 0.5 + s * 2.6) : smin(h, LAVA - 0.5 + s * slope, 1.4);
  return b + (h - b) * smooth(9, 13, s);
}

/** Shape of the lava lake (not a perfect circle; on the north side there is a bay that meets the lavafall) */
export function lakeRadius(x: number, z: number): number {
  const a = Math.atan2(z - LAKE[1], x - LAKE[0]);
  return 15.5 * (1 + 0.13 * Math.sin(3 * a + 1.1) + 0.07 * Math.sin(5 * a + 2.3));
}

/** The bay the lavafall drops into (at the foot of the plateau): a stretch of the lake extending north */
export const FALL_FOOT: XZ = [84, -62];
const FALL_BAY: [XZ, XZ] = [[84, -46], [84, -65]];

/** Extent of the hot spring terraces (travertine ground, hot spring pools) */
export function terraceMask(x: number, z: number): number {
  const dx = x - SPRINGS[0];
  const dz = z - SPRINGS[1];
  const a = Math.atan2(dz, dx);
  // irregular petal shape: stretched to the southeast (downslope, toward the river), with a scalloped edge
  const d = Math.hypot(dx * 0.82 - dz * 0.2, dz * 0.9) + 2.8 * Math.sin(a * 3 + 0.8) + 1.6 * Math.sin(a * 5 + 2.1) + 1.1 * Math.sin(x * 0.35 + z * 0.21);
  return 1 - smooth(13, 21, d);
}

/** Direction the hot spring terraces descend (toward the river) */
export const SPRING_DOWN: XZ = [0.45, 0.89];

/** The distant main peak: a cone with a concave profile and a crater on top */
export function volcanoH(x: number, z: number): number {
  const r = Math.hypot(x - VOLC[0], z - VOLC[1]);
  const t = Math.min(1, Math.max(0, (r - VOLC_RIM) / (VOLC_R - VOLC_RIM)));
  let h = VOLC_H * Math.pow(1 - t, 1.75);
  // ridgelines and erosion gullies on the flanks
  const a = Math.atan2(z - VOLC[1], x - VOLC[0]);
  h += (Math.sin(a * 9 + r * 0.02) * 3 + Math.sin(a * 23) * 1.2) * smooth(0.05, 0.4, t) * (1 - smooth(0.7, 1, t)) * 1.5;
  // crater
  h -= 14 * (1 - smooth(VOLC_RIM * 0.6, VOLC_RIM, r));
  return h;
}

/** The base undulation: large-scale lava plain waves + fine ropy lava texture */
function baseH(x: number, z: number): number {
  let h = 3 + 1.3 * Math.sin(x * 0.043 + 0.7) * Math.cos(z * 0.051 - 0.3) + 0.7 * Math.sin(x * 0.093 - z * 0.071 + 1.3) + 0.35 * Math.sin(x * 0.21 + z * 0.17);
  const lf = 1 - smooth(14, 30, Math.hypot(x - FIELD[0], z - FIELD[1]));
  h += lf * (0.22 * Math.sin(x * 0.55 + Math.sin(z * 0.21) * 2.4) + 0.4);
  return h;
}

/** How much higher Rediron Keep's terrace stands than the plain */
export const BLUFF = 13;
/** The ridge outside the North Gate (the main road follows it down to the Cold Lava Plain) */
const SPUR: XZ[] = [
  [34, 50],
  [29, 34],
  [19, 23],
  [8, 15],
];
const SPRING_HILL: XZ = [-74, -76];

/**
 * Mask of Rediron Keep's terrace: a ring of cliff below the town, and outside the North Gate a ridge that gradually gets
 * lower and narrower
 */
export function bluffMask(x: number, z: number): number {
  const a = Math.atan2(z - TOWN[1], x - TOWN[0]);
  const dt = Math.hypot(x - TOWN[0], z - TOWN[1]) + 2.2 * Math.sin(a * 5 + 0.7) + 1.1 * Math.sin(x * 0.31 + z * 0.23);
  const round = 1 - smooth(27, 36, dt);
  let best = 1e9;
  let bs = 0;
  let acc = 0;
  for (let k = 0; k < SPUR.length - 1; k++) {
    const p = SPUR[k];
    const q = SPUR[k + 1];
    const dx = q[0] - p[0];
    const dz = q[1] - p[1];
    const L = Math.hypot(dx, dz);
    const t = Math.min(1, Math.max(0, ((x - p[0]) * dx + (z - p[1]) * dz) / (L * L)));
    const d = Math.hypot(p[0] + dx * t - x, p[1] + dz * t - z);
    if (d < best) {
      best = d;
      bs = acc + t * L;
    }
    acc += L;
  }
  const wd = 12 - 5 * smooth(0, 50, bs);
  const spur = (1 - smooth(wd * 0.55, wd + 4 + Math.sin(bs * 0.4) * 1.5, best)) * (1 - smooth(6, 52, bs));
  return Math.max(round, spur);
}

/**
 * Low scarps of old lava flows stacked tongue over tongue: warped low-frequency noise with two thresholds makes the steps;
 * the leading edge is a gentle slope about half a meter high (walkable), and the low spots are shallow hollows filled with
 * volcanic ash; on top of that, small swells from bulging lava crust. Not applied on the town terrace, landmarks, hot
 * springs or the tower approach (roads get flattened anyway). Returns [height, leading edge (0 to 1, for coloring), shallow
 * hollow (0 to 1)].
 */
const lobeOut: [number, number, number] = [0, 0, 0];
/** The ramp that climbs from the plateau's east end up to the Phoenix Nest mesa */
export const MESA_RAMP: [XZ, XZ] = [
  [49, -77],
  [74, -88.5],
];
export function lobes(x: number, z: number): [number, number, number] {
  const d = (p: XZ) => Math.hypot(x - p[0], z - p[1]);
  let mask = (1 - bluffMask(x, z)) * (1 - terraceMask(x, z));
  if (mask > 0) mask *= smooth(10, 20, d(COLONNADE)) * smooth(8, 16, d(SWORDS)) * smooth(10, 18, d(GEYSER)) * smooth(13, 22, d(CRATER));
  if (mask > 0) mask *= smooth(13, 19, d(MESA)) * smooth(20, 32, d(TOWER)) * smooth(18, 26, d(KNOLL)) * smooth(6, 11, d(CRAG_W)) * smooth(6, 11, d(CRAG_E));
  if (mask > 0) mask *= smooth(5, 12, segDist(x, z, MESA_RAMP[0], MESA_RAMP[1]));
  for (const [cx, cz, , cr] of CONES) if (mask > 0) mask *= smooth(cr * 0.7, cr * 1.2, Math.hypot(x - cx, z - cz));
  if (mask <= 0) {
    lobeOut[0] = lobeOut[1] = lobeOut[2] = 0;
    return lobeOut;
  }
  const wx = x + 7 * Math.sin(z * 0.061 + 1.3);
  const wz = z + 7 * Math.sin(x * 0.057 - 0.4);
  const n = Math.sin(wx * 0.049 + Math.sin(wz * 0.041) * 2.1) * Math.cos(wz * 0.044 - 0.9) + 0.45 * Math.sin(wx * 0.12 - wz * 0.1 + 2);
  let h = 0.55 * smooth(0.1, 0.34, n) + 0.42 * smooth(0.62, 0.86, n) - 0.3 * smooth(-0.35, -0.62, n);
  h += 0.26 * Math.sin(x * 0.29 + Math.sin(z * 0.23) * 1.7) * Math.cos(z * 0.31 - Math.sin(x * 0.19));
  lobeOut[0] = h * mask;
  lobeOut[1] = Math.max(1 - smooth(0.02, 0.14, Math.abs(n - 0.22)), 1 - smooth(0.02, 0.13, Math.abs(n - 0.74))) * mask;
  lobeOut[2] = smooth(-0.4, -0.62, n) * mask;
  return lobeOut;
}

export function height(x: number, z: number): number {
  const g = init();
  let h = baseH(x, z);
  h += lobes(x, z)[0];

  // Northern plateau: rises slowly northward from the river bank (to the east is the low lava lake basin, where the plateau
  // is a cliff)
  const basin = smooth(24, 42, x + 3 * Math.sin(z * 0.09)) * smooth(-73, -65, z + 1.5 * Math.sin(x * 0.2));
  const rise = (PLATEAU - 3) * smooth(-20, -60, z + 5 * Math.sin(x * 0.045)) * (1 - basin);
  h += rise;

  // the foot of the distant main peak extends into the map's northwest corner
  h += volcanoH(x, z);

  // Rediron Keep's cliff-edged terrace + the ridge outside the North Gate that slowly descends along the main road
  h += BLUFF * bluffMask(x, z);
  // the slope the hot springs sit on: descending from the northwest toward the river
  h += 3 * (1 - smooth(8, 30, Math.hypot(x - SPRING_HILL[0], z - SPRING_HILL[1])));
  // the silica sinter terrace of Geyser Flats
  h += 1.1 * (1 - smooth(8, 17, Math.hypot(x - GEYSER[0], z - GEYSER[1])));
  // the Basalt Colonnade's terrace, the Sword Mound's small hill
  h += 1.6 * (1 - smooth(12, 24, Math.hypot(x - COLONNADE[0], z - COLONNADE[1])));
  h += 3.2 * (1 - smooth(3, 22, Math.hypot(x - SWORDS[0], z - SWORDS[1])));
  // the two crags of the Basalt Gate, the cinder cones
  for (const [cx, cz] of [CRAG_W, CRAG_E]) {
    const d = Math.hypot(x - cx, z - cz) + Math.sin(Math.atan2(z - cz, x - cx) * 6) * 0.7;
    h += 7 * (1 - smooth(4, 9, d));
  }
  for (const [cx, cz, ch, cr] of CONES) {
    const d = Math.hypot(x - cx, z - cz);
    h += ch * (1 - smooth(3, cr, d)) - ch * 0.35 * (1 - smooth(1.2, 4.2, d));
  }
  // the rock knoll behind the mine (the mine mouth opens in its northeast rock face)
  h += 15 * (1 - smooth(11, 21, Math.hypot(x - KNOLL[0], z - KNOLL[1])));

  // Magma Crater: a raised rim on the plateau, with a deep pit dropping straight into lava in the middle
  const dc = Math.hypot(x - CRATER[0], z - CRATER[1]);
  h += 2.6 * Math.exp(-(((dc - 11.5) / 3.2) ** 2));
  h += (LAVA - 4 - h) * (1 - smooth(6.5, 10.2, dc + Math.sin(Math.atan2(z - CRATER[1], x - CRATER[0]) * 5) * 0.6));

  // Lava river: carved down along the channel, leaving a rock ridge at the bridge (the bridge is built on it), with the
  // sides of the bridge especially deep
  const rd = lerpGrid(g.river, x, z);
  const w = riverHalfWidth(lerpGrid(g.riverT, x, z));
  const floor = LAVA - 3 - 8 * lerpGrid(g.deep, x, z);
  const carved = bank(h, rd - w, floor);
  h = carved + (h - carved) * lerpGrid(g.bridge, x, z);
  // the lava lake and the bay on its north side that receives the lavafall
  const dl = Math.hypot(x - LAKE[0], z - LAKE[1]) - lakeRadius(x, z);
  const db = segDist(x, z, FALL_BAY[0], FALL_BAY[1]) - 6.5;
  h = Math.min(bank(h, dl, LAVA - 4), bank(h, db, LAVA - 4, 2.2));

  // the Phoenix Nest mesa and its access ramp (climbing from the plateau's east end along the mesa's northwest side)
  const dm = Math.hypot(x - MESA[0], z - MESA[1]) + Math.sin(Math.atan2(z - MESA[1], x - MESA[0]) * 6) * 0.8;
  h += (MESA_TOP - h) * (1 - smooth(11, 15, dm));
  const [r0, r1] = MESA_RAMP;
  const dr = segDist(x, z, r0, r1);
  if (dr < 4) {
    const t = Math.min(1, Math.max(0, ((x - r0[0]) * (r1[0] - r0[0]) + (z - r0[1]) * (r1[1] - r0[1])) / ((r1[0] - r0[0]) ** 2 + (r1[1] - r0[1]) ** 2)));
    const rampH = PLATEAU + (MESA_TOP - PLATEAU) * (t * 0.8 + 0.2 * smooth(0, 1, t));
    h = Math.max(h, h + (rampH - h) * (1 - smooth(2.4, 3.8, dr)));
  }
  return h;
}

/**
 * Distance from the lava edge (river, lake, lavafall bay, crater; negative means inside the lava): used for ground cracks
 * and scorched earth
 */
export function lavaEdgeDist(x: number, z: number): number {
  const g = init();
  const rs = lerpGrid(g.river, x, z) - riverHalfWidth(lerpGrid(g.riverT, x, z)) - 0.8;
  const dl = Math.hypot(x - LAKE[0], z - LAKE[1]) - lakeRadius(x, z) - 0.8;
  const db = segDist(x, z, FALL_BAY[0], FALL_BAY[1]) - 6.5;
  const dc = Math.hypot(x - CRATER[0], z - CRATER[1]) - 8;
  return Math.min(rs, dl, db, dc);
}

export { FALL_BAY };

/**
 * The ring of rock that keeps the player from falling into the deep pit (placed as colliders when decorating; terrain
 * analysis uses it too)
 */
export interface Barrier {
  c: XZ;
  r: number;
  /** Arc range (radians; if absent, the full circle) */
  from?: number;
  to?: number;
  /** Straight segment (if present, c → b, r is ignored) */
  b?: XZ;
}
export const BARRIERS: Barrier[] = [
  // rim of the Magma Crater
  { c: CRATER, r: 10.9 },
  // edge of the Phoenix Nest mesa: leaving a gap for the ramp on the northwest side
  { c: MESA, r: 11.6, from: -2.3, to: 3.45 },
  // from the mesa's southwest corner down to the plateau cliff: so nobody can walk from the plateau onto the lavafall cliff
  // south of the mesa
  { c: [MESA[0] + 11.6 * Math.cos(2.62), MESA[1] + 11.6 * Math.sin(2.62)], b: [68.5, -70.5], r: 0 },
];

/** Distance from a point to the barrier (for terrain analysis and placing colliders) */
export function barrierDist(x: number, z: number, br: Barrier): number {
  if (br.b) return segDist(x, z, br.c, br.b);
  const d = Math.abs(Math.hypot(x - br.c[0], z - br.c[1]) - br.r);
  if (br.from === undefined || br.to === undefined) return d;
  const a = Math.atan2(z - br.c[1], x - br.c[0]);
  const t = (((a - br.from) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return t <= br.to - br.from ? d : 99;
}
