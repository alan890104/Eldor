// Tidal Marlin (model lab version): the captains of Thunderstorm Strait treat it as a guardian god, and it alone dares to charge across the strait against the thunderclouds; every ship has a sword bill carved on its prow.
// Water and wind, R, first strike and guard breaking. Identifying features: 1. A long sword bill extending from the upper jaw, pointing slantwise at the thunderclouds in the sky, the sharpest stroke of the silhouette;
// 2. A big sail-like cobalt blue dorsal fin, covered in dark spots with fin rays along the top edge in segments and a scorched black notch burned into the middle by lightning; 3. Standing on the waves on its tail (a tail stand), the crescent-shaped deeply forked tail fin dipping into a ring of wave crest, with a row of pale blue vertical stripes along its side.
// Personality: a fearless vanguard captain, always the first to charge. Brow ridges pressed low toward the snout tip, big eyes looking straight ahead, mouth corners turning up and back.
// Gaze order: the face (white sclera, dark blue iris and highlights, dark brow ridges) first, the sword bill and the sail second, and the wave crest and tail fin as support. Back: a captain's red bandana is tied on the tail peduncle, with the knot on the back side and the two ends of the cloth streaming backward.
// Restrained light effects: no emissive, and the sword bill has only a hard specular highlight.
// <Action table> Idle: the tail fin whips quickly left and right to hold the body up, the whole fish sways slightly up and down and slowly looks left and right, the sail trembles, the wave crest rises and falls, and it blinks.
// Charge-up (act.charge): the body leans back and the whole sail stands up. Strike (act.thrust): thrusts forward along the direction of the sword bill. Hit: tilts backward with the tail fin whipping wildly and the eyes not closing.
// Anchors: head, eyes, mouth, billTip (sword tip), sail (highest point of the sail), sailNotch (lightning notch), tail (center of the tail fin), finL / finR (pectoral fin tips), splash (center of the wave crest), bandana (bandana knot).

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, smooth, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const FWD = v(0, 0, 1);
const ss = THREE.MathUtils.smoothstep;
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const frac = (x: number) => x - Math.floor(x);

// ───────────────────────── Helpers ─────────────────────────

function ringIndex(rows: number, J: number): number[] {
  const idx: number[] = [];
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < J; j++) {
      const a = i * J + j;
      const a1 = i * J + ((j + 1) % J);
      idx.push(a, a + J, a1, a + J, a1 + J, a1);
    }
  return idx;
}

function faceOut(g: THREE.BufferGeometry, i: number, want: THREE.Vector3): void {
  const nrm = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, i);
  if (nrm.dot(want) >= 0) return;
  const idx = g.index!.array as Uint32Array | Uint16Array;
  for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
  g.index!.needsUpdate = true;
  g.computeVertexNormals();
}

function capGeo(r: number, ang: number, seg = 20, rings = 3): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, seg, rings, 0, PI * 2, 0, ang).rotateX(PI / 2);
}

/** Eyelid: a spherical shell with +y as the top, turning only the front half×2 radians (the back half is buried in the head) */
function lidGeo(ri: number, ro: number, lip: number, seg = 20, half = 1.96): THREE.BufferGeometry {
  const prof: THREE.Vector2[] = [];
  const inner = [0, 0.45, 0.72, 0.88, 1];
  for (const f of inner) prof.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(f * lip)), ri * Math.cos(f * lip)));
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < 3; i++) {
    const b = (i / 3) * PI;
    const rad = c - Math.cos(b) * w;
    const tan = Math.sin(b) * w;
    prof.push(new THREE.Vector2(rad * Math.sin(lip) + tan * Math.cos(lip), rad * Math.cos(lip) - tan * Math.sin(lip)));
  }
  for (const f of [...inner].reverse()) prof.push(new THREE.Vector2(Math.max(1e-4, ro * Math.sin(f * lip)), ro * Math.cos(f * lip)));
  return smooth(new THREE.LatheGeometry(prof, seg, -half, half * 2));
}

/** A 2D smooth curve (uniform parameter) */
function spline2(pts: [number, number][]): (s: number) => [number, number] {
  const c = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  return (s) => {
    const p = c.getPoint(THREE.MathUtils.clamp(s, 0, 1));
    return [p.x, p.y];
  };
}

/**
 * A fin with thickness (xy plane, thickness along z): each cell along s is a lens-shaped cross-section ring running from the leading edge L(s) to the trailing edge T(s), with both edges rounded into lips;
 * where L and T coincide at s = 0 or 1 it closes to a point. color applies vertex colors by (s, h) (h 0 is the leading edge to 1 the trailing edge).
 */
function finGeo(L: (s: number) => [number, number], T: (s: number) => [number, number], th: (s: number, h: number) => number, S: number, J: number, color?: (s: number, h: number) => THREE.Color): THREE.BufferGeometry {
  const pos: number[] = [];
  const cl: number[] = [];
  for (let i = 0; i <= S; i++) {
    const s = i / S;
    const [lx, ly] = L(s);
    const [tx, ty] = T(s);
    for (let j = 0; j < J; j++) {
      const f = (j / J) * PI * 2;
      const h = (1 - Math.cos(f)) / 2;
      pos.push(lx + (tx - lx) * h, ly + (ty - ly) * h, th(s, h) * Math.sin(f));
      if (color) {
        const c = color(s, h);
        cl.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(ringIndex(S, J));
  g.computeVertexNormals();
  faceOut(g, Math.floor(S / 2) * J + Math.floor(J / 4), v(0, 0, 1));
  return g;
}

/** Make the object's x axis point along xDir and its z axis face zHint as far as possible */
function orientXZ(o: THREE.Object3D, xDir: THREE.Vector3, zHint: THREE.Vector3): void {
  const x = xDir.clone().normalize();
  const z = zHint.clone().addScaledVector(x, -zHint.dot(x)).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// ───────────────────────── Shape ─────────────────────────

export function buildSwordfishLab(): LabModel {
  const RIMC = 0xcfe6ff;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const cBack = col(0x1b3566);
  const cFlank = col(0x2f6cc0);
  const cBelly = col(0xe4ecf2);
  const cStripe = col(0x9fdcff);
  const cCheek = col(0xc8dcee);
  const M = {
    body: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    fin: vc(labToon(0xffffff, { rim: 0.5, rimColor: RIMC })),
    bill: labToon(0x2c3a5e, { ramp: 'metal', rim: 0.45, rimColor: RIMC, spec: 0.35, specTh: 0.9 }),
    gill: labToon(0x234684, { rim: 0.3 }),
    brow: labToon(0x15294f, { rim: 0.3 }),
    lid: labToon(0x2a5aa6, { rim: 0.4, rimColor: RIMC }),
    sclera: labToon(0xf6fbff, { rim: 0.15 }),
    iris: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    pupil: labToon(0x0a1224, { rim: 0 }),
    line: labToon(0x111a30, { rim: 0 }),
    water: vc(labToon(0xffffff, { rim: 0.35, rimColor: 0xe8f8ff })),
    foam: labToon(0xf2fbff, { rim: 0.2 }),
    cloth: labToon(0xc9413a, { rim: 0.4, rimColor: 0xffd8c8 }),
    clothDk: labToon(0xa0302c, { rim: 0.3, rimColor: 0xffd8c8 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name = k;

  const root = new THREE.Group();
  root.name = 'swordfish-lab';
  const { add, group } = partKit();
  const BODY = 9501;

  // Local coordinates of the fish body: snout tip toward +z, back toward +y; pose tilts the whole fish up so that it stands on the waves
  // stance: the whole fish turns a little toward its own right rear, so half the face and the sail show from the front (a tail-standing fish facing the camera squarely would show only the throat and belly)
  const PITCH = 0.9;
  const stance = group(root, [0, 0, 0], [0, -0.45, 0]);
  const pose = group(stance, [0, 0.95, 0.12]);
  pose.rotation.x = -PITCH;
  const fish = group(pose);

  // ── Body: spindle-shaped and flat from side to side, dark blue on the back, cobalt blue on the sides with pale blue vertical stripes, and silver-white on the belly ──
  const Z0 = -0.62;
  const Z1 = 0.5;
  const prof = curveTable([
    [0, 0, 0, 0, 0],
    [0.035, 0.026, 0.036, 0.034, 0],
    [0.14, 0.048, 0.07, 0.064, 0],
    [0.35, 0.098, 0.165, 0.148, 0.005],
    [0.55, 0.122, 0.195, 0.175, 0.005],
    [0.72, 0.118, 0.178, 0.158, 0],
    [0.86, 0.094, 0.138, 0.118, -0.01],
    [0.95, 0.062, 0.09, 0.07, -0.016],
    [1, 0, 0, 0, -0.02],
  ]);
  const zAt = (t: number) => Z0 + (Z1 - Z0) * t;
  const tAt = (z: number) => (z - Z0) / (Z1 - Z0);
  const surfP = (t: number, th: number, off = 0) => {
    const [a, bt, bb, cy] = prof(t);
    const sn = Math.sin(th);
    const b = sn >= 0 ? bt : bb;
    const p = v((a + off) * Math.cos(th), cy + (b + off) * sn, zAt(t));
    return p;
  };
  const surfN = (t: number, th: number) => {
    const e = 1e-3;
    const p = surfP(t, th);
    const dT = surfP(Math.min(1, t + e), th).sub(surfP(Math.max(0, t - e), th));
    const dA = surfP(t, th + e).sub(surfP(t, th - e));
    const n = new THREE.Vector3().crossVectors(dA, dT).normalize();
    const [, , , cy] = prof(t);
    if (n.dot(v(p.x, p.y - cy, 0)) < 0) n.negate();
    return n;
  };
  const bodyColor = (t: number, sn: number) => {
    const c = cBelly.clone().lerp(cFlank, ss(sn, -0.38, -0.02)).lerp(cBack, ss(sn, 0.28, 0.66));
    const ph = frac((t - 0.2) / 0.062);
    const stripe = (1 - ss(Math.abs(ph - 0.5), 0.1, 0.2)) * ss(t, 0.18, 0.24) * (1 - ss(t, 0.68, 0.74)) * ss(sn, -0.25, -0.05) * (1 - ss(sn, 0.42, 0.58));
    c.lerp(cStripe, stripe * 0.85);
    c.lerp(cCheek, ss(t, 0.76, 0.82) * (1 - ss(sn, -0.05, 0.2)) * 0.8);
    return c;
  };
  {
    const S = 110;
    const J = 24;
    const pos: number[] = [];
    const cl: number[] = [];
    for (let i = 0; i <= S; i++) {
      const t = i / S;
      for (let j = 0; j < J; j++) {
        const th = (j / J) * PI * 2;
        const p = surfP(t, th);
        pos.push(p.x, p.y, p.z);
        const c = bodyColor(t, Math.sin(th));
        cl.push(c.r, c.g, c.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    g.setIndex(ringIndex(S, J));
    g.computeVertexNormals();
    faceOut(g, 55 * J, v(1, 0, 0));
    add(fish, g, M.body).userData.inkGroup = BODY;
  }

  // ── Sword bill: a long conical sword extending from the upper jaw, slightly flattened ──
  const [, , , cySnout] = prof(0.96);
  const billG = group(fish, [0, cySnout + 0.012, 0.455]);
  add(billG, lathe([[0.001, -0.07], [0.028, -0.05], [0.037, 0], [0.032, 0.1], [0.024, 0.28], [0.014, 0.46], [0.006, 0.57], [0.001, 0.6]], 12).rotateX(PI / 2), M.bill, [0, 0, 0], [0, 0, 0], [1, 0.82, 1]);
  const billTip = group(billG, [0, 0, 0.6]);

  // ── Mouth line and gill cover: the mouth runs back from under the snout along the lower jaw, with the corner hooking up (smug); the gill cover is a raised arc ──
  for (const sx of [-1, 1]) {
    const S = (t: number, th: number, off: number) => {
      const p = surfP(t, th, off);
      p.x *= sx;
      return p;
    };
    const mouth = [S(0.975, -0.4, 0.002), S(0.94, -0.56, 0.003), S(0.9, -0.62, 0.003), S(0.862, -0.58, 0.003), S(0.842, -0.44, 0.003), S(0.838, -0.3, 0.002)];
    add(fish, loft(mouth, (t) => [0.0068 * (0.45 + 0.55 * Math.sin(PI * Math.min(1, t * 1.1))), 0.0068 * (0.45 + 0.55 * Math.sin(PI * Math.min(1, t * 1.1)))], { segs: 18, radial: 6 }), M.line);
    const gill = [S(0.79, 0.62, 0.001), S(0.772, 0.25, 0.003), S(0.768, -0.2, 0.003), S(0.785, -0.62, 0.001)];
    add(fish, loft(gill, (t) => [0.0075 * Math.pow(Math.sin(PI * t), 0.5), 0.0075 * Math.pow(Math.sin(PI * t), 0.5)], { segs: 16, radial: 6 }), M.gill);
  }

  // ── Eyes: a big eye on the side of the head, turned a little forward (both can be seen from the front); white sclera, dark blue iris, two highlights, and above it a dark brow ridge pressed low toward the snout tip ──
  const ER = 0.052;
  const EYE_T = 0.855;
  const EYE_TH = 0.3;
  const UP_OPEN = 0.9;
  const LO_SHUT = 0.98;
  const lids: THREE.Group[] = [];
  const gazes: THREE.Group[] = [];
  const glints: THREE.Object3D[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const lidUp = lidGeo(ER + 0.003, ER + 0.009, PI / 2);
  const hiGeo = new THREE.SphereGeometry(1, 10, 6);
  const cIris = col(0x173c86);
  const cIrisLo = col(0x3fa2e6);
  const irisGeo = capGeo(ER + 0.0008, 0.78, 28, 4);
  {
    const pa = irisGeo.attributes.position as THREE.BufferAttribute;
    const cl: number[] = [];
    for (let i = 0; i < pa.count; i++) {
      const c = cIris.clone().lerp(cIrisLo, ss(-pa.getY(i) / ER, 0.0, 0.6));
      cl.push(c.r, c.g, c.b);
    }
    irisGeo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  }
  for (const sx of [-1, 1]) {
    const th = sx > 0 ? EYE_TH : PI - EYE_TH;
    const sp = surfP(EYE_T, th);
    const n = surfN(EYE_T, th);
    const d = n.clone().add(v(0, 0.08, 0.55)).normalize();
    const c = sp.clone().addScaledVector(n, -ER * 0.5);
    const eg = group(fish, [c.x, c.y, c.z]);
    eg.quaternion.setFromUnitVectors(FWD, d);
    const roll = group(eg);
    // After setFromUnitVectors the eye's y axis does not necessarily point up: turn it back so the "up" of the eyelid and brow ridge lines up with the fish's back
    {
      const upW = v(0, 1, 0).applyQuaternion(eg.quaternion);
      const want = v(0, 1, 0).addScaledVector(d, -d.y).normalize();
      const ang = Math.atan2(new THREE.Vector3().crossVectors(upW, want).dot(d), upW.dot(want));
      roll.rotation.z = ang;
    }
    add(roll, capGeo(ER, 1.35, 22, 7), M.sclera);
    const gaze = group(roll, [0, 0, 0], [-0.04, -sx * 0.3, 0]);
    gazes.push(gaze);
    add(gaze, irisGeo, M.iris, [0, 0, 0], [0, 0, 0], [1, 1.06, 1]);
    add(gaze, capGeo(ER + 0.0018, 0.4, 24, 2), M.pupil, [0, 0, 0], [0, 0, 0], [1, 1.1, 1]);
    for (const [lon, lat, r] of [[-0.3, 0.36, 0.013], [0.32, -0.36, 0.0065]] as [number, number, number][]) {
      const q = v(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
      const hl = add(gaze, hiGeo, M.hi, [q.x * (ER + 0.004), q.y * (ER + 0.004), q.z * (ER + 0.004)], [0, 0, 0], [r, r, r * 0.45]);
      hl.quaternion.setFromUnitVectors(FWD, q);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    eyeAnchors.push(group(gaze, [0, 0, ER]));
    // The upper lid is slightly lower on the side toward the snout (focused), while overall it is still wide open
    const lidRoll = group(roll, [0, 0, 0], [0, 0, sx * 0.12]);
    const upper = group(lidRoll, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.lid).userData.inkGroup = BODY;
    lids.push(upper);
    // Brow ridge: a thick dark ridge above the eye, high at the back and low at the front (pressing down toward the snout), the front end extending slightly past the eye corner
    const fx = -sx; // The eye's local x toward -sx is forward (toward the snout)
    const brow = [v(-fx * ER * 1.0, ER * 1.0, ER * 0.42), v(-fx * ER * 0.3, ER * 1.16, ER * 0.66), v(fx * ER * 0.55, ER * 1.06, ER * 0.72), v(fx * ER * 1.2, ER * 0.7, ER * 0.6)];
    add(roll, loft(brow, (t) => {
      const k = Math.pow(Math.sin(PI * (0.08 + 0.84 * t)), 0.6);
      return [0.016 * k, 0.011 * k];
    }, { segs: 14, radial: 8 }), M.brow);
  }

  // ── Sail: a big dorsal fin stretched from behind the head to the middle of the back, high in front and low behind, with fin rays along the top edge in segments and a lightning notch in the middle (scorched edge) ──
  const sailG = group(fish);
  const NOTCH = 0.4;
  {
    const nR = 13;
    const baseZ = (s: number) => THREE.MathUtils.lerp(0.245, -0.34, s);
    const baseY = (s: number) => {
      const [, bt, , cy] = prof(tAt(baseZ(s)));
      return cy + bt - 0.03;
    };
    const H = curveTable([[0, 0.05], [0.06, 0.4], [0.18, 0.47], [0.4, 0.41], [0.62, 0.3], [0.85, 0.17], [1, 0.02]]);
    const notch = (s: number) => Math.max(0, 1 - Math.abs(s - NOTCH) / 0.055);
    const topY = (s: number) => {
      const scal = 0.02 * Math.pow(Math.sin(PI * frac(s * nR)), 2);
      const jag = notch(s) * (0.17 + 0.03 * Math.sin(s * 240));
      return baseY(s) + H(s)[0] - scal - jag;
    };
    const L = (s: number): [number, number] => [baseZ(s), baseY(s)];
    const T = (s: number): [number, number] => [baseZ(s) - 0.05 - 0.04 * s, topY(s)];
    const cSail = col(0x2f62c8);
    const cSailLt = col(0x5a8fe0);
    const cSpot = col(0x152a58);
    const cBurn = col(0x1a1a24);
    const g = finGeo(L, T, (s, h) => (0.013 * (1 - 0.55 * h) + 0.002) * ss(s, 0, 0.03), 60, 20, (s, h) => {
      const c = cSail.clone().lerp(cSailLt, ss(h, 0.55, 0.95) * 0.5).lerp(cBack, (1 - ss(h, 0.0, 0.18)) * 0.7);
      const spot = ss(Math.sin(s * 47 + h * 3) * Math.sin(h * 15 + s * 8), 0.55, 0.75) * ss(h, 0.15, 0.3);
      c.lerp(cSpot, spot * 0.85);
      c.lerp(cBurn, ss(notch(s), 0.15, 0.6) * ss(h, 0.62, 0.85) * 0.85);
      return c;
    });
    g.rotateY(-PI / 2);
    add(sailG, g, M.fin);
  }
  const sailTop = group(sailG, [0, prof(tAt(0.14))[2] + 0.46, 0.13]);
  const sailNotch = group(sailG, [0, 0.36, 0.0]);

  // ── Anal fin: a small sickle fin under the belly ──
  {
    const baseZ = (s: number) => THREE.MathUtils.lerp(-0.14, -0.36, s);
    const baseY = (s: number) => {
      const [, , bb, cy] = prof(tAt(baseZ(s)));
      return cy - bb + 0.025;
    };
    const L = (s: number): [number, number] => [baseZ(s), baseY(s)];
    const T = (s: number): [number, number] => [baseZ(s) - 0.07 - 0.03 * s, baseY(s) - (0.16 * (1 - s) + 0.02) * ss(s, 0, 0.1)];
    const g = finGeo(L, T, (s, h) => (0.01 * (1 - 0.5 * h) + 0.002) * ss(s, 0, 0.05), 16, 12, (_s, h) => cBack.clone().lerp(cFlank, h * 0.4));
    g.rotateY(-PI / 2);
    add(fish, g, M.fin);
  }

  // ── Tail fin: a crescent-shaped deep fork, with the tail peduncle as a joint whipping left and right ──
  const TAIL_Z = -0.57;
  const tailG = group(fish, [0, 0, TAIL_Z]);
  {
    const L = spline2([[-0.95, 0.43], [-0.8, 0.28], [-0.67, 0.11], [-0.6, 0.0], [-0.665, -0.1], [-0.78, -0.24], [-0.93, -0.38]]);
    const T = spline2([[-0.95, 0.43], [-0.9, 0.31], [-0.83, 0.15], [-0.77, 0.0], [-0.82, -0.13], [-0.88, -0.26], [-0.93, -0.38]]);
    const g = finGeo(L, T, (s, h) => 0.022 * Math.pow(Math.sin(PI * s), 0.6) * (1 - 0.55 * h) + 0.0015, 36, 12, (_s, h) => cBack.clone().lerp(cFlank, (1 - ss(h, 0.0, 0.3)) * 0.35));
    g.rotateY(-PI / 2);
    g.translate(0, 0, -TAIL_Z);
    add(tailG, g, M.fin);
  }
  const tailC = group(tailG, [0, 0.02, -0.2]);

  // ── Pectoral fins: two long sickle fins below and behind the head, spreading backward and outward ──
  const pecs: { g: THREE.Group; sx: number; q: THREE.Quaternion }[] = [];
  const finTips: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const th = sx > 0 ? -0.5 : PI + 0.5;
    const p = surfP(0.7, th, -0.012);
    const g = group(fish, [p.x, p.y, p.z]);
    orientXZ(g, v(sx * 0.55, -0.4, -0.72), v(0, -sx, 0));
    const L = spline2([[0, 0.036], [0.12, 0.042], [0.25, 0.024], [0.35, -0.02], [0.42, -0.07]]);
    const T = spline2([[0, -0.036], [0.1, -0.03], [0.22, -0.036], [0.34, -0.055], [0.42, -0.07]]);
    add(g, finGeo(L, T, (s, h) => (0.013 * Math.pow(1 - s, 0.5) + 0.002) * (1 - 0.4 * h), 20, 10, (_s, h) => cBack.clone().lerp(cFlank, (1 - h) * 0.3)), M.fin);
    pecs.push({ g, sx, q: g.quaternion.clone() });
    finTips.push(group(g, [0.42, -0.07, 0]));
  }

  // ── Red bandana on the tail peduncle: tied on by the captain, the knot on the back side and the two ends of the cloth streaming backward ──
  const BT = 0.1;
  const [ba, bbt, bbb, bcy] = prof(BT);
  const bandG = group(fish, [0, bcy, zAt(BT)]);
  {
    const A = ba / 0.86 + 0.004;
    const B = Math.max(bbt, bbb) / 0.86 + 0.004;
    add(bandG, new THREE.TorusGeometry(1, 0.14, 8, 24), M.cloth, [0, 0, 0], [0, 0, 0], [A, B, 0.2]);
  }
  const knot = group(bandG, [0, Math.max(bbt, bbb) + 0.012, 0]);
  add(knot, new THREE.SphereGeometry(1, 12, 8), M.clothDk, [0, 0, 0], [0, 0, 0], [0.024, 0.018, 0.026]);
  const ribbons: { g: THREE.Group; ph: number; q: THREE.Quaternion }[] = [];
  for (const sx of [-1, 1]) {
    const g = group(knot);
    orientXZ(g, v(sx * 0.4, 0.45, -0.8), v(sx, 0, 0.2));
    const len = sx > 0 ? 0.2 : 0.16;
    const L = (s: number): [number, number] => [len * s, 0.017 * (1 - s * 0.6) + 0.018 * Math.sin(s * 5)];
    const T = (s: number): [number, number] => [len * s + 0.02 * s * s, -0.017 * (1 - s * 0.6) + 0.018 * Math.sin(s * 5) + 0.02 * s * s];
    add(g, finGeo(L, (s) => (s > 0.999 ? L(1) : T(s)), () => 0.005, 14, 8), M.cloth);
    ribbons.push({ g, ph: sx > 0 ? 0 : 1.9, q: g.quaternion.clone() });
  }

  // ── Wave crest: a ring of spray turned upward, low in front and high behind, with a white foam bead at the wave tip; a bulge of water surface below ──
  const SPC = v(0, 0, -0.2);
  const splashG = group(stance, [SPC.x, 0, SPC.z]);
  const cDeep = col(0x2f7ec8);
  const cSea = col(0x5fb0e6);
  const cFoamC = col(0xdff4ff);
  {
    // The lathe profile is ordered from the outside in: a profile surface running from the center outward would face down and cannot be seen from above
    const mound = lathe([[0.56, 0.0], [0.5, 0.012], [0.38, 0.03], [0.2, 0.046], [0.001, 0.05]], 40);
    const pa = mound.attributes.position as THREE.BufferAttribute;
    const cl: number[] = [];
    for (let i = 0; i < pa.count; i++) {
      const r = Math.hypot(pa.getX(i), pa.getZ(i));
      const c = cFoamC.clone().lerp(cSea, ss(r, 0.1, 0.24)).lerp(cDeep, ss(r, 0.3, 0.52));
      cl.push(c.r, c.g, c.b);
    }
    mound.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    add(splashG, mound, M.water);
  }
  const lobes: THREE.Group[] = [];
  const NL = 9;
  for (let i = 0; i < NL; i++) {
    const a = (i / NL) * PI * 2 + 0.25;
    const dir = v(Math.cos(a), 0, Math.sin(a));
    const back = ss(-Math.sin(a), -0.4, 1);
    const h = 0.14 + 0.18 * back;
    const r0 = 0.2 + 0.03 * back;
    const lg = group(splashG, [dir.x * r0, 0, dir.z * r0]);
    const pts = [v(0, -0.02, 0), v(0, h * 0.45, 0).addScaledVector(dir, 0.03), v(0, h * 0.85, 0).addScaledVector(dir, 0.08), v(0, h, 0).addScaledVector(dir, 0.14), v(0, h * 0.93, 0).addScaledVector(dir, 0.18)];
    const side = v(-dir.z, 0, dir.x);
    const geo = loft(pts, (t) => [(0.062 * (1 - t) + 0.02) * (0.7 + 0.3 * back), 0.03 * (1 - t) + 0.014], { segs: 14, radial: 10, side });
    const pa = geo.attributes.position as THREE.BufferAttribute;
    const cl: number[] = [];
    for (let k = 0; k < pa.count; k++) {
      const c = cSea.clone().lerp(cFoamC, ss(pa.getY(k) / h, 0.45, 0.85));
      cl.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    add(lg, geo, M.water);
    const tip = pts[4];
    add(lg, new THREE.SphereGeometry(1, 12, 8), M.foam, [tip.x, tip.y, tip.z], [0, 0, 0], [0.03, 0.026, 0.03]);
    lobes.push(lg);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  const headP = surfP(0.9, 0).setX(0);
  const mouthP = surfP(0.955, -PI / 2, 0.004);
  const rig = {
    head: group(fish, [0, headP.y, headP.z]),
    eyes: eyeAnchors,
    anchors: {
      mouth: group(fish, [0, mouthP.y, mouthP.z]),
      billTip,
      sail: sailTop,
      sailNotch,
      tail: tailC,
      finL: finTips[0],
      finR: finTips[1],
      splash: group(splashG, [0, 0.16, 0]),
      bandana: knot,
    },
  };
  const act = { charge: 0, thrust: 0 };

  mergeStatic(root, {
    owners: [pose, fish, tailG, sailG, splashG, bandG, knot, ...lobes, ...pecs.map((p) => p.g), ...ribbons.map((r) => r.g), ...gazes, ...lids],
    keep: [...glints],
    rig,
  });

  // ── Idle: the tail fin whips quickly left and right to hold the body up, the whole fish sways slightly up and down and slowly looks left and right, the sail trembles, the wave crest rises and falls, and it blinks ──
  let blinkIn = 2.4;
  let blinkT = -1;
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const update = (t: number, dt: number) => {
    const ch = act.charge;
    const th = act.thrust;
    pose.position.set(0, 0.95 + Math.sin(t * 2.1) * 0.018 + th * 0.14, 0.12 + th * 0.28);
    pose.rotation.set(-PITCH + Math.sin(t * 1.05) * 0.025 + ch * 0.2 - th * 0.12, Math.sin(t * 0.37) * 0.14, Math.sin(t * 0.7) * 0.03);
    tailG.rotation.y = Math.sin(t * 4.2) * 0.2 * (1 + ch * 0.5);
    sailG.rotation.z = Math.sin(t * 2.6) * 0.025;
    sailG.scale.set(1, 1 + ch * 0.1, 1);
    for (const p of pecs) {
      e.set(0, Math.sin(t * 1.6 + p.sx) * 0.08, p.sx * Math.sin(t * 1.3) * 0.06);
      p.g.quaternion.copy(p.q).multiply(q.setFromEuler(e));
    }
    for (const r of ribbons) {
      e.set(Math.sin(t * 5.2 + r.ph) * 0.12, Math.sin(t * 3.7 + r.ph) * 0.15, 0);
      r.g.quaternion.copy(r.q).multiply(q.setFromEuler(e));
    }
    for (let i = 0; i < lobes.length; i++) lobes[i].scale.set(1, 1 + Math.sin(t * 4.2 + i * 1.3) * 0.08, 1);
    splashG.rotation.y = t * 0.15;
    for (const g of gazes) g.rotation.x = -0.04 + Math.sin(t * 0.47) * 0.04;

    blinkIn -= dt;
    if (blinkIn <= 0) {
      blinkT = 0;
      blinkIn = 2.8 + ((t * 7.3) % 3);
    }
    let close = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const k = blinkT / 0.18;
      close = k < 1 ? Math.min(1, Math.sin(k * PI) * 1.3) : 0;
      if (k >= 1) blinkT = -1;
    }
    for (const l of lids) l.rotation.x = -UP_OPEN + (UP_OPEN + LO_SHUT) * close;
    for (const g of glints) g.visible = close < 0.6;
  };
  update(0, 0);

  return { root, update, center: new THREE.Vector3(0, 0.95, -0.05), radius: 1.02, rig, act };
}
