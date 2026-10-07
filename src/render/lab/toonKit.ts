// Toon materials for spirits (shared by the lab and the game): MeshToonMaterial plus a stepped gradient texture, with added rim light, hard metal specular highlights and stone mottling.
// Lighting does not use scene lights; it reads LIGHT and SPIRIT_RIG. Outlines are not made in the material but left to post-process edge detection (the lab's inkPipeline, the game's render/ink.ts).

import * as THREE from 'three';
import { corruptGlsl, CORRUPT_FUNCS, type SpiritMaterial, witherGlsl } from '../spiritToon.ts';
import { FX_TIME, LIGHT } from '../toon.ts';

/** Rim light shared by the whole scene: world is the world-space direction toward the light (the material converts it to view space in the shader); dir is the old per-frame converted value, kept for old callers */
export const RIM = {
  world: new THREE.Vector3(-0.55, 0.6, -1).normalize(),
  dir: { value: new THREE.Vector3(0, 0, -1) },
  color: { value: new THREE.Color(0xbfe4ff) },
};

/** Call every frame: converts the rim light direction into the camera's view space */
export function updateRim(camera: THREE.Camera): void {
  RIM.dir.value.copy(RIM.world).transformDirection(camera.matrixWorldInverse);
}

/**
 * Gradient texture: stops are [dotNL threshold, brightness], ordered dark to light. The texture has 256 cells with nearest sampling,
 * so where the light/shadow boundary falls is set by the thresholds, not limited by the cell count.
 */
export function rampTexture(stops: [number, number][]): THREE.DataTexture {
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

/** Light/shadow for three steps (stone, gem) and four steps (metal) */
export const RAMPS = {
  stone: rampTexture([[-1, 0.46], [0.0, 0.74], [0.52, 1]]),
  metal: rampTexture([[-1, 0.26], [-0.08, 0.5], [0.34, 0.78], [0.7, 1]]),
  gem: rampTexture([[-1, 0.55], [0.12, 0.8], [0.6, 1]]),
};

export interface LabToonOpts {
  ramp?: keyof typeof RAMPS;
  /** Rim light strength */
  rim?: number;
  /** Rim light color: if omitted, the scene-wide RIM.color is used; set it separately when a character needs to match its own main color */
  rimColor?: THREE.ColorRepresentation;
  /** Hard specular strength (metal, polished stone) */
  spec?: number;
  /** Hard specular threshold (N·H); the higher it is, the smaller the highlight */
  specTh?: number;
  /** Stone mottling strength */
  speckle?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveAmt?: number;
}

/**
 * Spirit lighting, shared by the lab and the game. The key light direction is read from LIGHT.dir; the key light's color and intensity and the sky's top and bottom colors are fixed values (the same rig the lab originally used).
 * Sky light, ground bounce and rim light are then tinted by the ratio of LIGHT's ambient, shadowTint and rimColor to their defaults (tint is the weight of the tinting),
 * so each arena's color grading, and the summon and intro animations that change LIGHT, all still work without any lights in the scene.
 * When invAces = 1 an inverse ACES is applied last: the game's output applies ACES tone mapping (exposure), so it is inverted first,
 * and the color the spirit finally displays equals what the lab (no tone mapping) shows. The lab sets it to 0.
 */
function mat3Rows(r: number[]): THREE.Matrix3 {
  return new THREE.Matrix3().set(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]);
}
// The two matrices used by three's ACESFilmicToneMapping (written as columns in GLSL, as rows here), inverted
const ACES_IN = mat3Rows([0.59719, 0.35458, 0.04823, 0.076, 0.90834, 0.01566, 0.0284, 0.13383, 0.83777]);
const ACES_OUT = mat3Rows([1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602]);

export const SPIRIT_RIG = {
  key: { value: new THREE.Color(0xfff2de).multiplyScalar(2.75) },
  sky: { value: new THREE.Color(0xd6e4ff).multiplyScalar(0.95) },
  ground: { value: new THREE.Color(0xb3a58e).multiplyScalar(0.95) },
  tint: { value: 0.6 },
  ambientRef: { value: LIGHT.ambient.value.clone() },
  shadowRef: { value: LIGHT.shadowTint.value.clone() },
  rimRef: { value: LIGHT.rimColor.value.clone() },
  invAces: { value: 1 },
  exposure: { value: 1.05 },
  acesInInv: { value: ACES_IN.clone().invert() },
  acesOutInv: { value: ACES_OUT.clone().invert() },
};

const PARS = /* glsl */ `
uniform vec3 uRimWorld;
uniform vec3 uRimColor;
uniform float uRim;
uniform float uSpec;
uniform float uSpecTh;
uniform float uSpeckle;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uSky;
uniform vec3 uGround;
uniform float uTint;
uniform vec3 uAmbient;
uniform vec3 uAmbientRef;
uniform vec3 uShadowTint;
uniform vec3 uShadowRef;
uniform vec3 uLightRim;
uniform vec3 uRimRef;
uniform vec3 uFlash;
uniform float uFlashAmt;
uniform float uOpacity;
uniform float uCorrupt;
uniform float uWither;
uniform float uGlowMul;
uniform float uBack;
uniform vec3 uBackCol;
uniform float uTime;
uniform float uInvAces;
uniform float uExposure;
uniform mat3 uAcesInInv;
uniform mat3 uAcesOutInv;
varying vec3 vLabObj;
float labHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float labNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(labHash(i), labHash(i + vec3(1, 0, 0)), f.x), mix(labHash(i + vec3(0, 1, 0)), labHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(labHash(i + vec3(0, 0, 1)), labHash(i + vec3(1, 0, 1)), f.x), mix(labHash(i + vec3(0, 1, 1)), labHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
${CORRUPT_FUNCS}
// Inverse ACES: c is the linear color to be displayed; returns the value before it goes into ACES. The inverse of RRTAndODTFit is the positive root of a quadratic equation
vec3 labInvAces(vec3 c) {
  vec3 y = clamp(uAcesOutInv * clamp(c, 0.0, 0.985), 0.0, 0.985);
  vec3 A = 0.983729 * y - 1.0;
  vec3 B = 0.432951 * y - 0.0245786;
  vec3 C = 0.238081 * y + 0.000090537;
  vec3 v = max((-B - sqrt(max(B * B - 4.0 * A * C, 0.0))) / (2.0 * A), 0.0);
  return max(uAcesInInv * v, 0.0) * 0.6 / uExposure;
}
`;

// Stone: large light/dark mottling plus scattered small pores; changes only the base color, not the number of shading steps; opacity follows fades in and out
const SPECKLE = /* glsl */ `
if (uSpeckle > 0.0) {
  float mott = labNoise(vLabObj * 6.5) * 0.65 + labNoise(vLabObj * 17.0) * 0.35;
  float pit = smoothstep(0.8, 0.86, labNoise(vLabObj * 46.0 + 7.0));
  diffuseColor.rgb *= 1.0 + (mott - 0.5) * uSpeckle - pit * uSpeckle * 0.8;
}
diffuseColor.a *= uOpacity;
`;

// Replaces scene lights: the key light looks up the gradient texture (same as MeshToonMaterial's getGradientIrradiance), and sky light interpolates between the top and bottom colors by how much the normal faces up
const LIGHTS = /* glsl */ `
{
  vec3 labL = normalize((viewMatrix * vec4(uKeyDir, 0.0)).xyz);
  vec3 labUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float labNdl = dot(normal, labL);
  vec3 labGrad = vec3(texture2D(gradientMap, vec2(labNdl * 0.5 + 0.5, 0.0)).r);
  reflectedLight.directDiffuse += labGrad * uKeyCol * material.diffuseColor * RECIPROCAL_PI;
  vec3 labTA = mix(vec3(1.0), uAmbient / max(uAmbientRef, vec3(1e-3)), uTint);
  vec3 labTS = mix(vec3(1.0), uShadowTint / max(uShadowRef, vec3(1e-3)), uTint);
  float labW = 0.5 * dot(normal, labUp) + 0.5;
  reflectedLight.indirectDiffuse += mix(uGround * labTS, uSky * labTA, labW) * material.diffuseColor * RECIPROCAL_PI;
}
`;

// Rim light: lands only where the surface faces the rim light and is near the silhouette, with a little of the base color
// Hard specular: the key light's half vector, thresholded into patches of bright spots
// After that, in order: corruption, hit white flash, inverse ACES
const RIM_SPEC = /* glsl */ `
{
  vec3 labV = normalize(vViewPosition);
  float labF = 1.0 - saturate(dot(normal, labV));
  vec3 labRimDir = normalize((viewMatrix * vec4(uRimWorld, 0.0)).xyz);
  float labRim = smoothstep(0.58, 0.66, labF) * smoothstep(-0.15, 0.25, dot(normal, labRimDir));
  vec3 labTR = mix(vec3(1.0), uLightRim / max(uRimRef, vec3(1e-3)), uTint);
  outgoingLight += uRimColor * labTR * (0.45 + 0.55 * diffuseColor.rgb) * labRim * uRim;
  if (uSpec > 0.0) {
    vec3 labH = normalize(normalize((viewMatrix * vec4(uKeyDir, 0.0)).xyz) + labV);
    // The transition width shrinks with the threshold: as the threshold nears 1 a fixed width would become a very wide angle and the highlight would smear into one blob
    float labSW = max(0.0015, (1.0 - uSpecTh) * 0.12);
    float labS = smoothstep(uSpecTh - labSW, uSpecTh + labSW, dot(normal, labH));
    outgoingLight += uKeyCol * mix(vec3(1.0), diffuseColor.rgb, 0.35) * labS * uSpec * 0.32;
  }
  float labFres = labF * labF * labF;
  ${corruptGlsl('outgoingLight', 'labFres', 'vLabObj')}
  ${witherGlsl('outgoingLight')}
  // Backlight (for cutscenes, Creature.setBacklight): a wide rim light along the top of the silhouette that overrides the base color; its direction is up on the screen and slightly toward the back of the camera.
  // An ordinary rim light is only a few pixels along the silhouette edge and gets eaten by the outline; this one is wide enough that the form is visible even in a night silhouette
  if (uBack > 0.0) {
    vec3 labBUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    vec3 labBDir = normalize(labBUp + vec3(0.0, 0.0, -0.45));
    float labB = smoothstep(0.42, 0.54, labF) * smoothstep(-0.15, 0.35, dot(normal, labBDir));
    outgoingLight = mix(outgoingLight, uBackCol, labB * uBack);
  }
  outgoingLight = mix(outgoingLight, uFlash, uFlashAmt);
  if (uInvAces > 0.5) outgoingLight = labInvAces(outgoingLight);
}
`;

/**
 * Spirit material (shared by the lab and the game). The returned uniforms keep the names of the game's old material: uColor and uEmissive point straight at the material's color and emissive,
 * uEmissiveAmt reads and writes emissiveIntensity, and uFlash, uFlashAmt, uOpacity and uCorrupt serve the hit white flash, fades and corruption, so Creature and ultimate scripts can drive them directly.
 */
export function labToon(color: THREE.ColorRepresentation, o: LabToonOpts = {}): SpiritMaterial {
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: RAMPS[o.ramp ?? 'stone'],
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveAmt ?? 1,
  }) as SpiritMaterial;
  const R = SPIRIT_RIG;
  const u = {
    uRimWorld: { value: RIM.world },
    uRimColor: o.rimColor !== undefined ? { value: new THREE.Color(o.rimColor) } : RIM.color,
    uRim: { value: o.rim ?? 0.5 },
    uSpec: { value: o.spec ?? 0 },
    uSpecTh: { value: o.specTh ?? 0.95 },
    uSpeckle: { value: o.speckle ?? 0 },
    uKeyDir: LIGHT.dir,
    uKeyCol: R.key,
    uSky: R.sky,
    uGround: R.ground,
    uTint: R.tint,
    uAmbient: LIGHT.ambient,
    uAmbientRef: R.ambientRef,
    uShadowTint: LIGHT.shadowTint,
    uShadowRef: R.shadowRef,
    uLightRim: LIGHT.rimColor,
    uRimRef: R.rimRef,
    uFlash: { value: new THREE.Color(1, 1, 1) },
    uFlashAmt: { value: 0 },
    uOpacity: { value: 1 },
    uCorrupt: { value: 0 },
    uWither: { value: 0 },
    uGlowMul: { value: 1 },
    uBack: { value: 0 },
    uBackCol: { value: new THREE.Color(1, 0.77, 0.35) },
    uTime: FX_TIME,
    uInvAces: R.invAces,
    uExposure: R.exposure,
    uAcesInInv: R.acesInInv,
    uAcesOutInv: R.acesOutInv,
  };
  m.userData.u = u;
  m.uniforms = {
    uColor: { value: m.color },
    uEmissive: { value: m.emissive },
    uEmissiveAmt: {
      get value() {
        return m.emissiveIntensity;
      },
      set value(v: number) {
        m.emissiveIntensity = v;
      },
    },
    uFlash: u.uFlash,
    uFlashAmt: u.uFlashAmt,
    uRim: u.uRim,
    uOpacity: u.uOpacity,
    uCorrupt: u.uCorrupt,
    uWither: u.uWither,
    uGlowMul: u.uGlowMul,
    uBack: u.uBack,
    uBackCol: u.uBackCol,
  };
  m.isSpiritMaterial = true;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLabObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLabObj = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PARS)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + SPECKLE)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uGlowMul;')
      .replace('#include <lights_fragment_begin>', LIGHTS)
      .replace('#include <lights_fragment_maps>', '')
      .replace('#include <lights_fragment_end>', '')
      .replace('#include <opaque_fragment>', RIM_SPEC + '\n#include <opaque_fragment>');
  };
  return m;
}
