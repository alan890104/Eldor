// Thunderpeal Plains sky: the low, tumbling thunderhead ceiling (swirling above the Seal Tower),
// the storm cluster that hangs motionless over the tower top, the cumulonimbus wall on the horizon,
// and all kinds of lightning strikes (distant cloud-to-ground lightning, bolts hitting the tower spire and the pillars,
// muffled flashes inside the clouds).
// Lightning lights up the whole scene: ambient light, rim light, fog, sky, grass tips and clouds all flash along with it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MS, rng } from '../../../arenaKit.ts';
import { LIGHT } from '../../../toon.ts';
import type { Vfx } from '../../../vfx.ts';
import type { FieldCtx } from '../../kit.ts';

export const NOISE = /* glsl */ `
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.07 + 3.7) * 0.28 + vnoise(p * 4.3 + 9.1) * 0.15 + vnoise(p * 8.7 + 1.3) * 0.07; }
`;

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ───────────────────────── Cloud ceiling ─────────────────────────

function ceilingMat(y: number, eye: THREE.Vector2): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uY: { value: y },
      uEye: { value: eye },
      uDark: { value: new THREE.Color(0x191e34) },
      uLight: { value: new THREE.Color(0x5e6a90) },
      uEyeCol: { value: new THREE.Color(0x2a1a46) },
      uHorizon: { value: new THREE.Color(0xa4948a) },
      uFlashPos: { value: V(0, y, 0) },
      uFlash: { value: 0 },
      uSky: { value: 0 },
      uClear: { value: 0 },
      uHoleR: { value: 120 },
      uSun: { value: new THREE.Color(0xffd79a) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uY; uniform vec2 uEye;
      uniform vec3 uDark; uniform vec3 uLight; uniform vec3 uEyeCol; uniform vec3 uHorizon;
      uniform vec3 uFlashPos; uniform float uFlash; uniform float uSky;
      uniform float uClear; uniform float uHoleR; uniform vec3 uSun;
      varying vec3 vW;
      ${NOISE}
      void main() {
        // Above the tower: clouds circle the tower, spinning tighter nearer the center; distant clouds drift east as usual
        vec2 q = vW.xz - uEye;
        float r = length(q);
        // After purification the vortex stops, leaving only a little residual twist, and the clouds drift away with the wind as usual
        float sw = mix(uTime * 0.05 * exp(-r / 140.0) + 2.6 * exp(-r / 75.0), 1.3 * exp(-r / 110.0), uClear);
        float cs = cos(sw); float sn = sin(sw);
        q = mat2(cs, -sn, sn, cs) * q;
        float far = mix(smoothstep(50.0, 260.0, r), 1.0, uClear);
        vec2 uv = (q - vec2(uTime * 2.6, uTime * 1.2) * far) * 0.011;
        vec2 w = vec2(fbm(uv * 1.3 + uTime * 0.012), fbm(uv * 1.3 + 5.2 - uTime * 0.01));
        float n = fbm(uv + w * 1.7);
        float n2 = fbm(uv * 3.3 + w * 0.9 + 11.0);
        float dens = smoothstep(0.28 + uClear * 0.1, 0.78, n * 0.8 + n2 * 0.3);
        // Thick parts are the dark underside of the cloud; thin parts let the light from above through
        vec3 col = mix(uLight, uDark, dens) * (0.88 + n2 * 0.3);
        col = mix(col, uEyeCol, exp(-r / 55.0) * 0.6 * (1.0 - uClear));
        // After purification: the clouds above the tower part into a ring, and the cloud edges at the opening are rimmed with gold by the sunlight
        float edgeN = (n - 0.5) * 110.0 + (n2 - 0.5) * 50.0;
        float hole = smoothstep(uHoleR - 40.0, uHoleR + 30.0, r + edgeN);
        float rim = (1.0 - smoothstep(uHoleR - 20.0, uHoleR + 130.0, r + edgeN)) * uClear;
        col = mix(col, uSun, rim * (0.3 + (1.0 - dens) * 0.45));
        col *= 1.0 + uClear * 0.25;
        float fl = uFlash * exp(-distance(vW, uFlashPos) / 85.0) * (0.35 + dens * 0.9);
        col += vec3(0.78, 0.74, 1.0) * fl * 2.2;
        col += vec3(0.55, 0.52, 0.85) * uSky * 0.45;
        float d = length(vW.xz - cameraPosition.xz);
        col = mix(col, uHorizon, smoothstep(160.0, 760.0, d) * 0.7);
        float a = mix(0.8, 1.0, dens) * (1.0 - smoothstep(480.0, 1000.0, d));
        float wisp = smoothstep(0.6, 0.82, n) * 0.5;
        a *= mix(1.0, max(hole, wisp), uClear);
        // Does not block the view when the camera is above the clouds (looking down)
        a *= smoothstep(uY - 6.0, uY - 30.0, cameraPosition.y);
        gl_FragColor = vec4(col, a);
      }`,
  });
}

// ───────────────────────── Volumetric clouds (tower-top storm cluster, horizon cumulonimbus wall) ─────────────────────────

function cloudMat(haze: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexColors: true,
    uniforms: {
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uFlashPos: { value: V(0, 0, 0) },
      uFlashR: { value: 30 },
      uSky: { value: 0 },
      uLightDir: LIGHT.dir,
      uCol: { value: new THREE.Color(0x5c6690) },
      uShade: { value: new THREE.Color(0x1a1e38) },
      uTint: { value: new THREE.Color(0x6a3aa0) },
      uHaze: { value: new THREE.Color(0xa4948a) },
      uHazeAmt: { value: haze },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vN; varying vec3 vW; varying vec3 vC; varying vec3 vV;
      void main() {
        vec3 p = position + normal * (sin(uTime * 0.4 + position.x * 0.09 + position.z * 0.07 + position.y * 0.05) * 0.9);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = cameraPosition - wp.xyz;
        vC = color;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFlash; uniform vec3 uFlashPos; uniform float uFlashR; uniform float uSky;
      uniform vec3 uLightDir; uniform vec3 uCol; uniform vec3 uShade; uniform vec3 uTint; uniform vec3 uHaze; uniform float uHazeAmt;
      varying vec3 vN; varying vec3 vW; varying vec3 vC; varying vec3 vV;
      void main() {
        vec3 n = normalize(vN);
        // Cloud tops lit, cloud undersides dark: two color steps
        float up = n.y * 0.6 + dot(n, normalize(uLightDir)) * 0.4;
        float lit = smoothstep(-0.2, 0.05, up) * 0.55 + smoothstep(0.35, 0.55, up) * 0.35;
        vec3 c = mix(uShade, uCol, lit) * vC.r;
        // Corrupted purple: stored in the g channel of the vertex color (0-1)
        c = mix(c, uTint * (0.5 + lit * 0.5), vC.g * 0.55);
        float fres = pow(clamp(1.0 - abs(dot(n, normalize(vV))), 0.0, 1.0), 2.0);
        c *= 1.0 - 0.35 * smoothstep(0.55, 0.95, fres);
        float fl = uFlash * exp(-distance(vW, uFlashPos) / uFlashR);
        c += vec3(0.8, 0.76, 1.0) * fl * 1.7;
        c += vec3(0.5, 0.48, 0.8) * uSky * 0.4;
        c = mix(c, uHaze, uHazeAmt);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

class Blobs {
  geos: THREE.BufferGeometry[] = [];
  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, bright: number, tint: number, detail = 1, ry = 0): void {
    const g = new THREE.IcosahedronGeometry(1, detail);
    g.applyMatrix4(MS(x, y, z, sx, sy, sz, ry));
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([bright, tint, 0], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    this.geos.push(g);
  }
  mesh(mat: THREE.Material): THREE.Mesh | null {
    const m = mergeGeometries(this.geos);
    for (const g of this.geos) g.dispose();
    return m ? new THREE.Mesh(m, mat) : null;
  }
}

// ───────────────────────── Lightning ─────────────────────────

/**
 * Unit-length lightning shape (1 meter from the origin toward -y): the trunk is made jagged by midpoint displacement,
 * with a few branches splitting off along the way
 */
function boltGeometry(r: () => number): THREE.BufferGeometry {
  const pos: number[] = [];
  const dir: number[] = [];
  const side: number[] = [];
  const wid: number[] = [];
  const bri: number[] = [];
  const idx: number[] = [];
  const jag = (a: THREE.Vector3, b: THREE.Vector3, disp: number, depth: number): THREE.Vector3[] => {
    let pts = [a, b];
    for (let d = 0; d < depth; d++) {
      const next: THREE.Vector3[] = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1];
        const q = pts[i];
        const m = p.clone().add(q).multiplyScalar(0.5);
        m.x += (r() - 0.5) * disp;
        m.z += (r() - 0.5) * disp;
        m.y += (r() - 0.5) * disp * 0.3;
        next.push(m, q);
      }
      pts = next;
      disp *= 0.55;
    }
    return pts;
  };
  const strip = (pts: THREE.Vector3[], w0: number, w1: number, b: number) => {
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1];
      const q = pts[i];
      const d = q.clone().sub(p);
      // Extend slightly, so there are no gaps at the bends
      const e = d.clone().multiplyScalar(0.12);
      const pa = p.clone().sub(e);
      const qa = q.clone().add(e);
      const t0 = (i - 1) / (pts.length - 1);
      const t1 = i / (pts.length - 1);
      const base = pos.length / 3;
      for (const [pp, t] of [
        [pa, t0],
        [qa, t1],
      ] as const) {
        for (const s of [-1, 1]) {
          pos.push(pp.x, pp.y, pp.z);
          dir.push(d.x, d.y, d.z);
          side.push(s);
          wid.push(w0 + (w1 - w0) * t);
          bri.push(b);
        }
      }
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  };
  const main = jag(V(0, 0, 0), V((r() - 0.5) * 0.12, -1, (r() - 0.5) * 0.12), 0.2, 5);
  strip(main, 1, 0.7, 1);
  const nb = 2 + Math.floor(r() * 4);
  for (let k = 0; k < nb; k++) {
    const i = 3 + Math.floor(r() * (main.length * 0.6));
    const p = main[i];
    const a = r() * Math.PI * 2;
    const len = (0.18 + r() * 0.3) * (1 - i / main.length);
    const end = p.clone().add(V(Math.cos(a) * len * 0.8, -len * (0.6 + r() * 0.5), Math.sin(a) * len * 0.8));
    const br = jag(p, end, len * 0.35, 4);
    strip(br, 0.55, 0.25, 0.7);
    if (r() < 0.6) {
      const j = Math.floor(br.length * (0.3 + r() * 0.4));
      const q = br[j];
      const a2 = a + (r() - 0.5) * 1.6;
      const l2 = len * 0.45;
      const e2 = q.clone().add(V(Math.cos(a2) * l2 * 0.8, -l2 * 0.7, Math.sin(a2) * l2 * 0.8));
      strip(jag(q, e2, l2 * 0.35, 3), 0.32, 0.15, 0.5);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('aW', new THREE.Float32BufferAttribute(wid, 1));
  g.setAttribute('aB', new THREE.Float32BufferAttribute(bri, 1));
  g.setIndex(idx);
  return g;
}

function boltMat(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { uWidth: { value: 1 }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color(0xb8a8ff) } },
    vertexShader: /* glsl */ `
      attribute vec3 aDir; attribute float aSide; attribute float aW; attribute float aB;
      uniform float uWidth;
      varying float vX; varying float vB;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 d = normalize(mat3(modelMatrix) * aDir);
        vec3 toCam = normalize(cameraPosition - wp.xyz);
        vec3 s = cross(d, toCam);
        float l = length(s);
        s = l > 1e-4 ? s / l : vec3(1.0, 0.0, 0.0);
        wp.xyz += s * aSide * aW * uWidth;
        vX = aSide; vB = aB;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAlpha;
      varying float vX; varying float vB;
      void main() {
        float x = abs(vX);
        float core = smoothstep(0.34, 0.0, x);
        float glow = (1.0 - x) * (1.0 - x);
        vec3 c = uColor * glow * 1.3 + vec3(2.4) * core;
        gl_FragColor = vec4(c, uAlpha * vB * (glow * 0.8 + core));
      }`,
  });
}

interface Bolt {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  t: number;
  pulses: [number, number][];
  flash: number;
}

// ───────────────────────── Light shafts after the clouds part ─────────────────────────

function shaftMat(ph: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPh: { value: ph }, uA: { value: 0.16 }, uColor: { value: new THREE.Color(0xffdc9a) } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uPh; uniform float uA; uniform vec3 uColor;
      varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main() {
        // The middle facing the camera is brightest and the edges fade out, like a beam of light with thickness
        float body = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
        float fy = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.62, 1.0, vUv.y));
        float st = 0.55 + 0.45 * sin(vUv.x * 31.4 + uTime * 0.3 + uPh) * sin(vUv.x * 18.8 - uTime * 0.21 + uPh * 2.0);
        float a = uA * body * fy * st * (0.7 + 0.3 * sin(uTime * 0.35 + uPh));
        gl_FragColor = vec4(uColor, a);
      }`,
  });
}

// ───────────────────────── The whole sky ─────────────────────────

export interface StormOpts {
  /** The tower (the center of the storm cluster) and the tower spire (strike point) */
  eye: [number, number];
  groundY: number;
  spire: THREE.Vector3;
  /** Points that can be struck by lightning: pillar tops, the camp's lightning rod, the secret realm's glass tree... */
  targets: { pos: THREE.Vector3[]; every: [number, number]; range: number; power: number; after?: (p: THREE.Vector3, vfx: Vfx) => void }[];
  /** Places to avoid when lightning falls at random on the grassland (the town) */
  avoid: [number, number, number][];
  h: (x: number, z: number) => number;
  size: number;
  /**
   * Seal Tower fully broken through: the stalled storm disperses, the clouds open in a ring, sunlight falls on the tower,
   * and only an occasional distant bolt is left
   */
  calm: boolean;
}

export interface Storm {
  /** Current flash intensity (around 0~1), for other materials that flash along */
  flash(): number;
  /** Makes other materials' uFlash flash along */
  follow(u: { value: number }, k?: number): void;
}

export function buildStorm(ctx: FieldCtx, o: StormOpts): Storm {
  const { group, disposers, extras } = ctx;
  const r = rng(31337);
  const [ex, ez] = o.eye;
  const CEIL = 124;
  const calm = o.calm;
  if (calm) {
    // The clouds have opened: ambient and rim light are both a bit warmer and brighter (the engine resets them the next time it
    // builds a scene)
    LIGHT.ambient.value.lerp(new THREE.Color(0xe0d6c4), 0.35);
    LIGHT.rimColor.value.lerp(new THREE.Color(0xffe2a8), 0.5);
  }

  // ── Cloud ceiling
  const ceil = ceilingMat(CEIL, new THREE.Vector2(ex, ez));
  if (calm) {
    ceil.uniforms.uClear.value = 1;
    ceil.uniforms.uDark.value.set(0x525c80);
    ceil.uniforms.uLight.value.set(0x8e98b8);
  }
  const ceilGeo = new THREE.PlaneGeometry(2600, 2600, 1, 1);
  ceilGeo.rotateX(Math.PI / 2);
  const ceilMesh = new THREE.Mesh(ceilGeo, ceil);
  ceilMesh.position.set(0, CEIL, 0);
  ceilMesh.renderOrder = -5;
  ceilMesh.frustumCulled = false;
  group.add(ceilMesh);

  // ── Storm cluster over the tower top: the main body, low wall clouds, hanging broken clouds
  const cellMat = cloudMat(0.12);
  cellMat.uniforms.uFlashR.value = 26;
  const cell = new THREE.Group();
  const base = o.groundY + 76;
  cell.position.set(ex, base, ez);
  const cb = new Blobs();
  if (calm) {
    // Dispersing storm: a ring of fragmented cumulus lit by sunlight, drifting outward clump by clump (a separate random stream,
    // so the horizon clouds come out the same as during the storm)
    const r = rng(4711);
    cellMat.uniforms.uCol.value.set(0xf2e4c8);
    cellMat.uniforms.uShade.value.set(0x7a7c9e);
    cellMat.uniforms.uHazeAmt.value = 0.16;
    const nC = 10;
    for (let c = 0; c < nC; c++) {
      const ca = (c / nC) * Math.PI * 2 + (r() - 0.5) * 0.4;
      const cd = 62 + r() * 38;
      const cx = Math.cos(ca) * cd;
      const cz = Math.sin(ca) * cd;
      const cy = 12 + r() * 16;
      const m = 4 + Math.floor(r() * 3);
      for (let k = 0; k < m; k++) {
        const s = 6 + r() * 6;
        const a = r() * Math.PI * 2;
        const d = r() * 9;
        cb.add(cx + Math.cos(a) * d, cy + (k === 0 ? 3 : r() * 4), cz + Math.sin(a) * d, s * (1 + r() * 0.4), s * (0.62 + r() * 0.25), s * (0.9 + r() * 0.3), 1.0 + r() * 0.2, 0, 1, r() * 6);
      }
      // Flat layer at the cloud base
      cb.add(cx, cy - 2.5, cz, 13, 2.6, 10, 0.85, 0, 1, ca);
    }
  } else {
    for (let i = 0; i < 54; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 50;
      const s = 10 + r() * 9;
      cb.add(Math.cos(a) * d, 12 + r() * 16 - d * 0.12, Math.sin(a) * d, s * (0.9 + r() * 0.4), s * (0.42 + r() * 0.2), s * (0.9 + r() * 0.4), 0.85 + r() * 0.25, d < 26 ? 0.5 + r() * 0.3 : r() * 0.25, 1, r() * 6);
    }
    // Wall clouds: a ring of thick clouds hanging down, leaving an "eye" over the tower top in the middle
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + r() * 0.2;
      const d = 13 + r() * 9;
      const s = 5.5 + r() * 4;
      cb.add(Math.cos(a) * d, 1 + r() * 4, Math.sin(a) * d, s * 1.2, s * 0.62, s, 0.72 + r() * 0.15, 0.7 + r() * 0.3, 1, a);
    }
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2;
      const d = 22 + r() * 22;
      const s = 2.8 + r() * 3.2;
      cb.add(Math.cos(a) * d, -4 - r() * 6, Math.sin(a) * d, s * 1.6, s * 0.5, s, 0.7 + r() * 0.2, 0.2 + r() * 0.4, 1, a);
    }
  }
  const cellMesh = cb.mesh(cellMat);
  if (cellMesh) {
    cellMesh.frustumCulled = false;
    cell.add(cellMesh);
  }
  group.add(cell);

  // ── After purification: shafts of light pouring down from the cloud hole onto the tower and the avenue in front of it
  const shafts: THREE.Mesh[] = [];
  if (calm) {
    const rs = rng(2024);
    const sun = LIGHT.dir.value;
    const hl = Math.hypot(sun.x, sun.z) || 1;
    const dir = V((sun.x / hl) * 0.3, 1, (sun.z / hl) * 0.3).normalize();
    const up = V(0, 1, 0);
    for (let i = 0; i < 11; i++) {
      const a = rs() * Math.PI * 2;
      const d = i === 0 ? 0 : 9 + rs() * 40;
      const bx = ex + Math.cos(a) * d;
      const bz = ez + Math.sin(a) * d;
      const by = o.h(bx, bz) - 1;
      const L = (CEIL - 4 - by) / dir.y;
      const rTop = i === 0 ? 5 : 1.4 + rs() * 2.2;
      const rBot = rTop * (1.5 + rs() * 0.5);
      const g = new THREE.CylinderGeometry(rTop, rBot, L, 20, 1, true);
      g.translate(0, L / 2, 0);
      const m = shaftMat(rs() * 6);
      m.uniforms.uA.value = i === 0 ? 0.16 : 0.2 + rs() * 0.12;
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(bx, by, bz);
      mesh.quaternion.setFromUnitVectors(up, dir);
      mesh.renderOrder = 6;
      mesh.frustumCulled = false;
      group.add(mesh);
      shafts.push(mesh);
    }
  }

  // ── Cumulonimbus wall on the horizon (380~620 meters outside the map, towers of cloud growing upward one after another)
  const bankMat = cloudMat(0.5);
  bankMat.uniforms.uFlashR.value = 110;
  bankMat.uniforms.uCol.value.set(calm ? 0x7a84a6 : 0x56608a);
  const bb = new Blobs();
  // The horizon clouds use their own random stream: before and after the storm disperses, the distant cloud wall grows the same
  const rh = rng(9001);
  const towers: THREE.Vector3[] = [];
  const nT = 17;
  // High-altitude wind direction (same as the ribbons), the anvil tops stretch toward downwind
  const windA = Math.atan2(0.49, 0.87);
  const wx = Math.cos(windA);
  const wz = Math.sin(windA);
  for (let i = 0; i < nT; i++) {
    const a = (i / nT) * Math.PI * 2 + (rh() - 0.5) * 0.25;
    const d = 430 + rh() * 180;
    const cx = Math.cos(a) * d;
    const cz = Math.sin(a) * d;
    const H = 110 + rh() * 120;
    const W = 55 + rh() * 45;
    towers.push(V(cx, H * 0.5, cz));
    // Cloud base: flat, dark cloud, stretched sideways to join the neighboring cloud towers into a wall
    for (let k = 0; k < 4; k++) {
      const aa = a + (k - 1.5) * 0.075 + (rh() - 0.5) * 0.03;
      bb.add(Math.cos(aa) * d, 24 + rh() * 8, Math.sin(aa) * d, W * (0.8 + rh() * 0.3), W * 0.2, W * 0.55, 0.6, 0, 1, -aa + Math.PI / 2);
    }
    // Cloud body: cauliflower-like billows, getting smaller and drawing in toward the middle as they go up
    let y = 34;
    while (y < H) {
      const t = y / H;
      const rad = W * (0.6 - t * 0.26) * (0.85 + rh() * 0.3);
      for (let j = 0; j < (ctx.low ? 2 : 3); j++) {
        const aa = rh() * Math.PI * 2;
        const off = rad * (0.3 + rh() * 0.4);
        const s = rad * (0.62 + rh() * 0.25);
        bb.add(cx + Math.cos(aa) * off, y + (rh() - 0.5) * rad * 0.3, cz + Math.sin(aa) * off, s, s * (0.78 + rh() * 0.2), s, 0.72 + t * 0.5, 0, 1, aa);
      }
      y += rad * 0.62;
    }
    // Anvil top: thin and wide, leaning toward downwind
    const ry = Math.atan2(-wz, wx);
    bb.add(cx + wx * W * 0.35, H + 8, cz + wz * W * 0.35, W * 1.35, W * 0.14, W * 0.8, 1.25, 0, 1, ry);
    bb.add(cx + wx * W * 0.9, H + 12, cz + wz * W * 0.9, W * 0.8, W * 0.1, W * 0.55, 1.3, 0, 1, ry);
    bb.add(cx - wx * W * 0.15, H + 2, cz - wz * W * 0.15, W * 0.6, W * 0.2, W * 0.55, 1.15, 0, 1, ry);
  }
  const bankMesh = bb.mesh(bankMat);
  if (bankMesh) {
    bankMesh.frustumCulled = false;
    group.add(bankMesh);
  }

  // ── Lightning pool
  const bolts: Bolt[] = [];
  for (let i = 0; i < 12; i++) {
    const mat = boltMat();
    const mesh = new THREE.Mesh(boltGeometry(r), mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = 8;
    group.add(mesh);
    bolts.push({ mesh, mat, t: -1, pulses: [], flash: 0 });
  }
  const DOWN = V(0, -1, 0);
  const strike = (from: THREE.Vector3, to: THREE.Vector3, width: number, flash: number, color = 0xb8a8ff) => {
    const bolt = bolts.find((b) => b.t < 0) ?? bolts.reduce((a, b) => (a.t > b.t ? a : b));
    const d = to.clone().sub(from);
    const L = d.length();
    bolt.mesh.position.copy(from);
    bolt.mesh.quaternion.setFromUnitVectors(DOWN, d.divideScalar(L));
    bolt.mesh.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(DOWN, Math.random() * Math.PI * 2));
    bolt.mesh.scale.setScalar(L);
    bolt.mesh.visible = true;
    bolt.mat.uniforms.uWidth.value = width;
    bolt.mat.uniforms.uColor.value.set(color);
    bolt.t = 0;
    bolt.flash = flash;
    bolt.pulses = [[0, 1]];
    const n = 1 + Math.floor(Math.random() * 3);
    let tt = 0;
    for (let k = 0; k < n; k++) {
      tt += 0.05 + Math.random() * 0.09;
      bolt.pulses.push([tt, 0.5 + Math.random() * 0.5]);
    }
  };
  const pulse = (b: Bolt) => {
    let a = 0;
    for (const [t0, amp] of b.pulses) if (b.t >= t0) a = Math.max(a, amp * Math.exp(-(b.t - t0) * 13));
    return a;
  };

  // ── Things that flash along: ambient and rim light of the whole scene, fog, sky, grass tips
  const baseAmb = LIGHT.ambient.value.clone();
  const baseRim = LIGHT.rimColor.value.clone();
  const flashAmb = new THREE.Color(0.95, 0.92, 1.25);
  const flashRim = new THREE.Color(0.85, 0.88, 1.2);
  const root = group.parent;
  let scene: THREE.Scene | null = null;
  let fogBase: THREE.Color | null = null;
  let sky: { mat: THREE.ShaderMaterial; top: THREE.Color; mid: THREE.Color; bot: THREE.Color } | null = null;
  let grass: { u: { value: THREE.Color }; base: THREE.Color } | null = null;
  let lookups = 0;
  const findTargets = () => {
    if (!root) return;
    if (!scene) {
      let s: THREE.Object3D = root;
      while (s.parent) s = s.parent;
      if ((s as THREE.Scene).isScene) scene = s as THREE.Scene;
    }
    root.traverse((obj) => {
      const m = (obj as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      const u = m?.uniforms;
      if (!u) return;
      if (!sky && u.uStars && u.top && u.mid && u.bot) {
        // The clouds have opened: clear blue sky shows in the cloud hole, and the horizon warms up too
        if (calm) {
          u.top.value.set(0x4a7cc0);
          u.mid.value.set(0x9cb8d6);
          u.bot.value.set(0xf0c89c);
        }
        sky = { mat: m!, top: u.top.value.clone(), mid: u.mid.value.clone(), bot: u.bot.value.clone() };
      }
      if (!grass && u.uTip && u.uPlayer) grass = { u: u.uTip, base: u.uTip.value.clone() };
    });
  };
  const followers: [{ value: number }, number][] = [];
  disposers.push(() => {
    LIGHT.ambient.value.copy(baseAmb);
    LIGHT.rimColor.value.copy(baseRim);
    for (const b of bolts) {
      b.mesh.geometry.dispose();
      b.mat.dispose();
    }
    for (const m of shafts) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    ceil.dispose();
    ceilGeo.dispose();
    cellMat.dispose();
    bankMat.dispose();
    cellMesh?.geometry.dispose();
    bankMesh?.geometry.dispose();
  });

  // ── Rhythm
  let flash = 0;
  let cloudFlash = 0;
  let cellFlash = 0;
  let bankFlash = 0;
  const timers = {
    far: 0.8,
    tower: 1.5,
    glow: 0.4,
    cellGlow: 0.3,
    grass: 7,
  };
  const tgtT = o.targets.map((t) => t.every[0] + Math.random() * (t.every[1] - t.every[0]));
  const tmp = V(0, 0, 0);
  const cam = V(0, 0, 0);
  const bumpFlash = (amt: number) => (flash = Math.max(flash, amt));

  extras.push((dt, t, vfx) => {
    if (lookups < 40 && (!sky || !grass || !scene)) {
      lookups++;
      findTargets();
    }
    cam.copy(vfx.camPos);
    const near = (p: THREE.Vector3, R: number) => 1 - Math.min(1, Math.hypot(p.x - cam.x, p.z - cam.z) / R);

    // Distant cloud-to-ground lightning: striking down from the horizon cloud wall
    timers.far -= dt;
    if (timers.far <= 0) {
      timers.far = calm ? 8 + Math.random() * 10 : 1.2 + Math.random() * 2.6;
      const tw = towers[Math.floor(Math.random() * towers.length)];
      const top = V(tw.x + (Math.random() - 0.5) * 60, 34 + Math.random() * 30, tw.z + (Math.random() - 0.5) * 60);
      const bot = V(top.x + (Math.random() - 0.5) * 70, 6, top.z + (Math.random() - 0.5) * 70);
      const dist = Math.hypot(bot.x - cam.x, bot.z - cam.z);
      strike(top, bot, 0.9 + dist * 0.006, calm ? 0.06 : 0.18 + Math.random() * 0.12, 0xc8b8ff);
      bankMat.uniforms.uFlashPos.value.copy(top);
      bankFlash = 1;
      ceil.uniforms.uFlashPos.value.set(top.x * 0.6, CEIL, top.z * 0.6);
      cloudFlash = Math.max(cloudFlash, calm ? 0.2 : 0.5);
      if (!calm) void vfx.flash(bot.clone().setY(ctx.h(bot.x, bot.z) + 4), 0xb8a8ff, 26, 0.35);
    }

    // The storm cluster strikes the tower spire: the closer to the tower, the brighter the flash
    timers.tower -= dt;
    if (!calm && timers.tower <= 0) {
      timers.tower = 1.6 + Math.random() * 2.8;
      const a = Math.random() * Math.PI * 2;
      const from = V(ex + Math.cos(a) * (6 + Math.random() * 10), base + 2, ez + Math.sin(a) * (6 + Math.random() * 10));
      const to = o.spire.clone();
      const k = near(to, 220);
      strike(from, to, 0.55 + (1 - k) * 0.8, 0.12 + k * 0.55, 0xd0b8ff);
      cellMat.uniforms.uFlashPos.value.copy(from);
      cellFlash = 1;
      ceil.uniforms.uFlashPos.value.set(ex, CEIL, ez);
      cloudFlash = Math.max(cloudFlash, 0.6);
      void vfx.flash(to, 0xe8dcff, 7, 0.4);
      if (k > 0.3) vfx.emit({ pos: to, count: 16, color: [0xfff066, 0xffffff, 0xc0b0ff], speed: [3, 8], life: [0.3, 0.8], size: [0.12, 0.25], gravity: 6, drag: 1, atlas: 1, intensity: 2.4 });
    }

    // Designated strike points (pillar grove, lightning rod, secret realm)
    if (!calm) o.targets.forEach((tg, i) => {
      tgtT[i] -= dt;
      if (tgtT[i] > 0) return;
      tgtT[i] = tg.every[0] + Math.random() * (tg.every[1] - tg.every[0]);
      if (!tg.pos.length) return;
      const pos = tg.pos[Math.floor(Math.random() * tg.pos.length)];
      const k = near(pos, tg.range);
      if (k <= 0) return;
      const from = V(pos.x + (Math.random() - 0.5) * 40, CEIL - 6, pos.z + (Math.random() - 0.5) * 40);
      strike(from, pos, 0.4 + (1 - k) * 0.6, tg.power * (0.3 + k * 0.7));
      ceil.uniforms.uFlashPos.value.copy(from);
      cloudFlash = Math.max(cloudFlash, 0.9);
      void vfx.flash(pos, 0xe8dcff, 4, 0.35);
      void vfx.ring(pos.clone(), 0xfff0a0, 0.2, 2.2, 0.45);
      vfx.emit({ pos, count: 22, color: [0xfff066, 0xffffff, 0xc0b0ff], speed: [2, 6], life: [0.3, 0.8], size: [0.08, 0.18], gravity: 5, drag: 1.2, atlas: 1, intensity: 2.4 });
      tg.after?.(pos, vfx);
    });

    // An occasional bolt falls on the grassland (45~110 meters from the camera)
    timers.grass -= dt;
    if (!calm && timers.grass <= 0) {
      timers.grass = 6 + Math.random() * 7;
      for (let tries = 0; tries < 8; tries++) {
        const a = Math.random() * Math.PI * 2;
        const d = 45 + Math.random() * 65;
        const x = cam.x + Math.cos(a) * d;
        const z = cam.z + Math.sin(a) * d;
        if (Math.abs(x) > o.size - 26 || Math.abs(z) > o.size - 26) continue;
        if (o.avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
        const y = o.h(x, z);
        tmp.set(x, y, z);
        strike(V(x + (Math.random() - 0.5) * 30, CEIL - 4, z + (Math.random() - 0.5) * 30), tmp.clone(), 0.5 + d * 0.004, 0.55);
        ceil.uniforms.uFlashPos.value.set(x, CEIL, z);
        cloudFlash = Math.max(cloudFlash, 1);
        void vfx.flash(tmp.clone().setY(y + 1), 0xe8dcff, 9, 0.4);
        void vfx.ring(tmp.clone().setY(y + 0.2), 0xfff0a0, 0.4, 5, 0.6);
        vfx.emit({ pos: tmp.clone().setY(y + 0.3), count: 26, color: [0xfff066, 0xffffff, 0xc0b0ff], speed: [2, 7], dir: V(0, 1, 0), spread: 0.9, life: [0.3, 0.9], size: [0.1, 0.2], gravity: 6, drag: 1, atlas: 1, intensity: 2.4 });
        vfx.smoke({ pos: tmp.clone().setY(y + 0.6), count: 6, color: 0x3a3448, speed: [0.4, 1.2], dir: V(0.3, 1, 0.2), spread: 0.5, life: [2, 3.5], size: [0.6, 1.1], sizeEnd: 3.5, drag: 0.4, radius: 0.8 });
        break;
      }
    }

    // Muffled flashes inside the clouds (lightning that doesn't reach the ground)
    timers.glow -= dt;
    if (timers.glow <= 0) {
      timers.glow = calm ? 4 + Math.random() * 7 : 0.5 + Math.random() * 1.6;
      const a = Math.random() * Math.PI * 2;
      const d = calm ? 260 + Math.random() * 200 : 60 + Math.random() * 260;
      ceil.uniforms.uFlashPos.value.set(cam.x + Math.cos(a) * d, CEIL, cam.z + Math.sin(a) * d);
      cloudFlash = Math.max(cloudFlash, calm ? 0.2 + Math.random() * 0.15 : 0.45 + Math.random() * 0.45);
      if (!calm) bumpFlash(0.05);
    }
    // Constant flickering inside the cloud cluster over the tower top
    timers.cellGlow -= dt;
    if (!calm && timers.cellGlow <= 0) {
      timers.cellGlow = 0.15 + Math.random() * 0.7;
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 36;
      cellMat.uniforms.uFlashPos.value.set(ex + Math.cos(a) * d, base + 4 + Math.random() * 14, ez + Math.sin(a) * d);
      cellFlash = Math.max(cellFlash, 0.4 + Math.random() * 0.6);
    }

    // The lightning's own flicker and the flash of the whole scene
    let f = 0;
    for (const b of bolts) {
      if (b.t < 0) continue;
      b.t += dt;
      const a = pulse(b);
      b.mat.uniforms.uAlpha.value = a;
      f = Math.max(f, a * b.flash);
      if (b.t > 0.75) {
        b.t = -1;
        b.mesh.visible = false;
      }
    }
    flash = Math.max(f, flash - dt * 3);
    cloudFlash = Math.max(0, cloudFlash - dt * 3.2);
    cellFlash = Math.max(0, cellFlash - dt * 5);
    bankFlash = Math.max(0, bankFlash - dt * 3);

    ceil.uniforms.uTime.value = t;
    ceil.uniforms.uFlash.value = Math.max(cloudFlash, flash);
    ceil.uniforms.uSky.value = flash;
    cellMat.uniforms.uTime.value = t;
    cellMat.uniforms.uFlash.value = cellFlash;
    cellMat.uniforms.uSky.value = flash;
    bankMat.uniforms.uTime.value = t * 0.5;
    bankMat.uniforms.uFlash.value = bankFlash;
    bankMat.uniforms.uSky.value = flash * 0.5;
    // The cloud cluster "doesn't move at all": it only churns extremely slowly in place
    cell.rotation.y = t * (calm ? 0.02 : 0.012);
    for (const m of shafts) (m.material as THREE.ShaderMaterial).uniforms.uTime.value = t;

    LIGHT.ambient.value.copy(baseAmb).lerp(flashAmb, Math.min(1, flash * 0.9));
    LIGHT.rimColor.value.copy(baseRim).lerp(flashRim, Math.min(1, flash));
    const fog = (scene as THREE.Scene | null)?.fog as THREE.Fog | null | undefined;
    if (fog) {
      if (!fogBase) {
        fogBase = fog.color.clone();
        if (calm) fogBase.lerp(new THREE.Color(0xc4b8a6), 0.6);
      }
      fog.color.copy(fogBase).lerp(flashAmb, flash * 0.35);
      ceil.uniforms.uHorizon.value.copy(fog.color);
      bankMat.uniforms.uHaze.value.copy(fog.color);
      cellMat.uniforms.uHaze.value.copy(fog.color);
    }
    const sk = sky as { mat: THREE.ShaderMaterial; top: THREE.Color; mid: THREE.Color; bot: THREE.Color } | null;
    if (sk) {
      const u = sk.mat.uniforms;
      u.top.value.copy(sk.top).lerp(flashAmb, flash * 0.25);
      u.mid.value.copy(sk.mid).lerp(flashAmb, flash * 0.35);
      u.bot.value.copy(sk.bot).lerp(flashAmb, flash * 0.3);
    }
    const gr = grass as { u: { value: THREE.Color }; base: THREE.Color } | null;
    if (gr) gr.u.value.copy(gr.base).lerp(flashAmb, flash * 0.5);
    for (const [u, k] of followers) u.value = flash * k;
  });

  return {
    flash: () => flash,
    follow: (u, k = 1) => void followers.push([u, k]),
  };
}
