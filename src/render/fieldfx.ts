// Field effects: when a spirit unfolds Downpour / Blazing Sun / Verdant Domain / Gale / Sandstorm / Thundercloud / Sanctuary / Eternal Night, the whole battlefield is rewritten like a Yu-Gi-Oh field spell:
// the sky, fog, lighting, ground, surroundings and particles all become that field's look; when it unfolds a wall of light sweeps across the field from the center, and when it ends the wall recedes and everything is restored.
// It depends only on the members the Arena interface exposes, and all its own objects hang from the root the caller provides (not in arena.group);
// set(null) and dispose() fully restore the global state (LIGHT, sky, fog, hemisphere / directional light, exposure, stars).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Arena } from './arena.ts';
import { LIGHT } from './toon.ts';
import { inkScenery } from './ink.ts';
import { sceneMaterial } from './spiritToon.ts';
import { axisBillboard, disposeFx, taperedTube, type Vfx } from './vfx.ts';
import type { Stage } from './stage.ts';
import { ease, type Tweens } from './tween.ts';
import { glowTex, runeCircleTex } from './textures.ts';
import { crackTex, rayTex } from './fxtex.ts';
import type { Element } from '../../sim/types.ts';

export type FieldElement = Exclude<Element, 'neutral'>;

/** Main / bright color per element (matches ELEMENT_COLOR in battle/scene.ts; not imported from there to avoid a circular import) */
const COL: Record<FieldElement, number> = { water: 0x3db7ff, fire: 0xff6a2b, nature: 0x5fcb5a, wind: 0x9fe8e0, earth: 0xc49a5a, thunder: 0xc8a0ff, light: 0xffe680, dark: 0x9a5aff };
const BRIGHT: Record<FieldElement, number> = { water: 0xbff3ff, fire: 0xffd27a, nature: 0xd8f59a, wind: 0xffffff, earth: 0xffe0a0, thunder: 0xfff6a8, light: 0xffffff, dark: 0xff6ab0 };

const UP = new THREE.Vector3(0, 1, 0);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Environment objects appear staggered by distance from the center: wherever the wall of light has swept, things rise */
const stag = (p: number, d: number) => clamp01(p * 1.4 - (d / 26) * 0.4);

/** Seeded random numbers, so the same field is laid out the same way every time it unfolds */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Pick a position inside a ring: avoid the camera direction (-x, +z), and with back only take the half away from the camera */
function ringPos(r: () => number, rMin: number, rMax: number, back = false): [number, number] {
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2;
    const d = rMin + r() * (rMax - rMin);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (x < 2 && z > 2) continue;
    if (back && z > 4) continue;
    return [x, z];
  }
  return [rMax, -rMax * 0.5];
}

// ───────────────────────── Sky / fog / light ─────────────────────────

interface Atmos {
  sky: [THREE.Color, THREE.Color, THREE.Color];
  fog: THREE.Color;
  fogNear: number;
  fogFar: number;
  ambient: THREE.Color;
  rim: THREE.Color;
  shadow: THREE.Color;
  hemi: THREE.Color;
  hemiGround: THREE.Color;
  sunColor: THREE.Color;
  sunI: number;
  exposure: number;
}

/** Target tint per field; W is the blend fraction. It blends rather than replaces, so both bright and dark fields show a change while keeping the region's character */
interface AtmosSpec {
  sky: [number, number, number];
  skyW: number;
  fog: number;
  fogW: number;
  fogNear: number;
  fogFar: number;
  ambient: number;
  rim: number;
  shadow: number;
  lightW: number;
  hemi: number;
  hemiGround: number;
  sunColor: number;
  sunI: number;
  exposure: number;
  stars?: boolean;
}

const ATMOS: Record<FieldElement, AtmosSpec> = {
  water: { sky: [0x24304a, 0x4a5c74, 0x76889a], skyW: 0.82, fog: 0x5a6c80, fogW: 0.75, fogNear: 12, fogFar: 62, ambient: 0x6a7a9a, rim: 0xaad0ff, shadow: 0x3a4a70, lightW: 0.55, hemi: 0x5a6a88, hemiGround: 0x3a4050, sunColor: 0xc8d8f0, sunI: 1.0, exposure: 0.92 },
  fire: { sky: [0xff9a3a, 0xffd28a, 0xfff2d0], skyW: 0.8, fog: 0xf0c890, fogW: 0.55, fogNear: 26, fogFar: 110, ambient: 0xe0b890, rim: 0xfff0c0, shadow: 0x8a4a30, lightW: 0.5, hemi: 0xffd090, hemiGround: 0xa06030, sunColor: 0xffe0b0, sunI: 1.8, exposure: 1.1 },
  nature: { sky: [0x2f6a3a, 0x72b86a, 0xcfe8a6], skyW: 0.7, fog: 0x8fc890, fogW: 0.7, fogNear: 18, fogFar: 72, ambient: 0x9ac89a, rim: 0xf0ffb0, shadow: 0x2e5a48, lightW: 0.5, hemi: 0x8ad880, hemiGround: 0x3a6a30, sunColor: 0xf0ffc0, sunI: 1.5, exposure: 1.0 },
  wind: { sky: [0x4e9cd0, 0xa8dcea, 0xe2f2f4], skyW: 0.55, fog: 0xc8e6ea, fogW: 0.45, fogNear: 26, fogFar: 110, ambient: 0xa0c4cc, rim: 0xe0f6ff, shadow: 0x5a8aa0, lightW: 0.4, hemi: 0xa8d4dc, hemiGround: 0x6a9aa0, sunColor: 0xf0fbff, sunI: 1.3, exposure: 0.97 },
  earth: { sky: [0x9a7038, 0xcf9c58, 0xe8c48c], skyW: 0.85, fog: 0xc8a068, fogW: 0.7, fogNear: 11, fogFar: 48, ambient: 0xb09060, rim: 0xffe0a0, shadow: 0x5a4020, lightW: 0.55, hemi: 0xd0a060, hemiGround: 0x8a6030, sunColor: 0xf0c890, sunI: 1.3, exposure: 1.0 },
  thunder: { sky: [0x100822, 0x2c1c4c, 0x4c3a6e], skyW: 0.85, fog: 0x3a2c58, fogW: 0.75, fogNear: 15, fogFar: 70, ambient: 0x6a5a90, rim: 0xe0c8ff, shadow: 0x2a1c48, lightW: 0.6, hemi: 0x5a4a80, hemiGround: 0x2a2040, sunColor: 0xd0c0ff, sunI: 1.1, exposure: 0.95 },
  light: { sky: [0xf6d488, 0xffeccc, 0xfff6e6], skyW: 0.7, fog: 0xf8ecd4, fogW: 0.5, fogNear: 30, fogFar: 120, ambient: 0xcabfae, rim: 0xfff4d8, shadow: 0xb8a8c8, lightW: 0.5, hemi: 0xf6e4b4, hemiGround: 0xb8a898, sunColor: 0xfff0c8, sunI: 1.4, exposure: 1.0 },
  dark: { sky: [0x08040f, 0x1c0e30, 0x3c1a52], skyW: 0.9, fog: 0x22103a, fogW: 0.8, fogNear: 12, fogFar: 60, ambient: 0x5a4a80, rim: 0xc090ff, shadow: 0x1a0c2c, lightW: 0.6, hemi: 0x3a2a60, hemiGround: 0x1a1030, sunColor: 0xa090d0, sunI: 1.0, exposure: 0.88, stars: true },
};

function readAtmos(arena: Arena, stage: Stage): Atmos {
  const u = arena.skyMat.uniforms;
  return {
    sky: [(u.top.value as THREE.Color).clone(), (u.mid.value as THREE.Color).clone(), (u.bot.value as THREE.Color).clone()],
    fog: arena.fog.color.clone(),
    fogNear: arena.fog.near,
    fogFar: arena.fog.far,
    ambient: LIGHT.ambient.value.clone(),
    rim: LIGHT.rimColor.value.clone(),
    shadow: LIGHT.shadowTint.value.clone(),
    hemi: arena.hemi.color.clone(),
    hemiGround: arena.hemi.groundColor.clone(),
    sunColor: arena.sun.color.clone(),
    sunI: arena.sun.intensity,
    exposure: stage.renderer.toneMappingExposure,
  };
}

function writeAtmos(arena: Arena, stage: Stage, a: Atmos): void {
  const u = arena.skyMat.uniforms;
  (u.top.value as THREE.Color).copy(a.sky[0]);
  (u.mid.value as THREE.Color).copy(a.sky[1]);
  (u.bot.value as THREE.Color).copy(a.sky[2]);
  arena.fog.color.copy(a.fog);
  arena.fog.near = a.fogNear;
  arena.fog.far = a.fogFar;
  LIGHT.ambient.value.copy(a.ambient);
  LIGHT.rimColor.value.copy(a.rim);
  LIGHT.shadowTint.value.copy(a.shadow);
  arena.hemi.color.copy(a.hemi);
  arena.hemi.groundColor.copy(a.hemiGround);
  arena.sun.color.copy(a.sunColor);
  arena.sun.intensity = a.sunI;
  stage.renderer.toneMappingExposure = a.exposure;
}

function cloneAtmos(a: Atmos): Atmos {
  return {
    sky: [a.sky[0].clone(), a.sky[1].clone(), a.sky[2].clone()],
    fog: a.fog.clone(),
    fogNear: a.fogNear,
    fogFar: a.fogFar,
    ambient: a.ambient.clone(),
    rim: a.rim.clone(),
    shadow: a.shadow.clone(),
    hemi: a.hemi.clone(),
    hemiGround: a.hemiGround.clone(),
    sunColor: a.sunColor.clone(),
    sunI: a.sunI,
    exposure: a.exposure,
  };
}

function lerpAtmos(out: Atmos, a: Atmos, b: Atmos, k: number): void {
  for (let i = 0; i < 3; i++) out.sky[i].lerpColors(a.sky[i], b.sky[i], k);
  out.fog.lerpColors(a.fog, b.fog, k);
  out.fogNear = a.fogNear + (b.fogNear - a.fogNear) * k;
  out.fogFar = a.fogFar + (b.fogFar - a.fogFar) * k;
  out.ambient.lerpColors(a.ambient, b.ambient, k);
  out.rim.lerpColors(a.rim, b.rim, k);
  out.shadow.lerpColors(a.shadow, b.shadow, k);
  out.hemi.lerpColors(a.hemi, b.hemi, k);
  out.hemiGround.lerpColors(a.hemiGround, b.hemiGround, k);
  out.sunColor.lerpColors(a.sunColor, b.sunColor, k);
  out.sunI = a.sunI + (b.sunI - a.sunI) * k;
  out.exposure = a.exposure + (b.exposure - a.exposure) * k;
}

/** Target value = the region's original color blended toward the field tint (the fraction set by spec); blending in sRGB space matches the visual proportion (in linear space, blending 90% toward a dark color still looks mid-tone) */
/** How bright the field itself is (0 dark to 1 bright): the average sRGB luminance of the sky mid-band, the horizon and the fog */
function arenaBrightness(base: Atmos): number {
  const lum = (c: THREE.Color) => {
    const s = c.clone().convertLinearToSRGB();
    return 0.2126 * s.r + 0.7152 * s.g + 0.0722 * s.b;
  };
  return (lum(base.sky[1]) + lum(base.sky[2]) + lum(base.fog)) / 3;
}

/**
 * bright: the field's own brightness. Putting a bright field (Gale, Sanctuary) on a bright region (holy, highland) would wash the whole thing out white,
 * so blends toward "brighter than the original" get a lower fraction and the exposure and sun are pushed down too; blending toward dark (Eternal Night, Downpour) is unaffected.
 */
function goalAtmos(base: Atmos, s: AtmosSpec, bright = 0.5): Atmos {
  const hot = Math.min(1, Math.max(0, (bright - 0.5) / 0.4));
  const lumOf = (c: THREE.Color) => {
    const t = c.clone().convertLinearToSRGB();
    return 0.2126 * t.r + 0.7152 * t.g + 0.0722 * t.b;
  };
  const mix = (c: THREE.Color, hex: number, w: number) => {
    const target = new THREE.Color(hex);
    const w2 = lumOf(target) > lumOf(c) ? w * (1 - hot * 0.55) : w;
    return c.clone().convertLinearToSRGB().lerp(target.convertLinearToSRGB(), w2).convertSRGBToLinear();
  };
  const lerp = (a: number, b: number, w: number) => a + (b - a) * w;
  const sunI = lerp(base.sunI, s.sunI, s.lightW);
  return {
    sky: [mix(base.sky[0], s.sky[0], s.skyW), mix(base.sky[1], s.sky[1], s.skyW), mix(base.sky[2], s.sky[2], s.skyW)],
    fog: mix(base.fog, s.fog, s.fogW),
    fogNear: lerp(base.fogNear, s.fogNear, s.fogW),
    fogFar: lerp(base.fogFar, s.fogFar, s.fogW),
    ambient: mix(base.ambient, s.ambient, s.lightW),
    rim: mix(base.rim, s.rim, s.lightW),
    shadow: mix(base.shadow, s.shadow, s.lightW),
    hemi: mix(base.hemi, s.hemi, s.lightW),
    hemiGround: mix(base.hemiGround, s.hemiGround, s.lightW),
    sunColor: mix(base.sunColor, s.sunColor, s.lightW),
    sunI: sunI > base.sunI ? base.sunI + (sunI - base.sunI) * (1 - hot * 0.7) : sunI,
    exposure: Math.min(s.exposure, base.exposure) - hot * 0.2 + Math.max(0, s.exposure - base.exposure) * (1 - hot),
  };
}

// ───────────────────────── Shaders ─────────────────────────

const NOISE = /* glsl */ `
  float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i); float b = hash21(i + vec2(1.0, 0.0)); float c = hash21(i + vec2(0.0, 1.0)); float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; } return v; }
`;

/** Sky shell: a layer on the inside of the sky dome that, by uMode, draws a cloud layer, a blazing sun, a tree canopy, cloud bands, sand dust, thunderclouds, holy light beams or a red moon */
const SHELL_VERT = /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SHELL_FRAG = /* glsl */ `
  uniform float uMode; uniform float uTime; uniform float uP; uniform float uFlash;
  uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColC; uniform vec3 uSunDir;
  varying vec3 vP;
  ${NOISE}
  float hash3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  void main(){
    vec3 d = normalize(vP);
    float h = d.y;
    float az = atan(d.z, d.x);
    vec4 o = vec4(0.0);
    if (uMode < 1.5) {
      // Downpour: the sky sphere is projected onto a plane, looking like a cloud ceiling pressing down overhead
      vec2 uv = d.xz / max(h + 0.22, 0.06);
      float n = fbm(uv * 0.8 + vec2(uTime * 0.035, uTime * 0.012));
      float cover = smoothstep(0.04, 0.3, h);
      float dens = smoothstep(0.3, 0.75, n);
      vec3 c = mix(uColA, uColB, dens) + uColC * uFlash * (0.5 + dens);
      o = vec4(c, cover * (0.8 + 0.2 * dens));
    } else if (uMode < 2.5) {
      // Blazing Sun: sun disc + corona + wide warm glow, with heat-haze streaks near the horizon
      float s = max(dot(d, uSunDir), 0.0);
      float disc = smoothstep(0.9962, 0.9982, s);
      float corona = pow(s, 90.0);
      float glow = pow(s, 7.0) * 0.4;
      float band = 0.5 + 0.5 * sin(h * 70.0 + uTime * 2.5 + fbm(vec2(az * 4.0, h * 12.0 - uTime * 0.3)) * 5.0);
      float heat = smoothstep(0.22, 0.0, h) * smoothstep(-0.03, 0.02, h) * band * 0.16;
      vec3 c = uColB * disc * 3.0 + uColA * (corona * 1.6 + glow) + uColC * heat;
      o = vec4(c, clamp(disc + corona + glow + heat, 0.0, 1.0));
    } else if (uMode < 3.5) {
      // Grove Domain: a deep green canopy covers the upper sky, with yellow-green light through the gaps
      vec2 uv = d.xz / max(h + 0.3, 0.1);
      float n = fbm(uv * 1.3 + vec2(uTime * 0.012, -uTime * 0.008));
      float leaf = smoothstep(0.34, 0.62, n);
      float cover = smoothstep(0.18, 0.5, h);
      o = vec4(mix(uColB, uColA, leaf), cover * mix(0.3, 0.96, leaf));
    } else if (uMode < 4.5) {
      // Gale: cloud bands flowing quickly along the azimuth
      float n = fbm(vec2(az * 2.2 - uTime * 0.45, h * 8.0) * vec2(1.0, 2.5));
      float streak = smoothstep(0.42, 0.7, n) * smoothstep(0.0, 0.18, h) * smoothstep(0.95, 0.35, h);
      o = vec4(uColA, streak * 0.7);
    } else if (uMode < 5.5) {
      // Sandstorm: heavy yellow sand near the horizon, thinner the higher it goes
      float n = fbm(vec2(az * 3.0 - uTime * 0.3, h * 5.0 - uTime * 0.12));
      float haze = smoothstep(0.5, -0.02, h) * (0.45 + 0.45 * n);
      o = vec4(mix(uColA, uColB, n), clamp(haze, 0.0, 0.8));
    } else if (uMode < 6.5) {
      // Thundercloud: clouds lower and blacker than the Downpour, with the underside lighting up during lightning
      vec2 uv = d.xz / max(h + 0.18, 0.05);
      float n = fbm(uv * 0.9 + vec2(uTime * 0.05, uTime * 0.02));
      float cover = smoothstep(0.03, 0.26, h);
      float dens = smoothstep(0.28, 0.72, n);
      vec3 c = mix(uColA, uColB, dens) + uColC * uFlash * (0.8 + 1.4 * dens);
      o = vec4(c, cover * (0.85 + 0.15 * dens));
    } else if (uMode < 7.5) {
      // Sanctuary: radial holy light beams pouring down from the zenith
      float r1 = pow(0.5 + 0.5 * sin(az * 16.0 + uTime * 0.25), 3.0);
      float r2 = pow(0.5 + 0.5 * sin(az * 6.0 - uTime * 0.15), 4.0);
      float a = smoothstep(0.05, 0.85, h) * (r1 * 0.4 + r2 * 0.4) * 0.5 + smoothstep(0.45, 1.0, h) * 0.3;
      o = vec4(uColA, a);
    } else {
      // Eternal Night: a red moon and halo, plus more stars than usual
      float s = max(dot(d, uSunDir), 0.0);
      float disc = smoothstep(0.99835, 0.9992, s);
      float halo = pow(s, 50.0) * 0.6 + pow(s, 8.0) * 0.12;
      vec3 q = floor(d * 240.0);
      float st = hash3(q);
      float stars = step(0.9955, st) * smoothstep(0.03, 0.35, h) * (0.55 + 0.45 * sin(uTime * 2.5 + st * 60.0));
      vec3 c = uColB * disc * 2.6 + uColA * halo + uColC * stars * 1.6;
      o = vec4(c, clamp(disc + halo + stars, 0.0, 1.0));
    }
    o.a *= uP;
    gl_FragColor = o;
  }
`;

/** Ground outer layer: a disc of radius 15 that, by uMode, draws standing-water ripples, scorched cracks, tundra flowers, airflow lines, blowing sand, lightning patterns, holy patterns or a faint violet glow */
const GROUND_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GROUND_FRAG = /* glsl */ `
  uniform float uMode; uniform float uTime; uniform float uP; uniform float uFlash;
  uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColC; uniform sampler2D tCrack; uniform sampler2D tRune;
  varying vec2 vUv;
  ${NOISE}
  vec2 rot(vec2 p, float a){ float c = cos(a); float s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float edge = smoothstep(1.0, 0.7, r);
    float ang = atan(p.y, p.x);
    vec4 o = vec4(0.0);
    if (uMode < 1.5) {
      // Standing water: cool reflections, with ripples from falling raindrops spreading in rings
      vec2 g = p * 10.0;
      vec2 cell = floor(g);
      vec2 f = fract(g) - 0.5;
      float rings = 0.0;
      for (int i = 0; i < 2; i++) {
        float fi = float(i);
        float hh = hash21(cell + fi * 7.3);
        vec2 c0 = (vec2(hash21(cell + 1.7 + fi), hash21(cell + 3.1 + fi)) - 0.5) * 0.5;
        float tt = fract(uTime * (0.7 + 0.3 * fi) + hh);
        float dist = length(f - c0);
        rings += smoothstep(0.035, 0.0, abs(dist - tt * 0.42)) * (1.0 - tt) * step(0.35, hh);
      }
      float sheen = 0.5 + 0.5 * vnoise(p * 3.0 + uTime * 0.1);
      o = vec4(uColA + uColB * rings * 2.0 + uColC * sheen * 0.15, (0.34 + rings * 0.6) * edge);
    } else if (uMode < 2.5) {
      // Scorched earth: yellow-brown ground with pulsing glowing cracks (transparent areas of the canvas texture have white RGB, so take alpha)
      float ck = pow(texture2D(tCrack, vUv).a, 3.0) * smoothstep(1.0, 0.45, r);
      float pulse = 0.7 + 0.3 * sin(uTime * 2.5 + r * 7.0);
      o = vec4(mix(uColA, uColB * 1.8, ck * pulse), (0.48 + ck * 0.35) * edge);
    } else if (uMode < 3.5) {
      // Moss field: green turf with scattered small flowers
      vec2 g = p * 14.0;
      vec2 cell = floor(g);
      vec2 f = fract(g) - 0.5;
      float hh = hash21(cell);
      vec2 c0 = (vec2(hash21(cell + 1.3), hash21(cell + 2.9)) - 0.5) * 0.6;
      float flower = smoothstep(0.12, 0.05, length(f - c0)) * step(0.72, hh) * smoothstep(0.25, 0.4, r);
      vec3 fc = mix(uColB, uColC, step(0.86, hh));
      float n = fbm(p * 4.0);
      o = vec4(mix(uColA, fc * 2.2, flower), (0.28 + n * 0.16 + flower * 0.7) * edge);
    } else if (uMode < 4.5) {
      // Gale: airflow lines swirling around the battlefield
      float sw = sin(ang * 4.0 - uTime * 5.0 + r * 16.0);
      float lines = smoothstep(0.75, 1.0, sw) * smoothstep(0.3, 0.55, r) * smoothstep(1.0, 0.8, r);
      o = vec4(uColA * 1.6, lines * 0.55);
    } else if (uMode < 5.5) {
      // Blowing sand: yellow sand covers the ground, with long thin sand streaks flowing downwind
      float n = fbm(p * 5.0 + vec2(uTime * 0.5, 0.0));
      float streak = smoothstep(0.55, 0.8, fbm(vec2(p.x * 2.0 + uTime * 1.6, p.y * 16.0)));
      o = vec4(mix(uColA, uColB, streak), (0.45 + 0.25 * n) * edge);
    } else if (uMode < 6.5) {
      // Thunder-pattern magic circle: rotates slowly and lights up entirely during lightning
      float rn = texture2D(tRune, rot(vUv - 0.5, uTime * 0.12) + 0.5).a;
      vec3 c = mix(uColA, uColB, uFlash) * (2.0 + uFlash * 3.0);
      o = vec4(c, (rn * (0.4 + uFlash * 0.6) + 0.12) * edge);
    } else if (uMode < 7.5) {
      // Holy sigil: a geometric seal made of concentric circles, a hexagon and spokes
      float a6 = abs(fract(ang / 6.2831853 * 6.0 + uTime * 0.02) - 0.5);
      float spokes = smoothstep(0.02, 0.0, a6 * r) * smoothstep(0.2, 0.3, r);
      float rings = smoothstep(0.012, 0.0, abs(r - 0.32)) + smoothstep(0.012, 0.0, abs(r - 0.58)) + smoothstep(0.02, 0.0, abs(r - 0.86));
      vec2 q = rot(p, uTime * 0.05);
      float hexd = max(abs(q.x) * 0.866 + abs(q.y) * 0.5, abs(q.y));
      float hex = smoothstep(0.012, 0.0, abs(hexd - 0.45));
      float pulse = 0.75 + 0.25 * sin(uTime * 1.5);
      float lines = clamp(spokes + rings + hex, 0.0, 1.0) * pulse;
      o = vec4(uColA * 2.4 * lines + uColB * 0.4, (lines * 0.8 + 0.1) * edge);
    } else {
      // Eternal Night: the ground is darkened, with a faint dim-violet glow ring in the center
      float ring = smoothstep(0.03, 0.0, abs(r - 0.5)) * (0.5 + 0.5 * sin(uTime * 1.2));
      float n = fbm(p * 3.0 + uTime * 0.05);
      o = vec4(uColA + uColB * ring * 1.5, (0.4 + 0.15 * n + ring * 0.5) * edge);
    }
    o.a *= uP;
    gl_FragColor = o;
  }
`;

interface Look {
  shellMode: number;
  shellAdd: boolean;
  shellA: number;
  shellB: number;
  shellC: number;
  sunDir?: [number, number, number];
  groundMode: number;
  gA: number;
  gB: number;
  gC: number;
}

const LOOK: Record<FieldElement, Look> = {
  water: { shellMode: 1, shellAdd: false, shellA: 0x2a3444, shellB: 0x5a6878, shellC: 0xb0c8ff, groundMode: 1, gA: 0x2a4a70, gB: 0x9fdcff, gC: 0xcfe8ff },
  fire: { shellMode: 2, shellAdd: true, shellA: 0xff9a40, shellB: 0xfff0c0, shellC: 0xff8040, sunDir: [0.38, 0.07, -0.92], groundMode: 2, gA: 0xa87838, gB: 0xff7a20, gC: 0x000000 },
  nature: { shellMode: 3, shellAdd: false, shellA: 0x1e4a26, shellB: 0x9ad860, shellC: 0x000000, groundMode: 3, gA: 0x3a8a3a, gB: 0xff9ad0, gC: 0xfff090 },
  wind: { shellMode: 4, shellAdd: true, shellA: 0xb8e8e4, shellB: 0xd8f6f8, shellC: 0x000000, groundMode: 4, gA: 0xb0ecea, gB: 0xe0f8f6, gC: 0x000000 },
  earth: { shellMode: 5, shellAdd: false, shellA: 0xa87838, shellB: 0xdcb070, shellC: 0x000000, groundMode: 5, gA: 0xb08a50, gB: 0xe8cc90, gC: 0x000000 },
  thunder: { shellMode: 6, shellAdd: false, shellA: 0x140a24, shellB: 0x3c2a5c, shellC: 0xd0b8ff, groundMode: 6, gA: 0x7a50ff, gB: 0xfff6a8, gC: 0x000000 },
  light: { shellMode: 7, shellAdd: true, shellA: 0xf0d890, shellB: 0xfff0c8, shellC: 0x000000, groundMode: 7, gA: 0xffe080, gB: 0xfff0d0, gC: 0x000000 },
  dark: { shellMode: 8, shellAdd: true, shellA: 0x8a2a6a, shellB: 0xff3050, shellC: 0xffffff, sunDir: [0.3, 0.1, -0.94], groundMode: 8, gA: 0x14081e, gB: 0x9a5aff, gC: 0x000000 },
};

function additive(color: number, intensity = 2, map?: THREE.Texture): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity),
    ...(map ? { map } : {}),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/** Fresnel light pillar / glass pillar material: bright at the rim, transparent face-on */
function fresnelMaterial(color: number, intensity: number, core: number, base: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(intensity) }, uA: { value: 1 }, uCore: { value: core }, uBase: { value: base } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = mat3(modelMatrix) * normal; vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uA; uniform float uCore; uniform float uBase; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN + vec3(1e-6)); vec3 v = normalize(vV + vec3(1e-6));
        float f = clamp(abs(dot(n, v)), 0.0, 1.0);
        float a = (pow(f, 1.6) * uCore + pow(max(1.0 - f, 0.0), 2.0) * (1.0 - uCore) + uBase) * (1.0 - vUv.y * (1.0 - uBase)) * uA;
        gl_FragColor = vec4(uColor + vec3(0.8) * pow(f, 6.0) * uCore, clamp(a, 0.0, 1.0));
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

// ───────────────────────── Rain ─────────────────────────

let rainTexCache: THREE.Texture | null = null;
/** Rain streak texture: one thin straight line inside a square point sprite */
function rainTex(): THREE.Texture {
  if (rainTexCache) return rainTexCache;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  for (let y = 0; y < 64; y++) {
    const a = Math.pow(Math.sin((y / 63) * Math.PI), 0.8);
    const lg = g.createLinearGradient(28, 0, 36, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, `rgba(255,255,255,${a})`);
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.fillRect(26, y, 12, 1);
  }
  rainTexCache = new THREE.CanvasTexture(cv);
  return rainTexCache;
}

/** Downpour: one Points object, each drop falls on its own and returns to the top after landing */
class RainDrops {
  points: THREE.Points;
  private n: number;
  private pos: Float32Array;
  private spd: Float32Array;
  private mat: THREE.ShaderMaterial;

  constructor(n: number, color: number, size: number, tilt: number) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.spd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * 40;
      this.pos[i * 3 + 1] = Math.random() * 18;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * 32;
      this.spd[i] = 15 + Math.random() * 7;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tMap: { value: rainTex() }, uScale: { value: 400 }, uColor: { value: new THREE.Color(color).multiplyScalar(1.5) }, uSize: { value: size }, uTilt: { value: tilt }, uA: { value: 1 } },
      vertexShader: /* glsl */ `uniform float uScale; uniform float uSize;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `uniform sampler2D tMap; uniform vec3 uColor; uniform float uTilt; uniform float uA;
        void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(uTilt); float s = sin(uTilt); p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
          vec4 t = texture2D(tMap, clamp(p, 0.0, 1.0)); gl_FragColor = vec4(uColor, t.a * uA); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
  }

  update(dt: number, wind: number, alpha: number, stage: Stage): void {
    const h = stage.container.clientHeight || window.innerHeight;
    this.mat.uniforms.uScale.value = h / (2 * Math.tan((stage.camera.fov * Math.PI) / 360));
    this.mat.uniforms.uA.value = alpha;
    if (dt <= 0) return;
    const p = this.pos;
    for (let i = 0; i < this.n; i++) {
      p[i * 3 + 1] -= this.spd[i] * dt;
      p[i * 3] += wind * dt;
      if (p[i * 3 + 1] < 0) {
        p[i * 3 + 1] += 18;
        p[i * 3] = (Math.random() - 0.5) * 40;
        p[i * 3 + 2] = (Math.random() - 0.5) * 32;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}

// ───────────────────────── Ambient layer ─────────────────────────

interface Ctx {
  vfx: Vfx;
  stage: Stage;
  /** The root node of this layer (hung under FieldFx's group) */
  group: THREE.Group;
  /** Sky flash (0 to 1) + screen flash */
  flash: (sky: number, screen: number, color: number) => void;
  shake: (amt: number) => void;
  /** Factor by which additive light effects are scaled down on bright fields (1 = no scaling on dark fields, about 0.4 = the brightest fields) */
  dim: number;
}

interface Layer {
  /** p = the field's "presence" from 0 to 1: rises to 1 when it unfolds and drops back to 0 when it leaves */
  update(dt: number, t: number, p: number): void;
  dispose(): void;
}

/** Accumulator for a fixed emission count per second */
function rate(perSec: number, dt: number, acc: { v: number }): number {
  acc.v += perSec * dt;
  const n = Math.floor(acc.v);
  acc.v -= n;
  return n;
}

/** taperedTube's triangle winding is opposite to the normals (front faces inward), so front-face culling would cull the outside; flip each triangle */
function flipWinding(geo: THREE.BufferGeometry): void {
  const idx = geo.index;
  if (!idx) return;
  for (let i = 0; i < idx.count; i += 3) {
    const b = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, b);
  }
  idx.needsUpdate = true;
}

/** A tapering tube along a curve (vine, tentacle): growth is done with drawRange */
function growTube(curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, color: number, rim: number): { mesh: THREE.Mesh; grow: (k: number) => void; dispose: () => void } {
  const geo = taperedTube(curve, 26, 6, r0, r1, 0.12);
  flipWinding(geo);
  const mat = sceneMaterial(color, { rim });
  const mesh = new THREE.Mesh(geo, mat);
  const total = geo.index!.count;
  const grow = (k: number) => {
    const n = Math.floor((total * clamp01(k)) / 6) * 6;
    geo.setDrawRange(0, n);
    mesh.visible = n > 0;
  };
  grow(0);
  return { mesh, grow, dispose: () => { geo.dispose(); mat.dispose(); } };
}

/** Downpour: rain streaks, ground splashes, distant lightning */
function waterLayer(c: Ctx): Layer {
  const rain = new RainDrops(1000, 0xbfe6ff, 0.55, 0.14);
  c.group.add(rain.points);
  const acc = { v: 0 };
  let boltT = 2.5 + Math.random() * 3;
  const p3 = new THREE.Vector3();
  return {
    update(dt, _t, p) {
      rain.update(dt, 2.4, p, c.stage);
      if (dt <= 0) return;
      const n = rate(70 * p, dt, acc);
      for (let i = 0; i < n; i++) {
        p3.set((Math.random() - 0.5) * 26, 0.05, (Math.random() - 0.5) * 20);
        c.vfx.emit({ pos: p3.clone(), count: 1, color: 0xcfefff, speed: [0.2, 0.5], dir: UP, spread: 0.1, life: [0.2, 0.3], size: [0.1, 0.16], sizeEnd: 2.2, drag: 0, intensity: 0.5 });
        if (Math.random() < 0.5) c.vfx.emit({ pos: p3.clone(), count: 2, color: 0xe8f8ff, speed: [1.2, 2.6], dir: UP, spread: 0.5, life: [0.25, 0.4], size: [0.05, 0.09], sizeEnd: 0.5, gravity: 9, drag: 0, intensity: 0.9 });
      }
      boltT -= dt;
      if (boltT <= 0 && p > 0.8) {
        boltT = 4 + Math.random() * 5;
        const a = Math.random() * Math.PI * 2;
        const r = 30 + Math.random() * 12;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        void c.vfx.bolt(new THREE.Vector3(x, 26, z), new THREE.Vector3(x + (Math.random() - 0.5) * 4, 0, z), 0xd8e8ff, 0.25, 0.1);
        c.flash(0.35, 0.08, 0xd0e0ff);
      }
    },
    dispose() {
      c.group.remove(rain.points);
      rain.dispose();
    },
  };
}

/** Blazing Sun: heat-haze light pillars, rising embers and sparks */
function fireLayer(c: Ctx): Layer {
  const r = rng(41);
  const mat = additive(0xff9a40, 1.4, rayTex());
  const cols: { m: THREE.Mesh; d: number; ph: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const [x, z] = ringPos(r, 7.5, 14);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + r() * 1.2, 9 + r() * 5), mat);
    m.position.set(x, 4.5, z);
    c.group.add(m);
    cols.push({ m, d: Math.hypot(x, z), ph: r() * 6.28 });
  }
  const acc = { v: 0 };
  const acc2 = { v: 0 };
  const p3 = new THREE.Vector3();
  return {
    update(dt, t, p) {
      const cam = c.vfx.camPos;
      for (const k of cols) {
        const pi = stag(p, k.d);
        k.m.rotation.y = Math.atan2(cam.x - k.m.position.x, cam.z - k.m.position.z);
        k.m.scale.set(1 + Math.sin(t * 2.3 + k.ph) * 0.25, pi, 1);
        k.m.position.y = 4.5 * pi;
        k.m.visible = pi > 0.01;
      }
      mat.opacity = 0.32 * p;
      if (dt <= 0) return;
      const n = rate(30 * p, dt, acc);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28;
        const d = 3 + Math.random() * 12;
        p3.set(Math.cos(a) * d, 0.15, Math.sin(a) * d);
        c.vfx.emit({ pos: p3.clone(), count: 1, color: [0xff6a1a, 0xffc040], speed: [0.6, 1.6], dir: UP, spread: 0.3, life: [1.4, 2.4], size: [0.08, 0.18], drag: 0.2, intensity: 1.8 });
      }
      const n2 = rate(6 * p, dt, acc2);
      for (let i = 0; i < n2; i++) {
        p3.set((Math.random() - 0.5) * 24, 0.2, (Math.random() - 0.5) * 18);
        c.vfx.emit({ pos: p3.clone(), count: 1, color: 0xffe080, speed: [2, 4], dir: UP, spread: 0.6, life: [0.6, 1.1], size: [0.12, 0.22], atlas: 1, gravity: 1.5 });
      }
    },
    dispose() {
      for (const k of cols) {
        c.group.remove(k.m);
        k.m.geometry.dispose();
      }
      mat.dispose();
    },
  };
}

/** Verdant Domain: vines and giant roots bursting from the ground, blooming flowers, canopy light shafts, spores and fireflies */
function natureLayer(c: Ctx): Layer {
  const r = rng(77);
  const vines: { g: THREE.Object3D; grow: (k: number) => void; d: number; leaves: { m: THREE.Mesh; t: number }[]; flower: THREE.Mesh | null; dispose: () => void }[] = [];
  const leafGeo = new THREE.ConeGeometry(0.24, 0.62, 4);
  leafGeo.scale(1, 1, 0.35);
  leafGeo.translate(0, 0.31, 0);
  const leafMat = sceneMaterial(0x5fcb5a, { rim: 0.4 });
  const flowerGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const flowerMats = [additive(0xff8ad0, 1.8), additive(0xfff090, 1.8)];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.5;
    const rb = 7.6 + r() * 1.8;
    const bx = Math.cos(a) * rb;
    const bz = Math.sin(a) * rb;
    if (bx < 2 && bz > 2) continue;
    const o = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(r() - 0.5);
    const s = 0.85 + r() * 0.45;
    const pts = [
      new THREE.Vector3(0, -0.3, 0),
      o.clone().multiplyScalar(0.4).add(new THREE.Vector3(0, 1.3 * s, 0)),
      o.clone().multiplyScalar(-0.6).add(side.clone().multiplyScalar(0.8)).add(new THREE.Vector3(0, 2.6 * s, 0)),
      o.clone().multiplyScalar(-1.8).add(side.clone().multiplyScalar(-0.5)).add(new THREE.Vector3(0, 3.6 * s, 0)),
      o.clone().multiplyScalar(-2.7).add(side.clone().multiplyScalar(1.0)).add(new THREE.Vector3(0, 4.1 * s, 0)),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = growTube(curve, 0.24 * s, 0.05, 0x3f8a3a, 0.35);
    const g = new THREE.Group();
    g.position.set(bx, 0, bz);
    g.add(tube.mesh);
    const leaves: { m: THREE.Mesh; t: number }[] = [];
    for (const t of [0.45, 0.72]) {
      const m = new THREE.Mesh(leafGeo, leafMat);
      m.position.copy(curve.getPointAt(t));
      m.rotation.set(r() * 1.2 - 0.6, r() * 6.28, 0.6 + r() * 0.8);
      m.scale.setScalar(0.001);
      g.add(m);
      leaves.push({ m, t });
    }
    const flower = new THREE.Mesh(flowerGeo, flowerMats[i % 2]);
    flower.position.copy(curve.getPointAt(1));
    flower.scale.setScalar(0.001);
    g.add(flower);
    c.group.add(g);
    vines.push({ g, grow: tube.grow, d: rb, leaves, flower, dispose: tube.dispose });
  }
  // Giant roots arch up
  const rootMat = sceneMaterial(0x6a4a30, { rim: 0.3 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.8 + r() * 0.6;
    const at = (aa: number, rr: number, y: number) => new THREE.Vector3(Math.cos(aa) * rr, y, Math.sin(aa) * rr);
    const p0 = at(a, 10.2, 0);
    if (p0.x < 2 && p0.z > 2) continue;
    const curve = new THREE.CatmullRomCurve3([at(a, 10.2, -0.4), at(a + 0.1, 9.7, 1.3), at(a + 0.22, 9.4, 1.7), at(a + 0.36, 9.6, -0.4)]);
    const tube = growTube(curve, 0.5, 0.32, 0x6a4a30, 0.3);
    tube.mesh.material = rootMat;
    c.group.add(tube.mesh);
    vines.push({ g: tube.mesh, grow: tube.grow, d: 10, leaves: [], flower: null, dispose: tube.dispose });
  }
  // Light shafts through the canopy
  const rayMat = additive(0xd8ff90, 1.2, rayTex());
  const rays: { m: THREE.Mesh; ph: number; d: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const [x, z] = ringPos(r, 4.5, 11);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2 + r() * 1.5, 16), rayMat);
    m.position.set(x, 8, z);
    m.rotation.z = 0.18;
    c.group.add(m);
    rays.push({ m, ph: r() * 6.28, d: Math.hypot(x, z) });
  }
  // Vines, leaves and giant roots use the scene objects' post-process outline (the light shafts and flowers are additive materials, skipped automatically)
  inkScenery(c.group);
  const acc = { v: 0 };
  const acc2 = { v: 0 };
  const acc3 = { v: 0 };
  const p3 = new THREE.Vector3();
  return {
    update(dt, t, p) {
      for (const v of vines) {
        const pi = stag(p, v.d);
        v.grow(pi);
        v.g.rotation.z = Math.sin(t * 1.1 + v.d) * 0.02 * pi;
        for (const l of v.leaves) l.m.scale.setScalar(Math.max(0.001, clamp01((pi * 1.15 - l.t) * 4)));
        if (v.flower) v.flower.scale.setScalar(Math.max(0.001, clamp01((pi - 0.82) * 6) * (1 + Math.sin(t * 2 + v.d) * 0.12)));
      }
      const cam = c.vfx.camPos;
      for (const k of rays) {
        k.m.rotation.y = Math.atan2(cam.x - k.m.position.x, cam.z - k.m.position.z);
        k.m.scale.set(1 + Math.sin(t * 0.8 + k.ph) * 0.15, stag(p, k.d), 1);
      }
      rayMat.opacity = 0.3 * p;
      if (dt <= 0) return;
      for (let i = rate(14 * p, dt, acc); i > 0; i--) {
        p3.set((Math.random() - 0.5) * 24, 0.3 + Math.random() * 3.5, (Math.random() - 0.5) * 18);
        c.vfx.emit({ pos: p3.clone(), count: 1, color: [0x9fe86a, 0xd8ff9a], speed: [0.2, 0.5], life: [3, 4.5], size: [0.1, 0.2], sizeEnd: 0.6, drag: 0.3, intensity: 1.6 });
      }
      for (let i = rate(6 * p, dt, acc2); i > 0; i--) {
        p3.set((Math.random() - 0.5) * 22, 0.5 + Math.random() * 2.5, (Math.random() - 0.5) * 16);
        c.vfx.emit({ pos: p3.clone(), count: 1, color: 0xfff08a, speed: [0.1, 0.3], life: [0.5, 0.9], size: [0.12, 0.2], sizeEnd: 0.3, atlas: 1, intensity: 2 });
      }
      for (let i = rate(8 * p, dt, acc3); i > 0; i--) {
        p3.set((Math.random() - 0.5) * 24, 6 + Math.random() * 2, (Math.random() - 0.5) * 18);
        c.vfx.emit({ pos: p3.clone(), count: 1, color: [0xffb0dc, 0xc8f08a], speed: [0.4, 0.9], dir: new THREE.Vector3(0.3, -1, 0.1), spread: 0.5, life: [3.5, 5], size: [0.14, 0.24], sizeEnd: 1, drag: 0.1, atlas: 3, spin: 3, intensity: 1.3 });
      }
    },
    dispose() {
      for (const v of vines) {
        c.group.remove(v.g);
        v.dispose();
      }
      for (const k of rays) {
        c.group.remove(k.m);
        k.m.geometry.dispose();
      }
      leafGeo.dispose();
      leafMat.dispose();
      flowerGeo.dispose();
      flowerMats.forEach((m) => m.dispose());
      rootMat.dispose();
      rayMat.dispose();
    },
  };
}

/** Gale: airflow bands circling the field, wind streaks sweeping across it, flattened turf, swirled-up leaves and feathers */
function windLayer(c: Ctx): Layer {
  const r = rng(23);
  const ribMat = additive(0xd8fffa, 1.5 * c.dim, rayTex());
  const ribGeo = new THREE.PlaneGeometry(1, 1);
  type Rib = { m: THREE.Mesh; a: number; r: number; y: number; sp: number; len: number; w: number; ph: number };
  const ring: Rib[] = [];
  for (let i = 0; i < 20; i++) {
    const m = new THREE.Mesh(ribGeo, ribMat);
    c.group.add(m);
    ring.push({ m, a: r() * 6.28, r: 6.5 + r() * 3, y: 0.5 + r() * 3.8, sp: 1.6 + r() * 1.2, len: 3 + r() * 3.5, w: 0.1 + r() * 0.14, ph: r() * 6.28 });
  }
  type Cross = { m: THREE.Mesh; x: number; y: number; z: number; sp: number; len: number; w: number };
  const cross: Cross[] = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(ribGeo, ribMat);
    c.group.add(m);
    cross.push({ m, x: -20 + r() * 40, y: 2.6 + r() * 3.2, z: -9 + r() * 12, sp: 20 + r() * 8, len: 5 + r() * 4, w: 0.06 + r() * 0.08 });
  }
  // Turf: merged into one mesh, bent with the wind in the vertex shader
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 70; i++) {
    const [x, z] = ringPos(r, 6.8, 12.5);
    const h = 0.55 + r() * 0.45;
    const g = new THREE.ConeGeometry(0.07, h, 3);
    g.translate(0, h / 2, 0);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const aH = new Float32Array(pos.count);
    for (let j = 0; j < pos.count; j++) aH[j] = pos.getY(j);
    g.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
    g.rotateY(r() * 6.28);
    g.translate(x, 0, z);
    blades.push(g);
  }
  const grassGeo = mergeGeometries(blades)!;
  blades.forEach((g) => g.dispose());
  const grassMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uP: { value: 0 }, uLean: { value: 0.9 }, uColA: { value: new THREE.Color(0x5aa888) }, uColB: { value: new THREE.Color(0xd8fff0) } },
    vertexShader: /* glsl */ `attribute float aH; uniform float uTime; uniform float uP; uniform float uLean; varying float vH;
      void main(){ vH = aH; vec3 p = position; float w = aH * aH * 2.2; p.x += w * (uLean + 0.3 * sin(uTime * 5.0 + position.z * 0.8 + position.x * 0.5)); p.y = (p.y - w * uLean * 0.3) * uP; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 uColA; uniform vec3 uColB; varying float vH; void main(){ gl_FragColor = vec4(mix(uColA, uColB, smoothstep(0.0, 0.7, vH)), 1.0); }`,
    side: THREE.DoubleSide,
  });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  c.group.add(grass);
  const acc = { v: 0 };
  const acc2 = { v: 0 };
  const p3 = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  return {
    update(dt, t, p) {
      const cam = c.vfx.camPos;
      for (const k of ring) {
        k.a += k.sp * dt;
        const px = Math.cos(k.a) * k.r;
        const pz = Math.sin(k.a) * k.r;
        const tx = -Math.sin(k.a);
        const tz = Math.cos(k.a);
        a.set(px - tx * k.len * 0.5, k.y, pz - tz * k.len * 0.5);
        b.set(px + tx * k.len * 0.5, k.y, pz + tz * k.len * 0.5);
        axisBillboard(k.m, a, b, cam, k.w);
        k.m.visible = p > 0.02;
      }
      for (const k of cross) {
        k.x += k.sp * dt;
        if (k.x > 22) {
          k.x = -22;
          k.z = -7 + Math.random() * 14;
          k.y = 2.6 + Math.random() * 3.2;
        }
        a.set(k.x - k.len * 0.5, k.y, k.z);
        b.set(k.x + k.len * 0.5, k.y, k.z);
        axisBillboard(k.m, a, b, cam, k.w);
        k.m.visible = p > 0.02;
      }
      ribMat.opacity = (0.55 + 0.35 * Math.sin(t * 9)) * p;
      grassMat.uniforms.uTime.value = t;
      grassMat.uniforms.uP.value = p;
      grass.visible = p > 0.01;
      if (dt <= 0) return;
      for (let i = rate(30 * p, dt, acc); i > 0; i--) {
        const ang = Math.random() * 6.28;
        const rr = 5 + Math.random() * 8;
        p3.set(Math.cos(ang) * rr, 0.3 + Math.random() * 3.5, Math.sin(ang) * rr);
        const tang = new THREE.Vector3(-Math.sin(ang), 0.12, Math.cos(ang));
        c.vfx.emit({ pos: p3.clone(), count: 1, color: Math.random() < 0.6 ? [0xc8f0a0, 0xa0e080] : 0xffffff, speed: [5, 8], dir: tang, spread: 0.25, life: [1.4, 2.4], size: [0.16, 0.28], sizeEnd: 0.8, drag: 0.35, atlas: 3, spin: 8, intensity: 1.2 });
      }
      for (let i = rate(25 * p, dt, acc2); i > 0; i--) {
        p3.set(-16, 0.6 + Math.random() * 4, (Math.random() - 0.5) * 14);
        c.vfx.emit({ pos: p3.clone(), count: 1, color: 0xe0fffa, speed: [14, 18], dir: new THREE.Vector3(1, 0.04, 0), spread: 0.02, life: [1.2, 1.6], size: [0.08, 0.14], sizeEnd: 1, drag: 0, intensity: 0.8 });
      }
    },
    dispose() {
      for (const k of [...ring, ...cross]) c.group.remove(k.m);
      c.group.remove(grass);
      ribGeo.dispose();
      ribMat.dispose();
      grassGeo.dispose();
      grassMat.dispose();
    },
  };
}

/** Sandstorm: flowing translucent sand walls surround the battlefield, rock pillars rise, sand and stones fly */
function earthLayer(c: Ctx): Layer {
  const r = rng(59);
  const wallMat = (dir: number) =>
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uP: { value: 0 }, uDir: { value: dir }, uColA: { value: new THREE.Color(0xa07840) }, uColB: { value: new THREE.Color(0xe0bc80) } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uTime; uniform float uP; uniform float uDir; uniform vec3 uColA; uniform vec3 uColB; varying vec2 vUv;
        ${NOISE}
        void main(){
          float n = fbm(vec2(vUv.x * 7.0 + uTime * 0.14 * uDir, vUv.y * 3.0 - uTime * 0.3));
          float a = (0.2 + 0.8 * smoothstep(0.3, 0.8, n)) * smoothstep(1.0, 0.15, vUv.y) * smoothstep(0.0, 0.06, vUv.y) * uP;
          gl_FragColor = vec4(mix(uColA, uColB, smoothstep(0.3, 0.8, n)), a * 0.7);
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  const walls: { m: THREE.Mesh; mat: THREE.ShaderMaterial }[] = [];
  for (const [rad, dir] of [[19, 1], [24, -0.6]] as const) {
    const geo = new THREE.CylinderGeometry(rad, rad, 14, 48, 1, true);
    geo.translate(0, 7, 0);
    const mat = wallMat(dir);
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2;
    c.group.add(m);
    walls.push({ m, mat });
  }
  const rockMat = sceneMaterial(0x8a6a48, { rim: 0.3 });
  const rocks: { g: THREE.Group; h: number; d: number; burst: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const [x, z] = ringPos(r, 8, 11.5);
    const h = 2.4 + r() * 2.2;
    const g = new THREE.Group();
    const body = new THREE.CylinderGeometry(0.5, 0.85, h, 6);
    body.translate(0, h / 2, 0);
    const cap = new THREE.DodecahedronGeometry(0.72, 0);
    cap.translate(0, h, 0);
    for (const geo of [body, cap]) g.add(new THREE.Mesh(geo, rockMat));
    g.position.set(x, -h - 0.5, z);
    g.rotation.y = r() * 6.28;
    g.rotation.z = (r() - 0.5) * 0.16;
    c.group.add(g);
    rocks.push({ g, h, d: Math.hypot(x, z), burst: false });
  }
  inkScenery(c.group);
  const acc = { v: 0 };
  const acc2 = { v: 0 };
  const p3 = new THREE.Vector3();
  const windDir = new THREE.Vector3(1, 0.05, 0.3);
  return {
    update(dt, t, p) {
      for (const w of walls) {
        w.mat.uniforms.uTime.value = t;
        w.mat.uniforms.uP.value = p;
        w.m.position.y = -3 * (1 - p);
        w.m.visible = p > 0.01;
      }
      for (const k of rocks) {
        const pi = stag(p, k.d);
        k.g.position.y = -(k.h + 0.5) * (1 - ease.outCubic(pi));
        if (!k.burst && pi > 0.05 && dt > 0) {
          k.burst = true;
          c.vfx.smoke({ pos: new THREE.Vector3(k.g.position.x, 0.2, k.g.position.z), count: 14, color: 0xc8a878, speed: [1, 3], dir: UP, spread: 1, life: [0.6, 1.1], size: [0.5, 0.9], sizeEnd: 2, drag: 1.5 });
        }
        if (pi <= 0.01) k.burst = false;
      }
      if (dt <= 0) return;
      for (let i = rate(36 * p, dt, acc); i > 0; i--) {
        p3.set(-18 + Math.random() * 6, 0.3 + Math.random() * 4.5, (Math.random() - 0.5) * 26);
        c.vfx.smoke({ pos: p3.clone(), count: 1, color: [0xc8a468, 0xb08c50, 0xd8b878], speed: [6, 11], dir: windDir, spread: 0.2, life: [1.6, 2.6], size: [0.7, 1.4], sizeEnd: 1.8, drag: 0.15 });
      }
      for (let i = rate(20 * p, dt, acc2); i > 0; i--) {
        p3.set(-16 + Math.random() * 4, 0.2 + Math.random() * 3, (Math.random() - 0.5) * 22);
        c.vfx.emit({ pos: p3.clone(), count: 1, color: 0xf0d8a0, speed: [8, 13], dir: windDir, spread: 0.15, life: [1.2, 2], size: [0.06, 0.12], sizeEnd: 0.8, drag: 0.1, intensity: 0.9, atlas: 2 });
      }
    },
    dispose() {
      for (const w of walls) {
        c.group.remove(w.m);
        w.m.geometry.dispose();
        w.mat.dispose();
      }
      for (const k of rocks) {
        c.group.remove(k.g);
        k.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      }
      rockMat.dispose();
    },
  };
}

/** Thundercloud: lightning frequently striking all around, electric arcs jumping in the air, sparks */
function thunderLayer(c: Ctx): Layer {
  let boltT = 0.6;
  let arcT = 0.2;
  const acc = { v: 0 };
  const p3 = new THREE.Vector3();
  return {
    update(dt, _t, p) {
      if (dt <= 0) return;
      boltT -= dt;
      if (boltT <= 0 && p > 0.6) {
        boltT = 1.2 + Math.random() * 1.6;
        const a = Math.random() * 6.28;
        const rr = 9 + Math.random() * 11;
        const x = Math.cos(a) * rr;
        const z = Math.sin(a) * rr;
        const hit = new THREE.Vector3(x + (Math.random() - 0.5) * 3, 0, z);
        void c.vfx.bolt(new THREE.Vector3(x, 16, z), hit, 0xd0b0ff, 0.28, 0.12);
        void c.vfx.ring(hit.clone().setY(0.08), 0xfff6a8, 0.3, 4, 0.5);
        void c.vfx.flash(hit.clone().setY(0.6), 0xffffff, 3, 0.25);
        c.vfx.emit({ pos: hit.clone().setY(0.2), count: 16, color: [0xfff6a8, 0xd0b0ff], speed: [2, 6], dir: UP, spread: 0.9, life: [0.3, 0.6], size: [0.1, 0.2], atlas: 1, gravity: 4 });
        c.flash(0.5, 0.14, 0xe0d0ff);
        c.shake(0.12);
        if (Math.random() < 0.3) boltT = 0.15;
      }
      arcT -= dt;
      if (arcT <= 0 && p > 0.3) {
        arcT = 0.12 + Math.random() * 0.2;
        const a = Math.random() * 6.28;
        const rr = 5.5 + Math.random() * 5;
        p3.set(Math.cos(a) * rr, 0.4 + Math.random() * 2.8, Math.sin(a) * rr);
        const q = p3.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2.4));
        void c.vfx.bolt(p3.clone(), q, 0xe0c8ff, 0.12, 0.03);
      }
      for (let i = rate(18 * p, dt, acc); i > 0; i--) {
        p3.set((Math.random() - 0.5) * 22, 0.3 + Math.random() * 2.5, (Math.random() - 0.5) * 16);
        c.vfx.emit({ pos: p3.clone(), count: 1, color: 0xfff066, speed: [0.5, 2], life: [0.12, 0.28], size: [0.1, 0.2], atlas: 1 });
      }
    },
    dispose() {},
  };
}

/** Sanctuary: holy light pillars falling from the sky, a translucent colonnade of light, drifting light feathers */
function lightLayer(c: Ctx): Layer {
  const r = rng(13);
  const beams: { m: THREE.Mesh; mat: THREE.ShaderMaterial; d: number; ph: number; rad: number }[] = [];
  const beamSpots: [number, number, number][] = [[0.5, -7.5, 1.6], [-7, -3, 1.2], [7.5, 2.5, 1.3], [3, -12, 1.0], [-9, 5, 1.1], [10, -6, 1.2]];
  for (const [x, z, rad] of beamSpots) {
    const rad2 = rad * (0.55 + 0.45 * c.dim);
    const geo = new THREE.CylinderGeometry(rad2, rad2, 34, 24, 1, true);
    geo.translate(0, 17, 0);
    const mat = fresnelMaterial(0xfff0b0, 1.7 * c.dim, 1, 0);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0, z);
    c.group.add(m);
    beams.push({ m, mat, d: Math.hypot(x, z), ph: r() * 6.28, rad });
  }
  // The colonnade of light surrounds only the back half of the battlefield (the camera is on the -x, +z side, and pillars too close to it would become huge white walls)
  const glassMat = fresnelMaterial(0xfff4d0, 1.4 * c.dim, 0, 0.08);
  const colonnade: { g: THREE.Group; d: number }[] = [];
  const shaft = new THREE.CylinderGeometry(0.34, 0.38, 6.5, 12, 1, true);
  shaft.translate(0, 3.25, 0);
  const cap = new THREE.BoxGeometry(1.1, 0.26, 1.1);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = Math.cos(a) * 14;
    const z = Math.sin(a) * 14;
    if (z > 2.5 || (x < 4 && z > -2)) continue;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(shaft, glassMat));
    const top = new THREE.Mesh(cap, glassMat);
    top.position.y = 6.6;
    const base = new THREE.Mesh(cap, glassMat);
    base.position.y = 0.13;
    g.add(top, base);
    g.position.set(x, -7, z);
    c.group.add(g);
    colonnade.push({ g, d: 14 });
  }
  const acc = { v: 0 };
  const acc2 = { v: 0 };
  const p3 = new THREE.Vector3();
  return {
    update(dt, t, p) {
      for (const b of beams) {
        const pi = stag(p, b.d);
        const s = Math.max(0.001, pi) * (1 + Math.sin(t * 1.3 + b.ph) * 0.12);
        b.m.scale.set(s, 1, s);
        b.mat.uniforms.uA.value = 0.4 * pi * (0.5 + 0.5 * c.dim);
        b.m.visible = pi > 0.01;
      }
      for (const k of colonnade) {
        const pi = stag(p, k.d);
        k.g.position.y = -7 * (1 - ease.outCubic(pi));
        k.g.visible = pi > 0.01;
      }
      glassMat.uniforms.uA.value = 0.5 * p;
      if (dt <= 0) return;
      for (let i = rate(12 * p, dt, acc); i > 0; i--) {
        p3.set((Math.random() - 0.5) * 24, 6 + Math.random() * 3, (Math.random() - 0.5) * 18);
        c.vfx.emit({ pos: p3.clone(), count: 1, color: [0xfff4c0, 0xffffff], speed: [0.3, 0.6], dir: new THREE.Vector3(0.15, -1, 0), spread: 0.35, life: [3.5, 5], size: [0.16, 0.26], sizeEnd: 1, drag: 0.1, atlas: 3, spin: 2, intensity: 1.6 });
      }
      for (let i = rate(16 * p, dt, acc2); i > 0; i--) {
        p3.set((Math.random() - 0.5) * 22, 0.1 + Math.random() * 1.5, (Math.random() - 0.5) * 16);
        c.vfx.emit({ pos: p3.clone(), count: 1, color: 0xfff8d0, speed: [0.3, 0.8], dir: UP, spread: 0.2, life: [1.5, 2.5], size: [0.1, 0.2], sizeEnd: 0.2, atlas: 1, drag: 0.1, intensity: 1.8 });
      }
    },
    dispose() {
      for (const b of beams) {
        c.group.remove(b.m);
        b.m.geometry.dispose();
        b.mat.dispose();
      }
      for (const k of colonnade) c.group.remove(k.g);
      shaft.dispose();
      cap.dispose();
      glassMat.dispose();
    },
  };
}

/** Eternal Night: shadow tentacles crawling from the ground, purple mist flowing along the ground, red eyes in the distance, rising shadows */
function darkLayer(c: Ctx): Layer {
  const r = rng(97);
  const tendrils: { g: THREE.Group; grow: (k: number) => void; d: number; tip: THREE.Mesh; ph: number; dispose: () => void }[] = [];
  const tipGeo = new THREE.SphereGeometry(0.2, 8, 6);
  const tipMat = additive(0xb070ff, 2.2, glowTex());
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.5;
    const rb = 7.4 + r() * 3.2;
    const bx = Math.cos(a) * rb;
    const bz = Math.sin(a) * rb;
    if (bx < 2 && bz > 2) continue;
    const o = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(r() - 0.5);
    const s = 0.8 + r() * 0.6;
    const pts = [
      new THREE.Vector3(0, -0.3, 0),
      o.clone().multiplyScalar(-0.3).add(side.clone().multiplyScalar(0.6)).add(new THREE.Vector3(0, 1.4 * s, 0)),
      o.clone().multiplyScalar(-1.2).add(side.clone().multiplyScalar(-0.8)).add(new THREE.Vector3(0, 2.6 * s, 0)),
      o.clone().multiplyScalar(-2.4).add(side.clone().multiplyScalar(0.9)).add(new THREE.Vector3(0, 3.4 * s, 0)),
      o.clone().multiplyScalar(-3.0).add(side.clone().multiplyScalar(-0.4)).add(new THREE.Vector3(0, 4.2 * s, 0)),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = growTube(curve, 0.3 * s, 0.04, 0x1a0c2c, 0.9);
    const g = new THREE.Group();
    g.position.set(bx, 0, bz);
    g.add(tube.mesh);
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.copy(curve.getPointAt(1));
    g.add(tip);
    c.group.add(g);
    tendrils.push({ g, grow: tube.grow, d: rb, tip, ph: r() * 6.28, dispose: tube.dispose });
  }
  // Ground-hugging purple mist (two rings, the inside left empty so it does not cover the spirits' feet)
  const mistMat = (speed: number) =>
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uP: { value: 0 }, uSpeed: { value: speed }, uCol: { value: new THREE.Color(0x6a3aa8) } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uTime; uniform float uP; uniform float uSpeed; uniform vec3 uCol; varying vec2 vUv;
        ${NOISE}
        void main(){
          vec2 p = vUv * 2.0 - 1.0; float r = length(p);
          float n = fbm(p * 4.0 + vec2(uTime * 0.08 * uSpeed, -uTime * 0.05 * uSpeed));
          float n2 = fbm(p * 7.0 - vec2(uTime * 0.05 * uSpeed, uTime * 0.07 * uSpeed));
          float a = smoothstep(0.28, 0.5, r) * smoothstep(1.0, 0.7, r) * (n * 0.7 + n2 * 0.5) * 0.75 * uP;
          gl_FragColor = vec4(uCol * (0.6 + n * 0.8), a);
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  const mists: { m: THREE.Mesh; mat: THREE.ShaderMaterial }[] = [];
  for (const [y, sp] of [[0.35, 1], [0.9, 0.6]] as const) {
    const geo = new THREE.RingGeometry(4.5, 15, 48, 1);
    const mat = mistMat(sp);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.renderOrder = 3;
    c.group.add(m);
    mists.push({ m, mat });
  }
  // Red eyes in the distance
  const eyeMat = new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0xff2040).multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const eyes: { g: THREE.Group; blink: number; d: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const [x, z] = ringPos(r, 13, 24, true);
    const g = new THREE.Group();
    const gap = 0.22 + r() * 0.12;
    for (const dx of [-gap, gap]) {
      const s = new THREE.Sprite(eyeMat);
      s.position.x = dx;
      s.scale.setScalar(0.24);
      g.add(s);
    }
    g.position.set(x, 0.5 + r() * 2.2, z);
    c.group.add(g);
    eyes.push({ g, blink: 1 + r() * 4, d: Math.hypot(x, z) });
  }
  // Tentacles use the scene objects' post-process outline (the tip glow orbs, purple mist and eyes are additive or translucent, skipped automatically)
  inkScenery(c.group);
  const acc = { v: 0 };
  const p3 = new THREE.Vector3();
  return {
    update(dt, t, p) {
      for (const k of tendrils) {
        const pi = stag(p, k.d);
        k.grow(pi);
        k.g.rotation.z = Math.sin(t * 1.4 + k.ph) * 0.07 * pi;
        k.g.rotation.x = Math.cos(t * 1.1 + k.ph) * 0.05 * pi;
        k.tip.scale.setScalar(Math.max(0.001, clamp01((pi - 0.85) * 7) * (1 + Math.sin(t * 3 + k.ph) * 0.25)));
      }
      for (const m of mists) {
        m.mat.uniforms.uTime.value = t;
        m.mat.uniforms.uP.value = p;
        m.m.visible = p > 0.01;
      }
      for (const e of eyes) {
        const pi = stag(p, e.d);
        e.blink -= dt;
        if (e.blink < -0.15) e.blink = 1.5 + Math.random() * 4;
        const open = e.blink < 0 ? 0.08 : 1;
        e.g.scale.set(pi, pi * open, 1);
        e.g.visible = pi > 0.01;
      }
      if (dt <= 0) return;
      for (let i = rate(10 * p, dt, acc); i > 0; i--) {
        const a = Math.random() * 6.28;
        const rr = 3 + Math.random() * 11;
        p3.set(Math.cos(a) * rr, 0.3, Math.sin(a) * rr);
        c.vfx.emit({ pos: p3.clone(), count: 1, color: [0x5a2a9a, 0x9a5aff], speed: [0.2, 0.5], dir: UP, spread: 0.4, life: [2, 3], size: [0.5, 1.0], sizeEnd: 1.4, drag: 0.2, intensity: 0.5 });
      }
    },
    dispose() {
      for (const k of tendrils) {
        c.group.remove(k.g);
        k.dispose();
      }
      tipGeo.dispose();
      tipMat.dispose();
      for (const m of mists) {
        c.group.remove(m.m);
        m.m.geometry.dispose();
        m.mat.dispose();
      }
      for (const e of eyes) c.group.remove(e.g);
      eyeMat.dispose();
    },
  };
}

const LAYERS: Record<FieldElement, (c: Ctx) => Layer> = { water: waterLayer, fire: fireLayer, nature: natureLayer, wind: windLayer, earth: earthLayer, thunder: thunderLayer, light: lightLayer, dark: darkLayer };

// ───────────────────────── Controller ─────────────────────────

export interface FieldFxDeps {
  arena: Arena;
  vfx: Vfx;
  stage: Stage;
  /** Field objects hang here (BattleScene.root, not arena.group) */
  root: THREE.Group;
  tw: Tweens;
  /** Camera shake */
  shake?: (amt: number) => void;
}

export class FieldFx {
  /** The current logical field (updated as soon as set() is called; the on-screen transition runs separately) */
  current: FieldElement | null = null;
  private arena: Arena;
  private vfx: Vfx;
  private stage: Stage;
  private root: THREE.Group;
  private tw: Tweens;
  private shake: (amt: number) => void;
  private group = new THREE.Group();
  private layer: Layer | null = null;
  private layerGroup: THREE.Group | null = null;
  private presence = 0;
  private presGen = 0;
  private gen = 0;
  private disposed = false;
  private time = 0;
  /** Sky / fog / light: the region's original values are recorded at construction, and afterwards everything is a tween from the current value to the target value */
  private base: Atmos;
  private from: Atmos;
  private goal: Atmos;
  private cur: Atmos;
  private atmosK = 1;
  private atmosGen = 0;
  private atmosLive = false;
  private goalIsBase = true;
  private baseStars: number;
  private skyFlash = 0;
  private wroteFlash = false;
  private shell: THREE.Mesh;
  private shellNormal: THREE.ShaderMaterial;
  private shellAdd: THREE.ShaderMaterial;
  private ground: THREE.Mesh;
  private groundMat: THREE.ShaderMaterial;
  /** The field's own brightness (0 dark to 1 bright); additive light shells and brightening must be scaled down on bright fields */
  private bright = 0.5;

  constructor(d: FieldFxDeps) {
    this.arena = d.arena;
    this.vfx = d.vfx;
    this.stage = d.stage;
    this.root = d.root;
    this.tw = d.tw;
    this.shake = d.shake ?? (() => {});
    this.base = readAtmos(d.arena, d.stage);
    this.bright = arenaBrightness(this.base);
    this.from = cloneAtmos(this.base);
    this.goal = cloneAtmos(this.base);
    this.cur = cloneAtmos(this.base);
    this.baseStars = d.arena.skyMat.uniforms.uStars.value as number;
    const shellUniforms = () => ({
      uMode: { value: 0 },
      uTime: { value: 0 },
      uP: { value: 0 },
      uFlash: { value: 0 },
      uColA: { value: new THREE.Color() },
      uColB: { value: new THREE.Color() },
      uColC: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0.38, 0.07, -0.92).normalize() },
    });
    this.shellNormal = new THREE.ShaderMaterial({ uniforms: shellUniforms(), vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false });
    this.shellAdd = new THREE.ShaderMaterial({ uniforms: shellUniforms(), vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(176, 32, 16), this.shellNormal);
    this.shell.renderOrder = -1;
    this.shell.visible = false;
    this.shell.frustumCulled = false;
    this.groundMat = new THREE.ShaderMaterial({
      uniforms: {
        uMode: { value: 0 },
        uTime: { value: 0 },
        uP: { value: 0 },
        uFlash: { value: 0 },
        uColA: { value: new THREE.Color() },
        uColB: { value: new THREE.Color() },
        uColC: { value: new THREE.Color() },
        tCrack: { value: crackTex(2) },
        tRune: { value: runeCircleTex(6) },
      },
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(15, 64), this.groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0.035;
    this.ground.renderOrder = 1;
    this.ground.visible = false;
    this.group.add(this.shell, this.ground);
    this.root.add(this.group);
  }

  /** Unfold / switch / leave: the returned Promise resolves when the cinematic ends */
  async set(el: Element | null): Promise<void> {
    const next: FieldElement | null = el && el !== 'neutral' ? el : null;
    if (this.disposed) return;
    const gen = ++this.gen;
    if (next === this.current) {
      if (next) this.pulse(next);
      return;
    }
    this.current = next;
    // The tint fades straight from the current value to the new target (when switching fields there is no need to go back to the original color first)
    this.startAtmos(next, next ? 1.4 : 0.8);
    if (this.layer) {
      // The old field leaves: the environment sinks back into the ground and the particles stop
      await this.tweenPresence(next ? 0.45 : 0.7, 0, ease.inQuad);
      if (gen !== this.gen || this.disposed) return;
      this.dropLayer();
    }
    if (!next) return;
    this.buildLayer(next);
    this.presence = 0;
    this.reveal(next);
    await this.tweenPresence(1.15, 1, ease.outCubic);
  }

  /** Set to true when an ultimate wants to change the sky and fog itself: the field effect pauses rewriting the atmosphere, and setting it back to false in after resumes the fade */
  hold = false;
  /** Set to true when an ultimate wants a clean picture: the weather stops spawning effects such as lightning, splashes and sparks, and does not flash the sky (rain streaks and blown sand carry on); set it back to false in after */
  holdFx = false;

  /** The vfx for the weather layer: while holdFx is on, all spawning is skipped */
  private layerVfx(): Vfx {
    return new Proxy(this.vfx, {
      get: (t, k, r) => {
        const v = Reflect.get(t, k, r) as unknown;
        if (typeof v !== 'function') return v;
        return (...a: unknown[]) => (this.holdFx ? (k === 'emit' || k === 'smoke' ? undefined : Promise.resolve()) : (v as (...x: unknown[]) => unknown).apply(t, a));
      },
    });
  }

  /** Every frame: dt uses the fx clock (rain must still fall during hit-stop) */
  update(dt: number, t: number): void {
    if (this.disposed) return;
    this.time = t;
    if (this.atmosLive && !this.hold) {
      lerpAtmos(this.cur, this.from, this.goal, this.atmosK);
      writeAtmos(this.arena, this.stage, this.cur);
      if (this.atmosK >= 1 && this.goalIsBase) this.atmosLive = false;
    }
    if (this.skyFlash > 0 || this.wroteFlash) {
      this.skyFlash = Math.max(0, this.skyFlash - dt * 3.5);
      this.arena.skyMat.uniforms.uFlash.value = this.skyFlash;
      this.wroteFlash = this.skyFlash > 0;
    }
    const p = this.presence;
    for (const m of [this.shellNormal, this.shellAdd, this.groundMat]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uP.value = p;
      m.uniforms.uFlash.value = this.skyFlash;
    }
    this.shell.visible = !!this.layer && p > 0.005;
    this.ground.visible = this.shell.visible;
    this.layer?.update(dt, t, p);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.gen++;
    this.atmosGen++;
    this.presGen++;
    this.dropLayer();
    this.restore();
    this.root.remove(this.group);
    this.shell.geometry.dispose();
    this.shellNormal.dispose();
    this.shellAdd.dispose();
    this.ground.geometry.dispose();
    this.groundMat.dispose();
  }

  /** Immediately restore all global state to the region's original values */
  private restore(): void {
    writeAtmos(this.arena, this.stage, this.base);
    this.arena.skyMat.uniforms.uStars.value = this.baseStars;
    if (this.wroteFlash) this.arena.skyMat.uniforms.uFlash.value = 0;
    this.skyFlash = 0;
    this.wroteFlash = false;
    this.atmosLive = false;
    this.presence = 0;
  }

  private startAtmos(next: FieldElement | null, dur: number): void {
    lerpAtmos(this.cur, this.from, this.goal, this.atmosK);
    this.from = cloneAtmos(this.cur);
    this.goal = next ? goalAtmos(this.base, ATMOS[next], this.bright) : cloneAtmos(this.base);
    this.goalIsBase = !next;
    this.atmosK = 0;
    this.atmosLive = true;
    this.arena.skyMat.uniforms.uStars.value = next && ATMOS[next].stars ? 1 : this.baseStars;
    const g = ++this.atmosGen;
    void this.tw.to(dur, (k) => {
      if (g === this.atmosGen && !this.disposed) this.atmosK = k;
    }, ease.inOutQuad, 'fx');
  }

  private tweenPresence(dur: number, to: number, e: (x: number) => number): Promise<void> {
    const g = ++this.presGen;
    const from = this.presence;
    return this.tw.to(dur, (k) => {
      if (g === this.presGen && !this.disposed) this.presence = from + (to - from) * k;
    }, e, 'fx');
  }

  private buildLayer(el: FieldElement): void {
    const look = LOOK[el];
    const mat = look.shellAdd ? this.shellAdd : this.shellNormal;
    mat.uniforms.uMode.value = look.shellMode;
    // Additive light shells must be scaled down on bright fields, otherwise the whole sky turns white
    const addScale = look.shellAdd ? 1 - Math.min(1, Math.max(0, (this.bright - 0.45) / 0.45)) * 0.6 : 1;
    (mat.uniforms.uColA.value as THREE.Color).set(look.shellA).multiplyScalar(addScale);
    (mat.uniforms.uColB.value as THREE.Color).set(look.shellB).multiplyScalar(addScale);
    (mat.uniforms.uColC.value as THREE.Color).set(look.shellC).multiplyScalar(addScale);
    if (look.sunDir) (mat.uniforms.uSunDir.value as THREE.Vector3).set(...look.sunDir).normalize();
    this.shell.material = mat;
    this.groundMat.uniforms.uMode.value = look.groundMode;
    const gScale = look.shellAdd ? 0.55 + 0.45 * (1 - Math.min(1, Math.max(0, (this.bright - 0.45) / 0.45)) * 0.7) : 1;
    (this.groundMat.uniforms.uColA.value as THREE.Color).set(look.gA).multiplyScalar(gScale);
    (this.groundMat.uniforms.uColB.value as THREE.Color).set(look.gB).multiplyScalar(gScale);
    (this.groundMat.uniforms.uColC.value as THREE.Color).set(look.gC).multiplyScalar(gScale);
    const group = new THREE.Group();
    this.group.add(group);
    this.layerGroup = group;
    this.layer = LAYERS[el]({
      vfx: this.layerVfx(),
      stage: this.stage,
      group,
      flash: (sky, screen, color) => {
        if (this.holdFx) return;
        this.skyFlash = Math.max(this.skyFlash, sky);
        if (screen > 0) this.stage.screenFlash(color, screen, 6);
      },
      shake: (a) => this.shake(a),
      dim: 1 - Math.min(1, Math.max(0, (this.bright - 0.45) / 0.45)) * 0.7,
    });
  }

  private dropLayer(): void {
    if (this.layer) {
      this.layer.dispose();
      this.layer = null;
    }
    if (this.layerGroup) {
      this.group.remove(this.layerGroup);
      disposeFx(this.layerGroup);
      this.layerGroup = null;
    }
    this.shell.visible = false;
    this.ground.visible = false;
  }

  /** Unfold cinematic: the central magic circle, an element-colored wall of light sweeping across the field from the center, a screen flash and a small camera shake */
  private reveal(el: FieldElement): void {
    const col = COL[el];
    const br = BRIGHT[el];
    void this.vfx.circle(new THREE.Vector3(0, 0.06, 0), col, 9, 1.8, undefined, 5);
    void this.vfx.ring(new THREE.Vector3(0, 0.08, 0), br, 0.5, 26, 1.0);
    this.wall(col, br);
    this.stage.screenFlash(col, 0.3, 3);
    this.shake(0.22);
    this.vfx.emit({ pos: new THREE.Vector3(0, 0.3, 0), count: 60, color: [col, br], speed: [6, 14], dir: UP, spread: 1.2, life: [0.6, 1.2], size: [0.15, 0.35], gravity: 3 });
  }

  /** The same field unfolds again (refreshing its turn count): just a small pulse */
  private pulse(el: FieldElement): void {
    void this.vfx.ring(new THREE.Vector3(0, 0.08, 0), COL[el], 1, 14, 0.8);
    this.stage.screenFlash(COL[el], 0.15, 3);
  }

  /** Wall of light expanding from the center: bright at the bottom, fading out upward */
  private wall(col: number, br: number): void {
    const geo = new THREE.CylinderGeometry(1, 1, 7, 64, 1, true);
    geo.translate(0, 3.5, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColA: { value: new THREE.Color(col).multiplyScalar(1.6) }, uColB: { value: new THREE.Color(br).multiplyScalar(2.4) }, uA: { value: 1 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uColA; uniform vec3 uColB; uniform float uA; varying vec2 vUv;
        void main(){ float a = pow(max(1.0 - vUv.y, 0.0), 1.6) * uA; vec3 c = mix(uColA, uColB, pow(max(1.0 - vUv.y, 0.0), 5.0)); gl_FragColor = vec4(c, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const m = new THREE.Mesh(geo, mat);
    void this.vfx.spawn(m, 1.0, (k) => {
      const r = 0.5 + 27 * ease.outCubic(k);
      m.scale.set(r, 1 + k * 0.6, r);
      mat.uniforms.uA.value = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
    });
  }
}
