// Details around two landmarks (the ground layer does not go into these two places, so they are laid separately):
//   Geyser Flats: the sinter terraces where the sinter mounds run off downhill, microbial mat in patches along the flow
//     channels (pale yellow where it is hot, turning orange outward, then green-brown), bubbling mud pots, small blue-green
//     hot spring eyes, white-footed dead trees killed by silica sinter (the lower half of the trunk wrapped in a white
//     shell), smoking ground fissures;
//   The plaza in front of the Seal Tower: a ring of old paving stones around the platform below the tower (more broken the
//     farther out, some tilted up, some split in two), broken stone curbs, four broken pillars; before purification the
//     plaza carries the Order's purple curse marks.

import * as THREE from 'three';
import type { FieldCtx, Solids } from '../../kit.ts';
import type { GroundOut } from './ground.ts';
import { COL } from './props.ts';
import * as SH from './shape.ts';
import { G, MX, T, lean, onSlope, put } from './tmpl.ts';

export interface SitesOut {
  /** Mud pots (bubbling, spattering mud drops) */
  mud: THREE.Vector3[];
}

const TAU = Math.PI * 2;

const SINTER = 0xc8bea8;
const SINTER_D = 0x9a9286;
const SINTER_L = 0xdcd2bc;

/** Downhill direction (unit vector in xz) */
function downhill(ctx: FieldCtx, x: number, z: number): [number, number] {
  const gx = ctx.h(x + 1.5, z) - ctx.h(x - 1.5, z);
  const gz = ctx.h(x, z + 1.5) - ctx.h(x, z - 1.5);
  const l = Math.hypot(gx, gz);
  if (l < 1e-3) return [SH.SPRING_DOWN[0], SH.SPRING_DOWN[1]];
  return [-gx / l, -gz / l];
}

function slope(ctx: FieldCtx, x: number, z: number): number {
  const h = ctx.h;
  return Math.hypot(h(x + 1, z) - h(x - 1, z), h(x, z + 1) - h(x, z - 1)) / 2;
}

// ───────────────────────── Geyser Flats ─────────────────────────

/** Sinter terrace: a thin sheet of sinter crust, with a pale lip turned up along its outer edge */
function sinterShelf(ctx: FieldCtx, x: number, z: number, R: number, a: number): void {
  const { b, r } = ctx;
  b.lift = ctx.h(x, z);
  put(b, T.hex, r() < 0.5 ? SINTER : SINTER_D, onSlope(ctx, x, z, 0.02, R, 0.1, R * 0.7, a + r() * 0.3), false);
  // the lip on the downhill side (the arc bulges outward)
  put(b, T.arc, SINTER_L, onSlope(ctx, x, z, 0.08, R * 0.95, 0.5, R * 0.75, -a + Math.PI * 0.15), false);
}

/** Mud pot: a grey-brown mud surface, a raised mud lip, and a few set mud bubbles */
function mudPot(ctx: FieldCtx, x: number, z: number, R: number, out: SitesOut, ground: GroundOut): void {
  const { b, r } = ctx;
  const y = ctx.place(x, z, R);
  put(b, T.disc6, 0x3e3634, MX(x, 0.06, z, R, 1, R * 0.85, r() * TAU), false);
  // a small reflective patch on the mud surface
  put(b, T.disc6, 0x6e6664, MX(x - R * 0.25, 0.065, z - R * 0.2, R * 0.3, 1, R * 0.18, r() * TAU), false);
  put(b, T.torus, 0x5a504c, MX(x, 0.08, z, R * 1.02, 1.8, R * 0.87, r() * TAU));
  for (let k = 0; k < 3; k++) {
    const a = r() * TAU;
    const d = r() * R * 0.55;
    const s = 0.12 + r() * 0.14;
    put(b, T.half, 0x5e5552, MX(x + Math.cos(a) * d, 0.06, z + Math.sin(a) * d, s, s * 0.8, s), false);
  }
  // spattered mud drops
  for (let k = 0; k < 5; k++) {
    const a = r() * TAU;
    const d = R * (1.15 + r() * 0.7);
    put(b, T.disc6, 0x645c58, MX(x + Math.cos(a) * d, 0.02, z + Math.sin(a) * d, 0.12 + r() * 0.12, 1, 0.1 + r() * 0.1, r() * TAU), false);
  }
  ground.stains.add(x, z, R * 2.4, 0x4e4644, 0.6);
  out.mud.push(new THREE.Vector3(x, y + 0.12, z));
  ctx.solids.add(x, z, R * 0.9);
}

/**
 * Hot spring eye: a deep blue water eye with a pale sinter lip, and an outer ring of microbial mat that shifts from yellow
 * to orange (painted onto the terrain vertex colors)
 */
function hotEye(ctx: FieldCtx, x: number, z: number, R: number, ground: GroundOut): void {
  const { b, r } = ctx;
  ctx.place(x, z, R);
  put(b, T.disc, 0x1e4a66, MX(x, 0.05, z, R * 0.55, 1, R * 0.55), false);
  put(b, T.disc, 0x3a8c96, MX(x, 0.04, z, R * 0.85, 1, R * 0.8, r() * TAU), false);
  put(b, T.torus, SINTER_L, MX(x, 0.06, z, R * 0.9, 0.8, R * 0.85, r() * TAU), false);
  ground.stains.add(x, z, R * 1.7, 0xb89a48, 0.6);
  ground.stains.add(x, z, R * 2.6, 0xa85a2c, 0.45);
  ground.wisps.push(new THREE.Vector3(x, ctx.h(x, z) + 0.2, z));
  ctx.solids.add(x, z, R * 0.8);
}

/** White-footed dead tree: a tree killed by silica sinter, the lower half of its trunk wrapped in a white shell */
function bleachedSnag(ctx: FieldCtx, x: number, z: number, s: number): void {
  const { b, r } = ctx;
  ctx.place(x, z, 0.3);
  const a = r() * TAU;
  const tilt = r() * 0.12;
  const H = (2.6 + r() * 1.4) * s;
  put(b, T.cyl5, 0x4a4246, lean(x, 0, z, a, tilt, H, 0.13 * s, 0.13 * s));
  // white shell: a bit thicker than the trunk, tapering upward
  put(b, T.hexT, SINTER_L, MX(x, 0.35 * s, z, 0.2 * s, 0.75 * s, 0.2 * s, r()), false);
  put(b, T.hexT, SINTER, MX(x, 0.05, z, 0.34 * s, 0.14, 0.34 * s, r()), false);
  const tx = x + Math.sin(tilt) * Math.cos(a) * H;
  const tz = z + Math.sin(tilt) * Math.sin(a) * H;
  const n = 2 + Math.floor(r() * 2);
  for (let k = 0; k < n; k++) {
    const t = 0.55 + k * 0.16;
    const ba = a + (k - 1) * 2.1 + (r() - 0.5) * 0.6;
    put(b, T.cyl5, 0x3e373a, lean(x + (tx - x) * t, H * t * Math.cos(tilt), z + (tz - z) * t, ba, 0.8 + r() * 0.4, (0.6 + r() * 0.6) * s, 0.05 * s, 0.05 * s), false);
  }
  ctx.solids.add(x, z, 0.35 * s);
}

/** Smoking ground fissure: a black crack with a ring of pale yellow sulfur bloom on both sides */
function steamCrack(ctx: FieldCtx, x: number, z: number, a: number, ground: GroundOut): void {
  const { b, r } = ctx;
  b.lift = ctx.h(x, z);
  const L = 1.6 + r() * 1.4;
  for (let k = 0; k < 3; k++) {
    const t = (k - 1) * L * 0.33;
    const px = x + Math.cos(a) * t;
    const pz = z + Math.sin(a) * t;
    put(b, T.box, 0x1a1416, onSlope(ctx, px, pz, 0.01, L * 0.36, 0.04, 0.1 + r() * 0.06, -a + (r() - 0.5) * 0.3), false);
  }
  ground.stains.add(x, z, L * 0.6, G.sulfur, 0.4);
  ground.wisps.push(new THREE.Vector3(x, ctx.h(x, z) + 0.15, z));
}

function geyserField(ctx: FieldCtx, busy: Solids, ground: GroundOut, out: SitesOut): void {
  const { r } = ctx;
  const [gx, gz] = SH.GEYSER;
  const pw = ctx.layout.pathW;
  const vents = SH.GEYSER_VENTS.map(([dx, dz, s]) => [gx + dx, gz + dz, s] as const);
  /** Far enough from the sinter mounds (the mounds themselves, the shallow pools, the warning stakes) */
  const offVents = (x: number, z: number, m: number) => vents.every(([vx, vz, s]) => Math.hypot(x - vx, z - vz) > 3.9 * s + m);
  const free = (x: number, z: number, m: number) => ctx.pathDist(x, z) > pw + 1.2 + m && offVents(x, z, m) && !busy.blocked(x, z, m) && !ctx.solids.blocked(x, z, m);

  // each sinter mound sends a flow channel downhill: the terraces step down, and the microbial mat goes pale yellow ->
  // orange -> green-brown
  for (const [vx, vz, s] of vents) {
    const [dx, dz] = downhill(ctx, vx, vz);
    const a = Math.atan2(dz, dx);
    const mats = [0xc8a040, 0xc0642a, 0x9a4a24, 0x6e6a34, 0x4e4a30];
    for (let k = 0; k < 10; k++) {
      const d = 3.4 * s + k * 0.85;
      const wob = Math.sin(k * 0.8 + vx) * 0.7;
      const x = vx + dx * d - dz * wob;
      const z = vz + dz * d + dx * wob;
      if (ctx.pathDist(x, z) < pw + 0.6) break;
      ground.stains.add(x, z, 0.9 + k * 0.13, mats[k >> 1], 0.72 - k * 0.03);
      if (k % 2 === 1 && k >= 3 && k <= 7 && !busy.blocked(x, z, 0.5)) sinterShelf(ctx, x, z, 0.8 + (7 - k) * 0.08 + r() * 0.2, a);
    }
    // a ring of pale silica sinter at the foot of the mound
    ground.stains.add(vx, vz, 4.4 * s, SINTER_D, 0.35);
  }

  // mud pots, hot spring eyes, smoking fissures: look for flat open ground in the sinter flats (the three take turns)
  const want = [ctx.low ? 3 : 5, ctx.low ? 2 : 4, ctx.low ? 3 : 6];
  for (let i = 0; i < 180 && want[0] + want[1] + want[2] > 0; i++) {
    const kind = i % 3;
    if (!want[kind]) continue;
    const a = r() * TAU;
    const d = 5 + Math.sqrt(r()) * 12;
    const x = gx + Math.cos(a) * d;
    const z = gz + Math.sin(a) * d;
    if (slope(ctx, x, z) > 0.14 || ctx.h(x, z) < SH.LAVA + 1.5) continue;
    if (kind === 0 && free(x, z, 1.4)) {
      mudPot(ctx, x, z, 0.8 + r() * 0.5, out, ground);
      busy.add(x, z, 2);
    } else if (kind === 1 && free(x, z, 1.2)) {
      hotEye(ctx, x, z, 0.7 + r() * 0.4, ground);
      busy.add(x, z, 1.8);
    } else if (kind === 2 && free(x, z, 0.6)) {
      steamCrack(ctx, x, z, r() * TAU, ground);
      busy.add(x, z, 1.4);
    } else continue;
    want[kind]--;
  }
  // white-footed dead trees: the outer edge of the sinter flats
  let snags = 0;
  for (let i = 0; i < 40 && snags < 6; i++) {
    const a = r() * TAU;
    const d = 11 + r() * 6;
    const x = gx + Math.cos(a) * d;
    const z = gz + Math.sin(a) * d;
    if (!free(x, z, 1.2) || !ctx.clear(x, z, 0.8)) continue;
    bleachedSnag(ctx, x, z, 0.8 + r() * 0.4);
    busy.add(x, z, 2.5);
    snags++;
  }

  // sinter crust fragments: thin plates scattered over the sinter flats, broken into small pieces at the edges
  const n = ctx.low ? 22 : 40;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const d = 4 + Math.sqrt(r()) * 12;
    const x = gx + Math.cos(a) * d;
    const z = gz + Math.sin(a) * d;
    if (!free(x, z, 0.3)) continue;
    const b = ctx.b;
    b.lift = ctx.h(x, z);
    const R = 0.35 + r() * 0.5;
    put(b, T.hex, r() < 0.5 ? SINTER : SINTER_L, onSlope(ctx, x, z, 0.01, R, 0.06, R * (0.5 + r() * 0.4), r() * TAU, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12), false);
    if (r() < 0.5) put(b, T.dod, SINTER_D, onSlope(ctx, x + R, z + (r() - 0.5) * R, 0.02, 0.1, 0.05, 0.08, r() * TAU), false);
  }
}

// ───────────────────────── Plaza in front of the Seal Tower ─────────────────────────

function towerPlaza(ctx: FieldCtx, busy: Solids, ground: GroundOut, k: number): void {
  const { b, r } = ctx;
  const [tx, tz] = SH.TOWER;
  const pw = ctx.layout.pathW;
  const stones = [COL.stone, COL.stoneD, 0x5e5058, 0x6e6064];
  /** The tower's door and the main road must stay clear; the side with the Order forge already has props */
  const open = (x: number, z: number, m: number) => ctx.pathDist(x, z) > pw + 0.4 + m && !ctx.solids.blocked(x, z, m) && !busy.blocked(x, z, m);

  // old paving stones: laid out ring by ring, sparser the farther out
  for (let ring = 0; ring < 5; ring++) {
    const R = 17.6 + ring * 1.45;
    const keep = 0.9 - ring * 0.17;
    const n = Math.floor((TAU * R) / 1.5);
    for (let i = 0; i < n; i++) {
      if (r() > keep) continue;
      const a = (i + (ring % 2) * 0.5) * (TAU / n) + (r() - 0.5) * 0.05;
      const x = tx + Math.cos(a) * R;
      const z = tz + Math.sin(a) * R;
      if (!open(x, z, 0.5)) continue;
      b.lift = ctx.h(x, z);
      const w = 1.2 + r() * 0.2;
      const d = 1.2 + r() * 0.15;
      const col = stones[Math.floor(r() * stones.length)];
      // a tilted-up corner, split in two
      const heave = r() < 0.12 ? 0.12 + r() * 0.1 : 0;
      if (r() < 0.15) {
        for (const s of [-1, 1]) put(b, T.box, col, onSlope(ctx, x - Math.sin(a) * s * w * 0.26, z + Math.cos(a) * s * w * 0.26, 0.02, w * 0.46, 0.1, d * 0.92, -a + (r() - 0.5) * 0.12), false);
      } else {
        put(b, T.box, col, onSlope(ctx, x, z, 0.02 + heave * 0.4, w, 0.1, d * 0.92, -a + (r() - 0.5) * 0.06, 0, heave), false);
      }
    }
  }

  // broken stone curb (the plaza's outline)
  const R = 25.2;
  const n = Math.floor((TAU * R) / 1.1);
  for (let i = 0; i < n; i++) {
    if (r() < 0.3) continue;
    const a = (i / n) * TAU;
    const x = tx + Math.cos(a) * R;
    const z = tz + Math.sin(a) * R;
    if (!open(x, z, 0.4)) continue;
    b.lift = ctx.h(x, z);
    put(b, T.box, r() < 0.5 ? COL.stoneD : COL.basalt2, onSlope(ctx, x, z, 0.1, 0.4, 0.3, 1.0, -a + (r() - 0.5) * 0.1, 0, (r() - 0.5) * 0.2));
  }

  // four broken pillars: the plaza's four diagonal corners
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2 + (r() - 0.5) * 0.2;
    const x = tx + Math.cos(a) * 27.5;
    const z = tz + Math.sin(a) * 27.5;
    if (!open(x, z, 1.4)) continue;
    ctx.place(x, z, 0.8);
    const H = 1.2 + r() * 2.2;
    put(b, T.box, COL.stoneD, MX(x, 0.2, z, 1.5, 0.4, 1.5, a));
    put(b, T.pent, COL.stone, MX(x, 0.4 + H / 2, z, 0.52, H, 0.52, a));
    // broken ends: a slant-cut capital, a piece fallen to one side
    put(b, T.pent, COL.stoneL, MX(x, 0.4 + H + 0.08, z, 0.5, 0.2, 0.5, a, 0.3, 0.1));
    const fa = a + 1.2 + r();
    put(b, T.pent, COL.stone, MX(x + Math.cos(fa) * 1.6, 0.3, z + Math.sin(fa) * 1.6, 0.48, 1.2, 0.48, fa, 0, Math.PI / 2));
    ctx.solids.add(x, z, 0.9);
    ctx.solids.add(x + Math.cos(fa) * 1.6, z + Math.sin(fa) * 1.6, 0.6);
    busy.add(x, z, 2.5);
  }

  // Before purification: the Order's curse marks painted on the paving stones (purple-black rings), fading with every
  // additional floor broken through
  if (k < 1) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.4;
      const x = tx + Math.cos(a) * 21;
      const z = tz + Math.sin(a) * 21;
      ground.stains.add(x, z, 2.2, 0x2a1830, 0.55 * (1 - k));
      ground.stains.add(x, z, 1.1, 0x5a2a7a, 0.4 * (1 - k));
    }
  }
  // volcanic ash piled up by the wind at the foot of the platform
  for (let i = 0; i < 10; i++) {
    const a = r() * TAU;
    ground.stains.add(tx + Math.cos(a) * 18, tz + Math.sin(a) * 18, 2 + r() * 1.5, G.ashL, 0.35);
  }
}

export function buildSites(ctx: FieldCtx, busy: Solids, ground: GroundOut): SitesOut {
  const out: SitesOut = { mud: [] };
  const k = ctx.floors > 0 ? Math.min(1, ctx.done / ctx.floors) : 0;
  geyserField(ctx, busy, ground, out);
  towerPlaza(ctx, busy, ground, k);
  ctx.b.lift = 0;
  return out;
}
