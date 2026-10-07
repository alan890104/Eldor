// Dawnlight Holy City sky and moving things: the slowly flowing sea of clouds underfoot (clouds pile up near the island
// edge), thin clouds drifting along the cliffs, distant cumulus towers and floating islets (slowly bobbing up and down),
// pillars of light descending from the sky, white doves circling the city, flags fluttering in the wind, the purification
// barrier, and the fountain water.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, MS, PropBatch } from '../../../arenaKit.ts';
import { softDiscTex } from '../../../arenas/_woods.ts';
import type { FieldCtx } from '../../kit.ts';
import { C } from './arch.ts';
import { CLOUD_Y, S } from './shape.ts';

const NOISE = /* glsl */ `
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm3(vec2 p) { return vnoise(p) * 0.52 + vnoise(p * 2.07 + 3.7) * 0.3 + vnoise(p * 4.3 + 9.1) * 0.18; }
`;

/** A circular grid centered on the origin, getting sparser outward (fine near, coarse far) */
function polarGrid(rMax: number, th: number, rn: number, pow = 2): THREE.BufferGeometry {
  const pos: number[] = [0, 0, 0];
  for (let k = 1; k <= rn; k++) {
    const r = rMax * Math.pow(k / rn, pow);
    for (let i = 0; i < th; i++) {
      const a = (i / th) * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < th; i++) idx.push(0, 1 + ((i + 1) % th), 1 + i);
  for (let k = 1; k < rn; k++) {
    const a0 = 1 + (k - 1) * th;
    const a1 = 1 + k * th;
    for (let i = 0; i < th; i++) {
      const i1 = (i + 1) % th;
      idx.push(a0 + i, a0 + i1, a1 + i, a0 + i1, a1 + i1, a1 + i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** Distance-to-island-edge texture (clouds pile up and turn white at the island edge) */
function nearTexture(shore: (x: number, z: number) => number, ext: number, n = 128): THREE.DataTexture {
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -ext + ((i + 0.5) / n) * 2 * ext;
      const z = -ext + ((j + 0.5) / n) * 2 * ext;
      const s = shore(x, z);
      const v = s >= 0 ? 1 : Math.max(0, 1 + s / 30);
      data[(j * n + i) * 4] = Math.round(v * v * 255);
      data[(j * n + i) * 4 + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/**
 * Sea of clouds: a large undulating cloud top (three-step color banding, tinted gold on the sun side), plus a
 * layer of thin clouds drifting along the cliffs
 */
export function cloudSea(ctx: FieldCtx, shore: (x: number, z: number) => number, sunDir: THREE.Vector3): void {
  const ext = S + 40;
  const near = nearTexture(shore, ext);
  const sun2 = new THREE.Vector2(sunDir.x, sunDir.z).normalize();
  const common = {
    uTime: { value: 0 },
    uNear: { value: near },
    uExt: { value: ext },
  };
  const vert = /* glsl */ `
    #include <fog_pars_vertex>
    uniform float uTime; uniform sampler2D uNear; uniform float uExt; uniform float uLift;
    varying vec3 vW; varying float vNear; varying float vBig;
    ${NOISE}
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vec2 uv = (wp.xz + uExt) / (2.0 * uExt);
      float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
      float nr = texture2D(uNear, clamp(uv, 0.0, 1.0)).r * inside;
      vec2 q = wp.xz * 0.011 + vec2(uTime * 0.0045, uTime * 0.0019);
      float bg = vnoise(q) * 0.62 + vnoise(q * 2.3 + 5.1) * 0.38;
      wp.y += ((bg - 0.5) * 7.0 + nr * 3.2) * uLift;
      vW = wp.xyz; vNear = nr; vBig = bg;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`;
  const sea = new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      ...common,
      uLift: { value: 1 },
      uHi: { value: new THREE.Color(0xfdf8f0) },
      uMid: { value: new THREE.Color(0xf0eaf0) },
      uLo: { value: new THREE.Color(0xd0c9e6) },
      uSun: { value: new THREE.Color(0xffd79a) },
      uSunXZ: { value: sun2 },
    },
    vertexShader: vert,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uHi; uniform vec3 uMid; uniform vec3 uLo; uniform vec3 uSun; uniform vec2 uSunXZ;
      varying vec3 vW; varying float vNear; varying float vBig;
      ${NOISE}
      void main() {
        vec2 d = vec2(uTime * 0.011, uTime * 0.005);
        float n = fbm3(vW.xz * 0.028 + d);
        float n2 = fbm3((vW.xz + uSunXZ * 3.5) * 0.028 + d);
        float puff = vBig * 0.55 + n * 0.45 + vNear * 0.16;
        float k1 = smoothstep(0.3, 0.48, puff);
        float k2 = smoothstep(0.48, 0.64, puff);
        vec3 c = mix(uLo, uMid, k1);
        c = mix(c, uHi, k2);
        float lit = clamp((n - n2) * 8.0, -1.0, 1.0);
        c += uSun * max(lit, 0.0) * 0.2 * (0.3 + k2);
        c -= vec3(0.06, 0.06, 0.02) * max(-lit, 0.0) * (1.0 - k2 * 0.5);
        // Kept below the bloom threshold so the lit faces of the cloud tops do not turn into individual sparkles
        c = min(c, vec3(0.94));
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
  const seaMesh = new THREE.Mesh(polarGrid(1500, 160, 84, 2.1), sea);
  seaMesh.position.y = CLOUD_Y;
  seaMesh.frustumCulled = false;
  ctx.group.add(seaMesh);

  const mist = new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      ...common,
      uLift: { value: 0.4 },
      uCol: { value: new THREE.Color(0xfffaf2) },
    },
    vertexShader: vert,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uCol;
      varying vec3 vW; varying float vNear; varying float vBig;
      ${NOISE}
      void main() {
        float n = fbm3(vW.xz * 0.02 + vec2(uTime * 0.016, -uTime * 0.009));
        float m = vnoise(vW.xz * 0.05 - vec2(uTime * 0.03, uTime * 0.017));
        float a = smoothstep(0.52, 0.78, n * 0.8 + m * 0.2) * (0.12 + vNear * 0.7) * (1.0 - smoothstep(170.0, 330.0, length(vW.xz)));
        gl_FragColor = vec4(uCol, a * 0.85);
        #include <fog_fragment>
      }`,
  });
  const mistMesh = new THREE.Mesh(polarGrid(340, 120, 44, 1.6), mist);
  mistMesh.position.y = CLOUD_Y + 5.5;
  mistMesh.renderOrder = 3;
  mistMesh.frustumCulled = false;
  ctx.group.add(mistMesh);
  ctx.disposers.push(() => {
    sea.dispose();
    mist.dispose();
    near.dispose();
  });
  ctx.extras.push((_dt, t) => {
    sea.uniforms.uTime.value = t;
    mist.uniforms.uTime.value = t;
  });
}

/** A cumulus cloud: a few flattened polyhedral balls (toon shaded, no outline) */
export function cloudPuff(b: PropBatch, x: number, y: number, z: number, s: number, r: () => number, n = 4, detail = 1): void {
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = i === 0 ? 0 : s * (0.5 + r() * 0.5);
    const rr = s * (i === 0 ? 1 : 0.55 + r() * 0.4);
    const g = new THREE.IcosahedronGeometry(1, detail);
    b.add(g, i % 3 === 2 ? C.cloudShade : C.cloud, MS(x + Math.cos(a) * d, y + rr * 0.15 + (i === 0 ? 0 : r() * s * 0.25), z + Math.sin(a) * d, rr * (1 + r() * 0.3), rr * 0.62, rr * (1 + r() * 0.3), r() * 6), false);
  }
}

/** Distant cumulus tower: a cluster of piled-up cloud puffs */
export function cumulus(b: PropBatch, x: number, z: number, s: number, h: number, r: () => number): void {
  const n = 7 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const a = r() * Math.PI * 2;
    const d = s * (1 - t) * 0.9 * r();
    const rr = s * (1.1 - t * 0.55) * (0.7 + r() * 0.4);
    const g = new THREE.IcosahedronGeometry(1, 1);
    b.add(g, i % 4 === 3 ? C.cloudShade : C.cloud, MS(x + Math.cos(a) * d, CLOUD_Y - 2 + t * h, z + Math.sin(a) * d, rr * 1.2, rr * 0.8, rr * 1.2, r() * 6), false);
  }
}

// ───────────────────────── Floating islets ─────────────────────────

export interface Islet {
  x: number;
  y: number;
  z: number;
  R: number;
  deco: 'shrine' | 'cypress' | 'arch' | 'tree' | 'bare' | 'crystal';
}

/**
 * Floating islet: grass top, rocky rim, a rock cone tapering downward (a few small cones hanging down), with a little
 * decoration on top; in three groups that bob up and down slowly together
 */
export function floatingIslets(ctx: FieldCtx, list: Islet[]): void {
  const groups = [0, 1, 2].map(() => ({ g: new THREE.Group(), b: new PropBatch() }));
  const r = ctx.r;
  list.forEach((o, i) => {
    const b = groups[i % 3].b;
    const { x, y, z, R } = o;
    b.add(new THREE.CylinderGeometry(R, R * 0.93, 0.9, 11), 0xbfd98c, M(x, y, z, r()));
    b.add(new THREE.CylinderGeometry(R * 0.96, R * 0.72, 1.8, 11), C.rock, M(x, y - 1.3, z, r()));
    const cone = new THREE.ConeGeometry(R * 0.74, R * 1.9, 9);
    cone.rotateX(Math.PI);
    b.add(cone, C.rock2, M(x, y - 2.2 - R * 0.95, z, r()));
    for (let k = 0; k < 3; k++) {
      const a = r() * Math.PI * 2;
      const rr = R * (0.25 + r() * 0.2);
      const c2 = new THREE.ConeGeometry(rr, rr * 3, 6);
      c2.rotateX(Math.PI);
      b.add(c2, k % 2 ? C.rock : C.rock2, M(x + Math.cos(a) * R * 0.55, y - 2 - rr * 1.5, z + Math.sin(a) * R * 0.55, r()));
    }
    if (o.deco === 'shrine') {
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        b.add(new THREE.CylinderGeometry(0.18, 0.2, 2.4, 6), C.wall, M(x + Math.cos(a) * 1.1, y + 1.65, z + Math.sin(a) * 1.1));
      }
      b.add(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 10), C.stoneDark, M(x, y + 2.95, z));
      b.add(new THREE.SphereGeometry(1.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.gold, M(x, y + 3.05, z));
      b.glow(new THREE.OctahedronGeometry(0.3), C.glow, M(x, y + 1.6, z));
    } else if (o.deco === 'cypress') {
      for (let k = 0; k < 3; k++) {
        const a = r() * Math.PI * 2;
        const d = R * 0.45 * r();
        const h = 3 + r() * 2.5;
        const g = new THREE.SphereGeometry(1, 7, 8);
        g.scale(0.6, h / 2, 0.6);
        b.add(g, C.cypress, M(x + Math.cos(a) * d, y + 0.4 + h / 2, z + Math.sin(a) * d));
      }
    } else if (o.deco === 'arch') {
      for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.8, 4.2, 0.8), C.wall, M(x + s * 1.6, y + 2.5, z));
      b.add(new THREE.TorusGeometry(1.6, 0.35, 5, 12, Math.PI), C.wall, M(x, y + 4.6, z));
      b.add(new THREE.BoxGeometry(1.2, 0.8, 0.8), C.stone, M(x + 0.9, y + 0.6, z + 1.2, 0.4));
    } else if (o.deco === 'tree') {
      b.add(new THREE.CylinderGeometry(0.2, 0.3, 2.4, 6), C.trunk, M(x, y + 1.6, z));
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + r();
        const g = new THREE.IcosahedronGeometry(1.3, 1);
        b.add(g, C.blossom[k % 3], M(x + Math.cos(a) * (k ? 0.9 : 0), y + 3.4 + (k ? 0 : 0.6), z + Math.sin(a) * (k ? 0.9 : 0)));
      }
    } else if (o.deco === 'crystal') {
      for (let k = 0; k < 3; k++) {
        const g = new THREE.OctahedronGeometry(0.5);
        g.scale(0.7, 2.6, 0.7);
        b.glow(g, C.glow, M(x + (r() - 0.5) * R * 0.6, y + 1.6, z + (r() - 0.5) * R * 0.6, r() * 6, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
      }
    }
  });
  for (const { g, b } of groups) {
    b.build(g);
    ctx.group.add(g);
  }
  ctx.extras.push((_dt, t) => {
    groups.forEach(({ g }, i) => {
      g.position.y = Math.sin(t * 0.35 + i * 2.1) * 0.9;
      g.position.x = Math.sin(t * 0.13 + i) * 0.4;
    });
  });
}

// ───────────────────────── Pillars of light ─────────────────────────

export interface Beam {
  x: number;
  z: number;
  /** Base radius */
  r: number;
  /** Base height (usually the ground) */
  y: number;
}

/**
 * Descending pillar of light: three concentric column shells (edges fade with view angle, fade out top and
 * bottom, sway slowly) + a glow where it lands
 */
export function lightBeams(ctx: FieldCtx, beams: Beam[], H = 85): void {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.86, 0.52) } },
    vertexShader: /* glsl */ `
      attribute float aPhase; attribute float aLayer; attribute float aY0;
      uniform float uTime;
      varying float vY; varying vec3 vN; varying vec3 vV; varying float vLayer; varying vec2 vUv;
      void main() {
        vec3 p = position;
        float k = (p.y - aY0) / ${H.toFixed(1)};
        p.x += sin(uTime * 0.23 + aPhase) * 4.0 * k * k;
        p.z += cos(uTime * 0.19 + aPhase * 1.3) * 3.0 * k * k;
        vY = p.y - aY0; vN = normal; vLayer = aLayer; vUv = uv;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vV = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime;
      varying float vY; varying vec3 vN; varying vec3 vV; varying float vLayer; varying vec2 vUv;
      void main() {
        vec3 n = normalize(vN + vec3(1e-5));
        float edge = abs(dot(n, normalize(vV + vec3(1e-5))));
        float soft = pow(edge, 1.7);
        float vert = smoothstep(0.0, 4.0, vY) * (1.0 - smoothstep(20.0, ${H.toFixed(1)}, vY));
        float pulse = 0.8 + 0.2 * sin(uTime * 0.6 + vLayer * 2.0 + vUv.x * 6.2831);
        float w = vLayer < 0.5 ? 0.34 : (vLayer < 1.5 ? 0.16 : 0.07);
        float a = soft * vert * pulse * w;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
  const geos: THREE.BufferGeometry[] = [];
  beams.forEach((bm, i) => {
    [0.45, 0.8, 1.35].forEach((k, layer) => {
      const g = new THREE.CylinderGeometry(bm.r * k * 0.75, bm.r * k, H, 22, 1, true);
      g.translate(bm.x, bm.y + H / 2, bm.z);
      const n = g.attributes.position.count;
      g.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(n).fill(i * 1.9), 1));
      g.setAttribute('aLayer', new THREE.BufferAttribute(new Float32Array(n).fill(layer), 1));
      g.setAttribute('aY0', new THREE.BufferAttribute(new Float32Array(n).fill(bm.y), 1));
      geos.push(g.toNonIndexed());
      g.dispose();
    });
  });
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  if (merged) {
    const mesh = new THREE.Mesh(merged, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;
    ctx.group.add(mesh);
  }
  ctx.disposers.push(() => mat.dispose());
  ctx.extras.push((_dt, t) => (mat.uniforms.uTime.value = t));
  // Glow where it lands (hugging the terrain)
  const tex = softDiscTex();
  const disc = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0xffd98a).multiplyScalar(0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  for (const bm of beams) {
    const R = bm.r * 2.6;
    const g = new THREE.PlaneGeometry(R * 2, R * 2, 8, 8);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, ctx.h(bm.x + p.getX(i), bm.z + p.getZ(i)) + 0.08);
    const m = new THREE.Mesh(g, disc);
    m.position.set(bm.x, 0, bm.z);
    m.renderOrder = 2;
    ctx.group.add(m);
  }
  ctx.disposers.push(() => {
    disc.dispose();
    tex.dispose();
  });
}

// ───────────────────────── White doves ─────────────────────────

export interface Flock {
  c: THREE.Vector3;
  r: number;
  n: number;
  speed: number;
}

/**
 * White dove: all the birds merged into one mesh, with position and wing flapping computed in the vertex
 * shader (each flock circles its own center)
 */
export function doves(ctx: FieldCtx, flocks: Flock[]): void {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aBird; attribute float aWing; attribute vec4 aC; attribute float aSpeed;
      uniform float uTime;
      varying float vShade;
      void main() {
        float a = uTime * aSpeed + aBird * 0.55;
        float rad = aC.w + sin(aBird * 3.1) * aC.w * 0.18;
        vec3 c = aC.xyz + vec3(cos(a) * rad, sin(uTime * 1.1 + aBird * 2.0) * 0.8 + sin(aBird * 1.7) * 2.0, sin(a) * rad);
        float dir = sign(aSpeed);
        vec3 fwd = vec3(-sin(a), 0.0, cos(a)) * dir;
        vec3 right = vec3(cos(a), 0.0, sin(a)) * dir;
        vec3 p = position;
        float flap = sin(uTime * 9.0 + aBird * 1.9);
        if (aWing != 0.0) p.y += abs(p.x) * flap * 0.9;
        vec3 wp = c + right * p.x + vec3(0.0, p.y, 0.0) + fwd * p.z;
        vShade = aWing == 0.0 ? 1.0 : 0.8 + 0.2 * flap;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      varying float vShade;
      void main() {
        gl_FragColor = vec4(vec3(0.99, 0.97, 0.93) * vShade, 1.0);
        #include <fog_fragment>
      }`,
  });
  const pos: number[] = [];
  const bird: number[] = [];
  const wing: number[] = [];
  const cen: number[] = [];
  const spd: number[] = [];
  let id = 0;
  for (const f of flocks) {
    for (let i = 0; i < f.n; i++, id++) {
      const s = (0.9 + (i % 3) * 0.1) * 1.3;
      const tri = (a: number[], b: number[], c: number[], w: number) => {
        pos.push(...a.map((v) => v * s), ...b.map((v) => v * s), ...c.map((v) => v * s));
        for (let k = 0; k < 3; k++) {
          bird.push(id);
          wing.push(w);
          cen.push(f.c.x, f.c.y, f.c.z, f.r);
          spd.push(f.speed);
        }
      };
      tri([0, 0, 0.32], [-0.08, 0.06, -0.12], [0.08, 0.06, -0.12], 0);
      tri([0, 0, 0.32], [0.08, -0.04, -0.12], [-0.08, -0.04, -0.12], 0);
      tri([-0.05, 0.03, 0.1], [-0.72, 0.04, -0.16], [-0.05, 0.03, -0.12], -1);
      tri([0.05, 0.03, 0.1], [0.05, 0.03, -0.12], [0.72, 0.04, -0.16], 1);
      tri([0, 0.02, -0.12], [-0.1, 0.02, -0.3], [0.1, 0.02, -0.3], 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aBird', new THREE.Float32BufferAttribute(bird, 1));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
  g.setAttribute('aC', new THREE.Float32BufferAttribute(cen, 4));
  g.setAttribute('aSpeed', new THREE.Float32BufferAttribute(spd, 1));
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  ctx.group.add(mesh);
  ctx.disposers.push(() => mat.dispose());
  ctx.extras.push((_dt, t) => (mat.uniforms.uTime.value = t));
}

// ───────────────────────── Flags ─────────────────────────

/**
 * Long flags in the wind: collected and merged into one mesh, with the sway computed in the vertex shader;
 * style 0 white with gold trim, 1 blue with gold trim
 */
export class Banners {
  private geos: THREE.BufferGeometry[] = [];
  /** The flag's top edge center is at (x, y, z), facing direction ry (the flag face's normal), width w, length h */
  add(x: number, y: number, z: number, ry: number, w: number, h: number, style: 0 | 1): void {
    const g = new THREE.PlaneGeometry(w, h, 1, 8);
    g.translate(0, -h / 2, 0);
    g.applyMatrix4(M(x, y, z, ry));
    const n = g.attributes.position.count;
    const nrm = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
    const aN = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) aN.set([nrm.x, nrm.y, nrm.z], i * 3);
    g.setAttribute('aN', new THREE.BufferAttribute(aN, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(n).fill(x * 0.37 + z * 0.61), 1));
    g.setAttribute('aStyle', new THREE.BufferAttribute(new Float32Array(n).fill(style), 1));
    g.setAttribute('aAspect', new THREE.BufferAttribute(new Float32Array(n).fill(w / h), 1));
    this.geos.push(g.toNonIndexed());
    g.dispose();
  }
  build(ctx: FieldCtx): void {
    if (!this.geos.length) return;
    const merged = mergeGeometries(this.geos);
    for (const g of this.geos) g.dispose();
    const mat = new THREE.ShaderMaterial({
      fog: true,
      side: THREE.DoubleSide,
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        attribute vec3 aN; attribute float aPhase; attribute float aStyle; attribute float aAspect;
        uniform float uTime;
        varying vec2 vUv; varying float vStyle; varying float vFold; varying float vAspect;
        void main() {
          vec3 p = position;
          float hang = 1.0 - uv.y;
          float wave = sin(uTime * 2.3 + aPhase + hang * 4.2) * 0.5 + sin(uTime * 3.7 + aPhase * 1.7 + uv.x * 3.0) * 0.18;
          p += aN * wave * hang * 0.42;
          vUv = uv; vStyle = aStyle; vFold = wave; vAspect = aAspect;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        varying vec2 vUv; varying float vStyle; varying float vFold; varying float vAspect;
        void main() {
          // Swallowtail: a V is cut from the center of the lower edge
          if (vUv.y < 0.13 - abs(vUv.x - 0.5) * 0.26) discard;
          vec3 base = vStyle < 0.5 ? vec3(0.95, 0.93, 0.88) : vec3(0.42, 0.52, 0.8);
          vec3 gold = vec3(0.92, 0.72, 0.3);
          float trim = step(vUv.x, 0.07) + step(0.93, vUv.x) + step(vUv.y, 0.16 - abs(vUv.x - 0.5) * 0.26) + step(0.95, vUv.y);
          vec2 e = vec2((vUv.x - 0.5) * vAspect, vUv.y - 0.64);
          float r = length(e);
          float emblem = step(r, 0.1) + step(abs(r - 0.15), 0.018);
          vec3 c = mix(base, gold, clamp(trim + emblem, 0.0, 1.0));
          c *= 0.88 + vFold * 0.14;
          gl_FragColor = vec4(c, 1.0);
          #include <fog_fragment>
        }`,
    });
    if (merged) {
      const mesh = new THREE.Mesh(merged, mat);
      mesh.frustumCulled = false;
      ctx.group.add(mesh);
    }
    ctx.disposers.push(() => mat.dispose());
    ctx.extras.push((_dt, t) => (mat.uniforms.uTime.value = t));
  }
}

// ───────────────────────── Water ─────────────────────────

/** Water surface of fountains and channels: pale blue, with moving glints */
export function waterMaterial(ctx: FieldCtx): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; varying vec3 vW;
      ${NOISE}
      void main() {
        float n = vnoise(vW.xz * 1.3 + vec2(uTime * 0.5, uTime * 0.3)) * vnoise(vW.xz * 2.1 - vec2(uTime * 0.4, -uTime * 0.35));
        vec3 c = mix(vec3(0.5, 0.76, 0.9), vec3(0.72, 0.9, 0.98), smoothstep(0.08, 0.4, n));
        c += smoothstep(0.42, 0.62, n) * 0.4;
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
  ctx.disposers.push(() => mat.dispose());
  ctx.extras.push((_dt, t) => (mat.uniforms.uTime.value = t));
  return mat;
}

/** Falling curtain of water (a cylindrical shell, with bright streaks flowing down) */
export function fallMaterial(ctx: FieldCtx): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      ${NOISE}
      void main() {
        float s = vnoise(vec2(vUv.x * 40.0, vUv.y * 3.0 + uTime * 2.4));
        float a = (0.35 + smoothstep(0.5, 0.9, s) * 0.5) * smoothstep(0.0, 0.15, vUv.y);
        gl_FragColor = vec4(mix(vec3(0.7, 0.88, 0.98), vec3(1.0), smoothstep(0.6, 0.9, s)), a);
      }`,
  });
  ctx.disposers.push(() => mat.dispose());
  ctx.extras.push((_dt, t) => (mat.uniforms.uTime.value = t));
  return mat;
}

// ───────────────────────── Purification barrier ─────────────────────────

/**
 * The barrier the Church puts around the Seal Tower: a translucent golden wall of light (diamond lattice pattern, bands of
 * light sweeping upward), with a ring of light on the ground
 */
export function barrier(ctx: FieldCtx, x: number, z: number, R: number, H: number): void {
  const y = ctx.h(x, z);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(1.0, 0.8, 0.4) } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uCol; varying vec2 vUv;
      void main() {
        float y = vUv.y;
        float u = vUv.x * 120.0;
        float v = y * ${(H / 1.2).toFixed(1)};
        float l1 = abs(fract((u + v) * 0.5 + uTime * 0.05) - 0.5);
        float l2 = abs(fract((u - v) * 0.5 - uTime * 0.05) - 0.5);
        float lat = smoothstep(0.43, 0.5, max(l1, l2));
        float scan = smoothstep(0.85, 1.0, sin(y * 9.0 - uTime * 1.3) * 0.5 + 0.5);
        float fade = smoothstep(0.0, 0.03, y) * (1.0 - smoothstep(0.15, 1.0, y));
        float base = (1.0 - smoothstep(0.0, 0.12, y)) * 0.35;
        float a = fade * (0.05 + lat * 0.22 + scan * 0.16) + base;
        gl_FragColor = vec4(uCol * a, a);
      }`,
  });
  const g = new THREE.CylinderGeometry(R, R, H, 96, 1, true);
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.set(x, y + H / 2 - 0.2, z);
  mesh.renderOrder = 5;
  ctx.group.add(mesh);
  ctx.disposers.push(() => mat.dispose());
  ctx.extras.push((_dt, t) => (mat.uniforms.uTime.value = t));
}

// ───────────────────────── Ground mosaics ─────────────────────────

/**
 * Mosaic pattern on a flat plaza (a transparent texture that draws only the joints and gold lines, so
 * the ground color underneath shows through).
 * draw paints on a px×px canvas whose center is aligned to (x, z), with a side length corresponding to 2R meters.
 */
export function floorDecal(ctx: FieldCtx, x: number, z: number, R: number, px: number, draw: (g: CanvasRenderingContext2D, s: number) => void): void {
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const g = cv.getContext('2d')!;
  draw(g, px);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const geo = new THREE.PlaneGeometry(R * 2, R * 2, 12, 12);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, ctx.h(x + p.getX(i), z + p.getZ(i)) + 0.035);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 0, z);
  mesh.renderOrder = 1;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    mat.dispose();
    tex.dispose();
  });
}

const JOINT = 'rgba(120,104,80,0.55)';
const GOLD = 'rgba(226,180,74,0.95)';
const GOLD2 = 'rgba(240,206,120,0.85)';

/** Sun mosaic: a gold sun in the center, radiating gold rays, concentric rings and radial joints */
export function sunMosaic(ctx: FieldCtx, x: number, z: number, R: number, rays: number): void {
  floorDecal(ctx, x, z, R, 1024, (g, s) => {
    const c = s / 2;
    const k = s / 2 / R;
    g.lineCap = 'round';
    // Concentric ring joints and the radial joints of each ring (flagstones)
    const rings = [1.6, 2.6, R * 0.35, R * 0.5, R * 0.64, R * 0.8, R * 0.93];
    g.strokeStyle = JOINT;
    g.lineWidth = 3;
    for (const rr of rings) {
      g.beginPath();
      g.arc(c, c, rr * k, 0, Math.PI * 2);
      g.stroke();
    }
    for (let i = 1; i < rings.length; i++) {
      const n = Math.round((rings[i] * Math.PI * 2) / 1.6);
      for (let j = 0; j < n; j++) {
        const a = ((j + (i % 2) * 0.5) / n) * Math.PI * 2;
        g.beginPath();
        g.moveTo(c + Math.cos(a) * rings[i - 1] * k, c + Math.sin(a) * rings[i - 1] * k);
        g.lineTo(c + Math.cos(a) * rings[i] * k, c + Math.sin(a) * rings[i] * k);
        g.stroke();
      }
    }
    // Gold rays: long thin triangles, alternating long and short
    g.fillStyle = GOLD2;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      const len = (i % 2 ? R * 0.62 : R * 0.9) * k;
      const w = (i % 2 ? 0.05 : 0.07) * Math.PI;
      g.beginPath();
      g.moveTo(c + Math.cos(a - w) * 2.8 * k, c + Math.sin(a - w) * 2.8 * k);
      g.lineTo(c + Math.cos(a) * len, c + Math.sin(a) * len);
      g.lineTo(c + Math.cos(a + w) * 2.8 * k, c + Math.sin(a + w) * 2.8 * k);
      g.closePath();
      g.fill();
    }
    // Central sun and the outer gold ring
    g.strokeStyle = GOLD;
    g.lineWidth = 0.28 * k;
    g.beginPath();
    g.arc(c, c, 2.6 * k, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 0.22 * k;
    g.beginPath();
    g.arc(c, c, R * 0.97 * k, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(232,196,106,0.55)';
    g.beginPath();
    g.arc(c, c, 2.2 * k, 0, Math.PI * 2);
    g.fill();
  });
}

/** Outer City plaza: concentric rings of flagstones, gold arrow patterns in the four directions */
export function ringMosaic(ctx: FieldCtx, x: number, z: number, r0: number, R: number): void {
  floorDecal(ctx, x, z, R, 1024, (g, s) => {
    const c = s / 2;
    const k = s / 2 / R;
    g.strokeStyle = JOINT;
    g.lineWidth = 3;
    const rings: number[] = [];
    for (let rr = r0; rr <= R * 0.96; rr += 1.3) rings.push(rr);
    for (const rr of rings) {
      g.beginPath();
      g.arc(c, c, rr * k, 0, Math.PI * 2);
      g.stroke();
    }
    for (let i = 1; i < rings.length; i++) {
      const n = Math.round((rings[i] * Math.PI * 2) / 1.8);
      for (let j = 0; j < n; j++) {
        const a = ((j + (i % 2) * 0.5) / n) * Math.PI * 2;
        g.beginPath();
        g.moveTo(c + Math.cos(a) * rings[i - 1] * k, c + Math.sin(a) * rings[i - 1] * k);
        g.lineTo(c + Math.cos(a) * rings[i] * k, c + Math.sin(a) * rings[i] * k);
        g.stroke();
      }
    }
    g.strokeStyle = GOLD;
    g.lineWidth = 0.2 * k;
    for (const rr of [r0 + 0.4, R * 0.9]) {
      g.beginPath();
      g.arc(c, c, rr * k, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = GOLD2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const a0 = (r0 + 0.9) * k;
      const a1 = R * 0.82 * k;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * a1, c + Math.sin(a) * a1);
      g.lineTo(c + Math.cos(a + 0.05) * a0, c + Math.sin(a + 0.05) * a0);
      g.lineTo(c + Math.cos(a - 0.05) * a0, c + Math.sin(a - 0.05) * a0);
      g.closePath();
      g.fill();
    }
  });
}

/**
 * Flagstone paving laid along a polyline (a transparent texture that draws only the joints, the curb
 * and gold lines, repeated along the road).
 * The road mesh has a segment every 0.8 meters and follows the ground's undulation; w is the road width.
 */
export function pavedRibbon(ctx: FieldCtx, runs: [number, number][][], w: number): void {
  const px = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  const g = cv.getContext('2d')!;
  const k = px / w;
  const rows = 4;
  const rl = w / rows;
  const kerb = 0.34;
  const cols = 3;
  const cw = (w - kerb * 2) / cols;
  // Flagstones: each a slightly different shade, every other row offset by half a stone
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? cw / 2 : 0;
    for (let c = -1; c <= cols; c++) {
      const x0 = kerb + c * cw + off;
      const x1 = x0 + cw;
      const a = Math.max(kerb, x0);
      const b = Math.min(w - kerb, x1);
      if (b <= a) continue;
      g.fillStyle = `rgba(150,128,96,${(0.04 + rnd() * 0.12).toFixed(3)})`;
      g.fillRect(a * k, r * rl * k, (b - a) * k, rl * k);
      g.strokeStyle = JOINT;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(a * k, r * rl * k);
      g.lineTo(b * k, r * rl * k);
      if (x1 < w - kerb) {
        g.moveTo(x1 * k, r * rl * k);
        g.lineTo(x1 * k, (r + 1) * rl * k);
      }
      g.stroke();
    }
  }
  // Curb stones and the gold line on the inner side
  g.fillStyle = 'rgba(176,160,128,0.55)';
  g.fillRect(0, 0, kerb * k, px);
  g.fillRect(px - kerb * k, 0, kerb * k, px);
  g.strokeStyle = JOINT;
  g.lineWidth = 2;
  for (let r = 0; r < rows * 2; r++) {
    g.beginPath();
    g.moveTo(0, (r * rl * k) / 2);
    g.lineTo(kerb * k, (r * rl * k) / 2);
    g.moveTo(px - kerb * k, (r * rl * k) / 2);
    g.lineTo(px, (r * rl * k) / 2);
    g.stroke();
  }
  g.fillStyle = GOLD;
  g.fillRect(kerb * k + 1, 0, 0.07 * k, px);
  g.fillRect(px - kerb * k - 1 - 0.07 * k, 0, 0.07 * k, px);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const geos: THREE.BufferGeometry[] = [];
  const across = 5;
  for (const pts of runs) {
    // Take a point every 0.8 meters along the polyline (at corners the direction is the average of before and after)
    const samp: { x: number; z: number; tx: number; tz: number; d: number }[] = [];
    let dist = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(L / 0.8));
      for (let j = i === 0 ? 0 : 1; j <= n; j++) {
        const t = j / n;
        samp.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, tx: (bx - ax) / L, tz: (bz - az) / L, d: dist + L * t });
      }
      dist += L;
    }
    for (let i = 1; i < samp.length - 1; i++) {
      const p = samp[i - 1];
      const q = samp[i + 1];
      const l = Math.hypot(q.x - p.x, q.z - p.z) || 1;
      samp[i].tx = (q.x - p.x) / l;
      samp[i].tz = (q.z - p.z) / l;
    }
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    samp.forEach((s, i) => {
      for (let a = 0; a < across; a++) {
        const u = a / (across - 1);
        const o = (u - 0.5) * w;
        const x = s.x - s.tz * o;
        const z = s.z + s.tx * o;
        pos.push(x, ctx.h(x, z) + 0.05, z);
        uv.push(u, s.d / w);
        if (i > 0 && a > 0) {
          const c = i * across + a;
          idx.push(c - across - 1, c, c - 1, c - across - 1, c - across, c);
        }
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geos.push(geo);
  }
  const merged = mergeGeometries(geos);
  geos.forEach((q) => q.dispose());
  const mesh = new THREE.Mesh(merged, mat);
  mesh.renderOrder = 1;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    mat.dispose();
    tex.dispose();
    merged.dispose();
  });
}
