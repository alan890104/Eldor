// The parts bin of Tidesong Isles: shared template geometry (unit size, scaled by a matrix when placed),
// local coordinate frames, and poles and ropes between two points.
// Templates are built only once; a batch rewrites the vertices directly when it meets a non-indexed template,
// so everything is added through put() (copying first when necessary).

import * as THREE from 'three';
import type { PropBatch } from '../../../arenaKit.ts';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Unit templates: box side length 1, cylinder / cone radius 1 height 1, sphere radius 1 */
export const T = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl4: new THREE.CylinderGeometry(1, 1, 1, 4),
  cyl5: new THREE.CylinderGeometry(1, 1, 1, 5),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
  /** A cylinder narrow at the top and wide at the bottom (clay jars, flowerpots, trunks) */
  taper8: new THREE.CylinderGeometry(0.72, 1, 1, 8),
  pot: new THREE.CylinderGeometry(1, 0.7, 1, 8),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone5: new THREE.ConeGeometry(1, 1, 5),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  cone12: new THREE.ConeGeometry(1, 1, 12),
  sphere: new THREE.SphereGeometry(1, 8, 6),
  sphere12: new THREE.SphereGeometry(1, 12, 8),
  /** Upper hemisphere (domes, bushes) */
  dome: new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  dode0: new THREE.DodecahedronGeometry(1, 0),
  oct: new THREE.OctahedronGeometry(1),
  /** Triangular prism: extends along z, base on y = 0, width 1, height 1 (gables, roof ridges) */
  prism: prismGeo(),
  /** Half cylinder: extends along z, radius 1, flat side down (arch tops, barrel tiles) */
  halfCyl: new THREE.CylinderGeometry(1, 1, 1, 8, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2),
  /** Torus (lifebuoys, rope coils, wreaths) */
  torus: new THREE.TorusGeometry(1, 0.3, 5, 12),
  ring: new THREE.TorusGeometry(1, 0.12, 4, 14),
  disc: new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2),
  /** A long thin blade: along +y, base at 0, width 1, thickness 0.12 */
  blade: new THREE.ConeGeometry(0.5, 1, 4, 1).translate(0, 0.5, 0).scale(1, 1, 0.24),
  /** Flat leaf (banana leaf, monstera): a long ellipse on the xz plane, its base at the origin and growing along +z */
  leaf: leafGeo(),
};

function prismGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0);
  s.lineTo(0.5, 0);
  s.lineTo(0, 1);
  s.lineTo(-0.5, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  return g;
}

function leafGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.55, 0.3, 0.42, 0.72);
  s.quadraticCurveTo(0.2, 1.0, 0, 1.05);
  s.quadraticCurveTo(-0.2, 1.0, -0.42, 0.72);
  s.quadraticCurveTo(-0.55, 0.3, 0, 0);
  const g = new THREE.ShapeGeometry(s, 3);
  // Lies flat on the xz plane, growing along +z; both faces must be visible, so copy it once more and flip it
  g.rotateX(Math.PI / 2);
  const back = g.clone();
  back.scale(1, -1, 1);
  const idx = back.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i);
    idx.setX(i, idx.getX(i + 2));
    idx.setX(i + 2, a);
  }
  const pos = new Float32Array([...(g.attributes.position.array as Float32Array), ...(back.attributes.position.array as Float32Array)]);
  const n = g.attributes.position.count;
  const nrm = new Float32Array(pos.length);
  for (let i = 0; i < n; i++) {
    nrm[i * 3 + 1] = 1;
    nrm[(n + i) * 3 + 1] = -1;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setIndex([...Array.from(g.index!.array), ...Array.from(idx.array).map((k) => k + n)]);
  return out;
}

/** Add a template to a batch (the batch copies it itself, so the template can be reused indefinitely) */
export function put(b: PropBatch, geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4, outline = true): void {
  b.add(geo, color, m, outline);
}
export function putGlow(b: PropBatch, geo: THREE.BufferGeometry, color: number, m: THREE.Matrix4): void {
  b.glow(geo, color, m);
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Translation + non-uniform scale + rotation (Euler angles XYZ) */
export function MX(x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

/**
 * Local coordinate frame: origin (x, y, z), facing face (0 = +z).
 * L(lx, ly, lz, sx, sy, sz, rx, ry, rz) returns a world matrix; p(lx, ly, lz) returns a world-coordinate point.
 * Rotation applies the local rx / ry / rz first, then turns to the frame's facing.
 */
export class Frame {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly face: number;
  readonly c: number;
  readonly s: number;
  constructor(x: number, y: number, z: number, face: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.face = face;
    this.c = Math.cos(face);
    this.s = Math.sin(face);
  }
  p(lx: number, ly: number, lz: number): THREE.Vector3 {
    return V(this.x + this.c * lx + this.s * lz, this.y + ly, this.z - this.s * lx + this.c * lz);
  }
  L(lx: number, ly: number, lz: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0): THREE.Matrix4 {
    const q = new THREE.Quaternion().setFromEuler(_e.set(0, this.face, 0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')));
    return new THREE.Matrix4().compose(this.p(lx, ly, lz), q, _s.set(sx, sy, sz));
  }
  /** Child frame: the local (lx, lz) is the origin, then rotated by ry */
  sub(lx: number, ly: number, lz: number, ry: number): Frame {
    const p = this.p(lx, ly, lz);
    return new Frame(p.x, p.y, p.z, this.face + ry);
  }
}

const UP = V(0, 1, 0);
/** A pole between two points (template cylinder, rad is the radius) */
export function rod(b: PropBatch, a: THREE.Vector3, c: THREE.Vector3, rad: number, col: number, geo = T.cyl5, outline = true): void {
  const d = _p.subVectors(c, a);
  const len = d.length();
  if (len < 1e-4) return;
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
  const m = new THREE.Matrix4().compose(V((a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2), q, V(rad, len, rad));
  put(b, geo, col, m, outline);
}

/** A sagging rope: a -> c, hanging down by sag in the middle; n segments */
export function rope(b: PropBatch, a: THREE.Vector3, c: THREE.Vector3, sag: number, rad: number, col: number, n = 6): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(a.clone().lerp(c, t).add(V(0, -Math.sin(t * Math.PI) * sag, 0)));
  }
  for (let i = 0; i < n; i++) rod(b, pts[i], pts[i + 1], rad, col, T.cyl4, false);
  return pts;
}

export { V };
