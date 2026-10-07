// Toon shading: stepped lighting + rim light + hit flash; the outline is a back-face mesh extruded along the normals.

import * as THREE from 'three';

/** Lighting parameters shared by the whole scene */
export const LIGHT = {
  dir: { value: new THREE.Vector3(0.45, 0.85, 0.35).normalize() },
  ambient: { value: new THREE.Color(0.52, 0.52, 0.62) },
  rimColor: { value: new THREE.Color(1, 0.95, 0.85) },
  shadowTint: { value: new THREE.Color(0.55, 0.45, 0.75) },
};

/** Effect clock shared by the whole scene (seconds): drives the corruption crack pulse; advanced by Creature.update */
export const FX_TIME = { value: 0 };

const toonVert = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;
  varying vec3 vObj;
  void main() {
    vObj = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const toonFrag = /* glsl */ `
  #include <fog_pars_fragment>
  uniform vec3 uColor;
  uniform vec3 uLightDir;
  uniform vec3 uAmbient;
  uniform vec3 uRimColor;
  uniform vec3 uShadowTint;
  uniform vec3 uEmissive;
  uniform float uEmissiveAmt;
  uniform vec3 uFlash;
  uniform float uFlashAmt;
  uniform float uRim;
  uniform float uOpacity;
  uniform float uCorrupt;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;
  varying vec3 vObj;
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
  // Cracks: the difference in distance between two adjacent Voronoi cells (F2 - F1); near 0 is the boundary line of the cell
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
  // A zero-length vector cannot be normalized (it gives NaN, which bloom then spreads into a black block)
  vec3 safeNormalize(vec3 v, vec3 fallback) {
    float l = length(v);
    return l > 1e-6 ? v / l : fallback;
  }
  void main() {
    vec3 n = safeNormalize(vNormal, vec3(0.0, 1.0, 0.0));
    float ndl = dot(n, normalize(uLightDir));
    // Three-step color ramp
    float lit = smoothstep(-0.05, 0.05, ndl) * 0.55 + smoothstep(0.55, 0.62, ndl) * 0.2;
    vec3 shade = uColor * mix(uShadowTint * 0.62, vec3(1.0), 0.35);
    vec3 col = mix(shade, uColor, lit / 0.75);
    col *= mix(uAmbient * 1.35, vec3(1.08), 0.55);
    // Rim light
    // dot may slightly exceed 1 from floating-point error, so the base must be clamped to 0-1; pow of a negative number is NaN on some GPUs
    float fres = pow(clamp(1.0 - dot(n, safeNormalize(vViewDir, n)), 0.0, 1.0), 3.0);
    col += uRimColor * smoothstep(0.35, 0.6, fres) * uRim * (0.4 + 0.6 * max(ndl, 0.0));
    col += uEmissive * uEmissiveAmt;
    // Corrupted: the body fades to purple-black, the rim light turns purple-red, and the surface is covered in pulsing glowing cracks
    if (uCorrupt > 0.0) {
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(0.07, 0.025, 0.1) + lum * vec3(0.22, 0.1, 0.27), 0.88 * uCorrupt);
      col += vec3(0.95, 0.1, 0.62) * smoothstep(0.35, 0.7, fres) * 0.6 * uCorrupt;
      vec3 q = vObj * 5.5;
      q += (vec3(cnoise(q * 1.7), cnoise(q * 1.7 + 5.0), cnoise(q * 1.7 + 9.0)) - 0.5) * 0.7;
      float e = crackEdge(q);
      float vein = 1.0 - smoothstep(0.05, 0.13, e);
      // Only some borders split open, so it reads as individual cracks rather than a grid
      float crackMask = smoothstep(0.22, 0.45, cnoise(vObj * 2.2 + 3.0));
      vein *= crackMask;
      float pulse = 0.6 + 0.4 * sin(uTime * 3.0 - vObj.y * 9.0);
      col = mix(col, vec3(0.2, 0.02, 0.2), (1.0 - smoothstep(0.12, 0.26, e)) * uCorrupt * 0.6 * crackMask);
      col = mix(col, vec3(2.2, 0.25, 1.5) * pulse, vein * uCorrupt);
    }
    col = mix(col, uFlash, uFlashAmt);
    gl_FragColor = vec4(col, uOpacity);
    #include <fog_fragment>
  }
`;

export interface ToonOptions {
  rim?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveAmt?: number;
  opacity?: number;
}

export function toonMaterial(color: THREE.ColorRepresentation, o: ToonOptions = {}): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uColor: { value: new THREE.Color(color) },
      uLightDir: LIGHT.dir,
      uAmbient: LIGHT.ambient,
      uRimColor: LIGHT.rimColor,
      uShadowTint: LIGHT.shadowTint,
      uEmissive: { value: new THREE.Color(o.emissive ?? 0x000000) },
      uEmissiveAmt: { value: o.emissiveAmt ?? 0 },
      uFlash: { value: new THREE.Color(1, 1, 1) },
      uFlashAmt: { value: 0 },
      uRim: { value: o.rim ?? 0.55 },
      uOpacity: { value: o.opacity ?? 1 },
      uCorrupt: { value: 0 },
      uTime: FX_TIME,
    },
    vertexShader: toonVert,
    fragmentShader: toonFrag,
    transparent: (o.opacity ?? 1) < 1,
  });
  return m;
}

const outlineVert = /* glsl */ `
  uniform float uThickness;
  varying float vDepth;
  void main() {
    vec3 p = position + normal * uThickness;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const outlineFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uNear;
  varying float vDepth;
  void main() {
    if (vDepth < uNear) discard;
    gl_FragColor = vec4(uColor, uOpacity);
  }
`;

/**
 * Outline: a back-face mesh extruded along the normals. Outlines inside near are not drawn, because when the camera passes into a tree trunk or a rock,
 * the body's front faces are culled and only the outline's inner wall is left, painting the whole screen black
 */
export function outlineMaterial(thickness: number, color: THREE.ColorRepresentation = 0x1b1026, near = 0): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
      uNear: { value: near },
    },
    vertexShader: outlineVert,
    fragmentShader: outlineFrag,
    side: THREE.BackSide,
  });
}

/** Emissive material (flames, halos, eye highlights): unlit, and amplified by bloom */
export function glowMaterial(color: THREE.ColorRepresentation, intensity = 2.2, opacity = 1): THREE.MeshBasicMaterial {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({
    color: c,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    toneMapped: false,
  });
}

export function unlitMaterial(color: THREE.ColorRepresentation): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color });
}
