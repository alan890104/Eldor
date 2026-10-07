// Azurehowl Highlands' custom materials and moving meshes: the cloud sea, high clouds in the sky, cliff walls (vertex-color strata),
// grass / flags / paper cranes that sway in the wind (same wind direction), waterfalls, and wind trail lines.

import * as THREE from 'three';
import { LIGHT } from '../../../toon.ts';
import { WX, WZ } from './shape.ts';

type V3 = [number, number, number];

export const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.3; a *= 0.5; } return v; }`;

// ───────────────────────── Cloud sea ─────────────────────────

/**
 * Cloud sea: flowing cloud tops in three color steps (drifting with the wind), occasionally parting to show the deep blue sky below;
 * distant parts fade into the sky color on their own
 */
export function cloudSeaMaterial(haze: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uA: { value: new THREE.Color(0x93a9d2) },
      uB: { value: new THREE.Color(0xcfdcef) },
      uC: { value: new THREE.Color(0xf7faff) },
      uDeep: { value: new THREE.Color(0x5d80bd) },
      uHaze: { value: new THREE.Color(haze) },
      uWind: { value: new THREE.Vector2(WX, WZ) },
      uSun: { value: LIGHT.dir.value },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uDeep; uniform vec3 uHaze;
      uniform vec2 uWind; uniform vec3 uSun;
      varying vec3 vW;
      ${NOISE_GLSL}
      float cloud(vec2 p) { return fbm(p) * 0.7 + fbm(p * 2.3 + vec2(5.2, 1.3) - uWind * uTime * 0.02) * 0.3; }
      void main() {
        vec2 p = vW.xz * 0.018 - uWind * uTime * 0.03;
        float big = noise(vW.xz * 0.0035 - uWind * uTime * 0.004);
        float n = cloud(p) + (big - 0.5) * 0.22;
        // Take a difference toward the sun: lit faces are bright, faces turned from the light are dark
        vec2 sd = normalize(uSun.xz + vec2(1e-4));
        float lit = clamp(0.5 - (cloud(p + sd * 0.05) + (big - 0.5) * 0.22 - n) * 9.0, 0.0, 1.0);
        float h = n + (lit - 0.5) * 0.08;
        vec3 c = mix(uA, uB, smoothstep(0.4, 0.43, h));
        c = mix(c, uC, smoothstep(0.52, 0.55, h));
        // Gaps in the clouds: the deep blue sky shows through below
        float hole = smoothstep(0.3, 0.27, n);
        c = mix(c, uDeep, hole);
        float dist = length(vW.xz - cameraPosition.xz);
        c = mix(c, uHaze, smoothstep(120.0, 820.0, dist) * 0.92);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
}

/** High clouds: a translucent shell inside the sky that follows the camera, with wisps stretched and flowing downwind */
export function cloudShellMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    fog: false,
    uniforms: { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(WX, WZ) } },
    vertexShader: /* glsl */ `varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec2 uWind; varying vec3 vP;
      ${NOISE_GLSL}
      void main() {
        float h = vP.y;
        if (h < 0.03) discard;
        vec2 q = vP.xz / (h + 0.22);
        // Cloud wisps stretched along the wind direction
        vec2 w = uWind; vec2 pw = vec2(w.y, -w.x);
        vec2 p = vec2(dot(q, w) * 0.9, dot(q, pw) * 2.6) * 1.6 - vec2(uTime * 0.018, 0.0);
        float n = fbm(p) * 0.68 + fbm(p * 2.6 + 3.1) * 0.32;
        float fade = smoothstep(0.03, 0.2, h) * (1.0 - smoothstep(0.55, 0.9, h));
        float a = smoothstep(0.52, 0.6, n) * fade * 0.85;
        vec3 c = mix(vec3(0.82, 0.88, 0.97), vec3(1.0), smoothstep(0.6, 0.7, n));
        gl_FragColor = vec4(c, a);
      }`,
  });
}

// ───────────────────────── Cliff walls ─────────────────────────

/** Vertex-color rock wall material: lighting and detail noise match the terrain shader so the cliff-top grass lip joins up */
export function rockMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    vertexColors: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uLightDir: LIGHT.dir,
      uAmbient: LIGHT.ambient,
      uShadowTint: LIGHT.shadowTint,
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vColor; varying vec3 vNormal; varying vec3 vWorld;
      void main() {
        vColor = color;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uLightDir; uniform vec3 uAmbient; uniform vec3 uShadowTint;
      varying vec3 vColor; varying vec3 vNormal; varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        float l = length(vNormal);
        vec3 n = l > 1e-5 ? vNormal / l : vec3(0.0, 1.0, 0.0);
        float ndl = dot(n, normalize(uLightDir));
        float lit = smoothstep(-0.08, 0.1, ndl) * 0.62 + smoothstep(0.52, 0.6, ndl) * 0.38;
        vec2 uvw = vWorld.xz + vec2(vWorld.y * 0.7, -vWorld.y * 0.4);
        float big = vnoise(uvw * 0.045);
        float mid = vnoise(uvw * 0.23);
        float fine = vnoise(uvw * 1.7);
        vec3 base = vColor * (0.9 + big * 0.16 + (mid - 0.5) * 0.1 + (fine - 0.5) * 0.07);
        vec3 shade = base * mix(uShadowTint * 0.7, vec3(1.0), 0.42);
        vec3 col = mix(shade, base, lit);
        col *= mix(uAmbient * 1.3, vec3(1.08), 0.6);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}

// ───────────────────────── Meshes swayed by the wind ─────────────────────────

/** Triangle accumulator with vertex colors and sway weights: grass, flags, paper cranes and birds merge into a single mesh */
export class SoftGeo {
  private p: number[] = [];
  private n: number[] = [];
  private c: number[] = [];
  private s: number[] = [];
  private ph: number[] = [];

  get count(): number {
    return this.p.length / 3;
  }

  tri(a: V3, b: V3, c: V3, col: THREE.Color, sw: V3, phase: number): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    const vs: [V3, number][] = [[a, sw[0]], [b, sw[1]], [c, sw[2]]];
    for (const [v, w] of vs) {
      this.p.push(v[0], v[1], v[2]);
      this.n.push(nx, ny, nz);
      this.c.push(col.r, col.g, col.b);
      this.s.push(w);
      this.ph.push(phase);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, col: THREE.Color, sw: [number, number, number, number], phase: number): void {
    this.tri(a, b, c, col, [sw[0], sw[1], sw[2]], phase);
    this.tri(a, c, d, col, [sw[0], sw[2], sw[3]], phase);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.s, 1));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(this.ph, 1));
    return g;
  }
}

/**
 * Vertex-color material with two color steps + fog; displace is the vertex-displacement GLSL
 * (may use p, aSway, aPhase, uTime, uWind, uSide)
 */
export function softMaterial(displace: string, shade = 0.6): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    side: THREE.DoubleSide,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uLightDir: LIGHT.dir,
      uShade: { value: shade },
      uWind: { value: new THREE.Vector3(WX, 0, WZ) },
      uSide: { value: new THREE.Vector3(-WZ, 0, WX) },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute vec3 aColor; attribute float aSway; attribute float aPhase;
      uniform float uTime; uniform vec3 uWind; uniform vec3 uSide;
      varying vec3 vColor; varying vec3 vN;
      void main() {
        vec3 p = position;
        ${displace}
        vColor = aColor;
        vN = normal;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uLightDir; uniform float uShade;
      varying vec3 vColor; varying vec3 vN;
      void main() {
        float l = length(vN);
        vec3 n = l > 1e-6 ? vN / l : vec3(0.0, 1.0, 0.0);
        if (!gl_FrontFacing) n = -n;
        float lit = smoothstep(-0.05, 0.1, dot(n, normalize(uLightDir)));
        vec3 col = vColor * mix(uShade, 1.0, lit);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}

/** Tall grass: leans with the wind, gusts sweeping through in waves (same direction as the grass sea) */
export const GRASS_SWAY = /* glsl */ `
  float g = 0.55 + 0.45 * sin(uTime * 1.3 - dot(p.xz, vec2(0.08, 0.05)));
  float w = sin(uTime * 2.6 + aPhase + p.x * 0.4);
  p += uWind * aSway * (0.25 + 0.28 * w) * g;
  p += uSide * aSway * 0.07 * sin(uTime * 3.3 + aPhase);
  p.y -= aSway * aSway * 0.1 * g;`;

/** Flag: the cloth flattens out downwind and ripples along the cloth's normal (uSide) */
export const FLAG_SWAY = /* glsl */ `
  p += uSide * aSway * 0.28 * sin(uTime * 7.0 - aSway * 5.5 + aPhase);
  p.y += aSway * 0.08 * sin(uTime * 4.0 - aSway * 3.0 + aPhase) - aSway * aSway * 0.05;`;

/** Birds and paper cranes: wing tips flap up and down */
export const FLAP = /* glsl */ `
  p.y += aSway * sin(uTime * 8.0 + aPhase) * 0.32;`;

/**
 * A long flag flying downwind from the pole top (x, y, z): len is the length, h the width (at the flag root),
 * cols the color bands from flag root to tail
 */
export function banner(g: SoftGeo, x: number, y: number, z: number, len: number, h: number, cols: THREE.Color[], phase: number, taper = 0.85, fork = false): void {
  const segs = Math.max(4, Math.round(len * 2));
  for (let k = 0; k < segs; k++) {
    const u0 = k / segs;
    const u1 = (k + 1) / segs;
    const h0 = h * (1 - u0 * taper);
    const h1 = h * (1 - u1 * taper);
    const col = cols[Math.min(cols.length - 1, Math.floor(u0 * cols.length))];
    const a: V3 = [x + WX * u0 * len, y - h0, z + WZ * u0 * len];
    const b: V3 = [x + WX * u1 * len, y - h1, z + WZ * u1 * len];
    const c: V3 = [x + WX * u1 * len, y, z + WZ * u1 * len];
    const d: V3 = [x + WX * u0 * len, y, z + WZ * u0 * len];
    if (fork && k === segs - 1) {
      // Swallowtail
      const m: V3 = [x + WX * (u0 + 0.6 / segs) * len, y - h1 * 0.5, z + WZ * (u0 + 0.6 / segs) * len];
      g.tri(a, b, m, col, [u0, u1, u1], phase);
      g.tri(m, c, d, col, [u1, u1, u0], phase);
      g.tri(a, m, d, col, [u0, u1, u0], phase);
      continue;
    }
    g.quad(a, b, c, d, col, [u0, u1, u1, u0], phase);
  }
}

/** A tuft of swaying tall grass (five blades, two segments each); y is the ground height */
export function grassTuft(g: SoftGeo, x: number, y: number, z: number, s: number, cols: THREE.Color[], r: () => number): void {
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    const bx = x + Math.cos(a) * 0.14 * s;
    const bz = z + Math.sin(a) * 0.14 * s;
    const h = (0.6 + r() * 0.55) * s;
    const w = 0.07 * s;
    const lean = 0.18 * s;
    const col = cols[Math.floor(r() * cols.length)];
    const ph = r() * 6.3;
    const ca = Math.cos(a + 1.57) * w;
    const sa = Math.sin(a + 1.57) * w;
    const lx = WX * lean;
    const lz = WZ * lean;
    g.quad([bx - ca, y, bz - sa], [bx + ca, y, bz + sa], [bx + ca * 0.7 + lx * 0.4, y + h * 0.55, bz + sa * 0.7 + lz * 0.4], [bx - ca * 0.7 + lx * 0.4, y + h * 0.55, bz - sa * 0.7 + lz * 0.4], col, [0, 0, 0.4, 0.4], ph);
    g.tri([bx - ca * 0.7 + lx * 0.4, y + h * 0.55, bz - sa * 0.7 + lz * 0.4], [bx + ca * 0.7 + lx * 0.4, y + h * 0.55, bz + sa * 0.7 + lz * 0.4], [bx + lx, y + h, bz + lz], col, [0.4, 0.4, 1], ph);
  }
}

/** One bird or paper crane (two wings); heading is the flight direction (radians, 0 faces +z) */
export function bird(g: SoftGeo, x: number, y: number, z: number, heading: number, s: number, col: THREE.Color, phase: number, crane = false): void {
  const hx = Math.sin(heading);
  const hz = Math.cos(heading);
  const rx = hz;
  const rz = -hx;
  const nose: V3 = [x + hx * 0.45 * s, y, z + hz * 0.45 * s];
  const tail: V3 = [x - hx * 0.4 * s, y + (crane ? 0.12 * s : 0), z - hz * 0.4 * s];
  const l: V3 = [x + rx * 0.75 * s - hx * 0.1 * s, y + 0.1 * s, z + rz * 0.75 * s - hz * 0.1 * s];
  const rr: V3 = [x - rx * 0.75 * s - hx * 0.1 * s, y + 0.1 * s, z - rz * 0.75 * s - hz * 0.1 * s];
  g.tri(nose, l, tail, col, [0, 1, 0], phase);
  g.tri(nose, tail, rr, col, [0, 0, 1], phase);
  if (crane) {
    // The paper crane's neck and tail curl up
    const neck: V3 = [x + hx * 0.75 * s, y + 0.35 * s, z + hz * 0.75 * s];
    g.tri(nose, neck, [x + hx * 0.3 * s, y + 0.05 * s, z + hz * 0.3 * s], col, [0, 0, 0], phase);
    const tip: V3 = [x - hx * 0.75 * s, y + 0.4 * s, z - hz * 0.75 * s];
    g.tri(tail, tip, [x - hx * 0.25 * s, y + 0.05 * s, z - hz * 0.25 * s], col, [0, 0, 0], phase);
  }
}

// ───────────────────────── Waterfalls ─────────────────────────

/**
 * Waterfall: water streaks scrolling along the fall direction, getting more scattered and fainter lower down,
 * finally dissolving into the cloud sea
 */
export function waterfallMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aLen;
      varying vec2 vUv; varying float vLen;
      void main() {
        vUv = uv; vLen = aLen;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; varying vec2 vUv; varying float vLen;
      void main() {
        float y = vUv.y * vLen;
        float s = fract(y * 0.22 - uTime * 1.5 + sin(vUv.x * 11.0) * 0.18);
        float stripe = smoothstep(0.3, 0.36, s) * (1.0 - smoothstep(0.62, 0.7, s));
        float s2 = fract(y * 0.5 - uTime * 2.3 + sin(vUv.x * 23.0 + 1.0) * 0.3);
        stripe = max(stripe, smoothstep(0.45, 0.5, s2) * (1.0 - smoothstep(0.55, 0.6, s2)) * 0.7);
        vec3 c = mix(vec3(0.66, 0.84, 0.98), vec3(1.0), stripe);
        float edge = smoothstep(0.0, 0.2, vUv.x) * smoothstep(0.0, 0.2, 1.0 - vUv.x);
        float a = (0.6 + 0.38 * stripe) * (1.0 - smoothstep(0.55, 1.0, vUv.y)) * edge;
        gl_FragColor = vec4(c, a);
        #include <fog_fragment>
      }`,
  });
}

/**
 * Geometry of one waterfall: water leaves from top, is first thrown out horizontally in the out direction and then falls,
 * and is blown slightly off course downwind; it spreads sideways along the side direction, widening toward the bottom.
 */
export function waterfallGeo(top: THREE.Vector3, out: THREE.Vector2, len: number, w0: number, drift = 3, hug?: (y: number) => number): THREE.BufferGeometry {
  const segs = Math.max(8, Math.round(len / 3));
  const sx = -out.y;
  const sz = out.x;
  const pos: number[] = [];
  const uv: number[] = [];
  const la: number[] = [];
  const idx: number[] = [];
  for (let k = 0; k <= segs; k++) {
    const v = k / segs;
    const w = w0 * (1 + v * 1.1);
    let throwOut = Math.min(1, v * 6) * 1.2 + v * 1.5;
    // A waterfall falling against the cliff face: it must at least be in front of the rock wall
    if (hug) throwOut = Math.max(throwOut, hug(top.y - v * len));
    const cx = top.x + out.x * throwOut + WX * v * v * drift;
    const cz = top.z + out.y * throwOut + WZ * v * v * drift;
    const cy = top.y - v * len;
    pos.push(cx - sx * w * 0.5, cy, cz - sz * w * 0.5, cx + sx * w * 0.5, cy, cz + sz * w * 0.5);
    uv.push(0, v, 1, v);
    la.push(len, len);
    if (k < segs) {
      const a = k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aLen', new THREE.Float32BufferAttribute(la, 1));
  g.setIndex(idx);
  return g.toNonIndexed();
}

// ───────────────────────── Wind trails ─────────────────────────

/**
 * Wind trail lines: a few dozen thin white ribbons sweep downwind near the character (occasionally looping);
 * each one's anchor is computed on the CPU every frame (cycling around the camera, hugging the ground height),
 * and the shader only handles shape and fade in/out.
 */
export function windRibbons(count: number): { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; anchors: THREE.Vector4[] } {
  const pos: number[] = [];
  const aU: number[] = [];
  const aSide: number[] = [];
  const aId: number[] = [];
  const segs = 48;
  for (let r = 0; r < count; r++) {
    for (let k = 0; k <= segs; k++) {
      const u = k / segs;
      for (const s of [-1, 1]) {
        pos.push(0, 0, 0);
        aU.push(u);
        aSide.push(s);
        aId.push(r);
      }
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < count; r++) {
    const base = r * (segs + 1) * 2;
    for (let k = 0; k < segs; k++) {
      const a = base + k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(aSide, 1));
  g.setAttribute('aId', new THREE.Float32BufferAttribute(aId, 1));
  g.setIndex(idx);
  const anchors = Array.from({ length: count }, () => new THREE.Vector4());
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uAnchor: { value: anchors },
      uWind: { value: new THREE.Vector3(WX, 0, WZ) },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aU; attribute float aSide; attribute float aId;
      uniform float uTime; uniform vec4 uAnchor[${count}]; uniform vec3 uWind;
      varying float vU; varying float vA; varying float vSeed;
      void main() {
        vec4 an = uAnchor[int(aId + 0.5)];
        float seed = fract(aId * 0.6180339 + 0.13);
        vSeed = seed;
        vU = aU;
        vA = an.w;
        float L = 16.0 + seed * 14.0;
        vec3 side = vec3(-uWind.z, 0.0, uWind.x);
        float x = aU * L;
        // Meandering, with an occasional loop
        float wav = sin(aU * 6.2831 * (1.0 + seed) + uTime * 1.3 + seed * 20.0);
        vec3 p = an.xyz + uWind * x + side * wav * (0.8 + seed * 1.2) + vec3(0.0, sin(aU * 9.0 + seed * 7.0 + uTime) * 0.5, 0.0);
        if (seed > 0.55) {
          float loopT = smoothstep(0.35, 0.65, aU);
          float ang = loopT * 6.2831;
          float R = 1.1 + seed;
          p += uWind * (sin(ang) * R - loopT * 0.0) + vec3(0.0, (1.0 - cos(ang)) * R, 0.0);
        }
        // The thin ribbon unfolds toward the camera
        vec3 tang = uWind;
        vec3 toCam = normalize(cameraPosition - p);
        vec3 w = normalize(cross(tang, toCam) + vec3(0.0, 1e-4, 0.0));
        p += w * aSide * 0.055;
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; varying float vU; varying float vA; varying float vSeed;
      void main() {
        // A bright stretch runs along the ribbon toward downwind
        float head = fract(uTime * (0.16 + vSeed * 0.1) + vSeed * 3.7) * 1.6 - 0.2;
        float d = head - vU;
        float a = smoothstep(0.0, 0.05, d) * (1.0 - smoothstep(0.08, 0.42, d));
        a *= smoothstep(0.0, 0.08, vU) * smoothstep(1.0, 0.9, vU);
        gl_FragColor = vec4(vec3(1.0), a * vA * 0.55);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return { mesh, mat, anchors };
}

/** Small pool: a light blue water surface with concentric ripples (the floating rock's waterfall lands here) */
export function pondMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uC: { value: new THREE.Vector2() } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec2 uC; varying vec3 vW;
      ${NOISE_GLSL}
      void main() {
        float d = length(vW.xz - uC);
        float ring = smoothstep(0.75, 0.95, sin(d * 3.0 - uTime * 3.0) * 0.5 + 0.5) * smoothstep(5.0, 1.0, d);
        float n = noise(vW.xz * 1.3 + uTime * 0.4);
        vec3 c = mix(vec3(0.36, 0.66, 0.86), vec3(0.62, 0.88, 0.96), n * 0.5 + ring * 0.6);
        float edge = smoothstep(0.0, 0.8, 5.2 - d);
        gl_FragColor = vec4(c + ring * 0.25, 0.82 * edge);
        #include <fog_fragment>
      }`,
  });
}
