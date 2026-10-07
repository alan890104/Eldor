// Dev only: view the field on its own (add ?fieldview=forest to the URL). Walk with WASD / Shift / Space, drag the mouse to turn the camera, scroll to zoom.
// Params: &at=x,z (start point), &yaw=degrees (character facing, 0 faces south, 180 faces north), &cam=overview|tower|town (fixed camera),
// &pitch=radians, &dist=distance, &done=N (floors of the Seal Tower already cleared), &lead=spirit id, &path=sword|magic, &lowfx / &hq, \n// &check (reachability check: whether the tower gate, chests, residents, teleport pads and spirit zones can be reached on foot from the spawn point; the result is printed to the console).
// Screenshot scripts can drive the scene directly through window.__field (teleport, setCam); window.__fieldReady = true after the first frame is done.

import * as THREE from 'three';
import { Stage } from '../render/stage.ts';
import { FieldScene } from '../render/field/FieldScene.ts';
import { loadBiome } from '../render/field/biomes/index.ts';
import { playerOutfit } from '../render/field/avatar.ts';
import { REGIONS } from '../game/campaign.ts';
import type { RegionId } from '../render/arena.ts';

export async function runFieldView(el: HTMLElement): Promise<void> {
  const params = new URLSearchParams(location.search);
  const region = (params.get('fieldview') || 'forest') as RegionId;
  const idx = Math.max(0, REGIONS.findIndex((r) => r.id === region));
  const R = REGIONS[idx];
  const stage = new Stage(el);
  stage.autoQuality = false;
  const low = params.has('lowfx');
  if (low) stage.setQuality('low');
  else if (params.has('hq')) stage.setQuality('high');
  const biome = await loadBiome(region);
  const at = params.get('at')?.split(',').map(Number);
  const yaw = params.has('yaw') ? (Number(params.get('yaw')) * Math.PI) / 180 : biome.layout.spawn[2];
  const t0 = performance.now();
  const scene = new FieldScene(stage, {
    regionIdx: idx,
    region,
    biome,
    floors: R.stages.length,
    floorsDone: Number(params.get('done') ?? 0),
    openedChests: [],
    npcs: R.npcs,
    lead: { speciesId: params.get('lead') ?? 'pyre_dragoon', stage: 1 },
    outfit: playerOutfit(params.get('path') === 'magic' ? 'magic' : 'sword'),
    session: at ? { x: at[0], z: at[1], yaw, camYaw: yaw + Math.PI, camPitch: Number(params.get('pitch') ?? 0.36), camDist: Number(params.get('dist') ?? 11), wilds: [], seq: 1 } : null,
    low,
    onEncounter: (w) => console.log('encounter', w),
  });
  console.log(`field build ${Math.round(performance.now() - t0)} ms`);
  if (params.has('check')) {
    const r = scene.checkReach();
    console.log(`field check ${r.ok ? 'OK' : 'FAIL'} (${r.reached} sq m walkable)${r.problems.map((p) => `\n- ${p}`).join('')}`);
    (window as unknown as { __fieldCheck: unknown }).__fieldCheck = r;
  }
  const w = window as unknown as { __field: FieldScene; __fieldReady: boolean; __stage: Stage };
  w.__field = scene;
  w.__stage = stage;
  if (params.has('noenc')) scene.frozen = false;

  // Fixed cameras: overview of the whole map, the tower, the town
  const L = biome.layout;
  const cam = params.get('cam');
  if (cam) {
    const S = L.size;
    const presets: Record<string, [THREE.Vector3, THREE.Vector3]> = {
      overview: [new THREE.Vector3(0, S * 1.5, S * 1.25), new THREE.Vector3(0, 0, -S * 0.1)],
      tower: [new THREE.Vector3(L.tower[0] + 8, 14, L.tower[1] + 52), new THREE.Vector3(L.tower[0], 20, L.tower[1])],
      town: [new THREE.Vector3(L.town[0] + 26, 22, L.town[1] + 30), new THREE.Vector3(L.town[0], 2, L.town[1])],
    };
    const p = presets[cam];
    if (p) {
      const h = scene.terrain.heightAt(p[1].x, p[1].z);
      const pos = p[0].clone();
      const look = p[1].clone();
      if (cam !== 'overview') {
        pos.y += h;
        look.y += h;
      }
      scene.frozen = true;
      scene.camOverride = { pos, look };
      // Turn the fog off in the overview so the layout of the whole map is readable
      if (cam === 'overview') stage.scene.fog = null;
    }
  }

  // Keyboard and mouse
  const keys = new Set<string>();
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'Space') scene.input.jump = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  let drag: { x: number; y: number } | null = null;
  stage.renderer.domElement.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, y: e.clientY }));
  window.addEventListener('pointerup', () => (drag = null));
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    scene.rotateCam(e.clientX - drag.x, e.clientY - drag.y);
    drag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('wheel', (e) => scene.zoomCam(e.deltaY * 0.001));
  stage.add(() => {
    const k = (c: string) => (keys.has(c) ? 1 : 0);
    scene.input.x = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft');
    scene.input.z = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown');
    scene.input.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  });
  stage.start();
  let frames = 0;
  stage.add(() => {
    if (++frames === 20) w.__fieldReady = true;
  });
}
