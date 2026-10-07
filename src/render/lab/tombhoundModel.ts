// Three-Headed Warden (model lab version): the watchdog of the ancient kingdom's underground tombs, which after the Night of the Shattered Heart still guards a door no one will ever come back through. Dark + fire, R, chain bites / burning.
// Identifying features: 1. Three dogs' heads with pointed upright ears growing from the same broad shoulders, the middle one tallest and facing forward and the left and right ones each looking outward; 2. Short charcoal-black fur with a rust-red muzzle, throat and four feet (the real coloring of a black-and-tan dog),
// with the glow of embers smoldering in the mouths; 3. An ancient bronze collar gone green with verdigris around each of the three necks, the middle one hanging the big key to the tomb door; the tail tip burns with a tuft of netherfire, the lamp it leaves for the tomb passage.
// Back: behind the middle collar trails a broken length of ancient bronze chain, hanging over the shoulders and back to the left flank, the last link split open (no one is leading it, and it did not leave).
// Personality: an old watchdog that neither barks nor retreats; the middle head looks straight ahead calmly, the left head is alert with ears up, and the right head has its mouth half open with the fire in its throat smoldering. The eyes are a dog's small dark eyes, sunk in their sockets, with one small highlight.
// Gaze order: the middle head (rust-red muzzle, black nose, slightly open mouth) first, the key on the chest and the fire at the tail tip second, and the collars and the broken chain on its back as support.
// Action table: idle has the three heads turning in turn to their own bearings, the chest breathing, the tail flame flickering and the key swaying lightly; charge-up lowers the three heads and brightens the fire in the mouths (act.glow);
// strike has the three heads bite forward in staggered turns (act.bite); hit has all four feet not retreating while the three heads shrink back together; victory has the middle head tilt back and the tail flame leap high.
// Anchors: head (the face of the middle one), eyes (six eyes), mouth (middle), mouthL, mouthR, key (key), flame (tail flame tip).

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, rbox, type LabModel, type V3 } from './shapes.ts';
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

function ellipsePts(rx: number, ry: number, dy = 0, n = 14): [number, number][] {
  return Array.from({ length: n }, (_, i) => [Math.cos((i / n) * PI * 2) * rx, Math.sin((i / n) * PI * 2) * ry + dy] as [number, number]);
}

/** A planar shape on a sphere (iris) */
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

export function buildTombhoundLab(): LabModel {
  const RIMC = 0xffb98c;
  const vc = <T extends THREE.MeshToonMaterial>(m: T) => {
    m.vertexColors = true;
    return m;
  };
  const FUR = 0x3a343d;
  const RUST = 0xa85a2e;
  const M = {
    fur: vc(labToon(0xffffff, { rim: 0.85, rimColor: RIMC })),
    furPlain: labToon(FUR, { rim: 0.85, rimColor: RIMC }),
    fang: labToon(0xf1e6d0, { rim: 0.4, rimColor: RIMC, spec: 0.7, specTh: 0.975 }),
    nose: labToon(0x1a1519, { rim: 0.4, rimColor: RIMC, spec: 0.7, specTh: 0.975 }),
    gloss0: vc(labToon(0xffffff, { rim: 0.4, rimColor: RIMC, spec: 0.7, specTh: 0.975 })),
    claw: labToon(0x26201f, { rim: 0.4, rimColor: RIMC, spec: 0.7, specTh: 0.975 }),
    eye: labToon(0x150e0c, { ramp: 'gem', rim: 0 }),
    iris: labToon(0x3c1d10, { ramp: 'gem', rim: 0 }),
    ember: labToon(0xff7a2a, { ramp: 'gem', rim: 0, emissive: 0xff4a10, emissiveAmt: 0.75 }),
    patina: labToon(0x4f9282, { rim: 0.5, rimColor: 0xc8f0e0, speckle: 0.35 }),
    bronze: labToon(0xc0904a, { ramp: 'metal', rim: 0.5, rimColor: 0xffe2b0, spec: 0.9, specTh: 0.955 }),
    flame: labToon(0xff8a2a, { ramp: 'gem', rim: 0, emissive: 0xff5a14, emissiveAmt: 0.85 }),
    core: labToon(0xffe28a, { ramp: 'gem', rim: 0, emissive: 0xffc04a, emissiveAmt: 0.9 }),
    gem0: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'tombhound-lab';
  const { add, group } = partKit();
  // Rivet: a low-poly hemisphere (partKit's rivet is nearly two hundred faces each)
  const studGeo = new THREE.SphereGeometry(1, 8, 3, 0, PI * 2, 0, PI / 2);

  // Outline part indices: no lines between members of the same group; groups spaced 10 or more apart
  const BODY = 9601;
  const HEADS = [9611, 9621, 9631];
  const JAWS = [9641, 9651, 9661];
  const COLLAR = 9671;
  const TAIL = 9681;
  const FLAME = 9691;
  const CORE = 9701;

  const body = group(root);
  const cFur = col(FUR);
  const cRust = col(RUST);
  const cRustDk = col(0x7c3e22);

  // ── Body: a watchdog with a deep chest and narrow waist, all four feet planted firmly, three necks growing from the shoulders; the whole thing is one distance field, with no seams at the joins ──
  const NECKS: { a: V3; b: V3; r1: number; r2: number }[] = [
    { a: [0, 0.6, 0.1], b: [0, 0.9, 0.33], r1: 0.112, r2: 0.072 },
    { a: [0.07, 0.6, 0.08], b: [0.275, 0.8, 0.265], r1: 0.098, r2: 0.066 },
    { a: [-0.07, 0.6, 0.08], b: [-0.275, 0.8, 0.265], r1: 0.098, r2: 0.066 },
  ];
  const legs: [F3, number][] = [];
  for (const sx of [-1, 1]) {
    // Front legs: shoulder, elbow, wrist, paw
    legs.push([rcone([sx * 0.125, 0.47, 0.17], [sx * 0.132, 0.28, 0.145], 0.078, 0.056), 0.06]);
    legs.push([rcone([sx * 0.132, 0.28, 0.145], [sx * 0.134, 0.075, 0.19], 0.056, 0.043), 0.03]);
    legs.push([ell([sx * 0.135, 0.036, 0.232], [0.056, 0.036, 0.07]), 0.04]);
    // Hind legs: thigh, knee forward, hock back, paw
    legs.push([ell([sx * 0.118, 0.45, -0.31], [0.085, 0.15, 0.13]), 0.07]);
    legs.push([rcone([sx * 0.128, 0.44, -0.31], [sx * 0.138, 0.265, -0.235], 0.08, 0.055), 0.05]);
    legs.push([rcone([sx * 0.138, 0.265, -0.235], [sx * 0.14, 0.125, -0.38], 0.055, 0.04), 0.03]);
    legs.push([rcone([sx * 0.14, 0.125, -0.38], [sx * 0.14, 0.045, -0.345], 0.04, 0.038), 0.02]);
    legs.push([ell([sx * 0.14, 0.034, -0.3], [0.054, 0.034, 0.066]), 0.035]);
    // Shoulder blades
    legs.push([ell([sx * 0.1, 0.6, 0.13], [0.1, 0.13, 0.12]), 0.06]);
  }
  const bodyF = blend([
    [ell([0, 0.5, 0.12], [0.19, 0.2, 0.22]), 0],
    [ell([0, 0.525, -0.1], [0.155, 0.16, 0.2]), 0.1],
    [ell([0, 0.51, -0.3], [0.165, 0.165, 0.17]), 0.1],
    ...legs,
    ...NECKS.map((n): [F3, number] => [rcone(n.a, n.b, n.r1, n.r2), 0.07]),
  ]);
  {
    const geo = surfaceNets(bodyF, [-0.4, -0.03, -0.54], [0.4, 0.98, 0.46], 0.026, (p) => {
      // Rust-red socks: front legs from the wrist and hind legs from the hock down; behind the elbow and the inner thigh are still black
      const sock = sstep(0.165 - p.y, 0, 0.035);
      return cFur.clone().lerp(cRust, sock);
    });
    add(body, geo, M.fur).userData.inkGroup = BODY;
  }
  // Claws: four short dark claws on the front edge of each foot
  {
    const clawGeo = lathe([[0.0005, -0.006], [0.008, -0.004], [0.0085, 0.008], [0.006, 0.022], [0.0005, 0.03]], 6);
    for (const sx of [-1, 1])
      for (const [px, pz, py] of [[0.135, 0.232 + 0.064, 0.036], [0.14, -0.3 + 0.06, 0.034]] as [number, number, number][])
        for (const k of [-1.5, -0.5, 0.5, 1.5]) {
          const x = sx * px + k * 0.022;
          const hit = marchF(bodyF, v3(x, py + 0.005, pz - 0.05), v3(0, -0.15, 1));
          const cg = group(body, [hit.p.x, hit.p.y, hit.p.z]);
          orient(cg, v3(k * 0.08, -0.55, 1), UP);
          add(cg, clawGeo, M.claw);
        }
  }

  // ── Heads: three of the same shape, with the local origin at the center of the skull and +z toward the muzzle tip ──
  const headF = blend([
    [ell([0, 0, -0.012], [0.1, 0.096, 0.11]), 0],
    [ell([0, 0.004, -0.06], [0.084, 0.084, 0.076]), 0.05],
    [rcone([0, -0.002, 0.05], [0, -0.028, 0.232], 0.062, 0.038), 0.06],
    [rcone([0, -0.04, 0.05], [0, -0.056, 0.214], 0.058, 0.034), 0.035],
    [ell([0.066, -0.034, 0.0], [0.05, 0.055, 0.062]), 0.05],
    [ell([-0.066, -0.034, 0.0], [0.05, 0.055, 0.062]), 0.05],
    [ell([0.05, 0.036, 0.064], [0.04, 0.026, 0.042]), 0.035],
    [ell([-0.05, 0.036, 0.064], [0.04, 0.026, 0.042]), 0.035],
  ]);
  // Coloring (black-and-tan): the rust red follows only the two sides of the muzzle, the chin and the throat, with a small patch on the cheek; the nose bridge, forehead, around the eyes and the sides of the head are black.
  // The underside of the upper jaw (visible when the mouth opens) is deep red
  const cGum = col(0x5a1c1c);
  const headGeo = surfaceNets(headF, [-0.145, -0.135, -0.165], [0.145, 0.135, 0.305], 0.0145, (p, n) => {
    // The boundary on the side of the muzzle runs from the nose tip slanting back and up to below the mouth corner; the cheek patch is a small round spot behind the mouth corner
    const lip = -0.03 + 0.012 * sstep(p.z, 0.2, 0.05);
    const muzzle = sstep(lip - p.y, -0.004, 0.008) * sstep(p.z, 0.03, 0.07);
    const cheek = 1 - sstep(Math.hypot(Math.abs(p.x) - 0.07, (p.y + 0.058) * 1.1, (p.z - 0.02) * 0.9), 0.028, 0.04);
    const throat = sstep(-n.y, 0.35, 0.6) * sstep(p.z, -0.06, -0.02);
    const rust = Math.max(muzzle, cheek, throat);
    const gum = sstep(-n.y, 0.55, 0.8) * sstep(p.z, 0.02, 0.05) * (1 - sstep(Math.abs(p.x), 0.03, 0.045));
    return cFur.clone().lerp(cRust, rust).lerp(cGum, gum);
  });
  // Lower jaw: from the joint under the ear forward to the chin, with a deep red gum along the upper edge and rust red on the outside
  const jawGeo = paint(
    loft([v3(0, 0.004, -0.02), v3(0, -0.006, 0.07), v3(0, -0.018, 0.15), v3(0, -0.024, 0.2)], curveTable([[0, 0, 0], [0.08, 0.042, 0.024], [0.5, 0.04, 0.024], [0.9, 0.024, 0.019], [1, 0, 0]]), { segs: 16, radial: 12 }),
    (p, n) => cRust.clone().lerp(cRustDk, sstep(-n.y, 0.3, 0.8) * 0.4).lerp(cGum, sstep(n.y, 0.55, 0.8) * sstep(p.z, 0.0, 0.03)),
  );
  const fangGeo = lathe([[0.0005, -0.032], [0.0045, -0.022], [0.0075, -0.006], [0.0072, 0.006], [0.0005, 0.008]], 6);
  const lowFangGeo = lathe([[0.0005, -0.01], [0.0058, -0.008], [0.006, 0.002], [0.004, 0.014], [0.0005, 0.02]], 6);

  const ER = 0.016;
  const eyeball = new THREE.SphereGeometry(ER, 14, 8, 0, PI * 2, 0, PI / 2).rotateX(PI / 2);
  const lidUp = lidLite(ER + 0.002, ER + 0.0065, PI / 2, true);
  const lidLow = lidLite(ER + 0.0015, ER + 0.0055, PI / 2, false);
  const hiGeo = new THREE.SphereGeometry(ER * 0.2, 8, 6);
  const UP_OPEN = 0.85;
  const LO_OPEN = 0.7;

  interface Head {
    g: THREE.Group;
    yaw: number;
    pitch: number;
    jaw: THREE.Group;
    jaw0: number;
    phase: number;
  }
  const heads: Head[] = [];
  const lids: { g: THREE.Group; open: number; shut: number; phase: number }[] = [];
  const glints: THREE.Object3D[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const faces: THREE.Group[] = [];
  const mouths: THREE.Group[] = [];
  const DEF = [
    // Middle: looks straight ahead calmly, mouth slightly open; left (+x): ears up and alert, mouth closed; right (-x): mouth half open, the fire in its throat smoldering
    { pos: [0, 0.975, 0.37] as V3, yaw: 0, pitch: -0.05, s: 1.08, jaw0: 0.1, ear: 0.0 },
    { pos: [0.31, 0.855, 0.3] as V3, yaw: 0.62, pitch: -0.02, s: 0.94, jaw0: 0.03, ear: 0.18 },
    { pos: [-0.31, 0.85, 0.3] as V3, yaw: -0.62, pitch: 0.02, s: 0.94, jaw0: 0.3, ear: -0.05 },
  ];
  DEF.forEach((d, hi) => {
    const hg = group(body, d.pos);
    hg.rotation.order = 'YXZ';
    hg.rotation.set(d.pitch, d.yaw, 0);
    hg.scale.setScalar(d.s);
    add(hg, headGeo, M.fur).userData.inkGroup = HEADS[hi];
    // Ears: tall pointed upright ears, rust-red ear cups in front (recessed), and the back in the same fur color
    for (const sx of [-1, 1]) {
      const base = v3(sx * 0.058, 0.066, -0.034);
      const U = v3(sx * 0.28, 1, -0.16 + d.ear).normalize();
      const Fw = v3(sx * 0.42, 0.05, 1).normalize();
      Fw.addScaledVector(U, -Fw.dot(U)).normalize();
      const W = new THREE.Vector3().crossVectors(U, Fw).multiplyScalar(-sx).normalize();
      const Lh = 0.16;
      const half = (v: number) => 0.037 * Math.pow(1 - v, 0.85) * (1 + 0.22 * Math.sin(PI * Math.min(1, v * 1.3))) + 0.0025;
      const geo = thickSheet(
        6,
        7,
        (u, v) => {
          const q = 2 * u - 1;
          const cup = -0.017 * (1 - q * q) * (1 - 0.75 * v) - 0.022 * v * v;
          return base.clone().addScaledVector(U, v * Lh).addScaledVector(W, q * half(v)).addScaledVector(Fw, cup);
        },
        (u, v) => 0.013 * (1 - 0.55 * v),
        Fw,
        (u, v, side) => (side > 0 ? cRustDk.clone().lerp(cFur, sstep(Math.abs(2 * u - 1), 0.55, 0.85) + sstep(v, 0.8, 0.95) * 0.5) : cFur.clone()),
      );
      add(hg, geo, M.fur).userData.inkGroup = HEADS[hi];
    }
    // Nose: shiny black, sitting over the muzzle tip
    add(hg, new THREE.SphereGeometry(1, 14, 10), M.nose, [0, -0.018, 0.262], [0.25, 0, 0], [0.032, 0.022, 0.024]);
    // Upper canines: hanging from the upper lip, covering the outside of the lower jaw
    for (const sx of [-1, 1]) add(hg, fangGeo, M.fang, [sx * 0.031, -0.074, 0.19], [-0.12, 0, sx * 0.1]);
    // Lower jaw and the fire in the mouth
    const jaw = group(hg, [0, -0.07, -0.01], [d.jaw0, 0, 0]);
    add(jaw, jawGeo, M.fur).userData.inkGroup = JAWS[hi];
    add(jaw, new THREE.SphereGeometry(1, 14, 8), M.ember, [0, 0.012, 0.1], [0, 0, 0], [0.028, 0.012, 0.08]);
    for (const sx of [-1, 1]) add(jaw, lowFangGeo, M.fang, [sx * 0.024, 0.006, 0.17], [0.15, 0, -sx * 0.1]);
    mouths.push(group(hg, [0, -0.085, 0.2]));
    heads.push({ g: hg, yaw: d.yaw, pitch: d.pitch, jaw, jaw0: d.jaw0, phase: hi * 2.1 });

    // Eyes: a dog's small dark eyes, sunk into the sockets under the brow bone, with one small highlight; both eyes look the same way, forward
    for (const sx of [-1, 1]) {
      const hit = marchF(headF, v3(sx * 0.03, 0.004, 0.0), v3(sx * 0.55, -0.02, 1));
      const c = hit.p.clone().addScaledVector(hit.n, -ER * 0.5);
      const eg = group(hg, [c.x, c.y, c.z]);
      const dir = hit.n.clone().lerp(v3(sx * 0.35, 0.05, 1).normalize(), 0.45).normalize();
      const r = new THREE.Vector3().crossVectors(UP, dir).normalize();
      const u = new THREE.Vector3().crossVectors(dir, r);
      eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, dir));
      // Gaze: convert the head's straight-ahead direction into the eye's coordinates, and turn the iris a little more than halfway
      const fwdLocal = v3(0, 0.02, 1).normalize().applyQuaternion(eg.quaternion.clone().invert());
      const q0 = new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(Z, fwdLocal), 0.7);
      // The eyes are not turned separately: the anchors hang directly on the head, so the eyeball, iris and highlight can be merged into the head (mesh budget).
      // The highlight is on the inner side of the eyelid (its radius is less than the eyelid's), so the eyelid covers it when blinking, with no switch needed
      const gaze = group(eg);
      gaze.quaternion.copy(q0);
      add(gaze, eyeball, M.eye);
      add(gaze, lightDecal(ellipsePts(0.55, 0.58, 0.02, 12), ER + 0.0006, 1), M.iris);
      const hl = add(gaze, hiGeo, M.hi, [-sx * ER * 0.28, ER * 0.36, ER * 0.9], [0, 0, 0], [1, 1, 0.5]);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
      const ea = v3(0, 0, ER).applyQuaternion(eg.quaternion.clone().multiply(q0)).add(c);
      eyeAnchors.push(group(hg, [ea.x, ea.y, ea.z]));
      const slant = new THREE.Quaternion().setFromAxisAngle(Z, sx * 0.14);
      const lidG = group(eg);
      lidG.quaternion.copy(slant);
      const upper = group(lidG, [0, 0, 0], [-UP_OPEN, 0, 0]);
      add(upper, lidUp, M.furPlain).userData.inkGroup = HEADS[hi];
      const lower = group(hg, [c.x, c.y, c.z]);
      lower.quaternion.copy(eg.quaternion).multiply(slant).multiply(new THREE.Quaternion().setFromAxisAngle(X, PI + LO_OPEN));
      add(lower, lidLow, M.furPlain).userData.inkGroup = HEADS[hi];
      lids.push({ g: upper, open: -UP_OPEN, shut: LO_OPEN - 0.02, phase: hi * 1.3 });
    }
    faces.push(group(hg, [0, 0.0, 0.16]));
  });

  // ── Collars: on each neck a ring of ancient bronze band gone green with verdigris, with a row of ancient bronze rivets; placed at the boundary between head and neck, covering the seam ──
  const collars: { c: THREE.Vector3; dir: THREE.Vector3; r: number }[] = [];
  root.updateMatrixWorld(true);
  NECKS.forEach((n, i) => {
    const a = v3(...n.a);
    const b = v3(...n.b);
    const dir = b.clone().sub(a).normalize();
    const L = b.distanceTo(a);
    // Walking down from the top of the neck, find where the neck leaves the head
    const inv = heads[i].g.matrixWorld.clone().invert();
    let t = 1;
    const q = new THREE.Vector3();
    for (; t > 0.3; t -= 0.01) {
      q.copy(a).lerp(b, t);
      // It counts only once the outer edge of the neck (the side going back and down) has all left the head
      const rr = lerp(n.r1, n.r2, t);
      let inside = false;
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * PI * 2;
        const side = new THREE.Vector3().crossVectors(dir, X).normalize();
        const side2 = new THREE.Vector3().crossVectors(dir, side).normalize();
        const p = q.clone().addScaledVector(side, Math.cos(ang) * rr).addScaledVector(side2, Math.sin(ang) * rr).applyMatrix4(inv);
        if (headF(p.x, p.y, p.z) < 0) inside = true;
      }
      if (!inside) break;
    }
    const tc = Math.min(1, t + 0.02 / L);
    const c = a.clone().lerp(b, tc);
    const r = lerp(n.r1, n.r2, tc) + 0.003;
    collars.push({ c, dir, r });
    const cg = group(body, [c.x, c.y, c.z]);
    orient(cg, dir, v3(c.x, 0, 1));
    const w = 0.036;
    const th = 0.017;
    const prof: [number, number][] = [
      [r, -w / 2 + 0.004], [r + 0.004, -w / 2], [r + th - 0.005, -w / 2], [r + th, -w / 2 + 0.005], [r + th, w / 2 - 0.005], [r + th - 0.005, w / 2], [r + 0.004, w / 2], [r, w / 2 - 0.004],
    ];
    const ring = lathe([...prof, prof[0]], 28);
    add(cg, ring, M.patina).userData.inkGroup = COLLAR;
    for (let k = 0; k < 7; k++) {
      const ang = (k / 7) * PI * 2;
      const nrm = v3(Math.sin(ang), 0, Math.cos(ang));
      const sg = group(cg, [nrm.x * (r + th - 0.001), 0, nrm.z * (r + th - 0.001)]);
      sg.quaternion.setFromUnitVectors(UP, nrm);
      add(sg, studGeo, M.bronze, [0, 0, 0], [0, 0, 0], [0.0085, 0.006, 0.0085]);
    }
  });

  // ── Key: a big ancient bronze key to the tomb door hangs from the small ring directly in front of the middle collar, leaning slantwise against the front of the throat ──
  const keyPivot = new THREE.Group();
  {
    const { c, dir, r } = collars[0];
    const fw = v3(0, 0, 1).addScaledVector(dir, -dir.z).normalize();
    const p = c.clone().addScaledVector(fw, r + 0.017).addScaledVector(dir, -0.012);
    const hanger = group(body, [p.x, p.y, p.z]);
    add(hanger, new THREE.TorusGeometry(0.013, 0.0045, 6, 14), M.bronze, [0, -0.008, 0.004], [0, PI / 2, 0]);
    keyPivot.position.set(p.x, p.y - 0.018, p.z + 0.006);
    body.add(keyPivot);
    const key = group(keyPivot, [0, 0, 0], [-0.3, 0, 0]);
    key.scale.setScalar(1.45);
    add(key, new THREE.TorusGeometry(0.02, 0.0065, 6, 16), M.bronze, [0, -0.022, 0]);
    add(key, new THREE.CylinderGeometry(0.0065, 0.0065, 0.1, 8), M.bronze, [0, -0.09, 0]);
    add(key, new THREE.TorusGeometry(0.0095, 0.004, 6, 12), M.bronze, [0, -0.048, 0], [PI / 2, 0, 0]);
    add(key, rbox(0.018, 0.012, 0.0075, 0.002, 1), M.bronze, [0.012, -0.124, 0]);
    add(key, rbox(0.012, 0.009, 0.0075, 0.002, 1), M.bronze, [0.009, -0.106, 0]);
    add(key, new THREE.SphereGeometry(0.008, 8, 6), M.bronze, [0, -0.141, 0]);
  }

  // ── Broken chain: a length of ancient bronze chain trails from the ring behind the middle collar, hanging over the shoulders and back to the left flank, the last link split open ──
  {
    const { c, dir, r } = collars[0];
    const bw = v3(0, 0, -1).addScaledVector(dir, dir.z).normalize();
    const start = c.clone().addScaledVector(bw, r + 0.012);
    const route: { p: THREE.Vector3; t: THREE.Vector3 }[] = [];
    const guide = [v3(0.0, 0.8, 0.16), v3(0.02, 0.74, 0.08), v3(0.045, 0.73, 0.0), v3(0.08, 0.72, -0.07), v3(0.12, 0.7, -0.12), v3(0.16, 0.64, -0.15), v3(0.185, 0.57, -0.16)];
    const pts = [start];
    for (const gp of guide) {
      const axis = v3(0, gp.y < 0.66 ? 0.52 : 0.45, gp.z);
      const out = gp.clone().sub(axis).normalize();
      const h = marchF(bodyF, axis.clone().addScaledVector(out, 0.6), out.clone().negate());
      pts.push(h.p.addScaledVector(h.n, 0.009));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const N = 9;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N;
      route.push({ p: curve.getPointAt(u), t: curve.getTangentAt(u) });
    }
    const link = new THREE.TorusGeometry(0.019, 0.0058, 6, 12).scale(1, 1.45, 1);
    const broken = new THREE.TorusGeometry(0.019, 0.0058, 6, 12, PI * 1.55).scale(1, 1.45, 1);
    route.forEach(({ p, t }, i) => {
      const n = gradF(bodyF, p.x, p.y, p.z, 5e-4, new THREE.Vector3());
      const lg = group(body, [p.x, p.y, p.z]);
      // The long axis of a chain link follows the chain; odd links lie flat against the back and even links stand up
      orient(lg, t, i % 2 ? n : new THREE.Vector3().crossVectors(t, n));
      add(lg, i === N - 1 ? broken : link, M.bronze, [0, 0, 0], [0, 0, i === N - 1 ? 0.9 : 0]);
    });
    add(body, new THREE.TorusGeometry(0.014, 0.0048, 6, 12), M.bronze, [start.x, start.y, start.z], [0, PI / 2, 0]);
  }

  // ── Tail: curving out from the rump backward and up, with a tuft of netherfire burning at the tip (from the front the fire hides behind the middle head, so it is not read as a flame crown on the head) ──
  const tailG = group(body, [0, 0.56, -0.4]);
  const tailPts = [v3(0, 0, 0.04), v3(0, 0.045, -0.08), v3(0, 0.12, -0.18), v3(0, 0.2, -0.265), v3(0, 0.26, -0.31)];
  add(
    tailG,
    paint(loft(tailPts, curveTable([[0, 0, 0], [0.04, 0.05, 0.05], [0.25, 0.046, 0.046], [0.75, 0.032, 0.032], [0.96, 0.024, 0.024], [1, 0, 0]]), { segs: 22, radial: 10, side: X }), () => cFur),
    M.fur,
  ).userData.inkGroup = TAIL;
  const flameG = group(tailG, [0, 0.25, -0.307]);
  const tongues: { g: THREE.Group; ph: number }[] = [];
  {
    // Flame core: a yellow teardrop wrapping the tail tip
    add(flameG, lathe([[0.0005, -0.03], [0.026, -0.022], [0.038, 0.0], [0.036, 0.03], [0.022, 0.062], [0.0005, 0.085]], 12), M.core).userData.inkGroup = CORE;
    // Outer flame: three tongues of flame shooting up (the middle the tallest) and one going back, thin at the bottom and narrower than the core, with the core's yellow showing through from below
    const tongue = (h: number, w: number) =>
      loft([v3(0, 0, 0), v3(0, h * 0.35, 0.008), v3(0, h * 0.7, -0.01), v3(0, h, 0.004)], curveTable([[0, 0, 0], [0.12, w * 0.8, w * 0.7], [0.4, w, w * 0.85], [0.75, w * 0.55, w * 0.45], [1, 0, 0]]), { segs: 12, radial: 10, side: X });
    for (const [x, z, h, w, rz, rx, ph] of [
      [0, 0.004, 0.2, 0.036, 0, -0.08, 0],
      [0.022, 0.0, 0.13, 0.026, -0.5, 0.05, 1.7],
      [-0.022, 0.0, 0.14, 0.026, 0.5, 0.0, 3.1],
      [0, -0.02, 0.15, 0.028, 0, -0.5, 4.4],
    ] as number[][]) {
      const tg = group(flameG, [x, 0.012, z], [rx, 0, rz]);
      add(tg, tongue(h, w), M.flame).userData.inkGroup = FLAME;
      tongues.push({ g: tg, ph });
    }
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle action: breathing, the three heads turning in turn to their own bearings, blinking, the right head panting fire, the tail flame flickering, the key swaying lightly ──
  const act = { glow: 0, bite: 0 };
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    const br = Math.sin(t * 1.9);
    body.scale.set(1 + br * 0.006, 1 + br * 0.008, 1 + br * 0.004);
    const bite = act.bite;
    heads.forEach((h, i) => {
      // Each head slowly patrols on its own and returns to its own bearing after looking
      const look = Math.sin(t * 0.45 + h.phase) * 0.16 + Math.sin(t * 0.23 + h.phase * 1.7) * 0.06;
      const nod = Math.sin(t * 0.7 + h.phase) * 0.03;
      const b = clamp(bite * 3 - i, 0, 1);
      const lunge = Math.sin(b * PI);
      h.g.rotation.set(h.pitch + nod + act.glow * 0.12 + lunge * 0.15, h.yaw + look * (i === 0 ? 0.6 : 1), 0);
      const pant = i === 2 ? (0.5 + 0.5 * Math.sin(t * 3.2)) * 0.06 : 0;
      h.jaw.rotation.x = h.jaw0 + pant + act.glow * 0.12 + lunge * 0.5;
    });
    // Blinking: the three heads staggered
    for (const l of lids) {
      const bt = (t + l.phase) % 4.1;
      const bk = (x: number) => (x > 0 && x < 0.2 ? Math.min(1, Math.sin((x / 0.2) * PI) * 1.3) : 0);
      l.g.rotation.x = lerp(l.open, l.shut, bk(bt - 3.7));
    }
    tailG.rotation.set(Math.sin(t * 0.8) * 0.04, Math.sin(t * 1.1) * 0.1, Math.sin(t * 1.1 - 0.4) * 0.05);
    for (const tg of tongues) {
      const f = Math.sin(t * 7 + tg.ph) * 0.5 + Math.sin(t * 11.3 + tg.ph * 2) * 0.5;
      tg.g.scale.set(1 - f * 0.06, 1 + f * 0.12 + act.glow * 0.25, 1 - f * 0.06);
    }
    flameG.rotation.z = Math.sin(t * 1.1 - 0.9) * 0.12;
    keyPivot.rotation.set(Math.sin(t * 1.9 - 0.6) * 0.04, 0, Math.sin(t * 0.9) * 0.06);
    const gl = act.glow;
    if (gl !== lastGlow) {
      lastGlow = gl;
      M.ember.emissiveIntensity = 0.75 + gl * 0.5;
      M.flame.emissiveIntensity = 0.85 + gl * 0.3;
    }
  };
  update(0);

  const rig = {
    head: faces[0],
    eyes: eyeAnchors,
    anchors: { mouth: mouths[0], mouthL: mouths[1], mouthR: mouths[2], key: keyPivot, flame: group(flameG, [0, 0.2, 0]) },
  };
  mergeStatic(root, {
    owners: [body, tailG, flameG, keyPivot, ...tongues.map((t) => t.g), ...heads.flatMap((h) => [h.g, h.jaw]), ...lids.map((l) => l.g)],
    twins: [
      [M.furPlain, M.fur],
      [M.iris, M.gem0],
      [M.eye, M.gem0],
      [M.nose, M.gloss0],
      [M.fang, M.gloss0],
    ],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.6, 0.0), radius: 0.82 };
}
