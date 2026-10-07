// Soul Lantern (model lab version, SR, dark): a spirit that patrols the Gloom Realm carrying a dim blue lantern; it guides lost spirits and also leads greedy people into deeper darkness.
// The body shape grows out of the name: with no one carrying the lantern, the spirit is the whole "soul-guiding pole" itself. A smoke-blackened bamboo pole floats by itself a palm's width above the ground,
// with a bronze curved hook at its top hanging a dim blue paper lantern (a chochin); the pole bends and bows like a neck, and the lamp is its head. A lamp and an object have no face to begin with, so no features are added.
// Identifying features:
//   1. A paper lantern held up by segmented bamboo ribs: black-lacquered wooden rings clamp it at top and bottom, the paper dips slightly inward between the bamboo ribs, and the soul fire inside lights the whole paper dim blue (the only emissive on the whole body).
//   2. The bronze curved hook at the top of the pole: curving forward into a question mark, the end curling back into a small whorl, with two copper rings below it holding the lamp; inside the hook there is also a small ruyi-scroll brace.
//   3. The tassel under the lamp: three square-holed copper coins strung on a cord, with a bunch of indigo silk tassel below. The coins are for greedy people to see, and when the lamp swings the coins glint.
//   4. The soul-guiding banner: a small crossbar behind the top of the pole lets a gray-white paper-cut banner hang down, the two sides cut into zigzags and the lower edge cut into a row of small teeth, blown backward by the wind of the Gloom Realm.
// Body shape: a floating lamp pole, with the pole bottom leaning back and the pole waist and top bending forward into a bowing arc; a bronze spike ferrule at the pole bottom hangs off the ground and does not touch it. From the side it is a question-mark shape, with the lamp hanging in front.
// Personality: a courteous, silent guide: always bowing slightly, holding the lamp out in front of you and patiently waiting for you to catch up; the string of copper coins under the lamp is for greedy people to see.
// Gaze order: the dim blue lantern (the brightest and biggest, taking up about half the height) → the bronze curved hook at the top of the pole and the glinting copper coins under the lamp → the bamboo pole, banner and the extinguished lamps at the back are all darkened as support.
// Back: behind the middle of the pole is a bronze lamp bracket hanging a string of two extinguished small lanterns (dark gray paper, no light), the lamps of the greedy people who followed it into the darkness and never came back;
//   the soul-guiding banner floats behind the top of the pole.
// Materials: smoke-blackened bamboo pole (node rings one step paler, with rim light), black-lacquered wooden rings (hard highlights), bamboo ribs (dark brown), glowing lamp paper, old bronze (four steps plus hard highlights), gray-white paper-cut, indigo silk tassel and cord.
// Silhouette of the dark main body: the bamboo pole and lacquer rings use pale blue rim light, with the bamboo node rings one step lighter than the pole; the bronze parts are warm-colored and pick out the top and bottom of the pole in the dark scene.
// Action table (act, 0-1; all 0 is idle):
//   Idle: the whole pole floats in the air bobbing slowly up and down, and its three sections bow slightly and straighten again like breathing; the top of the pole turns left and right now and then, as if looking at the road;
//     the lantern swings like a pendulum half a beat behind, the tassel another half beat behind, the copper coins each turn slowly and glint in turn; the light of the lamp paper flickers faintly; the banner flutters with the wind; the small lanterns at the back swing along.
//   Move: the pole leans forward and glides along flat, with the lamp trailing back a little.
//   Charge-up (glow): the light of the lamp paper strengthens.
//   Strike (swing): the pole whips forward, delivering the lamp in front of the opponent (soul flames and the hanging lamp go out from the lamp).
//   Hit: the pole bends backward and the whole thing shakes, the lamp swings wildly, but the light does not go out.
//   Victory (bow): the top of the pole slowly takes a deep bow forward, the lamp drops to its lowest, and then returns to its place.
// Anchors: head (center of the lantern), anchors.mouth (the paper face at the front of the lantern, where the soul flame goes out), lamp (center of the lantern), hook (the point where the hook hangs the lamp),
//   coins (the middle copper coin), tip (spike ferrule at the pole bottom), banner (lower edge of the banner), lanterns (the first extinguished lamp at the back). No eyes (eyes is empty).

import * as THREE from 'three';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, slab, type LabModel } from './shapes.ts';
import { labToon, rampTexture } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

// ───────────────────────── Geometry helpers ─────────────────────────

/** Normal-direction check for a whole mesh: on average the normals must point away from the ref point, and if not, flip the facing */
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

/**
 * A grid surface wrapped around once: rows along the cross-section, cols around it (the last column joins back to the first, with no seam line).
 * When the head and tail of the cross-section shrink to a point (a pole), the normals of that row are averaged so the pole does not show an outline dot.
 */
function wrapGrid(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c?: THREE.Color }, ref: THREE.Vector3): THREE.BufferGeometry {
  const pos = new Float32Array(rows * cols * 3);
  const cl = new Float32Array(rows * cols * 3);
  let hasC = false;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const { p, c } = f(i, j);
      const k = (i * cols + j) * 3;
      pos[k] = p.x;
      pos[k + 1] = p.y;
      pos[k + 2] = p.z;
      if (c) hasC = true;
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
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (hasC) g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  orientOut(g, ref);
  const na = g.attributes.normal as THREE.BufferAttribute;
  for (const i of [0, rows - 1]) {
    let spread = 0;
    for (let j = 1; j < cols; j++) spread = Math.max(spread, Math.abs(pos[(i * cols + j) * 3] - pos[i * cols * 3]) + Math.abs(pos[(i * cols + j) * 3 + 2] - pos[i * cols * 3 + 2]));
    if (spread > 1e-5) continue;
    const n = new THREE.Vector3();
    for (let j = 0; j < cols; j++) n.x += na.getX(i * cols + j), n.y += na.getY(i * cols + j), n.z += na.getZ(i * cols + j);
    n.normalize();
    for (let j = 0; j < cols; j++) na.setXYZ(i * cols + j, n.x, n.y, n.z);
  }
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
  for (let i = 0; i < pa.count; i++) {
    const c = f(P.fromBufferAttribute(pa, i), N.fromBufferAttribute(na, i));
    out[i * 3] = c.r;
    out[i * 3 + 1] = c.g;
    out[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

/** A single-color vertex color (for merging with other parts of the same material) */
const tint = (g: THREE.BufferGeometry, c: THREE.ColorRepresentation) => {
  const cc = col(c);
  return paint(g, () => cc);
};

/**
 * A beveled ring band (the wooden rings at the top and bottom of the lantern, copper bands): the cross-section is a rounded rectangle, turned about the y axis.
 * The cross-section is ordered counterclockwise (bottom face from inside out, outer wall up, top face inward, inner wall down), so the lathe body's normals all face outward.
 */
function ringBand(rIn: number, rOut: number, y0: number, y1: number, b: number, seg: number): THREE.BufferGeometry {
  const c = 0.29;
  const pts: [number, number][] = [
    [rIn + b, y0], [rOut - b, y0], [rOut - b * c, y0 + b * c], [rOut, y0 + b],
    [rOut, y1 - b], [rOut - b * c, y1 - b * c], [rOut - b, y1],
    [rIn + b, y1], [rIn + b * c, y1 - b * c], [rIn, y1 - b],
    [rIn, y0 + b], [rIn + b * c, y0 + b * c], [rIn + b, y0],
  ];
  return lathe(pts, seg);
}

/**
 * A paper strip with thickness (the long banner): S(u, v) is the midsurface (u across the width, v along the length), growing thick / 2 to each side, with the four edges rounded into lips.
 * Also records each vertex's (u, v), used to sway it vertex by vertex when idle.
 */
function paperStrip(NU: number, NV: number, S: (u: number, v: number) => THREE.Vector3, thick: number, color: (u: number, v: number, side: number) => THREE.Color, outward: THREE.Vector3) {
  const cols = NU + 1;
  const rows = NV + 1;
  const E = 2;
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
  if (Nn[mid].dot(outward) < 0) for (const n of Nn) n.negate();

  const pos: number[] = [];
  const clr: number[] = [];
  const uvs: number[] = [];
  const outs: THREE.Vector3[] = [];
  const addV = (p: THREE.Vector3, d: THREE.Vector3, c: THREE.Color, u: number, v: number) => {
    pos.push(p.x, p.y, p.z);
    clr.push(c.r, c.g, c.b);
    uvs.push(u, v);
    outs.push(d);
    return outs.length - 1;
  };
  const uvOf = (k: number): [number, number] => [(k % cols) / NU, Math.floor(k / cols) / NV];
  const O: number[] = [];
  const I: number[] = [];
  for (let k = 0; k < P.length; k++) {
    const [u, v] = uvOf(k);
    O.push(addV(P[k].clone().addScaledVector(Nn[k], thick / 2), Nn[k].clone(), color(u, v, 1), u, v));
    I.push(addV(P[k].clone().addScaledVector(Nn[k], -thick / 2), Nn[k].clone().negate(), color(u, v, -1), u, v));
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
  // Rounded lips on the four edges
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
    const cO = color(u, v, 1);
    const cI = color(u, v, -1);
    const ring = [O[k]];
    for (let m = 1; m <= E; m++) {
      const ph = (PI * m) / (E + 1);
      const d = n.clone().multiplyScalar(Math.cos(ph)).addScaledVector(ee, Math.sin(ph));
      ring.push(addV(P[k].clone().addScaledVector(d, thick / 2), d, cO.clone().lerp(cI, (1 - Math.cos(ph)) / 2), u, v));
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
  return { geo: g, uv: Float32Array.from(uvs), rest: Float32Array.from(pos) };
}

/** Make the material's emissive also multiply the vertex color: the middle of the lamp paper is brightest and darker near the wooden rings (changes only this spirit's own material) */
function emissiveByVertex(m: THREE.MeshToonMaterial): void {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('totalEmissiveRadiance *= uGlowMul;', 'totalEmissiveRadiance *= uGlowMul * vColor.rgb;');
  };
  m.customProgramCacheKey = () => 'soul_lantern-paper-emissive-vc';
}

/** Square-holed copper coin: a disc with a square hole in the middle, extruded and beveled, the coin face facing ±z */
function coinGeo(r: number, hole: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, PI * 2, false);
  const h = new THREE.Path();
  h.moveTo(-hole, -hole);
  h.lineTo(hole, -hole);
  h.lineTo(hole, hole);
  h.lineTo(-hole, hole);
  h.closePath();
  s.holes.push(h);
  return slab(s, 0.0055, 0.0024, 14);
}

// ───────────────────────── Shape ─────────────────────────

export function buildSoulLanternLab(): LabModel {
  const RIMC = 0x9ccfff;
  const vc = <T extends THREE.MeshToonMaterial>(m: T) => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    // Lamp paper: vertex color decides the brightness (bright in the middle, dark at the ends), and the emissive follows the vertex color; it does not take rim light, and the dark side is bright too (the gem's three steps)
    paper: vc(labToon(0xffffff, { ramp: 'gem', rim: 0, emissive: 0x2f86f0, emissiveAmt: 0.62 })),
    rib: labToon(0x3b3140, { rim: 0.25, rimColor: RIMC }),
    lacquer: labToon(0x1d1a24, { ramp: 'metal', rim: 0.55, rimColor: RIMC, spec: 0.55, specTh: 0.986 }),
    bronze: labToon(0x8c7045, { ramp: 'metal', rim: 0.35, rimColor: 0xffe2b0, spec: 0.6, specTh: 0.978 }),
    pole: vc(labToon(0xffffff, { rim: 0.65, rimColor: RIMC, spec: 0.3, specTh: 0.992 })),
    cord: labToon(0x2b3257, { rim: 0.45, rimColor: RIMC }),
    silk: vc(labToon(0xffffff, { rim: 0.45, rimColor: RIMC })),
    strip: vc(labToon(0xffffff, { rim: 0.3, rimColor: 0xcfe6ff })),
    dead: vc(labToon(0xffffff, { rim: 0.5, rimColor: RIMC })),
  };
  emissiveByVertex(M.paper);
  // The lamp paper glows by itself, with only two light/dark steps and the dark side not deep: so the dished paper between bamboo ribs does not split each segment into a bright and a dark stripe
  M.paper.gradientMap = rampTexture([[-1, 0.76], [0.28, 1]]);
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'soul_lantern-lab';
  const { add, group } = partKit();

  // ── Skeleton: floating group → three pole sections (pole bottom, pole waist, pole top), each bending about its own lower end ──
  // The whole thing is shifted back, so the midpoint between the lantern and the pole falls on the pivot (pitfall 66)
  const float = group(root, [0, 0, -0.22]);
  const TIP = 0.1;
  const J1Y = 0.7;
  const J2Y = 1.18;
  const J0 = group(float, [0, TIP, 0]);
  const J1 = group(J0, [0, J1Y - TIP, 0]);
  const J2 = group(J1, [0, J2Y - J1Y, 0]);
  /** Base angles of the pole sections: the pole bottom leans back, and the pole waist and top bend forward, making the whole pole a bowing arc (the three sections add up to about 11 degrees) */
  const BASE = [-0.05, 0.08, 0.17];
  const LEAN = BASE[0] + BASE[1] + BASE[2];

  // ── Bamboo pole: smoke-blackened bamboo, tapering slightly upward; the bamboo nodes are rings one step paler that also cover the seams between the three sections ──
  const poleR = (wy: number) => lerp(0.044, 0.035, clamp((wy - 0.22) / 1.38, 0, 1));
  const cPole = col(0x2f2a33);
  const cPoleLo = col(0x27232b);
  const cNode = col(0x4c4554);
  const section = (parent: THREE.Object3D, org: number, w0: number, w1: number) => {
    const prof: [number, number][] = [[0, w0 - org]];
    const n = Math.max(3, Math.round((w1 - w0) / 0.05));
    for (let i = 0; i <= n; i++) {
      const wy = lerp(w0, w1, i / n);
      prof.push([poleR(wy), wy - org]);
    }
    prof.push([0, w1 - org]);
    const g = paint(lathe(prof, 14), (p) => cPoleLo.clone().lerp(cPole, sstep(p.y + org, 0.2, 0.6)));
    add(parent, g, M.pole);
  };
  const NODES = [0.4, 0.7, 0.94, 1.18, 1.4];
  const nodeRing = (parent: THREE.Object3D, org: number, wy: number) => {
    const r = poleR(wy);
    add(parent, tint(new THREE.TorusGeometry(r + 0.0015, 0.0075, 6, 18), cNode), M.pole, [0, wy - org, 0], [PI / 2, 0, 0]);
  };
  section(J0, TIP, 0.215, J1Y);
  section(J1, J1Y, J1Y, J2Y);
  section(J2, J2Y, J2Y, 1.62);
  for (const wy of NODES) {
    if (wy <= J1Y) nodeRing(J0, TIP, wy);
    else if (wy <= J2Y) nodeRing(J1, J1Y, wy);
    else nodeRing(J2, J2Y, wy);
  }

  // ── A stretch of worn indigo binding cord on the lower pole: where the lantern-carrying hand used to grip, and now with no hand the pole walks by itself ──
  for (let k = 0; k < 11; k++) {
    const wy = 0.5 + k * 0.0125;
    add(J0, new THREE.TorusGeometry(poleR(wy) + 0.0025, 0.0068, 6, 18), M.cord, [0, wy - TIP, 0], [PI / 2 + 0.07, 0, 0.05 * Math.sin(k * 1.7)]);
  }

  // ── Bronze spike ferrule at the pole bottom: the tip hangs off the ground, with a ring of copper band fitted around the bamboo pole above ──
  add(J0, lathe([[0, 0], [0.01, 0.018], [0.024, 0.055], [0.033, 0.083], [0.049, 0.094], [0.052, 0.104], [0.049, 0.112], [0.049, 0.15], [0.053, 0.156], [0.053, 0.166], [0.047, 0.172], [0, 0.174]], 16), M.bronze);
  const tipA = group(J0, [0, 0, 0]);

  // ── Top of the pole: a bronze sleeve, a curved hook bending forward into a question mark (the end curling back into a small whorl), and a ruyi-scroll brace inside the hook ──
  add(J2, lathe([[0, 0.37], [0.046, 0.37], [0.05, 0.376], [0.05, 0.388], [0.045, 0.394], [0.045, 0.448], [0.05, 0.454], [0.05, 0.468], [0.041, 0.478], [0.028, 0.484], [0, 0.486]], 16), M.bronze);
  const crookPts = [
    [0.44, 0], [0.54, 0.0], [0.65, 0.035], [0.735, 0.12], [0.765, 0.235], [0.727, 0.345], [0.64, 0.405], [0.545, 0.417], [0.478, 0.39], [0.458, 0.343], [0.476, 0.303], [0.513, 0.298],
  ].map(([y, z]) => v3(0, y, z));
  const crookR = curveTable([[0, 0.0], [0.02, 0.024], [0.3, 0.022], [0.7, 0.018], [0.9, 0.016], [0.985, 0.012], [1, 0]]);
  add(J2, loft(crookPts, (t) => [crookR(t)[0], crookR(t)[0]], { segs: 72, radial: 10, side: v3(1, 0, 0) }), M.bronze);
  add(J2, new THREE.SphereGeometry(0.019, 12, 8), M.bronze, [0, 0.515, 0.296]);
  // Lowest point of the hook: the lamp's chain hangs here
  const crookCurve = new THREE.CatmullRomCurve3(crookPts, false, 'centripetal');
  const hookP = new THREE.Vector3(0, 9, 0);
  for (let i = 0; i <= 200; i++) {
    const t = 0.62 + (i / 200) * 0.33;
    const q = crookCurve.getPointAt(t);
    if (q.y < hookP.y) hookP.copy(q);
  }
  // Ruyi-scroll brace: growing from the front of the sleeve and curling once inside the hook
  const brace = [[0.455, 0.04], [0.53, 0.105], [0.605, 0.175], [0.655, 0.245], [0.648, 0.3], [0.612, 0.315], [0.588, 0.285], [0.6, 0.255], [0.625, 0.258]].map(([y, z]) => v3(0, y, z));
  const braceR = curveTable([[0, 0], [0.04, 0.012], [0.8, 0.01], [0.97, 0.008], [1, 0]]);
  add(J2, loft(brace, (t) => [braceR(t)[0], braceR(t)[0]], { segs: 48, radial: 8, side: v3(1, 0, 0) }), M.bronze);
  add(J2, new THREE.SphereGeometry(0.012, 10, 6), M.bronze, [0, 0.626, 0.258]);

  // ── Lamp: a pendulum group hung at the lowest point of the hook, two copper rings → handle → lantern ──
  const swing = group(J2, [hookP.x, hookP.y, hookP.z]);
  // In battle the height is normalized by the top of the hook, so the lamp is only forty percent of the height and the pole thin, looking slight next to the opponent: the whole lamp set (with the copper rings, handle and tassel) is scaled up by 18%
  swing.scale.setScalar(1.18);
  // The copper rings' inner diameter is a bit thicker than the hook; the upper ring hangs on the hook, the lower ring links crosswise with the upper ring, and the top of the handle passes through the lower ring (each resting on the other's tube without interpenetrating)
  const linkGeo = new THREE.TorusGeometry(0.03, 0.0095, 8, 18);
  add(swing, linkGeo, M.bronze, [0, -0.0045, 0]);
  add(swing, linkGeo, M.bronze, [0, -0.0455, 0], [0, PI / 2, 0]);
  add(swing, new THREE.TorusGeometry(0.07, 0.0095, 8, 24, PI), M.bronze, [0, -0.1265, 0]);
  const LY = -0.4865;
  const lantern = group(swing, [0, LY, 0]);

  // Lantern body (chochin): a long oval paper cylinder with nine bamboo ribs; the paper dips slightly inward between the ribs, so there is light and shade segment by segment
  const YH = 0.29;
  const RMAX = 0.245;
  const REND = 0.152;
  const Rb = (y: number) => REND + (RMAX - REND) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(y) / YH, 2.2)), 0.55);
  const RIBS = Array.from({ length: 9 }, (_, k) => -0.26 + k * 0.065);
  const LINES = [-YH, ...RIBS, YH];
  const rowsY: { y: number; f: number; span: number }[] = [];
  for (let i = 0; i < LINES.length - 1; i++) {
    const a = LINES[i];
    const b = LINES[i + 1];
    const n = b - a < 0.04 ? 3 : 7;
    for (let s = 0; s < n; s++) rowsY.push({ y: lerp(a, b, s / n), f: s / n, span: b - a });
  }
  rowsY.push({ y: YH, f: 0, span: 0 });
  const SAG = 0.009;
  const cGlowMid = col(0x9fd4ff);
  const cGlowEnd = col(0x4f86d6);
  const PC = 48;
  const paperGeo = wrapGrid(rowsY.length, PC, (i, j) => {
    const { y, f, span } = rowsY[i];
    const th = (j / PC) * PI * 2;
    const r = Rb(y) - SAG * (span / 0.065) * Math.pow(Math.sin(PI * f), 1.3);
    const g = 1 - Math.pow(Math.abs(y) / YH, 2);
    const c = cGlowEnd.clone().lerp(cGlowMid, sstep(g, 0.05, 0.85)).multiplyScalar(0.9 + 0.1 * Math.sin(PI * f));
    return { p: v3(Math.sin(th) * r, y, Math.cos(th) * r), c };
  }, v3(0, 0, 0));
  add(lantern, paperGeo, M.paper);
  const ribGeo = (y: number) => new THREE.TorusGeometry(Rb(y) + 0.001, 0.0056, 5, 44);
  for (const y of RIBS) add(lantern, ribGeo(y), M.rib, [0, y, 0], [PI / 2, 0, 0]);
  // Black-lacquered wooden rings at top and bottom, each with a thin copper band set into the middle
  add(lantern, ringBand(REND - 0.022, REND + 0.02, YH - 0.006, YH + 0.046, 0.009, 44), M.lacquer);
  add(lantern, ringBand(REND - 0.022, REND + 0.02, -YH - 0.046, -YH + 0.006, 0.009, 44), M.lacquer);
  for (const s of [1, -1]) add(lantern, new THREE.TorusGeometry(REND + 0.0215, 0.0042, 5, 44), M.bronze, [0, s * (YH + 0.02), 0], [PI / 2, 0, 0]);
  // Top cap: a bronze dome with a knob on top; the two ends of the handle are inserted into the lug seats on both sides of the dome
  add(lantern, lathe([[REND + 0.012, YH + 0.04], [REND + 0.017, YH + 0.047], [REND + 0.008, YH + 0.055], [0.12, YH + 0.064], [0.086, YH + 0.074], [0.058, YH + 0.08], [0.05, YH + 0.086], [0.05, YH + 0.094], [0.036, YH + 0.1], [0, YH + 0.102]], 36), M.bronze);
  add(lantern, new THREE.SphereGeometry(0.017, 12, 8), M.bronze, [0, YH + 0.112, 0]);
  // A raised ring of copper beads on each of the top and bottom caps
  add(lantern, new THREE.TorusGeometry(0.104, 0.0048, 6, 36), M.bronze, [0, YH + 0.069, 0], [PI / 2, 0, 0]);
  add(lantern, new THREE.TorusGeometry(0.104, 0.0048, 6, 36), M.bronze, [0, -YH - 0.066, 0], [PI / 2, 0, 0]);
  for (const s of [1, -1]) add(lantern, new THREE.SphereGeometry(0.015, 10, 8), M.bronze, [s * 0.072, 0.36, 0]);
  // Bottom cap: a shallow bronze bowl, with a small ring underneath hanging the tassel
  add(lantern, lathe([[0, -YH - 0.08], [0.05, -YH - 0.076], [0.1, -YH - 0.066], [0.14, -YH - 0.056], [REND + 0.017, -YH - 0.047], [REND + 0.012, -YH - 0.04]], 36), M.bronze);
  add(lantern, new THREE.TorusGeometry(0.017, 0.0058, 6, 14), M.bronze, [0, -YH - 0.098, 0], [0, PI / 2, 0]);
  const lampA = group(lantern, [0, 0, 0]);
  const mouthA = group(lantern, [0, 0, RMAX]);

  // ── Tassel: three square-holed copper coins on the cord (for greedy people to see), with a short bunch of indigo silk tassel below; the pendulum hangs from the small ring on the bottom cap ──
  // After the lamp is scaled up the tassel has to be shortened, so its lower edge does not hang to the ground
  const tassel = group(lantern, [0, -YH - 0.112, 0]);
  add(tassel, loft([v3(0, 0.012, 0), v3(0, -0.11, 0), v3(0, -0.234, 0)], () => [0.005, 0.005], { segs: 8, radial: 8 }), M.cord);
  add(tassel, new THREE.SphereGeometry(0.013, 12, 8), M.bronze, [0, -0.036, 0]);
  add(tassel, new THREE.SphereGeometry(0.013, 12, 8), M.bronze, [0, -0.228, 0]);
  const coins: THREE.Group[] = [];
  const cg = coinGeo(0.028, 0.0098);
  for (const y of [-0.074, -0.132, -0.19]) {
    const g = group(tassel, [0, y, 0]);
    coins.push(g);
    add(g, cg, M.bronze);
  }
  {
    // Silk tassel: a tightened knot on top, tied with a copper band, spreading out below into a bunch of grooved silk with a ragged lower edge
    const prof = [[-0.232, 0], [-0.236, 0.011], [-0.244, 0.0175], [-0.258, 0.018], [-0.268, 0.021], [-0.29, 0.027], [-0.313, 0.031], [-0.325, 0.029], [-0.331, 0.018], [-0.333, 0]];
    const R = prof.length;
    const C = 32;
    const cHead = col(0x283466);
    const cTip = col(0x4a5a9c);
    const g = wrapGrid(R, C, (i, j) => {
      const th = (j / C) * PI * 2;
      const [y0, r0] = prof[i];
      const below = sstep(-y0, 0.26, 0.27);
      const groove = 1 - 0.09 * below * (0.5 + 0.5 * Math.cos(th * 14));
      const rag = i >= R - 3 ? 0.009 * Math.sin(th * 5 + 0.7) + 0.005 * Math.sin(th * 11) : 0;
      const y = y0 + rag;
      const c = cHead.clone().lerp(cTip, sstep(-y, 0.268, 0.316)).multiplyScalar(0.9 + 0.1 * Math.cos(th * 14) * below);
      return { p: v3(Math.sin(th) * r0 * groove, y, Math.cos(th) * r0 * groove), c };
    }, v3(0, -0.285, 0));
    add(tassel, g, M.silk);
    add(tassel, new THREE.TorusGeometry(0.0195, 0.0045, 6, 20), M.bronze, [0, -0.254, 0], [PI / 2, 0, 0]);
  }

  // ── Soul-guiding banner: a small crossbar behind the top of the pole, hanging a gray-white paper-cut banner (zigzag on both sides, a row of small teeth on the lower edge), blown backward by the wind of the Gloom Realm ──
  // A long, narrow paper strip with a forked lower edge sticking out slantwise from behind the lamp, in a small-size silhouette looked like a thin arm plus fingers; changed to a short, wide banner that flutters back along the pole, with its front hidden behind the lamp
  const SA = (-150 * PI) / 180;
  const sd = v3(Math.sin(SA), 0, Math.cos(SA));
  const st = v3(Math.cos(SA), 0, -Math.sin(SA));
  const SY = 0.345;
  add(J2, new THREE.TorusGeometry(poleR(J2Y + SY) + 0.004, 0.0065, 6, 18), M.bronze, [0, SY, 0], [PI / 2, 0, 0]);
  {
    const bar = new THREE.Group();
    J2.add(bar);
    bar.position.copy(sd.clone().multiplyScalar(0.05)).setY(SY);
    bar.quaternion.setFromUnitVectors(v3(0, 1, 0), st);
    add(bar, lathe([[0, -0.09], [0.009, -0.088], [0.0095, -0.08], [0.0085, 0.08], [0.0095, 0.084], [0.009, 0.088], [0, 0.09]], 10), M.bronze);
  }
  // After the pole bends forward, "down" within this section tilts forward; the banner hangs by world gravity, and then drifts back and to the left
  const down = v3(0, -Math.cos(LEAN), Math.sin(LEAN));
  const SW = 0.15;
  const SL = 0.54;
  const top = sd.clone().multiplyScalar(0.05).setY(SY - 0.012);
  const saw = (x: number) => {
    const f = x - Math.floor(x);
    return 1 - Math.abs(2 * f - 1);
  };
  const stripS = (u: number, v: number) => {
    // Both sides are cut into zigzags (a short stretch at the top left blank), widening slightly downward
    const w = SW * (1 + 0.06 * v) * (1 - 0.16 * saw(v * 10 + 0.5) * sstep(v, 0.03, 0.08));
    // The lower edge is cut into five small teeth
    const len = SL * (1 - 0.06 * (1 - saw(u * 5)) * sstep(v, 0.85, 0.99));
    return top.clone()
      .addScaledVector(st, (u - 0.5) * w)
      .addScaledVector(down, v * len)
      .add(v3(-0.05 * v, 0, -0.17 * Math.pow(v, 1.2)));
  };
  const cStrip = col(0xe3dfd3);
  const cStripDk = col(0xbdb8ac);
  const strip = paperStrip(20, 50, stripS, 0.008, (u, v, side) => {
    const edge = sstep(Math.abs(u - 0.5), 0.38, 0.5);
    return cStrip.clone().lerp(cStripDk, edge * 0.6 + 0.15 * v + (side < 0 ? 0.12 : 0));
  }, sd);
  const stripMesh = add(J2, strip.geo, M.strip);
  stripMesh.frustumCulled = false;
  (strip.geo.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  const stripN = new THREE.Vector3().crossVectors(st, down).normalize();
  const bannerA = group(J2, stripS(0.5, 1).toArray() as [number, number, number]);

  // ── Lamp bracket at the back: a bronze band behind the pole's waist extends a small curved hook, hanging a string of two extinguished small lanterns (the lamps of the greedy people who followed it into the darkness) ──
  const DA = (135 * PI) / 180;
  const dd = v3(Math.sin(DA), 0, Math.cos(DA));
  const DY = 0.3;
  add(J1, new THREE.TorusGeometry(poleR(J1Y + DY) + 0.004, 0.009, 6, 18), M.bronze, [0, DY, 0], [PI / 2, 0, 0]);
  const hookPts = [
    dd.clone().multiplyScalar(0.04).setY(DY),
    dd.clone().multiplyScalar(0.09).setY(DY + 0.03),
    dd.clone().multiplyScalar(0.14).setY(DY + 0.035),
    dd.clone().multiplyScalar(0.168).setY(DY + 0.012),
    dd.clone().multiplyScalar(0.162).setY(DY - 0.012),
  ];
  add(J1, loft(hookPts, (t) => [0.011 * (1 - 0.35 * t) * Math.min(1, t * 30 + 0.2), 0.011 * (1 - 0.35 * t) * Math.min(1, t * 30 + 0.2)], { segs: 24, radial: 8, side: v3(-dd.z, 0, dd.x) }), M.bronze);
  add(J1, new THREE.SphereGeometry(0.009, 8, 6), M.bronze, hookPts[4].toArray() as [number, number, number]);
  const deadPivot = dd.clone().multiplyScalar(0.152).setY(DY + 0.004);
  const cDead = col(0x4f5567);
  const cDeadHi = col(0x646b7e);
  const cDeadRib = col(0x2a2629);
  /** One extinguished small lantern: dark gray paper, the bamboo ribs made directly as raised ridges on the paper surface, with black-lacquered wooden rings top and bottom and a small bronze cap */
  const deadLantern = (parent: THREE.Object3D, s: number) => {
    const H = 0.08 * s;
    const RM = 0.07 * s;
    const RE = 0.044 * s;
    const ribs = [-0.6, -0.3, 0, 0.3, 0.6].map((k) => k * H);
    const rb = (y: number) => RE + (RM - RE) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(y) / H, 2.2)), 0.55);
    const ridge = (y: number) => ribs.reduce((a, ry) => Math.max(a, Math.exp(-(((y - ry) / (0.012 * s)) ** 2))), 0);
    const prof: [number, number][] = [];
    const N = 36;
    for (let i = 0; i <= N; i++) {
      const y = -H + (2 * H * i) / N;
      prof.push([rb(y) + 0.0035 * s * ridge(y), y]);
    }
    const g = paint(lathe(prof, 20), (p) => cDeadHi.clone().lerp(cDead, sstep(Math.abs(p.y) / H, 0.1, 0.9)).lerp(cDeadRib, sstep(ridge(p.y), 0.35, 0.8)));
    add(parent, g, M.dead);
    add(parent, ringBand(RE - 0.008 * s, RE + 0.009 * s, H - 0.004 * s, H + 0.024 * s, 0.005 * s, 20), M.lacquer);
    add(parent, ringBand(RE - 0.008 * s, RE + 0.009 * s, -H - 0.024 * s, -H + 0.004 * s, 0.005 * s, 20), M.lacquer);
    add(parent, lathe([[RE + 0.004 * s, H + 0.022 * s], [RE, H + 0.03 * s], [0.02 * s, H + 0.042 * s], [0, H + 0.046 * s]], 16), M.bronze);
    add(parent, lathe([[0, -H - 0.046 * s], [0.02 * s, -H - 0.042 * s], [RE, -H - 0.03 * s], [RE + 0.004 * s, -H - 0.022 * s]], 16), M.bronze);
    return H + 0.046 * s;
  };
  const deadA = group(J1, deadPivot.toArray() as [number, number, number]);
  const hA = 0.1;
  add(deadA, loft([v3(0, 0.004, 0), v3(0, -0.07, 0)], () => [0.0055, 0.0055], { segs: 3, radial: 8 }), M.cord);
  const lanA = group(deadA, [0, -0.06 - hA, 0]);
  const extA = deadLantern(lanA, 1);
  const deadB = group(lanA, [0, -extA - 0.004, 0]);
  add(deadB, loft([v3(0, 0.008, 0), v3(0, -0.05, 0)], () => [0.005, 0.005], { segs: 3, radial: 8 }), M.cord);
  const lanB = group(deadB, [0, -0.04 - 0.08 * 0.78, 0]);
  deadLantern(lanB, 0.78);

  // ── Idle and actions ──
  const act = { glow: 0, swing: 0, bow: 0 };
  const qParent = new THREE.Quaternion();
  const qInv = new THREE.Quaternion();
  const qTilt = new THREE.Quaternion();
  const eTilt = new THREE.Euler();
  const pa = strip.geo.attributes.position as THREE.BufferAttribute;
  const rest = strip.rest;
  const suv = strip.uv;
  const update = (t: number) => {
    // Floating: bobbing slowly up and down, with the whole pole swaying slightly left and right
    float.position.y = 0.04 + 0.028 * Math.sin(t * 1.05);
    float.rotation.z = 0.022 * Math.sin(t * 0.63 + 0.4);
    float.rotation.x = 0.012 * Math.sin(t * 0.52);
    // The pole bows and straightens like breathing, and the top of the pole turns now and then to look at the road; strike whips forward, victory takes a deep bow
    const br = Math.sin(t * 0.8);
    J0.rotation.x = BASE[0] + 0.012 * br - 0.04 * act.swing;
    J1.rotation.x = BASE[1] + 0.018 * Math.sin(t * 0.8 - 0.5) + 0.2 * act.swing + 0.14 * act.bow;
    J2.rotation.set(BASE[2] + 0.028 * Math.sin(t * 0.8 - 1.0) + 0.42 * act.swing + 0.45 * act.bow, 0.2 * Math.sin(t * 0.31) + 0.07 * Math.sin(t * 0.83 + 1.1), 0);
    // Lantern: the pendulum always points down and swings half a beat behind; when the head turns the lamp turns with the top of the pole
    qParent.copy(float.quaternion).multiply(J0.quaternion).multiply(J1.quaternion).multiply(J2.quaternion);
    qInv.copy(qParent).invert();
    eTilt.set(0.055 * Math.sin(t * 1.3 - 1.4) - 0.3 * act.swing + 0.12 * act.bow, J2.rotation.y, 0.05 * Math.sin(t * 1.1 + 0.3) - float.rotation.z * 0.6, 'YXZ');
    qTilt.setFromEuler(eTilt);
    swing.quaternion.copy(qInv).multiply(qTilt);
    // The tassel another half beat behind, the copper coins each turn slowly and glint in turn
    tassel.rotation.set(0.07 * Math.sin(t * 1.3 - 2.3) + 0.2 * act.swing, 0, 0.06 * Math.sin(t * 1.1 - 0.8));
    coins.forEach((c, k) => (c.rotation.y = [0.15, -0.12, 0.2][k] + 0.3 * Math.sin(t * 0.7 + k * 2.1)));
    // The lamp paper's light flickers faintly and brightens when charging
    M.paper.emissiveIntensity = 0.62 * (1 + 0.05 * br + 0.035 * Math.sin(t * 6.3) + 0.025 * Math.sin(t * 9.7 + 1.3)) * (1 + 0.9 * act.glow);
    // The extinguished small lanterns at the back: always pointing down, swinging slowly
    qParent.copy(float.quaternion).multiply(J0.quaternion).multiply(J1.quaternion);
    qInv.copy(qParent).invert();
    eTilt.set(0.06 * Math.sin(t * 1.2 + 0.9), 0.3 * Math.sin(t * 0.4), 0.07 * Math.sin(t * 0.95 - 0.4), 'YXZ');
    qTilt.setFromEuler(eTilt);
    deadA.quaternion.copy(qInv).multiply(qTilt);
    deadB.rotation.set(0.1 * Math.sin(t * 1.2 - 0.6), 0.4 * Math.sin(t * 0.5 + 1), 0.08 * Math.sin(t * 0.95 - 1.5));
    // Long banner: sways with the wind of the Gloom Realm, swinging more the farther down it goes
    for (let i = 0; i < pa.count; i++) {
      const u = suv[i * 2];
      const v = suv[i * 2 + 1];
      const a = 0.05 * Math.pow(v, 1.4) * Math.sin(t * 2.1 - v * 5.5 + u * 0.8) + 0.02 * v * v * Math.sin(t * 0.9 + 0.5);
      const b = 0.03 * Math.pow(v, 1.6) * Math.sin(t * 1.3 - v * 3.0 + 1.0);
      pa.setXYZ(i, rest[i * 3] + stripN.x * a + st.x * b, rest[i * 3 + 1] + stripN.y * a, rest[i * 3 + 2] + stripN.z * a + st.z * b);
    }
    pa.needsUpdate = true;
    strip.geo.computeVertexNormals();
  };
  update(0);

  const coinsA = group(coins[1], [0, 0, 0]);
  const rig = { head: lampA, eyes: [] as THREE.Object3D[], anchors: { mouth: mouthA, lamp: lampA, hook: swing, coins: coinsA, tip: tipA, banner: bannerA, lanterns: lanA } };
  mergeStatic(root, {
    owners: [float, J0, J1, J2, swing, lantern, tassel, ...coins, deadA, lanA, deadB, lanB],
    keep: [stripMesh],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 1.05, 0), radius: 1.02 };
}
