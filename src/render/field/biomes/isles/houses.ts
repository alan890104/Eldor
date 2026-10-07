// The houses of Lighthouse Harbor: the white-walled houses of a Mediterranean fishing harbor. All four walls have windows
// (window frame, stone sill, two open shutters, a flower box),
// the door has an arched transom, a door frame, two stone steps and potted plants and a wall lamp beside the door;
// the roofs come as hip tile roofs, gable tile roofs (rows of tiles, a ridge),
// flat roofs (parapet, roof terrace, pergola, clothesline) and single-slope annexes; the second floor has a balcony,
// a white solid outer stair climbs along the side wall,
// and bougainvillea climbs the corners of the walls. There is also the Whale Chapel (blue dome and bell wall).
// Houses are always placed at absolute heights (the y of Frame is the foundation height), so a stilt house can be built right on its platform.

import * as THREE from 'three';
import type { FieldCtx } from '../../kit.ts';
import { flagGeo } from './fx.ts';
import { Frame, MX, put, putGlow, rod, rope, T, V } from './parts.ts';

export const STONE = 0xcfc4ae;
export const STONE_D = 0xa89c86;
export const WOOD = 0x9a6c46;
export const WOOD_D = 0x6a4a30;
export const PLANK = 0xc49564;
export const WINDOW = 0xffd88a;
export const GLASS = 0x2f4a66;
export const TERRA = 0xc8603a;
export const POT = 0xc8744a;
const IRON = 0x3a4050;
const WHITE = 0xf8f6f0;
const LEAF = [0x3f9a48, 0x55b454, 0x2f8a44];
export const BLOOMS = [0xe0368a, 0xff5aa8, 0xb03ac8, 0xff7a3a];
export const GERANIUM = [0xff4a5a, 0xff8ab0, 0xffffff, 0xffc83a];

export interface HouseOut {
  flags: THREE.BufferGeometry[];
  lights: [number, number, number, number][];
  /** Chimney opening (for smoke) */
  smoke: THREE.Vector3[];
}

export interface HouseOpt {
  /** Front width (local x), depth (local z), wall height per floor */
  w: number;
  d: number;
  h: number;
  floors: 1 | 2;
  roof: 'hip' | 'gable' | 'flat';
  wall: number;
  /** Colors of the doors, windows and shutters */
  trim: number;
  roofCol?: number;
  /** The color of a ring of paint at the foot of the wall (no paint if absent) */
  band?: number;
  balcony?: boolean;
  /** Which side the outer stair is on (-1 left, 1 right) */
  stair?: -1 | 1;
  /** Color of the bougainvillea */
  vine?: number;
  /** A striped awning over the door */
  awning?: number;
  chimney?: boolean;
  /** Single-slope annex: attached to the left or right side */
  annex?: -1 | 1;
  /** Shopfront: the sign and the goods at the door */
  shop?: 'fish' | 'bread' | 'rope' | 'pots';
  /** Fraction of windows with lights on */
  lit?: number;
  /** Do not add collision (the caller handles it itself) */
  noSolid?: boolean;
  /** Built on a wooden platform (a stilt house): no stone foundation and no stone steps in front of the door */
  deck?: boolean;
}

/** Hip roof: rectangular base W × D, height rh, the ridge along the long side; returns the vertices (base at y = 0) */
function hipRoof(W: number, D: number, rh: number): { geo: THREE.BufferGeometry; faces: THREE.Vector3[][] } {
  const hw = W / 2;
  const hd = D / 2;
  const ridge = Math.max(0, hw - hd) * 0.9;
  const alongX = W >= D;
  const r0 = alongX ? V(-ridge, rh, 0) : V(0, rh, -Math.max(0, hd - hw) * 0.9);
  const r1 = alongX ? V(ridge, rh, 0) : V(0, rh, Math.max(0, hd - hw) * 0.9);
  const a = V(-hw, 0, hd);
  const b = V(hw, 0, hd);
  const c = V(hw, 0, -hd);
  const d = V(-hw, 0, -hd);
  // Each face: [bottom left, bottom right, top right, top left] (seen from outside)
  const faces = alongX
    ? [
        [a, b, r1, r0],
        [c, d, r0, r1],
        [b, c, r1, r1],
        [d, a, r0, r0],
      ]
    : [
        [a, b, r1, r1],
        [c, d, r0, r0],
        [b, c, r0, r1],
        [d, a, r1, r0],
      ];
  const pos: number[] = [];
  const push = (...ps: THREE.Vector3[]) => ps.forEach((p) => pos.push(p.x, p.y, p.z));
  for (const [p0, p1, p2, p3] of faces) {
    push(p0, p1, p2);
    if (p2 !== p3) push(p0, p2, p3);
  }
  // Underside (the eaves are visible from below)
  push(a, d, c, a, c, b);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return { geo, faces };
}

/**
 * Rows of tiles on the roof: on each face, a few horizontal lines drawn from the eaves toward the ridge (floating slightly above the roof surface)
 */
function tileCourses(ctx: FieldCtx, F: Frame, y: number, faces: THREE.Vector3[][], n: number, col: number): void {
  for (const [p0, p1, p2, p3] of faces) {
    const nrm = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p3, p0)).normalize();
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      const a = p0.clone().lerp(p3, t).addScaledVector(nrm, 0.04);
      const c = p1.clone().lerp(p2, t).addScaledVector(nrm, 0.04);
      if (a.distanceTo(c) < 0.3) continue;
      rod(ctx.b, F.p(a.x, a.y + y, a.z), F.p(c.x, c.y + y, c.z), 0.055, col, T.cyl4, false);
    }
  }
}

/** Ridge and hip ridges */
function ridges(ctx: FieldCtx, F: Frame, y: number, faces: THREE.Vector3[][], col: number): void {
  const seen = new Set<string>();
  for (const f of faces) {
    for (const [a, c] of [[f[0], f[3]], [f[1], f[2]], [f[3], f[2]]] as const) {
      if (a.distanceTo(c) < 0.2) continue;
      const k = [a, c].map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`).sort().join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      rod(ctx.b, F.p(a.x, a.y + y + 0.05, a.z), F.p(c.x, c.y + y + 0.05, c.z), 0.1, col, T.cyl6);
    }
  }
}

/** A window: window frame, glass (some lit), stone sill, two open shutters, and some with a flower box */
export function windowAt(ctx: FieldCtx, F: Frame, lx: number, ly: number, lz: number, trim: number, lit: boolean, box: boolean, out: HouseOut, s = 1): void {
  const { b, r } = ctx;
  put(b, T.box, trim, F.L(lx, ly, lz + 0.03, 0.86 * s, 1.08 * s, 0.07));
  if (lit) {
    putGlow(b, T.box, WINDOW, F.L(lx, ly, lz + 0.06, 0.62 * s, 0.84 * s, 0.04));
    const p = F.p(lx, ly, lz + 0.4);
    out.lights.push([p.x, p.y, p.z, 1.05 * s]);
  } else put(b, T.box, GLASS, F.L(lx, ly, lz + 0.06, 0.62 * s, 0.84 * s, 0.04), false);
  // Cross of the window panes
  put(b, T.box, trim, F.L(lx, ly, lz + 0.085, 0.05, 0.84 * s, 0.02), false);
  put(b, T.box, trim, F.L(lx, ly + 0.08 * s, lz + 0.085, 0.62 * s, 0.05, 0.02), false);
  put(b, T.box, STONE, F.L(lx, ly - 0.58 * s, lz + 0.09, 1.0 * s, 0.1, 0.22));
  // Shutters: attached to both sides of the window, with two horizontal slats on each
  for (const sd of [-1, 1]) {
    const x = lx + sd * 0.72 * s;
    put(b, T.box, trim, F.L(x, ly, lz + 0.05, 0.4 * s, 1.02 * s, 0.05));
    for (const dy of [-0.22, 0.2]) put(b, T.box, 0x1e2a3a, F.L(x, ly + dy * s, lz + 0.085, 0.3 * s, 0.03, 0.02), false);
  }
  if (box) {
    put(b, T.box, r() < 0.5 ? WOOD : POT, F.L(lx, ly - 0.72 * s, lz + 0.2, 0.84 * s, 0.2, 0.24));
    for (let k = 0; k < 5; k++) {
      const x = lx - 0.32 * s + k * 0.16 * s;
      put(b, T.ico0, k % 2 ? LEAF[k % 3] : GERANIUM[Math.floor(r() * 4)], F.L(x, ly - 0.56 * s + r() * 0.06, lz + 0.22 + (r() - 0.5) * 0.08, 0.11, 0.1, 0.11), false);
    }
  }
}

/** Potted plant: a clay pot + a clump of leaves (or flowers) */
export function pottedPlant(ctx: FieldCtx, x: number, y: number, z: number, s: number, bloom?: number): void {
  const { b, r } = ctx;
  put(b, T.pot, POT, MX(x, y + 0.22 * s, z, 0.24 * s, 0.44 * s, 0.24 * s));
  put(b, T.cyl8, 0x8a5a38, MX(x, y + 0.45 * s, z, 0.25 * s, 0.05, 0.25 * s), false);
  put(b, T.ico1, LEAF[Math.floor(r() * 3)], MX(x, y + 0.66 * s, z, 0.32 * s, 0.3 * s, 0.32 * s, 0, r() * 6));
  if (bloom !== undefined) for (let k = 0; k < 4; k++) put(b, T.ico0, bloom, MX(x + (r() - 0.5) * 0.4 * s, y + (0.78 + r() * 0.15) * s, z + (r() - 0.5) * 0.4 * s, 0.09 * s, 0.08 * s, 0.09 * s), false);
}

/** Wall lamp: an iron bracket + a small lamp box */
export function wallLamp(ctx: FieldCtx, F: Frame, lx: number, ly: number, lz: number, out: HouseOut): void {
  const { b } = ctx;
  put(b, T.box, IRON, F.L(lx, ly + 0.25, lz + 0.18, 0.05, 0.05, 0.36), false);
  put(b, T.box, IRON, F.L(lx, ly, lz + 0.34, 0.24, 0.3, 0.24));
  putGlow(b, T.box, WINDOW, F.L(lx, ly, lz + 0.34, 0.17, 0.22, 0.26));
  put(b, T.cone4, IRON, F.L(lx, ly + 0.24, lz + 0.34, 0.2, 0.16, 0.2, 0, Math.PI / 4));
  const p = F.p(lx, ly, lz + 0.4);
  out.lights.push([p.x, p.y, p.z, 1.3]);
}

/** Bougainvillea: a big spread of flowers climbing up the corner of the wall and spreading under the lintel and eaves */
function bougainvillea(ctx: FieldCtx, F: Frame, lx: number, lz: number, top: number, span: number, col: number): void {
  const { b, r, low } = ctx;
  const cols = [col, col, BLOOMS[(BLOOMS.indexOf(col) + 1) % BLOOMS.length], LEAF[0]];
  rod(b, F.p(lx, 0.2, lz + 0.15), F.p(lx + (r() - 0.5) * 0.3, top - 0.4, lz + 0.15), 0.07, WOOD_D, T.cyl5, false);
  // First lay a layer of leaves, then dot small flower clusters over it (round little balls, no sharp edges)
  const n = low ? 12 : 26;
  const dir = lx > 0 ? -1 : 1;
  for (let i = 0; i < n; i++) {
    // Mostly spreading on top toward the door, with a few hanging down along the corner
    const up = r() < 0.72;
    const x = up ? lx + dir * r() * span : lx + (r() - 0.5) * 0.5;
    const y = up ? top - 0.1 - r() * 0.8 : 0.5 + r() * (top - 0.9);
    const leaf = i % 4 === 0;
    const s = leaf ? 0.2 + r() * 0.1 : 0.11 + r() * 0.1;
    put(b, T.sphere, leaf ? LEAF[i % 3] : cols[Math.floor(r() * 3)], F.L(x, y, lz + 0.12 + r() * 0.18, s * 1.3, s, s * 0.9, 0, r() * 6), false);
  }
}

/** Striped awning: extending out from the wall at a slant */
export function awning(ctx: FieldCtx, F: Frame, lx: number, ly: number, lz: number, w: number, col: number, depth = 1.1): void {
  const n = Math.max(3, Math.round(w / 0.38));
  for (let i = 0; i < n; i++) {
    const x = lx - w / 2 + ((i + 0.5) * w) / n;
    put(ctx.b, T.box, i % 2 ? WHITE : col, F.L(x, ly - Math.sin(0.35) * depth * 0.5, lz + Math.cos(0.35) * depth * 0.5, w / n + 0.01, 0.05, depth, 0.35), false);
    // Hanging wavy edge
    put(ctx.b, T.box, i % 2 ? WHITE : col, F.L(x, ly - Math.sin(0.35) * depth - 0.1, lz + Math.cos(0.35) * depth, w / n + 0.01, 0.22, 0.04), false);
  }
  for (const s of [-1, 1]) rod(ctx.b, F.p(lx + s * (w / 2 - 0.1), ly + 0.1, lz), F.p(lx + s * (w / 2 - 0.1), ly - Math.sin(0.35) * depth, lz + Math.cos(0.35) * depth), 0.025, IRON, T.cyl4, false);
}

/** Door: a stone door frame, a door leaf, an arched transom, a lintel, two stone steps */
function door(ctx: FieldCtx, F: Frame, lx: number, lz: number, trim: number, y = 0.3, steps = true): void {
  const { b } = ctx;
  put(b, T.box, STONE, F.L(lx, y + 1.05, lz + 0.03, 1.36, 2.1, 0.08));
  put(b, T.halfCyl, STONE, F.L(lx, y + 2.1, lz + 0.03, 0.68, 0.68, 0.08));
  put(b, T.box, trim, F.L(lx, y + 0.98, lz + 0.07, 1.0, 1.96, 0.06));
  put(b, T.halfCyl, GLASS, F.L(lx, y + 1.98, lz + 0.075, 0.46, 0.46, 0.05), false);
  // Two horizontal bars and the handle of the door leaf
  for (const dy of [0.5, 1.35]) put(b, T.box, 0x1e2a3a, F.L(lx, y + dy, lz + 0.105, 0.86, 0.04, 0.02), false);
  put(b, T.sphere, 0xd8b050, F.L(lx + 0.34, y + 1.0, lz + 0.12, 0.05, 0.05, 0.05), false);
  if (!steps) return;
  put(b, T.box, STONE_D, F.L(lx, 0.22, lz + 0.35, 1.6, 0.26, 0.7));
  put(b, T.box, STONE_D, F.L(lx, 0.06, lz + 0.8, 1.8, 0.2, 0.5));
}

/** Single-slope roof (annex, shed): the wall top height hi falls toward the front to lo */
function shedRoof(ctx: FieldCtx, F: Frame, lx: number, lz: number, w: number, d: number, lo: number, hi: number, col: number): void {
  const len = Math.hypot(d + 0.5, hi - lo);
  const pitch = Math.atan2(hi - lo, d + 0.5);
  put(ctx.b, T.box, col, F.L(lx, (lo + hi) / 2 + 0.06, lz, w + 0.4, 0.14, len, pitch));
  for (let k = 1; k < 4; k++) {
    const t = k / 4 - 0.5;
    put(ctx.b, T.box, 0x9a4a2e, F.L(lx, (lo + hi) / 2 + 0.15 - t * (hi - lo), lz + t * (d + 0.5), w + 0.4, 0.05, 0.08, pitch), false);
  }
}

/** A Mediterranean-style house; F's origin is the center of the foundation (y is an absolute height) and the facing is the direction of the door */
export function medHouse(ctx: FieldCtx, F: Frame, o: HouseOpt, out: HouseOut): void {
  const { b, r, low } = ctx;
  b.lift = 0;
  const { w, d, h } = o;
  const H = h * o.floors;
  const top = 0.3 + H;
  const roofCol = o.roofCol ?? TERRA;
  const lit = o.lit ?? 0.45;
  // Foundation, walls, wall-foot paint, floor line, eaves
  if (!o.deck) put(b, T.box, STONE_D, F.L(0, -0.15, 0, w + 0.34, 0.9, d + 0.34));
  put(b, T.box, o.wall, F.L(0, 0.3 + H / 2 - (o.deck ? 0.15 : 0), 0, w, H + (o.deck ? 0.3 : 0), d));
  if (o.band !== undefined) put(b, T.box, o.band, F.L(0, 0.62, 0, w + 0.05, 0.64, d + 0.05));
  if (o.floors === 2) put(b, T.box, STONE, F.L(0, 0.3 + h, 0, w + 0.14, 0.12, d + 0.14));
  put(b, T.box, o.roof === 'flat' ? o.wall : STONE, F.L(0, top, 0, w + 0.22, 0.16, d + 0.22));
  // Openings of the four walls: the middle of the front's ground floor is the door (a shopfront's door is to one side)
  const doorX = o.shop ? -w * 0.22 : 0;
  const walls: [number, number, number][] = [
    [0, w, d / 2],
    [Math.PI, w, d / 2],
    [Math.PI / 2, d, w / 2],
    [-Math.PI / 2, d, w / 2],
  ];
  walls.forEach(([ry, len, off], k) => {
    const WF = F.sub(Math.sin(ry) * off, 0, Math.cos(ry) * off, ry);
    const n = Math.max(1, Math.floor((len - 0.6) / 1.9));
    for (let fl = 0; fl < o.floors; fl++) {
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : -len / 2 + 0.95 + (i * (len - 1.9)) / (n - 1);
        const y = 0.3 + fl * h + h * 0.56;
        // The front ground floor leaves room for the door; the side with the outer stair gets no ground-floor windows
        if (k === 0 && fl === 0 && Math.abs(x - doorX) < 1.3) continue;
        // Convert the windows' positions on the side walls back to the main house's z (the local x of the right wall +x
        // faces -z, and the left wall faces +z)
        const pz = k === 2 ? -x : k === 3 ? x : 0;
        const stairRun = Math.min(d - 0.4, Math.max(5, Math.round((o.floors === 2 ? h : H + 0.2) / 0.3)) * 0.34) + 1.0;
        if (o.stair !== undefined && ((k === 2 && o.stair === 1) || (k === 3 && o.stair === -1)) && (fl === 0 || o.floors === 1) && pz > d / 2 - 0.3 - stairRun - 0.6) continue;
        if (o.annex !== undefined && fl === 0 && ((k === 2 && o.annex === 1) || (k === 3 && o.annex === -1))) continue;
        if (k === 0 && fl === 1 && o.balcony && Math.abs(x) < 0.8) continue;
        windowAt(ctx, WF, x, y, 0, o.trim, r() < lit, !low && k < 2 && r() < 0.6, out);
      }
    }
  });
  // Front door
  const FF = F.sub(0, 0, d / 2, 0);
  door(ctx, FF, doorX, 0, o.trim, 0.3, !o.deck);
  wallLamp(ctx, FF, doorX + 0.95, 2.1, 0, out);
  if (!o.deck) {
    const p = F.p(doorX - 1.1, 0, d / 2 + 0.6);
    pottedPlant(ctx, p.x, F.y, p.z, 1, r() < 0.6 ? GERANIUM[Math.floor(r() * 4)] : undefined);
  }
  if (o.awning !== undefined) awning(ctx, FF, o.shop ? w * 0.18 : doorX, 2.75, 0.05, o.shop ? w * 0.55 : 1.9, o.awning, 1.2);
  // Shopfront: a big display window, a sign, goods displayed at the door
  if (o.shop) shopFront(ctx, FF, w, o, out);
  // Balcony: slab, brackets, railing, potted plants, balcony door
  if (o.floors === 2 && o.balcony) {
    const bw = Math.min(w * 0.62, 3.2);
    const y = 0.3 + h;
    put(b, T.box, STONE, FF.L(0, y, 0.55, bw, 0.14, 1.1));
    for (const s of [-1, 1]) put(b, T.box, STONE_D, FF.L(s * (bw / 2 - 0.25), y - 0.2, 0.3, 0.14, 0.3, 0.55));
    const n = Math.round(bw / 0.24);
    for (let i = 0; i <= n; i++) put(b, T.box, IRON, FF.L(-bw / 2 + 0.05 + (i * (bw - 0.1)) / n, y + 0.45, 1.05, 0.04, 0.78, 0.04), false);
    for (const s of [-1, 1]) put(b, T.box, IRON, FF.L(s * (bw / 2 - 0.05), y + 0.45, 0.55, 0.04, 0.78, 1.0), false);
    put(b, T.box, IRON, FF.L(0, y + 0.86, 1.05, bw, 0.06, 0.06));
    put(b, T.box, o.trim, FF.L(0, y + 1.1, 0.04, 0.9, 1.75, 0.08));
    putGlow(b, T.box, WINDOW, FF.L(0, y + 1.25, 0.08, 0.6, 1.1, 0.04));
    const lp = FF.p(0, y + 1.25, 0.5);
    out.lights.push([lp.x, lp.y, lp.z, 1.2]);
    for (const s of [-1, 1]) {
      const p = FF.p(s * (bw / 2 - 0.35), 0, 0.75);
      pottedPlant(ctx, p.x, F.y + y + 0.07, p.z, 0.8, GERANIUM[Math.floor(r() * 4)]);
    }
    // Laundry under the balcony: a rope with two or three garments
    if (r() < 0.5) {
      const a = FF.p(-bw / 2, y + 0.82, 1.05);
      const c = FF.p(bw / 2, y + 0.82, 1.05);
      const ang = Math.atan2(c.x - a.x, c.z - a.z) - Math.PI / 2;
      for (let i = 0; i < 3; i++) {
        const p = a.clone().lerp(c, 0.25 + i * 0.25);
        out.flags.push(flagGeo(0.5, 0.62, [0xffffff, 0x6ab0e8, 0xffd0a0, 0xe86a6a][Math.floor(r() * 4)], true, false, MX(p.x, p.y, p.z, 1, 1, 1, 0, ang + Math.PI / 2)));
      }
    }
  }
  // Outer stair: a white solid stone stair, climbing along the side wall toward the back to the second floor (or the roof)
  if (o.stair !== undefined) {
    const side = o.stair;
    const rise = o.floors === 2 ? h : H + 0.2;
    const n = Math.max(5, Math.round(rise / 0.3));
    const run = Math.min(d - 0.4, n * 0.34);
    for (let i = 0; i < n; i++) {
      const yy = ((i + 1) / n) * rise;
      const z = d / 2 - 0.3 - (i + 0.5) * (run / n);
      put(b, T.box, o.wall, F.L(side * (w / 2 + 0.5), (0.1 + yy) / 2, z, 0.95, yy + 0.5, run / n + 0.02));
      put(b, T.box, STONE, F.L(side * (w / 2 + 0.5), 0.3 + yy + 0.02, z, 1.0, 0.06, run / n + 0.04), false);
    }
    // A small platform at the top of the stair and a side door
    put(b, T.box, STONE, F.L(side * (w / 2 + 0.5), 0.3 + rise, d / 2 - 0.3 - run - 0.45, 1.0, 0.14, 0.9));
    if (o.floors === 2) put(b, T.box, o.trim, F.L(side * (w / 2 + 0.03), 0.3 + rise + 0.95, d / 2 - 0.3 - run - 0.45, 0.08, 1.7, 0.85));
    pottedPlant(ctx, F.p(side * (w / 2 + 0.6), 0, d / 2 - 0.3 - run * 0.35).x, F.y + 0.3 + rise * 0.4 + 0.05, F.p(side * (w / 2 + 0.6), 0, d / 2 - 0.3 - run * 0.35).z, 0.6, GERANIUM[0]);
  }
  // Single-slope annex (woodshed, fishing gear room)
  if (o.annex !== undefined) {
    const s = o.annex;
    const aw = Math.min(2.4, d * 0.55);
    const ad = d * 0.7;
    const ah = Math.min(h * 0.85, 2.4);
    const ax = s * (w / 2 + aw / 2);
    const az = -d * 0.1;
    put(b, T.box, STONE_D, F.L(ax, -0.1, az, aw + 0.3, 0.7, ad + 0.3));
    put(b, T.box, o.wall, F.L(ax, 0.3 + ah / 2, az, aw, ah, ad));
    const AF = F.sub(ax, 0, az, s * Math.PI / 2);
    put(b, T.box, WOOD, AF.L(0, 0.3 + 0.8, aw / 2 + 0.03, 0.8, 1.6, 0.07));
    for (const dy of [0.5, 1.2]) put(b, T.box, WOOD_D, AF.L(0, 0.3 + dy, aw / 2 + 0.075, 0.8, 0.06, 0.03), false);
    // Single slope: the side next to the main house is higher
    const SF = F.sub(ax, 0, az, s * Math.PI / 2);
    shedRoof(ctx, SF, 0, 0, ad, aw, 0.3 + ah - 0.1, 0.3 + ah + 0.6, roofCol);
    // Firewood or net floats piled beside the annex
    const p = AF.p(0.9, 0, aw / 2 + 0.5);
    if (r() < 0.5) for (let i = 0; i < 3; i++) put(b, T.cyl6, 0xa07a4c, MX(p.x, F.y + 0.12 + i * 0.2, p.z, 0.1, 0.9, 0.1, 0, 0.3 + i * 0.1, Math.PI / 2), false);
    else for (let i = 0; i < 4; i++) put(b, T.sphere, i % 2 ? 0xff6a4a : WHITE, MX(p.x + (i % 2) * 0.25, F.y + 0.14 + Math.floor(i / 2) * 0.24, p.z, 0.14, 0.14, 0.14));
  }
  // Roof
  const ry = top + 0.08;
  if (o.roof === 'hip') {
    const W = w + 0.8;
    const D = d + 0.8;
    const rh = Math.min(w, d) * 0.38;
    put(b, T.box, STONE, F.L(0, ry, 0, W + 0.05, 0.12, D + 0.05));
    const { geo, faces } = hipRoof(W, D, rh);
    put(b, geo, roofCol, F.L(0, ry + 0.06, 0));
    tileCourses(ctx, F, ry + 0.06, faces, 4, 0xa84a2c);
    ridges(ctx, F, ry + 0.06, faces, 0x9a3e26);
  } else if (o.roof === 'gable') {
    // The ridge is parallel to the front (the left and right sides are gables)
    const rh = d * 0.36;
    const ov = 0.45;
    put(b, T.prism, o.wall, F.L(0, top + 0.06, 0, d, rh, w, 0, Math.PI / 2));
    const half = d / 2 + ov;
    const len = Math.hypot(half, rh * (half / (d / 2)));
    const pitch = Math.atan2(rh, d / 2);
    for (const s of [-1, 1]) {
      const cz = (s * half) / 2;
      const cy = top + 0.06 + rh - (rh / (d / 2)) * (half / 2) + 0.1;
      put(b, T.box, roofCol, F.L(0, cy, cz, w + 0.8, 0.16, len, s * pitch));
      // Tile rows: horizontal lines along the ridge direction
      for (let k = 1; k <= 4; k++) {
        const t = k / 5;
        const z = s * half * t;
        const y = top + 0.06 + rh - (rh / (d / 2)) * Math.abs(z) + 0.2;
        put(b, T.box, 0xa84a2c, F.L(0, y, z, w + 0.8, 0.05, 0.07, s * pitch), false);
      }
      // Fascia board at the eaves
      put(b, T.box, STONE, F.L(0, top + 0.06 + rh - (rh / (d / 2)) * half + 0.02, s * half, w + 0.84, 0.2, 0.08));
    }
    put(b, T.cyl6, 0x9a3e26, F.L(0, top + 0.06 + rh + 0.2, 0, 0.12, w + 0.9, 0.12, 0, 0, Math.PI / 2));
    // A small ventilation window on the gable
    for (const s of [-1, 1]) put(b, T.box, o.trim, F.L(s * (w / 2 + 0.02), top + 0.06 + rh * 0.4, 0, 0.06, 0.34, 0.5));
  } else {
    // Flat roof: parapet, roof terrace (pergola, clay jars, clothesline)
    for (const [x, z, sx, sz] of [
      [0, d / 2, w + 0.22, 0.2],
      [0, -d / 2, w + 0.22, 0.2],
      [w / 2, 0, 0.2, d + 0.22],
      [-w / 2, 0, 0.2, d + 0.22],
    ]) {
      put(b, T.box, o.wall, F.L(x, top + 0.34, z, sx, 0.5, sz));
      put(b, T.box, o.band ?? STONE, F.L(x, top + 0.62, z, sx + 0.06, 0.07, sz + 0.06), false);
    }
    rooftop(ctx, F, w, d, top + 0.08, o, out);
  }
  // Chimney
  if (o.chimney) {
    const cx = w * 0.28;
    const cz = -d * 0.18;
    const base = o.roof === 'flat' ? top : ry + Math.min(w, d) * 0.2;
    put(b, T.box, o.wall, F.L(cx, base + 0.6, cz, 0.52, 1.5, 0.52));
    put(b, T.box, STONE, F.L(cx, base + 1.4, cz, 0.7, 0.12, 0.7));
    for (const s of [-1, 1]) put(b, T.cyl8, TERRA, F.L(cx + s * 0.13, base + 1.6, cz, 0.08, 0.3, 0.08));
    out.smoke.push(F.p(cx, base + 1.85, cz));
  }
  // Bougainvillea: at the corner of the wall beside the door
  if (o.vine !== undefined) {
    const vx = o.shop ? w / 2 - 0.3 : doorX + (r() < 0.5 ? -1 : 1) * Math.min(w / 2 - 0.3, 1.6);
    bougainvillea(ctx, FF, vx, 0, o.floors === 2 ? 0.3 + h + 0.2 : top, Math.min(2.6, w * 0.5), o.vine);
  }
  // Collision: two circles along the long side (the annex and outer stair are added separately)
  if (!o.noSolid) {
    const long = Math.max(w, d);
    const short = Math.min(w, d);
    const k = (long - short) / 2;
    const ax = w >= d;
    for (const s of k > 0.4 ? [-1, 1] : [0]) {
      const p = F.p(ax ? s * k : 0, 0, ax ? 0 : s * k);
      ctx.solids.add(p.x, p.z, short * 0.62 + 0.15);
    }
    if (o.stair !== undefined) {
      const p = F.p(o.stair * (w / 2 + 0.5), 0, 0);
      ctx.solids.add(p.x, p.z, 0.8);
      const q = F.p(o.stair * (w / 2 + 0.5), 0, d / 2 - 0.6);
      ctx.solids.add(q.x, q.z, 0.6);
    }
    if (o.annex !== undefined) {
      const p = F.p(o.annex * (w / 2 + 1.1), 0, -d * 0.1);
      ctx.solids.add(p.x, p.z, 1.4);
    }
  }
}

/** The roof terrace of a flat-roofed house */
function rooftop(ctx: FieldCtx, F: Frame, w: number, d: number, y: number, o: HouseOpt, out: HouseOut): void {
  const { b, r } = ctx;
  // Pergola: four white posts, wooden beams, covered in grapevines
  const px = -w * 0.2;
  const pw = w * 0.5;
  const pd = d * 0.55;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(b, T.box, o.wall, F.L(px + sx * pw / 2, y + 1.1, sz * pd / 2, 0.18, 2.2, 0.18));
  for (const sz of [-1, 1]) put(b, T.box, WOOD, F.L(px, y + 2.25, sz * pd / 2, pw + 0.5, 0.12, 0.14));
  for (let i = 0; i < 5; i++) put(b, T.box, WOOD, F.L(px - pw / 2 + (i * pw) / 4, y + 2.36, 0, 0.1, 0.1, pd + 0.4), false);
  for (let i = 0; i < 9; i++) put(b, T.ico0, i % 3 ? LEAF[i % 3] : 0x7ab84a, F.L(px + (r() - 0.5) * pw, y + 2.45 + r() * 0.1, (r() - 0.5) * pd, 0.42, 0.18, 0.42, 0, r() * 6), false);
  // A small table and two chairs under the vines
  put(b, T.cyl8, WHITE, F.L(px, y + 0.45, 0, 0.35, 0.06, 0.35));
  put(b, T.cyl5, IRON, F.L(px, y + 0.22, 0, 0.04, 0.45, 0.04), false);
  for (const s of [-1, 1]) put(b, T.box, o.trim, F.L(px + s * 0.6, y + 0.25, 0, 0.36, 0.5, 0.36));
  // The other side: a water tank, clay jars, a clothesline
  const qx = w * 0.28;
  put(b, T.cyl12, WHITE, F.L(qx, y + 0.5, -d * 0.2, 0.5, 1.0, 0.5));
  put(b, T.cone12, o.band ?? STONE, F.L(qx, y + 1.12, -d * 0.2, 0.55, 0.25, 0.55));
  put(b, T.taper8, TERRA, F.L(qx - 0.1, y + 0.35, d * 0.25, 0.28, 0.7, 0.28));
  const a = F.p(qx + 0.2, y + 1.6, -d / 2 + 0.2);
  const c = F.p(qx + 0.2, y + 1.6, d / 2 - 0.2);
  for (const p of [a, c]) rod(b, p.clone().setY(y), p, 0.04, WOOD_D, T.cyl4, false);
  rope(b, a, c, 0.15, 0.015, 0xe8e0d0, 4);
  const ang = Math.atan2(c.x - a.x, c.z - a.z) - Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const p = a.clone().lerp(c, 0.22 + i * 0.28);
    out.flags.push(flagGeo(0.55, 0.7, [0xffffff, 0x6ab0e8, 0xffd0a0, 0xe86a6a, 0xa0d890][Math.floor(r() * 5)], true, false, MX(p.x, p.y - 0.12, p.z, 1, 1, 1, 0, ang + Math.PI / 2)));
  }
}

/** Shopfront: display window, hanging sign, goods at the door */
function shopFront(ctx: FieldCtx, FF: Frame, w: number, o: HouseOpt, out: HouseOut): void {
  const { b, r } = ctx;
  const sx = w * 0.18;
  const sw = w * 0.42;
  put(b, T.box, o.trim, FF.L(sx, 1.35, 0.04, sw + 0.2, 1.7, 0.08));
  putGlow(b, T.box, WINDOW, FF.L(sx, 1.4, 0.08, sw - 0.2, 1.3, 0.04));
  const lp = FF.p(sx, 1.4, 0.5);
  out.lights.push([lp.x, lp.y, lp.z, 1.4]);
  put(b, T.box, STONE, FF.L(sx, 0.55, 0.14, sw + 0.3, 0.14, 0.3));
  // Sign: an iron bracket extending from the wall, hung with a wooden board bearing a picture
  const kx = w / 2 - 0.25;
  put(b, T.box, IRON, FF.L(kx, 3.0, 0.45, 0.05, 0.05, 0.9), false);
  put(b, T.box, PLANK, FF.L(kx, 2.62, 0.75, 0.08, 0.6, 0.7));
  const icon = o.shop === 'fish' ? 0x4a8ac8 : o.shop === 'bread' ? 0xd8a050 : o.shop === 'rope' ? 0x8a7a5a : TERRA;
  if (o.shop === 'fish') {
    put(b, T.oct, icon, FF.L(kx + 0.06, 2.62, 0.75, 0.04, 0.12, 0.26), false);
  } else put(b, T.sphere, icon, FF.L(kx + 0.06, 2.62, 0.75, 0.04, 0.16, 0.2), false);
  // Goods at the door: two crates and things set on top
  for (let i = 0; i < 2; i++) {
    const x = sx - sw / 2 + 0.4 + i * (sw - 0.8);
    put(b, T.box, WOOD, FF.L(x, 0.3 + 0.28, 0.75, 0.62, 0.56, 0.5));
    for (let k = 0; k < 4; k++) {
      const gx = x - 0.2 + (k % 2) * 0.4;
      const gz = 0.65 + Math.floor(k / 2) * 0.2;
      if (o.shop === 'fish') put(b, T.oct, [0xb8c8d8, 0x6a9ac8, 0xff8a5a][k % 3], FF.L(gx, 0.93, gz, 0.26, 0.07, 0.1, 0, r() * 0.5), false);
      else if (o.shop === 'bread') put(b, T.sphere, 0xd8a050, FF.L(gx, 0.93, gz, 0.2, 0.1, 0.12, 0, r()), false);
      else if (o.shop === 'rope') put(b, T.torus, 0xc8b48a, FF.L(gx, 0.92, gz, 0.16, 0.16, 0.16, Math.PI / 2), false);
      else put(b, T.taper8, [TERRA, 0x4a8ac8, 0xf2e6cc][k % 3], FF.L(gx, 1.02, gz, 0.12, 0.3, 0.12), false);
    }
  }
}

/**
 * Whale Chapel: a small white church, a blue dome, a bell wall on the front (two bells), round windows and an archway,
 * with a golden whale tail on top
 */
export function whaleChapel(ctx: FieldCtx, F: Frame, out: HouseOut): void {
  const { b } = ctx;
  b.lift = 0;
  const w = 4.6;
  const d = 5.6;
  const H = 3.6;
  const BLUE = 0x2f6ac8;
  put(b, T.box, STONE_D, F.L(0, -0.1, 0, w + 0.5, 0.9, d + 0.5));
  put(b, T.box, WHITE, F.L(0, 0.35 + H / 2, 0, w, H, d));
  put(b, T.box, 0x6aa8e8, F.L(0, 0.62, 0, w + 0.05, 0.6, d + 0.05));
  put(b, T.box, WHITE, F.L(0, 0.35 + H, 0, w + 0.25, 0.2, d + 0.25));
  // Dome: an octagonal drum + a blue hemisphere + a small lantern top
  put(b, T.cyl8, WHITE, F.L(0, 0.35 + H + 0.55, -0.3, 1.75, 1.1, 1.75));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    put(b, T.box, BLUE, F.L(Math.sin(a) * 1.72, 0.35 + H + 0.6, -0.3 + Math.cos(a) * 1.72, 0.3, 0.55, 0.06, 0, a));
  }
  put(b, T.dome, BLUE, F.L(0, 0.35 + H + 1.1, -0.3, 1.85, 1.9, 1.85));
  put(b, T.cyl8, WHITE, F.L(0, 0.35 + H + 3.1, -0.3, 0.3, 0.45, 0.3));
  put(b, T.cone8, BLUE, F.L(0, 0.35 + H + 3.5, -0.3, 0.36, 0.4, 0.36));
  // Whale tail: a golden fluke
  const tailY = 0.35 + H + 3.95;
  put(b, T.cyl5, 0xe8c04a, F.L(0, tailY, -0.3, 0.07, 0.5, 0.07));
  for (const s of [-1, 1]) put(b, T.sphere, 0xe8c04a, F.L(s * 0.28, tailY + 0.3, -0.3, 0.34, 0.08, 0.14, 0, 0, s * 0.45));
  // The bell wall on the front: a white wall taller than the roof, with two arched openings each hung with a bell
  const bz = d / 2 - 0.2;
  put(b, T.box, WHITE, F.L(0, 0.35 + H + 1.2, bz, w * 0.8, 2.4, 0.45));
  put(b, T.halfCyl, WHITE, F.L(0, 0.35 + H + 2.4, bz, w * 0.4, 0.8, 0.45));
  for (const s of [-1, 1]) {
    const x = s * 0.8;
    const y = 0.35 + H + 1.25;
    put(b, T.box, 0x3a5a8a, F.L(x, y, bz + 0.24, 0.72, 0.95, 0.03), false);
    put(b, T.halfCyl, 0x3a5a8a, F.L(x, y + 0.47, bz + 0.24, 0.36, 0.36, 0.03), false);
    put(b, T.cyl8, 0xc89a48, F.L(x, y + 0.1, bz + 0.3, 0.22, 0.4, 0.22));
    put(b, T.cone8, 0xc89a48, F.L(x, y - 0.2, bz + 0.3, 0.3, 0.25, 0.3, Math.PI));
  }
  put(b, T.box, BLUE, F.L(0, 0.35 + H + 2.62, bz, 0.12, 0.5, 0.12));
  put(b, T.box, BLUE, F.L(0, 0.35 + H + 2.7, bz, 0.34, 0.1, 0.12));
  // Archway, round windows, tall windows on the sides
  const FF = F.sub(0, 0, d / 2, 0);
  door(ctx, FF, 0, 0, BLUE, 0.35);
  put(b, T.torus, BLUE, FF.L(0, 3.0, 0.08, 0.42, 0.42, 0.6));
  putGlow(b, T.disc, WINDOW, FF.L(0, 3.0, 0.1, 0.36, 1, 0.36, Math.PI / 2));
  for (const s of [-1, 1]) {
    const SF = F.sub(s * (w / 2), 0, 0, (s * Math.PI) / 2);
    for (const z of [-1.5, 0.6]) {
      put(b, T.box, BLUE, SF.L(z, 2.3, 0.03, 0.6, 1.5, 0.06));
      put(b, T.halfCyl, BLUE, SF.L(z, 3.05, 0.03, 0.3, 0.3, 0.06));
      putGlow(b, T.box, WINDOW, SF.L(z, 2.3, 0.06, 0.42, 1.3, 0.03));
      const p = SF.p(z, 2.3, 0.4);
      out.lights.push([p.x, p.y, p.z, 1.1]);
    }
  }
  // Candle stands and shell offerings in front of the door
  for (const s of [-1, 1]) {
    const p = FF.p(s * 1.5, 0, 1.1);
    put(b, T.cyl6, STONE, MX(p.x, F.y + 0.45, p.z, 0.18, 0.9, 0.18));
    put(b, T.cyl6, 0xfff4e0, MX(p.x, F.y + 1.0, p.z, 0.06, 0.2, 0.06), false);
    putGlow(b, T.sphere, 0xffc86a, MX(p.x, F.y + 1.16, p.z, 0.06, 0.08, 0.06));
    out.lights.push([p.x, F.y + 1.16, p.z, 0.8]);
  }
  wallLamp(ctx, FF, 1.4, 2.4, 0, out);
  wallLamp(ctx, FF, -1.4, 2.4, 0, out);
  ctx.solids.add(F.p(0, 0, -1.1).x, F.p(0, 0, -1.1).z, 2.9);
  ctx.solids.add(F.p(0, 0, 1.3).x, F.p(0, 0, 1.3).z, 2.6);
}

/** Low white stone wall (yard wall, terraces): along a -> c, with a rounded coping on top */
export function lowWall(ctx: FieldCtx, a: [number, number], c: [number, number], col: number, cap: number, hgt = 0.85, solid = true): void {
  const { b } = ctx;
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const n = Math.max(1, Math.round(len / 1.6));
  const ang = Math.atan2(c[0] - a[0], c[1] - a[1]);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = a[0] + (c[0] - a[0]) * t;
    const z = a[1] + (c[1] - a[1]) * t;
    const y = ctx.h(x, z);
    b.lift = 0;
    put(b, T.box, col, MX(x, y + hgt / 2 - 0.15, z, 0.4, hgt + 0.3, len / n + 0.02, 0, ang));
    put(b, T.cyl6, cap, MX(x, y + hgt - 0.02, z, 0.24, len / n + 0.02, 0.24, Math.PI / 2, ang), false);
    if (solid) ctx.solids.add(x, z, 0.45);
  }
}
