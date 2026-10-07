// Remakes of the first-batch spirits (round two: the three stages clearly differ and feel alive). The builders here override the same-named BASE entries in species.ts.
// This file holds six Ns: `pyrewing`, `icecrown`, `dreamcap`, `skyreign`, `monolith`, `cloudfluff`. Each one's three stages are assembled with different rigs and poses,
// not one model recolored: I a rounded juvenile, II an adolescent stretched out, III an adult or king.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Creature, Kit, PartOpts } from '../creature.ts';
import { toonMaterial } from '../toon.ts';
import { floater, PI, sparkle, type Builder, type C, type V3 } from '../parts.ts';

// ───────────────────────── Shared helpers ─────────────────────────

const UP = new THREE.Vector3(0, 1, 0);
const vec = (p: V3) => new THREE.Vector3(p[0], p[1], p[2]);

/** Reproducible pseudo-random number (0 to 1): the same seed builds the same result every time, so the rocks and spots do not change shape from battle to battle */
function rnd(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Low-segment small sphere (fluff, spots, rivets), saving about 83% of the triangles compared with k.sphere */
function ball(k: Kit, parent: THREE.Object3D, col: C, r: number, pos: V3 = [0, 0, 0], scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, 12, 8);
  g.scale(...scale);
  return k.mesh(parent, g, col, pos, rot, o);
}

/** Sharp-edged part: the body uses flat normals (rocks, slabs), and the outline uses a copy with vertex-merged smooth normals, so the hard edges do not tear the outline into fragments */
function facet(k: Kit, c: Creature, parent: THREE.Object3D, geo: THREE.BufferGeometry, col: C, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
  const m = k.mesh(parent, geo, col, pos, rot, { ...o, outline: false });
  const g = geo.clone();
  g.deleteAttribute('normal');
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  const og = mergeVertices(g);
  og.computeVertexNormals();
  m.add(new THREE.Mesh(og, c.outlines[0]));
  return m;
}

/** Thin sheet extruded from a 2D outline; with yz = true the sheet stands in the yz plane (the shape's x maps to +z, thickness along x), used for wings */
function plate(k: Kit, c: Creature, parent: THREE.Object3D, pts: [number, number][], depth: number, col: C, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], yz = false, o: PartOpts = {}): THREE.Mesh {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  if (yz) g.rotateY(-PI / 2);
  return facet(k, c, parent, g, col, pos, rot, o);
}

/** Stick big eyes onto an ellipsoid surface: compute the surface z from x and y, sunk in slightly so the whites bulge out (cy / cz are the ellipsoid center's position in head coordinates) */
function faceEyes(k: Kit, head: THREE.Object3D, rad: number | V3, o: { x: number; y: number; r: number; iris: C; glow?: boolean; sharp?: boolean; yaw?: number; cy?: number; cz?: number }): void {
  const [rx, ry, rz] = typeof rad === 'number' ? [rad, rad, rad] : rad;
  const nx = o.x / rx;
  const ny = (o.y - (o.cy ?? 0)) / ry;
  const z = (o.cz ?? 0) + Math.sqrt(Math.max(0.03, 1 - nx * nx - ny * ny)) * rz - o.r * 0.15;
  k.eyes(head, { x: o.x, y: o.y, z, r: o.r, iris: o.iris, glow: o.glow, sharp: o.sharp, yaw: o.yaw });
}

/** Smile: a short arc with the opening facing up */
function smile(k: Kit, head: THREE.Object3D, col: C, R: number, r: number, pos: V3, w = 0.55): THREE.Mesh {
  const g = new THREE.TorusGeometry(R, r, 6, 12, w * 2);
  g.rotateZ(-PI / 2 - w);
  return k.mesh(head, g, col, pos, [0, 0, 0], { outline: false });
}

/** Eyebrow: a short slanted capsule; tilt > 0 means the outer end is high (fierce), < 0 means the outer end is low (gentle) */
function brow(k: Kit, head: THREE.Object3D, col: C, sx: number, pos: V3, tilt: number, len: number, r: number): THREE.Mesh {
  return k.capsule(head, col, r, len, pos, [0, 0, -sx * (PI / 2 - tilt)], { outline: false });
}

/** Eyelash: two small spikes at the upper outside of the eye */
function lashes(k: Kit, head: THREE.Object3D, col: C, sx: number, pos: V3, len: number): void {
  for (let i = 0; i < 2; i++) k.blade(head, col, len, len * 0.35, len * 0.25, [pos[0] + sx * i * len * 0.5, pos[1] - i * len * 0.35, pos[2]], [0, 0, -sx * (0.9 + i * 0.5)], { outline: false });
}

/** Tube along a curve, thick to thin (antenna, tail feather, ribbon) */
function tube(k: Kit, parent: THREE.Object3D, col: C, pts: V3[], r0: number, r1: number, o: { glow?: number; outline?: boolean; opacity?: number } = {}): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts.map(vec));
  const segs = 18;
  const rad = 8;
  const g = new THREE.TubeGeometry(curve, segs, 1, rad, false);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const ctr = curve.getPointAt(t);
    const r = Math.max(0.002, r0 + (r1 - r0) * t);
    for (let j = 0; j <= rad; j++) {
      const idx = i * (rad + 1) + j;
      v.fromBufferAttribute(p, idx).sub(ctr).multiplyScalar(r).add(ctr);
      p.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  if (o.glow) return k.glow(parent, g, col, o.glow, [0, 0, 0], [0, 0, 0], o.opacity ?? 1);
  return k.mesh(parent, g, col, [0, 0, 0], [0, 0, 0], { outline: o.outline });
}

/** Thin rod between two points (wing vein, staff, engraving) */
function rod(k: Kit, parent: THREE.Object3D, col: C, a: V3, b: V3, r: number, glow = 0, outline = true): THREE.Mesh {
  const va = vec(a);
  const vb = vec(b);
  const d = vb.clone().sub(va);
  const g = new THREE.CylinderGeometry(r, r, Math.max(1e-3, d.length()), 6, 1);
  const m = glow ? k.glow(parent, g, col, glow) : k.mesh(parent, g, col, [0, 0, 0], [0, 0, 0], { outline });
  m.position.copy(va.add(vb).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

/** Flat spot stuck on an ellipsoid surface (white spots on a mushroom cap, glowing scales): placed along the surface normal so it does not float in midair; lat is elevation, lon is measured from straight ahead toward +x */
function dot(k: Kit, parent: THREE.Object3D, col: C, r: number, ctr: V3, rad: V3, lat: number, lon: number, o: { glow?: number; flat?: number; lift?: number } = {}): THREE.Mesh {
  const p = new THREE.Vector3(Math.cos(lat) * Math.sin(lon) * rad[0], Math.sin(lat) * rad[1], Math.cos(lat) * Math.cos(lon) * rad[2]);
  const n = new THREE.Vector3(p.x / (rad[0] * rad[0]), p.y / (rad[1] * rad[1]), p.z / (rad[2] * rad[2])).normalize();
  const geo = new THREE.SphereGeometry(r, 12, 8);
  geo.scale(1, o.flat ?? 0.3, 1);
  const m = o.glow ? k.glow(parent, geo, col, o.glow) : k.mesh(parent, geo, col, [0, 0, 0], [0, 0, 0], { outline: false });
  m.position.copy(p.add(n.clone().multiplyScalar(o.lift ?? 0)).add(vec(ctr)));
  m.quaternion.setFromUnitVectors(UP, n);
  return m;
}

/** Irregular rock: push an icosahedron's vertices outward by a "position hash", with shared vertices pushed by the same amount so it does not tear; flat body normals give the rock-face look */
function rock(k: Kit, c: Creature, parent: THREE.Object3D, col: C, r: number, scale: V3, pos: V3, seed: number, o: { detail?: number; rough?: number; rot?: V3; emissive?: C; emissiveAmt?: number } = {}): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(r, o.detail ?? 1);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const rough = o.rough ?? 0.1;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = Math.round((v.x / r) * 41) * 1.3 + Math.round((v.y / r) * 41) * 7.1 + Math.round((v.z / r) * 41) * 13.7 + seed * 3.3;
    v.multiplyScalar(1 + (rnd(key) - 0.5) * 2 * rough);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.scale(...scale);
  geo.computeVertexNormals();
  return facet(k, c, parent, geo, col, pos, o.rot ?? [0, 0, 0], { emissive: o.emissive, emissiveAmt: o.emissiveAmt });
}

/** Floating musical-note light mote (for `cloudfluff` humming), bobbing up and down */
function note(k: Kit, c: Creature, parent: THREE.Object3D, col: C, pos: V3, sz: number, seed: number): THREE.Group {
  const g = k.group(parent, pos, [0, 0, 0.15]);
  k.glowSphere(g, col, sz * 0.3, [0, 0, 0], 2.6, [1.3, 0.9, 0.5]);
  k.glow(g, new THREE.BoxGeometry(sz * 0.09, sz, sz * 0.09), col, 2.6, [sz * 0.34, sz * 0.5, 0]);
  k.glow(g, new THREE.BoxGeometry(sz * 0.42, sz * 0.14, sz * 0.09), col, 2.6, [sz * 0.52, sz * 0.9, 0], [0, 0, -0.5]);
  c.bobbers.push({ g, base: pos[1], amp: 0.05, speed: 1.6 + rnd(seed) * 1.2, phase: seed * 1.7 });
  return g;
}

/** A small mushroom (fungus ring, small sprout mushroom at the cap's side, mushroom lamp): base at the origin, cap top at r*1.6 */
function miniShroom(k: Kit, parent: THREE.Object3D, pos: V3, r: number, cap: C, stem: C, o: { glow?: boolean; rot?: V3; spot?: C } = {}): THREE.Group {
  const g = k.group(parent, pos, o.rot ?? [0, 0, 0]);
  k.cyl(g, stem, r * 0.34, r * 0.46, r * 0.9, [0, r * 0.45, 0], [0, 0, 0], 10);
  k.lathe(g, cap, [[0.001, r * 0.72], [r * 0.88, r * 0.72], [r, r * 0.9], [r * 0.8, r * 1.28], [r * 0.42, r * 1.52], [0.001, r * 1.6]]);
  dot(k, g, o.spot ?? 0xfff0ff, r * 0.18, [0, r * 0.72, 0], [r * 0.95, r * 0.88, r * 0.95], 0.55, 0.7, { glow: o.glow ? 2.2 : 0 });
  dot(k, g, o.spot ?? 0xfff0ff, r * 0.14, [0, r * 0.72, 0], [r * 0.95, r * 0.88, r * 0.95], 0.4, -1.9, { glow: o.glow ? 2.2 : 0 });
  if (o.glow) k.glowSphere(g, 0xffb8ff, r * 0.4, [0, r * 0.72, 0], 1.8, [1, 0.5, 1], 0.8);
  return g;
}

/**
 * Moth wings: forewing + hindwing in one group flapping together. The shape stands in the yz plane (y outward, +z forward),
 * and the whole group flaps about z (the wings lie flat when base is near π/2). spots are the glowing scale dust on the wing, veins the glowing wing veins, tails the hindwing's long tails and flame tips.
 */
function mothWing(k: Kit, c: Creature, parent: THREE.Object3D, sx: number, pos: V3, o: { L: number; col: C; edge: C; hind: C; spot: C; spots: number; eye?: C; veins?: C; tails?: C; flame?: C; base: number; amp: number; speed: number }): THREE.Group {
  const L = o.L;
  const outer = k.group(parent, pos, [-0.12, sx * 0.22, 0]);
  const flap = k.group(outer);
  c.wings.push({ g: flap, side: -sx, base: o.base, amp: o.amp, speed: o.speed });
  // Which side in local x the wing's upward face is on (the left and right wings rotate about z in opposite directions)
  const top = -sx;
  // The wing surface is raised about the wing-root axis: a perfectly horizontal wing is only a line from the battle camera, and it takes about 50° of lift to see the scale dust and wing edge
  const g = k.group(flap, [0, 0, 0], [0, top * 0.85, 0]);
  const sc = (p: [number, number][], kx: number, ky: number): [number, number][] => p.map(([x, y]) => [x * kx, y * ky]);
  const FORE: [number, number][] = [[0.06, 0], [0.28, 0.06], [0.36, 0.42], [0.31, 0.72], [0.18, 0.93], [0.02, 1], [-0.12, 0.92], [-0.21, 0.62], [-0.17, 0.26], [-0.06, 0]];
  const HIND: [number, number][] = [[0.1, 0], [0.3, 0.18], [0.32, 0.5], [0.2, 0.78], [0.02, 0.86], [-0.14, 0.8], [-0.3, 0.55], [-0.28, 0.2], [-0.1, 0]];
  plate(k, c, g, sc(FORE, L, L), 0.02, o.col, [0, 0, 0], [0, 0, 0], true);
  plate(k, c, g, sc(FORE, L * 1.08, L * 1.06), 0.011, o.edge, [0, -L * 0.02, 0], [0, 0, 0], true);
  const hl = L * 0.62;
  plate(k, c, g, sc(HIND, hl, hl), 0.018, o.hind, [-top * 0.02, 0, -L * 0.3], [0, 0, 0], true);
  for (let i = 0; i < o.spots; i++) {
    const t = (i + 1) / (o.spots + 1);
    k.glowSphere(g, o.spot, L * (0.05 + t * 0.02), [0, (0.3 + t * 0.6) * L, (0.14 - t * 0.22) * L], 2.4, [0.5, 1, 1]);
  }
  // Big eyespot in the middle of the forewing: an ember-red outer ring, a gold dot at the center (the gold dot's x radius is larger than the outer ring's, so it shows through the ring)
  if (o.eye) {
    k.glowSphere(g, o.eye, L * 0.1, [0, L * 0.58, -L * 0.02], 2.2, [0.5, 1, 1]);
    k.glowSphere(g, o.spot, L * 0.05, [0, L * 0.58, -L * 0.02], 2.8, [1.3, 1, 1]);
  }
  if (o.veins) for (const [u, v] of [[0.96, 0.08], [0.86, -0.12], [0.62, 0.3], [0.7, -0.19]]) rod(k, g, o.veins, [top * 0.012, L * 0.05, 0], [top * 0.012, u * L, v * L], L * 0.007, 1.8);
  if (o.tails) {
    const x = -top * 0.02;
    const end: V3 = [x, hl * 0.72, -L * 0.3 - hl * 1.05];
    tube(k, g, o.tails, [[x, hl * 0.7, -L * 0.3 - hl * 0.16], [x, hl * 0.9, -L * 0.3 - hl * 0.6], end], L * 0.03, L * 0.008);
    const fg = k.group(g, end);
    k.glowSphere(fg, o.flame ?? 0xff6a1a, L * 0.055, [0, 0, 0], 2.6, [0.8, 0.8, 1.5]);
    k.glowSphere(fg, 0xffe890, L * 0.028, [0, 0, 0], 3);
    c.flickers.push({ g: fg, base: fg.scale.clone(), speed: 9 + rnd(sx + 3) * 3, amt: 0.3 });
  }
  return g;
}

/** Raptor wing: secondaries + coverts + primary flight feathers fanning out from the wrist and sweeping back more toward the rear (white tips); pitch tilts the wing surface forward and up so the camera can see it */
function raptorWing(k: Kit, c: Creature, parent: THREE.Object3D, sx: number, pos: V3, o: { L: number; col: C; dark: C; tip: C; primaries: number; base: number; amp: number; speed: number; pitch: number; gold?: C }): THREE.Group {
  const L = o.L;
  const g = k.group(parent, pos);
  c.wings.push({ g, side: -sx, base: o.base, amp: o.amp, speed: o.speed });
  const top = -sx;
  const p = o.pitch;
  // Secondaries (shoulder to wrist) in two layers, the lower one darker and set slightly back
  k.blade(g, o.col, L * 0.6, L * 0.36, 0.06, [0, 0, 0], [p, 0, 0]);
  k.blade(g, o.dark, L * 0.56, L * 0.34, 0.05, [-top * 0.01, L * 0.04, -0.02], [p - 0.2, 0, 0]);
  if (o.gold) k.blade(g, o.gold, L * 0.52, L * 0.07, 0.035, [top * L * 0.14, L * 0.02, 0.014], [p, 0, 0], { outline: false });
  // Primary flight feathers: long and narrow, shorter toward the rear (the wing tip forms a sharp point), fanning out only slightly within the wing plane; only the front two have white tips, so it does not look like five fingers
  for (let i = 0; i < o.primaries; i++) {
    const t = i / (o.primaries - 1);
    const pg = k.group(g, [-top * L * 0.02 * i, L * 0.5, -0.015 - i * 0.018], [p - 0.05 - t * 0.5, 0, 0]);
    const len = L * (0.62 - t * 0.3);
    k.blade(pg, i === 0 ? o.col : o.dark, len, L * 0.1, 0.04, [0, 0, 0]);
    if (i < 2) k.blade(pg, o.tip, len * 0.25, L * 0.08, 0.035, [0, len * 0.76, 0.003], [0, 0, 0], { outline: false });
  }
  return g;
}

/** Three-toed bird foot: a leg + three toes, with a curved claw added when claw gives a claw color */
function birdFoot(k: Kit, c: Creature, parent: THREE.Object3D, sx: number, pos: V3, col: C, r: number, len: number, claw?: C): THREE.Group {
  const g = k.group(parent, pos);
  k.capsule(g, col, r, len, [0, 0, 0]);
  for (let i = -1; i <= 1; i++) {
    const tg = k.group(g, [i * r * 1.2, -len * 0.5 - r * 0.6, r * 0.6], [PI / 2, 0, i * 0.35]);
    k.capsule(tg, col, r * 0.55, len * 0.7, [0, len * 0.3, 0]);
    if (claw) k.horn(tg, claw, r * 0.4, len * 0.45, len * 0.15, [0, len * 0.66, 0], [0, 0, 0]);
  }
  c.legs.push({ g, phase: sx > 0 ? 0 : PI, amp: 0.7 });
  return g;
}

// ───────────────────────── Emberspine Volcanic Belt: the `pyrewing` family (fire) ─────────────────────────

const WAX = 0xfff0d0;
const PEACH = 0xffc890;
const PEACH2 = 0xffb870;
const BROWN = 0x8a5a48;
const AMBER = 0xff9a3a;
const EMBER = 0xff4a12;
const GOLD = 0xffd24a;
const SOOT = 0x4a2e2a;
const FLAME = 0xff6a1a;
const FCORE = 0xffe890;

/** Feathery antenna: a thin tube curving outward, small alternating vanes on both sides, a fire-light bead at the end */
function mothAntenna(k: Kit, c: Creature, head: THREE.Object3D, sx: number, pos: V3, len: number, n: number, col: C, tipCol: C): void {
  const g = k.group(head, pos, [-0.55, 0, -sx * 0.75]);
  c.ears.push({ g, phase: sx * 1.4 });
  tube(k, g, SOOT, [[0, 0, 0], [0, len * 0.55, len * 0.06], [sx * len * 0.08, len, len * 0.02]], len * 0.05, len * 0.02);
  for (let i = 0; i < n; i++) {
    const t = 0.18 + (i / n) * 0.72;
    const side = i % 2 ? 1 : -1;
    k.blade(g, col, len * 0.22 * (1 - t * 0.4), len * 0.07, len * 0.03, [0, len * t, 0], [0, 0, side * 1.25], { outline: false });
  }
  k.glowSphere(g, tipCol, len * 0.09, [sx * len * 0.08, len, len * 0.02], 2.8);
}

/** Six thin legs: three pairs, going out and then folding down */
function insectLegs(k: Kit, c: Creature, parent: THREE.Object3D, y: number, spread: number, len: number, r: number): void {
  for (const sx of [-1, 1]) {
    for (let zi = -1; zi <= 1; zi++) {
      const g = k.group(parent, [sx * spread, y, zi * len * 0.55], [zi * 0.35, 0, sx * 1.05]);
      k.capsule(g, SOOT, r, len, [0, -len * 0.5, 0]);
      const lo = k.group(g, [0, -len, 0], [0, 0, -sx * 1.7]);
      k.capsule(lo, SOOT, r * 0.8, len * 0.85, [0, -len * 0.42, 0]);
      c.legs.push({ g, phase: (zi + sx) * 1.1, amp: 0.4 });
    }
  }
}

const pyrewing: Builder = (k, c, s) => {
  if (s === 1) {
    // I: a six-segment caterpillar lying down, the body curving left into an arc (only a front-facing camera sees the whole body), a candle wick on top of the head
    c.archetype = 'crawl';
    const segs: [number, number, number, number][] = [[0.22, 0.28, 0, 0.01], [0.2, 0.06, -0.01, 0], [0.19, -0.13, -0.05, 0], [0.18, -0.31, -0.12, 0], [0.16, -0.46, -0.22, 0.01], [0.13, -0.58, -0.34, 0.05]];
    let head = c.head;
    segs.forEach(([r, z, x, lift], i) => {
      const g = k.group(c.body, [x, r + lift, z]);
      k.sphere(g, i % 2 ? PEACH2 : WAX, r, [0, 0, 0], [1, 0.96, 1.06]);
      c.bobbers.push({ g, base: r + lift, amp: 0.012, speed: 5, phase: i * 0.9 });
      if (i === 0) {
        head = g;
        return;
      }
      // A point of scale-dust firelight on the back; a pair of short legs on the belly side
      k.glowSphere(g, i % 2 ? AMBER : EMBER, r * 0.28, [0, r * 0.8, 0], 2.2, [1.2, 0.45, 1]);
      if (i < 5) {
        for (const sx of [-1, 1]) {
          const fg = k.group(g, [sx * r * 0.72, -r * 0.78, 0]);
          ball(k, fg, BROWN, 0.04, [0, 0, 0], [1, 0.6, 1.3]);
          c.legs.push({ g: fg, phase: (i + sx) * 1.2, amp: 0.5 });
        }
      }
      if (i === 5) k.glowSphere(g, EMBER, 0.045, [0, 0.02, -r * 0.95], 2.4);
    });
    c.head = head;
    faceEyes(k, head, [0.22, 0.21, 0.233], { x: 0.09, y: 0.03, r: 0.07, iris: 0xff8a1a });
    k.blush(head, 0.155, -0.05, 0.15, 0.037);
    smile(k, head, SOOT, 0.032, 0.007, [0, -0.065, 0.215]);
    for (const sx of [-1, 1]) {
      ball(k, head, WAX, 0.045, [sx * 0.18, -0.07, 0.08], [0.55, 1.3, 0.55], [0, 0, 0], { outline: false });
      const ag = k.group(head, [sx * 0.09, 0.17, 0.08], [-0.5, 0, -sx * 0.7]);
      k.capsule(ag, SOOT, 0.012, 0.1, [0, 0.05, 0]);
      k.glowSphere(ag, AMBER, 0.026, [0, 0.11, 0], 2.6);
      c.ears.push({ g: ag, phase: sx * 1.7 });
    }
    k.cyl(head, SOOT, 0.013, 0.016, 0.12, [0, 0.24, -0.02], [0, 0, 0], 8);
    k.flame(head, FLAME, FCORE, 0.09, [0, 0.29, -0.02]);
    return;
  }
  if (s === 2) {
    // II: an adolescent moth hovering upright
    floater(c, 0.22);
    const ty = 0.66;
    k.sphere(c.body, WAX, 0.2, [0, ty, 0], [1, 1.05, 1]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      ball(k, c.body, WAX, 0.075, [Math.cos(a) * 0.17, ty + 0.13 + Math.sin(i * 2.1) * 0.015, Math.sin(a) * 0.15]);
    }
    const ab = k.group(c.body, [0, ty - 0.1, -0.03], [0.42, 0, 0]);
    [0.16, 0.145, 0.12, 0.09].forEach((r, i) => k.sphere(ab, i % 2 ? PEACH : AMBER, r, [0, -0.05 - i * 0.135, 0], [1, 1.1, 1]));
    k.glowSphere(ab, EMBER, 0.045, [0, -0.55, 0], 2.4);
    const head = k.group(c.body, [0, ty + 0.3, 0.06]);
    c.head = head;
    k.sphere(head, WAX, 0.17);
    faceEyes(k, head, 0.17, { x: 0.075, y: 0.02, r: 0.062, iris: 0xff8a1a });
    k.blush(head, 0.12, -0.05, 0.12, 0.03);
    smile(k, head, SOOT, 0.028, 0.006, [0, -0.06, 0.165]);
    k.cyl(head, SOOT, 0.012, 0.015, 0.11, [0, 0.19, -0.02], [0, 0, 0], 8);
    k.flame(head, FLAME, FCORE, 0.1, [0, 0.24, -0.02]);
    for (const sx of [-1, 1]) mothAntenna(k, c, head, sx, [sx * 0.07, 0.14, 0.05], 0.3, 5, PEACH, AMBER);
    insectLegs(k, c, c.body, ty - 0.14, 0.15, 0.12, 0.012);
    for (const sx of [-1, 1]) mothWing(k, c, c.body, sx, [sx * 0.14, ty + 0.06, -0.03], { L: 0.52, col: PEACH, edge: AMBER, hind: PEACH, spot: EMBER, spots: 2, base: PI / 2 - 0.35, amp: 0.4, speed: 11 });
    for (let i = 0; i < 3; i++) sparkle(k, c, c.body, i % 2 ? GOLD : AMBER, 0.02, [Math.cos(i * 2.1) * 0.5, 0.5 + i * 0.22, Math.sin(i * 2.1) * 0.3], 0.06);
    return;
  }
  // III `pyrewing`: a lantern abdomen, big wings, a gold crown
  floater(c, 0.36);
  const ty = 0.98;
  k.sphere(c.body, WAX, 0.26, [0, ty, 0], [1, 1.05, 1]);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * PI * 2;
    ball(k, c.body, WAX, 0.095, [Math.cos(a) * 0.22, ty + 0.17 + Math.sin(i * 2.1) * 0.02, Math.sin(a) * 0.2]);
  }
  k.torus(c.body, PEACH, 0.24, 0.045, [0, ty + 0.1, 0], [PI / 2, 0, 0]);
  // Lantern abdomen: an amber paper lantern, glowing window panes, a flame dripping wax at the bottom, two ribbons
  const ab = k.group(c.body, [0, ty - 0.16, -0.02], [0.22, 0, 0]);
  k.lathe(ab, AMBER, [[0.001, -0.62], [0.08, -0.6], [0.16, -0.48], [0.2, -0.3], [0.19, -0.12], [0.12, 0], [0.001, 0.02]]);
  for (const [R, y] of [[0.16, -0.48], [0.2, -0.3], [0.19, -0.12]]) k.torus(ab, PEACH, R, 0.012, [0, y, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + 0.3;
    const wg = new THREE.SphereGeometry(0.045, 10, 8);
    wg.scale(1, 2.2, 0.5);
    k.glow(ab, wg, GOLD, 2.4, [Math.sin(a) * 0.19, -0.3, Math.cos(a) * 0.19], [0, a, 0]);
  }
  k.glowSphere(ab, GOLD, 0.05, [0, -0.62, 0], 2.6);
  k.flame(ab, FLAME, FCORE, 0.07, [0, -0.6, 0], [PI, 0, 0]);
  for (const sx of [-1, 1]) {
    tube(k, ab, EMBER, [[sx * 0.06, -0.58, 0.02], [sx * 0.13, -0.68, -0.06], [sx * 0.11, -0.78, -0.14]], 0.022, 0.006);
    const st = k.group(ab, [sx * 0.11, -0.78, -0.14]);
    k.glowSphere(st, FLAME, 0.028, [0, 0, 0], 2.6);
    c.flickers.push({ g: st, base: st.scale.clone(), speed: 10 + sx, amt: 0.3 });
  }
  const head = k.group(c.body, [0, ty + 0.36, 0.05]);
  c.head = head;
  k.sphere(head, WAX, 0.2);
  faceEyes(k, head, 0.2, { x: 0.085, y: 0.02, r: 0.07, iris: EMBER, glow: true });
  for (const sx of [-1, 1]) lashes(k, head, SOOT, sx, [sx * 0.15, 0.08, 0.13], 0.045);
  k.blush(head, 0.14, -0.06, 0.14, 0.032, 0xffb0a0);
  smile(k, head, SOOT, 0.03, 0.006, [0, -0.07, 0.195]);
  // Gold crown and a big candle flame
  const crown = k.group(head, [0, 0.15, -0.01], [-0.1, 0, 0]);
  k.torus(crown, GOLD, 0.13, 0.02, [0, 0, 0], [PI / 2, 0, 0]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2 + PI;
    k.cone(crown, GOLD, 0.022, 0.07, [Math.sin(a) * 0.13, 0.01, Math.cos(a) * 0.13], [0, 0, 0], 6);
  }
  k.glowSphere(crown, EMBER, 0.03, [0, 0.02, 0.135], 2.6);
  k.cyl(head, SOOT, 0.014, 0.018, 0.14, [0, 0.2, -0.02], [0, 0, 0], 8);
  k.flame(head, FLAME, FCORE, 0.14, [0, 0.27, -0.02]);
  for (const sx of [-1, 1]) mothAntenna(k, c, head, sx, [sx * 0.08, 0.16, 0.06], 0.42, 7, PEACH, GOLD);
  insectLegs(k, c, c.body, ty - 0.18, 0.2, 0.15, 0.014);
  for (const sx of [-1, 1]) mothWing(k, c, c.body, sx, [sx * 0.18, ty + 0.08, -0.04], { L: 0.85, col: AMBER, edge: EMBER, hind: PEACH, spot: GOLD, spots: 3, eye: EMBER, veins: GOLD, tails: EMBER, flame: FLAME, base: PI / 2 - 0.3, amp: 0.28, speed: 5 });
  for (let i = 0; i < 5; i++) sparkle(k, c, c.body, i % 2 ? GOLD : EMBER, 0.022, [Math.cos(i * 1.9) * 0.7, 0.4 + i * 0.25, Math.sin(i * 1.9) * 0.4], 0.07);
};

// ───────────────────────── North shore of the Tidesong Isles: the `icecrown` family (water) ─────────────────────────
// Design language: I an all-white fluffy snowball with only a small skullcap on top in blue → II an adolescent with a navy back and a clean line down to the white chest, three glowing ice plumes sweeping back from the top of the head →
// III a tall emperor: a hexagonal ice-crystal crown, gold pauldrons, a sapphire medal, a translucent ice cloak. The face is the soul: big eyes set low, a small forward beak, with the expression going from innocent to confident to majestic.

const NAVY = 0x243468;
const NAVY_DK = 0x1b2a4a;
const WHITE = 0xffffff;
const PGOLD = 0xffcf5a;
const ICE = 0x9fe8ff;
const ICE_GLOW = 0xcff6ff;
const ICE_PALE = 0xdcf6ff;
const ICE_EDGE = 0x7fdcff;
const ORANGE = 0xff9a3a;
const ORANGE_DK = 0xe07a30;
const BLUSH = 0xffb0b8;
const IRIS = 0x2f6fe0;
const IRIS_ICE = 0x46b8ff;
const SAPPHIRE = 0x3f8cff;
const LINE = 0x1b1026;
/** Navy blue smears into black blobs on the dark side of the three-step toon ramp: add a little blue emissive to lift the dark side */
const NAVY_O: PartOpts = { emissive: 0x1a2a5a, emissiveAmt: 0.15 };
/** Depth of a point on a sphere (for parts stuck to the face) */
const onSphere = (R: number, x: number, y: number): number => Math.sqrt(Math.max(0.0025, R * R - x * x - y * y));
/** A sphere's "height → radius" lookup, for ovalPatch to stick onto the face */
const sphereR = (R: number) => (y: number): number => Math.sqrt(Math.max(0.0004, R * R - y * y));

/** Draw a smooth surface-of-revolution profile from a few control points ([radius, height], bottom to top): returns the points for lathe, plus a "radius at a given height" lookup so color patches can be stuck on the same surface */
function smoothProfile(ctrl: [number, number][], n = 24): { pts: [number, number][]; radiusAt: (y: number) => number } {
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, 'centripetal');
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const p = curve.getPoint(i / n);
    pts.push([Math.max(0.001, p.x), p.y]);
  }
  const samples: [number, number][] = [];
  for (let i = 0; i <= 240; i++) {
    const p = curve.getPoint(i / 240);
    samples.push([p.y, Math.max(0.001, p.x)]);
  }
  const radiusAt = (y: number): number => {
    if (y <= samples[0][0]) return samples[0][1];
    for (let i = 1; i < samples.length; i++) {
      if (y <= samples[i][0]) {
        const [y0, r0] = samples[i - 1];
        const [y1, r1] = samples[i];
        const t = y1 > y0 ? (y - y0) / (y1 - y0) : 0;
        return r0 + (r1 - r0) * t;
      }
    }
    return samples[samples.length - 1][1];
  };
  return { pts, radiusAt };
}

/** Elliptical color patch stuck on the surface of revolution (white chest, white face, gold neck patch): generated hugging the surface in (height, azimuth) elliptical coordinates, lifted by lift along the normal;
 *  a normal-extruded outline cannot draw lines at the edge of a thin sheet, so a ring of thin dark tube is also drawn along the boundary as a dividing line. egg > 0 narrow on top and wide below (chest), < 0 wide on top and narrow below (face); rotY turns it to the side */
function ovalPatch(k: Kit, parent: THREE.Object3D, col: C, radiusAt: (y: number) => number, o: { yc: number; ay: number; aphi: number; lift?: number; rotY?: number; line?: number; egg?: number; emissive?: C; emissiveAmt?: number }): THREE.Group {
  const g = k.group(parent, [0, 0, 0], [0, o.rotY ?? 0, 0]);
  const lift = o.lift ?? 0.008;
  const egg = o.egg ?? 0;
  const K = 6;
  const M = 40;
  type V = { p: THREE.Vector3; n: THREE.Vector3 };
  const vert = (rho: number, a: number): V => {
    const ca = Math.cos(a);
    const y = o.yc + rho * o.ay * ca;
    const phi = rho * o.aphi * Math.sin(a) * (1 - egg * ca);
    const r = radiusAt(y) + lift;
    const e = 0.004;
    const dr = (radiusAt(y + e) - radiusAt(y - e)) / (2 * e);
    return { p: new THREE.Vector3(r * Math.sin(phi), y, r * Math.cos(phi)), n: new THREE.Vector3(Math.sin(phi), -dr, Math.cos(phi)).normalize() };
  };
  const pos: number[] = [];
  const nrm: number[] = [];
  const push = (a: V, b: V, c: V): void => {
    // The triangle winding must make the front face outward (the same direction as the surface normal)
    const fn = new THREE.Vector3().subVectors(b.p, a.p).cross(new THREE.Vector3().subVectors(c.p, a.p));
    for (const v of fn.dot(a.n) < 0 ? [a, c, b] : [a, b, c]) {
      pos.push(v.p.x, v.p.y, v.p.z);
      nrm.push(v.n.x, v.n.y, v.n.z);
    }
  };
  for (let i = 0; i < K; i++) {
    for (let j = 0; j < M; j++) {
      const a0 = (j / M) * PI * 2;
      const a1 = ((j + 1) / M) * PI * 2;
      const A = vert(i / K, a0);
      const B = vert((i + 1) / K, a0);
      const Cq = vert((i + 1) / K, a1);
      const D = vert(i / K, a1);
      push(A, B, Cq);
      if (i > 0) push(A, Cq, D);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  k.mesh(g, geo, col, [0, 0, 0], [0, 0, 0], { outline: false, emissive: o.emissive, emissiveAmt: o.emissiveAmt });
  if (o.line !== 0) {
    const loop: THREE.Vector3[] = [];
    for (let j = 0; j < M; j++) loop.push(vert(1, (j / M) * PI * 2).p);
    const curve = new THREE.CatmullRomCurve3(loop, true, 'catmullrom', 0.5);
    k.glow(g, new THREE.TubeGeometry(curve, M * 2, o.line ?? 0.011, 6, true), LINE, 1);
  }
  return g;
}

/** Penguin foot: an orange flat web + three toes, toes pointing outward (splayed); anklet is III's gold ankle ring */
function penguinFoot(k: Kit, c: Creature, parent: THREE.Object3D, sx: number, pos: V3, r: number, yaw: number, anklet?: C): THREE.Group {
  const g = k.group(parent, pos, [0, sx * yaw, 0]);
  ball(k, g, ORANGE, r, [0, 0, 0], [1, 0.55, 1.5]);
  for (let i = -1; i <= 1; i++) k.capsule(g, ORANGE, r * 0.32, r * 0.95, [i * r * 0.6, -r * 0.02, r * 1.25], [PI / 2, 0, i * 0.4]);
  if (anklet) k.torus(g, anklet, r * 0.72, r * 0.17, [0, r * 0.38, -r * 0.25], [PI / 2, 0, 0], PI * 2, { emissive: anklet, emissiveAmt: 0.12 });
  c.legs.push({ g, phase: sx > 0 ? 0 : PI, amp: 0.7 });
  return g;
}

/** Small, forward-pointing beak: a flat wide upper beak, a slightly smaller and darker lower beak; tip gives III's gilded beak tip */
function beak(k: Kit, head: THREE.Object3D, pos: V3, len: number, r: number, o: { tip?: C; tilt?: number } = {}): void {
  const tilt = o.tilt ?? 0.18;
  const rot: V3 = [PI / 2 + tilt, 0, 0];
  const up = new THREE.ConeGeometry(r, len, 12, 1);
  up.translate(0, len / 2, 0);
  up.scale(1.25, 1, 0.8);
  k.mesh(head, up, ORANGE, pos, rot);
  const lo = new THREE.ConeGeometry(r * 0.85, len * 0.8, 10, 1);
  lo.translate(0, len * 0.4, 0);
  lo.scale(1.15, 1, 0.6);
  k.mesh(head, lo, ORANGE_DK, [pos[0], pos[1] - r * 0.6, pos[2]], [PI / 2 + tilt + 0.14, 0, 0]);
  if (o.tip) {
    const t = new THREE.ConeGeometry(r * 0.44, len * 0.36, 12, 1);
    t.translate(0, len * 0.18, 0);
    t.scale(1.25, 1, 0.8);
    // Gilded beak tip: pushed along the upper beak's direction to the tip
    const d = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...rot)).multiplyScalar(len * 0.64);
    k.mesh(head, t, o.tip, [pos[0] + d.x, pos[1] + d.y, pos[2] + d.z], rot, { outline: false, emissive: o.tip, emissiveAmt: 0.2 });
  }
}

/** Mouth-corner arc: up = true is a smile (opening up), false is a majestic downturned mouth corner; rotX makes the arc hug the slope of the chin */
function mouthArc(k: Kit, head: THREE.Object3D, R: number, r: number, pos: V3, w: number, up: boolean, rotX: number): THREE.Mesh {
  const g = new THREE.TorusGeometry(R, r, 6, 16, w * 2);
  g.rotateZ(up ? -PI / 2 - w : PI / 2 - w);
  return k.glow(head, g, LINE, 1, pos, [rotX, 0, 0]);
}

/** III's eyes: whites, glowing ice-blue irises, dark pupils, two glints, a navy upper eyelid (pressed low on the inner side = sharp). It does not use k.eyes's glow mode, which would bloom the whole eye into a light dot */
function regalEyes(k: Kit, c: Creature, head: THREE.Object3D, o: { x: number; y: number; z: number; r: number; lid: C; yaw?: number; tilt?: number }): void {
  const tilt = o.tilt ?? 0.16;
  for (const sx of [-1, 1]) {
    const g = k.group(head, [sx * o.x, o.y, o.z], [0, sx * (o.yaw ?? 0.26), 0]);
    const r = o.r;
    const sclera = new THREE.SphereGeometry(r, 20, 16);
    sclera.scale(1, 1.0, 0.45);
    k.mesh(g, sclera, WHITE, [0, 0, 0], [0, 0, sx * tilt]);
    const iris = new THREE.SphereGeometry(r * 0.72, 18, 14);
    iris.scale(1, 1.08, 0.42);
    k.mesh(g, iris, IRIS_ICE, [0, -r * 0.06, r * 0.2], [0, 0, 0], { outline: false, emissive: ICE_GLOW, emissiveAmt: 0.35 });
    const pupil = new THREE.SphereGeometry(r * 0.36, 14, 12);
    pupil.scale(0.85, 1.1, 0.4);
    k.mesh(g, pupil, 0x0e1a3a, [0, -r * 0.08, r * 0.3], [0, 0, 0], { outline: false });
    k.glowSphere(g, WHITE, r * 0.2, [-r * 0.28, r * 0.3, r * 0.42], 1.6);
    k.glowSphere(g, WHITE, r * 0.09, [r * 0.26, -r * 0.28, r * 0.42], 1.4);
    const lid = new THREE.SphereGeometry(r * 1.06, 20, 8, 0, PI * 2, 0, 0.72);
    lid.scale(1, 1.0, 0.5);
    k.mesh(g, lid, o.lid, [0, r * 0.04, 0.003], [-0.1, 0, sx * 0.28], { outline: false });
    c.eyes.push(g);
  }
}

/** Penguin flipper: a navy flat leaf blade with an ice-blue line along the edge (the thinner, narrower blade leans toward the trailing edge and shows only at the edge); twist turns the wide face outward, base is the raised angle when idle */
function flipper(k: Kit, c: Creature, parent: THREE.Object3D, sx: number, pos: V3, len: number, wid: number, base: THREE.Euler, twist: number, o: { col?: C; edge?: C } = {}): THREE.Group {
  const g = k.group(parent, pos, [base.x, base.y, base.z]);
  const t = k.group(g, [0, 0, 0], [0, sx * twist, 0]);
  const col = o.col ?? NAVY;
  k.blade(t, col, len, wid, wid * 0.34, [0, 0, 0], [0, 0, 0], col === NAVY ? NAVY_O : {});
  if (o.edge) k.blade(t, o.edge, len * 1.01, wid * 0.7, wid * 0.22, [sx * wid * 0.25, 0, 0], [0, 0, 0], { outline: false, emissive: o.edge, emissiveAmt: 0.35 });
  c.arms.push({ g, side: sx, base });
  return g;
}

/** Hexagonal ice-crystal pillar: a six-segment lathe shaft + a conical top. The body uses flat normals to show the crystal faces, and the outline uses the lathe's original smooth normals; the toon material adds an ice-blue emissive = inner glow, with a bright point at the tip */
function iceCrystal(k: Kit, c: Creature, parent: THREE.Object3D, r: number, h: number, pos: V3, rot: V3 = [0, 0, 0], o: { glow?: number; tip?: boolean } = {}): THREE.Mesh {
  const prof: [number, number][] = [[0.001, 0], [r * 0.85, 0], [r, h * 0.12], [r * 0.9, h * 0.66], [r * 0.42, h * 0.9], [0.001, h]];
  const smooth = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 6);
  const flat = smooth.toNonIndexed();
  flat.computeVertexNormals();
  const m = k.mesh(parent, flat, ICE, pos, rot, { outline: false, emissive: ICE_GLOW, emissiveAmt: o.glow ?? 0.18 });
  m.add(new THREE.Mesh(smooth, c.outlines[0]));
  if (o.tip !== false) k.glowSphere(m, WHITE, r * 0.35, [0, h, 0], 1.5);
  return m;
}

/** Small snowflake: three glowing thin rods crossed into six arms, each arm with a pair of small branches and a bright point at the end (I's hat tip) */
function snowflake(k: Kit, parent: THREE.Object3D, pos: V3, R: number): THREE.Group {
  const g = k.group(parent, pos);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI;
    rod(k, g, ICE_GLOW, [Math.cos(a) * R, Math.sin(a) * R, 0], [-Math.cos(a) * R, -Math.sin(a) * R, 0], R * 0.09, 1.6, false);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    k.glowSphere(g, WHITE, R * 0.16, [Math.cos(a) * R, Math.sin(a) * R, 0], 2);
    const bx = Math.cos(a) * R * 0.55;
    const by = Math.sin(a) * R * 0.55;
    for (const s of [-1, 1]) {
      const b = a + s * 1.05;
      rod(k, g, ICE_GLOW, [bx, by, 0], [bx + Math.cos(b) * R * 0.32, by + Math.sin(b) * R * 0.32, 0], R * 0.06, 1.6, false);
    }
  }
  return g;
}

/** A mesh sheet generated from a parametric (v from top to bottom 0 to 1, u from left to right −1 to 1); flip reverses the winding (for the cloak's inner face) */
function sheet(at: (v: number, u: number) => THREE.Vector3, rows: number, cols: number, flip = false): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= cols; j++) {
      const p = at(i / rows, -1 + (j / cols) * 2);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j;
      const b = a + 1;
      const d = a + cols + 1;
      const e = d + 1;
      if (flip) idx.push(a, b, d, b, e, d);
      else idx.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Ice cloak: a curved surface hanging from behind the shoulders to the ankles, flaring out toward the bottom. One single-sided translucent toon sheet each for the outside and inside (rim light = the Fresnel feel of ice),
 *  with a ring of pale ice-blue piping along the edge and a row of icicles hanging from the hem. The outer group swings front to back, the inner group left to right */
function iceCape(k: Kit, c: Creature, parent: THREE.Object3D, o: { top: number; bottom: number; rho0: number; rho1: number; phi0: number; phi1: number }): THREE.Group {
  const sway = k.group(parent, [0, o.top, 0]);
  const g = k.group(sway);
  c.tails.push({ g: sway, phase: 0.4, amp: 0.045, axis: 'x' });
  c.tails.push({ g, phase: 2.1, amp: 0.03, axis: 'z' });
  const drop = o.top - o.bottom;
  const at = (v: number, u: number): THREE.Vector3 => {
    const rho = o.rho0 + (o.rho1 - o.rho0) * Math.pow(v, 1.5);
    const phi = u * (o.phi0 + (o.phi1 - o.phi0) * v);
    return new THREE.Vector3(rho * Math.sin(phi), -v * drop, -rho * Math.cos(phi));
  };
  for (const flip of [false, true]) {
    const mat = toonMaterial(0xc8f0ff, { rim: 1.0, emissive: ICE, emissiveAmt: 0.3, opacity: 0.7 });
    c.mats.push(mat);
    g.add(new THREE.Mesh(sheet(at, 14, 20, flip), mat));
  }
  // Collar: a gold arc ring clasps the cloak between the two pauldrons
  const collar = new THREE.TorusGeometry(o.rho0, 0.02, 8, 24, o.phi0 * 2);
  collar.rotateZ(-o.phi0 - PI / 2);
  collar.rotateX(PI / 2);
  k.mesh(g, collar, PGOLD, [0, 0, 0], [0, 0, 0], { emissive: PGOLD, emissiveAmt: 0.12 });
  const edge: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) edge.push(at(i / 6, -1));
  for (let i = 1; i <= 12; i++) edge.push(at(1, -1 + (i / 12) * 2));
  for (let i = 5; i >= 0; i--) edge.push(at(i / 6, 1));
  k.mesh(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, false, 'catmullrom', 0.3), 72, 0.013, 6, false), ICE_EDGE);
  for (let i = 0; i < 7; i++) {
    const p = at(1, -0.85 + (i / 6) * 1.7);
    k.cone(g, ICE_PALE, 0.02, i % 2 ? 0.07 : 0.1, [p.x, p.y + 0.012, p.z], [PI, 0, 0], 8, { emissive: ICE_GLOW, emissiveAmt: 0.4 });
  }
  return sway;
}

/** Short ice-blue strip stuck on a surface (II's V on the chest) */
function iceBar(k: Kit, parent: THREE.Object3D, a: V3, b: V3, r: number): THREE.Mesh {
  const va = vec(a);
  const vb = vec(b);
  const d = vb.clone().sub(va);
  const m = k.capsule(parent, ICE, r, Math.max(0.001, d.length() - r * 2), [0, 0, 0], [0, 0, 0], { outline: false, emissive: ICE_GLOW, emissiveAmt: 0.35 });
  m.position.copy(va.add(vb).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

const icecrown: Builder = (k, c, s) => {
  c.archetype = 'biped';
  if (s === 1) {
    // I: a rolling white fluffball (head-to-body ratio 1:1.2), a small skullcap on top with a small snowflake at its tip; big eyes set low, blush, a small forward beak, short flippers slightly spread, orange feet splayed
    const R = 0.36;
    const cy = 0.42;
    const head = k.group(c.body, [0, cy, 0]);
    c.head = head;
    k.sphere(head, WHITE, R);
    // Fluffy edge: a ring along the lower edge from the sides to the back, three small ones low on the front (avoiding the face), a few on the back of the head, each outlined into a wavy silhouette
    for (let i = 0; i < 7; i++) {
      const a = PI * 0.38 + (i / 6) * PI * 1.24;
      ball(k, head, WHITE, 0.1 + rnd(i) * 0.02, [Math.sin(a) * 0.28, -0.19 + rnd(i + 9) * 0.03, Math.cos(a) * 0.28], [1, 0.9, 1]);
    }
    for (let i = -1; i <= 1; i++) ball(k, head, WHITE, 0.085 + Math.abs(i) * 0.01, [Math.sin(i * 0.4) * 0.21, -0.29 + Math.abs(i) * 0.02, Math.cos(i * 0.4) * 0.21], [1, 0.85, 1]);
    for (let i = 0; i < 6; i++) {
      const a = -PI * 0.45 + (i / 5) * PI * 0.9;
      ball(k, head, WHITE, 0.085 + rnd(i + 20) * 0.02, [Math.sin(a) * 0.31, 0.03 + rnd(i + 30) * 0.08, -Math.cos(a) * 0.31]);
    }
    // Skullcap: a navy spherical cap covering thirty percent of the top of the head + piping, with a small snowflake at its tip that sways and turns
    const capT = 1.0;
    const cap = new THREE.SphereGeometry(R * 1.02, 28, 12, 0, PI * 2, 0, capT);
    k.mesh(head, cap, NAVY, [0, 0, 0], [0, 0, 0], NAVY_O);
    k.torus(head, NAVY, R * 1.02 * Math.sin(capT), 0.026, [0, R * 1.02 * Math.cos(capT), 0], [PI / 2, 0, 0], PI * 2, NAVY_O);
    const stalk = k.group(head, [0, R, 0]);
    k.capsule(stalk, NAVY, 0.014, 0.05, [0, 0.03, 0], [0, 0, 0], NAVY_O);
    const flake = snowflake(k, stalk, [0, 0.135, 0], 0.075);
    c.spinners.push({ g: flake, speed: 1.1, axis: 'y' });
    c.tails.push({ g: stalk, phase: 0.7, amp: 0.14, axis: 'z' });
    // Face: big eyes set low (at forty percent of the head height), the eye spacing one eye wide, blush, a small forward-pointing beak
    faceEyes(k, head, R, { x: 0.15, y: -0.07, r: 0.08, iris: IRIS });
    k.blush(head, 0.19, -0.15, onSphere(R, 0.19, -0.15) + 0.012, 0.05, BLUSH);
    beak(k, head, [0, -0.13, onSphere(R, 0, -0.13) - 0.02], 0.09, 0.04, { tilt: 0.35 });
    // Short flippers slightly spread forward, a small tuft of fluff for a tail
    for (const sx of [-1, 1]) flipper(k, c, c.body, sx, [sx * 0.32, cy - 0.06, 0.15], 0.22, 0.13, new THREE.Euler(-0.7, 0, -sx * 1.7), 0.6, { col: WHITE });
    k.blade(head, WHITE, 0.12, 0.1, 0.05, [0, -0.2, -0.28], [-2.2, 0, 0]);
    for (const sx of [-1, 1]) penguinFoot(k, c, c.body, sx, [sx * 0.13, 0.045, 0.17], 0.065, 0.45);
    return;
  }
  if (s === 2) {
    // II (head-to-body ratio 1:2.2): upright and streamlined, a navy back and a white chest with a clean line between, an ice-blue V on the chest; three glowing ice plumes sweeping back from the top of the head; one flipper raised, one foot stepping forward
    const body = smoothProfile([[0.001, 0.08], [0.17, 0.09], [0.26, 0.24], [0.275, 0.4], [0.24, 0.56], [0.17, 0.66], [0.001, 0.7]]);
    k.lathe(c.body, NAVY, body.pts, [0, 0, 0], [0, 0, 0], NAVY_O);
    ovalPatch(k, c.body, WHITE, body.radiusAt, { yc: 0.36, ay: 0.26, aphi: 1.05, egg: 0.2 });
    for (const sx of [-1, 1]) {
      const y0 = 0.575;
      const y1 = 0.49;
      const x0 = sx * 0.08;
      iceBar(k, c.body, [x0, y0, Math.sqrt(Math.max(0.001, body.radiusAt(y0) ** 2 - x0 * x0)) + 0.014], [0, y1, body.radiusAt(y1) + 0.014], 0.012);
    }
    const hr = 0.21;
    const head = k.group(c.body, [0, 0.74, 0.02]);
    c.head = head;
    k.sphere(head, NAVY, hr, [0, 0, 0], [1, 1, 1], [0, 0, 0], NAVY_O);
    ovalPatch(k, head, WHITE, sphereR(hr), { yc: -0.04, ay: 0.155, aphi: 1.2, egg: -0.15 });
    // Face: big eyes set low, slightly upturned confident brows, a small beak, a smile arc below the beak
    faceEyes(k, head, hr, { x: 0.12, y: -0.045, r: 0.064, iris: IRIS });
    for (const sx of [-1, 1]) brow(k, head, NAVY_DK, sx, [sx * 0.11, 0.06, onSphere(hr, 0.11, 0.06) + 0.012], 0.3, 0.06, 0.011);
    beak(k, head, [0, -0.11, onSphere(hr, 0, -0.11) - 0.015], 0.115, 0.037, { tilt: 0.3 });
    mouthArc(k, head, 0.07, 0.007, [0, -0.11, onSphere(hr, 0, -0.18) + 0.01 + 0.07 * Math.sin(0.55)], 0.6, true, 0.55);
    // Three ice plumes: flat curved horns sweeping back, a bright point at each plume tip, trembling slightly
    const quill = (pos: V3, rot: V3, len: number, phase: number): void => {
      const g = k.group(head, pos);
      const m = k.horn(g, ICE, 0.03, len, len * 0.55, [0, 0, 0], rot, { emissive: ICE_GLOW, emissiveAmt: 0.3 });
      m.scale.x = 0.55;
      const tip = new THREE.Vector3(0, len, -len * 0.55).applyEuler(new THREE.Euler(...rot));
      sparkle(k, c, g, WHITE, 0.022, [tip.x, tip.y, tip.z], 0.012);
      c.tails.push({ g, phase, amp: 0.06, axis: 'x' });
    };
    quill([0, 0.16, -0.04], [-0.5, 0, 0], 0.27, 0);
    quill([0.075, 0.14, -0.05], [-0.42, 0, -0.42], 0.21, 1.3);
    quill([-0.075, 0.14, -0.05], [-0.42, 0, 0.42], 0.21, 2.6);
    // Right flipper raised, left flipper lowered, right foot stepping forward
    flipper(k, c, c.body, 1, [0.25, 0.5, 0.02], 0.36, 0.14, new THREE.Euler(-0.2, 0, -0.75), 0.8, { edge: ICE });
    flipper(k, c, c.body, -1, [-0.25, 0.5, 0.02], 0.36, 0.14, new THREE.Euler(0.1, 0, 2.15), 0.8, { edge: ICE });
    for (let i = -1; i <= 1; i++) k.blade(c.body, NAVY, 0.16, 0.08, 0.04, [i * 0.05, 0.16, -0.21], [-2.3, i * 0.3, 0], NAVY_O);
    penguinFoot(k, c, c.body, 1, [0.12, 0.045, 0.2], 0.07, 0.35);
    penguinFoot(k, c, c.body, -1, [-0.13, 0.045, 0.1], 0.07, 0.4);
    return;
  }
  // III `icecrown` (head-to-body ratio 1:2.8): a tall emperor. A hexagonal ice-crystal crown + gold ring, gold pauldrons, a sapphire medal with a gold chain, a translucent ice cloak, a gilded beak tip, a spinning ice ring and snow grains at the feet
  const body = smoothProfile([[0.001, 0.1], [0.2, 0.11], [0.3, 0.3], [0.325, 0.52], [0.31, 0.72], [0.27, 0.86], [0.18, 0.95], [0.001, 0.99]]);
  k.lathe(c.body, NAVY, body.pts, [0, 0, 0], [0, 0, 0], NAVY_O);
  ovalPatch(k, c.body, WHITE, body.radiusAt, { yc: 0.5, ay: 0.37, aphi: 0.95, egg: 0.2 });
  const hr = 0.215;
  const head = k.group(c.body, [0, 1.04, 0.01]);
  c.head = head;
  k.sphere(head, NAVY, hr, [0, 0, 0], [1, 1, 1], [0, 0, 0], NAVY_O);
  ovalPatch(k, head, WHITE, sphereR(hr), { yc: -0.04, ay: 0.165, aphi: 1.1, egg: -0.1 });
  // The emperor penguin's gold neck patch
  for (const sx of [-1, 1]) ovalPatch(k, head, PGOLD, sphereR(hr), { yc: -0.06, ay: 0.11, aphi: 0.36, rotY: sx * 1.58, egg: 0.3, emissive: PGOLD, emissiveAmt: 0.15 });
  // Face: glowing ice-blue eyes (whites and eyelids kept), sharp brows, a gilded beak tip, a downturned mouth corner
  regalEyes(k, c, head, { x: 0.118, y: -0.04, z: onSphere(hr, 0.118, -0.04) - 0.01, r: 0.07, lid: NAVY });
  for (const sx of [-1, 1]) brow(k, head, NAVY_DK, sx, [sx * 0.112, 0.075, onSphere(hr, 0.112, 0.075) + 0.012], 0.5, 0.075, 0.014);
  beak(k, head, [0, -0.105, onSphere(hr, 0, -0.105) - 0.015], 0.15, 0.042, { tip: PGOLD, tilt: 0.3 });
  mouthArc(k, head, 0.06, 0.007, [0, -0.245, onSphere(hr, 0, -0.185) + 0.01 - 0.06 * Math.sin(0.9)], 0.65, false, 0.9);
  // Crown: a gold ring + small ice-blue beads, five hexagonal ice-crystal pillars in an arc at the front (tallest in the middle), two small ones at the back; a breathing glow in the center
  const crown = k.group(head);
  k.torus(crown, PGOLD, 0.19, 0.03, [0, 0.105, 0], [PI / 2, 0, 0], PI * 2, { emissive: PGOLD, emissiveAmt: 0.12 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2 + PI / 8;
    k.glowSphere(crown, ICE_GLOW, 0.014, [Math.sin(a) * 0.215, 0.105, Math.cos(a) * 0.215], 1.5);
  }
  const spikes: [number, number, number][] = [[0, 0.36, 0.05], [0.55, 0.28, 0.042], [-0.55, 0.28, 0.042], [1.1, 0.21, 0.036], [-1.1, 0.21, 0.036], [2.3, 0.15, 0.03], [-2.3, 0.15, 0.03]];
  for (const [a, h, r] of spikes) iceCrystal(k, c, crown, r, h, [Math.sin(a) * 0.155, 0.12, Math.cos(a) * 0.155], [0.28 * Math.cos(a), 0, -0.28 * Math.sin(a)]);
  const halo = k.group(crown, [0, 0.27, 0]);
  k.glowSphere(halo, ICE_GLOW, 0.11, [0, 0, 0], 1.2, [1.4, 1, 1.4], 0.12);
  c.flickers.push({ g: halo, base: new THREE.Vector3(1, 1, 1), speed: 2.6, amt: 0.3 });
  // Gold pauldrons: a dome + piping, each with a small ice crystal slanting outward
  for (const sx of [-1, 1]) {
    const sh = k.group(c.body, [sx * 0.275, 0.8, 0.0], [0, 0, -sx * 0.5]);
    const dome = new THREE.SphereGeometry(0.115, 20, 10, 0, PI * 2, 0, PI / 2 + 0.15);
    dome.scale(1, 0.75, 1);
    k.mesh(sh, dome, PGOLD, [0, 0, 0], [0, 0, 0], { emissive: PGOLD, emissiveAmt: 0.1 });
    k.torus(sh, PGOLD, 0.115, 0.018, [0, -0.018, 0], [PI / 2, 0, 0], PI * 2, { emissive: PGOLD, emissiveAmt: 0.1 });
    iceCrystal(k, c, sh, 0.024, 0.11, [sx * 0.015, 0.07, 0], [0, 0, -sx * 0.35]);
  }
  // Medal on the chest: a gold frame + a faceted sapphire, two gold chains hanging from the front edges of the pauldrons and clasping it
  const mz = body.radiusAt(0.68) + 0.012;
  k.torus(c.body, PGOLD, 0.055, 0.014, [0, 0.68, mz], [0, 0, 0], PI * 2, { emissive: PGOLD, emissiveAmt: 0.12 });
  const gem = new THREE.OctahedronGeometry(0.052, 0);
  gem.scale(1, 1.15, 0.45);
  facet(k, c, c.body, gem, SAPPHIRE, [0, 0.68, mz + 0.006], [0, 0, 0], { emissive: 0x7fc8ff, emissiveAmt: 0.5 });
  for (const sx of [-1, 1]) rod(k, c.body, PGOLD, [sx * 0.22, 0.78, 0.12], [sx * 0.05, 0.71, mz], 0.011, 0, false);
  // Long flippers hanging slightly spread (a shoulder-wide silhouette), the ice cloak, the feet (gold anklets)
  for (const sx of [-1, 1]) flipper(k, c, c.body, sx, [sx * 0.29, 0.75, 0.02], 0.5, 0.16, new THREE.Euler(0.1, 0, -sx * 2.45), 0.85, { edge: ICE });
  iceCape(k, c, c.body, { top: 0.86, bottom: 0.13, rho0: 0.26, rho1: 0.47, phi0: 0.85, phi1: 1.25 });
  for (const sx of [-1, 1]) penguinFoot(k, c, c.body, sx, [sx * 0.14, 0.05, 0.16], 0.075, 0.4, PGOLD);
  // A spinning ice ring at the feet (six shards make the rotation visible) + a faint sheet of ice, with snow grains floating slowly around
  const ring = k.group(c.body, [0, 0.025, 0.02]);
  k.glow(ring, new THREE.TorusGeometry(0.42, 0.011, 8, 56), ICE, 1.5, [0, 0, 0], [PI / 2, 0, 0], 0.9);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    const shard = new THREE.OctahedronGeometry(0.03, 0);
    shard.scale(0.6, 1.4, 0.6);
    k.glow(ring, shard, ICE_GLOW, 1.6, [Math.cos(a) * 0.42, 0.03, Math.sin(a) * 0.42]);
  }
  k.glow(ring, new THREE.CircleGeometry(0.42, 40), ICE, 0.9, [0, -0.005, 0], [-PI / 2, 0, 0], 0.14);
  c.spinners.push({ g: ring, speed: 0.6, axis: 'y' });
  for (let i = 0; i < 10; i++) {
    const a = rnd(i + 50) * PI * 2;
    const rr = 0.3 + rnd(i + 60) * 0.25;
    const y = 0.25 + rnd(i + 70) * 1.2;
    const m = k.glowSphere(c.body, WHITE, 0.011 + rnd(i + 80) * 0.008, [Math.cos(a) * rr, y, Math.sin(a) * rr], 1.8);
    c.bobbers.push({ g: m, base: y, amp: 0.05 + rnd(i + 90) * 0.05, speed: 0.6 + rnd(i + 100) * 0.6, phase: rnd(i + 110) * 6 });
  }
};

// ───────────────────────── Whispering Forest: the `dreamcap` family (nature) ─────────────────────────

const CAP = 0xb25ad9;
const CAP2 = 0x8a3ec0;
const CAPLITE = 0xd58cf0;
const STEM = 0xf6ecd8;
const STEM2 = 0xeadcc8;
const GILL = 0xe6c9ee;
const SPOT = 0xfff0ff;
const SGLOW = 0xffb8ff;
const DREAM = 0xe8a0ff;
const VEIL = 0xf3e6f4;
const MIRIS = 0x7a2ab0;
const MOUTH = 0x6a3a7a;

/** Gill disc under the mushroom cap: a round disc + fine radial gills */
function gills(k: Kit, cap: THREE.Object3D, R: number, y: number, n: number): void {
  k.cyl(cap, GILL, R, R, 0.02, [0, y, 0], [0, 0, 0], 28, { outline: false });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    k.mesh(cap, new THREE.BoxGeometry(0.01, 0.008, R * 0.8), CAP2, [Math.sin(a) * R * 0.5, y - 0.013, Math.cos(a) * R * 0.5], [0, a, 0], { outline: false });
  }
}

/** Spots on the cap: white dots or glowing scale dots, stuck to the cap's ellipsoid surface */
function capSpots(k: Kit, cap: THREE.Object3D, rad: V3, cy: number, n: number, col: C, glow: number, seed: number, r: number): void {
  for (let i = 0; i < n; i++) {
    const lat = 0.35 + rnd(seed + i) * 0.7;
    const lon = (i / n) * PI * 2 + rnd(seed + i + 9) * 0.6;
    dot(k, cap, col, r * (0.75 + rnd(seed + i + 3) * 0.5), [0, cy, 0], rad, lat, lon, { glow, flat: 0.32 });
  }
}

const dreamcap: Builder = (k, c, s) => {
  c.archetype = 'crawl';
  if (s === 1) {
    // I: a face on a short fat stem, wearing an oversized cap tilted to one side
    k.lathe(c.body, STEM, [[0.001, 0.0], [0.19, 0.0], [0.21, 0.08], [0.18, 0.2], [0.16, 0.3], [0.001, 0.32]]);
    const cap = k.group(c.body, [0, 0.27, -0.02], [-0.12, 0, 0.16]);
    c.head = cap;
    k.lathe(cap, CAP, [[0.001, -0.03], [0.3, -0.03], [0.37, 0.0], [0.36, 0.06], [0.3, 0.16], [0.18, 0.25], [0.001, 0.29]]);
    k.cyl(cap, GILL, 0.32, 0.32, 0.02, [0, -0.03, 0], [0, 0, 0], 28, { outline: false });
    capSpots(k, cap, [0.37, 0.29, 0.37], 0, 5, SPOT, 0, 11, 0.05);
    const bud = miniShroom(k, cap, [0.26, 0.12, 0.14], 0.06, CAPLITE, STEM, { rot: [0.3, 0, -0.6] });
    c.tails.push({ g: bud, phase: 2, amp: 0.1, axis: 'x' });
    faceEyes(k, c.body, [0.18, 0.16, 0.18], { x: 0.075, y: 0.19, cy: 0.16, r: 0.065, iris: MIRIS });
    k.blush(c.body, 0.135, 0.12, 0.15, 0.035);
    ball(k, c.body, MOUTH, 0.02, [0, 0.1, 0.19], [1, 1.2, 0.4], [0, 0, 0], { outline: false });
    for (const sx of [-1, 1]) {
      const g = k.group(c.body, [sx * 0.09, 0.03, 0.16]);
      ball(k, g, STEM2, 0.05, [0, 0, 0], [1, 0.6, 1.4]);
      c.legs.push({ g, phase: sx > 0 ? 0 : PI, amp: 0.5 });
    }
    for (let i = 0; i < 3; i++) sparkle(k, c, c.body, SGLOW, 0.016, [Math.cos(i * 2.2) * 0.3, 0.62 + i * 0.08, Math.sin(i * 2.2) * 0.25], 0.04);
    return;
  }
  if (s === 2) {
    // II: a taller stem, a ring skirt, a bell-shaped cap, small arms growing
    k.lathe(c.body, STEM, [[0.001, 0], [0.16, 0], [0.15, 0.15], [0.13, 0.35], [0.14, 0.5], [0.16, 0.58], [0.001, 0.6]]);
    k.cyl(c.body, STEM2, 0.13, 0.23, 0.1, [0, 0.31, 0], [0, 0, 0], 20);
    const cap = k.group(c.body, [0, 0.56, 0], [-0.1, 0, -0.14]);
    c.head = cap;
    k.lathe(cap, CAP, [[0.001, -0.03], [0.28, -0.03], [0.34, 0.02], [0.33, 0.1], [0.27, 0.22], [0.17, 0.33], [0.07, 0.4], [0.001, 0.42]]);
    gills(k, cap, 0.3, -0.03, 14);
    capSpots(k, cap, [0.34, 0.4, 0.34], 0.01, 6, SGLOW, 2.2, 21, 0.045);
    capSpots(k, cap, [0.34, 0.4, 0.34], 0.01, 3, SPOT, 0, 31, 0.03);
    k.glow(cap, new THREE.TorusGeometry(0.33, 0.03, 6, 32), DREAM, 0.9, [0, 0.0, 0], [PI / 2, 0, 0], 0.25);
    faceEyes(k, c.body, [0.135, 0.15, 0.135], { x: 0.06, y: 0.44, cy: 0.42, r: 0.058, iris: MIRIS });
    for (const sx of [-1, 1]) lashes(k, c.body, MOUTH, sx, [sx * 0.11, 0.49, 0.1], 0.035);
    k.blush(c.body, 0.11, 0.37, 0.1, 0.03);
    smile(k, c.body, MOUTH, 0.025, 0.006, [0, 0.36, 0.135]);
    for (const sx of [-1, 1]) {
      const base = new THREE.Euler(0.3, 0, -sx * 0.9);
      const g = k.group(c.body, [sx * 0.14, 0.4, 0.03], [base.x, base.y, base.z]);
      k.capsule(g, STEM, 0.035, 0.14, [0, -0.08, 0]);
      ball(k, g, STEM, 0.045, [0, -0.17, 0]);
      c.arms.push({ g, side: sx, base });
    }
    for (const sx of [-1, 1]) {
      const g = k.group(c.body, [sx * 0.08, 0.03, 0.14]);
      ball(k, g, STEM2, 0.05, [0, 0, 0], [1, 0.6, 1.4]);
      c.legs.push({ g, phase: sx > 0 ? 0 : PI, amp: 0.5 });
    }
    miniShroom(k, c.body, [0.22, 0.012, 0.1], 0.07, CAPLITE, STEM, { glow: true, rot: [0, 0, -0.15] });
    miniShroom(k, c.body, [-0.23, 0.012, -0.04], 0.055, CAP, STEM, { glow: true, rot: [0, 0, 0.2] });
    for (let i = 0; i < 5; i++) sparkle(k, c, c.body, i % 2 ? DREAM : SGLOW, 0.018, [Math.cos(i * 1.7) * 0.4, 0.55 + i * 0.12, Math.sin(i * 1.7) * 0.3], 0.07);
    const mist = k.group(c.body, [0.3, 0.62, 0.15]);
    k.glowSphere(mist, DREAM, 0.07, [0, 0, 0], 1.0, [1.4, 0.7, 1], 0.22);
    c.bobbers.push({ g: mist, base: 0.62, amp: 0.04, speed: 1.1, phase: 1 });
    return;
  }
  // III `dreamcap`: a wide skirt, a double-layered cap, a veil, a mushroom-lamp staff, a spinning fungus ring at the feet
  k.lathe(c.body, VEIL, [[0.001, 0], [0.4, 0], [0.38, 0.06], [0.3, 0.2], [0.2, 0.4], [0.15, 0.55], [0.16, 0.6]]);
  const veil = k.glow(c.body, new THREE.LatheGeometry([[0.47, 0.0], [0.43, 0.1], [0.33, 0.3], [0.23, 0.5], [0.2, 0.6]].map(([x, y]) => new THREE.Vector2(x, y)), 28), DREAM, 0.8, [0, 0, 0], [0, 0, 0], 0.2);
  (veil.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
  // Gilled edge on the skirt hem, glowing spore dots on the skirt, a deep-purple belt and gem at the waist
  k.torus(c.body, GILL, 0.395, 0.025, [0, 0.03, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2 + 0.2;
    const y = 0.12 + (i % 3) * 0.13;
    const r = 0.4 - 0.45 * y;
    const geo = new THREE.SphereGeometry(0.03 - (i % 3) * 0.005, 10, 8);
    geo.scale(1, 1, 0.35);
    const m = k.glow(c.body, geo, SGLOW, 2.0, [Math.sin(a) * r, y, Math.cos(a) * r]);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(Math.sin(a), 0.45, Math.cos(a)).normalize());
  }
  k.torus(c.body, CAP2, 0.165, 0.03, [0, 0.6, 0], [PI / 2, 0, 0]);
  k.glowSphere(c.body, SGLOW, 0.03, [0, 0.6, 0.18], 2.4);
  k.lathe(c.body, STEM, [[0.15, 0.58], [0.16, 0.66], [0.19, 0.8], [0.17, 0.92], [0.1, 0.98], [0.06, 1.04]]);
  k.cyl(c.body, GILL, 0.11, 0.3, 0.12, [0, 0.9, 0], [0, 0, 0], 24);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2;
    k.mesh(c.body, new THREE.BoxGeometry(0.01, 0.12, 0.01), CAP2, [Math.sin(a) * 0.2, 0.9, Math.cos(a) * 0.2], [0, 0, 0], { outline: false });
  }
  // Arms: the right hand holds the mushroom-lamp staff, the left hand holds up a spore light orb
  for (const sx of [-1, 1]) {
    const base = sx > 0 ? new THREE.Euler(0.1, 0, -0.35) : new THREE.Euler(0.55, 0, 0.5);
    const g = k.group(c.body, [sx * 0.19, 0.92, 0.02], [base.x, base.y, base.z]);
    k.capsule(g, STEM, 0.04, 0.2, [0, -0.11, 0]);
    k.cyl(g, CAPLITE, 0.045, 0.1, 0.16, [0, -0.28, 0], [0, 0, 0], 12);
    k.torus(g, GILL, 0.1, 0.014, [0, -0.36, 0], [PI / 2, 0, 0], PI * 2, { outline: false });
    ball(k, g, STEM, 0.04, [0, -0.39, 0]);
    c.arms.push({ g, side: sx, base });
    if (sx < 0) {
      const orb = k.group(g, [0, -0.46, 0.05]);
      k.glowSphere(orb, DREAM, 0.05, [0, 0, 0], 2.4);
      k.glowSphere(orb, SGLOW, 0.085, [0, 0, 0], 0.9, [1, 1, 1], 0.28);
      c.bobbers.push({ g: orb, base: -0.46, amp: 0.02, speed: 2.2, phase: 0 });
    }
  }
  rod(k, c.body, 0x7a5a6a, [0.35, 0.03, 0.12], [0.35, 1.3, 0.12], 0.014);
  const lamp = miniShroom(k, c.body, [0.35, 1.28, 0.12], 0.09, CAP2, STEM, { glow: true, spot: SGLOW });
  const lampLight = k.group(lamp, [0, 0.06, 0]);
  k.glowSphere(lampLight, SGLOW, 0.035, [0, 0, 0], 2.8);
  c.flickers.push({ g: lampLight, base: lampLight.scale.clone(), speed: 6, amt: 0.25 });
  // Head and double-layered cap
  const head = k.group(c.body, [0, 1.12, 0.02]);
  c.head = head;
  k.sphere(head, STEM, 0.17);
  faceEyes(k, head, 0.17, { x: 0.07, y: 0.02, r: 0.058, iris: MIRIS });
  for (const sx of [-1, 1]) lashes(k, head, MOUTH, sx, [sx * 0.125, 0.08, 0.11], 0.04);
  k.blush(head, 0.12, -0.05, 0.11, 0.03, 0xffb8d0);
  smile(k, head, MOUTH, 0.028, 0.006, [0, -0.07, 0.165]);
  const hat = k.group(head, [0, 0.1, -0.02], [-0.15, 0, 0.1]);
  k.lathe(hat, CAP, [[0.001, -0.02], [0.36, -0.02], [0.44, 0.03], [0.42, 0.1], [0.33, 0.2], [0.2, 0.28], [0.001, 0.32]]);
  gills(k, hat, 0.38, -0.02, 18);
  capSpots(k, hat, [0.44, 0.32, 0.44], 0.0, 7, SGLOW, 2.2, 41, 0.05);
  k.lathe(hat, CAP2, [[0.001, 0.28], [0.2, 0.28], [0.24, 0.32], [0.2, 0.4], [0.1, 0.46], [0.001, 0.48]]);
  capSpots(k, hat, [0.24, 0.18, 0.24], 0.3, 3, SGLOW, 2.2, 51, 0.035);
  k.glowSphere(hat, SGLOW, 0.035, [0, 0.49, 0], 2.6);
  const hv = k.glow(hat, new THREE.LatheGeometry([[0.3, -0.55], [0.4, -0.3], [0.44, -0.02]].map(([x, y]) => new THREE.Vector2(x, y)), 20, PI * 0.6, PI * 0.8), DREAM, 0.8, [0, 0, 0], [0, 0, 0], 0.28);
  (hv.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
  // Fungus ring: eight small mushrooms slowly circling her
  const ring = k.group(c.body, [0, 0, 0]);
  c.spinners.push({ g: ring, speed: 0.25, axis: 'y' });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    miniShroom(k, ring, [Math.sin(a) * 0.54, 0, Math.cos(a) * 0.54], 0.055 + (i % 2) * 0.02, i % 2 ? CAPLITE : CAP, STEM, { glow: true, rot: [0, a, 0] });
  }
  for (let i = 0; i < 6; i++) sparkle(k, c, c.body, i % 2 ? DREAM : SGLOW, 0.02, [Math.cos(i * 1.5) * 0.6, 0.5 + i * 0.17, Math.sin(i * 1.5) * 0.45], 0.07);
  for (let i = 0; i < 2; i++) {
    const mist = k.group(c.body, [Math.cos(i * 3) * 0.5, 0.8 + i * 0.4, Math.sin(i * 3) * 0.3]);
    k.glowSphere(mist, DREAM, 0.09, [0, 0, 0], 1.0, [1.5, 0.7, 1], 0.2);
    c.bobbers.push({ g: mist, base: 0.8 + i * 0.4, amp: 0.05, speed: 1.0, phase: i * 2 });
  }
};

// ───────────────────────── Skyhowl Highlands: the `skyreign` family (wind) ─────────────────────────

const SKY = 0xbfe3ff;
const BLUE = 0x5aa6e6;
const DEEP = 0x3a7fd0;
const FNAVY = 0x244f9a;
const FWHITE = 0xf8fbff;
const CREAM = 0xfff4dc;
const FGOLD = 0xffd040;
const BEAK = 0xffc040;
const DARKBEAK = 0x5a4a2a;
const WIND = 0xcfefff;
const MASK = 0x2a3a6a;

/** Falcon face: dark streaks below the eyes, fierce brows, a hooked beak */
function falconFace(k: Kit, head: THREE.Object3D, hr: number, o: { iris: C; glow?: boolean; beak: C; cheeks?: boolean }): void {
  if (o.cheeks) for (const sx of [-1, 1]) k.sphere(head, FWHITE, hr * 0.55, [sx * hr * 0.5, -hr * 0.32, hr * 0.68], [1, 0.8, 0.6], [0, 0, 0], { outline: false });
  faceEyes(k, head, hr, { x: hr * 0.42, y: hr * 0.15, r: hr * 0.31, iris: o.iris, sharp: true, glow: o.glow });
  for (const sx of [-1, 1]) {
    k.blade(head, MASK, hr * 0.55, hr * 0.22, hr * 0.1, [sx * hr * 0.5, -hr * 0.14, hr * 0.82], [0.25, sx * 0.35, PI + sx * 0.25], { outline: false });
    brow(k, head, MASK, sx, [sx * hr * 0.45, hr * 0.5, hr * 0.82], 0.4, hr * 0.36, hr * 0.06);
  }
  k.cone(head, o.beak, hr * 0.2, hr * 0.62, [0, -hr * 0.18, hr * 0.86], [PI / 2 + 0.15, 0, 0], 10);
  k.horn(head, DARKBEAK, hr * 0.1, hr * 0.36, hr * 0.16, [0, -hr * 0.12, hr * 1.36], [PI / 2 + 0.7, 0, 0]);
}

/** Horizontal bars on the belly: a few short dark strips stuck on the front of the belly ellipsoid */
function barring(k: Kit, parent: THREE.Object3D, ctr: V3, rad: V3, n: number, col: C): void {
  for (let i = 0; i < n; i++) {
    const lat = -0.55 + (i / (n - 1)) * 0.9;
    for (const sx of [-1, 1]) dot(k, parent, col, rad[0] * 0.2, ctr, rad, lat, sx * 0.42, { flat: 0.15 }).scale.set(1.6, 1, 0.5);
  }
}

/** Fan-shaped tail feathers: n feathers spread backward (-z), a tip color can be added */
function tailFan(k: Kit, c: Creature, parent: THREE.Object3D, pos: V3, n: number, len: number, wid: number, col: C, tip: C | undefined, lift: number): THREE.Group {
  const g = k.group(parent, pos);
  c.tails.push({ g, phase: 0, amp: 0.1, axis: 'y' });
  for (let i = 0; i < n; i++) {
    const t = i - (n - 1) / 2;
    const fg = k.group(g, [t * wid * 0.38, 0, 0], [-PI / 2 + lift, t * 0.22, 0]);
    k.blade(fg, col, len * (1 - Math.abs(t) * 0.08), wid, 0.035, [0, 0, 0]);
    if (tip) k.blade(fg, tip, len * 0.25, wid * 0.85, 0.03, [0, len * 0.72, 0.004], [0, 0, 0], { outline: false });
  }
  return g;
}

const skyreign: Builder = (k, c, s) => {
  c.archetype = 'bird';
  if (s === 1) {
    // I: a fluffball chick sitting on the ground
    c.hover = 0.03;
    const by = 0.33;
    k.sphere(c.body, SKY, 0.32, [0, by, 0], [1.02, 0.95, 1]);
    k.sphere(c.body, FWHITE, 0.24, [0, by - 0.06, 0.15], [0.95, 0.85, 0.8], [0, 0, 0], { outline: false });
    for (const [x, y, z] of [[-0.2, 0.2, -0.12], [0.18, 0.22, -0.1], [0, 0.26, -0.18], [-0.28, 0.05, -0.15], [0.28, 0.06, -0.14]]) k.sphere(c.body, SKY, 0.1, [x, by + y, z]);
    const head = k.group(c.body, [0, by + 0.27, 0.1]);
    c.head = head;
    k.sphere(head, SKY, 0.26, [0, 0, 0], [1, 0.95, 1]);
    faceEyes(k, head, [0.26, 0.247, 0.26], { x: 0.1, y: 0.02, r: 0.085, iris: 0x1a3a7a });
    k.blush(head, 0.18, -0.06, 0.18, 0.045);
    k.cone(head, BEAK, 0.035, 0.07, [0, -0.06, 0.25], [PI / 2, 0, 0], 8);
    k.cone(head, 0xe0a030, 0.026, 0.05, [0, -0.085, 0.25], [PI / 2 + 0.1, 0, 0], 8);
    const curl = k.group(head, [0.02, 0.22, 0.02]);
    k.horn(curl, SKY, 0.025, 0.15, 0.07, [0, 0, 0], [0.3, 0, -0.3]);
    c.tails.push({ g: curl, phase: 0, amp: 0.12, axis: 'z' });
    for (const sx of [-1, 1]) {
      k.blade(head, SKY, 0.08, 0.05, 0.03, [sx * 0.24, -0.04, 0.06], [0, 0, -sx * 1.3]);
      const g = k.group(c.body, [sx * 0.3, by + 0.04, 0.0]);
      k.blade(g, SKY, 0.16, 0.11, 0.05, [0, 0, 0], [-0.2, 0, 0]);
      k.blade(g, FWHITE, 0.05, 0.08, 0.04, [0, 0.11, 0.004], [-0.2, 0, 0], { outline: false });
      c.wings.push({ g, side: -sx, base: 1.0, amp: 0.5, speed: 9 });
    }
    tailFan(k, c, c.body, [0, by - 0.02, -0.3], 3, 0.12, 0.05, SKY, undefined, 0.5);
    for (const sx of [-1, 1]) birdFoot(k, c, c.body, sx, [sx * 0.09, 0.06, 0.14], BEAK, 0.02, 0.04);
    sparkle(k, c, c.body, WIND, 0.016, [0.45, 0.55, 0.1], 0.05);
    return;
  }
  if (s === 2) {
    // II: a streamlined adolescent falcon in a forward-leaning dive pose
    c.hover = 0.2;
    const core = k.group(c.body, [0, 0.52, 0], [0.25, 0, 0]);
    k.sphere(core, BLUE, 1, [0, 0, 0], [0.25, 0.3, 0.42]);
    k.sphere(core, CREAM, 1, [0, -0.06, 0.12], [0.19, 0.22, 0.31], [0, 0, 0], { outline: false });
    barring(k, core, [0, -0.06, 0.12], [0.19, 0.22, 0.31], 4, MASK);
    k.sphere(core, DEEP, 1, [0, 0.08, -0.05], [0.22, 0.2, 0.34], [0, 0, 0], { outline: false });
    const pivot = k.group(core, [0, 0.16, 0.32], [-0.25, 0, 0]);
    const head = k.group(pivot);
    c.head = head;
    k.sphere(head, BLUE, 0.2);
    falconFace(k, head, 0.2, { iris: 0x2a4a9a, beak: BEAK });
    const crest = k.group(head, [0, 0.14, -0.06]);
    c.tails.push({ g: crest, phase: 1, amp: 0.05, axis: 'x' });
    for (let i = -1; i <= 1; i++) k.blade(crest, DEEP, 0.2 - Math.abs(i) * 0.04, 0.06, 0.03, [i * 0.05, 0, 0], [-1.0 - Math.abs(i) * 0.2, 0, i * 0.4]);
    for (const sx of [-1, 1]) raptorWing(k, c, core, sx, [sx * 0.2, 0.06, 0.0], { L: 0.62, col: BLUE, dark: FNAVY, tip: FWHITE, primaries: 5, base: 0.95, amp: 0.5, speed: 7, pitch: -0.3 });
    tailFan(k, c, core, [0, 0.02, -0.36], 5, 0.3, 0.09, FNAVY, FWHITE, -0.12);
    for (const sx of [-1, 1]) birdFoot(k, c, c.body, sx, [sx * 0.09, 0.15, 0.06], BEAK, 0.025, 0.1, DARKBEAK);
    const gust = k.group(core, [0, 0.0, -0.08]);
    c.spinners.push({ g: gust, speed: 1.5, axis: 'y' });
    for (let i = 0; i < 2; i++) k.glow(gust, new THREE.TorusGeometry(0.5, 0.012, 6, 30, PI * 0.6), WIND, 1.4, [0, i * 0.12 - 0.06, 0], [PI / 2, 0, i * PI], 0.5);
    for (let i = 0; i < 2; i++) sparkle(k, c, c.body, WIND, 0.018, [Math.cos(i * 3) * 0.5, 0.45 + i * 0.35, Math.sin(i * 3) * 0.3], 0.06);
    return;
  }
  // III `skyreign`: a falcon king in a soaring pose, a golden crest, a long-feather cloak, circling airflow
  c.hover = 0.3;
  const core = k.group(c.body, [0, 0.72, 0], [0.2, 0, 0]);
  k.sphere(core, DEEP, 1, [0, 0, 0], [0.3, 0.34, 0.48]);
  k.sphere(core, FWHITE, 1, [0, -0.07, 0.14], [0.23, 0.26, 0.35], [0, 0, 0], { outline: false });
  barring(k, core, [0, -0.07, 0.14], [0.23, 0.26, 0.35], 5, MASK);
  k.sphere(core, FNAVY, 1, [0, 0.1, -0.06], [0.27, 0.22, 0.38], [0, 0, 0], { outline: false });
  for (let i = -2; i <= 2; i++) {
    const g = k.group(core, [i * 0.08, 0.2, -0.12], [-2.35 - Math.abs(i) * 0.08, 0, i * 0.12]);
    k.blade(g, FNAVY, 0.42 - Math.abs(i) * 0.04, 0.1, 0.035, [0, 0, 0]);
    k.blade(g, FGOLD, 0.1, 0.085, 0.03, [0, 0.3 - Math.abs(i) * 0.03, 0.004], [0, 0, 0], { outline: false });
  }
  const pivot = k.group(core, [0, 0.22, 0.36], [-0.2, 0, 0]);
  const head = k.group(pivot);
  c.head = head;
  k.sphere(head, DEEP, 0.22);
  falconFace(k, head, 0.22, { iris: 0x8fe0ff, glow: true, beak: FGOLD, cheeks: true });
  const crown = k.group(head, [0, 0.12, -0.03]);
  c.tails.push({ g: crown, phase: 2, amp: 0.04, axis: 'x' });
  k.torus(crown, FGOLD, 0.17, 0.02, [0, 0, 0.02], [PI / 2 + 0.2, 0, 0]);
  for (let i = -2; i <= 2; i++) k.blade(crown, FGOLD, 0.26 - Math.abs(i) * 0.05, 0.07, 0.03, [i * 0.05, 0.04, -0.03], [-0.6 - Math.abs(i) * 0.2, 0, i * 0.35]);
  k.glowSphere(crown, WIND, 0.03, [0, 0.02, 0.19], 2.6);
  for (const sx of [-1, 1]) raptorWing(k, c, core, sx, [sx * 0.24, 0.08, 0.0], { L: 0.98, col: DEEP, dark: FNAVY, tip: FWHITE, primaries: 6, base: 1.3, amp: 0.22, speed: 3.5, pitch: -0.5, gold: FGOLD });
  const tail = tailFan(k, c, core, [0, 0.03, -0.42], 5, 0.5, 0.1, FNAVY, FGOLD, -0.08);
  for (const sx of [-1, 1]) {
    tube(k, tail, FNAVY, [[sx * 0.08, 0, 0], [sx * 0.2, -0.05, -0.5], [sx * 0.34, 0.02, -0.85]], 0.014, 0.005);
    k.glowSphere(tail, FGOLD, 0.025, [sx * 0.34, 0.02, -0.85], 2.6);
  }
  for (const sx of [-1, 1]) birdFoot(k, c, c.body, sx, [sx * 0.11, 0.24, 0.08], BEAK, 0.03, 0.13, DARKBEAK);
  const aura = k.group(core, [0, 0.08, 0]);
  c.spinners.push({ g: aura, speed: 1.2, axis: 'y' });
  for (let i = 0; i < 2; i++) k.glow(aura, new THREE.TorusGeometry(0.85, 0.02, 6, 40, PI * 0.7), WIND, 1.3, [0, i * 0.16 - 0.08, 0], [PI / 2, 0, i * PI], 0.4);
  for (let i = 0; i < 5; i++) sparkle(k, c, c.body, i % 2 ? WIND : FWHITE, 0.02, [Math.cos(i * 1.4) * 0.8, 0.45 + i * 0.2, Math.sin(i * 1.4) * 0.5], 0.07);
};

// ───────────────────────── Stoneheart Canyon: the `monolith` family (earth) ─────────────────────────

const ROCK = 0x9d928a;
const DARK = 0x6d645e;
const SAND = 0xb8a894;
const MOSS = 0x7ac25a;
const MOSS2 = 0x5e9f45;
const RAMBER = 0xffb347;
const RIRIS = 0x4a3a2a;

/** Moss clump + small sprout: the sprout sways left and right */
function mossSprout(k: Kit, c: Creature, parent: THREE.Object3D, pos: V3, r: number, sprout = true): void {
  ball(k, parent, MOSS, r, pos, [1.4, 0.45, 1.2], [0, 0, 0], { outline: false });
  if (!sprout) return;
  const g = k.group(parent, [pos[0] + r * 0.2, pos[1] + r * 0.3, pos[2] - r * 0.1]);
  c.tails.push({ g, phase: 0.5, amp: 0.18, axis: 'z' });
  k.capsule(g, MOSS2, r * 0.1, r * 0.7, [0, r * 0.35, 0]);
  for (const sx of [-1, 1]) k.blade(g, MOSS, r * 0.6, r * 0.35, r * 0.1, [0, r * 0.62, 0], [0, 0, sx * 0.9]);
}

/** Orbiting floating stones: the whole group turns slowly about y, and each one also bobs up and down */
function orbitRocks(k: Kit, c: Creature, parent: THREE.Object3D, y: number, R: number, n: number, r: number, speed: number, seed: number, spread = 0.5): void {
  const g = k.group(parent, [0, y, 0]);
  c.spinners.push({ g, speed, axis: 'y' });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + rnd(seed + i);
    const dy = (rnd(seed + i + 5) - 0.5) * R * spread;
    const m = rock(k, c, g, DARK, r * (0.8 + rnd(seed + i + 9) * 0.5), [1, 0.85, 1], [Math.sin(a) * R, dy, Math.cos(a) * R], seed + i, { rough: 0.16 });
    c.bobbers.push({ g: m, base: dy, amp: r * 0.6, speed: 1.3 + rnd(seed + i) * 0.6, phase: i * 1.4 });
  }
}

/** A dwarf family name carved on a stone slab: several lines of short glowing strokes, alternating long and short */
function carvings(k: Kit, parent: THREE.Object3D, pos: V3, rows: number, cols: number, w: number, seed: number): THREE.Group {
  const g = k.group(parent, pos);
  for (let r = 0; r < rows; r++) {
    for (let cc = 0; cc < cols; cc++) {
      const i = r * cols + cc;
      const len = w * (0.5 + rnd(seed + i) * 0.7);
      const vert = rnd(seed + i + 17) > 0.7;
      const x = (cc - (cols - 1) / 2) * w * 1.6 + (r % 2) * w * 0.3;
      k.glow(g, new THREE.BoxGeometry(vert ? w * 0.25 : len, vert ? len : w * 0.25, w * 0.15), RAMBER, 2.2, [x, -r * w * 1.5, 0]);
    }
  }
  return g;
}

const monolith: Builder = (k, c, s) => {
  if (s === 1) {
    // I: a round little stone whose body is the head
    c.archetype = 'crawl';
    const R = 0.3;
    const head = k.group(c.body, [0, R * 0.94, 0]);
    c.head = head;
    rock(k, c, head, ROCK, R, [1.1, 0.92, 1.02], [0, 0, 0], 3, { detail: 2, rough: 0.06 });
    faceEyes(k, head, [R * 1.1, R * 0.92, R * 1.02], { x: 0.11, y: 0.03, r: 0.07, iris: RIRIS, cz: 0.012 });
    k.blush(head, 0.19, -0.06, 0.25, 0.04);
    smile(k, head, 0x4a403a, 0.032, 0.007, [0, -0.08, 0.31]);
    mossSprout(k, c, head, [-0.04, R * 0.86, -0.05], 0.12);
    for (const sx of [-1, 1]) {
      const fg = k.group(c.body, [sx * 0.13, 0.06, 0.15]);
      ball(k, fg, DARK, 0.06, [0, 0, 0], [1, 0.55, 1.3]);
      c.legs.push({ g: fg, phase: sx > 0 ? 0 : PI, amp: 0.6 });
      const base = new THREE.Euler(0.3, 0, -sx * 0.4);
      const ag = k.group(c.body, [sx * 0.31, 0.3, 0.06], [base.x, base.y, base.z]);
      ball(k, ag, DARK, 0.06, [0, -0.04, 0], [0.8, 1.2, 0.8]);
      c.arms.push({ g: ag, side: sx, base });
    }
    orbitRocks(k, c, c.body, 0.12, 0.44, 2, 0.05, 0.9, 7, 0.1);
    return;
  }
  c.archetype = 'biped';
  if (s === 2) {
    // II: a hunchbacked adolescent stone man, big fists dragging on the ground
    const hunch = k.group(c.body, [0, 0.28, 0], [0.15, 0, 0]);
    rock(k, c, hunch, ROCK, 0.36, [1.15, 0.85, 0.95], [0, 0.24, 0], 5, { detail: 2, rough: 0.08 });
    const head = k.group(hunch, [0, 0.56, 0.08]);
    c.head = head;
    rock(k, c, head, ROCK, 0.2, [1.1, 0.85, 1.0], [0, 0, 0], 6, { detail: 2, rough: 0.07 });
    rock(k, c, head, DARK, 0.1, [2.0, 0.45, 0.8], [0, 0.1, 0.13], 8, { rough: 0.1 });
    faceEyes(k, head, [0.22, 0.17, 0.2], { x: 0.085, y: 0.0, r: 0.06, iris: RIRIS, cz: 0.012 });
    k.mesh(head, new THREE.BoxGeometry(0.08, 0.012, 0.01), 0x4a403a, [0, -0.09, 0.2], [0, 0, 0], { outline: false });
    mossSprout(k, c, head, [0.03, 0.16, -0.04], 0.09);
    for (const sx of [-1, 1]) {
      rock(k, c, hunch, DARK, 0.15, [1, 0.85, 1], [sx * 0.42, 0.42, 0], 9 + sx, { rough: 0.12 });
      ball(k, hunch, MOSS, 0.09, [sx * 0.42, 0.53, 0], [1.3, 0.4, 1.1], [0, 0, 0], { outline: false });
      const base = new THREE.Euler(0.15, 0, -sx * 0.2);
      const g = k.group(hunch, [sx * 0.44, 0.38, 0.02], [base.x, base.y, base.z]);
      k.capsule(g, ROCK, 0.09, 0.2, [0, -0.14, 0]);
      rock(k, c, g, DARK, 0.15, [1, 0.9, 1], [0, -0.34, 0.02], 12 + sx, { rough: 0.12 });
      c.arms.push({ g, side: sx, base });
      const lg = k.group(c.body, [sx * 0.2, 0.26, 0]);
      k.capsule(lg, DARK, 0.11, 0.08, [0, -0.1, 0]);
      rock(k, c, lg, DARK, 0.13, [1.1, 0.6, 1.3], [0, -0.18, 0.04], 15 + sx, { rough: 0.1 });
      c.legs.push({ g: lg, phase: sx > 0 ? 0 : PI, amp: 0.7 });
    }
    carvings(k, hunch, [0, 0.26, 0.335], 1, 2, 0.05, 3);
    const cg = new THREE.OctahedronGeometry(0.06);
    cg.scale(0.7, 1.8, 0.7);
    k.glow(hunch, cg, RAMBER, 2.0, [0.08, 0.5, -0.3], [-0.5, 0, 0.2]);
    orbitRocks(k, c, c.body, 0.62, 0.62, 3, 0.06, 0.6, 21);
    return;
  }
  // III `monolith`: an upright colossus with a glowing family name carved on its chest
  for (const sx of [-1, 1]) {
    const g = k.group(c.body, [sx * 0.24, 0.36, 0]);
    k.cyl(g, SAND, 0.15, 0.17, 0.28, [0, -0.14, 0], [0, 0, 0], 10);
    facet(k, c, g, new THREE.BoxGeometry(0.34, 0.1, 0.4), DARK, [0, -0.31, 0.03]);
    c.legs.push({ g, phase: sx > 0 ? 0 : PI, amp: 0.5 });
  }
  facet(k, c, c.body, new THREE.BoxGeometry(0.62, 0.14, 0.44), DARK, [0, 0.42, 0]);
  rock(k, c, c.body, ROCK, 0.45, [1.2, 1.15, 0.85], [0, 0.9, 0], 31, { detail: 2, rough: 0.06 });
  facet(k, c, c.body, new THREE.BoxGeometry(0.52, 0.5, 0.08), SAND, [0, 0.88, 0.36]);
  const runes = carvings(k, c.body, [0, 1.04, 0.405], 3, 4, 0.06, 33);
  c.flickers.push({ g: runes, base: runes.scale.clone(), speed: 2, amt: 0.06 });
  for (const sx of [-1, 1]) {
    rock(k, c, c.body, DARK, 0.24, [1.1, 0.75, 1], [sx * 0.6, 1.36, 0], 35 + sx, { detail: 2, rough: 0.09 });
    if (sx < 0) {
      ball(k, c.body, MOSS, 0.14, [-0.6, 1.52, 0], [1.4, 0.4, 1.2], [0, 0, 0], { outline: false });
      const tree = k.group(c.body, [-0.62, 1.54, -0.02]);
      c.tails.push({ g: tree, phase: 0, amp: 0.07, axis: 'z' });
      k.capsule(tree, 0x6a4a3a, 0.02, 0.22, [0, 0.11, 0]);
      k.sphere(tree, MOSS, 0.1, [0, 0.27, 0]);
      k.sphere(tree, MOSS2, 0.075, [0.07, 0.2, 0.03]);
      k.sphere(tree, MOSS, 0.07, [-0.06, 0.22, -0.04]);
    } else {
      ball(k, c.body, MOSS2, 0.12, [0.6, 1.52, 0], [1.3, 0.4, 1.2], [0, 0, 0], { outline: false });
      for (let i = 0; i < 4; i++) k.blade(c.body, MOSS, 0.11, 0.03, 0.015, [0.52 + i * 0.05, 1.54, -0.06 + (i % 2) * 0.1], [0.2, 0, (i - 1.5) * 0.35], { outline: false });
    }
    const base = new THREE.Euler(0.1, 0, -sx * 0.15);
    const g = k.group(c.body, [sx * 0.64, 1.28, 0.02], [base.x, base.y, base.z]);
    rock(k, c, g, ROCK, 0.16, [0.9, 1.4, 0.9], [0, -0.22, 0], 41 + sx, { detail: 2, rough: 0.07 });
    ball(k, g, DARK, 0.12, [0, -0.46, 0]);
    rock(k, c, g, ROCK, 0.15, [0.95, 1.5, 0.95], [0, -0.68, 0.02], 45 + sx, { detail: 2, rough: 0.07 });
    k.glow(g, new THREE.TorusGeometry(0.15, 0.012, 6, 24), RAMBER, 2.0, [0, -0.6, 0.02], [PI / 2, 0, 0]);
    rock(k, c, g, DARK, 0.2, [1, 0.9, 1], [0, -0.95, 0.04], 49 + sx, { detail: 2, rough: 0.1 });
    c.arms.push({ g, side: sx, base });
  }
  const head = k.group(c.body, [0, 1.6, 0.02]);
  c.head = head;
  rock(k, c, head, SAND, 0.2, [0.95, 1.45, 0.85], [0, 0.1, 0], 51, { detail: 2, rough: 0.05 });
  rock(k, c, head, DARK, 0.1, [2.1, 0.45, 0.9], [0, 0.17, 0.14], 53, { rough: 0.1 });
  faceEyes(k, head, [0.19, 0.29, 0.17], { x: 0.08, y: 0.06, cy: 0.1, r: 0.055, iris: RAMBER, glow: true, cz: 0.012 });
  k.mesh(head, new THREE.BoxGeometry(0.1, 0.014, 0.01), 0x4a403a, [0, -0.08, 0.165], [0, 0, 0], { outline: false });
  k.glow(head, new THREE.BoxGeometry(0.014, 0.12, 0.012), RAMBER, 2.2, [0, 0.34, 0.16]);
  mossSprout(k, c, head, [0.02, 0.4, -0.02], 0.14, false);
  for (let i = 0; i < 3; i++) k.blade(head, MOSS2, 0.09, 0.03, 0.015, [-0.06 + i * 0.06, 0.42, -0.04 + (i % 2) * 0.06], [0.1, 0, (i - 1) * 0.4], { outline: false });
  orbitRocks(k, c, c.body, 1.1, 0.86, 4, 0.08, 0.45, 61);
};

// ───────────────────────── Common everywhere: the `cloudfluff` family (neutral) ─────────────────────────

const FLUFF = 0xfdf7ff;
const FLUFF2 = 0xf1e9ff;
const PINK = 0xffc8e0;
const CIRIS = 0x7a6ad8;
const CGOLD = 0xfff2a0;
const NOTE = 0xffe08a;
const CSKY = 0xcfe6ff;
const CMOUTH = 0x8a6aa0;

/** `cloudfluff`'s ears: the outer layer is registered in c.ears (twitching now and then), the inner layer is fixed at a drooping or upright angle and registered in c.tails (swaying gently back and forth continuously) */
function fluffEar(k: Kit, c: Creature, head: THREE.Object3D, sx: number, pos: V3, droop: number, len: number, wid: number): THREE.Group {
  const g = k.group(head, pos);
  c.ears.push({ g, phase: sx * 2.1 });
  const p = k.group(g, [0, 0, 0], [0, 0, -sx * droop]);
  c.tails.push({ g: p, phase: sx * 1.3, amp: 0.08, axis: 'x' });
  k.blade(p, FLUFF, len, wid, wid * 0.55, [0, 0, 0]);
  k.blade(p, PINK, len * 0.66, wid * 0.55, wid * 0.3, [0, len * 0.12, wid * 0.2], [0, 0, 0], { outline: false });
  return p;
}

/** `cloudfluff`'s face: big eyes, blush, a w-shaped small mouth */
function fluffFace(k: Kit, head: THREE.Object3D, rad: V3, cy: number, r: number): void {
  faceEyes(k, head, rad, { x: r * 1.25, y: 0, cy, r, iris: CIRIS });
  const z = Math.sqrt(Math.max(0.05, 1 - ((-r * 1.1 - cy) / rad[1]) ** 2)) * rad[2];
  k.blush(head, r * 2.1, -r * 0.7, z * 0.95, r * 0.55);
  for (const sx of [-1, 1]) smile(k, head, CMOUTH, r * 0.3, r * 0.08, [sx * r * 0.3, -r * 1.1, z], 0.7);
}

/** Cowlick: a swaying curl on top of the head */
function ahoge(k: Kit, c: Creature, head: THREE.Object3D, pos: V3, len: number): void {
  const g = k.group(head, pos);
  c.tails.push({ g, phase: 0.7, amp: 0.12, axis: 'z' });
  k.horn(g, FLUFF, len * 0.18, len, len * 0.5, [0, 0, 0], [0.25, 0, -0.35]);
}

const cloudfluff: Builder = (k, c, s) => {
  if (s === 1) {
    // I: a small tuft of fluff, long ears hanging to the ground
    floater(c, 0.05);
    const by = 0.3;
    k.sphere(c.body, FLUFF, 0.28, [0, by, 0], [1, 0.92, 0.95]);
    for (const [x, y, z] of [[-0.12, 0.18, -0.06], [0.1, 0.2, -0.1], [0, 0.1, -0.24], [-0.2, 0.0, -0.16]]) k.sphere(c.body, FLUFF2, 0.1, [x, by + y, z]);
    const head = k.group(c.body, [0, by + 0.04, 0]);
    c.head = head;
    fluffFace(k, head, [0.28, 0.258, 0.266], -0.04, 0.08);
    ahoge(k, c, head, [0.02, 0.24, 0.02], 0.14);
    for (const sx of [-1, 1]) {
      fluffEar(k, c, head, sx, [sx * 0.2, 0.18, -0.02], 2.35, 0.26, 0.11);
      const pg = k.group(c.body, [sx * 0.11, 0.07, 0.2]);
      ball(k, pg, FLUFF, 0.055, [0, 0, 0], [1, 0.7, 1.2]);
      c.legs.push({ g: pg, phase: sx > 0 ? 0 : PI, amp: 0.5 });
    }
    const tail = k.group(c.body, [0, by - 0.08, -0.29]);
    ball(k, tail, FLUFF2, 0.08);
    c.bobbers.push({ g: tail, base: by - 0.08, amp: 0.015, speed: 2.4, phase: 1 });
    note(k, c, c.body, NOTE, [0.32, 0.62, 0.05], 0.1, 1);
    return;
  }
  if (s === 2) {
    // II: a big fluffy ball, the ears upright
    floater(c, 0.18);
    const by = 0.42;
    k.sphere(c.body, FLUFF, 0.34, [0, by, 0]);
    for (let i = 0; i < 8; i++) {
      const a = 0.55 + (i / 8) * (PI * 2 - 1.1);
      k.sphere(c.body, i % 2 ? FLUFF2 : FLUFF, 0.15, [Math.sin(a) * 0.3, by + Math.sin(i * 2.3) * 0.08, Math.cos(a) * 0.3]);
    }
    for (const [x, y, z] of [[-0.14, 0.28, -0.05], [0.13, 0.3, -0.08], [0, 0.26, -0.22], [-0.16, -0.26, 0.05], [0.15, -0.27, -0.02]]) k.sphere(c.body, FLUFF2, 0.13, [x, by + y, z]);
    const head = k.group(c.body, [0, by + 0.05, 0.02]);
    c.head = head;
    fluffFace(k, head, [0.34, 0.34, 0.34], -0.05, 0.078);
    ahoge(k, c, head, [0.02, 0.3, 0.02], 0.18);
    for (const sx of [-1, 1]) {
      k.blade(head, FLUFF2, 0.12, 0.07, 0.04, [sx * 0.3, -0.03, 0.12], [0, 0, -sx * 1.4]);
      fluffEar(k, c, head, sx, [sx * 0.2, 0.26, -0.04], 0.45, 0.3, 0.12);
      for (const [z, y] of [[0.28, 0.1], [-0.12, 0.05]]) {
        const pg = k.group(c.body, [sx * 0.15, y, z]);
        ball(k, pg, FLUFF, 0.06, [0, 0, 0], [1, 0.7, 1.2]);
        c.legs.push({ g: pg, phase: sx * z > 0 ? 0 : PI, amp: 0.5 });
      }
    }
    for (let i = 0; i < 2; i++) {
      const tail = k.group(c.body, [0, by - 0.1 - i * 0.04, -0.38 - i * 0.14]);
      ball(k, tail, FLUFF2, 0.1 - i * 0.03);
      c.bobbers.push({ g: tail, base: by - 0.1 - i * 0.04, amp: 0.02 + i * 0.01, speed: 2.2, phase: 1 + i });
    }
    const ring = k.group(c.body, [0, 0, 0]);
    c.spinners.push({ g: ring, speed: 0.8, axis: 'y' });
    for (let i = 0; i < 2; i++) note(k, c, ring, NOTE, [Math.cos(i * PI) * 0.5, 0.55 + i * 0.2, Math.sin(i * PI) * 0.5], 0.12, i + 2);
    for (let i = 0; i < 2; i++) sparkle(k, c, c.body, CGOLD, 0.018, [Math.cos(i * 2.5 + 1) * 0.45, 0.5 + i * 0.3, Math.sin(i * 2.5 + 1) * 0.35], 0.05);
    return;
  }
  // III `cloudfluff`: a wide cloud body, a cloud tail, cloud-wing ears flapping slowly, a gold halo
  floater(c, 0.32);
  const by = 0.5;
  k.sphere(c.body, FLUFF, 0.36, [0, by, 0], [1.25, 0.9, 1.0]);
  for (let i = 0; i < 10; i++) {
    const a = 0.6 + (i / 10) * (PI * 2 - 1.2);
    const rr = 0.14 + (i % 3) * 0.03;
    k.sphere(c.body, i % 2 ? FLUFF2 : FLUFF, rr, [Math.sin(a) * 0.4, by + Math.sin(i * 2.3) * 0.1 - 0.02, Math.cos(a) * 0.3]);
  }
  for (const [x, y, z] of [[-0.18, 0.28, -0.02], [0.16, 0.3, -0.06], [0, 0.3, -0.22], [-0.25, -0.28, 0.05], [0.24, -0.28, -0.02], [0, -0.3, 0.12]]) k.sphere(c.body, FLUFF2, 0.14, [x, by + y, z]);
  k.glowSphere(c.body, 0xfff6ff, 0.3, [0, by - 0.3, 0], 0.9, [1.5, 0.3, 1.1], 0.25);
  const head = k.group(c.body, [0, by + 0.06, 0.08]);
  c.head = head;
  fluffFace(k, head, [0.45, 0.32, 0.34], -0.06, 0.08);
  ahoge(k, c, head, [0.02, 0.28, 0.0], 0.22);
  const ring3 = k.glow(head, new THREE.TorusGeometry(0.19, 0.022, 8, 40), CGOLD, 2.4, [0, 0.52, -0.02], [PI / 2, 0, 0], 0.9);
  c.spinners.push({ g: ring3, speed: 0.8, axis: 'z' });
  for (const sx of [-1, 1]) {
    k.blade(head, FLUFF2, 0.14, 0.08, 0.05, [sx * 0.42, -0.04, 0.06], [0, 0, -sx * 1.4]);
    // Cloud-wing ears: stretched out flat like wings, flapping slowly; three layers of feather plates
    const wg = k.group(c.body, [sx * 0.38, by + 0.14, -0.04]);
    c.wings.push({ g: wg, side: -sx, base: 1.05, amp: 0.2, speed: 2.6 });
    k.blade(wg, FLUFF, 0.62, 0.22, 0.09, [0, 0, 0], [-0.25, 0, 0]);
    k.blade(wg, FLUFF2, 0.5, 0.18, 0.07, [0, 0.04, -0.06], [-0.6, 0, 0]);
    k.blade(wg, FLUFF2, 0.38, 0.15, 0.06, [0, 0.06, -0.11], [-0.95, 0, 0]);
    k.blade(wg, PINK, 0.4, 0.11, 0.04, [0, 0.08, 0.05], [-0.25, 0, 0], { outline: false });
    for (const [z, y] of [[0.3, 0.16], [-0.14, 0.12]]) {
      const pg = k.group(c.body, [sx * 0.2, y, z]);
      ball(k, pg, FLUFF, 0.065, [0, 0, 0], [1, 0.7, 1.2]);
      c.legs.push({ g: pg, phase: sx * z > 0 ? 0 : PI, amp: 0.5 });
    }
  }
  [0.18, 0.15, 0.12, 0.09].forEach((r, i) => {
    const tail = k.group(c.body, [Math.sin(i * 0.8) * 0.06, by - 0.08 - i * 0.05, -0.5 - i * 0.2]);
    k.sphere(tail, i % 2 ? FLUFF2 : FLUFF, r);
    c.bobbers.push({ g: tail, base: by - 0.08 - i * 0.05, amp: 0.02 + i * 0.012, speed: 2.0, phase: 1 + i * 0.9 });
  });
  const ring = k.group(c.body, [0, 0, 0]);
  c.spinners.push({ g: ring, speed: 0.6, axis: 'y' });
  for (let i = 0; i < 4; i++) note(k, c, ring, i % 2 ? NOTE : CSKY, [Math.cos((i / 4) * PI * 2) * 0.66, 0.5 + (i % 2) * 0.3, Math.sin((i / 4) * PI * 2) * 0.66], 0.13, i + 4);
  for (let i = 0; i < 3; i++) sparkle(k, c, c.body, CGOLD, 0.02, [Math.cos(i * 2.1 + 0.5) * 0.55, 0.45 + i * 0.28, Math.sin(i * 2.1 + 0.5) * 0.4], 0.06);
};

export const SPECIES_FIRSTN: Record<string, Builder> = { pyrewing, icecrown, dreamcap, skyreign, monolith, cloudfluff };
