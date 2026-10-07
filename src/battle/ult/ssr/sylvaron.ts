// Sylvaron, the Evergreen: "Eternal Spring"
//
// What this cinematic is about: the old stag wakes the forests on its head and rears up and stamps; the forest grows along the root veins from under its hooves all the way to the opponent's feet, trapping the opponent in a root cage;
// with a toss of its head, the forests on its antlers scatter spring (evergreen leaves and petals) over the opponent. The opponent is already withered, and spring's recovery reverses into raging fire:
// the flowers blooming all over the root cage burn one by one into embers, a new evergreen leaf grows from the ash and flies back to the forest on its head.
//
// Model: a white stag with two small forests growing on its head (src/render/lab/sylvaronModel.ts). The forests are its own antlers, and the cinematic builds no separate canopy;
// action weights used: focus (face forward), glow (source crystal and green eyes), bloom (canopy swells, flowers open), rustle (canopy shakes), raise (head thrown back for a long call),
// rear (rearing up; tweened back to 0 it is the stamp), brace (head lowered to press the forests forward).
// Positions come only from anchors and the shell: sc.head, sc.eyes, anchor('mouth'/'crownL'/'crownR'/'canopy'/'hoofL'/'hoofR'); the legacy model falls back to estimates.
// Roots, trees, grass and flowers are solid scene objects (sceneMaterial + outline layer, the same shapes as the forests on the antlers); petals, evergreen leaves, light pillars and embers go through VFX.
//
// Shot list (seconds on the world clock; GSAP timeline, stops during hit-stop and follows battle speed)
//   windup
//     0.00  Announcement: letterbox, the music is pulled out, the frame is graded to the warm gold of morning light; the camera at audience side 46°, shooting up from below the head at the face and the forests on its head (low-angle close-up,
//           the face sitting above the name banner), pushes in and turns to 28° within 1.3 s, the look-at point following the head. It stops to look around and faces the opponent (focus). Sound: wind in the woods surging upward, a low-frequency attack.
//     0.16  Eyes open: green eye glints, the source crystal on its chest lights up (glow).
//     0.30  Waking the forest: the canopies on the antlers swell, flowers and fruit burst open, the saplings on its back grow taller (bloom 0.55 s, with a rebound); the two forests spray petals and new leaves,
//           several shafts of morning light slant down behind the canopies and light specks float upward. Sound: branches and leaves shooting up, a burst of birdsong.
//     0.80  Long call: head thrown back (raise), two small sound-wave rings unfold some distance in front of the mouth (not covering the face), one beat of radial blur, the canopies shaken by the sound and rustling (rustle), new leaves shaken loose. Sound: a stag's call (loudest at about 0.95).
//     1.34  Rear up (cut): side-on, ground-level low-angle full-body shot with the sky as backdrop; it rears up (rear 0.36 s), forehooves pawing the air, hind hooves kicking up dust.
//           The camera slowly pushes in with a slight roll. Sound: a whoosh.
//     1.84  End (holding at the top of the rear)
//   deliver
//     0.00  Stamp: the front body comes crashing down (rear back to 0, 0.13 s); at 0.13 the forehooves land: a slight hit-stop, a shockwave ring (smaller than the camera distance), a ring of dust sprayed outward,
//           dust columns and new leaves bursting upward, rubble leaping, cracks glowing green splitting the ground, four curling roots darting out beside the hooves; it then lowers its head to press the forests forward (brace). Sound: the boom of the stamp.
//     0.24  Root veins rushing (cut): side-on follow shot, the camera slides forward on the audience side alongside the leading edge of the roots (0.66 s): the foreground is grass and flowers sprouting,
//           the middle ground is three thick roots breaking out segment by segment and arching (like sea serpents swimming through the earth), the background is a row of small trees shooting up on the far side, canopies bursting open one clump after another;
//           over the last third it starts to pull back and rise, framing in the opponent and the root cage. Sound: the rumble of roots tearing the earth open.
//     0.90  Root cage: the leading edge arrives, the ground at the opponent's feet cracks and yellows; seven thick roots shoot up around the opponent and curl upward into a root cage, the opponent's color is drained (uWither),
//           withered leaves fall. The camera rises along and the look-at point lifts to the top of the cage. Sound: the creak of roots breaking the ground, withering cracks.
//     1.10  Target's view (cut): behind the opponent, audience side 62°, looking down from above the top of the cage: the opponent inside the root cage on the right, the newly grown grove path and Sylvaron at back left;
//           at 1.12 it tosses its head (brace → raise), at 1.20 the two forests pour out two hundred solid evergreen leaves and petals (scene material + outline), spiraling along the arc above the grove path
//           across the frame toward the root cage, trailing petal particles and a faint wind ribbon (caster, direction of attack and opponent in one frame). The camera slowly pushes in.
//           Sound: a strong gust carrying leaves (loudest at the impact).
//     1.84  The torrent arrives (handed to the director to play the impact); the arriving leaves scatter against the cage
//   impact (quietHit: the impact visuals are made by itself)
//     0.00  Spring arrives: the root cage blooms with flowers all at once, a green-gold pillar of light surges up from the opponent's feet (recovery), petals burst; the frame holds on this one frame (the director's hit-stop).
//           Sound: a gust of blooming flowers and bell tones.
//     0.10  Wither and Bloom reversal: the pillar of light turns into fire from the bottom up, the flowers burn one by one into embers, the root cage is charred (self-illumination pressed low, the embers carried by sparks rising from the roots), the opponent burns into a charred silhouette, black smoke and embers curl into one column,
//           scorch marks burned into the ground. Sound: a sharp crack and ignition, a heavy hit.
//     0.32  The camera retreats back and up 1.25x from the target's view.
//     0.70  The root cage crumbles to ash and shrinks into the ground; at 0.80 a solid new evergreen leaf grows from the ash and flies in an arc back to the forest on its head (evergreen leaf +1), and the forest brightens and shakes.
//     0.95  Post-processing eases back, and after holding 0.45 s it pulls back to the wide shot (about 1.4 s after the impact it is back in the wide shot, where the battle text is read)
//   guarded: the torrent hits the barrier and scatters into withered leaves, the root cage is pried open, withers to grey-white and shrinks back into the ground, and the opponent's color comes back all at once; then the shared "barrier almost shattered, finally holds".
//   after: weights go to zero; the trees, grass, flowers and roots of the grove path shrink back into the ground all the way, the withered earth recedes, and the opponent's color slowly returns (the withered status is shown by the battle UI).

import * as THREE from 'three';
import { playOr, preloadSamples } from '../../../audio/samples.ts';
import { sfx, synth } from '../../../audio/sfx.ts';
import birdsUrl from '../../../audio/sfx/sylvaron-birds.mp3';
import bloomUrl from '../../../audio/sfx/sylvaron-bloom.mp3';
import cageUrl from '../../../audio/sfx/sylvaron-cage.mp3';
import growUrl from '../../../audio/sfx/sylvaron-grow.mp3';
import gustUrl from '../../../audio/sfx/sylvaron-gust.mp3';
import igniteUrl from '../../../audio/sfx/sylvaron-ignite.mp3';
import rootsUrl from '../../../audio/sfx/sylvaron-roots.mp3';
import stagUrl from '../../../audio/sfx/sylvaron-stag.mp3';
import stompUrl from '../../../audio/sfx/sylvaron-stomp.mp3';
import witherUrl from '../../../audio/sfx/sylvaron-wither.mp3';
import type { Creature } from '../../../render/creature.ts';
import { crackTex, rayTex } from '../../../render/fxtex.ts';
import { playTimeline } from '../../../render/gsapClock.ts';
import { INK_LAYER, registerInkRoot } from '../../../render/ink.ts';
import { barkTube, canopyGeo, flowerSlab } from '../../../render/lab/sylvaronModel.ts';
import { sceneMaterial, type SpiritMaterial } from '../../../render/spiritToon.ts';
import { glowTex } from '../../../render/textures.ts';
import { ease } from '../../../render/tween.ts';
import type { FxLayer } from '../../../render/vfx.ts';
import { ultSfx } from '../cine.ts';
import { ultGuarded } from '../generic.ts';
import { defineSsr, eyeGlint, settle } from '../ssr.ts';
import type { HitEv, UltCtx } from '../types.ts';

const FILES = [birdsUrl, growUrl, stagUrl, stompUrl, rootsUrl, cageUrl, witherUrl, gustUrl, bloomUrl, igniteUrl];
// The script is preloaded when the spirit enters the battle: take the chance to get the audio files ready
preloadSamples(...FILES);

const GREEN = 0x6cbf4a;
const GREEN_LT = 0x9fe06a;
const GLOW = 0xc8ff9a;
const PINK = 0xffa8d8;
const PINK_LT = 0xffe4f2;
const WHITE = 0xffffff;
const GOLD = 0xfff0b0;
const EMBER = 0xff6a20;
const EMBER_HI = 0xffc86a;
const ASH = 0x2a1e16;
const DUST = [0x8a7458, 0xa89070, 0x6f5c44];
/** Warm gold of morning light (the frame tint from the announcement to the rear) */
const DAWN = 0xffeed6;
const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const hash = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 4.1) * 43758.5453;
  return x - Math.floor(x);
};
const backOut = (k: number) => ease.outBack(clamp01(k));

// Timetable (seconds): each beat of the shot list; the seconds in the file header match these
const T = {
  glint: 0.16,
  bloom: 0.3,
  bellow: 0.8,
  rear: 1.34,
  rearDur: 0.36,
  windup: 1.84,
  land: 0.13,
  race: 0.24,
  raceDur: 0.66,
  cage: 0.9,
  target: 1.1,
  toss: 1.12,
  launch: 1.2,
  deliver: 1.84,
  /** After the impact: spring arrives and holds a beat, then reverses into fire */
  burn: 0.1,
};

// ───────────────────────── State ─────────────────────────

/** The geometry of this cinematic: all computed from the positions and heights of the two sides */
interface Geo {
  h: number;
  hf: number;
  /** The horizontal direction from the caster toward the opponent, and the horizontal direction of the audience side */
  f: THREE.Vector3;
  a: THREE.Vector3;
  home: THREE.Vector3;
  foe: THREE.Vector3;
  /** Start of the roots (under the forehooves), end (outer edge of the root cage), and length */
  start: THREE.Vector3;
  end: THREE.Vector3;
  len: number;
  /** Radius and height of the root cage */
  cageR: number;
  cageH: number;
  /** Size multiplier for roots and trees (by the caster's height) */
  s: number;
}

interface Kit {
  bark: SpiritMaterial;
  leaf: SpiritMaterial;
  cage: SpiritMaterial;
  grass: SpiritMaterial;
  flower: SpiritMaterial;
  swarm: SpiritMaterial;
  mats: THREE.Material[];
}

interface Mem {
  g?: Geo;
  kit?: Kit;
  layers: FxLayer[];
  race: { k: number };
  line?: Grower;
  hoof?: Grower;
  wake?: Grower;
  grove?: Grower;
  cage?: Cage;
  ground?: { set(k: number): void; kill(): void };
  pillar?: Pillar;
  swarm?: Swarm;
  rays?: { k: number; kill(): void };
  /** The opponent's materials: original color and withered brown (only needed on the legacy model) */
  foe?: { mats: Creature['mats']; orig: THREE.Color[]; dead: THREE.Color[]; glows: THREE.MeshBasicMaterial[]; gOrig: THREE.Color[]; gDead: THREE.Color[] };
  wither: { k: number };
  cleanup?: () => void;
}
const mem = (c: UltCtx): Mem => (c.mem.syl ??= { layers: [], race: { k: 0 }, wither: { k: 0 } }) as Mem;
const creature = (c: UltCtx) => c.sc.slots[c.side].creature;
/** The stag's action weights (only effective on the experimental model) */
const act = (c: UltCtx): Record<string, number> => creature(c)?.act ?? {};
const low = (c: UltCtx): boolean => c.sc.stage.quality === 'low';

/** World position of an anchor; use fallback when the legacy model has no such anchor */
function anchorPos(c: UltCtx, name: string, fallback: () => THREE.Vector3): THREE.Vector3 {
  const cr = creature(c);
  const a = cr?.anchor(name);
  if (!cr || !a) return fallback();
  cr.root.updateMatrixWorld(true);
  return a.getWorldPosition(new THREE.Vector3());
}

/** Centers of the two forests (left, right) and their midpoint */
function crowns(c: UltCtx): { l: THREE.Vector3; r: THREE.Vector3; mid: THREE.Vector3 } {
  const { sc, side, cine } = c;
  const h = creature(c)?.worldHeight ?? 1.5;
  const f = cine.forward(side);
  const right = new THREE.Vector3().crossVectors(f, UP).normalize();
  const top = () => sc.head(side).addScaledVector(UP, h * 0.2);
  const l = anchorPos(c, 'crownL', () => top().addScaledVector(right, -h * 0.16));
  const r = anchorPos(c, 'crownR', () => top().addScaledVector(right, h * 0.16));
  const mid = anchorPos(c, 'canopy', top);
  return { l, r, mid };
}

function geometry(c: UltCtx): Geo {
  const { sc, side, foe, cine } = c;
  const cr = creature(c);
  const fc = sc.slots[foe].creature;
  const h = cr?.worldHeight ?? 1.5;
  const hf = fc?.worldHeight ?? 1.5;
  const home = sc.slots[side].home.clone().setY(0);
  const foeHome = sc.slots[foe].home.clone().setY(0);
  const f = cine.forward(side);
  const a = cine.orbitPos(side, new THREE.Vector3(), 90, 1, 0).setY(0).normalize();
  const hooves = anchorPos(c, 'hoofL', () => home.clone().addScaledVector(f, h * 0.18)).lerp(anchorPos(c, 'hoofR', () => home.clone().addScaledVector(f, h * 0.18)), 0.5).setY(0);
  const start = home.clone().addScaledVector(f, Math.max(0.2, hooves.clone().sub(home).dot(f)) + 0.25);
  const cageR = Math.max((fc?.width ?? 1) * 0.5, hf * 0.3) + 0.3;
  const end = foeHome.clone().addScaledVector(f, -cageR * 0.9);
  return { h, hf, f, a, home, foe: foeHome, start, end, len: Math.max(1, start.distanceTo(end)), cageR, cageH: hf * 1.08 + 0.35, s: THREE.MathUtils.clamp(h / 2.5, 0.8, 1.2) };
}

/** Path of the roots: from under the forehooves (s = 0) to the outer edge of the root cage (s = len), lat is the offset toward the audience side */
function pathAt(g: Geo, s: number, lat: number, y: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.copy(g.start).addScaledVector(g.f, s).addScaledVector(g.a, lat).setY(y);
}

/** How far away to frame a region of height hgt and width wid completely (by the current field-of-view multiplier and aspect ratio) */
function fitDist(c: UltCtx, hgt: number, wid: number, fovScale: number): number {
  const { sc } = c;
  const cam = sc.stage.camera;
  const halfTan = Math.tan(THREE.MathUtils.degToRad((cam.fov / sc.stage.fovScale) * fovScale * 0.5));
  return Math.max((hgt * 0.5) / halfTan, (wid * 0.5) / (halfTan * cam.aspect));
}

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

// ───────────────────────── Textures ─────────────────────────

const texCache = new Map<string, THREE.Texture>();
function canvasTex(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

/** Evergreen leaf: a glowing leaf with a vein down the middle */
function leafTex(): THREE.Texture {
  return canvasTex('syl-leaf', 128, (g, s) => {
    const c = s / 2;
    g.shadowColor = 'rgba(200,255,150,0.9)';
    g.shadowBlur = 10;
    const grd = g.createRadialGradient(c, c, 0, c, c, s * 0.42);
    grd.addColorStop(0, 'rgba(255,255,240,1)');
    grd.addColorStop(0.5, 'rgba(200,255,150,0.95)');
    grd.addColorStop(1, 'rgba(120,220,90,0.85)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(c, s * 0.06);
    g.quadraticCurveTo(s * 0.92, s * 0.38, c, s * 0.94);
    g.quadraticCurveTo(s * 0.08, s * 0.38, c, s * 0.06);
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(c, s * 0.1);
    g.lineTo(c, s * 0.9);
    g.stroke();
  });
}

/** Withered earth: a patch of cracked dry brown soil (normal blending, laid over the grass) */
function deadTex(): THREE.Texture {
  return canvasTex('syl-dead', 256, (g, s) => {
    const c = s / 2;
    const grd = g.createRadialGradient(c, c, 0, c, c, c);
    grd.addColorStop(0, 'rgba(96,72,44,0.92)');
    grd.addColorStop(0.55, 'rgba(110,86,52,0.8)');
    grd.addColorStop(0.85, 'rgba(120,98,64,0.35)');
    grd.addColorStop(1, 'rgba(120,98,64,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
}

// ───────────────────────── Materials ─────────────────────────

/** Scene materials for this move (the same cartoon shading as the arena, going through the scene's outline); released together when the cinematic ends */
function makeKit(c: UltCtx): Kit {
  const vc = (m: SpiritMaterial) => {
    m.vertexColors = true;
    return m;
  };
  const kit: Kit = {
    bark: vc(sceneMaterial(0xffffff, { rim: 0.3 })),
    leaf: vc(sceneMaterial(0xffffff, { rim: 0.35 })),
    cage: vc(sceneMaterial(0xffffff, { rim: 0.3, emissive: EMBER, emissiveAmt: 0 })),
    grass: sceneMaterial(0xffffff, { rim: 0.2 }),
    flower: sceneMaterial(0xffffff, { rim: 0.25, emissive: EMBER, emissiveAmt: 0 }),
    // Evergreen leaves in the torrent: a little self-illumination, so they can be seen flying through dark areas
    swarm: sceneMaterial(0xffffff, { rim: 0.45, emissive: 0xeaffd0, emissiveAmt: 0.08 }),
    mats: [],
  };
  kit.mats.push(kit.bark, kit.leaf, kit.cage, kit.grass, kit.flower, kit.swarm);
  // Must also be released when leaving the battle midway
  const m = mem(c);
  m.cleanup = c.sc.addCleanup(() => {
    for (const x of kit.mats) x.dispose();
  });
  return kit;
}

/** Solid scene object: outline layer on, marked as a scene line */
function solid(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.layers.enable(INK_LAYER);
  m.userData.inkScene = true;
  return m;
}

// ───────────────────────── Growing roots ─────────────────────────

const RING = 10;
const cBarkDk = new THREE.Color(0x4a3322);
const cBark = new THREE.Color(0x76553a);
const cBarkNew = new THREE.Color(0x9a8a52);

interface Root {
  mesh: THREE.Mesh;
  curve: THREE.Curve<THREE.Vector3>;
  /** Grown up to g of the curve (0 to 1): growing outward from the start, the tip tapering to a point within a fixed fraction */
  set(g: number): void;
  g: number;
  rad: (u: number) => number;
}

/**
 * A solid root growing along a curve: the vertices are rearranged on the CPU every frame (the outline's normal channel can see it), with a few darker bark grooves lengthwise,
 * deep at the base and a pale newly grown color at the tip. side is the direction perpendicular to the plane of the curve, and it determines the frame of the cross-section (so it does not twist).
 */
function makeRoot(curve: THREE.Curve<THREE.Vector3>, rad: (u: number) => number, side: THREE.Vector3, mat: THREE.Material, segs = 22): Root {
  const nv = (segs + 1) * (RING + 1);
  const pos = new Float32Array(nv * 3);
  const nor = new Float32Array(nv * 3);
  const col = new Float32Array(nv * 3);
  const idx: number[] = [];
  const tc = new THREE.Color();
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    tc.copy(cBarkDk).lerp(cBark, THREE.MathUtils.smoothstep(s, 0, 0.45)).lerp(cBarkNew, THREE.MathUtils.smoothstep(s, 0.7, 1));
    for (let j = 0; j <= RING; j++) {
      const k = (i * (RING + 1) + j) * 3;
      const groove = j % 2 ? 0.8 : 1;
      const n = 0.92 + 0.08 * hash(i * 7.1 + j * 3.3);
      col[k] = tc.r * groove * n;
      col[k + 1] = tc.g * groove * n;
      col[k + 2] = tc.b * groove * n;
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < RING; j++) {
      const a = i * (RING + 1) + j;
      const b = a + RING + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mesh = solid(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  const P = new THREE.Vector3();
  const Tn = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const root: Root = {
    mesh,
    curve,
    rad,
    g: -1,
    set(g) {
      g = clamp01(g);
      if (Math.abs(g - root.g) < 1e-4) return;
      root.g = g;
      mesh.visible = g > 0.003;
      if (!mesh.visible) return;
      for (let i = 0; i <= segs; i++) {
        const s = i / segs;
        const u = g * s;
        curve.getPointAt(u, P);
        curve.getTangentAt(u, Tn);
        N.copy(side).addScaledVector(Tn, -side.dot(Tn));
        if (N.lengthSq() < 1e-8) N.set(0, 1, 0).addScaledVector(Tn, -Tn.y);
        N.normalize();
        B.crossVectors(Tn, N);
        const r = rad(u) * Math.sqrt(Math.min(1, (1 - s) / 0.24));
        for (let j = 0; j <= RING; j++) {
          const th = (j / RING) * TAU;
          const cx = Math.cos(th);
          const sy = Math.sin(th);
          const k = (i * (RING + 1) + j) * 3;
          const nx = N.x * cx + B.x * sy;
          const ny = N.y * cx + B.y * sy;
          const nz = N.z * cx + B.z * sy;
          pos[k] = P.x + nx * r;
          pos[k + 1] = P.y + ny * r;
          pos[k + 2] = P.z + nz * r;
          nor[k] = nx;
          nor[k + 1] = ny;
          nor[k + 2] = nz;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.normal.needsUpdate = true;
    },
  };
  return root;
}

/** A group of things that grow and shrink back: set(k) advances them (root leading edge, root cage growth), and fade is the multiplier by which the whole group shrinks back at wrap-up */
interface Grower {
  root: THREE.Group;
  set(k: number): void;
  fade: { k: number };
  kill(): void;
}

/**
 * Three thick roots break out segment by segment along the path and arch (like sea serpents swimming through the earth): set(F), where F is the distance the leading edge has gone along the path.
 * Each root is divided into several arches, each emerging from underground, arching across the ground, and diving back down; neighboring segments alternate left and right.
 */
function makeRootLine(c: UltCtx, g: Geo, kit: Kit): Grower {
  const { sc } = c;
  const lo = low(c);
  const root = new THREE.Group();
  const lines = lo ? [{ lat: 0, r: 1, hs: 1, ph: 0 }] : [{ lat: 0, r: 1, hs: 1, ph: 0 }, { lat: 0.46, r: 0.62, hs: 0.7, ph: 0.45 }, { lat: -0.5, r: 0.7, hs: 0.8, ph: 0.2 }];
  const arches: { root: Root; s0: number; s1: number; hit: boolean }[] = [];
  let seed = 1;
  for (const ln of lines) {
    const span = 0.95 * g.s;
    const n = Math.max(3, Math.round(g.len / span));
    const sp = g.len / n;
    for (let k = -1; k < n; k++) {
      const s0 = Math.max(0, (k + ln.ph) * sp - 0.1);
      const s1 = Math.min(g.len + 0.2, (k + 1 + ln.ph) * sp + 0.12);
      if (s1 - s0 < 0.45) continue;
      const H = (0.34 + 0.26 * hash(seed++)) * ln.hs * g.s;
      const w = ln.lat + (hash(seed++) - 0.5) * 0.22 + (k % 2 ? 0.08 : -0.08);
      const d = s1 - s0;
      const pts = [
        pathAt(g, s0, w, -0.32),
        pathAt(g, s0 + d * 0.2, w + 0.04, H * 0.72),
        pathAt(g, s0 + d * 0.5, w + (hash(seed++) - 0.5) * 0.2, H),
        pathAt(g, s0 + d * 0.8, w - 0.03, H * 0.62),
        pathAt(g, s1, w, -0.32),
      ];
      const r0 = (0.1 + 0.04 * hash(seed++)) * ln.r * g.s;
      const r = makeRoot(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), (u) => r0 * (1 - 0.3 * u) * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, u * 1.2))), g.a, kit.bark, 22);
      root.add(r.mesh);
      arches.push({ root: r, s0, s1, hit: false });
    }
  }
  const fade = { k: 1 };
  let F = 0;
  const dust = new THREE.Vector3();
  const layer = sc.vfx.layer(root, () => {
    for (const a of arches) {
      a.root.set(clamp01((F - a.s0) / (a.s1 - a.s0)) * fade.k);
      if (!a.hit && F > a.s0 && fade.k > 0.99) {
        a.hit = true;
        a.root.curve.getPointAt(0.12, dust).setY(0.1);
        sc.vfx.smoke({ pos: dust, count: lo ? 4 : 8, color: DUST, speed: [1, 2.6], dir: UP, spread: 0.7, life: [0.4, 0.8], size: [0.18, 0.36], sizeEnd: 0.9, radius: 0.15, drag: 1.8, gravity: -0.6 });
      }
    }
  }, () => {
    for (const a of arches) a.root.mesh.geometry.dispose();
  });
  registerInkRoot(root);
  return { root, set: (v) => (F = v), fade, kill: () => layer.kill() };
}

/** A few curling roots darting out from under the forehooves (the moment of the stamp) */
function makeHoofRoots(c: UltCtx, g: Geo, kit: Kit, at: THREE.Vector3): Grower {
  const { sc } = c;
  const root = new THREE.Group();
  const roots: { r: Root; d: number }[] = [];
  const n = low(c) ? 3 : 5;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU + 0.4;
    const d = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
    const side = new THREE.Vector3().crossVectors(UP, d);
    const R = (0.34 + 0.12 * hash(i + 3)) * g.s;
    const H = (0.34 + 0.2 * hash(i + 9)) * g.s;
    const P = (r: number, y: number) => at.clone().addScaledVector(d, r).setY(y);
    // Darting outward and upward, the ends curling back
    const pts = [P(R * 0.55, -0.25), P(R * 0.75, H * 0.45), P(R, H * 0.85), P(R * 1.25, H), P(R * 1.38, H * 0.78), P(R * 1.28, H * 0.62)];
    const r0 = (0.05 + 0.02 * hash(i)) * g.s;
    const r = makeRoot(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), (u) => r0 * (1 - 0.55 * u), side, kit.bark, 18);
    root.add(r.mesh);
    roots.push({ r, d: i * 0.03 });
  }
  const fade = { k: 1 };
  let G = 0;
  const layer = sc.vfx.layer(root, () => {
    for (const x of roots) x.r.set(clamp01((G - x.d) / (1 - x.d)) * fade.k);
  }, () => {
    for (const x of roots) x.r.mesh.geometry.dispose();
  });
  registerInkRoot(root);
  return { root, set: (v) => (G = v), fade, kill: () => layer.kill() };
}

/** Grass and flowers sprouting behind the leading edge (solid small blades of grass and five-petal flowers, no outlines): set(F) shares the roots' leading edge */
function makeWake(c: UltCtx, g: Geo, kit: Kit): Grower {
  const { sc } = c;
  const lo = low(c);
  const root = new THREE.Group();
  const bladeGeo = new THREE.ConeGeometry(0.035, 0.34, 4, 1);
  bladeGeo.translate(0, 0.17, 0);
  const flowerGeo = flowerSlab(0.07, 0.014, 0.005);
  flowerGeo.rotateX(-Math.PI / 2);
  const nB = lo ? 70 : 170;
  const nF = lo ? 16 : 40;
  const blades = new THREE.InstancedMesh(bladeGeo, kit.grass, nB);
  const flowers = new THREE.InstancedMesh(flowerGeo, kit.flower, nF);
  blades.frustumCulled = flowers.frustumCulled = false;
  const greens = [0x4f9a3a, 0x6cbf4a, 0x8fd65a, 0x5fae42].map((x) => new THREE.Color(x));
  const petals = [0xf6b6cc, 0xfbf6ee, 0xf7e27a, 0xf2a0c0].map((x) => new THREE.Color(x));
  type It = { p: THREE.Vector3; q: THREE.Quaternion; s: number; at: number; life: number };
  const mk = (i: number, lat: number, delay: number, sMin: number, sMax: number, flat: boolean): It => {
    const s = hash(i * 1.37 + (flat ? 50 : 0)) * g.len;
    const l = (hash(i * 2.71 + 7) * 2 - 1) * lat;
    const p = pathAt(g, s, l, flat ? 0.1 + hash(i) * 0.05 : 0);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(flat ? (hash(i + 4) - 0.5) * 0.4 : (hash(i + 4) - 0.5) * 0.7, hash(i + 5) * TAU, flat ? 0 : (hash(i + 6) - 0.5) * 0.7));
    return { p, q, s: (sMin + (sMax - sMin) * hash(i * 3.1)) * g.s, at: s + delay, life: 0 };
  };
  const bl = Array.from({ length: nB }, (_, i) => mk(i, 1.5, 0.05, 0.6, 1.35, false));
  const fl = Array.from({ length: nF }, (_, i) => mk(i + 300, 1.3, 0.35, 0.8, 1.3, true));
  bl.forEach((_, i) => blades.setColorAt(i, greens[i % greens.length]));
  fl.forEach((_, i) => flowers.setColorAt(i, petals[i % petals.length]));
  root.add(blades, flowers);
  const fade = { k: 1 };
  let F = 0;
  const M = new THREE.Matrix4();
  const S = new THREE.Vector3();
  const tick = (mesh: THREE.InstancedMesh, list: It[], dt: number, dur: number) => {
    list.forEach((it, i) => {
      if (F > it.at) it.life = Math.min(1, it.life + dt / dur);
      const k = backOut(it.life) * fade.k;
      M.compose(it.p, it.q, S.setScalar(Math.max(1e-3, k * it.s)));
      mesh.setMatrixAt(i, M);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  const layer = sc.vfx.layer(root, (dt) => {
    tick(blades, bl, dt, 0.22);
    tick(flowers, fl, dt, 0.3);
  }, () => {
    bladeGeo.dispose();
    flowerGeo.dispose();
    blades.dispose();
    flowers.dispose();
  });
  return { root, set: (v) => (F = v), fade, kill: () => layer.kill() };
}

const PAL = [
  { base: 0x509c4a, light: 0x8cc85a, dark: 0x2a6436 },
  { base: 0x438e54, light: 0x7cbe66, dark: 0x245638 },
  { base: 0x6aa446, light: 0xa8d062, dark: 0x386a2e },
  { base: 0x8cbe54, light: 0xc4e27a, dark: 0x507e34 },
];

/**
 * Grove path: after the leading edge passes, a row of small trees on the far side shoots up, canopies bursting open one clump after another (the same canopy and bark as the forests on the antlers); the near side has only low shrubs, which do not block the follow camera.
 * set(F) shares the roots' leading edge.
 */
function makeGrove(c: UltCtx, g: Geo, kit: Kit): Grower {
  const { sc } = c;
  const lo = low(c);
  const root = new THREE.Group();
  const cDead = new THREE.Color(0xa49a88);
  const cBk = new THREE.Color(0x7a5a3e);
  const cGroove = new THREE.Color(0x4e3826);
  const barkCol = (t: number, ridge: number) => cDead.clone().lerp(cBk, THREE.MathUtils.smoothstep(t, 0, 0.4)).lerp(cGroove, (1 - ridge) * 0.55);
  type Tree = { g: THREE.Group; crowns: THREE.Object3D[]; at: number; life: number; popped: boolean; top: THREE.Vector3 };
  const trees: Tree[] = [];
  const far = lo ? [0.2, 0.5, 0.8] : [0.1, 0.26, 0.42, 0.58, 0.74, 0.9];
  const specs: { s: number; lat: number; H: number; bush: boolean }[] = far.map((u, i) => ({ s: u * g.len, lat: -(1.05 + hash(i * 5.3) * 0.55), H: g.h * (0.4 + hash(i * 2.2) * 0.2), bush: false }));
  if (!lo) for (const [i, u] of [0.18, 0.36, 0.55].entries()) specs.push({ s: u * g.len, lat: 1.55 + hash(i + 40) * 0.3, H: g.h * 0.16, bush: true });
  specs.forEach((sp, i) => {
    const base = pathAt(g, sp.s, sp.lat, 0);
    const tg = new THREE.Group();
    tg.position.copy(base);
    tg.rotation.y = hash(i * 9.1) * TAU;
    tg.scale.setScalar(1e-3);
    const cs: THREE.Object3D[] = [];
    const H = sp.H;
    let top = new THREE.Vector3(0, H * 0.3, 0);
    if (sp.bush) {
      const cg = new THREE.Group();
      cg.position.set(0, H * 0.35, 0);
      cg.add(solid(canopyGeo(H * 0.55, 70 + i, { ...PAL[i % 4], lobes: 14, amp: 0.34, detail: 3, squash: 0.5 }), kit.leaf));
      tg.add(cg);
      cs.push(cg);
    } else {
      const lean = new THREE.Vector3((hash(i + 1) - 0.5) * 0.3, 0, (hash(i + 2) - 0.5) * 0.3).multiplyScalar(H);
      const trunkTop = new THREE.Vector3(lean.x, H * 0.72, lean.z);
      tg.add(solid(barkTube([new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(lean.x * 0.3, H * 0.3, lean.z * 0.3), new THREE.Vector3(lean.x * 0.7, H * 0.55, lean.z * 0.7), trunkTop], (t) => H * 0.055 * (1 - 0.5 * t) * (t > 0.9 ? Math.sqrt(Math.max(0, 1 - ((t - 0.9) / 0.1) ** 2)) : 1), { segs: 12, radial: 10, grooves: 4, depth: 0.12, seed: i * 3, color: barkCol }), kit.bark));
      const br = new THREE.Vector3(lean.x * 0.5 + H * 0.2, H * 0.62, lean.z * 0.5 + H * 0.05);
      tg.add(solid(barkTube([new THREE.Vector3(lean.x * 0.4, H * 0.4, lean.z * 0.4), new THREE.Vector3(lean.x * 0.45 + H * 0.1, H * 0.52, lean.z * 0.45), br], (t) => H * 0.028 * (1 - 0.5 * t) * (t > 0.85 ? 0.5 : 1), { segs: 8, radial: 8, grooves: 3, depth: 0.1, seed: i * 5, color: barkCol }), kit.bark));
      const main = new THREE.Group();
      main.position.copy(trunkTop).add(new THREE.Vector3(0, H * 0.14, 0));
      main.add(solid(canopyGeo(H * 0.3, 11 + i, { ...PAL[i % 4], lobes: 18, amp: 0.36, detail: 4 }), kit.leaf));
      const side = new THREE.Group();
      side.position.copy(br).add(new THREE.Vector3(0, H * 0.06, 0));
      side.add(solid(canopyGeo(H * 0.19, 31 + i, { ...PAL[(i + 1) % 4], lobes: 14, amp: 0.34, detail: 3 }), kit.leaf));
      tg.add(main, side);
      cs.push(main, side);
      top = main.position.clone();
    }
    for (const x of cs) x.scale.setScalar(1e-3);
    root.add(tg);
    trees.push({ g: tg, crowns: cs, at: sp.s + 0.25, life: 0, popped: false, top });
  });
  const fade = { k: 1 };
  let F = 0;
  const wp = new THREE.Vector3();
  const layer = sc.vfx.layer(root, (dt) => {
    for (const t of trees) {
      if (F > t.at) t.life = Math.min(1, t.life + dt / 0.5);
      const trunk = backOut(Math.min(1, t.life / 0.6));
      const crown = backOut((t.life - 0.35) / 0.65);
      const k = fade.k;
      t.g.scale.set(Math.max(1e-3, (0.35 + 0.65 * trunk) * k * Math.min(1, t.life * 5)), Math.max(1e-3, trunk * k), Math.max(1e-3, (0.35 + 0.65 * trunk) * k * Math.min(1, t.life * 5)));
      for (const cr of t.crowns) cr.scale.setScalar(Math.max(1e-3, crown));
      if (!t.popped && t.life > 0.45 && fade.k > 0.99) {
        t.popped = true;
        t.g.localToWorld(wp.copy(t.top));
        sc.vfx.emit({ pos: wp, count: lo ? 8 : 16, color: [GREEN, GREEN_LT, 0x4f9a3a], speed: [1, 2.6], life: [0.5, 0.9], size: [0.08, 0.15], sizeEnd: 0.6, atlas: 3, spin: 8, radius: 0.2, gravity: 2.5, drag: 1.6, intensity: 0.7 });
      }
    }
  });
  registerInkRoot(root);
  return { root, set: (v) => (F = v), fade, kill: () => layer.kill() };
}

// ───────────────────────── Root cage ─────────────────────────

interface Cage extends Grower {
  /** Blooming (0 to 1) */
  bloom: { k: number };
  /** Scorching (0 to 1): the roots turn black and give off embers, the flowers burn into embers */
  char: { k: number };
}

/** The root cage shooting up around the opponent: seven thick roots curling upward and inward, the tips clasping above the head; flowers bloom all over the roots, and burn together at the wither-and-bloom reversal */
function makeCage(c: UltCtx, g: Geo, kit: Kit): Cage {
  const { sc } = c;
  const lo = low(c);
  const root = new THREE.Group();
  const n = lo ? 5 : 7;
  const sf = THREE.MathUtils.clamp(g.hf / 2, 0.75, 1.3);
  const roots: { r: Root; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    const th0 = (i / n) * TAU + 0.3;
    const tw = 0.55;
    const R = g.cageR * (0.95 + 0.1 * hash(i + 2));
    const H = g.cageH * (0.92 + 0.14 * hash(i + 5));
    const at = (q: number, rr: number, y: number) => {
      const th = th0 + tw * q;
      return g.foe.clone().addScaledVector(g.f, Math.cos(th) * rr).addScaledVector(g.a, Math.sin(th) * rr).setY(y);
    };
    const pts = [at(0, R * 1.15, -0.4), at(0.2, R * 1.02, H * 0.18), at(0.42, R * 0.98, H * 0.46), at(0.64, R * 0.8, H * 0.74), at(0.84, R * 0.45, H * 0.94), at(1, R * 0.08, H * 1.02)];
    const side = new THREE.Vector3().addScaledVector(g.f, -Math.sin(th0 + tw * 0.5)).addScaledVector(g.a, Math.cos(th0 + tw * 0.5)).normalize();
    const r0 = 0.15 * sf * (0.85 + 0.3 * hash(i + 11));
    const r = makeRoot(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), (u) => r0 * (1 - 0.72 * u) + 0.015, side, kit.cage, 26);
    root.add(r.mesh);
    roots.push({ r, d: (i % 2) * 0.12 + i * 0.015 });
  }
  // Flowers on the roots: distributed along each root, the flower faces pointing outward
  const nF = lo ? 18 : 42;
  const flowerGeo = flowerSlab(0.1 * sf, 0.02, 0.007);
  const flowers = new THREE.InstancedMesh(flowerGeo, kit.flower, nF);
  flowers.frustumCulled = false;
  root.add(flowers);
  const petals = [0xf6b6cc, 0xfbf6ee, 0xf7e27a, 0xf2a0c0].map((x) => new THREE.Color(x));
  const ember = new THREE.Color(0x3a1a0c);
  type Fl = { ri: number; u: number; d: number; s: number; spin: number; burnt: boolean; p: THREE.Vector3; q: THREE.Quaternion; col: THREE.Color };
  const fls: Fl[] = Array.from({ length: nF }, (_, i) => ({ ri: i % n, u: 0.22 + 0.72 * hash(i * 1.9), d: hash(i * 3.7) * 0.45, s: 0.75 + 0.5 * hash(i * 5.3), spin: hash(i * 7.1) * TAU, burnt: false, p: new THREE.Vector3(), q: new THREE.Quaternion(), col: petals[i % petals.length].clone() }));
  const fade = { k: 1 };
  const bloom = { k: 0 };
  const char = { k: 0 };
  let G = 0;
  const M = new THREE.Matrix4();
  const S = new THREE.Vector3();
  const P = new THREE.Vector3();
  const Tn = new THREE.Vector3();
  const out = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);
  const tc = new THREE.Color();
  const dark = new THREE.Color(0x2e2018);
  let emberT = 0;
  let emberAcc = 0;
  const layer = sc.vfx.layer(root, (_dt, t) => {
    for (const x of roots) x.r.set(clamp01((G - x.d) / (1 - x.d * 0.8)) * fade.k);
    // Scorch: the roots' color is pressed to charcoal black, the self-illumination shows through the orange of embers (flickering)
    (kit.cage.uniforms.uColor.value as THREE.Color).setRGB(1, 1, 1).lerp(dark, char.k);
    kit.cage.uniforms.uEmissiveAmt.value = char.k * (0.05 + 0.03 * Math.sin(t * 23) * Math.sin(t * 7.3)) * fade.k;
    // Embers: sparks pop up bit by bit from the charred roots
    if (char.k > 0.05 && fade.k > 0.3 && emberT < 0.9) {
      emberT += _dt;
      emberAcc += _dt * (lo ? 40 : 110) * char.k;
      for (; emberAcc >= 1; emberAcc--) {
        const r = roots[Math.floor(Math.random() * roots.length)].r;
        const u = Math.random() * Math.max(0.05, r.g);
        r.curve.getPointAt(u, P);
        sc.vfx.emit({ pos: P, count: 1, color: [EMBER, EMBER_HI, 0xff3a10], speed: [0.3, 1.2], dir: UP, spread: 0.9, life: [0.3, 0.7], size: [0.04, 0.09], radius: r.rad(u), gravity: -1.8, drag: 1, intensity: 0.9 });
      }
    }
    fls.forEach((fl, i) => {
      const r = roots[fl.ri].r;
      const grown = r.g >= fl.u;
      const b = clamp01((bloom.k - fl.d) / 0.45);
      const burn = clamp01((char.k - fl.d * 0.6) / 0.4);
      let k = grown ? backOut(b) * (1 - burn) : 0;
      if (burn > 0.5 && !fl.burnt) {
        fl.burnt = true;
        sc.vfx.emit({ pos: fl.p, count: lo ? 3 : 6, color: [EMBER, EMBER_HI, 0xff3a10], speed: [0.6, 2], dir: UP, spread: 0.8, life: [0.4, 0.8], size: [0.05, 0.1], gravity: -2.2, drag: 1, intensity: 0.9 });
      }
      if (!fl.burnt) {
        r.curve.getPointAt(fl.u, P);
        r.curve.getTangentAt(fl.u, Tn);
        out.copy(P).sub(g.foe).setY(0).normalize().addScaledVector(Tn, -out.dot(Tn)).normalize();
        fl.p.copy(P).addScaledVector(out, r.rad(fl.u) * 0.85);
        fl.q.setFromUnitVectors(Z, out);
        fl.q.multiply(new THREE.Quaternion().setFromAxisAngle(Z, fl.spin));
      } else k = 0;
      M.compose(fl.p, fl.q, S.setScalar(Math.max(1e-3, k * fl.s * fade.k)));
      flowers.setMatrixAt(i, M);
      flowers.setColorAt(i, tc.copy(fl.col).lerp(ember, burn));
    });
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    kit.flower.uniforms.uEmissiveAmt.value = char.k * 0.2;
  }, () => {
    for (const x of roots) x.r.mesh.geometry.dispose();
    flowerGeo.dispose();
    flowers.dispose();
  });
  registerInkRoot(root);
  return { root, set: (v) => (G = v), fade, bloom, char, kill: () => layer.kill() };
}

// ───────────────────────── Withering ─────────────────────────

/** The "withered brown" version of a color: saturation drained, pressed to the brown of an old photograph (for the legacy model) */
function deadOf(c: THREE.Color, glow: boolean): THREE.Color {
  const l = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return glow ? new THREE.Color(0.1 + l * 0.5, 0.07 + l * 0.36, 0.03 + l * 0.2) : new THREE.Color(0.17 + l * 0.7, 0.12 + l * 0.55, 0.06 + l * 0.34);
}

/** The opponent's color is drained (k = 0 original color, 1 fully withered): the spirit material has uWither, which withers the whole color including vertex colors and self-illumination; the legacy material can only change the base color */
function witherFoe(c: UltCtx, k: number): void {
  const m = mem(c);
  const cr = c.sc.slots[c.foe].creature;
  if (!cr) return;
  if (!m.foe) {
    const mats = cr.mats.filter((x) => x.uniforms.uColor);
    const orig = mats.map((x) => (x.uniforms.uColor.value as THREE.Color).clone());
    const glows = [...cr.glows];
    const gOrig = glows.map((g) => g.color.clone());
    m.foe = { mats, orig, dead: orig.map((o) => deadOf(o, false)), glows, gOrig, gDead: gOrig.map((o) => deadOf(o, true)) };
  }
  const f = m.foe;
  f.mats.forEach((x, i) => {
    if (x.uniforms.uWither) x.uniforms.uWither.value = k;
    else (x.uniforms.uColor.value as THREE.Color).lerpColors(f.orig[i], f.dead[i], k);
  });
  f.glows.forEach((g, i) => g.color.lerpColors(f.gOrig[i], f.gDead[i], k));
}

/** The withered earth at the opponent's feet: brown soil spreading outward, cracks emerging */
function deadGround(c: UltCtx, radius: number): { set(k: number): void; kill(): void } {
  const { sc, foe } = c;
  const g = new THREE.Group();
  g.position.copy(sc.slots[foe].home).setY(0.05);
  const soil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: deadTex(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }));
  soil.rotation.x = -Math.PI / 2;
  soil.renderOrder = 2;
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ map: crackTex(2), color: 0x241608, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }));
  crack.rotation.set(-Math.PI / 2, 0, hash(radius) * TAU);
  crack.position.y = 0.01;
  crack.renderOrder = 3;
  g.add(soil, crack);
  let k = 0;
  const layer = sc.vfx.layer(g, () => {
    g.scale.setScalar(Math.max(1e-3, radius * (0.25 + 0.75 * ease.outCubic(clamp01(k)))));
    (soil.material as THREE.MeshBasicMaterial).opacity = 0.9 * clamp01(k * 1.6);
    (crack.material as THREE.MeshBasicMaterial).opacity = 0.85 * clamp01((k - 0.3) / 0.5);
  });
  return { set: (v) => (k = v), kill: () => layer.kill() };
}

/** Withered leaves rustling down from the opponent's body */
function shedDeadLeaves(c: UltCtx, count: number): void {
  const { sc, foe } = c;
  const hf = sc.slots[foe].creature?.worldHeight ?? 1.5;
  const pos = sc.center(foe);
  sc.vfx.smoke({ pos, count, color: [0xc8a060, 0x9a7a48, 0xe0c080, 0x7a5a30], speed: [0.2, 0.9], life: [0.9, 1.5], size: [0.12, 0.22], sizeEnd: 0.9, atlas: 3, spin: 7, radius: hf * 0.4, gravity: 2.2, drag: 1.4 });
}

// ───────────────────────── Light, flowers and leaves ─────────────────────────

/** Morning light: several shafts of light slanting down behind the canopies (additive), k controls brightness */
function makeRays(c: UltCtx, center: THREE.Vector3, h: number): { k: number; kill(): void } {
  const { sc } = c;
  const g = new THREE.Group();
  const cam = sc.stage.camera.position.clone();
  const away = center.clone().sub(cam).setY(0).normalize();
  const tex = rayTex();
  const rays: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0xfff4c8).multiplyScalar(0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0, side: THREE.DoubleSide });
    const r = new THREE.Mesh(new THREE.PlaneGeometry(h * (0.1 + hash(i * 3) * 0.12), h * 2.4), mat);
    const lat = new THREE.Vector3().crossVectors(away, UP).multiplyScalar((i - 2) * h * 0.28 + (hash(i) - 0.5) * h * 0.2);
    r.position.copy(center).addScaledVector(away, h * 0.35).add(lat).addScaledVector(UP, h * 0.85);
    r.lookAt(cam.clone().setY(r.position.y));
    r.rotateZ(-0.35 + (hash(i * 7) - 0.5) * 0.25);
    r.renderOrder = 4;
    rays.push(r);
    g.add(r);
  }
  const st = { k: 0, kill: () => layer.kill() };
  const layer = sc.vfx.layer(g, (_dt, t) => {
    rays.forEach((r, i) => ((r.material as THREE.MeshBasicMaterial).opacity = st.k * (0.5 + Math.sin(t * 1.7 + i * 1.3) * 0.25)));
  });
  return st;
}

/** Light pillar: the light of recovery surging up from the opponent's feet at the impact; burn turns it into fire from the bottom up */
interface Pillar {
  set(a: number, burn: number, grow: number): void;
  kill(): void;
}
function makePillar(c: UltCtx, base: THREE.Vector3, r: number, H: number): Pillar {
  const { sc } = c;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 }, uBurn: { value: 0 }, uT: { value: 0 }, uHeal: { value: new THREE.Color(0xd8ffa0).multiplyScalar(1.2) }, uFire: { value: new THREE.Color(0xff9a50).multiplyScalar(1.05) } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform float uA; uniform float uBurn; uniform float uT; uniform vec3 uHeal; uniform vec3 uFire;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float y = vUv.y;
        float f = abs(dot(normalize(vN), normalize(vV + vec3(1e-6))));
        float core = pow(max(f, 0.0), 2.2);
        float streak = 0.55 + 0.45 * sin(vUv.x * 37.7 + y * 9.0 - uT * 7.0) * sin(vUv.x * 12.6 - uT * 3.0);
        float fall = pow(max(1.0 - y, 0.0), 1.3);
        float burnt = smoothstep(uBurn * 1.15 - 0.02, uBurn * 1.15 - 0.2, y);
        vec3 col = mix(uHeal, uFire, burnt);
        float a = (0.1 + 0.9 * core) * streak * fall * uA * 0.8;
        gl_FragColor = vec4(col * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const geo = new THREE.CylinderGeometry(r, r * 1.25, H, 40, 1, true);
  geo.translate(0, H / 2, 0);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(base);
  m.renderOrder = 6;
  m.visible = false;
  let a = 0;
  let burn = 0;
  let grow = 0;
  const layer = sc.vfx.layer(m, (_dt, t) => {
    m.visible = a > 0.003;
    mat.uniforms.uA.value = a;
    mat.uniforms.uBurn.value = burn;
    mat.uniforms.uT.value = t;
    m.scale.set(0.6 + 0.4 * grow, Math.max(1e-3, grow), 0.6 + 0.4 * grow);
  });
  return {
    set(aa, bb, gg) {
      a = aa;
      burn = bb;
      grow = gg;
    },
    kill: () => layer.kill(),
  };
}

interface Swarm {
  go(from: THREE.Vector3[], to: THREE.Vector3, flight: number): void;
  kill(): void;
}

/** A solid thin sheet for a leaf (or petal): center at the origin, leaf tip toward +y */
function leafGeo(len: number, w: number): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  sh.moveTo(0, -len / 2);
  sh.quadraticCurveTo(w, -len * 0.05, 0, len / 2);
  sh.quadraticCurveTo(-w, -len * 0.05, 0, -len / 2);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false, curveSegments: 4 });
  geo.translate(0, 0, -0.006);
  return geo;
}

/**
 * The body of the torrent: several hundred solid leaves and petals (scene material + outline), pouring from the two forests and spiraling along an arc toward the opponent;
 * the arriving leaves scatter on impact. Built and hidden first (the shaders are compiled before the announcement), and go() sets them off.
 */
function makeSwarm(c: UltCtx, g: Geo, kit: Kit): Swarm {
  const { sc } = c;
  const lo = low(c);
  const n = lo ? 80 : 200;
  const geo = leafGeo(0.42 * g.s, 0.16 * g.s);
  const mesh = new THREE.InstancedMesh(geo, kit.swarm, n);
  mesh.frustumCulled = false;
  mesh.layers.enable(INK_LAYER);
  mesh.userData.inkScene = true;
  const cols = [0x5fb040, 0x86cc4e, 0xa8d862, 0x3f8a32, 0xff94c4, 0xfff0f4, 0xffb6d6].map((x) => new THREE.Color(x));
  const parts = Array.from({ length: n }, (_, i) => ({
    ci: i % 2,
    lag: Math.pow(hash(i * 1.3), 1.4) * 0.34,
    r: (0.08 + 0.72 * Math.sqrt(hash(i * 2.7))) * g.s,
    th: hash(i * 4.1) * TAU,
    w: (5 + 6 * hash(i * 5.9)) * (i % 3 ? 1 : -1),
    s: 0.7 + 0.8 * hash(i * 6.3),
    ax: new THREE.Vector3(hash(i) - 0.5, hash(i + 7) - 0.5, hash(i + 9) - 0.5).normalize(),
    spin: 8 + 12 * hash(i * 8.8),
    out: new THREE.Vector3(hash(i * 3.3) - 0.5, 0.25 + hash(i * 4.4) * 0.7, hash(i * 5.5) - 0.5).normalize(),
  }));
  parts.forEach((_, i) => mesh.setColorAt(i, cols[i % 7 < 4 ? i % 4 : 4 + (i % 3)]));
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const P = new THREE.Vector3();
  const Tn = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const S = new THREE.Vector3();
  const hide = () => {
    M.makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, M);
    mesh.instanceMatrix.needsUpdate = true;
  };
  hide();
  let curves: THREE.QuadraticBezierCurve3[] | null = null;
  let to = new THREE.Vector3();
  let fl = 0.5;
  let t = 0;
  const layer = sc.vfx.layer(mesh, (dt) => {
    if (!curves) return;
    t += dt;
    for (let i = 0; i < n; i++) {
      const p = parts[i];
      const u = (t - p.lag * fl) / fl;
      if (u <= 0) {
        M.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, M);
        continue;
      }
      let k: number;
      if (u < 1) {
        // Faster and faster as they fly (rushing across), spread widest in the middle and spiraling
        const uu = u * u * 0.4 + u * 0.6;
        const cv = curves[p.ci];
        cv.getPoint(uu, P);
        cv.getTangent(Math.min(1, uu), Tn);
        N.crossVectors(Tn, UP).normalize();
        B.crossVectors(N, Tn);
        const spread = p.r * (0.3 + 0.9 * Math.sin(Math.PI * Math.min(1, uu * 1.1)));
        const a = p.th + p.w * t;
        P.addScaledVector(N, Math.cos(a) * spread).addScaledVector(B, Math.sin(a) * spread);
        k = THREE.MathUtils.smoothstep(u, 0, 0.12);
      } else {
        // Hitting the root cage: scattering, shrinking
        const e = (u - 1) * fl / 0.4;
        if (e >= 1) {
          M.makeScale(0, 0, 0);
          mesh.setMatrixAt(i, M);
          continue;
        }
        P.copy(to).addScaledVector(p.out, (1 - (1 - e) * (1 - e)) * (0.6 + p.r * 3) * g.s);
        k = 1 - e;
      }
      Q.setFromAxisAngle(p.ax, p.th + p.spin * t);
      M.compose(P, Q, S.setScalar(Math.max(1e-3, k * p.s)));
      mesh.setMatrixAt(i, M);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (t > fl * 1.34 + 0.45) {
      curves = null;
      hide();
    }
  }, () => {
    geo.dispose();
    mesh.dispose();
  });
  registerInkRoot(mesh);
  return {
    go(from, target, flight) {
      to = target.clone();
      fl = flight;
      t = 0;
      curves = arcs(g, from, target);
    },
    kill: () => layer.kill(),
  };
}

/** Arc of the torrent: arching from the two forests over the grove path toward the opponent (the two streams diverge slightly to the sides) */
function arcs(g: Geo, from: THREE.Vector3[], to: THREE.Vector3): THREE.QuadraticBezierCurve3[] {
  return from.map((p, i) => {
    const apex = p.clone().lerp(to, 0.42).addScaledVector(UP, g.h * 0.24 + p.distanceTo(to) * 0.05).addScaledVector(g.a, (i ? 1 : -1) * 0.45);
    return new THREE.QuadraticBezierCurve3(p.clone(), apex, to.clone());
  });
}

/**
 * The torrent of evergreen leaves and petals: scattered from the two forests (from), flying along the arc over the grove path toward to; the head of the torrent arrives after flight seconds.
 * The particles fly forward along the arc, the head of the torrent has a ball of light and a few large evergreen leaves; a faint wind ribbon (an additive tube) strings the two streams together.
 */
function torrent(c: UltCtx, from: THREE.Vector3[], to: THREE.Vector3, flight: number): void {
  const { sc } = c;
  const m = mem(c);
  const lo = low(c);
  const g = m.g!;
  const curves = arcs(g, from, to);
  m.swarm?.go(from, to, flight);
  const root = new THREE.Group();
  // Wind ribbon: a thin tube along the arc, stripes scrolling with the flow, drawn only up to the head of the torrent
  const ribbons = curves.map((cv) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uHead: { value: 0 }, uT: { value: 0 }, uA: { value: 1 }, uCol: { value: new THREE.Color(0xd8ffb0).multiplyScalar(0.9) } },
      vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */ `
        uniform float uHead; uniform float uT; uniform float uA; uniform vec3 uCol;
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){
          float x = vUv.x;
          if (x > uHead) discard;
          float f = abs(dot(normalize(vN), normalize(vV + vec3(1e-6))));
          float ang = vUv.y * 6.2831853;
          float flow = 0.5 + 0.5 * sin(ang * 2.0 + x * 34.0 - uT * 26.0);
          float front = smoothstep(uHead, uHead - 0.25, x);
          float ends = smoothstep(0.0, 0.08, x);
          float a = pow(max(f, 0.0), 1.1) * (0.4 + 0.6 * flow) * front * ends * uA;
          gl_FragColor = vec4(uCol * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(cv, 48, 0.26 * g.s, 10, false), mat);
    mesh.renderOrder = 5;
    root.add(mesh);
    return mat;
  });
  // Head of the torrent: a ball of light and a few large evergreen leaves
  const heads = curves.map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(GLOW).multiplyScalar(1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    s.scale.setScalar(0.8 * g.s);
    root.add(s);
    return s;
  });
  const leaves = Array.from({ length: lo ? 3 : 6 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: leafTex(), color: new THREE.Color(GLOW).multiplyScalar(1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    s.scale.setScalar((0.34 + 0.18 * hash(i)) * g.s);
    root.add(s);
    return { s, ci: i % curves.length, lag: 0.03 + hash(i * 3) * 0.2, off: new THREE.Vector3(hash(i + 1) - 0.5, hash(i + 2) - 0.5, hash(i + 3) - 0.5).multiplyScalar(0.8 * g.s) };
  });
  const rate = lo ? 90 : 220;
  let acc = 0;
  let t = 0;
  const P = new THREE.Vector3();
  const Tn = new THREE.Vector3();
  const layer = sc.vfx.layer(root, (dt) => {
    t += dt;
    const hk = Math.min(1, t / flight);
    const env = t < flight ? 1 : Math.max(0, 1 - (t - flight) / 0.25);
    if (t > flight + 0.3) {
      layer.kill();
      return;
    }
    ribbons.forEach((r) => {
      r.uniforms.uHead.value = ease.outQuad(hk);
      r.uniforms.uT.value = t;
      r.uniforms.uA.value = env;
    });
    curves.forEach((cv, i) => {
      cv.getPoint(ease.outQuad(hk), P);
      heads[i].position.copy(P);
      heads[i].material.opacity = env * (hk < 1 ? 0.55 : 0.3);
    });
    for (const l of leaves) {
      const u = ease.outQuad(clamp01((t - l.lag) / flight));
      curves[l.ci].getPoint(u, P).add(l.off);
      l.s.position.copy(P);
      l.s.material.opacity = u > 0 ? env : 0;
      l.s.material.rotation += dt * 9;
    }
    acc += dt * rate * env;
    const n = Math.floor(acc);
    if (!n) return;
    acc -= n;
    for (let i = 0; i < n; i++) {
      const cv = curves[i % curves.length];
      const u = Math.max(0, ease.outQuad(hk) - Math.random() * 0.4);
      cv.getPoint(u, P);
      cv.getTangent(Math.min(1, u + 0.01), Tn);
      const petal = Math.random() < 0.55;
      sc.vfx.emit({ pos: P, count: 1, color: petal ? [PINK, PINK_LT] : [GREEN, GREEN_LT], speed: [3, 7], dir: Tn, spread: 0.35, life: [0.4, 0.8], size: petal ? [0.1, 0.18] : [0.1, 0.2], sizeEnd: 0.6, atlas: 3, spin: 12, radius: 0.4 * g.s, drag: 1.2, gravity: 0.6, intensity: 0.7 });
    }
  });
  m.layers.push(layer);
}

/** A new evergreen leaf grows from the ash and flies in an arc back to the forest on its head */
function returnLeaf(c: UltCtx, from: THREE.Vector3): void {
  const { sc } = c;
  const g = mem(c).g!;
  // A solid new leaf (the same kind of leaf as the torrent), with a faint layer of light around it
  const s = new THREE.Group();
  const leaf = solid(leafGeo(0.5 * g.s, 0.19 * g.s), sceneMaterial(0x9fe06a, { rim: 0.5, emissive: GLOW, emissiveAmt: 0.3 }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(GLOW).multiplyScalar(0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
  halo.scale.setScalar(0.7 * g.s);
  s.add(leaf, halo);
  s.scale.setScalar(0);
  registerInkRoot(s);
  const P = new THREE.Vector3();
  const dur = 0.85;
  let done = false;
  void sc.vfx.spawn(s, dur, (k) => {
    const to = crowns(c).l;
    // It first floats up from the ash for a stretch, then arcs back
    const rise = from.clone().addScaledVector(UP, g.hf * 0.5);
    const e = ease.inOutQuad(clamp01((k - 0.2) / 0.8));
    if (k < 0.2) P.lerpVectors(from, rise, ease.outQuad(k / 0.2));
    else P.lerpVectors(rise, to, e).addScaledVector(UP, Math.sin(e * Math.PI) * g.h * 0.45);
    s.position.copy(P);
    halo.material.opacity = Math.min(0.6, k * 4);
    leaf.rotation.set(k * 7, k * 11, k * 5);
    s.scale.setScalar(Math.min(1, k * 8) * (1 - 0.45 * e));
    if (k > 0.2) sc.vfx.emit({ pos: P, count: 2, color: [GLOW, WHITE], speed: [0.1, 0.4], life: [0.3, 0.5], size: [0.04, 0.08], drag: 2, intensity: 0.8 });
    if (k > 0.97 && !done) {
      done = true;
      void sc.vfx.glint(to, GLOW, 0.6 + g.h * 0.12, 0.5, 2.5);
      sc.vfx.emit({ pos: to, count: 24, color: [GLOW, PINK_LT, WHITE], speed: [0.5, 1.6], life: [0.5, 0.9], size: [0.05, 0.1], radius: g.h * 0.12, gravity: 0.6, drag: 1.5, intensity: 0.8 });
      ultSfx.shing(1.25);
      synth.tone({ type: 'sine', f0: 1320, f1: 1760, dur: 0.5, gain: 0.06 });
      const A = act(c);
      A.rustle = 0.7;
      void sc.tw.to(0.5, (x) => (A.rustle = 0.7 * (1 - x)), ease.outQuad, 'fx');
    }
  });
}

// ───────────────────────── Sound ─────────────────────────
// The stag call, branches and leaves, birdsong, stamp, roots, root cage, withering crack, strong gust, blooming flowers and ignition are audio files generated by ElevenLabs; synthesized versions are used until they finish loading

function sfxStomp(): void {
  synth.tone({ type: 'sine', f0: 70, f1: 30, dur: 0.6, gain: 0.5 });
  ultSfx.thump(0.8);
  playOr(stompUrl, () => synth.noise({ type: 'lowpass', f0: 800, f1: 80, dur: 0.5, gain: 0.45 }), { gain: 1 });
}

function sfxRoots(): void {
  playOr(rootsUrl, () => {
    synth.noise({ type: 'lowpass', f0: 300, f1: 900, dur: 0.9, gain: 0.3, attack: 0.1 });
    for (let i = 0; i < 8; i++) synth.noise({ type: 'bandpass', f0: 900 + i * 150, q: 5, dur: 0.05, gain: 0.08, delay: i * 0.09 });
  }, { gain: 0.9 });
  synth.tone({ type: 'sine', f0: 45, f1: 38, dur: 1.0, gain: 0.3, attack: 0.1 });
}

function sfxCage(): void {
  playOr(cageUrl, () => {
    synth.noise({ type: 'lowpass', f0: 1200, f1: 200, dur: 0.4, gain: 0.35 });
    synth.tone({ type: 'sawtooth', f0: 120, f1: 70, dur: 0.6, gain: 0.06, attack: 0.05 });
  }, { gain: 0.9 });
  playOr(witherUrl, () => synth.noise({ type: 'highpass', f0: 3800, f1: 1400, dur: 0.6, gain: 0.14, attack: 0.05 }), { gain: 0.7, delay: 0.12 });
}

// ───────────────────────── Cinematic ─────────────────────────

/** Announcement → eyes open → waking the forest → long call → rear up */
async function windup(c: UltCtx): Promise<void> {
  const { sc, cine, side } = c;
  const m = mem(c);
  const g = geometry(c);
  m.g = g;
  const h = g.h;
  const A = act(c);
  const lo = low(c);
  const port = sc.portrait;
  // Build all of this move's solid objects first (none have grown yet), and compile the shaders before the announcement
  const kit = makeKit(c);
  m.kit = kit;
  m.line = makeRootLine(c, g, kit);
  m.wake = makeWake(c, g, kit);
  m.grove = makeGrove(c, g, kit);
  m.cage = makeCage(c, g, kit);
  const hoofAt = anchorPos(c, 'hoofL', () => g.home.clone().addScaledVector(g.f, h * 0.18)).lerp(anchorPos(c, 'hoofR', () => g.home.clone().addScaledVector(g.f, h * 0.18)), 0.5).setY(0);
  m.hoof = makeHoofRoots(c, g, kit, hoofAt);
  m.pillar = makePillar(c, g.foe.clone().setY(0.02), g.cageR * 0.6, g.hf * 2.4 + 2.5);
  m.swarm = makeSwarm(c, g, kit);
  m.ground = deadGround(c, g.cageR * 1.6 + 0.8);
  sc.stage.prewarm();

  const head0 = sc.head(side);
  const tl = sc.gs.timeline('world');
  const push = { k: 0 };
  // ① Announcement: warm gold of morning light; the camera pressed below the head, shooting up at the face and the forests on its head
  tl.call(() => {
    c.ui.cutin(side, c.who, c.skill.name, c.el, true);
    preloadSamples(...FILES);
    synth.dropMusic();
    synth.noise({ type: 'bandpass', f0: 300, f1: 1400, q: 0.8, dur: 1.1, gain: 0.22, attack: 0.7 });
    synth.tone({ type: 'sine', f0: 55, f1: 49, dur: 1.2, gain: 0.25, attack: 0.3 });
    void cine.look({ letterbox: 1, vignette: 0.55, desat: 0, tint: DAWN, lift: 0x000000, bloom: 0.6, fov: port ? 1.35 : 1.22 }, 0.4, ease.outQuad);
    cine.track(() => sc.head(side), ['vig', 'radial']);
    // The look-at point is pressed below the face: the face sits in the upper half of the frame, the name banner below, and the forests on its head reach the top edge of the frame
    const aim = () => sc.head(side).addScaledVector(UP, -h * 0.07);
    const lk = aim();
    const camA = cine.orbitPos(side, head0, 46, h * 1.5, -h * 0.3);
    const camB = cine.orbitPos(side, head0, 28, h * 1.26, -h * 0.34);
    const ls = lk.clone();
    cine.cut(camA, ls);
    ride(c, (pos, look, dt) => {
      pos.lerpVectors(camA, camB, ease.outQuad(push.k));
      ls.lerp(aim(), 1 - Math.exp(-dt * 8));
      look.copy(ls);
    });
    // Light specks floating upward: the air of the forest waking up
    let acc = 0;
    const motes = sc.vfx.layer(new THREE.Object3D(), (dt) => {
      acc += dt * (lo ? 14 : 30);
      const n = Math.floor(acc);
      if (!n) return;
      acc -= n;
      sc.vfx.emit({ pos: crowns(c).mid, count: n, color: [GOLD, GLOW, WHITE], speed: [0.05, 0.3], life: [1.2, 2], size: [0.025, 0.06], sizeEnd: 0.6, radius: h * 0.45, gravity: -0.25, drag: 0.5, intensity: 0.8 });
    });
    m.layers.push(motes);
    tl.call(() => motes.kill(), [], T.rear);
  }, [], 0);
  tl.to(push, { k: 1, duration: T.rear, ease: 'none' }, 0);
  tl.to(A, { focus: 1, duration: 0.3, ease: 'power2.out' }, 0);

  // ② Eyes open: eye glints, the source crystal lights up
  tl.call(() => eyeGlint(c, GLOW, 1.0), [], T.glint);
  tl.to(A, { glow: 1, duration: 0.5, ease: 'power1.inOut' }, T.glint);

  // ③ Waking the forest: canopies swell, flowers open, petals and new leaves spray, morning light slants down
  tl.to(A, { bloom: 1, duration: 0.55, ease: 'back.out(1.8)' }, T.bloom);
  tl.to(A, { rustle: 0.5, duration: 0.1 }, T.bloom);
  tl.to(A, { rustle: 0.12, duration: 0.35 }, T.bloom + 0.15);
  tl.call(() => {
    playOr(growUrl, () => {
      synth.noise({ type: 'lowpass', f0: 400, f1: 2600, dur: 0.5, gain: 0.22, attack: 0.1 });
      synth.noise({ type: 'highpass', f0: 2000, f1: 4500, dur: 0.45, gain: 0.14, attack: 0.15 });
    }, { gain: 1, peakIn: 0.3 });
    playOr(birdsUrl, () => {
      for (let i = 0; i < 4; i++) synth.tone({ type: 'triangle', f0: 2300 + i * 200, f1: 3300, dur: 0.07, gain: 0.05, delay: 0.2 + i * 0.25 });
    }, { gain: 0.4, delay: 0.1 });
    const rays = makeRays(c, crowns(c).mid, h);
    m.rays = rays;
    m.layers.push({ kill: () => rays.kill(), get alive() { return true; } });
    void sc.tw.to(0.5, (k) => (rays.k = k), ease.outQuad, 'fx');
    // The two forests spray petals and new leaves, with a flash where the flowers open
    let tt = 0;
    const burst = sc.vfx.layer(new THREE.Object3D(), (dt) => {
      tt += dt;
      if (tt > 0.5) return burst.kill();
      const cw = crowns(c);
      for (const p of [cw.l, cw.r]) {
        sc.vfx.emit({ pos: p, count: lo ? 2 : 4, color: [PINK, PINK_LT, WHITE], speed: [0.8, 2.2], dir: UP, spread: 0.9, life: [0.8, 1.4], size: [0.07, 0.13], sizeEnd: 0.7, atlas: 3, spin: 8, radius: h * 0.12, gravity: 1.2, drag: 1.6, intensity: 0.75 });
        sc.vfx.emit({ pos: p, count: lo ? 1 : 3, color: [GREEN, GREEN_LT], speed: [0.6, 1.8], dir: UP, spread: 1, life: [0.8, 1.3], size: [0.08, 0.14], sizeEnd: 0.7, atlas: 3, spin: 8, radius: h * 0.12, gravity: 1.4, drag: 1.6, intensity: 0.7 });
      }
    });
    m.layers.push(burst);
    for (let i = 0; i < 3; i++) void c.wait(0.12 + i * 0.1).then(() => {
      const cw = crowns(c);
      const p = (i % 2 ? cw.l : cw.r).clone().add(new THREE.Vector3((hash(i) - 0.5) * h * 0.15, (hash(i + 3) - 0.3) * h * 0.1, (hash(i + 6) - 0.5) * h * 0.15));
      void sc.vfx.glint(p, i % 2 ? PINK_LT : GOLD, 0.35 + h * 0.08, 0.45, 2.2);
      synth.tone({ type: 'triangle', f0: [1568, 2093, 2637][i], dur: 0.4, gain: 0.05 });
    });
  }, [], T.bloom);

  // ④ Long call: head thrown back, two sound-wave rings in front of the mouth, the canopies shaken by the sound and rustling
  tl.to(A, { raise: 1, duration: 0.2, ease: 'back.out(2)' }, T.bellow);
  tl.to(A, { rustle: 1, duration: 0.08 }, T.bellow + 0.05);
  tl.to(A, { rustle: 0.35, duration: 0.4 }, T.bellow + 0.3);
  tl.call(() => {
    playOr(stagUrl, () => {
      synth.tone({ type: 'sawtooth', f0: 180, f1: 120, dur: 1.2, gain: 0.12, attack: 0.1 });
      synth.noise({ type: 'bandpass', f0: 700, f1: 400, q: 1.5, dur: 1.2, gain: 0.25, attack: 0.1 });
    }, { gain: 0.85, peakIn: 0.15 });
    sc.rig.addTrauma(0.25);
    void cine.pulse({ radial: 0.45 }, { radial: 0 }, 0.6);
    const head = sc.head(side);
    const mouth = anchorPos(c, 'mouth', () => head);
    const out = mouth.clone().sub(head).normalize().add(new THREE.Vector3(0, 0.6, 0)).normalize();
    // The sound waves only unfold some distance in front of the mouth, so they do not cover the face
    for (let i = 0; i < 2; i++) void c.wait(0.1 + i * 0.14).then(() => sc.vfx.ring(anchorPos(c, 'mouth', () => mouth).addScaledVector(out, h * (0.2 + i * 0.14)), 0xeaffd8, h * 0.04, h * (0.2 + i * 0.1), 0.4, out));
    cine.shock(mouth, 0.45, 0.45, 0.6);
    // New leaves shaken loose by the sound
    const cw = crowns(c);
    for (const p of [cw.l, cw.r]) sc.vfx.emit({ pos: p, count: lo ? 10 : 22, color: [GREEN, GREEN_LT, PINK_LT], speed: [0.5, 1.6], life: [1, 1.6], size: [0.08, 0.14], sizeEnd: 0.8, atlas: 3, spin: 8, radius: h * 0.14, gravity: 1.8, drag: 1.5, intensity: 0.7 });
  }, [], T.bellow + 0.04);

  // ⑤ Rear up (cut): side-on, ground-level low-angle full-body shot; the forehooves leave the ground and paw the air
  tl.to(A, { rear: 1, duration: T.rearDur, ease: 'power2.out' }, T.rear);
  tl.to(A, { raise: 0.45, duration: 0.3, ease: 'power1.inOut' }, T.rear);
  tl.to(A, { rustle: 0.6, duration: 0.2 }, T.rear);
  tl.call(() => {
    if (m.rays) {
      const rays = m.rays;
      void sc.tw.to(0.2, (k) => (rays.k = 1 - k), ease.linear, 'fx');
    }
    sfx.whooshBig();
    synth.noise({ type: 'lowpass', f0: 500, f1: 200, dur: 0.5, gain: 0.2, attack: 0.05 });
    const fov = port ? 1.35 : 1.25;
    void cine.look({ fov, roll: port ? 0 : 0.035, vignette: 0.5 }, 0);
    const at = g.home.clone().addScaledVector(g.f, h * 0.08).setY(h * 0.62);
    const dist = fitDist(c, h * 1.6, h * 1.5, fov);
    const p0 = cine.orbitPos(side, at, 98, dist, 0).setY(0.32);
    const p1 = cine.orbitPos(side, at, 90, dist * 0.9, 0).setY(0.4);
    let tt = 0;
    ride(c, (pos, look, dt) => {
      tt += dt;
      pos.lerpVectors(p0, p1, ease.outQuad(Math.min(1, tt / 0.7)));
      look.copy(at);
    });
    cine.track(() => sc.head(side), ['vig']);
    // Hind hooves kicking up dust
    sc.vfx.smoke({ pos: g.home.clone().addScaledVector(g.f, -h * 0.12).setY(0.15), count: lo ? 8 : 16, color: DUST, speed: [0.6, 2], dir: UP, spread: 0.9, life: [0.6, 1.1], size: [0.25, 0.5], sizeEnd: 1.1, radius: h * 0.12, drag: 1.5, gravity: -0.4 });
  }, [], T.rear);
  tl.set({}, {}, T.windup);
  await playTimeline(tl);
}

/** Stamp → root veins rushing → root cage → target's view, tossing the head to pour out the torrent */
async function deliver(c: UltCtx): Promise<void> {
  const { sc, cine, side, foe } = c;
  const m = mem(c);
  const g = m.g ?? geometry(c);
  m.g = g;
  const h = g.h;
  const hf = g.hf;
  const A = act(c);
  const lo = low(c);
  const port = sc.portrait;
  const race = m.race;
  const crane = { k: 0 };
  const tl = sc.gs.timeline('world');

  // ① Stamp: the front body comes crashing down, the forehooves land
  tl.to(A, { rear: 0, duration: T.land, ease: 'power3.in' }, 0);
  tl.to(A, { raise: 0, duration: T.land + 0.05, ease: 'power2.in' }, 0);
  tl.call(() => {
    sfxStomp();
    sc.stage.hitStop(70);
    sc.rig.addTrauma(0.6);
    const at = anchorPos(c, 'hoofL', () => g.start).lerp(anchorPos(c, 'hoofR', () => g.start), 0.5).setY(0.08);
    const camD = sc.stage.camera.position.distanceTo(at);
    void sc.vfx.ring(at, GLOW, 0.3, Math.min(h * 1.5, camD * 0.6), 0.45);
    void sc.vfx.decal(at.clone().setY(0.05), crackTex(3), GLOW, h * 2, 1.8, undefined, 1.6);
    sc.vfx.smoke({ pos: at, count: lo ? 14 : 30, color: DUST, speed: [2.5, 5.5], life: [0.5, 1.0], size: [0.25, 0.5], sizeEnd: 1.2, radius: h * 0.1, gravity: -0.4, drag: 2.4 });
    void sc.vfx.debris(at, 0x6a5040, lo ? 8 : 14, 6, 1.2, 0.13 * g.s, 0.7);
    sc.vfx.smoke({ pos: at.clone().setY(0.25), count: lo ? 8 : 18, color: DUST, speed: [2, 4], dir: UP, spread: 0.5, life: [0.6, 1.1], size: [0.3, 0.6], sizeEnd: 1.3, radius: h * 0.08, gravity: 1.5, drag: 1.2 });
    sc.vfx.emit({ pos: at, count: lo ? 10 : 22, color: [GREEN, GREEN_LT, 0x4f9a3a], speed: [2, 4.5], dir: UP, spread: 0.7, life: [0.6, 1.1], size: [0.08, 0.15], sizeEnd: 0.7, atlas: 3, spin: 10, radius: h * 0.1, gravity: 4, drag: 1, intensity: 0.7 });
    void cine.pulse({ radial: 0.5 }, { radial: 0 }, 0.45);
    sc.vfx.emit({ pos: at, count: lo ? 12 : 26, color: [GLOW, GREEN_LT, WHITE], speed: [1, 3], dir: UP, spread: 0.8, life: [0.4, 0.8], size: [0.05, 0.1], radius: h * 0.15, gravity: -0.5, drag: 1.4, intensity: 0.8 });
    cine.shock(at, 0.9, 0.55, 0.9);
  }, [], T.land);
  const hoofG = { k: 0 };
  tl.to(hoofG, { k: 1, duration: 0.24, ease: 'power2.out', onUpdate: () => m.hoof?.set(hoofG.k) }, T.land);
  tl.to(A, { brace: 1, duration: 0.3, ease: 'power2.out' }, T.land + 0.06);
  tl.to(A, { rustle: 0.9, duration: 0.05 }, T.land);
  tl.to(A, { rustle: 0.2, duration: 0.5 }, T.land + 0.1);

  // ② Root veins rushing (cut): following the roots' leading edge, sliding from under the hooves all the way to the opponent
  tl.call(() => {
    sfxRoots();
    void cine.look({ fov: port ? 1.35 : 1.18, roll: 0, vignette: 0.45 }, 0);
    // Side-on follow: the camera slides forward alongside the leading edge (slightly behind, looking slightly ahead), the roots and the far-side grove path sweeping across the frame; in the last stretch it pulls back and rises, framing in the whole root cage
    const fov = port ? 1.35 : 1.18;
    const D1 = Math.max(2.6, fitDist(c, g.cageH * 1.4, g.cageR * 3, fov));
    const F = new THREE.Vector3();
    const tgt = new THREE.Vector3();
    const lk = new THREE.Vector3();
    const cageC = g.foe.clone().setY(g.cageH * 0.45);
    const place = () => {
      const e = Math.max(THREE.MathUtils.smoothstep(race.k, 0.72, 1) * 0.6, crane.k);
      pathAt(g, race.k * g.len, 0, 0, F);
      const back = THREE.MathUtils.lerp(0.4, D1 * 0.5, e);
      const lat = THREE.MathUtils.lerp(3.6 * g.s, D1 * 0.86, e);
      tgt.copy(F).addScaledVector(g.f, -back).addScaledVector(g.a, lat).setY(THREE.MathUtils.lerp(0.95, g.cageH * 0.8 + 0.6, e));
      lk.copy(F).addScaledVector(g.f, 0.5).setY(0.35).lerp(cageC, e);
    };
    place();
    cine.cut(tgt, lk);
    cine.track(() => pathAt(g, race.k * g.len, 0, 0.3), ['vig']);
    ride(c, (pos, look, dt) => {
      place();
      const s = 1 - Math.exp(-dt * 12);
      pos.lerp(tgt, s);
      look.lerp(lk, s);
    });
    // The leading edge kicks up soil all the way
    let acc = 0;
    const spray = sc.vfx.layer(new THREE.Object3D(), (dt) => {
      if (race.k >= 1) return spray.kill();
      acc += dt * (lo ? 30 : 60);
      const n = Math.floor(acc);
      if (!n) return;
      acc -= n;
      const p = pathAt(g, race.k * g.len, 0, 0.15);
      sc.vfx.smoke({ pos: p, count: n, color: DUST, speed: [1.5, 3.5], dir: UP.clone().addScaledVector(g.f, 0.6), spread: 0.6, life: [0.35, 0.7], size: [0.18, 0.36], sizeEnd: 1, radius: 0.3, drag: 2, gravity: 2 });
      sc.vfx.emit({ pos: p, count: 1, color: [GLOW, GREEN_LT], speed: [0.5, 1.5], dir: UP, spread: 0.8, life: [0.4, 0.7], size: [0.05, 0.09], radius: 0.3, gravity: -0.4, intensity: 0.8 });
    });
    m.layers.push(spray);
    // Advance the roots' leading edge, the grass and flowers, and the grove path
    const drive = sc.vfx.layer(new THREE.Object3D(), () => {
      const F2 = race.k * g.len;
      m.line?.set(F2 + 0.4);
      m.wake?.set(F2);
      m.grove?.set(F2);
    });
    m.layers.push(drive);
  }, [], T.race);
  tl.to(race, { k: 1, duration: T.raceDur, ease: 'none' }, T.race);
  tl.call(() => void sc.vfx.debris(pathAt(g, g.len * 0.5, 0, 0.2), 0x6a5040, lo ? 4 : 7, 4, 1, 0.08 * g.s, 0.6), [], T.race + T.raceDur * 0.45);

  // ③ Root cage: the ground at the opponent's feet withers and cracks, thick roots shoot up around the opponent and curl into a cage; the opponent's color is drained
  const cageG = { k: 0 };
  tl.call(() => {
    sfxCage();
    sc.rig.addTrauma(0.35);
    sc.slots[foe].creature?.setFlash(0x8a6a40, 0.3);
    const home = g.foe.clone().setY(0.1);
    sc.vfx.smoke({ pos: home, count: lo ? 12 : 26, color: DUST, speed: [1.5, 4], dir: UP, spread: 0.9, life: [0.5, 1], size: [0.25, 0.5], sizeEnd: 1.1, radius: g.cageR * 0.9, drag: 1.8, gravity: -0.5 });
    void sc.vfx.debris(home, 0x6a5040, lo ? 6 : 10, 5, 1.2, 0.1 * g.s, g.cageR);
    for (let i = 0; i < 3; i++) void c.wait(0.08 + i * 0.1).then(() => shedDeadLeaves(c, lo ? 8 : 16));
  }, [], T.cage);
  tl.to(cageG, { k: 1, duration: 0.36, ease: 'power2.out', onUpdate: () => m.cage?.set(cageG.k) }, T.cage);
  tl.to(crane, { k: 1, duration: 0.3, ease: 'power2.out' }, T.cage);
  const dg = { k: 0 };
  tl.to(dg, { k: 1, duration: 0.5, ease: 'none', onUpdate: () => m.ground?.set(dg.k) }, T.cage - 0.05);
  tl.to(m.wither, { k: 1, duration: 0.45, ease: 'power1.inOut', onUpdate: () => witherFoe(c, m.wither.k) }, T.cage + 0.05);

  // ④ Target's view (cut): behind the opponent, audience side, the root cage in the foreground and the grove path leading all the way back to Sylvaron; it tosses its head and the forests pour out the torrent
  tl.call(() => {
    const fov = port ? 1.4 : 1.25;
    void cine.look({ fov, vignette: 0.55, tint: 0xfff4e4 }, 0);
    const foeC = sc.center(foe);
    const me = sc.center(side);
    const look0 = foeC.clone().lerp(me, 0.32).setY(Math.max(h, hf) * 0.36);
    const d = g.cageR * 1.6 + 3.1;
    const p0 = cine.orbitPos(side, g.foe, 62, d, 0).setY(g.cageH * 1.2 + 0.6);
    const p1 = p0.clone().lerp(look0, 0.12);
    cine.cut(p0, look0);
    cine.track(() => sc.center(foe), ['vig', 'radial']);
    let tt = 0;
    ride(c, (pos, look, dt) => {
      tt += dt;
      pos.lerpVectors(p0, p1, ease.inOutQuad(Math.min(1, tt / (T.deliver - T.target + 0.4))));
      look.copy(look0);
    });
  }, [], T.target);
  tl.to(A, { brace: 0, duration: 0.12, ease: 'power3.out' }, T.toss);
  tl.to(A, { raise: 0.75, duration: 0.14, ease: 'back.out(2)' }, T.toss);
  tl.to(A, { rustle: 1, duration: 0.06 }, T.toss + 0.04);
  tl.call(() => {
    const flight = T.deliver - T.launch;
    const cw = crowns(c);
    const to = sc.center(foe).addScaledVector(UP, hf * 0.15);
    torrent(c, [cw.l, cw.r], to, flight);
    playOr(gustUrl, () => sfx.whooshBig(), { gain: 0.9, peakIn: flight });
    ultSfx.swell(flight, 0.18);
    for (const p of [cw.l, cw.r]) sc.vfx.emit({ pos: p, count: lo ? 12 : 26, color: [PINK, PINK_LT, GREEN_LT], speed: [1.5, 3.5], life: [0.4, 0.8], size: [0.08, 0.15], sizeEnd: 0.7, atlas: 3, spin: 10, radius: h * 0.1, drag: 1.5, intensity: 0.8 });
  }, [], T.launch);
  tl.to(A, { rustle: 0.3, duration: 0.3 }, T.launch + 0.1);
  tl.set({}, {}, T.deliver);
  await playTimeline(tl);
}

/** Impact: spring arrives (flowers bloom, a pillar of recovery light) → wither-and-bloom reversal (the pillar turns into fire, the flowers burn into embers, the root cage is charred) → pull back, the root cage crumbles to ash, a new evergreen leaf flies back to the forest */
function impact(c: UltCtx, ev: HitEv): void {
  const { sc, cine, foe, side } = c;
  const m = mem(c);
  const g = m.g!;
  const hf = g.hf;
  const lo = low(c);
  const pos = sc.center(foe);
  const home = g.foe.clone();
  if (ev.hitIndex < ev.hits) return;
  const cage = m.cage;
  const pillar = m.pillar;
  // ① Spring arrives: the root cage blooms with flowers, the pillar of recovery light surges up, petals burst
  playOr(bloomUrl, () => [2093, 2637, 3136].forEach((f, i) => synth.tone({ type: 'triangle', f0: f, dur: 0.5, gain: 0.05, delay: i * 0.05 })), { gain: 1 });
  sfx.heal();
  sc.stage.screenFlash(0xeaffd0, 0.4, 6);
  sc.slots[foe].creature?.setFlash(0xd8ffb0, 0.5);
  sc.vfx.emit({ pos, count: lo ? 30 : 70, color: [PINK, PINK_LT, WHITE, GREEN_LT], speed: [2, 5], life: [0.5, 1], size: [0.09, 0.17], sizeEnd: 0.7, atlas: 3, spin: 12, radius: hf * 0.35, drag: 1.6, gravity: 1, intensity: 0.85 });
  void sc.vfx.ring(home.clone().setY(0.1), GLOW, 0.3, g.cageR * 2.2, 0.5);
  cine.shock(pos, 1.0, 0.6, 1.0);
  const pv = { a: 0, burn: 0, grow: 0 };
  const applyP = () => pillar?.set(pv.a, pv.burn, pv.grow);
  const fx = sc.gs.timeline('fx');
  if (cage) fx.to(cage.bloom, { k: 1, duration: 0.18, ease: 'power2.out' }, 0);
  fx.to(pv, { a: 1, grow: 1, duration: 0.14, ease: 'power2.out', onUpdate: applyP }, 0);
  void cine.look({ bloom: 0.75, tint: 0xf6ffe8 }, 0);

  // ② Wither-and-bloom reversal: wait for the hit-stop to pass (world clock), the pillar of light turns into fire from the bottom, the flowers burn into embers, the root cage is charred, the opponent burns into a charred silhouette
  void c.wait(T.burn).then(() => {
    playOr(igniteUrl, () => synth.noise({ type: 'lowpass', f0: 3200, f1: 200, dur: 0.35, gain: 0.38 }), { gain: 1 });
    sfx.impactBig();
    synth.tone({ type: 'square', f0: 140, f1: 40, dur: 0.16, gain: 0.18 });
    sc.rig.addTrauma(0.45);
    const tl = sc.gs.timeline('fx');
    tl.to(pv, { burn: 1, duration: 0.3, ease: 'power1.in', onUpdate: applyP }, 0);
    tl.to(pv, { a: 0, duration: 0.5, ease: 'power1.in', onUpdate: applyP }, 0.3);
    if (cage) tl.to(cage.char, { k: 1, duration: 0.35, ease: 'power1.in' }, 0);
    tl.call(() => sc.slots[foe].creature?.setFlash(0x1a0c06, 0.9), [], 0.05);
    void cine.look({ haze: 0.8, hazeRadius: 0.35, bloom: 0.5 }, 0.15);
    void cine.pulse({ tint: 0xffd4b4, lift: 0x0c0400 }, { tint: 0xfff0e4, lift: 0x000000 }, 0.6);
    cine.track(() => sc.center(foe), ['vig', 'haze']);
    // Embers and black smoke curl into one column
    let a = hash(ev.dmg) * TAU;
    let acc = 0;
    const swirl = sc.vfx.layer(new THREE.Object3D(), (dt, t) => {
      if (t > 0.8) return swirl.kill();
      a += dt * 12;
      acc += dt * (lo ? 60 : 130);
      const n = Math.floor(acc);
      if (!n) return;
      acc -= n;
      for (let i = 0; i < n; i++) {
        const aa = a + i * 2.1;
        const r = g.cageR * 0.7 + t * 0.5;
        const p = home.clone().add(new THREE.Vector3(Math.cos(aa) * r, 0.2 + t * hf * 1.8 + Math.random() * 0.4, Math.sin(aa) * r));
        sc.vfx.emit({ pos: p, count: 1, color: [EMBER, EMBER_HI, 0xff4a18], speed: [0.5, 1.5], dir: UP, spread: 0.5, life: [0.35, 0.7], size: [0.08, 0.16], sizeEnd: 0.3, atlas: i % 2 ? 3 : 0, spin: 10, gravity: -3, drag: 0.8, intensity: 0.9 });
      }
    });
    m.layers.push(swirl);
    sc.vfx.smoke({ pos: home.clone().setY(0.4), count: lo ? 16 : 34, color: [ASH, 0x14100c, 0x4a3a2c], speed: [1, 3], dir: UP, spread: 0.5, life: [0.8, 1.4], size: [0.35, 0.7], sizeEnd: 2.4, radius: g.cageR * 0.5, gravity: -1.5, drag: 1.2 });
    void sc.vfx.decal(home.clone().setY(0.07), crackTex(3), EMBER, g.cageR * 2.4 + 1, 2, undefined, 1);
    void sc.vfx.ring(home.clone().setY(0.12), EMBER, 0.3, g.cageR * 2.4, 0.55);
  });

  // ③ Pull back: retreating back and up from the target's view, with the grove path, root cage and Sylvaron all in the frame
  void c.wait(0.32).then(() => {
    const r = sc.rig;
    const look = r.look.clone().add(new THREE.Vector3(0, hf * 0.25, 0));
    const p = look.clone().add(r.pos.clone().sub(r.look).multiplyScalar(1.25)).add(new THREE.Vector3(0, hf * 0.35, 0));
    void cine.look({ fov: sc.portrait ? 1.4 : 1.26 }, 0.8);
    void cine.shot(p, look, 0.9, ease.outCubic);
  });
  // ④ The root cage crumbles to ash and shrinks into the ground; a new evergreen leaf grows from the ash and flies back to the forest
  void c.wait(0.7).then(() => {
    if (!cage) return;
    const tl = sc.gs.timeline('fx');
    const cg = { k: 1 };
    tl.to(cg, { k: 0, duration: 0.55, ease: 'power2.in', onUpdate: () => cage.set(cg.k) }, 0);
    for (let i = 0; i < 3; i++) tl.call(() => sc.vfx.smoke({ pos: home.clone().setY(0.3 + i * hf * 0.3), count: lo ? 6 : 12, color: [ASH, 0x3a2e24, 0x5a4a3a], speed: [0.4, 1.4], life: [0.7, 1.2], size: [0.25, 0.5], sizeEnd: 1.8, radius: g.cageR * 0.8, gravity: -0.6, drag: 1.2 }), [], i * 0.12);
    void sc.vfx.debris(home.clone().setY(hf * 0.5), 0x2a1a12, lo ? 5 : 9, 3, 1, 0.08 * g.s, g.cageR);
  });
  void c.wait(0.8).then(() => returnLeaf(c, pos.clone().addScaledVector(UP, hf * 0.2)));
  void c.wait(0.95).then(() => settle(c, 0.45, 0.4));
  // The caster's side: after the toss of the head it slowly returns to a level gaze, the forests swaying gently in the aftermath
  const A = act(c);
  const back = sc.gs.timeline('world');
  back.to(A, { raise: 0, duration: 0.6, ease: 'power2.inOut' }, 0.3);
  void side;
}

/** Blocked: the torrent hits the barrier and scatters into withered leaves, the root cage is pried open, withers to grey-white and shrinks back into the ground, and the opponent's color comes back all at once */
async function guarded(c: UltCtx): Promise<void> {
  const { sc, foe } = c;
  const m = mem(c);
  const g = m.g;
  const hf = g?.hf ?? 1.5;
  const pos = sc.center(foe);
  const lo = low(c);
  sc.vfx.smoke({ pos: pos.clone().addScaledVector(UP, hf * 0.3), count: lo ? 24 : 50, color: [0x8a6a3a, 0xb08a50, 0x6a4a28], speed: [1.5, 3.5], life: [0.8, 1.3], size: [0.1, 0.18], sizeEnd: 0.9, atlas: 3, spin: 9, radius: hf * 0.6, gravity: 3, drag: 1.5 });
  synth.noise({ type: 'highpass', f0: 3000, f1: 1200, dur: 0.5, gain: 0.18 });
  const tl = sc.gs.timeline('fx');
  if (m.cage) {
    const cage = m.cage;
    const cg = { k: 1 };
    // The root cage fades to grey-white and shrinks back into the ground
    tl.to(cage.char, { k: 0.35, duration: 0.2 }, 0);
    tl.to(cg, { k: 0, duration: 0.45, ease: 'power2.in', onUpdate: () => cage.set(cg.k) }, 0.1);
  }
  tl.to(m.wither, { k: 0, duration: 0.35, ease: 'power2.out', onUpdate: () => witherFoe(c, m.wither.k) }, 0.05);
  const A = act(c);
  sc.gs.timeline('world').to(A, { raise: 0, rustle: 0, duration: 0.4, ease: 'power2.inOut' }, 0);
  await ultGuarded(c);
}

/** Afterglow: weights go to zero; the trees, grass, flowers and roots of the grove path shrink back into the ground all the way, the withered earth recedes, and the opponent's color slowly returns */
async function after(c: UltCtx): Promise<void> {
  const { sc } = c;
  const m = mem(c);
  c.cine.track(null);
  const A = act(c);
  const tl = sc.gs.timeline('world');
  tl.to(A, { raise: 0, brace: 0, rear: 0, rustle: 0, duration: 0.35, ease: 'power2.inOut' }, 0);
  tl.to(A, { bloom: 0, glow: 0, duration: 0.7, ease: 'power1.inOut' }, 0.15);
  tl.to(A, { focus: 0, duration: 0.5, ease: 'power1.inOut' }, 0.6);
  // Pulled in from the opponent's end back toward the caster: root cage, grove path, grass and flowers, roots, the roots beside the hooves
  for (const [gw, t0, dur] of [[m.grove, 0, 0.55], [m.wake, 0.05, 0.5], [m.line, 0.1, 0.6], [m.hoof, 0.3, 0.4]] as [Grower | undefined, number, number][]) {
    if (gw) tl.to(gw.fade, { k: 0, duration: dur, ease: 'power2.in' }, t0);
  }
  if (m.cage && m.cage.fade.k > 0) tl.to(m.cage.fade, { k: 0, duration: 0.4, ease: 'power2.in' }, 0);
  if (m.ground) {
    const gd = m.ground;
    const k = { v: 1 };
    tl.to(k, { v: 0, duration: 0.6, ease: 'power1.in', onUpdate: () => gd.set(k.v) }, 0);
  }
  if (m.wither.k > 0) tl.to(m.wither, { k: 0, duration: 0.7, ease: 'power1.inOut', onUpdate: () => witherFoe(c, m.wither.k) }, 0.1);
  tl.call(() => void c.cine.look({ tint: 0xffffff, haze: 0 }, 0.6), [], 0);
  tl.set({}, {}, 0.9);
  await playTimeline(tl);
  for (const l of m.layers) l.kill();
  m.layers = [];
  for (const h of [m.line, m.wake, m.grove, m.hoof, m.cage, m.ground, m.pillar, m.swarm]) h?.kill();
  witherFoe(c, 0);
  // Wait for vfx to remove the meshes on the next frame before disposing the shared materials
  void sc.tw.wait(0.1, 'real').then(() => {
    m.cleanup?.();
    for (const x of m.kit?.mats ?? []) x.dispose();
  });
}

export default defineSsr({
  windup,
  deliver,
  impact,
  guarded,
  after,
  quietHit: true,
  // The opponent is shut in the root cage, so the impact does not knock it back
  pinFoe: true,
});
