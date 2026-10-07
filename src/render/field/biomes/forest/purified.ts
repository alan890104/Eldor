// After purification (every floor of the Seal Tower broken through): the Void Blight had been draining the Mother Tree's
// strength, so once the tower is purified the Mother Tree bursts into bloom and petals drift down from its canopy all day;
// the scorched, eroded earth in front of the tower grows back into a field of wildflowers.
// (The village's Sprouting Festival is in village.ts)
// Placed last in decorate, so the random numbers it consumes do not affect the other placements.

import * as THREE from 'three';
import type { FieldCtx } from '../../kit.ts';
import { MOTHER, PATH_W, TOWER } from './geo.ts';
import { MOTHER_CROWN } from './landmarks.ts';
import { flowerPatch, MX, put, T } from './plants.ts';

const BLOSSOM = [0xffb4cc, 0xfff0f4, 0xff9cc0, 0xffd6e4, 0xffc4d8];

export function buildPurified(ctx: FieldCtx): void {
  if (ctx.done < ctx.floors) return;
  const { b, r, low } = ctx;

  // ── Mother Tree in bloom: clumps of pink-white blossoms burst out on the upper half of the canopy
  b.lift = 0;
  for (const [x, y, z, rh, rv] of MOTHER_CROWN) {
    const n = Math.round(rh / (low ? 1.5 : 1.0));
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2;
      const ph = -0.35 + r() * 1.75;
      const k = 0.93;
      const px = x + Math.cos(ph) * Math.cos(th) * rh * k;
      const py = y + Math.sin(ph) * rv * k;
      const pz = z + Math.cos(ph) * Math.sin(th) * rh * k;
      const s = rh * (0.13 + r() * 0.1);
      put(b, low ? T.ico0 : T.ico1, BLOSSOM[i % BLOSSOM.length], MX(px, py, pz, s, s * 0.75, s, 0, r() * 6), !low);
    }
  }

  // ── Falling petals
  const [mx, mz] = MOTHER;
  const g0 = ctx.h(mx, mz);
  const at = new THREE.Vector3(mx, g0 + 10, mz);
  const pos = new THREE.Vector3();
  const down = new THREE.Vector3(0.25, -1, 0.1).normalize();
  ctx.extras.push((dt, _t, vfx) => {
    if (vfx.camPos.distanceTo(at) > 110) return;
    let n = dt * 16;
    while (n > 0) {
      if (n < 1 && Math.random() > n) break;
      n -= 1;
      const a = Math.random() * Math.PI * 2;
      const d = 4 + Math.sqrt(Math.random()) * 26;
      const x = mx + Math.cos(a) * d;
      const z = mz + Math.sin(a) * d;
      pos.set(x, ctx.h(x, z) + 12 + Math.random() * 22, z);
      vfx.emit({ pos, count: 1, color: BLOSSOM, speed: [0.5, 1.1], dir: down, spread: 0.5, life: [6, 9], size: [0.16, 0.26], sizeEnd: 0.8, drag: 0.02, intensity: 1.1, atlas: 3 });
    }
  });

  // ── Scorched earth in front of the tower grows back into wildflowers
  const [wx, wz] = TOWER;
  const cols = [0xffffff, 0xffe07a, 0xff9ac0, 0xb89aff, 0x9ad8ff];
  const n = low ? 14 : 26;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = 19 + r() * 16;
    const x = wx + Math.cos(a) * d;
    const z = wz + Math.sin(a) * d;
    if (ctx.pathDist(x, z) < PATH_W + 1.2 || !ctx.clear(x, z, 0) || ctx.solids.blocked(x, z, 0.8)) continue;
    if (ctx.h(x, z) < ctx.waterLevel + 0.4) continue;
    flowerPatch(ctx, x, z, [cols[i % 5], cols[(i + 2) % 5]], 7, 1.7);
  }
  b.lift = 0;
}
