// Mainspring King (model lab version): in the Kingdom Era, the craftsmen built little self-winding mice to maintain the Star Gate; the craftsmen vanished, and the mice still live among the gears of the Star Gate, winding their springs. Neutral, N, quick strike / chain.
// Identifying features: 1. A brass shaft seat riveted all around on its back, with a butterfly-shaped winding key inserted that turns by itself one notch at a time; 2. The tail is coiled into a spring, fitted with a few brass bands, and its tip is a brass pin;
// 3. A crown wheel (the gear in a watch with its teeth pointing up) worn crooked on its head as a crown. A craftsman's brass number tag is nailed to the left ear.
// Body shape: a blue-gray little mouse sitting up on its hind legs with its front paws held at the chest (a mouse's natural alert sitting posture), with big round ears, a pointed snout, plump cheeks and long hind feet; cream color only on the lower muzzle, chin and belly.
// The face follows a real mouse: shiny black bead eyes with one small highlight, a pink nose, three whiskers on each side, a pair of small incisors, and no mouth line.
// Personality: a restless little clockwork craftsman whose nose keeps twitching and whiskers keep trembling, and the tighter the spring the faster it runs; the crooked crown wheel is all the pomp it has as king.
// Gaze order: the face (bead eyes, pink nose, whiskers) and the crown wheel first, the winding key on its back and the tail coiled into a spring second, and the ear tag and the rivets of the shaft seat as support.
// Action table: idle has the nose twitching, whiskers trembling, an ear flicking now and then, the key turning with a click one notch at a time and the tail bouncing up and down like a spring; charge-up has the key turn faster and faster and the body press down (act.wind);
// strike darts forward with the tail springing open (act.dash); hit lays both ears back and the key pauses for a beat; victory sits upright and the key makes one full turn. Anchors: head, eyes, mouth, key (key handle), crown (top of the crown wheel), tail (center of the tail spring).

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, rbox, slab, taper, type LabModel, type V3 } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);
const X = v3(1, 0, 0);
const Z = v3(0, 0, 1);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

// ───────────────────────── Distance field and surface mesh ─────────────────────────

type F3 = (x: number, y: number, z: number) => number;

/** Approximate distance of an axis-aligned ellipsoid */
function ell(c: V3, r: V3): F3 {
  const [cx, cy, cz] = c;
  const [rx, ry, rz] = r;
  return (x, y, z) => {
    const ax = (x - cx) / rx;
    const ay = (y - cy) / ry;
    const az = (z - cz) / rz;
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const bx = ax / rx;
    const by = ay / ry;
    const bz = az / rz;
    const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
    return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
  };
}

/** A cone capsule with different radii at the two ends (leg, neck, muzzle) */
function rcone(a: V3, b: V3, r1: number, r2: number): F3 {
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  return (x, y, z) => {
    const pax = x - a[0];
    const pay = y - a[1];
    const paz = z - a[2];
    const yy = pax * bax + pay * bay + paz * baz;
    const zz = yy - l2;
    const qx = pax * l2 - bax * yy;
    const qy = pay * l2 - bay * yy;
    const qz = paz * l2 - baz * yy;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yy * yy * l2;
    const z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
  };
}

/** Smooth union: the first piece is the base, and the rest blend in by their own k */
function blend(parts: [F3, number][]): F3 {
  return (x, y, z) => {
    let d = parts[0][0](x, y, z);
    for (let i = 1; i < parts.length; i++) {
      const [f, k] = parts[i];
      const di = f(x, y, z);
      const h = Math.max(k - Math.abs(d - di), 0) / k;
      d = Math.min(d, di) - h * h * k * 0.25;
    }
    return d;
  };
}

function gradF(f: F3, x: number, y: number, z: number, e: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(f(x + e, y, z) - f(x - e, y, z), f(x, y + e, z) - f(x, y - e, z), f(x, y, z + e) - f(x, y, z - e)).normalize();
}

/** From o going forward along direction d, find the first point that enters the surface */
function marchF(f: F3, o: THREE.Vector3, d: THREE.Vector3, tmax = 1.5): { p: THREE.Vector3; n: THREE.Vector3 } {
  const dir = d.clone().normalize();
  let t = 0;
  let prev = f(o.x, o.y, o.z);
  const at = (s: number) => f(o.x + dir.x * s, o.y + dir.y * s, o.z + dir.z * s);
  while (t < tmax) {
    const t1 = t + clamp(Math.abs(prev) * 0.6, 0.002, 0.02);
    const f1 = at(t1);
    if ((prev > 0) !== (f1 > 0)) {
      let a = t;
      let b = t1;
      for (let i = 0; i < 20; i++) {
        const m = (a + b) / 2;
        if ((at(m) > 0) === (prev > 0)) a = m;
        else b = m;
      }
      const p = o.clone().addScaledVector(dir, (a + b) / 2);
      return { p, n: gradF(f, p.x, p.y, p.z, 5e-4, new THREE.Vector3()) };
    }
    t = t1;
    prev = f1;
  }
  const p = o.clone().addScaledVector(dir, tmax);
  return { p, n: gradF(f, p.x, p.y, p.z, 5e-4, new THREE.Vector3()) };
}

/**
 * Wrap the distance field into a mesh (surface nets): every cell crossing the surface gets one vertex (the average of the edge intersections, then pushed back onto the surface along the gradient),
 * and every grid edge crossing the surface is joined into a quad. Normals are taken directly from the distance field's gradient, so the smooth union's joins show no seams or creases.
 */
function surfaceNets(f: F3, lo: V3, hi: V3, h: number, paint?: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const nx = Math.ceil((hi[0] - lo[0]) / h) + 1;
  const ny = Math.ceil((hi[1] - lo[1]) / h) + 1;
  const nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
  const F = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[i + nx * (j + ny * k)] = f(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h);
  const cx = nx - 1;
  const cy = ny - 1;
  const cz = nz - 1;
  const V = new Int32Array(cx * cy * cz).fill(-1);
  const pos: number[] = [];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const val = new Float64Array(8);
  const g = new THREE.Vector3();
  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        let neg = 0;
        for (let c = 0; c < 8; c++) {
          val[c] = F[i + C[c][0] + nx * (j + C[c][1] + ny * (k + C[c][2]))];
          if (val[c] < 0) neg++;
        }
        if (neg === 0 || neg === 8) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [a, b] of E) {
          if (val[a] < 0 === val[b] < 0) continue;
          const t = val[a] / (val[a] - val[b]);
          sx += C[a][0] + t * (C[b][0] - C[a][0]);
          sy += C[a][1] + t * (C[b][1] - C[a][1]);
          sz += C[a][2] + t * (C[b][2] - C[a][2]);
          n++;
        }
        let px = lo[0] + (i + sx / n) * h;
        let py = lo[1] + (j + sy / n) * h;
        let pz = lo[2] + (k + sz / n) * h;
        for (let it = 0; it < 3; it++) {
          const d = clamp(f(px, py, pz), -h * 0.5, h * 0.5);
          gradF(f, px, py, pz, h * 0.05, g);
          px -= g.x * d;
          py -= g.y * d;
          pz -= g.z * d;
        }
        V[i + cx * (j + cy * k)] = pos.length / 3;
        pos.push(px, py, pz);
      }
  const idx: number[] = [];
  const cell = (i: number, j: number, k: number) => V[i + cx * (j + cy * k)];
  const d2 = (a: number, b: number) => (pos[a * 3] - pos[b * 3]) ** 2 + (pos[a * 3 + 1] - pos[b * 3 + 1]) ** 2 + (pos[a * 3 + 2] - pos[b * 3 + 2]) ** 2;
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) [b, d] = [d, b];
    if (d2(a, c) < d2(b, d)) idx.push(a, b, c, a, c, d);
    else idx.push(a, b, d, b, c, d);
  };
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const in0 = F[i + nx * (j + ny * k)] < 0;
        if (in0 !== F[i + 1 + nx * (j + ny * k)] < 0) quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), !in0);
        if (in0 !== F[i + nx * (j + 1 + ny * k)] < 0) quad(cell(i - 1, j, k - 1), cell(i - 1, j, k), cell(i, j, k), cell(i, j, k - 1), !in0);
        if (in0 !== F[i + nx * (j + ny * (k + 1))] < 0) quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), !in0);
      }
  const nv = pos.length / 3;
  const nor = new Float32Array(nv * 3);
  const cl = new Float32Array(nv * 3);
  const P = new THREE.Vector3();
  for (let v = 0; v < nv; v++) {
    P.set(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
    gradF(f, P.x, P.y, P.z, h * 0.2, g);
    nor.set([g.x, g.y, g.z], v * 3);
    const c = paint ? paint(P, g) : col(0xffffff);
    cl.set([c.r, c.g, c.b], v * 3);
  }
  // Winding check: the triangle normal points the same way as the gradient
  let s = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const ux = pos[b * 3] - pos[a * 3];
    const uy = pos[b * 3 + 1] - pos[a * 3 + 1];
    const uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const wx = pos[c * 3] - pos[a * 3];
    const wy = pos[c * 3 + 1] - pos[a * 3 + 1];
    const wz = pos[c * 3 + 2] - pos[a * 3 + 2];
    s += (uy * wz - uz * wy) * nor[a * 3] + (uz * wx - ux * wz) * nor[a * 3 + 1] + (ux * wy - uy * wx) * nor[a * 3 + 2];
  }
  if (s < 0) for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

// ───────────────────────── Geometry helpers ─────────────────────────

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

/** Eyelid shell: with +y as the top, covering down to lip radians, with a rounded lip at the edge; front is centered on +z, otherwise on -z (used for the lower eyelid turned half a turn) */
function lidLite(ri: number, ro: number, lip: number, front: boolean, arc = PI * 1.15, segs = 10): THREE.BufferGeometry {
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

/** Make the group's +y point along yDir and its +z face zHint as far as possible */
function orient(o: THREE.Object3D, yDir: THREE.Vector3, zHint: THREE.Vector3): void {
  const y = yDir.clone().normalize();
  const z = zHint.clone().addScaledVector(y, -zHint.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/**
 * A sheet with thickness (ear): S(u, v) is the midsurface, growing thick / 2 to each side, with the four edges rounded into lips.
 * color(u, v, side): side 1 is the outward side.
 */
function thickSheet(
  NU: number,
  NV: number,
  S: (u: number, v: number) => THREE.Vector3,
  thick: (u: number, v: number) => number,
  outward: THREE.Vector3,
  color: (u: number, v: number, side: number) => THREE.Color,
  E = 2,
): THREE.BufferGeometry {
  const cols = NU + 1;
  const rows = NV + 1;
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
      const n = su.clone().cross(sv);
      Nn.push(n.lengthSq() > 1e-14 ? n.normalize() : outward.clone());
    }
  for (const n of Nn) if (n.dot(outward) < 0) n.negate();
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
  const Cc = new THREE.Vector3();
  const tri = (a: number, b: number, c: number) => {
    A.set(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]);
    B.set(pos[b * 3] - A.x, pos[b * 3 + 1] - A.y, pos[b * 3 + 2] - A.z);
    Cc.set(pos[c * 3] - A.x, pos[c * 3 + 1] - A.y, pos[c * 3 + 2] - A.z);
    const fn = B.cross(Cc);
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
    const ee = e.clone().addScaledVector(n, -e.dot(n));
    if (ee.lengthSq() < 1e-12) ee.copy(Sv[k]).normalize();
    ee.normalize();
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


// ───────────────────────── Shape ─────────────────────────

export function buildClockmouseLab(): LabModel {
  const RIMC = 0xdce8ff;
  const vc = <T extends THREE.MeshToonMaterial>(m: T) => {
    m.vertexColors = true;
    return m;
  };
  const FUR = 0x8a93a6;
  const CREAM = 0xf1e7d6;
  const PINK = 0xeba2a6;
  const M = {
    fur: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC })),
    furPlain: labToon(FUR, { rim: 0.6, rimColor: RIMC }),
    pinkPlain: labToon(PINK, { rim: 0.6, rimColor: RIMC }),
    whisker: labToon(0xf7f5f2, { rim: 0.6, rimColor: RIMC }),
    tooth: labToon(0xf8f1e2, { rim: 0.6, rimColor: RIMC }),
    nose: labToon(0xee97a0, { rim: 0.3, spec: 0.7, specTh: 0.975 }),
    eye: labToon(0x110e13, { ramp: 'gem', rim: 0 }),
    brass: labToon(0xd4a44a, { ramp: 'metal', rim: 0.45, rimColor: 0xfff0c8, spec: 0.95, specTh: 0.955 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'clockmouse-lab';
  const { add, group } = partKit();
  const studGeo = new THREE.SphereGeometry(1, 8, 3, 0, PI * 2, 0, PI / 2);

  // Outline part indices (groups spaced 10 or more apart)
  const BODY = 9801;
  const HEAD = 9811;
  const TAIL = 9821;
  const ARM = 9831;
  const toeGeoPaw = new THREE.SphereGeometry(1, 12, 8);

  const body = group(root);
  const cFur = col(FUR);
  const cCream = col(CREAM);
  const cPink = col(PINK);
  const cPinkDk = col(0xdd8a92);

  // ── Body: a pear shape sitting up, with round bulging thighs, long hind feet lying flat on the ground reaching forward, and the two front paws held at the chest ──
  const parts: [F3, number][] = [
    [ell([0, 0.26, -0.03], [0.22, 0.25, 0.21]), 0],
    [ell([0, 0.46, 0.0], [0.16, 0.19, 0.145]), 0.12],
    [ell([0, 0.58, 0.02], [0.115, 0.09, 0.11]), 0.08],
  ];
  for (const sx of [-1, 1]) {
    parts.push([ell([sx * 0.14, 0.19, 0.01], [0.1, 0.135, 0.15]), 0.07]);
    parts.push([rcone([sx * 0.15, 0.1, 0.04], [sx * 0.14, 0.04, 0.09], 0.05, 0.035), 0.04]);
    parts.push([ell([sx * 0.14, 0.028, 0.15], [0.058, 0.028, 0.115]), 0.04]);
  }
  const bodyF = blend(parts);
  {
    const geo = surfaceNets(bodyF, [-0.3, -0.02, -0.28], [0.3, 0.7, 0.3], 0.02, (p, n) => {
      // The soles and the front of the tops of the feet are pink (the belly's cream color is laid on as a separate patch so its edge is crisp)
      const foot = sstep(0.058 - p.y, 0, 0.015) * sstep(p.z, 0.02, 0.07);
      return cFur.clone().lerp(cPink, foot);
    });
    add(body, geo, M.fur).userData.inkGroup = BODY;
  }
  // Belly: a body-hugging ellipse (3.5 mm off the surface, same outline group), with the cream edge sampled to the shape rather than using a jagged vertex-color edge
  {
    const NR = 7;
    const NA = 36;
    const pos: number[] = [];
    const cl: number[] = [];
    const idx: number[] = [];
    const at = (r: number, a: number) => {
      const x = Math.cos(a) * 0.108 * r;
      const y = 0.32 + Math.sin(a) * 0.19 * r;
      const h = marchF(bodyF, v3(x, y, 0.5), v3(0, 0, -1));
      return h.p.addScaledVector(h.n, 0.0035);
    };
    const c0 = at(0, 0);
    pos.push(c0.x, c0.y, c0.z);
    for (let i = 1; i <= NR; i++)
      for (let j = 0; j < NA; j++) {
        const q = at(i / NR, (j / NA) * PI * 2);
        pos.push(q.x, q.y, q.z);
      }
    for (let k = 0; k < pos.length / 3; k++) cl.push(cCream.r, cCream.g, cCream.b);
    for (let j = 0; j < NA; j++) idx.push(0, 1 + j, 1 + ((j + 1) % NA));
    for (let i = 1; i < NR; i++)
      for (let j = 0; j < NA; j++) {
        const a = 1 + (i - 1) * NA + j;
        const b = 1 + (i - 1) * NA + ((j + 1) % NA);
        idx.push(a, a + NA, b, b, a + NA, b + NA);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // The normal must point forward (away from the body)
    if ((g.attributes.normal as THREE.BufferAttribute).getZ(0) < 0) {
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    add(body, g, M.fur).userData.inkGroup = BODY;
  }
  // Front paws: reaching out from the sides of the chest, two small pink paws brought together at the chest, four small fingers on each paw; set a little apart from the chest so the outline can tell them apart
  {
    const armProf = curveTable([[0, 0, 0], [0.1, 0.042, 0.042], [0.55, 0.034, 0.034], [0.92, 0.028, 0.028], [1, 0, 0]]);
    const fingerGeo = new THREE.SphereGeometry(1, 8, 6);
    for (const sx of [-1, 1]) {
      add(body, loft([v3(sx * 0.1, 0.54, 0.0), v3(sx * 0.1, 0.5, 0.11), v3(sx * 0.07, 0.455, 0.19), v3(sx * 0.05, 0.445, 0.215)], armProf, { segs: 14, radial: 10 }), M.furPlain).userData.inkGroup = ARM;
      const pg = group(body, [sx * 0.038, 0.45, 0.232], [-0.35, -sx * 0.35, sx * 0.15]);
      add(pg, toeGeoPaw, M.pinkPlain, [0, 0, 0], [0, 0, 0], [0.026, 0.034, 0.024]).userData.inkGroup = ARM;
      for (let k = 0; k < 4; k++) add(pg, fingerGeo, M.pinkPlain, [-sx * 0.004 + (k - 1.5) * 0.011, 0.032, 0.008], [0, 0, 0], [0.0075, 0.012, 0.0075]).userData.inkGroup = ARM;
    }
  }
  // Toes: four small pink toes on the front edge of each foot
  const toeGeo = new THREE.SphereGeometry(1, 8, 6);
  for (const sx of [-1, 1])
    for (let k = 0; k < 4; k++) {
      const x = sx * 0.14 + (k - 1.5) * 0.024;
      add(body, toeGeo, M.pinkPlain, [x, 0.017, 0.255 - Math.abs(k - 1.5) * 0.012], [0, 0, 0], [0.014, 0.013, 0.02]);
    }

  // ── Shaft seat and winding key on the back ──
  const back = marchF(bodyF, v3(0, 0.44, -0.05), v3(0, 0.08, -1));
  const bushing = group(body, [back.p.x, back.p.y, back.p.z]);
  orient(bushing, back.n, UP);
  add(bushing, lathe([[0.001, -0.022], [0.05, -0.022], [0.053, -0.004], [0.05, 0.007], [0.032, 0.011], [0.026, 0.03], [0.02, 0.034], [0.001, 0.034]], 20), M.brass);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * PI * 2;
    const sg = group(bushing, [Math.sin(a) * 0.041, 0.006, Math.cos(a) * 0.041]);
    add(sg, studGeo, M.brass, [0, 0, 0], [0, 0, 0], [0.0075, 0.005, 0.0075]);
  }
  const keyG = group(bushing, [0, 0.03, 0]);
  {
    add(keyG, new THREE.CylinderGeometry(0.012, 0.013, 0.11, 10), M.brass, [0, 0.055, 0]);
    add(keyG, lathe([[0.001, -0.008], [0.017, -0.008], [0.02, -0.003], [0.02, 0.003], [0.017, 0.008], [0.001, 0.008]], 12), M.brass, [0, 0.09, 0]);
    // Butterfly-shaped handle: two round wings, left and right, each with a round hole; the plane contains the key axis
    const s = new THREE.Shape();
    const NB = 40;
    for (let i = 0; i <= NB; i++) {
      const th = (i / NB) * PI * 2 - PI / 2;
      const r = 0.03 + 0.046 * Math.pow(Math.abs(Math.cos(th)), 0.75);
      const x = Math.cos(th) * r;
      const y = 0.158 + Math.sin(th) * r * 0.82;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    for (const hx of [-0.05, 0.05]) {
      const h = new THREE.Path();
      h.absarc(hx, 0.158, 0.014, 0, PI * 2, true);
      s.holes.push(h);
    }
    add(keyG, slab(s, 0.012, 0.004, 4), M.brass);
  }

  // ── Head: a big round cranium, plump cheeks and a snout tapering forward; the local origin is at the center of the cranium ──
  const HC: V3 = [0, 0.72, 0.05];
  const headG = group(body, HC);
  const headF = blend([
    [ell([0, 0.01, -0.01], [0.16, 0.145, 0.15]), 0],
    [ell([0.072, -0.05, 0.065], [0.078, 0.07, 0.085]), 0.06],
    [ell([-0.072, -0.05, 0.065], [0.078, 0.07, 0.085]), 0.06],
    [rcone([0, -0.03, 0.07], [0, -0.062, 0.245], 0.085, 0.03), 0.06],
    [ell([0, -0.095, 0.1], [0.055, 0.04, 0.07]), 0.04],
  ]);
  {
    const geo = surfaceNets(headF, [-0.2, -0.17, -0.2], [0.2, 0.19, 0.3], 0.0145, (p) => {
      // Cream color only on the lower muzzle and chin
      const cream = sstep(-0.05 - p.y, -0.012, 0.012) * sstep(p.z, 0.03, 0.09) * (1 - sstep(Math.abs(p.x), 0.05, 0.075));
      return cFur.clone().lerp(cCream, cream);
    });
    add(headG, geo, M.fur).userData.inkGroup = HEAD;
  }
  // Small incisors: a pair under the snout tip, with no mouth line
  for (const sx of [-1, 1]) add(headG, rbox(0.012, 0.024, 0.008, 0.003, 1), M.tooth, [sx * 0.0068, -0.1, 0.226], [0.15, 0, 0]);

  // Eyes: shiny black bead eyes, bulging slightly from the scalp, with one small highlight; both eyes look the same way, forward
  const ER = 0.024;
  const eyeball = new THREE.SphereGeometry(ER, 14, 10);
  const lidUp = lidLite(ER + 0.002, ER + 0.007, PI / 2, true);
  const lidLow = lidLite(ER + 0.0015, ER + 0.006, PI / 2, false);
  const UP_OPEN = 1.0;
  const LO_OPEN = 0.95;
  const lids: { g: THREE.Group; open: number; shut: number }[] = [];
  const eyeAnchors: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const hit = marchF(headF, v3(sx * 0.05, 0.03, 0.02), v3(sx * 0.62, 0.12, 1));
    const c = hit.p.clone().addScaledVector(hit.n, -ER * 0.42);
    const eg = group(headG, [c.x, c.y, c.z]);
    const dir = hit.n.clone().lerp(v3(sx * 0.3, 0.05, 1).normalize(), 0.45).normalize();
    const r = new THREE.Vector3().crossVectors(UP, dir).normalize();
    const u = new THREE.Vector3().crossVectors(dir, r);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, dir));
    add(eg, eyeball, M.eye);
    const fwdLocal = v3(0, 0.05, 1).normalize().applyQuaternion(eg.quaternion.clone().invert());
    const hl = add(eg, new THREE.SphereGeometry(ER * 0.2, 8, 6), M.hi, fwdLocal.clone().multiplyScalar(ER * 0.92).add(v3(-sx * ER * 0.25, ER * 0.3, 0)).toArray() as V3, [0, 0, 0], [1, 1, 0.5]);
    hl.quaternion.setFromUnitVectors(Z, fwdLocal);
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
    const ea = fwdLocal.clone().multiplyScalar(ER).applyQuaternion(eg.quaternion).add(c);
    eyeAnchors.push(group(headG, [ea.x, ea.y, ea.z]));
    const slant = new THREE.Quaternion().setFromAxisAngle(Z, sx * 0.1);
    const lidG = group(eg);
    lidG.quaternion.copy(slant);
    const upper = group(lidG, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.furPlain).userData.inkGroup = HEAD;
    const lower = group(headG, [c.x, c.y, c.z]);
    lower.quaternion.copy(eg.quaternion).multiply(slant).multiply(new THREE.Quaternion().setFromAxisAngle(X, PI + LO_OPEN));
    add(lower, lidLow, M.furPlain).userData.inkGroup = HEAD;
    lids.push({ g: upper, open: -UP_OPEN, shut: LO_OPEN - 0.02 });
  }

  // Nose and whiskers: twitching together with the nose
  const NOSE: V3 = [0, -0.058, 0.272];
  const noseG = group(headG, NOSE);
  add(noseG, new THREE.SphereGeometry(1, 14, 10), M.nose, [0, 0, 0], [0.3, 0, 0], [0.019, 0.015, 0.015]);
  for (const sx of [-1, 1])
    for (const [el, len] of [[0.2, 0.17], [0, 0.19], [-0.2, 0.16]] as [number, number][]) {
      // The root is buried in the side of the muzzle and the tip tapers to a point
      const o = v3(sx * 0.022, -0.01 + el * 0.03, -0.04);
      const d = v3(sx, el * 0.9 + 0.05, -0.28).normalize();
      const pts = [o, o.clone().addScaledVector(d, len * 0.5).add(v3(0, 0.006, 0)), o.clone().addScaledVector(d, len).add(v3(0, -0.012, 0))];
      add(noseG, loft(pts, curveTable([[0, 0, 0], [0.06, 0.0062, 0.0062], [0.5, 0.0045, 0.0045], [0.92, 0.0026, 0.0026], [1, 0, 0]]), { segs: 10, radial: 5 }), M.whisker);
    }

  // Big round ears: cup-shaped, tipping slightly outward and back, pink on the inside
  const ears: { g: THREE.Group; sx: number; base: THREE.Euler }[] = [];
  const earSheet = (R: number, cup: number, th: number, lift: number, colr: (u: number, v: number, side: number) => THREE.Color) =>
    thickSheet(
      8,
      8,
      (u, v) => {
        const y = lerp(-0.55, 1, v) * R + lift;
        const hw = Math.sqrt(Math.max(0, R * R - (y - lift) ** 2)) + 0.003;
        const q = 2 * u - 1;
        return v3(q * hw, y + R * 0.75, -cup * (1 - q * q) * Math.sin(PI * v));
      },
      (u, v) => th * (1 - 0.3 * v),
      Z,
      colr,
    );
  for (const sx of [-1, 1]) {
    const eg = group(headG, [sx * 0.098, 0.095, -0.03]);
    const base = new THREE.Euler(-0.2, sx * 0.35, -sx * 0.5);
    eg.rotation.copy(base);
    const R = 0.105;
    add(eg, earSheet(R, 0.022, 0.017, 0, () => cFur), M.fur);
    const inner = earSheet(R * 0.74, 0.02, 0.006, 0.006, () => cPinkDk);
    inner.translate(0, 0, 0.0095);
    add(eg, inner, M.fur);
    if (sx > 0) {
      // The craftsman's brass number tag: nailed on the outside of the lower edge of the left ear
      const tg = group(eg, [R * 0.78, R * 0.42, 0.006], [0, 0, -0.35]);
      add(tg, rbox(0.03, 0.036, 0.0065, 0.004, 2), M.brass);
      add(tg, studGeo, M.brass, [0, 0.008, 0.003], [PI / 2, 0, 0], [0.0055, 0.004, 0.0055]);
    }
    ears.push({ g: eg, sx, base });
  }

  // Crown wheel: a brass gear with its teeth up, worn crooked between the two ears
  const crownG = group(headG, [0.012, 0.146, -0.008], [-0.12, 0, -0.2]);
  {
    const R0 = 0.064;
    const w = 0.03;
    const th = 0.011;
    const prof: [number, number][] = [[R0, 0], [R0 + th, 0], [R0 + th + 0.002, 0.004], [R0 + th, w], [R0, w], [R0 - 0.002, 0.004]];
    add(crownG, lathe([...prof, prof[0]], 28), M.brass);
    const tooth = taper(rbox(0.019, 0.026, th, 0.003, 1), [0.5, 1]);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * PI * 2;
      add(crownG, tooth, M.brass, [Math.sin(a) * (R0 + th / 2), w + 0.011, Math.cos(a) * (R0 + th / 2)], [0, a, 0]);
    }
  }

  // ── Tail: from the rump lying back along the ground, then curling up into a spring; three brass bands on the tail root and a brass pin at the tail tip ──
  const tailG = group(body, [0, 0.12, -0.2], [0, 0.75, 0]);
  let tailCurve: THREE.CatmullRomCurve3;
  const SPC = v3(0, 0.17, -0.3);
  {
    const pts = [v3(0, 0.02, 0.08), v3(0, -0.015, -0.04), v3(0, -0.028, -0.16)];
    const TURN = 1.4;
    for (let a = 0; a <= TURN * 360; a += 20) {
      const s = a / (TURN * 360);
      const th = ((a - 90) * PI) / 180;
      const r = lerp(0.2, 0.05, s);
      pts.push(v3(0, SPC.y + r * Math.sin(th), SPC.z - r * Math.cos(th)));
    }
    tailCurve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const geo = paint(loft(pts, curveTable([[0, 0, 0], [0.02, 0.032, 0.032], [0.2, 0.028, 0.028], [0.6, 0.021, 0.021], [0.97, 0.016, 0.016], [1, 0, 0]]), { segs: 72, radial: 10, side: X }), () => cPink);
    add(tailG, geo, M.fur).userData.inkGroup = TAIL;
    for (const t of [0.07, 0.1, 0.13]) {
      const p = tailCurve.getPointAt(t);
      const tg = tailCurve.getTangentAt(t);
      const bg = group(tailG, [p.x, p.y, p.z]);
      bg.quaternion.setFromUnitVectors(Z, tg);
      add(bg, new THREE.TorusGeometry(0.033, 0.0065, 6, 16), M.brass);
    }
    const tip = tailCurve.getPointAt(1);
    add(tailG, new THREE.SphereGeometry(0.019, 10, 8), M.brass, [tip.x, tip.y, tip.z]);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle action: the nose twitches three times in a row, whiskers tremble, an ear flicks now and then, the key turns one notch at a time, the tail bounces up and down like a spring, blinking ──
  const act = { wind: 0, dash: 0 };
  let keyAng = 0;
  let lastT = 0;
  const update = (t: number) => {
    const dtt = Math.max(0, Math.min(0.1, t - lastT));
    lastT = t;
    const br = Math.sin(t * 2.6);
    const squat = act.wind * 0.06;
    body.scale.set(1 + br * 0.008 + squat * 0.5, 1 + br * 0.01 - squat, 1 + br * 0.008);
    body.rotation.x = act.dash * 0.35;
    headG.rotation.set(Math.sin(t * 0.8) * 0.04 - act.dash * 0.2, Math.sin(t * 0.45) * 0.14, Math.sin(t * 0.9 + 0.6) * 0.07);
    // Nose: three quick twitches every 1.5 seconds
    const nt = t % 1.5;
    const tw = nt < 0.42 ? Math.abs(Math.sin((nt / 0.42) * PI * 3)) : 0;
    noseG.scale.set(1 + tw * 0.08, 1 + tw * 0.12, 1);
    noseG.rotation.set(tw * 0.05, Math.sin(t * 9) * 0.02 * tw, 0);
    // Ears: the right ear flicks every 3.3 seconds, the left every 5.1 seconds
    for (const e of ears) {
      const per = e.sx > 0 ? 5.1 : 3.3;
      const et = t % per;
      const fl = et < 0.3 ? Math.sin((et / 0.3) * PI) : 0;
      e.g.rotation.set(e.base.x - fl * 0.25 - act.dash * 0.4, e.base.y, e.base.z - e.sx * fl * 0.15);
    }
    // Key: turns one notch at a time like a ratchet (30 degrees per notch), and faster and faster while charging
    if (act.wind > 0.01) keyAng += dtt * (2 + act.wind * 14);
    const tick = t * 2.2;
    const step = Math.floor(tick) + THREE.MathUtils.smootherstep(tick - Math.floor(tick), 0.0, 0.25);
    keyG.rotation.y = PI / 4 + step * (PI / 6) + keyAng;
    // Tail: bounces up and down like a spring
    const sp = Math.sin(t * 3.1);
    tailG.scale.set(1, 1 + sp * 0.03 + act.dash * 0.25, 1 + act.dash * 0.3);
    tailG.rotation.set(sp * 0.03, 0.75 + Math.sin(t * 0.7) * 0.06, 0);
    // Blink
    const bt = t % 3.4;
    const bk = (x: number) => (x > 0 && x < 0.18 ? Math.min(1, Math.sin((x / 0.18) * PI) * 1.3) : 0);
    const close = Math.max(bk(bt - 3.0), Math.floor(t / 3.4) % 3 === 2 ? bk(bt - 2.7) : 0);
    for (const l of lids) l.g.rotation.x = lerp(l.open, l.shut, close);
  };
  update(0);

  const face = group(headG, [0, -0.02, 0.2]);
  const mouthA = group(headG, [0, -0.1, 0.22]);
  const keyA = group(keyG, [0, 0.16, 0]);
  const crownA = group(crownG, [0, 0.05, 0]);
  const tailA = group(tailG, [SPC.x, SPC.y, SPC.z]);
  const rig = { head: face, eyes: eyeAnchors, anchors: { mouth: mouthA, key: keyA, crown: crownA, tail: tailA } };
  mergeStatic(root, {
    owners: [body, headG, noseG, keyG, tailG, ...ears.map((e) => e.g), ...lids.map((l) => l.g)],
    twins: [
      [M.furPlain, M.fur],
      [M.pinkPlain, M.fur],
    ],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.46, -0.05), radius: 0.66 };
}
