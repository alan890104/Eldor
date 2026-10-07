// Shared rig archetypes and parts for spirit models (quadruped, biped, bird, wings, ears, tails, halos, motes).
// Each species' model lives in species.ts and species/*.ts and takes its parts from here.

import * as THREE from 'three';
import type { Creature, Kit } from './creature.ts';

export type Stage = 1 | 2 | 3;
export type C = THREE.ColorRepresentation;
export type V3 = [number, number, number];
export type Builder = (k: Kit, c: Creature, s: Stage) => void;
export const PI = Math.PI;

// ───────────────────────── Rig archetypes ─────────────────────────

export interface QuadOpts {
  col: C;
  belly?: C;
  len?: number;
  r?: number;
  leg?: number;
  legR?: number;
  headR?: number;
  neck?: number;
  headZ?: number;
  paw?: C;
}

export function quad(k: Kit, c: Creature, o: QuadOpts) {
  c.archetype = 'quad';
  const len = o.len ?? 0.55;
  const r = o.r ?? 0.32;
  const leg = o.leg ?? 0.26;
  const legR = o.legR ?? 0.085;
  const headR = o.headR ?? 0.34;
  const bodyY = leg + r * 0.7;
  k.sphere(c.body, o.col, 1, [0, bodyY, 0], [r, r * 0.88, len]);
  if (o.belly) k.sphere(c.body, o.belly, 1, [0, bodyY - r * 0.28, len * 0.08], [r * 0.82, r * 0.66, len * 0.82], [0, 0, 0], { outline: false });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const g = k.group(c.body, [sx * r * 0.6, leg + 0.03, sz * len * 0.55]);
      k.capsule(g, o.col, legR, leg * 0.62, [0, -leg * 0.45, 0]);
      k.sphere(g, o.paw ?? o.col, legR * 1.25, [0, -leg + legR * 0.9, legR * 0.35], [1, 0.75, 1.2]);
      c.legs.push({ g, phase: sx * sz > 0 ? 0 : PI, amp: 1 });
    }
  }
  const head = k.group(c.body, [0, bodyY + r * 0.55 + (o.neck ?? 0), len * 0.78 + (o.headZ ?? 0)]);
  c.head = head;
  if (o.neck) k.capsule(c.body, o.col, r * 0.42, o.neck, [0, bodyY + r * 0.35 + o.neck * 0.5, len * 0.72], [0.35, 0, 0]);
  k.sphere(head, o.col, headR, [0, 0, 0], [1, 0.95, 1]);
  const back = k.group(c.body, [0, bodyY + r * 0.82, 0]);
  const tail = k.group(c.body, [0, bodyY + r * 0.15, -len * 0.92]);
  return { head, back, tail, bodyY, headR, len, r };
}

export interface BipedOpts {
  col: C;
  belly?: C;
  torsoR?: number;
  torsoH?: number;
  leg?: number;
  legR?: number;
  headR?: number;
  armLen?: number;
  armR?: number;
  hand?: C;
  foot?: C;
}

export function biped(k: Kit, c: Creature, o: BipedOpts) {
  c.archetype = 'biped';
  const tr = o.torsoR ?? 0.3;
  const th = o.torsoH ?? 0.4;
  const leg = o.leg ?? 0.16;
  const legR = o.legR ?? 0.1;
  const headR = o.headR ?? 0.34;
  const armLen = o.armLen ?? 0.24;
  const armR = o.armR ?? 0.075;
  for (const sx of [-1, 1]) {
    const g = k.group(c.body, [sx * tr * 0.5, leg + 0.02, 0]);
    k.capsule(g, o.col, legR, leg * 0.5, [0, -leg * 0.4, 0]);
    k.sphere(g, o.foot ?? o.col, legR * 1.3, [0, -leg + legR * 0.8, legR * 0.5], [1, 0.7, 1.35]);
    c.legs.push({ g, phase: sx > 0 ? 0 : PI, amp: 0.7 });
  }
  const torsoY = leg + th * 0.5;
  k.sphere(c.body, o.col, 1, [0, torsoY, 0], [tr, th * 0.62, tr * 0.88]);
  if (o.belly) k.sphere(c.body, o.belly, 1, [0, torsoY - th * 0.05, tr * 0.3], [tr * 0.72, th * 0.48, tr * 0.62], [0, 0, 0], { outline: false });
  const head = k.group(c.body, [0, leg + th + headR * 0.62, 0.02]);
  c.head = head;
  k.sphere(head, o.col, headR);
  const hands: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const base = new THREE.Euler(0, 0, sx * 0.35);
    const g = k.group(c.body, [sx * tr * 0.92, leg + th * 0.82, 0], [base.x, base.y, base.z]);
    k.capsule(g, o.col, armR, armLen, [0, -armLen * 0.55, 0]);
    k.sphere(g, o.hand ?? o.col, armR * 1.35, [0, -armLen * 1.1, 0]);
    const hand = k.group(g, [0, -armLen * 1.15, 0.02]);
    hands.push(hand);
    c.arms.push({ g, side: sx, base });
  }
  const back = k.group(c.body, [0, leg + th * 0.7, -tr * 0.8]);
  const tail = k.group(c.body, [0, leg + th * 0.2, -tr * 0.8]);
  return { head, hands, back, tail, torsoY, headR, tr, th, leg };
}

export function wing(k: Kit, c: Creature, parent: THREE.Object3D, side: number, col: C, len: number, wid: number, pos: V3, o: { base?: number; amp?: number; speed?: number; feathers?: number; tip?: C } = {}) {
  const g = k.group(parent, [pos[0] * side, pos[1], pos[2]]);
  const n = o.feathers ?? 3;
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    k.blade(g, i === 0 && o.tip ? o.tip : col, len * (1 - t * 0.28), wid, 0.05, [0, 0, -t * wid * 0.55], [-0.15 - t * 0.35, 0, 0]);
  }
  // side: left wing (x<0) = 1, right wing = -1, so the wings spread outward
  const s = side < 0 ? 1 : -1;
  c.wings.push({ g, side: s, base: o.base ?? 1.15, amp: o.amp ?? 0.45, speed: o.speed ?? 8 });
  return g;
}

export function bird(k: Kit, c: Creature, o: { col: C; belly: C; wingCol: C; beak: C; r?: number; headR?: number; wingLen?: number; tail?: C }) {
  c.archetype = 'bird';
  c.hover = 0.18;
  const r = o.r ?? 0.36;
  const headR = o.headR ?? 0.28;
  const y = 0.42;
  k.sphere(c.body, o.col, 1, [0, y, 0], [r, r * 0.95, r * 1.08]);
  k.sphere(c.body, o.belly, 1, [0, y - r * 0.18, r * 0.3], [r * 0.75, r * 0.72, r * 0.72], [0, 0, 0], { outline: false });
  const head = k.group(c.body, [0, y + r * 0.78, r * 0.3]);
  c.head = head;
  k.sphere(head, o.col, headR);
  k.cone(head, o.beak, headR * 0.28, headR * 0.6, [0, -headR * 0.05, headR * 0.85], [PI / 2, 0, 0]);
  const wl = o.wingLen ?? 0.55;
  for (const side of [-1, 1]) wing(k, c, c.body, side, o.wingCol, wl, 0.26, [r * 0.8, y + 0.05, -0.02]);
  for (let i = -1; i <= 1; i++) k.blade(c.body, o.tail ?? o.wingCol, 0.34, 0.14, 0.04, [i * 0.07, y - 0.05, -r * 0.8], [-2.2, i * 0.3, 0]);
  for (const sx of [-1, 1]) k.capsule(c.body, o.beak, 0.035, 0.1, [sx * 0.1, y - r * 0.95, 0.05]);
  return { head, y, r, headR };
}

export function floater(c: Creature, hover = 0.35) {
  c.archetype = 'float';
  c.hover = hover;
}

// ───────────────────────── Generic parts ─────────────────────────

export function ears(k: Kit, c: Creature, head: THREE.Object3D, col: C, inner: C, r: number, h: number, x: number, y: number, tilt = 0.3, z = 0) {
  for (const sx of [-1, 1]) {
    const g = k.group(head, [sx * x, y, z], [0, 0, -sx * tilt]);
    k.cone(g, col, r, h, [0, 0, 0], [0, 0, 0], 10);
    k.cone(g, inner, r * 0.55, h * 0.7, [0, 0.02, r * 0.35], [0, 0, 0], 10, { outline: false });
    c.ears.push({ g, phase: sx * 1.7 });
  }
}

export function roundEars(k: Kit, c: Creature, head: THREE.Object3D, col: C, inner: C, r: number, x: number, y: number) {
  for (const sx of [-1, 1]) {
    const g = k.group(head, [sx * x, y, 0]);
    k.sphere(g, col, r, [0, 0, 0], [1, 1, 0.55]);
    k.sphere(g, inner, r * 0.6, [0, 0, r * 0.3], [1, 1, 0.3], [0, 0, 0], { outline: false });
    c.ears.push({ g, phase: sx * 2.1 });
  }
}

export function tailChain(k: Kit, c: Creature, parent: THREE.Object3D, col: C, n: number, r0: number, step: number, droop = 0.25) {
  let g = k.group(parent, [0, 0, 0], [droop, 0, 0]);
  c.tails.push({ g, phase: 0, amp: 0.25, axis: 'y' });
  let r = r0;
  for (let i = 0; i < n; i++) {
    k.sphere(g, col, r, [0, 0, -step * 0.5]);
    const next = k.group(g, [0, 0, -step], [0.08, 0, 0]);
    c.tails.push({ g: next, phase: (i + 1) * 0.6, amp: 0.15, axis: 'y' });
    g = next;
    r *= 0.82;
  }
  return g;
}

export function halo(k: Kit, c: Creature, parent: THREE.Object3D, col: C, R: number, pos: V3, rot: V3 = [PI / 2, 0, 0]) {
  const g = new THREE.TorusGeometry(R, R * 0.06, 8, 48);
  const m = k.glow(parent, g, col, 2.4, pos, rot, 0.9);
  c.spinners.push({ g: m, speed: 0.8, axis: 'z' });
  return m;
}

export function sparkle(k: Kit, c: Creature, parent: THREE.Object3D, col: C, r: number, pos: V3, amp = 0.05) {
  const m = k.glowSphere(parent, col, r, pos, 2.6);
  c.bobbers.push({ g: m, base: pos[1], amp, speed: 2 + Math.random() * 2, phase: Math.random() * 6 });
  return m;
}

