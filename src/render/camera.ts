// Camera: tweenable position and look-at target, plus a "trauma" shake model (shake amplitude = trauma²).

import * as THREE from 'three';
import { ease, type Tweens } from './tween.ts';

export class CameraRig {
  cam: THREE.PerspectiveCamera;
  pos = new THREE.Vector3();
  look = new THREE.Vector3();
  base = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  trauma = 0;
  private t = 0;
  private tw: Tweens;
  /** Orbit driven by code */
  orbit: { center: THREE.Vector3; radius: number; height: number; angle: number; speed: number } | null = null;
  /** Camera roll (Dutch angle), in radians */
  roll = 0;
  /** Control token: every new camera move takes a new token, so older tweens go stale and never fight each other */
  private gen = 0;

  constructor(cam: THREE.PerspectiveCamera, tw: Tweens) {
    this.cam = cam;
    this.tw = tw;
  }

  setBase(pos: THREE.Vector3, look: THREE.Vector3): void {
    this.base.pos.copy(pos);
    this.base.look.copy(look);
    this.pos.copy(pos);
    this.look.copy(look);
  }

  addTrauma(t: number): void {
    this.trauma = Math.min(1, this.trauma + t);
  }

  update(fxDt: number, realDt: number): void {
    this.t += realDt;
    if (this.orbit) {
      const o = this.orbit;
      o.angle += o.speed * fxDt;
      this.pos.set(o.center.x + Math.cos(o.angle) * o.radius, o.center.y + o.height, o.center.z + Math.sin(o.angle) * o.radius);
      this.look.copy(o.center);
    }
    this.cam.position.copy(this.pos);
    if (this.pos.distanceToSquared(this.look) > 1e-8) this.cam.lookAt(this.look);
    if (this.roll) this.cam.rotateZ(this.roll);
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma;
      const n = (f: number, p: number) => Math.sin(this.t * f + p) * 0.6 + Math.sin(this.t * f * 2.3 + p * 1.7) * 0.4;
      this.cam.position.x += n(47, 0) * s * 0.35;
      this.cam.position.y += n(53, 1) * s * 0.3;
      this.cam.rotation.z += n(41, 2) * s * 0.035;
      this.trauma = Math.max(0, this.trauma - realDt * 1.5);
    }
  }

  /** Take control of the camera: stop orbiting and invalidate any moveTo / camera move in progress */
  claim(): number {
    this.orbit = null;
    return ++this.gen;
  }

  owns(token: number): boolean {
    return token === this.gen;
  }

  /** Move to the given position (fx clock, so the camera still moves during hit-stop) */
  moveTo(pos: THREE.Vector3, look: THREE.Vector3, dur: number, e = ease.inOutQuad, clock: 'fx' | 'real' = 'fx'): Promise<void> {
    const token = this.claim();
    const p0 = this.pos.clone();
    const l0 = this.look.clone();
    return this.tw.to(
      dur,
      (k) => {
        if (token !== this.gen) return;
        this.pos.lerpVectors(p0, pos, k);
        this.look.lerpVectors(l0, look, k);
      },
      e,
      clock,
    );
  }

  reset(dur = 0.5): Promise<void> {
    return this.moveTo(this.base.pos, this.base.look, dur);
  }

  /** Dolly toward the look-at target by the amount fraction */
  push(amount: number, dur: number, look?: THREE.Vector3): Promise<void> {
    const l = look ?? this.look;
    const p = this.pos.clone().lerp(l, amount);
    return this.moveTo(p, l.clone(), dur, ease.outCubic);
  }
}
