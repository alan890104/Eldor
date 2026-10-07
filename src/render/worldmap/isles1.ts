// Islands of the world map (part 1): Star Gate City, Whispering Forest, Tidesong Isles, Emberspine Volcanic Belt, Skyhowl Highlands. The design notes are in the header of worldmap/index.ts.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { islandBody, M, MapBatch, Outline, slab, smooth, type BodySpec } from './kit.ts';
import { along, house, palm, pine, placeTower, rock, tree, type IsleCtx, type RegionDef } from './props.ts';

const C = (h: number) => new THREE.Color(h);
const tmp = new THREE.Color();
const mixTo = (out: THREE.Color, h: number, t: number) => out.lerp(tmp.set(h), Math.min(1, Math.max(0, t)));
const dist = (x: number, z: number, cx: number, cz: number) => Math.hypot(x - cx, z - cz);
/** Distance from a point to a polyline */
export function lineDist(x: number, z: number, pts: [number, number][]): number {
  let best = 99;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
const wob = (x: number, z: number, s = 0) => Math.sin(x * 2.3 + s) * Math.cos(z * 1.9 - s * 0.6) * 0.6 + Math.sin(x * 5.1 - z * 4.3 + s * 2) * 0.4;

/** Find a random position that satisfies a condition (up to 40 tries) */
export function spot(ctx: IsleCtx, margin: number, ok: (x: number, z: number) => boolean): [number, number] | null {
  const R = 3;
  for (let i = 0; i < 40; i++) {
    const x = (ctx.r() * 2 - 1) * R;
    const z = (ctx.r() * 2 - 1) * R;
    if (ctx.inside(x, z, margin) && ok(x, z)) return [x, z];
  }
  return null;
}

/** Platform (plateau, rock pillar): placed on the ground with its height registered, so props placed on it later stand on top automatically */
export function platform(ctx: IsleCtx, x: number, z: number, o: Outline, y1: number, top: number | ((x: number, z: number) => number), side: number[], opts: Parameters<typeof slab>[5] = {}): void {
  let y0 = 9;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const r = o.rAt(a);
    y0 = Math.min(y0, ctx.y(x + Math.cos(a) * r, z + Math.sin(a) * r), ctx.y(x + Math.cos(a) * r * 0.5, z + Math.sin(a) * r * 0.5));
  }
  const topFn = typeof top === 'number' ? top : (lx: number, lz: number) => top(lx + x, lz + z);
  ctx.b.addVC(slab(o, y0 - 0.12, y1, topFn, side, opts), M(x, 0, z));
  ctx.plat(o, x, z, y1);
  ctx.foot(x + 0.06, z + 0.05, o.R * 1.25, 0.3);
}

/** A flat ribbon hugging a series of points (lava, stream, road), the points already include height; up is the normal direction of the ribbon's face */
export function ribbon(pts: THREE.Vector3[], w: number, up = new THREE.Vector3(0, 1, 0), fixedSide?: THREE.Vector3): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const t = new THREE.Vector3().subVectors(b, a).normalize();
    const side = fixedSide ? fixedSide.clone().normalize() : new THREE.Vector3().crossVectors(t, up);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize().multiplyScalar(w / 2);
    const ww = i === 0 || i === pts.length - 1 ? 0.6 : 1;
    pos.push(pts[i].x - side.x * ww, pts[i].y - side.y * ww, pts[i].z - side.z * ww, pts[i].x + side.x * ww, pts[i].y + side.y * ww, pts[i].z + side.z * ww);
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k + 1, k - 2, k + 1, k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // The ribbon must be visible from both sides: layer a reversed copy on top
  const back = g.clone();
  const bi = back.index!.array as Uint16Array | Uint32Array;
  for (let i = 0; i < bi.length; i += 3) [bi[i + 1], bi[i + 2]] = [bi[i + 2], bi[i + 1]];
  back.computeVertexNormals();
  const m = mergeGeometries([g.toNonIndexed(), back.toNonIndexed()])!;
  g.dispose();
  back.dispose();
  return m;
}

/** Flat water surface (following a contour) */
export function pool(o: Outline, seg = 28): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const r = o.rAt(a);
    // Shape is in the xy plane; rotating it to xz maps y → -z
    if (i === 0) s.moveTo(Math.cos(a) * r, -Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, -Math.sin(a) * r);
  }
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  return g;
}

// ───────────────────────── Star Gate City ─────────────────────────

const H_STONE = 0xe8e2f6;
const H_STONE2 = 0xd2c8e8;
const H_DARK = 0x9a88c4;
const H_ROOF = [0x6a4ab0, 0x4e3a92, 0x7a5ac0];
const GEMS = [0x3db7ff, 0xff6a2b, 0x5fcb5a, 0x9fe8e0, 0xc49a5a, 0xc8a0ff, 0xffe680, 0x9a5aff];

const hubOutline = new Outline(2.7, [[3, 0.025, 0.3], [5, 0.02, 1.1], [7, 0.012, 2]]);
export const HUB: RegionDef = {
  look: { ambient: 0xb4acd8, shadow: 0x6a5aa8, rim: 0xfff4e0 },
  body: {
    outline: hubOutline,
    h: (x, z) => 0.04 * Math.cos(Math.hypot(x, z) * 1.1),
    paint: (x, z, _y, out) => {
      const rho = hubOutline.rho(x, z);
      const d = Math.hypot(x, z);
      if (rho < 0.62) {
        out.set(Math.floor(d * 5.5) % 2 ? 0xc8bce0 : 0xbcaed8);
        // Walkway to the Star Gate and the avenue to the south
        if (Math.abs(x) < 0.16) out.set(0xd8cff0);
      } else if (rho < 0.7) out.set(0xa89ccc);
      else {
        out.set(0x9cc48a);
        mixTo(out, 0x7fae74, 0.5 + 0.5 * wob(x, z, 3));
        if (Math.abs(x) < 0.16 && z > 0) out.set(0xcfc4e6);
      }
    },
    strata: [0xbcb2d6, 0x9e92c0, 0xcac0de, 0x8a7eac],
    depth: 3.3,
    seed: 3,
  },
  build(ctx) {
    const { b, r, g } = ctx;
    const GZ = -0.7;
    // Star Gate: a four-tier round platform, a standing stone ring (eight source crystals), a rotating inner ring and a starry vortex
    [0.8, 0.68, 0.56, 0.44].forEach((rr, i) => b.add(new THREE.CylinderGeometry(rr, rr + 0.02, 0.07, 28), i % 2 ? H_STONE2 : H_STONE, M(0, 0.06 + i * 0.07, GZ)));
    const base = 0.31;
    const R = 0.74;
    const CY = base + R + 0.12;
    b.add(new THREE.BoxGeometry(0.8, 0.12, 0.26), H_DARK, M(0, base + 0.04, GZ));
    b.heavy = true;
    b.add(new THREE.TorusGeometry(R, 0.1, 10, 48), 0xf4f0fc, M(0, CY, GZ));
    b.heavy = false;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 2;
      b.add(new THREE.CylinderGeometry(0.095, 0.095, 0.07, 8), H_DARK, M(Math.cos(a) * R, CY + Math.sin(a) * R, GZ + 0.06, 0, 1, Math.PI / 2));
      b.glow(new THREE.OctahedronGeometry(0.065), GEMS[i], M(Math.cos(a) * R, CY + Math.sin(a) * R, GZ + 0.11));
    }
    for (const s of [-1, 1]) {
      b.add(new THREE.CylinderGeometry(0.06, 0.07, 0.42, 8), H_STONE, M(s * 0.66, base + 0.18, GZ + 0.14));
      b.glow(new THREE.OctahedronGeometry(0.045), 0x8ab8ff, M(s * 0.66, base + 0.45, GZ + 0.14));
    }
    const inner = ctx.mesh(new THREE.TorusGeometry(R - 0.13, 0.04, 6, 40), H_STONE2, true);
    inner.position.set(0, CY, GZ + 0.03);
    const swirl = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; varying vec2 vUv;
        void main(){
          vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
          float arm = sin(a * 3.0 + r * 9.0 - uTime * 1.6) * 0.5 + 0.5;
          vec3 c = mix(vec3(0.1, 0.12, 0.42), vec3(0.4, 0.58, 1.0), arm * (1.0 - r * 0.5));
          c += vec3(0.75, 0.85, 1.0) * smoothstep(0.3, 0.0, r) * 0.7;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const portal = new THREE.Mesh(new THREE.CircleGeometry(R - 0.09, 40), swirl);
    portal.position.set(0, CY, GZ - 0.01);
    g.add(portal);
    ctx.anim.push((dt, t) => {
      inner.rotation.z += dt * 0.35;
      swirl.uniforms.uTime.value = t;
    });
    ctx.foot(0, GZ, 0.95, 0.25);
    // Fountain plaza
    b.add(new THREE.CylinderGeometry(0.26, 0.28, 0.06, 20), H_STONE2, M(0, 0.06, 0.62));
    b.add(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 20), 0x7ac8f0, M(0, 0.09, 0.62), false);
    b.add(new THREE.CylinderGeometry(0.035, 0.05, 0.2, 8), H_STONE, M(0, 0.16, 0.62));
    b.add(new THREE.SphereGeometry(0.06, 10, 6), H_STONE, M(0, 0.28, 0.62));
    // Ring-shaped city: houses face the plaza, with the avenue left open to the south
    const N = 13;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.2;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.3) continue;
      const rr = 1.72 + (i % 2) * 0.22;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      const w = 0.22 + r() * 0.08;
      const h = 0.18 + r() * 0.1 + (i % 3 === 0 ? 0.08 : 0);
      house(ctx, x, z, Math.atan2(-x, -z), w, 0.2, h, i % 2 ? H_STONE : 0xf0ebf8, H_ROOF[i % 3], i % 3 === 1 ? 'hip' : 'gable');
    }
    // Two academy towers
    for (const s of [-1, 1]) {
      const x = s * 1.05;
      const z = -1.2;
      b.add(new THREE.CylinderGeometry(0.09, 0.11, 0.62, 10), H_STONE, M(x, 0.31, z));
      b.add(new THREE.ConeGeometry(0.13, 0.26, 10), H_ROOF[1], M(x, 0.75, z));
      b.glow(new THREE.BoxGeometry(0.04, 0.06, 0.01), 0xffc870, M(x, 0.45, z + 0.105));
      ctx.foot(x, z, 0.25, 0.3);
    }
    // Trees and street lamps
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.1;
      const rr = 2.3 + r() * 0.15;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      if (Math.abs(x) < 0.3 && z > 0) continue;
      if (ctx.inside(x, z, 0.12)) tree(ctx, x, z, 0.7 + r() * 0.2, i % 2 ? [0x9a7ad8, 0xb090ec] : [0x6fae62, 0x86c070]);
    }
    for (const z of [1.05, 1.45, 1.85, 2.25]) {
      for (const s of [-1, 1]) {
        b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 4), 0x3a3050, M(s * 0.22, 0.09, z), false);
        b.glow(new THREE.SphereGeometry(0.024, 6, 4), 0xffc870, M(s * 0.22, 0.17, z));
      }
    }
  },
};

// ───────────────────────── Whispering Forest ─────────────────────────

const forestOutline = new Outline(2.5, [[2, 0.07, 0.4], [3, 0.06, 1.9], [5, 0.035, 0.7]]);
const F_LAKE: [number, number] = [1.2, 0.55];
const F_TRAIL: [number, number][] = [[0.05, 2.5], [-0.2, 1.8], [-0.45, 0.95], [-0.55, 0.2], [-0.2, -0.35], [0.35, -0.55], [0.62, -0.62]];
const F_RING: [number, number] = [0.25, 1.25];
const F_PLAT: [number, number] = [0.9, -1.15];
const lakeOutline = new Outline(0.5, [[2, 0.12, 0.3], [3, 0.08, 1]]);

export const FOREST: RegionDef = {
  look: { ambient: 0xa8c2a8, shadow: 0x3c5a5c, rim: 0xfff0c8 },
  body: {
    outline: forestOutline,
    h: (x, z) => 0.12 * Math.sin(x * 1.4 + 0.3) * Math.cos(z * 1.2 + 0.8) + 0.04 * Math.sin(x * 3.1 - z * 2.3) - 0.16 * smooth(0.62, 0.3, dist(x, z, ...F_LAKE)),
    paint: (x, z, _y, out) => {
      out.set(0x6aae48);
      mixTo(out, 0x4f9440, 0.5 + 0.5 * wob(x, z));
      // Wildflower slope (the south side is brighter)
      mixTo(out, 0x92cc58, smooth(0.6, 1.8, z) * 0.7);
      const dl = dist(x, z, ...F_LAKE);
      mixTo(out, 0xb3ad90, smooth(0.72, 0.52, dl));
      const dr = dist(x, z, ...F_RING);
      mixTo(out, 0x2f6c58, smooth(0.42, 0.2, dr));
      mixTo(out, 0x62b890, smooth(0.07, 0.0, Math.abs(dr - 0.33)) * 0.6);
      mixTo(out, 0xc9a672, smooth(0.09, 0.05, lineDist(x, z, F_TRAIL)));
    },
    strata: [0x7a5e44, 0x8a7258, 0x6a5440, 0x9a8a70],
    depth: 3.1,
    seed: 1,
  },
  build(ctx) {
    const { b, r } = ctx;
    // Plateau with ancient steps guarded by owls, with the Seal Tower on top
    platform(ctx, ...F_PLAT, new Outline(0.62, [[3, 0.08, 0.5], [2, 0.06, 1]]), 0.44, 0x6aa84a, [0x9e9884, 0x8a8472, 0x77705f], { seed: 2 });
    for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(0.2, 0.06, 0.1), 0xa8a28c, M(0.62 + i * 0.06, 0.1 + i * 0.12, -0.52 - i * 0.1, -0.5));
    placeTower(ctx, F_PLAT[0] + 0.05, F_PLAT[1] - 0.05, { stone: 0xd6d2bc, stoneDark: 0x8a8672, trim: 0x6e8e4a, roof: 0x3f7a4c, glow: 0x7aff9a, kind: 'pagoda' }, 0.62);
    // Thousand-year Mother Tree: a thick trunk, spread roots, a root arch spanning the path, layers of canopy
    const TX = -0.6;
    const TZ = -0.3;
    const ty = ctx.y(TX, TZ);
    b.heavy = true;
    b.add(new THREE.CylinderGeometry(0.17, 0.26, 1.2, 10), 0x6a4a32, M(TX, ty + 0.56, TZ));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const root = new THREE.ConeGeometry(0.09, 0.55, 6);
      b.add(root, 0x5e412c, along(new THREE.Vector3(TX + Math.cos(a) * 0.48, ty - 0.03, TZ + Math.sin(a) * 0.48), new THREE.Vector3(TX + Math.cos(a) * 0.06, ty + 0.38, TZ + Math.sin(a) * 0.06)));
    }
    b.add(new THREE.TorusGeometry(0.26, 0.07, 6, 12, Math.PI), 0x5e412c, M(TX + 0.06, ty - 0.02, TZ + 0.56, 0.25));
    const leaves: [number, number, number, number, number][] = [
      [0, 1.36, 0, 0.58, 0x3f8a3a],
      [-0.48, 1.18, 0.1, 0.42, 0x3d7a36],
      [0.48, 1.2, 0.02, 0.43, 0x4a9040],
      [0.05, 1.24, -0.45, 0.43, 0x3d7a36],
      [0.2, 1.3, 0.4, 0.36, 0x4f9a40],
      [-0.08, 1.78, -0.02, 0.4, 0x7cc454],
      [0.3, 1.62, 0.12, 0.26, 0x8ccf58],
    ];
    for (const [x, y, z, s, col] of leaves) b.add(new THREE.IcosahedronGeometry(s, 1), col, M(TX + x, ty + y, TZ + z, r() * 3));
    b.heavy = false;
    ctx.foot(TX + 0.12, TZ + 0.1, 0.95, 0.5);
    // Glowfungus hollow: a ring of small glowing mushrooms with a giant umbrella mushroom in the middle
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const x = F_RING[0] + Math.cos(a) * 0.33;
      const z = F_RING[1] + Math.sin(a) * 0.33 * 0.9;
      const y = ctx.y(x, z);
      b.add(new THREE.CylinderGeometry(0.014, 0.018, 0.07, 5), 0xf0ead8, M(x, y + 0.035, z), false);
      b.glow(new THREE.SphereGeometry(0.04, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0x62f0b4, M(x, y + 0.06, z, 0, 1, 0, 0));
    }
    {
      const [x, z] = F_RING;
      const y = ctx.y(x, z);
      b.add(new THREE.CylinderGeometry(0.035, 0.05, 0.24, 8), 0xece4d0, M(x, y + 0.12, z));
      b.add(new THREE.SphereGeometry(0.16, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x3fae8a, M(x, y + 0.2, z, 0, 1));
      b.glow(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 14), 0x8affd0, M(x, y + 0.195, z));
    }
    // Mirror lake
    b.add(pool(lakeOutline), 0x62bcd0, M(F_LAKE[0], -0.035, F_LAKE[1]), false);
    // Treetalk Village: two round houses
    house(ctx, -1.35, 0.85, 0.3, 0.2, 0.2, 0.15, 0x9a7050, 0x6e8e4a, 'cone');
    house(ctx, -1.05, 1.18, -0.2, 0.17, 0.17, 0.13, 0xa87a58, 0x5a8a44, 'cone');
    // Trees: avoid the landmark, the lake, the fungus ring and the path
    const greens = [[0x4f9a40, 0x5fae48, 0x3f8a3a], [0x6cb84e, 0x4f9a40], [0x3d7a36, 0x4a9040]];
    for (let i = 0; i < 20; i++) {
      const p = spot(ctx, 0.18, (x, z) => dist(x, z, TX, TZ) > 0.95 && dist(x, z, ...F_PLAT) > 0.78 && dist(x, z, ...F_LAKE) > 0.66 && dist(x, z, ...F_RING) > 0.5 && lineDist(x, z, F_TRAIL) > 0.2 && dist(x, z, -1.2, 1.0) > 0.35);
      if (!p) continue;
      if (i % 5 === 4) pine(ctx, p[0], p[1], 0.9 + r() * 0.3, 0x2f6e3e);
      else tree(ctx, p[0], p[1], 0.8 + r() * 0.35, greens[i % 3]);
    }
    for (let i = 0; i < 4; i++) {
      const p = spot(ctx, 0.2, (x, z) => dist(x, z, ...F_LAKE) > 0.6 && lineDist(x, z, F_TRAIL) > 0.15);
      if (p) rock(ctx, p[0], p[1], 0.8, 0x9e9884);
    }
    // Roots hanging from the underside of the island
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const rr = forestOutline.rAt(a) * 0.56;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      const len = 0.7 + r() * 0.5;
      const root = new THREE.ConeGeometry(0.04, len, 5);
      root.rotateX(Math.PI);
      b.add(root, 0x5a4030, M(x, -1.75 - len / 2, z), false);
    }
  },
};

// ───────────────────────── Tidesong Isles ─────────────────────────

const islesOutline = new Outline(2.5, [[2, 0.09, 1.2], [3, 0.07, 0.2], [4, 0.045, 2.2]]);
const I_LAGOON: [number, number] = [-0.15, 0.4];
const I_LIGHT: [number, number] = [1.5, 0.25];
const iceLine = (x: number) => -0.95 + 0.14 * Math.sin(x * 2.2 + 0.5);
const lagoonOutline = new Outline(0.66, [[2, 0.14, 0.6], [3, 0.08, 2]]);

export const ISLES: RegionDef = {
  look: { ambient: 0xaccae4, shadow: 0x4a6a9a, rim: 0xffffff },
  side: 1,
  body: {
    outline: islesOutline,
    h: (x, z) => 0.03 + 0.03 * wob(x, z, 2) + 0.34 * smooth(0.8, 0.12, dist(x, z, ...I_LIGHT)) + 0.1 * smooth(0, -0.5, z - iceLine(x)) - 0.2 * smooth(0.82, 0.4, dist(x, z, ...I_LAGOON)),
    paint: (x, z, _y, out) => {
      const rho = islesOutline.rho(x, z);
      out.set(0x7ccc5e);
      mixTo(out, 0x55ad50, 0.5 + 0.5 * wob(x, z, 1));
      const dl = dist(x, z, ...I_LAGOON);
      mixTo(out, 0xf5e5b6, Math.max(smooth(0.95, 0.72, dl), smooth(0.82, 0.93, rho) * smooth(-0.2, 0.3, z)));
      const ice = smooth(0.08, -0.08, z - iceLine(x));
      mixTo(out, 0x9cc49a, smooth(0.35, 0.05, z - iceLine(x)) * 0.8);
      mixTo(out, 0xeef6fa, ice);
      mixTo(out, 0xcfe6f4, ice * (0.5 + 0.5 * wob(x, z, 5)) * 0.6);
    },
    strata: [0x8f9cac, 0xa7b2bf, 0x7d8a9c, 0xb8c2cc],
    depth: 2.9,
    seed: 2,
  },
  build(ctx) {
    const { b, r, g } = ctx;
    // Inner bay water, a wooden boardwalk and small boats
    b.add(pool(lagoonOutline), 0x3cc4d8, M(I_LAGOON[0], -0.06, I_LAGOON[1]), false);
    b.add(pool(new Outline(0.5, [[2, 0.14, 0.6], [3, 0.08, 2]])), 0x2aa8c8, M(I_LAGOON[0] + 0.02, -0.055, I_LAGOON[1] - 0.02), false);
    for (let i = 0; i < 5; i++) b.add(new THREE.BoxGeometry(0.1, 0.02, 0.05), 0xb48656, M(-0.78 + i * 0.1, 0.0, 0.62 - i * 0.02, -0.2));
    b.add(new THREE.BoxGeometry(0.16, 0.05, 0.07), 0x2f6aa8, M(-0.02, -0.03, 0.2, 0.4));
    b.add(new THREE.ConeGeometry(0.05, 0.14, 3), 0xf8f4ea, M(-0.02, 0.07, 0.2, 0.4), true);
    // Lighthouse harbor: small houses with white walls, blue roofs and terracotta roofs, and a chapel with a blue dome
    const HOUSES: [number, number, number, number][] = [
      [-1.25, 0.95, 0.2, 0x2f7ab8],
      [-1.0, 1.3, -0.3, 0xc0503a],
      [-1.5, 0.55, 0.5, 0x2a9a8a],
      [-0.72, 1.55, 0.1, 0x2f7ab8],
      [-1.35, 1.38, 0.8, 0xf3e6cf],
    ];
    HOUSES.forEach(([x, z, ry, roof], i) => house(ctx, x, z, ry, 0.2, 0.17, 0.15 + (i % 2) * 0.04, i % 2 ? 0xeef4f4 : 0xf7f2e8, roof, i === 4 ? 'flat' : 'gable'));
    house(ctx, -1.72, 0.95, 0, 0.18, 0.18, 0.2, 0xf7f2e8, 0x2f7ab8, 'dome');
    // Lighthouse: a red-and-white striped body, the lantern room turns out two beams of light
    const [LX, LZ] = I_LIGHT;
    const ly = ctx.y(LX, LZ);
    const LS = 1.35;
    b.heavy = true;
    b.add(new THREE.CylinderGeometry(0.13 * LS, 0.15 * LS, 0.08, 12), 0xb8ae9a, M(LX, ly + 0.02, LZ));
    for (let i = 0; i < 4; i++) {
      const r0 = (0.1 - i * 0.008) * LS;
      b.add(new THREE.CylinderGeometry(r0 - 0.008 * LS, r0, 0.15 * LS, 12), i % 2 ? 0xd8553f : 0xf6f2ea, M(LX, ly + 0.06 + (0.075 + i * 0.15) * LS, LZ));
    }
    b.add(new THREE.CylinderGeometry(0.1 * LS, 0.1 * LS, 0.03, 12), 0x3a4050, M(LX, ly + 0.06 + 0.61 * LS, LZ));
    b.add(new THREE.ConeGeometry(0.08 * LS, 0.11 * LS, 12), 0xd8553f, M(LX, ly + 0.06 + 0.77 * LS, LZ));
    b.heavy = false;
    b.glow(new THREE.CylinderGeometry(0.058 * LS, 0.058 * LS, 0.09 * LS, 10), 0xfff2b0, M(LX, ly + 0.06 + 0.67 * LS, LZ));
    house(ctx, LX - 0.28, LZ + 0.18, 0.4, 0.16, 0.13, 0.11, 0xf4efe4, 0xa84a2c, 'gable');
    const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0b0).multiplyScalar(ctx.def.locked ? 0.05 : 0.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
    const beams = new THREE.Group();
    for (const s of [-1, 1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 12, 1, true), beamMat);
      cone.rotation.z = (s * Math.PI) / 2;
      cone.position.x = s * 0.31;
      beams.add(cone);
    }
    beams.position.set(LX, ly + 0.06 + 0.67 * LS, LZ);
    g.add(beams);
    ctx.anim.push((dt) => (beams.rotation.y += dt * 0.8));
    ctx.foot(LX, LZ, 0.3, 0.35);
    // Palms
    for (const [x, z, lean] of [[0.62, 1.15, 0.8], [0.95, 0.85, 0.2], [-0.35, 1.55, 2.2], [0.3, 1.6, 1.2]]) palm(ctx, x, z, 1, lean);
    // Northern ice field: a Seal Tower half frozen in ice, ice pillars and floes
    const TX = -0.3;
    const TZ = -1.55;
    placeTower(ctx, TX, TZ, { stone: 0xe6eef4, stoneDark: 0x86a2ba, trim: 0x2f6eaa, roof: 0x2a5f92, glow: 0x6ad8ff, kind: 'spire' }, 0.62);
    const ty = ctx.y(TX, TZ);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const sh = new THREE.OctahedronGeometry(0.1, 0);
      sh.scale(0.8, 2.4 + (i % 3) * 0.6, 0.8);
      b.add(sh, i % 2 ? 0xbfe8f8 : 0xdaf2fc, M(TX + Math.cos(a) * 0.24, ty + 0.14, TZ + Math.sin(a) * 0.2, a, 1, Math.sin(a) * 0.35, -Math.cos(a) * 0.35));
    }
    for (let i = 0; i < 9; i++) {
      const p = spot(ctx, 0.2, (x, z) => z < iceLine(x) - 0.12 && dist(x, z, TX, TZ) > 0.45);
      if (!p) continue;
      const sh = new THREE.OctahedronGeometry(0.07 + r() * 0.05, 0);
      sh.scale(1, 1.8 + r() * 1.2, 1);
      b.add(sh, r() < 0.5 ? 0xbfe8f8 : 0xe4f6fc, M(p[0], ctx.y(p[0], p[1]) + 0.07, p[1], r() * 3, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
      ctx.foot(p[0], p[1], 0.14, 0.2);
    }
    for (let i = 0; i < 5; i++) {
      const p = spot(ctx, 0.25, (x, z) => z > iceLine(x) + 0.2 && dist(x, z, ...I_LAGOON) > 0.9 && dist(x, z, ...I_LIGHT) > 0.4 && dist(x, z, -1.2, 1.0) > 0.6);
      if (p) tree(ctx, p[0], p[1], 0.75, [0x4fae52, 0x62c05a]);
    }
  },
};

// ───────────────────────── Emberspine Volcanic Belt ─────────────────────────

const volcanoOutline = new Outline(2.5, [[3, 0.09, 0.8], [5, 0.05, 2.1], [7, 0.03, 0.4]]);
const V_CONE: [number, number] = [-0.55, -0.72];
const V_CITY: [number, number] = [-0.95, 1.05];
const V_MESA: [number, number] = [1.0, -0.72];
/** Lava river: volcano foot → stone bridge → falling off the southeast cliff edge */
const V_RIVER: [number, number][] = [[-0.05, -0.2], [0.3, 0.2], [0.55, 0.55], [0.95, 0.85], [1.4, 1.2], [1.72, 1.52]];

export const VOLCANO: RegionDef = {
  look: { ambient: 0xa8787a, shadow: 0x3a1830, rim: 0xff9a60 },
  body: {
    outline: volcanoOutline,
    h: (x, z) => 0.05 * wob(x, z, 4) + 0.06 * Math.sin(x * 1.1 - z * 0.8),
    paint: (x, z, _y, out) => {
      out.set(0x4a3e42);
      mixTo(out, 0x5e5a60, 0.5 + 0.5 * wob(x, z, 7));
      mixTo(out, 0x2c2428, smooth(0.3, 0.9, wob(x * 1.7, z * 1.7, 2)) * 0.7);
      mixTo(out, 0x5a3026, smooth(0.35, 0.12, lineDist(x, z, V_RIVER)) * 0.8);
      mixTo(out, 0x6a5c5e, smooth(0.62, 0.45, dist(x, z, ...V_CITY)));
    },
    strata: [0x3a3036, 0x2a2226, 0x5a3026, 0x4a3a3c],
    depth: 3.3,
    rough: 1.3,
    seed: 4,
  },
  build(ctx) {
    const { b, r } = ctx;
    // Emberspine main peak: a volcano cone from a revolved profile, a glowing crater, two lava flows running down the slopes
    const prof: [number, number][] = [[1.15, -0.08], [1.05, 0.1], [0.88, 0.4], [0.7, 0.8], [0.52, 1.15], [0.4, 1.45], [0.34, 1.52], [0.26, 1.44], [0.13, 1.33], [0.001, 1.31]];
    const cone = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 16);
    const cp = cone.attributes.position;
    const cc = new Float32Array(cp.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < cp.count; i++) {
      const y = cp.getY(i);
      const a = Math.atan2(cp.getZ(i), cp.getX(i));
      col.set(0x3a3034).lerp(tmp.set(0x6a5e62), smooth(0.3, 1.4, y));
      if (Math.sin(a * 5 + y * 3) > 0.5 && y > 0.3) col.lerp(tmp.set(0x8a8084), 0.45);
      cc.set([col.r, col.g, col.b], i * 3);
    }
    cone.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    const [CX, CZ] = V_CONE;
    const cy = ctx.y(CX, CZ);
    b.heavy = true;
    b.addVC(cone, M(CX, cy, CZ));
    b.heavy = false;
    ctx.foot(CX + 0.1, CZ + 0.1, 1.2, 0.25);
    b.glow(new THREE.CircleGeometry(0.24, 16).rotateX(-Math.PI / 2), 0xff6a1a, M(CX, cy + 1.34, CZ));
    for (const a of [0.9, 2.1]) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const rr = 0.36 + t * 0.78;
        const yy = 1.5 - t * 1.55;
        const aa = a + Math.sin(t * 5 + a) * 0.12;
        pts.push(new THREE.Vector3(CX + Math.cos(aa) * (rr + 0.015), cy + yy + 0.02, CZ + Math.sin(aa) * (rr + 0.015)));
      }
      b.glow(ribbon(pts, 0.07, new THREE.Vector3(Math.cos(a), 0.7, Math.sin(a)).normalize()), 0xff5a1a, new THREE.Matrix4());
    }
    // Lava river and the lavafall at the southeast cliff edge
    const river = V_RIVER.map(([x, z]) => new THREE.Vector3(x, ctx.y(x, z) + 0.02, z));
    b.glow(ribbon(river, 0.14), 0xff6a1a, new THREE.Matrix4());
    b.glow(ribbon(river.map((p) => p.clone().add(new THREE.Vector3(0, 0.004, 0))), 0.06), 0xffb040, new THREE.Matrix4());
    {
      const end = river[river.length - 1];
      const a = Math.atan2(end.z, end.x);
      const rr = volcanoOutline.rAt(a);
      const fall = [new THREE.Vector3(end.x, end.y, end.z), new THREE.Vector3(Math.cos(a) * (rr + 0.02), end.y - 0.12, Math.sin(a) * (rr + 0.02))];
      for (let k = 1; k <= 5; k++) fall.push(new THREE.Vector3(Math.cos(a) * (rr + 0.04 - k * 0.07), end.y - 0.12 - k * 0.2, Math.sin(a) * (rr + 0.04 - k * 0.07)));
      b.glow(ribbon(fall, 0.12, undefined, new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))), 0xff6a1a, new THREE.Matrix4());
    }
    // Stone bridge (the main road crosses the lava river)
    b.add(new THREE.BoxGeometry(0.34, 0.05, 0.12), 0x6a5c5e, M(0.62, ctx.y(0.62, 0.62) + 0.07, 0.62, -0.85));
    for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.34, 0.05, 0.02), 0x4a3e42, M(0.62 - s * 0.04, ctx.y(0.62, 0.62) + 0.11, 0.62 + s * 0.05, -0.85));
    // Red Iron Keep: iron-hooped stone walls, four red-roofed corner towers, a great blast furnace and a smithy
    const [TX, TZ] = V_CITY;
    const ty = ctx.y(TX, TZ);
    const WR = 0.46;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (i === 9) continue; // North gate
      b.add(new THREE.BoxGeometry(0.25, 0.13, 0.06), 0x5a4a52, M(TX + Math.cos(a) * WR, ty + 0.065, TZ + Math.sin(a) * WR, -a + Math.PI / 2));
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = TX + Math.cos(a) * WR;
      const z = TZ + Math.sin(a) * WR;
      b.add(new THREE.CylinderGeometry(0.065, 0.07, 0.24, 8), 0x5a4a52, M(x, ty + 0.12, z));
      b.add(new THREE.ConeGeometry(0.09, 0.14, 8), 0x9a3226, M(x, ty + 0.31, z));
    }
    house(ctx, TX - 0.16, TZ + 0.1, 0.2, 0.16, 0.13, 0.12, 0x6a5c5e, 0x7a2a22, 'gable');
    house(ctx, TX + 0.12, TZ + 0.2, -0.3, 0.15, 0.13, 0.11, 0x7a6a66, 0x7a2a22, 'hip');
    house(ctx, TX - 0.05, TZ - 0.2, 0.1, 0.14, 0.12, 0.1, 0x6a5c5e, 0x5a2a22, 'gable');
    b.add(new THREE.CylinderGeometry(0.07, 0.1, 0.34, 10), 0x3a3036, M(TX + 0.2, ty + 0.17, TZ - 0.1));
    b.glow(new THREE.BoxGeometry(0.06, 0.06, 0.02), 0xff7a2a, M(TX + 0.2, ty + 0.1, TZ - 0.005));
    ctx.foot(TX, TZ, 0.6, 0.25);
    // Seal Tower: a basalt plateau beside the lava crater
    platform(ctx, ...V_MESA, new Outline(0.5, [[3, 0.1, 0.2], [5, 0.05, 1]]), 0.3, 0x3a3036, [0x3a3036, 0x2a2226, 0x4a3a3c], { seed: 5 });
    placeTower(ctx, V_MESA[0], V_MESA[1] - 0.04, { stone: 0x6a5a62, stoneDark: 0x3a3036, trim: 0xb8743a, roof: 0x8a3026, glow: 0xff8a3a, kind: 'spire' }, 0.62);
    // Dead trees and lava bombs
    for (let i = 0; i < 7; i++) {
      const p = spot(ctx, 0.2, (x, z) => dist(x, z, ...V_CONE) > 1.15 && dist(x, z, ...V_CITY) > 0.62 && dist(x, z, ...V_MESA) > 0.6 && lineDist(x, z, V_RIVER) > 0.2);
      if (!p) continue;
      if (i % 2) rock(ctx, p[0], p[1], 0.9, 0x2c2428);
      else {
        const y = ctx.y(p[0], p[1]);
        b.add(new THREE.CylinderGeometry(0.012, 0.025, 0.26, 5), 0x2a2226, M(p[0], y + 0.13, p[1], 0, 1, 0.1, 0.15));
        b.add(new THREE.CylinderGeometry(0.008, 0.012, 0.12, 4), 0x2a2226, M(p[0] + 0.04, y + 0.2, p[1], 0, 1, 0, -0.8), false);
      }
    }
    // Lava veins on the underside of the island
    for (let i = 0; i < 3; i++) {
      const a = 0.5 + i * 1.9;
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 5; k++) {
        const t = k / 5;
        const f = 1 - t * 0.55;
        const rr = volcanoOutline.rAt(a) * f + 0.03;
        pts.push(new THREE.Vector3(Math.cos(a + t * 0.3) * rr, -0.3 - t * 1.1, Math.sin(a + t * 0.3) * rr));
      }
      b.glow(ribbon(pts, 0.05, undefined, new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))), 0xff4a10, new THREE.Matrix4());
    }
    // The crater smokes and the furnace throws sparks (counts follow the quality setting)
    let acc = 0;
    let acc2 = 0;
    ctx.anim.push((dt, _t, w) => {
      acc += dt * (ctx.low ? 3 : 7);
      acc2 += dt * (ctx.low ? 2 : 5);
      while (acc > 1) {
        acc -= 1;
        ctx.vfx.smoke({ pos: new THREE.Vector3(w.x + CX + (r() - 0.5) * 0.2, w.y + cy + 1.45, w.z + CZ), count: 1, color: [0x4a4046, 0x6a5e60, 0x3a3036], speed: [0.35, 0.6], dir: new THREE.Vector3(0.25, 1, 0.1), spread: 0.25, life: [2.2, 3.2], size: [0.35, 0.6], sizeEnd: 2.2, drag: 0.3 });
      }
      while (acc2 > 1) {
        acc2 -= 1;
        ctx.vfx.emit({ pos: new THREE.Vector3(w.x + CX, w.y + cy + 1.38, w.z + CZ), count: 1, color: [0xff8a3a, 0xffc060], speed: [0.6, 1.2], dir: new THREE.Vector3(0, 1, 0), spread: 0.6, life: [0.8, 1.4], size: [0.06, 0.12], gravity: -0.8, intensity: 1.6 });
      }
    });
  },
};

// ───────────────────────── Skyhowl Highlands ─────────────────────────

const STRATA = [0xd8c6a2, 0xbca283, 0xa68b72, 0xcfb892, 0x9c8a7c, 0xc4a98a];
const highOutline = new Outline(2.45, [[2, 0.08, -0.4], [3, 0.05, 1.1], [6, 0.03, 0.2]]);
const grassTop = (x: number, z: number) => {
  tmp.set(0x8cc66a).lerp(C(0xb5c77a), 0.5 + 0.5 * wob(x, z, 8));
  return tmp.getHex();
};

export const HIGHLAND: RegionDef = {
  look: { ambient: 0xb8c8e0, shadow: 0x6070a8, rim: 0xffffff },
  body: {
    outline: highOutline,
    h: (x, z) => 0.04 * wob(x, z, 6),
    paint: (x, z, _y, out) => {
      out.set(0x8cc66a);
      mixTo(out, 0x6eab58, 0.5 + 0.5 * wob(x, z, 2));
      mixTo(out, 0xb5c77a, smooth(0.3, 0.9, wob(x * 0.7, z * 0.7, 9)) * 0.6);
      mixTo(out, 0xdccba2, smooth(0.08, 0.04, lineDist(x, z, [[-0.3, 2.3], [-0.2, 1.4], [0.35, 0.95], [0.55, 0.62]])));
    },
    strata: STRATA,
    depth: 3.0,
    band: 0.26,
    seed: 6,
  },
  build(ctx) {
    const { b, r } = ctx;
    // Plateaus raised tier by tier (Windherd Plateau → Windsong Plateau), with the tower on the top tier
    platform(ctx, 0.12, -0.55, new Outline(1.5, [[2, 0.1, 0.9], [3, 0.06, 0.3], [5, 0.03, 1.4]]), 0.3, grassTop, STRATA, { seed: 7, band: 0.1 });
    platform(ctx, 0.3, -1.0, new Outline(0.82, [[3, 0.08, 1.4], [2, 0.06, 0.2]]), 0.6, grassTop, STRATA, { seed: 8, band: 0.1 });
    placeTower(ctx, 0.36, -1.1, { stone: 0xebe4d4, stoneDark: 0x8e9ab0, trim: 0xe8b85a, roof: 0x3c9ec0, glow: 0x8ff5e0, kind: 'spire' }, 0.62);
    // Windpost Station: a round tower house, a winged-roof house, a big weather vane and a wooden takeoff platform jutting out over the cliff
    const SX = -0.35;
    const SZ = 1.42;
    house(ctx, SX, SZ, 0, 0.24, 0.24, 0.3, 0xebe4d4, 0x3c9ec0, 'cone');
    house(ctx, SX + 0.36, SZ + 0.06, -0.3, 0.26, 0.18, 0.17, 0xe4dccb, 0x3c9ec0, 'gable');
    house(ctx, SX - 0.34, SZ - 0.1, 0.4, 0.2, 0.16, 0.14, 0xebe4d4, 0x2f86a8, 'hip');
    const sy = ctx.y(SX, SZ);
    b.add(new THREE.CylinderGeometry(0.012, 0.014, 0.5, 5), 0x6a5a4a, M(SX + 0.12, sy + 0.25, SZ + 0.28), false);
    b.add(new THREE.ConeGeometry(0.03, 0.14, 4), 0xe8b85a, M(SX + 0.12, sy + 0.5, SZ + 0.28, 0, 1, 0, Math.PI / 2));
    const a = Math.atan2(2.2, -0.05);
    const rim = highOutline.rAt(a);
    const px = Math.cos(a) * (rim - 0.25);
    const pz = Math.sin(a) * (rim - 0.25);
    const py = ctx.y(px, pz) + 0.02;
    b.add(new THREE.BoxGeometry(0.16, 0.03, 0.62), 0xa07a4c, M(px, py, pz + 0.26, 0.05));
    for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.01, 0.01, 0.34, 4), 0x6a5040, M(px + s * 0.06, py - 0.14, pz + 0.3, 0, 1, -0.6), false);
    // Windmill: facing the west-northwest wind, the blades turn
    const mills: [number, number][] = [[-1.4, 0.3], [-0.95, -0.72]];
    for (const [x, z] of mills) {
      const y = ctx.y(x, z);
      b.add(new THREE.CylinderGeometry(0.06, 0.1, 0.38, 8), 0xebe4d4, M(x, y + 0.19, z));
      b.add(new THREE.ConeGeometry(0.09, 0.12, 8), 0x3c9ec0, M(x, y + 0.44, z));
      ctx.foot(x, z, 0.2, 0.3);
      const blades = mergeGeometries(
        [0, 1, 2, 3].map((k) => {
          const bl = new THREE.BoxGeometry(0.055, 0.3, 0.012);
          bl.translate(0, 0.16, 0);
          bl.rotateZ((k * Math.PI) / 2);
          return bl;
        }),
      )!;
      const m = ctx.mesh(blades, 0xf4efe4, true);
      const face = -0.8;
      m.position.set(x + Math.sin(face) * 0.1, y + 0.38, z + Math.cos(face) * 0.1);
      m.rotation.set(0, face, r() * 3);
      ctx.anim.push((dt) => (m.rotation.z += dt * 1.4));
    }
    // Flag trees: the canopy blown toward the east by the wind
    for (let i = 0; i < 9; i++) {
      const p = spot(ctx, 0.2, (x, z) => dist(x, z, SX, SZ) > 0.55 && dist(x, z, 0.36, -1.1) > 0.4 && mills.every(([mx, mz]) => dist(x, z, mx, mz) > 0.3));
      if (!p) continue;
      const [x, z] = p;
      const y = ctx.y(x, z);
      b.add(new THREE.CylinderGeometry(0.022, 0.035, 0.3, 5), 0x6a5040, M(x + 0.03, y + 0.14, z, 0, 1, 0, -0.25));
      b.add(new THREE.IcosahedronGeometry(0.14, 1), i % 2 ? 0x5fa85e : 0x4f9a62, M(x + 0.12, y + 0.32, z, r() * 3, 1));
      ctx.foot(x + 0.05, z, 0.18, 0.3);
    }
    // Sheep on the shepherd's slope
    for (let i = 0; i < 6; i++) {
      const x = -1.2 + (i % 3) * 0.2 + r() * 0.1;
      const z = 0.95 + Math.floor(i / 3) * 0.18 + r() * 0.05;
      if (!ctx.inside(x, z, 0.2)) continue;
      const y = ctx.y(x, z);
      b.add(new THREE.IcosahedronGeometry(0.04, 0), 0xf4f0e8, M(x, y + 0.04, z));
      b.add(new THREE.SphereGeometry(0.018, 5, 4), 0x3a3034, M(x + 0.04, y + 0.05, z), false);
    }
    // Floating stones (each undulating on its own); the largest has an ancient stone pillar on top and a wind crystal embedded underneath, and the smallest hangs a waterfall
    HIGH_FLOATERS.forEach(([x, y, z, R, seed, pillars], i) => {
      const s = ctx.sub(floaterSpec(R, seed), x, y, z, 0.07 + i * 0.02);
      floaterProps(s.b, R, pillars, r, i === 2);
    });
  },
};

/** Floating stones around the Skyhowl Highlands (each undulating on its own): [x, y, z, radius, seed, whether it has an ancient stone pillar] */
export const HIGH_FLOATERS: [number, number, number, number, number, boolean][] = [
  [-2.45, 0.85, -0.7, 0.42, 11, false],
  [2.3, 1.25, -1.05, 0.55, 12, true],
  [2.05, 0.4, 1.3, 0.32, 13, false],
];

/** Spec of a floating stone's body */
export function floaterSpec(R: number, seed: number): BodySpec {
  const o = new Outline(R, [[2, 0.12, seed], [3, 0.08, seed * 2]]);
  return {
    outline: o,
    h: (x, z) => 0.03 * Math.sin(x * 4 + seed) * Math.cos(z * 3),
    paint: (x, z, _y, out) => {
      out.set(0x8cc66a);
      mixTo(out, 0x6eab58, 0.5 + 0.5 * wob(x, z, seed));
    },
    strata: STRATA,
    depth: R * 2.2,
    rings: 4,
    band: 0.14,
    seed,
    lip: 0.1,
  };
}

/** Small things on a floating stone: a tree, or an ancient stone pillar with the wind crystal underneath */
export function floaterProps(b: MapBatch, R: number, pillars: boolean, rnd: () => number, fall = false): void {
  if (fall) {
    const a = Math.PI * 0.35;
    const rr = R * 0.98;
    const pts = [new THREE.Vector3(Math.cos(a) * rr * 0.7, 0.02, Math.sin(a) * rr * 0.7), new THREE.Vector3(Math.cos(a) * (rr + 0.03), 0.0, Math.sin(a) * (rr + 0.03))];
    for (let k = 1; k <= 4; k++) pts.push(new THREE.Vector3(Math.cos(a) * (rr + 0.05), -k * 0.3, Math.sin(a) * (rr + 0.05)));
    b.add(ribbon(pts, 0.08, undefined, new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))), 0xcfeeff, new THREE.Matrix4(), false);
  }
  if (pillars) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const h = 0.22 + (i % 2) * 0.08;
      b.add(new THREE.BoxGeometry(0.07, h, 0.07), 0xd8cdb4, M(Math.cos(a) * R * 0.45, h / 2, Math.sin(a) * R * 0.45, a));
    }
    const cr = new THREE.OctahedronGeometry(0.1);
    cr.scale(0.7, 1.6, 0.7);
    b.glow(cr, 0x8ff5e0, M(0, -R * 2.2 - 0.05, 0));
  } else {
    b.add(new THREE.CylinderGeometry(0.02, 0.03, 0.2, 5), 0x6a5040, M(0.05, 0.1, 0, 0, 1, 0, -0.25));
    b.add(new THREE.IcosahedronGeometry(0.11, 1), 0x5fa85e, M(0.12, 0.24, 0, rnd() * 3));
  }
  for (let i = 0; i < 3; i++) {
    const a = rnd() * 6.28;
    const len = 0.2 + rnd() * 0.25;
    const root = new THREE.ConeGeometry(0.018, len, 4);
    root.rotateX(Math.PI);
    b.add(root, 0x6a5040, M(Math.cos(a) * R * 0.35, -R * 1.3 - len / 2, Math.sin(a) * R * 0.35), false);
  }
}

export { islandBody };
