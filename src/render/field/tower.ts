// The Seal Tower: the landmark at the end of a region. Each floor of the tower shaft matches one stage:
// the runes of a broken-through floor light up in the element color,
// while floors not yet broken through are wrapped in corrupted purple light; once all are broken through,
// the source crystal at the top sends up a pillar of light.

import * as THREE from 'three';
import { M, PropBatch } from '../arenaKit.ts';
import type { Vfx } from '../vfx.ts';
import type { TowerStyle } from './kit.ts';

const CORRUPT = new THREE.Color(0x9a3aff);
const TIER_H = 4.4;

function portalMaterial(color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        vec2 p = (vUv - vec2(0.5, 0.35)) * vec2(1.0, 0.8);
        float r = length(p);
        float a = atan(p.y, p.x);
        float swirl = sin(a * 5.0 + r * 18.0 - uTime * 3.0) * 0.5 + 0.5;
        float core = smoothstep(0.55, 0.0, r);
        vec3 col = mix(uColor * 0.6, vec3(1.0), core * 0.55) * (0.8 + swirl * 0.5);
        float edge = smoothstep(0.02, 0.1, vUv.x) * smoothstep(0.02, 0.1, 1.0 - vUv.x) * smoothstep(0.0, 0.06, vUv.y);
        gl_FragColor = vec4(col * 1.8, (0.55 + core * 0.4) * edge);
      }`,
  });
}

function beamMaterial(color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAmt: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform float uAmt; varying vec2 vUv;
      void main(){
        float edge = pow(sin(vUv.x * 3.14159), 2.0);
        float streak = 0.7 + 0.3 * sin(vUv.y * 40.0 - uTime * 6.0 + vUv.x * 12.0);
        float fade = smoothstep(1.0, 0.2, vUv.y) * smoothstep(0.0, 0.05, vUv.y);
        gl_FragColor = vec4(uColor * 1.6 * streak, edge * fade * uAmt * 0.55);
      }`,
  });
}

/** The corrupted vortex wrapped around the tower top */
function vortexMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uAmt: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uAmt; varying vec2 vUv;
      void main(){
        float bands = sin(vUv.x * 6.2831 * 3.0 + vUv.y * 9.0 - uTime * 1.6) * 0.5 + 0.5;
        float wisps = sin(vUv.x * 6.2831 * 7.0 - vUv.y * 5.0 + uTime * 2.3) * 0.5 + 0.5;
        float a = smoothstep(0.3, 0.9, bands * 0.7 + wisps * 0.45) * sin(vUv.y * 3.14159);
        vec3 col = mix(vec3(0.16, 0.04, 0.26), vec3(0.75, 0.25, 1.0), wisps * bands);
        gl_FragColor = vec4(col, a * 0.7 * uAmt);
      }`,
  });
}

export class Tower {
  group = new THREE.Group();
  /** In front of the tower door (world coordinates, the trigger point for entering the tower) */
  door = new THREE.Vector3();
  /** Collision radius */
  radius: number;
  /** Tower top height */
  top: number;
  private tiers: THREE.MeshBasicMaterial[] = [];
  private tierCol: THREE.Color[] = [];
  private glow: THREE.Color;
  private crystal: THREE.Mesh;
  private crystalMat: THREE.MeshBasicMaterial;
  private rings: THREE.Object3D[] = [];
  private portal: THREE.ShaderMaterial;
  private beam: THREE.ShaderMaterial;
  private vortex: THREE.ShaderMaterial;
  private vortexMesh: THREE.Mesh;
  private done = 0;
  private total = 1;
  private mats: THREE.Material[] = [];
  private emitT = 0;

  constructor(x: number, y: number, z: number, facing: number, floors: number, st: TowerStyle) {
    const g = this.group;
    g.position.set(x, y, z);
    g.rotation.y = facing;
    this.glow = new THREE.Color(st.glow);
    const kind = st.kind ?? 'pagoda';
    const b = new PropBatch();

    // ── Tower base: a three-tier octagonal stone platform with a front staircase
    const base = [13, 11, 9.4];
    base.forEach((r, i) => {
      b.add(new THREE.CylinderGeometry(r - 0.3, r, 1.1, 8), i % 2 ? st.stoneDark : st.stone, M(0, 0.55 + i * 1.1 - 0.4, 0, Math.PI / 8));
    });
    for (let i = 0; i < 6; i++) b.add(new THREE.BoxGeometry(5.2, 0.55, 1.2), st.stone, M(0, 0.15 + i * 0.5, 14.2 - i * 0.95));
    for (const s of [-1, 1]) {
      b.add(new THREE.BoxGeometry(0.8, 3.4, 6.4), st.stoneDark, M(s * 3, 1.3, 12));
      b.add(new THREE.BoxGeometry(1.0, 1.0, 1.0), st.trim, M(s * 3, 3.4, 14.8));
    }
    // Stone lanterns (on both sides in front of the tower)
    const lampGeo: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      b.add(new THREE.CylinderGeometry(0.4, 0.55, 2.2, 6), st.stoneDark, M(s * 5.8, 4.4, 8.6));
      b.add(new THREE.ConeGeometry(1.0, 0.8, 6), st.roof, M(s * 5.8, 6.2, 8.6));
      lampGeo.push(new THREE.BoxGeometry(0.7, 0.7, 0.7).applyMatrix4(M(s * 5.8, 5.6, 8.6, Math.PI / 4)));
    }

    // ── Tower shaft: per floor, one octagonal wall section, corner pillars, upturned eaves and a ring of runes
    const y0 = 3.3;
    const r0 = 7.4;
    const r1 = kind === 'spire' ? 3.2 : 3.8;
    let topY = y0;
    let yb = y0;
    for (let i = 0; i < floors; i++) {
      const t = floors > 1 ? i / (floors - 1) : 0;
      const r = r0 + (r1 - r0) * t;
      const broken = kind === 'ruin' && i >= floors - 2;
      // The first floor is extra tall: the tower door opens on this floor
      const wallH = i === 0 ? 8 : TIER_H - 1.1;
      b.add(new THREE.CylinderGeometry(r * 0.94, r, wallH, 8), st.stone, M(0, yb + wallH / 2, 0, Math.PI / 8));
      // Corner pillars
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        b.add(new THREE.CylinderGeometry(0.34, 0.4, wallH, 6), st.stoneDark, M(Math.sin(a) * r * 0.98, yb + wallH / 2, Math.cos(a) * r * 0.98));
      }
      // Eaves
      const eaveR = r * (kind === 'spire' ? 1.18 : 1.42);
      const eaveY = yb + wallH;
      if (!broken) {
        b.add(new THREE.CylinderGeometry(r * 0.78, eaveR, 1.1, 8), st.roof, M(0, eaveY + 0.55, 0, Math.PI / 8));
        b.add(new THREE.CylinderGeometry(eaveR + 0.08, eaveR + 0.08, 0.22, 8), st.trim, M(0, eaveY + 0.06, 0, Math.PI / 8));
        if (kind === 'pagoda') {
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
            const cx = Math.sin(a) * eaveR * 0.99;
            const cz = Math.cos(a) * eaveR * 0.99;
            const tip = new THREE.ConeGeometry(0.22, 1.3, 5);
            b.add(tip, st.trim, new THREE.Matrix4().compose(new THREE.Vector3(cx, eaveY + 0.35, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9)), new THREE.Vector3(1, 1, 1)));
          }
        }
      } else {
        // Crumbled floors: walls with missing corners and scattered stones
        for (let k = 0; k < 5; k++) b.add(new THREE.DodecahedronGeometry(0.8 + (k % 3) * 0.3, 0), st.stoneDark, M(Math.sin(k * 1.7) * r, eaveY + 0.4 + (k % 2) * 0.8, Math.cos(k * 1.7) * r, k));
      }
      // Floor runes and windows (one material per floor, lit once broken through)
      const mat = new THREE.MeshBasicMaterial({ color: CORRUPT.clone().multiplyScalar(1.2), toneMapped: false });
      this.mats.push(mat);
      this.tiers.push(mat);
      this.tierCol.push(CORRUPT.clone().multiplyScalar(1.2));
      const band = new THREE.CylinderGeometry(r * 0.955 + 0.03, r * 0.965 + 0.03, 0.22, 8, 1, true);
      const bandMesh = new THREE.Mesh(band, mat);
      bandMesh.position.y = yb + wallH * 0.18;
      bandMesh.rotation.y = Math.PI / 8;
      g.add(bandMesh);
      for (let k = 0; k < 4; k++) {
        if (i === 0 && k === 0) continue;
        const a = (k / 4) * Math.PI * 2 + (i % 2 ? Math.PI / 4 : 0);
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.5), mat);
        const wr = r * 0.97 + 0.02;
        win.position.set(Math.sin(a) * wr * 0.92, yb + wallH * 0.58, Math.cos(a) * wr * 0.92);
        win.rotation.y = a;
        g.add(win);
      }
      topY = eaveY + 1.1;
      yb = topY;
    }

    // ── Tower top: a pointed spire and a floating source crystal
    const spireH = kind === 'spire' ? 9 : 5;
    b.add(new THREE.ConeGeometry(r1 * 0.9, spireH, 8), st.roof, M(0, topY + spireH / 2, 0, Math.PI / 8));
    b.add(new THREE.TorusGeometry(r1 * 0.55, 0.14, 6, 16), st.trim, M(0, topY + 1.2, 0, 0, 1, Math.PI / 2));
    b.add(new THREE.CylinderGeometry(0.1, 0.1, 3, 5), st.trim, M(0, topY + spireH + 1.2, 0));
    this.top = topY + spireH + 5;
    this.crystalMat = new THREE.MeshBasicMaterial({ color: this.glow.clone().multiplyScalar(0.6), toneMapped: false });
    this.mats.push(this.crystalMat);
    const cg = new THREE.OctahedronGeometry(1.1);
    cg.scale(0.7, 1.5, 0.7);
    this.crystal = new THREE.Mesh(cg, this.crystalMat);
    this.crystal.position.y = this.top;
    g.add(this.crystal);

    // ── Seal rings: three rings slowly turning around the shaft, with talismans hanging from them
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Group();
      const ry = y0 + (topY - y0) * (0.3 + i * 0.25);
      const rr = r0 + 2.4 - i * 1.4;
      ring.position.y = ry;
      ring.rotation.set(0.12 * (i - 1), 0, 0.1 * (1 - i));
      const tor = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.07, 4, 64), this.tiers[Math.min(this.tiers.length - 1, Math.floor(((i + 1) / 3) * floors) - 1)] ?? this.crystalMat);
      tor.rotation.x = Math.PI / 2;
      ring.add(tor);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), tor.material as THREE.Material);
        plate.position.set(Math.cos(a) * rr, -0.55, Math.sin(a) * rr);
        plate.rotation.y = -a + Math.PI / 2;
        ring.add(plate);
      }
      g.add(ring);
      this.rings.push(ring);
    }

    // ── Tower door: a stone arch and a rotating teleport light curtain
    b.add(new THREE.BoxGeometry(1.1, 5.2, 1.4), st.stoneDark, M(-2.1, y0 + 2.6 - 0.2, r0 - 0.1));
    b.add(new THREE.BoxGeometry(1.1, 5.2, 1.4), st.stoneDark, M(2.1, y0 + 2.6 - 0.2, r0 - 0.1));
    b.add(new THREE.TorusGeometry(2.1, 0.55, 6, 12, Math.PI), st.trim, M(0, y0 + 5.0, r0 - 0.1));
    this.portal = portalMaterial(st.glow);
    this.mats.push(this.portal);
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 6.6), this.portal);
    portal.position.set(0, y0 + 2.1, r0 + 0.25);
    g.add(portal);
    b.build(g);
    const lampMat = new THREE.MeshBasicMaterial({ color: this.glow.clone().multiplyScalar(2), toneMapped: false });
    this.mats.push(lampMat);
    for (const lg of lampGeo) g.add(new THREE.Mesh(lg, lampMat));

    // ── Light pillar (all broken through) and corrupted vortex (not yet)
    this.beam = beamMaterial(st.glow);
    this.mats.push(this.beam);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 120, 16, 1, true), this.beam);
    beam.position.y = this.top + 60;
    g.add(beam);
    this.vortex = vortexMaterial();
    this.mats.push(this.vortex);
    this.vortexMesh = new THREE.Mesh(new THREE.CylinderGeometry(9, 3.5, 14, 32, 1, true), this.vortex);
    this.vortexMesh.position.y = this.top - 3;
    g.add(this.vortexMesh);

    const door = new THREE.Vector3(0, 0, 16.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), facing);
    this.door.set(x + door.x, y, z + door.z);
    this.radius = 13.5;
  }

  /** `done` floors broken through out of `total` */
  setProgress(done: number, total: number): void {
    this.done = done;
    this.total = total;
    this.tiers.forEach((m, i) => {
      const lit = i < done;
      const c = lit ? this.glow.clone().multiplyScalar(2.1) : CORRUPT.clone().multiplyScalar(i === done ? 1.6 : 0.9);
      this.tierCol[i] = c;
      m.color.copy(c);
    });
    this.crystalMat.color.copy(this.glow).multiplyScalar(done >= total ? 3 : 0.7);
    this.vortex.uniforms.uAmt.value = done >= total ? 0 : 0.35 + 0.65 * (1 - done / total);
    this.vortexMesh.visible = done < total;
    this.beam.uniforms.uAmt.value = done >= total ? 1 : 0;
  }

  update(dt: number, t: number, vfx: Vfx, near: boolean): void {
    this.crystal.rotation.y += dt * 0.8;
    this.crystal.position.y = this.top + Math.sin(t * 1.3) * 0.5;
    this.rings.forEach((r, i) => (r.rotation.y += dt * (0.12 + i * 0.05) * (i % 2 ? -1 : 1)));
    this.portal.uniforms.uTime.value = t;
    this.beam.uniforms.uTime.value = t;
    this.vortex.uniforms.uTime.value = t;
    this.vortexMesh.rotation.y -= dt * 0.35;
    // The runes of the next floor (the one being challenged) breathe
    const i = this.done;
    if (i < this.tiers.length) this.tiers[i].color.copy(this.tierCol[i]).multiplyScalar(0.75 + 0.35 * Math.sin(t * 3));
    // When approached, corrupted shards of light rise from the tower top (or light motes once broken through)
    if (!near) return;
    this.emitT += dt;
    while (this.emitT > 0.09) {
      this.emitT -= 0.09;
      const a = Math.random() * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(a) * 6, this.top - 6 + Math.random() * 6, Math.sin(a) * 6).applyMatrix4(this.group.matrixWorld);
      const clear = this.done >= this.total;
      vfx.emit({
        pos: p,
        count: 1,
        color: clear ? [this.glow.getHex(), 0xffffff] : [0x9a3aff, 0x5a1a8a, 0xff5ac8],
        speed: [0.5, 1.4],
        dir: new THREE.Vector3(0, clear ? 1 : -0.3, 0),
        spread: 0.8,
        life: [2, 3.5],
        size: [0.25, 0.5],
        sizeEnd: 0.2,
        intensity: 1.6,
      });
    }
  }

  dispose(): void {
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    for (const m of this.mats) m.dispose();
  }
}
