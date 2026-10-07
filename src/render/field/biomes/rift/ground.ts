// The land breaking apart: light seeping out of ground cracks (sharing the terrain mesh directly, additive blending,
// pulsing with the heartbeat), plus collision circles generated automatically along every cliff edge (so nothing can walk off
// into the void) and the rubble, crystals and broken railings at the cliff edge.

import * as THREE from 'three';
import { M, rng } from '../../../arenaKit.ts';
import type { FieldCtx } from '../../kit.ts';
import { ADD_FOG_FRAG, ADD_FOG_PARS, ADD_FOG_VERT, ADD_FOG_VERT_PARS, additive, crackTexture, type RiftClock } from './glsl.ts';
import { BASIN, CRATER, FIELD, ISLE, land, RIN, sm, T, TOWN } from './shape.ts';
import { COL, crystalCluster } from './props.ts';

/**
 * Strength of the ground cracks (0 to 1): cliff edges, the Fractured Field, the basin, pits, scattered patches;
 * faded out over towns and roads (d is land(x, z))
 */
function crackMask(ctx: FieldCtx, x: number, z: number, d: number): number {
  if (d < -1) return 0;
  const n = Math.sin(x * 0.031 + Math.sin(z * 0.023) * 2.2) * Math.cos(z * 0.027 - Math.sin(x * 0.019) * 1.7);
  let m = (1 - sm(0.5, 8, d)) * 0.8;
  m = Math.max(m, 1 - sm(4, 22, Math.hypot(x - FIELD[0], z - FIELD[1])));
  m = Math.max(m, (1 - sm(6, 26, Math.hypot(x - BASIN[0], z - BASIN[1]))) * 0.75);
  m = Math.max(m, (1 - sm(4, 17, Math.hypot(x - CRATER[0], z - CRATER[1]))) * 0.9);
  m = Math.max(m, (1 - sm(4, 14, Math.hypot(x - ISLE[0], z - ISLE[1]))) * 0.7);
  const rT = Math.hypot(x - T[0], z - T[1]);
  if (rT < RIN + 3) m = Math.max(m, 0.6 * sm(16, 21, rT));
  m = Math.max(m, 0.5 * sm(0.45, 0.85, n));
  m *= sm(17, 30, Math.hypot(x - TOWN[0], z - TOWN[1]));
  const pd = ctx.pathDist(x, z);
  m *= 0.4 + 0.6 * sm(ctx.layout.pathW - 0.5, ctx.layout.pathW + 1.5, pd);
  return m;
}

const maskCache = new WeakMap<object, Uint8Array>();

export function groundCracks(ctx: FieldCtx, clock: RiftClock, erode?: { value: THREE.Vector4 }): void {
  const S = ctx.layout.size;
  const N = 256;
  // The mask depends only on the map: compute it once per map and keep it (no need to recompute when re-entering the Rift)
  let data = maskCache.get(ctx.layout);
  if (!data) {
    data = new Uint8Array(N * N * 4);
    // land() is a smooth distance field: sample it on a grid twice as coarse, then interpolate
    const H = N / 2 + 1;
    const lg = new Float32Array(H * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < H; i++) lg[j * H + i] = land(-S + ((i * 2 + 0.5) / N) * 2 * S, -S + ((j * 2 + 0.5) / N) * 2 * S);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -S + ((i + 0.5) / N) * 2 * S;
        const z = -S + ((j + 0.5) / N) * 2 * S;
        const i0 = i >> 1;
        const j0 = j >> 1;
        const fi = (i & 1) * 0.5;
        const fj = (j & 1) * 0.5;
        const i1 = Math.min(H - 1, i0 + 1);
        const j1 = Math.min(H - 1, j0 + 1);
        const d = (lg[j0 * H + i0] * (1 - fi) + lg[j0 * H + i1] * fi) * (1 - fj) + (lg[j1 * H + i0] * (1 - fi) + lg[j1 * H + i1] * fi) * fj;
        const k = (j * N + i) * 4;
        data[k] = Math.round(Math.min(1, crackMask(ctx, x, z, d)) * 255);
        data[k + 3] = 255;
      }
    }
    maskCache.set(ctx.layout, data);
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const crack = crackTexture(512, 14, 36);
  const mat = additive({
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: clock.uTime, uBeat: clock.uBeat, uCalm: clock.uCalm, uErode: erode ?? { value: new THREE.Vector4() }, uMask: { value: tex }, uCrack: { value: crack }, uSize: { value: S } },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying float vUp;
      ${ADD_FOG_VERT_PARS}
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vUp = normalize(mat3(modelMatrix) * normal).y;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        ${ADD_FOG_VERT}
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uBeat; uniform float uCalm; uniform vec4 uErode; uniform sampler2D uMask; uniform sampler2D uCrack; uniform float uSize;
      varying vec3 vW; varying float vUp;
      ${ADD_FOG_PARS}
      void main(){
        vec2 uv = (vW.xz + uSize) / (2.0 * uSize);
        // Cracks projected from above onto steep walls would stretch into messy lines: keep them on flat ground and gentle slopes only
        float m = texture2D(uMask, uv).r * smoothstep(0.72, 0.9, vUp);
        if (m < 0.02) discard;
        vec2 p = vW.xz;
        // Precomputed Voronoi cracks (one 63 m seamless texture): r line, g glow, b cell index, a fine cracks
        vec4 c = texture2D(uCrack, p / 63.0);
        float id = c.b;
        float sel = step(1.0 - m * 0.9, fract(id * 57.13 + 0.31));
        float crack1 = smoothstep(0.55 - 0.4 * m, 0.95, c.r) * sel;
        float halo1 = c.g * c.g * sel * 0.3;
        float crack2 = c.a * smoothstep(0.5, 0.9, m) * 0.8;
        vec3 c1 = vec3(0.0, 0.0, id);
        // Light flows along the cracks
        float flow = 0.55 + 0.45 * sin(uTime * 1.3 - dot(p, vec2(0.11, 0.07)) + c1.z * 6.28);
        float a = (crack1 * 1.4 + halo1 + crack2 * 0.7) * flow * (0.6 + 0.4 * m);
        // The Void Blight erosion area of the engine already has its own cracks, so these yield there; everything calms down after the seal
        float ero = uErode.z > 0.0 ? smoothstep(uErode.z, uErode.z * 0.75, length(vW.xz - uErode.xy)) : 0.0;
        a *= (1.0 - 0.75 * ero) * (1.0 - 0.6 * uCalm);
        vec3 col = mix(vec3(0.62, 0.2, 1.0), vec3(1.0, 0.22, 0.55), c1.z);
        col = mix(col, vec3(1.0, 0.8, 0.95), crack1 * 0.35);
        gl_FragColor = vec4(col * a * (0.5 + 0.8 * uBeat), 1.0);
        ${ADD_FOG_FRAG}
      }`,
  });
  const mesh = new THREE.Mesh(ctx.terrain.mesh.geometry, mat);
  mesh.position.copy(ctx.terrain.mesh.position);
  mesh.renderOrder = 1;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    mat.dispose();
    tex.dispose();
    crack.dispose();
  });
}

/**
 * Collision at cliff edges: on a 1.2 meter grid, find points that are themselves flat but have a drop of more than 4 meters
 * within 1.8 meters, and place a collision circle there.
 * The character, partners and wild spirits cannot walk off into the void.
 * Returns these points (the positions for the cliff-edge props).
 */
export function rimGuard(ctx: FieldCtx): [number, number][] {
  const S = ctx.layout.size - 2;
  const out: [number, number][] = [];
  const step = 1.2;
  const reach = 1.8;
  const dirs: [number, number][] = [];
  for (let i = 0; i < 12; i++) dirs.push([Math.cos((i / 12) * Math.PI * 2) * reach, Math.sin((i / 12) * Math.PI * 2) * reach]);
  for (let z = -S; z <= S; z += step) {
    for (let x = -S; x <= S; x += step) {
      const h0 = ctx.h(x, z);
      if (h0 < -14) continue;
      // Points that sit on the cliff face itself need no circle (they cannot be reached)
      if (Math.abs(ctx.h(x + 0.8, z) - h0) > 1.6 || Math.abs(ctx.h(x - 0.8, z) - h0) > 1.6 || Math.abs(ctx.h(x, z + 0.8) - h0) > 1.6 || Math.abs(ctx.h(x, z - 0.8) - h0) > 1.6) continue;
      let drop = false;
      for (const [dx, dz] of dirs) {
        if (ctx.h(x + dx, z + dz) < h0 - 4) {
          drop = true;
          break;
        }
      }
      if (!drop) continue;
      ctx.solids.add(x, z, 0.85);
      out.push([x, z]);
    }
  }
  return out;
}

/**
 * Cliff-edge props: from the collision points pick those at least 3.5 meters apart, and place broken rock,
 * crystals and broken railings (on bridges)
 */
export function rimProps(ctx: FieldCtx, pts: [number, number][]): void {
  const { b, r } = ctx;
  const kept: [number, number][] = [];
  const cell = new Map<string, [number, number][]>();
  const key = (x: number, z: number) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  const order = pts.map((p) => [p, r()] as const).sort((a, c) => a[1] - c[1]);
  const gap = ctx.low ? 5.5 : 3.6;
  for (const [[x, z]] of order) {
    let ok = true;
    for (let i = -1; i <= 1 && ok; i++) {
      for (let j = -1; j <= 1 && ok; j++) {
        for (const [qx, qz] of cell.get(`${Math.floor(x / 4) + i},${Math.floor(z / 4) + j}`) ?? []) {
          if (Math.hypot(qx - x, qz - z) < gap) {
            ok = false;
            break;
          }
        }
      }
    }
    if (!ok) continue;
    kept.push([x, z]);
    const k = key(x, z);
    cell.set(k, [...(cell.get(k) ?? []), [x, z]]);
  }
  const L = ctx.layout;
  for (const [x, z] of kept) {
    // Skip spots too close to chests, residents or teleport pads
    if (L.chests.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 2.5)) continue;
    if (Math.hypot(L.waypoint[0] - x, L.waypoint[1] - z) < 3) continue;
    const onRoad = ctx.pathDist(x, z) < L.pathW + 5;
    ctx.place(x, z, 0.4);
    const ry = r() * Math.PI * 2;
    if (onRoad) {
      // Beside stone bridges and roads: Old Kingdom railing posts, some of them broken
      const hgt = r() < 0.3 ? 0.4 + r() * 0.4 : 1.15;
      b.add(new THREE.BoxGeometry(0.42, hgt, 0.42), COL.stone, M(x, hgt / 2, z, ry));
      if (hgt > 1) b.add(new THREE.BoxGeometry(0.6, 0.18, 0.6), COL.stoneL, M(x, hgt + 0.09, z, ry));
      continue;
    }
    const t = r();
    if (t < 0.42) {
      // Broken rock slabs leaning outward
      const s = 0.7 + r() * 1.3;
      const g = new THREE.BoxGeometry(0.5 * s, 1.8 * s, 1.2 * s);
      b.add(g, r() < 0.5 ? COL.stoneD : COL.slab, M(x, 0.5 * s, z, ry, 1, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8));
      if (r() < 0.4) b.add(new THREE.DodecahedronGeometry(0.35 * s, 0), COL.stone, M(x + (r() - 0.5) * 1.2, 0.2, z + (r() - 0.5) * 1.2, r() * 6));
    } else if (t < 0.7) {
      // Crystals: black-purple bodies, glowing tips
      crystalCluster(b, x, z, 0.5 + r() * 0.7, r);
    } else {
      // Rock rubble piles
      for (let i = 0; i < 3; i++) {
        const s = 0.3 + r() * 0.5;
        b.add(new THREE.DodecahedronGeometry(s, 0), r() < 0.5 ? COL.stoneD : COL.stone, M(x + (r() - 0.5) * 1.6, s * 0.5, z + (r() - 0.5) * 1.6, r() * 6, 1, r(), r()));
      }
    }
  }
  b.lift = 0;
}

/**
 * After purification: the land around the Wound grows clusters of small glowing white flowers (new growth),
 * most numerous along both sides of the roads and on the Core Isle.
 * Uses its own random numbers, so it does not disturb the placement of other props.
 */
export function bloom(ctx: FieldCtx): void {
  const { b } = ctx;
  const r = rng(4471);
  const L = ctx.layout;
  const n = ctx.low ? 70 : 140;
  const petals = [0xfff4d0, 0xffffff, 0xd8f0ff, 0xffe0a0];
  let placed = 0;
  for (let tries = 0; tries < n * 10 && placed < n; tries++) {
    const x = (r() * 2 - 1) * (L.size - 6);
    const z = (r() * 2 - 1) * (L.size - 6);
    if (land(x, z) < 2.5) continue;
    const pd = ctx.pathDist(x, z);
    const rT = Math.hypot(x - T[0], z - T[1]);
    // Denser on both sides of the roads, on the Core Isle and around the Wound
    const want = Math.max(pd > L.pathW * 0.7 && pd < L.pathW + 4 ? 0.8 : 0, rT < RIN + 1 ? 0.9 : 0, 0.3 * (1 - sm(40, 90, rT)));
    if (r() > want) continue;
    if (pd < L.pathW * 0.7 || ctx.solids.blocked(x, z, 0.8) || Math.hypot(x - TOWN[0], z - TOWN[1]) < 16) continue;
    const k = 5 + Math.floor(r() * 6);
    for (let i = 0; i < k; i++) {
      const fx = x + (r() - 0.5) * 2.6;
      const fz = z + (r() - 0.5) * 2.6;
      ctx.place(fx, fz);
      const hgt = 0.25 + r() * 0.3;
      b.add(new THREE.CylinderGeometry(0.018, 0.026, hgt, 3), 0x6a9a6a, M(fx, hgt / 2, fz), false);
      // Flower: a five-petal star (a flattened decahedron) plus a center
      const bud = new THREE.OctahedronGeometry(0.14);
      bud.scale(1.4, 0.4, 1.4);
      b.glow(bud, petals[Math.floor(r() * petals.length)], M(fx, hgt + 0.02, fz, r() * 6));
      if (r() < 0.6) b.add(new THREE.ConeGeometry(0.09, 0.3, 3), 0x5a8a58, M(fx + 0.08, 0.12, fz, r() * 6, 1, 0.5, 0), false);
    }
    placed++;
  }
  b.lift = 0;
}
