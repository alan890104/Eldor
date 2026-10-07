// Geometry helpers and assembly functions shared by the model lab: beveled boxes, trapezoid tapering, extruded beveled plates, arch-stone sectors, framed outlines, lathe bodies, brilliant-cut gems,
// plus spherical decals (pupils, mouths), spherical caps, eyelid shells with thickness, bendable conical tentacles, organic forms lofted along a curve (torso, limbs, tail) and fur tufts.
// Hard parts use these to get real thickness and bevels; seams come from separate parts, not from textures or black lines.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';

export type V3 = [number, number, number];
export const PI = Math.PI;

/** Evolution stage: 1 hatchling, 2 growth, 3 final form */
export type LabStage = 1 | 2 | 3;

/** Lab builder: assembles a different form for each evolution stage (merely getting bigger does not count, see spirit-model-polish <Evolution stage>) */
export type LabBuilder = (stage: LabStage) => LabModel;

export interface LabModel {
  root: THREE.Group;
  update(t: number, dt: number): void;
  /** The center the camera aims at and the radius it covers */
  center: THREE.Vector3;
  radius: number;
  /** Anchors for hooking into the game (optional); if absent the shell uses estimated values */
  rig?: LabRig;
  /**
   * Action weights for performances (0-1, optional): the ultimate and battle actions tween these values, and the model's update makes the action according to its own structure
   * (for example wake opens the eyes, roar opens the mouth and tilts the head back, glow makes a gem light up). The names are written in the <Action table> of the model file header.
   */
  act?: Record<string, number>;
}

/** Anchors given to battle, ultimates and openings when hooked into the game. They are nodes hung on the model and moving with it; empty groups are recommended, not parts that would be scaled */
export interface LabRig {
  /** Head: close-up framing, things the ultimate emits from the head */
  head?: THREE.Object3D;
  /** The center of each eye: the eye-light */
  eyes?: THREE.Object3D[];
  /** Other named anchors (mouth, hornTip, shell...), fetched by scripts with Creature.anchor(name) */
  anchors?: Record<string, THREE.Object3D>;
}

// ───────────────────────── Geometry helpers ─────────────────────────

/** Beveled box; r is automatically clamped to within half the shortest edge */
export function rbox(w: number, h: number, d: number, r = 0.03, seg = 3): THREE.BufferGeometry {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  return new RoundedBoxGeometry(w, h, d, seg, rr);
}

/** Trapezoid tapering along the y axis (separate x and z ratios for the top and bottom), recomputing smooth normals */
export function taper(g: THREE.BufferGeometry, top: [number, number], bot: [number, number] = [1, 1]): THREE.BufferGeometry {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - bb.min.y) / (bb.max.y - bb.min.y);
    p.setX(i, p.getX(i) * THREE.MathUtils.lerp(bot[0], top[0], t));
    p.setZ(i, p.getZ(i) * THREE.MathUtils.lerp(bot[1], top[1], t));
  }
  return smooth(g);
}

/** Recompute normals after merging duplicate vertices (the meshes of a beveled box's faces are separate at the seams) */
export function smooth(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-5);
  m.computeVertexNormals();
  return m;
}

/** Extruded beveled plate: shape in the xy plane, the thickness along z, centered */
export function slab(shape: THREE.Shape, depth: number, bevel: number, curveSegments = 10): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Polygon outline */
export function outline(pts: [number, number][]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

/** Annular sector (arch stone): center at the origin, a0-a1 radians */
export function wedge(rIn: number, rOut: number, a0: number, a1: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn);
  s.lineTo(Math.cos(a0) * rOut, Math.sin(a0) * rOut);
  s.absarc(0, 0, rOut, a0, a1, false);
  s.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
  s.absarc(0, 0, rIn, a1, a0, true);
  return s;
}

/** Rounded-rectangle frame (edging): the outer outline minus the inner one */
export function frameShape(ow: number, oh: number, iw: number, ih: number, r: number): THREE.Shape {
  const rr = (w: number, h: number, rad: number, path: THREE.Path) => {
    const x = -w / 2, y = -h / 2;
    path.moveTo(x + rad, y);
    path.lineTo(x + w - rad, y);
    path.quadraticCurveTo(x + w, y, x + w, y + rad);
    path.lineTo(x + w, y + h - rad);
    path.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    path.lineTo(x + rad, y + h);
    path.quadraticCurveTo(x, y + h, x, y + h - rad);
    path.lineTo(x, y + rad);
    path.quadraticCurveTo(x, y, x + rad, y);
  };
  const s = new THREE.Shape();
  rr(ow, oh, r, s);
  const hole = new THREE.Path();
  rr(iw, ih, r * 0.6, hole);
  s.holes.push(hole);
  return s;
}

/** Lathe body (an outline revolved about the y axis) */
export function lathe(profile: [number, number][], seg: number): THREE.BufferGeometry {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

/** Round brilliant cut: crown, girdle, pavilion; split into triangles that share no vertices, each face with its own normal, so it is a series of facets */
export function brilliant(r: number, crown: number, pavilion: number, facets = 8): THREE.BufferGeometry {
  const g = lathe([[0.001, -pavilion], [r * 0.55, -pavilion * 0.45], [r, 0], [r, crown * 0.18], [r * 0.62, crown], [0.001, crown]], facets);
  const f = g.toNonIndexed();
  f.computeVertexNormals();
  return f;
}

/** A simple pseudo-random, so the skew of the stones is the same every time */
export function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// ───────────────────────── Spheres and organic forms ─────────────────────────

/**
 * A planar figure on a sphere: the shape's x is longitude and y is latitude (radians, centered on +z), laid onto a sphere of radius r.
 * After triangulation each triangle is cut three more times (split into four), so when laid onto the sphere no flat chord faces sink into it.
 */
export function sphereDecal(pts: [number, number][], r: number, lat0 = 0): THREE.BufferGeometry {
  const flat = new THREE.ShapeGeometry(outline(pts), 1).toNonIndexed();
  const src = flat.attributes.position as THREE.BufferAttribute;
  let tris: [number, number][][] = [];
  for (let i = 0; i < src.count; i += 3) tris.push([0, 1, 2].map((k) => [src.getX(i + k), src.getY(i + k)] as [number, number]));
  for (let l = 0; l < 3; l++) {
    const next: [number, number][][] = [];
    for (const [a, b, c] of tris) {
      const m = (u: [number, number], v: [number, number]): [number, number] => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
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

/** A spherical cap centered on +z (iris) */
export function cap(r: number, ang: number): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, 48, 10, 0, PI * 2, 0, ang).rotateX(PI / 2);
}

/** Eyelid with thickness: a spherical shell with +y as the top, covering from the top to the lip angle, the edge a round lip */
export function lidGeometry(ri: number, ro: number, lip: number): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(a)), ri * Math.cos(a)));
  }
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < 8; i++) {
    const b = (i / 8) * PI;
    const rad = c - Math.cos(b) * w;
    const tan = Math.sin(b) * w;
    prof.push(new THREE.Vector2(rad * Math.sin(lip) + tan * Math.cos(lip), rad * Math.cos(lip) - tan * Math.sin(lip)));
  }
  for (let i = N; i >= 0; i--) {
    const a = (i / N) * lip;
    prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(a)), ro * Math.cos(a)));
  }
  return smooth(new THREE.LatheGeometry(prof, 56));
}

/** Bendable conical tentacle: remembers each vertex's position on the tube (0 at the root to 1 at the end), and bends by angle every frame */
export function tentacleTube(pts: THREE.Vector3[], rad: (t: number) => number, segs = 36, radial = 12) {
  const path = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(path, segs, 1, radial, false);
  const p = g.attributes.position as THREE.BufferAttribute;
  const t = new Float32Array(p.count);
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const ti = Math.floor(i / (radial + 1)) / segs;
    t[i] = ti;
    path.getPointAt(ti, c);
    v.fromBufferAttribute(p, i).sub(c).multiplyScalar(rad(ti)).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  g.boundingSphere!.radius += 0.2;
  const rest = Float32Array.from(p.array as Float32Array);
  const restN = Float32Array.from((g.attributes.normal as THREE.BufferAttribute).array as Float32Array);
  return { geo: g, t, rest, restN, tip: path.getPointAt(1) };
}

/** A one-dimensional smooth interpolation table: rows are [t, value...], t ascending; interpolated with Catmull-Rom, so the form does not fold into ridges at the table nodes. Non-negative values never overshoot to negative */
export function curveTable(rows: number[][]): (t: number) => number[] {
  const n = rows.length;
  return (t: number) => {
    let i = 0;
    while (i < n - 2 && t > rows[i + 1][0]) i++;
    const r0 = rows[Math.max(0, i - 1)];
    const r1 = rows[i];
    const r2 = rows[i + 1];
    const r3 = rows[Math.min(n - 1, i + 2)];
    const u = THREE.MathUtils.clamp((t - r1[0]) / (r2[0] - r1[0]), 0, 1);
    const out: number[] = [];
    for (let k = 1; k < r1.length; k++) out.push(THREE.MathUtils.clamp(0.5 * (2 * r1[k] + (-r0[k] + r2[k]) * u + (2 * r0[k] - 5 * r1[k] + 4 * r2[k] - r3[k]) * u * u + (-r0[k] + 3 * r1[k] - 3 * r2[k] + r3[k]) * u * u * u), Math.min(r1[k], r2[k], 0), Infinity));
    return out;
  };
}

/**
 * An organic form lofted along a curve: prof(t) returns [width radius, height radius, upward offset], with t the arc-length position from 0 to 1.
 * The width direction is by default the cross product of the tangent and up (for a body it is left and right); when the whole curve lies in one plane (legs, tail), give side and the width direction is fixed toward it.
 * The height direction is perpendicular to both the width and the tangent. Giving 0 for the radius at the two ends closes them into round heads or points.
 */
export function loft(pts: THREE.Vector3[], prof: (t: number) => number[], o: { segs?: number; radial?: number; up?: THREE.Vector3; side?: THREE.Vector3 } = {}): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const segs = o.segs ?? 40;
  const radial = o.radial ?? 20;
  const up = o.up ?? new THREE.Vector3(0, 1, 0);
  const pos: number[] = [];
  const C = new THREE.Vector3();
  const T = new THREE.Vector3();
  const W = new THREE.Vector3();
  const H = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    path.getPointAt(t, C);
    path.getTangentAt(t, T);
    if (o.side) W.copy(o.side).addScaledVector(T, -T.dot(o.side));
    else W.crossVectors(T, up);
    if (W.lengthSq() < 1e-8) W.set(1, 0, 0);
    W.normalize();
    H.crossVectors(W, T).normalize();
    const [a, b, dy = 0] = prof(t);
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * PI * 2;
      const x = Math.cos(th) * a;
      const y = Math.sin(th) * b + dy;
      pos.push(C.x + W.x * x + H.x * y, C.y + W.y * x + H.y * y, C.z + W.z * x + H.z * y);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // The normal of triangle (i,j)→(i+1,j)→(i,j+1) is tangent × height direction = the width direction, so it always faces outward
  const m = mergeVertices(g, 1e-6);
  m.computeVertexNormals();
  return m;
}

/**
 * A tuft of fur: a flat cone growing from the origin along -z with the end bending toward -y, widest at the root and closing to a point at the end.
 * w is the width, th the thickness, and curl the amount the end bends down; the group's angles are used to insert it onto the body.
 */
export function furLock(len: number, w: number, th: number, curl = 0.3, radial = 12): THREE.BufferGeometry {
  const pts = [0, 0.33, 0.66, 1].map((u) => new THREE.Vector3(0, -curl * len * u * u, -len * u));
  return loft(pts, (t) => {
    const k = Math.pow(1 - t, 0.9) * (0.75 + 0.25 * Math.sin(Math.min(1, t * 3) * PI * 0.5));
    return [w * 0.5 * k, th * 0.5 * k];
  }, { segs: 14, radial, side: new THREE.Vector3(1, 0, 0) });
}

export interface FurCollarOpts {
  /** Distance of the root from the axis (the root is buried in the body) */
  r0: number;
  /** Fur length (along the fur flow) */
  len: number;
  /** Thickness at the thickest point */
  thick: number;
  /** The angle the fur flow flares outward: 0 hugs the axis going down along -y, PI/2 is straight outward */
  flare: number;
  /** The number of fur tufts on this arc */
  tufts: number;
  /** The range of the arc (about the y axis, 0 toward +z); a full circle by default */
  a0?: number;
  a1?: number;
  /** The proportion by which the trailing edge is shortened between tufts */
  notch?: number;
  /** The amount the end bends back in to lie against the body (radians) */
  curl?: number;
  /** The depth of the grooves in the surface between tufts */
  groove?: number;
  /** Random variation in the length of each tuft */
  jitter?: number;
  /** The starting phase of the tufts (0-1), for staggering two layers */
  phase?: number;
  /** The fur on the θ = 0 side is longer: the length is multiplied by 1 + bias·cos θ (a flame mane long on top and short below) */
  bias?: number;
  /** The fur tips curl toward the θ = 0 side (like flames leaping up): when θ = 0 faces up, the fur tips on both sides bend up */
  rise?: number;
  /** The two colors of fur root and fur tip: [root color, tip color, position of the color change 0-1]; the material must enable vertexColors and set base color to white */
  tint?: [THREE.ColorRepresentation, THREE.ColorRepresentation, number];
  seed?: number;
}

/**
 * A ring of fur joined together (mane, neck fur, chest fur): a cross-section swept about the y axis, the fur flow bulging outward from the root and then closing to a point along -y, the trailing edge cut into clumps of pointed tips.
 * The trailing edge is shortened between tufts and grooves are pressed into the surface, so the tufts are read from the sawtooth edge and the grooves; the whole ring is one part, so the outline is drawn only at the edge of the fur tips
 * and does not draw a ring of line around every tuft the way separate tufts would (that would look like armor plates).
 * For a partial arc the thickness at both ends goes to 0, closing naturally. When placing it, align y with the direction the fur roots point (opposite to the fur flow) and z with the θ = 0 direction.
 */
export function furCollar(o: FurCollarOpts): THREE.BufferGeometry {
  const a0 = o.a0 ?? -PI;
  const a1 = o.a1 ?? PI;
  const span = a1 - a0;
  const full = Math.abs(span - PI * 2) < 1e-6;
  const nT = Math.max(4, Math.round(o.tufts * 12));
  const segS = 14;
  const rand = rng(o.seed ?? 11);
  const var_ = Array.from({ length: Math.ceil(o.tufts) + 2 }, () => 1 + (rand() - 0.5) * 2 * (o.jitter ?? 0.12));
  const notch = o.notch ?? 0.45;
  const curl = o.curl ?? 0.5;
  const groove = o.groove ?? 0.35;
  const phase = o.phase ?? 0;
  const cols = full ? nT : nT + 1;
  const J = segS * 2 + 1;
  const pos: number[] = [];
  const col: number[] = [];
  const tRoot = new THREE.Color(o.tint?.[0] ?? 0xffffff);
  const tTip = new THREE.Color(o.tint?.[1] ?? 0xffffff);
  const tAt = o.tint?.[2] ?? 2;
  const rise = o.rise ?? 0;
  const tc = new THREE.Color();
  const cr: number[] = [];
  const ca: number[] = [];
  const nr: number[] = [];
  const na: number[] = [];
  for (let i = 0; i < cols; i++) {
    const th = a0 + (span * i) / nT;
    const u = (i / nT) * o.tufts + phase;
    const w = u - Math.floor(u);
    const c = 1 - Math.abs(2 * w - 1);
    const idx = Math.floor(u) % var_.length;
    const e = full ? 1 : Math.min(1, (i / nT) * o.tufts * 2, ((nT - i) / nT) * o.tufts * 2);
    const L = o.len * var_[idx] * (1 - notch + notch * Math.pow(c, 0.75)) * (0.55 + 0.45 * e) * (1 + (o.bias ?? 0) * Math.cos(th));
    // The cross-section midline: starting from the root, bending inward by curl at the angle flare
    cr.length = ca.length = nr.length = na.length = 0;
    let r = o.r0;
    let a = 0;
    for (let k = 0; k <= segS; k++) {
      const sK = k / segS;
      const phi = o.flare - curl * sK * sK;
      cr.push(r);
      ca.push(a);
      nr.push(Math.cos(phi));
      na.push(Math.sin(phi));
      const ph2 = o.flare - curl * ((k + 0.5) / segS) ** 2;
      r += Math.sin(ph2) * (L / segS);
      a -= Math.cos(ph2) * (L / segS);
    }
    const push = (k: number, off: number) => {
      const sK = k / segS;
      const rr = cr[k] + nr[k] * off;
      const aa = ca[k] + na[k] * off;
      const t2 = th - rise * Math.sin(th) * sK * sK;
      pos.push(Math.sin(t2) * rr, aa, Math.cos(t2) * rr);
      tc.copy(tRoot).lerp(tTip, THREE.MathUtils.smoothstep(sK, tAt - 0.03, tAt + 0.03));
      col.push(tc.r, tc.g, tc.b);
    };
    for (let k = 0; k <= segS; k++) {
      const sK = k / segS;
      const h = o.thick * e * Math.pow(1 - sK, 0.7) * (0.6 + 0.4 * Math.min(1, sK * 4));
      push(k, h * 0.62 * (0.8 + 0.2 * c) * (1 - groove * sK * (1 - c)));
    }
    for (let k = segS - 1; k >= 0; k--) {
      const sK = k / segS;
      const h = o.thick * e * Math.pow(1 - sK, 0.7) * (0.6 + 0.4 * Math.min(1, sK * 4));
      push(k, -h * 0.38);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < nT; i++) {
    const i2 = full ? (i + 1) % nT : i + 1;
    for (let j = 0; j < J; j++) {
      const j2 = (j + 1) % J;
      const a = i * J + j;
      const b = i2 * J + j;
      const c = i2 * J + j2;
      const d = i * J + j2;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (o.tint) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Winding check: the normal in the middle of the outer side of the middle tuft must face outward, and if reversed it is flipped
  const mi = Math.floor(cols / 2) * J + Math.floor(segS / 2);
  const nrm = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, mi);
  const p = new THREE.Vector3().fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, mi);
  if (nrm.dot(new THREE.Vector3(p.x, 0, p.z)) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

// ───────────────────────── Assembly ─────────────────────────

/** Assemble parts: add turns on shadow casting and adds the part to the outline layer; group is just an empty node with a position and angles; rivet is a hemisphere rivet facing the n direction */
export function partKit() {
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale?: V3): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.rotation.set(...rot);
    if (scale) m.scale.set(...scale);
    m.castShadow = true;
    m.layers.enable(INK_LAYER);
    parent.add(m);
    return m;
  };
  const group = (parent: THREE.Object3D, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0]): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(...pos);
    g.rotation.set(...rot);
    parent.add(g);
    return g;
  };
  const rivetGeo = new THREE.SphereGeometry(1, 12, 8, 0, PI * 2, 0, PI / 2);
  const rivet = (parent: THREE.Object3D, mat: THREE.Material, pos: V3, n: V3, r = 0.013): THREE.Mesh => {
    const m = add(parent, rivetGeo, mat, pos, [0, 0, 0], [r, r * 0.6, r]);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...n).normalize());
    return m;
  };
  return { add, group, rivet };
}

// ───────────────────────── Merging static parts (fewer draw calls) ─────────────────────────

export interface MergeStaticOpts {
  /** Nodes that move: the idle action, action weights and the ultimate change their position, angles, scale or visibility. A part is merged only into the nearest one (or into root if there is none) */
  owners?: THREE.Object3D[];
  /** Meshes or groups (whole subtrees) that are not merged: they move themselves, toggle visibility, change vertices, or have their materials swapped */
  keep?: THREE.Object3D[];
  /** Anchors: head, eyes and anchors all act as owners; so does the parent group of the eye anchors (the range over which corruption swaps the eye material) */
  rig?: LabRig;
  /**
   * Adjacency distance: if the surface distance between two parts is under min(gap, near × the longest side of the smaller part's bounding box) (but not under 0.02), they go into different batches.
   * The depth threshold of the outline is about 3.5% of the camera distance (about 0.2 on the lab bench); when two parts closer than that overlap front to back in the frame, the line between them is drawn only by the part index;
   * the overlapping stretch of edge of small parts is also short, so the threshold shrinks with size. With near at 0.5, Astragate's forefoot stone block (0.17) and hind thigh 0.09 apart were merged together, and the edge line of the forefoot disappeared
   */
  gap?: number;
  near?: number;
  /**
   * Groups of meshes that may share a batch: although they are close to each other, the seam between them is hidden by another part (for example two toes flanking the middle one), so after merging it cannot be seen
   */
  share?: THREE.Object3D[][];
  /**
   * [original material, vertex-color variant]: two labToons that are the same in everything except base color, the latter with vertex colors enabled and a white base color.
   * The meshes with the original material have their base color written into vertex colors and are merged with the meshes of the latter (only useful within the same outline group). The original material must not change color in idle or actions
   */
  twins?: [THREE.Material, THREE.Material][];
}

interface MergePart {
  mesh: THREE.Mesh;
  /** The material used after merging (the one swapped in by twins) */
  mat: THREE.Material;
  owner: THREE.Object3D;
  /** The geometry after applying the transform relative to the owner */
  geo: THREE.BufferGeometry;
  /** The bounding box of geo, and the original geometry's bounding box moved into owner space */
  box: THREE.Box3;
  obox: THREE.Box3;
  /** The longest side of the bounding box */
  ext: number;
}

/** The vertex attributes the material reads: vertex colors, texture coordinates */
function neededAttrs(mat: THREE.Material): string[] {
  const m = mat as THREE.MeshToonMaterial;
  const out = ['position', 'normal'];
  if (m.vertexColors) out.push('color');
  if (m.map || m.alphaMap || m.normalMap || m.bumpMap || m.emissiveMap || m.aoMap || m.lightMap || m.displacementMap) out.push('uv');
  return out;
}

/** Apply the transform rel to the geometry (normals use the normal matrix, and with a negative scale the triangles are flipped); when labObj is true an extra copy of the original position is carried; paint is the base color written in when swapping to the vertex-color variant material */
function bakeGeometry(g0: THREE.BufferGeometry, rel: THREE.Matrix4, need: string[], labObj: boolean, paint?: THREE.Color): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const P = g0.attributes.position as THREE.BufferAttribute;
  const n = P.count;
  const pos = new Float32Array(n * 3);
  const q = new THREE.Vector3();
  for (let i = 0; i < n; i++) q.fromBufferAttribute(P, i).toArray(pos, i * 3);
  if (labObj) g.setAttribute('labObj', new THREE.BufferAttribute(pos.slice(), 3));
  for (let i = 0; i < n; i++) q.fromArray(pos, i * 3).applyMatrix4(rel).toArray(pos, i * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  let N = g0.attributes.normal as THREE.BufferAttribute | undefined;
  if (!N) {
    const t = g0.clone();
    t.computeVertexNormals();
    N = t.attributes.normal as THREE.BufferAttribute;
  }
  const nm = new THREE.Matrix3().getNormalMatrix(rel);
  const nor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) q.fromBufferAttribute(N, i).applyMatrix3(nm).normalize().toArray(nor, i * 3);
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  for (const k of need) {
    if (k === 'position' || k === 'normal') continue;
    if (k === 'color' && paint) {
      const out = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) paint.toArray(out, i * 3);
      g.setAttribute(k, new THREE.BufferAttribute(out, 3));
      continue;
    }
    const a = g0.attributes[k] as THREE.BufferAttribute;
    const s = a.itemSize;
    const out = new Float32Array(n * s);
    for (let i = 0; i < n; i++) for (let c = 0; c < s; c++) out[i * s + c] = a.getComponent(i, c);
    g.setAttribute(k, new THREE.BufferAttribute(out, s));
  }
  const idx = g0.index ? Uint32Array.from(g0.index.array) : Uint32Array.from({ length: n }, (_, i) => i);
  if (rel.determinant() < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/** Whether the two twins materials are the same apart from base color and vertex colors (labToon's uniforms, color steps, emissive, facing) */
function twinOk(a: THREE.Material, b: THREE.Material): boolean {
  const A = a as THREE.MeshToonMaterial;
  const B = b as THREE.MeshToonMaterial;
  const ua = a.userData.u as Record<string, { value: unknown }> | undefined;
  const ub = b.userData.u as Record<string, { value: unknown }> | undefined;
  if (!ua || !ub || A.vertexColors || !B.vertexColors || !B.color.equals(new THREE.Color(1, 1, 1))) return false;
  if (A.gradientMap !== B.gradientMap || !A.emissive.equals(B.emissive) || A.emissiveIntensity !== B.emissiveIntensity || A.side !== B.side || A.map || B.map) return false;
  return Object.keys(ua).every((k) => {
    const x = ua[k].value;
    const y = ub[k]?.value;
    return x === y || ((x as THREE.Color)?.isColor && (x as THREE.Color).equals(y as THREE.Color));
  });
}

/**
 * labToon's mottling and corruption patterns use object-space coordinates (vLabObj = position). After a part is merged into its owner, position changes coordinate system,
 * so it reads the separately carried labObj attribute (the position before merging) instead, so the patterns do not drift; meshes with the same material that were not merged point labObj at their own position.
 */
function patchLabObj(mat: THREE.Material): void {
  if (mat.userData.labObj) return;
  mat.userData.labObj = true;
  const prev = mat.onBeforeCompile;
  const key = prev.toString();
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    if (sh.vertexShader.includes('vLabObj = position;'))
      sh.vertexShader = sh.vertexShader.replace('vLabObj = position;', 'vLabObj = labObj;').replace('#include <common>', 'attribute vec3 labObj;\n#include <common>');
  };
  mat.customProgramCacheKey = () => `${key}|labObj`;
}

/** Sample points (at spacing step) on the triangles whose bounding boxes intersect box, keeping only those that fall inside box */
function pointsNear(g: THREE.BufferGeometry, box: THREE.Box3, step: number): number[] {
  const P = g.attributes.position.array as Float32Array;
  const idx = g.index!.array;
  const out: number[] = [];
  const { min, max } = box;
  const put = (x: number, y: number, z: number) => {
    if (x >= min.x && y >= min.y && z >= min.z && x <= max.x && y <= max.y && z <= max.z) out.push(x, y, z);
  };
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3;
    const b = idx[i + 1] * 3;
    const c = idx[i + 2] * 3;
    if (Math.max(P[a], P[b], P[c]) < min.x || Math.min(P[a], P[b], P[c]) > max.x) continue;
    if (Math.max(P[a + 1], P[b + 1], P[c + 1]) < min.y || Math.min(P[a + 1], P[b + 1], P[c + 1]) > max.y) continue;
    if (Math.max(P[a + 2], P[b + 2], P[c + 2]) < min.z || Math.min(P[a + 2], P[b + 2], P[c + 2]) > max.z) continue;
    const L = Math.max(Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]), Math.hypot(P[b] - P[c], P[b + 1] - P[c + 1], P[b + 2] - P[c + 2]), Math.hypot(P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]));
    const k = Math.max(1, Math.ceil(L / step));
    for (let u = 0; u <= k; u++)
      for (let w = 0; w <= k - u; w++) {
        const x = u / k;
        const y = w / k;
        const z = 1 - x - y;
        put(P[a] * x + P[b] * y + P[c] * z, P[a + 1] * x + P[b + 1] * y + P[c + 1] * z, P[a + 2] * x + P[b + 2] * y + P[c + 2] * z);
      }
  }
  return out;
}

const cellKey = (x: number, y: number, z: number) => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);

/**
 * Whether the surfaces of two parts are within gap of each other: the bounding boxes filter first, then only points on the few triangles of each part near the other are taken (at spacing gap / 2, so parts that touch are sure to be caught),
 * and distances are compared with a spatial grid
 */
function partsTouch(A: MergePart, B: MergePart, gap: number): boolean {
  const eb = B.box.clone().expandByScalar(gap);
  if (!A.box.intersectsBox(eb)) return false;
  const ea = A.box.clone().expandByScalar(gap);
  const step = gap / 2;
  const p = pointsNear(A.geo, eb, step);
  if (!p.length) return false;
  const q = pointsNear(B.geo, ea, step);
  if (!q.length) return false;
  const grid = new Map<number, number[]>();
  for (let i = 0; i < q.length; i += 3) {
    const k = cellKey(Math.floor(q[i] / gap), Math.floor(q[i + 1] / gap), Math.floor(q[i + 2] / gap));
    const l = grid.get(k);
    if (l) l.push(i);
    else grid.set(k, [i]);
  }
  const g2 = gap * gap;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i];
    const y = p[i + 1];
    const z = p[i + 2];
    const cx = Math.floor(x / gap);
    const cy = Math.floor(y / gap);
    const cz = Math.floor(z / gap);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const l = grid.get(cellKey(cx + dx, cy + dy, cz + dz));
          if (l) for (const j of l) if ((q[j] - x) ** 2 + (q[j + 1] - y) ** 2 + (q[j + 2] - z) ** 2 < g2) return true;
        }
  }
  return false;
}

/** DSatur coloring: first the one with the most differently colored neighbors, ties broken by the most neighbors; returns the batch number of each part */
function colorParts(nb: Set<number>[]): number[] {
  const color = nb.map(() => -1);
  for (let done = 0; done < nb.length; done++) {
    let best = -1;
    let bs = -1;
    let bd = -1;
    for (let i = 0; i < nb.length; i++) {
      if (color[i] >= 0) continue;
      const s = new Set([...nb[i]].map((j) => color[j]).filter((c) => c >= 0)).size;
      if (s > bs || (s === bs && nb[i].size > bd)) {
        best = i;
        bs = s;
        bd = nb[i].size;
      }
    }
    const used = new Set([...nb[best]].map((j) => color[j]));
    let c = 0;
    while (used.has(c)) c++;
    color[best] = c;
  }
  return color;
}

/**
 * Merge parts that never move on their own into a few meshes: the mesh count is the draw count, and the outline's normal pass draws once more (spirit-model-polish reference.md pitfalls 84, 91).
 * Parts under the same owner with the same material, the same outline group and the same shadow settings have the transform relative to the owner applied and are merged with mergeGeometries;
 * parts with no inkGroup set whose surface distance is under gap go into different batches (graph coloring), so adjacent parts have different part indices and the lines at the seams stay as before.
 * Not merged: those in keep, invisible ones, translucent ones, multi-material ones, ones with children, ones whose userData has any mark besides inkGroup,
 * and the MeshBasicMaterials in the eye groups (corruption shrinks each eye highlight separately).
 * Called at the end of the builder, after the anchors are all built; returns the number of meshes saved.
 */
export function mergeStatic(root: THREE.Object3D, o: MergeStaticOpts = {}): number {
  const gap = o.gap ?? 0.2;
  const near = o.near ?? 1;
  const gapMin = 0.02;
  const shareOf = new Map<THREE.Object3D, number>();
  (o.share ?? []).forEach((l, i) => l.forEach((x) => shareOf.set(x, i)));
  const twin = new Map<THREE.Material, THREE.Material>();
  for (const [a, b] of o.twins ?? []) {
    if (twinOk(a, b)) twin.set(a, b);
    else console.warn('mergeStatic: the two materials of a twin pair have different parameters, so no swap', a, b);
  }
  const owners = new Set<THREE.Object3D>([root, ...(o.owners ?? [])]);
  // The parent group of the eye anchors acts as owner (corruption looks at its size to decide whether to swap the material or put down a red dot, so the size must not change);
  // for small enough ones (diagonal < height × 0.14, the same test as corruption.ts) corruption shrinks the highlights inside separately, and those highlights are not merged
  const eyeRoots = new Set<THREE.Object3D>();
  const r = o.rig;
  if (r) {
    for (const x of [r.head, ...(r.eyes ?? []), ...Object.values(r.anchors ?? {})]) if (x) owners.add(x);
    root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(root);
    const lim = (bb.max.y - bb.min.y) * 0.14;
    for (const e of r.eyes ?? []) {
      if (!e.parent) continue;
      owners.add(e.parent);
      if (new THREE.Box3().setFromObject(e.parent).getSize(new THREE.Vector3()).length() < lim) eyeRoots.add(e.parent);
    }
  }
  const keep = new Set<THREE.Object3D>(o.keep ?? []);
  const inEye = new Set<THREE.Object3D>();
  for (const e of eyeRoots) e.traverse((x) => inEye.add(x));

  // The merged mesh uses the coordinate system that "has the same orientation as root at modeling time": vertices are stored in root space, and the mesh's matrix is the inverse of the owner's matrix relative to root.
  // Box3.setFromObject (battle height normalization, corruption) takes the union of each part's original bounding box moved into root space, with exactly the same result as before merging
  const frames = new Map<THREE.Object3D, THREE.Matrix4>();
  const frameOf = (owner: THREE.Object3D) => {
    let F = frames.get(owner);
    if (!F) {
      F = new THREE.Matrix4();
      for (let x: THREE.Object3D | null = owner; x && x !== root; x = x.parent) {
        if (x.matrixAutoUpdate) x.updateMatrix();
        F.premultiply(x.matrix);
      }
      if (Math.abs(F.determinant()) < 1e-9) F.identity();
      frames.set(owner, F);
    }
    return F;
  };
  const buckets = new Map<string, MergePart[]>();
  const visit = (m: THREE.Mesh) => {
    const orig = m.material;
    if (Array.isArray(orig) || orig.transparent || !orig.visible || m.children.length) return;
    const mat = twin.get(orig) ?? orig;
    const paint = mat !== orig ? (orig as THREE.MeshToonMaterial).color : undefined;
    if ((m as unknown as THREE.InstancedMesh).isInstancedMesh || (m as unknown as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (Object.keys(m.userData).some((k) => k !== 'inkGroup')) return;
    if (inEye.has(m) && (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) return;
    const g = m.geometry;
    if (!g.attributes.position || Object.keys(g.morphAttributes).length || g.drawRange.start !== 0 || g.drawRange.count !== Infinity) return;
    const need = neededAttrs(mat);
    if (need.some((a) => a !== 'normal' && !(a === 'color' && paint) && !g.attributes[a])) return;
    // The transform relative to the owner: the local matrices of the nodes multiplied along the way (matrixWorld is not read, so a position just set is never a stale value)
    const rel = new THREE.Matrix4();
    let n: THREE.Object3D = m;
    for (;;) {
      if (n.matrixAutoUpdate) n.updateMatrix();
      rel.premultiply(n.matrix);
      if (!n.parent) return;
      if (owners.has(n.parent)) break;
      n = n.parent;
    }
    const owner = n.parent!;
    rel.premultiply(frameOf(owner));
    const key = [owner.uuid, mat.uuid, m.userData.inkGroup ?? '-', m.layers.mask, +m.castShadow, +m.receiveShadow, m.renderOrder, +m.frustumCulled, need.join(), paint ? 3 : (g.attributes.color?.itemSize ?? 0)].join('|');
    if (!g.boundingBox) g.computeBoundingBox();
    const geo = bakeGeometry(g, rel, need, !!mat.userData.u, paint);
    const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position as THREE.BufferAttribute);
    const sz = box.getSize(new THREE.Vector3());
    const part: MergePart = { mesh: m, mat, owner, geo, box, obox: g.boundingBox!.clone().applyMatrix4(rel), ext: Math.max(sz.x, sz.y, sz.z) };
    const b = buckets.get(key);
    if (b) b.push(part);
    else buckets.set(key, [part]);
  };
  const walk = (node: THREE.Object3D) => {
    if (keep.has(node) || !node.visible) return;
    for (const c of node.children) walk(c);
    if ((node as THREE.Mesh).isMesh && !owners.has(node)) visit(node as THREE.Mesh);
  };
  walk(root);

  let saved = 0;
  const patched = new Set<THREE.Material>();
  for (const parts of buckets.values()) {
    if (parts.length < 2) continue;
    // Parts in the same outline group never have lines drawn between them anyway, so there is no need to batch them
    const nb = parts.map(() => new Set<number>());
    if (parts[0].mesh.userData.inkGroup === undefined)
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++)
          if ((shareOf.get(parts[i].mesh) ?? -1 - i) !== (shareOf.get(parts[j].mesh) ?? -1 - j) && partsTouch(parts[i], parts[j], Math.max(gapMin, Math.min(gap, near * Math.min(parts[i].ext, parts[j].ext))))) {
            nb[i].add(j);
            nb[j].add(i);
          }
    const color = colorParts(nb);
    const classes = new Map<number, MergePart[]>();
    parts.forEach((p, i) => {
      const l = classes.get(color[i]);
      if (l) l.push(p);
      else classes.set(color[i], [p]);
    });
    // Those split into several batches (some parts are close to each other): they no longer get a mesh each but are all merged into one, with the batch number written into the per-vertex part index inkPart.
    // The outline (ink.ts and the lab bench's inkPipeline) adds the part index onto the mesh's index and also reserves inkParts consecutive indices for this mesh,
    // so two close parts still have different indices and the lines at the seams stay as before, while the mesh count drops to one
    const multi = classes.size > 1;
    if (multi)
      parts.forEach((p, i) => p.geo.setAttribute('inkPart', new THREE.BufferAttribute(new Float32Array(p.geo.attributes.position.count).fill(color[i]), 1)));
    for (const cls of multi ? [parts] : classes.values()) {
      if (cls.length < 2) continue;
      const first = cls[0].mesh;
      const geo = mergeGeometries(cls.map((p) => p.geo), false)!;
      if (multi) geo.userData.inkParts = classes.size;
      // The bounding box uses the union of each part's bounding box before merging: battle height normalization (labLocalHeight) and corruption use Box3.setFromObject, so the result does not change
      geo.boundingBox = new THREE.Box3();
      for (const p of cls) geo.boundingBox.union(p.obox);
      const mm = new THREE.Mesh(geo, cls[0].mat);
      mm.matrixAutoUpdate = false;
      mm.matrix.copy(frameOf(cls[0].owner)).invert();
      mm.name = first.name;
      mm.layers.mask = first.layers.mask;
      mm.castShadow = first.castShadow;
      mm.receiveShadow = first.receiveShadow;
      mm.renderOrder = first.renderOrder;
      mm.frustumCulled = first.frustumCulled;
      if (first.userData.inkGroup !== undefined) mm.userData.inkGroup = first.userData.inkGroup;
      cls[0].owner.add(mm);
      for (const p of cls) p.mesh.removeFromParent();
      saved += cls.length - 1;
      if (geo.attributes.labObj) patched.add(cls[0].mat);
    }
  }
  // Merged labToon materials read labObj instead: meshes with the same material that were not merged point to their own position
  for (const mat of patched) patchLabObj(mat);
  if (patched.size)
    root.traverse((x) => {
      const m = x as THREE.Mesh;
      if (m.isMesh && patched.has(m.material as THREE.Material) && !m.geometry.attributes.labObj) m.geometry.setAttribute('labObj', m.geometry.attributes.position);
    });
  return saved;
}
