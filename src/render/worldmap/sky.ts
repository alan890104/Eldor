// Sky layer of the world map: the distant sky dome, the sea of clouds under the islands (three-step toon bands, each island casting a shadow on the clouds),
// and cloud puffs that drift slowly along the screen edges only (so they never sit between an island and its name plate).

import * as THREE from 'three';
import { cloudGeo, M, rng, type Look } from './kit.ts';
import { lookMaterial } from './props.ts';
import { inkScenery } from '../ink.ts';

export const SEA_Y = -6.5;
const MAX_SHADOWS = 12;

export function buildSky(root: THREE.Object3D, low: boolean): { tick: (t: number) => void; setShadows: (list: { x: number; z: number; r: number; h: number }[], light: THREE.Vector3) => void } {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(150, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(vec3(0.62,0.72,0.95), vec3(0.2,0.3,0.66), smoothstep(-0.1,0.6,h)); gl_FragColor = vec4(c,1.0); }`,
    }),
  );
  root.add(sky);

  // Sea of clouds: large cloud waves split into three steps (dark-blue valleys, blue-white mid-bands, bright white tops), flowing slowly; each island's shadow is cast on the clouds along the main light direction
  const isl = Array.from({ length: MAX_SHADOWS }, () => new THREE.Vector4(0, 0, 0, 0));
  const seaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIsl: { value: isl }, uN: { value: 0 }, uOff: { value: new THREE.Vector2() } },
    vertexShader: /* glsl */ `varying vec2 vW; void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xz; gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec4 uIsl[${MAX_SHADOWS}]; uniform int uN; uniform vec2 uOff; varying vec2 vW;
      float billow(vec2 p) {
        float n = sin(p.x * 0.19 + uTime * 0.05 + sin(p.y * 0.15) * 1.7) * sin(p.y * 0.21 - uTime * 0.04 + sin(p.x * 0.12) * 1.4);
        n += 0.5 * sin(p.x * 0.47 - uTime * 0.08 + sin(p.y * 0.39) * 1.2) * sin(p.y * 0.43 + uTime * 0.06);
        n += 0.22 * sin(p.x * 1.05 + p.y * 0.83 + uTime * 0.1);
        return n;
      }
      void main(){
        float n = billow(vW);
        vec3 deep = vec3(0.17, 0.26, 0.58);
        vec3 mid = vec3(0.3, 0.44, 0.8);
        vec3 hi = vec3(0.44, 0.58, 0.9);
        vec3 top = vec3(0.78, 0.85, 1.0);
        vec3 c = mix(deep, mid, smoothstep(-0.3, -0.22, n));
        c = mix(c, hi, smoothstep(0.42, 0.5, n));
        c = mix(c, top, smoothstep(1.02, 1.1, n));
        float sh = 0.0;
        for (int i = 0; i < ${MAX_SHADOWS}; i++) {
          if (i >= uN) break;
          vec4 s = uIsl[i];
          float d = length(vW - (s.xy + uOff * s.w));
          sh = max(sh, 1.0 - smoothstep(s.z * 0.45, s.z * 1.1, d));
        }
        c = mix(c, c * vec3(0.55, 0.6, 0.85), sh * 0.55);
        float rr = length(vW - vec2(0.0, 2.0)) / 70.0;
        c = mix(c, deep * 0.85, smoothstep(0.35, 1.0, rr));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sea = new THREE.Mesh(new THREE.CircleGeometry(150, 64), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = SEA_Y;
  root.add(sea);

  // Cloud puffs at the screen edge: left and right sides and the two lower corners, lower than the islands and higher than the sea of clouds, drifting slowly back and forth
  const r = rng(77);
  const look: Look = { ambient: 0xc8cce8, shadow: 0x8a94d0, rim: 0xffffff };
  const mat = lookMaterial(new THREE.Color(0xf6f8ff), look, 0.5);
  const spots: [number, number, number, number][] = [
    [-19, -3.2, -4, 1.5],
    [-20, -3.8, 4, 1.8],
    [-17, -4.2, 11, 1.4],
    [19, -3.4, -5, 1.6],
    [20, -3.9, 3, 1.7],
    [16.5, -4.3, 11.5, 1.5],
    [-9, -4.6, 16.5, 1.4],
    [9, -4.6, 16.5, 1.3],
    [-13, -3.6, -12, 1.2],
    [13, -3.6, -12.5, 1.2],
  ];
  const clouds: { m: THREE.Mesh; x: number; ph: number }[] = [];
  for (const [x, y, z, s] of spots.slice(0, low ? 6 : spots.length)) {
    const m = new THREE.Mesh(cloudGeo(4 + Math.floor(r() * 3), 1.4, r, 1), mat);
    m.applyMatrix4(M(x, y, z, r() * 0.6 - 0.3, s));
    root.add(m);
    inkScenery(m);
    clouds.push({ m, x, ph: r() * 6 });
  }
  return {
    tick(t) {
      seaMat.uniforms.uTime.value = t;
      for (const c of clouds) c.m.position.x = c.x + Math.sin(t * 0.05 + c.ph) * 1.2;
    },
    setShadows(list, light) {
      const L = light.clone().normalize();
      seaMat.uniforms.uOff.value.set(-L.x / L.y, -L.z / L.y);
      list.slice(0, MAX_SHADOWS).forEach((s, i) => isl[i].set(s.x, s.z, s.r, s.h));
      seaMat.uniforms.uN.value = Math.min(MAX_SHADOWS, list.length);
    },
  };
}
