// Thousand Cranes (model lab version): the Wingfolk fold letters that cannot be sent into paper cranes and release them into the plateau wind; the cranes drank in source stream and came alive, and are still looking for whoever should receive them.
// Wind and neutral, N, relay / support. Identifying features: 1. It really is one origami crane: every face is a flat sheet of paper, the creases are drawn by normal outlines, and the body, neck, tail and wings follow the structure of origami;
// 2. The paper is a letter: the wings of cream letter paper are covered with lines of dark blue writing, the underside is pale blue airmail paper, and at the base of the neck on the chest a red wax seal is set (the Wingfolk's feather pattern);
// 3. Hanging from under the belly is a string of a thousand cranes (three small paper cranes in red, gold and cyan strung on a red thread, with a bunch of tassel below), companions it has collected along the way.
// Back: a stamp (perforated edge, a red sun painted on it) is stuck at the root of the right wing; the letter has never been sent.
// Body shape: a paper crane floating in midair with the wings spread slanting upward; the head is a small piece at the tip of the neck folded forward and down, and an origami crane has no facial features to begin with, so no eyes or mouth are forced on.
// Personality: a earnest but slightly absent-minded messenger who keeps asking the wind "where is the recipient": the head tip turns left and right looking for someone, and tips slightly forward when it stops.
// Gaze order: the folded head tip and the red wax seal on the chest first, the wings covered with writing second, and the string of small paper cranes below as support.
// Action table: idle is floating up and down, the wings slowly fanning, the head turning left and right looking for someone, and the string of small paper cranes swinging like wind chimes; charge-up draws the wings up (act.fold);
// strike fans the wings once to send out the wind and letter paper (anchors wingL, wingR); hit blows the whole body askew, the paper wrinkles once and then flattens again; victory spins a full turn and nods.
// Anchors: head (center of the head's fold), eyes is empty (no eyes), mouth (beak tip), seal (wax seal), wingL, wingR (wing tips), tassel (the tassel).

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lathe, loft, mergeStatic, partKit, PI, rng, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const lerp = THREE.MathUtils.lerp;

type Tri = [THREE.Vector3, THREE.Vector3, THREE.Vector3];

/**
 * A flat polyhedron (one piece of the origami): each triangle has its own normal (no shared vertices), winding oriented outward by center;
 * color(face normal, face center) decides the color of a whole face.
 */
function facets(tris: Tri[], center: THREE.Vector3, color: (n: THREE.Vector3, c: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const pos: number[] = [];
  const cl: number[] = [];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  for (const [a0, b0, c0] of tris) {
    let a = a0;
    let b = b0;
    const c = c0;
    const n = e1.subVectors(b, a).cross(e2.subVectors(c, a)).normalize().clone();
    const m = a.clone().add(b).add(c).divideScalar(3);
    if (n.dot(m.clone().sub(center)) < 0) {
      [a, b] = [b, a];
      n.negate();
    }
    const cc = color(n, m);
    for (const p of [a, b, c]) {
      pos.push(p.x, p.y, p.z);
      cl.push(cc.r, cc.g, cc.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A paper sheet with thickness: verts and faces are the paper's midsurface (it may have creases), and up says which side is the front.
 * Each vertex grows thick / 2 to each side along the average normal of the adjacent faces, with side walls added at the edges; the faces are all flat.
 */
function paperSheet(verts: THREE.Vector3[], faces: [number, number, number][], thick: number, up: THREE.Vector3, cTop: THREE.Color, cBot: THREE.Color): THREE.BufferGeometry {
  const fn = faces.map(([a, b, c]) => {
    const n = verts[b].clone().sub(verts[a]).cross(verts[c].clone().sub(verts[a])).normalize();
    return n.dot(up) < 0 ? n.negate() : n;
  });
  const vn = verts.map(() => new THREE.Vector3());
  faces.forEach((f, i) => f.forEach((k) => vn[k].add(fn[i])));
  vn.forEach((n) => n.normalize());
  const top = verts.map((p, i) => p.clone().addScaledVector(vn[i], thick / 2));
  const bot = verts.map((p, i) => p.clone().addScaledVector(vn[i], -thick / 2));
  const tris: [Tri, THREE.Color, THREE.Vector3][] = [];
  faces.forEach(([a, b, c], i) => {
    tris.push([[top[a], top[b], top[c]], cTop, fn[i]]);
    tris.push([[bot[a], bot[b], bot[c]], cBot, fn[i].clone().negate()]);
  });
  const edges = new Map<string, number>();
  for (const f of faces)
    for (let k = 0; k < 3; k++) {
      const a = f[k];
      const b = f[(k + 1) % 3];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  const mid = verts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(verts.length);
  const cEdge = cTop.clone().lerp(cBot, 0.5);
  for (const [key, n] of edges) {
    if (n > 1) continue;
    const [a, b] = key.split(',').map(Number);
    const out = verts[a].clone().add(verts[b]).multiplyScalar(0.5).sub(mid);
    tris.push([[top[a], bot[a], bot[b]], cEdge, out]);
    tris.push([[top[a], bot[b], top[b]], cEdge, out]);
  }
  const pos: number[] = [];
  const cl: number[] = [];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  for (const [[a0, b0, c], cc, hint] of tris) {
    let a = a0;
    let b = b0;
    const n = e1.subVectors(b, a).cross(e2.subVectors(c, a));
    if (n.dot(hint) < 0) [a, b] = [b, a];
    for (const p of [a, b, c]) {
      pos.push(p.x, p.y, p.z);
      cl.push(cc.r, cc.g, cc.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  g.computeVertexNormals();
  return g;
}

/** A pointed origami piece (neck, tail): base edge a, b is buried in the body and tapers toward tip, bulging by w at the midsection on both sides (the cross-section is a slim rhombus) */
function spike(a: THREE.Vector3, b: THREE.Vector3, tip: THREE.Vector3, w: number, color: (n: THREE.Vector3, c: THREE.Vector3) => THREE.Color): THREE.BufferGeometry {
  const m = a.clone().lerp(b, 0.5);
  const rp = m.clone().add(v3(w, 0, 0));
  const rm = m.clone().add(v3(-w, 0, 0));
  const ctr = a.clone().add(b).add(tip).divideScalar(3);
  return facets([[a, rp, tip], [rp, b, tip], [a, tip, rm], [rm, tip, b], [a, b, rp], [a, rm, b]], ctr, color);
}

// ───────────────────────── Shape ─────────────────────────

export function buildPapercraneLab(): LabModel {
  const rand = rng(20260928);
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const RIMC = 0xd8ecff;
  const paper = vc(labToon(0xffffff, { rim: 0.5, rimColor: RIMC }));
  const M = {
    paper,
    ink: labToon(0x34467a, { rim: 0.5, rimColor: RIMC }),
    seal: vc(labToon(0xffffff, { spec: 0.7, specTh: 0.985, rim: 0.4, rimColor: 0xffc8c8 })),
    thread: vc(labToon(0xffffff, { rim: 0.4, rimColor: RIMC })),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;

  const root = new THREE.Group();
  root.name = 'papercrane-lab';
  const { add, group } = partKit();

  const BODY = 9851;
  const HEAD = 9852;
  const WING = 9853;
  const SEAL = 9855;
  const STRING = 9856;

  const CREAM = col(0xf7eedb);
  const CREAM_D = col(0xe8dcc0);
  const AIR = col(0xa9cdf2);
  const S = 1.2;
  const float = group(root, [0, 0.95, 0]);
  const crane = group(float);
  crane.scale.setScalar(S);

  // ── Body: the origami crane's puffed-out rhombus body (top spine, bottom keel, two points at front and back, two faces left and right) ──
  const T = v3(0, 0.09, 0);
  const K = v3(0, -0.15, 0);
  const F = v3(0, -0.03, 0.2);
  const B = v3(0, -0.03, -0.2);
  const L = v3(0.1, -0.02, 0);
  const R = v3(-0.1, -0.02, 0);
  const paperCol = (n: THREE.Vector3) => CREAM.clone().lerp(CREAM_D, Math.max(0, -n.y) * 0.6);
  add(crane, facets([[F, T, L], [T, B, L], [F, L, K], [L, B, K], [F, R, T], [T, R, B], [F, K, R], [R, K, B]], v3(0, -0.02, 0), paperCol), M.paper).userData.inkGroup = BODY;
  // Neck and tail: slim pointed pieces extending slanted upward from the two points at the front and back of the body
  const NECK_TIP = v3(0, 0.42, 0.37);
  add(crane, spike(v3(0, -0.12, 0.1), v3(0, 0.04, 0.17), NECK_TIP, 0.03, paperCol), M.paper).userData.inkGroup = BODY;
  add(crane, spike(v3(0, -0.12, -0.1), v3(0, 0.04, -0.17), v3(0, 0.4, -0.44), 0.03, paperCol), M.paper).userData.inkGroup = BODY;

  // ── Head: a small piece at the tip of the neck folded forward and down (a slim rhombus fold), with the tip as the beak. An origami crane has no facial features to begin with, so no eyes are dotted in ──
  const head = group(crane, [NECK_TIP.x, NECK_TIP.y, NECK_TIP.z]);
  const hTop = v3(0, 0.045, 0.0);
  const hBot = v3(0, -0.035, 0.02);
  const hFront = v3(0, -0.06, 0.15);
  const hBack = v3(0, 0.02, -0.045);
  const hL = v3(0.036, 0.0, 0.035);
  const hR = v3(-0.036, 0.0, 0.035);
  add(head, facets([[hTop, hL, hFront], [hTop, hFront, hR], [hBot, hFront, hL], [hBot, hR, hFront], [hTop, hBack, hL], [hTop, hR, hBack], [hBot, hL, hBack], [hBot, hBack, hR]], v3(0, 0.0, 0.03), paperCol), M.paper).userData.inkGroup = HEAD;

  // ── Wax seal: red wax sealing the base of the neck, a round cake with an irregularly bulging edge and a feather pattern pressed in the middle ──
  const sealG = group(crane, [0, -0.025, 0.2], [-0.2, 0, 0]);
  {
    const red = col(0xb8283a);
    const redL = col(0xd84856);
    const disc = lathe([[0.001, -0.006], [0.036, -0.006], [0.046, -0.002], [0.05, 0.004], [0.044, 0.01], [0.036, 0.011], [0.03, 0.009], [0.001, 0.009]], 16);
    // The wax edge: the radius rises and falls with the angle, like wax that was pressed flat and overflowed
    const pa = disc.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) {
      const a = Math.atan2(pa.getZ(i), pa.getX(i));
      const k = 0.88 * (1 + 0.035 * Math.sin(a * 5 + 0.7) + 0.025 * Math.sin(a * 3));
      pa.setX(i, pa.getX(i) * k);
      pa.setZ(i, pa.getZ(i) * k);
    }
    disc.deleteAttribute('normal');
    disc.deleteAttribute('uv');
    const dg = mergeVertices(disc, 1e-6);
    dg.computeVertexNormals();
    const cc = dg.attributes.position.count;
    dg.setAttribute('color', new THREE.Float32BufferAttribute(new Array(cc).fill(0).flatMap(() => [red.r, red.g, red.b]), 3));
    add(sealG, dg, M.seal, [0, 0, 0], [PI / 2, 0, 0]).userData.inkGroup = SEAL;
    // Feather pattern: a leaf-shaped feather and its shaft pressed onto the wax
    const fs = new THREE.Shape();
    fs.moveTo(0, -0.026);
    fs.quadraticCurveTo(0.017, -0.004, 0, 0.028);
    fs.quadraticCurveTo(-0.017, -0.004, 0, -0.026);
    const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 6 });
    fg.clearGroups();
    const fc = fg.attributes.position.count;
    fg.setAttribute('color', new THREE.Float32BufferAttribute(new Array(fc).fill(0).flatMap(() => [redL.r, redL.g, redL.b]), 3));
    add(sealG, fg, M.seal, [0, 0, 0.008], [0, 0, -0.5], [0.85, 0.85, 1]).userData.inkGroup = SEAL + 1;
  }

  // ── Wings: two large triangles slanting upward, with one crease down the middle (two faces); the front is cream letter paper covered with writing and the underside is pale blue airmail paper ──
  const wings: { g: THREE.Group; sx: number }[] = [];
  const wingTips: THREE.Group[] = [];
  const TH = 0.012;
  for (const sx of [-1, 1]) {
    const wg = group(crane, [0, 0.075, 0]);
    // The crease in the middle arches up (a mountain fold), the front and back faces slanting forward-up and back-up respectively, so the wing's face shows from the front too
    const RF = v3(0, -0.005, 0.17);
    const RB = v3(0, -0.005, -0.17);
    const CR = v3(0, 0.1, 0);
    const W = v3(sx * 0.62, 0.3, -0.16);
    const verts = [RF, W, CR, RB];
    add(wg, paperSheet(verts, [[0, 1, 2], [2, 1, 3]], TH, UP, CREAM, AIR), M.paper).userData.inkGroup = WING + (sx > 0 ? 0 : 10);
    // Writing: rows of short line segments parallel to the wing's leading edge (or trailing edge), of uneven length like words, laid on the front face
    const pos: number[] = [];
    const idx: number[] = [];
    const writeOn = (o: THREE.Vector3, ea: THREE.Vector3, eb: THREE.Vector3, rows: number[]) => {
      const n = ea.clone().cross(eb).normalize();
      const flip = n.y < 0;
      if (flip) n.negate();
      // Normal offset of each vertex on that face (along the average normal, as in paperSheet); here the face normal is used directly with a little extra float
      const off = n.clone().multiplyScalar(TH / 2 + 0.0015);
      const hgt = eb.clone().addScaledVector(ea.clone().normalize(), -eb.dot(ea.clone().normalize())).length();
      const db = 0.0075 / hgt;
      for (const b of rows) {
        let a = 0.08 + rand() * 0.04;
        const aEnd = 1 - b - 0.06;
        while (a < aEnd - 0.03) {
          const len = Math.min(aEnd - a, 0.05 + rand() * 0.12);
          const q = (aa: number, bb: number) => o.clone().addScaledVector(ea, aa).addScaledVector(eb, bb).add(off);
          const base = pos.length / 3;
          for (const p of [q(a, b - db), q(a + len, b - db), q(a + len, b + db), q(a, b + db)]) pos.push(p.x, p.y, p.z);
          if (flip) idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
          else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          a += len + 0.03 + rand() * 0.02;
        }
      }
    };
    writeOn(RF, W.clone().sub(RF), CR.clone().sub(RF), [0.16, 0.34, 0.52, 0.7]);
    writeOn(RB, W.clone().sub(RB), CR.clone().sub(RB), [0.2, 0.4, 0.6]);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tg.setIndex(idx);
    tg.computeVertexNormals();
    add(wg, tg, M.ink).userData.inkGroup = WING + (sx > 0 ? 0 : 10);
    wings.push({ g: wg, sx });
    wingTips.push(group(wg, [W.x, W.y + 0.01, W.z]));
  }
  // Back: the stamp is stuck on the face behind the root of the right wing (perforated edge, a red sun painted on it)
  {
    const wg = wings.find((w) => w.sx > 0)!.g;
    const RB = v3(0, -0.005, -0.17);
    const CR = v3(0, 0.1, 0);
    const W = v3(0.62, 0.3, -0.16);
    const n = CR.clone().sub(RB).cross(W.clone().sub(RB)).normalize();
    if (n.y < 0) n.negate();
    const at = RB.clone().multiplyScalar(0.45).addScaledVector(CR, 0.25).addScaledVector(W, 0.3).addScaledVector(n, TH / 2 + 0.002);
    const sg = group(wg, [at.x, at.y, at.z]);
    const xx = W.clone().sub(RB).normalize();
    const yy = new THREE.Vector3().crossVectors(n, xx);
    sg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xx, yy, n));
    sg.rotateZ(0.2);
    const stamp = (w: number, h: number, bumps: number) => {
      const s = new THREE.Shape();
      const pts: [number, number][] = [];
      const edge = (x0: number, y0: number, x1: number, y1: number, k: number) => {
        for (let i = 0; i < k * 4; i++) {
          const t = i / (k * 4);
          const d = 0.0035 * Math.abs(Math.sin(t * k * PI));
          const nx = -(y1 - y0);
          const ny = x1 - x0;
          const l = Math.hypot(nx, ny);
          pts.push([lerp(x0, x1, t) - (nx / l) * d, lerp(y0, y1, t) - (ny / l) * d]);
        }
      };
      edge(-w / 2, -h / 2, w / 2, -h / 2, bumps);
      edge(w / 2, -h / 2, w / 2, h / 2, Math.round((bumps * h) / w));
      edge(w / 2, h / 2, -w / 2, h / 2, bumps);
      edge(-w / 2, h / 2, -w / 2, -h / 2, Math.round((bumps * h) / w));
      s.moveTo(...pts[0]);
      for (const p of pts.slice(1)) s.lineTo(...p);
      return new THREE.ShapeGeometry(s, 1);
    };
    const tint = (g: THREE.BufferGeometry, c: THREE.Color) => {
      const k = g.attributes.position.count;
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(k).fill(0).flatMap(() => [c.r, c.g, c.b]), 3));
      g.deleteAttribute('uv');
      return g;
    };
    add(sg, tint(stamp(0.075, 0.09, 6), col(0xf8f2e2)), M.paper).userData.inkGroup = WING + 20;
    add(sg, tint(new THREE.PlaneGeometry(0.052, 0.066), col(0x3a9a94)), M.paper, [0, 0, 0.0015]).userData.inkGroup = WING + 20;
    add(sg, tint(new THREE.CircleGeometry(0.014, 12), col(0xe0504a)), M.paper, [0.004, 0.008, 0.003]).userData.inkGroup = WING + 20;
    add(sg, tint(new THREE.PlaneGeometry(0.04, 0.006), col(0xf8f2e2)), M.paper, [0, -0.018, 0.003]).userData.inkGroup = WING + 20;
  }

  // ── String of a thousand cranes: a red thread hanging from the keel, strung with three small paper cranes in red, gold and cyan, with a gold bead and a bunch of red tassel at the bottom ──
  const strand = group(float, [0, K.y * S, 0]);
  const minis: { g: THREE.Group; ph: number }[] = [];
  const STRAND_LEN = 0.58;
  {
    const threadGeo = loft([v3(0, 0.02, 0), v3(0, -STRAND_LEN * 0.5, 0), v3(0, -STRAND_LEN, 0)], () => [0.0075, 0.0075], { segs: 6, radial: 6 });
    const thr = col(0xc83a3a);
    const tint = (g: THREE.BufferGeometry, c: THREE.Color) => {
      const k = g.attributes.position.count;
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(k).fill(0).flatMap(() => [c.r, c.g, c.b]), 3));
      return g;
    };
    add(strand, tint(threadGeo, thr), M.thread).userData.inkGroup = STRING;
    const colors: [number, number][] = [[0xe0504e, 0xf4a8a0], [0xf0b848, 0xf8e0a0], [0x3aa6a0, 0xa8dcd6]];
    colors.forEach(([top, bot], i) => {
      const y = -0.13 - i * 0.15;
      const mg = group(strand, [0, y, 0], [0, i * 1.9 + 0.4, 0]);
      const s = 0.3;
      const ct = col(top);
      const cb = col(bot);
      const mc = (n: THREE.Vector3) => ct.clone().lerp(cb, Math.max(0, -n.y) * 0.7);
      const sc = (p: THREE.Vector3) => p.clone().multiplyScalar(s);
      add(mg, facets([[F, T, L], [T, B, L], [F, L, K], [L, B, K], [F, R, T], [T, R, B], [F, K, R], [R, K, B]].map((t) => t.map(sc) as Tri), v3(0, -0.02 * s, 0), mc), M.paper).userData.inkGroup = STRING + 1 + i;
      add(mg, spike(sc(v3(0, -0.1, 0.13)), sc(v3(0, 0.02, 0.16)), sc(v3(0, 0.36, 0.4)), 0.02 * s, mc), M.paper).userData.inkGroup = STRING + 1 + i;
      add(mg, spike(sc(v3(0, -0.1, -0.13)), sc(v3(0, 0.02, -0.16)), sc(v3(0, 0.38, -0.42)), 0.02 * s, mc), M.paper).userData.inkGroup = STRING + 1 + i;
      for (const sx of [-1, 1]) {
        const verts = [v3(0, 0.07, 0.14), v3(sx * 0.6, 0.26, -0.1), v3(0, 0.1, 0), v3(0, 0.07, -0.14)].map(sc);
        add(mg, paperSheet(verts, [[0, 1, 2], [2, 1, 3]], 0.012, UP, ct, cb), M.paper).userData.inkGroup = STRING + 1 + i;
      }
      minis.push({ g: mg, ph: i * 1.7 });
    });
    const gold = col(0xe8c060);
    add(strand, tint(new THREE.SphereGeometry(0.022, 10, 8), gold), M.thread, [0, -STRAND_LEN + 0.02, 0]).userData.inkGroup = STRING + 5;
    // Tassel: a bunch of red threads fanning out downward (a lathe body, the bottom edge rounded into a lip), with a ring of gold binding thread at the top
    const tas = lathe([[0.001, -0.14], [0.03, -0.138], [0.036, -0.12], [0.024, -0.04], [0.012, -0.004], [0.001, 0.0]], 12);
    const tp = tas.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < tp.count; i++) {
      const a = Math.atan2(tp.getZ(i), tp.getX(i));
      const k = 1 + 0.12 * Math.max(0, Math.sin(a * 6)) * Math.min(1, -tp.getY(i) / 0.1);
      tp.setX(i, tp.getX(i) * k);
      tp.setZ(i, tp.getZ(i) * k);
    }
    tas.computeVertexNormals();
    add(strand, tint(tas, thr), M.thread, [0, -STRAND_LEN - 0.005, 0]).userData.inkGroup = STRING + 6;
    add(strand, tint(new THREE.TorusGeometry(0.014, 0.006, 6, 12), gold), M.thread, [0, -STRAND_LEN - 0.03, 0], [PI / 2, 0, 0]).userData.inkGroup = STRING + 7;
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle action: floating up and down, wings slowly fanning, head turning left and right looking for someone, the string of cranes swinging like wind chimes ──
  const act = { fold: 0 };
  const update = (t: number) => {
    float.position.y = 0.95 + Math.sin(t * 1.3) * 0.03;
    crane.rotation.z = Math.sin(t * 0.8) * 0.04;
    crane.rotation.x = Math.sin(t * 1.3 + 0.8) * 0.03;
    for (const { g, sx } of wings) g.rotation.z = sx * (Math.sin(t * 1.3 - 0.6) * 0.1 + act.fold * 0.7);
    head.rotation.y = Math.sin(t * 0.45) * 0.3;
    head.rotation.x = Math.sin(t * 0.9) * 0.06;
    strand.rotation.z = Math.sin(t * 1.3 - 1.2) * 0.05;
    strand.rotation.x = Math.sin(t * 0.9 - 0.4) * 0.04;
    for (const m of minis) m.g.rotation.y = m.ph + Math.sin(t * 0.7 + m.ph) * 0.5;
  };
  update(0);

  const face = group(head, [0, -0.01, 0.06]);
  const mouthA = group(head, [hFront.x, hFront.y, hFront.z]);
  const sealA = group(sealG, [0, 0, 0.012]);
  const tassel = group(strand, [0, -STRAND_LEN - 0.08, 0]);
  const rig = { head: face, eyes: [] as THREE.Object3D[], anchors: { mouth: mouthA, seal: sealA, wingL: wingTips[1], wingR: wingTips[0], tassel } };
  mergeStatic(root, {
    owners: [float, crane, head, strand, ...wings.map((w) => w.g), ...minis.map((m) => m.g)],
    twins: [[M.ink, M.paper]],
    rig,
  });
  return { root, update, rig, act, center: new THREE.Vector3(0, 0.78, 0), radius: 0.9 };
}
