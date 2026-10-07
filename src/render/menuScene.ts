// Common base for the 3D menu scenes: the lifecycle of the stage, tweens, camera, effects and spirits.
// Kept in its own file so the world map (worldmap/), the field and the summon scene all inherit from here without importing scenes.ts.

import * as THREE from 'three';
import { CameraRig } from './camera.ts';
import { buildCreature } from './species.ts';
import type { Creature } from './creature.ts';
import type { Stage } from './stage.ts';
import { blobShadowTex } from './textures.ts';
import { Tweens } from './tween.ts';
import { Vfx } from './vfx.ts';
import { getSpirit } from '../data.ts';

export abstract class MenuScene {
  stage: Stage;
  tw = new Tweens();
  rig: CameraRig;
  vfx = new Vfx();
  root = new THREE.Group();
  time = 0;
  private off: () => void;
  creatures: Creature[] = [];

  constructor(stage: Stage) {
    this.stage = stage;
    stage.clearScene();
    stage.scene.add(this.root);
    this.root.add(this.vfx.group);
    this.rig = new CameraRig(stage.camera, this.tw);
    this.off = stage.add((dt, fxDt, realDt) => {
      this.time += fxDt;
      this.tw.update(dt, fxDt, realDt);
      for (const c of this.creatures) c.update(dt);
      this.tick(dt, fxDt);
      this.vfx.update(fxDt);
      this.rig.update(fxDt, realDt);
    });
    this.vfx.particles.setScale(stage.container.clientHeight, stage.camera.fov);
  }

  protected abstract tick(dt: number, fxDt: number): void;

  protected addCreature(speciesId: string, stage: 1 | 2 | 3, pos: THREE.Vector3, rotY = 0, corrupted = false): Creature {
    const c = buildCreature(speciesId, stage, getSpirit(speciesId).rarity, { corrupted });
    c.root.position.copy(pos);
    c.root.rotation.y = rotY;
    this.root.add(c.root);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(0, 0.02, 0);
    sh.scale.setScalar(c.width * 1.1 / c.root.scale.x);
    c.root.add(sh);
    this.creatures.push(c);
    return c;
  }

  protected removeCreature(c: Creature): void {
    this.root.remove(c.root);
    c.dispose();
    this.creatures = this.creatures.filter((x) => x !== c);
  }

  dispose(): void {
    this.off();
    this.tw.clear();
    this.vfx.clear();
    for (const c of this.creatures) c.dispose();
    this.creatures = [];
    this.stage.setLetterbox(0);
  }
}
