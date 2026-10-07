// Leaffrog, the Forest-Flute Frog King (model lab version): a frog king who sings through a flute rolled from a leaf; the forest folk tell the seasons by its song, and it is said that if it plays one wrong note, the flowers of the whole forest bloom three days late.
// Nature + water elements, positioned for echo and self-healing (trait "Morning Dew": shakes off one status condition at the end of the turn).
//
// Identifying features settled on:
// 1. A leaf-green frog body, a cream-yellow chin and belly, a paler yellow-green streak down each side: a frog at a glance, and the color of the forest.
// 2. Two big bulging golden eyes on top of the head, a wide smile line running all the way to below the eyes, a touch of red blush on the cheeks: the face is the highest-contrast place on the whole body.
// 3. The Forest Flute: a living bamboo flute growing out of the forest floor, the roots below gripping the ground, bamboo nodes, a row of finger holes, and at the top a leaf rolled into a trumpet (the leaf flute),
//    with new leaves and two small white flowers sprouting at the nodes. The frog king holds it in its left hand like the scepter of a bandmaster; the flute leans back at a slant, so the face can be seen from the side.
// 4. Lotus crown: a lotus leaf on top of the head (the notch facing back, the underside purple-red), a pink lotus blooming at the center of the leaf, and a drop of morning dew resting on the edge of the leaf (the water element and the trait).
// 5. A vine: growing from the middle of the back, going around the nape to become the collar of the cape, then following the left shoulder and left arm all the way to wind around the Forest Flute; the flute is grown together with it.
//
// Body shape: a frog's sitting pose. The rump sits on the ground, the body upright and leaning forward about twenty degrees, a big wide head sitting directly on the shoulders (a frog has no neck), the chin slightly lifted;
// the hind legs follow the frog's Z fold: the thigh going forward and outward from the side of the rump to the knee, the shin folding back below the knee, the foot lying flat forward from the ankle along the ground with five toes spread and webbing between them.
// The right hand (its own right, -x) rests on the right knee and the left hand holds the flute. The center of gravity is between the rump and the two feet.
// The body is one whole smooth distance field (rump, belly, chest, head, cheeks, muzzle, throat and eye mounds joined by a smooth union), with no neck seam; the limbs are lofted tubes.
// Face-count budget (N 25,000): the body mesh's vertices are concentrated toward the face; finger pads, toe pads, eyeliner and irises are all drawn with vertex colors on the same mesh, with no separate parts added.
//
// Personality: a punctual and slightly smug bandmaster of the forest. The whole forest waits for it to start singing before it blooms, so it always has its chest out, a smile on, eyes wide and bright, ready to play the next note;
// the idle fingers keep time on its knee.
// Gaze order: the face (big golden eyes, smile line, cream-yellow chin) first, the leaf trumpet at the top of the Forest Flute and the lotus crown second, and the cape, the webbed feet and the spots as support.
// Back: the vine grows from the middle of the back, with a cluster of small white flowers at its root (the moment it opens its throat, the first flowers bloom on its own back); the vine goes around into a collar,
// hanging a cape made of five leaves in the colors of the four seasons (spring tender green, summer deep green, autumn orange-yellow): the forest folk can tell from the leaf colors on its back which season it is singing now.
//
// <Action table> (battle actions and the ultimate follow this table):
// - Idle: breathing with the throat sac (the throat pulsing lightly), and every few seconds puffing up the throat sac and humming, the lower eyelids smiling along; the fingers of the right hand tap in turn on the knee, the right toes tap the ground; the eyes slowly look left and right.
// - Move: frog hops, the webbed feet touching down first on landing, the flute always held upright and not swaying.
// - Charge-up: the throat sac puffed to the maximum, the flute raised to the mouth.
// - Strike: plays the flute, the leaf trumpet facing forward, the sound wave (echo) leaving from the mouth of the trumpet; the body pushes forward.
// - Hit: curls the body up and squeezes the eyes shut for a moment, but the hand does not let go of the flute, and it sits upright again right away (Morning Dew: shaking off a status condition).
// - Victory: chest out, throat sac puffed, sings one long note, then taps the flute on the ground once.
// Action weight (act): sing (0-1, the throat sac puffs up and the lower eyelids smile).
// Named anchors: mouth (the mouth), throat (the front edge of the throat sac), pipe (center of the mouth of the leaf trumpet, where the sound wave of the flute leaves from), pipeGrip (the hand holding the flute),
// crown (center of the lotus), dew (the morning dew).
// Restrained light effects: no scattered glowing dots, no halo or musical notes; the only emissive left is a trace on the morning dew, from the material itself and not from bloom.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, mergeStatic, partKit, PI, rng, type LabModel, type V3 } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const UP = v(0, 1, 0);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const tv = (p: THREE.Vector3): V3 => [p.x, p.y, p.z];

// ───────────────────────── Distance-field body ─────────────────────────

interface Ell {
  c: THREE.Vector3;
  r: THREE.Vector3;
  inv: THREE.Quaternion;
  k: number;
}

/** A smooth union of a few rotated ellipsoids; f < 0 is inside. Used to grow a seamless frog body, and also to find points and normals on the surface */
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
  /** Walk outward from o inside the body along d to the surface */
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
  /** Find the surface from o along d: position and normal */
  hit(o: THREE.Vector3, d: THREE.Vector3): { p: THREE.Vector3; n: THREE.Vector3 } {
    const p = this.march(o, d.clone().normalize());
    return { p, n: this.grad(p) };
  }
}

/**
 * Wrap a distance field into a mesh: each vertex on a sphere is shot outward from center to the surface, the normals come from the distance field's gradient, and the color is decided by paint.
 * The face count is limited, so the vertex directions are first squeezed toward focus (the angle θ from focus becomes θ - pull·sin θ), and the mesh is denser on the face than on the rump.
 */
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

/** Grid surface: rows × cols points; the normals are computed after the vertices are merged */
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

/** Merge duplicate vertices (seams, closures) and then compute smooth normals */
function finish(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const m = mergeVertices(g, 1e-6);
  m.computeVertexNormals();
  return m;
}

/** Apply vertex colors to a mesh by position and normal (the material must enable vertexColors) */
function paintGeo(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    P.fromBufferAttribute(pa, i);
    N.fromBufferAttribute(na, i);
    const c = f(P, N);
    out.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

type Sec = (t: number, th: number, len: number) => [number, number];

/**
 * Loft along a curve: sec(t, θ) returns the [width direction, height direction] coordinates on the cross-section. The width direction uses a parallel-transport frame by default (an upright tube that curls back does not twist either),
 * and if side is given it is fixed toward it; the height direction = width × tangent, so the winding always faces outward (the same as loft in shapes.ts).
 * ts can specify the position of each row (denser near the bamboo nodes), and must be used together with side.
 */
function sweep(pts: THREE.Vector3[], sec: Sec, o: { segs?: number; radial?: number; side?: THREE.Vector3; ts?: number[]; paint?: (t: number, th: number) => THREE.Color } = {}): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const segs = o.ts ? o.ts.length - 1 : (o.segs ?? 32);
  const radial = o.radial ?? 16;
  const len = path.getLength();
  const fr = o.side ? null : path.computeFrenetFrames(segs, false);
  const C = new THREE.Vector3();
  const T = new THREE.Vector3();
  const W = new THREE.Vector3();
  const H = new THREE.Vector3();
  const g = gridGeo(segs + 1, radial + 1, (i, j) => {
    const t = o.ts ? o.ts[i] : i / segs;
    path.getPointAt(t, C);
    path.getTangentAt(t, T);
    if (o.side) W.copy(o.side).addScaledVector(T, -T.dot(o.side));
    else W.copy(fr!.normals[i]).addScaledVector(T, -T.dot(fr!.normals[i]));
    W.normalize();
    H.crossVectors(W, T).normalize();
    const th = ((j % radial) / radial) * PI * 2;
    const [x, y] = sec(t, th, len);
    return { p: C.clone().addScaledVector(W, x).addScaledVector(H, y), c: o.paint?.(t, th) };
  });
  return finish(g);
}

/** Round tube (or elliptical tube) cross-section, both ends closed into hemispheres: rad(t) returns a radius or [width radius, height radius] */
function roundSec(rad: (t: number) => number | [number, number], caps: [boolean, boolean] = [true, true]): Sec {
  const ab = (t: number): [number, number] => {
    const r = rad(t);
    return typeof r === 'number' ? [r, r] : r;
  };
  return (t, th, len) => {
    let [a, b] = ab(t);
    let k = 1;
    if (caps[0]) {
      const r0 = Math.max(...ab(0), 1e-4);
      const u = Math.min(1, (t * len) / r0);
      k *= Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
    }
    if (caps[1]) {
      const r1 = Math.max(...ab(1), 1e-4);
      const u = Math.min(1, ((1 - t) * len) / r1);
      k *= Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
    }
    a *= k;
    b *= k;
    return [Math.cos(th) * a, Math.sin(th) * b];
  };
}

/** The width of a leaf shape: the base rounded, the widest point at widest, the tip pointed */
const leafWidth = (t: number, widest: number) => Math.max(0, t < widest ? Math.sin((PI / 2) * (t / widest)) ** 0.7 : Math.cos((PI / 2) * ((t - widest) / (1 - widest))) ** 0.9);

/**
 * A flat leaf or petal: growing out along +y from the origin with the leaf face toward +z (when cup > 0 the two edges turn up toward +z, the concave face toward +z), and the end bending toward -z by bend.
 * rib is the height of the ridge along the midline of the front (the midrib; the outline draws a line at the crease). paint(t, lateral -1 to 1, front or not) applies the color.
 */
function bladeGeo(len: number, w: number, th: number, o: { cup?: number; bend?: number; widest?: number; rib?: number; segs?: number; radial?: number; paint: (t: number, x: number, top: boolean) => THREE.Color }): THREE.BufferGeometry {
  const bend = o.bend ?? 0.2;
  const cup = o.cup ?? 0.15;
  const widest = o.widest ?? 0.45;
  const rib = o.rib ?? 0;
  const pts = [0, 0.33, 0.66, 1].map((u) => v(0, len * u, -bend * len * u * u));
  return sweep(
    pts,
    (t, a) => {
      const kk = leafWidth(t, widest);
      const c = Math.cos(a);
      const s = Math.sin(a);
      const ridge = Math.abs(c) < 1e-3 && s > 0 ? rib * kk : 0;
      return [c * (w / 2) * kk, s * ((th / 2) * kk + 0.0006) + cup * (w / 2) * kk * c * c + ridge];
    },
    { segs: o.segs ?? 10, radial: o.radial ?? 8, side: X, paint: (t, a) => o.paint(t, Math.cos(a), Math.sin(a) >= 0) },
  );
}

/** Five-petaled small flower: the outline extruded into a thin sheet (no bevel, few faces) */
function flowerGeo(r: number, depth: number, petals = 5): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const N = petals * 5;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * PI * 2;
    const k = 0.4 + 0.6 * Math.pow(Math.abs(Math.cos((a * petals) / 2)), 0.55);
    if (i === 0) s.moveTo(Math.cos(a) * r * k, Math.sin(a) * r * k);
    else s.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

/**
 * Eyelid: a spherical shell with +y as the top, covering from the top to the lip angle, the edge a round lip; only the phiLen radians facing forward are made (the back is buried in the head).
 * Near the lip it is painted with vertex colors in the eyeliner color, with no separate eyeliner shell layered on.
 */
function lidGeo(ri: number, ro: number, lip: number, seg: number, phiLen: number, skin: THREE.Color, rim: THREE.Color): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  for (const u of [0, 0.5, 0.85, 1]) prof.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(u * lip)), ri * Math.cos(u * lip)));
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < 4; i++) {
    const b = (i / 4) * PI;
    const rad = c - Math.cos(b) * w;
    const tan = Math.sin(b) * w;
    prof.push(new THREE.Vector2(rad * Math.sin(lip) + tan * Math.cos(lip), rad * Math.cos(lip) - tan * Math.sin(lip)));
  }
  for (const u of [1, 0.95, 0.8, 0.45, 0]) prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(u * lip)), ro * Math.cos(u * lip)));
  const g = new THREE.LatheGeometry(prof, seg, -phiLen / 2, phiLen);
  g.deleteAttribute('uv');
  return paintGeo(g, (p) => skin.clone().lerp(rim, sstep(Math.atan2(Math.hypot(p.x, p.z), p.y), lip - 0.11, lip - 0.06)));
}

/**
 * Iris and pupil: concentric ellipses (longitude radius, latitude radius) laid onto a sphere of radius r centered on +z, one mesh with vertex colors by ring;
 * at each boundary two overlapping rings of vertices are placed so the color boundary is hard. rings go from inside to outside, and within a ring is that ring's color.
 */
function irisGeo(r: number, rings: [number, number, THREE.Color][], seg: number): THREE.BufferGeometry {
  const rows: [number, number, THREE.Color][] = [[0, 0, rings[0][2]], [rings[0][0] * 0.5, rings[0][1] * 0.5, rings[0][2]]];
  for (let k = 0; k < rings.length; k++) {
    rows.push([rings[k][0], rings[k][1], rings[k][2]]);
    if (k + 1 < rings.length) rows.push([rings[k][0], rings[k][1], rings[k + 1][2]]);
  }
  const g = gridGeo(rows.length, seg + 1, (i, j) => {
    const [rx, ry, c] = rows[i];
    const ph = (j / seg) * PI * 2;
    const lon = Math.cos(ph) * rx;
    const lat = Math.sin(ph) * ry;
    return { p: v(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).multiplyScalar(r), c };
  });
  const pa = g.attributes.position as THREE.BufferAttribute;
  const nor = new Float32Array(pa.count * 3);
  const n = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    n.fromBufferAttribute(pa, i).normalize();
    nor.set([n.x, n.y, n.z], i * 3);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

/** Align the group's +y to dirY and its +z to faceZ as far as possible */
function orient(g: THREE.Object3D, dirY: THREE.Vector3, faceZ: THREE.Vector3): void {
  const y = dirY.clone().normalize();
  const z = faceZ.clone().addScaledVector(y, -faceZ.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/**
 * Lotus leaf: a disc with a V-shaped notch (the notch at θ = 0, which is +z), thick in the middle and closing into a round lip at the edge, the whole leaf curling slightly up into a shallow dish.
 * The front is green with pale veins and the back is purple-red. The upper and lower faces are the same grid surface, joined at the edge.
 */
function padGeo(R: number, notch: number, th: number, dish: number, NR: number, NA: number, top: (r: number, a: number) => THREE.Color, bottom: THREE.Color): THREE.BufferGeometry {
  const a0 = notch / 2;
  const a1 = PI * 2 - notch / 2;
  const rw = th * 0.9;
  return finish(
    gridGeo(2 * NR + 1, NA + 1, (i, j) => {
      const isTop = i <= NR;
      const r = isTop ? (R * i) / NR : (R * (2 * NR - i)) / NR;
      const a = a0 + ((a1 - a0) * j) / NA;
      // The edge and the two sides of the notch close into round lips
      const dEdge = Math.min(R - r, Math.min(a - a0, a1 - a) * Math.max(r, 0.02));
      const e = dEdge >= rw ? 1 : Math.sqrt(Math.max(0, 1 - (1 - dEdge / rw) ** 2));
      const y = dish * (r / R) ** 2 * R + (isTop ? 1 : -1) * (th / 2) * e;
      return { p: v(Math.sin(a) * r, y, Math.cos(a) * r), c: isTop ? top(r / R, a) : bottom };
    }),
  );
}

// ───────────────────────── Shape ─────────────────────────

export function buildLeaffrogLab(): LabModel {
  const rand = rng(20261004);
  const RIMC = 0xe6ffc8;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const G = 0x4aa84e;
  const G2 = 0x86cc5c;
  const CREAM = 0xf8f2c6;
  const BELLY = 0xeee6a6;
  const DARK = 0x2b7238;
  const LINE = 0x26401e;
  const PADC = 0xc2e88e;
  const M = {
    skin: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC, spec: 0.3, specTh: 0.988 })),
    lid: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC, spec: 0.3, specTh: 0.988 })),
    sac: labToon(0xfbf4c8, { rim: 0.5, rimColor: 0xfffbe0, spec: 0.45, specTh: 0.985 }),
    web: labToon(0x8fcf62, { rim: 0.5, rimColor: RIMC }),
    spot: labToon(DARK, { rim: 0.5, rimColor: RIMC, spec: 0.3, specTh: 0.988 }),
    sclera: labToon(0xfdfcf2, { rim: 0.2, rimColor: RIMC }),
    iris: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    tymp: vc(labToon(0xffffff, { rim: 0.4, rimColor: RIMC })),
    line: labToon(LINE, { rim: 0 }),
    nostril: labToon(0x28461f, { rim: 0 }),
    wood: vc(labToon(0xffffff, { rim: 0.45, rimColor: 0xfff0d0, speckle: 0.12 })),
    root: labToon(0x6c5034, { rim: 0.4, speckle: 0.25 }),
    hole: labToon(0x24160c, { rim: 0 }),
    leaf: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    bell: vc(labToon(0xffffff, { rim: 0.5, rimColor: RIMC })),
    vine: labToon(0x3a8436, { rim: 0.5, rimColor: RIMC }),
    lily: vc(labToon(0xffffff, { rim: 0.5, rimColor: RIMC })),
    petal: vc(labToon(0xffffff, { rim: 0.5, rimColor: 0xffe4ee })),
    pod: labToon(0xdcd65c, { rim: 0.3 }),
    stamen: labToon(0xf6c448, { rim: 0.3 }),
    // Vertex-color versions (twins of mergeStatic): the nostrils and bamboo holes, and the lotus seedpod and stamens, are each merged into one mesh, for the mesh budget
    dark0: vc(labToon(0xffffff, { rim: 0 })),
    pollen: vc(labToon(0xffffff, { rim: 0.3 })),
    dew: labToon(0xc8f4ff, { ramp: 'gem', emissive: 0x3ab8e8, emissiveAmt: 0.35, spec: 1.4, specTh: 0.9, rim: 0.6, rimColor: 0xe8fcff }),
    blossom: labToon(0xfff4f2, { rim: 0.4, rimColor: 0xffe8ee }),
    blossomC: labToon(0xf2c24a, { rim: 0.2 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  const root = new THREE.Group();
  root.name = 'leaffrog-lab';
  const { add, group } = partKit();
  // The whole animal is moved by one group so the center of its bounding box lands on the origin (the lab bench turns about the origin)
  const model = group(root);

  // Outline part indices: within the same group lines are drawn only at normal creases
  const BODY = 9601;
  const LILY = 9603;

  // ── Coordinate frames of body and head ──
  // The body axis leans forward going up from the center of the rump, bV is the belly side; the head frame's origin is at the center of the head, the chin lifted by HP
  const TILT = 1.2;
  const bA = v(0, Math.sin(TILT), Math.cos(TILT));
  const bV = v(0, -Math.cos(TILT), Math.sin(TILT));
  const R0 = v(0, 0.2, -0.1);
  const qB = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, bA, bV));
  const bp = (s: number, d: number, x = 0) => R0.clone().addScaledVector(bA, s).addScaledVector(bV, d).addScaledVector(X, x);
  const HP = 0.1;
  const Hd = v(0, 0.83, 0.1);
  const hF = v(0, Math.sin(HP), Math.cos(HP));
  const hU = v(0, Math.cos(HP), -Math.sin(HP));
  const qH = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, hU, hF));
  const hp = (x: number, y: number, z: number) => Hd.clone().addScaledVector(X, x).addScaledVector(hU, y).addScaledVector(hF, z);
  const hd = (x: number, y: number, z: number) => v(0, 0, 0).addScaledVector(X, x).addScaledVector(hU, y).addScaledVector(hF, z).normalize();
  const toHead = (p: THREE.Vector3) => {
    const q = p.clone().sub(Hd);
    return v(q.x, q.dot(hU), q.dot(hF));
  };

  // ── Distance field: rump, belly, chest and shoulders, top of the head, two cheeks, muzzle, throat, eye mounds ──
  const blob = new Blob();
  blob.add(bp(0.02, -0.01), v(0.25, 0.19, 0.21), qB, 0.1);
  blob.add(bp(0.2, 0.03), v(0.265, 0.26, 0.24), qB, 0.1);
  blob.add(bp(0.42, -0.01), v(0.23, 0.18, 0.19), qB, 0.1);
  blob.add(hp(0, 0.02, -0.02), v(0.27, 0.16, 0.22), qH, 0.1);
  blob.add(hp(0, -0.06, 0.02), v(0.3, 0.12, 0.23), qH, 0.08);
  blob.add(hp(0, -0.01, 0.15), v(0.2, 0.11, 0.14), qH, 0.08);
  blob.add(hp(0, -0.13, -0.02), v(0.2, 0.1, 0.17), qH, 0.1);
  for (const sx of [-1, 1]) blob.add(hp(sx * 0.15, 0.1, 0.06), v(0.07, 0.07, 0.07), qH, 0.05);
  const CP = bp(0.46, 0.02);

  // ── Height of the mouth line: going around from the muzzle tip to both sides, the corners of the mouth rising all the way to the front and below the eyes; lowest in the middle from the front, a shallow U ──
  const PHI = 1.3;
  const mouthY = (phi: number) => {
    const u = clamp(phi / PHI, -1, 1);
    return -0.078 + 0.026 * u * u + 0.03 * u ** 8;
  };

  // Feature points on the surface (spots, blush)
  const bodyHit = (s: number, alpha: number, dd = 0) => {
    const dir = bV.clone().multiplyScalar(-Math.cos(alpha)).addScaledVector(X, Math.sin(alpha));
    return blob.hit(bp(s, dd), dir);
  };
  const blush = [-1, 1].map((sx) => blob.hit(hp(0, -0.03, 0), hd(sx * Math.sin(1.05), -0.08, Math.cos(1.05))).p);

  const cG = col(G);
  const cG2 = col(G2);
  const cC = col(CREAM);
  const cB = col(BELLY);
  const cP = col(0xf29a88);
  const cPad = col(PADC);
  const skinColor = (p: THREE.Vector3, n: THREE.Vector3) => {
    const h = toHead(p);
    const phi = Math.atan2(h.x, h.z);
    const ap = Math.abs(phi);
    const yb = ap <= PHI ? mouthY(phi) : mouthY(PHI) - 0.35 * (ap - PHI);
    const chin = sstep(yb - h.y, -0.004, 0.01);
    const belly = sstep(n.dot(bV), 0.14, 0.34);
    const kh = Math.hypot(h.x / 0.34, (h.y + 0.02) / 0.26, h.z / 0.33);
    const w = sstep(kh, 0.9, 1.1);
    const cream = chin * (1 - w) + belly * w;
    const flank = sstep(yb - h.y + 0.1, 0, 0.1) * (1 - w) + sstep(n.dot(bV), -0.25, 0.12) * w;
    const c = cG.clone().lerp(cG2, flank * 0.85);
    for (const bl of blush) c.lerp(cP, (1 - sstep(p.distanceTo(bl), 0.012, 0.055)) * 0.55);
    // The chin and throat are brightest, darkening slightly down toward the belly, so the gaze lands on the face first
    return c.lerp(cC.clone().lerp(cB, w * sstep(-h.y, 0.3, 0.55)), cream);
  };
  const limbColor = (p: THREE.Vector3, n: THREE.Vector3) => {
    const c = cG.clone().lerp(cG2, sstep(-n.y, -0.3, 0.2) * 0.85);
    return c.lerp(cC, sstep(-n.y, 0.35, 0.65));
  };

  const faceDir = hp(0, 0.02, 0.12).sub(CP);
  add(model, blobGeo(blob, CP, 18, faceDir, 0.38, skinColor), M.skin).userData.inkGroup = BODY;

  // ── Dark green spots on the back and rump: thin spherical caps following the surface curvature, the edges sunk into the skin, with the same outline index as the body (no ring of line drawn) ──
  const spotCap = (p: THREE.Vector3, n: THREE.Vector3, r: number, R: number) => {
    const g = group(model, tv(p.clone().addScaledVector(n, 0.0025 - R)));
    g.quaternion.setFromUnitVectors(UP, n);
    add(g, new THREE.SphereGeometry(R, 12, 2, 0, PI * 2, 0, r / R), M.spot).userData.inkGroup = BODY;
  };
  for (const [s, a, r] of [[0.06, 0.55, 0.05], [0.1, -0.7, 0.046], [0.0, 1.25, 0.042], [0.03, -1.35, 0.044], [0.2, 0.2, 0.04]] as [number, number, number][]) {
    const { p, n } = bodyHit(s, a);
    spotCap(p, n, r, 0.3);
  }

  // ── Mouth line ──
  const mouthPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 32; i++) {
    const phi = -PHI + (2 * PHI * i) / 32;
    const { p, n } = blob.hit(hp(0, mouthY(phi), 0), hd(Math.sin(phi), 0, Math.cos(phi)));
    mouthPts.push(p.addScaledVector(n, 0.002));
  }
  add(model, sweep(mouthPts, (t, a) => {
    const r = 0.0072 * Math.pow(Math.sin(PI * t), 0.3);
    return [Math.cos(a) * r, Math.sin(a) * r];
  }, { segs: 40, radial: 6 }), M.line);
  const mouthFront = mouthPts[16].clone();

  // ── Nostrils: two small dimples above the muzzle tip ──
  for (const sx of [-1, 1]) {
    const { p, n } = blob.hit(hp(0, 0.02, 0.05), hd(sx * 0.12, 0.2, 1));
    const g = group(model, tv(p));
    g.quaternion.setFromUnitVectors(UP, n);
    add(g, new THREE.SphereGeometry(1, 8, 5), M.nostril, [0, -0.002, 0], [0, sx * 0.5, 0], [0.011, 0.005, 0.007]);
  }
  // ── Tympanum: a slightly raised round disc behind the eye, dark in the middle with a pale ring at the outer edge ──
  const cT = col(0x3a7a36);
  const cTr = col(0x9ad070);
  for (const sx of [-1, 1]) {
    const { p, n } = blob.hit(hp(0, 0.0, 0), hd(sx * Math.sin(1.95), 0.1, Math.cos(1.95)));
    const g = group(model, tv(p.addScaledVector(n, -0.004)));
    g.quaternion.setFromUnitVectors(UP, n);
    const disc = lathe([[0.046, -0.004], [0.043, 0.003], [0.036, 0.0065], [0.02, 0.0075], [0.001, 0.0078]], 16);
    add(g, paintGeo(disc, (q) => cT.clone().lerp(cTr, sstep(Math.hypot(q.x, q.z), 0.033, 0.04) * 0.8)), M.tymp).userData.inkGroup = BODY;
  }

  // ── Throat sac: a pale sac under the chin, pulsing lightly when breathing and swelling when singing ──
  const th0 = blob.hit(hp(0, -0.08, 0.05), hd(0, -0.8, 0.62));
  const sacG = group(model, tv(th0.p.clone().addScaledVector(th0.n, -0.055)));
  orient(sacG, th0.n.clone().cross(X), th0.n);
  const sac = add(sacG, new THREE.SphereGeometry(1, 16, 10), M.sac, [0, 0, 0], [0, 0, 0], [0.13, 0.085, 0.085]);
  sac.userData.inkGroup = BODY;

  // ── Eyes: big bulging eyes on the two sides of the top of the head, a golden iris and a big horizontal pupil; the upper and lower eyelids are shells in the body color (a line of eyeliner at the lip), the lower eyelid raised slightly into smiling eyes ──
  const ER = 0.082;
  const UP_OPEN = 0.95;
  const LO_OPEN = 0.46;
  const lidUp = lidGeo(ER + 0.004, ER + 0.014, PI / 2, 18, 5.4, cG, col(LINE));
  const lidLow = lidGeo(ER + 0.004, ER + 0.011, PI / 2, 16, 4.6, cG, col(LINE));
  // A frog's eye is almost entirely iris, with only a thin rim of sclera left: so that seen from three-quarters it does not look like a sidelong glance
  const irisG = irisGeo(ER + 0.001, [[0.45, 0.33, col(0x1c1810)], [0.55, 0.47, col(0xffd978)], [0.75, 0.75, col(0xf2b43a)], [0.83, 0.83, col(0x7a4812)]], 22);
  const eyes: { upper: THREE.Group; lower: THREE.Group; gaze: THREE.Group; glints: THREE.Object3D[]; sx: number }[] = [];
  const eyeAnchors: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const E = hp(sx * 0.152, 0.13, 0.075);
    const f = hd(sx * 0.45, 0.22, 0.87);
    const r = new THREE.Vector3().crossVectors(hU, f).normalize();
    const u = new THREE.Vector3().crossVectors(f, r);
    const eg = group(model, tv(E));
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f));
    eyeAnchors.push(group(eg, [0, 0, ER]));
    const roll = group(eg, [0, 0, 0], [0, 0, sx * 0.1]);
    add(roll, new THREE.SphereGeometry(ER, 16, 10), M.sclera);
    const gaze = group(roll, [0, 0, 0], [0.06, -sx * 0.26, 0]);
    add(gaze, irisG, M.iris);
    const glints: THREE.Object3D[] = [];
    for (const [x, y, rr] of [[0.3, 0.3, 0.02], [-0.26, -0.26, 0.009]] as [number, number, number][]) {
      const hl = add(gaze, new THREE.SphereGeometry(rr, 8, 5), M.hi, [x * ER, y * ER, ER * 0.96]);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    const upper = group(roll, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.lid).userData.inkGroup = BODY;
    const lower = group(roll, [0, 0, 0], [PI + LO_OPEN, 0, 0]);
    add(lower, lidLow, M.lid).userData.inkGroup = BODY;
    eyes.push({ upper, lower, gaze, glints, sx });
  }

  // ── Hind legs: the thigh going forward and outward, the knee in front of the side of the body; the shin folding back below the knee; the foot lying flat forward from the ankle along the ground, five toes spread and webbing between them ──
  const skinPart = (g: THREE.BufferGeometry, parent: THREE.Object3D = model) => {
    const m = add(parent, paintGeo(g, limbColor), M.skin);
    m.userData.inkGroup = BODY;
    return m;
  };
  /** Fingers and toes: the ends swell into round pads, the pads painted pale with vertex colors (the same mesh, no separate part added) */
  const digit = (parent: THREE.Object3D, pts: THREE.Vector3[], r: number, pad: number) => {
    const rad = (t: number) => lerp(r, r * 0.8, t) + (pad - r * 0.8) * Math.exp(-(((t - 0.86) / 0.1) ** 2));
    const g = sweep(pts, roundSec(rad), { segs: 7, radial: 6 });
    const tipAt = pts[pts.length - 1];
    const L = new THREE.CatmullRomCurve3(pts, false, 'centripetal').getLength();
    const m = add(parent, paintGeo(g, (p, n) => limbColor(p, n).lerp(cPad, sstep(L - p.distanceTo(tipAt), L - 2.4 * pad, L - 1.6 * pad) * 0.9)), M.skin);
    m.userData.inkGroup = BODY;
    return m;
  };
  const knees: { c: THREE.Vector3; r: number }[] = [];
  const toeGroups: THREE.Group[] = [];
  const thighR = curveTable([[0, 0.1], [0.3, 0.112], [0.7, 0.088], [1, 0.07]]);
  for (const sx of [-1, 1]) {
    const Ph = v(sx * 0.14, 0.19, -0.1);
    const Pk = v(sx * 0.35, 0.3, 0.17);
    const thighPts = [Ph, v(sx * 0.285, 0.29, 0.02), Pk];
    skinPart(sweep(thighPts, roundSec((t) => thighR(t)[0]), { segs: 16, radial: 12 }));
    // Two spots on top of the thigh
    {
      const tp = new THREE.CatmullRomCurve3(thighPts, false, 'centripetal');
      for (const [t, tilt, r] of [[0.42, 0.2, 0.034], [0.7, -0.35, 0.028]] as [number, number, number][]) {
        const T = tp.getTangentAt(t);
        const n = UP.clone().addScaledVector(T, -T.y).normalize().applyAxisAngle(T, tilt * sx);
        spotCap(tp.getPointAt(t).addScaledVector(n, thighR(t)[0] * 0.97), n, r, 0.13);
      }
    }
    const tEnd = new THREE.CatmullRomCurve3(thighPts, false, 'centripetal').getTangentAt(1);
    const Ks = Pk.clone().addScaledVector(tEnd, -0.07);
    knees.push({ c: Ks, r: 0.07 });
    const Pa = v(sx * 0.365, 0.052, -0.02);
    skinPart(sweep([Ks.clone().add(v(sx * 0.01, -0.025, -0.01)), v(sx * 0.378, 0.16, 0.04), Pa], roundSec((t) => lerp(0.064, 0.048, t)), { segs: 12, radial: 10 }));
    const Tb = v(sx * 0.395, 0.026, 0.205);
    const footMid = v(sx * 0.38, 0.034, 0.09);
    skinPart(sweep([Pa, footMid, Tb], roundSec((t) => [lerp(0.021, 0.017, t), lerp(0.032, 0.042, t)]), { segs: 10, radial: 10, side: UP }));
    // Toes: a group pivoting at the toe root (the whole sheet lifts when tapping the ground), with z toward the front of the foot
    const fd = Tb.clone().sub(footMid).setY(0).normalize();
    const tg = group(model, tv(Tb));
    orient(tg, UP, fd);
    toeGroups.push(tg);
    // The group's +x is y × z = UP × fd; the outer side is the sx side
    const lx = new THREE.Vector3().crossVectors(UP, fd).x * sx > 0 ? 1 : -1;
    const toeSpec: [number, number][] = [[-0.52, 0.06], [-0.25, 0.08], [0.02, 0.098], [0.28, 0.115], [0.54, 0.088]];
    const tips: THREE.Vector3[] = [];
    for (const [a0, len] of toeSpec) {
      const a = a0 * lx;
      const d = v(Math.sin(a), 0, Math.cos(a));
      digit(tg, [d.clone().multiplyScalar(0.01), d.clone().multiplyScalar(len * 0.45).setY(0.004), d.clone().multiplyScalar(len).setY(-0.012)], 0.015, 0.02);
      tips.push(d.clone().multiplyScalar(len * 0.62));
    }
    // Webbing: a thin membrane between toes, the outer edge dished inward between two toes
    const order = tips.map((_, i) => i).sort((i, j) => tips[i].x - tips[j].x);
    const web = new THREE.Shape();
    web.moveTo(tips[order[0]].x * 0.2, tips[order[0]].z * 0.2);
    for (let k = 0; k < order.length; k++) {
      const tp = tips[order[k]];
      web.lineTo(tp.x, tp.z);
      if (k < order.length - 1) {
        const tn = tips[order[k + 1]];
        const mid = tp.clone().add(tn).multiplyScalar(0.5 * 0.72);
        web.quadraticCurveTo(mid.x, mid.z, tn.x, tn.z);
      }
    }
    web.lineTo(tips[order[order.length - 1]].x * 0.2, tips[order[order.length - 1]].z * 0.2);
    web.lineTo(0, -0.02);
    web.closePath();
    const wg = new THREE.ExtrudeGeometry(web, { depth: 0.006, bevelEnabled: false, curveSegments: 4 });
    wg.rotateX(PI / 2);
    add(tg, wg, M.web, [0, -0.011, 0]).userData.inkGroup = BODY + 5;
  }

  // ── Forelimbs: the right hand rests on the right knee, four fingers hanging over the kneecap; the left hand holds the Forest Flute ──
  const armR = (t: number) => lerp(0.045, 0.034, t);
  const fingerR = 0.0135;
  // The right hand (-x) rests on the right knee; the fingers pivot at the finger roots and lift up when tapping out the beat
  const kneeFingers: { g: THREE.Group; axis: THREE.Vector3 }[] = [];
  {
    const K = knees[0];
    const S = v(-0.19, 0.6, 0.08);
    const Pe = v(-0.35, 0.47, -0.07);
    const palm = K.c.clone().addScaledVector(UP, K.r + 0.012).add(v(0.005, 0, -0.012));
    const Pw = palm.clone().add(v(0.0, 0.016, -0.04));
    skinPart(sweep([S, v(-0.29, 0.55, 0.01), Pe], roundSec(armR), { segs: 12, radial: 10 }));
    skinPart(sweep([Pe.clone().add(v(0, 0.01, 0.01)), v(-0.345, 0.44, 0.0), Pw], roundSec((t) => lerp(0.04, 0.03, t)), { segs: 10, radial: 10 }));
    skinPart(new THREE.SphereGeometry(1, 10, 6).scale(0.036, 0.016, 0.042).translate(palm.x, palm.y, palm.z));
    for (let k = 0; k < 4; k++) {
      const spread = (k - 1.5) * 0.3;
      const fdir = v(Math.sin(spread) * 0.9 - 0.1, 0, Math.cos(spread)).normalize();
      const on = (b: number) => K.c.clone().add(UP.clone().multiplyScalar(Math.cos(b)).addScaledVector(fdir, Math.sin(b)).multiplyScalar(K.r + fingerR * 0.9));
      const P0 = on(0.25);
      const fg = group(model, tv(P0));
      kneeFingers.push({ g: fg, axis: new THREE.Vector3().crossVectors(fdir, UP).normalize() });
      digit(fg, [0.25, 0.6, 0.95, 1.28].map((b) => on(b).sub(P0)), fingerR, 0.019);
    }
  }

  // ── Forest Flute: a living bamboo flute growing out of the forest floor, leaning back at a slant. The roots grip the ground, bamboo nodes, a row of finger holes, and at the top a leaf rolled into a trumpet, with new leaves and small white flowers growing at the nodes ──
  const staffPts = [v(0.59, -0.02, 0.29), v(0.59, 0.38, 0.19), v(0.595, 0.76, 0.095), v(0.6, 1.08, 0.015)];
  const staffPath = new THREE.CatmullRomCurve3(staffPts, false, 'centripetal');
  const staffY = (y: number) => clamp((y - staffPts[0].y) / (staffPts[3].y - staffPts[0].y), 0, 1);
  const NODES = [0.16, 0.34, 0.76, 0.96];
  const RS = 0.03;
  const staffR = (t: number) => {
    const y = staffPts[0].y + t * (staffPts[3].y - staffPts[0].y);
    let r = RS + 0.006 * (1 - t) + 0.01 * Math.exp(-(((y + 0.02) / 0.05) ** 2));
    for (const n of NODES) r += 0.0055 * Math.exp(-(((y - n) / 0.011) ** 2));
    return r;
  };
  // Loft rows: 24 on average, with 4 more on each side near the bamboo nodes, so the swelling of the nodes can be drawn
  const staffTs = new Set<number>();
  for (let i = 0; i <= 24; i++) staffTs.add(i / 24);
  for (const n of NODES) for (const d of [-0.016, -0.007, 0, 0.007, 0.016]) staffTs.add(clamp(staffY(n + d), 0, 1));
  const cWood = col(0xa27a48);
  const cWoodD = col(0x6e4c2a);
  const cWoodL = col(0xc49a62);
  add(
    model,
    sweep(staffPts, (t, a, len) => {
      const r = staffR(t) * Math.sqrt(Math.max(0, 1 - Math.max(0, 1 - ((1 - t) * len) / 0.02) ** 2));
      return [Math.cos(a) * r, Math.sin(a) * r];
    }, {
      ts: [...staffTs].sort((a, b) => a - b),
      radial: 9,
      side: v(0, 0, 1),
      paint: (t, a) => {
        const y = staffPts[0].y + t * (staffPts[3].y - staffPts[0].y);
        let node = 0;
        for (const n of NODES) node = Math.max(node, Math.exp(-(((y - n) / 0.009) ** 2)));
        return cWood.clone().lerp(cWoodL, (0.5 + 0.5 * Math.sin(a * 3 + 1)) * 0.25).lerp(cWoodD, node * 0.75 + (1 - sstep(y, 0.0, 0.12)) * 0.35);
      },
    }),
    M.wood,
  );
  // Roots: gripping outward into the ground from the bottom of the flute
  for (let k = 0; k < 5; k++) {
    const a = k * 1.3 + 0.4 + (rand() - 0.5) * 0.3;
    const d = v(Math.sin(a), 0, Math.cos(a));
    const B = staffPts[0].clone().setY(0.07);
    const len = 0.1 + rand() * 0.05;
    add(model, sweep([B, B.clone().addScaledVector(d, len * 0.4).setY(0.03), B.clone().addScaledVector(d, len).setY(-0.012)], roundSec((t) => lerp(0.017, 0.004, t), [true, false]), { segs: 7, radial: 6 }), M.root);
  }
  // Finger holes: a row above the grip, facing forward
  const holeGeo = new THREE.CylinderGeometry(0.0095, 0.0095, 0.006, 10, 1).rotateX(PI / 2);
  for (const y of [0.66, 0.73, 0.8, 0.87]) {
    const t = staffY(y);
    const C = staffPath.getPointAt(t);
    const T = staffPath.getTangentAt(t);
    const n = v(-0.25, 0, 1).addScaledVector(T, -v(-0.25, 0, 1).dot(T)).normalize();
    const g = group(model, tv(C.clone().addScaledVector(n, staffR(t) - 0.001)));
    orient(g, T, n);
    add(g, holeGeo, M.hole);
  }
  // Leaf trumpet: a leaf rolled into a trumpet at the top, darker on the inside, with a leaf edge spiraling up the outside at a slant, and the leaf tip flipped out over the mouth of the trumpet
  const topT = staffPath.getTangentAt(1);
  const bellG = group(model, tv(staffPts[3].clone().addScaledVector(topT, -0.02)));
  bellG.quaternion.setFromUnitVectors(UP, topT);
  const bellOut: [number, number][] = [[0.035, -0.06], [0.036, 0.0], [0.042, 0.05], [0.058, 0.1], [0.086, 0.142], [0.106, 0.163]];
  const bellProf: [number, number][] = [...bellOut, [0.111, 0.169], [0.105, 0.175], [0.094, 0.166], [0.07, 0.14], [0.045, 0.095], [0.03, 0.05], [0.02, 0.01], [0.001, 0.0]];
  const cBellO = col(0x9fd456);
  const cBellI = col(0x3f7e2e);
  const cBellR = col(0xcfe98a);
  add(bellG, paintGeo(lathe(bellProf, 20), (p, n) => {
    const rad = v(p.x, 0, p.z).normalize();
    const inner = sstep(-n.dot(rad), -0.1, 0.2);
    return cBellO.clone().lerp(cBellR, sstep(p.y, 0.13, 0.168)).lerp(cBellI, inner);
  }), M.bell);
  const rOut = (y: number) => {
    for (let i = 0; i < bellOut.length - 1; i++) {
      const [r0, y0] = bellOut[i];
      const [r1, y1] = bellOut[i + 1];
      if (y <= y1) return lerp(r0, r1, clamp((y - y0) / (y1 - y0), 0, 1));
    }
    return bellOut[bellOut.length - 1][0];
  };
  {
    const pts: THREE.Vector3[] = [];
    const A0 = 2.4;
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const y = -0.02 + u * 0.185;
      const a = A0 + u * PI * 1.7;
      const r = rOut(Math.min(y, 0.163)) + 0.0025;
      pts.push(v(Math.sin(a) * r, y, Math.cos(a) * r));
    }
    add(bellG, paintGeo(sweep(pts, roundSec((t) => lerp(0.004, 0.0055, t), [true, false]), { segs: 18, radial: 5 }), () => cBellO.clone().lerp(cBellR, 0.35)), M.bell);
    // Leaf tip: flipped out over the mouth of the trumpet from the end of the leaf edge, curling outward and down
    const aEnd = A0 + PI * 1.7;
    const tipG = group(bellG, [Math.sin(aEnd) * 0.105, 0.162, Math.cos(aEnd) * 0.105]);
    orient(tipG, v(Math.sin(aEnd) * 0.7, 0.7, Math.cos(aEnd) * 0.7), v(-Math.sin(aEnd), 0.3, -Math.cos(aEnd)));
    add(tipG, bladeGeo(0.07, 0.05, 0.006, { cup: 0.12, bend: -0.5, widest: 0.25, segs: 8, radial: 6, paint: (t) => cBellO.clone().lerp(cBellR, 0.3 + 0.4 * t) }), M.bell);
  }
  // New leaves and small white flowers at the nodes
  const cLeaf = col(0x5cb24c);
  const cLeafL = col(0x9fd86a);
  const cLeafD = col(0x3a7e36);
  const leafPaint = (base: THREE.Color, tipC: THREE.Color) => (t: number, x: number, top: boolean) =>
    base.clone().lerp(tipC, sstep(t, 0.3, 1) * 0.5).lerp(cLeafL, (1 - sstep(Math.abs(x), 0.04, 0.5)) * (top ? 0.35 : 0.1)).multiplyScalar(top ? 1 : 0.85);
  const staffLeaves: THREE.Group[] = [];
  const leafOn = (parent: THREE.Object3D, at: THREE.Vector3, dir: THREE.Vector3, face: THREE.Vector3, len: number, w: number, base = cLeaf, tipC = cLeafL) => {
    const g = group(parent, tv(at));
    orient(g, dir, face);
    add(g, bladeGeo(len, w, 0.008, { cup: 0.18, bend: 0.22, rib: 0.003, paint: leafPaint(base, tipC) }), M.leaf);
    return g;
  };
  const blossom = (parent: THREE.Object3D, s: number) => {
    add(parent, flowerGeo(0.028 * s, 0.005), M.blossom, [0, 0, 0], [0, 0, rand() * 2]);
    add(parent, new THREE.SphereGeometry(0.008 * s, 6, 4), M.blossomC, [0, 0, 0.004]);
  };
  const stemGeo = sweep([v(0, -0.01, 0), v(0, 0.012, 0.002), v(0, 0.03, 0)], roundSec(() => 0.0045), { segs: 5, radial: 5 });
  {
    const t = staffY(0.96);
    const C = staffPath.getPointAt(t);
    for (const [a, len, w] of [[0.5, 0.15, 0.07], [2.6, 0.13, 0.062], [4.4, 0.14, 0.066]] as [number, number, number][]) {
      const rd = v(Math.sin(a), 0, Math.cos(a));
      staffLeaves.push(leafOn(model, C.clone().addScaledVector(rd, staffR(t) * 0.6), rd.clone().multiplyScalar(0.85).add(v(0, 0.55, 0)), UP.clone().addScaledVector(rd, -0.4), len, w));
    }
    for (const [y, a] of [[1.03, 1.3], [0.99, 3.6]] as [number, number][]) {
      const tt = staffY(y);
      const Cc = staffPath.getPointAt(tt);
      const rd = v(Math.sin(a), 0, Math.cos(a));
      const g = group(model, tv(Cc.clone().addScaledVector(rd, staffR(tt) + 0.008)));
      orient(g, rd.clone().add(v(0, 0.6, 0)), rd);
      add(g, stemGeo, M.vine);
      const fl = group(g, [0, 0.03, 0]);
      orient(fl, UP, v(0, 0.3, 1));
      blossom(fl, 1);
    }
  }

  // The left hand (+x) holds the flute: the palm against the inner side of the flute, four fingers wrapping around from the front
  const gripY = 0.56;
  const armLPts = [v(0.19, 0.6, 0.08), v(0.3, 0.52, 0.02), v(0.37, 0.43, -0.03)];
  let foreLPts: THREE.Vector3[] = [];
  {
    const gt = staffY(gripY);
    const Cg = staffPath.getPointAt(gt);
    const a = staffPath.getTangentAt(gt);
    const e1 = v(-1, 0, 0).addScaledVector(a, a.x).normalize();
    const e2 = new THREE.Vector3().crossVectors(a, e1).normalize();
    const rs = staffR(gt);
    const palm = Cg.clone().addScaledVector(e1, rs + 0.02);
    const Pw = palm.clone().addScaledVector(e1, 0.015).addScaledVector(a, -0.02).add(v(0, 0, -0.025));
    foreLPts = [armLPts[2].clone().add(v(0, 0.01, 0.01)), v(0.45, 0.46, 0.06), Pw];
    skinPart(sweep(armLPts, roundSec(armR), { segs: 12, radial: 10 }));
    skinPart(sweep(foreLPts, roundSec((t) => lerp(0.04, 0.03, t)), { segs: 12, radial: 10 }));
    const pm = skinPart(new THREE.SphereGeometry(1, 10, 6).scale(0.018, 0.044, 0.034));
    pm.position.copy(palm);
    orient(pm, a, e2);
    for (let k = 0; k < 4; k++) {
      const h = (1.5 - k) * 0.024;
      const pts: THREE.Vector3[] = [];
      for (const psi of [0.2, 0.9, 1.6, 2.3, 2.8]) pts.push(Cg.clone().addScaledVector(a, h).addScaledVector(e1, Math.cos(psi) * (rs + fingerR * 0.95)).addScaledVector(e2, Math.sin(psi) * (rs + fingerR * 0.95)));
      digit(model, pts, fingerR, 0.018);
    }
  }

  // ── Lotus crown: a lotus leaf on the top of the head (the notch facing back, the underside purple-red), a pink lotus blooming at the center of the leaf, and a drop of morning dew resting on the edge of the leaf ──
  const crownG = group(model, tv(hp(0, 0.18, -0.085)));
  orient(crownG, hU.clone().addScaledVector(hF, 0.14), hF);
  const cLily = col(0x3e8e46);
  const cLilyV = col(0x78c060);
  const cLilyE = col(0x5aa850);
  const LR = 0.13;
  add(crownG, padGeo(LR, 0.4, 0.012, 0.12, 6, 32, (r, a) => {
    const u = ((a - 0.2) / (PI * 2 - 0.4)) * 10;
    const vein = 1 - sstep(Math.abs(u - Math.round(u)), 0.08, 0.2);
    return cLily.clone().lerp(cLilyE, sstep(r, 0.75, 1) * 0.6).lerp(cLilyV, vein * sstep(r, 0.12, 0.3) * (1 - sstep(r, 0.8, 0.97)) * 0.7);
  }, col(0x864058)), M.lily, [0, 0, 0], [0, PI, 0]).userData.inkGroup = LILY;
  // Lotus: the outer ring of seven petals open widest, the middle ring five, the inner ring three half closed; in the middle a yellow seedpod and a ring of stamens
  const cPetB = col(0xfff3ee);
  const cPetT = col(0xf27ca8);
  const petalPaint = (t: number, x: number, top: boolean) => cPetB.clone().lerp(cPetT, sstep(t + Math.abs(x) * 0.15, 0.3, 0.95)).multiplyScalar(top ? 1 : 0.92);
  const lotus = group(crownG, [0, 0.022, 0]);
  lotus.scale.setScalar(1.3);
  const petalRing = (n: number, r: number, elev: number, len: number, w: number, phase: number, cup: number) => {
    const geo = bladeGeo(len, w, 0.007, { cup, bend: -0.12, widest: 0.55, segs: 7, radial: 6, paint: petalPaint });
    for (let i = 0; i < n; i++) {
      const a = phase + (i / n) * PI * 2;
      const o = v(Math.sin(a), 0, Math.cos(a));
      const g = group(lotus, tv(o.clone().multiplyScalar(r)));
      orient(g, o.clone().multiplyScalar(Math.sin(elev)).addScaledVector(UP, Math.cos(elev)), o.clone().multiplyScalar(-Math.cos(elev)).addScaledVector(UP, Math.sin(elev)));
      add(g, geo, M.petal);
    }
  };
  petalRing(7, 0.03, 1.0, 0.125, 0.076, 0.2, 0.28);
  petalRing(5, 0.022, 0.6, 0.108, 0.068, 0.55, 0.32);
  petalRing(3, 0.012, 0.28, 0.088, 0.058, 1.1, 0.38);
  add(lotus, lathe([[0.012, 0.0], [0.026, 0.006], [0.03, 0.03], [0.026, 0.036], [0.001, 0.037]], 12), M.pod, [0, 0.01, 0]);
  add(lotus, new THREE.TorusGeometry(0.031, 0.006, 5, 16), M.stamen, [0, 0.022, 0], [PI / 2, 0, 0]);
  // Morning dew: a water drop on the front right edge of the lotus leaf
  const dewA = 0.95;
  const dewR = LR * 0.72;
  const dewG = group(crownG, [Math.sin(dewA) * dewR, 0.12 * (dewR / LR) ** 2 * LR + 0.006, Math.cos(dewA) * dewR]);
  add(dewG, lathe([[0.001, 0], [0.016, 0.002], [0.021, 0.01], [0.018, 0.02], [0.009, 0.026], [0.001, 0.027]], 10), M.dew);
  const dewHi = add(dewG, new THREE.SphereGeometry(0.0045, 6, 4), M.hi, [-0.006, 0.02, 0.008]);
  dewHi.layers.disable(INK_LAYER);

  // ── Vine: growing from the middle of the back, going around the nape to become the collar of the cape, the right end closing into a thin point in front of the right shoulder; the left end following the left shoulder and left arm all the way to wind around the Forest Flute ──
  const S_C = 0.55;
  const collarS = (alpha: number) => S_C - 0.06 * sstep(Math.abs(alpha), 0.8, 2.0);
  const VR = 0.014;
  const vinePts: THREE.Vector3[] = [];
  for (let a = -2.25; a <= 1.56; a += 0.19) {
    const { p, n } = bodyHit(collarS(a), a);
    vinePts.push(p.addScaledVector(n, VR * 0.7));
  }
  /** A spiral along the surface of a tube */
  const helix = (pts: THREE.Vector3[], t0: number, t1: number, turns: number, ph: number, rad: (t: number) => number, n: number) => {
    const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const fr = path.computeFrenetFrames(n, false);
    const out: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const t = lerp(t0, t1, u);
      const k = Math.round(t * n);
      const C = path.getPointAt(t);
      const a = ph + turns * PI * 2 * u;
      out.push(C.addScaledVector(fr.normals[k], Math.cos(a) * rad(t)).addScaledVector(fr.binormals[k], Math.sin(a) * rad(t)));
    }
    return out;
  };
  vinePts.push(...helix(armLPts, 0.35, 0.95, 0.9, 1.2, (t) => armR(t) + VR * 0.8, 12));
  vinePts.push(...helix(foreLPts, 0.15, 0.8, 0.7, 0.4, (t) => lerp(0.04, 0.03, t) + VR * 0.8, 10));
  // From the wrist along the back of the flute going up over the hand, and then winding up the body of the flute
  for (let i = 0; i <= 22; i++) {
    const u = i / 22;
    const y = lerp(0.5, 1.02, u);
    const t = staffY(y);
    const C = staffPath.getPointAt(t);
    const a = PI + 0.4 + PI * 2 * 1.5 * sstep(u, 0.22, 1);
    const r = staffR(t) + VR * 0.6;
    vinePts.push(C.add(v(Math.sin(a) * r, 0, Math.cos(a) * r)));
  }
  const vineR = (t: number) => (0.006 + 0.01 * Math.exp(-(((t - 0.28) / 0.22) ** 2))) * Math.min(1, t * 12) * Math.min(1, (1 - t) * 25);
  add(model, sweep(vinePts, (t, a) => {
    const r = vineR(t) + 0.002;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }, { segs: 90, radial: 6 }), M.vine);
  // A small leaf beside the right end lying down along the shoulder
  {
    const { p, n } = bodyHit(collarS(-2.0), -2.0);
    const down = bA.clone().negate().addScaledVector(n, bA.dot(n)).normalize();
    leafOn(model, p.clone().addScaledVector(n, 0.012), down.clone().addScaledVector(X, -0.3), n, 0.09, 0.05, cLeaf, cLeafD);
  }

  // ── Cape: five big leaves in the colors of the four seasons hanging from the vine collar, spread along the curved surface of the back, the middle one on the top layer ──
  const cSpring = col(0x9ad45e);
  const cSummer = col(0x3f8c42);
  const cAutumn = col(0xe0a03c);
  const mantle: [number, number, number, number, THREE.Color, number][] = [
    // Azimuth, length, width, height off the surface, color, layer
    [-1.15, 0.3, 0.22, 0.01, cSpring, 0],
    [1.15, 0.3, 0.22, 0.01, cSpring, 0],
    [-0.58, 0.38, 0.26, 0.018, cSummer, 1],
    [0.58, 0.38, 0.26, 0.018, cAutumn, 1],
    [0, 0.43, 0.28, 0.026, cSummer, 2],
  ];
  for (const [alpha, len, w, off, c, layer] of mantle) {
    const cVein = c.clone().lerp(col(0xf4f8c0), 0.5);
    const N = 12;
    const RAD = 8;
    const s0 = collarS(alpha) + 0.015;
    // For each row, first measure the radius of the body at that ring, and turn the leaf's lateral width into an angle about the body axis, so the whole leaf lies against the curved surface of the back (the leaf edges do not stick out past the silhouette, and the edges of lower leaves do not poke out through the upper ones)
    const rows = Array.from({ length: N + 1 }, (_, i) => {
      const u = i / N;
      const s = s0 - u * len;
      const a = alpha + (layer === 2 ? 0 : 0.05 * Math.sign(alpha) * u);
      return { u, s, a, R: bodyHit(s, a).p.distanceTo(bp(s, 0)) };
    });
    const geo = finish(
      gridGeo(N + 1, RAD + 1, (i, j) => {
        const { u, s, a, R } = rows[i];
        const th = ((j % RAD) / RAD) * PI * 2;
        const k = leafWidth(u, 0.38);
        const cc = Math.cos(th);
        const sn = Math.sin(th);
        // The midline of the front raised into the midrib
        const rib = Math.abs(cc) < 1e-3 && sn > 0 ? 0.005 * k : 0;
        const hit = bodyHit(s, a + (cc * (w / 2) * k) / R);
        const top = sn >= 0;
        const vein = 1 - sstep(Math.abs(cc), 0.05, 0.6);
        return {
          p: hit.p.addScaledVector(hit.n, off + 0.006 * u * u + sn * (0.007 * k + 0.0006) + rib),
          c: c.clone().lerp(cVein, vein * (top ? 0.45 : 0.1)).lerp(cLeafD, sstep(Math.abs(cc), 0.8, 1) * 0.2).multiplyScalar(top ? 1 : 0.8),
        };
      }),
    );
    add(model, geo, M.leaf);
  }
  // A cluster of small white flowers at the root of the vine (the middle of the back)
  {
    const { p, n } = bodyHit(collarS(0) - 0.005, 0);
    const base = p.clone().addScaledVector(n, 0.03);
    for (const [dx, dy, s] of [[0, 0.018, 1], [-0.032, 0.0, 0.8], [0.03, 0.004, 0.85]] as [number, number, number][]) {
      const g = group(model, tv(base.clone().add(v(dx, dy, 0))));
      orient(g, UP, n);
      blossom(g, s);
    }
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // Shifted so the center of the bounding box (x, z) lands on the origin
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const ctr = box.getCenter(new THREE.Vector3());
  model.position.set(-ctr.x, 0, -ctr.z);
  const size = box.getSize(new THREE.Vector3());

  // ── Idle: breathing and humming with the throat sac, blinking, the eyes slowly looking left and right, the fingers of the right hand tapping the beat on the knee, the right toes tapping the ground, the leaves on the Forest Flute swaying lightly ──
  // emissiveIntensity is not written every frame: another spirit's ultimate changes uEmissiveAmt, and overwriting it every frame would cover it (the morning dew's brightness is fixed)
  const act = { sing: 0 };
  const toeRest = toeGroups[0].quaternion.clone();
  const leafRest = staffLeaves.map((g) => g.quaternion.clone());
  const qT = new THREE.Quaternion();
  const ZA = v(0, 0, 1);
  const update = (t: number) => {
    // Humming: once every 7 seconds, puffing up over 0.4 seconds, holding for 0.6 seconds, and deflating over 0.5 seconds
    const ph = t % 7;
    const hum = ph < 0.4 ? sstep(ph, 0, 0.4) : ph < 1.0 ? 1 : 1 - sstep(ph, 1.0, 1.5);
    const sing = Math.max(hum, act.sing);
    const pump = 1 + 0.05 * Math.sin(t * 5.2) * (1 - sing);
    sac.scale.set(0.13 * pump * (1 + 0.32 * sing), 0.085 * pump * (1 + 0.45 * sing), 0.085 * pump * (1 + 0.55 * sing));

    // Blink: once every 4.3 seconds, the upper and lower eyelids meeting together below the midline
    const bt = (t + 1.3) % 4.3;
    const close = bt < 0.24 ? Math.min(1, Math.sin((bt / 0.24) * PI) * 1.3) : 0;
    const lo = LO_OPEN - 0.14 * sing;
    for (const e of eyes) {
      e.upper.rotation.x = -lerp(UP_OPEN, -0.08, close);
      e.lower.rotation.x = PI + lerp(lo, 0.2, close);
      e.gaze.rotation.set(0.06 + Math.sin(t * 0.5) * 0.02, -e.sx * 0.26 + Math.sin(t * 0.37) * 0.07, 0);
      for (const g of e.glints) g.visible = close < 0.6;
    }

    // Tapping the beat: 0.5 seconds per beat; in the second bar of every two bars the fingers tap the knee in turn from index finger to little finger; the right toes tap the ground on the first beat of each bar
    const beat = t / 0.5;
    const bar = Math.floor(beat / 4) % 2;
    const inBeat = beat % 1;
    const tapK = (i: number) => (bar === 1 && Math.floor(beat % 4) === i ? Math.sin(Math.min(1, inBeat / 0.6) * PI) : 0);
    for (let i = 0; i < kneeFingers.length; i++) kneeFingers[i].g.quaternion.setFromAxisAngle(kneeFingers[i].axis, 0.3 * tapK(i));
    const footTap = Math.floor(beat % 4) === 0 ? Math.sin(Math.min(1, inBeat / 0.5) * PI) : 0;
    toeGroups[0].quaternion.copy(toeRest).multiply(qT.setFromAxisAngle(X, -0.2 * footTap));

    for (let i = 0; i < staffLeaves.length; i++) staffLeaves[i].quaternion.copy(leafRest[i]).multiply(qT.setFromAxisAngle(ZA, Math.sin(t * 1.3 + i * 2.1) * 0.05));
  };
  update(0);

  const anchor = (p: THREE.Vector3) => group(model, tv(p));
  const bellTop = new THREE.Vector3(0, 0.15, 0).applyQuaternion(bellG.quaternion).add(bellG.position);
  const rig = {
    head: anchor(hp(0, 0.03, 0.2)),
    eyes: eyeAnchors,
    anchors: {
      mouth: anchor(mouthFront),
      throat: group(sacG, [0, 0, 0.085]),
      pipe: anchor(bellTop),
      pipeGrip: anchor(staffPath.getPointAt(staffY(gripY))),
      crown: group(lotus, [0, 0.05, 0]),
      dew: dewG,
    },
  };
  // Static parts merged (mesh budget N 40): the eyelids, eyeballs, the tapping fingers and toes, and the bamboo leaves are owners; the vocal sac (scaled) and the eye highlights (switched on and off when blinking) are not merged
  mergeStatic(root, {
    owners: [...eyes.flatMap((e) => [e.upper, e.lower, e.gaze]), ...kneeFingers.map((k) => k.g), ...toeGroups, ...staffLeaves, sacG],
    keep: [sac, ...eyes.flatMap((e) => e.glints)],
    twins: [[M.vine, M.bell], [M.nostril, M.dark0], [M.hole, M.dark0], [M.pod, M.pollen], [M.stamen, M.pollen]],
    rig,
  });
  return {
    root,
    update: (t: number) => update(t),
    rig,
    act,
    center: new THREE.Vector3(0, size.y * 0.5, 0),
    radius: Math.max(size.y * 0.62, size.x * 0.5),
  };
}
