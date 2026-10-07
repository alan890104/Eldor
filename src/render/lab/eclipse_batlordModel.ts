// Eclipse Batlord (model lab version, R, dark): a bat that hangs upside down in the caves of the Gloom Realm; on the night of an eclipse it leads its whole colony into the sky and blots out the last of the moonlight.
// Identifying features: 1. A pair of big spread bat wings: deep wine-red membranes stretched between five finger bones, with the wing edge curving inward in scallops between them; a pair of tall, pointed big ears.
// 2. The eclipse crown: an obsidian disc stands between the two ears, ringed by a gold circle and short gold corona rays; it is the only glowing place on the whole body.
// 3. A high silver-purple fur collar: a ring of fur standing up behind the neck wraps the back of the head like the high collar of a night banquet host's cloak, open at the front to show the face.
// Body shape: a hovering bat with a round plump body, a big head and short legs hanging below, the wings spread to both sides with the tips swept slightly back; it does not lean toward a humanoid shape.
// Personality: a show-off lord of the night sky: wings always spread to the fullest, chin raised, the head tilting from side to side as it looks down on everyone; personality comes from posture and motion, and the face follows a real bat (small black eyes, a leaf nose, canines), not a human face.
// Gaze order: the head (big ears, small black shiny eyes, leaf nose and a pair of canines) first, the eclipse crown second, and the big wings as support. Back: a silver crescent pattern in the fur on its back (the last bit of moonlight it swallowed),
// and behind the high collar hangs a sleeping little bat (the whole colony it leads). Action table: idle hovers with slow wingbeats, the body rising and falling with each beat, the ears twitching now and then and blinking; move is a glide with a dip and a lift;
// charge-up act.cloak draws the wings forward to wrap the body; strike act.flap is one violent beat (the blood drain is a pounce forward with a bite, from mouth); hit flips backward with the wings flailing and the eyes not closing; victory spreads both wings and the corona on the crown brightens (act.glow).
// Anchors: head, eyes, mouth, crown (center of the eclipse disc), wingL / wingR (wing tips of the longest finger bones), minion (the little bat behind).

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, furCollar, lathe, loft, mergeStatic, partKit, PI, smooth, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const FWD = v(0, 0, 1);
const ss = THREE.MathUtils.smoothstep;
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
/** Convert latitude and longitude (centered on +z, longitude positive toward +x) to a unit direction */
const sph = (lon: number, lat: number) => v(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));

// ───────────────────────── Helpers ─────────────────────────

function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  if (!g.attributes.normal) g.computeVertexNormals();
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    const c = f(p.fromBufferAttribute(pa, i), n.fromBufferAttribute(na, i));
    out.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}

function capGeo(r: number, ang: number, seg = 20, rings = 3): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, seg, rings, 0, PI * 2, 0, ang).rotateX(PI / 2);
}

/** Eyelid: a spherical shell with +y as the top, turning only the front half×2 radians (the back half is buried in the head) */
function lidGeo(ri: number, ro: number, lip: number, seg = 18, half = 1.96): THREE.BufferGeometry {
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

/** A tube with both ends rounded (bone, toe, mouth line) */
function tube(pts: THREE.Vector3[], r0: number, r1: number, segs = 12, radial = 8, side?: THREE.Vector3): THREE.BufferGeometry {
  return loft(pts, (t) => {
    const k = Math.min(1, Math.sqrt(t / 0.05), Math.sqrt((1 - t) / 0.05));
    const r = THREE.MathUtils.lerp(r0, r1, t) * k;
    return [r, r];
  }, { segs, radial, side });
}

/** Ear: a leaf shape in the xy plane (width w, height h), cupped toward -z, with thickness th */
function earGeo(w: number, h: number, th: number, cup: number, lean: number): THREE.BufferGeometry {
  const S = 16;
  const J = 14;
  const pos: number[] = [];
  for (let i = 0; i <= S; i++) {
    const s = i / S;
    const y = s * h;
    const half = w * 0.5 * Math.pow(1 - s, 0.75) * (0.75 + 0.25 * Math.sin(Math.min(1, s * 3) * PI * 0.5)) + 1e-4;
    const xc = lean * s * s;
    for (let j = 0; j < J; j++) {
      const f = (j / J) * PI * 2;
      const u = Math.cos(f);
      const x = xc + u * half;
      const z = -cup * (1 - u * u) * Math.sin(PI * Math.min(1, s * 1.1 + 0.05)) + Math.sin(f) * th * 0.5 * (1 - 0.6 * s);
      pos.push(x, y, z);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < S; i++)
    for (let j = 0; j < J; j++) {
      const a = i * J + j;
      const a1 = i * J + ((j + 1) % J);
      idx.push(a, a1, a + J, a + J, a1, a1 + J);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Normals point outward: the average z component of the normals on the +z half-ring must be positive
  const P = g.attributes.position as THREE.BufferAttribute;
  const N = g.attributes.normal as THREE.BufferAttribute;
  let sum = 0;
  for (let i = 0; i < P.count; i++) if (i % J > 0 && i % J < J / 2) sum += N.getZ(i);
  if (sum < 0) {
    const a = g.index!.array as Uint32Array | Uint16Array;
    for (let k = 0; k < a.length; k += 3) [a[k + 1], a[k + 2]] = [a[k + 2], a[k + 1]];
    g.index!.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

// ───────────────────────── Shape ─────────────────────────

export function buildEclipseBatlordLab(): LabModel {
  const RIMC = 0xc8b8ff;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    fur: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC })),
    ruff: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    membrane: vc(labToon(0xffffff, { rim: 0.45, rimColor: 0xffb0c8 })),
    bone: labToon(0x2e2438, { rim: 0.45, rimColor: RIMC }),
    innerEar: labToon(0xd48aa2, { rim: 0.3, rimColor: 0xffd0dc }),
    nose: labToon(0x2a1f2e, { spec: 0.6, specTh: 0.94, rim: 0.2 }),
    eye: labToon(0x100a0e, { ramp: 'gem', spec: 0.5, specTh: 0.97, rim: 0.1 }),
    line: labToon(0x1e1424, { rim: 0 }),
    fang: labToon(0xfbf3e2, { rim: 0.2 }),
    gold: labToon(0xe2b04e, { ramp: 'metal', spec: 1.5, specTh: 0.9, rim: 0.6, rimColor: 0xffe2a0 }),
    disc: labToon(0x17121f, { rim: 0.35, rimColor: 0xffd070 }),
    corona: labToon(0xffd86a, { ramp: 'gem', emissive: 0xffa82a, emissiveAmt: 0.55, rim: 0.3 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'eclipse_batlord-lab';
  const { add, group } = partKit();
  const BODY = 9611;

  // hover: the up and down of hovering; body: parts are placed in absolute coordinates
  const hover = group(root);
  const body = group(hover);

  const cFur = col(0x3b2f4e);
  const cFurLt = col(0x5a4a70);
  const cFace = col(0x6a5880);
  const cMoon = col(0xd6cde6);

  // ── Body: a round plump furball torso with lighter fur on the chest; a silver crescent on the back ──
  const bodyPts = [v(0, 0.48, -0.01), v(0, 0.58, 0.01), v(0, 0.73, 0.02), v(0, 0.87, 0.0), v(0, 0.98, -0.01)];
  const bodyProf = curveTable([[0, 0, 0], [0.1, 0.105, 0.095], [0.42, 0.172, 0.15], [0.72, 0.15, 0.13], [0.9, 0.11, 0.1], [1, 0.09, 0.09]]);
  const moon = (p: THREE.Vector3) => {
    const d1 = Math.hypot(p.x, p.y - 0.68);
    const d2 = Math.hypot(p.x + 0.055, p.y - 0.715);
    return (1 - ss(d1, 0.125, 0.14)) * ss(d2, 0.095, 0.11);
  };
  add(body, paint(loft(bodyPts, (t) => bodyProf(t), { segs: 48, radial: 32, side: v(1, 0, 0) }), (p, n) => {
    const c = cFur.clone().lerp(cFurLt, ss(n.z, 0.2, 0.8) * 0.8);
    return c.lerp(cMoon, moon(p) * ss(-n.z, 0.3, 0.6));
  }), M.fur).userData.inkGroup = BODY;

  // ── Short legs and small hooked claws for hanging upside down: hanging below the body ──
  for (const sx of [-1, 1]) {
    const hip = v(sx * 0.075, 0.56, -0.02);
    const ank = v(sx * 0.085, 0.4, -0.045);
    add(body, tube([hip, v(sx * 0.082, 0.48, -0.035), ank], 0.034, 0.022, 10, 10), M.fur);
    for (const a of [-0.45, 0, 0.45]) {
      const d = v(Math.sin(a) * 0.6 + sx * 0.1, -0.35, Math.cos(a) * 0.75).normalize();
      const p1 = ank.clone().addScaledVector(d, 0.035);
      const p2 = p1.clone().add(v(0, -0.02, -0.012));
      add(body, tube([ank.clone().add(v(0, 0.005, 0)), p1, p2], 0.011, 0.006, 8, 6), M.bone);
    }
  }
  // Leg vertex colors
  body.children.forEach((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh && m.material === M.fur && !m.geometry.attributes.color) paint(m.geometry, () => cFur);
  });

  // ── Head: a big round head, all one color of dark fur and only slightly lighter under the throat; the face's presence is left to the big ears and the eclipse crown (no pale round face is laid on) ──
  const HC = v(0, 1.1, 0.03);
  const HR = 0.2;
  const headG = group(body, HC.toArray() as [number, number, number]);
  const headGeo = paint(new THREE.SphereGeometry(HR, 40, 28), (_p, n) => cFur.clone().lerp(cFurLt, ss(-n.y + 0.3 * n.z, 0.35, 0.85) * 0.7));
  headGeo.deleteAttribute('uv');
  add(headG, headGeo, M.fur, [0, 0, 0], [0, 0, 0], [1.06, 0.96, 0.96]).userData.inkGroup = BODY;
  // Muzzle: a short wrinkled muzzle, in the same color family as the fur (only slightly lighter), not a pale disc
  const MZ = v(0, -0.07, 0.165);
  const muzzleGeo = paint(new THREE.SphereGeometry(0.056, 20, 14), (_p, n) => cFurLt.clone().lerp(cFur, ss(n.y, 0.3, 0.9) * 0.5));
  muzzleGeo.deleteAttribute('uv');
  add(headG, muzzleGeo, M.fur, MZ.toArray() as [number, number, number], [0, 0, 0], [1.15, 0.85, 0.95]).userData.inkGroup = BODY;
  // Leaf nose: two nostrils at the muzzle tip with a dark nose leaf standing above them (the mark of the leaf-nosed bat)
  const nose = group(headG, [0, -0.062, 0.217], [-0.2, 0, 0]);
  add(nose, new THREE.SphereGeometry(1, 14, 10), M.nose, [0, 0, 0], [0, 0, 0], [0.026, 0.016, 0.014]);
  add(nose, paint(earGeo(0.042, 0.055, 0.008, 0.006, 0), () => col(0x3a2a3e)), M.fur, [0, 0.008, -0.004], [-0.25, 0, 0]);

  // ── Fangs: a pair of small canines show below the upper lip (bats have them naturally), and no mouth line is drawn ──
  for (const sx of [-1, 1]) {
    const fg = group(headG, [sx * 0.024, -0.1, MZ.z + 0.038], [0.3, 0, 0]);
    add(fg, lathe([[0.001, 0.01], [0.0075, 0.006], [0.0065, -0.004], [0.0035, -0.015], [0.001, -0.022]], 8), M.fang);
  }

  // ── Eyes: a bat's small eyes, diameter about 10% of the head width, almost entirely black with only one small highlight, buried at the two sides above the muzzle ──
  const ER = 0.022;
  const UP_OPEN = 1.25;
  const LO_SHUT = 0.98;
  const lids: THREE.Group[] = [];
  const glints: THREE.Object3D[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const lidUp = paint(lidGeo(ER + 0.0015, ER + 0.005, PI / 2), () => cFur);
  const hiGeo = new THREE.SphereGeometry(1, 8, 6);
  for (const sx of [-1, 1]) {
    const d = sph(sx * 0.36, 0.1);
    const c = v(d.x * 1.06, d.y * 0.96, d.z * 0.96).multiplyScalar(HR - ER * 0.6);
    const eg = group(headG, c.toArray() as [number, number, number]);
    eg.quaternion.setFromUnitVectors(FWD, d);
    add(eg, capGeo(ER, 1.3, 16, 6), M.eye);
    const q = sph(-sx * 0.25, 0.35).multiplyScalar(ER + 0.001);
    const hl = add(eg, hiGeo, M.hi, q.toArray() as [number, number, number], [0, 0, 0], [0.0035, 0.0035, 0.0015]);
    hl.quaternion.setFromUnitVectors(FWD, q.clone().normalize());
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
    glints.push(hl);
    eyeAnchors.push(group(eg, [0, 0, ER]));
    // The upper lid normally rests inside the head and flips down only when blinking
    const upper = group(eg, [0, 0, 0], [-UP_OPEN, 0, 0]);
    add(upper, lidUp, M.fur).userData.inkGroup = BODY;
    lids.push(upper);
  }

  // ── Big ears: tall and pointed, dark fur color on the outside and pink-purple on the inside, with the cup opening forward ──
  const ears: { g: THREE.Group; sx: number }[] = [];
  for (const sx of [-1, 1]) {
    const eg = group(headG, [sx * 0.105, 0.13, -0.02], [-0.12, 0, -sx * 0.38]);
    const outer = paint(earGeo(0.17, 0.36, 0.035, 0.035, sx * 0.03), () => cFur);
    add(eg, outer, M.fur).userData.inkGroup = BODY;
    add(eg, earGeo(0.11, 0.27, 0.014, 0.03, sx * 0.025), M.innerEar, [0, 0.03, 0.006]);
    ears.push({ g: eg, sx });
  }

  // ── High fur collar: a ring of silver-purple fur standing up behind the neck, wrapping the back of the head, open at the front ──
  const ruffG = group(body, [0, 0.93, -0.015], [0, 0, PI]);
  add(ruffG, furCollar({ r0: 0.11, len: 0.28, thick: 0.07, flare: 0.75, tufts: 9, a0: 0.8, a1: PI * 2 - 0.8, curl: 0.12, notch: 0.4, tint: [0x9d8fb6, 0xe4def0, 0.45], seed: 7 }), M.ruff);

  // ── Eclipse crown: an obsidian disc stands between the two ears, with an outer gold ring and corona rays, and a gold headband below ──
  const crownG = group(headG, [0, HR * 0.96 + 0.04, 0.07], [-0.22, 0, 0]);
  {
    add(crownG, new THREE.CylinderGeometry(0.058, 0.058, 0.018, 32).rotateX(PI / 2), M.disc);
    add(crownG, new THREE.TorusGeometry(0.063, 0.009, 8, 36), M.gold);
    const ray = lathe([[0.001, 0], [0.011, 0.004], [0.007, 0.022], [0.001, 0.04]], 6);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * PI * 2 + PI / 10;
      if (Math.sin(a) < -0.7) continue; // The bottom two are given up to the headband
      const r = group(crownG, [Math.cos(a) * 0.068, Math.sin(a) * 0.068, 0], [0, 0, a - PI / 2]);
      add(r, ray, M.corona, [0, 0, 0], [0, 0, 0], [1, i % 2 ? 0.75 : 1.1, 0.8]);
    }
    // The small stalk that holds the disc, inserted into the headband
    add(crownG, tube([v(0, -0.06, 0), v(0, -0.085, -0.004), v(0, -0.105, -0.01)], 0.014, 0.018, 8, 8), M.gold);
  }
  // Headband: a gold ring along the forehead (low in front, high behind), passing under the base of the ears
  {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const lon = -1.35 + (i / 16) * 2.7;
      const q = sph(lon, 0.5 + 0.2 * (1 - Math.cos(lon)));
      pts.push(v(q.x * 1.06, q.y * 0.96, q.z * 0.96).multiplyScalar(HR + 0.006));
    }
    add(headG, tube(pts, 0.012, 0.012, 32, 8), M.gold);
  }

  // ── Wings: the shoulder is the origin, the membrane is a scalloped sheet in the xy plane, and five finger bones radiate from the wrist ──
  const cMemIn = col(0x4a1c36);
  const cMemOut = col(0x8a3558);
  const wings: { g: THREE.Group; hand: THREE.Group; sx: number }[] = [];
  const wingTips: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const wg = group(body, [sx * 0.12, 0.88, -0.035]);
    const X = (x: number) => sx * x;
    const W = [0.34, 0.12];
    const F: [number, number][] = [[0.55, 0.38], [0.84, 0.12], [0.74, -0.24], [0.46, -0.4]];
    const S0: [number, number] = [0.0, 0.03];
    const H: [number, number] = [0.0, -0.28];
    const sh = new THREE.Shape();
    sh.moveTo(X(S0[0]), S0[1]);
    sh.lineTo(X(W[0] - 0.01), W[1] + 0.02);
    sh.lineTo(X(F[0][0]), F[0][1]);
    const scallop = (a: [number, number], b: [number, number]) => {
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      sh.quadraticCurveTo(X(THREE.MathUtils.lerp(mx, W[0], 0.38)), THREE.MathUtils.lerp(my, W[1], 0.38), X(b[0]), b[1]);
    };
    scallop(F[0], F[1]);
    scallop(F[1], F[2]);
    scallop(F[2], F[3]);
    scallop(F[3], H);
    sh.lineTo(X(S0[0]), S0[1]);
    const mem = new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 1, curveSegments: 8 });
    mem.translate(0, 0, -0.005);
    mem.deleteAttribute('uv');
    paint(mem, (p) => cMemIn.clone().lerp(cMemOut, ss(Math.hypot(p.x, p.y), 0.25, 0.8)));
    add(wg, mem, M.membrane);
    // Arm bone: shoulder to wrist, with a joint at the wrist and a thumb claw hooked upward
    add(wg, tube([v(X(-0.02), 0.0, 0), v(X(0.17), 0.1, 0.006), v(X(W[0]), W[1], 0)], 0.03, 0.022, 14, 10), M.bone);
    add(wg, new THREE.SphereGeometry(0.027, 12, 8), M.bone, [X(W[0]), W[1], 0]);
    const thumb = group(wg, [X(W[0] + 0.005), W[1] + 0.02, 0.01], [0.3, 0, -sx * 0.2]);
    add(thumb, lathe([[0.001, 0], [0.012, 0.006], [0.008, 0.03], [0.001, 0.05]], 8), M.bone, [0, 0, 0], [0, 0, sx * 0.3]);
    // Finger bones: radiating from the wrist to each wing tip, slightly curved
    for (const [fx, fy] of F) {
      const mid = v(X((W[0] + fx) / 2 + 0.015), (W[1] + fy) / 2 + 0.02, 0.004);
      add(wg, tube([v(X(W[0]), W[1], 0), mid, v(X(fx), fy, 0)], 0.016, 0.008, 14, 8), M.bone);
    }
    wingTips.push(group(wg, [X(F[1][0]), F[1][1], 0]));
    wings.push({ g: wg, hand: wg, sx });
  }

  // ── Little bat hanging upside down on the back: its feet hook the rear edge of the high collar, and its wings wrap its body as it sleeps ──
  const minion = group(body, [0, 1.09, -0.245], [0.08, PI, 0]);
  minion.scale.setScalar(1.3);
  {
    // Small feet hook up onto the collar
    for (const sx of [-1, 1]) add(minion, tube([v(sx * 0.014, -0.05, 0), v(sx * 0.016, -0.01, 0.004), v(sx * 0.012, 0.012, 0.016)], 0.007, 0.005, 8, 6), M.bone);
    // Body: the wings wrap into an inverted teardrop
    const cocoon = paint(lathe([[0.001, -0.17], [0.03, -0.16], [0.052, -0.125], [0.058, -0.09], [0.048, -0.06], [0.026, -0.045], [0.001, -0.04]], 18), (p) => cMemIn.clone().lerp(cMemOut, ss(p.y, -0.15, -0.06) * 0.6));
    add(minion, cocoon, M.membrane);
    // Head: at the very bottom, ears pointing down, eyes closed
    add(minion, paint(new THREE.SphereGeometry(0.042, 16, 12), () => cFace), M.fur, [0, -0.19, 0.01]);
    for (const sx of [-1, 1]) {
      const e = group(minion, [sx * 0.022, -0.215, 0.0], [PI, 0, sx * 0.4]);
      add(e, paint(earGeo(0.036, 0.06, 0.012, 0.006, 0), () => cFur), M.fur);
      add(minion, tube([v(sx * 0.026, -0.19, 0.04), v(sx * 0.016, -0.184, 0.046), v(sx * 0.006, -0.19, 0.047)], 0.004, 0.004, 6, 5), M.line);
    }
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  const rig = {
    head: group(headG, [0, -0.02, HR * 0.9]),
    eyes: eyeAnchors,
    anchors: {
      mouth: group(headG, [0, -0.1, MZ.z + 0.06]),
      crown: group(crownG, [0, 0, 0.012]),
      wingL: wingTips[1],
      wingR: wingTips[0],
      minion: group(minion, [0, -0.12, 0]),
    },
  };
  const act = { flap: 0, cloak: 0, glow: 0 };

  mergeStatic(root, {
    owners: [hover, body, headG, crownG, ruffG, minion, ...wings.map((w) => w.g), ...ears.map((e) => e.g), ...lids],
    keep: [...glints],
    rig,
  });

  // ── Idle ──
  let blinkIn = 2.5;
  let blinkT = -1;
  const update = (t: number, dt: number) => {
    const fl = act.flap;
    const ck = act.cloak;
    const gl = act.glow;
    // Wingbeat: the body lifts on the downstroke
    const beat = Math.sin(t * 3.4);
    hover.position.y = 0.035 * Math.sin(t * 3.4 - 1.2) + 0.012 * Math.sin(t * 0.9);
    hover.rotation.set(Math.sin(t * 0.8) * 0.03 - ck * 0.1, Math.sin(t * 0.35) * 0.1, Math.sin(t * 0.6) * 0.025);
    for (const w of wings) {
      const flap = beat * (0.28 + fl * 0.35) + 0.08;
      w.g.rotation.set(0.05, w.sx * (0.32 + ck * 1.1), w.sx * (flap - ck * 0.3));
    }
    headG.rotation.set(-0.14 + Math.sin(t * 0.5) * 0.04, Math.sin(t * 0.37) * 0.12, Math.sin(t * 0.45) * 0.06 - 0.05);
    // The ears twitch now and then
    const tw = Math.max(0, Math.sin(t * 0.9) - 0.94) * 6;
    for (const e of ears) e.g.rotation.set(-0.12 + Math.sin(t * 1.3 + e.sx) * 0.03, 0, -e.sx * (0.38 + tw * Math.sin(t * 40) * 0.15));
    minion.rotation.set(0.08 + Math.sin(t * 1.1) * 0.05, PI, Math.sin(t * 0.8) * 0.08);
    crownG.rotation.set(-0.22, 0, 0);
    M.corona.emissiveIntensity = 0.55 + gl * 1.2 + Math.sin(t * 1.3) * 0.08;
    let close = 0;
    if (dt === 0) {
      const bt = t % 4;
      close = bt > 3.7 && bt < 3.9 ? Math.min(1, Math.sin(((bt - 3.7) / 0.2) * PI) * 1.3) : 0;
    } else {
      blinkIn -= dt;
      if (blinkIn <= 0) {
        blinkT = 0;
        blinkIn = 2.8 + ((t * 7.3) % 3);
      }
      if (blinkT >= 0) {
        blinkT += dt;
        const q = blinkT / 0.18;
        close = q < 1 ? Math.min(1, Math.sin(q * PI) * 1.3) : 0;
        if (q >= 1) blinkT = -1;
      }
    }
    const shut = (UP_OPEN + LO_SHUT) * close;
    for (const l of lids) l.rotation.x = -UP_OPEN + shut;
    for (const g of glints) g.visible = close < 0.6;
  };
  update(0, 0);

  return { root, update, center: new THREE.Vector3(0, 0.9, 0), radius: 1.05, rig, act };
}
