// Terragon, the Mountain Shell: "Mountainfall"
//
// What this cinematic is about: the giant tortoise carrying a whole kingdom on its back wakes the earth veins beneath its feet. With one stomp the ground splits along its line of sight into an amber rift,
// basalt columns breaking out of the ground along the way and surrounding the opponent; the strata in the rift are heaved into the sky layer by layer, stacking from the summit downward, and the strata under its carapace also crumble into rubble and fly over
// (shedding), piling into a mountain torn up by the roots and hanging above the opponent's head. The tortoise stomps once more, the mountain collapses and the sky falls, crushing the opponent together with the ground beneath,
// the mountain's strata shifting apart and crumbling layer by layer; after the mountainfall, three new layers of strata stand up beneath it.
//
// Model: a land tortoise whose carapace is a mountain (src/render/lab/terragonModel.ts). Anchors used: shell (the plane at the lower edge of the carapace, with the carapace's strata attached beneath),
// summit (the snow-capped main peak), crystal (the source crystal); action weights: glow (source crystal, lamps and iris brighten), focus (stops to look around, faces forward).
// Rearing up and stomping use the shell's pose rotating about the hind feet. The legacy model (&port=off) has no anchors, so the carapace strata segment is skipped and everything else goes as usual.
//
// The mountain in the sky: a whole block of earth torn up by the roots. On top is the mountain: meadow, a main peak standing off to one side and leaning back, two side peaks, a snow cap, a ring of pine forest;
// below is a cross-section of the strata: five layers of sedimentary rock (from bottom to top: basalt, grey shale, limestone, slate, yellow sandstone) narrowing layer by layer downward, each layer with its own base color,
// the hard layers bulging outward in the middle and the soft ones concave, vertical ridges and grooves on the rock face, the whole stack tilted along the direction of the attack, so the strata are slanted; at the very bottom are the torn-off rock roots,
// hanging root spikes and amber crystals. All are solid cartoon stones (sceneMaterial, outline layer), one mesh per layer, with outlines between the layers.
// The colors avoid red and orange: so that it can still be told apart standing in front of a red-rock canyon.
//
// Shot list (seconds on the world clock; GSAP timeline, stops during hit-stop and follows battle speed; n = number of strata layers on the carapace, 0 to 3)
//   windup
//     0.00  Announcement: letterbox, sand-dust tint, the music is pulled out. The camera hugs the ground diagonally in front of the face (audience side 30°) shooting up, slowly pushing in within 0.6 s;
//           the tortoise stops to look around and faces forward (focus). Rubble on the ground jumps in bursts, and the snow cap sifts snow dust downward. Sound: an earth rumble swelling from small to large (loudest at the stomp).
//     0.22  Earth veins light up: amber eye glints, the source crystal, lamps and iris brighten (glow), a ball of halo on the source crystal. Sound: one low note.
//     0.60  Rear up (cut): a low-angle full-body shot at audience side 58°. The tortoise props up its front half about the hind feet (0.48 s), dust under its plastron falling;
//           the n layers of strata beneath the carapace squeeze out from under the rim (each layer narrower than the last, the same colors as the mountain in the sky). Sound: stone grinding and rock cracking.
//     1.08  Comes down; 1.20 stomp: the front feet hit the ground heavily and the body presses down, a ring of dust wave and shockwave ring under the feet, amber cracks, rubble jumping, the camera jolts. Sound: the stomp.
//     1.30  Splitting the earth (cut): the camera on the audience side a bit higher, looking down at the head of the crack and following it, rushing forward half a beat behind the crack; the crack tears toward the opponent all the way (faster and faster),
//           the basalt columns on the far side of the rift breaking out behind the crack and leaning outward; as it nears the opponent the camera tilts up to bring the opponent into the frame. Sound: the earth tearing, an earth rumble rolling all the way over.
//     1.92  Locking the ground: the crack hits the opponent's feet, and a ring of tall rock columns leans inward and surrounds the opponent (leaving the camera's side open). Sound: rock cracking, an impact.
//     2.04  Heaving rock (cut): the camera on the opponent's audience side hugging the ground looking up, orbiting around the opponent (100° → 75°), slowly pulling away and rising, watching the strata break out of the rift one block at a time,
//           tumbling into the sky and stacking above the opponent's head from the summit downward: the summit (meadow and main peak) goes up first, then the yellow sandstone, slate, limestone, grey shale and basalt,
//           each layer that joins pushing the whole stack up a bit (0.1 s between blocks, 0.5 s of flight, the last layer joining at 3.04 s).
//           Sound: the grinding of strata being pulled out of the ground, a heavy impact for each layer.
//     2.59  The carapace strata shed: the n layers beneath the carapace crumble into rock chunks layer by layer, flying across the battlefield trailing dust and slamming into the mountain's base; with each layer that goes in, the whole mountain grows a size and the crystals brighten.
//           (layer i slams in at 3.10 + 0.1i s)
//     3.18+0.1n  Rock roots: the last torn-off rock root shoots up from the ground and joins at the very bottom, the crystals and light at the mountain's base light up together, and the whole mountain is torn up by the roots.
//           At the same time it cuts to low ground behind the tortoise on the audience side, looking up (signature shot): the tortoise and the mountain on its back at lower left, a mountain several times bigger than it hanging in the sky across the way,
//           the opponent beneath the mountain; the surroundings fade, and only the mountain keeps its color. Sound: the heaviest impact and a dull thud.
//     +0.50 End (the mountain hangs, rubble falling from the rock roots)
//   deliver (0.96 s: the length of the timeline is the time it takes the mountain's base to press down onto the opponent's head)
//     0.00  Rear up again: the tortoise props up its front half again, and the mountain across the way lifts up with it (1.6 units), the mountain's base brighter. The camera stays behind the tortoise and tilts up with the mountain.
//           Sound: an earth rumble, strata grinding.
//     0.34  Comes down; 0.44 stomp: the tortoise stomps, the mountain collapses and the sky falls (faster and faster). Sound: the stomp, the wind of the fall (loudest at the impact).
//     0.46  Sky collapse (cut): the camera on the opponent's audience side (72°), as high as the mountain, seeing the whole side of the mountain, descending with the mountain all the way to ground level (target's view):
//           the opponent in the foreground, the mountain pressing down from above, the tortoise in the distance, all three in one frame; radial blur centered on the mountain's base, speed lines growing stronger, the mountain's shadow covering the opponent all the way.
//     0.96  The mountain's base touches the opponent's head (handed to the director to play the impact)
//   impact (quietHit: the director does not stack the generic hit VFX, and the impact visuals are made here)
//     0.00  The mountain slams into the ground: warm white flash, 0.26 s of hit-stop, the mountain body squashed once; a ring of rock slabs turns up around the ground, a dust wall rolls out, a shockwave ring (not larger than the camera distance),
//           amber cracks, rubble sprayed upward; the rock columns surrounding the opponent are pressed into the ground. Sound: the roar of the mountain collapsing, ultra-low frequency.
//     0.04  Crumble: the summit and the three layers above it shift apart, topple and roll away from the camera, amber sparks bursting from the seams, while the two layers below and the rock roots sink into the ground, revealing the opponent;
//           from 1.1 s all the wreckage sinks into the ground. Sound: a rockslide.
//     0.34  The camera retreats toward the usual battle camera and rises, so the extent of the collapse and the tortoise can be seen.
//     1.15  Post-processing eases back to normal, and after another 0.5 s it pulls back to the wide shot (the battle text is read in the wide shot).
//   guarded: the mountain presses on the barrier and holds, the mountain's base lights up, the camera retreats a little so the mountain can be seen pressing on the barrier; then it crumbles down on both sides of the barrier.
//   after: the mountain stands up again: three new layers of strata rise from the ground under the tortoise's feet and are clamped back beneath the carapace layer by layer (one sound per layer), then withdraw into the rim;
//          weights go to zero, the shell pose is restored, and all VFX are removed. The camera has already been pulled back to the wide shot by settle.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { playOr, preloadSamples } from '../../../audio/samples.ts';
import { sfx, synth } from '../../../audio/sfx.ts';
import awakenUrl from '../../../audio/sfx/terragon-awaken.mp3';
import collapseUrl from '../../../audio/sfx/terragon-collapse.mp3';
import crackUrl from '../../../audio/sfx/terragon-crack.mp3';
import crashUrl from '../../../audio/sfx/terragon-crash.mp3';
import descentUrl from '../../../audio/sfx/terragon-descent.mp3';
import grindUrl from '../../../audio/sfx/terragon-grind.mp3';
import riftUrl from '../../../audio/sfx/terragon-rift.mp3';
import riseUrl from '../../../audio/sfx/terragon-rise.mp3';
import slamUrl from '../../../audio/sfx/terragon-slam.mp3';
import stompUrl from '../../../audio/sfx/terragon-stomp.mp3';
import { crackTex } from '../../../render/fxtex.ts';
import { playTimeline } from '../../../render/gsapClock.ts';
import { INK_LAYER, registerInkRoot } from '../../../render/ink.ts';
import { sceneMaterial, type SpiritMaterial } from '../../../render/spiritToon.ts';
import { glowTex } from '../../../render/textures.ts';
import { ease } from '../../../render/tween.ts';
import type { FxLayer } from '../../../render/vfx.ts';
import { ultSfx } from '../cine.ts';
import { ultGuarded } from '../generic.ts';
import { defineSsr, eyeGlint } from '../ssr.ts';
import type { HitEv, UltCtx } from '../types.ts';

const FILES = [awakenUrl, stompUrl, riftUrl, crackUrl, riseUrl, slamUrl, grindUrl, descentUrl, crashUrl, collapseUrl];
// The script is preloaded when the spirit enters the battle: take the chance to get the audio files ready
preloadSamples(...FILES);

const AMBER = 0xffb347;
const AMBER_HI = 0xffe2a8;
const EMBER = 0xff7a1a;
const DUST = [0xb08c5c, 0x8a6a44, 0xd8b884];
const PEBBLE = [0x4a3a30, 0x6a5a4c, 0x5a4a40];
const BASALT = 0x6a605a;
const BASALT_TOP = 0xb3a898;
const ROOT = 0x5a4a40;
const PEAK = 0x9d958c;
const SNOW = 0xeef3f8;
const PINE = 0x2f6a40;
const CRYSTAL = 0xffb040;
/**
 * The mountain in the sky is a whole block of earth torn up by the roots: on top is the mountain (main peak, snow cap, meadow and pine forest), and below is a cross-section of the strata, narrowing layer by layer into the rock roots.
 * Five layers of sedimentary rock (bottom to top): base color, hardness (hard layers bulge outward in the middle, soft ones are concave), and thickness (in units where the top-face radius = 1).
 * Basalt, grey shale, limestone, slate, yellow sandstone: the colors avoid red and orange, so they can still be told apart standing in front of a red-rock canyon.
 */
const BANDS = [
  { col: 0x5a5a66, hard: 1.07, t: 0.22 },
  { col: 0x8f8a7c, hard: 0.95, t: 0.27 },
  { col: 0xe3dcc4, hard: 1.08, t: 0.2 },
  { col: 0x5f6f86, hard: 0.95, t: 0.27 },
  { col: 0xc9a25a, hard: 1.06, t: 0.22 },
];
const MEADOW = 0x7c9a4c;
/** The strata beneath the carapace (top to bottom): the same colors as the strata of the mountain in the sky, so that as they fly over and merge into the mountain's base it can be seen they are the same rock */
const SHELL_COLS = [0xc9a25a, 0x8f8a7c, 0x5f6f86];
/** Total thickness of the strata cross-section, height of the main peak (above the meadow), and length of the rock roots */
const HB = BANDS.reduce((s, b) => s + b.t, 0);
const HP = 1.4;
const HR = 0.75;
/** Height from the bottom face of the lowest stratum to the summit */
const HT = HB + 0.03 + HP;
/** Tilt of the strata (tipping up along the mountain's local +x) */
const DIP = 0.15;
const STRATA_MAX = 3;
const UP = new THREE.Vector3(0, 1, 0);
const hash = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453;
  return x - Math.floor(x);
};

// Timetable (seconds): each beat of the shot list; the seconds in the file header match these
const T = {
  glint: 0.22,
  rear: 0.6,
  drop: 1.08,
  stomp: 1.2,
  rift: 1.3,
  riftDur: 0.62,
  lift: 2.04,
  gap: 0.1,
  fly: 0.5,
  /** The time at which stratum 0 of the carapace strata slams into the mountain's base; each layer after that +0.1 */
  shellHit: 3.1,
  shellFly: 0.51,
  hold: 0.5,
  // deliver
  reDrop: 0.34,
  reStomp: 0.44,
  cutFall: 0.46,
  deliver: 0.96,
};
const lockAt = T.rift + T.riftDur;
/** The height the mountain is lifted to during deliver */
const LIFT = 1.6;
/** Bearing of the target's view (the opponent's audience side, slightly behind; the space to retreat into is empty in every arena) */
const TV_YAW = 72;

// ───────────────────────── State ─────────────────────────

/** The geometry of this cinematic: all computed from the positions and heights of the two sides */
interface Geo {
  h: number;
  hf: number;
  C: THREE.Vector3;
  F: THREE.Vector3;
  /** The horizontal direction from the caster toward the opponent */
  f: THREE.Vector3;
  /** The horizontal direction of the audience side */
  a: THREE.Vector3;
  rift: THREE.CatmullRomCurve3;
  riftLen: number;
  /** Size of the mountain: local 1 = R world units (before the carapace strata merge in) */
  R: number;
  /** World height of the bottom face center of the lowest stratum once everything is joined and hanging in the sky */
  Yo: number;
  /** Orientation of the mountain: local +x (the direction the strata tip up) points toward the direction of the attack */
  q: THREE.Quaternion;
}

interface Piece {
  g: THREE.Group;
  kind: 'peak' | 'band' | 'root';
  /** Which layer (strata 0 to 4; spire 5; rock roots -1) */
  k: number;
  /** The center of this piece in the mountain's local coordinates */
  c: THREE.Vector3;
  /** How much the whole mountain is pushed up when this one joins (local units) */
  thick: number;
  /** Half-height of the bounding box (local units), used on landing when it crumbles */
  hh: number;
  from: THREE.Vector3;
  q0: THREE.Quaternion;
  spin: THREE.Vector3;
  fly: { k: number };
  state: 'wait' | 'fly' | 'on' | 'free';
  v: THREE.Vector3;
  w: THREE.Vector3;
  rest: number;
  sink: number;
}

interface Mountain {
  root: THREE.Group;
  pieces: Piece[];
  /** The number of layers of carapace strata merged in (tweened): each layer makes the whole mountain 7% bigger */
  grow: { k: number };
  /** Thickness not yet joined (local units): the whole mountain is offset downward by this much */
  rem: { v: number };
  /** Downward displacement of the whole mountain (world; negative is lifted up) */
  drop: { y: number };
  /** Brightness of the crystals and light at the mountain's base */
  under: { k: number };
  /** Squash when slammed down (0 to 1) */
  squash: { k: number };
  /** Current world size and origin */
  S(): number;
  O(out: THREE.Vector3): THREE.Vector3;
  layer: FxLayer;
}

interface Column {
  base: THREE.Vector3;
  q: THREE.Quaternion;
  r: number;
  H: number;
  /** Time of breaking out of the ground (the clock of the column layer), Infinity = not yet */
  at: number;
  sinkAt: number;
}

interface Columns {
  mesh: THREE.InstancedMesh;
  rift: Column[];
  lock: Column[];
  crown: Column[];
  t: number;
  layer: FxLayer;
}

interface Rift {
  head: { k: number };
  fade: { k: number };
  kill(): void;
}

interface ShellStratum {
  g: THREE.Group;
  mat: SpiritMaterial;
  /** Local matrix relative to the shell anchor */
  local: THREE.Matrix4;
  state: 'hidden' | 'on' | 'fly' | 'gone';
  /** Squeezing out from beneath the rim (0 to 1) */
  out: { k: number };
  /** Retracting into the rim (used by after) */
  tuck: { k: number };
  /** Crumbling into rock chunks that fly to the mountain's base */
  chunks: { m: THREE.Mesh; from: THREE.Vector3; off: THREE.Vector3; delay: number; spin: THREE.Vector3; s: number }[];
  fly: { k: number };
}

interface Mem {
  n: number;
  g?: Geo;
  mt?: Mountain;
  cols?: Columns;
  rift?: Rift;
  shell: ShellStratum[];
  shellLayer?: FxLayer;
  layers: FxLayer[];
  /** Rubble falling from the rock roots while the mountain hangs */
  drip?: FxLayer;
  landed: boolean;
  collapsed: boolean;
  /** Shell pose (rearing, squash) */
  pose: { rear: number; squash: number };
}
const mem = (c: UltCtx): Mem => (c.mem.ter ??= { n: 0, shell: [], layers: [], landed: false, collapsed: false, pose: { rear: 0, squash: 0 } }) as Mem;

const creature = (c: UltCtx) => c.sc.slots[c.side].creature;
/** The tortoise's action weights (only effective on the experimental model) */
const act = (c: UltCtx): Record<string, number> => creature(c)?.act ?? {};
const low = (c: UltCtx): boolean => c.sc.stage.quality === 'low';

/** Current number of strata layers (at the moment of the use event) */
function strataCount(c: UltCtx): number {
  const sd = c.view.sides[c.side];
  const me = sd.team[sd.active];
  const m = me?.marks?.find((x) => x.id === 'kit:strata');
  return Math.min(STRATA_MAX, Math.max(0, m?.n ?? 0));
}

/** World position of an anchor; use fallback when there is no such anchor */
function anchorPos(c: UltCtx, name: string, fallback: () => THREE.Vector3): THREE.Vector3 {
  const cr = creature(c);
  const a = cr?.anchor(name);
  if (!cr || !a) return fallback();
  cr.root.updateMatrixWorld(true);
  return a.getWorldPosition(new THREE.Vector3());
}

function geometry(c: UltCtx): Geo {
  const { sc, side, foe, cine } = c;
  const cr = creature(c);
  const fc = sc.slots[foe].creature;
  const h = cr?.worldHeight ?? 2;
  const hf = fc?.worldHeight ?? 1.5;
  const C = sc.slots[side].home.clone().setY(0);
  const F = sc.slots[foe].home.clone().setY(0);
  const f = cine.forward(side);
  const a = cine.orbitPos(side, new THREE.Vector3(), 90, 1, 0).setY(0).normalize();
  // Rift: from in front of the tortoise's front feet to the opponent's feet, with a few small zigzags left and right
  const P0 = C.clone().addScaledVector(f, (cr?.width ?? 2) * 0.42);
  const P1 = F.clone().addScaledVector(f, -((fc?.width ?? 1.2) * 0.3 + 0.35));
  const side3 = new THREE.Vector3().crossVectors(UP, f).normalize();
  const offs = [0, 0.2, -0.16, 0.22, -0.12, 0];
  const pts = offs.map((o, i) => P0.clone().lerp(P1, i / (offs.length - 1)).addScaledVector(side3, o).setY(0));
  const rift = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const R = 2.1 + hf * 0.1;
  const Yo = hf + 1.4 + HR * R;
  const q = new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(-f.z, f.x));
  return { h, hf, C, F, f, a, rift, riftLen: rift.getLength(), R, Yo, q };
}

/** Horizontal direction by bearing relative to the caster (see cine.orbitPos: 0 = toward the opponent, 90 = the audience side) */
function dirAt(c: UltCtx, yaw: number): THREE.Vector3 {
  return c.cine.orbitPos(c.side, new THREE.Vector3(), yaw, 1, 0).setY(0).normalize();
}

// ───────────────────────── Camera ─────────────────────────

/** The program sets the camera position every frame (fx clock); automatically void when another camera move takes over */
function ride(c: UltCtx, fn: (pos: THREE.Vector3, look: THREE.Vector3, dt: number) => void): void {
  const rig = c.sc.rig;
  const tok = rig.claim();
  const layer = c.sc.vfx.layer(new THREE.Object3D(), (dt) => {
    if (!rig.owns(tok)) {
      layer.kill();
      return;
    }
    fn(rig.pos, rig.look, dt);
  });
  mem(c).layers.push(layer);
}

// ───────────────────────── Geometry of the solid stones ─────────────────────────

const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();
const _n = new THREE.Vector3();
/** A flat-shaded triangle: the normal faces the out side */
function tri(pos: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, out: THREE.Vector3): void {
  _e1.subVectors(b, a);
  _e2.subVectors(c, a);
  _n.crossVectors(_e1, _e2);
  if (_n.dot(out) >= 0) pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  else pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
}

function toGeo(pos: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // Vertices are not shared: the normal of each face is flat, so under cartoon shading each face gets its own tone step
  g.computeVertexNormals();
  return g;
}

const ringCenter = (ring: THREE.Vector3[]): THREE.Vector3 => ring.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(ring.length);

/**
 * A solid stone built from stacked rings: rings go from bottom to top, each with the same number of points; if top or bottom is given a point it closes to a pointed tip, otherwise it is capped flat with the center of that ring.
 */
function ringSolid(rings: THREE.Vector3[][], o: { top?: THREE.Vector3; bottom?: THREE.Vector3 } = {}): THREE.BufferGeometry {
  const pos: number[] = [];
  const N = rings[0].length;
  const out = new THREE.Vector3();
  for (let r = 0; r + 1 < rings.length; r++) {
    const A = rings[r];
    const B = rings[r + 1];
    const cm = ringCenter(A).add(ringCenter(B)).multiplyScalar(0.5);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      out.set((A[i].x + A[j].x + B[i].x + B[j].x) / 4 - cm.x, 0, (A[i].z + A[j].z + B[i].z + B[j].z) / 4 - cm.z);
      tri(pos, A[i], A[j], B[j], out);
      tri(pos, A[i], B[j], B[i], out);
    }
  }
  const cap = (ring: THREE.Vector3[], tip: THREE.Vector3 | undefined, dir: number) => {
    const cc = ringCenter(ring);
    const c0 = tip ?? cc;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      if (tip) out.set((ring[i].x + ring[j].x) / 2 - cc.x, dir * 0.3, (ring[i].z + ring[j].z) / 2 - cc.z);
      else out.set(0, dir, 0);
      tri(pos, ring[i], ring[j], c0, out);
    }
  };
  cap(rings[rings.length - 1], o.top, 1);
  cap(rings[0], o.bottom, -1);
  return toGeo(pos);
}

/** A ring-shaped solid stone (the strata beneath the carapace): the outer ring has several rings from bottom to top, the inner ring has two rings at top and bottom, closing the top and bottom faces */
function annulusSolid(outer: THREE.Vector3[][], inner: [THREE.Vector3[], THREE.Vector3[]]): THREE.BufferGeometry {
  const pos: number[] = [];
  const N = outer[0].length;
  const out = new THREE.Vector3();
  const wall = (A: THREE.Vector3[], B: THREE.Vector3[], sign: number) => {
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      out.set(((A[i].x + A[j].x) / 2) * sign, 0, ((A[i].z + A[j].z) / 2) * sign);
      tri(pos, A[i], A[j], B[j], out);
      tri(pos, A[i], B[j], B[i], out);
    }
  };
  for (let r = 0; r + 1 < outer.length; r++) wall(outer[r], outer[r + 1], 1);
  wall(inner[0], inner[1], -1);
  const lid = (A: THREE.Vector3[], B: THREE.Vector3[], dir: number) => {
    out.set(0, dir, 0);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      tri(pos, A[i], A[j], B[j], out);
      tri(pos, A[i], B[j], B[i], out);
    }
  };
  lid(outer[outer.length - 1], inner[1], 1);
  lid(outer[0], inner[0], -1);
  return toGeo(pos);
}

/** A pointed cone (rock roots, side peaks, pine trees, crystals): the base's n-gon tapers toward tip */
function spike(base: THREE.Vector3, tip: THREE.Vector3, r: number, n: number, seed: number): THREE.BufferGeometry {
  const d = tip.clone().sub(base).normalize();
  const e1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).normalize();
  const e2 = new THREE.Vector3().crossVectors(d, e1);
  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const t = ((i + hash(seed + i) * 0.3) / n) * Math.PI * 2;
    ring.push(base.clone().addScaledVector(e1, Math.cos(t) * r).addScaledVector(e2, Math.sin(t) * r));
  }
  const pos: number[] = [];
  const out = new THREE.Vector3();
  const back = d.clone().negate();
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    out.copy(ring[i]).add(ring[j]).multiplyScalar(0.5).sub(base);
    tri(pos, ring[i], ring[j], tip, out);
    tri(pos, ring[i], ring[j], base, back);
  }
  return toGeo(pos);
}

/** Crystal: a hexagonal prism pointed at both ends (long point on top, short point below) */
function crystalGeo(base: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, seed: number): THREE.BufferGeometry {
  const d = dir.clone().normalize();
  const mid = base.clone().addScaledVector(d, len * 0.3);
  const a = spike(mid, base.clone().addScaledVector(d, len), r, 6, seed);
  const b = spike(mid, base.clone().addScaledVector(d, -len * 0.15), r, 6, seed);
  const g = mergeGeometries([a, b])!;
  a.dispose();
  b.dispose();
  return g;
}

/** A faceted piece of rubble (unit size; the shape is squashed and stretched by seed) */
function rockGeo(seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 0);
  g.scale(0.8 + hash(seed) * 0.5, 0.55 + hash(seed * 2) * 0.35, 0.7 + hash(seed * 3) * 0.4);
  g.computeVertexNormals();
  return g;
}

function solid(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.layers.enable(INK_LAYER);
  m.userData.inkScene = true;
  return m;
}

// ───────────────────────── The mountain in the sky ─────────────────────────

type PieceSpec = { kind: Piece['kind']; k: number; parts: { geo: THREE.BufferGeometry; mat: string }[]; thick: number };

/**
 * Each piece of the mountain (local coordinates where the top-face radius = 1, with the origin at the bottom face center of the lowest stratum).
 * Strata cross-section: five layers narrowing from the top face downward (the top face is widest), with adjacent layers sharing one outline so the silhouette connects; the hard layers bulge outward in the middle and the soft ones are concave,
 * with vertical ridges and grooves on the rock face; the whole stack is sheared along local +x into slanted strata. On top is a layer of meadow, and standing off to one side of the meadow is the main peak (leaning back, the slope steeper the higher it goes),
 * two side peaks, a snow cap, a ring of pine forest. Below is the rock root tapering downward into a clump, hanging rock spikes and growing downward-pointing crystals.
 * Returns the order of joining: the summit (meadow, main peak, side peaks, snow cap, pine forest), yellow sandstone → basalt (two layers set with crystal clusters), the rock roots.
 */
function buildPieceGeos(lo: boolean): PieceSpec[] {
  const N = lo ? 11 : 15;
  const TH = Array.from({ length: N }, (_, i) => ((i + (hash(i * 3.7 + 1) - 0.5) * 0.45) / N) * Math.PI * 2);
  /** Outline on the plane: not a perfect circle, with a few large bends */
  const foot = (i: number) => 1 + 0.08 * Math.sin(2 * TH[i] + 1.3) + 0.06 * Math.sin(3 * TH[i] + 0.4);
  /** Ridges and grooves: the same angle bulges (or dips) on every ring */
  const ridge = (i: number, amt: number) => 1 + amt * (i % 2 ? 1 : -1) * (0.5 + 0.5 * hash(i * 2.3));
  /** Undulation of each ring and each cell (the two adjacent pieces above and below share the same ring) */
  const nz = (row: number, i: number, amt: number) => 1 + (hash(row * 31.7 + i * 7.3) - 0.5) * 2 * amt;
  /** Radius of the strata cross-section: widest at the top face, narrowing downward */
  const bandR = (y: number) => 0.5 + 0.5 * Math.pow(Math.max(0, y / HB), 0.8);
  const bp = (i: number, y: number, rm: number) => {
    const r = foot(i) * ridge(i, 0.05) * bandR(y) * rm;
    const x = Math.cos(TH[i]) * r;
    return new THREE.Vector3(x, y + DIP * x, Math.sin(TH[i]) * r);
  };
  const bottoms: number[] = [];
  {
    let y = 0;
    for (const b of BANDS) {
      bottoms.push(y);
      y += b.t;
    }
  }
  const out: PieceSpec[] = [];

  // ── Summit: meadow, main peak, two side peaks, snow cap, pine forest ──
  {
    const top = TH.map((_, i) => bp(i, HB, nz(BANDS.length * 2, i, 0.04)));
    // Meadow: hugging the top face of the uppermost stratum, a thin layer, slightly raised in the middle
    const g1 = top.map((p) => new THREE.Vector3(p.x * 0.97, p.y + 0.06, p.z * 0.97));
    const parts: { geo: THREE.BufferGeometry; mat: string }[] = [{ geo: ringSolid([top, g1], { top: ringCenter(g1).add(new THREE.Vector3(0, 0.05, 0)) }), mat: 'meadow' }];
    // Main peak: off-center, leaving a patch of meadow; its base ring follows the strata tilt, getting straighter and steeper going up, and leaning back
    const PC = new THREE.Vector3(-0.1, 0, 0.08);
    const PB = 0.72;
    const LEAN = new THREE.Vector3(0.12, 0, -0.1);
    const pk = (i: number, f: number, rm: number) => {
      const r = PB * Math.pow(Math.max(0, 1 - f), 1.3) * ridge(i, 0.15) * rm;
      const l = Math.pow(f, 1.5);
      const x = PC.x + Math.cos(TH[i]) * r + LEAN.x * l;
      return new THREE.Vector3(x, HB + 0.03 + DIP * x * (1 - f) + f * HP, PC.z + Math.sin(TH[i]) * r + LEAN.z * l);
    };
    const fs = [0, 0.24, 0.47, 0.7];
    const rings = fs.map((f, r) => TH.map((_, i) => pk(i, f, r === 0 ? 1 : nz(60 + r, i, 0.1 + r * 0.04))));
    const apex = new THREE.Vector3(PC.x + LEAN.x, HB + 0.03 + HP, PC.z + LEAN.z);
    parts.push({ geo: ringSolid(rings, { top: apex }), mat: 'peak' });
    const cR = (r: number) => ringCenter(rings[r]);
    for (const [i, hk, sd] of [[2, 0.42, 1], [Math.round(N * 0.6), 0.32, 2]] as const) {
      const b = rings[1][i].clone().lerp(cR(1), 0.35);
      const outD = rings[1][i].clone().sub(cR(1)).setY(0).normalize();
      const tip = b.clone().addScaledVector(outD, 0.14).add(new THREE.Vector3(0, HP * hk, 0));
      parts.push({ geo: spike(b.clone().add(new THREE.Vector3(0, -HP * 0.12, 0)), tip, 0.16, 5, sd * 7), mat: 'peak' });
    }
    // Snow cap: hugging the upper section and floating out a little, with a sawtooth of up-and-down on its lower edge
    const push = (p: THREE.Vector3, ctr: THREE.Vector3, k: number) => new THREE.Vector3(ctr.x + (p.x - ctr.x) * k, p.y, ctr.z + (p.z - ctr.z) * k);
    const sA = TH.map((_, i) => push(rings[1][i].clone().lerp(rings[2][i], i % 2 ? 0.25 : 0.8), cR(1).lerp(cR(2), 0.5), 1.08));
    const sB = TH.map((_, i) => push(rings[3][i], cR(3), 1.1));
    parts.push({ geo: ringSolid([sA, sB], { top: apex.clone().add(new THREE.Vector3(0, 0.03, 0)) }), mat: 'snow' });
    // Pine forest: between the foot of the main peak and the edge of the meadow, in clumps
    const pines: THREE.BufferGeometry[] = [];
    const np = lo ? 9 : 16;
    for (let s = 0; s < np; s++) {
      const a = hash(s * 4.1 + 2) * Math.PI * 2;
      const rr = PB * 1.05 + hash(s * 2.9) * 0.18;
      const x = PC.x + Math.cos(a) * rr;
      const z = PC.z + Math.sin(a) * rr;
      if (Math.hypot(x, z) > 0.9) continue;
      const p = new THREE.Vector3(x, HB + 0.07 + DIP * x, z);
      const hh = 0.14 + hash(s * 5.1) * 0.09;
      const tr = 0.045 + hash(s * 3.3) * 0.015;
      pines.push(spike(p, p.clone().add(new THREE.Vector3(0, hh, 0)), tr, 6, s));
      pines.push(spike(p.clone().add(new THREE.Vector3(0, hh * 0.45, 0)), p.clone().add(new THREE.Vector3(0, hh * 1.45, 0)), tr * 0.75, 6, s + 50));
    }
    if (pines.length) {
      parts.push({ geo: mergeGeometries(pines)!, mat: 'pine' });
      for (const p of pines) p.dispose();
    }
    out.push({ kind: 'peak', k: BANDS.length, parts, thick: 0 });
  }

  // ── Five strata (top to bottom, the order of joining) ──
  for (let k = BANDS.length - 1; k >= 0; k--) {
    const { hard, t } = BANDS[k];
    const b = bottoms[k];
    const r0 = TH.map((_, i) => bp(i, b, nz(k * 2, i, 0.04)));
    const r1 = TH.map((_, i) => bp(i, b + t * 0.3, nz(k * 2 + 1, i, 0.05) * hard));
    const r2 = TH.map((_, i) => bp(i, b + t * 0.7, nz(k * 2 + 1.5, i, 0.05) * hard));
    const r3 = TH.map((_, i) => bp(i, b + t, nz((k + 1) * 2, i, 0.04)));
    const parts: { geo: THREE.BufferGeometry; mat: string }[] = [{ geo: ringSolid([r0, r1, r2, r3]), mat: `band${k}` }];
    // Crystal clusters: set into the rock face of the two soft layers (the amber of the Earth source crystal)
    const cl: Record<number, number[]> = { 1: [2, 9], 3: [6, 12] };
    for (const at0 of cl[k] ?? []) {
      const at = at0 % N;
      const w = r1[at].clone().lerp(r2[at], 0.5);
      const outD = w.clone().setY(0).normalize();
      for (let s = 0; s < 3; s++) {
        const dir = outD.clone().add(new THREE.Vector3((hash(k * 5 + s + at) - 0.5) * 0.9, (hash(k * 7 + s) - 0.5) * 0.8, (hash(k * 9 + s + at) - 0.5) * 0.9)).normalize();
        const base = w.clone().addScaledVector(outD, -0.05).add(new THREE.Vector3((hash(k + s * 3 + at) - 0.5) * 0.14, (hash(k * 2 + s) - 0.5) * 0.05, (hash(k * 3 + s + at) - 0.5) * 0.14));
        parts.push({ geo: crystalGeo(base, dir, 0.2 + hash(k * 4 + s + at) * 0.12, 0.04 + hash(k + s) * 0.015, k * 13 + s + at), mat: 'crystal' });
      }
    }
    out.push({ kind: 'band', k, parts, thick: t });
  }

  // ── Rock roots: the torn-off underground, tapering downward into a clump, hanging a few rock spikes, set with downward-growing crystals ──
  {
    const r0 = TH.map((_, i) => bp(i, 0, nz(0, i, 0.04)));
    const rp = (i: number, y: number, rm: number) => new THREE.Vector3(Math.cos(TH[i]) * 0.5 * foot(i) * rm, y, Math.sin(TH[i]) * 0.5 * foot(i) * rm);
    const r1 = TH.map((_, i) => rp(i, -0.32 * HR, 0.8 * nz(70, i, 0.18)));
    const r2 = TH.map((_, i) => rp(i, -0.66 * HR, 0.45 * nz(71, i, 0.28)).add(new THREE.Vector3(0.04, 0, -0.03)));
    const tip = new THREE.Vector3(0.06, -HR, -0.04);
    const parts: { geo: THREE.BufferGeometry; mat: string }[] = [{ geo: ringSolid([r2, r1, r0], { bottom: tip }), mat: 'root' }];
    for (let i = 0; i < N; i += 2) {
      const b = r1[i].clone().lerp(ringCenter(r1), 0.12);
      const outD = b.clone().setY(0).normalize();
      const len = (0.3 + hash(i * 4.4) * 0.3) * HR;
      const tipP = b.clone().addScaledVector(outD, len * 0.3).add(new THREE.Vector3(0, -len, 0));
      parts.push({ geo: spike(b, tipP, 0.06 + hash(i) * 0.03, 5, 30 + i), mat: 'root' });
    }
    for (let s = 0; s < (lo ? 3 : 6); s++) {
      const i = (s * 2 + 1) % N;
      const b = r1[i].clone().lerp(r2[i], 0.5);
      const dir = b.clone().setY(0).normalize().multiplyScalar(0.8).add(new THREE.Vector3(0, -1, 0));
      parts.push({ geo: crystalGeo(b, dir, 0.18 + hash(s * 6.1) * 0.12, 0.04, 60 + s), mat: 'crystal' });
    }
    out.push({ kind: 'root', k: -1, parts, thick: HR });
  }
  return out;
}

/** The mountain: all the stones are built first (hidden), driven by tweens of flying, stacking, falling and crumbling */
function buildMountain(c: UltCtx, g: Geo): Mountain {
  const { sc } = c;
  const lo = low(c);
  const mats: Record<string, THREE.Material> = {
    peak: sceneMaterial(PEAK, { rim: 0.35 }),
    snow: sceneMaterial(SNOW, { rim: 0.3 }),
    pine: sceneMaterial(PINE, { rim: 0.3 }),
    meadow: sceneMaterial(MEADOW, { rim: 0.3 }),
    root: sceneMaterial(ROOT, { rim: 0.25, emissive: EMBER, emissiveAmt: 0 }),
  };
  BANDS.forEach((b, k) => (mats[`band${k}`] = sceneMaterial(b.col, { rim: 0.32 })));
  const crystalMat = sceneMaterial(CRYSTAL, { surface: 'gem', emissive: 0xff8a20, emissiveAmt: 0.45, rim: 0.5 });
  mats.crystal = crystalMat;
  const root = new THREE.Group();
  const pieces: Piece[] = [];
  const specs = buildPieceGeos(lo);
  // Position of breaking out of the ground: along the rift, the spire nearest the opponent, then back and forth toward the tortoise's side
  const along = [0.9, 0.66, 0.42, 0.78, 0.54, 0.3, 0.84];
  specs.forEach((sp, j) => {
    const grp = new THREE.Group();
    const box = new THREE.Box3();
    for (const p of sp.parts) {
      p.geo.computeBoundingBox();
      box.union(p.geo.boundingBox!);
    }
    const ctr = box.getCenter(new THREE.Vector3());
    const hh = (box.max.y - box.min.y) * 0.5;
    for (const p of sp.parts) {
      p.geo.translate(-ctr.x, -ctr.y, -ctr.z);
      grp.add(solid(p.geo, mats[p.mat]));
    }
    grp.visible = false;
    root.add(grp);
    const from = g.rift.getPointAt(along[j % along.length]).setY(-0.9);
    const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler((hash(j * 3.3) - 0.5) * 1.3, hash(j * 5.1) * 6.3, (hash(j * 7.7) - 0.5) * 1.3));
    pieces.push({ g: grp, kind: sp.kind, k: sp.k, c: ctr, thick: sp.thick, hh, from, q0, spin: new THREE.Vector3(hash(j) - 0.5, hash(j * 2) - 0.5, hash(j * 3) - 0.5).normalize(), fly: { k: 0 }, state: 'wait', v: new THREE.Vector3(), w: new THREE.Vector3(), rest: 0, sink: 0 });
  });
  // A patch of amber light beneath the rock roots (additive, visible only when looking up from below)
  const underMat = new THREE.MeshBasicMaterial({ map: glowTex(), color: new THREE.Color(AMBER).multiplyScalar(1.3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const rootPiece = pieces[pieces.length - 1];
  const under = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), underMat);
  under.rotation.x = Math.PI / 2;
  under.position.set(-rootPiece.c.x, -HR * 0.6 - rootPiece.c.y, -rootPiece.c.z);
  under.renderOrder = 3;
  rootPiece.g.add(under);
  registerInkRoot(root);

  const grow = { k: 0 };
  const rem = { v: pieces.reduce((s, p) => s + p.thick, 0) };
  const drop = { y: 0 };
  const underK = { k: 0 };
  const squash = { k: 0 };
  const S = () => g.R * (1 + 0.07 * grow.k);
  const O = (outV: THREE.Vector3) => outV.copy(g.F).setY(g.Yo - rem.v * S() - drop.y);
  const o = new THREE.Vector3();
  const p = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  const qf = new THREE.Quaternion();
  const b0 = new THREE.Vector3();
  const b1 = new THREE.Vector3();
  const b2 = new THREE.Vector3();
  const sq = new THREE.Vector3();
  const qTmp = new THREE.Quaternion();
  const ax = new THREE.Vector3();
  let time = 0;
  const layer = sc.vfx.layer(root, (dt) => {
    time += dt;
    const s = S();
    O(o);
    // Squash: relative to the mountain's base, y shrinks and xz spreads
    const kq = squash.k;
    sq.set(1 + kq * 0.08, 1 - kq * 0.16, 1 + kq * 0.08);
    for (const pc of pieces) {
      if (pc.state === 'wait') continue;
      if (pc.state === 'on') {
        p.copy(pc.c).multiply(sq).multiplyScalar(s).applyQuaternion(g.q);
        pc.g.position.copy(o).add(p);
        pc.g.quaternion.copy(g.q);
        pc.g.scale.set(s * sq.x, s * sq.y, s * sq.z);
      } else if (pc.state === 'fly') {
        // Target: beneath the stack as it is now (later pieces have not joined yet, and this stack's position changes every frame)
        tgt.copy(pc.c).multiplyScalar(s).applyQuaternion(g.q).add(o);
        const k = pc.fly.k;
        // First burst out of the ground and shoot up, pause in midair, then accelerate into the mountain's base
        b0.copy(pc.from);
        b1.copy(pc.from).setY(tgt.y * 0.62);
        b2.copy(tgt).add(new THREE.Vector3(0, -1.6 - pc.thick * s, 0));
        const iu = 1 - k;
        pc.g.position.set(0, 0, 0).addScaledVector(b0, iu * iu * iu).addScaledVector(b1, 3 * iu * iu * k).addScaledVector(b2, 3 * iu * k * k).addScaledVector(tgt, k * k * k);
        const settle = THREE.MathUtils.smoothstep(k, 0.25, 0.97);
        qTmp.setFromAxisAngle(pc.spin, Math.sin(k * Math.PI) * 0.9);
        qf.copy(pc.q0).multiply(qTmp).slerp(g.q, settle);
        pc.g.quaternion.copy(qf);
        pc.g.scale.setScalar(s * (0.42 + 0.58 * THREE.MathUtils.smoothstep(k, 0, 0.75)));
      } else {
        // Crumbling: each with its own velocity and spin, stopping after landing, then sinking into the ground
        const half = Math.max(0.12, pc.hh * s * 0.55);
        if (pc.rest < 1) {
          pc.v.y -= 11 * dt;
          pc.g.position.addScaledVector(pc.v, dt);
          const wl = pc.w.length();
          if (wl > 1e-4) {
            qTmp.setFromAxisAngle(ax.copy(pc.w).divideScalar(wl), wl * dt);
            pc.g.quaternion.premultiply(qTmp);
          }
          if (pc.g.position.y < half) {
            pc.g.position.y = half;
            if (pc.v.y < -2.5) {
              pc.v.y *= -0.2;
              pc.v.x *= 0.4;
              pc.v.z *= 0.4;
              pc.w.multiplyScalar(0.45);
            } else {
              pc.rest = 1;
            }
          }
        }
        if (pc.sink > 0) pc.g.position.y -= pc.sink * dt * s;
      }
    }
    const uk = underK.k;
    underMat.opacity = Math.min(1, uk) * (0.8 + 0.2 * Math.sin(time * 9));
    (mats.root as SpiritMaterial).uniforms.uEmissiveAmt.value = uk * 0.16;
    crystalMat.uniforms.uEmissiveAmt.value = 0.45 + uk * 0.25 + grow.k * 0.08;
  });
  return { root, pieces, grow, rem, drop, under: underK, squash, S, O, layer };
}

// ───────────────────────── Basalt columns ─────────────────────────

/** A hexagonal basalt column: unit height 1, radius 1, base at y = 0; two colors for the shaft and the top face */
function columnGeo(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.9, 1, 1, 6, 1).toNonIndexed();
  g.translate(0, 0.5, 0);
  g.computeVertexNormals();
  const n = g.attributes.normal as THREE.BufferAttribute;
  const col: number[] = [];
  const top = new THREE.Color(BASALT_TOP);
  const sideC = new THREE.Color(BASALT);
  for (let i = 0; i < n.count; i++) {
    const cc = n.getY(i) > 0.9 ? top : sideC;
    col.push(cc.r, cc.g, cc.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/**
 * Rock columns: a row on both sides of the rift breaking out of the ground following the crack, a ring surrounding the opponent (leaving the audience side open), and a ring of rock slabs the ground turns up when the mountain slams down.
 * One instanced mesh, updated on the CPU every frame (the outline channel only takes instanceMatrix), with the bounding sphere enlarged to the whole battlefield.
 */
function buildColumns(c: UltCtx, g: Geo): Columns {
  const { sc } = c;
  const lo = low(c);
  const rift: Column[] = [];
  const lock: Column[] = [];
  const crown: Column[] = [];
  const side3 = new THREE.Vector3().crossVectors(UP, g.f).normalize();
  const tiltQ = (out: THREE.Vector3, amt: number, yaw: number) => {
    const axis = new THREE.Vector3().crossVectors(UP, out).normalize();
    return new THREE.Quaternion().setFromAxisAngle(axis, amt).multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
  };
  // Only grown on the far side of the rift (the camera follows on the audience side, and columns on the near side would block the crack)
  const far = side3.dot(g.a) > 0 ? -1 : 1;
  const step = lo ? 0.5 : 0.34;
  let idx = 0;
  for (let s = 0.45; s < g.riftLen - 0.3; s += step) {
    const u = s / g.riftLen;
    const p = g.rift.getPointAt(u);
    for (const sgn of [far]) {
      idx++;
      const outD = side3.clone().multiplyScalar(sgn);
      const off = 0.75 + hash(idx * 1.7) * 0.35;
      const H = (0.6 + hash(idx * 3.1) * 0.7) * (0.75 + u * 0.6);
      rift.push({ base: p.clone().addScaledVector(outD, off).addScaledVector(g.f, (hash(idx * 5.3) - 0.5) * 0.25), q: tiltQ(outD, 0.2 + hash(idx * 2.9) * 0.3, hash(idx) * 6.3), r: 0.2 + hash(idx * 4.7) * 0.12, H, at: Infinity, sinkAt: Infinity });
    }
  }
  // The ring surrounding the opponent: leaning inward, with a gap left on the audience side (the camera)
  const nLock = lo ? 7 : 11;
  const ringR = g.hf * 0.28 + 1.0;
  for (let i = 0; i < nLock; i++) {
    const th = (i / nLock) * Math.PI * 2 + 0.2;
    const d = g.f.clone().multiplyScalar(Math.cos(th)).addScaledVector(g.a, Math.sin(th));
    if (d.dot(g.a) > 0.6) continue;
    const H = (1.2 + hash(i * 7.3) * 0.9) * (0.75 + g.hf * 0.22);
    lock.push({ base: g.F.clone().addScaledVector(d, ringR + hash(i * 2.2) * 0.25), q: tiltQ(d, -(0.2 + hash(i * 3.9) * 0.16), hash(i * 1.1) * 6.3), r: 0.24 + hash(i * 5.5) * 0.1, H, at: Infinity, sinkAt: Infinity });
  }
  // Rock slabs turned up from the ground: a ring around the mountain's foot turning outward when the mountain slams down
  const nCrown = lo ? 8 : 14;
  const Rn = g.R * (1 + 0.07 * mem(c).n);
  const tvDir = dirAt(c, TV_YAW);
  for (let i = 0; i < nCrown; i++) {
    const th = (i / nCrown) * Math.PI * 2 + hash(i * 9.9) * 0.3;
    const d = g.f.clone().multiplyScalar(Math.cos(th)).addScaledVector(g.a, Math.sin(th));
    // The side of the target's view does not turn up, so it does not block the front of the camera
    if (d.dot(tvDir) > 0.3) continue;
    crown.push({ base: g.F.clone().addScaledVector(d, Rn * 1.2 + hash(i * 4.4) * 0.4), q: tiltQ(d, 0.6 + hash(i * 6.6) * 0.3, hash(i * 8.8) * 6.3), r: 0.28 + hash(i * 3.3) * 0.16, H: 0.7 + hash(i * 2.7) * 0.7, at: Infinity, sinkAt: Infinity });
  }
  const all = [...rift, ...lock, ...crown];
  const mat = sceneMaterial(0xffffff, { rim: 0.3 });
  mat.vertexColors = true;
  const mesh = new THREE.InstancedMesh(columnGeo(), mat, all.length);
  mesh.layers.enable(INK_LAYER);
  mesh.userData.inkScene = true;
  mesh.frustumCulled = false;
  const mid = g.C.clone().lerp(g.F, 0.5);
  mesh.boundingSphere = new THREE.Sphere(mid, g.C.distanceTo(g.F) * 0.5 + g.R * 2 + 3);
  const tint = new THREE.Color();
  all.forEach((_col, i) => mesh.setColorAt(i, tint.setScalar(0.85 + hash(i * 1.9) * 0.3)));
  registerInkRoot(mesh);
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const off = new THREE.Vector3();
  const st: Columns = { mesh, rift, lock, crown, t: 0, layer: null as unknown as FxLayer };
  const place = () => {
    all.forEach((col, i) => {
      const age = st.t - col.at;
      if (age < 0) {
        m4.makeScale(1e-4, 1e-4, 1e-4);
        mesh.setMatrixAt(i, m4);
        return;
      }
      // Breaking out of the ground: bursts out in 0.16 s, overshoots slightly and settles back
      const e = ease.outBack(Math.min(1, age / 0.16));
      const sk = Math.min(1, Math.max(0, (st.t - col.sinkAt) / 0.35));
      const y = -col.H * (1 - e) - col.H * 1.05 * sk * sk;
      off.set(0, y, 0).applyQuaternion(col.q);
      pos.copy(col.base).add(off);
      scl.set(col.r, col.H, col.r);
      m4.compose(pos, col.q, scl);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  place();
  st.layer = sc.vfx.layer(mesh, (dt) => {
    st.t += dt;
    place();
  });
  return st;
}

// ───────────────────────── Rift ─────────────────────────

/** Rift: a band of ground along the path. A dark crack (normal blending) + the amber light of the earth veins (additive), brightest at the head of the crack */
function buildRift(c: UltCtx, g: Geo): Rift {
  const { sc } = c;
  const SEG = 120;
  const W = 1.2;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const side3 = new THREE.Vector3();
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG;
    g.rift.getPointAt(u, p);
    g.rift.getTangentAt(u, tan);
    side3.crossVectors(UP, tan).normalize();
    pos.push(p.x - side3.x * W, 0, p.z - side3.z * W, p.x + side3.x * W, 0, p.z + side3.z * W);
    uv.push(u, 0, u, 1);
    // Triangles face up (the front when seen from above, otherwise they would be back-face culled)
    if (i < SEG) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const common = /* glsl */ `
    uniform float uHead; uniform float uL; uniform float uA; uniform float uT;
    varying vec2 vUv;
    float jag(float s){ return sin(s * 7.1 + 1.3) * 0.5 + sin(s * 13.7) * 0.3 + sin(s * 29.3 + 2.1) * 0.2; }
    // Shape of the crack (world units): the center line bends left and right, the width varies along the way and is still narrow where it has just opened; returns the distance to the center line and the half-width
    vec2 crack(){
      float s = vUv.x * uL;
      float age = (uHead - vUv.x) * uL;
      float lat = (vUv.y * 2.0 - 1.0) * ${W.toFixed(2)};
      float off = jag(s * 1.3) * 0.22 + jag(s * 4.1 + 3.0) * 0.05;
      float w = (0.3 + 0.08 * sin(s * 2.3 + 0.7)) * clamp(age * 1.6 + 0.25, 0.0, 1.0);
      w *= smoothstep(0.0, 0.3, s) * (1.0 - smoothstep(uL - 0.3, uL, s));
      return vec2(abs(lat - off), max(w, 1e-3));
    }`;
  const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const uniforms = () => ({ uHead: { value: 0 }, uL: { value: g.riftLen }, uA: { value: 1 }, uT: { value: 0 } });
  const dark = new THREE.ShaderMaterial({
    uniforms: uniforms(),
    vertexShader: vert,
    fragmentShader: /* glsl */ `${common}
      void main(){
        if (vUv.x > uHead) discard;
        vec2 cw = crack();
        float a = (1.0 - smoothstep(cw.y * 1.1, cw.y * 1.9, cw.x)) * 0.9 * uA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(0.13, 0.08, 0.05, a);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const glow = new THREE.ShaderMaterial({
    uniforms: uniforms(),
    vertexShader: vert,
    fragmentShader: /* glsl */ `${common}
      void main(){
        if (vUv.x > uHead) discard;
        vec2 cw = crack();
        float age = max((uHead - vUv.x) * uL, 0.0);
        float core = 1.0 - smoothstep(cw.y * 0.2, cw.y * 0.8, cw.x);
        float head = exp(-age * 1.6);
        float flick = 0.85 + 0.15 * sin(uT * 9.0 + vUv.x * uL * 3.0);
        float halo = exp(-cw.x / cw.y * 1.6) * 0.35;
        // Deep in the crack it is orange-red with a pale yellow center; the head of the crack is brightest
        vec3 col = mix(vec3(1.0, 0.3, 0.04), vec3(1.0, 0.7, 0.3), core * core) * (core * (0.75 + head * 1.3) + halo) * flick * uA;
        gl_FragColor = vec4(col, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const md = new THREE.Mesh(geo, dark);
  const mg = new THREE.Mesh(geo, glow);
  // The arena's ground is not flat in places (sand, magic circles), and if it is stuck on too low it would be covered
  md.position.y = 0.07;
  mg.position.y = 0.075;
  md.renderOrder = 2;
  mg.renderOrder = 3;
  md.frustumCulled = false;
  mg.frustumCulled = false;
  const grp = new THREE.Group();
  grp.add(md, mg);
  const head = { k: 0 };
  const fade = { k: 1 };
  const layer = sc.vfx.layer(grp, (_dt, t) => {
    for (const mm of [dark, glow]) {
      mm.uniforms.uHead.value = head.k;
      mm.uniforms.uA.value = fade.k;
      mm.uniforms.uT.value = t;
    }
    grp.visible = head.k > 0.001 && fade.k > 0.001;
  });
  return { head, fade, kill: () => layer.kill() };
}

// ───────────────────────── The carapace's strata ─────────────────────────

/**
 * The strata beneath the carapace (in the shell anchor's local coordinates; see the notes in terragonModel: outer diameter 0.6, 1.18 times in the z direction, 0.08 per layer going down):
 * a ring of faceted rock, the topmost layer slightly wider than the rim and each layer below narrower than the last, so from the side they read as stepped strata; the outer wall bulges in the middle and is recessed at top and bottom.
 */
function shellGeo(i: number): THREE.BufferGeometry {
  const N = 14;
  const Ro = 0.6 - i * 0.045;
  const Ri = 0.38;
  const y0 = -0.03 - i * 0.08;
  const t = 0.078;
  const ring = (y: number, r: (k: number) => number) =>
    Array.from({ length: N }, (_, k) => {
      const a = ((k + (hash(i * 9 + k) - 0.5) * 0.3) / N) * Math.PI * 2;
      const rr = r(k);
      return new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr * 1.18);
    });
  const j = (k: number, s: number) => 1 + (hash(i * 31 + k * 7 + s) - 0.5) * 0.1;
  const outer = [ring(y0, (k) => Ro * 0.92 * j(k, 1)), ring(y0 + t * 0.45, (k) => Ro * 1.05 * j(k, 2)), ring(y0 + t, (k) => Ro * 0.97 * j(k, 3))];
  const inner: [THREE.Vector3[], THREE.Vector3[]] = [ring(y0, () => Ri), ring(y0 + t, () => Ri)];
  return annulusSolid(outer, inner);
}

/** The strata beneath the carapace: hidden at first; the rubble is also built first (when peeled off, one layer crumbles into 7 pieces that fly to the mountain's base) */
function buildShellStrata(c: UltCtx, n: number): { list: ShellStratum[]; layer?: FxLayer } {
  const { sc } = c;
  const cr = creature(c);
  const shell = cr?.anchor('shell');
  if (!cr || !shell || n <= 0) return { list: [] };
  const root = new THREE.Group();
  const list: ShellStratum[] = [];
  const chunkGeos = [0, 1, 2, 3].map((s) => rockGeo(s * 3 + 1));
  for (let i = 0; i < n; i++) {
    const mat = sceneMaterial(SHELL_COLS[i % SHELL_COLS.length], { rim: 0.4, emissive: AMBER, emissiveAmt: 0 });
    const g = new THREE.Group();
    g.add(solid(shellGeo(i), mat));
    g.visible = false;
    root.add(g);
    const chunks: ShellStratum['chunks'] = [];
    for (let k = 0; k < 7; k++) {
      const m = solid(chunkGeos[(i + k) % chunkGeos.length], mat);
      m.visible = false;
      root.add(m);
      const a = (k / 7) * Math.PI * 2 + hash(i * 7 + k) * 0.5;
      chunks.push({ m, from: new THREE.Vector3(), off: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), delay: hash(i * 13 + k * 3) * 0.3, spin: new THREE.Vector3(hash(k) - 0.5, hash(k * 2) - 0.5, hash(k * 3) - 0.5).normalize(), s: 0.16 + hash(i + k * 5) * 0.08 });
    }
    list.push({ g, mat, local: new THREE.Matrix4().makeRotationY(i * 0.35), state: 'hidden', out: { k: 0 }, tuck: { k: 0 }, chunks, fly: { k: 0 } });
  }
  registerInkRoot(root);
  const m4 = new THREE.Matrix4();
  const layer = sc.vfx.layer(root, () => {
    shell.updateMatrixWorld(true);
    for (const s of list) {
      if (s.state !== 'on') continue;
      m4.multiplyMatrices(shell.matrixWorld, s.local);
      m4.decompose(s.g.position, s.g.quaternion, s.g.scale);
      // Squeezing out from beneath the rim: first drawn in inside, pushing outward as they squeeze out; on retracting they shrink upward into the rim
      const k = s.out.k * (1 - s.tuck.k);
      const w = 0.8 + 0.2 * k;
      s.g.scale.set(s.g.scale.x * w, s.g.scale.y, s.g.scale.z * w);
      s.g.position.addScaledVector(UP, s.tuck.k * 0.12 * s.g.scale.y);
    }
  });
  return { list, layer };
}

// ───────────────────────── Glow and small VFX ─────────────────────────

/**
 * Earth veins light up: act.glow makes the source crystal, lamps and iris brighten; spirits do not take bloom, so a ball of amber halo is placed separately on the source crystal (nudged toward the camera, so the mountain wall does not cut half of it off).
 * When the legacy model has no source crystal anchor it is placed above the head.
 */
function crystalHalo(c: UltCtx): void {
  const { sc, side } = c;
  const cr = creature(c);
  const h = cr?.worldHeight ?? 2;
  const mat = new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(AMBER).multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const spr = new THREE.Sprite(mat);
  const toCam = new THREE.Vector3();
  const layer = sc.vfx.layer(spr, (_dt, t) => {
    const p = anchorPos(c, 'crystal', () => sc.head(side).add(new THREE.Vector3(0, h * 0.25, 0)));
    toCam.copy(sc.stage.camera.position).sub(p).normalize();
    spr.position.copy(p).addScaledVector(toCam, h * 0.1);
    const gl = cr?.act.glow ?? 0;
    spr.scale.setScalar(h * (0.22 + 0.03 * Math.sin(t * 5)));
    mat.opacity = 0.75 * Math.min(1, gl) * (0.85 + 0.15 * Math.sin(t * 7.3));
  });
  mem(c).layers.push(layer);
}

/** A ring of additive light with its own brightness control (vfx.ring is too bright and washes out when close to the camera) */
function ringFx(c: UltCtx, pos: THREE.Vector3, col: THREE.ColorRepresentation, r0: number, r1: number, dur: number, intensity = 0.9, width = 0.12): Promise<void> {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(intensity), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.RingGeometry(1 - width, 1, 64), mat);
  m.position.copy(pos);
  m.rotation.x = -Math.PI / 2;
  return c.sc.vfx.spawn(m, dur, (k) => {
    const r = r0 + (r1 - r0) * (1 - (1 - k) * (1 - k) * (1 - k));
    m.scale.setScalar(Math.max(1e-3, r));
    mat.opacity = 1 - k * k;
  });
}

/** A patch of dark cracks on the ground (normal blending, so that it can be pressed dark) + a patch of faint amber crack light */
function crater(c: UltCtx, at: THREE.Vector3, size: number, dur: number, glowAmt = 1): void {
  const mat = new THREE.MeshBasicMaterial({ map: crackTex(3), color: 0x2a1c14, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.set(-Math.PI / 2, 0, hash(at.x + at.z) * 6.3);
  m.position.copy(at).setY(0.04);
  m.renderOrder = 2;
  void c.sc.vfx.spawn(m, dur, (k) => {
    mat.opacity = 0.8 * (k < 0.04 ? k / 0.04 : 1 - Math.pow(Math.max(0, (k - 0.04) / 0.96), 1.3));
  });
  if (glowAmt > 0) void c.sc.vfx.decal(at.clone().setY(0.045), crackTex(1), AMBER, size * 0.85, dur * 0.7, undefined, 1.3 * glowAmt);
}

/** Small pebbles jump up */
function pebbles(c: UltCtx, center: THREE.Vector3, radius: number, count: number, speed = 2.5): void {
  c.sc.vfx.smoke({ pos: center.clone().setY(0.05), count: low(c) ? Math.ceil(count / 2) : count, color: PEBBLE, speed: [speed * 0.5, speed], dir: UP, spread: 0.35, life: [0.4, 0.8], size: [0.05, 0.12], gravity: 9, drag: 0.3, radius });
}

/** A ring of dust wall rolling outward; directions where weight(direction) is below 1 (e.g. toward the camera) get less, and slower */
function dustRing(c: UltCtx, center: THREE.Vector3, r: number, n: number, speed: [number, number], size: [number, number], weight?: (d: THREE.Vector3) => number, per = 10): void {
  const lo = low(c);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(i * 3.1) * 0.3;
    const d = new THREE.Vector3(Math.cos(a), 0.45, Math.sin(a));
    const k = weight ? weight(d) : 1;
    if (k <= 0.05) continue;
    const p = center.clone().add(new THREE.Vector3(Math.cos(a) * r, 0.25, Math.sin(a) * r));
    c.sc.vfx.smoke({ pos: p, count: Math.round((lo ? per / 2 : per) * k), color: DUST, speed: [speed[0] * k, speed[1] * k], dir: d, spread: 0.4, life: [0.7, 1.4], size, sizeEnd: 1.8, gravity: -0.4, drag: 2.3, radius: 0.35 });
  }
}

// ───────────────────────── Sound ─────────────────────────
// The earth rumble, stomp, earth splitting, rock cracking, strata breaking out, impact, grinding, fall, sky collapse and rockslide are audio files generated by ElevenLabs (synthesized versions are used until they finish loading); the ultra-low frequency is always synthesized

function sub(f0: number, f1: number, dur: number, gain: number, attack = 0.01): void {
  synth.tone({ type: 'sine', f0, f1, dur, gain, attack });
}

function slam(gain = 1, rate = 1): void {
  playOr(slamUrl, () => synth.noise({ type: 'lowpass', f0: 900, f1: 90, dur: 0.35, gain: 0.45 * gain }), { gain: 1.1 * gain, rate });
  sub(90 * rate, 36, 0.4, 0.4 * gain);
}

function crack(gain = 1, rate = 1): void {
  playOr(crackUrl, () => {
    synth.noise({ type: 'bandpass', f0: 2600 * rate, f1: 700, q: 4, dur: 0.14, gain: 0.3 * gain });
    synth.noise({ type: 'bandpass', f0: 1500 * rate, f1: 400, q: 3, dur: 0.22, gain: 0.18 * gain, delay: 0.04 });
  }, { gain: 0.7 * gain, rate });
}

function stomp(gain = 1): void {
  playOr(stompUrl, () => synth.noise({ type: 'lowpass', f0: 900, f1: 70, dur: 0.5, gain: 0.55 * gain }), { gain: 0.95 * gain });
  sub(95, 26, 0.7, 0.75 * gain);
  ultSfx.thump(0.4 * gain);
}

// ───────────────────────── Cinematic ─────────────────────────

/** The shell's pose: rearing the front half about the hind feet (rear 0 to 1, negative is pressing forward), and the squash on stomping (squash 0 to 1) */
function poseLayer(c: UltCtx): void {
  const cr = creature(c);
  if (!cr) return;
  const P = mem(c).pose;
  // Position of the hind feet in shell coordinates: half the experimental model's radius toward the back; an estimate for the legacy model
  const zp = -(cr.lab ? cr.lab.radius * 0.5 : cr.height * 0.35);
  const layer = c.sc.vfx.layer(new THREE.Object3D(), () => {
    const th = -0.24 * P.rear;
    cr.pose.rotation.x = th;
    cr.pose.position.set(0, zp * Math.sin(th), zp * (1 - Math.cos(th)));
    const w = P.squash;
    cr.pose.scale.set(1 + w * 0.04, 1 - w * 0.07, 1 + w * 0.04);
  });
  mem(c).layers.push(layer);
}

function restPose(c: UltCtx): void {
  const cr = creature(c);
  const P = mem(c).pose;
  P.rear = 0;
  P.squash = 0;
  if (!cr) return;
  cr.pose.rotation.set(0, 0, 0);
  cr.pose.position.set(0, 0, 0);
  cr.pose.scale.set(1, 1, 1);
}

/** The ground's reaction to the stomp: shockwave ring, dust wave, rubble, cracks, a camera jolt */
function stompFx(c: UltCtx, g: Geo, big: number): void {
  const { sc, cine } = c;
  const h = g.h;
  const front = g.C.clone().addScaledVector(g.f, h * 0.35);
  sc.rig.addTrauma(0.45 * big);
  sc.stage.chromatic(0.45 * big);
  void ringFx(c, front.clone().setY(0.08), AMBER, h * 0.3, h * 1.7 + 1.4, 0.55, 0.65, 0.08);
  dustRing(c, front, h * 0.4, 10, [2.5 * big, 5 * big], [0.25, 0.5], undefined, 5);
  pebbles(c, front, h * 0.8, 30, 3.2);
  crater(c, front, h * 1.3 + 1.4, 2.4, 0.9);
  cine.shock(front.clone().setY(0.3), 0.55 * big, 0.5, 0.9);
}

/** Announcement → earth veins light up → rear up → stomp → splitting the earth → locking the ground → heaving rock and stacking the mountain → carapace strata shed → rock roots (the mountain hanging in the sky) */
async function windup(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  m.n = strataCount(c);
  const n = m.n;
  const g = geometry(c);
  m.g = g;
  const h = g.h;
  const hf = g.hf;
  const A = act(c);
  const lo = low(c);
  const port = sc.portrait;
  // Build all the VFX objects first (not yet visible), and compile the shaders before starting
  const mt = buildMountain(c, g);
  m.mt = mt;
  const cols = buildColumns(c, g);
  m.cols = cols;
  const rift = buildRift(c, g);
  m.rift = rift;
  const sh = buildShellStrata(c, n);
  m.shell = sh.list;
  m.shellLayer = sh.layer;
  crystalHalo(c);
  sc.stage.prewarm();
  const P = m.pose;
  poseLayer(c);

  const pieces = mt.pieces;
  const nGround = pieces.length - 1;
  const rootAt = T.shellHit + n * 0.1 + 0.08;
  const endAt = rootAt + T.hold;

  const tl = sc.gs.timeline('world');
  // ① Announcement: hugging the ground looking up at the face's front diagonal, slowly pushing in
  const push = { k: 0 };
  tl.call(() => {
    c.ui.cutin(side, c.who, c.skill.name, c.el, true);
    preloadSamples(...FILES);
    synth.dropMusic();
    playOr(awakenUrl, () => synth.noise({ type: 'lowpass', f0: 180, f1: 90, dur: 1.4, gain: 0.4, attack: 1.0 }), { gain: 0.95, peakIn: T.stomp - 0.1 });
    sub(40, 34, 1.3, 0.3, 0.6);
    void cine.look({ letterbox: 1, vignette: 0.6, desat: 0.15, tint: 0xeedcc0, lift: 0x0a0604, grain: 0.22, bloom: 0.5, fov: port ? 1.3 : 1.05 }, 0.35, ease.outQuad);
    cine.track(() => sc.head(side), ['vig']);
    const head0 = sc.head(side);
    const crys = anchorPos(c, 'crystal', () => head0.clone().addScaledVector(g.f, -h * 0.4).addScaledVector(UP, h * 0.2));
    const camA = cine.orbitPos(side, head0, 30, h * 1.05 + 0.5, -h * 0.22);
    const camB = cine.orbitPos(side, head0, 24, h * 0.86 + 0.42, -h * 0.2);
    // The look-at point is a little below the head: the head lands in the upper half of the frame, not blocked by the name banner
    const tgt = () => sc.head(side).lerp(crys, 0.2).addScaledVector(UP, -h * 0.14);
    const hs = tgt();
    cine.cut(camA, hs);
    ride(c, (pos, look, dt) => {
      pos.lerpVectors(camA, camB, ease.outQuad(push.k));
      hs.lerp(tgt(), 1 - Math.exp(-dt * 10));
      look.copy(hs);
    });
    // The ground is trembling: rubble jumps in bursts, and the snow cap sifts snow dust downward
    let acc = 0;
    const layer = sc.vfx.layer(new THREE.Object3D(), (dt) => {
      acc += dt;
      if (acc < 0.13) return;
      acc = 0;
      pebbles(c, g.C, h * 0.9, 6, 1.6);
      const snowAt = anchorPos(c, 'summit', () => g.C.clone().setY(h * 0.9));
      sc.vfx.smoke({ pos: snowAt, count: lo ? 2 : 4, color: [0xeee4d4, 0xd8c8b0], speed: [0.1, 0.4], life: [0.5, 0.9], size: [0.05, 0.12], sizeEnd: 0.3, gravity: 2.5, drag: 0.8, radius: h * 0.12 });
    });
    m.layers.push(layer);
    tl.call(() => layer.kill(), [], T.stomp);
  }, [], 0);
  tl.to(A, { focus: 1, duration: 0.3, ease: 'power2.out' }, 0);
  tl.to(push, { k: 1, duration: T.rear, ease: 'none' }, 0);

  // ② Earth veins light up
  tl.to(A, { glow: 1, duration: 0.35, ease: 'power2.out' }, T.glint);
  tl.call(() => {
    eyeGlint(c, AMBER, 0.8);
    sub(70, 52, 0.7, 0.18, 0.02);
    const at = anchorPos(c, 'crystal', () => sc.head(side));
    sc.vfx.emit({ pos: at, count: lo ? 10 : 20, color: [AMBER, AMBER_HI], speed: [0.6, 1.6], life: [0.4, 0.8], size: [0.05, 0.1], radius: h * 0.08, gravity: -1.5, drag: 2, intensity: 0.8 });
  }, [], T.glint);

  // ③ Rear up: a low-angle full-body shot, propping up the front half about the hind feet; the strata beneath the carapace squeeze out
  tl.call(() => {
    const camPos = cine.orbitPos(side, g.C, 58, h * 1.3 + 1.3, 0.3);
    const look0 = g.C.clone().addScaledVector(g.f, h * 0.3).addScaledVector(UP, h * 0.26);
    cine.cut(camPos, look0);
    const look1 = look0.clone().addScaledVector(UP, h * 0.14);
    const tt = { k: 0 };
    ride(c, (pos, look, dt) => {
      tt.k = Math.min(1, tt.k + dt / 0.6);
      pos.copy(camPos);
      look.lerpVectors(look0, look1, ease.outQuad(tt.k));
    });
    playOr(grindUrl, () => synth.noise({ type: 'bandpass', f0: 380, f1: 760, q: 2.2, dur: 0.75, gain: 0.2, attack: 0.25 }), { gain: 0.45, rate: 0.8 });
    cine.track(() => sc.center(side), ['vig']);
    sc.vfx.smoke({ pos: g.C.clone().addScaledVector(g.f, h * 0.3).setY(h * 0.35), count: lo ? 8 : 16, color: DUST, speed: [0.2, 0.6], life: [0.6, 1.1], size: [0.15, 0.35], sizeEnd: 1.2, gravity: 1.5, drag: 1, radius: h * 0.3 });
    for (const s of m.shell) {
      s.state = 'on';
      s.g.visible = true;
    }
  }, [], T.rear);
  tl.to(P, { rear: 1, duration: T.drop - T.rear, ease: 'power2.out' }, T.rear);
  m.shell.forEach((s, i) => {
    tl.to(s.out, { k: 1, duration: 0.3, ease: 'back.out(2)' }, T.rear + 0.1 + i * 0.08);
    tl.call(() => {
      crack(0.45, 1.3 - i * 0.1);
      s.mat.uniforms.uEmissiveAmt.value = 0.16;
    }, [], T.rear + 0.1 + i * 0.08);
  });

  // ④ Comes down, stomp
  tl.to(P, { rear: -0.12, duration: T.stomp - T.drop, ease: 'power3.in' }, T.drop);
  tl.call(() => {
    stomp(1);
    stompFx(c, g, 1);
  }, [], T.stomp);
  tl.to(P, { rear: 0, duration: 0.3, ease: 'power2.out' }, T.stomp);
  tl.to(P, { squash: 1, duration: 0.06, ease: 'power2.out' }, T.stomp);
  tl.to(P, { squash: 0, duration: 0.3, ease: 'power2.inOut' }, T.stomp + 0.06);

  // ⑤ Splitting the earth: following along the rift on the audience side, the crack tearing toward the opponent, the columns on both sides breaking out along with it
  const riftK = { u: 0 };
  tl.call(() => {
    playOr(riftUrl, () => crack(1, 0.7), { gain: 1.0 });
    sub(60, 40, T.riftDur + 0.3, 0.3, 0.05);
    void cine.look({ fov: port ? 1.35 : 1.2, radial: 0.12, vignette: 0.55 }, 0.2);
    const camOf = (u: number, out: THREE.Vector3) => g.rift.getPointAt(Math.min(1, Math.max(0, u)), out).addScaledVector(g.a, 2.3 + h * 0.15).addScaledVector(g.f, -1.0).setY(1.8 + h * 0.05);
    const lk = new THREE.Vector3();
    const cu = { u: 0.02 };
    cine.cut(camOf(cu.u, new THREE.Vector3()), g.rift.getPointAt(0.05).addScaledVector(g.f, 0.6).setY(0.1));
    cine.track(() => g.rift.getPointAt(Math.min(1, riftK.u)), ['radial', 'vig']);
    ride(c, (pos, look, dt) => {
      // The camera is half a beat behind the crack (a spring), finally stopping in front of the opponent
      cu.u += (Math.max(0.02, riftK.u - 0.1) - cu.u) * (1 - Math.exp(-dt * 8));
      camOf(cu.u, pos);
      // The look-at point hugs the head of the crack on the ground, and as it nears the opponent it lifts to bring the opponent into the frame
      g.rift.getPointAt(Math.min(1, Math.max(0.05, riftK.u)), lk);
      lk.addScaledVector(g.f, 0.6).setY(THREE.MathUtils.lerp(0.1, 0.3 + hf * 0.3, THREE.MathUtils.smoothstep(riftK.u, 0.55, 1)));
      look.lerp(lk, 1 - Math.exp(-dt * 12));
    });
    // The columns break out behind the crack (the crack's progress is u = k², and the columns pop up at the moment the crack passes)
    for (const col of cols.rift) {
      let best = 0;
      let bd = 1e9;
      for (let i = 0; i <= 40; i++) {
        const d = g.rift.getPointAt(i / 40).distanceToSquared(col.base);
        if (d < bd) {
          bd = d;
          best = i / 40;
        }
      }
      col.at = cols.t + Math.sqrt(best) * T.riftDur + 0.03;
    }
    // Sparks and dust at the head of the crack
    let acc = 0;
    const layer = sc.vfx.layer(new THREE.Object3D(), (dt) => {
      acc += dt;
      if (acc < 0.035) return;
      acc = 0;
      const p = g.rift.getPointAt(Math.min(1, riftK.u)).setY(0.1);
      sc.vfx.emit({ pos: p, count: lo ? 3 : 6, color: [AMBER, AMBER_HI, EMBER], speed: [1.5, 4], dir: UP, spread: 0.5, life: [0.25, 0.5], size: [0.05, 0.1], gravity: 6, drag: 1, intensity: 0.8 });
      sc.vfx.smoke({ pos: p, count: lo ? 1 : 2, color: DUST, speed: [0.8, 2], dir: UP, spread: 0.6, life: [0.3, 0.6], size: [0.15, 0.3], sizeEnd: 1.3, gravity: -0.3, drag: 1.8, radius: 0.2 });
      sc.rig.trauma = Math.max(sc.rig.trauma, 0.2);
    });
    m.layers.push(layer);
    tl.call(() => layer.kill(), [], lockAt);
  }, [], T.rift);
  tl.to(riftK, { u: 1, duration: T.riftDur, ease: 'power1.in', onUpdate: () => void (rift.head.k = riftK.u) }, T.rift);

  // ⑥ Locking the ground: the crack hits the opponent's feet, and a ring of columns leans inward to surround the opponent
  tl.call(() => {
    cols.lock.forEach((col, i) => (col.at = cols.t + i * 0.018));
    crack(1, 0.8);
    slam(0.55, 1.2);
    sub(80, 40, 0.5, 0.4);
    sc.rig.addTrauma(0.35);
    void ringFx(c, g.F.clone().setY(0.1), AMBER, 0.4, g.hf * 0.3 + 1.6, 0.4, 0.8, 0.1);
    dustRing(c, g.F, g.hf * 0.28 + 0.95, 10, [1.5, 3.5], [0.3, 0.55]);
    pebbles(c, g.F, hf * 0.6 + 0.8, 20, 3);
    sc.slots[foe].creature?.setFlash(AMBER, 0.25);
  }, [], lockAt);

  // ⑦ Heaving rock: the camera on the opponent's audience side hugging the ground looking up, orbiting around the opponent (100° → 75°, 6.5 → 7.5), slowly rising;
  // the strata break out of the rift and fly into the sky, stacking above the opponent's head from the summit downward (the bottom of the whole stack stays at the same height, and it grows upward)
  const crane = { k: 0 };
  tl.call(() => {
    playOr(riseUrl, () => synth.noise({ type: 'bandpass', f0: 300, f1: 700, q: 1.5, dur: 1.4, gain: 0.25, attack: 0.4 }), { gain: 0.9 });
    sub(45, 60, 1.4, 0.22, 0.4);
    void cine.look({ fov: port ? 1.55 : 1.45, radial: 0, vignette: 0.5 }, 0.25);
    cine.track(null);
    const pos0 = new THREE.Vector3();
    const l0 = g.rift.getPointAt(0.7).setY(0.9);
    const l1 = new THREE.Vector3();
    const toward = g.F.clone().lerp(g.C, 0.15);
    const camAt = (k: number, out: THREE.Vector3) => {
      const e = ease.inOutQuad(k);
      return out.copy(g.F).addScaledVector(dirAt(c, THREE.MathUtils.lerp(100, 75, e)), THREE.MathUtils.lerp(6.5, 7.5, e)).setY(THREE.MathUtils.lerp(0.5, 1.3, e));
    };
    cine.cut(camAt(0, pos0), l0);
    ride(c, (pos, look) => {
      camAt(crane.k, pos);
      // Look-at point: panning up from the rift to the middle of this stack of strata
      const S = mt.S();
      const bottom = g.Yo - HR * S;
      const top = mt.O(l1).y + HT * S;
      l1.copy(toward).setY((bottom + top) * 0.5);
      look.lerpVectors(l0, l1, THREE.MathUtils.smoothstep(crane.k, 0.0, 0.35));
    });
  }, [], T.lift);
  tl.to(crane, { k: 1, duration: rootAt - T.lift, ease: 'none' }, T.lift);
  // One block at a time breaks out and flies up; the blocks on the ground join in sequence, and each one that joins pushes the whole stack up
  for (let j = 0; j < nGround; j++) {
    const pc = pieces[j];
    const t0 = T.lift + j * T.gap;
    tl.call(() => {
      pc.state = 'fly';
      pc.g.visible = true;
      const at = pc.from.clone().setY(0.1);
      sc.vfx.smoke({ pos: at, count: lo ? 8 : 16, color: DUST, speed: [1.5, 4], dir: UP, spread: 0.6, life: [0.6, 1.1], size: [0.35, 0.7], sizeEnd: 1.6, gravity: -0.5, drag: 2, radius: 0.5 });
      pebbles(c, at, 0.6, 14, 3.5);
      crack(0.35, 0.9 + hash(j) * 0.4);
    }, [], t0);
    tl.to(pc.fly, { k: 1, duration: T.fly, ease: 'none' }, t0);
    tl.call(() => attach(c, pc, j === 0 ? 0.6 : 0.8), [], t0 + T.fly);
  }
  // ⑧ The carapace strata shed: crumbling layer by layer into rock chunks, flying across the battlefield trailing dust and slamming into the mountain's base; with each layer that goes in, the whole mountain grows a size
  m.shell.forEach((s, i) => {
    const hit = T.shellHit + i * 0.1;
    const t0 = hit - T.shellFly;
    tl.call(() => {
      s.state = 'fly';
      s.g.visible = false;
      creature(c)?.root.updateMatrixWorld(true);
      s.g.updateMatrixWorld(true);
      const ctr = s.g.position.clone();
      const rw = s.g.scale.x * 0.62;
      for (const ch of s.chunks) {
        ch.from.copy(ctr).add(ch.off.clone().multiplyScalar(rw)).addScaledVector(UP, (hash(ch.delay * 9) - 0.5) * 0.1);
        ch.m.visible = true;
        ch.m.position.copy(ch.from);
      }
      crack(0.8, 1.1 - i * 0.12);
      sc.vfx.smoke({ pos: ctr, count: lo ? 6 : 12, color: DUST, speed: [0.5, 1.6], life: [0.5, 0.9], size: [0.2, 0.4], sizeEnd: 1.2, gravity: 1, drag: 1.5, radius: h * 0.4 });
      sc.vfx.emit({ pos: ctr, count: lo ? 8 : 16, color: [AMBER, AMBER_HI], speed: [1, 3], life: [0.3, 0.5], size: [0.05, 0.1], radius: h * 0.4, drag: 2, intensity: 0.8 });
      s.mat.uniforms.uEmissiveAmt.value = 0.22;
    }, [], t0);
    tl.to(s.fly, { k: 1, duration: T.shellFly, ease: 'none', onUpdate: () => flyShell(c, s) }, t0);
    tl.call(() => {
      s.state = 'gone';
      for (const ch of s.chunks) ch.m.visible = false;
      slam(0.9, 0.85);
      ultSfx.thump(0.3);
      sc.rig.addTrauma(0.2);
      const o = mt.O(new THREE.Vector3());
      sc.vfx.emit({ pos: o, count: lo ? 16 : 32, color: [AMBER, AMBER_HI, EMBER], speed: [2, 5], life: [0.3, 0.6], size: [0.06, 0.12], radius: mt.S() * 0.6, drag: 2, intensity: 0.9 });
      sc.vfx.smoke({ pos: o, count: lo ? 8 : 16, color: DUST, speed: [1, 3], life: [0.6, 1], size: [0.4, 0.8], sizeEnd: 1.6, radius: mt.S() * 0.7, drag: 2 });
    }, [], hit);
    tl.to(mt.grow, { k: i + 1, duration: 0.18, ease: 'back.out(2.5)' }, hit);
  });
  // ⑨ Rock roots: the last piece shoots up from the ground and joins at the very bottom, the mountain's base lights up; cut to high ground behind the tortoise's shoulder on the audience side (signature shot)
  {
    const pc = pieces[nGround];
    const t0 = rootAt - T.fly;
    tl.call(() => {
      pc.state = 'fly';
      pc.g.visible = true;
      const at = pc.from.clone().setY(0.1);
      sc.vfx.smoke({ pos: at, count: lo ? 10 : 20, color: DUST, speed: [2, 5], dir: UP, spread: 0.6, life: [0.6, 1.2], size: [0.4, 0.8], sizeEnd: 1.7, gravity: -0.5, drag: 2, radius: 0.6 });
      pebbles(c, at, 0.8, 18, 4);
    }, [], t0);
    tl.to(pc.fly, { k: 1, duration: T.fly, ease: 'none' }, t0);
    tl.call(() => {
      attach(c, pc, 1.2);
      ultSfx.thump(0.6);
      sub(55, 24, 1.2, 0.6);
      sc.stage.chromatic(0.5);
      overShoulder(c);
    }, [], rootAt);
    tl.to(mt.under, { k: 1, duration: 0.3, ease: 'power2.out' }, rootAt);
  }
  // Hanging: rubble falls from the rock roots
  tl.call(() => {
    let acc = 0;
    const layer = sc.vfx.layer(new THREE.Object3D(), (dt) => {
      acc += dt;
      if (acc < 0.06) return;
      acc = 0;
      const o = mt.O(new THREE.Vector3()).addScaledVector(UP, -HR * mt.S() * 0.5);
      sc.vfx.smoke({ pos: o, count: lo ? 2 : 4, color: PEBBLE, speed: [0.2, 0.8], life: [0.6, 1.0], size: [0.06, 0.14], gravity: 12, drag: 0.2, radius: mt.S() * 0.5 });
    });
    m.layers.push(layer);
    m.drip = layer;
  }, [], rootAt + 0.05);
  tl.set({}, {}, endAt);
  await playTimeline(tl);
}

/** Signature shot: looking across from high ground behind the tortoise's shoulder on the audience side; the look-at point follows the mountain (turning with it as the mountain is lifted and drops) */
function overShoulder(c: UltCtx): void {
  const { sc, cine } = c;
  const m = mem(c);
  const g = m.g;
  const mt = m.mt;
  if (!g || !mt) return;
  const h = g.h;
  const port = sc.portrait;
  // Low camera position looking up: the mountain on the tortoise's back at lower left, facing the mountain in the sky (rock roots to summit), the opponent beneath the mountain
  const back = g.C.clone().addScaledVector(g.f, -(h * 1.5 + 1.6)).addScaledVector(g.a, h * 0.8 + 1.0).setY(0.9);
  const target = (out: THREE.Vector3) => {
    const S = mt.S();
    const mid = mt.O(out).y + (HT - HR) * S * 0.5;
    return out.copy(g.F).setY(mid * 0.8 + g.hf * 0.5 * 0.2);
  };
  const tv = new THREE.Vector3();
  const back1 = back.clone().lerp(target(tv), 0.07);
  const tt = { k: 0 };
  cine.cut(back, target(tv));
  // The vignette follows the mountain and the surroundings fade: the canyon's red rock walls recede, and the mountain keeps its color
  void cine.look({ fov: port ? 1.8 : 1.65, vignette: 0.65, desat: 0.5, isolate: 0.85 }, 0);
  cine.track(() => mt.O(new THREE.Vector3()), ['vig']);
  ride(c, (pos, look, dt) => {
    tt.k = Math.min(1, tt.k + dt / (T.hold + T.cutFall));
    pos.lerpVectors(back, back1, ease.outQuad(tt.k));
    look.lerp(target(tv), 1 - Math.exp(-dt * 10));
  });
}

/** One stone joins the mountain: the whole stack is pushed up a bit, dust and sparks spray from the seams, and an impact sounds */
function attach(c: UltCtx, pc: Piece, gain: number): void {
  const { sc } = c;
  const m = mem(c);
  const mt = m.mt;
  if (!mt) return;
  pc.state = 'on';
  pc.fly.k = 1;
  const lo = low(c);
  slam(gain, 0.9 + hash(pc.k + 3) * 0.3);
  sc.rig.addTrauma(0.1 + gain * 0.08);
  const to = Math.max(0, mt.rem.v - pc.thick);
  const from = mt.rem.v;
  // Pushed up: reaches position within 0.16 s, overshoots slightly and settles back
  void sc.tw.to(0.16, (x) => (mt.rem.v = from + (to - from) * x), ease.outBack, 'world');
  const s = mt.S();
  const seam = pc.g.position.clone().addScaledVector(UP, pc.hh * s);
  sc.vfx.smoke({ pos: seam, count: lo ? 6 : 12, color: DUST, speed: [1.5, 3.5], life: [0.5, 0.9], size: [0.3, 0.6], sizeEnd: 1.4, radius: s * 0.7, drag: 2.2, gravity: 0.5 });
  sc.vfx.emit({ pos: seam, count: lo ? 8 : 16, color: [AMBER, AMBER_HI], speed: [1.5, 4], life: [0.2, 0.45], size: [0.05, 0.1], radius: s * 0.7, drag: 2, intensity: 0.8 });
}

/** The rock chunks the carapace strata crumbled into fly to the mountain's base: each trailing its own arc, growing larger as they fly, slamming in with slight time offsets */
function flyShell(c: UltCtx, s: ShellStratum): void {
  const m = mem(c);
  const mt = m.mt;
  const g = m.g;
  if (!mt || !g || s.state !== 'fly') return;
  const S = mt.S();
  const o = mt.O(new THREE.Vector3());
  const b1 = new THREE.Vector3();
  const b2 = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (const ch of s.chunks) {
    const k = Math.min(1, Math.max(0, (s.fly.k - ch.delay * 0.4) / 0.88));
    tgt.copy(o).addScaledVector(ch.off, S * 0.55).addScaledVector(UP, -0.1);
    b1.copy(ch.from).addScaledVector(UP, 2.4 + ch.delay * 2);
    b2.copy(tgt).addScaledVector(UP, -1.6);
    const iu = 1 - k;
    ch.m.position.set(0, 0, 0).addScaledVector(ch.from, iu * iu * iu).addScaledVector(b1, 3 * iu * iu * k).addScaledVector(b2, 3 * iu * k * k).addScaledVector(tgt, k * k * k);
    q.setFromAxisAngle(ch.spin, k * 9);
    ch.m.quaternion.copy(q);
    ch.m.scale.setScalar(ch.s * (1 + k * 2.2) * (g.h / 2));
  }
  if (Math.random() < 0.6) {
    const ch = s.chunks[Math.floor(Math.random() * s.chunks.length)];
    c.sc.vfx.smoke({ pos: ch.m.position.clone(), count: 1, color: DUST, speed: [0.2, 0.6], life: [0.4, 0.8], size: [0.2, 0.35], sizeEnd: 1.2, gravity: 1, drag: 1 });
  }
}

/** Rear up again → stomp → the mountain collapses and the sky falls: the camera first stays behind the shoulder, then after the stomp cuts to behind the opponent, descending with the mountain all the way to ground level; it stops the moment the mountain's base touches the opponent's head */
async function deliver(c: UltCtx): Promise<void> {
  const { sc, cine, foe } = c;
  const m = mem(c);
  const g = m.g;
  const mt = m.mt;
  if (!g || !mt) return;
  const hf = g.hf;
  const lo = low(c);
  const port = sc.portrait;
  const P = m.pose;
  const A = act(c);
  const S = mt.S();
  const tl = sc.gs.timeline('world');
  // ① Rear up again: the tortoise props up its front half, and the mountain across the way lifts up with it
  tl.call(() => {
    playOr(grindUrl, () => synth.noise({ type: 'bandpass', f0: 300, f1: 600, q: 1.5, dur: 0.5, gain: 0.25, attack: 0.2 }), { gain: 0.6, rate: 0.7 });
    sub(40, 55, 0.5, 0.3, 0.2);
    sc.rig.addTrauma(0.15);
  }, [], 0);
  tl.to(P, { rear: 1.15, duration: T.reDrop, ease: 'power2.out' }, 0);
  tl.to(mt.drop, { y: -LIFT, duration: T.reDrop + 0.06, ease: 'power2.out' }, 0);
  tl.to(mt.under, { k: 1.6, duration: 0.3, ease: 'power2.out' }, 0);
  tl.to(A, { glow: 1.25, duration: 0.3 }, 0);
  // ② Stomp: the mountain collapses and the sky falls
  tl.to(P, { rear: -0.14, duration: T.reStomp - T.reDrop, ease: 'power3.in' }, T.reDrop);
  tl.call(() => {
    stomp(1.1);
    stompFx(c, g, 1.2);
    playOr(descentUrl, () => synth.noise({ type: 'bandpass', f0: 260, f1: 1500, q: 1.4, dur: 0.5, gain: 0.3, attack: 0.45 }), { gain: 0.9, peakIn: T.deliver - T.reStomp - 0.03 });
  }, [], T.reStomp);
  tl.to(P, { rear: 0, duration: 0.3, ease: 'power2.out' }, T.reStomp);
  tl.to(P, { squash: 1, duration: 0.06 }, T.reStomp);
  tl.to(P, { squash: 0, duration: 0.3 }, T.reStomp + 0.06);
  // The displacement when the mountain's base touches the opponent's head
  const o0 = mt.O(new THREE.Vector3()).y + mt.drop.y;
  const contact = o0 - HR * S - hf * 0.92;
  tl.to(mt.drop, { y: contact, duration: T.deliver - T.reStomp, ease: 'power2.in' }, T.reStomp);
  // ③ Sky collapse: cut to behind the opponent on the audience side, as high as the mountain, descending with the mountain all the way to ground level (target's view)
  const fall = { k: 0 };
  tl.call(() => {
    const Rg = S * 1.15;
    const dir = dirAt(c, TV_YAW);
    const ob = mt.O(new THREE.Vector3());
    const d0 = mt.drop.y;
    // The start is as high as the mountain, seeing the whole side of the mountain; the end hugs the ground, with the opponent in the foreground, the mountain pressing down from above and the tortoise in the distance
    const ffPos = g.F.clone().addScaledVector(dir, Rg + 6).setY(ob.y + 1.5);
    const tvPos = g.F.clone().addScaledVector(dir, Rg + 2.6).setY(0.6);
    const toward = g.F.clone().lerp(g.C, 0.25);
    cine.cut(ffPos, toward.clone().setY(ob.y + S * 0.6));
    void cine.look({ fov: port ? 1.6 : 1.45, radial: 0.08, lines: 0.1, linesColor: AMBER_HI, vignette: 0.6, desat: 0.15, isolate: 0 }, 0);
    void cine.look({ radial: 0.22, lines: 0.28 }, T.deliver - T.cutFall, ease.inQuad);
    // Radial blur centered on the mountain's base: the mountain stays sharp and a sense of speed is stretched out around it
    cine.track(() => mt.O(new THREE.Vector3()).addScaledVector(UP, -HR * mt.S() * 0.5), ['radial', 'vig']);
    ride(c, (pos, look) => {
      // Following the mountain: the camera's progress is the progress of the mountain's fall
      const p = Math.min(1, Math.max(0, (mt.drop.y - d0) / Math.max(1e-3, contact - d0)));
      const e = 1 - (1 - p) * (1 - p);
      pos.lerpVectors(ffPos, tvPos, e);
      mt.O(ob);
      const top = ob.y + mt.S() * 0.9;
      const bot = (ob.y + hf * 0.5) * 0.5;
      look.copy(toward).setY(THREE.MathUtils.lerp(top, bot, e));
    });
    // Mountain shadow: the opponent is darkened; rubble falls from the mountain's base and the mountain wall kicks up dust in the wind
    const fc = sc.slots[foe].creature;
    let acc = 0;
    const layer = sc.vfx.layer(new THREE.Object3D(), (dt) => {
      const k = fall.k;
      fc?.setFlash(0x2a1a10, 0.45 * k * k);
      acc += dt;
      if (acc < 0.04) return;
      acc = 0;
      const ob = mt.O(new THREE.Vector3());
      sc.vfx.smoke({ pos: ob.clone().addScaledVector(UP, -HR * mt.S() * 0.5), count: lo ? 2 : 5, color: PEBBLE, speed: [0.5, 2], life: [0.5, 0.9], size: [0.06, 0.16], gravity: 14, drag: 0.2, radius: mt.S() * 0.6 });
      sc.vfx.smoke({ pos: ob.clone().addScaledVector(UP, mt.S() * HB * 0.6), count: lo ? 1 : 3, color: DUST, speed: [3, 6], dir: UP, spread: 0.3, life: [0.3, 0.6], size: [0.3, 0.6], sizeEnd: 1.6, drag: 1.5, radius: mt.S() * 1.05 });
    });
    m.layers.push(layer);
    tl.call(() => layer.kill(), [], T.deliver);
  }, [], T.cutFall);
  tl.to(fall, { k: 1, duration: T.deliver - T.cutFall, ease: 'none' }, T.cutFall);
  tl.call(() => sc.rig.addTrauma(0.3), [], T.deliver - 0.2);
  tl.set({}, {}, T.deliver);
  await playTimeline(tl);
  m.drip?.kill();
}

/** The mountain body crumbles: the layers shift apart, topple and roll away from the camera, amber sparks bursting from the seams; the two layers below and the rock roots sink into the ground; after sinkAfter seconds all the wreckage sinks into the ground */
function collapse(c: UltCtx, strength: number, sinkAfter: number): void {
  const { sc } = c;
  const m = mem(c);
  const mt = m.mt;
  const g = m.g;
  if (!mt || !g || m.collapsed) return;
  m.collapsed = true;
  const lo = low(c);
  const S = mt.S();
  const cam = sc.stage.camera.position;
  const away = g.F.clone().sub(cam).setY(0).normalize();
  const across = new THREE.Vector3().crossVectors(UP, away).normalize();
  mt.pieces.forEach((pc, j) => {
    if (pc.state === 'wait') return;
    pc.state = 'free';
    const sgn = pc.k % 2 ? 1 : -1;
    if (pc.kind === 'root' || pc.k <= 1) {
      // The two layers below and the rock roots: pressed into the ground
      pc.v.set(0, 0, 0);
      pc.w.set(0, 0, 0);
      pc.rest = 1;
      pc.sink = pc.kind === 'root' ? 2 : 1.4 - pc.k * 0.2;
    } else {
      const up = 0.6 + hash(j * 2.1) * 0.8;
      const lateral = (0.8 + hash(j * 3.7) * 0.9) * strength;
      pc.v.copy(across).multiplyScalar(sgn * lateral).addScaledVector(away, (0.9 + hash(j * 5.3) * 0.9 + (pc.kind === 'peak' ? 1 : 0)) * strength).addScaledVector(UP, up * strength);
      pc.w.copy(across).multiplyScalar(-sgn).addScaledVector(away, 0.3).addScaledVector(UP, (hash(j * 8.3) - 0.5) * 0.4).normalize().multiplyScalar((0.9 + hash(j) * 1.2) * strength);
    }
    // Sparks and dust from the seams
    const seam = pc.g.position.clone();
    sc.vfx.emit({ pos: seam, count: lo ? 10 : 22, color: [AMBER, AMBER_HI, EMBER], speed: [2, 6], life: [0.3, 0.7], size: [0.06, 0.13], radius: S * 0.7, gravity: 5, drag: 1.2, intensity: 0.9 });
    sc.vfx.smoke({ pos: seam, count: lo ? 4 : 8, color: DUST, speed: [1, 3], life: [0.7, 1.3], size: [0.45, 0.9], sizeEnd: 1.6, radius: S * 0.7, drag: 2, gravity: -0.2 });
  });
  // Stone fragments
  const colsC = [BANDS[1].col, BANDS[2].col, BANDS[3].col, BANDS[0].col];
  colsC.forEach((col, i) => void sc.vfx.debris(g.F.clone().setY(S * (0.4 + i * 0.3)).addScaledVector(away, S * 0.3), col, lo ? 4 : 7, 5 + i, 1.8, 0.14 + S * 0.05, S * 1.1));
  void c.wait(sinkAfter).then(() => {
    for (const pc of mt.pieces) pc.sink = Math.max(pc.sink, 0.9);
    if (m.cols) for (const col of [...m.cols.rift, ...m.cols.lock, ...m.cols.crown]) col.sinkAt = Math.min(col.sinkAt, m.cols.t + hash(col.r * 50) * 0.3);
    if (m.rift) void sc.tw.to(0.6, (k) => (m.rift!.fade.k = 1 - k), ease.inQuad, 'fx');
  });
}

/** Impact: the mountain slams into the ground, hit-stop; the ground turns up and a dust wall rolls out; then the mountain body crumbles and the camera pulls back */
function impact(c: UltCtx, ev: HitEv): void {
  const { sc, cine, foe } = c;
  const m = mem(c);
  const g = m.g;
  const mt = m.mt;
  if (!g || !mt || m.landed) return;
  m.landed = true;
  const lo = low(c);
  const hf = g.hf;
  const S = mt.S();
  // The mountain slams into the ground: the rock roots plunge into the ground and the mountain body squashes once
  const o = mt.O(new THREE.Vector3());
  mt.drop.y += o.y - (HR * S * 0.35 + 0.05);
  mt.under.k = 0;
  void sc.tw.to(0.07, (k) => (mt.squash.k = k), ease.outQuad, 'fx').then(() => sc.tw.to(0.45, (k) => (mt.squash.k = 1 - k), ease.outBack, 'fx'));
  // Warm white flash, hit-stop; the tint goes amber for a beat
  sc.stage.screenFlash(0xfff0d4, 0.55, 7);
  void cine.look({ tint: 0xffd8a0, desat: 0.1, bloom: 0.3 }, 0);
  void sc.tw.wait(0.12, 'real').then(() => cine.look({ tint: 0xf0dcc0, desat: 0.1 }, 0.4));
  sc.stage.hitStop(260);
  sc.stage.chromatic(0.9);
  sc.rig.addTrauma(0.75);
  sfx.impactBig();
  playOr(crashUrl, () => synth.noise({ type: 'lowpass', f0: 2400, f1: 40, dur: 2.4, gain: 0.6 }), { gain: 1.0 });
  playOr(collapseUrl, () => synth.noise({ type: 'lowpass', f0: 1200, f1: 60, dur: 2.6, gain: 0.4, attack: 0.2 }), { gain: 0.8, delay: 0.3 });
  sub(56, 18, 2.2, 0.8);
  synth.noise({ type: 'lowpass', f0: 160, f1: 60, dur: 3.0, gain: 0.35, attack: 0.4, delay: 0.3 });
  sc.slots[foe].creature?.setFlash(0x3a2414, 0.5);
  // Ground: rock columns pressed into the ground, a ring of rock slabs turning up outward, cracks, a shockwave ring (not larger than the camera distance), a dust wall (less on the camera's side)
  const cols = m.cols;
  if (cols) {
    for (const col of cols.lock) col.sinkAt = cols.t;
    cols.crown.forEach((col, i) => (col.at = cols.t + i * 0.004));
  }
  const ground = g.F.clone().setY(0.1);
  const camD = Math.hypot(sc.stage.camera.position.x - g.F.x, sc.stage.camera.position.z - g.F.z);
  void ringFx(c, ground, AMBER, S * 0.8, Math.min(S * 2.6 + 2, camD * 0.72), 0.55, 0.65, 0.07);
  void ringFx(c, ground.clone().setY(0.12), AMBER_HI, S * 0.6, Math.min(S * 1.8 + 1.2, camD * 0.5), 0.4, 0.5, 0.1);
  crater(c, g.F, S * 3.2 + 2, 3.2, 1.2);
  const toCam = sc.stage.camera.position.clone().sub(g.F).setY(0).normalize();
  dustRing(c, g.F, S * 1.05, lo ? 8 : 14, [3, 6.5], [0.4, 0.8], (d) => 1 - Math.max(0, d.clone().setY(0).normalize().dot(toCam)) * 0.95);
  pebbles(c, g.F, S * 1.3, 50, 5);
  cine.shock(g.F.clone().setY(hf * 0.5), 1.4, 0.8, 1.4);
  void cine.look({ lines: 0 }, 0);
  void cine.pulse({ radial: 0.55 }, { radial: 0 }, 0.6);
  cine.track(() => sc.center(foe), ['vig']);
  // After the hit-stop the mountain body crumbles; from 1.1 s the wreckage sinks into the ground
  void c.wait(0.04).then(() => collapse(c, 1, 1.1));
  // Camera: the hit-stop frames hold the target's view, then it retreats back and up
  void c.wait(0.34).then(() => {
    // Retreating toward the usual battle camera (that spot is empty in every arena) while rising
    const r = sc.rig;
    const look = r.look.clone().add(new THREE.Vector3(0, hf * 0.2, 0));
    const p = r.pos.clone().lerp(r.base.pos.clone().setY(r.pos.y), 0.4).add(new THREE.Vector3(0, hf * 0.5 + 1.4, 0));
    void cine.look({ fov: sc.portrait ? 1.35 : 1.15, lines: 0, radial: 0 }, 0.9);
    void cine.shot(p, look, 0.9, ease.outCubic);
  });
  void c.wait(1.15).then(() => settleEarth(c, 0.5));
  void ev;
}

/** Wrap up the cinematic's post-processing (tint back to normal); after holding for hold seconds the camera pulls back to the wide shot */
function settleEarth(c: UltCtx, hold: number): void {
  const { sc, cine } = c;
  void cine.look({ lines: 0, radial: 0, haze: 0, isolate: 0, grain: 0, bloom: sc.stage.bloomBase * 0.85, tint: 0xffffff, desat: 0, lift: 0x000000, vignette: 0.45 }, 0.5);
  void c.wait(hold).then(() => {
    cine.track(null);
    void sc.rig.reset(0.8);
    void cine.look({ fov: 1, roll: 0 }, 0.8);
  });
}

/** Blocked: the mountain presses on the barrier and holds, the mountain's base lights up, then it crumbles down on both sides of the barrier */
async function guarded(c: UltCtx): Promise<void> {
  const { sc } = c;
  const m = mem(c);
  const mt = m.mt;
  const g = m.g;
  m.landed = true;
  if (mt && g) {
    const o = mt.O(new THREE.Vector3());
    // The mountain's base stops on top of the barrier
    mt.drop.y += o.y - HR * mt.S() - (g.hf * 1.15 + 0.2);
    void sc.tw.to(0.08, (k) => (mt.squash.k = k * 0.6), ease.outQuad, 'fx').then(() => sc.tw.to(0.35, (k) => (mt.squash.k = 0.6 * (1 - k)), ease.outQuad, 'fx'));
    mt.under.k = 1.6;
  }
  playOr(crashUrl, () => synth.noise({ type: 'lowpass', f0: 2400, f1: 40, dur: 2.0, gain: 0.5 }), { gain: 0.8 });
  sub(56, 24, 1.2, 0.6);
  if (m.cols) for (const col of m.cols.lock) col.sinkAt = m.cols.t;
  if (g) {
    // The camera retreats a little toward the usual battle camera and rises: the mountain pressing on the barrier can be seen
    const r = sc.rig;
    const look = g.F.clone().setY(g.hf * 1.3);
    const p = r.pos.clone().lerp(r.base.pos.clone().setY(r.pos.y), 0.35).add(new THREE.Vector3(0, 1.3, 0));
    void c.cine.look({ lines: 0, radial: 0 }, 0.3);
    void c.cine.shot(p, look, 0.6, ease.outCubic);
  }
  await ultGuarded(c);
  crack(1, 0.6);
  playOr(collapseUrl, () => synth.noise({ type: 'lowpass', f0: 1200, f1: 60, dur: 2.0, gain: 0.35 }), { gain: 0.7 });
  collapse(c, 1.25, 0.9);
}

/** After a miss or a block: if the mountain is still hanging, let it crumble; the tint returns and the camera pulls back to the wide shot */
function settle(c: UltCtx): void {
  const m = mem(c);
  if (m.mt && !m.collapsed) {
    if (!m.landed) {
      const o = m.mt.O(new THREE.Vector3());
      m.mt.drop.y += o.y - HR * m.mt.S() * 0.35;
    }
    collapse(c, 1, 0.8);
  }
  settleEarth(c, 0.5);
}

/** The mountain stands up again: three new layers of strata rise from under the tortoise's feet and are clamped back beneath the carapace, then withdraw into the rim; after that the weights go to zero, the pose is restored, and the VFX are removed */
async function after(c: UltCtx): Promise<void> {
  const { sc } = c;
  const m = mem(c);
  const A = act(c);
  const cr = creature(c);
  const g = m.g;
  // The old carapace strata (interrupted when peeled off) are removed
  m.shellLayer?.kill();
  m.shellLayer = undefined;
  restPose(c);
  const fresh = buildShellStrata(c, STRATA_MAX);
  const tl = sc.gs.timeline('world');
  tl.to(A, { glow: 0.6, duration: 0.2 }, 0);
  const shell = cr?.anchor('shell');
  if (fresh.layer && shell && g) {
    for (let j = 0; j < fresh.list.length; j++) {
      // Bottom to top: the lowest layer arrives first
      const i = fresh.list.length - 1 - j;
      const st = fresh.list[i];
      const t0 = 0.05 + j * 0.24;
      const lift = { k: 0 };
      const setLocal = () => st.local.makeRotationY(i * 0.35).setPosition(0, -(1 - lift.k) * 0.55, 0);
      setLocal();
      tl.call(() => {
        st.state = 'on';
        st.out.k = 1;
        st.g.visible = true;
        st.mat.uniforms.uEmissiveAmt.value = 0.2;
        pebbles(c, g.C, g.h * 0.55, 12, 2.4);
        sc.vfx.smoke({ pos: g.C.clone().setY(0.2), count: low(c) ? 5 : 10, color: DUST, speed: [0.8, 2], life: [0.5, 0.9], size: [0.25, 0.5], sizeEnd: 1.3, radius: g.h * 0.45, drag: 2 });
      }, [], t0);
      // Rising from the ground: the anchor's local coordinates are offset downward, tweened back to 0
      tl.to(lift, { k: 1, duration: 0.2, ease: 'power3.out', onUpdate: setLocal }, t0);
      tl.call(() => {
        slam(0.5, 1.3);
        sc.rig.addTrauma(0.08);
      }, [], t0 + 0.2);
      tl.to(st.mat.uniforms.uEmissiveAmt, { value: 0, duration: 0.5, ease: 'power2.out' }, t0 + 0.2);
    }
    const tuckAt = 0.05 + fresh.list.length * 0.24 + 0.35;
    for (const s of fresh.list) tl.to(s.tuck, { k: 1, duration: 0.3, ease: 'power2.in' }, tuckAt);
    tl.call(() => {
      for (const s of fresh.list) s.g.visible = false;
    }, [], tuckAt + 0.3);
  }
  tl.to(A, { glow: 0, focus: 0, duration: 0.4, ease: 'power1.inOut' }, 0.8);
  tl.call(() => void c.cine.look({ tint: 0xffffff, desat: 0 }, 0.4), [], 0);
  tl.set({}, {}, 1.3);
  await playTimeline(tl);
  fresh.layer?.kill();
  // Remove all VFX and weights
  m.mt?.layer.kill();
  m.cols?.layer.kill();
  m.rift?.kill();
  for (const l of m.layers) l.kill();
  m.layers = [];
  m.mt = undefined;
  m.cols = undefined;
  m.rift = undefined;
  A.glow = 0;
  A.focus = 0;
  restPose(c);
  cr?.setFlash(0xffffff, 0);
  sc.slots[c.foe].creature?.setFlash(0xffffff, 0);
}

export default defineSsr({
  windup,
  deliver,
  impact,
  guarded,
  settle,
  after,
  quietHit: true,
});
