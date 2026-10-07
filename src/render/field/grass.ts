// Grass sea: chunked instanced grass tufts that sway in the wind, and are pushed aside when a character walks through;
// only the chunks near the camera are drawn.

import * as THREE from 'three';
import type { Terrain } from './terrain.ts';

export interface GrassOpts {
  /** Tufts per square meter */
  density: number;
  /** Fraction of grass at that spot (0-1); used to avoid roads, rock walls, beaches and water */
  cover: (x: number, z: number, h: number, slope: number) => number;
  /** Grass color (usually the ground color, brightened) */
  color: (x: number, z: number, out: THREE.Color) => void;
  /** Grass height multiplier */
  height?: number;
  tip: number;
  chunk?: number;
  /** Display radius */
  range?: number;
  seed?: number;
}

function clumpGeometry(): THREE.BufferGeometry {
  // 5 blades of 2 segments each (5 vertices, 3 triangles); uv.y is the height fraction
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let r = 7;
  const rnd = () => ((r = (r * 16807) % 2147483647) - 1) / 2147483646;
  for (let k = 0; k < 5; k++) {
    const a = rnd() * Math.PI;
    const ox = (rnd() - 0.5) * 0.45;
    const oz = (rnd() - 0.5) * 0.45;
    const h = 0.55 + rnd() * 0.45;
    const w = 0.07 + rnd() * 0.03;
    const lean = (rnd() - 0.5) * 0.3;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const base = pos.length / 3;
    const rows = [0, 0.55, 1];
    rows.forEach((t, j) => {
      const ww = w * (1 - t * 0.85);
      const lx = lean * t * t;
      if (j < 2) {
        pos.push(ox - ca * ww + lx, t * h, oz - sa * ww, ox + ca * ww + lx, t * h, oz + sa * ww);
        uv.push(0, t, 1, t);
      } else {
        pos.push(ox + lx, h, oz);
        uv.push(0.5, 1);
      }
    });
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export class Grass {
  group = new THREE.Group();
  private chunks: { mesh: THREE.InstancedMesh; x: number; z: number }[] = [];
  private mat: THREE.ShaderMaterial;
  private geo: THREE.BufferGeometry;
  private range: number;

  constructor(terrain: Terrain, o: GrassOpts) {
    this.geo = clumpGeometry();
    this.range = o.range ?? 60;
    this.mat = new THREE.ShaderMaterial({
      fog: true,
      side: THREE.DoubleSide,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uTime: { value: 0 },
        uPlayer: { value: new THREE.Vector3(0, -99, 0) },
        uFollow: { value: new THREE.Vector3(0, -99, 0) },
        uTip: { value: new THREE.Color(o.tip) },
        uWind: { value: 1 },
        uRange: { value: this.range },
        uCam: { value: new THREE.Vector3() },
        uErode: { value: new THREE.Vector4(0, 0, 0, 0) },
      },
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        uniform float uTime; uniform vec3 uPlayer; uniform vec3 uFollow; uniform float uWind; uniform float uRange; uniform vec3 uCam; uniform vec4 uErode;
        varying float vT; varying vec3 vCol; varying float vFade; varying float vEro;
        void main() {
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float t = uv.y;
          float bend = t * t;
          // Wind: wide-area gust waves plus small sway
          float gust = sin(root.x * 0.08 + root.z * 0.05 - uTime * 1.3) * 0.5 + 0.5;
          vec2 wind = vec2(0.8, 0.45) * (0.18 + gust * 0.42) * uWind + vec2(sin(uTime * 3.1 + root.x * 1.7), cos(uTime * 2.7 + root.z * 1.9)) * 0.05;
          wp.xz += wind * bend;
          // The character and partner push the grass aside and flatten it
          for (int i = 0; i < 2; i++) {
            vec3 p = i == 0 ? uPlayer : uFollow;
            vec2 d = root.xz - p.xz;
            float dist = length(d);
            float k = smoothstep(1.3, 0.1, dist) * step(abs(root.y - p.y), 2.0);
            wp.xz += normalize(d + 1e-4) * k * 0.55 * bend;
            wp.y -= k * 0.35 * t;
          }
          // Distant grass shrinks into the ground and fades out so it is not cut off in a line
          float cd = length(root.xz - uCam.xz);
          vFade = smoothstep(uRange, uRange * 0.7, cd);
          wp.y -= (1.0 - vFade) * 0.9 * t;
          // Where the Void Blight has eroded: the grass withers, lodges and fades to purple-gray
          vEro = 0.0;
          if (uErode.z > 0.0) {
            float d = length(root.xz - uErode.xy) + sin(root.x * 0.2) * 4.0 + cos(root.z * 0.17) * 4.0;
            vEro = smoothstep(uErode.z, uErode.z * 0.78, d) * uErode.w;
            wp.y -= vEro * 0.45 * t;
            wp.xz += vec2(0.3, 0.2) * vEro * bend;
          }
          vT = t;
          #ifdef USE_INSTANCING_COLOR
            vCol = instanceColor;
          #else
            vCol = vec3(0.4, 0.7, 0.3);
          #endif
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform vec3 uTip;
        varying float vT; varying vec3 vCol; varying float vFade; varying float vEro;
        void main() {
          vec3 base = vCol * 0.72;
          vec3 col = mix(base, mix(vCol * 1.15, uTip, 0.45), smoothstep(0.1, 1.0, vT));
          col = mix(col, mix(vec3(0.16, 0.1, 0.2), vec3(0.45, 0.3, 0.45), vT), vEro * 0.85);
          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }`,
    });

    const size = terrain.size;
    const C = o.chunk ?? 16;
    let seed = o.seed ?? 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const nrm = new THREE.Vector3();
    const col = new THREE.Color();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const H = o.height ?? 1;
    for (let cx = -size; cx < size; cx += C) {
      for (let cz = -size; cz < size; cz += C) {
        const n = Math.round(C * C * o.density);
        const mats: THREE.Matrix4[] = [];
        const cols: THREE.Color[] = [];
        for (let i = 0; i < n; i++) {
          const x = cx + rnd() * C;
          const z = cz + rnd() * C;
          const h = terrain.heightAt(x, z);
          terrain.normalAt(x, z, nrm);
          const slope = Math.sqrt(1 - Math.min(1, nrm.y * nrm.y)) / Math.max(0.2, nrm.y);
          const cover = o.cover(x, z, h, slope);
          if (cover <= 0 || rnd() > cover) continue;
          const sc = (0.7 + rnd() * 0.6) * H * (0.6 + cover * 0.4);
          p.set(x, h - 0.05, z);
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
          s.set(sc, sc * (0.8 + rnd() * 0.5), sc);
          mats.push(m.compose(p, q, s).clone());
          o.color(x, z, col);
          cols.push(col.clone().multiplyScalar(0.9 + rnd() * 0.2));
        }
        if (!mats.length) continue;
        const mesh = new THREE.InstancedMesh(this.geo, this.mat, mats.length);
        mats.forEach((mm, i) => {
          mesh.setMatrixAt(i, mm);
          mesh.setColorAt(i, cols[i]);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.frustumCulled = true;
        this.group.add(mesh);
        this.chunks.push({ mesh, x: cx + C / 2, z: cz + C / 2 });
      }
    }
  }

  setErosion(x: number, z: number, r: number, k = 1): void {
    this.mat.uniforms.uErode.value.set(x, z, r, k);
  }

  update(t: number, player: THREE.Vector3, follow: THREE.Vector3, center: THREE.Vector3): void {
    const u = this.mat.uniforms;
    u.uTime.value = t;
    u.uPlayer.value.copy(player);
    u.uFollow.value.copy(follow);
    u.uCam.value.copy(center);
    const r = this.range + 12;
    for (const c of this.chunks) c.mesh.visible = Math.abs(c.x - center.x) < r && Math.abs(c.z - center.z) < r;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    for (const c of this.chunks) c.mesh.dispose();
  }
}
