// Emberspine Volcanic Belt (fire): a dueling ground on a black-rock plain. At the left rear is an erupting volcano, with a lava river running down its flank, crossing the plain and gathering into a lava pool;
// at the right rear are the iron walls, gate, blast furnaces and chimneys of the forge city Red Iron Keep, and an iron-plate road crosses the lava bridge to the edge of the field.
// The ground has glowing cracks, basalt columns and sulfur crystals; embers and sparks rise, and there is heat haze over the lava.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, PropBatch, crystal, type ArenaCtx, type RegionModule } from '../arenaKit.ts';

const UP = new THREE.Vector3(0, 1, 0);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ───────────────────────── Lava ─────────────────────────

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }`;

const LAVA_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  attribute float aEdge; varying vec2 vUv; varying float vEdge;
  void main() {
    vUv = uv; vEdge = aEdge;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const LAVA_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime; varying vec2 vUv; varying float vEdge;
  ${NOISE}
  void main() {
    // uv.x runs along the flow: the pattern of the whole river slowly shifts downstream
    vec2 p = vec2(vUv.x * 1.5 - uTime * 0.22, vUv.y * 2.2);
    float n = noise(p * 1.6) * 0.55 + noise(p * 3.7 + 3.1 + uTime * 0.05) * 0.3 + noise(p * 8.0 - uTime * 0.15) * 0.15;
    // High noise values are dark cooled crust patches, with the brightest rim at the crust edge
    float crust = smoothstep(0.56, 0.62, n);
    float rimK = smoothstep(0.47, 0.56, n) * (1.0 - crust);
    // Bloom amplifies colors above 1, so the long lava stream on the mountainside must not be too bright or the whole area turns white
    vec3 hot = vec3(1.0, 0.36, 0.06) * 1.15;
    vec3 hotter = vec3(1.0, 0.72, 0.22) * 1.45;
    vec3 dark = vec3(0.10, 0.045, 0.04);
    vec3 c = mix(hot, hotter, smoothstep(0.2, 0.42, n));
    c = mix(c, hotter, rimK * 0.8);
    c = mix(c, dark, crust);
    // The river bank is a cooled black crust
    c = mix(c, dark * 1.6, smoothstep(0.72, 1.0, vEdge));
    gl_FragColor = vec4(c, 1.0);
    #ifdef USE_FOG
      // Lava glows by itself and fog only absorbs half of it, so distant lava is still visible
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(fogNear, fogFar, vFogDepth) * 0.45);
    #endif
  }`;

const HAZE_VERT = /* glsl */ `
  uniform float uTime; varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float k = uv.y;
    p.x += sin(uTime * 3.0 + position.z * 0.8 + k * 5.0) * k * 0.3;
    p.z += cos(uTime * 2.6 + position.x * 0.7 + k * 4.0) * k * 0.3;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const HAZE_FRAG = /* glsl */ `
  uniform float uTime; varying vec2 vUv;
  ${NOISE}
  void main() {
    float v = vUv.y;
    float w = noise(vec2(vUv.x * 2.5 + sin(v * 6.0 + uTime * 2.0) * 0.3, v * 3.0 - uTime * 1.1));
    float a = (1.0 - v) * (1.0 - v) * smoothstep(0.35, 0.75, w) * 0.32;
    gl_FragColor = vec4(vec3(1.0, 0.58, 0.28) * 1.3, a);
  }`;

const CRACK_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vW;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const CRACK_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime; varying vec2 vW;
  ${NOISE}
  vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
  // Voronoi cell edges: the difference between the second-nearest and nearest distances; near 0 is a crack
  float voro(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 rr = g + hash2(i + g) - f;
      float d = dot(rr, rr);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
    return sqrt(d2) - sqrt(d1);
  }
  void main() {
    float d = length(vW);
    // Two scales: cracks between large rock slabs, plus fine fragmentary cracking in places only
    float big = 1.0 - smoothstep(0.0, 0.06, voro(vW * 0.28 + 3.0));
    float fine = (1.0 - smoothstep(0.0, 0.05, voro(vW * 0.75))) * smoothstep(0.5, 0.65, noise(vW * 0.2 + 9.0));
    float line = max(big, fine);
    float sel = smoothstep(0.52, 0.7, noise(vW * 0.11 + 5.0));
    float pulse = 0.65 + 0.35 * sin(uTime * 1.4 + noise(vW * 0.15) * 6.28);
    // The battle area keeps only faint dark lines; glowing cracks appear only around the outside
    float mask = (0.08 + 0.92 * smoothstep(7.5, 13.0, d)) * (1.0 - smoothstep(27.0, 33.5, d));
    vec3 glow = vec3(1.0, 0.42, 0.08) * 1.7 * pulse;
    vec3 col = mix(vec3(0.05, 0.025, 0.025), glow, sel);
    gl_FragColor = vec4(col, line * mask * mix(0.35, 0.9, sel));
    #include <fog_fragment>
  }`;

/** Lay a ribbon mesh along a curve: three columns of vertices (left bank, center, right bank), uv.x along the flow, aEdge 0 at the center and 1 at the banks */
function ribbon(pts: THREE.Vector3[], width: (t: number) => number, segs: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const len = curve.getLength();
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const edge: number[] = [];
  const idx: number[] = [];
  const side = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    side.crossVectors(UP, tan);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const w = width(t) / 2;
    const u = (t * len) / 4;
    pos.push(p.x - side.x * w, p.y, p.z - side.z * w, p.x, p.y, p.z, p.x + side.x * w, p.y, p.z + side.z * w);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    uv.push(u, 0, u, 0.5, u, 1);
    edge.push(1, 0, 1);
    if (i < segs) {
      const b = i * 3;
      idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setIndex(idx);
  return g;
}

/** Stand up a thin curtain along a curve (for heat haze): the bottom edge hugs the river surface, uv.y rises to 1 */
function curtain(pts: THREE.Vector3[], h: number, segs: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const len = curve.getLength();
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const u = (t * len) / 4;
    pos.push(p.x, p.y + 0.15, p.z, p.x, p.y + 0.15 + h, p.z);
    uv.push(u, 0, u, 1);
    if (i < segs) {
      const b = i * 2;
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Lava pool: a fan shape, the outer ring is the bank (aEdge 1) and the center is the hottest magma; the outline is not a perfect circle */
function pool(cx: number, cz: number, R: number, y: number, phase: number): THREE.BufferGeometry {
  const N = 20;
  const pos: number[] = [cx, y, cz];
  const nor: number[] = [0, 1, 0];
  const uv: number[] = [cx * 0.2, cz * 0.2];
  const edge: number[] = [0];
  const idx: number[] = [];
  const rad = (a: number) => R * (1 + 0.15 * Math.sin(3 * a + phase) + 0.08 * Math.sin(7 * a + phase * 2));
  for (const [k, e] of [
    [0.6, 0.35],
    [1.0, 1.0],
  ] as const) {
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const rr = rad(a) * k;
      const x = cx + Math.cos(a) * rr;
      const z = cz + Math.sin(a) * rr;
      pos.push(x, y, z);
      nor.push(0, 1, 0);
      uv.push(x * 0.2, z * 0.2);
      edge.push(e);
    }
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    idx.push(0, 1 + j, 1 + i);
    idx.push(1 + i, 1 + j, 1 + N + i, 1 + j, 1 + N + j, 1 + N + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setIndex(idx);
  return g;
}

// ───────────────────────── Banners ─────────────────────────

const FLAG_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  attribute float aSway; uniform float uTime; varying float vShade;
  void main() {
    float w = sin(uTime * 3.8 - aSway * 5.0 + position.x * 0.7 + position.z * 0.5);
    vec3 p = position + normal * w * aSway * 0.28;
    vShade = 0.8 + 0.2 * w;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const FLAG_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  uniform vec3 uColor; varying float vShade;
  void main() {
    gl_FragColor = vec4(uColor * vShade, 1.0);
    #include <fog_fragment>
  }`;

/** Long banner hung from the top edge: aSway goes from 0 at the top edge to 1 at the hem */
function banner(w: number, h: number, m: THREE.Matrix4): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h, 2, 6);
  const p = g.attributes.position;
  const sway = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const s = (h / 2 - p.getY(i)) / h;
    sway[i] = s;
    // The hem narrows to a point
    if (s > 0.8) p.setX(i, p.getX(i) * (1 - (s - 0.8) * 4));
  }
  g.translate(0, -h / 2, 0);
  g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  g.deleteAttribute('uv');
  g.applyMatrix4(m);
  return g.toNonIndexed();
}

// ───────────────────────── Props ─────────────────────────

/** Basalt column group: several hexagonal columns of different heights packed together */
function basalt(b: PropBatch, x: number, z: number, s: number, r: () => number): void {
  const n = 4 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = i === 0 ? 0 : (0.6 + r() * 0.6) * s;
    const h = (0.6 + r() * 1.8) * s;
    const rad = (0.36 + r() * 0.16) * s;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    b.add(new THREE.CylinderGeometry(rad, rad, h, 6), i % 2 ? 0x3d3138 : 0x463840, M(px, h / 2, pz, r() * 6, 1, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12));
    b.add(new THREE.CylinderGeometry(rad * 0.98, rad * 0.98, 0.12, 6), 0x5a4a52, M(px, h + 0.02, pz, 0));
  }
}

/** Vent: a low black mound with a hole on top */
function vent(b: PropBatch, x: number, z: number): void {
  b.add(new THREE.CylinderGeometry(0.45, 1.1, 0.55, 8), 0x3a3036, M(x, 0.27, z));
  b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 8), 0x120c0e, M(x, 0.56, z), false);
}

/** Volcano height: the crater at radius 8, reaching the ground at radius 48 */
const VOLC_H = 30;
function flankY(rr: number): number {
  const t = Math.min(1, Math.max(0, (rr - 8) / 40));
  return VOLC_H * (1 - t);
}

/** Volcano: a large cone with a flattened summit, a shoulder peak, a few ridge lines at the foot; returns the crater center height */
function volcanoMountain(b: PropBatch, cx: number, cz: number, r: () => number): number {
  b.add(new THREE.CylinderGeometry(8, 48, VOLC_H, 16), 0x3a2a30, M(cx, VOLC_H / 2, cz, 0.2), false);
  b.add(new THREE.ConeGeometry(24, 22, 8), 0x2f2228, M(cx + 15, 11, cz + 10, 0.4), false);
  b.add(new THREE.ConeGeometry(18, 16, 7), 0x352730, M(cx - 22, 8, cz + 14, 1.1), false);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r() * 0.5;
    const d = 32 + r() * 8;
    b.add(new THREE.ConeGeometry(9 + r() * 6, 10 + r() * 8, 5), 0x40303a, M(cx + Math.cos(a) * d, 4, cz + Math.sin(a) * d, r() * 6, 1, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3), false);
  }
  b.add(new THREE.TorusGeometry(8.5, 1.8, 8, 16), 0x2a1c20, M(cx, VOLC_H + 0.2, cz, 0, 1, Math.PI / 2), false);
  return VOLC_H + 0.6;
}

/** Red Iron Keep: iron walls and battlements along an arc, a gatehouse, corner towers, blast furnaces and chimneys behind the wall; returns the position in front of the gate and the chimney top */
function ironhold(b: PropBatch, glow: PropBatch, r: () => number): { gate: THREE.Vector3; chimneys: THREE.Vector3[]; flags: THREE.Matrix4[] } {
  const R = 37;
  const a0 = -0.42;
  const a1 = -1.12;
  const at = (a: number, rr: number) => [Math.cos(a) * rr, Math.sin(a) * rr] as const;
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const a = a0 + ((i + 0.5) / segs) * (a1 - a0);
    const [x, z] = at(a, R);
    const ry = -a - Math.PI / 2;
    const len = (Math.abs(a1 - a0) * R) / segs + 0.3;
    b.add(new THREE.BoxGeometry(len, 5.5, 2.6), 0x4a3c42, M(x, 2.75, z, ry));
    // Horizontal seams of the iron plates
    b.add(new THREE.BoxGeometry(len + 0.1, 0.25, 2.75), 0x5e4e56, M(x, 1.9, z, ry));
    b.add(new THREE.BoxGeometry(len + 0.1, 0.25, 2.75), 0x5e4e56, M(x, 3.9, z, ry));
    // Battlements
    const k = Math.floor(len / 1.3);
    for (let j = 0; j < k; j++) {
      const t = (j + 0.5) / k - 0.5;
      const a2 = a + (t * len) / R;
      const [bx, bz] = at(a2, R);
      b.add(new THREE.BoxGeometry(0.75, 0.8, 2.7), 0x5a4a50, M(bx, 5.9, bz, -a2 - Math.PI / 2));
    }
  }
  // Gatehouse: a square tower in the middle of the wall, furnace fire showing through the gateway, an iron portcullis in front of the gate
  const ga = (a0 + a1) / 2;
  const [gx, gz] = at(ga, R + 0.4);
  const gry = -ga - Math.PI / 2;
  b.add(new THREE.BoxGeometry(7.5, 8, 4), 0x4a3c42, M(gx, 4, gz, gry));
  b.add(new THREE.BoxGeometry(7.7, 0.3, 4.2), 0x5e4e56, M(gx, 5.6, gz, gry));
  b.add(new THREE.BoxGeometry(8.2, 0.7, 4.6), 0x3a2e34, M(gx, 8.2, gz, gry));
  for (let j = -1; j <= 1; j += 2) b.add(new THREE.BoxGeometry(1.2, 1.2, 4.7), 0x5a4a50, M(gx + Math.cos(gry) * j * 3.2, 9.1, gz - Math.sin(gry) * j * 3.2, gry));
  const fx = -Math.cos(ga);
  const fz = -Math.sin(ga);
  const face = R + 0.4 - 2.0;
  const [dx, dz] = at(ga, face - 0.12);
  b.add(new THREE.BoxGeometry(3.4, 5.2, 0.25), 0x1a1014, M(dx, 2.6, dz, gry));
  const [lx, lz] = at(ga, face - 0.26);
  glow.glow(new THREE.BoxGeometry(2.7, 4.5, 0.1), 0xff8a2a, M(lx, 2.25, lz, gry));
  const [px, pz] = at(ga, face - 0.42);
  for (let j = -2; j <= 2; j++) b.add(new THREE.BoxGeometry(0.14, 4.6, 0.14), 0x1a1014, M(px + Math.cos(gry) * j * 0.55, 2.3, pz - Math.sin(gry) * j * 0.55, gry));
  b.add(new THREE.BoxGeometry(3.2, 0.14, 0.14), 0x1a1014, M(px, 3.2, pz, gry));
  // Corner tower (right end) and the breach at the wall's tail (left end)
  const [tx, tz] = at(a0, R);
  b.add(new THREE.CylinderGeometry(2.8, 3.1, 9, 10), 0x4a3c42, M(tx, 4.5, tz));
  b.add(new THREE.CylinderGeometry(3.3, 3.3, 0.5, 10), 0x5e4e56, M(tx, 9.2, tz));
  b.add(new THREE.ConeGeometry(3.3, 3.2, 10), 0x7a2a22, M(tx, 11, tz));
  for (let j = 0; j < 3; j++) {
    const a = ga + j * 2.1;
    glow.glow(new THREE.BoxGeometry(0.22, 0.9, 0.22), 0xff8a2a, M(tx + Math.cos(a) * 3.0, 6.5, tz + Math.sin(a) * 3.0));
  }
  const [ex, ez] = at(a1, R);
  b.add(new THREE.BoxGeometry(2.4, 3.2, 2.6), 0x4a3c42, M(ex, 1.6, ez, -a1 - Math.PI / 2 + 0.3));
  b.add(new THREE.DodecahedronGeometry(1.2, 0), 0x3a2e34, M(ex + 1.5, 0.7, ez + 1.2, r() * 6, 1, 0.3, 0.2));
  // Behind the wall: blast furnaces (big iron-banded furnaces with a ring of firelight around the waist) and three chimneys
  const [hx, hz] = at(ga + 0.16, R + 7);
  b.add(new THREE.CylinderGeometry(3.4, 3.9, 9, 12), 0x3a3036, M(hx, 4.5, hz));
  b.add(new THREE.SphereGeometry(3.9, 12, 8), 0x3a3036, M(hx, 5.5, hz));
  for (const y of [2.2, 4.4, 7.4]) b.add(new THREE.TorusGeometry(3.95, 0.22, 6, 14), 0x5e4e56, M(hx, y, hz, 0, 1, Math.PI / 2));
  glow.glow(new THREE.TorusGeometry(3.7, 0.28, 6, 14), 0xff7a2a, M(hx, 3.3, hz, 0, 1, Math.PI / 2));
  b.add(new THREE.CylinderGeometry(1.3, 1.7, 8, 10), 0x2e262c, M(hx, 13, hz));
  const chimneys = [new THREE.Vector3(hx, 17.2, hz)];
  glow.glow(new THREE.TorusGeometry(1.25, 0.22, 6, 12), 0xff7a2a, M(hx, 17, hz, 0, 1, Math.PI / 2));
  for (const [da, dr, h] of [
    [-0.12, 6, 12],
    [0.3, 9, 15],
  ] as const) {
    const [cx, cz] = at(ga + da, R + dr);
    b.add(new THREE.CylinderGeometry(0.9, 1.3, h, 8), 0x2e262c, M(cx, h / 2, cz));
    b.add(new THREE.CylinderGeometry(1.35, 1.35, 0.5, 8), 0x5e4e56, M(cx, h - 0.8, cz));
    glow.glow(new THREE.TorusGeometry(0.85, 0.18, 6, 10), 0xff7a2a, M(cx, h + 0.02, cz, 0, 1, Math.PI / 2));
    chimneys.push(new THREE.Vector3(cx, h + 0.2, cz));
  }
  // Banners: one on each side of the gate and one on the corner tower
  const flags: THREE.Matrix4[] = [];
  for (const j of [-1, 1]) {
    const [bx, bz] = at(ga, face - 0.6);
    const ox = Math.cos(gry) * j * 3.0;
    const oz = -Math.sin(gry) * j * 3.0;
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 4), 0x1a1014, M(bx + ox, 7.9, bz + oz, 0, 1, 0, 0));
    flags.push(M(bx + ox, 8.9, bz + oz, gry));
  }
  b.add(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 4), 0x1a1014, M(tx, 13.8, tz));
  flags.push(M(tx + 0.5, 15.2, tz, gry));
  b.add(new THREE.BoxGeometry(1.0, 0.05, 0.05), 0x1a1014, M(tx + 0.5, 15.2, tz, gry));
  return { gate: new THREE.Vector3(gx + fx * 2.6, 0, gz + fz * 2.6), chimneys, flags };
}

// ───────────────────────── Arena ─────────────────────────

const VOLC = new THREE.Vector2(-14, -92);

export const volcano: RegionModule = {
  palette: {
    sky: ['#1a0810', '#7a2418', '#ff8a3a'],
    fog: 0x5a2018,
    fogNear: 28,
    fogFar: 150,
    ground: ['#3a3034', '#221a1e', '#ff7a2a'],
    light: [0.35, 0.8, 0.4],
    ambient: 0x9a6a5a,
    rim: 0xffb070,
    shadow: 0x5a2a34,
    motes: [0xff7a2a, 0xffc040],
    moteKind: 'rise',
  },
  build(ctx: ArenaCtx) {
    const { group, b, r, extras, disposers } = ctx;

    // A point on the mountainside: walk in direction (ux,uz) to radius rr, offset sideways by k so the lava flow winds slightly, raised by 0.5 so it does not sink into the mountain
    const flankPt = (ux: number, uz: number, rr: number, k = 0) => V(VOLC.x + ux * rr - uz * k, flankY(rr) + 0.5, VOLC.y + uz * rr + ux * k);
    // Right river: flows down the mountainside from the crater, crosses the plain, passes the iron bridge in front of Red Iron Keep's gate, and flows into the lava pool on the east side
    const riverR = [flankPt(0.55, 0.83, 8), flankPt(0.55, 0.83, 18, 2.5), flankPt(0.55, 0.83, 30, -2), flankPt(0.55, 0.83, 40, 1.5), flankPt(0.55, 0.83, 47.5), V(12.4, 0.08, -52), V(10.5, 0.08, -44), V(13, 0.08, -35), V(15.5, 0.08, -27), V(17.5, 0.08, -19), V(16.5, 0.08, -11), V(19.5, 0.08, -4), V(24, 0.08, 2), V(28, 0.08, 7)];
    // Left river: flows down the other side of the mountain and goes around the west side of the field
    const riverL = [flankPt(-0.5, 0.87, 8), flankPt(-0.5, 0.87, 20, -2), flankPt(-0.5, 0.87, 32, 2.2), flankPt(-0.5, 0.87, 42, -1), flankPt(-0.5, 0.87, 47.5), V(-38, 0.08, -50), V(-34, 0.08, -40), V(-30, 0.08, -30), V(-24, 0.08, -22), V(-20, 0.08, -12), V(-19, 0.08, -2), V(-22, 0.08, 8), V(-28, 0.08, 16)];
    const lavaMat = new THREE.ShaderMaterial({ fog: true, uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } }, vertexShader: LAVA_VERT, fragmentShader: LAVA_FRAG, side: THREE.DoubleSide });
    const lavaGeo = mergeGeometries([
      ribbon(riverR, (t) => (t < 0.3 ? 1.6 + t * 2 : 3.2 + Math.sin(t * 9) * 0.6), 90),
      ribbon(riverL, (t) => (t < 0.3 ? 1.5 + t * 2 : 2.8 + Math.sin(t * 7) * 0.5), 80),
      pool(31, 10, 4.4, 0.08, 1.2),
      pool(-30, 18, 4.0, 0.08, 2.9),
      pool(VOLC.x, VOLC.y, 6.4, VOLC_H + 0.6, 0.4),
    ]);
    if (lavaGeo) {
      const lava = new THREE.Mesh(lavaGeo, lavaMat);
      group.add(lava);
    }
    // Heat haze: a translucent writhing curtain above the plain section of the lava river
    const hazeMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: HAZE_VERT, fragmentShader: HAZE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    const hazeGeo = mergeGeometries([curtain(riverR.slice(5), 3.2, 60), curtain(riverL.slice(5), 3.0, 50)]);
    if (hazeGeo) {
      const haze = new THREE.Mesh(hazeGeo, hazeMat);
      haze.renderOrder = 3;
      group.add(haze);
    }
    // Glowing cracks in the ground
    const crackMat = new THREE.ShaderMaterial({ fog: true, uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } }, vertexShader: CRACK_VERT, fragmentShader: CRACK_FRAG, transparent: true, depthWrite: false });
    const cracks = new THREE.Mesh(new THREE.RingGeometry(3.5, 33.8, 64, 4), crackMat);
    cracks.rotation.x = -Math.PI / 2;
    cracks.position.y = 0.035;
    cracks.renderOrder = -4;
    group.add(cracks);

    // Sample points along the plain section of the lava river: embers rise from these places
    const emberPts: THREE.Vector3[] = [];
    for (const river of [riverR, riverL]) {
      const c = new THREE.CatmullRomCurve3(river.slice(4), false, 'centripetal');
      emberPts.push(...c.getPoints(30));
    }
    const nearRiver = (x: number, z: number, d: number) => emberPts.some((p) => Math.hypot(p.x - x, p.z - z) < d);

    // Volcano, distant mountains, clouds
    const craterY = volcanoMountain(b, VOLC.x, VOLC.y, r);
    const crater = new THREE.Vector3(VOLC.x, craterY, VOLC.y);
    const volcA = Math.atan2(VOLC.y, VOLC.x);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + r() * 0.3;
      let da = Math.abs(a - volcA);
      if (da > Math.PI) da = Math.PI * 2 - da;
      if (da < 0.55) continue;
      const d = 108 + r() * 40;
      const h = 14 + r() * 22;
      b.add(new THREE.ConeGeometry(14 + r() * 14, h, 6), i % 2 ? 0x2c1e24 : 0x33232a, M(Math.cos(a) * d, h / 2 - 1, Math.sin(a) * d, r() * 6), false);
    }
    // The second volcano in the distance: only a red dot is visible
    b.add(new THREE.CylinderGeometry(3, 26, 24, 8), 0x2c1e24, M(84, 11, -104), false);
    b.glow(new THREE.CircleGeometry(2.8, 10).rotateX(-Math.PI / 2), 0xff5a10, M(84, 23.2, -104));
    const cloudBatch = new PropBatch();
    const puff = (x: number, y: number, z: number, s: number, col: number) => {
      const n = 4 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const k = i - (n - 1) / 2;
        const rad = s * (1.6 + r() * 0.8) * (1 - (Math.abs(k) / n) * 0.7);
        const g = new THREE.IcosahedronGeometry(rad, 1);
        g.scale(1, 0.55, 1);
        cloudBatch.add(g, col, M(x + k * 1.9 * s, y + rad * 0.2, z + (r() - 0.5) * 1.2 * s), false);
      }
    };
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + r() * 0.5;
      const d = 60 + r() * 55;
      puff(Math.cos(a) * d, 16 + r() * 14, Math.sin(a) * d, 1.3 + r() * 1.2, 0x3a262c);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + r() * 0.7;
      const d = 110 + r() * 35;
      puff(Math.cos(a) * d, 3 + r() * 5, Math.sin(a) * d, 1.6 + r() * 1.4, 0x4a2a28);
    }
    const clouds = new THREE.Group();
    cloudBatch.build(clouds);
    group.add(clouds);

    // Red Iron Keep and its furnace fire (flickering)
    const fire = new PropBatch();
    const hold = ironhold(b, fire, r);
    const fireGroup = new THREE.Group();
    fire.build(fireGroup);
    group.add(fireGroup);
    const fireMats: THREE.MeshBasicMaterial[] = [];
    fireGroup.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (m && m.isMeshBasicMaterial) fireMats.push(m);
    });
    // The iron-plate road in front of the gate, the iron bridge across the lava river, reaching the edge of the field
    const roadA = hold.gate.clone();
    const roadB = V(7.6, 0, -7.5);
    const roadDir = roadB.clone().sub(roadA);
    const roadLen = roadDir.length();
    roadDir.normalize();
    const roadRy = Math.atan2(roadDir.x, roadDir.z);
    // The bridge is placed where the road meets the right river
    let bridge = roadA.clone();
    let best = 1e9;
    for (let s = 0; s < roadLen; s += 0.25) {
      const p = roadA.clone().addScaledVector(roadDir, s);
      for (const q of emberPts) {
        const d = Math.hypot(p.x - q.x, p.z - q.z);
        if (d < best) {
          best = d;
          bridge = p;
        }
      }
    }
    for (let s = 1; s < roadLen - 1; s += 1.7) {
      const p = roadA.clone().addScaledVector(roadDir, s);
      if (Math.hypot(p.x - bridge.x, p.z - bridge.z) < 3.6) continue;
      b.add(new THREE.BoxGeometry(2.2, 0.06, 1.5), Math.floor(s / 1.7) % 2 ? 0x2e262c : 0x362c32, M(p.x, 0.03, p.z, roadRy), false);
      b.add(new THREE.BoxGeometry(0.1, 0.03, 1.4), 0x4a3c42, M(p.x, 0.07, p.z, roadRy), false);
    }
    b.add(new THREE.BoxGeometry(3.2, 0.4, 7.2), 0x3a3036, M(bridge.x, 0.55, bridge.z, roadRy));
    b.add(new THREE.BoxGeometry(3.4, 0.12, 7.4), 0x5e4e56, M(bridge.x, 0.8, bridge.z, roadRy));
    for (const j of [-1, 1]) {
      const ox = Math.cos(roadRy) * j * 1.5;
      const oz = -Math.sin(roadRy) * j * 1.5;
      b.add(new THREE.BoxGeometry(0.22, 0.7, 7.2), 0x2a2226, M(bridge.x + ox, 1.15, bridge.z + oz, roadRy));
      for (const k of [-3, 0, 3]) {
        const px = bridge.x + ox + roadDir.x * k;
        const pz = bridge.z + oz + roadDir.z * k;
        b.add(new THREE.BoxGeometry(0.3, 1.3, 0.3), 0x2a2226, M(px, 1.0, pz, roadRy));
        b.glow(new THREE.SphereGeometry(0.12, 6, 5), 0xff7a2a, M(px, 1.75, pz));
      }
    }
    // Anvil monument by the road
    const anvilP = roadA.clone().addScaledVector(roadDir, roadLen - 3.5).add(V(Math.cos(roadRy) * 2.4, 0, -Math.sin(roadRy) * 2.4));
    b.add(new THREE.BoxGeometry(1.8, 0.9, 1.8), 0x4a3c42, M(anvilP.x, 0.45, anvilP.z, roadRy));
    b.add(new THREE.BoxGeometry(1.0, 0.5, 0.6), 0x2a2226, M(anvilP.x, 1.15, anvilP.z, roadRy));
    b.add(new THREE.BoxGeometry(1.7, 0.2, 0.7), 0x2a2226, M(anvilP.x, 1.5, anvilP.z, roadRy));
    b.add(new THREE.ConeGeometry(0.3, 0.7, 6), 0x2a2226, M(anvilP.x + Math.sin(roadRy) * 1.1, 1.5, anvilP.z + Math.cos(roadRy) * 1.1, roadRy, 1, Math.PI / 2));

    // Banners (one mesh)
    const flagMat = new THREE.ShaderMaterial({ fog: true, side: THREE.DoubleSide, uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uColor: { value: new THREE.Color(0xc23a2a) } }, vertexShader: FLAG_VERT, fragmentShader: FLAG_FRAG });
    const flagGeo = mergeGeometries(hold.flags.map((m, i) => banner(i === 2 ? 1.0 : 1.4, i === 2 ? 2.2 : 3.0, m)));
    if (flagGeo) group.add(new THREE.Mesh(flagGeo, flagMat));

    // Props placement: avoid the lava rivers, the iron-plate road, the castle and the display camera's walkway
    const roadDist = (x: number, z: number) => {
      const t = Math.min(roadLen, Math.max(0, (x - roadA.x) * roadDir.x + (z - roadA.z) * roadDir.z));
      return Math.hypot(roadA.x + roadDir.x * t - x, roadA.z + roadDir.z * t - z);
    };
    const spot = (rMin: number, rMax: number, gap: number): readonly [number, number] => {
      for (let i = 0; i < 60; i++) {
        const [x, z] = ctx.ringPos(rMin, rMax);
        const a = Math.atan2(z, x);
        if (nearRiver(x, z, gap)) continue;
        if (roadDist(x, z) < gap) continue;
        if (Math.hypot(x, z) > 30 && a < -0.3 && a > -1.3) continue;
        if (Math.abs(x) < 3.5 && z > 4) continue;
        return [x, z];
      }
      return ctx.ringPos(rMin, rMax);
    };
    for (let i = 0; i < 9; i++) {
      const [x, z] = spot(9, 28, 4);
      basalt(b, x, z, 0.6 + r() * 0.7, r);
    }
    for (let i = 0; i < 10; i++) {
      const [x, z] = spot(11, 32, 3.5);
      const h = 1.5 + r() * 2.2;
      b.add(new THREE.ConeGeometry(0.6 + r() * 0.7, h, 6), 0x3f2f30, M(x, h / 2 - 0.2, z, r() * 6, 1, (r() - 0.5) * 0.25, (r() - 0.5) * 0.25));
    }
    for (let i = 0; i < 16; i++) {
      const [x, z] = spot(7.5, 26, 3);
      b.add(new THREE.DodecahedronGeometry(1, 0), i % 2 ? 0x30262a : 0x3a2d30, M(x, 0.3 * (0.5 + r()), z, r() * 6, 0.4 + r() * 0.7, r() * 0.5, r() * 0.5));
    }
    for (let i = 0; i < 8; i++) {
      const [x, z] = spot(29, 42, 3);
      b.add(new THREE.DodecahedronGeometry(1, 0), 0x30262a, M(x, 0.8, z, r() * 6, 1.4 + r() * 1.6, r() * 0.5, r() * 0.5));
    }
    const vents: THREE.Vector3[] = [];
    for (let i = 0; i < 4; i++) {
      const [x, z] = spot(9, 17, 2.5);
      vent(b, x, z);
      vents.push(V(x, 0.6, z));
      crystal(b, x + 1.2, z + 0.6, 0.55, 0xc8a028, r);
    }
    for (let i = 0; i < 5; i++) {
      const [x, z] = spot(10, 24, 2);
      crystal(b, x, z, 0.5 + r() * 0.5, 0xd8b030, r);
    }
    // Rubble near the battle area and scorched ground decals
    for (let i = 0; i < 24; i++) {
      const a = r() * Math.PI * 2;
      const d = 6 + r() * 6;
      b.add(new THREE.DodecahedronGeometry(0.1 + r() * 0.1, 0), 0x241c20, M(Math.cos(a) * d, 0.06, Math.sin(a) * d, r() * 6, 1, r(), r()));
    }
    for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2;
      const d = 7 + r() * 5;
      const g = new THREE.CircleGeometry(0.9 + r() * 0.8, 10).rotateX(-Math.PI / 2);
      g.scale(1.3, 1, 0.9);
      b.add(g, 0x1e1618, M(Math.cos(a) * d, 0.012, Math.sin(a) * d, r() * 6), false);
    }

    disposers.push(() => {
      lavaMat.dispose();
      hazeMat.dispose();
      crackMat.dispose();
      flagMat.dispose();
    });

    // Dynamics: shader time, furnace flicker, clouds drifting; particles: smoke and sparks from the crater, chimney smoke, lava embers and heat, vent steam, falling ash
    const timers = { smoke: 0, spark: 0, chimney: 0, ember: 0, heat: 0, vent: 0, ash: 0 };
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const smokeDir = new THREE.Vector3(0.18, 1, 0.05);
    const chimneyDir = new THREE.Vector3(0.3, 1, 0.1);
    const down = new THREE.Vector3(0, -1, 0);
    const fireCol = new THREE.Color();
    extras.push((dt, t, vfx) => {
      lavaMat.uniforms.uTime.value = t;
      hazeMat.uniforms.uTime.value = t;
      crackMat.uniforms.uTime.value = t;
      flagMat.uniforms.uTime.value = t;
      clouds.rotation.y = t * 0.003;
      const k = 1.9 + 0.35 * Math.sin(t * 7.3) + 0.2 * Math.sin(t * 13.1) + 0.1 * Math.sin(t * 29.7);
      fireCol.setRGB(1.0, 0.55, 0.2).multiplyScalar(k);
      for (const m of fireMats) m.color.copy(fireCol);
      timers.smoke += dt;
      while (timers.smoke > 0.12) {
        timers.smoke -= 0.12;
        vfx.smoke({ pos: crater, count: 1, color: [0x2a1e22, 0x3a2a2e, 0x4a3438], speed: [2.5, 4.5], dir: smokeDir, spread: 0.25, life: [6, 9], size: [5, 8], sizeEnd: 2.6, gravity: -0.15, drag: 0.35, radius: 2.5 });
      }
      timers.spark += dt;
      while (timers.spark > 0.22) {
        timers.spark -= 0.22;
        vfx.emit({ pos: crater, count: 3, color: [0xff6a1a, 0xffc040], speed: [5, 11], dir: up, spread: 0.45, life: [1.5, 3], size: [0.6, 1.2], gravity: 4, drag: 0.3, radius: 2 });
      }
      timers.chimney += dt;
      while (timers.chimney > 0.16) {
        timers.chimney -= 0.16;
        const c = hold.chimneys[Math.floor(Math.random() * hold.chimneys.length)];
        vfx.smoke({ pos: c, count: 1, color: [0x4a3a40, 0x5a4a50], speed: [1.2, 2.2], dir: chimneyDir, spread: 0.2, life: [4, 6], size: [1.4, 2.4], sizeEnd: 2.2, gravity: -0.1, drag: 0.3, radius: 0.4 });
        if (Math.random() < 0.5) vfx.emit({ pos: c, count: 1, color: [0xff8a2a, 0xffd060], speed: [1.5, 3], dir: up, spread: 0.5, life: [0.8, 1.6], size: [0.25, 0.45], gravity: 2, drag: 0.5, radius: 0.5 });
      }
      timers.ember += dt;
      while (timers.ember > 0.09) {
        timers.ember -= 0.09;
        const q = emberPts[Math.floor(Math.random() * emberPts.length)];
        p.set(q.x + (Math.random() - 0.5) * 2, q.y + 0.15, q.z + (Math.random() - 0.5) * 2);
        vfx.emit({ pos: p, count: 1, color: [0xff7a2a, 0xffc040, 0xff5a1a], speed: [0.5, 1.4], dir: up, spread: 0.35, life: [2, 3.5], size: [0.1, 0.22], sizeEnd: 0.3, gravity: -0.25, drag: 0.2, intensity: 2.2 });
      }
      timers.heat += dt;
      while (timers.heat > 0.3) {
        timers.heat -= 0.3;
        const q = emberPts[Math.floor(Math.random() * emberPts.length)];
        p.set(q.x, q.y + 0.4, q.z);
        vfx.emit({ pos: p, count: 1, color: 0xff8a3a, speed: [0.8, 1.4], dir: up, spread: 0.15, life: [1.5, 2.5], size: [1.6, 2.6], sizeEnd: 1.6, drag: 0.1, intensity: 0.28 });
      }
      timers.vent += dt;
      while (timers.vent > 0.28) {
        timers.vent -= 0.28;
        const q = vents[Math.floor(Math.random() * vents.length)];
        vfx.smoke({ pos: q, count: 1, color: [0xd8ccc8, 0xc8b8b8], speed: [1, 2], dir: up, spread: 0.25, life: [1.5, 2.5], size: [0.7, 1.3], sizeEnd: 2.4, gravity: -0.2, drag: 0.6, radius: 0.15 });
      }
      timers.ash += dt;
      while (timers.ash > 0.18) {
        timers.ash -= 0.18;
        p.set((Math.random() - 0.5) * 30, 7 + Math.random() * 3, (Math.random() - 0.5) * 22);
        vfx.smoke({ pos: p, count: 1, color: [0x6a5a5e, 0x8a7a7e], speed: [0.3, 0.6], dir: down, spread: 0.4, life: [5, 8], size: [0.12, 0.22], sizeEnd: 0.8, drag: 0.1 });
      }
    });
  },
};
