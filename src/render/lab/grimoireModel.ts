// Grimoire (model lab version, SR, neutral, mage / copy): a magic book in the forbidden library of the Starvault Sage Tower that turns its own pages. It records every spell it has seen, and never forgets.
// Only one form (decided by the user, 2026-09-28): the builder ignores the breakthrough stage, and the game scales this one shape up by its per-rarity height table.
//
// Identifying features:
//   1. A thick, half-open magic book floating in midair: wine-red leather cover, stamped with a raised border all around and a raised leather panel in the middle holding the emblem.
//   2. The cover emblem: a gold eight-pointed star ringed by a star ring, with four long rays extending up, down, left and right (the crest of the Starvault Sage Tower), and a faceted deep blue gem at the very center (the only emissive on the whole body).
//   3. Metal corner caps and clasp: gold corner caps with rivets at the four corners, and a gold clasp with a keyhole on the fore-edge side; the leather strap that originally fastened it runs from the back cover around the fore-edge and forward, with its holed gold tongue hanging in midair, unable to fasten (the book is open).
//   4. The paper layers at the fore-edge: the pages are split into six separate page blocks fanned open like a fan, with two single leaves lifting and falling on their own; there is also a loose sheet copied with spells floating above the fore-edge.
//   5. Bamboo-like bands on the spine (four raised cross bands), a deep blue ribbon bookmark reaching out from between the pages at the middle of the fore-edge and drifting toward the side and back in an S shape; at the lower corner of the back cover by the spine hang two broken lengths of iron chain (a chained book of the forbidden library, which broke free of its shelf).
// Body shape: the spine stands upright on its own right (-x) with the fore-edge toward +x; the cover opens only a crack (about thirty degrees). With the cover open the normal leans toward the spine side, so the whole book turns back by 0.8 radians,
//   with the cover facing forward and slightly right: in battle the enemy looks from the front biased toward +x and the portrait looks from the front biased toward -x, and both can see the emblem. The book body leans back and tilts slightly toward the spine side, like a raised chin.
// No face: a book is an object, so no eyes, mouth or brows are added, and no features are drawn on the cover (spirit-model-polish <Do not anthropomorphize>).
// Personality: a well-read, slightly arrogant volume: it will not lay itself open in full for you, only opening a crack to glance at you, and copying down the spells you have used.
//   Its posture is leaning back and slowly sweeping its gaze left and right; the cover opens and closes slightly like breathing, the single leaves at the fore-edge turn on their own; when it looks down on you it snaps the cover shut.
// Gaze order: the cover emblem and the sapphire first, the fanned-open pages at the fore-edge and the lifted single leaf second, and the ribbon, clasp and broken chain as support.
// Side: +x is the fore-edge, where you can see the cover and the fan the page blocks make, the lifted single leaf and the strap coming around; -x (the view of our side in battle) shows the four bands of the spine and the gold spine caps.
// Back: a diamond-shaped hot-stamped frame on the back cover, a gold plate with the library catalog number inside the frame, gold corner caps at the four corners, and an iron plate and ring at the lower corner by the spine hanging the broken iron chain (it broke free of the shelf in the forbidden library);
//   on the fore-edge side the page fan and the deep blue marbled endpaper on the inside of the cover show.
// Action table:
//   Idle: floats slowly up and down, leans back and slowly sweeps its gaze left and right; the cover opens and closes slightly; the single leaves at the fore-edge lift and fall in turn; the loose sheet drifts slowly above the fore-edge; the gem slowly flickers; the ribbon and broken chain swing along.
//   Move: the book body leans forward and the cover narrows, with the ribbon drifting back (the outer shell's forward lean plus a little act.shut).
//   Charge-up act.open: the cover opens fully, the page fan spreads wide and the gem brightens (act.glow).
//   Strike: releases the copied spells from the fore-edge (the mouth anchor).
//   Hit act.shut: the cover snaps shut and the whole book rears back.
//   Victory: the cover opens and closes once and the gem flashes once (act.open and act.glow are tweened by the performance).
// Anchors: head (center of the cover emblem), eyes is empty (no eyes), glow and crest (the sapphire, turning red when corrupted), mouth (where the fore-edge opens),
//   pages (the lifted single leaf), sheet (the floating loose sheet), chain (the end of the broken chain), spine (middle of the spine).

import * as THREE from 'three';
import { brilliant, frameShape, lathe, mergeStatic, partKit, PI, rbox, rng, slab, type LabModel } from './shapes.ts';
import { labToon } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const col = (c: THREE.ColorRepresentation) => new THREE.Color(c);
const ss = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

// ───────────────────────── Helpers ─────────────────────────

/** Write vertex colors by position and normal (the material must enable vertexColors, base color white) */
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
const flat = (c: THREE.ColorRepresentation) => {
  const k = col(c);
  return () => k;
};

/** Integrate a curved path along the midline: ang(s) is the tangent angle at s (0 along +x, bending toward +z is positive), returning sample points */
function bendPath(w: number, ang: (s: number) => number, N = 64): THREE.Vector3[] {
  const P: THREE.Vector3[] = [v(0, 0, 0)];
  for (let i = 1; i <= N; i++) {
    const a = ang(((i - 0.5) / N) * w);
    P.push(P[i - 1].clone().add(v(Math.cos(a), 0, Math.sin(a)).multiplyScalar(w / N)));
  }
  return P;
}

/**
 * A curved thin plate (page, strap, ribbon): along x from 0 to w, thickness along z. Each segment bends along the tangent angle ang(s), with the thickness direction turning along,
 * so both faces of the page are continuous curved surfaces and the shading and outlines do not break. BoxGeometry's uv is kept so the page can have text on it.
 */
function bendBox(w: number, h: number, th: number, ang: (s: number) => number, nx = 12, ny = 1): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, th, nx, ny, 1);
  g.translate(w / 2, 0, 0);
  const N = 64;
  const P = bendPath(w, ang, N);
  const pa = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) {
    const s = THREE.MathUtils.clamp(pa.getX(i), 0, w);
    const f = (s / w) * N;
    const k = Math.min(N - 1, Math.floor(f));
    const c = P[k].clone().lerp(P[k + 1], f - k);
    const a = ang(s);
    const z = pa.getZ(i);
    pa.setXYZ(i, c.x - Math.sin(a) * z, pa.getY(i), c.z + Math.cos(a) * z);
  }
  g.computeVertexNormals();
  return g;
}

/** Text on a page: lines of dark brown handwritten runes with a vermilion first character, and when diagram is true a star-ring diagram is drawn in the middle. Without a document (measuring face counts in node) it is not applied */
function pageTexture(seed: number, diagram: boolean): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const W = 256;
  const H = 352;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const x = cv.getContext('2d');
  if (!x) return null;
  x.fillStyle = '#f4e9d0';
  x.fillRect(0, 0, W, H);
  const gr = x.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.78);
  gr.addColorStop(0, 'rgba(160,120,70,0)');
  gr.addColorStop(1, 'rgba(160,120,70,0.28)');
  x.fillStyle = gr;
  x.fillRect(0, 0, W, H);
  const r = rng(seed);
  x.lineCap = 'round';
  x.lineJoin = 'round';
  const M = 30;
  const glyphRow = (y: number, x0: number, x1: number) => {
    let cx = x0;
    while (cx < x1 - 10) {
      const word = 2 + Math.floor(r() * 4);
      for (let k = 0; k < word && cx < x1 - 8; k++) {
        const w = 7 + r() * 5;
        x.beginPath();
        const kind = Math.floor(r() * 4);
        if (kind === 0) {
          x.moveTo(cx, y + 5);
          x.lineTo(cx + w * 0.5, y - 6);
          x.lineTo(cx + w, y + 5);
        } else if (kind === 1) {
          x.moveTo(cx, y - 5);
          x.lineTo(cx, y + 5);
          x.lineTo(cx + w, y + 2);
        } else if (kind === 2) {
          x.arc(cx + w / 2, y, w / 2, PI * 0.2, PI * 1.8);
        } else {
          x.moveTo(cx, y);
          x.lineTo(cx + w, y - 4);
          x.moveTo(cx + w * 0.5, y - 6);
          x.lineTo(cx + w * 0.5, y + 6);
        }
        x.stroke();
        cx += w + 3;
      }
      cx += 9;
    }
  };
  x.strokeStyle = '#6b4634';
  x.lineWidth = 2.6;
  if (diagram) {
    // Star-ring diagram: two circles, an eight-pointed star and tick marks, the same figure as the cover's tower crest
    const cx = W / 2;
    const cy = H * 0.42;
    x.strokeStyle = '#7a3a2e';
    x.lineWidth = 3;
    x.beginPath();
    x.arc(cx, cy, 70, 0, PI * 2);
    x.stroke();
    x.lineWidth = 2;
    x.beginPath();
    x.arc(cx, cy, 56, 0, PI * 2);
    x.stroke();
    x.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * PI * 2 - PI / 2;
      const rr = i % 2 ? 22 : 54;
      if (i) x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * PI * 2;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * 56, cy + Math.sin(a) * 56);
      x.lineTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70);
      x.stroke();
    }
    x.strokeStyle = '#6b4634';
    x.lineWidth = 2.6;
    for (let y = 48; y < cy - 80; y += 26) glyphRow(y, M, W - M);
    for (let y = cy + 94; y < H - 26; y += 26) glyphRow(y, M, W - M);
  } else {
    // Vermilion first character
    x.fillStyle = '#9c2f2a';
    x.fillRect(M, 36, 40, 44);
    x.strokeStyle = '#f0d9a0';
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(M + 10, 70);
    x.lineTo(M + 20, 44);
    x.lineTo(M + 30, 70);
    x.moveTo(M + 14, 60);
    x.lineTo(M + 26, 60);
    x.stroke();
    x.strokeStyle = '#6b4634';
    x.lineWidth = 2.6;
    let y = 46;
    for (; y < 90; y += 24) glyphRow(y, M + 50, W - M);
    for (; y < H - 26; y += 24) glyphRow(y, M, W - M);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Marbling on the endpaper: a deep blue ground, with pale blue and ochre-gold fine veins combed into arcs */
function marbleTexture(seed: number): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const W = 256;
  const H = 352;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const x = cv.getContext('2d');
  if (!x) return null;
  x.fillStyle = '#2b3c74';
  x.fillRect(0, 0, W, H);
  const r = rng(seed);
  const cols = ['#4d66a8', '#1d2a58', '#c89a48', '#6d84c0'];
  for (let i = 0; i < 70; i++) {
    x.strokeStyle = cols[i % cols.length];
    x.lineWidth = i % cols.length === 2 ? 1.6 : 2 + r() * 5;
    x.globalAlpha = 0.75;
    const y0 = r() * H;
    const amp = 10 + r() * 22;
    const fr = 0.02 + r() * 0.03;
    const ph = r() * 6;
    x.beginPath();
    for (let px = -10; px <= W + 10; px += 6) {
      const py = y0 + Math.sin(px * fr + ph) * amp + Math.sin(px * 0.11 + ph * 2) * 4;
      if (px < -5) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.stroke();
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ───────────────────────── Shape ─────────────────────────

export function buildGrimoireLab(): LabModel {
  const RIMC = 0xffe0cc;
  const vc = <T extends THREE.MeshToonMaterial>(m: T): T => {
    m.vertexColors = true;
    return m;
  };
  const M = {
    leather: vc(labToon(0xffffff, { speckle: 0.07, rim: 0.5, rimColor: RIMC, spec: 0.12, specTh: 0.985 })),
    gold: labToon(0xd8a444, { ramp: 'metal', spec: 1.2, specTh: 0.9, rim: 0.5, rimColor: 0xffe6b0 }),
    iron: labToon(0x6d6a78, { ramp: 'metal', spec: 0.9, specTh: 0.93, rim: 0.45, rimColor: 0xd8e4ff }),
    paper: vc(labToon(0xffffff, { rim: 0.35, rimColor: 0xfff4e0 })),
    leafA: labToon(0xffffff, { rim: 0.35, rimColor: 0xfff4e0 }),
    leafB: labToon(0xffffff, { rim: 0.35, rimColor: 0xfff4e0 }),
    ribbonB: labToon(0x2f4f9e, { rim: 0.5, rimColor: 0xc8d8ff }),
    endpaper: labToon(0xffffff, { rim: 0.3, rimColor: 0xc8d8ff }),
    gem: labToon(0x4f7dff, { ramp: 'gem', emissive: 0x2a58ff, emissiveAmt: 0.55, spec: 1.4, specTh: 0.9, rim: 0.3, rimColor: 0xc8d8ff }),
  };
  for (const [k, m] of Object.entries(M)) m.name ||= k;
  const texA = pageTexture(17, false);
  const texB = pageTexture(41, true);
  if (texA) M.leafA.map = texA;
  if (texB) M.leafB.map = texB;
  const texM = marbleTexture(7);
  if (texM) M.endpaper.map = texM;
  else M.endpaper.color.set(0x2c3f78);

  const root = new THREE.Group();
  root.name = 'grimoire-lab';
  const { add, group, rivet } = partKit();

  // Dimensions: the page block's width PW (spine to fore-edge), height PH, thickness T; the cover board is a ring larger than the page block (the book's "square")
  const PW = 0.6;
  const PH = 0.8;
  const T = 0.17;
  const CT = 0.034;
  const BW = 0.645;
  const BH = 0.87;
  const XS = -0.32;
  const RS = T / 2 + CT;

  // Leather colors: wine-red cover, a darker border and bands, and darker still where the edges are worn
  const cLea = col(0x7c2335);
  const cLeaDk = col(0x5a1727);
  const cLeaSp = col(0x6b1d2d);
  const leather = (base: THREE.Color, wear = 0.25) => (_p: THREE.Vector3, n: THREE.Vector3) => base.clone().lerp(cLeaDk, ss(1 - Math.abs(n.z), 0.4, 0.9) * wear);

  const hover = group(root, [0, 0.8, 0]);
  const book = group(hover);

  // ── Spine: a half-cylinder of leather, four bands, with a gold spine cap at top and bottom ──
  {
    const s = new THREE.Shape();
    s.moveTo(0, -RS);
    s.absarc(0, 0, RS, -PI / 2, PI / 2, true);
    s.lineTo(0, -RS);
    const g = slab(s, BH - 0.012, 0.006, 16).rotateX(-PI / 2);
    add(book, paint(g, leather(cLeaSp, 0.15)), M.leather, [XS, 0, 0]);
    for (const y of [-0.3, -0.1, 0.1, 0.3]) {
      const b = new THREE.Shape();
      b.moveTo(0, -RS - 0.004);
      b.absarc(0, 0, RS + 0.016, -PI / 2, PI / 2, true);
      b.lineTo(0, RS + 0.004);
      b.absarc(0, 0, RS - 0.006, PI / 2, -PI / 2, false);
      add(book, paint(slab(b, 0.022, 0.006, 16).rotateX(-PI / 2), leather(cLeaDk, 0.1)), M.leather, [XS, y, 0]);
    }
    for (const sy of [-1, 1]) {
      const c = new THREE.Shape();
      c.moveTo(0, -RS - 0.006);
      c.absarc(0, 0, RS + 0.006, -PI / 2, PI / 2, true);
      c.lineTo(0, -RS - 0.006);
      add(book, slab(c, 0.012, 0.004, 14).rotateX(-PI / 2), M.gold, [XS - 0.002, sy * (BH / 2 - 0.004), 0]);
    }
  }

  // ── Cover board (shared by front and back): a beveled leather board, a raised border and gold corner caps at the four corners ──
  const cornerShape = (L: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(L, 0);
    s.quadraticCurveTo(L * 0.3, L * 0.3, 0, L);
    s.lineTo(0, 0);
    return s;
  };
  /** Build a board in the cover group: the board occupies x 0..BW and z 0..CT*dir (dir 1 toward +z is the cover, -1 the back cover), with the outer face at z = CT*dir */
  const board = (g: THREE.Group, dir: 1 | -1) => {
    const oz = CT * dir;
    add(g, paint(rbox(BW, BH, CT, 0.012, 2), leather(cLea)), M.leather, [BW / 2, 0, oz / 2]);
    // Raised border (a ring pressed onto the leather)
    const fr = slab(frameShape(BW - 0.06, BH - 0.06, BW - 0.1, BH - 0.1, 0.03), 0.006, 0.003, 6);
    add(g, paint(fr, leather(cLeaDk, 0.1)), M.leather, [BW / 2, 0, oz + dir * 0.004]);
    // Four corners: the two fore-edge corners have gold caps wrapping the board edge, and all four corners have gold plates and rivets pressed on the face
    const L = 0.12;
    for (const [cx, cy, rot] of [[BW, BH / 2, PI], [0, BH / 2, -PI / 2], [0, -BH / 2, 0], [BW, -BH / 2, PI / 2]] as [number, number, number][]) {
      const edge = cx > 0;
      // The back cover seen from outside is a mirror image: use the corner turn of the opposite corner, turned another half turn about y (no negative scale, so the triangles need not be flipped)
      const partner: Record<number, number> = { [PI]: -PI / 2, [-PI / 2]: PI, 0: PI / 2, [PI / 2]: 0 };
      const piece = slab(cornerShape(edge ? L : L * 0.8), 0.006, 0.003, 8).rotateZ(dir > 0 ? rot : partner[rot]);
      if (dir < 0) piece.rotateY(PI);
      add(g, piece, M.gold, [cx + (edge ? -0.004 : 0.006), cy + (cy > 0 ? -0.004 : 0.004), oz + dir * 0.005]);
      if (edge) add(g, rbox(0.05, 0.05, CT + 0.012, 0.01, 2), M.gold, [cx - 0.019, cy + (cy > 0 ? -0.019 : 0.019), oz / 2]);
      const inX = edge ? -1 : 1;
      const inY = cy > 0 ? -1 : 1;
      rivet(g, M.gold, [cx + inX * 0.04, cy + inY * 0.04, oz + dir * 0.012], [0, 0, dir], 0.011);
    }
  };

  // ── Back cover: the pivot is on the inside of the spine, spread slightly backward; the library gold plate, iron ring, broken chain and the hanging strap ──
  const backC = group(book, [XS, 0, -T / 2]);
  board(backC, -1);
  // A diamond-shaped border is pressed in the middle of the back cover (hot-stamped leather pattern), and inside the frame is a gold plate with the library catalog number (four rivets, with three cross lines carved in the middle)
  {
    const dia = (w: number, h: number) => [[0, h], [w, 0], [0, -h], [-w, 0]] as [number, number][];
    const o = new THREE.Shape();
    const [a, b, c, d] = dia(0.2, 0.27);
    o.moveTo(...a);
    o.lineTo(...b);
    o.lineTo(...c);
    o.lineTo(...d);
    o.closePath();
    const h = new THREE.Path();
    const [e, f, g2, k] = dia(0.165, 0.225);
    h.moveTo(...e);
    h.lineTo(...k);
    h.lineTo(...g2);
    h.lineTo(...f);
    h.closePath();
    o.holes.push(h);
    add(backC, paint(slab(o, 0.006, 0.003, 4), leather(cLeaDk, 0.1)), M.leather, [BW / 2, 0.0, -CT - 0.004]);
    const plate = group(backC, [BW / 2, 0.0, -CT - 0.008]);
    add(plate, rbox(0.17, 0.085, 0.01, 0.004, 2), M.gold);
    for (const x of [-0.068, 0.068]) for (const y of [-0.026, 0.026]) rivet(plate, M.gold, [x, y, -0.006], [0, 0, -1], 0.007);
    for (const y of [-0.018, 0, 0.018]) add(plate, rbox(0.09, 0.007, 0.006, 0.002, 1), M.gold, [0, y, -0.005]);
  }
  // The iron plate and iron ring of the chain: nailed on the outside of the back cover at the lower corner by the spine, with the broken chain hanging down against the back cover, ending above the bottom of the book (hidden by the book from the front and visible only from the back)
  const CH = v(0.11, -BH / 2 + 0.15, -CT);
  add(backC, rbox(0.07, 0.07, 0.01, 0.004, 2), M.iron, [CH.x, CH.y, CH.z - 0.004]);
  for (const x of [-0.022, 0.022]) rivet(backC, M.iron, [CH.x + x, CH.y + 0.02, CH.z - 0.009], [0, 0, -1], 0.008);
  const chainG = group(backC, [CH.x, CH.y - 0.03, CH.z - 0.024]);
  add(chainG, new THREE.TorusGeometry(0.022, 0.0075, 6, 14), M.iron, [0, 0, 0], [0, PI / 2, 0]);
  const links: THREE.Group[] = [];
  {
    // Links hang down one after another, each turned 90 degrees to hook the previous one; the last link is broken, with the gap facing down
    const NL = 2;
    const LR = 0.024;
    const LT = 0.0085;
    const GAP = PI * 0.55;
    const a0 = -PI / 2 + GAP / 2;
    let parent: THREE.Object3D = chainG;
    for (let k = 0; k < NL; k++) {
      const lg = group(parent, [0, k === 0 ? -0.034 : -0.056, 0]);
      const last = k === NL - 1;
      const ry = k % 2 ? 0 : PI / 2;
      const tg = new THREE.TorusGeometry(LR, LT, 6, 14, last ? PI * 2 - GAP : PI * 2);
      if (last) tg.rotateZ(a0);
      tg.scale(1, 1.4, 1).rotateY(ry);
      add(lg, tg, M.iron, [0, -0.028, 0]);
      if (last)
        for (const a of [a0, a0 + PI * 2 - GAP]) {
          const e = new THREE.SphereGeometry(LT, 8, 6);
          const p = v(Math.cos(a) * LR, Math.sin(a) * LR * 1.4, 0).applyAxisAngle(v(0, 1, 0), ry);
          add(lg, e, M.iron, [p.x, p.y - 0.028, p.z]);
        }
      links.push(lg);
      parent = lg;
    }
  }
  // Strap: running along the back cover toward the fore-edge, around the board edge at the fore-edge and forward, ending in a holed gold tongue (unable to fasten the cover's clasp, because the book is open)
  const STRAP_L = 0.3;
  const strapAng = (s: number) => ss(s, 0.095, 0.16) * (PI / 2) + ss(s, 0.22, 0.3) * 0.45;
  const strapG = group(backC, [BW - 0.1, -0.2, -CT - 0.0055]);
  {
    add(strapG, paint(bendBox(STRAP_L, 0.052, 0.011, strapAng, 20, 1), leather(cLeaDk, 0.1)), M.leather);
    const P = bendPath(STRAP_L, strapAng);
    const end = P[P.length - 1];
    const a = strapAng(STRAP_L);
    const tg = v(Math.cos(a), 0, Math.sin(a));
    const hasp = group(strapG, [end.x, 0, end.z]);
    hasp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(v(0, 1, 0), tg.clone().negate(), v(-Math.sin(a), 0, Math.cos(a))));
    const hs = new THREE.Shape();
    hs.moveTo(-0.03, 0.014);
    hs.lineTo(0.03, 0.014);
    hs.lineTo(0.026, -0.04);
    hs.quadraticCurveTo(0, -0.075, -0.026, -0.04);
    hs.lineTo(-0.03, 0.014);
    const hole = new THREE.Path();
    hole.absarc(0, -0.034, 0.01, 0, PI * 2, true);
    hs.holes.push(hole);
    add(hasp, slab(hs, 0.008, 0.004, 10), M.gold);
    rivet(hasp, M.gold, [0, 0.0, 0.01], [0, 0, 1], 0.008);
  }

  // ── Page blocks: six separate stacks of paper, fanned open about the spine; the fore-edge and the top and bottom edges are old yellow and the page faces cream ──
  const NB = 6;
  const blocks: { g: THREE.Group; u: number }[] = [];
  const cPage = col(0xf2e7cd);
  const cEdge = [col(0xe4d2ab), col(0xdcc79d)];
  for (let i = 0; i < NB; i++) {
    const zi = -T / 2 + ((i + 0.5) * T) / NB;
    const g = group(book, [XS, 0, zi]);
    const tb = T / NB - 0.006;
    const edgeC = cEdge[i % 2];
    add(g, paint(rbox(PW, PH, tb, 0.006, 2), (_p, n) => cPage.clone().lerp(edgeC, ss(1 - Math.abs(n.z), 0.3, 0.8))), M.paper, [PW / 2 + 0.006, 0, 0]);
    blocks.push({ g, u: (i + 0.5) / NB });
  }

  // ── Lifted single leaves: two, with the pivot at the spine; they lift and fall on their own. Each frame recomputes the bend on the CPU by the distance from the spine (about a hundred-odd vertices per leaf) ──
  const LW = PW - 0.01;
  const LH = PH - 0.02;
  interface Leaf { g: THREE.Group; m: THREE.Mesh; base: Float32Array; k: number; ph: number }
  const leaves: Leaf[] = [];
  const leafShape = (k: number) => (s: number) => {
    // k 0: lying against the page block; k 1: lifted to the highest, with the half near the fore-edge curling up
    const u = s / LW;
    return k * (0.2 * u + 0.8 * u * u);
  };
  const bendLeaf = (L: Leaf, k: number) => {
    if (Math.abs(L.k - k) < 1e-3) return;
    L.k = k;
    const ang = leafShape(k);
    const N = 32;
    const P = bendPath(LW, ang, N);
    const pa = L.m.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) {
      const s = THREE.MathUtils.clamp(L.base[i * 3], 0, LW);
      const f = (s / LW) * N;
      const j = Math.min(N - 1, Math.floor(f));
      const c = P[j].clone().lerp(P[j + 1], f - j);
      const a = ang(s);
      const z = L.base[i * 3 + 2];
      pa.setXYZ(i, c.x - Math.sin(a) * z, L.base[i * 3 + 1], c.z + Math.cos(a) * z);
    }
    pa.needsUpdate = true;
    L.m.geometry.computeVertexNormals();
  };
  for (let j = 0; j < 2; j++) {
    const g = group(book, [XS, 0, T / 2 - 0.004]);
    const geo = new THREE.BoxGeometry(LW, LH, 0.006, 14, 1, 1);
    geo.translate(LW / 2, 0, 0);
    (geo.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    const m = add(g, geo, j ? M.leafB : M.leafA, [0.008, 0, 0]);
    m.frustumCulled = false;
    const L: Leaf = { g, m, base: (geo.attributes.position.array as Float32Array).slice(), k: -1, ph: j * 0.5 };
    bendLeaf(L, 0);
    leaves.push(L);
  }

  // ── Cover: the pivot is on the inside of the spine, opened only a crack ──
  const front = group(book, [XS, 0, T / 2]);
  board(front, 1);
  // The endpaper on the inside of the cover: deep blue marbled paper (the same color family as the gem), with a ring of leather left at the edge
  {
    const ep = new THREE.BoxGeometry(BW - 0.05, BH - 0.05, 0.003, 1, 1, 1);
    add(front, ep, M.endpaper, [BW / 2 + 0.005, 0, -0.0016]);
  }
  const FC = v(BW / 2 + 0.01, 0.02, CT);
  // The raised leather panel holds the emblem
  add(front, paint(lathe([[0.2, 0], [0.19, 0.008], [0.165, 0.016], [0.001, 0.02]], 32).rotateX(PI / 2), leather(cLea, 0.05)), M.leather, [FC.x, FC.y, FC.z - 0.004]);
  // Emblem: star ring, eight-pointed star, four long rays and the gem seat
  const emblem = group(front, [FC.x, FC.y, FC.z + 0.014]);
  {
    const ring = new THREE.Shape();
    ring.absarc(0, 0, 0.13, 0, PI * 2, false);
    const h = new THREE.Path();
    h.absarc(0, 0, 0.104, 0, PI * 2, true);
    ring.holes.push(h);
    add(emblem, slab(ring, 0.008, 0.004, 40), M.gold, [0, 0, 0.002]);
    const star: [number, number][] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * PI * 2 + PI / 2;
      const r = i % 2 ? 0.046 : 0.1;
      star.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const st = new THREE.Shape();
    st.moveTo(...star[0]);
    for (const p of star.slice(1)) st.lineTo(...p);
    st.closePath();
    add(emblem, slab(st, 0.006, 0.004, 4), M.gold, [0, 0, 0.004]);
    // The four long rays extend outward from the star ring, slanting down along the raised leather panel
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Shape();
      r.moveTo(0, 0);
      r.lineTo(0.02, 0.03);
      r.lineTo(0, i % 2 ? 0.07 : 0.11);
      r.lineTo(-0.02, 0.03);
      r.closePath();
      const rg = group(emblem, [0, 0, 0], [0, 0, (i * PI) / 2]);
      add(rg, slab(r, 0.006, 0.003, 4), M.gold, [0, 0.126, -0.004], [-0.12, 0, 0]);
    }
    add(emblem, lathe([[0.062, -0.006], [0.07, 0.004], [0.066, 0.016], [0.054, 0.02]], 20).rotateX(PI / 2), M.gold, [0, 0, 0.004]);
  }
  const gemG = group(emblem, [0, 0, 0.022]);
  add(gemG, brilliant(0.054, 0.042, 0.022, 10).rotateX(PI / 2), M.gem);
  // Clasp: a gold plate in the middle of the fore-edge side, with the keyhole showing the dark leather underneath
  {
    const ls = new THREE.Shape();
    const w = 0.04;
    ls.moveTo(-w, -0.06);
    ls.lineTo(w, -0.06);
    ls.lineTo(w, 0.05);
    ls.quadraticCurveTo(0, 0.085, -w, 0.05);
    ls.lineTo(-w, -0.06);
    const kh = new THREE.Path();
    kh.moveTo(-0.006, -0.032);
    kh.lineTo(0.006, -0.032);
    kh.lineTo(0.004, 0.0);
    kh.absarc(0, 0.01, 0.011, -1.2, PI + 1.2, false);
    kh.lineTo(-0.006, -0.032);
    ls.holes.push(kh);
    add(front, slab(ls, 0.008, 0.004, 10), M.gold, [BW - 0.05, 0.0, CT + 0.008]);
    // A piece of dark leather is laid under the clasp, so the keyhole has depth
    add(front, paint(rbox(0.07, 0.1, 0.004, 0.002, 1), flat(0x2a0e14)), M.leather, [BW - 0.05, 0.0, CT + 0.003]);
    for (const y of [-0.045, 0.045]) rivet(front, M.gold, [BW - 0.05 + (y > 0 ? 0 : 0), y, CT + 0.016], [0, 0, 1], 0.007);
  }

  // ── Ribbon bookmark: only one is kept. Anything hanging down below the book (two parallel ribbons, or one curved ribbon plus a short piece of chain) looks like legs when shrunk;
  //   the one that goes over the upper corner of the spine from the top of the pages forms a loop with the top of the book, like the handle of a handbag. So it comes only out of the fore-edge and drifts toward the side and back.
  /** A ribbon along a curve: the width direction is wid(s) (with the tangent component removed), thickness th, with a swallowtail cut at the end */
  const ribbonGeo = (pts: THREE.Vector3[], w: number, th: number, wid: (s: number) => THREE.Vector3, N = 28) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const L = curve.getLength();
    const g = new THREE.BoxGeometry(w, 1, th, 2, N, 1);
    g.translate(0, -0.5, 0);
    const p = g.attributes.position as THREE.BufferAttribute;
    const n = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      let s = THREE.MathUtils.clamp(-p.getY(i), 0, 1);
      if (Math.abs(x) < 1e-6 && s > 1 - 1e-6) s = 1 - (w * 0.9) / L;
      const c = curve.getPointAt(s);
      const tg = curve.getTangentAt(s);
      const wd = wid(s).clone();
      wd.addScaledVector(tg, -wd.dot(tg)).normalize();
      n.crossVectors(tg, wd);
      p.setXYZ(i, c.x + wd.x * x + n.x * z, c.y + wd.y * x + n.y * z, c.z + wd.z * x + n.z * z);
    }
    g.computeVertexNormals();
    return g;
  };
  // Deep blue: reaching out from between the pages at the middle of the fore-edge, drifting toward the side and back in an S shape and curling slightly upward, like a bookmark blown out of the pages by the wind.
  //   When tucked between pages its width runs along the page height (y), so bending in the horizontal plane follows the ribbon's own bend; it is also twisted a little along the way
  const ribbon = group(blocks[3].g, [PW - 0.02, 0.04, 0.0]);
  {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      pts.push(v(0.4 * u, 0.1 * u ** 1.6, -0.1 * u + 0.04 * Math.sin(PI * 2 * 1.1 * u)));
    }
    add(ribbon, ribbonGeo(pts, 0.04, 0.012, (s) => v(0, Math.cos(0.9 * s), Math.sin(0.9 * s))), M.ribbonB);
  }

  // ── Floating loose sheet: a sheet of paper copied with spells, floating up from above the fore-edge; slanting forward and outward, so the paper face can be seen from all four views ──
  const SW = 0.22;
  const sheet = group(hover, [0.42, 0.56, -0.05]);
  const sheetIn = group(sheet);
  {
    // The paper is rolled into a shallow C shape: from the side it is an arc too, not a stick
    const g = bendBox(SW, 0.28, 0.005, (s) => -0.8 + 1.6 * (s / SW), 14, 1);
    g.computeBoundingBox();
    const c = g.boundingBox!.getCenter(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z);
    add(sheetIn, g, M.leafB);
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  const rig = {
    head: group(emblem, [0, 0, 0.03]),
    eyes: [] as THREE.Object3D[],
    anchors: {
      glow: group(gemG, [0, 0, 0.02]),
      crest: group(gemG, [0, 0, 0.02]),
      mouth: group(blocks[NB - 1].g, [PW + 0.02, 0.05, 0.06]),
      pages: group(leaves[0].g, [PW * 0.6, 0.1, 0.05]),
      sheet: group(sheetIn),
      chain: group(links[links.length - 1], [0, -0.06, 0]),
      spine: group(book, [XS - RS, 0, 0]),
    },
  };
  const act = { open: 0, glow: 0, shut: 0 };

  mergeStatic(root, {
    owners: [hover, book, front, backC, chainG, ...links, strapG, sheet, sheetIn, ...blocks.map((b) => b.g), ...leaves.map((l) => l.g), ribbon],
    keep: [gemG, ...leaves.map((l) => l.m)],
    rig,
  });

  // Hanging things (ribbon, broken chain): compute the direction of world "down" within the parent node, aim the group's -y at it, and then multiply in the swing
  const DOWN = v(0, -1, 0);
  const _q = new THREE.Quaternion();
  const _qs = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _d = new THREE.Vector3();
  const hang = (g: THREE.Object3D, chain: THREE.Object3D[], sx: number, sz: number) => {
    _q.identity();
    for (const o of chain) _q.multiply(o.quaternion);
    _d.copy(DOWN).applyQuaternion(_q.invert());
    g.quaternion.setFromUnitVectors(DOWN, _d).multiply(_qs.setFromEuler(_e.set(sx, 0, sz)));
  };

  // ── Idle ──
  // With the cover open a crack the normal leans toward the spine side; the whole book turns back by YAW so that the cover faces forward and slightly right. In battle the enemy looks from the front biased toward +x and the portrait from the front biased toward -x,
  // so both sides can see the emblem; the page fan at the fore-edge points behind +x, and from the side the open pages can be seen
  const BASE_F = 0.55;
  const YAW = 0.8;
  const update = (t: number, _dt: number) => {
    const op = act.open;
    const sh = act.shut;
    // Floats up and down; leans back and slowly sweeps its gaze left and right
    hover.position.y = 0.8 + Math.sin(t * 1.25) * 0.02;
    hover.rotation.z = Math.sin(t * 0.7) * 0.02;
    book.rotation.set(-0.2 + Math.sin(t * 0.9) * 0.015 - sh * 0.12, YAW + Math.sin(t * 0.33) * 0.08, 0.12 + Math.sin(t * 0.55) * 0.015);
    // The cover opens and closes slightly like breathing; when charging up it opens fully, and when hit it snaps shut
    const breath = Math.sin(t * 1.1) * 0.05;
    const af = lerp(lerp(BASE_F + breath, 2.3, op), 0.0, sh);
    front.rotation.y = -af;
    const ab = lerp(0.06 + op * 0.35, 0.0, sh);
    backC.rotation.y = ab;
    // The fan of the page blocks follows how far the cover is open
    const fan = lerp(0.36 * (af / BASE_F) ** 0.6, 0.02, sh) + op * 0.4;
    for (const b of blocks) b.g.rotation.y = -(lerp(-ab, fan, b.u ** 1.2) + Math.sin(t * 1.6 - b.u * 3) * 0.01);
    // The single leaves lift and fall in turn
    const top = fan + 0.02;
    for (let j = 0; j < leaves.length; j++) {
      const L = leaves[j];
      const cyc = (((t / 5.5 + L.ph) % 1) + 1) % 1;
      const lift = Math.sin(Math.min(1, cyc / 0.55) * PI) * (cyc < 0.55 ? 1 : 0);
      // When closed the single leaves must lie flat, otherwise the curled-up fore-edge would poke out through the cover
      const k = Math.max(lift, op * 0.8 * (0.5 + 0.5 * Math.sin(t * 9 + j * 2))) * (1 - sh);
      L.g.rotation.y = -lerp(top, Math.max(top, af - 0.12), k * 0.85);
      bendLeaf(L, k);
    }
    // The loose sheet drifts slowly
    sheet.position.set(0.42 + Math.sin(t * 0.5) * 0.02, 0.56 + Math.sin(t * 0.8) * 0.03, -0.05);
    sheetIn.rotation.set(0.15 + Math.sin(t * 0.7) * 0.1, 0.8 + Math.sin(t * 0.45) * 0.2, 0.3 + Math.sin(t * 0.6) * 0.08);
    // The broken chain hangs along the world gravity direction, and the ribbon is blown about by the wind outside the fore-edge
    ribbon.rotation.set(Math.sin(t * 1.3) * 0.05, Math.sin(t * 1.7) * 0.12 + 0.04, Math.sin(t * 1.1 + 0.6) * 0.06);
    hang(chainG, [hover, book, backC], Math.sin(t * 0.9) * 0.05, Math.sin(t * 0.7) * 0.04);
    links.forEach((l, i) => (l.rotation.z = Math.sin(t * 1.1 - i * 0.4) * 0.06));
    strapG.rotation.y = Math.sin(t * 1.0 + 0.5) * 0.04;
    // The gem slowly flickers
    M.gem.emissiveIntensity = 0.45 + (0.5 + 0.5 * Math.sin(t * 1.4)) * 0.2 + act.glow * 1.4;
  };
  update(0, 0);

  return { root, update, center: new THREE.Vector3(0.02, 0.76, 0), radius: 0.84, rig, act };
}

