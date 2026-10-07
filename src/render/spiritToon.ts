// Toon material for spirits (post-process outline version): MeshToonMaterial + a stepped gradient texture, with lighting driven by the LIGHT globals in toon.ts,
// so each arena's color grading, the ultimates' animation of LIGHT, and the temporary overrides in the codex thumbnails all keep working without scene lights.
// Light and shade match the old toonMaterial (the terminator is at N·L = 0, the lit band at 0.585), plus hard specular highlights for metal and gems.
// The old material's uniform names (uColor, uFlashAmt, uOpacity, uCorrupt, uEmissiveAmt, ...) are kept, so ultimate scripts need no change.
// The outline is not in the material: the mesh enables INK_LAYER, and the post-process edge detection in render/ink.ts draws the line.

import * as THREE from 'three';
import { FX_TIME, LIGHT } from './toon.ts';

/** Surface finish: matte is the default (the same three steps as the old material), metal has four steps plus a hard specular, gem has three steps plus a hard specular (facets come from the geometry's flat normals) */
export type SpiritSurface = 'matte' | 'metal' | 'gem';

export interface SpiritUniforms {
  uColor: { value: THREE.Color };
  uEmissive: { value: THREE.Color };
  uEmissiveAmt: { value: number };
  uFlash: { value: THREE.Color };
  uFlashAmt: { value: number };
  uRim: { value: number };
  uOpacity: { value: number };
  uCorrupt: { value: number };
  /** Wither (0 to 1): the color is drained to dry brown and the glow dies with it; used by sylvaron's ultimate */
  uWither: { value: number };
  /** Emissive multiplier (Creature.setGlowMul) */
  uGlowMul: { value: number };
  [key: string]: { value: unknown };
}

export type SpiritMaterial = THREE.MeshToonMaterial & { uniforms: SpiritUniforms; isSpiritMaterial: true };

function ramp(stops: [number, number][]): THREE.DataTexture {
  const N = 256;
  const data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const d = (i / (N - 1)) * 2 - 1;
    let v = stops[0][1];
    for (const [th, val] of stops) if (d >= th) v = val;
    const b = Math.round(v * 255);
    data.set([b, b, b, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, N, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

// Brightness 0 = shade color, 1 = base color; matte's 0.733 corresponds to the old material's 0.55 / 0.75
const RAMPS: Record<SpiritSurface, THREE.DataTexture> = {
  matte: ramp([[-1, 0], [0, 0.733], [0.585, 1]]),
  metal: ramp([[-1, 0], [-0.1, 0.45], [0.3, 0.78], [0.66, 1]]),
  gem: ramp([[-1, 0.15], [0.05, 0.75], [0.55, 1]]),
};
const SPEC: Record<SpiritSurface, [number, number]> = { matte: [0, 1], metal: [0.55, 0.9], gem: [0.45, 0.88] };

/** Noise and crack distance for corruption (shared with the experimental material) */
export const CORRUPT_FUNCS = /* glsl */ `
float chash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float cnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(chash(i), chash(i + vec3(1, 0, 0)), u.x), mix(chash(i + vec3(0, 1, 0)), chash(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(chash(i + vec3(0, 0, 1)), chash(i + vec3(1, 0, 1)), u.x), mix(chash(i + vec3(0, 1, 1)), chash(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
vec3 chash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
float crackEdge(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = g + chash3(i + g) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(d2) - sqrt(d1);
}
`;

/** Corruption shading: col is the color variable to modify, fres is the rim factor (the cube of 1 − N·V), obj is the object-space position; needs uCorrupt, uTime */
export function corruptGlsl(col: string, fres: string, obj: string): string {
  return /* glsl */ `
  if (uCorrupt > 0.0) {
    float lum = dot(${col}, vec3(0.299, 0.587, 0.114));
    ${col} = mix(${col}, vec3(0.07, 0.025, 0.1) + lum * vec3(0.22, 0.1, 0.27), 0.88 * uCorrupt);
    ${col} += vec3(0.95, 0.1, 0.62) * smoothstep(0.35, 0.7, ${fres}) * 0.6 * uCorrupt;
    vec3 q = ${obj} * 5.5;
    q += (vec3(cnoise(q * 1.7), cnoise(q * 1.7 + 5.0), cnoise(q * 1.7 + 9.0)) - 0.5) * 0.7;
    float e = crackEdge(q);
    float vein = 1.0 - smoothstep(0.05, 0.13, e);
    float crackMask = smoothstep(0.22, 0.45, cnoise(${obj} * 2.2 + 3.0));
    vein *= crackMask;
    float pulse = 0.6 + 0.4 * sin(uTime * 3.0 - ${obj}.y * 9.0);
    ${col} = mix(${col}, vec3(0.2, 0.02, 0.2), (1.0 - smoothstep(0.12, 0.26, e)) * uCorrupt * 0.6 * crackMask);
    ${col} = mix(${col}, vec3(2.2, 0.25, 1.5) * pulse, vein * uCorrupt);
  }
`;
}

/** Wither shading: col blends toward a dry brown of its own luminance (luminance is capped, so glowing parts also die down to dark brown); needs uWither */
export function witherGlsl(col: string): string {
  return /* glsl */ `
  if (uWither > 0.0) {
    float wl = min(dot(${col}, vec3(0.299, 0.587, 0.114)), 0.55);
    ${col} = mix(${col}, vec3(0.13, 0.09, 0.045) + wl * vec3(0.62, 0.47, 0.29), uWither);
  }`;
}

const PARS = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform float uEmissiveAmt;
uniform vec3 uFlash;
uniform float uFlashAmt;
uniform float uRim;
uniform float uOpacity;
uniform float uCorrupt;
uniform float uWither;
uniform float uGlowMul;
uniform float uTime;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform vec3 uRimColor;
uniform vec3 uShadowTint;
uniform float uSpec;
uniform float uSpecTh;
varying vec3 vSpObj;
${CORRUPT_FUNCS}
`;

// Replaces MeshToonMaterial's whole lighting chunk: look up the gradient texture for the stepped shading, everything else matches the old material
const SHADE = /* glsl */ `
  vec3 spN = normal;
  vec3 spV = normalize(vViewPosition);
  vec3 spL = normalize((viewMatrix * vec4(uLightDir, 0.0)).xyz);
  float spNdl = dot(spN, spL);
  float spLit = texture2D(gradientMap, vec2(spNdl * 0.5 + 0.5, 0.5)).r;
  vec3 spBase = diffuseColor.rgb;
  vec3 spShade = spBase * mix(uShadowTint * 0.62, vec3(1.0), 0.35);
  vec3 spCol = mix(spShade, spBase, spLit);
  spCol *= mix(uAmbient * 1.35, vec3(1.08), 0.55);
  float spFres = pow(clamp(1.0 - dot(spN, spV), 0.0, 1.0), 3.0);
  spCol += uRimColor * smoothstep(0.35, 0.6, spFres) * uRim * (0.4 + 0.6 * max(spNdl, 0.0));
  if (uSpec > 0.0) {
    float spH = dot(spN, normalize(spL + spV));
    spCol += mix(vec3(1.0), spBase, 0.35) * smoothstep(uSpecTh - 0.012, uSpecTh + 0.012, spH) * uSpec;
  }
  spCol += uEmissive * uEmissiveAmt * uGlowMul;
${corruptGlsl('spCol', 'spFres', 'vSpObj')}
${witherGlsl('spCol')}
  spCol = mix(spCol, uFlash, uFlashAmt);
`;

export interface SpiritMatOpts {
  emissive?: THREE.ColorRepresentation;
  emissiveAmt?: number;
  rim?: number;
  surface?: SpiritSurface;
}

export function spiritMaterial(color: THREE.ColorRepresentation, o: SpiritMatOpts = {}): SpiritMaterial {
  const surface = o.surface ?? 'matte';
  const m = new THREE.MeshToonMaterial({ gradientMap: RAMPS[surface] }) as SpiritMaterial;
  const [spec, specTh] = SPEC[surface];
  const u: SpiritUniforms = {
    uColor: { value: new THREE.Color(color) },
    uEmissive: { value: new THREE.Color(o.emissive ?? 0x000000) },
    uEmissiveAmt: { value: o.emissiveAmt ?? 0 },
    uFlash: { value: new THREE.Color(1, 1, 1) },
    uFlashAmt: { value: 0 },
    uRim: { value: o.rim ?? 0.55 },
    uOpacity: { value: 1 },
    uCorrupt: { value: 0 },
    uWither: { value: 0 },
    uGlowMul: { value: 1 },
    uTime: FX_TIME,
    uLightDir: LIGHT.dir,
    uAmbient: LIGHT.ambient,
    uRimColor: LIGHT.rimColor,
    uShadowTint: LIGHT.shadowTint,
    uSpec: { value: spec },
    uSpecTh: { value: specTh },
  };
  m.uniforms = u;
  m.isSpiritMaterial = true;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSpObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpObj = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PARS)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( uColor, uOpacity );')
      .replace('#include <lights_fragment_begin>', SHADE)
      .replace('#include <lights_fragment_maps>', '')
      .replace('#include <lights_fragment_end>', '')
      .replace('#include <aomap_fragment>', '')
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', 'vec3 outgoingLight = spCol;');
  };
  return m;
}

/**
 * Toon material for scenery (arena props, buildings, map characters): the same MeshToon shading as the spirits, with the outline from inkScenery() in ink.ts.
 * Parameters keep the old toonMaterial's rim, emissive, emissiveAmt, opacity, so callers need no parameter changes when switching materials.
 */
export function sceneMaterial(color: THREE.ColorRepresentation, o: SpiritMatOpts & { opacity?: number } = {}): SpiritMaterial {
  const m = spiritMaterial(color, { rim: 0.35, ...o });
  if (o.opacity !== undefined && o.opacity < 1) {
    m.uniforms.uOpacity.value = o.opacity;
    m.transparent = true;
  }
  return m;
}

/** Material opacity: spirit materials read uOpacity, other materials read opacity (so the outline fades with it) */
export function materialOpacity(m: THREE.Material): number {
  const u = (m as Partial<SpiritMaterial>).uniforms;
  return u && 'uOpacity' in u ? (u.uOpacity.value as number) : m.opacity;
}
