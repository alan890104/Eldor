// Quicksand Wyrm (model lab version): the quicksand at the bottom of the canyon is really its breath. The dwarves planted seven stone pillars beside the quicksand and warn their children: on the day the pillars move, never go near.
// Earth element, binding and entangling (Sinking, Breath Squeeze, Prison of Seven Pillars). Five identifying features settled on from the lore:
// 1. A giant sand-colored serpent coiled in two layers: on its dune-colored back a string of dark brown diamond blotches (with pale borders), small brown spots on the flanks, a beige belly; shrunk very small it can still be seen to be a coiled sand snake.
// 2. A pair of short horns curving back above the eyes (a desert horned viper) and big eyes with golden vertical pupils: the surest mark of the face, and it also gives the silhouette two more points at the top of the head.
// 3. Seven dwarf stone pillars on its back: the dwarves thought they planted them in the ground beside the quicksand, but really they are planted in its back. Gray-blue stone, copper bands, amber amulet carvings,
//    arranged in a half circle along the back line of the coil, the roots covered in sand, a few already leaning (the day the pillars move).
// 4. A beige lower jaw, throat and the scale-by-scale belly scutes: when the neck stands up the belly scutes face forward, and the mouth line runs from the muzzle tip back and up all the way to behind and below the eye.
// 5. A forked red tongue: a snake has no eyelids, so when idle it flicks its tongue in place of blinking.
// Body shape: per the lore it is just a snake, with no legs or hands added. The body is coiled in two layers (the lower layer a full ring on the ground, the upper layer a half ring), the neck standing up from directly in front into an S,
// the head kept level and resting above the front edge of the coil; in battle it is normalized by height, and the coil is about eighty percent as wide as it is tall.
// Personality: an unhurried, confident old hunter beneath the sand, who never chases and waits for its prey to sink by itself.
// Expression: big eyes open and looking straight ahead (no eyelids, so no drooping), the pupils thin vertical slits; the scale ridge above the eye low on the inside and high on the outside joining the horn,
// the corners of the mouth drawn back and up into a sure smile; the head held high, the body coiled tight and still, only the neck swaying slowly.
// Gaze order: the face (golden eyes, beige lower jaw, the blackish-brown marks behind the eyes and the pair of horns) first, the seven stone pillars on its back second, and the diamond blotches and the tail as support.
// Back: the seven stone pillars are arranged in a half circle along the back line of the coil, getting shorter from the neck base toward the tail and leaning more the further back they go; the tail tip comes out around the outside of the coil, turned up slightly.
// Restrained light effects: the only emissive is the golden eyes (very faint) and the carvings on the stone pillars (very faint, brightening only with act.glow), with no halo and no scattered glowing dots.
//
// Action table (battle actions and the ultimate follow this table):
// - Idle: coiled and still, with only the breathing making the coil rise and fall slightly; the neck slowly swaying left and right into an S, the head kept level and slowly looking around; flicking the tongue twice every few seconds; the tail tip lightly slapping the ground.
// - Move: the coil does not spread out, and the whole body is pushed forward like a wave, the head kept at the same height.
// - Charge-up: the neck draws back into a tighter S (act.coil), the head lowered, the vertical pupils narrowed, the eyes fixed on the opponent.
// - Strike: the neck snaps straight forward to bite (act.strike plus act.jaw), showing a pair of curved fangs; or the tail whips to sweep out a wave of sand (act.lash).
// - Hit: the head tilts back and the coil shrinks a little, the eyes still open, and it returns to its original height right away.
// - Victory: slowly raises the head (act.rise), flicks the tongue once, the coil tightening, not showing anything.
// act (0-1): focus stops looking around and looks straight ahead, coil is the charge-up neck draw, strike the forward bite, jaw the open mouth, lash the tail whip, rise the raised head, glow brightens the carvings on the pillars and the eyes, tongue flicks the tongue.
// Anchors: rig.head (center of the face), rig.eyes (the surfaces of the two eyes), anchors.mouth (front end of the mouth), anchors.tongue (the tongue tip), anchors.jaw (front end of the lower jaw),
// anchors.breath (the nostrils, where the quicksand is breathed out), anchors.chest (the belly scutes on the front of the neck), anchors.coil (center of the top of the coil),
// anchors.pillar1-pillar7 (the tops of the seven stone pillars, 1 the tallest and beside the neck base), anchors.hornL / hornR (horn tips), anchors.tailTip (the tail tip).

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, loft, mergeStatic, outline, partKit, PI, rbox, rng, slab, taper, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

// ───────────────────────── Geometry helpers ─────────────────────────

/** Spherical-texture outline of an ellipse: longitude radius rx, latitude radius ry (radians), the center shifted up by dy */
function ellipsePts(rx: number, ry: number, dy = 0, n = 24): [number, number][] {
  return Array.from({ length: n }, (_, i) => [Math.cos((i / n) * PI * 2) * rx, Math.sin((i / n) * PI * 2) * ry + dy] as [number, number]);
}

/** A planar figure on a sphere (iris, vertical pupil): projected onto a sphere of radius r, with a selectable subdivision count so the face count can be kept down */
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

/**
 * A grid surface going once around: rows rows, cols points per row (the last column joins back to the first, with no seam).
 * The winding of the triangles makes the normal = along the row direction × along the column direction; for rows at the head and tail that close to a point, the normal is the average over the whole row (the poles show no outline dots).
 */
function ringGrid(pos: Float32Array, rows: number, cols: number, color?: Float32Array): THREE.BufferGeometry {
  const idx: number[] = [];
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols; j++) {
      const j2 = (j + 1) % cols;
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = i * cols + j2;
      const d = (i + 1) * cols + j2;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (color) g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const na = g.attributes.normal as THREE.BufferAttribute;
  for (const i of [0, rows - 1]) {
    let spread = 0;
    for (let j = 1; j < cols; j++) spread = Math.max(spread, Math.abs(pos[(i * cols + j) * 3] - pos[i * cols * 3]) + Math.abs(pos[(i * cols + j) * 3 + 1] - pos[i * cols * 3 + 1]) + Math.abs(pos[(i * cols + j) * 3 + 2] - pos[i * cols * 3 + 2]));
    if (spread > 1e-5) continue;
    const n = new THREE.Vector3();
    for (let j = 0; j < cols; j++) n.x += na.getX(i * cols + j), n.y += na.getY(i * cols + j), n.z += na.getZ(i * cols + j);
    n.normalize();
    for (let j = 0; j < cols; j++) na.setXYZ(i * cols + j, n.x, n.y, n.z);
  }
  return g;
}

/** One cross-section point of a superellipse: exponent nT on the upper half and nB on the lower half (the larger the exponent the flatter), the widest line at yM; the angle uses (j % cols) / cols, so the seam shows no stray point (pitfall 36) */
function superPt(th: number, a: number, yM: number, yT: number, yB: number, nT: number, nB: number): [number, number] {
  const c = Math.cos(th);
  const s = Math.sin(th);
  const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / (s >= 0 ? nT : nB)) * a;
  const y = s >= 0 ? yM + Math.pow(s, 2 / nT) * (yT - yM) : yM - Math.pow(-s, 2 / nB) * (yM - yB);
  return [x, y];
}

/** A thin tube lofted along a curve (horn, tongue, fang): a radius table rad(t), closing to a point at t=1; a parallel-transport frame, so it does not twist */
function tube(pts: THREE.Vector3[], rad: (t: number) => number, segs = 10, radial = 8, flat = 1): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const fr = path.computeFrenetFrames(segs, false);
  const pos = new Float32Array((segs + 1) * radial * 3);
  const P = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    path.getPointAt(t, P);
    const r = rad(t);
    for (let j = 0; j < radial; j++) {
      const th = ((j % radial) / radial) * PI * 2;
      const q = P.clone().addScaledVector(fr.normals[i], Math.cos(th) * r).addScaledVector(fr.binormals[i], Math.sin(th) * r * flat);
      q.toArray(pos, (i * radial + j) * 3);
    }
  }
  // The start also closes to a point (the root buried in the head, leaving no opening either)
  const start = path.getPointAt(0).addScaledVector(fr.tangents[0], -rad(0) * 0.6);
  const rows = segs + 2;
  const full = new Float32Array(rows * radial * 3);
  for (let j = 0; j < radial; j++) start.toArray(full, j * 3);
  full.set(pos, radial * 3);
  const g = ringGrid(full, rows, radial);
  // If the winding is reversed, flip it (the normals must face outward)
  const na = g.attributes.normal as THREE.BufferAttribute;
  const pa = g.attributes.position as THREE.BufferAttribute;
  let s = 0;
  for (let i = radial; i < pa.count - radial; i++) {
    const row = Math.floor(i / radial) - 1;
    path.getPointAt(clamp(row / segs, 0, 1), P);
    s += (pa.getX(i) - P.x) * na.getX(i) + (pa.getY(i) - P.y) * na.getY(i) + (pa.getZ(i) - P.z) * na.getZ(i);
  }
  if (s < 0) flip(g);
  return g;
}

function flip(g: THREE.BufferGeometry): void {
  const idx = g.index!.array as Uint16Array | Uint32Array;
  for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  g.index!.needsUpdate = true;
  const na = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < na.count; i++) na.setXYZ(i, -na.getX(i), -na.getY(i), -na.getZ(i));
}

/**
 * The saddle blotches and small flank spots on the body are drawn pixel by pixel in the material: vertex colors can only be interpolated linearly between vertices, so a slanted boundary on a 32-column grid is bound to be a sawtooth (pitfall 32),
 * and densifying the mesh would exceed the face budget. The geometry carries a pat attribute (arc length s, the angle from the back line, a thickness ratio), and the fragment shader computes the distance to the saddle blotch,
 * using fwidth to make a one-pixel-wide transition. It is attached after labToon's original onBeforeCompile (after color_fragment, before the mottling), and the white flash, fade-out and corruption work as before.
 */
function bodyPattern(mat: THREE.MeshToonMaterial, o: { L: number; PS: number; RMAX: number; edge: THREE.Color; saddle: THREE.Color; saddleC: THREE.Color; spot: THREE.Color }): void {
  const prev = mat.onBeforeCompile;
  const key = prev.toString();
  const uni = {
    uPatL: { value: o.L },
    uPatP: { value: o.PS },
    uPatEdge: { value: o.edge.clone() },
    uPatSaddle: { value: o.saddle.clone() },
    uPatSaddleC: { value: o.saddleC.clone() },
    uPatSpot: { value: o.spot.clone() },
  };
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 pat;\nvarying vec3 vPat;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPat = pat;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPat;\nuniform float uPatL;\nuniform float uPatP;\nuniform vec3 uPatEdge;\nuniform vec3 uPatSaddle;\nuniform vec3 uPatSaddleC;\nuniform vec3 uPatSpot;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  float s = vPat.x;
  float dth = vPat.y;
  float k = vPat.z;
  float on = (1.0 - smoothstep(uPatL - 0.3, uPatL - 0.12, s)) * smoothstep(0.18, 0.3, s);
  float sc = floor((s - 0.35) / uPatP + 0.5) * uPatP + 0.35;
  float dm = abs(s - sc) / (0.135 * k) + pow(dth / 1.32, 1.6);
  float fw = max(fwidth(dm), 1e-4);
  vec3 c = diffuseColor.rgb;
  c = mix(c, uPatEdge, (1.0 - smoothstep(1.17 - fw, 1.17 + fw, dm)) * on);
  c = mix(c, uPatSaddle, (1.0 - smoothstep(0.93 - fw, 0.93 + fw, dm)) * on);
  c = mix(c, uPatSaddleC, (1.0 - smoothstep(0.37 - fw, 0.37 + fw, dm)) * on * 0.8);
  float sc2 = floor((s - 0.35 - uPatP * 0.5) / uPatP + 0.5) * uPatP + 0.35 + uPatP * 0.5;
  float a2 = (s - sc2) / (0.05 * k);
  float b2 = (dth - 1.62) / 0.2;
  float e2 = a2 * a2 + b2 * b2;
  float fw2 = max(fwidth(e2), 1e-4);
  c = mix(c, uPatSpot, (1.0 - smoothstep(1.0 - fw2, 1.0 + fw2, e2)) * on);
  diffuseColor.rgb = c;
}`,
      );
  };
  mat.customProgramCacheKey = () => `${key}|sandPattern`;
}

// ───────────────────────── Shape ─────────────────────────

export function buildSandserpentLab(): LabModel {
  const rand = rng(20260928);
  const RIMC = 0xffe2b0;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    // The body and head share one vertex-color material (the same outline group, so where the neck is inserted behind the head there is no extra ring of line)
    scale: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC, spec: 0.14, specTh: 0.994 })),
    // The body's lofted tube: the same parameters as the head, with the saddle blotches additionally drawn pixel by pixel (bodyPattern)
    body: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC, spec: 0.14, specTh: 0.994 })),
    jaw: vc(labToon(0xffffff, { rim: 0.5, rimColor: RIMC })),
    eye: labToon(0xffc43a, { ramp: 'gem', emissive: 0xd88a10, emissiveAmt: 0.22, rim: 0 }),
    iris: labToon(0xee8a1c, { ramp: 'gem', emissive: 0xa04a00, emissiveAmt: 0.15, rim: 0 }),
    pupil: labToon(0x1c0e08, { ramp: 'gem', rim: 0 }),
    horn: vc(labToon(0xffffff, { rim: 0.5, rimColor: RIMC, spec: 0.45, specTh: 0.985 })),
    nostril: labToon(0x4a2a18, { rim: 0 }),
    tongue: labToon(0xb8283e, { rim: 0.25, rimColor: 0xffc0c0 }),
    fang: labToon(0xf8f0dc, { rim: 0.3 }),
    stone: vc(labToon(0xffffff, { rim: 0.45, rimColor: 0xdfe8ff, speckle: 0.55 })),
    bronze: labToon(0x9c6c3c, { ramp: 'metal', spec: 0.9, specTh: 0.97, rim: 0.4, rimColor: RIMC }),
    rune: labToon(0xb4722f, { ramp: 'gem', emissive: 0xff9a20, emissiveAmt: 0.05, rim: 0 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'sandserpent-lab';
  const { add, group } = partKit();

  // Outline part indices: no lines between members of the same group
  const BODY = 9501;
  const JAW = 9502;

  // The body group handles breathing, and the head also hangs under it (the position computed every frame from the neck's deformation)
  const body = group(root);

  // ───────── Center axis: tail tip → a full outer ring lying on the ground → climbing to a half ring on the second layer → the neck standing up directly in front ─────────
  // φ is the azimuth seen from above: position (R sin φ, y, R cos φ), with φ = 0 directly in front and π/2 at +x.
  const PA = PI - 0.3; // The start of the outer ring (where the tail joins, behind at +x)
  const PT = PA - 1.25; // The tail tip
  const PC = PA + 2 * PI; // The outer ring goes once around and climbs to the second layer
  const PE = 4 * PI; // The second layer ends directly in front
  const CLIMB = 1.25;
  const Y2A = 0.41; // The height of the center axis of the second layer
  const Rof = (p: number) => {
    if (p < PA) return 0.45 + 0.22 * (PA - p);
    if (p <= PC - CLIMB) return lerp(0.45, 0.43, (p - PA) / (2 * PI - CLIMB));
    if (p <= PC) return lerp(0.43, 0.3, sstep(p, PC - CLIMB, PC));
    return lerp(0.3, 0.24, (p - PC) / (PE - PC));
  };
  const Yclimb = (p: number) => (p <= PC - CLIMB ? 0 : p <= PC ? Math.pow(sstep(p, PC - CLIMB, PC + 0.1), 0.8) : 1);
  const Y2 = (p: number) => Y2A + 0.02 * clamp((p - PC) / (PE - PC), 0, 1);

  // Body thickness (by arc length s along the axis): the tail long and thin, closing to a point, thickest in the middle, the neck tapering, the end tucked into the head
  const coilPts: THREE.Vector3[] = [];
  const coilPhi: number[] = [];
  for (let p = PT; p <= PE + 1e-6; p += 0.01) {
    const R = Rof(p);
    coilPts.push(v3(R * Math.sin(p), 0, R * Math.cos(p)));
    coilPhi.push(p);
  }
  // First the arc length in the plane decides the thickness, then the part lying on the ground is placed at exactly the height that touches the ground
  const sFlat: number[] = [0];
  for (let i = 1; i < coilPts.length; i++) sFlat.push(sFlat[i - 1] + coilPts[i].distanceTo(coilPts[i - 1]));
  const RMAX = 0.158;
  const tailR = curveTable([[0, 0], [0.012, 0.012], [0.05, 0.022], [0.25, 0.048], [0.6, 0.09], [1.1, 0.135], [1.8, RMAX], [3, RMAX]]);
  const VEN = 0.86; // The belly is flatter than the back
  for (let i = 0; i < coilPts.length; i++) {
    const p = coilPhi[i];
    const r = tailR(Math.min(sFlat[i], 3))[0];
    const yG = r * VEN + 0.002;
    const k = Yclimb(p);
    let y = lerp(yG, p > PC ? Y2(p) : Y2A, k);
    // The tail tip turned up slightly
    y += 0.07 * Math.pow(Math.max(0, 1 - sFlat[i] / 0.32), 2);
    coilPts[i].y = y;
  }
  // Neck: from directly in front on the second layer (the tangent toward +x) turning upward, bowing back and then forward, the end reaching horizontally into the head
  const E = coilPts[coilPts.length - 1];
  const yE = E.y;
  // The curve's first control point is taken a little before E on the coil, so E's tangent joins up; sampling starts from E (the second control point, parameter 1/(n-1))
  const neckCtrl = [coilPts[coilPts.length - 6].clone(), E.clone(), v3(0.1, yE + 0.05, 0.25), v3(0.16, yE + 0.2, 0.2), v3(0.11, 0.8, 0.12), v3(0.03, 0.96, 0.12), v3(0.0, 1.06, 0.2), v3(0.0, 1.1, 0.29), v3(0.0, 1.11, 0.36)];
  const neckCurve = new THREE.CatmullRomCurve3(neckCtrl, false, 'centripetal');
  const dense: THREE.Vector3[] = coilPts.slice(0, coilPts.length - 1).map((p) => p.clone());
  const denseCoil = dense.length;
  {
    const t0 = 1 / (neckCtrl.length - 1);
    const n = 900;
    for (let i = 0; i <= n; i++) dense.push(neckCurve.getPoint(t0 + (1 - t0) * (i / n)));
  }
  const S: number[] = [0];
  for (let i = 1; i < dense.length; i++) S.push(S[i - 1] + dense[i].distanceTo(dense[i - 1]));
  const L = S[S.length - 1];
  const sE = S[denseCoil - 1]; // The arc length where the coil ends and the neck begins
  const at = (s: number, out = new THREE.Vector3()) => {
    let lo = 0;
    let hi = S.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (S[m] <= s) lo = m;
      else hi = m;
    }
    const u = (s - S[lo]) / Math.max(1e-9, S[hi] - S[lo]);
    return out.copy(dense[lo]).lerp(dense[hi], clamp(u, 0, 1));
  };
  const tangentAt = (s: number) => at(Math.min(L, s + 0.012)).sub(at(Math.max(0, s - 0.012))).normalize();
  // φ in world coordinates (for finding where the stone pillars go)
  const phiAt = (s: number) => {
    let lo = 0;
    let hi = denseCoil - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (S[m] <= s) lo = m;
      else hi = m;
    }
    return coilPhi[lo];
  };

  const radiusAt = (s: number) => {
    const base = tailR(Math.min(s, 3))[0];
    const fromEnd = L - s;
    const neck = curveTable([[-10, 1], [0, 1], [0.35, 0.9], [0.7, 0.78], [1.0, 0.72], [10, 0.72]])(s - (sE - 0.25))[0];
    const endCap = fromEnd < 0.1 ? Math.sqrt(Math.max(0, fromEnd / 0.1)) * 0.96 + 0.04 * (fromEnd / 0.1) : 1;
    return base * neck * (fromEnd <= 0 ? 0 : endCap);
  };

  // Sample rows: one row every 0.034 on the coil, denser at the tail tip; the neck's belly scutes three rows each (one row on each side of the scute edge, pitfall 81)
  const SCUTE_W = 0.055;
  const sS0 = sE - 0.3;
  const sS1 = L - 0.13;
  const rowsS: number[] = [0, 0.003, 0.009, 0.018, 0.03, 0.045, 0.065, 0.09, 0.12];
  for (let s = 0.155; s < sS0; s += 0.024) rowsS.push(s);
  const nScute = Math.floor((sS1 - sS0) / SCUTE_W);
  for (let k = 0; k < nScute; k++) {
    const s0 = sS0 + k * SCUTE_W;
    rowsS.push(s0 + 0.0035, s0 + SCUTE_W * 0.5, s0 + SCUTE_W - 0.0035);
  }
  for (const d of [0.1, 0.075, 0.055, 0.038, 0.024, 0.013, 0.005, 0]) rowsS.push(L - d);
  const ROWS = rowsS.length;
  const COLS = 32;

  // A parallel-transport frame (the double reflection method), the back line H pointing up at the start; the neck gets an extra twist, so the belly faces forward on the upright neck and the back line returns to pointing up at the head
  const Cs: THREE.Vector3[] = [];
  const Ts: THREE.Vector3[] = [];
  const Hs: THREE.Vector3[] = [];
  for (let i = 0; i < ROWS; i++) {
    Cs.push(at(rowsS[i]));
    Ts.push(tangentAt(rowsS[i]));
  }
  Hs.push(UP.clone().addScaledVector(Ts[0], -UP.dot(Ts[0])).normalize());
  for (let i = 0; i < ROWS - 1; i++) {
    const v1 = Cs[i + 1].clone().sub(Cs[i]);
    const c1 = v1.dot(v1);
    if (c1 < 1e-12) {
      Hs.push(Hs[i].clone());
      continue;
    }
    const rL = Hs[i].clone().addScaledVector(v1, (-2 / c1) * v1.dot(Hs[i]));
    const tL = Ts[i].clone().addScaledVector(v1, (-2 / c1) * v1.dot(Ts[i]));
    const v2 = Ts[i + 1].clone().sub(tL);
    const c2 = v2.dot(v2);
    const h = c2 < 1e-12 ? rL : rL.addScaledVector(v2, (-2 / c2) * v2.dot(rL));
    Hs.push(h.addScaledVector(Ts[i + 1], -h.dot(Ts[i + 1])).normalize());
  }
  const signedAngle = (from: THREE.Vector3, to: THREE.Vector3, axis: THREE.Vector3) => Math.atan2(axis.dot(new THREE.Vector3().crossVectors(from, to)), from.dot(to));
  const rowOf = (s: number) => {
    let best = 0;
    for (let i = 0; i < ROWS; i++) if (Math.abs(rowsS[i] - s) < Math.abs(rowsS[best] - s)) best = i;
    return best;
  };
  const twistKey = (s: number, want: THREE.Vector3) => {
    const i = rowOf(s);
    const d = want.clone().addScaledVector(Ts[i], -want.dot(Ts[i])).normalize();
    return signedAngle(Hs[i], d, Ts[i]);
  };
  const sK0 = sE - 0.05;
  const sK1 = sE + 0.42;
  const sK2 = L - 0.06;
  const tw1 = twistKey(sK1, v3(0, 0.15, -1));
  let tw2 = twistKey(sK2, v3(0, 1, -0.1));
  while (tw2 - tw1 > PI) tw2 -= 2 * PI;
  while (tw2 - tw1 < -PI) tw2 += 2 * PI;
  const Ws: THREE.Vector3[] = [];
  for (let i = 0; i < ROWS; i++) {
    const s = rowsS[i];
    const tw = s <= sK0 ? 0 : s <= sK1 ? tw1 * sstep(s, sK0, sK1) : lerp(tw1, tw2, sstep(s, sK1, sK2));
    Hs[i].applyAxisAngle(Ts[i], tw);
    Ws.push(new THREE.Vector3().crossVectors(Ts[i], Hs[i]).normalize());
  }

  // Pattern: a dune-colored back, dark brown diamond blotches with pale edges, small brown flank spots, a beige belly; the neck's belly is a series of belly scutes
  const SAND = col(0xcf9f5e);
  const SAND_L = col(0xdfbb82);
  const BELLY = col(0xe4c996);
  const SCUTE_D = col(0xceb07e);
  const SADDLE = col(0x6e422a);
  const SADDLE_C = col(0x87522f);
  const EDGE = col(0xf0d5a0);
  const SPOT = col(0x86542f);
  const TAILTIP = col(0x6e4428);
  const PS = 0.37; // The spacing of the saddle blotches
  const tmpC = new THREE.Color();
  const colorAt = (s: number, th: number): THREE.Color => {
    const dv = Math.sin(th);
    const c = tmpC.copy(SAND).lerp(SAND_L, sstep(1 - Math.abs(dv), 0.35, 0.9) * 0.8);
    // The saddle blotches and small flank spots are not written into vertex colors but drawn pixel by pixel in the body material's shader (see bodyPattern), so the edges do not turn into sawteeth
    // A dark stretch at the tail tip
    c.lerp(TAILTIP, 1 - sstep(s, 0.1, 0.22));
    // Belly
    const ven = sstep(-dv, 0.38, 0.55);
    if (ven > 0) {
      let b = BELLY.clone();
      if (s > sS0 && s < sS1) {
        const f = ((s - sS0) / SCUTE_W) % 1;
        b = b.lerp(SCUTE_D, sstep(f, 0.35, 1.0) * 0.9);
      }
      c.lerp(b, ven);
    }
    return c;
  };

  const restPos = new Float32Array(ROWS * COLS * 3);
  const colors = new Float32Array(ROWS * COLS * 3);
  // Pattern coordinates: arc length along the center axis, the angle from the back line (0-π, continuous around onto the belly), and a thickness ratio
  const pat = new Float32Array(ROWS * COLS * 3);
  const radii: number[] = [];
  const SCUTE_H = 0.0045;
  for (let i = 0; i < ROWS; i++) {
    const s = rowsS[i];
    const r = radiusAt(s);
    radii.push(r);
    // The section reaching into the head is flattened a little (a snake's head is flat, so the neck does not poke out of the top of the head or the chin)
    const flat = sstep(s, L - 0.45, L - 0.12);
    const a = r * (1.06 + 0.08 * flat);
    const bT = r * (0.97 - 0.2 * flat);
    const bB = r * (VEN - 0.12 * flat);
    const inScute = s > sS0 && s < sS1;
    const saw = inScute ? 1 - (((s - sS0) / SCUTE_W) % 1) : 0;
    for (let j = 0; j < COLS; j++) {
      const th = ((j % COLS) / COLS) * PI * 2;
      const cth = Math.cos(th);
      const sth = Math.sin(th);
      let x = cth * a;
      let y = sth >= 0 ? sth * bT : sth * bB;
      // Belly scutes: the rear edge (toward the tail) turned up a tiny bit
      if (inScute) {
        const m = sstep(-sth, 0.45, 0.75) * SCUTE_H * saw * sstep(s, sS0, sS0 + 0.1);
        const l = Math.hypot(x, y) || 1;
        x += (x / l) * m;
        y += (y / l) * m;
      }
      const P = Cs[i].clone().addScaledVector(Ws[i], x).addScaledVector(Hs[i], y);
      P.toArray(restPos, (i * COLS + j) * 3);
      colorAt(s, th).toArray(colors, (i * COLS + j) * 3);
      pat[(i * COLS + j) * 3] = s;
      pat[(i * COLS + j) * 3 + 1] = Math.abs(Math.atan2(cth, sth));
      pat[(i * COLS + j) * 3 + 2] = Math.max(0.55, r / RMAX);
    }
  }
  const tubeGeo = ringGrid(restPos.slice(), ROWS, COLS, colors);
  {
    // Make sure the normals face outward
    const na = tubeGeo.attributes.normal as THREE.BufferAttribute;
    let sgn = 0;
    const i = Math.floor(ROWS / 2);
    for (let j = 0; j < COLS; j++) {
      const k = i * COLS + j;
      sgn += (restPos[k * 3] - Cs[i].x) * na.getX(k) + (restPos[k * 3 + 1] - Cs[i].y) * na.getY(k) + (restPos[k * 3 + 2] - Cs[i].z) * na.getZ(k);
    }
    if (sgn < 0) flip(tubeGeo);
  }
  const restNor = Float32Array.from((tubeGeo.attributes.normal as THREE.BufferAttribute).array as Float32Array);
  const posAttr = tubeGeo.attributes.position as THREE.BufferAttribute;
  const norAttr = tubeGeo.attributes.normal as THREE.BufferAttribute;
  posAttr.setUsage(THREE.DynamicDrawUsage);
  norAttr.setUsage(THREE.DynamicDrawUsage);
  tubeGeo.setAttribute('pat', new THREE.BufferAttribute(pat, 3));
  bodyPattern(M.body, { L, PS, RMAX, edge: EDGE, saddle: SADDLE, saddleC: SADDLE_C, spot: SPOT });
  const tubeMesh = add(body, tubeGeo, M.body);
  tubeMesh.userData.inkGroup = BODY;
  tubeMesh.frustumCulled = false;

  // ───────── Stone pillars: arranged in a ring along the outer edge of the back ridge of the outermost ring (the front is left for the neck and face), the tallest directly behind, leaning outward, like a ring of pillars the dwarves planted around the quicksand ─────────
  const pillarTops: THREE.Group[] = [];
  const pillarG = group(body);
  {
    const phis = [0.3, 0.535, 0.77, 1.0, 1.23, 1.465, 1.7].map((k) => k * PI);
    const hs = [0.2, 0.235, 0.27, 0.31, 0.275, 0.24, 0.205];
    const leans = [0.1, -0.12, 0.2, -0.05, 0.16, -0.22, 0.06];
    const cStone = col(0x8f98a6);
    const cStoneD = col(0x7b8290);
    const cSandy = col(0xc9a570);
    const order: { phi: number; s: number; y: number }[] = [];
    for (let k = 0; k < phis.length; k++) {
      // Find the point at azimuth φ in the coil (not including the tail and neck), taking the outermost ring
      let best = 0;
      let bestR = -1;
      for (let i = 0; i < denseCoil; i++) {
        const p = coilPhi[i];
        if (p < PA) continue;
        const d = Math.abs(Math.atan2(Math.sin(p - phis[k]), Math.cos(p - phis[k])));
        if (d > 0.02) continue;
        const R = Math.hypot(dense[i].x, dense[i].z);
        if (R > bestR) {
          bestR = R;
          best = i;
        }
      }
      order.push({ phi: phis[k], s: S[best], y: dense[best].y });
    }
    for (let k = 0; k < order.length; k++) {
      const s = order[k].s;
      const i = rowOf(s);
      const C = at(s);
      const T = tangentAt(s);
      const H = Hs[i].clone();
      const r = radiusAt(s);
      const out = v3(C.x, 0, C.z).normalize();
      // Planted at the outer edge of the back ridge (where it is turned outward by 0.55 radians), leaning outward, each leaning a bit more on its own (the pillars have moved)
      const O = out.clone().addScaledVector(T, -out.dot(T)).addScaledVector(H, -out.dot(H)).normalize();
      const upDir = H.clone().multiplyScalar(Math.cos(0.5)).addScaledVector(O, Math.sin(0.5) + leans[k] * 0.3).addScaledVector(T, leans[k] * 0.7).normalize();
      const H0 = hs[k];
      const w = 0.08 + H0 * 0.09;
      const g = group(pillarG);
      g.position.copy(C).addScaledVector(H.clone().multiplyScalar(Math.cos(0.55)).addScaledVector(O, Math.sin(0.55)), r * 0.97 - 0.045);
      // The pillar's +z (the face with the carving) faces outward
      const zf = out.clone().addScaledVector(upDir, -out.dot(upDir)).normalize();
      const xf = new THREE.Vector3().crossVectors(upDir, zf);
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xf, upDir, zf));
      g.rotateY((rand() - 0.5) * 0.5);
      const stoneGeo = taper(rbox(w, H0 + 0.05, w * 0.85, 0.012, 2), [0.82, 0.8]);
      stoneGeo.translate(0, (H0 + 0.05) / 2, 0);
      // The pillar top cut slightly slanted (weathering)
      const pa = stoneGeo.attributes.position as THREE.BufferAttribute;
      const tilt = (rand() - 0.5) * 0.12;
      for (let q = 0; q < pa.count; q++) if (pa.getY(q) > H0) pa.setY(q, pa.getY(q) + pa.getX(q) * tilt);
      stoneGeo.computeVertexNormals();
      paint(stoneGeo, (p) => cStone.clone().lerp(cStoneD, sstep(Math.sin(p.x * 60 + p.y * 40 + k), 0.6, 1) * 0.5).lerp(cSandy, 1 - sstep(p.y, 0.035, 0.08)));
      add(g, stoneGeo, M.stone);
      // Copper band: a ring at the upper third of the pillar shaft
      const bandY = H0 * 0.68 + 0.05;
      const bk = lerp(1, 0.82, bandY / (H0 + 0.05));
      add(g, rbox(w * bk + 0.014, 0.024, w * 0.85 * bk + 0.014, 0.007, 2), M.bronze, [0, bandY, 0]);
      // Amulet carving (ᛉ-shaped): on the outward-facing face, an amber inlay projecting a tiny bit
      const rs = 0.032 + H0 * 0.04;
      const rune = outline([
        [-0.004, -rs], [0.004, -rs], [0.004, 0.1 * rs], [0.42 * rs, 0.62 * rs], [0.36 * rs, 0.7 * rs], [0.004, 0.32 * rs],
        [0.004, 0.75 * rs], [-0.004, 0.75 * rs], [-0.004, 0.32 * rs], [-0.36 * rs, 0.7 * rs], [-0.42 * rs, 0.62 * rs], [-0.004, 0.1 * rs],
      ]);
      const runeY = H0 * 0.34 + 0.05;
      const rk = lerp(1, 0.8, runeY / (H0 + 0.05));
      add(g, slab(rune, 0.008, 0.002, 2), M.rune, [0, runeY, (w * 0.85 * rk) / 2 + 0.001]);
      pillarTops.push(group(g, [0, H0 + 0.05, 0]));
    }
  }

  // ───────── Head: the origin behind the skull (where the end of the neck reaches in), +z is the muzzle tip, kept level ─────────
  const HP = at(L - 0.1);
  const headG = group(body, [HP.x, HP.y, HP.z]);
  const HS = 1.35;
  headG.scale.setScalar(HS);
  const head = group(headG, [0, 0.015, 0]); // The layer that looks around and pitches
  const HZ0 = -0.1;
  const HZ1 = 0.27;
  // Cross-section table of the upper head: z → [half width, top, bottom]; the widest line sits low (a triangular head), the bottom face is the mouth line: lowest at the muzzle tip and rising all the way back to the corner of the mouth (a shallow U from the front, a smile from the side)
  const hProf = curveTable([
    [-0.1, 0.075, 0.045, -0.02],
    [-0.06, 0.11, 0.07, -0.014],
    [-0.01, 0.14, 0.09, -0.012],
    [0.04, 0.15, 0.1, -0.026],
    [0.09, 0.14, 0.103, -0.036],
    [0.15, 0.118, 0.088, -0.042],
    [0.2, 0.094, 0.07, -0.045],
    [0.24, 0.074, 0.056, -0.046],
    [0.27, 0.06, 0.047, -0.046],
  ]);
  const endRound = (z: number) => {
    const back = z < HZ0 + 0.06 ? Math.sqrt(Math.max(0, 1 - ((HZ0 + 0.06 - z) / 0.06) ** 2)) : 1;
    const front = z > HZ1 - 0.04 ? Math.sqrt(Math.max(0, 1 - ((z - (HZ1 - 0.04)) / 0.04) ** 2)) : 1;
    return Math.min(back, front);
  };
  const headSec = (z: number) => {
    const [a0, yT0, yB] = hProf(z);
    const e = endRound(z);
    const yM = yB + 0.3 * (yT0 - yB);
    return { a: a0 * e, yM, yT: yM + (yT0 - yM) * e, yB: yM - (yM - yB) * e };
  };
  /** The height of the top surface of the head (for placing brow ridges, horns and nostrils) */
  const headTopY = (x: number, z: number) => {
    const { a, yM, yT } = headSec(z);
    const u = clamp(Math.abs(x) / Math.max(1e-4, a), 0, 1);
    return yM + Math.pow(Math.max(0, 1 - Math.pow(u, 2.4)), 1 / 2.4) * (yT - yM);
  };
  /** The x of the side surface of the head at height y (for placing the eyes) */
  const headSideX = (y: number, z: number) => {
    const { a, yM, yT, yB } = headSec(z);
    const k = y >= yM ? (y - yM) / Math.max(1e-4, yT - yM) : (yM - y) / Math.max(1e-4, yM - yB);
    const n = y >= yM ? 2.4 : 5;
    return a * Math.pow(Math.max(0, 1 - Math.pow(clamp(k, 0, 1), n)), 1 / n);
  };
  const HCOLS = 36;
  const hZs: number[] = [];
  for (let i = 0; i <= 34; i++) {
    const u = i / 34;
    hZs.push(HZ0 + (HZ1 - HZ0) * (0.5 - 0.5 * Math.cos(u * PI)) * 0.35 + (HZ1 - HZ0) * u * 0.65);
  }
  const H_TOP = col(0xd29c56);
  const H_V = col(0x6e4227);
  const LIP = col(0xf6e8c6);
  const ROOF = col(0xa8404e);
  const STRIPE = col(0x5e3822);
  const EYE_Z = 0.085;
  const EYE_Y = 0.052;
  const headColor = (x: number, y: number, z: number, th: number) => {
    const { a, yB } = headSec(z);
    const c = H_TOP.clone().lerp(SAND_L, sstep(Math.abs(x) / Math.max(1e-3, a), 0.55, 0.95) * 0.6);
    // Two V marks on top of the head, the tips pointing toward the muzzle
    for (const [zv, wv] of [[0.16, 0.017], [0.05, 0.022]] as [number, number][]) {
      const d = Math.abs(z - (zv - 1.1 * Math.abs(x)));
      const m = (1 - sstep(d, wv * 0.55, wv * 1.1)) * (1 - sstep(Math.abs(x), 0.06, 0.085)) * sstep(y, 0.03, 0.05);
      c.lerp(H_V, m);
    }
    // Post-ocular stripe: from the rear edge of the eye going back and down to the corner of the mouth
    const ez = EYE_Z - 0.05;
    const t = clamp((ez - z) / 0.12, 0, 1);
    const sy = lerp(EYE_Y - 0.005, yB + 0.028, t);
    const onSide = sstep(Math.abs(x) / Math.max(1e-3, a), 0.6, 0.8);
    const stripe = (1 - sstep(Math.abs(y - sy), 0.011, 0.017)) * (z < ez + 0.01 ? 1 : 0) * sstep(z, -0.03, 0.0) * onSide;
    c.lerp(STRIPE, stripe);
    // Upper lip: a thin pale strip above the mouth line, only on the front stretch (no white collar around the back of the head)
    c.lerp(LIP, (1 - sstep(y - yB, 0.007, 0.013)) * sstep(z, 0.0, 0.05));
    // Roof of the mouth: facing down, on the inner side of the lip
    if (Math.sin(th) < -0.2) c.lerp(ROOF, sstep(-Math.sin(th), 0.55, 0.8) * (1 - sstep(Math.abs(x) / Math.max(1e-3, a), 0.66, 0.8)) * (1 - sstep(z, 0.17, 0.2)));
    return c;
  };
  {
    const rows = hZs.length;
    const pos = new Float32Array(rows * HCOLS * 3);
    const cl = new Float32Array(rows * HCOLS * 3);
    for (let i = 0; i < rows; i++) {
      const z = hZs[i];
      const { a, yM, yT, yB } = headSec(z);
      for (let j = 0; j < HCOLS; j++) {
        const th = ((j % HCOLS) / HCOLS) * PI * 2;
        const [x, y] = superPt(th, a, yM, yT, yB, 2.4, 5);
        pos.set([x, y, z], (i * HCOLS + j) * 3);
        headColor(x, y, z, th).toArray(cl, (i * HCOLS + j) * 3);
      }
    }
    // The grid's rows run along +z and columns counterclockwise, so the normal = z × tangent would face inward; flip it
    const g = ringGrid(pos, rows, HCOLS, cl);
    const na = g.attributes.normal as THREE.BufferAttribute;
    const k = Math.floor(rows / 2) * HCOLS;
    if (pos[k * 3] * na.getX(k) < 0) flip(g);
    add(head, g, M.scale).userData.inkGroup = BODY;
  }

  // Lower jaw: its top face lies against the bottom face of the upper head, flat on top and round below; the hinge behind the corner of the mouth, turning down when the mouth opens
  const HINGE = v3(0, -0.012, -0.03);
  const jawG = group(head, [HINGE.x, HINGE.y, HINGE.z]);
  {
    const JZ0 = -0.05;
    const JZ1 = 0.266;
    const jProf = curveTable([
      [-0.05, 0.085, -0.075],
      [0.0, 0.13, -0.102],
      [0.07, 0.128, -0.097],
      [0.14, 0.108, -0.086],
      [0.2, 0.084, -0.073],
      [0.245, 0.062, -0.064],
      [0.266, 0.052, -0.06],
    ]);
    const rows = 26;
    const cols = 28;
    const pos = new Float32Array(rows * cols * 3);
    const cl = new Float32Array(rows * cols * 3);
    const JAWC = col(0xf6ead0);
    const JAW_SIDE = col(0xe8cc98);
    const THROAT = col(0xe9d3a4);
    const MOUTH = col(0x96364a);
    for (let i = 0; i < rows; i++) {
      const u = i / (rows - 1);
      const z = JZ0 + (JZ1 - JZ0) * u;
      const [a0, yB0] = jProf(z);
      const yTop = headSec(clamp(z, HZ0, HZ1)).yB - 0.003;
      const back = z < JZ0 + 0.05 ? Math.sqrt(Math.max(0, 1 - ((JZ0 + 0.05 - z) / 0.05) ** 2)) : 1;
      const front = z > JZ1 - 0.03 ? Math.sqrt(Math.max(0, 1 - ((z - (JZ1 - 0.03)) / 0.03) ** 2)) : 1;
      const e = Math.min(back, front);
      const yM = yTop - 0.012;
      for (let j = 0; j < cols; j++) {
        const th = ((j % cols) / cols) * PI * 2;
        const [x, y] = superPt(th, a0 * 0.96 * e, yM, yM + (yTop - yM) * e, yM - (yM - yB0) * e, 6, 2.2);
        const p = v3(x, y, z).sub(HINGE);
        p.toArray(pos, (i * cols + j) * 3);
        const c = JAWC.clone().lerp(THROAT, sstep(-z, -0.06, 0.04) * 0.6);
        // The outside of the lower jaw is pale sand color (the scales of the lower lip), the beige only left on the underside of the chin; further back it joins the sand color of the head's side, so from behind no pale collar appears
        const sideK = sstep(Math.abs(x) / Math.max(1e-3, a0), 0.55, 0.85) * sstep(Math.sin(th), -0.6, -0.2);
        c.lerp(JAW_SIDE, sideK);
        c.lerp(SAND_L, sideK * (1 - sstep(z, 0.02, 0.12)));
        if (Math.sin(th) > 0.3) c.lerp(MOUTH, sstep(Math.sin(th), 0.5, 0.8) * (1 - sstep(Math.abs(x) / Math.max(1e-3, a0), 0.66, 0.8)) * (1 - sstep(z, 0.18, 0.21)));
        c.toArray(cl, (i * cols + j) * 3);
      }
    }
    const g = ringGrid(pos, rows, cols, cl);
    const na = g.attributes.normal as THREE.BufferAttribute;
    const k = Math.floor(rows / 2) * cols;
    if (pos[k * 3] * na.getX(k) < 0) flip(g);
    add(jawG, g, M.jaw).userData.inkGroup = JAW;
  }
  // A pair of curved fangs: seen only when the mouth is open (the whole set toggles its display)
  const fangG = group(head);
  for (const sx of [-1, 1]) {
    const b = v3(sx * 0.034, headSec(0.21).yB + 0.012, 0.215);
    add(fangG, tube([b, b.clone().add(v3(0, -0.03, -0.004)), b.clone().add(v3(0, -0.052, -0.018))], (t) => 0.009 * (1 - t) + 0.0008, 6, 8), M.fang);
  }
  fangG.visible = false;

  // Tongue: coming out of the notch at the muzzle tip, two forked tips; when flicking it extends along z
  const tongueG = group(head, [0, headSec(0.26).yB - 0.002, 0.245]);
  {
    const stem = tube([v3(0, 0, -0.04), v3(0, -0.004, 0.03), v3(0, -0.01, 0.085)], (t) => 0.0065 - t * 0.0015, 8, 6, 0.55);
    add(tongueG, stem, M.tongue);
    for (const sx of [-1, 1]) add(tongueG, tube([v3(0, -0.01, 0.08), v3(sx * 0.008, -0.014, 0.11), v3(sx * 0.02, -0.022, 0.135)], (t) => 0.005 * (1 - t) + 0.0006, 6, 6, 0.6), M.tongue);
  }
  const tongueTip = group(tongueG, [0, -0.02, 0.135]);

  // Nostrils: two small dark holes on top of the muzzle tip (the quicksand is its breath, coming out from here)
  const nostrils: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) {
    // Near the muzzle tip, two small commas, read from the front as a nose, not like another pair of eyes
    const z = 0.252;
    const x = sx * 0.02;
    const y = headTopY(x, z) - 0.003;
    const n = v3(sx * 0.3, 0.7, 0.65).normalize();
    const m = add(head, new THREE.SphereGeometry(1, 10, 6), M.nostril, [x, y, z], [0, 0, 0], [0.0055, 0.003, 0.0085]);
    m.quaternion.setFromUnitVectors(UP, n);
    nostrils.push(v3(x, y, z));
  }

  // ───────── Eyes: big golden eyes half buried in the upper side of the head, facing outward and slightly forward; the vertical pupil and highlight turn toward the nose side (from the front it is a straight-ahead gaze, pitfall 43) ─────────
  // A snake has no eyelids: above the eyeball a brow ridge (the supraocular scale) covers it, starting from the front edge of the eye, low on the inside and high on the outside, sweeping back and up to join the horn root
  const ER = 0.058;
  const eyeAnchors: THREE.Group[] = [];
  const pupils: THREE.Group[] = [];
  const glints: THREE.Mesh[] = [];
  const hornTips: THREE.Group[] = [];
  const eyeball = new THREE.SphereGeometry(ER, 18, 11, 0, PI * 2, 0, PI * 0.72).rotateX(PI / 2);
  for (const sx of [-1, 1]) {
    const surf = v3(sx * headSideX(EYE_Y, EYE_Z), EYE_Y, EYE_Z);
    const d = v3(sx * 0.58, 0.34, 0.74).normalize();
    const c = surf.clone().addScaledVector(d, -ER * 0.4);
    const eg = group(head, [c.x, c.y, c.z]);
    const r = new THREE.Vector3().crossVectors(UP, d).normalize();
    const u = new THREE.Vector3().crossVectors(d, r);
    const basis = new THREE.Matrix4().makeBasis(r, u, d);
    eg.quaternion.setFromRotationMatrix(basis);
    add(eg, eyeball, M.eye);
    const gaze = group(eg, [0, 0, 0], [0.1, -sx * 0.33, 0]);
    add(gaze, lightDecal(ellipsePts(0.42, 0.64, -0.02), ER + 0.0008), M.iris);
    const pupil = group(gaze);
    add(pupil, lightDecal(ellipsePts(0.13, 0.55, 0, 16), ER + 0.0016), M.pupil);
    pupils.push(pupil);
    for (const [x, y, rr] of [[-0.016 * sx, 0.02, 0.011], [0.012 * sx, -0.019, 0.0055]] as [number, number, number][]) {
      const hl = add(gaze, new THREE.SphereGeometry(rr, 8, 6), M.hi, [x, y, ER * 0.97], [0, 0, 0], [1, 1, 0.5]);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    eyeAnchors.push(group(eg, [0, 0, ER]));

    // Brow ridge: in the eye's own coordinates an arc is drawn around the upper edge of the eyeball (the local +x points backward for the +x eye), then converted back to the head's coordinates
    const toHead = (lx: number, ly: number, lz: number) => v3(lx, ly, lz).applyMatrix4(basis).add(c);
    // The brow ridge runs along the upper edge of the eyeball in a slanted line: high at the back and pressed a little lower toward the muzzle, so the upper edge of the eye is a line slanting down toward the nose side (focused and sure, not drooping eyes)
    const browPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 5; i++) {
      const u = i / 5;
      const bx = lerp(1.05, -0.9, u) * ER * sx;
      const by = lerp(0.95, 0.58, u) * ER + Math.sin(PI * u) * 0.08 * ER;
      const bz = Math.sqrt(Math.max(0, (ER * 1.06) ** 2 - bx * bx - by * by)) + 0.002;
      browPts.push(toHead(bx, by + 0.004, bz));
    }
    browPts.reverse();
    // The cross-section is flat and wide (a scale shelf, not a plump round strip)
    const browGeo = loft(browPts, curveTable([[0, 0, 0], [0.08, 0.014, 0.006], [0.35, 0.025, 0.009], [0.75, 0.029, 0.011], [0.93, 0.026, 0.011], [1, 0, 0]]), { segs: 14, radial: 12 });
    const BR_EDGE = col(0x8a5a34);
    paint(browGeo, (p, n) => headColor(p.x, p.y, p.z, PI / 2).lerp(BR_EDGE, sstep(-n.y, -0.2, 0.3) * 0.7));
    add(head, browGeo, M.scale).userData.inkGroup = BODY;
    // Horn: growing from the rear end of the brow ridge, curving up, back and slightly outward, with faint rings one after another
    const b = browPts[5].clone().add(v3(0, -0.004, 0.008));
    const hp = [b.clone().add(v3(-sx * 0.004, -0.014, 0.008)), b.clone(), b.clone().add(v3(sx * 0.012, 0.042, -0.018)), b.clone().add(v3(sx * 0.024, 0.07, -0.058)), b.clone().add(v3(sx * 0.03, 0.08, -0.104))];
    const hg = tube(hp, (t) => (0.0165 * Math.pow(1 - t, 0.85) + 0.0015) * (1 - 0.14 * Math.pow(Math.abs(Math.sin(t * PI * 3.5)), 4)), 16, 10);
    const HB = col(0x5c3a22);
    const HT = col(0x2e1c12);
    paint(hg, (p) => HB.clone().lerp(HT, sstep(p.y - b.y, 0.04, 0.09)));
    add(head, hg, M.horn);
    hornTips.push(group(head, [hp[4].x, hp[4].y, hp[4].z]));
  }

  // ───────── Deformation of the neck and tail: joints along the center axis, with the vertices rotated on the CPU every frame (position and normal with the same rotation) ─────────
  // Neck: four joints from the neck base toward the head, the outer joints carrying the inner ones along; tail: two joints from the root toward the tip
  const neckJ = [sE - 0.05, sE + 0.2, sE + 0.5, sE + 0.8].map((s) => ({ s, P: at(s), h: 0.14, yaw: 0, pitch: 0, roll: 0 }));
  const tailJ = [0.75, 0.38].map((s) => {
    const T = tangentAt(s);
    return { s, P: at(s), h: 0.12, side: new THREE.Vector3().crossVectors(T, UP).normalize(), tap: 0, lash: 0 };
  });
  const rowFirstNeck = rowsS.findIndex((s) => s > neckJ[0].s - neckJ[0].h);
  const rowLastTail = rowsS.findIndex((s) => s > tailJ[0].s + tailJ[0].h);
  const Mrow = new THREE.Matrix4();
  const Mk = new THREE.Matrix4();
  const Tr = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const Qk = new THREE.Quaternion();
  const E3 = new THREE.Euler();
  const Nm = new THREE.Matrix3();
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const pivot = (m: THREE.Matrix4, at: THREE.Vector3, q: THREE.Quaternion) => {
    m.makeTranslation(at.x, at.y, at.z);
    m.multiply(Tr.makeRotationFromQuaternion(q));
    m.multiply(Tr.makeTranslation(-at.x, -at.y, -at.z));
    return m;
  };
  const endM = new THREE.Matrix4();
  const endQ = new THREE.Quaternion();
  const neckMatrix = (s: number, out: THREE.Matrix4, qOut?: THREE.Quaternion) => {
    out.identity();
    qOut?.identity();
    for (const j of neckJ) {
      const w = sstep(s, j.s - j.h, j.s + j.h);
      if (w <= 0) break;
      E3.set(j.pitch * w, j.yaw * w, j.roll * w, 'YXZ');
      Qk.setFromEuler(E3);
      out.multiply(pivot(Mk, j.P, Qk));
      qOut?.multiply(Qk);
    }
    return out;
  };
  const tailMatrix = (s: number, out: THREE.Matrix4) => {
    out.identity();
    for (const j of tailJ) {
      const w = 1 - sstep(s, j.s - j.h, j.s + j.h);
      if (w <= 0) break;
      Qk.setFromAxisAngle(j.side, j.tap * w);
      Q.setFromAxisAngle(UP, j.lash * w);
      Qk.premultiply(Q);
      out.multiply(pivot(Mk, j.P, Qk));
    }
    return out;
  };
  const deformRows = (i0: number, i1: number, f: (s: number, out: THREE.Matrix4) => THREE.Matrix4) => {
    const pa = posAttr.array as Float32Array;
    const na = norAttr.array as Float32Array;
    for (let i = i0; i < i1; i++) {
      f(rowsS[i], Mrow);
      Nm.setFromMatrix4(Mrow);
      for (let j = 0; j < COLS; j++) {
        const k = (i * COLS + j) * 3;
        P.fromArray(restPos, k).applyMatrix4(Mrow).toArray(pa, k);
        N.fromArray(restNor, k).applyMatrix3(Nm).normalize().toArray(na, k);
      }
    }
  };
  posAttr.clearUpdateRanges();
  norAttr.clearUpdateRanges();

  const headRest = HP.clone();
  const tailTip = group(body);

  // ───────── Idle and performance weights ─────────
  const act = { focus: 0, coil: 0, strike: 0, jaw: 0, lash: 0, rise: 0, glow: 0, tongue: 0 };
  const runeEm = M.rune.emissiveIntensity;
  const eyeEm = M.eye.emissiveIntensity;
  let lastGlow = Number.NaN;
  const bump = (x: number, w: number) => (x > 0 && x < w ? Math.sin((x / w) * PI) : 0);
  const update = (t: number) => {
    const { focus, coil, strike, jaw, lash, rise, glow } = act;
    const still = 1 - Math.min(1, Math.max(focus, coil, strike, rise));
    // Breathing: the coil swelling slightly
    const br = Math.sin(t * 1.1);
    body.scale.set(1 + br * 0.007, 1 + br * 0.005, 1 + br * 0.007);
    // Neck: slowly swaying left and right into an S (the phase delayed going up), drawing back when charging up, snapping straight forward on the strike, and raised in victory
    const sw = 0.55;
    neckJ[0].yaw = Math.sin(t * sw) * 0.03 * still;
    neckJ[1].yaw = Math.sin(t * sw - 0.8) * 0.06 * still;
    neckJ[2].yaw = Math.sin(t * sw - 1.6) * 0.07 * still;
    neckJ[3].yaw = Math.sin(t * sw - 2.4) * 0.05 * still;
    neckJ[0].pitch = Math.sin(t * 1.1 + 0.4) * 0.012 - coil * 0.12 + strike * 0.35 - rise * 0.05;
    neckJ[1].pitch = -coil * 0.3 + strike * 0.45 - rise * 0.18;
    neckJ[2].pitch = coil * 0.55 + strike * 0.2 - rise * 0.12;
    neckJ[3].pitch = coil * 0.3 - strike * 0.25 + rise * 0.1;
    rowFirstNeck >= 0 && deformRows(rowFirstNeck, ROWS, (s, m) => neckMatrix(s, m));
    // Tail tip: lightly slapping the ground; when whipping the whole section sweeps to the side
    const tap = Math.max(0, Math.sin(t * 0.9)) ** 3;
    tailJ[0].tap = -lash * 0.25;
    tailJ[1].tap = -tap * 0.28 * (1 - lash) - lash * 0.2;
    tailJ[0].lash = lash * 0.9;
    tailJ[1].lash = lash * 0.6 + Math.sin(t * 0.7) * 0.05;
    rowLastTail > 0 && deformRows(0, rowLastTail, tailMatrix);
    posAttr.needsUpdate = true;
    norAttr.needsUpdate = true;
    // Head: the position follows the end of the neck, the direction kept level (a snake's head stays steady), following only a little of the neck's rotation
    neckMatrix(L - 0.1, endM, endQ);
    headG.position.copy(headRest).applyMatrix4(endM);
    headG.quaternion.identity().slerp(endQ, 0.35);
    head.rotation.set(-0.02 + strike * 0.22 + coil * 0.1 - rise * 0.12, (Math.sin(t * 0.31) * 0.22 + Math.sin(t * 0.83) * 0.04) * still, Math.sin(t * 0.31 + 0.6) * 0.03 * still, 'YXZ');
    // Open mouth: the lower jaw turns down and the fangs appear with it
    const ja = Math.min(0.8, jaw * 0.75 + strike * 0.3);
    jawG.rotation.x = ja;
    fangG.visible = ja > 0.12;
    // Tongue flick: two flicks in a row every 3.8 seconds; act.tongue forces it out
    const tp = t % 3.8;
    const ext = Math.max(bump(tp - 2.6, 0.34), bump(tp - 3.02, 0.3), act.tongue);
    tongueG.visible = ext > 0.03;
    tongueG.scale.set(1, 1, Math.max(0.05, ext));
    tongueG.rotation.x = Math.sin(t * 40) * 0.12 * ext + 0.05;
    // Vertical pupil: narrowed when charging up and striking
    for (const p of pupils) p.scale.set(1 - Math.max(coil, strike) * 0.45, 1, 1);
    // The emissive is written only when a weight changes
    if (glow !== lastGlow) {
      lastGlow = glow;
      M.rune.emissiveIntensity = runeEm + glow * 0.9;
      M.eye.emissiveIntensity = eyeEm + glow * 0.3;
    }
  };

  // Tail-tip anchor: following the tail's deformation (hanging on the body and updating the position every frame would be too fine, so the rest position is taken)
  const tipRest = at(0.02);
  tailTip.position.copy(tipRest);

  update(0);
  tubeGeo.computeBoundingBox();
  tubeGeo.computeBoundingSphere();

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // Anchors
  const face = group(head, [0, 0.02, 0.16]);
  const mouthA = group(head, [0, headSec(0.26).yB - 0.004, 0.272]);
  const jawTip = group(jawG, [0 - HINGE.x, -0.05 - HINGE.y, 0.26 - HINGE.z]);
  const breath = group(head, [0, nostrils[0].y + 0.01, nostrils[0].z + 0.03]);
  const chest = group(body, [0.1, 0.62, 0.3]);
  const coilTop = group(body, [0, 0.46, -0.05]);
  const anchors: Record<string, THREE.Object3D> = {
    mouth: mouthA,
    tongue: tongueTip,
    jaw: jawTip,
    breath,
    chest,
    coil: coilTop,
    hornL: hornTips[1],
    hornR: hornTips[0],
    tailTip,
  };
  pillarTops.forEach((g, i) => (anchors[`pillar${i + 1}`] = g));
  const rig = { head: face, eyes: eyeAnchors, anchors };

  // Static parts merged (mesh budget SR 60): groups that move act as owners; the body's lofted tube deforms every frame and the eye highlights are not merged.
  // The fangs and tongue are normally hidden, and merging only sees parts that are displayed, so show them first and then merge (pitfall 99)
  fangG.visible = true;
  tongueG.visible = true;
  mergeStatic(root, {
    owners: [body, headG, head, jawG, fangG, tongueG, pillarG, ...pupils],
    keep: [tubeMesh, ...glints],
    rig,
  });
  update(0);
  return { root, update, act, rig, center: new THREE.Vector3(0, 0.66, 0), radius: 0.86 };
}
