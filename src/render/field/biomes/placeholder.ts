// A temporary field: regions without their own design yet use this (grass, trees, rocks), so the flow can run end to end.

import { smooth } from '../compose.ts';
import type { Biome } from '../kit.ts';
import { boulder, scatterMask, solidTree } from '../props.ts';

export function placeholder(cols: { grass: number; grass2: number; path: number; cliff: number; leaf: number; stone: number; glow: number }): Biome {
  return {
    cols: { grass: cols.grass, grass2: cols.grass2, path: cols.path, cliff: cols.cliff },
    layout: {
      size: 90,
      edge: 'cliff',
      town: [0, 62],
      townR: 14,
      tower: [0, -62],
      spawn: [0, 50, Math.PI],
      waypoint: [10, 58],
      pathW: 2.4,
      path: [[0, 70], [0, 50], [-12, 24], [8, 0], [-6, -26], [0, -46]],
      zones: [
        { x: 0, z: 30, r: 16, tier: 0, count: 4 },
        { x: 30, z: 0, r: 16, tier: 1, count: 4, corrupt: 0.1 },
        { x: -30, z: -10, r: 16, tier: 1, count: 4, corrupt: 0.1 },
        { x: 20, z: -40, r: 14, tier: 2, count: 3, corrupt: 0.3 },
      ],
      chests: [[40, 30], [-40, 30], [40, -30], [-40, -40], [60, 60]],
      npcs: [[-3.5, 46, 0.3], [-8, 64, 1.2], [8, 66, -2.2]],
    },
    height: (x, z) => 1.6 * Math.sin(x * 0.05) * Math.cos(z * 0.04) + 0.8 * Math.sin(x * 0.11 + z * 0.09),
    tower: { stone: cols.stone, stoneDark: 0x6a6470, trim: cols.leaf, roof: cols.grass2, glow: cols.glow, kind: 'pagoda' },
    decorate(ctx) {
      const S = ctx.layout.size;
      scatterMask(ctx, ctx.low ? 250 : 500, 1.2, (x, z) => 0.2 + smooth(0.5, 0.9, Math.max(Math.abs(x), Math.abs(z)) / S) * 0.7, (x, z) => solidTree(ctx, x, z, 1.3 + ctx.r(), 'round', 0x6a4a30, [cols.leaf, cols.grass2]));
      scatterMask(ctx, 40, 2, () => 0.6, (x, z) => boulder(ctx, x, z, 1 + ctx.r() * 1.5, cols.stone));
      ctx.b.lift = 0;
    },
  };
}
