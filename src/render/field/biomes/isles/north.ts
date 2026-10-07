// The northern half of the archipelago: Foghorn Hot Springs (travertine pools where warm meets cold), Icefield Isle (cedars,
// icicles, snow piles, floating ice, the Penguin Ice Cliff, the Ice Bay Overlook),
// the ice bay (the Order's black-sailed ship frozen in the ice, the Sacred Whale held by chains),
// the half-frozen Seal Tower, and the secret realm Siren Reef (the giant conch and the siren's harp).

import * as THREE from 'three';
import { M } from '../../../arenaKit.ts';
import type { FieldCtx } from '../../kit.ts';
import { scatterMask } from '../../props.ts';
import { ColorBatch, flagGeo, gulls, halos, poolSurface, waterfall } from './fx.ts';
import { coral, floe, iceSpire, palm, reefRock, seaStack, seg, snowDrift, snowPine, snowRock } from './flora.ts';
import { BAY, cold, REEF, ROOKERY, SHIP, SPRINGS, TOWER, TRAPPED_WHALE } from './terrain.ts';
import type { WildOut } from './south.ts';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const CULT = 0x9a3aff;
const CULT_D = 0x3a1a5a;

// ───────────────────────── Foghorn Hot Springs ─────────────────────────

function hotSprings(ctx: FieldCtx, out: WildOut): void {
  const { b, r } = ctx;
  const levels: number[] = [];
  SPRINGS.forEach((p, i) => {
    // Pool surface: a little below the lowest point of the pool rim
    let rim = Infinity;
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2;
      rim = Math.min(rim, ctx.h(p.x + Math.cos(a) * (p.r + 0.3), p.z + Math.sin(a) * (p.r + 0.3)));
    }
    const y = Math.max(rim - 0.08, ctx.h(p.x, p.z) + 0.25);
    levels.push(y);
    poolSurface(ctx, p.x, y, p.z, p.r + 0.15, 0x1aa8c8, 0x62dccf, 0.22);
    // Travertine pool rim: a ring of thick white edge, with stalactites hanging on the downhill side
    b.lift = 0;
    const ring = new THREE.TorusGeometry(p.r + 0.25, 0.28, 6, 30);
    ring.rotateX(Math.PI / 2);
    ring.scale(1, 0.6, 1);
    b.add(ring, 0xf6f1e4, M(p.x, y + 0.02, p.z));
    const next = SPRINGS[i + 1];
    const da = next ? Math.atan2(next.z - p.z, next.x - p.x) : Math.atan2(-1, 0.6);
    for (let k = 0; k < 9; k++) {
      const a = da + (k - 4) * 0.16;
      const x = p.x + Math.cos(a) * (p.r + 0.35);
      const z = p.z + Math.sin(a) * (p.r + 0.35);
      const len = 0.4 + r() * 0.6;
      b.add(new THREE.ConeGeometry(0.16, len, 5), k % 2 ? 0xf4ecdc : 0xe8d4b0, M(x, y - len / 2, z, 0, 1, Math.PI));
    }
    // Overflow to the next pool
    if (next) {
      const a = V(p.x + Math.cos(da) * (p.r - 0.2), y + 0.02, p.z + Math.sin(da) * (p.r - 0.2));
      const c = V(next.x - Math.cos(da) * (next.r - 0.3), 0, next.z - Math.sin(da) * (next.r - 0.3));
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const q = a.clone().lerp(c, t);
        q.y = Math.max(ctx.h(q.x, q.z) + 0.06, t < 0.3 ? y + 0.02 : 0);
        pts.push(q);
      }
      pts[pts.length - 1].y = Math.max(pts[pts.length - 1].y, 0);
      waterfall(ctx, pts, 1.2, 0xbff4f0);
    }
  });
  // The lowest pool overflows into the sea
  {
    const p = SPRINGS[SPRINGS.length - 1];
    const pts: THREE.Vector3[] = [];
    // Stops when it reaches the water's edge (do not drag a white band across the sea surface)
    for (let k = 0; k <= 12; k++) {
      const x = p.x + 0.6 * (p.r + k * 0.7);
      const z = p.z - 0.8 * (p.r + k * 0.7);
      const gh = ctx.h(x, z);
      pts.push(V(x, Math.max(gh + 0.06, 0.02), z));
      if (gh < 0.05) break;
    }
    if (pts.length >= 2) waterfall(ctx, pts, 1.4, 0xbff4f0);
  }
  // Steam: rising from the pool surface in bursts
  ctx.extras.push((dt, _t, vfx) => {
    SPRINGS.forEach((p, i) => {
      if (Math.random() > dt * 3) return;
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * p.r * 0.8;
      vfx.smoke({ pos: V(p.x + Math.cos(a) * d, levels[i] + 0.15, p.z + Math.sin(a) * d), count: 1, color: [0xffffff, 0xeef8fa], speed: [0.6, 1.2], dir: V(0.15, 1, -0.1), spread: 0.2, life: [2.0, 3.0], size: [0.45, 0.8], sizeEnd: 2.4, drag: 0.3 });
    });
  });
  // Rest pavilion: four posts, a thatched roof, benches and stone lanterns
  {
    const [x, z] = PAVILION;
    const y = ctx.place(x, z, 2);
    for (const sx of [-1.6, 1.6]) for (const sz of [-1.3, 1.3]) {
      b.add(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 6), 0x7a5436, M(x + sx, 1.3, z + sz));
      ctx.solids.add(x + sx, z + sz, 0.25);
    }
    const roof = new THREE.ConeGeometry(3.0, 1.6, 4);
    b.add(roof, 0xb89a60, M(x, 3.2, z, Math.PI / 4));
    b.add(new THREE.ConeGeometry(2.4, 0.5, 4), 0xf2f7ff, M(x, 3.9, z, Math.PI / 4), false);
    b.add(new THREE.BoxGeometry(2.6, 0.12, 0.5), 0xc49564, M(x, 0.5, z - 0.6));
    b.add(new THREE.BoxGeometry(0.4, 0.8, 0.4), 0x8a8474, M(x + 3.2, 0.4, z + 1.8));
    b.add(new THREE.BoxGeometry(0.6, 0.5, 0.6), 0x9a9484, M(x + 3.2, 1.05, z + 1.8));
    b.glow(new THREE.BoxGeometry(0.3, 0.3, 0.3), 0xffc86a, M(x + 3.2, 1.05, z + 1.8));
    b.add(new THREE.ConeGeometry(0.55, 0.45, 4), 0x8a8474, M(x + 3.2, 1.5, z + 1.8, Math.PI / 4));
    out.lights.push([x + 3.2, y + 1.05, z + 1.8, 1.8]);
    ctx.solids.add(x + 3.2, z + 1.8, 0.45);
  }
  b.lift = 0;
}

// ───────────────────────── Icefield ─────────────────────────

/** The line of sight from the Ice Bay Overlook toward the ice bay (tall props are not placed here) */
const OVERLOOK: [number, number] = [-15.5, -75.5];
function inView(x: number, z: number): boolean {
  const [ax, az] = OVERLOOK;
  const bx = BAY.x;
  const bz = BAY.z;
  const vx = bx - ax;
  const vz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - ax - vx * t, z - az - vz * t) < 6 + t * 10 || Math.hypot(x - ax, z - az) < 12;
}

/** No trees or snow piles around the hot spring pools and the rest pavilion */
const PAVILION: [number, number] = [6.5, -29.5];
function nearSpring(x: number, z: number): boolean {
  if (Math.hypot(x - PAVILION[0], z - PAVILION[1]) < 5) return true;
  return SPRINGS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 2.8);
}

function iceField(ctx: FieldCtx, out: WildOut): void {
  const { b, r, low } = ctx;
  const k = low ? 0.5 : 1;
  const [twx, twz] = TOWER;
  // Cedars: inland on the icefield, a bit away from the tower and the road
  scatterMask(
    ctx,
    Math.round(700 * k),
    1.4,
    (x, z) => {
      const c = cold(x, z);
      if (c < 0.45) return 0;
      if (Math.hypot(x - twx, z - twz) < 30 || inView(x, z) || nearSpring(x, z)) return 0;
      const h = ctx.h(x, z);
      return h > 1.8 ? 0.35 + c * 0.25 : h > 0.8 ? 0.2 : 0;
    },
    (x, z) => {
      ctx.place(x, z, 0.4);
      const s = 1.1 + r() * 0.9;
      snowPine(b, x, z, s, r);
      ctx.solids.add(x, z, 0.4 * s);
    },
  );
  // Where warm meets cold on Hot Spring Isle: half coconut palms, half cedars
  scatterMask(ctx, Math.round(160 * k), 1.4, (x, z) => (cold(x, z) > 0.25 && cold(x, z) < 0.6 && ctx.h(x, z) > 0.9 && !nearSpring(x, z) ? 0.5 : 0), (x, z) => {
    ctx.place(x, z, 0.4);
    const s = 0.9 + r() * 0.6;
    if (r() < 0.5) snowPine(b, x, z, s, r);
    else palm(b, x, z, 1.2 + r() * 0.4, r() * 6, r);
    ctx.solids.add(x, z, 0.4 * s);
  });
  // Icicle clusters, snow piles, snow-covered rocks
  scatterMask(ctx, Math.round(220 * k), 2, (x, z) => (cold(x, z) > 0.7 && ctx.h(x, z) > 0.6 && !inView(x, z) ? 0.4 : 0), (x, z) => {
    ctx.place(x, z, 0.8);
    const h = 2.5 + r() * 5;
    iceSpire(b, x, z, h, r, r() < 0.25 ? 0x9ae8ff : undefined);
    ctx.solids.add(x, z, h * 0.18 + 0.3);
  });
  scatterMask(ctx, Math.round(360 * k), 0.8, (x, z) => (cold(x, z) > 0.55 && ctx.h(x, z) > 0.3 && !nearSpring(x, z) ? 0.6 : 0), (x, z) => {
    ctx.place(x, z);
    snowDrift(b, x, z, 0.9 + r() * 1.3, r);
  });
  scatterMask(ctx, Math.round(140 * k), 1.2, (x, z) => (cold(x, z) > 0.5 && ctx.h(x, z) > 0.2 && !nearSpring(x, z) ? 0.5 : 0), (x, z) => {
    ctx.place(x, z, 0.5);
    const s = 0.8 + r() * 1.2;
    snowRock(b, x, z, s, r);
    ctx.solids.add(x, z, s * 0.8);
  });
  b.lift = 0;
  // Edge of the ice cliff: ice blocks fallen into the sea
  for (let i = 0; i < 90 * k; i++) {
    const x = -70 + r() * 140;
    const z = -112 + r() * 60;
    const h = ctx.h(x, z);
    if (h > -0.3 || h < -3.5 || cold(x, z) < 0.8) continue;
    // Placed only on the shore (land nearby)
    if (Math.max(ctx.h(x + 3, z), ctx.h(x - 3, z), ctx.h(x, z + 3), ctx.h(x, z - 3)) < 0.8) continue;
    b.lift = -0.3;
    const g = new THREE.DodecahedronGeometry(0.8 + r() * 1.2, 0);
    g.scale(1, 0.7 + r() * 0.6, 1);
    b.add(g, r() < 0.5 ? 0xbfe4f8 : 0xdcf0fc, M(x, 0.2, z, r() * 6, 1, r(), r()));
  }
  b.lift = 0;
  // Frozen stone lanterns on both sides of the main road (blue fire)
  const lanterns: [number, number][] = [
    [9.5, -58],
    [2.5, -59.5],
    [8.5, -63],
    [0.8, -65],
  ];
  for (const [x, z] of lanterns) {
    const y = ctx.place(x, z, 0.5);
    b.add(new THREE.BoxGeometry(0.7, 0.3, 0.7), 0x8a98a8, M(x, 0.15, z));
    b.add(new THREE.CylinderGeometry(0.16, 0.2, 1.0, 6), 0x8a98a8, M(x, 0.8, z));
    b.add(new THREE.BoxGeometry(0.7, 0.55, 0.7), 0x9aa8b8, M(x, 1.55, z));
    b.glow(new THREE.BoxGeometry(0.4, 0.35, 0.4), 0x8ae8ff, M(x, 1.55, z));
    b.add(new THREE.ConeGeometry(0.62, 0.5, 4), 0x8a98a8, M(x, 2.05, z, Math.PI / 4));
    b.add(new THREE.ConeGeometry(0.5, 0.22, 4), 0xf4f8ff, M(x, 2.25, z, Math.PI / 4), false);
    out.lights.push([x, y + 1.55, z, 1.8]);
    ctx.solids.add(x, z, 0.45);
  }
  b.lift = 0;
  // Penguin Ice Cliff: a wall of tall icicles, an ice cave
  const [rx, rz] = ROOKERY;
  for (let i = 0; i < 14; i++) {
    const a = -0.4 + (i / 13) * 2.8;
    const d = 11 + r() * 3;
    const x = rx + Math.cos(a) * d;
    const z = rz - Math.sin(a) * d * 0.7;
    if (ctx.h(x, z) < 0.5 || !ctx.clear(x, z, 1)) continue;
    ctx.place(x, z, 1);
    const h = 5 + r() * 6;
    iceSpire(b, x, z, h, r);
    ctx.solids.add(x, z, h * 0.2 + 0.4);
  }
  b.lift = 0;
  // Ice Bay Overlook: a wooden platform, a broken railing, a telescope, the Order's purple warning flag
  {
    const [x, z] = OVERLOOK;
    const y = ctx.place(x, z, 2);
    b.add(new THREE.BoxGeometry(4.4, 0.2, 3.2), 0x9a7a58, M(x, 0.35, z, 0.5));
    for (let i = 0; i < 6; i++) {
      const a = 0.5;
      const px = x - 2.1 * Math.cos(a) + (i / 5) * 4.2 * Math.cos(a) - 1.5 * Math.sin(a);
      const pz = z + 2.1 * Math.sin(a) - (i / 5) * 4.2 * Math.sin(a) - 1.5 * Math.cos(a);
      if (i === 3) continue;
      b.add(new THREE.BoxGeometry(0.12, 1.0, 0.12), 0x6a4a30, M(px, 0.9, pz));
    }
    b.add(new THREE.CylinderGeometry(0.05, 0.07, 1.2, 5), 0x3a4050, M(x + 0.8, 1.0, z - 0.3));
    b.add(new THREE.CylinderGeometry(0.1, 0.14, 0.9, 8), 0xc89a48, M(x + 0.8, 1.7, z - 0.6, 2.4, 1, Math.PI / 2 - 0.3));
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 5), 0x2a2030, M(x - 1.8, 1.9, z + 0.8));
    // The Order's warning flag; after purification it is replaced by the harbor's blue flag
    const purified = ctx.floors > 0 && ctx.done >= ctx.floors;
    out.flags.push(flagGeo(1.4, 1.0, purified ? 0x3a9ae0 : CULT, false, false, M(x - 1.8, y + 3.3, z + 0.8, 0.6), purified ? 0 : 0.35));
    ctx.solids.add(x, z, 1.8);
  }
  b.lift = 0;
  // Floating ice: patch after patch on the sea to the north, bobbing with the waves (one rocking mesh)
  const cb = new ColorBatch();
  for (let i = 0; i < 110 * k; i++) {
    const x = (r() * 2 - 1) * 128;
    const z = -30 - r() * 110;
    const h = ctx.h(x, z);
    if (h > -0.8 || cold(x, z) < 0.35) continue;
    if (Math.hypot(x - BAY.x, z - BAY.z) < 16) continue;
    if (ctx.pathDist(x, z) < 5) continue;
    const s = 1.2 + r() * r() * 4.5 * (0.6 + cold(x, z) * 0.6);
    floe(cb, x, z, s, r);
    // A large ice floe is often accompanied by a few small ice pieces
    if (s > 3) for (let j = 0; j < 3; j++) floe(cb, x + (r() - 0.5) * s * 3, z + (r() - 0.5) * s * 3, 0.5 + r() * 0.8, r);
  }
  // Icebergs beyond the map: a flat-topped tabular iceberg and a few pointed ones
  for (let i = 0; i < 14; i++) {
    const x = -240 + r() * 480;
    const z = -150 - r() * 110;
    const s = 6 + r() * 8;
    cb.bob = -1;
    if (r() < 0.6) {
      const g = new THREE.CylinderGeometry(s, s * 1.08, s * 0.7, 7);
      cb.add(g, 0xe4f4fe, M(x, s * 0.2, z, r() * 6));
      cb.add(new THREE.CylinderGeometry(s * 1.09, s * 1.1, s * 0.3, 7), 0x9ccfee, M(x, -s * 0.2, z, r() * 6));
    } else {
      const g = new THREE.DodecahedronGeometry(s, 0);
      g.scale(1.1, 1.3, 0.9);
      cb.add(g, 0xd4ecfa, M(x, s * 0.35, z, r() * 6, 1, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3));
    }
  }
  if (!cb.empty) {
    const { tick } = cb.build(ctx.group, ctx.disposers, 0.04);
    ctx.extras.push((_dt, t) => tick(t));
  }
  // Snowfall: when the camera is in the north, snowflakes drift around
  ctx.extras.push((dt, _t, vfx) => {
    const cp = vfx.camPos;
    const c = cold(cp.x, cp.z + 12);
    if (c < 0.05) return;
    const n = dt * 70 * c;
    let m = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
    while (m-- > 0) {
      vfx.emit({ pos: V(cp.x + (Math.random() - 0.5) * 44, cp.y + 4 + Math.random() * 8, cp.z - 6 + (Math.random() - 0.5) * 44), count: 1, color: [0xffffff, 0xe8f4ff], speed: [0.8, 1.6], dir: V(0.35, -1, 0.1), spread: 0.25, life: [5, 7], size: [0.1, 0.18], sizeEnd: 0.9, drag: 0.02, intensity: 1.2 });
    }
  });
}

// ───────────────────────── Ice bay ─────────────────────────

/** The Order's black-sailed ship (vertex colors, one mesh): a dark hull, three masts, tattered black sails, purple flags and lamps */
function cultShip(ctx: FieldCtx, out: WildOut, wrecked: boolean): void {
  const { r } = ctx;
  // After purification: the Order abandons the ship, and once the ice melts it drifts to the bay mouth,
  // stranded beside the ice shelf on the west side, listing and half sunk
  const [sx, sz] = wrecked ? HULK : SHIP;
  const base = wrecked
    ? new THREE.Matrix4().compose(V(sx, -2.2, sz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.13, Math.PI / 2 - 0.25, 0.36, 'YXZ')), new THREE.Vector3(1, 1, 1))
    : new THREE.Matrix4().compose(V(sx, -0.6, sz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0.9, -0.1, 'YXZ')), new THREE.Vector3(1, 1, 1));
  const cb = new ColorBatch();
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);
  const TRIM = wrecked ? 0x4e4650 : 0x6a3a8a;
  const hullShape = (k: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 10 * k);
    sh.quadraticCurveTo(3.8 * k, 5 * k, 3.4 * k, -1 * k);
    sh.quadraticCurveTo(3.2 * k, -7 * k, 2.6 * k, -8.5 * k);
    sh.lineTo(-2.6 * k, -8.5 * k);
    sh.quadraticCurveTo(-3.2 * k, -7 * k, -3.4 * k, -1 * k);
    sh.quadraticCurveTo(-3.8 * k, 5 * k, 0, 10 * k);
    return sh;
  };
  for (let i = 0; i < 4; i++) {
    const k = 1 - i * 0.08;
    const g = new THREE.ExtrudeGeometry(hullShape(k), { depth: 0.8, bevelEnabled: false, curveSegments: 8 });
    g.rotateX(Math.PI / 2);
    cb.add(g, i % 2 ? 0x2a2430 : 0x342c3c, at(M(0, 3.4 - i * 0.8, 0)));
  }
  const deck = new THREE.ShapeGeometry(hullShape(0.95));
  deck.rotateX(-Math.PI / 2);
  cb.add(deck, wrecked ? 0x3e3434 : 0x4a3a3a, at(M(0, 3.45, 0)));
  const rim = new THREE.ExtrudeGeometry(hullShape(1.03), { depth: 0.3, bevelEnabled: false, curveSegments: 8 });
  rim.rotateX(Math.PI / 2);
  cb.add(rim, TRIM, at(M(0, 3.9, 0)));
  // Stern castle, bowsprit
  cb.add(new THREE.BoxGeometry(5.6, 2.6, 3.8), 0x2a2430, at(M(0, 4.7, -6.6)));
  cb.add(new THREE.BoxGeometry(6.0, 0.3, 4.2), TRIM, at(M(0, 6.1, -6.6)));
  if (wrecked) {
    // The broken bowsprit, a hole smashed in the side of the hull
    cb.add(new THREE.CylinderGeometry(0.2, 0.3, 2.6, 6), 0x2a2430, at(M(0, 4.6, 10.6, 0, 1, Math.PI / 2 - 0.4)));
    for (let i = 0; i < 3; i++) cb.add(new THREE.BoxGeometry(0.2, 1.6 - i * 0.3, 1.2 + i * 0.6), 0x120e14, at(M(3.25, 2.4 + i * 0.2, 1.5 - i * 0.9, 0.1 * i)));
  } else {
    cb.add(new THREE.CylinderGeometry(0.2, 0.3, 6, 6), 0x2a2430, at(M(0, 5.5, 12, 0, 1, Math.PI / 2 - 0.4)));
    for (let i = 0; i < 5; i++) {
      const a = (i / 4 - 0.5) * 1.6;
      cb.add(new THREE.ConeGeometry(0.2, 0.9, 4), 0xc8a0ff, at(M(Math.sin(a) * 0.6, 4.6 + Math.cos(a) * 0.6, 10.2)));
    }
  }
  // Three masts and yards
  const masts: [number, number][] = [[4.5, 11], [0, 14], [-4.8, 10]];
  if (wrecked) {
    // The foremast is snapped in the middle and lies across the deck, jutting out over the side;
    // the mainmast is broken halfway, leaving only a gray tattered sail; the mizzenmast is just a stump
    cb.add(new THREE.CylinderGeometry(0.26, 0.32, 3.2, 7), 0x1e1a24, at(M(0, 5.0, 4.5)));
    cb.add(new THREE.ConeGeometry(0.28, 0.9, 5), 0x1e1a24, at(M(0.05, 7.0, 4.5, 0.4, 1, 0.3, 0)));
    cb.add(new THREE.CylinderGeometry(0.2, 0.26, 8.5, 7), 0x1e1a24, at(M(-2.6, 4.2, 5.6, 0, 1, 0.12, Math.PI / 2 + 0.25)));
    cb.add(new THREE.CylinderGeometry(0.24, 0.32, 7.5, 7), 0x1e1a24, at(M(0, 3.4 + 3.75, 0)));
    cb.add(new THREE.ConeGeometry(0.26, 1.0, 5), 0x1e1a24, at(M(-0.05, 11.6, 0, 0.3, 1, -0.3, 0)));
    cb.add(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 5), 0x1e1a24, at(M(0, 9.6, 0, Math.PI / 2, 1, 0.25, Math.PI / 2)));
    out.flags.push(flagGeo(3.2, 2.2, 0x5a5660, true, false, at(M(0, 9.5, 0.15, 0.25)), 0.9));
    cb.add(new THREE.CylinderGeometry(0.28, 0.34, 1.6, 7), 0x1e1a24, at(M(0, 4.2, -4.8)));
  } else {
    masts.forEach(([mz, mh], i) => {
      cb.add(new THREE.CylinderGeometry(0.22, 0.32, mh, 7), 0x1e1a24, at(M(0, 3.4 + mh / 2, mz)));
      for (let k = 0; k < 2; k++) {
        const y = 3.4 + mh * (0.55 + k * 0.3);
        cb.add(new THREE.CylinderGeometry(0.1, 0.1, 6.4 - k * 1.8, 5), 0x1e1a24, at(M(0, y, mz, Math.PI / 2, 1, 0, Math.PI / 2)));
        const sail = flagGeo(6.2 - k * 1.8, mh * 0.26, 0x1a1620, true, false, at(M(0, y - 0.1, mz + 0.15, 0)), 0.3);
        out.flags.push(sail);
      }
      out.flags.push(flagGeo(2.2, 1.1, CULT, false, true, at(M(0, 3.4 + mh + 0.6, mz, Math.PI / 2)), 0.25 * i));
    });
    // A row of purple lamps along the side of the ship
    for (let i = 0; i < 6; i++) {
      for (const s of [-1, 1]) {
        const p = V(s * 3.3, 4.4, -5 + i * 2.6).applyMatrix4(base);
        out.lights.push([p.x, p.y, p.z, 2.2]);
        ctx.b.lift = 0;
        ctx.b.glow(new THREE.SphereGeometry(0.2, 6, 5), CULT, M(p.x, p.y, p.z));
      }
    }
  }
  const { tick } = cb.build(ctx.group, ctx.disposers, 0.06);
  ctx.extras.push((_dt, t) => tick(t));
  // Ice: blocks of ice frozen around the hull (after the ship is abandoned only a few ice pieces lean against the hull)
  const b = ctx.b;
  b.lift = 0;
  for (let i = 0; i < (wrecked ? 9 : 26); i++) {
    const a = r() * Math.PI * 2;
    const p = V(Math.cos(a) * (3.6 + r() * 1.5), 0, Math.sin(a) * (9 + r() * 2)).applyMatrix4(base);
    const g = new THREE.DodecahedronGeometry((0.7 + r() * 1.1) * (wrecked ? 0.7 : 1), 0);
    g.scale(1, 0.55, 1);
    b.add(g, r() < 0.5 ? 0xd4ecfa : 0xb8def4, M(p.x, 0.15, p.z, r() * 6, 1, r() * 0.4, r() * 0.4));
  }
  // Seagulls perch on the wrecked ship
  if (wrecked) gulls(ctx, sx, 13, sz, 3, 5, 9, 0.12);
}

/** The Sacred Whale trapped in the ice: only the back, head and upturned flukes show, and purple chains bind it to the ship */
function trappedWhale(ctx: FieldCtx, out: WildOut, cracked: boolean): void {
  const { b, r } = ctx;
  const [wx, wz] = TRAPPED_WHALE;
  const yaw = 1.25;
  const base = new THREE.Matrix4().compose(V(wx, -1.3, wz), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.06, yaw, 0.05, 'YXZ')), new THREE.Vector3(1, 1, 1));
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);
  b.lift = 0;
  const WH = 0x3f5f84;
  const WB = 0xc8d8e4;
  const body = new THREE.SphereGeometry(1, 20, 12);
  body.scale(4.2, 3.0, 11);
  b.add(body, WH, at(M(0, 0, 0)));
  const head = new THREE.SphereGeometry(1, 16, 10);
  head.scale(3.6, 2.6, 4.6);
  b.add(head, WH, at(M(0, 0.4, 9.2)));
  // White markings and barnacles on the back
  for (let i = 0; i < 16; i++) {
    const zz = -6 + r() * 16;
    const xx = (r() - 0.5) * 4;
    const g = new THREE.SphereGeometry(0.35 + r() * 0.3, 6, 4);
    g.scale(1, 0.4, 1);
    b.add(g, WB, at(M(xx, 2.75 - (xx * xx) / 12 - Math.max(0, Math.abs(zz) - 6) * 0.2, zz)), false);
  }
  // Closed eye (a curved line)
  for (const s of [-1, 1]) b.add(new THREE.TorusGeometry(0.4, 0.07, 4, 8, Math.PI), 0x1b2a3a, at(M(s * 3.25, 0.9, 10.6, s * Math.PI / 2 + Math.PI / 2, 1, 0, Math.PI)), false);
  // Tail stock and the upturned frozen flukes
  const stem = new THREE.CylinderGeometry(1.0, 2.2, 6, 12);
  stem.rotateX(Math.PI / 2 - 0.35);
  b.add(stem, WH, at(M(0, 0.9, -13)));
  for (const s of [-1, 1]) {
    const fl = new THREE.SphereGeometry(1, 10, 6);
    fl.scale(3.2, 0.3, 1.3);
    b.add(fl, WH, at(M(s * 2.4, 3.6, -16.2, s * 0.35, 1, 0.5, s * 0.25)));
  }
  // Ice: the ice layer and blocks around the body
  const ice = new THREE.CylinderGeometry(1, 1, 0.5, 24);
  ice.scale(8, 1, 16);
  b.add(ice, 0xd8eefa, at(M(0, 1.35, -1)), false);
  for (let i = 0; i < 30; i++) {
    const a = r() * Math.PI * 2;
    const p = V(Math.cos(a) * (4 + r() * 4), 0, Math.sin(a) * (10 + r() * 5)).applyMatrix4(base);
    const g = new THREE.DodecahedronGeometry(0.8 + r() * 1.4, 0);
    g.scale(1, 0.5 + r() * 0.8, 1);
    b.add(g, r() < 0.5 ? 0xc4e4f8 : 0xe4f4fe, M(p.x, 0.3, p.z, r() * 6, 1, r() * 0.3, r() * 0.3));
  }
  // Purple chains: from the hull to the whale's body
  const [sx, sz] = SHIP;
  const links: THREE.BufferGeometry[] = [];
  const chains = [
    [V(sx + 2.4, 3.6, sz - 1.6), V(0, 2.2, 3).applyMatrix4(base)],
    [V(sx + 4.2, 3.6, sz + 2.5), V(1, 2.0, -5).applyMatrix4(base)],
    [V(wx + 9, 0.2, wz - 6), V(-1, 2.4, 6).applyMatrix4(base)],
  ];
  // At more than half purified: the middle chain snaps, hanging from the side of the ship into a crack in the ice
  if (cracked) {
    const [from, to] = chains[1];
    chains[1] = [from, from.clone().lerp(to, 0.45).setY(-0.4)];
  }
  for (const [from, to] of chains) {
    const mid = from.clone().lerp(to, 0.5);
    mid.y -= 1.4;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const n = Math.round(curve.getLength() / 0.55);
    for (let i = 0; i <= n; i++) {
      const p = curve.getPoint(i / n);
      const d = curve.getTangent(i / n);
      const g = new THREE.TorusGeometry(0.26, 0.07, 4, 8);
      const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), d);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), (i % 2) * Math.PI / 2));
      g.applyMatrix4(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
      links.push(g);
    }
  }
  for (const g of links) b.glow(g, CULT, new THREE.Matrix4());
  // The stakes where the chains are driven into the ice
  b.add(new THREE.CylinderGeometry(0.3, 0.4, 2.2, 6), 0x2a2030, M(wx + 9, 0.6, wz - 6));
  // Corrupted mist: purple smoke rising from the whale's body
  const top = V(0, 3, 2).applyMatrix4(base);
  ctx.extras.push((dt, _t, vfx) => {
    if (Math.random() > dt * 6) return;
    vfx.smoke({ pos: V(top.x + (Math.random() - 0.5) * 8, top.y, top.z + (Math.random() - 0.5) * 8), count: 1, color: [0x5a2a8a, 0x3a1a5a], speed: [0.3, 0.7], dir: V(0, 1, 0), spread: 0.4, life: [2.5, 4], size: [1.2, 2.0], sizeEnd: 2.5, drag: 0.2 });
    if (Math.random() < 0.4) vfx.emit({ pos: V(top.x + (Math.random() - 0.5) * 10, top.y, top.z + (Math.random() - 0.5) * 10), count: 1, color: [CULT, 0xff5ac8], speed: [0.4, 1], dir: V(0, 1, 0), spread: 0.5, life: [1.5, 2.5], size: [0.2, 0.35], sizeEnd: 0.2, intensity: 1.8 });
  });
  out.lights.push([top.x, top.y + 1, top.z, 7]);
}

/**
 * After purification: the chains and the ice are shattered, and the Sacred Whale floats in the open water at the bay mouth,
 * slowly swishing its tail, spouting, and singing again
 */
const FREE_WHALE: [number, number] = [-37, -91];
const HULK: [number, number] = [-57, -95];
/** The Sacred Whale lies along the ice bay's long axis, its head toward the Seal Tower in the east (where it is freed) */
const FREE_DIR: [number, number] = [0.853, -0.522];
const FREE_SCALE = 0.8;
function freeWhale(ctx: FieldCtx, out: WildOut): void {
  const { r } = ctx;
  const [cx, cz] = FREE_WHALE;
  const [fx, fz] = FREE_DIR;
  const yaw = Math.atan2(fx, fz);
  const WH = 0x3f5f84;
  const WB = 0xc8d8e4;
  const cb = new ColorBatch();
  const body = new THREE.SphereGeometry(1, 20, 12);
  body.scale(4.2, 3.0, 11);
  cb.add(body, WH, M(0, 0, 0));
  const belly = new THREE.SphereGeometry(1, 16, 8);
  belly.scale(3.6, 2.2, 9.5);
  cb.add(belly, WB, M(0, -0.9, 1));
  const head = new THREE.SphereGeometry(1, 16, 10);
  head.scale(3.6, 2.6, 4.6);
  cb.add(head, WH, M(0, 0.4, 9.2));
  for (let i = 0; i < 16; i++) {
    const zz = -6 + r() * 16;
    const xx = (r() - 0.5) * 4;
    const g = new THREE.SphereGeometry(0.35 + r() * 0.3, 6, 4);
    g.scale(1, 0.4, 1);
    cb.add(g, WB, M(xx, 2.75 - (xx * xx) / 12 - Math.max(0, Math.abs(zz) - 6) * 0.2, zz));
  }
  // Open eye
  for (const s of [-1, 1]) {
    cb.add(new THREE.SphereGeometry(0.42, 10, 8), 0x14202e, M(s * 3.2, 0.8, 10.6));
    cb.add(new THREE.SphereGeometry(0.14, 6, 5), 0xffffff, M(s * 3.5, 0.98, 10.8));
  }
  // Pectoral fins
  for (const s of [-1, 1]) {
    const fin = new THREE.SphereGeometry(1, 10, 6);
    fin.scale(2.6, 0.25, 1.1);
    cb.add(fin, WH, M(s * 5.2, -0.4, 5.5, s * 0.5, 1, 0, s * -0.35));
  }
  const whale = cb.build(ctx.group, ctx.disposers, 0.06);
  // The tail is a separate set, swinging up and down around the tail stock
  const tb = new ColorBatch();
  const stem = new THREE.CylinderGeometry(1.0, 2.2, 6, 12);
  stem.rotateX(Math.PI / 2);
  tb.add(stem, WH, M(0, 0, -3));
  for (const s of [-1, 1]) {
    const fl = new THREE.SphereGeometry(1, 10, 6);
    fl.scale(3.2, 0.3, 1.3);
    tb.add(fl, WH, M(s * 2.4, 0, -6.4, s * 0.45, 1, 0, 0));
  }
  const tail = tb.build(whale.group, ctx.disposers, 0.06);
  tail.group.position.set(0, 0.3, -9.5);
  // Glowing sacred markings on the back: a row of pale blue light patterns along the spine
  const marks: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const zz = -5 + i * 2.2;
    const top = 3 * Math.sqrt(Math.max(0, 1 - (zz / 11) ** 2));
    const g = new THREE.SphereGeometry(1, 10, 4);
    g.scale(0.95 - Math.abs(i - 3) * 0.12, 0.14, 0.32);
    g.translate(0, top - 0.03, zz);
    marks.push(g);
  }
  const mg = mergeAll(marks);
  const mm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8af0ff).multiplyScalar(2), toneMapped: false, transparent: true, opacity: 0.9 });
  whale.group.add(new THREE.Mesh(mg, mm));
  // A ring of white surf around it
  const wakeMat = new THREE.MeshBasicMaterial({ color: 0xf2fcff, transparent: true, opacity: 0.5, depthWrite: false });
  const wakeGeo = new THREE.RingGeometry(1, 1.22, 40);
  wakeGeo.rotateX(-Math.PI / 2);
  wakeGeo.scale(5.2, 1, 12.5);
  const wake = new THREE.Mesh(wakeGeo, wakeMat);
  wake.renderOrder = 3;
  whale.group.add(wake);
  ctx.disposers.push(() => {
    mg.dispose();
    mm.dispose();
    wakeGeo.dispose();
    wakeMat.dispose();
  });
  whale.group.rotation.order = 'YXZ';
  whale.group.scale.setScalar(FREE_SCALE);
  const Y0 = -0.35;
  const blow = new THREE.Vector3();
  let next = 2.5;
  ctx.extras.push((dt, t, vfx) => {
    whale.tick(t);
    tail.tick(t);
    const surge = Math.sin(t * 0.13) * 2.2;
    const heave = Math.sin(t * 0.6) * 0.22;
    whale.group.position.set(cx + fx * surge, Y0 + heave, cz + fz * surge);
    whale.group.rotation.set(Math.sin(t * 0.6 + 0.8) * 0.025, yaw + Math.sin(t * 0.17) * 0.1, Math.sin(t * 0.4) * 0.035);
    tail.group.rotation.x = Math.sin(t * 0.9) * 0.2;
    wake.position.y = (-Y0 - heave) / FREE_SCALE + 0.04;
    wakeMat.opacity = 0.35 + Math.sin(t * 1.2) * 0.12;
    // Spout: a jet of water from the blowhole every few seconds
    next -= dt;
    if (next < 0) {
      next = 5 + Math.random() * 3;
      whale.group.updateMatrixWorld();
      blow.set(0, 2.9, 6.2).applyMatrix4(whale.group.matrixWorld);
      vfx.emit({ pos: blow, count: 36, color: [0xffffff, 0xd8f6ff, 0xaee8ff], speed: [5, 8.5], dir: V(0, 1, 0), spread: 0.18, life: [0.9, 1.4], size: [0.22, 0.42], sizeEnd: 1.4, gravity: -7, intensity: 1.2 });
      vfx.smoke({ pos: blow.clone().setY(blow.y + 3.5), count: 3, color: [0xffffff, 0xeaf8ff], speed: [0.3, 0.8], dir: V(0, 1, 0), spread: 0.6, life: [1.5, 2.5], size: [1.0, 1.6], sizeEnd: 2.6, drag: 0.3 });
    }
    // Song: pale blue light points rise from the back
    if (Math.random() < dt * 3) {
      whale.group.updateMatrixWorld();
      const p = V((Math.random() - 0.5) * 3, 2.8, -4 + Math.random() * 12).applyMatrix4(whale.group.matrixWorld);
      vfx.emit({ pos: p, count: 1, color: [0x9af0ff, 0xffffff, 0xc8f8ff], speed: [0.4, 0.9], dir: V(0, 1, 0), spread: 0.5, life: [2.5, 3.5], size: [0.14, 0.24], sizeEnd: 0.4, intensity: 1.8 });
    }
  });
  out.lights.push([cx, 2.5, cz, 7]);
  gulls(ctx, cx, 14, cz, 3, 7, 12, 0.1);
}

function mergeAll(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  for (const g0 of gs) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const a = g.attributes.position;
    for (let i = 0; i < a.count; i++) pos.push(a.getX(i), a.getY(i), a.getZ(i));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return out;
}

function frozenBay(ctx: FieldCtx, out: WildOut): void {
  const { b } = ctx;
  const purified = ctx.floors > 0 && ctx.done >= ctx.floors;
  const cracked = !purified && ctx.floors > 0 && ctx.done >= ctx.floors / 2;
  const c = Math.cos(BAY.rot);
  const s = Math.sin(BAY.rot);
  if (!purified) {
    // The frozen water surface of the ice bay: large sheets of white-blue ice (with a crack in the middle, which the ship rammed open to sail in)
    const shape = new THREE.Shape();
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 0.96 + Math.sin(a * 5) * 0.04;
      const u = Math.cos(a) * BAY.rx * k;
      const v = Math.sin(a) * BAY.rz * k;
      const x = u * c + v * s;
      const z = -u * s + v * c;
      if (i === 0) shape.moveTo(x, -z);
      else shape.lineTo(x, -z);
    }
    const g = new THREE.ShapeGeometry(shape, 2);
    g.rotateX(-Math.PI / 2);
    b.lift = 0;
    b.add(g, 0xe2f2fc, M(BAY.x, 0.06, BAY.z), false);
    // Cracks in the ice surface (more cracks at more than half purified)
    for (let i = 0; i < (cracked ? 30 : 14); i++) {
      const a = ctx.r() * Math.PI * 2;
      const len = 2 + ctx.r() * (cracked ? 7 : 5);
      b.add(new THREE.BoxGeometry(cracked ? 0.2 : 0.12, 0.02, len), 0x7ab0d4, M(BAY.x + Math.cos(a) * ctx.r() * 12, 0.08, BAY.z + Math.sin(a) * ctx.r() * 8, a), false);
    }
    cultShip(ctx, out, false);
    trappedWhale(ctx, out, cracked);
    return;
  }
  // After purification: the ice surface breaks into floes drifting along the bay edge, and the bay mouth is open water
  const cb = new ColorBatch();
  const r = ctx.r;
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2;
    const k = 0.62 + r() * 0.4;
    const u = Math.cos(a) * BAY.rx * k;
    const v = Math.sin(a) * BAY.rz * k;
    const x = BAY.x + u * c + v * s;
    const z = BAY.z - u * s + v * c;
    if (ctx.h(x, z) > -0.6) continue;
    // Make way for where the Sacred Whale swims
    const along = (x - FREE_WHALE[0]) * FREE_DIR[0] + (z - FREE_WHALE[1]) * FREE_DIR[1];
    const across = Math.abs((x - FREE_WHALE[0]) * FREE_DIR[1] - (z - FREE_WHALE[1]) * FREE_DIR[0]);
    if (Math.abs(along) < 15 && across < 7) continue;
    if (Math.hypot(x - HULK[0], z - HULK[1]) < 9) continue;
    floe(cb, x, z, 0.7 + r() * 1.6, r);
  }
  const fl = cb.build(ctx.group, ctx.disposers, 0.04);
  ctx.extras.push((_dt, t) => fl.tick(t));
  cultShip(ctx, out, true);
  freeWhale(ctx, out);
}

// ───────────────────────── The ice sealing the Seal Tower ─────────────────────────

function towerIce(ctx: FieldCtx, out: WildOut): void {
  const { b, r } = ctx;
  const [tx, tz] = TOWER;
  const face = Math.atan2(ctx.layout.town[0] - tx, ctx.layout.town[1] - tz);
  const y0 = ctx.h(tx, tz);
  const ICE = [0xd4f0fd, 0xb2e0f7, 0x8ecbee];
  const at = (a: number, d: number, y: number) => V(tx + Math.sin(a) * d, y0 + y, tz + Math.cos(a) * d);
  // Extent of the icing: the west half of the tower (the ice-bay side), wrapping from the left of the door all the way to
  // the back; the farther west, the higher
  const A0 = face - 3.05;
  const A1 = face - 0.62;
  const west = face - Math.PI / 2;
  const reach = (a: number) => Math.max(0, Math.cos(a - west));
  b.lift = 0;
  // Each floor of the tower shaft (spire: radius 7.4 -> 3.2, the first floor 8 meters, then 4.4 meters per floor)
  const tierR = (i: number) => 7.4 + (3.2 - 7.4) * (i / 6);
  const tierY = (i: number) => (i === 0 ? 3.3 : 3.3 + 8 + 1.1 + (i - 1) * 4.4);
  const tierH = (i: number) => (i === 0 ? 8 : 3.3);
  // 1) The ice shell hugging the shaft: hexagonal ice columns one by one, with ragged tops
  for (let i = 0; i < 4; i++) {
    const R = tierR(i) + 0.35;
    const n = Math.round(R * 2.6);
    for (let k = 0; k <= n; k++) {
      const a = A0 + ((A1 - A0) * k) / n + (r() - 0.5) * 0.05;
      const w = reach(a);
      const maxTier = 1 + w * 3.2;
      if (i > maxTier) continue;
      const hh = tierH(i) * (i + 1 > maxTier ? (maxTier - i) * (0.6 + r() * 0.4) : 1) + (i === 0 ? 1.1 : 1.2);
      if (hh < 0.8) continue;
      const p = at(a, R + 0.3 + r() * 0.6, tierY(i) + hh / 2 - 0.4);
      const g = new THREE.CylinderGeometry(0.8 + r() * 0.45, 1.0 + r() * 0.45, hh, 6);
      b.add(g, ICE[(i + k) % 3], M(p.x, p.y, p.z, r() * 6, 1, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12));
      // The points at the tops of the ice columns
      if (r() < 0.6) b.add(new THREE.ConeGeometry(0.6, 1.2 + r(), 6), ICE[k % 3], M(p.x, p.y + hh / 2 + 0.5, p.z, r() * 6));
    }
  }
  // 2) Huge ice crystals leaning against the tower: as if they burst from underground and froze half the tower
  for (let i = 0; i < 16; i++) {
    const a = A0 + 0.2 + r() * (A1 - A0 - 0.3);
    const w = reach(a);
    const d = 8.5 + r() * 4;
    const h = (8 + r() * 10) * (0.5 + 0.7 * w) + 3;
    const g = new THREE.ConeGeometry(h * 0.17, h, 6);
    g.translate(0, h / 2, 0);
    const tilt = 0.12 + r() * 0.3;
    const lean = V(-Math.sin(a) * tilt, 1, -Math.cos(a) * tilt).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), lean);
    const p = at(a, d, 1.5);
    b.add(g, ICE[i % 3], new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
  }
  // 3) The ice mound at the foot of the tower: a slope piled from big ice blocks
  for (let i = 0; i < 30; i++) {
    const a = A0 + r() * (A1 - A0);
    const d = 8 + r() * 6.5;
    const s = (1.4 + r() * 2.2) * (0.6 + 0.6 * reach(a));
    const p = at(a, d, 1.8 + s * 0.2);
    const g = new THREE.DodecahedronGeometry(s, 0);
    g.scale(1, 0.75, 1);
    b.add(g, ICE[i % 3], M(p.x, p.y, p.z, r() * 6, 1, r() * 0.5, r() * 0.5));
  }
  // 4) Teal light showing through the ice
  for (let i = 0; i < 9; i++) {
    const a = A0 + 0.3 + r() * (A1 - A0 - 0.5);
    const p = at(a, tierR(0) + 1.2 + r() * 2, 2 + r() * 10 * reach(a));
    const g = new THREE.OctahedronGeometry(0.35 + r() * 0.3);
    g.scale(0.7, 1.8, 0.7);
    b.glow(g, 0x9aeeff, M(p.x, p.y, p.z, r() * 6, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
    out.lights.push([p.x, p.y, p.z, 2.4]);
  }
  // 5) Icicles under the eaves (on every floor of the west half)
  for (let i = 0; i < 7; i++) {
    const eaveR = tierR(i) * 1.18;
    const yy = y0 + tierY(i) + tierH(i);
    for (let k = 0; k < 14; k++) {
      const a = A0 - 0.2 + (k / 13) * (A1 - A0 + 0.4);
      if (r() < 0.25) continue;
      const x = tx + Math.sin(a) * eaveR * 0.97;
      const z = tz + Math.cos(a) * eaveR * 0.97;
      const len = (0.5 + r() * 1.6) * (0.5 + reach(a));
      b.add(new THREE.ConeGeometry(0.1 + r() * 0.1, len, 5), 0xe4f6ff, M(x, yy - len / 2, z, 0, 1, Math.PI), false);
    }
  }
  // Icicles and ice lamps at the edge of the plaza in front of the tower (leaving the front open)
  for (let i = 0; i < 14; i++) {
    const a = face + Math.PI * 0.35 + (i / 13) * Math.PI * 1.3;
    const d = 22 + r() * 5;
    const x = tx + Math.sin(a) * d;
    const z = tz + Math.cos(a) * d;
    if (ctx.pathDist(x, z) < 5 || ctx.h(x, z) < 0.8 || inView(x, z)) continue;
    ctx.place(x, z, 1);
    const h = 5 + r() * 8;
    iceSpire(b, x, z, h, r, 0x9ae8ff);
    ctx.solids.add(x, z, h * 0.2 + 0.4);
    out.lights.push([x, ctx.h(x, z) + h * 0.18, z, 2]);
  }
  b.lift = 0;
}

// ───────────────────────── Siren Reef (secret realm) ─────────────────────────

function sirenReef(ctx: FieldCtx, out: WildOut): void {
  const { b, r } = ctx;
  const { x: cx, z: cz, R } = REEF;
  const entry = Math.atan2(-41.5 - cz, -66 - cx);
  // A ring of sea stacks, leaving only one gap in the southeast (the direction the sandbar comes from)
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let da = Math.abs(a - entry);
    if (da > Math.PI) da = Math.PI * 2 - da;
    if (da < 0.3) continue;
    const d = R + 0.5 + (r() - 0.5) * 1.5;
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    b.lift = ctx.h(x, z);
    const s = 1.3 + r() * 1.0 + (da > 2 ? 0.6 : 0);
    seaStack(b, x, z, s, r, 0x7a5aa8);
    ctx.solids.add(x, z, 2.3 * s * 0.9);
  }
  // Two more on both sides of the gap, leaving only a narrow path
  for (const s of [-1, 1]) {
    const a = entry + s * 0.34;
    const x = cx + Math.cos(a) * (R + 0.8);
    const z = cz + Math.sin(a) * (R + 0.8);
    b.lift = ctx.h(x, z);
    seaStack(b, x, z, 1.5, r, 0x7a5aa8);
    ctx.solids.add(x, z, 2.2);
  }
  b.lift = 0;
  // Giant conch: a shell on the central sand, its mouth facing the entrance, with purple light showing from inside
  const face = entry;
  const y0 = ctx.place(cx, cz, 2);
  let rad = 2.2;
  let y = 1.4;
  let back = 0;
  const fx = Math.cos(face);
  const fz = Math.sin(face);
  for (let i = 0; i < 8; i++) {
    const g = new THREE.SphereGeometry(rad, 14, 10);
    g.scale(1, 0.8, 1);
    b.add(g, i % 2 ? 0xfbe8f0 : 0xf2d0e4, M(cx - fx * back, y, cz - fz * back, i));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + i * 0.5;
      b.add(new THREE.ConeGeometry(rad * 0.13, rad * 0.5, 5), 0xfff6fa, M(cx - fx * back + Math.cos(a) * rad * 0.9, y + rad * 0.35, cz - fz * back + Math.sin(a) * rad * 0.9, 0, 1, Math.sin(a) * 0.6, -Math.cos(a) * 0.6));
    }
    y += rad * 0.55;
    back += rad * 0.35;
    rad *= 0.76;
  }
  const mx = cx + fx * 2.0;
  const mz = cz + fz * 2.0;
  const lip = new THREE.TorusGeometry(1.5, 0.4, 8, 18);
  b.add(lip, 0xffd8e8, M(mx, 1.4, mz, Math.atan2(fx, fz)));
  b.glow(new THREE.CircleGeometry(1.35, 18), 0xc89aff, M(mx - fx * 0.1, 1.4, mz - fz * 0.1, Math.atan2(fx, fz)));
  ctx.solids.add(cx - fx * 0.8, cz - fz * 0.8, 2.6);
  out.lights.push([mx, y0 + 1.5, mz, 6]);
  // The siren's harp: a stone harp half sunk in the lagoon, its strings glowing thin lines
  {
    const a = entry + 2.2;
    const hx = cx + Math.cos(a) * 7.5;
    const hz = cz + Math.sin(a) * 7.5;
    const hy = ctx.h(hx, hz);
    const ry = a + Math.PI / 2;
    const L = (lx: number, ly: number) => V(hx + Math.cos(ry) * lx, hy + ly, hz - Math.sin(ry) * lx);
    const horn = (s: number) => new THREE.CatmullRomCurve3([L(s * 1.2, -0.3), L(s * 1.6, 1.6), L(s * 1.1, 3.2), L(s * 1.7, 4.4)]);
    for (const s of [-1, 1]) b.add(new THREE.TubeGeometry(horn(s), 12, 0.22, 6), 0xd8d0e8, new THREE.Matrix4());
    seg(b, L(-1.9, 4.1), L(1.9, 4.1), 0.2, 0xd8d0e8, 6);
    for (let k = 0; k < 6; k++) {
      const x = -0.9 + k * 0.36;
      b.glow(new THREE.CylinderGeometry(0.025, 0.025, 3.6, 3), 0xd8b8ff, new THREE.Matrix4().compose(L(x, 2.2), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    }
    ctx.solids.add(hx, hz, 1.6);
    out.lights.push([hx, hy + 2.4, hz, 3.5]);
  }
  // Glowing purple coral in the lagoon
  const VIOLET = [0xb88aff, 0xd8a0ff, 0x8a6aff, 0xff9ad8];
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2;
    const d = 4 + r() * (R - 5);
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    const h = ctx.h(x, z);
    if (h > -0.1) continue;
    b.lift = h;
    coral(b, x, z, 0.6 + r() * 0.8, r, VIOLET);
    if (i % 4 === 0) {
      b.glow(new THREE.SphereGeometry(0.1, 5, 4), 0xe0c0ff, M(x, 0.7, z));
      out.lights.push([x, h + 0.7, z, 1.2]);
    }
  }
  b.lift = 0;
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2;
    const x = cx + Math.cos(a) * 3.2;
    const z = cz + Math.sin(a) * 3.2;
    ctx.place(x, z);
    reefRock(b, x, z, 0.5 + r() * 0.4, r, [0x8a7ab0, 0x7a6aa0]);
  }
  b.lift = 0;
  // Purple and silver light points drifting in the air
  ctx.extras.push((dt, _t, vfx) => {
    const cp = vfx.camPos;
    if (Math.hypot(cp.x - cx, cp.z - cz) > 70) return;
    if (Math.random() > dt * 14) return;
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * R;
    vfx.emit({ pos: V(cx + Math.cos(a) * d, 0.3 + Math.random() * 2, cz + Math.sin(a) * d), count: 1, color: [0xd8b8ff, 0xffffff, 0x9ae8ff], speed: [0.2, 0.5], dir: V(0, 1, 0), spread: 0.6, life: [2.5, 4], size: [0.1, 0.2], sizeEnd: 0.5, intensity: 1.8 });
  });
  gulls(ctx, cx, 16, cz, 4, 10, 16, 0.08);
}

export function buildNorth(ctx: FieldCtx): WildOut {
  const out: WildOut = { flags: [], lights: [] };
  hotSprings(ctx, out);
  iceField(ctx, out);
  frozenBay(ctx, out);
  towerIce(ctx, out);
  sirenReef(ctx, out);
  void halos;
  void CULT_D;
  return out;
}
