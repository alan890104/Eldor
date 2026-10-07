// Dev only: show all spirits at once (add ?viewer to the URL; accepts &stage=1..3, &only=id or &only=a,b,c, &rarity=N|R|SR|SSR, &rot=radians, &lowfx for low quality).
// only can be a new id not yet in the data files (the rarity param decides the size).

import * as THREE from 'three';
import { Stage } from '../render/stage.ts';
import { applyInkParam, buildCreature } from '../render/species.ts';
import { SPIRITS } from '../data.ts';
import { blobShadowTex } from '../render/textures.ts';

export function runViewer(el: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  applyInkParam(params);
  const stageParam = Number(params.get('stage') ?? '0');
  const only = params.get('only');
  const stage = new Stage(el);
  stage.autoQuality = false;
  if (params.has('lowfx')) stage.setQuality('low');
  const scene = stage.scene;
  scene.background = new THREE.Color(0x8fb8e8);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshBasicMaterial({ color: 0x9ccf7a }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  type Item = { id: string; rarity: string; st: 1 | 2 | 3; cor?: boolean };
  const cor = params.get('corrupt');
  const rarityParam = params.get('rarity');
  const ids = only ? only.split(',') : SPIRITS.map((s) => s.id);
  const items: Item[] = [];
  for (const id of ids) {
    const rarity = rarityParam ?? SPIRITS.find((s) => s.id === id)?.rarity ?? 'N';
    // Each spirit has only one form: with only set, the three Breakthrough stages sit side by side, just to compare heights
    const stages: (1 | 2 | 3)[] = stageParam ? [stageParam as 1 | 2 | 3] : only ? [1, 2, 3] : [3];
    // &corrupt: show everything in the corrupted form; &corrupt=half: put a corrupted counterpart next to each form
    for (const st of stages) {
      items.push({ id, rarity, st, cor: cor !== null && cor !== 'half' });
      if (cor === 'half') items.push({ id, rarity, st, cor: true });
    }
  }
  const rot = Number(params.get('rot') ?? '0.5');
  // With only set: one row per species, stages I to III from left to right; otherwise a grid
  const perSpecies = new Map<string, number>();
  const placed = items.map((it) => {
    const row = [...new Set(items.map((x) => x.id))].indexOf(it.id);
    const col = perSpecies.get(it.id) ?? 0;
    perSpecies.set(it.id, col + 1);
    return { it, row, col };
  });
  const cols = only ? Math.max(...perSpecies.values()) : Math.ceil(Math.sqrt(items.length * 1.6));
  const creatures = placed.map(({ it, row, col }, i) => {
    const c = buildCreature(it.id, it.st, it.rarity, { corrupted: it.cor });
    const x = only ? col - (cols - 1) / 2 : (i % cols) - (cols - 1) / 2;
    const z = only ? row : Math.floor(i / cols);
    c.root.position.set(x * 3, 0, -z * 3.2);
    c.root.rotation.y = rot;
    scene.add(c.root);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(c.root.position.x, 0.01, c.root.position.z);
    scene.add(sh);
    return c;
  });
  const rows = only ? perSpecies.size : Math.ceil(items.length / cols);
  const span = Math.max(cols * 3, rows * 3.2);
  if (only) {
    const d = 5.5 + cols * 1.4 + (rows - 1) * 2.4;
    stage.camera.position.set(0, 1.6 + rows * 0.9, d);
    stage.camera.lookAt(0, 1.0, -((rows - 1) * 3.2) / 2);
  } else {
    stage.camera.position.set(0, span * 0.45 + 1.5, span * 0.7 + 3);
    stage.camera.lookAt(0, 1, -((rows - 1) * 3.2) / 2);
  }
  stage.add((dt) => creatures.forEach((c) => c.update(dt)));
  stage.start();
  (window as unknown as { __ready: boolean }).__ready = true;
}
