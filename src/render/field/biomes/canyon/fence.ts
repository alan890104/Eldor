// The canyon's natural walls: the engine only checks the rise of each single step, so walking diagonally along a cliff (or
// sliding along a wall while pushing against it) lets a player climb it bit by bit, and climbing out of the canyon would wreck
// the branching-maze feel. So along the foot of every stretch of rock wall (the ring 0.3-1.3 m into the wall) we line up
// invisible collision circles; someone on the valley floor stops at the wall foot and looks blocked by the cliff. Only places
// that have really grown into a wall block (low saddles and the tortoise shell do not).

import type { FieldCtx } from '../../kit.ts';
import { SHELL, SIZE, engineEdge, floorH, rawHeight, wallDist } from './geo.ts';

/** The designed height (before subtracting the part the engine's boundary raises) */
const design = (x: number, z: number) => rawHeight(x, z) + engineEdge(x, z);

export function wallFence(ctx: FieldCtx): number {
  const S = SIZE - 3;
  const [sx, sz, R] = SHELL;
  let n = 0;
  for (let z = -S; z <= S; z++) {
    for (let x = -S; x <= S; x++) {
      const d = wallDist(x, z);
      if (d < 0.3 || d >= 1.3) continue;
      if (Math.hypot(x - sx, z - sz) < R + 3) continue;
      // Whether the ground 2 m into the wall really is higher
      const gx = wallDist(x + 0.5, z) - wallDist(x - 0.5, z);
      const gz = wallDist(x, z + 0.5) - wallDist(x, z - 0.5);
      const gl = Math.hypot(gx, gz) || 1;
      const px = x + (gx / gl) * 2;
      const pz = z + (gz / gl) * 2;
      if (design(px, pz) - floorH(x, z) < 2) continue;
      ctx.solids.add(x, z, 0.8);
      n++;
    }
  }
  // The south rim of the shell abuts the basin's rock wall (similar height), so fill in the stretch of city wall that breaks
  // off behind the palace
  for (let a = 0; a < Math.PI * 2; a += 1 / (R - 1.4)) {
    const x = sx + Math.sin(a) * (R - 1.4);
    const z = sz - Math.cos(a) * (R - 1.4);
    if (z < sz + 20) continue;
    ctx.solids.add(x, z, 0.8);
    n++;
  }
  return n;
}
