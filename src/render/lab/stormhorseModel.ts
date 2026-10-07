// Storm Steed (model lab version): the mount of the nomad tribes of the wilds, herd after herd following the thunderclouds as they migrate; Chief Karan says that as long as the herd keeps running, the tribe will never get lost.
// Thunder, R. Three identifying features:
// 1. A stocky steppe horse: big head, thick neck and short legs, with an upright brush mane along the neck (the short stiff mane of a wild horse, its top edge in clumps of points), a gray-blue thundercloud coat, and pale muzzle, underbelly and eye rings (the pink nose of a wild horse).
// 2. A yellow lightning-shaped white blaze from the forehead to the nose bridge (the white facial marking horses naturally have, here in the shape of lightning).
// 3. Nomad tack: a red felt saddle blanket with a cream edge (yellow lightning appliqués sewn on both sides), a wooden saddle with a high front bow and a high rear bow, and the lead horse's bronze bell hung on the neck.
// Kept distinct from Luminael (a pure white, winged, slender pegasus) and Voltarion (an indigo-purple qilin, one-horned with golden hooves): no wings, no horn, stocky, gray-blue, dark hooves and a red saddle blanket.
// Personality: a lead horse that always wants to run forward, impatient and energetic, but turns back to wait for tribe members who fall behind. Head high, neck arched, both ears forward and nostrils flared; the eyes are a horse's big dark eyes, with no human brows or mouth drawn.
// Gaze order: the head (dark shiny eyes, the yellow lightning blaze, forward ears) first, the red saddle blanket and the bronze bell second, and the mane, tail and hooves as support.
// Back: tied behind the rear saddle bow is a roll of the tribe's yurt felt (bound with two red cords, the spiral visible at the roll's open end), and red cord is wrapped around the tail root, the tribe's mark.
// Restrained light effects: the emissive is kept only on the blaze (very faint), with no bloom.
// Action table: idle: a light sway as if shifting feet, the neck rising and falling slightly, the ears turning in turn, the tail flicking and the bronze bell swinging along; move: a trot; charge-up act.charge lowers the head, lays the ears back and lowers the front of the body;
//   strike act.rear rears up (turning up about the hip with the front feet lifted) and then stamps down; hit tosses the head and steps sideways, with the ears soon forward again; victory rears up with a long neigh.
// Anchors: head, eyes, mouth, blaze (the forehead blaze), bell (mouth of the bronze bell), saddle (saddle seat), chest, tailTip, hoofFL / hoofFR (front hooves). act: rear, charge, glow.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v3(1, 0, 0);
const Y = v3(0, 1, 0);
const Z = v3(0, 0, 1);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

// ───────────────────────── Geometry helpers ─────────────────────────

function ellipsePts(rx: number, ry: number, dy = 0, n = 24): [number, number][] {
  return Array.from({ length: n }, (_, i) => [Math.cos((i / n) * PI * 2) * rx, Math.sin((i / n) * PI * 2) * ry + dy] as [number, number]);
}

/** Apply vertex colors to a mesh by position and normal (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  if (!g.attributes.normal) g.computeVertexNormals();
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) f(P.fromBufferAttribute(pa, i), N.fromBufferAttribute(na, i)).toArray(out, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

/** A planar shape on a sphere: the x of pts is longitude and y is latitude (radians, centered on +z), subdivided levels times and then projected to radius r */
function lightDecal(pts: [number, number][], r: number, lat0 = 0, levels = 2): THREE.BufferGeometry {
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
    for (const [lon, dl] of t) {
      const lat = lat0 + dl;
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

/** Eyelid shell: with +y as the top, covering down to lip radians, with a rounded lip at the edge; when front is true it is centered on +z, otherwise on -z (the lower eyelid turns half a turn about x) */
function lidLite(ri: number, ro: number, lip: number, front: boolean, arc = PI * 1.1, segs = 12): THREE.BufferGeometry {
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

/** Ray-find a surface: geo is in its own coordinate system; returns the first intersection and the interpolated vertex normal (facing the side the ray came from) */
function prober(geo: THREE.BufferGeometry) {
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  const rc = new THREE.Raycaster();
  return (o: THREE.Vector3, d: THREE.Vector3) => {
    rc.set(o, d.clone().normalize());
    const h = rc.intersectObject(mesh, false)[0];
    if (!h) return null;
    const n = (h.normal ?? h.face!.normal).clone().normalize();
    return { p: h.point.clone(), n };
  };
}

/**
 * A band lying on a surface (belt, rope loop): P is the centerline of the band's underside and N is the surface normal; the cross-section is a rounded rectangle (width w, thickness th),
 * the whole band floats th / 2 up along the normal so the underside just touches the surface. When closed is true the ends join, otherwise both ends are rounded off.
 */
function strap(P: THREE.Vector3[], N: THREE.Vector3[], w: number, th: number, closed = false, K = 8): THREE.BufferGeometry {
  const n = P.length;
  const pos: number[] = [];
  const T = new THREE.Vector3();
  const rowOf = (i: number, scale = 1) => {
    const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    T.subVectors(b, a).normalize();
    const nn = N[i].clone().addScaledVector(T, -N[i].dot(T)).normalize();
    const bb = new THREE.Vector3().crossVectors(T, nn).normalize();
    for (let k = 0; k < K; k++) {
      const ang = ((k + 0.5) / K) * PI * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const cx = Math.sign(c) * Math.abs(c) ** 0.45 * (w / 2) * scale;
      const cy = Math.sign(s) * Math.abs(s) ** 0.45 * (th / 2) * scale;
      const q = P[i].clone().addScaledVector(bb, cx).addScaledVector(nn, cy + th / 2);
      pos.push(q.x, q.y, q.z);
    }
  };
  for (let i = 0; i < n; i++) rowOf(i);
  const idx: number[] = [];
  const rows = closed ? n : n - 1;
  for (let i = 0; i < rows; i++)
    for (let k = 0; k < K; k++) {
      const i2 = (i + 1) % n;
      const k2 = (k + 1) % K;
      idx.push(i * K + k, i2 * K + k, i * K + k2, i2 * K + k, i2 * K + k2, i * K + k2);
    }
  if (!closed) {
    // One center point at each end closes it off
    for (const [i, dir] of [[0, -1], [n - 1, 1]] as [number, number][]) {
      const c = new THREE.Vector3();
      for (let k = 0; k < K; k++) c.add(v3(pos[(i * K + k) * 3], pos[(i * K + k) * 3 + 1], pos[(i * K + k) * 3 + 2]));
      c.multiplyScalar(1 / K);
      const tip = c.clone().add(P[i].clone().sub(P[i - dir]).normalize().multiplyScalar(th * 0.4));
      const ci = pos.length / 3;
      pos.push(tip.x, tip.y, tip.z);
      for (let k = 0; k < K; k++) {
        const k2 = (k + 1) % K;
        if (dir > 0) idx.push(i * K + k, ci, i * K + k2);
        else idx.push(i * K + k2, ci, i * K + k);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A membrane with thickness (saddle blanket, mane, cushion): S(u, v) is the midsurface, growing thick / 2 to each side, with the four edges rounded into lips.
 * color(u, v, side): side 1 is the outward side.
 */
function thickSheet(
  NU: number,
  NV: number,
  S: (u: number, v: number) => THREE.Vector3,
  thick: (u: number, v: number) => number,
  o: { E?: number; color?: (u: number, v: number, side: number) => THREE.Color; outward: THREE.Vector3 },
): THREE.BufferGeometry {
  const cols = NU + 1;
  const rows = NV + 1;
  const E = o.E ?? 3;
  const P: THREE.Vector3[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) P.push(S(i / NU, j / NV));
  const at = (i: number, j: number) => P[j * cols + i];
  const Nn: THREE.Vector3[] = [];
  const Su: THREE.Vector3[] = [];
  const Sv: THREE.Vector3[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const su = at(Math.min(cols - 1, i + 1), j).clone().sub(at(Math.max(0, i - 1), j));
      const sv = at(i, Math.min(rows - 1, j + 1)).clone().sub(at(i, Math.max(0, j - 1)));
      Su.push(su);
      Sv.push(sv);
      Nn.push(su.clone().cross(sv).normalize());
    }
  const mid = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
  if (Nn[mid].dot(o.outward) < 0) for (const n of Nn) n.negate();
  const color = o.color ?? (() => col(0xffffff));
  const pos: number[] = [];
  const clr: number[] = [];
  const outs: THREE.Vector3[] = [];
  const addV = (p: THREE.Vector3, d: THREE.Vector3, c: THREE.Color) => {
    pos.push(p.x, p.y, p.z);
    clr.push(c.r, c.g, c.b);
    outs.push(d);
    return outs.length - 1;
  };
  const uvOf = (k: number): [number, number] => [(k % cols) / NU, Math.floor(k / cols) / NV];
  const O: number[] = [];
  const I: number[] = [];
  for (let k = 0; k < P.length; k++) {
    const [u, v] = uvOf(k);
    const h = thick(u, v) / 2;
    O.push(addV(P[k].clone().addScaledVector(Nn[k], h), Nn[k].clone(), color(u, v, 1)));
    I.push(addV(P[k].clone().addScaledVector(Nn[k], -h), Nn[k].clone().negate(), color(u, v, -1)));
  }
  const idx: number[] = [];
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const C = new THREE.Vector3();
  const tri = (a: number, b: number, c: number) => {
    A.set(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]);
    B.set(pos[b * 3] - A.x, pos[b * 3 + 1] - A.y, pos[b * 3 + 2] - A.z);
    C.set(pos[c * 3] - A.x, pos[c * 3 + 1] - A.y, pos[c * 3 + 2] - A.z);
    const fn = B.cross(C);
    const hint = outs[a].clone().add(outs[b]).add(outs[c]);
    if (fn.dot(hint) < 0) idx.push(a, c, b);
    else idx.push(a, b, c);
  };
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      const b = j * cols + i + 1;
      const c = (j + 1) * cols + i + 1;
      const d = (j + 1) * cols + i;
      tri(O[a], O[b], O[c]);
      tri(O[a], O[c], O[d]);
      tri(I[a], I[b], I[c]);
      tri(I[a], I[c], I[d]);
    }
  const L: { k: number; e: THREE.Vector3 }[] = [];
  const eOf = (i: number, j: number) => {
    const k = j * cols + i;
    const e = new THREE.Vector3();
    if (j === 0) e.sub(Sv[k].clone().normalize());
    if (j === rows - 1) e.add(Sv[k].clone().normalize());
    if (i === 0) e.sub(Su[k].clone().normalize());
    if (i === cols - 1) e.add(Su[k].clone().normalize());
    return { k, e };
  };
  for (let i = 0; i < cols; i++) L.push(eOf(i, 0));
  for (let j = 1; j < rows; j++) L.push(eOf(cols - 1, j));
  for (let i = cols - 2; i >= 0; i--) L.push(eOf(i, rows - 1));
  for (let j = rows - 2; j >= 1; j--) L.push(eOf(0, j));
  const rings = L.map(({ k, e }) => {
    const n = Nn[k];
    const ee = e.clone().addScaledVector(n, -e.dot(n)).normalize();
    const [u, v] = uvOf(k);
    const h = thick(u, v) / 2;
    const cO = color(u, v, 1);
    const cI = color(u, v, -1);
    const ring = [O[k]];
    for (let m = 1; m <= E; m++) {
      const ph = (PI * m) / (E + 1);
      const d = n.clone().multiplyScalar(Math.cos(ph)).addScaledVector(ee, Math.sin(ph));
      ring.push(addV(P[k].clone().addScaledVector(d, h), d, cO.clone().lerp(cI, (1 - Math.cos(ph)) / 2)));
    }
    ring.push(I[k]);
    return ring;
  });
  for (let q = 0; q < rings.length; q++) {
    const r1 = rings[q];
    const r2 = rings[(q + 1) % rings.length];
    for (let m = 0; m <= E; m++) {
      tri(r1[m], r2[m], r2[m + 1]);
      tri(r1[m], r2[m + 1], r1[m + 1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Take n even segments over 0-1, and insert one very close node on each side of cuts, so the boundary of the vertex colors is a crisp line */
function nodes(n: number, cuts: number[]): number[] {
  const s = new Set<number>();
  for (let i = 0; i <= n; i++) s.add(+(i / n).toFixed(5));
  for (const c of cuts) {
    s.add(+(c - 0.003).toFixed(5));
    s.add(+(c + 0.003).toFixed(5));
  }
  return [...s].sort((a, b) => a - b).filter((x, i, a) => i === 0 || x - a[i - 1] > 0.0015);
}

/** Coordinate frame along a path: T tangent, X lateral, U = T × X (when the path goes forward and down, U faces up and forward) */
function pathFrame(curve: THREE.Curve<THREE.Vector3>, t: number) {
  const C = curve.getPointAt(t);
  const T = curve.getTangentAt(t);
  const U = new THREE.Vector3().crossVectors(T, X).normalize();
  if (U.y < 0) U.negate();
  return { C, T, U };
}

// ───────────────────────── Shape ─────────────────────────

export function buildStormhorseLab(): LabModel {
  const RIMC = 0xd2e2ff;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    coat: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC })),
    cloth: vc(labToon(0xffffff, { rim: 0.35, rimColor: 0xffe4cc })),
    hoof: labToon(0x323846, { spec: 0.35, specTh: 0.99, rim: 0.45, rimColor: RIMC }),
    brass: labToon(0xd9a444, { ramp: 'metal', spec: 1.3, specTh: 0.9, rim: 0.5, rimColor: 0xfff0c8 }),
    blaze: labToon(0xffe476, { ramp: 'gem', emissive: 0xffbe2a, emissiveAmt: 0.28, rim: 0.3, rimColor: 0xfff4c0 }),
    eye: labToon(0x1a1310, { ramp: 'gem', spec: 1.0, specTh: 0.985, rim: 0 }),
    iris: vc(labToon(0xffffff, { ramp: 'gem', spec: 1.0, specTh: 0.985, rim: 0 })),
    nostril: labToon(0x2c2630, { rim: 0 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const cCoat = col(0x72819b);
  const cCoatHi = col(0x8a99b2);
  const cPale = col(0xb9c3d2);
  const cSock = col(0x3a4152);
  const cMane = col(0x2b3043);
  const cManeTip = col(0x55617c);
  const cRed = col(0xb5332b);
  const cRedIn = col(0x6e1d1a);
  const cCream = col(0xf1e2c0);
  const cYellow = col(0xf4c440);
  const cLeather = col(0x5e3a26);
  const cWood = col(0x98582c);
  const cFelt = col(0xcfc5b0);
  const cFeltDark = col(0x8f8574);

  const root = new THREE.Group();
  root.name = 'stormhorse-lab';
  const { add, group } = partKit();

  const COAT = 9701;
  const MANE = 9702;
  const TAIL = 9703;
  const BLANKET = 9704;
  const EYEI = 9705;

  // The pivot for rearing is at the hip: the body, neck, head and front feet all hang under pose; the hind feet hang directly on root and stand firmly on the ground
  const HIP = v3(0, 0.82, -0.38);
  const pose = group(root, [HIP.x, HIP.y, HIP.z]);
  // The whole body is lowered a little (short legs, stocky); the top ends of the legs are still inserted into the torso
  const BDY = -0.04;
  const body = group(pose, [-HIP.x, -HIP.y + BDY, -HIP.z]);

  // ── Torso: a single loft, round rump, a slightly sagging belly and a deep chest; pale under the belly and the chest ──
  const torsoPts = [v3(0, 0.82, -0.6), v3(0, 0.83, -0.38), v3(0, 0.81, -0.1), v3(0, 0.83, 0.18), v3(0, 0.85, 0.38), v3(0, 0.86, 0.5)];
  const torsoProf = curveTable([
    [0, 0, 0, 0],
    [0.03, 0.12, 0.13, 0],
    [0.1, 0.19, 0.2, 0],
    [0.22, 0.228, 0.24, -0.006],
    [0.42, 0.245, 0.258, -0.03],
    [0.6, 0.248, 0.262, -0.03],
    [0.78, 0.228, 0.27, -0.02],
    [0.9, 0.185, 0.23, -0.012],
    [0.97, 0.1, 0.13, 0],
    [1, 0, 0, 0],
  ]);
  const torsoGeo = paint(loft(torsoPts, torsoProf, { segs: 56, radial: 28 }), (p, n) =>
    cCoat.clone().lerp(cCoatHi, sstep(n.y, 0.3, 0.9) * 0.6).lerp(cPale, sstep(-n.y, 0.45, 0.85)),
  );
  add(body, torsoGeo, M.coat).userData.inkGroup = COAT;
  const probeTorso = prober(torsoGeo);

  // ── Limbs: front legs straight, hind legs with the thigh forward and the hock back; below the knee are dark "socks", and the hooves are dark gray ──
  const legProfF = curveTable([[0, 0, 0], [0.04, 0.1, 0.12], [0.2, 0.104, 0.122], [0.38, 0.08, 0.09], [0.5, 0.062, 0.07], [0.56, 0.066, 0.074], [0.64, 0.053, 0.058], [0.83, 0.05, 0.055], [0.91, 0.061, 0.064], [0.97, 0.055, 0.055], [1, 0.052, 0.052]]);
  const legProfH = curveTable([[0, 0, 0], [0.04, 0.13, 0.16], [0.16, 0.14, 0.175], [0.36, 0.095, 0.11], [0.5, 0.065, 0.074], [0.56, 0.069, 0.08], [0.66, 0.053, 0.06], [0.85, 0.05, 0.055], [0.93, 0.061, 0.064], [1, 0.052, 0.052]]);
  const legPaint = (g: THREE.BufferGeometry, o: THREE.Vector3) => paint(g, (p, n) => cCoat.clone().lerp(cPale, sstep(-n.y, 0.6, 0.95) * 0.5).lerp(cSock, sstep(0.36 - (p.y + o.y), 0, 0.1)));
  const hoofGeo = (() => {
    const g = lathe([[0.001, 0], [0.066, 0], [0.068, 0.012], [0.064, 0.045], [0.058, 0.07], [0.054, 0.078], [0.001, 0.08]], 14);
    const pa = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) pa.setXYZ(i, pa.getX(i), pa.getY(i), pa.getZ(i) * 1.1 - pa.getY(i) * 0.25 + 0.01);
    g.computeVertexNormals();
    return g;
  })();
  const frontLegs: THREE.Group[] = [];
  const hoofAnchors: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const sp = v3(sx * 0.12, 0.8, 0.3);
    const fg = group(pose, [sp.x - HIP.x, sp.y - HIP.y, sp.z - HIP.z]);
    const pts = [v3(sx * 0.12, 0.9, 0.27), v3(sx * 0.135, 0.62, 0.33), v3(sx * 0.14, 0.42, 0.34), v3(sx * 0.14, 0.3, 0.345), v3(sx * 0.14, 0.14, 0.35), v3(sx * 0.14, 0.09, 0.36), v3(sx * 0.14, 0.055, 0.372)].map((p) => p.sub(sp));
    add(fg, legPaint(loft(pts, legProfF, { segs: 30, radial: 14, side: X }), sp), M.coat).userData.inkGroup = COAT;
    add(fg, hoofGeo, M.hoof, [sx * 0.14 - sp.x, -sp.y, 0.372 - sp.z]);
    hoofAnchors.push(group(fg, [sx * 0.14 - sp.x, 0.02 - sp.y, 0.43 - sp.z]));
    frontLegs.push(fg);
    const hp = [v3(sx * 0.13, 0.92, -0.36), v3(sx * 0.152, 0.62, -0.3), v3(sx * 0.152, 0.46, -0.36), v3(sx * 0.15, 0.34, -0.44), v3(sx * 0.146, 0.2, -0.43), v3(sx * 0.145, 0.1, -0.41), v3(sx * 0.145, 0.055, -0.396)];
    add(root, legPaint(loft(hp, legProfH, { segs: 32, radial: 14, side: X }), v3(0, 0, 0)), M.coat).userData.inkGroup = COAT;
    add(root, hoofGeo, M.hoof, [sx * 0.145, 0, -0.396]);
  }

  // ── Neck: arching up and forward from the chest; the neck group handles looking around (its root hidden in the torso) ──
  const NP = v3(0, 0.98, 0.3);
  const neck = group(body, [NP.x, NP.y, NP.z]);
  const neckCurve = new THREE.CatmullRomCurve3([v3(0, 0.88, 0.22), v3(0, 1.06, 0.37), v3(0, 1.22, 0.47), v3(0, 1.34, 0.53)].map((p) => p.sub(NP)), false, 'centripetal');
  const neckProf = curveTable([[0, 0, 0], [0.06, 0.16, 0.19], [0.3, 0.158, 0.19], [0.6, 0.13, 0.16], [0.88, 0.106, 0.132], [0.96, 0.085, 0.105], [1, 0, 0]]);
  const neckGeo = paint(loft(neckCurve.points, neckProf, { segs: 28, radial: 22 }), (p, n) => cCoat.clone().lerp(cPale, sstep(-n.y + n.z * 0.4, 0.5, 0.95) * 0.55));
  add(neck, neckGeo, M.coat).userData.inkGroup = COAT;
  const probeNeck = prober(neckGeo);

  // ── Mane: an upright brush mane along the neck crest, its top edge cut into clumps of points (pointed tips, round valleys) with the roots buried in the neck; deep navy, with the tips turning a paler gray-blue ──
  {
    const NT = 10;
    const NU = NT * 8;
    const tuft = (u: number) => {
      const x = (u * NT) % 1;
      return 0.64 + 0.36 * Math.abs(2 * x - 1) ** 1.7;
    };
    const hB = curveTable([[0, 0.04], [0.15, 0.11], [0.5, 0.175], [0.85, 0.165], [1, 0.12]]);
    const crest = (u: number) => {
      const t = lerp(0.12, 1, u);
      const { C, T, U } = pathFrame(neckCurve, t);
      const b = neckProf(t)[1];
      const D = U.clone().addScaledVector(T, 0.25).normalize();
      return { base: C.clone().addScaledVector(U, b * 0.86), D };
    };
    const S = (u: number, v: number) => {
      const { base, D } = crest(u);
      return base.addScaledVector(D, v * hB(u)[0] * tuft(u) - 0.03);
    };
    const geo = thickSheet(NU, 6, S, (u, v) => (0.09 - 0.05 * v) * (0.55 + 0.45 * sstep(u, 0, 0.15)), {
      E: 2,
      outward: X,
      color: (u, v) => cMane.clone().lerp(cManeTip, sstep(v, 0.55, 1) * 0.7),
    });
    add(neck, geo, M.coat).userData.inkGroup = MANE;
  }

  // ── Head group: inside the neck group, with the origin at the center of the skull; the head's coordinates do not pitch, so the eyes look level ──
  const HC = v3(0, 1.34, 0.6);
  const headPivot = group(neck, [HC.x - NP.x, HC.y - NP.y, HC.z - NP.z]);
  const head = group(headPivot);
  const headCurve = new THREE.CatmullRomCurve3([v3(0, 0.07, -0.13), v3(0, 0.056, -0.04), v3(0, 0.0, 0.06), v3(0, -0.09, 0.17), v3(0, -0.17, 0.26)], false, 'centripetal');
  const headProf = curveTable([
    [0, 0, 0, 0],
    [0.04, 0.085, 0.095, 0],
    [0.14, 0.12, 0.135, -0.01],
    [0.3, 0.122, 0.14, -0.035],
    [0.46, 0.098, 0.112, -0.02],
    [0.62, 0.08, 0.088, -0.005],
    [0.8, 0.078, 0.082, 0],
    [0.92, 0.082, 0.078, -0.004],
    [0.975, 0.066, 0.06, 0],
    [1, 0, 0, 0],
  ]);
  const hA = headCurve.getPointAt(0);
  const hDir = headCurve.getPointAt(1).sub(hA);
  const hLen = hDir.length();
  hDir.normalize();
  const sOf = (p: THREE.Vector3) => p.clone().sub(hA).dot(hDir) / hLen;
  // The eye positions are computed first (the head's vertex colors need to paint the pale eye rings)
  const headRaw = loft(headCurve.points, headProf, { segs: 40, radial: 26 });
  const probeHead0 = prober(headRaw);
  // The eyes follow a horse's proportions: small, dark and sunk into the sockets (diameter about 17% of the head width), with only one small highlight
  const ER = 0.021;
  const eyeInfo = [-1, 1].map((sx) => {
    const { C } = pathFrame(headCurve, 0.2);
    const d = v3(sx * 0.76, 0.3, 0.58).normalize();
    const h = probeHead0(C.clone().add(v3(0, 0.03, 0)).addScaledVector(d, 0.5), d.clone().negate())!;
    return { sx, d, hit: h.p, c: h.p.clone().addScaledVector(d, -ER * 0.3) };
  });
  const headGeo = paint(headRaw, (p, n) => {
    // The muzzle is dark (the same color as the socks on the four hooves), with the inside of the lower jaw a little paler
    const c = cCoat.clone().lerp(cCoatHi, sstep(n.y, 0.4, 0.9) * 0.5);
    c.lerp(cPale, sstep(-n.y, 0.6, 0.95) * 0.35);
    c.lerp(cSock, sstep(sOf(p), 0.7, 0.82));
    return c;
  });
  add(head, headGeo, M.coat).userData.inkGroup = COAT;
  const probeHead = prober(headGeo);

  // Eyes: a horse's big dark eyes, with the iris and horizontal pupil filling the eye and two highlights; the upper and lower eyelids are the fur color, with no lashes and no sclera showing
  const glints: THREE.Object3D[] = [];
  const lids: { g: THREE.Group; open: number; shut: number }[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const eyeball = new THREE.SphereGeometry(ER, 14, 8, 0, PI * 2, 0, PI / 2).rotateX(PI / 2);
  const UP_OPEN = -0.7;
  const LO_OPEN = 0.5;
  const lidUp = lidLite(ER + 0.002, ER + 0.0075, PI / 2, true);
  const lidLow = lidLite(ER + 0.001, ER + 0.005, PI / 2, false);
  const cIris = col(0x2a170e);
  const cPupil = col(0x0e0a09);
  for (const e of eyeInfo) {
    const eg = group(head, [e.c.x, e.c.y, e.c.z]);
    const r = new THREE.Vector3().crossVectors(Y, e.d).normalize();
    const u = new THREE.Vector3().crossVectors(e.d, r);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, e.d));
    add(eg, eyeball, M.eye);
    // Iris outer ring, iris, bright color at the lower edge, horizontal pupil: the same vertex-color material, the same outline group
    // An almost entirely black eye: only a very dark brown iris ring and a horizontal pupil, with no pale concentric circles
    const irisParts: [THREE.BufferGeometry, THREE.Color][] = [
      [lightDecal(ellipsePts(0.78, 0.7, 0, 20), ER + 0.0008), cIris],
      [lightDecal(ellipsePts(0.5, 0.22, 0.02, 14), ER + 0.0016, 0, 1), cPupil],
    ];
    for (const [g, c] of irisParts) add(eg, paint(g, () => c), M.iris).userData.inkGroup = EYEI;
    for (const [x, y, rr] of [[-0.006 * e.sx, 0.007, 0.0042]] as [number, number, number][]) {
      const hl = add(eg, new THREE.SphereGeometry(rr, 8, 6), M.hi, [x, y, ER * 0.97], [0, 0, 0], [1, 1, 0.5]);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    const upper = group(eg, [0, 0, 0], [UP_OPEN, 0, 0]);
    add(upper, paint(lidUp.clone(), () => cCoat.clone()), M.coat).userData.inkGroup = COAT;
    lids.push({ g: upper, open: UP_OPEN, shut: LO_OPEN + 0.12 });
    const lower = group(head, [e.c.x, e.c.y, e.c.z]);
    lower.quaternion.copy(eg.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(X, PI + LO_OPEN));
    add(lower, paint(lidLow.clone(), () => cCoat.clone()), M.coat).userData.inkGroup = COAT;
    eyeAnchors.push(group(eg, [0, 0, ER]));
    // Bone ridge above the eye: the same color, lying against the skull, giving only a slight rise above the eye (not a human brow)
    const ridge: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const a = lerp(-1, 1, i / 6);
      const target = e.hit.clone().addScaledVector(u, 0.026 + 0.006 * (1 - a * a)).addScaledVector(r, a * 0.034);
      const h = probeHead(target.clone().addScaledVector(e.d, 0.2), e.d.clone().negate());
      if (h) ridge.push(h.p.addScaledVector(h.n, 0.001));
    }
    if (ridge.length > 3) add(head, paint(loft(ridge, (t) => [0.011 * Math.sin(PI * t) ** 0.6 + 0.001, 0.007 * Math.sin(PI * t) ** 0.6 + 0.001], { segs: 12, radial: 8 }), () => cCoat.clone().lerp(cCoatHi, 0.4)), M.coat).userData.inkGroup = COAT;
  }

  // Lightning blaze: a yellow bolt of lightning from the forehead to the nose bridge, lying on the face's curved surface (after subdivision each point is cast onto the surface and then floated slightly)
  const blazeA = group(head);
  {
    const shape = new THREE.Shape();
    const pts: [number, number][] = [[-0.056, 0], [0.05, 0], [0.014, 0.37], [0.064, 0.35], [-0.034, 1], [-0.004, 0.55], [-0.058, 0.575]];
    shape.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) shape.lineTo(p[0], p[1]);
    shape.closePath();
    const flat = new THREE.ShapeGeometry(shape, 1).toNonIndexed();
    const src = flat.attributes.position as THREE.BufferAttribute;
    let tris: [number, number][][] = [];
    for (let i = 0; i < src.count; i += 3) tris.push([0, 1, 2].map((k) => [src.getX(i + k), src.getY(i + k)] as [number, number]));
    for (let l = 0; l < 3; l++) {
      const next: [number, number][][] = [];
      for (const [a, b, c] of tris) {
        const m = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        next.push([a, m(a, b), m(c, a)], [m(a, b), b, m(b, c)], [m(c, a), m(b, c), c], [m(a, b), m(b, c), m(c, a)]);
      }
      tris = next;
    }
    const pos: number[] = [];
    const nor: number[] = [];
    for (const t of tris)
      for (const [w, s] of t) {
        const { C, U } = pathFrame(headCurve, lerp(0.17, 0.86, s));
        const h = probeHead(C.clone().addScaledVector(U, 0.4).addScaledVector(X, w), U.clone().negate());
        const p = h ? h.p.addScaledVector(h.n, 0.0025) : C;
        pos.push(p.x, p.y, p.z);
        const n = h ? h.n : U;
        nor.push(n.x, n.y, n.z);
      }
    // After a flat triangle is projected onto a curved surface its winding may be reversed: compare each triangle with its normal and swap if reversed
    for (let i = 0; i < pos.length; i += 9) {
      const a = v3(pos[i], pos[i + 1], pos[i + 2]);
      const fnm = v3(pos[i + 3], pos[i + 4], pos[i + 5]).sub(a).cross(v3(pos[i + 6], pos[i + 7], pos[i + 8]).sub(a));
      if (fnm.dot(v3(nor[i], nor[i + 1], nor[i + 2])) < 0)
        for (let c = 0; c < 3; c++) {
          [pos[i + 3 + c], pos[i + 6 + c]] = [pos[i + 6 + c], pos[i + 3 + c]];
          [nor[i + 3 + c], nor[i + 6 + c]] = [nor[i + 6 + c], nor[i + 3 + c]];
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    add(head, g, M.blaze);
    const { C, U } = pathFrame(headCurve, 0.2);
    const h = probeHead(C.clone().addScaledVector(U, 0.4), U.clone().negate())!;
    blazeA.position.copy(h.p);
  }

  // Muzzle: the nostrils are two dark ellipses set into both sides of the nose tip (open, facing forward and up), and the lower lip is a bulge under the nose tip, with the lip line given by the part lines
  {
    for (const sx of [-1, 1]) {
      const { C } = pathFrame(headCurve, 0.9);
      const d = v3(sx * 0.62, 0.42, 0.66).normalize();
      const h = probeHead(C.clone().addScaledVector(d, 0.4), d.clone().negate())!;
      const m = add(head, new THREE.SphereGeometry(1, 12, 8), M.nostril, [h.p.x, h.p.y, h.p.z]);
      m.position.addScaledVector(h.n, -0.004);
      m.quaternion.setFromUnitVectors(Z, h.n);
      m.rotateZ(sx * 0.6);
      m.scale.set(0.024, 0.013, 0.008);
    }
    const { C, U, T } = pathFrame(headCurve, 0.86);
    const h = probeHead(C.clone().addScaledVector(U, -0.4), U.clone())!;
    const lip = add(head, paint(new THREE.SphereGeometry(1, 16, 10), () => cSock.clone().lerp(cCoat, 0.15)), M.coat, [h.p.x, h.p.y, h.p.z]);
    lip.position.addScaledVector(h.n, -0.012).addScaledVector(T, -0.01);
    const yy = new THREE.Vector3().crossVectors(h.n, X).normalize();
    lip.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(yy, h.n), yy, h.n));
    lip.scale.set(0.058, 0.07, 0.034);
  }

  // Ears: two pointed leaf-shaped ears standing forward on top of the head, fur-colored on the outside with a dark ear shell in front
  const ears: { g: THREE.Group; sx: number }[] = [];
  for (const sx of [-1, 1]) {
    const { C } = pathFrame(headCurve, 0.09);
    const h = probeHead(C.clone().add(v3(sx * 0.062, 0.4, 0)), v3(0, -1, 0))!;
    const eg = group(head, [h.p.x, h.p.y - 0.012, h.p.z]);
    const up = v3(sx * 0.3, 1, 0.12).normalize();
    const zz = Z.clone().addScaledVector(up, -Z.dot(up)).normalize();
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, zz), up, zz));
    // A group placed with a quaternion must not write rotation again (it would be overwritten by the Euler recomputation), so the ear-turning motion goes in a child group
    const sw = group(eg);
    const earPts = [v3(0, -0.01, 0), v3(0, 0.045, 0.004), v3(-sx * 0.004, 0.09, 0.003), v3(-sx * 0.016, 0.122, -0.004)];
    add(sw, paint(loft(earPts, curveTable([[0, 0.03, 0.027], [0.35, 0.034, 0.028], [0.72, 0.022, 0.019], [1, 0, 0]]), { segs: 14, radial: 12, side: X }), () => cCoat.clone()), M.coat).userData.inkGroup = COAT;
    add(sw, paint(loft([v3(0, 0.018, 0.022), v3(-sx * 0.002, 0.055, 0.024), v3(-sx * 0.008, 0.095, 0.016)], curveTable([[0, 0.016, 0.009], [0.4, 0.02, 0.01], [1, 0, 0]]), { segs: 10, radial: 10, side: X }), () => cMane.clone().lerp(cCoat, 0.25)), M.coat);
    ears.push({ g: sw, sx });
  }
  // A small upright tuft of forelock between the two ears (the same color as the brush mane on the neck)
  {
    const { C } = pathFrame(headCurve, 0.12);
    const h = probeHead(C.clone().add(v3(0, 0.4, 0)), v3(0, -1, 0))!;
    const S = (u: number, v: number) => {
      const x = (u * 3) % 1;
      const hh = 0.1 * (0.62 + 0.38 * Math.abs(2 * x - 1) ** 1.7) * (0.7 + 0.3 * Math.sin(PI * u));
      return h.p.clone().add(v3(0, 0, lerp(-0.045, 0.045, u))).addScaledVector(v3(0, 1, 0.35).normalize(), v * hh - 0.02);
    };
    add(head, thickSheet(24, 4, S, (u, v) => 0.05 - 0.025 * v, { E: 2, outward: X, color: (u, v) => cMane.clone().lerp(cManeTip, sstep(v, 0.5, 1) * 0.7) }), M.coat).userData.inkGroup = MANE;
  }

  // ── Bronze bell collar: a leather band around the middle of the neck, with the lead horse's bronze bell hanging under the throat ──
  let bellPivot: THREE.Group;
  let bellMouth: THREE.Group;
  {
    const t = 0.36;
    const { C, U } = pathFrame(neckCurve, t);
    const P: THREE.Vector3[] = [];
    const N: THREE.Vector3[] = [];
    let bottom = C.clone();
    let bottomN = U.clone().negate();
    const K = 40;
    for (let i = 0; i < K; i++) {
      const psi = (i / K) * PI * 2;
      const d = X.clone().multiplyScalar(Math.cos(psi)).addScaledVector(U, Math.sin(psi));
      const h = probeNeck(C.clone().addScaledVector(d, 0.5), d.clone().negate());
      if (!h) continue;
      P.push(h.p);
      N.push(h.n);
      if (i === (3 * K) / 4) {
        bottom = h.p.clone();
        bottomN = h.n.clone();
      }
    }
    add(neck, paint(strap(P, N, 0.042, 0.013, true), () => cLeather), M.cloth);
    // Bell clasp: a small bronze ring under the collar
    const loop = add(neck, new THREE.TorusGeometry(0.016, 0.0055, 6, 14), M.brass, [bottom.x, bottom.y, bottom.z]);
    loop.position.addScaledVector(bottomN, 0.018);
    loop.quaternion.setFromUnitVectors(Z, X);
    bellPivot = group(neck, [loop.position.x, loop.position.y - 0.012, loop.position.z]);
    const bell = group(bellPivot);
    add(bell, lathe([[0.001, -0.03], [0.022, -0.042], [0.033, -0.07], [0.038, -0.082], [0.044, -0.082], [0.043, -0.07], [0.035, -0.042], [0.027, -0.018], [0.014, -0.005], [0.001, 0]], 16), M.brass);
    add(bell, new THREE.SphereGeometry(0.012, 8, 6), M.nostril, [0, -0.074, 0]);
    add(bell, new THREE.CircleGeometry(0.036, 14).rotateX(PI / 2), M.nostril, [0, -0.079, 0]);
    bellMouth = group(bell, [0, -0.085, 0]);
  }

  // ── Tail: two red cords wrapped on the tail root, hanging to the hock, with the end split into several clumps ──
  const TP = v3(0, 0.9, -0.58);
  const tail = group(body, [TP.x, TP.y, TP.z]);
  const tailPts = [v3(0, 0.02, 0.06), v3(0, 0.01, -0.06), v3(0, -0.08, -0.16), v3(0.02, -0.3, -0.22), v3(0.04, -0.52, -0.2), v3(0.055, -0.66, -0.15)];
  const tailCurve = new THREE.CatmullRomCurve3(tailPts, false, 'centripetal');
  const tailProf = curveTable([[0, 0, 0], [0.04, 0.045, 0.045], [0.18, 0.05, 0.05], [0.4, 0.075, 0.064], [0.65, 0.085, 0.07], [0.86, 0.066, 0.055], [0.95, 0.035, 0.03], [1, 0, 0]]);
  add(tail, paint(loft(tailPts, tailProf, { segs: 34, radial: 16, side: X }), (p) => cMane.clone().lerp(cManeTip, sstep(-p.y, 0.4, 0.66) * 0.45)), M.coat).userData.inkGroup = TAIL;
  // Two clumps of hair at the tail end splaying outward
  for (const [dx, dz, len] of [[-1, 0.3, 0.13], [1, -0.2, 0.11]] as [number, number, number][]) {
    const b = tailCurve.getPointAt(0.84);
    const pts = [b.clone(), b.clone().add(v3(dx * 0.03, -0.07, dz * 0.03)), b.clone().add(v3(dx * 0.05, -0.07 - len, dz * 0.05 + 0.02))];
    add(tail, paint(loft(pts, curveTable([[0, 0.035, 0.03], [0.5, 0.03, 0.026], [1, 0, 0]]), { segs: 10, radial: 10, side: X }), () => cMane.clone().lerp(cManeTip, 0.35)), M.coat).userData.inkGroup = TAIL;
  }
  for (const t of [0.13, 0.22]) {
    const { C, T } = { C: tailCurve.getPointAt(t), T: tailCurve.getTangentAt(t) };
    const [a, b] = tailProf(t);
    const W = X.clone().addScaledVector(T, -T.dot(X)).normalize();
    const H = new THREE.Vector3().crossVectors(W, T).normalize();
    const P: THREE.Vector3[] = [];
    const N: THREE.Vector3[] = [];
    for (let i = 0; i < 24; i++) {
      const th = (i / 24) * PI * 2;
      const n = W.clone().multiplyScalar(Math.cos(th) * b).addScaledVector(H, Math.sin(th) * a).normalize();
      P.push(C.clone().addScaledVector(W, Math.cos(th) * a * 0.96).addScaledVector(H, Math.sin(th) * b * 0.96));
      N.push(n);
    }
    add(tail, paint(strap(P, N, 0.026, 0.014, true, 8), () => cRed), M.cloth);
  }

  // ── Saddle blanket: felt lying against the back, red with a wide cream edge and a yellow lightning appliqué sewn on each side; the lower edge hangs slightly away from the body ──
  const PHI = 1.42;
  const BZ0 = -0.22;
  const BZ1 = 0.2;
  const GI = 24;
  const GJ = 12;
  const grid: { p: THREE.Vector3; n: THREE.Vector3 }[][] = [];
  for (let i = 0; i <= GI; i++) {
    const row: { p: THREE.Vector3; n: THREE.Vector3 }[] = [];
    const phi = lerp(-PHI, PHI, i / GI);
    for (let j = 0; j <= GJ; j++) {
      const z = lerp(BZ0, BZ1, j / GJ);
      const d = v3(Math.sin(phi), Math.cos(phi), 0);
      const h = probeTorso(v3(0, 0.8, z).addScaledVector(d, 0.6), d.clone().negate())!;
      row.push(h);
    }
    grid.push(row);
  }
  /** Saddle blanket surface (u runs from the lower edge on the right side over the back to the lower edge on the left side, v from back to front): bilinear interpolation of the grid, with off the height away from the body */
  const blanketAt = (u: number, v: number, off: number) => {
    const x = THREE.MathUtils.clamp(u, 0, 1) * GI;
    const y = THREE.MathUtils.clamp(v, 0, 1) * GJ;
    const i = Math.min(GI - 1, Math.floor(x));
    const j = Math.min(GJ - 1, Math.floor(y));
    const fx = x - i;
    const fy = y - j;
    const P = new THREE.Vector3();
    const N = new THREE.Vector3();
    for (const [di, dj, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]] as [number, number, number][]) {
      P.addScaledVector(grid[i + di][j + dj].p, w);
      N.addScaledVector(grid[i + di][j + dj].n, w);
    }
    N.normalize();
    const flare = 0.03 * sstep(Math.abs(u - 0.5), 0.3, 0.5);
    return { p: P.addScaledVector(N, off + flare), n: N };
  };
  const BTH = 0.018;
  {
    const U = nodes(36, [0.075, 0.925]);
    const V = nodes(12, [0.11, 0.89]);
    const uu = (s: number) => U[Math.round(s * (U.length - 1))];
    const vv = (s: number) => V[Math.round(s * (V.length - 1))];
    const geo = thickSheet(U.length - 1, V.length - 1, (s, r) => blanketAt(uu(s), vv(r), 0.012).p, () => BTH, {
      E: 2,
      outward: Y,
      color: (s, r, side) => {
        if (side < 0) return cRedIn.clone();
        const u = uu(s);
        const v = vv(r);
        const border = u < 0.075 || u > 0.925 || v < 0.11 || v > 0.89;
        return border ? cCream.clone() : cRed.clone();
      },
    });
    add(body, geo, M.cloth).userData.inkGroup = BLANKET;
    // Lightning appliqués: an extruded flat plate, each vertex laid onto the saddle blanket surface by (u, v)
    for (const sx of [-1, 1]) {
      const pts: [number, number][] = [[0, 0.02], [0.3, 0], [0.42, 0.38], [0.6, 0.3], [1, 1], [0.52, 0.64], [0.36, 0.72]];
      const shape = new THREE.Shape();
      shape.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) shape.lineTo(p[0], p[1]);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 });
      const pa = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pa.count; i++) {
        const a = pa.getX(i);
        const b = pa.getY(i);
        const c = pa.getZ(i);
        // a runs forward along the body and b from top to bottom; left and right sides are mirrored
        const v = lerp(0.16, 0.84, a);
        const uS = lerp(0.12, 0.4, b);
        const u = sx > 0 ? 1 - uS : uS;
        const q = blanketAt(u, v, 0.012 + BTH / 2 + 0.0015 + c * 0.008);
        pa.setXYZ(i, q.p.x, q.p.y, q.p.z);
      }
      g.deleteAttribute('normal');
      g.deleteAttribute('uv');
      g.computeVertexNormals();
      // The right side is mirrored, so a triangle whose winding is reversed has the whole sheet flipped (check whether the normal points away from the body axis)
      {
        const na = g.attributes.normal as THREE.BufferAttribute;
        let sgn = 0;
        for (let i = 0; i < pa.count; i++) sgn += na.getX(i) * pa.getX(i) + na.getY(i) * (pa.getY(i) - 0.8);
        if (sgn < 0) {
          const arr = pa.array as Float32Array;
          for (let i = 0; i < pa.count; i += 3)
            for (let c = 0; c < 3; c++) [arr[(i + 1) * 3 + c], arr[(i + 2) * 3 + c]] = [arr[(i + 2) * 3 + c], arr[(i + 1) * 3 + c]];
          pa.needsUpdate = true;
          g.computeVertexNormals();
        }
      }
      add(body, paint(g, () => cYellow), M.cloth);
    }
  }

  // ── Wooden saddle: a leather seat, with the front and rear bows as two raised wooden arches, a few bronze nails on the arch faces ──
  const saddleA = group(body);
  {
    const seat = thickSheet(16, 8, (s, r) => {
      const u = lerp(0.3, 0.7, s);
      const v = lerp(0.3, 0.74, r);
      return blanketAt(u, v, 0.012 + BTH + 0.012 + 0.012 * Math.sin(PI * s) * Math.sin(PI * r)).p;
    }, () => 0.024, { E: 2, outward: Y, color: (s, r, side) => (side > 0 ? cLeather.clone().lerp(col(0x7a4c30), Math.sin(PI * s) * 0.5) : cLeather.clone().multiplyScalar(0.7)) });
    add(body, seat, M.cloth);
    const top = blanketAt(0.5, 0.52, 0.012 + BTH + 0.04).p;
    saddleA.position.copy(top);
    // Front and rear bows: solid wooden boards, the lower edge against the two ends of the seat and the upper edge an arch (the rear bow higher), with three bronze nails on the outward face
    for (const [v, hgt] of [[0.77, 0.06], [0.27, 0.085]] as [number, number][]) {
      const bottom = (s: number) => blanketAt(lerp(0.29, 0.71, s), v, 0.012 + BTH).p;
      const topY = (s: number) => bottom(s).y + 0.035 + hgt * Math.sin(PI * s) ** 0.7;
      const plate = thickSheet(14, 3, (s, r) => {
        const b = bottom(s);
        return b.setY(lerp(b.y - 0.006, topY(s), r));
      }, () => 0.03, { E: 2, outward: v > 0.5 ? Z : Z.clone().negate(), color: (s, r, side) => cWood.clone().multiplyScalar(side > 0 ? 1 : 0.85) });
      add(body, plate, M.cloth);
      const face = v > 0.5 ? 1 : -1;
      for (const s of [0.3, 0.5, 0.7]) {
        const b = bottom(s);
        add(body, new THREE.SphereGeometry(0.009, 8, 6), M.brass, [b.x, lerp(b.y, topY(s), 0.62), b.z + face * 0.017]);
      }
    }
  }

  // ── Girth: a leather strap passing under the belly between the lower edges of the saddle blanket ──
  {
    const P: THREE.Vector3[] = [];
    const N: THREE.Vector3[] = [];
    const z = lerp(BZ0, BZ1, 0.55);
    for (let i = 0; i <= 26; i++) {
      const phi = lerp(PHI - 0.12, 2 * PI - PHI + 0.12, i / 26);
      const d = v3(Math.sin(phi), Math.cos(phi), 0);
      const h = probeTorso(v3(0, 0.8, z).addScaledVector(d, 0.6), d.clone().negate());
      if (!h) continue;
      P.push(h.p);
      N.push(h.n);
    }
    add(body, paint(strap(P, N, 0.045, 0.012), () => cLeather), M.cloth);
  }

  // ── Back: a roll of the tribe's yurt felt is tied behind the rear saddle bow, with two red cords, the spiral visible at the roll's open end ──
  const bundleG = group(body);
  {
    const h = probeTorso(v3(0, 1.4, -0.235), v3(0, -1, 0))!;
    const R = 0.068;
    const HL = 0.2;
    bundleG.position.copy(h.p).add(v3(0, R + 0.012, -0.005));
    const prof: [number, number][] = [];
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * (PI / 2);
      prof.push([Math.max(0.001, (R - 0.012) + 0.012 * Math.sin(a)), -HL - 0.012 * Math.cos(a) + 0.012]);
    }
    for (let i = 4; i >= 0; i--) {
      const a = (i / 4) * (PI / 2);
      prof.push([Math.max(0.001, (R - 0.012) + 0.012 * Math.sin(a)), HL + 0.012 * Math.cos(a) - 0.012]);
    }
    prof.unshift([0.001, -HL]);
    prof.push([0.001, HL]);
    const roll = paint(lathe(prof, 18).rotateZ(PI / 2), (p) => cFelt.clone().multiplyScalar(0.94 + 0.06 * Math.sin(p.x * 60)));
    add(bundleG, roll, M.cloth);
    for (const x of [-0.12, 0.12]) {
      const P: THREE.Vector3[] = [];
      const N: THREE.Vector3[] = [];
      for (let i = 0; i < 20; i++) {
        const th = (i / 20) * PI * 2;
        const n = v3(0, Math.sin(th), Math.cos(th));
        P.push(v3(x, 0, 0).addScaledVector(n, R - 0.001));
        N.push(n);
      }
      add(bundleG, paint(strap(P, N, 0.022, 0.012, true), () => cRed), M.cloth);
    }
    // The spiral at the open end of the roll: a dark shallow raised strip at each end
    for (const sx of [-1, 1]) {
      const P: THREE.Vector3[] = [];
      const N: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const k = i / 40;
        const th = k * PI * 4.2;
        const r = lerp(0.012, R - 0.02, k);
        P.push(v3(sx * HL, Math.sin(th) * r, Math.cos(th) * r));
        N.push(v3(sx, 0, 0));
      }
      add(bundleG, paint(strap(P, N, 0.009, 0.004, false, 6), () => cFeltDark), M.cloth);
    }
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle action: a light sway as if shifting feet, the neck rising and falling slightly and looking around, the ears turning in turn, the tail flicking, the bronze bell swinging along, blinking ──
  const act = { rear: 0, charge: 0, glow: 0 };
  const blazeEm = M.blaze.emissiveIntensity;
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    const { rear, charge, glow } = act;
    const still = 1 - Math.min(1, rear + charge);
    const br = Math.sin(t * 1.5);
    body.scale.set(1 + br * 0.006, 1 + br * 0.006, 1);
    body.rotation.z = Math.sin(t * 0.6) * 0.012 * still;
    pose.rotation.x = -rear * 0.62 + charge * 0.06;
    for (const fg of frontLegs) fg.rotation.x = -rear * 1.1;
    neck.rotation.y = (0.1 + Math.sin(t * 0.37) * 0.12) * still;
    neck.rotation.x = Math.sin(t * 0.9) * 0.025 + charge * 0.42 - rear * 0.25;
    head.rotation.x = Math.sin(t * 0.9 - 0.6) * 0.03 + charge * 0.2 - rear * 0.2;
    head.rotation.z = Math.sin(t * 0.37 + 0.8) * 0.03 * still;
    // Ears: normally forward, with one occasionally turning to the side and back to listen for noises; when charging up, both ears lay back
    for (const e of ears) {
      const ph = (t + (e.sx > 0 ? 0 : 2.6)) % 5.2;
      const turn = ph < 1.6 ? Math.sin((ph / 1.6) * PI) : 0;
      e.g.rotation.y = e.sx * (turn * 0.9 * still);
      e.g.rotation.x = -charge * 1.0;
    }
    tail.rotation.y = Math.sin(t * 1.3) * 0.22 + Math.sin(t * 2.9) * 0.05;
    tail.rotation.x = 0.16 + Math.sin(t * 0.8) * 0.04 - rear * 0.3;
    bellPivot.rotation.x = -Math.sin(t * 0.9 + 0.5) * 0.12 - neck.rotation.x * 0.8;
    bellPivot.rotation.z = Math.sin(t * 1.3) * 0.08;
    // Blink: once every 3.4 seconds, occasionally a double blink
    const bt = t % 3.4;
    const bk = (x: number) => (x > 0 && x < 0.2 ? Math.min(1, Math.sin((x / 0.2) * PI) * 1.4) : 0);
    const close = Math.max(bk(bt - 3.05), Math.floor(t / 3.4) % 3 === 2 ? bk(bt - 2.7) : 0);
    for (const l of lids) l.g.rotation.x = lerp(l.open, l.shut, close);
    for (const g of glints) g.visible = close < 0.6;
    if (glow !== lastGlow) {
      lastGlow = glow;
      M.blaze.emissiveIntensity = blazeEm + glow * 0.6;
    }
  };
  update(0);

  // Anchors
  const faceC = pathFrame(headCurve, 0.45);
  const muzzle = pathFrame(headCurve, 0.97);
  const chestH = probeTorso(v3(0, 0.84, 1.2), v3(0, 0, -1))!;
  const rig = {
    head: group(head, [faceC.C.x, faceC.C.y + 0.06, faceC.C.z + 0.02]),
    eyes: eyeAnchors,
    anchors: {
      mouth: group(head, [muzzle.C.x, muzzle.C.y - 0.04, muzzle.C.z]),
      blaze: blazeA,
      bell: bellMouth,
      saddle: saddleA,
      chest: group(body, [chestH.p.x, chestH.p.y, chestH.p.z]),
      tailTip: group(tail, [tailPts[5].x, tailPts[5].y, tailPts[5].z]),
      hoofFL: hoofAnchors[1],
      hoofFR: hoofAnchors[0],
    },
  };
  mergeStatic(root, {
    owners: [pose, body, neck, headPivot, head, tail, bellPivot, ...frontLegs, ...ears.map((e) => e.g), ...lids.map((l) => l.g)],
    keep: [...glints],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.82, 0.02), radius: 1.0 };
}
