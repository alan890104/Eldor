// Scroll Cat (model lab version): lives in the scriptorium of the Starvault Sage Tower, and the paw prints it leaves after stepping in ink turn into little moving paintings. The sages found that what it draws is often what someone else is thinking.
// Neutral, R. Three identifying features:
// 1. A cat the color of xuan paper, with ink painting on its body: all four feet look freshly dipped in ink, bleeding upward from the paws; the ear tips and a splash of ink on its back are also ink-colored, with bleeding edges.
// 2. The end of the tail is a brush loaded with ink: a red cord ties the root of the brush, and the ink-black belly of the bristles tapers to a pointed tip; the tail curves into a question mark with the tip pointing down, as if about to touch paper.
// 3. It stands on an unrolled painting scroll: the xuan paper has blue-gray silk borders on both sides, the back end is rolled on a wooden spindle, and a vermilion seal is stamped on the front corner;
//    it leaves two ink paw prints where it has walked, and the third print has already turned into a little ink fish flicking its tail on the paper (the "paw prints turn into little moving paintings").
// The face follows a real cat: a round head, big triangular ears, two puffed whisker pads and a small chin, and an inverted-triangle nose; the eyes are small and sunk in dark eye rings, with dark cyan-green irises and vertical pupils and one small highlight; no mouth line is drawn.
// Personality: a curious and slightly mischievous scriptorium page, who halfway through a walk lifts an ink-dipped front paw and looks back at you, the brush on its tail already ready.
// Gaze order: the head (dark eye rings, big forward-facing ears) and the raised ink paw first, the brush on the tail second, and the scroll, vermilion seal and ink fish as support.
// Back: the ink paw prints on the scroll run all the way to the wooden spindle at the back, the last one turning into a little ink fish; the brush tip of the tail is clearest from behind.
// Restrained light effects: no emissive.
// Action table: idle: the raised front paw flicks ink lightly, the brush on the tail slowly swings, the head tilts, the ears turn in turn, and the little ink fish on the paper flicks its tail; move: a light walk leaving an ink print at each step;
//   charge-up act.swipe pulls the tail back; strike swings the brush on the tail forward (act.swipe goes from 1 back to 0); hit lays the ears back and shrinks slightly; victory sits down and licks the raised ink paw.
// Anchors: head, eyes, mouth, brush (brush tip), paw (the raised front paw), fish (the little ink fish on the paper), seal (vermilion seal). act: swipe.

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

/** A shape lying flat on the paper (ink print, seal, ink fish): pts is the outer outline and holes are the cut-out holes; the plane faces +y, and the shape's +y maps to -z */
function flatInk(pts: [number, number][], holes: [number, number][][] = []): THREE.BufferGeometry {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ShapeGeometry(s, 6);
  g.rotateX(-PI / 2);
  g.deleteAttribute('uv');
  return g;
}

/** An ellipse outline in the plane */
function oval(cx: number, cy: number, rx: number, ry: number, n = 16, rot = 0): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)] as [number, number];
  });
}

/** A single ink paw print: a palm pad plus four toe pads; the toes point toward +z */
function pawPrint(): THREE.BufferGeometry[] {
  const out = [flatInk(oval(0, 0, 0.024, 0.02, 16))];
  for (const [x, y] of [[-0.026, -0.022], [-0.009, -0.034], [0.009, -0.034], [0.026, -0.022]] as [number, number][]) out.push(flatInk(oval(x, y, 0.0085, 0.011, 10)));
  return out;
}

// ───────────────────────── Shape ─────────────────────────

export function buildInkcatLab(): LabModel {
  const RIMC = 0xe8eef8;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    fur: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    paper: vc(labToon(0xffffff, { rim: 0.3, rimColor: 0xfff6e6 })),
    ink: labToon(0x1e1c24, { rim: 0.2, spec: 0.35, specTh: 0.985 }),
    seal: labToon(0xc0352b, { rim: 0.2 }),
    wood: labToon(0x5c3b27, { ramp: 'metal', spec: 0.5, specTh: 0.95, rim: 0.4, rimColor: 0xffe2c0 }),
    jade: labToon(0x6f9e84, { ramp: 'gem', spec: 0.9, specTh: 0.95, rim: 0.4, rimColor: 0xe0fff0 }),
    eye: labToon(0x17150f, { ramp: 'gem', spec: 0.8, specTh: 0.985, rim: 0 }),
    iris: vc(labToon(0xffffff, { ramp: 'gem', spec: 0.8, specTh: 0.985, rim: 0 })),
    nose: labToon(0xb98482, { spec: 0.5, specTh: 0.97, rim: 0.3 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;
  const cCoat = col(0xf1e8d6);
  const cCoatShade = col(0xe0d4bf);
  const cWash = col(0x6a6674);
  const cInk = col(0x1f1d25);
  const cPad = col(0xf8f2e6);
  const cEarIn = col(0xe8c9c0);
  const cPaper = col(0xf6efdd);
  const cPaperIn = col(0xd9ccb0);
  const cSilk = col(0x5f8493);
  const cRed = col(0xc0352b);

  const root = new THREE.Group();
  root.name = 'inkcat-lab';
  const { add, group } = partKit();
  const FUR = 9851;
  const TAILI = 9852;
  const PAPER = 9853;

  // ── Painting scroll: an unrolled sheet of xuan paper (blue-gray silk borders on both sides, the front end curling up slightly), with the back end rolled on a wooden spindle ──
  const PY = 0.012;
  const Z0 = -0.6;
  const Z1 = 0.46;
  {
    const U = nodes(16, [0.085, 0.915]);
    const uu = (s: number) => U[Math.round(s * (U.length - 1))];
    const sheet = thickSheet(U.length - 1, 24, (s, v) => {
      const u = uu(s);
      const z = lerp(Z0, Z1, v);
      return v3(lerp(-0.23, 0.23, u), PY / 2 + 0.035 * sstep(v, 0.9, 1) ** 2, z);
    }, () => PY, {
      E: 2,
      outward: Y,
      color: (s, v, side) => {
        if (side < 0) return cPaperIn.clone();
        const u = uu(s);
        return u < 0.085 || u > 0.915 ? cSilk.clone() : cPaper.clone();
      },
    });
    add(root, sheet, M.paper).userData.inkGroup = PAPER;
    // The roll at the back end: rolled-up paper, silk borders at both ends, and a wooden spindle through the middle with blue jade at the spindle heads
    const RR = 0.046;
    const roll = lathe([[0.001, -0.225], [RR - 0.004, -0.225], [RR, -0.221], [RR, 0.221], [RR - 0.004, 0.225], [0.001, 0.225]], 20).rotateZ(PI / 2);
    add(root, paint(roll, (p) => (Math.abs(p.x) > 0.205 ? cSilk.clone() : cPaper.clone().multiplyScalar(0.97 + 0.03 * Math.sin(p.x * 80)))), M.paper, [0, RR, Z0 - 0.03]);
    add(root, new THREE.CylinderGeometry(0.012, 0.012, 0.52, 10).rotateZ(PI / 2), M.wood, [0, RR, Z0 - 0.03]);
    for (const sx of [-1, 1]) add(root, lathe([[0.001, -0.018], [0.02, -0.016], [0.024, 0.0], [0.02, 0.016], [0.001, 0.02]], 12).rotateZ((sx * PI) / 2), M.jade, [sx * 0.27, RR, Z0 - 0.03]);
    // The topmost turn of the roll's opening on the paper surface: a faint spiral line, so you can tell it is rolled up
    for (const sx of [-1, 1]) {
      const P: THREE.Vector3[] = [];
      const N: THREE.Vector3[] = [];
      for (let i = 0; i <= 30; i++) {
        const k = i / 30;
        const a = k * PI * 3.6;
        const r = lerp(0.016, RR - 0.008, k);
        P.push(v3(sx * 0.226, RR + Math.sin(a) * r, Z0 - 0.03 + Math.cos(a) * r));
        N.push(X.clone().multiplyScalar(sx));
      }
      add(root, paint(strap(P, N, 0.005, 0.002, false, 6), () => cSilk.clone().multiplyScalar(0.7)), M.paper);
    }
  }
  // Vermilion seal: a red seal on the front corner of the paper, the white parts being carved characters
  const sealG = group(root, [0.13, PY + 0.0015, 0.33]);
  add(sealG, flatInk([[-0.03, -0.03], [0.03, -0.03], [0.03, 0.03], [-0.03, 0.03]], [
    [[-0.02, -0.02], [-0.011, -0.02], [-0.011, 0.02], [-0.02, 0.02]],
    [[-0.002, 0.008], [0.02, 0.008], [0.02, 0.02], [-0.002, 0.02]],
    [[-0.002, -0.02], [0.02, -0.02], [0.02, -0.004], [-0.002, -0.004]],
  ]), M.seal).rotation.y = 0.12;
  // Ink paw prints left from walking: two are still paw prints, and the third has already turned into a little ink fish
  for (const [x, z, r] of [[0.06, -0.34, 0.08], [-0.055, -0.45, -0.1]] as [number, number, number][]) {
    const pg = group(root, [x, PY + 0.0015, z], [0, r, 0]);
    for (const g of pawPrint()) add(pg, g, M.ink);
  }
  const fishPivot = group(root, [0.045, PY + 0.002, -0.54], [0, 0.5, 0]);
  const fishTail = group(fishPivot, [-0.025, 0, 0]);
  {
    // Fish body (round head toward +x, the eye a cut-out small hole) and fish tail (a separate piece that flicks)
    const body: [number, number][] = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * PI * 2;
      const x = Math.cos(a) * 0.042;
      const y = Math.sin(a) * 0.018 * (x > 0 ? 1 : 0.55 + 0.45 * (1 + x / 0.042));
      body.push([x + 0.012, y]);
    }
    add(fishPivot, flatInk(body, [oval(0.036, -0.004, 0.0045, 0.0045, 8)]), M.ink);
    add(fishTail, flatInk([[0.006, 0], [-0.03, 0.022], [-0.022, 0], [-0.03, -0.022]]), M.ink);
  }

  // ── Body: a light cat body, with feet that look freshly dipped in ink and a splash of ink on the back ──
  const body = group(root);
  const coat = (p: THREE.Vector3, n: THREE.Vector3) => {
    // The splash of ink on the back: running down toward the left belly, with a dark ink core and an outer ring of pale ink wash, and the edge made irregularly bleeding with a few sines
    const e = 0.1 + 0.02 * Math.sin(p.x * 55 + 1) + 0.015 * Math.sin(p.z * 80);
    const d = Math.hypot((p.x - 0.03) * 1.2, p.z + 0.08);
    const up = sstep(n.y, 0.05, 0.45);
    const wash = up * (1 - sstep(d, e, e + 0.05));
    const core = up * (1 - sstep(d, e - 0.05, e - 0.02));
    return cCoat.clone().lerp(cCoatShade, sstep(-n.y, 0.2, 0.8) * 0.6).lerp(cWash, wash * 0.8).lerp(cInk, core * 0.92);
  };
  const torsoPts = [v3(0, 0.37, -0.3), v3(0, 0.39, -0.16), v3(0, 0.38, 0.0), v3(0, 0.4, 0.14), v3(0, 0.44, 0.22)];
  add(body, paint(loft(torsoPts, curveTable([[0, 0, 0, 0], [0.06, 0.08, 0.09, 0], [0.2, 0.11, 0.12, 0], [0.45, 0.103, 0.115, -0.01], [0.7, 0.105, 0.125, -0.005], [0.88, 0.09, 0.11, 0], [1, 0, 0, 0]]), { segs: 36, radial: 20 }), coat), M.fur).userData.inkGroup = FUR;
  // Neck
  add(body, paint(loft([v3(0, 0.38, 0.1), v3(0, 0.47, 0.2), v3(0, 0.56, 0.26), v3(0, 0.6, 0.28)], curveTable([[0, 0.08, 0.09], [0.5, 0.072, 0.08], [0.9, 0.06, 0.065], [1, 0, 0]]), { segs: 14, radial: 16 }), (p, n) => cCoat.clone().lerp(cPad, sstep(n.z, 0.3, 0.8) * 0.5)), M.fur).userData.inkGroup = FUR;

  // Feet: ink bleeds upward from the paws (colored by distance from the paw)
  const legInk = (paw: THREE.Vector3) => (p: THREE.Vector3, n: THREE.Vector3) => coat(p, n).lerp(cWash, 1 - sstep(p.distanceTo(paw), 0.07, 0.15)).lerp(cInk, 1 - sstep(p.distanceTo(paw), 0.03, 0.08));
  const pawGeo = new THREE.SphereGeometry(1, 14, 10);
  const legs: { pts: THREE.Vector3[]; paw: THREE.Vector3; prof: (t: number) => number[]; rot?: THREE.Euler }[] = [
    { pts: [v3(0.07, 0.47, 0.14), v3(0.072, 0.4, 0.155), v3(0.078, 0.24, 0.17), v3(0.08, 0.1, 0.18), v3(0.08, 0.04, 0.19)], paw: v3(0.08, 0.03, 0.205), prof: curveTable([[0, 0, 0], [0.05, 0.042, 0.048], [0.14, 0.058, 0.064], [0.32, 0.046, 0.052], [0.55, 0.036, 0.04], [0.9, 0.03, 0.032], [1, 0.029, 0.029]]) },
    { pts: [v3(0.085, 0.47, -0.23), v3(0.09, 0.38, -0.2), v3(0.095, 0.27, -0.14), v3(0.093, 0.14, -0.25), v3(0.09, 0.04, -0.22)], paw: v3(0.09, 0.03, -0.2), prof: curveTable([[0, 0, 0], [0.05, 0.05, 0.06], [0.14, 0.07, 0.085], [0.35, 0.056, 0.064], [0.58, 0.036, 0.04], [0.9, 0.03, 0.032], [1, 0.029, 0.029]]) },
    { pts: [v3(-0.085, 0.47, -0.23), v3(-0.09, 0.38, -0.2), v3(-0.095, 0.27, -0.14), v3(-0.093, 0.14, -0.25), v3(-0.09, 0.04, -0.22)], paw: v3(-0.09, 0.03, -0.2), prof: curveTable([[0, 0, 0], [0.05, 0.05, 0.06], [0.14, 0.07, 0.085], [0.35, 0.056, 0.064], [0.58, 0.036, 0.04], [0.9, 0.03, 0.032], [1, 0.029, 0.029]]) },
  ];
  for (const L of legs) {
    add(body, paint(loft(L.pts, L.prof, { segs: 18, radial: 12, side: X }), legInk(L.paw)), M.fur).userData.inkGroup = FUR;
    add(body, paint(pawGeo.clone().scale(0.036, 0.024, 0.046), () => cInk), M.fur, [L.paw.x, L.paw.y, L.paw.z]).userData.inkGroup = FUR;
  }
  // The raised right front paw (-x): the pivot on the shoulder lets it flick ink; the paw curls back with the palm facing down and back
  const SH = v3(-0.07, 0.4, 0.15);
  const liftLeg = group(body, [SH.x, SH.y, SH.z]);
  const liftPaw = v3(-0.082, 0.165, 0.29);
  {
    const pts = [v3(-0.07, 0.47, 0.14), v3(-0.072, 0.4, 0.155), v3(-0.078, 0.29, 0.2), v3(-0.08, 0.21, 0.255), v3(-0.082, 0.18, 0.28)].map((p) => p.sub(SH));
    const pawL = liftPaw.clone().sub(SH);
    add(liftLeg, paint(loft(pts, curveTable([[0, 0, 0], [0.05, 0.042, 0.048], [0.14, 0.058, 0.064], [0.32, 0.046, 0.052], [0.55, 0.036, 0.04], [0.9, 0.03, 0.032], [1, 0.029, 0.029]]), { segs: 16, radial: 12, side: X }), legInk(pawL)), M.fur).userData.inkGroup = FUR;
    add(liftLeg, paint(pawGeo.clone().scale(0.036, 0.026, 0.044).rotateX(0.9), () => cInk), M.fur, [pawL.x, pawL.y, pawL.z]).userData.inkGroup = FUR;
  }

  // ── Tail: curved into a question mark, with a brush at the end: a red cord ties the root of the brush, and the ink-black belly of the bristles tapers to a pointed tip ──
  const TB = v3(0, 0.4, -0.29);
  const tail = group(body, [TB.x, TB.y, TB.z]);
  const tailPts = [v3(0, 0.4, -0.29), v3(0, 0.45, -0.38), v3(0.02, 0.6, -0.45), v3(0.04, 0.77, -0.41), v3(0.045, 0.85, -0.3), v3(0.035, 0.82, -0.2), v3(0.025, 0.74, -0.165), v3(0.02, 0.64, -0.16)].map((p) => p.sub(TB));
  const tailCurve = new THREE.CatmullRomCurve3(tailPts, false, 'centripetal');
  const BAND = 0.72;
  {
    const prof = curveTable([[0, 0.032, 0.032], [0.5, 0.027, 0.027], [0.7, 0.025, 0.025], [0.76, 0.032, 0.032], [0.84, 0.044, 0.044], [0.93, 0.028, 0.028], [0.97, 0.012, 0.012], [1, 0, 0]]);
    const samples = Array.from({ length: 101 }, (_, i) => tailCurve.getPointAt(i / 100));
    const tOf = (p: THREE.Vector3) => {
      let best = 0;
      let bd = 1e9;
      for (let i = 0; i < samples.length; i++) {
        const d = samples[i].distanceToSquared(p);
        if (d < bd) (bd = d), (best = i / 100);
      }
      return best;
    };
    add(tail, paint(loft(tailPts, prof, { segs: 60, radial: 14, side: X }), (p, n) => {
      const t = tOf(p);
      return cCoat.clone().lerp(cCoatShade, sstep(-n.y, 0.2, 0.8) * 0.5).lerp(cWash, sstep(t, 0.45, 0.66)).lerp(cInk, sstep(t, 0.62, 0.72));
    }), M.fur).userData.inkGroup = TAILI;
    // The red cord at the brush root: wrapped twice
    for (const dt of [-0.012, 0.012]) {
      const t = BAND + dt;
      const C = tailCurve.getPointAt(t);
      const T = tailCurve.getTangentAt(t);
      const W = new THREE.Vector3().crossVectors(T, Y).normalize();
      if (W.lengthSq() < 1e-6) W.copy(X);
      const H = new THREE.Vector3().crossVectors(W, T).normalize();
      const r = prof(t)[0];
      const P: THREE.Vector3[] = [];
      const N: THREE.Vector3[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * PI * 2;
        const n = W.clone().multiplyScalar(Math.cos(a)).addScaledVector(H, Math.sin(a));
        P.push(C.clone().addScaledVector(n, r * 0.97));
        N.push(n);
      }
      add(tail, paint(strap(P, N, 0.011, 0.008, true, 6), () => cRed), M.fur);
    }
  }

  // ── Head: a round head, big triangular ears, whisker pads and chin, and a small nose; the eyes are small and sunk in dark eye rings ──
  const HC = v3(0, 0.6, 0.29);
  const neck = group(body, [0, 0.52, 0.24]);
  const head = group(neck, [HC.x, HC.y - 0.52, HC.z - 0.24]);
  const SK = [0.14, 0.12, 0.125];
  // Cat head: the cheeks are wider than the top of the head, and the top of the head is slightly flat
  const deform = (p: THREE.Vector3) => {
    p.x *= 1 + 0.1 * Math.exp(-(((p.y + 0.035) / 0.055) ** 2));
    if (p.y > 0) p.y *= 0.94;
    return p;
  };
  // A splash of ink on the right side of the top of the head (-x), joining the ink tip of that ear; it does not touch the eyes
  const patchDir = v3(-0.7, 0.6, 0.3).normalize();
  const headCoat = (p: THREE.Vector3, n: THREE.Vector3) => {
    const q = v3(p.x / SK[0], p.y / SK[1], p.z / SK[2]).normalize();
    const ang = Math.acos(THREE.MathUtils.clamp(q.dot(patchDir), -1, 1));
    const e = 0.46 + 0.06 * Math.sin(p.y * 90) + 0.05 * Math.sin(p.z * 70 + 1);
    const wash = 1 - sstep(ang, e, e + 0.1);
    const core = 1 - sstep(ang, e - 0.12, e - 0.03);
    return cCoat.clone().lerp(cCoatShade, sstep(-n.y, 0.3, 0.9) * 0.5).lerp(cPad, sstep(n.z, 0.6, 0.95) * sstep(-p.y, 0.0, 0.06) * 0.6).lerp(cWash, wash * 0.85).lerp(cInk, core * 0.9);
  };
  {
    const g = new THREE.SphereGeometry(1, 28, 20).scale(SK[0], SK[1], SK[2]);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    const m = mergeVertices(g, 1e-6);
    const pa = m.attributes.position as THREE.BufferAttribute;
    const P = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) {
      deform(P.fromBufferAttribute(pa, i));
      pa.setXYZ(i, P.x, P.y, P.z);
    }
    m.computeVertexNormals();
    add(head, paint(m, headCoat), M.fur).userData.inkGroup = FUR;
  }
  for (const sx of [-1, 1]) add(head, paint(new THREE.SphereGeometry(1, 14, 10), () => cPad), M.fur, [sx * 0.03, -0.048, 0.1], [0, 0, 0], [0.035, 0.028, 0.03]).userData.inkGroup = FUR;
  add(head, paint(new THREE.SphereGeometry(1, 12, 8), () => cPad.clone().lerp(cCoatShade, 0.3)), M.fur, [0, -0.076, 0.082], [0, 0, 0], [0.025, 0.019, 0.022]).userData.inkGroup = FUR;
  {
    // Inverted-triangle nose, lying flat above the whisker pads
    const g = new THREE.ConeGeometry(0.017, 0.016, 3).rotateX(PI);
    g.scale(1, 1, 0.6);
    add(head, g, M.nose, [0, -0.022, 0.121], [-0.35, 0, 0]);
  }
  const ellip = (d: THREE.Vector3) => {
    const k = 1 / Math.sqrt((d.x / SK[0]) ** 2 + (d.y / SK[1]) ** 2 + (d.z / SK[2]) ** 2);
    const p = d.clone().multiplyScalar(k);
    const n = v3(p.x / SK[0] ** 2, p.y / SK[1] ** 2, p.z / SK[2] ** 2).normalize();
    return { p: deform(p), n };
  };
  // Ears: big triangular ears spread outward, with the ear tips bleeding ink and the inside pale pink
  const ears: { g: THREE.Group; sx: number }[] = [];
  for (const sx of [-1, 1]) {
    const s = ellip(v3(sx * 0.5, 0.8, 0.05));
    const eg = group(head, [s.p.x, s.p.y - 0.01, s.p.z]);
    const up = v3(sx * 0.42, 1, 0.08).normalize();
    const zz = Z.clone().addScaledVector(up, -Z.dot(up)).normalize();
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, zz), up, zz));
    const sw = group(eg);
    add(sw, paint(loft([v3(0, -0.02, 0), v3(0, 0.06, 0.002), v3(0, 0.125, -0.004)], curveTable([[0, 0.06, 0.024], [0.45, 0.046, 0.019], [0.85, 0.016, 0.008], [1, 0, 0]]), { segs: 12, radial: 12, side: X }), (p) => cCoat.clone().lerp(cWash, sstep(p.y, 0.05, 0.08)).lerp(cInk, sstep(p.y, 0.08, 0.1))), M.fur).userData.inkGroup = FUR;
    add(sw, paint(loft([v3(0, 0.0, 0.019), v3(0, 0.05, 0.018), v3(0, 0.09, 0.008)], curveTable([[0, 0.038, 0.009], [0.5, 0.028, 0.008], [1, 0, 0]]), { segs: 8, radial: 10, side: X }), () => cEarIn), M.fur);
    ears.push({ g: sw, sx });
  }
  // Eyes: diameter about 15% of the head width, enclosed by dark eye rings (upper and lower eyelids), dark cyan-green irises, vertical pupils and one small highlight; both eyes look at the same point
  const ER = 0.019;
  const glints: THREE.Object3D[] = [];
  const lids: { g: THREE.Group; open: number; shut: number }[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const eyeball = new THREE.SphereGeometry(ER, 14, 8, 0, PI * 2, 0, PI / 2).rotateX(PI / 2);
  const UP_OPEN = -0.78;
  const LO_OPEN = 0.62;
  const lidUp = paint(lidLite(ER + 0.0015, ER + 0.0055, PI / 2, true), () => cInk);
  const lidLow = paint(lidLite(ER + 0.0012, ER + 0.0045, PI / 2, false), () => cInk);
  const target = v3(0, 0.0, 1.2);
  for (const sx of [-1, 1]) {
    const s = ellip(v3(sx * 0.44, 0.2, 0.88));
    const d = s.n.clone().lerp(v3(sx * 0.3, 0.12, 1).normalize(), 0.5).normalize();
    const c = s.p.clone().addScaledVector(s.n, -ER * 0.55);
    const eg = group(head, [c.x, c.y, c.z]);
    const r = new THREE.Vector3().crossVectors(Y, d).normalize();
    const u = new THREE.Vector3().crossVectors(d, r);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, d));
    add(eg, eyeball, M.eye);
    const gl = target.clone().sub(c).normalize().applyQuaternion(eg.quaternion.clone().invert());
    const gaze = group(eg);
    gaze.quaternion.setFromUnitVectors(Z, gl);
    add(gaze, paint(lightDecal(ellipsePts(0.66, 0.62, 0, 20), ER + 0.0008), () => col(0x3d5226)), M.iris);
    add(gaze, paint(lightDecal(ellipsePts(0.13, 0.5, 0, 12), ER + 0.0016, 0, 1), () => col(0x0d0c0a)), M.iris);
    const hl = add(gaze, new THREE.SphereGeometry(0.0032, 8, 6), M.hi, [-sx * 0.0045, 0.006, ER * 0.97]);
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
    glints.push(hl);
    const upper = group(eg, [0, 0, 0], [UP_OPEN, 0, 0]);
    add(upper, lidUp, M.fur);
    lids.push({ g: upper, open: UP_OPEN, shut: LO_OPEN + 0.12 });
    const lower = group(head, [c.x, c.y, c.z]);
    lower.quaternion.copy(eg.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(X, PI + LO_OPEN));
    add(lower, lidLow, M.fur);
    eyeAnchors.push(group(eg, [0, 0, ER]));
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: the raised front paw flicking lightly, the brush on the tail slowly swinging, the head tilting to look around, the ears turning in turn, blinking, and the little ink fish on the paper flicking its tail ──
  const act = { swipe: 0 };
  const update = (t: number) => {
    const sw = act.swipe;
    const br = Math.sin(t * 1.8);
    body.scale.set(1 + br * 0.005, 1 + br * 0.005, 1);
    neck.rotation.y = 0.18 + Math.sin(t * 0.45) * 0.14;
    neck.rotation.x = Math.sin(t * 0.8) * 0.03;
    head.rotation.z = -0.1 + Math.sin(t * 0.55 + 1) * 0.06;
    const flick = (t % 3.1) < 0.5 ? Math.sin(((t % 3.1) / 0.5) * PI * 2) * 0.12 : 0;
    liftLeg.rotation.x = Math.sin(t * 1.1) * 0.03 + flick;
    tail.rotation.z = Math.sin(t * 0.9) * 0.12;
    tail.rotation.x = Math.sin(t * 0.7 + 0.5) * 0.05 - sw * 0.6;
    for (const e of ears) {
      const ph = (t + (e.sx > 0 ? 0 : 1.9)) % 4.2;
      const turn = ph < 1.1 ? Math.sin((ph / 1.1) * PI) : 0;
      e.g.rotation.y = e.sx * turn * 0.6;
    }
    const bt = t % 3.6;
    const bk = (x: number) => (x > 0 && x < 0.2 ? Math.min(1, Math.sin((x / 0.2) * PI) * 1.4) : 0);
    const close = bk(bt - 3.3);
    for (const l of lids) l.g.rotation.x = lerp(l.open, l.shut, close);
    for (const g of glints) g.visible = close < 0.6;
    fishTail.rotation.y = Math.sin(t * 5) * 0.35;
    fishPivot.rotation.y = 0.5 + Math.sin(t * 1.3) * 0.12;
  };
  update(0);

  const tipP = tailCurve.getPointAt(1);
  const rig = {
    head: group(head, [0, -0.01, SK[2]]),
    eyes: eyeAnchors,
    anchors: {
      mouth: group(head, [0, -0.06, 0.12]),
      brush: group(tail, [tipP.x, tipP.y, tipP.z]),
      paw: group(liftLeg, [liftPaw.x - SH.x, liftPaw.y - SH.y, liftPaw.z - SH.z]),
      fish: group(fishPivot),
      seal: group(sealG),
    },
  };
  mergeStatic(root, { owners: [body, neck, head, tail, liftLeg, fishPivot, fishTail, ...ears.map((e) => e.g), ...lids.map((l) => l.g)], keep: [...glints], rig });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.36, -0.06), radius: 0.66 };
}
