// Tidesong Isles (water): a sandy island ringed by coral reefs, surrounded by sea. On the reef island off the north shore are a lighthouse and a fishing harbor, and the beach has palms, coral and shells,
// in the distance are clouds, seagulls, fishing boats going back and forth and the northern ice field. The sea surface is a custom shader (wave patterns, shore foam, shallow-water transparency, deep blue in the distance).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, PropBatch, type ArenaCtx, type RegionModule } from '../arenaKit.ts';
import { inkScenery } from '../ink.ts';
import { sceneMaterial, type SpiritMaterial } from '../spiritToon.ts';
import { glowTex } from '../textures.ts';

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

/** Align the geometry's +Y to the direction (dx,dy,dz) and put its center at (x,y,z) */
function along(x: number, y: number, z: number, dx: number, dy: number, dz: number, s = 1): THREE.Matrix4 {
  _q.setFromUnitVectors(UP, _v.set(dx, dy, dz).normalize());
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(s, s, s));
}

/** Basis matrix with yv as +Y and xv (after orthogonalizing) as +X: use it when you need to control which way a leaf is flattened */
function basisM(x: number, y: number, z: number, xv: THREE.Vector3, yv: THREE.Vector3): THREE.Matrix4 {
  const yy = yv.clone().normalize();
  const xx = xv.clone().addScaledVector(yy, -xv.dot(yy)).normalize();
  const zz = new THREE.Vector3().crossVectors(xx, yy);
  return new THREE.Matrix4().makeBasis(xx, yy, zz).setPosition(x, y, z);
}

// ───────────────────────── Vertex-color toon material ─────────────────────────
// If an animated prop (the fishing boat) were split into several meshes by color, the number of dynamic meshes would explode; writing the colors into a vertex attribute makes the whole boat one mesh.
// The material is sceneMaterial (white base color) with vertexColors on, and MeshToon's color_fragment multiplies the vertex colors in; the outline goes through post-process.

function vertexColorMaterial(): SpiritMaterial {
  const m = sceneMaterial(0xffffff);
  m.vertexColors = true;
  return m;
}

/** Vertex-colored prop batch: all parts are merged into one mesh, and the whole can sway as one object */
class ColorBatch {
  private geos: THREE.BufferGeometry[] = [];
  add(geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(m);
    const n = g.attributes.position.count;
    const c = new THREE.Color(color);
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.geos.push(g);
  }
  build(mat: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    const merged = mergeGeometries(this.geos);
    if (merged) group.add(new THREE.Mesh(merged, mat));
    inkScenery(group);
    return group;
  }
}

// ───────────────────────── Sea surface ─────────────────────────

const WATER_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vW;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const WATER_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime; uniform vec2 uBoat;
  varying vec2 vW;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    float d = length(vW);
    float a = atan(vW.y, vW.x);
    // The shoreline is not a perfect circle: several sines are layered into bays and headlands; the tide makes the shoreline advance and retreat slowly
    float shore = 15.6 + 1.3 * sin(a * 3.0 + 0.8) + 0.7 * sin(a * 7.0 + 2.1) + 0.4 * sin(a * 11.0);
    float tide = sin(uTime * 0.5) * 0.35 + 0.15 * sin(uTime * 1.6 + a * 5.0);
    float s = d - shore + tide;
    float depth = smoothstep(0.0, 8.0, s);
    vec3 c = mix(vec3(0.50, 0.93, 0.92), vec3(0.10, 0.60, 0.90), depth);
    c = mix(c, vec3(0.03, 0.25, 0.62), smoothstep(10.0, 45.0, s));
    // Bright crest lines: two layers of diagonal sines, keeping only the peaks
    float w1 = sin(vW.x * 0.55 + vW.y * 0.35 + uTime * 1.1) + sin(vW.x * 0.25 - vW.y * 0.6 - uTime * 0.8);
    float w2 = sin(vW.x * 1.2 - vW.y * 0.9 + uTime * 1.6 + noise(vW * 0.3 + uTime * 0.05) * 4.0);
    float crest = smoothstep(1.4, 1.7, w1) * 0.6 + smoothstep(0.86, 1.0, w2) * 0.4;
    c += vec3(0.55, 0.75, 0.85) * crest * (0.9 - depth * 0.5) * (1.0 - smoothstep(25.0, 70.0, s));
    // Caustic net in the shallows
    float ca = sin(vW.x * 1.7 + uTime * 0.7) * sin(vW.y * 1.5 - uTime * 0.6) + sin((vW.x + vW.y) * 1.1 + uTime * 0.4);
    c += vec3(0.7, 1.0, 1.0) * smoothstep(0.9, 1.3, ca) * 0.35 * (1.0 - depth);
    // Distant shards of sunlight
    float glit = step(0.94, hash(floor(vW * 0.8) + floor(uTime * 2.5) * 0.37));
    c += vec3(1.0, 0.98, 0.9) * glit * 0.6 * smoothstep(18.0, 30.0, s) * (1.0 - smoothstep(60.0, 90.0, s));
    // Shore foam: the main wave band hugs the shoreline with its edge broken up by noise; a second broken wave moves back and forth farther out
    float edge = s + (noise(vW * 1.4 + uTime * 0.35) - 0.5) * 1.4;
    float foam = (1.0 - smoothstep(0.0, 1.5, edge)) * smoothstep(-0.7, 0.0, edge);
    float surf = 2.6 + sin(uTime * 0.9 + a * 6.0) * 0.6;
    float foam2 = smoothstep(surf - 0.35, surf, edge) * (1.0 - smoothstep(surf, surf + 0.45, edge)) * 0.8;
    // White wake of the distant fishing boat
    float wake = 1.0 - smoothstep(1.0, 2.4, distance(vW, uBoat));
    float f = clamp(foam + foam2 + wake * 0.7, 0.0, 1.0);
    vec3 col; float alpha;
    if (s < 0.0) { col = vec3(0.60, 0.50, 0.36); alpha = smoothstep(-2.6, 0.0, s) * 0.45; }   // wet sand
    else { col = c; alpha = mix(0.6, 1.0, depth); }                                             // sand bed showing through the shallow water
    col = mix(col, vec3(1.0), f);
    alpha = max(alpha, f * 0.95);
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
  }`;

function buildWater({ group, extras, disposers }: ArenaCtx): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    transparent: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uBoat: { value: new THREE.Vector2(999, 999) } },
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
  });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(10, 186, 96, 8), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.05;
  // The sea surface must draw before the other transparent objects (light beams, particles), or it would cover them
  mesh.renderOrder = -5;
  group.add(mesh);
  disposers.push(() => mat.dispose());
  extras.push((_dt, t) => {
    mat.uniforms.uTime.value = t;
  });
  return mat;
}

// ───────────────────────── Plants and coral ─────────────────────────

/** Palm tree: a curved trunk, two drooping segments of fronds, a few coconuts */
function palm(b: PropBatch, x: number, z: number, s: number, r: () => number): void {
  const dirA = r() * Math.PI * 2;
  const bend = 0.12 + r() * 0.2;
  const cx = Math.cos(dirA);
  const cz = Math.sin(dirA);
  let px = x;
  let py = 0;
  let pz = z;
  for (let j = 0; j < 6; j++) {
    // It bends more the higher it goes, with the treetop at about 0.3 to 0.45 radians
    const tilt = bend * (j + 1) * 0.22;
    const len = 0.62 * s;
    const dx = Math.sin(tilt) * cx;
    const dy = Math.cos(tilt);
    const dz = Math.sin(tilt) * cz;
    const rad = (0.25 - j * 0.022) * s;
    b.add(new THREE.CylinderGeometry(rad * 0.88, rad, len, 7), j % 2 ? 0xa07a4c : 0x8c6840, along(px + (dx * len) / 2, py + (dy * len) / 2, pz + (dz * len) / 2, dx, dy, dz));
    px += dx * len;
    py += dy * len;
    pz += dz * len;
  }
  const n = 8 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5;
    const fx = Math.cos(a);
    const fz = Math.sin(a);
    const side = new THREE.Vector3(-fz, 0, fx);
    const col = [0x3f9e4a, 0x52b85c, 0x6ccf6e][i % 3];
    let qx = px;
    let qy = py + 0.1 * s;
    let qz = pz;
    for (let k = 0; k < 2; k++) {
      const pitch = k === 0 ? 0.45 - r() * 0.25 : -0.75 - r() * 0.35;
      const len = (k === 0 ? 1.15 : 1.0) * s;
      const dir = new THREE.Vector3(Math.cos(pitch) * fx, Math.sin(pitch), Math.cos(pitch) * fz);
      const g = new THREE.CylinderGeometry(k === 0 ? 0.3 * s : 0.02, k === 0 ? 0.14 * s : 0.3 * s, len, 4);
      g.scale(1, 1, 0.18);
      b.add(g, col, basisM(qx + (dir.x * len) / 2, qy + (dir.y * len) / 2, qz + (dir.z * len) / 2, side, dir));
      qx += dir.x * len;
      qy += dir.y * len;
      qz += dir.z * len;
    }
  }
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    b.add(new THREE.SphereGeometry(0.15 * s, 7, 5), 0x7a5a30, M(px + Math.cos(a) * 0.22 * s, py - 0.05 * s, pz + Math.sin(a) * 0.22 * s));
  }
}

/** Coral cluster: four kinds, branching, brain, fan and tube, in vivid colors */
function coral(b: PropBatch, x: number, z: number, s: number, r: () => number): void {
  const kind = Math.floor(r() * 4);
  if (kind === 0) {
    const col = r() < 0.5 ? 0xff86b8 : 0xff9a5a;
    const n = 5 + Math.floor(r() * 3);
    b.add(new THREE.CylinderGeometry(0.07 * s, 0.12 * s, 0.6 * s, 6), col, M(x, 0.3 * s, z));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r();
      const up = 0.45 + r() * 0.6;
      const dir = new THREE.Vector3(Math.cos(a) * (1 - up), up, Math.sin(a) * (1 - up)).normalize();
      const len = (0.5 + r() * 0.4) * s;
      const by = (0.35 + r() * 0.25) * s;
      b.add(new THREE.CylinderGeometry(0.04 * s, 0.07 * s, len, 5), col, along(x + (dir.x * len) / 2, by + (dir.y * len) / 2, z + (dir.z * len) / 2, dir.x, dir.y, dir.z));
      const tip = new THREE.Vector3(x + dir.x * len, by + dir.y * len, z + dir.z * len);
      const dir2 = new THREE.Vector3(dir.x + (r() - 0.5) * 0.8, dir.y + 0.4, dir.z + (r() - 0.5) * 0.8).normalize();
      const len2 = len * 0.55;
      b.add(new THREE.CylinderGeometry(0.02 * s, 0.045 * s, len2, 5), col, along(tip.x + (dir2.x * len2) / 2, tip.y + (dir2.y * len2) / 2, tip.z + (dir2.z * len2) / 2, dir2.x, dir2.y, dir2.z));
    }
  } else if (kind === 1) {
    const col = r() < 0.5 ? 0xd8a0ff : 0xb6e07a;
    const g = new THREE.IcosahedronGeometry(0.5 * s, 1);
    g.scale(1, 0.62, 1);
    b.add(g, col, M(x, 0.28 * s, z, r() * 6));
    const g2 = new THREE.IcosahedronGeometry(0.3 * s, 1);
    g2.scale(1, 0.62, 1);
    b.add(g2, col, M(x + 0.45 * s, 0.17 * s, z + 0.2 * s, r() * 6));
  } else if (kind === 2) {
    const col = r() < 0.5 ? 0xa070ff : 0xff6a8a;
    const fan = new THREE.Shape();
    fan.absarc(0, 0, 0.55 * s, 0, Math.PI, false);
    fan.lineTo(-0.55 * s, 0);
    const ry = r() * Math.PI;
    b.add(new THREE.ExtrudeGeometry(fan, { depth: 0.06 * s, bevelEnabled: false, curveSegments: 8 }), col, M(x, 0.35 * s, z, ry));
    b.add(new THREE.CylinderGeometry(0.05 * s, 0.09 * s, 0.4 * s, 6), col, M(x, 0.2 * s, z));
    const fan2 = new THREE.Shape();
    fan2.absarc(0, 0, 0.32 * s, 0, Math.PI, false);
    fan2.lineTo(-0.32 * s, 0);
    b.add(new THREE.ExtrudeGeometry(fan2, { depth: 0.05 * s, bevelEnabled: false, curveSegments: 6 }), col, M(x + Math.cos(ry) * 0.5 * s, 0.22 * s, z - Math.sin(ry) * 0.5 * s, ry + 0.6));
  } else {
    const col = r() < 0.5 ? 0x5ce0d0 : 0xffe27a;
    const n = 5 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const h = (0.3 + r() * 0.45) * s;
      const rr = i === 0 ? 0 : 0.17 * s;
      b.add(new THREE.CylinderGeometry(0.075 * s, 0.09 * s, h, 6), col, M(x + Math.cos(a) * rr, h / 2, z + Math.sin(a) * rr));
    }
  }
}

/** Starfish and shell decals: extremely thin solid shapes, which do not block standing positions */
function shells(b: PropBatch, x: number, z: number, r: () => number): void {
  if (r() < 0.5) {
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rr = i % 2 ? 0.13 : 0.3;
      if (i === 0) star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    star.closePath();
    const g = new THREE.ExtrudeGeometry(star, { depth: 0.07, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    b.add(g, [0xff7a5a, 0xffa060, 0xb890ff, 0xff9ec0][Math.floor(r() * 4)], M(x, 0.005, z, r() * 6, 1.2 + r() * 0.7));
  } else {
    const sh = new THREE.Shape();
    sh.moveTo(-0.22, 0);
    for (let i = 1; i < 8; i++) {
      const a = Math.PI - (i / 8) * Math.PI;
      const rr = 0.22 + (i % 2 ? 0.035 : 0);
      sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    sh.lineTo(0.22, 0);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    b.add(g, [0xfff1e2, 0xffd8c8, 0xf7e2b0][Math.floor(r() * 3)], M(x, 0.005, z, r() * 6, 1.2 + r() * 0.7));
  }
}

// ───────────────────────── Landmarks ─────────────────────────

/** Lighthouse reef island: sand, reef rock, a red-and-white striped tower and the keeper's hut; returns the lantern room's position */
function lighthouse(b: PropBatch, x: number, z: number, r: () => number): THREE.Vector3 {
  b.add(new THREE.CylinderGeometry(6.4, 7.6, 0.6, 16), 0xead9ac, M(x, 0.25, z), false);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.4;
    const rr = 6.2 + r() * 1.4;
    const s = 0.7 + r() * 0.9;
    b.add(new THREE.DodecahedronGeometry(1, 0), i % 2 ? 0x6c7c92 : 0x7f90a6, M(x + Math.cos(a) * rr, 0.4 * s, z + Math.sin(a) * rr, r() * 6, s, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6));
  }
  b.add(new THREE.CylinderGeometry(2.3, 2.8, 1.4, 12), 0xb4b8c4, M(x, 1.25, z));
  const H = 1.7;
  for (let i = 0; i < 5; i++) {
    const r0 = 1.6 - i * 0.12;
    b.add(new THREE.CylinderGeometry(r0 - 0.12, r0, H, 12), i % 2 ? 0xe8443a : 0xf8f4ee, M(x, 1.95 + H * i + H / 2, z));
  }
  const top = 1.95 + H * 5;
  b.add(new THREE.CylinderGeometry(1.55, 1.05, 0.45, 12), 0x3a4050, M(x, top + 0.22, z));
  b.add(new THREE.TorusGeometry(1.48, 0.06, 6, 24), 0x3a4050, M(x, top + 1.15, z, 0, 1, Math.PI / 2));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 4), 0x3a4050, M(x + Math.cos(a) * 1.48, top + 0.8, z + Math.sin(a) * 1.48));
  }
  const lantern = new THREE.Vector3(x, top + 1.15, z);
  b.glow(new THREE.CylinderGeometry(0.95, 0.95, 1.3, 10), 0xffe08a, M(x, top + 1.15, z));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add(new THREE.BoxGeometry(0.1, 1.4, 0.1), 0x3a4050, M(x + Math.cos(a) * 0.98, top + 1.15, z + Math.sin(a) * 0.98));
  }
  b.add(new THREE.ConeGeometry(1.35, 1.2, 10), 0xe8443a, M(x, top + 2.4, z));
  b.add(new THREE.SphereGeometry(0.16, 8, 6), 0xffd870, M(x, top + 3.1, z));
  b.add(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 4), 0x3a4050, M(x + 1.35, top + 1.7, z + 0.6));
  // The keeper's hut (the wall facing the camera has a lit window)
  const hx = x + 3.9;
  const hz = z + 1.6;
  b.add(new THREE.BoxGeometry(2.8, 2.0, 2.3), 0xf6ecd8, M(hx, 1.55, hz));
  b.add(new THREE.ConeGeometry(2.3, 1.2, 4), 0xd0553f, M(hx, 3.15, hz, Math.PI / 4));
  b.add(new THREE.BoxGeometry(0.4, 0.9, 0.4), 0xb4b8c4, M(hx + 0.8, 3.3, hz - 0.3));
  b.glow(new THREE.BoxGeometry(0.55, 0.5, 0.1), 0xffd070, M(hx - 0.7, 1.85, hz + 1.15));
  b.glow(new THREE.BoxGeometry(0.55, 0.5, 0.1), 0xffd070, M(hx + 0.7, 1.85, hz + 1.15));
  b.add(new THREE.BoxGeometry(0.6, 1.1, 0.1), 0x6a4630, M(hx, 1.1, hz + 1.15));
  palm(b, x - 3.4, z + 2.6, 0.85, r);
  return lantern;
}

/** Pier: wooden piles, planks, railings, lamp posts, crates and barrels; returns the positions of the two lamp posts (for hanging bunting) */
function pier(b: PropBatch, ang: number, r0: number, r1: number): [THREE.Vector3, THREE.Vector3] {
  const dx = Math.cos(ang);
  const dz = Math.sin(ang);
  const px = -dz;
  const pz = dx;
  const w = 1.15;
  const ry = -ang - Math.PI / 2;
  for (let d = r0; d <= r1 + 0.1; d += 1.6) {
    for (const side of [-1, 1]) {
      b.add(new THREE.CylinderGeometry(0.13, 0.16, 1.5, 6), 0x6a4a30, M(d * dx + px * w * 0.85 * side, 0.55, d * dz + pz * w * 0.85 * side));
    }
  }
  for (let d = r0 - 0.3; d <= r1; d += 0.5) {
    b.add(new THREE.BoxGeometry(w * 2, 0.1, 0.42), 0xc49564, M(d * dx, 1.05, d * dz, ry));
  }
  // Railing (one side)
  for (let d = r0; d <= r1 + 0.1; d += 1.6) b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 5), 0x8a6440, M(d * dx + px * w, 1.45, d * dz + pz * w));
  const len = r1 - r0;
  const mid = (r0 + r1) / 2;
  b.add(new THREE.BoxGeometry(0.08, 0.08, len), 0x8a6440, M(mid * dx + px * w, 1.85, mid * dz + pz * w, -ang));
  // Mooring posts, lamp posts, crates and barrels
  b.add(new THREE.CylinderGeometry(0.17, 0.2, 0.5, 8), 0x4a3424, M(r1 * dx - px * w * 0.7, 1.3, r1 * dz - pz * w * 0.7));
  b.add(new THREE.CylinderGeometry(0.17, 0.2, 0.5, 8), 0x4a3424, M((r0 + 3) * dx - px * w * 0.7, 1.3, (r0 + 3) * dz - pz * w * 0.7));
  const posts: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(r0 * dx + px * w, 3.3, r0 * dz + pz * w), new THREE.Vector3(r1 * dx + px * w, 3.3, r1 * dz + pz * w)];
  for (const p of posts) {
    b.add(new THREE.CylinderGeometry(0.07, 0.09, 2.4, 6), 0x5a3e2a, M(p.x, 2.25, p.z));
    b.add(new THREE.ConeGeometry(0.3, 0.25, 6), 0x3a4050, M(p.x, 3.6, p.z));
    b.glow(new THREE.SphereGeometry(0.18, 8, 6), 0xffd070, M(p.x, 3.3, p.z));
  }
  b.add(new THREE.BoxGeometry(0.6, 0.6, 0.6), 0xb08050, M((r0 + 1.2) * dx - px * 0.5, 1.4, (r0 + 1.2) * dz - pz * 0.5, ry + 0.2));
  b.add(new THREE.BoxGeometry(0.5, 0.5, 0.5), 0xc49564, M((r0 + 1.2) * dx - px * 0.5, 1.95, (r0 + 1.2) * dz - pz * 0.5, ry + 0.9));
  b.add(new THREE.CylinderGeometry(0.28, 0.25, 0.65, 9), 0x8a5a38, M((r0 + 2.1) * dx - px * 0.6, 1.42, (r0 + 2.1) * dz - pz * 0.6));
  b.add(new THREE.TorusGeometry(0.27, 0.03, 4, 12), 0x3a4050, M((r0 + 2.1) * dx - px * 0.6, 1.55, (r0 + 2.1) * dz - pz * 0.6, 0, 1, Math.PI / 2));
  b.add(new THREE.TorusGeometry(0.26, 0.07, 5, 12), 0xd8c090, M((r1 - 1.0) * dx + px * 0.5, 1.15, (r1 - 1.0) * dz + pz * 0.5, 0, 1, Math.PI / 2));
  return posts;
}

/** Fishing boat: hull, gunwale, seat boards, mast, sail and pennant (vertex colors, the whole boat one mesh) */
function boat(mat: THREE.Material, hullColor: number): THREE.Group {
  const cb = new ColorBatch();
  const shape = (k: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 1.95 * k);
    sh.quadraticCurveTo(0.9 * k, 1.0 * k, 0.82 * k, -0.2 * k);
    sh.quadraticCurveTo(0.8 * k, -1.3 * k, 0.45 * k, -1.6 * k);
    sh.lineTo(-0.45 * k, -1.6 * k);
    sh.quadraticCurveTo(-0.8 * k, -1.3 * k, -0.82 * k, -0.2 * k);
    sh.quadraticCurveTo(-0.9 * k, 1.0 * k, 0, 1.95 * k);
    return sh;
  };
  const hull = new THREE.ExtrudeGeometry(shape(1), { depth: 0.7, bevelEnabled: false, curveSegments: 6 });
  hull.rotateX(Math.PI / 2);
  cb.add(hull, hullColor, M(0, 0.85, 0));
  const rim = new THREE.ExtrudeGeometry(shape(1.07), { depth: 0.14, bevelEnabled: false, curveSegments: 6 });
  rim.rotateX(Math.PI / 2);
  cb.add(rim, 0xc49564, M(0, 0.99, 0));
  const inner = new THREE.ExtrudeGeometry(shape(0.8), { depth: 0.02, bevelEnabled: false, curveSegments: 6 });
  inner.rotateX(Math.PI / 2);
  cb.add(inner, 0x5a3a24, M(0, 0.9, 0));
  cb.add(new THREE.BoxGeometry(1.3, 0.08, 0.26), 0xc49564, M(0, 0.95, 0.55));
  cb.add(new THREE.BoxGeometry(1.1, 0.08, 0.26), 0xc49564, M(0, 0.95, -0.7));
  cb.add(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 6), 0x8a6440, M(0, 2.4, 0.1));
  cb.add(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 5), 0x8a6440, M(0, 1.45, -0.75, 0, 1, Math.PI / 2));
  const sail = new THREE.Shape();
  sail.moveTo(0.05, 1.5);
  sail.lineTo(0.05, 3.85);
  sail.quadraticCurveTo(-0.5, 2.6, -1.6, 1.55);
  sail.lineTo(0.05, 1.5);
  const sg = new THREE.ExtrudeGeometry(sail, { depth: 0.04, bevelEnabled: false, curveSegments: 5 });
  sg.rotateY(Math.PI / 2);
  cb.add(sg, 0xfff2d8, M(0, 0, 0));
  cb.add(new THREE.BoxGeometry(0.06, 0.16, 0.9), 0xe8443a, M(0, 2.1, -0.5, 0, 1, 0, 0));
  const flag = new THREE.Shape();
  flag.moveTo(0, 0);
  flag.lineTo(0, 0.3);
  flag.lineTo(-0.55, 0.15);
  flag.lineTo(0, 0);
  const fg = new THREE.ExtrudeGeometry(flag, { depth: 0.03, bevelEnabled: false });
  fg.rotateY(Math.PI / 2);
  cb.add(fg, 0xe8443a, M(0, 3.75, 0.1));
  cb.add(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 5), 0xc49564, M(0.75, 0.9, -0.3, 0, 1, 0.3, 1.0));
  return cb.build(mat);
}

/** Sea stack: piled reef rock, a tuft of grass on top, a ring of foam at the base */
function seaStack(b: PropBatch, x: number, z: number, s: number, r: () => number): void {
  b.add(new THREE.DodecahedronGeometry(1, 0), 0x66788e, M(x, 0.9 * s, z, r() * 6, s * 1.3, 0.2, 0.15));
  b.add(new THREE.DodecahedronGeometry(1, 0), 0x7d8ea4, M(x + 0.3 * s, 2.2 * s, z, r() * 6, s * 0.95, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
  b.add(new THREE.DodecahedronGeometry(1, 0), 0x8fa0b4, M(x - 0.2 * s, 3.1 * s, z, r() * 6, s * 0.6, 0.3, 0.2));
  b.add(new THREE.IcosahedronGeometry(0.55 * s, 0), 0x4fae62, M(x - 0.2 * s, 3.65 * s, z, 0, 1, 0, 0.2));
  b.add(new THREE.RingGeometry(1.25 * s, 2.0 * s, 18).rotateX(-Math.PI / 2), 0xffffff, M(x, 0.09, z), false);
}

/** Small distant island: sand, reef rock and palm trees */
function islet(b: PropBatch, x: number, z: number, s: number, r: () => number): void {
  b.add(new THREE.CylinderGeometry(4.5 * s, 5.5 * s, 0.4, 14), 0xead9ac, M(x, 0.15, z), false);
  b.add(new THREE.RingGeometry(5.4 * s, 6.3 * s, 20).rotateX(-Math.PI / 2), 0xffffff, M(x, 0.09, z), false);
  palm(b, x + 1.2 * s, z - 0.5 * s, 1.1 * s, r);
  palm(b, x - 1.6 * s, z + 0.8 * s, 0.9 * s, r);
  b.add(new THREE.DodecahedronGeometry(1, 0), 0x7d8ea4, M(x + 2.5 * s, 0.5 * s, z + 2 * s, r() * 6, 0.9 * s, 0.3, 0.2));
}

/** North-shore ice field: a low flat ice shelf and a few ice peaks (distant silhouettes) */
function iceShelf(b: PropBatch, r: () => number): void {
  for (let i = 0; i < 9; i++) {
    const x = -88 + i * 22 + (r() - 0.5) * 8;
    const z = -108 - r() * 14;
    const w = 18 + r() * 10;
    const h = 3 + r() * 2.5;
    // The distant view gets no outline: the outline shell would leave only scattered dots at a distance
    b.add(new THREE.BoxGeometry(w, h, 12), 0xdbeeff, M(x, h / 2, z, (r() - 0.5) * 0.3), false);
    if (r() < 0.75) {
      const ch = 8 + r() * 9;
      b.add(new THREE.ConeGeometry(4 + r() * 3, ch, 5), 0xcfe6fb, M(x + (r() - 0.5) * 8, h + ch / 2, z - 2), false);
    }
    if (r() < 0.5) {
      const ch = 5 + r() * 5;
      b.add(new THREE.ConeGeometry(2.5 + r() * 2, ch, 4), 0xc2ddf7, M(x + (r() - 0.5) * 12, h + ch / 2, z + 3), false);
    }
  }
}

/** Cumulus: a few squashed spheres arranged in a clump */
function cloud(cb: PropBatch, x: number, y: number, z: number, s: number, r: () => number): void {
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const k = i - (n - 1) / 2;
    const rad = s * (1.6 + r() * 0.8) * (1 - (Math.abs(k) / n) * 0.7);
    const g = new THREE.IcosahedronGeometry(rad, 1);
    g.scale(1, 0.62, 1);
    cb.add(g, 0xffffff, M(x + k * 1.9 * s, y + rad * 0.25, z + (r() - 0.5) * 1.2 * s), false);
  }
}

/** Seagull flock: each is a body + two wings, and the wings flap in the shader according to the aWing attribute */
function gullFlock(r: () => number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    // The top edge of the battle camera is only slightly above the horizon, so the gulls must fly low to be seen
    const R = 15 + r() * 7;
    const h = 3.5 + r() * 2;
    const ang = (i / 7) * 1.3 + r() * 0.3;
    const sc = 0.8 + r() * 0.45;
    const ph = r() * 6.28;
    const body = new THREE.OctahedronGeometry(0.13 * sc);
    body.scale(0.75, 0.6, 2.6);
    const bp = body.attributes.position;
    const pos: number[] = [];
    const wing: number[] = [];
    for (let k = 0; k < bp.count; k++) {
      pos.push(bp.getX(k), bp.getY(k), bp.getZ(k));
      wing.push(0);
    }
    const A = [0, 0.02, -0.17 * sc];
    const B = [0, 0.02, 0.17 * sc];
    pos.push(...A, -0.95 * sc, 0.05, 0.02, ...B);
    wing.push(0, 1, 0);
    pos.push(...A, ...B, 0.95 * sc, 0.05, 0.02);
    wing.push(0, 0, 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(new Array(wing.length).fill(ph), 1));
    g.applyMatrix4(M(Math.cos(ang) * R, h, Math.sin(ang) * R, Math.PI - ang));
    parts.push(g);
  }
  return mergeGeometries(parts) ?? new THREE.BufferGeometry();
}

/** Banner: the larger aSway is, the more it sways; hang means hung from the top edge (bunting), otherwise from the left edge (pennant) */
function flagGeo(len: number, h: number, color: number, hang: boolean, pennant: boolean, m: THREE.Matrix4): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(len, h, hang ? 2 : 8, hang ? 4 : 2);
  const p = g.attributes.position;
  const sway = new Float32Array(p.count);
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const s = hang ? (h / 2 - y) / h : (x + len / 2) / len;
    sway[i] = s;
    if (pennant) p.setY(i, y * (1 - 0.85 * s));
    if (hang) p.setX(i, x * (1 - 0.8 * s));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  // Move the attachment point to the origin
  g.translate(hang ? 0 : len / 2, hang ? -h / 2 : 0, 0);
  g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  g.applyMatrix4(m);
  return g.index ? g.toNonIndexed() : g;
}

const FLAG_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  attribute float aSway; uniform float uTime; varying vec3 vColor; varying float vShade;
  void main() {
    vColor = color;
    float w = sin(uTime * 4.5 - aSway * 5.0 + position.x * 0.7 + position.z * 0.5);
    vec3 p = position + normal * w * aSway * 0.22 + vec3(0.0, 1.0, 0.0) * sin(uTime * 3.1 - aSway * 4.0) * aSway * 0.06;
    vShade = 0.82 + 0.18 * w;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const FLAG_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  varying vec3 vColor; varying float vShade;
  void main() {
    gl_FragColor = vec4(vColor * vShade, 1.0);
    #include <fog_fragment>
  }`;

const GULL_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  attribute float aWing; attribute float aPhase; uniform float uTime;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 9.0 + aPhase) * aWing * 0.42;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const GULL_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  void main() {
    gl_FragColor = vec4(gl_FrontFacing ? vec3(0.97, 0.98, 1.0) : vec3(0.55, 0.62, 0.72), 1.0);
    #include <fog_fragment>
  }`;

const BEAM_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FRAG = /* glsl */ `
  uniform float uTime; varying vec2 vUv;
  void main() {
    float a = pow(vUv.y, 1.7) * 0.7 * (0.88 + 0.12 * sin(uTime * 6.0));
    gl_FragColor = vec4(vec3(1.0, 0.93, 0.62) * 1.7, a);
  }`;

// ───────────────────────── Arena ─────────────────────────

const PIER_ANGLE = -0.85;
const LIGHTHOUSE = new THREE.Vector2(11.5, -35);

export const isles: RegionModule = {
  palette: {
    sky: ['#2b8ce6', '#8fd0ff', '#eef8ff'],
    fog: 0xcfe9ff,
    fogNear: 34,
    fogFar: 165,
    ground: ['#f4e4bc', '#e4cf9e', '#ffffff'],
    light: [0.4, 0.9, 0.3],
    ambient: 0xa8c8e0,
    rim: 0xffffff,
    shadow: 0x5a8ab8,
    motes: [0xbff0ff, 0xffffff],
    moteKind: 'rise',
  },
  build(ctx) {
    const { group, b, r, extras, disposers } = ctx;
    // When placing props, avoid the pier and the walkway of the display camera; tall things (palm trees) must also stay out of the lighthouse's line of sight
    const LH_ANGLE = Math.atan2(LIGHTHOUSE.y, LIGHTHOUSE.x);
    const spot = (rMin: number, rMax: number, avoidFront = true, tall = false): readonly [number, number] => {
      for (let i = 0; i < 40; i++) {
        const [x, z] = ctx.ringPos(rMin, rMax, avoidFront);
        const a = Math.atan2(z, x);
        let da = Math.abs(a - PIER_ANGLE);
        if (da > Math.PI) da = Math.PI * 2 - da;
        if (da < 0.24 && Math.hypot(x, z) > 9.5) continue;
        let dl = Math.abs(a - LH_ANGLE);
        if (dl > Math.PI) dl = Math.PI * 2 - dl;
        if (tall && dl < 0.3) continue;
        if (Math.abs(x) < 3.5 && z > 4) continue;
        return [x, z];
      }
      return ctx.ringPos(rMin, rMax, avoidFront);
    };

    const waterMat = buildWater(ctx);

    // Beach: palm trees, coral clusters, shells and starfish, driftwood
    for (let i = 0; i < 8; i++) {
      const [x, z] = spot(10.5, 13.5, true, true);
      palm(b, x, z, 0.95 + r() * 0.4, r);
    }
    for (let i = 0; i < 12; i++) {
      const [x, z] = spot(11.5, 13.5);
      coral(b, x, z, 0.75 + r() * 0.5, r);
    }
    for (let i = 0; i < 16; i++) {
      const [x, z] = spot(15, 19.5, false);
      coral(b, x, z, 0.9 + r() * 0.7, r);
    }
    for (let i = 0; i < 24; i++) {
      const a = r() * Math.PI * 2;
      const d = 5.5 + r() * 8.5;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (Math.hypot(x + 3.1, z - 1.3) < 2.4 || Math.hypot(x - 3.1, z + 1.3) < 2.4) continue;
      shells(b, x, z, r);
    }
    // Tide pools, pebbles and stranded seaweed: all small things lying on the ground, which may also go in the foreground
    for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2;
      const d = 10.5 + r() * 3;
      const g = new THREE.CircleGeometry(0.8 + r() * 0.6, 12).rotateX(-Math.PI / 2);
      g.scale(1.4, 1, 0.8);
      b.add(g, 0x9fdce0, M(Math.cos(a) * d, 0.012, Math.sin(a) * d, r() * 6), false);
    }
    for (let i = 0; i < 30; i++) {
      const a = r() * Math.PI * 2;
      const d = 6 + r() * 8;
      b.add(new THREE.DodecahedronGeometry(0.09 + r() * 0.08, 0), i % 3 ? 0xd9c9a8 : 0x8f9aa8, M(Math.cos(a) * d, 0.05, Math.sin(a) * d, r() * 6, 1, r(), r()));
    }
    for (let i = 0; i < 8; i++) {
      const a = r() * Math.PI * 2;
      const d = 8 + r() * 6;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const ry = r() * 6;
      for (let k = 0; k < 3; k++) b.add(new THREE.CylinderGeometry(0.03, 0.05, 0.9, 4), 0x3f8a5a, M(x + Math.cos(ry + k) * 0.3, 0.03, z + Math.sin(ry + k) * 0.3, ry + k * 1.3, 1, 0, Math.PI / 2), false);
    }
    for (let i = 0; i < 2; i++) {
      const [x, z] = spot(10.5, 13);
      b.add(new THREE.CylinderGeometry(0.16, 0.22, 2.4, 6), 0x9a7a58, M(x, 0.2, z, r() * 6, 1, 0, Math.PI / 2 - 0.1));
    }
    // Shallow-water buoys
    for (let i = 0; i < 4; i++) {
      const [x, z] = spot(18, 23, false);
      b.add(new THREE.SphereGeometry(0.32, 9, 7), i % 2 ? 0xe8443a : 0xffffff, M(x, 0.2, z));
      b.add(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 4), 0x3a4050, M(x, 0.7, z));
      b.add(new THREE.SphereGeometry(0.1, 6, 5), 0xffd870, M(x, 1.1, z));
    }

    // Landmarks: the lighthouse reef island and the fishing harbor pier
    const lantern = lighthouse(b, LIGHTHOUSE.x, LIGHTHOUSE.y, r);
    const posts = pier(b, PIER_ANGLE, 11.5, 21);

    // Sea stacks and distant small islands
    for (let i = 0; i < 7; i++) {
      const [x, z] = spot(30, 56, true);
      if (Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.y) < 12) continue;
      // Sea stacks too close on the camera side would block the view
      if (z > 5 && Math.hypot(x, z) < 45) continue;
      seaStack(b, x, z, 1.2 + r() * 1.5, r);
    }
    for (let i = 0; i < 3; i++) {
      const a = 0.6 + i * 2.0 + r() * 0.6;
      const d = 48 + r() * 24;
      islet(b, Math.cos(a) * d, Math.sin(a) * d, 0.9 + r() * 0.5, r);
    }
    iceShelf(b, r);

    // Clouds: clump after clump drifting slowly around the island
    const cloudBatch = new PropBatch();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + r() * 0.5;
      const d = 65 + r() * 60;
      cloud(cloudBatch, Math.cos(a) * d, 22 + r() * 20, Math.sin(a) * d, 1.1 + r() * 1.1, r);
    }
    // Low clouds hugging the horizon: these few are the only ones the battle camera sees
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + r() * 0.6;
      const d = 95 + r() * 45;
      cloud(cloudBatch, Math.cos(a) * d, 5 + r() * 6, Math.sin(a) * d, 1.4 + r() * 1.2, r);
    }
    const clouds = new THREE.Group();
    cloudBatch.build(clouds);
    group.add(clouds);

    // Sun (a halo on the light direction; the battle camera is behind it, and it is seen when the title orbits)
    const sunMat = new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0xfff2c0).multiplyScalar(1.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
    const sun = new THREE.Sprite(sunMat);
    sun.position.set(0.4, 0.9, 0.3).normalize().multiplyScalar(150);
    sun.scale.setScalar(46);
    group.add(sun);

    // Lighthouse beam: two long opposing cones rotating around the lantern room; plus a breathing halo outside the lantern room
    const beamMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    const cone = new THREE.ConeGeometry(3.6, 34, 12, 1, true);
    cone.translate(0, -17, 0);
    cone.rotateX(Math.PI / 2);
    const cone2 = cone.clone().rotateY(Math.PI);
    const beam = new THREE.Mesh(mergeGeometries([cone, cone2]) ?? cone, beamMat);
    beam.position.copy(lantern);
    beam.renderOrder = 2;
    group.add(beam);
    const flareMat = new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0xffe6a0).multiplyScalar(2.0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const flare = new THREE.Sprite(flareMat);
    flare.position.copy(lantern);
    flare.scale.setScalar(4);
    group.add(flare);

    // Fishing boats: one moored at the pier and rocking, one slowly circling on the distant sea
    const vt = vertexColorMaterial();
    const moored = boat(vt, 0x2f6aa8);
    const pdx = Math.cos(PIER_ANGLE);
    const pdz = Math.sin(PIER_ANGLE);
    const mooredPos = new THREE.Vector3(17 * pdx - pdz * 2.1, 0.05, 17 * pdz + pdx * 2.1);
    moored.rotation.y = Math.PI / 2 - PIER_ANGLE;
    group.add(moored);
    const sailing = boat(vt, 0xd8553f);
    sailing.scale.setScalar(1.6);
    group.add(sailing);

    // Seagull flock
    const gullMat = new THREE.ShaderMaterial({ fog: true, side: THREE.DoubleSide, uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } }, vertexShader: GULL_VERT, fragmentShader: GULL_FRAG });
    const gulls = new THREE.Group();
    gulls.add(new THREE.Mesh(gullFlock(r), gullMat));
    group.add(gulls);

    // Banners: the lighthouse's pennant, the bunting between the pier's lamp posts
    const flagMat = new THREE.ShaderMaterial({ fog: true, side: THREE.DoubleSide, vertexColors: true, uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } }, vertexShader: FLAG_VERT, fragmentShader: FLAG_FRAG });
    const flags: THREE.BufferGeometry[] = [];
    flags.push(flagGeo(1.7, 0.7, 0xe8443a, false, true, M(LIGHTHOUSE.x + 1.35, lantern.y + 1.35, LIGHTHOUSE.y + 0.6, 0.9)));
    const [p0, p1] = posts;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const px = p0.x + (p1.x - p0.x) * k;
      const pz = p0.z + (p1.z - p0.z) * k;
      const sag = Math.sin(k * Math.PI) * 0.35;
      const ry = -Math.atan2(p1.z - p0.z, p1.x - p0.x);
      flags.push(flagGeo(0.42, 0.5, [0xe8443a, 0xfff0d0, 0x4fb0ff][i % 3], true, false, M(px, 3.25 - sag, pz, ry)));
    }
    const flagMesh = new THREE.Mesh(mergeGeometries(flags) ?? flags[0], flagMat);
    group.add(flagMesh);
    // Bunting rope: thinner than a pixel, so the outline would leave only broken dots; no outline
    b.add(new THREE.CylinderGeometry(0.015, 0.015, p0.distanceTo(p1), 3), 0x3a4050, along((p0.x + p1.x) / 2, 3.15, (p0.z + p1.z) / 2, p1.x - p0.x, 0, p1.z - p0.z), false);

    disposers.push(() => {
      sunMat.dispose();
      beamMat.dispose();
      flareMat.dispose();
      vt.dispose();
      gullMat.dispose();
      flagMat.dispose();
    });

    // Dynamics: beam rotation, boats rocking and sailing, gulls circling the island, clouds drifting, banners swaying, occasional sparkles on the sea
    let glitT = 0;
    const glitPos = new THREE.Vector3();
    extras.push((dt, t, vfx) => {
      beam.rotation.y = t * 0.65;
      beamMat.uniforms.uTime.value = t;
      flare.scale.setScalar(3.6 + Math.sin(t * 6) * 0.5);
      moored.position.set(mooredPos.x, 0.05 + Math.sin(t * 1.3) * 0.06, mooredPos.z);
      moored.rotation.x = Math.sin(t * 0.9 + 1) * 0.03;
      moored.rotation.z = Math.sin(t * 1.1) * 0.045;
      const th = 0.9 + t * 0.014;
      sailing.position.set(Math.cos(th) * 58, 0.05 + Math.sin(t * 1.7) * 0.08, Math.sin(th) * 58);
      sailing.rotation.set(Math.sin(t * 1.2) * 0.03, -th, Math.sin(t * 0.8) * 0.05);
      waterMat.uniforms.uBoat.value.set(sailing.position.x, sailing.position.z);
      gulls.rotation.y = t * 0.07;
      gulls.position.y = Math.sin(t * 0.5) * 0.6;
      gullMat.uniforms.uTime.value = t;
      clouds.rotation.y = t * 0.004;
      flagMat.uniforms.uTime.value = t;
      glitT += dt;
      while (glitT > 0.14) {
        glitT -= 0.14;
        const a = Math.random() * Math.PI * 2;
        const d = 18 + Math.random() * 26;
        glitPos.set(Math.cos(a) * d, 0.2, Math.sin(a) * d);
        vfx.emit({ pos: glitPos, count: 1, color: 0xffffff, speed: [0, 0.1], life: [0.35, 0.7], size: [0.25, 0.5], sizeEnd: 0.1, atlas: 1, intensity: 2.2, drag: 0 });
      }
    });
  },
};
