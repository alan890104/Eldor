// Each region's field design: one file per region, loaded only when entering the region (an error in one region's file does not affect the others).

import type { RegionId } from '../../arena.ts';
import type { Biome } from '../kit.ts';

const LOADERS: Partial<Record<RegionId, () => Promise<Biome>>> = {
  forest: () => import('./forest.ts').then((m) => m.forest),
  isles: () => import('./isles.ts').then((m) => m.isles),
  volcano: () => import('./volcano.ts').then((m) => m.volcano),
  highland: () => import('./highland.ts').then((m) => m.highland),
  canyon: () => import('./canyon.ts').then((m) => m.canyon),
  plains: () => import('./plains.ts').then((m) => m.plains),
  holy: () => import('./holy.ts').then((m) => m.holy),
  shadow: () => import('./shadow.ts').then((m) => m.shadow),
  rift: () => import('./rift.ts').then((m) => m.rift),
};

export function loadBiome(region: RegionId): Promise<Biome> {
  return (LOADERS[region] ?? LOADERS.forest!)();
}
