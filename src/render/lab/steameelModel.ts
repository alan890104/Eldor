// Whistle Wyrm (model lab version): born on the steam coast, half its body soaking in the sea and half lying on lava; the white mist it exhales can make the whole coast vanish, and smugglers love to set sail on the mornings after it wakes.
// Fire and water, R, steaming and scorching. Identifying features: 1. Three steam whistles behind the neck: bone-white chimney-like vents in a row from tall to short, orange light showing through the holes, and the tallest topped with a puff of white smoke;
// 2. One body with two colors: the neck rising from the sea is teal green with a cream belly, and the stretch lying on the lava is a cracked black rock shell with lava orange showing through the cracks, and a row of volcanic rock spines on its back; 3. Below it is a pool of seawater, with a raised volcanic rock shore at the back half of the pool edge and glowing cracks in the rock; the body, like a sea serpent, is split into neck, back hump and tail sections that dive in and out, with a long orange-red fin along the back.
// Personality: an eager but clumsy whistle sprite that puffs white smoke from the top of its head with a wooo whenever it gets excited; personality is expressed by the smoke, the opening and closing of the gill fins and the head's motion, not by human facial expression.
// The face follows a moray eel: small eyes on the sides of the head above the mouth line, sunk into sockets, deep amber irises with black vertical pupils and one small highlight, no eyelids and no blinking, both eyes looking forward together; the mouth is a half-open long jaw with two rows of fine backward-curving teeth and a pair of sharp fangs at the front.
// Gaze order: the head (golden vertical pupils on the sides of the head, the half-open long jaw with fine teeth, the orange-red gill fins) first, the whistles behind the neck and the white smoke second, and the rock shell of the back hump, the rock spines and the lava shore as support.
// Back: a copper kettle sits on the volcanic rock shore (a thank-you left for it by the smugglers before they set sail), a small puff of steam coming from its spout; the tail rises out of the lava and curls forward.
// <Action table> Idle: the head slowly looks left and right, the mouth opens and closes like a moray eel changing its breath, the white smoke on the whistles swells and shrinks, the back hump rises and falls with breathing, the tail sways lightly, the lava cracks flicker faintly, and the pupils of both eyes turn slowly together.
// Steam blast (act.steam): the head tilts back, the mouth opens wide and the white smoke swells into a big puff. glow (act.glow): the whistle holes and the lava cracks brighten. Hit: the head draws back and the gill fins lie flat.
// Anchors: head, eyes, mouth, vent (the mouth of the tallest whistle), cloud (center of the white smoke), hump (top of the back hump), tail (tail tip), kettle (the spout), sea (sea surface), lava (lava surface).

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { curveTable, lathe, loft, mergeStatic, partKit, PI, rng, type LabModel } from './shapes.ts';
import { labToon, rampTexture } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const FWD = v(0, 0, 1);
const ss = THREE.MathUtils.smoothstep;
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);

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

function capGeo(r: number, ang: number, seg = 20, rings = 3): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, seg, rings, 0, PI * 2, 0, ang).rotateX(PI / 2);
}

/** Vertical pupil: a thin vertical ellipse on a sphere (first squash the spherical cap along x, then push it back onto the sphere so it does not sink into the iris) */
function slitGeo(r: number, ang: number, k: number): THREE.BufferGeometry {
  const g = capGeo(r, ang, 18, 4);
  const pa = g.attributes.position as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    p.fromBufferAttribute(pa, i);
    p.x *= k;
    p.setLength(r);
    pa.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  return g;
}

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

function orientXZ(o: THREE.Object3D, xDir: THREE.Vector3, zHint: THREE.Vector3): void {
  const x = xDir.clone().normalize();
  const z = zHint.clone().addScaledVector(x, -zHint.dot(x)).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

interface Frame {
  C: THREE.Vector3;
  T: THREE.Vector3;
  W: THREE.Vector3;
  D: THREE.Vector3;
  a: number;
  b: number;
}

/**
 * A tube-shaped body along a curve (the same as shapes' loft), additionally giving each cell its frame: W is the lateral direction after projecting side, and D = T × W is the back (θ = π/2),
 * so when one function makes the neck, back hump and tail, the sign of side is chosen so that D faces the back. color(t, θ) applies vertex colors; give 0 for the radius at the ends to close them.
 */
function tube(pts: THREE.Vector3[], prof: (t: number) => number[], side: THREE.Vector3, segs: number, radial: number, color?: (t: number, th: number) => THREE.Color) {
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const frame = (t: number): Frame => {
    const C = path.getPointAt(t);
    const T = path.getTangentAt(t);
    const W = side.clone().addScaledVector(T, -T.dot(side)).normalize();
    const D = new THREE.Vector3().crossVectors(T, W).normalize();
    const [a, b] = prof(t);
    return { C, T, W, D, a, b };
  };
  const at = (t: number, th: number, off = 0) => {
    const f = frame(t);
    return f.C.clone().addScaledVector(f.W, Math.cos(th) * (f.a + off)).addScaledVector(f.D, Math.sin(th) * (f.b + off));
  };
  const nrm = (t: number, th: number) => {
    const f = frame(t);
    return f.W.clone().multiplyScalar(Math.cos(th) / Math.max(1e-3, f.a)).addScaledVector(f.D, Math.sin(th) / Math.max(1e-3, f.b)).normalize();
  };
  const pos: number[] = [];
  const cl: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    for (let j = 0; j < radial; j++) {
      const th = (j / radial) * PI * 2;
      const p = at(t, th);
      pos.push(p.x, p.y, p.z);
      if (color) {
        const c = color(t, th);
        cl.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.setIndex(ringIndex(segs, radial));
  g.computeVertexNormals();
  faceOut(g, Math.floor(segs / 2) * radial, frame(0.5).W);
  return { geo: g, frame, at, nrm };
}

/** A solid puff of white smoke: a few squashed spheres stacked together */
function cloudGeo(r: number, seed: number): THREE.BufferGeometry[] {
  const rand = rng(seed);
  const out: THREE.BufferGeometry[] = [];
  const lobes: [number, number, number, number][] = [[0, 0, 0, 1], [0.75, -0.2, 0.1, 0.72], [-0.7, -0.15, -0.05, 0.75], [0.1, 0.55, -0.1, 0.7], [0.05, -0.1, 0.6, 0.6]];
  for (const [x, y, z, s] of lobes) {
    const k = s * (0.92 + rand() * 0.16);
    out.push(new THREE.SphereGeometry(r * k, 14, 10).translate(x * r, y * r, z * r));
  }
  return out;
}

// ───────────────────────── Shape ─────────────────────────

export function buildSteameelLab(): LabModel {
  const RIMC = 0xd8fff4;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const cloudRamp = rampTexture([[-1, 0.72], [-0.1, 0.87], [0.4, 1]]);
  const M = {
    body: vc(labToon(0xffffff, { rim: 0.55, rimColor: RIMC })),
    fin: vc(labToon(0xffffff, { rim: 0.5, rimColor: 0xffd8b8 })),
    bone: labToon(0xf2e6cc, { rim: 0.35, rimColor: 0xfff4dc }),
    glow: labToon(0xffc070, { rim: 0, emissive: 0xff7a1a, emissiveAmt: 0.9 }),
    lava: labToon(0xff9a3a, { rim: 0, emissive: 0xff5a10, emissiveAmt: 0.8 }),
    steam: labToon(0xf6f8fa, { rim: 0.25, rimColor: 0xffffff }),
    ground: vc(labToon(0xffffff, { rim: 0.2 })),
    basalt: labToon(0x3e3434, { rim: 0.35, rimColor: 0xffb070, speckle: 0.6 }),
    mouth: labToon(0x5a1820, { rim: 0 }),
    tooth: labToon(0xfbf6ea, { rim: 0.2 }),
    copper: labToon(0xc8703a, { ramp: 'metal', rim: 0.4, rimColor: 0xffe0c0, spec: 0.6, specTh: 0.93 }),
    iron: labToon(0x3a3230, { ramp: 'metal', rim: 0.3, spec: 0.3 }),
    eye: labToon(0x2a1a08, { ramp: 'gem', rim: 0, spec: 0.5, specTh: 0.97 }),
    iris: vc(labToon(0xffffff, { ramp: 'gem', rim: 0 })),
    pupil: labToon(0x0a0604, { rim: 0 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  for (const [k, m] of Object.entries(M)) m.name = k;
  M.steam.gradientMap = cloudRamp;

  const root = new THREE.Group();
  root.name = 'steameel-lab';
  const { add, group } = partKit();
  const HEAD = 9701;

  const cTeal = col(0x2c8c96);
  const cTealDk = col(0x1c5e70);
  const cBelly = col(0xf4e6c4);
  const cMagma = col(0xff8a30);
  const cMagmaDk = col(0xd0501c);
  const cFin = col(0xf0603a);
  const cFinLt = col(0xffa060);
  const cRock = col(0x3a3232);
  const cRockLt = col(0x5a4c48);
  const cMouth = col(0x5a1820);

  // Color: θ = π/2 is the back and −π/2 the belly; lavaK from 0 to 1 turns teal green into lava: the back and flanks are patches of black rock shell, with lava orange showing in the cracks between the patches, and the whole belly is orange
  const bodyColor = (th: number, lavaK: number, t = 0) => {
    const sn = Math.sin(th);
    const c = cBelly.clone().lerp(cTeal, ss(sn, -0.86, -0.62)).lerp(cTealDk, ss(sn, 0.45, 0.9) * 0.6);
    if (lavaK <= 0) return c;
    const n = Math.sin(t * 34 + Math.sin(th * 3) * 1.6) * Math.sin(th * 4.5 + t * 9);
    const crust = ss(Math.abs(n), 0.1, 0.3) * ss(sn, -0.6, -0.25);
    const lava = cMagmaDk.clone().lerp(cMagma, ss(-sn, -0.3, 0.6)).lerp(cRock.clone().lerp(cRockLt, ss(sn, 0.2, 0.9) * 0.5), crust);
    return c.lerp(lava, lavaK);
  };
  // Belly scales on the underside of the neck, cell by cell: a slightly darker cross stripe at every interval
  const cScute = col(0xd8c49c);
  const neckColor = (t: number, th: number) => {
    const c = bodyColor(th, 0);
    const band = 1 - ss(Math.abs(((t * 22) % 1) - 0.5), 0.0, 0.12);
    return c.lerp(cScute, band * (1 - ss(Math.sin(th), -0.75, -0.6)) * 0.8);
  };

  // ── Sea and volcanic rock shore: an elliptical pool of seawater (the neck rises from here), with a thick raised volcanic rock shore along the back half of the pool edge (the rear of the back hump and the tail dive out of the rock) ──
  const PZ = -0.26;
  const SPLIT = -0.22;
  const SEA_Y = 0.045;
  const cSea = col(0x3a9ec0);
  const cSeaLt = col(0x8fdce6);
  const cFoam = col(0xeef8fa);
  const entries = [v(0, 0, 0.04), v(0.02, 0, -0.1), v(0.02, 0, -0.62), v(-0.2, 0, -0.76)];
  {
    // The lathe profile is ordered from the outside in: a profile surface running from the center outward would face down (three's lathe normal is (dy, −dx)) and cannot be seen from above
    const g = lathe([[1.02, 0.0], [1.0, SEA_Y - 0.03], [0.9, SEA_Y - 0.008], [0.5, SEA_Y], [0.001, SEA_Y]], 56);
    g.scale(0.66, 1, 0.76).translate(0, 0, PZ);
    g.deleteAttribute('uv');
    paint(g, (p) => {
      const c = cSea.clone().lerp(cSeaLt, 1 - ss(Math.hypot(p.x, p.z - 0.04), 0.12, 0.34));
      for (const e of [entries[0], entries[1]]) c.lerp(cFoam, (1 - ss(Math.hypot(p.x - e.x, p.z - e.z), 0.1, 0.15)) * 0.8);
      // A ring of white foam along the front edge of the rock shore (seawater meeting hot rock)
      c.lerp(cFoam, (1 - ss(Math.abs(p.z - (SPLIT + 0.035 * Math.sin(p.x * 9))), 0.0, 0.06)) * 0.85);
      return c;
    });
    add(root, g, M.ground);
  }
  // Volcanic rock shore: a thick slab of rock along the back half of the pool with a winding front edge (beveled), a few angular rock blocks at the shore, and glowing cracks in the rock surface
  const SHELF_Y = 0.075;
  {
    const s = new THREE.Shape();
    const u0 = Math.asin((SPLIT - PZ) / 0.74);
    const N = 28;
    for (let i = 0; i <= N; i++) {
      const u = u0 - (i / N) * (PI + 2 * u0);
      const x = 0.62 * Math.cos(u);
      const z = PZ + 0.72 * Math.sin(u);
      if (i === 0) s.moveTo(x, -z);
      else s.lineTo(x, -z);
    }
    for (let i = 1; i < 16; i++) {
      const x = -0.62 + (i / 16) * 1.24;
      const z = SPLIT + 0.035 * Math.sin(x * 9) + 0.02 * Math.sin(x * 23);
      s.lineTo(x, -z);
    }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: SHELF_Y - 0.025, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.022, bevelSegments: 2, curveSegments: 4 }).rotateX(-PI / 2);
    add(root, g, M.basalt);
    const rr = rng(53);
    for (const [x, z, r] of [[0.5, -0.3, 0.08], [-0.5, -0.36, 0.1], [0.36, -0.86, 0.07], [-0.42, -0.84, 0.09], [0.04, -0.98, 0.06]] as [number, number, number][]) {
      const m = add(root, new THREE.DodecahedronGeometry(r, 0), M.basalt, [x, SHELF_Y + r * 0.2, z], [rr() * PI, rr() * PI, 0], [1, 0.7, 1]);
      m.castShadow = true;
    }
  }
  // Cracks in the rock surface: a few polylines, glowing orange (one of the body's emissives)
  const crackRand = rng(29);
  const CC = v(-0.08, SHELF_Y + 0.003, -0.7);
  for (let k = 0; k < 6; k++) {
    const a = -PI / 2 + (k / 5 - 0.5) * 3.2;
    const start = CC.clone().add(v(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.15));
    const pts = [start];
    let p = start.clone();
    for (let i = 0; i < 4; i++) {
      p = p.clone().add(v(Math.cos(a) * 0.1 + (crackRand() - 0.5) * 0.07, 0, Math.sin(a) * 0.09 + (crackRand() - 0.5) * 0.06));
      const rx = p.x / 0.62;
      const rz = (p.z - PZ) / 0.72;
      if (rx * rx + rz * rz > 0.8 || p.z > SPLIT - 0.07) break;
      pts.push(p);
    }
    if (pts.length < 3) continue;
    add(root, loft(pts, (t) => [0.012 * (1 - t * 0.7) + 0.003, 0.004], { segs: 10, radial: 6, side: v(0, 1, 0) }), M.lava);
  }
  // A ring of glowing lava where the body dives into the lava
  for (const e of [entries[2], entries[3]]) add(root, new THREE.CylinderGeometry(0.125, 0.13, 0.012, 20), M.lava, [e.x, SHELF_Y, e.z]);

  // ── The body in three sections: the neck rises from the sea, the back hump arches over the boundary between sea and lava, and the tail rises out of the lava and curls forward ──
  const neck = tube([v(0, -0.08, 0.04), v(0, 0.25, 0.12), v(0, 0.55, 0.09), v(0, 0.8, 0.14), v(0, 0.95, 0.24)], curveTable([[0, 0.105, 0.1], [0.5, 0.098, 0.094], [1, 0.094, 0.09]]), v(1, 0, 0), 44, 20, neckColor);
  add(root, neck.geo, M.body).userData.inkGroup = HEAD;
  const humpG = group(root, [0.02, 0, -0.35]);
  const hump = tube([v(0, -0.1, 0.25), v(0.01, 0.2, 0.17), v(0.02, 0.42, -0.02), v(0.01, 0.2, -0.2), v(0, -0.1, -0.27)], curveTable([[0, 0.1, 0.098], [0.5, 0.1, 0.098], [1, 0.088, 0.085]]), v(-1, 0, 0), 60, 26, (t, th) => bodyColor(th, ss(t, 0.36, 0.52), t));
  add(humpG, hump.geo, M.body);
  const tailG = group(root, [-0.2, 0, -0.78]);
  const tail = tube([v(0, -0.1, 0.02), v(-0.03, 0.14, -0.06), v(-0.08, 0.32, -0.02), v(-0.1, 0.4, 0.08), v(-0.1, 0.38, 0.15)], curveTable([[0, 0.075, 0.072], [0.6, 0.052, 0.05], [0.9, 0.03, 0.03], [1, 0, 0]]), v(1, 0, 0), 40, 20, (t, th) => bodyColor(th, 1, t * 0.8 + 0.3));
  add(tailG, tail.geo, M.body);
  // A small fan fin at the tail tip
  {
    const f = tail.frame(0.93);
    const g = group(tailG, [f.C.x, f.C.y, f.C.z]);
    orientXZ(g, f.T.clone().addScaledVector(f.D, 0.4), f.W);
    add(g, finGeo((s) => [0.12 * s, 0.02 * (1 - s)], (s) => [0.12 * s - 0.02 * Math.sin(PI * s), 0.02 + 0.07 * Math.sin(PI * Math.min(1, s * 1.1)) * (1 - s * 0.3)], (s, h) => 0.007 * (1 - 0.5 * h) * Math.sin(PI * Math.min(1, s + 0.05)) + 0.0015, 10, 10, (_s, h) => cFin.clone().lerp(cFinLt, h * 0.6)), M.fin);
  }

  // Volcanic rock spines: a row of black rock spines leaning backward along the back line of the lava section, joined behind the orange-red long fin of the front section
  const spineGeo = lathe([[0.001, -0.012], [0.03, -0.004], [0.026, 0.03], [0.014, 0.06], [0.004, 0.078], [0.001, 0.08]], 7).toNonIndexed();
  spineGeo.computeVertexNormals();
  const spines = (tb: ReturnType<typeof tube>, t0: number, t1: number, n: number, owner: THREE.Object3D, k0: number) => {
    for (let i = 0; i < n; i++) {
      const t = t0 + ((i + 0.5) / n) * (t1 - t0);
      const f = tb.frame(t);
      const p = tb.at(t, PI / 2, -0.008);
      if (p.y + owner.position.y < SHELF_Y + 0.02) continue;
      const m = add(owner, spineGeo, M.basalt, [p.x, p.y, p.z]);
      const k = k0 * (0.8 + 0.4 * Math.sin(i * 2.1 + 1));
      m.scale.setScalar(k);
      m.quaternion.setFromUnitVectors(v(0, 1, 0), f.D.clone().addScaledVector(f.T, 0.5).normalize());
    }
  };
  spines(hump, 0.54, 0.9, 6, humpG, 1.05);
  spines(tail, 0.1, 0.72, 5, tailG, 0.8);

  // Dorsal fin: from the top of the head down the nape to the sea surface, then arching up again from the front half of the back hump; an orange-red long fin with fin rays
  const ribbon = (tb: ReturnType<typeof tube>, t0: number, t1: number, H: (u: number) => number, owner: THREE.Object3D, segs: number) => {
    const pos: number[] = [];
    const cl: number[] = [];
    const J = 10;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const t = t0 + (t1 - t0) * u;
      const f = tb.frame(t);
      const base = f.C.clone().addScaledVector(f.D, f.b * 0.8);
      const h = H(u) * (1 - 0.18 * Math.pow(Math.sin(PI * ((u * segs) / 3)), 2));
      const top = f.C.clone().addScaledVector(f.D, f.b + h);
      for (let j = 0; j < J; j++) {
        const fi = (j / J) * PI * 2;
        const hh = (1 - Math.cos(fi)) / 2;
        const p = base.clone().lerp(top, hh).addScaledVector(f.W, Math.sin(fi) * (0.009 * (1 - 0.6 * hh) + 0.0015) * Math.min(1, u * 12, (1 - u) * 12 + 0.2));
        pos.push(p.x, p.y, p.z);
        const ray = 1 - ss(Math.abs(((u * segs) / 3) % 1 - 0.5), 0.3, 0.5);
        const c = cFin.clone().lerp(cFinLt, ss(hh, 0.5, 1) * 0.6).lerp(cMagmaDk, ray * 0.25 * hh);
        cl.push(c.r, c.g, c.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    g.setIndex(ringIndex(segs, J));
    g.computeVertexNormals();
    faceOut(g, Math.floor(segs / 2) * J + Math.floor(J / 4), tb.frame((t0 + t1) / 2).W);
    add(owner, g, M.fin);
  };
  ribbon(neck, 0.05, 0.6, (u) => 0.03 + 0.05 * Math.sin(PI * Math.min(1, u * 1.1)), root, 30);
  ribbon(hump, 0.05, 0.48, (u) => 0.02 + 0.06 * Math.sin(PI * u), humpG, 27);

  // Three whistles behind the neck: bone-white chimneys with orange light showing through the holes, getting shorter from top to bottom
  const vents: THREE.Group[] = [];
  const ventGeo = (h: number, r: number) => lathe([[r * 0.9, -0.03], [r, h * 0.3], [r * 0.9, h * 0.72], [r * 1.3, h * 0.86], [r * 1.38, h], [r * 1.15, h * 1.05], [r * 0.64, h * 1.0], [r * 0.6, h * 0.8]], 16);
  for (const [t, h, r] of [[0.95, 0.19, 0.042], [0.8, 0.15, 0.036], [0.66, 0.11, 0.03]] as [number, number, number][]) {
    const f = neck.frame(t);
    const p = f.C.clone().addScaledVector(f.D, f.b * 0.75);
    const g = group(root, [p.x, p.y, p.z]);
    orientXZ(g, f.W, f.D.clone().multiplyScalar(0.8).add(v(0, 0.6, 0)));
    // The x axis is lateral and z is the back direction: the lathe's y has to point along z, so turn it
    const inner = group(g, [0, 0, 0], [PI / 2, 0, 0]);
    add(inner, ventGeo(h, r), M.bone);
    add(inner, new THREE.CircleGeometry(r * 0.6, 12).rotateX(-PI / 2).translate(0, h * 0.82, 0), M.glow);
    vents.push(inner);
  }
  const ventTop = group(vents[0], [0, 0.2, 0]);
  const cloudG = group(ventTop, [0, 0.08, 0]);
  for (const g of cloudGeo(0.06, 3)) add(cloudG, g, M.steam);

  // ── Head: a flat, long wyrm-eel head, an upper jaw, a half-open lower jaw (the look of a moray eel changing its breath), deep red inside the mouth; two rows of fine backward-curving teeth and a pair of sharp fangs at the front; a pair of orange-red fan-shaped gill fins at the cheeks ──
  const headG = group(root, [0, 0.95, 0.24]);
  const HP = (x: number, y: number, z: number) => v(x, y - 0.95, z - 0.24);
  const upper = tube([HP(0, 0.93, 0.18), HP(0, 0.99, 0.28), HP(0, 1.01, 0.4), HP(0, 0.985, 0.54), HP(0, 0.955, 0.63)], curveTable([[0, 0.096, 0.09], [0.28, 0.108, 0.094], [0.6, 0.082, 0.064], [0.88, 0.056, 0.042], [0.96, 0.04, 0.03], [1, 0, 0]]), v(1, 0, 0), 30, 24, (t, th) => {
    const sn = Math.sin(th);
    const c = cTeal.clone().lerp(cTealDk, ss(sn, 0.5, 0.95) * 0.45);
    return c.lerp(cMouth, (1 - ss(sn, -0.72, -0.5)) * ss(t, 0.18, 0.3));
  });
  add(headG, upper.geo, M.body).userData.inkGroup = HEAD;
  const JAW_OPEN = 0.13;
  const jawG = group(headG, [0, -0.045, 0.02]);
  jawG.rotation.x = JAW_OPEN;
  const jaw = tube([v(0, 0.0, -0.02), v(0, -0.01, 0.1), v(0, -0.005, 0.24), v(0, 0.0, 0.33)], curveTable([[0, 0.08, 0.05], [0.4, 0.074, 0.044], [0.85, 0.046, 0.028], [1, 0, 0]]), v(1, 0, 0), 20, 18, (_t, th) => {
    const sn = Math.sin(th);
    return cBelly.clone().lerp(cTeal, ss(Math.abs(Math.cos(th)), 0.75, 0.95) * ss(sn, -0.2, 0.3) * 0.5).lerp(cMouth, ss(sn, 0.55, 0.8));
  });
  add(jawG, jaw.geo, M.body);
  // Teeth: the base of the cone at the origin and the tip toward dir; a moray's teeth curve toward the throat (backward and inward)
  const toothAt = (parent: THREE.Object3D, p: THREE.Vector3, dir: THREE.Vector3, r: number, h: number) => {
    const m = add(parent, new THREE.ConeGeometry(r, h, 6, 1).translate(0, h / 2, 0), M.tooth, [p.x, p.y, p.z]);
    m.quaternion.setFromUnitVectors(v(0, 1, 0), dir.clone().normalize());
  };
  for (const sx of [-1, 1]) {
    // Upper jaw: a row of fine teeth pointing down along the edge of the mouth line, the very front one the largest
    for (const [t, r, h] of [[0.46, 0.005, 0.016], [0.56, 0.0055, 0.018], [0.66, 0.0055, 0.019], [0.75, 0.006, 0.02], [0.84, 0.0095, 0.032]] as [number, number, number][]) {
      const p = upper.at(t, sx > 0 ? -0.46 : PI + 0.46, -0.004);
      toothAt(headG, p, v(-sx * 0.18, -1, -0.22), r, h);
    }
    // Lower jaw: a row of fine teeth pointing up along both edges, with a pair of sharp fangs at the front
    for (const [t, r, h] of [[0.36, 0.005, 0.015], [0.48, 0.0055, 0.017], [0.6, 0.0055, 0.018], [0.72, 0.006, 0.019], [0.86, 0.008, 0.026]] as [number, number, number][]) {
      const p = jaw.at(t, sx > 0 ? 0.66 : PI - 0.66, -0.003);
      toothAt(jawG, p, v(-sx * 0.22, 1, -0.2), r, h);
    }
  }
  // Gill fins
  const gills: { g: THREE.Group; q: THREE.Quaternion; sx: number }[] = [];
  for (const sx of [-1, 1]) {
    const p = upper.at(0.08, sx > 0 ? 0.1 : PI - 0.1, -0.01);
    const g = group(headG, [p.x, p.y, p.z]);
    orientXZ(g, v(sx * 0.75, 0.25, -0.6), v(sx * 0.4, 0.3, 0.85));
    const L = (s: number): [number, number] => [0.02 * s, -0.05 + 0.1 * s];
    const T = (s: number): [number, number] => {
      const a = -0.9 + 1.8 * s;
      const spike = 1 + 0.35 * Math.pow(Math.abs(Math.cos(s * PI * 2.5)), 3);
      return [Math.cos(a) * 0.13 * spike, Math.sin(a) * 0.1 * spike];
    };
    add(g, finGeo(L, T, (_s, h) => 0.008 * (1 - 0.6 * h) + 0.0015, 18, 10, (_s, h) => cFin.clone().lerp(cFinLt, ss(h, 0.5, 1) * 0.6)), M.fin);
    gills.push({ g, q: g.quaternion.clone(), sx });
  }

  // Eyes: on the sides of the head above the mouth line (where a moray's eyes are), facing outward and slightly forward; the eye is small (diameter about 20% of the head width), sunk into a ring of socket in the same color family,
  // a deep amber iris (no bright concentric rings), a black vertical pupil, one small highlight, and no eyelids
  const ER = 0.026;
  const gazes: { g: THREE.Group; sx: number }[] = [];
  const glints: THREE.Object3D[] = [];
  const eyeAnchors: THREE.Group[] = [];
  const hiGeo = new THREE.SphereGeometry(1, 10, 6);
  const cIris = col(0xb8700e);
  const cIrisRim = col(0x7a3e08);
  const irisGeo = capGeo(ER + 0.0008, 1.05, 24, 5);
  paint(irisGeo, (p) => cIris.clone().lerp(cIrisRim, ss(Math.hypot(p.x, p.y) / ER, 0.55, 0.9)));
  const slit = slitGeo(ER + 0.0018, 0.7, 0.32);
  for (const sx of [-1, 1]) {
    const th = sx > 0 ? 0.36 : PI - 0.36;
    const sp = upper.at(0.44, th);
    const n = upper.nrm(0.44, th);
    const d = n.clone().add(v(0, 0.04, 0.26)).normalize();
    const c = sp.clone().addScaledVector(n, -ER * 0.4);
    const eg = group(headG, [c.x, c.y, c.z]);
    eg.quaternion.setFromUnitVectors(FWD, d);
    const roll = group(eg);
    {
      const upW = v(0, 1, 0).applyQuaternion(eg.quaternion);
      const want = v(0, 1, 0).addScaledVector(d, -d.y).normalize();
      roll.rotation.z = Math.atan2(new THREE.Vector3().crossVectors(upW, want).dot(d), upW.dot(want));
    }
    add(roll, capGeo(ER, 1.35, 20, 7), M.eye);
    add(roll, paint(new THREE.TorusGeometry(ER * 0.95, 0.0065, 8, 20), () => cTealDk.clone().lerp(cTeal, 0.35)), M.body, [0, 0, ER * 0.36]).userData.inkGroup = HEAD;
    const gaze = group(roll);
    gazes.push({ g: gaze, sx });
    add(gaze, irisGeo, M.iris);
    add(gaze, slit, M.pupil);
    // The highlight is fixed on the eye (it does not turn with the pupil), and both eyes are at the upper front; only one small dot (less than a tenth of the eye in area)
    for (const [q, r] of [[v(-sx * 0.32, 0.42, 0.85), 0.0045]] as [THREE.Vector3, number][]) {
      q.normalize();
      const hl = add(roll, hiGeo, M.hi, [q.x * (ER + 0.004), q.y * (ER + 0.004), q.z * (ER + 0.004)], [0, 0, 0], [r, r, r * 0.45]);
      hl.quaternion.setFromUnitVectors(FWD, q);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
      glints.push(hl);
    }
    eyeAnchors.push(group(roll, [0, 0, ER]));
  }

  // ── Copper kettle on the back: set on the lava, with a small puff of steam coming from the spout ──
  const kettleG = group(root, [0.3, SHELF_Y, -0.72], [0, 0.5, 0]);
  add(kettleG, lathe([[0.001, 0], [0.058, 0.004], [0.074, 0.03], [0.072, 0.062], [0.052, 0.086], [0.03, 0.096], [0.001, 0.098]], 20), M.copper);
  add(kettleG, new THREE.SphereGeometry(0.014, 10, 8), M.iron, [0, 0.104, 0]);
  add(kettleG, loft([v(0.055, 0.035, 0), v(0.09, 0.06, 0), v(0.115, 0.1, 0), v(0.125, 0.12, 0)], curveTable([[0, 0.02, 0.02], [1, 0.009, 0.009]]), { segs: 8, radial: 10 }), M.copper);
  add(kettleG, new THREE.TorusGeometry(0.055, 0.007, 6, 16, PI), M.iron, [0, 0.09, 0], [0, PI / 2, 0]);
  const kSteam = group(kettleG, [0.14, 0.16, 0]);
  for (const g of cloudGeo(0.028, 9)) add(kSteam, g, M.steam);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  const headC = upper.frame(0.35).C;
  const mouthP = upper.frame(0.95).C.clone().add(v(0, -0.04, 0));
  const humpTop = hump.frame(0.5);
  const rig = {
    head: group(headG, [headC.x, headC.y, headC.z + 0.05]),
    eyes: eyeAnchors,
    anchors: {
      mouth: group(headG, [mouthP.x, mouthP.y, mouthP.z]),
      vent: ventTop,
      cloud: cloudG,
      hump: group(humpG, [humpTop.C.x, humpTop.C.y + humpTop.b, humpTop.C.z]),
      tail: group(tailG, [-0.1, 0.38, 0.15]),
      kettle: kSteam,
      sea: group(root, [0, SEA_Y, 0.2]),
      lava: group(root, [0, SHELF_Y, -0.72]),
    },
  };
  const act = { steam: 0, glow: 0 };

  mergeStatic(root, {
    owners: [headG, jawG, humpG, tailG, cloudG, kSteam, ...vents, ...gills.map((x) => x.g), ...gazes.map((x) => x.g)],
    keep: [...glints],
    rig,
  });

  // ── Idle ──
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const update = (t: number) => {
    const st = act.steam;
    headG.rotation.set(-0.02 + Math.sin(t * 0.8) * 0.03 - st * 0.25, Math.sin(t * 0.35) * 0.16, Math.sin(t * 0.5) * 0.03);
    jawG.rotation.x = JAW_OPEN + Math.sin(t * 1.9) * 0.045 + st * 0.3;
    humpG.scale.set(1, 1 + Math.sin(t * 1.3) * 0.025, 1);
    tailG.rotation.y = Math.sin(t * 0.9) * 0.12;
    const puff = 1 + Math.sin(t * 1.5) * 0.12 + st * 1.2;
    cloudG.scale.setScalar(puff);
    cloudG.position.y = 0.08 + Math.sin(t * 1.5) * 0.02 + st * 0.08;
    kSteam.scale.setScalar(1 + Math.sin(t * 2.1 + 1) * 0.15);
    kSteam.position.y = 0.16 + Math.sin(t * 2.1 + 1) * 0.012;
    for (const gl of gills) {
      e.set(0, Math.sin(t * 1.4 + gl.sx) * 0.08 * gl.sx, 0);
      gl.g.quaternion.copy(gl.q).multiply(q.setFromEuler(e));
    }
    M.lava.emissiveIntensity = 0.75 + Math.sin(t * 1.1) * 0.12 + act.glow * 0.6;
    M.glow.emissiveIntensity = 0.9 + act.glow * 0.8;
    // The pupils of both eyes turn together forward, backward, up and down (left-right symmetric), looking in the same direction; no eyelids and no blinking
    for (const g of gazes) {
      g.g.rotation.y = -g.sx * (0.2 + Math.sin(t * 0.35) * 0.07);
      g.g.rotation.x = -0.04 + Math.sin(t * 0.47) * 0.04;
    }
  };
  update(0);

  return { root, update, center: new THREE.Vector3(0, 0.62, -0.2), radius: 0.9, rig, act };
}
