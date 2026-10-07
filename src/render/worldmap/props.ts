// Assembly environment and shared small props for the world map islands: trees, pines, houses, rocks, palms, lamp posts, plus the Seal Tower's source crystal, corruption vortex and the post-clear light pillar.

import * as THREE from 'three';
import { inkScenery } from '../ink.ts';
import { sceneMaterial } from '../spiritToon.ts';
import type { Vfx } from '../vfx.ts';
import { CORRUPT, M, MapBatch, miniTower, type BodySpec, type Look, type Outline, type TowerStyle } from './kit.ts';

export interface MapIsland {
  id: string;
  pos: THREE.Vector3;
  element: import('../../../sim/types.ts').Element | null;
  locked: boolean;
  cleared: boolean;
  /** Current adventure objective (shows the light pillar) */
  current?: boolean;
}

/** The assembly environment of one island (local coordinates: +z faces the camera, -z is north) */
export interface IsleCtx {
  b: MapBatch;
  /** The island's root node: animated meshes are added directly here */
  g: THREE.Group;
  r: () => number;
  /** Top surface height */
  y: (x: number, z: number) => number;
  /** Inside the top surface contour (with a margin of margin from the edge) */
  inside: (x: number, z: number, margin?: number) => boolean;
  /** A prop's contact shadow */
  foot: (x: number, z: number, r: number, k?: number) => void;
  def: MapIsland;
  look: Look;
  low: boolean;
  vfx: Vfx;
  /** Per-frame update (dt is the effect clock step, t is the scene time, w is the island's position in the world) */
  anim: ((dt: number, t: number, w: THREE.Vector3) => void)[];
  /** Record the Seal Tower's top (in this environment's local coordinates), where the beacon aims */
  setTowerTop: (v: THREE.Vector3) => void;
  /** The currently recorded tower top (in this environment's local coordinates) */
  getTowerTop: () => THREE.Vector3;
  /** Register the top surface height of a platform (plateau, rock pillar), so props placed on it later stand on top */
  plat: (o: Outline, x: number, z: number, y1: number) => void;
  /** A small floating island beside the island (its own set of meshes, each undulating on its own); returns its assembly environment */
  sub: (spec: BodySpec, x: number, y: number, z: number, bob?: number) => IsleCtx;
  /** Apply the island tint (faded when locked) to a color */
  tint: (hex: number) => THREE.Color;
  /** Animated single-color mesh: the same material and island tint as the static parts */
  mesh: (geo: THREE.BufferGeometry, color: number, lined?: boolean, heavy?: boolean) => THREE.Mesh;
  /** Animated glowing mesh */
  glowMesh: (geo: THREE.BufferGeometry, color: number, k?: number, additive?: boolean) => THREE.Mesh;
}

export interface RegionDef {
  look: Look;
  body: BodySpec;
  build(ctx: IsleCtx): void;
  /** Where the name plate hangs under the island (local coordinates); by default the lower of the rock cone tip and the island edge straight ahead */
  label?: [number, number, number];
  /** Put the name plate on the side of the island instead (-1 left, 1 right): used when other islands sit directly above and below, with the plate in the empty space on the inner side */
  side?: -1 | 1;
}

// ───────────────────────── Shared small props ─────────────────────────

export function tree(ctx: IsleCtx, x: number, z: number, s: number, leaves: number[], trunk = 0x6a4a32): void {
  const { b, r } = ctx;
  const y = ctx.y(x, z);
  b.add(new THREE.CylinderGeometry(0.035, 0.055, 0.3, 6), trunk, M(x, y + 0.15 * s, z, 0, s));
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28;
    const rr = i === 0 ? 0 : 0.09;
    b.add(new THREE.IcosahedronGeometry(0.2 - i * 0.03, 1), leaves[i % leaves.length], M(x + Math.cos(a) * rr * s, y + (0.36 + i * 0.1) * s, z + Math.sin(a) * rr * s, a, s));
  }
  ctx.foot(x + 0.05, z + 0.04, 0.26 * s, 0.35);
}

export function pine(ctx: IsleCtx, x: number, z: number, s: number, leaf: number, trunk = 0x5a4030): void {
  const y = ctx.y(x, z);
  ctx.b.add(new THREE.CylinderGeometry(0.03, 0.045, 0.14, 6), trunk, M(x, y + 0.07 * s, z, 0, s));
  for (let i = 0; i < 3; i++) ctx.b.add(new THREE.ConeGeometry(0.19 - i * 0.045, 0.24, 7), leaf, M(x, y + (0.2 + i * 0.12) * s, z, i, s));
  ctx.foot(x + 0.04, z + 0.03, 0.2 * s, 0.35);
}

export function rock(ctx: IsleCtx, x: number, z: number, s: number, col: number): void {
  const r = ctx.r;
  ctx.b.add(new THREE.DodecahedronGeometry(0.12, 0), col, M(x, ctx.y(x, z) + 0.04 * s, z, r() * 6, s, r() * 0.4, r() * 0.4));
  ctx.foot(x, z, 0.16 * s, 0.25);
}

/** Gabled roof (a triangular prism running along the x axis) */
export function gableGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}

export type RoofKind = 'gable' | 'hip' | 'cone' | 'dome' | 'flat';

/** Small house: walls and a roof, with roof choosing the roof shape */
export function house(ctx: IsleCtx, x: number, z: number, ry: number, w: number, d: number, h: number, wall: number, roofCol: number, roof: RoofKind = 'gable', y0?: number): void {
  const b = ctx.b;
  const y = y0 ?? ctx.y(x, z);
  const base = M(x, y, z, ry);
  const at = (px: number, py: number, pz: number, rot = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().multiplyMatrices(base, new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(sx, sy, sz)));
  if (roof === 'cone' || roof === 'dome') {
    b.add(new THREE.CylinderGeometry(w / 2, w / 2 * 1.04, h, 10), wall, at(0, h / 2 - 0.02, 0));
    if (roof === 'cone') b.add(new THREE.ConeGeometry(w / 2 * 1.25, h * 0.9, 10), roofCol, at(0, h + h * 0.43, 0));
    else b.add(new THREE.SphereGeometry(w / 2 * 1.02, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), roofCol, at(0, h - 0.01, 0));
  } else {
    b.add(new THREE.BoxGeometry(w, h, d), wall, at(0, h / 2 - 0.02, 0));
    if (roof === 'gable') b.add(gableGeo(w * 1.16, h * 0.62, d * 1.12), roofCol, at(0, h - 0.01, 0, Math.PI / 2 * 0));
    else if (roof === 'hip') b.add(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.65, 4), roofCol, at(0, h + h * 0.3, 0, Math.PI / 4, w / Math.max(w, d), 1, d / Math.max(w, d)));
    else b.add(new THREE.BoxGeometry(w * 1.08, 0.03, d * 1.08), roofCol, at(0, h, 0));
  }
  ctx.foot(x + 0.03, z + 0.03, Math.max(w, d) * 0.9, 0.3);
}

/** Part matrix pointing from a toward b (the part runs along its own +y axis) */
export function along(a: THREE.Vector3, b: THREE.Vector3, s = 1): THREE.Matrix4 {
  const d = new THREE.Vector3().subVectors(b, a);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(s, s, s));
}

/** Palm: a trunk curving toward lean, and a ring of drooping leaves */
export function palm(ctx: IsleCtx, x: number, z: number, s: number, lean: number): void {
  const b = ctx.b;
  const dx = Math.cos(lean);
  const dz = Math.sin(lean);
  let p = new THREE.Vector3(x, ctx.y(x, z), z);
  for (let i = 0; i < 4; i++) {
    const off = 0.025 * (i + 1) * s;
    const n = new THREE.Vector3(p.x + dx * off, p.y + 0.12 * s, p.z + dz * off);
    const seg = new THREE.CylinderGeometry(0.024 * s, 0.03 * s, n.distanceTo(p) + 0.01, 6);
    b.add(seg, 0x8a6a48, along(p, n));
    p = n;
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + lean;
    const tip = new THREE.Vector3(p.x + Math.cos(a) * 0.24 * s, p.y - 0.08 * s, p.z + Math.sin(a) * 0.24 * s);
    const leaf = new THREE.ConeGeometry(0.045 * s, tip.distanceTo(p), 4);
    leaf.rotateY(Math.PI / 4);
    leaf.scale(1, 1, 0.4);
    b.add(leaf, k % 2 ? 0x3f9a4a : 0x55b050, along(p, tip));
  }
  ctx.foot(x, z, 0.22 * s, 0.3);
}

// ───────────────────────── Seal Tower states ─────────────────────────

/** Corruption vortex wrapped around the tower top (normal blending, dark purple with bright streaks) */
export function vortexMaterial(amt: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uAmt: { value: amt } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uAmt; varying vec2 vUv;
      void main(){
        float bands = sin(vUv.x * 6.2831 * 3.0 + vUv.y * 7.0 - uTime * 1.8) * 0.5 + 0.5;
        float wisps = sin(vUv.x * 6.2831 * 5.0 - vUv.y * 4.0 + uTime * 2.4) * 0.5 + 0.5;
        float a = smoothstep(0.35, 0.9, bands * 0.7 + wisps * 0.45) * sin(vUv.y * 3.14159);
        vec3 col = mix(vec3(0.2, 0.05, 0.3), vec3(0.8, 0.3, 1.0), wisps * bands);
        gl_FragColor = vec4(col, a * 0.8 * uAmt);
      }`,
  });
}

/** Pale light pillar rising from the tower top after clearing (additive blending) */
export function beamMaterial(color: number, amt: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAmt: { value: amt } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform float uAmt; varying vec2 vUv;
      void main(){
        float edge = pow(max(sin(vUv.x * 3.14159), 0.0), 2.0);
        float streak = 0.75 + 0.25 * sin(vUv.y * 30.0 - uTime * 4.0 + vUv.x * 12.0);
        float fade = smoothstep(1.0, 0.1, vUv.y) * smoothstep(0.0, 0.08, vUv.y);
        gl_FragColor = vec4(uColor * streak * edge * fade * uAmt, 1.0);
      }`,
  });
}

/** Seal Tower: the static body goes into the batch; the source crystal, vortex or light pillar are animated meshes */
export function placeTower(ctx: IsleCtx, x: number, z: number, st: TowerStyle, s: number, ry = 0, yOff = 0): void {
  const cleared = ctx.def.cleared;
  const top = miniTower(ctx.b, x, ctx.y(x, z) + yOff, z, st, s, cleared, ry);
  ctx.foot(x, z, 0.5 * s, 0.35);
  ctx.setTowerTop(top);
  const cg = new THREE.OctahedronGeometry(0.1 * s);
  cg.scale(0.7, 1.5, 0.7);
  const crystal = ctx.glowMesh(cg, cleared ? st.glow : st.glow, cleared ? 2.4 : 0.7);
  crystal.position.copy(top);
  const anim = ctx.anim;
  if (cleared) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.1 * s, 2.6, 10, 1, true), beamMaterial(st.glow, ctx.def.locked ? 0.3 : 0.9));
    beam.position.copy(top).add(new THREE.Vector3(0, 1.35, 0));
    ctx.g.add(beam);
    anim.push((_dt, t) => ((beam.material as THREE.ShaderMaterial).uniforms.uTime.value = t));
  } else {
    const vm = vortexMaterial(ctx.def.locked ? 0.45 : 1);
    const vortex = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * s, 0.14 * s, 0.55 * s, 20, 1, true), vm);
    vortex.position.copy(top).add(new THREE.Vector3(0, -0.28 * s, 0));
    ctx.g.add(vortex);
    anim.push((dt, t) => {
      vm.uniforms.uTime.value = t;
      vortex.rotation.y -= dt * 0.5;
    });
  }
  const y0 = top.y;
  anim.push((dt, t) => {
    crystal.rotation.y += dt * 0.9;
    crystal.position.y = y0 + Math.sin(t * 1.3 + x) * 0.04;
  });
}

/** Material for animated meshes: the island's single-color toon material */
export function lookMaterial(color: THREE.Color, look: Look, rim = 0.35): THREE.MeshToonMaterial {
  const m = sceneMaterial(color, { rim });
  m.uniforms.uAmbient = { value: new THREE.Color(look.ambient) };
  m.uniforms.uShadowTint = { value: new THREE.Color(look.shadow) };
  m.uniforms.uRimColor = { value: new THREE.Color(look.rim) };
  return m;
}

export function lineMesh(m: THREE.Mesh, heavy = false): THREE.Mesh {
  inkScenery(m, heavy ? { heavy: true } : {});
  return m;
}

export { CORRUPT };
