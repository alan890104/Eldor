// Combine a region's raw terrain and map layout into the final terrain: roads flattened, the town and tower base leveled,
// the boundary turned into cliff walls or sea.

import * as THREE from 'three';
import type { Biome, XZ } from './kit.ts';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Turn polyline control points into evenly spaced samples (Catmull-Rom smoothing) */
export function samplePath(pts: XZ[], step = 1.5): XZ[] {
  if (pts.length < 2) return pts;
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const n = Math.max(2, Math.round(curve.getLength() / step));
  return curve.getSpacedPoints(n).map((p) => [p.x, p.z] as XZ);
}

export interface Composed {
  /** Final terrain height */
  height: (x: number, z: number) => number;
  /** Distance to the main road or a path */
  pathDist: (x: number, z: number) => number;
  /** Sample points of the roads (main road + paths) */
  roads: XZ[][];
  /** Strength of the boundary wall (0 inside, 1 on the outermost ring) */
  edge: (x: number, z: number) => number;
}

export function compose(biome: Biome): Composed {
  const L = biome.layout;
  const S = L.size;
  const roads = [samplePath(L.path), ...(L.trails ?? []).map((t) => samplePath(t))];
  const flat = roads.flat();
  // Road height: the raw height averaged along the road, so the road surface does not follow the terrain's ups and downs too much
  const roadH = roads.map((road) =>
    road.map((_, i) => {
      let s = 0;
      let n = 0;
      for (let k = Math.max(0, i - 4); k <= Math.min(road.length - 1, i + 4); k++) {
        s += biome.height(road[k][0], road[k][1]);
        n++;
      }
      return s / n;
    }),
  );
  const flatH = roadH.flat();

  // The road distance and the height of the nearest point are stored on a grid and bilinearly interpolated on query
  const G = 1;
  const N = Math.ceil((S * 2) / G) + 1;
  const dist = new Float32Array(N * N);
  const nearH = new Float32Array(N * N);
  // Put the sample points into cells first, so a query only looks at nearby cells
  const cell = 12;
  const buckets = new Map<string, number[]>();
  flat.forEach(([x, z], i) => {
    const k = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    const a = buckets.get(k);
    if (a) a.push(i);
    else buckets.set(k, [i]);
  });
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = -S + i * G;
      const z = -S + j * G;
      let best = 1e9;
      let bh = 0;
      const cx = Math.floor(x / cell);
      const cz = Math.floor(z / cell);
      for (let a = -2; a <= 2; a++) {
        for (let b = -2; b <= 2; b++) {
          const list = buckets.get(`${cx + a},${cz + b}`);
          if (!list) continue;
          for (const k of list) {
            const d = Math.hypot(flat[k][0] - x, flat[k][1] - z);
            if (d < best) {
              best = d;
              bh = flatH[k];
            }
          }
        }
      }
      dist[j * N + i] = Math.min(best, 30);
      nearH[j * N + i] = bh;
    }
  }
  const lerpGrid = (arr: Float32Array, x: number, z: number) => {
    const fx = Math.min(N - 1.001, Math.max(0, (x + S) / G));
    const fz = Math.min(N - 1.001, Math.max(0, (z + S) / G));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    return arr[j * N + i] * (1 - u) * (1 - v) + arr[j * N + i + 1] * u * (1 - v) + arr[(j + 1) * N + i] * (1 - u) * v + arr[(j + 1) * N + i + 1] * u * v;
  };
  const pathDist = (x: number, z: number) => lerpGrid(dist, x, z);

  const townH = biome.height(L.town[0], L.town[1]);
  const towerH = biome.height(L.tower[0], L.tower[1]);
  const edge = (x: number, z: number) => {
    const m = Math.max(Math.abs(x), Math.abs(z)) + Math.sin(x * 0.11) * 3 + Math.cos(z * 0.13) * 3;
    return smooth(S - 30, S - 4, m);
  };
  const height = (x: number, z: number) => {
    let h = biome.height(x, z);
    const pd = pathDist(x, z);
    const w = 1 - smooth(L.pathW, L.pathW + 7, pd);
    h = h + (lerpGrid(nearH, x, z) - h) * w * 0.9;
    const dt = Math.hypot(x - L.town[0], z - L.town[1]);
    h = h + (townH - h) * (1 - smooth(L.townR, L.townR + 12, dt));
    const dw = Math.hypot(x - L.tower[0], z - L.tower[1]);
    h = h + (towerH - h) * (1 - smooth(17, 30, dw));
    const e = edge(x, z);
    if (L.edge === 'cliff') h += e * (18 + Math.sin(x * 0.21 + z * 0.17) * 4 + Math.sin(x * 0.07 - z * 0.05) * 5);
    else if (L.edge === 'water') h += (-7 - h) * e;
    else h += (-40 - h) * smooth(0.55, 1, e);
    return h;
  };
  return { height, pathDist, roads, edge };
}

export { smooth };
