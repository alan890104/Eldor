// Thunderplain (thunder): the camp of nomadic tribes that follow the thunderclouds on their migration; all around is a night prairie rippling in the wind, a forest of lightning-rod stone pillars the dwarves raised,
// lightning flashes now and then in the low, churning thunderclouds, and the distant lightning is frequent but not harsh.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, MS, type ArenaCtx, type PropBatch, type RegionModule } from '../arenaKit.ts';
import { LIGHT } from '../toon.ts';

// The field's fixed colors
const C = {
  stone: 0x5e6282,
  stoneDark: 0x454a68,
  stoneFar: 0x2a2c4a,
  bronze: 0xc98f4a,
  spark: 0xffe25a,
  scorch: 0x15132a,
  trample: 0x2c4634,
  felt: 0xd6c19c,
  roof: 0x3c4a8c,
  totem: 0xb8433a,
  gold: 0xe6b64e,
  wood: 0x5a3c28,
  door: 0x241f36,
  lamp: 0xffb35c,
  rug: 0x9a3b3a,
  hill: 0x1f2242,
  banner: 0x2f3c82,
};

/** Top position of one lightning-rod stone pillar (lightning strikes land here) */
type RodTip = { x: number; y: number; z: number };

/** A grass blade in three tapering segments, curving slightly forward; aH is the height fraction (the wind's sway grows with the square of height) */
function bladeGeometry(): THREE.BufferGeometry {
  const levels: [number, number][] = [
    [0.055, 0],
    [0.05, 0.36],
    [0.03, 0.7],
    [0, 1],
  ];
  const pos: number[] = [];
  const h: number[] = [];
  for (const [w, y] of levels) {
    const bend = y * y * 0.18;
    if (w === 0) {
      pos.push(0, y, bend);
      h.push(y);
    } else {
      pos.push(-w, y, bend, w, y, bend);
      h.push(y, y);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(h, 1));
  g.setIndex([0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6]);
  return g;
}

/** Prairie: an instanced mesh of several thousand grass blades, with the vertex shader blowing wind, sweeping gusts, lighting up from lightning, and glowing warm near the campfire */
function buildGrass({ group, r, disposers }: ArenaCtx, fire: THREE.Vector3): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    side: THREE.DoubleSide,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uFire: { value: fire },
      uFireAmt: { value: 1 },
      uBase: { value: new THREE.Color(0x1c3226) },
      uTip: { value: new THREE.Color(0x5f8f50) },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aH;
      uniform float uTime;
      uniform vec3 uFire;
      varying float vH;
      varying vec3 vCol;
      varying float vFire;
      void main() {
        #ifdef USE_INSTANCING
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          vec4 wp = modelMatrix * vec4(position, 1.0);
        #endif
        float h = aH * aH;
        float w1 = sin(uTime * 1.7 + wp.x * 0.35 + wp.z * 0.21);
        float w2 = sin(uTime * 2.9 - wp.z * 0.5 + wp.x * 0.13) * 0.5;
        // Gusts: waves sweeping across the grassland one after another
        float gust = smoothstep(0.55, 1.0, sin(uTime * 0.45 + wp.x * 0.09 - wp.z * 0.06)) * 0.6;
        float sway = (w1 + w2) * (0.16 + gust * 0.3) + gust * 0.35;
        wp.x += sway * h;
        wp.z += sway * h * 0.45;
        wp.y -= abs(sway) * h * 0.25;
        vH = aH;
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(1.0);
        #endif
        vec2 df = wp.xz - uFire.xz;
        vFire = 1.0 / (1.0 + dot(df, df) * 0.09);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uBase;
      uniform vec3 uTip;
      uniform float uFlash;
      uniform float uFireAmt;
      varying float vH;
      varying vec3 vCol;
      varying float vFire;
      void main() {
        vec3 c = mix(uBase, uTip, smoothstep(0.08, 0.95, vH)) * vCol;
        c += vec3(0.7, 0.72, 1.0) * uFlash * (0.35 + 0.65 * vH);
        c += vec3(1.0, 0.5, 0.18) * vFire * uFireAmt * (0.4 + 0.6 * vH);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
  disposers.push(() => mat.dispose());
  const N = 4400;
  const mesh = new THREE.InstancedMesh(bladeGeometry(), mat, N);
  mesh.frustumCulled = false;
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    // Denser the closer to the battle area; only short grass is left at the battle area's edge
    const d = 6.2 + Math.pow(r(), 1.35) * 27.8;
    const a = r() * Math.PI * 2;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const edge = THREE.MathUtils.smoothstep(d, 6.2, 9.5);
    const far = THREE.MathUtils.smoothstep(d, 16, 34);
    const s = (0.28 + r() * 0.38) * (0.4 + 0.6 * edge) * (1 + far * 0.7);
    mesh.setMatrixAt(i, MS(x, 0, z, 0.7 + r() * 0.4, s, 1, r() * Math.PI * 2));
    const k = r();
    col.setRGB(0.8 + k * 0.4, 0.85 + r() * 0.3, 0.75 + k * 0.25);
    mesh.setColorAt(i, col);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
  return mat;
}

/** Thundercloud: two layers of cloud clumps merged into one mesh; the shader does two-step shading and a slow billowing, with the internal flash decaying outward from uFlashPos */
function buildClouds({ group, r, disposers }: ArenaCtx): { mat: THREE.ShaderMaterial; centers: THREE.Vector3[]; layer: THREE.Group } {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    vertexColors: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uFlashPos: { value: new THREE.Vector3(0, 30, 0) },
      uSkyFlash: { value: 0 },
      uLightDir: LIGHT.dir,
      uCol: { value: new THREE.Color(0x5c5896) },
      uShade: { value: new THREE.Color(0x232048) },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec3 vN;
      varying vec3 vW;
      varying vec3 vC;
      varying vec3 vV;
      void main() {
        vec3 p = position + normal * (sin(uTime * 0.35 + position.x * 0.13 + position.z * 0.11) * 0.25);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vW = wp.xyz;
        vN = mat3(modelMatrix) * normal;
        vV = cameraPosition - wp.xyz;
        vC = color;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uFlash;
      uniform vec3 uFlashPos;
      uniform float uSkyFlash;
      uniform vec3 uLightDir;
      uniform vec3 uCol;
      uniform vec3 uShade;
      varying vec3 vN;
      varying vec3 vW;
      varying vec3 vC;
      varying vec3 vV;
      vec3 safeNormalize(vec3 v, vec3 fb) { float l = length(v); return l > 1e-6 ? v / l : fb; }
      void main() {
        vec3 n = safeNormalize(vN, vec3(0.0, 1.0, 0.0));
        float ndl = dot(n, normalize(uLightDir));
        float lit = smoothstep(-0.15, 0.05, ndl) * 0.6 + smoothstep(0.45, 0.6, ndl) * 0.3;
        vec3 c = mix(uShade, uCol, lit) * vC;
        // Darken the edge to act as an outline
        float fres = pow(clamp(1.0 - dot(n, safeNormalize(vV, n)), 0.0, 1.0), 2.0);
        c *= 1.0 - 0.4 * smoothstep(0.5, 0.9, fres);
        // Flashes inside the clouds
        float fl = uFlash * exp(-distance(vW, uFlashPos) / 18.0);
        c += vec3(0.8, 0.78, 1.0) * fl * 1.6;
        c += vec3(0.55, 0.55, 0.9) * uSkyFlash * 0.6;
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
  disposers.push(() => mat.dispose());
  const geos: THREE.BufferGeometry[] = [];
  const centers: THREE.Vector3[] = [];
  const tint = new THREE.Color();
  const blob = (x: number, y: number, z: number, s: number, flat: number, k: number) => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.applyMatrix4(MS(x, y, z, s * (0.85 + r() * 0.5), s * flat, s * (0.85 + r() * 0.5), r() * 6));
    tint.setScalar(k);
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) cols.set([tint.r, tint.g, tint.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geos.push(g);
  };
  // The low cloud wall in the distance (the layer the battle camera sees)
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + r() * 0.1;
    const d = 46 + r() * 40;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const s = 9 + r() * 9;
    blob(x, 5 + r() * 8, z, s, 0.42, 0.85 + r() * 0.2);
    centers.push(new THREE.Vector3(x, 10, z));
  }
  // A row of smaller cloud clumps at the front edge of the cloud wall, so the skyline is clumpy rather than a flat mountain
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + r() * 0.15;
    const d = 38 + r() * 14;
    const s = 4.5 + r() * 4;
    blob(Math.cos(a) * d, 3.5 + r() * 5, Math.sin(a) * d, s, 0.55, 0.95 + r() * 0.2);
  }
  // The churning cloud layer overhead (seen when an ultimate's camera move or the title orbit looks up)
  for (let i = 0; i < 44; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 52;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const s = 8 + r() * 8;
    blob(x, 27 + r() * 8, z, s, 0.5, 1.0 + r() * 0.15);
    centers.push(new THREE.Vector3(x, 28, z));
  }
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  const layer = new THREE.Group();
  if (merged) layer.add(new THREE.Mesh(merged, mat));
  group.add(layer);
  return { mat, centers, layer };
}

/** Camp banners: several cloths merged into one mesh, the vertex shader swaying them by aU (distance from the flagpole); the thunder-pattern emblem flutters with the cloth */
function buildBanners({ group, disposers }: ArenaCtx, spots: { x: number; z: number; y: number; w: number; h: number; ry: number; phase: number }[]): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    vertexColors: true,
    side: THREE.DoubleSide,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      attribute float aU;
      attribute vec3 aN;
      attribute float aPhase;
      uniform float uTime;
      varying vec3 vC;
      varying float vShade;
      void main() {
        float t = uTime * 3.4 + aPhase;
        float wave = sin(t - aU * 5.5) * 0.5 + sin(t * 1.7 - aU * 9.0) * 0.25;
        float amp = aU * aU * 0.28 + aU * 0.05;
        vec3 p = position + aN * wave * amp;
        p.y -= aU * aU * 0.14 * (1.0 - 0.5 * sin(t * 0.7));
        vC = color;
        vShade = 0.82 + 0.18 * sin(t - aU * 5.5 + 1.2);
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uFlash;
      varying vec3 vC;
      varying float vShade;
      void main() {
        vec3 c = vC * vShade + vec3(0.7, 0.7, 1.0) * uFlash * 0.5;
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
  disposers.push(() => mat.dispose());
  const geos: THREE.BufferGeometry[] = [];
  const Y = new THREE.Vector3(0, 1, 0);
  const cloth = new THREE.Color(C.banner);
  const mark = new THREE.Color(C.spark).multiplyScalar(1.3);
  const attach = (g: THREE.BufferGeometry, w: number, spot: (typeof spots)[number], col: THREE.Color, lift: number) => {
    const n = g.attributes.position.count;
    const u = new Float32Array(n);
    const nn = new Float32Array(n * 3);
    const ph = new Float32Array(n);
    const cc = new Float32Array(n * 3);
    const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(Y, spot.ry);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      u[i] = THREE.MathUtils.clamp(p.getX(i) / w, 0, 1);
      nn.set([normal.x, normal.y, normal.z], i * 3);
      ph[i] = spot.phase;
      cc.set([col.r, col.g, col.b], i * 3);
    }
    g.setAttribute('aU', new THREE.BufferAttribute(u, 1));
    g.setAttribute('aN', new THREE.BufferAttribute(nn, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    g.applyMatrix4(M(spot.x, spot.y, spot.z, spot.ry).multiply(new THREE.Matrix4().makeTranslation(0, 0, lift)));
    geos.push(g);
  };
  for (const s of spots) {
    // Banner cloth: x=0 is at the flagpole, extending toward +x
    const g = new THREE.PlaneGeometry(s.w, s.h, 10, 3);
    g.translate(s.w / 2, 0, 0);
    attach(g, s.w, s, cloth, 0);
    // Thunder-pattern emblem
    const shape = new THREE.Shape();
    const k = s.h * 0.42;
    shape.moveTo(0.04 * k, k);
    shape.lineTo(-0.55 * k, 0.05 * k);
    shape.lineTo(-0.05 * k, 0.05 * k);
    shape.lineTo(-0.4 * k, -k);
    shape.lineTo(0.55 * k, 0.2 * k);
    shape.lineTo(0.05 * k, 0.2 * k);
    shape.lineTo(0.35 * k, k);
    shape.closePath();
    const e = new THREE.ShapeGeometry(shape);
    e.translate(s.w * 0.45, 0, 0);
    attach(e, s.w, s, mark, 0.012);
    const e2 = new THREE.ShapeGeometry(shape);
    e2.translate(s.w * 0.45, 0, 0);
    attach(e2, s.w, s, mark, -0.012);
  }
  const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));
  for (const g of geos) g.dispose();
  if (merged) {
    for (const k of Object.keys(merged.attributes)) if (!['position', 'aU', 'aN', 'aPhase', 'color'].includes(k)) merged.deleteAttribute(k);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return mat;
}

/** Lightning-rod stone pillar: a hexagonal stone pillar carved by the dwarves, with a carved band, a copper ring on top and charged thunder patterns; scorch marks at the base from lightning strikes */
function rodPillar(b: PropBatch, x: number, z: number, h: number, ry: number, tilt: number, r: () => number, tips: RodTip[]) {
  const T = M(x, 0, z, ry, 1, tilt);
  const at = (L: THREE.Matrix4) => T.clone().multiply(L);
  const y0 = 0.62;
  // Two layers of square base, an octagonal shaft tapering upward, a recessed plate on the front carved with thunder patterns
  b.add(new THREE.BoxGeometry(1.4, 0.34, 1.4), C.stoneDark, at(M(0, 0.17, 0)));
  b.add(new THREE.BoxGeometry(1.0, 0.28, 1.0), C.stone, at(M(0, 0.48, 0)));
  b.add(new THREE.CylinderGeometry(0.28, 0.44, h, 8), C.stone, at(M(0, y0 + h / 2, 0)));
  b.add(new THREE.BoxGeometry(0.24, h * 0.5, 0.05), C.stoneDark, at(M(0, y0 + h * 0.48, 0.34, 0, 1, -0.04)));
  const broken = r() < 0.22;
  if (broken) {
    // Split-off pillar top: a ragged break, with no copper ring
    b.add(new THREE.ConeGeometry(0.34, 0.6, 5), C.stoneDark, at(M(0, y0 + h + 0.25, 0, r() * 6)));
    b.add(new THREE.BoxGeometry(0.14, h * 0.42, 0.05), C.scorch, at(M(0.1, y0 + h * 0.6, 0.37, 0, 1, 0, 0.15)));
  } else {
    b.add(new THREE.CylinderGeometry(0.32, 0.32, 0.16, 8), C.bronze, at(M(0, y0 + h - 0.12, 0)));
    b.add(new THREE.CylinderGeometry(0.1, 0.34, 0.46, 8), C.stone, at(M(0, y0 + h + 0.23, 0)));
    b.add(new THREE.TorusGeometry(0.34, 0.055, 6, 14), C.bronze, at(M(0, y0 + h + 0.56, 0, 0, 1, Math.PI / 2)));
    b.glow(new THREE.OctahedronGeometry(0.15), C.spark, at(M(0, y0 + h + 0.56, 0, 0.4)));
    tips.push({ x, y: y0 + h + 0.56, z });
    // Charged thunder patterns: four zigzag segments stuck onto the recessed plate
    for (let i = 0; i < 4; i++) {
      const y = y0 + h * (0.3 + i * 0.12);
      b.glow(new THREE.BoxGeometry(0.05, h * 0.13, 0.04), C.spark, at(M(i % 2 ? 0.06 : -0.06, y, 0.38 - i * 0.01, 0, 1, 0, i % 2 ? 0.55 : -0.55)));
    }
    // Old lightning scorch marks
    if (r() < 0.6) b.add(new THREE.BoxGeometry(0.12, h * 0.3, 0.04), C.scorch, at(M(-0.08, y0 + h * 0.75, -0.36, 0, 1, 0, -0.2)));
  }
  const g = new THREE.CircleGeometry(1.2 + r() * 0.6, 12);
  b.add(g, C.scorch, M(x + (r() - 0.5) * 0.4, 0.012, z + (r() - 0.5) * 0.4, r() * 6, 1, -Math.PI / 2), false);
}

/** Nomad tent: a felt round tent, an indigo umbrella roof, gold trim and a red totem band, with lamplight showing through the door seam */
function yurt(b: PropBatch, x: number, z: number, ry: number, s: number) {
  const T = M(x, 0, z, ry, s);
  const at = (L: THREE.Matrix4) => T.clone().multiply(L);
  b.add(new THREE.CircleGeometry(2.6, 14), C.trample, at(M(0, 0.008, 0, 0, 1, -Math.PI / 2)), false);
  b.add(new THREE.CylinderGeometry(1.5, 1.62, 1.25, 12), C.felt, at(M(0, 0.62, 0)));
  b.add(new THREE.ConeGeometry(2.05, 1.5, 12), C.roof, at(M(0, 1.99, 0)));
  b.add(new THREE.TorusGeometry(1.88, 0.09, 6, 14), C.gold, at(M(0, 1.28, 0, 0, 1, Math.PI / 2)));
  b.add(new THREE.CylinderGeometry(0.22, 0.28, 0.3, 8), C.gold, at(M(0, 2.8, 0)));
  b.add(new THREE.CylinderGeometry(0.04, 0.05, 1.2, 5), C.wood, at(M(0, 3.4, 0)));
  // Totem band: a ring of red triangles, with the tips alternating up and down
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.add(new THREE.ConeGeometry(0.15, 0.3, 3), C.totem, at(M(Math.cos(a) * 1.6, 0.95, Math.sin(a) * 1.6, -a, 1, i % 2 ? Math.PI : 0)));
  }
  // The door faces +z
  b.add(new THREE.BoxGeometry(0.8, 1.0, 0.12), C.door, at(M(0, 0.52, 1.52)));
  b.add(new THREE.BoxGeometry(1.0, 0.12, 0.16), C.wood, at(M(0, 1.06, 1.54)));
  b.glow(new THREE.BoxGeometry(0.14, 0.8, 0.06), C.lamp, at(M(0.1, 0.5, 1.56)));
  b.add(new THREE.BoxGeometry(1.3, 0.04, 0.9), C.rug, at(M(0, 0.03, 2.2, 0.1)));
  // Wooden stakes for the guy ropes
  for (let i = 0; i < 5; i++) {
    const a = 0.6 + (i / 5) * Math.PI * 2;
    b.add(new THREE.CylinderGeometry(0.04, 0.06, 0.5, 5), C.wood, at(M(Math.cos(a) * 2.5, 0.2, Math.sin(a) * 2.5, 0, 1, Math.sin(a) * 0.4, -Math.cos(a) * 0.4)));
  }
}

/** Campfire: a stone ring, a woodpile and embers (static); the flames, firelight, sparks and smoke move in extras */
function campfire(ctx: ArenaCtx, x: number, z: number): void {
  const { b, group, r, extras, disposers } = ctx;
  b.add(new THREE.CircleGeometry(1.6, 14), C.scorch, M(x, 0.01, z, 0, 1, -Math.PI / 2), false);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    b.add(new THREE.DodecahedronGeometry(0.26, 0), 0x5c586e, M(x + Math.cos(a) * 0.85, 0.16, z + Math.sin(a) * 0.85, r() * 6, 0.8 + r() * 0.4, r() * 0.5));
  }
  for (let i = 0; i < 3; i++) b.add(new THREE.CylinderGeometry(0.09, 0.12, 1.1, 5), C.wood, M(x, 0.16, z, i * 2.1, 1, 0, Math.PI / 2 - 0.25));
  b.glow(new THREE.SphereGeometry(0.36, 8, 6), 0xff7a22, MS(x, 0.14, z, 1, 0.35, 1));
  // Log seats
  for (let i = 0; i < 3; i++) {
    const a = 0.9 + i * 2.1;
    b.add(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 7), 0x6b4a30, M(x + Math.cos(a) * 2.1, 0.22, z + Math.sin(a) * 2.1, a + Math.PI / 2, 1, 0, Math.PI / 2));
  }
  const flames = new THREE.Group();
  flames.position.set(x, 0.25, z);
  const mats: THREE.MeshBasicMaterial[] = [];
  const cone = (rad: number, h: number, col: number, inten: number) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(inten), toneMapped: false });
    mats.push(m);
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 7), m);
    mesh.position.y = h / 2;
    flames.add(mesh);
    return mesh;
  };
  const f1 = cone(0.46, 1.25, 0xff5a18, 1.4);
  const f2 = cone(0.3, 0.95, 0xffa62a, 1.9);
  const f3 = cone(0.15, 0.6, 0xfff0a8, 2.4);
  group.add(flames);
  const light = new THREE.PointLight(0xff9a44, 2.8, 14, 1.6);
  light.position.set(x, 1.1, z);
  group.add(light);
  disposers.push(() => {
    for (const m of mats) m.dispose();
    light.dispose();
  });
  let sparkT = 0;
  let smokeT = 0;
  extras.push((dt, t, vfx) => {
    const n1 = Math.sin(t * 11.3) * 0.5 + Math.sin(t * 17.1 + 1.3) * 0.3 + Math.sin(t * 5.7 + 2.1) * 0.2;
    const n2 = Math.sin(t * 13.7 + 0.7) * 0.5 + Math.sin(t * 7.9 + 2.9) * 0.5;
    f1.scale.set(1 + n2 * 0.12, 0.88 + n1 * 0.22, 1 - n2 * 0.12);
    f2.scale.set(1 - n1 * 0.1, 0.9 + n2 * 0.25, 1 + n1 * 0.1);
    f3.scale.set(1, 0.85 + n1 * 0.3, 1);
    flames.rotation.y = t * 0.8;
    f1.position.x = n2 * 0.06;
    f2.position.z = n1 * 0.05;
    light.intensity = 2.6 + n1 * 0.7;
    sparkT += dt;
    while (sparkT > 0.11) {
      sparkT -= 0.11;
      vfx.emit({ pos: new THREE.Vector3(x, 0.7, z), count: 1, color: [0xffb040, 0xff7a20, 0xfff0a0], speed: [1.2, 2.8], dir: new THREE.Vector3(0.15, 1, 0), spread: 0.35, life: [0.7, 1.5], size: [0.05, 0.1], sizeEnd: 0.3, gravity: -0.6, drag: 0.6, radius: 0.25, intensity: 2 });
    }
    smokeT += dt;
    while (smokeT > 0.45) {
      smokeT -= 0.45;
      vfx.smoke({ pos: new THREE.Vector3(x, 1.4, z), count: 1, color: 0x2a2436, speed: [0.5, 0.9], dir: new THREE.Vector3(0.25, 1, 0), spread: 0.25, life: [2.2, 3.4], size: [0.35, 0.55], sizeEnd: 2.6, drag: 0.35, radius: 0.15 });
    }
  });
}

export const plains: RegionModule = {
  palette: {
    sky: ['#0b0a20', '#1f1b4c', '#5a4a90'],
    fog: 0x2c2650,
    fogNear: 24,
    fogFar: 100,
    ground: ['#3b5c46', '#2f4a38', '#e8e08a'],
    light: [0.35, 0.8, 0.4],
    ambient: 0x6c6cac,
    rim: 0xcfd8ff,
    shadow: 0x2a2a60,
    motes: [0xd8ff70, 0xfff066, 0xb0a0ff],
    moteKind: 'float',
    stars: true,
  },
  build(ctx) {
    const { b, r, ringPos, extras, skyMat } = ctx;
    const tips: RodTip[] = [];

    // Camp: three tents at the right rear of the camera ring the campfire, and one lone tent each at the left rear and behind the camera
    const fire = new THREE.Vector3(15.5, 0, -12.5);
    const tents: [number, number][] = [
      [12.2, -15.8],
      [19.6, -9.4],
      [20.2, -17.6],
      [-17.5, -19],
      [-24, 9],
    ];
    tents.forEach(([x, z], i) => yurt(b, x, z, [2.5, -1.0, 3.6, 0.3, -2.2][i]!, [1.05, 1.0, 0.9, 1.0, 0.95][i]!));
    campfire(ctx, fire.x, fire.z);
    // Pillars and stones must not grow inside the camp
    const inCamp = (x: number, z: number) => Math.hypot(x - fire.x, z - fire.z) < 7.5 || tents.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 4.2);
    // Flagpoles
    const poles = [
      { x: 10.6, z: -11.2, h: 5.2 },
      { x: 23.5, z: -13.4, h: 4.6 },
      { x: -20.5, z: -15.5, h: 4.8 },
    ];
    for (const p of poles) {
      b.add(new THREE.CylinderGeometry(0.06, 0.09, p.h, 6), C.wood, M(p.x, p.h / 2, p.z));
      b.glow(new THREE.OctahedronGeometry(0.12), C.spark, M(p.x, p.h + 0.1, p.z));
    }
    const bannerMat = buildBanners(
      ctx,
      poles.map((p, i) => ({ x: p.x, z: p.z, y: p.h - 0.85, w: 1.9, h: 1.15, ry: (i - 1) * 0.35, phase: i * 2.1 })),
    );

    // Forest of lightning-rod stone pillars: the near ones finely carved, the far ones only silhouettes with a faint glow at the top
    const placed: [number, number][] = [];
    for (let i = 0; i < 26; i++) {
      let x = 0;
      let z = 0;
      let ok = false;
      for (let tries = 0; tries < 16 && !ok; tries++) {
        [x, z] = ringPos(13, 31);
        ok = !inCamp(x, z) && !placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 3.5);
      }
      if (!ok) continue;
      placed.push([x, z]);
      rodPillar(b, x, z, 2.6 + r() * 2.8, r() * 6, (r() - 0.5) * 0.16, r, tips);
    }
    for (let i = 0; i < 90; i++) {
      const [x, z] = ringPos(33, 100, false);
      const h = 4 + r() * 6;
      b.add(new THREE.CylinderGeometry(0.45, 0.7, h, 5), C.stoneFar, M(x, h / 2, z, r() * 6, 1, (r() - 0.5) * 0.1), false);
      if (r() < 0.75) b.glow(new THREE.OctahedronGeometry(0.22), C.spark, M(x, h + 0.2, z));
    }
    // Rolling hills in the distance
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + r() * 0.3;
      const d = 62 + r() * 40;
      const g = new THREE.SphereGeometry(1, 12, 7);
      b.add(g, C.hill, MS(Math.cos(a) * d, -3, Math.sin(a) * d, 22 + r() * 26, 6 + r() * 6, 16 + r() * 18, r() * 6), false);
    }
    // Stones among the grass
    for (let i = 0; i < 16; i++) {
      const [x, z] = ringPos(8, 26);
      if (inCamp(x, z)) continue;
      b.add(new THREE.DodecahedronGeometry(0.4, 0), 0x4e5270, M(x, 0.22, z, r() * 6, 0.6 + r() * 0.9, r() * 0.6, r() * 0.6));
    }

    const grassMat = buildGrass(ctx, fire);
    const clouds = buildClouds(ctx);

    // Rhythm of the lightning: distant strikes, dull flashes inside the clouds, an occasional bolt hitting a pillar top
    let lt = 0;
    let nextBolt = 1.2;
    let nextGlow = 0.6;
    let nextStrike = 4;
    let sparkT = 0;
    let cloudFlash = 0;
    extras.push((dt, t, vfx) => {
      lt += dt;
      const flashU = skyMat.uniforms.uFlash;
      if (lt > nextBolt) {
        nextBolt = lt + 1.6 + Math.random() * 2.8;
        const a = Math.random() * Math.PI * 2;
        const d = 42 + Math.random() * 35;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        void vfx.bolt(new THREE.Vector3(x, 22 + Math.random() * 8, z), new THREE.Vector3(x + (Math.random() - 0.5) * 10, 0, z + (Math.random() - 0.5) * 10), 0xd0c0ff, 0.28, 0.32);
        flashU.value = Math.max(flashU.value, 0.26);
        clouds.mat.uniforms.uFlashPos.value.set(x, 14, z);
        cloudFlash = 1;
      }
      if (lt > nextGlow) {
        nextGlow = lt + 0.9 + Math.random() * 2.2;
        const c = clouds.centers[Math.floor(Math.random() * clouds.centers.length)]!;
        clouds.mat.uniforms.uFlashPos.value.copy(c);
        cloudFlash = 0.85;
        flashU.value = Math.max(flashU.value, 0.07);
      }
      if (lt > nextStrike && tips.length > 0) {
        nextStrike = lt + 5 + Math.random() * 7;
        const tip = tips[Math.floor(Math.random() * tips.length)]!;
        const p = new THREE.Vector3(tip.x, tip.y, tip.z);
        void vfx.bolt(new THREE.Vector3(tip.x + (Math.random() - 0.5) * 6, 26, tip.z + (Math.random() - 0.5) * 6), p, 0xe0d0ff, 0.3, 0.14);
        void vfx.ring(p, 0xfff0a0, 0.2, 1.6, 0.45);
        vfx.emit({ pos: p, count: 18, color: [0xfff066, 0xffffff, 0xc0b0ff], speed: [2, 5], life: [0.3, 0.7], size: [0.08, 0.16], gravity: 4, drag: 1.2, atlas: 1, intensity: 2.2 });
        flashU.value = Math.max(flashU.value, 0.42);
        clouds.mat.uniforms.uFlashPos.value.set(tip.x, 24, tip.z);
        cloudFlash = 1;
      }
      flashU.value = Math.max(0, flashU.value - dt * 2.2);
      cloudFlash = Math.max(0, cloudFlash - dt * 4.5);
      clouds.mat.uniforms.uFlash.value = cloudFlash;
      clouds.mat.uniforms.uSkyFlash.value = flashU.value;
      clouds.mat.uniforms.uTime.value = t;
      clouds.layer.rotation.y = t * 0.004;
      grassMat.uniforms.uTime.value = t;
      grassMat.uniforms.uFlash.value = flashU.value;
      bannerMat.uniforms.uTime.value = t;
      bannerMat.uniforms.uFlash.value = flashU.value;
      // Electric sparks in the grass
      sparkT += dt;
      while (sparkT > 0.22) {
        sparkT -= 0.22;
        const a = Math.random() * Math.PI * 2;
        const d = 7.5 + Math.random() * 20;
        vfx.emit({ pos: new THREE.Vector3(Math.cos(a) * d, 0.15 + Math.random() * 0.5, Math.sin(a) * d), count: 1, color: [0xfff066, 0xffffff], speed: [0.3, 1.2], life: [0.12, 0.28], size: [0.08, 0.18], atlas: 1, intensity: 2.4 });
      }
    });
  },
};
