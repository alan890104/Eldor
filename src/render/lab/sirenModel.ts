// Driftsong Siren (model lab version, SR, water + dark): the longest-told story of the Tidesong Isles is that a stretch of the holy whale's song was stolen, and the thief was the siren.
// What she sings is that lost melody, and any sailor who hears it falls asleep and dreams of a homeland he can never return to.
// Only one form (decided by the user, 2026-09-28): the builder ignores the breakthrough stage, and the game scales this one shape up by its per-rarity height table.
//
// Body shape: an upright, floating leafy seadragon (a close relative of the seahorse), not a mermaid and without a human face. A seahorse's head is one long tubular snout, a flute by nature:
// the stolen song is blown out from the snout tip. The body is an S-shape of segmented bony rings, with the tail curled toward the belly side, gripping a glowing song pearl tightly.
// Identifying features:
//   1. A long tubular snout tilted up: the snout tip flares into a trumpet mouth with a bit of sea-cyan light showing in it (she is singing); three pale rose rings on the snout.
//   2. The song pearl held by the curled tail: a glowing sea-cyan pearl, the melody stolen from the holy whale (the main light on the whole body).
//   3. Leaf fins: pairs of notched, wavy-edged seaweed leaves growing from behind the head, the nape, the middle of the back, the belly side and the tail root, wine red at the root like the body, turning outward to deep sea cyan,
//      with sea-foam-colored tips; swaying slowly with the tide like a long veil dragged behind her. The silhouette reads as a leafy seadragon at a glance.
//   4. A wine-red body: in the deep sea red looks black (dark element), deepest along the spine, fading to rose on the belly side, with the ridge of each bony ring one step paler.
//   5. A five-pointed bony coronet on top of the head (seahorses really have these), a finned dorsal fin on the back trembling rapidly, and a pair of small pectoral fins behind the head.
// The eyes follow the species: a seahorse's eyes sit on the two sides of the head in a ring of bony eye mounts, small and dark, with only a ring of very dark copper iris and a small highlight, no doll eyes;
// both eyes turn together (a seahorse's eyes can turn independently, but here the gaze is kept consistent). No eyelids and no blinking. No lips and no smile line; the mouth is the trumpet at the snout tip.
//
// Personality: a haughty, mysterious song thief. Head held high, she sings to herself that song which is not hers, her tail gripping the song pearl tightly, and no one is to take it back.
// Personality comes out of posture: head high, snout pointing up, the body swaying slowly with the tide and the leaf fins trailing behind; she does not look at you, but you will keep hearing her.
// Gaze order: the head (the upturned long snout, the sea-cyan light at the snout tip, the coronet, the eye mounts) first, the song pearl in the tail second, and the leaf fins and dorsal fin as support.
// Back speaks of "a homeland he can never return to": the leaf fins drape down the back like a long veil, with the dorsal fin trembling in the middle; at the tail root a sailor's brass compass is tied with a seaweed cord,
// its needle always spinning and unable to stop (the sleeping sailor dreams of home but can never find the way back; the compass is something she took from a ship).
// Restrained light effects: the emissive is only the song pearl and the trumpet mouth at the snout tip, with no bloom, no translucent mist shell and no scattered glowing dots.
//
// <Action table> (act weights: sing 0-1, glow song pearl lights up 0-1)
//   Idle: floats upright in the water bobbing up and down, the body swaying slowly with the tide; the head nods bit by bit to the beat of the song and slowly turns left and right; the dorsal fin trembles rapidly and the pectoral fins fan;
//         the leaf fins sway half a beat behind as if pulled by the tide; the song pearl flickers with the melody; the compass swings and its needle slowly turns.
//   Move: the body leans forward and the tail loosens slightly, and she glides along upright with the leaf fins dragging back.
//   Charge-up (sing): the snout tilts higher, the light of the trumpet mouth brightens, the leaf fins spread outward, and the song pearl lights up with it (glow).
//   Strike: the snout points at the target, and the singing comes out of the mouth anchor (sound waves of ultimates or skills are emitted from here).
//   Hit: the body shrinks into a more curved S, the tail grips the song pearl tighter and the leaf fins whip back; the eyes stay open as usual (there are no eyelids to begin with).
//   Victory: slowly turns a full circle, lifts the tail holding the song pearl forward, and tilts her head back to sing the last line.
// Anchors: head (center of the head), eyes (surface of the two eyes), mouth (trumpet mouth at the snout tip), pearl (center of the song pearl), crown (top of the coronet),
//   compass (compass face), tail (tail tip), finL / finR (middle-of-back leaf fin tips, L is her own left +x).

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { lathe, mergeStatic, outline, partKit, PI, slab, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

type Vec = THREE.Vector3;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const sstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// ───────────────────────── Geometry helpers ─────────────────────────

/**
 * Grid surface: P is a rows × cols grid of points, rows are joined into a band, and the cols direction wraps around (when wrapRows is true the rows wrap too, making a donut).
 * A row that shrinks to a point (loft end radius 0) keeps only one vertex, and its normal naturally averages; winding is decided automatically by signed volume, always facing outward.
 * Vertices at the same position (for example where the top and bottom faces of a fan fin's edge meet) have their normals averaged, so the seam has no extra crease.
 * Returns the geometry and each vertex's (row, column), for coloring.
 */
function gridGeo(P: Vec[][], wrapRows = false): { geo: THREE.BufferGeometry; ij: number[] } {
  const rows = P.length;
  const cols = P[0].length;
  const pos: number[] = [];
  const ij: number[] = [];
  const id: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const r = P[i];
    let pole = true;
    for (let j = 1; j < cols && pole; j++) if (r[j].distanceToSquared(r[0]) > 1e-12) pole = false;
    const ids: number[] = [];
    for (let j = 0; j < cols; j++) {
      if (pole && j > 0) {
        ids.push(ids[0]);
        continue;
      }
      ids.push(pos.length / 3);
      pos.push(r[j].x, r[j].y, r[j].z);
      ij.push(i, j);
    }
    id.push(ids);
  }
  const idx: number[] = [];
  const tri = (a: number, b: number, c: number) => {
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  };
  const rn = wrapRows ? rows : rows - 1;
  for (let i = 0; i < rn; i++) {
    const i1 = (i + 1) % rows;
    for (let j = 0; j < cols; j++) {
      const j1 = (j + 1) % cols;
      tri(id[i][j], id[i1][j], id[i][j1]);
      tri(id[i1][j], id[i1][j1], id[i][j1]);
    }
  }
  const A = v3();
  const B = v3();
  const C = v3();
  let vol = 0;
  for (let k = 0; k < idx.length; k += 3) {
    A.fromArray(pos, idx[k] * 3);
    B.fromArray(pos, idx[k + 1] * 3);
    C.fromArray(pos, idx[k + 2] * 3);
    vol += A.dot(B.cross(C));
  }
  if (vol < 0) for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Vertices at the same position average their normals
  const na = g.attributes.normal as THREE.BufferAttribute;
  const buckets = new Map<string, number[]>();
  for (let k = 0; k < pos.length / 3; k++) {
    const key = `${Math.round(pos[k * 3] * 1e5)},${Math.round(pos[k * 3 + 1] * 1e5)},${Math.round(pos[k * 3 + 2] * 1e5)}`;
    const b = buckets.get(key);
    if (b) b.push(k);
    else buckets.set(key, [k]);
  }
  const n = v3();
  for (const b of buckets.values()) {
    if (b.length < 2) continue;
    n.set(0, 0, 0);
    for (const k of b) n.add(A.fromBufferAttribute(na, k));
    n.normalize();
    for (const k of b) na.setXYZ(k, n.x, n.y, n.z);
  }
  return { geo: g, ij };
}

interface Frame {
  C: Vec;
  T: Vec;
  W: Vec;
  H: Vec;
}

/**
 * Loft along a curve, returning the points of each row (for gridGeo) and the frame of each row. The cross-section is a superellipse: prof(t) = [width radius, height radius, height-direction offset],
 * the width direction W is decided by side(t, tangent) (default +x), and the height direction H = tangent × W. off can further displace each point (leaf-edge undulation, bony rings).
 */
function sweep(
  pts: Vec[],
  prof: (t: number) => number[],
  o: { segs: number; radial: number; side?: (t: number, T: Vec) => Vec; exp?: (t: number) => number; off?: (t: number, th: number, x: number, y: number) => [number, number] },
): { P: Vec[][]; F: Frame[]; path: THREE.CatmullRomCurve3 } {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const P: Vec[][] = [];
  const F: Frame[] = [];
  for (let i = 0; i <= o.segs; i++) {
    const t = i / o.segs;
    const C = path.getPointAt(t);
    const T = path.getTangentAt(t);
    const s = o.side ? o.side(t, T) : v3(1, 0, 0);
    const W = s.clone().addScaledVector(T, -T.dot(s)).normalize();
    const H = v3().crossVectors(T, W).normalize();
    const [a, b, dh = 0] = prof(t);
    const e = o.exp ? o.exp(t) : 2;
    const row: Vec[] = [];
    for (let j = 0; j < o.radial; j++) {
      const th = (j / o.radial) * PI * 2;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      let x = Math.sign(c) * Math.pow(Math.abs(c), 2 / e) * a;
      let y = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / e) * b;
      if (o.off && (a > 0 || b > 0)) [x, y] = o.off(t, th, x, y);
      row.push(C.clone().addScaledVector(W, x).addScaledVector(H, y + dh));
    }
    P.push(row);
    F.push({ C, T, W, H });
  }
  return { P, F, path };
}

/** Color by vertex (the material must enable vertexColors and set base color to white) */
function paint(g: THREE.BufferGeometry, f: (k: number, p: Vec, n: Vec) => THREE.Color): THREE.BufferGeometry {
  const pa = g.attributes.position as THREE.BufferAttribute;
  const na = g.attributes.normal as THREE.BufferAttribute;
  const out = new Float32Array(pa.count * 3);
  const P = v3();
  const N = v3();
  for (let k = 0; k < pa.count; k++) {
    const c = f(k, P.fromBufferAttribute(pa, k), N.fromBufferAttribute(na, k));
    out[k * 3] = c.r;
    out[k * 3 + 1] = c.g;
    out[k * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}
const tint = (g: THREE.BufferGeometry, c: THREE.ColorRepresentation) => {
  const cc = col(c);
  if (!g.attributes.normal) g.computeVertexNormals();
  return paint(g, () => cc);
};

/** Left-right mirror (negate x, flip triangle facing) */
function mirrorX(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const m = g.clone();
  m.scale(-1, 1, 1);
  const idx = m.index;
  if (idx) {
    const a = idx.array as Uint16Array | Uint32Array;
    for (let k = 0; k < a.length; k += 3) [a[k + 1], a[k + 2]] = [a[k + 2], a[k + 1]];
    idx.needsUpdate = true;
  }
  return m;
}

/**
 * Fan fin (a membrane with fin rays): spread from the origin in the local xy plane (angles a0 to a1), thickness along z, with the top and bottom faces of the edge rounded into lips.
 * The fin rays are ridges in the thickness, and the membrane edge between rays dips inward a little; lenAt(u) is the ray length at u (0-1 across the fan).
 */
function fanGeo(a0: number, a1: number, rays: number, lenAt: (u: number) => number, r0: number, th: number, base: THREE.Color, rayC: THREE.Color, rim: THREE.Color) {
  const nA = rays * 4;
  const nV = 8;
  const P: Vec[][] = [];
  for (let i = 0; i <= nA; i++) {
    const u = i / nA;
    const a = a0 + (a1 - a0) * u;
    const d = v3(Math.cos(a), Math.sin(a), 0);
    const rib = Math.pow(Math.cos(PI * rays * u), 2);
    const L = lenAt(u) * (1 - 0.1 * (1 - rib));
    const T = th * (0.45 + 0.55 * rib) * Math.pow(Math.sin(PI * u), 0.35);
    const row: Vec[] = [];
    for (let j = 0; j < nV * 2; j++) {
      const ph = (j / (nV * 2)) * PI * 2;
      const v = (1 - Math.cos(ph)) / 2;
      const z = T * Math.sin(ph) * (1 - 0.5 * v);
      row.push(d.clone().multiplyScalar(r0 + v * (L - r0)).add(v3(0, 0, z)));
    }
    P.push(row);
  }
  const { geo, ij } = gridGeo(P);
  paint(geo, (k) => {
    const u = ij[k * 2] / nA;
    const ph = (ij[k * 2 + 1] / (nV * 2)) * PI * 2;
    const v = (1 - Math.cos(ph)) / 2;
    const rib = Math.pow(Math.cos(PI * rays * u), 8);
    return base.clone().lerp(rayC, rib * 0.8).lerp(rim, sstep(0.72, 0.95, v) * 0.7);
  });
  return geo;
}

// ───────────────────────── Shape ─────────────────────────

export function buildSirenLab(): LabModel {
  // Color scheme: a wine-red body leaning plum (dark on the back and light on the belly, bony ring ridges one step paler), leaf fins from deep sea blue-green to sea-foam color, dark copper small eyes, a sea-cyan song pearl
  const WINE_D = col(0x2a0a1f);
  const WINE = col(0x551533);
  const ROSE = col(0x93446a);
  const THROAT = col(0xcf9aac);
  const RIDGE = col(0xc27f9c);
  const BAND = col(0xefc0c4);
  const TEAL_D = col(0x1a3d52);
  const TEAL = col(0x2d6c84);
  const FOAM = col(0xa3d9dc);
  const RIMC = 0xffb6cf;

  const vc = <T extends THREE.MeshToonMaterial>(m: T) => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    skin: vc(labToon(0xffffff, { rim: 0.75, rimColor: RIMC })),
    frond: vc(labToon(0xffffff, { rim: 0.55, rimColor: 0xbdfff0 })),
    eye: vc(labToon(0xffffff, { ramp: 'gem', rim: 0, spec: 0.5, specTh: 0.992 })),
    pearl: vc(labToon(0xffffff, { ramp: 'gem', emissive: 0x2cc9b0, emissiveAmt: 0.5, rim: 0.35, rimColor: 0xe6fff9 })),
    mouth: labToon(0x3b0d25, { rim: 0, emissive: 0x42e3c8, emissiveAmt: 0.25 }),
    brass: labToon(0xc99a45, { ramp: 'metal', spec: 1.2, specTh: 0.9, rim: 0.5, rimColor: 0xffe3a8 }),
    face: vc(labToon(0xffffff, { rim: 0.2 })),
    cord: labToon(0x5b5a2c, { rim: 0.35, rimColor: 0xd9f0b0 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'siren-lab';
  const kit = partKit();
  const { add, group } = kit;
  const INK_BODY = 510;

  // Hierarchy: root → float (bobbing) → body (swaying with the tide, pivot at the middle of the torso) → bo (parts placed in absolute coordinates)
  // The whole body is turned slightly to one side (haughty, not looking straight at you), so the snout's profile is visible from the front too
  const float = group(root, [0, 0.12, 0], [0, -0.35, 0]);
  const body = group(float, [0, 0.9, 0]);
  const bo = group(body, [0, -0.9, 0]);

  // Smooth interpolation of a cross-section table [t, width, thickness, offset]; both ends are closed into round caps with circular arcs (pitfall 25)
  const tabProf = (tab: number[][]) => (t: number) => {
    let i = 0;
    while (i < tab.length - 2 && t > tab[i + 1][0]) i++;
    const r0 = tab[i];
    const r1 = tab[i + 1];
    const u = (t - r0[0]) / (r1[0] - r0[0]);
    const s = u * u * (3 - 2 * u);
    if (i === 0) {
      const k = Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
      return [r1[1] * k, r1[2] * k, r1[3]];
    }
    if (i === tab.length - 2) {
      const k = Math.sqrt(Math.max(0, 1 - u * u));
      return [r0[1] * k, r0[2] * k, r0[3]];
    }
    return [r0[1] + (r1[1] - r0[1]) * s, r0[2] + (r1[2] - r0[2]) * s, r0[3] + (r1[3] - r0[3]) * s];
  };
  // ── Body: neck, torso and tail as one loft, with the tail curling toward the belly side (forward) ──
  const bodyPts = [
    v3(0, 1.47, -0.085),
    v3(0, 1.4, -0.075),
    v3(0, 1.27, -0.055),
    v3(0, 1.12, -0.01),
    v3(0, 0.95, 0.02),
    v3(0, 0.78, -0.01),
    v3(0, 0.63, -0.07),
    v3(0, 0.48, -0.12),
    v3(0, 0.35, -0.12),
    v3(0, 0.25, -0.065),
    v3(0, 0.2, 0.035),
    v3(0, 0.22, 0.14),
    v3(0, 0.3, 0.2),
    v3(0, 0.4, 0.19),
    v3(0, 0.455, 0.12),
    v3(0, 0.44, 0.055),
  ];
  // [t, width, thickness, offset toward the belly side]
  const bodyTab: number[][] = [
    [0, 0, 0, 0],
    [0.03, 0.06, 0.066, 0],
    [0.08, 0.075, 0.084, 0.0],
    [0.17, 0.104, 0.124, 0.02],
    [0.26, 0.124, 0.158, 0.05],
    [0.35, 0.112, 0.138, 0.032],
    [0.44, 0.088, 0.098, 0.006],
    [0.53, 0.068, 0.074, 0],
    [0.61, 0.057, 0.06, 0],
    [0.68, 0.05, 0.052, 0],
    [0.74, 0.045, 0.047, 0],
    [0.8, 0.041, 0.042, 0],
    [0.86, 0.037, 0.038, 0],
    [0.92, 0.032, 0.033, 0],
    [0.965, 0.024, 0.025, 0],
    [1, 0, 0, 0],
  ];
  const bodyProf = tabProf(bodyTab);
  // Bony rings: one every 0.052 from the chest down (0.044 on the tail), with slightly raised ridges one step paler in color; the rings on the front half of the belly are paler
  const BODY_LEN = new THREE.CatmullRomCurve3(bodyPts, false, 'centripetal').getLength();
  const ringAt = (t: number) => {
    const s = t * BODY_LEN;
    if (t < 0.15) return 0;
    const P = t < 0.45 ? 0.058 : 0.046;
    const k = 0.5 + 0.5 * Math.cos((2 * PI * s) / P);
    return Math.pow(k, 7) * sstep(0.15, 0.2, t) * (1 - sstep(0.94, 0.99, t));
  };
  const SEGS = 150;
  const RAD = 22;
  const bodySw = sweep(bodyPts, bodyProf, {
    segs: SEGS,
    radial: RAD,
    exp: (t) => 2 + sstep(0.4, 0.62, t) * 0.9,
    off: (t, th, x, y) => {
      const belly = Math.max(0, Math.sin(th)) * (1 - sstep(0.44, 0.52, t));
      const m = 1 + 0.032 * ringAt(t) * (1 - belly * 0.7);
      return [x * m, y * m];
    },
  });
  const bodyG = gridGeo(bodySw.P);
  paint(bodyG.geo, (k) => {
    const i = bodyG.ij[k * 2];
    const j = bodyG.ij[k * 2 + 1];
    const t = i / SEGS;
    const th = (j / RAD) * PI * 2;
    const ven = Math.sin(th); // 1 is the belly side, -1 the back side
    const c = WINE_D.clone().lerp(WINE, sstep(-0.95, -0.25, ven)).lerp(ROSE, sstep(0.25, 0.9, ven) * (0.85 - sstep(0.5, 0.8, t) * 0.35));
    return c.lerp(RIDGE, ringAt(t) * (0.16 + 0.14 * sstep(0.4, 0.55, t)));
  });
  add(bo, bodyG.geo, M.skin).userData.inkGroup = INK_BODY;
  const bodyF = bodySw.F;
  const frameAt = (t: number) => bodyF[Math.round(t * SEGS)];

  // ── Head: a long tubular snout tilted up, with the snout tip flaring into a trumpet mouth ──
  const HEAD_PITCH = -0.3;
  // The head turns a little more toward the same side: when singing she does not look straight at people, so the snout's profile is visible from the front
  const HEAD_YAW = -0.3;
  const NECK_P = v3(0, 1.4, -0.07);
  const neck = group(bo, NECK_P.toArray() as [number, number, number], [HEAD_PITCH, HEAD_YAW, 0]);
  neck.rotation.order = 'YXZ';
  const hd = group(neck, [-NECK_P.x, -NECK_P.y, -NECK_P.z]);
  const headPts = [v3(0, 1.515, -0.145), v3(0, 1.525, -0.08), v3(0, 1.53, 0.0), v3(0, 1.535, 0.08), v3(0, 1.545, 0.15), v3(0, 1.555, 0.26), v3(0, 1.565, 0.37), v3(0, 1.57, 0.415)];
  const headTab: number[][] = [
    [0, 0, 0, 0],
    [0.06, 0.05, 0.066, 0],
    [0.16, 0.078, 0.104, -0.006],
    [0.27, 0.088, 0.118, -0.013],
    [0.37, 0.078, 0.098, -0.021],
    [0.46, 0.056, 0.064, -0.024],
    [0.54, 0.038, 0.043, -0.018],
    [0.63, 0.031, 0.034, -0.011],
    [0.8, 0.029, 0.031, -0.004],
    [0.915, 0.033, 0.035, 0],
    [0.96, 0.047, 0.047, 0],
    [0.985, 0.043, 0.036, 0],
    [1, 0, 0, 0],
  ];
  const HSEGS = 84;
  const HRAD = 30;
  const headSw = sweep(headPts, tabProf(headTab), { segs: HSEGS, radial: HRAD, exp: (t) => 2.1 + sstep(0.1, 0.3, t) * 0.25 * (1 - sstep(0.4, 0.55, t)) });
  const headG = gridGeo(headSw.P);
  const snoutBand = (t: number) => {
    let b = 0;
    for (const c of [0.62, 0.72, 0.82]) b = Math.max(b, 1 - sstep(0.012, 0.024, Math.abs(t - c)));
    return b;
  };
  paint(headG.geo, (k) => {
    const t = headG.ij[k * 2] / HSEGS;
    const th = (headG.ij[k * 2 + 1] / HRAD) * PI * 2;
    const up = Math.sin(th);
    // Deepest on top of the head, fading to rose under the throat; three pale rings on the snout, and the lip of the trumpet mouth one step paler
    // The pale color follows only the throat, lower jaw and the lower edge of the snout (no pale patch is laid on the front of the head)
    const c = WINE_D.clone().lerp(WINE, sstep(0.9, 0.2, up)).lerp(ROSE, sstep(-0.1, -0.5, up)).lerp(THROAT, sstep(-0.35, -0.95, up) * (0.5 + 0.35 * sstep(0.1, 0.3, t)));
    c.lerp(BAND, snoutBand(t) * 0.85);
    c.lerp(RIDGE, sstep(0.94, 0.965, t) * 0.55);
    return c;
  });
  add(hd, headG.geo, M.skin).userData.inkGroup = INK_BODY;
  const headF = headSw.F;
  const hFrame = (t: number) => headF[Math.round(t * HSEGS)];

  // The trumpet mouth at the snout tip: a dark mouth that lets sea-cyan light show through when singing
  const tipF = hFrame(1);
  const lipF = hFrame(0.985);
  const mouthG = group(hd, lipF.C.clone().lerp(tipF.C, 0.7).toArray() as [number, number, number]);
  mouthG.quaternion.setFromUnitVectors(v3(0, 0, 1), tipF.T);
  add(mouthG, new THREE.SphereGeometry(0.03, 18, 8), M.mouth, [0, 0, 0], [0, 0, 0], [1, 0.82, 0.36]);

  // Coronet: a five-pointed bony coronet on top of the head, tilting back and growing out of the skull
  const crownF = hFrame(0.3);
  const crownTop = crownF.C.clone().addScaledVector(crownF.H, crownF.H.y > 0 ? 0.1 : -0.1);
  const crownG = group(hd, crownTop.toArray() as [number, number, number], [-0.35, 0, 0]);
  {
    const knob = lathe([[0.001, -0.05], [0.034, -0.045], [0.03, -0.012], [0.024, 0.006], [0.012, 0.014], [0.001, 0.016]], 14);
    add(crownG, tint(knob, WINE), M.skin).userData.inkGroup = INK_BODY;
    // Five blunt bony spines spread outward, the front one the tallest; the spine roots are buried in the coronet and the spine tips one step paler
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * PI * 2;
      const h = k === 0 ? 0.05 : 0.038;
      const cone = new THREE.ConeGeometry(0.011, h, 8, 3);
      cone.translate(0, h / 2, 0);
      paint(cone, (_i, p) => WINE.clone().lerp(RIDGE, sstep(0.2, 0.9, p.y / h) * 0.8));
      const sp = add(crownG, cone, M.skin, [Math.sin(a) * 0.017, -0.004, Math.cos(a) * 0.017]);
      sp.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
    }
  }

  // ── Eyes: small eyes in the bony eye mounts on the two sides of the head, dark, with a ring of dark copper iris and one small highlight; both eyes look the same way ──
  // Eye diameter about 15% of the head width, buried in the bony-ring socket (no doll eyes)
  const ER = 0.0135;
  const eyes: { gaze: THREE.Group; sx: number; anchor: THREE.Group }[] = [];
  const eyeF = hFrame(0.3);
  for (const sx of [1, -1]) {
    // The true position on the head surface: shot from the center of the head toward the side and slightly up to the surface, then buried inward by 0.4 of an eyeball radius
    const [a, b, dh] = tabProf(headTab)(0.3);
    const ang = 0.32;
    const surf = eyeF.C.clone().addScaledVector(eyeF.W, sx * a * Math.cos(ang)).addScaledVector(eyeF.H, b * Math.sin(ang) + dh);
    const d = eyeF.W.clone().multiplyScalar(sx * 0.86).addScaledVector(eyeF.H, 0.18).addScaledVector(eyeF.T, 0.42).normalize();
    const c = surf.clone().addScaledVector(d, -ER * 0.1);
    const eg = group(hd, c.toArray() as [number, number, number]);
    const r = v3().crossVectors(v3(0, 1, 0), d).normalize();
    const u = v3().crossVectors(d, r);
    eg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, d));
    // Eye mount: a ring of bone growing from the skull, with the eye sitting inside it
    const turret = lathe([[0.001, -0.032], [0.04, -0.028], [0.037, -0.01], [0.029, 0.002], [ER * 1.04, 0.006], [ER * 0.9, 0.0]], 20).rotateX(PI / 2);
    add(eg, tint(turret, WINE.clone().lerp(WINE_D, 0.25)), M.skin).userData.inkGroup = INK_BODY;
    const ball = new THREE.SphereGeometry(ER, 18, 10, 0, PI * 2, 0, PI * 0.62).rotateX(PI / 2);
    add(eg, tint(ball, 0x1c0913), M.eye);
    const gaze = group(eg, [0, 0, 0]);
    const iris = new THREE.SphereGeometry(ER + 0.0012, 18, 4, 0, PI * 2, 0, 0.62).rotateX(PI / 2);
    paint(iris, (_k, p) => {
      const rr = Math.hypot(p.x, p.y) / ER;
      return col(0x160810).lerp(col(0x553619), sstep(0.3, 0.38, rr) * (1 - sstep(0.5, 0.58, rr)));
    });
    add(gaze, iris, M.eye);
    const hl = add(gaze, new THREE.SphereGeometry(ER * 0.24, 8, 6), M.hi, [-ER * 0.32 * sx, ER * 0.36, ER * 0.93], [0, 0, 0], [1, 1, 0.45]);
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
    eyes.push({ gaze, sx, anchor: group(eg, [0, 0, ER]) });
  }

  // ── Dorsal fin: a finned fan fin in the middle of the back, trembling rapidly ──
  const dorsF = frameAt(0.36);
  const dorsP = dorsF.C.clone().addScaledVector(dorsF.H, -0.1);
  const dorsBase = group(bo, dorsP.toArray() as [number, number, number], [0, PI / 2, 0]);
  dorsBase.rotateZ(-0.35);
  const dorsal = group(dorsBase);
  add(dorsal, fanGeo(-1.05, 1.15, 9, (u) => 0.16 * (0.72 + 0.28 * Math.sin(PI * u)), 0.01, 0.009, WINE.clone().lerp(ROSE, 0.35), RIDGE, FOAM), M.frond);

  // ── Leaf fins: seaweed leaves growing from the body, wine red at the root like the body, turning outward to deep sea cyan, with sea-foam tips ──
  // All flow backward and down (like a long veil dragged behind her), not spreading to the sides. A left-right pair that only swings about x (left-right symmetric) can be merged into one mesh (pair)
  interface FrondSpec {
    parent: THREE.Object3D;
    at: Vec;
    path: Vec[];
    W: number;
    lobes: number;
    n0: Vec;
    n1: Vec;
    amp: number;
    ph: number;
    /** A left-right pair (false is a single one on the midline) */
    pair: boolean;
  }
  const fronds: { g: THREE.Group; amp: number; ph: number }[] = [];
  const frondTips: THREE.Group[] = [];
  const makeFrond = (s: FrondSpec, tipAnchor = false) => {
    const g = group(s.parent, s.at.toArray() as [number, number, number]);
    const segs = 20 + s.lobes * 9;
    const RADF = 14;
    const sw = sweep(
      s.path,
      (t) => {
        const env = Math.pow(Math.sin(PI * Math.pow(t, 0.75)), 0.7) * (0.3 + 0.7 * sstep(0.02, 0.2, t));
        const lobe = 0.74 + 0.26 * Math.pow(Math.abs(Math.sin(PI * s.lobes * (t * 0.9 + 0.06))), 0.7);
        return [s.W * env * lobe * (1 - 0.2 * t), (0.012 * (1 - 0.5 * t) + 0.004) * Math.pow(Math.sin(PI * t), 0.3)];
      },
      {
        segs,
        radial: RADF,
        side: (t, T) => v3().crossVectors(s.n0.clone().lerp(s.n1, t).normalize(), T),
        off: (t, th, x, y) => {
          const edge = Math.pow(Math.cos(th), 2);
          const rib = 1 + 0.7 * Math.pow(Math.abs(Math.sin(th)), 14) * (1 - t);
          return [x, y * rib + 0.011 * Math.sin(2 * PI * s.lobes * 1.5 * t + s.ph) * edge * Math.sin(PI * t)];
        },
      },
    );
    const fg = gridGeo(sw.P);
    paint(fg.geo, (k) => {
      const t = fg.ij[k * 2] / segs;
      const th = (fg.ij[k * 2 + 1] / RADF) * PI * 2;
      const edge = Math.pow(Math.abs(Math.cos(th)), 3);
      const c = WINE.clone().lerp(TEAL_D, sstep(0.02, 0.1, t)).lerp(TEAL, sstep(0.28, 0.7, t)).lerp(FOAM, sstep(0.74, 0.98, t) * 0.8);
      return c.lerp(FOAM, edge * 0.25 * sstep(0.12, 0.4, t));
    });
    add(g, fg.geo, M.frond);
    if (s.pair) add(g, mirrorX(fg.geo), M.frond, [-2 * s.at.x, 0, 0]);
    fronds.push({ g, amp: s.amp, ph: s.ph });
    if (tipAnchor) {
      const tip = s.path[s.path.length - 1];
      frondTips.push(group(g, [tip.x, tip.y, tip.z]));
      if (s.pair) frondTips.push(group(g, [-tip.x - 2 * s.at.x, tip.y, tip.z]));
    }
  };
  const N = (x: number, y: number, z: number) => v3(x, y, z).normalize();
  // The tide flows in from her right rear: every leaf drifts toward her left rear (+x, -z), left-right asymmetric, so from the front they do not look like a row of legs
  // Two on the nape
  makeFrond({
    parent: bo,
    at: v3(-0.05, 1.3, -0.115),
    path: [v3(0, 0, 0), v3(-0.02, -0.03, -0.1), v3(0.04, -0.12, -0.2), v3(0.12, -0.25, -0.25), v3(0.18, -0.4, -0.24)],
    W: 0.07,
    lobes: 4,
    n0: N(-0.9, 0.1, 0.3),
    n1: N(0.45, 0, 0.9),
    amp: 0.08,
    ph: 0.4,
    pair: false,
  });
  makeFrond({
    parent: bo,
    at: v3(0.05, 1.3, -0.115),
    path: [v3(0, 0, 0), v3(0.06, -0.02, -0.09), v3(0.14, -0.1, -0.17), v3(0.22, -0.22, -0.2), v3(0.27, -0.36, -0.18)],
    W: 0.072,
    lobes: 4,
    n0: N(1, 0.1, 0.1),
    n1: N(0.6, 0, 0.8),
    amp: 0.08,
    ph: 0.9,
    pair: false,
  });
  // Two in the middle of the back: the longest, like a long veil dragged behind her
  makeFrond({
    parent: bo,
    at: v3(-0.06, 1.06, -0.13),
    path: [v3(0, 0, 0), v3(-0.03, -0.05, -0.1), v3(0.03, -0.17, -0.21), v3(0.12, -0.33, -0.26), v3(0.2, -0.5, -0.23), v3(0.24, -0.62, -0.16)],
    W: 0.095,
    lobes: 5,
    n0: N(-0.9, 0.1, 0.3),
    n1: N(0.5, 0, 0.87),
    amp: 0.09,
    ph: 1.2,
    pair: false,
  }, true);
  makeFrond({
    parent: bo,
    at: v3(0.06, 1.06, -0.13),
    path: [v3(0, 0, 0), v3(0.07, -0.04, -0.09), v3(0.16, -0.15, -0.16), v3(0.25, -0.32, -0.19), v3(0.3, -0.5, -0.15), v3(0.3, -0.64, -0.08)],
    W: 0.1,
    lobes: 5,
    n0: N(1, 0.1, 0.15),
    n1: N(0.72, 0, 0.7),
    amp: 0.09,
    ph: 1.7,
    pair: false,
  }, true);
  // Two small leaves at the tail root
  makeFrond({
    parent: bo,
    at: v3(-0.035, 0.6, -0.15),
    path: [v3(0, 0, 0), v3(-0.01, -0.04, -0.07), v3(0.04, -0.11, -0.12), v3(0.09, -0.19, -0.13)],
    W: 0.045,
    lobes: 3,
    n0: N(-0.9, 0.1, 0.3),
    n1: N(0.5, 0, 0.85),
    amp: 0.08,
    ph: 2.6,
    pair: false,
  });
  makeFrond({
    parent: bo,
    at: v3(0.035, 0.6, -0.15),
    path: [v3(0, 0, 0), v3(0.05, -0.03, -0.06), v3(0.11, -0.1, -0.09), v3(0.15, -0.18, -0.08)],
    W: 0.045,
    lobes: 3,
    n0: N(1, 0.1, 0.1),
    n1: N(0.75, 0, 0.66),
    amp: 0.08,
    ph: 3.1,
    pair: false,
  });

  // ── Song pearl: a glowing pearl held by the tail (the stolen melody) ──
  const PEARL_C = v3(0, 0.325, 0.085);
  const pearlG = group(bo, PEARL_C.toArray() as [number, number, number]);
  const PR = 0.074;
  const pearlGeo = new THREE.SphereGeometry(PR, 28, 18);
  // Deep sea cyan at the edge, with the forward-facing center brightening to sea-foam white, like light shining out from inside
  paint(pearlGeo, (_k, p) => {
    const f = Math.max(0, p.z / PR);
    return col(0x2d9c8e).lerp(col(0x62dcc6), sstep(0.0, 0.55, f)).lerp(col(0xe4fcf6), sstep(0.7, 1, f) * 0.75);
  });
  add(pearlG, pearlGeo, M.pearl);
  {
    const hl = add(pearlG, new THREE.SphereGeometry(PR * 0.16, 8, 6), M.hi, [-PR * 0.38, PR * 0.48, PR * 0.78], [0, 0, 0], [1, 1, 0.4]);
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
  }

  // ── Back: a seaweed cord tied at the tail root, hanging a sailor's brass compass ──
  const KNOT_T = 0.5;
  const kF = frameAt(KNOT_T);
  const [ka, kb, kd] = bodyProf(KNOT_T);
  {
    const P: Vec[][] = [];
    const NR = 28;
    const NT = 8;
    const tr = 0.011;
    for (let i = 0; i < NR; i++) {
      const a = (i / NR) * PI * 2;
      const c = kF.C.clone().addScaledVector(kF.W, Math.cos(a) * (ka + 0.004)).addScaledVector(kF.H, Math.sin(a) * (kb + 0.004) + kd);
      const out = kF.W.clone().multiplyScalar(Math.cos(a) * kb).addScaledVector(kF.H, Math.sin(a) * ka).normalize();
      const row: Vec[] = [];
      for (let j = 0; j < NT; j++) {
        const b = (j / NT) * PI * 2;
        row.push(c.clone().addScaledVector(out, Math.cos(b) * tr).addScaledVector(kF.T, Math.sin(b) * tr));
      }
      P.push(row);
    }
    add(bo, gridGeo(P, true).geo, M.cord);
  }
  const knotBack = kF.C.clone().addScaledVector(kF.H, -(kb + 0.012) + kd);
  const COMPASS_C = v3(-0.045, 0.4, -0.262);
  const compass = group(bo, [knotBack.x, knotBack.y, knotBack.z]);
  const cp = COMPASS_C.clone().sub(knotBack);
  const cordEnd = cp.clone().add(v3(0, 0.07, 0));
  {
    const cordPts = [v3(0, 0.006, 0.01), v3(0, -0.02, -0.02), cordEnd.clone().multiplyScalar(0.55).add(v3(0.004, 0.0, -0.01)), cordEnd.clone()];
    const cs = sweep(cordPts, (t) => { const r = 0.0095 * Math.pow(Math.sin(PI * t), 0.15); return [r, r]; }, { segs: 16, radial: 8 });
    add(compass, gridGeo(cs.P).geo, M.cord);
  }
  const cg = group(compass, [cp.x, cp.y, cp.z]);
  cg.rotation.set(0, PI + 0.45, 0);
  // Brass casing (the back faces the body), dial, hanging ring
  add(cg, lathe([[0.001, -0.014], [0.05, -0.014], [0.058, -0.008], [0.06, 0.004], [0.056, 0.012], [0.049, 0.01], [0.047, 0.004], [0.001, 0.004]], 28).rotateX(PI / 2), M.brass);
  add(cg, new THREE.TorusGeometry(0.014, 0.0055, 8, 16), M.brass, [0, 0.066, 0], [0, PI / 2, 0]);
  add(cg, lathe([[0.001, 0.056], [0.009, 0.052], [0.01, 0.058], [0.001, 0.062]], 10), M.brass);
  const faceGeo = new THREE.RingGeometry(0.0, 0.047, 28, 4);
  paint(faceGeo, (_k, p) => {
    const rr = Math.hypot(p.x, p.y) / 0.047;
    return col(0xf0e4c6).lerp(col(0x6b4b2a), rr > 0.7 && rr < 0.8 ? 0.75 : 0);
  });
  add(cg, faceGeo, M.face, [0, 0, 0.0055]);
  const needle = group(cg, [0, 0, 0.007]);
  {
    const half = (c: THREE.ColorRepresentation, flip: number) => {
      const g = slab(outline([[-0.007, 0], [0.007, 0], [0, 0.036]]), 0.004, 0.0012, 1);
      if (flip < 0) g.rotateZ(PI);
      return tint(g, c);
    };
    add(needle, half(0xc2362e, 1), M.face);
    add(needle, half(0x2c2a33, -1), M.face);
    add(needle, tint(new THREE.CylinderGeometry(0.005, 0.005, 0.006, 10).rotateX(PI / 2), 0xc99a45), M.face);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Anchors ──
  const headC = hFrame(0.3);
  const tailF = bodyF[SEGS - 2];
  const rig = {
    head: group(hd, headC.C.toArray() as [number, number, number]),
    eyes: eyes.map((e) => e.anchor),
    anchors: {
      mouth: group(mouthG, [0, 0, 0.012]),
      pearl: group(pearlG),
      crown: group(crownG, [0, 0.06, 0]),
      compass: group(cg, [0, 0, 0.01]),
      tail: group(bo, tailF.C.toArray() as [number, number, number]),
      finL: frondTips[1] ?? group(bo),
      finR: frondTips[0] ?? group(bo),
    },
  };

  // ── Idle ──
  const act = { sing: 0, glow: 0 };
  let needleA = 0.6;
  const update = (t: number, dt: number) => {
    const { sing, glow } = act;
    const beat = Math.sin(t * 1.9);
    float.position.y = 0.12 + Math.sin(t * 0.9) * 0.022;
    body.rotation.z = Math.sin(t * 0.55) * 0.035;
    body.rotation.x = Math.sin(t * 0.7 + 0.6) * 0.025 - sing * 0.04;
    neck.rotation.x = HEAD_PITCH - sing * 0.25 + beat * 0.035;
    neck.rotation.y = HEAD_YAW + Math.sin(t * 0.43) * 0.14 * (1 - sing * 0.8);
    const look = Math.sin(t * 0.37 + 1) * 0.16;
    for (const e of eyes) e.gaze.rotation.set(-0.04 + Math.sin(t * 0.7) * 0.05, -e.sx * 0.28 + look, 0);
    for (const f of fronds) {
      f.g.rotation.x = Math.sin(t * 0.8 - f.ph) * f.amp * (1 + sing * 0.6) - sing * 0.16;
      f.g.rotation.z = Math.sin(t * 0.6 - f.ph * 1.3) * f.amp * 0.5;
    }
    dorsal.rotation.y = Math.sin(t * 13) * 0.1;
    M.pearl.emissiveIntensity = 0.32 + 0.1 * (0.5 + 0.5 * beat) + glow * 0.9 + sing * 0.3;
    M.mouth.emissiveIntensity = 0.4 + 0.25 * (0.5 + 0.5 * beat) + sing * 1.2;
    compass.rotation.z = Math.sin(t * 0.8) * 0.1;
    compass.rotation.x = Math.sin(t * 0.6 + 1.2) * 0.08;
    if (dt > 0) needleA += dt * (0.9 + Math.sin(t * 0.7) * 1.4);
    else needleA = 0.6 + t * 0.9 - Math.cos(t * 0.7) * 2;
    needle.rotation.z = needleA;
  };
  update(0, 0);

  mergeStatic(root, {
    owners: [float, body, neck, dorsal, pearlG, compass, needle, ...fronds.map((f) => f.g), ...eyes.map((e) => e.gaze)],
    rig,
  });
  return { root, update, act, rig, center: new THREE.Vector3(0, 0.98, 0), radius: 0.95 };
}
