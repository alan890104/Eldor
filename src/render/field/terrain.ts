// Field terrain: a height-field mesh (vertex colors plus cartoon color steps) that serves height queries so characters,
// spirits and props sit on the ground; also a water surface that makes waves.

import * as THREE from 'three';
import { LIGHT } from '../toon.ts';

export interface TerrainOpts {
  /** Half the side length: the terrain covers [-size, size] */
  size: number;
  /** Cells per side */
  seg: number;
  height: (x: number, z: number) => number;
  /** Vertex colors (0-1); slope is the steepness (0 flat, 1 about 45 degrees) */
  color: (x: number, z: number, h: number, slope: number, out: THREE.Color) => void;
}

const terrainVert = /* glsl */ `
  #include <fog_pars_vertex>
  attribute vec3 color;
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vColor = color;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const terrainFrag = /* glsl */ `
  #include <fog_pars_fragment>
  uniform vec3 uLightDir;
  uniform vec3 uAmbient;
  uniform vec3 uShadowTint;
  uniform float uDetail;
  uniform vec4 uErode;
  uniform float uTime;
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  void main() {
    vec3 n = normalize(vNormal);
    float ndl = dot(n, normalize(uLightDir));
    float lit = smoothstep(-0.08, 0.1, ndl) * 0.62 + smoothstep(0.52, 0.6, ndl) * 0.38;
    // Two layers of noise, large and small, give the grass and rock surfaces variation so they are not one flat fill
    float big = vnoise(vWorld.xz * 0.045);
    float mid = vnoise(vWorld.xz * 0.23);
    float fine = vnoise(vWorld.xz * 1.7);
    vec3 base = vColor * (0.9 + big * 0.16 + (mid - 0.5) * 0.1 * uDetail + (fine - 0.5) * 0.07 * uDetail);
    // Land eroded by the Void Blight: spreads outward from the Seal Tower with a ragged edge; the ground turns black and is covered in glowing cracks
    float ero = 0.0;
    if (uErode.z > 0.0) {
      float d = length(vWorld.xz - uErode.xy) + (big - 0.5) * 14.0 + (mid - 0.5) * 5.0;
      ero = smoothstep(uErode.z, uErode.z * 0.75, d) * uErode.w;
      base = mix(base, vec3(0.13, 0.06, 0.17) + base * 0.15, ero * 0.85);
    }
    vec3 shade = base * mix(uShadowTint * 0.7, vec3(1.0), 0.42);
    vec3 col = mix(shade, base, lit);
    col *= mix(uAmbient * 1.3, vec3(1.08), 0.6);
    if (ero > 0.0) {
      vec2 q = vWorld.xz * 0.35;
      float n1 = vnoise(q + vec2(vnoise(q * 0.5) * 3.0));
      float crack = 1.0 - smoothstep(0.0, 0.03, abs(n1 - 0.5));
      // Only some of it splits open, and only on flat ground (projection on steep walls would stretch into messy lines)
      crack *= smoothstep(0.35, 0.6, vnoise(q * 0.4 + 13.0)) * smoothstep(0.7, 0.9, n.y);
      float pulse = 0.55 + 0.45 * sin(uTime * 2.0 - length(vWorld.xz - uErode.xy) * 0.25);
      col += vec3(1.3, 0.12, 0.95) * crack * ero * pulse;
    }
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`;

export class Terrain {
  readonly size: number;
  readonly seg: number;
  readonly heights: Float32Array;
  readonly mesh: THREE.Mesh;
  private step: number;

  constructor(o: TerrainOpts) {
    this.size = o.size;
    this.seg = o.seg;
    this.step = (o.size * 2) / o.seg;
    const n = o.seg + 1;
    this.heights = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) this.heights[j * n + i] = o.height(-o.size + i * this.step, -o.size + j * this.step);
    }
    const geo = new THREE.PlaneGeometry(o.size * 2, o.size * 2, o.seg, o.seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    // After PlaneGeometry is rotated, the vertex z runs from -size to size and x from -size to size, in the same order as heights
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k);
      const z = pos.getZ(k);
      pos.setY(k, this.heightAt(x, z));
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const slope = Math.sqrt(1 - Math.min(1, nrm.getY(k) ** 2)) / Math.max(0.2, nrm.getY(k));
      o.color(pos.getX(k), pos.getZ(k), pos.getY(k), slope, c);
      colors[k * 3] = c.r;
      colors[k * 3 + 1] = c.g;
      colors[k * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uLightDir: LIGHT.dir,
        uAmbient: LIGHT.ambient,
        uShadowTint: LIGHT.shadowTint,
        uDetail: { value: 1 },
        uErode: { value: new THREE.Vector4(0, 0, 0, 0) },
        uTime: { value: 0 },
      },
      vertexShader: terrainVert,
      fragmentShader: terrainFrag,
    });
    this.mesh = new THREE.Mesh(geo, mat);
  }

  /**
   * Ground height, exactly the same as the drawn mesh (clamped to the edge when out of range):
   * PlaneGeometry cuts each cell into two triangles along the u + v = 1 diagonal,
   * and bilinear interpolation would differ from the actual triangle faces by a few centimeters,
   * making thin patches and strips on the ground float up or get eaten by the ground
   */
  heightAt(x: number, z: number): number {
    const n = this.seg + 1;
    const fx = Math.min(this.seg - 1e-4, Math.max(0, (x + this.size) / this.step));
    const fz = Math.min(this.seg - 1e-4, Math.max(0, (z + this.size) / this.step));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const h = this.heights;
    const a = h[j * n + i];
    const b = h[j * n + i + 1];
    const c = h[(j + 1) * n + i];
    const d = h[(j + 1) * n + i + 1];
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }

  /** Ground normal (finite differences) */
  normalAt(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    const e = this.step;
    return out.set(this.heightAt(x - e, z) - this.heightAt(x + e, z), 2 * e, this.heightAt(x, z - e) - this.heightAt(x, z + e)).normalize();
  }

  /** Encode the heights into a 0-255 texture (the water surface uses it to compute depth and shoreline foam) */
  heightTexture(lo: number, hi: number): THREE.DataTexture {
    const n = this.seg + 1;
    const data = new Uint8Array(n * n * 4);
    for (let k = 0; k < n * n; k++) {
      const v = Math.round(Math.min(1, Math.max(0, (this.heights[k] - lo) / (hi - lo))) * 255);
      data[k * 4] = v;
      data[k * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  /** Void Blight erosion: center (x, z), radius, strength */
  setErosion(x: number, z: number, r: number, k = 1): void {
    (this.mesh.material as THREE.ShaderMaterial).uniforms.uErode.value.set(x, z, r, k);
  }

  setTime(t: number): void {
    (this.mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

// ───────────────────────── Water surface ─────────────────────────

export interface WaterOpts {
  level: number;
  shallow: number;
  deep: number;
  foam: number;
  /** Lava: glows by itself, flows more slowly, no reflections */
  lava?: boolean;
  /** Color of the distant horizon line (close to the fog color) */
  horizon?: number;
}

/**
 * The whole water surface: depth is computed from the terrain height texture, shallows are brighter, and a ring of moving foam runs along the shore
 */
export function buildWater(terrain: Terrain, o: WaterOpts): { mesh: THREE.Mesh; update: (t: number) => void; dispose: () => void } {
  const lo = o.level - 4;
  const hi = o.level + 1;
  const htex = terrain.heightTexture(lo, hi);
  const S = terrain.size;
  const mat = new THREE.ShaderMaterial({
    fog: true,
    transparent: !o.lava,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uH: { value: htex },
      uSize: { value: S },
      uLevel: { value: (o.level - lo) / (hi - lo) },
      uRange: { value: hi - lo },
      uShallow: { value: new THREE.Color(o.shallow) },
      uDeep: { value: new THREE.Color(o.deep) },
      uFoam: { value: new THREE.Color(o.foam) },
      uLava: { value: o.lava ? 1 : 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform sampler2D uH; uniform float uSize; uniform float uLevel; uniform float uRange;
      uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam; uniform float uLava; uniform float uTime;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        vec2 uv = (vWorld.xz + uSize) / (2.0 * uSize);
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        float ground = mix(0.0, texture2D(uH, clamp(uv, 0.0, 1.0)).r, inside);
        float depth = max(0.0, (uLevel - ground) * uRange);
        float spd = mix(1.0, 0.25, uLava);
        vec2 p = vWorld.xz;
        float n1 = vnoise(p * 0.35 + vec2(uTime * 0.25, uTime * 0.18) * spd);
        float n2 = vnoise(p * 0.9 - vec2(uTime * 0.31, -uTime * 0.2) * spd);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.2, 3.2, depth));
        // Water glints: two layers of noise multiplied into fine bright lines
        float glint = smoothstep(0.72, 0.9, n1 * n2 * 1.9);
        col += glint * mix(vec3(0.35), uFoam * 0.8, uLava);
        // Shore foam: a ring pushed toward the shore over time
        float shore = 1.0 - smoothstep(0.0, 0.9, depth);
        float wave = smoothstep(0.55, 0.9, sin(depth * 7.0 - uTime * 2.2 * spd + n1 * 3.0) * 0.5 + 0.5) * smoothstep(1.4, 0.2, depth);
        col = mix(col, uFoam, clamp(shore * 0.75 + wave * 0.5, 0.0, 1.0));
        float alpha = mix(mix(0.72, 0.95, smoothstep(0.1, 2.5, depth)), 1.0, uLava);
        gl_FragColor = vec4(col * mix(1.0, 1.6 + n2 * 0.6, uLava), alpha);
        #include <fog_fragment>
      }`,
  });
  const geo = new THREE.PlaneGeometry(S * 5, S * 5, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = o.level;
  mesh.renderOrder = 2;
  return {
    mesh,
    update: (t) => (mat.uniforms.uTime.value = t),
    dispose: () => {
      geo.dispose();
      mat.dispose();
      htex.dispose();
    },
  };
}
