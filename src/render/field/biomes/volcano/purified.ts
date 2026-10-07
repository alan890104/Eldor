// As the Seal Tower is broken through floor by floor, the volcanic belt changes with it:
//   Before purification, the Order of the Hollow Crown has driven iron stakes along the small paths on the north bank and
//   the plateau, each topped with a purple blight crystal and hung with torn purple cloth;
//   every floor broken through removes a few of them, and the Knights pile up a cairn where a stake was pulled and tie red
//   cloth strips to it;
//   once every floor is broken through, the volcanic ash ground that the Void Blight had suppressed sprouts clumps of
//   fireweed (the first flower to return on burnt land) and moss grows on the lava crust,
//   and the Knights' oathswords and braziers stand in front of the tower. (Rediron Keep's festival is in town.ts, the Order
//   forge's withdrawal in wild.ts)
// Placed at the very end of decorate, so the random numbers it uses do not affect the other placements.

import * as THREE from 'three';
import { smooth } from '../../compose.ts';
import type { FieldCtx, Solids, XZ } from '../../kit.ts';
import { banner } from './fx.ts';
import { cairn, jitter, landmark, type GroundOut } from './ground.ts';
import { COL, brazier, sword } from './props.ts';
import * as SH from './shape.ts';
import { G, MX, T, glow, lean, put } from './tmpl.ts';

export interface PurifiedOut {
  flames: THREE.Vector3[];
  /** Purple sparks on the tops of the Order's stakes */
  purple: THREE.Vector3[];
  flags: THREE.BufferGeometry[];
}

const TAU = Math.PI * 2;

/**
 * The Order's stake: a slanted iron stake with torn purple cloth hung on a crossbar and a purple-glowing blight crystal set
 * on top
 */
function cultStake(ctx: FieldCtx, x: number, z: number, out: PurifiedOut, ground: GroundOut): void {
  const { b, r } = ctx;
  const y = ctx.place(x, z, 0.3);
  const a = r() * TAU;
  const tilt = 0.06 + r() * 0.12;
  const H = 2.3 + r() * 0.5;
  put(b, T.box, COL.iron, lean(x, -0.2, z, a, tilt, H, 0.11, 0.11));
  const tx = x + Math.sin(tilt) * Math.cos(a) * H;
  const tz = z + Math.sin(tilt) * Math.sin(a) * H;
  const ty = Math.cos(tilt) * H - 0.2;
  put(b, T.box, COL.iron, MX(tx, ty - 0.45, tz, 0.9, 0.06, 0.06, a));
  // torn cloth: two purple strips of different lengths
  for (const s of [-1, 1]) {
    const len = 0.8 + r() * 0.6;
    put(b, T.box, s < 0 ? COL.cult : 0x2a1a3a, MX(tx + Math.cos(a) * s * 0.3, ty - 0.45 - len / 2, tz - Math.sin(a) * s * 0.3, 0.26, len, 0.02, a, (r() - 0.5) * 0.2, (r() - 0.5) * 0.15), false);
  }
  glow(b, T.oct, G.cult, MX(tx, ty + 0.12, tz, 0.12, 0.26, 0.12, r() * TAU));
  ground.stains.add(x, z, 2.2, 0x2a1830, 0.45);
  out.purple.push(new THREE.Vector3(tx, y + ty + 0.2, tz));
  ctx.solids.add(x, z, 0.25);
}

/** Fireweed: a clump of slender stalks, the upper part a magenta flower spike (dark below, light above) */
function fireweed(ctx: FieldCtx, x: number, z: number, n: number): void {
  const { b, r } = ctx;
  b.lift = ctx.h(x, z);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 0.7;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    const H = 0.55 + r() * 0.55;
    const la = r() * TAU;
    const tilt = r() * 0.12;
    const sx = Math.sin(tilt) * Math.cos(la);
    const sz = Math.sin(tilt) * Math.sin(la);
    put(b, T.stem, 0x4a5a2a, lean(px, 0, pz, la, tilt, H * 0.62, 0.02, 0.02), false);
    // two slender leaves slanting along the stalk
    put(b, T.tet, G.leafG, MX(px + sx * H * 0.2, H * 0.2, pz + sz * H * 0.2, 0.2, 0.02, 0.045, la, 0, 0.5), false);
    put(b, T.tet, G.leafG, MX(px + sx * H * 0.38, H * 0.38, pz + sz * H * 0.38, 0.15, 0.02, 0.04, la + 2.4, 0, 0.5), false);
    // flower spike: a slender cone with a small pale bud at the tip
    put(b, T.cone4, G.fireweed, lean(px + sx * H * 0.6, H * 0.58, pz + sz * H * 0.6, la, tilt, H * 0.36, 0.075, 0.075), false);
    put(b, T.ico, G.fireweedL, MX(px + sx * H, H * 0.97, pz + sz * H, 0.045, 0.06, 0.045), false);
  }
}

/** Sprouts: a small tuft of green poking out of a crack in the lava crust */
function sprouts(ctx: FieldCtx, x: number, z: number): void {
  const { b, r } = ctx;
  b.lift = ctx.h(x, z);
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.4;
    put(b, T.cone3, i % 2 ? G.moss : G.mossL, lean(x, 0, z, a, 0.4 + r() * 0.5, 0.18 + r() * 0.2, 0.03, 0.03), false);
  }
  put(b, T.ico, G.moss, MX(x, 0.02, z, 0.3, 0.07, 0.26, r() * TAU), false);
}

export function buildPurified(ctx: FieldCtx, busy: Solids, ground: GroundOut): PurifiedOut {
  const out: PurifiedOut = { flames: [], purple: [], flags: [] };
  const { r, low } = ctx;
  const k = ctx.floors > 0 ? Math.min(1, ctx.done / ctx.floors) : 0;
  const pw = ctx.layout.pathW;

  // ── The Order's stakes -> the Knights' cairns: along the two small paths on the north bank and the main road in front of
  // the tower, one position every so often
  const spots: XZ[] = [];
  for (const line of [SH.TRAILS[3], SH.TRAILS[4], SH.PATH.slice(-5)]) {
    const curve = new THREE.CatmullRomCurve3(line.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const L = curve.getLength();
    for (let s = 6; s < L - 4; s += 13) {
      const p = curve.getPointAt(s / L);
      const t = curve.getTangentAt(s / L);
      const side = spots.length % 2 ? 1 : -1;
      const x = p.x - t.z * side * (pw + 2.2);
      const z = p.z + t.x * side * (pw + 2.2);
      if (!ctx.clear(x, z, 0) || landmark(x, z) || ctx.solids.blocked(x, z, 0.8) || ctx.h(x, z) < SH.LAVA + 1) continue;
      spots.push([x, z]);
    }
  }
  // by the number of floors broken through: the first positions have already become cairns, the later ones are still the
  // Order's stakes
  const cleared = Math.round(spots.length * k);
  spots.forEach(([x, z], i) => {
    if (i < cleared) {
      cairn(ctx, x, z, 1.05 + r() * 0.3, true);
      // a small Knights' flag on every third cairn
      if (i % 3 === 0) {
        const fx = x + 0.7;
        const fz = z + 0.3;
        const y = ctx.place(fx, fz);
        put(ctx.b, T.cyl5, COL.woodD, MX(fx, 1.3, fz, 0.04, 2.6, 0.04));
        out.flags.push(banner(0.6, 1.1, MX(fx + 0.05, y + 2.5, fz, 1, 1, 1, r() * TAU), COL.cloth, COL.gold));
      }
    } else cultStake(ctx, x, z, out, ground);
    busy.add(x, z, 1);
  });

  if (k < 1) {
    ctx.b.lift = 0;
    return out;
  }

  // ── Every floor broken through: fireweed and sprouts grow back on the volcanic ash ground (too hot to grow too close to
  // the lava)
  const S = ctx.layout.size;
  jitter(r, low ? 6 : 4.2, -S + 10, S - 10, (x, z) => {
    if (Math.max(Math.abs(x), Math.abs(z)) > S - 16) return;
    if (!ctx.clear(x, z, 0.2) || landmark(x, z) || busy.blocked(x, z, 0.3) || ctx.solids.blocked(x, z, 0.6)) return;
    const le = SH.lavaEdgeDist(x, z);
    if (le < 5 || ctx.h(x, z) < SH.LAVA + 0.6) return;
    const field = 1 - smooth(15, 28, Math.hypot(x - SH.FIELD[0], z - SH.FIELD[1]));
    const north = smooth(-25, -50, z);
    const p = (0.12 + field * 0.2 + north * 0.2) * smooth(5, 12, le);
    const u = r();
    if (u < p) fireweed(ctx, x + (r() - 0.5) * 2, z + (r() - 0.5) * 2, 3 + Math.floor(r() * 4));
    else if (u < p + 0.1) sprouts(ctx, x + (r() - 0.5) * 2, z + (r() - 0.5) * 2);
  });

  // ── In front of the tower: the Knights' oathswords (planted in an arc along both sides of the plaza, with red cloth tied
  // on) and two braziers at the door
  const [tx, tz] = SH.TOWER;
  const [ex, ez] = SH.PATH[SH.PATH.length - 1];
  const face = Math.atan2(ex - tx, ez - tz);
  for (const side of [-1, 1]) {
    for (let j = 0; j < 5; j++) {
      const a = face + side * (0.5 + j * 0.2);
      const x = tx + Math.sin(a) * 20.6;
      const z = tz + Math.cos(a) * 20.6;
      if (ctx.pathDist(x, z) < pw + 1.6 || ctx.solids.blocked(x, z, 0.6)) continue;
      const y = ctx.h(x, z);
      sword(ctx, x, y - 0.1, z, 1.3, a + Math.PI / 2, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12, COL.stoneL, COL.bronze);
      ctx.b.lift = y;
      put(ctx.b, T.box, COL.cloth, MX(x, 0.95, z, 0.05, 0.45, 0.06, a, 0, 0.15), false);
      fireweed(ctx, x + Math.sin(a) * 0.9, z + Math.cos(a) * 0.9, 3);
      ctx.solids.add(x, z, 0.3);
    }
  }
  for (const side of [-1, 1]) {
    const a = face + side * 0.34;
    const x = tx + Math.sin(a) * 19.4;
    const z = tz + Math.cos(a) * 19.4;
    if (ctx.pathDist(x, z) < pw + 1.4 || ctx.solids.blocked(x, z, 0.8)) continue;
    out.flames.push(brazier(ctx, x, z, 1.3, true));
  }
  ctx.b.lift = 0;
  return out;
}
