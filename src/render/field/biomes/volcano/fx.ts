// Shaders and animated meshes of the Emberspine Volcanic Belt: flowing lava bands (crust on the river surface, the lavafall,
// the magma flows on the mountain flanks), heat shimmer, glowing ground cracks (rewriting the terrain material), hot spring
// water surfaces, the erupting smoke plume, and waving banners.

import * as THREE from 'three';
import type { FieldCtx } from '../../kit.ts';

const NOISE = /* glsl */ `
  float vh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(vh(i), vh(i + vec2(1.0, 0.0)), f.x), mix(vh(i + vec2(0.0, 1.0)), vh(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float vfbm(vec2 p) { return vn(p) * 0.5 + vn(p * 2.03 + 3.7) * 0.3 + vn(p * 4.1 + 9.1) * 0.2; }`;

// ───────────────────────── Ribbon mesh ─────────────────────────

/**
 * Lays a ribbon mesh along a series of 3D points (five vertices across): uv.x runs along the flow (meters / 4), uv.y runs
 * across from 0 to 1, aEdge is 0 in the center and 1 at the sides. y comes from yAt (hugging the ground or a fixed height).
 */
export function ribbon(pts: THREE.Vector3[], width: (t: number) => number, yAt: (x: number, z: number, t: number) => number): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const edge: number[] = [];
  const idx: number[] = [];
  const cols = [-1, -0.5, 0, 0.5, 1];
  let u = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x;
    let tz = b.z - a.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    if (i > 0) u += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z, p.y - pts[i - 1].y) / 4;
    const t = i / (n - 1);
    const w = width(t);
    for (const k of cols) {
      const x = p.x - tz * w * k;
      const z = p.z + tx * w * k;
      pos.push(x, yAt(x, z, t), z);
      uv.push(u, (k + 1) / 2);
      edge.push(Math.abs(k));
    }
    if (i < n - 1) {
      const o = i * 5;
      for (let k = 0; k < 4; k++) idx.push(o + k, o + k + 5, o + k + 1, o + k + 1, o + k + 5, o + k + 6);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Stands a thin curtain up along a curve (heat shimmer): the bottom edge sits at y, uv.y goes up to 1 */
export function curtain(pts: THREE.Vector3[], h: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let u = 0;
  pts.forEach((p, i) => {
    if (i > 0) u += p.distanceTo(pts[i - 1]) / 4;
    pos.push(p.x, p.y, p.z, p.x, p.y + h, p.z);
    uv.push(u, 0, u, 1);
    if (i < pts.length - 1) {
      const b = i * 2;
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// ───────────────────────── Lava ─────────────────────────

export interface LavaOpts {
  /** Flow speed (how far the pattern moves downstream per second) */
  speed: number;
  /** Stretches the pattern along the flow (the lavafall is stretched into streaks) */
  stretch?: number;
  /** Laid over the engine's lava surface: draws only the crust and bright veins, everything else is transparent */
  overlay?: boolean;
  /** Fraction of the fog that applies (it glows by itself, so it is still visible from afar) */
  fogK?: number;
  /** Brightness multiplier */
  gain?: number;
}

export function lavaMaterial(o: LavaOpts): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    transparent: !!o.overlay,
    depthWrite: !o.overlay,
    side: THREE.DoubleSide,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uSpeed: { value: o.speed },
      uStretch: { value: o.stretch ?? 1 },
      uOverlay: { value: o.overlay ? 1 : 0 },
      uFogK: { value: o.fogK ?? 0.5 },
      uGain: { value: o.gain ?? 1 },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aEdge; varying vec2 vUv; varying float vEdge; varying vec3 vW;
      void main() {
        vUv = uv; vEdge = aEdge;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform float uSpeed; uniform float uStretch; uniform float uOverlay; uniform float uFogK; uniform float uGain;
      varying vec2 vUv; varying float vEdge; varying vec3 vW;
      ${NOISE}
      void main() {
        // Flow is fast in the middle and slow at the banks: the pattern is stretched into arcs
        float lag = (1.0 - vEdge * vEdge) * 0.35 + 0.65;
        vec2 p = vec2(vUv.x / uStretch - uTime * uSpeed * lag, vUv.y * 2.2);
        float n = vn(p * 1.6) * 0.55 + vn(p * 3.7 + 3.1 + uTime * 0.05) * 0.3 + vn(p * 8.0 - uTime * 0.15) * 0.15;
        float crust = smoothstep(0.53, 0.58, n);
        float rimK = smoothstep(0.485, 0.53, n) * (1.0 - crust);
        vec3 hot = vec3(1.0, 0.32, 0.05) * 1.1;
        vec3 hotter = vec3(1.0, 0.58, 0.15) * 1.45;
        vec3 dark = vec3(0.11, 0.045, 0.04);
        vec3 c = mix(hot, hotter, smoothstep(0.2, 0.42, n));
        c = mix(c, hotter * 1.15, rimK * 0.85);
        c = mix(c, dark, crust);
        // Both banks cool into a black crust
        float bankK = smoothstep(0.7, 1.0, vEdge);
        c = mix(c, dark * 1.5, bankK * (1.0 - uOverlay));
        c *= uGain;
        float a = 1.0;
        if (uOverlay > 0.5) {
          // Layered over the lava surface: crust plates (dark) and bright streaks, transparent elsewhere; fades out at both banks
          a = max(crust * 0.92, rimK * 0.75) * (1.0 - smoothstep(0.55, 0.95, vEdge));
        }
        gl_FragColor = vec4(c, a);
        #ifdef USE_FOG
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(fogNear, fogFar, vFogDepth) * uFogK);
        #endif
      }`,
  });
}

// ───────────────────────── Heat shimmer ─────────────────────────

export function hazeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float k = uv.y;
        p.x += sin(uTime * 3.0 + position.z * 0.8 + k * 5.0) * k * 0.35;
        p.z += cos(uTime * 2.6 + position.x * 0.7 + k * 4.0) * k * 0.35;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      ${NOISE}
      void main() {
        float v = vUv.y;
        float w = vn(vec2(vUv.x * 2.5 + sin(v * 6.0 + uTime * 2.0) * 0.3, v * 3.0 - uTime * 1.1));
        float a = (1.0 - v) * (1.0 - v) * smoothstep(0.35, 0.75, w) * 0.22;
        gl_FragColor = vec4(vec3(1.0, 0.55, 0.25) * 1.2, a);
      }`,
  });
}

// ───────────────────────── Glowing ground cracks ─────────────────────────

/**
 * Adds Voronoi cracks to the terrain material: the r of the heat texture is the crack brightness, g is the warm glow of the
 * lava shore. The terrain material is created by the engine; this only layers the glow on at the end of its fragment shader,
 * and does nothing if the insertion point is not found.
 */
export function patchTerrain(ctx: FieldCtx, heat: THREE.DataTexture): ((t: number) => void) | null {
  const mat = ctx.terrain.mesh.material as THREE.ShaderMaterial;
  const anchor = 'gl_FragColor = vec4(col, 1.0);';
  if (!mat.isShaderMaterial || !mat.fragmentShader.includes(anchor) || !mat.fragmentShader.includes('vWorld')) return null;
  // the engine's Void Blight erosion (uErode): cracks inside the eroded area turn purple, and go back to lava orange after
  // purification
  const eroK = mat.fragmentShader.includes('uniform vec4 uErode')
    ? 'float eroK = uErode.z > 0.0 ? smoothstep(uErode.z, uErode.z * 0.75, length(vWorld.xz - uErode.xy)) * uErode.w : 0.0;'
    : 'float eroK = 0.0;';
  mat.uniforms.uHeat = { value: heat };
  mat.uniforms.uHS = { value: ctx.layout.size };
  mat.uniforms.uHTime = { value: 0 };
  mat.fragmentShader = mat.fragmentShader
    .replace(
      '#include <fog_pars_fragment>',
      /* glsl */ `#include <fog_pars_fragment>
      uniform sampler2D uHeat; uniform float uHS; uniform float uHTime;
      vec2 vhash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
      float vvoro(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        float d1 = 8.0, d2 = 8.0;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 rr = g + vhash2(i + g) - f;
          float d = dot(rr, rr);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
        }
        return sqrt(d2) - sqrt(d1);
      }`,
    )
    .replace(
      anchor,
      /* glsl */ `{
        vec4 heat = texture2D(uHeat, clamp((vWorld.xz + uHS) / (2.0 * uHS), 0.0, 1.0));
        if (heat.r + heat.g > 0.01) {
          vec2 q = vWorld.xz;
          // Cracking: a warped Voronoi network whose thickness and brightness change segment by segment; far from the lava they are only dark cold cracks
          vec2 w = vec2(vnoise(q * 0.13), vnoise(q * 0.13 + 5.2)) * 2.2;
          float big = 1.0 - smoothstep(0.0, 0.035 + 0.045 * heat.r, vvoro(q * 0.24 + w));
          float fine = (1.0 - smoothstep(0.0, 0.04, vvoro(q * 0.7 + 7.3 + w))) * smoothstep(0.5, 0.95, heat.r);
          float patchy = smoothstep(0.32, 0.62, vnoise(q * 0.055 + 3.1) * 0.75 + heat.r * 0.45);
          float line = clamp(big * smoothstep(0.05, 0.35, heat.r) + fine * 0.7, 0.0, 1.0) * patchy;
          // Planar projection on steep slopes stretches into long strips: cracks only on flat ground and gentle slopes
          line *= smoothstep(0.62, 0.86, normalize(vNormal).y);
          float hot = smoothstep(0.2, 0.75, heat.r) * (0.35 + 0.65 * vnoise(q * 0.21 + 1.7));
          float pulse = 0.62 + 0.38 * sin(uHTime * 1.3 + vnoise(q * 0.1) * 6.28);
          ${eroK}
          // On eroded ground the purple cracks of the engine take over, and the lava cracks fade to very faint
          line *= 1.0 - eroK * 0.85;
          col = mix(col, col * 0.3, line * 0.6);
          col += vec3(1.0, 0.36, 0.07) * line * pulse * 2.1 * heat.r * hot;
          col += mix(vec3(1.0, 0.3, 0.07), vec3(0.75, 0.2, 0.9), eroK * 0.6) * heat.g * heat.g * 0.95;
        }
      }
      ${anchor}`,
    );
  mat.needsUpdate = true;
  return (t) => (mat.uniforms.uHTime.value = t);
}

// ───────────────────────── Ground light pools ─────────────────────────

/**
 * Rings of warm light on the ground (lava bombs, sinter cones, fumaroles, under braziers): each ring is a small mesh hugging
 * the terrain, all merged into one additive-blended mesh; each ring has its own phase and slowly pulses like the embers
 * underneath. Returns a function that updates the time every frame.
 */
export function lightPools(ctx: FieldCtx, pools: { x: number; z: number; r: number; color: number; amt: number }[]): ((t: number) => void) | null {
  if (!pools.length) return null;
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const ph: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  for (const p of pools) {
    const n = Math.max(3, Math.min(8, Math.round(p.r * 1.3)));
    const base = pos.length / 3;
    c.set(p.color).multiplyScalar(p.amt);
    const phase = Math.random() * 6.28;
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const v = j / n;
        const x = p.x + (u * 2 - 1) * p.r;
        const z = p.z + (v * 2 - 1) * p.r;
        pos.push(x, ctx.h(x, z) + 0.09, z);
        uv.push(u, v);
        col.push(c.r, c.g, c.b);
        ph.push(phase);
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = base + j * (n + 1) + i;
        idx.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(ph, 1));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute vec3 aCol; attribute float aPhase; uniform float uTime;
      varying vec2 vUv; varying vec3 vCol;
      void main() {
        vUv = uv;
        float f = 0.78 + 0.14 * sin(uTime * 1.7 + aPhase) + 0.08 * sin(uTime * 4.3 + aPhase * 2.3);
        vCol = aCol * f;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying vec2 vUv; varying vec3 vCol;
      void main() {
        float d = length(vUv * 2.0 - 1.0);
        float k = pow(max(0.0, 1.0 - d), 1.7);
        vec3 c = vCol * k;
        // Additive blending: light spots in the fog simply darken, do not add the fog color
        #ifdef USE_FOG
          c *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
        #endif
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 2;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    g.dispose();
    mat.dispose();
  });
  return (t) => (mat.uniforms.uTime.value = t);
}

// ───────────────────────── Hot springs ─────────────────────────

export function springMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; varying vec3 vW;
      ${NOISE}
      void main() {
        vec2 p = vW.xz;
        float n1 = vn(p * 0.6 + vec2(uTime * 0.2, uTime * 0.13));
        float n2 = vn(p * 1.7 - vec2(uTime * 0.27, -uTime * 0.19));
        vec3 deep = vec3(0.10, 0.62, 0.66);
        vec3 light = vec3(0.45, 0.92, 0.86);
        vec3 c = mix(deep, light, n1 * 0.6 + 0.2);
        c += smoothstep(0.7, 0.9, n1 * n2 * 1.9) * vec3(0.55, 0.7, 0.65);
        gl_FragColor = vec4(c * 1.08, 0.82);
        #include <fog_fragment>
      }`,
  });
}

// ───────────────────────── Smoke plume ─────────────────────────

/** Erupting smoke plume: a conical shell that thickens going up and bends downwind, with noise curling upward */
export function plumeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uLow: { value: new THREE.Color(0xff7a3a) } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec3 p = position;
        float k = uv.y;
        // Drifts to the southeast, bending more the higher it goes
        p.x += pow(k, 1.7) * 70.0;
        p.z += pow(k, 2.0) * 18.0;
        p.x += sin(uTime * 0.3 + k * 6.0) * k * 4.0;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uLow; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      ${NOISE}
      void main() {
        float k = vUv.y;
        vec2 p = vec2(vUv.x * 7.0, k * 5.0 - uTime * 0.05);
        float n = vfbm(p * 1.2 + vec2(0.0, -uTime * 0.03)) * 0.6 + vfbm(p * 2.7 - vec2(uTime * 0.02, uTime * 0.06)) * 0.4;
        float facing = pow(abs(dot(normalize(vN), normalize(vV))), 1.2);
        float a = smoothstep(0.32, 0.72, n) * facing * smoothstep(0.0, 0.05, k) * (1.0 - smoothstep(0.55, 1.0, k));
        vec3 dark = vec3(0.16, 0.11, 0.12);
        vec3 lit = vec3(0.42, 0.32, 0.32);
        vec3 c = mix(dark, lit, n);
        // The bottom is lit by the crater
        c = mix(c, uLow * 1.3, (1.0 - smoothstep(0.0, 0.22, k)) * 0.8);
        gl_FragColor = vec4(c, a * 0.9);
        #ifdef USE_FOG
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(fogNear, fogFar, vFogDepth) * 0.55);
        #endif
      }`,
  });
}

// ───────────────────────── Geyser jets ─────────────────────────

/** Jet of water shot out by a geyser: a white stream rushing upward, spreading out and fading transparent at the top */
export function geyserMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      ${NOISE}
      void main() {
        float k = vUv.y;
        float n = vfbm(vec2(vUv.x * 9.0, k * 5.0 - uTime * 7.0));
        float facing = pow(abs(dot(normalize(vN), normalize(vV))), 0.6);
        float a = (0.45 + 0.55 * n) * (1.0 - smoothstep(0.55, 1.0, k)) * (0.35 + 0.65 * facing);
        vec3 c = mix(vec3(0.72, 0.86, 0.9), vec3(1.0), smoothstep(0.3, 0.8, n));
        gl_FragColor = vec4(c, a * 0.9);
        #include <fog_fragment>
      }`,
  });
}

// ───────────────────────── Sky ─────────────────────────

/**
 * The volcanic belt's sky (laid over the engine's sky dome): overhead is a dark red-black blocked by smoke and ash, the
 * horizon is lit orange-red by the magma; the undersides of low-hanging volcanic ash clouds are lit red, brightest toward
 * the main peak; volcanic lightning flickers through the plume now and then (uFlash).
 */
export function skyMaterial(fog: THREE.Color, volcDir: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uFog: { value: fog.clone() },
      uVolc: { value: volcDir.clone().setY(0).normalize() },
      uFlash: { value: 0 },
      uFlashDir: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uFog; uniform vec3 uVolc; uniform float uFlash; uniform vec3 uFlashDir;
      varying vec3 vP;
      ${NOISE}
      void main() {
        vec3 d = normalize(vP);
        float h = d.y;
        vec2 hd = normalize(d.xz + vec2(1e-5));
        float vd = max(dot(hd, uVolc.xz), 0.0);
        vec3 c = mix(vec3(0.86, 0.34, 0.13), vec3(0.25, 0.08, 0.06), smoothstep(0.0, 0.2, h));
        c = mix(c, vec3(0.05, 0.028, 0.038), smoothstep(0.18, 0.75, h));
        c += vec3(0.55, 0.14, 0.03) * pow(vd, 4.0) * (1.0 - smoothstep(0.0, 0.45, h));
        // Volcanic ash cloud: projected onto the ceiling, flatter the closer to the horizon; the underside is reddened by the lava
        vec2 uv = d.xz / (max(h, 0.0) + 0.16);
        vec2 fl = vec2(uTime * 0.008, uTime * 0.003);
        float n1 = vfbm(uv * 0.9 + fl);
        float n2 = vfbm(uv * 2.3 - fl * 1.6 + 4.0);
        float cl = smoothstep(0.4, 0.74, n1 * 0.7 + n2 * 0.4) * smoothstep(-0.02, 0.12, h);
        float under = (1.0 - smoothstep(0.02, 0.5, h)) * (0.45 + 0.55 * vd * vd);
        vec3 cc = mix(vec3(0.07, 0.04, 0.05), vec3(0.62, 0.22, 0.1), under * (0.4 + 0.6 * (1.0 - n2)));
        c = mix(c, cc, cl * 0.9);
        // Volcanic lightning inside the smoke column
        float fd = max(dot(d, uFlashDir), 0.0);
        c += vec3(0.85, 0.7, 1.0) * uFlash * (pow(fd, 40.0) * 1.6 + pow(fd, 8.0) * 0.22) * (0.4 + cl);
        c = mix(c, uFog, smoothstep(0.09, -0.03, h) * 0.9);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

// ───────────────────────── Banners ─────────────────────────

export function flagMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aSway; attribute vec3 color; uniform float uTime; varying float vShade; varying vec3 vCol;
      void main() {
        vCol = color;
        float w = sin(uTime * 3.4 - aSway * 5.0 + position.x * 0.7 + position.z * 0.5);
        vec3 p = position + normal * w * aSway * 0.3;
        vShade = 0.78 + 0.22 * w;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying float vShade; varying vec3 vCol;
      void main() {
        gl_FragColor = vec4(vCol * vShade, 1.0);
        #include <fog_fragment>
      }`,
  });
}

/**
 * Long banner hung from its top edge: aSway goes from 0 at the top edge to 1 at the hem; the hem is cut into a swallowtail;
 * a trim band (trim color) runs across the middle
 */
export function banner(w: number, h: number, m: THREE.Matrix4, col: number, trim: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h, 2, 8);
  const p = g.attributes.position;
  const sway = new Float32Array(p.count);
  const colors = new Float32Array(p.count * 3);
  const c0 = new THREE.Color(col);
  const c1 = new THREE.Color(trim);
  for (let i = 0; i < p.count; i++) {
    const s = (h / 2 - p.getY(i)) / h;
    sway[i] = s;
    // swallowtail: the center of the hem is notched upward
    if (s > 0.99 && Math.abs(p.getX(i)) < 1e-3) p.setY(i, p.getY(i) + h * 0.16);
    const cc = s > 0.22 && s < 0.34 ? c1 : c0;
    colors[i * 3] = cc.r;
    colors[i * 3 + 1] = cc.g;
    colors[i * 3 + 2] = cc.b;
  }
  g.translate(0, -h / 2, 0);
  g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  g.applyMatrix4(m);
  return g.toNonIndexed();
}

/**
 * A string of small triangular pennants: hung from a to b (sagging sag meters in the middle), n flags alternating through
 * the colors in cols. Attributes are the same as banner (position, normal, color, aSway), so it can be merged into the same
 * mesh as the banners.
 */
export function pennants(a: THREE.Vector3, b: THREE.Vector3, n: number, cols: number[], sag = 1): THREE.BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const sway: number[] = [];
  const dir = b.clone().sub(a);
  const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  const c = new THREE.Color();
  const at = (t: number) => a.clone().lerp(b, t).add(new THREE.Vector3(0, -4 * sag * t * (1 - t), 0));
  for (let i = 0; i < n; i++) {
    const t0 = (i + 0.2) / n;
    const t1 = (i + 0.8) / n;
    const p0 = at(t0);
    const p1 = at(t1);
    const tip = at((t0 + t1) / 2).add(new THREE.Vector3(0, -0.62, 0));
    c.set(cols[i % cols.length]);
    for (const [p, s] of [
      [p0, 0],
      [p1, 0],
      [tip, 1],
    ] as const) {
      pos.push(p.x, p.y, p.z);
      nrm.push(side.x, side.y, side.z);
      col.push(c.r, c.g, c.b);
      sway.push(s);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ───────────────────────── Glowing disc ─────────────────────────

let discTex: THREE.Texture | null = null;
/** Soft-edged round glow texture (shared) */
export function glowDiscTex(): THREE.Texture {
  if (discTex) return discTex;
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const rg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, size, size);
  discTex = new THREE.CanvasTexture(cv);
  return discTex;
}

export function disposeShared(): void {
  discTex?.dispose();
  discTex = null;
}
