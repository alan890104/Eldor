// Sand Reaper (model lab version): a giant scorpion lurking beneath the quicksand of the canyon, showing only a pair of scythe claws. The hunters say: "By the time you see the sand move, it is already too late."
// Earth element, trapper (Scythe Pit, Throat Snare, Burrow, Upheaval Scythe; trait "Sand Ambush": after our trap fires, attack rises and it gains aether).
//
// Identifying features settled on:
// 1. A scorpion's build: a low wide body, eight legs braced outward, a five-segment tail arching high from the back, the stinger hanging above and behind the head and pointing forward. In silhouette it is a scorpion at a glance.
// 2. The scythe claws (the signature object): a pair of especially big claws, the movable finger a crescent-shaped scythe blade, the blade a polished dark carapace with a bone-white cutting edge on the inner side,
//    three serrations at the root; the fixed finger shrinks into a short thumb pressed against the inside of the blade. The two scythes are raised high at the two sides of the carapace, the blade tips curving inward, like a reaper holding up two scythes.
// 3. The head: made after a scorpion, not a human face. An eye mound rises on top of the front third of the carapace, with two shiny black median eyes on the mound facing outward and forward and up,
//    the dark part carrying a touch of blue-green (the color scorpions glow under ultraviolet light), each with only one point of highlight; on the mound two bony ridges of the same color scheme curve along the inner upper edge of the median eyes.
//    Three small lateral eyes at each of the two corners of the front edge, and below the front edge a pair of short chelicerae (dark hooked fingers) are the mouth. No sclera, iris, eyelids or brows, and no blinking.
// 4. Color scheme: a darker red carapace (darker than the canyon's orange sand and redder in hue, so it can be told apart even on its own home ground), the rear edge of every segment a dark rim; the legs a red-orange a little brighter than the body;
//    the scythe blades dark with a bone-white cutting edge, the telson amber;
//    the blue-green appears only in the dark part of the median eyes and in a ring at the base of the stinger (the same color echoed front and back). It is told apart from Quicksand Wyrm, which also lives in the canyon (sand yellow, dark brown diamond patterns, golden eyes, gray-blue stone pillars).
// 5. Back: on the rear half of the carapace is heaped a sand dune with diagonal ripples blown by the wind (low in front and high behind, heaped in front of the base of the tail), and a few small pebbles half buried in the sand:
//    it spends the whole day buried under the quicksand, the sand on its back not yet shaken off, and the "dune" the hunters see moving is really its back. The tail arches up from behind the dune, tilted slightly toward its left.
//
// Body shape: a scorpion, per the lore with no hands added and not standing up. The cephalothorax in front, seven tergite segments going back, the tail five segments plus telson and stinger curling up and forward;
// a pair of pedipalps (the scythe claws) raised from the two sides of the carapace outward, forward and up, the eight walking legs four on each side braced outward on the ground.
// Personality: a focused and nimble trapper, not idle even when lying in ambush, sharpening its scythes while watching you, and snipping the moment anything stirs.
// Personality comes entirely from build and action: the body pressed low against the ground, the eight legs spread (lying in wait), the two scythes raised half open and snipping the air in turn (nimble, never idle),
// the tail stinger hanging above the head pointing forward (ready to strike at any moment), the chelicerae twitching in bursts.
// Gaze order: the two raised scythe claws (dark blades, bone-white cutting edges) first, the arched tail and stinger second,
// the eye mound and the two median eyes third, and the dune on the back and the eight legs as support.
// Restrained light effects: no translucent mist shell and no scattered glowing dots; the only emissive is the dark part of the median eyes (very faint) and the ring at the base of the stinger (very faint, brightening only with act.glow).
//
// Action table (battle actions and the ultimate follow this table):
// - Idle: the body rises and falls slightly with the breathing; the two scythe claws take turns "snipping" once and opening again (sharpening them), now and then both together snip twice; the tail slowly swaying left and right, the stinger nodding up and down;
//   the chelicerae twitch every so often.
// - Move: the eight legs alternate in quick small steps in a wave, the body kept low and level, the scythe claws held up in front and not lowered, the tail still.
// - Charge-up: the body sinks down (act.burrow, as if about to dig into the sand), the scythe claws drawn back and opened to the maximum (act.open), the tail drawn back (the preparation for act.sting).
// - Strike: both scythes snip forward (act.reap, anchors clawL / clawR are the blade tips); or the stinger stabs forward (act.sting, anchor sting).
// - Hit: the body shrinks down, the scythe claws drawn in crossed before the head to block (act.guard); after recovering the scythe claws are half open as before.
// - Victory: both scythes raised high and snipping once cleanly, the tail curling higher.
// Named anchors: rig.head (the eye mound), rig.eyes (the surfaces of the two median eyes), anchors.mouth (between the two chelicerae),
// anchors.clawL / clawR (the scythe blade tips, L being its own left, +x), anchors.chelaL / chelaR (centers of the claw palms),
// anchors.sting (the stinger tip), anchors.telson (center of the telson), anchors.sand (top of the dune on the back).
// act (0-1): open opens the scythe claws wide, reap snips the scythe claws together, guard draws the scythe claws in front of the head, sting stabs the stinger forward, burrow sinks the body, glow brightens the median eyes and the stinger.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK_LAYER } from './inkPipeline.ts';
import { mergeStatic, partKit, PI, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

type V = THREE.Vector3;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v3(1, 0, 0);
const UP = v3(0, 1, 0);
const Z = v3(0, 0, 1);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const WHITE = col(0xffffff);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
/** A signed power: for superellipse cross-sections */
const spow = (x: number, e: number) => Math.sign(x) * Math.pow(Math.abs(x), e);

// ───────────────────────── Geometry helpers ─────────────────────────

/** Normal direction check for the whole mesh: the average must point away from the ref point, and if reversed it is flipped */
function orientOut(g: THREE.BufferGeometry, ref: THREE.Vector3): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  let s = 0;
  for (let i = 0; i < pa.count; i++) s += (pa.getX(i) - ref.x) * na.getX(i) + (pa.getY(i) - ref.y) * na.getY(i) + (pa.getZ(i) - ref.z) * na.getZ(i);
  if (s < 0) {
    const idx = g.index!.array as Uint16Array | Uint32Array;
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.index!.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

/** After the rings of vertices that close to a point are merged, filter out the zero-area triangles (reference.md pitfall 85) */
function dropDegenerate(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const idx = g.index!.array;
  const out: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i];
    const b = idx[i + 1];
    const c = idx[i + 2];
    if (a !== b && b !== c && a !== c) out.push(a, b, c);
  }
  g.setIndex(out);
  return g;
}

/**
 * A grid surface going once around: rows along the cross-section, cols around (the last column joins back to the first, with no seam line).
 * When the head and tail of the cross-section shrink to a point (poles), the normals of that row are averaged, so the poles do not show outline dots.
 */
function wrapGrid(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c?: THREE.Color }, ref: THREE.Vector3): THREE.BufferGeometry {
  const pos = new Float32Array(rows * cols * 3);
  const cl = new Float32Array(rows * cols * 3);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const { p, c } = f(i, j);
      const k = (i * cols + j) * 3;
      pos[k] = p.x;
      pos[k + 1] = p.y;
      pos[k + 2] = p.z;
      cl[k] = c ? c.r : 1;
      cl[k + 1] = c ? c.g : 1;
      cl[k + 2] = c ? c.b : 1;
    }
  const idx: number[] = [];
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols; j++) {
      const j2 = (j + 1) % cols;
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = i * cols + j2;
      const d = (i + 1) * cols + j2;
      if (i > 0) idx.push(a, b, c);
      if (i < rows - 2) idx.push(b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  orientOut(g, ref);
  const na = g.attributes.normal as THREE.BufferAttribute;
  for (const i of [0, rows - 1]) {
    const n = new THREE.Vector3();
    for (let j = 0; j < cols; j++) n.x += na.getX(i * cols + j), n.y += na.getY(i * cols + j), n.z += na.getZ(i * cols + j);
    n.normalize();
    for (let j = 0; j < cols; j++) na.setXYZ(i * cols + j, n.x, n.y, n.z);
  }
  return g;
}

/** Apply vertex colors to a mesh by position and normal (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  if (!g.attributes.normal) g.computeVertexNormals();
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    const c = f(P.fromBufferAttribute(pa, i), N.fromBufferAttribute(na, i));
    out[i * 3] = c.r;
    out[i * 3 + 1] = c.g;
    out[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

interface SweepOpts {
  /** The position of each row on the curve (arc-length proportion, 0-1) */
  ts: number[];
  /** The angles of the cross-section (0-2π, ascending, not including 2π); if not given radial equal divisions are used. There must be angles on both sides of a color-change boundary for the boundary to be hard */
  ths?: number[];
  radial?: number;
  /** The wide direction is fixed toward it (a curve in a plane); if not given a parallel-transport frame is used, and an upright tube that curls back does not twist either */
  side?: THREE.Vector3;
  /** Coloring: t is the arc-length proportion and th is the angle on the cross-section; rows closed to a point at the ends can only be colored by t, so the vertices can be merged */
  paint?: (t: number, th: number) => THREE.Color;
}

/**
 * Loft along a curve, with the cross-section giving the [width direction, height direction] displacement by sec(t, th) (th going once around counterclockwise). The height direction = width × tangent, and the winding always faces outward.
 * Giving [0, 0] at the two ends closes to a point (a round head, a blade tip).
 */
function sweep(pts: THREE.Vector3[], sec: (t: number, th: number) => [number, number], o: SweepOpts): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const ths = o.ths ?? Array.from({ length: o.radial ?? 12 }, (_, j) => (j / (o.radial ?? 12)) * PI * 2);
  const R = ths.length;
  const pos: number[] = [];
  const cl: number[] = [];
  const C = new THREE.Vector3();
  const T = new THREE.Vector3();
  const W = new THREE.Vector3();
  const H = new THREE.Vector3();
  const prevT = new THREE.Vector3();
  const q = new THREE.Quaternion();
  o.ts.forEach((t, i) => {
    path.getPointAt(t, C);
    path.getTangentAt(t, T);
    if (o.side) W.copy(o.side).addScaledVector(T, -T.dot(o.side));
    else if (i === 0) W.copy(Math.abs(T.y) < 0.95 ? UP : X).cross(T);
    else {
      q.setFromUnitVectors(prevT, T);
      W.applyQuaternion(q).addScaledVector(T, -T.dot(W));
    }
    if (W.lengthSq() < 1e-10) W.set(1, 0, 0);
    W.normalize();
    prevT.copy(T);
    H.crossVectors(W, T).normalize();
    for (let j = 0; j <= R; j++) {
      const th = ths[j % R];
      const [a, b] = sec(t, th);
      pos.push(C.x + W.x * a + H.x * b, C.y + W.y * a + H.y * b, C.z + W.z * a + H.z * b);
      const c = o.paint ? o.paint(t, th) : WHITE;
      cl.push(c.r, c.g, c.b);
    }
  });
  const idx: number[] = [];
  for (let i = 0; i < o.ts.length - 1; i++)
    for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j;
      const b = a + R + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(idx);
  const m = mergeVertices(g, 1e-6);
  dropDegenerate(m);
  m.computeVertexNormals();
  return m;
}

/** Positions of the loft rows: 3 rows at each end laid out at the angles of a round head (c0 and c1 are the closing lengths), and n evenly divided segments in the middle */
function capTs(L: number, c0: number, c1: number, n: number): number[] {
  const s: number[] = [];
  for (let k = 0; k < 3; k++) s.push(c0 * (1 - Math.cos((k / 3) * (PI / 2))));
  for (let k = 0; k <= n; k++) s.push(lerp(c0, L - c1, k / n));
  for (let k = 2; k >= 0; k--) s.push(L - c1 * (1 - Math.cos((k / 3) * (PI / 2))));
  return s.map((x) => clamp(x / L, 0, 1));
}

/** The proportion of the round-head closure: the radius multiplier at distance s from the endpoint with closing length c */
const capK = (s: number, L: number, c0: number, c1: number) => (s < c0 ? Math.sqrt(Math.max(0, 1 - (1 - s / c0) ** 2)) : 1) * (s > L - c1 ? Math.sqrt(Math.max(0, 1 - (1 - (L - s) / c1) ** 2)) : 1);

/** Merge row positions and sort them (removing duplicates) */
const rows = (...l: number[][]) => [...new Set(l.flat().map((x) => Math.round(x * 1e5) / 1e5))].sort((a, b) => a - b);

interface TubeOpts {
  radial?: number;
  n?: number;
  side?: THREE.Vector3;
  /** The proportion by which the end swells outward into a joint sleeve */
  flare?: number;
  /** The radius multiplier in the height direction (a flat tube) */
  flat?: number;
  /** Extra rows added (there must be rows on both sides of a color-change boundary, or the boundary stretches into a long gradient) */
  extra?: number[];
  paint?: (t: number, th: number) => THREE.Color;
}

/** A tube with both ends closed into round heads: the radius changing gradually from r0 to r1, the end able to swell into a joint sleeve (legs, pedipalps, chelicerae) */
function tube(pts: THREE.Vector3[], r0: number, r1: number, o: TubeOpts = {}): THREE.BufferGeometry {
  const L = new THREE.CatmullRomCurve3(pts, false, 'centripetal').getLength();
  const flare = o.flare ?? 0;
  const rr = (u: number) => lerp(r0, r1, u) * (1 + flare * sstep(u, 0.68, 0.86));
  const c0 = Math.min(r0 * 0.95, L * 0.3);
  const c1 = Math.min(rr(1) * 0.95, L * 0.3);
  const ts = rows(capTs(L, c0, c1, o.n ?? 8), o.extra ?? []);
  const flat = o.flat ?? 1;
  return sweep(
    pts,
    (t, th) => {
      const r = rr(t) * capK(t * L, L, c0, c1);
      return [Math.cos(th) * r, Math.sin(th) * r * flat];
    },
    { ts, radial: o.radial ?? 10, side: o.side, paint: o.paint },
  );
}

/** The radius function of a superellipsoid: the half axes may differ up and down and front and back (b up, b down, c front, c back), and the larger the exponent n the squarer it is */
function superR(d: THREE.Vector3, a: number, bT: number, bB: number, cF: number, cB: number, n: number): number {
  const b = d.y >= 0 ? bT : bB;
  const c = d.z >= 0 ? cF : cB;
  const s = Math.pow(Math.abs(d.x / a), n) + Math.pow(Math.abs(d.y / b), n) + Math.pow(Math.abs(d.z / c), n);
  return Math.pow(s, -1 / n);
}

/** A grid mesh of a star-shaped surface (from the center the surface is hit only once in each direction): the poles at ±z, and the distribution of θ decided by thetaOf */
function starGeo(rho: (d: V) => number, nr: number, nc: number, thetaOf: (s: number) => number, color: (d: V, p: V) => THREE.Color): THREE.BufferGeometry {
  return wrapGrid(
    nr,
    nc,
    (i, j) => {
      const th = thetaOf(i / (nr - 1));
      const ph = (j / nc) * PI * 2;
      const d = v3(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th));
      const p = d.clone().multiplyScalar(rho(d));
      return { p, c: color(d, p) };
    },
    v3(0, 0, 0),
  );
}

/** The surface point and normal in direction d on a star-shaped surface (numerical differentiation) */
function starAt(rho: (d: V) => number, d0: V): { p: V; n: V } {
  const d = d0.clone().normalize();
  const h = 1e-3;
  const t1 = (Math.abs(d.y) < 0.9 ? UP : X).clone().cross(d).normalize();
  const t2 = d.clone().cross(t1).normalize();
  const P = (dd: V) => {
    const u = dd.clone().normalize();
    return u.multiplyScalar(rho(u));
  };
  const a = P(d.clone().addScaledVector(t1, h)).sub(P(d.clone().addScaledVector(t1, -h)));
  const b = P(d.clone().addScaledVector(t2, h)).sub(P(d.clone().addScaledVector(t2, -h)));
  const n = a.cross(b).normalize();
  if (n.dot(d) < 0) n.negate();
  return { p: P(d), n };
}

/** Align the group's +y to dirY and its +x to faceX as far as possible (right-handed coordinates, z = x × y) */
function basisYX(g: THREE.Object3D, dirY: THREE.Vector3, faceX: THREE.Vector3): void {
  const y = dirY.clone().normalize();
  const x = faceX.clone().addScaledVector(y, -faceX.dot(y)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// ───────────────────────── Shape ─────────────────────────

export function buildSandReaperLab(): LabModel {
  const RIMC = 0xffc9a0;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    // The carapace, legs, pedipalps, tail segments, eye-mound ridges and chelicerae all use the same vertex-color material: only parts under the same owner can be merged (mesh budget)
    ch: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC, spec: 0.16, specTh: 0.994, speckle: 0.16 })),
    // The scythe blades and stinger: a polished dark carapace, metallic four steps plus a hard highlight
    blade: vc(labToon(0xffffff, { ramp: 'metal', rim: 0.45, rimColor: 0xffe6c8, spec: 0.85, specTh: 0.975 })),
    // Simple eye: a shiny black small dome, the dark part carrying a touch of blue-green
    eye: labToon(0x15272b, { ramp: 'gem', rim: 0.6, rimColor: 0x86efe2, spec: 0.7, specTh: 0.975, emissive: 0x0d5b55, emissiveAmt: 0.22 }),
    venom: labToon(0x47d8c8, { ramp: 'gem', rim: 0.2, rimColor: 0xd8fff8, emissive: 0x22bfae, emissiveAmt: 0.3 }),
    sand: vc(labToon(0xffffff, { rim: 0.35, rimColor: 0xfff0d6, speckle: 0.45 })),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const C = {
    // The carapace is a darker red (darker than the canyon arena's orange sand and redder in hue), so it can be told apart even on its own home ground
    ch: col(0x8f2f2a),
    chTop: col(0xa83c33),
    chSide: col(0x712325),
    chRim: col(0x4a181a),
    belly: col(0xc88a56),
    leg: col(0xb24c38),
    legBand: col(0x4f1b1c),
    claw: col(0x2e1b1a),
    blade: col(0x2c1d20),
    bladeHi: col(0x4a2f2c),
    edge: col(0xf2e4c4),
    vesicle: col(0xd98a45),
    sand: col(0xcc9563),
    sandHi: col(0xdcad7c),
    sandLow: col(0xb07b4e),
    pebble: col(0x8c8277),
    pebble2: col(0x6f5e52),
  };

  const root = new THREE.Group();
  root.name = 'sand_reaper-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between members of the same group
  const PRO = 9701;

  // Body: the whole group rises and falls slightly with breathing; the feet hang on root so they stand firmly on the ground
  const body = group(root);

  // ── Carapace: a flat shield narrow in front and wide behind, the upper edge reaching forward in an eave covering the chelicerae; an eye mound rises on top of the front third ──
  const PRO_P = v3(0, 0.335, 0.27);
  const pro = group(body, [PRO_P.x, PRO_P.y, PRO_P.z]);
  /** The direction of the eye mound (seen from the center of the carapace): on top and a little forward */
  const TUB = v3(0, 0.8, 0.6).normalize();
  const proRho = (d: V) => {
    const f = sstep(d.z, -0.3, 0.75);
    // A slightly raised ridge along the midline, from the eye mound going back
    const keel = 0.01 * Math.exp(-((d.x / 0.09) ** 2)) * sstep(d.y, 0.1, 0.5) * (1 - sstep(d.z, 0.55, 0.85));
    const tub = 0.06 * Math.exp(-((Math.acos(clamp(d.dot(TUB), -1, 1)) / 0.36) ** 2));
    // At the front the upper half reaches forward and the lower half draws back: from the front it is a flat carapace edge with the chelicerae showing underneath, not a round nose tip
    const cF = lerp(0.17, 0.28, sstep(d.y, -0.35, 0.25));
    return superR(d, 0.27 - 0.035 * f, 0.13 - 0.02 * f, 0.1, cF, 0.27, 2.6) + keel + tub;
  };
  {
    const geo = starGeo(proRho, 34, 52, (s) => PI * Math.pow(s, 1.15), (d) => {
      const c = C.ch.clone().lerp(C.chTop, sstep(d.y, 0.35, 0.85)).lerp(C.chSide, sstep(Math.abs(d.x), 0.7, 0.95) * (1 - sstep(d.z, 0.3, 0.6)));
      // The eye mound and front edge slightly brighter (the same color scheme), framing the head
      c.lerp(C.chTop, Math.max(sstep(d.z, 0.72, 0.9) * sstep(d.y, -0.1, 0.2), sstep(d.dot(TUB), 0.9, 0.97)) * 0.7);
      return c.lerp(C.chRim, sstep(-d.y, 0.15, 0.45) * 0.55).lerp(C.belly, sstep(-d.y, 0.55, 0.85));
    });
    add(pro, geo, M.ch).userData.inkGroup = PRO;
  }

  // ── Median eyes: one shiny black simple eye on each side of the eye mound, facing outward and forward and up (a scorpion's median eyes sit on the eye mound and look up and to the sides);
  // no eyelids, sclera or iris, only one point of highlight; the dark part of the eye carries a touch of blue-green (the color scorpions glow under ultraviolet light) ──
  const ER = 0.056;
  const glints: THREE.Object3D[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const eyeDome = new THREE.SphereGeometry(ER, 18, 10, 0, PI * 2, 0, PI * 0.6).rotateX(PI / 2);
  // The highlights face the key-light side, in the same direction for both eyes
  const GLINT_DIR = v3(0.35, 0.75, 0.6).normalize();
  for (const sx of [-1, 1]) {
    const { p, n } = starAt(proRho, v3(sx * 0.29, 0.8, 0.6));
    const c = p.clone().addScaledVector(n, -ER * 0.42);
    const eg = group(pro, [c.x, c.y, c.z]);
    const f = n.clone().addScaledVector(X, sx * 0.3).addScaledVector(Z, 0.5).normalize();
    const r = new THREE.Vector3().crossVectors(UP, f).normalize();
    const u = new THREE.Vector3().crossVectors(f, r);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, f));
    add(eg, eyeDome, M.eye);
    const gl = GLINT_DIR.clone().applyQuaternion(eg.quaternion.clone().invert()).multiplyScalar(ER * 0.97);
    const hl = add(eg, new THREE.SphereGeometry(0.013, 8, 6), M.hi, [gl.x, gl.y, gl.z], [0, 0, 0], [1, 1, 0.45]);
    hl.quaternion.setFromUnitVectors(Z, gl.clone().normalize());
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
    glints.push(hl);
    eyeAnchors.push(group(eg, [0, 0, ER]));
  }
  // Two ridges on the eye mound (the bony ridges a scorpion's eye mound has anyway): curving along the inner upper edge of each median eye, the same color scheme as the carapace and slightly brighter
  for (const sx of [-1, 1]) {
    const pts = [v3(sx * 0.1, 0.76, 0.72), v3(sx * 0.16, 0.86, 0.6), v3(sx * 0.23, 0.9, 0.44), v3(sx * 0.3, 0.86, 0.3)].map((d) => {
      const { p, n } = starAt(proRho, d);
      return p.addScaledVector(n, 0.004);
    });
    add(pro, tube(pts, 0.012, 0.008, { radial: 7, n: 6, paint: () => C.chTop }), M.ch).userData.inkGroup = PRO;
  }

  // Lateral eyes: three shiny black small simple eyes at each of the two corners of the front edge
  for (const sx of [-1, 1])
    for (const [x, y, z, r] of [[0.225, 0.02, 0.2, 0.019], [0.24, 0.065, 0.16, 0.016], [0.24, -0.02, 0.15, 0.014]] as [number, number, number, number][]) {
      const { p, n } = starAt(proRho, v3(sx * x, y, z));
      const g = group(pro, [p.x - n.x * r * 0.35, p.y - n.y * r * 0.35, p.z - n.z * r * 0.35]);
      g.quaternion.setFromUnitVectors(Z, n);
      add(g, new THREE.SphereGeometry(r, 12, 6, 0, PI * 2, 0, PI * 0.55).rotateX(PI / 2), M.eye);
    }

  // Chelicerae (the mouth): a pair of small pincers under the front edge, a swollen basal segment joined to a dark movable finger hooking inward and a short fixed finger; they move in turn now and then when idle
  const MOUTH = v3(0, -0.1, 0.29);
  const chelis: { g: THREE.Group; sx: number }[] = [];
  for (const sx of [-1, 1]) {
    const base = v3(sx * 0.05, -0.045, 0.16);
    const g = group(pro, [base.x, base.y, base.z]);
    chelis.push({ g, sx });
    const o = (x: number, y: number, z: number) => v3(sx * x, y, z);
    add(g, tube([o(0, 0, -0.02), o(0.004, -0.02, 0.06), o(0, -0.04, 0.1)], 0.036, 0.028, { radial: 10, n: 6, paint: (t) => C.ch.clone().lerp(C.chTop, 0.4 * sstep(t, 0.3, 0.9)) }), M.ch);
    add(g, tube([o(0.004, -0.04, 0.09), o(-0.004, -0.056, 0.135), o(-0.022, -0.066, 0.145), o(-0.036, -0.068, 0.138)], 0.017, 0.006, { radial: 8, n: 6, paint: (t) => C.chSide.clone().lerp(C.claw, sstep(t, 0.3, 0.55)) }), M.ch);
    add(g, tube([o(-0.012, -0.034, 0.1), o(-0.018, -0.042, 0.128)], 0.011, 0.006, { radial: 7, n: 3, paint: () => C.claw }), M.ch);
  }

  // ── Seven tergite segments: stacking one after another going back, with a dark edge turned up at the rear edge of each segment; the seventh narrows and joins the tail ──
  // lip is the height the rear edge turns up and k0 is the proportion by which the front edge tucks under the previous segment: for the segments the dune covers (2-6) the steps are made small, so the edge of the dune does not get caught between steps and turn into sawteeth
  const MESO: { zf: number; L: number; a: [number, number]; bT: [number, number]; bB: number; y: number; lip: number; k0: number }[] = [
    { zf: 0.1, L: 0.15, a: [0.24, 0.265], bT: [0.095, 0.105], bB: 0.1, y: 0.34, lip: 0.012, k0: 0.9 },
    { zf: -0.005, L: 0.15, a: [0.26, 0.285], bT: [0.104, 0.114], bB: 0.1, y: 0.343, lip: 0.012, k0: 0.9 },
    { zf: -0.11, L: 0.15, a: [0.275, 0.295], bT: [0.112, 0.121], bB: 0.1, y: 0.348, lip: 0.008, k0: 0.93 },
    { zf: -0.215, L: 0.15, a: [0.285, 0.295], bT: [0.116, 0.12], bB: 0.098, y: 0.35, lip: 0.003, k0: 0.96 },
    { zf: -0.32, L: 0.15, a: [0.28, 0.28], bT: [0.114, 0.115], bB: 0.095, y: 0.35, lip: 0.003, k0: 0.96 },
    { zf: -0.425, L: 0.15, a: [0.265, 0.25], bT: [0.108, 0.106], bB: 0.09, y: 0.35, lip: 0.003, k0: 0.96 },
    { zf: -0.53, L: 0.18, a: [0.245, 0.12], bT: [0.104, 0.09], bB: 0.085, y: 0.352, lip: 0.003, k0: 0.96 },
  ];
  const SE = 0.78;
  // Cross-section angles: rows on top, at the sides and underneath, with extra ones where the rear edge changes color
  const segTh = Array.from({ length: 28 }, (_, j) => (j / 28) * PI * 2);
  for (const s of MESO) {
    const zb = s.zf - s.L;
    const c0 = 0.05;
    const c1 = 0.022;
    const ts = rows(capTs(s.L, c0, c1, 4), [0.72, 0.78]);
    const last = s === MESO[MESO.length - 1];
    add(body, sweep(
      [v3(0, s.y, s.zf), v3(0, s.y, zb)],
      (t, th) => {
        const k = capK(t * s.L, s.L, c0, c1) * lerp(s.k0, 1, sstep(t, 0, 0.7));
        const a = lerp(s.a[0], s.a[1], t);
        const bT = lerp(s.bT[0], s.bT[1], t);
        const cth = Math.cos(th);
        const sth = Math.sin(th);
        // The rear edge turned up a little; a faint ridge down the middle of the back
        const lip = s.lip * sstep(t, 0.55, 0.9) * Math.max(0, sth);
        const keel = 0.01 * Math.exp(-(((th - PI / 2) / 0.22) ** 2));
        return [a * spow(cth, SE) * k, ((sth >= 0 ? bT : s.bB) * spow(sth, SE) + lip + keel) * k];
      },
      {
        ts,
        ths: segTh,
        side: X,
        paint: (t, th) => {
          const sth = Math.sin(th);
          const c = C.ch.clone().lerp(C.chTop, sstep(sth, 0.6, 0.95)).lerp(C.chSide, sstep(-sth, -0.35, 0.2) * 0.8).lerp(C.belly, sstep(-sth, 0.8, 0.95));
          return c.lerp(C.chRim, sstep(t, 0.72, 0.78) * (last ? 0.35 : 0.45) * sstep(sth, -0.5, 0.2));
        },
      },
    ), M.ch);
  }

  // ── The dune on the back: a heap of sand on the rear half of the carapace, with diagonal sand ripples blown by the wind; a few small pebbles half buried in the sand ──
  // The base of the dune lies against the top surface of the carapace (taking the maximum front to back to cover the turned-up rear edge of each segment), and the edge, a round ring, closes down into the carapace:
  // if the edge sank directly into the carapace it would get caught between the rear edges of the segments and turn into sawtooth tongues
  const SAND_C = v3(0.01, 0, -0.44);
  const SAX = 0.225;
  const SAZ = 0.29;
  /** The height of the carapace's top surface at (x, z): the same formula as the cross-section of the loft above */
  const segTop = (x: number, z: number) => {
    let best = 0.3;
    for (const sg of MESO) {
      const t = (sg.zf - z) / sg.L;
      if (t < 0 || t > 1) continue;
      const k = capK(t * sg.L, sg.L, 0.05, 0.022) * lerp(sg.k0, 1, sstep(t, 0, 0.7));
      const a = lerp(sg.a[0], sg.a[1], t) * k;
      const c = Math.pow(Math.min(1, Math.abs(x) / Math.max(a, 1e-4)), 1 / SE);
      const sn = Math.sqrt(Math.max(0, 1 - c * c));
      const th = Math.acos(c);
      const y = sg.y + k * (lerp(sg.bT[0], sg.bT[1], t) * Math.pow(sn, SE) + sg.lip * sstep(t, 0.55, 0.9) * sn + 0.01 * Math.exp(-(((th - PI / 2) / 0.22) ** 2)));
      if (Math.abs(x) <= a) best = Math.max(best, y);
    }
    return best;
  };
  /** Sand ripples: slanted, slightly curved waves, gentle on the windward face (0 → 1) and steep on the lee face (1 → 0) */
  const ripple = (x: number, z: number) => {
    const s = (x * 0.62 + z * 0.78) * 10 + Math.sin(z * 9 + x * 4) * 0.35;
    const f = s - Math.floor(s);
    return f < 0.72 ? sstep(f / 0.72, 0, 1) : sstep((1 - f) / 0.28, 0, 1);
  };
  const sandBase = (x: number, z: number) => Math.max(...[-0.045, -0.0225, 0, 0.0225, 0.045].map((dz) => segTop(x, z + dz)));
  const sandH = (x: number, z: number) => {
    const u = (x - SAND_C.x) / SAX;
    const w = (z - SAND_C.z) / SAZ;
    const r = Math.sqrt(u * u + w * w);
    // Low in front and high behind: the wind is blocked by the tail, and the sand is heaped in front of the base of the tail; from the front only a low sand ridge shows
    const mound = 0.068 * Math.pow(Math.max(0, 1 - r * r), 0.85) * (1 - 0.45 * w);
    const rip = 0.014 * (ripple(x, z) - 0.5) * sstep(1 - r * r, 0.1, 0.45);
    // The edge: after r 0.9 it closes down along a quarter circle
    const rim = r > 0.9 ? 1 - Math.sqrt(Math.max(0, 1 - ((r - 0.9) / 0.1) ** 2)) : 0;
    return sandBase(x, z) + 0.006 + mound + rip - rim * 0.045;
  };
  {
    const RS = [...Array.from({ length: 24 }, (_, i) => ((i + 1) / 24) * 0.88), 0.91, 0.935, 0.957, 0.975, 0.99, 1.0];
    const NP = 88;
    const pos: number[] = [];
    const cl: number[] = [];
    const push = (x: number, z: number, r: number) => {
      pos.push(x, sandH(x, z), z);
      // Color of the sand ripples: the steep lee slope a little darker and the ridge line a little brighter (the light/shadow steps cannot resolve such small undulations, so it is read from the base color)
      const rp = ripple(x, z);
      const k = sstep(1 - r * r, 0.1, 0.45);
      const c = C.sand.clone().lerp(C.sandHi, sstep(rp, 0.75, 1) * 0.9 * k).lerp(C.sandLow, (1 - sstep(rp, 0.0, 0.35)) * 0.8 * k).lerp(C.sandLow, sstep(r, 0.84, 0.95));
      cl.push(c.r, c.g, c.b);
    };
    push(SAND_C.x, SAND_C.z, 0);
    for (const r of RS)
      for (let j = 0; j < NP; j++) {
        const ph = (j / NP) * PI * 2;
        push(SAND_C.x + Math.cos(ph) * SAX * r, SAND_C.z + Math.sin(ph) * SAZ * r, r);
      }
    const idx: number[] = [];
    for (let j = 0; j < NP; j++) idx.push(0, 1 + ((j + 1) % NP), 1 + j);
    for (let i = 1; i < RS.length; i++)
      for (let j = 0; j < NP; j++) {
        const a = 1 + (i - 1) * NP + j;
        const b = 1 + (i - 1) * NP + ((j + 1) % NP);
        const c = 1 + i * NP + j;
        const d = 1 + i * NP + ((j + 1) % NP);
        idx.push(a, b, c, b, d, c);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // Facing up
    const n0 = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, 0);
    if (n0.y < 0) {
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    add(body, g, M.sand);
  }
  // Pebbles: half buried in the sand
  for (const [x, z, r, sy, c] of [[0.1, -0.28, 0.03, 0.62, C.pebble], [-0.12, -0.46, 0.024, 0.7, C.pebble2], [0.05, -0.55, 0.019, 0.66, C.pebble]] as [number, number, number, number, THREE.Color][]) {
    const y = sandH(x, z);
    add(body, paint(new THREE.SphereGeometry(r, 10, 7), () => c), M.sand, [x, y - r * 0.2, z], [0.3, x * 9, 0.2], [1.2, sy, 1]);
  }

  // ── Eight walking legs: the femur braced up to the knee, the tibia going outward and down, the tarsus touching the ground; a ring of dark joint at the end of each segment ──
  const bandPaint = (t: number) => C.leg.clone().lerp(C.legBand, sstep(t, 0.78, 0.81));
  const clawPaint = (t: number) => C.leg.clone().lerp(C.claw, sstep(t, 0.74, 0.78));
  const BAND_TS = [0.74, 0.77, 0.78, 0.795, 0.81, 0.83];
  const CLAW_TS = [0.7, 0.73, 0.74, 0.76, 0.78, 0.8];
  const LEGS: { psi: number; A: [number, number, number]; kr: number; ky: number; jr: number; jy: number; fr: number; r: number }[] = [
    { psi: 1.12, A: [0.17, 0.27, 0.36], kr: 0.2, ky: 0.37, jr: 0.36, jy: 0.17, fr: 0.44, r: 0.05 },
    { psi: 1.48, A: [0.19, 0.27, 0.28], kr: 0.22, ky: 0.38, jr: 0.39, jy: 0.18, fr: 0.48, r: 0.051 },
    { psi: 1.85, A: [0.19, 0.27, 0.19], kr: 0.23, ky: 0.38, jr: 0.41, jy: 0.18, fr: 0.51, r: 0.051 },
    { psi: 2.35, A: [0.16, 0.27, 0.09], kr: 0.24, ky: 0.37, jr: 0.43, jy: 0.17, fr: 0.54, r: 0.05 },
  ];
  for (const s of [-1, 1])
    for (const L of LEGS) {
      const dir = v3(s * Math.sin(L.psi), 0, Math.cos(L.psi));
      const side = v3(dir.z, 0, -dir.x);
      const A = v3(s * L.A[0], L.A[1], L.A[2]);
      const at = (rr: number, y: number) => A.clone().addScaledVector(dir, rr).setY(y);
      const K = at(L.kr, L.ky);
      const J = at(L.jr, L.jy);
      const F = at(L.fr, 0.015);
      const bow = (a: V, b: V, k: number, out: V) => a.clone().lerp(b, 0.5).addScaledVector(out, k);
      add(root, tube([A, bow(A, K, 0.02, UP), K], L.r * 1.1, L.r * 0.9, { radial: 10, n: 6, flare: 0.18, side, paint: bandPaint, extra: BAND_TS }), M.ch);
      add(root, tube([K, bow(K, J, 0.02, dir), J], L.r * 0.88, L.r * 0.7, { radial: 10, n: 6, flare: 0.18, side, paint: bandPaint, extra: BAND_TS }), M.ch);
      add(root, tube([J, bow(J, F, 0.012, dir), F], L.r * 0.68, L.r * 0.34, { radial: 9, n: 5, side, paint: clawPaint, extra: CLAW_TS }), M.ch);
    }

  // ── Scythe claws: the femur going outward and up, the patella forward, the claw palm swollen, the movable finger a crescent-shaped scythe blade, and the fixed finger a short thumb pressed against the inside of the blade ──
  interface Arm {
    sx: number;
    arm: THREE.Group;
    chela: THREE.Group;
    finger: THREE.Group;
    tip: THREE.Group;
    hand: THREE.Group;
  }
  const arms: Arm[] = [];
  const armPaint = (t: number) => C.ch.clone().lerp(C.chRim, sstep(t, 0.8, 0.83));
  const ARM_TS = [0.77, 0.8, 0.815, 0.83, 0.86];
  // The midline of the scythe blade: a circular arc with center (HC_X, HC_Y) and radius HR, going from the outer side of the claw palm (-x) up and around to the inner side (+x) and down
  const HL = 0.32;
  const HC_X = 0.13;
  const HC_Y = HL - 0.01;
  const HR = 0.2;
  const HINGE = v3(HC_X - HR, HC_Y, 0);
  const A0 = PI;
  const A1 = 0.12;
  const bladePts: V[] = [];
  for (let k = 0; k <= 10; k++) {
    const a = lerp(A0, A1, k / 10);
    // The radius narrows slightly toward the blade tip, so it is a crescent and not a true circle
    const r = HR * (1 - 0.1 * (k / 10) ** 2);
    bladePts.push(v3(HC_X + Math.cos(a) * r - HINGE.x, HC_Y + Math.sin(a) * r - HINGE.y, 0));
  }
  // The cross-section of the blade: the outer side a round back and the inner side thinning into the cutting edge; th = 0 is at the cutting edge and π at the back of the blade
  const BLADE_HALF = [0.3, 0.62, 0.9, 0.97, 1.05, 1.35, 1.8, 2.3, 2.75];
  const bladeTh = [0, ...BLADE_HALF, PI, ...[...BLADE_HALF].reverse().map((x) => PI * 2 - x)];
  const EDGE_C = Math.cos(0.97);
  const bladeGeo = (() => {
    const L = new THREE.CatmullRomCurve3(bladePts, false, 'centripetal').getLength();
    const ts = rows(Array.from({ length: 23 }, (_, k) => k / 22), [0.004, 0.012, 0.025, 0.96, 0.985, 0.995]);
    return sweep(
      bladePts,
      (t, th) => {
        const s = t * L;
        // Width: 0.05 at the root, widest over the first thirty percent, then closing to the blade tip
        const w = (0.036 + 0.017 * sstep(t, 0, 0.3)) * (1 - sstep(t, 0.35, 1) * 0.94) * capK(s, L, 0.02, 0.004);
        // Three serrations at the root of the cutting edge
        const saw = t > 0.06 && t < 0.34 ? Math.abs(((t - 0.06) / 0.28) * 3 - Math.floor(((t - 0.06) / 0.28) * 3) - 0.5) * 2 : 1;
        const c = Math.cos(th);
        const wIn = w * (c > 0 ? 1 - 0.35 * (1 - saw) : 1);
        const half = lerp(0.005, 0.029, (1 - c) / 2) * capK(s, L, 0.02, 0.004);
        return [Math.sin(th) * half, -c * (c > 0 ? wIn : w)];
      },
      {
        ts,
        ths: bladeTh,
        side: Z,
        paint: (t, th) => {
          const c = Math.cos(th);
          if (c >= EDGE_C - 1e-6) return C.edge;
          return C.blade.clone().lerp(C.bladeHi, sstep(-c, 0.3, 0.9) * 0.6);
        },
      },
    );
  })();
  for (const sx of [-1, 1]) {
    // The femur extends flat outward from the lower edge of the carapace, and the patella goes forward and up: from the side and from three-quarters the head is not blocked by the forearm
    const S = v3(sx * 0.15, 0.26, 0.43);
    const E = v3(sx * 0.45, 0.31, 0.54);
    const W = v3(sx * 0.56, 0.52, 0.74);
    const armG = group(body, [S.x, S.y, S.z]);
    const o = (p: V) => p.clone().sub(S);
    // Femur, patella
    add(armG, tube([o(S), o(S.clone().lerp(E, 0.5).add(v3(0, 0.02, 0))), o(E)], 0.058, 0.052, { radial: 10, n: 6, flare: 0.15, paint: armPaint, extra: ARM_TS }), M.ch);
    add(armG, tube([o(E).add(v3(-sx * 0.004, -0.004, -0.02)), o(E.clone().lerp(W, 0.5).add(v3(sx * 0.02, 0.02, 0))), o(W)], 0.058, 0.064, { radial: 10, n: 6, flare: 0.1, paint: armPaint, extra: ARM_TS }), M.ch);
    // Claw palm: +y going up and forward, +x facing inward (the scythe blade curving inward)
    const chela = group(armG, [W.x - S.x, W.y - S.y, W.z - S.z]);
    basisYX(chela, v3(sx * 0.16, 0.84, 0.45), v3(-sx, 0, 0.4));
    add(chela, sweep(
      [v3(0, -0.04, 0), v3(0.004, HL * 0.5, 0), v3(0.012, HL, 0)],
      (t, th) => {
        const k = capK(t * (HL + 0.04), HL + 0.04, 0.05, 0.05);
        const bulge = 0.62 + 0.38 * Math.sin(Math.min(1, t * 1.6) * PI * 0.5) - 0.12 * sstep(t, 0.7, 1);
        return [0.104 * bulge * spow(Math.cos(th), 0.8) * k, 0.094 * bulge * spow(Math.sin(th), 0.8) * k];
      },
      { ts: rows(capTs(HL + 0.04, 0.05, 0.05, 9), [0.74, 0.8]), radial: 18, side: X, paint: (t) => C.ch.clone().lerp(C.chTop, 0.35 * (1 - sstep(t, 0.3, 0.8))).lerp(C.chRim, sstep(t, 0.74, 0.8) * 0.7) },
    ), M.ch);
    // Fixed finger: a short thumb reaching inward and up from the top of the claw palm, the tip dark, pressed against the inside of the scythe blade
    add(chela, tube([v3(0.02, HL - 0.035, 0), v3(0.1, HL + 0.05, 0), v3(0.19, HL + 0.095, 0)], 0.042, 0.012, { radial: 10, n: 7, side: Z, paint: (t) => C.ch.clone().lerp(C.claw, sstep(t, 0.55, 0.7)), extra: [0.52, 0.55, 0.7, 0.73] }), M.ch);
    // Scythe blade: the pivot at the top of the outer side of the claw palm
    const finger = group(chela, [HINGE.x, HINGE.y, HINGE.z]);
    add(finger, bladeGeo, M.blade);
    // A joint outside the pivot wraps the blade root
    add(chela, tube([HINGE.clone().add(v3(0.004, -0.04, 0)), HINGE.clone().add(v3(0.006, 0.0, 0)), HINGE.clone().add(v3(0.012, 0.034, 0))], 0.042, 0.036, { radial: 10, n: 4, side: Z, paint: () => C.chRim }), M.ch);
    const tip = group(finger, [bladePts[10].x, bladePts[10].y, 0]);
    const hand = group(chela, [0.01, HL * 0.5, 0]);
    arms.push({ sx, arm: armG, chela, finger, tip, hand });
  }

  // ── Tail: five tail segments curling up and forward from behind the back, the telson hanging at the very front, the stinger hooking forward ──
  const TAIL_BASE = v3(0, 0.37, -0.69);
  const TAIL_L = [0.15, 0.16, 0.17, 0.185, 0.2];
  const TAIL_R = [0.096, 0.091, 0.087, 0.083, 0.08];
  // The tail tilted slightly toward its own left (+x): from the front and the back it is an arc and not a column, and the dune on the back can also show
  const TAIL_LEAN = -0.075;
  const TAIL_A0 = -0.72;
  const TAIL_DA = [0, 0.52, 0.52, 0.52, 0.52, 0.55];
  const tailSegs: THREE.Group[] = [];
  const tailPaint = (t: number, th: number) => {
    const s = Math.sin(th);
    return C.ch.clone().lerp(C.chTop, sstep(s, 0.5, 0.95) * 0.7).lerp(C.chSide, sstep(-s, 0.3, 0.9) * 0.6).lerp(C.chRim, sstep(t, 0.8, 0.85) * 0.85);
  };
  let parent: THREE.Object3D = body;
  for (let i = 0; i < 5; i++) {
    const g = i === 0 ? group(parent, [TAIL_BASE.x, TAIL_BASE.y, TAIL_BASE.z], [TAIL_A0, 0, TAIL_LEAN]) : group(parent, [0, TAIL_L[i - 1], 0], [TAIL_DA[i], 0, TAIL_LEAN]);
    tailSegs.push(g);
    const L = TAIL_L[i];
    const r = TAIL_R[i];
    const ov = i === 0 ? 0.07 : 0.045;
    const len = L + ov;
    const c0 = r * 0.7;
    const c1 = r * 0.45;
    // +y along the tail, +z the back side (the inside of the curl); the cross-section a rounded square, with two ridges on the back side
    add(g, sweep(
      [v3(0, -ov, 0), v3(0, L - ov * 0.5, 0), v3(0, L + 0.012, 0)],
      (t, th) => {
        const k = capK(t * len, len, c0, c1) * lerp(0.86, 1, sstep(t, 0, 0.55)) * (1 + 0.06 * sstep(t, 0.6, 0.85));
        const s = Math.sin(th);
        const c = Math.cos(th);
        const keel = 0.08 * Math.exp(-(((Math.abs(c) - 0.55) / 0.14) ** 2)) * Math.max(0, s);
        return [r * spow(c, 0.8) * k * (1 + keel), r * 0.94 * spow(s, 0.8) * k * (1 + keel)];
      },
      { ts: rows(capTs(len, c0, c1, 6), [0.78, 0.8, 0.85, 0.87]), radial: 20, side: X, paint: tailPaint },
    ), M.ch);
    parent = g;
  }
  // Telson: a swollen amber telson, joined to a dark stinger hooking toward the belly side (the outside of the curl), with a ring of blue-green at the root
  const telson = group(parent, [0, TAIL_L[4], 0], [TAIL_DA[5], 0, 0]);
  const VL = 0.21;
  add(telson, sweep(
    [v3(0, -0.04, 0), v3(0, VL * 0.45, -0.008), v3(0, VL, -0.03)],
    (t, th) => {
      const s = t * (VL + 0.04);
      const k = capK(s, VL + 0.04, 0.05, 0.03);
      const r = 0.07 + 0.04 * Math.sin(Math.min(1, t / 0.55) * PI * 0.5) - 0.052 * sstep(t, 0.55, 1);
      return [r * Math.cos(th) * k, r * 0.92 * Math.sin(th) * k];
    },
    { ts: rows(capTs(VL + 0.04, 0.05, 0.03, 8)), radial: 20, side: X, paint: (t, th) => C.vesicle.clone().lerp(C.ch, sstep(t, 0, 0.3) * 0.5 + 0.2 * sstep(-Math.sin(th), 0, 1)) },
  ), M.ch);
  const stingPts = [v3(0, VL - 0.03, -0.03), v3(0, VL + 0.065, -0.06), v3(0, VL + 0.12, -0.11), v3(0, VL + 0.135, -0.165)];
  add(telson, tube(stingPts, 0.034, 0.004, { radial: 10, n: 9, side: X, paint: (t) => C.blade.clone().lerp(C.bladeHi, 0.3 * (1 - t)) }), M.blade);
  const venomRing = add(telson, new THREE.TorusGeometry(0.027, 0.0075, 8, 20), M.venom, [0, VL + 0.03, -0.047], [PI / 2 - 0.35, 0, 0]);
  const stingTip = group(telson, [stingPts[3].x, stingPts[3].y, stingPts[3].z]);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle ──
  const act = { open: 0, reap: 0, guard: 0, sting: 0, burrow: 0, glow: 0 };
  let lastGlow = Number.NaN;
  const FINGER_OPEN = 0.3;
  const pose = (t: number) => {
    const br = Math.sin(t * 1.7);
    body.position.set(0, br * 0.004 - act.burrow * 0.07, 0);
    body.rotation.set(Math.sin(t * 0.8) * 0.006 + act.burrow * 0.03, 0, Math.sin(t * 0.55) * 0.006);
    // Chelicerae: moving in turn once every 2.8 seconds
    const cc = t % 2.8;
    const tw = (x: number) => (x > 0 && x < 0.26 ? Math.sin((x / 0.26) * PI) : 0);
    for (const ch of chelis) ch.g.rotation.set(-tw(cc - (ch.sx > 0 ? 0.6 : 1.9)) * 0.28, 0, 0);
    // Scythe claws: snipping in turn once each (sharpening them), and every 7 seconds both together snip twice
    const snip = (x: number) => (x > 0 && x < 0.34 ? Math.sin((x / 0.34) * PI) : 0);
    const cyc = t % 7;
    for (const a of arms) {
      const own = a.sx > 0 ? snip(cyc - 1.4) : snip(cyc - 3.2);
      const both = Math.max(snip(cyc - 5.4), snip(cyc - 5.85));
      const cut = Math.max(own, both, act.reap);
      const open = FINGER_OPEN + act.open * 0.55 - cut * (FINGER_OPEN + 0.04);
      a.finger.rotation.set(0, 0, open);
      const sway = Math.sin(t * 0.9 + a.sx) * 0.02;
      // Raising the arms: open draws them back and open, reap snips forward, guard draws them in front of the head
      a.arm.rotation.set(sway - act.open * 0.25 + act.reap * 0.3 + act.guard * 0.2, a.sx * (act.open * 0.25 - act.reap * 0.15 - act.guard * 0.55), a.sx * (-0.02 + cut * 0.05 + act.open * 0.1));
    }
    // Tail: swaying slowly from root to tip, the stinger nodding up and down
    for (let i = 0; i < tailSegs.length; i++) {
      const g = tailSegs[i];
      const base = i === 0 ? TAIL_A0 : TAIL_DA[i];
      const nod = Math.sin(t * 1.1 - i * 0.55) * 0.035;
      // Forward stab: the base pressed forward and the rear section straightened, the stinger passing over the head and forward
      const strike = act.sting * (i < 2 ? 0.32 : -0.2);
      g.rotation.set(base + nod + strike, 0, TAIL_LEAN + Math.sin(t * 0.5 - i * 0.35) * (i === 0 ? 0.05 : 0.03));
    }
    telson.rotation.set(TAIL_DA[5] + Math.sin(t * 1.1 - 3) * 0.06 - act.sting * 0.35, 0, TAIL_LEAN * 0.5);
    // The emissive is written only when the glow weight changes: if it were written every frame, another spirit's ultimate changing this one's uEmissiveAmt would be overwritten
    const gl = act.glow;
    if (gl !== lastGlow) {
      lastGlow = gl;
      M.eye.emissiveIntensity = 0.22 + gl * 0.6;
      M.venom.emissiveIntensity = 0.3 + gl * 0.7;
    }
  };
  const update = (t: number) => pose(t);
  pose(0);

  // Anchors
  const tubTop = starAt(proRho, TUB);
  const head = group(pro, [tubTop.p.x, tubTop.p.y, tubTop.p.z]);
  const mouth = group(pro, [MOUTH.x, MOUTH.y, MOUTH.z]);
  const sandTop = group(body, [SAND_C.x, sandH(SAND_C.x, SAND_C.z) + 0.01, SAND_C.z]);
  const telsonA = group(telson, [0, VL * 0.45, 0]);
  const byside = (sx: number) => arms.find((a) => a.sx === sx)!;
  const rig = {
    head,
    eyes: eyeAnchors,
    anchors: {
      mouth,
      clawL: byside(1).tip,
      clawR: byside(-1).tip,
      chelaL: byside(1).hand,
      chelaR: byside(-1).hand,
      sting: stingTip,
      telson: telsonA,
      sand: sandTop,
    },
  };
  // Static parts merged (mesh budget SR 60): groups that move when idle act as owners, and the eye highlights and the glowing ring are not merged
  mergeStatic(root, {
    owners: [body, ...chelis.map((c) => c.g), ...arms.flatMap((a) => [a.arm, a.chela, a.finger]), ...tailSegs, telson],
    keep: [...glints, venomRing],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.5, 0), radius: 1.36 };
}
