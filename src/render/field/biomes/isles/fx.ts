// Shaders and moving things of the Tidesong Isles field: the sea surface (replacing the default water's fragment shader),
// the seabed, vertex-color toon batches (rocking boats and floating ice),
// flags, seagulls, the lighthouse beam, hot spring and pool surfaces, waterfalls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M } from '../../../arenaKit.ts';
import { LIGHT } from '../../../toon.ts';
import { inkScenery } from '../../../ink.ts';
import { sceneVC } from '../../vbatch.ts';
import type { FieldCtx } from '../../kit.ts';

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
`;

// ───────────────────────── Sea surface ─────────────────────────

/**
 * The archipelago's sea: shallow water reveals the sandy bottom and a caustic web, the middle is turquoise,
 * the open sea deep blue; further north it grows colder (gray-blue).
 * Wave-crest highlights and sun glints are drawn only near the camera (they turn into noise in the distance),
 * and the shore gets a thin ring of foam plus a back-and-forth shore break.
 */
const OCEAN_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  uniform sampler2D uH; uniform float uSize; uniform float uLevel; uniform float uRange;
  uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam; uniform float uTime;
  uniform vec3 uMid; uniform vec3 uShallowC; uniform vec3 uMidC; uniform vec3 uDeepC; uniform vec3 uCrest; uniform vec3 uCrestC; uniform vec3 uCaustic;
  varying vec3 vWorld;
  ${NOISE}
  void main() {
    vec2 uv = (vWorld.xz + uSize) / (2.0 * uSize);
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    float ground = mix(0.0, texture2D(uH, clamp(uv, 0.0, 1.0)).r, inside);
    float depth = max(0.0, (uLevel - ground) * uRange);
    vec2 p = vWorld.xz;
    float dist = length(cameraPosition.xz - p);
    float near = 1.0 - smoothstep(35.0, 120.0, dist);
    float cold = smoothstep(-22.0, -75.0, p.y + (vnoise(p * 0.03) - 0.5) * 20.0);
    vec3 shallow = mix(uShallow, uShallowC, cold);
    vec3 mid = mix(uMid, uMidC, cold);
    vec3 deep = mix(uDeep, uDeepC, cold);
    vec3 col = mix(shallow, mid, smoothstep(0.2, 1.7, depth));
    col = mix(col, deep, smoothstep(1.7, 3.9, depth));
    // The open sea is a little deeper
    col *= 1.0 - 0.18 * smoothstep(90.0, 200.0, length(p));
    // Wave crests: two layers of diagonal sines, keeping only the peaks
    float w1 = sin(p.x * 0.33 + p.y * 0.21 + uTime * 1.05 + vnoise(p * 0.07) * 6.0) + sin(p.x * 0.15 - p.y * 0.38 - uTime * 0.8);
    float w2 = sin(p.x * 0.78 - p.y * 0.55 + uTime * 1.6 + vnoise(p * 0.21 + uTime * 0.05) * 4.0);
    float crest = smoothstep(1.4, 1.75, w1) * 0.5 + smoothstep(0.9, 1.0, w2) * 0.28;
    col += mix(uCrest, uCrestC, cold) * crest * near * smoothstep(0.3, 2.2, depth);
    // Caustic net in the shallows
    float ca = sin(p.x * 1.25 + uTime * 0.7 + sin(p.y * 0.9)) * sin(p.y * 1.15 - uTime * 0.6 + sin(p.x * 0.7)) + sin((p.x + p.y) * 0.85 + uTime * 0.4);
    col += uCaustic * smoothstep(0.85, 1.3, ca) * 0.28 * (1.0 - smoothstep(0.15, 1.9, depth)) * near * (1.0 - cold * 0.6);
    // Sunlight shards: tiny, sparse, twinkling
    vec2 gc = floor(p * 1.6);
    float gl = step(0.992, hash(gc + floor(uTime * 2.2 + hash(gc) * 7.0) * 0.37));
    vec2 gf = (fract(p * 1.6) - 0.5) * vec2(1.0, 2.6);
    gl *= 1.0 - smoothstep(0.06, 0.14, length(gf));
    col += vec3(1.0, 0.95, 0.8) * gl * 0.6 * near * smoothstep(0.8, 2.5, depth);
    // Shore foam: a ring of fine waves hugging the waterline, broken up by noise; farther out a broken wave that surges back and forth
    float n1 = vnoise(p * 0.9 + uTime * 0.3);
    float edge = depth + (n1 - 0.5) * 0.09;
    float foam = 1.0 - smoothstep(0.015, 0.09, edge);
    // The broken waves land in water deeper than the wading sandbar (20 cm underwater) so the sandbar itself does not turn white all over
    float surf = 0.42 + 0.1 * sin(uTime * 0.9 + p.x * 0.05 + p.y * 0.04);
    float foam2 = smoothstep(surf - 0.04, surf, edge) * (1.0 - smoothstep(surf, surf + 0.06, edge)) * smoothstep(0.35, 0.6, vnoise(p * 0.55 - uTime * 0.2));
    float f = clamp(foam + foam2 * 0.5 * (1.0 - smoothstep(0.55, 0.8, depth)), 0.0, 1.0);
    col = mix(col, uFoam, f * 0.92);
    float alpha = mix(0.5, 1.0, smoothstep(0.05, 2.6, depth));
    alpha = max(alpha, f * 0.9);
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
  }`;

/**
 * Replace the default water surface with the archipelago's sea (leave it alone if not found), and lay a dark seabed around
 * the map's outer edge, so the transparent sea does not show the sky through it
 */
export function ocean(ctx: FieldCtx): void {
  const water = ctx.water;
  if (water) {
    const mat = water.material as THREE.ShaderMaterial;
    // Colors are always passed in as THREE.Color (converted to linear color, consistent with other materials)
    const col = (h: number) => ({ value: new THREE.Color(h) });
    Object.assign(mat.uniforms, {
      uMid: col(0x1aa6d6),
      uShallowC: col(0x62bcd4),
      uMidC: col(0x3a86b0),
      uDeepC: col(0x1d5a88),
      uCrest: col(0x6fb2d4),
      uCrestC: col(0x8aaec4),
      uCaustic: col(0xc8ffff),
    });
    mat.fragmentShader = OCEAN_FRAG;
    mat.needsUpdate = true;
  }
  const S = ctx.layout.size;
  const bedMat = new THREE.MeshBasicMaterial({ color: 0x0c3860 });
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(S * 6, S * 6), bedMat);
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = -7.6;
  ctx.group.add(bed);
  ctx.disposers.push(() => {
    bed.geometry.dispose();
    bedMat.dispose();
  });
}

// ───────────────────────── Vertex-color toon batch ─────────────────────────
// Moving props (fishing boats, the black-sailed ship, floating ice) would blow up the mesh count if split into several
// meshes by color; instead the color is written into the vertices, and parts with the same rocking phase are merged into one mesh.
// The rocking is a displacement of the whole mesh (not a vertex shader), so that the post-process outline's normal pass can
// keep up; the phase is quantized into BOB_BINS cells, giving a batch at most BOB_BINS + 1 meshes.

const TAU = Math.PI * 2;
const BOB_BINS = 10;

export class ColorBatch {
  /** Rocking-phase cell -> geometry; -1 is not rocking */
  private parts = new Map<number, THREE.BufferGeometry[]>();
  lift = 0;
  /** Parts added afterward rock with this phase (< 0 means no rocking) */
  bob = -1;
  add(geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(this.lift ? new THREE.Matrix4().makeTranslation(0, this.lift, 0).multiply(m) : m);
    const n = g.attributes.position.count;
    const c = new THREE.Color(color);
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    const key = this.bob < 0 ? -1 : Math.round((((this.bob % TAU) + TAU) % TAU) / TAU * BOB_BINS) % BOB_BINS;
    const list = this.parts.get(key);
    if (list) list.push(g);
    else this.parts.set(key, [g]);
  }
  get empty(): boolean {
    return this.parts.size === 0;
  }
  /** Merge into meshes (with outline > 0 it goes through the post-process outline); returns a function that updates time */
  build(parent: THREE.Object3D, disposers: (() => void)[], outline = 0.05): { group: THREE.Group; tick: (t: number) => void } {
    const group = new THREE.Group();
    const mat = sceneVC();
    const merged: THREE.BufferGeometry[] = [];
    const bobbing: { mesh: THREE.Mesh; ph: number }[] = [];
    for (const [key, list] of this.parts) {
      const geo = mergeGeometries(list);
      if (!geo) continue;
      merged.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      if (key >= 0) bobbing.push({ mesh, ph: (key / BOB_BINS) * TAU });
    }
    this.parts.clear();
    if (outline > 0) inkScenery(group);
    parent.add(group);
    disposers.push(() => {
      for (const g of merged) g.dispose();
      mat.dispose();
    });
    return {
      group,
      tick: (t) => {
        for (const { mesh, ph } of bobbing) mesh.position.y = Math.sin(t * 1.3 + ph) * 0.07 + Math.sin(t * 0.7 + ph * 1.7) * 0.04;
      },
    };
  }
}

// ───────────────────────── Flags ─────────────────────────

/** Flag geometry: the larger aSway is, the more it sways; hang hangs from the top edge (bunting), otherwise from the left edge (pennants, sails) */
export function flagGeo(len: number, h: number, color: number, hang: boolean, pennant: boolean, m: THREE.Matrix4, tatter = 0): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(len, h, hang ? 2 : 8, hang ? 4 : 3);
  const p = g.attributes.position;
  const sway = new Float32Array(p.count);
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const s = hang ? (h / 2 - y) / h : (x + len / 2) / len;
    sway[i] = s;
    if (pennant) p.setY(i, y * (1 - 0.85 * s));
    if (hang) p.setX(i, x * (1 - 0.8 * s));
    // A tattered flag: the trailing end is ragged
    if (tatter > 0 && s > 0.7) p.setX(i, p.getX(i) - Math.abs(Math.sin(y * 9.1 + x * 3.3)) * tatter * len * (s - 0.7) * 3);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.translate(hang ? 0 : len / 2, hang ? -h / 2 : 0, 0);
  g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  g.applyMatrix4(m);
  return g.index ? g.toNonIndexed() : g;
}

const FLAG_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  attribute float aSway; uniform float uTime; varying vec3 vColor; varying float vShade;
  void main() {
    vColor = color;
    float w = sin(uTime * 4.5 - aSway * 5.0 + position.x * 0.7 + position.z * 0.5);
    vec3 p = position + normal * w * aSway * 0.22 + vec3(0.0, 1.0, 0.0) * sin(uTime * 3.1 - aSway * 4.0) * aSway * 0.06;
    vShade = 0.82 + 0.18 * w;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const FLAG_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  varying vec3 vColor; varying float vShade;
  void main() {
    gl_FragColor = vec4(vColor * vShade, 1.0);
    #include <fog_fragment>
  }`;

/** Merge all the flags into one fluttering mesh */
export function flags(ctx: FieldCtx, geos: THREE.BufferGeometry[]): void {
  if (!geos.length) return;
  const mat = new THREE.ShaderMaterial({ fog: true, side: THREE.DoubleSide, vertexColors: true, uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } }, vertexShader: FLAG_VERT, fragmentShader: FLAG_FRAG });
  const merged = mergeGeometries(geos);
  if (!merged) return;
  ctx.group.add(new THREE.Mesh(merged, mat));
  ctx.disposers.push(() => {
    mat.dispose();
    merged.dispose();
  });
  ctx.extras.push((_dt, t) => (mat.uniforms.uTime.value = t));
}

// ───────────────────────── Seagulls ─────────────────────────

const GULL_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  attribute float aWing; attribute float aPhase; uniform float uTime;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 8.0 + aPhase) * aWing * 0.5;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const GULL_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  void main() {
    gl_FragColor = vec4(gl_FrontFacing ? vec3(0.97, 0.98, 1.0) : vec3(0.55, 0.62, 0.72), 1.0);
    #include <fog_fragment>
  }`;

/** A flock of seagulls flying in circles (each is a body + two flapping wings); center (x, y, z), radius range */
export function gulls(ctx: FieldCtx, x: number, y: number, z: number, n: number, r0: number, r1: number, speed: number): void {
  const r = ctx.r;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const R = r0 + r() * (r1 - r0);
    const hh = (r() - 0.5) * 6;
    const ang = (i / n) * Math.PI * 2 + r() * 0.8;
    const sc = 1.4 + r() * 0.6;
    const ph = r() * 6.28;
    const body = new THREE.OctahedronGeometry(0.13 * sc);
    body.scale(0.75, 0.6, 2.6);
    const bp = body.attributes.position;
    const pos: number[] = [];
    const wing: number[] = [];
    for (let k = 0; k < bp.count; k++) {
      pos.push(bp.getX(k), bp.getY(k), bp.getZ(k));
      wing.push(0);
    }
    const A = [0, 0.02, -0.17 * sc];
    const B = [0, 0.02, 0.17 * sc];
    pos.push(...A, -0.95 * sc, 0.05, 0.02, ...B);
    wing.push(0, 1, 0);
    pos.push(...A, ...B, 0.95 * sc, 0.05, 0.02);
    wing.push(0, 0, 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(new Array(wing.length).fill(ph), 1));
    g.applyMatrix4(M(Math.cos(ang) * R, hh, Math.sin(ang) * R, Math.PI - ang, 1, 0, speed > 0 ? -0.25 : 0.25));
    parts.push(g);
  }
  const geo = mergeGeometries(parts);
  if (!geo) return;
  const mat = new THREE.ShaderMaterial({ fog: true, side: THREE.DoubleSide, uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } }, vertexShader: GULL_VERT, fragmentShader: GULL_FRAG });
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.add(new THREE.Mesh(geo, mat));
  ctx.group.add(g);
  const ph = r() * 10;
  ctx.disposers.push(() => {
    geo.dispose();
    mat.dispose();
  });
  ctx.extras.push((_dt, t) => {
    g.rotation.y = t * speed + ph;
    g.position.y = y + Math.sin(t * 0.5 + ph) * 0.8;
    mat.uniforms.uTime.value = t;
  });
}

// ───────────────────────── Beams, glows ─────────────────────────

const BEAM_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FRAG = /* glsl */ `
  uniform float uTime; uniform vec3 uColor; uniform float uAmt; varying vec2 vUv;
  void main() {
    float a = pow(vUv.y, 2.2) * uAmt * (0.88 + 0.12 * sin(uTime * 6.0));
    gl_FragColor = vec4(uColor * 1.6, a);
  }`;

/** The lighthouse's rotating beam (two opposite long cones) and the glow outside the lamp room */
export function lighthouseBeam(ctx: FieldCtx, pos: THREE.Vector3, len: number, color: number): void {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAmt: { value: 0.3 } },
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const cone = new THREE.ConeGeometry(len * 0.075, len, 16, 1, true);
  cone.translate(0, -len / 2, 0);
  cone.rotateX(Math.PI / 2);
  const cone2 = cone.clone().rotateY(Math.PI);
  const geo = mergeGeometries([cone, cone2]) ?? cone;
  const beam = new THREE.Mesh(geo, mat);
  beam.position.copy(pos);
  beam.rotation.x = 0.06;
  beam.renderOrder = 5;
  ctx.group.add(beam);
  const pivot = new THREE.Group();
  pivot.position.copy(pos);
  ctx.group.add(pivot);
  pivot.add(beam);
  beam.position.set(0, 0, 0);
  const flareMat = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const flare = new THREE.Sprite(flareMat);
  flare.position.copy(pos);
  flare.scale.setScalar(7);
  ctx.group.add(flare);
  ctx.disposers.push(() => {
    mat.dispose();
    geo.dispose();
    cone.dispose();
    cone2.dispose();
    flareMat.dispose();
  });
  ctx.extras.push((_dt, t) => {
    pivot.rotation.y = t * 0.55;
    mat.uniforms.uTime.value = t;
    flare.scale.setScalar(6.5 + Math.sin(t * 6) * 0.8);
  });
}

let glowTexCache: THREE.Texture | null = null;
/** Soft glow texture (drawn ourselves, not disposed when the scene ends: one is shared by all regions) */
export function glowTexture(): THREE.Texture {
  if (glowTexCache) return glowTexCache;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  r.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  glowTexCache = new THREE.CanvasTexture(cv);
  glowTexCache.colorSpace = THREE.SRGBColorSpace;
  return glowTexCache;
}

/** A fixed set of glow sprites (the outer light of lanterns, windows and glowing coral); returns a function that adjusts brightness */
export function halos(ctx: FieldCtx, pts: [number, number, number, number][], color: number, amt = 1): (k: number) => void {
  if (!pts.length) return () => {};
  const tex = glowTexture();
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(pts.length * 3);
  const size = new Float32Array(pts.length);
  pts.forEach(([x, y, z, s], i) => {
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    size[i] = s;
  });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { uMap: { value: tex }, uColor: { value: new THREE.Color(color).multiplyScalar(amt) }, uScale: { value: 420 } },
    vertexShader: /* glsl */ `
      attribute float aSize; uniform float uScale; varying float vFade;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / max(1.0, -mv.z);
        vFade = 1.0 - smoothstep(90.0, 160.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uColor; varying float vFade;
      void main() { vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(uColor * t.a * vFade, t.a * vFade); }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  ctx.group.add(points);
  ctx.disposers.push(() => {
    geo.dispose();
    mat.dispose();
  });
  const base = new THREE.Color(color).multiplyScalar(amt);
  return (k) => mat.uniforms.uColor.value.copy(base).multiplyScalar(k);
}

// ───────────────────────── Pool water, waterfalls ─────────────────────────

const POOL_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime; uniform vec3 uCol; uniform vec3 uEdge; uniform float uGlow;
  varying vec2 vUv; varying vec3 vW;
  ${NOISE}
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float ripple = sin(r * 22.0 - uTime * 2.2 + vnoise(vW.xz * 0.6) * 3.0) * 0.5 + 0.5;
    float n = vnoise(vW.xz * 1.3 + uTime * 0.25);
    vec3 col = mix(uCol, uEdge, smoothstep(0.55, 1.0, r));
    col += vec3(1.0) * smoothstep(0.8, 0.95, ripple * n) * 0.25;
    col += uCol * uGlow * (1.0 - r) * (0.7 + 0.3 * sin(uTime * 1.5));
    float a = mix(0.82, 0.95, smoothstep(0.7, 1.0, r)) * smoothstep(1.0, 0.94, r);
    gl_FragColor = vec4(col, a);
    #include <fog_fragment>
  }`;

/** A round pool surface (hot springs, spring pools): edge color, a faint glow at the center, making ripples */
export function poolSurface(ctx: FieldCtx, x: number, y: number, z: number, r: number, col: number, edge: number, glow = 0): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uCol: { value: new THREE.Color(col) }, uEdge: { value: new THREE.Color(edge) }, uGlow: { value: glow } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv; varying vec3 vW;
      void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: POOL_FRAG,
  });
  const geo = new THREE.CircleGeometry(r, 40);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.renderOrder = 3;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    geo.dispose();
    mat.dispose();
  });
  ctx.extras.push((_dt, t) => (mat.uniforms.uTime.value = t));
  return mat;
}

/** Water flowing down along a polyline (small waterfalls, overflow): a ribbon mesh whose texture coordinates scroll downward */
export function waterfall(ctx: FieldCtx, pts: THREE.Vector3[], width: number, col: number): void {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[Math.min(pts.length - 1, i + 1)];
    const o = pts[Math.max(0, i - 1)];
    const dx = q.x - o.x;
    const dz = q.z - o.z;
    const l = Math.hypot(dx, dz) || 1;
    const sx = (-dz / l) * width * 0.5;
    const sz = (dx / l) * width * 0.5;
    if (i > 0) acc += p.distanceTo(pts[i - 1]);
    pos.push(p.x - sx, p.y, p.z - sz, p.x + sx, p.y, p.z + sz);
    uv.push(0, acc, 1, acc);
    if (i > 0) {
      const b = (i - 1) * 2;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uCol: { value: new THREE.Color(col) } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uCol; varying vec2 vUv;
      ${NOISE}
      void main() {
        float n = vnoise(vec2(vUv.x * 6.0, vUv.y * 1.6 - uTime * 3.0));
        float streak = smoothstep(0.45, 0.8, n);
        vec3 col = mix(uCol, vec3(1.0), streak * 0.7);
        float edge = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
        gl_FragColor = vec4(col, (0.55 + streak * 0.4) * edge);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    geo.dispose();
    mat.dispose();
  });
  ctx.extras.push((_dt, t) => (mat.uniforms.uTime.value = t));
}
