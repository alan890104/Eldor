// Whisperwood's terrain skeleton: landmark coordinates, the course of the stream and the cliff, and the terrain functions.
// Height, ground coloring, grass fields and prop placement all query from here, so the props line up with the terrain.
//
// Map layout (+z south, -z north):
//   On the southern slope is the treetop settlement "Treespeak Village"; the slope outside its north gate runs down to the
//   Wildflower Slope;
//   in the center are the giant-tree colonnade and the thousand-year Mother Tree (its root arch spans the main road);
//   the forest stream flows from the Moss Falls in the northwest, crosses the map and empties into Mirror Lake in the east;
//   to the north is a moss-covered cliff (its east section eases into a long slope); the main road climbs from the gorge
//   of the Owlwatch Stair onto the plateau and ends at the Whisperwood Seal Tower;
//   to the west are Glowcap Hollow and the Fallen Giant; behind the vine curtain beside the falls hides a narrow gorge
//   leading to the sunken Banyan Secret Realm on the plateau.

import { smooth } from '../../compose.ts';
import type { XZ } from '../../kit.ts';

export const S = 120;
/** Water surface shared by the stream, the lake and the falls pool */
export const WL = -1.2;
export const PATH_W = 2.1;

export const TOWN: XZ = [-4, 70];
export const TOWN_R = 16;
export const TOWER: XZ = [18, -80];
/** Spawn point: top of the slope outside the village's north gate, facing the Seal Tower */
export const SPAWN: [number, number, number] = [-3.6, 44, Math.atan2(TOWER[0] + 3.6, TOWER[1] - 44)];

/** The thousand-year Mother Tree */
export const MOTHER: XZ = [-24, -12];
export const MOTHER_R = 6.2;
/** Mirror Lake (an ellipse) and the small island in it */
export const LAKE = { x: 60, z: 8, rx: 24, rz: 17 };
export const ISLAND: XZ = [60, 9];
/** Glowcap Hollow */
export const HOLLOW: XZ = [-66, 12];
/** Falls pool and the top of the falls */
export const POOL: XZ = [-48, -36];
export const LIP: XZ = [-48, -45.2];
/** Water surface of the stream on the plateau (upstream) */
export const UP_WL = 13.0;
/** Banyan Secret Realm (a sunken valley on the plateau) and the narrow gorge leading to it */
export const GLADE: XZ = [-74, -66];
export const GLADE_H = 5.5;
export const RAVINE: XZ[] = [[-58, -37.5], [-62, -47], [-67, -56.5], [-73, -64]];
/** Lakeview Stone Ring */
export const KNOLL: XZ = [34, 44];
/** The Fallen Giant: root-plate end A, broken end B */
export const FALLEN = { a: [-56, 36] as XZ, b: [-29, 29] as XZ, r: 2.9 };
/** Wildflower Slope (an ellipse) */
export const MEADOW = { x: 0, z: 28, rx: 34, rz: 18 };
/** Owlwatch Stair: the gorge climbs from G0 (mouth of the gorge) to G1 (plateau) */
export const GORGE: [XZ, XZ] = [[-5, -37], [11, -58]];
/** Forest Folk bridge: crosses the forest stream along the main road */
export const BRIDGE: [XZ, XZ] = [[-7.6, -22.6], [-6.4, -33.2]];

// ───────────────────────── Routes ─────────────────────────

export const MAIN_PATH: XZ[] = [
  [-4, 64], [-4, 55], [-3.5, 45], [1, 34], [5, 22], [3, 10], [-3, 1], [-8.5, -8], [-8.6, -16], [-7.6, -22.6], [-7, -28], [-6.4, -33.2], [-2, -41], [5, -50], [11, -58], [15.3, -62.4],
];
export const TRAILS: XZ[][] = [
  // West route: north gate → Fallen Giant → Glowcap Hollow → fork south of the Mother Tree → falls pool
  [[-6, 54], [-18, 48.5], [-34, 45], [-48, 46], [-61, 42], [-63, 32], [-55, 22], [-53, 8], [-51, -4], [-47, -14], [-44, -22], [-47, -27.5]],
  // South of the Mother Tree: west route fork → Mother Tree shrine → rejoins the main road
  [[-47, -14], [-38, -2], [-27, 5], [-15, 4], [-5, -2]],
  // East route: Wildflower Slope → Lakeview Stone Ring → lake shore → shallow ford → east slope → east of the tower
  [[1.5, 33], [16, 37], [28, 36], [40, 30], [45, 26.5], [37, 18], [29, 8], [27, -6], [32, -18], [44, -26], [55, -36], [61, -50], [55, -63], [40, -72]],
  // Island in the lake: walk out along the shallow sandbar
  [[45, 26.5], [51, 21], [56.5, 14]],
  // Plateau west route: top of the stair → overlook at the top of the falls
  [[11, -58], [0, -62], [-15, -60], [-29, -55], [-40, -50]],
];

// ───────────────────────── Streams ─────────────────────────

/** Forest stream: [x, z, half-width], flowing from the falls pool to Mirror Lake */
export const STREAM: [number, number, number][] = [
  [-48, -36, 5],
  [-40, -30, 3.0],
  [-30, -31, 3.3],
  [-18, -29, 3.6],
  [-7, -28, 3.8],
  [5, -24.5, 3.8],
  [16, -17, 4.0],
  [23, -11, 4.6],
  [28, -5, 6.2],
  [34, 0, 5.2],
  [41, 4, 5.5],
  [48, 6, 6],
];
/** Stream on the plateau (upstream): [x, z, half-width], flowing from the north rim wall to the top of the falls */
export const UPSTREAM: [number, number, number][] = [
  [-38, -112, 2.6],
  [-41, -96, 2.6],
  [-44, -82, 2.8],
  [-42, -70, 2.8],
  [-46.5, -58, 2.6],
  [-48, -47, 2.4],
  [-48, -40, 2.4],
];

// Scratch shared by polyline distance queries (the height function is called hundreds of thousands of times per map,
// so avoid allocating objects)
let qd = 0;
let qw = 0;
let qt = 0;
let qi = 0;

/** Distance to a polyline; writes qd (distance), qw (interpolated half-width), qt (segment parameter), qi (segment index) */
function polyNear(pts: [number, number, number][], x: number, z: number): number {
  let best = 1e9;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az, aw] = pts[i];
    const [bx, bz, bw] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const L2 = dx * dx + dz * dz;
    let t = ((x - ax) * dx + (z - az) * dz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t - x;
    const pz = az + dz * t - z;
    const d = px * px + pz * pz;
    if (d < best) {
      best = d;
      qw = aw + (bw - aw) * t;
      qt = t;
      qi = i;
    }
  }
  qd = Math.sqrt(best);
  return qd;
}

/** Distance to the forest stream's centerline and the half-width there */
export function streamAt(x: number, z: number): { d: number; w: number } {
  polyNear(STREAM, x, z);
  return { d: qd, w: qw };
}

/** Distance to a segment between two points, and its parameter (fraction along a→b, not clamped) */
function segInfo(x: number, z: number, a: XZ, b: XZ): [number, number, number] {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const L = Math.hypot(dx, dz);
  const ux = dx / L;
  const uz = dz / L;
  const along = (x - a[0]) * ux + (z - a[1]) * uz;
  const perp = -(x - a[0]) * uz + (z - a[1]) * ux;
  return [along / L, perp, L];
}

// ───────────────────────── Noise ─────────────────────────

export const n1 = (x: number, z: number) => Math.sin(x * 0.061 + Math.sin(z * 0.043) * 1.7) * Math.cos(z * 0.052 - Math.sin(x * 0.037) * 1.3);
export const n2 = (x: number, z: number) => Math.sin(x * 0.17 + z * 0.11 + Math.sin(z * 0.23) * 0.8) * Math.cos(z * 0.19 - x * 0.07);
export const hash = (x: number, z: number) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const roll = (x: number, z: number) =>
  1.1 * Math.sin(x * 0.043 + 0.7) * Math.cos(z * 0.037 - 0.4) + 0.65 * Math.sin(x * 0.083 - z * 0.061 + 1.3) + 0.3 * Math.sin(x * 0.19 + z * 0.23);

// ───────────────────────── North cliff ─────────────────────────

const CLIFF_X = [-150, -100, -76, -56, -40, -20, 0, 20, 40, 60, 90, 150];
const CLIFF_Z = [-30, -33, -38, -41.5, -42, -42, -44, -46, -44, -40, -36, -34];

/** z coordinate of the cliff line (the cliff foot) */
export function cliffZ(x: number): number {
  let i = 0;
  while (i < CLIFF_X.length - 2 && x > CLIFF_X[i + 1]) i++;
  const x0 = CLIFF_X[i];
  const x1 = CLIFF_X[i + 1];
  const t = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
  const p0 = CLIFF_Z[Math.max(0, i - 1)];
  const p1 = CLIFF_Z[i];
  const p2 = CLIFF_Z[i + 1];
  const p3 = CLIFF_Z[Math.min(CLIFF_Z.length - 1, i + 2)];
  const t2 = t * t;
  const t3 = t2 * t;
  const cr = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  return cr + 1.1 * Math.sin(x * 0.31) + 0.5 * Math.sin(x * 0.73 + 1);
}

/** Cliff face width: the west and middle sections are vertical walls, the east section eases into a long walkable slope */
export const cliffW = (x: number) => 3.4 + 30 * smooth(38, 66, x);
/** How far the plateau stands above the lowland */
export const PLATEAU = 12;

/** Plateau fraction from 0 (lowland) to 1 (plateau) */
export function plateauK(x: number, z: number): number {
  const d = cliffZ(x) - z;
  return (2.4 * smooth(-8, 0, d) + 9.6 * smooth(0, cliffW(x), d)) / PLATEAU;
}

// ───────────────────────── Terrain height ─────────────────────────

const ellipse = (x: number, z: number, cx: number, cz: number, rx: number, rz: number) => Math.hypot((x - cx) / rx, (z - cz) / rz);

/** Elliptical distance to the lake (< 1 means in the lake), with a slightly irregular shore */
export function lakeE(x: number, z: number): number {
  const a = Math.atan2(z - LAKE.z, x - LAKE.x);
  return ellipse(x, z, LAKE.x, LAKE.z, LAKE.rx, LAKE.rz) * (1 + 0.07 * Math.sin(a * 3 + 1) + 0.04 * Math.sin(a * 7));
}

/** Terrain without the gorge, stream and water bodies (the heights at both ends of the gorge are taken from this) */
function landform(x: number, z: number): number {
  let h = roll(x, z);
  // South slope (where Treespeak Village stands) and the hills to the west
  h += 4.6 * smooth(40, 80, z);
  h += 3.4 * smooth(-30, -76, x) * (1 - smooth(-20, -44, z) * 0.4);
  // Wildflower Slope: smaller undulation, lowered overall
  const m = ellipse(x, z, MEADOW.x, MEADOW.z, MEADOW.rx, MEADOW.rz);
  const mk = 1 - smooth(0.7, 1.25, m);
  h += (0.5 + roll(x, z) * 0.35 - h) * mk * 0.85;
  // No unexpected puddles in the lowland (water appears only in the stream, pool and lake)
  h = Math.max(h, 0.15 + 0.25 * roll(x * 1.3, z * 1.3));
  // The gentle hill where the Mother Tree stands
  h += 2.3 * (1 - smooth(6, 26, Math.hypot(x - MOTHER[0], z - MOTHER[1])));
  // The small hill of the Lakeview Stone Ring (flat on top)
  h += 3.6 * (1 - smooth(5, 15, Math.hypot(x - KNOLL[0], z - KNOLL[1])));
  // Glowcap Hollow: a bowl in the west hills
  const dh = Math.hypot(x - HOLLOW[0], z - HOLLOW[1]);
  h += (0.9 + roll(x, z) * 0.2 - h) * (1 - smooth(9, 18, dh));
  // North plateau
  h += PLATEAU * plateauK(x, z);
  // Gentle hills and hollows on the plateau
  h += plateauK(x, z) * (1.4 * Math.sin(x * 0.07 + 2) * Math.cos(z * 0.09) + 0.6 * n2(x, z));
  return h;
}

let gorgeEnds: [number, number] | null = null;

/** The final raw terrain (flattening for roads and towns is done afterwards by the engine) */
export function height(x: number, z: number): number {
  let h = landform(x, z);

  // ── Owlwatch Stair: the gorge ramp cut into the cliff
  if (!gorgeEnds) gorgeEnds = [landform(GORGE[0][0], GORGE[0][1]), landform(GORGE[1][0], GORGE[1][1])];
  {
    const [t, perp] = segInfo(x, z, GORGE[0], GORGE[1]);
    if (t > -0.3 && t < 1.3 && Math.abs(perp) < 9) {
      const tt = Math.min(1, Math.max(0, t));
      const ramp = gorgeEnds[0] + (gorgeEnds[1] - gorgeEnds[0]) * (tt * tt * (3 - 2 * tt) * 0.6 + tt * 0.4) + 0.3 * Math.sin(perp * 0.8);
      const wall = 4.2 + 0.8 * Math.sin(t * 9);
      const k = (1 - smooth(wall, wall + 2.2, Math.abs(perp))) * (1 - smooth(1.05, 1.25, t)) * smooth(-0.25, -0.05, t);
      if (ramp < h) h += (ramp - h) * k;
    }
  }

  // ── The narrow gorge to the Banyan Secret Realm, and the sunken valley
  {
    let best = 1e9;
    let bt = 0;
    let bi = 0;
    for (let i = 0; i + 1 < RAVINE.length; i++) {
      const [t, perp] = segInfo(x, z, RAVINE[i], RAVINE[i + 1]);
      const tc = Math.min(1, Math.max(0, t));
      const d = tc === t ? Math.abs(perp) : Math.hypot(x - (RAVINE[i][0] + (RAVINE[i + 1][0] - RAVINE[i][0]) * tc), z - (RAVINE[i][1] + (RAVINE[i + 1][1] - RAVINE[i][1]) * tc));
      if (d < best) {
        best = d;
        bt = tc;
        bi = i;
      }
    }
    if (best < 8) {
      const u = (bi + bt) / (RAVINE.length - 1);
      const floor = 0.6 + (GLADE_H - 0.6) * smooth(0, 1, u) + 0.25 * Math.sin(u * 20);
      const k = 1 - smooth(2.4, 3.8, best);
      if (floor < h) h += (floor - h) * k;
    }
    const dg = Math.hypot(x - GLADE[0], z - GLADE[1]);
    if (dg < 16) {
      const floor = GLADE_H + 0.35 * Math.sin(x * 0.4) * Math.cos(z * 0.35) + 0.8 * smooth(4, 11, dg);
      const k = 1 - smooth(10.5, 13.5, dg + 0.9 * Math.sin(Math.atan2(z - GLADE[1], x - GLADE[0]) * 4));
      if (floor < h) h += (floor - h) * k;
    }
  }

  // ── Stream on the plateau (upstream): flatten both banks, then dig out the streambed
  {
    polyNear(UPSTREAM, x, z);
    if (qd < 14) {
      const bank = UP_WL + 0.9;
      const kb = (1 - smooth(qw + 3, qw + 11, qd)) * plateauK(x, z);
      h += (bank - h) * kb * 0.85;
      const kc = 1 - smooth(qw * 0.5, qw + 1.4, qd);
      h += (UP_WL - 1.3 - h) * kc * smooth(0.6, 0.9, plateauK(x, z));
    }
  }

  // ── Forest stream
  polyNear(STREAM, x, z);
  if (qd < 16) {
    const w = qw;
    let bed = WL - 2.6 + 0.4 * Math.sin(x * 0.3);
    // Forest Folk bridge: below the deck is an earth bank (hidden by the bridge body), and both sides are dug deeper
    // to offset road flattening, which would fill in the stream
    const [bt, bp] = segInfo(x, z, BRIDGE[0], BRIDGE[1]);
    const nearBridge = bt > -0.3 && bt < 1.3 ? 1 - smooth(6, 12, Math.abs(bp)) : 0;
    bed += (-14 - bed) * nearBridge;
    // Shallow ford on the east route: the streambed is raised to just cover the ankles
    const df = Math.hypot(x - 27.5, z - -6);
    const ford = 1 - smooth(2.5, 6, df);
    bed += (WL - 0.35 - bed) * ford;
    const k = 1 - smooth(w * 0.4, w + 3.6, qd);
    h += (bed - h) * k;
    // Earth bank under the bridge (bank height is held within a 2.3 m width)
    if (bt > -0.1 && bt < 1.1 && Math.abs(bp) < 3.2) {
      const causeway = 1.2 + 0.2 * bt;
      const kk = (1 - smooth(2.3, 3.0, Math.abs(bp))) * (1 - smooth(1.0, 1.1, bt)) * smooth(-0.1, 0, bt);
      h += (causeway - h) * kk;
    }
  }

  // ── Falls pool
  {
    const d = Math.hypot(x - POOL[0], z - POOL[1]);
    if (d < 12) h += (WL - 3.2 - h) * (1 - smooth(5.5, 10.5, d));
  }

  // ── Mirror Lake, the island, and the sandbar leading to the island
  {
    const e = lakeE(x, z);
    if (e < 1.6) {
      h += (WL - 4.6 - h) * (1 - smooth(0.62, 1.12, e));
      const di = Math.hypot(x - ISLAND[0], z - ISLAND[1]);
      const isl = WL + 1.9 - di * di * 0.035 + 0.3 * Math.sin(x * 1.3);
      h = Math.max(h, isl - smooth(3.8, 6.5, di) * 8);
      const [st, sp] = segInfo(x, z, [51, 21], [57, 13.5]);
      if (st > -0.4 && st < 1.2) h = Math.max(h, WL - 0.35 - smooth(1.6, 3.6, Math.abs(sp)) * 5);
    }
  }

  // ── The Fallen Giant: a shallow trench pressed out by the trunk
  {
    const [t, perp] = segInfo(x, z, FALLEN.a, FALLEN.b);
    if (t > -0.1 && t < 1.1) h -= 0.5 * (1 - smooth(1, 3.5, Math.abs(perp))) * smooth(-0.1, 0.05, t) * (1 - smooth(0.95, 1.1, t));
  }

  // ── Rim wall: the rocky ridge of the outer rim (the engine adds more wall on top)
  const m = Math.max(Math.abs(x), Math.abs(z));
  h += smooth(S - 36, S - 10, m) * (2.5 + 2.5 * n2(x * 0.7, z * 0.7));
  return h;
}

// ───────────────────────── Tree density ─────────────────────────

/** Canopy density, 0 to 1: where trees grow and where clearings are; ground coloring uses it too (darker, mossier understory) */
export function woods(x: number, z: number): number {
  let d = 0.6 + 0.3 * n1(x, z) + 0.12 * n2(x * 0.6, z * 0.6);
  d *= smooth(0.85, 1.35, ellipse(x, z, MEADOW.x, MEADOW.z, MEADOW.rx, MEADOW.rz));
  d *= smooth(22, 32, Math.hypot(x - TOWN[0], z - TOWN[1] - 2));
  d *= smooth(1.08, 1.45, lakeE(x, z));
  d *= smooth(11, 19, Math.hypot(x - HOLLOW[0], z - HOLLOW[1]));
  d *= smooth(15, 24, Math.hypot(x - MOTHER[0], z - MOTHER[1]));
  d *= smooth(27, 38, Math.hypot(x - TOWER[0], z - TOWER[1]));
  d *= smooth(10, 16, Math.hypot(x - POOL[0], z - POOL[1]));
  d *= smooth(7, 13, Math.hypot(x - KNOLL[0], z - KNOLL[1]));
  const { d: sd, w } = streamAt(x, z);
  d *= smooth(w + 1, w + 6, sd);
  const m = Math.max(Math.abs(x), Math.abs(z)) / S;
  d += 0.45 * smooth(0.7, 0.86, m);
  return Math.min(1, Math.max(0, d));
}
