// Chronodragon (Chronos), the Timesand Snail of Ages (model lab version). The id is an old name carried over, and this one is not a dragon. (The id is still chronodragon; saves, skills and the ultimate all hang on that id, so it is not renamed.)
// Lore: a tiny snail lived in the hourglass of the Kingdom's clock tower. On the Night of the Shattered Heart time stopped, but it kept growing for a thousand years, its shell growing one whorl after another, and the hourglass it once lived in is now only big enough for it to hold in one tentacle.
// It remembers the last morning of the Kingdom, and has been waiting all along for that morning to come again.
//
// Three concepts compared before starting:
// 1. Golden cicada: a cicada buried in the sand of an hourglass for a thousand years, its wings windows of glass with brass veins; the face is compound eyes on the two sides of a wide head plus three ocelli on the forehead, and the back is folded glass wings.
//    Rejected: the compound eyes sit on the two sides of the head, so it is hard to give the front an expression; folded wings look like the same roof from the back and from the side; Moth Queen, Shield Beetle and Dreamweaver Spider already occupy the insects.
// 2. Living hourglass: it is fused with the hourglass, floating upright; the upper bulb is a sandstone head and face, the waist a frozen stream of sand, the lower bulb a glass belly holding a dune.
//    Rejected: it looks the same turning all the way around the vertical axis, so the silhouettes from the four views cannot be told apart; a whole sheet of glass as the body would make the outline messy; in the end it is just an object with a face.
// 3. Timesand ancient snail (chosen): a big nautilus-like shell, the shell time growing outward whorl after whorl; the face reaches out from the shell mouth at the top, the mouth set with a brass bezel ring,
//    so the whole face is a clock face; a stopped clock is set into the spiral core on each side, one tentacle holds the little hourglass it was born in; a clockwork key nobody turns any more is stuck slantwise in the back of the shell.
//    Why it: the boldest, and every part grows out of the lore. A logarithmic spiral is already "growing one whorl at a time", and a thousand years is the pattern on the shell;
//    the front is a face framed by the bezel ring, the side is a whole face of spiral plus a clock, the back is the key, and the silhouettes from the four views all differ; at a 150px thumbnail the face, the crest ornament, the key and the hourglass can still be recognized.
//    The snail and tentacles do not collide in the roster: Astragate is a stone lion, Voidchild is a one-eyed shell ball, Thalassene (Serena) is a whale, Ignisar is a lion and Noxfang is a wolf.
//
// Design decisions:
// Identifying features kept: sand gold, the hourglass (its birthplace, with the stream of sand frozen in midair), the clock (the bezel ring and the clock faces on the two sides, the hands stopped at the Night of the Shattered Heart), brass, the patterns of time.
// Body shape: a big shell floating low (earth and wind: the sand in the shell, chamber by chamber, lets it float in the wind). The shell mouth is at the top, facing forward, with the earlier whorl bulging at the front into a chest;
//      the nautilus head reaches out of the shell mouth, slightly raised: a thick hood on top, a pinhole eye on a short eye stalk on each side, and below and in front a whole ring of tentacles reaching out of their sheaths;
//      one longer tentacle winds around the waist of the hourglass and holds it at its side, like carrying a lamp.
// Materials told apart: the shell is a cream shell with thickness and a curled lip closing the mouth, the sand pattern in vertex colors; brass is a metallic highlight and the bronze gears are darker; the glass is translucent and keeps only an outline of its frame; the sand is a warm yellow with a faint glow.
// The face is built after the nautilus's real structure, not anthropomorphized: no eyebrows, beard, sclera or iris. The eyes are small dark pits sunk into the tops of the eye stalks on the two sides of the head (pinhole eyes), with only a single point of highlight in the pit.
// Personality: an old one who keeps waiting and keeps time. Quiet, patient, remembering everything, but not weary of the world: the head slightly raised and reaching up (waiting for the morning), the crown of tentacles loosely open and not curled into a ball.
// Gaze order: the head framed by the bezel ring (a pale crown of tentacles under the dark hood) and the sunrise crest ornament at the top first, the hourglass at its side glowing with morning light second, and the clocks at the sides, the pattern on the shell and the key on the back as support.
// Back: a brass clockwork key stuck slantwise in the back of the shell, with four rivets on the keyhole plate; no one has turned it since the Night of the Shattered Heart, so time has stayed stopped. The key is offset to one side, so the front and back silhouettes differ.
// Restrained light effects: no particles, halos or magic circle on the ground; the only emissive left is the morning sand in the hourglass and a morning-light stone on the crest ornament; the eye pits are fully dark normally and let through a little morning light only during the ultimate.
//
// <Action table> weights for performances; all 0 is the original idle:
//   focus: stop looking around and look straight ahead (0-1); peer: the head reaches out of the shell mouth, tilts up slightly, the eye stalks push out, the crown of tentacles opens a little (0-1);
//   retract: the head withdraws into the shell, the eye stalks sink in, the crown of tentacles closes (0-1); bezel: the bezel ring and the tick studs at the shell mouth show golden light (0-1);
//   dial: the enamel of the clock faces on the two sides shows warm light (0-1); glow: the morning sand in the hourglass and the morning-light stone on the crest ornament light up, and morning light shows from deep in the eye pits (0-1);
//   wind: how many turns the clockwork key on the back has made (clockwise seen from the end of the handle, may be greater than 1); jolt: the shell lurches forward when the ratchet catches a notch (an impulse of 0-1);
//   hands: how many turns the clocks on the two sides have gone (one turn for the minute hand, one twelfth of a turn for the hour hand; negative runs backward);
//   lift: the tentacle holding the hourglass raised forward, up and outward (0-1); toss: the hourglass leaves the tentacle along its own axis and floats above it (0-1);
//   flip: the hourglass flips over (1 is upside down, 2 is a full turn back to the original; flip while toss is near 1, so it does not pass through the tentacle).
// <Anchors> head (center of the face), eyes (the openings of the two eye pits eyeR and eyeL), mouth (the beak in the exact middle of the crown of tentacles), bezel (center of the bezel ring),
//   bezel0-bezel11 (the twelve ticks on the bezel ring, 0 is the crest ornament at twelve o'clock, going clockwise seen from the front), crest (the morning-light stone on the crest ornament),
//   key (center of the key handle, turning with it), keyBase (the keyhole, the key axis pointing from keyBase to key), hourglass (center of the hourglass), tentacle (end of the tentacle),
//   clockL / clockR (centers of the clock faces on the two sides, +z outward; L / R are its own left and right, the hourglass on the left and the key offset to the right), apex (the dorsal ridge at the top of the shell), spiral (the spiral core).

import * as THREE from 'three';
import { INK_LAYER } from './inkPipeline.ts';
import { brilliant, lathe, loft, mergeStatic, outline, partKit, PI, rbox, slab, smooth, type LabModel, type V3 } from './shapes.ts';
import { labToon, rampTexture } from './toonKit.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const X = v(1, 0, 0);
const ss = THREE.MathUtils.smoothstep;

/** Grid surface: rows × cols points; with wrap each row joins head to tail (a ring cross-section, leaving no seam) */
function gridGeo(rows: number, cols: number, f: (i: number, j: number) => { p: THREE.Vector3; c?: THREE.Color }, wrap = false): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  let hasCol = false;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const { p, c } = f(i, j);
      pos.push(p.x, p.y, p.z);
      if (c) hasCol = true;
      const cc = c ?? new THREE.Color(1, 1, 1);
      col.push(cc.r, cc.g, cc.b);
    }
  const idx: number[] = [];
  const jn = wrap ? cols : cols - 1;
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < jn; j++) {
      const j2 = (j + 1) % cols;
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = i * cols + j2;
      const d = (i + 1) * cols + j2;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (hasCol) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Winding check: the normal of the i-th vertex must face out, and if reversed the whole mesh is flipped */
function orient(g: THREE.BufferGeometry, i: number, out: THREE.Vector3): THREE.BufferGeometry {
  const n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, i);
  if (n.dot(out) >= 0) return g;
  const idx = g.index!.array as Uint32Array | Uint16Array;
  for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
  g.index!.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Gear outline: a ring of trapezoidal teeth on the outer edge, hollowed out in the middle */
function gearShape(rRoot: number, rTip: number, teeth: number, rHole: number): THREE.Shape {
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * PI * 2;
    const k = i % 4;
    const r = k === 1 || k === 2 ? rTip : rRoot;
    const aa = a + (k === 1 ? 0.25 : k === 2 ? -0.25 : 0) * ((PI * 2) / n);
    if (i === 0) s.moveTo(Math.cos(aa) * r, Math.sin(aa) * r);
    else s.lineTo(Math.cos(aa) * r, Math.sin(aa) * r);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, rHole, 0, PI * 2, true);
  s.holes.push(hole);
  return s;
}

/**
 * Elliptical ring: sweeps a closed cross-section along an ellipse with half axes A and B in the xz plane, where prof's points are [outward, toward +y].
 * Used for the bezel ring at the shell mouth (a lathe body cannot just be squashed flat, since the cross-section would deform with it).
 */
function ellipseRing(A: number, B: number, prof: [number, number][], seg = 72): THREE.BufferGeometry {
  const P = prof.length;
  const g = gridGeo(P + 1, seg, (i, j) => {
    const th = (j / seg) * PI * 2;
    const [dr, dy] = prof[i % P];
    const n = v(B * Math.cos(th), 0, A * Math.sin(th)).normalize();
    return { p: v(A * Math.cos(th), dy, B * Math.sin(th)).addScaledVector(n, dr) };
  }, true);
  return orient(g, Math.floor(P / 2) * seg, v(1, 0, 0));
}

/**
 * Hood: a thick shell with +y as the top, outer radius ro and inner radius ri, the edge a round lip; lip(α) is the angle measured from the top to the edge at azimuth α (0 toward +z),
 * short at the front and long at the sides and back.
 */
function hoodShell(ri: number, ro: number, lip: (a: number) => number, color?: (d: THREE.Vector3) => THREE.Color, seg = 56, N = 10): THREE.BufferGeometry {
  const prof: ((a: number) => THREE.Vector3)[] = [];
  const dir = (th: number, a: number) => v(Math.sin(th) * Math.sin(a), Math.cos(th), Math.sin(th) * Math.cos(a));
  for (let i = 0; i <= N; i++) prof.push((a) => dir((i / N) * lip(a), a).multiplyScalar(ro));
  const c = (ri + ro) / 2;
  const w = (ro - ri) / 2;
  for (let i = 1; i < 6; i++) {
    const b = (i / 6) * PI;
    prof.push((a) => {
      const L = lip(a);
      const rad = c + Math.cos(b) * w;
      return dir(L, a).multiplyScalar(rad).addScaledVector(dir(L + PI / 2, a), Math.sin(b) * w);
    });
  }
  for (let i = N; i >= 0; i--) prof.push((a) => dir((i / N) * lip(a), a).multiplyScalar(ri));
  const g = gridGeo(prof.length, seg, (i, j) => {
    const p = prof[i]((j / seg) * PI * 2);
    return { p, c: color ? color(p.clone().normalize()) : undefined };
  }, true);
  return orient(g, 4 * seg, v(0, 1, 0));
}

export function buildChronodragonLab(): LabModel {
  const RIMC = 0xffe4b8;
  const vc = (m: THREE.MeshToonMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const glass = labToon(0xd8f2f4, { ramp: 'gem', spec: 1.4, specTh: 0.93, rim: 0.8, rimColor: 0xffffff });
  glass.transparent = true;
  glass.opacity = 0.32;
  glass.depthWrite = false;
  const M = {
    shell: vc(labToon(0xffffff, { speckle: 0.07, rim: 0.55, rimColor: RIMC })),
    // Skin of the eye stalks: the same color as the skin on the upper half of the skull
    skin: labToon(0xc4905f, { rim: 0.5, rimColor: RIMC }),
    hoodV: vc(labToon(0xffffff, { speckle: 0.05, rim: 0.6, rimColor: RIMC })),
    // Warts on the hood: the same color as the hood, relying only on the shading of their shape
    wart: labToon(0x8f5b37, { rim: 0.5, rimColor: RIMC }),
    tent: vc(labToon(0xffffff, { rim: 0.5, rimColor: RIMC })),
    brass: labToon(0xe2b24e, { ramp: 'metal', spec: 1.6, specTh: 0.9, rim: 0.6 }),
    // Bezel ring and tick studs: brass the same as brass; a separate material is so act.bezel can make it glow on its own (the emissive is 0 normally, so the look is unchanged)
    bezel: labToon(0xe2b24e, { ramp: 'metal', spec: 1.6, specTh: 0.9, rim: 0.6, emissive: 0xffb040, emissiveAmt: 0 }),
    bronze: labToon(0x9c6a38, { ramp: 'metal', spec: 1.1, specTh: 0.92, rim: 0.5 }),
    // Enamel of the clock faces on the two sides: act.dial makes it show warm light (0 normally)
    enamel: labToon(0xf8f1df, { rim: 0.3, emissive: 0xffc870, emissiveAmt: 0 }),
    hand: labToon(0x2e2a48, { spec: 1.0, specTh: 0.95, rim: 0.3 }),
    glass,
    sand: labToon(0xf7c35a, { ramp: 'gem', emissive: 0xe08a20, emissiveAmt: 0.32, rim: 0.3 }),
    // The pits of the pinhole eyes: a near-black deep brown, with no rim light or highlight; with act.glow a little morning light shows at the bottom of the pit (the emissive is 0 normally)
    pit: labToon(0x1e130f, { rim: 0, spec: 0, emissive: 0xe08a2a, emissiveAmt: 0 }),
    dawn: labToon(0xffb070, { ramp: 'gem', emissive: 0xff7a30, emissiveAmt: 0.5, spec: 1.4, specTh: 0.88, rim: 0.5 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  // The head is wide and round, and the forward-facing normals fall right on the threshold of the stone ramp, so the light/shadow boundary would cut across the middle of the head; the head, hood and eye stalks use a ramp with a lower threshold so the whole head lands on the bright step
  const faceRamp = rampTexture([[-1, 0.5], [-0.2, 0.78], [0.28, 1]]);
  M.hoodV.gradientMap = faceRamp;
  M.skin.gradientMap = faceRamp;
  M.wart.gradientMap = faceRamp;

  const root = new THREE.Group();
  root.name = 'chronodragon-lab';
  const { add, group } = partKit();
  // The anchors are all empty groups, hung on parts that move along (the order in which meshes are added is not changed, so the outline part indices stay the same)
  const anchors: Record<string, THREE.Object3D> = {};
  const anchor = (name: string, parent: THREE.Object3D, pos: V3 = [0, 0, 0]): THREE.Group => {
    const g = group(parent, pos);
    g.name = name;
    anchors[name] = g;
    return g;
  };
  const HEAD = 9301;

  // The whole animal floats low; float handles the up and down bobbing, and the origin of body is the spiral core
  const float = group(root);
  const O = v(0, 0.7, -0.1);
  const body = group(float, [O.x, O.y, O.z]);

  // ── Shell: a logarithmic spiral, the shell growing in the yz plane (φ = 0 toward the front, PI/2 up). It grows outward from the spiral core, the last whorl going from underneath around to the back and over the top,
  //    with the shell mouth at the top slightly forward, facing forward; the earlier whorl bulges at the front into a chest. age is the angle from the shell mouth: the older it is the smaller, and the closer to the mouth the more it flares to the sides ──
  const K = 0.11;
  const RE = 0.5;
  const CW = 0.52;
  const PHE = (82 / 180) * PI;
  const TURNS = 3.6;
  const R = (age: number) => RE * Math.exp(-K * age);
  const flare = (age: number) => 1 + 0.12 * (1 - ss(age, 0, 0.6));
  const rib = (age: number) => 1 + 0.028 * Math.pow(0.5 + 0.5 * Math.cos(age * 9), 6) * ss(age, 0.2, 0.5);
  const bOf = (age: number) => CW * R(age) * flare(age) * rib(age);
  const aOf = (age: number) => bOf(age) * (1.3 + 0.15 * (1 - ss(age, 0, 1.1)));
  const rhat = (age: number) => v(0, Math.sin(PHE + age), Math.cos(PHE + age));
  // The direction of travel toward the shell mouth (age decreasing)
  const that = (age: number) => v(0, -Math.cos(PHE + age), Math.sin(PHE + age));

  const CREAM = new THREE.Color(0xeedfbf);
  const STRIPE = new THREE.Color(0xbb8352);
  const INNER = new THREE.Color(0x5a3828);
  const shellCol = (age: number, vv: number) => {
    // The old shell has wavy sand patterns (blown by the wind), and the newest-grown section is a clean cream
    const fade = ss(age, 0.4, 0.95);
    const w = (age * 14) / (PI * 2) + 0.16 * Math.sin(vv * 2) + 0.08 * Math.cos(vv * 3);
    const d = Math.abs(w - Math.round(w));
    const m = ss(0.2 - d, -0.025, 0.025) * fade;
    return CREAM.clone().lerp(STRIPE, m);
  };
  // The sand pattern is baked into a texture, so the mesh only has to take care of the silhouette and ribs; vertex colors are kept only for the shell lip and the inner wall of the shell (multiplied onto the texture).
  // Each pixel of the texture is one vertex of the old 520 × 64 mesh (age evenly divided, v going once around the cross-section), and the soft edges from bilinear interpolation match the old version's vertex colors
  const AMAX = TURNS * PI * 2;
  const TU = 520;
  const TV = 64;
  const uOf = (age: number) => ((age / AMAX) * TU + 0.5) / (TU + 1);
  const shellTex = (() => {
    const data = new Uint8Array((TU + 1) * TV * 4);
    const rgb = { r: 0, g: 0, b: 0 };
    for (let x = 0; x <= TU; x++)
      for (let y = 0; y < TV; y++) {
        shellCol((AMAX * x) / TU, (y / TV) * PI * 2).getRGB(rgb, THREE.SRGBColorSpace);
        const k = (y * (TU + 1) + x) * 4;
        data[k] = Math.round(rgb.r * 255);
        data[k + 1] = Math.round(rgb.g * 255);
        data[k + 2] = Math.round(rgb.b * 255);
        data[k + 3] = 255;
      }
    const t = new THREE.DataTexture(data, TU + 1, TV, THREE.RGBAFormat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  })();
  M.shell.map = shellTex;
  interface Ring { C: THREE.Vector3; A: number; B: number; r: THREE.Vector3; u: number; tint: THREE.Color }
  const WHITE = new THREE.Color(1, 1, 1);
  const rings: Ring[] = [];
  // The sampled ages are aligned to the period of the ribs (every rib is sampled at the same phase, so none comes out higher or lower): the outermost whorl has 8 points per rib,
  // the second whorl shows only one ring of 4 at the side, and further in it is entirely hidden behind the clock faces and the outer whorl, with 2 per rib
  const RIB = (PI * 2) / 9;
  const ages: number[] = [];
  for (let a = 0; a < AMAX - 1e-3; a += RIB / (a < PI * 2 - 1e-6 ? 8 : a < PI * 4 - 1e-6 ? 4 : 2)) ages.push(a);
  ages.push(AMAX);
  for (let i = ages.length - 1; i >= 0; i--) {
    const age = ages[i];
    rings.push({ C: rhat(age).multiplyScalar(R(age)), A: aOf(age), B: bOf(age), r: rhat(age), u: uOf(age), tint: WHITE });
  }
  // The normal at the outermost whorl, at the outward-facing (venter) point must face out; the reference ring is the one at about 0.2 turns of age
  const iRefRing = ages.length - 1 - ages.findIndex((a) => a >= AMAX * 0.2);
  // The lip of the shell mouth: curling over the shell edge back into the shell, with the dark inner wall of the shell inside, closing inward (the texture is cream at the shell mouth age = 0, and the inner wall's vertex colors multiply onto it and darken it)
  const re = rhat(0);
  const te = that(0);
  const AE = aOf(0);
  const BE = bOf(0);
  const TH = 0.02;
  const innerTint = new THREE.Color(INNER.r / CREAM.r, INNER.g / CREAM.g, INNER.b / CREAM.b);
  for (let j = 1; j <= 8; j++) {
    const s = (j / 8) * PI;
    const d = (TH / 2) * (1 - Math.cos(s));
    rings.push({ C: re.clone().multiplyScalar(RE).addScaledVector(te, (TH / 2) * Math.sin(s)), A: AE - d, B: BE - d, r: re, u: uOf(0), tint: WHITE });
  }
  for (let j = 1; j <= 10; j++) {
    const u = j / 10;
    const age = 0.7 * u;
    const sc = 1 - u * u * u;
    rings.push({ C: rhat(age).multiplyScalar(R(age)), A: (aOf(age) - TH) * sc, B: (bOf(age) - TH) * sc, r: rhat(age), u: uOf(0), tint: innerTint });
  }
  {
    const NV = 48;
    // First compute the normals with the wrap-around mesh (continuous at the seam), then unwrap into NV + 1 columns: the last column copies the position and normal of the first, with only the uv's v changing from 0 to 1
    const wrapped = gridGeo(rings.length, NV, (i, j) => {
      const g = rings[i];
      const vv = (j / NV) * PI * 2;
      return { p: g.C.clone().addScaledVector(X, g.A * Math.cos(vv)).addScaledVector(g.r, g.B * Math.sin(vv)) };
    }, true);
    orient(wrapped, iRefRing * NV + NV / 4, rings[iRefRing].r);
    const flip = wrapped.index!.getX(1) === 1;
    const wp = wrapped.attributes.position as THREE.BufferAttribute;
    const wn = wrapped.attributes.normal as THREE.BufferAttribute;
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    const col: number[] = [];
    for (let i = 0; i < rings.length; i++)
      for (let j = 0; j <= NV; j++) {
        const k = i * NV + (j % NV);
        pos.push(wp.getX(k), wp.getY(k), wp.getZ(k));
        nor.push(wn.getX(k), wn.getY(k), wn.getZ(k));
        uv.push(rings[i].u, j / NV + 0.5 / TV);
        col.push(rings[i].tint.r, rings[i].tint.g, rings[i].tint.b);
      }
    const idx: number[] = [];
    const C = NV + 1;
    for (let i = 0; i < rings.length - 1; i++)
      for (let j = 0; j < NV; j++) {
        const a = i * C + j;
        const b = a + C;
        const c = a + 1;
        const d = b + 1;
        if (flip) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    add(body, geo, M.shell);
  }

  // ── Brass bezel ring at the shell mouth: framing the whole face, twelve tick studs, the one at twelve o'clock replaced by a morning-light stone ──
  // Coordinates of apert: x to the right, y out of the shell mouth (te), z toward the spiral core (-re); twelve o'clock is at -z
  const apert = group(body, re.clone().multiplyScalar(RE).addScaledVector(te, 0.006).toArray() as V3);
  apert.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, te, re.clone().negate()));
  {
    add(apert, ellipseRing(AE + 0.004, BE + 0.004, [[-0.014, -0.022], [0.016, -0.024], [0.028, -0.012], [0.03, 0.012], [0.018, 0.026], [-0.012, 0.028], [-0.02, 0.004]]), M.bezel);
    anchor('bezel', apert, [0, 0.03, 0]);
    for (let i = 0; i < 12; i++) {
      const th = -PI / 2 + (i / 12) * PI * 2;
      const n = v(BE * Math.cos(th), 0, AE * Math.sin(th)).normalize();
      const p = v(AE * Math.cos(th), 0.03, BE * Math.sin(th)).addScaledVector(n, 0.012);
      // Tick anchors bezel0-bezel11: 0 is twelve o'clock (the crest ornament), going clockwise (seen from the front)
      anchor(`bezel${i}`, apert, [p.x, p.y + 0.012, p.z]);
      if (i === 0) {
        // Twelve o'clock is a sunrise crest ornament: a half-exposed sun set with a morning-light stone, one long and one short ray spreading upward (the morning it is waiting for)
        const crest = group(apert, [p.x, p.y - 0.004, p.z + 0.012], [-PI / 2, 0, 0]);
        const CREST = 9303;
        const sun = group(crest, [0, 0.03, 0]);
        add(sun, lathe([[0.034, -0.012], [0.046, -0.009], [0.05, 0.004], [0.044, 0.014], [0.034, 0.016], [0.03, 0.004]], 32), M.brass, [0, 0, 0], [PI / 2, 0, 0]).userData.inkGroup = CREST;
        add(sun, new THREE.CylinderGeometry(0.034, 0.034, 0.016, 32), M.brass, [0, 0, -0.004], [PI / 2, 0, 0]).userData.inkGroup = CREST;
        add(sun, brilliant(0.03, 0.018, 0.014, 12), M.dawn, [0, 0, 0.006], [PI / 2, 0, 0]);
        anchor('crest', sun, [0, 0, 0.024]);
        const NRAY = 9;
        for (let k = 0; k < NRAY; k++) {
          const a = -1.25 + (2.5 * k) / (NRAY - 1);
          const long = k % 2 === 0;
          const Lr = (long ? 0.1 : 0.062) * (1 - 0.18 * Math.abs(a));
          const w = long ? 0.017 : 0.012;
          // The short rays lean back a little, so from the side the crest ornament is a little fan, not a thin needle
          const ray = group(group(sun, [Math.sin(a) * 0.05, Math.cos(a) * 0.05, long ? -0.002 : -0.012], [0, 0, -a]), [0, 0, 0], [long ? 0 : -0.55, 0, 0]);
          add(ray, slab(outline([[-w, 0], [w, 0], [w * 0.55, Lr * 0.75], [0, Lr], [-w * 0.55, Lr * 0.75]]), 0.012, 0.004, 2), M.brass).userData.inkGroup = CREST;
        }
      } else {
        const big = i % 3 === 0;
        const st = group(apert, p.toArray() as V3, [0, -Math.atan2(n.z, n.x), 0]);
        add(st, rbox(big ? 0.036 : 0.024, 0.014, big ? 0.02 : 0.014, 0.005, 1), M.bezel);
      }
    }
  }

  // ── Head: the nautilus head reaches out of the shell mouth, slightly raised. A thick hood covers the top (the nautilus uses it to seal the shell mouth when it withdraws into the shell),
  //    a pinhole eye on a short eye stalk on each side, and below and in front of the head a whole ring of tentacles. No eyebrows, beard or human eyes: the face is the hood, the eye pits on the sides and the crown of tentacles ──
  const headPos = re.clone().multiplyScalar(RE).addScaledVector(te, -0.01);
  const headQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, re, te)).multiply(new THREE.Quaternion().setFromAxisAngle(X, -0.22));
  const head = group(body, headPos.toArray() as V3);
  head.quaternion.copy(headQ);
  // The center of the face (below the front edge of the hood, above the crown of tentacles) and the mouth (the nautilus's beak, hidden in the exact middle of the crown of tentacles)
  const headA = anchor('head', head, [0, 0.02, 0.19]);
  anchor('mouth', head, [0, -0.085, 0.2]);
  const hm = new THREE.Matrix4().compose(headPos, headQ, v(1, 1, 1));
  const H = (x: number, y: number, z: number) => v(x, y, z).applyMatrix4(hm);
  const HS = v(1.6, 1.12, 1.0);
  const SKR = 0.2;
  const HOOD_RO = 0.232;
  // The edge of the hood: the angle measured from the top to the edge at azimuth a (0 toward the front); at the front it lies across in front of the top of the head, at the sides it covers down to above the eye stalks, and at the back it wraps all the way around
  const hoodLip = (a: number) => {
    // a goes around from 0 to 2π, so it must first be folded back to ±π before taking the absolute value, otherwise the seam cell would jump from the front edge straight to the back's depth, leaving a slanted piece of shell on the face
    const aa = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    return 1.02 + 0.06 * ss(aa, 0.3, 1.2) + 0.85 * ss(aa, 1.3, 2.6);
  };
  {
    const sk = group(head);
    sk.scale.copy(HS);
    // Skull: warm brown skin, going down to the roots of the tentacles and fading to pale cream around the mouthparts (the pale only follows the mouthparts, mostly covered by the crown of tentacles, so there is no round face patch from the front)
    {
      const g = new THREE.SphereGeometry(SKR, 48, 30);
      const p = g.attributes.position as THREE.BufferAttribute;
      const col: number[] = [];
      const cB = new THREE.Color(0xc4905f);
      const cC = new THREE.Color(0xecd8b2);
      const tc = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) / SKR;
        tc.copy(cC).lerp(cB, ss(y, -0.78, -0.5));
        col.push(tc.r, tc.g, tc.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      add(sk, g, M.hoodV).userData.inkGroup = HEAD;
    }
    // Hood: a thick pad two steps darker than the skin. No stripes: radial pale streaks at this size would read as combed hair
    add(sk, hoodShell(0.19, HOOD_RO, hoodLip, () => new THREE.Color(0x8f5b37)), M.hoodV).userData.inkGroup = HEAD;
  }
  // Flat warts on the hood, one by one (the true texture of a nautilus hood), growing only on the visible front half and the sides; the same color as the hood, relying only on the shading of their shape,
  // with no pale little dots (neat pale dots on a round dome would read as a bun sprinkled with sesame, or the cap of a poisonous mushroom)
  {
    const ico = new THREE.IcosahedronGeometry(1, 0);
    const Y = v(0, 1, 0);
    const NW = 18;
    for (let k = 0; k < NW; k++) {
      const a = k * 2.39996;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > 1.9) continue;
      const th = 0.1 + Math.sqrt((k + 0.5) / NW) * (hoodLip(a) - 0.24);
      const d = v(Math.sin(th) * Math.sin(a), Math.cos(th), Math.sin(th) * Math.cos(a));
      const nrm = v(d.x / HS.x, d.y / HS.y, d.z / HS.z).normalize();
      const s = 0.022 + 0.012 * (0.5 + 0.5 * Math.sin(k * 12.9898));
      const p = d.clone().multiplyScalar(HOOD_RO).multiply(HS).addScaledVector(nrm, -s * 0.1);
      const w = add(head, ico, M.wart, p.toArray() as V3, [0, 0, 0], [s, s * 0.34, s * 0.8]);
      w.quaternion.setFromUnitVectors(Y, nrm);
      w.userData.inkGroup = HEAD;
    }
  }

  // Eyes: the nautilus's pinhole eyes. On each side of the head a short eye stalk (a round mound the same color as the head), a small pit dished in at the top, nearly black inside with only one small point of highlight.
  //    No sclera, iris, eyelids or eyebrows; the eyes are on the two sides of the head, facing outward and forward: from the front they are two small dark pits on the sides of the head, and from three-quarters the opening of the near one can be seen.
  //    The opening is about a tenth of the head's width in diameter; the eye stalk grows along the normal from the point on the skull whose normal faces outward and forward, and the two eyes are symmetric left and right with the same gaze
  const EYE_OUT = 0.82;
  const eyeA: THREE.Group[] = [];
  const stalks: { g: THREE.Group; p: THREE.Vector3; n: THREE.Vector3 }[] = [];
  const moundGeo = lathe([[0.001, -0.03], [0.045, -0.028], [0.057, -0.014], [0.06, 0.002], [0.057, 0.016], [0.049, 0.027], [0.041, 0.034], [0.035, 0.036]], 28);
  // The inner wall of the pit dishes from the lip of the opening down to the bottom (about 0.026 deep), the normals facing the opening
  const pitGeo = lathe([[0.035, 0.036], [0.031, 0.033], [0.028, 0.025], [0.023, 0.017], [0.014, 0.012], [0.001, 0.011]], 28);
  const hiGeo = new THREE.SphereGeometry(0.0052, 8, 6);
  const SA = HS.clone().multiplyScalar(SKR);
  for (const sx of [-1, 1]) {
    const n = v(sx * Math.sin(EYE_OUT), 0.16, Math.cos(EYE_OUT)).normalize();
    // The point on an ellipsoid where the normal is n: p = (a²nx, b²ny, c²nz) / √(a²nx² + b²ny² + c²nz²), then buried in a little along the normal
    const p = v(SA.x * SA.x * n.x, SA.y * SA.y * n.y, SA.z * SA.z * n.z);
    p.divideScalar(Math.sqrt(SA.x * SA.x * n.x * n.x + SA.y * SA.y * n.y * n.y + SA.z * SA.z * n.z * n.z)).addScaledVector(n, -0.012);
    // Coordinates of the eye stalk: y along the normal outward, z up, x forward on the +1 one and backward on the -1 one
    const up = v(0, 1, 0).addScaledVector(n, -n.y).normalize();
    const stalk = group(head, p.toArray() as V3);
    stalk.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(n, up), n, up));
    add(stalk, moundGeo, M.skin).userData.inkGroup = HEAD;
    // The eye pit itself (when corrupted the whole pit turns to red light)
    const eye = group(stalk);
    add(eye, pitGeo, M.pit);
    // The highlight is only a small point, on the inner wall toward the top of the pit and on the side visible from the front (less than a tenth of the area of the opening)
    const hl = add(eye, hiGeo, M.hi, [-sx * 0.006, 0.0125, 0.009]);
    hl.layers.disable(INK_LAYER);
    hl.castShadow = false;
    eyeA.push(anchor(sx < 0 ? 'eyeR' : 'eyeL', eye, [0, 0.022, 0]));
    stalks.push({ g: stalk, p: p.clone(), n });
  }

  // ── Tentacles: a sheath at the root the same color as the scalp, the tentacle body reaching out of the sheath, going from a warm brown near the skin color at the root to a pale beige at the end;
  //    the face toward the inside of the crown and the underside carries a touch of shadow color, so the whole bunch has volume and is not a sheet of pale color ──
  const TSH = new THREE.Color(0xc08a5a);
  const TBASE = new THREE.Color(0xcf9f70);
  const TTIP = new THREE.Color(0xf7eddb);
  const TSHADE = new THREE.Color(0x8c5c3a);
  const LDOWN = v(0, -1, 0);
  /**
   * One tentacle: a tube swept along pts, with t the proportion along the length. When point is true it tapers from the root all the way to the tip (a curled end), otherwise both ends close to round heads (the one holding the hourglass, whose end is wound onto the hourglass).
   * Before sheath is a thicker sheath; axis(p) gives the point on the crown's axis nearest to p, and the face toward the axis gets the shadow color
   */
  const tentGeo = (pts: THREE.Vector3[], r0: number, segs = 44, o: { sheath?: number; radial?: number; point?: boolean; axis?: (p: THREE.Vector3) => THREE.Vector3 } = {}) => {
    const sheath = o.sheath ?? 0;
    const g = loft(pts, (t) => {
      const cap0 = t < 0.05 ? Math.sqrt(Math.max(0, 1 - ((0.05 - t) / 0.05) ** 2)) : 1;
      const sh = sheath > 0 ? 1 + 0.22 * (1 - ss(t, sheath - 0.03, sheath + 0.08)) : 1;
      let r: number;
      if (o.point) r = r0 * Math.max(0.07, Math.pow(1 - t, 0.7)) * cap0 * sh;
      else {
        const cap1 = t > 0.94 ? Math.sqrt(Math.max(0, 1 - ((t - 0.94) / 0.06) ** 2)) : 1;
        r = r0 * (1 - t * 0.7) * cap0 * cap1 * sh;
      }
      return [r, r];
    }, { segs, radial: o.radial ?? 12 });
    const p = g.attributes.position as THREE.BufferAttribute;
    const col: number[] = [];
    const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const q = new THREE.Vector3();
    const n = new THREE.Vector3();
    const inw = new THREE.Vector3();
    const tc = new THREE.Color();
    // Vertex color: find the nearest path point as the position, a gradient along the length; then add the shadow color depending on which side of the tube this point is on
    const NSMP = 60;
    const samples = Array.from({ length: NSMP + 1 }, (_, i) => path.getPointAt(i / NSMP));
    for (let i = 0; i < p.count; i++) {
      q.fromBufferAttribute(p, i);
      let best = 0;
      let bd = Infinity;
      for (let s = 0; s < samples.length; s++) {
        const d = samples[s].distanceToSquared(q);
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      const tt = best / NSMP;
      tc.copy(TBASE).lerp(TTIP, ss(tt, 0.12, 0.85));
      if (sheath > 0) tc.lerp(TSH, 1 - ss(tt, sheath - 0.04, sheath + 0.05));
      n.copy(q).sub(samples[best]).normalize();
      let shade = 0.3 * Math.max(0, n.dot(LDOWN));
      if (o.axis) shade += 0.4 * Math.max(0, n.dot(inw.copy(o.axis(samples[best])).sub(samples[best]).normalize()));
      tc.lerp(TSHADE, Math.min(0.55, shade));
      col.push(tc.r, tc.g, tc.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  };

  // ── Crown of tentacles: a nautilus's tentacles have no suckers, and are arranged in two rings around the mouth, each reaching out of a thicker sheath.
  //    Both rings are arranged on the same bell shape (like an inverted flower crown): the bell's axis extends forward from the mouth and then bends down over the chest, the outer ring has nine long ones and the inner ring five short ones,
  //    all twisted together in the same direction (clockwise seen from the front), parallel to each other and not crossing; each tapers from the root to the tip, the end curling outward into a small ring like a watch hairspring.
  //    The bell's cross-section is wide left to right and narrow front to back, the whole bunch drawn into one mass; the back (the side toward the chest) is left empty, so as it hangs it does not poke into the ring of shell on the chest ──
  const CROWN = 9304;
  const C0 = v(0, -0.05, 0.12);
  const crown = group(head, C0.toArray() as V3);
  const BELL0 = v(0, -0.045, 0.16).sub(C0);
  const TWIST = 0.45;
  const FWD = v(0, 0, 1);
  // The bell's axis: bending from horizontal down by 0.3 radians to 1.35 radians, of length AXL; axisAt(u) gives the point on the axis, the tangent, and E2 pointing outward and up (E1 always points to its own left)
  const AXL = 0.3;
  const A0 = 0.3;
  const A1 = 1.35;
  const NAX = 40;
  const axPts: THREE.Vector3[] = [BELL0.clone()];
  for (let i = 1; i <= NAX; i++) {
    const al = A0 + (A1 - A0) * ((i - 0.5) / NAX);
    axPts.push(axPts[i - 1].clone().addScaledVector(FWD, (Math.cos(al) * AXL) / NAX).addScaledVector(LDOWN, (Math.sin(al) * AXL) / NAX));
  }
  const axisAt = (u: number) => {
    const k = Math.max(0, Math.min(1, u)) * NAX;
    const i = Math.min(NAX - 1, Math.floor(k));
    const p = axPts[i].clone().lerp(axPts[i + 1], k - i);
    const al = A0 + (A1 - A0) * Math.max(0, Math.min(1, u));
    const T = v(0, -Math.sin(al), Math.cos(al));
    return { p, T, E2: new THREE.Vector3().crossVectors(T, X) };
  };
  // For shadows: the point on the axis nearest to p
  const bellAxis = (p: THREE.Vector3) => {
    let best = axPts[0];
    let bd = Infinity;
    for (const a of axPts) {
      const d = a.distanceToSquared(p);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best.clone();
  };
  // phi: the azimuth on the bell (0 is straight up and forward, positive toward its own left); rho0 → rhoMax: the bell mouth opening from the root to the end in radius (front to back only 0.55 of left to right);
  // L: the proportion of length along the axis (1 is the whole axis); u0: how far the root is shifted outward along the axis; r0: the thickness at the root
  const strand = (phi: number, rho0: number, rhoMax: number, L: number, u0: number, r0: number, segs: number) => {
    const at = (s: number) => {
      const ph = phi + TWIST * s;
      const R = rho0 + (rhoMax - rho0) * Math.sin((Math.min(1, s * 1.15) * PI) / 2);
      const { p, E2 } = axisAt(u0 + L * s);
      return p.addScaledVector(E2, Math.cos(ph) * R * 0.55).addScaledVector(X, Math.sin(ph) * R);
    };
    // The root is buried in the scalp: from the point of the first ring of the bell mouth, backing off along -z to below the scalp
    const a0 = at(0);
    const hx = a0.x + C0.x;
    const hy = a0.y + C0.y;
    const zIn = SA.z * Math.sqrt(Math.max(0.02, 1 - (hx / SA.x) ** 2 - (hy / SA.y) ** 2)) - 0.03 - C0.z;
    const pts: THREE.Vector3[] = [v(a0.x, a0.y, Math.min(a0.z, zIn) - 0.01)];
    const NS = 10;
    for (let i = 1; i <= NS; i++) pts.push(at(i / NS));
    // The small curl at the end: curling outward (away from the bell's axis) and then upward, the step getting shorter and shorter, curling into a tight small ring
    const end = pts[pts.length - 1].clone();
    const d = end.clone().sub(pts[pts.length - 2]).normalize();
    const out = end.clone().sub(bellAxis(end)).normalize();
    const K = new THREE.Vector3().crossVectors(d, out).normalize();
    let step = (L * AXL) / NS;
    for (let k = 0; k < 10; k++) {
      d.applyAxisAngle(K, 0.6);
      step *= 0.84;
      end.addScaledVector(d, step);
      pts.push(end.clone());
    }
    add(crown, tentGeo(pts, r0, segs, { sheath: 0.14, radial: 8, point: true, axis: bellAxis }), M.tent).userData.inkGroup = CROWN;
  };
  // The outer ring of nine: at the upper front and the sides of the bell, the longest
  for (let i = 0; i < 9; i++) strand(-1.95 + (i / 8) * 3.9, 0.13, 0.21, 1 - 0.06 * Math.abs(Math.cos(i * 1.3)), 0, 0.03, 40);
  // The inner ring of five: short, arranged behind the gaps between two of the outer ring, with a bit more shadow on the inward-facing side
  for (let i = 0; i < 5; i++) strand(-1.7 + (i / 4) * 3.4 + 0.24, 0.06, 0.1, 0.62, 0.06, 0.025, 30);

  // ── Hourglass: the place it was born. Brass top and bottom caps, three turned pillars, two glass bulbs; the sand in the upper bulb dished into a funnel in the middle, a fine stream of sand frozen in midair, the lower bulb heaped into a small dune ──
  const HG = v(0.27, -0.1, 0.44);
  const hg = group(body, HG.toArray() as V3, [0.12, 0, 0]);
  const hgRest = hg.quaternion.clone();
  anchor('hourglass', hg);
  {
    const S = 1.1;
    const hs = group(hg);
    hs.scale.setScalar(S);
    const bulb: [number, number][] = [[0.001, -0.128], [0.04, -0.126], [0.062, -0.112], [0.074, -0.088], [0.074, -0.062], [0.062, -0.038], [0.034, -0.016], [0.011, -0.004], [0.008, 0], [0.011, 0.004], [0.034, 0.016], [0.062, 0.038], [0.074, 0.062], [0.074, 0.088], [0.062, 0.112], [0.04, 0.126], [0.001, 0.128]];
    const gl = add(hs, lathe(bulb, 32), M.glass);
    gl.castShadow = false;
    add(hs, lathe([[0.001, 0.05], [0.028, 0.058], [0.056, 0.068], [0.066, 0.074], [0.064, 0.06], [0.05, 0.036], [0.028, 0.016], [0.01, 0.005], [0.001, 0.004]], 32), M.sand);
    add(hs, new THREE.CylinderGeometry(0.0035, 0.0035, 0.07, 8), M.sand, [0, -0.03, 0]);
    add(hs, lathe([[0.001, -0.062], [0.024, -0.072], [0.05, -0.094], [0.066, -0.108], [0.06, -0.122], [0.001, -0.124]], 32), M.sand);
    for (const sy of [-1, 1]) {
      const cap = group(hs, [0, sy * 0.14, 0], [sy < 0 ? 0 : PI, 0, 0]);
      add(cap, lathe([[0.001, -0.016], [0.092, -0.016], [0.1, -0.008], [0.1, 0.004], [0.09, 0.012], [0.066, 0.014], [0.05, 0.02], [0.001, 0.02]], 40), M.brass);
      add(cap, lathe([[0.001, -0.036], [0.018, -0.033], [0.024, -0.025], [0.019, -0.018], [0.026, -0.016], [0.001, -0.016]], 24), M.brass);
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2 + PI / 6;
      add(hs, lathe([[0.006, -0.128], [0.011, -0.12], [0.008, -0.1], [0.009, -0.06], [0.013, -0.03], [0.007, 0], [0.013, 0.03], [0.009, 0.06], [0.008, 0.1], [0.011, 0.12], [0.006, 0.128]], 10), M.bronze, [Math.cos(a) * 0.084, 0, Math.sin(a) * 0.084]);
    }
    // Reflections on the glass: a thin long white strip, not in the outline layer
    for (const sy of [-1, 1]) {
      const hl = add(hs, new THREE.SphereGeometry(1, 8, 6), M.hi, [-0.05, sy * 0.075, 0.052], [0, -0.75, 0], [0.004, 0.028, 0.004]);
      hl.layers.disable(INK_LAYER);
      hl.castShadow = false;
    }
  }
  // One longer tentacle reaches out from the lower left of the crown of tentacles (its own left), winds a little more than once around the waist of the hourglass, and holds it at its side
  const arms: THREE.Group[] = [];
  {
    const r0 = H(0.2, -0.18, 0.06);
    const g = group(body, r0.toArray() as V3);
    const c = HG.clone().sub(r0);
    const pts = [v(0, 0.02, -0.03), v(0.03, -0.1, 0.04), v(c.x - 0.02, c.y + 0.14, c.z + 0.02)];
    const NC = 14;
    for (let k = 0; k <= NC; k++) {
      const u = k / NC;
      const ang = -0.6 + u * PI * 2.3;
      const rr = 0.118 - u * 0.012;
      pts.push(v(c.x + Math.sin(ang) * rr, c.y + 0.03 - u * 0.07, c.z + Math.cos(ang) * rr));
    }
    add(g, tentGeo(pts, 0.036), M.tent).userData.inkGroup = HEAD;
    arms.push(g);
    // The end of the tentacle (the tail of the turn wound around the waist of the hourglass)
    anchor('tentacle', g, pts[pts.length - 1].toArray() as V3);
  }
  const armRoot = arms[0].position.clone();

  // ── The clocks at the spiral core: one on each side, a bronze gear frame, a brass bezel ring, an enamel clock face and twelve ticks, the hands stopped at the Night of the Shattered Heart ──
  const hands: THREE.Group[] = [];
  const hourH: { g: THREE.Group; rest: number }[] = [];
  const minH: { g: THREE.Group; rest: number }[] = [];
  for (const sx of [-1, 1]) {
    const dg = group(body, [sx * 0.18, 0, 0]);
    dg.quaternion.setFromUnitVectors(v(0, 0, 1), v(sx, 0, 0));
    // The center of the clock face, +z outward (its own left is +x)
    anchor(sx > 0 ? 'clockL' : 'clockR', dg, [0, 0, 0.05]);
    add(dg, slab(gearShape(0.19, 0.212, 26, 0.1), 0.03, 0.006, 4), M.bronze, [0, 0, -0.01]);
    add(dg, lathe([[0.155, -0.015], [0.177, -0.012], [0.185, 0.004], [0.177, 0.018], [0.16, 0.02], [0.153, 0.01]], 48), M.brass, [0, 0, 0.012], [PI / 2, 0, 0]);
    add(dg, new THREE.CylinderGeometry(0.157, 0.157, 0.02, 48), M.enamel, [0, 0, 0.012], [PI / 2, 0, 0]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI * 2;
      const big = i % 3 === 0;
      const st = group(dg, [Math.sin(a) * 0.132, Math.cos(a) * 0.132, 0.024], [0, 0, -a]);
      add(st, rbox(big ? 0.015 : 0.008, big ? 0.036 : 0.022, 0.008, 0.003, 1), big ? M.brass : M.hand);
    }
    const hand = group(dg, [0, 0, 0.03]);
    // The hour hand nearly at 12 and the minute hand stopped near 9 (the moment of the Night of the Shattered Heart); the two look the same from outside
    const hour = group(hand, [0, 0, 0], [0, 0, -sx * 0.3]);
    add(hour, slab(outline([[-0.009, -0.015], [0.009, -0.015], [0.012, 0.05], [0, 0.078], [-0.012, 0.05]]), 0.005, 0.002, 2), M.hand);
    const minute = group(hand, [0, 0, 0.006], [0, 0, sx * 1.6]);
    add(minute, slab(outline([[-0.006, -0.02], [0.006, -0.02], [0.008, 0.084], [0, 0.116], [-0.008, 0.084]]), 0.005, 0.002, 2), M.hand);
    add(hand, new THREE.CylinderGeometry(0.015, 0.015, 0.012, 20), M.brass, [0, 0, 0.008], [PI / 2, 0, 0]);
    hands.push(hand);
    hourH.push({ g: hour, rest: hour.rotation.z });
    minH.push({ g: minute, rest: minute.rotation.z });
  }

  // ── The clockwork key on the back: stuck in a brass keyhole plate on the back of the shell, not turned by anyone since the Night of the Shattered Heart ──
  let keySpin: THREE.Group;
  {
    // The key is not on the center line but offset to the other side of the hourglass (-x), extending slantwise along the normal of the shell surface: there is one more key handle at the upper left of the front silhouette and the upper right of the back silhouette
    const phk = 0.78;
    const vk = PI / 2 + 0.5;
    const rk = rhat(phk);
    const A0 = aOf(phk);
    const B0 = bOf(phk);
    const base = rk.clone().multiplyScalar(R(phk)).addScaledVector(X, A0 * Math.cos(vk)).addScaledVector(rk, B0 * Math.sin(vk));
    const nk = X.clone().multiplyScalar(Math.cos(vk) / A0).addScaledVector(rk, Math.sin(vk) / B0).normalize();
    base.addScaledVector(nk, -0.012);
    const zk = v(0, 0, 1).addScaledVector(nk, -nk.z).normalize();
    const kg = group(body, base.toArray() as V3);
    kg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(nk, zk), nk, zk));
    kg.scale.setScalar(1.5);
    // Keyhole plate: a shield-shaped piece of brass laid on the back of the shell, with four rivets
    const plate = group(kg, [0, 0, 0], [-PI / 2, 0, 0]);
    add(plate, slab(outline([[-0.06, -0.07], [0.06, -0.07], [0.07, 0.02], [0.04, 0.07], [0, 0.085], [-0.04, 0.07], [-0.07, 0.02]]), 0.014, 0.005, 3), M.brass, [0, 0, 0.004]);
    const kit = partKit();
    for (const [x, y] of [[-0.045, -0.05], [0.045, -0.05], [-0.05, 0.03], [0.05, 0.03]] as [number, number][]) kit.rivet(plate, M.bronze, [x, y, 0.016], [0, 0, 1], 0.009);
    // The key body (apart from the keyhole plate) hangs on a pivot that turns about the key axis, and act.wind winds the clockwork; the order of adding is the same as the original
    const ks = group(kg);
    keySpin = ks;
    anchor('keyBase', kg, [0, 0.03, 0]);
    add(ks, new THREE.CylinderGeometry(0.032, 0.038, 0.03, 24), M.brass, [0, 0.03, 0]);
    add(ks, new THREE.CylinderGeometry(0.016, 0.016, 0.14, 16), M.brass, [0, 0.11, 0]);
    add(ks, lathe([[0.001, 0], [0.028, 0], [0.03, 0.014], [0.022, 0.026], [0.001, 0.028]], 24), M.brass, [0, 0.16, 0]);
    // Butterfly-shaped key handle: two rings side by side with a solid neck in the middle; the handle face roughly faces front and back, turned a little, so both rings can be seen from the front, the back and three-quarters
    const KEY = 9302;
    const bow = group(ks, [0, 0.18, 0], [0, 0.85, 0]);
    anchor('key', ks, [0, 0.265, 0]);
    for (const hx of [-1, 1]) {
      const ring = new THREE.Shape();
      ring.absarc(0, 0, 0.056, 0, PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, 0.026, 0, PI * 2, true);
      ring.holes.push(hole);
      add(bow, slab(ring, 0.018, 0.007, 24), M.brass, [hx * 0.06, 0.085, 0]).userData.inkGroup = KEY;
    }
    add(bow, rbox(0.05, 0.07, 0.03, 0.01, 2), M.brass, [0, 0.035, 0]).userData.inkGroup = KEY;
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });

  // ── Idle: slow up and down bobbing, the head turning slightly, the crown of tentacles swaying lightly (a nautilus has no eyelids, so it does not blink); the second hand wants to move but cannot, only trembling in place ──
  // Action weights for performances (see <Action table> in the file header); with all at 0 it is exactly the original idle
  const act = { focus: 0, peer: 0, retract: 0, bezel: 0, dial: 0, glow: 0, wind: 0, jolt: 0, hands: 0, lift: 0, toss: 0, flip: 0 };
  // When the hourglass is lifted the tentacle turns about its root, lifting the hourglass from its side to in front of and outside the face; when tossed the hourglass leaves the tentacle, righting itself as it flies to beside the crest ornament (HOVER) and stops
  const LIFT_Q = new THREE.Quaternion().setFromUnitVectors(HG.clone().sub(armRoot).normalize(), v(0.3, 0.09, 0.345).normalize());
  const HOVER = v(0.46, 0.92, 0.46);
  const qLift = new THREE.Quaternion();
  const qIdle = new THREE.Quaternion();
  const qRest = new THREE.Quaternion();
  const qFlip = new THREE.Quaternion();
  const vTmp = new THREE.Vector3();
  const Z = v(0, 0, 1);
  let lastGlow = -1;
  let lastBezel = -1;
  let lastDial = -1;
  const update = (t: number, dt: number) => {
    const roam = 1 - act.focus;
    float.position.y = Math.sin(t * 0.8) * 0.022 - act.jolt * 0.016;
    float.rotation.x = Math.sin(t * 0.8 - 0.9) * 0.018 + act.jolt * 0.035;
    // Reaching out of the shell mouth (peer) and withdrawing into the shell (retract): the head (with the crown of tentacles and eye stalks) and the tentacle holding the hourglass move together along the direction of the shell mouth
    const out = act.peer * 0.05 - act.retract * 0.09;
    head.position.copy(headPos).addScaledVector(te, out);
    head.quaternion.copy(headQ);
    head.rotateY(Math.sin(t * 0.31) * 0.06 * roam);
    head.rotateX(Math.sin(t * 0.47) * 0.02 * roam - act.peer * 0.1 + act.retract * 0.12);
    // The crown of tentacles reaches out and withdraws with the head; when idle it sways lightly, when reaching out it opens a little, and when withdrawn into the shell the whole bunch closes
    crown.rotation.x = Math.sin(t * 0.8 - 1.4) * 0.03 - act.retract * 0.15;
    crown.rotation.z = Math.sin(t * 0.55) * 0.02;
    crown.scale.setScalar(1 + act.peer * 0.04 - act.retract * 0.2);
    // Eye stalks: pushing out a little when reaching out, and sinking into the head when withdrawn (a nautilus has no eyelids and does not blink)
    for (const e of stalks) e.g.position.copy(e.p).addScaledVector(e.n, act.peer * 0.008 - act.retract * 0.018);
    const L = act.lift;
    qLift.identity().slerp(LIFT_Q, L);
    for (let i = 0; i < arms.length; i++) {
      arms[i].position.copy(armRoot).addScaledVector(te, out);
      arms[i].quaternion.copy(qLift).multiply(qIdle.setFromAxisAngle(X, Math.sin(t * 0.8 - 0.9) * 0.015));
    }
    // The hourglass is lifted with the tentacle (following only the lifted part, with the idle light sway independent), tossed and flipped; flip 1 is upside down and 2 is a full turn back to the original
    if (L === 0 && act.toss === 0 && act.flip === 0 && out === 0) {
      hg.position.copy(HG);
      hg.rotation.set(0.12, 0, Math.sin(t * 0.8 - 1.1) * 0.02);
    } else {
      const T = act.toss;
      qRest.copy(hgRest).multiply(qFlip.setFromAxisAngle(Z, Math.sin(t * 0.8 - 1.1) * 0.02));
      hg.quaternion.copy(qLift).multiply(qRest).slerp(qRest, T);
      hg.position.copy(HG).sub(armRoot).applyQuaternion(qLift).add(armRoot).addScaledVector(te, out);
      // The arc of the toss: first shooting up, then drawing in beside the crest ornament
      vTmp.copy(HOVER).addScaledVector(te, out);
      hg.position.lerp(vTmp, T).add(vTmp.set(0, Math.sin(T * PI) * 0.08, 0));
      hg.quaternion.multiply(qFlip.setFromAxisAngle(Z, act.flip * PI));
    }

    // The clocks on the two sides: the second hand trembles in place; act.hands is how many turns the hands have gone (one turn for the minute hand, one twelfth of a turn for the hour hand; negative runs backward)
    const tw = (t % 2.4) < 0.12 ? Math.sin(((t % 2.4) / 0.12) * PI) * 0.05 : 0;
    for (const h of hands) h.rotation.z = tw;
    for (const h of hourH) h.g.rotation.z = h.rest - (act.hands * PI * 2) / 12;
    for (const h of minH) h.g.rotation.z = h.rest - act.hands * PI * 2;
    // Clockwork key: act.wind is how many turns it has made (clockwise seen from the end of the key handle)
    keySpin.rotation.y = -act.wind * PI * 2;
    M.sand.emissiveIntensity = 0.32 + Math.sin(t * 1.1) * 0.05 + act.glow * 0.45;
    // Other emissives are written only when a weight changes (so when another ultimate changes uEmissiveAmt it is not overwritten)
    if (act.glow !== lastGlow) {
      lastGlow = act.glow;
      M.dawn.emissiveIntensity = 0.5 + act.glow * 0.8;
      M.pit.emissiveIntensity = act.glow * 0.45;
    }
    if (act.bezel !== lastBezel) {
      lastBezel = act.bezel;
      M.bezel.emissiveIntensity = act.bezel * 0.42;
    }
    if (act.dial !== lastDial) {
      lastDial = act.dial;
      M.enamel.emissiveIntensity = act.dial * 0.32;
    }
  };
  update(0, 0);

  // The top of the shell (the dorsal ridge of the last whorl, the highest point behind the head) and the spiral core
  const topAge = 0.35;
  anchor('apex', body, rhat(topAge).multiplyScalar(R(topAge) + bOf(topAge)).toArray() as V3);
  anchor('spiral', body);
  const rig = { head: headA, eyes: eyeA, anchors };
  // Draw calls: parts that never move on their own are merged into the groups that move (the float, the head, the crown of tentacles, the tentacle holding the hourglass, the hourglass, the eye stalks, the hands on the two sides, the clockwork key)
  mergeStatic(root, { owners: [float, head, crown, ...arms, hg, ...stalks.map((e) => e.g), ...hands, ...hourH.map((h) => h.g), ...minH.map((h) => h.g), keySpin], rig });

  return { root, update, center: new THREE.Vector3(0, 0.8, 0), radius: 0.95, rig, act };
}
