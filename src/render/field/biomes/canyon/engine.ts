// Cancel the flattening done by the engine's compose(): compose pulls the terrain toward a plane within pathW+7 m of the road,
// townR+12 of the town and 17-30 m of the tower base, so the walls of narrow canyons (Skythread Gorge, the basin in front of
// the tower, the mine valley) become walkable slopes: the walls no longer look like walls and the player can climb out.
// compose's flattening is linear (h' = h*(1-a) + a*target), so on rock wall cells it can be inverted: scale the height up first,
// and after the flattening it lands exactly on the designed height.
// The valley floor (wallDist < 0) is left untouched and the road is still flattened by the engine; only the rock walls are
// restored to stepped cliffs.
// Note: this copies compose.ts's flattening formula and road sampling (samplePath's default spacing, the 4-point average before
// and after, 12 m buckets, the 1 m grid); if compose.ts changes how it flattens, change this to match (if it goes stale the
// walls just turn back into slopes, nothing breaks).

import { samplePath } from '../../compose.ts';
import type { Biome } from '../../kit.ts';
import { rawHeight, smooth, wallDist } from './geo.ts';

export function composeInverse(L: Biome['layout']): (x: number, z: number) => number {
  const S = L.size;
  let ready = false;
  const N = S * 2 + 1;
  const dist = new Float32Array(N * N);
  const nearH = new Float32Array(N * N);
  let townH = 0;
  let towerH = 0;

  const build = () => {
    ready = true;
    const roads = [samplePath(L.path), ...(L.trails ?? []).map((t) => samplePath(t))];
    const flat = roads.flat();
    const flatH = roads
      .map((road) =>
        road.map((_, i) => {
          let s = 0;
          let n = 0;
          for (let k = Math.max(0, i - 4); k <= Math.min(road.length - 1, i + 4); k++) {
            s += rawHeight(road[k][0], road[k][1]);
            n++;
          }
          return s / n;
        }),
      )
      .flat();
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
        const x = -S + i;
        const z = -S + j;
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
    townH = rawHeight(L.town[0], L.town[1]);
    towerH = rawHeight(L.tower[0], L.tower[1]);
  };

  const lerp = (arr: Float32Array, x: number, z: number) => {
    const fx = Math.min(N - 1.001, Math.max(0, x + S));
    const fz = Math.min(N - 1.001, Math.max(0, z + S));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    return arr[j * N + i] * (1 - u) * (1 - v) + arr[j * N + i + 1] * u * (1 - v) + arr[(j + 1) * N + i] * (1 - u) * v + arr[(j + 1) * N + i + 1] * u * v;
  };

  return (x, z) => {
    const T = rawHeight(x, z);
    const wd = wallDist(x, z);
    if (wd <= 0) return T;
    if (!ready) build();
    let h = T;
    // compose's order is road → town → tower base, so the inversion runs in reverse
    const aw = 1 - smooth(17, 30, Math.hypot(x - L.tower[0], z - L.tower[1]));
    if (aw > 0) {
      if (aw > 0.97) return T;
      h = (h - aw * towerH) / (1 - aw);
    }
    const at = 1 - smooth(L.townR, L.townR + 12, Math.hypot(x - L.town[0], z - L.town[1]));
    if (at > 0) {
      if (at > 0.97) return T;
      h = (h - at * townH) / (1 - at);
    }
    const w = (1 - smooth(L.pathW, L.pathW + 7, lerp(dist, x, z))) * 0.9;
    if (w > 0) h = (h - w * lerp(nearH, x, z)) / (1 - w);
    // Blend slowly into the short stretch hugging the valley floor, so the wall foot has no step
    return T + (h - T) * smooth(0, 0.6, wd);
  };
}
