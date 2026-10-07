// Stoneheart Canyon's shaders: the sedimentary strata and tortoise-shell scutes on the terrain (a patch to the terrain
// material), quicksand, dust devils, the tiered waterfall, and the plateau and distant rock walls that wrap around the outside
// of the map.

import * as THREE from 'three';
import { LIGHT } from '../../../toon.ts';

/** Strata colors: repeated layer by layer from bottom to top (red, orange, ochre, with cream bands) */
export const STRATA = [0xb4553a, 0xcf7a4a, 0xa84a34, 0xe0a877, 0xc0643e, 0x8e4232, 0xd88e56, 0xb65a3c, 0xeec79a, 0xc46e44, 0x9c4834, 0xd9955c];
/**
 * The marker color for the tortoise-shell area in the vertex colors (the shader only draws scutes where it sees this color;
 * roads and plazas keep their own color)
 */
export const SHELL_MARK = 0x6e5a36;

const GLSL_NOISE = /* glsl */ `
  float cnHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float cnNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(cnHash(i), cnHash(i + vec2(1, 0)), u.x), mix(cnHash(i + vec2(0, 1)), cnHash(i + vec2(1, 1)), u.x), u.y);
  }`;

const GLSL_STRATA = /* glsl */ `
  uniform vec3 uStrata[12];
  uniform float uBandH;
  vec3 cnStrata(vec3 w, vec3 fn) {
    float y = w.y + (cnNoise(w.xz * 0.04) - 0.5) * 2.6 + w.x * 0.012 - w.z * 0.006;
    float yb = y / uBandH;
    yb += 0.3 * sin(yb * 0.83 + 1.3);
    float bi = floor(yb);
    float f = yb - bi;
    vec3 c = uStrata[int(mod(bi, 12.0))];
    c *= 0.9 + 0.13 * f;
    c *= mix(0.72, 1.0, smoothstep(0.0, 0.09, f));
    vec2 hd = vec2(-fn.z, fn.x);
    float hl = length(hd);
    float along = hl > 1e-4 ? dot(w.xz, hd / hl) : w.x;
    float st = cnNoise(vec2(along * 0.55, w.y * 0.045 + 3.0));
    c *= 1.0 - 0.24 * smoothstep(0.55, 0.92, st);
    c *= 0.93 + 0.12 * cnNoise(vec2(along * 2.3, w.y * 1.4));
    return c;
  }`;

function strataUniforms(): Record<string, THREE.IUniform> {
  return { uStrata: { value: STRATA.map((c) => new THREE.Color(c)) }, uBandH: { value: 1.55 } };
}

/** Seed points for the shell scutes: spine scutes, rib scutes, marginal scutes */
function scuteSeeds(cx: number, cz: number, R: number): THREE.Vector2[] {
  const s: THREE.Vector2[] = [];
  for (let k = -2; k <= 2; k++) s.push(new THREE.Vector2(cx, cz + k * 10));
  for (const sx of [-1, 1]) for (const dz of [-15, -5, 5, 15]) s.push(new THREE.Vector2(cx + sx * 14.5, cz + dz));
  const n = 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.06;
    s.push(new THREE.Vector2(cx + Math.cos(a) * (R - 1.2), cz + Math.sin(a) * (R - 1.2)));
  }
  return s;
}

/**
 * Patch the terrain material: on steep slopes, draw horizontal sedimentary strata by world height (bedding seams, rock-varnish
 * streaks) and light steep slopes with the face normal (sharp-edged cliffs); on the shell area, draw scutes, growth rings and
 * the skin under the shell rim. If the engine's terrain shader changed and the insertion point can't be found, leave it as is
 * (return false).
 */
export function patchTerrain(mesh: THREE.Mesh, shell: [number, number, number]): boolean {
  const mat = mesh.material as THREE.ShaderMaterial;
  const fs = mat.fragmentShader;
  const need = ['void main()', 'vec3 base =', 'float lit', 'float big', 'vWorld', 'vec3 n = ', 'vColor'];
  if (typeof fs !== 'string' || !need.every((s) => fs.includes(s))) return false;
  const seeds = scuteSeeds(shell[0], shell[1], shell[2]);
  Object.assign(mat.uniforms, strataUniforms(), {
    uShellC: { value: new THREE.Vector3(...shell) },
    uScute: { value: seeds },
    uPlate: { value: [new THREE.Color(0x9c8656), new THREE.Color(0xb89a62), new THREE.Color(0x848452)] },
    uSeam: { value: new THREE.Color(0x4a3626) },
    uSkin: { value: new THREE.Color(0x5e5a44) },
    uMark: { value: new THREE.Color(SHELL_MARK) },
    uPave: { value: new THREE.Color(0xd6c29c) },
  });
  const helpers = /* glsl */ `
  ${GLSL_NOISE}
  ${GLSL_STRATA}
  uniform vec3 uShellC;
  uniform vec2 uScute[${seeds.length}];
  uniform vec3 uPlate[3];
  uniform vec3 uSeam;
  uniform vec3 uSkin;
  uniform vec3 uMark;
  uniform vec3 uPave;
  vec3 cnShell(vec3 w, float rs) {
    float d1 = 1e9, d2 = 1e9, id = 0.0;
    for (int i = 0; i < ${seeds.length}; i++) {
      float d = length(w.xz - uScute[i]);
      if (d < d1) { d2 = d1; d1 = d; id = float(i); }
      else if (d < d2) { d2 = d; }
    }
    float e = d2 - d1;
    vec3 c = mix(uPlate[0], uPlate[1], cnHash(vec2(id, 7.0)));
    c = mix(c, uPlate[2], smoothstep(0.55, 1.0, cnHash(vec2(id, 3.1))) * 0.8);
    c *= 0.9 + 0.1 * sin(d1 * 2.6);
    c *= 0.94 + 0.1 * cnNoise(w.xz * 0.9);
    c = mix(uSeam, c, smoothstep(0.12, 0.5, e));
    c = mix(c, c * 1.12, smoothstep(0.5, 1.1, e) * (1.0 - smoothstep(1.1, 2.2, e)));
    // The plates inside the city wall are paved into a street surface: staggered stone slabs in rings around the shell center (the seams between plates are still visible)
    float ring = rs / 1.7;
    float ri = floor(ring);
    float seg = atan(w.z - uShellC.y, w.x - uShellC.x) * max(rs, 2.0) / 1.9 + ri * 0.5;
    float fr = fract(ring);
    float fs = fract(seg);
    float gr = min(min(fr, 1.0 - fr) * 1.7, min(fs, 1.0 - fs) * 1.9);
    vec3 pv = uPave * (0.86 + 0.18 * cnHash(vec2(ri, floor(seg)))) * (0.95 + 0.08 * cnHash(vec2(id, 1.3)));
    pv = mix(pv * 0.74, pv, smoothstep(0.04, 0.11, gr));
    c = mix(c, pv, (1.0 - smoothstep(24.5, 26.5, rs)) * 0.72 * smoothstep(0.12, 0.5, e));
    return mix(c, uSkin, smoothstep(uShellC.z - 0.3, uShellC.z + 0.5, rs));
  }
void main()`;
  const body = /* glsl */ `
    {
      vec3 fn = cross(dFdx(vWorld), dFdy(vWorld));
      float fnl = length(fn);
      fn = fnl > 1e-6 ? fn / fnl : n;
      if (fn.y < 0.0) fn = -fn;
      float steep = smoothstep(0.8, 0.52, fn.y);
      float rs = length(vWorld.xz - uShellC.xy);
      float shellW = rs < uShellC.z + 3.0 ? 1.0 - smoothstep(0.03, 0.16, distance(vColor, uMark)) : 0.0;
      if (shellW > 0.0) base = mix(base, cnShell(vWorld, rs) * (0.93 + big * 0.12), shellW);
      if (steep > 0.001 && shellW < 0.99) base = mix(base, cnStrata(vWorld, fn) * (0.94 + big * 0.1), steep * (1.0 - shellW));
      vec3 nl = normalize(mix(n, fn, steep * 0.7));
      float ndl2 = dot(nl, normalize(uLightDir));
      lit = smoothstep(-0.08, 0.1, ndl2) * 0.62 + smoothstep(0.52, 0.6, ndl2) * 0.38;
    }`;
  // Insert after the statement 'vec3 base = ...;' (later engine processing, e.g. the darkening from Void Blight erosion, lays
  // over the strata)
  const withHelpers = fs.replace('void main()', helpers);
  const i0 = withHelpers.indexOf('vec3 base =');
  const i1 = withHelpers.indexOf(';', i0) + 1;
  mat.fragmentShader = withHelpers.slice(0, i1) + body + withHelpers.slice(i1);
  mat.needsUpdate = true;
  return true;
}

// ───────────────────────── Quicksand ─────────────────────────

/**
 * Quicksand: a flat sand surface (the terrain sinks in the middle, so walking in sinks you to the calves), with sand ripples
 * spiraling in toward the center
 */
export function quicksandMaterial(radius: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uR: { value: radius },
      uBase: { value: new THREE.Color(0xd9a56c) },
      uDark: { value: new THREE.Color(0x9a6038) },
      uHi: { value: new THREE.Color(0xf4d29c) },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vP;
      varying vec3 vW;
      void main() {
        vP = position.xz;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform float uR; uniform vec3 uBase; uniform vec3 uDark; uniform vec3 uHi;
      varying vec2 vP; varying vec3 vW;
      ${GLSL_NOISE}
      void main() {
        vec2 p = vP / uR;
        float d = length(p);
        vec2 q = p + vec2(1e-4, 0.0);
        float ang = atan(q.y, q.x);
        float sp = fract(d * 6.0 + uTime * 0.07 + ang / 6.2832 * 2.0 + sin(ang * 3.0 + uTime * 0.23) * 0.05 + cnNoise(vW.xz * 0.6) * 0.18);
        float groove = smoothstep(0.32, 0.48, sp) * (1.0 - smoothstep(0.62, 0.8, sp));
        float ridge = smoothstep(0.82, 0.95, sp) * (1.0 - smoothstep(0.95, 1.0, sp));
        vec3 c = mix(uBase, uDark, groove * 0.55);
        c = mix(c, uHi, ridge * 0.5);
        c *= 0.92 + 0.12 * cnNoise(vW.xz * 1.7);
        c = mix(uDark * 0.72, c, smoothstep(0.02, 0.34, d));
        float a = 1.0 - smoothstep(0.86, 1.0, d);
        gl_FragColor = vec4(c, a);
        #include <fog_fragment>
      }`,
  });
}

// ───────────────────────── Dust devil ─────────────────────────

/** Dust devil: a cylinder wide at the top and narrow at the bottom, with spiral dust streaks curling upward */
export function dustDevilMaterial(color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAmt: { value: 1 } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float k = uv.y;
        p.x += sin(k * 5.0 + position.y * 0.3) * k * 0.9;
        p.z += cos(k * 4.0) * k * 0.7;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uColor; uniform float uAmt; varying vec2 vUv;
      ${GLSL_NOISE}
      void main() {
        float s = vUv.x * 3.0 + vUv.y * 2.2 - uTime * 1.3;
        float n = cnNoise(vec2(s * 5.0, vUv.y * 4.0 - uTime * 2.2)) * 0.65 + cnNoise(vec2(s * 11.0, vUv.y * 9.0 - uTime * 3.0)) * 0.35;
        float a = smoothstep(0.4, 0.85, n) * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
        gl_FragColor = vec4(uColor * (0.85 + 0.3 * n), a * 0.5 * uAmt);
        #include <fog_fragment>
      }`,
  });
}

// ───────────────────────── Waterfall ─────────────────────────

/** A ribbon of water falling step by step down the rock wall: uv.y is the length along the flow (meters) */
export function cascadeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uA: { value: new THREE.Color(0x7ee0e0) }, uB: { value: new THREE.Color(0xf4fffc) } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aSteep;
      varying vec2 vUv; varying float vSteep;
      void main() {
        vUv = uv; vSteep = aSteep;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uA; uniform vec3 uB;
      varying vec2 vUv; varying float vSteep;
      ${GLSL_NOISE}
      void main() {
        float sp = mix(1.2, 4.0, vSteep);
        float n = cnNoise(vec2(vUv.x * 9.0, vUv.y * 1.3 - uTime * sp)) * 0.6 + cnNoise(vec2(vUv.x * 21.0, vUv.y * 3.1 - uTime * sp * 1.4)) * 0.4;
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        vec3 c = mix(uA, uB, smoothstep(0.45, 0.8, n) * (0.5 + vSteep * 0.5));
        float a = edge * (0.55 + 0.4 * n) * (0.75 + vSteep * 0.25);
        gl_FragColor = vec4(c * 1.08, a);
        #include <fog_fragment>
      }`,
  });
}

// ───────────────────────── Outer plateau ─────────────────────────

/**
 * Outside the map: one whole plateau at the same height as the wall tops (so the map edge isn't visible from above), with the
 * strata also drawn on the vertical ring of wall at its outer edge
 */
export function plateauMaterial(top: number, speck: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      ...strataUniforms(),
      uTop: { value: new THREE.Color(top) },
      uSpeck: { value: new THREE.Color(speck) },
      uLightDir: LIGHT.dir,
      uAmbient: LIGHT.ambient,
      uShadowTint: LIGHT.shadowTint,
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uTop; uniform vec3 uSpeck; uniform vec3 uLightDir; uniform vec3 uAmbient; uniform vec3 uShadowTint;
      varying vec3 vW; varying vec3 vN;
      ${GLSL_NOISE}
      ${GLSL_STRATA}
      void main() {
        vec3 n = normalize(vN);
        vec3 base;
        if (n.y > 0.5) {
          float b = cnNoise(vW.xz * 0.02) * 0.6 + cnNoise(vW.xz * 0.09) * 0.4;
          base = mix(uTop, uSpeck, smoothstep(0.55, 0.8, b) * 0.6) * (0.9 + 0.14 * cnNoise(vW.xz * 0.4));
        } else {
          base = cnStrata(vW, n);
        }
        float ndl = dot(n, normalize(uLightDir));
        float lit = smoothstep(-0.08, 0.1, ndl) * 0.62 + smoothstep(0.52, 0.6, ndl) * 0.38;
        vec3 shade = base * mix(uShadowTint * 0.7, vec3(1.0), 0.42);
        vec3 col = mix(shade, base, lit) * mix(uAmbient * 1.3, vec3(1.08), 0.6);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}
