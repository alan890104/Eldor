// Ground effect layers: wind ripples that sweep over the distant grass sea in waves, patches of light slipping through gaps
// in the clouds, glowing discharge patterns left by lightning strikes,
// and the grassland beyond the map that runs on to the horizon
// (attached behind the border's gentle hills, so the "boundless" feel shows even from a bird's-eye view).

import * as THREE from 'three';
import type { FieldCtx } from '../../kit.ts';
import type { Seg } from './land.ts';
import { NOISE } from './storm.ts';

/**
 * Wind ripples on the grass sea: a translucent mesh laid over the terrain. It fades out up close (where real grass tufts are
 * drawn),
 * and farther out, gust waves in the same phase as the tufts draw bright and dark bands,
 * with patches of light drifting slowly across.
 */
export function grassSheen(ctx: FieldCtx, mask: (x: number, z: number) => number, hi: number, lo: number, sun: number, erode: { value: THREE.Vector4 }): (t: number, flash: number) => void {
  const S = ctx.layout.size;
  const seg = Math.round(S * (ctx.low ? 0.6 : 1));
  const g = new THREE.PlaneGeometry(S * 2, S * 2, seg, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const m = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    p.setY(i, ctx.h(x, z) + 0.12);
    m[i] = mask(x, z);
  }
  g.setAttribute('aM', new THREE.BufferAttribute(m, 1));
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const mat = new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uHi: { value: new THREE.Color(hi) },
      uLo: { value: new THREE.Color(lo) },
      uSun: { value: new THREE.Color(sun) },
      uErode: erode,
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aM;
      varying vec3 vW; varying float vM;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz; vM = aM;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform float uFlash; uniform vec3 uHi; uniform vec3 uLo; uniform vec3 uSun; uniform vec4 uErode;
      varying vec3 vW; varying float vM;
      ${NOISE}
      void main() {
        if (vM < 0.01) discard;
        float d = length(vW.xz - cameraPosition.xz);
        float far = smoothstep(26.0, 54.0, d);
        // The same gust wave as the grass tufts: sin(x*0.08 + z*0.05 - t*1.3)
        float g = sin(vW.x * 0.08 + vW.z * 0.05 - uTime * 1.3);
        float n = vnoise(vW.xz * 0.035 + vec2(uTime * 0.05, uTime * 0.03));
        float n2 = vnoise(vW.xz * 0.12 - vec2(uTime * 0.16, 0.0));
        float crest = smoothstep(0.3, 0.95, g) * (0.4 + n * 0.9) * (0.65 + n2 * 0.55) * far;
        float trough = smoothstep(-0.25, -0.95, g) * (0.45 + n * 0.6) * far;
        // Slanting sunlight leaking through gaps in the clouds, drifting slowly across the grassland
        vec2 sp = vW.xz * 0.0105 - vec2(uTime * 0.024, uTime * 0.011);
        float sun = smoothstep(0.6, 0.78, fbm(sp)) * (0.75 + 0.25 * sin(uTime * 0.4));
        float ac = crest * 0.26;
        float at = trough * 0.2;
        float as = sun * 0.13;
        float a = ac + at + as;
        vec3 col = (uHi * ac + uLo * at + uSun * as) / max(a, 1e-3);
        col += vec3(0.6, 0.6, 0.9) * uFlash * 0.5;
        // On land eroded by the Void Blight the grass has withered, so there are no wind waves
        float ero = uErode.z > 0.0 ? smoothstep(uErode.z * 0.72, uErode.z * 1.02, length(vW.xz - uErode.xy)) : 1.0;
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.85) * vM * ero);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 1;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    g.dispose();
    mat.dispose();
  });
  return (t, flash) => {
    mat.uniforms.uTime.value = t;
    mat.uniforms.uFlash.value = flash;
  };
}

/**
 * Discharge-pattern decal: line segments drawn on a canvas (bright in the center, feathered at the edge),
 * laid over the terrain relief,
 * with waves of light running outward from the center
 */
export function veinDecal(ctx: FieldCtx, cx: number, cz: number, half: number, segs: Seg[], color: number, amt: number): (t: number, flash: number, boost: number) => void {
  const px = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, px, px);
  const k = px / (half * 2);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const pass of [
    { blur: 14, w: 2.6, a: 0.45 },
    { blur: 0, w: 0.9, a: 1 },
  ]) {
    g.shadowBlur = pass.blur;
    g.shadowColor = '#fff';
    g.strokeStyle = `rgba(255,255,255,${pass.a})`;
    for (const s of segs) {
      g.lineWidth = Math.max(1, s.w * k * pass.w * 0.35);
      g.beginPath();
      g.moveTo((s.x0 - cx + half) * k, (s.z0 - cz + half) * k);
      g.lineTo((s.x1 - cx + half) * k, (s.z1 - cz + half) * k);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  const geo = new THREE.PlaneGeometry(half * 2, half * 2, 40, 40);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, ctx.h(cx + p.getX(i), cz + p.getZ(i)) + 0.08);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -6,
    uniforms: { uTex: { value: tex }, uTime: { value: 0 }, uFlash: { value: 0 }, uBoost: { value: 0 }, uCol: { value: new THREE.Color(color).multiplyScalar(amt) }, uC: { value: new THREE.Vector2(cx, cz) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vW;
      void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex; uniform float uTime; uniform float uFlash; uniform float uBoost; uniform vec3 uCol; uniform vec2 uC;
      varying vec2 vUv; varying vec3 vW;
      void main() {
        float v = texture2D(uTex, vUv).r;
        float r = length(vW.xz - uC);
        float wave = pow(0.5 + 0.5 * sin(r * 0.55 - uTime * 2.6), 4.0);
        float k = v * (0.28 + wave * 0.8 + uFlash * 1.6 + uBoost * 2.5);
        gl_FragColor = vec4(uCol * k, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, 0, cz);
  mesh.renderOrder = 2;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    geo.dispose();
    mat.dispose();
    tex.dispose();
  });
  return (t, flash, boost) => {
    mat.uniforms.uTime.value = t;
    mat.uniforms.uFlash.value = flash;
    mat.uniforms.uBoost.value = boost;
  };
}

/**
 * The grassland beyond the map: attached below the terrain edge, extending outward ring by ring to 820 meters;
 * the height eases from the edge's height into the distant undulation. Reuses the terrain's material directly (same toon lighting,
 * noise and fog).
 */
export function farPlains(ctx: FieldCtx, farH: (x: number, z: number) => number, color: (x: number, z: number, out: THREE.Color) => void): void {
  const S = ctx.layout.size;
  const rings = [-1.5, 3, 8, 15, 25, 40, 62, 95, 140, 200, 290, 420, 560, 700];
  const M = 4 * 120;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  const perim = (k: number, R: number): [number, number] => {
    // The k-th point on the perimeter of the square (counterclockwise)
    const t = (k / M) * 4;
    const side = Math.floor(t) % 4;
    const f = t - Math.floor(t);
    const s = -R + f * 2 * R;
    return side === 0 ? [s, -R] : side === 1 ? [R, s] : side === 2 ? [-s, R] : [-R, -s];
  };
  rings.forEach((d, j) => {
    const R = S + d;
    for (let k = 0; k < M; k++) {
      const [x, z] = perim(k, R);
      const edge = ctx.h(Math.max(-S, Math.min(S, x)), Math.max(-S, Math.min(S, z)));
      const w = Math.min(1, Math.max(0, d) / 90);
      const blend = w * w * (3 - 2 * w);
      let y = edge + (farH(x, z) - edge) * blend;
      if (j === 0) y = ctx.h(x, z) - 0.6;
      pos.push(x, y, z);
      color(x, z, c);
      col.push(c.r, c.g, c.b);
    }
  });
  for (let j = 0; j < rings.length - 1; j++) {
    for (let k = 0; k < M; k++) {
      const a = j * M + k;
      const b = j * M + ((k + 1) % M);
      const c2 = (j + 1) * M + k;
      const d2 = (j + 1) * M + ((k + 1) % M);
      idx.push(a, c2, b, b, c2, d2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Normals face up (flip them if the index winding turned out reversed)
  const n = g.attributes.normal as THREE.BufferAttribute;
  if (n.getY(M * 3) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  const mesh = new THREE.Mesh(g, ctx.terrain.mesh.material as THREE.Material);
  mesh.frustumCulled = false;
  ctx.group.add(mesh);
  ctx.disposers.push(() => g.dispose());
}
