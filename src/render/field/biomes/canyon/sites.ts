// Stoneheart Canyon's landmarks: the Wind-Carved Arch, Hoodoo Valley, the Glassworks and its tiered waterfall, the Mine Mouth
// and the rails running all the way to the citadel (mine carts shuttling), the Quicksand Hollow with its seven warning pillars,
// the ancient dragon skeleton at the end of the dead-end alley, the dwarf guardian statues and the cracked foundation in front
// of the tower, the Order's dig pit, the Old Shrine west of the tower, and the Crystalheart Grotto hidden deep in a narrow
// crack.

import * as THREE from 'three';
import { rope } from '../../../arenas/_woods.ts';
import { samplePath } from '../../compose.ts';
import { buildWater } from '../../terrain.ts';
import { glowGroup, signpost, type FieldCtx, type XZ } from '../../kit.ts';
import { groundGlow, shaftsAt } from '../../props.ts';
import { dwarfLamp, type Banners } from './city.ts';
import { POOLS, SPOT, TOWER, isFloor, wallDist } from './geo.ts';
import { COL, MX, along, dynMesh, frame, glowMat, local } from './pal.ts';
import { STRATA, cascadeMaterial, quicksandMaterial } from './shaders.ts';

/** Pick a strata color by height (aligned with the strata on the rock walls) */
export function bandCol(y: number): number {
  let yb = y / 1.55;
  yb += 0.3 * Math.sin(yb * 0.83 + 1.3);
  return STRATA[((Math.floor(yb) % 12) + 12) % 12];
}

export function buildSites(ctx: FieldCtx, banners: Banners, rails: XZ[]): void {
  stoneArch(ctx);
  hoodooValley(ctx, rails);
  glassWorks(ctx, banners);
  mine(ctx, rails);
  quicksand(ctx);
  fossil(ctx);
  towerGround(ctx);
  digSite(ctx, banners);
  shrine(ctx);
  grotto(ctx);
  // Signposts and rock piles at the forks
  for (const [x, z, f] of [[4, -7, -0.6], [-40, 22, 2.2], [37, -2, 0.8], [-24, -18, 2.5], [60, -28, -0.4]] as const) {
    if (ctx.solids.blocked(x, z, 1)) continue;
    signpost(ctx, x, z, f, COL.wood);
  }
  ctx.b.lift = 0;
}

// ───────────────────────── Rock props ─────────────────────────

/** Hoodoo: several rock column segments with narrow waists (colors follow the strata), topped with a harder, paler cap rock */
export function hoodoo(ctx: FieldCtx, x: number, z: number, H: number, solid = true): void {
  const { b, r } = ctx;
  const y = ctx.place(x, z, H * 0.12);
  const n = H > 7 ? 3 : 2;
  const R = 0.55 + H * 0.1;
  let yy = 0;
  const lean = (r() - 0.5) * 0.08;
  for (let i = 0; i < n; i++) {
    const hs = (H * 0.82) / n;
    const rb = R * (1 - i * 0.12);
    const rt = rb * (0.55 + r() * 0.15);
    const ox = lean * yy;
    b.add(new THREE.CylinderGeometry(rt, rb, hs, 7), bandCol(y + yy + hs * 0.5), MX(x + ox, yy + hs / 2, z, 1, 1, 1, r() * 6));
    if (i < n - 1) b.add(new THREE.DodecahedronGeometry(1, 0), bandCol(y + yy + hs), MX(x + ox, yy + hs, z, rt * 1.55, rt * 0.9, rt * 1.5, r() * 6), false);
    yy += hs;
  }
  const cap = new THREE.DodecahedronGeometry(1, 0);
  b.add(cap, COL.cap, MX(x + lean * yy, yy + R * 0.35, z, R * 1.7, R * 0.62, R * 1.5, r() * 6, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2));
  if (solid) ctx.solids.add(x, z, R + 0.25);
}

/** Balanced rock: a big boulder resting on a thin rock pedestal */
function balancedRock(ctx: FieldCtx, x: number, z: number): void {
  const { b } = ctx;
  const y = ctx.place(x, z, 1.5);
  b.add(new THREE.CylinderGeometry(0.9, 2.0, 5.5, 8), bandCol(y + 2), MX(x, 2.75, z, 1, 1, 1, 0.4));
  b.add(new THREE.DodecahedronGeometry(1, 0), bandCol(y + 5), MX(x, 5.6, z, 1.3, 0.7, 1.3, 0.2), false);
  b.add(new THREE.DodecahedronGeometry(1, 1), COL.cap, MX(x + 0.4, 8.6, z, 3.4, 2.6, 3.0, 0.7, 0.1, -0.12));
  ctx.solids.add(x, z, 2.1);
}

// ───────────────────────── Great arch ─────────────────────────

/**
 * Natural stone arch spanning the canyon path: rocks stacked one by one along a semicircle, with horizontal strata (so it joins
 * up with the walls on both sides)
 */
function stoneArch(ctx: FieldCtx): void {
  const { b, r } = ctx;
  const [x, z] = SPOT.arch;
  const y = ctx.place(x, z, 4);
  b.lift = 0;
  const R = 10.8;
  const cy = y + 1.2;
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI;
    const pz = z + Math.cos(a) * R;
    const py = cy + Math.sin(a) * R;
    const thick = 2.3 + Math.abs(Math.cos(a)) * 1.2;
    for (const dx of [-1.1, 1.1]) {
      const g = new THREE.DodecahedronGeometry(1, 0);
      b.add(g, bandCol(py), MX(x + dx + (r() - 0.5) * 0.4, py + (r() - 0.5) * 0.3, pz, 1.7, thick * 0.55, 1.5 + r() * 0.4, r() * 6, 0, a - Math.PI / 2));
    }
    // Thick layer above the top of the arch
    if (i > 4 && i < n - 4) b.add(new THREE.DodecahedronGeometry(1, 0), bandCol(py + 2), MX(x, py + 1.9, pz, 2.0, 1.2, 1.9, r() * 6), false);
  }
  // Rubble piles at the two feet
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const pz = z + s * (R - 0.5 + r() * 2);
      const px = x + (r() - 0.5) * 5;
      const gy = ctx.h(px, pz);
      b.add(new THREE.DodecahedronGeometry(1, 0), bandCol(gy + 1), MX(px, gy + 0.6, pz, 1.2 + r(), 0.8 + r() * 0.6, 1.2 + r(), r() * 6, r() * 0.4, r() * 0.4));
    }
  }
}

// ───────────────────────── Hoodoo Valley ─────────────────────────

function hoodooValley(ctx: FieldCtx, rails: XZ[]): void {
  const { r } = ctx;
  const [cx, cz] = SPOT.hoodoo;
  const nearRail = (x: number, z: number, m: number) => rails.some(([rx, rz]) => Math.hypot(x - rx, z - rz) < m);
  let placed = 0;
  for (let t = 0; t < 140 && placed < (ctx.low ? 10 : 18); t++) {
    const a = r() * Math.PI * 2;
    const d = 4 + r() * 16;
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    if (!isFloor(x, z, 1.5) || !ctx.clear(x, z, 1.5) || nearRail(x, z, 3) || ctx.solids.blocked(x, z, 1.8)) continue;
    hoodoo(ctx, x, z, 3.5 + r() * 7.5);
    placed++;
  }
  balancedRock(ctx, 58, -20);
}

// ───────────────────────── Glassworks ─────────────────────────

function glassWorks(ctx: FieldCtx, banners: Banners): void {
  const { b, r } = ctx;
  // Workshop proper: backed against the west wall, facing east
  const x = -71;
  const z = 23.5;
  const face = Math.PI / 2 - 0.4;
  ctx.place(x, z, 5);
  const F = frame(x, z, face);
  b.add(new THREE.BoxGeometry(11, 0.9, 7.5), COL.stoneDk, F(0, 0.1, 0));
  b.add(new THREE.BoxGeometry(10, 6.5, 6.5), COL.stone, F(0, 3.7, -0.3));
  b.add(new THREE.BoxGeometry(10.5, 0.5, 7), COL.stoneDk, F(0, 7.1, -0.3), false);
  const roof = new THREE.ConeGeometry(0.707, 1, 4, 1);
  roof.rotateY(Math.PI / 4);
  const [rx, rz] = local(x, z, face, 0, -0.3);
  b.add(roof, COL.copper, MX(rx, ctx.b.lift + 8.5, rz, 11.2, 2.6, 7.4, face));
  // Rose window: a ring of colored-glass sectors + a stone frame
  const RW = 1.9;
  const glassCols = [0xffb040, 0x5ad8f0, 0xf06ab0, 0x7ae070, 0x6a8aff, 0xffe070];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.CylinderGeometry(RW, RW, 0.1, 2, 1, false, (i / 12) * Math.PI * 2, (Math.PI * 2) / 12 - 0.06);
    g.rotateX(Math.PI / 2);
    b.glow(g, glassCols[i % glassCols.length], F(0, 5.0, 2.97));
  }
  b.glow(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 10).rotateX(Math.PI / 2), 0xffffff, F(0, 5.0, 3.0));
  b.add(new THREE.TorusGeometry(RW + 0.1, 0.22, 6, 20), COL.stoneDk, F(0, 5.0, 3.0));
  // Main door and the windows on either side
  b.add(new THREE.BoxGeometry(2.4, 2.8, 0.3), COL.woodDk, F(0, 1.95, 2.95));
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) b.glow(new THREE.BoxGeometry(0.34, 1.1, 0.1), glassCols[(k + (s > 0 ? 3 : 0)) % 6], F(s * (3.1 + k * 0.42), 2.6, 2.97));
    b.add(new THREE.BoxGeometry(1.7, 0.2, 0.35), COL.stoneDk, F(s * 3.52, 1.95, 3.0), false);
  }
  banners.add(new THREE.Vector3(...(() => { const [bx, bz] = local(x, z, face, 4.6, 3.3); return [bx, ctx.b.lift + 6.6, bz] as const; })()), face, 0.9, 2.4, 0x3f8f80, COL.gold);
  ctx.solids.add(x, z, 5.2);
  ctx.solids.add(...local(x, z, face, 3.5, 0), 3.5);
  ctx.solids.add(...local(x, z, face, -3.5, 0), 3.5);

  // Kiln: dome, glowing kiln mouth, tall chimney
  const kx = -61.5;
  const kz = 25.5;
  const ky = ctx.place(kx, kz, 3);
  const kf = Math.atan2(-60 - kx, 18 - kz);
  const K = frame(kx, kz, kf);
  b.add(new THREE.CylinderGeometry(3.3, 3.5, 1.2, 14), COL.stoneDk, K(0, 0.5, 0));
  b.add(new THREE.SphereGeometry(3.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xb86a48, K(0, 1.0, 0));
  b.add(new THREE.BoxGeometry(1.8, 1.9, 1.2), COL.stone2, K(0, 1.8, 2.7));
  b.glow(new THREE.BoxGeometry(1.1, 1.1, 0.2), 0xff8a2a, K(0, 1.7, 3.3));
  b.add(new THREE.CylinderGeometry(0.75, 0.95, 9, 8), 0xa85c40, K(-1.2, 5.5, -2.2));
  b.add(new THREE.CylinderGeometry(1.0, 1.0, 0.4, 8), COL.basalt, K(-1.2, 10.1, -2.2));
  ctx.solids.add(kx, kz, 3.6);
  const [chx, chz] = local(kx, kz, kf, -1.2, -2.2);
  const kiln = new THREE.Vector3(chx, ky + 10.5, chz);
  const mouth = new THREE.Vector3(...local(kx, kz, kf, 0, 3.6).flatMap((v, i) => (i === 0 ? [v, ky + 1.7] : [v])) as [number, number, number]);
  groundGlow(ctx, mouth.x, mouth.z, 3.2, 0xff8a3a, 0.6);

  // Glass racks: colored glass pieces shining in the setting sun
  for (const [gx, gz, gf] of [[-55.5, 22.5, 0.9], [-54.5, 18, 1.3], [-55.5, 9.5, -0.3]] as const) {
    ctx.place(gx, gz, 1.2);
    const G = frame(gx, gz, gf);
    for (const lx of [-1.3, 1.3]) b.add(new THREE.BoxGeometry(0.14, 2.2, 0.14), COL.wood, G(lx, 1.1, 0), false);
    b.add(new THREE.BoxGeometry(2.9, 0.12, 0.3), COL.wood, G(0, 2.15, 0), false);
    b.add(new THREE.BoxGeometry(2.9, 0.12, 0.5), COL.wood, G(0, 0.3, 0), false);
    for (let k = 0; k < 5; k++) b.add(new THREE.BoxGeometry(0.42, 1.55, 0.04), [0x9ae8f0, 0xffc880, 0xf6a0d0, 0xb0f0a0, 0xa8b8ff][(k + Math.floor(gx)) % 5], G(-1.0 + k * 0.5, 1.15, (r() - 0.5) * 0.12, (r() - 0.5) * 0.3), false);
    ctx.solids.add(gx, gz, 1.5);
  }
  // Bottles and jars on the tables
  for (const [tx, tz] of [[-60, 14], [-64.5, 17.5]] as const) {
    ctx.place(tx, tz, 1);
    b.add(new THREE.BoxGeometry(2.4, 0.14, 1.1), COL.wood, MX(tx, 0.95, tz, 1, 1, 1, 0.3));
    for (const [lx, lz] of [[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]] as const) b.add(new THREE.BoxGeometry(0.1, 0.9, 0.1), COL.woodDk, MX(tx + lx, 0.45, tz + lz, 1, 1, 1, 0.3), false);
    for (let k = 0; k < 6; k++) {
      const c = glassCols[k % glassCols.length];
      const bx = tx + (k - 2.5) * 0.36;
      const bz = tz + (r() - 0.5) * 0.5;
      if (k % 2) b.glow(new THREE.SphereGeometry(0.17, 8, 6), c, MX(bx, 1.2, bz, 1, 1.2, 1));
      else b.glow(new THREE.CylinderGeometry(0.08, 0.13, 0.42, 7), c, MX(bx, 1.23, bz, 1, 1, 1));
    }
    ctx.solids.add(tx, tz, 1.3);
  }
  // Piles of white sand, a handcart
  for (const [sx, sz, s] of [[-53.5, 14, 1.4], [-52, 11.5, 1.0]] as const) {
    ctx.place(sx, sz, s);
    b.add(new THREE.ConeGeometry(1.6 * s, 1.2 * s, 10), 0xf2e2c0, MX(sx, 0.55 * s, sz, 1, 1, 1));
  }
  ctx.solids.add(-53.5, 14, 2);
  // Light patches on the ground cast by the colored glass
  for (const [px, pz, c] of [[-65.5, 21, 0xffb040], [-64, 24.5, 0x5ad8f0], [-63, 20, 0xf06ab0], [-66.5, 26, 0x7ae070]] as const) groundGlow(ctx, px, pz, 1.4, c, 0.4);

  // Waterfall: falls step by step from the top of the west wall's mesa into the pool
  const [px, pz, pr] = POOLS[0];
  cascade(ctx, px, pz, pr, -1, 0.15);
  // Pool
  waterPool(ctx, px, pz, pr, 0x7ae0d8, 0x1f7f8c);
  let t0 = 0;
  ctx.extras.push((dt, t, vfx) => {
    t0 += dt;
    if (vfx.camPos.distanceTo(kiln) < 90 && Math.random() < dt * 5) {
      vfx.smoke({ pos: kiln.clone(), count: 1, color: [0x8a7a78, 0x6a5a58], speed: [0.8, 1.4], dir: new THREE.Vector3(0.4, 1, 0), spread: 0.2, life: [4, 6], size: [0.8, 1.2], sizeEnd: 3.5, drag: 0.2, intensity: 0.6 });
    }
    if (vfx.camPos.distanceTo(mouth) < 50 && Math.random() < dt * 3) {
      vfx.emit({ pos: mouth.clone(), count: 1, color: [0xffb050, 0xff6a2a], speed: [0.5, 1.2], dir: new THREE.Vector3(0, 1, 0.3), spread: 0.4, life: [0.8, 1.4], size: [0.08, 0.14], intensity: 2 });
    }
    void t;
  });
}

/** Shallow pool: uses the engine's water shader (shore foam, depth), with the mesh swapped for a circle */
function waterPool(ctx: FieldCtx, x: number, z: number, R: number, shallow: number, deep: number): number {
  let rim = 0;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    rim += ctx.h(x + Math.cos(a) * (R + 1), z + Math.sin(a) * (R + 1));
  }
  const level = rim / 12 - 0.18;
  const w = buildWater(ctx.terrain, { level, shallow, deep, foam: 0xf4fff8 });
  w.mesh.geometry.dispose();
  const g = new THREE.CircleGeometry(R + 2.5, 40);
  g.rotateX(-Math.PI / 2);
  w.mesh.geometry = g;
  w.mesh.position.set(x, level, z);
  ctx.group.add(w.mesh);
  ctx.extras.push((_dt, t) => w.update(t));
  ctx.disposers.push(() => {
    w.dispose();
    g.dispose();
  });
  return level;
}

/**
 * Waterfall: from the pool, look in the direction (dx, dz) for the top of a mesa and follow the terrain all the way down
 * (dropping vertically at cliffs, sliding over scree slopes)
 */
function cascade(ctx: FieldCtx, px: number, pz: number, pr: number, dx: number, dz: number): void {
  const l = Math.hypot(dx, dz);
  dx /= l;
  dz /= l;
  // Walk into the rock wall until the height stops rising
  // Walk into the rock wall and take the first mesa wide enough (at least 8 m above the water surface, 1.5 m flat)
  // as the waterfall's source
  const h0 = ctx.h(px, pz);
  let s = pr * 0.4;
  let best = -1e9;
  let bestS = s;
  for (; s < 22; s += 0.3) {
    const hh = ctx.h(px + dx * s, pz + dz * s);
    if (hh > best + 0.05) {
      best = hh;
      bestS = s;
    } else if (s - bestS > 1.5 && best - h0 > 8) break;
  }
  const top = bestS + 0.8;
  const pts: THREE.Vector3[] = [];
  for (let t = top; t >= pr * 0.35; t -= 0.25) {
    const x = px + dx * t;
    const z = pz + dz * t;
    pts.push(new THREE.Vector3(x, ctx.h(x, z) + 0.28, z));
  }
  const nx = -dz;
  const nz = dx;
  const pos: number[] = [];
  const uv: number[] = [];
  const steep: number[] = [];
  const idx: number[] = [];
  let acc = 0;
  pts.forEach((p, i) => {
    if (i > 0) acc += p.distanceTo(pts[i - 1]);
    const k = i / (pts.length - 1);
    const w = 1.1 + k * 1.2;
    const dy = i > 0 ? Math.abs(p.y - pts[i - 1].y) / 0.25 : 0;
    const st = Math.min(1, dy / 2.5);
    pos.push(p.x - nx * w, p.y, p.z - nz * w, p.x + nx * w, p.y, p.z + nz * w);
    uv.push(0, acc, 1, acc);
    steep.push(st, st);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aSteep', new THREE.Float32BufferAttribute(steep, 1));
  g.setIndex(idx);
  const mat = cascadeMaterial();
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 3;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    g.dispose();
    mat.dispose();
  });
  // Splash at the foot of the waterfall
  const foot = pts[pts.length - 1].clone();
  const lip = pts[0].clone();
  ctx.extras.push((dt, t, vfx) => {
    mat.uniforms.uTime.value = t;
    if (vfx.camPos.distanceTo(foot) > 70) return;
    if (Math.random() < dt * 10) vfx.smoke({ pos: foot.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.2, (Math.random() - 0.5) * 2)), count: 1, color: [0xeafcff, 0xc8f0f0], speed: [0.4, 1], dir: new THREE.Vector3(0, 1, 0), spread: 0.6, life: [1, 1.8], size: [0.4, 0.7], sizeEnd: 1.8, intensity: 0.5 });
    if (Math.random() < dt * 4) vfx.emit({ pos: lip.clone(), count: 1, color: 0xeaffff, speed: [0.3, 0.8], dir: new THREE.Vector3(-dx, -1, -dz), spread: 0.3, life: [0.6, 1], size: [0.1, 0.16], intensity: 1.2 });
  });
}

// ───────────────────────── Mine and rails ─────────────────────────

/**
 * Centerline of the rails: follows the small road on the east side, 3 m to the right, running from the mine all the way to the
 * citadel's lift
 */
export function railLine(): XZ[] {
  const trail: XZ[] = [[40, 66], [44, 50], [41, 32], [44, 14], [47, -4], [56, -22], [66, -36], [74, -46]];
  const off: XZ[] = trail.map(([x, z], i) => {
    const [ax, az] = trail[Math.max(0, i - 1)];
    const [bx, bz] = trail[Math.min(trail.length - 1, i + 1)];
    const tx = bx - ax;
    const tz = bz - az;
    const l = Math.hypot(tx, tz) || 1;
    return [x - (tz / l) * 3.2, z + (tx / l) * 3.2];
  });
  const pts: XZ[] = [[37.5, 72], ...off, [78.5, -50.5], [81.5, -54.5]];
  return samplePath(pts, 0.8);
}

function mine(ctx: FieldCtx, rails: XZ[]): void {
  const { b, r } = ctx;
  // Sleepers and iron rails
  for (let i = 0; i < rails.length; i++) {
    const [x, z] = rails[i];
    const [nx2, nz2] = rails[Math.min(rails.length - 1, i + 1)];
    const [px2, pz2] = rails[Math.max(0, i - 1)];
    const a = Math.atan2(nx2 - px2, nz2 - pz2);
    b.lift = 0;
    const y = ctx.h(x, z);
    b.add(new THREE.BoxGeometry(1.75, 0.14, 0.32), COL.woodDk, MX(x, y + 0.05, z, 1, 1, 1, a), false);
    if (i < rails.length - 1) {
      const [x1, z1] = rails[i + 1];
      const y1 = ctx.h(x1, z1);
      const len = Math.hypot(x1 - x, z1 - z);
      const aa = Math.atan2(x1 - x, z1 - z);
      const pitch = -Math.atan2(y1 - y, len);
      for (const s of [-0.55, 0.55]) {
        const ox = Math.cos(aa) * s;
        const oz = -Math.sin(aa) * s;
        b.add(new THREE.BoxGeometry(0.1, 0.12, len + 0.02), COL.iron, MX((x + x1) / 2 + ox, (y + y1) / 2 + 0.17, (z + z1) / 2 + oz, 1, 1, 1, aa, pitch), false);
      }
    }
    // Lamps along the line
    if (i % 34 === 17) {
      const ox = Math.cos(a) * 1.6;
      const oz = -Math.sin(a) * 1.6;
      if (!ctx.solids.blocked(x + ox, z + oz, 0.8) && isFloor(x + ox, z + oz, 0.5)) dwarfLamp(ctx, x + ox, z + oz, 2.6);
    }
  }
  // Mine Mouth: three timber supports, a pitch-black shaft, a signboard and a hanging lamp, with big boulders covering the
  // seams all around
  const [mx, mz] = SPOT.mine;
  const face = Math.atan2(74 - mx, -46 - mz);
  const y = ctx.place(mx, mz, 2);
  const F = frame(mx, mz, face);
  for (const lz of [0.5, -1.2, -2.9]) {
    const col = lz > 0 ? COL.wood : COL.woodDk;
    for (const s of [-1, 1]) {
      b.add(new THREE.BoxGeometry(0.6, 5.2, 0.6), col, F(s * 2.7, 2.6, lz));
      b.add(new THREE.BoxGeometry(0.4, 1.8, 0.4), col, F(s * 2.1, 4.4, lz, 0, 1, 0, s * 0.75));
    }
    b.add(new THREE.BoxGeometry(6.4, 0.65, 0.65), col, F(0, 5.3, lz));
  }
  b.add(new THREE.BoxGeometry(5.0, 5.0, 6), 0x1c120e, F(0, 2.5, -3.6), false);
  b.add(new THREE.BoxGeometry(2.6, 0.7, 0.14), 0xe9d3a8, F(0, 6.2, 0.85));
  b.add(new THREE.BoxGeometry(1.6, 0.12, 0.16), COL.woodDk, F(0, 6.2, 0.95), false);
  b.glow(new THREE.SphereGeometry(0.3, 8, 6), COL.win, F(0, 4.55, 0.4));
  for (const [lx, ly, lz, s] of [[-5, 2.5, -1.5, 3.2], [5.2, 2.2, -1.2, 3.0], [-3.8, 6.8, -2.5, 3.4], [3.6, 7.2, -2.4, 3.3], [0, 8.6, -3.2, 3.8], [-6.6, 0.8, 0.2, 1.6], [6.8, 0.9, 0.4, 1.5]] as const) {
    const [wx, wz] = local(mx, mz, face, lx, lz);
    b.add(new THREE.DodecahedronGeometry(1, 0), bandCol(y + ly), MX(wx, ly, wz, s, s * 0.85, s, r() * 6, r() * 0.3, r() * 0.3));
  }
  ctx.solids.add(...local(mx, mz, face, -3.4, -1), 1.6);
  ctx.solids.add(...local(mx, mz, face, 3.4, -1), 1.6);
  ctx.solids.add(...local(mx, mz, face, 0, -3), 2.8);
  // Ore piles, wooden crates and a winch at the mouth
  for (const [lx, lz, c] of [[-4.8, 3.2, COL.cyan], [-5.8, 2.1, COL.cyan], [5.5, 3.4, COL.rune]] as const) {
    const [wx, wz] = local(mx, mz, face, lx, lz);
    ctx.place(wx, wz, 1);
    b.add(new THREE.DodecahedronGeometry(1, 0), 0x6a5a58, MX(wx, 0.35, wz, 1.2, 0.6, 1.1, r() * 6));
    for (let k = 0; k < 3; k++) b.glow(new THREE.OctahedronGeometry(0.3), c, MX(wx + (r() - 0.5) * 1.2, 0.75, wz + (r() - 0.5) * 1.2, 0.8, 1.4, 0.8, r() * 6, r() * 0.5));
    ctx.solids.add(wx, wz, 1.2);
  }
  for (const [lx, lz] of [[4.6, 1.2], [4.3, 5.8]] as const) {
    const [wx, wz] = local(mx, mz, face, lx, lz);
    ctx.place(wx, wz, 0.8);
    b.add(new THREE.BoxGeometry(1.0, 1.0, 1.0), COL.wood, MX(wx, 0.5, wz, 1, 1, 1, face + r()));
    b.add(new THREE.BoxGeometry(0.8, 0.8, 0.8), COL.wood, MX(wx + 0.2, 1.4, wz, 1, 1, 1, face + r()));
    ctx.solids.add(wx, wz, 0.9);
  }
  ctx.b.lift = 0;

  // Mine carts: shuttle along the rails (one going to the citadel, one going to the mine)
  const carts = [0, 0.5].map(() => {
    const g = new THREE.Group();
    const body = dynMesh(ctx, new THREE.BoxGeometry(1.5, 0.75, 1.05), COL.iron);
    body.position.y = 0.72;
    const rim = dynMesh(ctx, new THREE.BoxGeometry(1.7, 0.14, 1.22), 0x6e5c50, false);
    rim.position.y = 1.12;
    g.add(body, rim);
    for (const sx of [-0.5, 0.5]) {
      for (const sz of [-0.56, 0.56]) {
        const w = dynMesh(ctx, new THREE.CylinderGeometry(0.22, 0.22, 0.1, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 2), 0x2a2220, false);
        w.position.set(sz, 0.28, sx);
        g.add(w);
      }
    }
    const ore = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), glowMat(ctx, COL.cyan));
    ore.position.set(0.1, 1.28, 0);
    g.add(ore);
    const ore2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), glowMat(ctx, COL.rune));
    ore2.position.set(-0.35, 1.22, 0.2);
    g.add(ore2);
    ctx.group.add(g);
    return g;
  });
  const cum: number[] = [0];
  for (let i = 1; i < rails.length; i++) cum.push(cum[i - 1] + Math.hypot(rails[i][0] - rails[i - 1][0], rails[i][1] - rails[i - 1][1]));
  const L = cum[cum.length - 1];
  const at = (s: number): [number, number, number] => {
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] <= s) lo = m;
      else hi = m;
    }
    const t = (s - cum[lo]) / Math.max(1e-4, cum[hi] - cum[lo]);
    const x = rails[lo][0] + (rails[hi][0] - rails[lo][0]) * t;
    const z = rails[lo][1] + (rails[hi][1] - rails[lo][1]) * t;
    return [x, z, Math.atan2(rails[hi][0] - rails[lo][0], rails[hi][1] - rails[lo][1])];
  };
  const speed = 3.2;
  const period = (L / speed) * 2 + 16;
  ctx.extras.push((_dt, t) => {
    carts.forEach((g, i) => {
      const ph = ((t / period + i * 0.5) % 1) * period;
      const run = L / speed;
      // Stop for 8 seconds at the mine and at the lift
      const s = ph < 8 ? 0 : ph < 8 + run ? (ph - 8) * speed : ph < 16 + run ? L : L - (ph - 16 - run) * speed;
      const [x, z, a] = at(Math.max(0.01, Math.min(L - 0.01, s)));
      g.position.set(x, ctx.h(x, z) + 0.12, z);
      g.rotation.y = a + Math.PI / 2;
    });
  });
}

// ───────────────────────── Quicksand Hollow ─────────────────────────

function quicksand(ctx: FieldCtx): void {
  const { b, r } = ctx;
  const [qx, qz] = SPOT.quick;
  const R = 9.8;
  let rim = 0;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    rim += ctx.h(qx + Math.cos(a) * R, qz + Math.sin(a) * R);
  }
  const level = rim / 16 - 0.04;
  const mat = quicksandMaterial(R + 0.5);
  const g = new THREE.CircleGeometry(R + 0.5, 56);
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.set(qx, level, qz);
  mesh.renderOrder = 1;
  ctx.group.add(mesh);
  ctx.disposers.push(() => {
    g.dispose();
    mat.dispose();
  });
  // Seven warning pillars: shafts painted with a red band
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.5;
    const px = qx + Math.cos(a) * (R + 1.8);
    const pz = qz + Math.sin(a) * (R + 1.8);
    ctx.place(px, pz, 0.5);
    const hh = 2.6 + r() * 0.8;
    b.add(new THREE.BoxGeometry(0.9, 0.35, 0.9), COL.stoneDk, MX(px, 0.1, pz, 1, 1, 1, a));
    b.add(new THREE.CylinderGeometry(0.3, 0.42, hh, 6), 0xb4a490, MX(px, hh / 2, pz, 1, 1, 1, a, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12));
    b.add(new THREE.CylinderGeometry(0.36, 0.38, 0.35, 6), COL.banner, MX(px, hh - 0.55, pz, 1, 1, 1, a), false);
    b.add(new THREE.ConeGeometry(0.42, 0.55, 6), COL.stoneDk, MX(px, hh + 0.25, pz, 1, 1, 1, a));
    ctx.solids.add(px, pz, 0.5);
  }
  // Mine cart and crates half sunk in the sand
  b.lift = level;
  b.add(new THREE.BoxGeometry(1.6, 0.9, 1.1), COL.iron, MX(qx + 5.2, 0.05, qz - 4.0, 1, 1, 1, 0.6, 0.35, 0.2));
  b.add(new THREE.BoxGeometry(0.9, 0.9, 0.9), COL.wood, MX(qx - 4.5, 0.1, qz + 3.6, 1, 1, 1, 0.3, 0.4, 0.25));
  // Ribs of a huge beast: arching out of the sand
  const [bx, bz] = [qx + 12.5, qz - 7.5];
  const by = ctx.place(bx, bz, 3);
  const spineA = 0.5;
  for (let i = 0; i < 7; i++) {
    const t = (i - 3) * 1.6;
    const cx = bx + Math.sin(spineA) * t;
    const cz = bz + Math.cos(spineA) * t;
    const s = 1 - Math.abs(i - 3) * 0.12;
    const rib = new THREE.TorusGeometry(3.0 * s, 0.22, 5, 12, Math.PI * 0.8);
    b.add(rib, COL.bone, MX(cx, -0.6, cz, 1, 1.25, 1, spineA + Math.PI / 2, 0, 0.3));
    b.add(new THREE.DodecahedronGeometry(0.42, 0), COL.bone, MX(cx - Math.cos(spineA) * 0.2, 3.1 * s * 1.1 - 0.6, cz + Math.sin(spineA) * 0.2, 1, 1, 1, r() * 6), false);
  }
  const [skx, skz] = [bx + Math.sin(spineA) * 7.2, bz + Math.cos(spineA) * 7.2];
  b.lift = ctx.h(skx, skz);
  b.add(new THREE.DodecahedronGeometry(1, 0), COL.bone, MX(skx, 0.7, skz, 1.3, 1.0, 2.2, spineA, 0.25));
  b.add(new THREE.ConeGeometry(0.28, 1.6, 5), COL.bone, MX(skx + 0.8, 1.4, skz, 1, 1, 1, spineA, -0.5, -0.5));
  b.add(new THREE.ConeGeometry(0.28, 1.6, 5), COL.bone, MX(skx - 0.8, 1.4, skz, 1, 1, 1, spineA, -0.5, 0.5));
  for (let i = 0; i < 7; i++) ctx.solids.add(bx + Math.sin(spineA) * (i - 3) * 1.6, bz + Math.cos(spineA) * (i - 3) * 1.6, 0.9);
  void by;
  // Sand at the edge of the quicksand being sucked in
  ctx.extras.push((dt, t, vfx) => {
    mat.uniforms.uTime.value = t;
    if (vfx.camPos.distanceTo(mesh.position) > 70 || Math.random() > dt * 4) return;
    const a = Math.random() * Math.PI * 2;
    const d = 3 + Math.random() * 6;
    vfx.smoke({ pos: new THREE.Vector3(qx + Math.cos(a) * d, level + 0.1, qz + Math.sin(a) * d), count: 1, color: 0xd6a472, speed: [0.3, 0.6], dir: new THREE.Vector3(-Math.cos(a), 0.3, -Math.sin(a)), spread: 0.2, life: [1.2, 2], size: [0.25, 0.4], sizeEnd: 0.3, intensity: 0.7 });
  });
}

// ───────────────────────── Ancient dragon skeleton ─────────────────────────

/**
 * End of the dead-end alley: the skeleton of an ancient dragon half buried in the sand, the skull leaning on the rock wall, the
 * wing bones spread open
 */
function fossil(ctx: FieldCtx): void {
  const { b, r } = ctx;
  const [fx, fz] = SPOT.fossil;
  // The spine curves along an arc from the middle of the valley toward the rock wall
  const spine: THREE.Vector3[] = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const x = fx - 13 + t * 12 + Math.sin(t * 3) * 2;
    const z = fz + 9 - t * 8 + Math.cos(t * 2.4) * 1.5;
    spine.push(new THREE.Vector3(x, ctx.h(x, z) + 0.4 + Math.sin(t * Math.PI) * 1.4, z));
  }
  b.lift = 0;
  spine.forEach((p, i) => {
    const s = 0.55 + Math.sin((i / 15) * Math.PI) * 0.45;
    b.add(new THREE.DodecahedronGeometry(0.5 * s + 0.2, 0), COL.bone, MX(p.x, p.y, p.z, 1, 0.8, 1.3, r() * 6));
    const nxt = spine[Math.min(15, i + 1)];
    const a = Math.atan2(nxt.x - p.x, nxt.z - p.z);
    if (i > 3 && i < 12) {
      const rib = new THREE.TorusGeometry(1.6 + s * 1.6, 0.16, 5, 10, Math.PI * 0.75);
      b.add(rib, COL.bone, MX(p.x, p.y - 0.6, p.z, 1, 1.1, 1, a + Math.PI / 2, 0, 0.35 + r() * 0.2));
    }
    if (i % 3 === 0) ctx.solids.add(p.x, p.z, 1.0);
  });
  // Skull: it threw its head back before it died (a common fossil pose), the back of the skull against the rock wall at the end
  // of the valley floor, the open mouth facing whoever walks in
  const hd = spine[15];
  const ha = Math.atan2(hd.x - spine[13].x, hd.z - spine[13].z);
  const k = 2.0;
  const [bx, bz] = [hd.x + Math.sin(ha) * 1.2, hd.z + Math.cos(ha) * 1.2];
  const by = ctx.h(bx, bz) + 3.2;
  const skull = new THREE.Matrix4().compose(new THREE.Vector3(bx, by, bz), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4, ha + Math.PI, 0, 'YXZ')), new THREE.Vector3(k, k, k));
  const P = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, rx = 0, rz = 0, ry = 0) => skull.clone().multiply(MX(lx, ly, lz, sx, sy, sz, ry, rx, rz));
  b.lift = 0;
  b.add(new THREE.DodecahedronGeometry(1, 1), COL.bone, P(0, 0, 0, 1.45, 1.2, 1.9));
  b.add(new THREE.BoxGeometry(1.25, 0.5, 2.6), COL.bone, P(0, 0.1, 2.3, 1, 1, 1, -0.08));
  b.add(new THREE.DodecahedronGeometry(0.5, 0), COL.bone, P(0, 0.05, 3.55, 1.25, 0.9, 1));
  b.add(new THREE.BoxGeometry(1.1, 0.34, 2.5), COL.bone, P(0, -0.72, 1.95, 1, 1, 1, 0.38));
  for (const s of [-1, 1]) {
    // Eye sockets, nostrils, long horns curving backward
    b.add(new THREE.SphereGeometry(0.36, 7, 5), 0x3a2a24, P(s * 0.92, 0.38, 0.95, 1, 1, 1), false);
    b.add(new THREE.SphereGeometry(0.14, 5, 4), 0x3a2a24, P(s * 0.28, 0.36, 3.6, 1, 1, 1), false);
    b.add(new THREE.ConeGeometry(0.3, 3.2, 6), COL.bone, P(s * 0.75, 0.95, -0.6, 1, 1, 1, -2.05, s * 0.42));
    b.add(new THREE.ConeGeometry(0.16, 1.2, 5), COL.bone, P(s * 1.25, -0.2, -0.9, 1, 1, 1, -1.9, s * 0.9), false);
    // Teeth: upper row pointing down, lower row pointing up
    for (let t = 0; t < 5; t++) {
      b.add(new THREE.ConeGeometry(0.08, 0.42, 4), COL.bone, P(s * 0.5, -0.32, 1.3 + t * 0.52, 1, 1, 1, Math.PI), false);
      b.add(new THREE.ConeGeometry(0.07, 0.34, 4), COL.bone, P(s * 0.45, -0.12 - t * 0.18, 1.2 + t * 0.48, 1, 1, 1, 0.38), false);
    }
  }
  // The last few neck vertebrae arching up and joining the skull (the back of the skull rests against the rock wall)
  for (let t = 1; t <= 4; t++) {
    const u = t / 5;
    const x = hd.x + (bx - hd.x) * u;
    const z = hd.z + (bz - hd.z) * u;
    const y = hd.y + (by - 1.4 - hd.y) * Math.sin(u * Math.PI * 0.5);
    b.add(new THREE.DodecahedronGeometry(0.55, 0), COL.bone, MX(x, y, z, 1, 1.25, 0.8, ha, -0.9 * u));
  }
  ctx.solids.add(bx, bz, 2.2);
  { const [x, z] = local(bx, bz, ha + Math.PI, 0, 3); ctx.solids.add(x, z, 1.4); }
  // Wing bones: several long bones spreading out from the shoulder
  const sh = spine[5];
  b.lift = 0;
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const a = Math.atan2(spine[6].x - spine[4].x, spine[6].z - spine[4].z) + s * (0.9 + k * 0.32);
      const len = 5.5 - k * 0.7;
      const tip = new THREE.Vector3(sh.x + Math.sin(a) * len, ctx.h(sh.x + Math.sin(a) * len, sh.z + Math.cos(a) * len) + 0.3 + (3 - k) * 0.4, sh.z + Math.cos(a) * len);
      rope(b, sh.clone().setY(sh.y + 0.3), tip, -0.8, 0.13, COL.bone, false, 5);
    }
  }
  // Half-buried claws, scattered bone fragments
  for (let i = 0; i < 8; i++) {
    const x = fx - 12 + r() * 14;
    const z = fz + 2 + r() * 8;
    if (!isFloor(x, z, 0.5)) continue;
    b.add(new THREE.CapsuleGeometry(0.12, 0.8 + r() * 0.8, 3, 5), COL.bone, MX(x, ctx.h(x, z) + 0.12, z, 1, 1, 1, r() * 6, Math.PI / 2), false);
  }
}

// ───────────────────────── Tower Approach ─────────────────────────

/**
 * Tower Approach: a pair of dwarf guardian statues, a ring of rune-carved obelisks, and ground cracks bursting out from the
 * tower base
 */
function towerGround(ctx: FieldCtx): void {
  const { b, r } = ctx;
  const [tx, tz] = TOWER;
  // Guardian statues: dwarves leaning on war hammers, facing the way people come from
  for (const s of [-1, 1]) {
    const x = tx + s * 10.5;
    const z = tz + 22.5;
    const face = Math.atan2(-s * 0.25, 1);
    ctx.place(x, z, 2);
    const F = frame(x, z, face);
    const st = 0xb8a68c;
    const dk = 0x8a7a68;
    b.add(new THREE.BoxGeometry(3.6, 1.4, 3.6), COL.stoneDk, F(0, 0.5, 0));
    b.add(new THREE.BoxGeometry(3.0, 0.4, 3.0), dk, F(0, 1.35, 0), false);
    b.add(new THREE.CylinderGeometry(1.6, 1.9, 3.2, 10), st, F(0, 3.1, 0));
    b.add(new THREE.CylinderGeometry(1.9, 1.6, 2.4, 10), st, F(0, 5.8, 0));
    b.add(new THREE.BoxGeometry(3.4, 0.45, 2.2), dk, F(0, 4.4, 0.1));
    b.add(new THREE.SphereGeometry(1.25, 12, 9), st, F(0, 7.8, 0.1));
    b.add(new THREE.SphereGeometry(1.35, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), dk, F(0, 8.1, 0.1));
    for (const e of [-1, 1]) b.add(new THREE.ConeGeometry(0.3, 1.5, 6), COL.cap, F(e * 1.3, 8.9, 0.1, 0, 1, 0, -e * 0.9));
    // Big beard
    b.add(new THREE.ConeGeometry(1.1, 3.2, 8), dk, F(0, 5.6, 1.0, 0, 1, Math.PI + 0.25));
    // Both hands resting on the war hammer standing in front of them
    b.add(new THREE.CylinderGeometry(0.2, 0.2, 5.2, 6), dk, F(0, 3.6, 2.2));
    b.add(new THREE.BoxGeometry(2.4, 1.3, 1.3), st, F(0, 1.95, 2.2));
    b.add(new THREE.SphereGeometry(0.55, 8, 6), st, F(0, 5.7, 2.0));
    b.glow(new THREE.OctahedronGeometry(0.28), COL.rune, F(0, 7.95, 1.3));
    ctx.solids.add(x, z, 2.2);
  }
  // Rune obelisks
  const glyphs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    // Keep the area within 22 m of the tower's center empty
    const x = tx + Math.sin(a) * 22.8;
    const z = tz + Math.cos(a) * 22.8;
    if (ctx.pathDist(x, z) < 5 || !isFloor(x, z, 0.5)) continue;
    ctx.place(x, z, 1);
    const hh = 5.5 + r() * 2;
    b.add(new THREE.BoxGeometry(1.8, 0.6, 1.8), COL.stoneDk, MX(x, 0.25, z, 1, 1, 1, a));
    const g = new THREE.CylinderGeometry(0.42, 0.85, hh, 4);
    g.rotateY(Math.PI / 4);
    b.add(g, 0x9a8676, MX(x, 0.5 + hh / 2, z, 1, 1, 1, a));
    b.add(new THREE.ConeGeometry(0.62, 1.0, 4), 0x9a8676, MX(x, 0.5 + hh + 0.5, z, 1, 1, 1, a + Math.PI / 4));
    const gy = ctx.b.lift;
    for (let k = 0; k < 3; k++) {
      const gg = new THREE.BoxGeometry(0.34, 0.5, 0.04);
      gg.applyMatrix4(MX(x - Math.sin(a) * (0.56 - k * 0.04), gy + 1.8 + k * 1.3, z - Math.cos(a) * (0.56 - k * 0.04), 1, 1, 1, a));
      glyphs.push(gg);
    }
    ctx.solids.add(x, z, 1.0);
  }
  const setGlyph = glowGroup(ctx.group, ctx.disposers, COL.rune, glyphs);
  ctx.extras.push((_dt, t) => setGlyph(1.6 + Math.sin(t * 1.4) * 0.5));
  // Cracks in the foundation: scurrying outward from the tower base, with magma-like light showing through the seams
  const cracks: THREE.BufferGeometry[] = [];
  const add = (x0: number, z0: number, a0: number, len: number, w: number) => {
    let x = x0;
    let z = z0;
    let a = a0;
    for (let s = 0; s < len; s += 1.1) {
      const nx = x + Math.sin(a) * 1.1;
      const nz = z + Math.cos(a) * 1.1;
      const yy = (ctx.h(x, z) + ctx.h(nx, nz)) / 2;
      const aa = Math.atan2(nx - x, nz - z);
      const k = 1 - s / len;
      b.lift = 0;
      b.add(new THREE.BoxGeometry(w * k + 0.25, 0.08, 1.25), 0x2a1a18, MX((x + nx) / 2, yy + 0.03, (z + nz) / 2, 1, 1, 1, aa), false);
      const g = new THREE.BoxGeometry((w * k + 0.25) * 0.35, 0.1, 1.2);
      g.applyMatrix4(MX((x + nx) / 2, yy + 0.05, (z + nz) / 2, 1, 1, 1, aa));
      cracks.push(g);
      x = nx;
      z = nz;
      a += (r() - 0.5) * 0.9;
      if (r() < 0.12 && s < len * 0.6) add(x, z, a + (r() < 0.5 ? 0.8 : -0.8), (len - s) * 0.5, w * k * 0.6);
    }
  };
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.7;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.35) continue;
    add(tx + Math.sin(a) * 13.2, tz + Math.cos(a) * 13.2, a, 9 + r() * 7, 0.7);
  }
  // A big crack toward the dig pit
  const da = Math.atan2(SPOT.dig[0] - tx, SPOT.dig[1] - tz);
  add(tx + Math.sin(da) * 13.2, tz + Math.cos(da) * 13.2, da, 16, 1.2);
  // After purification: the dwarves mend the cracks with molten gold (kintsugi), and the ground no longer trembles
  const healed = ctx.done >= ctx.floors;
  const setCrack = glowGroup(ctx.group, ctx.disposers, healed ? 0xf2c870 : 0xff7a30, cracks);
  if (healed) {
    ctx.extras.push((_dt, t) => setCrack(0.75 + Math.sin(t * 0.8) * 0.12));
    return;
  }
  // The ground trembles: now and then a burst of dust and sparks erupts from the cracks
  ctx.extras.push((dt, t, vfx) => {
    setCrack(1.5 + Math.sin(t * 2.1) * 0.4 + Math.max(0, Math.sin(t * 0.35)) * 0.5);
    if (Math.random() > dt * 0.8) return;
    const a = Math.random() * Math.PI * 2;
    const d = 14 + Math.random() * 8;
    const x = tx + Math.sin(a) * d;
    const z = tz + Math.cos(a) * d;
    if (vfx.camPos.distanceTo(new THREE.Vector3(x, 0, z)) > 80) return;
    const p = new THREE.Vector3(x, ctx.h(x, z) + 0.1, z);
    vfx.smoke({ pos: p, count: 4, color: [0xc89a74, 0xa87a5a], speed: [0.8, 2], dir: new THREE.Vector3(0, 1, 0), spread: 0.5, life: [1.5, 2.5], size: [0.5, 0.9], sizeEnd: 2.4, drag: 0.4, intensity: 0.6 });
    vfx.emit({ pos: p, count: 5, color: [0xffa040, 0xff6a20], speed: [2, 4], dir: new THREE.Vector3(0, 1, 0), spread: 0.35, life: [0.5, 1], size: [0.08, 0.14], gravity: -8, intensity: 2 });
  });
}

// ───────────────────────── The Order's dig pit ─────────────────────────

function digSite(ctx: FieldCtx, banners: Banners): void {
  const { b, r } = ctx;
  const [dx, dz] = SPOT.dig;
  const bottom = ctx.h(dx, dz);
  // Derrick in the middle of the pit: four slanted posts, a pulley, and a rope and bucket hanging down
  const top = bottom + 13;
  const legs: THREE.Vector3[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = dx + Math.cos(a) * 8.6;
    const z = dz + Math.sin(a) * 8.6;
    legs.push(new THREE.Vector3(x, ctx.h(x, z), z));
  }
  b.lift = 0;
  const apex = new THREE.Vector3(dx, top, dz);
  for (const l of legs) {
    rope(b, l, apex, 0, 0.22, COL.woodDk, false, 1);
    ctx.solids.add(l.x, l.z, 0.5);
  }
  for (let i = 0; i < 4; i++) {
    const a = legs[i].clone().lerp(apex, 0.35);
    const c = legs[(i + 1) % 4].clone().lerp(apex, 0.35);
    rope(b, a, c, 0, 0.12, COL.wood, false, 1);
  }
  b.add(new THREE.TorusGeometry(0.6, 0.12, 5, 12), COL.iron, MX(dx, top - 0.5, dz, 1, 1, 1));
  rope(b, new THREE.Vector3(dx, top - 0.6, dz), new THREE.Vector3(dx, bottom + 2.2, dz), 0, 0.04, 0x3a3030, false, 1);
  b.add(new THREE.CylinderGeometry(0.5, 0.4, 0.7, 8), COL.wood, MX(dx, bottom + 1.9, dz, 1, 1, 1));
  const gone = ctx.done >= ctx.floors;
  // Void crystals and purple light at the bottom of the pit
  for (let i = 0; i < (gone ? 0 : 7); i++) {
    const a = r() * Math.PI * 2;
    const d = 1 + r() * 2.8;
    const x = dx + Math.cos(a) * d;
    const z = dz + Math.sin(a) * d;
    b.lift = ctx.h(x, z);
    const g = new THREE.OctahedronGeometry(0.5);
    g.scale(0.6, 2.4, 0.6);
    b.glow(g, COL.hex, MX(x, 0.6, z, 0.7 + r() * 0.7, 0.7 + r() * 0.7, 0.7 + r() * 0.7, r() * 6, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7));
  }
  if (!gone) groundGlow(ctx, dx, dz, 6, 0x9a3aff, 0.55);
  // Mouth of the tunnel dug toward the tower
  const ta = Math.atan2(TOWER[0] - dx, TOWER[1] - dz);
  const [ex, ez] = [dx + Math.sin(ta) * 5.2, dz + Math.cos(ta) * 5.2];
  const ey = ctx.place(ex, ez, 1.5);
  const face = ta + Math.PI;
  const F = frame(ex, ez, face);
  for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.4, 3.0, 0.4), COL.woodDk, F(s * 1.5, 1.5, 0));
  b.add(new THREE.BoxGeometry(3.6, 0.45, 0.45), COL.woodDk, F(0, 3.1, 0));
  b.add(new THREE.BoxGeometry(2.7, 2.9, 2.5), 0x140a18, F(0, 1.4, -1.35), false);
  if (!gone) b.glow(new THREE.BoxGeometry(1.2, 0.8, 0.1), COL.hex, F(0, 1.0, -0.2));
  else {
    // The dwarves nailed the tunnel shut with planks, and hung a wooden sign marked Sealed at the entrance
    for (const [ly, rz] of [[0.7, 0], [1.5, 0.05], [2.3, -0.04]] as const) b.add(new THREE.BoxGeometry(3.1, 0.34, 0.12), COL.wood, F(0, ly, 0.3, 0, 1, 0, rz));
    for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.22, 3.3, 0.12), COL.woodDk, F(0, 1.5, 0.4, 0, 1, 0, s * 0.72), false);
    b.add(new THREE.BoxGeometry(0.9, 0.9, 0.1), 0xe9d3a8, F(0, 2.0, 0.5));
    b.add(new THREE.BoxGeometry(0.5, 0.1, 0.12), COL.banner, F(0, 2.15, 0.56), false);
    b.add(new THREE.BoxGeometry(0.1, 0.5, 0.12), COL.banner, F(0, 1.95, 0.56), false);
  }
  void ey;
  // Wooden walkway and ladders at the pit edge
  for (let i = 0; i < 3; i++) {
    const a = ta + Math.PI + (i - 1) * 0.9;
    const x = dx + Math.sin(a) * 6.5;
    const z = dz + Math.cos(a) * 6.5;
    const y = ctx.place(x, z, 1);
    b.add(new THREE.BoxGeometry(2.4, 0.16, 1.2), COL.wood, MX(x, 0.3, z, 1, 1, 1, a));
    const lx = dx + Math.sin(a) * 4.6;
    const lz = dz + Math.cos(a) * 4.6;
    const ly = ctx.h(lx, lz);
    b.lift = 0;
    rope(b, new THREE.Vector3(lx, ly, lz), new THREE.Vector3(x, y + 0.3, z), 0, 0.07, COL.wood, false, 1);
  }
  // The Order's tents, banners and purple braziers
  const fires: THREE.BufferGeometry[] = [];
  for (const [x, z, s] of [[50, -72.5, 2.6], [45, -80, 2.2], [26, -81, 2.4]] as const) {
    if (!isFloor(x, z, 1)) continue;
    ctx.place(x, z, s);
    if (gone) {
      // The Order has withdrawn: the tents have collapsed into heaps of rags, with only a few crooked poles left
      b.add(new THREE.ConeGeometry(s * 1.2, s * 0.5, 8), 0x4a3450, MX(x, 0.2, z, 1, 1, 1, r() * 6, 0.12, -0.1));
      for (let k = 0; k < 3; k++) b.add(new THREE.CylinderGeometry(0.05, 0.06, s * 1.4, 4), COL.woodDk, MX(x + (r() - 0.5) * s, s * 0.45, z + (r() - 0.5) * s, 1, 1, 1, r() * 6, 0.5 + r() * 0.5, r() - 0.5), false);
      ctx.solids.add(x, z, s * 0.9);
      continue;
    }
    b.add(new THREE.CylinderGeometry(s, s * 1.05, 1.5, 8), 0x3e2450, MX(x, 0.75, z, 1, 1, 1));
    b.add(new THREE.ConeGeometry(s * 1.15, s * 1.3, 8), 0x2e1a3e, MX(x, 1.5 + s * 0.65, z, 1, 1, 1));
    b.add(new THREE.TorusGeometry(s * 1.08, 0.07, 4, 16), COL.gold, MX(x, 1.52, z, 1, 1, 1, 0, Math.PI / 2), false);
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 4), COL.gold, MX(x, 1.5 + s * 1.3 + 0.5, z, 1, 1, 1), false);
    ctx.solids.add(x, z, s + 0.2);
  }
  for (const [x, z] of [[41, -61.5], [25.5, -70], [46.5, -76]] as const) {
    if (!isFloor(x, z, 0.5)) continue;
    ctx.place(x, z, 0.5);
    if (gone) {
      // Overturned, extinguished braziers
      b.add(new THREE.CylinderGeometry(0.15, 0.25, 1.6, 5), COL.iron, MX(x, 0.2, z, 1, 1, 1, r() * 6, Math.PI / 2));
      b.add(new THREE.CylinderGeometry(0.55, 0.28, 0.45, 7), 0x3a3040, MX(x + 1.0, 0.3, z + 0.3, 1, 1, 1, r() * 6, 1.9));
      continue;
    }
    b.add(new THREE.CylinderGeometry(0.15, 0.25, 1.6, 5), COL.iron, MX(x, 0.8, z, 1, 1, 1));
    b.add(new THREE.CylinderGeometry(0.55, 0.28, 0.45, 7), 0x3a3040, MX(x, 1.75, z, 1, 1, 1));
    const g = new THREE.ConeGeometry(0.4, 1.0, 6);
    g.applyMatrix4(MX(x, ctx.b.lift + 2.4, z, 1, 1, 1));
    fires.push(g);
    ctx.solids.add(x, z, 0.5);
    banners.add(new THREE.Vector3(x + 0.8, ctx.b.lift + 3.4, z), 0.4, 0.8, 2.2, 0x3a2050, COL.gold);
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 4), COL.iron, MX(x + 0.8, 1.8, z, 1, 1, 1), false);
  }
  const setFire = glowGroup(ctx.group, ctx.disposers, 0xb060ff, fires);
  // Mine carts and crates piled full of void crystals
  for (const [x, z] of [[29, -64], [44, -70.5]] as const) {
    if (!isFloor(x, z, 0.5)) continue;
    ctx.place(x, z, 1);
    b.add(new THREE.BoxGeometry(1.6, 0.8, 1.1), COL.iron, MX(x, 0.65, z, 1, 1, 1, 0.8));
    for (let k = 0; k < (gone ? 0 : 3); k++) b.glow(new THREE.OctahedronGeometry(0.28), COL.hex, MX(x + (k - 1) * 0.4, 1.2, z, 0.8, 1.4, 0.8, r() * 6));
    b.add(new THREE.BoxGeometry(0.9, 0.9, 0.9), COL.wood, MX(x + 1.4, 0.45, z - 0.8, 1, 1, 1, r()));
    ctx.solids.add(x, z, 1.4);
  }
  if (gone) {
    // The citadel's banner planted at the pit edge: this place has been reclaimed
    const [fx, fz] = [dx + Math.sin(ta + Math.PI) * 7.6, dz + Math.cos(ta + Math.PI) * 7.6];
    if (isFloor(fx, fz, 0.3)) {
      ctx.place(fx, fz, 0.4);
      b.add(new THREE.CylinderGeometry(0.07, 0.09, 5.4, 6), COL.wood, MX(fx, 2.7, fz, 1, 1, 1));
      b.add(new THREE.SphereGeometry(0.14, 6, 5), COL.gold, MX(fx, 5.45, fz, 1, 1, 1), false);
      banners.add(new THREE.Vector3(fx + 0.08, ctx.b.lift + 5.2, fz), ta, 0.9, 2.2, COL.banner, COL.gold);
      ctx.solids.add(fx, fz, 0.3);
    }
    return;
  }
  ctx.extras.push((dt, t, vfx) => {
    setFire(1.8 + Math.sin(t * 7.3) * 0.3);
    if (vfx.camPos.distanceTo(new THREE.Vector3(dx, bottom, dz)) > 80 || Math.random() > dt * 5) return;
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * 3;
    vfx.emit({ pos: new THREE.Vector3(dx + Math.cos(a) * d, bottom + 0.3, dz + Math.sin(a) * d), count: 1, color: [0xb04aff, 0x6a1aaa], speed: [0.4, 1], dir: new THREE.Vector3(0, 1, 0), spread: 0.3, life: [2, 3], size: [0.15, 0.3], intensity: 1.6 });
  });
}

// ───────────────────────── Old Shrine west of the tower ─────────────────────────

function shrine(ctx: FieldCtx): void {
  const { b, r } = ctx;
  const [sx, sz] = SPOT.shrine;
  const face = Math.atan2(TOWER[0] - sx, TOWER[1] - sz);
  ctx.place(sx, sz, 5);
  const F = frame(sx, sz, face);
  b.add(new THREE.BoxGeometry(11, 0.7, 8), COL.stoneDk, F(0, 0.15, 0));
  b.add(new THREE.BoxGeometry(9.5, 0.4, 6.5), COL.stone2, F(0, 0.6, 0), false);
  const cols: [number, number, number][] = [[-3.8, -2.4, 5.2], [-1.3, -2.4, 2.2], [1.3, -2.4, 4.6], [3.8, -2.4, 1.4], [-3.8, 2.2, 3.1], [3.8, 2.2, 5.0]];
  for (const [lx, lz, hh] of cols) {
    b.add(new THREE.CylinderGeometry(0.5, 0.55, hh, 9), COL.stone, F(lx, 0.8 + hh / 2, lz));
    b.add(new THREE.BoxGeometry(1.3, 0.35, 1.3), COL.stoneDk, F(lx, 0.95, lz));
    if (hh > 4.5) b.add(new THREE.BoxGeometry(1.3, 0.4, 1.3), COL.stoneDk, F(lx, 0.8 + hh + 0.2, lz));
    ctx.solids.add(...local(sx, sz, face, lx, lz), 0.7);
  }
  // Fallen pillar
  b.add(new THREE.CylinderGeometry(0.5, 0.5, 4.2, 9), COL.stone, F(-0.5, 1.3, 4.8, 0.3, 1, 0, Math.PI / 2));
  // Altar and glowing stone slab
  b.add(new THREE.BoxGeometry(2.2, 1.1, 1.2), COL.stone, F(0, 1.3, -1.5));
  b.glow(new THREE.BoxGeometry(1.0, 1.4, 0.12), COL.rune, F(0, 2.6, -1.9));
  b.add(new THREE.BoxGeometry(1.3, 1.7, 0.2), COL.stoneDk, F(0, 2.6, -2.05));
  ctx.solids.add(...local(sx, sz, face, 0, -1.5), 1.3);
  // Two stone gargoyles (`gargoyle`, the Gatewarden)
  for (const s of [-1, 1]) {
    const [gx, gz] = local(sx, sz, face, s * 5.6, 1.6);
    ctx.place(gx, gz, 1);
    b.add(new THREE.BoxGeometry(1.4, 1.6, 1.4), COL.stoneDk, MX(gx, 0.8, gz, 1, 1, 1, face));
    const G = frame(gx, gz, face);
    b.add(new THREE.SphereGeometry(0.62, 8, 6), 0x8a8a96, G(0, 2.1, 0));
    b.add(new THREE.SphereGeometry(0.42, 8, 6), 0x8a8a96, G(0, 2.85, 0.22));
    for (const e of [-1, 1]) {
      b.add(new THREE.ConeGeometry(0.42, 1.1, 4), 0x8a8a96, G(e * 0.7, 2.5, -0.1, 0, 1, 0, -e * 0.9));
      b.add(new THREE.ConeGeometry(0.08, 0.35, 4), 0x8a8a96, G(e * 0.22, 3.25, 0.2));
      b.glow(new THREE.SphereGeometry(0.06, 5, 4), 0xff5a3a, G(e * 0.14, 2.92, 0.6));
    }
    ctx.solids.add(gx, gz, 0.9);
  }
  // Rubble
  for (let i = 0; i < 6; i++) {
    const [x, z] = local(sx, sz, face, (r() - 0.5) * 12, (r() - 0.5) * 9);
    ctx.place(x, z, 0.5);
    b.add(new THREE.BoxGeometry(0.8 + r(), 0.5 + r() * 0.4, 0.7 + r()), COL.stone2, MX(x, 0.25, z, 1, 1, 1, r() * 6, r() * 0.4, r() * 0.4));
  }
}

// ───────────────────────── Crystalheart Grotto ─────────────────────────

function grotto(ctx: FieldCtx): void {
  const { b, r } = ctx;
  const [gx, gz] = SPOT.grotto;
  // Huge crystal columns growing slantwise out of the rock wall (amber and teal alternating)
  const tips: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + r() * 0.3;
    // Find the wall foot in that direction
    let d = 3;
    while (d < 16 && isFloor(gx + Math.cos(a) * d, gz + Math.sin(a) * d, 0)) d += 0.5;
    const x = gx + Math.cos(a) * (d + 0.5);
    const z = gz + Math.sin(a) * (d + 0.5);
    const y = ctx.h(x, z);
    const L = 4 + r() * 5;
    const R = 0.6 + r() * 0.7;
    const col = i % 2 ? 0x9af0f0 : 0xffd08a;
    const glow = i % 2 ? COL.cyan : COL.rune;
    const tilt = 0.5 + r() * 0.4;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-tilt, 0, 0)));
    // Local +y runs along the crystal column (toward the middle of the grotto, and up)
    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const base = new THREE.Vector3(x, y + 0.6, z);
    const mid = base.clone().addScaledVector(dir, L / 2);
    const body = new THREE.CylinderGeometry(R, R * 1.1, L, 6);
    b.lift = 0;
    b.add(body, col, new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)), true);
    const tip = new THREE.ConeGeometry(R, R * 2.2, 6);
    tip.applyMatrix4(new THREE.Matrix4().compose(base.clone().addScaledVector(dir, L + R * 1.1), q, new THREE.Vector3(1, 1, 1)));
    tips.push(tip);
    const core = new THREE.CylinderGeometry(R * 0.45, R * 0.5, L * 0.9, 6);
    b.glow(core, glow, new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1.02, 1, 1.02)));
  }
  const setTips = glowGroup(ctx.group, ctx.disposers, 0xfff0d0, tips);
  // Small crystal clusters
  for (let i = 0; i < (ctx.low ? 10 : 22); i++) {
    const a = r() * Math.PI * 2;
    const d = 2 + r() * 9;
    const x = gx + Math.cos(a) * d;
    const z = gz + Math.sin(a) * d;
    if (!isFloor(x, z, 0.3) || ctx.solids.blocked(x, z, 1)) continue;
    b.lift = ctx.h(x, z);
    for (let k = 0; k < 3; k++) {
      const g = new THREE.OctahedronGeometry(0.4);
      g.scale(0.55, 2.2, 0.55);
      b.glow(g, k % 2 ? COL.cyan : COL.rune, MX(x + (r() - 0.5) * 0.8, 0.6, z + (r() - 0.5) * 0.8, 0.6 + r() * 0.7, 0.6 + r() * 0.7, 0.6 + r() * 0.7, r() * 6, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8));
    }
  }
  // Stone plinth for the big treasure chest
  const [cx, cz] = ctx.layout.chests[ctx.layout.chests.length - 1];
  const cy = ctx.place(cx, cz, 1.8);
  b.add(new THREE.CylinderGeometry(1.8, 2.1, 0.35, 8), COL.stone, MX(cx, -0.1, cz, 1, 1, 1));
  b.add(new THREE.CylinderGeometry(2.25, 2.45, 0.3, 8), COL.stoneDk, MX(cx, -0.16, cz, 1, 1, 1), false);
  b.glow(new THREE.TorusGeometry(1.45, 0.05, 4, 32), COL.rune, MX(cx, 0.09, cz, 1, 1, 1, 0, Math.PI / 2));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    b.glow(new THREE.OctahedronGeometry(0.22), i % 2 ? COL.cyan : COL.rune, MX(cx + Math.cos(a) * 2.05, 0.35, cz + Math.sin(a) * 2.05, 0.7, 1.8, 0.7, a));
  }
  void cy;
  // Pool, light shaft, glints
  const [px, pz, pr] = POOLS[1];
  waterPool(ctx, px, pz, pr, 0x7af0e8, 0x1a8a9a);
  groundGlow(ctx, px, pz, pr + 2, 0x4affe0, 0.3);
  groundGlow(ctx, gx, gz, 9, 0xffc060, 0.15);
  shaftsAt(ctx, gx, gz, [
    { x: 1, z: 2, w: 2.4, h: 24 },
    { x: -3, z: -1, w: 1.8, h: 22 },
    { x: 3, z: -3, w: 1.4, h: 20 },
  ], new THREE.Vector3(0.62, 0.95, -0.25), 0xffe6b0, 0.18);
  ctx.extras.push((dt, t, vfx) => {
    setTips(1.5 + Math.sin(t * 1.9) * 0.4);
    if (vfx.camPos.distanceTo(new THREE.Vector3(gx, ctx.h(gx, gz), gz)) > 60 || Math.random() > dt * 8) return;
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * 9;
    const x = gx + Math.cos(a) * d;
    const z = gz + Math.sin(a) * d;
    vfx.emit({ pos: new THREE.Vector3(x, ctx.h(x, z) + 0.5 + Math.random() * 3, z), count: 1, color: [0x9affff, 0xffe0a0, 0xffffff], speed: [0.1, 0.3], dir: new THREE.Vector3(0, 1, 0), spread: 0.8, life: [1.5, 2.5], size: [0.08, 0.16], sizeEnd: 0.02, intensity: 2.2, atlas: 1 });
  });
  void wallDist;
}
