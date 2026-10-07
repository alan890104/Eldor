// The world outside the highlands: an endless sea of clouds (flowing, parting at times), cloud hills rising from the sea,
// other mesas and snow peaks in the distance poking out of the clouds, and high clouds in the sky stretched downwind.

import * as THREE from 'three';
import { M, MS } from '../../../arenaKit.ts';
import type { FieldCtx } from '../../kit.ts';
import { cloudSeaMaterial, cloudShellMaterial } from './fx.ts';
import { SEA } from './shape.ts';

export function buildSky(ctx: FieldCtx, haze: number): void {
  const { b, r } = ctx;
  // Cloud sea
  const seaMat = cloudSeaMaterial(haze);
  const seaGeo = new THREE.CircleGeometry(1300, 72);
  seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.y = SEA;
  sea.renderOrder = -1;
  ctx.group.add(sea);
  // High clouds in the sky (follow the camera)
  const shellMat = cloudShellMaterial();
  const shellGeo = new THREE.SphereGeometry(760, 32, 16);
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.renderOrder = -5;
  shell.frustumCulled = false;
  ctx.group.add(shell);

  // Cloud hills on the sea: a few flattened big clouds clumped together
  b.lift = 0;
  const S = ctx.layout.size;
  const mounds = ctx.low ? 22 : 40;
  for (let i = 0; i < mounds; i++) {
    const a = r() * Math.PI * 2;
    const d = S * 1.0 + r() * 260;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const s = 9 + r() * 18;
    const n = 3 + Math.floor(r() * 3);
    for (let j = 0; j < n; j++) {
      const ox = (r() - 0.5) * s * 1.6;
      const oz = (r() - 0.5) * s * 1.2;
      const ss = s * (0.5 + r() * 0.5);
      b.add(new THREE.IcosahedronGeometry(1, 1), j % 2 ? 0xf2f6fd : 0xe4ecf8, MS(x + ox, SEA - ss * 0.2, z + oz, ss, ss * 0.55, ss, r() * 6), false);
    }
  }

  // Farther snow peaks: several ranges rise out of the cloud sea. The vertices are jittered into irregular rock cones, the color
  // fades from the sky's hazy blue at the bottom to snow white at the top, and each face is shaded by its orientation so they read
  // as volumes from afar (they skip fog and blend into the sky color themselves).
  const pos: number[] = [];
  const colA: number[] = [];
  const haze3 = new THREE.Color(0xdce8f6);
  const rock = new THREE.Color(0xa3b6d6);
  const rockDark = new THREE.Color(0x8499c0);
  const snow = new THREE.Color(0xf4f7fd);
  const sun = new THREE.Vector3(0.55, 0.62, 0.56).normalize();
  const tmpC = new THREE.Color();
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const hash = (x: number, y: number, z: number) => {
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return h - Math.floor(h);
  };
  const addPeak = (x: number, z: number, h: number, w: number, seg: number, ry: number) => {
    const cone = new THREE.ConeGeometry(w, h, seg, 4);
    const p = cone.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i);
      const py = p.getY(i);
      const pz = p.getZ(i);
      const t = py / h + 0.5;
      if (t > 0.99) continue;
      const k = 1 + (hash(Math.round(px * 10), Math.round(py * 10), Math.round(pz * 10)) - 0.5) * 0.45 * (1 - t * 0.5);
      p.setXYZ(i, px * k, py + (hash(Math.round(pz * 10), Math.round(py * 10), 3) - 0.5) * h * 0.06 * (1 - t), pz * k);
    }
    const g = cone.toNonIndexed().applyMatrix4(M(x, SEA - 6 + h / 2, z, ry));
    cone.dispose();
    const gp = g.getAttribute('position') as THREE.BufferAttribute;
    const base = SEA - 6;
    const snowLine = 0.55 + hash(x, z, 1) * 0.15;
    for (let i = 0; i < gp.count; i += 3) {
      va.fromBufferAttribute(gp, i);
      vb.fromBufferAttribute(gp, i + 1);
      vc.fromBufferAttribute(gp, i + 2);
      nrm.subVectors(vb, va).cross(vc.clone().sub(va)).normalize();
      const lit = 0.72 + 0.34 * Math.max(0, nrm.dot(sun));
      for (const v of [va, vb, vc]) {
        const t = (v.y - base) / h;
        if (t > snowLine + (hash(v.x, v.z, 2) - 0.5) * 0.12) tmpC.copy(snow);
        else tmpC.copy(rockDark).lerp(rock, Math.min(1, t * 1.6));
        tmpC.multiplyScalar(lit);
        // Mountain feet sink into the mist of the cloud sea
        tmpC.lerp(haze3, Math.max(0, 1 - t * 2.4) * 0.85);
        pos.push(v.x, v.y, v.z);
        colA.push(tmpC.r, tmpC.g, tmpC.b);
      }
    }
    g.dispose();
  };
  // Distant mesas: also layered rock walls with grass on top, some with floating rocks above. Like the snow peaks, the shading
  // and the atmospheric haze color are baked into the vertex colors so the silhouettes read (left to fog they would be just
  // gray-white blocks).
  const strata = [0xc9b491, 0xa98e74, 0xbfa283, 0x9a8a80].map((c) => new THREE.Color(c));
  const grassTop = new THREE.Color(0x86b86a);
  const addSolid = (geo: THREE.BufferGeometry, col: THREE.Color, haze: number, grassUp = false) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const gp = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < gp.count; i += 3) {
      va.fromBufferAttribute(gp, i);
      vb.fromBufferAttribute(gp, i + 1);
      vc.fromBufferAttribute(gp, i + 2);
      nrm.subVectors(vb, va).cross(vc.clone().sub(va)).normalize();
      const lit = 0.7 + 0.38 * Math.max(0, nrm.dot(sun));
      tmpC.copy(grassUp && nrm.y > 0.5 ? grassTop : col).multiplyScalar(lit).lerp(haze3, haze);
      for (const v of [va, vb, vc]) {
        pos.push(v.x, v.y, v.z);
        colA.push(tmpC.r, tmpC.g, tmpC.b);
      }
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  };
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + r() * 0.3;
    const d = 300 + r() * 220;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const hz = 0.34 + ((d - 300) / 220) * 0.24;
    const R = 12 + r() * 24;
    const H = 8 + r() * 26;
    const seg = 7 + Math.floor(r() * 4);
    const ry = r() * 6;
    let y = SEA - 8;
    let rr = R * 1.05;
    const tiers = 3 + Math.floor(r() * 3);
    for (let t = 0; t < tiers; t++) {
      const th = (H + 8) / tiers;
      const r1 = rr * (0.84 + r() * 0.08);
      addSolid(new THREE.CylinderGeometry(r1, rr, th, seg).applyMatrix4(M(x, y + th / 2, z, ry + t * 0.4)), strata[(i + t) % strata.length], hz, t === tiers - 1);
      y += th;
      rr = r1 * (t === tiers - 2 ? 1.04 : 0.99);
    }
    addSolid(new THREE.IcosahedronGeometry(1, 1).applyMatrix4(MS(x + (r() - 0.5) * rr * 0.4, y, z + (r() - 0.5) * rr * 0.4, rr * 0.75, rr * 0.14, rr * 0.75, r() * 6)), grassTop, hz);
    if (r() < 0.5) {
      // Floating rocks above
      const fy = y + 14 + r() * 20;
      const fs = 4 + r() * 6;
      const cone = new THREE.ConeGeometry(fs, fs * 2.2, 7);
      cone.rotateX(Math.PI);
      addSolid(cone.applyMatrix4(M(x + fs * 2, fy - fs * 1.1, z, r() * 6)), strata[1], hz);
      addSolid(new THREE.CylinderGeometry(fs * 1.02, fs, 1, 7).applyMatrix4(M(x + fs * 2, fy + 0.3, z)), grassTop, hz);
    }
  }
  // Four ranges (north, northeast, west, southwest), each made of one main peak and a few side peaks
  for (const [ca, n] of [[-1.75, 5], [-0.7, 4], [2.9, 5], [2.1, 3]] as const) {
    for (let j = 0; j < n; j++) {
      const a = ca + (j - (n - 1) / 2) * 0.09 + (r() - 0.5) * 0.04;
      const d = 600 + r() * 110;
      const main = j === Math.floor(n / 2);
      const h = (main ? 70 : 34) + r() * (main ? 30 : 26);
      addPeak(Math.cos(a) * d, Math.sin(a) * d, h, h * (0.55 + r() * 0.3), 6 + Math.floor(r() * 3), r() * 6);
    }
  }
  const peakGeo = new THREE.BufferGeometry();
  peakGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  peakGeo.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
  const peakMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const peaks = new THREE.Mesh(peakGeo, peakMat);
  peaks.renderOrder = -2;
  ctx.group.add(peaks);

  ctx.disposers.push(() => {
    seaMat.dispose();
    seaGeo.dispose();
    shellMat.dispose();
    shellGeo.dispose();
    peakMat.dispose();
    peakGeo.dispose();
  });
  ctx.extras.push((_dt, t, vfx) => {
    seaMat.uniforms.uTime.value = t;
    shellMat.uniforms.uTime.value = t;
    shell.position.copy(vfx.camPos);
  });
}
