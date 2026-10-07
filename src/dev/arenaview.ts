// Dev only: view a battle arena on its own (add ?arena=volcano to the URL).
// Params: &field=fire (expand the field effect), &spirits=ignisar,thalassene (spirits on each side), &stage=1..3, &lowfx / &hq (quality),
// &cam=battle|showcase|hub|title|ending (camera: battle is the default; showcase is the region view / Codex display stand; hub, title and ending are the cameras for the hub town, the title screen and the ending).
// Positions match a real battle, so screenshots can be compared directly.

import * as THREE from 'three';
import { Stage } from '../render/stage.ts';
import { BattleScene } from '../battle/scene.ts';
import { getSpirit } from '../data.ts';
import { applyInkParam } from '../render/species.ts';
import type { CombatantView } from '../engine/types.ts';
import type { RegionId } from '../render/arena.ts';
import type { Element } from '../../sim/types.ts';

export function runArenaView(el: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  applyInkParam(params);
  const region = (params.get('arena') || 'forest') as RegionId;
  const stage = new Stage(el);
  stage.autoQuality = false;
  if (params.has('lowfx')) stage.setQuality('low');
  else if (params.has('hq')) stage.setQuality('high');
  const scene = new BattleScene(stage, region);
  const ids = (params.get('spirits') ?? 'ignisar,thalassene').split(',').filter(Boolean);
  const st = Math.min(3, Math.max(1, Number(params.get('stage') ?? 3))) as 1 | 2 | 3;
  const view = (id: string): CombatantView => {
    const sp = getSpirit(id);
    return {
      uid: id,
      speciesId: id,
      name: sp.name,
      level: 60,
      stage: st,
      elements: sp.elements,
      hp: 100,
      maxHp: 100,
      shield: 0,
      charges: 0,
      charging: false,
      seeded: false,
      fainted: false,
      stages: { atk: 0, mag: 0, def: 0, res: 0, spd: 0 },
      status: [],
      corrupted: false,
      marks: [],
    };
  };
  // &corrupt=1: the right side (opponent) uses the corrupted form; &corrupt=2: both sides do
  const cor = Number(params.get('corrupt') ?? 0);
  scene.setSpirit(0, { ...view(ids[0] ?? 'ignisar'), corrupted: cor >= 2 });
  scene.setSpirit(1, { ...view(ids[1] ?? ids[0] ?? 'thalassene'), corrupted: cor >= 1 });
  const field = params.get('field') as Element | null;
  if (field) void scene.setField(field);
  const cams: Record<string, [THREE.Vector3, THREE.Vector3]> = {
    showcase: [new THREE.Vector3(0, 2.8, 7.2), new THREE.Vector3(0, 1.6, 0)],
    hub: [new THREE.Vector3(-1.5, 3.4, 11.5), new THREE.Vector3(0.8, 2.6, -4)],
    title: [new THREE.Vector3(0, 5.4, 10), new THREE.Vector3(0, 2.2, -4)],
    ending: [new THREE.Vector3(0, 3.2, 13.5), new THREE.Vector3(0, 3.3, -2)],
  };
  const cam = cams[params.get('cam') ?? ''];
  if (cam) {
    scene.layoutCamera = () => {};
    scene.rig.setBase(cam[0], cam[1]);
  }
  stage.start();
  (window as unknown as { __scene: BattleScene; __ready: boolean }).__scene = scene;
  (window as unknown as { __ready: boolean }).__ready = true;
}
