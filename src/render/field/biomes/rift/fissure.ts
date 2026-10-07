// Fissures: the gashes where the land has been torn open. On the ground there is only one long strip mesh lying flat;
// the shader works out, from the view direction, which rock wall a ray looking down into the fissure hits first and at what
// depth (parallax), and the deeper it is the more the void light at the bottom lights it up.
// On both sides are uplifted crustal fragments folded outward, and small crystals sprout along the edge.
// They are most numerous at the sinkhole floors, the Fractured Field and around the Wound;
// after purification the purple light at the bottom turns warm gold.

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import type { FieldCtx } from '../../kit.ts';
import type { RiftClock } from './glsl.ts';
import type { Scatter } from './inst.ts';
import { COL } from './props.ts';
import { BASIN, CRATER, FIELD, land, SINKS, sm, T, TOWN } from './shape.ts';
import type { Debris } from './void.ts';

export interface Fissure {
  /** Sample points of the centerline (about one point per 0.6 meters) and the half-width */
  pts: [number, number][];
  w: number[];
}


const CRUST = [0x3a3046, 0x463c52, 0x2e2638, 0x51475e];

/**
 * Centerline: walk len meters from (x, z) in direction a, with the heading drifting slowly;
 * the half-width tapers to a point at both ends
 */
function trace(x: number, z: number, a: number, len: number, W: number, r: () => number): Fissure {
  const pts: [number, number][] = [];
  const w: number[] = [];
  const n = Math.max(4, Math.round(len / 0.6));
  let px = x - Math.sin(a) * len * 0.5;
  let pz = z - Math.cos(a) * len * 0.5;
  let h = a;
  const wob = r() * 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([px, pz]);
    const taper = Math.pow(Math.sin(Math.PI * t), 0.65);
    w.push(Math.max(0.04, W * taper * (0.82 + 0.3 * Math.sin(t * 9 + wob) * Math.sin(t * 4.3 + wob * 2))));
    h += (r() - 0.5) * 0.5;
    // Pull back toward the original heading, so the whole fissure never curls into a loop
    h += (a - h) * 0.25;
    px += Math.sin(h) * (len / n);
    pz += Math.cos(h) * (len / n);
  }
  return { pts, w };
}

/**
 * The whole fissure lies on open ground (not over roads, towns, chests, residents or existing large props,
 * and not near a cliff edge)
 */
function fits(ctx: FieldCtx, f: Fissure): boolean {
  const L = ctx.layout;
  for (let i = 0; i < f.pts.length; i++) {
    const [x, z] = f.pts[i];
    const w = f.w[i];
    if (land(x, z) < w + 3) return false;
    if (ctx.pathDist(x, z) < L.pathW + 1.4 + w) return false;
    if (Math.hypot(x - TOWN[0], z - TOWN[1]) < 30) return false;
    if (Math.hypot(x - T[0], z - T[1]) < 17) return false;
    if (Math.hypot(x - L.waypoint[0], z - L.waypoint[1]) < 6) return false;
    if (L.chests.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 4.5)) return false;
    if (L.npcs.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 4)) return false;
    if (L.zones.some((zn) => Math.hypot(zn.x - x, zn.z - z) < 3.5)) return false;
    if (ctx.solids.blocked(x, z, w + 0.4)) return false;
  }
  return true;
}

/**
 * Plan all the fissures: sinkhole floors, the Fractured Field, the Blightcrystal Basin, the rim of the Inverted Quarter,
 * plus scattered fissures that get denser closer to the Wound
 */
export function planFissures(ctx: FieldCtx, r: () => number): Fissure[] {
  const out: Fissure[] = [];
  const tryAdd = (f: Fissure) => {
    if (!fits(ctx, f)) return false;
    // Keep a distance from the fissures already placed
    for (const g of out) for (const [x, z] of f.pts) for (let k = 0; k < g.pts.length; k += 3) if (Math.hypot(g.pts[k][0] - x, g.pts[k][1] - z) < 2.6) return false;
    out.push(f);
    return true;
  };
  for (const [sx, sz, sr] of SINKS) {
    for (let k = 0; k < 6; k++) if (tryAdd(trace(sx + (r() - 0.5) * 1.5, sz + (r() - 0.5) * 1.5, r() * Math.PI, sr * (1.1 + r() * 0.4), 0.8 + r() * 0.5, r))) break;
  }
  const hubs: [number, number, number, number][] = [
    // center, radius, count, width
    [FIELD[0] - 2, FIELD[1], 11, 5],
    [BASIN[0] - 4, BASIN[1] + 16, 12, 3],
    [CRATER[0] + 16, CRATER[1] + 2, 8, 2],
  ];
  for (const [hx, hz, hr, n] of hubs) {
    let placed = 0;
    for (let k = 0; k < n * 12 && placed < n; k++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * hr;
      if (tryAdd(trace(hx + Math.cos(a) * d, hz + Math.sin(a) * d, a + (r() - 0.5) * 0.8, 5 + r() * 7, 0.45 + r() * 0.55, r))) placed++;
    }
  }
  const S = ctx.layout.size - 8;
  const want = ctx.low ? 22 : 38;
  for (let k = 0; k < want * 30 && out.length < want + 14; k++) {
    const x = (r() * 2 - 1) * S;
    const z = (r() * 2 - 1) * S;
    const rT = Math.hypot(x - T[0], z - T[1]);
    if (r() > 0.25 + 0.6 * (1 - sm(46, 95, rT))) continue;
    tryAdd(trace(x, z, r() * Math.PI, 4 + r() * 9, 0.3 + r() * 0.5 + (r() < 0.2 ? 0.5 : 0), r));
  }
  return out;
}

// ───────────────────────── Shader ─────────────────────────

const VERT = /* glsl */ `
  #include <fog_pars_vertex>
  attribute float aSide; attribute float aW; attribute vec2 aN; attribute float aAlong;
  varying float vSide; varying float vW; varying vec2 vN; varying float vAlong; varying vec3 vWP;
  void main(){
    vSide = aSide; vW = aW; vN = aN; vAlong = aAlong;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWP = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime; uniform float uBeat; uniform float uCalm;
  varying float vSide; varying float vW; varying vec2 vN; varying float vAlong; varying vec3 vWP;
  void main(){
    vec3 V = normalize(vWP - cameraPosition);
    // Depth of the fissure: much deeper than it is wide, so at a slant only the opposite rock wall is visible and the bottom can be seen only when looking almost straight down
    float D = 3.0 + vW * 2.5;
    // How far the line of sight moves sideways per meter descended (along the fissure normal)
    float k = dot(V.xz, vN) / max(-V.y, 0.06);
    float s = vSide * vW;
    float dist = k > 0.0 ? (vW - s) : (vW + s);
    float hit = dist / max(abs(k), 0.001);
    float depth = min(hit, D);
    float t = depth / D;
    vec3 glowV = 0.85 * mix(vec3(1.0, 0.18, 0.55), vec3(0.55, 0.15, 1.0), 0.5 + 0.5 * sin(vAlong * 0.35 + uTime * 0.4));
    vec3 glowP = mix(vec3(1.0, 0.78, 0.42), vec3(1.0, 0.92, 0.75), 0.5 + 0.5 * sin(vAlong * 0.35));
    vec3 glow = mix(glowV, glowP, uCalm);
    float flow = 0.65 + 0.35 * sin(vAlong * 1.1 - uTime * 1.6) * sin(vAlong * 0.37 + uTime * 0.7);
    // The rock wall hit: dark strata (layer upon layer) at the top, lit more by the light from the fissure bottom the lower it goes;
    // The farther the line of sight travels inside the fissure, the more Void light floating in it accumulates (even at a slant the fissure can be seen glowing)
    // (These are linear color values that are converted to sRGB at the end, so the dark parts must be very dark)
    float band = step(0.5, fract(depth * 2.1 + sin(vAlong * 0.7) * 0.3));
    vec3 wall = mix(vec3(0.03, 0.02, 0.042), vec3(0.004, 0.001, 0.008), smoothstep(0.0, 0.3, t)) * (0.75 + 0.25 * band);
    wall += glow * (pow(t, 1.3) * 0.85 + 0.14 * (1.0 - exp(-depth * 0.8))) * (0.6 + 0.4 * flow);
    // Fissure lip: a thin pale rock edge
    wall += vec3(0.05, 0.04, 0.065) * (1.0 - smoothstep(0.0, 0.04, depth));
    vec3 col = wall;
    // The bottom is visible: the center line is a very bright light
    if (hit >= D) {
      float lat = abs(s + k * D) / max(vW, 0.01);
      float core = 1.0 - smoothstep(0.0, 0.7, lat);
      col = glow * (0.3 + 1.2 * core * core) * (0.75 + 0.35 * flow);
    }
    col *= (0.85 + 0.35 * uBeat * (1.0 - uCalm));
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }`;

// ───────────────────────── Build ─────────────────────────

/**
 * Build the fissures: the long strip on the ground, the crust folded up on both sides, small crystals along the edge;
 * returns the fragments that float above the fissures
 */
export function buildFissures(ctx: FieldCtx, clock: RiftClock, list: Fissure[], sc: Scatter, r: () => number): Debris[] {
  const pos: number[] = [];
  const side: number[] = [];
  const wid: number[] = [];
  const nrm: number[] = [];
  const along: number[] = [];
  const idx: number[] = [];
  const debris: Debris[] = [];
  const { b } = ctx;
  const pure = clock.uCalm.value > 0;
  for (const f of list) {
    const n = f.pts.length;
    let acc = r() * 20;
    for (let i = 0; i < n; i++) {
      const [x, z] = f.pts[i];
      const [ax, az] = f.pts[Math.max(0, i - 1)];
      const [bx, bz] = f.pts[Math.min(n - 1, i + 1)];
      let tx = bx - ax;
      let tz = bz - az;
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl;
      tz /= tl;
      const nx = -tz;
      const nz = tx;
      const w = f.w[i];
      const y = Math.max(ctx.h(x + nx * w, z + nz * w), ctx.h(x, z), ctx.h(x - nx * w, z - nz * w)) + 0.05;
      if (i > 0) acc += Math.hypot(x - f.pts[i - 1][0], z - f.pts[i - 1][1]);
      const base = pos.length / 3;
      pos.push(x + nx * w, y, z + nz * w, x - nx * w, y, z - nz * w);
      side.push(1, -1);
      wid.push(w, w);
      nrm.push(nx, nz, nx, nz);
      along.push(acc, acc);
      if (i > 0) idx.push(base - 2, base - 1, base, base - 1, base + 1, base);
      // Collision: where it is wide, it cannot be walked across
      if (i % 2 === 0 && w > 0.3) ctx.solids.add(x, z, w + 0.15);
      // Crustal fragments folded up on both sides (tilted toward the fissure)
      for (const s of [-1, 1]) {
        if (r() < 0.25 || w < 0.12) continue;
        const off = w + 0.1 + r() * 0.35;
        const px = x + nx * s * off;
        const pz = z + nz * s * off;
        ctx.place(px, pz, 0.3);
        const len = 0.45 + r() * 0.6 + w * 0.3;
        const th = 0.1 + r() * 0.14;
        const dep = 0.35 + r() * 0.45;
        const face = Math.atan2(nx * s, nz * s);
        const tilt = 0.18 + r() * 0.4 + w * 0.12;
        const g = new THREE.BoxGeometry(len, th, dep);
        b.add(g, CRUST[Math.floor(r() * CRUST.length)], new THREE.Matrix4().compose(new THREE.Vector3(px, 0.02 + th * 0.4 + tilt * dep * 0.3, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(-tilt, face, (r() - 0.5) * 0.3, 'YXZ')), new THREE.Vector3(1, 1, 1)));
        if (r() < 0.35) b.add(new THREE.DodecahedronGeometry(0.1 + r() * 0.16, 0), COL.stoneD, M(px + nx * s * (0.4 + r() * 0.4), 0.06, pz + nz * s * (0.4 + r() * 0.4), r() * 6));
        // Small crystals along the edge (gold-white after purification)
        if (r() < 0.22 && w > 0.2) {
          const ly = ctx.h(px, pz);
          const ss = 0.12 + r() * 0.18;
          sc.add('sprout', new THREE.Matrix4().compose(new THREE.Vector3(x + nx * s * (w * 0.7), ly + ss * 0.6, z + nz * s * (w * 0.7)), new THREE.Quaternion().setFromEuler(new THREE.Euler(nz * s * 0.6, r() * 6, -nx * s * 0.6)), new THREE.Vector3(ss * 0.5, ss * 1.6, ss * 0.5)), pure ? (r() < 0.5 ? 0xffe0a0 : 0xfff4e0) : r() < 0.5 ? COL.cryA : COL.cryB, pure ? 0.45 : 1);
        }
      }
      // Rubble floating low above the fissure (gravity does not work well above a fissure)
      if (w > 0.5 && r() < 0.18) debris.push([x + (r() - 0.5) * w, ctx.h(x, z) + 0.8 + r() * 2.2, z + (r() - 0.5) * w, 0.12 + r() * 0.28]);
    }
  }
  b.lift = 0;
  if (!idx.length) return debris;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  geo.setAttribute('aW', new THREE.Float32BufferAttribute(wid, 1));
  geo.setAttribute('aN', new THREE.Float32BufferAttribute(nrm, 2));
  geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    fog: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: clock.uTime, uBeat: clock.uBeat, uCalm: clock.uCalm },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  const mesh = new THREE.Mesh(geo, mat);
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    geo.dispose();
    mat.dispose();
  });

  // Light motes and black smoke rising out of the fissure (only fissures near the camera emit)
  const src: [number, number, number, number][] = [];
  for (const f of list) for (let i = 1; i < f.pts.length - 1; i += 2) if (f.w[i] > 0.2) src.push([f.pts[i][0], ctx.h(f.pts[i][0], f.pts[i][1]), f.pts[i][1], f.w[i]]);
  let acc = 0;
  let near: typeof src = [];
  let scan = 0;
  ctx.extras.push((dt, _t, vfx) => {
    scan -= dt;
    if (scan <= 0) {
      scan = 0.5;
      near = src.filter(([x, , z]) => Math.hypot(x - vfx.camPos.x, z - vfx.camPos.z) < 40);
    }
    if (!near.length) return;
    acc += dt;
    const every = ctx.low ? 0.12 : 0.05;
    while (acc > every) {
      acc -= every;
      const [x, y, z, w] = near[Math.floor(Math.random() * near.length)];
      const p = new THREE.Vector3(x + (Math.random() - 0.5) * w, y + 0.05, z + (Math.random() - 0.5) * w);
      if (Math.random() < 0.7)
        vfx.emit({ pos: p, count: 1, color: pure ? [0xffe0a0, 0xfff6e0] : [COL.cryA, COL.cryB, 0xffb8e8], speed: [0.4, 1.1], dir: new THREE.Vector3(0, 1, 0), spread: 0.25, life: [1.6, 3], size: [0.05, 0.11], sizeEnd: 0.02, intensity: 1.8 });
      else if (!pure) vfx.smoke({ pos: p, count: 1, color: [0x0a0410, 0x1a0c24], speed: [0.3, 0.8], dir: new THREE.Vector3(0, 1, 0), spread: 0.2, life: [2.5, 4], size: [0.2, 0.4], sizeEnd: 0.8, drag: 0.02, intensity: 1 });
    }
  });
  return debris;
}
