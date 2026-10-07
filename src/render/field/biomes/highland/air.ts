// Highland wind: wind trails sweeping downwind near the character, fast wind streaks, and drifting dandelion seeds and feathers
// (all following the same wind direction).

import * as THREE from 'three';
import type { FieldCtx } from '../../kit.ts';
import { windRibbons } from './fx.ts';
import { landD, SEA, WX, WZ } from './shape.ts';

export function buildAir(ctx: FieldCtx): void {
  const n = ctx.low ? 8 : 16;
  const { mesh, mat, anchors } = windRibbons(n);
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    mesh.geometry.dispose();
    mat.dispose();
  });
  // Each trail: drifts downwind inside a 90 m square cell around the camera; once it drifts out it is refilled from the upwind side
  const B = 90;
  const seeds = Array.from({ length: n }, (_, i) => ({ ox: ctx.r() * B, oz: ctx.r() * B, sp: 5 + ctx.r() * 4, hy: 1.4 + ctx.r() * 3.5, i }));
  const tmp = new THREE.Vector3();
  const dir = new THREE.Vector3(WX, 0.12, WZ).normalize();
  ctx.extras.push((dt, t, vfx) => {
    mat.uniforms.uTime.value = t;
    const cam = vfx.camPos;
    for (const s of seeds) {
      // Move along the wind direction, wrapping inside the cell
      const px = s.ox + WX * t * s.sp;
      const pz = s.oz + WZ * t * s.sp;
      const x = cam.x + ((((px - cam.x) % B) + B * 1.5) % B) - B / 2 - WX * 12;
      const z = cam.z + ((((pz - cam.z) % B) + B * 1.5) % B) - B / 2 - WZ * 12;
      // A trail is about 20 m long: sample the ground height at the head, tail and middle, and lift it above the highest of them
      let gy = -Infinity;
      for (const u of [0, 10, 20]) {
        const qx = x + WX * u;
        const qz = z + WZ * u;
        gy = Math.max(gy, landD(qx, qz) > -1 ? ctx.h(qx, qz) : SEA + 6);
      }
      const d = Math.hypot(x - cam.x, z - cam.z);
      const fade = Math.min(1, Math.max(0, (B / 2 - d) / 12)) * Math.min(1, Math.max(0, (d - 3) / 6));
      anchors[s.i].set(x, gy + s.hy, z, fade);
    }
    // Fast wind streaks
    if (Math.random() < dt * (ctx.low ? 3 : 7)) {
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * 22;
      tmp.set(cam.x + Math.cos(a) * r - WX * 14, 0, cam.z + Math.sin(a) * r - WZ * 14);
      tmp.y = (landD(tmp.x, tmp.z) > 0 ? ctx.h(tmp.x, tmp.z) : cam.y - 8) + 0.8 + Math.random() * 5;
      vfx.emit({ pos: tmp.clone(), count: 1, color: 0xffffff, speed: [16, 24], dir, spread: 0.03, life: [1.2, 1.8], size: [0.22, 0.34], sizeEnd: 1, drag: 0, intensity: 0.5 });
    }
    // Dandelion seeds and feathers
    if (Math.random() < dt * (ctx.low ? 2 : 5)) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 24;
      tmp.set(cam.x + Math.cos(a) * r - WX * 10, 0, cam.z + Math.sin(a) * r - WZ * 10);
      tmp.y = (landD(tmp.x, tmp.z) > 0 ? ctx.h(tmp.x, tmp.z) : cam.y - 6) + 0.5 + Math.random() * 4;
      const feather = Math.random() < 0.25;
      vfx.emit({ pos: tmp.clone(), count: 1, color: feather ? [0xffffff, 0xf2ead8] : [0xffffff, 0xf8f6ea], speed: [2.5, 4.5], dir: new THREE.Vector3(WX, 0.18, WZ), spread: 0.25, life: [5, 8], size: feather ? [0.2, 0.28] : [0.1, 0.16], sizeEnd: 0.8, gravity: feather ? 0.1 : -0.05, drag: 0, intensity: 1.1, atlas: feather ? 3 : 0, spin: feather ? 2.5 : 0 });
    }
  });
}
