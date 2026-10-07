// Duskshade Hollow's custom shaders and moving things: the ceiling (glowworms, cracks that let moonlight through),
// ground-hugging purple mist, lake reflections,
// glowing jellyfish and soul-guiding lamps, Moonspring Falls, the glow at the tower top, and lamp light patches hugging the
// terrain. All hang only on ctx.group and dispose themselves.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FieldCtx } from '../../kit.ts';
import { sceneMaterial } from '../../../spiritToon.ts';
import { CRACKS, ISLE, LAKE, S, ceilH, sm } from './common.ts';

const NOISE = /* glsl */ `
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.1 + 3.7) * 0.3 + vnoise(p * 4.3 + 9.1) * 0.2; }
`;

/** A glow material with additive blending whose brightness is eaten by the fog (so it does not tint the distance with fog color) */
function addFogMat(extraUniforms: Record<string, THREE.IUniform>, vert: string, frag: string, side: THREE.Side = THREE.FrontSide): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...extraUniforms },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side,
  });
}

const FOG_ATTEN = /* glsl */ `
  #ifdef USE_FOG
    float fogK = smoothstep(fogNear, fogFar, vFogDepth);
  #else
    float fogK = 0.0;
  #endif
`;

function softDisc(size = 128): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const rg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  rg.addColorStop(0.6, 'rgba(255,255,255,0.14)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ───────────────────────── Cave ceiling ─────────────────────────

/**
 * The ceiling: a rolling rock surface seen from below, covered in dots of glowworms; hollowed out at the cracks with the
 * edges letting moonlight through, and a glowing night sky above the cracks.
 * Returns the ceiling's group (stalactites and pillars hang here too); the whole group is hidden when an overhead camera flies above the ceiling.
 */
export function ceiling(ctx: FieldCtx): THREE.Group {
  const g = new THREE.Group();
  ctx.group.add(g);
  const E = S + 36;
  const seg = ctx.low ? 64 : 96;
  const geo = new THREE.PlaneGeometry(E * 2, E * 2, seg, seg);
  geo.rotateX(Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, ceilH(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const cr = CRACKS.map((c) => new THREE.Vector4(c.x, c.z, c.rx, c.rz));
  const crr = CRACKS.map((c) => new THREE.Vector2(Math.cos(c.rot), Math.sin(c.rot)));
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uCr: { value: cr },
      uCrR: { value: crr },
      uRock: { value: new THREE.Color(0x1c1630) },
      uRock2: { value: new THREE.Color(0x2c2446) },
      uWorm: { value: new THREE.Color(0x6ae8ff) },
      uWorm2: { value: new THREE.Color(0xa88aff) },
      uMoon: { value: new THREE.Color(0x9ab4ff) },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec4 uCr[${CRACKS.length}]; uniform vec2 uCrR[${CRACKS.length}];
      uniform vec3 uRock; uniform vec3 uRock2; uniform vec3 uWorm; uniform vec3 uWorm2; uniform vec3 uMoon;
      varying vec3 vW; varying vec3 vN;
      ${NOISE}
      void main() {
        vec2 p = vW.xz;
        float k = 99.0;
        for (int i = 0; i < ${CRACKS.length}; i++) {
          vec2 d = p - uCr[i].xy;
          d = vec2(d.x * uCrR[i].x + d.y * uCrR[i].y, -d.x * uCrR[i].y + d.y * uCrR[i].x) / uCr[i].zw;
          k = min(k, length(d));
        }
        float n = fbm(p * 0.09);
        k += (n - 0.5) * 0.5 + (fbm(p * 0.6) - 0.5) * 0.18;
        if (k < 1.0) discard;
        vec3 col = mix(uRock, uRock2, smoothstep(0.3, 0.75, fbm(p * 0.035 + 4.0)));
        col *= 0.75 + 0.5 * fbm(p * 0.21);
        // The crack edges are lit by moonlight
        col += uMoon * (1.0 - smoothstep(1.0, 1.25, k)) * 0.9 + uMoon * (1.0 - smoothstep(1.0, 3.2, k)) * 0.18;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
        // Glow bugs: swarms of small light dots fading in and out slowly, with fog absorbing only part of them (like a starry sky)
        vec2 q = p * 0.55;
        vec2 cell = floor(q);
        vec2 f = fract(q) - 0.5;
        float h = hash2(cell);
        vec2 off = (vec2(hash2(cell + 3.1), hash2(cell + 7.7)) - 0.5) * 0.7;
        float cluster = smoothstep(0.42, 0.72, fbm(p * 0.03 + 11.0));
        float dotm = step(1.0 - 0.55 * cluster - 0.03, h) * smoothstep(0.13, 0.02, length(f - off));
        float tw = 0.55 + 0.45 * sin(uTime * (0.8 + h * 1.5) + h * 40.0);
        vec3 worm = mix(uWorm, uWorm2, step(0.8, hash2(cell + 1.3))) * dotm * tw * 2.6 * step(vN.y, -0.2);
        #ifdef USE_FOG
          float fk = smoothstep(fogNear, fogFar, vFogDepth);
        #else
          float fk = 0.0;
        #endif
        gl_FragColor.rgb += worm * (1.0 - fk * 0.7);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  g.add(mesh);

  // Moonlit night sky above the cracks: a glowing ellipse seen from below
  const tex = softDisc();
  const capMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0xc8d8ff).multiplyScalar(1.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  const capGeos: THREE.BufferGeometry[] = [];
  for (const c of CRACKS) {
    const cg = new THREE.CircleGeometry(1, 24);
    cg.rotateX(Math.PI / 2);
    cg.scale(c.rx * 1.5, 1, c.rz * 1.5);
    cg.rotateY(-c.rot);
    cg.translate(c.x, ceilH(c.x, c.z) + 7, c.z);
    capGeos.push(cg);
  }
  const caps = new THREE.Mesh(mergeGeometries(capGeos), capMat);
  caps.renderOrder = 1;
  g.add(caps);

  ctx.extras.push((_dt, t, vfx) => {
    mat.uniforms.uTime.value = t;
    g.visible = vfx.camPos.y < 60;
  });
  ctx.disposers.push(() => {
    geo.dispose();
    mat.dispose();
    capMat.dispose();
    tex.dispose();
    caps.geometry.dispose();
    for (const c of capGeos) c.dispose();
  });
  return g;
}

/** Build a set of static props (toon material) into a group, and register them for disposal */
export function buildInto(parent: THREE.Group, disposers: (() => void)[], build: (p: THREE.Group) => void): void {
  const g = new THREE.Group();
  build(g);
  parent.add(g);
  disposers.push(() =>
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mm = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
      else mm?.dispose();
    }),
  );
}

// ───────────────────────── Ground-hugging purple mist ─────────────────────────

/**
 * A layer of mist hugging the terrain (hugging the water surface over the lake): the noise slowly flows,
 * weight decides how thick it is in each place; it fades out near the camera
 */
export function groundMist(ctx: FieldCtx, lift: number, color: number, amt: number, scale: number, speed: number, weight: (x: number, z: number) => number): void {
  const n = ctx.low ? 70 : 110;
  const geo = new THREE.PlaneGeometry(S * 2, S * 2, n, n);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const w = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, Math.max(ctx.h(x, z), ctx.waterLevel) + lift);
    w[i] = weight(x, z);
  }
  geo.setAttribute('aW', new THREE.BufferAttribute(w, 1));
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAmt: { value: amt }, uScale: { value: scale } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aW; varying float vWt; varying vec3 vP;
      void main() {
        vWt = aW; vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xyz;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uColor; uniform float uAmt; uniform float uScale;
      varying float vWt; varying vec3 vP;
      ${NOISE}
      void main() {
        vec2 p = vP.xz * uScale;
        float n = fbm(p + vec2(uTime * 0.021, -uTime * 0.014)) * 0.65 + fbm(p * 2.6 - vec2(uTime * 0.034, uTime * 0.022)) * 0.35;
        float a = smoothstep(0.34, 0.78, n) * vWt * uAmt;
        a *= smoothstep(3.0, 16.0, length(vP - cameraPosition));
        gl_FragColor = vec4(uColor, a);
        #include <fog_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 4;
  ctx.group.add(mesh);
  ctx.extras.push((_dt, t) => {
    mat.uniforms.uTime.value = t * speed;
  });
  ctx.disposers.push(() => {
    geo.dispose();
    mat.dispose();
  });
}

// ───────────────────────── Ground light patches ─────────────────────────

export interface GroundLight {
  x: number;
  z: number;
  r: number;
  col: number;
  amt: number;
}

/** Contact shadows under large props (there are no real-time shadows, so this ring of dark patch "sits" rocks and trunks on the ground) */
export interface GroundShadow {
  x: number;
  z: number;
  r: number;
  amt: number;
}

const shadowLists = new WeakMap<FieldCtx, GroundShadow[]>();
/** The list of contact shadows being collected in this build (each prop function adds its own) */
export function shadowsOf(ctx: FieldCtx): GroundShadow[] {
  let l = shadowLists.get(ctx);
  if (!l) shadowLists.set(ctx, (l = []));
  return l;
}

/** Compose the collected contact shadows into one ground-hugging mesh (normal blending, darkening the ground) */
export function groundShadows(ctx: FieldCtx): void {
  const list = shadowsOf(ctx);
  if (!list.length) return;
  const geos: THREE.BufferGeometry[] = [];
  for (const p of list) {
    const seg = p.r > 3 ? 6 : 4;
    const g = new THREE.PlaneGeometry(p.r * 2, p.r * 2, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const a = new Float32Array(pos.count).fill(p.amt);
    for (let i = 0; i < pos.count; i++) {
      const x = p.x + pos.getX(i);
      const z = p.z + pos.getZ(i);
      pos.setXYZ(i, x, Math.max(ctx.h(x, z), ctx.waterLevel) + 0.06, z);
    }
    g.setAttribute('aA', new THREE.BufferAttribute(a, 1));
    g.deleteAttribute('normal');
    geos.push(g);
  }
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
    uniforms: { uCol: { value: new THREE.Color(0x05030c) } },
    vertexShader: /* glsl */ `
      attribute float aA; varying float vA; varying vec2 vUv;
      void main() { vA = aA; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; varying float vA; varying vec2 vUv;
      void main() {
        float d = length(vUv * 2.0 - 1.0);
        float a = smoothstep(1.0, 0.25, d);
        gl_FragColor = vec4(uCol, a * a * vA);
      }`,
  });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.renderOrder = 1;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    merged.dispose();
    mat.dispose();
  });
}

/** Light patches under lamps: all composed into one mesh hugging the terrain relief (additive blending, eaten by the fog in the distance) */
export function groundLights(ctx: FieldCtx, list: GroundLight[]): void {
  if (!list.length) return;
  const geos: THREE.BufferGeometry[] = [];
  const c = new THREE.Color();
  for (const p of list) {
    const g = new THREE.PlaneGeometry(p.r * 2, p.r * 2, 6, 6);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    c.set(p.col).multiplyScalar(p.amt);
    for (let i = 0; i < pos.count; i++) {
      const x = p.x + pos.getX(i);
      const z = p.z + pos.getZ(i);
      pos.setXYZ(i, x, Math.max(ctx.h(x, z), ctx.waterLevel) + 0.09, z);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('normal');
    geos.push(g);
  }
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  const mat = addFogMat(
    {},
    /* glsl */ `
      #include <fog_pars_vertex>
      attribute vec3 color; varying vec3 vC; varying vec2 vUv;
      void main() { vC = color; vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    /* glsl */ `
      #include <fog_pars_fragment>
      varying vec3 vC; varying vec2 vUv;
      void main() {
        float d = length(vUv * 2.0 - 1.0);
        float a = pow(max(0.0, 1.0 - d), 1.7);
        ${FOG_ATTEN}
        gl_FragColor = vec4(vC * a * (1.0 - fogK), 1.0);
      }`,
  );
  const mesh = new THREE.Mesh(merged, mat);
  mesh.renderOrder = 2;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    merged.dispose();
    mat.dispose();
  });
}

// ───────────────────────── Lake reflections ─────────────────────────

export interface Reflect {
  x: number;
  y: number;
  z: number;
  /** Light source size (meters) */
  s: number;
  col: number;
}

/**
 * Everdark Lake's mirror: a layer of dark mirror laid over the engine's water surface (fading out at the shore to leave the engine's foam ring),
 * stretching the shore lamps, the waterfall and the jellyfish into vertical bands of light in the water,
 * broken up by ripples; it also reflects the scattered light of the ceiling glowworms.
 * Returns the light sources that can be updated every frame (the moving jellyfish).
 */
export function lakeReflections(ctx: FieldCtx, box: [number, number, number, number], lights: Reflect[]): (i: number, x: number, y: number, z: number) => void {
  const N = 16;
  const [x0, x1, z0, z1] = box;
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, ctx.waterLevel + 0.03, (z0 + z1) / 2);
  const L = Array.from({ length: N }, (_, i) => (lights[i] ? new THREE.Vector4(lights[i].x, lights[i].y, lights[i].z, lights[i].s) : new THREE.Vector4(0, 0, 0, 0)));
  const LC = Array.from({ length: N }, (_, i) => new THREE.Color(lights[i]?.col ?? 0));
  const mat = new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uL: { value: L },
      uLC: { value: LC },
      uLevel: { value: ctx.waterLevel },
      uSpark: { value: new THREE.Color(0x8ad8ff) },
      uLake: { value: new THREE.Vector2(LAKE[0], LAKE[1]) },
      uIsle: { value: new THREE.Vector2(ISLE[0], ISLE[1]) },
      uDeep: { value: new THREE.Color(0x060514) },
      uRoof: { value: new THREE.Color(0x221a46) },
      uRip: { value: new THREE.Color(0x4a5aa8) },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec4 uL[${N}]; uniform vec3 uLC[${N}]; uniform float uLevel; uniform vec3 uSpark;
      uniform vec2 uLake; uniform vec2 uIsle; uniform vec3 uDeep; uniform vec3 uRoof; uniform vec3 uRip;
      varying vec3 vW;
      ${NOISE}
      float lakeR(float a) { return 24.0 + 3.5 * sin(3.0 * a + 0.7) + 2.0 * sin(5.0 * a - 1.1) + 1.2 * sin(8.0 * a); }
      void main() {
        vec2 l = vW.xz - uLake;
        float edge = length(l) - (lakeR(atan(l.y, l.x)) - 2.7);
        float isle = length(vW.xz - uIsle) - 7.4;
        float inside = smoothstep(0.3, 3.0, -edge) * smoothstep(0.2, 2.2, isle);
        if (inside <= 0.001) discard;
        vec3 V = vW - cameraPosition;
        float hv = length(V.xz);
        vec2 dv = V.xz / max(hv, 1e-3);
        float elV = atan(V.y, hv);
        // Water ripples: horizontally stretched noise that breaks the reflection into segments
        float w = fbm(vec2(vW.x * 0.5, vW.z * 2.0) + vec2(uTime * 0.12, -uTime * 0.3)) * 0.6 + fbm(vec2(vW.x * 1.7, vW.z * 5.0) - vec2(uTime * 0.2, uTime * 0.45)) * 0.4;
        // Mirror base color: deep water when looking straight down, reflecting the purple of the cave ceiling when looking at a slant
        float graze = pow(1.0 - clamp(-V.y / max(length(V), 1e-3), 0.0, 1.0), 2.5);
        vec3 col = mix(uDeep, uRoof, graze * 0.85 + 0.1);
        col += uRip * smoothstep(0.62, 0.8, w) * (0.08 + 0.18 * graze);
        vec3 add = vec3(0.0);
        for (int i = 0; i < ${N}; i++) {
          vec4 Lt = uL[i];
          if (Lt.w <= 0.0) continue;
          vec3 D = vec3(Lt.x, 2.0 * uLevel - Lt.y, Lt.z) - cameraPosition;
          float hd = length(D.xz);
          vec2 dd = D.xz / max(hd, 1e-3);
          float dAz = acos(clamp(dot(dv, dd), -1.0, 1.0));
          float dEl = elV - atan(D.y, hd);
          float ang = Lt.w / max(length(D), 1.0);
          float g = exp(-pow(dAz / (ang * 0.45 + 0.003), 2.0) - pow(dEl / (ang * 2.6 + 0.03), 2.0));
          add += uLC[i] * g;
        }
        add *= 0.2 + 1.0 * smoothstep(0.35, 0.72, w);
        // Scattered light from the glow bugs on the cave ceiling
        vec2 q = vW.xz * 1.3;
        vec2 cell = floor(q);
        float hsh = hash2(cell);
        float sp = step(0.94, hsh) * smoothstep(0.2, 0.0, length(fract(q) - 0.5)) * (0.5 + 0.5 * sin(uTime * 2.0 + hsh * 60.0));
        add += uSpark * sp * smoothstep(0.45, 0.7, w) * 0.8;
        gl_FragColor = vec4(col + add, inside * 0.94);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  ctx.group.add(mesh);
  ctx.extras.push((_dt, t) => {
    mat.uniforms.uTime.value = t;
  });
  ctx.disposers.push(() => {
    geo.dispose();
    mat.dispose();
  });
  return (i, x, y, z) => {
    if (i < N) L[i].set(x, y, z, L[i].w);
  };
}

// ───────────────────────── Glowing jellyfish, soul-guiding lamps ─────────────────────────

export interface Floater {
  obj: THREE.Object3D;
  x: number;
  y: number;
  z: number;
  /** Radius and speed of the circling drift */
  orbit: number;
  speed: number;
  phase: number;
  bob: number;
  pulse: number;
}

/** Glowing jellyfish: a translucent bell with a bright core inside and a few glowing tentacles hanging down */
export function jellyfish(col: number, s: number, mats: THREE.Material[]): THREE.Group {
  const g = new THREE.Group();
  const bellMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(0.9), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.4).multiplyScalar(2.4), toneMapped: false });
  const tentMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.6), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  mats.push(bellMat, coreMat, tentMat);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.6 * s, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), bellMat);
  bell.scale.y = 0.8;
  bell.name = 'bell';
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 8, 6), coreMat);
  core.position.y = 0.12 * s;
  const tg: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const len = (0.9 + (i % 3) * 0.35) * s;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.4 * s * (1 - t * 0.5) + Math.sin(t * 5 + i) * 0.06 * s, -t * len, Math.sin(a) * 0.4 * s * (1 - t * 0.5) + Math.cos(t * 4 + i) * 0.06 * s));
    }
    tg.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.018 * s, 3));
  }
  const tents = new THREE.Mesh(mergeGeometries(tg), tentMat);
  tents.name = 'tents';
  for (const t of tg) t.dispose();
  g.add(bell, core, tents);
  return g;
}

/** Soul-guiding lamp: a small lantern floating in mid-air, with teal-green spirit fire inside */
export function soulLamp(s: number, mats: THREE.Material[]): THREE.Group {
  const g = new THREE.Group();
  // The lamp frame is tiny and gets no outline as before, just switched to the scene toon material
  const frame = sceneMaterial(0x2a2238, { rim: 0.35 });
  const fire = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7affd8).multiplyScalar(2.3), toneMapped: false });
  const shell = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4ab8a8), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  mats.push(frame, fire, shell);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28 * s, 0.22 * s, 6), frame);
  cap.position.y = 0.34 * s;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.22 * s, 0.08 * s, 6), frame);
  base.position.y = -0.26 * s;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 0.5 * s, 6), shell);
  const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.12 * s), fire);
  flame.scale.y = 1.6;
  flame.name = 'flame';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1 * s, 0.02 * s, 4, 10), frame);
  ring.position.y = 0.5 * s;
  g.add(cap, base, glass, flame, ring);
  return g;
}

/** Set a group of floaters in motion: circling drift, bobbing up and down, the bell opening and closing */
export function animateFloaters(ctx: FieldCtx, list: Floater[], mats: THREE.Material[], onMove?: (i: number, f: Floater, x: number, y: number, z: number) => void): void {
  for (const f of list) ctx.group.add(f.obj);
  ctx.extras.push((dt, t) => {
    list.forEach((f, i) => {
      const a = f.phase + t * f.speed;
      const x = f.x + Math.cos(a) * f.orbit;
      const z = f.z + Math.sin(a) * f.orbit;
      const y = f.y + Math.sin(t * 1.3 + f.phase * 3) * f.bob;
      f.obj.position.set(x, y, z);
      if (f.pulse) {
        const k = Math.sin(t * f.pulse + f.phase);
        const bell = f.obj.getObjectByName('bell');
        if (bell) bell.scale.set(1 + k * 0.08, 0.8 - k * 0.1, 1 + k * 0.08);
        const tents = f.obj.getObjectByName('tents');
        if (tents) tents.scale.y = 1 + k * 0.12;
      }
      const flame = f.obj.getObjectByName('flame');
      if (flame) flame.rotation.y += dt * 2;
      onMove?.(i, f, x, y, z);
    });
  });
  ctx.disposers.push(() => {
    for (const m of mats) m.dispose();
    for (const f of list) f.obj.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  });
}

// ───────────────────────── Moonspring Falls ─────────────────────────

/**
 * A thin waterfall dropping from a crack in the ceiling: two layers of light-patterned cylinders flowing down,
 * with a ring of spreading ripples on the water at the bottom
 */
export function moonFalls(ctx: FieldCtx, x: number, z: number, top: number, parent: THREE.Object3D = ctx.group): void {
  const bot = ctx.waterLevel;
  const H = top - bot;
  const mk = (r0: number, r1: number, amt: number, speed: number) => {
    const geo = new THREE.CylinderGeometry(r0, r1, H, 20, 1, true);
    geo.translate(x, bot + H / 2, z);
    const mat = addFogMat(
      { uTime: { value: 0 }, uCol: { value: new THREE.Color(0xb8d0ff) }, uAmt: { value: amt }, uSpeed: { value: speed }, uH: { value: H } },
      /* glsl */ `
        #include <fog_pars_vertex>
        varying vec2 vUv;
        void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      /* glsl */ `
        #include <fog_pars_fragment>
        uniform float uTime; uniform vec3 uCol; uniform float uAmt; uniform float uSpeed; uniform float uH;
        varying vec2 vUv;
        ${NOISE}
        void main() {
          vec2 p = vec2(vUv.x * 18.0, vUv.y * uH * 0.35 + uTime * uSpeed);
          float s = fbm(p) * 0.7 + fbm(p * vec2(2.0, 0.6) + 5.0) * 0.3;
          float streak = smoothstep(0.42, 0.8, s);
          // Thin at the top, spreading out and fading downward, meeting the water surface at the very bottom
          float v = smoothstep(0.0, 0.04, vUv.y) * (0.45 + 0.55 * smoothstep(0.2, 0.9, vUv.y)) * smoothstep(1.0, 0.93, vUv.y);
          ${FOG_ATTEN}
          gl_FragColor = vec4(uCol * streak * v * uAmt * (1.0 - fogK * 0.85), 1.0);
        }`,
      THREE.DoubleSide,
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 5;
    parent.add(mesh);
    ctx.extras.push((_dt, t) => {
      mat.uniforms.uTime.value = t;
    });
    ctx.disposers.push(() => {
      geo.dispose();
      mat.dispose();
    });
  };
  mk(0.9, 1.6, 1.5, 1.8);
  mk(1.6, 2.8, 0.5, 1.2);
  // Ripples where the water lands
  const rg = new THREE.PlaneGeometry(14, 14);
  rg.rotateX(-Math.PI / 2);
  rg.translate(x, bot + 0.05, z);
  const rmat = addFogMat(
    { uTime: { value: 0 }, uC: { value: new THREE.Vector2(x, z) } },
    /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec2 uC; varying vec3 vW;
      ${NOISE}
      void main() {
        float d = length(vW.xz - uC);
        float rings = smoothstep(0.7, 1.0, sin(d * 3.2 - uTime * 3.0) * 0.5 + 0.5) * smoothstep(7.0, 1.5, d);
        float foam = smoothstep(2.6, 0.8, d) * (0.6 + 0.4 * fbm(vW.xz * 2.0 + uTime));
        ${FOG_ATTEN}
        gl_FragColor = vec4(vec3(0.7, 0.82, 1.0) * (rings * 0.5 + foam * 1.3) * (1.0 - fogK), 1.0);
      }`,
  );
  const ripple = new THREE.Mesh(rg, rmat);
  ripple.renderOrder = 4;
  ctx.group.add(ripple);
  let acc = 0;
  ctx.extras.push((dt, t, vfx) => {
    rmat.uniforms.uTime.value = t;
    if (Math.hypot(vfx.camPos.x - x, vfx.camPos.z - z) > 90) return;
    acc += dt;
    while (acc > 0.07) {
      acc -= 0.07;
      const a = Math.random() * Math.PI * 2;
      vfx.emit({ pos: new THREE.Vector3(x + Math.cos(a) * 1.2, bot + 0.3, z + Math.sin(a) * 1.2), count: 1, color: [0xc8dcff, 0x9ab8ff], speed: [0.6, 1.8], dir: new THREE.Vector3(Math.cos(a), 1.2, Math.sin(a)), spread: 0.6, life: [1.2, 2.2], size: [0.3, 0.6], sizeEnd: 2.2, drag: 0.8, gravity: -0.3, intensity: 0.9 });
    }
  });
  ctx.disposers.push(() => {
    rg.dispose();
    rmat.dispose();
  });
}

// ───────────────────────── Glow ─────────────────────────

/** A soft glow unaffected by fog (the "brightest lamp" at the tower top, visible from far away) */
export function halo(ctx: FieldCtx, x: number, y: number, z: number, size: number, col: number, amt: number, breathe = 0): void {
  const tex = softDisc();
  const mat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(col).multiplyScalar(amt), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, transparent: true });
  const sp = new THREE.Sprite(mat);
  sp.position.set(x, y, z);
  sp.scale.setScalar(size);
  ctx.group.add(sp);
  if (breathe) {
    const base = new THREE.Color(col).multiplyScalar(amt);
    ctx.extras.push((_dt, t) => {
      mat.color.copy(base).multiplyScalar(1 + Math.sin(t * 1.1 + x) * breathe);
    });
  }
  ctx.disposers.push(() => {
    mat.dispose();
    tex.dispose();
  });
}

/** A faint light patch weight: falls off with distance from a point */
export const falloff = (x: number, z: number, cx: number, cz: number, r0: number, r1: number) => 1 - sm(r0, r1, Math.hypot(x - cx, z - cz));

// ───────────────────────── Moonlight shafts ─────────────────────────

export interface Shaft {
  /** Where the shaft lands on the ground */
  x: number;
  y: number;
  z: number;
  w: number;
  /** Length along the light direction */
  len: number;
}

/**
 * Moonlight slanting down from the ceiling cracks: each shaft is two thin crossed sheets, brightest at the ground and fading
 * upward, each slowly flickering (one mesh)
 */
export function moonShafts(ctx: FieldCtx, list: Shaft[], dir: THREE.Vector3, color: number, amt: number, parent: THREE.Object3D = ctx.group): void {
  if (!list.length) return;
  const d = dir.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const qa = new THREE.Quaternion().setFromUnitVectors(up, d);
  const geos: THREE.BufferGeometry[] = [];
  list.forEach((s, i) => {
    for (let k = 0; k < 2; k++) {
      const g = new THREE.PlaneGeometry(1, 1);
      g.translate(0, 0.5, 0);
      g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill((i * 0.37 + k * 0.5) % 1), 1));
      const q = qa.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, (k * Math.PI) / 2 + 0.4 + i));
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(s.x, s.y - 0.4, s.z), q, new THREE.Vector3(s.w, s.len, 1)));
      geos.push(g);
    }
  });
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  const mat = addFogMat(
    { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAmt: { value: amt } },
    /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aSeed; varying vec2 vUv; varying float vSeed;
      void main() { vUv = uv; vSeed = aSeed; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uColor; uniform float uTime; uniform float uAmt; varying vec2 vUv; varying float vSeed;
      void main() {
        float x = abs(vUv.x - 0.5) * 2.0;
        float side = (1.0 - x) * (1.0 - x);
        float v = smoothstep(0.0, 0.035, vUv.y) * (0.35 + 0.65 * pow(max(1.0 - vUv.y, 0.0), 1.5)) * smoothstep(1.0, 0.9, vUv.y);
        float flick = 0.72 + 0.28 * sin(uTime * 0.5 + vSeed * 6.2832);
        ${FOG_ATTEN}
        gl_FragColor = vec4(uColor * side * v * flick * uAmt * (1.0 - fogK * 0.8), 1.0);
      }`,
    THREE.DoubleSide,
  );
  const mesh = new THREE.Mesh(merged, mat);
  mesh.renderOrder = 6;
  parent.add(mesh);
  ctx.extras.push((_dt, t) => {
    mat.uniforms.uTime.value = t;
  });
  ctx.disposers.push(() => {
    merged.dispose();
    mat.dispose();
  });
}

// ───────────────────────── Rock cover for the overhead view ─────────────────────────

/**
 * In the overhead view (ceiling hidden), cover the map's outer ring with one whole dark rock layer,
 * as if the cave were cut open to look inside; not visible normally
 */
export function overviewLid(ctx: FieldCtx, y: number): void {
  const E = S * 4;
  const shape = new THREE.Shape();
  shape.moveTo(-E, -E);
  shape.lineTo(E, -E);
  shape.lineTo(E, E);
  shape.lineTo(-E, E);
  shape.closePath();
  const hole = new THREE.Path();
  const n = 48;
  // The opening is set slightly inward along the top of the cave wall, covering the cut face of the terrain's outer edge
  for (let i = 0; i <= n * 4; i++) {
    const t = i / n;
    const side = Math.floor(t) % 4;
    const f = t - Math.floor(t);
    const I = S - 3;
    const along = -I + f * 2 * I;
    const [hx, hz] = side === 0 ? [along, -I] : side === 1 ? [I, along] : side === 2 ? [-along, I] : [-I, -along];
    const w = Math.sin(hx * 0.09 + hz * 0.07) * 3 + Math.sin(hx * 0.23 - hz * 0.19) * 1.5;
    const k = (I + w) / I;
    if (i === 0) hole.moveTo(hx * k, -hz * k);
    else hole.lineTo(hx * k, -hz * k);
  }
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uA: { value: new THREE.Color(0x191428) }, uB: { value: new THREE.Color(0x2c2442) }, uV: { value: new THREE.Color(0x5a3a9a) } },
    vertexShader: /* glsl */ `varying vec3 vW; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uA; uniform vec3 uB; uniform vec3 uV; varying vec3 vW;
      ${NOISE}
      void main() {
        vec2 p = vW.xz;
        float n = fbm(p * 0.03);
        vec3 col = mix(uA, uB, smoothstep(0.3, 0.8, n));
        float crack = abs(fbm(p * 0.05 + 7.0) - 0.5);
        col = mix(col, uV, (1.0 - smoothstep(0.0, 0.025, crack)) * 0.6);
        // A little brighter toward the cave mouth, like a cut face of rock strata
        float d = max(abs(p.x), abs(p.y));
        col *= 1.0 + 0.5 * (1.0 - smoothstep(${S.toFixed(1)}, ${(S + 30).toFixed(1)}, d));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  ctx.group.add(mesh);
  ctx.extras.push((_dt, _t, vfx) => {
    mesh.visible = vfx.camPos.y >= 60;
  });
  ctx.disposers.push(() => {
    geo.dispose();
    mat.dispose();
  });
}
