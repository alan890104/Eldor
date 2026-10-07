// Shellback Citadel: the dwarf city built on the giant tortoise's shell. Heavy sandstone houses (battered walls, verdigris
// domes or slate hip roofs, glowing runes over the arches), the sacred fire altar and market stalls in the center, King Baldo's
// Hall and King's Tower against the rock wall in the south, a ring of city wall and towers, the gatehouse in the north, the
// Royal Stair winding down along the shell rim (railings, lamps, stair stones), and the lift on the east side that hoists mine
// carts up onto the shell.

import * as THREE from 'three';
import { softMaterial, SoftGeo } from '../../../arenas/highland.ts';
import { rope } from '../../../arenas/_woods.ts';
import { glowGroup, type FieldCtx } from '../../kit.ts';
import { RAMP, SHELL, SPOT, TOWN, rampAt } from './geo.ts';
import { COL, MX, along, dynMesh, frame, glowMat, local } from './pal.ts';

/** Banners: collects all the banner cloths and finally merges them into one waving mesh */
export class Banners {
  private g = new SoftGeo();
  private n = 0;
  /** Hang a banner of width w and length h from top (midpoint of the top edge), oriented by facing */
  add(top: THREE.Vector3, facing: number, w: number, h: number, body: number, trim: number): void {
    const c = Math.cos(facing);
    const s = Math.sin(facing);
    const X = (lx: number, y: number): [number, number, number] => [top.x + c * lx, top.y - y, top.z - s * lx];
    const rows = 5;
    const col = new THREE.Color();
    for (let i = 0; i < rows; i++) {
      const y0 = (i / rows) * h;
      const y1 = ((i + 1) / rows) * h;
      const tip = i === rows - 1;
      col.setHex(i === rows - 2 ? trim : body);
      const sw0 = y0 / h;
      const sw1 = y1 / h;
      if (!tip) {
        this.g.quad(X(-w / 2, y0), X(w / 2, y0), X(w / 2, y1), X(-w / 2, y1), col, [sw0, sw0, sw1, sw1], this.n * 1.7);
      } else {
        // Swallowtail
        this.g.tri(X(-w / 2, y0), X(0, y0), X(-w / 2, y1), col, [sw0, sw0, sw1], this.n * 1.7);
        this.g.tri(X(0, y0), X(w / 2, y0), X(w / 2, y1), col, [sw0, sw0, sw1], this.n * 1.7);
        this.g.tri(X(-w * 0.1, y0), X(w * 0.1, y0), X(0, y0 + (y1 - y0) * 0.35), col, [sw0, sw0, sw0], this.n * 1.7);
      }
    }
    this.n++;
  }
  build(ctx: FieldCtx): void {
    if (!this.n) return;
    const mat = softMaterial(
      /* glsl */ `
      float wv = sin(uTime * 2.4 + aPhase + aSway * 3.2) * 0.6 + sin(uTime * 3.7 + aPhase * 1.3 + aSway * 5.0) * 0.4;
      p += normal * aSway * 0.32 * wv;
      p.x += aSway * aSway * 0.18;`,
      0.62,
    );
    const mesh = new THREE.Mesh(this.g.build(), mat);
    ctx.group.add(mesh);
    ctx.disposers.push(() => {
      mat.dispose();
      mesh.geometry.dispose();
    });
    ctx.extras.push((_dt, t) => (mat.uniforms.uTime.value = t));
  }
}

interface Smoke {
  pos: THREE.Vector3;
  big: boolean;
}

export function buildCity(ctx: FieldCtx, banners: Banners, windows: THREE.BufferGeometry[], smokes: Smoke[]): void {
  plazaCenter(ctx, banners);
  kingHall(ctx, banners, windows);
  homes(ctx, windows, smokes);
  cityWall(ctx, banners);
  overlook(ctx, banners);
  northGate(ctx, banners);
  royalStair(ctx, banners);
  lift(ctx, banners);
  ctx.b.lift = 0;
}

// ───────────────────────── Buildings ─────────────────────────

/**
 * Dwarf stone house: battered thick walls, belt course, arch and lintel runes, deep windows, roof (hip slate / verdigris dome /
 * flat with parapet), chimney
 */
function stoneHouse(
  ctx: FieldCtx,
  x: number,
  z: number,
  facing: number,
  w: number,
  d: number,
  h: number,
  roof: 'hip' | 'dome' | 'flat',
  windows: THREE.BufferGeometry[],
  smokes: Smoke[],
  wall = COL.stone,
): void {
  const { b } = ctx;
  const y = ctx.place(x, z, Math.max(w, d) * 0.55);
  const F = frame(x, z, facing);
  const W = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, ry = 0) => {
    const [wx, wz] = local(x, z, facing, lx, lz);
    return MX(wx, ly, wz, sx, sy, sz, facing + ry);
  };
  b.add(new THREE.BoxGeometry(w + 0.9, 0.9, d + 0.9), COL.stoneDk, F(0, 0.1, 0));
  const body = new THREE.CylinderGeometry(0.64, 0.707, 1, 4, 1);
  body.rotateY(Math.PI / 4);
  b.add(body, wall, W(0, 0.55 + h / 2, 0, w, h, d));
  b.add(new THREE.BoxGeometry(w * 0.97 + 0.12, 0.28, d * 0.97 + 0.12), COL.stoneDk, F(0, 0.55 + h * 0.62, 0), false);
  // Corner stones
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(new THREE.BoxGeometry(0.5, h * 0.55, 0.5), COL.stone2, F(sx * (w / 2 - 0.05), 0.55 + h * 0.28, sz * (d / 2 - 0.05)), false);
  // Arch
  const dz = d / 2 + 0.06;
  b.add(new THREE.BoxGeometry(1.9, 2.5, 0.35), COL.stone2, F(0, 1.8, dz - 0.1));
  b.add(new THREE.BoxGeometry(1.2, 1.55, 0.2), COL.woodDk, F(0, 1.35, dz + 0.02));
  const archTop = new THREE.CylinderGeometry(0.6, 0.6, 0.2, 10, 1, false, -Math.PI / 2, Math.PI);
  archTop.rotateX(Math.PI / 2);
  b.add(archTop, COL.woodDk, F(0, 2.12, dz + 0.02));
  b.glow(new THREE.BoxGeometry(0.62, 0.16, 0.08), COL.rune, F(0, 3.25, dz + 0.02));
  // Window: a deeply recessed stone frame + warm light
  const winAt = (lx: number, ly: number, lz: number, ry: number) => {
    const g = new THREE.BoxGeometry(0.62, 0.72, 0.12);
    g.applyMatrix4(F(lx, ly, lz, ry));
    g.translate(0, y, 0);
    windows.push(g);
    b.add(new THREE.BoxGeometry(0.95, 0.16, 0.3), COL.stoneDk, F(lx, ly - 0.45, lz, ry), false);
  };
  const wy = 0.55 + h * 0.45;
  if (w > 4.2) for (const sx of [-1, 1]) winAt(sx * w * 0.3, wy, dz - 0.05, 0);
  winAt(w / 2 - 0.02, wy, 0, Math.PI / 2);
  winAt(-w / 2 + 0.02, wy, 0, -Math.PI / 2);
  if (h > 4.5) for (const sx of [-1, 1]) winAt(sx * w * 0.28, 0.55 + h * 0.78, dz - 0.15, 0);
  // Roof
  const top = 0.55 + h;
  if (roof === 'hip') {
    const g = new THREE.ConeGeometry(0.707, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    b.add(g, COL.basalt, W(0, top + 0.95, 0, w * 0.93 + 0.9, 1.9, d * 0.93 + 0.9));
    b.add(new THREE.BoxGeometry(w * 0.93 + 0.95, 0.22, d * 0.93 + 0.95), COL.stoneDk, F(0, top + 0.05, 0), false);
  } else if (roof === 'dome') {
    b.add(new THREE.BoxGeometry(w * 0.93 + 0.3, 0.45, d * 0.93 + 0.3), COL.stoneDk, F(0, top + 0.1, 0));
    const r = Math.min(w, d) * 0.4;
    b.add(new THREE.CylinderGeometry(r * 1.02, r * 1.08, 0.6, 12), COL.stone2, F(0, top + 0.6, 0));
    b.add(new THREE.SphereGeometry(r, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), COL.copper, F(0, top + 0.88, 0));
    b.add(new THREE.CylinderGeometry(0.05, 0.1, 1.2, 5), COL.gold, F(0, top + 0.88 + r + 0.4, 0), false);
    b.add(new THREE.OctahedronGeometry(0.18), COL.gold, F(0, top + 0.88 + r + 1.0, 0), false);
  } else {
    b.add(new THREE.BoxGeometry(w * 0.93 + 0.4, 0.5, d * 0.93 + 0.4), COL.stoneDk, F(0, top + 0.2, 0));
    const n = Math.round(w / 1.1);
    for (let i = 0; i <= n; i += 2) {
      const lx = -w * 0.47 + (i / n) * w * 0.94;
      for (const sz of [-1, 1]) b.add(new THREE.BoxGeometry(0.55, 0.5, 0.45), COL.stone2, F(lx, top + 0.7, sz * (d * 0.47)), false);
    }
  }
  // Chimney
  const [cx, cz] = local(x, z, facing, w * 0.28, -d * 0.22);
  b.add(new THREE.BoxGeometry(0.7, 2.0, 0.7), COL.stoneDk, MX(cx, top + 1.1, cz, 1, 1, 1, facing));
  b.add(new THREE.BoxGeometry(0.9, 0.22, 0.9), COL.basalt, MX(cx, top + 2.15, cz, 1, 1, 1, facing));
  smokes.push({ pos: new THREE.Vector3(cx, y + top + 2.4, cz), big: false });
  ctx.solids.add(x, z, Math.max(w, d) * 0.62 + 0.3);
}

// ───────────────────────── Plaza ─────────────────────────

/**
 * The sacred fire altar at the center of the plaza: a three-tier stone platform, a bronze brazier and four rune stones,
 * surrounded by market stalls
 */
function plazaCenter(ctx: FieldCtx, banners: Banners): void {
  const { b, r } = ctx;
  const [x, z] = TOWN;
  ctx.place(x, z, 3.5);
  b.add(new THREE.CylinderGeometry(3.7, 4.0, 0.5, 14), COL.stoneDk, MX(x, 0.15, z, 1, 1, 1));
  b.add(new THREE.CylinderGeometry(2.8, 3.0, 0.5, 14), COL.stone, MX(x, 0.62, z, 1, 1, 1));
  b.add(new THREE.CylinderGeometry(0.75, 1.0, 1.7, 8), COL.basalt, MX(x, 1.7, z, 1, 1, 1));
  b.add(new THREE.CylinderGeometry(1.9, 0.85, 1.0, 14), COL.bronze, MX(x, 3.0, z, 1, 1, 1));
  b.add(new THREE.TorusGeometry(1.85, 0.12, 5, 20), COL.gold, MX(x, 3.5, z, 1, 1, 1, 0, Math.PI / 2));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const px = x + Math.cos(a) * 3.35;
    const pz = z + Math.sin(a) * 3.35;
    b.add(new THREE.BoxGeometry(0.7, 1.7, 0.45), COL.stone2, MX(px, 1.2, pz, 1, 1, 1, -a + Math.PI / 2));
    b.glow(new THREE.BoxGeometry(0.28, 0.9, 0.5), COL.rune, MX(px, 1.3, pz, 1, 1, 1, -a + Math.PI / 2));
  }
  ctx.solids.add(x, z, 3.9);
  // Flame: three conical layers, flickering together
  const flames: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const g = new THREE.ConeGeometry(0.55, 1.8 + r() * 0.8, 6);
    g.applyMatrix4(MX(x + Math.cos(a) * 0.7, ctx.h(x, z) + 4.2, z + Math.sin(a) * 0.7, 1, 1, 1, r()));
    flames.push(g);
  }
  const core = new THREE.ConeGeometry(0.9, 3.0, 7);
  core.applyMatrix4(MX(x, ctx.h(x, z) + 4.8, z, 1, 1, 1));
  flames.push(core);
  const setFire = glowGroup(ctx.group, ctx.disposers, COL.fire, flames);
  const fy = ctx.h(x, z) + 4.5;
  ctx.extras.push((dt, t, vfx) => {
    setFire(1.9 + Math.sin(t * 9.3) * 0.25 + Math.sin(t * 15.1) * 0.15);
    if (Math.random() < dt * 9 && vfx.camPos.distanceTo(new THREE.Vector3(x, fy, z)) < 70) {
      vfx.emit({ pos: new THREE.Vector3(x + (Math.random() - 0.5), fy, z + (Math.random() - 0.5)), count: 1, color: [0xffc060, 0xff7a2a], speed: [1.5, 3], dir: new THREE.Vector3(0.15, 1, 0), spread: 0.25, life: [0.8, 1.6], size: [0.12, 0.22], sizeEnd: 0.1, intensity: 2 });
    }
  });

  // Market stalls: striped rain awnings, counters and goods
  const stalls: [number, number][] = [
    [7.4, 5.2],
    [-7.8, 4.4],
    [8.2, -3.2],
    [-8.4, -3.6],
  ];
  stalls.forEach(([dx, dz], i) => {
    const sx = x + dx;
    const sz = z + dz;
    if (ctx.pathDist(sx, sz) < 4.2) return;
    const face = Math.atan2(x - sx, z - sz);
    ctx.place(sx, sz, 1.5);
    const F = frame(sx, sz, face);
    for (const lx of [-1.4, 1.4]) for (const lz of [-0.9, 0.9]) b.add(new THREE.CylinderGeometry(0.07, 0.08, 2.3, 5), COL.wood, F(lx, 1.15, lz), false);
    b.add(new THREE.BoxGeometry(3.0, 0.9, 1.1), COL.wood, F(0, 0.45, 0.35));
    const stripes = 5;
    for (let k = 0; k < stripes; k++) {
      const col = k % 2 ? COL.awning[3] : COL.awning[i % 3];
      b.add(new THREE.BoxGeometry(3.4 / stripes, 0.08, 2.4), col, F(-1.7 + (k + 0.5) * (3.4 / stripes), 2.35, 0.05, 0, 1, -0.22), false);
    }
    for (let k = 0; k < 6; k++) {
      const c = [0xe2503a, 0xf2b040, 0x8ab04a, 0x6ac8e0, 0xc8a070][k % 5];
      b.add(new THREE.IcosahedronGeometry(0.2 + r() * 0.1, 0), c, F(-1.1 + k * 0.44, 1.05, 0.35 + (r() - 0.5) * 0.4), false);
    }
    b.add(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 8), COL.wood, F(1.9, 0.4, 0.7));
    ctx.solids.add(sx, sz, 1.7);
  });
  // Lamp posts at the four corners of the plaza, flying the citadel's banners
  const posts: (THREE.Vector3 | null)[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const px = x + Math.cos(a) * 11.2;
    const pz = z + Math.sin(a) * 11.2;
    if (ctx.pathDist(px, pz) < 3.4) {
      posts.push(null);
      continue;
    }
    dwarfLamp(ctx, px, pz);
    posts.push(new THREE.Vector3(px, ctx.h(px, pz) + 3.62, pz));
    if (i % 2 === 0) banners.add(new THREE.Vector3(px + Math.cos(a) * 0.2, ctx.h(px, pz) + 3.4, pz + Math.sin(a) * 0.2), -a + Math.PI / 2, 0.7, 1.6, COL.banner, COL.gold);
  }
  // After the Seal Tower is purified: the citadel holds a festival, with strings of pennants strung between the lamp posts and
  // colored paper lanterns hung up
  if (ctx.done >= ctx.floors) festival(ctx, posts);
}

function festival(ctx: FieldCtx, posts: (THREE.Vector3 | null)[]): void {
  const { b } = ctx;
  const flagCols = [0xd8483a, 0xf0c050, 0x3f8f80, 0xf2ead8, 0xe2803a];
  const lamps = [0xffb050, 0xff7a5a, 0xffd870];
  b.lift = 0;
  for (let i = 0; i < posts.length; i++) {
    const a = posts[i];
    const c = posts[(i + 1) % posts.length];
    if (!a || !c) continue;
    const sag = 0.7;
    rope(b, a, c, sag, 0.025, 0x6a5a48, false, 12);
    const n = 14;
    for (let k = 1; k < n; k++) {
      const u = k / n;
      const p = a.clone().lerp(c, u);
      p.y -= sag * 4 * u * (1 - u);
      if (k % 4 === 2) {
        b.glow(new THREE.SphereGeometry(0.2, 8, 6), lamps[(i + k) % 3], MX(p.x, p.y - 0.42, p.z, 1, 1.25, 1));
        b.add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8), COL.woodDk, MX(p.x, p.y - 0.15, p.z, 1, 1, 1), false);
        continue;
      }
      b.add(new THREE.CylinderGeometry(0.3, 0.001, 0.55, 3, 1), flagCols[(i + k) % flagCols.length], MX(p.x, p.y - 0.29, p.z, 1, 1, 0.12, Math.atan2(c.x - a.x, c.z - a.z) + Math.PI / 2), false);
    }
  }
}

/** Dwarf street lamp: square stone base, iron post, four-sided lantern */
export function dwarfLamp(ctx: FieldCtx, x: number, z: number, hgt = 3.2): void {
  const { b } = ctx;
  ctx.place(x, z, 0.4);
  b.add(new THREE.BoxGeometry(0.62, 0.55, 0.62), COL.stoneDk, MX(x, 0.25, z, 1, 1, 1));
  b.add(new THREE.CylinderGeometry(0.09, 0.12, hgt, 6), COL.iron, MX(x, hgt / 2 + 0.3, z, 1, 1, 1));
  b.add(new THREE.BoxGeometry(0.5, 0.1, 0.5), COL.iron, MX(x, hgt + 0.3, z, 1, 1, 1), false);
  b.glow(new THREE.BoxGeometry(0.34, 0.42, 0.34), COL.win, MX(x, hgt + 0.58, z, 1, 1, 1));
  b.add(new THREE.ConeGeometry(0.42, 0.34, 4), COL.iron, MX(x, hgt + 0.95, z, 1, 1, 1, Math.PI / 4), false);
  ctx.solids.add(x, z, 0.35);
}

// ───────────────────────── King's Hall and King's Tower ─────────────────────────

function kingHall(ctx: FieldCtx, banners: Banners, windows: THREE.BufferGeometry[]): void {
  const { b } = ctx;
  const x = 0;
  const z = 87;
  const face = Math.PI;
  const y = ctx.place(x, z, 7);
  const F = frame(x, z, face);
  // Platform and steps
  b.add(new THREE.BoxGeometry(19, 1.6, 13), COL.stoneDk, F(0, 0.3, 0));
  for (let i = 0; i < 4; i++) b.add(new THREE.BoxGeometry(9 - i * 0.6, 0.4, 1.0), COL.stone2, F(0, 0.2 + i * 0.36, 7.1 - i * 0.7), false);
  // Hall body
  b.add(new THREE.BoxGeometry(14, 7.5, 8.5), COL.stone, F(0, 1.1 + 3.75, -0.8));
  b.add(new THREE.BoxGeometry(14.6, 0.6, 9.1), COL.stoneDk, F(0, 1.1 + 7.5, -0.8));
  // Colonnade
  for (let i = 0; i < 6; i++) {
    const lx = -6 + i * 2.4;
    b.add(new THREE.CylinderGeometry(0.5, 0.58, 6.4, 10), COL.stone2, F(lx, 1.1 + 3.2, 4.5));
    b.add(new THREE.BoxGeometry(1.4, 0.45, 1.4), COL.stoneDk, F(lx, 1.1 + 0.22, 4.5));
    b.add(new THREE.BoxGeometry(1.4, 0.5, 1.4), COL.gold, F(lx, 1.1 + 6.55, 4.5), false);
  }
  b.add(new THREE.BoxGeometry(15, 1.1, 2.6), COL.stoneDk, F(0, 1.1 + 7.35, 4.4));
  // Pediment + golden hammer emblem
  const ped = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  ped.rotateX(Math.PI / 2);
  ped.rotateZ(Math.PI);
  b.add(ped, COL.stone, MX(...(() => { const [wx, wz] = local(x, z, face, 0, 3.4); return [wx, 1.1 + 8.6 + 1.1, wz] as const; })(), 8.9, 2.2, 3.4, face));
  b.add(new THREE.BoxGeometry(0.4, 2.2, 0.3), COL.gold, F(0, 1.1 + 9.6, 5.3), false);
  b.add(new THREE.BoxGeometry(1.8, 0.8, 0.4), COL.gold, F(0, 1.1 + 10.5, 5.3), false);
  b.glow(new THREE.OctahedronGeometry(0.42), COL.rune, F(0, 1.1 + 10.5, 5.55));
  // Roof (verdigris hip roof)
  const roof = new THREE.ConeGeometry(0.707, 1, 4, 1);
  roof.rotateY(Math.PI / 4);
  const [rx, rz] = local(x, z, face, 0, -0.8);
  b.add(roof, COL.copper, MX(rx, 1.1 + 7.8 + 1.7, rz, 15.6, 3.4, 10.2, face));
  // Main gate
  b.add(new THREE.BoxGeometry(3.6, 4.6, 0.4), COL.woodDk, F(0, 1.1 + 2.3, 3.5));
  const arc = new THREE.CylinderGeometry(1.8, 1.8, 0.4, 14, 1, false, -Math.PI / 2, Math.PI);
  arc.rotateX(Math.PI / 2);
  b.add(arc, COL.woodDk, F(0, 1.1 + 4.6, 3.5));
  b.glow(new THREE.BoxGeometry(0.16, 4.8, 0.1), COL.win, F(0, 1.1 + 2.6, 3.72));
  for (const sx of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.9, 1.6, 0.12);
    g.applyMatrix4(F(sx * 4.8, 1.1 + 4.2, 3.5));
    g.translate(0, y, 0);
    windows.push(g);
    banners.add(new THREE.Vector3(...(() => { const [wx, wz] = local(x, z, face, sx * 3.6, 5.2); return [wx, y + 1.1 + 6.8, wz] as const; })()), face, 1.2, 4.2, COL.banner, COL.gold);
  }
  // Two short towers on the flanks
  for (const sx of [-1, 1]) {
    const [tx, tz] = local(x, z, face, sx * 8.8, -1.5);
    const ty = ctx.place(tx, tz, 2);
    b.add(new THREE.CylinderGeometry(2.2, 2.5, 10, 10), COL.stone2, MX(tx, 5, tz, 1, 1, 1));
    b.add(new THREE.CylinderGeometry(2.6, 2.6, 0.6, 10), COL.stoneDk, MX(tx, 10.2, tz, 1, 1, 1));
    b.add(new THREE.ConeGeometry(2.8, 4.2, 10), COL.copper, MX(tx, 12.6, tz, 1, 1, 1));
    const g = new THREE.BoxGeometry(0.5, 0.9, 0.12);
    const [gx, gz] = local(x, z, face, sx * 8.8, 0.72);
    g.applyMatrix4(MX(gx, ty + 7, gz, 1, 1, 1, face));
    windows.push(g);
    ctx.b.lift = y;
  }
  // King's Tower: rises from behind the hall, topped with an amber Source Crystal
  const [tx, tz] = local(x, z, face, 0, -7.2);
  ctx.place(tx, tz, 3);
  b.add(new THREE.CylinderGeometry(3.1, 3.6, 22, 12), COL.stone, MX(tx, 11, tz, 1, 1, 1));
  for (const yy of [6, 12.5, 19]) b.add(new THREE.CylinderGeometry(3.35, 3.35, 0.5, 12), COL.stoneDk, MX(tx, yy, tz, 1, 1, 1), false);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.add(new THREE.BoxGeometry(0.9, 1.0, 0.7), COL.stone2, MX(tx + Math.cos(a) * 3.35, 22.4, tz + Math.sin(a) * 3.35, 1, 1, 1, -a));
    if (i % 3 === 0) {
      const g = new THREE.BoxGeometry(0.55, 1.1, 0.12);
      g.applyMatrix4(MX(tx + Math.cos(a) * 3.28, ctx.b.lift + 15.5, tz + Math.sin(a) * 3.28, 1, 1, 1, -a + Math.PI / 2));
      windows.push(g);
    }
  }
  b.add(new THREE.CylinderGeometry(2.5, 2.9, 3.2, 12), COL.stone2, MX(tx, 23.6, tz, 1, 1, 1));
  b.add(new THREE.SphereGeometry(2.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), COL.copper, MX(tx, 25.1, tz, 1, 1.25, 1));
  b.add(new THREE.CylinderGeometry(0.08, 0.2, 3.4, 6), COL.gold, MX(tx, 29.4, tz, 1, 1, 1), false);
  b.glow(new THREE.OctahedronGeometry(0.75), COL.rune, MX(tx, 31.6, tz, 0.8, 1.5, 0.8));
  banners.add(new THREE.Vector3(tx, ctx.b.lift + 21.6, tz + 3.4), 0, 1.3, 5.2, COL.banner, COL.gold);
  ctx.solids.add(tx, tz, 3.8);
  for (const [lx, lz, rr] of [[0, 0, 6.2], [-5, 0, 5], [5, 0, 5], [-8.8, -1.5, 2.8], [8.8, -1.5, 2.8]] as const) {
    const [sx, sz] = local(x, z, face, lx, lz);
    ctx.solids.add(sx, sz, rr);
  }
}

// ───────────────────────── Dwellings ─────────────────────────

function homes(ctx: FieldCtx, windows: THREE.BufferGeometry[], smokes: Smoke[]): void {
  const [cx, cz] = TOWN;
  // [bearing (degrees, 0 = north, 90 = east), radius, width, depth, height, roof]
  const list: [number, number, number, number, number, 'hip' | 'dome' | 'flat'][] = [
    [62, 23.0, 5.0, 4.4, 4.0, 'dome'],
    [48, 18.5, 5.2, 4.4, 3.8, 'hip'],
    [70, 14.6, 4.6, 4.2, 5.2, 'flat'],
    [118, 16.0, 6.2, 5.0, 4.6, 'hip'],
    [140, 21.0, 5.0, 4.4, 3.8, 'dome'],
    [215, 20.5, 5.0, 4.4, 4.0, 'hip'],
    [236, 15.0, 5.8, 4.8, 5.0, 'dome'],
    [262, 19.5, 5.4, 4.6, 3.8, 'flat'],
    [288, 14.8, 5.0, 4.2, 4.4, 'hip'],
    [305, 21.0, 5.6, 4.6, 4.0, 'dome'],
    [100, 22.5, 4.6, 4.0, 3.6, 'flat'],
    [36, 23.2, 4.4, 4.0, 3.6, 'hip'],
    [252, 23.5, 4.8, 4.2, 3.6, 'hip'],
    [160, 16.5, 4.4, 4.0, 3.8, 'flat'],
  ];
  const walls = [COL.stone, COL.stone2, COL.stone];
  list.forEach(([deg, r, w, d, h, roof], i) => {
    const a = (deg * Math.PI) / 180;
    const x = cx + Math.sin(a) * r;
    const z = cz - Math.cos(a) * r;
    if (ctx.pathDist(x, z) < Math.max(w, d) * 0.55 + 2.8) return;
    if (Math.hypot(x - ctx.layout.waypoint[0], z - ctx.layout.waypoint[1]) < 6) return;
    if (ctx.layout.npcs.some(([nx, nz]) => Math.hypot(x - nx, z - nz) < Math.max(w, d) * 0.6 + 1.5)) return;
    // Door faces the plaza
    const face = Math.atan2(cx - x, cz - z);
    stoneHouse(ctx, x, z, face, w, d, h, roof, windows, smokes, walls[i % 3]);
  });
}

// ───────────────────────── City wall ─────────────────────────

function cityWall(ctx: FieldCtx, banners: Banners): void {
  const { b } = ctx;
  const [cx, cz] = TOWN;
  const R = 26.4;
  const n = 64;
  const towers = [30, 75, 125, 150, 210, 235, 285, 318];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.sin(a) * R;
    const z = cz - Math.cos(a) * R;
    if (z > 93) continue;
    if (ctx.pathDist(x, z) < 4.2) continue;
    if (rampAt(x, z)[0] < 5) continue;
    if (inTerrace(a)) continue;
    const seg = (2 * Math.PI * R) / n;
    const face = a;
    ctx.place(x, z, 1.4);
    const F = frame(x, z, face);
    b.add(new THREE.BoxGeometry(seg + 0.15, 2.8, 1.2), i % 2 ? COL.stone : COL.stone2, F(0, 1.2, 0));
    b.add(new THREE.BoxGeometry(seg + 0.2, 0.3, 1.45), COL.stoneDk, F(0, 2.65, 0), false);
    b.add(new THREE.BoxGeometry(seg * 0.45, 0.65, 0.5), COL.stone2, F(-seg * 0.22, 3.1, 0.42), false);
    ctx.solids.add(x, z, 1.35);
  }
  for (const deg of towers) {
    const a = (deg * Math.PI) / 180;
    const x = cx + Math.sin(a) * (R + 0.3);
    const z = cz - Math.cos(a) * (R + 0.3);
    if (z > 93 || ctx.pathDist(x, z) < 4.5) continue;
    ctx.place(x, z, 2);
    b.add(new THREE.CylinderGeometry(2.0, 2.3, 6.2, 10), COL.stone, MX(x, 2.6, z, 1, 1, 1));
    b.add(new THREE.CylinderGeometry(2.35, 2.35, 0.45, 10), COL.stoneDk, MX(x, 5.8, z, 1, 1, 1), false);
    b.add(new THREE.ConeGeometry(2.6, 3.4, 10), COL.copper, MX(x, 7.7, z, 1, 1, 1));
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 4), COL.iron, MX(x, 10.2, z, 1, 1, 1), false);
    banners.add(new THREE.Vector3(x + Math.sin(a) * 0.1, ctx.b.lift + 11.1, z), a + Math.PI / 2, 0.5, 1.2, COL.banner, COL.gold);
    ctx.solids.add(x, z, 2.4);
  }
}

/**
 * Viewing terrace on the north edge: here the city wall gives way to a low railing, and from it you can see the tortoise's head
 * below, the whole canyon and the distant Seal Tower
 */
const TERRACE: [number, number] = [-15, 31];
function inTerrace(a: number): boolean {
  let d = (a * 180) / Math.PI;
  if (d > 180) d -= 360;
  return d > TERRACE[0] && d < TERRACE[1];
}

function overlook(ctx: FieldCtx, banners: Banners): void {
  const { b } = ctx;
  const [cx, cz] = TOWN;
  const R = 26.2;
  for (let deg = TERRACE[0] + 1.5; deg < TERRACE[1] - 1; deg += 2.6) {
    const a = (deg * Math.PI) / 180;
    const x = cx + Math.sin(a) * R;
    const z = cz - Math.cos(a) * R;
    if (ctx.pathDist(x, z) < 3.6) continue;
    ctx.place(x, z, 0.8);
    const F = frame(x, z, a);
    const seg = (2 * Math.PI * R * 2.6) / 360;
    b.add(new THREE.BoxGeometry(seg + 0.1, 0.25, 0.7), COL.stoneDk, F(0, 0.12, 0));
    b.add(new THREE.BoxGeometry(0.45, 0.85, 0.45), COL.stone, F(-seg / 2, 0.6, 0));
    for (let k = 1; k < 4; k++) b.add(new THREE.CylinderGeometry(0.1, 0.13, 0.62, 6), COL.stone2, F(-seg / 2 + (k * seg) / 4, 0.55, 0), false);
    b.add(new THREE.BoxGeometry(seg + 0.15, 0.18, 0.6), COL.stone, F(0, 0.95, 0), false);
    ctx.solids.add(x, z, 0.75);
  }
  // Two lamp posts, a brass telescope aimed at the Seal Tower, stone seats
  for (const deg of [TERRACE[0] + 4, TERRACE[1] - 4]) {
    const a = (deg * Math.PI) / 180;
    const x = cx + Math.sin(a) * (R - 1.4);
    const z = cz - Math.cos(a) * (R - 1.4);
    if (ctx.pathDist(x, z) < 3.4) continue;
    dwarfLamp(ctx, x, z, 3.0);
    banners.add(new THREE.Vector3(x + Math.sin(a) * 0.2, ctx.h(x, z) + 3.2, z - Math.cos(a) * 0.2), a + Math.PI / 2, 0.6, 1.5, COL.banner, COL.gold);
  }
  const ta = (12 * Math.PI) / 180;
  const tx = cx + Math.sin(ta) * (R - 2.3);
  const tz = cz - Math.cos(ta) * (R - 2.3);
  ctx.place(tx, tz, 0.5);
  const look = Math.atan2(-tx, -78 - tz);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 4), COL.woodDk, MX(tx + Math.cos(a) * 0.3, 0.7, tz + Math.sin(a) * 0.3, 1, 1, 1, 0, Math.sin(a) * 0.22, -Math.cos(a) * 0.22), false);
  }
  b.add(new THREE.CylinderGeometry(0.1, 0.16, 1.3, 8), COL.bronze, MX(tx, 1.55, tz, 1, 1, 1, look, Math.PI / 2 - 0.25));
  b.add(new THREE.TorusGeometry(0.17, 0.04, 4, 10), COL.gold, MX(tx + Math.sin(look) * 0.62, 1.71, tz + Math.cos(look) * 0.62, 1, 1, 1, look), false);
  ctx.solids.add(tx, tz, 0.5);
  const ba = (-4 * Math.PI) / 180;
  const bx = cx + Math.sin(ba) * (R - 2.2);
  const bz = cz - Math.cos(ba) * (R - 2.2);
  if (ctx.pathDist(bx, bz) > 3.2) {
    ctx.place(bx, bz, 1);
    const F = frame(bx, bz, ba);
    b.add(new THREE.BoxGeometry(2.4, 0.2, 0.7), COL.stone, F(0, 0.5, 0));
    for (const s of [-0.9, 0.9]) b.add(new THREE.BoxGeometry(0.3, 0.45, 0.6), COL.stoneDk, F(s, 0.22, 0), false);
    ctx.solids.add(bx, bz, 1.1);
  }
}

// ───────────────────────── North Gate and Royal Stair ─────────────────────────

function northGate(ctx: FieldCtx, banners: Banners): void {
  const { b } = ctx;
  const [cx, cz] = TOWN;
  // The gatehouse is where the stair meets the city wall, with the gate passage running along the road
  const [x0, z0] = [RAMP[0][0], RAMP[0][1]];
  const [x1, z1] = [RAMP[1][0], RAMP[1][1]];
  let gx = x0;
  let gz = z0;
  for (let t = 0; t <= 1; t += 0.02) {
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    gx = x;
    gz = z;
    if (Math.hypot(x - cx, z - cz) > 26.4) break;
  }
  const face = Math.atan2(x1 - x0, z1 - z0);
  const y = ctx.place(gx, gz, 3);
  const F = frame(gx, gz, face);
  for (const s of [-1, 1]) {
    b.add(new THREE.BoxGeometry(3.6, 9.5, 4.6), COL.stone, F(s * 4.8, 4.5, 0));
    b.add(new THREE.BoxGeometry(4.0, 0.5, 5.0), COL.stoneDk, F(s * 4.8, 9.4, 0), false);
    for (const [lx, lz] of [[-1.4, -1.9], [1.4, -1.9], [-1.4, 1.9], [1.4, 1.9]] as const) b.add(new THREE.BoxGeometry(0.8, 0.8, 0.8), COL.stone2, F(s * 4.8 + lx, 10.0, lz), false);
    const roof = new THREE.ConeGeometry(0.707, 1, 4, 1);
    roof.rotateY(Math.PI / 4);
    const [rx, rz] = local(gx, gz, face, s * 4.8, 0);
    b.add(roof, COL.copper, MX(rx, 11.6, rz, 3.4, 2.6, 4.2, face));
    b.add(new THREE.BoxGeometry(4.2, 0.9, 5.2), COL.stoneDk, F(s * 4.8, 0.2, 0));
    const [bx, bz] = local(gx, gz, face, s * 4.8, 2.35);
    banners.add(new THREE.Vector3(bx, y + 8.6, bz), face, 1.5, 4.8, COL.banner, COL.gold);
    ctx.solids.add(...local(gx, gz, face, s * 4.8, 0), 2.9);
  }
  // Arch and passage above the gate opening
  b.add(new THREE.BoxGeometry(6.2, 2.4, 4.2), COL.stone2, F(0, 7.6, 0));
  const arch = new THREE.TorusGeometry(3.0, 0.5, 6, 14, Math.PI);
  b.add(arch, COL.stoneDk, F(0, 5.2, 2.25));
  b.add(arch.clone(), COL.stoneDk, F(0, 5.2, -2.25));
  b.glow(new THREE.OctahedronGeometry(0.5), COL.rune, F(0, 8.2, 2.4));
  // Raised portcullis
  for (let i = 0; i < 6; i++) b.add(new THREE.BoxGeometry(0.1, 1.6, 0.1), COL.iron, F(-2.2 + i * 0.88, 6.3, 0), false);
  b.add(new THREE.BoxGeometry(5.2, 0.14, 0.14), COL.iron, F(0, 5.6, 0), false);
  // Two braziers outside the gate
  const fires: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const [px, pz] = local(gx, gz, face, s * 3.9, 4.2);
    ctx.place(px, pz, 0.5);
    b.add(new THREE.CylinderGeometry(0.18, 0.28, 1.8, 6), COL.iron, MX(px, 0.9, pz, 1, 1, 1));
    b.add(new THREE.CylinderGeometry(0.62, 0.3, 0.5, 8), COL.bronze, MX(px, 2.0, pz, 1, 1, 1));
    const g = new THREE.ConeGeometry(0.45, 1.1, 6);
    g.applyMatrix4(MX(px, ctx.b.lift + 2.75, pz, 1, 1, 1));
    fires.push(g);
    ctx.solids.add(px, pz, 0.5);
  }
  const setFire = glowGroup(ctx.group, ctx.disposers, COL.fire, fires);
  ctx.extras.push((_dt, t) => setFire(1.9 + Math.sin(t * 8.1) * 0.3 + Math.sin(t * 13.7) * 0.15));
}

/**
 * Royal Stair: stone railings and lamp posts on the outer side, stair stones at intervals, and a welcoming arch at the foot of
 * the stair
 */
function royalStair(ctx: FieldCtx, banners: Banners): void {
  const { b } = ctx;
  const pts = RAMP.map(([x, z]) => [x, z] as [number, number]);
  const [cx, cz] = SHELL;
  const samples = along(pts, 1.2);
  samples.forEach((p, i) => {
    if (Math.hypot(p.x - cx, p.z - cz) < 27.5) return;
    const nx = Math.cos(p.a);
    const nz = -Math.sin(p.a);
    const [, rh] = rampAt(p.x, p.z);
    // Stair stones (a pale stone strip lying flat on the slope)
    if (i % 2 === 0) {
      b.lift = 0;
      b.add(new THREE.BoxGeometry(6.2, 0.12, 0.4), COL.stone2, MX(p.x, ctx.h(p.x, p.z) + 0.04, p.z, 1, 1, 1, p.a), false);
    }
    // Railing on the outer side (the side away from the tortoise shell)
    for (const s of [-1, 1]) {
      const ox = p.x + nx * s * 3.35;
      const oz = p.z + nz * s * 3.35;
      const inner = Math.hypot(ox - cx, oz - cz) < Math.hypot(p.x - cx, p.z - cz);
      if (inner) continue;
      b.lift = 0;
      const gy = Math.max(ctx.h(ox, oz), rh - 0.2);
      b.add(new THREE.BoxGeometry(0.5, 0.95, 1.25), COL.stone, MX(ox, gy + 0.45, oz, 1, 1, 1, p.a));
      b.add(new THREE.BoxGeometry(0.62, 0.16, 1.3), COL.stoneDk, MX(ox, gy + 0.98, oz, 1, 1, 1, p.a), false);
      ctx.solids.add(ox, oz, 0.55);
      if (i % 8 === 4) dwarfLampAt(ctx, ox + nx * s * 0.1, oz + nz * s * 0.1, gy + 1.0);
    }
  });
  // Arch at the foot of the stair
  const end = RAMP[RAMP.length - 2];
  const next = RAMP[RAMP.length - 1];
  const face = Math.atan2(next[0] - end[0], next[1] - end[1]);
  const ax = end[0] + (next[0] - end[0]) * 0.55;
  const az = end[1] + (next[1] - end[1]) * 0.55;
  const y = ctx.place(ax, az, 3);
  const F = frame(ax, az, face);
  for (const s of [-1, 1]) {
    b.add(new THREE.BoxGeometry(1.6, 7.2, 1.6), COL.stone, F(s * 4.2, 3.6, 0));
    b.add(new THREE.BoxGeometry(2.0, 0.6, 2.0), COL.stoneDk, F(s * 4.2, 0.3, 0));
    b.add(new THREE.BoxGeometry(2.0, 0.5, 2.0), COL.stoneDk, F(s * 4.2, 7.3, 0), false);
    ctx.solids.add(...local(ax, az, face, s * 4.2, 0), 1.2);
  }
  b.add(new THREE.BoxGeometry(10.4, 1.4, 1.8), COL.stone2, F(0, 8.2, 0));
  b.add(new THREE.BoxGeometry(6.4, 0.9, 1.5), COL.stone, F(0, 9.3, 0));
  b.add(new THREE.BoxGeometry(1.2, 0.5, 0.3), COL.gold, F(0, 8.2, 0.95), false);
  b.glow(new THREE.OctahedronGeometry(0.4), COL.rune, F(0, 9.3, 0.9));
  for (const s of [-1, 1]) {
    const [bx, bz] = local(ax, az, face, s * 3.0, 0.95);
    banners.add(new THREE.Vector3(bx, y + 7.5, bz), face, 1.0, 3.2, COL.banner, COL.gold);
  }
}

function dwarfLampAt(ctx: FieldCtx, x: number, z: number, y: number): void {
  const { b } = ctx;
  b.lift = y;
  b.add(new THREE.CylinderGeometry(0.08, 0.11, 2.2, 6), COL.iron, MX(x, 1.1, z, 1, 1, 1));
  b.glow(new THREE.BoxGeometry(0.32, 0.4, 0.32), COL.win, MX(x, 2.4, z, 1, 1, 1));
  b.add(new THREE.ConeGeometry(0.4, 0.32, 4), COL.iron, MX(x, 2.75, z, 1, 1, 1, Math.PI / 4), false);
}

// ───────────────────────── Lift ─────────────────────────

/**
 * The lift on the east side of the shell: a timber frame tower, a pulley and jib on top, and a platform carrying a mine cart
 * going up and down
 */
function lift(ctx: FieldCtx, banners: Banners): void {
  const { b } = ctx;
  const [x, z] = SPOT.lift;
  const face = Math.PI / 2;
  const y0 = ctx.place(x, z, 2.5);
  const topY = 12.3;
  const H = topY + 6;
  const F = frame(x, z, face);
  for (const lx of [-1.8, 1.8]) {
    for (const lz of [-1.8, 1.8]) b.add(new THREE.BoxGeometry(0.35, H, 0.35), COL.wood, F(lx, H / 2, lz));
  }
  for (let yy = 2; yy < H; yy += 3.2) {
    for (const lz of [-1.8, 1.8]) b.add(new THREE.BoxGeometry(3.9, 0.22, 0.22), COL.woodDk, F(0, yy, lz), false);
    for (const lx of [-1.8, 1.8]) b.add(new THREE.BoxGeometry(0.22, 0.22, 3.9), COL.woodDk, F(lx, yy, 0), false);
    for (const lz of [-1.8, 1.8]) b.add(new THREE.BoxGeometry(0.14, 4.4, 0.14), COL.woodDk, F(0, yy + 1.6, lz, 0, 1, 0, lz > 0 ? 0.78 : -0.78), false);
  }
  b.add(new THREE.BoxGeometry(4.6, 0.4, 4.6), COL.woodDk, F(0, H + 0.2, 0));
  b.add(new THREE.BoxGeometry(0.3, 0.3, 6.5), COL.wood, F(0, H + 0.6, -2.2));
  // Upper platform and gangway, connecting to the city wall's east gate
  b.add(new THREE.BoxGeometry(4.6, 0.3, 3.0), COL.wood, F(0, topY - 0.15, -3.2));
  // Landing at the bottom and the buffer posts at the end of the rails
  b.add(new THREE.BoxGeometry(5.2, 0.35, 5.2), COL.woodDk, F(0, 0.15, 0));
  for (const lx of [-0.6, 0.6]) b.add(new THREE.BoxGeometry(0.3, 0.8, 0.3), COL.bannerDk, F(lx, 0.4, 3.2));
  banners.add(new THREE.Vector3(...(() => { const [wx, wz] = local(x, z, face, 0, 2.0); return [wx, y0 + H - 0.4, wz] as const; })()), face, 1.2, 3.0, COL.banner, COL.gold);
  for (const lx of [-1.8, 1.8]) for (const lz of [-1.8, 1.8]) ctx.solids.add(...local(x, z, face, lx, lz), 0.4);
  ctx.solids.add(x, z, 1.5);

  // Pulley (spins) and platform (moves up and down)
  const wheel = dynMesh(ctx, new THREE.TorusGeometry(1.0, 0.16, 6, 14), COL.iron);
  const spokes = dynMesh(ctx, new THREE.BoxGeometry(2.0, 0.14, 0.14), COL.woodDk, false);
  wheel.add(spokes);
  const spokes2 = spokes.clone();
  spokes2.rotation.z = Math.PI / 2;
  wheel.add(spokes2);
  const [wx, wz] = local(x, z, face, 0, 0);
  wheel.position.set(wx, y0 + H + 1.3, wz);
  wheel.rotation.y = face;
  ctx.group.add(wheel);
  const plat = new THREE.Group();
  const deck = dynMesh(ctx, new THREE.BoxGeometry(3.2, 0.25, 3.2), COL.wood);
  plat.add(deck);
  const cart = dynMesh(ctx, new THREE.BoxGeometry(1.6, 0.9, 1.1), COL.iron);
  cart.position.y = 0.6;
  plat.add(cart);
  const ore = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), glowMat(ctx, COL.cyan));
  ore.position.set(0.25, 1.2, 0);
  plat.add(ore);
  const ore2 = ore.clone();
  ore2.position.set(-0.3, 1.15, 0.15);
  plat.add(ore2);
  const ropeM = dynMesh(ctx, new THREE.CylinderGeometry(0.035, 0.035, 1, 4), 0x3a3030, false);
  ropeM.position.set(wx, 0, wz);
  ctx.group.add(ropeM);
  plat.position.set(wx, y0 + 0.4, wz);
  plat.rotation.y = face;
  ctx.group.add(plat);
  ctx.extras.push((dt, t) => {
    // Rises slowly, pauses, then lowers again
    const cyc = (t % 26) / 26;
    const k = cyc < 0.1 ? 0 : cyc < 0.45 ? (cyc - 0.1) / 0.35 : cyc < 0.6 ? 1 : cyc < 0.95 ? 1 - (cyc - 0.6) / 0.35 : 0;
    const e = k * k * (3 - 2 * k);
    const py = y0 + 0.4 + (topY - 0.4) * e;
    plat.position.y = py;
    const moving = (cyc > 0.1 && cyc < 0.45) || (cyc > 0.6 && cyc < 0.95);
    if (moving) wheel.rotation.z += dt * (cyc < 0.5 ? -1.2 : 1.2);
    const top = y0 + H + 1.3;
    ropeM.position.y = (py + 1.3 + top) / 2;
    ropeM.scale.y = Math.max(0.1, top - py - 1.3);
  });
}
