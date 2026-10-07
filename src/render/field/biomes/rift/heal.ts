// The land's healing: with each floor of the Seal Tower broken through, more ground grows moss back.
// It starts from both sides of the roads and from places far from the Wound,
// and the Wound (around the tower) heals last; after full purification, the purple-gray of the whole land also fades into a soft gray-green.
// It changes the terrain's vertex colors directly (decorate runs after the terrain is built).

import type { FieldCtx } from '../../kit.ts';
import { tint } from './decals.ts';
import { HEAL } from './scatter.ts';
import { land, RIN, sm, T, TOWN } from './shape.ts';

const MOSS = [0x56644a, 0x606e50, 0x4e5c46, 0x687458];

export function healGround(ctx: FieldCtx, r: () => number): void {
  const k = HEAL.k;
  if (k <= 0) return;
  const S = ctx.layout.size;
  // (Terrain height tells whether it is ground: the rock walls going down a cliff keep the abyss's purple light)
  if (HEAL.pure) tint(ctx, 0, 0, S * 2, 0x6a7062, 0.25, (x, z) => 1 - sm(-3, -1, -ctx.h(x, z)));
  const n = Math.round(340 * k * (ctx.low ? 0.6 : 1));
  // The healing front: the larger k is, the further it advances toward the tower
  const r0 = RIN - 2 + (1 - k) * 40;
  const r1 = RIN + 18 + (1 - k) * 50;
  for (let i = 0, placed = 0; i < n * 12 && placed < n; i++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    if (land(x, z) < 2) continue;
    const rT = Math.hypot(x - T[0], z - T[1]);
    if (Math.hypot(x - TOWN[0], z - TOWN[1]) < 16) continue;
    const pd = ctx.pathDist(x, z);
    const want = (0.3 + 0.7 * (1 - sm(2.5, 10, pd))) * sm(r0, r1, rT);
    if (r() > want) continue;
    const rad = 2.5 + r() * 5.5;
    const ph = r() * 6.283;
    tint(ctx, x, z, rad, MOSS[Math.floor(r() * MOSS.length)], 0.35 + r() * 0.3, (dx, dz) => {
      const d = Math.hypot(dx, dz) / rad;
      if (d >= 1) return 0;
      // Irregular edge: as if the moss grew patch by patch
      const wob = 0.75 + 0.25 * Math.sin(Math.atan2(dz, dx) * 3 + ph) * Math.sin(Math.atan2(dz, dx) * 5 - ph);
      return Math.max(0, wob - d) / wob;
    });
    placed++;
  }
}
