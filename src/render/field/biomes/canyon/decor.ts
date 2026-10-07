// Master list of Stoneheart Canyon props: builds, in order, the tortoise and the citadel, each landmark, the natural props and
// the animated things.

import * as THREE from 'three';
import { glowGroup, type FieldCtx } from '../../kit.ts';
import { Banners, buildCity } from './city.ts';
import { buildTortoise } from './tortoise.ts';
import { buildNature } from './nature.ts';
import { buildSites, railLine } from './sites.ts';
import { COL } from './pal.ts';
import { wallFence } from './fence.ts';

export function buildCanyon(ctx: FieldCtx): void {
  const banners = new Banners();
  const windows: THREE.BufferGeometry[] = [];
  const smokes: { pos: THREE.Vector3; big: boolean }[] = [];
  buildTortoise(ctx);
  buildCity(ctx, banners, windows, smokes);
  const rails = railLine();
  buildSites(ctx, banners, rails);
  buildNature(ctx, rails);
  // Fence the wall feet last (prop placement checks collisions, so fencing first would leave no room to place the fallen rocks)
  wallFence(ctx);
  ctx.b.lift = 0;
  banners.build(ctx);
  // The citadel's windows: they slowly light up together at dusk, flickering slightly
  const setWin = glowGroup(ctx.group, ctx.disposers, COL.win, windows);
  ctx.extras.push((_dt, t) => setWin(1.7 + Math.sin(t * 0.7) * 0.1));
  // Chimney smoke (only puffs near the camera)
  ctx.extras.push((dt, _t, vfx) => {
    for (const s of smokes) {
      if (Math.random() > dt * (s.big ? 6 : 1.6)) continue;
      if (vfx.camPos.distanceTo(s.pos) > 80) continue;
      vfx.smoke({ pos: s.pos.clone(), count: 1, color: [0xb8a898, 0x9a8a80], speed: [0.6, 1.1], dir: new THREE.Vector3(0.35, 1, 0.05), spread: 0.2, life: [3, 4.5], size: [0.5, 0.8], sizeEnd: 2.6, drag: 0.2, intensity: 0.55 });
    }
  });
}
