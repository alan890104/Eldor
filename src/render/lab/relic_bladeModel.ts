// Relic Blade (model lab version): the sword of the first commander of the Order of the Silver Oath, which awakened after its master fell in battle, having absorbed a thousand years of sword intent. It does not speak, but practices swordplay alone on moonlit nights.
// Neutral, SR, swordsman / counter (trait [Sword Intent]: after a successful block, the next skill is a guaranteed critical hit).
// Only one form (decided by the user, 2026-09-28): the builder ignores the breakthrough stage, and the game scales this one shape up by its per-rarity height table.
//
// Identifying features (from the name, the lore and the counter-attack playstyle):
//   1. A long sword hanging in midair with the point down is all of it: a steel blade with a rhombic cross-section and a fuller, two nicks in each edge left a thousand years ago,
//      a silver crescent (the Order's crest) set into the platform at the blade root, and a row of silver-inlaid oath text in the fuller.
//   2. An old-silver crossguard: a shield-shaped guard boss in the middle tapering to a point downward (a raised crescent on each of the front and back), with the two guard arms drooping slightly toward the sword point,
//      ending in faceted silver balls. The old silver has mottled oxidation, easy to tell apart at a glance from the cold, polished steel.
//   3. A leather-cord-wrapped grip: dark brown cord wound diagonally ring after ring, with dark grooves pressed in between the cords, and a silver band at the top and bottom.
//   4. The pommel is an eight-faceted old silver knob, topped with a moonlight-blue gem: the only glowing place on the whole body, slowly flickering like breathing.
//   5. The master's cape: a faded deep red cape draped over the right (+x) guard arm, a short piece in front and a long piece hanging behind, slanting to cover the area behind the blade and wrapping around to the right,
//      the hem torn into strips; on the outside of the rear piece, the Order's emblem is embroidered in silver thread (a crescent inside a shield-shaped frame).
// Body shape: an object. No facial features, and not made into a person holding a sword. The point hangs a short way off the ground, straight like standing at attention, tilting only slightly toward the cape side (the weight of the cloth).
// From the side the volume is propped up by the thickness of the guard boss, the pommel and the front and rear pieces of the cape, while the blade itself is only a single edge from the side.
// Personality: the sword of an old knight, silent and disciplined, keeping its dead master's oath. It does not speak and does not move much, and its emotion is expressed only through posture, turning and the flicker of the gem.
// Gaze order: the hilt area (the crescent on the shield-shaped guard boss, the moonlight-blue gem) first, the nicked blade second, and the cape as support.
// Back speaks of its origin: the master's cape covers the upper half of the sword, the silver-embroidered Order emblem faces squarely out the back, and the point shows under the torn strips of the hem.
//
// <Action table> (act weights, 0-1; all 0 is idle)
//   Idle: hangs floating and slowly bobs up and down; once every nine seconds it practices an opening stance: slowly turning to point the edge forward and swinging the point slanting to one side into a stance, holding for two seconds and then returning to attention,
//         alternating between left and right; the gem flickers with its breathing and is slightly brighter in the stance; the cape sways half a beat behind the turning.
//   Move: glides along keeping at attention (the outer shell handles the displacement).
//   Charge-up (charge): the whole sword lifts up and the point draws back (the hilt tilts forward), the gem turns brighter and the cape flies back.
//   Strike (strike): the point thrusts forward and the whole sword is sent forward.
//   Hit: does not retreat and does not sway, and nothing is done beyond the outer shell's white flash.
//   Victory: returns to attention (focus) and the gem flashes once (glow), with no cheering.
//   focus: stops practicing and stands at attention facing straight ahead. glow: the gem glows.
// Anchors: head (middle of the grip, the sword's "face"), eyes is empty (an object has no eyes), mouth and tip (the sword point, where attack effects go out from),
//       gem (pommel gem), guard (the crescent on the front of the guard boss), edge (the edge at the middle of the blade), cape (the emblem on the back of the cape).
// Face count: SR budget 45,000 faces, 60 meshes. Static parts are merged at the end with mergeStatic; the cape updates its vertices on the CPU every frame and is not merged.

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { brilliant, curveTable, lathe, loft, mergeStatic, outline, partKit, PI, slab, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const lerp = THREE.MathUtils.lerp;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);

// ───────────────────────── Dimensions (lab units, ground at y = 0) ─────────────────────────

/** Height of the sword point above the ground */
const TIP_Y = 0.15;
/** Center height of the guard arms, which is also the pivot for the whole sword's rotation (the sword's center of gravity is near the guard) */
const GUARD_Y = 1.25;
/** The top end of the blade is hidden inside the guard boss */
const BLADE_TOP = GUARD_Y + 0.01;
const BLADE_LEN = BLADE_TOP - TIP_Y;
/** The top and bottom ends of the grip (the bottom end is the top face of the guard boss) */
const GRIP_Y0 = GUARD_Y + 0.034;
const GRIP_Y1 = 1.52;

// ───────────────────────── Blade ─────────────────────────

/** Edge nick: s is the proportional position from the blade root toward the point, side 1 is the right edge (+x), d the depth, a0 the width on the blade-root side and a1 the width on the point side */
interface Notch {
  s: number;
  side: 1 | -1;
  d: number;
  a0: number;
  a1: number;
}
const NOTCHES: Notch[] = [
  { s: 0.3, side: 1, d: 0.024, a0: 0.012, a1: 0.022 },
  { s: 0.58, side: 1, d: 0.013, a0: 0.008, a1: 0.014 },
  { s: 0.43, side: -1, d: 0.02, a0: 0.011, a1: 0.019 },
  { s: 0.74, side: -1, d: 0.011, a0: 0.007, a1: 0.012 },
];
/** Where the point starts to taper */
const TIP_S = 0.8;
const FULLER_MAX = 0.0085;

/** Half width: slowly tapering from 0.085 at the blade root to 0.066, with the last 20% closing into a slightly bulging point */
const bladeW = (s: number) => {
  if (s <= TIP_S) return lerp(0.085, 0.066, s / TIP_S);
  const u = (s - TIP_S) / (1 - TIP_S);
  return 0.066 * (1 - u) * (1 + 0.55 * u);
};
/** Half thickness */
const bladeT = (s: number) => {
  if (s <= TIP_S) return lerp(0.021, 0.016, s / TIP_S);
  const u = (s - TIP_S) / (1 - TIP_S);
  return 0.016 * (1 - u) * (1 + 0.3 * u);
};
/** Fuller depth: starting a short way below the blade root and fading out after the halfway point */
const fullerD = (s: number) => FULLER_MAX * ease((s - 0.15) / 0.04) * (1 - ease((s - 0.5) / 0.13));
/** How much of this side's edge is eaten away by nicks at s */
const notchAt = (s: number, side: 1 | -1) => {
  let n = 0;
  for (const q of NOTCHES) {
    if (q.side !== side) continue;
    const ds = s - q.s;
    const k = ds < 0 ? 1 + ds / q.a0 : 1 - ds / q.a1;
    n = Math.max(n, q.d * Math.max(0, k));
  }
  return n;
};
const bladeY = (s: number) => BLADE_TOP - s * BLADE_LEN;

/**
 * Blade: rows of cross-sections along the blade's length (a rhombus plus the fuller, 14 points), with each cross-section edge making its own band for each segment, sharing no vertices,
 * so the edge bevels, flats and fuller are hard ridges while the direction along the blade is smooth. Vertex colors are of three kinds of steel: polished edge, flat, and the fuller one step darker; darker still inside the nicks.
 */
function bladeGeo(): THREE.BufferGeometry {
  const S = new Set<number>();
  for (let i = 0; i <= 56; i++) S.add(i / 56);
  // Sample points are placed on the features: both shoulders and the bottom of each nick, the start and end of the fuller, the start of the taper (reference.md pitfalls 81, 82)
  for (const q of NOTCHES) for (const s of [q.s - q.a0 - 0.005, q.s - q.a0, q.s - q.a0 / 2, q.s, q.s + q.a1 / 2, q.s + q.a1, q.s + q.a1 + 0.005]) S.add(s);
  for (const s of [0.15, 0.17, 0.19, 0.5, 0.56, 0.63, TIP_S, 0.9, 0.95, 0.975, 0.99]) S.add(s);
  const rows = [...S].filter((s) => s >= 0 && s <= 1).sort((a, b) => a - b).filter((s, i, a) => i === 0 || s - a[i - 1] > 4e-4);

  const EDGE = col(0xeef3f7);
  const FLAT = col(0xa3b1bf);
  const GROOVE = col(0x7d8b9b);
  const NICK = col(0x6c7784);
  // Band k runs from cross-section point k to k+1: 0 right edge bevel, 1 flat, 2-4 fuller, 5 flat, 6 left edge bevel, and 7-13 are the back side reversed
  const kind = [0, 1, 2, 2, 2, 1, 0, 0, 1, 2, 2, 2, 1, 0];
  const prof = (s: number): [number, number][] => {
    const w = bladeW(s);
    const t = bladeT(s);
    const d = fullerD(s);
    const eR = w - notchAt(s, 1);
    const eL = w - notchAt(s, -1);
    const rb = 0.42 * w;
    const fs = 0.26 * w;
    const ff = 0.13 * w;
    return [[eR, 0], [rb, t], [fs, t], [ff, t - d], [-ff, t - d], [-fs, t], [-rb, t], [-eL, 0], [-rb, -t], [-fs, -t], [-ff, -(t - d)], [ff, -(t - d)], [fs, -t], [rb, -t]];
  };
  const P = rows.map(prof);
  const pos: number[] = [];
  const cl: number[] = [];
  const idx: number[] = [];
  const n = 14;
  const c = new THREE.Color();
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n;
    const base = pos.length / 3;
    rows.forEach((s, r) => {
      const y = bladeY(s);
      const groove = fullerD(s) / FULLER_MAX;
      for (const [j, pj] of [[k, P[r][k]], [k2, P[r][k2]]] as [number, [number, number]][]) {
        pos.push(pj[0], y, pj[1]);
        if (kind[k] === 0) {
          // Edge bevel: the point at the edge tip darkens inside a nick
          const edgePt = j === 0 || j === 7;
          const nk = edgePt ? notchAt(s, j === 0 ? 1 : -1) / 0.02 : 0;
          c.copy(EDGE).lerp(FLAT, edgePt ? 0 : 0.35).lerp(NICK, clamp01(nk));
        } else if (kind[k] === 1) c.copy(FLAT);
        else c.copy(FLAT).lerp(GROOVE, groove);
        cl.push(c.r, c.g, c.b);
      }
    });
    for (let r = 0; r < rows.length - 1; r++) {
      const a = base + r * 2;
      const b = a + 1;
      const cc = a + 2;
      const d = a + 3;
      idx.push(a, b, cc, b, d, cc);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ───────────────────────── Small parts ─────────────────────────

/** Crescent: inside the outer circle (0,0,R) and outside the inner circle (0,d,r), with the opening facing up */
function crescentShape(R: number, d: number, r: number, seg = 14): THREE.Shape {
  const yI = (R * R - r * r + d * d) / (2 * d);
  const xI = Math.sqrt(R * R - yI * yI);
  // Both arcs must pass directly below (3π/2): the outer arc counts from the left tip up to the right tip, and the inner arc counts back from the right tip to the left tip.
  // The result of atan2 falls in ±π, so add 2π to negatives first, otherwise the inner arc would go around one and a half times and the whole crescent would turn into a round buckle
  const wrap = (a: number) => (a < 0 ? a + PI * 2 : a);
  const aL = wrap(Math.atan2(yI, -xI));
  const aR = Math.atan2(yI, xI) + PI * 2;
  const bR = Math.atan2(yI - d, xI) + PI * 2;
  const bL = wrap(Math.atan2(yI - d, -xI));
  const pts: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const a = lerp(aL, aR, i / seg);
    pts.push([Math.cos(a) * R, Math.sin(a) * R]);
  }
  for (let i = 1; i < seg; i++) {
    const b = lerp(bR, bL, i / seg);
    pts.push([Math.cos(b) * r, d + Math.sin(b) * r]);
  }
  return outline(pts);
}

/** Extruded beveled plate, with the material groups removed */
function plate(shape: THREE.Shape, depth: number, bevel: number, curve = 8): THREE.BufferGeometry {
  const g = slab(shape, depth, bevel, curve);
  g.clearGroups();
  g.deleteAttribute('uv');
  return g;
}

/** Faceting a lathe body: no shared vertices, with each face having its own normal (the eight-faceted pommel, the silver balls at the guard ends) */
function facetLathe(profile: [number, number][], seg: number): THREE.BufferGeometry {
  const g = lathe(profile, seg).toNonIndexed();
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/**
 * Leather-cord-wrapped grip: a single diagonally wound leather cord, with the mesh laid out along the spiral (PER rows per turn), the cord's cross-section a round arch and the space between cords a V groove.
 * The parts beyond the top and bottom ends are flattened into the silver bands. Normals use numerical differentiation, consistent on both sides of the seam.
 */
function gripGeo(): THREE.BufferGeometry {
  const PITCH = 0.0118;
  const R0 = 0.0275;
  const BUMP = 0.0062;
  const COLS = 18;
  const PER = 6;
  const ya = GRIP_Y0 + 0.014;
  const yb = GRIP_Y1 - 0.014;
  const turns = Math.ceil((yb - ya) / PITCH) + 2;
  const LIGHT = col(0x6e4a31);
  const DARK = col(0x2b1a10);
  const swell = (y: number) => 1 + 0.07 * Math.sin(clamp01((y - GRIP_Y0) / (GRIP_Y1 - GRIP_Y0)) * PI);
  const F = (a: number, th: number, out: THREE.Vector3) => {
    const yRaw = ya - PITCH + (a + th / (PI * 2)) * PITCH;
    const y = Math.min(GRIP_Y1 - 0.004, Math.max(GRIP_Y0 + 0.004, yRaw));
    const f = a - Math.floor(a);
    const b = Math.pow(Math.max(0, Math.sin(f * PI)), 0.6);
    const r = R0 * swell(y) + BUMP * b;
    return out.set(Math.cos(th) * r, y, -Math.sin(th) * r);
  };
  const rowsN = turns * PER + 1;
  const pos: number[] = [];
  const nor: number[] = [];
  const cl: number[] = [];
  const p = new THREE.Vector3();
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  const qa = new THREE.Vector3();
  const qb = new THREE.Vector3();
  const nn = new THREE.Vector3();
  const e = 1e-3;
  const c = new THREE.Color();
  for (let i = 0; i < rowsN; i++) {
    const a = i / PER;
    for (let j = 0; j <= COLS; j++) {
      const th = (j / COLS) * PI * 2;
      F(a, th, p);
      pos.push(p.x, p.y, p.z);
      F(a + e, th, pa);
      F(a - e, th, pb);
      F(a, th + e, qa);
      F(a, th - e, qb);
      nn.crossVectors(qa.sub(qb), pa.sub(pb));
      if (nn.lengthSq() < 1e-14) nn.set(p.x, 0, p.z);
      else if (nn.dot(v3(p.x, 0, p.z)) < 0) nn.negate();
      nn.normalize();
      nor.push(nn.x, nn.y, nn.z);
      const f = a - Math.floor(a);
      c.copy(DARK).lerp(LIGHT, Math.pow(Math.max(0, Math.sin(f * PI)), 0.8));
      cl.push(c.r, c.g, c.b);
    }
  }
  const idx: number[] = [];
  const W = COLS + 1;
  for (let i = 0; i < rowsN - 1; i++)
    for (let j = 0; j < COLS; j++) {
      const a = i * W + j;
      const b = a + 1;
      const cc = a + W;
      const d = cc + 1;
      idx.push(a, b, cc, b, d, cc);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(idx);
  // Winding: θ turns toward -z and a goes up, and (b-a)×(c-a) must face outward; if not, flip the whole sheet
  const P0 = v3(pos[0], pos[1], pos[2]);
  const P1 = v3(pos[3], pos[4], pos[5]);
  const P2 = v3(pos[W * 3], pos[W * 3 + 1], pos[W * 3 + 2]);
  const fn = P1.clone().sub(P0).cross(P2.clone().sub(P0));
  if (fn.dot(v3(P0.x, 0, P0.z)) < 0) {
    const ix = g.index!.array as Uint32Array | Uint16Array;
    for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
  }
  return g;
}

// ───────────────────────── Cape ─────────────────────────

/** Embroidery on the outside of the cape: the geometry carries a pat attribute (xy is the rest position minus the emblem center, drawn only when z is 1), painted per pixel after the base color, with fwidth antialiasing */
const EMBLEM_GLSL = /* glsl */ `
if (vPat.z > 0.5) {
  vec2 p = vPat.xy;
  // Order emblem: a silver-line shield outline (square upper half, lower half closing to a point with two circular arcs), with a crescent moon opening upward inside the shield.
  // Tried "a crescent cradling an upright sword": the blade plus crossguard plus the arc below read as an anchor however it was arranged, so no sword goes in the shield
  // Shield distance: y ≥ 0 uses the straight sides, y < 0 uses two circular arcs (they are exactly equal at y = 0, so no extra seam appears in the middle), then the top edge is cut off
  float w = 0.085;
  float ln = max(length(p - vec2(-w, 0.0)) - 2.0 * w, length(p - vec2(w, 0.0)) - 2.0 * w);
  float sh = max(p.y >= 0.0 ? abs(p.x) - w : ln, p.y - 0.12);
  // The crescent is tilted 40 degrees: an opening straight up would look like a smiling mouth
  float cres = max(length(p - vec2(-0.004, -0.012)) - 0.055, -(length(p - vec2(0.0114, 0.0064)) - 0.047));
  vec3 base = diffuseColor.rgb;
  vec3 thread = vec3(0.86, 0.83, 0.76);
  float fs = max(fwidth(sh), 1e-4);
  float fc = max(fwidth(cres), 1e-4);
  vec3 c = base;
  c = mix(c, base * 0.8, 1.0 - smoothstep(-fs, fs, sh));
  c = mix(c, base * 0.42, 1.0 - smoothstep(-fs, fs, abs(sh + 0.009) - 0.011));
  c = mix(c, thread, 1.0 - smoothstep(-fs, fs, abs(sh + 0.009) - 0.0065));
  c = mix(c, base * 0.42, 1.0 - smoothstep(-fc, fc, cres - 0.005));
  c = mix(c, thread, 1.0 - smoothstep(-fc, fc, cres));
  diffuseColor.rgb = c;
}
`;

function patchEmblem(mat: THREE.Material): void {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 pat;\nvarying vec3 vPat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPat = pat;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPat;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + EMBLEM_GLSL);
  };
  mat.customProgramCacheKey = () => 'relic-blade-cape-emblem';
}

interface Cape {
  mesh: THREE.Mesh;
  /** down: the true downward direction in the sword's own coordinates (when the sword tilts, the hanging cloth still falls downward); sx, sz: the swing of the hem */
  update(t: number, down: THREE.Vector3, sx: number, sz: number): void;
  emblem: THREE.Vector3;
}

/**
 * The cape draped over the right guard arm: a piece of cloth with thickness (front and back faces plus side walls all around).
 * Column u runs along the arm (XA → XB), and rows run from the front piece's hem upward, over the top of the arm, and down the rear piece to its hem.
 * The rear piece gets wider the farther down it hangs, with its inner side slanting to cover the area behind the blade; the front and rear hems each have several V-shaped tears. The vertices and normals are updated on the CPU every frame.
 */
function buildCape(mat: THREE.Material, barY: (x: number) => number, barR: (x: number) => number): Cape {
  const XA = 0.098;
  const XB = 0.235;
  const H = 0.006;
  const EMB = v3(0.12, GUARD_Y - 0.29, 0);
  // Horizontal arc of the rear piece's hem: center (HX, HZ), radii HRX, HRZ, angle ψ = 0 directly behind and π/2 on the right (+x), running from behind the blade all the way around to the front right
  const HX = 0.11;
  const HZ = -0.01;
  const HRX = 0.2;
  const HRZ = 0.18;
  const PSI_A = -0.95;
  const PSI_B = 1.85;
  const cutsB: [number, number, number][] = [[0.12, 0.14, 0.045], [0.3, 0.24, 0.05], [0.47, 0.1, 0.04], [0.66, 0.2, 0.05], [0.86, 0.13, 0.04]];
  const cutsF: [number, number, number][] = [[0.55, 0.2, 0.12]];
  const tear = (u: number, cuts: [number, number, number][]) => {
    let m = 0;
    for (const [c, d, w] of cuts) m = Math.max(m, d * Math.max(0, 1 - Math.abs(u - c) / w));
    return m;
  };
  const jit = (u: number) => 0.02 * Math.sin(u * 91.7) * Math.sin(u * 37.3 + 1.1);
  const lenB = (u: number) => lerp(0.74, 0.56, u) * (1 - tear(u, cutsB) + jit(u));
  const lenF = (u: number) => lerp(0.18, 0.25, u) * (1 - tear(u, cutsF) + jit(u + 0.37));
  const uSet = new Set<number>();
  for (let i = 0; i <= 34; i++) uSet.add(i / 34);
  for (const [c, , w] of [...cutsB, ...cutsF]) for (const u of [c - w, c, c + w]) uSet.add(u);
  const U = [...uSet].filter((u) => u >= 0 && u <= 1).sort((a, b) => a - b).filter((u, i, a) => i === 0 || u - a[i - 1] > 4e-3);

  // Rows: part 0 the front piece (k from the hem at 1 up to 0), 1 over the arm (k is the angle π/2 → -π/2), 2 the rear piece (k from 0 down to the hem at 1)
  const rows: { part: 0 | 1 | 2; k: number }[] = [];
  const NF = 6;
  const NA = 7;
  const NB = 20;
  for (let i = 0; i <= NF; i++) rows.push({ part: 0, k: 1 - i / NF });
  for (let i = 1; i <= NA; i++) rows.push({ part: 1, k: PI / 2 - (PI * i) / (NA + 1) });
  for (let i = 0; i <= NB; i++) rows.push({ part: 2, k: Math.pow(i / NB, 1.15) });

  const C = U.length;
  const R = rows.length;
  const G = C * R;
  const rest: THREE.Vector3[] = [];
  const Lf: number[] = [];
  const Lb: number[] = [];
  for (let i = 0; i < C; i++) {
    const u = U[i];
    const x0 = lerp(XA, XB, u);
    const yb = barY(x0);
    const Rw = barR(x0) + H + 0.0025;
    Lf.push(lenF(u));
    Lb.push(lenB(u));
    for (const { part, k } of rows) {
      let x = x0;
      let y: number;
      let z: number;
      if (part === 0) {
        y = yb - k * Lf[i];
        // The front piece is an edge from the side: z does not rise and fall with u, so the tears do not look like rows of fingers from the side
        z = Rw + 0.04 * k * k;
        x = x0 + (u - 0.5) * 0.03 * k;
      } else if (part === 1) {
        y = yb + Rw * Math.cos(k);
        z = Rw * Math.sin(k);
      } else {
        const e = 1 - (1 - k) * (1 - k);
        const psi = lerp(PSI_A, PSI_B, u);
        const fold = 0.024 * k * Math.sin(u * PI * 6 + 0.6);
        y = yb - k * Lb[i];
        x = lerp(x0, HX + HRX * Math.sin(psi), e) + Math.sin(psi) * fold * e;
        z = lerp(-Rw, HZ - HRZ * Math.cos(psi), e) - Math.cos(psi) * fold * e;
      }
      rest.push(v3(x, y, z));
    }
  }

  // Vertices: G on the outside, G on the inside, plus the side walls all around (one outer and one inner for each boundary point)
  const walls: { g: number; out: boolean; kind: 0 | 1 | 2 | 3 }[] = [];
  const wallRuns: number[][] = [];
  const run = (list: number[], kind: 0 | 1 | 2 | 3) => {
    const start = walls.length;
    for (const g of list) {
      walls.push({ g, out: true, kind });
      walls.push({ g, out: false, kind });
    }
    const ids: number[] = [];
    for (let j = 0; j < list.length; j++) ids.push(start + j * 2);
    wallRuns.push(ids);
  };
  run([...Array(R).keys()].map((r) => 0 * R + r), 0);
  run([...Array(R).keys()].map((r) => (C - 1) * R + r), 1);
  run([...Array(C).keys()].map((i) => i * R + 0), 2);
  run([...Array(C).keys()].map((i) => i * R + R - 1), 3);
  const NV = G * 2 + walls.length;
  const pos = new Float32Array(NV * 3);
  const nor = new Float32Array(NV * 3);
  const colA = new Float32Array(NV * 3);
  const patA = new Float32Array(NV * 3);

  const RED = col(0x9a303c);
  const RED_D = col(0x76222e);
  const LINING = col(0x742a36);
  const RIMC = col(0x80303a);
  for (let i = 0; i < C; i++)
    for (let r = 0; r < R; r++) {
      const g = i * R + r;
      const { part, k } = rows[r];
      const c = part === 2 ? RED.clone().lerp(RED_D, k * 0.8) : RED;
      c.toArray(colA, g * 3);
      LINING.toArray(colA, (G + g) * 3);
      if (part !== 0) {
        patA[g * 3] = rest[g].x - EMB.x;
        patA[g * 3 + 1] = rest[g].y - EMB.y;
        patA[g * 3 + 2] = 1;
      }
    }
  walls.forEach((_, w) => RIMC.toArray(colA, (G * 2 + w) * 3));

  // Each frame's midsurface, normals and two tangents
  const mid: THREE.Vector3[] = rest.map((p) => p.clone());
  const N: THREE.Vector3[] = rest.map(() => new THREE.Vector3());
  const DU: THREE.Vector3[] = rest.map(() => new THREE.Vector3());
  const DS: THREE.Vector3[] = rest.map(() => new THREE.Vector3());
  const dn = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const solve = () => {
    for (let i = 0; i < C; i++)
      for (let r = 0; r < R; r++) {
        const g = i * R + r;
        const i0 = Math.max(0, i - 1);
        const i1 = Math.min(C - 1, i + 1);
        const r0 = Math.max(0, r - 1);
        const r1 = Math.min(R - 1, r + 1);
        DU[g].subVectors(mid[i1 * R + r], mid[i0 * R + r]).normalize();
        DS[g].subVectors(mid[i * R + r1], mid[i * R + r0]).normalize();
        N[g].crossVectors(DU[g], DS[g]).normalize();
      }
    for (let g = 0; g < G; g++) {
      const p = mid[g];
      const n = N[g];
      pos[g * 3] = p.x + n.x * H;
      pos[g * 3 + 1] = p.y + n.y * H;
      pos[g * 3 + 2] = p.z + n.z * H;
      nor[g * 3] = n.x;
      nor[g * 3 + 1] = n.y;
      nor[g * 3 + 2] = n.z;
      const q = (G + g) * 3;
      pos[q] = p.x - n.x * H;
      pos[q + 1] = p.y - n.y * H;
      pos[q + 2] = p.z - n.z * H;
      nor[q] = -n.x;
      nor[q + 1] = -n.y;
      nor[q + 2] = -n.z;
    }
    walls.forEach(({ g, out, kind }, w) => {
      const p = mid[g];
      const n = N[g];
      const s = out ? H : -H;
      const q = (G * 2 + w) * 3;
      pos[q] = p.x + n.x * s;
      pos[q + 1] = p.y + n.y * s;
      pos[q + 2] = p.z + n.z * s;
      // Side walls face outward: inner edge -u, outer edge +u, front piece hem -σ (down), rear piece hem +σ (down)
      tmp.copy(kind < 2 ? DU[g] : DS[g]).multiplyScalar(kind === 0 || kind === 2 ? -1 : 1);
      tmp.addScaledVector(n, -tmp.dot(n)).normalize();
      nor[q] = tmp.x;
      nor[q + 1] = tmp.y;
      nor[q + 2] = tmp.z;
    });
  };
  solve();

  // Triangles: winding is decided by the rest pose's normals (outside facing N, inside facing -N, side walls facing the side wall's normal)
  const idx: number[] = [];
  const P = (v: number) => v3(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
  const want = (v: number) => v3(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]);
  const tri = (a: number, b: number, c: number) => {
    const pa = P(a);
    const fn = P(b).sub(pa).cross(P(c).sub(pa));
    if (fn.dot(want(a).add(want(b)).add(want(c))) >= 0) idx.push(a, b, c);
    else idx.push(a, c, b);
  };
  for (const off of [0, G])
    for (let i = 0; i < C - 1; i++)
      for (let r = 0; r < R - 1; r++) {
        const a = off + i * R + r;
        const b = off + (i + 1) * R + r;
        const c = a + 1;
        const d = b + 1;
        tri(a, b, c);
        tri(b, d, c);
      }
  for (const ids of wallRuns)
    for (let j = 0; j < ids.length - 1; j++) {
      const o0 = G * 2 + ids[j];
      const o1 = G * 2 + ids[j + 1];
      tri(o0, o1, o1 + 1);
      tri(o0, o1 + 1, o0 + 1);
    }

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  const norAttr = new THREE.BufferAttribute(nor, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  norAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('normal', norAttr);
  geo.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  geo.setAttribute('pat', new THREE.BufferAttribute(patA, 3));
  geo.setIndex(idx);
  geo.computeBoundingBox();
  geo.boundingBox!.expandByScalar(0.12);
  geo.computeBoundingSphere();
  geo.boundingSphere!.radius += 0.12;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;

  const update = (t: number, down: THREE.Vector3, sx: number, sz: number) => {
    dn.set(down.x, down.y + 1, down.z);
    for (let i = 0; i < C; i++) {
      const u = U[i];
      for (let r = 0; r < R; r++) {
        const g = i * R + r;
        const { part, k } = rows[r];
        const m = mid[g].copy(rest[g]);
        if (part === 1) continue;
        const L = part === 0 ? Lf[i] : Lb[i];
        const s = part === 0 ? 0.35 : 1;
        const w = k * k;
        // The hanging part swings toward the true downward direction (the cloth does not tilt along when the sword tilts), more noticeably nearer the hem
        m.addScaledVector(dn, k * L * k);
        m.x += sx * w * s;
        m.z += (sz + 0.01 * Math.sin(u * PI * 5 + t * 0.9)) * w * s;
      }
    }
    solve();
    posAttr.needsUpdate = true;
    norAttr.needsUpdate = true;
  };
  return { mesh, update, emblem: EMB };
}

// ───────────────────────── Shape ─────────────────────────

export function buildRelicBladeLab(): LabModel {
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const MOON = 0xd4e6ff;
  const M = {
    steel: vc(labToon(0xffffff, { ramp: 'metal', spec: 1.25, specTh: 0.94, rim: 0.55, rimColor: MOON, speckle: 0.1 })),
    silver: labToon(0xc6c0b3, { ramp: 'metal', spec: 0.85, specTh: 0.95, rim: 0.5, rimColor: 0xfff0d8, speckle: 0.5 }),
    leather: vc(labToon(0xffffff, { rim: 0.3, rimColor: 0xffd8b8 })),
    gem: labToon(0x86ccff, { ramp: 'gem', emissive: 0x3a98ff, emissiveAmt: 0.6, spec: 1.2, specTh: 0.9, rim: 0.3, rimColor: MOON }),
    cape: vc(labToon(0xffffff, { rim: 0.35, rimColor: 0xffc8c0 })),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;
  patchEmblem(M.cape);

  const root = new THREE.Group();
  root.name = 'relic_blade-lab';
  const { add, group } = partKit();
  const place = group(root);
  const hover = group(place);
  // The pivot is at the guard: the sword turns, and the parts inside S are all placed in absolute coordinates at rest
  const sword = group(hover, [0, GUARD_Y, 0]);
  sword.rotation.order = 'YXZ';
  const S = group(sword, [0, -GUARD_Y, 0]);

  // ── Blade ──
  add(S, bladeGeo(), M.steel);
  // The silver crescent set into the platform at the blade root (on both the front and back) and a row of rhombus-shaped oath text in the fuller
  {
    const s = (BLADE_TOP - 1.13) / BLADE_LEN;
    const t = bladeT(s);
    const g = plate(crescentShape(0.024, 0.016, 0.027), 0.003, 0.001);
    add(S, g, M.silver, [0, 1.13, t + 0.0005], [0, 0, -0.6]);
    add(S, g, M.silver, [0, 1.13, -t - 0.0005], [0, PI, -0.6]);
    const lz = plate(outline([[0, 0.011], [0.0068, 0], [0, -0.011], [-0.0068, 0]]), 0.003, 0.001, 2);
    for (const y of [1.03, 0.975, 0.92, 0.865]) {
      const ss = (BLADE_TOP - y) / BLADE_LEN;
      const z = bladeT(ss) - fullerD(ss) + 0.0008;
      add(S, lz, M.silver, [0, y, z]);
      add(S, lz, M.silver, [0, y, -z], [0, PI, 0]);
    }
  }

  // ── Crossguard: a shield-shaped guard boss (tapering to a point downward to cover the blade root), crescents on the front and back, two drooping guard arms, and faceted silver balls at the ends ──
  const ecu = plate(outline([[-0.072, 0.034], [0.072, 0.034], [0.08, 0.022], [0.08, -0.012], [0.032, -0.05], [0, -0.075], [-0.032, -0.05], [-0.08, -0.012], [-0.08, 0.022]]), 0.06, 0.008);
  add(S, ecu, M.silver, [0, GUARD_Y, 0]);
  const ecuMoon = plate(crescentShape(0.03, 0.02, 0.034), 0.006, 0.0016);
  // The crescent is tilted by 0.6 radians: a crescent with its opening straight up, placed at the exact center of the shield-shaped guard boss, would be read as a smiling mouth
  add(S, ecuMoon, M.silver, [0, GUARD_Y - 0.006, 0.0395], [0, 0, -0.6]);
  add(S, ecuMoon, M.silver, [0, GUARD_Y - 0.006, -0.0395], [0, PI, -0.6]);
  const QP: [number, number][] = [[0.05, 0], [0.13, -0.003], [0.2, -0.012], [0.255, -0.028], [0.288, -0.05]];
  const qRad = curveTable([[0, 0.021], [0.35, 0.021], [0.8, 0.0165], [1, 0.014]]);
  const barY = (x: number) => {
    const ax = Math.abs(x);
    if (ax <= QP[0][0]) return GUARD_Y;
    for (let i = 0; i < QP.length - 1; i++)
      if (ax <= QP[i + 1][0]) return GUARD_Y + lerp(QP[i][1], QP[i + 1][1], (ax - QP[i][0]) / (QP[i + 1][0] - QP[i][0]));
    return GUARD_Y + QP[QP.length - 1][1];
  };
  const barR = (x: number) => qRad(clamp01((Math.abs(x) - 0.05) / 0.245))[0];
  const knob = facetLathe([[0.001, -0.012], [0.015, -0.009], [0.022, 0.0], [0.025, 0.012], [0.022, 0.024], [0.014, 0.033], [0.001, 0.037]], 8);
  for (const sx of [-1, 1]) {
    const pts = QP.map(([x, y]) => v3(sx * x, GUARD_Y + y, 0));
    add(S, loft(pts, (t) => [qRad(t)[0], qRad(t)[0]], { segs: 18, radial: 10, side: v3(0, 0, 1) }), M.silver);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const tan = curve.getTangentAt(1);
    const end = pts[pts.length - 1];
    const k = add(S, knob, M.silver, [end.x, end.y, end.z]);
    k.quaternion.setFromUnitVectors(v3(0, 1, 0), tan);
  }

  // ── Grip: a leather-cord-wrapped handle, with a silver band at the top and bottom ──
  add(S, gripGeo(), M.leather);
  const ferrule = lathe([[0.03, 0], [0.037, 0.002], [0.0405, 0.007], [0.0405, 0.019], [0.037, 0.024], [0.03, 0.026]], 16);
  ferrule.deleteAttribute('uv');
  add(S, ferrule, M.silver, [0, GRIP_Y0 - 0.002, 0]);
  add(S, ferrule, M.silver, [0, GRIP_Y1 - 0.024, 0]);

  // ── Pommel: an eight-faceted old silver knob, with a gem seat on top and a moonlight-blue gem ──
  const pom = facetLathe([[0.001, 0], [0.03, 0], [0.036, 0.008], [0.052, 0.026], [0.058, 0.042], [0.052, 0.058], [0.04, 0.068], [0.03, 0.072], [0.001, 0.074]], 8);
  add(S, pom, M.silver, [0, GRIP_Y1, 0], [0, PI / 8, 0]);
  const bezel = lathe([[0.001, 0], [0.03, 0], [0.039, 0.005], [0.04, 0.013], [0.035, 0.02], [0.03, 0.019], [0.001, 0.013]], 16);
  bezel.deleteAttribute('uv');
  const GEM_Y = GRIP_Y1 + 0.07;
  add(S, bezel, M.silver, [0, GEM_Y, 0]);
  const gem = add(S, brilliant(0.034, 0.042, 0.022, 8), M.gem, [0, GEM_Y + 0.018, 0], [0, PI / 8, 0]);

  // ── Cape ──
  const cape = buildCape(M.cape, barY, barR);
  cape.mesh.castShadow = true;
  cape.mesh.layers.enable(INK_LAYER);
  S.add(cape.mesh);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Anchors ──
  const head = group(S, [0, (GRIP_Y0 + GRIP_Y1) / 2, 0]);
  const tip = group(S, [0, TIP_Y, 0]);
  const gemA = group(S, [0, GEM_Y + 0.035, 0]);
  const guardA = group(S, [0, GUARD_Y - 0.01, 0.046]);
  const edge = group(S, [0.075, bladeY(0.45), 0]);
  const capeA = group(S, [cape.emblem.x, cape.emblem.y, -0.15]);
  const rig = { head, eyes: [] as THREE.Object3D[], anchors: { mouth: tip, tip, gem: gemA, guard: guardA, edge, cape: capeA } };

  // ── Idle and actions ──
  const act = { focus: 0, charge: 0, strike: 0, glow: 0 };
  const CYC = 9;
  /** Weight of the opening stance: once every nine seconds, starting to turn at 2.4 seconds, holding the stance for two seconds and starting to return at 6 seconds; alternating left and right */
  const drill = (t: number) => {
    const n = Math.floor(t / CYC);
    const p = t - n * CYC;
    return { k: ease((p - 2.4) / 1.8) - ease((p - 6.0) / 1.8), dir: n % 2 === 0 ? 1 : -1 };
  };
  const BASE_X = 0;
  const BASE_Z = -0.045;
  const qInv = new THREE.Quaternion();
  const down = new THREE.Vector3();
  const update = (t: number) => {
    const calm = 1 - act.focus;
    const { k: k0, dir } = drill(t);
    const k = k0 * calm;
    const kLag = drill(t - 0.4).k * calm;
    const ch = act.charge;
    const st = act.strike;
    hover.position.set(0, Math.sin(t * 1.15) * 0.018 + k * 0.035 + ch * 0.07, st * 0.16);
    sword.rotation.set(BASE_X - k * 0.14 + ch * 0.32 - st * 1.05, k * 0.62 * dir, BASE_Z + k * 0.2 * dir + Math.sin(t * 0.63) * 0.012 * calm);
    qInv.setFromEuler(sword.rotation).invert();
    down.set(0, -1, 0).applyQuaternion(qInv);
    const lag = (k - kLag) * dir;
    cape.update(t, down, -lag * 0.22 + Math.sin(t * 0.8) * 0.012, -0.012 + Math.sin(t * 0.61 + 1) * 0.012 - ch * 0.05);
    M.gem.emissiveIntensity = 0.5 + 0.12 * Math.sin(t * 1.5) + 0.2 * k + 0.6 * Math.max(act.glow, ch);
  };
  update(1);

  mergeStatic(root, { owners: [hover, sword], keep: [cape.mesh, gem], rig });

  // The whole thing is moved onto the pivot: the center of the bounding box in x and z is placed at the origin, so the side and back views are not clipped (pitfall 66)
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const mid = box.getCenter(new THREE.Vector3());
  place.position.set(-mid.x, 0, -mid.z);
  const size = box.getSize(new THREE.Vector3());

  return {
    root,
    update: (t) => update(t),
    center: new THREE.Vector3(0, mid.y, 0),
    radius: Math.max(size.x, size.y, size.z) * 0.56,
    rig,
    act,
  };
}
