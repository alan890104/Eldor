// Stormram (model lab version): a sheep whose wool keeps building up static electricity. The nomads of the wilds shear its wool to make thunder-pattern amulets, and on stormy nights the whole camp glows.
// Thunder, R, charge storing / magic (trait "Charged Wool": gains a charge at the end of the turn). Identifying features:
// 1. A coat of thundercloud-like wool: a big cloud piled up from clumps of fleece, light gray on top and the dark gray-blue of storm clouds under the belly, with two small yellow electric arcs occasionally jumping between the clumps;
// 2. A pair of big spiral horns (the "storm horns") curling back, down and then forward, pale gold with ridges ring after ring, and yellow electric light at the horn tips;
// 3. A thunder-pattern amulet woven by the nomads hanging on the chest: a red cord, an indigo round plaque set with a yellow bolt of lightning, and a tuft of red tassel below.
// Back: an indigo felt blanket the nomads laid on its back, following the rise and fall of the fleece clumps, piped in yellow, embroidered with lightning patterns on both sides and with red tassels hanging from the four corners (the camp's sheep).
// Body shape: a ram standing on four legs, the body entirely buried in the cloud of wool, showing only the dark blue-gray long face, thin legs and black hooves; head lowered and horns pointing forward as if ready to butt at any moment.
// Personality: a stubborn, competitive ram charged with electricity, who must butt anyone who comes near first. Personality comes from the lowered head, the forward horns and the pawing front hoof, and the face follows a real sheep:
// the eyes on the sides have amber irises filling the whole eye with horizontal pupils, with two nostrils at the muzzle tip and a Y-shaped lip split, and no human brows or smiling mouth.
// Gaze order: the dark face and the golden storm horns first, the thunder-pattern amulet on the chest second, and the wool cloud and the felt blanket on the back as support.
// Action table: idle is breathing, lowering the head into the wind, pawing a front hoof now and then and the arcs flickering; charge-up bursts the wool out and keeps the arcs lit (act.charge); strike lowers the head and butts forward (act.ram),
// with electricity shooting from the horn tips (anchors hornL, hornR); hit bursts the wool out with the feet not retreating; victory raises the head and tosses the horns.
// Anchors: head, eyes, mouth, hornL, hornR (horn tips), amulet (the amulet), wool (highest point on the back), spark (the arcs).

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, rng, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);
const X = v3(1, 0, 0);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

// ───────────────────────── Distance field (same as Grove Hoarder) ─────────────────────────

interface Ell {
  c: THREE.Vector3;
  r: THREE.Vector3;
  inv: THREE.Quaternion;
  k: number;
}

class Blob {
  parts: Ell[] = [];
  private l = new THREE.Vector3();
  private q = new THREE.Vector3();
  add(c: THREE.Vector3, r: THREE.Vector3, q = new THREE.Quaternion(), k = 0.08): void {
    this.parts.push({ c: c.clone(), r: r.clone(), inv: q.clone().invert(), k });
  }
  f(p: THREE.Vector3): number {
    let d = 0;
    for (let i = 0; i < this.parts.length; i++) {
      const e = this.parts[i];
      const l = this.l.copy(p).sub(e.c).applyQuaternion(e.inv);
      const ax = l.x / e.r.x;
      const ay = l.y / e.r.y;
      const az = l.z / e.r.z;
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
      const bx = ax / e.r.x;
      const by = ay / e.r.y;
      const bz = az / e.r.z;
      const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
      const di = k1 < 1e-9 ? -Math.min(e.r.x, e.r.y, e.r.z) : (k0 * (k0 - 1)) / k1;
      if (i === 0) d = di;
      else {
        const h = Math.max(e.k - Math.abs(d - di), 0) / e.k;
        d = Math.min(d, di) - h * h * e.k * 0.25;
      }
    }
    return d;
  }
  grad(p: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
    const h = 4e-4;
    const q = this.q;
    const dx = this.f(q.copy(p).setX(p.x + h)) - this.f(q.copy(p).setX(p.x - h));
    const dy = this.f(q.copy(p).setY(p.y + h)) - this.f(q.copy(p).setY(p.y - h));
    const dz = this.f(q.copy(p).setZ(p.z + h)) - this.f(q.copy(p).setZ(p.z - h));
    return out.set(dx, dy, dz).normalize();
  }
  march(o: THREE.Vector3, d: THREE.Vector3, tmax = 2): THREE.Vector3 {
    const q = new THREE.Vector3();
    let t = 0;
    let fv = this.f(o);
    while (t < tmax) {
      const t1 = t + clamp(Math.abs(fv) * 0.6, 0.002, 0.03);
      const f1 = this.f(q.copy(o).addScaledVector(d, t1));
      if (f1 > 0) {
        let a = t;
        let b = t1;
        for (let i = 0; i < 16; i++) {
          const m = (a + b) / 2;
          if (this.f(q.copy(o).addScaledVector(d, m)) > 0) b = m;
          else a = m;
        }
        return o.clone().addScaledVector(d, (a + b) / 2);
      }
      t = t1;
      fv = f1;
    }
    return o.clone().addScaledVector(d, tmax);
  }
  hit(o: THREE.Vector3, d: THREE.Vector3): { p: THREE.Vector3; n: THREE.Vector3 } {
    const p = this.march(o, d.clone().normalize());
    return { p, n: this.grad(p) };
  }
}

function blobGeo(blob: Blob, center: THREE.Vector3, detail: number, focus: THREE.Vector3, pull: number, paint: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const base = new THREE.IcosahedronGeometry(1, detail);
  base.deleteAttribute('normal');
  base.deleteAttribute('uv');
  const g = mergeVertices(base, 1e-5);
  const pa = g.attributes.position as THREE.BufferAttribute;
  const nor = new Float32Array(pa.count * 3);
  const cl = new Float32Array(pa.count * 3);
  const d = new THREE.Vector3();
  const n = new THREE.Vector3();
  const h = focus.clone().normalize();
  const side = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    d.fromBufferAttribute(pa, i).normalize();
    const th = Math.acos(clamp(d.dot(h), -1, 1));
    if (th > 1e-4 && th < PI - 1e-4) {
      side.copy(d).addScaledVector(h, -Math.cos(th)).normalize();
      const t2 = th - pull * Math.sin(th);
      d.copy(h).multiplyScalar(Math.cos(t2)).addScaledVector(side, Math.sin(t2));
    }
    const p = blob.march(center, d);
    blob.grad(p, n);
    pa.setXYZ(i, p.x, p.y, p.z);
    nor.set([n.x, n.y, n.z], i * 3);
    const c = paint(p, n);
    cl.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  g.computeBoundingSphere();
  return g;
}

// ───────────────────────── Geometry helpers ─────────────────────────

function gridGeo(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c?: THREE.Color }): THREE.BufferGeometry {
  const pos: number[] = [];
  const cl: number[] = [];
  let hasCol = false;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const { p, c } = f(i, j);
      pos.push(p.x, p.y, p.z);
      if (c) hasCol = true;
      const cc = c ?? new THREE.Color(1, 1, 1);
      cl.push(cc.r, cc.g, cc.b);
    }
  const idx: number[] = [];
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      idx.push(a, a + cols, a + 1, a + cols, a + cols + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (hasCol) g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(idx);
  return g;
}

function finish(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const m = mergeVertices(g, 1e-6);
  const idx = m.index!.array;
  const keep: number[] = [];
  for (let i = 0; i < idx.length; i += 3) if (idx[i] !== idx[i + 1] && idx[i + 1] !== idx[i + 2] && idx[i] !== idx[i + 2]) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  m.setIndex(keep);
  m.computeVertexNormals();
  return m;
}

function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  if (!g.attributes.normal) g.computeVertexNormals();
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    const c = f(P.fromBufferAttribute(pa, i), N.fromBufferAttribute(na, i));
    out.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

function ellipsePts(rx: number, ry: number, dy = 0, n = 16): [number, number][] {
  return Array.from({ length: n }, (_, i) => [Math.cos((i / n) * PI * 2) * rx, Math.sin((i / n) * PI * 2) * ry + dy] as [number, number]);
}

function lightDecal(pts: [number, number][], r: number, levels = 2): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const flat = new THREE.ShapeGeometry(s, 1).toNonIndexed();
  const src = flat.attributes.position as THREE.BufferAttribute;
  let tris: [number, number][][] = [];
  for (let i = 0; i < src.count; i += 3) tris.push([0, 1, 2].map((k) => [src.getX(i + k), src.getY(i + k)] as [number, number]));
  for (let l = 0; l < levels; l++) {
    const next: [number, number][][] = [];
    for (const [a, b, c] of tris) {
      const m = (u: [number, number], w: [number, number]): [number, number] => [(u[0] + w[0]) / 2, (u[1] + w[1]) / 2];
      const ab = m(a, b);
      const bc = m(b, c);
      const ca = m(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    tris = next;
  }
  const pos: number[] = [];
  const nor: number[] = [];
  for (const t of tris)
    for (const [lon, lat] of t) {
      const x = Math.cos(lat) * Math.sin(lon);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.cos(lon);
      pos.push(x * r, y * r, z * r);
      nor.push(x, y, z);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

function lidLite(ri: number, ro: number, lip: number, front: boolean, arc = PI * 1.15, segs = 12): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  const N = 5;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(a)), ri * Math.cos(a)));
  }
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < 4; i++) {
    const b = (i / 4) * PI;
    const rad = c - Math.cos(b) * w;
    const tan = Math.sin(b) * w;
    prof.push(new THREE.Vector2(rad * Math.sin(lip) + tan * Math.cos(lip), rad * Math.cos(lip) - tan * Math.sin(lip)));
  }
  for (let i = N; i >= 0; i--) {
    const a = (i / N) * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(a)), ro * Math.cos(a)));
  }
  const g = new THREE.LatheGeometry(prof, segs, (front ? 0 : PI) - arc / 2, arc);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-6);
  m.computeVertexNormals();
  return m;
}

function orient(o: THREE.Object3D, yDir: THREE.Vector3, zHint: THREE.Vector3): void {
  const y = yDir.clone().normalize();
  const z = zHint.clone().addScaledVector(y, -zHint.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

const tint = (g: THREE.BufferGeometry, c: THREE.Color) => paint(g, () => c.clone());

// ───────────────────────── Shape ─────────────────────────

export function buildStormramLab(): LabModel {
  const rand = rng(20260929);
  const RIMC = 0xe0e4ff;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const WOOL_T = col(0xe6e4f2);
  const WOOL_M = col(0xc0bfd6);
  const WOOL_B = col(0x7c7ca0);
  const FACE = col(0x3a3e58);
  const FACE_L = col(0x4e5474);
  const HORN_A = col(0xead49c);
  const HORN_B = col(0xb0925a);
  const INDIGO = col(0x323e7c);
  const YEL = col(0xffd23e);
  const RED = col(0xc8384a);

  const wool = vc(labToon(0xffffff, { rim: 0.65, rimColor: RIMC }));
  const M = {
    wool,
    skin: vc(labToon(0xffffff, { rim: 0.5, rimColor: RIMC })),
    eye: labToon(0x1a1420, { ramp: 'gem', rim: 0 }),
    iris: labToon(0xb87a2a, { ramp: 'gem', rim: 0 }),
    irisLow: labToon(0xe0a848, { ramp: 'gem', rim: 0 }),
    pupil: labToon(0x120e16, { ramp: 'gem', rim: 0 }),
    gem0: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    lid: labToon(0x3a3e58, { rim: 0.5, rimColor: RIMC }),
    horn: vc(labToon(0xffffff, { rim: 0.4, rimColor: 0xfff0c8, spec: 0.35, specTh: 0.985 })),
    spark: labToon(0xfff4b0, { ramp: 'gem', emissive: 0xffd840, emissiveAmt: 0.8, rim: 0 }),
    cloth: vc(labToon(0xffffff, { rim: 0.4, rimColor: 0xd0d8ff })),
    hoof: labToon(0x24242e, { spec: 0.5, specTh: 0.99, rim: 0.3, rimColor: RIMC }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'stormram-lab';
  const { add, group } = partKit();

  // Outline groups: spaced 10 apart, so BASE + n never collides
  const WOOL = 9950;
  const HEAD = 9960;
  const HORN = 9970;
  const LEG = 9980;
  const CLOTH = 9990;
  const AMU = 10000;

  const place = group(root, [0, 0, -0.08]);
  const body = group(place);

  // ── Wool: a thundercloud. The big ellipsoid of the body is covered with clumps of fleece, light on top and the dark gray-blue of storm clouds under the belly, with the grooves between clumps darkened ──
  const woolC = v3(0, 0.62, -0.02);
  const woolR = v3(0.36, 0.3, 0.48);
  const blob = new Blob();
  blob.add(woolC, woolR, undefined, 0.06);
  blob.add(v3(0, 0.74, 0.36), v3(0.27, 0.27, 0.2), undefined, 0.08);
  const lumps: THREE.Vector3[] = [];
  const NL = 34;
  for (let i = 0; i < NL; i++) {
    const y = 1 - (2 * (i + 0.5)) / NL;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.39996 + 0.3;
    const d = v3(Math.cos(a) * r, y, Math.sin(a) * r);
    if (d.y < -0.55) continue;
    const c = woolC.clone().add(v3(d.x * woolR.x, d.y * woolR.y, d.z * woolR.z).multiplyScalar(0.9));
    const s = 0.12 + rand() * 0.05;
    blob.add(c, v3(s, s * 0.9, s), undefined, 0.05);
    lumps.push(c);
  }
  // Fleece clumps on the chest and shoulders
  for (const [x, y, z, s] of [[0, 0.62, 0.5, 0.13], [0.15, 0.7, 0.46, 0.12], [-0.15, 0.7, 0.46, 0.12], [0.2, 0.86, 0.34, 0.12], [-0.2, 0.86, 0.34, 0.12], [0, 0.94, 0.3, 0.13], [0, 0.66, -0.56, 0.1]] as [number, number, number, number][])
    blob.add(v3(x, y, z), v3(s, s * 0.9, s), undefined, 0.05);
  const baseN = (p: THREE.Vector3) => v3((p.x - woolC.x) / (woolR.x * woolR.x), (p.y - woolC.y) / (woolR.y * woolR.y), (p.z - woolC.z) / (woolR.z * woolR.z)).normalize();
  add(body, blobGeo(blob, v3(0, 0.66, 0.05), 24, v3(0, 0.3, 1), 0.08, (p, n) => {
    const crev = 1 - clamp(n.dot(baseN(p)), 0, 1);
    // Thundercloud: brightest on top, getting darker lower down, and dark gray-blue under the belly
    return WOOL_T.clone().lerp(WOOL_M, Math.max(sstep(-n.y, -0.3, 0.3), 1 - sstep(p.y, 0.5, 0.75))).lerp(WOOL_B, Math.max(sstep(-n.y, 0.2, 0.7), 1 - sstep(p.y, 0.38, 0.56))).lerp(WOOL_B, sstep(crev, 0.25, 0.7) * 0.45);
  }), M.wool).userData.inkGroup = WOOL;

  // ── Feet: four thin dark blue-gray legs coming out from under the wool, with slightly bulging knees and shiny black hooves ──
  const legProf = curveTable([[0, 0.055, 0.055], [0.45, 0.038, 0.04], [0.55, 0.042, 0.044], [0.85, 0.034, 0.036], [1, 0.036, 0.038]]);
  const hoofGeo = lathe([[0.001, 0.0], [0.046, 0.0], [0.048, 0.02], [0.042, 0.06], [0.036, 0.075], [0.001, 0.078]], 14);
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[0.17, 0.3], [-0.17, 0.3], [0.18, -0.36], [-0.18, -0.36]] as [number, number][]) {
    const lg = group(body, [x, 0.45, z]);
    add(lg, paint(loft([v3(0, 0, 0), v3(0, -0.18, 0.012), v3(0, -0.37, 0)], legProf, { segs: 12, radial: 10 }), () => FACE.clone()), M.skin).userData.inkGroup = LEG;
    add(lg, hoofGeo, M.hoof, [0, -0.45, 0.004]);
    legs.push(lg);
  }

  // ── Head: a dark blue-gray long face with the muzzle pointing forward and down, and a tuft of curls on the forehead; the head sticks out from the fleece clumps on the chest ──
  const neck = group(body, [0, 0.9, 0.54]);
  const headG = group(neck, [0, 0.02, 0.06], [0.25, 0, 0]);
  const hb = new Blob();
  hb.add(v3(0, 0.04, 0), v3(0.125, 0.13, 0.14), undefined, 0.07);
  hb.add(v3(0, -0.06, 0.15), v3(0.085, 0.085, 0.13), new THREE.Quaternion().setFromAxisAngle(X, 0.3), 0.07);
  for (const sx of [-1, 1]) hb.add(v3(sx * 0.07, -0.02, 0.06), v3(0.07, 0.075, 0.08), undefined, 0.06);
  const HO = v3(0, 0.0, 0.05);
  const sdir = (lon: number, lat: number) => v3(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat));
  add(headG, blobGeo(hb, v3(0, 0, 0.04), 12, v3(0, -0.2, 1), 0.25, (p, n) => FACE.clone().lerp(FACE_L, sstep(n.y, 0.2, 0.8) * 0.5).lerp(col(0x2c2f44), sstep(p.z, 0.22, 0.27))), M.skin).userData.inkGroup = HEAD;
  // Curls on the forehead (the forelock a sheep has naturally), in the same material as the wool
  {
    const tb = new Blob();
    tb.add(v3(0, 0.15, 0.03), v3(0.085, 0.05, 0.075), undefined, 0.04);
    for (const [x, y, z, s] of [[0.06, 0.14, 0.05, 0.045], [-0.06, 0.14, 0.05, 0.045], [0, 0.13, 0.1, 0.045], [0.035, 0.18, -0.01, 0.04], [-0.035, 0.18, -0.01, 0.04]] as [number, number, number, number][])
      tb.add(v3(x, y, z), v3(s, s * 0.85, s), undefined, 0.03);
    add(headG, blobGeo(tb, v3(0, 0.15, 0.03), 8, v3(0, 0.3, 1), 0.1, (p, n) => WOOL_T.clone().lerp(WOOL_M, sstep(-n.y, -0.2, 0.5))), M.wool).userData.inkGroup = WOOL + 1;
  }

  // Eyes: on the two sides of the face, amber irises filling the whole eye with a horizontal dark pupil (a sheep's eyes) and one highlight; no sclera shows
  const ER = 0.036;
  const UP_OPEN = 0.9;
  const LO_OPEN = 0.72;
  const lids: { g: THREE.Group; open: number; shut: number }[] = [];
  const glints: THREE.Object3D[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const lidUp = lidLite(ER + 0.004, ER + 0.01, PI / 2, true);
  const lidLow = lidLite(ER + 0.003, ER + 0.008, PI / 2, false);
  const eyeball = new THREE.SphereGeometry(ER, 18, 10, 0, PI * 2, 0, PI / 2).rotateX(PI / 2);
  for (const sx of [-1, 1]) {
    const dir = sdir(sx * 0.72, 0.12);
    const { p, n } = hb.hit(HO, dir);
    const c = p.clone().addScaledVector(n, -ER * 0.5);
    const eg = group(headG, [c.x, c.y, c.z]);
    const d = n.clone().lerp(dir, 0.5).normalize();
    const r = new THREE.Vector3().crossVectors(UP, d).normalize();
    const u = new THREE.Vector3().crossVectors(d, r);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, d));
    add(eg, eyeball, M.eye);
    // The iris and pupil follow the direction of the socket (a sheep's eyes are on the sides, each looking to its own side, with the gaze consistently outward and forward), and the highlights are all on the key light side
    add(eg, lightDecal(ellipsePts(0.78, 0.8, 0, 18), ER + 0.0016), M.iris);
    add(eg, lightDecal(ellipsePts(0.6, 0.3, -0.4, 12), ER + 0.0032), M.irisLow);
    add(eg, lightDecal(ellipsePts(0.5, 0.2, 0.04, 16), ER + 0.0048), M.pupil);
    const hl = add(eg, new THREE.SphereGeometry(0.009, 8, 6), M.hi, [0.012, 0.015, ER * 0.96], [0, 0, 0], [1, 1, 0.5]);
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
    glints.push(hl);
    eyeAnchors.push(group(eg, [0, 0, ER]));
    const upper = group(eg, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.lid).userData.inkGroup = HEAD;
    const lower = group(headG, [c.x, c.y, c.z]);
    lower.quaternion.copy(eg.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(X, PI + LO_OPEN));
    add(lower, lidLow, M.lid).userData.inkGroup = HEAD;
    lids.push({ g: upper, open: -UP_OPEN, shut: LO_OPEN - 0.02 });
  }
  // Nose and mouth: two slanted nostrils at the muzzle tip, with a short philtrum split down to the upper lip below (a sheep's Y-shaped lip), and no smiling mouth drawn
  const muz = (x: number, y: number, out = 0.002) => {
    const { p, n } = hb.hit(v3(0, -0.04, 0.1), v3(x, y, 1));
    return { p: p.clone().addScaledVector(n, out), n };
  };
  for (const sx of [-1, 1]) {
    const { p, n } = muz(sx * 0.2, 0.05, -0.004);
    const ng = group(headG, [p.x, p.y, p.z]);
    orient(ng, v3(sx * 0.6, 1, 0), n);
    add(ng, tint(new THREE.SphereGeometry(1, 10, 6), col(0x16141c)), M.skin, [0, 0, 0], [0, 0, 0], [0.011, 0.02, 0.007]).userData.inkGroup = HEAD;
  }
  add(headG, paint(loft([muz(0, -0.02).p, muz(0, -0.12).p, muz(0, -0.2).p], () => [0.005, 0.005], { segs: 6, radial: 6 }), () => col(0x16141c)), M.skin).userData.inkGroup = HEAD;

  // ── Storm horns: a pair of big spiral horns curling back, down and then forward, with ridges ring after ring; yellow electric light at the horn tips ──
  const hornTips: THREE.Group[] = [];
  const TH_MAX = PI * 1.75;
  for (const sx of [-1, 1]) {
    const rootP = v3(sx * 0.075, 0.13, -0.03);
    // The plane the spiral lies in tilts outward (a sheep's horn curl is outward), so from the front you can see the horns spiraling out to both sides
    const U = v3(sx * 0.75, 1, 0).normalize();
    const R0 = 0.15;
    const C = rootP.clone().addScaledVector(U, -R0);
    const pts: THREE.Vector3[] = [];
    const NH = 36;
    for (let i = 0; i <= NH; i++) {
      const th = (i / NH) * TH_MAX;
      const R = R0 * (1 - (0.42 * th) / TH_MAX);
      pts.push(C.clone().addScaledVector(U, Math.cos(th) * R).add(v3(sx * (0.03 + (0.12 * th) / TH_MAX), 0, -Math.sin(th) * R)));
    }
    pts[0].add(v3(-sx * 0.02, -0.03, 0));
    const ridge = (t: number) => Math.pow(Math.max(0, Math.sin(t * PI * 20)), 3) * sstep(t, 0.05, 0.15) * (1 - sstep(t, 0.85, 0.95));
    const rad = (t: number) => lerp(0.066, 0.02, Math.pow(t, 0.9)) * (1 + 0.1 * ridge(t));
    const hornGeo = paint(loft(pts, (t) => [rad(t), rad(t) * 0.9], { segs: 90, radial: 12 }), () => HORN_A.clone());
    // Ridge color: from the position along the horn, converted from the vertex's arc length from the root (recomputed using t)
    {
      const pa = hornGeo.attributes.position as THREE.BufferAttribute;
      const cl = hornGeo.attributes.color as THREE.BufferAttribute;
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const samples = Array.from({ length: 181 }, (_, i) => curve.getPointAt(i / 180));
      const P = new THREE.Vector3();
      for (let i = 0; i < pa.count; i++) {
        P.fromBufferAttribute(pa, i);
        let best = 1e9;
        let bt = 0;
        for (let k = 0; k < samples.length; k++) {
          const dd = samples[k].distanceToSquared(P);
          if (dd < best) (best = dd), (bt = k / 180);
        }
        const c = HORN_A.clone().lerp(HORN_B, 0.55 * (1 - ridge(bt))).lerp(HORN_B, 0.3 * (1 - sstep(bt, 0.0, 0.2)));
        cl.setXYZ(i, c.r, c.g, c.b);
      }
    }
    add(headG, hornGeo, M.horn).userData.inkGroup = HORN + (sx > 0 ? 0 : 1);
    // Horn tip: a short stretch of glowing electric tip
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const tp = curve.getPointAt(1);
    const tn = curve.getTangentAt(1);
    const tipG = group(headG, [tp.x, tp.y, tp.z]);
    orient(tipG, tn, v3(0, 1, 0));
    add(tipG, lathe([[0.021, -0.006], [0.022, 0.0], [0.015, 0.028], [0.001, 0.056]], 10), M.spark);
    hornTips.push(group(tipG, [0, 0.056, 0]));
  }

  // ── Thunder-pattern amulet: a woven red cord hanging on the fleece at the chest, an indigo round plaque set with a yellow bolt of lightning, and a tuft of red tassel below ──
  const amuC = v3(0, 0.74, 0.25);
  const cordPts: THREE.Vector3[] = [];
  for (const [x, y, z] of [[-0.95, 0.75, 0.2], [-0.7, 0.3, 0.7], [-0.35, -0.05, 1], [0, -0.18, 1], [0.35, -0.05, 1], [0.7, 0.3, 0.7], [0.95, 0.75, 0.2]] as [number, number, number][]) {
    const { p, n } = blob.hit(amuC, v3(x, y, z));
    cordPts.push(p.addScaledVector(n, 0.01));
  }
  add(body, paint(loft(cordPts, () => [0.012, 0.012], { segs: 40, radial: 6 }), (p) => RED.clone().multiplyScalar(0.85 + 0.15 * Math.sin(p.x * 120))), M.cloth).userData.inkGroup = AMU;
  const amu = blob.hit(amuC, v3(0, -0.26, 1));
  const amuG = group(body, [amu.p.x, amu.p.y, amu.p.z]);
  orient(amuG, UP.clone().addScaledVector(amu.n, -UP.dot(amu.n)), amu.n);
  const medal = group(amuG, [0, -0.06, 0.02]);
  {
    add(medal, tint(new THREE.TorusGeometry(0.012, 0.004, 5, 10), YEL), M.cloth, [0, 0.07, 0]).userData.inkGroup = AMU + 1;
    const disc = lathe([[0.001, -0.012], [0.058, -0.012], [0.066, -0.006], [0.066, 0.006], [0.058, 0.012], [0.001, 0.012]], 20);
    add(medal, tint(disc, INDIGO), M.cloth, [0, 0, 0], [PI / 2, 0, 0]).userData.inkGroup = AMU + 1;
    add(medal, tint(new THREE.TorusGeometry(0.058, 0.006, 5, 24), YEL), M.cloth, [0, 0, 0.012]).userData.inkGroup = AMU + 2;
    const bolt = new THREE.Shape();
    const bp: [number, number][] = [[0.012, 0.045], [-0.022, 0.0], [0.002, 0.0], [-0.014, -0.045], [0.024, 0.006], [0.0, 0.006], [0.02, 0.045]];
    bolt.moveTo(...bp[0]);
    for (const q of bp.slice(1)) bolt.lineTo(...q);
    const bg = new THREE.ExtrudeGeometry(bolt, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 1 });
    bg.clearGroups();
    add(medal, tint(bg, YEL), M.cloth, [0, 0, 0.012]).userData.inkGroup = AMU + 3;
    const tas = lathe([[0.001, -0.07], [0.018, -0.068], [0.022, -0.05], [0.012, -0.012], [0.006, 0.0], [0.001, 0.002]], 10);
    add(medal, tint(tas, RED), M.cloth, [0, -0.062, 0]).userData.inkGroup = AMU + 4;
  }

  // ── Felt blanket on the back (the story of the back view): an indigo felt blanket the nomads laid on its back, following the rise and fall of the fleece clumps; a ring of yellow piping, yellow lightning patterns embroidered on both sides and red tassels hanging from the four corners ──
  {
    const PHI = 1.05;
    const Z0 = -0.36;
    const Z1 = 0.12;
    const at = (phi: number, z: number, lift: number) => {
      const { p, n } = blob.hit(v3(0, 0.55, z), v3(Math.sin(phi), Math.cos(phi), 0));
      return { p: p.addScaledVector(n, lift), n };
    };
    const R = 16;
    const Cn = 26;
    const g = gridGeo(R + 1, Cn + 1, (i, j) => {
      const z = lerp(Z0, Z1, i / R);
      const phi = lerp(-PHI, PHI, j / Cn);
      const { p } = at(phi, z, 0.02);
      const band = Math.abs(phi) < 0.28 ? 1 : 0;
      return { p, c: INDIGO.clone().lerp(col(0x44529a), band * 0.8) };
    });
    g.computeVertexNormals();
    const na = g.attributes.normal as THREE.BufferAttribute;
    const mid = (R / 2) * (Cn + 1) + Cn / 2;
    if (na.getY(mid) < 0) {
      const idx = Array.from(g.index!.array);
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    add(body, g, M.cloth).userData.inkGroup = CLOTH;
    // Piping: a thick yellow line running around the four edges of the blanket (the two ends join at the middle of the rear edge)
    const edge: THREE.Vector3[] = [];
    for (let j = Cn / 2; j <= Cn; j += 2) edge.push(at(lerp(-PHI, PHI, j / Cn), Z0, 0.02).p);
    for (let i = 1; i <= R; i += 2) edge.push(at(PHI, lerp(Z0, Z1, i / R), 0.02).p);
    for (let j = Cn; j >= 0; j -= 2) edge.push(at(lerp(-PHI, PHI, j / Cn), Z1, 0.02).p);
    for (let i = R - 1; i >= 0; i -= 2) edge.push(at(-PHI, lerp(Z0, Z1, i / R), 0.02).p);
    for (let j = 1; j <= Cn / 2; j += 2) edge.push(at(lerp(-PHI, PHI, j / Cn), Z0, 0.02).p);
    add(body, tint(loft(edge, () => [0.014, 0.014], { segs: 140, radial: 6 }), YEL), M.cloth).userData.inkGroup = CLOTH + 1;
    // Lightning pattern: one zigzag embroidery on each side
    for (const s of [-1, 1]) {
      const zz: THREE.Vector3[] = [];
      const K = 9;
      for (let k = 0; k <= K; k++) zz.push(at(s * (0.72 + (k % 2 ? 0.1 : -0.1)), lerp(Z0 + 0.05, Z1 - 0.05, k / K), 0.026).p);
      add(body, tint(loft(zz, () => [0.01, 0.008], { segs: 60, radial: 6 }), YEL), M.cloth).userData.inkGroup = CLOTH + 2;
    }
    // Red tassels at the four corners
    for (const [sp, z] of [[-1, Z0], [1, Z0], [-1, Z1], [1, Z1]] as [number, number][]) {
      const { p } = at(sp * PHI, z, 0.02);
      add(body, tint(lathe([[0.001, -0.07], [0.016, -0.068], [0.02, -0.05], [0.01, -0.01], [0.005, 0.0], [0.001, 0.002]], 8), RED), M.cloth, [p.x, p.y - 0.005, p.z]).userData.inkGroup = CLOTH + 3;
    }
  }

  // ── Static electricity: two small yellow electric arcs between the fleece clumps, flickering ──
  const sparks: THREE.Group[] = [];
  for (const [x, y, z, s] of [[0.55, 1, 0.55, 1], [-0.6, 0.9, 0.2, -1]] as [number, number, number, number][]) {
    const { p, n } = blob.hit(v3(0, 0.62, 0.05), v3(x, y, z));
    const sg = group(body, [p.x, p.y, p.z]);
    orient(sg, n, v3(0, 0, 1));
    const zig = [v3(0, 0.0, 0), v3(0.035 * s, 0.045, 0), v3(-0.016 * s, 0.08, 0), v3(0.028 * s, 0.13, 0), v3(-0.006 * s, 0.17, 0)];
    add(sg, loft(zig, (t) => {
      const k = Math.min(1, t * 6) * Math.min(1, (1 - t) * 4);
      return [0.012 * k + 0.001, 0.012 * k + 0.001];
    }, { segs: 24, radial: 5 }), M.spark);
    sparks.push(sg);
  }

  // The short fluffy-ball tail is already in the wool's distance field (the last fleece clump)

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle action: breathing (the fleece clumps swelling), lowering and raising the head as if butting into the wind, horn tips and static flickering, pawing a front hoof now and then, blinking ──
  const act = { charge: 0, ram: 0 };
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    const br = Math.sin(t * 1.9);
    const puff = 1 + act.charge * 0.06;
    body.scale.set(puff + br * 0.006, puff + br * 0.01, puff + br * 0.004);
    neck.rotation.x = Math.sin(t * 0.8) * 0.05 + act.ram * 0.35;
    neck.rotation.y = Math.sin(t * 0.43) * 0.14;
    // The right front hoof paws the ground once every 5 seconds
    const pw = t % 5;
    const paw = pw > 4.2 && pw < 4.8 ? Math.sin(((pw - 4.2) / 0.6) * PI) : 0;
    legs[0].rotation.x = -paw * 0.35;
    legs[0].position.y = 0.45 + paw * 0.03;
    const bt = t % 3.9;
    const bk = (x: number) => (x > 0 && x < 0.2 ? Math.min(1, Math.sin((x / 0.2) * PI) * 1.3) : 0);
    const close = Math.max(bk(bt - 3.5), Math.floor(t / 3.9) % 3 === 1 ? bk(bt - 3.2) : 0);
    for (const l of lids) l.g.rotation.x = lerp(l.open, l.shut, close);
    for (const g of glints) g.visible = close < 0.6;
    // Static: the two arcs flash in turn (always lit while charging)
    sparks.forEach((s, i) => {
      const ph = (t * 1.3 + i * 0.5) % 1;
      s.visible = act.charge > 0.3 || ph < 0.55;
      s.scale.setScalar(0.85 + 0.15 * Math.sin(t * 17 + i));
    });
    const gl = act.charge;
    if (gl !== lastGlow) {
      lastGlow = gl;
      M.spark.emissiveIntensity = 0.8 + gl * 0.6;
    }
  };
  update(0);

  const face = group(headG, [0, -0.02, 0.2]);
  const mouthA = group(headG, [...muz(0, -0.2, 0.01).p.toArray()] as [number, number, number]);
  const amuA = group(medal);
  const woolTop = group(body, [0, 0.95, -0.05]);
  const rig = { head: face, eyes: eyeAnchors, anchors: { mouth: mouthA, hornL: hornTips[1], hornR: hornTips[0], amulet: amuA, wool: woolTop, spark: sparks[0] } };
  mergeStatic(root, {
    owners: [place, body, neck, headG, medal, ...legs, ...sparks, ...lids.map((l) => l.g)],
    keep: [...glints],
    twins: [[M.lid, M.skin], [M.iris, M.gem0], [M.irisLow, M.gem0], [M.pupil, M.gem0]],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.62, 0.05), radius: 0.84 };
}
