// Stoneheart Canyon (earth): a deep canyon of layered red rock, with wind-eroded sedimentary walls and mushroom rocks on both sides, the dwarf kingdom's city gate set into the left wall,
// a track in front of the gate leading to a mine deep in the canyon floor with mine carts going back and forth; a stone arch at the canyon mouth, and beyond it the silhouette of the kingdom on the sleeping giant tortoise's back. Sunset, dust, quicksand.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, MS, PropBatch, crystal, type ArenaCtx, type RegionModule } from '../arenaKit.ts';
import { SoftGeo, softMaterial } from './highland.ts';

// ───────────────────────── Canyon coordinates ─────────────────────────

/** Canyon floor axes: u points deep into the canyon as the camera looks (+x, −z), v points to the right wall; the battle camera looks right along the canyon floor */
const PHI = Math.atan2(0.954, 0.3);
const CP = Math.cos(PHI);
const SP = Math.sin(PHI);
const uv = (u: number, v: number): [number, number] => [u * CP + v * SP, -u * SP + v * CP];

/** Place in canyon coordinates: world position = uv(u, v) + Ry(th)·(lx, ly, lz), Y rotation = th + ry */
function L(u: number, v: number, th: number, lx: number, ly: number, lz: number, ry = 0, s = 1, rx = 0, rz = 0): THREE.Matrix4 {
  const [x, z] = uv(u, v);
  const wx = x + lx * Math.cos(th) + lz * Math.sin(th);
  const wz = z - lx * Math.sin(th) + lz * Math.cos(th);
  return M(wx, ly, wz, th + ry, s, rx, rz);
}

const BANDS = [0xc8703f, 0xa4503a, 0xd98d55, 0xb5613f, 0xe2a56c];
const STRATA = 0x8e4634;
const STONE = 0xc4956a;
const STONE_DK = 0x9c7455;
const TRIM = 0xd9a060;
const WOOD = 0x7a5236;
const DARKWOOD = 0x5c3f2c;
const GARGOYLE = 0x8a8a96;

// ───────────────────────── Rock walls and rocks ─────────────────────────

/** Layered red rock wall: several cylinders narrowing from bottom to top, with a dark sedimentary band between layers and a weathered round rock on top */
function mesa(b: PropBatch, x: number, z: number, w: number, h: number, r: () => number, outline = true): void {
  const n = 4 + Math.floor(r() * 3);
  const ry = r() * 6;
  const lean = (r() - 0.5) * 0.12;
  let y = 0;
  let rad = w;
  for (let i = 0; i < n; i++) {
    const hb = (h / n) * (0.7 + r() * 0.6);
    const top = rad * (0.84 + r() * 0.12);
    b.add(new THREE.CylinderGeometry(top, rad, hb, 7), BANDS[(i + Math.floor(r() * 2)) % BANDS.length], M(x + lean * y, y + hb / 2, z, ry + i * 0.2), outline);
    b.add(new THREE.CylinderGeometry(top * 1.03, top * 1.05, 0.32, 7), STRATA, M(x + lean * (y + hb), y + hb, z, ry + i * 0.2), false);
    y += hb;
    rad = top;
  }
  b.add(new THREE.DodecahedronGeometry(rad * 0.85, 0), BANDS[2], M(x + lean * y, y + rad * 0.45, z, r() * 6, 1, 0.15, 0.2), outline);
}

/** Mushroom rock: a wide cap carved by the wind sitting on a thin waist */
function hoodoo(b: PropBatch, x: number, z: number, s: number, r: () => number): void {
  b.add(new THREE.CylinderGeometry(0.45, 0.8, 2.4, 7), BANDS[3], M(x, 1.2 * s, z, r() * 6, s));
  b.add(new THREE.CylinderGeometry(0.62, 0.55, 0.3, 7), STRATA, M(x, 1.9 * s, z, 0, s), false);
  const cap = new THREE.DodecahedronGeometry(1, 0);
  cap.scale(1.7, 0.75, 1.5);
  b.add(cap, BANDS[2], M(x, 2.75 * s, z, r() * 6, s, 0.08, 0.1));
}

/** Dead tree: a slanting trunk and two bare branches */
function deadTree(b: PropBatch, x: number, z: number, s: number, r: () => number): void {
  const ry = r() * 6;
  b.add(new THREE.CylinderGeometry(0.1, 0.24, 2.8, 5), 0x6a4a34, M(x, 1.4 * s, z, ry, s, 0, 0.18));
  b.add(new THREE.CylinderGeometry(0.04, 0.1, 1.5, 4), 0x6a4a34, M(x + 0.5 * s, 2.8 * s, z, ry, s, 0, -0.9));
  b.add(new THREE.CylinderGeometry(0.03, 0.08, 1.2, 4), 0x6a4a34, M(x - 0.1 * s, 3.2 * s, z + 0.4 * s, ry, s, 0.8, 0.3));
}

// ───────────────────────── Dwarf buildings ─────────────────────────

/** Apply a world matrix to a lamplight geometry and convert it to a mergeable format */
function lampGeo(geo: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.applyMatrix4(m);
  return g;
}

/** The dwarf kingdom's city gate: two carved stone pillars, a lintel gable, an amber emblem, a gate seam with light shining through, `gargoyle` statues crouching atop the pillars and braziers in front of the gate */
function dwarfGate(b: PropBatch, lamps: THREE.BufferGeometry[], u: number, v: number, th: number): void {
  const P = (lx: number, ly: number, lz: number, ry = 0, s = 1, rx = 0, rz = 0) => L(u, v, th, lx, ly, lz, ry, s, rx, rz);
  for (const sx of [-1, 1]) {
    b.add(new THREE.BoxGeometry(2.4, 11, 2.4), STONE, P(sx * 3.9, 5.5, 0));
    b.add(new THREE.BoxGeometry(3.0, 0.9, 3.0), TRIM, P(sx * 3.9, 11.2, 0));
    b.add(new THREE.BoxGeometry(3.0, 0.8, 3.0), STONE_DK, P(sx * 3.9, 0.4, 0));
    b.add(new THREE.BoxGeometry(2.6, 0.5, 2.6), TRIM, P(sx * 3.9, 6.2, 0));
    b.add(new THREE.BoxGeometry(2.6, 0.5, 2.6), TRIM, P(sx * 3.9, 3.2, 0));
    // Gate guardian: a small stone statue crouching on top of the gate pillar with its wings folded
    b.add(new THREE.SphereGeometry(0.55, 7, 6), GARGOYLE, P(sx * 3.9, 12.15, 0.2));
    b.add(new THREE.SphereGeometry(0.38, 7, 6), GARGOYLE, P(sx * 3.9, 12.8, 0.35));
    b.add(new THREE.ConeGeometry(0.42, 0.9, 4), GARGOYLE, P(sx * 3.9 - 0.65, 12.5, 0, 0, 1, 0, 0.9));
    b.add(new THREE.ConeGeometry(0.42, 0.9, 4), GARGOYLE, P(sx * 3.9 + 0.65, 12.5, 0, 0, 1, 0, -0.9));
    b.glow(new THREE.SphereGeometry(0.07, 5, 4), 0xffb040, P(sx * 3.9 - 0.13, 12.85, 0.7));
    b.glow(new THREE.SphereGeometry(0.07, 5, 4), 0xffb040, P(sx * 3.9 + 0.13, 12.85, 0.7));
  }
  b.add(new THREE.BoxGeometry(10.6, 1.9, 2.6), STONE, P(0, 12.15, 0));
  b.add(new THREE.BoxGeometry(8.4, 1.3, 2.3), STONE_DK, P(0, 13.7, 0));
  b.add(new THREE.BoxGeometry(6.0, 1.0, 2.1), STONE, P(0, 14.8, 0));
  b.add(new THREE.TorusGeometry(0.95, 0.18, 6, 16), TRIM, P(0, 13.7, 1.2));
  b.glow(new THREE.OctahedronGeometry(0.55), 0xffb040, P(0, 13.7, 1.2));
  // Gate opening, door leaves, iron bands and the light shining through the seam
  b.add(new THREE.BoxGeometry(5.4, 10.5, 1.8), 0x2a1a16, P(0, 5.25, -0.7), false);
  for (const sx of [-1, 1]) {
    b.add(new THREE.BoxGeometry(2.45, 9.9, 0.4), DARKWOOD, P(sx * 1.32, 4.95, -0.1));
    for (const yy of [2.0, 5.0, 8.0]) b.add(new THREE.BoxGeometry(2.3, 0.35, 0.1), 0x8a7a6a, P(sx * 1.32, yy, 0.16), false);
    b.add(new THREE.SphereGeometry(0.16, 6, 5), TRIM, P(sx * 0.45, 4.9, 0.2));
  }
  b.glow(new THREE.BoxGeometry(0.14, 9.6, 0.1), 0xffc060, P(0, 4.9, 0.12));
  b.add(new THREE.BoxGeometry(11, 0.45, 1.6), STONE_DK, P(0, 0.22, 1.9));
  b.add(new THREE.BoxGeometry(12, 0.35, 1.4), STONE_DK, P(0, 0.17, 3.3));
  // Braziers: the lamplight flickers
  for (const sx of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.22, 0.3, 2.6, 6), 0x4a3a34, P(sx * 6.3, 1.3, 2.2));
    b.add(new THREE.CylinderGeometry(0.6, 0.35, 0.5, 6), 0x4a3a34, P(sx * 6.3, 2.8, 2.2));
    lamps.push(lampGeo(new THREE.ConeGeometry(0.42, 0.9, 6), P(sx * 6.3, 3.45, 2.2)));
  }
}

/** Mine entrance: an opening held apart by three layers of wooden supports, a sign, a hanging lamp, wooden crates and scattered ore crystals */
function mineEntrance(b: PropBatch, lamps: THREE.BufferGeometry[], u: number, v: number, th: number): void {
  const P = (lx: number, ly: number, lz: number, ry = 0, s = 1, rx = 0, rz = 0) => L(u, v, th, lx, ly, lz, ry, s, rx, rz);
  for (const zz of [0, -1.5, -3.0]) {
    const col = zz === 0 ? WOOD : DARKWOOD;
    b.add(new THREE.BoxGeometry(0.55, 4.4, 0.55), col, P(-2.3, 2.2, zz));
    b.add(new THREE.BoxGeometry(0.55, 4.4, 0.55), col, P(2.3, 2.2, zz));
    b.add(new THREE.BoxGeometry(5.6, 0.6, 0.6), col, P(0, 4.5, zz));
    b.add(new THREE.BoxGeometry(0.4, 1.6, 0.4), col, P(-1.8, 3.7, zz, 0, 1, 0, -0.7));
    b.add(new THREE.BoxGeometry(0.4, 1.6, 0.4), col, P(1.8, 3.7, zz, 0, 1, 0, 0.7));
  }
  b.add(new THREE.BoxGeometry(4.4, 4.2, 5), 0x24160f, P(0, 2.1, -2.2), false);
  b.add(new THREE.BoxGeometry(7.5, 5, 6), BANDS[1], P(0, 7.2, -2.0, 0, 1, 0.05, 0.03));
  b.add(new THREE.BoxGeometry(6.5, 2.5, 5), BANDS[3], P(0.4, 10.6, -2.6, 0.1));
  b.add(new THREE.BoxGeometry(2.2, 0.6, 0.12), 0xe9d3a8, P(0, 5.35, 0.35));
  b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 4), 0x3a2a24, P(0, 4.3, 0.2));
  lamps.push(lampGeo(new THREE.SphereGeometry(0.28, 7, 6), P(0, 3.95, 0.2)));
  b.add(new THREE.BoxGeometry(0.9, 0.9, 0.9), WOOD, P(3.4, 0.45, 1.0, 0.3));
  b.add(new THREE.BoxGeometry(0.8, 0.8, 0.8), WOOD, P(3.6, 1.3, 0.9, 0.7));
  b.glow(new THREE.OctahedronGeometry(0.28), 0x6ae0ff, P(-3.3, 0.35, 1.2));
  b.glow(new THREE.OctahedronGeometry(0.22), 0x6ae0ff, P(-3.7, 0.28, 0.8));
}

/** Mine cart: an iron bucket, wheels (the body) and a pile of glowing ore (a separate mesh) */
function mineCart(): [THREE.BufferGeometry, THREE.BufferGeometry] {
  const g = new SoftGeo();
  const iron = new THREE.Color(0x4a3a34);
  const rim = new THREE.Color(0x6e5c50);
  const wheel = new THREE.Color(0x2a2220);
  g.box(0, 0.75, 0, 1.7, 0.85, 1.05, iron);
  g.box(0, 1.2, 0, 1.9, 0.14, 1.25, rim);
  for (const sx of [-0.55, 0.55]) for (const sz of [-0.58, 0.58]) g.box(sx, 0.26, sz, 0.42, 0.42, 0.12, wheel);
  g.box(0, 0.26, 0, 0.1, 0.1, 1.3, wheel);
  const oct = (s: number, x: number, y: number, z: number) => {
    const o = new THREE.OctahedronGeometry(s);
    o.translate(x, y, z);
    return o;
  };
  const ore = mergeGeometries([oct(0.3, -0.35, 1.35, 0.1), oct(0.26, 0.3, 1.3, -0.15), oct(0.22, 0.05, 1.42, 0.28)])!;
  return [g.build(), ore];
}

// ───────────────────────── Quicksand ─────────────────────────

/** Quicksand: sand ripples slowly spiraling toward the center, fading into the ground at the edge */
function quicksandMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uBase: { value: new THREE.Color(0xc98a58) }, uDark: { value: new THREE.Color(0x8a5634) } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uBase; uniform vec3 uDark; varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float d = length(p) * 2.0;
        // atan is undefined at the exact center (0,0); offset slightly so NaN is not spread by bloom into a black block
        vec2 q = p + vec2(1e-4, 0.0);
        float ang = atan(q.y, q.x);
        float sp = fract(d * 3.5 + uTime * 0.06 + ang / 6.2832 + sin(ang * 3.0 + uTime * 0.2) * 0.05);
        float groove = smoothstep(0.35, 0.42, sp) * (1.0 - smoothstep(0.72, 0.8, sp));
        vec3 c = mix(uBase, uDark, groove * 0.85);
        c = mix(uDark * 0.7, c, smoothstep(0.0, 0.28, d));
        float a = 1.0 - smoothstep(0.8, 1.0, d);
        gl_FragColor = vec4(c, a);
      }`,
  });
}

// ───────────────────────── The arena ─────────────────────────

function build({ group, b, r, ringPos, extras, disposers }: ArenaCtx): void {
  const lamps: THREE.BufferGeometry[] = [];

  // Two rock walls left and right: the near row is lower and the back row higher; the left wall leaves u 22 to 38 for the city gate
  for (let u = -30; u <= 40; u += 6.5) {
    const [rx, rz] = uv(u + (r() - 0.5) * 3, 17.5 + r() * 3);
    mesa(b, rx, rz, 4 + r() * 2.2, 12 + r() * 9, r);
    if (u > 22 && u < 38) continue;
    const [lx, lz] = uv(u + (r() - 0.5) * 3, -17.5 - r() * 3);
    mesa(b, lx, lz, 4 + r() * 2.2, 12 + r() * 9, r);
  }
  for (const [u, v] of [[23, -22], [30, -23.5], [37, -22]]) {
    const [x, z] = uv(u, v);
    mesa(b, x, z, 5 + r() * 1.5, 17 + r() * 5, r);
  }
  for (let u = -24; u <= 44; u += 9) {
    for (const side of [-1, 1]) {
      const [x, z] = uv(u + (r() - 0.5) * 4, side * (26 + r() * 5));
      mesa(b, x, z, 5.5 + r() * 2.5, 17 + r() * 10, r);
    }
  }
  // Rock walls opening out on both sides of the canyon mouth, with the center left clear to look into the distance
  for (const [u, v] of [[50, -34], [58, -26], [64, -40], [50, 30], [57, 22], [63, 38], [72, -30], [70, 30]]) {
    const [x, z] = uv(u + (r() - 0.5) * 4, v + (r() - 0.5) * 4);
    mesa(b, x, z, 6 + r() * 3, 16 + r() * 12, r);
  }
  // Distant lone peaks: a ring around, only silhouettes in the fog
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r() * 0.3;
    const d = 80 + r() * 55;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(((Math.atan2(z, x) - Math.atan2(-SP, CP) + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.35) continue;
    mesa(b, x, z, 8 + r() * 6, 22 + r() * 18, r, false);
  }

  // Mushroom rocks, weathered boulders, dead trees, ore crystals in the cracks
  for (const [u, v, s] of [[-8, -13.5, 1.1], [10, -14, 1.3], [-5, 12.5, 1.0], [33, -6, 1.4], [30, 10, 1.2], [-20, 11, 1.2]]) {
    const [x, z] = uv(u, v);
    hoodoo(b, x, z, s, r);
  }
  for (let i = 0; i < 10; i++) {
    const [x, z] = ringPos(9, 15.5);
    const g = new THREE.DodecahedronGeometry(1, 0);
    g.scale(1.2, 0.8, 1);
    b.add(g, BANDS[Math.floor(r() * BANDS.length)], M(x, 0.45, z, r() * 6, 0.5 + r() * 0.9, r() * 0.4, r() * 0.4));
  }
  for (const [u, v] of [[-12, -14], [26, 13], [-2, 14.5], [14, -14.5]]) {
    const [x, z] = uv(u, v);
    deadTree(b, x, z, 0.9 + r() * 0.5, r);
  }
  for (const [u, v, c] of [[-16, -15.5, 0xffb040], [4, -15.5, 0x6ae0ff], [-8, 16, 0xffb040], [20, 15.5, 0x6ae0ff], [36, 17, 0xffb040], [-24, 16, 0x6ae0ff], [40, -17, 0xffb040]]) {
    const [x, z] = uv(u, v);
    crystal(b, x, z, 0.8, c, r);
  }

  // Ground: cracks, flagstones, gravel, dry grass
  for (let i = 0; i < 44; i++) {
    const [x, z] = ringPos(7.2, 16, false);
    b.add(new THREE.BoxGeometry(0.9 + r() * 1.6, 0.03, 0.1 + r() * 0.06), 0xa86a44, M(x, 0.015, z, r() * 6), false);
  }
  for (let i = 0; i < 12; i++) {
    const [x, z] = ringPos(6.9, 13, false);
    b.add(new THREE.BoxGeometry(1.0 + r() * 0.7, 0.07, 0.7 + r() * 0.5), 0xc99670, M(x, 0.035, z, r() * 6), false);
  }
  for (let i = 0; i < 40; i++) {
    const [x, z] = ringPos(7, 17, false);
    b.add(new THREE.DodecahedronGeometry(1, 0), 0xb5714f, M(x, 0.1, z, r() * 6, 0.1 + r() * 0.15, r(), r()), false);
  }
  for (let i = 0; i < 10; i++) {
    const [x, z] = ringPos(8, 16);
    const g = new THREE.IcosahedronGeometry(0.45, 0);
    g.scale(1.2, 0.7, 1.2);
    b.add(g, 0x9c8a58, M(x, 0.25, z, r() * 6, 0.8 + r() * 0.6));
  }

  // Quicksand and the seven warning stone pillars the dwarves set up
  const [qx, qz] = uv(8, 9.5);
  const sandMat = quicksandMaterial();
  const sand = new THREE.Mesh(new THREE.CircleGeometry(3.6, 40), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(qx, 0.03, qz);
  group.add(sand);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const h = 1.9 + r() * 0.8;
    const px = qx + Math.cos(a) * 4.4, pz = qz + Math.sin(a) * 4.4;
    b.add(new THREE.CylinderGeometry(0.26, 0.36, h, 6), 0x9a8a78, M(px, h / 2, pz, a));
    b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 6), 0x6a5a4c, M(px, h - 0.45, pz, a), false);
  }

  // Stone arch: frames the distant view at the canyon mouth
  const archTh = Math.atan2(CP, -SP);
  b.add(new THREE.TorusGeometry(9, 2.1, 8, 24, Math.PI), BANDS[0], L(40, 6, archTh, 0, 0.4, 0));
  b.add(new THREE.CylinderGeometry(2.3, 2.6, 0.5, 7), STRATA, L(40, 6, archTh, 0, 9.0, 0, 0, 1, 0, 0.9), false);
  for (const sx of [-9, 9]) b.add(new THREE.DodecahedronGeometry(2.7, 0), BANDS[3], L(40, 6, archTh, sx, 1.2, 0, 0, 1, 0.2, 0.1));
  b.add(new THREE.DodecahedronGeometry(2.0, 0), BANDS[2], L(40, 6, archTh, 0, 11.4, 0, 0, 1, 0.3, 0.2));

  // Dwarf city gate (left wall, angled to face into the canyon; the ore track passes right in front of the gate), mine entrance (at the end of the track, facing the camera)
  const gateTh = Math.atan2(SP - 0.6 * CP, CP + 0.6 * SP);
  dwarfGate(b, lamps, 30, -16.5, gateTh);
  const mineTh = Math.atan2(-CP, SP);
  mineEntrance(b, lamps, 44, -10, mineTh);
  // Track and sleepers
  for (const dv of [-0.45, 0.45]) b.add(new THREE.BoxGeometry(58, 0.09, 0.1), 0x5a4a44, L(15, -10 + dv, PHI, 0, 0.12, 0), false);
  for (let u = -14; u <= 43; u += 1.3) b.add(new THREE.BoxGeometry(0.28, 0.08, 1.4), 0x6a5040, L(u, -10, PHI, 0, 0.05, 0), false);
  // Mine carts
  const [cartGeo, oreGeo] = mineCart();
  const cartMat = softMaterial('', 0.55);
  const oreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6ae0ff).multiplyScalar(2.2), toneMapped: false });
  const cart = new THREE.Group();
  cart.add(new THREE.Mesh(cartGeo, cartMat), new THREE.Mesh(oreGeo, oreMat));
  cart.rotation.y = PHI;
  group.add(cart);
  // Lamplight: merged into one mesh, flickering as a whole
  const lampBase = new THREE.Color(0xffc070);
  const lampMat = new THREE.MeshBasicMaterial({ color: lampBase.clone().multiplyScalar(2.0), toneMapped: false });
  const lampGeom = mergeGeometries(lamps);
  if (lampGeom) group.add(new THREE.Mesh(lampGeom, lampMat));

  // Tumbleweeds: rolling from one side of the canyon to the other along the wind direction (+x)
  const weedMat = softMaterial('', 0.6);
  const weedGeo = new SoftGeo();
  const weedCol = new THREE.Color(0xa88a5a);
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, e = (r() - 0.5) * Math.PI;
    const dx = Math.cos(a) * Math.cos(e), dy = Math.sin(e), dz = Math.sin(a) * Math.cos(e);
    weedGeo.tri([dx * 0.1, dy * 0.1, dz * 0.1], [dx * 0.55 + 0.1, dy * 0.55, dz * 0.55 - 0.08], [dx * 0.55 - 0.08, dy * 0.55 + 0.1, dz * 0.55 + 0.1], weedCol, [0, 0, 0], 0);
    weedGeo.tri([-dx * 0.1, -dy * 0.1, -dz * 0.1], [-dx * 0.5 + 0.08, -dy * 0.5 + 0.1, -dz * 0.5], [-dx * 0.5 - 0.1, -dy * 0.5, -dz * 0.5 + 0.1], weedCol, [0, 0, 0], 0);
  }
  const weed = new THREE.Mesh(weedGeo.build(), weedMat);
  group.add(weed);

  // In the distance: the kingdom on the sleeping giant tortoise's back, the low-hanging sunset
  const [tx, tz] = uv(92, 12);
  b.add(new THREE.SphereGeometry(30, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0x5c4a44, MS(tx, -4, tz, 1, 0.62, 1), false);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = 6 + r() * 18;
    const px = tx + Math.cos(a) * d, pz = tz + Math.sin(a) * d;
    const hy = Math.sqrt(Math.max(0, 900 - d * d)) * 0.62 - 4;
    b.add(new THREE.DodecahedronGeometry(4.2, 0), 0x4e3e3a, M(px, hy - 1, pz, r() * 6, 1, 0.2, 0.2), false);
  }
  const [hx, hz] = uv(86, -22);
  b.add(new THREE.SphereGeometry(7.5, 10, 8), 0x5c4a44, MS(hx, 2.5, hz, 1.25, 0.8, 1), false);
  for (const [du, dv, w, h] of [[0, 0, 3.2, 9], [-4, 3, 2.4, 6], [4.5, -2, 2.2, 5.5], [2, 5, 2, 4.5], [-3, -4, 2.6, 5]]) {
    const [px, pz] = uv(92 + du, 12 + dv);
    const base = Math.sqrt(Math.max(0, 900 - (du * du + dv * dv))) * 0.62 - 4;
    b.add(new THREE.BoxGeometry(w, h, w), 0x7a5c4c, M(px, base + h / 2, pz), false);
    b.add(new THREE.ConeGeometry(w * 0.8, w * 0.9, 4), 0x8c6a50, M(px, base + h + w * 0.45, pz, Math.PI / 4), false);
    b.glow(new THREE.BoxGeometry(w * 0.35, 0.6, w * 0.35), 0xffc060, M(px, base + h * 0.7, pz));
  }
  const [sx, sz] = uv(150, 26);
  b.glow(new THREE.SphereGeometry(7.5, 12, 8), 0xffb060, M(sx, 26, sz));

  disposers.push(() => {
    sandMat.dispose();
    cartMat.dispose();
    oreMat.dispose();
    lampMat.dispose();
    weedMat.dispose();
  });

  let cartU = 10;
  let cartDir = -1;
  let weedX = -13;
  extras.push((dt, t, vfx) => {
    sandMat.uniforms.uTime.value = t;
    cartU += cartDir * dt * 2.4;
    if (cartU > 42) {
      cartU = 42;
      cartDir = -1;
    } else if (cartU < -14) {
      cartU = -14;
      cartDir = 1;
    }
    const [cx, cz] = uv(cartU, -10);
    cart.position.set(cx, 0, cz);
    lampMat.color.copy(lampBase).multiplyScalar(1.85 + 0.3 * Math.sin(t * 9.1) * Math.sin(t * 3.7 + 1.0) + 0.15 * Math.sin(t * 17.3));
    weedX += dt * 3.0;
    if (weedX > 19) weedX = -13;
    weed.position.set(weedX, 0.5 + Math.abs(Math.sin(t * 5.0)) * 0.25, -9);
    weed.rotation.z -= (dt * 3.0) / 0.55;
    // Dust drifting with the wind from the windward side of the canyon (behind the spirits), heat rising from the ground, sand grains being sucked in at the quicksand edge
    if (Math.random() < dt * 5) {
      vfx.smoke({ pos: new THREE.Vector3(-18 + Math.random() * 8, 0.3 + Math.random() * 1.2, -5 - Math.random() * 12), count: 1, color: [0xd9a878, 0xc9956a], speed: [1.5, 3], dir: new THREE.Vector3(1, 0.08, 0.1), spread: 0.25, life: [3, 5], size: [0.8, 1.4], sizeEnd: 2.4, drag: 0.15, intensity: 0.9 });
    }
    if (Math.random() < dt * 4) {
      vfx.emit({ pos: new THREE.Vector3((Math.random() - 0.5) * 30, 0.2, -6 - Math.random() * 14), count: 1, color: 0xffd9a6, speed: [0.5, 1.0], dir: new THREE.Vector3(0, 1, 0), spread: 0.15, life: [2.5, 4], size: [0.35, 0.6], sizeEnd: 2.5, drag: 0.1, intensity: 0.22 });
    }
    if (Math.random() < dt * 3) {
      vfx.smoke({ pos: new THREE.Vector3(qx + (Math.random() - 0.5) * 5.5, 0.15, qz + (Math.random() - 0.5) * 5.5), count: 1, color: 0xc9956a, speed: [0.2, 0.5], life: [1.5, 2.5], size: [0.25, 0.4], sizeEnd: 0.3, intensity: 0.8 });
    }
  });
}

export const canyon: RegionModule = {
  palette: {
    sky: ['#5a4a94', '#ee8f5a', '#ffd9a6'],
    fog: 0xf0c48e,
    fogNear: 34,
    fogFar: 175,
    ground: ['#d4a070', '#b47a52', '#f2d8a8'],
    light: [0.6, 0.55, 0.45],
    ambient: 0xc99a7c,
    rim: 0xffd6a0,
    shadow: 0x8c4d4a,
    motes: [0xf2c894, 0xe0a870],
    moteKind: 'drift',
  },
  build,
};
