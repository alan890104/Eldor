// Collector for everything that moves: tall grass, flags, flocks of birds, waterfalls, windmill blades and floating rocks are all
// registered here first; the last step of decorate builds a few meshes and materials from them and registers the per-frame updates.

import * as THREE from 'three';
import type { FieldCtx } from '../../kit.ts';
import { FLAG_SWAY, FLAP, GRASS_SWAY, SoftGeo, softMaterial, waterfallMaterial } from './fx.ts';

export interface Flock {
  geo: SoftGeo;
  /** Circling center and angular speed */
  x: number;
  y: number;
  z: number;
  speed: number;
}

export class Anim {
  grass = new SoftGeo();
  flags = new SoftGeo();
  flocks: Flock[] = [];
  falls: { geo: THREE.BufferGeometry; parent?: THREE.Object3D }[] = [];
  spinners: { obj: THREE.Object3D; axis: 'x' | 'y' | 'z'; speed: number }[] = [];
  bobbers: { obj: THREE.Object3D; amp: number; speed: number; phase: number; base: number; sway?: number }[] = [];
  /** Other per-frame updates */
  ticks: ((dt: number, t: number) => void)[] = [];

  /** Registers a waterfall (parent is a moving parent object, e.g. a bobbing floating rock) */
  fall(geo: THREE.BufferGeometry, parent?: THREE.Object3D): void {
    this.falls.push({ geo, parent });
  }

  flock(x: number, y: number, z: number, speed: number): SoftGeo {
    const geo = new SoftGeo();
    this.flocks.push({ geo, x, y, z, speed });
    return geo;
  }

  finish(ctx: FieldCtx): void {
    const mats: THREE.ShaderMaterial[] = [];
    const geos: THREE.BufferGeometry[] = [];
    const add = (sg: SoftGeo, mat: THREE.ShaderMaterial, parent: THREE.Object3D = ctx.group) => {
      if (!sg.count) return null;
      const g = sg.build();
      geos.push(g);
      const m = new THREE.Mesh(g, mat);
      parent.add(m);
      return m;
    };
    const grassMat = softMaterial(GRASS_SWAY, 0.62);
    const flagMat = softMaterial(FLAG_SWAY, 0.62);
    const birdMat = softMaterial(FLAP, 0.8);
    mats.push(grassMat, flagMat, birdMat);
    add(this.grass, grassMat);
    add(this.flags, flagMat);
    const flockGroups: { g: THREE.Group; speed: number }[] = [];
    for (const f of this.flocks) {
      const g = new THREE.Group();
      g.position.set(f.x, f.y, f.z);
      ctx.group.add(g);
      const m = add(f.geo, birdMat, g);
      if (m) m.position.set(-f.x, -f.y, -f.z);
      flockGroups.push({ g, speed: f.speed });
    }
    let fallMat: THREE.ShaderMaterial | null = null;
    if (this.falls.length) {
      fallMat = waterfallMaterial();
      mats.push(fallMat);
      for (const f of this.falls) {
        geos.push(f.geo);
        const m = new THREE.Mesh(f.geo, fallMat);
        m.renderOrder = 2;
        (f.parent ?? ctx.group).add(m);
      }
    }
    ctx.disposers.push(() => {
      for (const m of mats) m.dispose();
      for (const g of geos) g.dispose();
    });
    const fm = fallMat;
    ctx.extras.push((dt, t) => {
      grassMat.uniforms.uTime.value = t;
      flagMat.uniforms.uTime.value = t;
      birdMat.uniforms.uTime.value = t;
      if (fm) fm.uniforms.uTime.value = t;
      for (const f of flockGroups) f.g.rotation.y += dt * f.speed;
      for (const s of this.spinners) s.obj.rotation[s.axis] += dt * s.speed;
      for (const b of this.bobbers) {
        b.obj.position.y = b.base + Math.sin(t * b.speed + b.phase) * b.amp;
        if (b.sway) b.obj.rotation.y = Math.sin(t * b.speed * 0.6 + b.phase) * b.sway;
      }
      for (const k of this.ticks) k(dt, t);
    });
  }
}
