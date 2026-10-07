// Shader fragments shared by the Void Rift: noise, Voronoi, the nebula sky (the sky shell and the void plane share one
// function so the horizons meet), and the heartbeat.

import * as THREE from 'three';

/** Heartbeat: two beats per group, a 1.35-second period, 0-1 (the same rhythm as the battle arena) */
export function heartbeat(t: number): number {
  const p = (t % 1.35) / 1.35;
  const beat = (c: number, w: number) => Math.exp(-((p - c) * (p - c)) / (w * w));
  return Math.min(1, beat(0.12, 0.05) + 0.55 * beat(0.34, 0.06));
}

/** The time and heartbeat shared by all void-blight materials (one object placed into every material's uniforms, updated once per frame) */
export interface RiftClock {
  uTime: { value: number };
  uBeat: { value: number };
  /** 1 once the Seal Tower is fully broken through: the light of the rift calms */
  uCalm: { value: number };
}

export const NOISE = /* glsl */ `
  float hash3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float noise3(vec3 p){
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise3(p); p = p * 2.05 + vec3(3.1, 1.7, 9.2); a *= 0.5; } return v; }
`;

/**
 * The void blight's sky: overhead a slowly rotating nebula vortex, at the horizon a ring of glowing purple-red band (which
 * sets off the land's silhouette),
 * the abyss underfoot grows darker the lower it goes, with a patch of light pulsing with the heartbeat at the very bottom;
 * the cracks in space (Voronoi edges) light up on the heartbeat.
 * d is a unit direction vector.
 */
/**
 * The static part of the nebula sky (baked into a cube map): rgb is the color, a is the brightness of the cracks in space
 * (multiplied by the heartbeat at run time).
 * Overhead is a nebula vortex, at the horizon a ring of glowing purple-red band (which sets off the land's silhouette),
 * and the abyss underfoot grows darker the lower it goes, with light showing through at the very bottom.
 */
export const SKY_BAKE = /* glsl */ `
  vec4 riftSkyBake(vec3 d){
    float y = d.y;
    float ang = y * 2.2;
    vec3 s = vec3(cos(ang) * d.x - sin(ang) * d.z, y, sin(ang) * d.x + cos(ang) * d.z);
    vec3 w = s * 2.1 + 0.55 * vec3(fbm3(s * 3.4 + 1.3), fbm3(s * 3.4 + 7.1), fbm3(s * 3.4 + 4.2));
    float n = fbm3(w);
    float n2 = fbm3(s * 6.0);
    vec3 zen = vec3(0.025, 0.012, 0.07);
    vec3 nad = vec3(0.018, 0.004, 0.035);
    vec3 hor = vec3(0.30, 0.085, 0.30);
    float band = exp(-y * y * 30.0);
    float band2 = exp(-y * y * 4.0);
    vec3 col = mix(y > 0.0 ? zen : nad, hor * 0.45, band2 * 0.6);
    col = mix(col, hor, band * 0.8);
    float dens = smoothstep(0.36, 0.78, n);
    vec3 neb = mix(vec3(0.16, 0.035, 0.30), vec3(0.72, 0.16, 0.45), smoothstep(0.58, 0.88, n));
    col = mix(col, neb, dens * (0.5 + 0.35 * n2) * (y > 0.0 ? 1.0 : 0.75));
    col += vec3(1.0, 0.42, 0.78) * pow(smoothstep(0.55, 0.95, n * n2 * 1.7), 2.0) * 0.55;
    float core = pow(max(-y, 0.0), 5.0);
    col += vec3(0.55, 0.12, 0.62) * core * 0.5 * (0.6 + 0.6 * n);
    // Spatial cracks: Voronoi edges, picking only some of the "pairs of adjacent cells". What is stored is a "signed distance" (which of the two cells has the larger index decides the sign),
    // After interpolation the zero crossing stays on the edge, so lines do not turn jagged at low texture resolution; where there is no crack, 1 is stored
    vec3 p = s * 3.2;
    vec3 pi = floor(p); vec3 pf = fract(p);
    float f1 = 8.0; float f2 = 8.0; float i1 = 0.0; float i2 = 0.0;
    for (int z = -1; z <= 1; z++) for (int yy = -1; yy <= 1; yy++) for (int x = -1; x <= 1; x++) {
      vec3 g = vec3(float(x), float(yy), float(z));
      vec3 o = vec3(hash3(pi + g), hash3(pi + g + 7.3), hash3(pi + g + 2.9));
      vec3 dd3 = g + o - pf; float dd = dot(dd3, dd3);
      float id = hash3(pi + g + 3.1);
      if (dd < f1) { f2 = f1; i2 = i1; f1 = dd; i1 = id; } else if (dd < f2) { f2 = dd; i2 = id; }
    }
    float e = sqrt(f2) - sqrt(f1);
    float pair = hash3(vec3(i1 + i2, i1 * i2 * 13.0, 2.0));
    float sd = pair > 0.7 ? e * (i1 < i2 ? 1.0 : -1.0) : 1.0;
    return vec4(col, sd);
  }
`;

/**
 * The sky at run time: sample the baked cube map (slowly rotating), plus the cracks pulsing with the heartbeat, the stars and the heart of the abyss
 */
export const SKY = /* glsl */ `
  uniform samplerCube uSkyCube;
  vec3 riftSky(vec3 d, float t, float beat){
    float a = t * 0.004;
    vec3 s = vec3(cos(a) * d.x - sin(a) * d.z, d.y, sin(a) * d.x + cos(a) * d.z);
    vec4 c = textureCube(uSkyCube, s);
    float e = abs(c.a);
    // The glow must be narrow: too far from this edge the "second-nearest cell" changes, so the stored distance jumps and a wide glow would cut a hard edge
    float crack = smoothstep(0.022, 0.004, e) * 1.3 + exp(-e * e * 1500.0) * 0.35;
    vec3 col = c.rgb + vec3(1.0, 0.36, 0.72) * crack * (0.3 + 0.9 * beat);
    vec3 q = floor(s * 190.0);
    float st = hash3(q);
    float band = exp(-d.y * d.y * 30.0);
    col += vec3(0.9, 0.85, 1.0) * step(0.9965, st) * (0.55 + 0.45 * sin(t * 1.7 + st * 60.0)) * (1.0 - band) * (0.5 + 0.5 * smoothstep(-0.2, 0.3, d.y));
    col += vec3(0.55, 0.12, 0.62) * pow(max(-d.y, 0.0), 5.0) * 0.35 * beat;
    return col;
  }
`;

/** The ordinary fog fragment does not suit additive blending: make the brightness fade with distance instead (no fade when there is no fog) */
export const ADD_FOG_PARS = /* glsl */ `
  #ifdef USE_FOG
    uniform float fogNear; uniform float fogFar; varying float vFogDepth;
  #endif
`;
export const ADD_FOG_VERT_PARS = /* glsl */ `
  #ifdef USE_FOG
    varying float vFogDepth;
  #endif
`;
export const ADD_FOG_VERT = /* glsl */ `
  #ifdef USE_FOG
    vFogDepth = -mvPosition.z;
  #endif
`;
export const ADD_FOG_FRAG = /* glsl */ `
  #ifdef USE_FOG
    gl_FragColor.rgb *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
  #endif
`;

/** Common settings for materials that use additive blending and fade out with their own fog */
export function additive(o: THREE.ShaderMaterialParameters): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, ...o });
}

// ───────────────────────── Baked textures ─────────────────────────

function hashI(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Seamlessly tiling fbm value noise (R and G with two different seeds), for the mist and the light curtains */
export function noiseTexture(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const vn = (x: number, y: number, per: number, seed: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const h = (a: number, b: number) => hashI(((a % per) + per) % per, ((b % per) + per) % per, seed);
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
  };
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      for (let c = 0; c < 2; c++) {
        let s = 0;
        let amp = 0.5;
        let per = 8;
        for (let o = 0; o < 4; o++) {
          s += vn((i / size) * per, (j / size) * per, per, c * 17 + o) * amp;
          amp *= 0.5;
          per *= 2;
        }
        data[(j * size + i) * 4 + c] = Math.round(Math.min(1, s / 0.9375) * 255);
      }
      data[(j * size + i) * 4 + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * A seamlessly tiling fissure texture: R is the lines of the big cracks, G is the glow of the big cracks,
 * B is the cell id (random), A is the fine cracks; one tile is `tile` meters
 */
/** The fissure texture's pixels depend only on its parameters: computed once and kept, used directly when entering the rift again */
const crackCache = new Map<string, Uint8Array>();

export function crackTexture(size = 512, big = 14, fine = 36): THREE.DataTexture {
  const key = `${size},${big},${fine}`;
  let data = crackCache.get(key);
  if (!data) {
    data = crackData(size, big, fine);
    crackCache.set(key, data);
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function crackData(size: number, big: number, fine: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const pts = (n: number, seed: number) => {
    const p = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      p[(j * n + i) * 2] = i + 0.1 + hashI(i, j, seed) * 0.8;
      p[(j * n + i) * 2 + 1] = j + 0.1 + hashI(i, j, seed + 5) * 0.8;
    }
    return p;
  };
  const P1 = pts(big, 3);
  const P2 = pts(fine, 9);
  const voro = (x: number, y: number, n: number, P: Float32Array): [number, number, number] => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let f1 = 9;
    let f2 = 9;
    let id = 0;
    for (let b = -1; b <= 1; b++) {
      for (let a = -1; a <= 1; a++) {
        const cx = xi + a;
        const cy = yi + b;
        const wx = ((cx % n) + n) % n;
        const wy = ((cy % n) + n) % n;
        const px = P[(wy * n + wx) * 2] + (cx - wx);
        const py = P[(wy * n + wx) * 2 + 1] + (cy - wy);
        const d = (px - x) * (px - x) + (py - y) * (py - y);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = hashI(wx, wy, 77);
        } else if (d < f2) f2 = d;
      }
    }
    return [Math.sqrt(f1), Math.sqrt(f2), id];
  };
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = (i + 0.5) / size;
      const v = (j + 0.5) / size;
      const [a1, b1, id] = voro(u * big, v * big, big, P1);
      const e1 = b1 - a1;
      const [a2, b2] = voro(u * fine, v * fine, fine, P2);
      const e2 = b2 - a2;
      const k = (j * size + i) * 4;
      const line = Math.max(0, 1 - e1 / 0.06);
      data[k] = Math.round(line * line * 255);
      data[k + 1] = Math.round(Math.exp(-e1 * e1 * 40) * 255);
      data[k + 2] = Math.round(id * 255);
      const l2 = Math.max(0, 1 - e2 / 0.07);
      data[k + 3] = Math.round(l2 * l2 * (hashI(Math.floor(u * fine), Math.floor(v * fine), 31) > 0.45 ? 255 : 0));
    }
  }
  return data;
}
