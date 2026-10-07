// Ultimate cinematic shared by N/R/SR: cut-in, letterbox, orbit, magic-circle light pillar, then one big move by element. Short and cheap;
// the full cinematic camera work is kept for SSR only (see ssr.ts).

import * as THREE from 'three';
import { sfx, synth } from '../../audio/sfx.ts';
import { ease } from '../../render/tween.ts';
import type { SideId } from '../../engine/types.ts';
import { ELEMENT_BRIGHT, ELEMENT_COLOR } from '../scene.ts';
import type { UltCtx, UltScript } from './types.ts';

async function windup(c: UltCtx): Promise<void> {
  const { sc, side, el } = c;
  const col = ELEMENT_COLOR[el];
  c.ui.cutin(side, c.who, c.skill.name, el);
  sfx.whooshBig();
  synth.duck(-14, 1600);
  void sc.tw.to(0.3, (k) => sc.stage.setLetterbox(k), ease.outQuad, 'fx');
  sc.stage.bloom.strength = 1.1;
  const center = sc.center(side);
  sc.rig.orbit = { center, radius: 6.2, height: 1.1, angle: side === 0 ? 1.6 : -1.6, speed: 0.9 };
  await sc.windup(side, 0.3);
  void sc.vfx.circle(center.clone(), col, 3, 1.6, sc.stage.camera.position.clone().sub(center), 7);
  void sc.vfx.pillar(sc.slots[side].home, col, 1.2, 14, 1.4);
  for (let i = 0; i < 8; i++) {
    sc.vfx.emit({ pos: center, count: 30, color: [col, ELEMENT_BRIGHT[el], 0xffffff], speed: [3, 5], inward: true, life: [0.3, 0.45], size: [0.12, 0.3], drag: 0 });
    await sc.tw.wait(0.14, 'fx');
  }
  sc.stage.screenFlash(0xffffff, 0.5, 4);
  sc.rig.orbit = null;
  const tgt: SideId = c.foe;
  const behind = sc.slots[side].home.clone().sub(sc.slots[tgt].home).normalize().multiplyScalar(5).add(sc.slots[side].home).add(new THREE.Vector3(side === 0 ? -2 : 2, 3, 0));
  await sc.rig.moveTo(behind, sc.center(tgt), 0.25, ease.outCubic);
}

/** The big move itself, by element (also borrowed when an SSR has no dedicated move yet) */
export async function elementDelivery(c: UltCtx): Promise<void> {
  const { sc, side, el } = c;
  const v = sc.vfx;
  const col = ELEMENT_COLOR[el];
  const bright = ELEMENT_BRIGHT[el];
  const to = sc.center(c.foe);
  const home = sc.slots[c.foe].home.clone();
  sfx.whooshBig();
  if (c.physical) {
    await sc.lunge(side, 0.14);
    const camDir = sc.stage.camera.position.clone().sub(to).normalize();
    for (let i = 0; i < 3; i++) {
      void v.slash(to, i % 2 ? col : bright, 1.4 + i * 0.3, i * 1.1, camDir, 0.3, 0.45);
      sfx.swish();
      await c.wait(0.08);
    }
    return;
  }
  switch (el) {
    case 'fire': {
      const sky = home.clone().add(new THREE.Vector3(-4, 14, 3));
      await v.projectile(sky, to, 0xff5a1a, 2.2, 0.45, 0, true);
      break;
    }
    case 'water':
      void v.beam(sc.center(side), to, col, 0.9, 0.9);
      await c.wait(0.2);
      break;
    case 'nature':
      void v.spikes(home, 0x4fa83a, 12, 1.8, 3, 1.2);
      v.emit({ pos: to, count: 120, color: [0x6fd65a, 0xb8f07a, 0xffb8e0], speed: [3, 6], life: [0.8, 1.4], size: [0.2, 0.4], atlas: 3, spin: 12, radius: 1.5 });
      await c.wait(0.2);
      break;
    case 'wind':
      for (let i = 0; i < 5; i++) {
        v.emit({ pos: home.clone().setY(i * 0.8), count: 40, color: [0xe8fffa, 0x9fe8e0], speed: [5, 8], life: [0.4, 0.8], size: [0.1, 0.2], radius: 1 });
      }
      await c.wait(0.2);
      break;
    case 'earth':
      void v.spikes(home, 0xa07a4a, 14, 2.2, 3.5, 1.2);
      await c.wait(0.15);
      break;
    case 'thunder':
      for (let i = 0; i < 4; i++) {
        void v.bolt(home.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 16, (Math.random() - 0.5) * 3)), home, i % 2 ? 0xfff066 : 0xc8a0ff, 0.5, 0.14);
        sc.stage.screenFlash(0xe8d8ff, 0.5, 6);
        await c.wait(0.06);
      }
      break;
    case 'light':
      void v.pillar(home, 0xffe680, 2.4, 20, 1.2);
      void v.beam(sc.center(side), to, 0xfff4b0, 0.7, 0.8);
      await c.wait(0.2);
      break;
    case 'dark':
      v.emit({ pos: to, count: 150, color: [0x7a3aff, 0xff4ab0, 0x1a0a3a], speed: [4, 7], inward: true, life: [0.3, 0.5], size: [0.2, 0.4], drag: 0 });
      await c.wait(0.35);
      break;
    default:
      for (let i = 0; i < 6; i++) void v.projectile(sc.center(side), to, 0xc8d8ff, 0.5, 0.3 + i * 0.04, 0.5 + i * 0.3);
      await c.wait(0.4);
  }
  sfx.impactBig();
  void v.ring(home.clone().setY(0.1), col, 1, 9, 0.8);
  void v.ring(to, bright, 0.5, 6, 0.6, sc.stage.camera.position.clone().sub(to));
  v.emit({ pos: to, count: 200, color: [col, bright, 0xffffff], speed: [5, 14], life: [0.4, 1], size: [0.12, 0.3], atlas: 1, drag: 2.5 });
}

/**
 * Ultimate guarded: the barrier is almost shattered: squashed, cracks flash across it one by one, the screen shakes violently, and in the end it holds. Even a failure has to look spectacular.
 */
export async function ultGuarded(c: UltCtx): Promise<void> {
  const { sc } = c;
  const pos = sc.center(c.foe);
  const h = sc.slots[c.foe].creature?.worldHeight ?? 1.5;
  const r = h * 0.8;
  sc.stage.hitStop(220);
  sc.rig.addTrauma(0.85);
  sc.stage.chromatic(1);
  sc.stage.screenFlash(0xcfe8ff, 0.5, 5);
  sfx.guard();
  synth.noise({ type: 'bandpass', f0: 1800, f1: 600, q: 3, dur: 0.6, gain: 0.3 });
  void sc.vfx.bubble(pos, 0x9fd0ff, r, 1.1);
  void sc.vfx.dome(pos, 0xbfe4ff, r * 0.9, r * 1.35, 0.35);
  const toCam = sc.stage.camera.position.clone().sub(pos).normalize();
  for (let i = 0; i < 6; i++) {
    const n = toCam.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.4)).normalize();
    void sc.vfx.glint(pos.clone().addScaledVector(n, r), 0xdff2ff, 0.7 + Math.random() * 0.5, 0.35, 2.5);
    sc.vfx.emit({ pos: pos.clone().addScaledVector(n, r), count: 14, color: [0xcfe8ff, 0xffffff], speed: [3, 7], dir: n, spread: 0.7, life: [0.2, 0.45], size: [0.06, 0.14], atlas: 2 });
    synth.tone({ type: 'triangle', f0: 1800 + Math.random() * 900, dur: 0.2, gain: 0.05, delay: i * 0.05 });
    await c.wait(0.05);
  }
  c.ui.float('撐住了！', sc.top(c.foe), 'fl-guard');
  await c.wait(0.25);
  // Holds: the barrier lights up again
  void sc.vfx.bubble(pos, 0xbfe8ff, r * 0.9, 0.6);
  void sc.vfx.ring(sc.slots[c.foe].home.clone().setY(0.1), 0x9fd0ff, 0.5, 4, 0.5);
  synth.tone({ type: 'triangle', f0: 1400, f1: 2100, dur: 0.4, gain: 0.08 });
  await c.wait(0.3);
}

export const GENERIC_ULT: UltScript = {
  windup,
  deliver: elementDelivery,
  guarded: ultGuarded,
  async finish(c) {
    const { sc } = c;
    await sc.tw.to(0.3, (k) => sc.stage.setLetterbox(1 - k), ease.outQuad, 'fx');
    sc.stage.bloom.strength = sc.stage.bloomBase;
  },
};
