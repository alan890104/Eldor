// Second-batch spirit models (see docs/09-bestiary.md): Stoneheart Canyon (earth) and Thunderplain (thunder).

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Creature, Kit, PartOpts } from '../creature.ts';
import { outlineMaterial } from '../toon.ts';
import { biped, ears, floater, PI, quad, roundEars, sparkle, tailChain, type Builder, type C, type V3 } from '../parts.ts';

// ───────────────────────── Shared helpers ─────────────────────────

const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Lightning-bolt (⚡) plate: extends from 0 to len along +y, width w, thickness along z */
function boltGeo(len: number, w: number, depth = 0.02): THREE.BufferGeometry {
  const pts: [number, number][] = [[0.056, 1], [-0.5, 0.4], [0, 0.4], [-0.056, 0], [0.5, 0.6], [0, 0.6]];
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * w, y * len)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Turn geometry built along +y toward dir and move it to pos */
function place(g: THREE.BufferGeometry, pos: THREE.Vector3, dir: THREE.Vector3): THREE.BufferGeometry {
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
  g.translate(pos.x, pos.y, pos.z);
  return g;
}

/** Make the object's +y point along dir */
function aim<T extends THREE.Object3D>(g: T, dir: THREE.Vector3): T {
  g.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  return g;
}

/** Roughly uniformly distributed directions on a sphere */
function fib(n: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const ga = PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const rr = Math.sqrt(1 - y * y);
    out.push(v3(Math.cos(i * ga) * rr, y, Math.sin(i * ga) * rr));
  }
  return out;
}

type Spike = { p: THREE.Vector3; d: THREE.Vector3; r: number; h: number };

/** A whole patch of spikes: the spike bodies merged into one mesh, the glowing spike tips merged into another */
function spikes(k: Kit, parent: THREE.Object3D, list: Spike[], col: C, tip: C, tipFrac = 0.34, tipGlow = 1.5): void {
  if (!list.length) return;
  const shafts: THREE.BufferGeometry[] = [];
  const tips: THREE.BufferGeometry[] = [];
  for (const sp of list) {
    const hs = sp.h * (1 - tipFrac);
    const ht = sp.h * tipFrac;
    const shaft = new THREE.CylinderGeometry(sp.r * 0.42, sp.r, hs, 6, 1);
    shaft.translate(0, hs / 2, 0);
    shafts.push(place(shaft, sp.p, sp.d));
    const tg = new THREE.ConeGeometry(sp.r * 0.42, ht, 6, 1);
    tg.translate(0, hs + ht / 2, 0);
    tips.push(place(tg, sp.p, sp.d));
  }
  k.mesh(parent, mergeGeometries(shafts), col);
  k.glow(parent, mergeGeometries(tips), tip, tipGlow);
}

/** Tube along a curve with variable radius (snake body) */
function taperTube(pts: THREE.Vector3[], r: (t: number) => number, seg = 96, radial = 14): { geo: THREE.BufferGeometry; path: THREE.CatmullRomCurve3 } {
  const path = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(path, seg, 1, radial, false);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const center = path.getPointAt(i / seg);
    const kk = Math.max(0.006, r(i / seg));
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(p, idx).sub(center).multiplyScalar(kk).add(center);
      p.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return { geo: g, path };
}

const outlineCache = new WeakMap<Creature, THREE.ShaderMaterial>();

/** Thin-plate part (wing membrane, door shield, banner): the outline uses vertex-merged smooth normals, so the edges do not break up */
function slab(k: Kit, parent: THREE.Object3D, geo: THREE.BufferGeometry, color: C, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], o: PartOpts = {}): THREE.Mesh {
  // The post-process outline version does not need an outline copy with smooth normals and draws the lines directly as an ordinary part
  if (k.ink) return k.mesh(parent, geo, color, pos, rot, o);
  const m = k.mesh(parent, geo, color, pos, rot, { ...o, outline: false });
  const sg = geo.clone();
  sg.deleteAttribute('normal');
  sg.deleteAttribute('uv');
  const merged = mergeVertices(sg, 1e-4);
  merged.computeVertexNormals();
  let om = outlineCache.get(k.c);
  if (!om) {
    om = outlineMaterial(k.outline);
    k.c.outlines.push(om);
    outlineCache.set(k.c, om);
  }
  m.add(new THREE.Mesh(merged, om));
  return m;
}

/** Bat wing membrane: the wing bone along +y, a fan-shaped membrane hanging toward +x (toward -x when flip) */
function batWingGeo(len: number, wid: number, flip: boolean, depth = 0.03): THREE.BufferGeometry {
  const f = flip ? -1 : 1;
  const X = (x: number) => x * wid * f;
  const Y = (y: number) => y * len;
  const s = new THREE.Shape();
  s.moveTo(X(0), Y(0));
  s.lineTo(X(-0.08), Y(0.55));
  s.lineTo(X(0.02), Y(1));
  s.quadraticCurveTo(X(0.22), Y(0.74), X(0.58), Y(0.8));
  s.quadraticCurveTo(X(0.42), Y(0.56), X(0.72), Y(0.44));
  s.quadraticCurveTo(X(0.42), Y(0.3), X(0.52), Y(0.08));
  s.quadraticCurveTo(X(0.28), Y(0.1), X(0.14), Y(-0.04));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Arch-shaped stone slab (the `gargoyle`'s door shield) */
function archGeo(w: number, h: number, depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h - w / 2);
  s.absarc(0, h - w / 2, w / 2, 0, PI, false);
  s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 14 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Swallowtail banner face (hanging down from y=0) */
function bannerGeo(w: number, h: number, depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, -h);
  s.lineTo(0, -h * 0.78);
  s.lineTo(-w / 2, -h);
  s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** A strip of cloth (saddle blanket) hugging the upper half of the ellipsoid body, over the segment with |z| < zFrac·rz; drop sets how low it hangs on both sides */
function bandGeo(rx: number, ry: number, rz: number, zFrac: number, drop = 0.35): THREE.BufferGeometry {
  const a = Math.asin(Math.min(0.95, zFrac));
  const g = new THREE.SphereGeometry(1, 28, 10, PI - drop, PI + drop * 2, PI / 2 - a, a * 2);
  g.rotateX(PI / 2);
  g.scale(rx, ry, rz);
  return g;
}

/** Crystal: an elongated octahedron with its bottom roughly at the origin */
function crystalGeo(r: number, h: number): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(1, 0);
  g.scale(r, h / 2, r);
  g.translate(0, h * 0.42, 0);
  return g;
}

/** Drifting small arc of electricity (a lightning-shaped glowing sheet) */
function sparks(k: Kit, parent: THREE.Object3D, col: C, n: number, R: number, y: number, size: number, ySpread = 0.15, glow = 2.2): void {
  const c = k.c;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + 0.4;
    const m = k.glow(parent, boltGeo(size, size * 0.55, 0.012), col, glow, [Math.sin(a) * R, y + ((i * 7) % 3) * ySpread * 0.5, Math.cos(a) * R], [0, a, (i % 2 ? 1 : -1) * 0.5]);
    c.bobbers.push({ g: m, base: m.position.y, amp: 0.04, speed: 5 + (i % 3), phase: i * 1.3 });
  }
}

// ───────────────────────── Stoneheart Canyon (earth) ─────────────────────────

const digmole: Builder = (k, c, s) => {
  const fur = 0x5a4032;
  const tan = 0xa98668;
  const pink = 0xf4a6ae;
  const nose = 0xff8fa8;
  const gem = 0x6ae0ff;
  const gemHi = 0xa8f2ff;
  const clawC = 0xfff1dc;
  const gold = 0xffcf5a;
  const hr = [0.34, 0.32, 0.31][s - 1];
  const tr = [0.33, 0.37, 0.42][s - 1];
  const th = [0.34, 0.42, 0.52][s - 1];
  const b = biped(k, c, {
    col: fur,
    belly: tan,
    torsoR: tr,
    torsoH: th,
    leg: [0.09, 0.11, 0.13][s - 1],
    legR: 0.1,
    headR: hr,
    armLen: [0.1, 0.13, 0.15][s - 1],
    armR: [0.075, 0.085, 0.095][s - 1],
    hand: pink,
    foot: pink,
  });
  for (const a of c.arms) a.base.set(s === 1 ? -0.75 : -0.55, 0, a.side * (s === 1 ? 0.75 : 0.9));
  const h = b.head;
  const sz = hr * 0.8;
  // Nose and the blue crystal
  k.sphere(h, 0x7a5a46, 0.12, [0, -0.1, sz], [0.95, 0.75, 1.1]);
  k.sphere(h, nose, 0.07 + s * 0.006, [0, -0.08, sz + 0.12]);
  const gr = 0.035 + s * 0.007;
  k.mesh(h, crystalGeo(gr, gr * 3), gem, [0, -0.045, sz + 0.17], [0.55, 0, 0], { emissive: gem, emissiveAmt: 0.8 });
  k.glowSphere(h, gem, gr * 0.6, [0, -0.0, sz + 0.2], 2.2);
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) k.cyl(h, 0xf5ecdf, 0.006, 0.006, 0.16, [sx * 0.13, -0.1 - i * 0.03, sz + 0.02], [0, 0, sx * (PI / 2 + 0.12 - i * 0.24)], 4, { outline: false });
  const eyeY = s === 2 ? 0.05 : 0.08;
  k.eyes(h, { x: 0.12, y: eyeY, z: hr * 0.84, r: 0.072, iris: 0x3a2418 });
  if (s < 3) k.blush(h, 0.21, -0.05, hr * 0.74, 0.05);
  if (s === 1) for (let i = -1; i <= 1; i++) k.cone(h, fur, 0.04, 0.12, [i * 0.05, hr * 0.9, -0.02], [-0.3, 0, -i * 0.5], 8);

  // Forepaws: I big shovel claws, II and III drills
  for (const hand of b.hands) {
    if (s === 1) {
      const paw = k.group(hand, [0, 0, 0.02]);
      k.sphere(paw, pink, 0.16, [0, -0.06, 0], [1.05, 0.95, 0.4]);
      for (let i = 0; i < 4; i++) k.cone(paw, clawC, 0.034, 0.12, [(i - 1.5) * 0.065, -0.17 + Math.abs(i - 1.5) * 0.025, 0], [PI, 0, 0], 8);
    } else {
      k.sphere(hand, pink, 0.1, [0, 0.01, 0], [1, 0.8, 1]);
      const dl = s === 2 ? 0.3 : 0.36;
      const dr = s === 2 ? 0.095 : 0.11;
      const drill = k.group(hand, [0, -0.04, 0]);
      k.cyl(drill, 0xd6a24a, dr * 1.12, dr * 1.12, 0.06, [0, 0, 0]);
      k.cone(drill, 0xaab3c8, dr, dl, [0, -0.02, 0], [PI, 0, 0], 16);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const a = t * PI * 2 * 3;
        const rr = dr * (1 - t * 0.92) + 0.004;
        pts.push(v3(Math.cos(a) * rr, -0.03 - t * dl * 0.92, Math.sin(a) * rr));
      }
      k.mesh(drill, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.014, 5), 0x6a7388, [0, 0, 0], [0, 0, 0], { outline: false });
      if (s === 3) k.mesh(drill, crystalGeo(0.04, 0.14), gem, [0, -dl + 0.02, 0], [PI, 0, 0], { emissive: gem, emissiveAmt: 0.9 });
      c.spinners.push({ g: drill, speed: 7, axis: 'y' });
    }
  }

  if (s === 2) {
    // Miner's goggles (pushed up on the brow)
    const gy = 0.19;
    const R = Math.sqrt(hr * hr - gy * gy) + 0.012;
    k.torus(h, 0x3a2a20, R, 0.022, [0, gy, 0], [PI / 2 - 0.28, 0, 0]);
    for (const sx of [-1, 1]) {
      const n = v3(sx * 0.11, gy + 0.02, 0).setZ(Math.sqrt(hr * hr - 0.11 * 0.11 - (gy + 0.02) ** 2));
      const g = aim(k.group(h, [n.x, n.y, n.z]), n);
      k.cyl(g, 0xd6a24a, 0.075, 0.075, 0.06, [0, 0.01, 0]);
      k.cyl(g, 0x8fe8ff, 0.056, 0.056, 0.066, [0, 0.012, 0], [0, 0, 0], 20, { outline: false, emissive: 0x6ad8ff, emissiveAmt: 0.35 });
      k.glowSphere(g, 0xffffff, 0.016, [-0.02, 0.05, 0.02], 1.8);
    }
  }
  if (s === 3) {
    // Crystal cluster crown
    const crown = k.group(h, [0, hr * 0.78, -0.01]);
    k.torus(crown, gold, hr * 0.6, 0.04, [0, 0, 0], [PI / 2, 0, 0]);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI * 2;
      const tall = i === 0 ? 0.36 : i === 1 || i === 6 ? 0.27 : i === 2 || i === 5 ? 0.21 : 0.17;
      const x = Math.sin(a) * hr * 0.6;
      const z = Math.cos(a) * hr * 0.6;
      k.mesh(crown, crystalGeo(0.055, tall), i % 2 ? gemHi : gem, [x, 0.01, z], [Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3], { emissive: gem, emissiveAmt: 0.5 });
    }
    k.sphere(crown, 0xff6a8a, 0.04, [0, 0.0, hr * 0.6 + 0.03], [1, 1, 0.6]);
    sparkle(k, c, crown, 0xc8f8ff, 0.025, [0.2, 0.34, 0.05]);
    sparkle(k, c, crown, 0xc8f8ff, 0.02, [-0.22, 0.26, -0.05]);
    // Gold collar and a blue crystal pendant
    k.torus(c.body, gold, tr * 0.62, 0.03, [0, b.torsoY + th * 0.44, 0.04], [PI / 2 - 0.25, 0, 0]);
    k.mesh(c.body, crystalGeo(0.05, 0.13), gem, [0, b.torsoY + th * 0.32, tr * 0.7], [PI + 0.25, 0, 0], { emissive: gem, emissiveAmt: 0.8 });
    // A row of crystals on the back (visible from above the shoulders)
    const hh = th * 0.62;
    for (let i = 0; i < 4; i++) {
      const phi = 0.45 + i * 0.4;
      const dir = v3(0, Math.cos(phi), -Math.sin(phi));
      const p = v3(0, b.torsoY + dir.y * hh * 0.9, dir.z * tr * 0.88 * 0.9);
      const g = aim(k.group(c.body, [p.x, p.y, p.z]), dir.clone().add(v3(0, 0.45, -0.1)));
      const sc = 1.15 - i * 0.18;
      k.mesh(g, crystalGeo(0.07 * sc, 0.36 * sc), gem, [0, 0, 0], [0, 0, 0], { emissive: gem, emissiveAmt: 0.5 });
      k.mesh(g, crystalGeo(0.045 * sc, 0.22 * sc), gemHi, [0.08 * sc, -0.01, 0], [0, 0, -0.55], { emissive: gem, emissiveAmt: 0.5 });
      k.mesh(g, crystalGeo(0.04 * sc, 0.18 * sc), gemHi, [-0.075 * sc, -0.01, 0], [0, 0, 0.6], { emissive: gem, emissiveAmt: 0.5 });
    }
    for (const sx of [-1, 1]) {
      const g = aim(k.group(c.body, [sx * tr * 0.8, b.torsoY + th * 0.4, -0.02]), v3(sx * 0.6, 1, -0.1));
      k.mesh(g, crystalGeo(0.05, 0.2), gem, [0, 0, 0], [0, 0, 0], { emissive: gem, emissiveAmt: 0.5 });
      k.mesh(g, crystalGeo(0.035, 0.13), gemHi, [sx * 0.05, 0, 0.03], [0, 0, -sx * 0.5], { emissive: gem, emissiveAmt: 0.5 });
    }
  }
  k.sphere(b.tail, fur, 0.05, [0, 0, 0], [1, 1, 1.4]);
};

const gargoyle: Builder = (k, c, s) => {
  const stone = 0x8a8a96;
  const dark = 0x6c6c7a;
  const light = 0xa6a6b2;
  const mem = 0x77778a;
  const moss = 0x6aa84a;
  const amber = 0xffb040;
  const addWings = (y: number, z: number, len: number, wid: number, base: number, amp: number) => {
    for (const sx of [-1, 1]) {
      const g = k.group(c.body, [sx * 0.12, y, z], [0, -sx * 0.35, 0]);
      slab(k, g, batWingGeo(len, wid, sx < 0), mem);
      k.capsule(g, dark, 0.026, len * 0.9, [-sx * 0.02, len * 0.5, 0], [0, 0, sx * 0.06]);
      k.cone(g, dark, 0.026, 0.07, [sx * 0.01, len, 0], [0, 0, -sx * 0.4], 6);
      c.wings.push({ g, side: sx < 0 ? 1 : -1, base, amp, speed: 3 });
    }
  };
  const mossPatch = (parent: THREE.Object3D, pos: V3, r: number, rot: V3 = [0, 0, 0]) => {
    k.sphere(parent, moss, r, pos, [1, 0.45, 1], rot);
    k.sphere(parent, 0x8ccf5a, r * 0.55, [pos[0] + r * 0.2, pos[1] + r * 0.25, pos[2]], [1, 0.6, 1], rot, { outline: false });
  };
  if (s < 3) {
    const S = s === 1 ? 1 : 1.1;
    const hr = s === 1 ? 0.34 : 0.33;
    const b = biped(k, c, { col: stone, belly: light, torsoR: 0.3 * S, torsoH: 0.36 * S, leg: 0.1, legR: 0.1, headR: hr, armLen: 0.2 * S, armR: 0.07, hand: dark, foot: dark });
    for (const a of c.arms) a.base.set(-0.35, 0, a.side * 0.12);
    // Crouching pose: knees raised
    for (const sx of [-1, 1]) k.sphere(c.body, stone, 0.13 * S, [sx * 0.2 * S, 0.17, 0.07], [0.9, 1, 1.2]);
    const h = b.head;
    k.sphere(h, light, 0.13, [0, -0.11, hr * 0.78], [1.15, 0.72, 0.8]);
    k.sphere(h, 0x4a4a58, 0.03, [0, -0.07, hr * 0.78 + 0.1]);
    for (const sx of [-1, 1]) k.cone(h, 0xffffff, 0.018, 0.05, [sx * 0.05, -0.15, hr * 0.78 + 0.085], [PI, 0, 0], 6, { outline: false });
    k.eyes(h, { x: 0.13, y: 0.06, z: hr * 0.8, r: 0.08, iris: 0xd08a2a });
    k.blush(h, 0.22, -0.06, hr * 0.7, 0.05);
    ears(k, c, h, stone, dark, 0.075, 0.26, hr * 0.84, 0.0, 1.25);
    const hornLen = s === 1 ? 0.14 : 0.2;
    for (const sx of [-1, 1]) k.horn(h, dark, 0.045, hornLen, hornLen * 0.4, [sx * 0.12, hr * 0.82, 0.02], [-0.25, 0, -sx * 0.3]);
    // Cracks in the stone
    k.sphere(h, dark, 0.04, [-0.16, 0.2, hr * 0.62], [1, 0.4, 0.4], [0, -0.4, 0.5], { outline: false });
    k.sphere(c.body, dark, 0.05, [0.14, b.torsoY + 0.08, 0.2], [1, 0.4, 0.4], [0, 0.5, -0.4], { outline: false });
    addWings(b.torsoY + 0.16, -0.2, s === 1 ? 0.5 : 0.74, s === 1 ? 0.42 : 0.58, s === 1 ? 1.0 : 0.85, 0.18);
    const tip = tailChain(k, c, b.tail, stone, 4, 0.05, 0.08, 1.1);
    const spade = new THREE.OctahedronGeometry(0.07, 0);
    spade.scale(1, 0.35, 1.3);
    k.mesh(tip, spade, dark, [0, 0, -0.08]);
    if (s === 2) {
      mossPatch(h, [0.06, hr * 0.92, -0.04], 0.12, [0.2, 0, -0.2]);
      mossPatch(c.body, [0.22, b.torsoY + 0.2, -0.02], 0.08, [0, 0, -0.6]);
      mossPatch(c.body, [-0.18, 0.26, 0.12], 0.07, [0, 0, 0.4]);
      for (const w of c.wings) mossPatch(w.g, [0, 0.2, 0.01], 0.06, [PI / 2, 0, 0]);
      k.blade(h, moss, 0.1, 0.05, 0.02, [-0.05, hr * 0.95, 0.02], [0.3, 0, 0.5]);
    }
    return;
  }
  // III: `gargoyle`, a tall upright stone statue, the left hand steadying a stone door shield standing beside it, wings spread
  const b = biped(k, c, { col: stone, belly: light, torsoR: 0.36, torsoH: 0.62, leg: 0.3, legR: 0.12, headR: 0.24, armLen: 0.3, armR: 0.1, hand: dark, foot: dark });
  const h = b.head;
  k.sphere(h, light, 0.11, [0, -0.1, 0.18], [1.2, 0.7, 0.8]);
  for (const sx of [-1, 1]) k.cone(h, 0xffffff, 0.02, 0.055, [sx * 0.06, -0.15, 0.26], [PI, 0, 0], 6, { outline: false });
  k.eyes(h, { x: 0.1, y: 0.04, z: 0.19, r: 0.062, iris: amber, glow: true, sharp: true });
  k.sphere(h, dark, 1, [0, 0.11, 0.16], [0.2, 0.04, 0.08]);
  ears(k, c, h, stone, dark, 0.06, 0.2, 0.19, 0.02, 1.25);
  for (const sx of [-1, 1]) k.horn(h, dark, 0.06, 0.32, 0.16, [sx * 0.1, 0.17, 0], [-0.2, 0, -sx * 0.35]);
  k.glow(h, new THREE.OctahedronGeometry(0.025, 0), amber, 2, [0, 0.12, 0.2]);
  // Pauldrons and knee guards
  for (const sx of [-1, 1]) {
    const g = new THREE.DodecahedronGeometry(0.15, 0);
    g.scale(1.1, 0.8, 1);
    k.mesh(c.body, g, dark, [sx * 0.36, b.torsoY + 0.26, 0]);
    k.glow(c.body, new THREE.BoxGeometry(0.014, 0.06, 0.012), amber, 1.8, [sx * 0.4, b.torsoY + 0.3, 0.13]);
    const kn = new THREE.DodecahedronGeometry(0.08, 0);
    kn.scale(1, 0.8, 0.9);
    k.mesh(c.body, kn, dark, [sx * 0.18, 0.2, 0.09]);
  }
  // Rune on the chest
  const rune = k.group(c.body, [0, b.torsoY + 0.06, 0.36 * 0.93]);
  k.glow(rune, new THREE.TorusGeometry(0.085, 0.012, 6, 28), amber, 1.8);
  k.glow(rune, new THREE.BoxGeometry(0.02, 0.22, 0.02), amber, 1.8);
  for (const sx of [-1, 1]) k.glow(rune, new THREE.BoxGeometry(0.016, 0.09, 0.02), amber, 1.8, [sx * 0.045, -0.05, 0], [0, 0, sx * 0.7]);
  const runeGlow = k.glowSphere(rune, amber, 0.05, [0, 0, 0.01], 1.2, [1, 1, 0.5], 0.35);
  c.flickers.push({ g: runeGlow, base: runeGlow.scale.clone(), speed: 3, amt: 0.25 });
  addWings(b.torsoY + 0.24, -0.26, 0.95, 0.72, 0.75, 0.12);
  mossPatch(h, [-0.06, 0.2, -0.05], 0.09, [0.2, 0, 0.3]);
  mossPatch(c.body, [0.34, b.torsoY + 0.37, 0.02], 0.08, [0, 0, -0.5]);
  mossPatch(c.body, [0.2, b.torsoY - 0.2, 0.26], 0.07, [0.8, 0, -0.3]);
  const tip = tailChain(k, c, b.tail, stone, 4, 0.07, 0.1, 1.2);
  const spade = new THREE.OctahedronGeometry(0.09, 0);
  spade.scale(1, 0.35, 1.3);
  k.mesh(tip, spade, dark, [0, 0, -0.1]);
  // Stone door shield: standing on the ground beside the left foot, leaning slightly toward the body, the left hand resting on top of the door
  const arm = c.arms.find((a) => a.side < 0);
  if (arm) arm.base.set(-0.15, 0, 1.0);
  const door = k.group(c.body, [-0.6, 0.0, 0.08], [0, 0.2, -0.1]);
  slab(k, door, archGeo(0.5, 0.7, 0.09), 0x74747f, [0, 0, 0]);
  k.mesh(door, archGeo(0.4, 0.6, 0.04), 0x9a9aa6, [0, 0.04, 0.035], [0, 0, 0], { outline: false });
  k.mesh(door, new THREE.BoxGeometry(0.014, 0.5, 0.02), 0x4a4a58, [0, 0.3, 0.06], [0, 0, 0], { outline: false });
  for (const [x, y] of [[-0.13, 0.1], [0.13, 0.1], [-0.13, 0.42], [0.13, 0.42]]) k.sphere(door, 0x4a4a58, 0.024, [x, y, 0.06]);
  k.glow(door, new THREE.TorusGeometry(0.075, 0.012, 6, 24), amber, 1.8, [0, 0.4, 0.065]);
  k.glow(door, boltGeo(0.14, 0.085, 0.01), amber, 1.8, [0, 0.33, 0.068]);
  k.torus(door, 0x5a5a68, 0.05, 0.012, [0.16, 0.24, 0.07], [0, 0, 0]);
};

const rhino: Builder = (k, c, s) => {
  const hide = 0x8a7560;
  const plate = 0x7a7470;
  const plateHi = 0x9a938c;
  const hornC = 0xeee2c8;
  const iron = 0x8c929e;
  const len = [0.44, 0.56, 0.66][s - 1];
  const r = [0.33, 0.37, 0.41][s - 1];
  const q = quad(k, c, { col: hide, belly: 0xb49c80, len, r, leg: [0.17, 0.21, 0.24][s - 1], legR: [0.09, 0.1, 0.115][s - 1], headR: [0.31, 0.28, 0.27][s - 1], headZ: 0.04, paw: s === 3 ? iron : 0x5e4e40 });
  const h = q.head;
  const hr = q.headR;
  // Muzzle and horns
  const mz = hr * 0.66;
  k.sphere(h, hide, 0.2, [0, -0.1, mz], [0.95, 0.78, 1.05]);
  for (const sx of [-1, 1]) k.sphere(h, 0x3a2a24, 0.022, [sx * 0.07, -0.12, mz + 0.2], [1, 1.3, 0.6], [0, 0, 0], { outline: false });
  const hl = [0.22, 0.34, 0.42][s - 1];
  const hornR = [0.075, 0.085, 0.095][s - 1];
  k.horn(h, hornC, hornR, hl, hl * 0.3, [0, 0.01, mz + 0.08], [0.45, 0, 0]);
  if (s >= 2) k.horn(h, hornC, 0.045, 0.12, 0.04, [0, 0.12, mz - 0.06], [0.2, 0, 0]);
  if (s === 3) {
    k.cyl(h, iron, hornR * 1.05, hornR * 1.2, 0.08, [0, 0.03, mz + 0.1], [0.45, 0, 0], 12);
    k.torus(h, 0xd6a24a, hornR * 0.8, 0.018, [0, 0.12, mz + 0.14], [PI / 2 + 0.45, 0, 0]);
  }
  k.eyes(h, { x: 0.14, y: 0.08, z: hr * 0.8, r: [0.078, 0.068, 0.062][s - 1], iris: 0x3a2a1a, sharp: s === 3 });
  if (s < 3) k.blush(h, 0.21, -0.04, hr * 0.72, 0.05);
  ears(k, c, h, hide, 0xd89a90, 0.055, 0.13, hr * 0.64, hr * 0.7, 0.55, -0.06);
  // Rock-plate armor on the back
  const n = [3, 4, 4][s - 1];
  const plateAt = (parent: THREE.Object3D, pos: V3, sc: number, rot: V3, spike: boolean) => {
    const g = new THREE.DodecahedronGeometry(0.13 * sc, 0);
    g.scale(1.25, 0.55, 1.1);
    k.mesh(parent, g, plate, pos, rot);
    if (spike) k.cone(parent, plateHi, 0.06 * sc, 0.14 * sc, [pos[0], pos[1] + 0.03 * sc, pos[2]], [rot[0] - 0.35, 0, rot[2]], 5);
  };
  for (let i = 0; i < n; i++) {
    const z = len * 0.42 - (i / (n - 1)) * len * 0.85;
    const y = r * 0.88 * Math.sqrt(Math.max(0, 1 - (z / len) ** 2)) - r * 0.82;
    plateAt(q.back, [0, y, z], s === 1 ? 0.9 : 1.1 + s * 0.05, [0.25 - (z / len) * 0.5, 0, 0], s >= 2);
  }
  if (s >= 2) {
    for (const sx of [-1, 1]) {
      const g = new THREE.DodecahedronGeometry(0.14, 0);
      g.scale(0.55, 1, 1.3);
      k.mesh(c.body, g, plate, [sx * r * 0.9, q.bodyY + 0.1, len * 0.45], [0, 0, sx * 0.3]);
      if (s === 3) k.mesh(c.body, g, plate, [sx * r * 0.92, q.bodyY + 0.06, -len * 0.4], [0, 0, sx * 0.3]);
    }
    const hp = new THREE.DodecahedronGeometry(0.11, 0);
    hp.scale(1.3, 0.5, 1);
    k.mesh(h, hp, plate, [0, hr * 0.86, 0.02], [0.3, 0, 0]);
  }
  if (s === 3) {
    for (const l of c.legs) k.torus(l.g, iron, 0.125, 0.024, [0, -0.19, 0.02], [PI / 2, 0, 0]);
    // Dwarf saddle gear: a saddle blanket (gold edge), a saddle seat, a war banner
    const by = q.bodyY;
    const ry = r * 0.88;
    k.mesh(c.body, bandGeo(r * 1.05, ry * 1.07, len * 1.03, 0.36, 0.3), 0xa8342a, [0, by, -0.04]);
    k.mesh(c.body, bandGeo(r * 1.065, ry * 1.08, len * 1.04, 0.28, 0.2), 0xe0b040, [0, by, -0.04], [0, 0, 0], { outline: false });
    k.mesh(c.body, bandGeo(r * 1.075, ry * 1.09, len * 1.045, 0.22, 0.12), 0xa8342a, [0, by, -0.04], [0, 0, 0], { outline: false });
    k.sphere(c.body, 0x5a3a24, 1, [0, by + ry * 1.08, -0.04], [0.16, 0.07, 0.17]);
    k.sphere(c.body, 0x5a3a24, 0.055, [0, by + ry * 1.08 + 0.05, 0.1], [1, 1.2, 0.8]);
    const pole = k.group(c.body, [0.12, by + ry * 1.02, -0.2], [-0.15, 0, -0.1]);
    k.cyl(pole, 0x6a4a2a, 0.022, 0.022, 0.62, [0, 0.31, 0]);
    k.cone(pole, 0xe0b040, 0.04, 0.1, [0, 0.62, 0], [0, 0, 0], 8);
    k.cyl(pole, 0x6a4a2a, 0.016, 0.016, 0.34, [0, 0.56, 0], [0, 0, PI / 2]);
    const flag = k.group(pole, [0, 0.56, 0]);
    slab(k, flag, bannerGeo(0.3, 0.4, 0.02), 0xb8322a, [0, -0.01, 0]);
    k.mesh(flag, bannerGeo(0.22, 0.3, 0.01), 0xe0b040, [0, -0.04, 0.012], [0, 0, 0], { outline: false });
    k.mesh(flag, bannerGeo(0.16, 0.22, 0.01), 0xb8322a, [0, -0.07, 0.018], [0, 0, 0], { outline: false });
    // Hammer emblem
    k.mesh(flag, new THREE.BoxGeometry(0.1, 0.045, 0.01), 0xe0b040, [0, -0.12, 0.026], [0, 0, 0], { outline: false });
    k.mesh(flag, new THREE.BoxGeometry(0.02, 0.09, 0.01), 0xe0b040, [0, -0.175, 0.026], [0, 0, 0], { outline: false });
    c.tails.push({ g: flag, phase: 1, amp: 0.2, axis: 'y' });
  }
  const tip = tailChain(k, c, q.tail, hide, 2, 0.045, 0.07, 0.9);
  k.sphere(tip, 0x5e4e40, 0.045, [0, 0, -0.04], [0.8, 1.3, 0.8]);
};

const sandserpent: Builder = (k, c) => {
  c.archetype = 'crawl';
  const sand = 0xd8b070;
  const dia = 0x7a5530;
  const cream = 0xf4dfae;
  // A small patch of quicksand beneath the body
  k.sphere(c.body, 0xe2c282, 1, [0, 0.015, 0], [0.8, 0.035, 0.78], [0, 0, 0], { outline: false });
  for (let i = 0; i < 3; i++) k.torus(c.body, 0xc8a060, 0.36 + i * 0.16, 0.014, [0, 0.03, 0], [PI / 2, 0, i * 2.1], PI * 1.4, { outline: false });
  // Body: coiled around once and a half, then rearing up from behind
  const pts: THREE.Vector3[] = [];
  const a0 = 0.5;
  const a1 = PI * 3;
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = a0 + u * (a1 - a0);
    const R = 0.6 - 0.26 * u;
    const y = 0.15 + 0.18 * Math.min(1, Math.max(0, (u - 0.45) / 0.45));
    pts.push(v3(Math.sin(a) * R, y, Math.cos(a) * R));
  }
  pts.push(v3(0, 0.5, -0.3), v3(0, 0.74, -0.2), v3(0, 0.92, -0.06), v3(0, 1.0, 0.06));
  const radius = (t: number) => {
    const body = 0.16;
    if (t < 0.3) return 0.016 + (body - 0.016) * Math.sin((t / 0.3) * PI * 0.5);
    if (t > 0.8) return body - ((t - 0.8) / 0.2) * 0.03;
    return body;
  };
  const { geo, path } = taperTube(pts, radius, 150, 16);
  k.mesh(c.body, geo, sand);
  // Diamond pattern on the back and belly scales at the throat
  const dias: THREE.BufferGeometry[] = [];
  const scutes: THREE.BufferGeometry[] = [];
  for (let t = 0.1; t < 0.975; t += 0.036) {
    const p = path.getPointAt(t);
    const T = path.getTangentAt(t).normalize();
    let up = UP.clone().sub(T.clone().multiplyScalar(T.dot(UP)));
    if (up.length() < 0.45) {
      const back = v3(0, 0, -1);
      up = back.sub(T.clone().multiplyScalar(T.dot(back)));
    }
    up.normalize();
    const side = new THREE.Vector3().crossVectors(up, T).normalize();
    const rr = radius(t);
    const m = new THREE.Matrix4().makeBasis(side, up, T);
    const g = new THREE.OctahedronGeometry(1, 0);
    g.scale(rr * 0.6, rr * 0.22, rr * 0.9);
    g.applyMatrix4(m);
    const pp = p.clone().add(up.clone().multiplyScalar(rr * 0.9));
    g.translate(pp.x, pp.y, pp.z);
    dias.push(g);
    if (t > 0.8) {
      const sg = new THREE.SphereGeometry(1, 10, 6);
      sg.scale(rr * 0.75, rr * 0.2, rr * 0.4);
      sg.applyMatrix4(m);
      const sp = p.clone().add(up.clone().multiplyScalar(-rr * 0.86));
      sg.translate(sp.x, sp.y, sp.z);
      scutes.push(sg);
    }
  }
  k.mesh(c.body, mergeGeometries(dias), dia);
  k.mesh(c.body, mergeGeometries(scutes), cream, [0, 0, 0], [0, 0, 0], { outline: false });
  // Fan-shaped hood (a cobra-style neck fan with a row of sharp spines along the outer edge), the head at the top edge of the hood
  const hood = k.group(c.body, [0, 0.84, -0.2], [-0.18, 0, 0]);
  k.sphere(hood, sand, 1, [0, 0, 0], [0.36, 0.3, 0.06]);
  k.sphere(hood, cream, 1, [0, -0.02, 0.035], [0.29, 0.24, 0.035], [0, 0, 0], { outline: false });
  // A ring of gold sand pattern around the hood's edge, with a glowing eye-shaped marking in the center
  const rimArc = new THREE.TorusGeometry(1, 0.012, 6, 40, PI * 1.3);
  rimArc.rotateZ(-PI * 0.15);
  rimArc.scale(0.33, 0.27, 1);
  k.glow(hood, rimArc, 0xffd070, 1.5, [0, 0, 0.055], [0, 0, 0], 0.9);
  k.glow(hood, new THREE.TorusGeometry(0.05, 0.008, 6, 20), 0xffc040, 1.8, [0, 0.12, 0.06]);
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) k.sphere(hood, 0xc89a58, 1, [sx * 0.19, 0.1 - i * 0.1, 0.07], [0.07 - i * 0.012, 0.018, 0.01], [0, 0, sx * (0.35 - i * 0.25)], { outline: false });
    for (let i = 0; i < 4; i++) {
      const phi = sx * (0.5 + i * 0.42);
      const L = 0.17 - i * 0.02;
      const bx = Math.sin(phi) * 0.34;
      const by = Math.cos(phi) * 0.28;
      k.cone(hood, i % 2 ? sand : 0xc89a58, 0.042, L, [bx, by, 0], [0, 0, -phi], 6);
      k.cone(hood, dia, 0.019, L * 0.4, [bx + Math.sin(phi) * L * 0.62, by + Math.cos(phi) * L * 0.62, 0], [0, 0, -phi], 6, { outline: false });
    }
  }
  // Head
  const head = k.group(c.body, [0, 1.05, 0.14]);
  c.head = head;
  k.sphere(head, sand, 0.19, [0, 0, 0.02], [1.05, 0.78, 1.2]);
  k.sphere(head, cream, 0.14, [0, -0.07, 0.09], [0.95, 0.5, 1.05], [0, 0, 0], { outline: false });
  k.sphere(head, dia, 0.06, [0, 0.125, -0.03], [1.3, 0.3, 1.6], [0, 0, 0], { outline: false });
  for (const sx of [-1, 1]) k.sphere(head, 0x3a2a1a, 0.013, [sx * 0.045, 0.01, 0.245], [1, 0.7, 0.6], [0, 0, 0], { outline: false });
  k.eyes(head, { x: 0.1, y: 0.045, z: 0.185, r: 0.064, iris: 0xffb020, sharp: true, glow: true });
  // A gold-sand gem on the forehead
  k.mesh(head, new THREE.OctahedronGeometry(0.03, 0), 0xffd070, [0, 0.12, 0.12], [0.4, 0, 0], { emissive: 0xffc040, emissiveAmt: 0.7 });
  for (const sx of [-1, 1]) k.sphere(head, dia, 0.058, [sx * 0.1, 0.115, 0.165], [1.1, 0.26, 0.5], [0, 0, -sx * 0.35], { outline: false });
  // Forked tongue
  const tongue = k.group(head, [0, -0.07, 0.23], [0.25, 0, 0]);
  k.capsule(tongue, 0xe04a5a, 0.01, 0.08, [0, 0, 0.05], [PI / 2, 0, 0], { outline: false });
  for (const sx of [-1, 1]) k.cone(tongue, 0xe04a5a, 0.01, 0.04, [sx * 0.008, 0, 0.1], [PI / 2, 0, -sx * 0.5], 5, { outline: false });
  // Floating sand grains and a sand swirl
  const swirl = k.group(c.body, [0, 0, 0]);
  c.spinners.push({ g: swirl, speed: 0.6, axis: 'y' });
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4;
    const R = 0.66 + (i % 3) * 0.1;
    const m = i % 3 === 0 ? k.glowSphere(swirl, 0xffe6a8, 0.018, [Math.sin(a) * R, 0.3 + (i % 4) * 0.17, Math.cos(a) * R], 2) : k.sphere(swirl, i % 2 ? 0xf0d090 : 0xc89858, 0.02 + (i % 3) * 0.008, [Math.sin(a) * R, 0.3 + (i % 4) * 0.17, Math.cos(a) * R], [1, 1, 1], [0, 0, 0], { outline: false });
    c.bobbers.push({ g: m, base: m.position.y, amp: 0.06, speed: 1.5 + (i % 3) * 0.5, phase: i });
  }
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.TorusGeometry(0.72 + i * 0.12, 0.01, 6, 48, PI * 1.1);
    k.glow(swirl, ring, 0xf6dca0, 1.4, [0, 0.24 + i * 0.3, 0], [PI / 2 - 0.1, 0, i * 2.5], 0.6);
  }
};

// ───────────────────────── Thunderplain (thunder) ─────────────────────────

const hedgehog: Builder = (k, c, s) => {
  const face = 0x8a6a4a;
  const quill = 0x4e3e34;
  const tip = 0xffe04a;
  const cream = 0xecd6b4;
  const paw = 0x5a4030;
  const spikeList = (center: THREE.Vector3, rad: THREE.Vector3, n: number, keep: (d: THREE.Vector3) => boolean, h: number, r: number, sweep: THREE.Vector3): Spike[] => {
    const out: Spike[] = [];
    for (const d of fib(n)) {
      if (!keep(d)) continue;
      const p = center.clone().add(v3(d.x * rad.x, d.y * rad.y, d.z * rad.z).multiplyScalar(0.88));
      out.push({ p, d: d.clone().add(sweep), r, h: h * (0.85 + ((out.length * 7) % 5) * 0.06) });
    }
    return out;
  };
  const r = [0.34, 0.38, 0.42][s - 1];
  const len = [0.34, 0.4, 0.46][s - 1];
  const q = quad(k, c, { col: face, belly: cream, len, r, leg: [0.09, 0.11, 0.13][s - 1], legR: 0.07 + s * 0.005, headR: [0.27, 0.26, 0.26][s - 1], headZ: -0.02, paw });
  const h = q.head;
  const hr = q.headR;
  // Pointed nose
  k.sphere(h, face, 0.12, [0, -0.07, hr * 0.72], [0.85, 0.72, 1.3]);
  k.sphere(h, cream, 0.1, [0, -0.1, hr * 0.74], [0.95, 0.5, 1.1], [0, 0, 0], { outline: false });
  k.sphere(h, 0x2a1a14, 0.038, [0, -0.05, hr * 0.72 + 0.15]);
  for (const sx of [-1, 1]) k.sphere(h, cream, 0.1, [sx * 0.1, 0.02, hr * 0.62], [1, 1.1, 0.5], [0, sx * 0.5, 0], { outline: false });
  k.eyes(h, { x: 0.105, y: 0.05, z: hr * 0.82, r: 0.07, iris: s === 3 ? 0xc88a10 : 0x2a1a10 });
  k.blush(h, 0.18, -0.06, hr * 0.72, 0.042);
  roundEars(k, c, h, face, 0xffb4a4, 0.055, hr * 0.78, hr * 0.46);
  // Spines: a patch on the body, a patch on the head running back from the brow
  const bodyH = [0.2, 0.3, 0.34][s - 1];
  const bodyList = spikeList(v3(0, q.bodyY, 0), v3(r, r * 0.88, len), [80, 100, 120][s - 1], (d) => d.y > -0.35 && d.z < 0.5, bodyH, 0.05 + s * 0.004, v3(0, 0.25, -0.5));
  spikes(k, c.body, bodyList, quill, tip);
  const headList = spikeList(v3(0, 0, 0), v3(hr, hr, hr), 60, (d) => d.y > 0.38 && d.z < 0.45, bodyH * 0.8, 0.045, v3(0, 0.35, -0.75));
  spikes(k, h, headList, quill, tip);
  k.sphere(q.tail, quill, 0.05);
  if (s === 2) sparks(k, c.body, 0xfff27a, 5, 0.48, q.bodyY + 0.36, 0.1, 0.2);
  if (s === 3) {
    // Big lightning-bolt spines spreading across the back like a crown
    for (let i = 0; i < 7; i++) {
      const a = (i - 3) * 0.42;
      const L = 0.44 - Math.abs(i - 3) * 0.045;
      const p = v3(Math.sin(a) * r * 0.62, q.bodyY + Math.cos(a) * r * 0.62, -0.08);
      k.glow(c.body, boltGeo(L, L * 0.5, 0.03), tip, 1.7, [p.x, p.y, p.z], [-0.35, 0, -a]);
    }
    // Lightning-rod antenna
    const rod = k.group(h, [0, hr * 0.9, -0.02]);
    k.cyl(rod, 0xffcf5a, 0.06, 0.07, 0.05, [0, 0, 0]);
    k.cyl(rod, 0xc8ccd8, 0.018, 0.024, 0.44, [0, 0.24, 0]);
    k.torus(rod, 0xffcf5a, 0.042, 0.012, [0, 0.17, 0], [PI / 2, 0, 0]);
    k.torus(rod, 0xffcf5a, 0.032, 0.01, [0, 0.31, 0], [PI / 2, 0, 0]);
    k.cone(rod, 0xe8ecf4, 0.02, 0.1, [0, 0.45, 0], [0, 0, 0], 8);
    k.glowSphere(rod, tip, 0.04, [0, 0.5, 0], 2.4);
    sparks(k, rod, 0xfff27a, 3, 0.12, 0.44, 0.09, 0.1);
    sparks(k, c.body, 0xfff27a, 4, 0.6, q.bodyY + 0.3, 0.12, 0.3);
  }
};

const ballspark: Builder = (k, c, s) => {
  floater(c, 0.3);
  const core = 0xfff080;
  const purple = 0xb07aff;
  const r = [0.3, 0.31, 0.32][s - 1];
  const y = r + 0.02;
  k.sphere(c.body, core, r, [0, y, 0], [1, 1, 1], [0, 0, 0], { emissive: 0xffe060, emissiveAmt: 0.45 });
  k.glowSphere(c.body, 0xfff4a0, r * 1.16, [0, y, 0], 0.9, [1, 1, 1], 0.2);
  // Plasma streaks flowing across the surface: a few purple-white arcs hugging the sphere, the whole set rotating slowly
  const plasma = k.group(c.body, [0, y, 0], [0.4, 0, 0.3]);
  for (let i = 0; i < 4; i++) {
    const arc = new THREE.TorusGeometry(r * 1.015, 0.009, 6, 36, PI * (0.5 + (i % 2) * 0.3));
    k.glow(plasma, arc, i % 2 ? 0xd8b8ff : 0xffffff, 1.6, [0, 0, 0], [i * 0.8, i * 1.9, i * 0.6], 0.85);
  }
  c.spinners.push({ g: plasma, speed: 1.3, axis: 'y' });
  const head = k.group(c.body, [0, y, 0]);
  c.head = head;
  k.eyes(head, { x: 0.1, y: 0.04, z: r * 0.88, r: 0.064, iris: 0x5a2aa0 });
  k.blush(head, 0.18, -0.05, r * 0.8, 0.042, 0xffa070);
  k.torus(head, 0x4a2a5a, 0.035, 0.01, [0, -0.06, r * 0.97], [0.2, 0, PI], PI, { outline: false });
  // Rotating electric rings: the outer group holds a fixed tilt and the inner group rotates about its own normal (bright beads on the ring make the rotation visible)
  const ringSet = (R: number, tilt: number, yaw: number, speed: number, col: C, beads: number) => {
    const holder = k.group(c.body, [0, y, 0], [tilt, yaw, 0]);
    const spin = k.group(holder);
    k.torus(spin, col, R, 0.024, [0, 0, 0], [0, 0, 0], PI * 2, { emissive: col, emissiveAmt: 0.45 });
    for (let i = 0; i < beads; i++) {
      const a = (i / beads) * PI * 2;
      k.glowSphere(spin, 0xffffff, 0.03, [Math.cos(a) * R, Math.sin(a) * R, 0], 2.2);
    }
    c.spinners.push({ g: spin, speed, axis: 'z' });
    return holder;
  };
  if (s < 3) ringSet(r * 1.5, PI / 2 - 0.35, 0, 2.2, purple, 3);
  if (s >= 2) {
    // Plasma spikes (flickering)
    const dirs = fib(14);
    let j = 0;
    for (const d of dirs) {
      if (d.z > 0.45 || Math.abs(d.y) > 0.92) continue;
      const g = aim(k.group(c.body, [d.x * r * 0.92, y + d.y * r * 0.92, d.z * r * 0.92]), d);
      const geo = new THREE.ConeGeometry(0.045, s === 2 ? 0.18 : 0.14, 8);
      geo.translate(0, s === 2 ? 0.09 : 0.07, 0);
      k.glow(g, geo, j % 2 ? 0xfff2a0 : 0xd8b8ff, 1.6);
      c.flickers.push({ g, base: g.scale.clone(), speed: 10 + j, amt: 0.35 });
      j++;
    }
  }
  if (s === 3) {
    ringSet(r * 1.5, PI / 2 - 0.3, 0, 1.8, purple, 2);
    ringSet(r * 1.62, 0.55, PI / 3, -1.4, 0xd0a8ff, 2);
    ringSet(r * 1.74, -0.55, -PI / 3, 1.2, 0xffe070, 2);
    // Electric arcs
    for (let i = 0; i < 4; i++) {
      const a = i * 1.57 + 0.5;
      const g = k.group(c.body, [Math.sin(a) * r * 1.3, y + (i % 2 ? 0.22 : -0.2), Math.cos(a) * r * 1.3], [0, a, (i % 2 ? 1 : -1) * 0.9]);
      k.glow(g, boltGeo(0.22, 0.12, 0.012), 0xe8d0ff, 2.2);
      c.flickers.push({ g, base: g.scale.clone(), speed: 16 + i * 2, amt: 0.6 });
    }
  }
  const nSparks = [2, 3, 4][s - 1];
  for (let i = 0; i < nSparks; i++) sparkle(k, c, c.body, 0xfff6a0, 0.022, [Math.cos(i * 2.3) * r * 1.9, y + (i % 2 ? 0.3 : -0.1), Math.sin(i * 2.3) * r * 1.6], 0.06);
};

/** `stormhorse`: a slender deep blue-gray horse, a mane and tail made of electric light sheets; thunder-marked hoof armor at II, a lightning horn and nomad saddle blanket at III */
const stormhorse: Builder = (k, c, s) => {
  c.archetype = 'quad';
  const col = 0x3a4a6a;
  const dark = 0x28344e;
  const muzzle = 0x5a6a8e;
  const belly = 0x51627f;
  const mane = 0x7ae0ff;
  const maneHi = 0xb8f4ff;
  const gold = 0xffd24a;
  const steel = 0x8aa0c8;
  const legH = [0.36, 0.44, 0.5][s - 1];
  const sc = [0.8, 0.92, 1][s - 1];
  const bodyY = legH + 0.2 * sc;
  // Body: three sections of chest, belly and haunch, a light chest and belly
  k.sphere(c.body, col, 1, [0, bodyY, 0.16 * sc], [0.23 * sc, 0.24 * sc, 0.3 * sc]);
  k.sphere(c.body, col, 1, [0, bodyY - 0.01, -0.08 * sc], [0.21 * sc, 0.21 * sc, 0.28 * sc]);
  k.sphere(c.body, col, 1, [0, bodyY + 0.01, -0.3 * sc], [0.22 * sc, 0.23 * sc, 0.24 * sc]);
  k.sphere(c.body, belly, 1, [0, bodyY - 0.12 * sc, 0.0], [0.17 * sc, 0.14 * sc, 0.42 * sc], [0, 0, 0], { outline: false });
  // Limbs: slender legs, joint balls, dark hooves
  const legAt = (sx: number, z: number, front: boolean) => {
    const g = k.group(c.body, [sx * 0.14 * sc, legH, z]);
    k.sphere(g, col, 0.075 * sc, [0, 0, front ? 0.01 : -0.02], [1, 1.25, 1.1]);
    k.capsule(g, col, 0.045 * sc, legH * 0.34, [0, -legH * 0.24, front ? 0.01 : -0.03], [front ? -0.1 : 0.22, 0, 0]);
    k.sphere(g, dark, 0.04 * sc, [0, -legH * 0.48, front ? 0.02 : -0.05]);
    k.capsule(g, col, 0.032 * sc, legH * 0.36, [0, -legH * 0.72, front ? 0.02 : -0.03], [front ? 0.04 : -0.1, 0, 0]);
    k.cyl(g, dark, 0.048 * sc, 0.055 * sc, 0.06 * sc, [0, -legH + 0.03 * sc, front ? 0.03 : -0.01], [0, 0, 0], 12);
    if (s >= 2) {
      // Thunder-marked hoof armor
      const y0 = -legH + 0.1 * sc;
      k.cyl(g, steel, 0.058 * sc, 0.066 * sc, 0.08 * sc, [0, y0, front ? 0.03 : -0.01], [0, 0, 0], 12);
      k.torus(g, gold, 0.062 * sc, 0.01, [0, y0 + 0.04 * sc, front ? 0.03 : -0.01], [PI / 2, 0, 0]);
      k.glow(g, boltGeo(0.07 * sc, 0.045 * sc, 0.01), gold, 1.8, [0, y0 - 0.035 * sc, (front ? 0.03 : -0.01) + 0.065 * sc]);
    }
    c.legs.push({ g, phase: sx * (front ? 1 : -1) > 0 ? 0 : PI, amp: 1 });
  };
  for (const sx of [-1, 1]) {
    legAt(sx, 0.2 * sc, true);
    legAt(sx, -0.28 * sc, false);
  }
  // Neck and head: a neck stretching forward and up, a long horse face, ears, a white blaze on the brow
  const neckPts = [v3(0, bodyY + 0.12 * sc, 0.26 * sc), v3(0, bodyY + 0.34 * sc, 0.38 * sc), v3(0, bodyY + 0.52 * sc, 0.44 * sc)];
  const neck = taperTube(neckPts, (t) => (0.12 - t * 0.035) * sc, 20, 14);
  k.mesh(c.body, neck.geo, col);
  const hr = [0.15, 0.14, 0.14][s - 1];
  const head = k.group(c.body, [0, bodyY + 0.56 * sc, 0.45 * sc], [0.3, 0, 0]);
  c.head = head;
  k.sphere(head, col, hr, [0, 0, 0], [0.92, 0.92, 1]);
  k.sphere(head, col, hr * 0.72, [0, -hr * 0.35, hr * 0.85], [0.82, 0.75, 1.5]);
  k.sphere(head, muzzle, hr * 0.5, [0, -hr * 0.62, hr * 1.5], [0.9, 0.75, 0.9]);
  k.sphere(head, 0xdfe6f0, hr * 0.32, [0, hr * 0.05, hr * 0.9], [0.55, 1.4, 0.7], [0.35, 0, 0], { outline: false });
  for (const sx of [-1, 1]) k.sphere(head, 0x1a2234, hr * 0.1, [sx * hr * 0.22, -hr * 0.55, hr * 1.85], [1, 1.3, 0.5], [0, sx * 0.4, 0], { outline: false });
  k.eyes(head, { x: hr * 0.62, y: hr * 0.15, z: hr * 0.62, r: [0.062, 0.056, 0.052][s - 1], iris: 0x2a8ab8, glow: s === 3, sharp: s === 3, yaw: 0.5 });
  if (s === 1) k.blush(head, hr * 0.8, -hr * 0.2, hr * 0.55, 0.035);
  ears(k, c, head, col, mane, hr * 0.28, hr * 0.85, hr * 0.5, hr * 0.85, 0.25, -hr * 0.2);
  // Electric-light mane: a row of lightning sheets from the brow along the back of the neck, longer toward the back and swept back
  const nm = [6, 8, 11][s - 1];
  const ml = [0.16, 0.22, 0.3][s - 1];
  const A = v3(0, bodyY + 0.6 * sc, 0.42 * sc);
  const B = v3(0, bodyY + 0.24 * sc, 0.16 * sc);
  for (let i = 0; i < nm; i++) {
    const t = i / (nm - 1);
    const p = A.clone().lerp(B, t);
    const L = ml * (0.8 + Math.sin(t * PI) * 0.4);
    const m = k.glow(c.body, boltGeo(L, L * 0.5, 0.03), i % 2 ? mane : maneHi, 1.5, [(i % 2 ? 1 : -1) * 0.012, p.y - 0.02, p.z - 0.03 * sc], [-0.55 - t * 0.55, PI / 2, 0]);
    c.flickers.push({ g: m, base: m.scale.clone(), speed: 5 + (i % 3), amt: 0.12 });
  }
  k.glow(head, boltGeo(ml * 0.8, ml * 0.42, 0.025), maneHi, 1.5, [0, hr * 0.7, hr * 0.35], [0.5, PI / 2, 0]);
  if (s === 3) for (let i = 0; i < 4; i++) k.glow(c.body, boltGeo(0.26 - i * 0.03, 0.13, 0.03), i % 2 ? maneHi : mane, 1.5, [0, bodyY + 0.22 * sc, 0.2 * sc - i * 0.1], [-1.7, PI / 2, 0]);
  // Tail: a bundle of electric-light sheets thrown backward and downward
  const tail = k.group(c.body, [0, bodyY + 0.12 * sc, -0.52 * sc], [0.6, 0, 0]);
  const nt = [4, 5, 7][s - 1];
  const tl = [0.28, 0.36, 0.46][s - 1];
  for (let i = 0; i < nt; i++) {
    const a = (i - (nt - 1) / 2) * 0.22;
    const m = k.glow(tail, boltGeo(tl * (1 - Math.abs(a) * 0.6), 0.14, 0.03), i % 2 ? maneHi : mane, 1.5, [a * 0.12, 0, 0], [-PI / 2 - 0.55 + Math.abs(a) * 0.5, PI / 2 + a, 0]);
    c.flickers.push({ g: m, base: m.scale.clone(), speed: 6 + i, amt: 0.1 });
  }
  c.tails.push({ g: tail, phase: 0, amp: 0.3, axis: 'y' });
  if (s === 3) {
    // Lightning horn on the brow
    k.glow(head, boltGeo(0.32, 0.14, 0.05), gold, 2, [0, hr * 0.55, hr * 0.7], [0.55, PI / 2, 0]);
    k.torus(head, gold, 0.03, 0.01, [0, hr * 0.62, hr * 0.7], [0.55 + PI / 2, 0, 0]);
    // Nomad saddle blanket: red with a gold edge and blue patterns, tassels hanging on both sides
    const ry = 0.22 * sc;
    const rx = 0.215 * sc;
    const rz = 0.3 * sc;
    const bz = -0.06 * sc;
    k.mesh(c.body, bandGeo(rx * 1.06, ry * 1.08, rz * 1.03, 0.4, 0.42), 0xc8453a, [0, bodyY, bz]);
    k.mesh(c.body, bandGeo(rx * 1.075, ry * 1.09, rz * 1.04, 0.34, 0.32), gold, [0, bodyY, bz], [0, 0, 0], { outline: false });
    k.mesh(c.body, bandGeo(rx * 1.085, ry * 1.1, rz * 1.045, 0.28, 0.26), 0x2a8ab8, [0, bodyY, bz], [0, 0, 0], { outline: false });
    k.mesh(c.body, bandGeo(rx * 1.095, ry * 1.11, rz * 1.05, 0.22, 0.2), 0xc8453a, [0, bodyY, bz], [0, 0, 0], { outline: false });
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) k.sphere(c.body, i % 2 ? gold : mane, 0.02, [sx * rx * 1.02, bodyY - 0.12 * sc, bz - 0.15 * sc + i * 0.1 * sc], [1, 1.6, 1], [0, 0, 0], { outline: false });
    k.sphere(c.body, 0x6a4028, 1, [0, bodyY + ry * 1.1, bz], [0.11, 0.045, 0.14]);
    k.torus(c.body, gold, 0.06, 0.008, [0, bodyY + ry * 1.12, bz - 0.1], [0, 0, 0]);
    sparks(k, c.body, maneHi, 4, 0.5, bodyY + 0.3, 0.1, 0.25, 1.8);
  }
  if (s === 2) sparks(k, c.body, maneHi, 2, 0.4, bodyY + 0.3, 0.08, 0.2, 1.6);
};

const thunderbird: Builder = (k, c) => {
  c.archetype = 'bird';
  c.hover = 0.1;
  const cloud = 0x4a4f66;
  const cloudHi = 0x5e647e;
  const f2 = 0x3c4056;
  const chest = 0x8e95b2;
  const bolt = 0xffe04a;
  const elec = 0xbff4ff;
  const y = 0.62;
  // Thundercloud beneath the feet
  const cl = k.group(c.body, [0, 0.13, 0]);
  const puffs: [number, number, number, number, C][] = [
    [0, 0.05, 0, 0.2, 0x6c7390],
    [0.24, 0, 0.05, 0.15, 0x646a86],
    [-0.24, 0, 0.03, 0.16, 0x646a86],
    [0.12, 0.02, -0.18, 0.15, 0x585e78],
    [-0.14, 0.02, -0.16, 0.14, 0x585e78],
    [0.04, -0.01, 0.2, 0.13, 0x7a809c],
    [0.4, -0.03, -0.05, 0.1, 0x585e78],
    [-0.4, -0.03, -0.03, 0.11, 0x585e78],
  ];
  for (const [x, yy, z, rr, cc] of puffs) k.sphere(cl, cc, rr, [x, yy, z], [1, 0.7, 1]);
  for (let i = 0; i < 3; i++) {
    const g = k.group(cl, [(i - 1) * 0.24, -0.06, 0.06 + (i % 2) * 0.06], [PI, 0, (i - 1) * 0.3]);
    k.glow(g, boltGeo(0.18, 0.1, 0.015), bolt, 2);
    c.flickers.push({ g, base: g.scale.clone(), speed: 13 + i * 3, amt: 0.7 });
  }
  // Feet
  for (const sx of [-1, 1]) {
    const leg = k.group(c.body, [sx * 0.12, y - 0.3, 0.04]);
    k.capsule(leg, 0xffc83a, 0.035, 0.12, [0, -0.07, 0]);
    for (let i = -1; i <= 1; i++) k.cone(leg, 0x3a3a48, 0.02, 0.07, [i * 0.03, -0.17, 0.03], [PI / 2 - 0.3, i * 0.4, 0], 6);
  }
  // Body
  k.sphere(c.body, cloud, 1, [0, y, 0], [0.34, 0.37, 0.38]);
  k.sphere(c.body, chest, 1, [0, y - 0.04, 0.15], [0.25, 0.28, 0.25], [0, 0, 0], { outline: false });
  for (let i = 0; i < 3; i++) k.sphere(c.body, 0xb4bad0, 0.05, [(i - 1) * 0.09, y - 0.02 - (i % 2) * 0.06, 0.37], [1, 0.5, 0.4], [0, 0, 0], { outline: false });
  // Thundercloud collar feathers
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.55;
    k.sphere(c.body, i % 2 ? cloudHi : cloud, 0.12, [Math.sin(a) * 0.24, y + 0.26, Math.cos(a) * 0.12 - 0.02], [1, 0.8, 1]);
  }
  // Head
  const head = k.group(c.body, [0, y + 0.38, 0.14]);
  c.head = head;
  k.sphere(head, cloud, 0.23);
  k.sphere(head, chest, 0.14, [0, -0.08, 0.1], [1.1, 0.8, 0.9], [0, 0, 0], { outline: false });
  k.horn(head, 0xffc83a, 0.07, 0.2, 0.09, [0, -0.03, 0.17], [-PI / 2 + 0.1, 0, PI]);
  k.eyes(head, { x: 0.1, y: 0.05, z: 0.17, r: 0.064, iris: bolt, glow: true, sharp: true });
  for (const sx of [-1, 1]) k.sphere(head, 0x2e3244, 0.06, [sx * 0.1, 0.125, 0.16], [1.3, 0.35, 0.5], [0, 0, -sx * 0.35]);
  // Lightning crest: one running lengthwise in the middle, the others spreading outward at the sides
  k.glow(head, boltGeo(0.4, 0.2, 0.03), bolt, 1.8, [0, 0.16, -0.02], [-0.6, PI / 2, 0]);
  for (const sx of [-1, 1]) k.glow(head, boltGeo(0.3, 0.16, 0.03), bolt, 1.8, [sx * 0.08, 0.16, -0.06], [-0.35, 0, -sx * 0.55]);
  // Wings: eight thundercloud-colored flight feathers fanned across the wing like a folding fan, each feather with a lightning mark and a point of electric light at its tip
  for (const sx of [-1, 1]) {
    const w = k.group(c.body, [sx * 0.24, y + 0.2, -0.04], [-0.1, -sx * 0.12, 0]);
    c.wings.push({ g: w, side: sx < 0 ? 1 : -1, base: 0.68, amp: 0.26, speed: 3 });
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const L = 1.05 * (1 - t * 0.42);
      const rot: V3 = [-0.06 * t, 0, -sx * t * 1.15];
      const z = -t * 0.03;
      k.blade(w, i % 2 ? f2 : cloud, L, 0.17, 0.05, [0, 0, z], rot);
      const fg = k.group(w, [0, 0, z], rot);
      k.blade(fg, cloudHi, L * 0.5, 0.11, 0.058, [0, L * 0.3, 0], [0, 0, 0], { outline: false });
      for (const zz of [0.032, -0.032]) k.glow(fg, boltGeo(L * 0.3, L * 0.14, 0.008), bolt, 1.25, [0, L * 0.5, zz]);
      k.glowSphere(fg, elec, 0.028, [0, L * 0.98, 0], 2.2);
    }
    k.sphere(w, cloud, 0.1, [0, 0.06, 0.02], [1, 1.2, 0.8]);
  }
  // Tail feathers: electric light at the ends
  const tail = k.group(c.body, [0, y - 0.1, -0.3], [0, 0, 0]);
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.28;
    const g = k.group(tail, [a * 0.1, 0, 0], [-2.1 + Math.abs(a) * 0.3, a, 0]);
    const L = 0.66 - Math.abs(i - 2) * 0.07;
    k.blade(g, i % 2 ? f2 : cloud, L, 0.14, 0.04, [0, 0, 0]);
    k.glow(g, boltGeo(0.14, 0.08, 0.012), i % 2 ? elec : bolt, 2, [0, L * 0.92, 0]);
  }
  c.tails.push({ g: tail, phase: 0, amp: 0.15, axis: 'y' });
  sparks(k, c.body, elec, 4, 0.8, y + 0.2, 0.12, 0.4, 1.8);
};

/** `voltadillo`: a gray-blue armadillo, a segmented carapace with yellow electric light in the seams; III is steel-edged thunder armor + a charge-storing core on its back */
const voltadillo: Builder = (k, c, s) => {
  const hide = 0x6f7f9a;
  const belly = 0x9aa6b8;
  const shellC = [0x7f8da6, 0x74849e, 0x687a98][s - 1];
  const shellDk = 0x4e5a70;
  const seam = 0xffe05a;
  const seamHi = 0xfff2a0;
  const steel = 0xb8c0cc;
  const claw = 0x3a3a48;
  const len = [0.42, 0.5, 0.58][s - 1];
  const r = [0.3, 0.33, 0.36][s - 1];
  const leg = [0.14, 0.17, 0.2][s - 1];
  const legR = [0.06, 0.07, 0.08][s - 1];
  const q = quad(k, c, { col: hide, belly, len, r, leg, legR, headR: [0.25, 0.24, 0.24][s - 1], headZ: 0.02, paw: 0x56627a });
  const h = q.head;
  const hr = q.headR;
  // Carapace: a dome covering the back, a dark rim along the edge (steel at III), glowing segment seams across it
  const shell = k.group(c.body, [0, q.bodyY + 0.03, -0.02]);
  const a = r * 1.14;
  const b = r * 1.02;
  const cz = len * 1.08;
  const capAngle = PI * 0.58;
  const cap = new THREE.SphereGeometry(1, 30, 14, 0, PI * 2, 0, capAngle);
  cap.scale(a, b, cz);
  k.mesh(shell, cap, shellC);
  const rimR = Math.sin(capAngle);
  const rimY = b * Math.cos(capAngle);
  const rim = new THREE.TorusGeometry(1, s === 3 ? 0.11 : 0.08, 8, 48);
  rim.rotateX(PI / 2);
  rim.scale(a * rimR, 1, cz * rimR);
  k.mesh(shell, rim, s === 3 ? steel : shellDk, [0, rimY, 0]);
  const seamAt = (z0: number, glow: number, thick = 1) => {
    const f = Math.sqrt(Math.max(0.05, 1 - (z0 / cz) ** 2));
    const groove = new THREE.TorusGeometry(1, 0.05 * thick, 6, 40, PI * 1.3);
    groove.rotateZ(-PI * 0.15);
    groove.scale(a * f * 0.995, b * f * 0.995, 1);
    k.mesh(shell, groove, shellDk, [0, 0, z0], [0, 0, 0], { outline: false });
    const light = new THREE.TorusGeometry(1, 0.028 * thick, 6, 40, PI * 1.3);
    light.rotateZ(-PI * 0.15);
    light.scale(a * f * 1.01, b * f * 1.01, 1);
    k.glow(shell, light, seam, glow, [0, 0, z0]);
  };
  const nSeam = [3, 5, 6][s - 1];
  const glowAmt = [1.3, 1.7, 2.1][s - 1];
  for (let i = 0; i < nSeam; i++) {
    const z0 = cz * 0.55 - (i / (nSeam - 1)) * cz * 1.15;
    seamAt(z0, glowAmt, s === 3 ? 1.15 : 1);
  }
  if (s === 2) {
    // Charge nodes: electric beads lighting up one by one at the tops of the seams
    for (let i = 0; i < nSeam; i++) {
      const z0 = cz * 0.55 - (i / (nSeam - 1)) * cz * 1.15;
      const f = Math.sqrt(Math.max(0.05, 1 - (z0 / cz) ** 2));
      const m = k.glowSphere(shell, i % 2 ? seamHi : seam, 0.022, [0, b * f * 1.02, z0], 2.2);
      c.flickers.push({ g: m, base: m.scale.clone(), speed: 6 + i, amt: 0.3 });
    }
    sparks(k, c.body, 0xfff27a, 4, r * 1.25, q.bodyY + 0.28, 0.09, 0.2);
  }
  if (s === 3) {
    // Charge-storing core: a steel capacitor on top of the carapace, yellow light showing through the gaps, a rotating light ring outside it
    const core = k.group(shell, [0, b * 0.98, -cz * 0.05]);
    k.cyl(core, steel, 0.075, 0.09, 0.06, [0, 0.02, 0], [0, 0, 0], 16);
    k.cyl(core, seam, 0.055, 0.055, 0.075, [0, 0.03, 0], [0, 0, 0], 16, { outline: false, emissive: seam, emissiveAmt: 0.9 });
    k.cyl(core, steel, 0.065, 0.065, 0.025, [0, 0.075, 0], [0, 0, 0], 16);
    k.glowSphere(core, seamHi, 0.03, [0, 0.1, 0], 2.6);
    const ringG = k.group(core, [0, 0.05, 0]);
    k.torus(ringG, seam, 0.115, 0.01, [0, 0, 0], [PI / 2, 0, 0], PI * 2, { emissive: seam, emissiveAmt: 0.6 });
    k.glowSphere(ringG, 0xffffff, 0.018, [0.115, 0, 0], 2.4);
    k.glowSphere(ringG, 0xffffff, 0.018, [-0.115, 0, 0], 2.4);
    c.spinners.push({ g: ringG, speed: 2.4, axis: 'y' });
    // Electric arcs and sparks
    for (let i = 0; i < 4; i++) {
      const ang = i * 1.6 + 0.4;
      const g = k.group(shell, [Math.sin(ang) * a * 0.8, b * 0.7, Math.cos(ang) * cz * 0.7], [0, ang, (i % 2 ? 1 : -1) * 0.8]);
      k.glow(g, boltGeo(0.16, 0.09, 0.012), seamHi, 2.2);
      c.flickers.push({ g, base: g.scale.clone(), speed: 14 + i * 2, amt: 0.6 });
    }
    sparks(k, c.body, 0xfff27a, 5, r * 1.35, q.bodyY + 0.3, 0.1, 0.25);
    // Steel ankle guards and shoulder rivets
    for (const l of c.legs) k.torus(l.g, steel, legR * 1.15, 0.014, [0, -leg + legR * 1.5, 0.01], [PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * PI * 2;
      k.sphere(shell, steel, 0.02, [Math.sin(ang) * a * rimR, rimY + 0.01, Math.cos(ang) * cz * rimR], [1, 0.6, 1], [0, 0, 0], { outline: false });
    }
  }
  // Head: a long muzzle, a dark nose tip, big ears; from II the head also has a small head plate, and at III the head plate has a lightning-shaped crest
  k.sphere(h, hide, hr * 0.5, [0, -hr * 0.28, hr * 0.78], [0.78, 0.6, 1.45]);
  k.sphere(h, belly, hr * 0.42, [0, -hr * 0.42, hr * 0.8], [0.72, 0.4, 1.3], [0, 0, 0], { outline: false });
  k.sphere(h, 0x2e3140, hr * 0.13, [0, -hr * 0.18, hr * 1.45]);
  k.eyes(h, { x: hr * 0.42, y: hr * 0.18, z: hr * 0.82, r: [0.07, 0.065, 0.06][s - 1], iris: s === 3 ? seam : 0x2a2a3a, glow: s === 3 });
  if (s < 3) k.blush(h, hr * 0.78, -hr * 0.12, hr * 0.7, 0.04);
  for (const sx of [-1, 1]) k.sphere(h, shellDk, hr * 0.16, [sx * hr * 0.42, hr * 0.42, hr * 0.78], [1.3, 0.3, 0.6], [0, 0, -sx * 0.35]);
  ears(k, c, h, hide, 0xd8a0a8, hr * 0.22, hr * 0.68, hr * 0.55, hr * 0.72, 0.4, -hr * 0.2);
  if (s >= 2) {
    const hcap = new THREE.SphereGeometry(1, 20, 10, 0, PI * 2, 0, PI * 0.42);
    hcap.scale(hr * 1.06, hr * 0.95, hr * 1.06);
    k.mesh(h, hcap, shellC, [0, 0.02, -0.03]);
    const light = new THREE.TorusGeometry(hr * 0.92, 0.02, 6, 32, PI * 1.1);
    light.rotateZ(-PI * 0.05);
    k.glow(h, light, seam, glowAmt, [0, 0.02, -0.03 + hr * 0.25]);
    if (s === 3) k.glow(h, boltGeo(0.24, 0.12, 0.03), seam, 2, [0, hr * 0.85, -0.02], [-0.5, PI / 2, 0]);
  }
  // Claws: three digging claws on each foot
  for (const l of c.legs) {
    for (let i = -1; i <= 1; i++) k.cone(l.g, claw, legR * 0.3, legR * 1.1, [i * legR * 0.6, -leg + legR * 0.55, legR * 1.3], [PI / 2 + 0.5, 0, i * 0.2], 6);
  }
  // Tail: a segmented tapered tail, fitted with steel rings at III and a point of electric light at the tip
  const tail = k.group(q.tail, [0, 0, 0], [0.55, 0, 0]);
  const tl = [0.22, 0.28, 0.34][s - 1];
  k.cyl(tail, hide, 0.018, r * 0.28, tl, [0, 0, -tl / 2], [PI / 2, 0, 0], 12);
  for (let i = 0; i < 3; i++) {
    const t = 0.2 + i * 0.28;
    k.torus(tail, s === 3 ? steel : shellDk, r * 0.28 * (1 - t) + 0.018 * t + 0.004, 0.012, [0, 0, -tl * t], [0, 0, 0], PI * 2, { outline: false });
  }
  if (s === 3) k.glowSphere(tail, seamHi, 0.024, [0, 0, -tl - 0.01], 2.4);
  c.tails.push({ g: tail, phase: 0, amp: 0.2, axis: 'y' });
};

export const SPECIES_EARTH_THUNDER: Record<string, Builder> = {
  digmole,
  gargoyle,
  rhino,
  sandserpent,
  hedgehog,
  ballspark,
  stormhorse,
  thunderbird,
  voltadillo,
};
