// Chime Sprite (model lab version, SR, light): a little sprite born in the bell tower of the Dawnlight Holy City, whose chime can light up whatever hides in the dark; the clergy of the Holy See all want its blessing.
// Body shape: it is a bell that has come alive. No wings, no humanoid form and no face: a bell has no features to begin with, and the focus is on the light inside the bell mouth.
// Floating in midair with the bell mouth slanting forward (like the instant it is struck), the whole bell swinging gently about the crown; the clapper (the pendulum inside the bell) is a light orb condensed from morning light.
// Identifying features:
// 1. Inside the bell mouth is a daybreak: the inner wall runs from apricot gold at the lip, turning rose red going up, to the pre-dawn blue-purple at the deepest point, and the clapper's light orb hanging at the lip is the sun just rising.
// 2. A rose-gold cast bell: a thick lip and sound bow (the wall thickness can be seen), five raised cast bands, and a ring of raised wave vine and round studs on the shoulder;
//    the raised parts are bright (pale gold) from being struck and touched, and the recessed corners collect a line of verdigris, the look only an old bell tower's bell has.
// 3. The canons on the crown are cast as a small six-petaled coronet, with an upright ring in the exact center tied to a hemp rope; the rope is flung out to one side and hangs down from the back as a tail, the end curling up,
//    and where the hand grips is a navy, cream and gold woolen grip sleeve (the sally of a belfry bell rope).
// Back: the back of the bell is cast with the sunrise emblem of the Dawnlight Holy City (a verdigris ground, a pale gold half sun, seven sun rays, a horizon line and two reflections), and the blessing the clergy seek is this mark; the hemp-rope tail is on the back too.
// Personality in one line: an earnest, curious little dawn-announcing bell: it must ring as soon as the day breaks, and wherever something is hiding it turns its bell mouth over to light it up.
// Gaze order: the light orb in the bell mouth and the daybreak inner wall first, the silhouette of the bell body (crown, cast bands, bright lip) second, and the grip sleeve on the rope tail and the emblem on the back as support.
// "Looking" is the bell mouth turning: when idle the bell mouth slowly turns left and right to look for something.
// Action table: idle is floating up and down and swinging lightly about the crown, and every few seconds the clapper swings over and strikes the lip with a "dong", the bell body trembling, the light orb flaring and the rope tail flicking;
// move presses the bell mouth forward and drags the rope tail back; charge-up act.glow lifts the bell mouth to aim at the target and gradually brightens the light orb and inner wall; strike act.ring swings the whole bell and the clapper strikes hard, with light shining out of the bell mouth (mouth);
// hit swings back and trembles with a hum, the light dimming once and then brightening back; victory strikes three times in a row and the rope tail whips around once.
// Anchors: head (center of the bell body), eyes is empty (no eyes), mouth (center of the bell mouth, where light shines out), core (the clapper's light orb),
// crown (the upright ring on the crown), sally (the grip sleeve on the rope tail), emblem (the emblem on the back).

import * as THREE from 'three';
import { curveTable, mergeStatic, partKit, PI, type LabModel, type V3 } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const ss = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

// ───────────────────────── Bell profile (y is the height from the lip) ─────────────────────────

/** Height of the crown (the top face of the canon base); the bell's swing pivot is here */
const TOP = 0.847;
/** Outer wall radius, not including the cast bands */
const OUT = curveTable([[0, 0.5], [0.04, 0.5], [0.09, 0.487], [0.15, 0.456], [0.22, 0.41], [0.3, 0.372], [0.4, 0.347], [0.5, 0.334], [0.6, 0.327], [0.66, 0.322]]);
const ro = (y: number) => OUT(y)[0];
/** The angle the outer wall normal tilts upward (the bell body flares downward, with the normal facing outward and up) */
const slope = (y: number) => Math.atan2(-(ro(y + 0.004) - ro(y - 0.004)) / 0.008, 1);
/** Cast bands: [height, half width, bulge] */
const CORDS: [number, number, number][] = [
  [0.085, 0.009, 0.008],
  [0.13, 0.009, 0.008],
  [0.295, 0.011, 0.009],
  [0.535, 0.011, 0.009],
  [0.645, 0.011, 0.009],
];

// ───────────────────────── Helpers ─────────────────────────

/** Subdivide the triangles of non-indexed geometry until no edge exceeds maxLen (positions and normals linearly interpolated), so that when laid onto a curved surface they do not sink in */
function subdivide(g0: THREE.BufferGeometry, maxLen: number): THREE.BufferGeometry {
  const g = g0.index ? g0.toNonIndexed() : g0;
  if (!g.attributes.normal) g.computeVertexNormals();
  const P = g.attributes.position.array as ArrayLike<number>;
  const N = g.attributes.normal.array as ArrayLike<number>;
  const pos: number[] = [];
  const nor: number[] = [];
  type Vt = [number, number, number, number, number, number];
  const mid = (a: Vt, b: Vt): Vt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, (a[3] + b[3]) / 2, (a[4] + b[4]) / 2, (a[5] + b[5]) / 2];
  const d2 = (a: Vt, b: Vt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const m2 = maxLen * maxLen;
  const tri = (a: Vt, b: Vt, c: Vt, depth: number) => {
    const ab = d2(a, b);
    const bc = d2(b, c);
    const ca = d2(c, a);
    const mx = Math.max(ab, bc, ca);
    if (mx <= m2 || depth > 8) {
      for (const p of [a, b, c]) {
        pos.push(p[0], p[1], p[2]);
        nor.push(p[3], p[4], p[5]);
      }
      return;
    }
    if (mx === ab) {
      const m = mid(a, b);
      tri(a, m, c, depth + 1);
      tri(m, b, c, depth + 1);
    } else if (mx === bc) {
      const m = mid(b, c);
      tri(a, b, m, depth + 1);
      tri(a, m, c, depth + 1);
    } else {
      const m = mid(c, a);
      tri(a, b, m, depth + 1);
      tri(m, b, c, depth + 1);
    }
  };
  const at = (i: number): Vt => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2]];
  for (let i = 0; i < P.length / 3; i += 3) tri(at(i), at(i + 1), at(i + 2), 0);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

/**
 * Wrap design coordinates (x as arc length along the circumference, y up along the bell wall, z outward) onto the bell's outer wall: th0 is the azimuth of the center (0 = directly in front, +z), and y0 is the center's height from the lip.
 * The normals turn along with the same local frame, so the front face and bevels of the extruded plate keep their original shading.
 */
function wrapBell(g: THREE.BufferGeometry, th0: number, y0: number): THREE.BufferGeometry {
  const P = g.attributes.position as THREE.BufferAttribute;
  const N = g.attributes.normal as THREE.BufferAttribute;
  const c0 = Math.cos(slope(y0));
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i);
    const y = P.getY(i);
    const z = P.getZ(i);
    const yy = y0 + y * c0;
    const r = ro(yy);
    const ph = slope(yy);
    const th = th0 + x / r;
    const st = Math.sin(th);
    const ct = Math.cos(th);
    const sp = Math.sin(ph);
    const cp = Math.cos(ph);
    const Nn = [st * cp, sp, ct * cp];
    const U = [-sp * st, cp, -sp * ct];
    const T = [ct, 0, -st];
    P.setXYZ(i, r * st + Nn[0] * z, yy + Nn[1] * z, r * ct + Nn[2] * z);
    const nx = N.getX(i);
    const ny = N.getY(i);
    const nz = N.getZ(i);
    const o = [nx * T[0] + ny * U[0] + nz * Nn[0], nx * T[1] + ny * U[1] + nz * Nn[1], nx * T[2] + ny * U[2] + nz * Nn[2]];
    const l = Math.hypot(o[0], o[1], o[2]) || 1;
    N.setXYZ(i, o[0] / l, o[1] / l, o[2] / l);
  }
  P.needsUpdate = true;
  N.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
}

/**
 * Relief plate: after extruding the shape, the top face is at z = h and the bottom face is buried in the bell wall, wrapped onto the bell.
 * sub is the upper limit on the subdivision edge length: plates that are wide along the circumference (the emblem base, the horizon) must be subdivided so the front hugs the curved surface; narrow pointed leaves need not
 */
function relief(shape: THREE.Shape, h: number, bevel: number, th0: number, y0: number, curveSegments = 12, sub = 0): THREE.BufferGeometry {
  const depth = Math.max(0.001, h + 0.008 - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments });
  g.translate(0, 0, h - depth - bevel);
  g.deleteAttribute('uv');
  g.clearGroups();
  return wrapBell(sub ? subdivide(g, sub) : g, th0, y0);
}

/** Paint one vertex color over the whole geometry */
function tint(g: THREE.BufferGeometry, c: THREE.Color): THREE.BufferGeometry {
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}

/** Pointed leaf shape (sun ray): the base a round end of width w, tapering to a point along +y, length len */
function lancet(w: number, len: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, len);
  s.quadraticCurveTo(w * 0.55, len * 0.45, w * 0.5, w * 0.35);
  s.absarc(0, w * 0.35, w * 0.5, 0, -PI, true);
  s.quadraticCurveTo(-w * 0.55, len * 0.45, 0, len);
  return s;
}

/**
 * A round tube along a curve, with its own radius for each row (give 0 at the two ends to close them): returns the arc-length position s of every vertex, for bending vertex by vertex when idle.
 * Uses a parallel-transport frame so it does not twist at turns; twist gives the cross-section a three-strand undulation (hemp rope).
 */
function ropeTube(pts: THREE.Vector3[], rows: number[], rad: (s: number) => number, radial: number, twist: (s: number) => number) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const pos: number[] = [];
  const S: number[] = [];
  const Tn: THREE.Vector3[] = [];
  let Nf = new THREE.Vector3();
  let prevT = new THREE.Vector3();
  const q = new THREE.Quaternion();
  rows.forEach((s, i) => {
    const C = curve.getPointAt(s);
    const T = curve.getTangentAt(s).normalize();
    if (i === 0) {
      Nf = new THREE.Vector3(1, 0, 0).addScaledVector(T, -T.x).normalize();
    } else {
      q.setFromUnitVectors(prevT, T);
      Nf.applyQuaternion(q).addScaledVector(T, -Nf.dot(T)).normalize();
    }
    prevT = T.clone();
    Tn.push(T);
    const B = new THREE.Vector3().crossVectors(T, Nf);
    const r = rad(s);
    const tw = twist(s);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * PI * 2;
      const k = r * (1 + tw * Math.cos(3 * a - s * 70));
      pos.push(C.x + (Nf.x * Math.cos(a) + B.x * Math.sin(a)) * k, C.y + (Nf.y * Math.cos(a) + B.y * Math.sin(a)) * k, C.z + (Nf.z * Math.cos(a) + B.z * Math.sin(a)) * k);
      S.push(s);
    }
  });
  const idx: number[] = [];
  for (let i = 0; i < rows.length - 1; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      idx.push(a, b, a + radial, b, b + radial, a + radial);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Winding check: normals must face outward
  const P = g.attributes.position as THREE.BufferAttribute;
  const Nm = g.attributes.normal as THREE.BufferAttribute;
  const mi = Math.floor(rows.length / 2) * radial;
  const cm = curve.getPointAt(rows[Math.floor(rows.length / 2)]);
  const out = v(P.getX(mi), P.getY(mi), P.getZ(mi)).sub(cm);
  if (out.dot(v(Nm.getX(mi), Nm.getY(mi), Nm.getZ(mi))) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  // For a row that closes to a single point at the ends, the normal points directly along the tangent
  for (const [row, sgn] of [[0, -1], [rows.length - 1, 1]] as [number, number][]) {
    if (rad(rows[row]) > 1e-6) continue;
    const T = Tn[row];
    for (let j = 0; j < radial; j++) Nm.setXYZ(row * radial + j, T.x * sgn, T.y * sgn, T.z * sgn);
  }
  return { geo: g, S: Float32Array.from(S), curve };
}

// ───────────────────────── Shape ─────────────────────────

export function buildChimeSpriteLab(): LabModel {
  const RIMC = 0xffe6cc;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  // Glow on the inner wall: along the profile (uv's v: 0 at the top, 1 at the lip) from blue-purple through rose to apricot gold; around the circumference (u) sixteen radiating golden rays,
  // the rays converging at the top of the bell, so from the front they are a ring of morning light radiating from behind the light orb
  const glowTex = (() => {
    const W = 128;
    const H = 64;
    const data = new Uint8Array(W * H * 4);
    const cTop = col(0x1c1430);
    const cMid = col(0x86304e);
    const cLip = col(0xe0904e);
    const cRay = col(0xffc860);
    for (let k = 0; k < H; k++) {
      const t = (k + 0.5) / H;
      const base = cTop.clone().lerp(cMid, ss(t, 0.25, 0.7)).lerp(cLip, ss(t, 0.74, 1));
      const fade = ss(t, 0.12, 0.45) * (1 - ss(t, 0.9, 1));
      for (let i = 0; i < W; i++) {
        const u = (i + 0.5) / W;
        const ray = ss(0.5 + 0.5 * Math.cos(u * PI * 2 * 16), 0.45, 0.75);
        const c = base.clone().lerp(cRay, 0.5 * ray * fade).multiplyScalar(0.85 + 0.25 * ray * fade);
        data.set([Math.min(255, Math.round(c.r * 255)), Math.min(255, Math.round(c.g * 255)), Math.min(255, Math.round(c.b * 255)), 255], (k * W + i) * 4);
      }
    }
    const tex = new THREE.DataTexture(data, W, H);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  })();
  const M = {
    metal: vc(labToon(0xffffff, { ramp: 'metal', spec: 0.6, specTh: 0.992, rim: 0.45, rimColor: RIMC, speckle: 0.025 })),
    inner: vc(labToon(0xffffff, { ramp: 'gem', emissive: 0xffffff, emissiveAmt: 1, rim: 0 })),
    core: labToon(0xffc47a, { ramp: 'gem', emissive: 0xff8a2c, emissiveAmt: 0.75, rim: 0 }),
    rope: vc(labToon(0xffffff, { rim: 0.4, rimColor: RIMC })),
  };
  M.inner.emissiveMap = glowTex;
  M.inner.needsUpdate = true;
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const C = {
    body: col(0xc98b6d),
    polish: col(0xf3d494),
    patina: col(0x4f9484),
    top: col(0xb97d63),
  };

  const root = new THREE.Group();
  root.name = 'chime_sprite-lab';
  const { add, group } = partKit();
  const BASE = 5200;

  // The bell mouth slants forward (like the instant it is struck) and also tilts its head to one side, with the light in the bell mouth facing straight ahead
  const TILT = 0.55;
  const ROLL = 0.13;
  const PIV_Y = 1.15;
  const pose = group(root, [-0.12, 0, -0.16]);
  const float = group(pose);
  const pivot = group(float, [0, PIV_Y, 0]);
  pivot.rotation.order = 'YXZ';
  const bellG = group(pivot, [0, -TOP, 0]);

  // ── Outer wall of the bell body: lip, sound bow, five cast bands, shoulder, crown; polished on the raised parts and a line of verdigris in the recessed corners ──
  {
    const prof: [number, number][] = [];
    const tone: THREE.Color[] = [];
    const put = (r: number, y: number, c: THREE.Color) => {
      prof.push([r, y]);
      tone.push(c);
    };
    // Bell lip: from the inner edge around to the outer edge, a thick rounded lip
    const lipPts: [number, number][] = [[0.438, 0.016], [0.44, 0.007], [0.447, 0.001], [0.46, -0.003], [0.476, -0.004], [0.49, -0.001], [0.498, 0.006], [0.501, 0.017]];
    for (const [r, y] of lipPts) put(r, y, C.polish);
    // Bell body: ordinary sampling plus dense sampling near the cast bands
    const ys = new Set<number>();
    for (let y = 0.03; y < 0.66; y += 0.028) if (CORDS.every(([yc, w]) => Math.abs(y - yc) > w * 1.8)) ys.add(+y.toFixed(4));
    for (const [yc, w] of CORDS) for (const u of [-1.6, -1.3, -1, -0.8, -0.5, 0, 0.5, 0.8, 1, 1.3, 1.6]) ys.add(+(yc + u * w).toFixed(4));
    ys.add(0.66);
    for (const y of [...ys].sort((a, b) => a - b)) {
      let bump = 0;
      let c = C.body;
      for (const [yc, w, h] of CORDS) {
        const u = (y - yc) / w;
        if (Math.abs(u) < 1) bump += h * Math.sqrt(1 - u * u);
        if (Math.abs(u) < 0.85) c = C.polish;
        else if (Math.abs(u) <= 1.31) c = C.patina;
      }
      // The stretch of the sound bow near the lip is also polished a bit brighter
      if (y < 0.05) c = C.body.clone().lerp(C.polish, 0.35);
      put(ro(y) + bump, y, c);
    }
    // Shoulder: a quarter ellipse turning up to the crown
    for (let i = 1; i <= 10; i++) {
      const a = (i / 10) * (PI / 2);
      put(0.16 + 0.162 * Math.cos(a), 0.66 + 0.142 * Math.sin(a), C.body.clone().lerp(C.top, ss(i, 5, 10)));
    }
    put(0.1, 0.805, C.top);
    put(0.0001, 0.808, C.top);
    // The inner and outer walls must have the same segment count: so the polylines on both sides of the ring at the lip's inner edge coincide, otherwise they interpenetrate into a dashed line
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 64);
    const n = prof.length;
    const ca = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < ca.length / 3; i++) tone[i % n].toArray(ca, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    g.deleteAttribute('uv');
    add(bellG, g, M.metal).userData.inkGroup = BASE;
  }

  // ── Inner wall: laid out from the top toward the lip (normals facing inward), a daybreak gradient ──
  {
    const prof: [number, number][] = [[0.0001, 0.755], [0.1, 0.752], [0.18, 0.742], [0.235, 0.72], [0.268, 0.69], [0.285, 0.64], [0.292, 0.58], [0.296, 0.5], [0.303, 0.42], [0.318, 0.34], [0.342, 0.26], [0.372, 0.19], [0.402, 0.12], [0.423, 0.065], [0.435, 0.03], [0.438, 0.016]];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 64);
    const cTop = col(0x6a5494);
    const cMid = col(0xe0808a);
    const cLip = col(0xffd8a4);
    const P = g.attributes.position as THREE.BufferAttribute;
    const ca = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      const t = 1 - P.getY(i) / 0.755;
      cTop.clone().lerp(cMid, ss(t, 0.25, 0.7)).lerp(cLip, ss(t, 0.72, 1)).toArray(ca, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    add(bellG, g, M.inner).userData.inkGroup = BASE;
  }

  // ── Crown: the crown base, six canons, and the upright ring in the exact center ──
  const ringY = TOP + 0.094;
  {
    const plate: [number, number][] = [[0.17, 0.795], [0.178, 0.812], [0.174, 0.83], [0.156, 0.842], [0.1, TOP], [0.0001, TOP + 0.001]];
    add(bellG, tint(new THREE.LatheGeometry(plate.map(([r, y]) => new THREE.Vector2(r, y)), 40), C.body.clone().lerp(C.polish, 0.25)), M.metal);
    // The canons are cast as a small six-petaled coronet: a crown wall with thickness, the upper edge round-headed petals, and a smooth lip edge
    {
      const CR = 0.128;
      const cp: [number, number][] = [[CR + 0.012, -0.02], [CR + 0.014, 0.25], [CR + 0.012, 0.62], [CR + 0.006, 0.9], [CR - 0.002, 1.0], [CR - 0.011, 0.96], [CR - 0.016, 0.75], [CR - 0.017, 0.4], [CR - 0.017, -0.02]];
      const g = new THREE.LatheGeometry(cp.map(([r, y]) => new THREE.Vector2(r, y)), 96);
      const P = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < P.count; i++) {
        const th = Math.atan2(P.getX(i), P.getZ(i));
        const lobe = Math.pow(0.5 + 0.5 * Math.cos(6 * th), 2);
        const h = 0.036 + 0.056 * lobe;
        const y = P.getY(i);
        P.setY(i, TOP - 0.012 + (y > 0 ? y * h : y * 0.04));
      }
      g.deleteAttribute('normal');
      g.computeVertexNormals();
      add(bellG, tint(g, C.polish), M.metal);
    }
    add(bellG, tint(new THREE.LatheGeometry([[0.04, TOP - 0.004], [0.038, TOP + 0.012], [0.03, TOP + 0.026], [0.0001, TOP + 0.034]].map(([r, y]) => new THREE.Vector2(r, y)), 16), C.polish), M.metal);
    add(bellG, tint(new THREE.TorusGeometry(0.064, 0.024, 10, 32), C.polish), M.metal, [0, ringY, 0]);
  }

  // Small reliefs that never touch each other can be merged in the same batch (mergeStatic's share), saving the time of pairwise comparison; the lines between them and the bell wall and emblem base are as before
  const vine: THREE.Object3D[] = [];
  const glyphs: THREE.Object3D[] = [];
  // ── Cast pattern band on the shoulder: a raised wave pattern (vine) running around once, with a round stud in each curve ──
  // (a row of pointed leaves looks like a row of teeth from the side, so it is changed to a smooth wave pattern and round studs)
  {
    const Y0 = 0.59;
    const A = 0.021;
    const NW = 12;
    const K = NW * 16;
    const radial = 8;
    const TR = 0.0072;
    const pos: number[] = [];
    const idx: number[] = [];
    const Pt = (th: number) => {
      const y = Y0 + A * Math.sin(NW * th);
      const r = ro(y);
      return v(r * Math.sin(th), y, r * Math.cos(th));
    };
    for (let k = 0; k < K; k++) {
      const th = (k / K) * PI * 2;
      const C0 = Pt(th);
      const T = Pt(th + 1e-3).sub(Pt(th - 1e-3)).normalize();
      const y = C0.y;
      const ph = slope(y);
      const Nn = v(Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph));
      const B = new THREE.Vector3().crossVectors(T, Nn).normalize();
      const Nf = new THREE.Vector3().crossVectors(B, T).normalize();
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * PI * 2;
        pos.push(C0.x + (Nf.x * Math.cos(a) + B.x * Math.sin(a)) * TR, C0.y + (Nf.y * Math.cos(a) + B.y * Math.sin(a)) * TR, C0.z + (Nf.z * Math.cos(a) + B.z * Math.sin(a)) * TR);
      }
    }
    for (let k = 0; k < K; k++)
      for (let j = 0; j < radial; j++) {
        const a = k * radial + j;
        const b = k * radial + ((j + 1) % radial);
        const c = ((k + 1) % K) * radial + j;
        const d = ((k + 1) % K) * radial + ((j + 1) % radial);
        idx.push(a, c, b, b, c, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // Winding check: the normal of the first vertex must face outward (away from the tube center)
    const n0 = v(g.attributes.normal.getX(0), g.attributes.normal.getY(0), g.attributes.normal.getZ(0));
    if (n0.dot(v(pos[0], pos[1], pos[2]).sub(Pt(0))) < 0) {
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    vine.push(add(bellG, tint(g, C.polish), M.metal));
    // Round studs: one below each crest and one above each trough, half a sphere following the bell wall's normal
    const boss = new THREE.SphereGeometry(0.0115, 12, 6, 0, PI * 2, 0, PI / 2);
    for (let k = 0; k < NW * 2; k++) {
      const th = ((k + 0.5) / (NW * 2)) * PI * 2;
      const crest = Math.sin(NW * th) > 0;
      const y = Y0 + (crest ? -1 : 1) * A * 0.62;
      const r = ro(y) - 0.002;
      const ph = slope(y);
      const Nn = v(Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph));
      const m = add(bellG, tint(boss.clone(), C.polish), M.metal, [r * Math.sin(th), y, r * Math.cos(th)], [0, 0, 0], [1, 0.75, 1]);
      m.quaternion.setFromUnitVectors(v(0, 1, 0), Nn);
      vine.push(m);
    }
  }

  // ── Back: the sunrise emblem of the Dawnlight Holy City ──
  const EMB_Y = 0.41;
  {
    const TH = PI;
    const disc = new THREE.Shape();
    disc.absarc(0, 0, 0.088, 0, PI * 2, false);
    add(bellG, tint(relief(disc, 0.004, 0.0015, TH, EMB_Y, 36, 0.03), C.patina), M.metal);
    // Outer ring: a ring with thickness
    {
      const g = new THREE.TorusGeometry(0.093, 0.011, 8, 64);
      g.translate(0, 0, 0.004);
      g.deleteAttribute('uv');
      add(bellG, tint(wrapBell(g, TH, EMB_Y), C.polish), M.metal);
    }
    // Half sun
    const sun = new THREE.Shape();
    sun.moveTo(-0.034, -0.012);
    sun.absarc(0, -0.012, 0.034, PI, 0, true);
    sun.lineTo(-0.034, -0.012);
    glyphs.push(add(bellG, tint(relief(sun, 0.013, 0.003, TH, EMB_Y, 16, 0.03), C.polish), M.metal));
    // Horizon and two reflections
    const bar = (w: number, h: number, y: number) => {
      const s = new THREE.Shape();
      const r = h / 2;
      s.moveTo(-w / 2 + r, y - r);
      s.lineTo(w / 2 - r, y - r);
      s.absarc(w / 2 - r, y, r, -PI / 2, PI / 2, false);
      s.lineTo(-w / 2 + r, y + r);
      s.absarc(-w / 2 + r, y, r, PI / 2, PI * 1.5, false);
      return s;
    };
    glyphs.push(add(bellG, tint(relief(bar(0.15, 0.013, -0.019), 0.01, 0.003, TH, EMB_Y, 6, 0.03), C.polish), M.metal));
    glyphs.push(add(bellG, tint(relief(bar(0.09, 0.01, -0.041), 0.008, 0.0025, TH, EMB_Y, 6, 0.03), C.polish), M.metal));
    glyphs.push(add(bellG, tint(relief(bar(0.046, 0.009, -0.059), 0.008, 0.0025, TH, EMB_Y, 6), C.polish), M.metal));
    // Seven sun rays
    for (let k = 0; k < 7; k++) {
      const a = PI / 2 + (k - 3) * 0.36;
      const len = k % 2 === 0 ? 0.034 : 0.026;
      const s = lancet(0.012, len);
      const pts = s.getPoints(8);
      const rot = a - PI / 2;
      const moved = pts.map((p) => {
        const y = p.y + 0.042;
        return new THREE.Vector2(p.x * Math.cos(rot) - y * Math.sin(rot), p.x * Math.sin(rot) + y * Math.cos(rot) - 0.012);
      });
      glyphs.push(add(bellG, tint(relief(new THREE.Shape(moved), 0.009, 0.0025, TH, EMB_Y, 8), C.polish), M.metal));
    }
  }
  const emblem = group(bellG, [0, EMB_Y, -ro(EMB_Y) - 0.01]);

  // ── Clapper: an iron rod hanging to the lip, ending in a light orb condensed from morning light, with a small iron hammer head underneath ──
  const CLAP_Y = 0.745 - TOP;
  const clap = group(pivot, [0, CLAP_Y, 0]);
  // The bottom of the light orb is a little lower than the lip: mostly hidden in the bell mouth, with an arc showing below
  const BALL_Y = -0.675;
  {
    add(clap, tint(new THREE.CylinderGeometry(0.016, 0.022, 0.6, 10, 1), C.body), M.metal, [0, -0.3, 0]);
    // Light orb: a pear shape wider at the bottom and narrower at the top (the clapper's hammer head), fastened by an iron band at the top
    const ball = new THREE.LatheGeometry([[0.0001, -0.1], [0.045, -0.094], [0.075, -0.072], [0.09, -0.035], [0.088, 0.005], [0.074, 0.045], [0.05, 0.075], [0.026, 0.092], [0.0001, 0.096]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    add(clap, ball, M.core, [0, BALL_Y, 0]).userData.inkGroup = BASE + 20;
    add(clap, tint(new THREE.LatheGeometry([[0.022, -0.012], [0.04, -0.008], [0.046, 0.004], [0.04, 0.016], [0.022, 0.02]].map(([r, y]) => new THREE.Vector2(r, y)), 20), C.polish), M.metal, [0, BALL_Y + 0.088, 0]);
    // Hammer tail (flight): a short stretch of cast bronze extending out of the bell mouth below the light orb, so the clapper reads as a clapper
    add(clap, tint(new THREE.LatheGeometry([[0.0001, -0.075], [0.016, -0.07], [0.024, -0.052], [0.02, -0.03], [0.026, -0.014], [0.032, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)), 16), C.polish), M.metal, [0, BALL_Y - 0.085, 0]);
  }
  const core = group(clap, [0, BALL_Y, 0]);

  // ── Hemp rope tail: from the upright ring going back around the shoulder and hanging down, the middle a navy, cream and gold woolen grip sleeve and the end a small tuft of loosened hemp ──
  // The path is first designed in the untilted frame (the crown as origin) and then turned into the pivot's coordinates
  const unTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-TILT, 0, ROLL, 'YXZ')).invert();
  // The rope is flung out in the direction opposite to the bell top's tilt (+x), hanging down from the back, with the end curling back and up like a tail tip
  const ropePts = [v(-0.005, 0.03, -0.05), v(0.05, 0.075, -0.12), v(0.16, 0.045, -0.22), v(0.26, -0.08, -0.3), v(0.32, -0.26, -0.33), v(0.34, -0.46, -0.32), v(0.33, -0.62, -0.34), v(0.32, -0.74, -0.42), v(0.33, -0.76, -0.54), v(0.34, -0.68, -0.62)].map((p) => p.applyQuaternion(unTilt));
  const SAL0 = 0.56;
  const SAL1 = 0.72;
  const sf = (f: number) => lerp(SAL0, SAL1, f);
  const cHemp = col(0xcbb28a);
  const cHempDk = col(0xa88e68);
  const cNavy = col(0x2a4580);
  const cCream = col(0xf0e6d2);
  const cGold = col(0xe0ae48);
  const stripes: [number, THREE.Color][] = [
    [sf(0), cNavy],
    [sf(0.2), cCream],
    [sf(0.275), cGold],
    [sf(0.375), cCream],
    [sf(0.45), cNavy],
    [sf(0.675), cCream],
    [sf(0.75), cGold],
    [sf(0.85), cCream],
    [sf(0.925), cNavy],
  ];
  const rows: number[] = [];
  {
    const set = new Set<number>();
    for (let i = 0; i <= 60; i++) set.add(i / 60);
    for (const [s] of stripes) for (const d of [-0.003, 0.003]) set.add(s + d);
    for (const s of [SAL0 - 0.02, SAL0 - 0.008, SAL1 + 0.008, SAL1 + 0.02, 0.93, 0.945, 0.96, 0.975, 0.99]) set.add(s);
    rows.push(...[...set].filter((s) => s >= 0 && s <= 1).sort((a, b) => a - b));
  }
  const RR = 0.03;
  const ropeRad = (s: number) => {
    if (s <= 0 || s >= 1) return 0;
    const head = Math.min(1, Math.sqrt(s / 0.012));
    let r = RR * head;
    // Grip sleeve: a puffed woolen sleeve
    const sal = ss(s, SAL0 - 0.02, SAL0 + 0.004) * (1 - ss(s, SAL1 - 0.004, SAL1 + 0.02));
    r = lerp(r, 0.058, sal);
    // Rope tail: a ring of binding thread and then loosening into a small tuft
    if (s > 0.93 && s < 0.96) r = RR * 1.25;
    if (s >= 0.96) r = lerp(0.044, 0.0, ss(s, 0.978, 1)) * (0.75 + 0.25 * ss(s, 0.96, 0.975));
    return r;
  };
  const rope = ropeTube(ropePts, rows, ropeRad, 12, (s) => (s > SAL0 - 0.02 && s < SAL1 + 0.02) || s > 0.93 ? 0 : 0.12);
  {
    const g = rope.geo;
    const ca = new Float32Array(rope.S.length * 3);
    for (let i = 0; i < rope.S.length; i++) {
      const s = rope.S[i];
      let c = cHemp.clone().lerp(cHempDk, 0.5 + 0.5 * Math.cos(3 * ((i % 12) / 12) * PI * 2 - s * 70));
      if (s >= SAL0 && s <= SAL1) {
        for (const [s0, sc] of stripes) if (s >= s0) c = sc;
      }
      if (s > 0.93 && s < 0.96) c = cNavy;
      c.toArray(ca, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
  }
  const ropeMesh = add(pivot, rope.geo, M.rope);
  ropeMesh.userData.inkGroup = BASE + 30;
  ropeMesh.frustumCulled = false;
  const ropeRest = Float32Array.from(rope.geo.attributes.position.array as Float32Array);
  const ropeRestN = Float32Array.from(rope.geo.attributes.normal.array as Float32Array);
  const ropeRoot = ropePts[0].clone();
  // The rope-head knot: wrapped under the upright ring
  add(pivot, tint(new THREE.SphereGeometry(0.032, 12, 8), cHemp), M.rope, [0, 0.03, -0.02], [0, 0, 0], [1.15, 0.85, 1.1]).userData.inkGroup = BASE + 31;
  const SAL_MID = (SAL0 + SAL1) / 2;
  const sally = group(pivot, rope.curve.getPointAt(SAL_MID).toArray() as V3);

  const crown = group(pivot, [0, ringY - TOP, 0]);
  const head = group(bellG, [0, 0.42, 0]);
  const mouth = group(bellG, [0, 0.02, 0]);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: floating, swaying lightly, the bell mouth slowly turning left and right to look for something; every 4.6 seconds the clapper strikes the lip ──
  const act = { glow: 0, ring: 0 };
  const PER = 4.6;
  const HIT0 = 3.0;
  const qa = new THREE.Quaternion();
  const e = new THREE.Euler();
  const tmp = new THREE.Vector3();
  const tmpN = new THREE.Vector3();
  const ropeP = rope.geo.attributes.position as THREE.BufferAttribute;
  const ropeN = rope.geo.attributes.normal as THREE.BufferAttribute;
  const update = (t: number) => {
    float.position.y = Math.sin(t * 1.1) * 0.025;
    // Striking the bell: tau = 0 is the moment the clapper touches the lip
    let tau = (((t - HIT0) % PER) + PER) % PER;
    if (tau > PER - 0.5) tau -= PER;
    const wind = tau < 0 ? ss(tau, -0.5, 0) : 0;
    const after = tau >= 0 ? tau : 0;
    const hit = tau >= 0 ? Math.exp(-4.5 * after) : 0;
    const clapRoll = tau < 0 ? 0.46 * wind * wind : 0.46 * Math.exp(-5 * after) * Math.cos(9 * after);
    const bellRoll = tau < 0 ? -0.07 * wind : -0.07 * Math.exp(-3 * after) * Math.cos(5 * after);
    const shiver = tau >= 0 ? 0.012 * Math.exp(-9 * after) * Math.sin(80 * after) : 0;
    const ring = act.ring;
    pivot.rotation.x = -(TILT + 0.045 * Math.sin(t * 1.1) + act.glow * 0.18 - ring * 0.1) + shiver * 0.6;
    pivot.rotation.z = ROLL + 0.035 * Math.sin(t * 0.7) + bellRoll - ring * 0.12 + shiver;
    pivot.rotation.y = 0.14 * Math.sin(0.4 * (t - 1)) * (1 - act.glow);
    clap.rotation.x = TILT * 0.45 + 0.05 * Math.sin(t * 1.1 - 0.9) - act.glow * 0.12;
    clap.rotation.z = -ROLL * 0.45 + clapRoll + ring * 0.46;
    const flare = hit + ring;
    M.core.emissiveIntensity = 0.85 * (1 + 0.9 * flare + 0.8 * act.glow) + 0.05 * Math.sin(t * 2.3);
    M.inner.emissiveIntensity = 1 + 0.45 * flare + 0.5 * act.glow;
    // Rope tail: lags behind the bell body's swing and flicks when the bell is struck
    const ax = 0.1 * Math.sin(t * 1.1 - 1.5) - 0.06 * act.glow;
    const az = 0.07 * Math.sin(t * 0.75 + 0.5) - 1.2 * bellRoll - ring * 0.2;
    for (let i = 0; i < rope.S.length; i++) {
      const k = Math.pow(rope.S[i], 1.4);
      qa.setFromEuler(e.set(ax * k, 0, az * k));
      tmp.fromArray(ropeRest, i * 3).sub(ropeRoot).applyQuaternion(qa).add(ropeRoot);
      ropeP.setXYZ(i, tmp.x, tmp.y, tmp.z);
      tmpN.fromArray(ropeRestN, i * 3).applyQuaternion(qa);
      ropeN.setXYZ(i, tmpN.x, tmpN.y, tmpN.z);
    }
    ropeP.needsUpdate = true;
    ropeN.needsUpdate = true;
    const ks = Math.pow(SAL_MID, 1.4);
    qa.setFromEuler(e.set(ax * ks, 0, az * ks));
    sally.position.copy(rope.curve.getPointAt(SAL_MID)).sub(ropeRoot).applyQuaternion(qa).add(ropeRoot);
  };
  update(0);

  const rig = { head, eyes: [] as THREE.Object3D[], anchors: { mouth, core, crown, sally, emblem } };
  mergeStatic(root, {
    owners: [float, pivot, clap],
    keep: [ropeMesh],
    share: [vine, glyphs],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.75, 0), radius: 0.82 };
}
