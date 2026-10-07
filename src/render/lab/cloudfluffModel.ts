// Cloudfluff (model lab version): a fluffball that belongs to no source stream and can be seen anywhere; it hums a song with no melody that puts people at ease. Neutral, support.
// Identifying features: 1. A solid cumulus body: plump cloud puffs stacked in three layers (a flat cloud base, a ring of puffs around a warm glow at the front, and a row of small clouds behind the top of the head), the underside is the apricot of dawn clouds, and the silhouette is a flat-bottomed cumulus.
// 2. A tuft of curl on top of the head curling forward, trembling along with the humming. 3. A bit of warm golden light shows through the gaps between the four puffs at the front (as if the sun were hidden in the cloud), warming the surrounding clouds, and lighting up to the beat while humming.
// A cloud has no face: no eyes, mouth or blush are added; the front is not one smooth big ball but several puffs crowded together.
// Body shape: a floating cloud fluffball, wider than it is tall, with two small cloud-puff hands and a trail of ever smaller cloud puffs behind it as a tail. No translucent mist shell; everything is solid puffs.
// Personality: a clingy, slow little humming cloud: it drifts over to whoever is tired and hums beside them. Personality comes from posture (the whole cloud leans to one side), the gentle sway while humming and the flicker of the warm glow.
// Gaze order: the warm glow at the center of the puffs first, the curl on top of the head second, the cloud hands and tail as support. Back: the tail curls up to the upper right, and a red maple leaf picked up on its travels is caught in the puffs (it can be seen anywhere).
// Action table: idle floats up and down and sways left and right to the beat of the humming, the cloud hands keep the beat, the curl sways half a beat behind, the warm glow breathes slowly, and every few seconds it hums a phrase (the warm glow lights up to the beat); move floats along in little hops;
// charge-up act.puff swells the puffs of the whole body by a ring; strike throws a fluff ball from a cloud hand, or act.hum hums, brightens the warm glow and shakes the curl; hit squashes flat and springs back; victory spins a full turn with both hands raised.
// Anchors: head (center of the puffs' front edge, used to align the prologue's forehead touch), eyes (empty array: no eyes), mouth and glow (warm glow), curl (tip of the curl),
// handL / handR (cloud hands), tail (end of the cloud tail), core (center of the body), leaf (red leaf).

import * as THREE from 'three';
import { curveTable, loft, mergeStatic, outline, partKit, PI, slab, type LabModel } from './shapes.ts';
import { labToon, rampTexture } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ss = THREE.MathUtils.smoothstep;
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);

// ───────────────────────── Helpers ─────────────────────────

/** Apply vertex colors by vertex position and normal (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
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

/** Make the object's y axis point along yDir and its z axis face zHint as far as possible */
function orient(o: THREE.Object3D, yDir: THREE.Vector3, zHint: THREE.Vector3): void {
  const y = yDir.clone().normalize();
  const z = zHint.clone().addScaledVector(y, -zHint.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/**
 * A solid cloud puff: the top half is a sphere and the bottom half is squashed to a factor of squash (so the cloud base is flat); it can be stretched along x and z.
 * Normals use the ellipsoid's analytic form so the sphere's seam shows no outline line; vertex colors are applied with color(absolute coordinates, normal), and finally translated by -off into the group.
 */
function puffGeo(c: THREE.Vector3, r: number, color: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color, o: { squash?: number; seg?: number; rings?: number; ex?: number; ez?: number; off?: THREE.Vector3 } = {}): THREE.BufferGeometry {
  const sq = o.squash ?? 0.6;
  const ex = o.ex ?? 1;
  const ez = o.ez ?? 1;
  const g = new THREE.SphereGeometry(1, o.seg ?? 24, o.rings ?? 14);
  g.deleteAttribute('uv');
  const P = g.attributes.position as THREE.BufferAttribute;
  const N = g.attributes.normal as THREE.BufferAttribute;
  const n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    const ux = P.getX(i);
    const uy = P.getY(i);
    const uz = P.getZ(i);
    const s = uy < 0 ? sq : 1;
    P.setXYZ(i, c.x + r * ex * ux, c.y + r * s * uy, c.z + r * ez * uz);
    n.set(ux / ex, uy / s, uz / ez).normalize();
    N.setXYZ(i, n.x, n.y, n.z);
  }
  paint(g, color);
  if (o.off) g.translate(-o.off.x, -o.off.y, -o.off.z);
  return g;
}

// ───────────────────────── Shape ─────────────────────────

export function buildCloudfluffLab(): LabModel {
  const RIMC = 0xd4e8ff;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  // Cloud shading: the dark side is still bright (solid but light) and the threshold is low, so the puffs at the front are not cut into patches by the light/shadow boundary (pitfall 40)
  const cloudRamp = rampTexture([[-1, 0.68], [-0.22, 0.85], [0.28, 1]]);
  const M = {
    cloud: vc(labToon(0xffffff, { rim: 0.6, rimColor: RIMC })),
    leaf: vc(labToon(0xffffff, { rim: 0.4, rimColor: 0xffe2cc })),
    // Warm glow at the center of the puffs: the only emissive on the whole body
    glow: labToon(0xffe0a0, { ramp: 'gem', rim: 0, emissive: 0xffa030, emissiveAmt: 1 }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;
  M.cloud.gradientMap = cloudRamp;

  const root = new THREE.Group();
  root.name = 'cloudfluff-lab';
  const { add, group } = partKit();

  // float: floating, tilting the head, swaying left and right (around the body center); body: breathing and fluffy scaling; inner: parts are placed in absolute coordinates
  const PIV = 0.62;
  const float = group(root, [0, PIV, 0]);
  const body = group(float);
  // The midpoint between head and tail sits at the origin (the cloud tail trails backward), so the lab does not clip it when turned to a side view (pitfall 66)
  const inner = group(body, [0, -PIV, 0.15]);

  // Cloud color: creamy white on top, turning to dawn-cloud apricot toward the bottom, deepest at the cloud base
  const cTop = col(0xfffdf8);
  const cMid = col(0xfcf0e6);
  const cPeach = col(0xf7c0a4);
  const cDeep = col(0xeca48a);
  const cloudColor = (p: THREE.Vector3, n: THREE.Vector3) =>
    cTop.clone().lerp(cMid, ss(0.8 - p.y, 0, 0.3)).lerp(cPeach, ss(-n.y, 0.05, 0.6) * 0.9).lerp(cDeep, ss(0.36 - p.y, 0, 0.08) * ss(-n.y, 0.3, 0.85));

  // ── Puffs: a ring of squashed big puffs at the cloud base, three small clouds behind the top of the head (center x, y, z, radius, squash ratio of the lower half) ──
  const LOBES: [number, number, number, number, number][] = [
    [0, 0.4, 0.0, 0.25, 0.55],
    [-0.235, 0.4, 0.165, 0.17, 0.6],
    [0.245, 0.39, 0.155, 0.165, 0.6],
    [-0.375, 0.5, -0.02, 0.2, 0.6],
    [0.385, 0.49, 0.0, 0.19, 0.6],
    [-0.21, 0.52, -0.27, 0.21, 0.6],
    [0.19, 0.53, -0.28, 0.2, 0.6],
    [0.0, 0.58, -0.35, 0.2, 0.7],
    [-0.2, 0.9, -0.11, 0.17, 0.8],
    [0.215, 0.88, -0.1, 0.15, 0.8],
    [0.0, 0.98, -0.17, 0.155, 0.8],
  ];
  for (const [x, y, z, r, sq] of LOBES) add(inner, puffGeo(v(x, y, z), r, cloudColor, { squash: sq }), M.cloud);

  // ── Front: the spot where the head used to be becomes a cluster of clouds, one big puff behind holds up the silhouette and five in front surround the warm glow at the center; the warm glow warms the clouds around it ──
  // The warm glow sits in the gap between four puffs, showing only an irregular small patch, not a perfectly round glowing disc (so it does not read as an eye)
  // The puffs differ in size and are left-right asymmetric (a symmetric ring would read as a flower), and the warm glow sits slightly to the lower right
  const GLOW_C = v(0.03, 0.615, 0.26);
  const cWarm = col(0xffc878);
  const warmColor = (p: THREE.Vector3, n: THREE.Vector3) => {
    const d = p.distanceTo(GLOW_C);
    return cloudColor(p, n).lerp(cWarm, (1 - ss(d, 0.06, 0.22)) * 0.85);
  };
  const FRONT: [number, number, number, number, number][] = [
    [0, 0.7, -0.03, 0.29, 0.8],
    [-0.03, 0.86, 0.07, 0.19, 0.8],
    [-0.17, 0.72, 0.15, 0.18, 0.75],
    [0.2, 0.75, 0.12, 0.15, 0.75],
    [-0.12, 0.53, 0.21, 0.15, 0.7],
    [0.17, 0.545, 0.2, 0.125, 0.7],
  ];
  for (const [x, y, z, r, sq] of FRONT) add(inner, puffGeo(v(x, y, z), r, warmColor, { squash: sq }), M.cloud);
  add(inner, new THREE.SphereGeometry(0.052, 16, 12), M.glow, GLOW_C.toArray() as [number, number, number]);

  // ── Curl: a tuft of hair on top of the head curling forward and to the right, rooted inside the head and rounded at the end ──
  // The curl's plane is tilted 0.8 rad: a loop is visible from both the front and the side, instead of just a stick like an ear
  const curlBase = group(inner, [0.02, 1.0, 0.09], [0.12, -0.8, 0]);
  const curlWag = group(curlBase);
  // Short stalk and thick root, like a tuft of hair curling up, not like an antenna
  const curlPts = [v(0, -0.07, 0), v(0, 0.0, 0), v(0.012, 0.06, 0), v(0.05, 0.115, 0), v(0.11, 0.13, 0), v(0.155, 0.1, 0), v(0.158, 0.05, 0), v(0.125, 0.025, 0), v(0.09, 0.04, 0), v(0.088, 0.072, 0)].map((p) => p.multiplyScalar(1.25));
  {
    const prof = curveTable([[0, 0, 0], [0.05, 0.065, 0.065], [0.3, 0.045, 0.045], [0.75, 0.032, 0.032], [0.95, 0.024, 0.024], [1, 0, 0]]);
    const g = paint(loft(curlPts, (t) => prof(t), { segs: 48, radial: 12, side: v(0, 0, 1) }), () => cTop);
    add(curlWag, g, M.cloud);
  }
  const curlTip = group(curlWag, curlPts[curlPts.length - 1].toArray() as [number, number, number]);

  // ── Cloud hands: on each side a small puff reaching forward, with one smaller puff at its front end (like fingers) ──
  const arms: { g: THREE.Group; sx: number; hand: THREE.Group }[] = [];
  for (const sx of [-1, 1]) {
    const piv = v(sx * 0.3, 0.5, 0.06);
    const g = group(inner, piv.toArray() as [number, number, number]);
    add(g, puffGeo(v(sx * 0.37, 0.47, 0.21), 0.078, cloudColor, { squash: 0.8, ez: 1.2, seg: 18, rings: 12, off: piv }), M.cloud);
    add(g, puffGeo(v(sx * 0.33, 0.455, 0.295), 0.05, cloudColor, { squash: 0.8, seg: 16, rings: 10, off: piv }), M.cloud);
    arms.push({ g, sx, hand: group(g, [sx * 0.05, -0.03, 0.2]) });
  }

  // ── Cloud tail: a trail of ever smaller puffs dragged out from behind, curling up to the right ──
  const tailPiv = v(0.08, 0.56, -0.42);
  const tailG = group(inner, tailPiv.toArray() as [number, number, number]);
  const TAIL: [number, number, number, number][] = [
    [0.12, 0.54, -0.56, 0.12],
    [0.25, 0.645, -0.68, 0.095],
    [0.34, 0.785, -0.72, 0.07],
  ];
  for (const [x, y, z, r] of TAIL) add(tailG, puffGeo(v(x, y, z), r, cloudColor, { squash: 0.75, seg: 20, rings: 12, off: tailPiv }), M.cloud);
  const last = TAIL[TAIL.length - 1];
  const tailTip = group(tailG, [last[0] - tailPiv.x, last[1] - tailPiv.y, last[2] - tailPiv.z]);

  // ── Red maple leaf: caught in the puff on the left of the back, half buried in it, picked up on its travels ──
  const leafG = group(inner);
  {
    const L = [-0.21, 0.52, -0.27, 0.21];
    const dir = v(-0.35, 0.5, -0.8).normalize();
    const at = v(L[0], L[1], L[2]).addScaledVector(dir, L[3] - 0.025);
    leafG.position.copy(at);
    // The leaf tip follows the cloud surface upward and slants 30 degrees outward (-x), with the leaf face roughly facing outward
    const tan = v(-0.35, 1, 0).addScaledVector(dir, -v(-0.35, 1, 0).dot(dir)).normalize();
    orient(leafG, tan.multiplyScalar(0.87).addScaledVector(dir, 0.5), dir);
    // Five-pointed maple leaf outline: points and notches alternate, narrowing on the leaf stalk side
    const tips: [number, number][] = [[-15, 0.55], [35, 0.82], [90, 1], [145, 0.82], [195, 0.55]];
    const pts: [number, number][] = [];
    const at2 = (deg: number, r: number): [number, number] => [Math.cos((deg * PI) / 180) * r, Math.sin((deg * PI) / 180) * r];
    for (let i = 0; i < tips.length; i++) {
      pts.push(at2(tips[i][0], tips[i][1]));
      if (i < tips.length - 1) pts.push(at2((tips[i][0] + tips[i + 1][0]) / 2, 0.36));
    }
    pts.push(at2(235, 0.2), at2(270, 0.14), at2(305, 0.2));
    const S = 0.085;
    const geo = slab(outline(pts.map(([x, y]) => [x * S, y * S + 0.03])), 0.01, 0.004, 4);
    geo.computeVertexNormals();
    const cA = col(0xe4603a);
    const cB = col(0xf29a4a);
    paint(geo, (p) => cA.clone().lerp(cB, ss(p.y, 0.05, 0.11)));
    add(leafG, geo, M.leaf);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // Anchors (for hooking into the game): all empty groups, following the action
  // No face: head sits at the center of the puffs' front edge (directly in front of the warm glow, on the surface of the front puffs), and the prologue's forehead touch aligns to it; eyes is an empty array
  const glowA = group(inner, GLOW_C.toArray() as [number, number, number]);
  const rig = {
    head: group(inner, [0.02, 0.63, 0.34]),
    eyes: [] as THREE.Group[],
    anchors: {
      mouth: glowA,
      glow: glowA,
      curl: curlTip,
      handL: arms[0].hand,
      handR: arms[1].hand,
      tail: tailTip,
      core: group(inner, [0, 0.6, 0]),
      leaf: group(leafG, [0, 0.06, 0]),
    },
  };
  // Action weights: puff is fluffiness (the puffs of the whole body swell by a ring), hum is humming (the warm glow lights up to the beat, the curl trembles, the cloud hands keep the beat)
  const act = { puff: 0, hum: 0 };

  // Static parts merged (mesh budget N 40): the moving groups act as owners
  mergeStatic(root, {
    owners: [float, body, curlWag, tailG, ...arms.map((a) => a.g)],
    rig,
  });

  // ── Idle action: floats up and down and sways left and right to the beat of the humming, cloud hands keep the beat, curl sways half a beat behind, warm glow breathes, hums a phrase every 7 seconds ──
  const TILT = 0.06;
  let lastGlow = Number.NaN;
  const update = (t: number) => {
    const pf = act.puff;
    // Idle humming: hums for 2.2 seconds every 7 seconds (fading in and out); when a performance gives act.hum, the larger of the two wins
    const ph = t % 7;
    const idleHum = ss(ph, 3.8, 4.1) * (1 - ss(ph, 5.7, 6.0));
    const hm = Math.max(act.hum, idleHum * 0.6);
    float.position.y = PIV + Math.sin(t * 1.2) * 0.025 + Math.sin(t * 2.4) * 0.006 * hm;
    float.rotation.z = TILT + Math.sin(t * 0.8) * 0.04 + Math.sin(t * 2.4) * 0.02 * hm;
    float.rotation.x = Math.sin(t * 0.6) * 0.02;
    float.rotation.y = Math.sin(t * 0.3) * 0.12;
    const br = Math.sin(t * 1.6);
    body.scale.set(1 + br * 0.01 + pf * 0.1, 1 - br * 0.008 + pf * 0.07, 1 + br * 0.01 + pf * 0.1);
    // Curl: sways half a beat behind, trembles while humming; stands up when fluffy
    curlWag.rotation.set(-pf * 0.25, 0, Math.sin(t * 0.8 - 0.8) * 0.08 + Math.sin(t * 19) * 0.05 * hm);
    // Cloud hands keep the beat
    for (const a of arms) {
      const beat = Math.sin(t * 2.4 + (a.sx > 0 ? 0 : PI)) * (0.05 + 0.1 * hm);
      a.g.rotation.set(beat - pf * 0.2, 0, a.sx * (Math.sin(t * 0.8) * 0.03 + pf * 0.25));
    }
    tailG.rotation.set(Math.sin(t * 0.7) * 0.05, Math.sin(t * 0.9) * 0.14, Math.sin(t * 0.8 - 1) * 0.04);
    // Warm glow: breathes slowly, lights up to the beat while humming
    const gl = 0.82 + Math.sin(t * 1.6) * 0.06 + hm * (0.3 + Math.sin(t * 4.8) * 0.12) + pf * 0.2;
    if (Math.abs(gl - lastGlow) > 1e-3) {
      lastGlow = gl;
      M.glow.emissiveIntensity = gl;
    }
  };
  update(0);

  return { root, update, center: new THREE.Vector3(0, 0.72, 0), radius: 0.8, rig, act };
}
