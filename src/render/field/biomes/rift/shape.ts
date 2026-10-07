// The terrain structure of the Void Rift (pure math, independent of three): one whole shattered landmass hanging in the void.
// At the center is the "Core Isle" where the Seal Tower stands, ringed by a circular abyss, "the Wound",
// and linked only by the Old Kingdom Road in the south, with the bridge in the north broken;
// the outer land is cut into four pieces by four radial cracks (south: the outpost terrace, west: the kingdom ruins, north:
// the broken plain, east: the Blightcrystal Basin),
// each crack with a stone bridge; in the open sea to the northeast is also a secret-realm isle linked only by a long thin ridge.

export type P2 = [number, number];

/** The Seal Tower (the center of the Core Isle) */
export const T: P2 = [0, -28];
/** The center of the land (the polar origin of the coastline) */
const O: P2 = [0, -6];
/** Ring abyss: the isle radius and the outer shore radius */
export const RIN = 25;
export const ROUT = 44;
/** Height of the void plane: terrain lower than this is covered by the nebula */
export const VOID_Y = -32;
/** Terrain height in the void (under the void plane, not visible) */
const DEEP = -80;
const ISLAND_H = 3.2;

// ── Landmarks
export const TOWN: P2 = [6, 74];
export const BASIN: P2 = [70, -6];
export const CRATER: P2 = [-40, -84];
export const COLOSSUS: P2 = [-80, -12];
export const CROWN: P2 = [-62, 8];
export const GRAVES: P2 = [30, 50];
export const FIELD: P2 = [-22, 26];
export const ISLE: P2 = [76, -90];
/** Secret-realm ridge: stretching from the northern broken plain toward the isle */
export const RIDGE: [P2, P2] = [
  [52, -70],
  [68, -83],
];
/** The "Eye of the Void" in the Blightcrystal Basin: a hole torn in the ground through which the abyss is directly visible */
export const HOLES: [number, number, number][] = [
  [78, -14, 3.6],
  [72, 6, 3.0],
  [84, 0, 2.6],
];

export interface Crack {
  /** Direction angle (degrees, 0 faces south, 90 faces east) */
  phi: number;
  /** Position of each stone bridge on its crack (distance from the tower) and half-width */
  rb: number;
  bw: number;
  dx: number;
  dz: number;
  /** Center of the stone bridge */
  bridge: P2;
}

export const CRACKS: Crack[] = (
  [
    [-40, 66, 6.8],
    [38, 72, 6.8],
    [105, 62, 6.8],
    [-118, 68, 6.8],
  ] as const
).map(([phi, rb, bw]) => {
  const a = (phi * Math.PI) / 180;
  const dx = Math.sin(a);
  const dz = Math.cos(a);
  return { phi, rb, bw, dx, dz, bridge: [T[0] + dx * rb, T[1] + dz * rb] as P2 };
});

/** The two ends of the stone bridge (k meters outward along the direction across the crack) */
export function bridgeEnds(c: Crack, k = 9): [P2, P2] {
  const [bx, bz] = c.bridge;
  // The direction perpendicular to the crack
  const px = c.dz;
  const pz = -c.dx;
  return [
    [bx + px * k, bz + pz * k],
    [bx - px * k, bz - pz * k],
  ];
}

export const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function distSeg(x: number, z: number, a: P2, b: P2): [number, number] {
  const vx = b[0] - a[0];
  const vz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz)));
  return [Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t), t];
}

// Coastline: one radius every 30 degrees (0 = south, clockwise toward the east), interpolated periodically with Catmull-Rom and then given a sawtooth
const COAST = [100, 108, 112, 97, 102, 96, 101, 104, 110, 99, 108, 104];

function coastR(th: number): number {
  const n = COAST.length;
  const u = ((((th / (Math.PI * 2)) % 1) + 1) % 1) * n;
  const i = Math.floor(u);
  const f = u - i;
  const p0 = COAST[(i - 1 + n) % n];
  const p1 = COAST[i % n];
  const p2 = COAST[(i + 1) % n];
  const p3 = COAST[(i + 2) % n];
  const cr = 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
  return cr + 3 * Math.sin(9 * th + 1) + 1.8 * Math.sin(17 * th + 2.3) + 0.9 * Math.sin(29 * th + 0.7) + 0.5 * Math.sin(47 * th + 1.3);
}

/** The inner and outer radii of the ring abyss at a given bearing */
export function ringR(th: number): [number, number] {
  const rin = RIN + 1.0 * Math.sin(3 * th + 0.5) + 0.7 * Math.sin(7 * th + 1.3) + 0.4 * Math.sin(13 * th);
  const rout = ROUT + 2.2 * Math.sin(2 * th + 1) + 1.4 * Math.sin(5 * th + 0.2) + 0.8 * Math.sin(11 * th + 2) + 0.4 * Math.sin(23 * th);
  return [rin, rout];
}

/** The half-width of the crack at a given distance */
export function crackW(c: Crack, along: number): number {
  return 3.6 + Math.max(0, along - ROUT) * 0.1 + 1.1 * Math.sin(along * 0.37 + c.phi * 3) + 0.5 * Math.sin(along * 1.13 + c.phi);
}

/**
 * Signed distance to the edge of the void (meters): positive on land, negative in the void.
 * The coast, ring abyss, radial cracks and the Eye of the Void take the minimum; the stone bridges, the broken bridge,
 * the secret-realm isle and the ridge then add the land back.
 */
export function land(x: number, z: number): number {
  const ox = x - O[0];
  const oz = z - O[1];
  let d = coastR(Math.atan2(ox, oz)) - Math.hypot(ox, oz);
  d = Math.min(d, 103 - Math.max(Math.abs(x), Math.abs(z)));
  // The bay bitten out around the secret realm
  d = Math.min(d, Math.hypot(x - ISLE[0], z - ISLE[1]) - 25);

  const tx = x - T[0];
  const tz = z - T[1];
  const rT = Math.hypot(tx, tz);
  const th = Math.atan2(tx, tz);
  const [rin, rout] = ringR(th);
  let ring = Math.max(rin - rT, rT - rout);
  if (tz > 0) {
    // The Old Kingdom Road in the south: a natural stone beam across the abyss, slightly thinner in the middle
    const mid = Math.min(1, Math.max(0, (rT - rin) / (rout - rin)));
    ring = Math.max(ring, 6.6 - 1.2 * Math.sin(Math.PI * mid) - Math.abs(tx));
  } else {
    // The broken bridge in the north: a section extends from each shore, with a break in the middle
    ring = Math.max(ring, Math.min(4.8 - Math.abs(tx), rT - (rout - 8)));
    ring = Math.max(ring, Math.min(4.8 - Math.abs(tx), rin + 4.5 - rT));
  }
  d = Math.min(d, ring);

  for (const c of CRACKS) {
    const along = tx * c.dx + tz * c.dz;
    if (along < rin) continue;
    const perp = tx * c.dz - tz * c.dx;
    const w = crackW(c, along);
    let cd = Math.abs(perp) - w;
    // Stone bridge: an arched natural stone beam, a bit thinner in the middle
    const bw = c.bw - 1.3 * (1 - Math.min(1, Math.abs(perp) / Math.max(w, 1)));
    cd = Math.max(cd, bw - Math.abs(along - c.rb));
    d = Math.min(d, cd);
  }
  for (const [hx, hz, hr] of HOLES) d = Math.min(d, Math.hypot(x - hx, z - hz) - hr - 0.6 * Math.sin(Math.atan2(x - hx, z - hz) * 5 + hx));

  // The secret-realm isle and the long thin ridge leading to it
  const ia = Math.atan2(x - ISLE[0], z - ISLE[1]);
  const isle = 13 + 1.3 * Math.sin(3 * ia + 1) + 0.6 * Math.sin(7 * ia) - Math.hypot(x - ISLE[0], z - ISLE[1]);
  const [rd, rt] = distSeg(x, z, RIDGE[0], RIDGE[1]);
  const ridge = 4.5 + 0.5 * Math.sin(rt * 9) - rd;
  let m = Math.max(d, isle, ridge);
  for (const [sx, sz, sr] of SHARDS) {
    const a = Math.atan2(x - sx, z - sz);
    m = Math.max(m, sr + 0.8 * Math.sin(a * 3 + sx) + 0.4 * Math.sin(a * 7) - Math.hypot(x - sx, z - sz));
  }
  return m;
}

/**
 * Rock debris peeling off beyond the coast: separated from the land by a stretch of void (unreachable),
 * with the surface sinking down and tilting outward
 */
export const SHARDS: [number, number, number, number][] = (() => {
  const out: [number, number, number, number][] = [];
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 30; i++) {
    const th = (i / 30) * Math.PI * 2 + (r() - 0.5) * 0.15;
    const rad = 2.5 + r() * 4.5;
    const dist = coastR(th) + 3.5 + r() * 3.5 + rad;
    const x = O[0] + Math.sin(th) * dist;
    const z = O[1] + Math.cos(th) * dist;
    if (Math.max(Math.abs(x), Math.abs(z)) + rad > 104) continue;
    if (Math.hypot(x - ISLE[0], z - ISLE[1]) < 30) continue;
    out.push([x, z, rad, -2 - r() * 7]);
  }
  return out;
})();

/**
 * Heights of the four pieces of land: west 1.5, south 0.3, east -0.8, north 3.5; smooth transitions on both sides of a crack (on the stone bridges)
 */
const PLATES: [number, number, number][] = [
  [-118, -40, 1.5],
  [-40, 38, 0.3],
  [38, 105, -0.8],
  [105, 242, 3.5],
];

function plateOff(tx: number, tz: number, rT: number): number {
  const phi = Math.atan2(tx, tz);
  const w = 9 / Math.max(rT, 20);
  let s = 0;
  for (const [a, b, h] of PLATES) {
    const A = (a * Math.PI) / 180;
    const B = (b * Math.PI) / 180;
    s += h * sm(-w, w, wrap(phi - A)) * sm(-w, w, wrap(B - phi));
  }
  return s;
}

/** Undulating noise (the land surface) */
export function bumps(x: number, z: number): number {
  return 1.1 * Math.sin(x * 0.043 + 1.2) * Math.cos(z * 0.037 - 0.4) + 0.7 * Math.sin(x * 0.09 - z * 0.071 + 2) + 0.35 * Math.sin(x * 0.19 + z * 0.23);
}

/**
 * Collapse pit: the ground sinks as a whole and the pit rim is squeezed up into a lip, with a light-leaking fissure
 * splitting the pit floor (the fissure is in fissure.ts).
 * x, z, radius, depth
 */
export const SINKS: [number, number, number, number][] = [
  [-40, 72, 6.5, 2.2],
  [50, 70, 6, 2],
  [-86, 30, 7, 2.4],
  [-86, -44, 6, 2],
  [88, 24, 6.5, 2.2],
  [34, -96, 5, 1.6],
  [-14, 60, 4.5, 1.4],
  [60, 34, 5, 1.6],
];

/**
 * Fine undulation: small hills at a scale of a few meters, plus patches of sharp "pushed up from underground" ridges that break up large flat ground;
 * slopes all stay within the walkable range (roads, the town and tower base are flattened further by the engine).
 */
export function relief(x: number, z: number): number {
  let h = 0.45 * Math.sin(x * 0.27 + Math.sin(z * 0.19) * 1.4) * Math.cos(z * 0.31 - Math.sin(x * 0.15) * 1.2);
  h += 0.18 * Math.sin(x * 0.61 + z * 0.43 + Math.sin(z * 0.23) * 2);
  // Ridges: two sets of warped ridge lines in different directions, appearing only in patches
  const u = x * 0.8 + z * 0.6 + 6 * Math.sin(z * 0.05 + 1) + 4 * Math.sin(x * 0.07);
  const v = -x * 0.55 + z * 0.83 + 5 * Math.sin(x * 0.045 + 2);
  const r1 = (1 - Math.abs(Math.sin(u * 0.16))) ** 4;
  const r2 = (1 - Math.abs(Math.sin(v * 0.13 + 0.7))) ** 4;
  const patch = sm(0.05, 0.55, Math.sin(x * 0.031 + 0.4) * Math.cos(z * 0.037 - 1.1) + 0.3 * Math.sin(x * 0.08 + z * 0.06));
  h += (r1 * 0.95 + r2 * 0.65) * patch;
  for (const [sx, sz, sr, sd] of SINKS) {
    const d = Math.hypot(x - sx, z - sz);
    if (d > sr * 1.9) continue;
    h += -sd * (1 - sm(sr * 0.25, sr, d)) + sd * 0.35 * Math.exp(-(((d - sr * 1.12) / (sr * 0.28)) ** 2));
  }
  return h;
}

/** Height of the land surface (excluding cliffs); d is the distance to the void edge (the fine undulation fades out at the cliff edge) */
export function surface(x: number, z: number, d = 99): number {
  const tx = x - T[0];
  const tz = z - T[1];
  const rT = Math.hypot(tx, tz);
  let h = bumps(x, z) + relief(x, z) * sm(2, 9, d);
  // Land near the Wound is heaved upward
  h += plateOff(tx, tz, rT) + 2.4 * (1 - sm(ROUT, ROUT + 18, rT));
  // The whole west lifts up, and the north shore swells
  h += 8 * sm(-48, -96, x) + 4 * sm(-84, -104, z);
  // Blightcrystal Basin
  h -= 3.4 * (1 - sm(6, 24, Math.hypot(x - BASIN[0], z - BASIN[1])));
  // The pit left after the Inverted Quarter was lifted away whole
  const dc = Math.hypot(x - CRATER[0], z - CRATER[1]);
  h += -5.5 * (1 - sm(6, 14, dc)) + 1.2 * Math.exp(-(((dc - 15.5) / 3) ** 2));
  // The mound where the statue of the Uncrowned King fell
  h += 1.4 * (1 - sm(4, 16, Math.hypot(x - COLOSSUS[0], z - COLOSSUS[1])));
  // Core Isle
  const iw = 1 - sm(RIN - 2, ROUT - 4, rT);
  h += (ISLAND_H + bumps(x, z) * 0.3 - h) * iw;
  // Peeling rock debris sinks downward
  for (const [sx, sz, sr, sd] of SHARDS) h += sd * (1 - sm(sr + 2, sr + 6, Math.hypot(x - sx, z - sz)));
  // The secret-realm isle is a bit higher than its surroundings
  h += 2 * (1 - sm(10, 22, Math.hypot(x - ISLE[0], z - ISLE[1])));
  return h;
}

/** Raw terrain height: the land surface, with the edge a small crumbling bevel and then a sheer drop into the void */
export function riftHeight(x: number, z: number): number {
  const d = land(x, z);
  const hs = surface(x, z, d);
  if (d >= 2) return hs;
  if (d >= 0) return hs - (1 - sm(0, 2, d)) * 1.2;
  const k = -d;
  const lip = hs - 1.2 - 4 * sm(0, 1.4, k);
  return lip + (DEEP - lip) * sm(0.9, 4.5, k);
}
