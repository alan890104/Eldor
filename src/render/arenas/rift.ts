// Void Rift (final chapter): the wound left by the Night of the Shattered Heart. There is no horizon; the battlefield is a broken stone platform floating in the void,
// surrounded by rotating nebulae and torn space, slowly tumbling fragments, eroded ruins of the ancient kingdom and upside-down phantom buildings;
// the distant rift pulses like a heartbeat, and the cracks on the platform and the whole sky flicker with it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, type ArenaCtx, type PropBatch, type RegionModule } from '../arenaKit.ts';
import { inkScenery } from '../ink.ts';
import { sceneMaterial } from '../spiritToon.ts';

const STONE = 0x3a2a46;
const STONE_DARK = 0x2c1e38;
const SLAB = 0x241830;
const CRYSTAL_A = 0xff3a7a;
const CRYSTAL_B = 0xb04aff;

/** Heartbeat: two beats per group, period 1.35 s, 0 to 1 */
function heartbeat(t: number): number {
  const p = (t % 1.35) / 1.35;
  const beat = (c: number, w: number) => Math.exp(-((p - c) * (p - c)) / (w * w));
  return Math.min(1, beat(0.12, 0.05) + 0.55 * beat(0.34, 0.06));
}

// ───────────────────────── Shared GLSL ─────────────────────────

const GLSL_NOISE = /* glsl */ `
  float hash1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float hash3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float noise3(vec3 p){
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise3(p); p = p * 2.05 + vec3(3.1, 1.7, 9.2); a *= 0.5; } return v; }
  // 2D Voronoi: returns (nearest distance, second-nearest distance, hash of the nearest cell)
  vec3 voro2(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p); float f1 = 8.0; float f2 = 8.0; float id = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y)); vec2 o = vec2(hash1(i + g), hash1(i + g + 7.3));
      vec2 d = g + o - f; float dd = dot(d, d);
      if (dd < f1) { f2 = f1; f1 = dd; id = hash1(i + g + 3.1); } else if (dd < f2) { f2 = dd; }
    }
    return vec3(sqrt(f1), sqrt(f2), id);
  }
  // 3D Voronoi (for the sky rift)
  vec3 voro3(vec3 p){
    vec3 i = floor(p); vec3 f = fract(p); float f1 = 8.0; float f2 = 8.0; float id = 0.0;
    for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec3 g = vec3(float(x), float(y), float(z));
      vec3 o = vec3(hash3(i + g), hash3(i + g + 7.3), hash3(i + g + 2.9));
      vec3 d = g + o - f; float dd = dot(d, d);
      if (dd < f1) { f2 = f1; f1 = dd; id = hash3(i + g + 3.1); } else if (dd < f2) { f2 = dd; }
    }
    return vec3(sqrt(f1), sqrt(f2), id);
  }
`;

// ───────────────────────── Main platform ─────────────────────────

const SEG = 96;

/** The platform's jagged outer edge: angle → radius (about 7.8 to 12.6; one can stand anywhere within the battle area's radius of 6.5) */
function rimR(a: number): number {
  return 10.2 + Math.sin(a * 3 + 0.5) + 0.7 * Math.sin(a * 7 + 2) + 0.45 * Math.sin(a * 13 + 1) + 0.3 * Math.sin(a * 23);
}

/** Push a triangle into the array; the winding is chosen from a reference direction so the normal faces outward */
function pushTri(out: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ref: THREE.Vector3): void {
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  if (n.dot(ref) < 0) [b, c] = [c, b];
  out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
}

/** Platform top: a center fan + an outer ring band, the plane facing up */
function slabTopGeo(): THREE.BufferGeometry {
  const pos: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const center = new THREE.Vector3();
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * Math.PI * 2;
    const a1 = ((i + 1) / SEG) * Math.PI * 2;
    const r0 = rimR(a0);
    const r1 = rimR(a1);
    const p0 = new THREE.Vector3(Math.cos(a0) * r0, 0, Math.sin(a0) * r0);
    const p1 = new THREE.Vector3(Math.cos(a1) * r1, 0, Math.sin(a1) * r1);
    const m0 = p0.clone().multiplyScalar(0.5);
    const m1 = p1.clone().multiplyScalar(0.5);
    pushTri(pos, center, m0, m1, up);
    pushTri(pos, m0, p0, p1, up);
    pushTri(pos, m0, p1, m1, up);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Platform sides and the crumbling underside: ring after ring narrowing downward to a point, each ring's radius perturbed randomly so it looks like rock */
function slabBodyGeo(r: () => number): THREE.BufferGeometry {
  const levels: [number, number, number][] = [
    [0, 1.0, 0],
    [-1.4, 1.03, 0.18],
    [-3.2, 0.84, 0.3],
    [-5.6, 0.52, 0.3],
    [-8.2, 0.18, 0.15],
  ];
  const rings = levels.map(([y, s, j]) =>
    Array.from({ length: SEG }, (_, i) => {
      const a = (i / SEG) * Math.PI * 2;
      const rr = rimR(a) * s + (r() - 0.5) * 2 * j;
      return new THREE.Vector3(Math.cos(a) * rr, y + (r() - 0.5) * j, Math.sin(a) * rr);
    }),
  );
  const pos: number[] = [];
  const ref = new THREE.Vector3();
  for (let l = 0; l < rings.length - 1; l++) {
    const A = rings[l];
    const B = rings[l + 1];
    for (let i = 0; i < SEG; i++) {
      const j = (i + 1) % SEG;
      ref.set(A[i].x + A[j].x, 0, A[i].z + A[j].z);
      pushTri(pos, A[i], A[j], B[j], ref);
      pushTri(pos, A[i], B[j], B[i], ref);
    }
  }
  const apex = new THREE.Vector3(0, -9.6, 0);
  const last = rings[rings.length - 1];
  for (let i = 0; i < SEG; i++) {
    const j = (i + 1) % SEG;
    ref.set(last[i].x + last[j].x, -0.2, last[i].z + last[j].z);
    pushTri(pos, last[i], last[j], apex, ref);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Platform top: flagstone grid, with erosion cracks at the outer edge glowing with the heartbeat */
function slabTopMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uBeat: { value: 0 },
      uColA: { value: new THREE.Color(0x2e2238) },
      uColB: { value: new THREE.Color(0x1a1022) },
      uGlowA: { value: new THREE.Color(CRYSTAL_A) },
      uGlowB: { value: new THREE.Color(CRYSTAL_B) },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWp;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWp = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform float uBeat; uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uGlowA; uniform vec3 uGlowB;
      varying vec3 vWp;
      ${GLSL_NOISE}
      void main(){
        vec2 p = vWp.xz;
        float rr = length(p);
        vec3 v = voro2(p * 0.42);
        vec3 base = mix(uColA, uColB, 0.3 + 0.7 * v.z);
        float seam = smoothstep(0.08, 0.02, v.y - v.x);
        base *= 1.0 - 0.3 * seam;
        // Corrosion cracks: only at the outer rim, and only some cell edges light up, pulsing with the heartbeat
        vec3 c = voro2(p * 0.7 + 13.0);
        float ce = c.y - c.x;
        float crack = smoothstep(0.06, 0.0, ce);
        float mask = step(0.6, hash1(vec2(c.z * 91.0, 3.0)));
        float rimF = smoothstep(5.5, 11.0, rr);
        rimF *= rimF;
        float amt = crack * mask * (0.04 + 0.96 * rimF) * (0.35 + 0.65 * uBeat);
        vec3 gcol = mix(uGlowB, uGlowA, 0.5 + 0.5 * sin(c.z * 20.0));
        vec3 col = base + gcol * amt * 1.8 + gcol * exp(-ce * ce * 40.0) * mask * rimF * 0.4 * uBeat;
        col *= 0.8 + 0.2 * smoothstep(3.0, 9.0, rr);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}

// ───────────────────────── Floating fragments (InstancedMesh, rotation and bobbing computed on the CPU every frame) ─────────────────────────
// The outline pass only recognizes the mesh itself and instanceMatrix, and cannot see displacement in the vertex shader, so rotation and bobbing are done by updating the instance matrices.

/** Fragment part kinds: hexagonal shard, stone block, crystal (glowing), pillar stump; the geometry is all unit size, and the size is in the instance matrix */
type FragKind = 'hex' | 'rock' | 'crystal' | 'pillar';

/** Flat-shaded geometry: drop the original normals and recompute, one normal per face */
function faceted(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.computeVertexNormals();
  return g;
}

function fragGeo(kind: FragKind): THREE.BufferGeometry {
  if (kind === 'hex') return faceted(new THREE.CylinderGeometry(1, 0.35, 0.9, 6));
  if (kind === 'rock') return faceted(new THREE.DodecahedronGeometry(1, 0));
  if (kind === 'pillar') return faceted(new THREE.CylinderGeometry(0.34, 0.4, 1, 8));
  const g = new THREE.OctahedronGeometry(0.35);
  g.scale(0.6, 2.4, 0.6);
  return faceted(g);
}

/** One part: the matrix when the fragment has not yet rotated, the color, the center of the fragment it belongs to, and the animation [phase, spin speed, bobbing amplitude] */
interface FragPart {
  base: THREE.Matrix4;
  color: number;
  center: THREE.Vector3;
  anim: [number, number, number];
}

const _rot = new THREE.Matrix4();
const _rx = new THREE.Matrix4();
const _m = new THREE.Matrix4();

/** A group of animated fragments: parts of the same kind merge into one InstancedMesh */
class FragmentSet {
  private parts = new Map<FragKind, FragPart[]>();

  add(kind: FragKind, base: THREE.Matrix4, color: number, center: THREE.Vector3, anim: [number, number, number]): void {
    const list = this.parts.get(kind) ?? [];
    list.push({ base, color, center, anim });
    this.parts.set(kind, list);
  }

  /** Build the meshes (stone blocks outlined, crystals glowing and not outlined), and return the per-frame update */
  build(group: THREE.Group, disposers: (() => void)[]): (t: number) => void {
    const rockMat = sceneMaterial(0xffffff);
    // Crystal: unlit, with brightness >1 so bloom amplifies it (instance color × 2.2)
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2), toneMapped: false });
    const lined = new THREE.Group();
    group.add(lined);
    const sets: { mesh: THREE.InstancedMesh; parts: FragPart[] }[] = [];
    const c = new THREE.Color();
    for (const [kind, parts] of this.parts) {
      const geo = fragGeo(kind);
      // The outline is only computed within the screen extent of the ink-layer objects, taken from the geometry's bounding sphere; the fragments are scattered around the platform, so the bounding sphere must cover the whole ring
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 40);
      const mesh = new THREE.InstancedMesh(geo, kind === 'crystal' ? glowMat : rockMat, parts.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      parts.forEach((p, i) => mesh.setColorAt(i, c.set(p.color)));
      (kind === 'crystal' ? group : lined).add(mesh);
      sets.push({ mesh, parts });
    }
    inkScenery(lined);
    disposers.push(() => {
      rockMat.dispose();
      glowMat.dispose();
      for (const s of sets) s.mesh.dispose();
    });
    const update = (t: number) => {
      for (const { mesh, parts } of sets) {
        parts.forEach((p, i) => {
          const [ph, spin, bob] = p.anim;
          // Spin about the fragment's center (Y) and nod slightly (X), the whole piece bobbing up and down
          _rot.makeRotationY(ph + t * spin).multiply(_rx.makeRotationX(Math.sin(t * 0.31 + ph) * 0.16));
          _m.makeTranslation(p.center.x, p.center.y + Math.sin(t * 0.55 + ph * 1.7) * bob, p.center.z).multiply(_rot);
          _m.multiply(_rx.makeTranslation(-p.center.x, -p.center.y, -p.center.z)).multiply(p.base);
          mesh.setMatrixAt(i, _m);
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
    };
    update(0);
    return update;
  }
}

// ───────────────────────── Props ─────────────────────────

/** Broken pillar: shaft + capital (random height, can tilt) */
function stump(b: PropBatch, x: number, y: number, z: number, h: number, tilt: number, ry: number): void {
  const m = M(x, y + h / 2, z, ry, 1, tilt, 0);
  b.add(new THREE.CylinderGeometry(0.42, 0.5, h, 9), STONE, m);
  b.add(new THREE.BoxGeometry(1.15, 0.28, 1.15), STONE_DARK, M(x, y + 0.14, z, ry));
}

/** Fallen pillar: lying on its side, broken in two */
function fallenColumn(b: PropBatch, x: number, y: number, z: number, ry: number, len: number): void {
  const dx = Math.cos(ry);
  const dz = -Math.sin(ry);
  b.add(new THREE.CylinderGeometry(0.42, 0.42, len * 0.55, 9), STONE, M(x, y + 0.42, z, ry, 1, 0, Math.PI / 2));
  b.add(new THREE.CylinderGeometry(0.4, 0.42, len * 0.3, 9), STONE, M(x + dx * len * 0.5, y + 0.4, z + dz * len * 0.5, ry + 0.25, 1, 0.1, Math.PI / 2));
}

/** Broken arch: two pillars holding up half an arch ring */
function brokenArch(b: PropBatch, x: number, y: number, z: number, ry: number, s: number): void {
  const w = 1.6 * s;
  const dx = Math.cos(ry) * w;
  const dz = -Math.sin(ry) * w;
  stump(b, x - dx, y, z - dz, 3.2 * s, 0, ry);
  stump(b, x + dx, y, z + dz, 3.6 * s, 0, ry);
  const arc = new THREE.TorusGeometry(w, 0.32 * s, 8, 18, Math.PI * 0.72);
  b.add(arc, STONE, M(x, y + 3.5 * s, z, ry, 1, 0, 0.1));
}

/** Hexagonal stone island: wide on top and narrow below, with a flat top that can hold ruins */
function islandGeo(radius: number, height: number): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius, radius * 0.35, height, 6);
}

/** Ruins on the platform: broken colonnades and collapsed arches, avoiding the camera direction and the battle area */
function buildRuinsOnSlab(b: PropBatch, r: () => number): void {
  // Colonnade on the far side (-z): in the battle camera, the background behind the distant spirit
  const cols: [number, number, number][] = [
    [-6.2, -7.2, 2.6],
    [-3.4, -8.6, 3.4],
    [0.2, -9.2, 1.4],
    [3.8, -8.4, 3.9],
    [6.6, -6.8, 2.1],
  ];
  for (const [x, z, h] of cols) stump(b, x, 0, z, h, (r() - 0.5) * 0.14, r() * 6);
  b.add(new THREE.BoxGeometry(14.5, 0.35, 1.2), STONE_DARK, M(0.2, 0.17, -8.3, 0.05));
  brokenArch(b, 8.8, 0, -2.4, 1.1, 0.9);
  fallenColumn(b, 7.4, 0, 3.2, 0.5, 4.2);
  stump(b, -8.6, 0, -3.6, 1.6, 0.2, 0.7);
  stump(b, -9.4, 0, 0.6, 0.9, -0.15, 2.1);
  // Crystals on the crumbling edge
  const spots: [number, number][] = [[-8.9, 4.2], [9.6, -0.4], [-4.8, -9.6], [5.2, 8.6], [10.4, -4.6], [-9.8, -2.2], [2.4, 9.9]];
  for (const [x, z] of spots) {
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const g = new THREE.OctahedronGeometry(0.4);
      g.scale(0.6, 2.4, 0.6);
      const s = 0.7 + r() * 0.9;
      b.glow(g, r() < 0.55 ? CRYSTAL_A : CRYSTAL_B, M(x + (r() - 0.5) * 1.2, 0.6 * s, z + (r() - 0.5) * 1.2, r() * 6, s, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7));
    }
  }
}

/** Static large islands: hexagonal rocks carrying ruins, ringing the outside of the platform */
function buildIslands(b: PropBatch, r: () => number): void {
  const specs: [number, number, number, number, number][] = [
    // x, y (top), z, radius, thickness
    [-19, -1.5, -14, 4.6, 5],
    [21, 1.2, -9, 3.8, 4.2],
    [16, -3, 15, 3.4, 4],
    [-24, 0.5, 6, 3.6, 4.4],
    [4, -4.5, -25, 5, 6],
    [-8, 2.5, 25, 2.8, 3.2],
  ];
  specs.forEach(([x, y, z, rad, h], k) => {
    b.add(islandGeo(rad, h), SLAB, M(x, y - h / 2, z, r() * 6));
    const ry = r() * 6;
    if (k % 3 === 0) brokenArch(b, x + 0.6, y, z - 0.4, ry, 0.75 + r() * 0.3);
    else if (k % 3 === 1) {
      stump(b, x - rad * 0.4, y, z + 0.5, 1.4 + r() * 2.2, (r() - 0.5) * 0.2, ry);
      stump(b, x + rad * 0.35, y, z - 0.8, 0.8 + r() * 1.6, (r() - 0.5) * 0.2, ry);
      fallenColumn(b, x, y, z + rad * 0.45, ry, 2.6);
    } else {
      for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(2.4 - i * 0.5, 0.35, 1.2), STONE_DARK, M(x + i * 0.3, y + 0.17 + i * 0.35, z - rad * 0.3, ry));
      stump(b, x - rad * 0.3, y, z + rad * 0.3, 2.2, 0.1, ry);
    }
    for (let i = 0; i < 3; i++) {
      const g = new THREE.OctahedronGeometry(0.45);
      g.scale(0.6, 2.4, 0.6);
      const s = 0.8 + r() * 1.2;
      const a = r() * 6.28;
      b.glow(g, r() < 0.5 ? CRYSTAL_A : CRYSTAL_B, M(x + Math.cos(a) * rad * 0.7, y + 0.6 * s, z + Math.sin(a) * rad * 0.7, r() * 6, s, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8));
    }
  });
  // Fragments of an inverted world: overturned ground hung high up, with pillars hanging upside down
  const inverted: [number, number, number, number][] = [
    [-15, 17, -21, 3.2],
    [19, 15, -14, 2.6],
    [7, 20, 23, 2.4],
    [-22, 13, 12, 2.2],
  ];
  for (const [x, y, z, rad] of inverted) {
    const g = islandGeo(rad, rad * 1.1);
    b.add(g, SLAB, M(x, y + rad * 0.55, z, r() * 6, 1, Math.PI));
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28;
      const h = 1.2 + r() * 2;
      const cx = x + Math.cos(a) * rad * 0.5;
      const cz = z + Math.sin(a) * rad * 0.5;
      b.add(new THREE.CylinderGeometry(0.42, 0.36, h, 9), STONE, M(cx, y - h / 2, cz, 0, 1, (r() - 0.5) * 0.1));
      b.add(new THREE.BoxGeometry(1.1, 0.26, 1.1), STONE_DARK, M(cx, y - 0.13, cz));
    }
    const c = new THREE.OctahedronGeometry(0.5);
    c.scale(0.6, 2.4, 0.6);
    b.glow(c, CRYSTAL_B, M(x, y - 1.2, z, 0, 1.2, Math.PI));
  }
}

/** Animated fragments: stone blocks and hexagonal shards, carrying crystals or pillar stumps; returns the per-frame update */
function buildFragments(group: THREE.Group, r: () => number, disposers: (() => void)[]): (t: number) => void {
  const set = new FragmentSet();
  const S = new THREE.Matrix4();
  for (let i = 0; i < 44; i++) {
    let x = 0;
    let z = 0;
    let d = 0;
    for (;;) {
      const a = r() * Math.PI * 2;
      d = 13.5 + r() * 21;
      x = Math.cos(a) * d;
      z = Math.sin(a) * d;
      // The camera is on the -x / +z side (distance 13 to 16): in that direction only farther fragments are placed
      if (x < 3 && z > 3 && d < 21) continue;
      break;
    }
    const y = -7 + r() * 15;
    const s = 0.7 + r() * 2.2;
    const c = new THREE.Vector3(x, y, z);
    const anim: [number, number, number] = [r() * 6.28, (r() - 0.5) * 0.22, 0.2 + r() * 0.5];
    const col = [0x2a1c34, 0x352440, SLAB][Math.floor(r() * 3)];
    const hex = r() < 0.6;
    set.add(hex ? 'hex' : 'rock', M(x, y, z, r() * 6, 1, hex ? (r() - 0.5) * 0.3 : r() * 3, hex ? (r() - 0.5) * 0.3 : r() * 3).multiply(S.makeScale(s, s, s)), col, c, anim);
    const top = y + (hex ? s * 0.45 : s * 0.6);
    if (r() < 0.6) {
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const cs = 0.6 + r() * s * 0.5;
        set.add('crystal', M(x + (r() - 0.5) * s * 0.8, top + 0.55 * cs, z + (r() - 0.5) * s * 0.8, r() * 6, cs, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7), r() < 0.55 ? CRYSTAL_A : CRYSTAL_B, c, anim);
      }
    } else if (hex && s > 1.4) {
      const h = 0.8 + r() * 1.6;
      set.add('pillar', M(x, top + h / 2, z, 0, 1, (r() - 0.5) * 0.2).multiply(S.makeScale(1, h, 1)), STONE, c, anim);
    }
  }
  return set.build(group, disposers);
}

/** Phantom buildings: translucent, additive-blended outlines of the ancient kingdom, some hung upside down high up, flickering like a bad signal */
function buildPhantoms(group: THREE.Group, r: () => number, disposers: (() => void)[]): THREE.ShaderMaterial {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, m: THREE.Matrix4) => {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(ng.attributes)) if (k !== 'position' && k !== 'normal') ng.deleteAttribute(k);
    ng.applyMatrix4(m);
    parts.push(ng);
  };
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2;
    // Nothing is placed in front of the big rift directly ahead, so it is not blocked
    if (Math.abs(Math.atan2(Math.sin(a + 1.45), Math.cos(a + 1.45))) < 0.32) continue;
    const d = 40 + r() * 36;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const inv = r() < 0.35;
    const h = 8 + r() * 20;
    const w = 2 + r() * 3;
    const base = inv ? 46 : -6 + r() * 4;
    const dir = inv ? -1 : 1;
    const ry = r() * 6;
    add(new THREE.BoxGeometry(w, h, w), M(x, base + (dir * h) / 2, z, ry));
    if (r() < 0.6) add(new THREE.CylinderGeometry(w * 0.3, w * 0.3, h * 0.5, 8), M(x + w * 0.4, base + dir * (h + h * 0.25), z, ry));
    if (r() < 0.5) add(new THREE.ConeGeometry(w * 0.5, h * 0.35, 4), M(x - w * 0.2, base + dir * (h + h * 0.17), z, ry, 1, inv ? Math.PI : 0));
    if (r() < 0.5) add(new THREE.TorusGeometry(w * 0.9, w * 0.12, 6, 16), M(x, base + dir * h * 1.1, z, 0, 1, Math.PI / 2));
  }
  const geo = mergeGeometries(parts);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x8a5aff) } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vY = wp.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){
        vec3 n = normalize(vN);
        float fres = pow(clamp(1.0 - abs(dot(n, normalize(vV))), 0.0, 1.0), 2.0);
        float scan = 0.7 + 0.3 * sin(vY * 2.2 - uTime * 1.6);
        float flick = 0.72 + 0.28 * sin(uTime * 6.3 + vY * 0.4) * sin(uTime * 2.7);
        float a = (0.025 + 0.2 * fres) * scan * flick;
        gl_FragColor = vec4(uColor * 1.3, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  if (geo) {
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
  }
  disposers.push(() => mat.dispose());
  return mat;
}

/** Nebula sky shell: wraps the inside of the sky dome, a rotating purple-red nebula + Voronoi cracks that brighten with the heartbeat */
function buildNebula(group: THREE.Group, disposers: (() => void)[]): { mesh: THREE.Mesh; mat: THREE.ShaderMaterial } {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBeat: { value: 0 },
      uCol1: { value: new THREE.Color(0x0a0428) },
      uCol2: { value: new THREE.Color(0x521458) },
      uCol3: { value: new THREE.Color(0xd8305c) },
      uCrack: { value: new THREE.Color(0xff78c0) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uBeat; uniform vec3 uCol1; uniform vec3 uCol2; uniform vec3 uCol3; uniform vec3 uCrack;
      varying vec3 vDir;
      ${GLSL_NOISE}
      void main(){
        vec3 d = normalize(vDir);
        // Rotation speed differs by height → overhead it forms a vortex
        float ang = uTime * 0.02 + d.y * 1.6;
        vec3 s = vec3(cos(ang) * d.x - sin(ang) * d.z, d.y, sin(ang) * d.x + cos(ang) * d.z);
        float n = fbm3(s * 2.6 + 0.45 * fbm3(s * 3.3 + uTime * 0.03));
        float dens = smoothstep(0.36, 0.74, n);
        vec3 col = mix(uCol1, uCol2, dens);
        col = mix(col, uCol3, smoothstep(0.64, 0.9, n) * (0.7 + 0.3 * uBeat));
        // The dark parts also cover some of the sky base color so the light and dark structure of the vortex stays visible
        float alpha = 0.35 + 0.6 * dens;
        // Spatial cracks: thin and sparse, lighting up on the heartbeat
        vec3 v = voro3(d * 4.0);
        float e = v.y - v.x;
        float mask = step(0.8, hash3(vec3(v.z * 71.0, 1.0, 2.0)));
        float line = smoothstep(0.024, 0.0, e) * mask;
        float halo = exp(-e * e * 120.0) * mask * 0.25;
        float pulse = 0.4 + 0.9 * uBeat;
        col += uCrack * (line * 1.1 + halo) * pulse;
        alpha = max(alpha, (line + halo * 0.6) * min(1.0, pulse));
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(160, 48, 24), mat);
  mesh.frustumCulled = false;
  group.add(mesh);
  disposers.push(() => mat.dispose());
  return { mesh, mat };
}

/** Rift: an upright glowing crack, white in the center and purple-red at the edge, with threads of light flowing upward, pulsing with the heartbeat */
function tearMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBeat: { value: 0 }, uAspect: { value: 0.68 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uBeat; uniform float uAspect; varying vec2 vUv;
      ${GLSL_NOISE}
      void main(){
        float v = vUv.y;
        float px = (vUv.x - 0.5) * uAspect;
        float py = v - 0.5;
        float cx = 0.04 * sin(v * 6.0 + 1.0) + 0.02 * sin(v * 15.0 + uTime * 0.5) + 0.008 * sin(v * 41.0);
        float env = pow(max(sin(3.14159 * v), 0.0), 0.5);
        float w = 0.05 * env * (0.7 + 0.6 * noise3(vec3(v * 9.0, uTime * 0.6, 1.0)));
        float dx = abs(px - cx);
        float core = smoothstep(w, w * 0.2, dx);
        float fil = fbm3(vec3(vUv.x * 7.0, v * 9.0 - uTime * 0.45, 2.0));
        float glow = exp(-dx * dx / (w * w * 26.0 + 0.0004)) * (0.5 + 0.7 * fil) * env;
        float halo = exp(-(dx * dx * 12.0 + py * py * 5.0)) * 0.45 * (0.6 + 0.6 * fil);
        float pulse = 1.0 + 0.9 * uBeat;
        vec3 col = vec3(1.0, 0.86, 0.95) * core * 2.2 + vec3(1.0, 0.3, 0.6) * glow * 1.4 + vec3(0.8, 0.18, 0.55) * halo;
        col *= pulse;
        gl_FragColor = vec4(col, min(1.0, core + glow * 0.8 + halo));
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ───────────────────────── Arena ─────────────────────────

function build(ctx: ArenaCtx): void {
  const { group, b, r, extras, disposers, ground, far } = ctx;
  // No horizon: turn off the shared ground and distant-ground ring and use the floating platform instead
  ground.visible = false;
  far.visible = false;

  b.add(slabBodyGeo(r), SLAB, new THREE.Matrix4());
  const topMat = slabTopMaterial();
  const top = new THREE.Mesh(slabTopGeo(), topMat);
  top.position.y = 0.005;
  group.add(top);
  disposers.push(() => topMat.dispose());

  buildRuinsOnSlab(b, r);
  buildIslands(b, r);
  const frag = buildFragments(group, r, disposers);
  const phantom = buildPhantoms(group, r, disposers);
  const nebula = buildNebula(group, disposers);

  // Rifts: one big one directly ahead and two small ones at the sides and rear, so the wound is visible wherever an ultimate's camera move turns
  const tearMat = tearMaterial();
  const tears: [number, number, number, number, number][] = [
    [14, 3, -112, 30, 44],
    [-80, 6, 58, 16, 26],
    [66, 12, 66, 13, 22],
  ];
  for (const [x, y, z, w, h] of tears) {
    const mat = tearMat.clone();
    mat.uniforms.uAspect.value = w / h;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.lookAt(0, y, 0);
    m.frustumCulled = false;
    group.add(m);
    disposers.push(() => mat.dispose());
    extras.push((_dt, t) => {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uBeat.value = heartbeat(t);
    });
  }
  tearMat.dispose();

  let ashT = 0;
  extras.push((dt, t, vfx) => {
    const beat = heartbeat(t);
    topMat.uniforms.uTime.value = t;
    topMat.uniforms.uBeat.value = beat;
    frag(t);
    phantom.uniforms.uTime.value = t;
    nebula.mat.uniforms.uTime.value = t;
    nebula.mat.uniforms.uBeat.value = beat;
    nebula.mesh.rotation.y = t * 0.004;
    // Black ash drifts up from the cracks (normal blending, so it can be darker than the background), with an occasional bit of red light
    ashT += dt;
    while (ashT > 0.09) {
      ashT -= 0.09;
      const a = Math.random() * Math.PI * 2;
      const d = 3 + Math.random() * 9;
      const pos = new THREE.Vector3(Math.cos(a) * d, -0.3, Math.sin(a) * d);
      vfx.smoke({ pos, count: 1, color: [0x07030c, 0x120818], speed: [0.25, 0.7], dir: new THREE.Vector3(0.15, 1, 0.05), spread: 0.35, life: [3.5, 6], size: [0.18, 0.36], sizeEnd: 0.5, drag: 0.02, intensity: 1 });
      if (Math.random() < 0.25) vfx.emit({ pos: pos.clone().setY(0.1), count: 1, color: [CRYSTAL_A, 0xff8ab0], speed: [0.3, 0.8], dir: new THREE.Vector3(0, 1, 0), spread: 0.4, life: [2, 3.5], size: [0.06, 0.12], sizeEnd: 0.4, intensity: 1.6 });
    }
  });
}

export const rift: RegionModule = {
  palette: {
    sky: ['#03010a', '#140620', '#4a1038'],
    fog: 0x160a20,
    fogNear: 18,
    fogFar: 95,
    // The ground is hidden, so this set of colors only affects the hemisphere light and the magic circle (bright line color = the magic circle)
    ground: ['#2a1a2e', '#150a18', '#ff3a7a'],
    light: [0.35, 0.8, 0.45],
    ambient: 0x6a4870,
    rim: 0xff8ac8,
    shadow: 0x2a0a34,
    motes: [0xff3a7a, 0xb04aff],
    moteKind: 'rise',
    stars: true,
  },
  build,
};
