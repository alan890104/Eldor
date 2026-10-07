// Skyhowl Highlands (wind): a battlefield on a cliff platform, with a churning sea of clouds underfoot and floating stones with hanging roots and waterfalls drifting all around,
// the winged folk's watchtower and windmills standing at the cliff edge; feather banners, long grass, windmills, drifting fluff and flocks of birds all flow with the same wind (+x).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, MS, PropBatch, type ArenaCtx, type RegionModule } from '../arenaKit.ts';
import { LIGHT } from '../toon.ts';

type V = [number, number, number];

// ───────────────────────── Cliff edge ─────────────────────────

/** Cliff edge radius: undulating with azimuth; the camera side (−x, +z) keeps a bit more ground, so there is still solid ground underfoot when an ultimate's camera pulls back */
function edgeR(a: number): number {
  return 19.4 + 1.6 * Math.sin(3 * a + 1.1) + 1.0 * Math.sin(7 * a + 0.4) + 0.5 * Math.sin(13 * a + 2.0) + 2.6 * Math.max(0, Math.cos(a - 1.83));
}

/** Cut-out texture for the ground disc: transparent beyond the cliff edge, showing the sea of clouds below */
function plateauAlpha(): THREE.Texture {
  const s = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, s, s);
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i <= 256; i++) {
    const a = (i / 256) * Math.PI * 2;
    // Ground radius 34 → texture 1024 pixels; canvas +y maps to world +z
    const rr = (edgeR(a) * 0.985 * s) / 68;
    const x = s / 2 + Math.cos(a) * rr;
    const y = s / 2 + Math.sin(a) * rr;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** A ring-shaped rock wall swept along the cliff edge (flat shaded): prof is [height, radius multiplier], from top to bottom */
function cliffBand(prof: [number, number][], segs: number, r: () => number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < prof.length; i++) {
    const [y, k] = prof[i];
    const jitter = i === 0 ? 0 : 0.22;
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const rr = edgeR(a) * k * (1 + (r() - 0.5) * 0.03);
      pos.push(Math.cos(a) * rr, y + (r() - 0.5) * jitter, Math.sin(a) * rr);
    }
  }
  for (let i = 0; i < prof.length - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * segs + j;
      const b = i * segs + ((j + 1) % segs);
      const c = (i + 1) * segs + j;
      const d = (i + 1) * segs + ((j + 1) % segs);
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

// ───────────────────────── Meshes blown by the wind ─────────────────────────

/** Triangle accumulator with vertex colors + sway weights: grass, banners, birds and windmill blades all use it to assemble a single mesh */
export class SoftGeo {
  private p: number[] = [];
  private n: number[] = [];
  private c: number[] = [];
  private s: number[] = [];
  private ph: number[] = [];

  tri(a: V, b: V, c: V, col: THREE.Color, sw: [number, number, number], phase: number): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const vs: [V, number][] = [[a, sw[0]], [b, sw[1]], [c, sw[2]]];
    for (const [v, w] of vs) {
      this.p.push(v[0], v[1], v[2]);
      this.n.push(nx, ny, nz);
      this.c.push(col.r, col.g, col.b);
      this.s.push(w);
      this.ph.push(phase);
    }
  }

  quad(a: V, b: V, c: V, d: V, col: THREE.Color, sw: [number, number, number, number], phase: number): void {
    this.tri(a, b, c, col, [sw[0], sw[1], sw[2]], phase);
    this.tri(a, c, d, col, [sw[0], sw[2], sw[3]], phase);
  }

  /** Axis-aligned box (for the windmill's arms and shaft) */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: THREE.Color): void {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const q = (a: V, b: V, c: V, d: V) => this.quad(a, b, c, d, col, [0, 0, 0, 0], 0);
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
    q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
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

/** Vertex-color material with two toon steps + fog; displace is the GLSL for vertex displacement (can use p, aSway, aPhase, uTime) */
export function softMaterial(displace: string, shade = 0.6): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    side: THREE.DoubleSide,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uLightDir: LIGHT.dir,
      uShade: { value: shade },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute vec3 aColor; attribute float aSway; attribute float aPhase;
      uniform float uTime;
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

const GRASS_SWAY = /* glsl */ `
  float g = 0.55 + 0.45 * sin(uTime * 0.8 + p.x * 0.12 + p.z * 0.07);
  float w = sin(uTime * 2.6 + aPhase + p.x * 0.4);
  p.x += aSway * (0.22 + 0.3 * w) * g;
  p.z += aSway * 0.08 * sin(uTime * 3.3 + aPhase);
  p.y -= aSway * aSway * 0.08 * g;`;

const FLAG_SWAY = /* glsl */ `
  p.z += aSway * 0.2 * sin(uTime * 7.0 - aSway * 5.5 + aPhase);
  p.y += aSway * 0.1 * sin(uTime * 4.0 - aSway * 3.0 + aPhase) - aSway * aSway * 0.06;`;

const BIRD_FLAP = /* glsl */ `
  p.y += aSway * sin(uTime * 9.0 + aPhase) * 0.3;`;

// ───────────────────────── Shaders: sea of clouds, clouds in the sky, waterfall, wind streaks ─────────────────────────

export const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.3; a *= 0.5; } return v; }`;

/** Sea of clouds: flowing cloud tops in three toon steps, drifting toward +x with the wind */
function cloudSeaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uA: { value: new THREE.Color(0x9cb3d8) },
      uB: { value: new THREE.Color(0xcfdbee) },
      uC: { value: new THREE.Color(0xf6f9ff) },
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
      uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
      varying vec3 vW;
      ${NOISE_GLSL}
      float cloud(vec2 p) { return fbm(p) * 0.75 + fbm(p * 2.3 + vec2(uTime * 0.02, 7.0)) * 0.25; }
      void main() {
        vec2 p = vW.xz * 0.055 - vec2(uTime * 0.07, 0.0);
        float n = cloud(p);
        // Take a difference toward the windward side as lighting so the cloud mass has lit and shaded faces
        float lit = clamp((cloud(p + vec2(-0.12, 0.08)) - n) * 6.0 + 0.5, 0.0, 1.0);
        float h = n + lit * 0.12;
        vec3 c = mix(uA, uB, smoothstep(0.42, 0.46, h));
        c = mix(c, uC, smoothstep(0.56, 0.6, h));
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
}

/** High clouds in the sky: a translucent shell on the inside of the sky dome, the cloud masses flowing with the wind; the sky's base color is still decided by skyMat */
function cloudShellMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vP;
      ${NOISE_GLSL}
      void main() {
        float h = vP.y;
        if (h < 0.05) discard;
        vec2 p = vP.xz / (h + 0.25) * 2.2 - vec2(uTime * 0.02, 0.0);
        float n = fbm(p) * 0.7 + fbm(p * 2.7 + 3.1) * 0.3;
        float fade = smoothstep(0.05, 0.22, h) * (1.0 - smoothstep(0.6, 0.95, h));
        float a = smoothstep(0.5, 0.56, n) * fade * 0.9;
        vec3 c = mix(vec3(0.84, 0.9, 0.98), vec3(1.0), smoothstep(0.58, 0.68, n));
        gl_FragColor = vec4(c, a);
      }`,
  });
}

/** Waterfall: a strip of water ripples scrolling along v, fading out into the sea of clouds at the tail */
function waterfallMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; varying vec2 vUv;
      void main() {
        float s = fract(vUv.y * 5.0 - uTime * 1.6 + sin(vUv.x * 9.0) * 0.12);
        float stripe = smoothstep(0.35, 0.4, s) * (1.0 - smoothstep(0.7, 0.75, s));
        vec3 c = mix(vec3(0.7, 0.87, 1.0), vec3(1.0), stripe);
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(0.0, 0.18, 1.0 - vUv.x);
        float a = (0.55 + 0.4 * stripe) * (1.0 - smoothstep(0.6, 1.0, vUv.y)) * edge;
        gl_FragColor = vec4(c, a);
        #include <fog_fragment>
      }`,
  });
}

/** Wind streaks: pale white wave bands sweeping across the grass (additive decal, does not block standing positions) */
function windDecalMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vW; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vW;
      ${NOISE_GLSL}
      void main() {
        vec2 p = vW.xz;
        float n = noise(vec2(p.x * 0.09 - uTime * 0.9, p.y * 0.22)) * 0.7 + noise(vec2(p.x * 0.2 - uTime * 1.4, p.y * 0.5 + 3.0)) * 0.3;
        float band = smoothstep(0.58, 0.78, n);
        float d = length(p);
        float fade = 1.0 - smoothstep(15.0, 18.5, d);
        gl_FragColor = vec4(vec3(1.0, 1.0, 0.94) * band * 0.14 * fade, 1.0);
      }`,
  });
}

// ───────────────────────── Props ─────────────────────────

/** Cone with the tip pointing down and the base at the origin (the rock body and hanging roots of a floating stone) */
function coneDown(rad: number, h: number, seg: number): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(rad, h, seg);
  g.rotateX(Math.PI);
  g.translate(0, -h / 2, 0);
  return g;
}

const ROCK = 0x8d8579;
const GRASS = 0x7ec764;
const ROOT = 0x6b5143;

/** Floating stone: an inverted-cone rock body, turf, hanging roots, small trees; when fall is true a waterfall hangs from the side facing the center of the field */
function island(ib: PropBatch, falls: THREE.BufferGeometry[], x: number, y: number, z: number, s: number, r: () => number, fall: boolean): void {
  const ry = r() * 6;
  ib.add(coneDown(1.5, 3.4, 6), ROCK, M(x, y + 0.2 * s, z, ry, s));
  ib.add(coneDown(1.0, 2.2, 5), ROCK, M(x + 0.55 * s, y + 0.1 * s, z - 0.3 * s, ry + 1, s));
  const chunk = new THREE.DodecahedronGeometry(1, 0);
  chunk.scale(1.1, 1.5, 1.0);
  ib.add(chunk, ROCK, M(x - 0.3 * s, y - 1.1 * s, z + 0.2 * s, ry + 2, s * 0.8, 0.3, 0.2));
  ib.add(new THREE.CylinderGeometry(1.62, 1.48, 0.5, 7), GRASS, M(x, y + 0.2 * s, z, ry, s));
  const mound = new THREE.IcosahedronGeometry(1.15, 1);
  mound.scale(1, 0.32, 1);
  ib.add(mound, GRASS, M(x, y + 0.42 * s, z, ry, s));
  for (let i = 0; i < 3; i++) {
    const phi = ry + i * 2.1 + r() * 0.6;
    ib.add(coneDown(0.1, 1.9, 4), ROOT, M(x + Math.cos(phi) * 0.75 * s, y - 1.9 * s, z + Math.sin(phi) * 0.75 * s, -phi, s * (0.7 + r() * 0.6), 0, 0.35));
  }
  // Small tree
  const tx = x + Math.cos(ry) * 0.45 * s;
  const tz = z + Math.sin(ry) * 0.45 * s;
  const ty = y + 0.5 * s;
  ib.add(new THREE.CylinderGeometry(0.09, 0.14, 0.7, 5), ROOT, M(tx, ty + 0.35 * s, tz, 0, s));
  ib.add(new THREE.ConeGeometry(0.55, 0.95, 6), GRASS, M(tx, ty + 0.95 * s, tz, ry, s));
  ib.add(new THREE.ConeGeometry(0.4, 0.8, 6), GRASS, M(tx, ty + 1.45 * s, tz, ry + 0.5, s));
  if (!fall) return;
  // Waterfall: at the cliff edge facing the center of the field; drifting toward +x with the wind
  const dl = Math.hypot(x, z) || 1;
  const dx = -x / dl, dz = -z / dl;
  const tX = -dz, tZ = dx;
  const top: V = [x + dx * 1.45 * s, y + 0.4 * s, z + dz * 1.45 * s];
  const L = 8 + s * 1.5;
  const segs = 8;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let k = 0; k <= segs; k++) {
    const v = k / segs;
    const w = (0.45 + 0.45 * v) * s;
    const cx = top[0] + v * v * 1.3, cy = top[1] - v * L, cz = top[2];
    pos.push(cx - tX * w * 0.5, cy, cz - tZ * w * 0.5, cx + tX * w * 0.5, cy, cz + tZ * w * 0.5);
    uv.push(0, v, 1, v);
    if (k < segs) {
      const a = k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  falls.push(g.toNonIndexed());
}

/** The winged folk's watchtower: a stone-built body, a wooden platform, a pavilion and a pointed roof, with a long banner on top */
function watchtower(b: PropBatch, flags: SoftGeo, x: number, z: number): V {
  b.add(new THREE.CylinderGeometry(1.45, 1.95, 5.6, 8), 0xb8b1a5, M(x, 2.8, z, 0.2));
  b.add(new THREE.CylinderGeometry(1.75, 1.8, 0.35, 8), 0x9d958a, M(x, 2.0, z, 0.2));
  b.add(new THREE.CylinderGeometry(1.62, 1.68, 0.35, 8), 0x9d958a, M(x, 4.1, z, 0.2));
  b.add(new THREE.BoxGeometry(0.9, 1.5, 0.3), 0x5a4436, M(x - 1.2, 0.75, z + 1.2, Math.PI / 4));
  b.add(new THREE.CylinderGeometry(2.35, 2.0, 0.4, 8), 0x8c6a48, M(x, 5.75, z, 0.2));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    b.add(new THREE.BoxGeometry(0.12, 0.85, 0.12), 0x6f5238, M(x + Math.cos(a) * 2.1, 6.35, z + Math.sin(a) * 2.1, -a));
  }
  b.add(new THREE.TorusGeometry(2.1, 0.05, 5, 16), 0x6f5238, M(x, 6.7, z, 0, 1, Math.PI / 2));
  b.add(new THREE.CylinderGeometry(1.4, 1.4, 1.9, 8), 0xebe3d4, M(x, 6.9, z, 0.2));
  b.add(new THREE.ConeGeometry(2.4, 2.2, 8), 0x4aa1ba, M(x, 8.95, z, 0.2));
  b.add(new THREE.SphereGeometry(0.28, 8, 6), 0xf2c66a, M(x, 10.1, z));
  b.add(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 5), 0x5a4436, M(x, 11.3, z));
  // The pavilion's window lamp
  for (const a of [2.6, 3.5, 4.4]) b.glow(new THREE.BoxGeometry(0.34, 0.5, 0.1), 0xffe3a0, M(x + Math.cos(a) * 1.4, 7.0, z + Math.sin(a) * 1.4, -a));
  // Long banner: streaming from the pole top toward +x with the wind
  const px = x, py = 12.4, pz = z;
  const segs = 7;
  const len = 3.4;
  const teal = new THREE.Color(0x3fb2c9);
  const cream = new THREE.Color(0xf6f1e6);
  for (let k = 0; k < segs; k++) {
    const u0 = k / segs, u1 = (k + 1) / segs;
    const h0 = 0.9 * (1 - u0 * 0.85), h1 = 0.9 * (1 - u1 * 0.85);
    const col = k < 3 ? teal : cream;
    flags.quad([px + u0 * len, py - h0, pz], [px + u1 * len, py - h1, pz], [px + u1 * len, py, pz], [px + u0 * len, py, pz], col, [u0, u1, u1, u0], 0.7);
  }
  return [px, 11.4, pz];
}

/** Windmill: a stone-built body and a pointed roof; the blades are made separately as a rotating mesh */
function windmill(b: PropBatch, x: number, z: number): V {
  const q = Math.SQRT1_2;
  b.add(new THREE.CylinderGeometry(1.55, 2.15, 6.2, 8), 0xe6dccb, M(x, 3.1, z, 0.3));
  b.add(new THREE.CylinderGeometry(2.2, 2.3, 0.35, 8), 0x9d958a, M(x, 0.3, z, 0.3));
  b.add(new THREE.CylinderGeometry(1.9, 1.9, 0.22, 8), 0x8c6a48, M(x, 3.3, z, 0.3));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    b.add(new THREE.BoxGeometry(0.1, 0.7, 0.1), 0x6f5238, M(x + Math.cos(a) * 1.85, 3.75, z + Math.sin(a) * 1.85, -a));
  }
  b.add(new THREE.TorusGeometry(1.85, 0.045, 5, 16), 0x6f5238, M(x, 4.05, z, 0, 1, Math.PI / 2));
  b.add(new THREE.BoxGeometry(0.9, 1.5, 0.25), 0x5a4436, M(x - 1.45 * q, 0.75, z + 1.45 * q, Math.PI / 4));
  b.add(new THREE.BoxGeometry(0.5, 0.6, 0.2), 0x6fb6d8, M(x + 1.5 * q, 4.9, z + 1.5 * q, -Math.PI / 4));
  b.add(new THREE.ConeGeometry(2.15, 1.7, 8), 0x4f9fc0, M(x, 7.05, z, 0.3));
  b.add(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 6), 0x5a4436, M(x - 1.9 * q, 6.0, z + 1.9 * q, Math.PI / 4, 1, 0, Math.PI / 2));
  return [x - 2.5 * q, 6.0, z + 2.5 * q];
}

/** Windmill blades: four wooden arms with canvas, made into one mesh that rotates about its axis */
function millBlades(): THREE.BufferGeometry {
  const g = new SoftGeo();
  const wood = new THREE.Color(0x7a5a3a);
  const sail = new THREE.Color(0xf4eadb);
  g.box(0, 0, 0, 0.5, 0.5, 0.5, wood);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const cx = Math.cos(a), cy = Math.sin(a);
    // Wooden arm: a slender box from the center outward (the triangles are assembled in rotated coordinates)
    const L = 3.6, w = 0.14;
    const px = -cy, py = cx;
    const p = (t: number, s: number, zz: number): V => [cx * t + px * s, cy * t + py * s, zz];
    g.quad(p(0.2, -w, 0.08), p(L, -w, 0.08), p(L, w, 0.08), p(0.2, w, 0.08), wood, [0, 0, 0, 0], 0);
    g.quad(p(0.2, w, -0.08), p(L, w, -0.08), p(L, -w, -0.08), p(0.2, -w, -0.08), wood, [0, 0, 0, 0], 0);
    g.quad(p(0.2, w, 0.08), p(L, w, 0.08), p(L, w, -0.08), p(0.2, w, -0.08), wood, [0, 0, 0, 0], 0);
    g.quad(p(0.2, -w, -0.08), p(L, -w, -0.08), p(L, -w, 0.08), p(0.2, -w, 0.08), wood, [0, 0, 0, 0], 0);
    // Canvas: a trapezoid hung on one side of the wooden arm
    g.quad(p(1.0, w, 0), p(L - 0.1, w, 0), p(L - 0.1, w + 1.0, 0), p(1.0, w + 0.55, 0), sail, [0, 0, 0, 0], 0);
  }
  return g.build();
}

/** Feather-shaped pennants on a rope (the winged folk's wind-prayer flags) */
function featherFlag(flags: SoftGeo, p: THREE.Vector3, t: THREE.Vector3, col: THREE.Color, phase: number): void {
  const w = 0.42, L = 1.15;
  const a: V = [p.x - t.x * w * 0.5, p.y - t.y * w * 0.5, p.z - t.z * w * 0.5];
  const b: V = [p.x + t.x * w * 0.5, p.y + t.y * w * 0.5, p.z + t.z * w * 0.5];
  const tip: V = [p.x + L * 0.85, p.y - L * 0.6, p.z];
  const m1: V = [(a[0] + tip[0]) / 2 - t.x * 0.08, (a[1] + tip[1]) / 2, (a[2] + tip[2]) / 2 - t.z * 0.08];
  const m2: V = [(b[0] + tip[0]) / 2 + t.x * 0.08, (b[1] + tip[1]) / 2, (b[2] + tip[2]) / 2 + t.z * 0.08];
  flags.quad(a, b, m2, m1, col, [0, 0, 0.5, 0.5], phase);
  flags.tri(m1, m2, tip, col, [0.5, 0.5, 1], phase);
}

/** A tuft of swaying long grass (five blades, two segments each) */
function grassTuft(g: SoftGeo, x: number, z: number, s: number, r: () => number): void {
  const cols = [new THREE.Color(0x6fc257), new THREE.Color(0x8fd66a), new THREE.Color(0x5fae4c)];
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    const bx = x + Math.cos(a) * 0.14 * s, bz = z + Math.sin(a) * 0.14 * s;
    const h = (0.55 + r() * 0.5) * s;
    const w = 0.07 * s;
    const lean = 0.12 * s;
    const col = cols[Math.floor(r() * 3)];
    const ph = r() * 6.3;
    const ca = Math.cos(a + 1.57) * w, sa = Math.sin(a + 1.57) * w;
    g.quad([bx - ca, 0, bz - sa], [bx + ca, 0, bz + sa], [bx + ca * 0.7 + lean * 0.4, h * 0.55, bz + sa * 0.7], [bx - ca * 0.7 + lean * 0.4, h * 0.55, bz - sa * 0.7], col, [0, 0, 0.4, 0.4], ph);
    g.tri([bx - ca * 0.7 + lean * 0.4, h * 0.55, bz - sa * 0.7], [bx + ca * 0.7 + lean * 0.4, h * 0.55, bz + sa * 0.7], [bx + lean, h, bz], col, [0.4, 0.4, 1], ph);
  }
}

// ───────────────────────── Arena ─────────────────────────

function build({ group, b, r, ringPos, extras, disposers, ground, far }: ArenaCtx): void {
  // Cliff platform: the ground is cut out, with a rock wall and a grass rim; the distant-ground ring is hidden to show the sea of clouds
  far.visible = false;
  const alpha = plateauAlpha();
  const baseMat = ground.material as THREE.MeshLambertMaterial;
  const groundMat = new THREE.MeshLambertMaterial({ map: baseMat.map, alphaMap: alpha, alphaTest: 0.5 });
  ground.material = groundMat;
  disposers.push(() => {
    groundMat.dispose();
    alpha.dispose();
  });
  b.add(cliffBand([[0.05, 0.95], [0.32, 0.985], [0.22, 1.03], [-0.55, 1.0]], 72, r), 0x6fbf5a, M(0, 0, 0));
  b.add(cliffBand([[-0.5, 1.0], [-1.4, 0.985], [-2.7, 0.965], [-3.1, 0.905]], 72, r), 0x9a8e80, M(0, 0, 0));
  b.add(cliffBand([[-3.1, 0.905], [-4.8, 0.885], [-5.4, 0.82], [-7.8, 0.78], [-8.6, 0.7], [-11.5, 0.6], [-16, 0.42], [-22, 0.18]], 72, r), 0x7e7367, M(0, 0, 0));

  // Sea of clouds and the cloud clumps on it
  const seaMat = cloudSeaMaterial();
  const sea = new THREE.Mesh(new THREE.CircleGeometry(178, 64), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -3.5;
  group.add(sea);
  // Cloud clumps where the sea of clouds beats against the cliff edge: hugging the cliff wall, slightly above the cloud surface, visible from the platform
  for (let i = 0; i < 30; i++) {
    const [x, z] = ringPos(22, 36, false);
    const s = 2.2 + r() * 2.8;
    b.add(new THREE.IcosahedronGeometry(1, 1), 0xe6edf8, MS(x, -4.2 + r() * 1.2, z, s, s * 0.5, s, r() * 6), false);
    b.add(new THREE.IcosahedronGeometry(1, 1), 0xe6edf8, MS(x + s * 0.8, -4.3 + r() * 1.0, z + (r() - 0.5) * s, s * 0.7, s * 0.4, s * 0.7, r() * 6), false);
  }
  for (let i = 0; i < 18; i++) {
    const [x, z] = ringPos(40, 80, false);
    const s = 5 + r() * 5;
    b.add(new THREE.IcosahedronGeometry(1, 1), 0xe6edf8, MS(x, -4.2, z, s, s * 0.45, s, r() * 6), false);
    b.add(new THREE.IcosahedronGeometry(1, 1), 0xe6edf8, MS(x + s, -4.2, z + (r() - 0.5) * s, s * 0.7, s * 0.35, s * 0.7, r() * 6), false);
  }
  // Rounded hills emerging from the sea of clouds and distant snow mountains
  for (let i = 0; i < 7; i++) {
    const [x, z] = ringPos(58, 92, false);
    const s = 8 + r() * 7;
    b.add(new THREE.IcosahedronGeometry(1, 1), 0x7189b4, MS(x, -6, z, s, s * 0.75, s, r() * 6), false);
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + r() * 0.25;
    const d = 105 + r() * 45;
    const h = 20 + r() * 26;
    const w = h * (0.7 + r() * 0.5);
    const seg = 5 + Math.floor(r() * 3);
    const ry = r() * 6;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    b.add(new THREE.ConeGeometry(w, h, seg), 0x5f78ac, M(x, -8 + h / 2, z, ry), false);
    b.add(new THREE.ConeGeometry(w * 0.43, h * 0.42, seg), 0xf5f8ff, M(x, -8 + h - h * 0.21, z, ry), false);
  }
  // Sun
  b.glow(new THREE.SphereGeometry(5, 12, 8), 0xfff2c0, M(73, 139, 41));

  // High clouds in the sky
  const shellMat = cloudShellMaterial();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(172, 32, 16), shellMat);
  group.add(shell);

  // Floating stones (their own batch, the whole group undulating slowly)
  const isles = new THREE.Group();
  const ib = new PropBatch();
  const falls: THREE.BufferGeometry[] = [];
  const spots: [number, number, number, number, boolean][] = [
    [30, 0.5, -24, 2.4, true],
    [8, -1.5, -36, 1.7, false],
    [-18, 3, -30, 2.1, true],
    [40, 5, -6, 1.5, false],
    [-33, -0.5, -12, 1.9, true],
    [22, 9, -40, 1.3, false],
    [-6, 7, -48, 1.6, false],
    [36, 2, 20, 1.8, true],
    [-30, 7, 22, 1.4, false],
    [4, 3, 44, 1.6, false],
    [-44, 1, 4, 1.7, false],
    [46, 9, 30, 1.2, false],
  ];
  for (const [x, y, z, s, fall] of spots) island(ib, falls, x, y, z, s, r, fall);
  ib.build(isles);
  const fallMat = waterfallMaterial();
  const fallGeo = mergeGeometries(falls);
  if (fallGeo) isles.add(new THREE.Mesh(fallGeo, fallMat));
  group.add(isles);

  // Watchtower, windmill, banner rope
  const flags = new SoftGeo();
  const poleTop = watchtower(b, flags, 11.5, -14);
  const hub = windmill(b, -9, -14.5);
  const bladeMat = softMaterial('', 0.62);
  const blades = new THREE.Mesh(millBlades(), bladeMat);
  blades.position.set(hub[0], hub[1], hub[2]);
  blades.rotation.y = -Math.PI / 4;
  group.add(blades);
  // Banner rope: hanging from the watchtower's pole top to a separate wooden pole
  const post: V = [5.5, 0, -17];
  b.add(new THREE.CylinderGeometry(0.1, 0.13, 6.4, 6), 0x7a5a3c, M(post[0], 3.2, post[2]));
  b.add(new THREE.SphereGeometry(0.18, 6, 5), 0xf2c66a, M(post[0], 6.5, post[2]));
  const rope = new THREE.CatmullRomCurve3([
    new THREE.Vector3(poleTop[0], poleTop[1], poleTop[2]),
    new THREE.Vector3((poleTop[0] + post[0]) / 2, (poleTop[1] + 6.4) / 2 - 1.3, (poleTop[2] + post[2]) / 2),
    new THREE.Vector3(post[0], 6.4, post[2]),
  ]);
  b.add(new THREE.TubeGeometry(rope, 20, 0.035, 4), 0x5b4a3c, M(0, 0, 0), false);
  const flagCols = [0x3fb2c9, 0xf6f1e6, 0xf7c95c, 0x86d1e6, 0xf2a3b8];
  for (let i = 0; i < 8; i++) {
    const t = 0.1 + (i / 7) * 0.8;
    featherFlag(flags, rope.getPoint(t), rope.getTangent(t), new THREE.Color(flagCols[i % flagCols.length]), i * 1.3);
  }
  const flagMat = softMaterial(FLAG_SWAY, 0.62);
  group.add(new THREE.Mesh(flags.build(), flagMat));

  // Grass tufts, small flowers, wind-eroded stones and signposts on the platform
  const grass = new SoftGeo();
  for (let i = 0; i < 70; i++) {
    const [x, z] = ringPos(7.6, 17.5);
    grassTuft(grass, x, z, 0.8 + r() * 0.7, r);
  }
  const grassMat = softMaterial(GRASS_SWAY, 0.58);
  group.add(new THREE.Mesh(grass.build(), grassMat));
  const flowerCols = [0xfff6ec, 0xffe07a, 0xffc3d8];
  for (let i = 0; i < 110; i++) {
    const [x, z] = ringPos(6.8, 18, false);
    b.add(new THREE.CircleGeometry(0.11 + r() * 0.06, 6), flowerCols[Math.floor(r() * 3)], M(x, 0.05, z, 0, 1, -Math.PI / 2), false);
  }
  for (let i = 0; i < 4; i++) {
    const [x, z] = ringPos(11, 17);
    const s = 0.8 + r() * 0.6;
    for (let j = 0; j < 3; j++) {
      const g = new THREE.DodecahedronGeometry(0.6, 0);
      g.scale(0.65, 1.3, 0.55);
      b.add(g, 0x9b9285, M(x + j * 0.35 * s, (0.6 + j * 1.15) * s, z, r() * 6, s, 0, -0.28));
    }
  }
  for (let i = 0; i < 8; i++) {
    const [x, z] = ringPos(8, 17);
    b.add(new THREE.DodecahedronGeometry(1, 0), 0x9b9285, M(x, 0.25, z, r() * 6, 0.35 + r() * 0.35, r() * 0.5, r() * 0.5));
  }
  // The messenger's signpost
  b.add(new THREE.BoxGeometry(0.16, 2.3, 0.16), 0x7a5a3c, M(9.5, 1.15, -4.5));
  b.add(new THREE.BoxGeometry(1.25, 0.3, 0.08), 0xe9dcc2, M(9.8, 1.85, -4.5, 0.5));
  b.add(new THREE.BoxGeometry(1.1, 0.3, 0.08), 0xe9dcc2, M(9.25, 1.45, -4.5, -1.1));

  // Flock of birds: one mesh, the whole group circling the platform, with the wing tips flapping in the shader
  const birds = new SoftGeo();
  const birdCol = new THREE.Color(0x3a4660);
  for (let i = 0; i < 9; i++) {
    const a = 0.6 + i * 0.14 + r() * 0.1;
    const R = 38 + r() * 12;
    const y = 10 + r() * 7;
    const cx = Math.cos(a) * R, cz = Math.sin(a) * R;
    const hx = Math.sin(a), hz = -Math.cos(a);
    const s = 0.7 + r() * 0.5;
    const nose: V = [cx + hx * 0.4 * s, y, cz + hz * 0.4 * s];
    const tail: V = [cx - hx * 0.35 * s, y, cz - hz * 0.35 * s];
    const l: V = [cx + Math.cos(a) * 0.7 * s, y + 0.1, cz + Math.sin(a) * 0.7 * s];
    const rr: V = [cx - Math.cos(a) * 0.7 * s, y + 0.1, cz - Math.sin(a) * 0.7 * s];
    birds.tri(nose, l, tail, birdCol, [0, 1, 0], r() * 6);
    birds.tri(nose, tail, rr, birdCol, [0, 0, 1], r() * 6);
  }
  const birdMat = softMaterial(BIRD_FLAP, 0.85);
  const flock = new THREE.Mesh(birds.build(), birdMat);
  group.add(flock);

  // Wind streaks sweeping across the grass
  const decalMat = windDecalMaterial();
  const decal = new THREE.Mesh(new THREE.CircleGeometry(19.5, 48), decalMat);
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = 0.04;
  group.add(decal);

  disposers.push(() => {
    seaMat.dispose();
    shellMat.dispose();
    fallMat.dispose();
    bladeMat.dispose();
    flagMat.dispose();
    grassMat.dispose();
    birdMat.dispose();
    decalMat.dispose();
  });

  extras.push((dt, t, vfx) => {
    seaMat.uniforms.uTime.value = t;
    shellMat.uniforms.uTime.value = t;
    fallMat.uniforms.uTime.value = t;
    flagMat.uniforms.uTime.value = t;
    grassMat.uniforms.uTime.value = t;
    birdMat.uniforms.uTime.value = t;
    decalMat.uniforms.uTime.value = t;
    blades.rotation.z += dt * 0.75;
    flock.rotation.y += dt * 0.045;
    isles.position.y = Math.sin(t * 0.45) * 0.22;
    // Drifting fluff, feathers and wind streaks: all of them blow in from the windward side (−x)
    if (Math.random() < dt * 6) {
      vfx.emit({ pos: new THREE.Vector3(-22 + Math.random() * 10, 0.5 + Math.random() * 5, (Math.random() - 0.5) * 28), count: 1, color: [0xffffff, 0xf0faff], speed: [2.5, 4], dir: new THREE.Vector3(1, 0.15, 0.1), spread: 0.15, life: [5, 8], size: [0.12, 0.2], sizeEnd: 0.8, drag: 0, intensity: 1.0 });
    }
    if (Math.random() < dt * 1.5) {
      vfx.emit({ pos: new THREE.Vector3(-18 + Math.random() * 8, 3 + Math.random() * 5, (Math.random() - 0.5) * 24), count: 1, color: 0xffffff, speed: [2, 3.5], dir: new THREE.Vector3(1, -0.12, 0.05), spread: 0.1, life: [5, 7], size: [0.22, 0.3], sizeEnd: 1, gravity: 0.12, drag: 0.05, intensity: 0.9, atlas: 3, spin: 2.5 });
    }
    if (Math.random() < dt * 4) {
      vfx.emit({ pos: new THREE.Vector3(-24, 1.5 + Math.random() * 6, (Math.random() - 0.5) * 34), count: 1, color: 0xffffff, speed: [16, 22], dir: new THREE.Vector3(1, 0, 0.15), spread: 0.03, life: [1.8, 2.6], size: [0.25, 0.4], sizeEnd: 1, drag: 0, intensity: 0.55 });
    }
  });
}

export const highland: RegionModule = {
  palette: {
    sky: ['#3d8ee8', '#9dcdf8', '#dcebfa'],
    fog: 0xd6e6f8,
    fogNear: 55,
    fogFar: 190,
    ground: ['#8ac768', '#72b056', '#e8f6da'],
    light: [0.45, 0.85, 0.25],
    ambient: 0xb4cce4,
    rim: 0xffffff,
    shadow: 0x5878a8,
    motes: [0xffffff, 0xe6f6ff],
    moteKind: 'drift',
  },
  build,
};
